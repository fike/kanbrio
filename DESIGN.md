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

---

## 12. Component Styling Guidelines: Transitions & Blocker Visual Language

This section establishes standard presentation and focus rules for handling card blocker states, interactive details drawers, drag-and-drop actions, and physics-based error rollback alerts.

### 12.1 Card Blocked State (US1)
Blocked cards utilize high-priority visual identifiers to instantly flag flow stagnation ("Stop the Line" visual prominence) without breaking the alignment of the 2D grid.

#### 12.1.1 Tailwind Markup Structure
```html
<div
  class="relative flex flex-col gap-1 p-3 bg-surface border border-status-blocked bg-status-blocked/5 dark:bg-red-500/5 rounded-md shadow-sm transition-all ease-standard duration-300"
  data-testid="card-blocked-container-{card_id}"
  role="group"
  aria-labelledby="card-title-{card_id}"
>
  <!-- Absolute-positioned left-accent red border strip -->
  <div class="w-1 h-full bg-status-blocked absolute left-0 top-0 rounded-l-md" aria-hidden="true"></div>

  <!-- Parent Breadcrumb (Standard structure) -->
  <span class="text-[10px] font-semibold text-tertiary uppercase tracking-wider pl-1.5">Initiative / payment-gateway</span>

  <!-- Card Body -->
  <div class="flex flex-col gap-1 pl-1.5">
    <!-- Card Title -->
    <h3 id="card-title-{card_id}" class="text-sm font-medium text-primary line-clamp-2">
      Integrate Stripe Payment Gateway
    </h3>

    <!-- Blocker Badge Area (ShieldAlert icon + truncated blocker reason) -->
    <div
      class="flex items-center gap-1 mt-0.5 text-xs text-status-blocked font-medium"
      data-testid="card-blocker-badge-{card_id}"
      role="status"
    >
      <!-- ShieldAlert Icon equivalent -->
      <svg class="w-3.5 h-3.5 text-status-blocked flex-shrink-0 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      <span class="truncate max-w-[200px]" title="Blocked by API Deprecation">Blocked: API Deprecation</span>
    </div>
  </div>

  <!-- Footer Metadata & Pulsing Avatar -->
  <div class="flex items-center justify-between mt-2 pl-1.5">
    <span class="font-mono text-[10px] text-tertiary">KB-402</span>
    <div class="relative">
      <img
        src="/avatars/assignee.png"
        alt="Assignee Name"
        class="w-6 h-6 rounded-full border border-base bg-elevated ring-2 ring-status-blocked/40 animate-pulse"
        data-testid="card-avatar-blocked-ring-{user_id}"
      />
    </div>
  </div>
</div>
```

#### 12.1.2 Semantic & Contrast Requirements
- **Color tokens:** The red border must map to `border-status-blocked` (`#EF4444`). The background tint uses `bg-status-blocked/5` (opacity 5%) to maintain readable text contrast.
- **Assignee ring pulse:** An active CSS pulse (`ring-2 ring-status-blocked/40 animate-pulse`) must encompass the avatar.
- **ARIA attributes:** The container must feature `role="group"` and `aria-labelledby` referencing the card title. The blocker badge must hold `role="status"` to indicate an updated visual state.

---

### 12.2 Blocker Side-Drawer Panel (US2)
The right-aligned, 400px wide details drawer isolates blocking comments and delivers a high-context mechanism for obstruction resolution.

#### 12.2.1 Backdrop & Container Tokens
- **Overlay backdrop:** `fixed inset-0 bg-black/40 backdrop-blur-sm z-40 flex justify-end transition-all duration-300 ease-standard`.
- **Drawer container:** `w-full max-w-[400px] h-full bg-surface border-l border-base flex flex-col shadow-2xl relative z-50 transform translate-x-0 transition-transform duration-300 ease-standard`.
  - **Dark Mode:** `dark:bg-slate-900 dark:border-slate-800`.
- **Test Anchor:** `data-testid="blocker-detail-drawer"`

#### 12.2.2 Tailwind Markup Structure
```html
<!-- Backdrop Overlay -->
<div
  class="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 flex justify-end animate-backdrop-fade-in"
  role="none"
>
  <!-- Drawer Panel Container -->
  <div
    class="w-full max-w-[400px] h-full bg-surface dark:bg-slate-900 border-l border-base flex flex-col shadow-2xl relative z-50 animate-modal-pop"
    data-testid="blocker-detail-drawer"
    role="dialog"
    aria-modal="true"
    aria-labelledby="blocker-drawer-title"
    aria-describedby="blocker-drawer-description"
  >
    <!-- Drawer Header -->
    <div class="p-4 border-b border-base flex flex-col gap-3">
      <div class="flex items-center justify-between">
        <h2 id="blocker-drawer-title" class="text-base font-semibold text-primary">Blocker Details</h2>
        <button
          class="p-1 text-secondary hover:text-primary rounded-md hover:bg-elevated focus:ring-2 focus:ring-accent-primary focus:outline-none transition-all"
          aria-label="Close blocker drawer"
        >
          <!-- Close Icon -->
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      <!-- Urgent Status Header Banner -->
      <div
        class="bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400 p-3 rounded-md flex gap-2.5 items-center text-xs font-medium"
        data-testid="blocker-drawer-banner"
      >
        <svg class="w-4 h-4 flex-shrink-0 animate-pulse text-status-blocked" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
        <span id="blocker-drawer-description">Blocked for 3 days by @coach-guardian</span>
      </div>
    </div>

    <!-- Scrollable Drawer Body -->
    <div class="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
      <!-- Blocker Context Description -->
      <div class="flex flex-col gap-2">
        <span class="text-[10px] font-semibold text-secondary uppercase tracking-wider">Obstruction Reason</span>
        <p class="text-sm text-primary bg-elevated/50 dark:bg-slate-800/50 p-3 rounded-md border border-base">
          API endpoint /v1/checkout is returning 503 Service Unavailable, blocking checkout integration testing.
        </p>
      </div>

      <!-- Isolated Comment Thread Section -->
      <div class="flex flex-col gap-3 flex-1">
        <span class="text-[10px] font-semibold text-secondary uppercase tracking-wider">Blocker Discussion</span>

        <!-- Compact Comments Thread Container -->
        <div class="flex flex-col gap-2 flex-1 overflow-y-auto" data-testid="block-comments-container">
          <!-- Comment Item -->
          <div class="text-xs p-2.5 bg-surface dark:bg-slate-800/40 border border-base rounded-md flex flex-col gap-1 shadow-sm">
            <div class="flex justify-between items-center text-secondary font-medium">
              <span>@api-dev</span>
              <span>2 hours ago</span>
            </div>
            <p class="text-primary leading-relaxed">
              We found a DB lock contention. Fixing it now; should be ready in an hour.
            </p>
          </div>
          <!-- Divider line between items -->
          <div class="h-px bg-base w-full my-1"></div>
        </div>

        <!-- Comment Field -->
        <div class="flex gap-2 items-end pt-2 border-t border-base">
          <textarea
            class="flex-1 px-3 py-1.5 text-xs bg-surface dark:bg-slate-800 border border-base rounded-md focus:border-accent-primary focus:ring-2 focus:ring-accent-primary/20 focus:outline-none placeholder:text-tertiary text-primary resize-none"
            placeholder="Reply to this blocker..."
            rows="2"
          ></textarea>
          <button class="px-3 py-1.5 bg-accent-primary hover:bg-accent-primary/95 text-white text-xs font-medium rounded-md focus:ring-2 focus:ring-accent-primary focus:outline-none transition-all">
            Comment
          </button>
        </div>
      </div>
    </div>

    <!-- Drawer Footer Actions -->
    <div class="p-4 border-t border-base bg-elevated/30 dark:bg-slate-800/20 flex justify-end gap-3">
      <!-- Resolve Block Button -->
      <button
        type="button"
        class="w-full py-2 bg-status-done hover:bg-green-600 text-white rounded-md text-sm font-semibold focus:ring-2 focus:ring-status-done/50 focus:outline-none transition-all transform active:scale-[0.98]"
        data-testid="resolve-block-button"
      >
        Resolve Block
      </button>
    </div>
  </div>
</div>
```

#### 12.2.3 Focus Trapping & Drawer Keyboard Navigation
- **Focus Trap:** When the drawer mounts, focus must be trapped dynamically. Keyboard tab shifts should loop from the Close button back to the "Resolve Block" button.
- **Escape Dismissal:** Pressing the `Escape` key must dismiss the active drawer and return focus back to the blocked card badge trigger.
- **ARIA Landmark:** The drawer panel must declare `role="dialog"`, `aria-modal="true"`, `aria-labelledby="blocker-drawer-title"`, and `aria-describedby="blocker-drawer-description"`.

---

### 12.3 Drag-and-Drop Visual States & Animations (US4)
Card movement micro-interactions leverage Pragmatic Drag & Drop coordinates. Fluid physics animations replace native drag ghost states.

