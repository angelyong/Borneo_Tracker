# Borneo Tracker Wave 3 Front-End Requirements from Client Feedback

**Project:** Borneo Tracker  
**Document type:** Client feedback analysis and front-end system requirements  
**Scope:** Wave 3 front-end only  
**Prepared:** 2026-09-05  
**Source:** Client review comments on clarity, navigation, user experience, data trust and strategic positioning  

## 1. Purpose

This document converts the relevant client comments into clear and testable front-end requirements for Wave 3. It includes only the user-interface work assigned to Wave 3 and does not expand the scope to backend services, data ingestion, database changes or a new AI query engine.

The Wave 3 front end should move Borneo Tracker from presenting information to supporting decisions. Its main interaction model is:

> **What is happening? → Where is it happening? → Why does it matter? → What should we do next?**

## 2. Client Feedback Analysis

The client considers the Dashboard, unified Borneo map and Resilience Index to be the platform's strongest features. The requested improvement is therefore not to add more data to the homepage, but to make existing information easier to understand, trust and act upon.

The Wave 3 front-end implications are:

- Show change and direction instead of presenting only a current score.
- Let users inspect the indicators behind each True Wealth pillar.
- Make data sources, coverage and update frequency visible.
- Provide a safe route from an unsuccessful place search to BorneoBot.
- Present the Dashboard insight as four connected answers: What, Where, Why and What Next.
- Strengthen the platform's identity as a Borneo sustainability and resilience intelligence platform.

This work primarily supports **A — Artificial Intelligence**, **D — Data** and **E — Ethics** in the ABCDE Framework. It applies across the six True Wealth pillars: Food, Energy, Education, Shelter, Healthcare and Entertainment.

## 3. Wave 3 Front-End Functional Requirements

| Requirement ID | Client Need | Front-End System Requirement | Priority | Acceptance Criteria | Current Repository Status |
|---|---|---|---|---|---|
| W3-FE-01 | Show whether resilience is improving or declining. | The Dashboard shall display the score change against an explicit comparison date. It shall also show the largest positive and negative territorial or pillar movements when comparable history exists. | High | Direction, value and comparison date are visible; increase, decrease and no-change states are distinct; the UI does not calculate across a methodology break; a clear empty state appears when history is insufficient. | Implemented through `MomentumBadge` and the resilience-history UI. |
| W3-FE-02 | Turn “Last updated” into a data-trust mechanism. | The Data Sources interface shall show each source's publisher, update frequency, territorial or pillar coverage, last available update information and source link. | High | Users can review source identity, cadence and coverage; loading, empty and error states are displayed; stale or unavailable information is not presented as current. | Implemented through `SourceRegistryTable` on the Data Sources page. |
| W3-FE-03 | Make every True Wealth pillar explorable. | The Resilience by Pillar visual shall allow a user to select a pillar and open a drill-down view of its supporting indicators. | High | Pillars work with mouse and keyboard; the drill-down shows pillar, score, indicator, value, year, source and confidence where available; missing data is shown as unavailable and never converted to a false zero. | Implemented through `PillarDrilldownModal` on Dashboard and Regional Details. |
| W3-FE-04 | Support natural questions such as comparing territories. | When a Dashboard search does not match a place, the interface shall offer to send the entered question to BorneoBot instead of ending at a “no results” message. | High | The user's text is preserved and passed to BorneoBot; the user remains in control of whether to submit it; quota or service errors produce a safe message; unsupported questions are not represented as supported analysis. | Partially implemented by design: the BorneoBot handoff and territory comparison are available; low-food-district and highest-risk queries remain disabled until valid data and definitions exist. |
| W3-FE-05 | Explain the Dashboard in one immediately understandable view. | The Dashboard shall display one compact decision strip answering What, Where, Why and What Next from the current resilience data. | High | “What” states the current condition; “Where” identifies the weakest valid scope; “Why” explains the consequence of the weakest pillar; “What Next” links to the relevant Impact Simulator context; missing data receives an honest fallback. | Implemented through `AnswerStrip` on the Dashboard. |
| W3-FE-06 | Apply consistent decision support beyond the homepage. | The same decision framing shall be available on Regional Details, ESG and SDG pages using each page's current territory or scope. | Medium | The component uses the selected territory; its wording remains consistent across pages; its link opens the correct simulator context; it fits the compact layouts of all three pages. | Implemented on Regional Details, ESG and SDG pages. |
| W3-FE-07 | Position the product as a regional intelligence platform. | The front end shall display the positioning statement “Measure Borneo. Understand Borneo. Strengthen Borneo.” in suitable high-visibility locations without overcrowding the Dashboard. | Medium | The statement appears on the About and sign-in experiences; it is available in English and Malay; it remains readable in light, dark and responsive layouts. | Implemented in the authentication and About interfaces. |
| W3-FE-08 | Keep the new Wave 3 experience understandable and inclusive. | All new Wave 3 controls, labels, explanations and states shall support English and Malay, keyboard operation, visible focus and responsive layouts. | High | No untranslated interface labels; interactive elements have accessible names; modal focus and dismissal work correctly; layouts remain usable on desktop, tablet and mobile widths. | Implemented in the related components and locale files; execution verification is outside this document. |

