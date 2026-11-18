import type {
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  ReactNode,
} from 'react';
import { cn } from '@/lib/cn';

const CONTROL =
  'w-full rounded-lg border bg-white text-sm text-ink transition-colors duration-150 placeholder:text-placeholder hover:border-brand-300 focus:border-brand-500 disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-muted';

interface FieldShellProps {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

function describedBy(id: string, hint?: string, error?: string) {
  return [hint ? `${id}-hint` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(' ');
}

function FieldShell({
  id,
  label,
  hint,
  error,
  required,
  children,
  className,
}: FieldShellProps) {
  return (
    <div className={cn('min-w-0', className)}>
      <label
        htmlFor={id}
        className="mb-1.5 flex items-baseline gap-1 text-[13px] font-medium text-ink"
      >
        {label}
        {required && (
          <span className="text-danger" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  wrapperClassName?: string;
  /** Adorno a la derecha del control (por ejemplo, mostrar contraseña). */
  trailing?: ReactNode;
}

export function Input({
  id,
  label,
  hint,
  error,
  wrapperClassName,
  className,
  required,
  trailing,
  ...props
}: InputProps) {
  return (
    <FieldShell
      id={id}
      label={label}
      hint={hint}
      error={error}
      required={required}
      className={wrapperClassName}
    >
      <div className="relative">
        <input
          id={id}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, hint, error) || undefined}
          className={cn(
            CONTROL,
            'h-10 px-3',
            trailing ? 'pr-11' : undefined,
            error
              ? 'border-danger focus:border-danger'
              : 'border-line-strong',
            className,
          )}
          {...props}
        />
        {trailing && (
          <span className="absolute inset-y-0 right-0 flex items-center pr-1.5">
            {trailing}
          </span>
        )}
      </div>
    </FieldShell>
  );
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  wrapperClassName?: string;
}

export function Select({
  id,
  label,
  hint,
  error,
  wrapperClassName,
  className,
  required,
  children,
  ...props
}: SelectProps) {
  return (
    <FieldShell
      id={id}
      label={label}
      hint={hint}
      error={error}
      required={required}
      className={wrapperClassName}
    >
      <select
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error) || undefined}
        className={cn(
          CONTROL,
          'h-10 px-3',
          error ? 'border-danger focus:border-danger' : 'border-line-strong',
          className,
        )}
        {...props}
      >
        {children}
      </select>
    </FieldShell>
  );
}

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  wrapperClassName?: string;
}

export function Textarea({
  id,
  label,
  hint,
  error,
  wrapperClassName,
  className,
  required,
  ...props
}: TextareaProps) {
  return (
    <FieldShell
      id={id}
      label={label}
      hint={hint}
      error={error}
      required={required}
      className={wrapperClassName}
    >
      <textarea
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error) || undefined}
        className={cn(
          CONTROL,
          'min-h-24 px-3 py-2.5 leading-relaxed',
          error ? 'border-danger focus:border-danger' : 'border-line-strong',
          className,
        )}
        {...props}
      />
    </FieldShell>
  );
}
