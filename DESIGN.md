# Kanbrio Design System (Machine-Readable Manifest)

This file (`DESIGN.md`) is the single source of truth for the Kanbrio visual identity.
All AI coding agents (like @developer) **MUST** strictly adhere to these tokens and constraints when generating UI code (Solid.js / Tailwind CSS).

## 1. Design Philosophy
- **Vibe:** Enterprise-grade, highly dense, low cognitive load, sober, and fast (zero-latency feel). Inspired by Plane and Linear.
- **Motion:** Fluid and human (inspired by Material 3 Expressive). Avoid snappy/abrupt changes.
- **Accessibility:** Minimum WCAG AA contrast ratio for all text elements.

## 2. Color Tokens (Tailwind mapping)
- **Backgrounds:**
  - `bg-base`: #F9FAFB (Light mode) / #0F172A (Dark mode)
  - `bg-surface`: #FFFFFF (Light) / #1E293B (Dark)
  - `bg-elevated`: #F3F4F6 (Light) / #334155 (Dark)
- **Text:**
  - `text-primary`: #111827 (Light) / #F8FAFC (Dark)
  - `text-secondary`: #4B5563 (Light) / #94A3B8 (Dark)
  - `text-tertiary`: #9CA3AF (Light) / #64748B (Dark)
- **Accents / Semantic:**
  - `accent-primary`: #2563EB (Blue - Default actionable)
  - `status-todo`: #64748B (Slate)
  - `status-doing`: #EAB308 (Yellow)
  - `status-done`: #22C55E (Green)
  - `status-blocked`: #EF4444 (Red)
- **WIP States (Headers & Counts):**
  - `wip-normal`: `text-secondary`
  - `wip-at-limit`: `text-orange-500 bg-orange-50` (Dark: `text-orange-400 bg-orange-900/20`)
  - `wip-exceeded`: `text-red-500 bg-red-50` (Dark: `text-red-400 bg-red-900/20`)

## 3. Typography
- **Font Family:**
  - `font-sans`: Inter, ui-sans-serif, system-ui, sans-serif
  - `font-mono`: JetBrains Mono, ui-monospace, monospace (For data-heavy IDs and logs)
- **Hierarchy:**
  - `h1`: text-2xl, font-semibold, tracking-tight
  - `h2`: text-lg, font-medium, tracking-tight
  - `body`: text-sm, leading-5
  - `caption`: text-xs, text-secondary

## 4. Layout & Spacing
- **Grid System:** 4pt base grid.
- **Density:**
  - Kanbrio is data-dense. Prefer `p-2` or `p-3` for container paddings, avoiding excessive whitespace.
  - Border Radius: `rounded-md` (4px) or `rounded-lg` (6px). No fully rounded elements except avatars.
- **Borders:** `border-base` -> #E5E7EB (Light) / #334155 (Dark).

## 5. Motion Tokens (Solid.js / CSS)
- **Duration:**
  - `micro`: `duration-150` (Micro-interactions).
  - `standard`: `duration-300` (Default movements).
  - `expressive`: `duration-500` (Main board transitions).
- **Easing:**
  - `ease-standard`: `cubic-bezier(0.2, 0, 0, 1)` (Fluid).
  - `ease-expressive`: `cubic-bezier(0, 0, 0, 1)` (Material 3 inspired).

## 6. Accessibility (A11y) Constraints
- Every interactive element must have `focus:ring-2 focus:ring-accent-primary focus:outline-none`.
- Icons must have `aria-label` or `title` attributes.
- **Motion:** Respect `prefers-reduced-motion` media queries.

## 7. Layout Components (2D Board)

This section defines the structural components for the Kanban experience, emphasizing the "Independent Cards + Tags" hierarchy model.

### 7.1 Card Anatomy
- **Structure:** `flex flex-col gap-1 p-3 bg-surface border border-base rounded-md shadow-sm transition-all ease-standard duration-300`.
- **States:**
  - **Blocked:** `border-status-blocked bg-status-blocked/5 ring-1 ring-status-blocked`.
  - **Delayed:** `border-status-doing/50 bg-status-doing/5`.
  - **Dragging:** `opacity-50 scale-105 shadow-xl rotate-1`.
