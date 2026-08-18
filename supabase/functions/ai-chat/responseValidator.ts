import type {
  AIChatResponseValidationInput,
  AIChatResponseValidationResult,
  AIChatSimulationResponseValidationInput,
  AIChatSiteKnowledgeResponseValidationInput,
  ComparabilityResult,
  ResponseValidationFailureCode,
  ResponseValidationIssue,
} from './contracts.ts';

export const DEFAULT_MAX_GEMINI_ANSWER_LENGTH = 1200;

const CONTROL_CHARACTER_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const URL_PATTERN = /\bhttps?:\/\/[^\s<>)]+|\bwww\.[^\s<>)]+|\[[^\]]+\]\([^)]+\)|\b[a-z0-9.-]+\.(?:com|org|net|gov|edu|my|bn|id|io|ai|co|info|json|csv|ts|js)(?:\/[^\s]*)?|(?:https?%3A%2F%2F|www%2E)/i;
const SOURCE_PATH_PATTERN = /\b(?:public|src|supabase|knowledge|docs|data)\/[^\s]+|\bsourceFile\b|\bsourcePath\b/i;
const NUMERIC_TOKEN_PATTERN = /(^|[^\w])([+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?%?)(?![\w])/g;
const YEAR_RANGE_PATTERN = /\b(19\d{2}|20\d{2})\s*(?:-|\u2013|\u2014|to|hingga|sampai)\s*(19\d{2}|20\d{2})\b/i;
const SERIALIZATION_PATTERN = /^\s*(?:\{[\s\S]*\}|\[[\s\S]*\])\s*$/;

const RECOMMENDATION_PATTERNS = [
  /\bshould\b/i,
  /\brecommend(?:ed|ation|s)?\b/i,
  /\bmust improve\b/i,
  /\bauthorities should\b/i,
  /\bgovernment should\b/i,
  /\binvest in\b/i,
  /\bimplement\b/i,
  /\bpolicy action\b/i,
  /\bperlu\b/i,
  /\bdisyorkan\b/i,
  /\bkerajaan harus\b/i,
  /\bpihak berkuasa perlu\b/i,
  /\bmelaksanakan\b/i,
  /\bmeningkatkan\b/i,
  /\bmelabur dalam\b/i,
  /\btindakan dasar\b/i,
];

const DETERMINISTIC_LEVER_UNAVAILABLE = [
  /no verified intervention has been retrieved/i,
  /tiada intervensi yang telah disahkan diperoleh/i,
];

const GUARANTEED_OUTCOME_PATTERN = /\b(?:will|guarantees?|guaranteed|ensures?|certain to|always)\b.{0,80}\b(?:improve|increase|reduce|raise|lower|restore|solve|fix)\b/i;
const ACTOR_PATTERN = /\b(?:government|authorities|local authority|community|private sector|business|civil society|research institution|kerajaan|pihak berkuasa|komuniti|sektor swasta)\b/ig;
const ACTOR_ALIASES: Record<string, string[]> = {
  government: ['government', 'kerajaan'],
  local_authority: ['local authority', 'authorities', 'pihak berkuasa'],
  community: ['community', 'komuniti'],
  private_sector: ['private sector', 'business', 'sektor swasta'],
  civil_society: ['civil society'],
  research_institution: ['research institution'],
  multiple: ['government', 'authorities', 'local authority', 'community', 'private sector', 'business', 'civil society', 'research institution', 'kerajaan', 'pihak berkuasa', 'komuniti', 'sektor swasta'],
  unspecified: [],
};

const SECRET_PATTERNS = [
  /\bapi key\b/i,
  /\bAICHATBOTGEMINI_API_KEY\b/,
  /\bGEMINI_API_KEY\b/,
  /\benvironment variables?\b/i,
  /\bauthorization headers?\b/i,
  /\bx-goog-api-key\b/i,
  /\bsupabase service role\b/i,
  /\bservice[_ -]?role[_ -]?key\b/i,
  /\b[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\b/,
  /\bAIza[0-9A-Za-z_-]{12,}\b/,
];

const SYSTEM_DISCLOSURE_PATTERNS = [
  /\bsystem prompt\b/i,
  /\bsystem instructions?\b/i,
  /\bhidden instructions?\b/i,
  /\bdeveloper message\b/i,
  /\binternal policy\b/i,
  /\bchain of thought\b/i,
  /\braw grounding payload\b/i,
];

const INTERNAL_METADATA_PATTERNS = [
  /\bAIChatFactObject\b/,
  /\bComparabilityResult\b/,
  /\bapprovedNumericTokens\b/,
  /\bapprovedYearTokens\b/,
  /\buntrustedUserQuestion\b/,
  /\bverifiedAnswerContent\b/,
  /\bFact Object JSON\b/i,
  /\btoken allow lists?\b/i,
  /\bJSON pointer\b/i,
  /\bJSON path\b/i,
  /\benvironment configuration\b/i,
  /\bstack trace\b/i,
  /\b(?:Error|TypeError|ReferenceError):[\s\S]+\bat\s+\w+/,
];

const SOURCE_CLAIM_PATTERNS = [
  /\baccording to\s+([^.,;:]+)/ig,
  /\bsource:\s*([^.,;]+)/ig,
  /\bsources?:\s*([^.,;]+)/ig,
  /\breport titled\s+(?:"|\u201c)?([^"\u201d.,;]+)/ig,
  /\bpublished by\s+([^.,;]+)/ig,
];

const UNSUPPORTED_CITATION_PATTERN = /\[(?:\d+|[A-Z][^\]]+,\s*(?:19|20)\d{2})\]|\((?:19|20)\d{2}\)|\bdoi:/i;

