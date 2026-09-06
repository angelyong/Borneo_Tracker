# Personal Work Report — Week 8 and Week 9

**Project:** Borneo Tracker  
**Contributor:** Angel Yap  
**Week 8:** 2–8 July 2026  
**Week 9:** 9–15 July 2026  
**Prepared:** 5 September 2026  

## Week 8 — 2 to 8 July 2026

### 1. Modules / Features Personally Developed

| Date | Module / Feature | Work Completed | Outcome |
|---|---|---|---|
| 6 Jul 2026 | Application routing | Updated `App.jsx` to connect the developed pages with the application navigation flow. | Users could access the relevant Dashboard and data pages through the application. |
| 6 Jul 2026 | Sidebar navigation | Modified the sidebar structure and page links. | Main modules became easier to access from a consistent navigation area. |
| 6 Jul 2026 | ESG indicator interface | Developed and reorganized the ESG indicator page layout. | ESG values and categories were presented in a clearer user interface. |
| 6 Jul 2026 | Overview Dashboard panel | Modified the main Dashboard information panel and its layout. | The Dashboard presented Borneo information in a more structured view. |
| 6 Jul 2026 | Regional Detail interface | Updated the Regional Detail page layout and content presentation. | Users could inspect territory-level information more clearly. |

### 2. Backend, Database, API or Business-Logic Work Completed

Week 8 mainly involved front-end integration and interface development. The commits from this week do not show a personally authored backend API, database schema or migration.

The main logic contribution was connecting page routes, navigation state and territory/data presentation across the Overview, ESG and Regional Detail interfaces.

### 3. GitHub / Branch Contributions

| Commit | Date | Contribution |
|---|---|---|
| `776a2e5` | 6 Jul 2026 | Updated five application files covering routing, sidebar navigation, ESG, Overview Dashboard and Regional Detail. Git recorded 1,160 insertions and 1,247 deletions. |
| `55b7f6b` | 6 Jul 2026 | Synchronized the working branch with the latest `master` history through a merge commit. |

### 4. Problems Encountered and Resolution

| Problem Encountered | Resolution | Result |
|---|---|---|
| The main pages had different layouts and navigation patterns. | Reorganized shared routing and sidebar access while updating the affected pages together. | Overview, ESG and Regional Detail used a more consistent application structure. |
| Dashboard and regional information had to fit large amounts of data into limited screen space. | Reworked the information-panel layout and regional presentation. | Data became easier to scan without requiring separate disconnected pages. |
| Changes had to be synchronized with ongoing work on `master`. | Merged the latest `master` history after the interface update. | The contribution remained compatible with the team’s latest code at that time. |

### 5. Evidence Attached

#### Source Code

- `src/App.jsx`
- `src/components/sidebar.jsx`
- `src/pages/ESG/esg_indicator.jsx`
- `src/pages/dashboard/OverviewDashboard.jsx`
- `src/pages/dashboard/Regional_Detail.jsx`

#### Commit History

```text
776a2e5  2026-07-06  SDG page UI / Overview panel / navigation modifications
55b7f6b  2026-07-06  Merge latest master history
```

#### Suggested Screenshots

- Overview Dashboard and information panel.
- ESG indicator page.
- Regional Detail page.
- Sidebar navigation showing the available modules.

### Week 8 Summary

During Week 8, I focused on improving the structure of the Borneo Tracker front end. I connected application routes, refined the sidebar and updated the ESG, Overview Dashboard and Regional Detail interfaces. This work strengthened the **D — Data** layer of the ABCDE Framework by making territory and sustainability information easier for users to access and understand.

---

## Week 9 — 9 to 15 July 2026

### 1. Modules / Features Personally Developed

