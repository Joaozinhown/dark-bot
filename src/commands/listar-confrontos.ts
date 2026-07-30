import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from 'discord.js';
import { createListarConfrontosEmbed } from '../utils/embeds';
import { ConfrontoData } from '../types/index';
import { PoolFormato } from '../config';
import { confrontationService } from '../services/confrontation-service';

export const data = new SlashCommandBuilder()
  .setName('listar-confrontos')
  .setDescription('Lista confrontos ativos e recentes')
  .setDMPermission(false);

export async function execute(interaction: ChatInputCommandInteraction) {
  const confrontos = await confrontationService.listActive(interaction.guildId!);

  const confrontosData: ConfrontoData[] = confrontos.map(c => ({
    ...c,
    formato: c.formato as PoolFormato,
    vencedor: c.vencedor as 'A' | 'B' | null,
    primeiroKiller: c.primeiroKiller as 'A' | 'B' | null,
  }));

  const embed = createListarConfrontosEmbed(confrontosData);

  await interaction.reply({
    embeds: [embed],
    flags: 64,
  });
}
