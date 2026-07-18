export function getAIChatConfig(env = process.env) {
  const mockMode = String(env.AI_CHAT_MOCK_MODE ?? 'true').toLowerCase() !== 'false';
  const enabled = String(env.AI_CHAT_ENABLED ?? 'false').toLowerCase() === 'true';
  return {
    enabled,
    mockMode,
    apiKey: env.OPENAI_API_KEY || '',
    model: env.OPENAI_MODEL || 'gpt-4.1-mini',
    vectorStoreId: env.OPENAI_VECTOR_STORE_ID || '',
    timeoutMs: Number(env.AI_CHAT_TIMEOUT_MS || 15000),
  };
}

export function shouldUseLiveAI(config) {
  return Boolean(config.enabled && !config.mockMode && config.apiKey);
}
