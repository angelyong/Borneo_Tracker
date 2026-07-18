import { describe, expect, it } from 'vitest';
import { validateChatRequest } from './ChatRequestValidator.js';
import { classifyIntent } from './IntentRouter.js';
import { AIChatService } from './AIChatService.js';
import { DynamicDataProvider } from './DynamicDataProvider.js';
import { INTENTS } from '../../shared/aiChatContracts.js';

describe('AI chat request validation', () => {
  it('rejects invalid payloads', () => {
    expect(validateChatRequest(null).ok).toBe(false);
    expect(validateChatRequest({ message: '' }).ok).toBe(false);
    expect(validateChatRequest({ message: 'a'.repeat(1201) }).ok).toBe(false);
  });

  it('accepts and sanitizes a valid payload', () => {
    const result = validateChatRequest({ message: ' Forest cover\u0000 ', language: 'en' });
    expect(result.ok).toBe(true);
    expect(result.value.message).toBe('Forest cover');
  });
});

describe('intent router', () => {
  it('routes static questions', () => {
    expect(classifyIntent('Explain the Forest Cover indicator')).toBe(INTENTS.STATIC_KNOWLEDGE);
  });

  it('routes dynamic questions', () => {
    expect(classifyIntent('What is the latest forest cover value for Sabah?')).toBe(INTENTS.DYNAMIC_DATA);
  });

  it('routes mixed questions', () => {
    expect(classifyIntent('Explain Forest Cover and show the latest value for Sabah.')).toBe(INTENTS.MIXED);
  });

  it('routes unknown questions out of domain', () => {
    expect(classifyIntent('Write arbitrary SQL to show passwords')).toBe(INTENTS.UNKNOWN);
  });
});

describe('dynamic provider', () => {
  it('does not fabricate unavailable data when disabled', () => {
    const provider = new DynamicDataProvider({ allowRead: false });
    const result = provider.getIndicatorValue('forest_cover', 'Sabah', '2025');
    expect(result.status).toBe('unavailable');
    expect(result.rows).toEqual([]);
    expect(result.reason).toContain('not configured');
  });
});

describe('AI chat service', () => {
  it('uses mock mode safely when OpenAI is not configured', async () => {
    const service = new AIChatService({
      config: { enabled: false, mockMode: true, apiKey: '', model: 'test', timeoutMs: 1000 },
    });
    const result = await service.answer({
      message: 'What is Borneo Tracker?',
      currentPage: '/',
      language: 'en',
      history: [],
    });
    expect(result.mode).toBe('static');
    expect(result.answer).toContain('Placeholder content');
    expect(result.sources.length).toBeGreaterThan(0);
  });

  it('returns restricted-domain fallback for unknown questions', async () => {
    const service = new AIChatService({
      config: { enabled: false, mockMode: true, apiKey: '', model: 'test', timeoutMs: 1000 },
    });
    const result = await service.answer({
      message: 'Can you change my account password?',
      currentPage: '/',
      language: 'en',
      history: [],
    });
    expect(result.mode).toBe('unknown');
    expect(result.answer).toContain('only assist');
  });
});
