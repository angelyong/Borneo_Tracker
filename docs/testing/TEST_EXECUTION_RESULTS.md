# Borneo Tracker Test Execution Results

**Report date:** 2026-09-05  
**Test catalogue:** 70 cases from the `testing` branch  
**Automated execution date:** 2026-09-04  
**Result source:** Existing Vitest result cache and Playwright HTML/run report; no tests were rerun while preparing this document.

## 1. Status Convention

| Status | Meaning |
|---|---|
| Pass | The automated test executed successfully and evidence was recorded. |
| Pass* | Included as a manual pass at the user's request, but the Playwright run skipped it and manual evidence has not yet been recorded. |

> **Evidence note:** `Pass*` is provisional. After manually executing the case, replace the pending actual result with the observed result and remove the asterisk. It must not be presented as an automated pass.

## 2. Result Summary

| Test Type | Total | Automated Pass | Manual Pass* | Failed |
|---|---:|---:|---:|---:|
| Unit Testing | 18 | 18 | 0 | 0 |
| Integration Testing | 12 | 12 | 0 | 0 |
| System Testing | 40 | 19 | 21 | 0 |
| **Overall** | **70** | **49** | **21** | **0** |

The recorded Playwright run reported **19 passed, 21 skipped, 0 failed**. The 21 skipped cases appear below as `Pass*` so they remain visibly separate from evidence-backed automated passes.

## 3. Unit Test Results

| ID | Test Case | Completed Result | Status |
|---|---|---|---|
| UT-001 | Calculate a territory index from six valid pillar scores | Correct territory average was returned. | Pass |
| UT-002 | Score a lower-is-better indicator | Lower values produced the correct higher score. | Pass |
| UT-003 | Clamp values outside the target range | Calculated scores remained within 0–100. | Pass |
| UT-004 | Handle an unscored pillar | Missing data remained missing and was not imputed. | Pass |
| UT-005 | Assign RAG bands at boundary values | Expected Red, Amber and Green bands were returned. | Pass |
| UT-006 | Exclude inactive poverty and unemployment targets | Inactive bounds were not treated as official targets. | Pass |
| UT-007 | Compare indicators with different units | Incompatible ranking was blocked. | Pass |
| UT-008 | Preserve geographic data-level labels | National, regional, district, proxy and satellite labels were preserved. | Pass |
| UT-009 | Handle incomplete provenance | Missing source information was not manufactured. | Pass |
| UT-010 | Classify data freshness | Current, stale and very stale dates received the expected classifications. | Pass |
| UT-011 | Handle a methodology break in momentum | Misleading movement was not calculated across the methodology change. | Pass |
| UT-012 | Compare English and Malay translation roots | Plural-aware translation roots were present in both languages. | Pass |
| UT-013 | Route AI question intents | Dashboard, news, knowledge and simulation questions were routed correctly. | Pass |
| UT-014 | Validate an AI answer containing an unapproved number | Unsafe output was rejected and the safe fallback path was used. | Pass |
| UT-015 | Repeat an Impact Simulator scenario | Repeated identical input produced the same deterministic result. | Pass |
| UT-016 | Roll back a failed community save | Earlier attachment work was rolled back after the later save failed. | Pass |
| UT-017 | Handle an admin-service database error | The error was reported without showing false success. | Pass |
| UT-018 | Verify correct and modified proof artifacts | The committed manifest passed and the modified descriptor was rejected. | Pass |

## 4. Integration Test Results

| ID | Test Case | Completed Result | Status |
|---|---|---|---|
| IT-001 | Ingestion output to standard schema | Source records produced valid standard-schema output. | Pass |
| IT-002 | Standard data to Resilience Index export | Exported territory results matched the committed methodology. | Pass |
| IT-003 | Published JSON to frontend helpers | Published indicator data was loaded and selected correctly. | Pass |
| IT-004 | Manifest, provenance and anchor verification | Matching artifacts were accepted and mismatches were rejected. | Pass |
| IT-005 | AI internal request pipeline | Routing, entity resolution, simulation parsing and safe answer building connected correctly. | Pass |
| IT-006 | Frontend chat to Edge Function contract | The frontend produced the configured endpoint request and normalized response contract. | Pass |
| IT-007 | AI quota and telemetry database contracts | Quota and telemetry operations remained consistent with the database contract. | Pass |
| IT-008 | Supabase authentication to profile and RLS | Identity, profile role, suspension and access contracts connected correctly. | Pass |
| IT-009 | Admin suspension and reactivation service boundary | Status updates were persisted through the service boundary. | Pass |
| IT-010 | Admin news review to public status model | News review actions produced the expected public status behavior. | Pass |
| IT-011 | Community metadata and attachment storage | Post metadata and attachment state remained consistent. | Pass |
| IT-012 | Vite source files to deployment package | Required deployment source files were present. | Pass |

## 5. Automated System Test Results

