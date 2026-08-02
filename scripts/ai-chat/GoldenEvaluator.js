import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_ROOT = process.cwd();
const GOLDEN_DIR = 'tests/ai-chat/golden';
const NEWS_FIXTURE_PATH = 'tests/fixtures/ai-chat/golden-news-fixtures.json';
const REPORT_JSON = 'reports/ai-chat/golden-evaluation.json';
const REPORT_MD = 'reports/ai-chat/golden-evaluation.md';

const FINAL_STATUS_SKIP = new Set(['NOT_IMPLEMENTED', 'BLOCKED_BY_SUPABASE', 'NO_VERIFIED_DATA']);
const SAFETY_TAGS = new Set(['safety', 'security', 'numeric', 'privacy']);
const SAFETY_FAILURE_CODES = new Set([
  'PENDING_NEWS_EXPOSED',
  'BLOCKED_COMPARISON_ALLOWED',
  'CLARIFICATION_GUESSED',
  'UNAPPROVED_NUMBER',
  'UNAPPROVED_YEAR',
  'URL_IN_BODY',
  'SOURCE_PATH_EXPOSED',
  'SECRET_DISCLOSURE',
  'SYSTEM_INSTRUCTION_DISCLOSURE',
  'INTERNAL_METADATA_DISCLOSURE',
  'UNVERIFIED_RECOMMENDATION',
  'INVALID_GEMINI_OUTPUT_ACCEPTED',
  'REQUEST_VALIDATION_BYPASS',
  'GEMINI_SOURCE_ACCEPTED',
]);

const OPERATION_KEYS = [
  'comparison',
  'ranking',
  'trend',
  'weakest',
  'strongest',
  'targetGap',
  'sdgProgress',
  'districtLevel',
  'latest',
];

const REQUIRED_FILES = [
  'golden-schema.json',
  'golden-evaluation-config.json',
  'golden-questions.en.json',
  'golden-questions.ms.json',
];

export class GoldenValidationError extends Error {
  constructor(errors) {
    super(`Golden validation failed with ${errors.length} error(s).`);
    this.name = 'GoldenValidationError';
    this.errors = errors;
  }
}

export class GoldenEvaluator {
  constructor(options = {}) {
    this.rootDir = options.rootDir || DEFAULT_ROOT;
    this.modules = options.modules || {};
    this.data = options.data || {};
    this.reportPaths = {
      json: options.reportJson || path.join(this.rootDir, REPORT_JSON),
      markdown: options.reportMarkdown || path.join(this.rootDir, REPORT_MD),
    };
  }

  loadGoldenFiles() {
    const dir = path.join(this.rootDir, GOLDEN_DIR);
    const files = Object.fromEntries(REQUIRED_FILES.map((name) => [
      name,
      readJson(path.join(dir, name)),
    ]));
    const questions = [
      ...files['golden-questions.en.json'],
      ...files['golden-questions.ms.json'],
    ].sort((a, b) => a.id.localeCompare(b.id));
    const newsFixtures = readJson(path.join(this.rootDir, NEWS_FIXTURE_PATH));
    return {
      schema: files['golden-schema.json'],
      config: files['golden-evaluation-config.json'],
      questions,
      byLanguage: {
        en: files['golden-questions.en.json'],
        ms: files['golden-questions.ms.json'],
      },
      newsFixtures,
    };
  }

  validateGoldenFiles() {
    const loaded = this.loadGoldenFiles();
    const errors = validateGoldenData(loaded);
    return {
      valid: errors.length === 0,
      errors,
      questionCount: loaded.questions.length,
      englishCount: loaded.byLanguage.en.length,
      malayCount: loaded.byLanguage.ms.length,
    };
  }

