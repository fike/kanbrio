# Pull Request Description

> **English only.** Per `AGENTS.md`, all GitHub communications (PR titles, descriptions, commit messages, issue comments) must be written exclusively in English. This template enforces that policy.

## 🎯 Context and Value
<!-- Briefly describe the user journey this PR resolves and the business value / impact it delivers. -->

**Related Issue:** Closes #<issue_number> / Beads ID: <beads_id>

---

## 🛠️ Changes Made

<!-- Describe the technical changes, grouped logically and hierarchically by component. Use "N/A" for sections that do not apply. -->

### 💾 1. Database (DDL & Migrations)
* [e.g., Added table `workspace_members` in `apps/api/migrations/...sql`]

### ⚙️ 2. Backend (Rust & Axum)
* [e.g., Added endpoint `POST /api/workspaces` in `apps/api/src/handlers/auth.rs`]

### 🖥️ 3. Frontend (SolidJS & DESIGN.md)
* [e.g., Updated design tokens and implemented a creation modal in `apps/web/src/components/...tsx`]

---

## 📸 Visual Proof (UI/UX)
<!-- Include screenshots or GIFs demonstrating the visual change — especially the interactive loading, error, empty, and success states. -->

| Before | After |
| :---: | :---: |
| [Old screenshot] | [Screenshot/GIF demonstrating the new interactive flow] |

---

## 🧪 Test Suite Ran (Output Logs)

### Backend tests (Rust Cargo)
```bash
# Paste the success logs of `cargo test` here.
```

### Frontend & E2E tests (Vitest / Playwright)
```bash
# Paste the success logs of the SolidJS (Vitest) and E2E (Playwright) runs here.
```

---

## 🔒 AI Audit Gates (Quality Gates)

Per `AGENTS.md`, three audits must be declared on every PR that touches security, reliability, or third-party dependencies. For documentation-only PRs, write `N/A`.

* **Security (`@security`):** [PASS / PENDING / N/A] — Input sanitization, session cookie validation, tenant isolation.
* **Reliability (`@sre`):** [PASS / PENDING / N/A] — Concurrency analysis, pessimistic row locks, database indexes, observability gaps.
* **Compliance (`@legal-counsel`):** [PASS / PENDING / N/A] — Third-party license audit via the `license-audit` skill.

---

<!-- Footer marker: include `Closes #N` for full implementations or `Ref #N` for partial implementations, as declared in AGENTS.md. -->