| Date | Module / Feature | Work Completed | Outcome |
|---|---|---|---|
| 9 Jul 2026 | Overview Dashboard layer panel | Modified the map-layer panel and supporting Dashboard layout. | Map controls and information were organized more clearly. |
| 10 Jul 2026 | Map sizing | Corrected the size of the Dashboard map. | The map fitted the available layout more appropriately. |
| 10 Jul 2026 | Resize controls | Corrected the behavior of the Dashboard resize button. | Users could resize the map and information panel more reliably. |
| 12 Jul 2026 | Community module | Developed the community feed, mock post data, new-post form, post cards, comments, filters and community service layer. | Users could create, browse, filter and discuss community posts through the interface. |
| 12 Jul 2026 | Authentication interfaces | Developed login, registration, forgot-password and reset-password pages together with the shared authentication layout. | The application gained the user-facing pages required for account access and recovery. |
| 12 Jul 2026 | ESG/SDG export menu | Developed export controls for downloading data in PNG and CSV formats. | Users could reuse ESG and SDG information outside the application. |
| 12 Jul 2026 | PDF report generation | Developed the report page, report sections and PDF-generation utility. | Users could generate a structured Borneo Tracker report. |
| 12 Jul 2026 | Report navigation | Connected the report feature to `App.jsx` and sidebar navigation. | The report generator became accessible as an application module. |
| 14 Jul 2026 | Dark and light themes | Developed the theme toggle, theme utilities and shared theme styles, then applied them across the main pages and components. | Users could switch between dark and light viewing modes. |
| 15 Jul 2026 | Report-generation correction | Corrected defects in the report page and report-section output. | Generated reports rendered their content more reliably. |

### 2. Backend, Database, API or Business-Logic Work Completed

| Area | Work Completed | Outcome |
|---|---|---|
| Community service logic | Added a front-end service abstraction and mock community data for post listing, creation, filtering and interaction. | Community components used a shared data-access layer instead of embedding all behavior in the page. |
| Community utility logic | Added reusable filtering and formatting logic for community posts. | Search and category filters behaved consistently. |
| Export logic | Added the `exportReport.js` utility to prepare PNG and CSV downloads from ESG and SDG pages. | Export behavior was reusable across both sustainability views. |
| PDF report logic | Added `pdfReport.js` and reusable report sections to construct downloadable reports. | Report generation was separated from the page interface. |
| Theme state logic | Added theme utilities and shared theme configuration. | Theme preference could be applied consistently across components. |
| Authentication page flow | Connected account forms and navigation for login, registration and password recovery. | The application had a complete front-end account journey ready for backend authentication integration. |

No personally authored database schema, migration or external API integration was recorded in Week 9. The account and community work in these commits was primarily front-end and local service logic.

### 3. GitHub / Branch Contributions

| Commit | Date | Contribution |
|---|---|---|
| `64b0002` | 9 Jul 2026 | Modified the Overview Dashboard layer panel and layout. |
| `7f51608` | 10 Jul 2026 | Corrected the Dashboard map size. |
| `4643ab4` | 10 Jul 2026 | Corrected resize-button behavior. |
| `57fcba8` | 12 Jul 2026 | Added the community interface, post components, mock data, utilities and service layer. |
| `6500beb` | 12 Jul 2026 | Added login, registration, forgot-password and reset-password interfaces. |
| `dcc23c3` | 12 Jul 2026 | Added the PNG/CSV export menu and export utility to ESG and SDG pages. |
| `d4c96eb` | 12 Jul 2026 | Added the report generator, reusable report sections, PDF utility and application navigation. |
| `bfbd331` | 12 Jul 2026 | Made a follow-up application-route adjustment. |
| `48cdff3` | 14 Jul 2026 | Added dark/light mode and applied theme support across 22 files. |
| `f3f6abc` | 15 Jul 2026 | Corrected the generated-report page and report-section implementation. |

These contributions were made in the main project history and affected the Dashboard, community, authentication, export, reporting and theme modules.

### 4. Problems Encountered and Resolution

