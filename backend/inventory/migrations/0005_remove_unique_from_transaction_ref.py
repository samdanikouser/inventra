from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0004_alter_category_options_and_more'),
    ]

    operations = [
        migrations.AlterField(
            model_name='transaction',
            name='ref',
            field=models.CharField(db_index=True, max_length=50),
        ),
    ]
