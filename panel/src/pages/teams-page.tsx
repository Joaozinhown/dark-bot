import { UsersRound } from 'lucide-react';
import { useMemo, useState } from 'react';
import { PageHeader } from '../components/page-header';
import { RefreshButton, ResultsCount, SearchField } from '../components/data-tools';
import { EmptyState, ErrorState, LoadingState } from '../components/query-state';
import { useGuildContext } from '../context/guild-context';
import { useTeams } from '../hooks/use-panel-data';

export function TeamsPage() {
  const { selectedGuildId } = useGuildContext();
  const query = useTeams(selectedGuildId);
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => (query.data ?? []).filter(team => (
    team.name.toLowerCase().includes(search.toLowerCase())
  )), [query.data, search]);

  return (
    <div className="page">
      <PageHeader
        title="Equipes e cargos"
        description="Cargos disponíveis no servidor para identificação das equipes."
        actions={<RefreshButton onRefresh={() => void query.refetch()} isRefreshing={query.isFetching} />}
      />
      <div className="table-toolbar">
        <SearchField value={search} onChange={setSearch} label="Buscar equipe" placeholder="Buscar cargo de equipe" />
        <ResultsCount count={filtered.length} singular="cargo" plural="cargos" />
      </div>
      <section className="page-section page-section--flush" aria-label="Lista de equipes e cargos">
        {query.isPending ? <LoadingState /> : null}
        {query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : null}
        {query.data && filtered.length === 0 ? <EmptyState title="Nenhum cargo encontrado" description="Cargos gerenciados pelo Discord não são exibidos nesta lista." icon={<UsersRound aria-hidden="true" />} /> : null}
        {filtered.length > 0 ? <div className="table-scroll"><table>
          <thead><tr><th>Cargo</th><th>Membros</th><th>Posição</th><th>ID do Discord</th></tr></thead>
          <tbody>{filtered.map(team => <tr key={team.id}>
            <td><span className="role-name"><span className="role-swatch" style={{ backgroundColor: team.color }} aria-hidden="true" /><strong>{team.name}</strong></span></td>
            <td>{team.memberCount}</td><td>{team.position}</td><td className="cell-mono">{team.id}</td>
          </tr>)}</tbody>
        </table></div> : null}
      </section>
    </div>
  );
}
