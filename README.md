<p align="center"><img src="https://ncfnquvxpleeosuuunob.supabase.co/storage/v1/object/public/dbdmaps//logo-01.webp" alt="DTA Logo" width="200" /></p>`n<p align="center"><img src="https://img.shields.io/badge/Discord.js-v14-5865F2?logo=discord&logoColor=white" alt="Discord.js" /> <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white" alt="TypeScript" /> <img src="https://img.shields.io/badge/Prisma-6.x-2D3748?logo=prisma&logoColor=white" alt="Prisma" /> <img src="https://img.shields.io/badge/Node.js-22.x-339933?logo=node.js&logoColor=white" alt="Node.js" /></p>`n`n<p align="center">
  <img src="https://ncfnquvxpleeosuuunob.supabase.co/storage/v1/object/public/dbdmaps//logo-01.webp" alt="DTA Logo" width="200"/>
</p>


<h1 align="center">Dark Bot</h1>

<p align="center">
  <strong>Bot Discord competitivo para partidas 5v5 de Dead by Daylight</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Discord.js-v14-5865F2?logo=discord&logoColor=white" alt="Discord.js"/>
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white" alt="TypeScript"/>
  <img src="https://img.shields.io/badge/Prisma-6.x-2D3748?logo=prisma&logoColor=white" alt="Prisma"/>
  <img src="https://img.shields.io/badge/Node.js-22.x-339933?logo=node.js&logoColor=white" alt="Node.js"/>
  <img src="https://img.shields.io/badge/License-MIT-yellow" alt="License"/>
</p>

<p align="center">
  Bot para gerenciamento de confrontos competitivos 5v5 com sistema de veto de mapas e killers,
  canais automáticos por time e tracking de estatísticas.
</p>

---

## Funcionalidades

### Gerenciamento de Confrontos
- Criar confrontos entre dois times com pool de mapas e killers específicos
- Canais de voz automáticos por time (permissão restrita)
- Canal de texto compartilhado entre os times
- Encerramento manual com opção de apagar chat

### Sistema de Veto
- Veto de mapas e killers por set (embed + botões)
- Time A começa o veto, alternado até restar 1 mapa e 1 killer
- Veto acontece para cada set individualmente
- Validação de vez e turnos

### Pools Editáveis
- CRUD completo de pools via comando slash
- Adicionar/remover mapas e killers
- Ativar/desativar pools
- Pools armazenadas no banco de dados

### Rankings e Estatísticas
- Ranking dos times com vitórias/derrotas
- Perfil do jogador com win rate
- Histórico de confrontos

### Controle de Permissões
- @Organization: acesso total a todos os comandos
- Capitão: pode registrar resultados
- Jogador: apenas comandos básicos (perfil, ranking)

---

## Comandos Slash

| Comando | Descrição | Permissão |
|---------|-----------|-----------|
| `/gerenciar-pool` | CRUD de pools (criar, listar, adicionar/remover mapas/killers) | Organization |
| `/criar-confronto` | Cria um confronto entre dois times | Organization |
| `/resultado` | Registra o vencedor do confronto | Organization |
| `/encerrar` | Encerra um confronto e limpa canais | Organization |
| `/listar-confrontos` | Lista confrontos ativos | Todos |
| `/ranking` | Mostra ranking dos times | Todos |
| `/perfil` | Mostra perfil e estatísticas | Todos |
| `/setup-cargo` | Cria cargo de time | Organization |
| `/gerenciar-cargo` | Gerencia cargos (renomear, deletar, membros) | Organization |

---

## Pools Iniciais (Queens Trials - All Win)

### Pool 1 - MD3
**Mapas:** Azarov's Resting Place, Shelter Woods, Ormond Lake Mine

**Killers:** Oni, Nurse, Spirit, Krasue, Artist, Ghoul, Lich, Plague, Singularity

### Pool 2 - MD3
**Mapas:** Groaning Storehouse, Wrecker's Yard, Residencia da Familia (Yamaoka)

**Killers:** The Slasher, Animatronic, Mastermind, Deathslinger, Nightmare, The Executioner, Unknown, Nemesis, Houndmaster

### Pool 3 - MD5
**Mapas:** Wretched Shop, Midwich Elementary School, Suffocation Pit, Ironworks of Misery, Thompson's House

**Killers:** Demogorgon, Dredge, Onryo, The First, Wraith, Hillbilly, Blight, Spirit, Pig, Knight, Legion

### Pool 4 - MD5
**Mapas:** Dead Dawg Saloon, Coal Tower, Lery's Memorial Institute, Blood Lodge, Toba Landing

**Killers:** Clown, Good Guy, Cenobite, Ghost Face, Shape, Lich, Wraith, Dark Lord, Doctor, Krasue, The Slasher

---

## Fluxo de Uso

```
1. Organization cria pools com /gerenciar-pool
2. Organization cria cargos de time com /setup-cargo
3. Organization cria confronto com /criar-confronto
4. Bot inicia veto de mapas no canal de texto
5. Times alternadamente banem mapas (botões)
6. Bot inicia veto de killers
7. Times alternadamente banem killers
8. Mapa e killer definidos para o set
9. Times jogam o set
10. Organization registra vencedor com /resultado
11. Organization encerra com /encerrar
```

---

## Tecnologias

| Tecnologia | Versão | Uso |
|------------|--------|-----|
| Node.js | 22.x | Runtime |
| TypeScript | 5.x | Linguagem |
| Discord.js | 14.x | Framework Discord |
| Prisma | 6.x | ORM |
| SQLite | - | Banco de dados |
| Discloud | - | Hospedagem |

---

## Estrutura do Projeto

```
dark-bot/
├── src/
│   ├── index.ts              # Entry point
│   ├── config.ts             # Cores e configurações
│   ├── deploy-commands.ts    # Registro de slash commands
│   ├── seed-pools.ts         # Seed das pools iniciais
│   ├── types/
│   │   └── index.ts          # Interfaces TypeScript
│   ├── database/
│   │   ├── schema.prisma     # Modelo de dados
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
│   │   └── gerenciar-pool.ts
│   ├── systems/
│   │   └── veto.ts           # Sistema de veto
│   ├── events/
│   │   ├── ready.ts
│   │   ├── interactionCreate.ts
│   │   └── voiceStateUpdate.ts
│   └── utils/
│       ├── permissions.ts
│       ├── channels.ts
│       └── embeds.ts
├── prisma/
│   └── schema.prisma
├── .env.example
├── .gitignore
├── discloud.config
├── package.json
├── tsconfig.json
├── start.bat
├── stop.bat
└── status.bat
```

---

## Instalação

### Pré-requisitos

- [Node.js](https://nodejs.org/) 22.x ou superior
- [Discord Developer Portal](https://discord.com/developers/applications) (criar bot)
- [Discloud](https://discloud.com/) (para hospedagem)

### Passos

1. **Clone o repositório**
   ```bash
   git clone https://github.com/Joaozinhown/dark-bot.git
   cd dark-bot
   ```

2. **Instale as dependências**
   ```bash
   npm install
   ```

3. **Configure o ambiente**
   ```bash
   cp .env.example .env
   ```
   Edite o arquivo `.env` com suas credenciais:
   ```env
   DISCORD_TOKEN=seu_token_aqui
   CLIENT_ID=seu_bot_id_aqui
   GUILD_ID=seu_servidor_id_aqui
   DATABASE_URL=file:./prisma/darkbot.db
   ```

4. **Configure o banco de dados**
   ```bash
   npx prisma db push
   npx prisma generate
   ```

5. **Insira as pools iniciais**
   ```bash
   npx tsc
   node dist/seed-pools.js
   ```

6. **Registre os comandos slash**
   ```bash
   node dist/deploy-commands.js
   ```

7. **Inicie o bot**
   ```bash
   node dist/index.js
   ```

---

## Deploy na Discloud

1. **Instale a CLI**
   ```bash
   npm install -g discloud-cli
   ```

2. **Faça login**
   ```bash
   discloud --login
   ```

3. **Compile e faça upload**
   ```bash
   npx tsc
   discloud up
   ```

4. **Verifique o status**
   ```bash
   discloud status
   ```

---

## Scripts

| Script | Comando | Descrição |
|--------|---------|-----------|
| Iniciar | `start.bat` | Compila e inicia o bot em background |
| Parar | `stop.bat` | Para todos os processos node.js |
| Status | `status.bat` | Mostra status do bot |
| Build | `npm run build` | Compila TypeScript |
| Deploy | `npm run deploy` | Registra slash commands |
| Dev | `npm run dev` | Inicia com hot reload (tsx) |

---

## Modelo de Dados

### Pool
- `id`: ID único
- `guildId`: ID do servidor
- `nome`: Nome da pool
- `formato`: MD3 ou MD5
- `ativa`: Se a pool está ativa

### PoolMapa / PoolKiller
- `poolId`: ID da pool
- `nome`: Nome do mapa/killer
- `ordem`: Ordem na pool

### Confronto
- `poolId`: Pool utilizada
- `timeARoleId` / `timeBRoleId`: Cargos dos times
- `status`: aguardando, veto, em_andamento, resultado, encerrado
- `vencedor`: A ou B

### VetoState
- `tipo`: mapa ou killer
- `vezDe`: A ou B
- `mapasRestantes` / `killersRestantes`: JSON com itens disponíveis

---

## Licença

Este projeto está licenciado sob a licença MIT - veja o arquivo [LICENSE](LICENSE) para detalhes.

---

## Contato

- **Discord:** [Dark Trials Arena](https://discord.gg/bnJJwvg4DY)
- **Site:** [darktrialsarena.com](https://darktrialsarena.com)
- **GitHub:** [@Joaozinhown](https://github.com/Joaozinhown)

---

<p align="center">
  Feito com dedicação para a comunidade competitiva de Dead by Daylight
</p>
