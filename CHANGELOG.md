# Changelog

All notable changes to Kanbrio will be documented in this file.

The format is based on [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html).

Dates follow ISO 8601 (`YYYY-MM-DD`).

## [Unreleased]

### Added

- OSS Maturity Plan synthesizing research on OpenProject, GitHub Best Practices Guide,
  ADR organization, Keep-a-Changelog, Google Labs `design.md` spec, and Anthropic CLAUDE.md
  convention into 5 vertical slices for closing Kanbrio's gap to mature OSS PM tools
  (`docs/processes/oss-maturity-plan.md`). See epic #114 for the full plan.
- Granular `BENCHMARK.md` matrix covering 12 agile metrics × 6 competitors (CFD, Cycle Time
  Scatter, Cycle Time Histogram, Flow Efficiency, Aging WIP, Monte Carlo When/How Many,
  Throughput, Blocker Clustering, WIP Limits, a11y annotations, real-time WS refresh),
  with chart type, percentiles, and filtering columns, legend, and source URLs.

### Fixed

- OTLP exporter endpoint pointing to legacy Jaeger agent gRPC port `14250` instead of the
  OTLP gRPC port `4317`; traces were being dropped silently.
- Unused legacy Jaeger host ports `14268` and `14250` removed from `docker-compose.yml`;
  only `16686` (UI) remains exposed, OTLP is internal-only on `:4317`/`:4318`.
- `RUST_LOG=debug` was producing per-request HTTP/2 frame DEBUG spam from `h2` and `hyper`;
  replaced with `info,tower_http=debug,h2=warn,hyper=warn` for the same tracing value
  without the noise.

### Changed

- Analytics charts (`CFDPanel`, `CycleTimePanel`, `FlowEfficiencyPanel`, `MonteCarloPanel`)
  now re-render reactively via `createEffect(() => renderChart())` instead of only
  on initial `onMount`.

### Added

- Playwright screenshot automation (`scripts/take-screenshots.mjs`) capturing 9 baseline
  screenshots at 1440×900 @2x. Hardcoded home path replaced by `import.meta.url`-based
  resolution; web URL, API URL, and credentials are env-overridable.
- Demo data seeding script `scripts/demo.sql` (~700 lines) with rich, interconnected
  data (multiple workspaces, users, cards with transitions) and `make seed`/`make demo`
  Make targets.

## [0.1.0] - 2026-07-19

First tracked versioned release of Kanbrio. Covers the work shipped between the initial
commit (2026-05-22) and the OSS Maturity Plan kickoff (2026-07-19), spanning internal
milestones `v0.1` through `v0.7` (workspace skeleton, auth, WIP limits, analytics,
transitions/blockers, card creation, task hierarchy, business rules) plus the
observability stack and real-time WebSocket sync.

### Added

#### Core data model and board layout (v0.1 — The Skeleton)

- PostgreSQL 16 hybrid schema with adjacency list + recursive CTE for unlimited
  portfolio hierarchy (`docs/adr/003-data-core-design.md`).
- 2D Kanban board with columns, swimlanes, cards, and audit-log transitions
  (`apps/api/src/models/board.rs`, `apps/api/src/handlers/board.rs`).
- Recursive task structure and parent-child hierarchy with depth-agnostic roll-up
  queries via PostgreSQL recursive CTEs.
- Monorepo layout (`apps/api`, `apps/web`, `apps/e2e`, `packages/ui-core`) with
  shared `@kanbrio/*` scoped packages (`docs/organization/organization.md`).
- Docker Compose stack (`docker-compose.yml`) with Postgres 16, API, Web, and
  observability sidecars; `Makefile` covering `setup`, `compose`,
  `compose-observability`, `test-api`, `seed`, `demo`.

#### Authentication and workspace isolation (v0.2)

- Email/password authentication with argon2id hashing, stateful sessions, and
  mock OAuth callback hooks for provider integration.
- Multi-tenant enforcement: every board/card/wip-limit query is scoped by
  workspace membership before the data is returned (`apps/api/src/middleware/`).
- Auth REST API under `/api/auth/{register,login,logout,me,workspaces}` with
  rate limiting on the login endpoint.

#### WIP limits, transitions, and blockers (v0.3 & v0.5)

- Multi-level WIP limits: per-column, per-swimlane, and per-user WIP caps with
  race-condition prevention via PostgreSQL row locks
  (`apps/api/src/handlers/board.rs::set_user_wip_limit`).
