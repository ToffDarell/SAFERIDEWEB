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


def get_default_operator_permissions():
    return DEFAULT_OPERATOR_PERMISSIONS.copy()


def normalize_operator_permissions(value):
    normalized = get_default_operator_permissions()
    if isinstance(value, dict):
        for key in DEFAULT_OPERATOR_PERMISSIONS:
            if key in value:
                normalized[key] = bool(value[key])
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
        super().save(*args, **kwargs)

    def get_effective_permissions(self):
        if self.role != 'tmc_operator':
            return {}
        return normalize_operator_permissions(self.permissions)
    
    def __str__(self):
        return f"{self.user.username} - {self.role} ({self.status})"


class AdminNotification(models.Model):
    NOTIFICATION_TYPE_CHOICES = [
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
        return ['violation_action']

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
