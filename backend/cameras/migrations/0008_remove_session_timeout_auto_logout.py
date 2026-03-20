from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('cameras', '0007_systemsettings_conf_license_plate'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='systemsettings',
            name='auto_logout',
        ),
        migrations.RemoveField(
            model_name='systemsettings',
            name='session_timeout',
        ),
    ]
