import { History, ListFilter } from 'lucide-react';
import { useMemo, useState } from 'react';
import { PageHeader } from '../components/page-header';
import { RefreshButton, ResultsCount, SearchField } from '../components/data-tools';
import { EmptyState, ErrorState, LoadingState } from '../components/query-state';
import { useGuildContext } from '../context/guild-context';
import { useAudit } from '../hooks/use-panel-data';
import { formatDateTime } from '../lib/format';

function formatAction(action: string): string {
  return action.replaceAll('.', ' · ').replaceAll('_', ' ');
}

function formatDetails(details: Readonly<Record<string, unknown>>): string {
  const entries = Object.entries(details);
  if (entries.length === 0) return 'Sem detalhes adicionais';
  return entries.map(([key, value]) => `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`).join(' · ');
}

export function AuditPage() {
  const { selectedGuildId } = useGuildContext();
  const query = useAudit(selectedGuildId);
  const [search, setSearch] = useState('');
  const [entity, setEntity] = useState('todas');
  const entityTypes = useMemo(() => [...new Set((query.data ?? []).map(item => item.entityType).filter(Boolean))] as string[], [query.data]);
  const filtered = useMemo(() => (query.data ?? []).filter(item => {
    const haystack = `${item.action} ${item.actorUserId} ${item.entityId ?? ''}`.toLowerCase();
    return haystack.includes(search.toLowerCase()) && (entity === 'todas' || item.entityType === entity);
  }), [entity, query.data, search]);

  return (
    <div className="page">
      <PageHeader
        title="Auditoria"
        description="Histórico das ações administrativas registradas pelo bot."
        actions={<RefreshButton onRefresh={() => void query.refetch()} isRefreshing={query.isFetching} />}
      />
      <div className="table-toolbar">
        <SearchField value={search} onChange={setSearch} label="Buscar evento" placeholder="Buscar ação, usuário ou entidade" />
        <label className="select-field">
          <ListFilter aria-hidden="true" /><span className="sr-only">Filtrar entidade</span>
          <select value={entity} onChange={event => setEntity(event.target.value)}>
            <option value="todas">Todas as entidades</option>
            {entityTypes.map(type => <option key={type} value={type}>{type}</option>)}
          </select>
        </label>
        <ResultsCount count={filtered.length} singular="evento" plural="eventos" />
      </div>
      <section className="page-section page-section--flush" aria-label="Eventos de auditoria">
        {query.isPending ? <LoadingState /> : null}
        {query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : null}
        {query.data && filtered.length === 0 ? <EmptyState title="Nenhum evento encontrado" description="Ajuste os filtros ou aguarde uma nova ação administrativa." icon={<History aria-hidden="true" />} /> : null}
        {filtered.length > 0 ? <div className="table-scroll"><table>
          <thead><tr><th>Ação</th><th>Entidade</th><th>Responsável</th><th>Detalhes</th><th>Data</th></tr></thead>
          <tbody>{filtered.map(entry => <tr key={entry.id}>
            <td className="cell-primary"><strong>{formatAction(entry.action)}</strong><span>Evento #{entry.id}</span></td>
            <td>{entry.entityType ? <span className="entity-label">{entry.entityType} {entry.entityId ? `#${entry.entityId}` : ''}</span> : '—'}</td>
            <td className="cell-mono">{entry.actorUserId}</td><td className="audit-details">{formatDetails(entry.details)}</td>
            <td className="cell-muted">{formatDateTime(entry.criadoEm)}</td>
          </tr>)}</tbody>
        </table></div> : null}
      </section>
    </div>
  );
}
