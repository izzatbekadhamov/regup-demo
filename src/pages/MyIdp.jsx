import { useState } from 'react';
import { useAppState, run } from '../state/store.js';
import { Panel, Pill, Empty, fmtDate } from '../ui/common.jsx';
import * as D from '../core/domain.js';
import { IDP_STATUS, IDP_SOURCE } from '../ui/labels.js';
import { scaleLevels, levelName } from '../core/modelKit.js';

function compInfo(s, x) {
  const card = x.cardId ? D.getCard(s, x.cardId) : null;
  const model = card ? D.getModel(s, card.modelVersionId) : s.models.find((m) => m.status === 'active' && m.competencies.some((c) => c.code === x.competency));
  const comp = model?.competencies.find((c) => c.code === x.competency);
  return { model, comp, goal: x.goal || (model ? D.levelHeadline(model, x.competency, x.targetLevel) : '') };
}

function Item({ x, s, emp }) {
  const [ev, setEv] = useState('');
  const { comp, goal } = compInfo(s, x);
  const late = x.status !== 'done' && x.due && x.due < s.today;
  const canSubmit = x.status === 'open' || x.status === 'returned';
  return (
    <section className={`panel idp-item ${x.status}`}>
      <div className="row between">
        <div className="row">
          <span className="tag">{x.competency}</span>
          <b>{comp?.name || x.competency}</b>
          {x.priority && <Pill tone="bad">ustuvor</Pill>}
        </div>
        <div className="row">
          {IDP_SOURCE[x.source || 'auto'] && <span className={`pill ${IDP_SOURCE[x.source || 'auto'][1]}`} title={x.createdBy ? `Qo‘shgan: ${x.createdBy}` : 'Baholash natijasidan avtomatik'}>{x.source === 'employee' && x.status === 'proposed' ? 'O‘z taklifim' : x.source === 'plan' && x.targetPosition ? `${x.targetPosition} lavozimiga tayyorlash` : IDP_SOURCE[x.source || 'auto'][0]}</span>}
          {late && <Pill tone="bad">muddati o‘tgan</Pill>}
          <Pill tone={x.status === 'proposed' ? 'warn' : IDP_STATUS[x.status][1]}>{x.status === 'proposed' ? 'Mentor tasdig‘ini kutmoqda' : IDP_STATUS[x.status][0]}</Pill>
        </div>
      </div>
      <div className="idp-goal">
        <div className="level-jump">
          <span className="score">{x.fromLevel ?? '?'}</span><span className="muted">→</span><span className="score ok">{x.targetLevel}</span>
        </div>
        <div style={{ minWidth: 0 }}>
          <div className="small muted">Maqsad: {x.targetLevel}-daraja</div>
          <div>{goal || '—'}</div>
        </div>
      </div>
      <div className="kv-grid">
        <div><span>Vazifa</span><b>{x.task}</b></div>
        <div><span>Mentor / mas’ul</span><b>{x.owner}</b></div>
        <div><span>Muddat</span><b>{fmtDate(x.due)}</b></div>
        {x.reassessAt && <div><span>Qayta baholash</span><b>{fmtDate(x.reassessAt)}</b></div>}
        {x.courseId && <div><span>Kurs</span><b>{x.courseId}{x.learningStatus ? ` · ${x.learningStatus}` : ''}</b></div>}
      </div>
      {x.status === 'rejected' && <div className="callout small">Mentor bu taklifni rejaga kiritmadi: {x.review?.reason}</div>}
      {x.status === 'returned' && x.review?.reason && <div className="callout bad small"><b>Qaytarildi:</b> {x.review.reason} — {x.review.by}, {fmtDate(x.review.at)}</div>}
      {x.status === 'review' && <div className="callout warn small">Dalilingiz {fmtDate(x.submittedAt)} da yuborildi, mentor yoki HR ko‘rib chiqmoqda. «{x.evidence}»</div>}
      {x.status === 'done' && <div className="callout good small">Qabul qilindi{x.review ? ` (${x.review.by}, ${fmtDate(x.review.at)})` : ''}. Darajangiz keyingi baholashda rubrika bo‘yicha yangilanadi{x.reassessAt ? ` — ${fmtDate(x.reassessAt)}` : ''}.</div>}
      {canSubmit && (
        <div className="stack" style={{ gap: 8 }}>
          <label className="f">Bajarganingizni yozing
            <textarea className="i" placeholder="Nima qildingiz, qanday natija bo‘ldi, qaysi hujjat yoki havola dalil bo‘ladi?" value={ev} onChange={(e) => setEv(e.target.value)} />
          </label>
          <div className="row">
            <button className="btn primary" disabled={!ev.trim()} onClick={() => run(D.submitIdpEvidence, { id: x.id, employeeId: emp.id, evidence: ev }, 'Dalil mentor va HRga yuborildi') && setEv('')}>Bajarildi — dalilni yuborish</button>
            <span className="muted small">Mentor tekshiradi; daraja keyingi baholashda rubrika bo‘yicha yangilanadi.</span>
          </div>
        </div>
      )}
    </section>
  );
}