- **Drag Start (Ghost state):** Applied to the active source card.
  - Tailwind styles: `opacity-50 rotate-2 scale-105 shadow-2xl transition-all duration-300 ease-standard cursor-grabbing`.
- **Valid Drop Target Hover:** Highlight cue applied to target columns/swimlanes.
  - Tailwind styles: `bg-accent-primary/[0.02] border border-dashed border-accent-primary/30 dark:bg-blue-500/[0.01] dark:border-accent-primary/20 transition-all duration-300 ease-standard`.
- **Spring Snap Animation:** Released elements ease into their new position with spring coordinates.
  - Timing style: `duration-300 ease-standard`.
  - Column counter pulse: Upon successful drop, the destination count badge pulses briefly (`animate-pulse` for 600ms).

---

### 12.4 Physics-based Rollback & Policy Violation Feedback (US5)
If a moved card triggers a backend policy violation (e.g. `409 Conflict` WIP exceeded, or `422 Unprocessable Entity` arrival rule failed), the UI rejects the drop optimistically.

#### 12.4.1 Coordinate Rollback & Shake Animation
- **Rollback:** The DOM immediately reverts the card position to its origin coordinate.
- **Horizontal Shake:** The card executes a 300ms horizontal shake animation.
  - Class styling: `animate-shake` on the card wrapper.
  - Shake Anchor: `data-testid="card-rollback-shake-{card_id}"`

#### 12.4.2 Floating Rejection Toast (Bottom-Right)
- **Toast structure:** `fixed bottom-4 right-4 z-50 w-full max-w-sm bg-surface dark:bg-slate-900 border border-base border-l-4 border-l-status-blocked shadow-xl p-4 rounded-md flex items-start gap-3 animate-modal-pop`.
- **Test Anchor:** `data-testid="rejection-alert-toast"`

```html
<div
  class="fixed bottom-4 right-4 z-50 w-full max-w-sm bg-surface dark:bg-slate-900 border border-base border-l-4 border-l-status-blocked shadow-xl p-4 rounded-md flex items-start gap-3 animate-modal-pop"
  data-testid="rejection-alert-toast"
  role="alert"
  aria-live="assertive"
>
  <!-- ShieldAlert Icon -->
  <svg class="w-5 h-5 text-status-blocked flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
    <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
  <div class="flex-1 flex flex-col gap-0.5">
    <span class="text-sm font-semibold text-primary">Move Rejected</span>
    <span class="text-xs text-secondary leading-relaxed">[Arrival Rule Violation]: QA requires an Assignee before entry.</span>
  </div>
  <button
    class="text-tertiary hover:text-primary p-0.5 rounded transition-all focus:outline-none focus:ring-1 focus:ring-accent-primary"
    aria-label="Dismiss message"
  >
    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
  </button>
</div>

---

## 13. Component Styling Guidelines: Card Creation Flow

This section details the visual guidelines, Tailwind classes, interactive system states, accessibility (a11y) guardrails, and Playwright test anchors for the Inline Card Creation Flow (v0.6).

### 13.1 Trigger Button Layout & States
A subtle toggle button is rendered at the bottom of each `ColumnZone` when the creation form is inactive. It must blend harmoniously with the dense, low cognitive load aesthetic.

- **Trigger Button Styling:** `text-secondary font-medium hover:text-accent-primary flex items-center gap-1.5 p-2 rounded-md hover:bg-elevated transition-colors w-full justify-start border border-transparent focus:ring-2 focus:ring-accent-primary focus:outline-none`
- **Playwright Test Anchor:** `data-testid="column-add-card-button-{column_id}-{swimlane_id}"`

#### Tailwind HTML Markup Structure
```html
<button
  type="button"
  class="text-secondary font-medium hover:text-accent-primary flex items-center gap-1.5 p-2 rounded-md hover:bg-elevated transition-colors w-full justify-start border border-transparent focus:ring-2 focus:ring-accent-primary focus:outline-none"
  data-testid="column-add-card-button-column_1-swimlane_none"
  aria-label="Add new card to column"
>
  <svg class="w-4.5 h-4.5 text-secondary flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
    <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
  </svg>
  <span>Add Card</span>
</button>
```

---

### 13.2 Inline Card Form Layout
When activated, the trigger button is unmounted and replaced by an inline card-shaped interactive area.

- **Form Container Styling:** `p-3 bg-surface border border-base rounded-lg shadow-sm flex flex-col gap-2 transition-all duration-300 ease-standard`
- **Playwright Test Anchor:** `data-testid="inline-card-form-{column_id}-{swimlane_id}"`
- **Semantic ARIA Attributes:** Must declare `role="form"` and `aria-label="Add new card"`.

---

### 13.3 Input Textarea & Action Row
The card content input utilizes a compact textarea paired with a aligned secondary-primary action row at the bottom right.

- **Textarea Styling:** `w-full px-3 py-2 text-sm bg-surface border border-base rounded-md focus:border-accent-primary focus:ring-2 focus:ring-accent-primary/20 focus:outline-none transition-all placeholder:text-tertiary text-primary resize-none`
  - Rows: Set explicitly to `2` to maintain data-density constraints.
- **Add (Submit) Button Styling:** `bg-accent-primary text-white font-semibold py-1 px-3 rounded-md hover:bg-accent-primary/95 text-xs focus:ring-2 focus:ring-accent-primary focus:outline-none transition-all`
- **Cancel Button Styling:** `text-secondary font-semibold hover:bg-elevated px-3 py-1 rounded-md text-xs focus:ring-2 focus:ring-accent-primary focus:outline-none transition-all`
- **Playwright Test Anchors:**
  - Textarea: `data-testid="inline-card-title-input"`
  - Submit Button: `data-testid="inline-card-submit"`
  - Cancel Button: `data-testid="inline-card-cancel"`

#### Tailwind HTML Markup Structure (Active State)
```html
<div
  class="p-3 bg-surface border border-base rounded-lg shadow-sm flex flex-col gap-2 transition-all duration-300 ease-standard"
  data-testid="inline-card-form-column_1-swimlane_none"
  role="form"
  aria-label="Add new card"
>
  <textarea
    class="w-full px-3 py-2 text-sm bg-surface border border-base rounded-md focus:border-accent-primary focus:ring-2 focus:ring-accent-primary/20 focus:outline-none transition-all placeholder:text-tertiary text-primary resize-none"
    data-testid="inline-card-title-input"
    placeholder="Enter a title for this card..."
    rows="2"
    aria-required="true"
  ></textarea>

  <div class="flex items-center justify-end gap-2">
    <button
      type="button"
      class="text-secondary font-semibold hover:bg-elevated px-3 py-1 rounded-md text-xs focus:ring-2 focus:ring-accent-primary focus:outline-none transition-all"
      data-testid="inline-card-cancel"
    >
      Cancel
    </button>
    <button
      type="submit"
      class="bg-accent-primary text-white font-semibold py-1 px-3 rounded-md hover:bg-accent-primary/95 text-xs focus:ring-2 focus:ring-accent-primary focus:outline-none transition-all"
      data-testid="inline-card-submit"
    >
      Add
    </button>
  </div>
</div>
```

---

### 13.4 System & Validation States

#### 13.4.1 Loading & Submission State
During card insertion operations, the interactive fields are disabled, and a visible processing spinner replaces static submission text to preserve flow state.

- **Interactive Disabling:** The input textarea, Add button, and Cancel button must immediately accept `disabled` properties and receive `aria-disabled="true"`.
- **Spinner Graphic:** A white spinner icon must animate inside the primary action button: `w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin flex-shrink-0`.
- **Layout styling shifts:** Form elements receive `opacity-60 bg-elevated/50 text-secondary cursor-not-allowed`.

```html
<div
  class="p-3 bg-surface border border-base rounded-lg shadow-sm flex flex-col gap-2 opacity-60 cursor-not-allowed select-none transition-all duration-300 ease-standard"
  data-testid="inline-card-form-column_1-swimlane_none"
  role="form"
  aria-label="Add new card"
>
  <textarea
    class="w-full px-3 py-2 text-sm bg-elevated/50 border border-base rounded-md focus:outline-none transition-all placeholder:text-tertiary text-secondary resize-none cursor-not-allowed"
    data-testid="inline-card-title-input"
    placeholder="Enter a title for this card..."
    rows="2"
    disabled
    aria-disabled="true"
    aria-required="true"
  >Creating API routes</textarea>

  <div class="flex items-center justify-end gap-2">
    <button
      type="button"
      class="text-secondary font-semibold px-3 py-1 rounded-md text-xs cursor-not-allowed opacity-50"
      data-testid="inline-card-cancel"
      disabled
      aria-disabled="true"
    >
      Cancel
    </button>
    <button
      type="submit"
      class="bg-accent-primary text-white font-semibold py-1 px-3 rounded-md text-xs cursor-not-allowed flex items-center gap-1.5 justify-center"
      data-testid="inline-card-submit"
      disabled
      aria-disabled="true"
    >
      <svg class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24" aria-hidden="true"></svg>
      <span>Adding...</span>
    </button>
  </div>
