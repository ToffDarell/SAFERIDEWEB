from datetime import timedelta

from django.db import models
from django.utils import timezone


class SystemSettings(models.Model):
    
    """Singleton model — only one row (pk=1) will ever exist."""
    # Security
    password_min_length = models.IntegerField(default=8)

    # Detection YOLO
    confidence_threshold = models.FloatField(default=0.60)
    send_cooldown_seconds = models.IntegerField(default=3.0)
    data_retention_days = models.IntegerField(default=90)

    # Per-class confidence thresholds
    conf_no_helmet     = models.FloatField(default=0.55)   # lenient — catch more violators
    conf_nutshell      = models.FloatField(default=0.65)   # strict  — avoid wrongful violations
    conf_helmet        = models.FloatField(default=0.60)   # follows global threshold by default
    conf_license_plate = models.FloatField(default=0.60)   # YOLO plate detection threshold

    # OCR
    ocr_confidence = models.FloatField(default=0.5)

    # Notifications
    notify_on_new_detection = models.BooleanField(default=True)
    notify_on_operator_activity = models.BooleanField(default=True)
    notify_on_camera_offline = models.BooleanField(default=True)

    # Database preferences
    database_backup_enabled = models.BooleanField(default=True)
    database_backup_frequency_hours = models.PositiveIntegerField(default=24)
    database_backup_retention_days = models.PositiveIntegerField(default=30)

    class Meta:
        verbose_name = 'System Settings'

    @classmethod
    def get_settings(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def __str__(self):
        return 'System Settings'


class Camera(models.Model):
    HEARTBEAT_TIMEOUT_SECONDS = 8
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('inactive', 'Inactive'),
    ]
    LENS_CHOICES = [
        ('wide', 'Wide'),
        ('tele', 'Tele'),
    ]
    
    name = models.CharField(max_length=200)
    location = models.CharField(max_length=500, blank=True)
    stream_url = models.CharField(max_length=500, blank=True)
    rtsp_url = models.CharField(max_length=500, blank=True, default='')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    last_seen_at = models.DateTimeField(null=True, blank=True)
    active_lens = models.CharField(max_length=20, choices=LENS_CHOICES, default='wide')
    preferred_lens = models.CharField(max_length=20, choices=LENS_CHOICES, default='wide')
    supports_lens_switching = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'cameras'
        ordering = ['-created_at']
        
    def __str__(self):
        return self.name

    def is_live(self, now=None):
        if self.status != 'active' or not self.last_seen_at:
            return False

        last_seen = self.last_seen_at
        if timezone.is_naive(last_seen):
            last_seen = timezone.make_aware(last_seen, timezone.get_current_timezone())

        current_time = now or timezone.now()
        return last_seen >= current_time - timedelta(seconds=self.HEARTBEAT_TIMEOUT_SECONDS)

    def get_runtime_status(self, now=None):
        return 'active' if self.is_live(now=now) else 'inactive'
