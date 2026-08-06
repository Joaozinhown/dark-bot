"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_crypto_1 = require("node:crypto");
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const node_test_1 = __importDefault(require("node:test"));
const configurar_bot_1 = require("../commands/configurar-bot");
const criar_confronto_1 = require("../commands/criar-confronto");
const encerrar_1 = require("../commands/encerrar");
const gerenciar_cargo_1 = require("../commands/gerenciar-cargo");
const gerenciar_pool_1 = require("../commands/gerenciar-pool");
const listar_confrontos_1 = require("../commands/listar-confrontos");
const perfil_1 = require("../commands/perfil");
const ranking_1 = require("../commands/ranking");
const relatorios_1 = require("../commands/relatorios");
const resultado_1 = require("../commands/resultado");
const setup_cargo_1 = require("../commands/setup-cargo");
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
    configurar_bot_1.data,
    criar_confronto_1.data,
    encerrar_1.data,
    gerenciar_cargo_1.data,
    gerenciar_pool_1.data,
    listar_confrontos_1.data,
    perfil_1.data,
    ranking_1.data,
    relatorios_1.data,
    resultado_1.data,
    setup_cargo_1.data,
]
    .map(command => command.toJSON())
    .sort((left, right) => left.name.localeCompare(right.name));
(0, node_test_1.default)('keeps the current slash command catalog unchanged', () => {
    strict_1.default.deepEqual(commandPayloads.map(command => command.name), EXPECTED_COMMAND_NAMES);
});
(0, node_test_1.default)('keeps slash command descriptions, options and permissions unchanged', () => {
    const payloadHash = (0, node_crypto_1.createHash)('sha256')
        .update(JSON.stringify(commandPayloads))
        .digest('hex');
    strict_1.default.equal(payloadHash, EXPECTED_PAYLOAD_HASH);
});
(0, node_test_1.default)('deploy artifact contains only the approved slash command catalog', () => {
    const commandsDirectory = node_path_1.default.resolve(__dirname, '..', 'commands');
    const deployedNames = (0, node_fs_1.readdirSync)(commandsDirectory)
        .filter(file => file.endsWith('.js'))
        .map(file => require(node_path_1.default.join(commandsDirectory, file)))
        .map(command => command.data?.toJSON().name)
        .filter((name) => Boolean(name))
        .sort((left, right) => left.localeCompare(right));
    strict_1.default.deepEqual(deployedNames, EXPECTED_COMMAND_NAMES);
});
//# sourceMappingURL=commands-contract.test.js.map