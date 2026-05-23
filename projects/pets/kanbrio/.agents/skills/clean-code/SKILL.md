---
name: clean-code
description: Naming conventions, function design, and readability standards.
---

# Clean Code Skill

This skill provides the standards for writing readable, maintainable, and professional code.

## 1. Naming Conventions

- **Intention-Revealing**: Names should tell you why it exists, what it does, and how it is used.
- **Avoid Disinformation**: Do not use names that have a specific technical meaning (e.g., `accountList`) if the variable is not that type.
- **Pronounceable & Searchable**: Avoid abbreviations like `c_tr_id`; use `card_transition_id`.

## 2. Function Design

- **Small**: Functions should be small (ideally < 20 lines).
- **Do One Thing**: A function should perform exactly one task.
- **Single Level of Abstraction**: All statements within a function should be at the same level of abstraction.
- **Arguments**: Minimize the number of arguments (ideally 0-2).

## 3. General Principles

- **DRY (Don't Repeat Yourself)**: Avoid code duplication by extracting common logic into shared functions or modules.
- **Explain Yourself in Code**: Use comments only when code cannot express the intent. Prefer refactoring a complex expression into a named variable or function.
- **Error Handling**: Use exceptions or `Result` types rather than returning error codes or nulls.
