"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = __importDefault(require("node:test"));
const event_bus_1 = require("./event-bus");
(0, node_test_1.default)('publishes events only to subscribers of the same guild', () => {
    const bus = (0, event_bus_1.createGuildEventBus)();
    const guildA = [];
    const guildB = [];
    const unsubscribe = bus.subscribe('guild-a', event => guildA.push(event));
    bus.subscribe('guild-b', event => guildB.push(event));
    bus.publish('guild-a', 'pool.updated', { poolId: 4 });
    unsubscribe();
    bus.publish('guild-a', 'pool.updated', { poolId: 5 });
    strict_1.default.equal(guildA.length, 1);
    strict_1.default.equal(guildB.length, 0);
    strict_1.default.deepEqual(guildA[0], {
        id: 1,
        guildId: 'guild-a',
        type: 'pool.updated',
        data: { poolId: 4 },
    });
});
(0, node_test_1.default)('uses a separate monotonic sequence for each guild', () => {
    const bus = (0, event_bus_1.createGuildEventBus)();
    const events = [];
    bus.subscribe('guild-a', event => events.push(event));
    bus.publish('guild-a', 'one', {});
    bus.publish('guild-b', 'ignored', {});
    bus.publish('guild-a', 'two', {});
    strict_1.default.deepEqual(events.map(event => event.id), [1, 2]);
});
(0, node_test_1.default)('isolates a failed subscriber from the publisher and other subscribers', () => {
    const bus = (0, event_bus_1.createGuildEventBus)();
    const received = [];
    bus.subscribe('guild-a', () => { throw new Error('socket closed'); });
    bus.subscribe('guild-a', event => received.push(event.type));
    strict_1.default.doesNotThrow(() => bus.publish('guild-a', 'command.executed', {}));
    strict_1.default.deepEqual(received, ['command.executed']);
});
//# sourceMappingURL=event-bus.test.js.map