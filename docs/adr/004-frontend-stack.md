# ADR 004: Frontend Stack Selection (SolidStart, Pragmatic DnD, ECharts)

**Date**: 2026-05-22
**Status**: Accepted (Revised)
**Owner**: @architect

## Context
The frontend of Kanbrio must provide a highly interactive, low-latency 2D Kanban experience. It needs to handle:
1. **Complex Grid Layouts**: Columns x Swimlanes with nested columns.
2. **Extreme Drag and Drop Performance**: Moving cards across thousands of targets without Virtual DOM overhead.
3. **Data Visualization**: Rendering dense Monte Carlo probability distributions.
4. **Agent Orchestration**: Real-time updates as AI agents move cards.

Previously, React/Next.js was considered, but after deeper research into performance and user requirements, we have pivoted to a Signals-based architecture.

## Options Considered

### 1. Framework
*   **Next.js (React)**: High ecosystem support but Virtual DOM overhead in large boards.
*   **SvelteKit**: Good balance of DX and performance.
*   **SolidStart (Solid.js)**: **Chosen.** Highest performance via fine-grained reactivity (Signals). Zero VDOM diffing ensures 60 FPS even with 1000+ cards.

### 2. Drag and Drop Engine
*   **dnd-kit (React/Solid)**: Robust but higher level.
*   **Pragmatic Drag and Drop (Atlassian)**: **Chosen.** Low-level, framework-agnostic engine used by Jira/Trello. Provides the fastest possible movement by leveraging fixed native browser behaviors.

### 3. Internal Kanban Engine
*   **Generic UI Libs**: Lack native support for Swimlanes, WIP limits, and recursive hierarchies.
*   **@kanbrio/kanban-engine**: **Chosen.** We will build an internal component package (in the monorepo) that uses Pragmatic DnD to provide specific Kanban primitives.

## Decision
We will use a high-performance, signal-based stack:
1. **Framework**: **SolidStart** (Solid.js) with **Tailwind CSS**.
2. **State Management**: **TanStack Store** (Signal-based) + **TanStack Query** (Solid adapter).
3. **Dnd Engine**: **Pragmatic Drag and Drop**.
4. **Custom Library**: **@kanbrio/kanban-engine** (Internal component library).
5. **Charting**: **Apache ECharts**.

## Rationale
1. **Performance**: Solid.js updates only the affected DOM nodes. When dragging a card, React re-renders component trees; Solid updates only the card's coordinates.
2. **Jira-Scale Capabilities**: Pragmatic DnD is built for enterprise-scale grids. It is the only library that guarantees the performance level of a modern PM tool like Jira or Linear while being agnostic enough to run in Solid.
3. **Strategic Advantage**: Building our own `kanban-engine` on top of Atlassian's motor allows us to deliver unique value (Swimlanes, WIP, Hierarchies) that existing Solid libraries lack.

## Consequences
- **Positive**: Industry-leading UI performance. Kanbrio will be noticeably faster than most existing open-source Kanbans.
- **Negative**: Smaller ecosystem of ready-made components compared to React.
- **Mitigation**: We will use **Kobalte** (the Radix-like primitive library for Solid) to build accessible UI components quickly.

## Critical Files
- `apps/web/` (The SolidStart application)
- `packages/kanban-engine/` (The internal UI primitives)
- `docs/adr/003-data-core-design.md` (Referenced)
