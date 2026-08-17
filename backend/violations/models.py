from django.conf import settings
from django.db import models
from django.contrib.auth.models import User
from cameras.models import Camera


class Violation(models.Model):
    REVIEW_STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('reviewed', 'Reviewed'),
        ('resolved', 'Resolved'),
    ]
    
    DETECTION_STATUS_CHOICES = [
        ('compliant', 'Compliant'),
        ('violation', 'Violation'),
        
    ]
    
    CLASSIFICATION_CHOICES = [
        ('no_helmet', 'No Helmet'),
        ('helmet', 'Helmet'),
        ('nutshell', 'Nutshell'),
        ('license_plate', 'License Plate'),
    ]
    
    camera = models.ForeignKey(Camera, on_delete=models.CASCADE, related_name='violations')
    detected_at = models.DateTimeField()
    detection_status = models.CharField(max_length=20, choices=DETECTION_STATUS_CHOICES)
    confidence_score = models.FloatField()
    classification = models.CharField(max_length=50, choices=CLASSIFICATION_CHOICES)
    plate_number = models.CharField(max_length=50, null=True, blank=True)
    plate_number_corrected = models.CharField(max_length=20, blank=True, default='')
    plate_corrected_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='plate_corrections',
    )
    plate_corrected_at = models.DateTimeField(null=True, blank=True)
    evidence_image = models.ImageField(upload_to='violations/%Y/%m/%d/', blank=True)
    plate_crop_image = models.ImageField(upload_to='violations/%Y/%m/%d/plate_crops/', blank=True)
    bounding_box = models.JSONField(null=True, blank=True)
    detected_objects = models.JSONField(null=True, blank=True)
    processed_at = models.DateTimeField(auto_now_add=True)
    review_status = models.CharField(
        max_length=20,
        choices=REVIEW_STATUS_CHOICES,
        default='pending'
    )
    reviewed_by = models.ForeignKey(
        User, on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='reviewed_violations'
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'violations'
        ordering = ['-detected_at']
        indexes = [
            models.Index(fields=['-detected_at']),
            models.Index(fields=['detection_status']),
            models.Index(fields=['camera']),
        ]
    
    def __str__(self):
        plate = self.plate_number or 'Unknown'
        return f"{self.get_classification_display()} - {plate} @ {self.detected_at.strftime('%Y-%m-%d %H:%M')}"

    @staticmethod
    def mask_plate_number(value):
        plate = (value or '').strip()
        if not plate:
            return None
        if len(plate) <= 2:
            return '*' * len(plate)
        if len(plate) <= 4:
            return f"{plate[0]}{'*' * (len(plate) - 2)}{plate[-1]}"
        masked_length = max(1, len(plate) - 5)
        return f"{plate[:3]}{'*' * masked_length}{plate[-2:]}"

    def get_masked_plate_number(self):
        return self.mask_plate_number(self.plate_number)