</div>
```

#### 13.4.2 Validation Error State
If a validation rule is violated (e.g. empty title or exceeding characters limit), the form alerts the user with dynamic haptic-feel animation and structured feedback.

- **Horizontal Shake:** The outer form wrapper executes a `300ms` horizontal shake animation (`animate-shake`) to visually signal failure.
- **Error message banner:** A banner is rendered at the top of the form area.
  - **Banner Styling:** `bg-status-blocked/10 border border-status-blocked/20 text-status-blocked text-xs rounded-md p-3 flex gap-2 items-start`
  - **Playwright Test Anchor:** `data-testid="inline-card-error"`
- **Textarea Red Border:** The input border changes to validation red state: `border-status-blocked bg-status-blocked/5 focus:ring-status-blocked/20 text-status-blocked placeholder:text-status-blocked/40`.

```html
<div
  class="p-3 bg-surface border border-status-blocked bg-status-blocked/5 rounded-lg shadow-sm flex flex-col gap-2 animate-shake duration-300 ease-standard"
  data-testid="inline-card-form-column_1-swimlane_none"
  role="form"
  aria-label="Add new card"
>
  <!-- Error Message Banner -->
  <div
    class="bg-status-blocked/10 border border-status-blocked/20 text-status-blocked text-xs rounded-md p-3 flex gap-2 items-start"
    data-testid="inline-card-error"
    role="alert"
  >
    <svg class="w-4 h-4 text-status-blocked flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
      <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
    <div class="flex-1 flex flex-col gap-0.5">
      <span class="font-semibold">Validation Error</span>
      <span>Card title cannot be empty.</span>
    </div>
  </div>

  <textarea
    class="w-full px-3 py-2 text-sm bg-surface border border-status-blocked/50 focus:border-status-blocked focus:ring-2 focus:ring-status-blocked/20 focus:outline-none transition-all placeholder:text-status-blocked/40 text-status-blocked resize-none"
    data-testid="inline-card-title-input"
    placeholder="Enter a title for this card..."
    rows="2"
    aria-invalid="true"
    aria-required="true"
  ></textarea>

  <div class="flex items-center justify-end gap-2">
    <button
      type="button"
      class="text-secondary font-semibold hover:bg-elevated px-3 py-1 rounded-md text-xs focus:ring-2 focus:ring-accent-primary focus:outline-none transition-all"
      data-testid="inline-card-cancel"
    >
      Cancel
    </button>
    <button
      type="submit"
      class="bg-accent-primary text-white font-semibold py-1 px-3 rounded-md hover:bg-accent-primary/95 text-xs focus:ring-2 focus:ring-accent-primary focus:outline-none transition-all"
      data-testid="inline-card-submit"
    >
      Add
    </button>
  </div>
</div>
```

---

### 13.5 Accessibility & Focus Rules
To uphold the highest level of web accessibility (WCAG AA compliant focus behavior), the developer MUST programmatically implement the following:

1. **Immediate Focus On Mount:** Once the inline card form mounts, the title input textarea must programmatically receive focus **within 50ms**.
2. **Keyboard Focus Trap:** Focus tab orders must be strictly trapped inside the card creation form while active.
   - **Forward loop:** `Textarea -> Add Button -> Cancel Button -> Textarea`
   - **Reverse loop (Shift-Tab):** `Textarea -> Cancel Button -> Add Button -> Textarea`
3. **Escape Key & Blur Click-Outside Dismissal:**
   - Pressing the `Escape` key while focus is within the form must trigger a dismissal (unmounting the form).
   - Clicking anywhere outside the active form container must also dismiss the form.
   - Upon dismissal, the trigger button (+ Add Card) is re-rendered and **instantly receives programmatic focus** to maintain keyboard positioning.

---

### 13.6 Playwright Test Anchors & Accessibility Landmarks (TDD & ARIA Constraints)
The developer must implement the following specific identifiers to satisfy the end-to-end integration test suites:

- **Trigger Button:** `data-testid="column-add-card-button-{column_id}-{swimlane_id}"` | `role="button"` | `aria-label="Add new card to column"`
- **Form Wrapper:** `data-testid="inline-card-form-{column_id}-{swimlane_id}"` | `role="form"` | `aria-label="Add new card"`
- **Input Textarea:** `data-testid="inline-card-title-input"` | `aria-required="true"` | `aria-invalid="true/false"`
- **Submit (Add) Button:** `data-testid="inline-card-submit"` | `role="button"`
- **Cancel Button:** `data-testid="inline-card-cancel"` | `role="button"`
- **Error Banner:** `data-testid="inline-card-error"` | `role="alert"`

---

## 14. WebSocket & Real-Time Sync

This section defines the visual design, interaction patterns, and accessibility constraints for WebSocket-based real-time board synchronization (Issue #33). The WebSocket connection is **unidirectional** (server → client) — all mutations continue through REST API endpoints. The WS channel delivers event deltas (`CardMoved`, `CardBlocked`, `CardUnblocked`, `CardAssigned`, `ChecklistItemUpdated`, `UserJoined`, `UserLeft`) that update the TanStack Query cache, triggering reactive Solid.js re-renders.

### 14.1 Connection Status Indicator

A subtle, non-intrusive indicator placed in the **app header** (top-right, immediately to the left of the user avatar) showing WebSocket connection health. The indicator is designed to be minimally visible during normal operation and progressively more visible as connection quality degrades.

#### 14.1.1 State Machine

| State | Trigger | Visual | Behavior |
| :--- | :--- | :--- | :--- |
| `connected` | WS open event, pong received | 8px green dot, no text | Invisible to screen readers. Static, no animation. |
| `connecting` | Initial connection or after page load | 8px yellow dot + subtle pulse | First-time connect: auto-resolves. No toast shown. |
| `reconnecting` | WS close event (unexpected disconnect) | Orange dot + spinner animation | Shows a slim toast/banner below the header with "Reconnecting…". Auto-retry countdown displayed. |
| `disconnected` | Reconnect failed after max attempts (5) | Red dot (solid, no animation) | Shows error toast with "Connection lost" + "Refresh" button. |

#### 14.1.2 Connection States Color Tokens

New semantic color tokens for connection status (added to `tokens.css`):

```css
@layer base {
  :root {
    --color-ws-connected: #22C55E;   /* Green — maps to status-done */
    --color-ws-connecting: #EAB308;   /* Yellow — maps to status-doing */
    --color-ws-reconnecting: #F97316; /* Orange — new token */
    --color-ws-disconnected: #EF4444; /* Red — maps to status-blocked */
  }
}
```

Tailwind mapping in `tailwind.config.js`:
```javascript
colors: {
  ws: {
    connected: '#22C55E',
    connecting: '#EAB308',
    reconnecting: '#F97316',
    disconnected: '#EF4444',
  }
}
```

#### 14.1.3 Tailwind Markup Structure

```html
<!-- Connection Status Indicator: placed in App.tsx header, right section -->
<!-- Container: fixed-position alternative also valid for board-level placement -->
<div
  id="ws-connection-indicator"
  data-testid="ws-connection-indicator"
  class="flex items-center gap-1.5 h-6 px-2 rounded-md transition-all duration-300 ease-standard"
  role="status"
  aria-live="polite"
  aria-atomic="true"
>
  <!-- State Dot (always rendered) -->
  <span
    id="ws-status-dot"
    data-testid="ws-status-dot"
    class="w-2 h-2 rounded-full flex-shrink-0 transition-colors duration-300"
    classList={{
      'bg-ws-connected': wsState === 'connected',
      'bg-ws-connecting animate-ws-pulse': wsState === 'connecting',
      'bg-ws-reconnecting': wsState === 'reconnecting',
      'bg-ws-disconnected': wsState === 'disconnected',
    }}
    aria-hidden="true"
  />

  <!-- Status Label (only visible in non-connected states) -->
  <Show when={wsState !== 'connected'}>
    <span
      data-testid="ws-status-label"
      class="text-[10px] font-semibold tracking-wide uppercase transition-opacity duration-300"
      classList={{
        'text-ws-connecting': wsState === 'connecting',
        'text-ws-reconnecting': wsState === 'reconnecting',
        'text-ws-disconnected': wsState === 'disconnected',
      }}
    >
      {wsState === 'connecting' ? 'Connecting' : ''}
      {wsState === 'reconnecting' ? `Reconnecting… (${retryCountdown}s)` : ''}
      {wsState === 'disconnected' ? 'Disconnected' : ''}
    </span>
  </Show>

  <!-- Spinner (only for reconnecting state) -->
  <Show when={wsState === 'reconnecting'}>
    <svg
      class="w-3.5 h-3.5 text-ws-reconnecting animate-spin"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
    </svg>
  </Show>

  <!-- Manual Refresh Button (only for disconnected state) -->
  <Show when={wsState === 'disconnected'}>
    <button
      data-testid="ws-refresh-button"
      class="text-[10px] font-semibold text-accent-primary hover:text-accent-primary/95 underline underline-offset-2 focus:ring-2 focus:ring-accent-primary focus:outline-none rounded px-1 py-0.5 transition-all"
      aria-label="Reconnect and refresh board state"
      onClick={handleManualReconnect}
    >
      Refresh
    </button>
  </Show>
