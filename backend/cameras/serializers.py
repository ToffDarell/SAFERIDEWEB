from rest_framework import serializers
from .models import Camera, SystemSettings
from users.permissions import has_any_user_permission


class SystemSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = SystemSettings
        fields = [
            'password_min_length',
            'confidence_threshold',
            'send_cooldown_seconds',
            'data_retention_days',
            'conf_no_helmet',
            'conf_nutshell',
            'conf_helmet',
            'conf_license_plate',
            'ocr_confidence',
            'notify_on_new_detection',
            'notify_on_operator_activity',
            'notify_on_camera_offline',
            'database_backup_enabled',
            'database_backup_frequency_hours',
            'database_backup_retention_days',
        ]


class CameraSerializer(serializers.ModelSerializer):
    class Meta:
        model = Camera
        fields = '__all__'

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['status'] = instance.get_runtime_status()
        data['is_live'] = instance.is_live()
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if not has_any_user_permission(user, ("can_view_cameras", "can_view_live_monitor")):
            data['stream_url'] = ''
        return data
