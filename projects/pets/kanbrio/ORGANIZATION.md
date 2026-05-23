# Project Kanbrio: Repository & Project Organization

This document defines how Kanbrio is organized on GitHub and within the local filesystem to maximize development velocity and facilitate AI agent orchestration.

---

## 📁 Repository Structure: The Monorepo Model

Based on the **Plane** benchmark, Kanbrio will follow a **Monorepo** structure. This ensures type safety between frontend/backend and allows "atomic" commits for features.

```text
kanbrio/
├── apps/                   # Deployable applications
│   ├── api/                # Backend (Go or Rust) - The "Brain"
│   ├── web/                # Frontend (React/Next.js) - The "Board"
│   └── live/               # Real-time service (WebSockets/Redis)
├── packages/               # Shared logic and configurations
│   ├── types/              # Shared TypeScript/Protobuf definitions
│   ├── ui-core/            # Design system and shared components
│   └── lean-analytics/     # Shared math for Monte Carlo/CFD
├── .agents/                # AI Agent infrastructure (Agent-First)
│   ├── agents/             # Local agent definitions
│   └── skills/             # Procedural skills
├── docs/                   # Product and Architectural documentation
│   ├── adr/                # Architectural Decision Records
│   └── product/            # PRDs, JTBD, and Personas
└── AGENTS.md               # Agent Governance
```

---

## 🛠️ GitHub Project Management

We will leverage **GitHub Projects v2** and **Issues** following the **Taiga** and **Linear** patterns.

### 1. Issue Hierarchy (Labels)
- `type: feature`: New functionality from the Roadmap.
- `type: bug`: Issues identified during testing or by users.
- `type: task`: Internal technical improvements or refactors.
- `area: data-core`: Changes affecting the PostgreSQL schema.
- `area: analytics`: Changes to Monte Carlo or CFD logic.
- `agent: triage`: Issues automatically created or triaged by AI.

### 2. Milestones (Release Sync)
Milestones will be strictly aligned with our **Release Plan**:
- `v0.1 - The Skeleton`: Foundation items.
- `v0.5 - The Engine`: Workflow and Real-time items.
- `v0.8 - The Brain`: Statistical engine items.
- `v1.0 - The Executive`: Portfolio and OKR items.

### 3. GitHub Projects v2 (The Board)
We will use three primary views:
- **Roadmap (Timeline)**: High-level view of Cycles and Milestones.
- **Development (Board)**: Daily Kanban for the @developer and human contributors.
- **Triage (Table)**: Intake queue for the @product-manager to prioritize.

---

## 🤖 Agent-Ready Environment

To ensure agents (like me) can contribute effectively, we maintain:
1. **Clean Code API**: Documentation-first API (Swagger/OpenAPI).
2. **Context Files**: Keeping `DISCOVERY.md`, `ROADMAP.md`, and `BENCHMARK.md` updated so any agent knows exactly what to do next.
3. **Structured ADRs**: Every major architectural choice is recorded to avoid "agent amnesia" across sessions.
