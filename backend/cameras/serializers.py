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
    # Write-only fields for the Add/Edit Camera form.
    # These are consumed to build rtsp_url and never stored directly on the model.
    camera_ip = serializers.CharField(write_only=True, required=False)
    rtsp_username = serializers.CharField(write_only=True, required=False)
    rtsp_password = serializers.CharField(write_only=True, required=False)
    stream_quality = serializers.ChoiceField(
        choices=[
            ('stream1', 'Wide HQ'),
            ('stream2', 'Wide LQ'),
            ('stream6', 'Tele HQ'),
            ('stream7', 'Tele LQ'),
        ],
        write_only=True,
        required=False,
    )

    class Meta:
        model = Camera
        fields = '__all__'

    def create(self, validated_data):
        # Pop write-only fields so they don't hit the model
        camera_ip = validated_data.pop('camera_ip', None)
        rtsp_username = validated_data.pop('rtsp_username', None)
        rtsp_password = validated_data.pop('rtsp_password', None)
        stream_quality = validated_data.pop('stream_quality', None)

        if all([camera_ip, rtsp_username, rtsp_password, stream_quality]):
            # Build the full RTSP URL and store in the dedicated rtsp_url field
            validated_data['rtsp_url'] = (
                f"rtsp://{rtsp_username}:{rtsp_password}@{camera_ip}:554/{stream_quality}"
            )
            # Map stream_quality to lens fields so Django admin reflects the correct lens
            validated_data['active_lens'] = 'tele' if stream_quality in ('stream6', 'stream7') else 'wide'
            validated_data['preferred_lens'] = 'tele' if stream_quality in ('stream6', 'stream7') else 'wide'

        validated_data.setdefault('status', 'inactive')
        validated_data.setdefault('last_seen_at', None)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        rtsp_password = validated_data.pop('rtsp_password', None)
        camera_ip = validated_data.pop('camera_ip', None)
        rtsp_username = validated_data.pop('rtsp_username', None)
        stream_quality = validated_data.pop('stream_quality', None)

        if rtsp_password and camera_ip and rtsp_username and stream_quality:
            validated_data['rtsp_url'] = (
                f"rtsp://{rtsp_username}:{rtsp_password}@{camera_ip}:554/{stream_quality}"
            )
            # Keep lens fields in sync when the user changes stream quality
            validated_data['active_lens'] = 'tele' if stream_quality in ('stream6', 'stream7') else 'wide'
            validated_data['preferred_lens'] = 'tele' if stream_quality in ('stream6', 'stream7') else 'wide'

        return super().update(instance, validated_data)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['status'] = instance.get_runtime_status()
        data['is_live'] = instance.is_live()
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if not has_any_user_permission(user, ("can_view_cameras", "can_manage_cameras", "can_view_live_monitor")):
            data['stream_url'] = ''
        return data
