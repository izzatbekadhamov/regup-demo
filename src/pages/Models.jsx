import { useState } from 'react';
import { useAppState, run } from '../state/store.js';
import { Panel, Pill, go, fmtDate } from '../ui/common.jsx';
import { MODEL_STATUS } from '../ui/labels.js';
import { CONDITION_CATALOG } from '../core/rules.js';
import { methodLabel, scaleMax, scoringMode, profileConditions, SCALE_OPTIONS } from '../core/modelKit.js';
import * as D from '../core/domain.js';

const condText = (c, model) => {
  const p = c.params || {};
  switch (c.type) {
    case 'match_threshold': return `Moslik ≥ ${p.threshold}%${p.conditionalFrom ? ` (${p.conditionalFrom}% dan shartli)` : ''}`;
    case 'min_level_all': return `Har kompetensiya ≥ ${p.min}`;
    case 'max_gap': return `Tafovut ≤ ${p.max}`;
    case 'tenure_months': return `Tajriba ≥ ${p.min} oy`;
    case 'kpi_threshold': return `KPI ≥ ${p.min}%`;
    case 'observation_count': return `Kuzatuv ≥ ${p.min}`;
    case 'observation_avg': return `Kuzatuv o‘rtachasi ≥ ${String(p.min).replace('.', ',')}`;
    case 'min_methods': return `≥ ${p.min} mustaqil usul`;
    case 'required_method': return `${model ? methodLabel(model, p.method) : p.method} majburiy`;
    case 'gates': return `${(p.items || []).length} ta gate`;
    case 'entry_levels': return `O‘tish: ${(p.levels || []).join(', ')} dan`;
    case 'min_level_items': return `Minimum: ${Object.entries(p.items || {}).map(([k, v]) => `${k} ≥ ${v}`).join(', ')}`;
    default: return CONDITION_CATALOG[c.type]?.label || c.type;
  }
};
export { condText };

const TR = { 'ʻ': '', '‘': '', "'": '', 'ʼ': '' };
const autoCode = (name) => name.split(/\s+/)[0]?.replace(/[ʻ‘'ʼ]/g, (c) => TR[c]).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10) || '';

function NewModel({ s, onDone }) {
  const actives = s.models.filter((m) => m.status === 'active');
  const [f, setF] = useState({ name: '', modelId: '', scaleMax: 5, template: 'blank', fromId: actives[0]?.id });
  return (
    <Panel title="Yangi lavozim modeli" actions={<button className="btn sm" onClick={onDone}>Yopish</button>}>
      <div className="grid g4" style={{ alignItems: 'end' }}>
        <label className="f">Lavozim nomi<input className="i" placeholder="Sotuv menejeri" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value, modelId: f.codeTouched ? f.modelId : autoCode(e.target.value) })} /></label>
        <label className="f">Qisqa kod<input className="i" placeholder="SOTUV" value={f.modelId} onChange={(e) => setF({ ...f, modelId: e.target.value.toUpperCase(), codeTouched: true })} /><span className="muted small" style={{ fontWeight: 400 }}>Nomdan avtomatik, o‘zgartirish mumkin</span></label>
        <label className="f">Daraja shkalasi
          <select className="i" value={f.scaleMax} onChange={(e) => setF({ ...f, scaleMax: Number(e.target.value) })}>{SCALE_OPTIONS.map((n) => <option key={n} value={n}>1–{n} ({n} daraja)</option>)}</select>
          <span className="muted small" style={{ fontWeight: 400 }}>Odatda 1–5</span>
        </label>
        <label className="f">Asos
          <select className="i" value={f.template === 'blank' ? 'blank' : f.fromId} onChange={(e) => setF(e.target.value === 'blank' ? { ...f, template: 'blank' } : { ...f, template: 'copy', fromId: e.target.value })}>
            <option value="blank">Noldan boshlash</option>
            {actives.map((m) => <option key={m.id} value={m.id}>«{m.name}» nusxasidan</option>)}
          </select>
          <span className="muted small" style={{ fontWeight: 400 }}>O‘xshash lavozim bo‘lsa, nusxadan boshlash tezroq</span>
        </label>
      </div>
      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn primary" disabled={!f.name.trim() || !f.modelId.trim()} onClick={() => {
          const ok = run(D.createModel, f, 'Qoralama model yaratildi');
          if (ok) go(`/models/${encodeURIComponent(`${f.modelId.trim().toUpperCase()}@0.1`)}`);
        }}>Yaratish va tahrirlash</button>
        <span className="muted small">Keyin 5 qadam: kompetensiyalar → darajalar → usullar → o‘tish shartlari → tekshiruvga yuborish.</span>
      </div>
    </Panel>
  );
}