</div>
```

#### 14.1.4 Disconnect Toast Banner

When disconnected after max retry attempts, a full-width slim banner appears **below the header** (not a floating toast) to maintain visual hierarchy and avoid conflicting with the existing bottom-right error toast system.

```html
<!-- Disconnect Banner: slides down from top, below the header -->
<Show when={wsState === 'disconnected'}>
  <div
    data-testid="ws-disconnect-banner"
    class="bg-ws-disconnected/10 border-b border-ws-disconnected/20 px-6 py-2.5 flex items-center justify-between animate-ws-slide-down"
    role="alert"
    aria-live="assertive"
  >
    <div class="flex items-center gap-3">
      <svg class="w-4 h-4 text-ws-disconnected flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" d="M18.364 5.636a9 9 0 010 12.728M5.636 5.636a9 9 0 000 12.728M12 18.364V5.636m0 0L8.5 2.136m3.5 3.5L15.5 2.136M12 5.636L5.5 2.136" />
      </svg>
      <span class="text-xs font-medium text-ws-disconnected">
        Connection lost. Last synced {timeSinceLastSync} ago.
      </span>
    </div>
    <div class="flex items-center gap-2">
      <button
        data-testid="ws-banner-refresh-button"
        class="px-3 py-1 bg-ws-disconnected hover:bg-red-600 text-white text-xs font-semibold rounded-md transition-all focus:ring-2 focus:ring-ws-disconnected/50 focus:outline-none active:scale-[0.98]"
        onClick={handleManualReconnect}
      >
        Reconnect
      </button>
    </div>
  </div>
