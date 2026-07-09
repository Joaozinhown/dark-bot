# Handoff de Deploy - Dark Bot

Data: 2026-07-08

Este documento resume o que foi feito, o que foi testado e os proximos passos para continuar a migracao do bot Discord.

## Objetivo

Colocar o Dark Bot online 24/7 em uma hospedagem confiavel para bot Discord.

O deploy no Render chegou a ficar `live` no HTTP, mas o bot nao conseguiu completar a conexao com o Gateway do Discord. A decisao atual e trocar a plataforma para Bot-Hosting.net.

## Estado atual do projeto

Repositorio/local:

- Workspace: `C:\Users\jmath.MATHEUS\OneDrive\Documents\Antigravity Projetos\DTA BOT FINAL`
- Projeto Node.js + TypeScript + Discord.js v14
- Banco SQLite via Prisma
- Entry point compilado: `dist/index.js`
- Comando principal: `npm start`

Arquivos alterados/preparados para Bot-Hosting.net:

- `package.json`
- `package-lock.json`
- `src/index.ts`
- `src/database/client.ts`
- `BOT-HOSTING.md`
- `docs/HANDOFF-DEPLOY.md`

## Problemas encontrados no Render

### 1. `dist/index.js` nao existia no deploy

Erro inicial:

```text
Error: Cannot find module '/opt/render/project/src/dist/index.js'
```

Causa:

- Render rodava `node dist/index.js`.
- O build nao estava gerando `dist/index.js` no fluxo esperado.

Correcao feita:

- `package.json` passou a compilar no `postinstall`.
- Scripts importantes:

```json
"build": "prisma generate && npm run build:ts",
"build:ts": "tsc",
"postinstall": "prisma generate && npm run build:ts"
```

Resultado:

- Build passou.
- `dist/index.js` passou a existir no deploy.

### 2. `DISCORD_TOKEN` ausente

Erro:

```text
[Dark Bot] DISCORD_TOKEN nao configurado no .env
```

Causa:

- Variavel nao estava configurada no Render.

Acao:

- `DISCORD_TOKEN` foi configurado no Render.
- Depois, token foi resetado/atualizado pelo usuario.

Resultado:

- O bot passou da validacao de env e tentou conectar ao Gateway do Discord.

### 3. Render exigia porta aberta

Erro:

```text
No open ports detected
Bind your service to at least one port.
If you don't need to receive traffic on any port, create a background worker instead.
```

Causa:

- Bot Discord e processo persistente, nao servidor web.
- Render Web Service exige porta HTTP aberta.

Correcao feita no Render:

- Foi adicionado servidor HTTP simples para health check.
- Servidor escuta em `0.0.0.0` usando `process.env.PORT`.

Resultado:

- Render passou a detectar porta.
- Servico ficou `live`.

### 4. Multiplos servicos duplicados no Render

Foram criados varios servicos:

- `dark-bot`
- `dark-bot-1`
- ...
- `dark-bot-11`
- `DTA Discord Bot`

Problema:

- Varios processos tentando usar o mesmo `DISCORD_TOKEN`.
- Isso poderia causar conflito de sessao e rate limit no Discord Gateway.

Acoes:

- Servicos duplicados `dark-bot-*` foram suspensos.
- `DTA Discord Bot` foi removido/apagado pelo usuario.
- Confirmado via MCP que restou apenas `dark-bot-11` ativo.

### 5. Timeout no Gateway do Discord

Mesmo com:

- build corrigido,
- token configurado,
- token resetado,
- porta HTTP aberta,
- clones suspensos/removidos,
- espera de 30 minutos,
- redeploy unico,

o bot continuou falhando:

```text
[Dark Bot] Conectando ao Gateway do Discord... tentativa 1
[Dark Bot] Falha ao conectar no Discord: Timeout em client.login apos 120000ms.
```

Conclusao:

- O Web Service do Render ficava `live`, mas o processo nao completava o WebSocket com o Gateway do Discord.
- O problema nao parecia mais ser build, env, porta ou duplicacao.
- Recomendacao: nao insistir no Render Web Service para este bot.

## Deploys relevantes no Render

Servico principal usado no final:

- Nome: `dark-bot-11`
- Service ID: `srv-d97c677avr4c7387kd5g`
- URL: `https://dark-bot-11.onrender.com`

Commits/deploys relevantes:

- Commit final usado: `638e89bcfe71de44d970ae38b8d2cef2a66826bd`
- Mensagem: `refactor: improve Discord login handling and remove unused user utilities`

Redeploy final apos espera:

- Deploy ID: `dep-d97dbkfaqgkc73ai6ce0`
- Status: `live`
- Resultado: timeout em `client.login` apos 120s.

## Mudancas feitas no codigo

### `src/index.ts`

Mudancas:

- Servidor HTTP ficou opcional:

```ts
if (process.env.ENABLE_HTTP_SERVER === 'true' || process.env.PORT) {
  startHealthServer();
}
```

Motivo:

- Plataformas de bot nao precisam abrir porta.
- Render pode continuar usando HTTP caso `PORT` exista.

Outras mudancas feitas durante a investigacao:

