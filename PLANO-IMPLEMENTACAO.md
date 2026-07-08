# Dark Bot — Plano de Implementação

## Visão Geral

Bot Discord para partidas competitivas 5v5 de Dead by Daylight, hospedado na Discloud.  
Evento inaugural: **Queens Trials — Edição All Win** (todas as perks e itens liberados).

---

## 1. Stack Tecnológica

| Camada | Tecnologia | Justificativa |
|--------|------------|---------------|
| Runtime | Node.js 22 LTS | Requerido pelo discord.js v14+ |
| Bot Framework | discord.js v14 | Mais usado e documentado do ecossistema |
| Linguagem | TypeScript 5.x | Tipagem forte, IDE support, menos bugs em runtime |
| Banco de Dados | SQLite (via Prisma) | Leve, sem servidor externo, suficiente para eventos |
| ORM/Query | Prisma (adapter SQLite) | Type-safe, migrations automáticas, DX excelente |
| Deploy | Discloud CLI | Hospedagem gratuita para bots Discord |
| Controle de Versão | Git | Histórico e rollback |
| Build | tsx | Execução direta de TS em produção, sem step de compilação separado |

### Pacotes Principais

```
discord.js          ^14.16
@discordjs/voice    ^0.17
@discordjs/opus     ^0.9
libsodium-wrappers  ^0.7
prisma              ^6.10
@prisma/client      ^6.10
dotenv              ^16.4
tsx                 ^4.19
typescript          ^5.7
@types/node         ^22.10
```

### Configuração TypeScript

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

---

## 2. Arquitetura do Projeto

```
dark-bot/
├── src/
│   ├── index.ts              # Entry point, client setup
│   ├── config.ts             # Cores, funções auxiliares
│   ├── deploy-commands.ts    # Registro de slash commands
│   ├── types/
│   │   └── index.ts          # Interfaces e tipos compartilhados
│   ├── database/
│   │   ├── schema.prisma     # Modelo de dados (pools editáveis)
│   │   └── client.ts         # Conexão Prisma
│   ├── commands/
│   │   ├── criar-confronto.ts
│   │   ├── resultado.ts
│   │   ├── encerrar.ts
│   │   ├── listar-confrontos.ts
│   │   ├── ranking.ts
│   │   ├── perfil.ts
│   │   ├── setup-cargo.ts
│   │   ├── gerenciar-cargo.ts
│   │   └── gerenciar-pool.ts  # CRUD de pools editáveis
│   ├── systems/
│   │   └── veto.ts           # Lógica de veto de mapas e killers
│   ├── events/
│   │   ├── ready.ts
│   │   ├── interactionCreate.ts
│   │   └── voiceStateUpdate.ts
│   └── utils/
│       ├── permissions.ts
│       ├── channels.ts
│       └── embeds.ts
├── prisma/
│   └── schema.prisma         # Schema Prisma
├── dist/                     # Output compilado
├── discloud.config
├── package.json
├── tsconfig.json
├── .env
├── .gitignore
└── .discloudignore
```

---

## 3. Sistema de Permissões

### Hierarquia de Cargos

| Cargo | Permissões |
|-------|------------|
| **Owner** | Dono do servidor. Acesso total. Pode tudo. |
| **@Organization** | Staff do evento. Gerencia confrontos, cargos, canais. Vê TODOS os slash commands. |
| **Capitão** | Líder de time. Pode registrar resultado do confronto do seu time. |
| **Jogador** | Membro de time. Vê comandos básicos (perfil, ranking, listar confrontos). |
| **@everyone** | Sem permissões de bot. |

### Controle de Visibilidade dos Commands

Slash commands usam `defaultMemberPermissions` e `contexts` para controlar visibilidade:

```typescript
import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';

// Comando somente @Organization
new SlashCommandBuilder()
  .setName('criar-confronto')
  .setDescription('Cria um confronto entre dois times')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .setDMPermission(false);

// Comando público (jogadores)
new SlashCommandBuilder()
  .setName('perfil')
  .setDescription('Mostra seu perfil e estatísticas')
  .setDMPermission(false);
```

---

## 4. Pools e Mapas — Queens Trials All Win

### Pool 1 — Melhor de 3 (MD3)

| Set | Mapa |
|-----|------|
| 1 | Azarov's Resting Place |
| 2 | Shelter Woods |
| 3 | Ormond Lake Mine |

