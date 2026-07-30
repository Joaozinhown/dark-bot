import { Layers3, ListFilter } from 'lucide-react';
import { useMemo, useState } from 'react';
import { PageHeader } from '../components/page-header';
import { RefreshButton, ResultsCount, SearchField } from '../components/data-tools';
import { EmptyState, ErrorState, LoadingState } from '../components/query-state';
import { StatusBadge } from '../components/status-badge';
import { useGuildContext } from '../context/guild-context';
import { usePools } from '../hooks/use-panel-data';

export function PoolsPage() {
  const { selectedGuildId } = useGuildContext();
  const query = usePools(selectedGuildId);
  const [search, setSearch] = useState('');
  const [state, setState] = useState('todas');
  const filtered = useMemo(() => (query.data ?? []).filter(pool => (
    `${pool.nome} ${pool.formato}`.toLowerCase().includes(search.toLowerCase())
      && (state === 'todas' || (state === 'ativas' ? pool.ativa : !pool.ativa))
  )), [query.data, search, state]);

  return (
    <div className="page">
      <PageHeader
        title="Pools"
        description="Consulte os presets de mapas e killers usados nos confrontos."
        actions={<RefreshButton onRefresh={() => void query.refetch()} isRefreshing={query.isFetching} />}
      />
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
        {query.data && filtered.length === 0 ? <EmptyState title="Nenhuma pool encontrada" description="Ajuste os filtros para ver outros presets." icon={<Layers3 aria-hidden="true" />} /> : null}
        {filtered.length > 0 ? (
          <div className="table-scroll"><table>
            <thead><tr><th>Pool</th><th>Formato</th><th>Mapas presetados</th><th>Killers</th><th>Confrontos</th><th>Estado</th></tr></thead>
            <tbody>{filtered.map(pool => <tr key={pool.id}>
              <td className="cell-primary"><strong>{pool.nome}</strong><span>ID {pool.id}</span></td>
              <td><span className="format-label">{pool.formato}</span></td>
              <td>{pool.mapas}</td><td>{pool.killers}</td><td>{pool.confrontos}</td>
              <td><StatusBadge status={pool.ativa ? 'ativo' : 'inativo'} label={pool.ativa ? 'Ativa' : 'Inativa'} /></td>
            </tr>)}</tbody>
          </table></div>
        ) : null}
      </section>
    </div>
  );
}
