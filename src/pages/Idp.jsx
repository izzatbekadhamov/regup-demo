import { useState } from 'react';
import { useAppState, run } from '../state/store.js';
import { Panel, Pill, fmtDate, Person, Empty, ask } from '../ui/common.jsx';
import * as D from '../core/domain.js';
import { IDP_STATUS, IDP_SOURCE } from '../ui/labels.js';
import { scaleLevels, levelName } from '../core/modelKit.js';

const goalOf = (s, x) => {
  if (x.goal) return x.goal;
  const card = x.cardId && D.getCard(s, x.cardId);
  return card ? D.levelHeadline(D.getModel(s, card.modelVersionId), x.competency, x.targetLevel) : '';
};

function SourcePill({ x }) {
  const src = IDP_SOURCE[x.source || 'auto'];
  return <span className={`pill ${src[1]}`}>{x.source === 'employee' ? 'Xodim taklifi' : src[0]}</span>;
}

function AddItem({ s, onDone }) {
  const [f, setF] = useState({ employeeId: s.employees[0].id, competency: '', targetLevel: '', task: '', owner: 'Bevosita rahbar (mentor)', due: '' });
  const emp = D.getEmployee(s, f.employeeId);
  const model = s.models.find((m) => m.status === 'active' && m.modelId === emp.position);
  const comps = model ? model.competencies.filter((c) => !c.composite) : [];
  const comp = f.competency || comps[0]?.code;
  const cur = (emp.records[comp] || []).filter((r) => r.context === 'work').at(-1)?.level;
  const target = f.targetLevel || Math.min((cur ?? 2) + 1, model ? scaleLevels(model).length : 5);
  return (
    <section className="panel add-box">
      <div className="row between"><h3>+ Mentor yoki HR vazifa qo‘shadi</h3><button className="btn sm" onClick={onDone}>Yopish</button></div>
      <div className="grid g3" style={{ gap: 8, marginTop: 10 }}>
        <label className="f">Xodim<select className="i" value={f.employeeId} onChange={(e) => setF({ ...f, employeeId: e.target.value, competency: '', targetLevel: '' })}>{D.activeEmployees(s).map((x) => <option key={x.id} value={x.id}>{x.name} · {x.currentLevel}</option>)}</select></label>
        <label className="f">Kompetensiya<select className="i" value={comp} onChange={(e) => setF({ ...f, competency: e.target.value, targetLevel: '' })}>{comps.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}</select></label>
        <label className="f">Maqsadli daraja{cur ? ` (hozir ${cur})` : ''}<select className="i" value={target} onChange={(e) => setF({ ...f, targetLevel: Number(e.target.value) })}>{model && scaleLevels(model).filter((l) => l > (cur ?? 0)).map((l) => <option key={l} value={l}>{l} — {levelName(model, l)}</option>)}</select></label>
        <label className="f" style={{ gridColumn: 'span 3' }}>Vazifa<input className="i" placeholder="Nima qilinadi va qanday natija kutiladi" value={f.task} onChange={(e) => setF({ ...f, task: e.target.value })} /></label>
        <label className="f">Mentor / mas’ul<input className="i" value={f.owner} onChange={(e) => setF({ ...f, owner: e.target.value })} /></label>
        <label className="f">Muddat<input className="i" type="date" value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} /></label>
      </div>
      <div className="row" style={{ marginTop: 10 }}>
        <button className="btn primary" disabled={!f.task.trim() || !f.due} onClick={() => run(D.addIdpItem, { ...f, competency: comp, targetLevel: target, by: 'mentor', actor: f.owner }, 'Vazifa qo‘shildi va xodimga yuborildi') && onDone()}>Qo‘shish va xodimga yuborish</button>
        <span className="muted small">Mentor qo‘shgan vazifa darhol faol bo‘ladi.</span>
      </div>
    </section>
  );
}

function Proposed({ x, s }) {
  const [f, setF] = useState({ task: x.task, owner: x.owner, due: x.due || '', reassessAt: x.reassessAt || '', courseId: x.courseId || '' });
  const e = D.getEmployee(s, x.employeeId);
  return (
    <div className="idp-row">
      <div className="row between">
        <Person name={e.name} sub={x.cardId ? <a href={`#/cards/${x.cardId}`}>baholash kartasidan</a> : `${x.createdBy || 'xodim'} taklifi`} />
        <div className="row"><SourcePill x={x} /><span className="tag">{x.competency}</span><span className="small">{x.fromLevel ?? (x.source === 'auto' ? 'DE' : '—')} → {x.targetLevel}</span>{x.priority && <Pill tone="bad">ustuvor</Pill>}</div>
      </div>
      {goalOf(s, x) && <div className="small ink2">Maqsadli daraja: {goalOf(s, x)}</div>}
      <div className="grid g3" style={{ gap: 8 }}>
        <label className="f" style={{ gridColumn: 'span 3' }}>Vazifa<input className="i" value={f.task} onChange={(ev) => setF({ ...f, task: ev.target.value })} /></label>
        <label className="f">Mentor / mas’ul<input className="i" value={f.owner} onChange={(ev) => setF({ ...f, owner: ev.target.value })} /></label>
        <label className="f">Muddat<input className="i" type="date" value={f.due} onChange={(ev) => setF({ ...f, due: ev.target.value })} /></label>
        <label className="f">Kurs (ixtiyoriy)<input className="i" placeholder="Exode kurs ID" value={f.courseId} onChange={(ev) => setF({ ...f, courseId: ev.target.value })} /></label>
      </div>
      <div className="row">
        <button className="btn primary sm" onClick={() => run(D.activateIdp, { id: x.id, patch: { ...f, courseId: f.courseId || null, owner: f.owner } }, 'Vazifa faollashtirildi — xodim kabinetida ko‘rinadi')}>{x.source === 'employee' ? 'Tasdiqlash' : 'Faollashtirish va xodimga yuborish'}</button>
        {x.source === 'employee' && <button className="btn danger sm" onClick={() => ask('Rad etish sababi', (r) => run(D.updateIdp, { id: x.id, patch: { status: 'rejected', review: { by: 'Mentor', at: s.today, reason: r } } }, 'Taklif rad etildi'), { input: true, ok: 'Rad etish' })}>Rad etish</button>}
      </div>
    </div>
  );
}

