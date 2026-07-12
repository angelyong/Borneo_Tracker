/* eslint-disable react-refresh/only-export-components */
// Shared UI primitives for the Figma redesign — keep pages lean and consistent.
import { useEffect, useRef, useState } from 'react';
import { COLORS, FONT, RADII, SHADOWS, STATUS_STYLES } from '../theme';

/* ---------- Logo (hornbill mark from the design) ---------- */
export function Logo({ size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-label="Borneo Tracker">
      {/* flame / casque */}
      <path d="M30 4c2.5 2.8 3.4 5.8 2.6 9l-4.8-1.4C28.6 8.8 29.3 6.3 30 4Z" fill="#F4772E" />
      <path
        d="M22 6c4.8-1.6 9 .2 10.8 4.6 1.3 3.2.6 6.4-1.8 8.8l-9.6-4.2C20 11.6 20.2 8.4 22 6Z"
        fill="#F4C20D"
      />
      {/* head / body */}
      <path
        d="M21 12c6.5 0 11.6 4.6 12.4 10.8.8 6.6-3.6 12.8-10.2 14-4.6.8-9-.8-11.8-4.2 3.4.6 6.4 0 8.6-2C23 28 24 24.4 22.6 20.6 21.8 18 20.4 15 18.4 13c.8-.6 1.6-1 2.6-1Z"
        fill="#2A2A2A"
      />
    </svg>
  );
}

/* ---------- Icons (16/20px inline SVGs) ---------- */
// `path` normally only needs the stroke/fill color; icons that support a toggled
// visual state (e.g. a "liked" heart) can read `filled` from the second argument.
const I = (path, viewBox = '0 0 24 24') =>
  function Icon({ size = 20, color = 'currentColor', style, filled }) {
    return (
      <svg width={size} height={size} viewBox={viewBox} fill="none" style={style}>
        {path(color, filled)}
      </svg>
    );
  };