- **Header:**
  - **Parent Breadcrumb:** If `parent_id` exists, show a text-xs tag at the top-left: `text-secondary hover:text-accent-primary cursor-pointer`. Format: `Initiative / ...`.
- **Body:**
  - **Title:** `text-sm font-medium text-primary`. Limit to 2 lines (line-clamp).
  - **Blocker Reason:** If blocked, show `text-xs text-status-blocked font-medium` below the title.
- **Footer:**
  - **Children/Subtasks Indicator:** If children exist, show an icon + progress: `text-xs text-secondary`. Format: `[Subtasks: 2/5]`.
  - **Metadata:** Show `card-id` (JetBrains Mono) and `assignee-avatar` at the bottom-right.

### 7.2 The 2D Grid
- **Columns:**
  - Width: Fixed `300px` to `350px`.
  - Header: `bg-elevated/50 sticky top-0 p-3 border-b border-base flex justify-between items-center`. Includes `Title` and `WIP Count`.
  - WIP Count Indicator: Format as `[Count/Limit]` (e.g., `[3/5]`). Use `wip-normal`, `wip-at-limit`, or `wip-exceeded` based on capacity.
- **Swimlanes:**
  - Divider: `h-10 bg-base/80 sticky left-0 z-10 p-2 flex items-center justify-between border-y border-base`. Includes `Title` and `WIP Count` (optional).
  - Content: Cards are grouped horizontally within these dividers.
- **Empty State:** Columns with no cards should show a subtle dashed placeholder.

### 7.3 Hierarchy Interactions
- Clicking a **Parent Breadcrumb** should navigate to or focus the parent card.
- Clicking the **Children Indicator** should open a side-panel or "Subtree View" showing the full hierarchical branch.
- Moving a card between columns/swimlanes must trigger the `duration-300 ease-complex` transition.

### 7.4 Subtree View (Hierarchy Explorer)
- **Trigger:** Clicking the `Children Indicator` on a card.
- **Visual:** A slide-over panel (Right side, 400px width) or a modal.
- **Content:**
  - **Header:** Current card title + "Hierarchy".
  - **Tree Structure:**
    - Indented list showing ancestors (as breadcrumbs) and descendants (as a nested list).
    - Use `border-l-2 border-base` for indentation lines.
    - Each node: `Title`, `Status Tag`, and `Assignee`.
- **Interactions:**
  - Clicking any node in the tree focuses that card on the board (if present) or navigates to its context.
  - "Add Child" button at each level to quickly create subtasks.

### 7.5 Recursive Breadcrumbs
- **Location:** Top of the Board view when a specific parent filter is active.
- **Format:** `Workspace > Parent > Child > ...`
- **Style:** `text-sm text-secondary`, separator `bg-secondary/20` (chevron icon).

### 7.6 Drag & Drop Engine (Pragmatic D&D)
- **Library:** `@atlaskit/pragmatic-drag-and-drop`.
- **States:**
  - **Dragging (Ghost):** The source element at `opacity-50`.
  - **Preview (Native):** `scale-105 rotate-2 shadow-2xl transition-transform ease-standard duration-150`.
  - **Drop Target (Hover):** `bg-accent-primary/5 border border-dashed border-accent-primary/30`.
- **Insertion Indicator (Line):**
  - A horizontal/vertical line of `2px` with a `4px` dot at the start.
  - Color: `bg-accent-primary`.
- **Optimistic UI Error Handling:**
  - Move card instantly on drop.
  - On Error (e.g., WIP Limit 409 Conflict): Revert position with a `shake` animation (duration-300).
  - **Toast Notification:** Display a transient toast at the bottom right to explain the rejection.
    - Container: `bg-surface border border-status-blocked border-l-4 shadow-xl p-4 rounded-md flex items-center gap-3`.
    - Text: `text-sm font-medium text-primary`.
    - Icon: `ShieldAlert` or `AlertCircle` using `text-status-blocked`.

## 8. Component Styling Guidelines: Login View

This section establishes standard presentation guidelines for the main login gate, supporting zero-friction OAuth onboarding and secure credentials input.

