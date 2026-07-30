import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';
import { COLORS } from '../config';
import { poolService } from '../services/pool-service';
import { createSuccessEmbed, createErrorEmbed } from '../utils/embeds';

const DTA_LOGO = 'https://pxdrop.online/raw/d9fv0fmhv1ts73baugmg?file=queens-trials-logo.png';

export const data = new SlashCommandBuilder()
  .setName('gerenciar-pool')
  .setDescription('Gerencia pools de mapas e killers')
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
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'criar':
      await handleCriar(interaction);
      break;
    case 'adicionar-mapa':
      await handleAdicionarMapa(interaction);
      break;
    case 'remover-mapa':
      await handleRemoverMapa(interaction);
      break;
    case 'adicionar-killer':
      await handleAdicionarKiller(interaction);
      break;
    case 'remover-killer':
      await handleRemoverKiller(interaction);
      break;
    case 'listar':
      await handleListar(interaction);
      break;
    case 'deletar':
      await handleDeletar(interaction);
      break;
    case 'toggle':
      await handleToggle(interaction);
      break;
  }
}

async function handleCriar(interaction: ChatInputCommandInteraction) {
  const nome = interaction.options.getString('nome', true);
  const formato = interaction.options.getString('formato', true) as 'MD3' | 'MD5';

  const pool = await poolService.create(interaction.guildId!, nome, formato);

  await interaction.reply({
    embeds: [createSuccessEmbed(`Pool **${pool.nome}** criada com ID **${pool.id}**.\n\nUse os comandos \`adicionar-mapa\` e \`adicionar-killer\` para configurar.`)],
    flags: 64,
  });
}

async function handleAdicionarMapa(interaction: ChatInputCommandInteraction) {
  const poolId = interaction.options.getInteger('pool-id', true);
  const mapa = interaction.options.getString('mapa', true);

  const result = await poolService.addMap(interaction.guildId!, poolId, mapa);

  if (!result.ok && result.reason === 'POOL_NOT_FOUND') {
    await interaction.reply({
      embeds: [createErrorEmbed('Pool nao encontrada.')],
      flags: 64,
    });
    return;
  }

  if (!result.ok) {
    await interaction.reply({
      embeds: [createErrorEmbed('Este mapa ja existe nesta pool.')],
      flags: 64,
    });
    return;
  }

  const { pool, ordem } = result.value;

  await interaction.reply({
    embeds: [createSuccessEmbed(`Mapa **${mapa}** adicionado a pool **${pool.nome}** (Posicao: ${ordem}).`)],
    flags: 64,
  });
}

async function handleRemoverMapa(interaction: ChatInputCommandInteraction) {
  const poolId = interaction.options.getInteger('pool-id', true);
  const mapa = interaction.options.getString('mapa', true);

  const result = await poolService.removeMap(interaction.guildId!, poolId, mapa);

  if (!result.ok && result.reason === 'POOL_NOT_FOUND') {
    await interaction.reply({
      embeds: [createErrorEmbed('Pool nao encontrada.')],
      flags: 64,
    });
    return;
  }

  if (!result.ok) {
    await interaction.reply({
      embeds: [createErrorEmbed('Mapa nao encontrado nesta pool.')],
      flags: 64,
    });
    return;
  }

  const { pool } = result.value;

  await interaction.reply({
    embeds: [createSuccessEmbed(`Mapa **${mapa}** removido da pool **${pool.nome}**.`)],
    flags: 64,
  });
}

async function handleAdicionarKiller(interaction: ChatInputCommandInteraction) {
  const poolId = interaction.options.getInteger('pool-id', true);
  const killer = interaction.options.getString('killer', true);

  const result = await poolService.addKiller(interaction.guildId!, poolId, killer);

  if (!result.ok && result.reason === 'POOL_NOT_FOUND') {
    await interaction.reply({
      embeds: [createErrorEmbed('Pool nao encontrada.')],
      flags: 64,
    });
    return;
  }

  if (!result.ok) {
    await interaction.reply({
      embeds: [createErrorEmbed('Este killer ja existe nesta pool.')],
      flags: 64,
    });
    return;
  }

  const { pool, ordem } = result.value;

  await interaction.reply({
    embeds: [createSuccessEmbed(`Killer **${killer}** adicionado a pool **${pool.nome}** (Posicao: ${ordem}).`)],
    flags: 64,
  });
}

async function handleRemoverKiller(interaction: ChatInputCommandInteraction) {
  const poolId = interaction.options.getInteger('pool-id', true);
  const killer = interaction.options.getString('killer', true);

  const result = await poolService.removeKiller(interaction.guildId!, poolId, killer);

  if (!result.ok && result.reason === 'POOL_NOT_FOUND') {
    await interaction.reply({
      embeds: [createErrorEmbed('Pool nao encontrada.')],
      flags: 64,
    });
    return;
  }

  if (!result.ok) {
    await interaction.reply({
      embeds: [createErrorEmbed('Killer nao encontrado nesta pool.')],
      flags: 64,
    });
    return;
  }

  const { pool } = result.value;

  await interaction.reply({
    embeds: [createSuccessEmbed(`Killer **${killer}** removido da pool **${pool.nome}**.`)],
    flags: 64,
  });
}

async function handleListar(interaction: ChatInputCommandInteraction) {
  const pools = await poolService.list(interaction.guildId!);

  if (pools.length === 0) {
    await interaction.reply({
      embeds: [createErrorEmbed('Nenhuma pool encontrada. Use \`/gerenciar-pool criar\` para criar uma.')],
      flags: 64,
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle('POOLS DISPONIVEIS')
    .setColor(COLORS.accent as any)
    .setThumbnail(DTA_LOGO)
    .setFooter({ text: 'Dark Trials Arena' })
    .setTimestamp();

  const description = pools.map(pool => {
    const mapas = pool.mapas.map(m => m.nome).join(', ') || 'Nenhum mapa';
    const killers = pool.killers.map(k => k.nome).join(', ') || 'Nenhum killer';

    return [
      `**${pool.nome}** (ID: ${pool.id}) — ${pool.formato}`,
      `**Mapas (${pool.mapas.length}):** ${mapas}`,
      `**Killers (${pool.killers.length}):** ${killers}`,
    ].join('\n');
  }).join('\n\n');

  embed.setDescription(description);

  await interaction.reply({
    embeds: [embed],
    flags: 64,
  });
}

async function handleDeletar(interaction: ChatInputCommandInteraction) {
  const poolId = interaction.options.getInteger('pool-id', true);

  const result = await poolService.delete(interaction.guildId!, poolId);

  if (!result.ok) {
    await interaction.reply({
      embeds: [createErrorEmbed('Pool nao encontrada.')],
      flags: 64,
    });
    return;
  }

  const { pool } = result.value;

  await interaction.reply({
    embeds: [createSuccessEmbed(`Pool **${pool.nome}** deletada.`)],
    flags: 64,
  });
}

async function handleToggle(interaction: ChatInputCommandInteraction) {
  const poolId = interaction.options.getInteger('pool-id', true);

  const result = await poolService.toggle(interaction.guildId!, poolId);

  if (!result.ok) {
    await interaction.reply({
      embeds: [createErrorEmbed('Pool nao encontrada.')],
      flags: 64,
    });
    return;
  }

  const { pool } = result.value;

  await interaction.reply({
    embeds: [createSuccessEmbed(`Pool **${pool.nome}** ${pool.ativa ? 'desativada' : 'ativada'}.`)],
    flags: 64,
  });
}
