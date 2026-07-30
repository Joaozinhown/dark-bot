# Runbook do painel na Discloud Diamond

## Objetivo

Publicar bot, API e painel no mesmo processo Node.js, sem alterar os 11 payloads slash e sem executar uma segunda instancia concorrente do bot.

Estado verificado em 29 de julho de 2026:

- conta Discloud no plano Diamond;
- 4096 MB totais e 1024 MB alocados;
- site atual `dta-admin` online com 512 MB e `AUTORESTART=true`;
- app anterior `1785101572014` offline, mantido somente para rollback imediato;
- subdominio `dta-admin` associado ao site atual;
- subdominio `admin-dta-bot` reservado para o novo site;
- bot e painel executados pelo mesmo processo no site `dta-admin`;
- Discloud CLI `2.11.1` instalada.

## Condicoes para o corte

- Branch de producao com build e testes verdes.
- Backup baixado do app atual.
- Subdominio reservado na Discloud.
- Callback HTTPS cadastrado no Discord Developer Portal.
- `DISCORD_CLIENT_SECRET` obtido pelo proprietario da aplicacao.
- Chaves novas de cookie e criptografia geradas localmente.
- Somente uma instancia usando `DISCORD_TOKEN` e o arquivo SQLite.

## 1. Confirmar o subdominio

O nome deve ter ate 20 caracteres e aceitar apenas letras, numeros e hifen.

O destino aprovado e `admin-dta-bot`. Confirme a reserva antes do corte:

```powershell
discloud subdomain info --id admin-dta-bot
```

URL esperada:

```text
https://admin-dta-bot.discloud.app
```

O site atual permanece em `dta-admin` ate o corte. Nao execute os dois sites ao mesmo tempo porque ambos usam o mesmo token Discord e banco SQLite.

## 2. Configurar OAuth2 no Discord

No Discord Developer Portal, abra a mesma aplicacao do bot e acesse `OAuth2`.

Adicione exatamente:

```text
https://admin-dta-bot.discloud.app/api/auth/callback
```

O painel solicita apenas os scopes `identify` e `guilds`. Nao adicione `bot`, `applications.commands` ou `guilds.join` ao login do painel.

Copie o client secret por um canal seguro diretamente para o `.env` local. Nao cole em issue, PR, chat, commit ou log.

## 3. Preparar os segredos

Gere `PANEL_COOKIE_SECRET` com 48 bytes aleatorios e `PANEL_ENCRYPTION_KEY` com 32 bytes aleatorios em Base64 canonico usando um gerenciador de segredos. Grave os valores diretamente no `.env`; nao os imprima em terminal, log ou historico de comandos.

Atualize somente o `.env` ignorado pelo Git:

```env
ADMIN_PANEL_ENABLED=true
DISCORD_CLIENT_SECRET=<client-secret>
DISCORD_REDIRECT_URI=https://admin-dta-bot.discloud.app/api/auth/callback
PANEL_COOKIE_SECRET=<segredo-gerado>
PANEL_ENCRYPTION_KEY=<chave-gerada>
PORT=8080
NODE_ENV=production
```

Mantenha sem alteracao os valores atuais de `DISCORD_TOKEN`, `CLIENT_ID`, `GUILD_ID` e `DATABASE_URL`.

## 4. Fazer backup

```powershell
$preflightBackup = "discloud\backups\preflight-admin-dta-bot-$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())"
New-Item -ItemType Directory -Path $preflightBackup | Out-Null
discloud app backup dta-admin $preflightBackup --save
if ($LASTEXITCODE -ne 0) { throw 'Falha ao baixar backup de dta-admin.' }
Get-ChildItem $preflightBackup -Recurse -File
git rev-parse HEAD
```

Esse backup preliminar valida o mecanismo de restauracao. A secao 7 baixa outro backup depois de parar `dta-admin`; somente esse banco congelado entra no staging. A Discloud pode omitir o `.env` do arquivo baixado. Nesse caso, proteja uma copia local para o usuario atual do Windows com DPAPI:

```powershell
Add-Type -AssemblyName System.Security
$source = (Resolve-Path '.env').Path
$target = Join-Path (Resolve-Path 'discloud\backups').Path 'env-pre-panel.dpapi'
$bytes = [IO.File]::ReadAllBytes($source)
$protected = [System.Security.Cryptography.ProtectedData]::Protect(
  $bytes,
  $null,
  [System.Security.Cryptography.DataProtectionScope]::CurrentUser
)
[IO.File]::WriteAllBytes($target, $protected)
```

Guarde o hash Git e o nome do arquivo de backup no registro do deploy. Mantenha os backups com acesso restrito e apague quando o periodo de retencao terminar. O arquivo DPAPI so pode ser aberto pela mesma conta do Windows na mesma instalacao.

`discloud/backups/` deve permanecer ignorado por Git e pelo pacote Discloud. Verifique antes de continuar:

```powershell
git check-ignore -v --no-index discloud/backups/backup.zip
```

## 5. Configuracao de hospedagem no corte

A Discloud exige `TYPE=site`, porta `8080`, bind em `0.0.0.0` e um subdominio para bots com painel web.

Configuracao de producao:

```ini
NAME=Dark Bot
TYPE=site
MAIN=build/index.js
RAM=512
VERSION=latest
BUILD=npm run build
START=npm run start
AUTORESTART=true
AVATAR=https://pxdrop.online/raw/d9fv0fmhv1ts73baugmg?file
ID=admin-dta-bot
```

