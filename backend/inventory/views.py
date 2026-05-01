import csv
import logging
from datetime import datetime
from decimal import Decimal

from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from django.db import transaction as db_transaction
from django.db.models import Sum, F, DecimalField, ExpressionWrapper
from django.http import HttpResponse
from django.contrib.auth.models import User
from django_filters.rest_framework import DjangoFilterBackend

from .models import (
    Category, Outlet, Item, Stock, Transaction,
    StockTakeSession, StockTakeItem, Supplier,
    InventorySnapshot, InventorySnapshotItem,
)
from .serializers import (
    CategorySerializer, OutletSerializer, ItemSerializer,
    TransactionSerializer, StockTakeSessionSerializer, UserSerializer,
    SupplierSerializer, StockTakeItemSerializer, InventorySnapshotSerializer,
    StockSerializer, MeSerializer,
)
from .permissions import (
    IsManager, IsManagerOrReadOnly, IsSupervisorOrManager,
    TransactionPermission, get_user_role, ROLE_MANAGER,
)

logger = logging.getLogger('inventory')


# ---------------------------------------------------------------------------
# Auth / Profile
# ---------------------------------------------------------------------------

@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def health_view(request):
    """Public liveness probe. Used by Render's health-check.

    Cheap, no auth, no DB. Returns 200 as long as the WSGI worker is up.
    """
    return Response({'status': 'ok'})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me_view(request):
    """Return the current user's profile + role token.

    Used by the frontend AuthProvider to discover the user identity and gate
    UI features by role. Always cheap — no DB writes.
    """
    serializer = MeSerializer(request.user, context={'request': request})
    return Response(serializer.data)


class UserViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only directory of users; managers may list to assign tasks."""
    queryset = User.objects.all().order_by('username')
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ['username', 'first_name', 'last_name', 'email']
    ordering_fields = ['username', 'date_joined']


# ---------------------------------------------------------------------------
# Master Data — Read-heavy, Manager-only writes
# ---------------------------------------------------------------------------

class CategoryViewSet(viewsets.ModelViewSet):
    """Product categories (Crockery, Glassware, etc.)."""
    queryset = Category.objects.all().order_by('name')
    serializer_class = CategorySerializer
    permission_classes = [IsManagerOrReadOnly]
    search_fields = ['name']
    ordering_fields = ['name']


class OutletViewSet(viewsets.ModelViewSet):
    """Physical storage and service locations."""
    queryset = Outlet.objects.all().order_by('name')
    serializer_class = OutletSerializer
    permission_classes = [IsManagerOrReadOnly]
    search_fields = ['name', 'location']
    ordering_fields = ['name']


class SupplierViewSet(viewsets.ModelViewSet):
    """Vendor / supplier directory."""
    queryset = Supplier.objects.all().order_by('name')
    serializer_class = SupplierSerializer
    permission_classes = [IsManagerOrReadOnly]
    search_fields = ['name', 'email', 'contact']
    filterset_fields = ['lead_time_days']
    ordering_fields = ['name', 'lead_time_days']


# ---------------------------------------------------------------------------
# Inventory
# ---------------------------------------------------------------------------

class ItemViewSet(viewsets.ModelViewSet):
    """Inventory items with per-outlet stock levels."""
    queryset = Item.objects.select_related('category').prefetch_related('stocks__outlet').all()
    serializer_class = ItemSerializer
    permission_classes = [IsSupervisorOrManager]
    search_fields = ['sku', 'name']
    filterset_fields = ['category', 'unit']
    ordering_fields = ['sku', 'name', 'unit_cost', 'min_stock']
    ordering = ['sku']

    @action(detail=False, methods=['get'], url_path='export')
    def export_csv(self, request):
        """Export the master list as CSV. Manager-only."""
        if get_user_role(request.user) != ROLE_MANAGER:
            return Response(
                {'detail': 'Only managers may export inventory data.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = (
            f'attachment; filename="inventra-items-'
            f'{datetime.now().strftime("%Y%m%d-%H%M%S")}.csv"'
        )
        writer = csv.writer(response)
        writer.writerow([
            'SKU', 'Name', 'Category', 'Unit', 'Min Stock',
            'Par Level', 'Unit Cost (KD)', 'Total Stock', 'Total Value (KD)',
        ])
        for item in self.get_queryset():
            total_stock = sum(s.quantity for s in item.stocks.all())
            total_value = total_stock * float(item.unit_cost)
            writer.writerow([
                item.sku, item.name, item.category.name, item.unit,
                item.min_stock, item.par_level, float(item.unit_cost),
                total_stock, round(total_value, 3),
            ])
        return response


class StockViewSet(viewsets.ReadOnlyModelViewSet):
    """Per-outlet stock quantities. Read-only — mutate via Transactions."""
    queryset = Stock.objects.select_related('item', 'outlet').all()
    serializer_class = StockSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['item', 'outlet']
    ordering_fields = ['quantity']


# ---------------------------------------------------------------------------
# Transactions — Core business logic
# ---------------------------------------------------------------------------

def _month_locked(date_or_str) -> bool:
    """True if a snapshot exists for the given date's YYYY-MM month."""
    if isinstance(date_or_str, str):
        month = date_or_str[:7]
    else:
        month = date_or_str.strftime('%Y-%m')
    return InventorySnapshot.objects.filter(month=month).exists()