  async evaluate() {
    const loaded = this.loadGoldenFiles();
    const validation = this.validateGoldenFiles();
    if (!validation.valid) throw new GoldenValidationError(validation.errors);

    const recordResults = [];
    for (const record of loaded.questions) {
      recordResults.push(await this.evaluateRecord(record, loaded));
    }

    const report = buildReport({
      config: loaded.config,
      questions: loaded.questions,
      recordResults,
      validation,
      data: this.data,
    });
    return report;
  }

  async writeReports(report) {
    fs.mkdirSync(path.dirname(this.reportPaths.json), { recursive: true });
    fs.writeFileSync(this.reportPaths.json, `${stableStringify(report)}\n`);
    fs.writeFileSync(this.reportPaths.markdown, `${renderMarkdownReport(report)}\n`);
  }

  async evaluateAndWrite() {
    const report = await this.evaluate();
    await this.writeReports(report);
    return report;
  }

  async evaluateRecord(record, loaded) {
    const checks = [];
    const actual = {};
    const context = record.context || {};
    const expected = record.expected;

    const route = this.modules.routeAiChatIntent(record.question, {
      currentPage: context.currentPage || '/',
      region: context.region || '',
      language: context.language || record.language,
    });
    actual.intent = route.intent;
    actual.language = route.language;
    checks.push(checkEqual('routing', expected.intent, route.intent));

    const entities = this.modules.resolveAiChatEntities(record.question, {
      region: context.region || '',
      language: context.language || record.language,
    });
    actual.entities = summarizeEntities(entities);
    checks.push(...checkExpectedArrays(expected, entities));
    checks.push(...checkOperations(expected.operations, entities.operations));

    let comparability;
    let factObject;
    let structuredAnswer;
    let levers;

    if (expected.intent === 'DASHBOARD_DATA') {
      comparability = this.modules.evaluateComparability({
        intent: route,
        entities,
        metadata: {
          rows: this.data.indicators?.rows || [],
          series: this.data.indicators?.series || {},
          districts: this.data.districts || {},
        },
        freshness: {
          now: '2026-08-02',
          districtsGeneratedAt: this.data.districts?.generatedAt,
        },
        options: comparabilityOptionsFor(record),
      });
      actual.comparabilityDecision = comparability.decision;
      if (expected.comparabilityDecision) {
        checks.push(checkEqual('comparability', expected.comparabilityDecision, comparability.decision));
      }

      factObject = this.modules.buildAIChatFactObject({ intent: route, entities, comparability });
      actual.factAvailability = factObject.availability;
      if (expected.factAvailability) {
        checks.push(checkEqual('factAvailability', expected.factAvailability, factObject.availability));
      }

      levers = this.modules.retrieveVerifiedLevers({
        concepts: entities.concepts,
        pillars: entities.pillars,
        territories: factObject.territories,
        language: entities.language,
        factObject,
        limit: 2,
      });
      actual.leverCount = levers.records.length;

      structuredAnswer = this.modules.buildStructuredAnswer({
        language: entities.language || record.language,
        factObject,
        entities,
        comparability,
        levers,
      });
      this.modules.buildGroundedPrompt({
        userQuestion: record.question,
        language: structuredAnswer.language,
        intent: route.intent,
        entities,
        comparability,
        factObject,
        structuredAnswer,
        levers,
      });
      actual.blocked = structuredAnswer.blocked;
      actual.clarificationRequired = structuredAnswer.clarificationRequired;
      checks.push(checkEqual('blocked', expected.blocked, structuredAnswer.blocked));
      checks.push(checkEqual('clarification', expected.clarificationRequired, structuredAnswer.clarificationRequired));
    } else if (expected.intent === 'SITE_KNOWLEDGE') {
      const repository = new this.modules.KnowledgeRepository({ artifact: this.data.knowledgeIndex });
      const retrieval = this.modules.retrieveStaticKnowledge({
        question: record.question,
        language: entities.language || route.language || record.language,
        currentPage: context.currentPage || '/',
        territories: entities.territories,
        concepts: entities.concepts,
        limit: 10,
      }, repository);
      const answer = this.modules.buildKnowledgeAnswer(retrieval, entities.language || route.language || record.language);
      actual.knowledge = {
        status: retrieval.status,
        topRecordId: retrieval.matches[0]?.record.id,
        recordIds: retrieval.matches.map((match) => match.record.id),
        answerRecordIds: answer.recordIds,
        sourceCount: answer.sources.length,
        warnings: answer.warnings,
      };
      if (expected.knowledge?.status) {
        checks.push(checkEqual('knowledgeRetrieval', expected.knowledge.status, retrieval.status, 'status'));
      }
      if (expected.knowledge?.expectedRecordIds?.length) {
        const expectedIds = expected.knowledge.expectedRecordIds;
        checks.push({
          metric: 'knowledgeTop1',
          field: 'topRecordId',
          expected: expectedIds[0],
          actual: retrieval.matches[0]?.record.id,
          pass: retrieval.matches[0]?.record.id === expectedIds[0],
        });
        checks.push({
          metric: 'knowledgeRecallAt3',
          field: 'recordIds',
          expected: sortStrings(expectedIds),
          actual: sortStrings(retrieval.matches.slice(0, 3).map((match) => match.record.id)),
          pass: expectedIds.every((id) => retrieval.matches.slice(0, 3).some((match) => match.record.id === id)),
        });
        checks.push({
          metric: 'knowledgeRecallAt10',
          field: 'recordIds',
          expected: sortStrings(expectedIds),
          actual: sortStrings(retrieval.matches.slice(0, 10).map((match) => match.record.id)),
          pass: expectedIds.every((id) => retrieval.matches.slice(0, 10).some((match) => match.record.id === id)),
        });
      }
      if (expected.knowledge?.sourceCountMin !== undefined) {
        checks.push({
          metric: 'knowledgeSources',
          field: 'sourceCount',
          expected: expected.knowledge.sourceCountMin,
          actual: answer.sources.length,
          pass: answer.sources.length >= expected.knowledge.sourceCountMin,
        });
      }
      actual.blocked = false;
      actual.clarificationRequired = false;
      checks.push(checkEqual('blocked', expected.blocked, false));
      checks.push(checkEqual('clarification', expected.clarificationRequired, false));
    } else {
      actual.blocked = false;
      actual.clarificationRequired = false;
      checks.push(checkEqual('blocked', expected.blocked, false));
      checks.push(checkEqual('clarification', expected.clarificationRequired, false));
    }

    if (expected.intent === 'BORNEO_NEWS' && expected.news) {
      const newsResult = await this.evaluateNews(record, expected.news, route, entities, loaded.newsFixtures);
      actual.news = newsResult.actual;
      checks.push(...newsResult.checks);
    }

    if (expected.validator) {
      const validationResult = this.evaluateValidatorFixture(expected.validator);
      actual.validator = validationResult.actual;
      checks.push(...validationResult.checks);
    }

    if (expected.fallbackReason) {
      const fallbackResult = this.evaluateFallback(record, route, structuredAnswer, expected.fallbackReason);
      actual.fallback = fallbackResult.actual;
      checks.push(...fallbackResult.checks);
    }

    if (record.implementationStatus === 'NO_VERIFIED_DATA') {
      checks.push(checkEqual('leverCoverage', 0, actual.leverCount || 0));
    }

    const failedChecks = checks.filter((item) => !item.pass);
    const safetyCriticalFailures = failedChecks.filter((item) => isSafetyCritical(record, item));
    const skipped = FINAL_STATUS_SKIP.has(record.implementationStatus);

    return {
      id: record.id,
      language: record.language,
      tags: [...record.tags].sort(),
      implementationStatus: record.implementationStatus,
      status: skipped ? 'skipped' : failedChecks.length ? 'failed' : 'passed',
      safetyCritical: safetyCriticalFailures.length > 0,
      checks: checks.sort((a, b) => a.metric.localeCompare(b.metric)),
      failures: failedChecks.map(publicFailure),
      actual: publicActual(actual),
    };
  }

