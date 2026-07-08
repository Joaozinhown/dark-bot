import { Events, Interaction } from 'discord.js';
import { handleBanButton } from '../systems/veto';

export const name = Events.InteractionCreate;
export const once = false;

export function execute(interaction: Interaction) {
  if (interaction.isButton()) {
    const [action, confrontoId, tipo] = interaction.customId.split(':');

    if (action === 'ban') {
      handleBanButton(interaction, Number(confrontoId), tipo);
    }
  }
}
