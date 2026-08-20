import { describe, expect, it } from 'vitest';
import { makeSimulatorHref, parseSimulatorRoute, resolveSliderIndicator } from './simulatorRoute';

describe('Impact Simulator deep-link contract', () => {
  const model = { pillars: ['Food', 'Education'] };

  it('only accepts a real territory and model pillar', () => {
    expect(parseSimulatorRoute('?territory=Sarawak&pillar=Education', model)).toEqual({ territory: 'Sarawak', pillar: 'Education' });
    expect(parseSimulatorRoute('?territory=Overall%20Borneo&pillar=Food', model)).toEqual({ territory: null, pillar: 'Food' });
    expect(parseSimulatorRoute('?territory=Sabah&pillar=Unknown', model)).toEqual({ territory: 'Sabah', pillar: null });
  });

  it('keeps English canonical query keys and actual indicator inputs only', () => {
    expect(makeSimulatorHref('Sarawak', 'Education')).toBe('/simulator?territory=Sarawak&pillar=Education');
    expect(makeSimulatorHref('Overall Borneo', 'Food')).toBeNull();
    expect(resolveSliderIndicator('Food', { 'Agricultural land': {} })).toBe('Agricultural land');
  });
});
