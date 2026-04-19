# Patient Health Risk Assessment System

A full-stack healthcare application that automates end-to-end clinical risk assessment. Healthcare staff upload patient clinical data, a weighted ML engine computes a risk score, and the system generates structured health reports with evidence-based recommendations. Patients can log in to view their own assessments and improvement plans.

---

## Live Demo

**Backend API**: Deployed on Render  
**Frontend**: React dashboard at `http://localhost:5173` (local)

---

## Tech Stack

### Backend

| Layer               | Technology                            |
| ------------------- | ------------------------------------- |
| Runtime             | Node.js 18+                           |
| Language            | TypeScript 5                          |
| Framework           | Express 4                             |
| ORM                 | Drizzle ORM                           |
| Database            | PostgreSQL 15+                        |
| Cache / Queue store | Redis (Upstash on production)         |
| Background jobs     | BullMQ                                |
| Auth                | JWT (access + refresh token rotation) |
| Validation          | Zod                                   |
| Logging             | Pino (structured JSON)                |
| Testing             | Jest + Supertest                      |

### Frontend

| Layer       | Technology      |
| ----------- | --------------- |
| Framework   | React 18 + Vite |
| Routing     | React Router v6 |
| Styling     | Tailwind CSS    |
| HTTP client | Axios           |
| Charts      | Recharts        |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│              React Frontend (Vite + Tailwind)            │
│   Login → Staff Dashboard → Patient Dashboard           │
└────────────────────────┬────────────────────────────────┘
                         │ HTTP /api/v1
