'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { Drawer } from '@/components/ui/drawer';
import { Spinner } from '@/components/ui/spinner';
import { Icon } from './icons';
import {
  ROLE_LABELS,
  initials,
  navItemsForRole,
  sidebarTitleForRole,
  type DashboardUser,
} from '@/lib/dashboard';

interface AppShellProps {
  user: DashboardUser;
  activeId?: string;
  searchQuery: string;
  searchPlaceholder: string;
  onSearchChange: (value: string) => void;
  onSignOut: () => void | Promise<void>;
  children: ReactNode;
}

/**
 * Shell del panel (barra superior + navegacion lateral + contenido).
 *
 * Los modulos se filtran por rol con `navItemsForRole`. Los modulos
 * que aun no tienen pantalla se muestran deshabilitados (sin `href`) para
 * conservar el mapa de navegacion institucional sin romper la experiencia.
 */
export function AppShell({
  user,
  activeId = 'panel',
  searchQuery,
  searchPlaceholder,
  onSearchChange,
  onSignOut,
  children,
}: AppShellProps) {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const navItems = navItemsForRole(user.role);

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = searchQuery.trim();
    if (query.length > 0) {
      router.push(`/search?q=${encodeURIComponent(query)}`);
      setMobileSearchOpen(false);
    }
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await onSignOut();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface">
      <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
        <div className="flex h-16 items-center gap-3 px-4 lg:px-6">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="grid h-9 w-9 place-items-center rounded-lg text-muted transition-colors duration-150 hover:bg-brand-50 hover:text-ink lg:hidden"
            aria-label="Abrir menú de navegación"
            aria-expanded={drawerOpen}
          >
            <Icon name="menu" className="h-5 w-5" />
          </button>

          <Link
            href="/dashboard"
            className="flex shrink-0 items-center gap-2.5 rounded-lg"
          >
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-brand-800 to-brand-500 text-white shadow-card">
              <Icon name="athenea" className="h-5 w-5" />
            </span>
            <span className="leading-tight">
              <span className="block text-[15px] font-semibold tracking-tight text-ink">
                Athenea Manager
              </span>
              <span className="hidden text-[10px] font-medium uppercase tracking-[0.08em] text-muted sm:block">
                Gestión de Investigación Científica · UNIPOLI
              </span>
            </span>
          </Link>

          <form
            onSubmit={submitSearch}
            role="search"
            className="relative mx-auto hidden w-full max-w-md md:block"
          >
            <label className="relative block">
              <span className="sr-only">Búsqueda global</span>
              <Icon
                name="search"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
              />
              <input
                value={searchQuery}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder={searchPlaceholder}
                className="h-9 w-full rounded-full border border-transparent bg-surface-3 pl-9 pr-4 text-sm text-ink transition-colors duration-150 placeholder:text-muted hover:bg-surface-2 focus:border-brand-300 focus:bg-white"
              />
            </label>
          </form>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setMobileSearchOpen((open) => !open)}
              aria-expanded={mobileSearchOpen}
              aria-controls="mobile-search"
              aria-label="Buscar"
              className="grid h-9 w-9 place-items-center rounded-lg text-muted transition-colors duration-150 hover:bg-brand-50 hover:text-ink md:hidden"
            >
              <Icon name="search" className="h-[18px] w-[18px]" />
            </button>

            <div
              className="hidden shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink md:flex"
              title="El rol lo asigna la administración y no puede cambiarse desde el cliente."
            >
              <span aria-hidden="true" className="h-2 w-2 rounded-full bg-brand-500" />
              Rol: {ROLE_LABELS[user.role]}
            </div>

            <NotificationBell />

            <div className="flex items-center gap-2.5 border-l border-line pl-2 sm:pl-3">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-brand-600 to-brand-400 text-xs font-semibold text-white ring-1 ring-inset ring-white/20">
                {initials(user.name)}
              </span>
              <span className="hidden leading-tight sm:block">
                <span className="block max-w-[170px] truncate text-[13px] font-semibold text-ink">
                  {user.name}
                </span>
                <span className="block text-[11px] text-muted">
                  {ROLE_LABELS[user.role]}
                </span>
              </span>
            </div>
          </div>
        </div>

        {mobileSearchOpen && (
          <div
            id="mobile-search"
            className="animate-fade-in border-t border-line px-4 py-2.5 md:hidden"
          >
            <form onSubmit={submitSearch} role="search" className="relative">
              <label className="relative block">
                <span className="sr-only">Búsqueda global</span>
                <Icon
                  name="search"
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
                />
                <input
                  autoFocus
                  value={searchQuery}
                  onChange={(event) => onSearchChange(event.target.value)}
                  placeholder={searchPlaceholder}
                  className="h-10 w-full rounded-lg border border-line-strong bg-surface-2 pl-9 pr-4 text-sm text-ink placeholder:text-muted focus:border-brand-300 focus:bg-white"
                />
              </label>
            </form>
          </div>
        )}
      </header>

      {/* Navegacion de escritorio */}
      <aside className="fixed bottom-0 left-0 top-16 z-30 hidden w-64 border-r border-line bg-white lg:block">
        <SidebarContent
          user={user}
          activeId={activeId}
          navItems={navItems}
          onSignOut={handleSignOut}
          signingOut={signingOut}
        />
      </aside>

      {/* Navegacion movil */}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Navegación"
        description={sidebarTitleForRole(user.role)}
        className="lg:hidden"
      >
        <SidebarContent
          user={user}
          activeId={activeId}
          navItems={navItems}
          onSignOut={handleSignOut}
          signingOut={signingOut}
          onNavigate={() => setDrawerOpen(false)}
        />
      </Drawer>

      <div className="lg:pl-64">
        <main className="mx-auto w-full max-w-[1400px] px-4 py-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}

