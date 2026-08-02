/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium, firefox, webkit } = require('playwright');
const postgres = require('postgres');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const BASE_URL = process.env.STAGING_BASE_URL;
const DATABASE_URL = process.env.DATABASE_MIGRATION_URL;
const ENGINE = process.env.BROWSER_ENGINE?.trim().toLowerCase();
const ARTIFACT_DIR = path.resolve('artifacts/staging-browser');

const BROWSER_CONFIGURATIONS = Object.freeze({
  chromium: { browserType: chromium, configuration: 'PCS-CHR-1440' },
  firefox: { browserType: firefox, configuration: 'PCS-FF-1440' },
  webkit: { browserType: webkit, configuration: 'PCS-WK-1440' },
});

function requireConfiguration() {
  if (process.env.APP_ENV !== 'staging') throw new Error('Browser acceptance requires APP_ENV=staging.');
  if (process.env.STAGING_CONFIRM_ISOLATED !== 'true' || process.env.ALLOW_REMOTE_TESTS !== 'true') {
    throw new Error('Browser acceptance requires explicit isolated-staging and remote-test approval.');
  }
  if (!BASE_URL || new URL(BASE_URL).protocol !== 'https:') {
    throw new Error('STAGING_BASE_URL must be a remote HTTPS URL.');
  }
  if (!DATABASE_URL) throw new Error('DATABASE_MIGRATION_URL is required for browser test cleanup.');
  if (!ENGINE || !Object.hasOwn(BROWSER_CONFIGURATIONS, ENGINE)) {
    throw new Error('BROWSER_ENGINE must be one of chromium, firefox, or webkit.');
  }
  if (process.env.PRODUCTION_BASE_URL) {
    const stagingOrigin = new URL(BASE_URL).origin;
    const productionOrigin = new URL(process.env.PRODUCTION_BASE_URL).origin;
    if (stagingOrigin === productionOrigin) {
      throw new Error('Browser acceptance refuses to run against the configured production origin.');
    }
  }
}

function isIgnorableConsoleError(message) {
  return /favicon|analytics|vercel-insights|third-party/i.test(message);
}

function isIgnorableRequestFailure(failure) {
  if (/favicon|analytics|vercel-insights/i.test(failure.url)) return true;
  return /ERR_ABORTED|NS_BINDING_ABORTED|cancelled|canceled/i.test(failure.errorText);
}

