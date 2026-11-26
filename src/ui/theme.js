// Tema: foydalanuvchi tanlovi (localStorage) yoki tizim sozlamasi (prefers-color-scheme).
const KEY = 'regup-theme';
const stored = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
const system = () => (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
export const currentTheme = () => stored() || system();
export function applyTheme(t = currentTheme()) {
  document.documentElement.dataset.theme = t;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', t === 'dark' ? '#12201b' : '#eef3f0');
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
