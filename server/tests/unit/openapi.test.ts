import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { parseDocument } from 'yaml';

const requiredOperations = {
  '/api/auth/csrf': ['get'],
  '/api/auth/register': ['post'],
  '/api/auth/resend-verification': ['post'],
  '/api/auth/verify-email': ['post'],
  '/api/auth/login': ['post'],
  '/api/auth/me': ['get'],
  '/api/auth/logout': ['post'],
  '/api/auth/logout-all': ['post'],
  '/api/auth/forgot-password': ['post'],
  '/api/auth/reset-password': ['post'],
  '/api/auth/change-password': ['post'],
  '/api/users/me': ['get', 'patch'],
  '/api/users/me/change-email': ['post'],
  '/api/users/me/confirm-email-change': ['post'],
};
const rateLimitedOperations = [
  ['/api/auth/register', 'post'], ['/api/auth/resend-verification', 'post'], ['/api/auth/verify-email', 'post'],
  ['/api/auth/login', 'post'], ['/api/auth/logout-all', 'post'], ['/api/auth/forgot-password', 'post'],
  ['/api/auth/reset-password', 'post'], ['/api/auth/change-password', 'post'], ['/api/users/me/change-email', 'post'],
] as const;

const resolveLocalRef = (root: Record<string, unknown>, ref: string) => ref
  .slice(2)
  .split('/')
  .reduce<unknown>((current, segment) => (current as Record<string, unknown>)?.[segment.replaceAll('~1', '/').replaceAll('~0', '~')], root);

describe('OpenAPI authentication contract', () => {
  it('parses cleanly, covers every frontend auth operation and has valid local references', async () => {
    const source = await readFile(new URL('../../openapi/auth.yaml', import.meta.url), 'utf8');
    const document = parseDocument(source);
    expect(document.errors).toEqual([]);
    const api = document.toJS() as Record<string, unknown>;
    expect(api.openapi).toBe('3.1.0');

    const paths = api.paths as Record<string, Record<string, unknown>>;
    for (const [path, methods] of Object.entries(requiredOperations)) {
      expect(paths[path], `Missing OpenAPI path ${path}`).toBeDefined();
      for (const method of methods) expect(paths[path][method], `Missing ${method.toUpperCase()} ${path}`).toBeDefined();
    }
    for (const [path, method] of rateLimitedOperations) {
      const operation = paths[path][method] as { responses?: Record<string, unknown> };
      expect(operation.responses?.['429'], `Missing 429 response for ${method.toUpperCase()} ${path}`).toBeDefined();
    }

    const operationIds = Object.values(paths).flatMap((operations) => Object.values(operations))
      .map((operation) => (operation as { operationId?: string }).operationId)
      .filter(Boolean);
    expect(new Set(operationIds).size).toBe(operationIds.length);

    const visit = (value: unknown) => {
      if (Array.isArray(value)) return value.forEach(visit);
      if (!value || typeof value !== 'object') return;
      const record = value as Record<string, unknown>;
      if (typeof record.$ref === 'string' && record.$ref.startsWith('#/')) {
        expect(resolveLocalRef(api, record.$ref), `Unresolved OpenAPI reference ${record.$ref}`).toBeDefined();
      }
      Object.values(record).forEach(visit);
    };
    visit(api);
  });
});