**Killers Permitidos:**
Oni, Nurse, Spirit, Krasue, Artist, Ghoul, Lich, Plague, Singularity

### Pool 2 — Melhor de 3 (MD3)

| Set | Mapa |
|-----|------|
| 1 | Groaning Storehouse |
| 2 | Wrecker's Yard |
| 3 | Residência da Família (Yamaoka) |

**Killers Permitidos:**
The Slasher, Animatronic, Mastermind, Deathslinger, Nightmare, The Executioner, Unknown, Nemesis, Houndmaster

### Pool 3 — Melhor de 5 (MD5)

| Set | Mapa |
|-----|------|
| 1 | Wretched Shop |
| 2 | Midwich Elementary School |
| 3 | Suffocation Pit |
| 4 | Ironworks of Misery |
| 5 | Thompson's House |

**Killers Permitidos:**
Demogorgon, Dredge, Onryo, The First, Wraith, Hillbilly, Blight, Spirit, Pig, Knight, Legion

### Pool 4 — Melhor de 5 (MD5)

| Set | Mapa |
|-----|------|
| 1 | Dead Dawg Saloon |
| 2 | Coal Tower |
| 3 | Léry's Memorial Institute |
| 4 | Blood Lodge |
| 5 | Toba Landing |

**Killers Permitidos:**
Clown, Good Guy, Cenobite, Ghost Face, Shape, Lich, Wraith, Dark Lord, Doctor, Krasue, The Slasher

---

## 5. Slash Commands

### 5.0 /gerenciar-pool (Organization)

Gerencia pools de mapas e killers (CRUD completo).

**Subcomandos:**

| Subcomando | Descrição |
|------------|-----------|
| `criar` | Cria uma nova pool com nome e formato (MD3/MD5) |
| `adicionar-mapa` | Adiciona um mapa a uma pool existente |
| `remover-mapa` | Remove um mapa de uma pool |
| `adicionar-killer` | Adiciona um killer a uma pool existente |
| `remover-killer` | Remove um killer de uma pool |
| `listar` | Lista todas as pools com mapas e killers |
| `deletar` | Deleta uma pool |
| `toggle` | Ativa/desativa uma pool |

**Exemplo de uso:**
```
/gerenciar-pool criar nome: "Pool 1" formato: MD3
/gerenciar-pool adicionar-mapa pool-id: 1 mapa: "Azarov's Resting Place"
/gerenciar-pool adicionar-killer pool-id: 1 killer: "Nurse"
/gerenciar-pool listar
```

### 5.1 /criar-confronto (Organization)

Cria um confronto entre dois times.

**Opções:**
| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| pool-id | Integer | Sim | ID da pool (use /gerenciar-pool listar) |
| time-a | Role | Sim | Cargo do Time A |
| time-b | Role | Sim | Cargo do Time B |

**Fluxo:**
1. Valida que a pool existe e está ativa
2. Valida que a pool tem pelo menos 2 mapas e 2 killers
3. Valida que os cargos existem e são diferentes
4. Cria registro no banco de dados
5. Cria canal de voz para Time A (permissão só do cargo Time A)
6. Cria canal de voz para Time B (permissão só do cargo Time B)
7. Cria canal de texto entre os times (permissão dos dois cargos + Organization)
8. Inicia o processo de veto de mapas no canal de texto

**Embed de Confronto:**
```
QUEENS TRIALS — ALL WIN
━━━━━━━━━━━━━━━━━━━━━━━

Time A: @Time Alpha
Time B: @Time Beta

Pool: Pool 1 — MD3
Formato: Melhor de 3

━━━━━━━━━━━━━━━━━━━━━━━
INICIANDO VETO DE MAPAS — SET 1
```

### 5.2 Sistema de Veto (Embed + Botões)

O veto acontece **para cada set**, tanto para mapas quanto para killers.

**Ordem de Veto:** Time A começa, depois Time B, alternado até restar 1.

#### Veto de Mapas (por set)

**Fluxo:**
1. Bot lista todos os mapas disponíveis do pool para o set atual
2. Envia embed mostrando **um mapa por vez** com botão [BANIR]
3. Time da vez clica no botão para banir
4. Mapa é removido da lista
5. Passa a vez para o outro time
6. Repete até restar 1 mapa
7. Mapa restante é usado no set

