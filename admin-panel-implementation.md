# DTA Admin Panel Implementation

## Non-negotiable constraints

- Preserve current bot configuration until explicit production cutover approval.
- Preserve restorable factory definitions for all 11 native slash commands.
- Keep bot operational independently from the panel.
- Never expose `DISCORD_TOKEN`, OAuth tokens or session secrets to browser code.
- Execute optional scripts only in the bounded QuickJS sandbox and restricted Discord SDK.
- Every API route revalidates user, guild and capability server-side.

## Target architecture

One Node.js process hosts the Discord client, API and built frontend on the Platinum plan.

```text
Browser
  -> Discord OAuth2 and secure session
  -> REST API for reads and mutations
  -> SSE stream for live updates
  -> shared application services
  -> Prisma database and Discord client
```

Slash command handlers and API controllers must call the same application services. The panel cannot duplicate tournament rules.

The Discloud Platinum deployment uses `TYPE=site`, port `8080`, `0.0.0.0` and a reserved subdomain because the same process exposes a web interface. Backup and rollback remain mandatory.

## Implementation status

| Phase | Status | Evidence |
| --- | --- | --- |
| Baseline and contracts | Complete | 11 names and full payload hash protected. |
| Shared services | Complete | Slash handlers and panel runtime share domain services. |
| Persistence | Complete | Prisma migrations, idempotent presets, sessions, audit and command settings. |
| OAuth2 and API | Complete | Session, CSRF, rate limit, guild authorization and safe errors. |
| Panel | Complete | Eight operational views, responsive layout and Playwright coverage. |
| Administration P0 | Complete | Pools, teams, members, permissions, command toggles and confrontations. |
| Live operations | Complete for current scope | SSE, reconnect, heartbeat, stream limits and health. |
| Dynamic command studio | Complete | PT-BR/en-US, visual/JSON editor, simulation, versions, clone and sandbox. |
| Platinum deployment | Active | `admin-dta-bot` is the production Discloud subdomain. |

## Authorization model

A user can access a guild only when:

1. Bot is connected to guild.
2. OAuth account belongs to guild.
3. Account owns guild, has `Manage Guild`, or has a role listed in `GuildConfig.adminRoleIds`.

Capabilities are evaluated per guild. Initial roles: viewer, operator and administrator. Existing configured admin roles receive administrator capability to preserve current behavior.

## Command model

- Native slash factories remain code-defined and protected by contract tests.
- Per-guild overrides may retain the native handler or replace it with a validated workflow.
- Custom commands support localized payloads, components, conditions, roles, versioning and rollback.
- Scripts require a separate allowlist and execute in QuickJS without Node.js or network access.

## Data and persistence

SQLite remains unchanged during foundation. Before panel writes are enabled:

- Replace destructive startup synchronization with tested migrations.
- Make preset insertion idempotent; panel edits must survive restart.
- Add audit log, web session and per-guild feature configuration models.
- Prove backup and restore against a copied database.

PostgreSQL is a later decision, triggered by multi-instance hosting, failed persistence guarantees or measured concurrency pressure.

## Delivery phases

### Phase 0: baseline and contracts

- Create branch from current production candidate.
- Record product, design and architecture.
- Freeze slash payloads with contract tests.
- Verify app identity, branch state and rollback source without changing production.

Exit: existing test suite and command contract pass; no runtime file changed.

### Phase 1: shared services

- Extract pool, role, confrontation, report and permission logic from handlers.
- Keep handlers as adapters with unchanged payloads.
- Add unit and integration tests before each extraction.

Exit: command contract unchanged; behavior regression suite green.

### Phase 2: persistence foundation

- Introduce Prisma migrations, audit records and idempotent presets.
- Add temporary isolated database tests.
- Rehearse migration and restore on copied data.

Exit: pool edits survive restart; no destructive startup operation.

### Phase 3: OAuth2 and API

- Implement Discord OAuth2, server-side sessions, CSRF and rate limits.
- Intersect OAuth guilds with bot guilds and current admin roles.
- Add read-only API first, then protected mutations.

Exit: horizontal guild access tests pass; authorization receives 100% branch coverage.

### Phase 4: read-only panel

- Build shell, login, guild selector and operation view.
- Add confrontations, pools, teams, commands, ranking, reports and system status.
- Validate desktop, tablet and mobile with Playwright screenshots.

Exit: real data visible only to authorized users; no write actions enabled.

### Phase 5: administration P0

- Enable pool, role, member, confrontation, result and permission actions.
- Require confirmation for destructive operations.
- Emit audit records and SSE updates from shared services.

Exit: panel and slash flows produce equivalent results in test guild.

### Phase 6: live operations and command studio

- Add per-guild command toggles.
- Add live veto state, reconnection, health and operational alerts.

- Add versioned guild slash commands, visual/JSON editing, simulation and component persistence.
- Keep global commands empty and preserve native factory restore.
- Add runtime logs page with official API and process-mirror sources.

Exit: no duplicate commands, cross-guild events or stale orphan registrations.

### Phase 7: Platinum deployment

- Confirm Platinum subscription and production app ID.
- Create backup and version tag.
- Change hosting mode only in cutover PR after approval.
- Bind port 8080 on `0.0.0.0`, configure subdomain and OAuth callback.
- Deploy, smoke test, monitor and retain rollback package.

Exit: bot ready, panel authenticated, SSE live, factory commands recoverable and logs clean.

## Test gates

- Unit tests for rules, validation and authorization.
- Prisma integration tests with isolated temporary database.
- Discord API mocks for roles, guilds, rate limits and failures.
- OAuth, session, CSRF and cross-guild access tests.
- SSE isolation, reconnect and event ordering tests.
- Playwright E2E on desktop and mobile.
- Slash command names, descriptions, options and permissions contract.
- Build, dependency audit, backup restore and post-deploy smoke checks.

No phase merges with failing tests, open critical/high security findings or unapproved command contract changes.

## Subagent workflow

- Architect: phase boundaries and contracts.
- TDD/backend: services, persistence, OAuth and API.
- Frontend designer: information architecture and DTA visual system.
- Security reviewer: OAuth, sessions, CSRF, RBAC and secrets.
- QA tester: integration, E2E and deploy gates.
- Documentation reviewer: handoff and operational runbooks.

Each phase ends with independent code review before commit, push or deployment.
