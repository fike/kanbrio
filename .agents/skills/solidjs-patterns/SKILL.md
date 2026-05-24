---
name: solidjs-patterns
description: Idiomatic Solid.js development (Signals, no VDOM, native primitives).
---

# SolidJS Patterns Skill

This skill ensures that frontend code is written according to Solid.js's fine-grained reactivity principles, preventing framework hallucinations.

## 1. Fine-Grained Reactivity (No VDOM)

- **CRITICAL**: Solid.js does NOT use a Virtual DOM. Component functions only run ONCE.
- **Action**: Do not use patterns that rely on component re-renders (like putting complex logic at the top level of a component).
- **Signals**: Use `createSignal` for local state. Access values by calling them as functions: `mySignal()`.

## 2. Control Flow Primitives

- Use native Solid primitives instead of JavaScript array methods inside JSX:
  - `<For each={list()}>{(item) => ...}</For>` (Not `list().map()`).
  - `<Show when={condition()}>...</Show>` (Not `condition() && ...`).
  - `<Index>` for primitive lists.

## 3. Anti-Hallucination: Forbid React Patterns

- **NEVER** use `useState`, `useEffect`, or `useCallback`.
- **NEVER** use `React.useMemo`. Use `createMemo` instead.
- **NEVER** destructure props in the function signature (e.g., `function MyComp({ name })`). This breaks reactivity. Access props as `props.name`.

## 4. Derived State

- Prefer `createMemo` for expensive computations.
- Simple derived values should just be functions: `const fullName = () => `${firstName()} ${lastName()}`;`.
