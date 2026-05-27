import ast
import json
import re

from django.urls import reverse
from rest_framework import serializers

from .models import Violation


PEDESTRIAN_CONTEXT_LABELS = {
    'human',
    'man',
    'pedestrian',
    'person',
    'walker',
    'walking',
    'woman',
}

VEHICLE_CONTEXT_LABELS = {
    'bicycle',
    'bike',
    'driver',
    'ebike',
    'e_bike',
    'license_plate',
    'moped',
    'motorbike',
    'motorcycle',
    'plate_number',
    'rider',
    'scooter',
    'tricycle',
    'vehicle',
}

DETECTED_OBJECT_COLLECTION_KEYS = {
    'classes',
    'detections',
    'detected_objects',
    'items',
    'labels',
    'objects',
}


def _normalize_detected_label(value):
    if not isinstance(value, str):
        return None

    normalized = re.sub(r'[^a-z0-9]+', '_', value.strip().lower()).strip('_')
    return normalized or None


def _iter_detected_labels(value):
    if value in (None, ''):
        return

    if isinstance(value, str):
        normalized = _normalize_detected_label(value)
        if normalized:
            yield normalized
        return

    if isinstance(value, dict):
        for key in ('class', 'label', 'name', 'type'):
            normalized = _normalize_detected_label(value.get(key))
            if normalized:
                yield normalized

        nested_found = False
        for key in DETECTED_OBJECT_COLLECTION_KEYS:
            if key in value:
                nested_found = True
                yield from _iter_detected_labels(value[key])

        if not nested_found:
            for item in value.values():
                if isinstance(item, (dict, list, tuple, set)):
                    yield from _iter_detected_labels(item)
        return

    if isinstance(value, (list, tuple, set)):
        for item in value:
            yield from _iter_detected_labels(item)


def _has_context_label(labels, keywords):
    return any(keyword in label for label in labels for keyword in keywords)


def _is_pedestrian_only_helmet_event(detected_objects):
    labels = set(_iter_detected_labels(detected_objects))
    if not labels:
        return False

    has_pedestrian = _has_context_label(labels, PEDESTRIAN_CONTEXT_LABELS)
    has_vehicle = _has_context_label(labels, VEHICLE_CONTEXT_LABELS)
    return has_pedestrian and not has_vehicle


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
    evidence_download_url = serializers.SerializerMethodField()
    plate_crop_download_url = serializers.SerializerMethodField()
    has_plate_crop_image = serializers.SerializerMethodField()
    bounding_box = FlexibleJSONField(required=False, allow_null=True)
    detected_objects = FlexibleJSONField(required=False, allow_null=True)

    class Meta:
        model = Violation
        fields = [
            'id', 'id_number', 'camera', 'camera_name', 'camera_location', 'detected_at', 'detection_status',
            'confidence_score', 'classification', 'plate_number',
            'evidence_image', 'evidence_download_url', 'has_evidence_image', 'bounding_box',
            'plate_crop_image', 'plate_crop_download_url', 'has_plate_crop_image',
            'detected_objects', 'processed_at',
            'review_status', 'reviewed_by', 'reviewed_by_name', 'reviewed_by_role', 'reviewed_at',
        ]
        read_only_fields = [
            'id', 'id_number', 'processed_at', 'reviewed_by', 'reviewed_by_name',
            'reviewed_by_role', 'reviewed_at', 'evidence_download_url',
        ]

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

    def get_evidence_download_url(self, obj):
        return self._build_evidence_url(obj, download=True)

    def get_has_plate_crop_image(self, obj):
        return bool(obj.plate_crop_image)

    def get_plate_crop_download_url(self, obj):
        return self._build_evidence_url(obj, download=True, variant='plate')

    def validate(self, attrs):
        attrs = super().validate(attrs)

        classification = attrs.get('classification')
        detected_objects = attrs.get('detected_objects')

        if (
            classification in {'no_helmet', 'nutshell'}
            and detected_objects is not None
            and _is_pedestrian_only_helmet_event(detected_objects)
        ):
            raise serializers.ValidationError(
                {
                    'detected_objects': (
                        'Rejected this helmet violation because the detection payload '
                        'shows a pedestrian without any rider or vehicle context.'
                    )
                }
            )

        return attrs

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['evidence_image'] = self._build_evidence_url(instance)
        data['plate_crop_image'] = self._build_evidence_url(instance, variant='plate')
        return data

    def _build_evidence_url(self, instance, *, download=False, variant='evidence'):
        image_field = instance.plate_crop_image if variant == 'plate' else instance.evidence_image
        if not image_field:
            return None

        evidence_path = reverse('violation-evidence', kwargs={'pk': instance.pk})
        query_params = []
        if variant == 'plate':
            query_params.append('variant=plate')
        if download:
            query_params.append('download=1')
        if query_params:
            evidence_path = f"{evidence_path}?{'&'.join(query_params)}"

        request = self.context.get('request')
        return request.build_absolute_uri(evidence_path) if request is not None else evidence_path


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
    reviewed_violations = serializers.IntegerField()
    resolved_violations = serializers.IntegerField()
    today_violations = serializers.IntegerField()
    this_week_violations = serializers.IntegerField()
    by_class = ViolationSummaryClassSerializer(many=True)
    by_camera = ViolationSummaryCameraSerializer(many=True)


class ViolationWeeklyChartSerializer(serializers.Serializer):
    date = serializers.DateField()
    count = serializers.IntegerField()
