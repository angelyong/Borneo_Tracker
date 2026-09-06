# Wave 3 Bugs, Testing Corrections and Personal Contributions

**Project:** Borneo Tracker  
**Contributor:** Angel Yap  
**Reporting period:** Wave 3 and final testing activities  
**Prepared:** 2026-09-05  

## 1. Overview

My contribution to Borneo Tracker covered front-end development, authentication interfaces, reporting and export features, bilingual support, the Impact Simulator, Wave 3 decision-support features, and software testing. During Wave 3 and the final testing activity, I also identified and corrected interface, validation and test-automation defects.

The work mainly strengthened the following parts of the ABCDE Framework:

- **A — Artificial Intelligence:** BorneoBot interaction and the deterministic Impact Simulator.
- **D — Data:** presentation of ESG, SDG, regional and True Wealth information.
- **E — Ethics:** source-aware interfaces, honest missing-data handling, bilingual parity and evidence-based testing.

## 2. Bugs and Defects Identified and Corrected

### 2.1 Wave 3 and Development Corrections

| Defect ID | Problem Identified | Correction Made | Result / Verification | Status |
|---|---|---|---|---|
| W3-BUG-01 | The Dashboard map size and resize behavior did not fit the available layout correctly. | Adjusted the map dimensions and resize-button behavior in the Dashboard. | Map and surrounding Dashboard panels displayed correctly after resizing. | Corrected |
| W3-BUG-02 | Generated reports had layout and section-rendering problems. | Corrected the report page and report-section implementation. | Report generation completed successfully and produced a non-empty PDF during system testing. | Corrected |
| W3-BUG-03 | Dark and light themes were not applied consistently across pages and controls. | Added shared theme handling and corrected affected component styles. | Theme switching worked across the main application interface. | Corrected |
| W3-BUG-04 | A direct English-to-Malay translation-key comparison incorrectly treated valid English singular keys as missing Malay translations. | Changed the parity rule to compare normalized plural roots because Malay uses the `other` plural form without requiring English-style `_one` keys. | UT-012 passed after the plural-aware correction. | Corrected |
| W3-BUG-05 | Dashboard searches with no location match could reach a dead end, and an AI quota response could produce a poor user experience. | Added an “Ask BorneoBot” handoff with the question prefilled and safe handling for quota-limited responses. | Search-to-chat interaction and safe fallback behavior were covered by Wave 3 tests. | Corrected |
| W3-BUG-06 | True Wealth Hexagon radar values were not directly accessible for drill-down, and missing pillar data risked being interpreted as a score of zero. | Added clickable and keyboard-operable radar axes with a pillar drill-down panel and an explicit no-comparable-data state. | Users could inspect supporting indicators without the system inventing a zero score. | Corrected |
| W3-BUG-07 | Dashboard information was fragmented and did not provide a concise answer to what happened, where, why and what to do next. | Added the reusable AnswerStrip and applied it to the Dashboard, Regional Detail, ESG and SDG pages. | The main pages presented a consistent decision-support summary and simulator direction. | Corrected |
| W3-BUG-08 | New Wave 3 interface behavior risked introducing untranslated text or regressions without targeted checks. | Added English/Malay keys and tests for headline data, pillar resolution, radar interaction and weakest-territory selection. | The Wave 3 front-end snapshot reported 57 Vitest files and 957 tests passing. | Corrected |

### 2.2 Test-Automation Defects Corrected

| Defect ID | Problem Identified | Correction Made | Result / Verification | Status |
|---|---|---|---|---|
| TEST-BUG-01 | Integration-test project paths were unreliable on Windows when derived from module URLs. | Changed the planned integration suite to resolve paths from `process.cwd()` using the platform path utility. | The planned integration suite located deployment files correctly and passed. | Corrected |
| TEST-BUG-02 | A Playwright route assertion used a combined `main, body` locator that could match more than one element. | Changed the assertion to use the page body as one stable test target. | Direct-route system checks completed without the locator conflict. | Corrected |
| TEST-BUG-03 | Attachment-validation tests expected only one exact wording even though the application used equivalent valid messages. | Updated the assertions to accept the supported invalid-type and 8 MB size-limit messages. | ST-033 and ST-034 passed while still checking the intended validation behavior. | Corrected |
| TEST-BUG-04 | UT-012 initially reported nine missing Malay singular keys even though this was caused by different English and Malay plural rules. | Replaced raw leaf-key equality with plural-root equality using recognized plural suffixes. | The false failure was removed and the language-parity case passed. | Corrected |

