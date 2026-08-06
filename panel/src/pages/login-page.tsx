import { Bot, CircleCheck, LogIn, ShieldCheck } from 'lucide-react';
import { Brand } from '../components/brand';
import { LanguageSelector } from '../components/language-selector';
import { ErrorState, LoadingState } from '../components/query-state';
import { useLocale } from '../hooks/use-locale';
import { useHealth } from '../hooks/use-panel-data';
import { isMockMode } from '../lib/api';
import { loginTranslations } from '../lib/i18n/login';

export function LoginPage() {
  const health = useHealth();
  const loginHref = isMockMode ? '/?mockAuth=logged-in' : '/api/auth/login';
  const [locale, setLocale] = useLocale();
  const t = loginTranslations[locale];

  return (
    <main className="login-page">
      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-panel__top-bar">
          <Brand />
          <LanguageSelector current={locale} onChange={setLocale} />
        </div>

        <div className="login-panel__heading">
          <span className="eyebrow">{t.eyebrow}</span>
          <h1 id="login-title">{t.title}</h1>
          <p>{t.description}</p>
        </div>

        <a className="button button--discord button--wide" href={loginHref}>
          <LogIn aria-hidden="true" />
          {t.loginButton}
        </a>

        <div className="login-panel__access">
          <ShieldCheck aria-hidden="true" />
          <div>
            <strong>{t.accessTitle}</strong>
            <span>{t.accessDescription}</span>
          </div>
        </div>

        <div className="service-check" aria-live="polite">
          {health.isPending ? <LoadingState rows={1} label={t.checkingBot} /> : null}
          {health.isError ? <ErrorState error={health.error} onRetry={() => void health.refetch()} /> : null}
          {health.data ? (
            <>
              <span className={`service-check__icon ${health.data.botReady ? 'service-check__icon--online' : ''}`}>
                {health.data.botReady ? <CircleCheck aria-hidden="true" /> : <Bot aria-hidden="true" />}
              </span>
              <div>
                <strong>{health.data.botReady ? t.botOnline : t.botStarting}</strong>
                <span>{t.serversConnected(health.data.guildCount)}</span>
              </div>
            </>
          ) : null}
        </div>
      </section>
    </main>
  );
}
