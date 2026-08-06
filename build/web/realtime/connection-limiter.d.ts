export interface ConnectionLimiterOptions {
    maxPerKey: number;
    maxTotal: number;
}
export declare function createConnectionLimiter(options: ConnectionLimiterOptions): {
    acquire(key: string): (() => void) | null;
    activeCount(): number;
};
//# sourceMappingURL=connection-limiter.d.ts.map