</Show>
```

#### 14.1.5 Reconnection Behavior

- **Exponential backoff:** 1s → 2s → 4s → 8s → 15s (max 5 attempts)
- After each failed attempt, the `retryCountdown` signal decrements, shown in the status label
- On successful reconnect, TanStack Query cache is invalidated → full `GET /board` refetch → smooth transition back to `connected` state
- The `connected` state indicator fades to minimal (green dot only, no text) with `transition-opacity duration-500`

---

### 14.2 Presence Indicator

Shows active viewers on the board header row. Displays as a compact avatar stack with a count badge.

#### 14.2.1 Placement

Positioned in the **board header** (row of column titles), aligned to the **right side** of the header, next to the workspace name. Alternatively, can be placed in the sidebar workspace selector area.

#### 14.2.2 Visual Design

- **Avatar stack:** Overlapping circular avatars (or colored initials if no avatar URL), `w-7 h-7` (28px) with `border-2 border-surface` to create separation between stacked avatars.
- **Max visible:** Show up to 3 avatars, then a "+{n}" badge.
- **Count badge:** If 0 viewers (only self), show nothing. If 1+ others, show the stack.
- **Count text:** "3 viewing" in `text-[10px] font-semibold text-secondary uppercase tracking-wide`.
- **Transition on count change:** Subtle scale bounce (`animate-ws-pop`) when avatars enter/leave.

#### 14.2.3 Tailwind Markup Structure

```html
<!-- Presence Indicator: placed in board header row -->
<Show when={activeViewers().length > 0}>
  <div
    data-testid="presence-indicator"
    class="flex items-center gap-2 px-2 py-1 rounded-md transition-all duration-300 ease-standard"
    role="group"
    aria-label={`${activeViewers().length} people viewing this board`}
  >
    <!-- Avatar Stack -->
    <div class="flex items-center" data-testid="presence-avatar-stack">
      <For each={activeViewers().slice(0, 3)}>
        {(viewer) => (
          <div
            class="w-7 h-7 -ml-1.5 first:ml-0 rounded-full border-2 border-surface overflow-hidden animate-ws-pop transition-all"
            title={viewer.name}
            role="img"
            aria-label={`${viewer.name} is viewing`}
          >
            <Show when={viewer.avatar_url} fallback={
              <div
                class="w-full h-full flex items-center justify-center text-[10px] font-bold text-white"
                classList={{
                  'bg-blue-500': true,  // Derive from user ID hash
                }}
              >
                {viewer.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
              </div>
            }>
              <img src={viewer.avatar_url} alt="" class="w-full h-full object-cover" />
            </Show>
          </div>
        )}
      </For>
      <Show when={activeViewers().length > 3}>
        <div
          class="w-7 h-7 -ml-1.5 first:ml-0 rounded-full border-2 border-surface bg-elevated flex items-center justify-center text-[10px] font-bold text-secondary animate-ws-pop"
          role="img"
          aria-label={`Plus ${activeViewers().length - 3} more viewers`}
        >
          +{activeViewers().length - 3}
        </div>
      </Show>
    </div>

    <!-- Count Label -->
    <span
      data-testid="presence-count-label"
      class="text-[10px] font-semibold text-secondary uppercase tracking-wide transition-opacity duration-300"
    >
      {activeViewers().length} {activeViewers().length === 1 ? 'viewing' : 'viewing'}
    </span>
  </div>
</Show>
```

#### 14.2.4 Avatar Color Derivation

When no avatar URL is available, derive a consistent color from the user's ID using a hash:

```javascript
const avatarColors = [
  'bg-blue-500', 'bg-purple-500', 'bg-pink-500', 'bg-orange-500',
  'bg-teal-500', 'bg-indigo-500', 'bg-rose-500', 'bg-cyan-500',
  'bg-amber-500', 'bg-emerald-500',
];

function getUserAvatarColor(userId: string): string {
  const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return avatarColors[hash % avatarColors.length];
}
```

#### 14.2.5 Entry/Exit Animations

- **User joins:** Avatar scales up from 0 to 1 with `animate-ws-pop` (see keyframes below). Count label fades in with `transition-opacity duration-300`.
- **User leaves:** Avatar scales down to 0 with `animate-ws-pop-out`. Count label fades out. Entire indicator unmounts when count reaches 0.
- **Count change:** Brief scale pulse on the count badge (`scale-105` for 150ms) to draw attention without being jarring.

---

### 14.3 Real-Time Mutation Feedback

When board state changes arrive via WebSocket from **another user** (not the local user's own mutations), the UI provides subtle visual confirmation. These animations must be **non-intrusive** — the board should feel like it "just works" in real-time, with barely-perceptible signals that something changed.

**Key Principle:** Only animate on remote mutations. Local mutations already have their own feedback (optimistic UI, drag-and-drop animations, error toasts). Remote feedback is always secondary and subtle.

#### 14.3.1 Card Moved by Another User

When a `CardMoved` event arrives and the card physically repositions on the board:

- **CSS transition:** The card element transitions its position using `transition-all duration-300 ease-standard`. This is the default board transition — no extra class needed beyond the card's base transition styles.
- **Remote move flash:** A subtle border color flash to signal "someone else moved this":
  - Class: `ring-2 ring-accent-primary/20 border-accent-primary/30` applied for 800ms then removed.
  - The flash uses the accent-primary blue (not status colors) to distinguish from error/semantic states.
  - Background tint: brief `bg-accent-primary/[0.02]` overlay that fades out.

```html
<!-- Card wrapper with remote-move flash class -->
<div
  class="relative flex flex-col gap-1 p-3 bg-surface border border-base rounded-md shadow-sm transition-all ease-standard duration-300"
  classList={{
    'ring-2 ring-accent-primary/20 border-accent-primary/30 bg-accent-primary/[0.02] animate-ws-card-flash': isRemoteMutation(),
  }}
>
  <!-- Card content... -->
</div>
```

- **Duration:** The flash ring and tint persist for 800ms, then transition out with `transition-all duration-500`.
- **Implementation:** Board component tracks a `Set<string>` of `recentlyMutatedCardIds`, cleared after 800ms via `setTimeout`.

#### 14.3.2 Card Blocked/Unblocked by Another User

When a `CardBlocked` or `CardUnblocked` event arrives:

- **Blocker badge flash:** The blocker badge area pulses once with `animate-ws-badge-pulse` — a subtle scale (1.0 → 1.05 → 1.0) over 400ms.
- **Border transition:** The card border transitions from `border-base` to `border-status-blocked` (or reverse) using the existing card transition (`transition-all duration-300 ease-standard`).
- **No toast:** Remote block/unblock does NOT show a toast. The visual change on the card is sufficient.

```html
<!-- Blocker badge with remote update pulse -->
<div
  data-testid="blocker-badge"
  class="flex items-center gap-1.5 px-2 py-1 bg-status-blocked/10 border border-status-blocked/20 text-status-blocked text-xs rounded font-medium mt-1 w-fit"
  classList={{
    'animate-ws-badge-pulse': wasRemotelyBlocked,
  }}
>
  <ShieldAlert size={12} class="shrink-0" />
  <span class="truncate max-w-[180px]">Blocked: {blockerReason}</span>
</div>
```

#### 14.3.3 Checklist Updated by Another User

When a `ChecklistItemUpdated` or `ChecklistItemDeleted` event arrives:

- **Checkbox flash:** The affected checklist checkbox row briefly highlights with a blue accent flash:
  - Class: `bg-accent-primary/5 rounded transition-colors duration-300` applied for 600ms.
- **Progress bar pulse:** If a subtask progress indicator exists (e.g., `2/5`), it scales up slightly (`scale-105`) for 200ms.

```html
<!-- Checklist item with remote update highlight -->
<div
  data-testid={`checklist-item-${item.id}`}
  class="flex items-center gap-2 text-xs transition-colors duration-300"
  classList={{
    'bg-accent-primary/5 rounded -mx-1 px-1': recentlyUpdatedChecklistIds.includes(item.id),
  }}
>
  <input type="checkbox" checked={item.is_completed} class="w-3.5 h-3.5 rounded border-base text-accent-primary focus:ring-accent-primary" />
  <span classList={{ 'line-through text-tertiary': item.is_completed, 'text-primary': !item.is_completed }}>
    {item.title}
  </span>
</div>
```

#### 14.3.4 Card Assigned by Another User

When a `CardAssigned` event arrives:

- **Avatar transition:** The assignee avatar area in the card footer transitions with `animate-ws-pop` when the assignee changes.
- **Subtle highlight:** Brief `bg-accent-primary/[0.02]` on the card footer area for 600ms.

#### 14.3.5 Summary of Flash Animation Tokens

| Mutation Type | Animation Class | Duration | Visual |
| :--- | :--- | :--- | :--- |
| Card moved (remote) | `animate-ws-card-flash` | 800ms flash, 500ms fade-out | Blue ring + subtle bg tint |
| Card blocked (remote) | `animate-ws-badge-pulse` | 400ms single pulse | Blocker badge scale bounce |
| Checklist updated (remote) | N/A (class-based) | 600ms highlight | Blue bg tint on checkbox row |
| Card assigned (remote) | `animate-ws-pop` | 300ms pop-in | Avatar scale entrance |
| Optimistic rollback (local) | `animate-shake` (existing) | 300ms shake | Card horizontal shake |

---

### 14.4 Error & Recovery UI States

#### 14.4.1 Max Reconnect Attempts Exceeded

When the WebSocket fails to reconnect after 5 attempts (exponential backoff exhausted):

1. Status indicator transitions to `disconnected` state (red dot, no animation)
2. Disconnect banner appears below the header (see §14.1.4)
3. "Reconnect" button in the banner triggers: close stale WS → invalidate TanStack Query cache → refetch full board state → attempt new WS connection
4. If the reconnect succeeds: banner dismisses with `animate-ws-slide-up` (slides back up), status dot transitions to `connecting` → `connected`

#### 14.4.2 Lagged Events (Broadcast Channel Overflow)

When a `Lagged(n)` error is detected (client fell behind the 64-event broadcast channel):

- **No user-facing animation:** This is handled silently at the data layer.
- **Behavior:** The client triggers a full `GET /board` refetch via TanStack Query invalidation.
- **Visual side effect:** The board may briefly show a shimmer overlay during refetch (same as existing workspace-switch shimmer pattern):
  - `absolute inset-0 z-10 bg-surface/80 pointer-events-none` over the board container
  - Shimmer bar at top: `h-[2px] bg-gradient-to-r from-accent-primary via-blue-400 to-accent-primary bg-[length:200%_auto] animate-shimmer-fast`

#### 14.4.3 Optimistic UI Rollback (Conflicting Edits)

When a local mutation fails (e.g., two users moved the same card simultaneously) and the server rejects the operation:

- **Existing behavior preserved:** Card reverts to original position with `animate-shake` (defined in §12.4.1).
- **Remote state wins:** The WS event carrying the winning mutation arrives, updating the card to the other user's move.
- **Sequence:** Local shake (300ms) → WS event arrives → card smoothly transitions to remote position (`transition-all duration-300 ease-standard`) → optional toast: "Card was moved by {userName}".

```html
<!-- Conflict resolution toast (bottom-right, reuses existing toast system) -->
<div
  data-testid="ws-conflict-toast"
  class="fixed bottom-4 right-4 z-50 w-full max-w-sm bg-surface dark:bg-slate-900 border border-base border-l-4 border-l-ws-reconnecting shadow-xl p-4 rounded-md flex items-start gap-3 animate-modal-pop"
  role="status"
  aria-live="polite"
>
  <svg class="w-5 h-5 text-ws-reconnecting flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
    <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" />
  </svg>
  <div class="flex-1 flex flex-col gap-0.5">
    <span class="text-sm font-semibold text-primary">Card Moved by Teammate</span>
    <span class="text-xs text-secondary leading-relaxed">{userName} moved "{cardTitle}" to {columnTitle}.</span>
  </div>
  <button class="text-tertiary hover:text-primary p-0.5 rounded transition-all focus:outline-none focus:ring-1 focus:ring-accent-primary" aria-label="Dismiss">
    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
  </button>
</div>
```

#### 14.4.4 Events Arriving Out of Order

- **TanStack Query normalization:** Since all mutations flow through TanStack Query's normalized cache, out-of-order events are handled by cache upsert logic. The cache always reflects the latest known server state.
- **No special animation needed:** The card simply transitions to its correct final position.
- **Edge case visual safeguard:** If a card appears to "jump" (more than one column move in a single event batch), apply a brief `opacity-80 → opacity-100` transition (`transition-opacity duration-200`) to signal state reconciliation without drawing excessive attention.

---

### 14.5 Custom Keyframe Animations (WebSocket-Specific)

Add the following keyframes to the Tailwind config (`apps/web/tailwind.config.js`):

```javascript
keyframes: {
  // ... existing keyframes ...

  // Subtle pulse for connecting state dot (gentle breathing effect)
  wsPulse: {
    '0%, 100%': { opacity: '1', transform: 'scale(1)' },
    '50%': { opacity: '0.5', transform: 'scale(0.85)' },
  },
  // Pop entrance for presence avatars and remote mutation targets
  wsPop: {
    '0%': { opacity: '0', transform: 'scale(0.7)' },
    '100%': { opacity: '1', transform: 'scale(1)' },
  },
  // Pop exit for presence avatars leaving
  wsPopOut: {
    '0%': { opacity: '1', transform: 'scale(1)' },
    '100%': { opacity: '0', transform: 'scale(0.7)' },
  },
  // Card flash for remote card moves (ring fade)
  wsCardFlash: {
    '0%': { boxShadow: '0 0 0 2px rgba(37, 99, 235, 0.3)', backgroundColor: 'rgba(37, 99, 235, 0.05)' },
    '100%': { boxShadow: '0 0 0 0px rgba(37, 99, 235, 0)', backgroundColor: 'rgba(37, 99, 235, 0)' },
  },
  // Blocker badge pulse for remote block/unblock
  wsBadgePulse: {
    '0%': { transform: 'scale(1)' },
    '50%': { transform: 'scale(1.05)' },
    '100%': { transform: 'scale(1)' },
  },
  // Disconnect banner slide down from top
  wsSlideDown: {
    '0%': { maxHeight: '0', opacity: '0' },
    '100%': { maxHeight: '48px', opacity: '1' },
  },
  // Disconnect banner slide up (dismissal)
  wsSlideUp: {
    '0%': { maxHeight: '48px', opacity: '1' },
    '100%': { maxHeight: '0', opacity: '0' },
  },
},
animation: {
  // ... existing animations ...
  'ws-pulse': 'wsPulse 1.5s ease-in-out infinite',
  'ws-pop': 'wsPop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
  'ws-pop-out': 'wsPopOut 0.2s ease-in forwards',
  'ws-card-flash': 'wsCardFlash 0.8s ease-out forwards',
  'ws-badge-pulse': 'wsBadgePulse 0.4s ease-in-out both',
  'ws-slide-down': 'wsSlideDown 0.3s ease-standard forwards',
  'ws-slide-up': 'wsSlideUp 0.3s ease-standard forwards',
}
```

---

### 14.6 Accessibility (A11y) Constraints

#### 14.6.1 Screen Reader Announcements

- **Connection status changes:** The connection indicator uses `role="status" aria-live="polite"` — screen readers announce state changes (connecting → connected → reconnecting → disconnected) without interrupting the user.
- **Disconnect banner:** Uses `role="alert" aria-live="assertive"` — immediately announced by screen readers since connection loss is a critical state.
- **Presence changes:** The presence indicator uses `role="group"` with a descriptive `aria-label` that updates reactively. Count changes are **not** announced via `aria-live` to avoid announcement fatigue during active collaboration.

#### 14.6.2 Remote Mutation Announcements

- **Card moved by another user:** No screen reader announcement for individual card moves (too frequent, would be disruptive). The board state change is implicit.
- **Card blocked by another user:** If the currently focused card becomes blocked, announce via a transient `aria-live="polite"` region: "Card {title} has been blocked by {userName}."
- **Conflict resolution toast:** Uses `role="status" aria-live="polite"` to inform the user that a teammate moved their card.

#### 14.6.3 Keyboard Navigation

- **Connection indicator:** Not focusable when in `connected` state. Becomes focusable (tabindex="0") in non-connected states so keyboard users can reach the "Refresh" button.
- **Presence avatars:** Each avatar is focusable with `tabindex="0"` and has an `aria-label` with the user's name. Hover tooltip shows name + role.
- **Refresh/Reconnect buttons:** Standard button focus ring (`focus:ring-2 focus:ring-accent-primary focus:outline-none`).

#### 14.6.4 Reduced Motion

All WebSocket-specific animations respect `prefers-reduced-motion`:

```css
@media (prefers-reduced-motion: reduce) {
  #ws-status-dot {
    animation: none !important;
  }
  .animate-ws-card-flash,
  .animate-ws-badge-pulse,
  .animate-ws-pop,
  .animate-ws-pop-out {
    animation: none !important;
  }
  .animate-ws-slide-down,
  .animate-ws-slide-up {
    transition: none !important;
  }
  /* Remote mutation flashes become static color changes instead */
  .ws-reduced-motion-flash {
    opacity: 1 !important;
    transition: none !important;
  }
}
```

---

### 14.7 Playwright Test Anchors & TDD Constraints

The developer MUST implement these data-testid anchors for end-to-end testability:

| Element | `data-testid` | `role` | ARIA |
| :--- | :--- | :--- | :--- |
| Connection indicator container | `ws-connection-indicator` | `status` | `aria-live="polite"` |
| Status dot | `ws-status-dot` | N/A | `aria-hidden="true"` |
| Status text label | `ws-status-label` | N/A | N/A |
| Manual refresh button | `ws-refresh-button` | `button` | `aria-label="Reconnect and refresh board state"` |
| Disconnect banner | `ws-disconnect-banner` | `alert` | `aria-live="assertive"` |
| Banner reconnect button | `ws-banner-refresh-button` | `button` | N/A |
| Presence indicator group | `presence-indicator` | `group` | `aria-label="{n} people viewing this board"` |
| Avatar stack container | `presence-avatar-stack` | N/A | N/A |
| Presence count label | `presence-count-label` | N/A | N/A |
| Individual avatar (dynamic) | `presence-avatar-{user_id}` | `img` | `aria-label="{name} is viewing"` |
| Conflict resolution toast | `ws-conflict-toast` | `status` | `aria-live="polite"` |
| Card with remote flash | `card-remote-flash-{card_id}` | N/A | N/A |
| Checklist item (remote update) | `checklist-item-{item_id}` | N/A | N/A |

---

### 14.8 Integration Notes for Developer

1. **WS Client Module:** Create a Solid.js-compatible WebSocket client hook (e.g., `createWebSocket`) that exposes signals for `wsState`, `activeViewers`, `retryCountdown`, and `lastSyncTime`. This follows the fine-grained reactivity pattern — signals update reactively without full component re-renders.

2. **TanStack Query Integration:** WS events should update the query cache directly via `queryClient.setQueryData()` rather than triggering refetches. Only full-state recovery (after reconnect or lagged events) uses `queryClient.invalidateQueries()`.

3. **Self-Event Deduplication:** The client must identify its own mutations (by comparing event `user_id` with `auth.currentUser()?.id`) and skip remote-flash animations for self-initiated changes. The TanStack Query optimistic UI handles the visual feedback for local mutations.

4. **Component Placement:**
   - `WsConnectionIndicator` → Placed in `App.tsx` header, right section
   - `PresenceIndicator` → Placed in `Board.tsx` header row, right-aligned
   - Remote flash logic → Integrated into `Card.tsx` as an optional `isRemoteMutation` prop
   - Disconnect banner → Placed below header in `App.tsx` (conditional rendering)

5. **Performance:** All remote flash animations use CSS transitions/keyframes (no JavaScript animation loops). The `recentlyMutatedCardIds` set is cleaned up via `setTimeout` to prevent memory leaks on boards with 500+ cards.

---

## 15. Component Styling Guidelines: Workspace Business Rules Settings

This section details the layout structures, Tailwind utility classes, interactive states (loading, validation error, empty, success), and accessibility constraints for the Workspace Business Rules settings interface (located at `/workspaces/:workspace_id/settings/rules`).

### 15.1 Route & Layout Structure
Access to this settings view is restricted to Workspace Admins. The screen is nested inside the general Workspace Settings layout, using a sidebar navigation link.
- **Main View Container:** `w-full max-w-4xl mx-auto p-6 flex flex-col gap-6`
- **Header Section:** `flex items-center justify-between pb-4 border-b border-base`
- **Header Metadata Layout:** `flex flex-col gap-1`
  - **Title:** `text-lg font-semibold tracking-tight text-primary`
  - **Description:** `text-xs text-secondary leading-normal`
- **Header Actions Layout:** `flex items-center gap-3`
  - **Create Rule Button:** `px-3 py-1.5 bg-accent-primary hover:bg-accent-primary/95 active:scale-[0.98] text-white text-xs font-semibold rounded-md shadow-sm focus:ring-2 focus:ring-accent-primary focus:outline-none transition-all flex items-center gap-1.5`

#### Tailwind HTML Markup Structure (Header)
```html
<div class="flex items-center justify-between pb-4 border-b border-base" data-testid="rules-settings-header">
  <div class="flex flex-col gap-1">
    <h2 class="text-lg font-semibold tracking-tight text-primary">Business Rules</h2>
    <p class="text-xs text-secondary">Configure triggers and actions to automate cards transitions and assignees within this workspace.</p>
  </div>
  <button
    type="button"
    class="px-3 py-1.5 bg-accent-primary hover:bg-accent-primary/95 active:scale-[0.98] text-white text-xs font-semibold rounded-md shadow-sm focus:ring-2 focus:ring-accent-primary focus:outline-none transition-all flex items-center gap-1.5"
    data-testid="add-rule-button"
    aria-haspopup="dialog"
  >
    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
      <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
    </svg>
    <span>Create Rule</span>
  </button>
