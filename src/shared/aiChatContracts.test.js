import { describe, expect, it } from 'vitest';
import {
  SUGGESTED_QUESTION_CONTRACT,
  SUGGESTED_QUESTION_CONTRACT_VERSION,
  SUGGESTED_QUESTIONS,
} from './aiChatContracts';
import goldenQuestions from '../../tests/ai-chat/golden/golden-questions.en.json';

describe('BorneoBot suggested questions', () => {
  it('derives the release-safe prompts from the versioned contract', () => {
    expect(SUGGESTED_QUESTIONS).toEqual([
      'Compare Sabah and Sarawak',
      "Which is Sabah's weakest pillar?",
      'Explain the Forest Cover indicator.',
    ]);
    expect(SUGGESTED_QUESTION_CONTRACT_VERSION).toBe('bt33-v1');
    expect(SUGGESTED_QUESTION_CONTRACT.filter((prompt) => prompt.enabled).map((prompt) => prompt.question))
      .toEqual(SUGGESTED_QUESTIONS);
  });

  it('keeps every client example traceable and disables only the unsupported ones', () => {
    const clientExamples = SUGGESTED_QUESTION_CONTRACT.filter((prompt) => prompt.clientWording);

    expect(clientExamples.map((prompt) => prompt.question)).toEqual([
      'Compare Sabah and Sarawak',
      'Show districts with low food resilience',
      'Find highest-risk regions',
    ]);
    expect(clientExamples.filter((prompt) => !prompt.enabled)).toEqual([
      expect.objectContaining({
        question: 'Show districts with low food resilience',
        blockedBy: expect.stringContaining('D2'),
      }),
      expect.objectContaining({
        question: 'Find highest-risk regions',
        blockedBy: expect.stringContaining('D3'),
      }),
    ]);
  });

  it('requires a Golden case for every enabled prompt', () => {
    for (const prompt of SUGGESTED_QUESTION_CONTRACT.filter((item) => item.enabled)) {
      const goldenCase = goldenQuestions.find((item) => item.id === prompt.goldenCaseId);
      expect(prompt.goldenCaseId).toMatch(/^golden-en-\d+$/);
      expect(prompt.requiredIntent).toMatch(/^(DASHBOARD_DATA|SITE_KNOWLEDGE)$/);
      expect(prompt.expectedAvailability).toBe('AVAILABLE');
      expect(goldenCase).toMatchObject({
        question: prompt.question,
        implementationStatus: 'IMPLEMENTED',
        expected: expect.objectContaining({
          intent: prompt.requiredIntent,
        }),
      });
      if (prompt.requiredIntent === 'DASHBOARD_DATA') {
        expect(goldenCase.expected.factAvailability).toBe(prompt.expectedAvailability);
      } else {
        expect(goldenCase.expected.knowledge?.status).toBe('FOUND');
      }
      expect(goldenCase.tags).toContain('suggested_question');
    }
  });
});