### 8.1 Layout & Container
- **Background Scenery:** `bg-base` with a centered flex layout container.
- **Card Panel Structure:** `w-full max-w-[400px] p-6 bg-surface border border-base rounded-lg shadow-sm flex flex-col gap-6 transition-all duration-300 ease-standard`.
  - **Dark Mode:** `dark:bg-slate-900/50 dark:border-slate-800/80 dark:shadow-xl`.
- **Card Header:**
  - **Title:** `text-2xl font-semibold tracking-tight text-primary` (`h1` hierarchy).
  - **Subtitle:** `text-sm text-secondary` (`body` hierarchy).

### 8.2 OAuth Button Guidelines (Google and GitHub)
Both provider actions must display equal layout prominence. They must adhere to strict branding guidelines while upholding minimum accessibility contrast ratios.
- **Common Layout Structure:** `w-full flex items-center justify-center gap-3 px-4 py-2 border border-base rounded-md font-medium text-sm transition-all duration-150 focus:ring-2 focus:ring-accent-primary focus:outline-none`.
- **Google OAuth Button:**
  - **Light Mode:** `bg-surface hover:bg-elevated active:bg-elevated/80 text-primary border-base`.
  - **Dark Mode:** `dark:bg-slate-800 dark:hover:bg-slate-700/80 dark:active:bg-slate-800/60 dark:text-slate-200 dark:border-slate-700`.
  - **Icon:** Google Multi-color Icon G-brand (`w-4 h-4 flex-shrink-0`).
- **GitHub OAuth Button:**
  - **Light Mode:** `bg-slate-900 hover:bg-slate-800 active:bg-black text-white border-transparent`.
  - **Dark Mode:** `dark:bg-slate-800 dark:hover:bg-slate-700 dark:active:bg-slate-900 dark:text-white dark:border-slate-700`.
  - **Icon:** GitHub Octocat SVG icon (`w-4 h-4 fill-current flex-shrink-0`).

### 8.3 Credentials Form & Input Guidelines
A traditional credentials form is offered as a fallback.
- **Form Layout:** `<form>` styled as `flex flex-col gap-4`.
- **Separator (Horizontal Divider):**
  - **Styling:** `w-full flex items-center gap-3 my-2 text-[10px] font-semibold text-tertiary uppercase tracking-wider before:h-px before:flex-1 before:bg-base after:h-px after:flex-1 after:bg-base`.
- **Form Input Groups:**
  - **Layout:** `flex flex-col gap-1.5`.
  - **Label Typography:** `text-xs font-semibold text-secondary tracking-wide uppercase select-none`. Must include an explicit `for` attribute mapped to the field's `id`.
  - **Input Styling:** `px-3 py-2 text-sm bg-surface border border-base rounded-md focus:border-accent-primary focus:ring-2 focus:ring-accent-primary/20 focus:outline-none transition-all placeholder:text-tertiary text-primary`.

### 8.4 Form State Variations (Hover, Active, Focus, Loading, Error)
- **Hover States:**
  - Input Fields: `hover:border-secondary/50`.
  - Primary Action Button: `bg-accent-primary hover:bg-accent-primary/95`.
- **Active (Press) States:**
  - Action Buttons: `scale-[0.98] transition-transform duration-100`.
- **Focus States:**
  - Interactive elements must apply `focus:ring-2 focus:ring-accent-primary/20 focus:border-accent-primary focus:outline-none`.
- **Loading / Disabled State:**
  - Applied to the form container during network operations. Both input fields and submit buttons must receive the `disabled` property and `aria-disabled="true"`.
  - Display properties: `opacity-60 cursor-not-allowed select-none bg-elevated/50`.
  - Button state changes: Show a high-performance spinner (`w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin`) alongside loading helper text.
- **Field Error State:**
  - Applies to invalid inputs: `border-status-blocked bg-status-blocked/5 focus:ring-status-blocked/20 text-status-blocked placeholder:text-status-blocked/40`.
  - Help text beneath input: `text-xs text-status-blocked font-medium mt-0.5`.
- **Form Error Banner:**
  - Renders at the top of the form: `bg-status-blocked/10 border border-status-blocked/20 text-status-blocked text-xs rounded-md p-3 flex gap-2 items-start animate-shake`.

