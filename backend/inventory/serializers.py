from rest_framework import serializers
from django.contrib.auth.models import User
from .models import (
    Category, Outlet, Item, Stock, Transaction,
    StockTakeSession, StockTakeItem, Supplier,
    InventorySnapshot, InventorySnapshotItem,
)


class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ('id', 'username', 'first_name', 'last_name', 'email', 'full_name')

    def get_full_name(self, obj):
        name = (f"{obj.first_name} {obj.last_name}").strip()
        return name or obj.username


class MeSerializer(serializers.ModelSerializer):
    """Current user profile + role + permissions for the frontend AuthProvider."""
    full_name = serializers.SerializerMethodField()
    role = serializers.SerializerMethodField()
    is_manager = serializers.SerializerMethodField()
    is_supervisor = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            'id', 'username', 'first_name', 'last_name', 'email',
            'full_name', 'role', 'is_manager', 'is_supervisor',
        )

    def get_full_name(self, obj):
        name = (f"{obj.first_name} {obj.last_name}").strip()
        return name or obj.username

    def get_role(self, obj):
        from .permissions import get_user_role
        return get_user_role(obj)

    def get_is_manager(self, obj):
        from .permissions import get_user_role, ROLE_MANAGER
        return get_user_role(obj) == ROLE_MANAGER

    def get_is_supervisor(self, obj):
        from .permissions import get_user_role, ROLE_SUPERVISOR, ROLE_MANAGER
        return get_user_role(obj) in (ROLE_SUPERVISOR, ROLE_MANAGER)


# ---------------------------------------------------------------------------
# Master Data
# ---------------------------------------------------------------------------

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = '__all__'


class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = '__all__'


class OutletSerializer(serializers.ModelSerializer):
    class Meta:
        model = Outlet
        fields = '__all__'


# ---------------------------------------------------------------------------
# Inventory
# ---------------------------------------------------------------------------

class StockSerializer(serializers.ModelSerializer):
    outlet_name = serializers.ReadOnlyField(source='outlet.name')
    item_name = serializers.ReadOnlyField(source='item.name')
    item_sku = serializers.ReadOnlyField(source='item.sku')

    class Meta:
        model = Stock
        fields = ('id', 'item', 'item_name', 'item_sku', 'outlet', 'outlet_name', 'quantity')
        read_only_fields = ('id',)


class ItemSerializer(serializers.ModelSerializer):
    category_name = serializers.ReadOnlyField(source='category.name')
    stocks = StockSerializer(many=True, read_only=True)
    total_stock = serializers.SerializerMethodField()

    class Meta:
        model = Item
        fields = '__all__'

    def get_total_stock(self, obj):
        """Aggregate stock quantity across all outlets."""
        return sum(s.quantity for s in obj.stocks.all())


# ---------------------------------------------------------------------------
# Transactions
# ---------------------------------------------------------------------------

class TransactionSerializer(serializers.ModelSerializer):
    item_name = serializers.ReadOnlyField(source='item.name')
    item_sku = serializers.ReadOnlyField(source='item.sku')
    staff_name = serializers.SerializerMethodField()
    supplier_name = serializers.ReadOnlyField(source='supplier.name')
    outlet_name = serializers.ReadOnlyField(source='outlet.name')
    target_outlet_name = serializers.ReadOnlyField(source='target_outlet.name')

    class Meta:
        model = Transaction
        fields = '__all__'

    def get_staff_name(self, obj):
        if not obj.staff:
            return ''
        full = (f"{obj.staff.first_name} {obj.staff.last_name}").strip()
        return full or obj.staff.username


# ---------------------------------------------------------------------------
# Stock Take
# ---------------------------------------------------------------------------

class StockTakeItemSerializer(serializers.ModelSerializer):
    item_name = serializers.ReadOnlyField(source='item.name')
    sku = serializers.ReadOnlyField(source='item.sku')

    class Meta:
        model = StockTakeItem
        fields = '__all__'


class StockTakeSessionSerializer(serializers.ModelSerializer):
    items = StockTakeItemSerializer(many=True, read_only=True)
    outlet_name = serializers.ReadOnlyField(source='outlet.name')
    staff_name = serializers.ReadOnlyField(source='staff.username')
    manager_name = serializers.ReadOnlyField(source='manager.username')

    class Meta:
        model = StockTakeSession
        fields = '__all__'
        read_only_fields = ('date',)


# ---------------------------------------------------------------------------
# Monthly Closing / Snapshots
# ---------------------------------------------------------------------------

class InventorySnapshotItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = InventorySnapshotItem
        fields = '__all__'
        read_only_fields = ('id',)


class InventorySnapshotSerializer(serializers.ModelSerializer):
    items = InventorySnapshotItemSerializer(many=True, read_only=True)
    closed_by_name = serializers.ReadOnlyField(source='closed_by.username')
    item_count = serializers.SerializerMethodField()

    class Meta:
        model = InventorySnapshot
        fields = '__all__'
        read_only_fields = ('closed_at',)

    def get_item_count(self, obj):
        return obj.items.count()
