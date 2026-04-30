from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CategoryViewSet, OutletViewSet, ItemViewSet,
    TransactionViewSet, StockTakeViewSet, SupplierViewSet,
    StockTakeItemViewSet, InventorySnapshotViewSet, StockViewSet,
    UserViewSet, me_view, health_view,
)

router = DefaultRouter()
router.register(r'categories', CategoryViewSet)
router.register(r'outlets', OutletViewSet)
router.register(r'suppliers', SupplierViewSet)
router.register(r'items', ItemViewSet)
router.register(r'stocks', StockViewSet)
router.register(r'transactions', TransactionViewSet)
router.register(r'stock-takes', StockTakeViewSet)
router.register(r'stock-take-items', StockTakeItemViewSet)
router.register(r'snapshots', InventorySnapshotViewSet)
router.register(r'users', UserViewSet)

urlpatterns = [
    path('health/', health_view, name='health'),
    path('me/', me_view, name='me'),
    path('', include(router.urls)),
]
