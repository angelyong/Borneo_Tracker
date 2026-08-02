import type { LeverLibraryArtifact, LeverRecord } from './contracts.ts';
import leverLibrary from './lever-library.json';

export class LeverRepository {
  private records: LeverRecord[];

  constructor(artifact: Partial<LeverLibraryArtifact> = leverLibrary as LeverLibraryArtifact) {
    this.records = Array.isArray(artifact.records) ? [...artifact.records] : [];
  }

  getVerifiedRecords(): LeverRecord[] {
    return this.records
      .filter((record) => record.evidenceStatus === 'VERIFIED')
      .sort(compareLeverRecords);
  }
}

export function compareLeverRecords(a: LeverRecord, b: LeverRecord): number {
  return a.concept.localeCompare(b.concept) ||
    a.language.localeCompare(b.language) ||
    a.id.localeCompare(b.id);
}
