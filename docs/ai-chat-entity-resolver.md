# AI Chat Entity Resolver

Stage 3B adds deterministic bilingual entity resolution for chatbot questions. It runs after
intent routing and before later retrieval/fact-building stages.

## Supported Entity Types

- Territories and regions: Sabah, Sarawak, Brunei Darussalam, Kalimantan, Borneo-wide, Indonesian Borneo, and Malaysian Borneo.
- Concepts: repository `dashboard_concept` values such as `food`, `education`, `energy`, `healthcare`, `clean_water_access`, `forest_cover`, `deforestation`, `fire_hotspots`, `poverty`, `governance`, and `resilience`.
- Indicators: exact indicator names from `public/data/indicators.json` plus conservative aliases derived from those names.
- Hexagon pillars: Food, Education, Shelter, Energy, Healthcare, Entertainment.
- Districts: exact district names from committed `public/data/districts.json`.
- Years: four-digit years and explicit year ranges.
- Operations: comparison, ranking, trend, weakest, strongest, target/gap, SDG progress, district-level, and latest/current/recent.

## Repository Sources

The resolver uses committed repository content only:

- `public/data/indicators.json`
- `public/data/districts.json`
- `public/data/resilience.json` vocabulary reflected through the pillar/concept aliases
- EN/MS i18n terminology where the app already exposes reliable terms
- report content indicator names already grounded in repository data

It does not call Gemini, Supabase, embeddings, vector search, live APIs, or network services.

## Alias Rules

Aliases are phrase/token aware and deterministic. Matching normalizes case, punctuation, repeated
spacing, apostrophe variants, and hyphens. Longer phrases are preferred before shorter terms.

English/Malay aliases are included only for app-supported or domain-stable terms. The resolver does
not invent new indicators. `clean_water_access` remains separate from `shelter`.

## District Policy

District names are loaded from committed `districts.json`. The resolver does not use fuzzy matching.
Unknown districts are ignored. If multiple committed district names normalize to the same phrase, the
resolver returns an ambiguity instead of selecting one.

## Ambiguity Behavior

Ambiguities are returned in `ambiguities[]` for downstream clarification. Stage 3B does not ask the
user for clarification, run comparability checks, or build facts. Explicit wording overrides weak
request region context.