  async evaluateNews(record, expectedNews, route, entities, newsFixtures) {
    const repository = new this.modules.LocalNewsRepository({ records: newsFixtures.records });
    const result = await this.modules.retrieveAIChatNews({
      intent: route,
      entities,
      language: record.language,
      repository,
    });
    const serialized = JSON.stringify({
      published: result.published,
      pending: result.pending,
      warnings: result.warnings,
      queryApplied: result.queryApplied,
    });
    const exposedSentinel = (newsFixtures.pendingSentinels || []).some((token) => serialized.includes(token));
    return {
      actual: {
        publishedCount: result.published.length,
        pendingCount: result.pending.count,
        pendingSentinelExposed: exposedSentinel,
      },
      checks: [
        checkEqual('newsPrivacy', expectedNews.publishedCount, result.published.length, 'publishedCount'),
        checkEqual('newsPrivacy', expectedNews.pendingCount, result.pending.count, 'pendingCount'),
        {
          metric: 'newsPrivacy',
          field: 'pendingSentinel',
          expected: false,
          actual: exposedSentinel,
          pass: expectedNews.forbidPendingSentinel ? !exposedSentinel : true,
          safetyCode: exposedSentinel ? 'PENDING_NEWS_EXPOSED' : undefined,
        },
      ],
    };
  }

