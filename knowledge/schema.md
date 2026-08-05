# Static Knowledge Record Schema

Stage 2 static knowledge files contain runtime-safe arrays of verified records. Placeholder
and incomplete records are reported in `knowledge/generated/build-report.json` but are not
written into `knowledge/generated/knowledge-index.json`.

```json
{
  "id": "forest-cover",
  "title": "Forest Cover",
  "category": "environmental",
  "content": "Forest cover is an environmental indicator...",
  "language": "en",
  "pageUrl": "/esg",
  "region": null,
  "concept": "forest_cover",
  "sdgTags": ["SDG15"],
  "keywords": ["forest", "cover"],
  "regions": [],
  "relatedSdgs": [],
  "unit": null,
  "sourceName": "Borneo Tracker report content",
  "sourceUrl": "",
  "sourceFile": "src/pages/reports/reportContent.js",
  "sourceType": "page",
  "sourceId": "report-content",
  "sourcePath": "INDICATOR_EXPLANATIONS.Forest cover",
  "updatedAt": null,
  "status": "verified",
  "placeholder": false,
  "runtimeIncluded": true,
  "provenance": {
    "sourceFile": "src/pages/reports/reportContent.js",
    "sourceType": "page",
    "sourceId": "report-content",
    "sourceName": "Borneo Tracker report content",
    "sourceUrl": "",
    "pageUrl": "/reports",
    "route": "/reports",
    "language": "en",
    "sourcePath": "INDICATOR_EXPLANATIONS.Forest cover",
    "extractedAt": null
  },
  "searchableText": "forest cover environmental..."
}
```

## Field Notes

- `id` is deterministic and slug-safe.
- `language` preserves bilingual content. English and Malay records are not duplicates.
- `region` is a primary region when one applies; `regions` keeps multi-region context.
- `sdgTags` is the Stage 2 field name; `relatedSdgs` remains for compatibility.
- `sourceFile`, `sourceId`, `sourcePath`, and `provenance` are required for source cards.
- `sourceUrl` is only copied from source metadata. The builder does not invent URLs.
- `status` is `verified`, `placeholder`, or `incomplete`.
- `runtimeIncluded` is `true` only for verified records.

Records marked `placeholder` or `incomplete` are scaffolding or mock/prototype copy, not
authoritative facts or statistics. They are excluded from runtime retrieval until approved.
