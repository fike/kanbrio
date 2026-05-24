---
name: refactoring
description: Boy Scout Rule and identification of code smells.
---

# Refactoring Skill

This skill guides the process of improving existing code without changing its external behavior.

## 1. The Boy Scout Rule

"Leave the code cleaner than you found it."
- If you see a small issue (poor naming, long line), fix it as part of your current task.
- Do not let technical debt accumulate.

## 2. Identifying Code Smells

- **Long Method**: Extract smaller functions.
- **Duplicate Code**: Create shared abstractions.
- **Large Class**: Split into smaller, specialized components.
- **Primitive Obsession**: Use meaningful types/structs instead of raw strings/integers for domain concepts (e.g., `UserId` instead of `String`).

## 3. Safe Refactoring

- **Test Safety Net**: NEVER refactor without passing tests.
- **Small Steps**: Perform refactoring in small, incremental steps. Run tests after each step.
- **Don't Mix Tasks**: Do not add new features while refactoring. Finish the refactor, commit, then add the feature.
