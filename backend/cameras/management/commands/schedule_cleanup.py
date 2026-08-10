from django.core.management import call_command
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Proxy command for Task Scheduler or cron to run the retention cleanup."

    def handle(self, *args, **options):
        call_command("cleanup_old_violations", stdout=self.stdout, stderr=self.stderr)
