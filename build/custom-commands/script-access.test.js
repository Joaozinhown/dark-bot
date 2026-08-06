"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = __importDefault(require("node:test"));
const script_access_1 = require("./script-access");
(0, node_test_1.default)('script access management remains restricted to owner or Manage Guild', async () => {
    strict_1.default.equal(script_access_1.scriptAccessService.canManageConfig({
        guildId: '1', userId: '2', roleIds: [], isGuildOwner: false, hasManageGuild: false,
    }), false);
    strict_1.default.equal(script_access_1.scriptAccessService.canManageConfig({
        guildId: '1', userId: '2', roleIds: [], isGuildOwner: true, hasManageGuild: false,
    }), true);
});
//# sourceMappingURL=script-access.test.js.map