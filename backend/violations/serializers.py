from rest_framework import serializers
from .models import Violation


class ViolationSerializer(serializers.ModelSerializer):
    camera_name = serializers.CharField(source='camera.name', read_only=True)
    
    class Meta:
        model = Violation
        fields = [
            'id', 'camera', 'camera_name', 'detected_at', 'detection_status',
            'confidence_score', 'classification', 'plate_number',
            'evidence_image', 'bounding_box', 'detected_objects', 'processed_at'
        ]
        read_only_fields = ['id', 'processed_at']