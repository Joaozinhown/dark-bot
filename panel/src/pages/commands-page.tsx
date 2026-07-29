import { Command as CommandIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { PageHeader } from '../components/page-header';
import { RefreshButton, ResultsCount, SearchField } from '../components/data-tools';
import { EmptyState, ErrorState, LoadingState } from '../components/query-state';
import { StatusBadge } from '../components/status-badge';
import { useGuildContext } from '../context/guild-context';
import { useCommands } from '../hooks/use-panel-data';

export function CommandsPage() {
  const { selectedGuildId } = useGuildContext();
  const query = useCommands(selectedGuildId);
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => (query.data ?? []).filter(command => (
    `${command.name} ${command.description}`.toLowerCase().includes(search.toLowerCase())
  )), [query.data, search]);

  return (
    <div className="page">
      <PageHeader
        title="Comandos"
        description="Catálogo de comandos slash registrados no Dark Bot."
        actions={<RefreshButton onRefresh={() => void query.refetch()} isRefreshing={query.isFetching} />}
      />
      <div className="read-only-note"><CommandIcon aria-hidden="true" /><span>Visualização somente leitura. O painel não altera o catálogo atual de comandos slash.</span></div>
      <div className="table-toolbar">
        <SearchField value={search} onChange={setSearch} label="Buscar comando" placeholder="Buscar comando ou descrição" />
        <ResultsCount count={filtered.length} singular="comando" plural="comandos" />
      </div>
      <section className="page-section page-section--flush" aria-label="Comandos registrados">
        {query.isPending ? <LoadingState /> : null}
        {query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : null}
        {query.data && filtered.length === 0 ? <EmptyState title="Nenhum comando encontrado" description="Revise o texto usado na busca." icon={<CommandIcon aria-hidden="true" />} /> : null}
        {filtered.length > 0 ? <div className="table-scroll"><table>
          <thead><tr><th>Comando</th><th>Descrição</th><th>Registro</th></tr></thead>
          <tbody>{filtered.map(command => <tr key={command.name}>
            <td><code className="command-name">/{command.name}</code></td><td>{command.description || 'Sem descrição informada'}</td>
            <td><StatusBadge status="ativo" label="Registrado" /></td>
          </tr>)}</tbody>
        </table></div> : null}
      </section>
    </div>
  );
}