function SidebarContent({
  user,
  activeId,
  navItems,
  onSignOut,
  signingOut = false,
  onNavigate,
}: {
  user: DashboardUser;
  activeId: string;
  navItems: ReturnType<typeof navItemsForRole>;
  onSignOut: () => void;
  signingOut?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full flex-col overflow-y-auto px-3 py-5">
      <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
        {sidebarTitleForRole(user.role)}
      </p>

      <nav className="mt-3 space-y-1" aria-label="Módulos del panel">
        {navItems.map((item) => {
          const isActive = item.id === activeId;
          const icon = (
            <Icon
              name={item.icon}
              className={
                isActive
                  ? 'mt-0.5 h-[18px] w-[18px] text-white'
                  : 'mt-0.5 h-[18px] w-[18px] text-muted transition-colors duration-150 group-hover:text-brand-700'
              }
            />
          );

          if (!item.href) {
            return (
              <span
                key={item.id}
                aria-disabled="true"
                title={`${item.label}: módulo aún no implementado`}
                className="flex cursor-default items-start gap-3 rounded-lg px-3 py-2.5 text-muted/75"
              >
                {icon}
                <span className="min-w-0">
                  <span className="block text-[12px] font-medium leading-snug">
                    {item.label}
                  </span>
                  <span className="block text-[9.5px] leading-snug text-muted/80">
                    Módulo próximamente
                  </span>
                </span>
              </span>
            );
          }

          if (isActive) {
            return (
              <Link
                key={item.id}
                href={item.href}
                onClick={onNavigate}
                aria-current="page"
                className="flex items-start gap-3 rounded-lg bg-gradient-to-r from-brand-900 to-brand-700 px-3 py-2.5 text-white shadow-card"
              >
                {icon}
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold leading-snug">
                    {item.label}
                  </span>
                  <span className="block truncate text-[10px] text-white/75">
                    {item.subtitle}
                  </span>
                </span>
              </Link>
            );
          }

          return (
            <Link
              key={item.id}
              href={item.href}
              onClick={onNavigate}
              className={`group flex items-start gap-3 rounded-lg px-3 py-2.5 text-ink transition-colors duration-150 hover:bg-brand-50 ${
                item.compact ? 'pl-9' : ''
              }`}
            >
              {icon}
              <span className="min-w-0">
                <span
                  className={`block font-medium leading-snug ${
                    item.compact ? 'text-[12px]' : 'text-[13px]'
                  }`}
                >
                  {item.label}
                </span>
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto pt-6">
        <div className="rounded-lg border border-line bg-surface-2 p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-ink">
            <Icon name="shield" className="h-4 w-4 text-brand-600" />
            Documentos protegidos
          </p>
          <p className="mt-1.5 text-[10px] leading-relaxed text-muted">
            Cifrado AES-256-GCM en reposo y control de acceso por rol.
            Cumplimiento LFPDPPP / UNIPOLI.
          </p>
        </div>

        <button
          type="button"
          onClick={onSignOut}
          disabled={signingOut}
          className="mt-3 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium text-muted transition-colors duration-150 hover:bg-danger-soft hover:text-danger disabled:opacity-60"
        >
          {signingOut ? (
            <Spinner className="h-4 w-4" />
          ) : (
            <Icon name="logout" className="h-4 w-4" />
          )}
          {signingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}
        </button>
      </div>
    </div>
  );
}
