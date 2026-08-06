"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = __importDefault(require("node:test"));
const connection_limiter_1 = require("./connection-limiter");
(0, node_test_1.default)('limits connections per session and guild', () => {
    const limiter = (0, connection_limiter_1.createConnectionLimiter)({ maxPerKey: 2, maxTotal: 10 });
    const first = limiter.acquire('session-a:guild-a');
    const second = limiter.acquire('session-a:guild-a');
    strict_1.default.ok(first);
    strict_1.default.ok(second);
    strict_1.default.equal(limiter.acquire('session-a:guild-a'), null);
    strict_1.default.ok(limiter.acquire('session-a:guild-b'));
});
(0, node_test_1.default)('limits total connections and releases a slot once', () => {
    const limiter = (0, connection_limiter_1.createConnectionLimiter)({ maxPerKey: 2, maxTotal: 2 });
    const releaseFirst = limiter.acquire('first');
    const releaseSecond = limiter.acquire('second');
    strict_1.default.ok(releaseFirst);
    strict_1.default.ok(releaseSecond);
    strict_1.default.equal(limiter.acquire('third'), null);
    releaseFirst();
    releaseFirst();
    strict_1.default.ok(limiter.acquire('third'));
    strict_1.default.equal(limiter.activeCount(), 2);
});
//# sourceMappingURL=connection-limiter.test.js.map