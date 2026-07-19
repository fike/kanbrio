# Kanbrio Documentation Index

This is the navigable index for all of Kanbrio's documentation. For the agent-focused workflow and AI subagents, see [`AGENTS.md`](../AGENTS.md) at the repository root. For contributor onboarding, see [`CONTRIBUTING.md`](../CONTRIBUTING.md).

## Canonical root context files

These files live **at the repository root** and are read by both the agent workflow and the build system at session start. Moving them would break the agentic workflow and require updates to many cross-references.

| File | Purpose |
|:---|:---|
| [`README.md`](../README.md) | Project pitch and quick start. |
| [`CONTRIBUTING.md`](../CONTRIBUTING.md) | Fork / build / run / test / PR workflow for human contributors. |
| [`CODE_OF_CONDUCT.md`](../CODE_OF_CONDUCT.md) | Contributor Covenant 2.1 verbatim. |
| [`CHANGELOG.md`](../CHANGELOG.md) | Keep-a-Changelog 1.1.0 history. |
| [`LICENSE`](../LICENSE) | AGPL-3.0 full text. |
| [`AGENTS.md`](../AGENTS.md) | Workflow rules for AI agents (English-only policy, OODA pipeline, three AI audit gates, bd/beads tracking). |
| [`CLAUDE.md`](../CLAUDE.md) | Claude Code agent memory file (project-specific Claude instructions). |
| [`GEMINI.md`](../GEMINI.md) | Gemini agent memory file. |
| [`DESIGN.md`](../DESIGN.md) | Single-source-of-truth design system (110 KB). Stays at root per [Google Labs `design.md` spec](https://github.com/google-labs-code/design.md) (v0.3.0-alpha) which declares `DESIGN.md` the canonical root context file for coding agents, analogous to `CLAUDE.md`. Migration to the YAML-front-matter spec is registered as future work in [`docs/processes/oss-maturity-plan.md`](processes/oss-maturity-plan.md). |

## Strategic stubs at root

Each strategic document has been moved into `docs/` and replaced by a 1-line stub at root for backward link compatibility. The canonical content lives under `docs/`.

| Stub at root | Canonical |
|:---|:---|
| `DISCOVERY.md` | [`docs/product/discovery.md`](product/discovery.md) |
| `BENCHMARK.md` | [`docs/product/benchmark.md`](product/benchmark.md) |
| `ROADMAP.md` | [`docs/product/roadmap.md`](product/roadmap.md) |
| `ORGANIZATION.md` | [`docs/organization/organization.md`](organization/organization.md) |

## Architecture Decision Records (ADRs)

Short, immutable records of architecturally significant decisions. Status enum and index live in [`adr/README.md`](adr/README.md).

| # | Title | Status |
|:---|:---|:---|
| [001](adr/001-backend-language.md) | Backend Language Selection (Go vs. Rust) | Accepted |
| [002](adr/002-web-framework.md) | Web Framework Selection (Axum) | Accepted |
| [003](adr/003-data-core-design.md) | Data Core Design (Hierarchy & Event Logging) | Accepted |
| [004](adr/004-frontend-stack.md) | Frontend Stack Selection (SolidStart, Pragmatic DnD, ECharts) | Accepted (Revised) |
| [005](adr/005-arrival-departure-rules.md) | Arrival & Departure Rules (Checklists & Column Policies) | Accepted |
| — | [_template.md](adr/_template.md) | (blank template for new ADRs) |

## Architecture

| File | Summary |
|:---|:---|
| [`architecture/observability_stack.md`](architecture/observability_stack.md) | OpenTelemetry, Prometheus, Jaeger, Loki, Grafana compose stack. |

## Organization

| File | Summary |
|:---|:---|
| [`organization/organization.md`](organization/organization.md) | Monorepo layout, label taxonomy, milestone aliases (v0.1 Skeleton, v0.5 Engine, v0.8 Brain). |

## Processes

| File | Summary |
|:---|:---|
| [`processes/oss-maturity-plan.md`](processes/oss-maturity-plan.md) | 5-vertical-slice roadmap to close gaps with mature OSS PM tools (governance, CI, release, docs, discovery). |
| [`processes/release.md`](processes/release.md) | 6-step release ritual; SemVer policy; Keep-a-Changelog 1.1.0 and yanked releases. |

## Product Discovery

Each milestone typically produces a trio: `<topic>_discovery.md` + `<topic>_mini_prd.md` + `<topic>_user_stories.md`. Status taxonomy is defined in [`product/_doc_status_taxonomy.md`](product/_doc_status_taxonomy.md).

### Itemungs

| File | Summary |
|:---|:---|
| [`product/discovery.md`](product/discovery.md) | Personas, JTBD canvas, "Big Problem" framing (Flow vs State). Personas declared SYNTHETIC per the research provenance section. |
| [`product/benchmark.md`](product/benchmark.md) | Comparative matrix: 12 agile metrics × 6 competitors (Businessmap, ActionableAgile, Linear, Monday.com, Kanboard). |
| [`product/roadmap.md`](product/roadmap.md) | Four strategic cycles: Foundation & Data Core; Advanced Workflow & Automation; Lean Analytics & Prediction; Portfolio & Strategic Management. |
| [`product/workstream_discovery.md`](product/workstream_discovery.md) | 14 open issues clustered into 4 workstreams with execution order. |

### Per-version trios

| Milestone | Discovery | Mini-PRD | User stories |
|:---|:---|:---|:---|
| v0.1 — Skeleton | (in `product/discovery.md` v0.1 section) | [`v0.1_mini_prd.md`](product/v0.1_mini_prd.md) | [`v0.1_user_stories.md`](product/v0.1_user_stories.md) |
| v0.2 — Auth | [`v0.2_auth_discovery.md`](product/v0.2_auth_discovery.md) | [`v0.2_auth_mini_prd.md`](product/v0.2_auth_mini_prd.md) | — |
| v0.3 — WIP Limits | [`v0.3_user_wip_limits_discovery.md`](product/v0.3_user_wip_limits_discovery.md) | [`v0.3_user_wip_limits_mini_prd.md`](product/v0.3_user_wip_limits_mini_prd.md) | — |
| v0.4 — Analytics | [`v0.4_analytics_user_stories.md`](product/v0.4_analytics_user_stories.md) (steps in) | [`v0.4_analytics_mini_prd.md`](product/v0.4_analytics_mini_prd.md) | [`v0.4_analytics_user_stories.md`](product/v0.4_analytics_user_stories.md) |
| v0.4 — Arrival & Departure Rules | [`v0.4_arrival_departure_rules_discovery.md`](product/v0.4_arrival_departure_rules_discovery.md) | [`v0.4_arrival_departure_rules_mini_prd.md`](product/v0.4_arrival_departure_rules_mini_prd.md) | — |
| v0.5 — Transitions & Blockers | [`v0.5_transitions_blockers_discovery.md`](product/v0.5_transitions_blockers_discovery.md) | [`v0.5_transitions_blockers_prd.md`](product/v0.5_transitions_blockers_prd.md) | — |
| v0.6 — Card Creation | [`v0.6_card_creation_discovery.md`](product/v0.6_card_creation_discovery.md) | [`v0.6_card_creation_mini_prd.md`](product/v0.6_card_creation_mini_prd.md) | — |
| v0.7 — Task Hierarchy | [`v0.7_task_hierarchy_discovery.md`](product/v0.7_task_hierarchy_discovery.md) | [`v0.7_task_hierarchy_mini_prd.md`](product/v0.7_task_hierarchy_mini_prd.md) | — |

### Crosscutting topics

| File | Summary |
|:---|:---|
| [`product/onboarding_mini_prd.md`](product/onboarding_mini_prd.md) | Onboarding UX spec. |
| [`product/onboarding_user_stories.md`](product/onboarding_user_stories.md) | Onboarding JTBD. |
| [`product/business_rules_mini_prd.md`](product/business_rules_mini_prd.md) | IFTTT rules engine: technical specifications. |
| [`product/business_rules_user_stories.md`](product/business_rules_user_stories.md) | Rules engine JTBD. |
| [`product/MINI-PRD-ws-sync.md`](product/MINI-PRD-ws-sync.md) | WebSocket real-time sync mini-PRD. |
| [`product/websocket_sync_strategy.md`](product/websocket_sync_strategy.md) | Phase 1 discovery for WS sync strategy. |
| [`product/observability_mini_prd.md`](product/observability_mini_prd.md) | Observability stack mini-PRD. |

## Audits

| File | Summary |
|:---|:---|
| [`audits/2026-05-security-review.md`](audits/2026-05-security-review.md) | Security audit report from May 2026. |

## Screenshots

Baseline screenshots captured at 1440×900 @2x via `scripts/take-screenshots.mjs` after a `make demo` session. See [`screenshots/`](screenshots/).

## Skills and agents (consumers of this docs)

The `.agents/` directory at the repo root hosts 10 subagents and 13 skills that consume this documentation at session start. The agentic workflow is defined in [`.agents/skills/agentic-workflow/SKILL.md`](../.agents/skills/agentic-workflow/SKILL.md).
