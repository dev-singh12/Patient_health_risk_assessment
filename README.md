# Patient Health Risk Assessment System

A production-grade REST API backend that automates the end-to-end clinical workflow: ingesting patient and clinical data, running a weighted ML risk engine, generating structured health reports, and attaching evidence-based recommendations.

---

## Tech Stack

| Layer               | Technology                            |
| ------------------- | ------------------------------------- |
| Runtime             | Node.js 18+                           |
| Language            | TypeScript 5                          |
| Framework           | Express 4                             |
| ORM                 | Drizzle ORM                           |
| Database            | PostgreSQL 15+                        |
| Cache / Queue store | Redis 7+                              |
| Background jobs     | BullMQ                                |
| Auth                | JWT (access + refresh token rotation) |
| Validation          | Zod                                   |
| Logging             | Pino (structured JSON)                |
| Testing             | Jest + Supertest                      |

---

## Architecture

```
HTTP Client
    │
    ▼
Middleware Stack
(correlationId → requestLogger → rateLimiter → auth → rbac → validate)
    │
    ▼
Controller Layer  (/api/v1/*)
    │
    ▼
Orchestrator  (HealthAssessmentOrchestrator)
    │
    ├── Domain Services  (RiskService, ReportService, RecommendationService)
    │       └── ML Risk Engine  (pure function, no side effects)
    │
    ├── Knowledge Service  (MockKnowledgeService | ExternalKnowledgeService)
    │       └── Circuit breaker + retry + timeout
    │
    └── Repository Layer  (Drizzle ORM → PostgreSQL)

Background: BullMQ Worker → Orchestrator (async assessment pipeline)
Cache:      Redis (assessments, reports, idempotency keys, rate limits)
```

---

## API Endpoints

All application routes are versioned under `/api/v1`.

### Auth

| Method | Path                   | Description                        |
| ------ | ---------------------- | ---------------------------------- |
| POST   | `/api/v1/auth/login`   | Login, returns JWT + refresh token |
| POST   | `/api/v1/auth/refresh` | Rotate refresh token               |
| POST   | `/api/v1/auth/logout`  | Invalidate refresh token           |

### Patients

| Method | Path                   | Auth             | Description       |
| ------ | ---------------------- | ---------------- | ----------------- |
| POST   | `/api/v1/patients`     | HEALTHCARE_STAFF | Register patient  |
| GET    | `/api/v1/patients/:id` | Any              | Get patient by ID |

### Clinical Data

| Method | Path                    | Auth             | Description             |
| ------ | ----------------------- | ---------------- | ----------------------- |
| POST   | `/api/v1/clinical-data` | HEALTHCARE_STAFF | Upload clinical metrics |

### Assessments

| Method | Path                             | Auth             | Description                  |
| ------ | -------------------------------- | ---------------- | ---------------------------- |
| POST   | `/api/v1/assessment/run`         | HEALTHCARE_STAFF | Trigger assessment pipeline  |
| GET    | `/api/v1/assessments/:patientId` | Any              | List assessments (paginated) |
| GET    | `/api/v1/jobs/:jobId`            | Any              | Get async job status         |

### Reports

| Method | Path                         | Auth | Description                     |
| ------ | ---------------------------- | ---- | ------------------------------- |
| GET    | `/api/v1/reports/:patientId` | Any  | List health reports (paginated) |

### Infrastructure

| Method | Path              | Description                              |
| ------ | ----------------- | ---------------------------------------- |
| GET    | `/health`         | Liveness + readiness (DB + Redis checks) |
| GET    | `/health/metrics` | Process memory, uptime, PID              |

#### Pagination query params (assessments + reports)

```
?page=1&limit=20&sortOrder=desc&status=COMPLETED
```

---

## Local Setup

### Prerequisites

- Node.js 18+
- PostgreSQL 15+
- Redis 7+

### 1. Clone and install

