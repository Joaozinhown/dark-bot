import assert from 'node:assert/strict';
import test from 'node:test';
import { scriptAccessService } from './script-access';

test('script access management remains restricted to owner or Manage Guild', async () => {
  assert.equal(scriptAccessService.canManageConfig({
    guildId: '1', userId: '2', roleIds: [], isGuildOwner: false, hasManageGuild: false,
  }), false);
  assert.equal(scriptAccessService.canManageConfig({
    guildId: '1', userId: '2', roleIds: [], isGuildOwner: true, hasManageGuild: false,
  }), true);
});
