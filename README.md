# Dark Bot

Bot competitivo da Dark Trials Arena para administrar confrontos 5v5 de Dead by Daylight. O mesmo processo Node.js executa o bot, a API privada e o painel administrativo.

O painel complementa os comandos slash existentes. Ele nao registra, remove nem altera o payload desses comandos.

## Estado atual

- 11 comandos slash protegidos por teste de contrato.
- Operacao multi-servidor com dados isolados por `guildId`.
- Confrontos iniciados no canal onde o comando foi usado ou em um canal de texto existente selecionado no painel.
- Nenhuma criacao automatica de canal de texto ou voz.
- Mapas presetados por set; pick/ban apenas de killers.
- Sorteio de quem inicia e alternancia entre os sets.
- Painel React responsivo com atualizacao em tempo real por SSE.
- Login Discord OAuth2 e autorizacao por servidor.
- Auditoria das acoes administrativas feitas no painel.

## Acesso administrativo

Uma conta entra no painel apenas quando todas as condicoes abaixo sao verdadeiras:

1. O bot esta conectado ao servidor.
2. A conta Discord autenticada pertence ao servidor.
3. A conta e dona do servidor, possui `Manage Guild` ou possui um cargo administrativo configurado no bot.

A API repete essa validacao em cada leitura, escrita e conexao SSE. Ocultar um botao no frontend nao concede nem substitui permissao.

## Comandos slash

| Comando | Uso |
| --- | --- |
| `/configurar-bot` | Configura os cargos com acesso administrativo. |
| `/criar-confronto` | Cria o confronto no canal de texto atual. |
| `/encerrar` | Encerra um confronto. |
| `/gerenciar-cargo` | Renomeia, remove e gerencia membros dos cargos de time. |
| `/gerenciar-pool` | Cria, lista, edita, ativa e remove pools. |
| `/listar-confrontos` | Lista confrontos ativos. |
| `/perfil` | Mostra as estatisticas do jogador. |
| `/ranking` | Mostra o ranking dos times. |
| `/relatorios` | Mostra resumo, confrontos e pools. |
| `/resultado` | Registra o vencedor. |
| `/setup-cargo` | Cria um cargo de time. |

O painel pode ativar ou desativar cada comando por servidor. O estado padrao continua ativo. Essa configuracao nao altera nome, descricao, opcoes, permissao padrao nem registro no Discord.

## Fluxo do confronto

1. A staff seleciona uma pool e dois cargos de time.
2. O bot cria o registro do confronto no canal existente.
3. Um sorteio define qual time inicia o primeiro set de killer.
4. Os times executam o pick/ban de killers.
5. O bot apresenta o killer escolhido e o mapa presetado daquele set.
6. O time inicial alterna nos sets seguintes.
7. A staff registra o resultado e encerra o confronto.

Nao existe tempo limite automatico para a etapa de pick/ban. A staff pode encerrar manualmente um confronto travado.

## Painel administrativo

O painel tem as seguintes areas:

- Visao geral: estado do bot, confrontos ativos, pools e atividade recente.
- Confrontos: criacao em canal existente, resultado e encerramento.
- Pools: criacao, mapas, killers, ativacao e exclusao.
- Times: criacao e edicao de cargos, membros e cores.
- Comandos: ativacao por servidor dos 11 comandos existentes.
- Ranking: classificacao calculada a partir dos resultados.
- Auditoria: autor, acao, entidade e horario.

Comandos customizados executaveis foram deixados fora desta versao. Criar novos slash commands mudaria o contrato atual, e comandos de texto exigiriam intent adicional. O modelo de dados reserva essa evolucao, mas nenhuma entrada enviada pelo painel executa JavaScript.

## Arquitetura

```text
Discord Gateway
      |
      v
Discord.js client ---- shared services ---- Prisma/SQLite
      |                       ^
      v                       |
Fastify API <---- SSE ---- React panel
      |
Discord OAuth2 + encrypted server-side sessions
```

Responsabilidades principais:

- `src/commands`: adaptadores dos comandos slash.
- `src/services`: regras compartilhadas pelo Discord e pelo painel.
- `src/systems`: fluxo de veto por set.
- `src/web`: OAuth2, sessao, autorizacao, API, SSE e runtime Discord.
- `panel`: aplicacao React e testes Playwright.
- `prisma`: schema e migracoes.
- `scripts`: migracao e inicializacao usadas na hospedagem.

## Requisitos

- Node.js 22 ou superior.
- Aplicacao Discord com bot configurado.
- SQLite local ou volume persistente na hospedagem.
- Discloud Platinum para publicar o painel.

## Instalacao local

```powershell
npm install
Copy-Item .env.example .env
npm run db:deploy
npm run build
npm start
```

Para executar somente o bot, mantenha:

```env
ADMIN_PANEL_ENABLED=false
```

