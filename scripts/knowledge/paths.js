import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const knowledgeDir = path.join(repoRoot, 'knowledge');
export const generatedDir = path.join(knowledgeDir, 'generated');
export const sourceConfigPath = path.join(knowledgeDir, 'knowledge-sources.json');

export function toRepoPath(fullPath) {
  return path.relative(repoRoot, fullPath).replaceAll(path.sep, '/');
}

export function resolveRepoPath(relativePath) {
  return path.resolve(repoRoot, relativePath);
}
