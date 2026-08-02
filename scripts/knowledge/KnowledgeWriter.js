import fs from 'node:fs';
import path from 'node:path';
import { generatedDir, resolveRepoPath, toRepoPath } from './paths.js';

const FILE_BY_CATEGORY = {
  'site-overview': 'site-overview.json',
  dashboard: 'dashboard.json',
  regional: 'regional.json',
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
  policies: 'policies.json',
  methodology: 'methodology.json',
  reports: 'reports.json',
  news: 'news.json',
  community: 'community.json',
};

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

export class KnowledgeWriter {
  constructor(outputDir = generatedDir, runtimeIndexPath = resolveRepoPath('supabase/functions/ai-chat/knowledge-index.json')) {
    this.outputDir = outputDir;
    this.runtimeIndexPath = runtimeIndexPath;
  }

  write(records, buildReport) {
    fs.mkdirSync(this.outputDir, { recursive: true });
    for (const entry of fs.readdirSync(this.outputDir, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith('.json')) {
        fs.unlinkSync(path.join(this.outputDir, entry.name));
      }
    }
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
      schemaVersion: 2,
      generatedAt: buildReport.buildTimestamp,
      recordCount: records.length,
      records: records.sort((a, b) => a.id.localeCompare(b.id)),
    };
    writeJson(indexPath, index);
    outputFiles.push(toRepoPath(indexPath));

    writeJson(this.runtimeIndexPath, index);
    outputFiles.push(toRepoPath(this.runtimeIndexPath));

    const reportPath = path.join(this.outputDir, 'build-report.json');
    const finalReport = { ...buildReport, outputFiles: [...outputFiles, toRepoPath(reportPath)] };
    writeJson(reportPath, finalReport);
    outputFiles.push(toRepoPath(reportPath));

    return { outputFiles, index };
  }
}