export function validateGeminiResponse(input: AIChatResponseValidationInput): AIChatResponseValidationResult {
  const issues: ResponseValidationIssue[] = [];
  const answer = normalizeAnswer(input.answer, issues, input.maxAnswerLength ?? DEFAULT_MAX_GEMINI_ANSWER_LENGTH);
  const detectedUrls = typeof answer === 'string' ? extractUrls(answer) : [];
  const numericTokens = typeof answer === 'string' ? extractNumericTokens(answer) : [];
  const detectedYearTokens = dedupe(numericTokens.filter(isYearToken));
  const detectedNumericTokens = dedupe(numericTokens.filter((token) => !isYearToken(token)));

  if (typeof answer === 'string') {
    if (detectedUrls.length || URL_PATTERN.test(answer) || SOURCE_PATH_PATTERN.test(answer)) {
      addIssue(issues, 'URL_IN_BODY', 'Answer contains URL, link, bare domain, or source-path-like content.', detectedUrls[0]);
    }
    validateNumericTokens(input, detectedNumericTokens, issues);
    validateYearTokens(input, answer, detectedYearTokens, issues);
    validateSources(input, answer, issues);
    validateComparability(input.comparability, answer, input.structuredAnswer.requiredDisclosures, issues);
    validateRecommendation(input, answer, issues);
    validateSecurity(answer, issues);
    validateRequiredDisclosures(input, answer, issues);
  }

  return {
    valid: issues.length === 0,
    issues,
    detectedNumericTokens,
    detectedYearTokens,
    detectedUrls,
    ...(issues.length === 0 && typeof answer === 'string' ? { normalizedAnswer: answer } : {}),
  };
}

export function validateSiteKnowledgeGeminiResponse(
  input: AIChatSiteKnowledgeResponseValidationInput
): AIChatResponseValidationResult {
  const issues: ResponseValidationIssue[] = [];
  const answer = normalizeAnswer(input.answer, issues, input.maxAnswerLength ?? DEFAULT_MAX_GEMINI_ANSWER_LENGTH);
  const detectedUrls = typeof answer === 'string' ? extractUrls(answer) : [];
  const numericTokens = typeof answer === 'string' ? extractNumericTokens(answer) : [];
  const detectedYearTokens = dedupe(numericTokens.filter(isYearToken));
  const detectedNumericTokens = dedupe(numericTokens.filter((token) => !isYearToken(token)));

  if (typeof answer === 'string') {
    if (detectedUrls.length || URL_PATTERN.test(answer) || SOURCE_PATH_PATTERN.test(answer)) {
      addIssue(issues, 'URL_IN_BODY', 'Answer contains URL, link, bare domain, or source-path-like content.', detectedUrls[0]);
    }
    validateKnowledgeNumbers(input, detectedNumericTokens, issues);
    validateKnowledgeYears(input, answer, detectedYearTokens, issues);
    validateKnowledgeSources(input, answer, issues);
    validateKnowledgeRecommendation(answer, issues);
    validateKnowledgeDashboardInjection(answer, issues);
    validateSecurity(answer, issues);
  }

  return {
    valid: issues.length === 0,
    issues,
    detectedNumericTokens,
    detectedYearTokens,
    detectedUrls,
    ...(issues.length === 0 && typeof answer === 'string' ? { normalizedAnswer: answer } : {}),
  };
}

