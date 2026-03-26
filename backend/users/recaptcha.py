import json
from urllib import parse, request
from urllib.error import HTTPError, URLError

from django.conf import settings
from rest_framework.exceptions import ValidationError

from .auth_security import get_client_ip


RECAPTCHA_VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify"


def is_recaptcha_verification_enabled():
    return bool(getattr(settings, "RECAPTCHA_VERIFY_ENABLED", True))


def verify_recaptcha_token(token, request_context=None):
    if not is_recaptcha_verification_enabled():
        return True

    secret_key = getattr(settings, "RECAPTCHA_PRIVATE_KEY", "")
    if not secret_key:
        return False

    response_token = (token or "").strip()
    if not response_token:
        return False

    payload = {
        "secret": secret_key,
        "response": response_token,
    }

    remote_ip = get_client_ip(request_context)
    if remote_ip and remote_ip != "unknown":
        payload["remoteip"] = remote_ip

    encoded_payload = parse.urlencode(payload).encode("utf-8")
    http_request = request.Request(
        RECAPTCHA_VERIFY_URL,
        data=encoded_payload,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )

    try:
        with request.urlopen(http_request, timeout=5) as response:
            response_data = json.loads(response.read().decode("utf-8"))
    except (HTTPError, URLError, TimeoutError, ValueError, json.JSONDecodeError):
        return False

    return bool(response_data.get("success"))


def validate_recaptcha_token(token, request_context=None):
    if not verify_recaptcha_token(token, request_context=request_context):
        raise ValidationError({"captcha_token": "Captcha verification failed."})
