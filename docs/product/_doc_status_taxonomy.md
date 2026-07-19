# Document Status Taxonomy

Kanbrio's discovery / mini-PRD / user-stories documents each carry a `Status` field at the top of the document (in Markdown's `**Status:** <value>` convention, or — for any new docs going forward — in a YAML frontmatter block). The status transitions are:

| Status | Meaning | Where it can go |
|:---|:---|:---|
| `Draft` | First pass; reviewer not yet engaged. Changes freely. | → `Discovery Complete` once the @product-manager signs it off. |
| `Discovery Complete` | Discovery and user stories are validated against the BENCHMARK and ROADMAP; mini-PRD can be drafted. | → `Engineering Ready` once the matching mini-PRD is approved. |
| `Engineering Ready` | Mini-PRD has AC clear, API contracts defined, tracking issue opened in beads and GitHub. The `@developer` agent or a human contributor can pick it up. | → `[Archived]` once shipped via merged PR(s). |
| `[Archived]` | The work has shipped; the document is kept for the historical record. No further edits expected. | Terminal. A new follow-up doc opens in `Draft` if revisions are needed. |

## What changes in each status

* A doc moves **forward only** on the canonical path above; never backward to an earlier status.
* If a discovery doc loses validity before its PRD ships, document the rationale in the doc body and keep at `Draft` or add a `Superseded by` pointer.
* Status changes should be made in a single commit per change so the historian can pinpoint when a doc became Engineering Ready vs when it shipped.

## Naming conventions (for future work)

Existing docs use a mix of `vX.Y_*`, `*_strategy`, `MINI-PRD-*` and plain nouns. The existing files will be renamed in a follow-up issue (registered separately) for bibliographic consistency. New docs should follow this pattern:

```
docs/product/vX.Y_<topic>_discovery.md       (Discovery)
docs/product/vX.Y_<topic>_mini_prd.md        (Mini-PRD)
docs/product/vX.Y_<topic>_user_stories.md    (User stories, if separate from discovery)
```

For work that crosses multiple milestones (e.g., business_rules, observability, ws-sync, onboarding), use the `<topic>` form without a version prefix.

## Updating the discovery backlog

When a discovery or mini-PRD advances status, also update the corresponding issue in beads (`bd update <id>`) and on GitHub (via the PR that lands the doc edit). The `Status:` line in the doc is the source of truth for the historical record; the bead/GH issue status is the source of truth for the active backlog.
