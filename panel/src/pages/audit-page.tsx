import { ChevronDown, Crosshair, History, ListFilter, ShieldX } from 'lucide-react';
import { useMemo, useState } from 'react';
import { PageHeader } from '../components/page-header';
import { ScrollableTable } from '../components/scrollable-table';
import { RefreshButton, ResultsCount, SearchField } from '../components/data-tools';
import { EmptyState, ErrorState, LoadingState } from '../components/query-state';
import { useGuildContext } from '../context/guild-context';
import { useAudit } from '../hooks/use-panel-data';
import { formatDateTime } from '../lib/format';
import type { AuditEntry } from '../types/api';

type AuditTone = 'pick' | 'ban' | 'admin';

const ACTION_LABELS: Readonly<Record<string, string>> = {
  'confrontation.closed': 'Confronto encerrado',
  'confrontation.close': 'Confronto encerrado',
  'confrontation.create': 'Confronto criado',
  'confrontation.result': 'Resultado registrado',
  'result.recorded': 'Resultado registrado',
  'pool.activated': 'Pool ativada',
  'pool.toggle': 'Estado da pool alterado',
  'permission.set-admin-roles': 'Acessos administrativos atualizados',
  'role.permission.granted': 'Permissão de cargo concedida',
  'command.set-enabled': 'Disponibilidade de comando alterada',
};

const ENTITY_LABELS: Readonly<Record<string, string>> = {
  confrontation: 'Confronto',
  pool: 'Pool',
  role: 'Cargo',
  command: 'Comando',
  set: 'Set',
  team: 'Equipe',
};

interface AuditView {
  label: string;
  title: string;
  tone: AuditTone;
  actorName: string;
  actorUsername: string | null;
  target: string;
  context: string | null;
  killer: string | null;
  team: string | null;
}

function readString(details: Readonly<Record<string, unknown>>, key: string): string | null {
  const value = details[key];
  return typeof value === 'string' && value.trim() ? value : null;
}