  evaluateValidatorFixture(expectedValidator) {
    const input = buildValidatorInput(this.modules);
    const answer = validatorAnswer(expectedValidator.fixture, input.structuredAnswer);
    const result = this.modules.validateGeminiResponse({
      ...input,
      answer,
    });
    const codes = result.issues.map((issue) => issue.code).sort();
    return {
      actual: {
        valid: result.valid,
        issueCodes: codes,
      },
      checks: [
        checkEqual('numericSecurityValidation', expectedValidator.valid, result.valid, 'valid'),
        {
          metric: 'numericSecurityValidation',
          field: 'failureCode',
          expected: expectedValidator.failureCode,
          actual: codes[0],
          pass: expectedValidator.valid || codes.includes(expectedValidator.failureCode),
          safetyCode: expectedValidator.safetyCritical ? expectedValidator.failureCode : undefined,
        },
      ],
    };
  }

  evaluateFallback(record, route, structuredAnswer, expectedReason) {
    const answer = structuredAnswer || buildValidatorInput(this.modules).structuredAnswer;
    const result = this.modules.buildTemplateFallback({
      structuredAnswer: answer,
      reason: expectedReason,
      language: record.language,
      intent: route.intent === 'DASHBOARD_DATA' ? route : { ...route, intent: 'DASHBOARD_DATA' },
    });
    const unsafe = /https?:\/\//i.test(result.answer) || /PENDING_SENTINEL|AICHATBOTGEMINI_API_KEY|system prompt/i.test(result.answer);
    return {
      actual: {
        mode: result.mode,
        reason: result.fallback.reason,
        unsafeContent: unsafe,
      },
      checks: [
        checkEqual('fallbackBehavior', 'template-fallback', result.mode, 'mode'),
        checkEqual('fallbackBehavior', expectedReason, result.fallback.reason, 'reason'),
        {
          metric: 'fallbackBehavior',
          field: 'unsafeContent',
          expected: false,
          actual: unsafe,
          pass: !unsafe,
          safetyCode: unsafe ? 'INVALID_GEMINI_OUTPUT_ACCEPTED' : undefined,
        },
      ],
    };
  }
}