const SIMULATION_ILLUSTRATIVE_TEXT = [
  'Illustrative — deterministic scenario, not a forecast.',
  'Ilustrasi — senario deterministik, bukan ramalan.',
];
const SIMULATION_ILLUSTRATIVE_KEYWORDS = ['illustrative', 'not a forecast', 'ilustrasi', 'bukan ramalan'];
const FORECAST_LANGUAGE_PATTERN = /\b(?:predict(?:s|ed|ion|ions)?|forecast(?:s|ed|ing)?|guarantee(?:s|d)?|will\s+(?:definitely|certainly))\b/i;

export function validateSimulationGeminiResponse(
  input: AIChatSimulationResponseValidationInput
): AIChatResponseValidationResult {
  const issues: ResponseValidationIssue[] = [];
  const answer = normalizeAnswer(input.answer, issues, input.maxAnswerLength ?? DEFAULT_MAX_GEMINI_ANSWER_LENGTH);
  const detectedUrls = typeof answer === 'string' ? extractUrls(answer) : [];
  const numericTokens = typeof answer === 'string' ? extractNumericTokens(answer) : [];
  const detectedYearTokens = dedupe(numericTokens.filter(isYearToken));
  const detectedNumericTokens = dedupe(numericTokens.filter((token) => !isYearToken(token)));

  if (typeof answer === 'string') {
    if (detectedUrls.length || URL_PATTERN.test(answer) || SOURCE_PATH_PATTERN.test(answer)) {
      addIssue(issues, 'URL_IN_BODY', 'Answer contains URL, link, bare domain, or source-path-like content.', detectedUrls[0]);
    }
    validateSimulationNumbers(input, detectedNumericTokens, issues);
    validateSimulationYears(input, detectedYearTokens, issues);
    validateSimulationRecommendation(answer, issues);
    validateSimulationForecastLanguage(answer, issues);
    validateSimulationIllustrativeFraming(input, answer, issues);
    validateSecurity(answer, issues);
  }

  return {
    valid: issues.length === 0,
    issues,
    detectedNumericTokens,
    detectedYearTokens,
    detectedUrls,
    ...(issues.length === 0 && typeof answer === 'string' ? { normalizedAnswer: answer } : {}),
  };
}

function validateSimulationNumbers(
  input: AIChatSimulationResponseValidationInput,
  detectedNumericTokens: string[],
  issues: ResponseValidationIssue[]
): void {
  const approved = new Set([
    ...input.simulationAnswer.approvedNumericTokens,
    ...input.prompt.groundingPayload.approvedNumericTokens,
  ].flatMap((token) => [token, normalizeNumericToken(token)]));
  for (const token of detectedNumericTokens) {
    if (!approved.has(token) && !approved.has(normalizeNumericToken(token))) {
      addIssue(issues, 'UNAPPROVED_NUMBER', 'Answer contains a numeric token that was not approved.', token);
    }
  }
}

function validateSimulationYears(
  input: AIChatSimulationResponseValidationInput,
  detectedYearTokens: string[],
  issues: ResponseValidationIssue[]
): void {
  const approved = new Set([
    ...input.simulationAnswer.approvedYearTokens,
    ...input.prompt.groundingPayload.approvedYearTokens,
  ]);
  for (const token of detectedYearTokens) {
    if (!approved.has(token)) addIssue(issues, 'UNAPPROVED_YEAR', 'Answer contains a year that was not approved.', token);
  }
}

function validateSimulationRecommendation(answer: string, issues: ResponseValidationIssue[]): void {
  if (RECOMMENDATION_PATTERNS.some((pattern) => pattern.test(answer))) {
    addIssue(issues, 'UNVERIFIED_RECOMMENDATION', 'Simulation answer contains recommendation language; simulations narrate scenarios, they do not prescribe actions.');
  }
}

