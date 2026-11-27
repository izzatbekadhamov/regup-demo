import { describe, it, expect } from 'vitest';
import { PRESETS, DEFAULT_PREFS, LANGUAGES, brandCss, contrastWarnings, contrast, prefsOf, defaultLang, enabledLangs } from '../src/core/brand.js';
import { savePreferences } from '../src/core/domain.js';
import { createSeed } from '../src/data/seed.js';

const clone = (x) => JSON.parse(JSON.stringify(x));
const base = () => clone(DEFAULT_PREFS);

describe('Ko‘rinish va til', () => {
  it('standart ranglarda qo‘shimcha CSS yo‘q — dizayn o‘zgarmaydi', () => {
    expect(brandCss(DEFAULT_PREFS)).toBe('');
  });
  it('boshqa palitra ikkala tema uchun CSS o‘zgaruvchilarini beradi', () => {
    const css = brandCss({ ...base(), colors: { light: { ...PRESETS[1].light }, dark: { ...PRESETS[1].dark } } });
    expect(css).toContain(":root[data-theme='light']{");
    expect(css).toContain(":root[data-theme='dark']{");
    expect(css).toContain('--primary:#2443c4');
    expect(css).not.toContain('NaN');
  });
  it('barcha tayyor palitralar kontrast talabidan o‘tadi (4.5:1)', () => {
    for (const p of PRESETS) expect(contrastWarnings({ light: p.light, dark: p.dark }), p.name).toEqual([]);
  });
  it('past kontrastli rang uchun ogohlantirish chiqadi', () => {
    const c = { light: { accent: '#9ee0bd', text: '#10241c', confirm: '#1d5c45' }, dark: { ...PRESETS[0].dark } };
    expect(contrastWarnings(c).length).toBeGreaterThan(0);
    expect(contrast('#ffffff', '#000000')).toBeCloseTo(21, 0);
  });
  it('4 ta til: o‘zbek, rus, ingliz, qoraqalpoq; birinchisi — asosiy', () => {
    expect(LANGUAGES.map((l) => l.code)).toEqual(['uz', 'ru', 'en', 'kaa']);
    expect(defaultLang(DEFAULT_PREFS)).toBe('uz');
    expect(enabledLangs(DEFAULT_PREFS)).toHaveLength(4);
  });
  it('eski demo holatida sozlama bo‘lmasa standart qiymatlar olinadi', () => {
    const s = createSeed(); delete s.preferences;
    expect(prefsOf(s).logoText).toBe('RegUP');
  });
  it('saqlash: til tartibi va yoqilgan tillar yoziladi, auditga tushadi', () => {
    const s = createSeed();
    const p = base();
    p.languages = [{ code: 'ru', on: true }, { code: 'uz', on: true }, { code: 'en', on: false }, { code: 'kaa', on: true }];
    const n = savePreferences(s, { prefs: p, actor: 'Test' });
    expect(defaultLang(prefsOf(n))).toBe('ru');
    expect(enabledLangs(prefsOf(n))).toEqual(['ru', 'uz', 'kaa']);
    expect(n.audit[0].action).toBe('Ko‘rinish va til');
  });
  it('saqlash: noto‘g‘ri qiymatlar rad etiladi', () => {
    const s = createSeed();
    const offFirst = base(); offFirst.languages[0].on = false;
    expect(() => savePreferences(s, { prefs: offFirst })).toThrow(/Asosiy til/);
    const badHex = base(); badHex.colors.light.accent = 'qizil';
    expect(() => savePreferences(s, { prefs: badHex })).toThrow(/#RRGGBB/);
    const longText = base(); longText.logoText = 'Juda uzun logotip matni';
    expect(() => savePreferences(s, { prefs: longText })).toThrow(/15 belgi/);
    const noImg = base(); noImg.logoMode = 'image';
    expect(() => savePreferences(s, { prefs: noImg })).toThrow(/rasmini/);
  });
  it('bitta tema tanlansa standart tema ham shu bo‘ladi', () => {
    const p = base(); p.themes = 'light'; p.defaultTheme = 'dark';
    expect(prefsOf(savePreferences(createSeed(), { prefs: p })).defaultTheme).toBe('light');
  });
});
