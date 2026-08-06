import ReactCountryFlag from 'react-country-flag';
import type { SupportedLocale } from '../lib/i18n/core';

interface Option {
  locale: SupportedLocale;
  countryCode: string;
  label: string;
}

const OPTIONS: Option[] = [
  { locale: 'pt-BR', countryCode: 'BR', label: 'Português' },
  { locale: 'en-US', countryCode: 'US', label: 'English' },
  { locale: 'es-ES', countryCode: 'ES', label: 'Español' },
];

interface Props {
  current: SupportedLocale;
  onChange: (locale: SupportedLocale) => void;
}

export function LanguageSelector({ current, onChange }: Props) {
  return (
    <div className="language-selector" role="group" aria-label="Language / Idioma">
      {OPTIONS.map(({ locale, countryCode, label }) => (
        <button
          key={locale}
          type="button"
          className={`language-selector__option${locale === current ? ' language-selector__option--active' : ''}`}
          aria-pressed={locale === current}
          onClick={() => onChange(locale)}
          title={label}
        >
          <ReactCountryFlag
            countryCode={countryCode}
            svg
            aria-hidden="true"
            className="language-selector__flag"
          />
          <span className="language-selector__label">{label}</span>
        </button>
      ))}
    </div>
  );
}
