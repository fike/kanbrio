# Technical Specification & Mini-PRD: Structured JSON Logging, Promtail, and Grafana Loki Correlation

**Task ID**: `kanbrio-e2l.5`
**Status**: Approved Specification | **Version**: 1.1 | **Owner**: @product-manager | **Date**: 2026-06-13
**Strategic Alignment**: Production Reliability, Diagnostics MTTR Reduction, System Traceability, Platform Health Checks.

---

> [!IMPORTANT]
> This mini-PRD details the functional requirements, telemetry definitions, configurations, and acceptance criteria for implementing **Structured JSON Logging, Promtail log ingestion, and Grafana Loki-Jaeger correlation**. This task completes the visual and operational correlation layer of the observability stack in the Kanbrio monorepo.

---

## 💡 1. Product & Business Value

In high-concurrency production environments, diagnosing microservice failures or database performance degradation is notoriously difficult when logs, traces, and system metrics live in silos. Without correlation, an incident responder is forced to manually align timestamps across different servers, containers, and services to trace a single request's failure path.

To achieve enterprise-grade reliability and minimize Mean Time to Resolution (MTTR), we require three tightly integrated components:

1. **Structured JSON stdout Logs**: Traditional plain-text logs are hard to parse programmatically and query efficiently. JSON structured logging ensures that key metadata fields—such as `timestamp`, `level`, `target`, `trace_id`, and `span_id`—are serialized as machine-readable fields, allowing index-free parsing in Loki and instant log filtering.
2. **Promtail Container Log Auto-Discovery**: Instead of scraping logs from static, hard-coded files on the host filesystem (which is fragile and does not scale), Promtail must query the Docker daemon socket (`/var/run/docker.sock`) using dynamic container discovery. This ensures all running containers are dynamically scraped and dynamically labeled with meta-labels like container name, compose project, and service.
3. **Grafana Loki-to-Jaeger Correlation**: A developer or SRE investigating a slow database transaction or api response should not have to manually copy and paste trace IDs. By defining a data link on `trace_id` inside Loki logs, Grafana automatically renders an interactive hyperlink. Clicking this hyperlink takes the operator directly to the corresponding Jaeger trace timeline, connecting *what* happened (application log warnings/errors) with *where* it occurred (the trace map).

---

## ⚙️ 2. Numbered Functional Requirements (FR)

### FR-1: Verify Structured JSON Logging in API Production Profile
*   **Target Location**: `apps/api/src/handlers/observability.rs`
*   **Behavior**:
    *   The logging system must automatically switch to structured JSON formatting when the environment variable `KANBRIO_LOG_FORMAT=json` is set, or when the API detects that it is running inside a containerized environment (manifested by the presence of `/.dockerenv`).
    *   Under these profiles, standard stdout logs must be emitted as valid, single-line JSON records.
*   **Telemetry Details (JSON Fields)**:
    *   Every JSON log entry must contain the following fields:
        ```json
        {
          "timestamp": "2026-06-13T20:15:00.000000Z",
          "level": "INFO",
          "fields": {
            "message": "Starting database connection pool"
          },
          "target": "kanbrio_api::db",
          "span": {
            "name": "http.request"
          },
          "spans": [
            {
              "name": "http.request",
              "trace_id": "8e30b11a2d3c4e5f6a7b8c9d0e1f2a3b",
              "span_id": "0e1f2a3b4e5f6a7b"
            }
          ]
        }
        ```
    *   `trace_id` and `span_id` must be dynamically injected into the span context section of the JSON output whenever a log statement is executed inside an active OpenTelemetry tracing context.

### FR-2: Promtail Docker Socket Scraping and Dynamic Labeling
*   **Target Location**: `docker/promtail-config.yaml`
*   **Scrape Method**:
    *   Replace host-based static configs with dynamic Docker socket discovery using `docker_sd_configs`.
    *   Configure Promtail to connect directly to the Docker socket at `unix:///var/run/docker.sock`.
*   **Dynamic Relabeling**:
    *   Implement relabel configurations to extract and expose the following labels for Loki indexing:
        *   **`container`**: Extracted from `__meta_docker_container_name` using regex `/(.*)` to strip leading slashes.
        *   **`project`**: Extracted from `__meta_docker_container_label_com_docker_compose_project`.
        *   **`service`**: Extracted from `__meta_docker_container_label_com_docker_compose_service`.
*   **Promtail Config Template Reference**:
    ```yaml
    scrape_configs:
      - job_name: docker-containers
        docker_sd_configs:
          - host: unix:///var/run/docker.sock
            refresh_interval: 5s
        relabel_configs:
          - source_labels: [__meta_docker_container_name]
            regex: '/(.*)'
            target_label: container
          - source_labels: [__meta_docker_container_label_com_docker_compose_project]
            target_label: project
          - source_labels: [__meta_docker_container_label_com_docker_compose_service]
            target_label: service
    ```

