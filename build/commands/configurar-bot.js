"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.data = void 0;
exports.execute = execute;
const discord_js_1 = require("discord.js");
const embeds_1 = require("../utils/embeds");
const permissions_1 = require("../utils/permissions");
exports.data = new discord_js_1.SlashCommandBuilder()
    .setName('configurar-bot')
    .setDescription('Configura permissoes administrativas do bot')
    .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addSubcommand(subcommand => subcommand
    .setName('admin-adicionar')
    .setDescription('Permite que um cargo use comandos administrativos do bot')
    .addRoleOption(option => option
    .setName('cargo')
    .setDescription('Cargo que tera acesso administrativo')
    .setRequired(true)))
    .addSubcommand(subcommand => subcommand
    .setName('admin-remover')
    .setDescription('Remove acesso administrativo de um cargo')
    .addRoleOption(option => option
    .setName('cargo')
    .setDescription('Cargo que perdera acesso administrativo')
    .setRequired(true)))
    .addSubcommand(subcommand => subcommand
    .setName('admin-listar')
    .setDescription('Lista cargos com acesso administrativo ao bot'));
async function execute(interaction) {
    const guildId = interaction.guildId;
    if (!guildId) {
        await interaction.reply({
            embeds: [(0, embeds_1.createErrorEmbed)('Este comando so pode ser usado em servidores.')],
            flags: 64,
        });
        return;
    }
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'admin-listar') {
        await handleListar(interaction, guildId);
        return;
    }
    const role = interaction.options.getRole('cargo', true);
    if (subcommand === 'admin-adicionar') {
        await permissions_1.guildPermissionService.addAdminRole(guildId, role.id);
        await interaction.reply({
            embeds: [(0, embeds_1.createSuccessEmbed)(`Cargo **${role.name}** agora pode usar comandos administrativos do bot.`)],
            flags: 64,
        });
        return;
    }
    await permissions_1.guildPermissionService.removeAdminRole(guildId, role.id);
    await interaction.reply({
        embeds: [(0, embeds_1.createSuccessEmbed)(`Cargo **${role.name}** removido da lista administrativa do bot.`)],
        flags: 64,
    });
}
async function handleListar(interaction, guildId) {
    const roleIds = await permissions_1.guildPermissionService.listAdminRoleIds(guildId);
    if (roleIds.length === 0) {
        await interaction.reply({
            embeds: [(0, embeds_1.createErrorEmbed)('Nenhum cargo administrativo configurado. Membros com Gerenciar Servidor ainda podem administrar o bot.')],
            flags: 64,
        });
        return;
    }
    const roles = roleIds.map(roleId => `<@&${roleId}>`).join('\n');
    await interaction.reply({
        embeds: [(0, embeds_1.createSuccessEmbed)(`Cargos administrativos configurados:\n\n${roles}`)],
        flags: 64,
    });
}
//# sourceMappingURL=configurar-bot.js.map