```bash
git clone <repo-url>
cd patient-health-risk-assessment
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env — set DATABASE_URL, REDIS_URL, JWT_SECRET
```

### 3. Push database schema

```bash
npm run db:push
```

### 4. Seed demo data (optional)

```bash
npm run db:seed
# Creates: 2 staff users, 3 patients, clinical data, assessments, reports
# Staff login:   staff1@hospital.com / Staff@123
# Patient login: patient1@example.com / Patient@123
```

### 5. Run in development

```bash
npm run dev
# Server starts on http://localhost:3000
```

### 6. Verify

```bash
curl http://localhost:3000/health
# {"status":"ok","checks":{"database":{"status":"ok"},"redis":{"status":"ok"}}}
```

---

## Build for Production

```bash
npm run build        # TypeScript → dist/
npm start            # node dist/server.js
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

### Option A — One-click via render.yaml

1. Push this repo to GitHub
2. Go to [render.com](https://render.com) → **New** → **Blueprint**
3. Connect your GitHub repo — Render reads `render.yaml` automatically
4. Set the `JWT_SECRET` environment variable manually in the Render dashboard (marked `sync: false`)
5. Click **Apply** — Render provisions PostgreSQL, Redis, and the web service

### Option B — Manual

1. **Create a PostgreSQL** database on Render → copy the connection string
2. **Create a Redis** instance on Render → copy the connection string
3. **Create a Web Service**:
   - Build command: `npm ci && npm run build && npm run db:push`
   - Start command: `npm start`
   - Health check path: `/health`
4. Set all environment variables from `.env.example`

### Required environment variables on Render

| Variable       | Where to get it                       |
| -------------- | ------------------------------------- |
| `DATABASE_URL` | Render PostgreSQL → Connection String |
| `REDIS_URL`    | Render Redis → Connection String      |
| `JWT_SECRET`   | Generate: `openssl rand -hex 64`      |
| `NODE_ENV`     | `production`                          |
| `PORT`         | Set automatically by Render           |

---

## Project Structure

```
├── src/
│   ├── config/          # DB, Redis, BullMQ, logger, env validation
│   ├── controllers/     # Express route handlers
│   ├── db/              # Drizzle schema + seed script
│   ├── dtos/            # Zod request/response schemas
│   ├── errors/          # Typed error hierarchy
│   ├── jobs/            # BullMQ job definitions + worker
│   ├── middleware/       # Auth, RBAC, validation, rate limiter, audit log
│   ├── models/          # Domain type definitions
│   ├── repositories/    # Data access layer (Drizzle queries)
│   ├── routes/          # Express router (API versioning)
│   ├── services/
│   │   ├── domain/      # Auth, Risk, Report, Recommendation services
│   │   ├── knowledge/   # External knowledge service + circuit breaker
│   │   ├── ml/          # Pure-function risk engine + weights
│   │   └── orchestrator/ # HealthAssessmentOrchestrator
│   ├── tests/
│   │   ├── unit/        # Risk Engine + Orchestrator unit tests
│   │   ├── integration/ # Supertest API integration tests
│   │   └── e2e/         # Cypress end-to-end tests
│   ├── types/           # Express type augmentation
│   ├── utils/           # Pagination helpers
│   ├── app.ts           # Express app factory
│   └── server.ts        # HTTP server + worker bootstrap
├── drizzle/             # Generated migration files
├── drizzle.config.ts    # Drizzle Kit configuration
├── jest.config.ts       # Jest test configuration
├── tsconfig.json        # TypeScript configuration
├── package.json
├── .env.example         # Environment variable template
├── .gitignore
├── render.yaml          # Render deployment blueprint
└── README.md
```

---

## Risk Level Thresholds

| Score    | Level    |
| -------- | -------- |
| 0 – 24   | LOW      |
| 25 – 49  | MODERATE |
| 50 – 74  | HIGH     |
| 75 – 100 | CRITICAL |

---

## Author

Dev Kumar Singh
