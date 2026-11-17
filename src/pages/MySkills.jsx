import { useState } from 'react';
import { useAppState, run } from '../state/store.js';
import { Panel, Empty, fmtDate } from '../ui/common.jsx';
import * as D from '../core/domain.js';
import { nextProfile, positionName } from '../core/modelKit.js';
import { SkillDots, SkillStatus, Supports } from './Skills.jsx';

function AddForm({ s, emp, preset, onDone }) {
  const [f, setF] = useState({ skillId: preset?.skillId || '', level: String(preset?.level || 2), evidence: '', link: '' });
  const cur = f.skillId ? D.empSkill(s, emp.id, f.skillId) : null;
  const needEv = cur?.status === 'confirmed';
  return (
    <Panel title={cur ? 'Darajani yangilash' : 'Ko‘nikma qo‘shish'} actions={<button className="btn sm" onClick={onDone}>Yopish</button>}>
      <div className="stack">
        <label className="f">Ko‘nikma
          <select className="i" value={f.skillId} disabled={!!preset} onChange={(e) => setF({ ...f, skillId: e.target.value })}>
            <option value="">— tanlang —</option>
            {Object.entries(D.SKILL_GROUPS).map(([g, l]) => <optgroup key={g} label={l}>{s.skillCatalog.filter((k) => k.group === g).map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}</optgroup>)}
          </select>
        </label>
        <div className="f">Daraja
          <div className="grid g3" style={{ gap: 8 }}>
            {[1, 2, 3].map((l) => (
              <label key={l} className={`quiz-opt ${f.level === String(l) ? 'on' : ''}`} style={{ alignItems: 'flex-start' }}>
                <input type="radio" checked={f.level === String(l)} onChange={() => setF({ ...f, level: String(l) })} />
                <span><b>{D.SKILL_LEVELS[l][0]}</b><div className="small muted">{D.SKILL_LEVELS[l][1]}</div></span>
              </label>
            ))}
          </div>
        </div>
        <label className="f">Dalil {needEv ? '(majburiy — daraja tasdiqlangan)' : '(ixtiyoriy — bo‘lsa, mentor tasdiqlaydi)'}
          <textarea className="i" placeholder="Qayerda va qanday foydalandingiz, natija. Masalan: haftalik hisobotni AI bilan tayyorlayman, vaqt 2 soatdan 30 daqiqaga tushdi." value={f.evidence} onChange={(e) => setF({ ...f, evidence: e.target.value })} />
        </label>
        <label className="f">Havola yoki sertifikat (ixtiyoriy)<input className="i" value={f.link} onChange={(e) => setF({ ...f, link: e.target.value })} /></label>
        <div className="row">
          <button className="btn primary" disabled={!f.skillId || (needEv && !f.evidence.trim())} onClick={() => run(D.declareSkill, { employeeId: emp.id, ...f }, f.evidence.trim() ? 'Tasdiqlashga yuborildi' : 'Ko‘nikma qo‘shildi') && onDone()}>{f.evidence.trim() ? 'Tasdiqlashga yuborish' : 'Saqlash'}</button>
          <span className="small muted">Dalilsiz — «o‘zi belgilagan» bo‘lib ko‘rinadi. Kurs orqali o‘rgansangiz, avtomatik tasdiqlanadi.</span>
        </div>
      </div>
    </Panel>
  );
}

