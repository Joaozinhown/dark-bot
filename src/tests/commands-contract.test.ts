import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { data as configurarBot } from '../commands/configurar-bot';
import { data as criarConfronto } from '../commands/criar-confronto';
import { data as encerrar } from '../commands/encerrar';
import { data as gerenciarCargo } from '../commands/gerenciar-cargo';
import { data as gerenciarPool } from '../commands/gerenciar-pool';
import { data as listarConfrontos } from '../commands/listar-confrontos';
import { data as perfil } from '../commands/perfil';
import { data as ranking } from '../commands/ranking';
import { data as relatorios } from '../commands/relatorios';
import { data as resultado } from '../commands/resultado';
import { data as setupCargo } from '../commands/setup-cargo';

const EXPECTED_COMMAND_NAMES = [
  'configurar-bot',
  'criar-confronto',
  'encerrar',
  'gerenciar-cargo',
  'gerenciar-pool',
  'listar-confrontos',
  'perfil',
  'ranking',
  'relatorios',
  'resultado',
  'setup-cargo',
];

const EXPECTED_PAYLOAD_HASH = 'ecbbee64ff8824d1d781391f08f6b653405542772a432096a21955361d1a393f';

const commandPayloads = [
  configurarBot,
  criarConfronto,
  encerrar,
  gerenciarCargo,
  gerenciarPool,
  listarConfrontos,
  perfil,
  ranking,
  relatorios,
  resultado,
  setupCargo,
]
  .map(command => command.toJSON())
  .sort((left, right) => left.name.localeCompare(right.name));

test('keeps the current slash command catalog unchanged', () => {
  assert.deepEqual(
    commandPayloads.map(command => command.name),
    EXPECTED_COMMAND_NAMES,
  );
});

test('keeps slash command descriptions, options and permissions unchanged', () => {
  const payloadHash = createHash('sha256')
    .update(JSON.stringify(commandPayloads))
    .digest('hex');

  assert.equal(payloadHash, EXPECTED_PAYLOAD_HASH);
});

test('deploy artifact contains only the approved slash command catalog', () => {
  const commandsDirectory = path.resolve(__dirname, '..', 'commands');
  const deployedNames = readdirSync(commandsDirectory)
    .filter(file => file.endsWith('.js'))
    .map(file => require(path.join(commandsDirectory, file)) as {
      data?: { toJSON(): { name?: string } };
    })
    .map(command => command.data?.toJSON().name)
    .filter((name): name is string => Boolean(name))
    .sort((left, right) => left.localeCompare(right));

  assert.deepEqual(deployedNames, EXPECTED_COMMAND_NAMES);
});
