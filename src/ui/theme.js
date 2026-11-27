// Tema: admin sozlamasi (Ko'rinish va til) → foydalanuvchi tanlovi (localStorage) → tizim sozlamasi.
const KEY = 'regup-theme';
let policy = { themes: 'both', defaultTheme: 'system' };
const stored = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
const system = () => (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
/** Foydalanuvchi temani o'zi almashtira oladimi (admin ikkala temani ham yoqqan bo'lsa). */
export const canToggleTheme = () => policy.themes === 'both';
export function currentTheme() {
  if (policy.themes !== 'both') return policy.themes;
  return stored() || (policy.defaultTheme === 'system' ? system() : policy.defaultTheme);
}
export function applyTheme(t = currentTheme()) {
  document.documentElement.dataset.theme = t;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || (t === 'dark' ? '#12201b' : '#eef3f0'));
  return t;
}
export function setTheme(t) {
  try { localStorage.setItem(KEY, t); } catch { /* saqlab bo'lmasa ham ishlaydi */ }
  return applyTheme(t);
}
export function initTheme() {
  applyTheme();
  const mq = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
  if (mq && mq.addEventListener) mq.addEventListener('change', () => { if (!stored()) applyTheme(); });
}
/** Admin sozlamasini qo'llaydi: mavjud temalar, standart tema va brend ranglari (CSS o'zgaruvchilari). */
export function applyBrand({ themes, defaultTheme }, css) {
  policy = { themes, defaultTheme };
  let el = document.getElementById('regup-brand');
  if (!el) { el = document.createElement('style'); el.id = 'regup-brand'; document.head.appendChild(el); }
  if (el.textContent !== css) el.textContent = css;
  return applyTheme();
}
