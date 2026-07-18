import fs from 'node:fs';
import path from 'node:path';
import { sourceConfigPath, resolveRepoPath, repoRoot, toRepoPath } from './paths.js';

const EXCLUDED_PARTS = new Set([
  'node_modules',
  'vendor',
  'dist',
  'build',
  'coverage',
  '.git',
  '.next',
  '.cache',
  'cache',
]);

const EXCLUDED_FILE_NAMES = new Set(['.env', '.env.local', '.env.production', '.env.development']);

export function isSafeSourcePath(relativePath) {
  const normalized = String(relativePath || '').replaceAll('\\', '/');
  if (!normalized || path.isAbsolute(normalized)) return false;
  if (normalized.split('/').some((part) => EXCLUDED_PARTS.has(part))) return false;
  const base = path.posix.basename(normalized);
  if (EXCLUDED_FILE_NAMES.has(base) || base.startsWith('.env.')) return false;
  return true;
}

export class ContentSourceScanner {
  constructor(configPath = sourceConfigPath) {
    this.configPath = configPath;
  }

  loadSources() {
    const config = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
    return (config.sources || []).map((source) => {
      const safe = isSafeSourcePath(source.path);
      const fullPath = safe ? resolveRepoPath(source.path) : null;
      const insideRepo = fullPath ? fullPath.startsWith(repoRoot) : false;
      const exists = Boolean(fullPath && insideRepo && fs.existsSync(fullPath));
      return {
        ...source,
        enabled: source.enabled !== false,
        safe,
        exists,
        fullPath,
        repoPath: fullPath ? toRepoPath(fullPath) : source.path,
      };
    });
  }
}
