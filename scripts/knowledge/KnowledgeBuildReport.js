export function createBuildReport() {
  return {
    buildTimestamp: process.env.KNOWLEDGE_BUILD_TIMESTAMP || '1970-01-01T00:00:00.000Z',
    sourcesScanned: [],
    sourcesProcessed: [],
    missingSources: [],
    unsafeSources: [],
    recordsCreated: 0,
    recordsValidated: 0,
    runtimeRecords: 0,
    recordsSkipped: 0,
    duplicateRecords: [],
    invalidRecords: [],
    placeholderRecords: [],
    countsBySource: {},
    countsByCategory: {},
    countsByLanguage: {},
    countsByStatus: {},
    outputFiles: [],
    warnings: [],
    errors: [],
  };
}