async function run() {
  requireConfiguration();
  await fs.promises.mkdir(ARTIFACT_DIR, { recursive: true });

  const { browserType, configuration } = BROWSER_CONFIGURATIONS[ENGINE];
  const sql = postgres(DATABASE_URL, { ssl: 'require', max: 1, prepare: false });
  const suffix = randomUUID().slice(0, 8);
  const email = `pcs-${ENGINE}-${suffix}@example.test`;
  const password = `PCS-${ENGINE}-${suffix}-Password!`;
  const startedAt = Date.now();
  const evidence = {
    ok: false,
    configuration,
    engine: ENGINE,
    browserVersion: null,
    viewport: { width: 1440, height: 900 },
    startedAt: new Date(startedAt).toISOString(),
    deployment: BASE_URL,
    finalUrl: null,
    cookieNames: [],
    sessionCookiePolicy: null,
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
    screenshot: `artifacts/staging-browser/${configuration}.png`,
    cleanup: { userDeleted: false, deletedUserCount: 0 },
  };

  let browser;
  let context;
  try {
    browser = await browserType.launch({ headless: true });
    evidence.browserVersion = browser.version();
    context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
      ignoreHTTPSErrors: false,
    });

    const page = await context.newPage();
    page.on('console', (message) => {
      if (message.type() === 'error') evidence.consoleErrors.push(message.text().slice(0, 500));
    });
    page.on('pageerror', (error) => evidence.pageErrors.push(error.message.slice(0, 500)));
    page.on('requestfailed', (request) => {
      const failure = request.failure();
      evidence.failedRequests.push({
        url: request.url(),
        method: request.method(),
        resourceType: request.resourceType(),
        errorText: failure?.errorText || 'unknown',
      });
    });

    const registerUrl = new URL('/register', BASE_URL).toString();
    const response = await page.goto(registerUrl, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    if (!response || response.status() !== 200) {
      throw new Error(`Registration page returned ${response?.status() ?? 'no response'}.`);
    }

    const heading = page.locator('h1').first();
    await heading.waitFor({ state: 'visible', timeout: 20_000 });
    const headingText = (await heading.textContent())?.trim() || '';
    if (!/Open Your Studio/i.test(headingText)) throw new Error(`Unexpected registration heading: ${headingText}`);

    await page.locator('input[autocomplete="name"]').fill('PCS Browser Acceptance');
    await page.locator('input[autocomplete="email"]').fill(email);
    const passwordInputs = page.locator('input[autocomplete="new-password"]');
    if (await passwordInputs.count() !== 2) throw new Error('Registration page does not contain two password fields.');
    await passwordInputs.nth(0).fill(password);
    await passwordInputs.nth(1).fill(password);

    await Promise.all([
      page.waitForURL((url) => url.pathname === '/dashboard', { timeout: 45_000 }),
      page.locator('button[type="submit"]').click(),
    ]);

    evidence.finalUrl = page.url();
    if (new URL(page.url()).pathname !== '/dashboard') {
      throw new Error(`Registration did not reach the dashboard: ${page.url()}`);
    }

    const dashboardText = await page.locator('body').innerText();
    if (!/Phoenix Creator Studio|studio|project/i.test(dashboardText)) {
      throw new Error('Dashboard did not render recognizable studio content.');
    }

    const cookies = await context.cookies(BASE_URL);
    evidence.cookieNames = cookies.map((cookie) => cookie.name).sort();
    const sessionCookie = cookies.find((cookie) => cookie.name === '__Secure-next-auth.session-token');
    if (!sessionCookie) throw new Error('Secure Auth.js session cookie is missing in the browser.');
    evidence.sessionCookiePolicy = {
      secure: sessionCookie.secure,
      httpOnly: sessionCookie.httpOnly,
      sameSite: sessionCookie.sameSite,
      path: sessionCookie.path,
    };
    if (!sessionCookie.secure || !sessionCookie.httpOnly || sessionCookie.sameSite !== 'Lax') {
      throw new Error('Browser session cookie does not satisfy Secure, HttpOnly, and SameSite=Lax policy.');
    }
    if (cookies.some((cookie) => cookie.name === 'next-auth.session-token')) {
      throw new Error('Browser received a non-secure Auth.js session cookie name.');
    }

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, `${configuration}.png`),
      fullPage: true,
    });

    const severeConsoleErrors = evidence.consoleErrors.filter((message) => !isIgnorableConsoleError(message));
    const severeFailedRequests = evidence.failedRequests.filter((failure) => !isIgnorableRequestFailure(failure));
    if (evidence.pageErrors.length || severeConsoleErrors.length || severeFailedRequests.length) {
      throw new Error(
        `Browser runtime errors detected: page=${evidence.pageErrors.length}, console=${severeConsoleErrors.length}, requests=${severeFailedRequests.length}.`,
      );
    }

    evidence.ok = true;
  } finally {
    if (context) await context.close().catch(() => undefined);
    if (browser) await browser.close().catch(() => undefined);

    const deletedUsers = await sql`delete from users where email = ${email} returning id`.catch(() => []);
    evidence.cleanup.deletedUserCount = deletedUsers.length;
    evidence.cleanup.userDeleted = deletedUsers.length === 1;
    await sql.end({ timeout: 5 });

    evidence.completedAt = new Date().toISOString();
    evidence.durationMs = Date.now() - startedAt;
    await fs.promises.writeFile(
      path.join(ARTIFACT_DIR, `${configuration}.json`),
      `${JSON.stringify(evidence, null, 2)}\n`,
      'utf8',
    );
    console.log(JSON.stringify(evidence, null, 2));
  }

  if (!evidence.ok || !evidence.cleanup.userDeleted) process.exitCode = 1;
}

run().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : 'Browser staging acceptance failed.');
  process.exitCode = 1;
});
