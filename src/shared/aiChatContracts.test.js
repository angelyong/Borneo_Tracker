import { describe, expect, it } from 'vitest';
import { SUGGESTED_QUESTIONS } from './aiChatContracts';

describe('BorneoBot suggested questions', () => {
  it('seeds the three client decision and drill-down examples', () => {
    expect(SUGGESTED_QUESTIONS).toEqual([
      'Compare Sabah and Sarawak',
      'Show districts with low food resilience',
      'Explain the Forest Cover indicator.',
    ]);
  });
});
