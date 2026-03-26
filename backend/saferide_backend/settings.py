"""
Django settings for saferide_backend project.
"""

from pathlib import Path
from datetime import timedelta
from decouple import config


def parse_debug(value):
    if isinstance(value, bool):
        return value
    text = str(value).strip().lower()
    if text in {"1", "true", "yes", "on", "debug", "development"}:
        return True
    if text in {"0", "false", "no", "off", "release", "production"}:
        return False
    return False


def parse_csv(value):
    if value is None:
        return []
    if isinstance(value, (list, tuple, set)):
        return [str(item).strip() for item in value if str(item).strip()]
    return [item.strip() for item in str(value).split(',') if item.strip()]

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = config('SECRET_KEY')


# Recaptcha settings
RECAPTCHA_PUBLIC_KEY = config('RECAPTCHA_PUBLIC_KEY')
RECAPTCHA_PRIVATE_KEY = config('RECAPTCHA_PRIVATE_KEY')
RECAPTCHA_VERIFY_ENABLED = parse_debug(config('RECAPTCHA_VERIFY_ENABLED', default='true'))



DEBUG = parse_debug(config('DEBUG', default='true'))

DEFAULT_ALLOWED_HOSTS = 'localhost,127.0.0.1' if DEBUG else ''
ALLOWED_HOSTS = parse_csv(config('ALLOWED_HOSTS', default=DEFAULT_ALLOWED_HOSTS))

# Application definition
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'django.contrib.sites',  # Required for allauth
    'django_extensions', 
    # REST Framework
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework.authtoken',  # Required for dj-rest-auth
    'rest_framework_api_key',
    
    # CORS
    'corsheaders',
    'django_filters',

    # Recaptch  
    'django_recaptcha',

    
    # Allauth
    'allauth',
    'allauth.account',
    'allauth.socialaccount',
    'allauth.socialaccount.providers.google',
    
    # dj-rest-auth
    'dj_rest_auth',
    'dj_rest_auth.registration',

    # SAFERIDE APPS
    'users.apps.UsersConfig',  # Use the AppConfig to ensure signals are registered
    'cameras',
    'violations',
]

SITE_ID = 1

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'allauth.account.middleware.AccountMiddleware',  # Required for allauth
]

ROOT_URLCONF = 'saferide_backend.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'saferide_backend.wsgi.application'

# Database
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.mysql",
        "NAME": config('DB_NAME'),
        "USER": config('DB_USER'),
        "PASSWORD": config('DB_PASSWORD'),
        "HOST": config('DB_HOST', default='localhost'),
        "PORT": config('DB_PORT', default='3306'),
        "OPTIONS": {
            "init_command": "SET sql_mode='STRICT_TRANS_TABLES'",
        },
    }
}

# Authentication backends
AUTHENTICATION_BACKENDS = [
    'django.contrib.auth.backends.ModelBackend',
    'allauth.account.auth_backends.AuthenticationBackend',
]

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

CORS_DEFAULT_ORIGINS = (
    'http://localhost:5173,'
    'http://127.0.0.1:5173,'
    'http://localhost:3000,'
    'http://127.0.0.1:3000'
) if DEBUG else ''
CORS_ALLOWED_ORIGINS = parse_csv(config('CORS_ALLOWED_ORIGINS', default=CORS_DEFAULT_ORIGINS))
CORS_ALLOW_CREDENTIALS = True
CSRF_TRUSTED_ORIGINS = parse_csv(config('CSRF_TRUSTED_ORIGINS', default=CORS_DEFAULT_ORIGINS))

# Production security
SECURE_SSL_REDIRECT = parse_debug(config('SECURE_SSL_REDIRECT', default='false' if DEBUG else 'true'))
SESSION_COOKIE_SECURE = parse_debug(config('SESSION_COOKIE_SECURE', default='false' if DEBUG else 'true'))
CSRF_COOKIE_SECURE = parse_debug(config('CSRF_COOKIE_SECURE', default='false' if DEBUG else 'true'))
SECURE_HSTS_SECONDS = config('SECURE_HSTS_SECONDS', default=0 if DEBUG else 31536000, cast=int)
SECURE_HSTS_INCLUDE_SUBDOMAINS = parse_debug(
    config('SECURE_HSTS_INCLUDE_SUBDOMAINS', default='false' if DEBUG else 'true')
)
SECURE_HSTS_PRELOAD = parse_debug(config('SECURE_HSTS_PRELOAD', default='false' if DEBUG else 'true'))
SECURE_CONTENT_TYPE_NOSNIFF = parse_debug(config('SECURE_CONTENT_TYPE_NOSNIFF', default='true'))
X_FRAME_OPTIONS = config('X_FRAME_OPTIONS', default='DENY')
USE_X_FORWARDED_PROTO = parse_debug(config('USE_X_FORWARDED_PROTO', default='false' if DEBUG else 'true'))
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https') if USE_X_FORWARDED_PROTO else None

# Login security
AUTH_LOCKOUT_FAILURE_LIMIT = config('AUTH_LOCKOUT_FAILURE_LIMIT', default=5, cast=int)
AUTH_LOCKOUT_WINDOW_SECONDS = config('AUTH_LOCKOUT_WINDOW_SECONDS', default=15 * 60, cast=int)
AUTH_LOCKOUT_DURATION_SECONDS = config('AUTH_LOCKOUT_DURATION_SECONDS', default=15 * 60, cast=int)

# REST Framework
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": [
        "users.permissions.IsApprovedUser",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "login_burst": config('LOGIN_BURST_RATE', default='10/minute'),
        "login_sustained": config('LOGIN_SUSTAINED_RATE', default='30/hour'),
    },
    'DEFAULT_PAGINATION_CLASS': 'saferide_backend.pagination.DynamicPageSizePagination',
    'PAGE_SIZE': 10,
}

# JWT Settings
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=60),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': False,
    'BLACKLIST_AFTER_ROTATION': True,
    'UPDATE_LAST_LOGIN': True,
}

# Allauth settings
SOCIALACCOUNT_AUTO_SIGNUP = True
ACCOUNT_LOGIN_METHODS = {'email', 'username'}
ACCOUNT_SIGNUP_FIELDS = ['email*', 'password1*', 'password2*']
ACCOUNT_EMAIL_VERIFICATION = 'optional'

# Google OAuth settings
SOCIALACCOUNT_PROVIDERS = {
    'google': {
        'SCOPE': [
            'profile',
            'email',
        ],
        'AUTH_PARAMS': {
            'access_type': 'online',
        },
        'APP': {
            'client_id': config('GOOGLE_CLIENT_ID'),
            'secret': config('GOOGLE_CLIENT_SECRET'),
            'key': ''
        }
    }
}

# Media files
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# Internationalization
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# Static files
STATIC_URL = 'static/'

# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Force trailing slash
APPEND_SLASH = True
