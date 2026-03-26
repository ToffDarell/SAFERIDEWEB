import math
import time
from hashlib import sha256

from django.conf import settings
from django.core.cache import cache
from rest_framework.throttling import SimpleRateThrottle


def _get_setting(name, default):
    return getattr(settings, name, default)


def get_client_ip(request):
    if request is None:
        return "unknown"

    forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip() or "unknown"

    return (
        request.META.get("HTTP_X_REAL_IP")
        or request.META.get("REMOTE_ADDR")
        or "unknown"
    )


def _normalize(value):
    return (value or "").strip().lower()


def _cache_key(prefix, value):
    normalized_value = _normalize(value) or "unknown"
    digest = sha256(normalized_value.encode("utf-8")).hexdigest()
    return f"auth_security:{prefix}:{digest}"


class LoginAttemptTracker:
    def __init__(self, request, username):
        self.request = request
        self.username = _normalize(username)
        self.ip_address = get_client_ip(request)

    @staticmethod
    def _failure_limit():
        return max(1, int(_get_setting("AUTH_LOCKOUT_FAILURE_LIMIT", 5)))

    @staticmethod
    def _attempt_window():
        return max(60, int(_get_setting("AUTH_LOCKOUT_WINDOW_SECONDS", 15 * 60)))

    @staticmethod
    def _lockout_duration():
        return max(60, int(_get_setting("AUTH_LOCKOUT_DURATION_SECONDS", 15 * 60)))

    def _identifiers(self):
        identifiers = [("ip", self.ip_address)]
        if self.username:
            identifiers.append(("username", self.username))
        return identifiers

    def _attempt_key(self, scope, value):
        return _cache_key(f"login_attempts:{scope}", value)

    def _lock_key(self, scope, value):
        return _cache_key(f"login_lock:{scope}", value)

    def get_retry_after(self):
        now = time.time()
        remaining_seconds = 0

        for scope, value in self._identifiers():
            lock_key = self._lock_key(scope, value)
            locked_until = cache.get(lock_key)
            if not locked_until:
                continue

            if locked_until <= now:
                cache.delete(lock_key)
                continue

            remaining_seconds = max(
                remaining_seconds,
                int(math.ceil(locked_until - now)),
            )

        return remaining_seconds

    def register_failure(self):
        now = time.time()
        attempt_window = self._attempt_window()
        lockout_duration = self._lockout_duration()
        failure_limit = self._failure_limit()

        for scope, value in self._identifiers():
            attempt_key = self._attempt_key(scope, value)
            state = cache.get(attempt_key) or {}
            started_at = state.get("started_at", now)
            count = state.get("count", 0)

            if now - started_at > attempt_window:
                started_at = now
                count = 0

            count += 1
            cache.set(
                attempt_key,
                {"count": count, "started_at": started_at},
                timeout=attempt_window,
            )

            if count >= failure_limit:
                cache.set(
                    self._lock_key(scope, value),
                    now + lockout_duration,
                    timeout=lockout_duration,
                )
                cache.delete(attempt_key)

    def reset(self):
        for scope, value in self._identifiers():
            cache.delete(self._attempt_key(scope, value))


class BaseLoginIPRateThrottle(SimpleRateThrottle):
    def get_cache_key(self, request, view):
        return self.cache_format % {
            "scope": self.scope,
            "ident": get_client_ip(request),
        }


class LoginBurstRateThrottle(BaseLoginIPRateThrottle):
    scope = "login_burst"


class LoginSustainedRateThrottle(BaseLoginIPRateThrottle):
    scope = "login_sustained"
