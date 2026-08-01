# Borneo Tracker: Options for Automatically Updating Dashboard Data on DirectAdmin

**Date:** 27 July 2026  
**Purpose:** To help the project supervisor confirm the available DirectAdmin hosting capabilities, account permissions, and the most suitable production data-update approach.

---

## 1. Current System Architecture

Borneo Tracker is not a complete backend application running entirely on DirectAdmin. It currently consists of three parts:

### 1.1 DirectAdmin

- Hosts the production website at:
  `https://borneotracker.rentsmartprop.com.my`
- The website files are stored in:
  `/domains/borneotracker.rentsmartprop.com.my/public_html`
- DirectAdmin currently serves the compiled React/Vite static website.

### 1.2 Supabase

- Provides the hosted PostgreSQL database and Authentication.
- Stores dynamic information for user profiles, Community, News, and Admin features.
- Changes to Supabase data can be read by the production website without uploading a new website build.

### 1.3 GitHub Actions and the Python Data Pipeline

- The ESG, SDG, Resilience Index, and district dashboard datasets are not currently read directly from Supabase.
- GitHub Actions runs `python run_pipeline.py` every day at approximately **5:00 a.m. Malaysia Time**.
- The pipeline collects data from sources such as BPS, Global Forest Watch, NASA FIRMS, WAQI, World Bank, OpenDOSM, and Global Data Lab.
- It generates files including:
  - `public/data/indicators.json`
  - `public/data/resilience.json`
  - `public/data/districts.json`
  - Supporting CSV and GeoJSON files

### Current Deployment Gap

GitHub Actions can refresh the files in the GitHub repository, but it does **not** currently update the files inside DirectAdmin's `public_html` directory.

As a result, the production website may continue displaying the dashboard data included in the last manually uploaded ZIP file.

A complete production update process must therefore provide the following flow:

```text
GitHub data pipeline succeeds
        ↓
Generated data is validated
        ↓
The latest files are deployed to DirectAdmin
        ↓
The production dashboard displays the updated data
```

---

## 2. Option A: Deploy from GitHub Actions to DirectAdmin

**Recommended option**

### 2.1 How It Works

```text
External data APIs
        ↓
GitHub Actions runs the Python pipeline
        ↓
The generated JSON files are validated
        ↓
The React production website is built
        ↓
The files are uploaded through SFTP or FTPS
        ↓
DirectAdmin serves the updated dashboard
```

### 2.2 Why This Option Is Recommended

- The pipeline already runs on GitHub Actions.
- DirectAdmin does not need to provide Python, Node.js, npm, or Git.
- API credentials can remain in GitHub Actions Secrets instead of being stored in `public_html`.
- DirectAdmin only needs to host the compiled static website, which is suitable for shared hosting.
- GitHub Actions provides an execution history and logs for troubleshooting.
- Future code releases and dashboard-data updates can use the same controlled deployment process.

### 2.3 Information or Access Required from the Supervisor

> **Update 2026-08-02 — items 1, 2 and 3 have since been answered by measurement, so please do
> not spend the supervisor's time on them.** Probing `borneotracker.rentsmartprop.com.my` from
> outside: **port 21 is open** and answers `220 Welcome to Pure-FTPd [privsep] [TLS]`, i.e.
> explicit **FTPS** is supported; **port 22 is closed/filtered**, so **SFTP is not offered**;
> port 990 is closed (no implicit FTPS); port 2222 is the DirectAdmin panel. The ask is therefore
> an **FTPS account on port 21 with a password** — an SSH key cannot be used.
>
> Also note that creating an FTP account is a normal user-level function in DirectAdmin
> (**FTP Management → Create FTP Account**), so this request is only needed if that menu is
> unavailable to the team. See [`DEPLOYMENT_SETUP.md`](./DEPLOYMENT_SETUP.md) §1.

Please confirm whether a deployment account can be created specifically for the Borneo Tracker subdomain and provide the following:

1. ~~Supported connection type~~ — **answered: FTPS on port 21** (see the note above). Standard, unencrypted FTP must not be used, as it exposes the credentials and the transferred files.
2. ~~Server hostname~~ — **use `borneotracker.rentsmartprop.com.my`**, not `sg-shared01.dapanel.net`: the server's Let's Encrypt certificate is a wildcard for `*.rentsmartprop.com.my`, so connecting by the panel hostname would fail certificate verification.
3. ~~Connection port~~ — **answered: `21`**.
4. Deployment username.
5. Password or SSH private key.
6. Correct remote deployment directory:
   `/domains/borneotracker.rentsmartprop.com.my/public_html`
7. Whether the deployment account can be restricted to the Borneo Tracker directory only.
8. Whether the server uses a firewall, IP allowlist, or connection-rate limit.
9. Whether external GitHub Actions runners are allowed to connect and upload files.

The credentials will not be committed to the repository. They will be stored under:

`GitHub repository → Settings → Secrets and variables → Actions`

### 2.4 Recommended Initial Deployment Mode

For the first implementation:

- Automatically upload only the updated dashboard data files.
- Do not automatically delete other files in `public_html`.
- Observe several successful scheduled updates before enabling full website deployment.

For a complete automated deployment, GitHub Actions should:

1. Run the Python data pipeline.
2. Confirm that all required JSON files exist and can be parsed.
3. Confirm that row counts and territory coverage have not dropped abnormally.
4. Build the website using the production Supabase public variables.
5. Upload `dist/` safely, preferably through a temporary directory or another non-destructive process.
6. Run a production smoke test after deployment.
7. Keep the previous production version available if deployment fails.

### 2.5 Risks and Controls

| Risk | Proposed control |
|---|---|
| The deployment account can access other student projects | Restrict the account to the Borneo Tracker directory |
| An interrupted upload leaves an incomplete website | Upload to a temporary location first, or avoid deleting production before upload |
| Invalid data is published automatically | Validate JSON, required territories, row counts, and generation dates |
| Credentials are exposed | Store them only in GitHub Actions Secrets; never place them in React, Git, or a deployment ZIP |
| A new build overwrites `.htaccess` | Include the production `.htaccess` in the release or explicitly preserve it |

---

## 3. Option B: Run the Update with a DirectAdmin Cron Job

**Fallback option**

### 3.1 How It Works

```text
DirectAdmin Cron Job starts on schedule
        ↓
The server pulls the latest project from GitHub
        ↓
The server runs the Python data pipeline
        ↓
The server runs the React production build
        ↓
The generated files are deployed to public_html
```

### 3.2 Requirements

This option is suitable only if the supervisor or hosting administrator confirms all of the following:

1. SSH access is available.
2. The DirectAdmin account includes permission to create Cron Jobs.
3. The server provides or permits:
   - Git
   - Python 3
   - Node.js and npm
4. The server can make outbound HTTPS requests to GitHub, Supabase, and the external data APIs.
5. The Cron Job has sufficient execution time, memory, CPU, and storage.
6. The repository, environment variables, credentials, and logs can be stored outside `public_html`.
7. The hosting administrator allows this type of scheduled data-processing workload.

### 3.3 Information or Access Required from the Supervisor

1. Confirmation that SSH access can be enabled.
2. SSH hostname, port, and username.
3. Confirmation that Cron Jobs are available and the minimum permitted frequency.
4. Installed versions of Python, Node.js, npm, and Git.
5. Cron Job timeout, memory, CPU, and storage limits.
6. Confirmation that outbound connections to GitHub, Supabase, and project data APIs are allowed.
7. Confirmation that a private application directory can be created outside `public_html`.
8. If the repository is private, approval to use a read-only GitHub deploy key.

### 3.4 Limitations

- Shared hosting often does not provide complete SSH, Python, Node.js, or Cron Job access.
- The data pipeline connects to several external APIs and may exceed shared-hosting time or resource limits.
- API credentials would need to be managed securely on the DirectAdmin server.
- Troubleshooting server-side builds and Cron Jobs is more difficult than reviewing GitHub Actions logs.
- Shared accounts create a greater risk of exposing credentials or affecting other student projects.

For these reasons, Option B should be considered only if a secure, directory-restricted SFTP or FTPS account cannot be provided for Option A.

---

## 4. Comparison

