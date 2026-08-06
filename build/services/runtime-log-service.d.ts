export interface RuntimeLogSnapshot {
    readonly source: 'discloud' | 'runtime';
    readonly content: string;
    readonly fetchedAt: string;
    readonly isExactDiscloudSnapshot: boolean;
}
export declare const runtimeLogService: {
    getSnapshot(): Promise<RuntimeLogSnapshot>;
};
//# sourceMappingURL=runtime-log-service.d.ts.map