- Card blocking with reason metadata, audit log entry, and unblock flow including
  block comments (`apps/api/src/handlers/board.rs::{block_card,unblock_card,
  get_block_comments,create_block_comment}`).
- Visual language for blockers: red accent strip on the left of blocked cards,
  toast notifications on block/unblock events (Section 12 of `DESIGN.md`).
- Drag-and-drop engine built on `@atlaskit/pragmatic-drag-and-drop` with
  optimistic UI updates and server reconciliation on conflict.
- Transition auditing: every column move is recorded in `card_transitions` with
  timestamp and actor, feeding Cycle Time and Flow Efficiency computations.

#### Card creation, task hierarchy, and checklists (v0.6 & v0.7)

- Card creation flow with title, assignee, swimlane, deadline, and custom
  checklist items (`apps/api/src/handlers/board.rs::create_card`,
  `apps/api/src/handlers/board.rs::{create,update,delete}_checklist_item`).
- Recursive card hierarchy: cards can have N-level deep children with
  automatic status propagation up the tree
  (`apps/api/src/models/board.rs` recursive CTE).
- E2E coverage of child-status-sync scenarios (`apps/e2e/tests/child-status-sync.spec.ts`).

#### Business rules engine (v0.4)

- IFTTT status sync engine: declarative rules that fire on column-entry
  transitions and propagate status to children or related cards
  (`apps/api/src/handlers/rules.rs`, `apps/api/src/models/rules.rs`).
- Full CRUD API: `GET/POST/PATCH/DELETE /api/workspaces/:id/rules` with
  rule activation toggle and validation.
- Frontend settings UI at `/w/:id/settings/rules` with list view, create
  modal, edit form, 38 unit tests
  (`apps/web/src/components/Rules/`).
- WebSocket broadcast of rule-triggered board mutations so all connected
  clients update without polling.

#### Analytics and Lean flow metrics (v0.4)

Five REST endpoints under `/api/workspaces/:id/analytics/`:

- `GET /cycle-times` — cycle time scatter plot data with P50/P85/P95
  percentiles over a configurable window.
- `GET /flow-efficiency` — `efficiency_pct`, `active_hours`, `wait_hours`,
  `total_cards`, and per-column breakdown.
- `GET /aging-wip` — `stagnant_cards` list sorted by `idle_hours` desc,
  with `threshold_days` parameter and `total_cards_in_active_columns`.
- `GET /cfd` — stacked-area CFD with `from`/`to`/`interval` parameters,
  fill-forward for missing dates, columns ordered by position.
- `GET /monte-carlo` — Monte Carlo "When" simulation with `days`,
  `simulations`, `scope` parameters; returns `throughput_data`, run
  histogram, and `p50/p75/p85/p95` percentiles.

Five SolidJS panels under `/w/:id/analytics/*`:

- `CycleTimePanel` — Chart.js scatter plot with dashed P50/P85/P95
  percentile overlay lines.
- `FlowEfficiencyPanel` — Chart.js doughnut chart plus by-column table.
- `AgingWipTable` — table of stagnant cards with idle hours/days.
- `CFDPanel` — Chart.js stacked area.
- `MonteCarloPanel` — Chart.js bar histogram with P50/P75/P85/P95
  vertical markers.

26 unit tests across the Analytics components (`apps/web/src/components/Analytics/`).

#### Real-time WebSocket sync (v0.8-cycle)

- WebSocket engine at `/ws` with ping/pong heartbeat and presence tracking
  (`apps/api/src/handlers/ws.rs`).
- `PresenceIndicator` UI showing connected viewers on the current board.
- Remote mutation flash animation on cards edited by other users.
- `CollaborationToast` for real-time WS event notifications.

#### Observability stack (epic/observability)

- OpenTelemetry tracing and context propagation from SolidJS through
  Axum with W3C traceparent headers (`apps/api/src/handlers/observability.rs`).
- OTel Collector config exporting traces to Jaeger on internal `:4317`
  and metrics to Prometheus on `:8889`
  (`docker/otel-collector/config.yaml`).
- Loki + Promtail for structured JSON log aggregation, correlated with
  Jaeger traces via trace_id.
- Grafana with auto-provisioned datasources for Jaeger, Loki, and Prometheus.
- Deep health endpoint at `/api/observability/health` and Prometheus
  metrics at `/api/observability/metrics`.
- Network isolation: observability services run on a dedicated
  `kanbrio-observability` network, separate from the application
  `kanbrio-internal` network, to limit blast radius.

