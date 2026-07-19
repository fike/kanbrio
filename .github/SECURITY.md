# Security Policy

Kanbrio is open-source software licensed under [GNU AGPL-3.0](../LICENSE). This document explains how to responsibly report security vulnerabilities and what response time to expect.

## Supported versions

Kanbrio is pre-1.0 software. Only the latest `main` branch and the most recent tagged release receive security fixes. There is currently no backport policy.

| Version | Supported |
|:---|:---|
| `main` (HEAD) | ✅ Active development |
| Latest tag (see Releases) | ✅ Security fixes only |
| Older tags | ❌ Unsupported |

## Reporting a vulnerability

**Do NOT open a public GitHub issue to report a security vulnerability.**

Please report vulnerabilities through one of these private channels, in order of preference:

1. **GitHub Private Vulnerability Reporting** — Open the repository's Security tab and click *"Report a vulnerability"* to start a private advisory. This is the preferred channel because it preserves an audit trail and lets us coordinate disclosure atomically.
   - Direct link: <https://github.com/fike/kanbrio/security/advisories/new>
2. **Email** — Send a description of the issue to `security@kanbrio.dev` with `[SEC]` in the subject line. PGP-encrypted reports are welcome; request the public key in a separate, unsigned message.

Include, where possible:

- A description of the issue and its impact.
- A minimal reproduction (steps, commands, or a small script).
- Affected versions or commit SHAs.
- Any suggested remediation you have already drafted.

## Service-level expectations

| Milestone | Target |
|:---|:---|
| Acknowledgement of report | 72 hours |
| Initial triage & severity rating | 7 days |
| Patch for high-severity issues | 14 days from acknowledgement |
| Patch for medium / low-severity issues | Best-effort within 30 days |
| Public disclosure coordination | After a fix is released, or after 90 days from report (whichever comes first), unless you request otherwise |

These targets are best-effort. The project is currently maintained by a small team; if you do not hear back within the SLA window, please follow up by replying to the original thread.

## Scope

In scope:

- The Rust backend (`apps/api`), SolidJS frontend (`apps/web`), Playwright E2E harness (`apps/e2e`), and the docker-compose stack.
- Authentication, session handling, multi-tenant isolation, and authorization.
- SQL injection, path traversal, SSRF, and other OWASP Top 10 categories that affect the project's REST/WS API attack surface.

Out of scope:

- Vulnerabilities in third-party dependencies not directly exploitable through Kanbrio. Please report those upstream and (optionally) open a public issue so we can track and upgrade.
- Theoretical timing attacks that require privileged physical access to the host.
- Self-XSS or issues requiring the victim to run arbitrary code on their own account.
- Default credentials in demo / seed data (`scripts/demo.sql`, `scripts/seed.sql`) — these are documented and intended for local development only.

## License compatibility note

Kanbrio is AGPL-3.0. Security patches are released under the same license, consistent with [Section 13 of the AGPL-3.0](https://www.gnu.org/licenses/agpl-3.0.html#section13). There is no proprietary or dual-licensed release channel.

## Acknowledgements

We are grateful to the security researchers who responsibly report vulnerabilities. With your permission, we will list your name (or handle) in the corresponding GitHub Security Advisory and in the CHANGELOG entry for the fix. Let us know if you prefer to remain anonymous.
