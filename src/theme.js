// Borneo Tracker design tokens — sampled from the Figma design (design/Borneo Tracker.png).
// Values point at CSS custom properties (theme.css) so every consumer of
// COLORS becomes light/dark-theme-reactive automatically — see ThemeToggle.
export const COLORS = {
  // Brand palette
  teal: 'var(--color-teal)', // dark teal
  forest: 'var(--color-forest)', // dark forest green (sidebar / footer)
  forestDark: 'var(--color-forest-dark)',
  orange: 'var(--color-orange)',
  cream: 'var(--color-cream)', // top bar
  offWhite: 'var(--color-off-white)',
  pageBg: 'var(--color-page-bg)',

  // Accents
  amber: 'var(--color-amber)', // primary action buttons (Sign In / Register / Submit)
  amberDark: 'var(--color-amber-dark)',
  leaf: 'var(--color-leaf)', // active sidebar item
  navy: 'var(--color-navy)', // secondary buttons (Find your account submit)

  // Text
  ink: 'var(--color-ink)',
  muted: 'var(--color-muted)',
  faint: 'var(--color-faint)',
  onDark: 'var(--color-on-dark)',

  // Status / RAG
  green: 'var(--color-green)',
  greenSoft: 'var(--color-green-soft)',
  yellow: 'var(--color-yellow)',
  yellowSoft: 'var(--color-yellow-soft)',
  red: 'var(--color-red)',
  redSoft: 'var(--color-red-soft)',
  blue: 'var(--color-blue)',
  blueSoft: 'var(--color-blue-soft)',
  grey: 'var(--color-grey)',
  greySoft: 'var(--color-grey-soft)',

  // Map region fills (from design) — deliberately not theme-reactive; a
  // territory's map color should stay identifiable in either theme.
  regionTeal: '#2A9D8F', // Sarawak
  regionGreen: '#57A05C', // Sabah
  regionOrange: '#F49E4C', // Kalimantan
  regionYellow: '#F4C542', // Brunei

  border: 'var(--color-border)',
  card: 'var(--color-card)',

  // App shell — top bar and page canvas behind the routed content.
  topbarBg: 'var(--color-topbar-bg)',
  topbarBorder: 'var(--color-topbar-border)',
  shellBg: 'var(--color-shell-bg)',
  mainBg: 'var(--color-main-bg)',
};

export const REGION_COLORS = {
  Sarawak: COLORS.regionTeal,
  Sabah: COLORS.regionGreen,
  Kalimantan: COLORS.regionOrange,
  Brunei: COLORS.regionYellow,
};

export const FONT = "'Lato', 'Inter', Arial, sans-serif";

export const RADII = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 };

export const SHADOWS = {
  card: '0 1px 3px rgba(15, 42, 30, 0.08), 0 4px 14px rgba(15, 42, 30, 0.06)',
  panel: '0 6px 24px rgba(15, 42, 30, 0.12)',
  bar: '0 2px 10px rgba(15, 42, 30, 0.10)',
};

// Status badge palettes used across report tables / SDG cards
export const STATUS_STYLES = {
  'Under Review': { bg: COLORS.yellowSoft, fg: '#B7860B' },
  'Pending Review': { bg: COLORS.yellowSoft, fg: '#B7860B' },
  Verified: { bg: COLORS.greenSoft, fg: COLORS.green },
  Rejected: { bg: COLORS.redSoft, fg: COLORS.red },
  Duplicate: { bg: COLORS.blueSoft, fg: COLORS.blue },
  High: { bg: COLORS.redSoft, fg: COLORS.red },
  Moderate: { bg: COLORS.blueSoft, fg: COLORS.blue },
  Low: { bg: COLORS.greenSoft, fg: COLORS.green },
  Active: { bg: COLORS.greenSoft, fg: COLORS.green },
  Suspended: { bg: COLORS.redSoft, fg: COLORS.red },
  'On Track': { bg: COLORS.greenSoft, fg: COLORS.green },
  'Needs Attention': { bg: COLORS.yellowSoft, fg: '#B7860B' },
  Critical: { bg: COLORS.redSoft, fg: COLORS.red },
  'No Data': { bg: COLORS.greySoft, fg: COLORS.muted },
};