**Embed do Veto de Mapa:**
```
VETO DE MAPAS — SET 1
━━━━━━━━━━━━━━━━━━━━━━━

Vez de: @Time Alpha

Mapa atual: Azarov's Resting Place

[ BANIR ]
```

**Embed Mapa Banido:**
```
MAPA BANIDO
━━━━━━━━━━━━━━━━━━━━━━━

@Time Alpha baniu: Azarov's Resting Place

Vez de: @Time Beta

Mapa atual: Shelter Woods

[ BANIR ]
```

#### Veto de Killers (por set)

**Fluxo:** Idêntico ao veto de mapas, mas com a lista de killers do pool.

**Embed do Veto de Killer:**
```
VETO DE KILLERS — SET 1
━━━━━━━━━━━━━━━━━━━━━━━

Vez de: @Time Alpha

Killer atual: Oni

[ BANIR ]
```

### 5.3 /resultado (Organization)

Registra o vencedor do confronto.

**Opções:**
| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| confronto-id | Integer | Sim | ID do confronto |
| vencedor | Role | Sim | Time vencedor do confronto |

**Fluxo:**
1. Valida que o confronto existe e está ativo
2. Registra o vencedor
3. Atualiza stats dos times (vitória/derrota)
4. Envia embed de resultado final no canal do confronto
5. **Aguarda** Organization usar /encerrar para limpar canais

**Embed de Resultado:**
```
RESULTADO — CONFRONTO #001
━━━━━━━━━━━━━━━━━━━━━━━

VENCEDOR: @Alpha Squad

Pool 1 — MD3
Placar Final: 2-1

━━━━━━━━━━━━━━━━━━━━━━━
Aguardando encerramento...
```

### 5.4 /encerrar (Organization)

Encerra um confronto e limpa canais.

**Opções:**
| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| confronto-id | Integer | Sim | ID do confronto |
| motivo | String | Não | Motivo do encerramento |
| apagar-chat | Boolean | Não | Apagar canal de texto (padrão: false) |

**Fluxo:**
1. Registra motivo (se fornecido)
2. Envia embed de encerramento
3. Deleta canais de voz
4. **Se apagar-chat = true:** deleta canal de texto também
5. Marca confronto como encerrado no banco

### 5.5 /listar-confrontos (Todos)

Lista confrontos ativos e recentes.

**Embed de lista:**
```
CONFRONTOS ATIVOS
━━━━━━━━━━━━━━━━━

#001 — Pool 1 MD3
@Alpha Squad vs @Beta Legion
Status: Em andamento

#002 — Pool 3 MD5
@Time C vs @Time D
Status: Aguardando resultado
```

### 5.6 /ranking (Todos)

Mostra o ranking dos times com stats.

**Embed de ranking:**
```
RANKING — QUEENS TRIALS
━━━━━━━━━━━━━━━━━

1. @Alpha Squad — 5V / 1D
2. @Beta Legion — 3V / 2D
3. @Gamma Force — 2V / 3D
```

### 5.7 /perfil (Jogadores)

Mostra perfil e estatísticas do jogador.

**Embed de perfil:**
```
PERFIL — @Jogador
━━━━━━━━━━━━━━━━━

Confrontos: 8
Vitórias: 5
Derrotas: 3
Win Rate: 62.5%
```

### 5.8 /setup-cargo (Organization)

Configura os cargos de time para o evento.

**Opções:**
| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| nome-time | String | Sim | Nome do time |
| cor | String | Não | Cor em hex (padrão: cinza) |

**Fluxo:**
1. Cria cargo com o nome especificado
2. Adiciona à categoria "Times"
3. Responde confirmando criação

### 5.8 /gerenciar-cargo (Organization)

Gerencia cargos existentes.

**Subcomandos:**
- `renomear` — Renomeia um cargo de time
- `deletar` — Remove um cargo e seus canais associados
- `membro-adicionar` — Adiciona membro ao time
- `membro-remover` — Remove membro do time

---

## 6. Estrutura de Canais (Auto-criados)

Ao criar um confronto, o bot cria:

```
📂 CONFRONTOS/
├── 🔊 Time A — Confronto #001     (permissão: cargo Time A)
├── 🔊 Time B — Confronto #001     (permissão: cargo Time B)
└── 💬 vs Time A vs Time B #001    (permissão: Time A + Time B + Organization)
```

**Ao encerrar:** canais são deletados automaticamente.

---

## 7. Modelo de Dados (Prisma Schema)

