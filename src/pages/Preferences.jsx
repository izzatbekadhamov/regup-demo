import { useState } from 'react';
import { useAppState, run, toast } from '../state/store.js';
import { Panel, Pill, BrandMark } from '../ui/common.jsx';
import * as D from '../core/domain.js';
import { prefsOf, PRESETS, COLOR_FIELDS, LANGUAGES, LANG_LABEL, LOGO_TEXT_MAX, IMAGE_MAX_BYTES, contrastWarnings, onColor, isHex, mix, DEFAULT_PREFS } from '../core/brand.js';

const THEME_OPTS = [['both', 'Yorug‘ va qorong‘i'], ['light', 'Faqat yorug‘'], ['dark', 'Faqat qorong‘i']];
const DEFAULT_OPTS = [['system', 'Tizim sozlamasi'], ['light', 'Yorug‘'], ['dark', 'Qorong‘i']];
const LANG_SHORT = Object.fromEntries(LANGUAGES.map((l) => [l.code, l.short]));

function Seg({ value, options, onChange, label }) {
  return (
    <div className="pref-seg" role="radiogroup" aria-label={label}>
      {options.map(([v, l]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} className={value === v ? 'on' : ''} onClick={() => onChange(v)}>{l}</button>
      ))}
    </div>
  );
}

function ImagePick({ value, onChange, label, children }) {
  const pick = (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!f.type.startsWith('image/')) return toast('Rasm fayl tanlang: PNG, SVG, JPG yoki WebP', 'bad');
    if (f.size > IMAGE_MAX_BYTES) return toast(`Rasm ${Math.round(IMAGE_MAX_BYTES / 1024)} KB dan katta bo‘lmasin`, 'bad');
    const r = new FileReader();
    r.onload = () => onChange(String(r.result));
    r.readAsDataURL(f);
  };
  return (
    <div className="pref-img">
      <div className="pref-img-box">{value ? <img src={value} alt="" /> : children}</div>
      <div className="row" style={{ gap: 6 }}>
        <label className="btn sm">{value ? 'Almashtirish' : 'Yuklash'}<input type="file" accept="image/png,image/svg+xml,image/jpeg,image/webp" onChange={pick} hidden aria-label={label} /></label>
        {value && <button type="button" className="btn sm" onClick={() => onChange(null)}>Olib tashlash</button>}
      </div>
    </div>
  );
}

/** Tanlangan ranglarning jonli ko'rinishi: menyu bandi, «Bugun» bloki, havola va tasdiqlash tugmasi. */
function Preview({ c, theme }) {
  const dark = theme === 'dark';
  const surface = dark ? mix(c.confirm, '#191d1c', 0.9) : '#ffffff';
  const bg = dark ? mix(c.confirm, '#101312', 0.9) : mix(c.accent, '#f3f5f4', 0.94);
  const soft = dark ? mix(c.confirm, '#191d1c', 0.7) : mix(c.accent, '#ffffff', 0.8);
  const heroTo = mix(c.confirm, '#000000', dark ? 0.55 : 0.4);
  const mint = dark ? c.accent : mix(c.accent, '#ffffff', 0.62);
  return (
    <div className="pref-preview" style={{ background: bg, color: c.text }} aria-label="Ko‘rinish namunasi">
      <div className="pp-side">
        <span className="pp-nav on" style={{ background: soft, color: c.accent }}>Bugun</span>
        <span className="pp-nav" style={{ color: c.text, opacity: 0.75 }}>Kurslarim</span>
      </div>
      <div className="pp-main">
        <div className="pp-hero" style={{ background: `linear-gradient(135deg, ${dark ? mix(c.confirm, '#000000', 0.25) : c.confirm}, ${heroTo})` }}>
          <b>Salom, Malika</b>
          <span style={{ color: mint }}>3 / 4 hafta</span>
        </div>
        <div className="pp-card" style={{ background: surface }}>
          <b style={{ color: c.text }}>Ichki tartib bilan tanishish</b>
          <span style={{ color: c.accent }}>Kursni ochish</span>
          <span className="pp-btn" style={{ background: c.confirm, color: onColor(c.confirm) }}>Tasdiqlash</span>
        </div>
      </div>
    </div>
  );
}

