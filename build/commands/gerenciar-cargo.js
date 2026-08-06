"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.data = void 0;
exports.execute = execute;
const discord_js_1 = require("discord.js");
const embeds_1 = require("../utils/embeds");
const role_service_1 = require("../services/role-service");
exports.data = new discord_js_1.SlashCommandBuilder()
    .setName('gerenciar-cargo')
    .setDescription('Gerencia cargos de time existentes')
    .setDMPermission(false)
    .addSubcommand(subcommand => subcommand
    .setName('renomear')
    .setDescription('Renomeia um cargo de time')
    .addRoleOption(option => option
    .setName('cargo')
    .setDescription('Cargo para renomear')
    .setRequired(true))
    .addStringOption(option => option
    .setName('novo-nome')
    .setDescription('Novo nome do cargo')
    .setRequired(true)))
    .addSubcommand(subcommand => subcommand
    .setName('deletar')
    .setDescription('Remove um cargo e seus canais associados')
    .addRoleOption(option => option
    .setName('cargo')
    .setDescription('Cargo para deletar')
    .setRequired(true)))
    .addSubcommand(subcommand => subcommand
    .setName('membro-adicionar')
    .setDescription('Adiciona membro ao time')
    .addRoleOption(option => option
    .setName('cargo')
    .setDescription('Cargo do time')
    .setRequired(true))
    .addUserOption(option => option
    .setName('membro')
    .setDescription('Membro para adicionar')
    .setRequired(true)))
    .addSubcommand(subcommand => subcommand
    .setName('membro-remover')
    .setDescription('Remove membro do time')
    .addRoleOption(option => option
    .setName('cargo')
    .setDescription('Cargo do time')
    .setRequired(true))
    .addUserOption(option => option
    .setName('membro')
    .setDescription('Membro para remover')
    .setRequired(true)));
async function execute(interaction) {
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
async function handleRenomear(interaction) {
    const cargo = interaction.options.getRole('cargo', true);
    const novoNome = interaction.options.getString('novo-nome', true);
    await (0, role_service_1.renameTeamRole)(cargo, novoNome);
    await interaction.reply({
        embeds: [(0, embeds_1.createSuccessEmbed)(`Cargo renomeado para **${novoNome}**.`)],
        flags: 64,
    });
}
async function handleDeletar(interaction) {
    const cargo = interaction.options.getRole('cargo', true);
    await (0, role_service_1.deleteTeamRole)(cargo);
    await interaction.reply({
        embeds: [(0, embeds_1.createSuccessEmbed)(`Cargo **${cargo.name}** deletado.`)],
        flags: 64,
    });
}
async function handleMembroAdicionar(interaction) {
    const cargo = interaction.options.getRole('cargo', true);
    const membro = interaction.options.getMember('membro');
    if (!membro || !(membro instanceof discord_js_1.GuildMember)) {
        await interaction.reply({
            embeds: [(0, embeds_1.createErrorEmbed)('Membro invalido.')],
            flags: 64,
        });
        return;
    }
    await (0, role_service_1.addMemberToTeamRole)(membro.roles, cargo.id);
    await interaction.reply({
        embeds: [(0, embeds_1.createSuccessEmbed)(`Membro adicionado ao cargo **${cargo.name}**.`)],
        flags: 64,
    });
}
async function handleMembroRemover(interaction) {
    const cargo = interaction.options.getRole('cargo', true);
    const membro = interaction.options.getMember('membro');
    if (!membro || !(membro instanceof discord_js_1.GuildMember)) {
        await interaction.reply({
            embeds: [(0, embeds_1.createErrorEmbed)('Membro invalido.')],
            flags: 64,
        });
        return;
    }
    await (0, role_service_1.removeMemberFromTeamRole)(membro.roles, cargo.id);
    await interaction.reply({
        embeds: [(0, embeds_1.createSuccessEmbed)(`Membro removido do cargo **${cargo.name}**.`)],
        flags: 64,
    });
}
//# sourceMappingURL=gerenciar-cargo.js.map