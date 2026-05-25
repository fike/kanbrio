# Kanbrio: Project Instructions

This project follows a strict **Agent-First** development model. All development must adhere to the governance and workflows defined in this file and the referenced documents.

## 🤖 Agent Governance
- **Mandatory Reference:** Always follow the roles and responsibilities defined in [AGENTS.md](./AGENTS.md).
- **Subagent Discovery:** Local subagents are located in `.agents/agents/` (linked via `.gemini/agents/`).
- **Orchestration:** Use `@ooda-orchestrator` for multi-step task coordination and complex decision-making.

## 🛠️ Development Workflow
- **Issue Tracking:** Use **bd (beads)** for all task management. Never use markdown files or other tools for tracking work.
- **Workflow Skill:** Strictly follow the pipeline defined in the `agentic-workflow` skill (`.agents/skills/agentic-workflow/SKILL.md`).
- **TDD:** The `tdd` skill is mandatory for all code implementations by the `@developer`.
- **Merge Protocol (HARD RULE):** AI Agents must **NEVER** merge Pull Requests to the `main` branch or execute `git merge` into main. Human review and explicit approval are mandatory.

## 📂 Architecture & Context
- **ADRs:** Consult `docs/adr/` before making architectural decisions.
- **Project Structure:** Adhere to the monorepo layout described in [ORGANIZATION.md](./ORGANIZATION.md).
- **Discovery:** Refer to [DISCOVERY.md](./DISCOVERY.md) for current product research and [ROADMAP.md](./ROADMAP.md) for priorities.

## 🚦 Quality Gates
No code shall be merged without clearing the following AI audits:
1. **Security Review** (@security)
2. **Reliability Review** (@sre)
3. **Compliance Review** (@legal-counsel)
