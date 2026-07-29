# Runbook do painel na Discloud Platinum

## Objetivo

Publicar bot, API e painel no mesmo processo Node.js, sem alterar os 11 payloads slash e sem criar uma segunda instancia do bot.

Estado verificado em 28 de julho de 2026:

- conta Discloud no plano Platinum;
- 2048 MB disponiveis;
- app atual `1785101572014` com 512 MB;
- app atual offline;
- subdominio `dta-admin` reservado e disponivel para o corte;
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

O subdominio `dta-admin` ja foi reservado. Confirme antes do deploy:

```powershell
discloud subdomain info --id dta-admin
```

URL esperada:

```text
https://dta-admin.discloud.app
```

Se `dta-admin` nao estiver disponivel, escolha outro nome e use o mesmo valor em todos os passos seguintes.

## 2. Configurar OAuth2 no Discord

No Discord Developer Portal, abra a mesma aplicacao do bot e acesse `OAuth2`.

Adicione exatamente:

```text
https://dta-admin.discloud.app/api/auth/callback
```

O painel solicita apenas os scopes `identify` e `guilds`. Nao adicione `bot`, `applications.commands` ou `guilds.join` ao login do painel.

Copie o client secret por um canal seguro diretamente para o `.env` local. Nao cole em issue, PR, chat, commit ou log.

## 3. Preparar os segredos

Gere chaves novas:

```powershell
node -e "const c=require('node:crypto'); console.log('PANEL_COOKIE_SECRET='+c.randomBytes(48).toString('base64url')); console.log('PANEL_ENCRYPTION_KEY='+c.randomBytes(32).toString('base64'))"
```

Atualize somente o `.env` ignorado pelo Git:

```env
ADMIN_PANEL_ENABLED=true
DISCORD_CLIENT_SECRET=<client-secret>
DISCORD_REDIRECT_URI=https://dta-admin.discloud.app/api/auth/callback
PANEL_COOKIE_SECRET=<segredo-gerado>
PANEL_ENCRYPTION_KEY=<chave-gerada>
PORT=8080
NODE_ENV=production
```

Mantenha sem alteracao os valores atuais de `DISCORD_TOKEN`, `CLIENT_ID`, `GUILD_ID` e `DATABASE_URL`.

## 4. Fazer backup

```powershell
discloud app backup 1785101572014 discloud\backups --save
Get-ChildItem discloud\backups -Recurse -File
git rev-parse HEAD
```

Confirme que o backup tem `prisma/prisma/darkbot.db`. A Discloud pode omitir o `.env` do arquivo baixado. Nesse caso, proteja uma copia local para o usuario atual do Windows com DPAPI:

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
ID=dta-admin
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

O `.discloudignore` do repositorio exclui `.env` e bancos. Nao o altere. O script de staging exige uma arvore Git limpa, executa o build local, copia os arquivos rastreados e acrescenta `build/`, `panel/dist/`, `.env` e SQLite sem imprimir segredos. A saida so pode ficar no diretorio temporario do sistema. O script bloqueia junctions e links simbolicos, valida `TYPE=site`, subdominio, RAM, callback, porta e segredos obrigatorios. Os artefatos compilados precisam estar no pacote porque `discloud app commit` atualiza os arquivos, mas pode preservar o `build/` anterior sem executar `BUILD`.

```powershell
$stage = Join-Path $env:TEMP "dta-admin-deploy-$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())"
npm run deploy:stage -- --output $stage
```

Inspecione o staging sem imprimir o conteudo do `.env`:

```powershell
Get-ChildItem $stage -Force | Select-Object Name,Length
Get-Item (Join-Path $stage '.env'),(Join-Path $stage 'prisma\prisma\darkbot.db') | Select-Object FullName,Length
```

Atualize o app existente por ID a partir do staging:

```powershell
Push-Location $stage
try {
  discloud app commit 1785101572014
} finally {
  Pop-Location
  npm run deploy:stage -- --cleanup $stage
}
```

O `finally` remove o `.env` e o banco temporarios mesmo quando o upload falha. A limpeza recusa diretorios sem o marcador privado criado pelo script.

Se a plataforma recusar a conversao de `bot` para `site`, nao apague o app atual. Pare o procedimento e use o fluxo de upload de site somente depois de confirmar que o backup pode ser restaurado no novo app.

## 8. Smoke test

```powershell
discloud app status 1785101572014
discloud app logs 1785101572014
Invoke-RestMethod https://dta-admin.discloud.app/health
```

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
discloud app ram 1785101572014 768
```

## 10. Rollback

Rollback imediato se o bot nao ficar online, o banco nao abrir, os comandos mudarem ou o painel expuser acesso indevido.

1. Pare o app defeituoso.
2. Extraia o backup em um diretorio temporario fora do repositorio.
3. Mova o `.discloudignore` extraido para fora do staging para nao filtrar `.env` e SQLite.
4. Confirme no staging `TYPE=bot`, `ID=1785101572014` e `ADMIN_PANEL_ENABLED=false`.
5. Faca o commit do staging completo.
6. Inicie o bot e confirme pools e os 11 comandos.

```powershell
discloud app stop 1785101572014
$restore = '<caminho-absoluto-do-backup-extraido>'
Add-Type -AssemblyName System.Security
$encryptedEnv = Resolve-Path 'discloud\backups\env-pre-panel.dpapi'
$protected = [IO.File]::ReadAllBytes($encryptedEnv)
$plain = [System.Security.Cryptography.ProtectedData]::Unprotect(
  $protected,
  $null,
  [System.Security.Cryptography.DataProtectionScope]::CurrentUser
)
[IO.File]::WriteAllBytes((Join-Path $restore '.env'), $plain)
$restoreIgnore = Join-Path $restore '.discloudignore'
if (Test-Path $restoreIgnore) {
  Move-Item -LiteralPath $restoreIgnore -Destination "$restore.discloudignore.reference"
}
Get-Item (Join-Path $restore '.env'),(Join-Path $restore 'prisma\prisma\darkbot.db') | Select-Object FullName,Length
Push-Location $restore
try {
  discloud app commit 1785101572014
} finally {
  Pop-Location
}
discloud app start 1785101572014
discloud app status 1785101572014
discloud app logs 1785101572014
```

Nao execute dois processos com o mesmo token durante o rollback. Nao rode `git add` dentro de staging ou backup.