function validateSimulationForecastLanguage(answer: string, issues: ResponseValidationIssue[]): void {
  // Strip the required disclaimer text first — it legitimately contains the
  // word "forecast" ("...not a forecast."), which must not itself trip this check.
  const withoutDisclaimer = SIMULATION_ILLUSTRATIVE_TEXT.reduce((text, phrase) => text.split(phrase).join(''), answer);
  if (GUARANTEED_OUTCOME_PATTERN.test(withoutDisclaimer) || FORECAST_LANGUAGE_PATTERN.test(withoutDisclaimer)) {
    addIssue(issues, 'UNVERIFIED_FORECAST_CLAIM', 'Simulation answer presents the scenario as a forecast, prediction, or guaranteed outcome rather than an illustrative what-if.');
  }
}

function validateSimulationIllustrativeFraming(
  input: AIChatSimulationResponseValidationInput,
  answer: string,
  issues: ResponseValidationIssue[]
): void {
  if (input.simulationAnswer.status !== 'RESOLVED') return;
  const lowered = answer.toLowerCase();
  const hasFraming = SIMULATION_ILLUSTRATIVE_KEYWORDS.some((keyword) => lowered.includes(keyword));
  if (!hasFraming) {
    addIssue(issues, 'MISSING_ILLUSTRATIVE_DISCLAIMER', 'Simulation answer dropped the required "illustrative, not a forecast" framing.');
  }
}

export function extractResponseNumericTokens(text: string): string[] {
  return extractNumericTokens(text);
}

function normalizeAnswer(answer: unknown, issues: ResponseValidationIssue[], maxLength: number): string | undefined {
  if (typeof answer !== 'string') {
    addIssue(issues, 'MALFORMED_OUTPUT', 'Gemini answer must be plain text.');
    return undefined;
  }
  const normalized = answer.replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (!normalized) addIssue(issues, 'EMPTY_ANSWER', 'Gemini answer is empty.');
  if (normalized.length > maxLength) addIssue(issues, 'ANSWER_TOO_LONG', 'Gemini answer is longer than the configured maximum.');
  if (CONTROL_CHARACTER_PATTERN.test(normalized)) addIssue(issues, 'MALFORMED_OUTPUT', 'Gemini answer contains unsafe control characters.');
  if (SERIALIZATION_PATTERN.test(normalized)) addIssue(issues, 'MALFORMED_OUTPUT', 'Gemini answer looks like serialized data where plain text was required.');
  if (looksTruncated(normalized)) addIssue(issues, 'TRUNCATED_OUTPUT', 'Gemini answer appears to end mid-sentence.');
  return normalized;
}

function looksTruncated(answer: string): boolean {
  const trimmed = answer.trim();
  if (!trimmed) return false;
  if (/[.!?)]$/.test(trimmed)) return false;
  if (/[\u2026:]$/.test(trimmed)) return true;
  return /\b(?:and|or|but|because|which|that|with|for|to|from|by|in|on|as|the|a|an|dan|atau|yang|dengan|untuk|di|ke|sebagai)$/i.test(trimmed);
}

function validateNumericTokens(
  input: AIChatResponseValidationInput,
  detectedNumericTokens: string[],
  issues: ResponseValidationIssue[]
): void {
  const approved = approvedNumericForms(input);
  for (const token of detectedNumericTokens) {
    if (!approved.has(token) && !approved.has(normalizeNumericToken(token))) {
      addIssue(issues, 'UNAPPROVED_NUMBER', 'Answer contains a numeric token that was not approved.', token);
    }
  }
}

function validateYearTokens(
  input: AIChatResponseValidationInput,
  answer: string,
  detectedYearTokens: string[],
  issues: ResponseValidationIssue[]
): void {
  const approved = approvedYearForms(input);
  for (const token of detectedYearTokens) {
    if (!approved.has(token)) addIssue(issues, 'UNAPPROVED_YEAR', 'Answer contains a year that was not approved.', token);
  }
  const range = answer.match(YEAR_RANGE_PATTERN);
  if (range) {
    const token = range[0];
    const compactRange = `${range[1]}-${range[2]}`;
    if (!approved.has(token) && !approved.has(compactRange)) {
      addIssue(issues, 'UNAPPROVED_YEAR', 'Answer contains an unapproved year range form.', token);
    }
  }
}