O codigo ja usa `0.0.0.0` e a variavel `PORT`. Nao altere nomes, descricoes ou opcoes em `src/commands` durante este corte.

## 6. Validacao local

```powershell
npm ci
npm run build
npm test
npm run panel:test:e2e
npm audit --omit=dev
git diff -- src\commands
```

O teste de contrato deve listar os 11 comandos aprovados. O diff de `src/commands` deve estar vazio em relacao ao commit anterior ao painel.

## 7. Deploy

O `.discloudignore` do repositorio exclui `.env` e bancos. Nao o altere. O cutover exige arvore Git limpa e usa o banco SQLite baixado do app `dta-admin`, nunca uma copia local antiga.

Execute primeiro o preflight sem alterar o estado dos apps:

```powershell
npm run deploy:cutover -- --preflight
```

O preflight bloqueia o corte se o callback OAuth nao estiver cadastrado, se `discloud.config` ou `.env` apontarem para outro host, se `dta-admin` nao estiver online, se `admin-dta-bot` ja existir ou se o app legado `1785101572014` nao estiver offline.

Depois do preflight aprovado, execute o corte:

```powershell
npm run deploy:cutover -- --execute
```

O comando para `dta-admin`, confirma o estado offline, baixa um backup congelado da Discloud, valida o SQLite com `PRAGMA integrity_check`, prepara o pacote temporario, compara o SHA-256 dos bancos, envia `admin-dta-bot` e aguarda `/health` com `botReady: true` e `commandCount: 11`. Todos os processos da CLI e requisicoes HTTP possuem timeout. Se uma etapa falhar antes do upload, ele confirma que o alvo esta ausente e reativa `dta-admin`. Depois de um upload iniciado, o alvo existente recebe uma parada manual e um backup de recuperacao antes do rollback. Se a criacao ainda aparecer como `missing`, a origem permanece offline para inspecao, evitando duas instancias com o mesmo token. O staging com `.env` e banco e apagado no final; os backups permanecem em `discloud/backups/`, ignorados pelo Git.

Atualizacoes posteriores usam `discloud app commit admin-dta-bot` em vez de `app upload`.

## 8. Smoke test

```powershell
discloud app status admin-dta-bot
discloud app logs admin-dta-bot
discloud app status dta-admin
discloud app status 1785101572014
$health = Invoke-RestMethod https://admin-dta-bot.discloud.app/health
if (-not $health.data.botReady) { throw 'Site respondeu, mas o bot nao esta pronto.' }
if ($health.data.commandCount -ne 11) { throw 'Os 11 comandos ainda nao foram sincronizados.' }
```

O site `admin-dta-bot` deve ficar online; `dta-admin` e `1785101572014` devem permanecer offline.

Validar nos logs:

- migracoes concluidas;
- painel na porta `8080`;
- bot online;
- pools presetadas sincronizadas;
- 11 comandos sincronizados em cada servidor conectado;
- nenhum `UnhandledPromiseRejection`, `504`, erro OAuth ou loop de restart.

Validar no navegador:

1. Abrir a URL publica.
2. Entrar com Discord.
3. Ver somente servidores autorizados.
4. Abrir confrontos, pools, times, comandos, ranking e auditoria.
5. Confirmar SSE atualizando uma tela apos uma acao em servidor de teste.
6. Sair e confirmar que a sessao foi revogada.

Validar no Discord:

1. Os 11 slash commands aparecem uma unica vez.
2. Um comando desativado responde com o bloqueio esperado.
3. Um comando ativo continua com o comportamento anterior.
4. Criar confronto usa o canal existente e nao cria texto ou voz.

## 9. Monitoramento inicial

Observe por pelo menos 15 minutos:

- memoria abaixo do limite de 512 MB;
- ausencia de restarts;
- `/health` com `botReady: true`;
- login e refresh OAuth funcionando;
- conexoes SSE encerradas ao fazer logout ou perder acesso.

Se a memoria ficar proxima do limite, aumente a RAM pelo painel ou CLI sem alterar codigo:

```powershell
discloud app ram admin-dta-bot 768
```

## 10. Rollback

Rollback imediato se o bot nao ficar online, o banco nao abrir, os comandos mudarem ou o painel expuser acesso indevido.

O comando de cutover executa rollback automatico durante uma falha. Para uma emergencia posterior:

1. Pare o site `admin-dta-bot`.
2. Confirme que ele ficou offline.
3. Confirme que `1785101572014` continua offline.
4. Inicie o site anterior `dta-admin`.
5. Confirme bot, pools e os 11 comandos antes de liberar uso.

```powershell
discloud app stop admin-dta-bot
if ($LASTEXITCODE -ne 0) { throw 'Falha ao parar admin-dta-bot.' }
discloud app status admin-dta-bot
discloud app status 1785101572014
```

Prossiga somente se a saida mostrar os dois apps offline.

```powershell
discloud app start dta-admin
if ($LASTEXITCODE -ne 0) { throw 'Falha ao iniciar dta-admin.' }
discloud app status dta-admin
discloud app logs dta-admin
```

Esse rollback imediato retorna ao banco congelado no momento do corte. Se o novo site ja recebeu confrontos ou configuracoes, baixe primeiro um backup de `admin-dta-bot` e planeje a reconciliacao do SQLite antes de iniciar o site antigo. Nao execute dois processos com o mesmo token e nao rode `git add` dentro de staging ou backup.
