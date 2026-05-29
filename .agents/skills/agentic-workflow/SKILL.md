---
name: agentic-workflow
description: The official Kanbrio development and review lifecycle using AI agents.
---

# Agentic Workflow Skill

This skill defines the rigorous process for developing and reviewing features in the Kanbrio repository.

## The Kanbrio Lifecycle Pipeline

Every feature or bug fix must go through this 6-stage pipeline:

### 1. Specification (Upstream)
- **Actors**: `@product-manager` (Mini-PRD & GitHub Issue ACs) + `@architect` (ADR).
- **Goal**: Clear acceptance criteria and architectural consensus.

### 2. Design & UX (The Bridge)
- **Actor**: `@ux-designer`.
- **Action**: Update `DESIGN.md` with required design tokens and layout specifications for the feature.
- **Goal**: Machine-readable design constraints to prevent visual hallucination.

### 3. Implementation (Execution)
- **Actor**: `@developer`.
- **Action**: Red-Green-Refactor implementation using the `tdd` skill, strictly following `DESIGN.md`.

### 4. Mandatory AI Audits (The Review Gates)
Before asking for human approval, the following gates must be cleared:

- **Gate A: Security Review (`@security`)**
  - Scan for injection, logic flaws, and credential leaks.
  - Verdict: `PASS` required.
- **Gate B: Reliability Review (`@sre`)**
  - Blast-radius analysis and observability (logs/traces) check.
- **Gate C: Compliance Review (`@legal-counsel`)**
  - Dependency license check via `license-audit` skill.

### 5. Human Approval
- Final sanity check and review of the AI audit reports by the user.

### 6. Merge & Close
- Final integration into the `main` branch and closing of tracking issues.
- **GitHub Traceability**: All Pull Requests must have rich descriptions listing technical details and must explicitly link to relevant issues. Partial PRs should use `Ref #<issue_number>` and implementation PRs must use `Closes #<issue_number>` or `Fixes #<issue_number>` to ensure automatic closing on human merge.

---

## Usage
Trigger the cycle via the orchestrator:
> *"@ooda-orchestrator, start the development for [feature]. Coordinate the team and clear all audit gates before my review."*