class TransactionViewSet(viewsets.ModelViewSet):
    """
    All stock movements: PURCHASE, BREAKAGE, WRITE_OFF, TRANSFER, ADJUSTMENT.

    Creating a transaction atomically updates the corresponding Stock records
    and (for PURCHASE) recalculates the item's weighted-average cost (WAC).
    Closed months reject all writes.
    """
    queryset = (
        Transaction.objects
        .select_related('item', 'outlet', 'target_outlet', 'staff', 'supplier')
        .all()
        .order_by('-date')
    )
    serializer_class = TransactionSerializer
    permission_classes = [TransactionPermission]
    search_fields = ['ref', 'item__name', 'item__sku', 'notes']
    filterset_fields = ['type', 'outlet', 'item', 'staff', 'supplier']
    ordering_fields = ['date', 'value', 'quantity_delta']

    @db_transaction.atomic
    def create(self, request, *args, **kwargs):
        # Period lock check — use the client-supplied date if present,
        # otherwise fall back to "now".
        raw_date = request.data.get('date')
        check_date = datetime.fromisoformat(raw_date) if raw_date else datetime.now()
        if _month_locked(check_date):
            return Response(
                {
                    'error': 'Period is locked',
                    'detail': 'The target month has been sealed and is read-only.',
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Force staff = the authenticated user. Clients should not be trusted
        # to set this field.
        data = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data)
        data['staff'] = request.user.id

        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)

        tx_type = serializer.validated_data['type']
        item = serializer.validated_data['item']
        outlet = serializer.validated_data['outlet']
        delta = serializer.validated_data['quantity_delta']
        target_outlet = serializer.validated_data.get('target_outlet')

        # ---- Validation ----
        if tx_type == 'PURCHASE' and delta <= 0:
            return Response(
                {'error': 'Invalid quantity', 'detail': 'Purchase quantity must be positive.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if tx_type in ('BREAKAGE', 'WRITE_OFF') and delta >= 0:
            return Response(
                {'error': 'Invalid quantity', 'detail': f'{tx_type} quantity must be negative.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if tx_type == 'TRANSFER':
            if not target_outlet:
                return Response(
                    {'error': 'Missing target_outlet', 'detail': 'Transfers require a target outlet.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if target_outlet.id == outlet.id:
                return Response(
                    {'error': 'Invalid transfer', 'detail': 'Source and target outlets must differ.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if delta >= 0:
                return Response(
                    {'error': 'Invalid quantity', 'detail': 'Transfer source delta must be negative.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        # ---- Source outlet stock update ----
        stock, _ = Stock.objects.select_for_update().get_or_create(
            item=item, outlet=outlet, defaults={'quantity': 0}
        )
        new_qty = stock.quantity + delta
        if new_qty < 0:
            logger.warning(
                'Insufficient stock: item=%s outlet=%s current=%d requested_delta=%d',
                item.sku, outlet.name, stock.quantity, delta,
            )
            return Response(
                {
                    'error': 'Insufficient stock',
                    'detail': f'Available {stock.quantity}, requested delta {delta}.',
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ---- WAC recalculation for purchases ----
        if tx_type == 'PURCHASE':
            current_total = sum(
                s.quantity for s in Stock.objects
                .select_for_update()
                .filter(item=item)
            )
            unit_cost = Decimal(str(serializer.validated_data['value'])) / Decimal(delta) \
                if delta else item.unit_cost
            denom = current_total + delta
            if denom > 0:
                new_wac = (
                    (Decimal(current_total) * item.unit_cost)
                    + (Decimal(delta) * unit_cost)
                ) / Decimal(denom)
                item.unit_cost = new_wac.quantize(Decimal('0.001'))
                item.save(update_fields=['unit_cost'])

        stock.quantity = new_qty
        stock.save()

        # ---- Transfer: update target outlet ----
        if tx_type == 'TRANSFER' and target_outlet:
            target_stock, _ = Stock.objects.select_for_update().get_or_create(
                item=item, outlet=target_outlet, defaults={'quantity': 0},
            )
            target_stock.quantity -= delta  # delta is negative for source
            target_stock.save()
            logger.info(
                'Transfer %s: %s -> %s (%+d units)',
                serializer.validated_data.get('ref', ''),
                outlet.name, target_outlet.name, abs(delta),
            )

        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)

        logger.info(
            'Transaction created: ref=%s type=%s item=%s delta=%+d staff=%s',
            serializer.data.get('ref'), tx_type, item.sku, delta, request.user.username,
        )

        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def destroy(self, request, *args, **kwargs):
        """Transactions are immutable audit records — block deletes for non-managers."""
        if get_user_role(request.user) != ROLE_MANAGER:
            return Response(
                {'detail': 'Only managers may reverse transactions.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().destroy(request, *args, **kwargs)


# ---------------------------------------------------------------------------
# Stock Take
# ---------------------------------------------------------------------------

class StockTakeViewSet(viewsets.ModelViewSet):
    """Physical inventory audit sessions."""
    queryset = (
        StockTakeSession.objects
        .select_related('outlet', 'staff', 'manager')
        .prefetch_related('items__item')
        .all()
        .order_by('-date')
    )
    serializer_class = StockTakeSessionSerializer
    permission_classes = [IsSupervisorOrManager]
    filterset_fields = ['outlet', 'status', 'staff']
    search_fields = ['ref']
    ordering_fields = ['date', 'status']

    def perform_create(self, serializer):
        session = serializer.save(staff=self.request.user)
        # Auto-populate items from current outlet stock state
        items = (
            Item.objects
            .prefetch_related('stocks')
            .all()
        )
        rows = []
        for item in items:
            qty = next(
                (s.quantity for s in item.stocks.all() if s.outlet_id == session.outlet_id),
                0,
            )
            rows.append(StockTakeItem(session=session, item=item, system_qty=qty))
        StockTakeItem.objects.bulk_create(rows)
        return session

    @action(detail=True, methods=['post'], url_path='submit')
    def submit(self, request, pk=None):
        """Move session OPEN -> SUBMITTED."""
        session = self.get_object()
        if session.status != 'OPEN':
            return Response(
                {'detail': f'Cannot submit session in status {session.status}.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        session.status = 'SUBMITTED'
        session.save(update_fields=['status'])
        return Response(self.get_serializer(session).data)

    @db_transaction.atomic
    @action(detail=True, methods=['post'], url_path='approve')
    def approve(self, request, pk=None):
        """Move session SUBMITTED -> CLOSED and create ADJUSTMENT transactions
        for each item with a non-zero variance.
        """
        if get_user_role(request.user) != ROLE_MANAGER:
            return Response(
                {'detail': 'Only managers may approve a stock take.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        session = self.get_object()
        if session.status != 'SUBMITTED':
            return Response(
                {'detail': f'Cannot approve session in status {session.status}.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        for sti in session.items.select_related('item'):
            if sti.physical_qty is None:
                continue
            variance = sti.physical_qty - sti.system_qty
            if variance == 0:
                continue
            stock, _ = Stock.objects.select_for_update().get_or_create(
                item=sti.item, outlet=session.outlet, defaults={'quantity': 0},
            )
            stock.quantity = sti.physical_qty
            stock.save()
            Transaction.objects.create(
                ref=f'ADJ-{session.ref}-{sti.item.sku}',
                type='ADJUSTMENT',
                item=sti.item,
                outlet=session.outlet,
                quantity_delta=variance,
                value=abs(variance) * sti.item.unit_cost,
                staff=request.user,
                reason=sti.reason or 'Stock take adjustment',
                notes=f'Auto-created from stock take {session.ref}',
            )

        session.status = 'CLOSED'
        session.manager = request.user
        session.save(update_fields=['status', 'manager'])
        return Response(self.get_serializer(session).data)


class StockTakeItemViewSet(viewsets.ModelViewSet):
    """Individual count items within a stock take session."""
    queryset = StockTakeItem.objects.select_related('session', 'item').all()
    serializer_class = StockTakeItemSerializer
    permission_classes = [IsSupervisorOrManager]
    filterset_fields = ['session', 'item']


# ---------------------------------------------------------------------------
# Monthly Closing / Snapshots
# ---------------------------------------------------------------------------

class InventorySnapshotViewSet(viewsets.ModelViewSet):
    """
    Immutable monthly inventory snapshots for financial auditing.
    POST creates a sealed record. DELETE is forbidden.
    """
    queryset = (
        InventorySnapshot.objects
        .select_related('closed_by')
        .prefetch_related('items')
        .all()
        .order_by('-month')
    )
    serializer_class = InventorySnapshotSerializer
    permission_classes = [IsManagerOrReadOnly]
    filterset_fields = ['month', 'closed_by']
    search_fields = ['ref', 'month']
    ordering_fields = ['month', 'total_valuation']

    def destroy(self, request, *args, **kwargs):
        return Response(
            {'error': 'Snapshots are immutable audit records and cannot be deleted.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    @db_transaction.atomic
    def create(self, request, *args, **kwargs):
        # If items aren't supplied, build them from current Item/Stock state.
        raw = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data)
        items_data = raw.pop('items', None)
        month = raw.get('month') or datetime.now().strftime('%Y-%m')
        raw['month'] = month
        raw.setdefault('ref', f'SNAP-{month}')
        raw.setdefault('closed_by', request.user.id)

        if InventorySnapshot.objects.filter(month=month).exists():
            return Response(
                {'error': 'Already closed', 'detail': f'Month {month} is already sealed.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not items_data:
            items_data = []
            total_valuation = Decimal('0')
            for item in Item.objects.prefetch_related('stocks__outlet').all():
                total_stock = sum(s.quantity for s in item.stocks.all())
                valuation = (Decimal(total_stock) * item.unit_cost).quantize(Decimal('0.001'))
                total_valuation += valuation
                stocks_json = {s.outlet.name: s.quantity for s in item.stocks.all()}
                items_data.append({
                    'itemId': item.id,
                    'sku': item.sku,
                    'name': item.name,
                    'unitCost': str(item.unit_cost),
                    'totalStock': total_stock,
                    'valuation': str(valuation),
                    'stocks': stocks_json,
                })
            raw.setdefault('total_valuation', str(total_valuation))

        serializer = self.get_serializer(data=raw)
        serializer.is_valid(raise_exception=True)
        snapshot = serializer.save()

        snapshot_items = [
            InventorySnapshotItem(
                snapshot=snapshot,
                item_id=row['itemId'],
                sku=row['sku'],
                name=row['name'],
                unit_cost=row['unitCost'],
                total_stock=row['totalStock'],
                valuation=row['valuation'],
                stocks_json=row['stocks'],
            )
            for row in items_data
        ]
        InventorySnapshotItem.objects.bulk_create(snapshot_items)

        logger.info(
            'Monthly snapshot sealed: month=%s ref=%s items=%d valuation=%s',
            snapshot.month, snapshot.ref, len(snapshot_items), snapshot.total_valuation,
        )
        return Response(self.get_serializer(snapshot).data, status=status.HTTP_201_CREATED)
