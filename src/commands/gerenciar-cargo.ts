import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  GuildMember,
  Role,
} from 'discord.js';
import { createSuccessEmbed, createErrorEmbed } from '../utils/embeds';
import {
  addMemberToTeamRole,
  deleteTeamRole,
  removeMemberFromTeamRole,
  renameTeamRole,
} from '../services/role-service';

export const data = new SlashCommandBuilder()
  .setName('gerenciar-cargo')
  .setDescription('Gerencia cargos de time existentes')
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
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'renomear':
      await handleRenomear(interaction);
      break;
    case 'deletar':
      await handleDeletar(interaction);
      break;
    case 'membro-adicionar':
      await handleMembroAdicionar(interaction);
      break;
    case 'membro-remover':
      await handleMembroRemover(interaction);
      break;
  }
}

async function handleRenomear(interaction: ChatInputCommandInteraction) {
  const cargo = interaction.options.getRole('cargo', true) as Role;
  const novoNome = interaction.options.getString('novo-nome', true);

  await renameTeamRole(cargo, novoNome);

  await interaction.reply({
    embeds: [createSuccessEmbed(`Cargo renomeado para **${novoNome}**.`)],
    flags: 64,
  });
}

async function handleDeletar(interaction: ChatInputCommandInteraction) {
  const cargo = interaction.options.getRole('cargo', true) as Role;

  await deleteTeamRole(cargo);

  await interaction.reply({
    embeds: [createSuccessEmbed(`Cargo **${cargo.name}** deletado.`)],
    flags: 64,
  });
}

async function handleMembroAdicionar(interaction: ChatInputCommandInteraction) {
  const cargo = interaction.options.getRole('cargo', true);
  const membro = interaction.options.getMember('membro');

  if (!membro || !(membro instanceof GuildMember)) {
    await interaction.reply({
      embeds: [createErrorEmbed('Membro invalido.')],
      flags: 64,
    });
    return;
  }

  await addMemberToTeamRole(membro.roles, cargo.id);

  await interaction.reply({
    embeds: [createSuccessEmbed(`Membro adicionado ao cargo **${cargo.name}**.`)],
    flags: 64,
  });
}

async function handleMembroRemover(interaction: ChatInputCommandInteraction) {
  const cargo = interaction.options.getRole('cargo', true);
  const membro = interaction.options.getMember('membro');

  if (!membro || !(membro instanceof GuildMember)) {
    await interaction.reply({
      embeds: [createErrorEmbed('Membro invalido.')],
      flags: 64,
    });
    return;
  }

  await removeMemberFromTeamRole(membro.roles, cargo.id);

  await interaction.reply({
    embeds: [createSuccessEmbed(`Membro removido do cargo **${cargo.name}**.`)],
    flags: 64,
  });
}
