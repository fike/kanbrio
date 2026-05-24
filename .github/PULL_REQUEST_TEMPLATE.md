## Context
<!-- Describe the problem being solved or the value being added -->


## Closes
<!-- Reference the original Issue (e.g., Closes #X) -->
Closes #

## Changes Made
<!-- Briefly list the technical changes made in this PR -->
- 
- 

## 🤖 Mandatory AI Audits (The Review Gates)
<!-- As a solo developer, you must invoke the following agents to audit this PR before merging. Check the boxes once they provide a "PASS" verdict. -->

- [ ] **Gate A: Security Review (`@security`)**
  - Prompt: *"@security, audit this PR for injection, logic flaws, and credential leaks."*
- [ ] **Gate B: Reliability Review (`@sre`)**
  - Prompt: *"@sre, perform a blast-radius analysis and check observability (logs/traces) for this PR."*
- [ ] **Gate C: Compliance Review (`@legal-counsel`)**
  - Prompt: *"@legal-counsel, perform a dependency license check for new additions in this PR."*

## Developer Sanity Check
- [ ] CI pipeline is green (Lint, Format, Tests).
- [ ] `DESIGN.md` visual tokens were strictly followed (if UI changes are included).
