// BT-23: one wiring path for the answer strip on every single-territory page.
//
// The Dashboard keeps its own composition because it also has an all-Borneo
// aggregate and a district mode with no comparable score. ESG, SDG and Regional
// Details all show exactly one territory, so they share this hook rather than
// each rebuilding the headline -> strip chain and drifting apart.

import { useMemo } from 'react';
import { useResilience } from './useIndicators';
import { buildHeadline } from '../utils/headline';
import { buildAnswerStrip } from '../utils/answerStrip';
import { makeSimulatorHref } from '../utils/simulatorRoute';

/**
 * Answer strip for one territory, or null while resilience.json is loading or
 * when that territory carries no finite index. Returning null keeps the page
 * unchanged instead of rendering an empty decision frame.
 */
export function useTerritoryAnswerStrip(territory) {
  const { data: resilience } = useResilience();

  return useMemo(() => {
    const entry = resilience?.territories?.[territory];
    if (!entry || !Number.isFinite(entry.index)) return null;

    return buildAnswerStrip({
      headline: buildHeadline(entry),
      territory,
      weakestPillar: entry.weakestPillar || null,
      pillarScores: entry.pillarScores || null,
      makeHref: makeSimulatorHref,
    });
  }, [resilience, territory]);
}
