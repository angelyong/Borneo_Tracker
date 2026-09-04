# Borneo Tracker Planned Test Cases

**Prepared:** 2026-09-04  
**Status:** Planning only — no tests have been run for this catalogue  
**Rule:** Do not mark a case Pass or Fail until it is actually executed and evidence is recorded.

## 1. Test Summary

| Test Type | Planned Test Cases | Passed | Failed | Not Run |
|---|---:|---:|---:|---:|
| Unit Testing | 18 | 0 | 0 | 18 |
| Integration Testing | 12 | 0 | 0 | 12 |
| System Testing (Playwright) | 40 | 0 | 0 | 40 |
| **Total** | **70** | **0** | **0** | **70** |

## 2. Unit Test Cases

Unit tests will use the existing Vitest and Python unittest setup. Each test checks one small function, component or rule without using the live production system.

| Test Case ID | Component | Scenario / Test Data | Expected Result | Actual Result | Status |
|---|---|---|---|---|---|
| UT-001 | Resilience calculation | Calculate a territory score from six valid pillar scores | Correct average score is returned | — | Not Run |
| UT-002 | Resilience calculation | Calculate a lower-is-better indicator | Lower indicator value produces the correct higher score | — | Not Run |
| UT-003 | Resilience calculation | Give values below or above the allowed target range | Score stays within 0–100 | — | Not Run |
| UT-004 | Resilience calculation | One or more pillar scores are missing | Missing score is shown honestly; no complete score is invented | — | Not Run |
| UT-005 | RAG band | Test values at Red, Amber and Green boundaries | Correct RAG label and colour are returned | — | Not Run |
| UT-006 | Target-gap logic | Poverty or unemployment bound is inactive | Inactive bound is not presented as an official target | — | Not Run |
| UT-007 | Comparability | Compare indicator values with different units | Comparison is blocked or clearly marked incompatible | — | Not Run |
| UT-008 | Geographic level | Use national, state, province, district, proxy and satellite rows | Correct `data_level` label is preserved | — | Not Run |
| UT-009 | Provenance | Source, publisher or confidence is missing | Missing information remains missing and is not invented | — | Not Run |
| UT-010 | Data freshness | Test current, ageing and stale dates | Correct freshness status is returned | — | Not Run |
| UT-011 | Momentum | Methodology version changes between two periods | Misleading score movement is not displayed | — | Not Run |
| UT-012 | Language parity | Compare English and Malay translation keys | Required keys exist in both languages | — | Not Run |
| UT-013 | AI intent routing | Submit dashboard, news, knowledge and simulation questions | Each question is routed to the correct intent | — | Not Run |
| UT-014 | AI response validation | AI response contains an unapproved number | Unsafe answer is rejected and safe fallback is used | — | Not Run |
| UT-015 | Impact Simulator | Run the same valid scenario twice | Both runs return the same deterministic result | — | Not Run |
| UT-016 | Community service | Attachment upload or metadata save fails | Earlier saved data is rolled back safely | — | Not Run |
| UT-017 | Admin service | Database request fails during an admin action | Error is reported and false success is not shown | — | Not Run |
| UT-018 | Manifest and proof | Verify correct and modified artifact hashes | Correct file passes; modified file fails verification | — | Not Run |

## 3. Integration Test Cases

Integration tests check whether connected modules exchange the correct data. Live external services will be tested only in an approved staging environment.