## 4. Detailed Front-End Behaviour

### 4.1 Resilience Momentum

The score area shall communicate both the current position and its direction. The comparison label must use a real date rather than the vague phrase “previous period.” When no valid comparison exists, the interface shall state that this is the first comparable reading or that no change is available.

Methodology changes must not be displayed as real-world improvement or decline. This protects the platform's ethical requirement to present data honestly.

### 4.2 Data Source Trust

The Data Sources page shall separate two different concepts:

- **Source registry:** who published the data, its update cadence and its coverage.
- **Integrity verification:** whether published data files match their recorded proof or manifest.

The interface must not use a build timestamp as proof that every underlying source was updated on that date. Recommended wording is “checked on schedule; updated when the source changes.”

### 4.3 Pillar Drill-Down

The pillar interaction shall expose the evidence behind the score without making the radar chart visually complex. Selecting Food, Energy, Education, Shelter, Healthcare or Entertainment shall open a focused panel with the available indicator details.

The interface shall also surface the principle:

> **Resilience is only as strong as its weakest essential pillar.**

If a pillar or district does not have comparable data, the UI shall explicitly say so. It must not display missing data as a score of zero.

### 4.4 Search-to-BorneoBot Handoff

The existing place search remains a location search. A query that is not a location shall produce a clear “Ask BorneoBot” action carrying the user's original text.

Wave 3 does not promise a universal natural-language query engine. Supported prompts must have approved meanings and reliable data. In particular:

- “Compare Sabah and Sarawak” may be enabled using comparable territory data.
- “Show districts with low food resilience” remains unavailable until comparable district Food scores exist.
- “Find highest-risk regions” remains unavailable until “risk” has an approved calculation or definition.

### 4.5 What / Where / Why / What Next

The Answer Strip shall transform several charts into one decision-oriented narrative:

| Question | Required Front-End Answer |
|---|---|
| What is happening? | Current score, interpretation band and weakest valid pillar. |
| Where is it happening? | Weakest scored territory or the relevant selected territory. |
| Why does it matter? | A short real-world consequence linked to the pillar. |
| What should we do next? | A direct link to the Impact Simulator with territory and pillar context where supported. |

The wording shall be generated from structured application data and approved translations. It shall not require an AI-generated daily summary.

## 5. Front-End Data Interfaces and Dependencies

Wave 3 front-end components depend on prepared data but do not own its ingestion or calculation.

| Front-End Feature | Required Input | Dependency Boundary |
|---|---|---|
| Momentum display | `resilience_history.json` with dates and methodology markers | History construction and methodology tagging are data-layer work. |
| Source registry | `sources.json` with publisher, cadence, links and coverage | Source research and registry generation are data-layer work. |
| Pillar drill-down | Resilience detail and indicator provenance fields | Missing district-level pillar data cannot be invented by the UI. |
| Answer Strip | Current score, RAG band, weakest territory and weakest pillar | Scoring rules remain in the resilience model, not in presentation components. |
| BorneoBot handoff | Existing chatbot interface and supported-question contract | AI quota, server functions and new intent handlers are not front-end scope. |