export function validateGoldenData(loaded) {
  const errors = [];
  const config = loaded.config;
  const seenIds = new Set();
  const seenQuestions = new Map();

  for (const record of loaded.questions) {
    const prefix = `${record.id || '<missing id>'}:`;
    if (!record.id || seenIds.has(record.id)) errors.push(`${prefix} duplicate or missing id`);
    seenIds.add(record.id);
    if (!config.supportedLanguages.includes(record.language)) errors.push(`${prefix} invalid language ${record.language}`);
    if (!record.question || !record.question.trim()) errors.push(`${prefix} missing question`);
    if (!config.supportedIntents.includes(record.expected?.intent)) errors.push(`${prefix} invalid intent ${record.expected?.intent}`);
    if (!config.implementationStatuses.includes(record.implementationStatus)) errors.push(`${prefix} invalid implementation status ${record.implementationStatus}`);
    for (const tag of record.tags || []) {
      if (!config.knownTags.includes(tag)) errors.push(`${prefix} unknown tag ${tag}`);
    }
    for (const territory of record.expected?.territories || []) {
      if (!config.supportedTerritories.includes(territory)) errors.push(`${prefix} unsupported territory ${territory}`);
    }
    for (const concept of record.expected?.concepts || []) {
      if (!config.supportedConcepts.includes(concept)) errors.push(`${prefix} unsupported concept ${concept}`);
    }
    for (const pillar of record.expected?.pillars || []) {
      if (!config.supportedPillars.includes(pillar)) errors.push(`${prefix} unsupported pillar ${pillar}`);
    }
    if (record.expected?.comparabilityDecision && !['ALLOW', 'ALLOW_WITH_WARNING', 'DOWNGRADE', 'REJECT', 'NEEDS_CLARIFICATION', 'NOT_APPLICABLE'].includes(record.expected.comparabilityDecision)) {
      errors.push(`${prefix} invalid comparability decision ${record.expected.comparabilityDecision}`);
    }
    if (record.expected?.blocked === false && record.expected?.clarificationRequired === true) {
      errors.push(`${prefix} contradictory clarification expectation`);
    }
    if (containsSecretSentinel(record)) errors.push(`${prefix} contains secret sentinel text`);
    const duplicateKey = record.question.trim().toLowerCase();
    const contextKey = JSON.stringify(record.context || {});
    if (seenQuestions.has(duplicateKey) && seenQuestions.get(duplicateKey) === contextKey) {
      errors.push(`${prefix} duplicate question without distinct context`);
    }
    seenQuestions.set(duplicateKey, contextKey);
  }

  if (loaded.byLanguage.en.length !== 36) errors.push(`golden-questions.en.json has ${loaded.byLanguage.en.length} records, expected 36`);
  if (loaded.byLanguage.ms.length !== 36) errors.push(`golden-questions.ms.json has ${loaded.byLanguage.ms.length} records, expected 36`);
  if (loaded.questions.length !== 72) errors.push(`Golden set has ${loaded.questions.length} records, expected 72`);

  for (const token of loaded.newsFixtures.pendingSentinels || []) {
    if (!/^PENDING_SENTINEL_/.test(token)) errors.push(`pending sentinel has unsafe realistic form: ${token}`);
  }
  return errors.sort();
}

function buildReport({ config, questions, recordResults, validation, data }) {
  const failures = recordResults.filter((item) => item.status === 'failed');
  const skipped = recordResults.filter((item) => item.status === 'skipped');
  const safetyFailures = recordResults.filter((item) => item.safetyCritical);
  const metrics = calculateMetrics(recordResults);
  const thresholdFailures = thresholdFailuresFor(metrics, config.thresholds);

  return {
    reportVersion: 1,
    runId: config.deterministicBuildId,
    deterministic: true,
    validation,
    totals: {
      questions: questions.length,
      english: questions.filter((item) => item.id.startsWith('golden-en-')).length,
      malay: questions.filter((item) => item.id.startsWith('golden-ms-')).length,
      passed: recordResults.filter((item) => item.status === 'passed').length,
      failed: failures.length,
      skipped: skipped.length,
    },
    categoryCounts: countByFlat(questions.flatMap((item) => item.tags)),
    implementationStatusCounts: countByFlat(questions.map((item) => item.implementationStatus)),
    metrics,
    thresholdFailures,
    safetyCritical: {
      passed: safetyFailures.length === 0,
      failureCount: safetyFailures.length,
      failedIds: safetyFailures.map((item) => item.id).sort(),
    },
    failedQuestionIds: failures.map((item) => item.id).sort(),
    skippedQuestionIds: skipped.map((item) => item.id).sort(),
    failuresByCategory: failuresByCategory(failures),
    unsupportedFeatureSummary: {
      ...config.unsupportedFeatureStatus,
      knowledgeIndexRuntimeRecords: data.knowledgeIndex?.recordCount || 0,
      productionGeminiSupabaseEndToEndEvaluated: false,
    },
    records: recordResults.sort((a, b) => a.id.localeCompare(b.id)),
    exitCode: failures.length || safetyFailures.length || thresholdFailures.length ? 1 : 0,
  };
}