function readNumber(details: Readonly<Record<string, unknown>>, key: string): number | null {
  const value = details[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function formatAction(action: string): string {
  return ACTION_LABELS[action] ?? action.replaceAll('.', ' / ').replaceAll('_', ' ');
}

function resolveAuditView(entry: AuditEntry): AuditView {
  const actorName = entry.actorDisplayName || readString(entry.details, 'actorDisplayName') || 'Usuário desconhecido';
  const actorUsername = entry.actorUsername ?? readString(entry.details, 'actorUsername');
  const setNumber = readNumber(entry.details, 'setNumber');
  const vetoStep = readNumber(entry.details, 'vetoStep');
  const killer = readString(entry.details, 'killer');
  const team = readString(entry.details, 'teamRoleName');

  if (entry.action === 'veto.pick') {
    return {
      label: 'Pick',
      title: 'Killer escolhido',
      tone: 'pick',
      actorName,
      actorUsername,
      target: `Confronto #${entry.entityId ?? '?'}`,
      context: setNumber ? `Set ${setNumber}` : vetoStep ? `Etapa ${vetoStep}` : null,
      killer,
      team,
    };
  }
  if (entry.action === 'veto.ban') {
    return {
      label: 'Ban',
      title: 'Killer banido',
      tone: 'ban',
      actorName,
      actorUsername,
      target: `Confronto #${entry.entityId ?? '?'}`,
      context: vetoStep ? `Etapa ${vetoStep}` : null,
      killer,
      team,
    };
  }
  return {
    label: 'Admin',
    title: formatAction(entry.action),
    tone: 'admin',
    actorName,
    actorUsername,
    target: entry.entityType
      ? `${ENTITY_LABELS[entry.entityType] ?? entry.entityType}${entry.entityId ? ` #${entry.entityId}` : ''}`
      : 'Evento geral',
    context: null,
    killer: null,
    team: null,
  };
}

function AuditAction({ view }: { view: AuditView }) {
  const Icon = view.tone === 'pick' ? Crosshair : view.tone === 'ban' ? ShieldX : History;
  return (
    <div className="audit-action">
      <span className={`audit-action__badge audit-action__badge--${view.tone}`}>
        <Icon aria-hidden="true" />{view.label}
      </span>
      <strong>{view.title}</strong>
    </div>
  );
}

function AuditActor({ entry, view }: { entry: AuditEntry; view: AuditView }) {
  return (
    <div className="audit-actor" title={`ID: ${entry.actorUserId}`}>
      <strong>{view.actorName}</strong>
      {view.actorUsername ? <span>@{view.actorUsername}</span> : null}
    </div>
  );
}

function AuditChoice({ view }: { view: AuditView }) {
  if (!view.killer && !view.team) return <span className="cell-muted" aria-label="Não aplicável">—</span>;
  return (
    <div className="audit-choice">
      {view.killer ? <strong>{view.killer}</strong> : null}
      {view.team ? <span>{view.team}</span> : null}
    </div>
  );
}

function AuditDetails({ entry }: { entry: AuditEntry }) {
  const entries = Object.entries(entry.details);
  return (
    <details className="audit-disclosure">
      <summary aria-label={`Detalhes técnicos do evento ${entry.id}`}><ChevronDown aria-hidden="true" />Detalhes técnicos</summary>
      {entries.length === 0 ? <p>Sem detalhes adicionais.</p> : (
        <dl>{entries.map(([key, value]) => (
          <div key={key}><dt>{key}</dt><dd>{typeof value === 'string' ? value : JSON.stringify(value)}</dd></div>
        ))}</dl>
      )}
    </details>
  );
}

export function AuditPage() {
  const { selectedGuildId } = useGuildContext();
  const query = useAudit(selectedGuildId);
  const [search, setSearch] = useState('');
  const [entity, setEntity] = useState('todas');
  const entityTypes = useMemo(
    () => [...new Set((query.data ?? []).map(item => item.entityType).filter(Boolean))] as string[],
    [query.data],
  );
  const filtered = useMemo(() => (query.data ?? []).filter(item => {
    const detailText = Object.values(item.details).map(value => String(value)).join(' ');
    const haystack = `${item.action} ${item.actorDisplayName} ${item.actorUsername ?? ''} ${item.actorUserId} ${item.entityId ?? ''} ${detailText}`.toLowerCase();
    return haystack.includes(search.toLowerCase()) && (entity === 'todas' || item.entityType === entity);
  }), [entity, query.data, search]);

  return (
    <div className="page">
      <PageHeader
        title="Auditoria"
        description="Histórico das ações administrativas, picks e bans registrados pelo bot."
        actions={<RefreshButton onRefresh={() => void query.refetch()} isRefreshing={query.isFetching} />}
      />
      <div className="table-toolbar">
        <SearchField value={search} onChange={setSearch} label="Buscar evento" placeholder="Ação, usuário, killer ou confronto" />
        <label className="select-field">
          <ListFilter aria-hidden="true" /><span className="sr-only">Filtrar entidade</span>
          <select value={entity} onChange={event => setEntity(event.target.value)}>
            <option value="todas">Todas as entidades</option>
            {entityTypes.map(type => <option key={type} value={type}>{ENTITY_LABELS[type] ?? type}</option>)}
          </select>
        </label>
        <ResultsCount count={filtered.length} singular="evento" plural="eventos" />
      </div>
      <section className="page-section page-section--flush" aria-label="Eventos de auditoria">
        {query.isPending ? <LoadingState /> : null}
        {query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : null}
        {query.data && filtered.length === 0 ? <EmptyState title="Nenhum evento encontrado" description="Ajuste os filtros ou aguarde uma nova ação administrativa." icon={<History aria-hidden="true" />} /> : null}
        {filtered.length > 0 ? <>
          <ScrollableTable className="audit-table"><table>
            <thead><tr><th>Ação</th><th>Responsável</th><th>Alvo</th><th>Escolha</th><th>Data</th><th><span className="sr-only">Detalhes</span></th></tr></thead>
            <tbody>{filtered.map(entry => {
              const view = resolveAuditView(entry);
              return <tr key={entry.id}>
                <td><AuditAction view={view} /></td>
                <td><AuditActor entry={entry} view={view} /></td>
                <td className="audit-target"><strong>{view.target}</strong>{view.context ? <span>{view.context}</span> : null}</td>
                <td><AuditChoice view={view} /></td>
                <td className="cell-muted">{formatDateTime(entry.criadoEm)}</td>
                <td><AuditDetails entry={entry} /></td>
              </tr>;
            })}</tbody>
          </table></ScrollableTable>
          <div className="audit-mobile-list">{filtered.map(entry => {
            const view = resolveAuditView(entry);
            return <article className="mobile-record audit-mobile-record" key={entry.id}>
              <header><AuditAction view={view} /><time dateTime={entry.criadoEm}>{formatDateTime(entry.criadoEm)}</time></header>
              <AuditActor entry={entry} view={view} />
              <div className="audit-mobile-record__context">
                <div><span>Alvo</span><strong>{view.target}{view.context ? ` / ${view.context}` : ''}</strong></div>
                {view.tone !== 'admin' ? <div><span>Escolha</span><AuditChoice view={view} /></div> : null}
              </div>
              <AuditDetails entry={entry} />
            </article>;
          })}</div>
        </> : null}
      </section>
    </div>
  );
}
