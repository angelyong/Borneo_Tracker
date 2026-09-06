# Personal Contribution Summary — Weeks 7 to 12

**Project:** Borneo Tracker  
**Contributor:** Angel Yap  
**GitHub username:** `angelyong`  
**Reporting period:** 25 June 2026 – 5 August 2026  
**Prepared:** 5 September 2026  

## Section D: Summary of My Contributions

The percentage is an evidence-based distribution of my **16 direct, non-merge commits** across Weeks 7–12. Merge and synchronization commits are excluded so imported team work is not counted as my personal implementation. The six percentages total 100%.

| Activity | My Contribution (%) | Evidence |
|---|---:|---|
| Week 7 | 6.25% | `ee1918d` — initial application pages, ESG interface, Overview Dashboard, Regional Detail, routing and sidebar |
| Week 8 | 6.25% | `776a2e5` — Dashboard, ESG, Regional Detail, routing and navigation refinements |
| Week 9 | 62.50% | `64b0002`, `7f51608`, `4643ab4`, `57fcba8`, `6500beb`, `dcc23c3`, `d4c96eb`, `bfbd331`, `48cdff3`, `f3f6abc` |
| Week 10 | 18.75% | `357c732`, `5982597`, `5131ad7` — admin tools, notifications and bilingual support |
| Week 11 | 0.00% | No direct commit authored by `angel` was found in the repository for 23–29 July 2026 |
| Week 12 | 6.25% | `c81e0a3` — dependency adjustment; `6f730c9` separately records branch integration work |
| **Total** | **100.00%** | **16 direct commits plus 3 merge/synchronization commits during Weeks 7–12** |

### Week 7 — 25 June to 1 July 2026

| Date | Work Completed | Evidence |
|---|---|---|
| 28 Jun 2026 | Added and reorganized the first major application pages and connected them through the main React application. | `ee1918d` |
| 28 Jun 2026 | Developed the initial ESG indicator interface. | `src/pages/ESG/esg_indicator.jsx` in `ee1918d` |
| 28 Jun 2026 | Developed the initial Overview Dashboard and Regional Detail interfaces. | `src/pages/dashboard/OverviewDashboard.jsx`, `Regional_Detail.jsx` in `ee1918d` |
| 28 Jun 2026 | Updated shared application styling and sidebar navigation. | `src/App.css`, `src/index.css`, `src/components/sidebar.jsx` in `ee1918d` |

**Week 7 outcome:** Established the main page structure needed to present Borneo ESG and regional data.

### Week 8 — 2 to 8 July 2026

| Date | Work Completed | Evidence |
|---|---|---|
| 6 Jul 2026 | Refined application routing and sidebar navigation. | `src/App.jsx`, `src/components/sidebar.jsx` in `776a2e5` |
| 6 Jul 2026 | Reworked the ESG indicator page layout. | `src/pages/ESG/esg_indicator.jsx` in `776a2e5` |
| 6 Jul 2026 | Modified the Overview Dashboard information panel and Regional Detail presentation. | Dashboard files in `776a2e5` |
| 6 Jul 2026 | Synchronized the branch with the latest team work from `master`. | Merge commit `55b7f6b` |

**Week 8 outcome:** Improved navigation and the presentation of Dashboard, ESG and territory information.

### Week 9 — 9 to 15 July 2026

| Date | Work Completed | Evidence |
|---|---|---|
| 9 Jul 2026 | Modified the Overview Dashboard map-layer panel and supporting layout. | `64b0002` |
| 10 Jul 2026 | Corrected Dashboard map sizing. | `7f51608` |
| 10 Jul 2026 | Corrected the map/panel resize-button behavior. | `4643ab4` |
| 12 Jul 2026 | Developed the Community module: page, new-post form, post cards, comments, filters, utilities, mock data and service layer. | `57fcba8` |
| 12 Jul 2026 | Developed login, registration, forgot-password and reset-password interfaces with a shared authentication layout. | `6500beb` |
| 12 Jul 2026 | Added PNG and CSV export controls for ESG and SDG information. | `dcc23c3` |
| 12 Jul 2026 | Developed the PDF report generator, report sections, PDF utility and navigation entry. | `d4c96eb`, `bfbd331` |
| 14 Jul 2026 | Developed dark/light mode and applied shared theme behavior across major pages and components. | `48cdff3` |
| 15 Jul 2026 | Corrected report-generation and report-section rendering defects. | `f3f6abc` |

