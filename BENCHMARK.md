# Project Kanbrio: Detailed Competitive Analysis

This document provides in-depth comparative matrices of Kanban and Project Management solutions to identify technical gaps and strategic opportunities for Kanbrio.

---

## 🏗️ Comparative Matrix: Portfolio & Hierarchy

| Feature | **Businessmap** | **Jira (Plans)** | **Plane** | **Taiga** | **Kanbrio (Target)** |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Hierarchy Depth** | Unlimited | Unlimited | 4 Levels (Fixed) | 2 Levels (Epic/Story) | **Unlimited (Recursive)** |
| **Status Roll-ups** | Automatic (Event) | Manual/Trigger | Progress Bar | Manual | **Automatic (Event)** |
| **AI Agent Support** | **None** | **High (Rovo)** | **High (Native)** | **None** | **Native Orchestration** |
| **Progress Logic** | Time/Size/Count | Story Points | Issue Count | Story Points | **Hybrid (Audit-based)** |

---

## 📊 Comparative Matrix: Agile Flow Metrics & Visualizations

> **Legend:** ✅ Native · ⚠️ Partial / approximation · ❌ None · 🚧 Planned (v0.5+)

| Metric / Visualization | Chart | Percentiles | Filtering | **Kanbrio** | **Businessmap** | **ActionableAgile** | **Linear Insights** | **Monday.com** | **Kanboard** |
|:---|:---|:---|:---|:---:|:---:|:---:|:---:|:---:|:---:|
| **Cumulative Flow Diagram (CFD)** | Stacked area | n/a | date range, `interval` | ✅ | ✅ | ❌ | ⚠️ burn-up only¹ | ❌ | ✅ |
| **Cycle Time Scatter Plot** | Scatter | P50/P85/P95 | `days`, `scope` | ✅ | ✅ | ✅ | ⚠️ aggregate only | ❌ | ❌ |
| **Cycle Time Histogram** | Histogram | P50/P85/P95 | `days`, `scope` | 🚧 | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Flow Efficiency (active vs wait)** | Donut + by_column table | n/a | workspace | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Aging WIP (stagnant cards)** | Table sorted by idle desc | n/a | `threshold_days` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Monte Carlo "When" (forecast date)** | Histogram | P50/P75/P85/P95 | `days`, `simulations`, `scope` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Monte Carlo "How Many" (forecast scope)** | Histogram | P50/P75/P85/P95 | `days`, `simulations`, horizon | 🚧 | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Throughput standalone** | Timeline / bar | n/a | `days`, `scope` | ⚠️ MC payload only | ✅ | ✅ | ✅ | ❌ | ✅ (avg) |
| **Blocker Clustering** | Heatmap | n/a | n/a | 🚧 | ✅ | ❌ | ❌ | ❌ | ❌ |
| **WIP Limits per column** | Enforcement | n/a | column | ✅ | ✅ | n/a | ✅ | ⚠️ | ✅ |
| **a11y chart annotations (`role="img"`)** | WCAG | n/a | n/a | ✅ | ❓ | ❓ | ❓ | ❓ | ❌ |
| **Real-time chart refresh via WebSocket** | Realtime | n/a | n/a | 🚧 | ❌ | ❌ | ✅ (live) | ✅ | ❌ |

¹ Linear exposes a "Burn-up" slice option in Insights that approximates CFD semantics; ideally
  both the burn-up chart and a proper CFD should be available as distinct features (vacant in Linear today).

### References (all URLs accessed on 2026-07-18)
1. **Businessmap** — Kanban Analytics hub: <https://businessmap.io/kanban-resources/kanban-analytics>
2. **ActionableAgile Analytics** (55 Degrees): <https://www.55degrees.se/products/actionableagileanalytics>
3. **Linear Insights**: <https://linear.app/insights>
4. **Kanboard Project Analytics**: <https://docs.kanboard.org/v1/user/analytics/>
5. **Monday.com** features (dashboards, no Lean metrics): <https://monday.com/features>
6. **Kanbrio v0.4 Analytics PRD**: `docs/product/v0.4_analytics_mini_prd.md`
7. **Kanbrio Analytics implementation**: `apps/web/src/components/Analytics/*` · `apps/api/src/models/analytics.rs`

---

## 💻 Comparative Matrix: Technical Stack & Deployment

| Feature | **Plane** | **Kanboard** | **Leantime** | **Linear** | **Kanbrio (Target)** |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Backend Language** | Python (Django) | PHP | PHP | Node.js | **Rust** |
| **Real-time** | WebSockets | Polling | Limited | Pusher | **WebSockets (Native)** |
| **Agent API Speed** | Moderate | Low | Low | **High** | **Extreme (gRPC/Native)** |
| **Deployment** | Self-host/Cloud | Self-host | Self-host/Cloud | Cloud only | **Self-host / Edge-ready** |

---

## 🤖 AI Agent & Automation Maturity

| Tool | AI Capability Type | Agentic Features |
| :--- | :--- | :--- |
| **Plane** | **Agentic Native** | ADK (Agent Dev Kit), autonomous background agents. |
| **Linear** | **Agent-Friendly** | High-speed API for external agents (Cursor, Gemini CLI). |
| **Jira** | **Enterprise Agents** | Atlassian Rovo: specialized agents for code, docs, tasks. |
| **Leantime** | **Assistive AI** | Focused on neurodiversity and summary generation. |
| **Businessmap** | **None** | Focuses exclusively on deterministic Lean mathematics. |
| **Kanbrio** | **Agent-First** | **Built-in OODA Orchestrator for board management.** |

---

## 🚀 Kanbrio's "Killer Features"

1. **Native Probabilistic Engine**: Fast Monte Carlo written in Rust.
2. **Recursive Hierarchical Roll-ups**: Infinite nesting via PostgreSQL Recursive CTEs.
3. **Agentic Architecture**: Designed to be managed by AI Agents (like the `ooda-orchestrator`) natively, combining Lean math with AI reasoning.
