import ast
import json

from django.urls import reverse
from rest_framework import serializers

from .models import Violation


class FlexibleJSONField(serializers.JSONField):
    def to_internal_value(self, data):
        if data in (None, ''):
            return None

        if isinstance(data, str):
            raw = data.strip()
            if not raw:
                return None

            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                try:
                    data = ast.literal_eval(raw)
                except (ValueError, SyntaxError):
                    self.fail('invalid')

        return super().to_internal_value(data)


class ViolationSerializer(serializers.ModelSerializer):
    camera_name = serializers.CharField(source='camera.name', read_only=True)
    camera_location = serializers.CharField(source='camera.location', read_only=True)
    reviewed_by_name = serializers.SerializerMethodField()
    reviewed_by_role = serializers.SerializerMethodField()
    id_number = serializers.SerializerMethodField()
    has_evidence_image = serializers.SerializerMethodField()
    bounding_box = FlexibleJSONField(required=False, allow_null=True)
    detected_objects = FlexibleJSONField(required=False, allow_null=True)

    class Meta:
        model = Violation
        fields = [
            'id', 'id_number', 'camera', 'camera_name', 'camera_location', 'detected_at', 'detection_status',
            'confidence_score', 'classification', 'plate_number',
            'evidence_image', 'has_evidence_image', 'bounding_box', 'detected_objects', 'processed_at',
            'review_status', 'reviewed_by', 'reviewed_by_name', 'reviewed_by_role', 'reviewed_at',
        ]
        read_only_fields = ['id', 'id_number', 'processed_at', 'reviewed_by', 'reviewed_by_name', 'reviewed_by_role', 'reviewed_at']

    def get_id_number(self, obj):
        # Generates ID in format YYYY-XXX
        if obj.detected_at:
            return f"{obj.detected_at.year}-{obj.id:03d}"
        return f"0000-{obj.id:03d}"

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

    def get_has_evidence_image(self, obj):
        return bool(obj.evidence_image)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get('request')

        if instance.evidence_image:
            evidence_path = reverse('violation-evidence', kwargs={'pk': instance.pk})
            data['evidence_image'] = (
                request.build_absolute_uri(evidence_path)
                if request is not None
                else evidence_path
            )
        else:
            data['evidence_image'] = None

        return data


class ViolationSummaryClassSerializer(serializers.Serializer):
    classification = serializers.CharField()
    label = serializers.CharField()
    count = serializers.IntegerField()


class ViolationSummaryCameraSerializer(serializers.Serializer):
    camera_name = serializers.CharField()
    count = serializers.IntegerField()


class ViolationSummarySerializer(serializers.Serializer):
    total_violations = serializers.IntegerField()
    pending_violations = serializers.IntegerField()
    today_violations = serializers.IntegerField()
    this_week_violations = serializers.IntegerField()
    by_class = ViolationSummaryClassSerializer(many=True)
    by_camera = ViolationSummaryCameraSerializer(many=True)


class ViolationWeeklyChartSerializer(serializers.Serializer):
    date = serializers.DateField()
    count = serializers.IntegerField()