export default function Preferences({ user }) {
  const s = useAppState();
  const saved = prefsOf(s);
  const [p, setP] = useState(saved);
  const [tab, setTab] = useState('light');
  const set = (patch) => setP((x) => ({ ...x, ...patch }));
  const setColor = (k, v) => setP((x) => ({ ...x, colors: { ...x.colors, [tab]: { ...x.colors[tab], [k]: v } } }));
  const dirty = JSON.stringify(p) !== JSON.stringify(saved);
  const warnings = ['light', 'dark'].every((t) => COLOR_FIELDS.every(([k]) => isHex(p.colors[t][k]))) ? contrastWarnings(p.colors) : [];
  const presetId = PRESETS.find((x) => ['light', 'dark'].every((t) => COLOR_FIELDS.every(([k]) => x[t][k] === p.colors[t][k].toLowerCase())))?.id;
  const moveLang = (i, d) => setP((x) => { const l = [...x.languages]; [l[i], l[i + d]] = [l[i + d], l[i]]; return { ...x, languages: l }; });
  const toggleLang = (i) => setP((x) => ({ ...x, languages: x.languages.map((l, j) => (j === i ? { ...l, on: !l.on } : l)) }));
  const save = () => run(D.savePreferences, { prefs: p, actor: user?.name || 'Admin' }, 'Ko‘rinish va til sozlamalari saqlandi');
  const shownThemes = p.themes === 'both' ? ['light', 'dark'] : [p.themes];
  const editTheme = shownThemes.includes(tab) ? tab : shownThemes[0];
  const c = p.colors[editTheme];

  return (
    <div className="prefs">
      <div className="page-head">
        <div>
          <h1>Ko‘rinish va til</h1>
          <p>Logotip, tema, brend ranglari va platforma tillari. O‘zgarishlar «Saqlash»dan keyin barcha xodim va adminlarda qo‘llanadi.</p>
        </div>
      </div>

      <Panel title="Logotip va ikonka">
        <div className="panel-body pref-grid">
          <div>
            <div className="pref-label">Kompaniya ikonkasi</div>
            <p className="pref-hint">Kvadrat rasm, kamida 128×128 px. Brauzer yorlig‘i va menyuda ko‘rinadi.</p>
            <ImagePick value={p.icon} onChange={(v) => set({ icon: v })} label="Ikonka rasmini yuklash"><BrandMark /></ImagePick>
          </div>
          <div>
            <div className="pref-label">Kompaniya logotipi</div>
            <Seg label="Logotip turi" value={p.logoMode} options={[['text', 'Matn'], ['image', 'Rasm']]} onChange={(v) => set({ logoMode: v })} />
            {p.logoMode === 'text' ? (
              <div className="pref-field">
                <input className="i" maxLength={LOGO_TEXT_MAX} value={p.logoText} onChange={(e) => set({ logoText: e.target.value })} aria-label="Logotip matni" placeholder="RegUP" />
                <div className="row between pref-hint"><span>Sig‘madimi? Rasm turini tanlang.</span><span>{p.logoText.length} / {LOGO_TEXT_MAX}</span></div>
              </div>
            ) : (
              <div className="pref-field">
                <p className="pref-hint">Gorizontal logotip, shaffof fonda (PNG yoki SVG), {Math.round(IMAGE_MAX_BYTES / 1024)} KB gacha.</p>
                <ImagePick value={p.logoImage} onChange={(v) => set({ logoImage: v })} label="Logotip rasmini yuklash"><span className="muted small">Rasm yo‘q</span></ImagePick>
              </div>
            )}
          </div>
        </div>
      </Panel>

      <Panel title="Tema va brend ranglari">
        <div className="panel-body pref-stack">
          <div className="pref-grid">
            <div>
              <div className="pref-label">Mavjud temalar</div>
              <select className="i" value={p.themes} onChange={(e) => set({ themes: e.target.value })} aria-label="Mavjud temalar">
                {THEME_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            {p.themes === 'both' && (
              <div>
                <div className="pref-label">Standart tema</div>
                <Seg label="Standart tema" value={p.defaultTheme} options={DEFAULT_OPTS} onChange={(v) => set({ defaultTheme: v })} />
                <p className="pref-hint">Xodim temani o‘zi almashtirmaguncha shu ko‘rinadi.</p>
              </div>
            )}
          </div>

          <div>
            <div className="pref-label">Tayyor palitralar</div>
            <div className="pref-presets">
              {PRESETS.map((x) => (
                <button key={x.id} type="button" className={`pref-preset${presetId === x.id ? ' on' : ''}`} aria-pressed={presetId === x.id}
                  onClick={() => set({ colors: { light: { ...x.light }, dark: { ...x.dark } } })}>
                  <span className="sw"><i style={{ background: x.light.confirm }} /><i style={{ background: x.light.accent }} /><i style={{ background: x.dark.accent }} /></span>
                  <span><b>{x.name}</b><small>{x.note}</small></span>
                </button>
              ))}
            </div>
          </div>

          {shownThemes.length > 1 && <Seg label="Qaysi tema ranglari" value={editTheme} options={[['light', 'Yorug‘ tema'], ['dark', 'Qorong‘i tema']]} onChange={setTab} />}
          <div className="pref-colors">
            <div className="pref-color-list">
              {COLOR_FIELDS.map(([k, l, hint]) => (
                <label key={k} className="pref-color">
                  <span className="pc-txt"><b>{l}</b><small>{hint}</small></span>
                  <span className="pc-in">
                    <input type="color" value={isHex(c[k]) ? c[k] : '#000000'} onChange={(e) => setColor(k, e.target.value)} aria-label={`${l} — rang tanlash`} />
                    <input className="i compact" value={c[k]} onChange={(e) => setColor(k, e.target.value.trim())} aria-label={`${l} — HEX`} maxLength={7} spellCheck={false} />
                  </span>
                </label>
              ))}
              {warnings.length > 0 && <div className="callout warn small" role="status">{warnings.map((w) => <div key={w}>{w}</div>)}</div>}
            </div>
            <Preview c={c} theme={editTheme} />
          </div>
        </div>
      </Panel>

      <Panel title={<div><h2>Tillar</h2><div className="muted small">Ro‘yxatda birinchi turgan til — asosiy: yangi foydalanuvchi platformani shu tilda ko‘radi.</div></div>}>
        <ul className="pref-langs">
          {p.languages.map((l, i) => (
            <li key={l.code} className={l.on ? '' : 'off'}>
              <span className="pl-move">
                <button type="button" className="btn sm" disabled={i === 0} onClick={() => moveLang(i, -1)} aria-label={`${LANG_LABEL[l.code]} — yuqoriga`}>↑</button>
                <button type="button" className="btn sm" disabled={i === p.languages.length - 1} onClick={() => moveLang(i, 1)} aria-label={`${LANG_LABEL[l.code]} — pastga`}>↓</button>
              </span>
              <span className="pl-code">{LANG_SHORT[l.code]}</span>
              <span className="pl-name">{LANG_LABEL[l.code]}{i === 0 && <> <Pill tone="brand">Asosiy</Pill></>}</span>
              <label className="pl-on">
                <input type="checkbox" checked={l.on} disabled={i === 0} onChange={() => toggleLang(i)} />
                <span>{l.on ? 'Yoqilgan' : 'O‘chirilgan'}</span>
              </label>
            </li>
          ))}
        </ul>
        <div className="panel-body"><p className="pref-hint">Hozircha interfeys matnlari o‘zbekcha. Rus, ingliz va qoraqalpoq tarjimalari 1-reliz ishlab chiqishida qo‘shiladi; bu yerda qaysi tillar yoqilishi va ularning tartibi belgilanadi.</p></div>
      </Panel>

      <div className="pref-bar" role="region" aria-label="Saqlash">
        <span className="muted small">{dirty ? 'Saqlanmagan o‘zgarishlar bor' : 'Hammasi saqlangan'}</span>
        <button type="button" className="btn" onClick={() => setP({ ...DEFAULT_PREFS, colors: { light: { ...DEFAULT_PREFS.colors.light }, dark: { ...DEFAULT_PREFS.colors.dark } } })}>Standartga qaytarish</button>
        <button type="button" className="btn" disabled={!dirty} onClick={() => setP(saved)}>Bekor qilish</button>
        <button type="button" className="btn primary" disabled={!dirty} onClick={save}>Saqlash</button>
      </div>
    </div>
  );
}
