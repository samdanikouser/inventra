import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'inventra_api.settings')
django.setup()

from inventory.models import Category, Outlet, Item, Stock, Supplier
from django.contrib.auth.models import User

def seed_data():
    # Create Superuser
    if not User.objects.filter(username='admin').exists():
        User.objects.create_superuser('admin', 'admin@example.com', 'admin123')
        print("Created superuser 'admin' with password 'admin123'")

    # Create Categories
    categories = ['Crockery', 'Glassware', 'Buffetware', 'Kitchen Smallware', 'Operating Equipment', 'Barware', 'Tableware']
    for cat_name in categories:
        Category.objects.get_or_create(name=cat_name)
    print(f"Created {len(categories)} categories")

    # Create Outlets
    outlets = ['Main Kitchen', 'Lobby Bar', 'Rooftop Lounge', 'Banquet Hall']
    for outlet_name in outlets:
        Outlet.objects.get_or_create(name=outlet_name)
    print(f"Created {len(outlets)} outlets")

    # Create Suppliers
    suppliers = [
        {'name': 'Global Glassware Ltd', 'contact': '+1 234 567 890', 'email': 'sales@globalglass.com'},
        {'name': 'Premium Ceramics', 'contact': '+1 987 654 321', 'email': 'orders@premiumceramics.com'},
        {'name': 'Buffet Pros', 'contact': '+1 555 123 456', 'email': 'support@buffetpros.com'},
    ]
    for s_data in suppliers:
        Supplier.objects.get_or_create(name=s_data['name'], defaults=s_data)
    print(f"Created {len(suppliers)} suppliers")

    # Create some items
    items_data = [
        {'sku': 'KSP-GLS-001', 'name': 'Wine Glass (Red)', 'category': 'Glassware', 'unit_cost': 2.500},
        {'sku': 'KSP-GLS-002', 'name': 'Martini Glass (Crystal)', 'category': 'Glassware', 'unit_cost': 4.200},
        {'sku': 'KSP-PLT-001', 'name': 'Dinner Plate 12"', 'category': 'Crockery', 'unit_cost': 5.750},
    ]

    for data in items_data:
        cat = Category.objects.get(name=data['category'])
        item, created = Item.objects.get_or_create(
            sku=data['sku'],
            defaults={'name': data['name'], 'category': cat, 'unit_cost': data['unit_cost']}
        )
        
        # Add stock for each outlet
        for outlet in Outlet.objects.all():
            Stock.objects.get_or_create(item=item, outlet=outlet, defaults={'quantity': 50})
    
    print("Created items and initial stock")

if __name__ == '__main__':
    seed_data()
