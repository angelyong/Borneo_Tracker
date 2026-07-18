export function createBuildReport() {
  return {
    buildTimestamp: new Date().toISOString(),
    sourcesScanned: [],
    sourcesProcessed: [],
    missingSources: [],
    unsafeSources: [],
    recordsCreated: 0,
    recordsSkipped: 0,
    duplicateRecords: [],
    invalidRecords: [],
    placeholderRecords: [],
    outputFiles: [],
    warnings: [],
    errors: [],
  };
}
