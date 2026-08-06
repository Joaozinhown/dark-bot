export interface ReportSummary {
    totalConfrontos: number;
    confrontosAtivos: number;
    confrontosEncerrados: number;
    jogadores: number;
    poolsAtivas: number;
}
export interface RecentConfrontation {
    id: number;
    formato: string;
    status: string;
    timeAVitorias: number;
    timeBVitorias: number;
    criadoEm: Date;
}
export interface PoolReport {
    id: number;
    nome: string;
    formato: string;
    ativa: boolean;
    mapas: number;
    killers: number;
    confrontos: number;
}
export interface RankingConfrontation {
    timeARoleId: string;
    timeBRoleId: string;
    vencedor: 'A' | 'B' | null;
}
export interface RankingEntry {
    nome: string;
    vitorias: number;
    derrotas: number;
}
export type RoleNameResolver = (roleId: string) => Promise<string | null>;
export interface ReportStore {
    getSummary(guildId: string): Promise<ReportSummary>;
    listRecentConfrontations(guildId: string): Promise<RecentConfrontation[]>;
    listPoolReports(guildId: string): Promise<PoolReport[]>;
    listCompletedConfrontations(guildId: string): Promise<RankingConfrontation[]>;
}
export declare function aggregateRanking(confrontations: readonly RankingConfrontation[], roleNames: ReadonlyMap<string, string>): RankingEntry[];
export declare function createReportService(store: ReportStore): {
    getSummary(guildId: string): Promise<ReportSummary>;
    listRecentConfrontations(guildId: string): Promise<RecentConfrontation[]>;
    listPoolReports(guildId: string): Promise<PoolReport[]>;
    getRanking(guildId: string, resolveRoleName: RoleNameResolver): Promise<RankingEntry[]>;
};
export declare const prismaReportStore: ReportStore;
export declare const reportService: {
    getSummary(guildId: string): Promise<ReportSummary>;
    listRecentConfrontations(guildId: string): Promise<RecentConfrontation[]>;
    listPoolReports(guildId: string): Promise<PoolReport[]>;
    getRanking(guildId: string, resolveRoleName: RoleNameResolver): Promise<RankingEntry[]>;
};
//# sourceMappingURL=report-service.d.ts.map