| Test Case ID | Integration / Interface | Method or Flow | Description | Expected Result | Actual Result | Status |
|---|---|---|---|---|---|---|
| IT-001 | Ingestion → standard schema | Source data → CSV/records | Convert source records into the standard dataset fields | Valid standard-schema rows are produced | — | Not Run |
| IT-002 | Standard data → Resilience Index | Records → calculation → JSON | Build pillar and territory resilience results | Generated scores match the methodology | — | Not Run |
| IT-003 | Published JSON → frontend | HTTP GET / data hooks | Load indicators, resilience, districts and history | Frontend receives and displays valid artifact data | — | Not Run |
| IT-004 | Manifest → provenance → anchor | Hash and verification flow | Verify that published data and proof files belong together | Tampered or mismatched artifacts are rejected | — | Not Run |
| IT-005 | AI internal pipeline | POST request flow | Connect routing, entities, comparison, facts and answer builder | Safe structured answer is produced | — | Not Run |
| IT-006 | Frontend chat → Edge Function | POST / OPTIONS | Send chat request and handle CORS/response contract | Request and normalized response work correctly | — | Not Run |
| IT-007 | AI function → quota/telemetry | Supabase RPC/write | Reserve quota, record result and refund failed calls | Usage and events are recorded correctly | — | Not Run |
| IT-008 | Supabase Auth → profile/RLS | Login/session/database read | Connect authenticated identity to profile and role | Correct user role and access are returned | — | Not Run |
| IT-009 | Admin user action → database | Profile status update | Suspend and reactivate a test account | Status persists after a new database read | — | Not Run |
| IT-010 | News service → Supabase | GET/POST/update | Load published news and save approved admin changes | Only allowed news data is returned or changed | — | Not Run |
| IT-011 | Community service → storage | Metadata + attachment flow | Create and delete a post with an attachment | Metadata and file stay consistent | — | Not Run |
| IT-012 | Build → deployment package | Vite build → `dist` | Package app routes, data and server rules together | Required deployment files are present | — | Not Run |

## 4. System Test Cases (Planned for Playwright)

System tests use a real browser and check the application as a user sees it. The steps are intentionally short. Tests involving email, Supabase or AI will use approved test accounts and staging configuration.

