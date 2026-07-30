import type { EnabledPanelConfig, PanelConfig } from './config';

export interface SafePanelConfigOptions {
  readConfig(): PanelConfig;
  reportConfigError(error: unknown): void;
}

export function readPanelConfigSafely(options: SafePanelConfigOptions): PanelConfig {
  try {
    return options.readConfig();
  } catch (error: unknown) {
    options.reportConfigError(error);
    return { enabled: false };
  }
}

export interface PanelStartupOptions {
  config: PanelConfig;
  startPanel(config: EnabledPanelConfig): Promise<unknown>;
  startBot(): Promise<void>;
  reportPanelError(error: unknown): void;
}

export async function runPanelBeforeBot(options: PanelStartupOptions): Promise<void> {
  if (options.config.enabled) {
    try {
      await options.startPanel(options.config);
    } catch (error: unknown) {
      options.reportPanelError(error);
    }
  }

  await options.startBot();
}
