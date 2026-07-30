import { z } from 'zod';

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

const PRODUCTION_REDIRECT_URI = 'https://admin-dta-bot.discloud.app/api/auth/callback';

const enabledConfigSchema = z.object({
  CLIENT_ID: z.string().regex(/^\d{16,22}$/),
  DISCORD_CLIENT_SECRET: z.string().min(1),
  DISCORD_REDIRECT_URI: z.url(),
  PANEL_COOKIE_SECRET: z.string().min(32),
  PANEL_ENCRYPTION_KEY: z.string().min(1),
  PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  NODE_ENV: z.string().optional(),
});

function isSecureRedirect(value: string): boolean {
  const redirect = new URL(value);
  const isLoopback = ['localhost', '127.0.0.1', '[::1]'].includes(redirect.hostname);
  return redirect.protocol === 'https:' || (redirect.protocol === 'http:' && isLoopback);
}

export function readPanelConfig(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): PanelConfig {
  if (environment.ADMIN_PANEL_ENABLED !== 'true') return { enabled: false };

  const parsed = enabledConfigSchema.safeParse(environment);
  if (!parsed.success) {
    const fields = [...new Set(parsed.error.issues.map(issue => issue.path.join('.')))].join(', ');
    throw new Error(`Configuracao do painel invalida: ${fields}`);
  }
  if (!isSecureRedirect(parsed.data.DISCORD_REDIRECT_URI)) {
    throw new Error('DISCORD_REDIRECT_URI deve usar HTTPS ou loopback HTTP.');
  }

  const isProduction = parsed.data.NODE_ENV === 'production'
    || new URL(parsed.data.DISCORD_REDIRECT_URI).protocol === 'https:';
  if (isProduction && parsed.data.DISCORD_REDIRECT_URI !== PRODUCTION_REDIRECT_URI) {
    throw new Error(`DISCORD_REDIRECT_URI deve ser ${PRODUCTION_REDIRECT_URI} em producao.`);
  }

  const encryptionKey = Buffer.from(parsed.data.PANEL_ENCRYPTION_KEY, 'base64');
  if (encryptionKey.length !== 32 || encryptionKey.toString('base64') !== parsed.data.PANEL_ENCRYPTION_KEY) {
    throw new Error('PANEL_ENCRYPTION_KEY deve ser base64 de exatamente 32 bytes.');
  }

  return {
    enabled: true,
    clientId: parsed.data.CLIENT_ID,
    clientSecret: parsed.data.DISCORD_CLIENT_SECRET,
    redirectUri: parsed.data.DISCORD_REDIRECT_URI,
    cookieSecret: parsed.data.PANEL_COOKIE_SECRET,
    encryptionKey,
    port: parsed.data.PORT,
    isProduction,
  };
}
