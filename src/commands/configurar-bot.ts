import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  Role,
} from 'discord.js';
import { createErrorEmbed, createSuccessEmbed } from '../utils/embeds';
import { guildPermissionService } from '../utils/permissions';

export const data = new SlashCommandBuilder()
  .setName('configurar-bot')
  .setDescription('Configura permissoes administrativas do bot')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .setDMPermission(false)
  .addSubcommand(subcommand =>
    subcommand
      .setName('admin-adicionar')
      .setDescription('Permite que um cargo use comandos administrativos do bot')
      .addRoleOption(option =>
        option
          .setName('cargo')
          .setDescription('Cargo que tera acesso administrativo')
          .setRequired(true),
      ),
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('admin-remover')
      .setDescription('Remove acesso administrativo de um cargo')
      .addRoleOption(option =>
        option
          .setName('cargo')
          .setDescription('Cargo que perdera acesso administrativo')
          .setRequired(true),
      ),
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('admin-listar')
      .setDescription('Lista cargos com acesso administrativo ao bot'),
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const guildId = interaction.guildId;

  if (!guildId) {
    await interaction.reply({
      embeds: [createErrorEmbed('Este comando so pode ser usado em servidores.')],
      flags: 64,
    });
    return;
  }

  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'admin-listar') {
    await handleListar(interaction, guildId);
    return;
  }

  const role = interaction.options.getRole('cargo', true) as Role;

  if (subcommand === 'admin-adicionar') {
    await guildPermissionService.addAdminRole(guildId, role.id);
    await interaction.reply({
      embeds: [createSuccessEmbed(`Cargo **${role.name}** agora pode usar comandos administrativos do bot.`)],
      flags: 64,
    });
    return;
  }

  await guildPermissionService.removeAdminRole(guildId, role.id);
  await interaction.reply({
    embeds: [createSuccessEmbed(`Cargo **${role.name}** removido da lista administrativa do bot.`)],
    flags: 64,
  });
}

async function handleListar(interaction: ChatInputCommandInteraction, guildId: string): Promise<void> {
  const roleIds = await guildPermissionService.listAdminRoleIds(guildId);

  if (roleIds.length === 0) {
    await interaction.reply({
      embeds: [createErrorEmbed('Nenhum cargo administrativo configurado. Membros com Gerenciar Servidor ainda podem administrar o bot.')],
      flags: 64,
    });
    return;
  }

  const roles = roleIds.map(roleId => `<@&${roleId}>`).join('\n');

  await interaction.reply({
    embeds: [createSuccessEmbed(`Cargos administrativos configurados:\n\n${roles}`)],
    flags: 64,
  });
}
