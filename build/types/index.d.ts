import { Role, TextChannel, VoiceChannel } from 'discord.js';
export type PoolFormato = 'MD3' | 'MD5';
export type VencedorTime = 'A' | 'B';
export type VetoTipo = 'mapa' | 'killer';
export type VetoVez = 'A' | 'B';
export interface PoolConfig {
    id: number;
    formato: PoolFormato;
    mapas: string[];
    killers: string[];
}
export interface ConfrontoData {
    id: number;
    guildId: string;
    poolId: number;
    pool?: number;
    formato: PoolFormato;
    timeARoleId: string;
    timeBRoleId: string;
    timeAVitorias: number;
    timeBVitorias: number;
    status: string;
    currentSet: number;
    channelId: string | null;
    vozTimeAId: string | null;
    vozTimeBId: string | null;
    vencedor: VencedorTime | null;
    primeiroKiller: VetoVez | null;
    encerradoEm: Date | null;
    motivoEncerramento: string | null;
    criadoEm: Date;
}
export interface VetoStateData {
    id: number;
    confrontoId: number;
    tipo: VetoTipo;
    set: number;
    vezDe: VetoVez;
    mapasRestantes: string[];
    killersRestantes: string[];
    mapaEscolhido: string | null;
    killerEscolhido: string | null;
    messageId: string | null;
}
export interface ConfrontoContext {
    confronto: ConfrontoData;
    timeA: Role;
    timeB: Role;
    canalTexto: TextChannel;
    vozTimeA: VoiceChannel | null;
    vozTimeB: VoiceChannel | null;
}
export interface VetoInteraction {
    confrontoId: number;
    tipo: VetoTipo;
    vezDe: VetoVez;
    itemAtual: string;
    itensRestantes: string[];
}
//# sourceMappingURL=index.d.ts.map