| Item | Option A: GitHub Actions deployment | Option B: DirectAdmin Cron Job |
|---|---|---|
| Recommendation | **Preferred** | Fallback |
| DirectAdmin requirement | SFTP or FTPS account | SSH, Cron, Git, Python, Node.js |
| Pipeline execution location | GitHub | DirectAdmin server |
| Suitability for shared hosting | Higher | Lower; must be confirmed |
| Secret storage | GitHub Actions Secrets | Private server environment |
| Logs and troubleshooting | Clear GitHub Actions logs | More complex server/Cron logs |
| Server resource requirement | Low | Higher |
| Risk to other student projects | Can be reduced with a restricted account | Harder to isolate on a shared account |

### Team Recommendation

The team recommends **Option A: GitHub Actions with SFTP or FTPS deployment**.

If the server cannot provide a secure deployment account restricted to the Borneo Tracker directory, the team can evaluate Option B.

If neither option is supported, production dashboard updates will have to remain manual and cannot be considered fully automated.

---

## 5. Pipeline Items Required for Either Option

The current `.github/workflows/refresh-data.yml` already supplies:

- `BPS_API_KEY`
- `GFW_API_KEY`
- `WAQI_TOKEN`

The following still need to be confirmed or added:

- `FIRMS_MAP_KEY`
- `GDL_API_TOKEN`
- Commit or deployment of `public/data/districts.json`
- A persistence strategy for `gdl_msch_cache.csv`
- Data-integrity validation
- GitHub Actions failure notifications
- A production deployment step

Additional notes:

- `FIRMS_MAP_KEY` is used for NASA FIRMS active-fire hotspot data.
- `GDL_API_TOKEN` is used for the Global Data Lab education indicator.
- If either secret is missing, its related data puller is skipped. The entire website can still run, but the affected data may be missing, outdated, or supplied by an existing fallback.
- Previously exposed API credentials must be rotated before the new credentials are added to GitHub Actions Secrets.
- The Supabase `service_role` key is server-side only. It must never be included in the frontend build.

---

## 6. Suggested Update Frequency and Data Integrity

The dashboard sources are updated at different frequencies:

- NASA FIRMS and WAQI can change frequently.
- GFW, BPS, OpenDOSM, World Bank, and Global Data Lab are generally updated monthly, quarterly, or annually.

Running the pipeline once per day is acceptable, but it does not mean every source will provide a new value every day.

The production dashboard should continue to display:

- Source
- Year or observation time
- Data level
- Confidence and known limitations

This makes the deployment process support **C — Connectivity** while preserving **D — Data** and **E — Ethics/provenance** in the project's ABCDE Framework.

---

## 7. Supervisor Confirmation Checklist

Dear Sir,

We would like to automate the publication of the latest Borneo Tracker dashboard data to DirectAdmin. Please help us confirm the following hosting capabilities.

### Preferred Option: SFTP or FTPS Deployment

- [ ] A deployment account restricted to  
  `/domains/borneotracker.rentsmartprop.com.my/public_html`  
  can be provided.
- [ ] Connection type: ____________________
- [ ] Host: ____________________
- [ ] Port: ____________________
- [ ] Username: ____________________
- [ ] Remote directory: ____________________
- [ ] IP or firewall restrictions: ____________________
- [ ] GitHub Actions runners are allowed to upload: Yes / No

### Fallback Option: DirectAdmin Cron Job

If SFTP or FTPS deployment cannot be provided, please confirm:

- [ ] SSH access is available.
- [ ] Cron Jobs are available.
- [ ] Git is available.
- [ ] Python 3 is available. Version: ____________________
- [ ] Node.js and npm are available. Versions: ____________________
- [ ] Cron timeout or resource limits: ____________________
- [ ] The server can connect to GitHub, Supabase, and the external data APIs.

The team will be responsible for updating the workflow, protecting all credentials, testing the automatic deployment, and preparing a rollback process.

---

## 8. Team Actions After Approval

1. Select Option A or Option B based on the supervisor's confirmation.
2. Rotate any credentials that were previously exposed.
3. Store the replacement credentials in the appropriate secret manager.
4. Correct the missing items in the dashboard refresh workflow.
5. Add JSON and data-quality validation.
6. Implement the automatic deployment process.
7. Trigger an initial staging or production test manually.
8. Confirm that the production data timestamp changes and that the website and Supabase features still work.
9. Observe at least three consecutive scheduled runs.
10. Record the deployment owner, failure-notification owner, and rollback procedure.
