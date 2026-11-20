import type { ReactNode } from 'react';

/**
 * Set de iconos de linea del dashboard.
 * Se declaran a mano para no agregar una dependencia de iconos solo por
 * la navegacion del panel; el trazo sigue el estilo del diseno
 * (24x24, stroke 1.6, esquinas redondeadas).
 */
const PATHS = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.4" />
      <rect x="13.5" y="3" width="7.5" height="4.5" rx="1.4" />
      <rect x="13.5" y="10.5" width="7.5" height="10.5" rx="1.4" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.4" />
    </>
  ),
  register: (
    <>
      <path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6M9 17h4" />
    </>
  ),
  evaluation: (
    <>
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H12l4 4v11.5A1.5 1.5 0 0 1 14.5 21h-9A1.5 1.5 0 0 1 4 19.5Z" />
      <path d="M12 4v4h4" />
      <path d="m8.5 14.5 2 2 4-4.5" />
    </>
  ),
  milestones: (
    <>
      <path d="M3 17.5 9 11l4 4 7.5-8.5" />
      <path d="M15.5 6.5H20.5V11.5" />
    </>
  ),
  calls: (
    <>
      <path d="M4 10.5v3a1.5 1.5 0 0 0 1.5 1.5H8l5.5 4V5L8 9H5.5A1.5 1.5 0 0 0 4 10.5Z" />
      <path d="M17 9.5a3.5 3.5 0 0 1 0 5" />
      <path d="M19.5 7a7 7 0 0 1 0 10" />
    </>
  ),
  ai: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <circle cx="9.5" cy="10" r="1" />
      <circle cx="14.5" cy="10" r="1" />
      <path d="M9 15h6" />
      <path d="M12 4V2M12 22v-2M4 12H2M22 12h-2" />
    </>
  ),
  config: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 14.5a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-2.87 1.2V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.87-1.2l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.5 14v-.1a1.7 1.7 0 0 0-1.2-1.4H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 10 4.5h.1a1.7 1.7 0 0 0 1.4-1.2V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.87 1.2l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.5 10v.1a1.7 1.7 0 0 0 1.2 1.4H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-3.6-3.6" />
    </>
  ),
  bell: (
    <>
      <path d="M18 8.5a6 6 0 1 0-12 0c0 5-2 6.5-2 6.5h16s-2-1.5-2-6.5Z" />
      <path d="M10.3 19a2 2 0 0 0 3.4 0" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3 5 6v5.5c0 4.4 2.9 8.4 7 9.5 4.1-1.1 7-5.1 7-9.5V6l-7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  grid: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.2" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.2" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.2" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.2" />
    </>
  ),
  gauge: (
    <>
      <path d="M20.5 14a8.5 8.5 0 1 0-17 0" />
      <path d="m12 12 4-3" />
      <circle cx="12" cy="14" r="1.6" />
    </>
  ),
  alert: (
    <>
      <path d="M10.3 4.3 2.8 17.2A1.8 1.8 0 0 0 4.4 20h15.2a1.8 1.8 0 0 0 1.6-2.8L13.7 4.3a1.9 1.9 0 0 0-3.4 0Z" />
      <path d="M12 9.5v4M12 16.8v.2" />
    </>
  ),
  wallet: (
    <>
      <rect x="3" y="6" width="18" height="13" rx="2.2" />
      <path d="M3 10h18" />
      <path d="M7 15h3" />
    </>
  ),
  stamp: (
    <>
      <path d="M6 20h12" />
      <path d="M8 17h8v-3.2c0-.9-.6-1.6-1.4-1.9a3.4 3.4 0 0 1-2.2-3.2V5.5A1.5 1.5 0 0 1 13.9 4h-3.8A1.5 1.5 0 0 1 11.6 5.5v3.2a3.4 3.4 0 0 1-2.2 3.2A2 2 0 0 0 8 13.8Z" />
    </>
  ),
  doc: (
    <>
      <path d="M6 3.5h7l4.5 4.5v12A1.5 1.5 0 0 1 16 21.5H6A1.5 1.5 0 0 1 4.5 20V5A1.5 1.5 0 0 1 6 3.5Z" />
      <path d="M13 3.5V8h4.5" />
      <path d="M8 12.5h6M8 16.5h4" />
    </>
  ),
  folder: (
    <>
      <path d="M3.5 7.5A1.5 1.5 0 0 1 5 6h4l2 2.5h8A1.5 1.5 0 0 1 20.5 10v8A1.5 1.5 0 0 1 19 19.5H5A1.5 1.5 0 0 1 3.5 18Z" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 1.8" />
    </>
  ),
  download: (
    <>
      <path d="M12 4v10" />
      <path d="m8 10.5 4 4 4-4" />
      <path d="M5 18.5h14" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 12a8 8 0 0 1-13.7 5.7L4 15.5" />
      <path d="M4 12a8 8 0 0 1 13.7-5.7L20 8.5" />
      <path d="M20 4v4.5h-4.5M4 20v-4.5h4.5" />
    </>
  ),
  logout: (
    <>
      <path d="M15 4.5h3A1.5 1.5 0 0 1 19.5 6v12a1.5 1.5 0 0 1-1.5 1.5h-3" />
      <path d="M10 8.5 6 12l4 3.5" />
      <path d="M6 12h9" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  chevronLeft: <path d="m15 6-6 6 6 6" />,
  chevronRight: <path d="m9 6 6 6-6 6" />,
  arrowRight: (
    <>
      <path d="M4 12h16" />
      <path d="m14 6 6 6-6 6" />
    </>
  ),
  arrowUpRight: (
    <>
      <path d="M7 17 17 7" />
      <path d="M8.5 7H17v8.5" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19.5a5.5 5.5 0 0 1 11 0" />
      <path d="M16 5.4a3.2 3.2 0 0 1 0 5.2" />
      <path d="M17.5 14.4a5.5 5.5 0 0 1 3 5.1" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="0.6" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.6" />
    </>
  ),
  filter: (
    <>
      <path d="M4 6h16l-6.2 7v5.5L10.2 21v-8Z" />
    </>
  ),
  athenea: (
    <>
      <path d="M12 3 4 20h4.2l1.6-3.8h4.4L15.8 20H20L12 3Z" />
      <path d="M9.2 13.2h5.6" />
    </>
  ),
  spark: (
    <>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
      <path d="m6.5 6.5 2.5 2.5M15 15l2.5 2.5M17.5 6.5 15 9M9 15l-2.5 2.5" />
    </>
  ),
  send: (
    <>
      <path d="M21 3 10.5 13.5" />
      <path d="M21 3 14.5 21l-4-7.5L3 9.5 21 3Z" />
    </>
  ),
  copy: (
    <>
      <rect x="8.5" y="8.5" width="12" height="12" rx="2" />
      <path d="M15.5 8.5v-3a2 2 0 0 0-2-2h-9a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  trash: (
    <>
      <path d="M4 7h16" />
      <path d="M9.5 11v6M14.5 11v6" />
      <path d="M6 7l1 13a1.5 1.5 0 0 0 1.5 1.4h7A1.5 1.5 0 0 0 17 20l1-13" />
      <path d="M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7" />
    </>
  ),
  pencil: (
    <>
      <path d="M4 20h4l11-11a2.8 2.8 0 0 0-4-4L4 16v4Z" />
      <path d="m13.5 5.5 5 5" />
    </>
  ),
  stop: <rect x="6.5" y="6.5" width="11" height="11" rx="2" />,
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5M12 8v.2" />
    </>
  ),
  history: (
    <>
      <path d="M4 12a8 8 0 1 0 2.3-5.7L4 8.5" />
      <path d="M4 4v4.5h4.5" />
      <path d="M12 8v4.5l3 1.7" />
    </>
  ),
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({
  name,
  className = 'h-5 w-5',
}: {
  name: IconName;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {PATHS[name] as ReactNode}
    </svg>
  );
}
