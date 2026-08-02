# Deployment Setup — GitHub Actions → DirectAdmin

**Audience:** the repo owner.
**What this sets up:** `.github/workflows/deploy.yml`, which builds the site, validates the
data, uploads it to `public_html`, and then **verifies** that production is actually serving
what was built.

This is the implementation of **Option A** in
[`DIRECTADMIN_DASHBOARD_DATA_UPDATE_OPTIONS.md`](./DIRECTADMIN_DASHBOARD_DATA_UPDATE_OPTIONS.md).

---

## 0. Why the workflow is green but does nothing right now

`deploy.yml` is already merged, but none of the SFTP secrets exist yet. Its first step checks
for them, prints a loud "DEPLOY SKIPPED" banner with the list of missing secret names, writes
an explanation into the run summary, and **exits 0**.

That is deliberate. A permanently red Actions tab is a red light everyone learns to ignore —
which is exactly the failure mode this whole exercise exists to kill. The run is green because
"we correctly did nothing"; the summary says loudly that production was not updated.

**The site keeps serving the hand-uploaded 2026-07-23 build until Step 1 and Step 2 below are
done.**

---

## 1. Get a deploy account

> ### ⚠️ Measured 2026-08-02 — the protocol question is already answered: **FTPS, not SFTP**
>
> Probed from outside against `borneotracker.rentsmartprop.com.my`:
>
> | Port | Result |
> |---|---|
> | 21 | **OPEN** — `220 Welcome to Pure-FTPd [privsep] [TLS]` → explicit FTPS available |
> | 22 | closed / filtered → **SFTP is not offered** |
> | 990 | closed / filtered → no implicit FTPS |
> | 2222 | OPEN — the DirectAdmin control panel |
>
> So **do not generate an SSH key, do not run `ssh-keyscan`, and do not ask for SFTP** — none of
> it applies to this host. `SFTP_KEY` and `SFTP_KNOWN_HOSTS` are dead options here; the workflow
> handles this natively (`deploy.yml:548-559`) when you set the variable `DEPLOY_PROTOCOL=ftps`,
> which also switches the default port to 21. FTPS authenticates with `SFTP_PASSWORD`; it
> cannot use a key.
>
> (Caveat worth one line: port 22 was probed from a single vantage point, so an IP allowlist
> could in principle be hiding it. If the hosting admin says SSH *is* available for a
> specific source, SFTP is still the better option — but do not wait on that.)

### Explicit FTPS matters here

There are two similarly named but different FTPS connection styles:

| Style | Normal port | How the client starts | This host |
|---|---:|---|---|
| **Explicit FTPS** | 21 | Connect with ordinary `ftp://`, then require `AUTH TLS` before login/data | **Use this** |
| Implicit FTPS | 990 | Start TLS immediately with `ftps://` | Not offered |

The workflow deliberately uses `ftp://` plus `AUTH TLS`, `ftp:ssl-force`, and
`ftp:ssl-protect-data` for port 21. This does **not** mean plain FTP is permitted: authentication
and both control/data channels are required to be encrypted. Using `ftps://` on port 21 causes a
TLS handshake error before login because it is the wrong style for Pure-FTPd's port 21 service.
>
> **You may not need to ask anyone.** Creating an FTP account is a normal user-level function in
> DirectAdmin: **FTP Management → Create FTP Account**. If that menu is available to you, make
> the account yourself and skip straight to Step 2. Only if it is missing or disabled do you need
> the request below.

