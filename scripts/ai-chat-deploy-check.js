import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const checks = [];

function file(rel) {
  return path.join(root, rel);
}

function read(rel) {
  return fs.readFileSync(file(rel), 'utf8');
}

function exists(rel) {
  return fs.existsSync(file(rel));
}

function check(name, condition, detail = '') {
  checks.push({ name, ok: Boolean(condition), detail });
}

function contains(rel, pattern) {
  if (!exists(rel)) return false;
  const text = read(rel);
  return typeof pattern === 'string' ? text.includes(pattern) : pattern.test(text);
}

function walkFiles(dir, predicate, output = []) {
  if (!fs.existsSync(dir)) return output;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, predicate, output);
    } else if (predicate(full)) {
      output.push(full);
    }
  }
  return output;
}

const requiredFiles = [
  'supabase/config.toml',
  'supabase/auth_schema.sql',
  'supabase/schema.sql',
  'supabase/migrations/20260804000100_ai_chat_infrastructure_contracts.sql',
  'supabase/functions/ai-chat/index.ts',
  'supabase/functions/ai-chat/config.ts',
  'supabase/functions/ai-chat/identity.ts',
  'supabase/functions/ai-chat/quota.ts',
  'supabase/functions/ai-chat/telemetry.ts',
  'supabase/functions/ai-chat/supabaseNewsRepository.ts',
  'docs/ai-chat-production-deployment.md',
  '.env.example',
];

for (const rel of requiredFiles) {
  check(`required file exists: ${rel}`, exists(rel));
}

check(
  'ai-chat function keeps Supabase CLI JWT verification disabled',
  contains('supabase/config.toml', /\[functions\.ai-chat\][\s\S]*verify_jwt\s*=\s*false/)
);

const migration = exists('supabase/migrations/20260804000100_ai_chat_infrastructure_contracts.sql')
  ? read('supabase/migrations/20260804000100_ai_chat_infrastructure_contracts.sql')
  : '';

for (const objectName of [
  'public.ai_chat_config',
  'public.ai_chat_daily_usage',
  'public.ai_chat_events',
  'public.reserve_ai_chat_quota',
  'public.refund_ai_chat_quota',
]) {
  check(`Stage 8B migration contains ${objectName}`, migration.includes(objectName));
}

check('Stage 8B migration grants quota RPC only to service_role', /grant execute on function public\.reserve_ai_chat_quota\(date, text, text, integer\) to service_role/i.test(migration));
check('Stage 8B migration uses current_user_role admin policies', /current_user_role\(\) = 'admin'/i.test(migration));
check('Stage 8B migration does not modify news_items', !/alter\s+table\s+public\.news_items|create\s+table\s+(?:if\s+not\s+exists\s+)?public\.news_items/i.test(migration));

const envExample = exists('.env.example') ? read('.env.example') : '';
const expectedEnvNames = [
  'AICHATBOTGEMINI_API_KEY',
  'GEMINI_MODEL',
  'AI_CHAT_TIMEOUT_MS',
  'AI_CHAT_CORS_ORIGINS',
  'AI_CHAT_NEWS_REPOSITORY',
  'AI_CHAT_DAILY_LIMITS_JSON',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_SERVICE_KEY',
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_AI_CHAT_ENDPOINT',
  'VITE_AI_CHAT_TIMEOUT_MS',
];

for (const name of expectedEnvNames) {
  check(`.env.example documents ${name}`, new RegExp(`^#?\\s*${name}=`, 'm').test(envExample) || envExample.includes(name));
}

check('no service credentials are exposed as VITE variables', !/^VITE_.*(?:SERVICE|SECRET|GEMINI|AICHATBOT).*=/im.test(envExample));
check('production news repository setting is documented', contains('docs/ai-chat-production-deployment.md', 'AI_CHAT_NEWS_REPOSITORY=live'));
check('commands are marked NOT YET EXECUTED', contains('docs/ai-chat-production-deployment.md', 'NOT YET EXECUTED'));
check('deployment doc preserves anonymous quota limitation', contains('docs/ai-chat-production-deployment.md', /anonymous durable quota remains deferred/i));

const configTs = exists('supabase/functions/ai-chat/config.ts') ? read('supabase/functions/ai-chat/config.ts') : '';
check('Gemini default remains gemini-3.6-flash', configTs.includes("DEFAULT_GEMINI_MODEL = 'gemini-3.6-flash'"));
check('Gemini key precedence accepts chatbot key before fallback key', /envValue\(env,\s*'AICHATBOTGEMINI_API_KEY'\)\s*\|\|\s*envValue\(env,\s*'GEMINI_API_KEY'\)/.test(configTs));

const newsFactory = exists('supabase/functions/ai-chat/newsRepositoryFactory.ts') ? read('supabase/functions/ai-chat/newsRepositoryFactory.ts') : '';
check('live news repository mode selects Supabase adapter', /raw === 'supabase' \|\| raw === 'live'/.test(newsFactory));

const runtimeTsFiles = walkFiles(file('supabase/functions/ai-chat'), (full) => full.endsWith('.ts') && !full.endsWith('.test.js'));
const jsonImportsWithoutAttributes = runtimeTsFiles
  .map((full) => ({
    rel: path.relative(root, full).replaceAll(path.sep, '/'),
    matches: fs.readFileSync(full, 'utf8').match(/import\s+[^;\n]+?\.json['"][^;\n]*;?/g) || [],
  }))
  .filter((item) => item.matches.some((statement) => !/with\s+\{\s*type:\s*['"]json['"]\s*\}/.test(statement)));
check(
  'runtime JSON imports use import attributes for Supabase bundling',
  jsonImportsWithoutAttributes.length === 0,
  jsonImportsWithoutAttributes.map((item) => item.rel).join(', ')
);

const failed = checks.filter((item) => !item.ok);
for (const item of checks) {
  console.log(`${item.ok ? 'ok' : 'not ok'} - ${item.name}${item.detail ? ` (${item.detail})` : ''}`);
}

if (failed.length) {
  console.error(`\nAI chat deployment preflight failed: ${failed.length} issue(s).`);
  process.exitCode = 1;
} else {
  console.log('\nAI chat deployment preflight passed. Offline repository checks only; no live Supabase or Gemini calls were made.');
}