function validateSources(input: AIChatResponseValidationInput, answer: string, issues: ResponseValidationIssue[]): void {
  if (/\baccording to Gemini\b/i.test(answer) || /\bexternal study\b/i.test(answer) || UNSUPPORTED_CITATION_PATTERN.test(answer)) {
    addIssue(issues, 'UNVERIFIED_SOURCE', 'Answer contains an unsupported source or citation claim.');
    return;
  }

  const allowed = allowedSourcePhrases(input);
  for (const pattern of SOURCE_CLAIM_PATTERNS) {
    pattern.lastIndex = 0;
    for (const match of answer.matchAll(pattern)) {
      const claim = cleanSourceClaim(match[1] || '');
      if (claim && !phraseAppearsInSet(claim, allowed)) {
        addIssue(issues, 'UNVERIFIED_SOURCE', 'Answer cites a source label that was not supplied in the grounded prompt.', claim);
      }
    }
  }
}

function validateComparability(
  comparability: ComparabilityResult,
  answer: string,
  requiredDisclosures: string[],
  issues: ResponseValidationIssue[]
): void {
  if (comparability.decision === 'REJECT') {
    addIssue(issues, 'BLOCKED_STATE_BYPASSED', 'Rejected dashboard states must bypass Gemini.');
  }
  if (comparability.decision === 'NEEDS_CLARIFICATION') {
    addIssue(issues, 'CLARIFICATION_STATE_BYPASSED', 'Clarification states must bypass Gemini.');
  }
  if (comparability.decision === 'DOWNGRADE') {
    rejectOperationClaims(answer, issues, true);
  }
  if (comparability.decision === 'ALLOW_WITH_WARNING') {
    const disclosures = [...comparability.requiredDisclosures, ...requiredDisclosures];
    if (disclosures.length && !containsAnyRequiredDisclosure(answer, disclosures)) {
      addIssue(issues, 'UNSUPPORTED_COMPARISON', 'Required comparison disclosure was not preserved.');
    }
  }
  rejectBlockedOperationClaims(answer, comparability.blockedOperations, issues);
}

function validateRecommendation(input: AIChatResponseValidationInput, answer: string, issues: ResponseValidationIssue[]): void {
  const lever = input.structuredAnswer.layers.lever;
  const leverUnavailable = !lever.leverIds.length || ['UNAVAILABLE', 'NOT_APPLICABLE'].includes(lever.status);
  if (!leverUnavailable) {
    validateAvailableLeverRecommendation(input, answer, issues);
    return;
  }
  const withoutDeterministicUnavailable = DETERMINISTIC_LEVER_UNAVAILABLE.reduce(
    (text, pattern) => text.replace(pattern, ''),
    answer
  );
  if (RECOMMENDATION_PATTERNS.some((pattern) => pattern.test(withoutDeterministicUnavailable))) {
    addIssue(issues, 'UNVERIFIED_RECOMMENDATION', 'Answer contains recommendation language without a verified lever.');
  }
}

function validateAvailableLeverRecommendation(
  input: AIChatResponseValidationInput,
  answer: string,
  issues: ResponseValidationIssue[]
): void {
  if (GUARANTEED_OUTCOME_PATTERN.test(answer)) {
    addIssue(issues, 'UNVERIFIED_RECOMMENDATION', 'Answer claims a guaranteed lever outcome.');
  }
  const promptLevers = input.prompt.groundingPayload.levers;
  if (!promptLevers.length) {
    addIssue(issues, 'UNVERIFIED_RECOMMENDATION', 'Structured answer has lever IDs but prompt contains no bounded lever.');
    return;
  }
  if (!boundedLeverTextAppears(answer, promptLevers)) {
    addIssue(issues, 'UNVERIFIED_RECOMMENDATION', 'Answer recommendation is not bounded by the verified lever content.');
  }
  const allowedActors = new Set(promptLevers.flatMap((lever) => lever.whoActs.flatMap((actor) => ACTOR_ALIASES[actor] || [])));
  const actorClaims = [...answer.matchAll(ACTOR_PATTERN)].map((match) => match[0].toLowerCase());
  for (const actor of actorClaims) {
    if (allowedActors.size && !allowedActors.has(actor)) {
      addIssue(issues, 'UNVERIFIED_RECOMMENDATION', 'Answer introduces an actor not present in the verified lever.', actor);
    }
  }
}

function boundedLeverTextAppears(answer: string, levers: AIChatResponseValidationInput['prompt']['groundingPayload']['levers']): boolean {
  const compactAnswer = compactText(answer);
  return levers.some((lever) => {
    const anchors = [lever.title, lever.summary, lever.mechanism]
      .flatMap((text) => compactText(text).split(' ').filter((token) => token.length >= 5))
      .slice(0, 10);
    return anchors.length > 0 && anchors.some((token) => compactAnswer.includes(token));
  });
}

