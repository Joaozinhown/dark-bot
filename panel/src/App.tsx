import { AlertTriangle } from 'lucide-react';
import { Route, Switch, useLocation } from 'wouter';
import { AppShell } from './components/app-shell';
import { LoadingState } from './components/query-state';
import { GuildProvider } from './context/guild-context';
import { useSession } from './hooks/use-panel-data';
import { ApiError } from './lib/api';
import { AuditPage } from './pages/audit-page';
import { CommandsPage } from './pages/commands-page';
import { ConfrontationsPage } from './pages/confrontations-page';
import { LoginPage } from './pages/login-page';
import { LogsPage } from './pages/logs-page';
import { NoAccessPage } from './pages/no-access-page';
import { NotFoundPage } from './pages/not-found-page';
import { OverviewPage } from './pages/overview-page';
import { PoolsPage } from './pages/pools-page';
import { RankingPage } from './pages/ranking-page';
import { TeamsPage } from './pages/teams-page';

function SessionLoading() {
  return (
    <main className="session-loading">
      <div>
        <span className="eyebrow">DTA Admin</span>
        <LoadingState rows={3} label="Validando sessão" />
      </div>
    </main>
  );
}

function SessionFailure({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <main className="session-failure">
      <AlertTriangle aria-hidden="true" />
      <h1>Painel indisponível</h1>
      <p>{error.message}</p>
      <button className="button button--secondary" type="button" onClick={onRetry}>Tentar novamente</button>
    </main>
  );
}

function AuthenticatedRoutes() {
  return (
    <Switch>
      <Route path="/" component={OverviewPage} />
      <Route path="/confrontos" component={ConfrontationsPage} />
      <Route path="/pools" component={PoolsPage} />
      <Route path="/equipes" component={TeamsPage} />
      <Route path="/comandos" component={CommandsPage} />
      <Route path="/ranking" component={RankingPage} />
      <Route path="/auditoria" component={AuditPage} />
      <Route path="/logs" component={LogsPage} />
      <Route component={NotFoundPage} />
    </Switch>
  );
}

export function App() {
  const [location] = useLocation();
  const session = useSession();

  if (location === '/auth-error') return <NoAccessPage />;

  if (session.isPending) return <SessionLoading />;
  if (session.isError) {
    const isUnauthenticated = session.error instanceof ApiError && session.error.status === 401;
    if (isUnauthenticated) return <LoginPage />;
    return <SessionFailure error={session.error} onRetry={() => void session.refetch()} />;
  }

  return (
    <GuildProvider>
      <AppShell session={session.data}>
        <AuthenticatedRoutes />
      </AppShell>
    </GuildProvider>
  );
}
