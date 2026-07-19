# Contributing to Kanbrio

Welcome, and thank you for considering a contribution to Kanbrio. This document explains how to set up the project, run the test suite, and submit a pull request that is likely to be accepted.

Kanbrio is an open-source, agent-first flow-management system. We accept code, documentation, and design contributions of any size as long as they align with the project's vision and meet the quality bar described below.

## Project vision

Kanbrio is an AGPL-3.0 distributed **flow management system** built around three pillars:

1. **Native probabilistic forecasting** — a Monte Carlo engine written in Rust.
2. **Recursive hierarchical roll-ups** — unlimited nesting via PostgreSQL recursive CTEs.
3. **Agent-first architecture** — designed to be operated by AI agents and humans in the same workflow.

Before opening a feature PR, please read [`docs/product/discovery.md`](../docs/product/discovery.md) and [`docs/product/roadmap.md`](../docs/product/roadmap.md) to confirm the change fits the stated direction. Contributions that conflict with the vision are likely to be closed with a pointer to this file.

## Before you start

- Open an issue before investing significant time in a PR. A short design sketch in the issue lets us tell you quickly whether the proposal is in scope.
- If you are looking for a beginner-friendly task, filter issues by the [`good first issue`](https://github.com/fike/kanbrio/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22) label.
- Maintainers aim to acknowledge issues within **7 calendar days** of submission. If you have not heard back in that window, kindly ping the thread — we may have missed it.

## Repository layout

The repository is a monorepo. See [`docs/organization/organization.md`](../docs/organization/organization.md) for the full tree. The most important folders:

```
apps/api      Rust + Axum backend (SQLx, PostgreSQL 16)
apps/web      SolidJS frontend (Vite, Tailwind, Chart.js)
apps/e2e      Playwright E2E suite
docs/         Product discovery docs, ADRs, architecture specs
docker/       Compose stack and per-service configs
.agents/      Subagents and skills consumed by the OODA orchestrator
```

## Prerequisites

| Tool | Version | Notes |
|:---|:---|:---|
| Rust | stable | `rustup default stable` (a nightly toolchain is also used in CI for forward-compat matrixing) |
| Node.js | ≥ 20 | `nvm install 20` |
| npm workspaces | bundled | `npm ci` at repo root |
| Docker Compose v2 | latest | Required to run Postgres and the observability stack locally |
| pre-commit | ≥ 3 | `brew install pre-commit && pre-commit install` |

Optional but useful:
- `cargo-watch` for live backend rebuilds during development.
- `just` or `make` for running the convenience targets.

## Setting up a local environment

```bash
# 1. Clone
git clone git@github.com:fike/kanbrio.git
cd kanbrio

# 2. Bootstrap env file
cp .env.example .env   # tweak POSTGRES_PASSWORD etc.

# 3. Start the development stack (Postgres + API + Web)
make compose          # equivalent to `docker compose up -d --build`

# 4. Wait for services to be healthy
docker compose ps

# 5. (Optional) populate the database with rich demo data
make demo             # destructive — TRUNCATEs all tables

# 6. Run the API tests
make test-api         # cargo test inside apps/api

# 7. Run the web tests
cd apps/web && npm test   # vitest run
cd -

# 8. (Optional) E2E suite
make compose-test     # spin up a test stack with seed data
cd apps/e2e && npx playwright test
cd -
```

## How to run tests

Kanbrio has three test suites. Please run the relevant suite(s) before opening a PR:

### Backend — Rust + Axum

```bash
cd apps/api
cargo test --all-targets
```

CI also runs `cargo fmt --check` and `cargo clippy -D warnings`. Run them locally:

```bash
cd apps/api
cargo fmt
cargo clippy --all-targets -- -D warnings
```

### Frontend — SolidJS + Vitest

```bash
cd apps/web
npm run test      # one-shot
npm run lint       # ESLint
npm run build      # tsc -b && vite build
```

### End-to-end — Playwright

```bash
make compose-test
cd apps/e2e
npx playwright test
cd -
```

The E2E specs live in `apps/e2e/tests/` and share a global setup that boots the test stack and creates a demo user. If you add a new spec, ensure it works against the seed data produced by `scripts/demo.sql`.

### Observability stack (optional)

If your change touches tracing, metrics, logging, or the OTel collector config:

```bash
make compose-observability      # jaeger, prometheus, loki, grafana, otel-collector
make compose-logs              # tail them
```

## Branching and commit conventions

- Create a feature branch off `main`: `git switch -c <prefix>/<short-description>`.
- Branch prefixes: `feat/`, `fix/`, `docs/`, `chore/`, `test/`.
- Keep branches short-lived (≤ 7 days).
- Use [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) messages, e.g.:
  ```
  feat(api): add monte carlo "how many" simulation endpoint

  Explain *why* this matters beyond the obvious. Reference the issue.

  Refs #NNN
  ```
- Do not push directly to `main`. All changes go through a pull request.
- Only human maintainers merge into `main`. AI agents must not run `git merge` to `main` or auto-merge PRs.

## Opening a pull request

- The PR title should mirror the commit subject (Conventional Commits format).
- The PR body must conform to the [PR template](.github/pull_request_template.md). Key sections: Context and Value, Related Issue (with `Closes #N`), Changes by Layer, Visual Proof, Test Logs, AI Audit Gates.
- For partial implementations, use `Ref #N` instead of `Closes #N`.
- **English only** — PR titles, descriptions, commit messages, and issue discussions must be in English. This policy is declared in [`AGENTS.md`](AGENTS.md) and applies to humans and AI agents equally.
- Pre-commit hooks must pass locally. They include `detect-secrets`, trailing-whitespace fixes, YAML validation, Frontend Quality Gate (`tsc --noEmit`, `eslint`, `vite build`), Rust `fmt`, and `clippy -D warnings`.

After you submit a PR:

- A maintainer will triage it within 7 days and either request changes, approve, or close with rationale.
- CI must be green before merge. If CI is red for an environment-related reason (flaky E2E, transient network), call it out — we will rebake.

## Three mandatory AI audit gates

When a change touches security, reliability, or third-party dependencies, the PR description must declare PASS / PENDING for each of the three audit agents documented in `.agents/agents/`:

- **`@security`** — threat modeling and OWASP review. Triggered by changes to auth, input handling, file I/O, network calls, or secrets.
- **`@sre`** — blast radius, observability gaps, runbooks. Triggered by changes to routing, persistence, or runtime configuration.
- **`@legal-counsel`** — third-party license compatibility against the AGPL/Apache dual policy. Triggered when a new dependency is proposed.

Most documentation-only PRs can declare N/A for the three gates. When in doubt, ask.

## Backlog tracking

Kanbrio uses **beads** (`bd`) for sustained issue tracking alongside GitHub Issues. Both copies are kept in sync via `--external-ref`. If you are an AI agent, read [`AGENTS.md`](AGENTS.md) for the full workflow. For human contributors, just opening a GitHub issue is sufficient — a maintainer will mirror it to beads if needed.

## License

By contributing you agree that your contributions are licensed under [GNU AGPL-3.0](LICENSE). Any new files must include the AGPL-3.0 header unless they are private assets or explicitly exempted by the legal-counsel agent.

## Questions and coordination

- For design or scope questions, open a GitHub Issue with the `question` label.
- For security-sensitive matters, see [`SECURITY.md`](.github/SECURITY.md) — **do not** open a public issue for vulnerabilities.

Thank you for helping Kanbrio become a reliable, predictable, and honest flow-management system.
