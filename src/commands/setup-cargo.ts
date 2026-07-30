import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from 'discord.js';
import { createSuccessEmbed, createErrorEmbed } from '../utils/embeds';
import {
  createTeamRole,
  parseTeamRoleColor,
} from '../services/role-service';

export const data = new SlashCommandBuilder()
  .setName('setup-cargo')
  .setDescription('Configura um cargo de time para o evento')
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
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const nomeTime = interaction.options.getString('nome-time', true);
  const corHex = interaction.options.getString('cor');

  const color = parseTeamRoleColor(corHex);

  if (color === null) {
    await interaction.reply({
      embeds: [createErrorEmbed('Cor hex invalida. Use o formato #RRGGBB.')],
      flags: 64,
    });
    return;
  }

  await interaction.deferReply();

  const cargo = await createTeamRole(interaction.guild!.roles, {
    name: nomeTime,
    color,
    createdBy: interaction.user.displayName,
  });

  const embed = createSuccessEmbed(
    `Cargo **${cargo.name}** criado com sucesso!\n\nAdicione membros ao cargo para configurar o time.`,
  );

  await interaction.editReply({
    embeds: [embed],
  });
}
