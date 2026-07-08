import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  GuildMember,
  Role,
} from 'discord.js';
import { createSuccessEmbed, createErrorEmbed } from '../utils/embeds';

export const data = new SlashCommandBuilder()
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

  await cargo.setName(novoNome);

  await interaction.reply({
    embeds: [createSuccessEmbed(`Cargo renomeado para **${novoNome}**.`)],
    ephemeral: true,
  });
}

async function handleDeletar(interaction: ChatInputCommandInteraction) {
  const cargo = interaction.options.getRole('cargo', true) as Role;

  await cargo.delete('Deletado por organizador');

  await interaction.reply({
    embeds: [createSuccessEmbed(`Cargo **${cargo.name}** deletado.`)],
    ephemeral: true,
  });
}

async function handleMembroAdicionar(interaction: ChatInputCommandInteraction) {
  const cargo = interaction.options.getRole('cargo', true);
  const membro = interaction.options.getMember('membro');

  if (!membro || !(membro instanceof GuildMember)) {
    await interaction.reply({
      embeds: [createErrorEmbed('Membro invalido.')],
      ephemeral: true,
    });
    return;
  }

  await membro.roles.add(cargo.id);

  await interaction.reply({
    embeds: [createSuccessEmbed(`Membro adicionado ao cargo **${cargo.name}**.`)],
    ephemeral: true,
  });
}

async function handleMembroRemover(interaction: ChatInputCommandInteraction) {
  const cargo = interaction.options.getRole('cargo', true);
  const membro = interaction.options.getMember('membro');

  if (!membro || !(membro instanceof GuildMember)) {
    await interaction.reply({
      embeds: [createErrorEmbed('Membro invalido.')],
      ephemeral: true,
    });
    return;
  }

  await membro.roles.remove(cargo.id);

  await interaction.reply({
    embeds: [createSuccessEmbed(`Membro removido do cargo **${cargo.name}**.`)],
    ephemeral: true,
  });
}