### 8.5 Access Control and Validation Attributes (TDD & ARIA Constraints)
The developer MUST implement the following testing hooks and ARIA landmarks to ensure seamless test coverage:
- **Login Container:** `data-testid="login-view"`
- **Google Button:** `data-testid="oauth-google-button"` | `role="button"` | `aria-label="Sign in with Google"`
- **GitHub Button:** `data-testid="oauth-github-button"` | `role="button"` | `aria-label="Sign in with GitHub"`
- **Credentials Form:** `data-testid="login-credentials-form"`
- **Email Input:** `data-testid="login-email-input"` | `id="email"` | `type="email"` | `aria-required="true"`
- **Password Input:** `data-testid="login-password-input"` | `id="password"` | `type="password"` | `aria-required="true"`
- **Submit Button:** `data-testid="login-submit-button"` | `type="submit"` | `role="button"`
- **Form Error Banner:** `data-testid="login-error-message"` | `role="alert"`

---

## 9. Component Styling Guidelines: Sidebar Workspace Selector

This selector resides in the upper Sidebar header, giving cross-functional collaborators a zero-friction way to swap board scopes while upholding tenant isolation policies.

### 9.1 Tenant Guard & Access Control Layout
- **Strict Limitation:** The dropdown selector must only list workspaces where the active user holds verified membership.
- **Empty State / No Workspaces:** If a user belongs to zero workspaces, the application must display a "Create your first workspace" placeholder instead of the dropdown selector.

### 9.2 Trigger Button Guidelines
The active workspace container that opens the context dropdown.
- **Styling:** `w-full flex items-center justify-between p-2 rounded-md hover:bg-elevated transition-all duration-150 border border-transparent focus:ring-2 focus:ring-accent-primary focus:outline-none cursor-pointer group`.
- **Contents Layout:**
  - **Left Section (Workspace Info):** `flex items-center gap-2.5 min-w-0`.
    - **Workspace Avatar:** `w-6 h-6 rounded-md bg-accent-primary/10 text-accent-primary font-mono text-xs flex items-center justify-center flex-shrink-0 font-semibold select-none`.
    - **Text Metadata:** `flex flex-col text-left min-w-0`.
      - **Workspace Name:** `text-sm font-semibold text-primary truncate max-w-[140px]`.
      - **Organization Label:** `text-[10px] text-secondary uppercase font-semibold tracking-wider`.
  - **Right Section (Indicator):** Chevron icon (`w-4 h-4 text-secondary ml-1.5 transition-transform duration-150 group-aria-expanded:rotate-180`).

### 9.3 Dropdown Menu Guidelines
- **Container Structure:** `absolute top-full left-2 mt-1 w-64 bg-surface border border-base rounded-md shadow-lg z-50 py-1.5 flex flex-col gap-0.5 origin-top-left transition-all ease-standard duration-150`.
  - **Visible State:** `opacity-100 scale-100 pointer-events-auto`.
  - **Hidden State:** `opacity-0 scale-95 pointer-events-none`.
- **Search Filter Input:**
  - Render a text input at the top of the dropdown: `px-2 py-1.5 border-b border-base`.
  - Input styling: `w-full px-2 py-1 text-xs bg-elevated border border-base rounded focus:outline-none focus:ring-1 focus:ring-accent-primary text-primary`.
- **Workspace Selector Option Item:**
  - **Layout:** `w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-elevated transition-colors duration-150 select-none cursor-pointer border-l-2 border-transparent`.
  - **Selected Option:** `bg-accent-primary/5 font-medium border-l-accent-primary`.
  - **Option Details:**
    - **Avatar:** Same as trigger avatar (`w-6 h-6`).
    - **Label:** `text-sm font-medium text-primary truncate flex-1 min-w-0`.
    - **Role Badges:** Colored labels based on the member's workspace permission:
      - `Admin` role badge: `bg-purple-50 text-purple-600 dark:bg-purple-950/30 dark:text-purple-400 text-[9px] font-bold px-1.5 py-0.5 rounded tracking-wide uppercase`.
      - `Member` role badge: `bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400 text-[9px] font-bold px-1.5 py-0.5 rounded tracking-wide uppercase`.
      - `Viewer` role badge: `bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 text-[9px] font-bold px-1.5 py-0.5 rounded tracking-wide uppercase`.

