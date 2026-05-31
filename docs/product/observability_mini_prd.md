# Technical Specification & Mini-PRD: Enterprise-Grade Observability Stack

**Status**: Proposal | **Version**: 1.0 | **Owner**: @product-manager | **Date**: 2026-05-31
**Strategic Alignment**: Service Reliability (SLO/SLA), Traceability, Incident Resolution Velocity (MTTR reduction), Operational Compliance.

---

> [!IMPORTANT]
> This mini-PRD details the functional requirements, API contracts, acceptance criteria, and quality validation gates for integrating the **Enterprise-Grade Observability Stack & Local Service Infrastructure** into the Kanbrio monorepo. This plan aligns directly with the architectural patterns detailed in `docs/architecture/observability_stack.md`.

---

## 👥 1. Personas & JTBD User Stories

We design our observability features around three critical operational personas:

### 1.1 The Incident Responder ("The Alerted SRE")
*   **Core Need**: High-fidelity operational awareness. Needs to verify overall database pool health, backend request rates, error spikes, and container statuses in a single unified view.
*   **Pain Point**: Vague errors, hidden database pool starvation, and silent application crashes that are only detected when clients report downtime.
*   **JTBD User Story**:
    *   *US-OBS-1*: When an alert is triggered in production, I want to inspect a centralized Grafana dashboard displaying container health, active SQLx connection counts, HTTP request rates, and error rate percentages, so that I can isolate the malfunctioning layer in under 60 seconds.

### 1.2 The Code Debugger ("The Backend Developer")
*   **Core Need**: Fine-grained trace mapping of distributed transactions. Wants to trace a single client action (e.g., card movement) from the browser, through the Axum API gateway, down to the exact SQLx statement executed on Postgres.
*   **Pain Point**: Trying to debug complex async timing issues, slow DB transactions, or deadlock conditions by manually writing debug print statements in development.
*   **JTBD User Story**:
    *   *US-OBS-2*: When a specific board transaction experiences high latency, I want to search for its unique trace parent in Jaeger and view a visual timeline of all internal function calls and SQL queries, so that I can pin down the exact line of code causing the delay.

### 1.3 The Platform Engineer ("The Systems Architect")
*   **Core Need**: Predictable container state machines and automated health checks. Needs standard metrics endpoints for Prometheus scraping and highly detailed JSON `/api/observability/health` routes for container orchestration.
*   **Pain Point**: Containers reporting as "healthy" (HTTP status 200 on an index page) when their underlying database connections are completely dead or saturated.
*   **JTBD User Story**:
    *   *US-OBS-3*: When Docker Compose initializes the stack, I want the API service to wait for the Postgres container's health checks, and expose a `/api/observability/health` endpoint verifying active database connectivity, so that we prevent dead containers from receiving traffic.

---

## ⚙️ 2. Numbered Functional Requirements (FR)

### 2.1 Health & Metrics API Endpoints (Rust/Axum)
*   **FR-OBS-10 (Deep Health Endpoint)**:
    *   The API must expose a public route `GET /api/observability/health`.
    *   This route must perform an active check on the database (e.g., executing `SELECT 1`).
    *   It must return the database status, active connection count, current memory usage, and application uptime in a structured JSON body.
    *   If database connectivity is offline, it must return an HTTP `503 Service Unavailable` status with a detailed error structure.
*   **FR-OBS-11 (Metrics Endpoint)**:
    *   The API must expose a route `GET /api/observability/metrics` (or `/metrics`).
    *   This route must return metrics in the standard Prometheus exposition text format.
    *   It must expose default HTTP RED metrics (`http_requests_total`, `http_request_duration_seconds`), database pool metrics (`db_pool_connections_active`), and system memory stats.

### 2.2 Trace Ingestion & Propagation (OpenTelemetry)
*   **FR-OBS-12 (OTEL Exporter Connection)**:
    *   The Rust Axum application must initialize the OpenTelemetry tracing provider upon startup under production profiles.
    *   It must export tracing data using the OpenTelemetry Protocol (OTLP) over gRPC to `http://kanbrio-jaeger:4317` (configured dynamically via `OTEL_EXPORTER_OTLP_ENDPOINT`).
*   **FR-OBS-13 (Span Hierarchy & Context Correlation)**:
    *   Every incoming API request must register a unique HTTP span containing semantic attributes (method, URI, status code).
    *   Every database query executed through SQLx within that request's context must register as a child span of the active HTTP span.
    *   The unique `trace_id` must be injected into all corresponding application log statements written to stdout.

### 2.3 Docker Compose Multi-Service Infrastructure
*   **FR-OBS-14 (Isolated Network Architecture)**:
    *   All containers must reside inside a dedicated bridge network `kanbrio-network`.
    *   `postgres`, `prometheus`, and `loki` must not bind ports to the host system directly.
*   **FR-OBS-15 (Service Start Order & Healthchecks)**:
    *   `kanbrio-postgres` must define a local healthcheck using `pg_isready`.
    *   `kanbrio-api` must define a startup dependency `depends_on` indicating that `kanbrio-postgres` is `service_healthy`.
*   **FR-OBS-16 (Resource Quotas & Logging Safety)**:
    *   SRE CPU and memory allocation limits (max 256MB memory for Prometheus/Loki; max 128MB for Jaeger/Grafana) must be enforced.
    *   Stdout logs of all containers must be managed via the Docker logging driver, limited to 10MB file sizes and capped at 3 rotated logs per service.

