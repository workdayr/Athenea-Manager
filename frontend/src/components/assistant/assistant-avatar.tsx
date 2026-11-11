import { Icon } from '@/components/dashboard/icons';

/** Avatar institucional del asistente, compartido por cabecera y mensajes. */
export function AssistantAvatar({
  className = 'h-8 w-8',
  iconClassName = 'h-4 w-4',
}: {
  className?: string;
  iconClassName?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-800 to-brand-500 text-white shadow-sm ${className}`}
    >
      <Icon name="ai" className={iconClassName} />
    </span>
  );
}
