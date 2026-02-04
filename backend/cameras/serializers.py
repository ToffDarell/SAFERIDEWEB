from rest_framework import serializers
from .models import Camera


class CameraSerializer(serializers.ModelSerializer):
    class Meta:
        model = Camera
        fields = ['id', 'name', 'location', 'stream_url', 'status', 'last_seen_at', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']