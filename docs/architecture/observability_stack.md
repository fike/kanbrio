# Architecture Design: Enterprise-Grade Observability Stack & Docker Compose Infrastructure

**Status**: Proposal | **Version**: 1.0 | **Date**: 2026-05-31
**Authors**: @architect, @sre, @security

---

## 1. Executive Summary & Strategic Rationale

As Kanbrio moves toward an enterprise-ready self-hosted and cloud-deployable platform, observability changes from a "nice-to-have" to an operational necessity. Enterprise teams require strict service level agreements (SLAs), real-time anomaly detection, auditability of data mutations, and rapid incident response.

To support these requirements, this document details the design of our **Enterprise-Grade Observability Stack & Local Service Infrastructure**. We integrate **OpenTelemetry (OTel)** for vendor-neutral instrumentation, **Prometheus** for metrics collection, **Jaeger** for distributed tracing, and **Loki + Promtail** for log aggregation, all visualised through standard **Grafana** dashboards.

This architecture is packaged in a production-ready, fully-networked `docker-compose.yml` infrastructure that enforces security boundaries, SRE resource constraints, and automated service readiness checks.

---

## 2. System Context & Data Flow Diagram

The following Mermaid diagram outlines the end-to-end telemetry pipeline, trace propagation, and scraping boundaries across all components.

```mermaid
flowchart TD
    subgraph Client ["Client Browser (apps/web)"]
        Web["Solid.js App<br/>(W3C Trace Headers)"]
    end

    subgraph DockerCompose ["Docker Compose Stack (kanbrio-network)"]
        API["Rust / Axum API<br/>(apps/api)"]
        Postgres[("PostgreSQL DB<br/>(kanbrio-postgres)")]

        Prom["Prometheus Server<br/>(kanbrio-prometheus)"]
        Jaeger["Jaeger Collector & UI<br/>(kanbrio-jaeger)"]
        Loki["Grafana Loki<br/>(kanbrio-loki)"]
        Promtail["Promtail Agent<br/>(kanbrio-promtail)"]
        Grafana["Grafana Server<br/>(kanbrio-grafana)"]
    end

    %% Client Interactions
    Web -->|HTTP requests with traceparent| API

    %% API Telemetry Outputs
    API -->|SQL queries with tracing| Postgres
    API -->|Exposes HTTP /metrics| Prom
    API -->|OTLP / gRPC (Port 4317)| Jaeger
    API -->|Structured JSON to stdout| Promtail

    %% Log collector
    Promtail -->|HTTP Push| Loki

    %% Grafana Dashboards
    Grafana -->|Query Metrics| Prom
    Grafana -->|Query Traces| Jaeger
    Grafana -->|Query Logs| Loki

    %% Scraping & Access
    Prom -.->|Scrapes /metrics| API

    classDef main fill:#38bdf8,stroke:#0284c7,color:#0f172a,stroke-width:2px;
    classDef tele fill:#f472b6,stroke:#db2777,color:#0f172a,stroke-width:2px;
    classDef infra fill:#a78bfa,stroke:#7c3aed,color:#0f172a,stroke-width:2px;
    class API,Web main;
    class Prom,Jaeger,Loki,Promtail,Grafana tele;
    class Postgres infra;
```

---

## 3. Network Topology & Docker Compose Services

All services operate within a single isolated bridge network named `kanbrio-network` to prevent unsolicited host-port exposures while securing inter-container traffic.

### 3.1 Network Security Boundaries
- Only **Grafana (Port 3000)**, **Jaeger UI (Port 16686)**, **API (Port 3000)**, and the **Web App (Port 5173)** expose public-facing ports.
- **Postgres (Port 5432)**, **Prometheus (Port 9090)**, and **Loki (Port 3100)** are kept entirely private inside the bridge network, reachable only by sibling containers.

### 3.2 Service Definitions (Summary)

*   **`kanbrio-postgres`**: Alpine-based database running PostgreSQL 16. Includes automated healthchecking (`pg_isready`) and volume mounts for persistence.
*   **`kanbrio-api`**: Rust Axum container configured with a dynamic environment pointing to the PostgreSQL service and OTLP collector endpoint. Enforces a startup dependency on `kanbrio-postgres` health.
*   **`kanbrio-prometheus`**: Configured to scrape metrics from the API container every 10 seconds.
*   **`kanbrio-jaeger`**: Consolidated all-in-one distributed tracing collector and visualizer, exposing OTLP over gRPC (4317) and HTTP (4318).
*   **`kanbrio-loki`**: Log ingestion cluster that receives structured application log streams from Promtail.
*   **`kanbrio-promtail`**: Scrapes Docker daemon container log files or directly mounts `/var/lib/docker/containers` in local environments to forward API stdout JSON logs into Loki.
*   **`kanbrio-grafana`**: Pre-configured with automatic datasources for Prometheus, Jaeger, and Loki, alongside basic dashboards loaded via provisioning folders.

