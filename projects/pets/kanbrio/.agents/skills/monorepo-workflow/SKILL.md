---
name: monorepo-workflow
description: Rules for cross-package dependencies and monorepo structure.
---

# Monorepo Workflow Skill

This skill ensures that the Kanbrio monorepo remains organized and that dependencies between packages are handled correctly.

## 1. Directory Structure

- `apps/`: Deployable units (API, Web, Live).
- `packages/`: Shared, reusable libraries (kanban-engine, lean-analytics, types).

## 2. Dependency Management

- **Internal Imports**: Use the `@kanbrio/` scope for internal packages (e.g., `import { ... } from "@kanbrio/kanban-engine"`).
- **No Circular Dependencies**: Package A cannot depend on Package B if B also depends on A.
- **Boundaries**: `apps/` should depend on `packages/`, but `packages/` should never depend on `apps/`.

## 3. Atomic Commits

- Aim for atomic commits that include changes to both the shared package and the consuming application to keep the workspace in a consistent state.
- Ensure that updating a shared type in `packages/types` triggers the necessary updates in both `apps/api` (Rust) and `apps/web` (TypeScript).