### 9.4 Context Switching Transitions & Shimmer
To convey a zero-friction, native feel when loading a new workspace, the frontend must execute the following coordination:
1. **Board Container Fade:** Upon trigger select, set the main viewport board container to `opacity-40` and `pointer-events-none` with standard transition timing (`duration-300 ease-standard`).
2. **Top Edge Shimmer Bar:**
  - Render an active, high-priority loading progress bar at the top edge of the viewport.
  - Height: `h-[2px]`.
  - Placement: `absolute top-0 left-0 right-0 z-50`.
  - Animation: Continuous linear shimmer gradient.
  - Color styling: `bg-gradient-to-r from-accent-primary via-blue-400 to-accent-primary bg-[length:200%_auto] animate-shimmer-fast`.

### 9.5 Access Control & Selection TDD Constraints
- **Trigger Button:** `data-testid="workspace-selector-trigger"` | `role="button"` | `aria-haspopup="listbox"` | `aria-expanded="false"` | `aria-controls="workspace-selector-dropdown"`
- **Dropdown List:** `data-testid="workspace-selector-dropdown"` | `role="listbox"` | `aria-label="Workspace selection"`
- **Workspace Option:** `data-testid="workspace-option-{workspace_id}"` | `role="option"` | `aria-selected="true/false"`
- **Role Badge Element:** `data-testid="role-badge-{role}"`
- **Search Field:** `data-testid="workspace-search-input"`
- **Switching Shimmer:** `data-testid="workspace-switching-shimmer"`

---

## 10. Component Styling Guidelines: Workspace Creation Dialog

This component provides a manual workspace creation flow, serving as both an empty-state recovery dialog and a reusable creation modal triggered from the Workspace Selector dropdown. It conforms to dense, sober, enterprise-grade UX constraints and strict keyboard-driven accessibility (a11y) guardrails.

### 10.1 Structural Layout & Visual Tokens
- **Backdrop Overlay Container:**
  - Standard Backdrop: `fixed inset-0 bg-black/40 backdrop-blur-sm z-40 flex items-center justify-center p-4 transition-all duration-300 ease-standard`.
  - Animation: Fades in via `animate-backdrop-fade-in`.
- **Modal Dialog Card:**
  - Placement: Centered in the viewport.
  - Structure: `w-full max-w-[440px] p-6 bg-surface border border-base rounded-lg shadow-xl flex flex-col gap-5 relative z-50 transition-all duration-300 ease-standard`.
  - Dark Mode: `dark:bg-slate-900 dark:border-slate-800 dark:shadow-2xl`.
  - Animation: Pop scale-up via `animate-modal-pop`.
  - Error state animation: On network/validation failure, the card triggers a horizontal wiggle wobble via `animate-shake`.

### 10.2 Component Typography & Content Elements
- **Header Section:**
  - Title: `text-lg font-semibold tracking-tight text-primary` (`h2` hierarchy).
  - Subtitle / Description: `text-xs text-secondary leading-normal`.
- **Form Layout:** `<form>` styled as `flex flex-col gap-4`.
- **Form Input Group:**
  - Label: `text-xs font-semibold text-secondary tracking-wide uppercase select-none`. MUST contain an explicit `for` attribute referencing the input element's `id`.
  - Input Field: `w-full px-3 py-2 text-sm bg-surface border border-base rounded-md focus:border-accent-primary focus:ring-2 focus:ring-accent-primary/20 focus:outline-none transition-all placeholder:text-tertiary text-primary`.
  - Input Helper Text / Field Error: `text-xs font-medium text-status-blocked mt-1`.
- **Footer Actions Layout:**
  - Container: `flex items-center justify-end gap-3 mt-1`.
  - Cancel Button (Secondary Action): `px-4 py-2 border border-base rounded-md text-sm font-medium text-secondary bg-surface hover:bg-elevated focus:ring-2 focus:ring-accent-primary focus:outline-none transition-all`.
  - Submit Button (Primary Action): `px-4 py-2 bg-accent-primary hover:bg-accent-primary/95 text-white rounded-md text-sm font-medium focus:ring-2 focus:ring-accent-primary focus:outline-none transition-all flex items-center justify-center gap-2`.

