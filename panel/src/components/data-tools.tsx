import { RefreshCw, Search } from 'lucide-react';

export function SearchField({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
}) {
  return (
    <label className="search-field">
      <span className="sr-only">{label}</span>
      <Search aria-hidden="true" />
      <input
        type="search"
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

export function RefreshButton({
  onRefresh,
  isRefreshing,
}: {
  onRefresh: () => void;
  isRefreshing: boolean;
}) {
  return (
    <button
      className="icon-button"
      type="button"
      aria-label="Atualizar dados"
      title="Atualizar dados"
      onClick={onRefresh}
      disabled={isRefreshing}
    >
      <RefreshCw className={isRefreshing ? 'spin' : ''} aria-hidden="true" />
    </button>
  );
}

export function ResultsCount({ count, singular, plural }: {
  count: number;
  singular: string;
  plural: string;
}) {
  return <span className="results-count">{count} {count === 1 ? singular : plural}</span>;
}
