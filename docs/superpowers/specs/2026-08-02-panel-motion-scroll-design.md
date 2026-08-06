# DTA Admin Panel Motion and Scroll Design

## Status

Approved for implementation on 2026-08-02.

## Objective

Improve the DTA administrative panel's perceived quality and navigation clarity without slowing down tournament operations. Motion must explain state changes, preserve the existing DTA visual system, and remain fully usable with reduced motion enabled.

## Product Context

The panel is a dense operational tool used by Dark Trials Arena staff while matches are active. Speed, predictable controls, and readable data take priority over decorative effects. Existing colors, typography, spacing, routes, authorization, slash commands, and backend behavior remain unchanged.

## Selected Approach

Use a hybrid motion system:

- `motion/react` handles component entry and exit, route transitions, layout changes, and scroll-linked values;
- CSS handles hover, focus, active, and simple color transitions;
- native browser scrolling remains the primary scroll behavior;
- `MotionConfig reducedMotion="user"` applies the operating-system preference globally.

Motion for React was selected because it supports React 19, `AnimatePresence`, interruptible layout animations, scroll values, and automatic reduced-motion behavior. Global inertia libraries are excluded because they can interfere with tables, dialogs, keyboard navigation, and rapid administrative work.

## Motion Language

### Timing

- Small feedback and menu transitions: 140-180 ms.
- Route and dialog transitions: 180-220 ms.
- Scroll-linked values use a lightly damped spring and skip their initial animation.
- Easing uses the existing ease-out curve or an equivalent ease-out quint curve.
- Bounce, elastic movement, parallax, and long choreographed sequences are prohibited.

### Route Transitions

Authenticated routes render inside a keyed page-transition component.

- Enter: opacity `0` to `1` and vertical offset `8px` to `0`.
- Exit: opacity `1` to `0` with no horizontal movement.
- The transition never blocks navigation or delays data fetching.
- Route changes move focus to the page heading when navigation came from the sidebar or mobile navigation.
- The workspace content scroll position returns to the top on route changes.
- Reduced motion removes translation and uses a short opacity change only.

### Dialogs and Popovers

The existing native `<dialog>` remains responsible for modality, focus trapping, Escape behavior, and accessibility.

- Dialog content enters with opacity and an `8px` vertical offset.
- The backdrop fades independently.
- Closing animation completes before the dialog is removed or closed.
- User menu and mobile secondary navigation use `AnimatePresence` for entry and exit.
- Trigger focus is restored after close.
- Reduced motion removes transforms.

### Lists and Data Changes

- Records animate only when inserted, removed, reordered, or filtered.
- Existing records do not replay entrance animations after routine query refreshes.
- Layout animation is restricted to bounded lists and mobile records; full tables do not animate row geometry.
- Success and error feedback enters once and remains readable by assistive technology.
- The realtime indicator pulses only while reconnecting. Connected and idle states remain static.

## Scroll Experience

### Native Scrolling

The panel keeps native scrolling and browser input behavior. No smooth-scroll interception, wheel normalization, or custom scrolling engine is introduced.

Programmatic navigation to the top uses smooth behavior only when reduced motion is not requested. With reduced motion enabled, it jumps immediately.

### Page Progress

A thin progress indicator appears below the sticky topbar only when the page content exceeds the visible workspace by a meaningful amount.

- It reflects the workspace document scroll progress.
- It is decorative and hidden from assistive technology.
- It does not reserve new layout height or cause content shift.
- It is hidden on short pages and under reduced motion when movement would add no useful information.

### Back to Top

A compact icon button appears after the user scrolls at least 480 pixels within a long page.

- It uses the Lucide `ArrowUp` icon and an accessible label.
- It stays clear of the mobile navigation and command-editor sticky actions.
- It returns focus to the page heading after scrolling.
- It is absent when the page is already near the top.

### Horizontal Tables

Scrollable tables expose overflow through edge shadows:

- right shadow when more content exists to the right;
- left shadow after horizontal scrolling begins;
- shadows update on scroll, resize, and content changes;
- the effect does not modify table width or scrollbar behavior;
- touch and keyboard scrolling remain native.

## Component Architecture

