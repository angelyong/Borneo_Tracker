# Testing Bug Report-1

## 1. Authentication & Verification

### BUG-AUTH-01 — Email Verification Redirects to Localhost

**Issue:**  
The verification link redirects the user to:

http://localhost:5173

instead of the deployed production website.

**Category:** Authentication / Email Verification  
**Type:** Redirect Configuration Issue  
**Suggested Severity:** Medium

**Expected Behaviour:**  
The verification link should redirect users to the deployed application URL.

---

### BUG-AUTH-02 — Password Update Is Not Persisted

**Issue:**  
When a user edits their password, the password change is not successfully reflected in Supabase.

**Category:** Authentication / Credential Management  
**Type:** Data Persistence / Authentication Issue  
**Suggested Severity:** High

**Expected Behaviour:**  
The user's password should be securely updated through Supabase Auth and the new password should be usable for subsequent login attempts.

---

# 2. User Profile & Account Management

### BUG-PROFILE-01 — Edited Personal Details Are Not Persisted

**Issue:**  
When a user edits their personal details, the changes appear temporarily on the frontend but are not written to Supabase.

After refreshing the page, the original registration information is displayed again.

**Category:** User Profile Management  
**Type:** Data Persistence / Backend Integration Issue  
**Suggested Severity:** Medium

**Expected Behaviour:**  
Updated personal information should be stored in Supabase and remain available after page refresh or subsequent login.

---

### BUG-ACCOUNT-01 — Users Are Able to Modify Their Email Address

**Issue:**  
Users are currently allowed to edit their email address.

This creates several account integrity risks:

1. If the user enters an incorrect email and logs out, they may no longer be able to access the account.
2. If the email is changed to an address belonging to another person, the actual email owner may be unaware that their email is associated with the application.
3. Developers/administrators may have difficulty identifying accounts containing incorrectly modified email addresses.

**Category:** Account Management / Security  
**Type:** Requirement / Validation / Account Integrity Issue  
**Suggested Severity:** High

**Recommended Expected Behaviour:**  
Users should not be allowed to directly modify their registered email address through the Personal Details page.

If email modification is required in the future, it should use a controlled email-change verification process.

---

# 3. Account Suspension & Access Control

### BUG-ACCESS-01 — Suspended Accounts Can Still Sign In

**Issue:**  
After an admin suspends an admin/user account:

- The website displays the account as `SUSPENDED`.
- Supabase also records the account as suspended.
- However, the suspended account can still successfully sign in.
- After refreshing the page, the suspended user can still view their account information.

**Category:** Account Suspension / Access Control  
**Type:** Authorization / Security Issue  
**Suggested Severity:** High

**Expected Behaviour:**  
A suspended account should not be allowed to access protected application functionality.

The suspension status must be enforced during authentication and authorization checks.

---

### BUG-ACCESS-02 — Suspended Account Is Not Blocked in Private/Incognito Session

**Test Scenario:**

> Suspend the test account, sign in using an incognito/private window, then open `/profile`.

**Issue:**  
The suspended account is still able to sign in/access the application in a private/incognito browser session.

The application does not display a message indicating that the account has been suspended.

**Category:** Account Suspension / Access Control  
**Type:** Authorization / Session Enforcement Issue  
**Suggested Severity:** High

**Expected Behaviour:**  
Suspension status should be checked independently of the existing browser session.

A suspended user attempting to authenticate from a new browser/private session should be denied access and shown an appropriate suspension message.

---

# 4. Account Reactivation & State Synchronization

### BUG-REACTIVATE-01 — Reactivated User Receives Permission Error

**Issue:**  
After a previously suspended user account is reactivated, the user can sign in but receives the following message:

> "You do not have permission to view this page."

**Category:** Account Reactivation / Access Control  
**Type:** Authorization State Synchronization Issue  
**Suggested Severity:** High

**Expected Behaviour:**  
After an account is successfully reactivated, its required permissions and account status should be restored so that the user can access the appropriate pages.

---

# Bug Summary

| ID | Category | Issue | Suggested Severity |
|---|---|---|---|
| BUG-AUTH-01 | Authentication & Verification | Verification redirects to localhost | Medium |
| BUG-AUTH-02 | Authentication / Credential Management | Password update is not persisted | High |
| BUG-PROFILE-01 | User Profile Management | Personal details are not persisted | Medium |
| BUG-ACCOUNT-01 | Account Management / Security | User can modify registered email | High |
| BUG-ACCESS-01 | Suspension & Access Control | Suspended account can still sign in | High |
| BUG-ACCESS-02 | Suspension & Access Control | Suspended account not blocked in private session | High |
| BUG-REACTIVATE-01 | Reactivation & Access Control | Reactivated account has no permission | High |