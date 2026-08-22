// BT-12: resolves which indicator rows back a given hexagon pillar for the
// radar drill-down. `detail` is resilience.json's territories[X].detail,
// which compute_resilience.py already groups by `hexagon_pillar` (the True
// Wealth Hexagon grouping) — deliberately NOT `esg_pillar` (Environment/
// Social/Governance), a different classification used elsewhere in the app.
// An unscored pillar has no key in `detail` at all (compute() only adds a
// pillar once it has at least one scored indicator), so this always returns
// an array — never throws, never invents a placeholder row.
export function resolvePillarIndicators(detail, pillar) {
  if (!detail || !pillar) return [];
  const rows = detail[pillar];
  return Array.isArray(rows) ? rows : [];
}