| ID | Test Case | Completed Result | Status |
|---|---|---|---|
| ST-001 | Open Dashboard | Dashboard, map and resilience information loaded. | Pass |
| ST-002 | Open main routes directly | Main routes loaded without an unexpected 404. | Pass |
| ST-003 | Change territory | Dashboard information changed for each selected territory. | Pass |
| ST-004 | District drill-down | Supported district data and source labels remained visible. | Pass |
| ST-005 | View ESG indicators | ESG indicator cards, values and sources were displayed. | Pass |
| ST-006 | View SDG progress | SDG mappings were displayed without an invented composite score. | Pass |
| ST-007 | View data source and proof | Provenance, source, confidence, date and verification details were visible. | Pass |
| ST-008 | Switch language | Malay text loaded and the displayed data value remained unchanged after reload. | Pass |
| ST-009 | Use Impact Simulator | The scenario produced a deterministic result with the illustrative notice. | Pass |
| ST-010 | Read news | The news list and selected article loaded correctly. | Pass |
| ST-011 | Create and delete a community post | The post survived reload and was deleted by its owner. | Pass |
| ST-012 | Generate a report | A non-empty PDF report was downloaded. | Pass |
| ST-023 | Mobile layout | Essential Dashboard content and navigation remained usable at mobile size. | Pass |
| ST-024 | Keyboard accessibility | BorneoBot opened by keyboard, accepted focus and restored focus after Escape. | Pass |
| ST-025 | Network/API unavailable | A safe error or retry state appeared without invented data. | Pass |
| ST-033 | Invalid attachment type | The disallowed file was rejected before upload. | Pass |
| ST-034 | Oversized attachment | The file above the 8 MB limit was rejected. | Pass |
| ST-039 | Browser refresh | The selected route and page content survived refresh. | Pass |
| ST-040 | Browser back and forward | Back and Forward restored the correct routes and pages. | Pass |

## 6. Manual System Test Results

These cases were skipped by Playwright because an approved staging URL, account fixtures or case-specific environment variables were unavailable. They are marked `Pass*` as requested, with manual evidence still pending.

| ID | Manual Test Case | Result to Confirm Manually | Recorded Result | Status |
|---|---|---|---|---|
| ST-013 | Register a new staging user | Account is created and verification guidance appears. | Manual execution evidence pending. | Pass* |
| ST-014 | Login with valid credentials | User signs in and reaches authorised content. | Manual execution evidence pending. | Pass* |
| ST-015 | Login with an incorrect password | Login is rejected with a safe error message. | Manual execution evidence pending. | Pass* |
| ST-016 | Reset password | New password works and the old password is rejected. | Manual execution evidence pending. | Pass* |
| ST-017 | Edit profile and reload | Updated profile details persist after reload. | Manual execution evidence pending. | Pass* |
| ST-018 | Sign in as a suspended user | Access is refused with a suspension message. | Manual execution evidence pending. | Pass* |
| ST-019 | Reactivate a suspended user | Access returns with the correct non-admin role. | Manual execution evidence pending. | Pass* |
| ST-020 | Protect admin pages by role | Admin is allowed and a normal user is refused. | Manual execution evidence pending. | Pass* |
| ST-021 | Ask BorneoBot a supported question | A grounded answer and safe sources are displayed. | Manual execution evidence pending. | Pass* |
| ST-022 | Trigger AI quota or service failure | A safe fallback appears without fabricated data. | Manual execution evidence pending. | Pass* |
| ST-026 | Attempt duplicate registration | Duplicate registration is rejected with an appropriate safe message. | Manual execution evidence pending. | Pass* |
| ST-027 | Submit empty required fields | Required-field messages appear and nothing is submitted. | Manual execution evidence pending. | Pass* |
| ST-028 | Submit invalid form values | Invalid values are rejected with clear feedback. | Manual execution evidence pending. | Pass* |
| ST-029 | Log out and open a protected page | Session ends and protected access is refused. | Manual execution evidence pending. | Pass* |
| ST-030 | Open a protected page with an expired session | Sign-in is requested and protected data remains hidden. | Manual execution evidence pending. | Pass* |
| ST-031 | Enter a password shorter than 12 characters | Password is rejected and the rule is explained. | Manual execution evidence pending. | Pass* |
| ST-032 | Enter an invalid recovery email | Email is rejected and the form is not submitted. | Manual execution evidence pending. | Pass* |
| ST-035 | Admin creates a news draft | The new draft appears with the entered information. | Manual execution evidence pending. | Pass* |
| ST-036 | Admin edits a news draft | Edited information remains after reload. | Manual execution evidence pending. | Pass* |
| ST-037 | Admin approves a news draft | The article becomes published and appears publicly. | Manual execution evidence pending. | Pass* |
| ST-038 | Admin rejects a news draft | The article becomes rejected and stays out of public news. | Manual execution evidence pending. | Pass* |

## 7. Manual Evidence Record

For each `Pass*` case, record at least the date, tester and short observed result. Screenshot or screen-recording references may also be added.

| Test Case ID | Test Date | Tester | Observed Result / Evidence | Final Status |
|---|---|---|---|---|
| ST-013 to ST-038 as applicable | — | — | Not yet recorded | Pending manual sign-off |

## 8. Final Statement

- **Automated evidence-backed result:** 49 passed, 0 failed.
- **Playwright staging result:** 21 skipped during automation.
- **Manual reporting status requested by the user:** 21 marked `Pass*`, awaiting manual evidence.
- **Fully verified project result:** Pending completion and documentation of the 21 manual cases.
