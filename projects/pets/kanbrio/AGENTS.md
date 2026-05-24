# Project Agents & Skills

This repository is configured with specialized AI agents and skills to assist in the development of this open-source Kanban system. We follow the **Progressive Disclosure** model for context efficiency.

## 🤖 Local Agents

Local agents are defined in `.agents/agents/`. They are specialized personalities with specific scopes.

| Agent | Role | Description |
| :--- | :--- | :--- |
| **ooda-orchestrator** | Orchestrator | The master controller using the OODA loop to coordinate other agents. |
| **product-manager** | Product & Strategy | Handles discovery, benchmarking, and GitHub Issue detailing (Acceptance Criteria). |
| **ux-designer** | UI/UX Design | Maintains DESIGN.md, defines Design Tokens, and ensures accessibility/cognitive load management. |
| **legal-counsel** | Legal & Compliance | Ensures open-source license integrity and dependency compatibility. |
| **architect** | System Design | Focuses on architectural patterns, ADRs, and high-level decisions. |
| **developer** | Implementation | Handles coding, refactoring, and test implementation. |
| **kanban-expert** | Domain Logic | Specialized in Lean/Kanban metrics (Monte Carlo, CFD, Flow Efficiency). |

## 🛠️ Project Skills

Skills are portable procedures found in `.agents/skills/`. They provide expert guidance for specific tasks.

### Available Skills

- **product-discovery**: Methodologies for discovery (JTBD, OST), prioritization (RICE, MoSCoW), and PRD generation.
- **license-audit**: Procedures for auditing third-party dependencies for license compatibility.
- **kanban-modeling**: Procedures for database schema design for hierarchical tasks and event auditing.
- **monte-carlo-simulation**: Technical instructions for implementing probabilistic forecasting.
- **flow-analytics**: Standards for calculating and visualizing Lean metrics.
- **tdd**: Red-Green-Refactor cycle and unit testing standards.
- **clean-code**: Naming conventions, function design, and readability standards.
- **refactoring**: Boy Scout Rule and identification of code smells.
- **extreme-programming**: YAGNI, simplicity, and continuous improvement mindset.
- **solidjs-patterns**: Idiomatic Solid.js development (Signals, no VDOM, native primitives).
- **rust-axum-patterns**: Idiomatic Rust/Axum development (Result/Option, extractors, error types).
- **postgres-sqlx-patterns**: Secure and idiomatic PostgreSQL development using SQLx in Rust.
- **monorepo-workflow**: Rules for cross-package dependencies and monorepo structure.
- **agentic-workflow**: The official Kanbrio development and review lifecycle utilizing mandatory AI audits.

## 📋 Governance

- **Discovery**: Agents discover skills by their name and description.
- **Activation**: Use `@agent-name` or ask for a specific skill to be activated when needed.
- **Style**: All code must follow the standards defined in the `clean-code` and project-specific skills.
