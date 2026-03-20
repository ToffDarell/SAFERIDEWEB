from django.db import models
from django.contrib.auth.models import User


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
    created_at = models.DateTimeField(auto_now_add=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_users')
    
    class Meta:
        db_table = 'user_profiles'
    
    def __str__(self):
        return f"{self.user.username} - {self.role} ({self.status})"


class AdminNotification(models.Model):
    NOTIFICATION_TYPE_CHOICES = [
        ('violation_action', 'Violation Action'),
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
