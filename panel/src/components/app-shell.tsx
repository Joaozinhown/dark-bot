import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  BookOpenCheck,
  Bot,
  ChevronDown,
  CircleUserRound,
  Command,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Medal,
  ScrollText,
  ShieldCheck,
  Swords,
  Terminal,
  UsersRound,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation, useRoute } from 'wouter';
import { useGuildContext } from '../context/guild-context';
import { useRealtimeSync } from '../hooks/use-realtime-sync';
import { isMockMode, panelApi } from '../lib/api';
import { labelAccessSource } from '../lib/format';
import type { Session } from '../types/api';
import { Brand } from './brand';
import { GuildSelector } from './guild-selector';

interface NavigationItem {
  href: string;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
}

const navigation: NavigationItem[] = [
  { href: '/', label: 'Visão geral', shortLabel: 'Início', icon: LayoutDashboard },
  { href: '/confrontos', label: 'Confrontos', shortLabel: 'Confrontos', icon: Swords },
  { href: '/pools', label: 'Pools', shortLabel: 'Pools', icon: BookOpenCheck },
  { href: '/equipes', label: 'Equipes e cargos', shortLabel: 'Equipes', icon: UsersRound },
  { href: '/comandos', label: 'Comandos', shortLabel: 'Comandos', icon: Command },
  { href: '/ranking', label: 'Ranking', shortLabel: 'Ranking', icon: Medal },
  { href: '/auditoria', label: 'Auditoria', shortLabel: 'Auditoria', icon: ScrollText },
  { href: '/logs', label: 'Logs', shortLabel: 'Logs', icon: Terminal },
];

function NavigationLink({ item, onNavigate }: { item: NavigationItem; onNavigate?: () => void }) {
  const [isMatch] = useRoute(item.href);
  const [location] = useLocation();
  const isActive = item.href === '/' ? location === '/' : isMatch;
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className={`navigation-link ${isActive ? 'navigation-link--active' : ''}`}
      aria-current={isActive ? 'page' : undefined}
      data-tooltip={item.label}
      onClick={onNavigate}
    >
      <Icon aria-hidden="true" />
      <span>{item.label}</span>
    </Link>
  );
}

function RealtimeIndicator({ status }: { status: 'connected' | 'reconnecting' | 'idle' }) {
  const label = status === 'connected'
    ? 'Tempo real conectado'
    : status === 'reconnecting'
      ? 'Reconectando dados'
      : 'Aguardando servidor';
  return (
    <span className={`realtime realtime--${status}`} aria-live="polite">
      <Activity aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

function UserMenu({ session }: { session: Session }) {
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const logout = useMutation({
    mutationFn: panelApi.logout,
    onSuccess: () => {
      queryClient.clear();
      if (isMockMode) {
        window.location.assign('/?mockAuth=logged-out');
        return;
      }
      navigate('/');
      window.location.reload();
    },
  });

  return (
    <div className="user-menu">
      <button
        className="user-menu__trigger"
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        onClick={() => setIsOpen(value => !value)}
      >
        <span className="avatar" aria-hidden="true">{session.username.slice(0, 2).toUpperCase()}</span>
        <span className="user-menu__name">{session.username}</span>
        <ChevronDown aria-hidden="true" />
      </button>
      {isOpen ? (
        <div className="user-menu__popover" role="menu">
          <div className="user-menu__identity">
            <CircleUserRound aria-hidden="true" />
            <div>
              <strong>{session.username}</strong>
              <span>ID {session.userId}</span>
            </div>
          </div>
          {logout.error ? <p className="inline-error" role="alert">{logout.error.message}</p> : null}
          <button
            className="menu-command"
            type="button"
            role="menuitem"
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
          >
            <LogOut aria-hidden="true" />
            {logout.isPending ? 'Saindo...' : 'Sair do painel'}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function MobileNavigation() {
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [location] = useLocation();
  const primary = navigation.slice(0, 4);
  const secondary = navigation.slice(4);

  useEffect(() => setIsMoreOpen(false), [location]);
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsMoreOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, []);

  return (
    <>
      {isMoreOpen ? (
        <div className="mobile-more" role="dialog" aria-modal="true" aria-label="Mais áreas">
          <button className="mobile-more__backdrop" type="button" aria-label="Fechar menu" onClick={() => setIsMoreOpen(false)} />
          <div className="mobile-more__sheet">
            <div className="mobile-more__header">
              <strong>Mais áreas</strong>
              <button className="icon-button" type="button" aria-label="Fechar menu" onClick={() => setIsMoreOpen(false)}>
                <X aria-hidden="true" />
              </button>
            </div>
            {secondary.map(item => <NavigationLink key={item.href} item={item} />)}
          </div>
        </div>
      ) : null}
      <nav className="mobile-navigation" aria-label="Navegação principal">
        {primary.map(item => {
          const Icon = item.icon;
          const isActive = item.href === '/' ? location === '/' : location.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`mobile-navigation__item ${isActive ? 'mobile-navigation__item--active' : ''}`}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon aria-hidden="true" />
              <span>{item.shortLabel}</span>
            </Link>
          );
        })}
        <button
          className={`mobile-navigation__item ${isMoreOpen ? 'mobile-navigation__item--active' : ''}`}
          type="button"
          aria-expanded={isMoreOpen}
          onClick={() => setIsMoreOpen(true)}
        >
          <Menu aria-hidden="true" />
          <span>Mais</span>
        </button>
      </nav>
    </>
  );
}

export function AppShell({ session, children }: { session: Session; children: ReactNode }) {
  const { selectedGuild, selectedGuildId, error, refetch } = useGuildContext();
  const realtime = useRealtimeSync(selectedGuildId);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        <GuildSelector />
        <nav className="sidebar__navigation" aria-label="Navegação principal">
          {navigation.map(item => <NavigationLink key={item.href} item={item} />)}
        </nav>
        <div className="sidebar__footer">
          <div className="permission-summary">
            <ShieldCheck aria-hidden="true" />
            <div>
              <span>Nível de acesso</span>
              <strong>{selectedGuild ? labelAccessSource(selectedGuild.accessSource) : 'Sem servidor'}</strong>
            </div>
          </div>
          <div className="bot-signature"><Bot aria-hidden="true" /> Dark Bot</div>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div className="topbar__mobile-brand"><Brand compact /></div>
          <div className="topbar__server"><GuildSelector /></div>
          <div className="topbar__tools">
            <RealtimeIndicator status={realtime.status} />
            <UserMenu session={session} />
          </div>
        </header>
        {error ? (
          <div className="global-alert" role="alert">
            <span>Não foi possível atualizar a lista de servidores. Os últimos dados continuam visíveis.</span>
            <button type="button" onClick={refetch}>Tentar novamente</button>
          </div>
        ) : null}
        <main className="workspace__content" id="conteudo-principal">{children}</main>
      </div>
      <MobileNavigation />
    </div>
  );
}