</div>
```

---

### 15.2 Rules List & Dense Card UI
All workspace rules are rendered inside a dense, scannable list layout. Each rule displays its name, automatic logic, active status, and inline actions.
- **List Container:** `flex flex-col gap-3`
- **Rule Row Card:** `w-full p-4 bg-surface border border-base rounded-lg shadow-sm flex items-center justify-between hover:border-secondary/30 transition-all duration-150`
- **Status Badges:**
  - **Active:** `bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400 text-[9px] font-bold px-1.5 py-0.5 rounded tracking-wide uppercase`
  - **Inactive:** `bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 text-[9px] font-bold px-1.5 py-0.5 rounded tracking-wide uppercase`
- **Toggle Switch:** An accessible binary switch component.
  - **Switch Track:** `relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-accent-primary focus:ring-offset-2`
    - **Active/Checked Track:** `bg-accent-primary`
    - **Inactive/Unchecked Track:** `bg-elevated`
  - **Switch Thumb (Knob):** `pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`
    - **Active/Checked Thumb:** `translate-x-4`
    - **Inactive/Unchecked Thumb:** `translate-x-0`
- **Delete Button:** `p-1.5 text-secondary hover:text-status-blocked rounded hover:bg-elevated focus:ring-2 focus:ring-status-blocked/40 focus:outline-none transition-all cursor-pointer`

#### Tailwind HTML Markup Structure (Rule Card)
```html
<div
  class="w-full p-4 bg-surface border border-base rounded-lg shadow-sm flex items-center justify-between hover:border-secondary/30 transition-all duration-150"
  data-testid="rule-row-rule_123"
