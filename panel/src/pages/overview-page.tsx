import { AlertCircle, Bot, Clock3, Layers3, Swords, UsersRound } from 'lucide-react';
import { useGuildContext } from '../context/guild-context';
import { useHealth, useOverview, useTeams } from '../hooks/use-panel-data';
import { formatDateTime, formatUptime } from '../lib/format';
import type { ActiveConfrontation } from '../types/api';
import { PageHeader } from '../components/page-header';
import { ScrollableTable } from '../components/scrollable-table';
import { EmptyState, ErrorState, LoadingState } from '../components/query-state';
import { StatusBadge } from '../components/status-badge';
import { RefreshButton } from '../components/data-tools';

function resolveTeamName(roleId: string, teams: ReadonlyMap<string, string>): string {
  return teams.get(roleId) ?? `Cargo ${roleId.slice(-6)}`;
}

function ActiveMatchRow({
  confrontation,
  teams,
}: {
  confrontation: ActiveConfrontation;
  teams: ReadonlyMap<string, string>;
}) {
  return (
    <tr>
      <td className="cell-primary">
        <strong>#{confrontation.id}</strong>
        <span>{confrontation.formato} · Set {confrontation.currentSet}</span>
      </td>
      <td>
        <span className="matchup">
          <strong>{resolveTeamName(confrontation.timeARoleId, teams)}</strong>
          <span>{confrontation.timeAVitorias} × {confrontation.timeBVitorias}</span>
          <strong>{resolveTeamName(confrontation.timeBRoleId, teams)}</strong>
        </span>
      </td>
      <td><StatusBadge status={confrontation.status} /></td>
      <td className="cell-muted">{formatDateTime(confrontation.criadoEm)}</td>
    </tr>
  );
}