function AddOwn({ s, emp, onDone }) {
  const model = s.models.find((m) => m.status === 'active' && m.modelId === emp.position);
  const idx = model ? model.profiles.findIndex((p) => p.code === emp.currentLevel) : -1;
  const next = model?.profiles[Math.min(idx + 1, model.profiles.length - 1)];
  const comps = model ? model.competencies.filter((c) => !c.composite) : [];
  const cur = (code) => (emp.records[code] || []).filter((r) => r.context === 'work').at(-1)?.level;
  const [f, setF] = useState({ competency: comps[0]?.code || '', targetLevel: '', task: '', due: '', owner: '' });
  const maxL = model ? scaleLevels(model).length : 5;
  const target = f.targetLevel || Math.min(maxL, Math.max(next?.targets[f.competency] ?? 0, (cur(f.competency) ?? 1) + 1));
  return (
    <section className="panel add-box">
      <h3>+ O‘zim vazifa qo‘shish</h3>
      <p className="small ink2" style={{ marginTop: 4 }}>Rivojlantirmoqchi bo‘lgan kompetensiyangiz bo‘yicha o‘zingiz vazifa taklif qiling. Mentor tasdiqlagach rejangizga kiradi.</p>
      <div className="grid g3" style={{ gap: 8, marginTop: 10 }}>
        <label className="f">Kompetensiya
          <select className="i" value={f.competency} onChange={(e) => setF({ ...f, competency: e.target.value, targetLevel: '' })}>
            {comps.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.name}{cur(c.code) ? ` (hozir ${cur(c.code)})` : ''}</option>)}
          </select>
        </label>
        <label className="f">Maqsadli daraja
          <select className="i" value={target} onChange={(e) => setF({ ...f, targetLevel: Number(e.target.value) })}>
            {scaleLevels(model).filter((l) => l > (cur(f.competency) ?? 0)).map((l) => <option key={l} value={l}>{l} — {levelName(model, l)}</option>)}
          </select>
        </label>
        <label className="f">Qachongacha<input className="i" type="date" value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} /></label>
      </div>
      <label className="f" style={{ marginTop: 8 }}>Nima qilaman
        <textarea className="i" placeholder="Masalan: Coursera’dagi moliyaviy tahlil kursini tugataman va filial byudjetini o‘zim tuzaman" value={f.task} onChange={(e) => setF({ ...f, task: e.target.value })} />
      </label>
      <div className="row" style={{ marginTop: 10 }}>
        <button className="btn primary" disabled={!f.task.trim() || !f.due} onClick={() => run(D.addIdpItem, { employeeId: emp.id, competency: f.competency, targetLevel: target, task: f.task, due: f.due, by: 'employee' }, 'Taklif mentorga yuborildi') && onDone()}>Mentorga yuborish</button>
        <button className="btn" onClick={onDone}>Bekor qilish</button>
      </div>
    </section>
  );
}

export default function MyIdp({ emp }) {
  const s = useAppState();
  const [adding, setAdding] = useState(false);
  const mine = s.idp.filter((x) => x.employeeId === emp.id);
  // Tizim takliflari HR faollashtirguncha ko'rinmaydi; xodimning o'z takliflari esa darhol ko'rinadi.
  const visible = mine.filter((x) => x.status !== 'proposed' || x.source === 'employee');
  const pending = mine.filter((x) => x.status === 'proposed' && x.source !== 'employee').length;
  const order = { returned: 0, open: 1, proposed: 2, review: 3, done: 4, rejected: 5 };
  const sorted = [...visible].sort((a, b) => order[a.status] - order[b.status]);
  const active = visible.filter((x) => !['proposed', 'rejected'].includes(x.status));
  const done = active.filter((x) => x.status === 'done').length;
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Rivojlanish rejam</h1>
          <p>Baholash natijasidan tizim taklif qilgan, mentor qo‘shgan va o‘zingiz taklif qilgan vazifalar: nimaga erishish kerak, kim yordam beradi va qachongacha.</p>
        </div>
        <div className="row">
          {active.length > 0 && <Pill tone={done === active.length ? 'good' : 'brand'}>{done} / {active.length} bajarildi</Pill>}
          {!adding && <button className="btn primary" onClick={() => setAdding(true)}>+ O‘zim vazifa qo‘shish</button>}
        </div>
      </div>
      {adding && <AddOwn s={s} emp={emp} onDone={() => setAdding(false)} />}
      {pending > 0 && <div className="callout small">Oxirgi baholash natijasiga ko‘ra {pending} ta yangi vazifa tayyorlanmoqda. HR mentor va muddatni belgilagach shu yerda paydo bo‘ladi.</div>}
      {sorted.length ? <div className="stack" style={{ gap: 14 }}>{sorted.map((x) => <Item key={x.id} x={x} s={s} emp={emp} />)}</div>
        : !pending && !adding && <Panel><Empty icon="route">Hozircha rivojlanish vazifasi yo‘q. Baholash natijasi e’lon qilingach, kamchilik bo‘lgan kompetensiyalar bo‘yicha reja shu yerda chiqadi — yoki o‘zingiz vazifa qo‘shing.</Empty></Panel>}
    </>
  );
}
