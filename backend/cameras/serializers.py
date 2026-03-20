from rest_framework import serializers
from .models import Camera, SystemSettings


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
        ]


class CameraSerializer(serializers.ModelSerializer):
    class Meta:
        model = Camera
        fields = '__all__'