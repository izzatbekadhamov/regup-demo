import { useState } from 'react';
import { useAppState, run, getState } from '../state/store.js';
import { Panel, Pill, Conditions, Empty, fmtDate, Gauge, Icon, go, ask } from '../ui/common.jsx';
import * as D from '../core/domain.js';
import { evaluateDecision, validateModel, CONDITION_CATALOG } from '../core/rules.js';
import { fmtPct, resolveScores, DE } from '../core/calc.js';
import { MODEL_STATUS } from '../ui/labels.js';
import {
  scaleMax, scaleLevels, levelName, methodLabel, methodKind, compMethods, compositeParts, competencyLibrary,
  METHOD_KINDS, SCORING_LABELS, scoringMode, SCALE_OPTIONS, profileConditions,
} from '../core/modelKit.js';

const upd = (m, fn, ok) => run(D.updateDraft, { id: m.id, patch: fn }, ok);
const compIdx = (mm, code) => mm.competencies.findIndex((c) => c.code === code);

/* ---------------- Tuzilma: kompetensiyalar va indikatorlar ---------------- */
function CompetencyBlock({ m, c, editable }) {
  const levels = scaleLevels(m);
  const parts = c.composite ? compositeParts(m, c.code) : [];
  const methods = compMethods(m, c);
  const set = (field) => (e) => {
    const v = e.target.value;
    if ((c[field] ?? '') === v) return;
    upd(m, (mm) => { mm.competencies[compIdx(mm, c.code)][field] = v; });
  };
  const missing = !c.composite && levels.filter((l) => !String(c.levels?.[l] || '').trim()).length;
  return (
    <details className="comp-row" open={editable && missing > 0}>
      <summary>
        <span className="tag">{c.code}</span>
        <b className="cr-name">{c.name || <span className="muted">nomsiz</span>}</b>
        <span className="muted small">{methods.length} usul</span>
        {missing > 0 ? <Pill tone="warn">{missing} ta indikator yo‘q</Pill> : <span className="ic ok" title="Indikatorlar to‘liq">✓</span>}
      </summary>
      <div className="cr-body">
        {editable && (
          <div className="grid g2" style={{ gap: 10 }}>
            <label className="f">Nomi<input className="i" defaultValue={c.name} onBlur={set('name')} /></label>
            <label className="f">Turi (guruh)<input className="i" list="layers" defaultValue={c.layer} onBlur={set('layer')} /></label>
          </div>
        )}
        <label className="f">Ta’rif — bu kompetensiya nimani anglatadi
          {editable ? <textarea className="i" defaultValue={c.definition} onBlur={set('definition')} style={{ minHeight: 44 }} /> : <span className="ink2 small" style={{ fontWeight: 400 }}>{c.definition || '—'}</span>}
        </label>
        <div className="f">Qaysi usullar bilan baholanadi
          <div className="row">
            {editable
              ? m.methods.map((x) => (
                <label key={x} className="chk">
                  <input type="checkbox" checked={methods.includes(x)} onChange={(e) => upd(m, (mm) => {
                    const cc = mm.competencies[compIdx(mm, c.code)];
                    const cur = compMethods(mm, cc);
                    cc.methods = e.target.checked ? [...cur, x] : cur.filter((y) => y !== x);
                  })} />
                  {methodLabel(m, x)}
                </label>
              ))
              : methods.map((x) => <span key={x} className="tag" style={{ fontFamily: 'inherit' }}>{methodLabel(m, x)}</span>)}
          </div>
        </div>
        {(c.composite || editable) && <SubCompetencies m={m} c={c} parts={parts} editable={editable} />}
        {c.composite ? null : (
          <div className="f">Har daraja uchun kuzatiladigan xatti-harakat
            <div className="rubric">
              {levels.map((l) => (
                <div key={l} className={`lvl ${editable && !String(c.levels?.[l] || '').trim() ? 'empty-lvl' : ''}`}>
                  <b>{l}</b>
                  <div>
                    <div className="lvl-name">{levelName(m, l)}</div>
                    {editable ? (
                      <textarea className="i" defaultValue={c.levels?.[l] || ''} placeholder={`${l}-darajadagi xodim nima qiladi?`} style={{ minHeight: 40 }}
                        onBlur={(e) => { const v = e.target.value; if ((c.levels?.[l] || '') !== v) upd(m, (mm) => { const cc = mm.competencies[compIdx(mm, c.code)]; cc.levels = { ...(cc.levels || {}), [l]: v }; }); }} />
                    ) : (c.levels?.[l] || <span className="muted">—</span>)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {editable && <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn sm" onClick={() => run(D.archiveCompetency, { id: m.id, code: c.code, archived: true }, `${c.code} arxivlandi — hech bir darajada baholanmaydi`)}>Arxivlash</button><button className="btn sm danger" onClick={() => ask(`«${c.name}» modeldan olib tashlansinmi? U daraja maqsadlari va shartlardan ham o‘chadi.`, () => run(D.removeCompetency, { id: m.id, code: c.code }, `${c.code} olib tashlandi`))}>Kompetensiyani olib tashlash</button></div>}
      </div>
    </details>
  );
}

/** Sub-kompetensiyalar: ichki bandlar, kompetensiya darajasi ularning o'rtachasi (masalan, FR'dagi HR-01…HR-11). */
function SubCompetencies({ m, c, parts, editable }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState(() => (parts.length ? parts.map((p) => ({ code: p.code, name: p.name || '', definition: p.definition || '' })) : [{ code: '', name: '', definition: '' }, { code: '', name: '', definition: '' }]));
  const setRow = (i, k, v) => setRows(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  if (!editable) return <div className="callout small">Tarkibli kompetensiya: {m.composites[c.code]?.label}. Sub-kompetensiyalar: {parts.map((p) => `${p.code}${p.name && p.name !== p.code ? ` ${p.name}` : ''}`).join('; ')}.</div>;
  if (!open) return (
    <div className="row small" style={{ gap: 8 }}>
      {c.composite ? <span className="callout small" style={{ margin: 0 }}>Sub-kompetensiyalar: {parts.length} ta ({parts.map((p) => p.code).join(', ')}) — daraja ularning o‘rtachasi.</span> : <span className="muted">Murakkab kompetensiyani ichki bandlarga bo‘lish mumkin.</span>}
      <button className="link-btn" onClick={() => setOpen(true)}>{c.composite ? 'Sub-kompetensiyalarni tahrirlash' : 'Sub-kompetensiyalarga bo‘lish'}</button>
    </div>
  );
  return (
    <div className="panel add-box">
      <b className="small">Sub-kompetensiyalar — {c.code}</b>
      <div className="small muted">Har biri 1–{scaleMax(m)} baholanadi; {c.code} darajasi = o‘rtacha, butun songa yaxlitlanadi. Sub-kompetensiya bo‘lgan kompetensiyaning o‘z indikatorlari yozilmaydi.</div>
      <div className="stack" style={{ gap: 6, marginTop: 8 }}>
        {rows.map((r, i) => (
          <div key={i} className="row" style={{ gap: 6 }}>
            <input className="i compact" style={{ width: 100 }} placeholder="HR-01" value={r.code} onChange={(e) => setRow(i, 'code', e.target.value.toUpperCase())} />
            <input className="i compact" style={{ flex: 1 }} placeholder="Nomi" value={r.name} onChange={(e) => setRow(i, 'name', e.target.value)} />
            <input className="i compact" style={{ flex: 2 }} placeholder="Ta’rif (ixtiyoriy)" value={r.definition} onChange={(e) => setRow(i, 'definition', e.target.value)} />
            <button className="link-btn small" onClick={() => setRows(rows.filter((_, j) => j !== i))}>o‘chirish</button>
          </div>
        ))}
      </div>
      <div className="row" style={{ marginTop: 8, gap: 6 }}>
        <button className="btn sm" onClick={() => setRows([...rows, { code: '', name: '', definition: '' }])}>+ Band</button>
        <button className="btn sm primary" onClick={() => run(D.setSubCompetencies, { id: m.id, code: c.code, parts: rows }, 'Sub-kompetensiyalar saqlandi') && setOpen(false)}>Saqlash</button>
        {c.composite && <button className="btn sm danger" onClick={() => ask('Sub-kompetensiyalar olib tashlansinmi? Kompetensiya oddiy (indikatorli) bo‘lib qoladi.', () => run(D.setSubCompetencies, { id: m.id, code: c.code, parts: [] }, 'Sub-kompetensiyalar olib tashlandi') && setOpen(false))}>Olib tashlash</button>}
        <button className="btn sm" onClick={() => setOpen(false)}>Bekor qilish</button>
      </div>
    </div>
  );
}

function AddCompetency({ m, s }) {
  const lib = competencyLibrary(s.models).filter((c) => !m.competencies.some((x) => x.code === c.code));
  const [mode, setMode] = useState('new');
  const [f, setF] = useState({ code: '', name: '', layer: '', fromCode: lib[0]?.code || '' });
  const pick = lib.find((c) => c.code === f.fromCode);
  return (
    <div className="panel add-box">
      <div className="row between">
        <h3>+ Kompetensiya qo‘shish</h3>
        <div className="mode-switch">
          <button className={mode === 'new' ? 'on' : ''} onClick={() => setMode('new')}>Yangi yaratish</button>
          <button className={mode === 'lib' ? 'on' : ''} onClick={() => setMode('lib')}>Boshqa modeldan olish ({lib.length})</button>
        </div>
      </div>
      {mode === 'new' ? (
        <div className="row" style={{ marginTop: 10, alignItems: 'end' }}>
          <label className="f" style={{ width: 130 }} title="Qisqa noyob kod, masalan SOT-01">Kod<input className="i" placeholder="SOT-01" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} /></label>
          <label className="f" style={{ flex: 2, minWidth: 180 }}>Nomi<input className="i" placeholder="Mijoz ehtiyojini aniqlash" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
          <label className="f" style={{ flex: 1, minWidth: 140 }}>Turi (guruh)<input className="i" list="layers" placeholder="Kasbiy" value={f.layer} onChange={(e) => setF({ ...f, layer: e.target.value })} /></label>
          <button className="btn primary" onClick={() => run(D.addCompetency, { id: m.id, comp: f }, 'Kompetensiya qo‘shildi') && setF({ ...f, code: '', name: '' })}>Qo‘shish</button>
        </div>
      ) : lib.length ? (
        <div className="row" style={{ marginTop: 10, alignItems: 'end' }}>
          <label className="f" style={{ flex: 1, minWidth: 260 }}>Boshqa lavozim modellaridagi kompetensiya
            <select className="i" value={f.fromCode} onChange={(e) => setF({ ...f, fromCode: e.target.value })}>
              {lib.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.name} ({c.layer}, {c.from})</option>)}
            </select>
          </label>
          <button className="btn primary" onClick={() => run(D.addCompetency, { id: m.id, fromCode: f.fromCode }, 'Kompetensiya kutubxonadan olindi') && setF({ ...f, fromCode: lib.find((c) => c.code !== f.fromCode)?.code || '' })}>Olish</button>
          {pick && pick.scaleMax !== scaleMax(m) && <span className="small" style={{ color: 'var(--warn)' }}>Manba 1–{pick.scaleMax} shkalada: indikatorlar 1–{scaleMax(m)} uchun qayta yoziladi.</span>}
        </div>
      ) : <Empty>Kutubxonadagi barcha kompetensiyalar bu modelda bor.</Empty>}
      <p className="muted small" style={{ marginTop: 8 }}>{mode === 'lib' ? 'Korporativ qadriyatlar kabi umumiy kompetensiyalarni qayta yozmang — boshqa modeldan oling, ular hamma lavozimda bir xil ma’noda qoladi.' : 'Qo‘shilgach, uning ta’rifi va har daraja indikatorini yozing.'}</p>
    </div>
  );
}

function Structure({ m, s, editable, cardsUsing }) {
  const live = m.competencies.filter((c) => !c.archived);
  const archived = m.competencies.filter((c) => c.archived);
  const layers = [...new Set(live.map((c) => c.layer))];
  const shared = D.sharedLayers(m);
  const allLayers = [...new Set(s.models.flatMap((x) => x.competencies.map((c) => c.layer)))];
  return (
    <div className="stack" style={{ gap: 14 }}>
      <datalist id="layers">{allLayers.map((l) => <option key={l} value={l} />)}</datalist>
      {editable && (
        <div className="row small ink2">
          Daraja shkalasi:
          {!cardsUsing ? (
            <select className="i compact" value={scaleMax(m)} onChange={(e) => { const v = Number(e.target.value); ask('Shkala o‘zgarsa, indikatorlar va maqsadlarni qayta tekshirish kerak bo‘ladi. Davom etasizmi?', () => upd(m, (mm) => { mm.scale = { ...(mm.scale || {}), max: v }; }, 'Shkala o‘zgardi')); }}>
              {SCALE_OPTIONS.map((n) => <option key={n} value={n}>1–{n} ({n} daraja)</option>)}
            </select>
          ) : <b>1–{scaleMax(m)}</b>}
          <span className="muted">— har kompetensiya uchun shuncha daraja indikatori yoziladi.</span>
        </div>
      )}
      {editable && (
        <div className="row small ink2" style={{ gap: 8, flexWrap: 'wrap' }}>
          Daraja nomlari:
          {scaleLevels(m).map((l) => <label key={l} className="row" style={{ gap: 4 }}><b>{l}</b><input className="i compact" style={{ width: 120 }} defaultValue={levelName(m, l)} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== levelName(m, l)) upd(m, (mm) => { mm.scale = { ...(mm.scale || {}), labels: { ...(mm.scale?.labels || {}), [l]: v } }; }, 'Daraja nomi saqlandi'); }} /></label>)}
        </div>
      )}
      {!m.competencies.length && <Panel><Empty icon="layers">Kompetensiya hali yo‘q. Pastda birinchisini qo‘shing.</Empty></Panel>}
      {layers.map((layer) => (
        <Panel key={layer} title={<div className="row"><h2>{layer}</h2><span className="muted small">{live.filter((c) => c.layer === layer).length} ta</span>{shared.includes(layer) && <Pill tone="teal">umumiy — ikki rolda bir marta baholanadi</Pill>}</div>} tight
          actions={editable && <div className="row" style={{ gap: 8 }}>
            <label className="chk small" title="Ikki rolli xodim kartasida bu klaster kompetensiyalari bir marta baholanadi va ikkala bo‘limga yoziladi"><input type="checkbox" checked={shared.includes(layer)} onChange={(e) => run(D.setSharedCluster, { id: m.id, layer, on: e.target.checked }, 'Saqlandi')} /> umumiy klaster</label>
            <button className="link-btn small" onClick={() => ask('Klasterning yangi nomi:', (v) => run(D.renameCluster, { id: m.id, from: layer, to: v }, 'Klaster qayta nomlandi'), { input: true, ok: 'Saqlash' })}>qayta nomlash</button>
          </div>}>
          <div className="comp-list">
            {live.filter((c) => c.layer === layer).map((c) => <CompetencyBlock key={`${c.code}-${m.competencies.length}`} m={m} c={c} editable={editable} />)}
          </div>
        </Panel>
      ))}
      {archived.length > 0 && (
        <Panel title={<div className="row"><h2>Arxiv</h2><span className="muted small">{archived.length} ta — modelda saqlanadi, hech bir darajada baholanmaydi</span></div>} tight>
          <table className="small"><tbody>{archived.map((c) => <tr key={c.code}><td className="code">{c.code}</td><td>{c.name}</td><td className="muted">{c.layer}</td><td className="num">{editable && <button className="btn sm" onClick={() => run(D.archiveCompetency, { id: m.id, code: c.code, archived: false }, `${c.code} arxivdan qaytarildi — maqsadli darajalarni qayta qo‘ying`)}>Qaytarish</button>}</td></tr>)}</tbody></table>
        </Panel>
      )}
      {editable && <AddCompetency m={m} s={s} />}
    </div>
  );
}

/* ---------------- Profillar va maqsadlar ---------------- */
function Profiles({ m, editable }) {
  const [f, setF] = useState({ code: '', name: '' });
  const levels = scaleLevels(m);
  return (
    <div className="stack">
      <Panel tight title="Har bir lavozim darajasi uchun maqsadli ball">
        {m.profiles.length ? (
          <table>
            <thead>
              <tr>
                <th>ID</th><th>Kompetensiya</th><th>Turi</th>
                {m.profiles.map((p) => (
                  <th key={p.code} className="num">
                    {p.code}
                    {editable ? <input className="i compact" style={{ width: 130, display: 'block', margin: '4px auto', textTransform: 'none', fontWeight: 500 }} defaultValue={p.name} title="Lavozim darajasi nomi (model jadvalidagidek)" onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== p.name) upd(m, (mm) => { mm.profiles.find((x) => x.code === p.code).name = v; }, 'Daraja nomi saqlandi'); }} /> : <div className="muted" style={{ fontWeight: 500, textTransform: 'none' }}>{p.name}</div>}
                    {editable && <span className="row" style={{ gap: 2, justifyContent: 'center' }}><button className="link-btn" disabled={m.profiles[0].code === p.code} title="Chapga" onClick={() => run(D.moveProfile, { id: m.id, code: p.code, dir: 'up' })}>←</button><button className="link-btn" disabled={m.profiles.at(-1).code === p.code} title="O‘ngga" onClick={() => run(D.moveProfile, { id: m.id, code: p.code, dir: 'down' })}>→</button></span>}
                    {editable && <button className="link-btn" onClick={() => ask(`${p.code} profili o‘chirilsinmi?`, () => run(D.removeProfile, { id: m.id, code: p.code }, 'Profil olib tashlandi'))}>o‘chirish</button>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {m.competencies.filter((c) => !c.archived).map((c) => (
                <tr key={c.code}>
                  <td className="code">{c.code}</td><td>{c.name}</td><td className="small muted">{c.layer}</td>
                  {m.profiles.map((p, pi) => (
                    <td key={p.code} className="num">
                      {editable ? (
                        <select className="i compact" value={p.targets[c.code] ?? ''} onChange={(e) => upd(m, (mm) => { if (e.target.value === '') delete mm.profiles[pi].targets[c.code]; else mm.profiles[pi].targets[c.code] = Number(e.target.value); })}>
                          <option value="">—</option>{levels.map((n) => <option key={n}>{n}</option>)}
                        </select>
                      ) : (p.targets[c.code] ?? <span className="muted">—</span>)}
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="group-row"><td colSpan={3}>Jami maqsadli ball</td>{m.profiles.map((p) => <td key={p.code} className="num">{Object.values(p.targets).reduce((a, b) => a + b, 0)}</td>)}</tr>
            </tbody>
          </table>
        ) : <Empty icon="users">Hali daraja yo‘q. Pastda lavozimning birinchi darajasini qo‘shing (masalan «Sotuv menejeri», «Katta sotuv menejeri»).</Empty>}
        <div className="panel-body small ink2">Ustunlar — lavozim darajalari, qatorlar — kompetensiyalar. «—» qo‘yilsa, bu kompetensiya shu darajada baholanmaydi.</div>
      </Panel>
      {editable && (
        <div className="panel add-box">
          <h3>+ Lavozim darajasi qo‘shish</h3>
          <div className="row" style={{ marginTop: 10, alignItems: 'end' }}>
            <label className="f" style={{ width: 140 }} title="Qisqa kod, oxiri raqam bilan: SOT-1, SOT-2">Kod<input className="i" placeholder="SOT-1" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} /></label>
            <label className="f" style={{ flex: 1, minWidth: 200 }}>Nomi<input className="i" placeholder="Sotuv menejeri" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
            <button className="btn primary" onClick={() => run(D.addProfile, { id: m.id, ...f }, 'Profil qo‘shildi') && setF({ code: '', name: '' })}>Qo‘shish</button>
          </div>
          <p className="muted small" style={{ marginTop: 8 }}>Darajalarni pastdan yuqoriga qo‘shing; koddagi raqam o‘tish tartibini bildiradi (SOT-1 → SOT-2).</p>
        </div>
      )}
    </div>
  );
}

/* ---------------- Usullar va baholash tartibi ---------------- */
function Methods({ m, editable }) {
  const [f, setF] = useState({ name: '', kind: 'test' });
  const mode = scoringMode(m);
  const weights = m.scoring?.weights || {};
  const wSum = m.methods.reduce((a, x) => a + (Number(weights[x]) || 0), 0);
  const builtIn = Object.keys(METHOD_KINDS).filter((k) => !m.methods.includes(k));
  return (
    <div className="stack">
      <Panel title="Kompetensiya darajasi qanday qo‘yiladi">
        <div className="stack">
          {Object.entries(SCORING_LABELS).map(([k, l]) => (
            <label key={k} className={`choice ${mode === k ? 'on' : ''}`}>
              <input type="radio" name="scoring" disabled={!editable} checked={mode === k} onChange={() => upd(m, (mm) => { mm.scoring = { ...(mm.scoring || {}), mode: k, weights: mm.scoring?.weights || Object.fromEntries(mm.methods.map((x) => [x, Math.floor(100 / mm.methods.length)])) }; })} />
              <div><b>{k === 'judgment' ? 'Baholovchi xulosasi' : 'Vaznli o‘rtacha'}</b><div className="small ink2">{l.split(': ')[1]}</div></div>
            </label>
          ))}
          <p className="muted small">Qaysi yo‘l tanlansa ham, moslik hisobi va o‘tish shartlari o‘zgarmaydi.</p>
        </div>
      </Panel>
      <Panel tight title="Bu lavozimda ishlatiladigan usullar" actions={mode === 'weighted' && <Pill tone={Math.round(wSum) === 100 ? 'good' : 'bad'}>vaznlar: {wSum}%</Pill>}>
        <table>
          <thead><tr><th>Usul nomi</th><th>Turi</th><th className="num">Nechta kompetensiyada</th>{mode === 'weighted' && <th className="num">Vazn, %</th>}<th /></tr></thead>
          <tbody>
            {m.methods.map((x) => (
              <tr key={x}>
                <td>
                  {editable ? <input className="i compact" style={{ width: 220 }} defaultValue={methodLabel(m, x)} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== methodLabel(m, x)) upd(m, (mm) => { mm.methodDefs = { ...(mm.methodDefs || {}), [x]: { kind: methodKind(mm, x), name: v } }; }); }} />
                    : <b>{methodLabel(m, x)}</b>}
                </td>
                <td className="small ink2">{METHOD_KINDS[methodKind(m, x)]}</td>
                <td className="num">{m.competencies.filter((c) => compMethods(m, c).includes(x)).length} / {m.competencies.length}</td>
                {mode === 'weighted' && (
                  <td className="num">{editable ? <input className="i compact" style={{ width: 70 }} type="number" defaultValue={weights[x] ?? 0} onBlur={(e) => upd(m, (mm) => { mm.scoring.weights = { ...(mm.scoring.weights || {}), [x]: Number(e.target.value) }; })} /> : `${weights[x] ?? 0}%`}</td>
                )}
                <td className="num">{editable && m.methods.length > 1 && <button className="btn sm danger" onClick={() => upd(m, (mm) => {
                  mm.methods = mm.methods.filter((y) => y !== x);
                  for (const c of mm.competencies) if (c.methods) c.methods = c.methods.filter((y) => y !== x);
                  if (mm.scoring?.weights) delete mm.scoring.weights[x];
                }, 'Usul olib tashlandi')}>olib tashlash</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {editable && (
          <div className="panel-body" style={{ borderTop: '1px solid var(--line-2)' }}>
            <div className="row" style={{ alignItems: 'end' }}>
              <label className="f" style={{ flex: 1, minWidth: 200 }}>Yangi usul nomi<input className="i" placeholder="Masalan: Mijoz bilan rolli o‘yin" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
              <label className="f" style={{ minWidth: 200 }}>Turi
                <select className="i" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>{Object.entries(METHOD_KINDS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
              </label>
              <button className="btn primary" onClick={() => run(D.addMethod, { id: m.id, ...f }, 'Usul qo‘shildi') && setF({ ...f, name: '' })}>Qo‘shish</button>
            </div>
            {builtIn.length > 0 && <div className="row small" style={{ marginTop: 10 }}><span className="muted">Tezkor qo‘shish:</span>{builtIn.map((k) => <button key={k} className="btn sm" onClick={() => upd(m, (mm) => { mm.methods.push(k); }, 'Usul qo‘shildi')}>+ {METHOD_KINDS[k]}</button>)}</div>}
          </div>
        )}
      </Panel>
      <details className="panel history">
        <summary>Kompetensiya × usul jadvali (hammasini bir joyda tahrirlash)</summary>
        <table>
          <thead><tr><th>Kompetensiya</th>{m.methods.map((x) => <th key={x} className="num">{methodLabel(m, x)}</th>)}</tr></thead>
          <tbody>
            {m.competencies.map((c) => {
              const cm = compMethods(m, c);
              return (
                <tr key={c.code}>
                  <td><span className="code">{c.code}</span> {c.name}</td>
                  {m.methods.map((x) => (
                    <td key={x} className="num">
                      {editable ? (
                        <input type="checkbox" checked={cm.includes(x)} onChange={(e) => upd(m, (mm) => {
                          const cc = mm.competencies[compIdx(mm, c.code)];
                          const cur = compMethods(mm, cc);
                          cc.methods = e.target.checked ? [...cur, x] : cur.filter((y) => y !== x);
                        })} />
                      ) : cm.includes(x) ? <span className="ic ok" style={{ display: 'inline-grid' }}>✓</span> : <span className="muted">—</span>}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="panel-body small ink2">Kartada dalil qo‘shishda faqat belgilangan usullar chiqadi. «Kuzatuv» turidagi usul yoqilsa, kartada dars kuzatuvi bloki paydo bo‘ladi.</div>
      </details>
    </div>
  );
}

/* ---------------- Qoidalar ---------------- */
const DEFAULT_PARAMS = (m) => ({
  match_threshold: { threshold: 90 }, min_level_all: { min: Math.ceil(scaleMax(m) / 2) }, max_gap: { max: 1 }, tenure_months: { min: 10 },
  kpi_threshold: { min: 75 }, observation_count: { min: 2 }, observation_avg: { min: 3 }, min_methods: { min: 2 },
  required_method: { method: m.methods[0] }, gates: { items: [] }, min_level_items: { items: {} }, entry_levels: { levels: [] },
});

function ParamEditor({ m, c, list, i, editable }) {
  const [crit, setCrit] = useState({ code: '', level: '' });
  const [g, setG] = useState('');
  const levels = scaleLevels(m);
  const p = c.params || {};
  const at = (mm) => list(mm)[i].params;
  const num = (key, suffix = '', step) => (editable
    ? <label className="row small" style={{ gap: 4 }}><input className="i compact" style={{ width: 80 }} type="number" step={step} defaultValue={p[key] ?? ''} onBlur={(e) => upd(m, (mm) => { if (e.target.value === '') delete at(mm)[key]; else at(mm)[key] = Number(e.target.value); })} />{suffix}</label>
    : <b>{p[key] ?? '—'}{suffix}</b>);
  switch (c.type) {
    case 'match_threshold':
      return <div className="row">{num('threshold', '%')}{(editable || p.conditionalFrom) && <><span className="small muted">«rivojlanish sharti bilan» zonasi</span>{num('conditionalFrom', '% dan')}</>}</div>;
    case 'kpi_threshold':
      return <div className="row">{num('min', '%')}{editable ? <input className="i compact" style={{ width: 120 }} placeholder="Oxirgi 10 oy" defaultValue={p.period || ''} onBlur={(e) => upd(m, (mm) => { at(mm).period = e.target.value.trim() || undefined; })} /> : <span className="small">{p.period || 'Oxirgi 10 oy'}</span>}</div>;
    case 'observation_avg': return num('min', '', '0.1');
    case 'tenure_months': return num('min', ' oy');
    case 'min_level_all': case 'observation_count': case 'min_methods': return num('min');
    case 'max_gap': return num('max');
    case 'entry_levels':
      return editable
        ? <input className="i compact" style={{ width: 260 }} placeholder="Masalan: LT-2, LT-3, LT-4" defaultValue={(p.levels || []).join(', ')} onBlur={(e) => upd(m, (mm) => { at(mm).levels = e.target.value.split(',').map((x) => x.trim().toUpperCase()).filter(Boolean); })} />
        : <div className="row">{(p.levels || []).map((l) => <span key={l} className="tag">{l}</span>)}</div>;
    case 'required_method':
      return editable
        ? <select className="i compact" value={p.method} onChange={(e) => upd(m, (mm) => { at(mm).method = e.target.value; })}>{m.methods.map((x) => <option key={x} value={x}>{methodLabel(m, x)}</option>)}</select>
        : <b>{methodLabel(m, p.method)}</b>;
    case 'gates':
      return (
        <div className="stack" style={{ gap: 6 }}>
          {(p.items || []).map((it, gi) => <div key={it.code} className="row small"><span className="ic na">{gi + 1}</span>{it.label}{editable && <button className="link-btn" onClick={() => upd(m, (mm) => { at(mm).items.splice(gi, 1); })}>✕</button>}</div>)}
          {editable && <div className="row"><input className="i compact" style={{ flex: 1, minWidth: 200 }} placeholder="Masalan: Til minimumi IELTS ≥ 7.5" value={g} onChange={(e) => setG(e.target.value)} /><button className="btn sm" disabled={!g.trim()} onClick={() => upd(m, (mm) => { const items = at(mm).items; items.push({ code: `g${items.length + 1}-${Date.now() % 10000}`, label: g.trim() }); }) && setG('')}>+ gate</button></div>}
        </div>
      );
    case 'min_level_items':
      return (
        <div className="row">
          {Object.entries(p.items || {}).map(([k, v]) => <span key={k} className="tag">{k} ≥ {v}{editable && <button className="link-btn" onClick={() => upd(m, (mm) => { delete at(mm).items[k]; })}> ✕</button>}</span>)}
          {editable && <>
            <select className="i compact" value={crit.code} onChange={(e) => setCrit({ ...crit, code: e.target.value })}><option value="">kompetensiya</option>{m.competencies.map((x) => <option key={x.code} value={x.code}>{x.code}</option>)}</select>
            <select className="i compact" value={crit.level} onChange={(e) => setCrit({ ...crit, level: e.target.value })}><option value="">daraja</option>{levels.map((n) => <option key={n}>{n}</option>)}</select>
            <button className="btn sm" disabled={!crit.code || !crit.level} onClick={() => upd(m, (mm) => { at(mm).items[crit.code] = Number(crit.level); }) && setCrit({ code: '', level: '' })}>+</button>
          </>}
        </div>
      );
    default: return <span className="muted">—</span>;
  }
}

function RuleEditor({ m, list, conds, editable }) {
  return (
    <table>
      <thead><tr><th>Shart</th><th>Turi</th><th>Qiymat</th><th /></tr></thead>
      <tbody>
        {conds.map((c, i) => (
          <tr key={`${c.type}-${i}`}>
            <td style={{ minWidth: 220 }}><b style={{ fontWeight: 600 }}>{CONDITION_CATALOG[c.type]?.label}</b>{COND_HELP[c.type] && <div className="muted small">{COND_HELP[c.type]}</div>}</td>
            <td className="small">{GROUP_LABELS[CONDITION_CATALOG[c.type]?.group] || CONDITION_CATALOG[c.type]?.group}</td>
            <td><ParamEditor m={m} c={c} list={list} i={i} editable={editable} /></td>
            <td className="num">{editable && <button className="btn sm danger" onClick={() => upd(m, (mm) => { list(mm).splice(i, 1); })}>olib tashlash</button>}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
const COND_HELP = {
  all_numeric: 'Hamma kompetensiya baholangan, «dalil yetarli emas» qolmagan',
  observation_count: 'Kamida shuncha dars yoki ish joyi kuzatuvi',
  observation_avg: 'Kuzatuvlarda ko‘rsatilgan o‘rtacha daraja',
  min_methods: 'Har baho kamida shuncha xil usul bilan tasdiqlangan',
  required_method: 'Bu usul bo‘yicha dalil bo‘lishi shart',
  gates: 'Bittasi bajarilmasa, boshqa natijadan qat’i nazar o‘tib bo‘lmaydi',
  sequential: 'Faqat keyingi darajaga o‘tish mumkin, sakrab bo‘lmaydi',
  entry_levels: 'Qaysi lavozim darajalaridan bu darajaga o‘tish (rotatsiya) mumkin',
  min_level_all: 'Hech bir kompetensiya shundan past bo‘lmasin',
  min_level_items: 'Muhim kompetensiyalar uchun alohida minimum',
  max_gap: 'Maqsaddan ko‘pi bilan shuncha ball kam bo‘lishi mumkin',
  match_threshold: 'To‘plangan ball ÷ maqsadli ball',
  tenure_months: 'Joriy darajada ishlagan muddat',
  kpi_threshold: 'Ish natijasi ko‘rsatkichi',
  stretch_approved: 'Keyingi daraja ko‘lamidagi amaliy vazifa tasdiqlangan',
  target_role: 'Bo‘sh lavozim bo‘lsa — tayinlash, bo‘lmasa — kadrlar zaxirasi',
};
const GROUP_LABELS = { evidence: 'Dalil', eligibility: 'Kirish sharti', competency: 'Kompetensiya', performance: 'Natija', role: 'Rol' };

function Rules({ m, editable }) {
  const [scope, setScope] = useState(m.profiles.find((p) => p.conditions?.length)?.code || '__model');
  const pi = m.profiles.findIndex((p) => p.code === scope);
  const profile = m.profiles[pi];
  const own = !!profile?.conditions?.length;
  const list = (mm) => (pi >= 0 && mm.profiles[pi].conditions?.length ? mm.profiles[pi].conditions : mm.rules.conditions);
  const conds = pi >= 0 ? profileConditions(m, profile) : m.rules.conditions;
  const canEdit = editable && (pi < 0 || own);
  return (
    <Panel title="Keyingi darajaga o‘tish shartlari" actions={canEdit && (
      <select className="i compact" value="" onChange={(e) => {
        const t = e.target.value; if (!t) return;
        const def = DEFAULT_PARAMS(m)[t];
        upd(m, (mm) => list(mm).push(def ? { type: t, params: structuredClone(def) } : { type: t }), 'Shart qo‘shildi');
      }}>
        <option value="">+ Shart qo‘shish</option>
        {Object.entries(CONDITION_CATALOG).filter(([k]) => !conds.some((c) => c.type === k)).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
      </select>
    )} tight>
      <div className="panel-body row" style={{ borderBottom: '1px solid var(--line-2)' }}>
        <span className="small muted">Qaysi daraja uchun:</span>
        <div className="seg">
          <button className={scope === '__model' ? 'on' : ''} onClick={() => setScope('__model')}>Hamma daraja uchun</button>
          {m.profiles.map((p) => <button key={p.code} className={scope === p.code ? 'on' : ''} onClick={() => setScope(p.code)}>{p.code}{p.conditions?.length ? ' •' : ''}</button>)}
        </div>
        {pi >= 0 && (own
          ? <span className="small ink2">{profile.code} ning o‘z shartlari bor.{editable && <> <button className="link-btn" onClick={() => ask('Profil o‘z shartlaridan voz kechib, umumiy qoidalarni oladimi?', () => upd(m, (mm) => { delete mm.profiles[pi].conditions; }))}>Umumiy shartlarga qaytarish</button></>}</span>
          : <span className="small ink2">{profile.code} uchun «hamma daraja uchun» shartlari ishlaydi.{editable && <> <button className="link-btn" onClick={() => upd(m, (mm) => { mm.profiles[pi].conditions = structuredClone(mm.rules.conditions); }, 'Profil uchun alohida shartlar yaratildi')}>Bu daraja uchun alohida shartlar</button></>}</span>)}
      </div>
      <RuleEditor key={scope} m={m} list={list} conds={conds} editable={canEdit} />
      <details className="helpers" style={{ padding: '8px 16px' }}>
        <summary>Natija holati qanday aniqlanadi?</summary>
        <ul className="small ink2" style={{ margin: '6px 0 0', paddingLeft: 18 }}>
          <li>Baholanmagan kompetensiya qolsa — «Baholash tugallanmagan».</li>
          <li>Dalil yetarli bo‘lmasa — «Dalil yetarli emas».</li>
          <li>Majburiy talab, ketma-ketlik yoki kompetensiya sharti bajarilmasa — «Tayyor emas».</li>
          <li>KPI, staj yoki stretch yetishmasa — «Hozircha tayyor emas».</li>
          <li>Moslik «rivojlanish sharti bilan» zonasida bo‘lsa — shu nom bilan.</li>
          <li>Hammasi bajarilsa — {m.transition ? 'bo‘sh lavozim bo‘lsa «Tayinlashga tavsiya», bo‘lmasa «Kadrlar zaxirasiga»' : '«Shartlar bajarilgan»'}.</li>
        </ul>
      </details>
      {editable && (
        <div className="panel-body row" style={{ borderTop: '1px solid var(--line-2)' }}>
          <label className="chk"><input type="checkbox" checked={!!m.transition} onChange={(e) => upd(m, (mm) => { mm.transition = e.target.checked; })} /> Natijadan keyin rasmiy tayinlash qayd etiladi</label>
          <label className="chk"><input type="checkbox" checked={!!m.panelRequired} onChange={(e) => upd(m, (mm) => {
            mm.panelRequired = e.target.checked;
            const has = mm.stages.includes('panel');
            if (e.target.checked && !has) mm.stages.splice(mm.stages.indexOf('approval'), 0, 'panel');
            if (!e.target.checked && has) mm.stages = mm.stages.filter((x) => x !== 'panel');
          })} /> Qaror paneli (kengash) majburiy</label>
          <label className="f" style={{ minWidth: 180 }}>Panel nomi<input className="i compact" defaultValue={m.panelLabel || 'Panel protokoli'} onBlur={(e) => upd(m, (mm) => { mm.panelLabel = e.target.value.trim() || undefined; })} /></label>
          <label className="f" style={{ minWidth: 180 }}>Tasdiqlovchi<input className="i compact" defaultValue={m.approverLabel || 'HRD'} onBlur={(e) => upd(m, (mm) => { mm.approverLabel = e.target.value.trim() || 'HRD'; })} /></label>
          <label className="f" style={{ minWidth: 150 }}>Baholovchi roli<input className="i compact" defaultValue={m.evaluatorRole || 'Assessor'} onBlur={(e) => upd(m, (mm) => { mm.evaluatorRole = e.target.value.trim() || 'Assessor'; })} /></label>
        </div>
      )}
    </Panel>
  );
}

/* ---------------- Sinov ---------------- */
function Sandbox({ m }) {
  const usable = m.profiles.filter((p) => Object.keys(p.targets).length);
  const [profile, setProfile] = useState(usable[usable.length > 1 ? 1 : 0]?.code);
  const [vals, setVals] = useState({});
  const [ctx, setCtx] = useState({ tenureMonths: 24, kpi: 85, stretch: 'approved', role: 'yes', observations: 3, observationAvg: 4.5, gates: 'yes', methods: 'yes' });
  const p = usable.find((x) => x.code === profile) || usable[0];
  if (!p) return <Empty icon="check">Sinash uchun kamida bitta profilga maqsadli darajalar kiriting.</Empty>;
  const levels = scaleLevels(m);
  const scores = {};
  for (const code of Object.keys(p.targets)) scores[code] = vals[code] ?? p.targets[code];
  const partVal = vals.__parts ?? p.targets[Object.keys(m.composites || {})[0]] ?? levels.at(-1);
  const partScores = {};
  for (const code of Object.keys(m.composites || {})) for (const part of m.composites[code].parts) partScores[part] = partVal;
  const resolved = Object.keys(m.composites || {}).length
    ? resolveScores(m, Object.fromEntries(Object.entries(scores).filter(([k]) => !m.composites[k])), partScores)
    : scores;
  const idx = m.profiles.findIndex((x) => x.code === p.code);
  const entry = profileConditions(m, p).find((c) => c.type === 'entry_levels')?.params.levels;
  const prevLevel = entry?.length ? entry[0] : idx > 0 ? m.profiles[idx - 1].code : p.code.replace(/\d+$/, (n) => String(Number(n) - 1));
  const pc = profileConditions(m, p);
  const d = evaluateDecision(m, p, resolved, {
    currentLevel: prevLevel, tenureMonths: Number(ctx.tenureMonths), kpi: { type: 'regular', value: Number(ctx.kpi) }, stretch: ctx.stretch,
    targetRole: ctx.role === 'yes' ? { name: 'Namunaviy vakant rol', rScope: p.scope || 'R1', profileCode: p.scope ? undefined : p.code } : null, observations: Number(ctx.observations),
    observationAvg: Number(ctx.observationAvg),
    evidenceMethods: Object.fromEntries(m.competencies.map((c) => [c.code, ctx.methods === 'yes' ? compMethods(m, c) : compMethods(m, c).slice(0, 1)])),
    gates: Object.fromEntries((pc.find((c) => c.type === 'gates')?.params.items || []).map((g) => [g.code, { met: ctx.gates === 'yes' }])),
  });
  const setV = (code, v) => setVals({ ...vals, [code]: v === 'DE' ? DE : v === '' ? null : Number(v) });
  const has = (t) => pc.some((c) => c.type === t);
  return (
    <div className="split">
      <div className="stack">
        <div className="row">
          <label className="f">Profil<select className="i compact" value={p.code} onChange={(e) => { setProfile(e.target.value); setVals({}); }}>{usable.map((x) => <option key={x.code}>{x.code}</option>)}</select></label>
          {has('tenure_months') && <label className="f">Tajriba, oy<input className="i compact" style={{ width: 80 }} type="number" value={ctx.tenureMonths} onChange={(e) => setCtx({ ...ctx, tenureMonths: e.target.value })} /></label>}
          {has('kpi_threshold') && <label className="f">KPI, %<input className="i compact" style={{ width: 80 }} type="number" value={ctx.kpi} onChange={(e) => setCtx({ ...ctx, kpi: e.target.value })} /></label>}
          {has('stretch_approved') && <label className="f">Stretch<select className="i compact" value={ctx.stretch} onChange={(e) => setCtx({ ...ctx, stretch: e.target.value })}><option value="approved">tasdiqlangan</option><option value="submitted">tekshiruvda</option></select></label>}
          {has('target_role') && <label className="f">Vakant rol<select className="i compact" value={ctx.role} onChange={(e) => setCtx({ ...ctx, role: e.target.value })}><option value="yes">bor</option><option value="no">yo‘q</option></select></label>}
          {has('observation_count') && <label className="f">Kuzatuvlar<input className="i compact" style={{ width: 70 }} type="number" value={ctx.observations} onChange={(e) => setCtx({ ...ctx, observations: e.target.value })} /></label>}
          {has('observation_avg') && <label className="f">Kuzatuv o‘rtachasi<input className="i compact" style={{ width: 80 }} type="number" step="0.1" value={ctx.observationAvg} onChange={(e) => setCtx({ ...ctx, observationAvg: e.target.value })} /></label>}
          {(has('min_methods') || has('required_method')) && <label className="f">Dalil usullari<select className="i compact" value={ctx.methods} onChange={(e) => setCtx({ ...ctx, methods: e.target.value })}><option value="yes">to‘liq</option><option value="no">bitta usul</option></select></label>}
          {has('gates') && <label className="f">Gate’lar<select className="i compact" value={ctx.gates} onChange={(e) => setCtx({ ...ctx, gates: e.target.value })}><option value="yes">bajarilgan</option><option value="no">bajarilmagan</option></select></label>}
        </div>
        <table>
          <thead><tr><th>Kompetensiya</th><th className="num">Maqsad</th><th>Namunaviy baho</th></tr></thead>
          <tbody>
            {Object.entries(p.targets).map(([code, t]) => (
              <tr key={code}>
                <td><span className="code">{code}</span> {m.competencies.find((c) => c.code === code)?.name}</td>
                <td className="num">{t}</td>
                <td>
                  {m.composites?.[code] ? (
                    <span className="small">Barcha qismlar ({m.composites[code].parts.length}): <select className="i compact" value={partVal} onChange={(e) => setVals({ ...vals, __parts: e.target.value === 'DE' ? DE : Number(e.target.value) })}>{levels.map((n) => <option key={n}>{n}</option>)}<option>DE</option></select> → {String(resolved[code])}</span>
                  ) : (
                    <select className="i compact" value={scores[code] ?? ''} onChange={(e) => setV(code, e.target.value)}>
                      <option value="">—</option>{levels.map((n) => <option key={n}>{n}</option>)}<option>DE</option>
                    </select>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="stack">
        <Gauge value={d.match.match} partial={d.match.targetSum ? (100 * d.match.creditedSum) / d.match.targetSum : 0} threshold={pc.find((x) => x.type === 'match_threshold')?.params.threshold} label={d.match.match === null ? '—' : fmtPct(d.match.match)} sub="sinov" />
        <div className="small ink2">{d.match.creditedSum} ÷ {d.match.targetSum} · qamrov {Math.round(d.match.coverage * 100)}%</div>
        <Conditions list={d.conditions} />
        <div className={`callout ${d.tone === 'good' ? 'good' : d.tone === 'bad' ? 'bad' : 'warn'}`}><b>{d.label}</b><div className="small">{d.next}</div></div>
      </div>
    </div>
  );
}

/* ---------------- Sahifa ---------------- */
// E'lon tekshiruvi xatolarini tablar bo'yicha guruhlash — foydalanuvchi qayerda tuzatishni darhol ko'radi.
const TAB_OF = (e) => (/vazn|usul/i.test(e) && !/shart/i.test(e) ? 'methods'
  : /profil|maqsad/i.test(e) ? 'profiles'
  : /shart|chegara|Kritik|Gate|Minimal daraja|Kuzatuv/i.test(e) ? 'rules'
  : 'structure');
const TABS = [
  ['structure', 'Kompetensiyalar', '1'],
  ['profiles', 'Darajalar va maqsadlar', '2'],
  ['methods', 'Baholash usullari', '3'],
  ['rules', 'O‘tish shartlari', '4'],
  ['sandbox', 'Sinab ko‘rish', '5'],
];

export default function ModelDetail({ id }) {
  const s = useAppState();
  const [tab, setTab] = useState('structure');
  const m = D.getModel(s, id);
  if (!m) return <Panel>Model topilmadi. <a href="#/models">Modellar ro‘yxatiga qaytish</a></Panel>;
  const editable = m.status === 'draft';
  const errs = validateModel(m);
  const errBy = (t) => errs.filter((e) => TAB_OF(e) === t);
  const cardsUsing = s.cards.filter((c) => c.modelVersionId === m.id).length;
  const versions = s.models.filter((x) => x.modelId === m.modelId && x.id !== m.id);
  const openDraft = versions.find((x) => x.status === 'draft' || x.status === 'review');
  const counts = { structure: m.competencies.length, profiles: m.profiles.length, methods: m.methods.length, rules: null, sandbox: null };
  const newVersion = () => {
    const ok = run(D.createDraft, { fromId: m.id }, 'Qoralama versiya yaratildi — endi tahrirlashingiz mumkin');
    const dr = ok && getState().models.find((x) => x.modelId === m.modelId && x.status === 'draft');
    if (dr) go(`/models/${encodeURIComponent(dr.id)}`);
  };
  return (
    <>
      <section className="panel hero compact-hero">
        <div className="hero-top">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="crumbs"><a href="#/models"><Icon name="back" size={13} /> Kompetensiya modellari</a></div>
            <div className="row" style={{ marginTop: 4, flexWrap: 'nowrap' }}>
              {editable
                ? <input className="i title-input" title="Nomni o‘zgartirish uchun bosing" defaultValue={m.name} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== m.name) upd(m, (mm) => { mm.name = v; }, 'Nom saqlandi'); }} />
                : <h1>{m.name}</h1>}
              <Pill tone={MODEL_STATUS[m.status][1]}>{MODEL_STATUS[m.status][0]}</Pill>
            </div>
            <div className="meta">
              <span>{m.competencies.length} kompetensiya</span>
              <span>{m.profiles.length} daraja{m.profiles.length ? ` (${m.profiles[0].code}…${m.profiles.at(-1).code})` : ''}</span>
              <span>{m.methods.length} baholash usuli</span>
              <span>1–{scaleMax(m)} shkala</span>
              <span>{cardsUsing ? `${cardsUsing} ta kartada ishlatilmoqda` : 'kartalarda ishlatilmagan'}</span>
            </div>
          </div>
          <div className="row">
            {m.status === 'active' && (openDraft
              ? <button className="btn" onClick={() => go(`/models/${encodeURIComponent(openDraft.id)}`)}>Ochiq qoralamaga o‘tish</button>
              : <button className="btn primary" onClick={newVersion}>Tahrirlash (yangi versiya)</button>)}
            {m.status === 'draft' && <button className="btn primary" disabled={errs.length > 0} title={errs.length ? 'Avval barcha muammolarni tuzating' : ''} onClick={() => run(D.setModelStatus, { id: m.id, status: 'review', actor: 'HR/L&D' }, 'Tekshiruvga yuborildi')}>Tekshiruvga yuborish</button>}
            {m.status === 'review' && <>
              <button className="btn" onClick={() => run(D.setModelStatus, { id: m.id, status: 'draft', actor: m.approverLabel || 'HRD' }, 'Qoralamaga qaytarildi')}>Qaytarish</button>
              <button className="btn primary" onClick={() => run(D.setModelStatus, { id: m.id, status: 'active', actor: m.approverLabel || 'HRD' }, 'Versiya tasdiqlandi va faollashtirildi')}>Tasdiqlash va faollashtirish</button>
            </>}
          </div>
        </div>
        {editable && (
          <div className="readiness">
            {TABS.map(([k, l, n]) => {
              const e = k === 'sandbox' ? [] : errBy(k);
              return (
                <button key={k} className={`rd ${e.length ? 'bad' : 'ok'} ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>
                  <span className="rd-n">{e.length ? '!' : k === 'sandbox' ? n : '✓'}</span>
                  <span><b>{l}</b><small>{k === 'sandbox' ? 'ixtiyoriy' : e.length ? `${e.length} ta muammo` : 'tayyor'}</small></span>
                </button>
              );
            })}
            <div className={`rd final ${errs.length ? '' : 'ok'}`}>
              <span className="rd-n">6</span>
              <span><b>Tekshiruvga yuborish</b><small>{errs.length ? `${errs.length} ta muammo qoldi` : 'hammasi tayyor'}</small></span>
            </div>
          </div>
        )}
        {m.status === 'review' && <div className="callout warn small">Versiya tekshiruvda. {m.approverLabel || 'HRD'} tasdiqlagach faol bo‘ladi va yangi kartalar shu versiya bilan ochiladi.</div>}
        <details className="helpers">
          <summary>Versiya ma’lumotlari</summary>
          <div className="small ink2" style={{ marginTop: 6, display: 'grid', gap: 3 }}>
            {m.note && <div>{m.note}</div>}
            <div>Versiya: {m.id}{m.basedOn ? ` · asos: ${m.basedOn}` : ''} · yaratgan: {m.createdBy} · tasdiqlagan: {m.approvedBy || '—'}{m.approvedAt ? ` (${fmtDate(m.approvedAt)})` : ''}</div>
            {versions.length > 0 && <div>Boshqa versiyalar: {versions.map((x, i) => <span key={x.id}>{i ? ', ' : ''}<a href={`#/models/${encodeURIComponent(x.id)}`}>{x.id}</a> ({MODEL_STATUS[x.status][0].toLowerCase()})</span>)}</div>}
            <div>Mavjud kartalar o‘z versiyasida qoladi: yangi versiya faqat yangi kartalarga qo‘llanadi.</div>
          </div>
        </details>
      </section>
      <div className="tabs">
        {TABS.map(([k, l]) => {
          const e = editable && k !== 'sandbox' ? errBy(k).length : 0;
          return <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}{counts[k] !== null && <span className="tab-n">{counts[k]}</span>}{e > 0 && <span className="tab-n bad">{e}</span>}</button>;
        })}
      </div>
      {editable && tab !== 'sandbox' && errBy(tab).length > 0 && (
        <div className="callout bad small"><b>Shu bo‘limda tuzatish kerak:</b><ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>{errBy(tab).slice(0, 6).map((e) => <li key={e}>{e}</li>)}</ul>{errBy(tab).length > 6 && <div>… yana {errBy(tab).length - 6} ta</div>}</div>
      )}
      {!editable && m.status === 'active' && tab !== 'sandbox' && <div className="muted small">Faol versiyani to‘g‘ridan-to‘g‘ri o‘zgartirib bo‘lmaydi — «Tahrirlash (yangi versiya)» tugmasini bosing.</div>}
      {tab === 'structure' && <Structure m={m} s={s} editable={editable} cardsUsing={cardsUsing} />}
      {tab === 'profiles' && <Profiles m={m} editable={editable} />}
      {tab === 'methods' && <Methods m={m} editable={editable} />}
      {tab === 'rules' && <Rules m={m} editable={editable} />}
      {tab === 'sandbox' && <Panel title="Sinab ko‘rish: namunaviy baholar bilan qaror qanday chiqadi"><Sandbox key={m.id} m={m} /></Panel>}
    </>
  );
}