export function OverviewPage() {
  const { selectedGuild, selectedGuildId } = useGuildContext();
  const overview = useOverview(selectedGuildId);
  const health = useHealth();
  const teams = useTeams(selectedGuildId);
  const teamNames = new Map((teams.data ?? []).map(team => [team.id, team.name]));

  return (
    <div className="page">
      <PageHeader
        title="Visão geral"
        description={selectedGuild ? `Operação ao vivo em ${selectedGuild.name}` : 'Selecione um servidor autorizado.'}
        actions={<RefreshButton onRefresh={() => void overview.refetch()} isRefreshing={overview.isFetching} />}
      />

      {overview.isPending ? <LoadingState rows={6} label="Carregando visão geral" /> : null}
      {overview.isError ? <ErrorState error={overview.error} onRetry={() => void overview.refetch()} /> : null}
      {overview.data ? (
        <>
          <section className="summary-strip" aria-label="Resumo do campeonato">
            <div className="summary-item summary-item--attention">
              <Swords aria-hidden="true" />
              <span>Ativos agora</span>
              <strong>{overview.data.summary.confrontosAtivos}</strong>
            </div>
            <div className="summary-item">
              <Clock3 aria-hidden="true" />
              <span>Confrontos encerrados</span>
              <strong>{overview.data.summary.confrontosEncerrados}</strong>
            </div>
            <div className="summary-item">
              <UsersRound aria-hidden="true" />
              <span>Jogadores</span>
              <strong>{overview.data.summary.jogadores}</strong>
            </div>
            <div className="summary-item">
              <Layers3 aria-hidden="true" />
              <span>Pools ativas</span>
              <strong>{overview.data.summary.poolsAtivas}</strong>
            </div>
          </section>

          <div className="overview-grid">
            <section className="page-section overview-grid__main" aria-labelledby="active-title">
              <div className="section-header">
                <div>
                  <h2 id="active-title">Confrontos em operação</h2>
                  <p>Partidas que exigem acompanhamento da staff.</p>
                </div>
                <span className="section-count">{overview.data.confrontations.length}</span>
              </div>
              {overview.data.confrontations.length === 0 ? (
                <EmptyState
                  title="Nenhum confronto ativo"
                  description="Novos confrontos iniciados pelo bot aparecerão aqui em tempo real."
                  icon={<Swords aria-hidden="true" />}
                />
              ) : (<>
                <ScrollableTable className="overview-active-table">
                  <table>
                    <thead><tr><th>Confronto</th><th>Placar</th><th>Etapa</th><th>Início</th></tr></thead>
                    <tbody>{overview.data.confrontations.map(item => (
                      <ActiveMatchRow key={item.id} confrontation={item} teams={teamNames} />
                    ))}</tbody>
                  </table>
                </ScrollableTable>
                <div className="mobile-record-list overview-active-mobile">
                  {overview.data.confrontations.map(item => (
                    <article className="mobile-record" key={item.id}>
                      <header>
                        <div><strong>Confronto #{item.id}</strong><span>{item.formato} · Set {item.currentSet}</span></div>
                        <StatusBadge status={item.status} />
                      </header>
                      <dl className="mobile-record__facts">
                        <div><dt>Placar</dt><dd>{item.timeAVitorias} × {item.timeBVitorias}</dd></div>
                        <div><dt>Início</dt><dd>{formatDateTime(item.criadoEm)}</dd></div>
                      </dl>
                      <span className="matchup">
                        <strong>{resolveTeamName(item.timeARoleId, teamNames)}</strong>
                        <span>vs</span>
                        <strong>{resolveTeamName(item.timeBRoleId, teamNames)}</strong>
                      </span>
                    </article>
                  ))}
                </div>
              </>)}
            </section>

            <aside className="page-section operation-status" aria-labelledby="operation-title">
              <div className="section-header">
                <div>
                  <h2 id="operation-title">Estado da operação</h2>
                  <p>Saúde do processo e prontidão das pools.</p>
                </div>
              </div>
              <dl className="status-list">
                <div>
                  <dt><Bot aria-hidden="true" /> Gateway do bot</dt>
                  <dd>{health.data ? <StatusBadge status={health.data.status} /> : 'Verificando'}</dd>
                </div>
                <div>
                  <dt>Tempo online</dt>
                  <dd>{health.data ? formatUptime(health.data.uptimeSeconds) : '—'}</dd>
                </div>
                <div>
                  <dt>Pools prontas</dt>
                  <dd>{overview.data.pools.filter(pool => pool.ativa).length} de {overview.data.pools.length}</dd>
                </div>
              </dl>
              <div className="attention-list">
                <h3><AlertCircle aria-hidden="true" /> Atenção da staff</h3>
                {overview.data.confrontations.filter(item => item.status === 'resultado').length > 0 ? (
                  <p>{overview.data.confrontations.filter(item => item.status === 'resultado').length} confronto aguardando confirmação de resultado.</p>
                ) : (
                  <p>Nenhuma pendência crítica detectada.</p>
                )}
              </div>
            </aside>
          </div>

          <section className="page-section" aria-labelledby="pool-readiness-title">
            <div className="section-header">
              <div>
                <h2 id="pool-readiness-title">Prontidão das pools</h2>
                <p>Configuração presetada disponível para novos confrontos.</p>
              </div>
            </div>
            <ScrollableTable className="overview-pools-table">
              <table>
                <thead><tr><th>Pool</th><th>Formato</th><th>Mapas</th><th>Killers</th><th>Uso</th><th>Estado</th></tr></thead>
                <tbody>{overview.data.pools.map(pool => (
                  <tr key={pool.id}>
                    <td className="cell-primary"><strong>{pool.nome}</strong><span>ID {pool.id}</span></td>
                    <td>{pool.formato}</td><td>{pool.mapas}</td><td>{pool.killers}</td><td>{pool.confrontos}</td>
                    <td><StatusBadge status={pool.ativa ? 'ativo' : 'inativo'} label={pool.ativa ? 'Ativa' : 'Inativa'} /></td>
                  </tr>
                ))}</tbody>
              </table>
            </ScrollableTable>
            <div className="mobile-record-list overview-pools-mobile">
              {overview.data.pools.map(pool => (
                <article className="mobile-record" key={pool.id}>
                  <header>
                    <div><strong>{pool.nome}</strong><span>ID {pool.id} · {pool.formato}</span></div>
                    <StatusBadge status={pool.ativa ? 'ativo' : 'inativo'} label={pool.ativa ? 'Ativa' : 'Inativa'} />
                  </header>
                  <dl className="mobile-record__facts mobile-record__facts--three">
                    <div><dt>Mapas</dt><dd>{pool.mapas}</dd></div>
                    <div><dt>Killers</dt><dd>{pool.killers}</dd></div>
                    <div><dt>Uso</dt><dd>{pool.confrontos}</dd></div>
                  </dl>
                </article>
              ))}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
