interface DisabledPanelConfig {
    enabled: false;
}
export interface EnabledPanelConfig {
    enabled: true;
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    cookieSecret: string;
    encryptionKey: Buffer;
    port: number;
    isProduction: boolean;
}
export type PanelConfig = DisabledPanelConfig | EnabledPanelConfig;
export declare function readPanelConfig(environment?: Readonly<Record<string, string | undefined>>): PanelConfig;
export {};
//# sourceMappingURL=config.d.ts.map