---

## 4. Telemetry Instrumentation Strategy (Rust/Axum)

To implement zero-dependency telemetry overhead, the Axum API uses the official OpenTelemetry and Tracing ecosystems.

### 4.1 Crate Composition (`Cargo.toml`)
We introduce the following crates into `apps/api/Cargo.toml`:
```toml
# Telemetry and Observability Stack
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["json", "env-filter"] }
tracing-opentelemetry = "0.22"
opentelemetry = { version = "0.21", features = ["rt-tokio"] }
opentelemetry-otlp = { version = "0.21", features = ["grpc-sys", "rt-tokio"] }
metrics = "0.22"
metrics-exporter-prometheus = "0.13"
tower-http = { version = "0.5", features = ["trace"] }
```

### 4.2 Distributed Tracing & W3C Trace Context
1.  **Trace Propagation**: The API extracts W3C trace headers (`traceparent`, `tracestate`) from incoming HTTP requests using `tower_http::trace::TraceLayer`. If absent, a new root span is created.
2.  **Context Propagation**: Spans contain metadata matching OpenTelemetry semantic conventions:
    *   `http.method` (e.g., `POST`)
    *   `http.route` (e.g., `/api/workspaces/:id/cards`)
    *   `http.status_code` (e.g., `201`)
    *   `db.system` (`postgresql`)
    *   `db.statement` (SQL query string, with sensitive parameters masked)

### 4.3 Database Telemetry (SQLx)
We hook SQLx connection pools with a custom tracing driver. Every query executed in a transaction automatically registers as a child span of the active HTTP handler's span, allowing developers to isolate slow queries directly from a Jaeger trace:

```rust
// DB Span Registration
let query_span = tracing::info_span!(
    "db.query",
    "db.system" = "postgresql",
    "db.statement" = query_text,
    "db.instance" = "kanbrio"
);
```

### 4.4 Metrics Ingestion
Prometheus metrics are collected and formatted using `metrics-exporter-prometheus` running inside the Axum runtime. The system exposes:
- **Red Method Metrics**: Request rates (`http_requests_total`), durations (`http_request_duration_seconds`), and error frequencies (`http_requests_failed_total`).
- **Database Metrics**: Connection pool utilization (`db_pool_connections_active`, `db_pool_connections_idle`).
- **Runtime Metrics**: Memory allocations (`malloc_bytes_active`), CPU time, and thread schedules.

---

## 5. Structured Log Aggregation

Logs must be treated as structured event streams rather than unstructured text.

### 5.1 JSON Structured Logging Format
When running in production/Docker, the API writes to stdout in JSON format using `tracing-subscriber::fmt::json()`. Every log line includes:
```json
{
  "timestamp": "2026-05-31T08:50:47.123Z",
  "level": "INFO",
  "fields": {
    "message": "Card moved successfully",
    "card_id": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
    "from_column": "c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1",
    "to_column": "c2c2c2c2-c2c2-c2c2-c2c2-c2c2c2c2c2c2"
  },
  "span": {
    "name": "move_card",
    "trace_id": "8e30b11a2d3c4e5f6a7b8c9d0e1f2a3b",
    "span_id": "5e6f7a8b9c0d1e2f"
  },
  "target": "kanbrio_api::handlers::board"
}
```

### 5.2 Log-Correlation (Trace-to-Log Join)
By injecting `trace_id` and `span_id` into every JSON log line, Grafana Loki correlates log streams directly with Jaeger trace maps. A developer viewing a slow request trace can click "View Logs for Trace" to immediately load the corresponding backend log statements.

---

## 6. SRE & Security Auditing Safety Controls

Observability systems must not compromise application reliability or security.

### 6.1 Backpressure and Queue Boundaries
- **gRPC OTLP Export**: The OpenTelemetry trace exporter is configured to run asynchronously (`rt-tokio`) using a bounded memory buffer (max queue size: 2048 spans).
- **Graceful Fallbacks**: If the Jaeger collector becomes unreachable or slow, the trace exporter discards overflow spans rather than blocking the main HTTP execution threads (non-blocking fallback).

### 6.2 Resource Quotas (Docker Compose Limits)
To protect the local node from memory exhaustion during heavy workloads, SRE resource quotas are strictly enforced:
- **Prometheus / Loki**: Memory allocation is hard-capped at 256MB each; CPU shares are limited to 0.5 cores.
- **Grafana / Jaeger**: Memory capped at 128MB each.
- **Log Rotation**: Docker logging driver parameters are locked to a maximum file size of `10m` with a retention capacity of 3 files per container.

### 6.3 Compliance & PII Masking
- **Sensitive Fields**: Under no circumstances shall database queries containing hashed passwords (e.g., during login requests) be traced or logged in plain text.
- **Header Stripping**: Headers like `Authorization` or `Cookie` are stripped from tracing spans by the HTTP trace layer to maintain data privacy compliance.
