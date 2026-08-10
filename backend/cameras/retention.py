from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Optional

from django.core.files.storage import default_storage
from django.db import transaction
from django.utils import timezone

from cameras.models import SystemSettings
from violations.models import Violation


@dataclass(frozen=True)
class CleanupResult:
    deleted: int
    cutoff_date: Optional[datetime]
    retention_days: int
    enabled: bool


def _delete_file_field(file_field, *, require_non_empty: bool = False) -> None:
    if not file_field:
        return

    name = getattr(file_field, "name", "")
    if not name:
        return

    storage = getattr(file_field, "storage", default_storage)

    try:
        if not storage.exists(name):
            return

        if require_non_empty:
            try:
                if storage.size(name) <= 0:
                    return
            except (FileNotFoundError, OSError, NotImplementedError):
                return

        try:
            storage.delete(name)
        except FileNotFoundError:
            return
    except FileNotFoundError:
        return


def cleanup_old_violations(settings_obj=None, *, now=None) -> CleanupResult:
    settings_obj = settings_obj or SystemSettings.get_settings()
    retention_days = int(getattr(settings_obj, "data_retention_days", 0) or 0)

    # The current schema does not store a separate enable/disable boolean.
    # We treat 0 or negative days as "disabled" so the cleanup can be turned off
    # without changing the model fields.
    if retention_days <= 0:
        return CleanupResult(
            deleted=0,
            cutoff_date=None,
            retention_days=retention_days,
            enabled=False,
        )

    current_time = now or timezone.now()
    cutoff_date = current_time - timedelta(days=retention_days)

    queryset = (
        Violation.objects.filter(detected_at__lt=cutoff_date)
        .only("id", "evidence_image", "plate_crop_image")
        .order_by("detected_at")
    )

    violations = list(queryset.iterator(chunk_size=200))
    deleted_ids = []

    for violation in violations:
        _delete_file_field(violation.evidence_image)
        _delete_file_field(violation.plate_crop_image, require_non_empty=True)
        deleted_ids.append(violation.pk)

    if deleted_ids:
        with transaction.atomic():
            Violation.objects.filter(pk__in=deleted_ids).delete()

    return CleanupResult(
        deleted=len(deleted_ids),
        cutoff_date=cutoff_date,
        retention_days=retention_days,
        enabled=True,
    )