**Week 9 outcome:** Expanded Borneo Tracker from a data-viewing interface into a broader application with community participation, authentication pages, exports, PDF reports and theme support.

### Week 10 — 16 to 22 July 2026

| Date | Work Completed | Evidence |
|---|---|---|
| 16 Jul 2026 | Developed and integrated the admin user-management page and its front-end service layer. | `src/pages/admin/UserManagement.jsx`, `src/services/adminUserService.js` in `357c732` |
| 16 Jul 2026 | Updated sidebar and admin navigation and refined admin-news and news-page styling. | `357c732` |
| 16 Jul 2026 | Added notification logic and connected notifications to the top bar, sidebar, community and news pages. | `src/utils/notifications.js` and related files in `5982597` |
| 17 Jul 2026 | Developed the language preference system and language switcher. | `src/i18n/index.js`, `src/components/LanguageSwitcher.jsx` in `5131ad7` |
| 17 Jul 2026 | Added and applied English and Malay translations across 38 application files. | `src/i18n/locales/en.json`, `src/i18n/locales/ms.json` and UI files in `5131ad7` |
| 17 Jul 2026 | Synchronized the completed language work with the latest `master` history. | Merge commit `1fc1d24` |

**Week 10 outcome:** Added administration, notifications and bilingual English/Malay access across the main application.

### Week 11 — 23 to 29 July 2026

No direct non-merge commit authored by `angel` was found for this date range. Therefore, the contribution percentage is recorded as 0% rather than inventing unverified development work.

Any meetings, research, design discussion, testing or documentation completed outside Git should only be added if separate evidence such as meeting notes, screenshots or task records is available.

### Week 12 — 30 July to 5 August 2026

| Date | Work Completed | Evidence |
|---|---|---|
| 5 Aug 2026 | Integrated the existing `origin/aichatbot` work into the `impactSimulator` branch to prepare combined AI and simulator development. | Merge commit `6f730c9` |
| 5 Aug 2026 | Adjusted project dependencies after the branch integration. | `package.json`, `package-lock.json` in `c81e0a3` |

**Week 12 outcome:** Prepared the `impactSimulator` branch to build on the existing AI-chat functionality. The main Impact Simulator implementation was committed on 7 August 2026, which falls in the following reporting week and is therefore not counted in this table.

## Section E: GitHub / GitLab Contributions

| Item | Details |
|---|---|
| GitHub/GitLab Username | `angelyong` |
| Repository URL | `https://github.com/angelyong/Borneo_Tracker.git` |
| Number of Commits | 19 authored commits during Weeks 7–12: 16 direct non-merge commits and 3 merge/synchronization commits |
| Pull Requests / Merge Requests | No Angel-authored PR/MR number could be verified from the local repository history for this period. Integration is evidenced by three merge/synchronization commits. |
| Branch / Module | `master`: pages, Dashboard, ESG, Regional Detail, Community, authentication interfaces, export/reporting, theme, admin, notifications and i18n. `impactSimulator`: AI-chat branch integration and dependency preparation. |

### Commit Evidence by Week

| Week | Direct Commits | Merge / Synchronization Commits |
|---|---|---|
| Week 7 | `ee1918d` | — |
| Week 8 | `776a2e5` | `55b7f6b` |
| Week 9 | `64b0002`, `7f51608`, `4643ab4`, `57fcba8`, `6500beb`, `dcc23c3`, `d4c96eb`, `bfbd331`, `48cdff3`, `f3f6abc` | — |
| Week 10 | `357c732`, `5982597`, `5131ad7` | `1fc1d24` |
| Week 11 | — | — |
| Week 12 | `c81e0a3` | `6f730c9` |

## Section F: Challenges Encountered

### Technical Challenges

