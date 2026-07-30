import { Events, Interaction } from 'discord.js';
import { handleBanSelection } from '../systems/veto';

export const name = Events.InteractionCreate;
export const once = false;

export async function execute(interaction: Interaction) {
  if (interaction.isStringSelectMenu()) {
    const [action, confrontoId] = interaction.customId.split(':');

    if (action === 'killer-ban') {
      await handleBanSelection(interaction, Number(confrontoId));
    }
  }
}