---

## 🌐 3. REST API Contracts

### 3.1 Route 1: Deep Health Check
*   **Method**: `GET`
*   **Path**: `/api/observability/health`
*   **Success Response (HTTP `200 OK`)**:
    *   **Body Schema (JSON)**:
```json
{
  "status": "healthy",
  "uptime_seconds": 12805,
  "database": {
    "status": "connected",
    "active_connections": 3,
    "idle_connections": 2,
    "max_connections": 5
  },
  "system": {
    "memory_used_bytes": 15420120,
    "cpu_usage_percent": 1.2
  }
}
```
*   **Failure Response (HTTP `503 Service Unavailable`)**:
    *   **Trigger**: Database offline or connection pool exhausted.
    *   **Body Schema (JSON)**:
```json
{
  "status": "unhealthy",
  "error": "Database connection verification failed: pool timed out",
  "database": {
    "status": "disconnected"
  }
}
```

### 3.2 Route 2: Prometheus Metrics Scraping
*   **Method**: `GET`
*   **Path**: `/api/observability/metrics`
*   **Success Response (HTTP `200 OK`)**:
    *   **Content-Type**: `text/plain; version=0.0.4; charset=utf-8`
    *   **Sample Body Payload**:
```text
# HELP http_requests_total Total number of HTTP requests processed
# TYPE http_requests_total counter
http_requests_total{method="POST",route="/api/workspaces/:workspace_id/cards",status="201"} 14
http_requests_total{method="GET",route="/api/observability/health",status="200"} 256

# HELP http_request_duration_seconds HTTP request execution latency in seconds
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{method="POST",route="/api/workspaces/:workspace_id/cards",le="0.005"} 12
http_request_duration_seconds_bucket{method="POST",route="/api/workspaces/:workspace_id/cards",le="0.01"} 14
http_request_duration_seconds_count{method="POST",route="/api/workspaces/:workspace_id/cards"} 14

# HELP db_pool_connections_active Active database connection pool count
# TYPE db_pool_connections_active gauge
db_pool_connections_active 3
```

---

## 🧪 4. TDD & Quality Validation Strategy

### 4.1 Rust Integration Tests (`apps/api/tests/observability_api_tests.rs`)
To ensure high reliability of our health metrics, we enforce TDD integration tests:
1.  **Test Case 1: Healthy Endpoint Status**:
    *   Initialize a mock SQLx connection pool.
    *   Invoke the `GET /api/observability/health` handler directly.
    *   Assert that the HTTP status is `200 OK` and the returned payload matches the success schema.
2.  **Test Case 2: Unhealthy Endpoint Status**:
    *   Initialize a disconnected or closed database pool wrapper.
    *   Invoke the `/api/observability/health` handler.
    *   Assert that the HTTP status returns `503 Service Unavailable` and the JSON `status` matches `"unhealthy"`.
3.  **Test Case 3: Metrics Collection**:
    *   Perform a mock POST request to create a workspace to increment HTTP counters.
    *   Invoke `GET /api/observability/metrics`.
    *   Assert that the response contains `http_requests_total` with matching label keys.

### 4.2 Playwright E2E Verification (`apps/e2e/tests/observability.spec.ts`)
1.  **Test Case E2E-1 (Infrastructure Health Verification)**:
    *   The E2E suite triggers a query request to `/api/observability/health` on the local running instance.
    *   Asserts JSON status is `"healthy"`.
2.  **Test Case E2E-2 (Trace ID Propagation Verification)**:
    *   Trigger a card creation request from the Playwright browser context.
    *   Verify that the response headers contain the `traceparent` propagation tag.
    *   Query Jaeger API for that `trace_id` and assert that the HTTP span and its nested child SQLx spans exist in the trace database.

---

## 📊 5. RICE Prioritization & MoSCoW Mapping

| Metric / Feature Component | Reach (1-10) | Impact (0.5-3) | Confidence (50%-100%) | Effort (Person-Weeks) | RICE Score | MoSCoW |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Docker Compose Isolated Networks & Healthchecks** | 10 (Platform) | 2.0 (High safety) | 95% (Compose specs) | 0.3 | **633** | **Must Have** |
| **Rust Axum /health & /metrics API Endpoints** | 10 (SRE) | 2.0 (Incidents) | 90% (Standard Axum) | 0.4 | **450** | **Must Have** |
| **OpenTelemetry Span Propagation & Jaeger Tracing** | 8 (Developers) | 2.5 (High debugging)| 85% (OTel Crates) | 0.6 | **283** | **Must Have** |
| **Structured JSON Logging & Grafana Loki correlation**| 8 (Auditors) | 1.5 (Trace join) | 80% (Fmt filters) | 0.5 | **192** | **Should Have** |
| **Pre-Configured Grafana Incident Dashboard** | 6 (Operations)| 1.5 (Rapid triage)| 80% (Config-JSON) | 0.5 | **144** | **Should Have** |

**Verdict**: The Docker Compose multi-service topology, the Deep Health Check API, and the OpenTelemetry Jaeger trace integration are classified as **Must Haves** for the upcoming implementation cycle. Log correlation to Loki and the Grafana dashboard provisioning will be completed as **Should Haves** in the same milestone.
