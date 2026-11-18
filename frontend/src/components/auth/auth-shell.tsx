'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { cn } from '@/lib/cn';

/** Enlace de texto del pie de las tarjetas de autenticación. */
export const authLinkClass =
  'font-semibold text-brand-700 underline-offset-4 transition-colors duration-150 hover:text-brand-800 hover:underline';

/**
 * Marco común de las pantallas de autenticación: marca, tarjeta centrada y
 * nota institucional al pie. Todas las pantallas comparten el mismo ritmo
 * vertical y el mismo ancho de lectura.
 */
export function AuthCard({
  title,
  description,
  children,
  footer,
  icon,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-surface px-4 py-10">
      <Link
        href="/login"
        className="mb-6 flex items-center gap-2.5 rounded-lg"
        aria-label="Athenea Manager"
      >
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-brand-800 to-brand-500 text-white shadow-card">
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 3 4.5 6.2v5.4c0 4.4 3.1 8.3 7.5 9.4 4.4-1.1 7.5-5 7.5-9.4V6.2L12 3Z" />
            <path d="m9 12 2.2 2.2L15 10.5" />
          </svg>
        </span>
        <span className="leading-tight">
          <span className="block text-[15px] font-semibold tracking-tight text-ink">
            Athenea Manager
          </span>
          <span className="block text-[10px] font-medium uppercase tracking-[0.08em] text-muted">
            Gestión de Investigación Científica
          </span>
        </span>
      </Link>

      <section className="w-full max-w-[26rem] animate-fade-up rounded-2xl border border-line bg-white p-7 shadow-card sm:p-8">
        {icon && <div className="mb-4">{icon}</div>}
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-ink">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            {description}
          </p>
        )}
        <div className="mt-6">{children}</div>
        {footer && (
          <div className="mt-6 border-t border-line pt-4 text-center text-[13px] text-muted">
            {footer}
          </div>
        )}
      </section>

      <p className="mt-6 text-center text-[11px] text-muted">
        Acceso institucional · Universidad Politécnica de Durango
      </p>
    </main>
  );
}

/** Separador "o continúa con" entre el formulario y el acceso federado. */
export function AuthDivider({ children }: { children: ReactNode }) {
  return (
    <div className="my-5 flex items-center gap-3">
      <span aria-hidden="true" className="h-px flex-1 bg-line" />
      <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
        {children}
      </span>
      <span aria-hidden="true" className="h-px flex-1 bg-line" />
    </div>
  );
}

/** Botón de Google: única alternativa federada, visualmente secundaria. */
export function GoogleButton({
  onClick,
  loading,
  label,
}: {
  onClick: () => void;
  loading: boolean;
  label: string;
}) {
  return (
    <Button
      variant="secondary"
      fullWidth
      onClick={onClick}
      loading={loading}
      leadingIcon={
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
          <path
            fill="#4285F4"
            d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.7v3h3.9c2.3-2.1 3.5-5.2 3.5-8.9Z"
          />
          <path
            fill="#34A853"
            d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2a7 7 0 0 1-6.6-4.8H1.4v3.1A12 12 0 0 0 12 24Z"
          />
          <path
            fill="#FBBC05"
            d="M5.4 14.5a7.2 7.2 0 0 1 0-4.6V6.8H1.4a12 12 0 0 0 0 10.8l4-3.1Z"
          />
          <path
            fill="#EA4335"
            d="M12 4.8c1.8 0 3.4.6 4.6 1.8l3.5-3.5A12 12 0 0 0 1.4 6.8l4 3.1A7 7 0 0 1 12 4.8Z"
          />
        </svg>
      }
    >
      {label}
    </Button>
  );
}

const STRENGTH_LEVELS = [
  { label: 'Muy débil', tone: 'bg-danger', bars: 1 },
  { label: 'Débil', tone: 'bg-danger', bars: 1 },
  { label: 'Aceptable', tone: 'bg-amber-500', bars: 2 },
  { label: 'Fuerte', tone: 'bg-success', bars: 3 },
  { label: 'Muy fuerte', tone: 'bg-success', bars: 4 },
] as const;

export function passwordStrength(value: string): number {
  if (value.length === 0) {
    return 0;
  }
  let score = 0;
  if (value.length >= 8) score += 1;
  if (value.length >= 12) score += 1;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1;
  if (/\d/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;
  return Math.min(5, score);
}

/** Medidor de fuerza: cuatro segmentos y una etiqueta que se anuncia. */
export function PasswordStrength({ value }: { value: string }) {
  const score = passwordStrength(value);
  if (score === 0) {
    return null;
  }
  const level = STRENGTH_LEVELS[score];
  return (
    <div className="mt-2">
      <div className="flex gap-1" aria-hidden="true">
        {[0, 1, 2, 3].map((index) => (
          <span
            key={index}
            className={cn(
              'h-1 flex-1 rounded-full transition-colors duration-200',
              index < level.bars ? level.tone : 'bg-surface-3',
            )}
          />
        ))}
      </div>
      <p aria-live="polite" className="mt-1.5 text-[11px] text-muted">
        Seguridad: <span className="font-medium text-ink">{level.label}</span>
      </p>
    </div>
  );
}

/** Campo de contraseña con mostrar/ocultar y medidor opcional. */
export function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  error,
  hint,
  showStrength = false,
  required = true,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: 'current-password' | 'new-password';
  error?: string;
  hint?: string;
  showStrength?: boolean;
  required?: boolean;
  placeholder?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <Input
        id={id}
        label={label}
        type={visible ? 'text' : 'password'}
        autoComplete={autoComplete}
        required={required}
        minLength={8}
        maxLength={64}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        error={error}
        hint={hint}
        trailing={
          <button
            type="button"
            onClick={() => setVisible((current) => !current)}
            aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            aria-controls={id}
            aria-pressed={visible}
            className="grid h-8 w-8 place-items-center rounded-md text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-ink"
          >
            {visible ? (
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M3 3l18 18M10.6 10.7a2 2 0 0 0 2.8 2.8M9.9 5.2A9.4 9.4 0 0 1 12 5c5.5 0 9 5.2 9 7 0 .9-.8 2.3-2.2 3.6M6.2 6.7C3.9 8.2 3 10.2 3 12c0 1.8 3.5 7 9 7 1.2 0 2.4-.3 3.4-.7" />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M3 12c0-1.8 3.5-7 9-7s9 5.2 9 7-3.5 7-9 7-9-5.2-9-7Z" />
                <circle cx="12" cy="12" r="2.6" />
              </svg>
            )}
          </button>
        }
      />
      {showStrength && <PasswordStrength value={value} />}
    </div>
  );
}
