'use client';
import type React from 'react';
import { useState, useEffect, useRef, useCallback, useId, createContext, useContext } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';

// Currency defaults to the Indian rupee with lakh/crore-aware compacting.
export const fmt = {
  money: (n: number, cur = '₹') =>
    cur + (n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  moneyCompact: (n: number, cur = '₹') => {
    const v = n ?? 0;
    if (v >= 1e7) return `${cur + (v / 1e7).toFixed(v >= 1e8 ? 0 : 1)}Cr`;
    if (v >= 1e5) return `${cur + (v / 1e5).toFixed(v >= 1e6 ? 0 : 1)}L`;
    if (v >= 1e3) return `${cur + (v / 1e3).toFixed(v >= 1e4 ? 0 : 1)}k`;
    return cur + v.toFixed(0);
  },
  int: (n: number) => (n ?? 0).toLocaleString('en-IN'),
  pct: (n: number) => `${(n * 100).toFixed(0)}%`,
};

const STATUS_MAP: Record<string, { cls: string; label: string }> = {
  active: { cls: 'badge-success', label: 'In stock' },
  low: { cls: 'badge-warn', label: 'Low stock' },
  out: { cls: 'badge-danger', label: 'Out of stock' },
  archived: { cls: '', label: 'Archived' },
  draft: { cls: '', label: 'Draft' },
  approved: { cls: 'badge-info', label: 'Approved' },
  shipped: { cls: 'badge-accent', label: 'Shipped' },
  received: { cls: 'badge-success', label: 'Received' },
  cancelled: { cls: 'badge-danger', label: 'Cancelled' },
  fulfilled: { cls: 'badge-success', label: 'Fulfilled' },
  packing: { cls: 'badge-info', label: 'Packing' },
  pending: { cls: 'badge-warn', label: 'Pending' },
  paid: { cls: 'badge-success', label: 'Paid' },
  unpaid: { cls: 'badge-danger', label: 'Unpaid' },
  partial: { cls: 'badge-warn', label: 'Partial' },
  overdue: { cls: 'badge-danger', label: 'Overdue' },
  refunded: { cls: 'badge-info', label: 'Refunded' },
  rejected: { cls: 'badge-danger', label: 'Rejected' },
  admin: { cls: 'badge-accent', label: 'Admin' },
  staff: { cls: 'badge-info', label: 'Staff' },
};
export function statusBadge(status: string) {
  const m = STATUS_MAP[status] || { cls: '', label: status };
  return (
    <span className={`badge ${m.cls}`}>
      <span className="badge-dot" />
      {m.label}
    </span>
  );
}

export function ProductThumb({ name, size = 36 }: { name: string; size?: number }) {
  const initials = (name || '?')
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  return (
    <div className="product-thumb" style={{ width: size, height: size }}>
      {initials}
    </div>
  );
}

export function Sparkline({ data, width = 80, height = 24, color, fill = true }: any) {
  if (!data?.length) return null;
  const min = Math.min(...data),
    max = Math.max(...data),
    range = max - min || 1;
  const step = width / (data.length - 1);
  const pts = data
    .map((v: number, i: number) => `${i * step},${height - ((v - min) / range) * (height - 2) - 1}`)
    .join(' ');
  const area = `0,${height} ${pts} ${width},${height}`;
  const c = color || 'var(--accent)';
  return (
    <svg width={width} height={height} className="kpi-spark">
      {fill && <polygon points={area} fill={c} opacity="0.1" />}
      <polyline
        points={pts}
        fill="none"
        stroke={c}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Kpi({ label, value, delta, spark, icon, sparkColor }: any) {
  const dir = delta?.startsWith('-') ? 'down' : delta && delta !== '—' ? 'up' : 'flat';
  return (
    <div className="kpi">
      <div className="kpi-label">
        {icon && <Icon name={icon} size={14} />}
        {label}
      </div>
      <div className="spread" style={{ alignItems: 'flex-end' }}>
        <div className="kpi-value">{value}</div>
        {spark && <Sparkline data={spark} color={sparkColor} />}
      </div>
      {delta && (
        <div className={`kpi-delta ${dir}`}>
          {dir === 'up' && <Icon name="arrowUp" size={12} />}
          {dir === 'down' && <Icon name="arrowDown" size={12} />}
          {delta}{' '}
          <span className="dim" style={{ fontFamily: 'var(--font-sans)' }}>
            vs. last week
          </span>
        </div>
      )}
    </div>
  );
}

export function Kpi2({ label, value, sub, color }: any) {
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value" style={{ color: color || 'inherit' }}>
        {value}
      </div>
      <div className="muted tiny">{sub}</div>
    </div>
  );
}

export function LineChart({
  data,
  width = 720,
  height = 240,
  color,
  valuePrefix = '₹',
  animate = true,
}: any) {
  const pad = { t: 16, r: 16, b: 28, l: 44 };
  const w = width - pad.l - pad.r,
    h = height - pad.t - pad.b;
  const min = Math.min(...data),
    max = Math.max(...data),
    range = max - min || 1;
  const step = w / (data.length - 1);
  const c = color || 'var(--accent)';
  const pts = data.map((v: number, i: number) => [
    pad.l + i * step,
    pad.t + h - ((v - min) / range) * h,
  ]);
  const path = pts
    .map(([x, y]: number[], i: number) => (i === 0 ? `M${x},${y}` : `L${x},${y}`))
    .join(' ');
  const area = `${path} L${pts[pts.length - 1][0]},${pad.t + h} L${pts[0][0]},${pad.t + h} Z`;
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => min + range * (1 - t));
  const pathRef = useRef<SVGPathElement>(null);
  const [len, setLen] = useState(0);
  useEffect(() => {
    if (animate && pathRef.current) setLen(pathRef.current.getTotalLength());
  }, [animate, data]);
  return (
    <svg
      width="100%"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      style={{ overflow: 'visible' }}
    >
      <g className="chart-grid">
        {[0, 0.25, 0.5, 0.75, 1].map((t, i) => (
          <line key={i} x1={pad.l} x2={pad.l + w} y1={pad.t + h * t} y2={pad.t + h * t} />
        ))}
      </g>
      <g className="chart-axis">
        {yTicks.map((v, i) => (
          <text key={i} x={pad.l - 8} y={pad.t + h * (i / 4) + 3} textAnchor="end">
            {valuePrefix}
            {Math.round(v / 1000)}k
          </text>
        ))}
        {[0, 5, 10, 15, 20, 25, 29].map((i) => (
          <text
            key={i}
            x={pad.l + i * step}
            y={pad.t + h + 16}
            textAnchor="middle"
          >{`${30 - i}d`}</text>
        ))}
      </g>
      <path d={area} fill={c} opacity="0.08" />
      <path
        ref={pathRef}
        d={path}
        fill="none"
        stroke={c}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={
          animate && len
            ? {
                strokeDasharray: len,
                strokeDashoffset: len,
                animation: 'draw 1200ms cubic-bezier(0.2,0.8,0.2,1) forwards',
              }
            : {}
        }
      />
      <style>{`@keyframes draw { to { stroke-dashoffset: 0; } }`}</style>
      {pts
        .filter((_: any, i: number) => i === pts.length - 1)
        .map(([x, y]: number[], i: number) => (
          <circle key={i} cx={x} cy={y} r="4" fill={c} stroke="var(--bg-elev)" strokeWidth="2" />
        ))}
    </svg>
  );
}

export function BarChart({ data, width = 720, height = 200, color, animate = true }: any) {
  const pad = { t: 16, r: 16, b: 28, l: 44 };
  const w = width - pad.l - pad.r,
    h = height - pad.t - pad.b;
  const max = Math.max(...data.map((d: any) => d.value));
  const barW = (w / data.length) * 0.7,
    gap = (w / data.length) * 0.3;
  const c = color || 'var(--accent)';
  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <g className="chart-grid">
        {[0, 0.25, 0.5, 0.75, 1].map((t, i) => (
          <line key={i} x1={pad.l} x2={pad.l + w} y1={pad.t + h * t} y2={pad.t + h * t} />
        ))}
      </g>
      <g className="chart-axis">
        {[0, 0.25, 0.5, 0.75, 1].map((t, i) => (
          <text key={i} x={pad.l - 8} y={pad.t + h * t + 3} textAnchor="end">
            {Math.round(max * (1 - t))}
          </text>
        ))}
      </g>
      {data.map((d: any, i: number) => {
        const x = pad.l + i * (w / data.length) + gap / 2;
        const bh = (d.value / max) * h,
          y = pad.t + h - bh;
        return (
          <g key={i}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={bh}
              rx="3"
              fill={d.muted ? 'var(--border-strong)' : c}
              style={
                animate
                  ? {
                      transformOrigin: `${x + barW / 2}px ${pad.t + h}px`,
                      animation: `barIn 600ms ${i * 40}ms cubic-bezier(0.2,0.8,0.2,1) backwards`,
                    }
                  : {}
              }
            />
            <text
              x={x + barW / 2}
              y={pad.t + h + 16}
              textAnchor="middle"
              className="chart-axis"
              fill="var(--fg-tertiary)"
              fontFamily="var(--font-mono)"
              fontSize="10"
            >
              {d.label}
            </text>
          </g>
        );
      })}
      <style>{`@keyframes barIn { from { transform: scaleY(0); } to { transform: scaleY(1); } }`}</style>
    </svg>
  );
}

