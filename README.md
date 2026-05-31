# Multi-Model AI Chat Application

A ChatGPT-style chat app powered by open-source LLMs (Ollama). The system is split across multiple repositories — each service is independent, containerized, and designed to scale.

> Built to demonstrate **system design**, **async processing**, **caching**, **message queues**, and **infrastructure as code** 
---

## Table of Contents

1. [Overview](#overview)
2. [Repositories](#repositories)
3. [Architecture](#architecture)
4. [Tech Stack](#tech-stack)
5. [Features](#features)
6. [Frontend (this repo)](#frontend-this-repo)
7. [Backend Services (other repos)](#backend-services-other-repos)
8. [API Specification](#api-specification)
9. [Data Models](#data-models)
10. [Message Flow](#message-flow)
11. [Getting Started](#getting-started)
12. [Environment Variables](#environment-variables)
13. [Design Decisions](#design-decisions)
14. [Roadmap](#roadmap)

---

## Overview

Users register, log in, create chat sessions, and send messages to open-source models (Llama, Mistral, Gemma, etc.) served by **Ollama**. The UI feels like ChatGPT: a sidebar of conversations and a main chat area.

The backend never blocks on slow inference. Messages are processed **asynchronously** via a task queue. The frontend polls for results until the AI reply is ready.

```
┌─────────────┐     HTTP/JWT      ┌──────────────┐     RabbitMQ     ┌────────────┐     HTTP      ┌────────┐
│   React     │ ◄──────────────► │  API Gateway │ ───────────────► │   Worker   │ ────────────► │ Ollama │
│  Frontend   │   poll task_id   │   (FastAPI)  │                  │            │               │        │
└─────────────┘                  └──────┬───────┘                  └─────┬──────┘               └────────┘
                                        │                                │
                                   Redis (cache)                   PostgreSQL (persist)
```

---

## Repositories

The application is split by concern. Each repo can be developed, tested, and deployed independently.

| Repository | Purpose | Status |
|------------|---------|--------|
| **chat-app-frontend** *(this repo)* | React UI — auth, sessions, chat, admin models | Implemented |
| **chat-app-gateway** | FastAPI API gateway — auth, sessions, enqueue tasks | Planned |
| **chat-app-worker** | Consumes queue, calls Ollama, writes to DB/cache | Planned |
| **chat-app-infra** | Docker Compose, Terraform, Ansible, Kubernetes manifests | Planned |

> Replace the placeholder repo names above with your actual GitHub URLs as you create them.

---

## Architecture

### Components

| Component | Role |
|-----------|------|
| **Frontend** | SPA served by Vite. Stores JWT in `localStorage`. Polls task status after sending a message. |
| **Nginx** | Reverse proxy and load balancer in front of gateway replicas. |
| **API Gateway** | Validates JWT, CRUD for users/sessions/messages, enqueues inference tasks, serves cached history. |
| **RabbitMQ** | Task queue (`chat_tasks`) with dead-letter queue for failed jobs. |
| **Worker** | Picks tasks, loads context from Redis/PostgreSQL, calls Ollama, persists results. |
| **Redis** | Recent messages (last 50 per session), task status, model config cache. |
| **PostgreSQL** | Users, sessions, full message history, model configuration. |
| **Ollama** | Runs open-source models locally via HTTP API. |

### System Design Principles

| Principle | How it is applied |
|-----------|-------------------|
| Separation of concerns | Gateway, worker, queue, cache, and DB are separate services. |
| Async processing | Gateway returns `task_id` immediately; worker handles inference. |
| Idempotency | Each task has a unique ID; status stored in Redis. |
| Caching | Redis holds recent messages for fast reads; PostgreSQL is source of truth. |
| Load leveling | Queue absorbs traffic spikes so Ollama is not overwhelmed. |
| Graceful degradation | If PostgreSQL is slow, serve recent history from Redis. |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, Vite, React Router |
| Reverse proxy | Nginx |
| API gateway | FastAPI (Python) |
| Message queue | RabbitMQ |
| Cache | Redis |
| Database | PostgreSQL |
| AI inference | Ollama |
| Orchestration | Kubernetes (Grid'5000) |
| Infrastructure | Terraform + Ansible |
| CI/CD | GitHub Actions |
| Observability | Prometheus, Grafana, Jaeger |

---

## Features

### User

- Register and log in (JWT)
- Create and switch between chat sessions
- View conversation history
- Send a message and receive an AI reply (async, via polling)
- ChatGPT-like interface (sidebar + main chat area)

### Admin

- List available Ollama models (`GET /models`)
- Clear user cache (internal endpoint)

### System (backend)

- Recent history cached in Redis (last 50 messages per session)
- Full history persisted in PostgreSQL
- Multiple Ollama models supported
- Retries with exponential backoff; failed tasks go to DLQ
- Structured logs, metrics, distributed tracing (planned)

---

## Frontend (this repo)

### Project structure

```
src/
├── api/
│   └── client.js              # All HTTP calls to the backend
├── context/
│   └── AuthContext.jsx        # Auth state, JWT in localStorage
├── components/
│   ├── Sidebar.jsx            # Session list, new chat, logout
│   ├── MessageList.jsx        # Renders user/assistant messages
│   ├── MessageInput.jsx       # Text input + send button
│   └── ProtectedRoute.jsx     # Redirects unauthenticated users
├── pages/
│   ├── LoginPage.jsx
│   ├── RegisterPage.jsx
│   ├── ChatPage.jsx           # Main chat logic (sessions + polling)
│   └── AdminPage.jsx          # Lists Ollama models (admin only)
├── App.jsx                    # Routes
├── main.jsx
└── index.css                  # ChatGPT-style layout and theme
```

### Routes

| Path | Page | Access |
|------|------|--------|
| `/login` | Sign in | Public |
| `/register` | Create account | Public |
| `/` | Chat | Authenticated |
| `/admin` | Ollama models list | Admin only |

### Key frontend behaviour

1. **Auth** — On login, JWT is saved to `localStorage` and sent as `Authorization: Bearer <token>` on every request.
2. **Sessions** — Sidebar loads sessions from `GET /sessions`. "New chat" calls `POST /sessions`.
3. **Messages** — Selecting a session loads `GET /sessions/{id}/messages`.
4. **Send** — `POST /sessions/{id}/messages` returns `{ task_id }`. The app polls `GET /tasks/{task_id}/status` every 1.5 s until `status` is `completed` or `failed`.
5. **Admin** — The "Models" link appears only when the login response includes `is_admin: true`.

### Expected API response shapes

The frontend expects these JSON shapes from the gateway:

```jsonc
// POST /auth/login
{ "access_token": "...", "is_admin": false }

// GET /sessions
[{ "session_id": "uuid", "title": "New chat", "created_at": "..." }]

// GET /sessions/{id}/messages
[{ "message_id": "uuid", "role": "user", "content": "Hello" }]

// POST /sessions/{id}/messages
{ "task_id": "uuid" }

// GET /tasks/{id}/status
{ "status": "pending" | "completed" | "failed", "result": "...", "error": "..." }

// GET /models
["llama3", "mistral"]   // or { "models": [...] }
```

---

## Backend Services (other repos)

These are not in this repository. Documented here so frontend and backend stay aligned.

### API Gateway (`chat-app-gateway`)

- JWT authentication (register, login)
- Session and message CRUD
- Enqueue inference tasks to RabbitMQ
- Return `task_id` immediately (`202 Accepted`)
- Serve task status from Redis
- Read recent messages from Redis, full history from PostgreSQL
- Expose `GET /models` for admin

### Worker (`chat-app-worker`)

- Consume messages from `chat_tasks` queue
- Load conversation context (Redis → PostgreSQL fallback)
- Call Ollama generate endpoint
- Write user + assistant messages to PostgreSQL
- Update Redis cache and task status
- Retry on failure (max 3), then move to `chat_tasks.dlq`

### Infrastructure (`chat-app-infra`)

- `docker-compose.yml` for local dev (all services)
- Terraform for VM provisioning (Grid'5000)
- Ansible for Kubernetes setup
- K8s manifests for gateway, worker, Redis, RabbitMQ, PostgreSQL
- GitHub Actions: build images, push to registry, deploy

---

## API Specification

All authenticated endpoints require: `Authorization: Bearer <jwt>`

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/auth/register` | Create a new user `{ username, password }` |
| `POST` | `/auth/login` | Returns `{ access_token, is_admin? }` |

### Chat sessions

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/sessions` | List sessions for the current user |
| `POST` | `/sessions` | Create session `{ title? }` |
| `GET` | `/sessions/{session_id}/messages` | Full message history |

### Messages (async)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/sessions/{session_id}/messages` | Send message `{ prompt, model }` → `{ task_id }` |
| `GET` | `/tasks/{task_id}/status` | Poll task `{ status, result?, error? }` |

### Admin

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/models` | List available Ollama models |
| `DELETE` | `/admin/clear-cache/{user_id}` | Invalidate user's Redis cache |

---

## Data Models

### PostgreSQL

```sql
CREATE TABLE users (
    user_id         UUID PRIMARY KEY,
    username        TEXT UNIQUE NOT NULL,
    hashed_password TEXT NOT NULL,
    is_admin        BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE chat_sessions (
    session_id  UUID PRIMARY KEY,
    user_id     UUID REFERENCES users(user_id),
    title       TEXT,
    created_at  TIMESTAMP DEFAULT NOW(),
    updated_at  TIMESTAMP
);

CREATE TABLE messages (
    message_id  UUID PRIMARY KEY,
    session_id  UUID REFERENCES chat_sessions(session_id),
    role        TEXT CHECK (role IN ('user', 'assistant')),
    content     TEXT NOT NULL,
    timestamp   TIMESTAMP DEFAULT NOW(),
    token_count INT
);

CREATE TABLE model_configs (
    model_name       TEXT PRIMARY KEY,
    ollama_endpoint  TEXT NOT NULL,
    context_length   INT DEFAULT 4096,
    temperature      FLOAT DEFAULT 0.7
);
```

### Redis keys

| Key pattern | Type | Purpose |
|-------------|------|---------|
| `chat:session:{session_id}:messages` | Sorted set | Last 50 messages (JSON, ordered by timestamp) |
| `task:{task_id}` | Hash | `status`, `result`, `retry_count` |
| `model:{model_name}` | Hash | Cached endpoint and parameters |

### RabbitMQ payload

```json
{
  "task_id": "uuid",
  "session_id": "uuid",
  "user_id": "uuid",
  "prompt": "string",
  "model": "llama3",
  "timestamp": "ISO8601"
}
```

---

## Message Flow

1. User sends a message in the frontend.
2. Gateway validates JWT, creates `task_id`, publishes to RabbitMQ, returns `202 { task_id }`.
3. Frontend polls `GET /tasks/{task_id}/status` every 1–2 seconds.
4. Worker consumes the task:
   - Fetches recent history from Redis (or PostgreSQL on cache miss)
   - Calls Ollama
   - Saves messages to PostgreSQL, updates Redis, sets task status to `completed`
5. Frontend receives the result on the next poll and displays it.

**Caching:** On write, worker updates both PostgreSQL and Redis (write-through). Redis keeps the last 50 messages per session with a 1-hour TTL.

**Queue:** Main queue `chat_tasks` (durable). Failed tasks after 3 retries go to `chat_tasks.dlq`.

---

## Getting Started

### Prerequisites

- Node.js 18+
- Backend gateway running on `http://localhost:8000` (once implemented)

### Frontend setup

```bash
# Clone and install
git clone <this-repo-url>
cd chat-app-frontend
npm install

# Configure environment
cp .env.example .env

# Start dev server (http://localhost:5173)
npm run dev
```

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server with hot reload |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint |

### Connecting to the backend

**Option A — Vite proxy (recommended for local dev)**

Leave `VITE_API_URL` empty in `.env`. Vite proxies `/auth`, `/sessions`, `/tasks`, and `/models` to `localhost:8000` (see `vite.config.js`).

**Option B — Direct URL**

Set in `.env`:

```
VITE_API_URL=http://localhost:8000
```

The backend must allow CORS from the frontend origin.

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | *(empty)* | Backend base URL. Empty = use Vite dev proxy. |

---

## Design Decisions

| Choice | Why |
|--------|-----|
| **FastAPI** | Async I/O, OpenAPI docs, good for gateway workloads. |
| **RabbitMQ over Kafka** | Classic task queue; built-in retries and DLQ. Kafka is better for event streaming, not needed here. |
| **Redis for recent chats** | Sub-ms reads for the last N messages; sorted sets preserve order. |
| **PostgreSQL** | ACID, relational schema fits users/sessions/messages. |
| **Ollama** | Simple to deploy, many open-source models, HTTP API. |
| **Polling over WebSocket** | Simpler frontend; streaming can be added later. |
| **Multi-repo** | Each service has its own lifecycle, CI, and deployment. |

---

## Roadmap

- [x] Frontend: auth, sessions, chat UI, task polling, admin models page
- [ ] API gateway (FastAPI)
- [ ] Worker service
- [ ] Docker Compose for local full stack
- [ ] WebSocket / SSE for streaming responses
- [ ] Model selector in chat UI
- [ ] Kubernetes deployment on Grid'5000
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Observability (Prometheus, Grafana, Jaeger)

---

## License

MIT *(or your chosen license)*