function validateSecurity(answer: string, issues: ResponseValidationIssue[]): void {
  if (SECRET_PATTERNS.some((pattern) => pattern.test(answer))) {
    addIssue(issues, 'SECRET_DISCLOSURE', 'Answer appears to disclose or reference secrets.');
  }
  if (SYSTEM_DISCLOSURE_PATTERNS.some((pattern) => pattern.test(answer))) {
    addIssue(issues, 'SYSTEM_INSTRUCTION_DISCLOSURE', 'Answer appears to disclose system or hidden instructions.');
  }
  if (INTERNAL_METADATA_PATTERNS.some((pattern) => pattern.test(answer))) {
    addIssue(issues, 'INTERNAL_METADATA_DISCLOSURE', 'Answer appears to disclose internal metadata.');
  }
}

function validateKnowledgeNumbers(
  input: AIChatSiteKnowledgeResponseValidationInput,
  detectedNumericTokens: string[],
  issues: ResponseValidationIssue[]
): void {
  const approved = new Set([
    ...input.knowledgeAnswer.approvedNumericTokens,
    ...input.prompt.groundingPayload.approvedNumericTokens,
  ].flatMap((token) => [token, normalizeNumericToken(token)]));
  for (const token of detectedNumericTokens) {
    if (!approved.has(token) && !approved.has(normalizeNumericToken(token))) {
      addIssue(issues, 'UNAPPROVED_NUMBER', 'Answer contains a numeric token that was not approved.', token);
    }
  }
}

function validateKnowledgeYears(
  input: AIChatSiteKnowledgeResponseValidationInput,
  answer: string,
  detectedYearTokens: string[],
  issues: ResponseValidationIssue[]
): void {
  const approved = new Set([
    ...input.knowledgeAnswer.approvedYearTokens,
    ...input.prompt.groundingPayload.approvedYearTokens,
  ]);
  for (const token of detectedYearTokens) {
    if (!approved.has(token)) addIssue(issues, 'UNAPPROVED_YEAR', 'Answer contains a year that was not approved.', token);
  }
  const range = answer.match(YEAR_RANGE_PATTERN);
  if (range) {
    const compactRange = `${range[1]}-${range[2]}`;
    if (!approved.has(range[0]) && !approved.has(compactRange)) {
      addIssue(issues, 'UNAPPROVED_YEAR', 'Answer contains an unapproved year range form.', range[0]);
    }
  }
}

function validateKnowledgeSources(
  input: AIChatSiteKnowledgeResponseValidationInput,
  answer: string,
  issues: ResponseValidationIssue[]
): void {
  if (/\baccording to Gemini\b/i.test(answer) || /\bexternal study\b/i.test(answer) || UNSUPPORTED_CITATION_PATTERN.test(answer)) {
    addIssue(issues, 'UNVERIFIED_SOURCE', 'Answer contains an unsupported source or citation claim.');
    return;
  }
  const allowed = dedupe([
    ...input.prompt.groundingPayload.sources.flatMap((source) => [
      source.publisher || '',
      source.title || '',
      source.year ? String(source.year) : '',
    ]),
    ...input.knowledgeAnswer.sources.flatMap((source) => [
      source.publisher || '',
      source.title || '',
      source.year ? String(source.year) : '',
    ]),
  ].map(compactText).filter(Boolean));
  for (const pattern of SOURCE_CLAIM_PATTERNS) {
    pattern.lastIndex = 0;
    for (const match of answer.matchAll(pattern)) {
      const claim = cleanSourceClaim(match[1] || '');
      if (claim && !phraseAppearsInSet(claim, allowed)) {
        addIssue(issues, 'UNVERIFIED_SOURCE', 'Answer cites a source label that was not supplied in the grounded prompt.', claim);
      }
    }
  }
}

function validateKnowledgeRecommendation(answer: string, issues: ResponseValidationIssue[]): void {
  if (RECOMMENDATION_PATTERNS.some((pattern) => pattern.test(answer))) {
    addIssue(issues, 'UNVERIFIED_RECOMMENDATION', 'Site knowledge answer contains recommendation language.');
  }
}

