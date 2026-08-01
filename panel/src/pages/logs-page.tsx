import { Check, Clipboard, Download, Pause, Play, Terminal } from 'lucide-react';
import { useMemo, useState } from 'react';
import { PageHeader } from '../components/page-header';
import { RefreshButton, SearchField } from '../components/data-tools';
import { ErrorState, LoadingState } from '../components/query-state';
import { useGuildContext } from '../context/guild-context';
import { useLogs } from '../hooks/use-panel-data';
import { formatDateTime } from '../lib/format';

const ANSI_PATTERN = /[\u001b\u009b][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[-a-zA-Z\d\/#&.:=?%@~_]+)*)?\u0007)|(?:(?:\d{1,4}(?:[;:]\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/g;

function visibleLog(content: string, search: string): string {
  const clean = content.replace(ANSI_PATTERN, '');
  if (!search.trim()) return clean;
  const needle = search.toLocaleLowerCase('pt-BR');
  return clean.split('\n').filter(line => line.toLocaleLowerCase('pt-BR').includes(needle)).join('\n');
}

export function LogsPage() {
  const { selectedGuildId } = useGuildContext();
  const [isLive, setIsLive] = useState(true);
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState(false);
  const query = useLogs(selectedGuildId, isLive);
  const content = useMemo(() => visibleLog(query.data?.content ?? '', search), [query.data?.content, search]);

  async function copyLogs() {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1_500);
  }

  function downloadLogs() {
    const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `dta-bot-${selectedGuildId}.log`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="page">
      <PageHeader
        title="Logs"
        description="Saída operacional do bot hospedado na Discloud."
        actions={<div className="row-actions">
          <button className="button button--secondary" type="button" onClick={() => setIsLive(value => !value)}>{isLive ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}{isLive ? 'Pausar' : 'Retomar'}</button>
          <RefreshButton onRefresh={() => void query.refetch()} isRefreshing={query.isFetching} />
        </div>}
      />
      <div className="table-toolbar">
        <SearchField value={search} onChange={setSearch} label="Filtrar logs" placeholder="Filtrar linhas" />
        <span className="logs-source">{query.data?.isExactDiscloudSnapshot ? 'Discloud API' : 'Espelho do processo'}</span>
        <button className="icon-button" type="button" title="Copiar logs" aria-label="Copiar logs" onClick={() => void copyLogs()}>{copied ? <Check aria-hidden="true" /> : <Clipboard aria-hidden="true" />}</button>
        <button className="icon-button" type="button" title="Baixar logs" aria-label="Baixar logs" onClick={downloadLogs}><Download aria-hidden="true" /></button>
      </div>
      <section className="page-section logs-console" aria-label="Terminal do bot">
        {query.isPending ? <LoadingState label="Carregando logs" /> : null}
        {query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : null}
        {query.data ? <>
          <header><Terminal aria-hidden="true" /><strong>admin-dta-bot</strong><time dateTime={query.data.fetchedAt}>Atualizado {formatDateTime(query.data.fetchedAt)}</time></header>
          <pre tabIndex={0}>{content || 'Nenhuma linha corresponde ao filtro.'}</pre>
        </> : null}
      </section>
    </div>
  );
}