Para executar o painel local em `http://127.0.0.1:8080`, cadastre esse callback no Discord Developer Portal e configure:

```env
ADMIN_PANEL_ENABLED=true
DISCORD_REDIRECT_URI=http://127.0.0.1:8080/api/auth/callback
PORT=8080
NODE_ENV=development
```

Os valores abaixo sao secretos e devem existir apenas no `.env` local ou no ambiente da hospedagem:

- `DISCORD_TOKEN`
- `DISCORD_CLIENT_SECRET`
- `PANEL_COOKIE_SECRET`
- `PANEL_ENCRYPTION_KEY`

Gere as chaves do painel com Node.js:

```powershell
node -e "const c=require('node:crypto'); console.log('PANEL_COOKIE_SECRET='+c.randomBytes(48).toString('base64url')); console.log('PANEL_ENCRYPTION_KEY='+c.randomBytes(32).toString('base64'))"
```

Nao publique a saida desse comando e nao a adicione ao Git.

## Variaveis de ambiente

| Variavel | Obrigatoria | Descricao |
| --- | --- | --- |
| `DISCORD_TOKEN` | Sim | Token do bot. |
| `CLIENT_ID` | Sim | ID da aplicacao Discord. |
| `GUILD_ID` | Atual | Servidor principal usado pelo fluxo de sincronizacao existente. |
| `DATABASE_URL` | Sim | URL Prisma, normalmente `file:./prisma/darkbot.db`. |
| `ADMIN_PANEL_ENABLED` | Nao | Ativa o painel somente quando for `true`. |
| `DISCORD_CLIENT_SECRET` | Painel | Client secret OAuth2. |
| `DISCORD_REDIRECT_URI` | Painel | Callback exato cadastrado no Discord. |
| `PANEL_COOKIE_SECRET` | Painel | Segredo aleatorio com ao menos 32 caracteres. |
| `PANEL_ENCRYPTION_KEY` | Painel | Exatamente 32 bytes em Base64. |
| `PORT` | Hospedagem | Porta HTTP; na Discloud deve ser `8080`. |
| `NODE_ENV` | Nao | Use `production` no deploy publico. |

As variaveis existentes do bot nao precisam ser alteradas para desenvolver ou testar o painel desativado.

## Scripts

| Comando | Resultado |
| --- | --- |
| `npm run dev` | Migra e executa o bot em watch mode. |
| `npm run build` | Gera Prisma, compila o painel e o TypeScript. |
| `npm run build:ts` | Compila somente o backend. |
| `npm run panel:dev` | Executa o frontend Vite. |
| `npm run panel:test:e2e` | Executa os testes Playwright. |
| `npm test` | Executa testes unitarios, integracao e contratos. |
| `npm run db:deploy` | Aplica migracoes pendentes. |
| `npm run deploy` | Registra comandos slash; nao use em uma atualizacao comum. |

## Testes e qualidade

Antes de uma PR ou deploy:

```powershell
npm run build
npm test
npm run panel:test:e2e
npm audit --omit=dev
```

O teste `src/tests/commands-contract.test.ts` deve continuar aprovando os 11 payloads. Qualquer mudanca nesse contrato exige uma decisao separada.

## Deploy na Discloud Platinum

Bot com interface web e classificado pela Discloud como site. O corte de producao requer:

- `TYPE=site`.
- um `ID` igual ao subdominio reservado, sem `.discloud.app`.
- `PORT=8080`.
- bind em `0.0.0.0`, ja implementado.
- callback `https://<subdominio>.discloud.app/api/auth/callback` no Discord.

O procedimento completo, validacao e rollback estao em [docs/operations/admin-panel-platinum-runbook.md](docs/operations/admin-panel-platinum-runbook.md).

## Seguranca

- OAuth2 usa Authorization Code, `state` assinado e scopes `identify guilds`.
- Tokens OAuth ficam criptografados no banco com AES-256-GCM.
- Sessao usa cookie assinado, `HttpOnly`, `SameSite` e `Secure` em producao.
- Escritas exigem CSRF de dupla submissao e validacao Zod estrita.
- Rate limit global e limite menor nas acoes administrativas.
- Logs removem cookies, cabecalho Authorization e `Set-Cookie`.
- Erros inesperados retornam mensagem generica ao navegador.

O modelo de ameacas e os controles estao em [docs/security/admin-panel-threat-model.md](docs/security/admin-panel-threat-model.md).

## Documentacao

- [Plano de implementacao](docs/architecture/admin-panel-implementation.md)
- [Runbook Platinum](docs/operations/admin-panel-platinum-runbook.md)
- [Modelo de ameacas](docs/security/admin-panel-threat-model.md)
- [Produto](PRODUCT.md)
- [Design](DESIGN.md)

## Licenca

MIT. Consulte [LICENSE](LICENSE).
