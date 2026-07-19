# OSS Maturity Plan — 5 Vertical Slices

> **Status:** Planning · **Epic:** [#114](https://github.com/fike/kanbrio/issues/114) (GitHub) / `kanbrio-vc4` (beads)
> **Authors:** Fernando Ike · **Last updated:** 2026-07-18

This document is the single source of truth for closing Kanbrio's gap to mature open-source project-management tools. It complements the per-slice GitHub/beads issues tracked under the same epic. Each slice is designed to ship as one PR reviewable in one session.

---

## Why this plan exists

Kanbrio is an AGPL-3.0 agent-first flow-management system, but it currently lacks:

- **Governance foundations** (`CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `CODEOWNERS`) — the only contributor surface is `AGENTS.md`, written in Portuguese and aimed at AI agents, not human contributors.
- **Release engineering** — zero git tags, no `CHANGELOG.md`, no release workflow, version frozen at `0.1.0` in `apps/web/package.json` despite 7 shipped internal milestones.
- **CI coverage** — `ci.yml` runs only 2 jobs (unit + lint + build); the 10 Playwright E2E specs in `apps/e2e/` are orphaned from CI; `cargo deny` is configured but never invoked; no Dependabot.
- **Docs bibliographic discipline** — flat `docs/` folder, no index, 4 ADRs mis-styled as "Proposed" despite being shipped, root cluttered with strategic docs and test artifacts.
- **Discovery man坦诚** — personas are synthetic without disclosure; RICE/MoSCoW declared in skills but never applied; competitive analysis is a one-shot snapshot with no cadence.

This plan attacks these gaps in 5 vertical slices, each one shippable as one PR.

---

## Slices overview

| # | Slice | GH Issue | Beads ID | Status | Files touched |
|:--|:------|:---------|:---------|:------:|:--------------|
| 1 | Trust & Contribution Foundations | [#115](https://github.com/fike/kanbrio/issues/115) | `kanbrio-vc4.1` | OPEN | `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `.github/SECURITY.md`, `.github/CODEOWNERS`, `.github/FUNDING.yml` |
| 2 | English Conformance + Template Hygiene | [#116](https://github.com/fike/kanbrio/issues/116) | `kanbrio-vc4.2` | OPEN | `.github/pull_request_template.md`, `.github/ISSUE_TEMPLATE/bug_report.yml`, `.github/ISSUE_TEMPLATE/config.yml`, `.github/ISSUE_TEMPLATE/feature_request.md`, `AGENTS.md` |
| 3 | CI Safety Net + Dependabot | [#117](https://github.com/fike/kanbrio/issues/117) | `kanbrio-vc4.3` | OPEN | `.github/workflows/ci.yml`, `.github/dependabot.yml` |
| 4 | Release v0.1.0 — CHANGELOG + tag + workflow | [#118](https://github.com/fike/kanbrio/issues/118) | `kanbrio-vc4.4` | OPEN | `CHANGELOG.md`, `.github/workflows/release.yml`, `apps/web/package.json`, `docs/processes/release.md` |
| 5 | Docs Consolidation + ADRs + Discovery Disclosure + design.md follow-up | [#119](https://github.com/fike/kanbrio/issues/119) | `kanbrio-vc4.5` | OPEN | `docs/README.md`, `docs/adr/*`, `docs/product/discovery.md`, root moves + stubs, `TEST_PR.md` (deleted), `review_report.md` (moved) |

### Suggested execution order

```
Slice 1 ─┐                                   (governance: independent)
Slice 2 ─┤                                   (templates: independent)
Slice 3 ─┼─→ Slice 4 ─→ tag v0.1.0           (release needs CI green)
Slice 5 ─┘                                   (docs: can run parallel; design.md follow-up registered)
```

All slices are parallelizable **except** that cutting tag `v0.1.0` (Slice 4 last step) should happen after Slice 3 is merged so the release workflow runs against fully green CI.

---

## Slice 1 — Trust & Contribution Foundations

**Goal:** Make the repository ready for external human contributors.

Files:
- `CONTRIBUTING.md` (root, English) — how to fork, build, run, test, submit PR; branch & PR policy; `good first issue` label usage; expected maintainer SLA (7 days).
- `CODE_OF_CONDUCT.md` (root) — [Contributor Covenant 2.1](https://www.contributor-covenant.org/version/2/1/code_of_conduct/) verbatim.
- `.github/SECURITY.md` — AGPL-3.0 reminder + private vulnerability reporting channel + SLA (72 hour acknowledgement, 14 day patch for high-severity).
- `.github/CODEOWNERS` — entries for `/`, `/apps/api/`, `/apps/web/`, `/apps/e2e/`, `/docs/` (initial owner `@fike`; expandable).
- `.github/FUNDING.yml` — empty/commented placeholder for future sponsorship hooks.

**Acceptance:** 5 files at the exact paths; pre-commit hooks pass.

---

## Slice 2 — English Conformance + Issue/PR Template Hygiene

**Goal:** Resolve the English-only policy violation and close the bug-intake gap.

Changes:
- Rename `.github/PULL_REQUEST_TEMPLATE.md` → `.github/pull_request_template.md` (lowercase, GitHub spec).
- Translate PR template body to English while keeping the Kanbrio structure (Context/Value, Closes #N / Beads ID, structured changes by layer DB/Backend/Frontend, before/after visual proof, test log paste blocks, three AI audit gates `@security` / `@sre` / `@legal-counsel`).
- Add `.github/ISSUE_TEMPLATE/bug_report.yml` (YAML Issue Form) — fields: Repro steps (textarea, required), Expected, Actual, Environment, Severity (dropdown), Version. Labels: `bug, status: needs-triage`. Title prefix `[Bug]`.
- Add `.github/ISSUE_TEMPLATE/config.yml` chooser — 3 options (Bug, Feature, Question), `blank_issues_enabled: false`.
- Update `feature_request.md` initial label from `needs-pm-review` to `needs-triage` (aligns with new pipeline).
- Update `AGENTS.md` to reference the lowercase PR template filename.

**Acceptance:** zero PT-BR strings in the PR template; `bug_report.yml` validates against the GitHub Issue Forms schema; chooser renders on new-issue creation.

---

## Slice 3 — CI Safety Net + Dependabot

**Goal:** Make CI catch regressions beyond unit tests, and keep lockfiles current automatically.

CI additions to `.github/workflows/ci.yml` (currently 2 jobs):

- `e2e` job — runs the 10 Playwright specs in `apps/e2e/tests/` via `make compose-test` (docker-compose-test.yml + Postgres service + 60 second readiness wait).
- `cargo-deny` job — uses `EmbarkStudios/cargo-deny-action@v2`, runs `deny check bans licenses sources` against `apps/api/deny.toml` (file already exists, never invoked today).
- `cargo-audit` job — uses `rustsec/audit-check@v2.0.0` to scan `apps/api/Cargo.lock` for known CVEs.
- Top-level `concurrency: { group: ${{ github.ref }}, cancel-in-progress: true }` — cancel stale runs on new commits.
- Matrix strategy `stable + nightly` for the `backend` job, with `continue-on-error: true` for `nightly` (catches future Rust regressions without blocking).

Dependabot (`.github/dependabot.yml`):

- 3 ecosystems: `/`, `apps/api`, `apps/web`.
- `interval: weekly`, `day: monday`.
- `open-pull-requests-limit: 5` per ecosystem.
- Labels: `dependencies, area: infra`.

**Acceptance:** 5+ CI jobs green on `main`; `e2e` reports 10/10 specs; `cargo-deny` green; Dependabot opens its first PR within 14 days of merge.

---

## Slice 4 — Release v0.1.0 — CHANGELOG + tag + workflow

**Goal:** Produce Kanbrio's first versioned release artifact.

Files:
- `CHANGELOG.md` (new, root) — follows [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) format:
  - `## [Unreleased]` section at the top (empty, ready to receive entries).
  - `## [0.1.0] - <merge-day-date, ISO 8601>` section with retroactively-compiled entries from `git log` covering the shipped milestones (workspace core, auth, WIP limits, analytics, transitions/blockers, card creation, task hierarchy, business rules, observability stack).
  - Standard sections: Added / Changed / Deprecated / Removed / Fixed / Security (only populated where applicable).
- `.github/workflows/release.yml` (new) — triggers on tag push `v*.*.*`, runs `cargo build --release` + `npm run build`, generates GitHub Release with body = matching CHANGELOG section, attaches the built binary.
- `apps/web/package.json` — version stays `0.1.0` (already aligned).
- `docs/processes/release.md` (new) — 3 sections: tag → push → CI flow, SemVer policy per [semver.org](https://semver.org), how to update CHANGELOG.
- Tag `v0.1.0` — created by the maintainer *after* PR merge via `git tag v0.1.0 && git push --tags`; `release.yml` fires automatically. Not in the PR.

**Acceptance:** `CHANGELOG.md` follows Keep-a-Changelog 1.1.0; `release.yml` produces a populated GitHub Release when tag `v0.1.0` is pushed; `docs/processes/release.md` defines semver policy and the patch-tagging ritual.

---

## Slice 5 — Docs Consolidation + ADRs + Discovery Disclosure + design.md follow-up

**Goal:** Establish bibliographic discipline across `docs/`, clean root doc-noise, declare research provenance honestly, and register the Google Labs `design.md` spec migration as future work.

### Files in this slice

- `docs/README.md` (new) — navigable index: ADRs, product docs, architecture docs, processes, screenshots.
- Move `DISCOVERY.md` → `docs/product/discovery.md` + 1-line stub at root.
- Move `BENCHMARK.md` → `docs/product/benchmark.md` + stub.
- Move `ROADMAP.md` → `docs/product/roadmap.md` + stub.
- Move `ORGANIZATION.md` → `docs/organization/organization.md` + stub.
- Update inbound references in `GEMINI.md` and `README.md` to point to the new paths.
- `docs/adr/README.md` (new) — ADR index + [Nygard template](https://adr.github.io/) + status enum (`Proposed` / `Accepted` / `Superseded` / `Deprecated`).
- `docs/adr/_template.md` (new) — blank Nygard template (Title / Status / Context / Decision / Consequences).
- Normalize the 5 existing ADR statuses:
  - `001-backend-language.md` → `Accepted` (already ships).
  - `002-web-framework.md` → `Accepted` (Axum in use).
  - `003-data-core-design.md` → `Accepted` (PostgreSQL hybrid in use).
  - `004-frontend-stack.md` → `Accepted (Revised)` (keep current text).
  - `005-arrival-departure-rules.md` → `Accepted` (shipped per PRs #100..#107).
- `docs/product/discovery.md` — add `## Research Provenance` section declaring personas 100% SYNTHETIC (no real users interviewed); tag the existing 3 personas with `SYNTHETIC:` prefix.
- `docs/product/_doc_status_taxonomy.md` (new) — table defining `Draft` / `Discovery Complete` / `Engineering Ready` / `[Archived]` for discovery docs, mini-PRDs, and user stories (applied in a follow-up issue, not here).
- Cleanup:
  - Delete `TEST_PR.md` (test artifact from deleted `test/pr-workflow-test` branch).
  - Move `review_report.md` → `docs/audits/2026-05-security-review.md` (preserve history, drop lowercase from root).
  - Add `.DS_Store` to `.gitignore` and `git rm --cached .DS_Store`.

### `DESIGN.md` stays at root — justification

`DESIGN.md` (110 KB) remains at the repository root for three reasons:

1. **Google Labs `design.md` spec** ([github.com/google-labs-code/design.md](https://github.com/google-labs-code/design.md), v0.3.0-alpha, Apache-2.0) officially defines `DESIGN.md` as the root context file for coding agents — a persistent, structured description of a visual identity that agents read at session start, analogous to Anthropic's `CLAUDE.md`. Kanbrio's agent-first architecture aligns with this convention.
2. **Blast radius** — 13+ internal references across `.agents/skills/*`, `.agents/agents/developer.md`, `.agents/agents/ux-designer.md`, 8 mini-PRDs, 2 user-stories, and the PR template. Moving would break the agentic workflow chain.
3. **Identity** — Kanbrio is "agent-first by nature"; `DESIGN.md` is the canonical root context file consumed by `@ux-designer` and `@developer` agents. By the same convention that keeps `CLAUDE.md` and `AGENTS.md` at root, `DESIGN.md` belongs there.

### design.md spec migration — registered future work (not executed here)

A follow-up issue (separate from this epic, opened after Slice 5 ships) will evaluate migrating Kanbrio's `DESIGN.md` from pure free-form Markdown to the `design.md` v0.3.0-alpha spec format (YAML front matter for design tokens + Markdown body for rationale). Benefits: enables tooling `npx @google/design.md lint` (validates structure, broken refs, WCAG contrast ratios), `diff` (token-level regression detection), and `export` (Tailwind v3/v4 + W3C DTCG). Deferred to post-v0.1.0 release; this slice only registers the gap.

**Acceptance:**
- `find . -maxdepth 1 -name '*.md' -type f` returns only canonical root docs (README, AGENTS, CLAUDE, GEMINI, DESIGN, plus the 4 stubs + new FROM Slices 1/4 and CONTRIBUTING/CODE_OF_CONDUCT/CHANGELOG).
- No lowercase `.md` remains in root (`review_report.md` moved, `TEST_PR.md` deleted).
- `.DS_Store` is gitignored and untracked.
- `docs/README.md` lists all docs under `docs/` with zero 404 internal links.
- All 5 ADRs use a valid status from the enum.
- `docs/product/discovery.md` has a Research Provenance section and personas tagged `SYNTHETIC:`.
- Inbound refs in `README.md` and `GEMINI.md` point to new paths.

---

## Explicitly deferred (non-goals for this epic)

- **RICE / MoSCoW retro application** on the 24 existing product docs — runs after Slice 5 ships so the doc-status taxonomy exists.
- **Recurring competitive refresh ritual** (benchmark drift log) — runs after Slice 5 to use `docs/product/benchmark.md` as the canonical place.
- **User-real research** and GitHub Discussions channel — deferred until the v0.1.0 GitHub Release exists (Slice 4 complete) so external users have an artifact to evaluate.
- **Docs site generator** (Vitepress, Docusaurus, MkDocs) — not in this epic; markdown-only consolidation now; revisit post-v0.1.0.
- **`DESIGN.md` migration to `design.md` v0.3.0-alpha spec** — registered as a separate follow-up issue opened by Slice 5; not executed in this epic.

---

## References (all accessed on 2026-07-18)

1. **OpenProject** — Getting started docs: <https://www.openproject.org/docs/getting-started/> · Contributions guide: <https://www.openproject.org/docs/contributions-guide/> · Development handbook: <https://www.openproject.org/docs/development/> · Release notes: <https://www.openproject.org/docs/release-notes/> · Security statement: <https://www.openproject.org/docs/security-and-privacy/>
2. **GitHub Open Source Guides — Best Practices for Maintainers** — <https://opensource.guide/best-practices/>
3. **GitHub Open Source Guides — Licensing a repository** — <https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository>
4. **Architectural Decision Records (ADR)** — <https://adr.github.io/> (Nygard template, decision log discipline)
5. **Keep a Changelog 1.1.0** — <https://keepachangelog.com/en/1.1.0/> / <https://semver.org/spec/v2.0.0.html>
6. **Google Labs `design.md` spec** — <https://github.com/google-labs-code/design.md> (v0.3.0-alpha, Apache-2.0, 26.1k stars)
7. **Anthropic Claude Code docs** (CLAUDE.md root context convention analogous to `design.md`) — <https://docs.anthropic.com/en/docs/claude-code/overview>
8. **Empirical OSS PM tool inventory** (root file layout): Plane `makeplane/plane` (has AGENTS.md, CODEOWNERS, CONTRIBUTING, SECURITY at root); OpenProject `opf/openproject` (has AGENTS.md, CHANGELOG, CONTRIBUTING, CODE_OF_CONDUCT, CLAUDE.md, SECURITY at root); Taiga `taigaio/taiga-front`; WeKan `wekan/wekan` (CONTRIBUTING approach via `docs/DeveloperDocs/`).

---

## Tracking

- GitHub epic: <https://github.com/fike/kanbrio/issues/114>
- Beads epic ID: `kanbrio-vc4`
- Status updates: change the slice status in the table at the top of this file when each child issue is closed.