**Pools são editáveis via comando `/gerenciar-pool`.**

```prisma
model Pool {
  id        Int      @id @default(autoincrement())
  guildId   String
  nome      String
  formato   String   // "MD3" ou "MD5"
  ativa     Boolean  @default(true)
  criadoEm  DateTime @default(now())
  mapas     PoolMapa[]
  killers   PoolKiller[]
  confrontos Confronto[]
  @@unique([id, guildId])
}

model PoolMapa {
  id        Int      @id @default(autoincrement())
  poolId    Int
  pool      Pool     @relation(fields: [poolId], references: [id], onDelete: Cascade)
  nome      String
  ordem     Int
}

model PoolKiller {
  id        Int      @id @default(autoincrement())
  poolId    Int
  pool      Pool     @relation(fields: [poolId], references: [id], onDelete: Cascade)
  nome      String
  ordem     Int
}

model Confronto {
  id          Int      @id @default(autoincrement())
  guildId     String
  poolId      Int
  pool        Pool     @relation(fields: [poolId], references: [id])
  formato     String
  timeARoleId String
  timeBRoleId String
  timeAVitorias Int    @default(0)
  timeBVitorias Int    @default(0)
  status      String   @default("aguardando")
  currentSet  Int      @default(1)
  channelId   String?
  vozTimeAId  String?
  vozTimeBId  String?
  vencedor    String?
  encerradoEm DateTime?
  motivoEncerramento String?
  criadoEm    DateTime @default(now())
  sets        Set[]
  vetoState   VetoState?
}

model Set {
  id            Int       @id @default(autoincrement())
  confrontoId   Int
  confronto     Confronto @relation(fields: [confrontoId], references: [id])
  numero        Int
  vencedorTime  String?
  mapaUsado     String?
  killerUsado   String?
  jogadoEm      DateTime?
}

model VetoState {
  id            Int       @id @default(autoincrement())
  confrontoId   Int       @unique
  confronto     Confronto @relation(fields: [confrontoId], references: [id])
  tipo          String
  set           Int
  vezDe         String
  mapasRestantes String
  killersRestantes String
  mapaEscolhido String?
  killerEscolhido String?
  messageId     String?
}

model Jogador {
  id        String @id
  guildId   String
  nome      String
  vitorias  Int    @default(0)
  derrotas   Int    @default(0)
  confrontos Int    @default(0)
  @@unique([id, guildId])
}
```

---

## 8. Lógica de Vitória

### MD3 (Pools 1 e 2)
- Primeiro a vencer **2 sets** ganha o confronto
- Máximo de 3 sets jogados

### MD5 (Pools 3 e 4)
- Primeiro a vencer **3 sets** ganha o confronto
- Máximo de 5 sets jogados

### Registro
- Organization usa `/resultado` para declarar o vencedor final do confronto
- Bot atualiza stats automaticamente
- Canais permanecem até `/encerrar` ser usado

---

## 9. Deploy na Discloud

### discloud.config

```ini
[App]
id = BOT_ID_AQUI
type = bot
main = src/index.ts
name = Dark Bot
description = Bot competitivo DBD — Queens Trials
avATAR = assets/avatar.png

[RAM]
amount = 512

[Plan]
type = free
```

### Passos de Deploy

1. Instalar CLI: `npm install -g discloud-cli`
2. Login: `discloud --login` (colar token da API)
3. Build: `npx tsx src/deploy-commands.ts` (registrar commands)
4. Upload: `discloud up`
5. Status: `discloud status`

### Scripts package.json

```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "deploy": "tsx src/deploy-commands.ts",
    "db:generate": "prisma generate",
    "db:push": "prisma db push",
    "db:migrate": "prisma migrate dev"
  }
}
```

### Variáveis de Ambiente (.env)

```env
DISCORD_TOKEN=seu_token_aqui
CLIENT_ID=seu_bot_id_aqui
GUILD_ID=seu_servidor_id_aqui
DATABASE_URL=file:./prisma/darkbot.db
```

---

## 10. Fluxo Completo de Uso

### Setup Inicial (Organization)

```
1. /setup-cargo nome-time: "Alpha Squad" cor: "#FF0000"
2. /setup-cargo nome-time: "Beta Legion" cor: "#0000FF"
3. Adicionar membros aos cargos via Discord
```

### Criar Confronto (Organization)

