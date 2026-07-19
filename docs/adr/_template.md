# ADR NNN: <Decision title>

**Date**: YYYY-MM-DD
**Status**: Proposed | Accepted | Accepted (Revised) | Superseded | Deprecated
**Owner**: <@handle>

> If this ADR supersedes a previous one, link it here:
> **Supersedes**: [ADR NNN](NNN-previous-title.md)
> If this ADR is itself superseded later, link it here:
> **Superseded by**: [ADR NNN](NNN-new-title.md)

## Context

State the problem or opportunity that triggered this decision. Include the forces at play: business pressures, regulatory constraints, technical constraints, team skills, available timelines, cost or performance concerns. The goal is to give a future reader enough context to understand *why* the decision was non-obvious at the time.

Be honest about trade-offs and rejected alternatives. Capture the criteria that matter (e.g., "latency under 100ms", "sub-100MB deployable", "works with Postgres 16-only features").

## Decision

State the decision in a single sentence at the top of this section, followed by the rationale. Use the form "We decided to…" so the reader knows what was actually chosen (not just what was considered).

Include a short list of the rejected alternatives and a one-line reason each. "Go was rejected because of Monte Carlo simulation latency requirements" is far more useful than "Go was considered but rejected."

## Consequences

Document the positive, negative, and neutral consequences of this decision. Be specific about:

- **Positive**: What improves because of this decision?
- **Negative**: What gets harder, slower, or riskier?
- **Neutral**: What new constraints or dependencies appear? What must future contributors know?

If the decision creates follow-up work (a migration, a refactor, an ADR-specific test suite), note it here with a pointer to the tracking issue.

## References

Optional list of external resources, prior ADRs, RFCs, papers, or production incidents that informed this decision. URLs are preferred over bare titles so a reader can verify the source.
