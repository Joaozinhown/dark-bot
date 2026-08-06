# DTA Admin Panel Motion and Scroll Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add restrained, accessible motion and operational scroll affordances to the complete DTA administrative panel.

**Architecture:** Motion for React supplies a global reduced-motion policy, interruptible route and overlay transitions, and scroll-linked progress. Focused React components own page transitions, workspace scrolling, and horizontal table overflow while the existing DTA CSS system keeps interaction and responsive states consistent.

**Tech Stack:** React 19, TypeScript, Wouter, Motion for React (`motion/react`), CSS, Playwright, Vite.

---

## File Map

- Create `panel/src/motion/motion-config.ts` for shared variants and transitions.
- Create `panel/src/motion/motion-provider.tsx` for global reduced-motion policy.
- Create `panel/src/motion/page-transition.tsx` for route presence, scroll reset, and heading focus.
- Create `panel/src/components/workspace-scroll.tsx` for progress and back-to-top.
- Create `panel/src/components/scrollable-table.tsx` for horizontal overflow state.
- Modify `panel/src/main.tsx`, `App.tsx`, `components/app-shell.tsx`, `components/admin-dialog.tsx`, and `components/page-header.tsx`.
- Modify all pages that currently render `.table-scroll` wrappers.
- Modify the six panel style sheets without changing the DTA palette or information architecture.
- Modify `panel/e2e/panel.spec.ts`, `package.json`, and `package-lock.json`.

## Task 1: Motion Dependency and Shared Policy

**Files:** `package.json`, `package-lock.json`, `panel/src/main.tsx`, new files under `panel/src/motion`, and `panel/e2e/panel.spec.ts`.

- [ ] Add a failing Playwright test that emulates reduced motion and expects `.app-shell[data-reduced-motion="true"]`.
- [ ] Run `npx playwright test --config panel/playwright.config.ts -g "reduced motion" --project desktop-chromium`; expect failure because the provider does not exist.
- [ ] Install the researched package with `npm install motion@12.43.0`.
- [ ] Define route, overlay, and feedback variants in `motion-config.ts`, including opacity-only reduced variants.
- [ ] Wrap the application with `MotionConfig reducedMotion="user"` in `motion-provider.tsx` and expose reduced-motion state on the shell for behavior and testing.
- [ ] Run the focused test and `npm run panel:build`; expect success.

The provider contract is:

```tsx
<MotionConfig reducedMotion="user" transition={motionTransitions.interface}>
  {children}
</MotionConfig>
```

## Task 2: Route Transition, Scroll Reset, and Focus

**Files:** new `panel/src/motion/page-transition.tsx`; modify `panel/src/App.tsx`, `panel/src/components/app-shell.tsx`, `panel/src/components/page-header.tsx`, and `panel/src/styles/pages.css`.

- [ ] Add a failing test that scrolls `/auditoria`, navigates by keyboard to `/comandos`, expects `window.scrollY === 0`, and expects the commands heading to have focus.
- [ ] Run the focused test on desktop and mobile; expect focus or scroll assertions to fail.
- [ ] Implement `PageTransition` with `AnimatePresence mode="wait" initial={false}` and a location-keyed `motion.div`.
- [ ] On location change, return to top using `auto` for reduced motion and `smooth` otherwise, then focus `[data-page-heading]` with `preventScroll: true`.
- [ ] Add `tabIndex={-1}` and `data-page-heading` to `PageHeader` without changing visible hierarchy.
- [ ] Run focused tests and `npm run panel:build`; expect success.

## Task 3: Native Dialog and Menu Motion

**Files:** `panel/src/components/admin-dialog.tsx`, `panel/src/components/app-shell.tsx`, `panel/src/styles/components.css`, `panel/src/styles/shell.css`, and `panel/e2e/panel.spec.ts`.

- [ ] Add failing tests for user-menu and mobile-more presence states, Escape handling, dialog semantics, and trigger focus restoration.
- [ ] Run focused overlay tests; expect focus restoration or presence-state failures.
- [ ] Wrap user-menu and mobile-more content with `AnimatePresence` and keyed `motion` elements using opacity plus at most `8px` translation.
- [ ] Keep native `showModal()`, `cancel`, and `close` behavior. Record the opening trigger, expose `data-state="opening|open|closing"`, complete the short close animation before `dialog.close()`, and restore focus after close.
- [ ] Prevent duplicate close callbacks and preserve pending mutations.
- [ ] Run focused overlay and existing administration tests; expect success.

## Task 4: Vertical Scroll Progress and Back to Top

