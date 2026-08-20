import { TERRITORIES } from '../data/useIndicators';

export const PILLAR_INDICATOR_CANDIDATES = {
  Food: ['Paddy production per capita', 'Agricultural land'],
  Energy: ['Electricity access', 'Electrification ratio', 'Domestic electrification ratio', 'Renewable electricity (% output)'],
  Education: ['Adult literacy', 'Mean years schooling (RLS)', 'School enrolment (primary, gross)', 'School enrolment (secondary, gross)'],
  Shelter: ['Clean water access', 'Basic sanitation access'],
  Healthcare: ['Life expectancy', 'Hospital beds (per 1k)'],
  Entertainment: ['Internet use'],
};

export function resolveSliderIndicator(pillar, inputs) {
  return (PILLAR_INDICATOR_CANDIDATES[pillar] || []).find((name) => inputs[name]) || null;
}

export function parseSimulatorRoute(search, model) {
  const params = new URLSearchParams(search);
  const territory = params.get('territory');
  const pillar = params.get('pillar');
  return {
    territory: TERRITORIES.includes(territory) ? territory : null,
    pillar: model?.pillars?.includes(pillar) ? pillar : null,
  };
}

export function makeSimulatorHref(territory, pillar) {
  return TERRITORIES.includes(territory) && pillar
    ? `/simulator?${new URLSearchParams({ territory, pillar }).toString()}`
    : null;
}