| Test Case ID | Scenario | Preconditions / Test Data | Simple Test Steps | Expected Result | Actual Result | Status |
|---|---|---|---|---|---|---|
| ST-001 | Open Dashboard | Application is available | Open `/` | Dashboard loads with map and resilience information | — | Not Run |
| ST-002 | Open application routes directly | Application is available | Open main routes such as `/regions`, `/esg`, `/sdg` and `/news` | Each route loads the correct page without 404 | — | Not Run |
| ST-003 | Change territory | Dashboard is open | Select Sabah, Sarawak, Brunei and Kalimantan | Dashboard information changes to the selected territory | — | Not Run |
| ST-004 | District drill-down | Regional page is open | Select a supported district | Available district data and source labels are shown | — | Not Run |
| ST-005 | View ESG indicators | ESG data is available | Open `/esg` and view indicator cards | Correct ESG indicators and values are displayed | — | Not Run |
| ST-006 | View SDG progress | SDG data is available | Open `/sdg` and view mapped indicators | Correct SDG mappings are displayed without an invented composite score | — | Not Run |
| ST-007 | View data source and proof | Published artifacts are available | Open `/data-sources` and the provenance information | Source, confidence, date and verification information are visible | — | Not Run |
| ST-008 | Switch language | English page is open | Switch to Malay and reload | Text changes language while data values remain the same | — | Not Run |
| ST-009 | Use Impact Simulator | Valid territory and scenario | Open `/simulator`, enter a simple scenario and submit | Deterministic result and “illustrative” notice are shown | — | Not Run |
| ST-010 | Read news | Published news exists | Open news list and one article | News list and article detail load correctly | — | Not Run |
| ST-011 | Create community post | Active test user is signed in | Open `/community`, create and then delete a test post | Post persists after reload and can be deleted by its owner | — | Not Run |
| ST-012 | Generate report | Report page and data are available | Open `/reports` and generate one report | A non-empty report file is downloaded | — | Not Run |
| ST-013 | Register user | New staging email account | Open `/register` and submit valid details | Account is created and verification guidance is shown | — | Not Run |
| ST-014 | Login with valid credentials | Active test user exists | Open `/login` and enter correct credentials | User signs in and reaches authorised content | — | Not Run |
| ST-015 | Login with invalid credentials | Test username/email exists | Open `/login` and enter an incorrect password | Login is rejected and a safe error is shown | — | Not Run |
| ST-016 | Reset password | Active test email exists | Request reset, open test email link and set a new password | New password works and old password is rejected | — | Not Run |
| ST-017 | Edit profile | Active test user is signed in | Change profile details and reload | Updated details remain after reload | — | Not Run |
| ST-018 | Block suspended user | Suspended test user exists | Sign in using a new browser context | Access is refused with a suspension message | — | Not Run |
| ST-019 | Reactivate user | Suspended user and admin exist | Reactivate user, then sign in again | User access returns with the correct non-admin role | — | Not Run |
| ST-020 | Protect admin pages | Normal user and admin accounts exist | Open `/admin/users` and `/admin/news` with each role | Admin is allowed; normal user is refused | — | Not Run |
| ST-021 | Ask BorneoBot a supported question | AI endpoint is configured | Open chat and submit one approved question | Grounded answer and safe sources are displayed | — | Not Run |
| ST-022 | AI quota or service failure | Test account is at limit or service is unavailable | Submit a chat question | Safe quota/fallback message is shown without fake data | — | Not Run |
| ST-023 | Mobile layout | Mobile browser viewport | Open Dashboard and main navigation | Essential content and navigation remain usable | — | Not Run |
| ST-024 | Keyboard accessibility | Desktop browser | Navigate key controls with keyboard and close a dialog with Escape | Focus and controls behave correctly | — | Not Run |
| ST-025 | Network/API unavailable | Test environment can simulate an unavailable API | Open a page that requests data | Safe error or retry message is shown without invented data | — | Not Run |
| ST-026 | Duplicate registration | A test account already exists | Register again with the same email | Registration is rejected with a clear message | — | Not Run |
| ST-027 | Empty form fields | Registration, login or profile form is open | Submit the form without required values | Required-field messages are shown and nothing is submitted | — | Not Run |
| ST-028 | Invalid form fields | A form is open | Enter invalid values and submit | Invalid values are rejected with clear messages | — | Not Run |
| ST-029 | Logout | Active test user is signed in | Select Logout and open a protected page | Session ends and protected page access is refused | — | Not Run |
| ST-030 | Expired session | Test user has an expired session | Reload or open a protected page | User is asked to sign in again and protected data is not shown | — | Not Run |
| ST-031 | Password validation | Registration or reset form is open | Enter a password that does not meet the rules | Password is rejected and the rule is explained | — | Not Run |
| ST-032 | Email validation | Registration or recovery form is open | Enter an invalid email address | Email is rejected and the form is not submitted | — | Not Run |
| ST-033 | Invalid attachment type | Active user is on the community upload form | Select a disallowed file type | File is rejected and no post is uploaded | — | Not Run |
| ST-034 | Oversized attachment | Active user is on the community upload form | Select a file larger than the allowed limit | File is rejected with a size-limit message | — | Not Run |
| ST-035 | Admin creates news | Admin test user is signed in | Open `/admin/news` and create a draft article | New draft appears with the entered information | — | Not Run |
| ST-036 | Admin edits news | A draft article exists | Edit the article and save changes | Updated information remains after reload | — | Not Run |
| ST-037 | Admin approves news | A reviewable draft exists | Approve the article | Article status changes to approved/published as designed | — | Not Run |
| ST-038 | Admin rejects news | A reviewable draft exists | Reject the article | Article status changes to rejected and it is not publicly published | — | Not Run |
| ST-039 | Browser refresh | User is viewing a selected page/state | Refresh the browser | Page reloads correctly without an unexpected error | — | Not Run |
| ST-040 | Browser back and forward | User has visited several application pages | Use browser Back and Forward | Correct pages and routes are restored | — | Not Run |

## 5. Planned Execution Order

| Order | Test Stage | Start Condition | Current Status |
|---:|---|---|---|
| 1 | Unit tests | User approves test execution | On Hold |
| 2 | Integration tests | Unit-test defects are reviewed | On Hold |
| 3 | Local Playwright system tests | Playwright setup is approved | On Hold |
| 4 | Staging Playwright system tests | Test accounts, Supabase and secrets are ready | On Hold |
| 5 | Final manual checks | Automated results are reviewed | On Hold |

## 6. Tools and Packages

| Test Type | Planned Tool | Preparation Status |
|---|---|---|
| JavaScript unit/integration | Vitest | Already present |
| Python unit/integration | Python `unittest` | CI configuration already present; local Python command must be confirmed |
| Browser system testing | Playwright (`@playwright/test`) | Not installed/configured by this plan |
| Staging integration | Dedicated Supabase test project/accounts | Not prepared |

No package installation, code modification or test execution is performed as part of this document.