export const Icons = {
  Menu: I((c) => (
    <g stroke={c} strokeWidth="2" strokeLinecap="round">
      <path d="M4 6h16M4 12h16M4 18h16" />
    </g>
  )),
  Bell: I((c) => (
    <path
      d="M12 3a6 6 0 0 0-6 6v3.2l-1.6 3A1 1 0 0 0 5.3 16.7h13.4a1 1 0 0 0 .9-1.5L18 12.2V9a6 6 0 0 0-6-6Zm-2.4 15a2.5 2.5 0 0 0 4.8 0"
      stroke={c}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  )),
  User: I((c) => (
    <g stroke={c} strokeWidth="1.8" fill="none" strokeLinecap="round">
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 19.5c1.6-3.2 4-4.5 7-4.5s5.4 1.3 7 4.5" />
    </g>
  )),
  Search: I((c) => (
    <g stroke={c} strokeWidth="2" fill="none" strokeLinecap="round">
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16.5 16.5 4 4" />
    </g>
  )),
  Lock: I((c) => (
    <g stroke={c} strokeWidth="1.8" fill="none">
      <rect x="6" y="10.5" width="12" height="9" rx="2" />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
    </g>
  )),
  Eye: I((c) => (
    <g stroke={c} strokeWidth="1.8" fill="none">
      <path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.8" />
    </g>
  )),
  EyeOff: I((c) => (
    <g stroke={c} strokeWidth="1.8" fill="none" strokeLinecap="round">
      <path d="M4 4.5 20 19.5M9.5 6.3A9.9 9.9 0 0 1 12 5.8c6 0 9.5 6.2 9.5 6.2a17.6 17.6 0 0 1-3.3 3.9M6 8.3A16.6 16.6 0 0 0 2.5 12S6 18.2 12 18.2c1 0 1.9-.2 2.7-.5" />
      <path d="M10 10.2a2.8 2.8 0 0 0 3.9 3.9" />
    </g>
  )),
  Layers: I((c) => (
    <g stroke={c} strokeWidth="1.8" fill="none" strokeLinejoin="round">
      <path d="m12 3 9 5-9 5-9-5 9-5Z" />
      <path d="m4.5 12.5 7.5 4.2 7.5-4.2M4.5 16.5 12 20.7l7.5-4.2" />
    </g>
  )),
  Plus: I((c) => (
    <path d="M12 5v14M5 12h14" stroke={c} strokeWidth="2.2" strokeLinecap="round" />
  )),
  Minus: I((c) => <path d="M5 12h14" stroke={c} strokeWidth="2.2" strokeLinecap="round" />),
  Reset: I((c) => (
    <g stroke={c} strokeWidth="2" fill="none" strokeLinecap="round">
      <path d="M4.5 8A8.4 8.4 0 0 1 12 3.8c4.6 0 8.2 3.6 8.2 8.2s-3.6 8.2-8.2 8.2A8.2 8.2 0 0 1 4 14.5" />
      <path d="M4.5 3.5V8H9" />
    </g>
  )),
  Download: I((c) => (
    <g stroke={c} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 4v10.5m0 0 4-4m-4 4-4-4M4.5 19.5h15" />
    </g>
  )),
  Upload: I((c) => (
    <g stroke={c} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 15V4.5m0 0-4 4m4-4 4 4M4.5 19.5h15" />
    </g>
  )),
  Close: I((c) => (
    <path d="M6 6l12 12M18 6 6 18" stroke={c} strokeWidth="2.2" strokeLinecap="round" />
  )),
  Check: I((c) => (
    <path d="m5 12.5 4.5 4.5L19 7.5" stroke={c} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  )),
  Chevron: I((c) => (
    <path d="m7 10 5 5 5-5" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  )),
  Dots: I((c) => (
    <g fill={c}>
      <circle cx="5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="19" cy="12" r="1.8" />
    </g>
  )),
  Info: I((c) => (
    <g stroke={c} strokeWidth="1.8" fill="none" strokeLinecap="round">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5M12 7.8v.4" />
    </g>
  )),
  Grid: I((c) => (
    <g fill={c}>
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </g>
  )),
  Table: I((c) => (
    <g stroke={c} strokeWidth="1.8" fill="none">
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <path d="M4 10h16M10 10v9" />
    </g>
  )),
  Gauge: I((c) => (
    <g stroke={c} strokeWidth="1.8" fill="none" strokeLinecap="round">
      <circle cx="12" cy="12" r="8.5" />
      <path d="m12 12 4-4" />
    </g>
  )),
  Chart: I((c) => (
    <g stroke={c} strokeWidth="2" strokeLinecap="round">
      <path d="M5 20V10M12 20V4M19 20v-7" />
    </g>
  )),
  FileArrow: I((c) => (
    <g stroke={c} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 3.5h7L18.5 8v12a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 20V5A1.5 1.5 0 0 1 7 3.5Z" />
      <path d="M9.5 13.5h5m0 0-2-2m2 2-2 2" />
    </g>
  )),
  Newspaper: I((c) => (
    <g stroke={c} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 5.5h12A1.5 1.5 0 0 1 18.5 7v11A1.5 1.5 0 0 1 17 19.5H6.5A2.5 2.5 0 0 1 4 17V7A1.5 1.5 0 0 1 5.5 5.5Z" />
      <path d="M18.5 8.5H20v8a3 3 0 0 1-3 3M8 9h6M8 12h6M8 15h3" />
    </g>
  )),
  People: I((c) => (
    <g stroke={c} strokeWidth="1.8" fill="none" strokeLinecap="round">
      <circle cx="9" cy="9" r="3" />
      <path d="M3.5 19c1.2-2.6 3.1-3.8 5.5-3.8s4.3 1.2 5.5 3.8" />
      <circle cx="16.8" cy="10" r="2.4" />
      <path d="M16.5 15.4c2 .2 3.4 1.3 4.2 3.1" />
    </g>
  )),
  Frame: I((c) => (
    <g stroke={c} strokeWidth="1.8" fill="none" strokeLinecap="round">
      <path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4" />
      <circle cx="12" cy="12" r="2.6" />
    </g>
  )),
  Briefcase: I((c) => (
    <g stroke={c} strokeWidth="1.8" fill="none">
      <rect x="4" y="8" width="16" height="11" rx="2" />
      <path d="M9 8V6.5A1.5 1.5 0 0 1 10.5 5h3A1.5 1.5 0 0 1 15 6.5V8M4 13h16" />
    </g>
  )),
  Pin: I((c) => (
    <g stroke={c} strokeWidth="1.8" fill="none">
      <path d="M12 21s-6.5-5.7-6.5-10.5a6.5 6.5 0 0 1 13 0C18.5 15.3 12 21 12 21Z" />
      <circle cx="12" cy="10.5" r="2.3" />
    </g>
  )),
  Crosshair: I((c) => (
    <g stroke={c} strokeWidth="1.8" fill="none" strokeLinecap="round">
      <circle cx="12" cy="12" r="6.5" />
      <path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4" />
    </g>
  )),
  Calendar: I((c) => (
    <g stroke={c} strokeWidth="1.8" fill="none" strokeLinecap="round">
      <rect x="4" y="5.5" width="16" height="15" rx="2" />
      <path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" />
    </g>
  )),
  Clock: I((c) => (
    <g stroke={c} strokeWidth="1.8" fill="none" strokeLinecap="round">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5.2l3.2 2" />
    </g>
  )),
  Edit: I((c) => (
    <g stroke={c} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 5.5 18.5 9.5 9 19H5v-4l9.5-9.5Z" />
      <path d="m12.8 7.2 4 4" />
    </g>
  )),
  Trash: I((c) => (
    <g stroke={c} strokeWidth="1.8" fill="none" strokeLinecap="round">
      <path d="M5 7h14M9.5 7V5.5A1.5 1.5 0 0 1 11 4h2a1.5 1.5 0 0 1 1.5 1.5V7M8 7l.7 12a1.5 1.5 0 0 0 1.5 1.4h3.6a1.5 1.5 0 0 0 1.5-1.4L16 7" />
    </g>
  )),
  Logout: I((c) => (
    <g stroke={c} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 8V5.5A1.5 1.5 0 0 0 12.5 4h-6A1.5 1.5 0 0 0 5 5.5v13A1.5 1.5 0 0 0 6.5 20h6a1.5 1.5 0 0 0 1.5-1.5V16M10 12h10.5m0 0-3-3m3 3-3 3" />
    </g>
  )),
  Warn: I((c) => (
    <g stroke={c} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 4 2.8 19.5h18.4L12 4Z" />
      <path d="M12 10v4M12 16.8v.4" />
    </g>
  )),
  Heart: I((c, filled) => (
    <path
      d="M12 20.2s-7.8-4.8-10-9.6C.5 7.3 2.4 4 5.8 4c2 0 3.6 1 6.2 3.6C14.6 5 16.2 4 18.2 4c3.4 0 5.3 3.3 3.8 6.6-2.2 4.8-10 9.6-10 9.6Z"
      stroke={c}
      strokeWidth="1.8"
      strokeLinejoin="round"
      fill={filled ? c : 'none'}
    />
  )),
  Comment: I((c) => (
    <path
      d="M4 5.5h16A1.5 1.5 0 0 1 21.5 7v9A1.5 1.5 0 0 1 20 17.5H9l-4.5 4v-4H4A1.5 1.5 0 0 1 2.5 16V7A1.5 1.5 0 0 1 4 5.5Z"
      stroke={c}
      strokeWidth="1.8"
      strokeLinejoin="round"
      fill="none"
    />
  )),
  Share: I((c) => (
    <g stroke={c} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5.5" r="2.6" />
      <circle cx="6" cy="12" r="2.6" />
      <circle cx="18" cy="18.5" r="2.6" />
      <path d="m8.3 10.6 7.4-4.2M8.3 13.4l7.4 4.2" />
    </g>
  )),
};