┌────────────────────────▼────────────────────────────────┐
│                  Middleware Stack                        │
│  correlationId → requestLogger → rateLimiter →          │
│  auth → rbac → validate → router → errorHandler         │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│               Controller Layer (/api/v1/*)              │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│         HealthAssessmentOrchestrator                    │
│  (atomic pipeline: validate → risk engine →             │
│   report → recommendations → persist)                  │
└──────┬──────────────┬──────────────┬────────────────────┘
       │              │              │
  RiskService   ReportService  RecommendationService
       │                              │
  ML Risk Engine              KnowledgeService
  (pure function)             (circuit breaker + retry)
       │
┌──────▼──────────────────────────────────────────────────┐
│               Repository Layer (Drizzle ORM)            │
└────────────────────────┬────────────────────────────────┘
                         │
                    PostgreSQL

Supporting Infrastructure:
  Redis  ←→  Caching (5 min TTL), Rate Limiting, Idempotency Keys
  BullMQ ←→  Async Assessment Job Queue (3 retries, exponential backoff)
```

---

## Features

### Authentication & Security

- JWT access tokens (15 min expiry) + opaque refresh tokens (7 days)
- Refresh token rotation with family-based reuse detection — entire family invalidated on reuse
- Brute-force protection: IP blocked for 15 min after 5 failed login attempts (Redis-backed)
- Role-based access control: `HEALTHCARE_STAFF` and `PATIENT` roles
- Patients can only access their own data — ownership verified via DB lookup, not JWT comparison

### Assessment Pipeline (Orchestrator)

The `HealthAssessmentOrchestrator` executes all stages atomically inside a single DB transaction:

1. Acquire PostgreSQL advisory lock on `patientId` (prevents race conditions)
2. Fetch latest clinical data
3. Invoke ML Risk Engine → `riskScore` + `riskLevel`
4. Create `RiskAssessment` record (status: PROCESSING)
5. Generate report summary
6. Fetch recommendations from KnowledgeService
7. Persist `HealthReport`
8. Update assessment status → COMPLETED
9. Commit; invalidate Redis cache; set idempotency key to `complete`

On any failure: rollback, set idempotency key to `failed`, throw `PipelineError` with stage name.

### ML Risk Engine

Pure function — no DB access, no HTTP calls, no side effects.

Weighted scoring across 6 clinical metrics:

| Metric         | Weight |
| -------------- | ------ |
| Age            | 20 pts |
| Blood Pressure | 20 pts |
| Glucose Level  | 20 pts |
| BMI            | 15 pts |
| Cholesterol    | 15 pts |
| Smoking Status | 10 pts |

**Risk Level Thresholds:**

| Score    | Level    |
| -------- | -------- |
| 0 – 24   | LOW      |
| 25 – 49  | MODERATE |
| 50 – 74  | HIGH     |
| 75 – 100 | CRITICAL |

### Idempotency

Every assessment request requires an `idempotencyKey`. Duplicate requests with the same key:

- While in-flight → HTTP 409
- After completion → HTTP 200 with cached result (no re-execution)

### Caching

Redis cache-aside pattern with 5-minute TTL on:

- `assessments:{patientId}` — paginated assessment lists
- `reports:{patientId}` — paginated report lists

Cache is invalidated automatically after each completed assessment pipeline.

### Resilience

- **Circuit breaker** on ExternalKnowledgeService: opens after 5 failures, recovers after 30s
- **Retry with backoff**: 2 retries with 200ms/400ms exponential backoff on HTTP failures
- **Timeout**: 5s per external HTTP request via `AbortController`
- **Redis graceful degradation**: app continues running if Redis is unavailable; falls back to in-memory rate limiting and skips caching

### Observability

- Structured JSON logging via Pino (every request, pipeline stage, error)
- `X-Correlation-ID` header on every request/response
- Request latency logging; slow requests (>1s) flagged as warnings
- Audit log on every patient data access (actorId, actorRole, action, patientId)
- Sensitive fields (`password`, `accessToken`, `refreshToken`) redacted from all logs

---

## API Reference

All application routes are versioned under `/api/v1`. Infrastructure endpoints are unversioned.

### Infrastructure

| Method | Path              | Description                              |
| ------ | ----------------- | ---------------------------------------- |
| GET    | `/health`         | Liveness + readiness (DB + Redis checks) |
| GET    | `/health/metrics` | Process memory, uptime, PID              |

### Auth

| Method | Path                   | Body                  | Description                        |
| ------ | ---------------------- | --------------------- | ---------------------------------- |
| POST   | `/api/v1/auth/login`   | `{ email, password }` | Login, returns JWT + refresh token |
| POST   | `/api/v1/auth/refresh` | `{ refreshToken }`    | Rotate refresh token               |
| POST   | `/api/v1/auth/logout`  | `{ refreshToken }`    | Invalidate refresh token           |

### Patients

| Method | Path                   | Auth             | Description                                                  |
| ------ | ---------------------- | ---------------- | ------------------------------------------------------------ |
| POST   | `/api/v1/patients`     | HEALTHCARE_STAFF | Register patient (creates User + Patient in one transaction) |
| GET    | `/api/v1/patients/:id` | Any              | Get patient by patientId                                     |

### Clinical Data

| Method | Path                    | Auth             | Description                           |
| ------ | ----------------------- | ---------------- | ------------------------------------- |
| POST   | `/api/v1/clinical-data` | HEALTHCARE_STAFF | Upload clinical metrics for a patient |

### Assessments

| Method | Path                             | Auth             | Query Params                           | Description                       |
| ------ | -------------------------------- | ---------------- | -------------------------------------- | --------------------------------- |
| POST   | `/api/v1/assessment/run`         | HEALTHCARE_STAFF | —                                      | Trigger async assessment pipeline |
| GET    | `/api/v1/assessments/:patientId` | Any              | `page`, `limit`, `sortOrder`, `status` | List assessments (paginated)      |
| GET    | `/api/v1/jobs/:jobId`            | Any              | —                                      | Get async job status + result     |

### Reports

| Method | Path                         | Auth | Query Params                 | Description                     |
| ------ | ---------------------------- | ---- | ---------------------------- | ------------------------------- |
| GET    | `/api/v1/reports/:patientId` | Any  | `page`, `limit`, `sortOrder` | List health reports (paginated) |

#### Pagination response format

```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3,
    "hasNext": true,
    "hasPrev": false
  }
}
```

---

## Database Schema

7 tables with full FK constraints, cascade deletes, and soft-delete support:

| Table                 | Description                                                                            |
| --------------------- | -------------------------------------------------------------------------------------- |
| `users`               | All users (staff + patients). Soft-delete via `deleted_at`.                            |
| `patients`            | Patient profile linked to a user. Soft-delete cascades to clinical data + assessments. |
| `clinical_data`       | Clinical metrics (JSONB). One record per upload.                                       |
| `risk_assessments`    | Assessment results with `riskScore`, `riskLevel`, `status`.                            |
| `health_reports`      | Generated reports with `summary`, `recommendations[]`, `version`.                      |
| `refresh_tokens`      | Refresh token store with `family_id` for reuse detection.                              |
| `idempotency_records` | Idempotency key store for deduplication.                                               |

---

## Frontend

### Role-Based UI

The login page asks whether you are **Healthcare Staff** or a **Patient** before showing credentials. Clicking a name auto-fills the email and password.

**Staff view** (`/dashboard`):

- Patient switcher showing only the doctor's assigned patients
- Click any patient → loads their risk score gauge, score history bar chart, latest health report
- Assessments page with pagination and status filter
- Reports page with expandable recommendations
- Run Assessment page with async job polling and result display

**Patient view** (`/my-health`):

- Personal risk score with colour-coded gauge
- Score trend area chart across all assessments
- Personalised improvement plan (4–5 actionable tips based on risk level)
- Latest report from their specific doctor with recommendations
- Full assessment history with progress bars
- My Assessments and My Reports pages (own data only — 403 if attempting to access another patient)

---

## Local Setup

### Prerequisites

- Node.js 18+
- PostgreSQL 15+
- Redis (or Upstash free tier)

### 1. Clone and install backend

```bash
git clone https://github.com/dev-singh12/Patient_health_risk_assessment.git
cd Patient_health_risk_assessment
npm install
```

### 2. Configure environment

```bash
cp .env.example .env   # or edit .env directly
```

Required variables:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/health_risk_db
REDIS_URL=redis://localhost:6379
JWT_SECRET=<run: openssl rand -hex 64>
NODE_ENV=development
```

### 3. Push database schema

```bash
npm run db:push
```

### 4. Seed demo data

```bash
npm run db:seed
```

### 5. Start backend

```bash
npm run dev
# → http://localhost:3000
```

### 6. Start frontend

```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

---

## Demo Credentials

### Healthcare Staff

| Name              | Email                 | Password     | Patients               |
| ----------------- | --------------------- | ------------ | ---------------------- |
| Dr. Sarah Collins | `staff2@hospital.com` | `Staff2@123` | Charlie, Diana, Fatima |
| Dr. Brian Patel   | `staff1@hospital.com` | `Staff@123`  | Edward, George         |

### Patients

| Name    | Email                 | Password      | Doctor            | Risk Level           |
| ------- | --------------------- | ------------- | ----------------- | -------------------- |
| Charlie | `charlie@patient.com` | `Charlie@123` | Dr. Sarah Collins | LOW                  |
| Diana   | `diana@patient.com`   | `Diana@123`   | Dr. Sarah Collins | MODERATE             |
| Edward  | `edward@patient.com`  | `Edward@123`  | Dr. Brian Patel   | HIGH                 |
| Fatima  | `fatima@patient.com`  | `Fatima@123`  | Dr. Sarah Collins | CRITICAL             |
| George  | `george@patient.com`  | `George@123`  | Dr. Brian Patel   | MODERATE (improving) |

---

## Build for Production

```bash
# Backend
npm run build        # TypeScript → dist/
npm start            # node dist/server.js

# Frontend
cd frontend
npm run build        # Vite → frontend/dist/
```

---

## Testing

```bash
npm run test:unit          # Risk Engine + Orchestrator unit tests (no DB needed)
npm run test:integration   # Full API tests (requires DATABASE_URL + REDIS_URL)
npm run typecheck          # TypeScript type check only
```

---

## Database Commands

```bash
npm run db:push       # Apply schema to DB (dev / first deploy)
npm run db:generate   # Generate migration files from schema changes
npm run db:migrate    # Apply pending migrations
npm run db:seed       # Insert demo data
npm run db:studio     # Open Drizzle Studio (visual DB browser)
```

---

## Deployment on Render

### Manual (free tier)

1. Create a **PostgreSQL** database on Render → copy Internal Database URL
2. Create a **Redis** instance on [Upstash](https://upstash.com) (free) → copy Redis URL (`rediss://...`)
3. Create a **Web Service** on Render:
   - **Build Command**: `npm ci && npm run build && npm run db:push`
   - **Start Command**: `npm start`
   - **Health Check Path**: `/health`
4. Set environment variables (see `.env.example`)
5. Set `JWT_SECRET` manually: `openssl rand -hex 64`

### Environment Variables on Render

| Variable       | Source                                         |
| -------------- | ---------------------------------------------- |
| `DATABASE_URL` | Render PostgreSQL → Internal Connection String |
| `REDIS_URL`    | Upstash → Redis URL (`rediss://...`)           |
| `JWT_SECRET`   | Generate with `openssl rand -hex 64`           |
| `NODE_ENV`     | `production`                                   |
| `PORT`         | Injected automatically by Render — do not set  |

---

## Project Structure

```
├── src/
│   ├── config/          # DB (Drizzle), Redis, BullMQ, Pino logger, env validation
│   ├── controllers/     # Express route handlers (auth, patient, clinical-data, assessment, report, health, jobs)
│   ├── db/              # Drizzle schema + seed script
│   ├── dtos/            # Zod request/response schemas
│   ├── errors/          # Typed error hierarchy (AppError → ValidationError, PipelineError, etc.)
│   ├── jobs/            # BullMQ job definitions + worker factory
│   ├── middleware/       # correlationId, requestLogger, rateLimiter, auth, rbac, validate, auditLog, errorHandler
│   ├── models/          # Domain type definitions (independent of ORM)
│   ├── repositories/    # Data access layer (Drizzle queries, soft-delete, pagination)
│   ├── routes/          # Express router with /api/v1 versioning
│   ├── services/
│   │   ├── domain/      # AuthService, RiskService, ReportService, RecommendationService
│   │   ├── knowledge/   # IKnowledgeService + Mock + External (circuit breaker)
│   │   ├── ml/          # Pure-function risk engine + weight constants
│   │   └── orchestrator/ # HealthAssessmentOrchestrator (atomic pipeline)
│   ├── tests/
│   │   ├── unit/        # Risk Engine + Orchestrator unit tests (Jest)
│   │   ├── integration/ # Supertest API integration tests
│   │   └── e2e/         # Cypress end-to-end tests
│   ├── types/           # Express Request type augmentation
│   ├── utils/           # Pagination helpers
│   ├── app.ts           # Express app factory + middleware stack
│   └── server.ts        # HTTP server + BullMQ worker bootstrap + graceful shutdown
│
├── frontend/
│   ├── src/
│   │   ├── components/  # Card, Spinner, RiskBadge, StatusBadge, Pagination, EmptyState, ErrorMessage
│   │   ├── data/        # seedData.js — single source of truth for demo credentials + patientIds
│   │   ├── hooks/       # useAuth, usePagination
│   │   ├── layouts/     # Sidebar layout (role-aware navigation)
│   │   ├── pages/       # LoginPage, DashboardPage, AssessmentsPage, ReportsPage,
│   │   │                #   RunAssessmentPage, PatientDashboardPage, MyAssessmentsPage, MyReportsPage
│   │   ├── services/    # Axios API client with JWT interceptor + 401 redirect
│   │   ├── App.jsx      # Router with role-based redirects
│   │   └── main.jsx     # React entry point
│   ├── vite.config.js   # Vite + proxy to backend
│   └── tailwind.config.js
│
├── drizzle.config.ts    # Drizzle Kit configuration
├── jest.config.ts       # Jest test configuration
├── render.yaml          # Render deployment blueprint
├── package.json
├── tsconfig.json
├── .env                 # Local environment variables (gitignored)
├── .gitignore
└── README.md
```

---

## Author

Dev Kumar Singh
