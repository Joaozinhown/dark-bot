import { Code2, Command as CommandIcon, Pencil, Plus, RotateCcw, ShieldCheck, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { AdminDialog, MutationFeedback } from '../components/admin-dialog';
import { CommandEditor } from '../components/command-editor';
import { PageHeader } from '../components/page-header';
import { ScrollableTable } from '../components/scrollable-table';
import { RefreshButton, ResultsCount, SearchField } from '../components/data-tools';
import { EmptyState, ErrorState, LoadingState } from '../components/query-state';
import { StatusBadge } from '../components/status-badge';
import { useGuildContext } from '../context/guild-context';
import { useCommands, useManagement, usePanelAction } from '../hooks/use-panel-data';
import type { Command, PanelAction } from '../types/api';

export function CommandsPage() {
  const { selectedGuildId, guilds } = useGuildContext();
  const query = useCommands(selectedGuildId);
  const management = useManagement(selectedGuildId);
  const action = usePanelAction(selectedGuildId);
  const [search, setSearch] = useState('');
  const [source, setSource] = useState<'all' | 'native' | 'custom'>('all');
  const [editor, setEditor] = useState<Command | 'new' | null>(null);
  const [permissionsOpen, setPermissionsOpen] = useState(false);
  const [scriptRoles, setScriptRoles] = useState<string[]>([]);
  const [scriptUsers, setScriptUsers] = useState('');
  const [success, setSuccess] = useState<string | null>(null);
  const filtered = useMemo(() => (query.data ?? []).filter(command => (
    (source === 'all' || command.sourceType === source)
    && `${command.name} ${command.description}`.toLowerCase().includes(search.toLowerCase())
  )), [query.data, search, source]);

  async function run(panelAction: PanelAction): Promise<unknown> {
    setSuccess(null);
    return action.mutateAsync(panelAction);
  }

  function openPermissions() {
    setScriptRoles(management.data?.scriptRoleIds ?? []);
    setScriptUsers((management.data?.scriptUserIds ?? []).join('\n'));
    setPermissionsOpen(true);
  }

  async function saveScriptPermissions() {
    const userIds = [...new Set(scriptUsers.split(/[\s,]+/).map(value => value.trim()).filter(Boolean))];
    await run({ type: 'permission.set-script-access', roleIds: scriptRoles, userIds });
    setPermissionsOpen(false);
    setSuccess('Permissões de scripts atualizadas.');
  }

  async function toggle(command: Command, enabled: boolean) {
    if (command.id === null) {
      await run({ type: 'command.set-enabled', commandName: command.name, enabled });
    } else {
      await run({ type: 'command.set-dynamic-enabled', commandId: command.id, enabled });
    }
    setSuccess(`/${command.name} atualizado neste servidor.`);
  }

  async function restoreOrArchive(command: Command) {
    if (command.id === null) return;
    await run({ type: 'command.archive', commandId: command.id });
    setSuccess(command.sourceType === 'native' ? `/${command.factoryCommandName} restaurado para a versão de fábrica.` : `/${command.name} arquivado.`);
  }

  return <div className="page">
    <PageHeader title="Comandos" description="Crie, traduza, teste e publique comandos slash por servidor." actions={<div className="row-actions">
      <button className="button button--secondary" type="button" onClick={openPermissions}><ShieldCheck aria-hidden="true" />Acesso a scripts</button>
      <button className="button button--primary" type="button" onClick={() => setEditor('new')}><Plus aria-hidden="true" />Novo comando</button>
      <RefreshButton onRefresh={() => void query.refetch()} isRefreshing={query.isFetching} />
    </div>} />
    <MutationFeedback error={action.error} success={success} />
    <div className="table-toolbar">
      <SearchField value={search} onChange={setSearch} label="Buscar comando" placeholder="Buscar comando ou descrição" />
      <label className="select-field"><Code2 aria-hidden="true" /><select value={source} onChange={event => setSource(event.target.value as typeof source)}><option value="all">Todos</option><option value="native">Nativos</option><option value="custom">Personalizados</option></select></label>
      <ResultsCount count={filtered.length} singular="comando" plural="comandos" />
    </div>
    <section className="page-section page-section--flush" aria-label="Comandos registrados">
      {query.isPending ? <LoadingState /> : null}
      {query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : null}
      {query.data && filtered.length === 0 ? <EmptyState title="Nenhum comando encontrado" description="Revise a busca ou crie um comando." icon={<CommandIcon aria-hidden="true" />} /> : null}
      {filtered.length ? <><ScrollableTable className="commands-table"><table><thead><tr><th>Comando</th><th>Origem</th><th>Estado</th><th>Versão</th><th>Disponibilidade</th><th><span className="sr-only">Ações</span></th></tr></thead><tbody>
        {filtered.map(command => <tr key={command.stableKey}><td className="cell-primary"><code className="command-name">/{command.name}</code><span>{command.description}</span></td><td>{command.sourceType === 'native' ? 'Nativo' : 'Personalizado'}</td><td><StatusBadge status={command.status === 'published' ? 'ativo' : command.status} label={command.status === 'factory' ? 'Fábrica' : command.status === 'published' ? 'Publicado' : command.status === 'draft' ? 'Rascunho' : command.status} /></td><td>{command.versions[0] ? `v${command.versions[0].version}` : '—'}{command.hasUnpublishedChanges ? ' + rascunho' : ''}</td><td><label className="switch-control"><input type="checkbox" checked={command.enabled} disabled={action.isPending} onChange={event => void toggle(command, event.target.checked)} /><span>{command.enabled ? 'Ativo' : 'Inativo'}</span></label></td><td><div className="row-actions"><button className="icon-button" type="button" title="Editar" aria-label={`Editar /${command.name}`} onClick={() => setEditor(command)}><Pencil aria-hidden="true" /></button>{command.id !== null ? <button className="icon-button" type="button" title={command.sourceType === 'native' ? 'Restaurar fábrica' : 'Arquivar'} aria-label={command.sourceType === 'native' ? 'Restaurar fábrica' : 'Arquivar'} onClick={() => void restoreOrArchive(command)}>{command.sourceType === 'native' ? <RotateCcw aria-hidden="true" /> : <Trash2 aria-hidden="true" />}</button> : null}</div></td></tr>)}
      </tbody></table></ScrollableTable><div className="mobile-record-list commands-mobile-list">{filtered.map(command => <article className="mobile-record" key={command.stableKey}><header><div><code className="command-name">/{command.name}</code><span>{command.description}</span></div><StatusBadge status={command.status === 'published' ? 'ativo' : command.status} label={command.status === 'factory' ? 'Fábrica' : command.status === 'published' ? 'Publicado' : 'Rascunho'} /></header><dl className="mobile-record__facts"><div><dt>Origem</dt><dd>{command.sourceType === 'native' ? 'Nativo' : 'Personalizado'}</dd></div><div><dt>Versão</dt><dd>{command.versions[0] ? `v${command.versions[0].version}` : 'Fábrica'}</dd></div></dl><div className="row-actions"><label className="switch-control"><input type="checkbox" checked={command.enabled} disabled={action.isPending} onChange={event => void toggle(command, event.target.checked)} /><span>{command.enabled ? 'Ativo' : 'Inativo'}</span></label><button className="button button--secondary" type="button" onClick={() => setEditor(command)}><Pencil aria-hidden="true" />Editar</button></div></article>)}</div></> : null}
    </section>

    <AdminDialog open={editor !== null} title={editor === 'new' ? 'Novo comando slash' : `Editar /${editor?.name ?? ''}`} description="Rascunhos só chegam ao Discord após publicação." onClose={() => setEditor(null)}>
      {editor ? <CommandEditor command={editor === 'new' ? null : editor} guilds={guilds} management={management.data} isPending={action.isPending} run={run} onSaved={setSuccess} onClose={() => setEditor(null)} /> : null}
    </AdminDialog>

    <AdminDialog open={permissionsOpen} title="Acesso a scripts" description="Dono e usuários com Gerenciar Servidor sempre mantêm acesso." onClose={() => setPermissionsOpen(false)}>
      <div className="admin-form"><label className="form-field">Cargos autorizados<div className="check-list">{management.data?.roles.map(role => <label className="check-row" key={role.id}><input type="checkbox" checked={scriptRoles.includes(role.id)} onChange={event => setScriptRoles(current => event.target.checked ? [...current, role.id] : current.filter(id => id !== role.id))} /><span>{role.name}</span></label>)}</div></label><label className="form-field">IDs de usuários<textarea value={scriptUsers} onChange={event => setScriptUsers(event.target.value)} placeholder="Um ID por linha" /></label><div className="form-actions"><button className="button button--secondary" type="button" onClick={() => setPermissionsOpen(false)}>Cancelar</button><button className="button button--primary" type="button" disabled={action.isPending} onClick={() => void saveScriptPermissions()}>Salvar acessos</button></div></div>
    </AdminDialog>
  </div>;
}