/* ---------- Buttons ---------- */
export function Button({ children, variant = 'primary', style, ...rest }) {
  const variants = {
    primary: {
      background: COLORS.amber,
      color: '#fff',
      border: 'none',
      boxShadow: '0 2px 6px rgba(242,179,61,.45)',
    },
    navy: { background: COLORS.navy, color: '#fff', border: 'none' },
    forest: { background: COLORS.forest, color: '#fff', border: 'none' },
    ghost: { background: 'transparent', color: COLORS.ink, border: `1px solid ${COLORS.border}` },
    danger: { background: COLORS.red, color: '#fff', border: 'none' },
  };
  return (
    <button
      style={{
        padding: '12px 28px',
        borderRadius: RADII.pill,
        fontSize: 16,
        fontWeight: 700,
        fontFamily: FONT,
        ...variants[variant],
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ---------- Card ---------- */
export function Card({ children, style, ...rest }) {
  return (
    <div
      style={{
        background: COLORS.card,
        borderRadius: RADII.lg,
        boxShadow: SHADOWS.card,
        padding: 20,
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

/* ---------- Status badge ---------- */
export function Badge({ status, children, style }) {
  const s = STATUS_STYLES[status] || { bg: COLORS.greySoft, fg: COLORS.muted };
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '5px 14px',
        borderRadius: RADII.pill,
        background: s.bg,
        color: s.fg,
        fontSize: 13,
        fontWeight: 700,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {children ?? status}
    </span>
  );
}

/* ---------- Inputs ---------- */
export function Field({ label, required, hint, children, style }) {
  return (
    <label style={{ display: 'block', marginBottom: 18, ...style }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.ink, marginBottom: 6 }}>
        {label}
        {required && <span style={{ color: COLORS.red }}> *</span>}
        {hint && (
          <span style={{ fontWeight: 400, color: COLORS.muted, fontSize: 13, marginLeft: 6 }}>
            {hint}
          </span>
        )}
      </div>
      {children}
    </label>
  );
}

const inputBase = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: RADII.md,
  border: `1px solid ${COLORS.border}`,
  fontSize: 15,
  background: '#fff',
  color: COLORS.ink,
};

export function TextInput(props) {
  return <input {...props} style={{ ...inputBase, ...props.style }} />;
}

export function TextArea(props) {
  return <textarea rows={5} {...props} style={{ ...inputBase, resize: 'vertical', ...props.style }} />;
}

export function PasswordInput(props) {
  const [show, setShow] = useState(false);
  const EyeIcon = show ? Icons.EyeOff : Icons.Eye;
  return (
    <div style={{ position: 'relative' }}>
      <input
        {...props}
        type={show ? 'text' : 'password'}
        style={{ ...inputBase, paddingRight: 44, ...props.style }}
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? 'Hide password' : 'Show password'}
        style={{
          position: 'absolute',
          right: 10,
          top: '50%',
          transform: 'translateY(-50%)',
          border: 'none',
          background: 'transparent',
          padding: 4,
          color: COLORS.muted,
        }}
      >
        <EyeIcon size={20} />
      </button>
    </div>
  );
}

export function Select({ options, value, onChange, style, ...rest }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      style={{
        ...inputBase,
        width: style?.width ?? 'auto',
        padding: '10px 34px 10px 14px',
        appearance: 'none',
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'><path d='M1 1.5 6 6.5 11 1.5' stroke='%236B7280' stroke-width='2' fill='none' stroke-linecap='round'/></svg>\")",
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 12px center',
        borderRadius: RADII.md,
        boxShadow: SHADOWS.card,
        border: `1px solid ${COLORS.border}`,
        cursor: 'pointer',
        ...style,
      }}
      {...rest}
    >
      {options.map((o) =>
        typeof o === 'string' ? (
          <option key={o} value={o}>
            {o}
          </option>
        ) : (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ),
      )}
    </select>
  );
}

/* ---------- Stat card (Report tracking / verification counters) ---------- */
export function StatCard({ label, value, style }) {
  return (
    <Card style={{ textAlign: 'center', padding: '18px 26px', minWidth: 150, ...style }}>
      <div style={{ color: COLORS.muted, fontSize: 14, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 900, color: COLORS.forest, marginTop: 6 }}>{value}</div>
    </Card>
  );
}

/* ---------- Modal ---------- */
export function Modal({ open, onClose, width = 560, children, closeButton = true }) {
  if (!open) return null;
  return (
    <div
      onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(31,41,55,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 20,
      }}
    >
      <div
        className="bt-fade-in"
        style={{
          background: '#fff',
          borderRadius: RADII.xl,
          boxShadow: SHADOWS.panel,
          width: '100%',
          maxWidth: width,
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: 28,
          position: 'relative',
        }}
      >
        {closeButton && (
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              position: 'absolute',
              top: 18,
              right: 18,
              border: 'none',
              background: 'transparent',
              color: COLORS.ink,
              padding: 4,
            }}
          >
            <Icons.Close size={22} />
          </button>
        )}
        {children}
      </div>
    </div>
  );
}