export function Donut({ data, size = 160, thickness = 22, centerLabel, centerValue }: any) {
  const r = size / 2 - thickness / 2,
    c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ transform: 'rotate(-90deg)' }}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--border-subtle)"
          strokeWidth={thickness}
        />
        {data.map((d: any, i: number) => {
          const dash = d.value * c,
            offset = -acc * c;
          acc += d.value;
          return (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={d.color}
              strokeWidth={thickness}
              strokeDasharray={`${dash} ${c - dash}`}
              strokeDashoffset={offset}
              style={{ transition: 'stroke-dashoffset 600ms' }}
            />
          );
        })}
      </svg>
      {centerLabel && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            textAlign: 'center',
          }}
        >
          <div>
            <div style={{ fontSize: 'var(--t-xl)', fontWeight: 600, letterSpacing: '-0.02em' }}>
              {centerValue}
            </div>
            <div style={{ fontSize: 'var(--t-xs)', color: 'var(--fg-tertiary)', marginTop: 2 }}>
              {centerLabel}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function Avatar({ name = '', color, size = 24 }: any) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((w: string) => w[0])
    .join('')
    .toUpperCase();
  const palette = ['#9a3a3a', '#2c5e8a', '#a8761c', '#2a7d4f', '#6b4e8a', '#8a5a36'];
  const hash = [...name].reduce((a: number, ch: string) => a + ch.charCodeAt(0), 0);
  const bg = color || palette[hash % palette.length];
  return (
    <div
      className={`av${size >= 36 ? ' av-lg' : ''}${size >= 56 ? ' av-xl' : ''}`}
      style={{ background: bg, width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials}
    </div>
  );
}

