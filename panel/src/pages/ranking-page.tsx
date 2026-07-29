import { Medal, Trophy } from 'lucide-react';
import { PageHeader } from '../components/page-header';
import { RefreshButton } from '../components/data-tools';
import { EmptyState, ErrorState, LoadingState } from '../components/query-state';
import { useGuildContext } from '../context/guild-context';
import { useRanking } from '../hooks/use-panel-data';

function getWinRate(wins: number, losses: number): string {
  const total = wins + losses;
  return total === 0 ? '0%' : `${Math.round((wins / total) * 100)}%`;
}

export function RankingPage() {
  const { selectedGuildId } = useGuildContext();
  const query = useRanking(selectedGuildId);

  return (
    <div className="page">
      <PageHeader
        title="Ranking"
        description="Classificação por vitórias nos confrontos encerrados."
        actions={<RefreshButton onRefresh={() => void query.refetch()} isRefreshing={query.isFetching} />}
      />
      <section className="page-section page-section--flush" aria-label="Classificação das equipes">
        {query.isPending ? <LoadingState rows={6} /> : null}
        {query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : null}
        {query.data?.length === 0 ? <EmptyState title="Ranking ainda vazio" description="A classificação será calculada após o primeiro confronto encerrado." icon={<Trophy aria-hidden="true" />} /> : null}
        {query.data && query.data.length > 0 ? <div className="table-scroll"><table className="ranking-table">
          <thead><tr><th>Posição</th><th>Equipe</th><th>Vitórias</th><th>Derrotas</th><th>Aproveitamento</th></tr></thead>
          <tbody>{query.data.map((entry, index) => <tr key={entry.nome}>
            <td><span className={`rank-position ${index < 3 ? `rank-position--${index + 1}` : ''}`}>{index < 3 ? <Medal aria-hidden="true" /> : null}{index + 1}</span></td>
            <td className="cell-primary"><strong>{entry.nome}</strong><span>{entry.vitorias + entry.derrotas} confrontos</span></td>
            <td className="wins-cell">{entry.vitorias}</td><td>{entry.derrotas}</td><td>{getWinRate(entry.vitorias, entry.derrotas)}</td>
          </tr>)}</tbody>
        </table></div> : null}
      </section>
    </div>
  );
}