function Review({ x, s }) {
  const [reason, setReason] = useState('');
  const e = D.getEmployee(s, x.employeeId);
  return (
    <div className="idp-row">
      <div className="row between">
        <Person name={e.name} sub={`yuborilgan ${fmtDate(x.submittedAt)}`} />
        <div className="row"><span className="tag">{x.competency}</span><span className="small">{x.targetLevel}-darajaga</span></div>
      </div>
      <div className="small"><b>Vazifa:</b> {x.task}</div>
      <div className="callout small"><b>Xodim dalili:</b> {x.evidence}</div>
      <div className="row">
        <input className="i" style={{ flex: 1, minWidth: 220 }} placeholder="Qaytarish sababi (faqat qaytarishda majburiy)" value={reason} onChange={(ev) => setReason(ev.target.value)} />
        <button className="btn primary sm" onClick={() => run(D.reviewIdp, { id: x.id, decision: 'done', reason }, 'Vazifa qabul qilindi')}>Qabul qilish</button>
        <button className="btn danger sm" disabled={!reason.trim()} onClick={() => run(D.reviewIdp, { id: x.id, decision: 'returned', reason }, 'Vazifa qaytarildi')}>Qaytarish</button>
      </div>
    </div>
  );
}

export default function Idp() {
  const s = useAppState();
  const [adding, setAdding] = useState(false);
  const proposed = s.idp.filter((x) => x.status === 'proposed');
  const review = s.idp.filter((x) => x.status === 'review');
  const rest = s.idp.filter((x) => !['proposed', 'review'].includes(x.status));
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Rivojlanish rejalari</h1>
          <p>Vazifalar uch yo‘l bilan paydo bo‘ladi: tizim e’lon qilingan natijadagi har bir yetishmovchilikni o‘zi aniqlaydi; xodim o‘zi taklif qiladi; mentor yoki HR qo‘lda qo‘shadi. Tasdiqlangan vazifani xodim kabinetida ko‘radi va bajarganini yuboradi.</p>
        </div>
        {!adding && <button className="btn primary" onClick={() => setAdding(true)}>+ Vazifa qo‘shish</button>}
      </div>
      {adding && <AddItem s={s} onDone={() => setAdding(false)} />}
      <Panel title={<div className="row"><h2>1. Tasdiqlash kutilmoqda</h2><Pill tone={proposed.length ? 'warn' : 'muted'}>{proposed.length}</Pill></div>}>
        {proposed.length ? <div className="stack" style={{ gap: 12 }}>{proposed.map((x) => <Proposed key={x.id} x={x} s={s} />)}</div> : <Empty>Yangi taklif yo‘q.</Empty>}
      </Panel>
      <Panel title={<div className="row"><h2>2. Xodim bajarganini yubordi</h2><Pill tone={review.length ? 'warn' : 'muted'}>{review.length}</Pill></div>}>
        {review.length ? <div className="stack" style={{ gap: 12 }}>{review.map((x) => <Review key={x.id} x={x} s={s} />)}</div> : <Empty>Tekshiriladigan dalil yo‘q.</Empty>}
      </Panel>
      <Panel title="3. Faol va yopilgan vazifalar" tight>
        {rest.length ? (
          <table>
            <thead><tr><th>Xodim</th><th>Kompetensiya</th><th>Vazifa</th><th>Mas’ul</th><th>Muddat</th><th>Holat</th><th /></tr></thead>
            <tbody>{rest.map((x) => (
              <tr key={x.id}>
                <td><Person name={D.getEmployee(s, x.employeeId).name} /></td>
                <td className="code">{x.competency} <span className="muted">→ {x.targetLevel}</span><div style={{ marginTop: 4 }}><SourcePill x={x} /></div></td>
                <td className="small">{x.task}{x.courseId && <div className="muted">Kurs: {x.courseId}{x.learningStatus ? ` · ${x.learningStatus}` : ''}</div>}</td>
                <td className="small">{x.owner}</td>
                <td className="small" style={{ whiteSpace: 'nowrap' }}>{fmtDate(x.due)}</td>
                <td><Pill tone={IDP_STATUS[x.status][1]}>{IDP_STATUS[x.status][0]}</Pill></td>
                <td>{x.courseId && x.status !== 'done' && <button className="btn sm" onClick={() => run(D.courseCompleted, { employeeId: x.employeeId, courseId: x.courseId, externalId: `exode:${x.employeeId}:${x.courseId}` }, 'Exode: kurs yakuni qabul qilindi')}>Exode’dan kurs yakuni</button>}</td>
              </tr>
            ))}</tbody>
          </table>
        ) : <Empty>Faol vazifa yo‘q.</Empty>}
      </Panel>
    </>
  );
}
