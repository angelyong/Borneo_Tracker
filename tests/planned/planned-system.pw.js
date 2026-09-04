import { expect, test } from '@playwright/test';

const isStaging = Boolean(process.env.PLAYWRIGHT_BASE_URL?.trim());
const MB = 1024 * 1024;

function requireStaging(...keys) {
  test.skip(!isStaging, 'Requires an approved staging URL in PLAYWRIGHT_BASE_URL.');
  keys.forEach((key) => {
    test.skip(!process.env[key]?.trim(), `Requires the staging fixture ${key}.`);
  });
}

async function open(page, path) {
  const response = await page.goto(path);
  expect(response, `${path} should return a document response`).not.toBeNull();
  expect(response.status(), `${path} should not return an HTTP error`).toBeLessThan(400);
}

async function login(page, email, password) {
  await open(page, '/login');
  await page.locator('input[autocomplete="email"]').fill(email);
  await page.locator('input[autocomplete="current-password"]').fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).not.toHaveURL(/\/login(?:[?#].*)?$/);
}

async function fillRegistration(page, { firstName = 'Planned', lastName = 'Tester', email, password }) {
  await page.locator('input[autocomplete="given-name"]').fill(firstName);
  await page.locator('input[autocomplete="family-name"]').fill(lastName);
  await page.locator('input[autocomplete="email"]').fill(email);
  const passwords = page.locator('input[autocomplete="new-password"]');
  await passwords.nth(0).fill(password);
  await passwords.nth(1).fill(password);
}

async function selectWithLabel(page, label) {
  const selects = page.locator('select');
  for (let index = 0; index < await selects.count(); index += 1) {
    const select = selects.nth(index);
    if (await select.locator('option', { hasText: label }).count()) {
      await select.selectOption({ label });
      return select;
    }
  }
  throw new Error(`No select contains the option "${label}".`);
}

async function openCommunityComposer(page) {
  await open(page, '/community');
  await page.getByRole('button', { name: 'Start a discussion' }).click();
  await expect(page.getByRole('heading', { name: 'Start a discussion' })).toBeVisible();
}

async function openAi(page) {
  const launcher = page.getByRole('button', { name: 'AI Assistant' });
  await launcher.click();
  await expect(page.getByRole('dialog', { name: 'BorneoBot' })).toBeVisible();
  return launcher;
}

async function newStagingPage(browser) {
  const context = await browser.newContext({ baseURL: process.env.PLAYWRIGHT_BASE_URL });
  return { context, page: await context.newPage() };
}

function draftCard(page, title) {
  return page.locator('article.draft-card').filter({ has: page.getByDisplayValue(title) });
}

test.describe('Second suite — planned Playwright system test cases', () => {
  test('ST-001 opens the Dashboard with the map and resilience information', async ({ page }) => {
    await open(page, '/');
    await expect(page.locator('.leaflet-container')).toBeVisible();
    await expect(page.getByText('Resilience Index (0–100)')).toBeVisible();
  });

  test('ST-002 opens the main application routes directly without a 404', async ({ page }) => {
    const routes = [
      ['/regions', /Regional|Region|District/i],
      ['/esg', /ESG Indicators/i],
      ['/sdg', /SDG Progress/i],
      ['/news', /Latest News/i],
    ];
    for (const [path, expected] of routes) {
      await open(page, path);
      await expect(page.locator('main, body')).toContainText(expected);
      await expect(page.locator('body')).not.toContainText(/404|page not found/i);
    }
  });

  test('ST-003 changes Dashboard information for each selected territory', async ({ page }) => {
    await open(page, '/');
    for (const territory of ['Sabah', 'Sarawak', 'Brunei', 'Kalimantan']) {
      const select = await selectWithLabel(page, territory);
      await expect(select).toHaveValue(territory);
      await expect(page.locator('body')).toContainText(territory);
    }
  });

  test('ST-004 drills down to a supported district and keeps source labels visible', async ({ page }) => {
    await open(page, '/');
    await page.getByRole('button', { name: 'District', exact: true }).click();
    const districtSelect = page.locator('select').last();
    await expect(districtSelect.locator('option')).not.toHaveCount(0);
    const district = await districtSelect.locator('option').first().textContent();
    await districtSelect.selectOption({ label: district.trim() });
    await expect(page.locator('body')).toContainText(district.trim());
    await expect(page.locator('body')).toContainText(/source|data level|district/i);
  });

  test('ST-005 displays ESG indicator cards with values and sources', async ({ page }) => {
    await open(page, '/esg');
    await expect(page.getByRole('heading', { name: 'ESG Indicators' })).toBeVisible();
    await expect(page.locator('body')).toContainText(/\d/);
    await expect(page.locator('body')).toContainText(/source|confidence/i);
  });

  test('ST-006 displays SDG mappings without an invented composite score', async ({ page }) => {
    await open(page, '/sdg');
    await expect(page.getByRole('heading', { name: 'SDG Progress' })).toBeVisible();
    await expect(page.locator('body')).toContainText(/SDG \d|Sustainable Development Goal/i);
    await expect(page.locator('body')).not.toContainText(/SDG composite score/i);
  });

  test('ST-007 shows provenance, source, confidence, date and verification information', async ({ page }) => {
    await open(page, '/data-sources');
    await expect(page.getByRole('heading', { name: 'Verify this data' })).toBeVisible();
    await expect(page.getByText('Authoritative data sources')).toBeVisible();
    await expect(page.locator('body')).toContainText(/confidence|generated|date|SHA-256|verification/i);
  });

  test('ST-008 switches to Malay and preserves a displayed data value after reload', async ({ page }) => {
    await open(page, '/esg');
    const valueBefore = (await page.locator('main, body').first().innerText()).match(/\d+(?:\.\d+)?/)?.[0];
    expect(valueBefore).toBeTruthy();
    await page.getByRole('button', { name: 'Choose language' }).click();
    await page.getByRole('option', { name: 'Bahasa Melayu' }).click();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Pilih bahasa' })).toBeVisible();
    await expect(page.locator('main, body').first()).toContainText(valueBefore);
  });

  test('ST-009 runs a simple deterministic Impact Simulator scenario', async ({ page }) => {
    await open(page, '/simulator');
    await expect(page.getByRole('heading', { name: 'Impact Simulator' })).toBeVisible();
    const slider = page.locator('input[type="range"]').first();
    const nextValue = await slider.evaluate((element) => {
      const min = Number(element.min || 0);
      const max = Number(element.max || 100);
      return String(Math.round((min + max) / 2));
    });
    await slider.fill(nextValue);
    await expect(page.locator('body')).toContainText(/Illustrative.*deterministic.*not a forecast/i);
    await expect(page.locator('body')).toContainText(/Before|After|Current|Scenario/i);
  });

  test('ST-010 opens the news list and one published article', async ({ page }) => {
    await open(page, '/news');
    await expect(page.getByRole('heading', { name: 'Latest News' })).toBeVisible();
    const articleLink = page.locator('a[href^="/news/"]').first();
    await expect(articleLink).toBeVisible();
    const title = (await articleLink.innerText()).trim();
    await articleLink.click();
    await expect(page).toHaveURL(/\/news\/.+/);
    await expect(page.locator('body')).toContainText(title);
    await expect(page.locator('body')).toContainText(/AI-generated|Original Source|Reported by/i);
  });

  test('ST-011 creates, reloads and deletes a community post', async ({ page }) => {
    const title = `PW community ${Date.now()}`;
    await openCommunityComposer(page);
    await page.getByPlaceholder("What's this about?").fill(title);
    await page.getByPlaceholder(/Share the details/i).fill('Short planned system-test discussion.');
    await page.getByRole('button', { name: 'Post discussion' }).click();
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: `Delete discussion: ${title}` }).click();
    await expect(page.getByRole('heading', { name: title })).toHaveCount(0);
  });

  test('ST-012 downloads a non-empty generated report', async ({ page }) => {
    await open(page, '/reports');
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Generate & Download PDF' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
    const stream = await download.createReadStream();
    let bytes = 0;
    for await (const chunk of stream) bytes += chunk.length;
    expect(bytes).toBeGreaterThan(0);
  });

  test('ST-013 registers a new staging user and shows verification guidance', async ({ page }) => {
    requireStaging('PW_NEW_EMAIL', 'PW_NEW_PASSWORD');
    await open(page, '/register');
    await fillRegistration(page, {
      email: process.env.PW_NEW_EMAIL,
      password: process.env.PW_NEW_PASSWORD,
    });
    await page.getByRole('button', { name: 'Register' }).click();
    await expect(page).toHaveURL(/\/check-email/);
    await expect(page.locator('body')).toContainText(/verification link|Check your email/i);
  });

  test('ST-014 logs in with valid staging credentials', async ({ page }) => {
    requireStaging('PW_USER_EMAIL', 'PW_USER_PASSWORD');
    await login(page, process.env.PW_USER_EMAIL, process.env.PW_USER_PASSWORD);
    await expect(page.getByText(/Resilience Index|Community|My Profile/i).first()).toBeVisible();
  });

  test('ST-015 rejects an incorrect password with a safe message', async ({ page }) => {
    requireStaging('PW_USER_EMAIL');
    await open(page, '/login');
    await page.locator('input[autocomplete="email"]').fill(process.env.PW_USER_EMAIL);
    await page.locator('input[autocomplete="current-password"]').fill('Definitely-Wrong-Password-123!');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('form')).toContainText(/invalid|failed|check your email and password/i);
  });

  test('ST-016 resets a staging password and accepts only the new password', async ({ page }) => {
    requireStaging('PW_RESET_EMAIL', 'PW_RESET_OLD_PASSWORD', 'PW_RESET_NEW_PASSWORD', 'PW_RESET_LINK');
    await open(page, '/forgot-password');
    await page.getByLabel('Email address').fill(process.env.PW_RESET_EMAIL);
    await page.getByRole('button', { name: 'Submit' }).click();
    await expect(page).toHaveURL(/\/check-email/);
    await page.goto(process.env.PW_RESET_LINK);
    await expect(page.getByRole('heading', { name: 'Reset Password' })).toBeVisible();
    const resetInputs = page.locator('input[autocomplete="new-password"]');
    await resetInputs.nth(0).fill(process.env.PW_RESET_NEW_PASSWORD);
    await resetInputs.nth(1).fill(process.env.PW_RESET_NEW_PASSWORD);
    await page.getByRole('button', { name: 'Submit' }).click();
    await expect(page.locator('body')).toContainText(/password has been reset/i);
    await open(page, '/login');
    await page.locator('input[autocomplete="email"]').fill(process.env.PW_RESET_EMAIL);
    await page.locator('input[autocomplete="current-password"]').fill(process.env.PW_RESET_OLD_PASSWORD);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL(/\/login/);
    await page.locator('input[autocomplete="current-password"]').fill(process.env.PW_RESET_NEW_PASSWORD);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('ST-017 saves profile changes across a reload', async ({ page }) => {
    requireStaging('PW_USER_EMAIL', 'PW_USER_PASSWORD', 'PW_PROFILE_FIRST_NAME');
    await login(page, process.env.PW_USER_EMAIL, process.env.PW_USER_PASSWORD);
    await open(page, '/profile');
    await page.getByRole('button', { name: /Edit/ }).first().click();
    const firstName = page.locator('label', { hasText: 'First Name' }).locator('xpath=following-sibling::input');
    await firstName.fill(process.env.PW_PROFILE_FIRST_NAME);
    await page.getByRole('button', { name: 'Save Changes' }).click();
    await page.reload();
    await expect(page.getByText(new RegExp(process.env.PW_PROFILE_FIRST_NAME, 'i'))).toBeVisible();
  });

  test('ST-018 blocks a suspended staging user in a fresh browser context', async ({ browser }) => {
    requireStaging('PW_SUSPENDED_EMAIL', 'PW_SUSPENDED_PASSWORD');
    const { context, page } = await newStagingPage(browser);
    await open(page, '/login');
    await page.locator('input[autocomplete="email"]').fill(process.env.PW_SUSPENDED_EMAIL);
    await page.locator('input[autocomplete="current-password"]').fill(process.env.PW_SUSPENDED_PASSWORD);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page.locator('body')).toContainText(/account has been suspended|cannot access/i);
    await context.close();
  });

  test('ST-019 lets an admin reactivate a suspended user who can then sign in', async ({ browser }) => {
    requireStaging(
      'PW_ADMIN_EMAIL',
      'PW_ADMIN_PASSWORD',
      'PW_REACTIVATE_NAME',
      'PW_REACTIVATE_EMAIL',
      'PW_REACTIVATE_PASSWORD',
    );
    const adminSession = await newStagingPage(browser);
    await login(adminSession.page, process.env.PW_ADMIN_EMAIL, process.env.PW_ADMIN_PASSWORD);
    await open(adminSession.page, '/admin/users');
    await adminSession.page.getByPlaceholder('Search by name').fill(process.env.PW_REACTIVATE_NAME);
    const row = adminSession.page.getByRole('row').filter({ hasText: process.env.PW_REACTIVATE_NAME });
    await row.getByRole('button', { name: 'Account actions' }).click();
    await adminSession.page.getByRole('button', { name: 'Reactivate account' }).click();
    await expect(adminSession.page.locator('body')).toContainText('Account reactivated.');
    await adminSession.context.close();

    const userSession = await newStagingPage(browser);
    await login(userSession.page, process.env.PW_REACTIVATE_EMAIL, process.env.PW_REACTIVATE_PASSWORD);
    await open(userSession.page, '/profile');
    await expect(userSession.page.getByRole('heading', { name: 'My Profile' })).toBeVisible();
    await open(userSession.page, '/admin/users');
    await expect(userSession.page.locator('body')).toContainText(/do not have permission/i);
    await userSession.context.close();
  });

  test('ST-020 permits admins and refuses normal users on both admin pages', async ({ browser }) => {
    requireStaging('PW_USER_EMAIL', 'PW_USER_PASSWORD', 'PW_ADMIN_EMAIL', 'PW_ADMIN_PASSWORD');
    const userSession = await newStagingPage(browser);
    await login(userSession.page, process.env.PW_USER_EMAIL, process.env.PW_USER_PASSWORD);
    for (const path of ['/admin/users', '/admin/news']) {
      await open(userSession.page, path);
      await expect(userSession.page.locator('body')).toContainText(/do not have permission/i);
    }
    await userSession.context.close();

    const adminSession = await newStagingPage(browser);
    await login(adminSession.page, process.env.PW_ADMIN_EMAIL, process.env.PW_ADMIN_PASSWORD);
    await open(adminSession.page, '/admin/users');
    await expect(adminSession.page.getByRole('heading', { name: 'User Management' })).toBeVisible();
    await open(adminSession.page, '/admin/news');
    await expect(adminSession.page.getByRole('heading', { name: 'News Review Queue' })).toBeVisible();
    await adminSession.context.close();
  });

  test('ST-021 asks BorneoBot a supported grounded question', async ({ page }) => {
    requireStaging('PW_USER_EMAIL', 'PW_USER_PASSWORD');
    await login(page, process.env.PW_USER_EMAIL, process.env.PW_USER_PASSWORD);
    await openAi(page);
    await page.getByLabel('Message Borneo Tracker AI').fill('What is the current Sabah resilience score?');
    await page.getByRole('button', { name: 'Send message' }).click();
    await expect(page.getByRole('dialog', { name: 'BorneoBot' })).toContainText(/Sabah|Resilience/i);
    await expect(page.getByRole('dialog', { name: 'BorneoBot' })).toContainText(/Sources|Verified data response/i);
  });

  test('ST-022 shows a safe AI fallback when the quota endpoint returns 429', async ({ page }) => {
    requireStaging('PW_USER_EMAIL', 'PW_USER_PASSWORD');
    await page.route('**/*', async (route) => {
      const request = route.request();
      if (request.method() === 'POST' && /ai-chat/i.test(request.url())) {
        await route.fulfill({
          status: 429,
          contentType: 'application/json',
          body: JSON.stringify({ code: 'AI_CHAT_RATE_LIMITED', error: 'Quota reached' }),
        });
      } else {
        await route.continue();
      }
    });
    await login(page, process.env.PW_USER_EMAIL, process.env.PW_USER_PASSWORD);
    await openAi(page);
    await page.getByLabel('Message Borneo Tracker AI').fill('Show me verified data.');
    await page.getByRole('button', { name: 'Send message' }).click();
    await expect(page.getByRole('dialog', { name: 'BorneoBot' })).toContainText(/temporarily at capacity/i);
    await expect(page.getByRole('dialog', { name: 'BorneoBot' })).not.toContainText(/made up|estimated score/i);
  });

  test('ST-023 keeps essential Dashboard content usable on a mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page, '/');
    await expect(page.locator('.leaflet-container')).toBeVisible();
    await expect(page.getByText('Resilience Index (0–100)')).toBeVisible();
    await expect(page.getByRole('button', { name: 'AI Assistant' })).toBeVisible();
  });

  test('ST-024 supports keyboard opening and Escape focus restoration for BorneoBot', async ({ page }) => {
    await open(page, '/');
    const launcher = page.getByRole('button', { name: 'AI Assistant' });
    await launcher.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog', { name: 'BorneoBot' })).toBeVisible();
    await expect(page.getByLabel('Message Borneo Tracker AI')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'BorneoBot' })).toHaveCount(0);
    await expect(launcher).toBeFocused();
  });

  test('ST-025 shows an honest error or retry state when the data API is unavailable', async ({ page }) => {
    await page.route('**/data/indicators.json*', (route) => route.abort('failed'));
    await open(page, '/esg');
    await expect(page.locator('body')).toContainText(/could not load|failed|retry|unavailable/i);
    await expect(page.locator('body')).not.toContainText(/estimated data|invented/i);
  });

  test('ST-026 rejects duplicate registration clearly', async ({ page }) => {
    requireStaging('PW_DUPLICATE_EMAIL', 'PW_USER_PASSWORD');
    await open(page, '/register');
    await fillRegistration(page, {
      email: process.env.PW_DUPLICATE_EMAIL,
      password: process.env.PW_USER_PASSWORD,
    });
    await page.getByRole('button', { name: 'Register' }).click();
    await expect(page).toHaveURL(/\/register/);
    await expect(page.locator('form')).toContainText(/already|registered|exists|could not create/i);
  });

  test('ST-027 rejects empty required registration fields without submitting', async ({ page }) => {
    requireStaging();
    await open(page, '/register');
    await page.getByRole('button', { name: 'Register' }).click();
    await expect(page).toHaveURL(/\/register/);
    await expect(page.locator('form')).toContainText('Fill in every field to create an account.');
  });

  test('ST-028 rejects invalid form values', async ({ page }) => {
    requireStaging();
    await open(page, '/register');
    await fillRegistration(page, {
      email: 'not-an-email',
      password: 'A-valid-length-password-123!',
    });
    await page.getByRole('button', { name: 'Register' }).click();
    await expect(page.locator('input[type="email"]')).toBeFocused();
    expect(await page.locator('input[type="email"]').evaluate((input) => input.validity.valid)).toBe(false);
    await expect(page).toHaveURL(/\/register/);
  });

  test('ST-029 logs out and refuses a protected page', async ({ page }) => {
    requireStaging('PW_USER_EMAIL', 'PW_USER_PASSWORD');
    await login(page, process.env.PW_USER_EMAIL, process.env.PW_USER_PASSWORD);
    await page.getByRole('button', { name: /Logout/i }).click();
    await open(page, '/profile');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible();
  });

  test('ST-030 redirects an expired or missing session away from protected data', async ({ page }) => {
    requireStaging('PW_USER_EMAIL', 'PW_USER_PASSWORD');
    await login(page, process.env.PW_USER_EMAIL, process.env.PW_USER_PASSWORD);
    await page.context().clearCookies();
    await page.evaluate(() => localStorage.clear());
    await open(page, '/profile');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('body')).not.toContainText('Personal Details');
  });

  test('ST-031 rejects a password shorter than the required 12 characters', async ({ page }) => {
    requireStaging();
    await open(page, '/register');
    await fillRegistration(page, { email: 'weak-password@example.test', password: 'Short1!' });
    await page.getByRole('button', { name: 'Register' }).click();
    await expect(page.locator('form')).toContainText('Password must be at least 12 characters.');
    await expect(page).toHaveURL(/\/register/);
  });

  test('ST-032 rejects an invalid recovery email without submitting', async ({ page }) => {
    requireStaging();
    await open(page, '/forgot-password');
    const email = page.getByLabel('Email address');
    await email.fill('invalid-email');
    await page.getByRole('button', { name: 'Submit' }).click();
    expect(await email.evaluate((input) => input.validity.valid)).toBe(false);
    await expect(page).toHaveURL(/\/forgot-password/);
  });

  test('ST-033 rejects an invalid attachment type before a post is uploaded', async ({ page }) => {
    await openCommunityComposer(page);
    const input = page.locator('input[type="file"]');
    await input.setInputFiles({
      name: 'unsafe.exe',
      mimeType: 'application/octet-stream',
      buffer: Buffer.from('not allowed'),
    });
    await expect(page.getByRole('alert')).toContainText(/unsupported file type/i);
    await expect(page.getByText('unsafe.exe', { exact: true })).toHaveCount(0);
  });

  test('ST-034 rejects an image larger than the 8 MB per-file limit', async ({ page }) => {
    await openCommunityComposer(page);
    const input = page.locator('input[type="file"]');
    await input.setInputFiles({
      name: 'oversized.png',
      mimeType: 'image/png',
      buffer: Buffer.alloc(8 * MB + 1),
    });
    await expect(page.getByRole('alert')).toContainText(/exceeds the 8 MB limit/i);
    await expect(page.getByText('oversized.png', { exact: true })).toHaveCount(0);
  });

  test('ST-035 creates a new admin news draft', async ({ page }) => {
    requireStaging('PW_ADMIN_EMAIL', 'PW_ADMIN_PASSWORD', 'PW_NEWS_CREATE_TITLE');
    await login(page, process.env.PW_ADMIN_EMAIL, process.env.PW_ADMIN_PASSWORD);
    await open(page, '/admin/news');
    await page.getByRole('button', { name: /Create news|New draft/i }).click();
    await page.getByLabel('Title').fill(process.env.PW_NEWS_CREATE_TITLE);
    await page.getByLabel('Body').fill('Short system-test news draft.');
    await page.getByRole('button', { name: /Save draft|Create draft/i }).click();
    await expect(page.getByDisplayValue(process.env.PW_NEWS_CREATE_TITLE)).toBeVisible();
  });

  test('ST-036 edits a seeded admin news draft and persists the change', async ({ page }) => {
    requireStaging('PW_ADMIN_EMAIL', 'PW_ADMIN_PASSWORD', 'PW_NEWS_EDIT_TITLE');
    await login(page, process.env.PW_ADMIN_EMAIL, process.env.PW_ADMIN_PASSWORD);
    await open(page, '/admin/news');
    const card = draftCard(page, process.env.PW_NEWS_EDIT_TITLE);
    const updatedTitle = `${process.env.PW_NEWS_EDIT_TITLE} edited`;
    await card.getByLabel('Title').fill(updatedTitle);
    await card.getByRole('button', { name: 'Save edits' }).click();
    await expect(card.getByRole('status')).toContainText('Saved');
    await page.reload();
    await expect(page.getByDisplayValue(updatedTitle)).toBeVisible();
  });

  test('ST-037 approves and publishes a seeded admin news draft', async ({ page }) => {
    requireStaging('PW_ADMIN_EMAIL', 'PW_ADMIN_PASSWORD', 'PW_NEWS_APPROVE_TITLE');
    await login(page, process.env.PW_ADMIN_EMAIL, process.env.PW_ADMIN_PASSWORD);
    await open(page, '/admin/news');
    const card = draftCard(page, process.env.PW_NEWS_APPROVE_TITLE);
    await card.getByRole('button', { name: 'Approve', exact: true }).click();
    await expect(card.getByRole('status')).toContainText('Published');
    await open(page, '/news');
    await expect(page.locator('body')).toContainText(process.env.PW_NEWS_APPROVE_TITLE);
  });

  test('ST-038 rejects a seeded admin news draft and keeps it out of public news', async ({ page }) => {
    requireStaging('PW_ADMIN_EMAIL', 'PW_ADMIN_PASSWORD', 'PW_NEWS_REJECT_TITLE');
    await login(page, process.env.PW_ADMIN_EMAIL, process.env.PW_ADMIN_PASSWORD);
    await open(page, '/admin/news');
    const card = draftCard(page, process.env.PW_NEWS_REJECT_TITLE);
    await card.getByRole('button', { name: 'Reject', exact: true }).click();
    await expect(card.getByRole('status')).toContainText('Rejected');
    await open(page, '/news');
    await expect(page.locator('body')).not.toContainText(process.env.PW_NEWS_REJECT_TITLE);
  });

  test('ST-039 preserves the selected page across a browser refresh', async ({ page }) => {
    await open(page, '/esg');
    await expect(page.getByRole('heading', { name: 'ESG Indicators' })).toBeVisible();
    await page.reload();
    await expect(page).toHaveURL(/\/esg/);
    await expect(page.getByRole('heading', { name: 'ESG Indicators' })).toBeVisible();
    await expect(page.locator('body')).not.toContainText(/unexpected error|404/i);
  });

  test('ST-040 restores the correct routes with browser Back and Forward', async ({ page }) => {
    await open(page, '/esg');
    await open(page, '/sdg');
    await page.goBack();
    await expect(page).toHaveURL(/\/esg/);
    await expect(page.getByRole('heading', { name: 'ESG Indicators' })).toBeVisible();
    await page.goForward();
    await expect(page).toHaveURL(/\/sdg/);
    await expect(page.getByRole('heading', { name: 'SDG Progress' })).toBeVisible();
  });
});
