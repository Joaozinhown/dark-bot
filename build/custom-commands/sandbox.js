"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runSandboxScript = runSandboxScript;
const quickjs_emscripten_1 = require("quickjs-emscripten");
const definition_1 = require("./definition");
const MEMORY_LIMIT_BYTES = 8 * 1024 * 1024;
const STACK_LIMIT_BYTES = 512 * 1024;
const CPU_LIMIT_MS = 200;
const MAX_LOG_ENTRIES = 50;
function localized(value) {
    if (typeof value === 'string')
        return { ptBR: value, enUS: value };
    if (!value || typeof value !== 'object')
        return undefined;
    const record = value;
    if (typeof record.ptBR !== 'string' || typeof record.enUS !== 'string')
        return undefined;
    return { ptBR: record.ptBR, enUS: record.enUS };
}
function normalizeMessage(value) {
    if (typeof value === 'string') {
        return { content: localized(value), ephemeral: false, embeds: [], components: [] };
    }
    if (!value || typeof value !== 'object') {
        throw new Error('Mensagem da sandbox precisa ser texto ou objeto.');
    }
    const record = value;
    return {
        ...(record.content === undefined ? {} : { content: localized(record.content) }),
        ephemeral: record.ephemeral === true,
        embeds: Array.isArray(record.embeds) ? record.embeds : [],
        components: Array.isArray(record.components) ? record.components : [],
    };
}
function readRecord(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('Argumento da sandbox precisa ser objeto.');
    }
    return value;
}
function readRequiredString(record, key) {
    const value = record[key];
    if (typeof value !== 'string' || !value.trim())
        throw new Error(`${key} obrigatorio.`);
    return value;
}
function stringifyLog(value) {
    if (typeof value === 'string')
        return value.slice(0, 1000);
    try {
        return JSON.stringify(value).slice(0, 1000);
    }
    catch {
        return String(value).slice(0, 1000);
    }
}
async function runSandboxScript(code, sandboxContext) {
    const QuickJS = await (0, quickjs_emscripten_1.getQuickJS)();
    const runtime = QuickJS.newRuntime();
    runtime.setMemoryLimit(MEMORY_LIMIT_BYTES);
    runtime.setMaxStackSize(STACK_LIMIT_BYTES);
    runtime.setInterruptHandler((0, quickjs_emscripten_1.shouldInterruptAfterDeadline)(Date.now() + CPU_LIMIT_MS));
    const context = runtime.newContext();
    const workflow = [];
    const logs = [];
    const handles = [];
    let sequence = 0;
    const nextId = (prefix) => `script_${prefix}_${++sequence}`;
    const expose = (name, callback) => {
        const handle = context.newFunction(name, (...args) => {
            callback(args.length ? context.dump(args[0]) : undefined);
            return context.undefined;
        });
        handles.push(handle);
        return handle;
    };
    try {
        const discord = context.newObject();
        handles.push(discord);
        context.setProp(discord, 'reply', expose('reply', value => {
            workflow.push({ id: nextId('reply'), type: 'reply', message: normalizeMessage(value) });
        }));
        context.setProp(discord, 'followup', expose('followup', value => {
            workflow.push({ id: nextId('followup'), type: 'followup', message: normalizeMessage(value) });
        }));
        context.setProp(discord, 'sendMessage', expose('sendMessage', value => {
            const record = readRecord(value);
            workflow.push({
                id: nextId('send'),
                type: 'send_message',
                channelId: readRequiredString(record, 'channelId'),
                message: normalizeMessage(record.message),
            });
        }));
        context.setProp(discord, 'addRole', expose('addRole', value => {
            const record = readRecord(value);
            workflow.push({
                id: nextId('role'),
                type: 'add_role',
                userId: readRequiredString(record, 'userId'),
                roleId: readRequiredString(record, 'roleId'),
            });
        }));
        context.setProp(discord, 'removeRole', expose('removeRole', value => {
            const record = readRecord(value);
            workflow.push({
                id: nextId('role'),
                type: 'remove_role',
                userId: readRequiredString(record, 'userId'),
                roleId: readRequiredString(record, 'roleId'),
            });
        }));
        context.setProp(discord, 'setVariable', expose('setVariable', value => {
            const record = readRecord(value);
            workflow.push({
                id: nextId('variable'),
                type: 'set_variable',
                name: readRequiredString(record, 'name'),
                value: readRequiredString(record, 'value'),
            });
        }));
        context.setProp(context.global, 'discord', discord);
        const consoleObject = context.newObject();
        handles.push(consoleObject);
        context.setProp(consoleObject, 'log', expose('log', value => {
            if (logs.length < MAX_LOG_ENTRIES)
                logs.push(stringifyLog(value));
        }));
        context.setProp(context.global, 'console', consoleObject);
        const serializedContext = JSON.stringify(sandboxContext).replaceAll('<', '\\u003c');
        const bootstrap = `
      globalThis.process = undefined;
      globalThis.require = undefined;
      globalThis.fetch = undefined;
      globalThis.WebSocket = undefined;
      globalThis.Function = undefined;
      globalThis.eval = undefined;
      globalThis.context = Object.freeze(JSON.parse(${JSON.stringify(serializedContext)}));
      Object.freeze(globalThis.discord);
      (function () { "use strict"; ${code}\n})();
    `;
        const result = context.evalCode(bootstrap, 'command-script.js');
        if (result.error) {
            const dumped = context.dump(result.error);
            result.error.dispose();
            throw new Error(`Script recusado pela sandbox: ${stringifyLog(dumped)}`);
        }
        result.value.dispose();
        return { workflow: (0, definition_1.parseWorkflow)(workflow), logs };
    }
    finally {
        for (const handle of handles.reverse())
            handle.dispose();
        context.dispose();
        runtime.dispose();
    }
}
//# sourceMappingURL=sandbox.js.map