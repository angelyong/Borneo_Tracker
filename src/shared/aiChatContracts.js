export const CHAT_ENDPOINT = '/api/ai/chat';

export const AI_CHAT_MODES = {
  STATIC: 'static',
  DYNAMIC: 'dynamic',
  MIXED: 'mixed',
  UNKNOWN: 'unknown',
};

export const INTENTS = {
  STATIC_KNOWLEDGE: 'STATIC_KNOWLEDGE',
  DYNAMIC_DATA: 'DYNAMIC_DATA',
  MIXED: 'MIXED',
  UNKNOWN: 'UNKNOWN',
};

export const MAX_CHAT_MESSAGE_LENGTH = 1200;
export const MAX_HISTORY_MESSAGES = 8;

export const SUGGESTED_QUESTIONS = [
  'What is Borneo Tracker?',
  'What is the difference between ESG and SDG?',
  'Explain the Forest Cover indicator.',
  'Which SDGs are monitored by Borneo Tracker?',
  'Where does the environmental data come from?',
  'How do I generate a report?',
];
