interface BrandProps {
  compact?: boolean;
}

export function Brand({ compact = false }: BrandProps) {
  return (
    <div className={`brand ${compact ? 'brand--compact' : ''}`}>
      <img className="brand__logo" src="/queens-trials-logo.png" alt="" />
      <div className="brand__text">
        <strong>Queens Trials</strong>
        <span>Administração DTA</span>
      </div>
    </div>
  );
}
