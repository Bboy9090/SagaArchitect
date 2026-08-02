/* eslint-disable @typescript-eslint/no-require-imports */
const puppeteer = require('puppeteer-core');
const postgres = require('postgres');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const CONFIGURATION = 'PCS-CHR-1440';
const BASE_URL = process.env.STAGING_BASE_URL;
const DATABASE_URL = process.env.DATABASE_MIGRATION_URL;
const EXECUTABLE_PATH = process.env.BROWSER_EXECUTABLE_PATH;
const ARTIFACT_DIR = path.resolve('artifacts/staging-browser');

function requireConfiguration() {
  if (process.env.APP_ENV !== 'staging') throw new Error('Browser acceptance requires APP_ENV=staging.');
  if (process.env.STAGING_CONFIRM_ISOLATED !== 'true' || process.env.ALLOW_REMOTE_TESTS !== 'true') {
    throw new Error('Browser acceptance requires explicit isolated-staging and remote-test approval.');
  }
  if (!BASE_URL || new URL(BASE_URL).protocol !== 'https:') {
    throw new Error('STAGING_BASE_URL must be a remote HTTPS URL.');
  }
  if (!DATABASE_URL) throw new Error('DATABASE_MIGRATION_URL is required for browser test cleanup.');
  if (!EXECUTABLE_PATH || !fs.existsSync(EXECUTABLE_PATH)) {
    throw new Error('BROWSER_EXECUTABLE_PATH must point to an installed Chromium/Chrome executable.');
  }
}

async function run() {
  requireConfiguration();
  await fs.promises.mkdir(ARTIFACT_DIR, { recursive: true });
  const sql = postgres(DATABASE_URL, { ssl: 'require', max: 1 });
  const suffix = randomUUID().slice(0, 8);
  const email = `pcs-browser-${suffix}@example.test`;
  const password = `PCS-Browser-${suffix}-Password!`;
  const startedAt = Date.now();
  const evidence = {
    ok: false,
    configuration: CONFIGURATION,
    viewport: { width: 1440, height: 900 },
    startedAt: new Date(startedAt).toISOString(),
    deployment: BASE_URL,
    finalUrl: null,
    cookieNames: [],
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
    screenshot: `artifacts/staging-browser/${CONFIGURATION}.png`,
    cleanup: { userDeleted: false },
  };

  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: EXECUTABLE_PATH,
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-background-networking',
        '--disable-default-apps',
        '--disable-extensions',
        '--disable-sync',
        '--metrics-recording-only',
        '--no-first-run',
      ],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
    page.on('console', (message) => {
      if (message.type() === 'error') evidence.consoleErrors.push(message.text().slice(0, 500));
    });
    page.on('pageerror', (error) => evidence.pageErrors.push(error.message.slice(0, 500)));
    page.on('requestfailed', (request) => {
      const failure = request.failure();
      evidence.failedRequests.push({
        url: request.url(),
        method: request.method(),
        errorText: failure?.errorText || 'unknown',
      });
    });

    const registerUrl = new URL('/register', BASE_URL).toString();
    const response = await page.goto(registerUrl, { waitUntil: 'networkidle2', timeout: 45_000 });
    if (!response || response.status() !== 200) {
      throw new Error(`Registration page returned ${response?.status() ?? 'no response'}.`);
    }

    const heading = await page.$eval('h1', (element) => element.textContent?.trim() || '');
    if (!/Open Your Studio/i.test(heading)) throw new Error(`Unexpected registration heading: ${heading}`);

    await page.type('input[type="text"]', 'PCS Browser Acceptance');
    await page.type('input[type="email"]', email);
    const passwordInputs = await page.$$('input[type="password"]');
    if (passwordInputs.length !== 2) throw new Error('Registration page does not contain two password fields.');
    await passwordInputs[0].type(password);
    await passwordInputs[1].type(password);

    await Promise.all([
      page.waitForFunction(() => window.location.pathname === '/dashboard', { timeout: 45_000 }),
      page.click('button[type="submit"]'),
    ]);

    evidence.finalUrl = page.url();
    if (new URL(page.url()).pathname !== '/dashboard') {
      throw new Error(`Registration did not reach the dashboard: ${page.url()}`);
    }

    const dashboardText = await page.$eval('body', (element) => element.textContent || '');
    if (!/Phoenix Creator Studio|studio|project/i.test(dashboardText)) {
      throw new Error('Dashboard did not render recognizable studio content.');
    }

    const cookies = await page.cookies();
    evidence.cookieNames = cookies.map((cookie) => cookie.name).sort();
    const sessionCookie = cookies.find((cookie) => cookie.name === '__Secure-next-auth.session-token');
    if (!sessionCookie) throw new Error('Secure Auth.js session cookie is missing in the browser.');
    if (!sessionCookie.secure || !sessionCookie.httpOnly || sessionCookie.sameSite !== 'Lax') {
      throw new Error('Browser session cookie does not satisfy Secure, HttpOnly, and SameSite=Lax policy.');
    }
    if (cookies.some((cookie) => cookie.name === 'next-auth.session-token')) {
      throw new Error('Browser received a non-secure Auth.js session cookie name.');
    }

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, `${CONFIGURATION}.png`),
      fullPage: true,
    });

    const severeConsoleErrors = evidence.consoleErrors.filter(
      (message) => !/favicon|third-party|analytics/i.test(message),
    );
    const severeFailedRequests = evidence.failedRequests.filter(
      (failure) => !/favicon|analytics|vercel-insights/i.test(failure.url),
    );
    if (evidence.pageErrors.length || severeConsoleErrors.length || severeFailedRequests.length) {
      throw new Error(
        `Browser runtime errors detected: page=${evidence.pageErrors.length}, console=${severeConsoleErrors.length}, requests=${severeFailedRequests.length}.`,
      );
    }

    evidence.ok = true;
  } finally {
    if (browser) await browser.close().catch(() => undefined);
    await sql`delete from users where email = ${email}`.catch(() => undefined);
    evidence.cleanup.userDeleted = true;
    await sql.end({ timeout: 5 });
    evidence.completedAt = new Date().toISOString();
    evidence.durationMs = Date.now() - startedAt;
    await fs.promises.writeFile(
      path.join(ARTIFACT_DIR, `${CONFIGURATION}.json`),
      `${JSON.stringify(evidence, null, 2)}\n`,
      'utf8',
    );
    console.log(JSON.stringify(evidence, null, 2));
  }

  if (!evidence.ok) process.exitCode = 1;
}

run().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : 'Browser staging acceptance failed.');
  process.exitCode = 1;
});
