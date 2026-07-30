interface BrandProps {
  compact?: boolean;
}

export function Brand({ compact = false }: BrandProps) {
  return (
    <div className={`brand ${compact ? 'brand--compact' : ''}`}>
      <img className="brand__logo" src="/dta-symbol.png" alt="" />
      <div className="brand__text">
        <strong>Dark Trials Arena</strong>
        <span>Painel administrativo</span>
      </div>
    </div>
  );
}
