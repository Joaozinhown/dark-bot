# Veto Audit and DTA Panel UX Design

## Objective

Persist the Discord user responsible for every valid killer pick or ban and make those events understandable in the existing audit panel. Redesign the complete administrative interface around the DTA cat artwork: neutral black and graphite surfaces, ivory text, DTA red accents, JetBrains Mono, stronger hierarchy, and more efficient HUD spacing.

## Veto Audit

The existing `AuditLog` model will store veto events. A valid interaction creates either `veto.pick` or `veto.ban` with the Discord user ID as `actorUserId`, `confrontation` as the entity type, and the confrontation ID as the entity ID.

Structured details preserve the actor display-name snapshot, username, team side, role ID and name, killer, one-based veto step, optional set number, message ID, and channel ID. Bans have no set number because they eliminate an option rather than assign a set. The last remaining killer is assigned automatically and is not attributed to a person.

The state transition and audit insert must be atomic. A compare-and-swap update checks the previous step, turn, message, and serialized killer state. Only one concurrent click can commit. Old messages, wrong guilds, wrong channels, wrong teams, unavailable killers, and stale state do not create audit entries.

Discord is acknowledged before the database operation but its public message is updated only after the transaction commits. A fresh prompt is still sent if editing the previous message fails, preventing the confrontation from becoming stuck.

## Audit Experience

The audit page remains the single operational history. Veto events receive explicit Pick and Ban labels. The primary scan order is action, responsible user, target confrontation, killer/team, and time. Technical IDs and complete structured details remain available through an expandable details row.

The responsible user is shown using the stored display-name and username snapshot, followed by the immutable Discord ID. Older records fall back to the ID. Desktop uses a compact table; mobile uses stacked records instead of a forced 720px table.

## Visual System

JetBrains Mono Variable is bundled with the frontend and used for all UI text and code. Supported weights are 400 through 700. The scale stays fixed because this is an operational product, not a marketing surface.

Palette sampled from the DTA cat reference:

- background: neutral near-black;
- sidebar/toolbars: dark graphite;
- surfaces: layered charcoal;
- primary text: warm ivory;
- secondary text: warm gray with WCAG AA contrast;
- primary/focus/selection: DTA claw red;
- success and warning: semantic green and amber only;
- danger: red with distinct outlined/tinted treatment.

The former violet system is removed from tokens, hardcoded values, controls, navigation, focus, charts, and documentation.

## Layout and Accessibility

All interactive controls are at least 40px on desktop and 44px on mobile. Body text remains at 15px with increased line height; helper text never drops below 12px. HUD metrics use a 2x2 mobile grid with 64-68px rows instead of a tall single column. Tables use clearer layer separation, sticky headers where useful, and mobile record layouts for audit, confrontations, and pools.

Tablet icon-only navigation gains accessible tooltips. Focus uses the DTA red light token. Motion remains limited to state feedback and respects reduced-motion settings. Verification covers contrast, 200% zoom, horizontal overflow, desktop/tablet/mobile screenshots, and keyboard-visible focus.

## Acceptance Criteria

- Every successful user pick or ban persists one audit event with actor ID and structured context.
- Invalid, stale, or losing concurrent interactions persist no event.
- Audit history survives veto finalization.
- The panel displays veto records clearly on desktop and mobile.
- JetBrains Mono is actually loaded from the application bundle.
- No violet brand token or old purple hardcode remains in the panel.
- Text, controls, HUDs, dialogs, navigation, and mobile layouts meet the defined visibility and spacing rules.
- Backend, frontend, migration, integration, and Playwright tests pass.

