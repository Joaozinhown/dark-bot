"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.guildEventBus = void 0;
exports.createGuildEventBus = createGuildEventBus;
function createGuildEventBus() {
    const listeners = new Map();
    const sequences = new Map();
    return {
        subscribe(guildId, listener) {
            const guildListeners = listeners.get(guildId) ?? new Set();
            guildListeners.add(listener);
            listeners.set(guildId, guildListeners);
            return () => {
                const current = listeners.get(guildId);
                if (!current)
                    return;
                current.delete(listener);
                if (current.size === 0)
                    listeners.delete(guildId);
            };
        },
        publish(guildId, type, data) {
            const id = (sequences.get(guildId) ?? 0) + 1;
            sequences.set(guildId, id);
            const event = { id, guildId, type, data };
            for (const listener of listeners.get(guildId) ?? []) {
                try {
                    listener(event);
                }
                catch {
                    // A disconnected subscriber cannot interrupt the bot operation that published the event.
                }
            }
            return event;
        },
    };
}
exports.guildEventBus = createGuildEventBus();
//# sourceMappingURL=event-bus.js.map