// Ko'rinish va til sozlamalari (Exode «Оформление и бренд» bo'limiga o'xshash).
// Admin 3 ta rangni tanlaydi — urg'u, asosiy matn, tasdiqlash tugmasi — qolgan ohanglar shulardan hisoblanadi.

export const LANGUAGES = [
  { code: 'uz', label: 'O‘zbekcha', short: 'UZ' },
  { code: 'ru', label: 'Русский', short: 'RU' },
  { code: 'en', label: 'English', short: 'EN' },
  { code: 'kaa', label: 'Qaraqalpaqsha', short: 'QQ' },
];
export const LANG_LABEL = Object.fromEntries(LANGUAGES.map((l) => [l.code, l.label]));

export const COLOR_FIELDS = [
  ['accent', 'Urg‘u rangi', 'Havolalar, tanlangan menyu bandi, progress, «Bugun» bloki'],
  ['text', 'Asosiy matn rangi', 'Sarlavha va oddiy matn'],
  ['confirm', 'Tasdiqlash tugmasi rangi', 'Asosiy tugma: «Saqlash», «Tasdiqlash», «Davom etish»'],
];

/** Tayyor brend palitralari. Birinchisi — standart (Zumrad). */
export const PRESETS = [
  { id: 'zumrad', name: 'Zumrad', note: 'Standart', light: { accent: '#1d6b4f', text: '#10241c', confirm: '#1d5c45' }, dark: { accent: '#9ee0bd', text: '#e9f2ed', confirm: '#2f7d5f' } },
  { id: 'lojuvard', name: 'Lojuvard', note: 'Registon koshinlari', light: { accent: '#2f4fbf', text: '#141b2d', confirm: '#2443c4' }, dark: { accent: '#9fb3ff', text: '#e8ecf7', confirm: '#4865e8' } },
  { id: 'registon', name: 'Registon', note: 'Kompaniya brendi (to‘q sariq)', light: { accent: '#b8461c', text: '#231a15', confirm: '#c8461f' }, dark: { accent: '#ffa47e', text: '#f5ece6', confirm: '#c24a1c' } },
  { id: 'binafsha', name: 'Binafsha', note: 'Yumshoq', light: { accent: '#5b4fb0', text: '#1f1b33', confirm: '#5b4fb0' }, dark: { accent: '#b9b0f0', text: '#ece9f7', confirm: '#6c5fd0' } },
  { id: 'grafit', name: 'Grafit', note: 'Neytral', light: { accent: '#36505f', text: '#151c21', confirm: '#2c3e4a' }, dark: { accent: '#a9c3d1', text: '#e7edf1', confirm: '#4a6575' } },
];

export const DEFAULT_PREFS = {
  logoMode: 'text', // 'text' | 'image'
  logoText: 'RegUP',
  logoImage: null, // dataURL
  icon: null, // dataURL
  themes: 'both', // 'both' | 'light' | 'dark'
  defaultTheme: 'system', // 'system' | 'light' | 'dark'
  colors: { light: { ...PRESETS[0].light }, dark: { ...PRESETS[0].dark } },
  languages: LANGUAGES.map((l) => ({ code: l.code, on: true })), // tartib = ko'rinish tartibi, birinchisi — asosiy
};

export const LOGO_TEXT_MAX = 15;
export const IMAGE_MAX_BYTES = 300 * 1024;

/** Saqlangan sozlamani standart qiymatlar bilan to'ldiradi (eski demo holatida maydon bo'lmasligi mumkin). */
export function prefsOf(state) {
  const p = state?.preferences || {};
  return {
    ...DEFAULT_PREFS,
    ...p,
    colors: { light: { ...DEFAULT_PREFS.colors.light, ...p.colors?.light }, dark: { ...DEFAULT_PREFS.colors.dark, ...p.colors?.dark } },
    languages: p.languages?.length ? p.languages : DEFAULT_PREFS.languages,
  };
}
export const defaultLang = (prefs) => prefs.languages.find((l) => l.on)?.code || 'uz';
export const enabledLangs = (prefs) => prefs.languages.filter((l) => l.on).map((l) => l.code);

