"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = __importDefault(require("node:test"));
const config_1 = require("./config");
const validEnvironment = {
    ADMIN_PANEL_ENABLED: 'true',
    CLIENT_ID: '123456789012345678',
    DISCORD_CLIENT_SECRET: 'discord-secret',
    DISCORD_REDIRECT_URI: 'https://admin-dta-bot.discloud.app/api/auth/callback',
    PANEL_COOKIE_SECRET: 'a'.repeat(32),
    PANEL_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
    PORT: '8080',
};
(0, node_test_1.default)('keeps panel disabled without requiring new environment variables', () => {
    strict_1.default.deepEqual((0, config_1.readPanelConfig)({}), { enabled: false });
});
(0, node_test_1.default)('parses a complete enabled panel configuration', () => {
    const config = (0, config_1.readPanelConfig)(validEnvironment);
    strict_1.default.equal(config.enabled, true);
    if (!config.enabled)
        return;
    strict_1.default.equal(config.port, 8080);
    strict_1.default.equal(config.isProduction, true);
    strict_1.default.equal(config.encryptionKey.length, 32);
});
(0, node_test_1.default)('rejects incomplete, weak, or invalid enabled configuration', () => {
    strict_1.default.throws(() => (0, config_1.readPanelConfig)({ ...validEnvironment, PANEL_COOKIE_SECRET: 'short' }), /PANEL_COOKIE_SECRET/i);
    strict_1.default.throws(() => (0, config_1.readPanelConfig)({ ...validEnvironment, PANEL_ENCRYPTION_KEY: 'not-base64' }), /PANEL_ENCRYPTION_KEY/i);
    strict_1.default.throws(() => (0, config_1.readPanelConfig)({ ...validEnvironment, DISCORD_REDIRECT_URI: 'http://remote.example.com/callback' }), /DISCORD_REDIRECT_URI/i);
});
(0, node_test_1.default)('allows an HTTP redirect only on loopback for local development', () => {
    const config = (0, config_1.readPanelConfig)({
        ...validEnvironment,
        DISCORD_REDIRECT_URI: 'http://127.0.0.1:8080/api/auth/callback',
    });
    strict_1.default.equal(config.enabled, true);
    if (config.enabled)
        strict_1.default.equal(config.isProduction, false);
});
(0, node_test_1.default)('rejects an unapproved HTTPS redirect in production', () => {
    strict_1.default.throws(() => (0, config_1.readPanelConfig)({
        ...validEnvironment,
        DISCORD_REDIRECT_URI: 'https://dta-admin.discloud.app/api/auth/callback',
        NODE_ENV: 'production',
    }), /DISCORD_REDIRECT_URI/i);
    strict_1.default.throws(() => (0, config_1.readPanelConfig)({
        ...validEnvironment,
        DISCORD_REDIRECT_URI: 'https://admin-dta-bot.discloud.app/api/auth/callback?next=invalid',
        NODE_ENV: 'production',
    }), /DISCORD_REDIRECT_URI/i);
});
//# sourceMappingURL=config.test.js.map