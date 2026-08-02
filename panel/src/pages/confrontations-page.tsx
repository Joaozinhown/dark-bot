import { ListFilter, Plus, Settings2, Swords } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { AdminDialog, MutationFeedback } from '../components/admin-dialog';
import { PageHeader } from '../components/page-header';
import { ScrollableTable } from '../components/scrollable-table';
import { RefreshButton, ResultsCount, SearchField } from '../components/data-tools';
import { EmptyState, ErrorState, LoadingState } from '../components/query-state';
import { StatusBadge } from '../components/status-badge';
import { useGuildContext } from '../context/guild-context';
import { useConfrontations, useManagement, usePanelAction, usePoolDetails } from '../hooks/use-panel-data';
import { formatDateTime } from '../lib/format';
import type { PanelAction } from '../types/api';

export function ConfrontationsPage() {
  const { selectedGuildId } = useGuildContext();
  const query = useConfrontations(selectedGuildId);
  const management = useManagement(selectedGuildId);
  const pools = usePoolDetails(selectedGuildId);
  const action = usePanelAction(selectedGuildId);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('todos');
  const [dialog, setDialog] = useState<'create' | 'manage' | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const filtered = useMemo(() => (query.data ?? []).filter(item => {
    const matchesSearch = `#${item.id} ${item.formato}`.toLowerCase().includes(search.toLowerCase());
    return matchesSearch && (status === 'todos' || item.status === status);
  }), [query.data, search, status]);
  const selected = management.data?.activeConfrontations.find(item => item.id === selectedId) ?? null;
  const roleName = (roleId: string) => management.data?.roles.find(role => role.id === roleId)?.name ?? roleId;

  function run(nextAction: PanelAction, message: string, close = false) {
    setSuccess(null);
    action.mutate(nextAction, { onSuccess: () => { setSuccess(message); if (close) setDialog(null); } });
  }

  function createConfrontation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    run({
      type: 'confrontation.create',
      poolId: Number(data.get('poolId')),
      teamARoleId: String(data.get('teamA')),
      teamBRoleId: String(data.get('teamB')),
      channelId: String(data.get('channelId')),
    }, 'Confronto criado e pick/ban iniciado no canal selecionado.', true);
  }

  function recordResult(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    run({ type: 'confrontation.result', confrontationId: selected.id, winnerRoleId: String(new FormData(event.currentTarget).get('winnerRoleId')) }, 'Resultado registrado.');
  }

  function closeConfrontation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const reason = String(new FormData(event.currentTarget).get('reason') ?? '').trim();
    run({ type: 'confrontation.close', confrontationId: selected.id, reason: reason || null }, 'Confronto encerrado.', true);
  }

  return (
    <div className="page">
      <PageHeader
        title="Confrontos"
        description="Crie séries nos canais existentes, acompanhe placares e encerre partidas."
        actions={<div className="row-actions"><button className="button button--primary" type="button" onClick={() => { setSuccess(null); setDialog('create'); }}><Plus aria-hidden="true" />Novo confronto</button><RefreshButton onRefresh={() => { void query.refetch(); void management.refetch(); }} isRefreshing={query.isFetching || management.isFetching} /></div>}
      />
      <MutationFeedback error={action.error} success={success} />
      <div className="table-toolbar">
        <SearchField value={search} onChange={setSearch} label="Buscar confronto" placeholder="Buscar por ID ou formato" />
        <label className="select-field"><ListFilter aria-hidden="true" /><span className="sr-only">Filtrar por status</span><select value={status} onChange={event => setStatus(event.target.value)}><option value="todos">Todos os status</option><option value="veto">Pick/ban</option><option value="resultado">Aguardando resultado</option><option value="encerrado">Encerrados</option></select></label>
        <ResultsCount count={filtered.length} singular="confronto" plural="confrontos" />
      </div>
      <section className="page-section page-section--flush" aria-label="Lista de confrontos">
        {query.isPending ? <LoadingState /> : null}
        {query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : null}
        {query.data && filtered.length === 0 ? <EmptyState title="Nenhum confronto encontrado" description="Ajuste a busca ou crie um confronto." icon={<Swords aria-hidden="true" />} /> : null}
        {filtered.length > 0 ? <><ScrollableTable className="confrontations-table"><table>
          <thead><tr><th>Confronto</th><th>Formato</th><th>Placar</th><th>Status</th><th>Início</th><th><span className="sr-only">Ações</span></th></tr></thead>
          <tbody>{filtered.map(item => {
            const isActive = management.data?.activeConfrontations.some(active => active.id === item.id) ?? false;
            return <tr key={item.id}><td className="cell-primary"><strong>Confronto #{item.id}</strong><span>Registro competitivo</span></td><td><span className="format-label">{item.formato}</span></td><td className="score-cell">{item.timeAVitorias} <span>×</span> {item.timeBVitorias}</td><td><StatusBadge status={item.status} /></td><td className="cell-muted">{formatDateTime(item.criadoEm)}</td><td>{isActive ? <button className="button button--secondary" type="button" onClick={() => { setSelectedId(item.id); setSuccess(null); setDialog('manage'); }}><Settings2 aria-hidden="true" />Gerenciar</button> : null}</td></tr>;
          })}</tbody>
        </table></ScrollableTable><div className="mobile-record-list confrontation-mobile-list">{filtered.map(item => {
          const isActive = management.data?.activeConfrontations.some(active => active.id === item.id) ?? false;
          return <article className="mobile-record" key={item.id}>
            <header><div><strong>Confronto #{item.id}</strong><span>{item.formato}</span></div><StatusBadge status={item.status} /></header>
            <dl className="mobile-record__facts">
              <div><dt>Placar</dt><dd>{item.timeAVitorias} x {item.timeBVitorias}</dd></div>
              <div><dt>Início</dt><dd>{formatDateTime(item.criadoEm)}</dd></div>
            </dl>
            {isActive ? <button className="button button--secondary button--wide" type="button" onClick={() => { setSelectedId(item.id); setSuccess(null); setDialog('manage'); }}><Settings2 aria-hidden="true" />Gerenciar</button> : null}
          </article>;
        })}</div></> : null}
      </section>

      <AdminDialog open={dialog === 'create'} title="Criar confronto" description="O pick/ban começará no canal de texto selecionado. Nenhum canal será criado." onClose={() => setDialog(null)}>
        <form className="admin-form" onSubmit={createConfrontation}>
          <label className="form-field">Pool<select name="poolId" required defaultValue=""><option value="" disabled>Selecione</option>{pools.data?.filter(pool => pool.ativa).map(pool => <option value={pool.id} key={pool.id}>{pool.nome} ({pool.formato})</option>)}</select></label>
          <div className="form-grid"><label className="form-field">Time A<select name="teamA" required defaultValue=""><option value="" disabled>Selecione</option>{management.data?.roles.map(role => <option value={role.id} key={role.id}>{role.name}</option>)}</select></label><label className="form-field">Time B<select name="teamB" required defaultValue=""><option value="" disabled>Selecione</option>{management.data?.roles.map(role => <option value={role.id} key={role.id}>{role.name}</option>)}</select></label></div>
          <label className="form-field">Canal do confronto<select name="channelId" required defaultValue=""><option value="" disabled>Selecione</option>{management.data?.channels.map(channel => <option value={channel.id} key={channel.id}>#{channel.name}</option>)}</select></label>
          <MutationFeedback error={action.error} />
          <div className="form-actions"><button className="button button--secondary" type="button" onClick={() => setDialog(null)}>Cancelar</button><button className="button button--primary" type="submit" disabled={action.isPending}>Criar e iniciar</button></div>
        </form>
      </AdminDialog>

      <AdminDialog open={dialog === 'manage'} title={selected ? `Confronto #${selected.id}` : 'Gerenciar confronto'} description={selected ? `${roleName(selected.timeARoleId)} contra ${roleName(selected.timeBRoleId)}` : undefined} onClose={() => setDialog(null)}>
        {management.isPending ? <LoadingState rows={3} /> : null}
        {selected ? <div className="admin-form">
          <MutationFeedback error={action.error} success={success} />
          <form className="form-section" onSubmit={recordResult}><h3>Registrar vencedor do set</h3><label className="form-field">Vencedor<select name="winnerRoleId"><option value={selected.timeARoleId}>{roleName(selected.timeARoleId)}</option><option value={selected.timeBRoleId}>{roleName(selected.timeBRoleId)}</option></select></label><div className="form-actions"><button className="button button--primary" type="submit" disabled={action.isPending}>Registrar resultado</button></div></form>
          <form className="form-section" onSubmit={closeConfrontation}><h3>Encerrar confronto</h3><label className="form-field">Motivo<textarea name="reason" maxLength={500} placeholder="Opcional" /></label><div className="form-actions"><button className="button button--danger" type="submit" disabled={action.isPending}>Encerrar confronto</button></div></form>
        </div> : null}
      </AdminDialog>
    </div>
  );
}
