# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

SafeRide is a three-process system for motorcycle helmet-compliance enforcement at a Traffic Management Center (TMC):

- **`yolo_service/`** — standalone Python process. Pulls RTSP frames, runs a custom YOLO model + EasyOCR, decides what is a real violation, and POSTs evidence to the backend. Also serves an annotated MJPEG stream.
- **`backend/`** — Django 4.2 + DRF REST API on MySQL. Owns all persistence, auth, permissions, notifications, report export, and detection-tuning settings.
- **`frontend/`** — React 18 + Vite + TypeScript admin dashboard (shadcn/ui + Tailwind). Talks only to the backend REST API.

The three parts are deployed separately (see `DEPLOYMENT.md`) and communicate only over HTTP. There is no shared code or database between `yolo_service` and `backend` — the contract is the REST API.

## Commands

### Backend (`cd backend`, venv at `backend/venv`)
```powershell
venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 0.0.0.0:8000
python manage.py createsuperuser

# Tests (DRF APITestCase). Default settings target MySQL; use the sqlite test settings:
python manage.py test --settings=saferide_backend.test_settings
python manage.py test violations --settings=saferide_backend.test_settings          # one app
python manage.py test violations.tests.ViolationAnalyticsTests --settings=saferide_backend.test_settings   # one class

# Data-retention cleanup (intended to run from Windows Task Scheduler)
python manage.py cleanup_old_violations
```
There is no lint/format config for the backend. `django_extensions` is installed (`shell_plus`, `runserver_plus`).

### Frontend (`cd frontend`)
```powershell
npm install
npm run dev        # Vite dev server on :5173
npm run build      # production build to frontend/dist/
npm run lint       # eslint (flat config, eslint.config.js)
```
No test runner is configured for the frontend.

### YOLO service (`cd yolo_service`, venv at `yolo_service/venv`)
```powershell
venv\Scripts\activate
pip install -r requirements.txt
python main.py     # reads .env, connects to RTSP, starts detection + MJPEG on :8081
```

## Environment / config

Each part reads its own `.env` (all gitignored). Full templates are in `DEPLOYMENT.md`.
- `backend/.env` — `SECRET_KEY`, `DB_*` (MySQL), `DEBUG`, `ALLOWED_HOSTS`/`CORS_ALLOWED_ORIGINS`/`CSRF_TRUSTED_ORIGINS` (comma-separated), `GOOGLE_CLIENT_ID/SECRET`, `RECAPTCHA_*`. `settings.py` derives sane dev defaults when `DEBUG` is truthy; in production these vars are required.
- `frontend/.env` — `VITE_API_URL` (base host **without** `/api`; `src/config.ts` and `src/services/api.ts` append `/api` themselves), `VITE_GOOGLE_CLIENT_ID`, `VITE_RECAPTCHA_SITE_KEY`.
- `yolo_service/.env` — `BACKEND_URL`, `YOLO_API_KEY`, `CAMERA_ID`, `RTSP_URL_FALLBACK`, plus many `YOLO_*` / `OCR_*` / `CONFIRM_*` tuning knobs. Most detection thresholds are pulled live from the backend (see below), so `.env` values are only fallbacks.

## Architecture notes

### Auth & permissions (backend)
- **Humans**: JWT (SimpleJWT). Login is `POST /api/auth/token/` via `users.jwt_views.ApprovedTokenObtainPairView` — the legacy dj-rest-auth login/registration endpoints are deliberately disabled (`DisabledLegacy*View`). Google OAuth via allauth/dj-rest-auth. Access token 60 min, refresh 7 days; frontend auto-refreshes on 401 in `src/services/api.ts`.
- **Machine (YOLO service)**: `rest_framework_api_key`. `Authorization: Api-Key <key>` header. The `IsYoloService` permission gates exactly one thing: `POST /api/violations/` (violation creation). Everything else requires an authenticated human.
- Global default permission is `users.permissions.IsApprovedUser` — a user needs `UserProfile.status == "approved"` (admins/superusers bypass).
- Two roles: `admin` (also any `is_staff`/`is_superuser`) and `tmc_operator`. Operators get a fine-grained permission dict (`DEFAULT_OPERATOR_PERMISSIONS` in `users/models.py`); admins implicitly have all of them. `UserProfile.save()` normalizes the dict, so add new operator permissions to `DEFAULT_OPERATOR_PERMISSIONS` **and** the matching `HasApprovedPermission` subclass in `users/permissions.py`. `ViolationViewSet.get_permissions()` switches the permission class per action.
- The frontend mirrors this: `src/contexts/PermissionsContext` + `ProtectedRoute` gate routes by permission key. Keep the key strings in sync with the backend.

