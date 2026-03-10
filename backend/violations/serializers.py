from rest_framework import serializers
from .models import Violation


class ViolationSerializer(serializers.ModelSerializer):
    camera_name = serializers.CharField(source='camera.name', read_only=True)
    reviewed_by_name = serializers.SerializerMethodField()
    reviewed_by_role = serializers.SerializerMethodField()

    class Meta:
        model = Violation
        fields = [
            'id', 'camera', 'camera_name', 'detected_at', 'detection_status',
            'confidence_score', 'classification', 'plate_number',
            'evidence_image', 'bounding_box', 'detected_objects', 'processed_at',
            'review_status', 'reviewed_by', 'reviewed_by_name', 'reviewed_by_role', 'reviewed_at',
        ]
        read_only_fields = ['id', 'processed_at', 'reviewed_by', 'reviewed_by_name', 'reviewed_by_role', 'reviewed_at']

    def get_reviewed_by_name(self, obj):
        if obj.reviewed_by:
            user = obj.reviewed_by
            full_name = f"{user.first_name} {user.last_name}".strip()
            return full_name or user.username
        return None

    def get_reviewed_by_role(self, obj):
        if obj.reviewed_by:
            if hasattr(obj.reviewed_by, 'profile'):
                return obj.reviewed_by.profile.get_role_display()
            # Fallback: check if user is superuser/staff
            if obj.reviewed_by.is_superuser or obj.reviewed_by.is_staff:
                return 'Administrator'
        return None