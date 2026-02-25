from rest_framework import serializers
from .models import Camera, SystemSettings


class SystemSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = SystemSettings
        fields = [
            'auto_logout',
            'session_timeout',
            'password_min_length',
            'confidence_threshold',
            'send_cooldown_seconds',
            'data_retention_days',
            'ocr_confidence',
        ]


class CameraSerializer(serializers.ModelSerializer):
    class Meta:
        model = Camera
        fields = '__all__'