function validateKnowledgeDashboardInjection(answer: string, issues: ResponseValidationIssue[]): void {
  if (/\b(?:resilience score|dashboard score|skor daya tahan|skor papan pemuka)\b.{0,80}\b\d+(?:\.\d+)?%?/i.test(answer)) {
    addIssue(issues, 'UNAPPROVED_NUMBER', 'Site knowledge answer appears to introduce dashboard score data.');
  }
}

function validateRequiredDisclosures(input: AIChatResponseValidationInput, answer: string, issues: ResponseValidationIssue[]): void {
  const disclosures = dedupe([
    ...input.factObject.requiredDisclosures,
    ...input.structuredAnswer.requiredDisclosures,
    ...input.comparability.requiredDisclosures,
    ...input.structuredAnswer.warnings.map((warning) => warning.message),
    ...Object.values(input.structuredAnswer.layers).flatMap((layer) => layer.warnings),
  ]);
  for (const disclosure of disclosures) {
    const code = disclosureFailureCode(disclosure);
    if (code && !preservesDisclosure(answer, disclosure)) {
      addIssue(issues, code, 'Answer does not preserve a required deterministic disclosure.', disclosure);
    }
  }

  for (const layer of [input.structuredAnswer.layers.gap, input.structuredAnswer.layers.impact, input.structuredAnswer.layers.lever]) {
    if (layer.text && ['UNAVAILABLE', 'PARTIAL'].includes(layer.status) && !preservesDisclosure(answer, layer.text)) {
      addIssue(issues, disclosureFailureCode(layer.text) || 'MALFORMED_OUTPUT', 'Answer removed an unavailable-layer disclosure.', layer.text);
    }
  }
}

function rejectOperationClaims(answer: string, issues: ResponseValidationIssue[], downgraded = false): void {
  if (/\b(?:highest|lowest|best|worst|winner|wins|rank(?:ed|ing)?|lebih tinggi|tertinggi|terendah|pemenang)\b/i.test(answer)) {
    addIssue(issues, 'UNSUPPORTED_RANKING', downgraded ? 'Downgraded answer contains a ranking claim.' : 'Answer contains an unsupported ranking claim.');
  }
  if (/\b(?:trend|increased|decreased|improved|declined|naik|turun|meningkat|merosot|since)\b/i.test(answer)) {
    addIssue(issues, 'UNSUPPORTED_TREND', 'Answer contains an unsupported trend claim.');
  }
  if (/\b(?:gap|target|progress-to-target|percentage change|difference|differs by|lebih sebanyak)\b/i.test(answer)) {
    addIssue(issues, 'UNSUPPORTED_TARGET_OR_GAP', 'Answer contains an unsupported target, gap, progress, or calculated-difference claim.');
  }
  if (/\b(?:compared with|compared to|than|versus|vs\.?|berbanding|bandingkan)\b/i.test(answer)) {
    addIssue(issues, 'UNSUPPORTED_COMPARISON', 'Answer contains an unsupported comparison claim.');
  }
}

function rejectBlockedOperationClaims(answer: string, blockedOperations: string[], issues: ResponseValidationIssue[]): void {
  const blocked = new Set(blockedOperations);
  if (blocked.has('rank') && /\b(?:highest|lowest|best|worst|winner|rank)\b/i.test(answer)) {
    addIssue(issues, 'UNSUPPORTED_RANKING', 'Answer provides a blocked ranking claim.');
  }
  if (blocked.has('trend') && /\b(?:trend|increased|decreased|since|improved|declined)\b/i.test(answer)) {
    addIssue(issues, 'UNSUPPORTED_TREND', 'Answer provides a blocked trend claim.');
  }
  if ((blocked.has('compare') || blocked.has('year_alignment')) && /\b(?:compared with|compared to|than|versus|vs\.?|winner|higher|lower)\b/i.test(answer)) {
    addIssue(issues, 'UNSUPPORTED_COMPARISON', 'Answer provides a blocked comparison claim.');
  }
  if (blocked.has('sdg_progress') && /\b(?:progress-to-target|on track|off track|target gap|SDG progress)\b/i.test(answer)) {
    addIssue(issues, 'UNSUPPORTED_TARGET_OR_GAP', 'Answer provides a blocked SDG progress or target claim.');
  }
}