>
  <!-- Left Side: Content -->
  <div class="flex flex-col gap-1 min-w-0">
    <div class="flex items-center gap-2.5">
      <span class="text-sm font-semibold text-primary truncate">Auto-Move Parent to Done</span>
      <span class="bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400 text-[9px] font-bold px-1.5 py-0.5 rounded tracking-wide uppercase" data-testid="rule-status-badge">Active</span>
    </div>
    <p class="text-xs text-secondary leading-normal">
      When all child cards are completed, automatically move the parent card to the "Done" column.
    </p>
  </div>

  <!-- Right Side: Interactive Controls -->
  <div class="flex items-center gap-4 flex-shrink-0">
    <!-- Accessible Switch Component -->
    <button
      type="button"
      role="switch"
      aria-checked="true"
      data-testid="rule-toggle-rule_123"
      class="bg-accent-primary relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-accent-primary focus:ring-offset-2"
      aria-label="Toggle Auto-Move Parent to Done rule"
    >
      <span class="translate-x-4 pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"></span>
    </button>

    <!-- Delete Button -->
    <button
      type="button"
      class="p-1.5 text-secondary hover:text-status-blocked rounded hover:bg-elevated focus:ring-2 focus:ring-status-blocked/40 focus:outline-none transition-all"
      data-testid="rule-delete-rule_123"
      aria-label="Delete rule Auto-Move Parent to Done"
    >
      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    </button>
  </div>
</div>
```

---

### 15.3 Skeletons / Shimmer Loading State
When fetching workspace rules initially or during refresh cycles, the view displays skeleton placeholders mapping the list structure to prevent layout jumps.
- **Skeleton Wrapper:** `flex flex-col gap-3`
- **Skeleton Card:** `w-full p-4 bg-surface border border-base rounded-lg shadow-sm flex items-center justify-between animate-pulse`
- **Skeleton Text Placeholders:** Uses `bg-elevated` panels with defined heights to mimic text rows.

#### Tailwind HTML Markup Structure (Loading Skeleton)
```html
<div class="flex flex-col gap-3" data-testid="rules-loading-skeleton" aria-busy="true" aria-label="Loading automated rules">
  <!-- Repeatable Row Skeleton -->
  <div class="w-full p-4 bg-surface border border-base rounded-lg shadow-sm flex items-center justify-between animate-pulse">
    <div class="flex flex-col gap-2 flex-1">
      <div class="flex items-center gap-3">
        <div class="h-4 bg-elevated rounded w-1/4"></div>
        <div class="h-4 bg-elevated rounded w-12"></div>
      </div>
      <div class="h-3 bg-elevated rounded w-1/2"></div>
    </div>
    <div class="flex items-center gap-4 flex-shrink-0">
      <div class="w-9 h-5 bg-elevated rounded-full"></div>
      <div class="w-7 h-7 bg-elevated rounded"></div>
    </div>
  </div>
</div>
```

---

### 15.4 Actionable Empty State
If a workspace has no automation rules configured, an actionable empty state screen provides onboarding direction and a prominent path to configure the first rule.
- **Empty State Container:** `w-full min-h-[320px] border border-dashed border-base rounded-lg flex flex-col items-center justify-center p-8 bg-surface/50`
- **Illustration Circle:** `w-12 h-12 rounded-full bg-accent-primary/10 text-accent-primary flex items-center justify-center mb-4`
- **Primary Text:** `text-sm font-semibold text-primary mt-2`
- **Description:** `text-xs text-secondary text-center max-w-sm mt-1 mb-5 leading-relaxed`

#### Tailwind HTML Markup Structure (Empty State)
```html
<div class="w-full min-h-[320px] border border-dashed border-base rounded-lg flex flex-col items-center justify-center p-8 bg-surface/50" data-testid="rules-empty-state">
  <div class="w-12 h-12 rounded-full bg-accent-primary/10 text-accent-primary flex items-center justify-center mb-2" aria-hidden="true">
    <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
    </svg>
  </div>
  <h3 class="text-sm font-semibold text-primary mt-2">No Automation Rules Configured</h3>
  <p class="text-xs text-secondary text-center max-w-sm mt-1 mb-5 leading-relaxed">
    Create triggers and actions to sync subtask statuses automatically or auto-assign tasks during column transitions.
  </p>
  <button
    type="button"
    class="px-4 py-2 bg-accent-primary hover:bg-accent-primary/95 text-white text-xs font-semibold rounded-md shadow-sm focus:ring-2 focus:ring-accent-primary focus:outline-none transition-all flex items-center gap-1.5"
    data-testid="add-rule-button-empty"
    aria-haspopup="dialog"
  >
    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
      <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
    </svg>
    <span>Configure First Rule</span>
  </button>
</div>
```

---

### 15.5 Create Rule Modal Form
The creation modal uses a structured form to guide the workspace administrator through setting up the automation.
- **Overlay Backdrop:** `fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all duration-300 ease-standard animate-backdrop-fade-in`
- **Modal Dialog Box:** `w-full max-w-[500px] bg-surface dark:bg-slate-900 border border-base dark:border-slate-800 rounded-lg shadow-xl p-5 relative z-50 flex flex-col gap-4 animate-modal-pop`
- **Form Formats:** Standard input text fields, select lists, and conditional logic rendering.
- **Conditional Target Zones:** When trigger or action selections require specific bounds (e.g. mapping `column_id` or `user_id`), the form injects secondary inputs using the standard slide-in fade animation (`animate-dropdown-enter`).

#### Tailwind HTML Markup Structure (Modal Dialog)
```html
<!-- Backdrop Overlay -->
<div class="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-backdrop-fade-in" role="none">
  <!-- Modal Dialog -->
  <div
    class="w-full max-w-[500px] bg-surface dark:bg-slate-900 border border-base dark:border-slate-800 rounded-lg shadow-xl p-5 relative z-50 flex flex-col gap-4 animate-modal-pop"
    role="dialog"
    aria-modal="true"
    aria-labelledby="rule-modal-title"
    aria-describedby="rule-modal-description"
    data-testid="create-rule-modal"
  >
    <!-- Close Button -->
    <button
      type="button"
      class="absolute top-4 right-4 p-1.5 text-secondary hover:text-primary rounded-md hover:bg-elevated focus:ring-2 focus:ring-accent-primary focus:outline-none transition-all"
      aria-label="Close modal"
      data-testid="rule-modal-close"
    >
      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
    </button>

    <!-- Header -->
    <div class="flex flex-col gap-1">
      <h2 id="rule-modal-title" class="text-base font-semibold text-primary">Create Business Rule</h2>
      <p id="rule-modal-description" class="text-xs text-secondary">Configure automated workflow transitions and metadata updates.</p>
    </div>

    <!-- Form -->
    <form class="flex flex-col gap-4" data-testid="create-rule-form" aria-label="Create new business rule">
      <!-- Input: Rule Name -->
      <div class="flex flex-col gap-1.5">
        <label for="rule-name" class="text-[10px] font-bold text-secondary uppercase tracking-wider select-none">Rule Name</label>
        <input
          type="text"
          id="rule-name"
          data-testid="rule-name-input"
          class="w-full px-3 py-2 text-sm bg-surface border border-base rounded-md focus:border-accent-primary focus:ring-2 focus:ring-accent-primary/20 focus:outline-none transition-all placeholder:text-tertiary text-primary"
          placeholder="e.g. Auto-assign to QA team"
          required
          aria-required="true"
        />
      </div>

      <!-- Select: Trigger Type -->
      <div class="flex flex-col gap-1.5">
        <label for="rule-trigger" class="text-[10px] font-bold text-secondary uppercase tracking-wider select-none">Trigger Event</label>
        <select
          id="rule-trigger"
          data-testid="rule-trigger-select"
          class="w-full px-3 py-2 text-sm bg-surface border border-base rounded-md focus:border-accent-primary focus:ring-2 focus:ring-accent-primary/20 focus:outline-none transition-all text-primary"
          required
          aria-required="true"
        >
          <option value="">Select a trigger event...</option>
          <option value="child_status_changed">All child tasks are completed</option>
          <option value="card_entered_column">Card entered a specific column</option>
        </select>
      </div>

      <!-- Conditional Trigger Input: Column Selection -->
      <!-- Rendered dynamically when Trigger = 'card_entered_column' -->
      <div class="flex flex-col gap-1.5 animate-dropdown-enter" data-testid="rule-config-column-section">
        <label for="rule-column" class="text-[10px] font-bold text-secondary uppercase tracking-wider select-none">Target Column</label>
        <select
          id="rule-column"
          data-testid="rule-column-select"
          class="w-full px-3 py-2 text-sm bg-surface border border-base rounded-md focus:border-accent-primary focus:ring-2 focus:ring-accent-primary/20 focus:outline-none transition-all text-primary"
          required
          aria-required="true"
        >
          <option value="">Select target column...</option>
          <option value="col_1">In Progress</option>
          <option value="col_2">Code Review</option>
          <option value="col_3">QA Testing</option>
        </select>
      </div>

      <!-- Select: Action Type -->
      <div class="flex flex-col gap-1.5">
        <label for="rule-action" class="text-[10px] font-bold text-secondary uppercase tracking-wider select-none">Action Result</label>
        <select
          id="rule-action"
          data-testid="rule-action-select"
          class="w-full px-3 py-2 text-sm bg-surface border border-base rounded-md focus:border-accent-primary focus:ring-2 focus:ring-accent-primary/20 focus:outline-none transition-all text-primary"
          required
          aria-required="true"
        >
          <option value="">Select an action event...</option>
          <option value="move_parent_card">Sync status & move parent card to Done</option>
          <option value="assign_card">Assign card to member</option>
        </select>
      </div>

      <!-- Conditional Action Input: Assignee Selection -->
      <!-- Rendered dynamically when Action = 'assign_card' -->
      <div class="flex flex-col gap-1.5 animate-dropdown-enter" data-testid="rule-config-assignee-section">
        <label for="rule-assignee" class="text-[10px] font-bold text-secondary uppercase tracking-wider select-none">Assign To</label>
        <select
          id="rule-assignee"
          data-testid="rule-assignee-select"
          class="w-full px-3 py-2 text-sm bg-surface border border-base rounded-md focus:border-accent-primary focus:ring-2 focus:ring-accent-primary/20 focus:outline-none transition-all text-primary"
          required
          aria-required="true"
        >
          <option value="">Select assignee...</option>
          <option value="clear">Unassigned / Clear Assignee</option>
          <option value="user_1">@flow-guardian (Scrum Master)</option>
          <option value="user_2">@focus-executor (Developer)</option>
        </select>
      </div>

      <!-- Form Footer Actions -->
      <div class="flex items-center justify-end gap-3 mt-2">
        <button
          type="button"
          class="px-4 py-2 border border-base rounded-md text-sm font-medium text-secondary bg-surface hover:bg-elevated focus:ring-2 focus:ring-accent-primary focus:outline-none transition-all"
          data-testid="rule-modal-cancel"
        >
          Cancel
        </button>
        <button
          type="submit"
          class="px-4 py-2 bg-accent-primary hover:bg-accent-primary/95 text-white rounded-md text-sm font-medium focus:ring-2 focus:ring-accent-primary focus:outline-none transition-all flex items-center justify-center gap-2"
          data-testid="rule-modal-submit"
        >
          Create Rule
        </button>
      </div>
    </form>
  </div>
