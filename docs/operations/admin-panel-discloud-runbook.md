# Runbook do painel na Discloud Diamond

## Objetivo

Publicar bot, API e painel no mesmo processo Node.js, sem alterar os 11 payloads slash e sem executar uma segunda instancia concorrente do bot.

Estado verificado em 29 de julho de 2026:

- conta Discloud no plano Diamond;
- 4096 MB totais e 1024 MB alocados;
- site `dta-admin` online com 512 MB e `AUTORESTART=true`;
- app anterior `1785101572014` offline, mantido somente para rollback imediato;
- subdominio `dta-admin` associado ao site;
- subdominio `admin-dta-bot` reservado e disponivel, sem alterar a producao;
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

## 1. Confirmar os subdominios

O nome deve ter ate 20 caracteres e aceitar apenas letras, numeros e hifen.

O site continua em `dta-admin`. `admin-dta-bot` fica reservado para uma migracao posterior, depois que o callback OAuth correspondente estiver cadastrado. Confirme ambos:

```powershell
discloud subdomain info --id dta-admin
discloud subdomain info --id admin-dta-bot
```

URL esperada:

```text
https://dta-admin.discloud.app
```

Nao altere `ID=dta-admin` enquanto a producao estiver ativa nesse endereco. Trocar o ID exige um corte controlado e cadastro previo do novo callback no Discord.

### Dominio personalizado

O dominio desejado e `admin-dta-bot.com`. Ele precisa estar registrado em um provedor externo e sob controle do proprietario antes de ser vinculado. Depois da compra:

1. Cadastre `https://admin-dta-bot.com/api/auth/callback` no Discord Developer Portal.
2. Registre o dominio personalizado na Discloud e vincule-o ao app `dta-admin`:

   ```powershell
   discloud domain create --id admin-dta-bot.com --app dta-admin
   discloud domain info --id admin-dta-bot.com
   ```

3. Configure os registros A e TXT exibidos pela Discloud no provedor DNS.
4. Mantenha o proxy Cloudflare desativado, caso use Cloudflare.
5. Verifique o dominio:

   ```powershell
   discloud domain verify --id admin-dta-bot.com
   discloud domain info --id admin-dta-bot.com
   ```

6. Atualize `DISCORD_REDIRECT_URI` e faca novo deploy. O `app commit` executado na secao 7 faz a reconstrucao da aplicacao e ativa o vinculo.
7. Execute o smoke test completo antes de retirar o callback anterior.

Nao altere a URL OAuth antes da verificacao DNS e do cadastro do callback. A reserva do subdominio Discloud nao registra nem compra o dominio `.com`.

## 2. Configurar OAuth2 no Discord

No Discord Developer Portal, abra a mesma aplicacao do bot e acesse `OAuth2`.

Adicione exatamente:

```text
https://dta-admin.discloud.app/api/auth/callback
```

O painel solicita apenas os scopes `identify` e `guilds`. Nao adicione `bot`, `applications.commands` ou `guilds.join` ao login do painel.

Copie o client secret por um canal seguro diretamente para o `.env` local. Nao cole em issue, PR, chat, commit ou log.

## 3. Preparar os segredos

Gere `PANEL_COOKIE_SECRET` com 48 bytes aleatorios e `PANEL_ENCRYPTION_KEY` com 32 bytes aleatorios em Base64 canonico usando um gerenciador de segredos. Grave os valores diretamente no `.env`; nao os imprima em terminal, log ou historico de comandos.

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
discloud app backup dta-admin discloud\backups --save
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

Mantenha o app antigo offline e envie o staging somente ao site existente:

```powershell
Push-Location $stage
try {
  discloud app commit dta-admin
  if ($LASTEXITCODE -ne 0) { throw 'Falha no commit do site dta-admin.' }
} finally {
  Pop-Location
  npm run deploy:stage -- --cleanup $stage
}

$health = Invoke-RestMethod https://dta-admin.discloud.app/health
if (-not $health.data.botReady) { throw 'Site respondeu, mas o bot nao esta pronto.' }
```

O `finally` remove o `.env` e o banco temporarios mesmo quando o commit falha. A limpeza recusa diretorios sem o marcador privado criado pelo script. Nao inicie o app antigo como resposta automatica a uma falha de deploy.

## 8. Smoke test

```powershell
discloud app status dta-admin
discloud app logs dta-admin
discloud app status 1785101572014
Invoke-RestMethod https://dta-admin.discloud.app/health
```

O site deve ficar online e o app `1785101572014` deve permanecer offline.

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
discloud app ram dta-admin 768
```

## 10. Rollback

Rollback imediato se o bot nao ficar online, o banco nao abrir, os comandos mudarem ou o painel expuser acesso indevido.

1. Pare o site `dta-admin`.
2. Confirme que ele ficou offline.
3. Inicie o app anterior `1785101572014`.
4. Confirme bot, pools e os 11 comandos antes de liberar uso.

```powershell
discloud app stop dta-admin
discloud app status dta-admin
```

Prossiga somente quando a tabela mostrar `Offline`. Se a parada falhar ou continuar pendente, nao inicie o app antigo.

```powershell
discloud app start 1785101572014
discloud app status 1785101572014
discloud app logs 1785101572014
```

Esse rollback imediato retorna ao banco congelado no momento do corte. Se o site ja recebeu novos confrontos ou configuracoes, baixe primeiro um backup de `dta-admin` e planeje a reconciliacao do SQLite antes de iniciar o app antigo. Nao execute dois processos com o mesmo token e nao rode `git add` dentro de staging ou backup.
