import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/services/supabaseClient.js', () => ({
  supabase: null,
  isSupabaseConfigured: false,
}));

import indicators from '../../public/data/indicators.json';
import manifest from '../../public/data/manifest.json';
import resilience from '../../public/data/resilience.json';
import { getCanonicalRows, summarizeRows } from '../../src/data/useIndicators.js';
import { sendAIChatMessage } from '../../src/services/AIChatService.js';
import { approveNews, getAllNews, getPendingDrafts, rejectNews, updateNews } from '../../src/services/adminNewsService.js';
import { getAllUsers, setUserStatus } from '../../src/services/adminUserService.js';
import { createPost, deletePost, getPosts } from '../../src/services/communityService.js';
import { listAttachmentRecords } from '../../src/services/communityAttachmentStore.js';
import { recompute } from '../../src/utils/resilienceModel.js';
import { resolveAiChatEntities } from '../../supabase/functions/ai-chat/entityResolver.ts';
import { routeAiChatIntent } from '../../supabase/functions/ai-chat/intentRouter.ts';
import { parseResilienceSimulationRequest } from '../../supabase/functions/ai-chat/resilienceSimulationRequest.ts';
import { buildSimulationAnswer } from '../../supabase/functions/ai-chat/simulationAnswerBuilder.ts';

const root = resolve(process.cwd());
const atRoot = (path) => resolve(root, path);
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