### 10.3 Micro-interactions & State Variations
- **Focus Border Highlight:** Inputs and buttons apply `focus:ring-2 focus:ring-accent-primary focus:outline-none` when focused.
- **Hover/Active States:**
  - Input Fields: `hover:border-secondary/50`.
  - Cancel Button: `hover:bg-elevated hover:text-primary`.
  - Submit Button: `hover:bg-accent-primary/95 active:scale-[0.98] transition-transform duration-100`.
- **Validation Error / Error Banner State:**
  - Input Field: `border-status-blocked bg-status-blocked/5 focus:ring-status-blocked/20 text-status-blocked`.
  - Error Banner (Form Level): `bg-status-blocked/10 border border-status-blocked/20 text-status-blocked text-xs rounded-md p-3 flex gap-2 items-start animate-shake`.
- **Disabled / Loading State:**
  - Triggered during network execution. All inputs, text areas, and action buttons MUST receive the `disabled` property and `aria-disabled="true"`.
  - Visual Overlay: Inputs get `opacity-60 bg-elevated/50 text-secondary cursor-not-allowed`.
  - Submit Button Spinner: Replaces static text or displays inline next to it. Spinner styling: `w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin`.

### 10.4 Focus Management & Keyboard Accessibility (a11y)
The developer MUST programmatically ensure the following behaviors:
1. **Focus Trap:** Focus MUST be trapped within the modal card while open. Tabbing past the last interactive element (Submit) wraps focus back to the first interactive element (Close/Input). Shift-tabbing from the first interactive element wraps to the last.
2. **Autofocus:** When the dialog is rendered, the Workspace Name text input field MUST be immediately focused.
3. **Escape Key Dismissal:** Pressing `Escape` while focus is inside the dialog must instantly close the modal and return focus to the trigger element.
4. **Enter Key Form Submission:** Pressing `Enter` while inside the input text field must submit the form automatically if validations pass.
5. **Backdrop Click Dismissal:** Clicking on the Backdrop Overlay (outside the Modal Card) must trigger a close operation.
6. **Screen-Reader ARIA Roles:**
   - Overlay container: `role="none"` (or empty).
   - Dialog card container: `role="dialog"`, `aria-modal="true"`, `aria-labelledby="modal-title"`, and `aria-describedby="modal-description"`.
   - Title element: `id="modal-title"`.
   - Subtitle element: `id="modal-description"`.
   - Inputs: `aria-required="true"`, `aria-invalid="true/false"`.

### 10.5 Playwright Test Anchors (`data-testid`)
For comprehensive testability, the developer MUST implement these target selectors:
- Empty State Container: `data-testid="workspace-empty-state"`
- Create Button (Trigger): `data-testid="create-workspace-button"`
- Modal Overlay: `data-testid="create-workspace-modal-overlay"`
- Dialog Container: `data-testid="create-workspace-dialog"`
- Workspace Name Input: `data-testid="workspace-name-input"`
- Cancel Button: `data-testid="workspace-modal-cancel"`
- Submit Button: `data-testid="workspace-modal-submit"`
- Error Message Banner: `data-testid="workspace-modal-error"`

---

## 11. Custom Keyframe Animations

To enable fluid motion transitions across components, the developer should register the following configurations in the Tailwind CSS file (`tailwind.config.js`):

```javascript
module.exports = {
  theme: {
    extend: {
      keyframes: {
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-4px)' },
          '20%, 40%, 60%, 80%': { transform: 'translateX(4px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
        dropdownEnter: {
          '0%': { opacity: '0', transform: 'scale(0.95) translateY(-4px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' }
        },
        backdropFadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        modalPop: {
          '0%': { opacity: '0', transform: 'scale(0.95) translateY(10px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' }
        }
      },
      animation: {
        'shake': 'shake 0.3s cubic-bezier(.36,.07,.19,.97) both',
        'shimmer-fast': 'shimmer 1.5s linear infinite',
        'dropdown-enter': 'dropdownEnter 0.15s cubic-bezier(0.2, 0, 0, 1) forwards',
        'backdrop-fade-in': 'backdropFadeIn 0.3s cubic-bezier(0.2, 0, 0, 1) forwards',
        'modal-pop': 'modalPop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards'
      }
    }
  }
}
```
