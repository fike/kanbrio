---
name: tdd
description: Red-Green-Refactor cycle and unit testing standards.
---

# Test-Driven Development (TDD) Skill

This skill enforces the Red-Green-Refactor cycle to ensure code correctness and high test coverage.

## 1. The Red-Green-Refactor Cycle

1. **RED**: Write a failing test for the next bit of functionality you want to add.
   - The test must fail for the expected reason.
   - Run the test suite to confirm the failure.
2. **GREEN**: Write the minimal amount of code to make the test pass.
   - Do not worry about code quality at this stage.
   - Run the tests to confirm they pass.
3. **REFACTOR**: Clean up the code while keeping the tests green.
   - Remove duplication.
   - Improve naming.
   - Apply `clean-code` and `refactoring` skills.

## 2. Testing Standards

- **Isolation**: Unit tests should test one thing in isolation. Use mocks/stubs for external dependencies.
- **Descriptive Naming**: Test names should describe the scenario and expected outcome (e.g., `should_return_error_when_wip_limit_exceeded`).
- **Meaningful Assertions**: Focus on testing behavior and outcomes, not implementation details.
- **No Flaky Tests**: Tests must be deterministic.
