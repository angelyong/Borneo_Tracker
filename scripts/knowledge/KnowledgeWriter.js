import fs from 'node:fs';
import path from 'node:path';
import { generatedDir, toRepoPath } from './paths.js';

const FILE_BY_CATEGORY = {
  'site-overview': 'site-overview.json',
  regions: 'regions.json',
  'esg-indicators': 'esg-indicators.json',
  environmental: 'esg-indicators.json',
  esg: 'esg-indicators.json',
  'sdg-progress': 'sdgs.json',
  sdg: 'sdgs.json',
  'data-sources': 'data-sources.json',
  'generate-report': 'generate-report.json',
  'website-usage': 'faq.json',
  faq: 'faq.json',
};

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

export class KnowledgeWriter {
  constructor(outputDir = generatedDir) {
    this.outputDir = outputDir;
  }

  write(records, buildReport) {
    fs.mkdirSync(this.outputDir, { recursive: true });
    const files = new Map();

    records.forEach((record) => {
      const fileName = FILE_BY_CATEGORY[record.category] || 'site-overview.json';
      if (!files.has(fileName)) files.set(fileName, []);
      files.get(fileName).push(record);
    });

    const outputFiles = [];
    for (const [fileName, fileRecords] of files) {
      const filePath = path.join(this.outputDir, fileName);
      writeJson(filePath, fileRecords.sort((a, b) => a.title.localeCompare(b.title)));
      outputFiles.push(toRepoPath(filePath));
    }

    const indexPath = path.join(this.outputDir, 'knowledge-index.json');
    const index = {
      generatedAt: buildReport.buildTimestamp,
      recordCount: records.length,
      records: records.sort((a, b) => a.id.localeCompare(b.id)),
    };
    writeJson(indexPath, index);
    outputFiles.push(toRepoPath(indexPath));

    const reportPath = path.join(this.outputDir, 'build-report.json');
    const finalReport = { ...buildReport, outputFiles: [...outputFiles, toRepoPath(reportPath)] };
    writeJson(reportPath, finalReport);
    outputFiles.push(toRepoPath(reportPath));

    return { outputFiles, index };
  }
}
