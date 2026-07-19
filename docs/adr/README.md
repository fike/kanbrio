# Architecture Decision Records (ADRs)

This directory holds Kanbrio's Architectural Decision Records — short, immutable documents capturing architecturally significant decisions and their rationale. Decisions that are NOT yet accepted stay here too: the goal is to leave a paper trail, not to suppress alternatives.

## Format

Kanbrio follows the [Michael Nygard template](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions) popularized in 2011. Each ADR is a single Markdown file named `NNN-kebab-case-title.md` where `NNN` is a zero-padded sequence number. See [_template.md](_template.md) for a blank starter.

## Status enum

Every ADR carries a `Status` field at the top. The status transitions are:

| Status | Meaning |
|:---|:---|
| `Proposed` | Decision is drafted but not yet endorsed by the project maintainer. Code that depends on it should not ship yet. |
| `Accepted` | Decision is active. Code that depends on it can ship and reference this ADR. |
| `Accepted (Revised)` | The decision is active but has been amended at least once; read the body fully before relying on the summary. |
| `Superseded` | Replaced by a later ADR. The replacement must be linked in the body. |
| `Deprecated` | No longer relevant but kept for the historical record. Code that depends on it should be migrated away. |

## Index

| # | Title | Status | Date | Decides |
|:---|:---|:---|:---|:---|
| [001](001-backend-language.md) | Backend Language Selection (Go vs. Rust) | Accepted | 2026-05-22 | Rust over Go for the backend. |
| [002](002-web-framework.md) | Web Framework Selection (Axum) | Accepted | 2026-05-22 | Axum as the Rust web framework. |
| [003](003-data-core-design.md) | Data Core Design (Hierarchy & Event Logging) | Accepted | 2026-05-22 | PostgreSQL hybrid schema (adjacency list + recursive CTE + JSONB custom fields). |
| [004](004-frontend-stack.md) | Frontend Stack Selection (SolidStart, Pragmatic DnD, ECharts) | Accepted (Revised) | 2026-05-22 | SolidJS, Tailwind, Pragmatic DnD, Chart.js. |
| [005](005-arrival-departure-rules.md) | Arrival & Departure Rules (Checklists & Column Policies) | Accepted | 2026-05-29 | Relational tables (`card_checklists`) over JSONB for checklist policies. |

## How to add a new ADR

1. Copy `_template.md` to `NNN-short-kebab-title.md` (pick the next free sequence number).
2. Fill in all sections: Title, Status, Date, Owner, Context, Decision, Consequences.
3. List any superseded ADRs by number, and update the superseded ADR's status to `Superseded` with a back-reference to the new one.
4. Add a row to the Index table above.
5. Reference the ADR number from the code or doc that depends on it (e.g., in a mini-PRD's design reference section).

## Useful external references

- [adr.github.io](https://adr.github.io/) — formal homepage of the ADR GitHub organization, hosting the markdown template, MADR variant, and tooling pointers.
- [Documenting Architecture Decisions (Michael Nygard, 2011)](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions) — the original blog post that popularized the format.
- [Open Practice Library: ADR](https://openpracticelibrary.com/practice/architectural-decision-records-adr/) — community practice entry on ADRs.

## License

ADRs are licensed under the repository's root [AGPL-3.0](../../LICENSE). Derivative OSS projects are welcome to copy the template verbatim with attribution per Section 13.
