import { shouldUseLiveAI } from './config.js';

export class OpenAIClient {
  constructor(config) {
    this.config = config;
  }

  async createAnswer(prompt) {
    if (!shouldUseLiveAI(this.config)) {
      return { status: 'disabled', text: '' };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const { default: OpenAI } = await import('openai');
      const client = new OpenAI({ apiKey: this.config.apiKey });
      const response = await client.responses.create(
        {
          model: this.config.model,
          instructions: prompt.instructions,
          input: prompt.input,
        },
        { signal: controller.signal }
      );
      return { status: 'ok', text: response.output_text || '' };
    } finally {
      clearTimeout(timeout);
    }
  }
}
