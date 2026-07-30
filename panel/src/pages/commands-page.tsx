import { Command as CommandIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { MutationFeedback } from '../components/admin-dialog';
import { PageHeader } from '../components/page-header';
import { RefreshButton, ResultsCount, SearchField } from '../components/data-tools';
import { EmptyState, ErrorState, LoadingState } from '../components/query-state';
import { StatusBadge } from '../components/status-badge';
import { useGuildContext } from '../context/guild-context';
import { useCommands, usePanelAction } from '../hooks/use-panel-data';

export function CommandsPage() {
  const { selectedGuildId } = useGuildContext();
  const query = useCommands(selectedGuildId);
  const action = usePanelAction(selectedGuildId);
  const [search, setSearch] = useState('');
  const [success, setSuccess] = useState<string | null>(null);
  const filtered = useMemo(() => (query.data ?? []).filter(command => (
    `${command.name} ${command.description}`.toLowerCase().includes(search.toLowerCase())
  )), [query.data, search]);

  function setCommandEnabled(commandName: string, enabled: boolean) {
    setSuccess(null);
    action.mutate({ type: 'command.set-enabled', commandName, enabled }, {
      onSuccess: () => setSuccess(`/${commandName} atualizado neste servidor.`),
    });
  }

  return (
    <div className="page">
      <PageHeader
        title="Comandos"
        description="Controle a disponibilidade dos comandos slash registrados no Dark Bot."
        actions={<RefreshButton onRefresh={() => void query.refetch()} isRefreshing={query.isFetching} />}
      />
      <div className="read-only-note"><CommandIcon aria-hidden="true" /><span>Esta configuração não muda nomes, opções nem o registro dos comandos slash.</span></div>
      <MutationFeedback error={action.error} success={success} />
      <div className="table-toolbar">
        <SearchField value={search} onChange={setSearch} label="Buscar comando" placeholder="Buscar comando ou descrição" />
        <ResultsCount count={filtered.length} singular="comando" plural="comandos" />
      </div>
      <section className="page-section page-section--flush" aria-label="Comandos registrados">
        {query.isPending ? <LoadingState /> : null}
        {query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : null}
        {query.data && filtered.length === 0 ? <EmptyState title="Nenhum comando encontrado" description="Revise o texto usado na busca." icon={<CommandIcon aria-hidden="true" />} /> : null}
        {filtered.length > 0 ? <><div className="table-scroll commands-table"><table>
          <thead><tr><th>Comando</th><th>Descrição</th><th>Registro</th><th>Disponibilidade</th></tr></thead>
          <tbody>{filtered.map(command => <tr key={command.name}>
            <td><code className="command-name">/{command.name}</code></td>
            <td>{command.description || 'Sem descrição informada'}</td>
            <td><StatusBadge status="ativo" label="Registrado" /></td>
            <td><label className="switch-control">
              <input
                type="checkbox"
                checked={command.enabled !== false}
                disabled={action.isPending}
                onChange={event => setCommandEnabled(command.name, event.target.checked)}
              />
              <span>{command.enabled === false ? 'Desativado' : 'Ativado'}</span>
            </label></td>
          </tr>)}</tbody>
        </table></div>
        <div className="mobile-record-list commands-mobile-list">{filtered.map(command => <article className="mobile-record" key={command.name}>
          <header><div><code className="command-name">/{command.name}</code><span>{command.description || 'Sem descrição informada'}</span></div><StatusBadge status="ativo" label="Registrado" /></header>
          <label className="switch-control"><input type="checkbox" checked={command.enabled !== false} disabled={action.isPending} onChange={event => setCommandEnabled(command.name, event.target.checked)} /><span>{command.enabled === false ? 'Desativado' : 'Ativado'}</span></label>
        </article>)}</div></> : null}
      </section>
    </div>
  );
}
