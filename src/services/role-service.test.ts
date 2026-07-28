import assert from 'node:assert/strict';
import test from 'node:test';
import { Colors } from 'discord.js';
import {
  addMemberToTeamRole,
  createTeamRole,
  deleteTeamRole,
  parseTeamRoleColor,
  removeMemberFromTeamRole,
  renameTeamRole,
  type EditableRole,
  type MemberRoleEditor,
} from './role-service';

test('rejects an invalid hexadecimal role color', () => {
  assert.equal(parseTeamRoleColor('#GG0000'), null);
  assert.equal(parseTeamRoleColor('#12345'), null);
  assert.equal(parseTeamRoleColor('#1234567'), null);
});

test('parses a valid role color and defaults when omitted', () => {
  assert.equal(parseTeamRoleColor('#FF0000'), 0xff0000);
  assert.equal(parseTeamRoleColor('00ff7f'), 0x00ff7f);
  assert.equal(parseTeamRoleColor(null), Colors.Default);
});

test('creates a role with the discord.js colors payload', async () => {
  let received: unknown;

  const role = await createTeamRole(
    {
      async create(options) {
        received = options;
        return { id: 'role-1', name: options.name };
      },
    },
    {
      name: 'Time A',
      color: 0x8f32d9,
      createdBy: 'Organizador',
    },
  );

  assert.deepEqual(received, {
    name: 'Time A',
    colors: { primaryColor: 0x8f32d9 },
    reason: 'Cargo de time criado por Organizador',
  });
  assert.deepEqual(role, { id: 'role-1', name: 'Time A' });
});

test('renames and deletes a role with the current audit reason', async () => {
  const calls: Array<[string, string]> = [];
  const role: EditableRole = {
    name: 'Time A',
    async setName(name) {
      calls.push(['rename', name]);
    },
    async delete(reason) {
      calls.push(['delete', reason]);
    },
  };

  await renameTeamRole(role, 'Time B');
  await deleteTeamRole(role);

  assert.deepEqual(calls, [
    ['rename', 'Time B'],
    ['delete', 'Deletado por organizador'],
  ]);
});

test('adds and removes a member role by id', async () => {
  const calls: Array<[string, string]> = [];
  const memberRoles: MemberRoleEditor = {
    async add(roleId) {
      calls.push(['add', roleId]);
    },
    async remove(roleId) {
      calls.push(['remove', roleId]);
    },
  };

  await addMemberToTeamRole(memberRoles, 'role-1');
  await removeMemberFromTeamRole(memberRoles, 'role-1');

  assert.deepEqual(calls, [
    ['add', 'role-1'],
    ['remove', 'role-1'],
  ]);
});
