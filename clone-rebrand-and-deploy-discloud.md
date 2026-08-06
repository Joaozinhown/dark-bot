# Clone, Rebrand, and Deploy Guide (Discloud)

This runbook explains how to create an independent bot from this repository, give it a new identity, make every user-facing surface bilingual in English and Spanish, and host the bot and its administrative panel on a Discloud subdomain.

The clone keeps the current feature set and architecture. It must use its own Discord application, credentials, SQLite database, Discloud application, and subdomain. Never run two bots with the same Discord token or writable database.

## 1. Understand what is being cloned

The current application is one Node.js process with three connected surfaces:

- a Discord bot built with Discord.js;
- a Fastify API with Discord OAuth2, authorization, audit logs, and SSE updates;
- a React administrative panel served by the API.

Current behavior:

- 11 native slash commands plus versioned custom commands created in the Command Studio;
- multi-server data isolation by Discord `guildId`;
- server-specific administrative roles;
- confrontations created in an existing text channel;
- no automatic text or voice channel creation;
- preset maps and killer-only pick/ban;
- random first killer side and alternating sides between sets;
- team roles, players, results, profiles, rankings, reports, and audit history;
- pool and confrontation management from Discord and the panel;
- per-server command availability controls and role restrictions;
- visual and advanced JSON command editing, preview, publishing, rollback, and cloning;
- real-time panel refresh through Server-Sent Events;
- panel access for the server owner, users with `Manage Guild`, or configured administrative roles.

The panel can enable, disable, override, create, preview, publish, roll back, and clone commands. Administrative roles control access to the bot and panel at the server level, while custom command definitions can add command-specific role restrictions. Scripts run inside the restricted QuickJS sandbox and must never receive Node.js, filesystem, process, or network access.

## 2. Decide what "global" means

For this migration, **global product** means that the bot, panel, commands, messages, and documentation support English (`en-US`) and Spanish (`es-ES`) and can serve unrelated Discord servers. English is the default and fallback locale. Spanish is a complete localization, not a partial translation layered over Portuguese copy.

This is different from a **Discord global command registration**. The current startup synchronizes guild-scoped commands to every connected guild and clears global commands to prevent duplicates. That gives immediate per-server synchronization while still supporting multiple servers.

Keep this behavior unless you deliberately want Discord global registration. Changing command scope is a separate release decision. The relevant variables are:

```env
REGISTER_GUILD_COMMANDS=true
REGISTER_GLOBAL_COMMANDS=false
CLEAR_GLOBAL_COMMANDS=true
```

The standalone `npm run deploy` script uses `COMMAND_SCOPE=guild` by default. Do not run it during a normal Discloud update because startup already performs synchronization.

If you deliberately switch to Discord global commands, code changes are required in addition to environment flags. The `GuildCreate` handler in `src/index.ts` currently calls `syncGuildCommands` unconditionally when the bot joins a server. Disable that path when `REGISTER_GUILD_COMMANDS=false`, clear old guild commands once, and test that only one global copy remains. Do not enable both scopes simultaneously.

## 3. Create a migration worksheet

Choose every value before editing code. Example:

| Setting | Current value | New value |
| --- | --- | --- |
| Product name | Dark Bot | Example League Bot |
| Organization | Dark Trials Arena | Example Esports |
| Short label | DTA Admin | ELB Admin |
| Package name | `dark-bot` | `example-league-bot` |
| Discloud app name | Dark Bot | Example League Bot |
| Discloud ID | `admin-dta-bot` | `example-league-bot` |
| Public URL | `admin-dta-bot.discloud.app` | `example-league-bot.discloud.app` |
| OAuth callback | DTA callback | `https://example-league-bot.discloud.app/api/auth/callback` |
| Database filename | `darkbot.db` | Keep it, or rename consistently |
| Discord application | Existing DTA app | New Discord application |
| Brand symbol | DTA symbol | New transparent PNG |
| Hosting avatar | DTA image | New public PNG/JPG/GIF URL |
| Tournament presets | Queens Trials pools | New event pools |

Discloud currently documents a maximum of 20 characters for subdomains, using only letters, numbers, and hyphens. Reserve the new subdomain before committing to the name. Use only the ID in `discloud.config`, not the full `.discloud.app` hostname.