// ---------- Rang hisob-kitoblari ----------
const HEX = /^#([0-9a-f]{6})$/i;
export const isHex = (v) => typeof v === 'string' && HEX.test(v);
const toRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const toHex = (rgb) => '#' + rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
/** a va b ni aralashtiradi: t=0 → a, t=1 → b. */
export function mix(a, b, t) {
  const x = toRgb(a), y = toRgb(b);
  return toHex(x.map((v, i) => v + (y[i] - v) * t));
}
function luminance(h) {
  return toRgb(h).map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; })
    .reduce((acc, c, i) => acc + c * [0.2126, 0.7152, 0.0722][i], 0);
}
export function contrast(a, b) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (l1 + 0.05) / (l2 + 0.05);
}
/** Rangli fon ustidagi matn: oq yoki to'q — qaysi biri kontrastliroq bo'lsa. */
export const onColor = (bg) => (contrast(bg, '#ffffff') >= contrast(bg, '#111111') ? '#ffffff' : '#111111');

const LIGHT_BASE = { bg: '#f3f5f4', surface: '#ffffff' };
const DARK_BASE = { bg: '#101312', surface: '#191d1c' };

/** Kontrast tekshiruvi: har bir tema uchun ogohlantirishlar ro'yxati (bo'sh — hammasi joyida). */
export function contrastWarnings(colors) {
  const out = [];
  for (const [theme, c, base] of [['Yorug‘', colors.light, LIGHT_BASE], ['Qorong‘i', colors.dark, DARK_BASE]]) {
    const surface = base.surface;
    if (contrast(c.text, surface) < 4.5) out.push(`${theme} tema: matn foni bilan kontrasti past (${contrast(c.text, surface).toFixed(1)}:1, kerak 4.5:1).`);
    if (contrast(c.accent, surface) < 4.5) out.push(`${theme} tema: urg‘u rangidagi havola va yozuvlar o‘qilishi qiyin (${contrast(c.accent, surface).toFixed(1)}:1).`);
    const on = onColor(c.confirm);
    if (contrast(c.confirm, on) < 4.5) out.push(`${theme} tema: tasdiqlash tugmasidagi yozuv o‘qilishi qiyin (${contrast(c.confirm, on).toFixed(1)}:1).`);
  }
  return out;
}

const isDefaultColors = (colors) => ['light', 'dark'].every((t) => COLOR_FIELDS.every(([k]) => colors[t][k].toLowerCase() === DEFAULT_PREFS.colors[t][k]));