### `MotionProvider`

Wraps the authenticated application in `MotionConfig`, defines shared transitions, and centralizes reduced-motion behavior.

### `PageTransition`

Keys content by Wouter location, runs route entry and exit transitions, resets scroll, and coordinates page-heading focus.

### `WorkspaceScrollManager`

Tracks vertical progress, controls back-to-top visibility, and exposes scroll state without causing page-wide React rerenders on every pixel. Motion values or requestAnimationFrame-throttled state are required.

### `ScrollableTable`

Enhances the existing `.table-scroll` wrapper with semantic left/right overflow state. Existing table markup and responsive mobile-record alternatives remain unchanged.

### Existing Overlays

`AdminDialog`, `UserMenu`, and `MobileNavigation` gain motion without changing their public actions or authorization behavior.

## Visual Refinements

The motion work also resolves adjacent UI consistency issues discovered during the audit:

- standardize interactive transitions through design tokens;
- add visible active feedback to buttons and navigation controls;
- refine sticky surface separation while scrolling;
- keep overlays within the semantic z-index scale;
- preserve 44px touch targets and current responsive structures;
- avoid custom decorative scrollbars, nested cards, gradients, glow, and glass effects.

## Accessibility

- Honor `prefers-reduced-motion` through Motion and CSS.
- Preserve native dialog semantics, Escape handling, and focus return.
- Route transitions must not announce duplicate page content.
- Scroll progress and edge shadows convey no required information by themselves.
- Back-to-top control has a visible focus state and descriptive accessible name.
- Animation never delays access to controls or hides content before JavaScript runs.
- All existing WCAG 2.2 AA contrast requirements remain mandatory.

## Performance

- Prefer transform and opacity animation.
- Avoid animating width, height, top, left, or table row geometry.
- Do not subscribe React component state directly to every scroll event.
- Restrict blur and shadow animation to small overlay surfaces.
- Keep Motion imports tree-shakeable through `motion/react`.
- Record production bundle impact during verification.

## Failure and Edge Cases

- JavaScript-disabled content remains visible without entrance-animation gating.
- Very short pages hide progress and back-to-top controls.
- Route changes during an unfinished transition interrupt and continue from the current state.
- Closing a dialog during a mutation does not cancel the mutation or lose feedback.
- Mobile bottom navigation, command-editor sticky actions, and back-to-top controls cannot overlap.
- Horizontal overflow indicators recalculate after data loading, filtering, and viewport resizing.
- Realtime reconnection motion stops when state becomes connected or idle.

## Testing Strategy

### Unit and Component Coverage

- Reduced-motion configuration selects opacity-only variants.
- Scroll thresholds and progress calculations handle empty, short, and long pages.
- Horizontal overflow state reports left, middle, right, and no-overflow positions.

### Playwright Coverage

- Route navigation changes content and resets scroll.
- Page heading receives focus after keyboard navigation.
- Dialog and mobile menu preserve Escape and focus restoration.
- Long pages show progress and back-to-top controls; short pages do not.
- Table shadows respond to horizontal scroll.
- `prefers-reduced-motion: reduce` disables transform-based motion and smooth scrolling.
- Desktop, tablet, mobile, and 320px layouts have no incoherent overlap or horizontal page overflow.
- Screenshots cover overview, commands, a dialog, a long audit page, and mobile secondary navigation.

### Release Verification

- `npm run build`
- `npm test`
- `npm run panel:test:e2e`
- `npm audit --omit=dev`
- browser screenshots and console-error inspection
- production `/health`, Discloud status, startup logs, and served asset verification

## Non-Goals

- No backend, database, OAuth, permission, command, or Discord behavior changes.
- No rebrand or palette replacement.
- No global inertia scrolling, parallax, autoplay animation, or decorative page choreography.
- No redesign of the information architecture.
- No custom scrollbar replacement.

## Delivery

Implementation is committed directly to `main` after validation, preserving unrelated `.mimocode/.cron-lock` changes. Deployment updates the existing `admin-dta-bot` Discloud application using the frozen production SQLite backup workflow. Production acceptance requires a ready health response, 11 synchronized commands, and the updated panel assets served from the Discloud subdomain.
