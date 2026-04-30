from django.contrib import admin
from .models import (
    Category, Outlet, Item, Stock, Transaction,
    StockTakeSession, StockTakeItem, Supplier,
    InventorySnapshot, InventorySnapshotItem,
)


# ---------------------------------------------------------------------------
# Master Data
# ---------------------------------------------------------------------------

@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('id', 'name')
    search_fields = ('name',)


@admin.register(Outlet)
class OutletAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'location')
    search_fields = ('name', 'location')


@admin.register(Supplier)
class SupplierAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'contact', 'email', 'lead_time_days')
    search_fields = ('name', 'email')
    list_filter = ('lead_time_days',)


# ---------------------------------------------------------------------------
# Inventory
# ---------------------------------------------------------------------------

class StockInline(admin.TabularInline):
    model = Stock
    extra = 0
    readonly_fields = ('quantity',)


@admin.register(Item)
class ItemAdmin(admin.ModelAdmin):
    list_display = ('sku', 'name', 'category', 'unit', 'unit_cost', 'min_stock', 'par_level')
    search_fields = ('sku', 'name')
    list_filter = ('category', 'unit')
    list_editable = ('min_stock', 'par_level')
    inlines = [StockInline]


@admin.register(Stock)
class StockAdmin(admin.ModelAdmin):
    list_display = ('item', 'outlet', 'quantity')
    list_filter = ('outlet',)
    search_fields = ('item__sku', 'item__name')
    list_select_related = ('item', 'outlet')


# ---------------------------------------------------------------------------
# Transactions
# ---------------------------------------------------------------------------

@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ('ref', 'type', 'item', 'outlet', 'quantity_delta', 'value', 'date', 'staff')
    list_filter = ('type', 'outlet', 'date')
    search_fields = ('ref', 'item__name', 'item__sku')
    list_select_related = ('item', 'outlet', 'staff', 'supplier')
    date_hierarchy = 'date'
    readonly_fields = ('date',)


# ---------------------------------------------------------------------------
# Stock Take
# ---------------------------------------------------------------------------

class StockTakeItemInline(admin.TabularInline):
    model = StockTakeItem
    extra = 0
    readonly_fields = ('system_qty', 'variance')


@admin.register(StockTakeSession)
class StockTakeSessionAdmin(admin.ModelAdmin):
    list_display = ('ref', 'date', 'outlet', 'status', 'staff', 'manager')
    list_filter = ('status', 'outlet', 'date')
    search_fields = ('ref',)
    list_select_related = ('outlet', 'staff', 'manager')
    inlines = [StockTakeItemInline]
    date_hierarchy = 'date'
    readonly_fields = ('date',)


@admin.register(StockTakeItem)
class StockTakeItemAdmin(admin.ModelAdmin):
    list_display = ('session', 'item', 'system_qty', 'physical_qty', 'variance', 'reason')
    list_filter = ('session__status',)
    search_fields = ('item__sku', 'item__name')
    list_select_related = ('session', 'item')


# ---------------------------------------------------------------------------
# Monthly Closing / Snapshots
# ---------------------------------------------------------------------------

class InventorySnapshotItemInline(admin.TabularInline):
    model = InventorySnapshotItem
    extra = 0
    readonly_fields = ('item', 'sku', 'name', 'unit_cost', 'total_stock', 'valuation')


@admin.register(InventorySnapshot)
class InventorySnapshotAdmin(admin.ModelAdmin):
    list_display = ('ref', 'month', 'total_valuation', 'closed_at', 'closed_by')
    list_filter = ('month',)
    search_fields = ('ref', 'month')
    list_select_related = ('closed_by',)
    readonly_fields = ('ref', 'month', 'total_valuation', 'closed_at', 'closed_by')
    inlines = [InventorySnapshotItemInline]
    date_hierarchy = 'closed_at'

    def has_add_permission(self, request):
        """Snapshots must be created through the API, not admin."""
        return False

    def has_delete_permission(self, request, obj=None):
        """Snapshots are immutable audit records — never delete."""
        return False


@admin.register(InventorySnapshotItem)
class InventorySnapshotItemAdmin(admin.ModelAdmin):
    list_display = ('snapshot', 'sku', 'name', 'total_stock', 'unit_cost', 'valuation')
    list_filter = ('snapshot__month',)
    search_fields = ('sku', 'name')
    list_select_related = ('snapshot', 'item')
    readonly_fields = ('snapshot', 'item', 'sku', 'name', 'unit_cost', 'total_stock', 'valuation', 'stocks_json')
