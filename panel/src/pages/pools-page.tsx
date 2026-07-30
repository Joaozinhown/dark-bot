import { Layers3, ListFilter, Plus, Settings2, Trash2, X } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { AdminDialog, MutationFeedback } from '../components/admin-dialog';
import { PageHeader } from '../components/page-header';
import { RefreshButton, ResultsCount, SearchField } from '../components/data-tools';
import { EmptyState, ErrorState, LoadingState } from '../components/query-state';
import { StatusBadge } from '../components/status-badge';
import { useGuildContext } from '../context/guild-context';
import { usePanelAction, usePoolDetails, usePools } from '../hooks/use-panel-data';
import type { PanelAction } from '../types/api';

export function PoolsPage() {
  const { selectedGuildId } = useGuildContext();
  const query = usePools(selectedGuildId);
  const details = usePoolDetails(selectedGuildId);
  const action = usePanelAction(selectedGuildId);
  const [search, setSearch] = useState('');
  const [state, setState] = useState('todas');
  const [dialog, setDialog] = useState<'create' | 'manage' | null>(null);
  const [selectedPoolId, setSelectedPoolId] = useState<number | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const filtered = useMemo(() => (query.data ?? []).filter(pool => (
    `${pool.nome} ${pool.formato}`.toLowerCase().includes(search.toLowerCase())
      && (state === 'todas' || (state === 'ativas' ? pool.ativa : !pool.ativa))
  )), [query.data, search, state]);
  const selectedPool = details.data?.find(pool => pool.id === selectedPoolId) ?? null;

  function run(nextAction: PanelAction, message: string, close = false) {
    setSuccess(null);
    action.mutate(nextAction, {
      onSuccess: () => {
        setSuccess(message);
        if (close) setDialog(null);
      },
    });
  }

  function createPool(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    run({
      type: 'pool.create',
      name: String(data.get('name') ?? ''),
      format: String(data.get('format')) as 'MD3' | 'MD5',
    }, 'Pool criada.', true);
  }

  function addItem(event: FormEvent<HTMLFormElement>, type: 'map' | 'killer') {
    event.preventDefault();
    if (!selectedPool) return;
    const form = event.currentTarget;
    const value = String(new FormData(form).get('name') ?? '');
    run({
      type: type === 'map' ? 'pool.add-map' : 'pool.add-killer',
      poolId: selectedPool.id,
      name: value,
    }, `${type === 'map' ? 'Mapa' : 'Killer'} adicionado.`);
    form.reset();
  }

  return (
    <div className="page">
      <PageHeader
        title="Pools"
        description="Gerencie os presets de mapas e killers usados nos confrontos."
        actions={<div className="row-actions">
          <button className="button button--primary" type="button" onClick={() => { setSuccess(null); setDialog('create'); }}><Plus aria-hidden="true" />Criar pool</button>
          <RefreshButton onRefresh={() => { void query.refetch(); void details.refetch(); }} isRefreshing={query.isFetching || details.isFetching} />
        </div>}
      />
      <MutationFeedback error={action.error} success={success} />
      <div className="table-toolbar">
        <SearchField value={search} onChange={setSearch} label="Buscar pool" placeholder="Buscar pool ou formato" />
        <label className="select-field">
          <ListFilter aria-hidden="true" />
          <span className="sr-only">Filtrar pools</span>
          <select value={state} onChange={event => setState(event.target.value)}>
            <option value="todas">Todas as pools</option>
            <option value="ativas">Ativas</option>
            <option value="inativas">Inativas</option>
          </select>
        </label>
        <ResultsCount count={filtered.length} singular="pool" plural="pools" />
      </div>
      <section className="page-section page-section--flush" aria-label="Lista de pools">
        {query.isPending ? <LoadingState /> : null}
        {query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : null}
        {query.data && filtered.length === 0 ? <EmptyState title="Nenhuma pool encontrada" description="Ajuste os filtros ou crie um novo preset." icon={<Layers3 aria-hidden="true" />} /> : null}
        {filtered.length > 0 ? <><div className="table-scroll pools-table"><table>
          <thead><tr><th>Pool</th><th>Formato</th><th>Mapas</th><th>Killers</th><th>Uso</th><th>Estado</th><th><span className="sr-only">Ações</span></th></tr></thead>
          <tbody>{filtered.map(pool => <tr key={pool.id}>
            <td className="cell-primary"><strong>{pool.nome}</strong><span>ID {pool.id}</span></td>
            <td><span className="format-label">{pool.formato}</span></td>
            <td>{pool.mapas}</td><td>{pool.killers}</td><td>{pool.confrontos}</td>
            <td><StatusBadge status={pool.ativa ? 'ativo' : 'inativo'} label={pool.ativa ? 'Ativa' : 'Inativa'} /></td>
            <td><button className="button button--secondary" type="button" onClick={() => { setSelectedPoolId(pool.id); setSuccess(null); setDialog('manage'); }}><Settings2 aria-hidden="true" />Gerenciar</button></td>
          </tr>)}</tbody>
        </table></div><div className="mobile-record-list pools-mobile-list">{filtered.map(pool => <article className="mobile-record" key={pool.id}>
          <header><div><strong>{pool.nome}</strong><span>ID {pool.id} / {pool.formato}</span></div><StatusBadge status={pool.ativa ? 'ativo' : 'inativo'} label={pool.ativa ? 'Ativa' : 'Inativa'} /></header>
          <dl className="mobile-record__facts mobile-record__facts--three">
            <div><dt>Mapas</dt><dd>{pool.mapas}</dd></div>
            <div><dt>Killers</dt><dd>{pool.killers}</dd></div>
            <div><dt>Uso</dt><dd>{pool.confrontos}</dd></div>
          </dl>
          <button className="button button--secondary button--wide" type="button" onClick={() => { setSelectedPoolId(pool.id); setSuccess(null); setDialog('manage'); }}><Settings2 aria-hidden="true" />Gerenciar</button>
        </article>)}</div></> : null}
      </section>

      <AdminDialog open={dialog === 'create'} title="Criar pool" description="O formato define a quantidade exata de mapas presetados." onClose={() => setDialog(null)}>
        <form className="admin-form" onSubmit={createPool}>
          <label className="form-field">Nome<input name="name" required maxLength={80} autoFocus /></label>
          <label className="form-field">Formato<select name="format" defaultValue="MD3"><option value="MD3">MD3</option><option value="MD5">MD5</option></select></label>
          <MutationFeedback error={action.error} />
          <div className="form-actions"><button className="button button--secondary" type="button" onClick={() => setDialog(null)}>Cancelar</button><button className="button button--primary" type="submit" disabled={action.isPending}>Criar</button></div>
        </form>
      </AdminDialog>

      <AdminDialog open={dialog === 'manage'} title={selectedPool?.nome ?? 'Gerenciar pool'} description={selectedPool ? `${selectedPool.formato} | ID ${selectedPool.id}` : undefined} onClose={() => setDialog(null)}>
        {details.isPending ? <LoadingState rows={3} /> : null}
        {selectedPool ? <div className="admin-form">
          <MutationFeedback error={action.error} success={success} />
          <section className="form-section">
            <h3>Mapas presetados</h3>
            <ul className="item-list">{selectedPool.mapas.map(item => <li key={item.id}><span>{item.ordem}. {item.nome}</span><button className="icon-button" type="button" title="Remover mapa" aria-label={`Remover ${item.nome}`} disabled={action.isPending} onClick={() => run({ type: 'pool.remove-map', poolId: selectedPool.id, name: item.nome }, 'Mapa removido.')}><X aria-hidden="true" /></button></li>)}</ul>
            <form className="form-grid" onSubmit={event => addItem(event, 'map')}><label className="form-field">Novo mapa<input name="name" required maxLength={100} /></label><div className="form-actions"><button className="button button--secondary" type="submit" disabled={action.isPending}><Plus aria-hidden="true" />Adicionar</button></div></form>
          </section>
          <section className="form-section">
            <h3>Killers disponíveis</h3>
            <ul className="item-list">{selectedPool.killers.map(item => <li key={item.id}><span>{item.nome}</span><button className="icon-button" type="button" title="Remover killer" aria-label={`Remover ${item.nome}`} disabled={action.isPending} onClick={() => run({ type: 'pool.remove-killer', poolId: selectedPool.id, name: item.nome }, 'Killer removido.')}><X aria-hidden="true" /></button></li>)}</ul>
            <form className="form-grid" onSubmit={event => addItem(event, 'killer')}><label className="form-field">Novo killer<input name="name" required maxLength={100} /></label><div className="form-actions"><button className="button button--secondary" type="submit" disabled={action.isPending}><Plus aria-hidden="true" />Adicionar</button></div></form>
          </section>
          <section className="form-section"><div className="form-actions">
            <button className="button button--secondary" type="button" disabled={action.isPending} onClick={() => run({ type: 'pool.toggle', poolId: selectedPool.id }, selectedPool.ativa ? 'Pool desativada.' : 'Pool ativada.')}>{selectedPool.ativa ? 'Desativar' : 'Ativar'} pool</button>
            <button className="button button--danger" type="button" disabled={action.isPending} onClick={() => { if (window.confirm(`Excluir a pool ${selectedPool.nome}?`)) run({ type: 'pool.delete', poolId: selectedPool.id }, 'Pool excluída.', true); }}><Trash2 aria-hidden="true" />Excluir pool</button>
          </div></section>
        </div> : null}
      </AdminDialog>
    </div>
  );
}
