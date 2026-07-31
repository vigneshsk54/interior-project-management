# Atelier Flow

Atelier Flow is a full-stack interior project management and automation platform for
studios that want one operational system from first enquiry through design, execution,
commercial closure, and handover.

The repository contains a working React application, FastAPI API, PostgreSQL schema,
role-based portals, five importable n8n workflows, Docker infrastructure, tests, and
production proxy configuration.

## Product capabilities

- Executive dashboard with pipeline, revenue, risk, approvals, workload, and deadlines
- CRM with searchable table and Kanban views, assignment, activity history, bulk updates,
  site-visit coordination, and customer conversion
- Versioned quotation builder with line-level tax/margin, approval, and automatic project
  conversion
- Projects with stage, health, progress, milestones, tasks, designs, documents, budgets,
  and activity views
- Task boards, personal work queue, priorities, deadlines, capacity fields, and reminders
- Design review and client approvals, procurement, vendors, material inventory, site
  reports, payments, documents, reports, notifications, and admin settings
- Restricted client and vendor portals
- Shared enquiry conversations with immediate client/team acknowledgements and
  ownership-targeted questions and replies
- Read-only team enquiry access with status-only updates, admin-only full editing, and a
  private per-user activity profile for attributed messages and operational changes
- Shared client/admin messages in both My activity pages with Open, In progress, and
  Completed status tracking and counterpart notifications
- JWT access/rotating refresh tokens, Argon2 password hashes, permission checks, audit
  trails, upload validation, webhook HMAC signatures, and idempotency
- n8n automations for enquiries, quotation approval, task deadlines, payment reminders,
  and design approval reminders

## Architecture

```text
Browser
  │
  ▼
Nginx :80
  ├── /             React production build
  ├── /api/*        FastAPI
  └── /n8n/*        n8n editor and webhooks
                        │
              ┌─────────┴─────────┐
              ▼                   ▼
         PostgreSQL           SMTP / external
         source of truth      notification services
```

The frontend uses feature-oriented pages and shared primitives. The backend separates
configuration, API dependencies, Pydantic contracts, SQLAlchemy models, and domain
services. Operational modules use a typed ledger for common lifecycle fields while core
CRM, design, commercial, delivery, identity, documents, and automation records remain
normalized.

## Stack

- React 19, TypeScript, Vite, Tailwind CSS, TanStack Query, React Hook Form, Zod,
  Recharts, and Lucide
- FastAPI, Python 3.12, SQLAlchemy 2, Alembic, Pydantic, PostgreSQL, PyJWT, and Argon2
- n8n, Docker Compose, Nginx, optional Redis, and GitHub Actions

## Repository

```text
frontend/              React application and component tests
backend/               FastAPI application, models, migrations, and API tests
n8n/workflows/         Importable workflow JSON exports
n8n/documentation/     Automation setup guide
nginx/                 Edge reverse proxy
docs/                  API, entities, webhook examples, deployment checklist
scripts/               Local helper scripts
.github/workflows/     CI
docker-compose.yml     Complete local stack
```

## Quick start with Docker

Requirements: Docker Desktop with Compose v2.

```bash
cp .env.example .env
# Replace development secrets and set INITIAL_ADMIN_EMAIL / INITIAL_ADMIN_PASSWORD
docker compose up --build
```

The backend runs migrations, copies any legacy SQL password hashes into MongoDB, and
creates the configured initial administrator if that email does not already exist. Login
IDs and Argon2 password hashes are persisted in the `mongodb_data` volume; plaintext
passwords are never stored in the database.

- Application: <http://localhost>
- API documentation: <http://localhost/api/docs>
- Alternative API schema: <http://localhost/api/redoc>
- n8n: <http://localhost/n8n/>
- Health check: <http://localhost/health> (direct backend: `localhost:8000/health`)

To stop services:

```bash
docker compose down
```

Add `-v` only when intentionally deleting PostgreSQL, MongoDB credentials, n8n, Redis,
and upload volumes.

## Local development

### API

Use Python 3.12 or newer.

```bash
python3.12 -m venv .venv
source .venv/bin/activate
pip install -e "backend[dev]"
export DATABASE_URL=sqlite:///./atelier_flow.db
export MONGODB_URL=mongodb://localhost:27017
export MONGODB_DATABASE=atelier_flow
export INITIAL_ADMIN_EMAIL=admin@yourcompany.com
export INITIAL_ADMIN_PASSWORD='use-a-long-unique-password'
cd backend
alembic upgrade head
python -m app.migrate_credentials
python -m app.bootstrap_admin
uvicorn app.main:app --reload
```

MongoDB must be running before starting the API. For PostgreSQL, set `DATABASE_URL` to a
`postgresql+psycopg://` URL.

### Web

```bash
cd frontend
npm install
npm run dev
```

Vite proxies `/api` and `/uploads` to `http://localhost:8000`.

## Database migrations

```bash
cd backend
alembic upgrade head
alembic revision --autogenerate -m "describe change"
```

Business records are created only through authenticated application and API actions.

## Tests and quality checks

```bash
make backend-test
make frontend-test
make lint
make build
```

Backend tests cover login, token rotation, permissions, quotation math, signed/idempotent
webhooks, and the complete enquiry → quotation → approval → project → initial tasks flow.
Frontend tests cover validation and status-based rendering. CI repeats these checks on
every push and pull request.

## n8n

