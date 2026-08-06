"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteConfrontoVoiceChannels = deleteConfrontoVoiceChannels;
async function deleteConfrontoVoiceChannels(guild, vozTimeAId, vozTimeBId) {
    const channelsToDelete = [vozTimeAId, vozTimeBId].filter((id) => id !== null);
    for (const channelId of channelsToDelete) {
        try {
            const channel = await guild.channels.fetch(channelId);
            if (channel) {
                await channel.delete();
            }
        }
        catch (error) {
            console.error(`[Channels] Erro ao deletar canal ${channelId}:`, error);
        }
    }
}
//# sourceMappingURL=channels.js.map