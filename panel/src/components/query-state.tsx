import { AlertTriangle, Database, RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';

export function LoadingState({ rows = 5, label = 'Carregando dados' }: { rows?: number; label?: string }) {
  return (
    <div className="skeleton-list" aria-busy="true" aria-label={label}>
      {Array.from({ length: rows }, (_, index) => (
        <div className="skeleton-row" key={index}>
          <span className="skeleton skeleton--wide" />
          <span className="skeleton skeleton--medium" />
          <span className="skeleton skeleton--short" />
        </div>
      ))}
    </div>
  );
}

export function ErrorState({
  error,
  onRetry,
}: {
  error: Error;
  onRetry: () => void;
}) {
  return (
    <div className="query-state query-state--error" role="alert">
      <AlertTriangle aria-hidden="true" />
      <div>
        <strong>Não foi possível carregar esta área</strong>
        <p>{error.message}</p>
      </div>
      <button className="button button--secondary" type="button" onClick={onRetry}>
        <RefreshCw aria-hidden="true" />
        Tentar novamente
      </button>
    </div>
  );
}

export function EmptyState({ title, description, icon }: {
  title: string;
  description: string;
  icon?: ReactNode;
}) {
  return (
    <div className="query-state query-state--empty">
      {icon ?? <Database aria-hidden="true" />}
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
    </div>
  );
}