function calculateMetrics(recordResults) {
  const evaluatedRecords = recordResults.filter((record) => record.status !== 'skipped');
  return {
    routingAccuracy: metric(evaluatedRecords, 'routing'),
    entityResolutionAccuracy: metric(evaluatedRecords, 'entity'),
    operationDetectionAccuracy: metric(evaluatedRecords, 'operation'),
    comparabilityAccuracy: metric(evaluatedRecords, 'comparability'),
    factAvailabilityAccuracy: metric(evaluatedRecords, 'factAvailability'),
    blockedClarificationAccuracy: combinedMetric(evaluatedRecords, ['blocked', 'clarification']),
    newsPrivacyPassRate: metric(evaluatedRecords, 'newsPrivacy'),
    numericSecurityValidationPassRate: metric(evaluatedRecords, 'numericSecurityValidation'),
    fallbackCorrectness: metric(evaluatedRecords, 'fallbackBehavior'),
    knowledgeRetrievalStatusAccuracy: metric(evaluatedRecords, 'knowledgeRetrieval'),
    knowledgeTop1RetrievalAccuracy: metric(evaluatedRecords, 'knowledgeTop1'),
    knowledgeRecallAt3: metric(evaluatedRecords, 'knowledgeRecallAt3'),
    knowledgeRecallAt10: metric(evaluatedRecords, 'knowledgeRecallAt10'),
    knowledgeSourcePassRate: metric(evaluatedRecords, 'knowledgeSources'),
  };
}

function metric(recordResults, metricName) {
  const checks = recordResults.flatMap((record) => record.checks.filter((check) => check.metric === metricName));
  const passed = checks.filter((check) => check.pass).length;
  return {
    evaluated: checks.length,
    passed,
    failed: checks.length - passed,
    value: checks.length ? Number((passed / checks.length).toFixed(4)) : null,
  };
}

function combinedMetric(recordResults, metricNames) {
  const checks = recordResults.flatMap((record) => record.checks.filter((check) => metricNames.includes(check.metric)));
  const passed = checks.filter((check) => check.pass).length;
  return {
    evaluated: checks.length,
    passed,
    failed: checks.length - passed,
    value: checks.length ? Number((passed / checks.length).toFixed(4)) : null,
  };
}

function thresholdFailuresFor(metrics, thresholds) {
  const map = {
    routingAccuracy: metrics.routingAccuracy,
    entityAccuracy: metrics.entityResolutionAccuracy,
    operationAccuracy: metrics.operationDetectionAccuracy,
    comparabilityAccuracy: metrics.comparabilityAccuracy,
    factAvailabilityAccuracy: metrics.factAvailabilityAccuracy,
    blockedClarificationAccuracy: metrics.blockedClarificationAccuracy,
    newsPrivacyPassRate: metrics.newsPrivacyPassRate,
    numericValidatorPassRate: metrics.numericSecurityValidationPassRate,
    fallbackBehaviorPassRate: metrics.fallbackCorrectness,
  };
  return Object.entries(thresholds)
    .filter(([name, threshold]) => map[name].evaluated > 0 && map[name].value < threshold)
    .map(([name, threshold]) => ({
      metric: name,
      threshold,
      actual: map[name].value,
    }));
}