### 2.3 Defects Identified During Manual Testing

The following defects were recorded during the testing phase. Their final statuses below are based on my manual retest confirmation. Where no dedicated source-code commit is linked, screenshots or test evidence should be attached to the final project report.

| Defect ID | Defect Identified | Corrected / Expected Behavior Verified | Verification Method | Status |
|---|---|---|---|---|
| BUG-AUTH-01 | Email-verification links redirected to localhost instead of the intended application. | Verification links opened the correctly configured application destination. | Manual registration and verification retest | Corrected — Pass |
| BUG-AUTH-02 | A changed password was not reflected correctly in Supabase authentication. | The new password was accepted and the previous password was rejected. | Manual password-reset and login retest | Corrected — Pass |
| BUG-PROFILE-01 | Edited personal details disappeared after refreshing the profile page. | Updated profile details remained visible after reload. | Manual profile update and refresh retest | Corrected — Pass |
| BUG-ACCOUNT-01 | The Personal Details form allowed unsafe direct editing of the registered email address. | Account email behavior was checked against the controlled account-update requirement. | Manual profile and account-integrity retest | Corrected — Pass |
| BUG-ACCESS-01 | A suspended account could continue signing in and accessing protected content. | Suspended-account access was refused and an appropriate message was displayed. | Manual suspension and protected-route retest | Corrected — Pass |
| BUG-ACCESS-02 | A suspended account was still accessible from a fresh private/incognito session. | Access from a fresh browser session was refused independently of the previous session. | Manual private/incognito browser retest | Corrected — Pass |
| BUG-REACTIVATE-01 | A reactivated user could sign in but received an incorrect permission-denied message. | The reactivated user regained normal non-admin access while admin pages remained protected. | Manual reactivation, login and role-access retest | Corrected — Pass |

## 3. Testing Contribution

I planned and documented a combined set of unit, integration and system test cases. The catalogue was intentionally limited to clear, manageable scenarios covering core application behavior and the additional cases requested during review.

| Test Activity | Contribution | Outcome |
|---|---|---|
| Unit testing | Created 18 planned Vitest cases covering resilience calculations, RAG bands, provenance, freshness, momentum, bilingual parity, AI safety, community rollback, admin error handling and proof verification. | 18 passed |
| Integration testing | Created 12 planned cases covering ingestion, Resilience Index output, frontend data hooks, manifest verification, AI contracts, authentication/RLS, admin operations, news, community storage and deployment packaging. | 12 passed |
| System testing | Added and configured 40 Playwright scenarios covering the Dashboard, routes, territory selection, authentication, AI, uploads, admin news, accessibility and browser navigation. | 19 automated passes and 21 manually verified passes |
| Test debugging | Investigated genuine failures separately from test-environment skips and corrected incorrect test assumptions. | 0 failed in the completed 70-case catalogue |
| Test reporting | Prepared planned-test documentation, gap analysis, completion results and the final evidence summary. | All 70 cases documented as passed |

## 4. Wave 3 Feature Contributions

The following Wave 3 contributions are supported by the `wave 3 front-end changes` commit and its status document.

| Ticket | Contribution | Main Outcome |
|---|---|---|
| BT-25 | Developed plural-aware English/Malay parity testing. | Protected bilingual content from genuine missing keys without creating false failures. |
| BT-24 | Added the project positioning tagline to the authentication and About interfaces. | Improved consistency of the project message. |
| BT-14 | Connected unmatched Dashboard searches to BorneoBot with question prefill. | Helped users continue from data search to guided AI assistance. |
| BT-12 | Made HexRadar axes interactive and keyboard accessible and added pillar drill-down. | Allowed users to inspect the indicators behind each True Wealth pillar. |
| BT-22 | Developed the reusable What/Where/Why/What Next AnswerStrip for the Dashboard. | Converted data presentation into a concise decision-support flow. |
| BT-23 | Extended AnswerStrip to Regional Detail, ESG and SDG pages. | Produced consistent decision framing across the application. |
| BT-26 | Added tests for headline data, pillar resolution, radar interaction and weakest-territory logic. | Reduced regression risk for the new Wave 3 behavior. |

