# Deploy na Bot-Hosting.net

Use este projeto como um bot Node.js persistente. Nao use configuracao de web service.

## Configuracao

- Runtime: Node.js
- Install command: `npm install`
- Start command: `npm start`
- Main file, se o painel pedir: `dist/index.js`

## Variaveis de ambiente

Configure no painel:

```env
DISCORD_TOKEN=token_puro_do_bot
CLIENT_ID=id_da_aplicacao
GUILD_ID=id_do_servidor
DATABASE_URL=file:./prisma/darkbot.db
```

`DATABASE_URL` e opcional no codigo: se ela nao existir, o bot usa `file:./prisma/darkbot.db`.

Nao configure `PORT` nem `ENABLE_HTTP_SERVER` nessa hospedagem. O servidor HTTP e opcional e so deve ser usado em plataformas que exigem porta aberta.

## O que deve aparecer nos logs

Ao iniciar corretamente:

```text
[Dark Bot] Iniciando...
[Dark Bot] Conectando ao Gateway do Discord... tentativa 1
[Dark Bot] Bot online como ...
```

Se aparecer timeout no `client.login`, o problema esta na conectividade da hospedagem com o Gateway do Discord ou no token usado.