export default function Models() {
  const s = useAppState();
  const [creating, setCreating] = useState(false);
  const groups = [...new Set(s.models.map((m) => m.modelId))];
  const actives = s.models.filter((m) => m.status === 'active');
  const [cmp, setCmp] = useState([actives[0]?.id, actives[1]?.id]);
  const A = s.models.find((m) => m.id === cmp[0]);
  const B = s.models.find((m) => m.id === cmp[1]);
  const view = (m) => s.models.find((x) => x.modelId === m && x.status === 'active') || s.models.filter((x) => x.modelId === m).at(-1);
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Kompetensiya modellari</h1>
          <p>Har lavozim uchun: qaysi kompetensiyalar baholanadi, qaysi usullar bilan va keyingi darajaga o‘tish uchun nima kerak.</p>
        </div>
        <button className="btn primary" onClick={() => setCreating(true)}>+ Yangi lavozim modeli</button>
      </div>
      {creating && <NewModel s={s} onDone={() => setCreating(false)} />}
      <div className="grid g3">
        {groups.map((g) => {
          const m = view(g);
          const layers = [...new Set(m.competencies.map((c) => c.layer))];
          return (
            <section key={g} className="panel model-card clickable-card" onClick={() => go(`/models/${encodeURIComponent(m.id)}`)}>
              <div className="row between"><h2>{m.name}</h2><div className="row">{m.demo && <Pill tone="warn">demo</Pill>}<Pill tone={MODEL_STATUS[m.status][1]}>{MODEL_STATUS[m.status][0]}</Pill></div></div>
              <p className="small ink2" style={{ marginTop: 4 }}>{m.profiles.map((p) => p.code).join(' → ') || 'profil yo‘q'}</p>
              <div className="mini-stats">
                <div><b>{m.competencies.length}</b><span>kompetensiya</span></div>
                <div><b>{m.profiles.length}</b><span>daraja</span></div>
                <div><b>{m.methods.length}</b><span>usul</span></div>
                <div><b>1–{scaleMax(m)}</b><span>shkala</span></div>
              </div>
              <div className="small muted">{layers.join(' · ')}</div>
              {s.models.some((x) => x.modelId === g && (x.status === 'draft' || x.status === 'review')) && <div style={{ marginTop: 8 }}><Pill tone="warn">ochiq qoralama bor</Pill></div>}
            </section>
          );
        })}
      </div>
      {A && B && (
        <details className="panel history">
          <summary>Ikki modelni solishtirish</summary>
        <Panel tight title={<div className="row"><h2>Solishtirish</h2>
          {[0, 1].map((i) => <select key={i} className="i compact" value={cmp[i]} onChange={(e) => { const n = [...cmp]; n[i] = e.target.value; setCmp(n); }}>{s.models.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.id})</option>)}</select>)}
        </div>}>
          <table>
            <thead><tr><th>Parametr</th><th>{A.name}</th><th>{B.name}</th></tr></thead>
            <tbody>
              <tr><td>Kompetensiyalar</td>{[A, B].map((m) => <td key={m.id}>{m.competencies.length} · {Object.entries(m.competencies.reduce((a, c) => ({ ...a, [c.layer]: (a[c.layer] || 0) + 1 }), {})).map(([l, n]) => `${l} ${n}`).join(', ')}</td>)}</tr>
              <tr><td>Shkala</td>{[A, B].map((m) => <td key={m.id}>1–{scaleMax(m)}</td>)}</tr>
              <tr><td>Baholash usullari</td>{[A, B].map((m) => <td key={m.id} className="small">{m.methods.map((x) => methodLabel(m, x)).join(', ')}</td>)}</tr>
              <tr><td>Yakuniy daraja</td>{[A, B].map((m) => <td key={m.id} className="small">{scoringMode(m) === 'weighted' ? 'Vaznli o‘rtacha' : 'Baholovchi xulosasi'}</td>)}</tr>
              <tr><td>Profillar va chegara</td>{[A, B].map((m) => <td key={m.id} className="small">{m.profiles.map((p) => `${p.code}: ${profileConditions(m, p).find((c) => c.type === 'match_threshold')?.params.threshold ?? '—'}%`).join(' · ')}</td>)}</tr>
              <tr><td>Shartlar (yuqori profil)</td>{[A, B].map((m) => <td key={m.id} className="small">{profileConditions(m, m.profiles.at(-1)).map((c) => condText(c, m)).join(' · ')}</td>)}</tr>
              <tr><td>Panel / tasdiq</td>{[A, B].map((m) => <td key={m.id} className="small">{m.panelRequired ? (m.panelLabel || 'Panel') + ' majburiy' : 'Panel yo‘q'} · tasdiqlovchi: {m.approverLabel || 'HRD'}</td>)}</tr>
              <tr><td>Tasdiq</td>{[A, B].map((m) => <td key={m.id} className="small">{m.approvedBy ? `${m.approvedBy}, ${fmtDate(m.approvedAt)}` : '—'}</td>)}</tr>
            </tbody>
          </table>
        </Panel>
        </details>
      )}
    </>
  );
}
