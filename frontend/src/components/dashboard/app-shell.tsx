'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
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
  onSignOut: () => void;
  children: ReactNode;
}

/**
 * Shell del panel (barra superior + navegacion lateral + contenido).
 *
 * RF-001: los modulos se filtran por rol con `navItemsForRole`. Los modulos
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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const navItems = navItemsForRole(user.role);

  return (
    <div className="min-h-screen bg-surface">
      <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
        <div className="flex h-16 items-center gap-3 px-4 lg:px-6">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-brand-50 hover:text-ink lg:hidden"
            aria-label="Abrir menú de navegación"
          >
            <Icon name="menu" className="h-5 w-5" />
          </button>

          <Link href="/dashboard" className="flex shrink-0 items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-brand-800 to-brand-500 text-white shadow-sm">
              <Icon name="athenea" className="h-5 w-5" />
            </span>
            <span className="leading-tight">
              <span className="block text-[15px] font-semibold tracking-tight text-ink">
                Athenea Manager
              </span>
              <span className="block text-[10px] font-medium uppercase tracking-[0.08em] text-muted">
                Gestión de Investigación Científica · UNIPOLI
              </span>
            </span>
          </Link>

          <label className="relative mx-auto hidden w-full max-w-md md:block">
            <span className="sr-only">Búsqueda global</span>
            <Icon
              name="search"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
            />
            <input
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={searchPlaceholder}
              className="h-9 w-full rounded-full border border-transparent bg-[#f1f3f9] pl-9 pr-4 text-sm text-ink placeholder:text-[#8a93a8] focus:border-brand-300 focus:bg-white focus:outline-none"
            />
          </label>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <div
              className="hidden shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink sm:flex"
              title="El rol lo asigna la administración y no puede cambiarse desde el cliente (RF-001)."
            >
              <span className="h-2 w-2 rounded-full bg-brand-500" />
              Rol: {ROLE_LABELS[user.role]}
              <Icon name="chevronDown" className="h-3.5 w-3.5 text-muted" />
            </div>

            <button
              type="button"
              className="relative grid h-9 w-9 place-items-center rounded-lg border border-line text-muted transition hover:text-ink"
              aria-label="Notificaciones"
            >
              <Icon name="bell" className="h-4 w-4" />
              <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-red-500 ring-2 ring-white" />
            </button>

            <div className="flex items-center gap-2.5 border-l border-line pl-2 sm:pl-3">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-brand-600 to-brand-400 text-xs font-semibold text-white">
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
      </header>

      {/* Navegacion de escritorio */}
      <aside className="fixed bottom-0 left-0 top-16 z-30 hidden w-64 border-r border-line bg-white lg:block">
        <SidebarContent
          user={user}
          activeId={activeId}
          navItems={navItems}
          onSignOut={onSignOut}
        />
      </aside>

      {/* Navegacion movil */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-ink/30 backdrop-blur-[1px]"
            aria-label="Cerrar menú de navegación"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <span className="text-sm font-semibold text-ink">Navegación</span>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-brand-50"
                aria-label="Cerrar menú"
              >
                <Icon name="close" className="h-4 w-4" />
              </button>
            </div>
            <SidebarContent
              user={user}
              activeId={activeId}
              navItems={navItems}
              onSignOut={onSignOut}
              onNavigate={() => setDrawerOpen(false)}
            />
          </div>
        </div>
      )}

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
  onNavigate,
}: {
  user: DashboardUser;
  activeId: string;
  navItems: ReturnType<typeof navItemsForRole>;
  onSignOut: () => void;
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
                  : 'mt-0.5 h-[18px] w-[18px] text-muted'
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
                className="flex items-start gap-3 rounded-lg bg-gradient-to-r from-brand-900 to-brand-700 px-3 py-2.5 text-white shadow-sm"
              >
                {icon}
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-semibold">
                    {item.label}
                  </span>
                  <span className="block truncate text-[10px] text-white/70">
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
              className={`group flex items-start gap-3 rounded-lg px-3 py-2.5 text-ink transition hover:bg-brand-50 ${
                item.compact ? 'pl-9' : ''
              }`}
            >
              {icon}
              <span className="min-w-0">
                <span
                  className={`block truncate font-medium ${
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
        <div className="rounded-lg border border-line bg-[#f8f9fd] p-3">
          <div className="flex items-center justify-between text-xs font-semibold text-ink">
            <span className="flex items-center gap-1.5">
              <Icon name="shield" className="h-4 w-4 text-brand-600" />
              Almacenamiento Seguro
            </span>
            <span>68%</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#e2e7f3]">
            <div className="h-full w-[68%] rounded-full bg-brand-600" />
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-muted">
            Cifrado AES-256-GCM Activo
            <br />
            Cumplimiento LFPDPPP / UNIPOLI
          </p>
        </div>

        <button
          type="button"
          onClick={onSignOut}
          className="mt-3 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium text-muted transition hover:bg-red-50 hover:text-red-700"
        >
          <Icon name="logout" className="h-4 w-4" />
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
