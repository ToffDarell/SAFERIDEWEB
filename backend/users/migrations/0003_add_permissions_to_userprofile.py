from django.db import migrations, models


DEFAULT_OPERATOR_PERMISSIONS = {
    "can_view_violations": True,
    "can_update_violation_status": True,
    "can_view_live_monitor": True,
    "can_view_reports": True,
    "can_export_reports": False,
    "can_view_cameras": True,
}


def populate_operator_permissions(apps, schema_editor):
    UserProfile = apps.get_model("users", "UserProfile")
    for profile in UserProfile.objects.all():
        if profile.role == "tmc_operator":
            permissions = DEFAULT_OPERATOR_PERMISSIONS.copy()
            if isinstance(profile.permissions, dict):
                for key in DEFAULT_OPERATOR_PERMISSIONS:
                    if key in profile.permissions:
                        permissions[key] = bool(profile.permissions[key])
            profile.permissions = permissions
        elif profile.permissions is None:
            profile.permissions = {}
        profile.save(update_fields=["permissions"])


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0002_adminnotification"),
    ]

    operations = [
        migrations.AddField(
            model_name="userprofile",
            name="permissions",
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.RunPython(populate_operator_permissions, migrations.RunPython.noop),
    ]
