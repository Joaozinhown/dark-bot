import { ListFilter, Swords } from 'lucide-react';
import { useMemo, useState } from 'react';
import { PageHeader } from '../components/page-header';
import { RefreshButton, ResultsCount, SearchField } from '../components/data-tools';
import { EmptyState, ErrorState, LoadingState } from '../components/query-state';
import { StatusBadge } from '../components/status-badge';
import { useGuildContext } from '../context/guild-context';
import { useConfrontations } from '../hooks/use-panel-data';
import { formatDateTime } from '../lib/format';

export function ConfrontationsPage() {
  const { selectedGuildId } = useGuildContext();
  const query = useConfrontations(selectedGuildId);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('todos');
  const filtered = useMemo(() => (query.data ?? []).filter(item => {
    const matchesSearch = `#${item.id} ${item.formato}`.toLowerCase().includes(search.toLowerCase());
    return matchesSearch && (status === 'todos' || item.status === status);
  }), [query.data, search, status]);

  return (
    <div className="page">
      <PageHeader
        title="Confrontos"
        description="Acompanhe séries recentes, placares e etapa atual."
        actions={<RefreshButton onRefresh={() => void query.refetch()} isRefreshing={query.isFetching} />}
      />
      <div className="table-toolbar">
        <SearchField value={search} onChange={setSearch} label="Buscar confronto" placeholder="Buscar por ID ou formato" />
        <label className="select-field">
          <ListFilter aria-hidden="true" />
          <span className="sr-only">Filtrar por status</span>
          <select value={status} onChange={event => setStatus(event.target.value)}>
            <option value="todos">Todos os status</option>
            <option value="veto">Pick/ban</option>
            <option value="resultado">Aguardando resultado</option>
            <option value="encerrado">Encerrados</option>
          </select>
        </label>
        <ResultsCount count={filtered.length} singular="confronto" plural="confrontos" />
      </div>
      <section className="page-section page-section--flush" aria-label="Lista de confrontos">
        {query.isPending ? <LoadingState /> : null}
        {query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : null}
        {query.data && filtered.length === 0 ? (
          <EmptyState title="Nenhum confronto encontrado" description="Ajuste a busca ou o filtro de status." icon={<Swords aria-hidden="true" />} />
        ) : null}
        {filtered.length > 0 ? (
          <div className="table-scroll">
            <table>
              <thead><tr><th>Confronto</th><th>Formato</th><th>Placar</th><th>Status</th><th>Início</th></tr></thead>
              <tbody>{filtered.map(item => (
                <tr key={item.id}>
                  <td className="cell-primary"><strong>Confronto #{item.id}</strong><span>Registro competitivo</span></td>
                  <td><span className="format-label">{item.formato}</span></td>
                  <td className="score-cell">{item.timeAVitorias} <span>×</span> {item.timeBVitorias}</td>
                  <td><StatusBadge status={item.status} /></td>
                  <td className="cell-muted">{formatDateTime(item.criadoEm)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  );
}