export function SuccessModal({ open, onClose, message }) {
  return (
    <Modal open={open} onClose={onClose} width={520} closeButton={false}>
      <div style={{ textAlign: 'center', padding: '26px 10px' }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: '#22C55E',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
          }}
        >
          <Icons.Check size={34} color="#fff" />
        </div>
        <div style={{ fontSize: 24, fontWeight: 800, color: COLORS.ink }}>{message}</div>
      </div>
    </Modal>
  );
}

/* ---------- Dropdown menu (kebab / avatar menus) ---------- */
export function Menu({ trigger, items, align = 'right' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <span onClick={() => setOpen((v) => !v)}>{trigger}</span>
      {open && (
        <div
          className="bt-fade-in"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            [align]: 0,
            background: '#fff',
            borderRadius: RADII.md,
            boxShadow: SHADOWS.panel,
            minWidth: 190,
            zIndex: 300,
            padding: 6,
          }}
        >
          {items.map((it, i) => (
            <button
              key={i}
              onClick={() => {
                setOpen(false);
                it.onClick?.();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                padding: '10px 12px',
                border: 'none',
                background: 'transparent',
                borderRadius: 8,
                fontSize: 14.5,
                fontWeight: 600,
                color: it.danger ? COLORS.red : COLORS.ink,
                textAlign: 'left',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#F3F4F6')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              {it.icon}
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Pagination ---------- */
export function Pagination({ page, pages, onPage }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 40,
        padding: '14px 0 4px',
        fontSize: 14.5,
        fontWeight: 700,
      }}
    >
      <button
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
        style={{
          border: 'none',
          background: 'none',
          color: page <= 1 ? COLORS.faint : COLORS.blue,
          fontWeight: 700,
        }}
      >
        &lt; Prev
      </button>
      <span style={{ color: COLORS.ink }}>
        {page} of {Math.max(pages, 1)}
      </span>
      <button
        disabled={page >= pages}
        onClick={() => onPage(page + 1)}
        style={{
          border: 'none',
          background: 'none',
          color: page >= pages ? COLORS.faint : COLORS.blue,
          fontWeight: 700,
        }}
      >
        Next &gt;
      </button>
    </div>
  );
}

/* ---------- Table ---------- */
export function Table({ columns, rows, renderCell, keyFor }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                style={{
                  textAlign: c.align || 'center',
                  padding: '12px 14px',
                  fontSize: 15,
                  fontWeight: 800,
                  color: COLORS.ink,
                  borderBottom: `1px solid ${COLORS.border}`,
                  whiteSpace: 'nowrap',
                }}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={keyFor ? keyFor(r) : ri}>
              {columns.map((c) => (
                <td
                  key={c.key}
                  style={{
                    textAlign: c.align || 'center',
                    padding: '14px',
                    fontSize: 14.5,
                    color: COLORS.ink,
                    borderBottom: ri < rows.length - 1 ? '1px solid #F3F4F6' : 'none',
                  }}
                >
                  {renderCell ? renderCell(r, c.key) : r[c.key]}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={columns.length}
                style={{ textAlign: 'center', padding: 30, color: COLORS.muted, fontSize: 14.5 }}
              >
                No records found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
