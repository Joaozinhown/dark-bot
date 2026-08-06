import { PoolConfig, PoolFormato } from './types/index';
export type { PoolFormato } from './types/index';
export declare const COLORS: {
    readonly primary: "#0a0a14";
    readonly secondary: "#1a1a2e";
    readonly accent: "#dc143c";
    readonly gold: "#c9a227";
    readonly success: "#2ecc71";
    readonly warning: "#f39c12";
    readonly error: "#e74c3c";
    readonly neutral: "#95a5a6";
    readonly text: "#ffffff";
    readonly textMuted: "#b9bbbe";
};
export declare const EMOJIS: {
    readonly ban: "X";
    readonly check: "OK";
    readonly vs: "VS";
};
export declare function getPoolById(id: number, guildId: string): Promise<PoolConfig | null>;
export declare function getPoolsAtivas(guildId: string): Promise<PoolConfig[]>;
export declare function getVitoriasNecessarias(formato: PoolFormato): number;
export declare function getSetsMaximos(formato: PoolFormato): number;
//# sourceMappingURL=config.d.ts.map