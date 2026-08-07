import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { cwd } from 'node:process';
import { describe, expect, it } from 'vitest';

describe('lever library build process', () => {
  it('validates the current curated lever files', () => {
    const output = execFileSync('node', ['scripts/build-levers.js', '--validate-only'], {
      cwd: cwd(),
      encoding: 'utf8',
    });

    expect(output).toContain('Lever validation: passed');
    expect(output).toContain('Runtime records: 0');
  });

  it('builds deterministic canonical and Edge artifacts', () => {
    execFileSync('node', ['scripts/build-levers.js'], {
      cwd: cwd(),
      encoding: 'utf8',
    });
    const canonical = fs.readFileSync('knowledge/generated/lever-library.json', 'utf8');
    const edge = fs.readFileSync('supabase/functions/ai-chat/lever-library.json', 'utf8');
    const report = JSON.parse(fs.readFileSync('knowledge/generated/lever-build-report.json', 'utf8'));

    expect(edge).toBe(canonical);
    expect(JSON.parse(canonical)).toMatchObject({
      schemaVersion: 1,
      recordCount: 0,
      records: [],
    });
    expect(report.warnings[0]).toContain('No verified lever records');
  });
});