export function Modal({ open, onClose, children, large }: any) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={`modal${large ? ' modal-lg' : ''}`} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

export function Slideover({ open, onClose, children, wide }: any) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <>
      <div className="slideover-backdrop" onClick={onClose} />
      <div
        className={`slideover${wide ? ' slideover-wide' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </>
  );
}

export function Dropdown({ trigger, children, align = 'right' }: any) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [open]);
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div onClick={() => setOpen((o) => !o)}>{trigger}</div>
      {open && (
        <div
          style={
            {
              position: 'absolute',
              top: 'calc(100% + 4px)',
              [align]: 0,
              minWidth: 180,
              background: 'var(--bg-elev)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-md)',
              boxShadow: 'var(--shadow-lg)',
              padding: 4,
              zIndex: 50,
              animation: 'scale-in 120ms cubic-bezier(0.2,0.8,0.2,1)',
              transformOrigin: align === 'right' ? 'top right' : 'top left',
            } as React.CSSProperties
          }
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function MenuItem({ icon, label, onClick, danger, sub }: any) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '7px 10px',
        borderRadius: 6,
        fontSize: 'var(--t-base)',
        color: danger ? 'var(--danger)' : 'var(--fg)',
        cursor: 'pointer',
        transition: 'background 120ms',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      {icon && <Icon name={icon} size={14} />}
      <span style={{ flex: 1 }}>{label}</span>
      {sub && (
        <span
          style={{ fontSize: 10.5, color: 'var(--fg-tertiary)', fontFamily: 'var(--font-mono)' }}
        >
          {sub}
        </span>
      )}
    </div>
  );
}
export const MenuSep = () => (
  <div style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 0' }} />
);

type SelectOption = { value: string; label: string };

// Themed stand-in for a native <select>. Browsers draw a native select's option
// list themselves, so it can't follow the app theme. The trigger keeps the
// `.select` look; the list reuses the Dropdown surface and is portalled to <body>
// so `overflow: hidden` containers (e.g. .table-wrap) can't clip it. Keyboard
// follows the WAI-ARIA select-only combobox pattern: arrows, Home/End,
// Enter/Space, Escape, Tab and type-ahead.
export function Select({
  value,
  onChange,
  options,
  style,
  className = '',
  'aria-label': ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  style?: React.CSSProperties;
  className?: string;
  'aria-label'?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<React.CSSProperties>({});
  const btnRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const typed = useRef({ text: '', at: 0 });
  const id = useId();
  const selectedIdx = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );

  const show = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const below = window.innerHeight - r.bottom;
    const up = below < 200 && r.top > below;
    setPos(
      up
        ? {
            left: r.left,
            width: r.width,
            bottom: window.innerHeight - r.top + 4,
            maxHeight: Math.min(280, r.top - 12),
          }
        : { left: r.left, width: r.width, top: r.bottom + 4, maxHeight: Math.min(280, below - 12) },
    );
    setActive(selectedIdx);
    setOpen(true);
  };
  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) btnRef.current?.focus();
  };
  const pick = (i: number) => {
    const o = options[i];
    if (o && o.value !== value) onChange(o.value);
    close();
  };

  // Close on outside press, page scroll or resize (the list is fixed-positioned).
  useEffect(() => {
    if (!open) return;
    const inside = (t: EventTarget | null) =>
      t instanceof Node && (btnRef.current?.contains(t) || listRef.current?.contains(t));
    const onDown = (e: MouseEvent) => {
      if (!inside(e.target)) setOpen(false);
    };
    const onScroll = (e: Event) => {
      if (!inside(e.target)) setOpen(false);
    };
    const onResize = () => setOpen(false);
    window.addEventListener('mousedown', onDown);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  useEffect(() => {
    if (open) listRef.current?.children[active]?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  // Type-ahead: jump to the next option whose label starts with the typed text.
  const typeAhead = (key: string) => {
    const now = Date.now();
    const t = typed.current;
    t.text = now - t.at > 600 ? key : t.text + key;
    t.at = now;
    const from = open ? active : selectedIdx;
    const start = t.text.length === 1 ? from + 1 : from;
    for (let n = 0; n < options.length; n++) {
      const i = (start + n) % options.length;
      if (options[i].label.toLowerCase().startsWith(t.text)) {
        if (open) setActive(i);
        else if (options[i].value !== value) onChange(options[i].value);
        return;
      }
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const last = options.length - 1;
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        show();
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        typeAhead(e.key.toLowerCase());
      }
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActive((i) => Math.min(last, i + 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActive((i) => Math.max(0, i - 1));
        break;
      case 'Home':
        e.preventDefault();
        setActive(0);
        break;
      case 'End':
        e.preventDefault();
        setActive(last);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        pick(active);
        break;
      case 'Escape':
        e.preventDefault();
        close();
        break;
      case 'Tab':
        close(false);
        break;
      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          typeAhead(e.key.toLowerCase());
        }
    }
  };

  return (
    <div className={`select-wrap ${className}`} style={style}>
      <button
        ref={btnRef}
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${id}-list` : undefined}
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        className="select select-trigger"
        onClick={() => (open ? close() : show())}
        onKeyDown={onKeyDown}
        // Space activates a button on keyup; the keydown handler already handled it.
        onKeyUp={(e) => e.key === ' ' && e.preventDefault()}
      >
        <span className="select-value">{options[selectedIdx]?.label}</span>
        <Icon name="chevDown" size={14} />
      </button>
      {open &&
        createPortal(
          <div
            ref={listRef}
            id={`${id}-list`}
            role="listbox"
            aria-label={ariaLabel}
            className="select-list"
            style={pos}
            // Keep focus on the trigger so keyboard handling keeps working.
            onMouseDown={(e) => e.preventDefault()}
          >
            {options.map((o, i) => (
              <div
                key={o.value}
                id={`${id}-${i}`}
                role="option"
                tabIndex={-1}
                aria-selected={i === selectedIdx}
                className={`select-option${i === active ? ' active' : ''}`}
                onMouseMove={() => i !== active && setActive(i)}
                onClick={() => pick(i)}
              >
                <span>{o.label}</span>
                {i === selectedIdx && <Icon name="check" size={14} />}
              </div>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}

export function EmptyState({ icon, title, body, action }: any) {
  return (
    <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--fg-secondary)' }}>
      {icon && (
        <div
          style={{
            display: 'inline-grid',
            placeItems: 'center',
            width: 48,
            height: 48,
            borderRadius: 12,
            background: 'var(--bg-muted)',
            marginBottom: 12,
            color: 'var(--fg-tertiary)',
          }}
        >
          <Icon name={icon} size={22} />
        </div>
      )}
      <div style={{ fontSize: 'var(--t-md)', fontWeight: 600, color: 'var(--fg)' }}>{title}</div>
      {body && (
        <div
          style={{ fontSize: 'var(--t-base)', marginTop: 4, maxWidth: 340, marginInline: 'auto' }}
        >
          {body}
        </div>
      )}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  );
}

const ToastContext = createContext<(t: any) => void>(() => {});
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<any[]>([]);
  const push = useCallback((toast: any) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { ...toast, id }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), toast.duration || 3500);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        style={{
          position: 'fixed',
          bottom: 16,
          right: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          zIndex: 200,
        }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            style={{
              background: 'var(--bg-elev)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-md)',
              padding: '10px 14px',
              boxShadow: 'var(--shadow-lg)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              minWidth: 260,
              animation: 'slide-in 240ms cubic-bezier(0.2,0.8,0.2,1)',
            }}
          >
            <Icon
              name={t.icon || 'check'}
              size={16}
              style={{ color: t.type === 'danger' ? 'var(--danger)' : 'var(--success)' }}
            />
            <div style={{ flex: 1, fontSize: 'var(--t-base)' }}>{t.message}</div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
export const useToast = () => useContext(ToastContext);
