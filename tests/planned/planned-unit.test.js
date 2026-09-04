import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/services/communityAttachmentStore.js', () => ({
  saveAttachment: vi.fn(),
  deleteAttachments: vi.fn(),
}));

vi.mock('../../src/services/supabaseClient.js', () => ({
  supabase: null,
  isSupabaseConfigured: false,
}));

import en from '../../src/i18n/locales/en.json';
import ms from '../../src/i18n/locales/ms.json';
import manifest from '../../public/data/manifest.json';
import resilienceModel from '../../public/data/resilience_model.json';
import { getRowsForTerritory, layerComparability } from '../../src/data/useIndicators.js';
import { validateManifestV2 } from '../../src/data/useIntegrity.js';
import { createPost, getPosts } from '../../src/services/communityService.js';
import { deleteAttachments, saveAttachment } from '../../src/services/communityAttachmentStore.js';
import { setUserStatus } from '../../src/services/adminUserService.js';
import { registrySources } from '../../src/utils/sourceRegistry.js';
import { classifyFreshness } from '../../src/utils/dataFreshness.js';
import { computeMomentum } from '../../src/utils/momentum.js';
import { recompute, simulate_resilience } from '../../src/utils/resilienceModel.js';
import { routeAiChatIntent } from '../../supabase/functions/ai-chat/intentRouter.ts';
import { validateSimulationGeminiResponse } from '../../supabase/functions/ai-chat/responseValidator.ts';

const PILLARS = ['Food', 'Energy', 'Education', 'Shelter', 'Healthcare', 'Entertainment'];

function singleTerritoryModel(values, { best = 100, worst = 0, unit = '%' } = {}) {
  const bounds = {};
  const inputs = {};
  const pillarScores = {};
  PILLARS.forEach((pillar, index) => {
    const indicator = `${pillar} metric`;
    bounds[indicator] = { best, worst, unit };
    inputs[indicator] = { value: values[index], unit, pillar };
    pillarScores[pillar] = values[index];
  });
  const index = values.reduce((sum, value) => sum + value, 0) / values.length;
  return {
    pillars: PILLARS,
    bounds,
    baseline: { Demo: { inputs, pillarScores, index, indexStrict: index } },
    index: { ragThresholds: { green: 70, amber: 40 } },
  };
}

const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;

function translationRoots(value, prefix = '', roots = new Set()) {
  Object.entries(value || {}).forEach(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === 'object' && !Array.isArray(child)) {
      translationRoots(child, path, roots);
    } else {
      roots.add(path.replace(PLURAL_SUFFIX, ''));
    }
  });
  return [...roots].sort();
}

function fileOf(name, type, size = 64) {
  return new File([new Uint8Array(size)], name, { type });
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  saveAttachment.mockResolvedValue(undefined);
  deleteAttachments.mockResolvedValue(undefined);
});

