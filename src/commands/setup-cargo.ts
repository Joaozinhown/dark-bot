import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  Colors,
} from 'discord.js';
import { parseHexColor } from '../utils/permissions';
import { createSuccessEmbed, createErrorEmbed } from '../utils/embeds';

export const data = new SlashCommandBuilder()
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
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const nomeTime = interaction.options.getString('nome-time', true);
  const corHex = interaction.options.getString('cor');

  let color: number | typeof Colors.Default = Colors.Default;

  if (corHex) {
    const parsed = parseHexColor(corHex);
    if (parsed === null) {
      await interaction.reply({
        embeds: [createErrorEmbed('Cor hex invalida. Use o formato #RRGGBB.')],
        ephemeral: true,
      });
      return;
    }
    color = parsed;
  }

  await interaction.deferReply();

  const cargo = await interaction.guild!.roles.create({
    name: nomeTime,
    color,
    reason: `Cargo de time criado por ${interaction.user.displayName}`,
  });

  const embed = createSuccessEmbed(
    `Cargo **${cargo.name}** criado com sucesso!\n\nAdicione membros ao cargo para configurar o time.`,
  );

  await interaction.editReply({
    embeds: [embed],
  });
}
