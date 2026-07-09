// Borneo Tracker design tokens — sampled from the Figma design (design/Borneo Tracker.png)
export const COLORS = {
  // Brand palette
  teal: '#003641', // dark teal
  forest: '#1B4532', // dark forest green (sidebar / footer)
  forestDark: '#143526',
  orange: '#FBA36A',
  cream: '#F6F3E1', // top bar
  offWhite: '#F7F4EB',
  pageBg: '#F5F5F2',

  // Accents
  amber: '#F2B33D', // primary action buttons (Sign In / Register / Submit)
  amberDark: '#E3A32C',
  leaf: '#9CBF88', // active sidebar item
  navy: '#0E3A5D', // secondary buttons (Find your account submit)

  // Text
  ink: '#1F2937',
  muted: '#6B7280',
  faint: '#9CA3AF',
  onDark: '#F3F6F1',

  // Status / RAG
  green: '#16A34A',
  greenSoft: '#D9F2E2',
  yellow: '#F4C542',
  yellowSoft: '#FBF3CE',
  red: '#DC2626',
  redSoft: '#FBDDDD',
  blue: '#2B7DE9',
  blueSoft: '#DBEAFE',
  grey: '#9CA3AF',
  greySoft: '#E5E7EB',

  // Map region fills (from design)
  regionTeal: '#2A9D8F', // Sarawak
  regionGreen: '#57A05C', // Sabah
  regionOrange: '#F49E4C', // Kalimantan
  regionYellow: '#F4C542', // Brunei

  border: '#E5E7EB',
  card: '#FFFFFF',
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