| Challenge | How I Resolved It | Outcome |
|---|---|---|
| Different pages used inconsistent layouts and navigation patterns. | Updated routing, sidebar navigation and the affected data pages together. | The main application modules became easier to access and more visually consistent. |
| The Dashboard map did not fit the available area correctly. | Adjusted map sizing in the Overview Dashboard. | The map used the page space more effectively. |
| The map/panel resize control behaved incorrectly. | Corrected the resize state and layout behavior. | Users could resize the Dashboard sections more reliably. |
| Community functionality was too large to keep inside one page component. | Divided it into post, comment, filter and form components supported by shared utilities and a service layer. | The module became easier to maintain and extend. |
| The application did not have user-facing account-access and recovery pages. | Built login, registration, forgot-password and reset-password interfaces using a shared layout. | A consistent account journey was available for later backend integration. |
| ESG and SDG information could only be viewed on screen. | Developed reusable PNG/CSV export controls and export logic. | Users could download and reuse the displayed information. |
| The application needed a combined project report. | Developed reusable report sections and PDF-generation logic. | Users could generate a structured report from the application. |
| The first report implementation had rendering and section-layout defects. | Revised `GenerateReportPage.jsx` and `ReportSections.jsx`. | Report content rendered more reliably. |
| Dark and light styles were inconsistent across many pages. | Added shared theme state, theme utilities, a theme toggle and page-level style updates. | Major application pages responded consistently to theme selection. |
| Admin user actions required a reusable interface and service boundary. | Developed the user-management page and `adminUserService.js` abstraction. | Admin functions were separated from presentation logic. |
| Users needed awareness of new community or news activity. | Added shared notification logic and connected it to the top bar and related pages. | Notifications were available from common navigation areas. |
| Adding Malay support affected many existing pages and components. | Introduced a central i18n configuration, language switcher and paired English/Malay locale files. | Users could change language across the main application. |
| Concurrent team development required keeping branch work synchronized. | Used merge/synchronization commits and adjusted dependencies after combining branches. | My work remained compatible with the team’s evolving repository. |
| Week 11 had no code commit under my Git author identity. | Recorded the period honestly and identified non-code evidence that could be attached if available. | The report avoids unsupported contribution claims. |

### Communication and Project-Management Challenges

- Multiple team members were modifying shared files such as `App.jsx`, the Dashboard and navigation components. I synchronized with `master` before continuing dependent work.
- Large features were separated into reusable components and utilities so other team members could integrate or refine them without rewriting the entire page.
- The AI chatbot and future Impact Simulator were developed on different branches. I merged the AI-chat branch into `impactSimulator` before beginning the combined implementation.
- Some contribution evidence existed only in Git history. I used commit hashes and changed-file lists to make the work traceable.

## Evidence Attached

### Source Code

- `src/App.jsx`
- `src/components/sidebar.jsx`
- `src/pages/ESG/esg_indicator.jsx`
- `src/pages/dashboard/OverviewDashboard.jsx`
- `src/pages/dashboard/Regional_Detail.jsx`
- `src/pages/community/`
- `src/services/communityService.js`
- `src/pages/auth/`
- `src/components/ExportMenu.jsx`
- `src/utils/exportReport.js`
- `src/pages/reports/`
- `src/utils/pdfReport.js`
- `src/components/ThemeToggle.jsx`
- `src/theme.css`
- `src/theme.js`
- `src/pages/admin/UserManagement.jsx`
- `src/services/adminUserService.js`
- `src/utils/notifications.js`
- `src/i18n/`

### Screenshots to Attach

- Overview Dashboard, map and resize control.
- ESG and Regional Detail pages.
- Community page, post form and comments.
- Login, registration and password-reset pages.
- PNG/CSV export menu and generated files.
- PDF report page and generated report.
- Dark and light theme comparison.
- Admin user-management page.
- Notification display.
- English and Malay interface comparison.

### Commit-History Verification

```powershell
git log --all --author="angel" --since="2026-06-25" --until="2026-08-05 23:59:59" --oneline
git show --stat ee1918d
git show --stat 776a2e5
git show --stat 57fcba8
git show --stat 5131ad7
git show --stat c81e0a3
```

## Evidence and Percentage Note

- Commit counts are based on unique commits reachable from all local branches.
- Automated bot commits were excluded.
- Merge commits were listed as integration evidence but excluded from the percentage calculation.
- Percentages show the distribution of my documented direct commits across Weeks 7–12; they do not claim a percentage of the entire team’s effort.
- No tests were run and no application code was modified while preparing this document.