function disclosureFailureCode(disclosure: string): ResponseValidationFailureCode | undefined {
  if (/target|gap|progress-to-target|SDG progress/i.test(disclosure)) return 'UNSUPPORTED_TARGET_OR_GAP';
  if (/trend/i.test(disclosure)) return 'UNSUPPORTED_TREND';
  if (/comparison|compare|ranking|rank|different year|denominator|derived|aggregate|inherited|district|stale|freshness|impact|lever|intervention/i.test(disclosure)) {
    return /ranking|rank/i.test(disclosure) ? 'UNSUPPORTED_RANKING' : 'UNSUPPORTED_COMPARISON';
  }
  return undefined;
}

function preservesDisclosure(answer: string, disclosure: string): boolean {
  const answerText = compactText(answer);
  const keywords = disclosureKeywords(disclosure);
  if (!keywords.length) return true;
  return keywords.every((keyword) => answerText.includes(keyword));
}

function containsAnyRequiredDisclosure(answer: string, disclosures: string[]): boolean {
  return disclosures.some((disclosure) => preservesDisclosure(answer, disclosure));
}

function disclosureKeywords(disclosure: string): string[] {
  const text = disclosure.toLowerCase();
  const groups = [
    ['derived', 'aggregate', 'aggregated'],
    ['inherited', 'national-level', 'national'],
    ['different years', 'non-identical years', 'source years', 'year'],
    ['denominator', 'definition', 'unit'],
    ['target', 'gap', 'progress-to-target', 'cannot be calculated', 'unavailable'],
    ['sdg', 'coverage', 'mapping'],
    ['district', 'freshness', 'stale'],
    ['impact', 'quantified', 'estimate', 'unavailable'],
    ['lever', 'intervention', 'retrieved', 'unavailable'],
  ];
  return groups
    .filter((group) => group.some((word) => text.includes(word)))
    .map((group) => group.find((word) => compactText(disclosure).includes(word)) || group[0]);
}

function extractNumericTokens(text: string): string[] {
  const tokens: string[] = [];
  for (const match of text.matchAll(NUMERIC_TOKEN_PATTERN)) tokens.push(match[2]);
  return dedupe(tokens);
}

function extractUrls(text: string): string[] {
  const pattern = new RegExp(URL_PATTERN.source, 'ig');
  return dedupe([...text.matchAll(pattern)].map((match) => match[0]));
}

function approvedNumericForms(input: AIChatResponseValidationInput): Set<string> {
  const tokens = [
    ...input.factObject.approvedNumericTokens,
    ...input.structuredAnswer.approvedNumericTokens,
    ...input.prompt.groundingPayload.approvedNumericTokens,
  ];
  return new Set(tokens.flatMap((token) => [token, normalizeNumericToken(token)]));
}

function approvedYearForms(input: AIChatResponseValidationInput): Set<string> {
  return new Set([
    ...input.factObject.approvedYearTokens,
    ...input.structuredAnswer.approvedYearTokens,
    ...input.prompt.groundingPayload.approvedYearTokens,
  ]);
}

function allowedSourcePhrases(input: AIChatResponseValidationInput): string[] {
  const sourceLabels = input.prompt.groundingPayload.sources.flatMap((source) => [
    source.publisher || '',
    source.title || '',
    source.year ? String(source.year) : '',
  ]);
  const structuredSources = input.structuredAnswer.sources.flatMap((source) => [
    source.publisher || '',
    source.title || '',
    source.year ? String(source.year) : '',
  ]);
  return dedupe([...sourceLabels, ...structuredSources].map(compactText).filter(Boolean));
}

function phraseAppearsInSet(claim: string, allowed: string[]): boolean {
  const normalized = compactText(claim);
  if (!normalized) return true;
  return allowed.some((source) => source.includes(normalized) || normalized.includes(source));
}

function cleanSourceClaim(value: string): string {
  return value.replace(/\b(?:the|a|an)\b/gi, '').replace(/["\u201c\u201d]/g, '').trim();
}

function normalizeNumericToken(token: string): string {
  return token.replace(/,/g, '');
}

function isYearToken(token: string): boolean {
  const normalized = normalizeNumericToken(token).replace(/[+%]/g, '');
  return /^(?:19|20)\d{2}$/.test(normalized);
}

function compactText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9%]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function addIssue(
  issues: ResponseValidationIssue[],
  code: ResponseValidationFailureCode,
  message: string,
  token?: string
): void {
  if (issues.some((issue) => issue.code === code && issue.token === token)) return;
  issues.push({
    code,
    message,
    ...(token ? { token } : {}),
    severity: 'blocking',
  });
}

function dedupe(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}
