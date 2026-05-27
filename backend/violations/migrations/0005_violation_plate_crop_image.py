from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('violations', '0004_update_violation_classification_choices'),
    ]

    operations = [
        migrations.AddField(
            model_name='violation',
            name='plate_crop_image',
            field=models.ImageField(blank=True, upload_to='violations/%Y/%m/%d/plate_crops/'),
        ),
    ]
