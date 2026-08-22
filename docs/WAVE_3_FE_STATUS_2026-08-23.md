# Wave 3 Front-End Execution — Status (2026-08-23)

Tracks progress against `WAVE_3_FE_EXECUTION_PROMPT.md` and `docs/CLIENT_FEEDBACK_2026-08-15_ACTION_PLAN.md`.

## Done

| Card | Ticket | What | Key files |
|---|---|---|---|
| 1 | BT-25 | Plural-aware EN/MS i18n parity test | `src/i18n/__tests__/parity.test.js` |
| 2 | BT-24 | Positioning tagline on login (AuthLayout) + About page | `src/components/AuthLayout.jsx`, `src/pages/about/AboutPage.jsx`, `about.css` |
| 3 | BT-14 | Empty dashboard search falls through to "Ask BorneoBot" with query prefill | `src/components/layout_new.jsx`, `AIChatDialog.jsx`, `src/pages/dashboard/OverviewDashboard.jsx`, `src/shared/aiChatContracts.js` |
| 4 | BT-12 | Hexagon radar axes are clickable/keyboard-operable, opening a per-pillar drill-down panel | `src/components/HexRadar.jsx` (+test), `src/components/PillarDrillDown.jsx`, `src/utils/pillarIndicators.js` (+test), `OverviewDashboard.jsx` |
| 7 | BT-22 | Reusable `AnswerStrip` (What/Where/Why/What Next) mounted on the Dashboard | `src/components/AnswerStrip.jsx/.css` (+test), `src/utils/weakestTerritory.js` (+test), `OverviewDashboard.jsx` |
| 8 | BT-23 | `AnswerStrip` mounted on Regional Detail, ESG, SDG pages with page-specific "what" | `Regional_Detail.jsx`, `esg_indicator.jsx`, `sdg_progress.jsx` |
| 9 | BT-26 | New-logic test coverage (headline against real data, pillar resolver, HexRadar interactivity, weakest-territory) | `headline.realData.test.js`, `pillarIndicators.test.js`, `weakestTerritory.test.js`, `HexRadar.test.jsx` |
| — | i18n | New/changed keys added for all of the above | `src/i18n/locales/en.json`, `ms.json` |

**Validation status:** `npm run lint` clean · `npm run build` succeeds · `npm test` — 57 files / 957 tests passing. EN 654 leaf keys vs MS 647 (gap is exactly the English `_one` plural-suffix keys, which the parity test accounts for).

## Not done — blocked, waiting on DATA role

| Card | Ticket | What | Blocked on |
|---|---|---|---|
| 5 | BT-19 | Momentum UI (trend indicator on dashboard) | **BT-18** (momentum/trend calculation) — not present on this branch |
| 6 | BT-20 | Sources UI (per-source cadence & coverage display) | **BT-16b** (per-source registry: id, display name, cadence, licence, last fetch, coverage) — not present; only the aggregate `meta.updateCadence` (BT-16a) exists |

No FE code has been written for these two cards. Once BT-18 and BT-16b land, these can be picked up as their own follow-on cards using the same patterns established here (e.g. `AnswerStrip`-style presentational components, page-level `useMemo` for data derivation).

## Not done — needs manual/visual verification (no browser tool available this session)

These are logic-tested but not visually confirmed:
- Tagline renders correctly on login screen and About page (Card 2)
- Search → BorneoBot handoff behaves correctly in the browser, including prefill (Card 3)
- Radar axis click/keyboard opens the drill-down panel correctly (Card 4)
- `AnswerStrip` layout/suppression looks right on Dashboard, Regional Detail, ESG, and SDG pages (Cards 7, 8)

## Open design decisions flagged for review
- **Card 7 dead-lever assumption was stale**: Sabah/Sarawak Education now has a resolvable simulator lever (`resilience_model.json` confirms `Mean years schooling (RLS)` is present), so the CTA-suppression logic was built as a generic lever-availability check rather than a hardcoded exception.
- **AnswerStrip mount point on Dashboard**: placed inside the existing scrollable right panel (top, above `PillarCoverage`) instead of above the whole map/panel row, to avoid touching resize-sensitive layout code.
