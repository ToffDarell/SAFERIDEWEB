from django.db import models
from django.contrib.auth.models import User


DEFAULT_OPERATOR_PERMISSIONS = {
    "can_view_violations": True,
    "can_update_violation_status": True,
    "can_view_live_monitor": True,
    "can_view_reports": True,
    "can_export_reports": False,
    "can_view_cameras": True,
}

DEFAULT_DISPLAY_PREFERENCES = {
    "theme": "system",
    "items_per_page": 10,
    "compact_mode": False,
}


def get_default_operator_permissions():
    return DEFAULT_OPERATOR_PERMISSIONS.copy()


def get_default_display_preferences():
    return DEFAULT_DISPLAY_PREFERENCES.copy()


def normalize_operator_permissions(value):
    normalized = get_default_operator_permissions()
    if isinstance(value, dict):
        for key in DEFAULT_OPERATOR_PERMISSIONS:
            if key in value:
                normalized[key] = bool(value[key])
    return normalized


def normalize_display_preferences(value):
    normalized = get_default_display_preferences()
    if isinstance(value, dict):
        if value.get("theme") in {"light", "dark", "system"}:
            normalized["theme"] = value["theme"]
        if "items_per_page" in value:
            try:
                items_per_page = int(value["items_per_page"])
                if 5 <= items_per_page <= 100:
                    normalized["items_per_page"] = items_per_page
            except (TypeError, ValueError):
                pass
        if "compact_mode" in value:
            normalized["compact_mode"] = bool(value["compact_mode"])
    return normalized


class UserProfile(models.Model):
    ROLE_CHOICES = [
        ('admin', 'Administrator'),
        ('tmc_operator', 'TMC Operator'),
    ]
    
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]
    
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='tmc_operator')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    phone = models.CharField(max_length=20, blank=True)
    organization = models.CharField(max_length=200, blank=True)
    permissions = models.JSONField(default=dict, blank=True)
    display_preferences = models.JSONField(default=get_default_display_preferences, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_users')
    
    class Meta:
        db_table = 'user_profiles'

    def save(self, *args, **kwargs):
        if self.role == 'tmc_operator':
            self.permissions = normalize_operator_permissions(self.permissions)
        elif self.permissions is None:
            self.permissions = {}

        self.display_preferences = normalize_display_preferences(self.display_preferences)
        super().save(*args, **kwargs)

    def get_effective_permissions(self):
        if self.role != 'tmc_operator':
            return {}
        return normalize_operator_permissions(self.permissions)

    def get_display_preferences(self):
        return normalize_display_preferences(self.display_preferences)
    
    def __str__(self):
        return f"{self.user.username} - {self.role} ({self.status})"


class AdminNotification(models.Model):
    NOTIFICATION_TYPE_CHOICES = [
        ('new_detection', 'New Detection'),
        ('violation_action', 'Violation Action'),
        ('evidence_view', 'Evidence View'),
        ('plate_search', 'Plate Search'),
        ('report_export', 'Report Export'),
    ]

    actor = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='admin_notifications_sent',
    )
    violation = models.ForeignKey(
        'violations.Violation',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='admin_notifications',
    )
    notification_type = models.CharField(
        max_length=50,
        choices=NOTIFICATION_TYPE_CHOICES,
        default='violation_action',
    )
    title = models.CharField(max_length=255)
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'admin_notifications'
        ordering = ['-created_at']

    def __str__(self):
        return self.title

    @classmethod
    def get_alert_notification_types(cls):
        return ['new_detection', 'violation_action']

    @classmethod
    def get_activity_notification_types(cls):
        return [choice[0] for choice in cls.NOTIFICATION_TYPE_CHOICES]

    @classmethod
    def create_for_violation_action(cls, *, actor, violation, previous_status, new_status):
        role = UserProfile.objects.filter(user=actor).values_list('role', flat=True).first()
        if role != 'tmc_operator':
            return None

        actor_name = actor.get_full_name().strip() or actor.username
        plate_number = violation.plate_number or 'Unknown plate'

        return cls.objects.create(
            actor=actor,
            violation=violation,
            notification_type='violation_action',
            title='Operator updated a violation action',
            message=(
                f"{actor_name} changed violation #{violation.id} "
                f"({plate_number}) from {previous_status} to {new_status}."
            ),
        )

    @classmethod
    def create_for_evidence_view(cls, *, actor, violation):
        if not actor or not actor.is_authenticated:
            return None

        actor_name = actor.get_full_name().strip() or actor.username
        plate_number = violation.plate_number or 'Unknown plate'

        return cls.objects.create(
            actor=actor,
            violation=violation,
            notification_type='evidence_view',
            title='Evidence image viewed',
            message=(
                f"{actor_name} viewed the evidence image for violation #{violation.id} "
                f"({plate_number})."
            ),
        )

    @classmethod
    def create_for_plate_search(cls, *, actor, search_term):
        if not actor or not actor.is_authenticated:
            return None

        actor_name = actor.get_full_name().strip() or actor.username
        normalized_search = (search_term or '').strip()
        if not normalized_search:
            return None

        return cls.objects.create(
            actor=actor,
            notification_type='plate_search',
            title='Plate number searched',
            message=f'{actor_name} searched plate records using "{normalized_search}".',
        )

    @classmethod
    def create_for_report_export(cls, *, actor, export_format, record_count):
        if not actor or not actor.is_authenticated:
            return None

        actor_name = actor.get_full_name().strip() or actor.username
        normalized_format = (export_format or 'xlsx').upper()

        return cls.objects.create(
            actor=actor,
            notification_type='report_export',
            title='Violation report exported',
            message=(
                f"{actor_name} exported a {normalized_format} violation report "
                f"containing {record_count} record(s)."
            ),
        )

    @classmethod
    def create_for_new_detection(cls, *, violation):
        camera_name = violation.camera.name if violation.camera else 'Unknown camera'
        plate_number = violation.plate_number or 'Unknown plate'
        classification = violation.get_classification_display()

        return cls.objects.create(
            violation=violation,
            notification_type='new_detection',
            title='New detection received',
            message=(
                f"New {classification.lower()} detection recorded from {camera_name} "
                f"for violation #{violation.id} ({plate_number})."
            ),
        )