#### Documentation and design system

- Single-source-of-truth `DESIGN.md` (110 KB) covering color tokens
  (light/dark), typography, spacing, component list, loading/error/
  empty/success state specs, and a11y rules (Section 16 is the
  Analytics & Metrics chapter).
- Five ADRs covering backend language, web framework, data core design,
  frontend stack, and arrival/departure rules (`docs/adr/`).
- 24 product discovery documents covering v0.1 through v0.7 plus
  onboarding, business rules, observability, WebSocket sync strategy,
  and workstream planning (`docs/product/`).
- `BENCHMARK.md` (root) with three comparative matrices: Portfolio &
  Hierarchy, Agile Flow Metrics & Visualizations (12 metrics × 6
  competitors), and Technical Stack; plus AI Agent Maturity table.
- `DISCOVERY.md` (root) with personas, JTBD canvas, and "Big Problem"
  framing (Flow vs State).
- `ROADMAP.md` (root) with four strategic cycles.
- `AGENTS.md` (root) declaring the English-only policy, the four-phase
  OODA agentic workflow, the bd/beads tracking standard, and the
  mandatory three-gate AI audit process.
- Thirteen skills under `.agents/skills/` covering agentic workflow,
  product discovery, kanban modeling, TDD, clean code, refactoring,
  extreme programming, Rust/Axum patterns, SolidJS patterns,
  Postgres/SQLx patterns, monorepo workflow, license audit, and Monte
  Carlo simulation.
- Ten subagents under `.agents/agents/` (OODA orchestrator, product
  manager, UX designer, architect, developer, kanban expert, security,
  SRE, legal counsel, test agent).

#### Issue tracking and AI agent workflow

- Beads (`bd`) issue tracking embedded in the local Dolt database at
  `.beads/`, synced to the git remote via `refs/dolt/data` (separate
  from `refs/heads/*`).
- `bd prime` workflow documented in `AGENTS.md` with the `ready →
  show → claim → close` short reference.
- `.beads/issues.jsonl` as a passive export; `.beads/config.yaml` for
  the bd settings.

#### Testing and CI

- 16 Rust integration tests in `apps/api/tests/` covering auth, board
  2D layout, audit, WIP limits, transitions/blockers, card creation,
  card hierarchy, move-card API, observability API, rules API,
  security audit, feature gate, arrival/departure rules, workspace
  creation, and healthcheck.
- 26 vitest unit tests on the Analytics components plus suites for
  Rules, CollaborationToast, and Card components.
- 10 Playwright E2E spec files in `apps/e2e/tests/` covering
  board-dnd, audit, observability, wip-limits, transitions_blockers,
  visual-states, business-rules, card-creation, child-status-sync,
  arrival-departure-rules, with a global setup that resets and seeds
  the database.
- GitHub Actions `ci.yml` running backend (Rust clippy + fmt +
  cargo test) and frontend (npm ci + lint + vitest + vite build) on
  push and pull_request to main.
- Pre-commit framework with trailing-whitespace, end-of-file-fixer,
  check-yaml, check-added-large-files, frontend Quality Gate
  (tsc + eslint + vite build), cargo fmt and clippy -D warnings,
  and Yelp/detect-secrets.
- SQLX offline mode enabled so CI builds compile without database
  access (`apps/api/.sqlx`).

#### Seed and demo data

- `scripts/seed.sql` — minimalist seed for local development.
- `scripts/demo.sql` (~700 lines) — clean-slate TRUNCATE + rich
  interconnected demo data with multiple workspaces, 4 users (all
  sharing password `password123`), card transitions, and rule
  configurations, ideal for generating screenshots and demos.
- `make seed` and `make demo` Make targets.

### Security

- `cargo deny` license/bans/sources allow-list configured at
  `apps/api/deny.toml` (license policy: MIT, Apache-2.0, BSD-2/3,
  ISC, Unicode-3.0, AGPL-3.0-only, Zlib, CDLA-Permissive-2.0).
- Local-only Postgres port binding (`127.0.0.1:5432`) so the dev
  database is not exposed to the network.
- Local-only Jaeger UI port (`16686:16686`) — OTLP ingestion is
  internal-only on the `kanbrio-observability` network.
- `THIRD_PARTY_NOTICES` listing direct third-party dependencies
  for license compliance.

[Unreleased]: https://github.com/fike/kanbrio/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/fike/kanbrio/releases/tag/v0.1.0
