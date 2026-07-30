import { CircleAlert, CircleCheck, Clock3, WifiOff } from 'lucide-react';
import { labelStatus } from '../lib/format';

type StatusTone = 'success' | 'warning' | 'danger' | 'neutral' | 'accent' | 'gold';

function getTone(status: string): StatusTone {
  if (['ready', 'ativo', 'encerrado', 'connected'].includes(status)) return 'success';
  if (['resultado', 'starting', 'reconnecting'].includes(status)) return 'warning';
  if (['erro', 'inativo', 'disconnected'].includes(status)) return 'danger';
  if (['veto', 'em_andamento'].includes(status)) return 'accent';
  if (['vencedor'].includes(status)) return 'gold';
  return 'neutral';
}

function StatusIcon({ tone }: { tone: StatusTone }) {
  if (tone === 'success') return <CircleCheck aria-hidden="true" />;
  if (tone === 'warning') return <Clock3 aria-hidden="true" />;
  if (tone === 'danger') return <WifiOff aria-hidden="true" />;
  return <CircleAlert aria-hidden="true" />;
}

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const tone = getTone(status);
  return (
    <span className={`status-badge status-badge--${tone}`}>
      <StatusIcon tone={tone} />
      {label ?? labelStatus(status)}
    </span>
  );
}