References:

- [Discloud `discloud.config` reference](https://docs.discloud.com/en/configurations/discloud.config)
- [Discloud subdomain requirements](https://docs.discloud.com/en/faq/general-questions/how-to-create-a-subdomain)
- [Discloud CLI guide](https://docs.discloud.com/en/how-to-host-using/cli)
- [Discord OAuth2 and permissions](https://docs.discord.com/developers/platform/oauth2-and-permissions)
- [Discord application commands](https://docs.discord.com/developers/interactions/application-commands)

## 4. Create an independent repository

Clone the source and disconnect it from the DTA repository before making product changes:

```powershell
git clone <SOURCE_REPOSITORY_URL> "C:\Projects\example-league-bot"
Set-Location "C:\Projects\example-league-bot"
git remote rename origin upstream
git remote add origin <NEW_REPOSITORY_URL>
git switch -c feat/initial-rebrand
npm ci
npx playwright install chromium
```

Keep `upstream` only when you intend to review and port future fixes from the original project. Never merge upstream blindly because presets, branding, production URLs, and deployment scripts are product-specific.

Confirm the starting state:

```powershell
git status --short --branch
node --version
npm --version
discloud --version
```

Use Node.js 22 or newer. Install and authenticate the current Discloud CLI according to its official guide before the first upload.

## 5. Create a new Discord application

In the [Discord Developer Portal](https://discord.com/developers/applications):

1. Create a new application with the new product name.
2. Open **Bot**, create the bot user, and set its username and avatar.
3. Generate a new bot token. Store it only in the clone's `.env` and Discloud deployment environment.
4. Copy the **Application ID** for `CLIENT_ID`.
5. Copy the OAuth2 client secret for `DISCORD_CLIENT_SECRET`.
6. Add the local callback `http://127.0.0.1:8080/api/auth/callback`.
7. Add the production callback `https://<NEW_DISCLOUD_ID>.discloud.app/api/auth/callback`.
8. Enable **Guild Install**, configure its installation link, and enable the public-bot setting when people outside the application owner/team must install it.
9. Generate an installation URL with the `bot` and `applications.commands` scopes.
10. Request only the Discord permissions required by the current commands: viewing and sending messages, embeds, message history, managing roles, and using application commands. Validate channel overrides in a test server.
11. Place the bot role above every team role it must manage.
12. Install the new bot in a dedicated test server before production servers.

The current client requests only the standard `Guilds` and `GuildVoiceStates` Gateway intents. It does not request Message Content, Guild Members, or Presence privileged intents. Recheck `src/index.ts` if future features add new events.

The Discord bot avatar and the Discloud application avatar are separate. Changing `AVATAR` in `discloud.config` does not change the bot user shown inside Discord.

## 6. Create fresh secrets and environment settings

Copy the example without copying the original runtime file:

```powershell
Copy-Item .env.example .env
```

Generate unique panel secrets for this clone:

```powershell
node -e "const c=require('node:crypto'); console.log('PANEL_COOKIE_SECRET='+c.randomBytes(48).toString('base64url')); console.log('PANEL_ENCRYPTION_KEY='+c.randomBytes(32).toString('base64'))"
```

Do not paste the output into chat, Git, an issue, or a pull request. Fill `.env` locally:

```env
DISCORD_TOKEN=<NEW_BOT_TOKEN>
CLIENT_ID=<NEW_APPLICATION_ID>
GUILD_ID=<TEST_SERVER_ID>
DATABASE_URL=file:./prisma/darkbot.db
ADMIN_PANEL_ENABLED=true
DISCORD_CLIENT_SECRET=<NEW_OAUTH_CLIENT_SECRET>
DISCORD_REDIRECT_URI=http://127.0.0.1:8080/api/auth/callback
PANEL_COOKIE_SECRET=<NEW_RANDOM_SECRET>
PANEL_ENCRYPTION_KEY=<NEW_32_BYTE_BASE64_KEY>
PORT=8080
NODE_ENV=development
REGISTER_GUILD_COMMANDS=true
REGISTER_GLOBAL_COMMANDS=false
CLEAR_GLOBAL_COMMANDS=true
```

`GUILD_ID` remains a bootstrap and standalone deployment target. At runtime, the bot synchronizes commands and presets for every connected guild.

Before production, change only the environment-specific values:

```env
GUILD_ID=<PRIMARY_PRODUCTION_SERVER_ID>
DISCORD_REDIRECT_URI=https://<NEW_DISCLOUD_ID>.discloud.app/api/auth/callback
PORT=8080
NODE_ENV=production
```

Do not leave the test server ID in the production environment. `GUILD_ID` participates in preset seeding even when that server is not currently connected.

Every clone needs unique values for `DISCORD_TOKEN`, `CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `PANEL_COOKIE_SECRET`, and `PANEL_ENCRYPTION_KEY`.

## 7. Replace clone-specific production safeguards

This repository intentionally contains safeguards tied to the current DTA production app. A clone will fail its production checks until these values and their tests are updated.

Mandatory replacements:

| File | Replace or review |
| --- | --- |
| `discloud.config` | `NAME`, `AVATAR`, and `ID`. Keep `TYPE=site`, `MAIN=build/index.js`, build/start commands, and `AUTORESTART=true`. |
| `src/web/config.ts` | Replace `PRODUCTION_REDIRECT_URI` with the clone's exact HTTPS callback. |
| `src/web/config.test.ts` | Replace production callback fixtures and retain rejection tests for wrong hosts, paths, queries, and fragments. |
| `scripts/prepare-discloud-staging.js` | Replace `STAGING_MARKER`, marker text, `PRODUCTION_SUBDOMAIN`, and DTA-specific error messages. |
| `scripts/prepare-discloud-staging.test.js` | Replace DTA app IDs, callback, marker expectations, names, and fixtures. |
| `scripts/discloud-subdomain-cutover.js` | Do not use unchanged. It hardcodes the DTA source, target, legacy app, database name, callback, and health expectations. |
| `scripts/discloud-subdomain-cutover.test.js` | Update only if the clone will keep a custom cutover workflow. Otherwise remove the cutover script and its test from `npm test` in a separate reviewed change. |
| `src/seed-pools.ts` | Replace the hardcoded DTA guild ID or retire this manual seed script. Normal startup uses environment and connected guild IDs instead. |

For a new independent bot there is no old production app to cut over from. The normal path is a fresh upload, not `npm run deploy:cutover`.

If you rename `darkbot.db`, update all references together:

- `.env.example` and production `.env`;
- `src/database/client.ts`;
- `scripts/migrate.js`;
- staging and cutover scripts;
- script tests;
- local batch files and hosting documentation.

Keeping the internal filename `darkbot.db` is harmless and reduces migration risk. The filename is not visible to users.

## 8. Rebrand every visible surface

Replace product identity without changing business behavior.

### Discord and runtime

- `src/utils/embeds.ts`: logo URL, footer organization, titles, and user-facing copy.
- `src/commands/gerenciar-pool.ts` and `src/commands/relatorios.ts`: logo and footer constants.
- `src/index.ts` and `src/events/ready.ts`: process labels, health text, and logs.
- `assets/queens-trials-logo.png`: replace and rename the source asset if it remains in use.
- `DTA BOT FINAL.zip`: delete this tracked upstream archive from the clone; do not distribute it under the new brand.
- `package.json`: package name and description.
- `package-lock.json`: regenerate its package metadata with `npm install` after changing `package.json`.
- `src/config.ts`: Discord embed colors when the new product uses another palette.
- `start.bat`, `stop.bat`, and `status.bat`: optional local Windows labels.

### Administrative panel

- `panel/public/dta-symbol.png`: replace with a transparent square PNG.
- `panel/index.html`: `lang`, title, favicon, description, and theme metadata.
- `panel/src/components/brand.tsx`: organization and panel name.
- `panel/src/App.tsx`: loading label and session text.
- `panel/src/components/app-shell.tsx`: bot signature and navigation labels.
- `panel/src/context/guild-context.tsx`: replace the `dta:selected-guild` browser storage key so clones cannot collide on the same browser origin.
- all files under `panel/src/pages`: headings, actions, empty states, confirmations, and errors.
- `panel/src/lib/mock-data.ts`: development-only organization, roles, commands, and examples.
- `panel/e2e/panel.spec.ts`: title, branding, labels, and route expectations.
- `panel/src/styles/tokens.css` and related CSS: replace the palette only when the new brand requires it.

### Product and operational documentation

Review `README.md`, `PRODUCT.md`, `DESIGN.md`, `.impeccable/design.json`, `BOT-HOSTING.md`, and `docs/`. Historical DTA cutover notes should be archived or clearly labeled as upstream history, not reused as clone instructions.

Use a final residue scan:

```powershell
rg -n --hidden -S "Dark Bot|Dark Trials|DTA|Queens Trials|Queens|admin-dta-bot|dta-admin|1785101572014|darkbot|queens-trials" `
  -g "!node_modules/**" -g "!build/**" -g "!panel/dist/**" -g "!.git/**"
Get-ChildItem -Recurse -File -Include *.zip,*.7z,*.rar | Select-Object FullName
```

Review every result. Keep `darkbot.db` only if that internal filename was an explicit decision.

## 9. Localize the product in English and Spanish

Changing the brand alone is not enough. English and Spanish must cover command metadata, responses, errors, embeds, panel content, accessibility labels, and seeded data. Remove Portuguese from user-facing surfaces in the clone; internal database field names can remain unchanged.

### Slash command contract

Use English as each command's stable API name and provide Spanish command localizations. The 11 current Portuguese names map as follows:

| Current command | English base name | Spanish localization |
| --- | --- | --- |
| `/configurar-bot` | `/configure-bot` | `/configurar-bot` |
| `/criar-confronto` | `/create-match` | `/crear-partido` |
| `/encerrar` | `/close-match` | `/cerrar-partido` |
| `/gerenciar-cargo` | `/manage-role` | `/gestionar-rol` |
| `/gerenciar-pool` | `/manage-pool` | `/gestionar-pool` |
| `/listar-confrontos` | `/list-matches` | `/listar-partidos` |
| `/perfil` | `/profile` | `/perfil` |
| `/ranking` | `/leaderboard` | `/clasificacion` |
| `/relatorios` | `/reports` | `/informes` |
| `/resultado` | `/result` | `/resultado` |
| `/setup-cargo` | `/setup-role` | `/configurar-rol` |

Apply the selected names consistently to:

- each `SlashCommandBuilder` name, description, subcommand, option, and choice under `src/commands`, using English base values and Discord `es-ES` localizations;
- the `ADMIN_COMMANDS` set in `src/index.ts`;
- command references embedded in help and error messages;
- command-setting records and panel command labels;
- `src/tests/commands-contract.test.ts` snapshots and expectations;
- any E2E test that searches for command names.

A command rename is a contract change. On the new application, do it before inviting production users. Startup's full `PUT` synchronization removes obsolete guild command payloads and registers the new set.

Suggested translations are not mandatory API names. Prefer short, stable names that match Discord's command naming rules. Localize subcommands and options as well. Keep the English base names stable so dashboards, tests, audit records, and integrations do not depend on the user's Discord locale.

### Command Studio locale contract

The upstream Command Studio currently stores localized text with `ptBR` and `enUS` keys. A global English/Spanish clone must replace that contract instead of placing Spanish text in a field named `ptBR`:

- change `LocalizedText` and its Zod schema under `src/custom-commands` to `enUS` and `esES`;
- update factories, templates, compiler localizations, runtime locale selection, preview payloads, and fallback rules;
- map Discord `es-ES` and `es-419` interaction locales to `esES`, and fall back to `enUS` for every other locale;
- update panel types, editor labels, mock data, API fixtures, unit tests, and Playwright tests;
- update existing JSON definitions only when migrating a populated clone; a fresh clone should start with a fresh database;
- retain English as the required fallback for every name, description, reply, embed, component, modal, and validation error.

Search the complete locale contract before editing:

```powershell
rg -n "ptBR|pt-BR|PortugueseBR|Portuguese|enUS|en-US|English" src panel prisma docs `
  -g "*.ts" -g "*.tsx" -g "*.json" -g "*.md"
```

### Runtime copy

Provide equivalent English and Spanish catalogs for all user-facing strings in:

- `src/commands`;
- `src/systems/veto.ts`;
- `src/utils/embeds.ts`;
- user-facing errors returned from `src/services`, `src/web/runtime.ts`, `src/web/server.ts`, `src/web/config.ts`, `src/web/panel-actions.ts`, and `src/utils/env.ts`;
- the complete `panel/src` tree;
- `panel/index.html`, with the active document language updated when the user changes locale.

Add an explicit language selector to the panel account or settings menu. Persist only the locale code, never translated content. Initial selection should use the authenticated user's saved preference, then the browser locale, then `en-US` as the final fallback. Do not mix languages on one screen when a translation key is missing; render the English fallback.

Do not translate database column names merely for presentation. Prisma field names such as `nome`, `mapas`, and `criadoEm` are internal contracts. Renaming them requires a schema migration and provides no user benefit.

Search for remaining Portuguese text after localization:

```powershell
rg -n "Configura|Confronto|Servidor|Cargo|Equipe|Time|Mapa|Vencedor|Encerrar|Criar|Excluir|Salvar|Painel|Auditoria|Nenhum|Erro|Sucesso" `
  src panel -g "*.ts" -g "*.tsx" -g "*.html"
```

This search is a review aid, not proof of complete localization. Inspect English and Spanish labels, placeholders, aria text, validation errors, Discord embeds, confirmation dialogs, command choices, and Command Studio templates manually. Have a fluent Spanish reviewer check terminology before production.

## 10. Replace tournament presets and characteristics

Edit `src/data/pool-presets.ts` for the clone's default event:

- pool names;
- match format (`MD3` or `MD5` in the current internal contract);
- one preset map per set;
- allowed killers and their order.

Also update:

- `src/systems/veto-rules.test.ts` when preset names or counts are asserted;
- preset service tests when behavior or seeded shape changes;
- panel mock data;
- command and README examples.

Preset synchronization is additive by pool name. It does not overwrite a pool that already exists. Decide final preset names before the first production startup, or remove obsolete pools manually from the new database.

Keep these current gameplay rules unless the new bot intentionally differs:

- maps are fixed per set;
- only killers go through pick/ban;
- the first killer side is random;
- the starting side alternates by set;
- pick/ban has no automatic timeout;
- confrontation messages use an existing text channel;
- no text or voice channels are created.

## 11. Start with a fresh database

For independent bots, use a fresh SQLite database. Do not copy DTA users, OAuth sessions, guild IDs, role IDs, channel IDs, command settings, audit history, or confrontation data.

```powershell
npm run db:generate
npm run db:deploy
```

Confirm the generated database location before staging:

```powershell
Get-ChildItem -Recurse prisma -Filter *.db
```

Because Prisma resolves relative SQLite paths from the schema location, the current configuration may create `prisma\prisma\darkbot.db`. Pass the actual file returned above to `deploy:stage`.

An exact data migration is appropriate only when the clone replaces the same bot application for the same Discord servers. Before copying such a database:

1. stop the source process;
2. make a backup;
3. run SQLite `PRAGMA integrity_check`;
4. invalidate or remove `WebSession` rows when OAuth credentials or encryption keys change;
5. verify every stored guild, role, and channel ID still belongs to the destination bot's servers;
6. never start source and destination against the same database.

## 12. Validate locally

Build and test before logging in with the new bot:

```powershell
npm run build
npm test
npx playwright install chromium
npm run panel:test:e2e
npm audit --omit=dev
```

Start the combined process:

```powershell
npm start
```

Validate:

1. the bot logs in as the new Discord identity;
2. exactly 11 commands appear once in the test server;
3. no old Portuguese-only command remains, and Discord displays Spanish localizations when the client locale is Spanish;
4. the panel opens at `http://127.0.0.1:8080`;
5. Discord OAuth returns to the local callback;
6. only authorized servers are listed;
7. administrative-role authorization persists after logout and restart;
8. a test pool, team role, match, pick/ban, result, close action, ranking, and audit entry work;
9. no text or voice channel is created;
10. restarting the process preserves database state.

Do not proceed while tests still expect DTA branding, callbacks, app IDs, Portuguese user-facing payloads, or missing Spanish translations.

## 13. Reserve and configure the Discloud application

The panel makes this bot a Discloud `site`, even though it also connects to Discord. Current Discloud documentation requires a Platinum plan or higher for sites/APIs, a minimum of 512 MB for a site, and port 8080 for the managed subdomain.

Reserve the new subdomain in the Discloud dashboard, then update `discloud.config`:

```ini
NAME=Example League Bot
TYPE=site
MAIN=build/index.js
RAM=512
VERSION=latest
BUILD=npm run build
START=npm run start
AUTORESTART=true
AVATAR=https://example.com/example-league-bot.png
ID=example-league-bot
```

`AVATAR` must be a stable public direct image URL in a supported format. It controls the Discloud dashboard image, not the Discord bot avatar.

Set the production environment to the exact callback:

```env
DISCORD_REDIRECT_URI=https://example-league-bot.discloud.app/api/auth/callback
PORT=8080
NODE_ENV=production
```

The same exact URL must be registered in the Discord Developer Portal. Scheme, hostname, path, port, query, and fragment are validated strictly by the application.

## 14. Prepare a safe first deployment

The repository's `.discloudignore` excludes `.env`, SQLite files, build output, and documentation. Do not weaken the repository ignore file. Use the staging script after replacing its DTA-specific safeguards and tests.

Commit the complete rebrand first because staging requires a clean Git tree:

```powershell
git status --short
git diff --check
git add -- package.json package-lock.json discloud.config src panel scripts docs assets README.md PRODUCT.md DESIGN.md
git status --short
git diff --cached --check
git diff --cached --stat
git commit -m "feat: rebrand bot for Example League"
```

Adjust the staged path list to the files intentionally changed, including deliberate deletions. Inspect `git diff --cached` before committing and confirm that no secret, database, backup, staging directory, or upstream archive is staged.

Create the production `.env`, migrate a fresh database, and locate it:

```powershell
npm run db:deploy
$databasePath = "prisma\prisma\darkbot.db"
$databases = @(Get-ChildItem -Recurse prisma -Filter *.db)
if ($databases.Count -ne 1) { throw "Expected exactly one SQLite database; found $($databases.Count)." }
if ($databases[0].FullName -ne (Join-Path (Get-Location) $databasePath)) { throw "Unexpected SQLite path: $($databases[0].FullName)" }
$database = $databases[0].FullName
Get-FileHash -Algorithm SHA256 $database
```

Use the renamed expected path if the clone intentionally changed the database filename. Do not select an arbitrary first `*.db`. The staging tests validate path boundaries, but the operator must still verify that the selected file is the intended fresh database.

Prepare staging only inside the Windows temporary directory:

```powershell
$staging = Join-Path $env:TEMP "example-league-bot-$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())"
npm run deploy:stage -- --output $staging --database $database
```

Inspect the package without printing secrets:

```powershell
Get-ChildItem $staging -Force
Get-Content (Join-Path $staging "discloud.config")
Test-Path (Join-Path $staging ".env")
Test-Path (Join-Path $staging "prisma\prisma\darkbot.db")
```

From the staging directory, run the upload command supported by the installed CLI. The current repository workflow uses:

```powershell
Push-Location $staging
try {
  discloud app upload
  if ($LASTEXITCODE -ne 0) { throw "Discloud upload failed." }
} finally {
  Pop-Location
}
```

If the installed CLI exposes the official short form instead, confirm with `discloud --help` and use `discloud up` from the staging directory.

Remove staging through the guarded cleanup command:

```powershell
npm run deploy:stage -- --cleanup $staging
```

## 15. Verify production

Check the application and logs:

```powershell
discloud app status <NEW_DISCLOUD_ID>
discloud app logs <NEW_DISCLOUD_ID>
$health = Invoke-RestMethod "https://<NEW_DISCLOUD_ID>.discloud.app/health"
$health | ConvertTo-Json -Depth 5
```

Expected production evidence:

- the Discloud app is online;
- the health response reports the bot ready;
- the command count is 11;
- startup reports the new bot user and every connected guild;
- three preset pools, or the clone's intended count, synchronize per guild;
- 11 guild commands synchronize per connected guild;
- the panel login redirects to Discord and returns successfully;
- the panel uses only the new name, symbol, palette, and complete English/Spanish copy;
- no duplicate slash commands appear;
- a full test confrontation survives a restart.

Invite the bot to additional servers only after this smoke test. Each server starts with isolated data and configures its own administrative roles.

## 16. Update an existing clone

For later releases:

1. create a feature branch;
2. update tests with the change;
3. run the complete verification suite;
4. commit and merge through review;
5. announce a maintenance window and stop the production app before freezing the database;
6. confirm the app is offline, then download a backup containing the frozen production database;
7. extract the backup safely, require exactly one expected database, and run SQLite `PRAGMA integrity_check`;
8. prepare a clean staging package with that frozen database and record its SHA-256 before and after staging;
9. update the existing app instead of creating a second app;
10. verify status, logs, health, OAuth, command count, and persistence before ending maintenance.

The current CLI workflow uses:

```powershell
discloud app stop <NEW_DISCLOUD_ID>
discloud app status <NEW_DISCLOUD_ID>
discloud app backup <NEW_DISCLOUD_ID> <FROZEN_BACKUP_DIRECTORY> --save
discloud app commit <NEW_DISCLOUD_ID>
discloud app status <NEW_DISCLOUD_ID>
discloud app logs <NEW_DISCLOUD_ID>
```

Run the commit from the validated staging directory so the deployed package includes the intended `.env`, compiled output, and frozen database. The staging database hash must match the extracted frozen backup. Confirm syntax with the installed CLI version before a production update.

Do not back up while the app remains writable and then deploy that stale copy. Any match, role, command, session, or audit write after such a backup would be lost when the staged SQLite file replaces production.

Never leave two applications online with the same Discord token. If a replacement deployment is required, stop and back up the active app before starting the replacement.

## 17. Rollback and recovery

Before every production change:

- download a Discloud backup;
- record the active Git commit;
- verify the backup contains exactly one expected SQLite database;
- keep the previous package until production validation finishes.

If a release fails:

1. stop the broken application;
2. preserve its database if users may have written new data;
3. restore the previous code and compatible database together;
4. start only one application with the token;
5. recheck health, OAuth, command synchronization, and one database write.

Do not restore an older database over newer production data without first preserving and reconciling the newer copy.

## 18. Security checklist for every clone

- New Discord application and bot token.
- New OAuth client secret.
- New cookie secret and encryption key.
- Exact HTTPS production callback.
- `.env`, databases, backups, and staging excluded from Git.
- No secrets in terminal screenshots, logs, commits, issues, or documentation.
- Least-privilege Discord install permissions.
- Panel authorization tested with an allowed role and a denied account.
- OAuth sessions invalidated when encryption or Discord credentials change.
- One live process per Discord token and writable SQLite database.
- Dependency audit reviewed before deployment.

## 19. Completion checklist

The clone is complete only when all items below are true:

- [ ] Independent Git repository and branch history.
- [ ] New Discord application, bot identity, token, and OAuth secret.
- [ ] Unique Discloud app, subdomain, and production callback.
- [ ] All DTA and Queens Trials branding removed.
- [ ] All user-facing bot and panel copy localized in English and Spanish.
- [ ] English fallback and Spanish locale selection tested.
- [ ] Slash command base contract and Spanish localizations intentionally translated and tested.
- [ ] Command Studio definitions use `enUS` and `esES`, with no Spanish content stored under Portuguese keys.
- [ ] Presets and event characteristics replaced.
- [ ] Fresh SQLite database created and persisted after restart.
- [ ] DTA-specific deployment safeguards replaced or removed safely.
- [ ] Build, automated tests, Playwright, and audit completed.
- [ ] Exactly 11 commands shown once in Discord.
- [ ] Authorized panel access persists; unauthorized access is denied.
- [ ] Full confrontation workflow passes in a test server.
- [ ] Discloud status, logs, health, OAuth, and restart persistence verified.
- [ ] Backup and rollback procedure tested.

## 20. Recommended template improvements

Before producing many clones, consider one reviewed refactor of the upstream project:

- move brand name, short name, logo, footer, and health label into one typed product config;
- read the production callback from an allowlisted Discloud ID instead of a DTA constant;
- make staging markers, subdomain, database filename, and expected command count configurable;
- isolate tournament presets in a product-specific data file;
- centralize all user-facing strings in typed English and Spanish message catalogs with an English fallback;
- add a CI residue check for forbidden upstream brand terms;
- add a template initialization script that asks for the migration worksheet values and refuses to copy secrets or databases.

These improvements reduce repetitive edits, but they are not required for the first documented clone. Implement them separately with tests and review so the current production bot remains unchanged.
