"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runtimeLogService = void 0;
const promises_1 = require("node:fs/promises");
const node_os_1 = require("node:os");
const node_path_1 = require("node:path");
const MAX_RETURNED_CHARACTERS = 300_000;
const DISCLOUD_API_BASE = 'https://api.discloud.app/v2';
function tail(value) {
    return value.length <= MAX_RETURNED_CHARACTERS
        ? value
        : value.slice(value.length - MAX_RETURNED_CHARACTERS);
}
function readAppIdFromConfig(value) {
    const match = value.match(/^ID\s*=\s*([^\r\n]+)$/m);
    return match?.[1]?.trim() || null;
}
async function resolveAppId() {
    const configured = process.env.DISCLOUD_APP_ID?.trim();
    if (configured)
        return configured;
    try {
        return readAppIdFromConfig(await (0, promises_1.readFile)((0, node_path_1.join)(process.cwd(), 'discloud.config'), 'utf8'));
    }
    catch {
        return null;
    }
}
async function fetchDiscloudLogs(token, appId) {
    const response = await fetch(`${DISCLOUD_API_BASE}/app/${encodeURIComponent(appId)}/logs`, {
        headers: { 'api-token': token, Accept: 'application/json' },
        signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok)
        throw new Error(`Discloud API respondeu ${response.status}.`);
    const payload = await response.json();
    const app = Array.isArray(payload.apps) ? payload.apps[0] : payload.apps;
    if (typeof app?.terminal?.big !== 'string')
        throw new Error('Discloud API nao retornou terminal.big.');
    return app.terminal.big;
}
async function readRuntimeLogs() {
    const path = process.env.DTA_RUNTIME_LOG_PATH || (0, node_path_1.join)((0, node_os_1.tmpdir)(), 'dark-bot-runtime.log');
    try {
        return await (0, promises_1.readFile)(path, 'utf8');
    }
    catch {
        return '[Logs] O espelho do processo ainda nao possui dados.\n';
    }
}
exports.runtimeLogService = {
    async getSnapshot() {
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
            }
            catch (error) {
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
//# sourceMappingURL=runtime-log-service.js.map