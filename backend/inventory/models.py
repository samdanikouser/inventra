from django.db import models
from django.contrib.auth.models import User


class Category(models.Model):
    name = models.CharField(max_length=100, unique=True)

    class Meta:
        verbose_name_plural = 'categories'
        ordering = ['name']

    def __str__(self):
        return self.name


class Outlet(models.Model):
    name = models.CharField(max_length=100, unique=True)
    location = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class Supplier(models.Model):
    name = models.CharField(max_length=255)
    contact = models.CharField(max_length=100)
    email = models.EmailField()
    lead_time_days = models.IntegerField(default=7)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class Item(models.Model):
    sku = models.CharField(max_length=50, unique=True, db_index=True)
    name = models.CharField(max_length=255)
    category = models.ForeignKey(Category, on_delete=models.CASCADE, related_name='items')
    unit = models.CharField(max_length=20, default='pcs')
    min_stock = models.IntegerField(default=0)
    par_level = models.IntegerField(default=0)
    unit_cost = models.DecimalField(max_digits=12, decimal_places=3, default=0.000)  # WAC
    photo = models.ImageField(upload_to='items/', blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['sku']

    def __str__(self):
        return f"{self.sku} - {self.name}"


class Stock(models.Model):
    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name='stocks')
    outlet = models.ForeignKey(Outlet, on_delete=models.CASCADE, related_name='stocks')
    quantity = models.IntegerField(default=0)

    class Meta:
        unique_together = ('item', 'outlet')
        verbose_name_plural = 'stocks'

    def __str__(self):
        return f"{self.item.sku} @ {self.outlet.name}: {self.quantity}"


class Transaction(models.Model):
    TYPES = (
        ('PURCHASE', 'Purchase'),
        ('BREAKAGE', 'Breakage'),
        ('WRITE_OFF', 'Write-off'),
        ('TRANSFER', 'Transfer'),
        ('ADJUSTMENT', 'Adjustment'),
    )

    ref = models.CharField(max_length=50, unique=True, db_index=True)
    type = models.CharField(max_length=20, choices=TYPES, db_index=True)
    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name='transactions')
    outlet = models.ForeignKey(Outlet, on_delete=models.CASCADE, related_name='transactions')
    target_outlet = models.ForeignKey(
        Outlet, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='target_transactions',
    )
    quantity_delta = models.IntegerField()
    value = models.DecimalField(max_digits=12, decimal_places=3)
    date = models.DateTimeField(auto_now_add=True, db_index=True)
    staff = models.ForeignKey(User, on_delete=models.CASCADE, related_name='transactions')
    notes = models.TextField(blank=True)
    reason = models.CharField(max_length=255, blank=True)
    supplier = models.ForeignKey(
        Supplier, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='transactions',
    )

    class Meta:
        ordering = ['-date']

    def __str__(self):
        return f"{self.ref} ({self.type})"


class StockTakeSession(models.Model):
    STATUS = (
        ('OPEN', 'Open'),
        ('SUBMITTED', 'Submitted'),
        ('CLOSED', 'Closed'),
    )

    ref = models.CharField(max_length=50, unique=True, db_index=True)
    date = models.DateTimeField(auto_now_add=True)
    outlet = models.ForeignKey(Outlet, on_delete=models.CASCADE, related_name='stock_take_sessions')
    status = models.CharField(max_length=20, choices=STATUS, default='OPEN', db_index=True)
    staff = models.ForeignKey(User, on_delete=models.CASCADE, related_name='stock_take_sessions')
    manager = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='managed_sessions',
    )

    class Meta:
        ordering = ['-date']

    def __str__(self):
        return f"{self.ref} ({self.status})"


class StockTakeItem(models.Model):
    session = models.ForeignKey(StockTakeSession, on_delete=models.CASCADE, related_name='items')
    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name='stock_take_items')
    system_qty = models.IntegerField()
    physical_qty = models.IntegerField(null=True, blank=True)
    variance = models.IntegerField(null=True, blank=True)
    reason = models.CharField(max_length=255, blank=True)

    class Meta:
        verbose_name = 'stock take item'

    def __str__(self):
        return f"{self.item.sku} in {self.session.ref}"


class InventorySnapshot(models.Model):
    ref = models.CharField(max_length=50, unique=True, db_index=True)
    month = models.CharField(max_length=7, db_index=True)  # YYYY-MM
    closed_at = models.DateTimeField(auto_now_add=True)
    closed_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='snapshots')
    total_valuation = models.DecimalField(max_digits=15, decimal_places=3)

    class Meta:
        ordering = ['-month']
        verbose_name = 'inventory snapshot'

    def __str__(self):
        return f"Snapshot {self.month} ({self.ref})"


class InventorySnapshotItem(models.Model):
    snapshot = models.ForeignKey(InventorySnapshot, on_delete=models.CASCADE, related_name='items')
    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name='snapshot_items')
    sku = models.CharField(max_length=50)
    name = models.CharField(max_length=255)
    unit_cost = models.DecimalField(max_digits=12, decimal_places=3)
    total_stock = models.IntegerField()
    valuation = models.DecimalField(max_digits=15, decimal_places=3)
    stocks_json = models.JSONField()  # Per-outlet stock quantities

    class Meta:
        verbose_name = 'snapshot item'

    def __str__(self):
        return f"{self.sku} in {self.snapshot.ref}"