```
1. /criar-confronto pool: 1 time-a: @Alpha Squad time-b: @Beta Legion
2. Bot cria canais de voz e texto
3. Bot inicia veto de mapas no canal de texto
```

### Veto de Mapas (Times)

```
1. Bot mostra mapa: Azarov's Resting Place → @Alpha baniu
2. Bot mostra mapa: Shelter Woods → @Beta baniu
3. Mapa restante: Ormond Lake Mine → definido para Set 1
4. Repete para cada set (MD3 = 3 vetos, MD5 = 5 vetos)
```

### Veto de Killers (Times)

```
1. Bot mostra killer: Oni → @Alpha baniu
2. Bot mostra killer: Nurse → @Beta baniu
3. ...até restar 1 killer
4. Killer definido para o set
```

### Jogar Sets

```
1. Times entram nos canais de voz
2. Jogam o set no jogo
3. Organization registra vencedor: /resultado confronto-id: 1 vencedor: @Alpha Squad
4. Bot atualiza stats e envia embed
```

### Encerrar (Manual — Organization)

```
1. /encerrar confronto-id: 1 apagar-chat: true
2. Bot deleta canais de voz e texto
3. Confronto encerrado
```

---

## 11. Etapas de Implementação

### Fase 1: Fundação (Dias 1-2) - CONCLUÍDA
- [x] Setup do projeto (package.json, tsconfig.json, .env, .gitignore)
- [x] Configuração do Prisma + schema
- [x] Tipos compartilhados (types/index.ts)
- [x] Entry point do bot (index.ts)
- [x] Evento ready.ts
- [x] deploy-commands.ts
- [x] config.ts com cores DTA

### Fase 2: Comandos Core (Dias 3-4) - CONCLUÍDA
- [x] criar-confronto.ts
- [x] resultado.ts
- [x] encerrar.ts
- [x] listar-confrontos.ts
- [x] Criação automática de canais

### Fase 3: Sistema de Veto (Dia 5) - CONCLUÍDA
- [x] Lógica de veto (systems/veto.ts)
- [x] Veto de mapas com embed + botões
- [x] Veto de killers com embed + botões
- [x] Integração com criar-confronto
- [x] Validação de vez e turnos

### Fase 4: Cargos e Rankings (Dia 6) - CONCLUÍDA
- [x] setup-cargo.ts
- [x] gerenciar-cargo.ts
- [x] ranking.ts
- [x] perfil.ts

### Fase 5: Pools Editáveis (Dia 7) - CONCLUÍDA
- [x] Schema Prisma com Pool, PoolMapa, PoolKiller
- [x] gerenciar-pool.ts (CRUD completo)
- [x] Config carrega pools do banco
- [x] criar-confronto usa pools do banco
- [x] Bot testado e funcionando

### Fase 6: Polimento e Deploy (Dia 8)
- [ ] Deploy na Discloud
- [ ] Testes em produção
- [ ] Documentar uso para organizadores

---

## 12. Melhorias Sugeridas

1. **Timer por set** — Countdown visível nos canais de voz/texto
2. **Notificação de resultado** — Ping nos membros do time quando set é registrado
3. **Dashboard web** — Painel para visualizar confrontos em tempo real (fase futura)
4. **Integração com API da Steam** — Buscar stats automaticamente (como o Dwight bot faz)
5. **Sistema de replay** — Registrar logs detalhados de cada set para análise
6. **Multiplos eventos** — Suporte a diferentes torneios com configs independentes
7. **Backup automático** — Exportar resultados do banco periodicamente
8. **Sistema de checkpoint** — Salvar progresso do veto caso o bot reinicie

---

## 13. Checklist Final

- [x] Bot cria canais de voz por time com permissão restrita
- [x] Bot cria canal de texto entre os times
- [x] Sistema de veto de mapas com embed + botões
- [x] Sistema de veto de killers com embed + botões
- [x] Veto acontece para cada set individualmente
- [x] Time A começa o veto, alternado até restar 1
- [x] Slash commands visíveis apenas para @Organization
- [x] Jogadores só veem comandos básicos (perfil, ranking, listar)
- [x] Organization registra vencedor via /resultado
- [x] Organization encerra via /encerrar com opção de apagar chat
- [x] Banco de dados persistente
- [x] Pools editáveis via /gerenciar-pool
- [x] Bot logado e funcionando (Dark Bot#4757)
- [ ] Deploy funcional na Discloud
