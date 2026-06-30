# SafeRide - AI-Powered Motorcycle Helmet Compliance Detection

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](#)

A **Traffic Management Center (TMC)** platform that uses AI-powered computer vision to automatically detect motorcycle helmet compliance violations from live CCTV/RTSP camera streams. Built as a capstone project.

---

## Architecture Overview

```
┌──────────────┐    RTSP     ┌─────────────────────────────────────┐
│  CCTV Camera │────────────▶│          YOLO Service               │
│  (RTSP/IP)   │             │  • Frame capture (multi-threaded)   │
└──────────────┘             │  • YOLOv8/v11 inference (GPU)       │
                             │  • EasyOCR license plate reading    │
                             │  • MJPEG live stream (port 8081)    │
                             │  • Violation queue & upload         │
                             └──────────┬──────────────────────────┘
                                        │ HTTP REST
                                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Django Backend (REST API)                    │
│  • JWT + Google OAuth auth   • Camera CRUD & heartbeats         │
│  • Violation records         • System settings                  │
│  • Evidence image storage    • CSV/XLSX/PDF reports             │
│  • Role-based access (admin/operator)                           │
│  • MySQL database                                                │
└─────────────────────────┬───────────────────────────────────────┘
                          │ REST
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                     React Frontend (Admin Dashboard)             │
│  • Real-time live monitor (MJPEG)  • Violation review & filter  │
│  • Dashboard with charts/stats     • Camera management          │
│  • Report export (CSV/XLSX/PDF)    • System settings            │
│  • 3D dashboard elements           • Light/dark mode            │
└─────────────────────────────────────────────────────────────────┘
```

## Detection Flow

1. **RTSP Capture** — Video stream is read frame-by-frame from the CCTV camera using OpenCV (FFMPEG backend).
2. **YOLO Inference** — Each frame runs through a custom-trained YOLO model detecting 4 classes:
   - `no_helmet` — Rider without helmet (violation)
   - `nutshell` — Non-compliant helmet (violation)
   - `helmet` — Properly worn helmet (compliant)
   - `license_plate` — Vehicle license plate
3. **Stable Detection** — A detection is only considered valid if it appears in at least 2 of the last 3 frames (reduces flickering).
4. **Spatial Validation** — A violation is only flagged if the detected person has an associated license plate in the same spatial zone AND overlaps the estimated rider zone above that plate. This rejects pedestrians walking beside parked motorcycles.
5. **OCR** — License plate regions are cropped and read via EasyOCR, normalized to Philippine plate formats (AAA1234, 1234ABC, etc.).
6. **Cooldown** — Duplicate violation types for the same camera respect a configurable cooldown period.
7. **Evidence Upload** — The annotated frame + plate crop are sent to the Django backend as violation records (multipart upload).
8. **Live Stream** — The annotated frame is simultaneously served as an MJPEG stream for real-time monitoring.

## Tech Stack

| Tier | Technology |
|---|---|
| **AI Service** | Python, Ultralytics YOLOv8/v11, OpenCV, EasyOCR, PyTorch |
| **Backend** | Python, Django 4.2, Django REST Framework, MySQL |
| **Auth** | JWT (SimpleJWT), Google OAuth, reCAPTCHA |
| **Frontend** | React 18, TypeScript, Vite 7, Tailwind CSS 3, shadcn/ui |
| **Charts** | Recharts, Three.js |
| **Export** | ReportLab (PDF), OpenPyXL (XLSX), CSV |

## Project Structure

```
├── yolo_service/          AI detection service (YOLO + OCR)
│   ├── main.py            Entry point — detection pipeline
│   ├── detection.py       Box filtering utilities
│   ├── ocr.py             License plate OCR (EasyOCR)
│   ├── backend_api.py     HTTP client for Django backend
│   ├── mjpeg_server.py    MJPEG live stream server
│   ├── weights/           YOLO model weights
│   └── requirements.txt   Python dependencies
│
├── backend/               Django REST API
│   ├── saferide_backend/  Project settings & URL routing
│   ├── cameras/           Camera model, settings, heartbeats
│   ├── violations/        Violation records, exports, charts
│   ├── users/             Auth, profiles, permissions, notifications
│   └── requirements.txt   Python dependencies
│
├── frontend/              React admin dashboard
│   ├── src/
│   │   ├── pages/         Route components (Dashboard, Violations, etc.)
│   │   ├── services/      API clients (Axios)
│   │   └── components/    Shared UI components
│   ├── package.json
│   └── vite.config.ts
│
├── DEPLOYMENT.md          Full deployment guide
└── README.md              This file
```

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- MySQL 8+
- CUDA-capable GPU (recommended) or CPU fallback

### Clone

```bash
git clone https://github.com/your-username/saferide.git
cd saferide
```

### 1. Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Copy and configure environment variables:

```bash
cp .env.example .env
# Edit .env with your DB credentials, secret key, OAuth keys, etc.
```

Run migrations and start the server:

```bash
python manage.py migrate
python manage.py runserver 0.0.0.0:8000
```

### 2. YOLO Service Setup

```bash
cd yolo_service
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Configure `.env` with your RTSP stream URL and API credentials, then run:

```bash
python main.py
```

### 3. Frontend Setup

```bash
cd frontend
npm install
cp .env.example .env   # Set VITE_API_URL, Google Client ID, reCAPTCHA key
npm run dev
```

The dashboard is available at `http://localhost:5173`.

## API Endpoints (Summary)

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/auth/token/` | JWT login |
| POST | `/api/auth/google/` | Google OAuth login |
| GET | `/api/cameras/` | List cameras |
| POST | `/api/cameras/{id}/heartbeat/` | Camera heartbeat (YOLO) |
| GET/PATCH | `/api/settings/` | System settings |
| GET | `/api/violations/` | List violations |
| POST | `/api/violations/` | Create violation (YOLO only) |
| GET | `/api/violations/summary/` | Aggregated stats |
| GET | `/api/violations/export/` | Export report |

See `DEPLOYMENT.md` for full deployment instructions including production setup with nginx, supervisor, and MySQL configuration.
