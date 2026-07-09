import { REST, Routes, SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import dotenv from 'dotenv';
import { getDiscordToken, getDiscordTokenValidationError } from './utils/env';

dotenv.config();

const commands = [
  new SlashCommandBuilder()
    .setName('criar-confronto')
    .setDescription('Cria um confronto entre dois times')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addIntegerOption(option =>
      option
        .setName('pool-id')
        .setDescription('ID da pool (use /gerenciar-pool listar para ver IDs)')
        .setRequired(true),
    )
    .addRoleOption(option =>
      option
        .setName('time-a')
        .setDescription('Cargo do Time A')
        .setRequired(true),
    )
    .addRoleOption(option =>
      option
        .setName('time-b')
        .setDescription('Cargo do Time B')
        .setRequired(true),
    ),

  new SlashCommandBuilder()
    .setName('resultado')
    .setDescription('Registra o vencedor do confronto')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addIntegerOption(option =>
      option
        .setName('confronto-id')
        .setDescription('ID do confronto')
        .setRequired(true),
    )
    .addRoleOption(option =>
      option
        .setName('vencedor')
        .setDescription('Time vencedor do confronto')
        .setRequired(true),
    ),

  new SlashCommandBuilder()
    .setName('encerrar')
    .setDescription('Encerra um confronto e limpa canais')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addIntegerOption(option =>
      option
        .setName('confronto-id')
        .setDescription('ID do confronto')
        .setRequired(true),
    )
    .addStringOption(option =>
      option
        .setName('motivo')
        .setDescription('Motivo do encerramento'),
    )
    .addBooleanOption(option =>
      option
        .setName('apagar-chat')
        .setDescription('Apagar canal de texto (padrao: false)')
        .setRequired(false),
    ),

  new SlashCommandBuilder()
    .setName('listar-confrontos')
    .setDescription('Lista confrontos ativos e recentes')
    .setDMPermission(false),

  new SlashCommandBuilder()
    .setName('ranking')
    .setDescription('Mostra o ranking dos times')
    .setDMPermission(false),

  new SlashCommandBuilder()
    .setName('perfil')
    .setDescription('Mostra seu perfil e estatisticas')
    .setDMPermission(false),

  new SlashCommandBuilder()
    .setName('setup-cargo')
    .setDescription('Configura um cargo de time para o evento')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addStringOption(option =>
      option
        .setName('nome-time')
        .setDescription('Nome do time')
        .setRequired(true),
    )
    .addStringOption(option =>
      option
        .setName('cor')
        .setDescription('Cor em hex (ex: #FF0000)')
        .setRequired(false),
    ),

  new SlashCommandBuilder()
    .setName('gerenciar-cargo')
    .setDescription('Gerencia cargos de time existentes')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addSubcommand(subcommand =>
      subcommand
        .setName('renomear')
        .setDescription('Renomeia um cargo de time')
        .addRoleOption(option =>
          option
            .setName('cargo')
            .setDescription('Cargo para renomear')
            .setRequired(true),
        )
        .addStringOption(option =>
          option
            .setName('novo-nome')
            .setDescription('Novo nome do cargo')
            .setRequired(true),
        ),
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('deletar')
        .setDescription('Remove um cargo e seus canais associados')
        .addRoleOption(option =>
          option
            .setName('cargo')
            .setDescription('Cargo para deletar')
            .setRequired(true),
        ),
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('membro-adicionar')
        .setDescription('Adiciona membro ao time')
        .addRoleOption(option =>
          option
            .setName('cargo')
            .setDescription('Cargo do time')
            .setRequired(true),
        )
        .addUserOption(option =>
          option
            .setName('membro')
            .setDescription('Membro para adicionar')
            .setRequired(true),
        ),
    )
        .addSubcommand(subcommand =>
          subcommand
            .setName('membro-remover')
            .setDescription('Remove membro do time')
            .addRoleOption(option =>
              option
                .setName('cargo')
                .setDescription('Cargo do time')
                .setRequired(true),
            )
            .addUserOption(option =>
              option
                .setName('membro')
                .setDescription('Membro para remover')
                .setRequired(true),
            ),
        ),

  new SlashCommandBuilder()
    .setName('gerenciar-pool')
    .setDescription('Gerencia pools de mapas e killers')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addSubcommand(subcommand =>
      subcommand
        .setName('criar')
        .setDescription('Cria uma nova pool')
        .addStringOption(option =>
          option
            .setName('nome')
            .setDescription('Nome da pool (ex: Pool 1)')
            .setRequired(true),
        )
        .addStringOption(option =>
          option
            .setName('formato')
            .setDescription('Formato da pool')
            .setRequired(true)
            .addChoices(
              { name: 'MD3 (Melhor de 3)', value: 'MD3' },
              { name: 'MD5 (Melhor de 5)', value: 'MD5' },
            ),
        ),
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('adicionar-mapa')
        .setDescription('Adiciona um mapa a uma pool')
        .addIntegerOption(option =>
          option
            .setName('pool-id')
            .setDescription('ID da pool')
            .setRequired(true),
        )
        .addStringOption(option =>
          option
            .setName('mapa')
            .setDescription('Nome do mapa')
            .setRequired(true),
        ),
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('remover-mapa')
        .setDescription('Remove um mapa de uma pool')
        .addIntegerOption(option =>
          option
            .setName('pool-id')
            .setDescription('ID da pool')
            .setRequired(true),
        )
        .addStringOption(option =>
          option
            .setName('mapa')
            .setDescription('Nome do mapa para remover')
            .setRequired(true),
        ),
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('adicionar-killer')
        .setDescription('Adiciona um killer a uma pool')
        .addIntegerOption(option =>
          option
            .setName('pool-id')
            .setDescription('ID da pool')
            .setRequired(true),
        )
        .addStringOption(option =>
          option
            .setName('killer')
            .setDescription('Nome do killer')
            .setRequired(true),
        ),
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('remover-killer')
        .setDescription('Remove um killer de uma pool')
        .addIntegerOption(option =>
          option
            .setName('pool-id')
            .setDescription('ID da pool')
            .setRequired(true),
        )
        .addStringOption(option =>
          option
            .setName('killer')
            .setDescription('Nome do killer para remover')
            .setRequired(true),
        ),
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('listar')
        .setDescription('Lista todas as pools com mapas e killers'),
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('deletar')
        .setDescription('Deleta uma pool')
        .addIntegerOption(option =>
          option
            .setName('pool-id')
            .setDescription('ID da pool para deletar')
            .setRequired(true),
        ),
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('toggle')
        .setDescription('Ativa/desativa uma pool')
        .addIntegerOption(option =>
          option
            .setName('pool-id')
            .setDescription('ID da pool')
            .setRequired(true),
        ),
    ),
];

async function deployCommands() {
  try {
    console.log('[Deploy] Registrando slash commands...');

    const token = getDiscordToken();
    if (!token) {
      throw new Error('DISCORD_TOKEN nao configurado. No Render, defina em Environment Variables.');
    }

    const tokenError = getDiscordTokenValidationError(token);
    if (tokenError) {
      throw new Error(tokenError);
    }

    const clientId = process.env.CLIENT_ID!;
    const guildId = process.env.GUILD_ID!;
    const commandScope = process.env.COMMAND_SCOPE === 'guild' ? 'guild' : 'global';
    const rest = new REST({ version: '10' }).setToken(token);

    const data = commands.map(command => command.toJSON());
    const route = commandScope === 'guild'
      ? Routes.applicationGuildCommands(clientId, guildId)
      : Routes.applicationCommands(clientId);

    await rest.put(route, {
      body: data,
    });

    console.log(`[Deploy] ${commands.length} comandos ${commandScope === 'guild' ? 'do servidor' : 'globais'} registrados com sucesso!`);
  } catch (error) {
    console.error('[Deploy] Erro ao registrar comandos:', error);
    process.exit(1);
  }
}

deployCommands();