If you do need to ask, send section **2.3** of
[`DIRECTADMIN_DASHBOARD_DATA_UPDATE_OPTIONS.md`](./DIRECTADMIN_DASHBOARD_DATA_UPDATE_OPTIONS.md#23-information-or-access-required-from-the-supervisor)
— it is already written as a request — but **amend item 1**: that document still asks for SFTP
in preference to FTPS, which the measurement above rules out. Ask for an **FTPS account on port
21**, the username and password, and the correct remote directory.

Two things worth asking at the same time, neither of which blocks deployment:

1. **Is Let's Encrypt auto-renewal enabled for the wildcard certificate?** It expires
   **2026-10-29** — see the note below.
2. **What is the account's hourly outbound mail limit?** Supabase now sends auth email through
   `noreply@rentsmartprop.com.my` on this same server; exceeding an unseen cap fails silently.

And for the record:

1. ~~**An SSH *public key* upload instead of a password.**~~ **Not applicable — port 22 is
   closed on this host.** See the measurement above.
2. ~~**A TLS certificate that covers `borneotracker.rentsmartprop.com.my`.**~~ **DONE — do not
   ask for this.** Resolved on 2026-08-01 via DirectAdmin's Let's Encrypt integration. The
   server now presents a **wildcard** `*.rentsmartprop.com.my` (+ the apex), issued 2026-07-31
   and **valid to 2026-10-29**; strict TLS validation passes and the browser warning is gone.
   The same certificate also covers `mail.rentsmartprop.com.my`, which is why Supabase's SMTP
   client connects cleanly (see `SUPABASE_AUTH_MIGRATION_PLAN.md`, Phase 7).

   ⚠️ **Renewal is now the risk.** Wildcards renew over DNS-01, which fails more often than the
   HTTP-01 method used for plain hostnames, and nothing here watches it. Re-check the expiry in
   **mid-October 2026** — if it lapses the whole site silently reverts to a full-page cert
   warning. Strict TLS smoke testing is now the default (§5), so a certificate regression makes
   the deployment fail visibly; until then it is still worth checking the renewal date.

~~Then get the server's SSH host key so the connection can be pinned.~~ **Skip this too** — host-key
pinning is an SSH concept and there is no SSH here. The FTPS equivalent is already in place: leave
`FTPS_VERIFY_CERT` at its default `yes` and the control channel is validated against the server's
real certificate. For that to work, `SFTP_HOST` **must** be `borneotracker.rentsmartprop.com.my` —
the wildcard covers `*.rentsmartprop.com.my` but **not** `sg-shared01.dapanel.net`, so using the
panel hostname would force you to disable certificate verification and throw away the TLS fix.

---

## 2. Add the secrets

**Settings → Secrets and variables → Actions → "Secrets" tab → New repository secret.**

The secret names still say `SFTP_*` because that is what `deploy.yml` reads; on this host they
carry **FTPS** values. Concrete settings for `borneotracker.rentsmartprop.com.my`:

| Secret | Required | Value on this host |
|---|---|---|
| `SFTP_HOST` | yes | **`borneotracker.rentsmartprop.com.my`** — not `sg-shared01.dapanel.net`, or FTPS certificate verification fails (see §1). Hostname only: no `https://`, no path, no port. |
| `SFTP_USER` | yes | The FTP account username. |
| `SFTP_PASSWORD` | **yes here** | FTPS cannot use a key, so this is the only auth method available. Avoid `"` `\` and leading/trailing spaces; a newline is rejected outright. |
| `SFTP_PORT` | yes here | **`21`**. (It would default to 21 anyway once `DEPLOY_PROTOCOL=ftps`, but set it explicitly so the value is visible.) |
| `SFTP_REMOTE_DIR` | depends | If the FTP account lands you directly inside `public_html`, this is **`/`**. If it lands in the account home, it is `/domains/borneotracker.rentsmartprop.com.my/public_html`. Log in once with any FTP client and look: seeing `index.html` + `assets/` means `/`; seeing `domains/` + `logs/` means the full path. Getting this wrong deploys into a nested folder that nothing serves. |
| ~~`SFTP_KEY`~~ | n/a | **Not usable** — port 22 is closed on this host. |
| ~~`SFTP_KNOWN_HOSTS`~~ | n/a | **Not usable** — SSH host-key pinning does not apply to FTPS. |
| `VITE_SUPABASE_URL` | **yes** | Production Supabase project URL. ✅ already set (2026-08-01). |
| `VITE_SUPABASE_ANON_KEY` | **yes** | Production Supabase anon key. Safe in the browser bundle — RLS restricts anon to `status = 'published'`. ✅ already set (2026-08-01). |

**And one variable is mandatory on this host** — without it the workflow tries SSH and fails:
`DEPLOY_PROTOCOL` = `ftps` (Variables tab, see below).

> The two `VITE_*` values are not optional. `src/services/supabaseClient.js` is env-gated: build
> without them and the deployed site silently falls back to the local **mock** auth and news
> store. That is a regression that no error message will tell you about.
>
> The `service_role` key is **never** used here. It stays server-side in the news pipeline.

### Optional variables

**Same screen, "Variables" tab.** All have safe defaults; you only need these to change behaviour.

| Variable | Default | Meaning |
|---|---|---|
| `SMOKE_ALLOW_INSECURE_TLS` | `false` | **Strict certificate validation is the default.** Set to `true` only for a short, explicitly approved diagnostic when the certificate problem is already being fixed; the run will warn loudly and it must be returned to `false` immediately. See Step 5. |
| `PRODUCTION_URL` | `https://borneotracker.rentsmartprop.com.my` | The URL the smoke test checks. |
| `DEPLOY_PROTOCOL` | `sftp` | Set to `ftps` if the host only offers FTPS. (FTPS requires `SFTP_PASSWORD`; it cannot use a key.) |
| `FTPS_VERIFY_CERT` | `yes` | FTPS only. Keep `yes` for every routine deployment. `no` is an emergency, temporary diagnostic override only; fix the hostname/certificate and restore `yes` before any normal deployment. |

---

## 3. First run — do it manually

Do **not** wait for the 05:00 MYT schedule to find out whether it works.

1. **Actions → "Deploy to DirectAdmin" → Run workflow.**
2. Tick **`dry_run`** and run it. This does everything *except* touch the server: it validates
   the data, builds the site, and runs every pre-upload assertion. If this is red, the problem
   is in the repo, not in the hosting — fix it before going near production.

   A Dry Run deliberately makes **zero** FTP/FTPS connections. Therefore a green Dry Run proves
   the repository build and data contract, but it cannot prove the hostname, certificate,
   password, passive-mode firewall, or remote directory are correct.

   Two pre-upload failures you are most likely to hit:

   - `sha256 mismatch` or `byte count mismatch` — the data files and
     `public/data/manifest.json` have drifted apart. Someone changed data without re-emitting
     the manifest, or a Windows writer changed LF into CRLF. Re-run the manifest generator and
     commit the result. For a local check before uploading a ZIP, run
     `python verify_manifest.py verify public/data`, then `npm run build`, then
     `python verify_manifest.py verify dist/data` (or simply `npm run verify:data`).
   - `dist/.htaccess is missing or empty` — `public/.htaccess` was deleted or emptied. It is a
     tracked file and carries the SPA rewrite; restore it. The workflow refuses to upload
     without it precisely because losing it 404s every deep link on the live site.
3. After a green Dry Run, run the workflow again with **only**
   **`connection_test_only`** ticked. Do not tick it together with `dry_run`.

   This authenticates through FTPS, verifies the FTPS certificate according to
   `FTPS_VERIFY_CERT`, changes into `SFTP_REMOTE_DIR`, and lists the directory. It does **not**
   upload, mirror, overwrite `.htaccess`, or run the public-site smoke test. A passing summary
   says **“Connection test passed — nothing was uploaded.”** This is the safest way to diagnose a
   wrong username/password, a certificate problem, a chroot/path mistake, or an FTP connectivity
   problem before Production is touched.

4. Only after both checks are green, run again with **both options unticked**. Watch these steps:
   - **Prepare credentials** — validates only safe hostname/port/path forms before connecting.
   - **Upload dist/ to DirectAdmin** — uses Explicit FTPS on port 21 and prints a credentials-free
     transfer plan.
   - **Smoke-test production** — see Step 4.
5. Repeat for at least three consecutive scheduled runs before trusting it, per §8 of the
   DirectAdmin options doc.

### What triggers a deploy afterwards

| Trigger | When |
|---|---|
| `workflow_run` | Every time **"Refresh dashboard data"** finishes **successfully**. This is how the daily 05:00 MYT data reaches production. |
| `push` to `master` | Any code change. |
| `workflow_dispatch` | Manually, any time, on any branch — including an old one, which is how you roll back. |

> The `workflow_run` trigger is not decoration. `refresh-data.yml` commits with `GITHUB_TOKEN`,
> and pushes made with `GITHUB_TOKEN` do **not** fire `push` events. Without `workflow_run` the
> fresh data would never trigger anything.

Deploys **queue**; they never cancel each other. Killing an upload halfway would leave
`public_html` in a mixed state.

---

## 4. How to read the smoke test

The smoke test is the point of the whole workflow. Uploading without verifying is still an open
loop — the last four days of "green" runs that shipped nothing are the proof.

It asserts four things:

| # | Assertion | Why |
|---|---|---|
| 1 | `GET /` returns **200**, `text/html`, and the body contains the app shell (`id="root"`). | The site is up and is actually our app. |
| 2 | `GET /news` returns **200** `text/html` with the app shell. | `/news` is a client-side route with no file behind it. If `.htaccess` did not survive the upload, this 404s — and so does every other deep link. |
| 3 | `GET /data/manifest.json` parses as JSON, and every declared **SHA-256 and byte count** equals this build. | The manifest claim itself is complete and current. |
| 4 | `GET` each of `indicators.json`, `resilience.json` and `districts.json`; its downloaded SHA-256 and byte count must equal the manifest. | This proves the actual Production bytes match the build, not merely the manifest. |

Every JSON check verifies the **content type**, not just the status code. This matters: the
SPA rewrite in `.htaccess` answers *any* missing path with `index.html` and HTTP **200**, so a
`/data/manifest.json` that is not on the server returns `200 text/html`. Status codes alone
would happily pass a completely failed upload.

Checks 3 and 4 retry six times, ten seconds apart, because the web server can serve a cached
copy for a few seconds after the upload lands.

### If the smoke test fails

Read the annotation. It is written to tell you which of these it is:

| Message | Meaning | Fix |
|---|---|---|
| `... returned HTTP 000 / 5xx` | The site is down or unreachable. | Check DirectAdmin. |
| `manifest.json -> 200 text/html` | The file is **not on the server** — the SPA rewrite answered instead. The upload did not land where you think. | `SFTP_REMOTE_DIR` is almost certainly wrong (chroot). |
| `production 'indicators.json' is <hash>, we built <hash>` | Old data still being served. | Usually a cache — see the next row. |
| `Stale cache, not a failed upload` | The new bytes **are** on the server (they match when fetched with a cache-buster) but the plain URL serves an old copy. | Flush LiteSpeed/LSCache for the domain in DirectAdmin. |
| `deep link /news returned HTTP 404` | `.htaccess` is missing or was overwritten on the server. | Restore it (see rollback) and check the "Server .htaccess replaced" warning in the previous run. |
| `Strict TLS is enabled ... certificate ... is not valid` | The certificate expired, was issued for the wrong host, or otherwise regressed. | Do **not** normalize the error by leaving TLS disabled. Ask the hosting admin to fix the certificate. A temporary `SMOKE_ALLOW_INSECURE_TLS=true` diagnostic override needs explicit approval and must be removed immediately. |

Nothing is rolled back automatically. Because the upload is **non-destructive**, the previous
hashed asset files are all still on the server — see Step 6.

---

## 5. TLS is strict by default

> **Status 2026-08-01: the certificate validates** (wildcard `*.rentsmartprop.com.my`, see
> §1.2). The workflow therefore defaults `SMOKE_ALLOW_INSECURE_TLS` to `false`: every normal
> deploy checks the real certificate. This turns an October renewal problem into a visible failed
> deployment instead of an invisible browser warning.

Every normal run performs strict TLS validation. `SMOKE_ALLOW_INSECURE_TLS=true` exists only for
a short, explicitly approved diagnostic if a known certificate incident is being investigated:

- It emits a security warning on every run and makes the smoke test ignore certificate errors.
- It does **not** make the site safe for visitors and must not be treated as a routine workaround.
- If the strict probe succeeds while this override is set, the run tells you to remove the
  override immediately.
- Restore or keep `SMOKE_ALLOW_INSECURE_TLS=false`; a future certificate regression will then
  fail the deploy visibly.

---

## 6. Rollback

Uploads are **non-destructive** — nothing on the server is ever deleted. That is what makes
rollback cheap: the previous build's files are still sitting there.

**To roll back the site:** re-deploy the last known-good commit.

1. Find the last green deploy run and note its commit SHA (it is in the run summary).
2. **Actions → "Deploy to DirectAdmin" → Run workflow →** pick the branch or tag containing that
   commit and run it.
3. Confirm the smoke test passes and that the `generatedAt` in the summary is the one you
   expected.

If the bad commit is on `master`, `git revert` it first and let the `push` trigger redeploy;
that keeps the repo and production telling the same story.

**To roll back only `.htaccess`** (the file whose loss breaks every deep link): every deploy
attaches the *pre-deploy* copy of the live `.htaccess` to the run as an artifact named
**`predeploy-htaccess`** (kept 30 days). Download it and put it back with the DirectAdmin File
Manager.

**Last resort:** build locally (`npm run build`) and upload `dist/` as a ZIP through the
DirectAdmin File Manager, exactly as was done on 2026-07-23. The workflow does not remove that
option.

---

## 7. Known follow-ups

- **Stale assets accumulate.** Vite emits content-hashed filenames and this workflow never
  deletes. Every build that changes a chunk leaves the old file on the server forever. Harmless
  (nothing links to them) but it eats the hosting quota. After a week or two of clean runs,
  either sweep `public_html/assets/` by hand or add a scoped `--delete` phase to the mirror.
- **The deploy account should be restricted** to
  `/domains/borneotracker.rentsmartprop.com.my/public_html`. Until then these credentials can
  reach other projects on the shared account.
- **Failure notifications.** A red deploy is only visible if someone looks. GitHub emails the
  actor on failure; the daily `workflow_run`-triggered deploys have no human actor, so consider
  watching the repo or adding a notification step.
- **Optional hardening:** the job targets a GitHub *environment* named `production`. You can add
  required reviewers to it (Settings → Environments) if you want a human to approve every deploy.
