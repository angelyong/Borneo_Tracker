import { randomUUID } from 'node:crypto';
import { AI_CHAT_MODES, INTENTS } from '../../shared/aiChatContracts.js';
import { getAIChatConfig, shouldUseLiveAI } from './config.js';
import { classifyIntent } from './IntentRouter.js';
import { StaticKnowledgeProvider } from './StaticKnowledgeProvider.js';
import { DynamicDataProvider } from './DynamicDataProvider.js';
import { staticSourceFromRecord, dynamicSourceFromRow, uniqueSources } from './SourceFormatter.js';
import { buildPrompt } from './PromptBuilder.js';
import { OpenAIClient } from './OpenAIClient.js';

function formatDynamicRows(rows) {
  return rows.slice(0, 4).map((row) => {
    if (row.title) return `${row.title}`;
    const value = row.value === null || row.value === undefined ? 'No data' : `${row.value}${row.unit ? ` ${row.unit}` : ''}`;
    return `${row.territory}: ${row.indicator} is ${value} (${row.year || 'year unavailable'}, source: ${row.source || 'source unavailable'}).`;
  });
}

function modeFromIntent(intent) {
  if (intent === INTENTS.STATIC_KNOWLEDGE) return AI_CHAT_MODES.STATIC;
  if (intent === INTENTS.DYNAMIC_DATA) return AI_CHAT_MODES.DYNAMIC;
  if (intent === INTENTS.MIXED) return AI_CHAT_MODES.MIXED;
  return AI_CHAT_MODES.UNKNOWN;
}

function buildFallbackAnswer({ intent, staticRecords, dynamicResult }) {
  if (intent === INTENTS.UNKNOWN) {
    return 'I can only assist with Borneo Tracker, ESG and SDG indicators, regional data, data sources, news, reports and website usage.';
  }

  const parts = [];
  if ([INTENTS.STATIC_KNOWLEDGE, INTENTS.MIXED].includes(intent)) {
    const records = staticRecords || [];
    if (records.length) {
      parts.push(records.map((record) => record.content).join('\n\n'));
    } else {
      parts.push('Static knowledge for this topic is not configured yet.');
    }
  }

  if ([INTENTS.DYNAMIC_DATA, INTENTS.MIXED].includes(intent)) {
    if (dynamicResult?.status === 'ok' && dynamicResult.rows?.length) {
      parts.push(`Dashboard data found:\n${formatDynamicRows(dynamicResult.rows).join('\n')}`);
    } else {
      parts.push(dynamicResult?.reason || 'Dynamic data connection is not configured yet.');
    }
  }

  return parts.join('\n\n');
}

export class AIChatService {
  constructor({
    config = getAIChatConfig(),
    staticKnowledgeProvider = new StaticKnowledgeProvider(),
    dynamicDataProvider = new DynamicDataProvider({ allowRead: String(process.env.AI_CHAT_DYNAMIC_READS || 'false').toLowerCase() === 'true' }),
    openAIClient = new OpenAIClient(config),
  } = {}) {
    this.config = config;
    this.staticKnowledgeProvider = staticKnowledgeProvider;
    this.dynamicDataProvider = dynamicDataProvider;
    this.openAIClient = openAIClient;
  }

  async answer(request) {
    const intent = classifyIntent(request.message);
    const mode = modeFromIntent(intent);
    const conversationId = request.conversationId || randomUUID();

    if (intent === INTENTS.UNKNOWN) {
      return {
        answer: buildFallbackAnswer({ intent }),
        mode,
        sources: [],
        conversationId,
      };
    }

    const needsStatic = intent === INTENTS.STATIC_KNOWLEDGE || intent === INTENTS.MIXED;
    const needsDynamic = intent === INTENTS.DYNAMIC_DATA || intent === INTENTS.MIXED;
    const staticResult = needsStatic ? this.staticKnowledgeProvider.search(request.message) : { records: [] };
    const dynamicResult = needsDynamic ? this.dynamicDataProvider.answer(request.message, request) : null;

    const sources = uniqueSources([
      ...(staticResult.records || []).map(staticSourceFromRecord),
      ...(dynamicResult?.rows || []).map(dynamicSourceFromRow),
    ]);

    let answer = buildFallbackAnswer({
      intent,
      staticRecords: staticResult.records,
      dynamicResult,
    });

    if (shouldUseLiveAI(this.config)) {
      try {
        const prompt = buildPrompt({
          request,
          intent,
          staticRecords: staticResult.records,
          dynamicResult,
        });
        const live = await this.openAIClient.createAnswer(prompt);
        if (live.status === 'ok' && live.text) {
          answer = live.text;
        }
      } catch {
        answer = `${answer}\n\nLive AI is temporarily unavailable, so this safe fallback response is shown.`;
      }
    }

    return {
      answer,
      mode,
      sources,
      conversationId,
    };
  }
}
