import { Guild, StringSelectMenuInteraction, TextChannel } from 'discord.js';
import { PoolConfig, VetoVez } from '../types/index';
export declare function startVeto(guild: Guild, confrontoId: number, poolConfig: PoolConfig, primeiroKiller: VetoVez, canalTexto: TextChannel): Promise<void>;
export declare function handleBanSelection(interaction: StringSelectMenuInteraction, confrontoId: number): Promise<void>;
//# sourceMappingURL=veto.d.ts.map