- Removido uso de intent privilegiada `GuildMembers`.
- Login no Discord passou a ter timeout e retry com backoff.
- Mensagens de erro ficaram mais genericas, sem citar Render.
- Token e validado para evitar espacos, aspas e prefixo `Bot`.

### `src/database/client.ts`

Mudanca:

```ts
process.env.DATABASE_URL ??= 'file:./prisma/darkbot.db';
```

Motivo:

- Algumas hospedagens podem nao definir `DATABASE_URL`.
- Prisma precisa dessa env antes de instanciar `PrismaClient`.
- O bot agora usa SQLite local por padrao.

### `package.json`

Mudancas:

- `typescript` e `@types/node` foram movidos para `dependencies`.
- Isso ajuda em hospedagens que instalam apenas dependencias de producao mas ainda precisam compilar no `postinstall`.
- Adicionado script:

```json
"start:bot-hosting": "npm start"
```

Comandos principais atuais:

```text
npm install
npm start
```

### `BOT-HOSTING.md`

Criado guia especifico para Bot-Hosting.net com:

- comando de install,
- comando de start,
- variaveis de ambiente,
- logs esperados.

## Estado atual para Bot-Hosting.net

Config recomendada:

```text
Runtime: Node.js
Install command: npm install
Start command: npm start
Main file, se o painel pedir: dist/index.js
```

Variaveis de ambiente:

```env
DISCORD_TOKEN=token_puro_do_bot
CLIENT_ID=id_da_aplicacao
GUILD_ID=id_do_servidor
DATABASE_URL=file:./prisma/darkbot.db
```

Importante:

- Nao configurar `PORT`.
- Nao configurar `ENABLE_HTTP_SERVER`.
- Nao colocar `Bot ` antes do token.
- Nao colocar aspas ao redor do token.
- Nao subir `.env` com segredo para repositorio publico.

## Verificacoes ja feitas localmente

Comando:

```text
npm install
npm run build
```

Resultado:

- Prisma Client gerado.
- TypeScript compilou com sucesso.
- `dist` gerado.

Aviso local observado no Windows:

```text
Test-Path : Acesso negado
```

Esse aviso vem do `npm.ps1` local e nao impediu os comandos. Exit code foi `0`.

## Proximos passos

### 1. Subir o codigo atualizado

Subir para o repositorio GitHub ou fazer upload para Bot-Hosting.net com os arquivos atuais.

Confirmar que estes arquivos estao incluidos:

- `package.json`
- `package-lock.json`
- `prisma/schema.prisma`
- `src/**`
- `BOT-HOSTING.md`

Nao subir:

- `.env`
- `node_modules`

### 2. Criar app/bot na Bot-Hosting.net

No painel:

```text
Install command: npm install
Start command: npm start
```

Se pedir arquivo principal:

```text
dist/index.js
```

### 3. Configurar env vars

Adicionar no painel:

```env
DISCORD_TOKEN=...
CLIENT_ID=...
GUILD_ID=...
DATABASE_URL=file:./prisma/darkbot.db
```

### 4. Iniciar e conferir logs

Logs esperados:

```text
[Dark Bot] Iniciando...
[Dark Bot] Conectando ao Gateway do Discord... tentativa 1
[Dark Bot] Bot online como ...
[Startup] Comandos registrados com sucesso!
```

Se aparecer:

```text
DISCORD_TOKEN nao configurado
```

entao revisar env var no painel.

Se aparecer:

```text
Timeout em client.login apos 120000ms
```

entao a nova hospedagem tambem nao esta completando conexao com Discord Gateway ou o token/invite precisa ser revisado.

### 5. Conferir no Discord

Depois de aparecer `Bot online como ...`:

- Verificar se o bot fica online no servidor.
- Testar `/ranking` ou `/perfil`.
- Testar um comando administrativo apenas se os cargos/permissoes ja estiverem prontos.

## Pontos de atencao

### Persistencia do SQLite

O bot usa:

```text
file:./prisma/darkbot.db
```

Se a Bot-Hosting.net reiniciar com disco persistente, os dados continuam.
Se o disco for efemero, os dados podem sumir ao redeploy/restart.

Se houver perda de dados, proximo passo tecnico:

- migrar SQLite para Postgres hospedado,
- ou confirmar persistencia de arquivo no painel da Bot-Hosting.net.

### Slash commands

O codigo atual registra comandos automaticamente apos o login:

```ts
client.commands = await deployCommandsAuto(token);
```

Isso usa:

- `CLIENT_ID`
- `GUILD_ID`

Se essas envs estiverem erradas, o login pode funcionar, mas o registro de comandos falhar.

### Token do Discord

Usar somente o token puro:

```text
abc.def.ghi
```

Nao usar:

```text
Bot abc.def.ghi
DISCORD_TOKEN=abc.def.ghi
"abc.def.ghi"
```

O codigo tenta limpar alguns desses formatos, mas o ideal e colar o valor puro.

## Decisao atual

Nao continuar tentando Render Web Service para este bot.

Continuar a partir de Bot-Hosting.net usando o guia em `BOT-HOSTING.md`.
