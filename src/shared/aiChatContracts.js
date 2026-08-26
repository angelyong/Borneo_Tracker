export const CHAT_ENDPOINT = import.meta.env.VITE_AI_CHAT_ENDPOINT?.trim() || '';

export const AI_CHAT_MODES = {
  GEMINI_TEST: 'gemini-test',
  TEMPLATE_FALLBACK: 'template-fallback',
};

export const SUPPORTED_CHAT_LANGUAGES = ['en', 'ms'];

export const MAX_CHAT_MESSAGE_LENGTH = 1200;

// This is the release contract, not a marketing list. A prompt is displayed
// only when its exact wording has an evidence-backed answer path. Keep the
// blocked client examples recorded here so a future change cannot silently
// relabel a substitute prompt as client-delivered functionality.
export const SUGGESTED_QUESTION_CONTRACT_VERSION = 'bt33-v1';

export const SUGGESTED_QUESTION_CONTRACT = Object.freeze([
  Object.freeze({
    id: 'compare-sabah-sarawak',
    question: 'Compare Sabah and Sarawak',
    provenance: 'Client §3.2 example',
    clientWording: true,
    requiredIntent: 'DASHBOARD_DATA',
    requiredOperation: 'comparison',
    expectedAvailability: 'AVAILABLE',
    enabled: true,
    goldenCaseId: 'golden-en-048',
  }),
  Object.freeze({
    id: 'sabah-weakest-pillar',
    question: "Which is Sabah's weakest pillar?",
    provenance: 'Release-safe Borneo Tracker prompt',
    clientWording: false,
    requiredIntent: 'DASHBOARD_DATA',
    requiredOperation: 'weakest',
    expectedAvailability: 'AVAILABLE',
    enabled: true,
    goldenCaseId: 'golden-en-007',
  }),
  Object.freeze({
    id: 'explain-forest-cover',
    question: 'Explain the Forest Cover indicator.',
    provenance: 'Release-safe Borneo Tracker prompt',
    clientWording: false,
    requiredIntent: 'SITE_KNOWLEDGE',
    expectedAvailability: 'AVAILABLE',
    enabled: true,
    goldenCaseId: 'golden-en-038',
  }),
  Object.freeze({
    id: 'low-food-resilience-districts',
    question: 'Show districts with low food resilience',
    provenance: 'Client §3.2 example',
    clientWording: true,
    requiredIntent: 'DASHBOARD_DATA',
    requiredOperation: 'districtLevel',
    expectedAvailability: 'BLOCKED',
    enabled: false,
    blockedBy: 'D2: no approved, comparable district Food data or scoring rule exists.',
  }),
  Object.freeze({
    id: 'highest-risk-regions',
    question: 'Find highest-risk regions',
    provenance: 'Client §3.2 example',
    clientWording: true,
    requiredIntent: 'DASHBOARD_DATA',
    requiredOperation: 'ranking',
    expectedAvailability: 'BLOCKED',
    enabled: false,
    blockedBy: 'D3: “risk” has no approved resilience-risk methodology or ranking definition.',
  }),
]);

export const SUGGESTED_QUESTIONS = SUGGESTED_QUESTION_CONTRACT
  .filter((prompt) => prompt.enabled)
  .map((prompt) => prompt.question);