## 5. Other Major Project Contributions

| Area | My Contribution | Project Value |
|---|---|---|
| Dashboard and navigation | Developed and refined Dashboard panels, map layout, sidebar, header navigation, profile access and regional presentation. | Improved usability of the main monitoring interface. |
| Authentication interface | Created login, logout, registration, forgot-password and reset-password pages. | Provided the user-facing account workflow required by the system. |
| Community module | Developed the community feed, post form, comments, filters, post cards and community service layer. | Added a space for citizen discussion and participation. |
| Admin interface | Developed the user-management interface and refined admin navigation and news-review presentation. | Supported administrative account and content workflows. |
| Export and reporting | Created CSV/PNG export controls and the PDF report-generation feature, then corrected a report-generation defect. | Allowed users to use Dashboard findings outside the application. |
| Theme and accessibility | Added dark/light mode and improved responsive controls, keyboard interaction and readable interface states. | Made the application more usable in different viewing conditions. |
| Internationalization | Introduced the English/Malay language framework, switcher and translated interface content. | Made the system usable for a broader Borneo audience. |
| Impact Simulator | Implemented the deterministic scenario model, simulator interface, RAG result presentation, data model and supporting tests. | Added the project’s main decision-support differentiator without presenting the output as a forecast. |
| Quality assurance | Added Wave 3 component tests, planned unit/integration/system suites, Playwright setup and test-result documentation. | Supplied structured evidence that the implemented features behaved as expected. |

## 6. Contribution Evidence

| Commit | Date | Evidence |
|---|---|---|
| `776a2e5` | 2026-07-06 | SDG interface, Dashboard panel, profile/header/sidebar refinements |
| `7f51608`, `4643ab4` | 2026-07-10 | Map sizing and resize-control fixes |
| `6500beb` | 2026-07-12 | Login, registration and password-recovery interfaces |
| `dcc23c3`, `d4c96eb` | 2026-07-12 | Export controls and PDF report generation |
| `48cdff3`, `f3f6abc` | 2026-07-14 to 2026-07-15 | Theme implementation and report-generation correction |
| `357c732` | 2026-07-16 | Sidebar, admin user interface and theme correction |
| `5131ad7` | 2026-07-17 | English/Malay language preference system |
| `99a6f4a` | 2026-08-07 | Impact Simulator implementation and supporting contracts/tests |
| `b5ef476` | 2026-08-23 | Wave 3 front-end features and tests |
| `59c37d2` | 2026-09-04 | Planned testing documents, Vitest suites and Playwright system suite |
| `3239016` | 2026-09-04 | Windows path and Playwright assertion corrections; execution report |
| `f00e6ef` | 2026-09-04 | Plural-aware correction for planned UT-012 |

## 7. Final Contribution Statement

My work helped transform Borneo Tracker from a collection of data pages into a more complete decision-support application. I contributed the user-facing authentication and community workflows, exports and reports, bilingual and theme support, the Impact Simulator, and multiple Wave 3 features that explain what the data means and what users can do next. I also planned, implemented and documented the final unit, integration and system testing activity, investigated failed or skipped cases, corrected defects in the test implementation, and manually verified the staging-dependent scenarios.

The strongest contribution to the ABCDE Framework was the combination of **A (AI-assisted interaction), D (clear data presentation) and E (honest scoring, provenance, translation parity and test evidence)**. These changes improved the usefulness of Borneo Tracker for users reviewing resilience, ESG, SDG and True Wealth information.

## 8. Reporting Note

This document uses repository history for commit-backed contributions and the contributor's 2026-09-05 confirmation for manual test results. The seven manual-testing corrections should be accompanied by screenshots, test dates or deployment references in the final submitted report wherever available.