function lightVars({ accent: a, text: t, confirm: c }) {
  const bg = mix(a, LIGHT_BASE.bg, 0.94);
  const soft = mix(a, '#ffffff', 0.86);
  const on = onColor(c);
  return {
    '--bg': bg, '--side': mix(a, '#eceeed', 0.9), '--nav-bg': mix(a, '#eceeed', 0.9), '--topbar-bg': bg + 'e0',
    '--surface-sunken': mix(a, '#eceeed', 0.92), '--muted-soft': mix(a, '#eceeed', 0.92), '--sunken': mix(a, '#f6f7f7', 0.95), '--hover': mix(a, '#ffffff', 0.93),
    '--line': mix(a, '#e2e5e4', 0.92), '--line-2': mix(a, '#eaeceb', 0.93),
    '--ink': t, '--ink-2': mix(t, '#ffffff', 0.28), '--ink-3': mix(t, '#ffffff', 0.38), '--ink-muted': mix(t, '#ffffff', 0.28), '--ink-subtle': mix(t, '#ffffff', 0.38),
    '--side-ink': mix(t, '#ffffff', 0.2), '--nav-ink': mix(t, '#ffffff', 0.2), '--side-mute': mix(t, '#ffffff', 0.4), '--nav-muted': mix(t, '#ffffff', 0.4),
    '--brand': a, '--brand-2': mix(a, '#000000', 0.15), '--brand-soft': soft, '--brand-line': mix(a, '#ffffff', 0.65), '--callout-ink': mix(a, '#000000', 0.2),
    '--primary-text': a, '--primary-soft': soft, '--focus': a, '--side-2': mix(a, '#ffffff', 0.8), '--nav-active': mix(a, '#ffffff', 0.8),
    '--teal': a, '--teal-soft': soft, '--teal-line': mix(a, '#ffffff', 0.65), '--accent': mix(a, '#ffffff', 0.2), '--accent-text': a, '--accent-soft': soft,
    '--primary': c, '--primary-hover': mix(c, '#000000', 0.15), '--brand-ink': on, '--confirm-ink': on,
    '--hero-from': c, '--hero-to': mix(c, '#000000', 0.4), '--mint': mix(a, '#ffffff', 0.62), '--accent-on-brand': mix(a, '#ffffff', 0.62),
  };
}
function darkVars({ accent: a, text: t, confirm: c }) {
  const bg = mix(c, DARK_BASE.bg, 0.9);
  const soft = mix(c, DARK_BASE.surface, 0.7);
  const on = onColor(c);
  return {
    '--bg': bg, '--panel': mix(c, DARK_BASE.surface, 0.9), '--surface': mix(c, DARK_BASE.surface, 0.9), '--side': mix(c, '#141817', 0.9), '--nav-bg': mix(c, '#141817', 0.9), '--topbar-bg': bg + 'e0',
    '--surface-sunken': mix(c, '#1f2423', 0.88), '--muted-soft': mix(c, '#1f2423', 0.88), '--sunken': mix(c, '#151918', 0.9), '--hover': mix(c, '#1e2322', 0.85),
    '--line': mix(c, '#2a302e', 0.85), '--line-2': mix(c, '#1f2423', 0.88),
    '--ink': t, '--ink-2': mix(t, DARK_BASE.bg, 0.3), '--ink-3': mix(t, DARK_BASE.bg, 0.42), '--ink-muted': mix(t, DARK_BASE.bg, 0.3), '--ink-subtle': mix(t, DARK_BASE.bg, 0.42),
    '--side-ink': mix(t, DARK_BASE.bg, 0.3), '--nav-ink': mix(t, DARK_BASE.bg, 0.3), '--side-mute': mix(t, DARK_BASE.bg, 0.45), '--nav-muted': mix(t, DARK_BASE.bg, 0.45),
    '--brand': a, '--brand-2': mix(a, '#ffffff', 0.25), '--brand-soft': soft, '--brand-line': mix(a, DARK_BASE.bg, 0.55), '--callout-ink': mix(a, '#ffffff', 0.25),
    '--primary-text': a, '--primary-soft': soft, '--focus': a, '--side-2': soft, '--nav-active': soft, '--mint': a, '--accent-on-brand': mix(a, '#ffffff', 0.3),
    '--teal': a, '--teal-soft': soft, '--accent': a, '--accent-text': a, '--accent-soft': soft,
    '--primary': c, '--primary-hover': mix(c, '#ffffff', 0.1), '--brand-ink': on, '--confirm-ink': on,
    '--hero-from': mix(c, '#000000', 0.25), '--hero-to': mix(c, '#000000', 0.55),
  };
}
const block = (sel, vars) => `${sel}{${Object.entries(vars).filter(([, v]) => v).map(([k, v]) => `${k}:${v}`).join(';')}}`;

/** Brend ranglari uchun CSS. Standart ranglar tanlangan bo'lsa — bo'sh satr (dizayn o'zgarmaydi). */
export function brandCss(prefs) {
  const colors = prefs.colors;
  if (isDefaultColors(colors)) return '';
  return [
    block(":root[data-theme='light']", lightVars(colors.light)),
    block(":root[data-theme='dark']", darkVars(colors.dark)),
    ".btn.primary,.ru-btn--primary{color:var(--confirm-ink)}",
    ".brand-mark:not(.has-img){background:linear-gradient(150deg,var(--hero-from),var(--hero-to))}",
  ].join('\n');
}
