const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
});

const relativeFormatter = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });

export function formatDateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Data indisponível' : dateTimeFormatter.format(date);
}

export function formatRelativeTime(value: string): string {
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return 'agora';
  const differenceMinutes = Math.round((timestamp - Date.now()) / 60_000);
  if (Math.abs(differenceMinutes) < 60) return relativeFormatter.format(differenceMinutes, 'minute');
  const differenceHours = Math.round(differenceMinutes / 60);
  if (Math.abs(differenceHours) < 24) return relativeFormatter.format(differenceHours, 'hour');
  return relativeFormatter.format(Math.round(differenceHours / 24), 'day');
}

export function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const hours = Math.floor(seconds / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  return hours > 0 ? `${hours}h ${minutes}min` : `${minutes}min`;
}

export function labelAccessSource(source: string): string {
  const labels: Record<string, string> = {
    owner: 'Dono do servidor',
    manage_guild: 'Gerenciar servidor',
    admin_role: 'Cargo administrativo',
  };
  return labels[source] ?? 'Acesso administrativo';
}

export function labelStatus(status: string): string {
  const labels: Record<string, string> = {
    veto: 'Pick/ban',
    resultado: 'Aguardando resultado',
    em_andamento: 'Em andamento',
    encerrado: 'Encerrado',
    ativo: 'Ativo',
    ready: 'Online',
    starting: 'Iniciando',
  };
  return labels[status] ?? status.replaceAll('_', ' ');
}