| Problem Encountered | Resolution | Result |
|---|---|---|
| The map did not fit its Dashboard area correctly. | Adjusted map sizing rules in `OverviewDashboard.jsx`. | The map used the available space more effectively. |
| The resize control did not resize the map and information area reliably. | Corrected the resize-button state and layout behavior. | Resizing became more stable and predictable. |
| Community functionality was spread across page-level ideas without reusable components. | Separated the module into post cards, comments, filters, a new-post form, utilities, mock data and a service layer. | The community module became easier to maintain and extend. |
| The application did not have a complete user-facing account journey. | Added login, registration, forgot-password and reset-password pages using a shared authentication layout. | Users could follow a consistent account-access and recovery flow. |
| ESG and SDG data could only be viewed inside the application. | Added a shared export menu and PNG/CSV export logic. | Users could download and reuse displayed information. |
| Users could not create a combined downloadable project report. | Added a report page, reusable report sections and PDF-generation logic. | The application could produce a structured PDF report. |
| The first report-generation implementation had rendering and section-layout defects. | Revised `GenerateReportPage.jsx` and `ReportSections.jsx`. | Report content rendered more reliably. |
| Dark and light styling was inconsistent across components. | Added shared theme state, a theme toggle and application-wide style updates. | Major pages and controls responded consistently to theme changes. |

### 5. Evidence Attached

#### Source Code

- `src/pages/dashboard/OverviewDashboard.jsx`
- `src/pages/community/CommunityPage.jsx`
- `src/pages/community/NewPostForm.jsx`
- `src/pages/community/PostCard.jsx`
- `src/pages/community/CommentThread.jsx`
- `src/pages/community/CommunityFilters.jsx`
- `src/services/communityService.js`
- `src/pages/auth/LoginPage.jsx`
- `src/pages/auth/RegisterPage.jsx`
- `src/pages/auth/ForgotPasswordPage.jsx`
- `src/pages/auth/ResetPasswordPage.jsx`
- `src/components/AuthLayout.jsx`
- `src/components/ExportMenu.jsx`
- `src/utils/exportReport.js`
- `src/pages/reports/GenerateReportPage.jsx`
- `src/pages/reports/ReportSections.jsx`
- `src/utils/pdfReport.js`
- `src/components/ThemeToggle.jsx`
- `src/theme.css`
- `src/theme.js`
- `src/utils/theme.js`

#### Commit History

```text
64b0002  2026-07-09  Overview Dashboard layer-panel modification
7f51608  2026-07-10  Map-size correction
4643ab4  2026-07-10  Resize-button correction
57fcba8  2026-07-12  Community UI and service layer
6500beb  2026-07-12  Authentication and password-recovery pages
dcc23c3  2026-07-12  PNG/CSV export feature
d4c96eb  2026-07-12  PDF report-generation feature
bfbd331  2026-07-12  Application-route follow-up
48cdff3  2026-07-14  Dark/light theme implementation
f3f6abc  2026-07-15  Report-generation bug correction
```

#### Suggested Screenshots

- Dashboard before and after map resizing.
- Community page, new-post form and comment thread.
- Login, registration and reset-password pages.
- ESG/SDG export menu and downloaded CSV/PNG.
- Report-generation page and generated PDF.
- Application displayed in both light and dark modes.

### Week 9 Summary

During Week 9, I expanded Borneo Tracker beyond data viewing by developing community participation, authentication interfaces, data export, report generation and theme support. I also corrected map sizing, resize controls and report-generation defects. This work improved the application’s usability and strengthened its **D — Data** and **E — Ethics/accessibility** layers by making information easier to access, export and present.

## Overall Two-Week Contribution

Across Week 8 and Week 9, I developed and refined the main Dashboard, ESG and Regional Detail interfaces; created the community and authentication interfaces; added PNG, CSV and PDF reporting capabilities; and implemented dark/light mode. I also fixed map-layout, resize-control and report-generation defects.

The evidence for this period consists of 12 authored commits, the changed source-code files listed above, and screenshots of the completed interfaces. Merge commit `55b7f6b` is reported as synchronization work and is not counted as a separate feature implementation.

## Verification Commands

```powershell
git show --stat 776a2e5
git show --stat 64b0002
git show --stat 7f51608
git show --stat 4643ab4
git show --stat 57fcba8
git show --stat 6500beb
git show --stat dcc23c3
git show --stat d4c96eb
git show --stat 48cdff3
git show --stat f3f6abc
git log --all --author="angel" --since="2026-07-02" --until="2026-07-15 23:59:59" --oneline
```

No tests were run and no application code was changed while preparing this report. All activities above were derived from repository commit history and changed-file evidence.
