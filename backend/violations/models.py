from django.db import models
from cameras.models import Camera


class Violation(models.Model):
    DETECTION_STATUS_CHOICES = [
        ('compliant', 'Compliant'),
        ('violation', 'Violation'),
    ]
    
    CLASSIFICATION_CHOICES = [
        ('no_helmet', 'No Helmet'),
        ('nutshell', 'Nutshell Helmet'),
        ('half_face_helmet', 'Half Face Helmet'),
        ('full_face_helmet', 'Full Face Helmet'),
    ]
    
    camera = models.ForeignKey(Camera, on_delete=models.CASCADE, related_name='violations')
    detected_at = models.DateTimeField()
    detection_status = models.CharField(max_length=20, choices=DETECTION_STATUS_CHOICES)
    confidence_score = models.FloatField()
    classification = models.CharField(max_length=50, choices=CLASSIFICATION_CHOICES)
    plate_number = models.CharField(max_length=50, null=True, blank=True)
    evidence_image = models.ImageField(upload_to='violations/%Y/%m/%d/', blank=True)
    bounding_box = models.JSONField(null=True, blank=True)
    detected_objects = models.JSONField(null=True, blank=True)
    processed_at = models.DateTimeField(auto_now_add=True)
    
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