function response(body, { status = 200 } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function fileOf(name, type, size = 64) {
  return new File([new Uint8Array(size)], name, { type });
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('Second suite — planned integration test cases', () => {
  it('IT-001 validates ingestion output against the standard schema', async () => {
    const csv = await readFile(atRoot('borneo_tracker_poc.csv'), 'utf8');
    const headers = csv.split(/\r?\n/, 1)[0].split(',').map((value) => value.trim());
    ['territory', 'indicator', 'year', 'value', 'unit', 'source', 'data_level'].forEach((field) => {
      expect(headers).toContain(field);
    });
  });

  it('IT-002 reproduces committed territory resilience from the exported model', () => {
    for (const [territory, expected] of Object.entries(resilience.territories)) {
      const actual = recompute(territory, {});
      expect(actual.index).toBeCloseTo(expected.index, 1);
      expect(actual.pillarScores).toEqual(expected.pillarScores);
      expect(actual.weakestPillar).toBe(expected.weakestPillar);
    }
  });

  it('IT-003 connects published indicator JSON to frontend selection helpers', () => {
    const sabah = getCanonicalRows(indicators.rows, 'Sabah');
    const summary = summarizeRows(sabah);
    expect(sabah.length).toBeGreaterThan(0);
    expect(summary.count).toBe(sabah.length);
    expect(summary.latestYear).toBeGreaterThan(2000);
    expect(sabah.every((row) => row.territory === 'Sabah' && row.canonical === 1)).toBe(true);
  });

  it('IT-004 verifies manifest descriptors against the published files', async () => {
    for (const [path, descriptor] of Object.entries(manifest.files)) {
      const bytes = await readFile(atRoot(path));
      expect(bytes.byteLength).toBe(descriptor.bytes);
      expect(sha256(bytes)).toBe(descriptor.sha256);
    }
    const original = await readFile(atRoot('public/data/resilience.json'));
    const changed = Buffer.concat([original, Buffer.from('changed')]);
    expect(sha256(changed)).not.toBe(manifest.files['public/data/resilience.json'].sha256);
  });

  it('IT-005 connects AI routing, entities, simulation parsing and safe answer building', () => {
    const message = "What if Brunei's paddy production per capita went from 8 to 40?";
    expect(routeAiChatIntent(message).intent).toBe('RESILIENCE_SIMULATION');
    const entities = resolveAiChatEntities(message, { language: 'en' });
    const request = parseResilienceSimulationRequest(message, entities);
    const answer = buildSimulationAnswer(request, 'en');
    expect(request).toMatchObject({ status: 'RESOLVED', territory: 'Brunei', targetValue: 40 });
    expect(answer.status).toBe('RESOLVED');
    expect(answer.answer).toContain('Illustrative — deterministic scenario, not a forecast.');
  });

  it('IT-006 sends the frontend chat contract to the configured Edge endpoint', async () => {
    vi.stubEnv('VITE_AI_CHAT_ENDPOINT', 'https://edge.example.test/ai-chat');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({
      answer: 'Grounded answer',
      mode: 'template-fallback',
      sources: [],
    })));
    const result = await sendAIChatMessage({
      message: 'What is Borneo Tracker?',
      currentPage: '/',
      language: 'en',
      accessTokenProvider: () => 'test-token',
    });
    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe('https://edge.example.test/ai-chat');
    expect(options.method).toBe('POST');
    expect(options.headers.Authorization).toBe('Bearer test-token');
    expect(result.answer).toBe('Grounded answer');
  });

  it('IT-007 keeps quota and telemetry database contracts together', async () => {
    const migration = await readFile(atRoot('supabase/migrations/20260804000100_ai_chat_infrastructure_contracts.sql'), 'utf8');
    expect(migration).toMatch(/create table if not exists public\.ai_chat_daily_usage/i);
    expect(migration).toMatch(/create table if not exists public\.ai_chat_events/i);
    expect(migration).toMatch(/reserve_ai_chat_quota/i);
    expect(migration).toMatch(/refund_ai_chat_quota/i);
  });

  it('IT-008 connects authentication profiles, roles, suspension and RLS contracts', async () => {
    const schema = await readFile(atRoot('supabase/auth_schema.sql'), 'utf8');
    expect(schema).toMatch(/create table.*profiles/is);
    expect(schema).toMatch(/role/i);
    expect(schema).toMatch(/status/i);
    expect(schema).toMatch(/suspended/i);
    expect(schema).toMatch(/row level security|enable row level security/i);
  });

  it('IT-009 persists admin suspend and reactivate actions through the service boundary', async () => {
    const target = (await getAllUsers()).find((user) => user.role === 'user');
    const suspended = await setUserStatus(target.id, 'suspended');
    expect(suspended.status).toBe('suspended');
    expect((await getAllUsers()).find((user) => user.id === target.id).status).toBe('suspended');
    const active = await setUserStatus(target.id, 'active');
    expect(active.status).toBe('active');
  });

  it('IT-010 connects admin news review actions to the public status model', async () => {
    const pending = (await getPendingDrafts())[0];
    expect(pending).toBeTruthy();
    const edited = await updateNews(pending.id, { title: 'Integration title', body: 'Integration body' });
    expect(edited).toMatchObject({ title: 'Integration title', body: 'Integration body' });
    const approved = await approveNews(pending.id);
    expect(approved.status).toBe('published');
    const rejected = await rejectNews(pending.id);
    expect(rejected.status).toBe('rejected');
    expect((await getAllNews()).find((item) => item.id === pending.id).status).toBe('rejected');
  });

  it('IT-011 keeps community post metadata and attachment storage consistent', async () => {
    const created = await createPost({
      title: 'Integration post',
      body: 'Attachment metadata integration',
      topic: 'General',
      territory: 'Sabah',
      attachments: [fileOf('evidence.pdf', 'application/pdf')],
    });
    expect((await getPosts()).find((post) => post.id === created.id)?.attachments).toHaveLength(1);
    expect(await listAttachmentRecords()).toHaveLength(1);
    await deletePost(created.id);
    expect((await getPosts()).some((post) => post.id === created.id)).toBe(false);
    expect(await listAttachmentRecords()).toHaveLength(0);
  });

  it('IT-012 verifies the source files required by the deployment package', async () => {
    const required = [
      'index.html',
      'vite.config.js',
      'public/.htaccess',
      'public/data/manifest.json',
      'public/data/indicators.json',
      'public/data/resilience.json',
    ];
    for (const path of required) {
      expect((await stat(atRoot(path))).size, `${path} should be non-empty`).toBeGreaterThan(0);
    }
    expect(root).toMatch(/Borneo_Tracker-js$/);
  });
});
