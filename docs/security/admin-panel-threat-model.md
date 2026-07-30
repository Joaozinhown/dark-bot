# Modelo de ameacas do painel administrativo

## Escopo

Este documento cobre navegador, API Fastify, OAuth2 Discord, sessoes, banco SQLite, Discord Gateway/REST e deploy na Discloud. O painel administra servidores reais, portanto toda entrada externa e tratada como nao confiavel.

## Ativos protegidos

- Token do bot e client secret OAuth2.
- Access e refresh tokens das contas Discord.
- Segredos de cookie e criptografia.
- Sessoes administrativas.
- Configuracao, pools, cargos, confrontos e resultados por servidor.
- Historico de auditoria.
- Integridade dos 11 comandos slash existentes.

## Fronteiras de confianca

1. Navegador para API: cookies, CSRF, corpo, parametros e EventSource.
2. API para Discord OAuth2: codigo, access token, refresh token e guilds.
3. API para bot Discord: cargos, membros, canais e mensagens.
4. Aplicacao para SQLite: sessoes, configuracoes e operacao do torneio.
5. Pipeline local para Discloud: pacote, `.env`, banco e configuracao.

## Autenticacao e sessao

Controles implementados:

- Authorization Code OAuth2.
- `state` aleatorio, assinado, comparado em tempo constante e valido por 10 minutos.
- Scopes limitados a `identify` e `guilds`.
- Access e refresh tokens criptografados com AES-256-GCM.
- Token de sessao opaco; somente hash persistido.
- Cookie de sessao assinado, `HttpOnly`, `SameSite=Lax` e `Secure` em HTTPS.
- Cookie CSRF separado, `SameSite=Strict`, comparado com cabecalho e hash de sessao.
- Expiracao em sete dias, touch controlado e revogacao no logout.
- Refresh OAuth serializado por sessao para evitar corrida de rotacao.
- Contas sem nenhum servidor autorizado sao recusadas antes de persistir tokens.
- Registros expirados ou revogados sao removidos antes de criar uma nova sessao.

Risco residual: roubo do arquivo SQLite junto com `PANEL_ENCRYPTION_KEY` permite descriptografar tokens OAuth. O banco e a chave devem ficar em backups e locais separados.

## Autorizacao por servidor

Cada requisicao cruza:

- guilds retornadas pelo token OAuth atual;
- guilds onde o bot esta conectado;
- propriedade do servidor, permissao `Manage Guild` ou cargo administrativo persistido.

O `guildId` da URL nunca e aceito sozinho. Leituras, mutacoes e SSE repetem a verificacao. A conexao SSE revalida sessao e acesso a cada 60 segundos. Logout fecha os streams da sessao imediatamente; alteracoes de cargos administrativos fecham os streams do servidor para forcar nova autorizacao.

Risco residual: mudancas de cargo podem levar ate 60 segundos para encerrar uma conexao SSE ja aberta. Mutacoes novas sao bloqueadas na proxima requisicao.

## Entrada e execucao

Controles implementados:

- Zod com uniao discriminada para todas as acoes administrativas.
- IDs Discord validados como snowflakes.
- nomes, cores, formatos e motivos limitados.
- comandos aceitos somente quando pertencem ao allowlist carregado pelo bot.
- nenhuma avaliacao de JavaScript, shell, HTML ou template executavel.
- Prisma usa consultas parametrizadas.
- frontend React nao usa `dangerouslySetInnerHTML`.

Comandos customizados executaveis nao fazem parte desta versao. O modelo `CustomCommand` e apenas uma reserva de schema.

## CSRF, abuso e automacao

- Escritas e logout exigem CSRF de dupla submissao.
- Limite global de 120 requisicoes por minuto e 30 acoes por minuto por IP.
- Login limitado a 10 tentativas por minuto.
- SSE limitado a 3 streams por sessao/servidor e 100 no processo.
- A API rejeita corpos fora do schema.
- Operacoes destrutivas exigem confirmacao no frontend.

Risco residual: rate limit por IP pode agrupar varios operadores atras do mesmo NAT. Ajuste apenas com medicao de producao.

## Browser e transporte

- HTTPS obrigatorio fora de loopback.
- Helmet define CSP restrita a mesma origem.
- Imagens externas limitadas ao CDN do Discord.
- Scripts, estilos e conexoes limitados a mesma origem.
- HTML sem cache; assets versionados com cache imutavel.
- rotas SPA nao interceptam `/api/*`.

Risco residual: o subdominio da Discloud e parte da fronteira de transporte. Alteracao de DNS ou conta Discloud exige rotacao de todos os segredos.

## Logs e erros

- Fastify remove `Authorization`, `Cookie` e `Set-Cookie` dos logs.
- Erros inesperados retornam somente `INTERNAL_ERROR` e mensagem generica.
- Erros de dominio usam codigos controlados.
- Auditoria registra servidor, ator, acao, entidade e detalhes validados.

Risco residual: detalhes de auditoria podem conter nomes e IDs operacionais. A tela e a API de auditoria seguem a mesma autorizacao por servidor.

## Disponibilidade e consistencia

- Bot continua iniciando se o painel falhar.
- `/health` informa se o Discord client esta pronto.
- SSE tem heartbeat e limpeza ao fechar.
- migracoes substituem sincronizacao destrutiva do schema.
- presets sao idempotentes.

Riscos residuais:

- SQLite exige instancia unica e volume persistente.
- Uma falha Discord depois de persistir um confronto pode exigir encerramento manual antes de repetir.
- Uma falha ao gravar auditoria depois de uma mutacao Discord pode retornar erro apesar da mutacao ja ter ocorrido.
- Contagem de membros por cargo usa o cache permitido pelos intents atuais e pode ser parcial.

Esses riscos nao justificam alterar intents, comandos ou arquitetura no corte atual. Devem ser observados nos logs e tratados em uma fase posterior com idempotencia por operacao e fila transacional.

## Segredos e deploy

- `.env`, bancos e backups sao ignorados pelo Git.
- nenhum segredo entra no bundle Vite.
- chaves devem ser geradas localmente e copiadas direto para a hospedagem.
- o pacote de deploy deve ser inspecionado antes do upload.
- backup e rollback sao obrigatorios antes de mudar `TYPE=bot` para `TYPE=site`.
- somente uma instancia pode usar o token e o SQLite.

## Testes de seguranca obrigatorios

- callback OAuth com `state` incorreto;
- sessao ausente, expirada e revogada;
- CSRF ausente e incorreto;
- acesso horizontal a outro servidor;
- comando fora do allowlist;
- corpo de acao invalido;
- refresh OAuth concorrente;
- erro interno sanitizado;
- 404 de API fora do fallback SPA;
- build sem modulos de comando obsoletos;
- limite e liberacao idempotente de conexoes SSE;
- isolamento de eventos SSE por servidor;
- `npm audit --omit=dev` sem vulnerabilidade conhecida.

## Criterio de liberacao

Bloquear o deploy quando houver:

- achado CRITICAL ou HIGH aberto;
- segredo em arquivo versionado, log ou bundle;
- falha de isolamento entre servidores;
- mudanca no contrato slash sem aprovacao separada;
- build, migracao, teste ou auditoria de dependencia com falha.
