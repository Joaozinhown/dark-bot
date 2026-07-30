# Veto Audit and DTA Panel UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record the Discord actor for every killer pick/ban and ship a complete DTA cat-inspired, JetBrains Mono administrative interface with stronger readability and responsive HUDs.

**Architecture:** Reuse `AuditLog` and introduce a focused veto-selection service that computes transitions and commits a conditional state update plus audit insert in one Prisma transaction. Keep the existing React information architecture while replacing visual tokens globally and adding purpose-built mobile records for wide operational tables.

**Tech Stack:** TypeScript, Discord.js 14, Prisma 6 with SQLite, Fastify, React 19, TanStack Query, Vite, CSS, Node test runner, Playwright.

---

### Task 1: Define and test the veto transition contract

**Files:**
- Modify: `src/systems/veto-rules.ts`
- Modify: `src/systems/veto-rules.test.ts`
- Create: `src/services/veto-selection-service.ts`
- Create: `src/services/veto-selection-service.test.ts`

- [ ] Add failing tests for MD3/MD5 pick and ban classification, one-based veto steps, pick set numbers, stale commits, invalid killers, and audit payloads.
- [ ] Run `npm run build:ts && node --test build/systems/veto-rules.test.js build/services/veto-selection-service.test.js` and confirm the new tests fail.
- [ ] Implement pure action classification and a service with an injected atomic commit store.
- [ ] Implement the Prisma store with a conditional `VetoState.updateMany` and `AuditLog.create` inside one interactive transaction.
- [ ] Run the focused tests and confirm they pass.

### Task 2: Integrate safe audited selections with Discord

**Files:**
- Modify: `src/systems/veto.ts`
- Modify: `src/events/interactionCreate.ts`
- Modify: `src/web/realtime/event-bus.ts` only if event typing requires it

- [ ] Reject mismatched guild, channel, message, role, and stale killer choices before persistence.
- [ ] Call the veto-selection service with `interaction.user.id`, username, global display name, role context, message, channel, and killer.
- [ ] Handle a losing concurrent click with an ephemeral stale-state response.
- [ ] Update the old Discord message only after commit, then send the next veto step and publish `veto.pick` or `veto.ban` through SSE.
- [ ] Keep final automatic killer assignment unattributed and preserve audit rows after `VetoState` deletion.
- [ ] Run all backend tests.

### Task 3: Make audit events understandable

**Files:**
- Modify: `panel/src/pages/audit-page.tsx`
- Modify: `panel/src/lib/mock-data.ts`
- Modify: `panel/src/types/api.ts` only if a typed detail helper is needed
- Modify: `panel/src/hooks/use-realtime-sync.ts`
- Modify: `panel/e2e/panel.spec.ts`

- [ ] Add mock pick and ban events with actor, team, killer, confrontation, step, and set information.
- [ ] Add failing Playwright expectations for Pick/Ban labels, actor ID, killer context, and mobile audit records.
- [ ] Implement safe unknown-detail parsing with legacy fallbacks.
- [ ] Render a desktop audit table and mobile audit records with expandable technical details.
- [ ] Add `veto.pick` and `veto.ban` to real-time invalidation.

### Task 4: Replace typography and color system

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `panel/src/main.tsx`
- Modify: `panel/src/styles/tokens.css`
- Modify: `panel/src/styles/base.css`
- Modify: `panel/src/styles/shell.css`
- Modify: `panel/src/styles/components.css`
- Modify: `panel/src/styles/pages.css`
- Modify: `panel/src/styles/responsive.css`
- Modify: `panel/src/components/status-badge.tsx`
- Modify: `panel/src/lib/mock-data.ts`
- Modify: `panel/src/pages/teams-page.tsx`
- Modify: `DESIGN.md`
- Modify: `.impeccable/design.json`

- [ ] Install and import `@fontsource-variable/jetbrains-mono` so production does not depend on a system font or third-party font request.
- [ ] Replace violet/blue tokens with neutral black, graphite, ivory, warm gray, and DTA red semantic tokens.
- [ ] Replace every old token and hardcoded purple value, including focus, navigation, badges, inputs, mock colors, and default role color.
- [ ] Standardize body, label, helper, table, heading, and numeric styles around JetBrains Mono weights 400/500/600/700.
- [ ] Update `DESIGN.md` and the Impeccable design source to match the shipped system.

### Task 5: Improve spacing and responsive operational layouts

**Files:**
- Modify: `panel/src/pages/overview-page.tsx`
- Modify: `panel/src/pages/confrontations-page.tsx`
- Modify: `panel/src/pages/pools-page.tsx`
- Modify: `panel/src/components/app-shell.tsx`
- Modify: `panel/src/styles/shell.css`
- Modify: `panel/src/styles/components.css`
- Modify: `panel/src/styles/pages.css`
- Modify: `panel/src/styles/responsive.css`

- [ ] Compact the summary HUD and retain a 2x2 grid on normal mobile widths.
- [ ] Add dedicated mobile records for confrontations and pools, preserving primary actions and status without horizontal scrolling.
- [ ] Increase mobile navigation labels to at least 11px and touch targets to 44px.
- [ ] Add visible hover/focus tooltips to tablet icon-only navigation.
- [ ] Harmonize page, toolbar, section, table, dialog, and form spacing on the 4/8px scale.

### Task 6: Complete verification and release workflow

**Files:**
- Modify: `panel/e2e/panel.spec.ts`
- Modify: documentation only when verification changes the documented contract

- [ ] Run `npm run build`, `npm test`, `npm run panel:test:e2e`, and `npm audit --omit=dev`.
- [ ] Capture and inspect desktop, tablet, and mobile screenshots for every panel route.
- [ ] Verify computed `font-family`, contrast, 200% zoom, focus visibility, touch targets, and absence of horizontal page overflow.
- [ ] Run residue scans for Inter, Cascadia, violet tokens, and purple hardcodes.
- [ ] Perform code and security review, resolve all critical/high findings, and rerun affected tests.
- [ ] Commit on `feat/veto-audit-panel-ux`, push, open a PR against `feat/admin-panel-administration`, deploy to `admin-dta-bot`, and verify live health/logs/UI.