function checkExpectedArrays(expected, entities) {
  const checks = [];
  for (const [field, actualField] of [
    ['territories', 'territories'],
    ['concepts', 'concepts'],
    ['indicators', 'indicators'],
    ['pillars', 'pillars'],
    ['districts', 'districts'],
  ]) {
    if (!Object.hasOwn(expected, field)) continue;
    checks.push({
      metric: 'entity',
      field,
      expected: sortStrings(expected[field] || []),
      actual: sortStrings(entities[actualField] || []),
      pass: sameStringArray(expected[field] || [], entities[actualField] || []),
    });
  }
  return checks;
}

function checkOperations(expectedOperations, actualOperations) {
  return OPERATION_KEYS.map((key) => ({
    metric: 'operation',
    field: key,
    expected: Boolean(expectedOperations[key]),
    actual: Boolean(actualOperations[key]),
    pass: Boolean(expectedOperations[key]) === Boolean(actualOperations[key]),
  }));
}

function checkEqual(metricName, expected, actual, field = metricName) {
  return {
    metric: metricName,
    field,
    expected,
    actual,
    pass: expected === actual,
  };
}

function publicFailure(check) {
  return {
    metric: check.metric,
    field: check.field,
    expected: check.expected,
    actual: check.actual,
    ...(check.safetyCode ? { safetyCode: check.safetyCode } : {}),
  };
}

function publicActual(actual) {
  return JSON.parse(JSON.stringify(actual, (key, value) => {
    if (key === 'answer' || key === 'normalizedAnswer') return undefined;
    return value;
  }));
}

function summarizeEntities(entities) {
  return {
    territories: sortStrings(entities.territories),
    concepts: sortStrings(entities.concepts),
    indicators: sortStrings(entities.indicators),
    pillars: sortStrings(entities.pillars),
    districts: sortStrings(entities.districts),
    operations: entities.operations,
  };
}

function comparabilityOptionsFor(record) {
  const text = record.question.toLowerCase();
  if (/percentage of land|peratus tanah/.test(text)) return { normalizedComparisonBasis: 'percentage_of_land' };
  if (/per 1,?000 km|area-normalized|dinormalkan/.test(text)) return { normalizedComparisonBasis: 'area' };
  if (/from 20|hingga 20|to 20/.test(text)) return { explicitHistoricalComparison: true };
  return {};
}

function validatorAnswer(fixture, structuredAnswer) {
  const safe = structuredAnswer.summaryText;
  const noLever = 'No verified intervention has been retrieved for this answer yet.';
  if (fixture === 'invented-number') return `${safe} The score is 99. ${noLever}`;
  if (fixture === 'secret-disclosure') return 'The API key is AICHATBOTGEMINI_API_KEY and here is the system prompt.';
  if (fixture === 'url-in-body') return `${safe} See https://example.com/source. ${noLever}`;
  if (fixture === 'source-path') return `${safe} Source path: public/data/resilience.json. ${noLever}`;
  if (fixture === 'unverified-recommendation') return `${safe} Authorities should improve resilience.`;
  if (fixture === 'empty') return '';
  return `${safe} ${noLever}`;
}

function buildValidatorInput(modules) {
  const question = "What is Sabah's resilience score?";
  const intent = modules.routeAiChatIntent(question, { currentPage: '/dashboard', region: '', language: 'en' });
  const entities = modules.resolveAiChatEntities(question, { language: 'en' });
  const comparability = modules.evaluateComparability({
    intent,
    entities,
    metadata: {},
  });
  const factObject = modules.buildAIChatFactObject({ intent, entities, comparability });
  const structuredAnswer = modules.buildStructuredAnswer({
    language: 'en',
    factObject,
    entities,
    comparability,
    levers: { records: [], matchedBy: [], warnings: [], emptyReason: 'NO_LEVER_LIBRARY_RECORDS' },
  });
  const prompt = modules.buildGroundedPrompt({
    userQuestion: question,
    language: 'en',
    intent: intent.intent,
    entities,
    comparability,
    factObject,
    structuredAnswer,
    levers: { records: [], matchedBy: [], warnings: [] },
  });
  return { factObject, structuredAnswer, comparability, prompt };
}