describe('Second suite — planned unit test cases', () => {
  it('UT-001 calculates a territory index from six valid pillar scores', () => {
    const result = recompute('Demo', {}, singleTerritoryModel([20, 40, 60, 80, 100, 0]));
    expect(result.index).toBe(50);
    expect(Object.keys(result.pillarScores)).toEqual(PILLARS);
  });

  it('UT-002 scores a lower-is-better indicator in the correct direction', () => {
    const model = singleTerritoryModel([20, 20, 20, 20, 20, 20], { best: 0, worst: 100 });
    expect(recompute('Demo', {}, model).pillarScores.Food).toBe(80);
  });

  it('UT-003 clamps values outside the target range to 0–100', () => {
    const model = singleTerritoryModel([50, 50, 50, 50, 50, 50]);
    const result = recompute('Demo', { 'Food metric': 999, 'Energy metric': -999 }, model);
    expect(result.pillarScores.Food).toBe(100);
    expect(result.pillarScores.Energy).toBe(0);
  });

  it('UT-004 leaves an unscored pillar missing instead of imputing it', () => {
    const model = singleTerritoryModel([50, 50, 50, 50, 50, 50]);
    model.baseline.Demo.inputs['Food metric'].unit = 'wrong-unit';
    const result = recompute('Demo', {}, model);
    expect(result.pillarScores.Food).toBeUndefined();
    expect(Object.keys(result.pillarScores)).toHaveLength(5);
  });

  it.each([
    [80, 'green'],
    [50, 'amber'],
    [20, 'red'],
  ])('UT-005 assigns the expected RAG band for index %s', (value, rag) => {
    expect(recompute('Demo', {}, singleTerritoryModel(Array(6).fill(value))).rag).toBe(rag);
  });

  it('UT-006 keeps poverty and unemployment outside active Resilience Index targets', () => {
    expect(resilienceModel.bounds).not.toHaveProperty('Poverty rate');
    expect(resilienceModel.bounds).not.toHaveProperty('Unemployment rate');
    expect(resilienceModel.indicatorToPillar).not.toHaveProperty('Poverty rate');
    expect(resilienceModel.indicatorToPillar).not.toHaveProperty('Unemployment rate');
  });

  it('UT-007 blocks ranking when indicator units differ', () => {
    const entries = [
      { territory: 'Sabah', row: { value: 100, unit: 'ha' } },
      { territory: 'Brunei', row: { value: 70, unit: '% land' } },
    ];
    expect(layerComparability(entries, 'forestCover')).toEqual({
      rankable: false,
      reason: 'unitMismatch',
      units: ['% land', 'ha'],
    });
  });

  it('UT-008 preserves geographic data-level labels on selected rows', () => {
    const rows = [
      { territory: 'Sabah', data_level: 'state' },
      { territory: 'Brunei', data_level: 'national' },
      { territory: 'Sabah', data_level: 'proxy' },
    ];
    expect(getRowsForTerritory(rows, 'Sabah').map((row) => row.data_level)).toEqual(['state', 'proxy']);
  });

  it('UT-009 does not manufacture incomplete provenance records', () => {
    const result = registrySources({
      sources: [
        { source_id: 'dosm', display_name: 'DOSM', official_url: 'https://data.gov.my' },
        { source_id: 'missing-name' },
      ],
    });
    expect(result).toHaveLength(1);
    expect(result[0]).not.toHaveProperty('confidence');
  });

  it('UT-010 classifies current, stale and very stale data correctly', () => {
    const now = new Date(2026, 8, 4);
    expect(classifyFreshness('2026-09-04', now).status).toBe('fresh');
    expect(classifyFreshness('2026-08-30', now).status).toBe('stale');
    expect(classifyFreshness('2026-08-20', now).status).toBe('veryStale');
  });

  it('UT-011 does not calculate momentum across a methodology break', () => {
    const result = computeMomentum([
      { date: '2026-08-16', index: 72.1, methodologyTag: 'v1' },
      { date: '2026-08-17', index: 67.6, methodologyTag: 'v2', isMethodologyBreak: true },
    ]);
    expect(result.delta).toBeNull();
    expect(result.direction).toBe('unknown');
  });

  it('UT-012 keeps required English and Malay translation roots in plural-aware parity', () => {
    expect(translationRoots(ms)).toEqual(translationRoots(en));
  });

  it('UT-013 routes dashboard, news, knowledge and simulation questions correctly', () => {
    expect(routeAiChatIntent('What is the Sabah resilience score?').intent).toBe('DASHBOARD_DATA');
    expect(routeAiChatIntent('Show the latest conservation news').intent).toBe('BORNEO_NEWS');
    expect(routeAiChatIntent('What is Borneo Tracker?').intent).toBe('SITE_KNOWLEDGE');
    expect(routeAiChatIntent('What if Brunei paddy production increased to 40?').intent).toBe('RESILIENCE_SIMULATION');
  });

  it('UT-014 rejects an AI simulation answer containing an unapproved number', () => {
    const simulationAnswer = {
      answer: 'Brunei changes from 78 to 83.4. Illustrative — deterministic scenario, not a forecast.',
      language: 'en',
      status: 'RESOLVED',
      territory: 'Brunei',
      indicator: 'Paddy production per capita',
      targetValue: 40,
      approvedNumericTokens: ['78', '83.4', '40'],
      approvedYearTokens: [],
      warnings: [],
    };
    const result = validateSimulationGeminiResponse({
      answer: 'Brunei changes from 78 to 99. Illustrative — deterministic scenario, not a forecast.',
      simulationAnswer,
      prompt: {
        systemInstruction: 'Use grounded values only.',
        userContent: '{}',
        groundingPayload: {
          answerStatus: 'RESOLVED',
          language: 'en',
          answer: simulationAnswer.answer,
          territory: 'Brunei',
          indicator: simulationAnswer.indicator,
          targetValue: 40,
          warnings: [],
          approvedNumericTokens: simulationAnswer.approvedNumericTokens,
          approvedYearTokens: [],
        },
      },
    });
    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain('UNAPPROVED_NUMBER');
  });

  it('UT-015 returns the same deterministic simulator result for the same input', () => {
    const changes = { 'Paddy production per capita': 40 };
    expect(simulate_resilience('Brunei', changes)).toEqual(simulate_resilience('Brunei', changes));
  });

  it('UT-016 rolls back saved attachments when a later save fails', async () => {
    saveAttachment.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('disk full'));
    await expect(createPost({
      title: 'Rollback case',
      body: 'Attachment rollback',
      topic: 'General',
      territory: 'Sabah',
      attachments: [fileOf('a.jpg', 'image/jpeg'), fileOf('b.jpg', 'image/jpeg')],
    })).rejects.toThrow('disk full');
    expect(deleteAttachments).toHaveBeenCalledTimes(1);
    expect((await getPosts()).some((post) => post.title === 'Rollback case')).toBe(false);
  });

  it('UT-017 reports an admin-service error instead of false success', async () => {
    await expect(setUserStatus('missing-user', 'suspended')).rejects.toThrow(/No account/i);
  });

  it('UT-018 accepts the committed manifest and rejects a modified descriptor', () => {
    expect(validateManifestV2(structuredClone(manifest))).toEqual(manifest);
    const modified = structuredClone(manifest);
    modified.files['public/data/indicators.json'].sha256 = 'not-a-hash';
    expect(() => validateManifestV2(modified)).toThrow(/descriptor/i);
  });
});
