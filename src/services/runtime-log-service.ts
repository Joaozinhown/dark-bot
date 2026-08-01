import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const MAX_RETURNED_CHARACTERS = 300_000;
const DISCLOUD_API_BASE = 'https://api.discloud.app/v2';

export interface RuntimeLogSnapshot {
  readonly source: 'discloud' | 'runtime';
  readonly content: string;
  readonly fetchedAt: string;
  readonly isExactDiscloudSnapshot: boolean;
}

function tail(value: string): string {
  return value.length <= MAX_RETURNED_CHARACTERS
    ? value
    : value.slice(value.length - MAX_RETURNED_CHARACTERS);
}

function readAppIdFromConfig(value: string): string | null {
  const match = value.match(/^ID\s*=\s*([^\r\n]+)$/m);
  return match?.[1]?.trim() || null;
}

async function resolveAppId(): Promise<string | null> {
  const configured = process.env.DISCLOUD_APP_ID?.trim();
  if (configured) return configured;
  try {
    return readAppIdFromConfig(await readFile(join(process.cwd(), 'discloud.config'), 'utf8'));
  } catch {
    return null;
  }
}

async function fetchDiscloudLogs(token: string, appId: string): Promise<string> {
  const response = await fetch(`${DISCLOUD_API_BASE}/app/${encodeURIComponent(appId)}/logs`, {
    headers: { 'api-token': token, Accept: 'application/json' },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`Discloud API respondeu ${response.status}.`);
  const payload = await response.json() as {
    apps?: { terminal?: { big?: string } } | Array<{ terminal?: { big?: string } }>;
  };
  const app = Array.isArray(payload.apps) ? payload.apps[0] : payload.apps;
  if (typeof app?.terminal?.big !== 'string') throw new Error('Discloud API nao retornou terminal.big.');
  return app.terminal.big;
}

async function readRuntimeLogs(): Promise<string> {
  const path = process.env.DTA_RUNTIME_LOG_PATH || join(tmpdir(), 'dark-bot-runtime.log');
  try {
    return await readFile(path, 'utf8');
  } catch {
    return '[Logs] O espelho do processo ainda nao possui dados.\n';
  }
}

export const runtimeLogService = {
  async getSnapshot(): Promise<RuntimeLogSnapshot> {
    const token = process.env.DISCLOUD_TOKEN?.trim();
    const appId = await resolveAppId();
    if (token && appId) {
      try {
        return {
          source: 'discloud',
          content: tail(await fetchDiscloudLogs(token, appId)),
          fetchedAt: new Date().toISOString(),
          isExactDiscloudSnapshot: true,
        };
      } catch (error: unknown) {
        console.warn(`[Logs] Falha ao consultar Discloud; usando espelho local: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    return {
      source: 'runtime',
      content: tail(await readRuntimeLogs()),
      fetchedAt: new Date().toISOString(),
      isExactDiscloudSnapshot: false,
    };
  },
};
