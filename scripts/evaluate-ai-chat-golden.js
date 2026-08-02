import { createServer } from 'vite';
import { GoldenEvaluator, GoldenValidationError } from './ai-chat/GoldenEvaluator.js';

const validateOnly = process.argv.includes('--validate-only');

const server = await createServer({
  configFile: false,
  root: process.cwd(),
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
  logLevel: 'silent',
});

try {
  const modules = await loadModules(server);
  const data = await loadData(server);
  const evaluator = new GoldenEvaluator({ modules, data });
  if (validateOnly) {
    const validation = evaluator.validateGoldenFiles();
    if (!validation.valid) {
      for (const error of validation.errors) console.error(error);
      process.exitCode = 1;
    } else {
      console.log(`Golden validation passed: ${validation.questionCount} questions (${validation.englishCount} en, ${validation.malayCount} ms).`);
    }
  } else {
    const report = await evaluator.evaluateAndWrite();
    console.log(`Golden evaluation complete: ${report.totals.passed} passed, ${report.totals.failed} failed, ${report.totals.skipped} skipped.`);
    process.exitCode = report.exitCode;
  }
} catch (error) {
  if (error instanceof GoldenValidationError) {
    for (const item of error.errors) console.error(item);
  } else {
    console.error(error instanceof Error ? error.message : String(error));
  }
  process.exitCode = 1;
} finally {
  await server.close();
}

async function loadModules(viteServer) {
  const [
    intentRouter,
    entityResolver,
    comparabilityGate,
    factObjectBuilder,
    structuredAnswerBuilder,
    templateFallback,
    promptBuilder,
    responseValidator,
    knowledgeRepository,
    knowledgeRetriever,
    knowledgeAnswerBuilder,
    leverRetriever,
    newsRetriever,
    localNewsRepository,
  ] = await Promise.all([
    viteServer.ssrLoadModule('/supabase/functions/ai-chat/intentRouter.ts'),
    viteServer.ssrLoadModule('/supabase/functions/ai-chat/entityResolver.ts'),
    viteServer.ssrLoadModule('/supabase/functions/ai-chat/comparabilityGate.ts'),
    viteServer.ssrLoadModule('/supabase/functions/ai-chat/factObjectBuilder.ts'),
    viteServer.ssrLoadModule('/supabase/functions/ai-chat/structuredAnswerBuilder.ts'),
    viteServer.ssrLoadModule('/supabase/functions/ai-chat/templateFallback.ts'),
    viteServer.ssrLoadModule('/supabase/functions/ai-chat/promptBuilder.ts'),
    viteServer.ssrLoadModule('/supabase/functions/ai-chat/responseValidator.ts'),
    viteServer.ssrLoadModule('/supabase/functions/ai-chat/knowledgeRepository.ts'),
    viteServer.ssrLoadModule('/supabase/functions/ai-chat/knowledgeRetriever.ts'),
    viteServer.ssrLoadModule('/supabase/functions/ai-chat/knowledgeAnswerBuilder.ts'),
    viteServer.ssrLoadModule('/supabase/functions/ai-chat/leverRetriever.ts'),
    viteServer.ssrLoadModule('/supabase/functions/ai-chat/newsRetriever.ts'),
    viteServer.ssrLoadModule('/supabase/functions/ai-chat/localNewsRepository.ts'),
  ]);
  return {
    ...intentRouter,
    ...entityResolver,
    ...comparabilityGate,
    ...factObjectBuilder,
    ...structuredAnswerBuilder,
    ...templateFallback,
    ...promptBuilder,
    ...responseValidator,
    ...leverRetriever,
    ...newsRetriever,
    ...localNewsRepository,
    KnowledgeRepository: knowledgeRepository.KnowledgeRepository,
    retrieveStaticKnowledge: knowledgeRetriever.retrieveStaticKnowledge,
    buildKnowledgeAnswer: knowledgeAnswerBuilder.buildKnowledgeAnswer,
  };
}

async function loadData(viteServer) {
  const [indicators, resilience, districts, knowledgeIndex] = await Promise.all([
    viteServer.ssrLoadModule('/public/data/indicators.json'),
    viteServer.ssrLoadModule('/public/data/resilience.json'),
    viteServer.ssrLoadModule('/public/data/districts.json'),
    viteServer.ssrLoadModule('/knowledge/generated/knowledge-index.json'),
  ]);
  return {
    indicators: indicators.default,
    resilience: resilience.default,
    districts: districts.default,
    knowledgeIndex: knowledgeIndex.default,
  };
}
