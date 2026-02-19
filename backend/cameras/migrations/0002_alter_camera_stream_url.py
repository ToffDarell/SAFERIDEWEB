from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies = [('cameras', '0001_initial')]
    operations = [
        migrations.AlterField(
            model_name='camera',
            name='stream_url',
            field=models.CharField(max_length=500, blank=True),
        ),
    ]