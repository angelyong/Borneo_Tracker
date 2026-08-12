# Deployment Setup — GitHub Actions → DirectAdmin

**Audience:** the repo owner.
**What this sets up:** `.github/workflows/deploy.yml`, which builds the site, validates the
data, uploads it to `public_html`, and then **verifies** that production is actually serving
what was built.

This is the implementation of **Option A** in
[`DIRECTADMIN_DASHBOARD_DATA_UPDATE_OPTIONS.md`](./DIRECTADMIN_DASHBOARD_DATA_UPDATE_OPTIONS.md).

---

## 0. Release boundary: proof-gated automatic deployment is opt-in

Manual runs remain available through **Actions → Deploy to DirectAdmin → Run workflow**. When
the repository variable `AUTO_PRODUCTION_DEPLOY` is exactly `true`, a new current-master proof
commit from `anchor.yml` or `anchor-upgrade.yml` dispatches an automatic production release.
Refresh itself, a bare push, and historical catch-up never deploy directly.

Every run resolves an exact, lowercase 40-character `proof_commit_sha`. An automatic dispatch
must be the current `master` HEAD; a manual run may use an older master ancestor for a deliberate
rollback. A missing prerequisite is a **red failure** with secret names only; a green run is never
used to mean “credentials were absent”. Automatic deployment must remain disabled until the
hosting cache policy has been verified for `/data/*` and proof files.

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
| `AUTO_PRODUCTION_DEPLOY` | `false` | **Safety switch.** Set to `true` only after cache bypass/revalidation for `/data/*`, Manifest, anchor log, and `.ots` proof files is verified. When true, a newly committed current-master proof automatically deploys and smoke-tests production. |

---

### Cache-readiness acceptance gate

Do not infer durable cache safety from one successful browser refresh. Before changing
`AUTO_PRODUCTION_DEPLOY` to `true`, retain evidence for all of the following:

1. Hosting support confirms that `/data/*` (including `manifest.json`, `anchors.jsonl`, `.ots`,
   versioned proof pairs and the six declared datasets) bypasses shared stale caching or is always
   revalidated. If a purge API is the chosen control, it must be limited to this domain and tested.
2. A manual production run for the latest proof SHA finishes with the ordinary, non-cache-busted
   smoke requests matching the uploaded build. A cache-busted match by itself is a failure.
3. A second ordinary request after the agreed cache window still returns the same Manifest SHA,
   proof bytes and data hashes. Record the workflow URL, proof SHA, time and hosting confirmation.

The DirectAdmin user interface currently exposes no LiteSpeed purge control. Cache policy or
purging therefore belongs to the hosting administrator unless a limited API is provided.

### One-time bootstrap before enabling automatic deployment

Enabling the variable does not emit an event for proof commits that already exist. Before the
first switch-on, manually deploy the latest proof-bearing master ancestor using the normal
`dry_run` → `connection_test_only` → `production` sequence. Confirm that production
`anchors.jsonl` and `manifest.json.ots` match that exact commit. Only future proof commits are
automatic.

---

## 3. First run — do the preflight manually

The two preflight modes are manual and never change the hosted site. Keep
`AUTO_PRODUCTION_DEPLOY=false` while proving the hosting path and cache policy.

1. **Actions → "Deploy to DirectAdmin" → Run workflow.** Enter the exact proof-bearing
   `proof_commit_sha` from the verified master anchor run.
2. Select **`release_mode=dry_run`** and leave `confirm_production=false`. This does everything *except* touch the server: it validates
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
   - `dist/data/.htaccess is missing or does not contain the required data cache policy` — do
     not deploy. `public/data/.htaccess` is tracked evidence-delivery policy: it tells clients
     and shared caches not to retain a stale Manifest, anchor log, or OpenTimestamps proof.