export default function MySkills({ emp }) {
  const s = useAppState();
  const [form, setForm] = useState(null);
  const mine = s.empSkills.filter((x) => x.employeeId === emp.id);
  const model = D.activeModel(s, emp.position);
  const next = model ? nextProfile(model, emp.currentLevel) : null;
  const targets = [...new Set([emp.currentLevel, next, ...s.interests.filter((x) => x.employeeId === emp.id).map((x) => x.target)].filter((c) => c && D.skillProfile(s, c).length))];
  const courseFor = (skillId) => s.courses.find((c) => c.status === 'active' && (c.skills || []).some((x) => x.skillId === skillId));
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Ko‘nikmalarim</h1>
          <p>Ishda foydalanadigan vosita va texnologiyalar: AI, Miro, Excel, CRM, LMS. Kompetensiyadan alohida — uni to‘ldiradi, lekin lavozimga moslik foiziga kirmaydi.</p>
        </div>
        {!form && <button className="btn primary" onClick={() => setForm({})}>+ Ko‘nikma qo‘shish</button>}
      </div>
      {form && <AddForm key={form.skillId || 'new'} s={s} emp={emp} preset={form.skillId ? form : null} onDone={() => setForm(null)} />}

      {targets.map((code) => (
        <Panel key={code} tight title={<div><h2>{code === emp.currentLevel ? 'Joriy lavozimingiz' : code === next ? 'Keyingi daraja' : 'Qiziqqan lavozimingiz'}: {code} — {positionName(s.models, code)}</h2><div className="muted small">Tavsiya etilgan ko‘nikmalar — majburiy emas</div></div>}>
          <table><tbody>{D.skillProfile(s, code).map((x) => {
            const k = D.getSkill(s, x.skillId);
            const r = D.empSkill(s, emp.id, x.skillId);
            const ok = r && r.level >= x.level;
            const c = courseFor(x.skillId);
            return (
              <tr key={x.skillId}>
                <td style={{ width: 28, color: ok ? 'var(--good)' : 'var(--ink-3)' }}>{ok ? '✓' : '○'}</td>
                <td><b>{k.name}</b><div className="small muted">kerak: {D.SKILL_LEVELS[x.level][0]}</div></td>
                <td>{r ? <span className="row" style={{ gap: 6 }}><SkillDots level={r.level} status={r.status} /><span className="small">{D.SKILL_LEVELS[r.level][0]}</span></span> : <span className="muted small">belgilanmagan</span>}</td>
                <td className="num">
                  {!ok && c && <a className="btn sm" href="#/learning">Kurs: {c.title}</a>}
                  {!ok && !c && <button className="btn sm" onClick={() => setForm({ skillId: x.skillId, level: x.level })}>{r ? 'Darajani yangilash' : 'Belgilash'}</button>}
                </td>
              </tr>
            );
          })}</tbody></table>
        </Panel>
      ))}

      <Panel tight title={<div className="row"><h2>Mening ko‘nikmalarim</h2><span className="muted small">{mine.length} ta</span></div>}>
        {mine.length ? (
          <table>
            <thead><tr><th>Ko‘nikma</th><th>Daraja</th><th>Manba</th><th>Qaysi kompetensiyani to‘ldiradi</th><th /></tr></thead>
            <tbody>{mine.map((r) => {
              const k = D.getSkill(s, r.skillId);
              return (
                <tr key={r.id}>
                  <td><b>{k.name}</b><div className="small muted">{D.SKILL_GROUPS[k.group]}</div></td>
                  <td><div className="row" style={{ gap: 6 }}><SkillDots level={r.level} status={r.status} /><b className="small">{D.SKILL_LEVELS[r.level][0]}</b></div><div style={{ marginTop: 4 }}><SkillStatus r={r} /></div></td>
                  <td className="small">{r.source}<div className="muted">{fmtDate(r.at)}</div>{r.review?.decision === 'rejected' && <div style={{ color: 'var(--bad)' }}>Tasdiqlanmadi: {r.review.note}</div>}</td>
                  <td><Supports s={s} skill={k} /></td>
                  <td className="num">{!r.claim && r.level < 3 && <button className="btn sm" onClick={() => setForm({ skillId: r.skillId, level: r.level + 1 })}>Darajani oshirish</button>}</td>
                </tr>
              );
            })}</tbody>
          </table>
        ) : <Empty>Hali ko‘nikma belgilanmagan.</Empty>}
      </Panel>
      <p className="small muted">Darajalar: {[1, 2, 3].map((l) => `${D.SKILL_LEVELS[l][0]} — ${D.SKILL_LEVELS[l][1]}`).join(' · ')}</p>
    </>
  );
}