</div>
```

---

### 15.6 Modal Focus Trap & Keyboard Navigation (a11y)
The developer MUST strictly implement key accessibility constraints for rule creation modals:
1. **Focus Trap:** When the modal is active, focus navigation (using `Tab` and `Shift + Tab`) is trapped within the boundary of the modal dialog card. It must wrap from the last element (Submit) back to the first element (Close button or Name input).
2. **Immediate Focus (Autofocus):** Upon render, focus must automatically mount onto the Rule Name input field.
3. **Escape Dismissal:** Pressing `Escape` at any point while focus is inside the dialog must instantly close the modal and return focus back to the page's trigger action ("Create Rule" button).
4. **Enter Submission:** Keyboard users must be able to submit the form by pressing `Enter` on any text input or select field once basic validations are satisfied.
5. **Backdrop Close:** Clicking the Backdrop Overlay (outside the modal box) will dismiss the modal.

---

### 15.7 Form Validation Error States
When form validation fails or the backend rejects the ruleset payload, the interface provides responsive visual and haptic-style cues:
- **Horizontal Shake:** The modal box executes a 300ms horizontal shake animation (`animate-shake`) to draw immediate user attention.
- **Invalid Form Fields:** Invalid inputs get a red border: `border-status-blocked bg-status-blocked/5 focus:ring-status-blocked/20 text-status-blocked`.
- **Field Help Text:** A descriptive validation error message renders directly below the field: `text-xs text-status-blocked font-medium mt-0.5`.
- **Form-Level Error Banner:** If the backend rejects the request, a banner is mounted at the top of the form containing detailed error text.
  - **Banner Styling:** `bg-status-blocked/10 border border-status-blocked/20 text-status-blocked text-xs rounded-md p-3 flex gap-2 items-start`
  - **Test Anchor:** `data-testid="rule-modal-error"`

#### Tailwind HTML Markup Structure (Form-Level Error Banner)
```html
<div
  class="bg-status-blocked/10 border border-status-blocked/20 text-status-blocked text-xs rounded-md p-3 flex gap-2 items-start animate-shake"
  data-testid="rule-modal-error"
  role="alert"
  aria-live="assertive"
>
  <svg class="w-4 h-4 text-status-blocked flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
    <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
  <div class="flex-1 flex flex-col gap-0.5">
    <span class="font-semibold">Validation Error</span>
    <span>A rule with this name already exists in this workspace.</span>
  </div>
</div>
```

---

### 15.8 Success State Toast Notifications
Upon successful completion of an administration action (rule created, toggled, deleted, or triggered), the interface notifies the user with a floating toast notification in the bottom right corner of the viewport.
- **Toast Panel:** `fixed bottom-4 right-4 z-50 w-full max-w-sm bg-surface dark:bg-slate-900 border border-base border-l-4 border-l-status-done shadow-xl p-4 rounded-md flex items-start gap-3 animate-modal-pop`
- **Dismiss Control:** `text-tertiary hover:text-primary p-0.5 rounded transition-all focus:outline-none focus:ring-1 focus:ring-accent-primary`
- **Behavior:** Toasts must automatically fade out and unmount after `4000ms`.

#### Tailwind HTML Markup Structure (Success Toast)
```html
<div
  class="fixed bottom-4 right-4 z-50 w-full max-w-sm bg-surface dark:bg-slate-900 border border-base border-l-4 border-l-status-done shadow-xl p-4 rounded-md flex items-start gap-3 animate-modal-pop"
  data-testid="success-toast"
  role="status"
  aria-live="polite"
>
  <!-- Success CircleCheck Icon -->
  <svg class="w-5 h-5 text-status-done flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
    <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>

  <div class="flex-1 flex flex-col gap-0.5">
    <span class="text-sm font-semibold text-primary">Rule Created</span>
    <span class="text-xs text-secondary leading-relaxed">The business rule "Auto-Move Parent to Done" has been successfully created.</span>
  </div>

  <button
    class="text-tertiary hover:text-primary p-0.5 rounded transition-all focus:outline-none focus:ring-1 focus:ring-accent-primary"
    aria-label="Dismiss notification"
  >
    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
  </button>
</div>
```

---

### 15.9 Playwright Test Anchors & Accessibility Landmarks (TDD & ARIA Constraints)
The developer MUST implement the following specific anchors and identifiers to support validation and testing suites:

| Component / Element | `data-testid` | `role` | ARIA / Accessibility Attribute |
| :--- | :--- | :--- | :--- |
| Settings screen wrapper | `rules-settings-container` | `region` | `aria-label="Workspace Business Rules Settings"` |
| Add Rule button (header) | `add-rule-button` | `button` | `aria-haspopup="dialog"`, `aria-label="Create a new business rule"` |
| Loading skeleton wrapper | `rules-loading-skeleton` | `status` | `aria-busy="true"`, `aria-label="Loading automated rules"` |
| Empty state wrapper | `rules-empty-state` | `region` | `aria-label="No automation rules configured"` |
| Rule list row item | `rule-row-{rule_id}` | `listitem` | N/A |
| Rule active/inactive badge | `rule-status-badge` | `status` | N/A |
| Rule status switch toggle | `rule-toggle-{rule_id}` | `switch` | `aria-checked="true/false"`, `aria-label="Toggle {rule_name} state"` |
| Rule delete button | `rule-delete-{rule_id}` | `button` | `aria-label="Delete rule {rule_name}"` |
| Create Rule Modal overlay | `create-rule-modal-overlay` | `none` | N/A |
| Create Rule Modal dialog | `create-rule-modal` | `dialog` | `aria-modal="true"`, `aria-labelledby="rule-modal-title"`, `aria-describedby="rule-modal-description"` |
| Modal Title element | `rule-modal-title` | N/A | `id="rule-modal-title"` |
| Modal Description element | `rule-modal-description` | N/A | `id="rule-modal-description"` |
| Modal Close button | `rule-modal-close` | `button` | `aria-label="Close modal"` |
| Rule Name text input | `rule-name-input` | `textbox` | `aria-required="true"`, `id="rule-name"` |
| Trigger Select dropdown | `rule-trigger-select` | `combobox` | `aria-required="true"`, `id="rule-trigger"` |
| Target Column Select dropdown | `rule-column-select` | `combobox` | `aria-required="true"`, `id="rule-column"` (Conditional) |
| Action Select dropdown | `rule-action-select` | `combobox` | `aria-required="true"`, `id="rule-action"` |
| Assignee Select dropdown | `rule-assignee-select` | `combobox` | `aria-required="true"`, `id="rule-assignee"` (Conditional) |
| Form Submit button | `rule-modal-submit` | `button` | `aria-label="Create rule"` |
| Form Cancel button | `rule-modal-cancel` | `button` | `aria-label="Cancel rule creation"` |
| Form Error banner alert | `rule-modal-error` | `alert` | `aria-live="assertive"` |
| Success Toast notification | `success-toast` | `status` | `aria-live="polite"` |
