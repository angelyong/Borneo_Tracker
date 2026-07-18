import { stripMarkdown, slugify } from './text.js';

export class MarkdownContentExtractor {
  extract(markdown, source) {
    const lines = String(markdown || '').split(/\r?\n/);
    const sections = [];
    let current = null;

    for (const line of lines) {
      const heading = /^(#{1,3})\s+(.+)$/.exec(line);
      if (heading) {
        if (current) sections.push(current);
        current = { title: heading[2].trim(), lines: [] };
      } else if (current) {
        current.lines.push(line);
      }
    }
    if (current) sections.push(current);

    return sections
      .map((section) => ({
        id: `${source.id}-${slugify(section.title)}`,
        title: section.title,
        category: source.category,
        content: stripMarkdown(section.lines.join('\n')),
        sourceName: 'Borneo Tracker documentation',
        pageUrl: '/about',
      }))
      .filter((record) => record.content.length >= 40);
  }
}