Import these files from `n8n/workflows/`:

1. `01-new-enquiry.json`
2. `02-quotation-approval.json`
3. `03-task-deadline-reminders.json`
4. `04-payment-reminders.json`
5. `05-design-approval-reminders.json`

Full configuration instructions are in
[n8n/documentation/SETUP.md](n8n/documentation/SETUP.md). Workflow callbacks are stored
in `workflow_executions`; inbound idempotency is stored in `webhook_events`.

## Environment variables

| Variable | Purpose |
|---|---|
| `SECRET_KEY` | JWT signing key; use at least 32 random bytes |
| `DATABASE_URL` | SQLAlchemy database URL |
| `MONGODB_URL` | MongoDB connection URL used for login credentials |
| `MONGODB_DATABASE` | MongoDB database containing the `credentials` collection |
| `MONGODB_TIMEOUT_MS` | MongoDB connection timeout in milliseconds |
| `CORS_ORIGINS` | Comma-separated allowed browser origins |
| `ACCESS_TOKEN_MINUTES` | Short-lived access-token duration |
| `REFRESH_TOKEN_DAYS` | Refresh-token duration |
| `INITIAL_ADMIN_EMAIL` | Real administrator email created once when the backend starts |
| `INITIAL_ADMIN_PASSWORD` | Initial administrator password; minimum 12 characters |
| `INITIAL_ADMIN_NAME` | Initial administrator display name |
| `N8N_WEBHOOK_SECRET` | HMAC-SHA256 callback secret |
| `N8N_ENCRYPTION_KEY` | n8n credential encryption key |
| `VITE_API_URL` | Browser API prefix |

Never commit `.env`. Production secrets should come from a secret manager.

## API and data documentation

- Interactive OpenAPI: `/api/docs`
- Endpoint guide: [docs/API.md](docs/API.md)
- Entity overview: [docs/DATABASE.md](docs/DATABASE.md)
- Sample callbacks: [docs/WEBHOOKS.md](docs/WEBHOOKS.md)
- Production checks: [docs/DEPLOYMENT_CHECKLIST.md](docs/DEPLOYMENT_CHECKLIST.md)

## Deployment

Build immutable frontend/backend images, run migrations as a release job, place the
stack behind managed TLS, and use managed PostgreSQL with backups and point-in-time
recovery. Set explicit CORS origins, rotate service tokens, configure SMTP credentials in
n8n, and persist uploads in encrypted object storage for multi-instance deployments.

### Vercel

The root `vercel.json` deploys the React frontend and FastAPI backend as one Vercel
project. Configure these variables in Vercel before deploying:

```text
APP_ENV=production
SECRET_KEY=<at-least-32-random-bytes>
DATABASE_URL=<hosted-postgresql-url>
MONGODB_URL=<hosted-mongodb-url>
MONGODB_DATABASE=atelier_flow
CORS_ORIGINS=<production-vercel-or-custom-domain>
INITIAL_ADMIN_EMAIL=<administrator-email>
INITIAL_ADMIN_PASSWORD=<at-least-12-characters>
```

Run the relational migrations, credential migration, and administrator bootstrap once
against the hosted databases before using the production deployment:

```bash
cd backend
alembic upgrade head
python -m app.migrate_credentials
python -m app.bootstrap_admin
```

Vercel Functions have only temporary writable storage. The application uses `/tmp` on
Vercel so requests can complete, but uploaded files must be moved to Vercel Blob or
another durable object store before relying on document persistence in production.

The included Compose file is production-shaped but uses local volumes and development
credentials by default; it is intended for local evaluation and as a deployment
reference.

## Security notes

- Passwords use Argon2; refresh tokens are stored as SHA-256 digests and rotate on use.
- Public registration always creates a client. Only an authenticated administrator can
  create admin or studio-team accounts, and client/workspace logins reject accounts of
  the wrong type. Authorization comes from the stored role, never from the email domain.
- Client project access is matched to the authenticated customer identity; vendor work is
  matched to the authenticated vendor. Client project responses expose progress,
  milestones, completion dates, and shared designs, but not internal budgets, contracts,
  tasks, or operational records.
- ORM queries are parameterized. Mutations are audited. Deletion is soft where recovery
  is operationally valuable.
- Uploads are allow-listed by MIME type, size-limited, and assigned server-generated
  names. Production should additionally scan files and move them to object storage.
- n8n callbacks require a signature over the exact raw request body and an idempotency
  key.

## Screenshots

Run the application and capture the dashboard, CRM Kanban, quotation builder, project
overview, client portal, and vendor portal for deployment or product documentation.

## Assumptions and known limits

- Email nodes ship without provider credentials; SMTP is environment-specific and must be
  configured after importing workflows.
- PDF/CSV buttons and visual file-preview shells are present, while production-grade
  rendering/storage integrations are intentionally provider-neutral.
- Dashboard metrics and trends are calculated from the application database; empty
  workspaces display zero values rather than sample figures.
- The web build currently emits a non-blocking large-chunk warning; route-level lazy
  loading is the next optimization for very slow networks.
- npm currently reports the React Router RSC-action advisory against the router bundled
  by `react-router-dom@7.18.1`. This application is a client-only SPA and does not enable
  RSC actions or server hydration, so the affected execution path is absent. Upgrade when
  React Router DOM publishes a compatible release using the patched Router 8.3 line.
# interior-project-management
