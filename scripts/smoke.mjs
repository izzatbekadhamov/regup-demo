// Joylashdan oldingi avtomatik tekshiruv: dist/ ni ochib, asosiy sahifalarni
// admin va xodim, yorug' va qorong'i tema, kompyuter va telefon o'lchamida tekshiradi.
// Ishlatish: npm run build && node scripts/smoke.mjs [--url http://...]
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const arg = (name) => { const i = process.argv.indexOf(name); return i > -1 ? process.argv[i + 1] : null; };
const PORT = 5190;
let base = arg('--url');
let server = null;

const ADMIN = ['', 'cards', 'cards/c-110', 'onb-dashboard', 'board', 'onboarding', 'tasks', 'integration', 'idp', 'courses', 'teachers', 'models', 'people', 'gamification'];
const EMP = ['', 'results', 'onboarding', 'learning', 'idp', 'career', 'rating', 'more'];
const VIEWS = [
  { name: 'kompyuter', width: 1440, height: 900 },
  { name: 'telefon', width: 390, height: 844 },
];
const THEMES = ['light', 'dark'];

async function startServer() {
  server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' });
  base = `http://localhost:${PORT}/`;
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(base); if (r.ok) return; } catch { /* hali ishga tushmagan */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('vite preview ishga tushmadi');
}

const failures = [];
let checked = 0;

async function checkPage(browser, { mode, route, view, theme }) {
  const ctx = await browser.newContext({ viewport: { width: view.width, height: view.height } });
  await ctx.addInitScript(({ mode, theme }) => {
    localStorage.setItem('regup-theme', theme);
    localStorage.setItem('regup-demo-session', JSON.stringify({ mode, employeeId: 'e-sanjar', userId: 'u-super' }));
  }, { mode, theme });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`JS xato: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)/.test(m.text())) errors.push(`Konsol: ${m.text()}`); });
  const label = `${mode} · #/${route || ''} · ${view.name} · ${theme}`;
  try {
    await page.goto(`${base}#/${route}`, { waitUntil: 'load' });
    await page.waitForSelector('.content', { timeout: 5000 });
    await page.waitForTimeout(150);
    const info = await page.evaluate(() => ({
      text: document.querySelector('.content')?.innerText || '',
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      theme: document.documentElement.dataset.theme,
    }));
    if (info.text.trim().length < 40) errors.push('Sahifa deyarli bo‘sh');
    if (/Sahifa topilmadi|bu bo‘lim uchun huquq yo‘q/.test(info.text)) errors.push('Sahifa topilmadi yoki huquq yo‘q');
    if (info.overflow > 1) errors.push(`Sahifa ekrandan ${info.overflow}px kengayib ketdi`);
    if (info.theme !== theme) errors.push(`Tema qo‘llanmadi (${info.theme})`);
  } catch (e) {
    errors.push(`Ochilmadi: ${e.message.split('\n')[0]}`);
  }
  checked += 1;
  if (errors.length) failures.push({ label, errors });
  await ctx.close();
}

async function checkCommandPalette(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => localStorage.setItem('regup-demo-session', JSON.stringify({ mode: 'admin', userId: 'u-super' })));
  const page = await ctx.newPage();
  await page.goto(`${base}#/`);
  await page.waitForSelector('.content');
  await page.keyboard.press('Control+k');
  const ok = await page.waitForSelector('.ru-cmd', { timeout: 2000 }).then(() => true).catch(() => false);
  checked += 1;
  if (!ok) failures.push({ label: '⌘K qidiruvi', errors: ['Qidiruv oynasi ochilmadi'] });
  await ctx.close();
}

try {
  if (!base) await startServer();
  const browser = await chromium.launch();
  for (const theme of THEMES) for (const view of VIEWS) {
    for (const route of ADMIN) await checkPage(browser, { mode: 'admin', route, view, theme });
    for (const route of EMP) await checkPage(browser, { mode: 'employee', route, view, theme });
  }
  await checkCommandPalette(browser);
  await browser.close();
} catch (e) {
  failures.push({ label: 'Tekshiruvning o‘zi', errors: [e.message] });
} finally {
  if (server) server.kill();
}

if (failures.length) {
  console.error(`\n✗ Tekshiruv o'tmadi: ${failures.length} ta muammo (${checked} ta tekshiruvdan)\n`);
  for (const f of failures) console.error(`- ${f.label}\n    ${f.errors.join('\n    ')}`);
  process.exit(1);
}
console.log(`✓ Tekshiruv o'tdi: ${checked} ta sahifa holati xatosiz`);
