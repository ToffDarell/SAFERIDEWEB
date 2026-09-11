from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth import get_user_model
from django.utils import timezone
from .models import UserProfile

User = get_user_model()

@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        profile, _ = UserProfile.objects.get_or_create(user=instance)
        # A superuser/staff account created from the CLI (`manage.py createsuperuser`)
        # never goes through the admin approval flow, so its profile would otherwise
        # stay role='tmc_operator' / status='pending'. The backend issues a token for
        # them anyway (staff bypass in ApprovedTokenObtainPairSerializer.get_token),
        # but the frontend logs them straight back out on status == 'pending'.
        # Promote them here so CLI superusers can actually sign in.
        if instance.is_superuser or instance.is_staff:
            updates = {}
            if profile.role != 'admin':
                updates['role'] = 'admin'
            if profile.status != 'approved':
                updates['status'] = 'approved'
                updates['approved_at'] = timezone.now()
            if updates:
                for field, value in updates.items():
                    setattr(profile, field, value)
                profile.save(update_fields=list(updates.keys()))
