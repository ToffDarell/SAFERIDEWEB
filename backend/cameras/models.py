from django.db import models


class SystemSettings(models.Model):
    
    """Singleton model — only one row (pk=1) will ever exist."""
    #Security
    auto_logout = models.BooleanField(default=True)
    session_timeout = models.IntegerField(default=30)     
    password_min_length = models.IntegerField(default=8)

    # Detection YOLO
    confidence_threshold = models.FloatField(default=0.60)
    send_cooldown_seconds = models.IntegerField(default=3.0)
    data_retention_days = models.IntegerField(default=90)

    # OCR
    ocr_confidence = models.FloatField(default=0.5)
    class Meta:
        verbose_name = 'System Settings'

    @classmethod
    def get_settings(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def __str__(self):
        return 'System Settings'


class Camera(models.Model):
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('inactive', 'Inactive'),
    ]
    
    name = models.CharField(max_length=200)
    location = models.CharField(max_length=500, blank=True)
    stream_url = models.CharField(max_length=500, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    last_seen_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'cameras'
        ordering = ['-created_at']
        
    def __str__(self):
        return self.name