3. After a green Dry Run, run the workflow again with
   **`release_mode=connection_test_only`** and the same exact SHA.

   This authenticates through FTPS, verifies the FTPS certificate according to
   `FTPS_VERIFY_CERT`, changes into `SFTP_REMOTE_DIR`, and lists the directory. It does **not**
   upload, mirror, overwrite `.htaccess`, or run the public-site smoke test. A passing summary
   says **“Connection test passed — nothing was uploaded.”** This is the safest way to diagnose a
   wrong username/password, a certificate problem, a chroot/path mistake, or an FTP connectivity
   problem before Production is touched.

4. Only after both checks are green, run again with **`release_mode=production`**,
   the same exact SHA, and **`confirm_production=true`**. Watch these steps:
   - **Prepare credentials** — validates only safe hostname/port/path forms before connecting.
   - **Upload dist/ to DirectAdmin** — uses Explicit FTPS on port 21 and prints a credentials-free
     transfer plan.
   - **Smoke-test production** — see Step 4.
5. A GitHub `production` environment approval, if configured, is an additional guard; it does
   not replace the exact SHA and explicit confirmation in the workflow.

### What triggers a deploy afterwards

Manual `workflow_dispatch` supports preflight, approved production releases, and rollback. With
`AUTO_PRODUCTION_DEPLOY=true`, `anchor.yml` and `anchor-upgrade.yml` may also send a
`deploy-proof` repository dispatch after they push a new proof commit. The automatic request must
contain a full SHA that still equals current `origin/master`; it cannot deploy an arbitrary branch,
a moving branch tip, or a historical catch-up proof.

Deploys **queue**; they never cancel each other. Killing an upload halfway would leave
`public_html` in a mixed state.

Anchor and upgrade retry the dispatch four times. If the proof push succeeds but every dispatch
attempt fails, the proof remains valid and the workflow turns red. Recover by manually running
`Deploy to DirectAdmin` in `production` mode with that exact proof commit SHA; do not restamp or
rewrite the proof merely to create another event.

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
| 4 | `GET` every Manifest-declared data file; JSON must return `application/json`, GeoJSON must return `application/geo+json` (or compatible `application/json`), and each downloaded SHA-256 and byte count must equal the manifest. | This proves the actual Production bytes match the build, not merely the manifest, and that a data URL did not fall through to the SPA or an untyped binary response. |

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
| `Stale cache, not a failed upload` | The new bytes **are** on the server (they match when fetched with a cache-buster) but the plain URL serves an old copy. | Confirm that `public/.htaccess` and `public/data/.htaccess` deployed, then ask the hosting administrator to inspect any remaining server-level cache for this domain. This DirectAdmin account has no LiteSpeed purge control. |
| `Production data endpoint/MIME error` | A cache-busted data URL itself is missing, is the SPA HTML fallback, or has the wrong content type. | This is not a cache-only failure. Check the remote path and deployed `.htaccess` files; GeoJSON must be served as `application/geo+json` or `application/json`. |
| `Production byte mismatch` | Cache-busted public data endpoints are reachable, but their bytes or proof contract differ from this exact build. | Check the upload target and remote files. Do not treat this as a cache purge issue. |
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
2. **Actions → "Deploy to DirectAdmin" → Run workflow →** enter that proof-bearing master
   commit as `proof_commit_sha`, select `production`, and deliberately set
   `confirm_production=true`.
3. Confirm the smoke test passes and that the `generatedAt` in the summary is the one you
   expected.

If the bad commit is on `master`, `git revert` it first, produce and independently verify a new
proof for the reverted master state, then deploy that resulting exact proof commit. This keeps
the repository, proof, and production telling the same story.

**To roll back either `.htaccess` policy:** every deploy attaches best-effort *pre-deploy*
copies of both the root `.htaccess` and `data/.htaccess` to the run as an artifact named
**`predeploy-htaccess`** (kept 30 days). Restore the root file only for an SPA routing rollback;
restore `data/.htaccess` only for the data/proof cache-policy rollback. Download the appropriate
file and put it back with the DirectAdmin File Manager.

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
  manual actor on failure; consider watching the repository or adding a notification step.
- **Optional hardening:** the job targets a GitHub *environment* named `production`. You can add
  required reviewers to it (Settings → Environments) if you want a human to approve every deploy.
