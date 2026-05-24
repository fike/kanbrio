---
name: license-audit
description: Procedures for auditing third-party dependencies for license compatibility and ensuring open-source compliance.
---

# License Audit Skill

This skill ensures that Kanbrio remains legally compliant with its chosen open-source strategy (AGPL-3.0 for apps, Apache-2.0 for packages).

## 1. Compatibility Check

Before adding any new dependency (`cargo add` or `bun add`), the agent must check if its license is compatible:

- **Target App (AGPL-3.0)**: Compatible with MIT, BSD, Apache 2.0, and GPL.
- **Target Package (Apache-2.0)**: Compatible with MIT, BSD. **NOT** compatible with GPL/AGPL (to avoid viral effects on libraries).

## 2. Dependency Scanning

Agents should periodically run the following commands (if tools are available):
- **Rust**: `cargo deny check licenses`
- **Frontend**: `bun x license-checker`

## 3. Attribution Requirements

Ensure every third-party component is properly attributed in a `THIRD_PARTY_NOTICES` file if required by the license (especially for Apache 2.0).

## 4. Forbidden Licenses

Unless explicitly approved by the user, block the following:
- **SSPL**: Non-OSI compliant.
- **Non-Standard/Proprietary**: Avoids "opaque" legal risks.
- **Unlicensed**: Code with no clear license is "All Rights Reserved" and cannot be used.
