// Parses a "what if" resilience question into a concrete simulate_resilience()
// call: which territory, which indicator, and what target value. Reuses the
// already-resolved AIChatEntityResult (territories/indicators/pillars —
// entityResolver.ts) rather than re-implementing entity extraction; this
// module only adds what entityResolver doesn't do: picking exactly one
// territory/indicator out of possibly-many matches, and extracting the
// numeric target value the user asked for.
//
// Per IMPACT_SIMULATOR_SPEC.md / IS-6 task 5: if the request doesn't map
// cleanly to a real indicator/territory/value, this returns
// NEEDS_CLARIFICATION rather than guessing — the caller must never invoke
// simulate_resilience() with invalid or fabricated parameters.
import type { AIChatEntityResult } from './contracts.ts';
import { getResilienceModel } from './resilienceSimulation.ts';

export type ResilienceSimulationRequest =
  | {
      status: 'RESOLVED';
      territory: string;
      indicator: string;
      targetValue: number;
    }
  | {
      status: 'NEEDS_CLARIFICATION';
      reasons: string[];
      candidateTerritories: string[];
      candidateIndicators: string[];
    };

const VALID_TERRITORIES = ['Sabah', 'Sarawak', 'Brunei', 'Kalimantan'];

function normalizeNumber(text: string): number {
  return Number(text.replace(/,/g, ''));
}

// Tries, in order: "from X to Y" (take Y — the target, not the starting
// point), then "to X" (any phrasing ending in "...to/kepada/ke <number>%?").
// Anything else (e.g. only a relative "by X" change, no absolute target) is
// deliberately left unparsed rather than guessed. "kepada" and "ke" both
// mean "to" in Malay ("kepada" is the more common preposition; "ke" also
// appears, e.g. in year ranges elsewhere in this codebase).
export function extractTargetValue(message: string): number | null {
  const fromTo = message.match(/\bfrom\s+([\d,.]+)\s*%?\s*(?:to|kepada|ke)\s+([\d,.]+)\s*%?/i);
  if (fromTo) {
    const value = normalizeNumber(fromTo[2]);
    return Number.isFinite(value) ? value : null;
  }
  const to = message.match(/\b(?:to|kepada|ke)\s+([\d,.]+)\s*%?/i);
  if (to) {
    const value = normalizeNumber(to[1]);
    return Number.isFinite(value) ? value : null;
  }
  return null;
}

function candidateIndicatorsForPillars(pillars: string[]): string[] {
  const model = getResilienceModel();
  if (!pillars.length) return Object.keys(model.bounds);
  const byPillar = new Set(pillars);
  return Object.entries(model.indicatorToPillar)
    .filter(([, pillar]) => byPillar.has(pillar))
    .map(([indicator]) => indicator);
}

export function parseResilienceSimulationRequest(
  message: string,
  entities: AIChatEntityResult
): ResilienceSimulationRequest {
  const model = getResilienceModel();
  const reasons: string[] = [];

  const matchedTerritories = [...new Set(entities.regions)].filter((territory) => VALID_TERRITORIES.includes(territory));
  const matchedIndicators = [...new Set(entities.indicators)].filter((indicator) => Boolean(model.bounds[indicator]));
  const targetValue = extractTargetValue(message);

  if (matchedTerritories.length === 0) {
    reasons.push('No territory (Sabah, Sarawak, Brunei, or Kalimantan) was recognised in the question.');
  } else if (matchedTerritories.length > 1) {
    reasons.push(`Multiple territories were mentioned (${matchedTerritories.join(', ')}); a simulation applies to exactly one territory.`);
  }

  if (matchedIndicators.length === 0) {
    reasons.push('No specific, scoreable resilience indicator was recognised in the question.');
  } else if (matchedIndicators.length > 1) {
    reasons.push(`Multiple indicators were mentioned (${matchedIndicators.join(', ')}); a simulation changes exactly one indicator at a time.`);
  }

  if (targetValue === null) {
    reasons.push('No target value (e.g. "...to 70" or "...from 8 to 40") was found in the question.');
  }

  if (reasons.length) {
    return {
      status: 'NEEDS_CLARIFICATION',
      reasons,
      candidateTerritories: VALID_TERRITORIES,
      candidateIndicators: candidateIndicatorsForPillars(entities.pillars),
    };
  }

  return {
    status: 'RESOLVED',
    territory: matchedTerritories[0],
    indicator: matchedIndicators[0],
    targetValue: targetValue as number,
  };
}
