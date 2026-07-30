import { Bot, CircleCheck, LogIn, ShieldCheck } from 'lucide-react';
import { Brand } from '../components/brand';
import { ErrorState, LoadingState } from '../components/query-state';
import { useHealth } from '../hooks/use-panel-data';
import { isMockMode } from '../lib/api';

export function LoginPage() {
  const health = useHealth();
  const loginHref = isMockMode ? '/?mockAuth=logged-in' : '/api/auth/login';

  return (
    <main className="login-page">
      <section className="login-panel" aria-labelledby="login-title">
        <Brand />
        <div className="login-panel__heading">
          <span className="eyebrow">Central operacional</span>
          <h1 id="login-title">Acesse com sua conta do Discord</h1>
          <p>Somente servidores conectados ao Dark Bot e autorizados para sua conta serão exibidos.</p>
        </div>

        <a className="button button--discord button--wide" href={loginHref}>
          <LogIn aria-hidden="true" />
          Entrar com Discord
        </a>

        <div className="login-panel__access">
          <ShieldCheck aria-hidden="true" />
          <div>
            <strong>Acesso restrito à staff</strong>
            <span>Dono, Gerenciar Servidor ou cargo administrativo configurado.</span>
          </div>
        </div>

        <div className="service-check" aria-live="polite">
          {health.isPending ? <LoadingState rows={1} label="Verificando o bot" /> : null}
          {health.isError ? <ErrorState error={health.error} onRetry={() => void health.refetch()} /> : null}
          {health.data ? (
            <>
              <span className={`service-check__icon ${health.data.botReady ? 'service-check__icon--online' : ''}`}>
                {health.data.botReady ? <CircleCheck aria-hidden="true" /> : <Bot aria-hidden="true" />}
              </span>
              <div>
                <strong>{health.data.botReady ? 'Dark Bot online' : 'Dark Bot iniciando'}</strong>
                <span>{health.data.guildCount} servidores conectados</span>
              </div>
            </>
          ) : null}
        </div>
      </section>
    </main>
  );
}
