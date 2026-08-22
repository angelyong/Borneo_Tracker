export const CHAT_ENDPOINT = import.meta.env.VITE_AI_CHAT_ENDPOINT?.trim() || '';

export const AI_CHAT_MODES = {
  GEMINI_TEST: 'gemini-test',
  TEMPLATE_FALLBACK: 'template-fallback',
};

export const SUPPORTED_CHAT_LANGUAGES = ['en', 'ms'];

export const MAX_CHAT_MESSAGE_LENGTH = 1200;

export const SUGGESTED_QUESTIONS = [
  // BT-14: client's three example "what BorneoBot can do with dashboard
  // data" queries, seeded first since they're the priority examples.
  'Compare Sabah and Sarawak',
  'Show districts with low food resilience',
  'Which territory improved the most?',
  'What is Borneo Tracker?',
  'What is the difference between ESG and SDG?',
  'Explain the Forest Cover indicator.',
  'Which SDGs are monitored by Borneo Tracker?',
  'Where does the environmental data come from?',
  'How do I generate a report?',
];
