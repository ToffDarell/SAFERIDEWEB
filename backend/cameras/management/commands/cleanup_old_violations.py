# To schedule automatic daily cleanup on Windows:
# 1. Open Task Scheduler
# 2. Create Basic Task -> Name: "SafeRide Data Retention Cleanup"
# 3. Trigger: Daily at a low-traffic time (e.g. 2:00 AM)
# 4. Action: Start a program
#    Program: C:\CAPSTONE SAFERIDE WEB\backend\venv\Scripts\python.exe
#    Arguments: manage.py cleanup_old_violations
#    Start in: C:\CAPSTONE SAFERIDE WEB\backend
# 5. Finish and enable the task

from django.core.management.base import BaseCommand
from django.utils import timezone

from cameras.retention import cleanup_old_violations


class Command(BaseCommand):
    help = "Delete violation records and evidence older than the configured retention period."

    def handle(self, *args, **options):
        result = cleanup_old_violations()

        if not result.enabled:
            self.stdout.write("Data retention is disabled. Skipping cleanup.")
            return

        cutoff_display = timezone.localtime(result.cutoff_date).strftime("%Y-%m-%d %H:%M:%S %Z")
        self.stdout.write(
            self.style.SUCCESS(
                f"Deleted {result.deleted} violations older than {result.retention_days} days (before {cutoff_display})"
            )
        )