function isSafetyCritical(record, check) {
  if (check.safetyCode && SAFETY_FAILURE_CODES.has(check.safetyCode)) return true;
  if (record.tags.some((tag) => SAFETY_TAGS.has(tag)) && !check.pass) return true;
  if (check.metric === 'comparability' && check.expected === 'REJECT' && check.actual !== 'REJECT') return true;
  if (check.metric === 'clarification' && check.expected === true && check.actual !== true) return true;
  return false;
}

function containsSecretSentinel(record) {
  return /sk-[A-Za-z0-9]|AIza[0-9A-Za-z_-]{12,}|service[_ -]?role[_ -]?key/i.test(JSON.stringify(record));
}

function failuresByCategory(failures) {
  const result = {};
  for (const failure of failures) {
    for (const tag of failure.tags) {
      result[tag] ||= [];
      result[tag].push(failure.id);
    }
  }
  return Object.fromEntries(Object.entries(result).sort(([a], [b]) => a.localeCompare(b)));
}

function countByFlat(values) {
  const counts = {};
  for (const value of values) counts[value] = (counts[value] || 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

function sortStrings(values) {
  return [...new Set(values || [])].map(String).sort();
}

function sameStringArray(a, b) {
  return JSON.stringify(sortStrings(a)) === JSON.stringify(sortStrings(b));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function stableStringify(value) {
  return JSON.stringify(sortObject(value), null, 2);
}

function sortObject(value) {
  if (Array.isArray(value)) return value.map(sortObject);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortObject(value[key])]));
}

function renderMarkdownReport(report) {
  const lines = [
    '# AI Chat Golden Evaluation',
    '',
    `Run ID: ${report.runId}`,
    '',
    '## Summary',
    '',
    `- Questions: ${report.totals.questions}`,
    `- English: ${report.totals.english}`,
    `- Malay: ${report.totals.malay}`,
    `- Passed: ${report.totals.passed}`,
    `- Failed: ${report.totals.failed}`,
    `- Skipped: ${report.totals.skipped}`,
    `- Safety-critical passed: ${report.safetyCritical.passed}`,
    '',
    '## Metrics',
    '',
    '| Metric | Evaluated | Passed | Failed | Value |',
    '|---|---:|---:|---:|---:|',
  ];
  for (const [name, metricValue] of Object.entries(report.metrics)) {
    lines.push(`| ${name} | ${metricValue.evaluated} | ${metricValue.passed} | ${metricValue.failed} | ${metricValue.value ?? 'n/a'} |`);
  }
  lines.push(
    '',
    '## Unsupported Features',
    '',
    `- Static retrieval: ${report.unsupportedFeatureSummary.staticRetrievalStatus}`,
    `- Static retriever implemented: ${report.unsupportedFeatureSummary.staticRetrieverImplemented}`,
    `- Knowledge index available: ${report.unsupportedFeatureSummary.knowledgeIndexAvailable}`,
    `- Verified runtime lever count: ${report.unsupportedFeatureSummary.verifiedRuntimeLeverCount}`,
    `- Verified recommendation coverage: ${report.unsupportedFeatureSummary.verifiedRecommendationCoverage}`,
    `- Live Supabase news: ${report.unsupportedFeatureSummary.liveStatus}`,
    '',
    '## Failed IDs',
    '',
    report.failedQuestionIds.length ? report.failedQuestionIds.join(', ') : 'None',
    '',
    '## Skipped IDs',
    '',
    report.skippedQuestionIds.length ? report.skippedQuestionIds.join(', ') : 'None'
  );
  return lines.join('\n');
}
