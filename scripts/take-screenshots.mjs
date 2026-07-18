import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.KANBRIO_WEB_URL ?? 'http://localhost:5173';
const API_BASE = process.env.KANBRIO_API_URL ?? 'http://localhost:3000';
const OUT = resolve(__dirname, '../docs/screenshots');
const LOGIN_EMAIL = process.env.KANBRIO_DEMO_EMAIL ?? 'admin@test.com';
const LOGIN_PASSWORD = process.env.KANBRIO_DEMO_PASSWORD ?? 'password123'; // pragma: allowlist secret

const workspaceIds = {
  'product-launch': '550e8400-e29b-41d4-a716-446655440000',
  'bug-tracker': '550e8400-e29b-41d4-a716-446655440100',
};

const shot = async (page, name) => {
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
  console.log(`  ✓ ${name}.png`);
};

const main = async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();

  // Login via API
  console.log('0. Logging in...');
  const loginCtx = await browser.newContext();
  const loginResp = await loginCtx.request.post(`${API_BASE}/api/auth/login`, {
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
    data: { email: LOGIN_EMAIL, password: LOGIN_PASSWORD },
  });
  if (!loginResp.ok()) {
    console.error('Login failed:', await loginResp.text());
    await browser.close();
    process.exit(1);
  }
  const user = await loginResp.json();
  console.log(`   Logged in as: ${user.name}`);
  const cookies = await loginCtx.cookies();
  await loginCtx.close();
  await ctx.addCookies(cookies.map(c => ({
    name: c.name, value: c.value, domain: 'localhost', path: '/',
    httpOnly: c.httpOnly, secure: c.secure, sameSite: c.sameSite,
  })));

  // 1. Login page
  console.log('1. Login page');
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await shot(page, 'login');

  // 2. Product Launch board
  console.log('2. Product Launch board');
  await page.goto(`${BASE}/w/${workspaceIds['product-launch']}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  await shot(page, 'board-product-launch');

  // 3. Bug Tracker board
  console.log('3. Bug Tracker board');
  await page.goto(`${BASE}/w/${workspaceIds['bug-tracker']}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  await shot(page, 'board-bug-tracker');

  // 4-8. Analytics tabs (Product Launch)
  const analyticsUrl = `${BASE}/w/${workspaceIds['product-launch']}/analytics`;
  console.log('4. Analytics - Cumulative Flow');
  await page.goto(analyticsUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  await shot(page, 'analytics-cfd');

  console.log('5. Analytics - Cycle Time');
  await page.click('[data-testid="tab-cycle-time"]');
  await page.waitForTimeout(3000);
  await shot(page, 'analytics-cycle-time');

  console.log('6. Analytics - Flow Efficiency');
  await page.click('[data-testid="tab-flow-efficiency"]');
  await page.waitForTimeout(3000);
  await shot(page, 'analytics-flow-efficiency');

  console.log('7. Analytics - Aging WIP');
  await page.click('[data-testid="tab-aging-wip"]');
  await page.waitForTimeout(3000);
  await shot(page, 'analytics-aging-wip');

  console.log('8. Analytics - Monte Carlo');
  await page.click('[data-testid="tab-monte-carlo"]');
  await page.waitForTimeout(3000);
  await shot(page, 'analytics-monte-carlo');

  // 9. Settings
  console.log('9. Product Launch settings');
  await page.goto(`${BASE}/w/${workspaceIds['product-launch']}/settings`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await shot(page, 'settings-product-launch');

  await browser.close();
  console.log('\nFile sizes:');
  const fs = await import('fs');
  const files = fs.readdirSync(OUT).filter(f => f.endsWith('.png')).sort();
  for (const f of files) {
    const size = fs.statSync(`${OUT}/${f}`).size;
    console.log(`  ${f}: ${(size / 1024).toFixed(1)} KB`);
  }
};

main().catch(console.error);