### Detection pipeline (`yolo_service/main.py`)
Single file, heavily multi-threaded. The main loop only does YOLO inference + drawing + decision logic; everything blocking runs on daemon threads communicating via `Queue` and small lock-wrapped store classes (`_FrameStore`, `_OcrState`, `_JpegStore`):
- **capture thread** — RTSP read with auto-reconnect, keeps only the latest frame.
- **OCR thread** — EasyOCR on plate crops (always CPU, to avoid GPU contention with YOLO); drains stale queue items.
- **MJPEG encoder thread** + `mjpeg_server.py` — serves `/stream` on `MJPEG_PORT`.
- **violation sender thread** — POSTs to backend so uploads never stall inference.
- **heartbeat thread** — `POST /api/cameras/{id}/heartbeat/` every `HEARTBEAT_SECONDS`.

A detection becomes a violation only after passing, in order: per-class confidence gate → 2-of-3 frame class stability (violation classes skip this) → a license plate matched to the same rider (`_plate_matches_violation`) → the rider box overlapping the estimated rider zone above the plate (`_violation_overlaps_plate_zone`, rejects pedestrians) → temporal confirmation (dwell + majority vote over a spatial bucket) unless raw conf ≥ `INSTANT_CONFIRM_CONF` → spatial + proximity dedup against recently-sent violations. This geometry is the core IP of the project; change it carefully.

There is a **second, independent pedestrian filter on the backend**: `ViolationSerializer.validate()` rejects a `no_helmet`/`nutshell` create if `detected_objects` shows a person with no rider/vehicle label (`_is_pedestrian_only_helmet_event`). Plate OCR + PH-plate normalization (formats `ABC1234`, `1234ABC`, `123ABC`, `A123BC`, `1234-123456/7`) lives in `yolo_service/ocr.py`.

Detection thresholds live in `SystemSettings` (a pk=1 singleton, `cameras/models.py`) and are fetched from `GET /api/settings/` at startup and re-fetched every 300 frames. Editing them in the frontend Settings page changes live YOLO behavior with no restart.

### Backend apps
- **`cameras/`** — `Camera` CRUD, `heartbeat` action, `SystemSettings` singleton (`GET/PATCH /api/settings/`), retention cleanup (`retention.py` + management commands). Camera liveness is derived at read time from `last_seen_at` vs `HEARTBEAT_TIMEOUT_SECONDS` (8s) — `get_runtime_status()`, not a stored field.
- **`violations/`** — `Violation` model + `ViolationViewSet` (`create` is YOLO-only), `summary/` and `weekly-chart/` analytics, `recent/` (deliberately lightweight endpoint for the frontend's 1.5s notification poller), evidence images, plate correction. Export (CSV/XLSX/PDF via ReportLab/openpyxl) is `GET /api/violations/export/` handled by `ViolationExportView` (registered in the project `urls.py`, ahead of the router).
- **`users/`** — auth (`jwt_views.py`, `views_google.py`), `UserProfile` (role/status/permissions), `AdminNotification` + `UserNotification` (created via classmethods on the models, e.g. on new detection, plate correction, report export — grep `create_for_` when touching notification triggers), reCAPTCHA (`recaptcha.py`), login lockout/throttling (`auth_security.py`, `throttles.py`), signals (`signals.py`, wired via `UsersConfig`).
- URL layout: project `saferide_backend/urls.py` mounts each app under `/api/<app>/`; DRF routers are registered at the app's root (`r''`), so e.g. violation detail is `/api/violations/{id}/`.
- Pagination: `DynamicPageSizePagination` (default page size 10, `?page_size=` honored).
- Models set explicit `db_table` names (`violations`, `cameras`, `user_profiles`, etc.).

### Frontend
- Pages in `src/pages/` map 1:1 to routes in `src/App.tsx`. Each page uses a typed client from `src/services/` (axios instance in `services/api.ts` with the JWT + refresh interceptors).
- `@/` path alias → `src/` (both `vite.config.ts` and `tsconfig`). shadcn/ui components in `src/components/ui/` (config in `components.json`) — generally treat as generated.
- TS config is intentionally loose (`strictNullChecks` and `noImplicitAny` off).
- The Live Monitor page embeds the YOLO service's MJPEG stream URL directly, so the browser needs network access to the AI PC's `MJPEG_PORT`, not just the backend.

## Notes

- `ai-skills/` (root) and `frontend/ai-skills/` are markdown persona/reference docs for AI tooling, not application code.
- `graphify-out/`, `ruvector.db`, `.swarm/`, `.medusa/`, `.agents/`, `.mimocode/`, `.playwright-mcp/` are agent-tooling artifacts (mostly gitignored) — ignore them.
- `DEPLOYMENT.md` is gitignored but is the authoritative env-var and deployment reference.
