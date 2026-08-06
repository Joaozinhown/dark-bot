import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, m } from 'motion/react';
import {
  Activity,
  BookOpenCheck,
  Bot,
  ChevronDown,
  CircleUserRound,
  Command,
  History,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  Medal,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  Swords,
  Terminal,
  UsersRound,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation, useRoute } from 'wouter';
import { useGuildContext } from '../context/guild-context';
import { useRealtimeSync } from '../hooks/use-realtime-sync';
import { isMockMode, panelApi } from '../lib/api';
import { labelAccessSource } from '../lib/format';
import type { Session } from '../types/api';
import { popoverVariants } from '../motion/motion-config';
import { PageTransition } from '../motion/page-transition';
import { usePanelReducedMotion } from '../motion/motion-provider';
import { Brand } from './brand';
import { GuildSelector } from './guild-selector';
import { WorkspaceScroll } from './workspace-scroll';

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
    <span className={`realtime realtime--${status}`} data-status={status} aria-live="polite">
      <Activity aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

function UserMenu({ session }: { session: Session }) {
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuItemRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const shouldReduceMotion = usePanelReducedMotion();
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

  useEffect(() => {
    if (!isOpen) return;
    const closeAndRestoreFocus = () => {
      setIsOpen(false);
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    };
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeAndRestoreFocus();
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        menuItemRef.current?.focus();
      }
    };
    const closeOutside = (event: Event) => {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target) && !triggerRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    };
    const focusFrame = window.requestAnimationFrame(() => menuItemRef.current?.focus());
    window.addEventListener('keydown', handleKeydown);
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('focusin', closeOutside);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener('keydown', handleKeydown);
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('focusin', closeOutside);
    };
  }, [isOpen]);

  return (
    <div className="user-menu">
      <button
        ref={triggerRef}
        className="user-menu__trigger"
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        onClick={() => setIsOpen(value => !value)}
        onKeyDown={event => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setIsOpen(true);
          }
        }}
      >
        <span className="avatar" aria-hidden="true">{session.username.slice(0, 2).toUpperCase()}</span>
        <span className="user-menu__name">{session.username}</span>
        <ChevronDown aria-hidden="true" />
      </button>
      <AnimatePresence>
      {isOpen ? (
        <m.div
          ref={menuRef}
          className="user-menu__popover"
          role="menu"
          aria-label="Menu do usuário"
          variants={popoverVariants(shouldReduceMotion)}
          initial="initial"
          animate="animate"
          exit="exit"
        >
          <div className="user-menu__identity">
            <CircleUserRound aria-hidden="true" />
            <div>
              <strong>{session.username}</strong>
              <span>ID {session.userId}</span>
            </div>
          </div>
          {logout.error ? <p className="inline-error" role="alert">{logout.error.message}</p> : null}
          <button
            ref={menuItemRef}
            className="menu-command"
            type="button"
            role="menuitem"
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
          >
            <LogOut aria-hidden="true" />
            {logout.isPending ? 'Saindo...' : 'Sair do painel'}
          </button>
        </m.div>
      ) : null}
      </AnimatePresence>
    </div>
  );
}

function MobileNavigation() {
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [location] = useLocation();
  const moreTriggerRef = useRef<HTMLButtonElement>(null);
  const moreSheetRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const shouldReduceMotion = usePanelReducedMotion();
  const primary = navigation.slice(0, 4);
  const secondary = navigation.slice(4);

  const closeMore = useCallback((restoreFocus = true) => {
    setIsMoreOpen(false);
    if (restoreFocus) window.requestAnimationFrame(() => moreTriggerRef.current?.focus());
  }, []);

  useEffect(() => setIsMoreOpen(false), [location]);
  useEffect(() => {
    if (!isMoreOpen) return;
    const inertElements = ['.sidebar', '.workspace', '.mobile-navigation']
      .map(selector => document.querySelector<HTMLElement>(selector))
      .filter((element): element is HTMLElement => Boolean(element));
    inertElements.forEach(element => { element.inert = true; });
    const focusFrame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMore();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(moreSheetRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])') ?? []);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    window.addEventListener('keydown', handleKeydown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener('keydown', handleKeydown);
      inertElements.forEach(element => { element.inert = false; });
    };
  }, [closeMore, isMoreOpen]);

  return (
    <>
      <AnimatePresence>
      {isMoreOpen ? (
        <m.div className="mobile-more" role="dialog" aria-modal="true" aria-label="Mais áreas" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <m.button className="mobile-more__backdrop" type="button" aria-label="Fechar menu" onClick={() => closeMore()} />
          <m.div ref={moreSheetRef} className="mobile-more__sheet" variants={popoverVariants(shouldReduceMotion, 8)} initial="initial" animate="animate" exit="exit">
            <div className="mobile-more__header">
              <strong>Mais áreas</strong>
              <button ref={closeButtonRef} className="icon-button" type="button" aria-label="Fechar menu" onClick={() => closeMore()}>
                <X aria-hidden="true" />
              </button>
            </div>
            {secondary.map(item => <NavigationLink key={item.href} item={item} />)}
          </m.div>
        </m.div>
      ) : null}
      </AnimatePresence>
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
          ref={moreTriggerRef}
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

function NoGuildsState() {
  const loginHref = isMockMode ? '/?mockAuth=logged-in' : '/api/auth/login';
  return (
    <div className="no-guilds-state" role="status">
      <ShieldAlert aria-hidden="true" />
      <h2>Nenhum servidor autorizado</h2>
      <p>
        O bot não está em nenhum servidor onde sua conta tem permissão de acesso.
        Verifique se o Dark Bot foi adicionado ao servidor e se você tem os privilégios necessários.
      </p>
      <a className="button button--secondary" href={loginHref}>
        <LogIn aria-hidden="true" />
        Tentar com outra conta
      </a>
    </div>
  );
}

export function AppShell({ session, children }: { session: Session; children: ReactNode }) {
  const { selectedGuild, selectedGuildId, error, isEmpty, refetch } = useGuildContext();
  const realtime = useRealtimeSync(selectedGuildId);
  const shouldReduceMotion = usePanelReducedMotion();
  const [isScrolled, setIsScrolled] = useState(false);
  const updateScrolled = useCallback((next: boolean) => setIsScrolled(current => current === next ? current : next), []);

  return (
    <div className="app-shell" data-reduced-motion={String(shouldReduceMotion)}>
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
        <header className={`topbar ${isScrolled ? 'topbar--scrolled' : ''}`}>
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
        <WorkspaceScroll onScrolledChange={updateScrolled} />
        <main className="workspace__content" id="conteudo-principal">
          {isEmpty ? <NoGuildsState /> : <PageTransition>{children}</PageTransition>}
        </main>
      </div>
      <MobileNavigation />
    </div>
  );
}
