'use client';
import type React from 'react';

type IconProps = {
  name: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  [key: string]: any;
};

export function Icon({ name, size = 16, className = '', style = {}, ...rest }: IconProps) {
  const s = size;
  const props: any = {
    width: s,
    height: s,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    className,
    style,
    ...rest,
  };
  const paths: Record<string, React.ReactNode> = ICON_PATHS;
  return <svg {...props}>{paths[name] || null}</svg>;
}

const ICON_PATHS: Record<string, React.ReactNode> = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </>
  ),
  box: (
    <>
      <path d="M3 7l9-4 9 4-9 4-9-4z" />
      <path d="M3 7v10l9 4 9-4V7" />
      <path d="M12 11v10" />
    </>
  ),
  layers: (
    <>
      <path d="M12 3l9 5-9 5-9-5 9-5z" />
      <path d="M3 13l9 5 9-5" />
      <path d="M3 17l9 5 9-5" />
    </>
  ),
  warehouse: (
    <>
      <path d="M3 9l9-5 9 5v11H3z" />
      <path d="M7 20v-6h10v6" />
      <path d="M11 14v6M13 14v6" />
    </>
  ),
  truck: (
    <>
      <rect x="2" y="6" width="12" height="10" rx="1" />
      <path d="M14 9h4l3 3v4h-7z" />
      <circle cx="6" cy="18" r="2" />
      <circle cx="17" cy="18" r="2" />
    </>
  ),
  cart: (
    <>
      <circle cx="8" cy="20" r="1.5" />
      <circle cx="17" cy="20" r="1.5" />
      <path d="M3 4h2l2.5 11.5a1 1 0 001 .8h9.6a1 1 0 001-.8L21 8H6" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M3 20c0-3 2.5-5.5 6-5.5s6 2.5 6 5.5" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M16 14c2.8 0 5 2 5 5" />
    </>
  ),
  chart: (
    <>
      <path d="M3 3v18h18" />
      <path d="M7 14l4-4 3 3 6-7" />
    </>
  ),
  bell: (
    <>
      <path d="M6 10a6 6 0 1112 0v3l1.5 3h-15L6 13z" />
      <path d="M10 19a2 2 0 004 0" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1A1.7 1.7 0 009 19.4a1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1A1.7 1.7 0 004.6 9a1.7 1.7 0 00-.3-1.8L4.2 7a2 2 0 112.8-2.8l.1.1A1.7 1.7 0 009 4.6 1.7 1.7 0 0010 3.1V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5v14M5 12h14" />
    </>
  ),
  minus: (
    <>
      <path d="M5 12h14" />
    </>
  ),
  x: (
    <>
      <path d="M6 6l12 12M18 6L6 18" />
    </>
  ),
  check: (
    <>
      <path d="M5 12l5 5L20 7" />
    </>
  ),
  chevDown: (
    <>
      <path d="M6 9l6 6 6-6" />
    </>
  ),
  chevUp: (
    <>
      <path d="M6 15l6-6 6 6" />
    </>
  ),
  chevRight: (
    <>
      <path d="M9 6l6 6-6 6" />
    </>
  ),
  chevLeft: (
    <>
      <path d="M15 6l-6 6 6 6" />
    </>
  ),
  arrowUp: (
    <>
      <path d="M12 19V5M5 12l7-7 7 7" />
    </>
  ),
  arrowDown: (
    <>
      <path d="M12 5v14M5 12l7 7 7-7" />
    </>
  ),
  arrowRight: (
    <>
      <path d="M5 12h14M13 5l7 7-7 7" />
    </>
  ),
  arrowUpRight: (
    <>
      <path d="M7 17L17 7M8 7h9v9" />
    </>
  ),
  moon: (
    <>
      <path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  filter: (
    <>
      <path d="M3 5h18l-7 9v6l-4-2v-4z" />
    </>
  ),
  sort: (
    <>
      <path d="M3 6h13M3 12h9M3 18h5" />
      <path d="M17 9l3-3 3 3M20 6v12" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v12M7 10l5 5 5-5" />
      <path d="M5 21h14" />
    </>
  ),
  upload: (
    <>
      <path d="M12 15V3M7 8l5-5 5 5" />
      <path d="M5 21h14" />
    </>
  ),
  edit: (
    <>
      <path d="M4 20h4l10-10-4-4L4 16v4z" />
      <path d="M14 6l4 4" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
    </>
  ),
  copy: (
    <>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3" />
    </>
  ),
  more: (
    <>
      <circle cx="5" cy="12" r="1.2" fill="currentColor" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" />
      <circle cx="19" cy="12" r="1.2" fill="currentColor" />
    </>
  ),
  barcode: (
    <>
      <path d="M3 5v14M6 5v14M9 5v14M13 5v14M16 5v14M19 5v14M22 5v14" strokeWidth="1.2" />
    </>
  ),
  qr: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M14 14h3v3h-3zM20 14v3M14 20h3M20 20h1" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  archive: (
    <>
      <rect x="3" y="4" width="18" height="4" rx="1" />
      <path d="M5 8v11a1 1 0 001 1h12a1 1 0 001-1V8" />
      <path d="M10 12h4" />
    </>
  ),
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </>
  ),
  list: (
    <>
      <path d="M8 6h13M8 12h13M8 18h13" />
      <circle cx="3.5" cy="6" r="0.5" fill="currentColor" />
      <circle cx="3.5" cy="12" r="0.5" fill="currentColor" />
      <circle cx="3.5" cy="18" r="0.5" fill="currentColor" />
    </>
  ),
  menu: (
    <>
      <path d="M3 6h18M3 12h18M3 18h18" />
    </>
  ),
  panel: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="1" />
      <path d="M9 4v16" />
    </>
  ),
  refresh: (
    <>
      <path d="M21 12a9 9 0 11-3-6.7L21 8" />
      <path d="M21 3v5h-5" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="1" />
      <path d="M3 9h18M8 3v4M16 3v4" />
    </>
  ),
  tag: (
    <>
      <path d="M20.6 13.4l-7.2 7.2a2 2 0 01-2.8 0L3 13V3h10l7.6 7.6a2 2 0 010 2.8z" />
      <circle cx="8" cy="8" r="1.5" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <circle cx="12" cy="8" r="0.5" fill="currentColor" strokeWidth="2" />
    </>
  ),
  alert: (
    <>
      <path d="M10.3 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <path d="M12 9v4M12 17h.01" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  pin: (
    <>
      <path d="M12 22s7-6.5 7-12a7 7 0 10-14 0c0 5.5 7 12 7 12z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  receipt: (
    <>
      <path d="M5 3v18l2-1.5L9 21l2-1.5 2 1.5 2-1.5 2 1.5V3z" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </>
  ),
  package: (
    <>
      <path d="M21 16V8a2 2 0 00-1-1.7l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.7l7 4a2 2 0 002 0l7-4a2 2 0 001-1.7z" />
      <path d="M3.3 7L12 12l8.7-5M12 22V12" />
    </>
  ),
  file: (
    <>
      <path d="M14 3H6a1 1 0 00-1 1v16a1 1 0 001 1h12a1 1 0 001-1V8z" />
      <path d="M14 3v5h5" />
    </>
  ),
  google: (
    <>
      <path
        d="M22 12.5c0-.8-.1-1.4-.2-2H12v3.8h5.6c-.2 1.4-1 2.5-2.2 3.3v2.8h3.6c2-2 3-4.7 3-7.9z"
        fill="#4285F4"
        stroke="none"
      />
      <path
        d="M12 22c2.9 0 5.4-1 7.2-2.6l-3.6-2.8c-1 .7-2.2 1.1-3.6 1.1-2.8 0-5.1-1.9-6-4.4H2.4v2.8C4.2 19.5 7.8 22 12 22z"
        fill="#34A853"
        stroke="none"
      />
      <path
        d="M6 13.3c-.2-.7-.4-1.4-.4-2.3s.1-1.6.4-2.3V5.9H2.4C1.5 7.5 1 9.3 1 11s.4 3.5 1.3 5.1L6 13.3z"
        fill="#FBBC04"
        stroke="none"
      />
      <path
        d="M12 4.8c1.5 0 2.9.5 4 1.5l3-3C17.4 1.7 14.9 1 12 1 7.8 1 4.2 3.5 2.4 7l3.6 2.8c.9-2.6 3.2-4.5 6-4.5z"
        fill="#EA4335"
        stroke="none"
      />
    </>
  ),
  lock: (
    <>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 018 0v3" />
    </>
  ),
  inbox: (
    <>
      <path d="M22 13h-6l-2 3h-4l-2-3H2" />
      <path d="M5 4l-3 9v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3-9z" />
    </>
  ),
  star: (
    <>
      <path d="M12 2l3 7 7 1-5 5 1.5 7L12 18.5 5.5 22 7 15 2 10l7-1z" />
    </>
  ),
  play: (
    <>
      <path d="M6 4l14 8-14 8z" />
    </>
  ),
  pause: (
    <>
      <rect x="6" y="4" width="4" height="16" />
      <rect x="14" y="4" width="4" height="16" />
    </>
  ),
  map: (
    <>
      <path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z" />
      <path d="M9 4v14M15 6v14" />
    </>
  ),
  location: (
    <>
      <path d="M12 22s7-6.5 7-12a7 7 0 10-14 0c0 5.5 7 12 7 12z" />
      <circle cx="12" cy="10" r="2" />
    </>
  ),
  phone: (
    <>
      <path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3 19.5 19.5 0 01-6-6 19.8 19.8 0 01-3-8.7A2 2 0 014 2h3a2 2 0 012 1.7c.1 1 .3 1.9.6 2.8a2 2 0 01-.5 2L8 9.7a16 16 0 006 6l1.3-1.3a2 2 0 012-.5c.9.3 1.8.5 2.8.6A2 2 0 0122 17z" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </>
  ),
  star_filled: (
    <>
      <path d="M12 2l3 7 7 1-5 5 1.5 7L12 18.5 5.5 22 7 15 2 10l7-1z" fill="currentColor" />
    </>
  ),
  flag: (
    <>
      <path d="M4 22V4M4 5h12l-2 4 2 4H4" />
    </>
  ),
  book: (
    <>
      <path d="M3 5a2 2 0 012-2h14v18H5a2 2 0 01-2-2z" />
      <path d="M3 19a2 2 0 012-2h14" />
    </>
  ),
  activity: (
    <>
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </>
  ),
  trending_up: (
    <>
      <path d="M22 7l-9.5 9.5-5-5L1 18" />
      <path d="M16 7h6v6" />
    </>
  ),
  trending_down: (
    <>
      <path d="M22 17l-9.5-9.5-5 5L1 6" />
      <path d="M16 17h6v-6" />
    </>
  ),
  bolt: (
    <>
      <path d="M13 2L4 14h7l-1 8 9-12h-7z" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </>
  ),
  scan: (
    <>
      <path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2" />
      <path d="M3 12h18" strokeWidth="2" stroke="var(--accent)" />
    </>
  ),
  printer: (
    <>
      <path d="M6 9V3h12v6" />
      <rect x="3" y="9" width="18" height="9" rx="1" />
      <path d="M6 14h12v7H6z" />
    </>
  ),
  card: (
    <>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20M6 15h4" />
    </>
  ),
  banknote: (
    <>
      <rect x="2" y="6" width="20" height="12" rx="1" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M6 9v6M18 9v6" />
    </>
  ),
  wallet: (
    <>
      <path d="M3 7a2 2 0 012-2h13v14H5a2 2 0 01-2-2V7z" />
      <path d="M18 12h4v-2a1 1 0 00-1-1h-3z" />
      <circle cx="17" cy="12" r="1" fill="currentColor" />
    </>
  ),
  bank: (
    <>
      <path d="M3 10l9-6 9 6v2H3z" />
      <path d="M5 12v7M9 12v7M15 12v7M19 12v7M3 21h18" />
    </>
  ),
  pos: (
    <>
      <rect x="3" y="3" width="18" height="14" rx="1" />
      <path d="M3 9h18M8 21h8M12 17v4" />
    </>
  ),
  receipt2: (
    <>
      <path d="M5 3v18l2-1.5L9 21l2-1.5 2 1.5 2-1.5 2 1.5V3z" />
      <path d="M8 7h8M8 11h8M8 15h5" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-7 8-7s8 3 8 7" />
    </>
  ),
  refund: (
    <>
      <path d="M3 11a9 9 0 019-9 9 9 0 016.4 2.6L21 7" />
      <path d="M21 3v4h-4" />
      <path d="M15 12l-3 3 3 3M12 15h8" />
    </>
  ),
  discount: (
    <>
      <path d="M20.6 13.4l-7.2 7.2a2 2 0 01-2.8 0L3 13V3h10l7.6 7.6a2 2 0 010 2.8z" />
      <circle cx="8" cy="8" r="1.5" />
      <path d="M16 8l-8 8" />
    </>
  ),
};

export default Icon;
