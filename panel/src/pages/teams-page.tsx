import { Plus, Settings2, ShieldCheck, Trash2, UsersRound } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { AdminDialog, MutationFeedback } from '../components/admin-dialog';
import { PageHeader } from '../components/page-header';
import { ScrollableTable } from '../components/scrollable-table';
import { RefreshButton, ResultsCount, SearchField } from '../components/data-tools';
import { EmptyState, ErrorState, LoadingState } from '../components/query-state';
import { useGuildContext } from '../context/guild-context';
import { useManagement, usePanelAction, useTeams } from '../hooks/use-panel-data';
import type { PanelAction } from '../types/api';

export function TeamsPage() {
  const { selectedGuildId } = useGuildContext();
  const query = useTeams(selectedGuildId);
  const management = useManagement(selectedGuildId);
  const action = usePanelAction(selectedGuildId);
  const [search, setSearch] = useState('');
  const [dialog, setDialog] = useState<'create' | 'manage' | 'permissions' | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [adminSelection, setAdminSelection] = useState<string[]>([]);
  const [success, setSuccess] = useState<string | null>(null);
  const filtered = useMemo(() => (query.data ?? []).filter(team => (
    team.name.toLowerCase().includes(search.toLowerCase())
  )), [query.data, search]);
  const selectedRole = management.data?.roles.find(role => role.id === selectedRoleId) ?? null;

  function run(nextAction: PanelAction, message: string, close = false) {
    setSuccess(null);
    action.mutate(nextAction, { onSuccess: () => { setSuccess(message); if (close) setDialog(null); } });
  }

  function createRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    run({ type: 'team.create', name: String(data.get('name') ?? ''), color: String(data.get('color') ?? '') }, 'Cargo criado.', true);
  }

  function renameRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedRole) return;
    run({ type: 'team.rename', roleId: selectedRole.id, name: String(new FormData(event.currentTarget).get('name') ?? '') }, 'Cargo renomeado.');
  }

  function updateMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedRole) return;
    const data = new FormData(event.currentTarget);
    const operation = String(data.get('operation')) as 'add' | 'remove';
    run({
      type: operation === 'add' ? 'team.member-add' : 'team.member-remove',
      roleId: selectedRole.id,
      userId: String(data.get('userId') ?? ''),
    }, operation === 'add' ? 'Membro adicionado.' : 'Membro removido.');
  }

  return (
    <div className="page">
      <PageHeader
        title="Equipes e cargos"
        description="Gerencie cargos de equipe, membros e permissões administrativas do bot."
        actions={<div className="row-actions">
          <button className="button button--secondary" type="button" onClick={() => { setAdminSelection(management.data?.adminRoleIds ?? []); setSuccess(null); setDialog('permissions'); }}><ShieldCheck aria-hidden="true" />Acessos</button>
          <button className="button button--primary" type="button" onClick={() => { setSuccess(null); setDialog('create'); }}><Plus aria-hidden="true" />Criar cargo</button>
          <RefreshButton onRefresh={() => { void query.refetch(); void management.refetch(); }} isRefreshing={query.isFetching || management.isFetching} />
        </div>}
      />
      <MutationFeedback error={action.error} success={success} />
      <div className="table-toolbar">
        <SearchField value={search} onChange={setSearch} label="Buscar equipe" placeholder="Buscar cargo de equipe" />
        <ResultsCount count={filtered.length} singular="cargo" plural="cargos" />
      </div>
      <section className="page-section page-section--flush" aria-label="Lista de equipes e cargos">
        {query.isPending ? <LoadingState /> : null}
        {query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : null}
        {query.data && filtered.length === 0 ? <EmptyState title="Nenhum cargo encontrado" description="Cargos gerenciados pelo Discord não aparecem nesta lista." icon={<UsersRound aria-hidden="true" />} /> : null}
        {filtered.length > 0 ? <><ScrollableTable className="teams-table"><table>
          <thead><tr><th>Cargo</th><th>Membros</th><th>Posição</th><th>ID do Discord</th><th><span className="sr-only">Ações</span></th></tr></thead>
          <tbody>{filtered.map(team => <tr key={team.id}>
            <td><span className="role-name"><span className="role-swatch" style={{ backgroundColor: team.color }} aria-hidden="true" /><strong>{team.name}</strong></span></td>
            <td>{team.memberCount}</td><td>{team.position}</td><td className="cell-mono">{team.id}</td>
            <td><button className="button button--secondary" type="button" onClick={() => { setSelectedRoleId(team.id); setSuccess(null); setDialog('manage'); }}><Settings2 aria-hidden="true" />Gerenciar</button></td>
          </tr>)}</tbody>
        </table></ScrollableTable>
        <div className="mobile-record-list teams-mobile-list">{filtered.map(team => <article className="mobile-record" key={team.id}>
          <header><div><span className="role-name"><span className="role-swatch" style={{ backgroundColor: team.color }} aria-hidden="true" /><strong>{team.name}</strong></span><span>ID {team.id}</span></div></header>
          <dl className="mobile-record__facts"><div><dt>Membros</dt><dd>{team.memberCount}</dd></div><div><dt>Posição</dt><dd>{team.position}</dd></div></dl>
          <button className="button button--secondary" type="button" onClick={() => { setSelectedRoleId(team.id); setSuccess(null); setDialog('manage'); }}><Settings2 aria-hidden="true" />Gerenciar</button>
        </article>)}</div></> : null}
      </section>

      <AdminDialog open={dialog === 'create'} title="Criar cargo de equipe" description="O cargo será criado diretamente no Discord." onClose={() => setDialog(null)}>
        <form className="admin-form" onSubmit={createRole}>
          <label className="form-field">Nome<input name="name" required maxLength={80} autoFocus /></label>
          <label className="form-field">Cor<input name="color" type="color" defaultValue="#df172c" required /></label>
          <MutationFeedback error={action.error} />
          <div className="form-actions"><button className="button button--secondary" type="button" onClick={() => setDialog(null)}>Cancelar</button><button className="button button--primary" type="submit" disabled={action.isPending}>Criar cargo</button></div>
        </form>
      </AdminDialog>

      <AdminDialog open={dialog === 'manage'} title={selectedRole?.name ?? 'Gerenciar cargo'} description={selectedRole ? `ID ${selectedRole.id}` : undefined} onClose={() => setDialog(null)}>
        {management.isPending ? <LoadingState rows={3} /> : null}
        {selectedRole ? <div className="admin-form">
          <MutationFeedback error={action.error} success={success} />
          {!selectedRole.editable ? <div className="mutation-feedback mutation-feedback--error">O cargo está acima do cargo do bot e não pode ser alterado.</div> : null}
          <form className="form-section" onSubmit={renameRole}>
            <h3>Renomear</h3>
            <label className="form-field">Novo nome<input name="name" defaultValue={selectedRole.name} required maxLength={80} /></label>
            <div className="form-actions"><button className="button button--secondary" type="submit" disabled={action.isPending || !selectedRole.editable}>Salvar nome</button></div>
          </form>
          <form className="form-section" onSubmit={updateMember}>
            <h3>Membros</h3>
            <div className="form-grid"><label className="form-field">Operação<select name="operation"><option value="add">Adicionar</option><option value="remove">Remover</option></select></label><label className="form-field">ID do usuário<input name="userId" inputMode="numeric" pattern="[0-9]{16,22}" required /><span className="form-help">Use o ID do usuário no Discord.</span></label></div>
            <div className="form-actions"><button className="button button--secondary" type="submit" disabled={action.isPending || !selectedRole.editable}>Aplicar</button></div>
          </form>
          <section className="form-section"><h3>Zona de risco</h3><div className="form-actions"><button className="button button--danger" type="button" disabled={action.isPending || !selectedRole.editable} onClick={() => { if (window.confirm(`Excluir o cargo ${selectedRole.name}?`)) run({ type: 'team.delete', roleId: selectedRole.id }, 'Cargo excluído.', true); }}><Trash2 aria-hidden="true" />Excluir cargo</button></div></section>
        </div> : null}
      </AdminDialog>

      <AdminDialog open={dialog === 'permissions'} title="Acesso administrativo" description="Dono do servidor e quem possui Gerenciar Servidor continuam autorizados." onClose={() => setDialog(null)}>
        <div className="admin-form">
          <div className="check-list">{management.data?.roles.map(role => <label className="check-row" key={role.id}><input type="checkbox" checked={adminSelection.includes(role.id)} onChange={event => setAdminSelection(current => event.target.checked ? [...new Set([...current, role.id])] : current.filter(id => id !== role.id))} /><span className="role-swatch" style={{ backgroundColor: role.color }} aria-hidden="true" /><span>{role.name}</span></label>)}</div>
          <MutationFeedback error={action.error} success={success} />
          <div className="form-actions"><button className="button button--secondary" type="button" onClick={() => setDialog(null)}>Cancelar</button><button className="button button--primary" type="button" disabled={action.isPending} onClick={() => run({ type: 'permission.set-admin-roles', roleIds: adminSelection }, 'Cargos administrativos atualizados.', true)}>Salvar acessos</button></div>
        </div>
      </AdminDialog>
    </div>
  );
}