class UserNotification(models.Model):
    NOTIFICATION_TYPE_CHOICES = [
        ('admin_update', 'Admin Update'),
        ('new_detection', 'New Detection'),
        ('system_alert', 'System Alert'),
    ]

    sender = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='user_notifications_sent',
    )
    recipient = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='user_notifications',
    )
    notification_type = models.CharField(
        max_length=50,
        choices=NOTIFICATION_TYPE_CHOICES,
        default='admin_update',
    )
    title = models.CharField(max_length=255)
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'user_notifications'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.recipient.username}: {self.title}"

    @classmethod
    def create_for_recipients(cls, *, sender, recipients, title, message, notification_type='admin_update'):
        recipient_list = list(recipients)
        if not recipient_list:
            return []

        notifications = [
            cls(
                sender=sender,
                recipient=recipient,
                notification_type=notification_type,
                title=title,
                message=message,
            )
            for recipient in recipient_list
        ]
        return cls.objects.bulk_create(notifications)

    @classmethod
    def create_for_new_detection(cls, *, violation):
        recipients = User.objects.filter(
            profile__role='tmc_operator',
            profile__status='approved',
        )
        camera_name = violation.camera.name if violation.camera else 'Unknown camera'
        plate_number = violation.plate_number or 'Unknown plate'
        classification = violation.get_classification_display()
        title = 'New detection received'
        message = (
            f"A new {classification.lower()} detection was recorded from {camera_name} "
            f"for violation #{violation.id} ({plate_number})."
        )
        return cls.create_for_recipients(
            sender=None,
            recipients=recipients,
            title=title,
            message=message,
            notification_type='new_detection',
        )