**Files:** new `panel/src/components/workspace-scroll.tsx`; modify `panel/src/components/app-shell.tsx`, `panel/src/styles/shell.css`, `panel/src/styles/responsive.css`, and E2E tests.

- [ ] Add failing tests: long audit pages show progress and back-to-top after 480px; short overview pages show neither.
- [ ] Run the tests at desktop and 320px; expect missing-element failures.
- [ ] Implement `useScroll()` plus `useSpring(..., { skipInitialAnimation: true })` for progress.
- [ ] Use `ResizeObserver` to determine whether content is meaningfully longer than the viewport.
- [ ] Use a passive, requestAnimationFrame-throttled listener for button visibility instead of updating React state every pixel.
- [ ] Render a Lucide `ArrowUp` icon button labeled `Voltar ao topo`; use native `window.scrollTo`, smooth only without reduced motion, then focus the page heading.
- [ ] Offset it above mobile navigation and hide it while a native dialog is open.
- [ ] Run focused scroll tests in all four projects; expect success and no page overflow.

## Task 5: Horizontal Table Overflow Affordance

**Files:** new `panel/src/components/scrollable-table.tsx`; modify overview, confrontations, pools, teams, commands, ranking, and audit pages; modify `panel/src/styles/components.css` and E2E tests.

- [ ] Add a failing test that verifies right overflow at the start, both edges in the middle, and no right overflow at the end of a commands table.
- [ ] Run the focused test; expect failure because overflow attributes do not exist.
- [ ] Implement `ScrollableTable` with a stationary outer shell and existing inner `.table-scroll` element.
- [ ] Calculate state with `scrollLeft > 1` and `scrollLeft + clientWidth < scrollWidth - 1`.
- [ ] Update on passive scroll, `ResizeObserver`, and child-size changes; clean up listeners and observers on unmount.
- [ ] Replace existing wrappers without changing table markup or mobile record alternatives.
- [ ] Render edge shadows through shell pseudo-elements so they never affect width or native scrolling.
- [ ] Run focused and existing responsive-table tests; expect success.

## Task 6: Restrained UI Polish and State Motion

**Files:** `panel/src/styles/tokens.css`, `base.css`, `shell.css`, `components.css`, `pages.css`, `responsive.css`, and E2E tests.

- [ ] Add failing assertions for button active state, topbar scrolled separation, reconnecting-only pulse, and mobile geometry.
- [ ] Run visual tests; expect active or scrolled-state failures.
- [ ] Add semantic `--motion-fast`, `--motion-interface`, `--motion-route`, and `--ease-out-interface` tokens.
- [ ] Add restrained `:active` feedback, scrolled topbar separation, one-time mobile-record insertion, and reconnecting-only status pulse.
- [ ] Preserve the global reduced-motion safety net and explicitly remove transform, smooth scroll, record entrance, and pulse under `prefers-reduced-motion: reduce`.
- [ ] Do not add gradients, glow, glass effects, custom scrollbars, or layout-property animation.
- [ ] Run all visual tests and inspect screenshots; expect success.

## Task 7: Verification, Review, Commit, and Deploy

**Files:** all changed source and tests; update `README.md` only if operator behavior requires documentation.

- [ ] Run `npm run build`, `npm test`, `npm run panel:test:e2e`, `npm audit --omit=dev`, and `git diff --check`.
- [ ] Inspect screenshots and geometry at 1440x900, 900x900, Pixel 7, and 320x720. Cover overview, commands, audit, dialog, mobile-more, table edges, back-to-top, and reduced motion.
- [ ] Check browser console output and measure the production bundle change.
- [ ] Review listeners, observers, focus, animation replay, scroll jank, secrets, backend scope, and unrelated changes. Fix all critical and high findings.
- [ ] Stage only intended files, leave `.mimocode/.cron-lock` untouched, commit directly to `main`, and push origin.
- [ ] Stop `admin-dta-bot`, confirm offline, download a frozen backup, require one SQLite database, run `PRAGMA integrity_check`, and compare SHA-256 before and after staging.
- [ ] Run `discloud app commit admin-dta-bot` from guarded staging; update the existing application only.
- [ ] Require production status `Online` and `/health` values `botReady: true`, `guildCount: 3`, and `commandCount: 11`.
- [ ] Verify startup logs, served Motion assets, authenticated panel availability, and no duplicate slash commands.
- [ ] Remove guarded staging, preserve the production backup, restore `.mimocode/.cron-lock`, and confirm only that unrelated file remains modified.
