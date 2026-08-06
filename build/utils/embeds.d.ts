import { EmbedBuilder } from 'discord.js';
import { ConfrontoData } from '../types/index';
import { SetAssignment } from '../systems/veto-rules';
export declare function createConfrontoEmbed(confronto: ConfrontoData, timeAName: string, timeBName: string): EmbedBuilder;
export declare function createVetoEmbed(action: string, itensRestantes: string[], timeName: string, isTiebreak?: boolean): EmbedBuilder;
export declare function createBanEmbed(action: string, timeName: string, itemBanido: string, proximoTimeName: string, hasMore: boolean, isTiebreak?: boolean): EmbedBuilder;
export declare function createSetsReadyEmbed(assignments: SetAssignment[], timeAName: string, timeBName: string, timeAPing: string, timeBPing: string): EmbedBuilder;
export declare function createResultadoEmbed(confronto: ConfrontoData, vencedorName: string): EmbedBuilder;
export declare function createEncerramentoEmbed(confrontoId: number, motivo?: string): EmbedBuilder;
export declare function createErrorEmbed(message: string): EmbedBuilder;
export declare function createSuccessEmbed(message: string): EmbedBuilder;
export declare function createListarConfrontosEmbed(confrontos: ConfrontoData[]): EmbedBuilder;
export declare function createRankingEmbed(ranking: Array<{
    nome: string;
    vitorias: number;
    derrotas: number;
}>): EmbedBuilder;
export declare function createPerfilEmbed(nome: string, confrontos: number, vitorias: number, derrotas: number): EmbedBuilder;
//# sourceMappingURL=embeds.d.ts.map