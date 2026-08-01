# Manual test — account suspension + authentication email

**Created:** 2026-08-02 · **Covers:** commit `1b6ba46` (Suspend fix) and the custom SMTP switch-over
**Time needed:** about 30 minutes · **Who:** anyone on the team *except* the person holding the only admin account

Two things went live on 2026-08-02 that only a human can confirm:

1. **`/admin/users` → Suspend now actually writes to the database.** Before the fix it flipped the
   row on screen, showed "Account suspended", and changed nothing at all — the write was refused
   and the interface reported success anyway.
2. **Authentication email now leaves through our own mail server** (`noreply@rentsmartprop.com.my`)
   instead of Supabase's shared sender. Whether it reaches an inbox — rather than a spam folder —
   cannot be checked from the code.

---

## ⛔ Read this before you start — two ways to get a false result

**1. Do NOT test on `https://borneotracker.rentsmartprop.com.my`.**
The live site still serves a build uploaded by hand on 23 July. The fix is on `master` but has not
been deployed, so the live site will still show the old broken behaviour. Testing there proves
nothing except that the site has not been redeployed yet.

**2. Do NOT test without a real `.env`.**
With `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` missing, the app deliberately falls back to a
**mock** mode: fake users held in memory and an automatic fake admin login. In mock mode Suspend
works on nothing real, and it will always look like it passed. **This is the failure mode most
likely to waste your time**, because everything appears to work.

### Correct setup

```bash
git checkout master
git pull
npm install
# .env must contain VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY — ask Henry
npm run dev
```

**Confirm you are NOT in mock mode before doing anything else:** open the app and look at the top
bar. If you are already signed in without having typed a password, you are in mock mode — stop and
fix `.env`. In real mode, `/admin/users` sends you to `/login` first.

---

## Test 1 — does the verification email arrive, and does it pass authentication?

This is the one that decides whether real users can sign up at all.

1. Go to `/register` and register with a **real Gmail address you own**. Use a fresh one, e.g.
   `yourname+borneoqa1@gmail.com` — Gmail delivers `+anything` to your normal inbox, and it keeps
   the test account separate from your own. **Keep the password**, Test 2 needs this account.
2. Wait for the email. **Check the spam folder as well** — "arrived in spam" and "never arrived"
   are different failures with different causes, so record which one it was.
3. Open the message in Gmail → **⋮ (top right) → Show original**.
4. At the top of that page there is a summary table. Record all three:

   | Field | Expected |
   |---|---|
   | **SPF** | PASS |
   | **DKIM** | PASS |
   | **DMARC** | PASS |

5. Also record the **sender address** shown — it should be `noreply@rentsmartprop.com.my`.
6. Click the verification link. Record where it takes you. It should **not** be `localhost:5173`.

> If you would rather not create an account, `/forgot-password` with an existing address sends a
> reset email that can be checked the same way. Test 2 needs an account either way.

**Do not request more than two or three emails in an hour.** There is an hourly send limit on the
mail server that we have not measured yet; burning through it makes later tests fail for reasons
that have nothing to do with the code.

---

## Test 2 — does Suspend survive a page reload?

This is the whole point of the fix. The old bug was invisible until you reloaded.

**You need an admin account for this.** There is currently only one, and it must not be used as the
*target*. Ask Henry to promote your own account to admin (Supabase → Table Editor → `profiles` →
your row → `role` = `admin`). Having a second admin is also the safe configuration — see the safety
rules at the end.

1. Sign in as your admin account, go to **`/admin/users`**.
2. Find the account you registered in Test 1 (it will show as **Active**).
3. Open its **⋯** menu → **Suspend account**.
4. Expected immediately: the badge changes to **Suspended** and a message says "Account suspended."
5. **Reload the page (F5).** ← *this step is the test*

   | Result | Meaning |
   |---|---|
   | Still **Suspended** | ✅ **PASS** — the write reached the database |
   | Back to **Active** | ❌ **FAIL** — the old bug. Report it. |

6. Now reverse it: **⋯ → Reactivate account**, reload again, confirm it stays **Active**.

### Test 2b — what a suspended person sees

1. Suspend that account again.
2. In a **private/incognito window**, sign in as that suspended account.
3. Go to `/profile`.
4. Expected: **"This account has been suspended. Please contact an administrator."**
5. Reactivate it afterwards so the account is usable again.

---

## Test 3 (optional) — a suspended admin really loses admin

Only attempt this with **two admin accounts available**, and never with the last one. It checks the
part of the fix that the database enforces rather than the interface.

1. Have Henry temporarily promote a second throwaway account to `admin`.
2. Sign in as that throwaway admin and confirm `/admin/users` opens.
3. From your own admin account, suspend the throwaway one.
4. In the throwaway account's window, reload.
5. Expected: `/admin/users` is refused with **"This account has been suspended…"**, and the admin
   links disappear from the navigation.
6. Reactivate it, reload again, confirm admin access returns.

---

## What to send back

Copy this and fill it in. "It works" is not a useful report — the failure modes above all look like
success from the outside, so the specific observations matter.

```
Tester:
Date:
Ran against:  local dev on master   /   other (say what)
Mock mode ruled out (had to log in)?   yes / no

TEST 1 — verification email
  Email arrived:            inbox / spam / never arrived
  Minutes until it arrived:
  Sender shown:
  SPF:                      pass / fail / neutral / none
  DKIM:                     pass / fail / none
  DMARC:                    pass / fail / none
  Verification link led to:
  Any error on screen:

TEST 2 — suspend
  Badge changed immediately:            yes / no
  STILL suspended after reload:         yes / no      <-- the actual result
  Reactivate survived a reload:         yes / no
  2b: suspended user saw the notice:    yes / no / not tested

TEST 3 — suspended admin (optional)
  Ran it:                               yes / no
  Lost admin access after reload:       yes / no

Anything unexpected (screenshots welcome):
```

---

## Safety rules

- **Never suspend the last remaining admin account.** The application refuses to let an admin
  suspend *themselves*, but nothing stops one admin from suspending another. If every admin ends up
  suspended, no one can undo it from the app — recovery means editing `profiles` directly in the
  Supabase Table Editor.
- **Do not use your real personal account as the suspend target.** Register a throwaway for it.
- **Reactivate everything you suspended** before you finish, and say so in your report.
- Test accounts can be deleted afterwards in Supabase → Authentication → Users. Deleting the auth
  user removes its `profiles` row automatically (`on delete cascade`).