### FR-3: Grafana Dashboard Provisioning
*   **Target Provisioning Config**: `docker/grafana/provisioning/dashboards/dashboards.yml`
    *   Define a dashboard provider that automatically scans and loads dashboards from the container directory `/var/lib/grafana/dashboards` on startup.
*   **Target Dashboard Definition**: `docker/grafana/dashboards/kanbrio-dashboard.json`
    *   Provide a complete JSON representation of the "Kanbrio Observability Dashboard".
*   **Layout Specifications**:
    *   **Row 1: Container Infrastructure Health (Prometheus Data Source)**
        *   *CPU Utilization*: Panel displaying CPU usage per container (in percent/cores) over time. Formula: `sum(rate(container_cpu_usage_seconds_total{container=~"kanbrio-.*"}[5m])) by (container) * 100`.
        *   *Memory Working Set*: Panel displaying memory consumption per container in bytes. Formula: `container_memory_working_set_bytes{container=~"kanbrio-.*"}`.
    *   **Row 2: HTTP RED Metrics (Prometheus Data Source)**
        *   *HTTP Requests (RPS)*: Rate counter indicating incoming HTTP throughput. Formula: `sum(rate(http_requests_total[5m])) by (route, method, status)`.
        *   *HTTP Latency Quantiles (p50, p95, p99)*: Multi-line chart mapping API latency. Formula: `histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))`.
        *   *HTTP Error Rate*: Percentage of 5xx server responses relative to total requests. Formula: `sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m])) * 100`.
    *   **Row 3: SQLx Database Pool Status (Prometheus Data Source)**
        *   *Active/Idle Connections Gauge*: Gauge displaying active vs idle pool sizes to detect resource exhaustion. Formula: `db_pool_connections_active` and `db_pool_connections_idle`.
    *   **Row 4: Live Container Logs (Loki Data Source)**
        *   *Loki Live Feed*: Log panel listing log streams matching `{service="api"}` or `{container="kanbrio-api"}`.

### FR-4: Log-to-Trace Correlation (Derived Fields)
*   **Target Location**: `docker/grafana/provisioning/datasources/datasources.yml`
*   **Correlation Link Mechanism**:
    *   In the Loki datasource declaration under `jsonData`, specify `derivedFields` mapping.
    *   Configure `trace_id` derived field using a regex matcher targeting the JSON key-value log string.
    *   Associate the derived field with the Jaeger datasource, specifying the target Jaeger datasource UID.
*   **Configuration Schema Reference**:
    ```yaml
      - name: Loki
        type: loki
        access: proxy
        url: http://loki:3100
        editable: true
        jsonData:
          maxLines: 100
          derivedFields:
            - name: trace_id
              matcherRegex: '"trace_id":"([^"]+)"'
              url: '$${__value.raw}'
              datasourceUid: jaeger
              urlDisplayLabel: 'View Trace in Jaeger'
    ```
    *(Note: The double dollar sign `$$` prevents environment expansion by docker-compose or YAML loaders)*.

---

## 🧪 3. Numbered Acceptance Criteria (AC)

### AC-1: Valid JSON Output and Trace ID Propagation
*   **Scenario**: Run the application in a Docker container or execute it with `KANBRIO_LOG_FORMAT=json`.
*   **Assertion**:
    1.  All console logs emitted during an API request context must be valid JSON objects.
    2.  If the log is triggered within an HTTP endpoint, the JSON body must include the `trace_id` and `span_id` within the `spans` array or inside the root log object fields.
    3.  Executing `RUST_LOG=info cargo run` with `KANBRIO_LOG_FORMAT=json` must print compliant JSON log lines to standard output.

### AC-2: Promtail Docker Discovery & Labeling Validation
*   **Scenario**: Spin up the Docker Compose stack using `docker compose up -d`.
*   **Assertion**:
    1.  Promtail container logs verify that the Docker daemon socket connects successfully.
    2.  Querying Loki via the Grafana interface (Explore) shows metadata labels `container`, `project`, and `service` automatically appended to log lines.
    3.  Filters such as `{service="api"}` successfully retrieve log streams generated by the `kanbrio-api` container.

### AC-3: Automated Grafana Dashboard Provisioning
*   **Scenario**: Initial boot of the Grafana container.
*   **Assertion**:
    1.  Grafana parses `dashboards.yml` and pre-loads the `kanbrio-dashboard.json` definition.
    2.  An operator logging in to Grafana (`http://localhost:3001`) can view the pre-provisioned "Kanbrio Observability Dashboard" under the general dashboard directory.
    3.  All panels (System Health, RED metrics, SQLx connections, and Loki logs) load and display real-time data without manual configuration.

### AC-4: Interactive Log-to-Trace Linkage
*   **Scenario**: Inspecting API logs in the Loki query section of Grafana.
*   **Assertion**:
    1.  Every log entry that contains a valid JSON `"trace_id"` must render the trace ID value as a clickable link.
    2.  Hovering over the field exposes the action label `'View Trace in Jaeger'`.
    3.  Clicking the link opens a split pane or redirects the user directly to the Jaeger tracing viewer, displaying the exact span hierarchy of that transaction.
