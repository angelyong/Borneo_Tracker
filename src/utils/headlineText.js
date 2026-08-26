// Translation helpers for BT-07's headline object.
//
// `buildHeadline` returns raw data values plus two enum-like fields — the RAG
// band and the pillar name — which must be translated before they are
// interpolated into a sentence, or the UI prints "amber" and "Education" in a
// Malay page. Kept out of the component file so every surface that renders a
// headline (dashboard, ESG, SDG, Regional) uses the same rules.

export function translatePillar(t, pillar) {
  return pillar ? t(`dashboard.pillars.${pillar}`, { defaultValue: pillar }) : pillar;
}

export function translateHeadline(t, headline) {
  if (!headline?.key) return null;
  return t(headline.key, {
    ...headline.values,
    rag: headline.values?.rag ? t(`dashboard.ragBand_${headline.values.rag}`) : undefined,
    weakestPillar: headline.values?.weakestPillar
      ? translatePillar(t, headline.values.weakestPillar)
      : undefined,
  });
}
