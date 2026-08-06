import type { EnabledPanelConfig, PanelConfig } from './config';
export interface SafePanelConfigOptions {
    readConfig(): PanelConfig;
    reportConfigError(error: unknown): void;
}
export declare function readPanelConfigSafely(options: SafePanelConfigOptions): PanelConfig;
export interface PanelStartupOptions {
    config: PanelConfig;
    startPanel(config: EnabledPanelConfig): Promise<unknown>;
    startBot(): Promise<void>;
    reportPanelError(error: unknown): void;
}
export declare function runPanelBeforeBot(options: PanelStartupOptions): Promise<void>;
//# sourceMappingURL=startup.d.ts.map