## 6. Non-Functional Requirements

| Category | Requirement |
|---|---|
| Accessibility | All controls shall be keyboard operable, visibly focused and labelled for assistive technology. |
| Responsiveness | Components shall remain readable on desktop, tablet and mobile widths without hiding essential meaning. |
| Internationalisation | All user-facing text shall use translation keys available in English and Malay. |
| Data honesty | Missing, stale or methodologically incomparable data shall be stated explicitly and never represented as zero or as a real trend. |
| Consistency | Score labels, dates, territory names, pillar names and simulator links shall use the same rules across Dashboard, Regional Details, ESG and SDG pages. |
| Performance | New panels and modals shall reuse already-loaded local data where practical and shall not block the primary Dashboard view. |
| Theme support | All new elements shall remain readable in light and dark themes. |

## 7. Wave 3 Front-End Deliverables

| Deliverable | Main Files / Areas |
|---|---|
| Momentum and mover presentation | `src/components/MomentumBadge.jsx`, Dashboard score area |
| Source registry interface | `src/components/SourceRegistryTable.jsx`, `src/pages/info/DataVerification.jsx` |
| Pillar evidence interaction | `src/components/PillarDrilldownModal.jsx`, Dashboard and Regional Details |
| Search-to-chat continuation | Dashboard search result state and existing BorneoBot panel |
| Decision framing | `src/components/AnswerStrip.jsx`, `src/utils/answerStrip.js`, Dashboard, Regional Details, ESG and SDG |
| Strategic positioning copy | About and authentication interfaces |
| Bilingual and accessible presentation | English/Malay locale files and the relevant component interaction states |

## 8. Scope Exclusions

The following client suggestions are important but are not part of the Wave 3 front-end scope in this document:

- Header “How It Works,” logo descriptor and grouped sidebar navigation, because they were assigned to an earlier delivery wave.
- Resilience and True Wealth map-layer redesign, because it was assigned to the map and insight wave.
- New data ingestion, source-registry generation and resilience-history construction.
- A complete natural-language dashboard query engine.
- AI-written daily summaries requiring recurring generation and review.
- ESG or SDG composite map scores without an approved scoring methodology.
- New district-level Food or full-pillar resilience scoring.
- Blockchain, tokenisation or smart-contract interfaces.

These exclusions prevent the front end from claiming calculations, data coverage or AI capabilities that the underlying system does not yet support.

## 9. Client Feedback Traceability for Wave 3 Front End

| Client Comment | Wave 3 Front-End Response | Requirement |
|---|---|---|
| Show direction and momentum beside the score. | Add dated momentum and biggest-mover presentation. | W3-FE-01 |
| Turn last updated into a data-trust mechanism. | Add a visible source registry with cadence and coverage. | W3-FE-02 |
| Make each pillar clickable. | Add an accessible indicator drill-down. | W3-FE-03 |
| Support natural questions. | Route unmatched search text to BorneoBot within an honest support contract. | W3-FE-04 |
| Make the data immediately understandable. | Add the four-question Answer Strip. | W3-FE-05 |
| Apply decision support across the platform. | Reuse the Answer Strip on Regional, ESG and SDG pages. | W3-FE-06 |
| Position Borneo Tracker as a regional intelligence platform. | Add the strategic positioning statement to About and sign-in. | W3-FE-07 |
| Maintain a professional, clear experience. | Apply bilingual, accessible, responsive and theme-safe behaviour. | W3-FE-08 |

## 10. Wave 3 Front-End Outcome

When these requirements are satisfied, Borneo Tracker does more than display sustainability data. The user can identify the current condition, locate the weakest area, understand why it matters, inspect the evidence and continue to an action-oriented tool. This advances the platform from a visually strong dashboard toward a trustworthy regional intelligence and decision-support system.

## 11. Status Note

The status column is based on static inspection of the current repository and existing Wave 3 documentation on 2026-09-05. No application tests were run while preparing this requirements document.
