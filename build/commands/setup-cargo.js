"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.data = void 0;
exports.execute = execute;
const discord_js_1 = require("discord.js");
const embeds_1 = require("../utils/embeds");
const role_service_1 = require("../services/role-service");
exports.data = new discord_js_1.SlashCommandBuilder()
    .setName('setup-cargo')
    .setDescription('Configura um cargo de time para o evento')
    .setDMPermission(false)
    .addStringOption(option => option
    .setName('nome-time')
    .setDescription('Nome do time')
    .setRequired(true))
    .addStringOption(option => option
    .setName('cor')
    .setDescription('Cor em hex (ex: #FF0000)')
    .setRequired(false));
async function execute(interaction) {
    const nomeTime = interaction.options.getString('nome-time', true);
    const corHex = interaction.options.getString('cor');
    const color = (0, role_service_1.parseTeamRoleColor)(corHex);
    if (color === null) {
        await interaction.reply({
            embeds: [(0, embeds_1.createErrorEmbed)('Cor hex invalida. Use o formato #RRGGBB.')],
            flags: 64,
        });
        return;
    }
    await interaction.deferReply();
    const cargo = await (0, role_service_1.createTeamRole)(interaction.guild.roles, {
        name: nomeTime,
        color,
        createdBy: interaction.user.displayName,
    });
    const embed = (0, embeds_1.createSuccessEmbed)(`Cargo **${cargo.name}** criado com sucesso!\n\nAdicione membros ao cargo para configurar o time.`);
    await interaction.editReply({
        embeds: [embed],
    });
}
//# sourceMappingURL=setup-cargo.js.map