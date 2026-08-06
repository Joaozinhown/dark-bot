import { LogIn, ShieldAlert } from 'lucide-react';
import { useSearch } from 'wouter';
import { Brand } from '../components/brand';
import { LanguageSelector } from '../components/language-selector';
import { useLocale } from '../hooks/use-locale';
import { isMockMode } from '../lib/api';
import { noAccessTranslations } from '../lib/i18n/no-access';

export function NoAccessPage() {
  const search = useSearch();
  const code = new URLSearchParams(search).get('code') ?? '';
  const [locale, setLocale] = useLocale();
  const t = noAccessTranslations[locale];
  const { title, description } = t.errors[code] ?? { title: t.defaultTitle, description: t.defaultDescription };
  const loginHref = isMockMode ? '/?mockAuth=logged-in' : '/api/auth/login';

  return (
    <main className="login-page">
      <section className="login-panel" aria-labelledby="no-access-title">
        <div className="login-panel__top-bar">
          <Brand />
          <LanguageSelector current={locale} onChange={setLocale} />
        </div>

        <div className="login-panel__heading">
          <span className="eyebrow">{t.eyebrow}</span>
          <h1 id="no-access-title">{title}</h1>
          <p>{description}</p>
        </div>

        <a className="button button--discord button--wide" href={loginHref}>
          <LogIn aria-hidden="true" />
          {t.loginButton}
        </a>

        <div className="login-panel__access">
          <ShieldAlert aria-hidden="true" />
          <div>
            <strong>{t.accessTitle}</strong>
            <span>{t.accessDescription}</span>
          </div>
        </div>
      </section>
    </main>
  );
}
