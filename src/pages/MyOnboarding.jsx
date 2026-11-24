import { useState } from 'react';
import { useAppState, run } from '../state/store.js';
import { Panel, Pill, Empty, fmtDate } from '../ui/common.jsx';
import * as D from '../core/domain.js';
import { OnbScore, OnbStages } from './Onboarding.jsx';

const num = (v) => (v === null || v === undefined ? '—' : String(v).replace('.', ','));

/** O'z-o'zini baholash (qaror №60): baholovchiga ko'rinadi, daraja hisobiga va «2 manba» qoidasiga kirmaydi. */
function SelfAssess({ s, emp }) {
  const card = D.onboardingCardOf(s, emp.id);
  const [code, setCode] = useState('');
  const [lv, setLv] = useState('');
  const [note, setNote] = useState('');
  if (!card || card.stage === 'published') return null;
  const model = D.getModel(s, card.modelVersionId);
  const max = model.scale?.max || 5;
  const comps = model.competencies.filter((c) => !c.composite);
  return (
    <Panel title="Kompetensiyalar bo‘yicha o‘zimni baholash">
      <div className="small muted">Baholovchi sizning bahoingizni ko‘radi va suhbatda foydalanadi. U lavozim darajasi hisobiga kirmaydi.</div>
      <div className="row" style={{ gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
        <select className="i compact" value={code} onChange={(e) => setCode(e.target.value)}><option value="">Kompetensiya…</option>{comps.map((c) => <option key={c.code} value={c.code}>{c.code} {c.name}</option>)}</select>
        <select className="i compact" value={lv} onChange={(e) => setLv(e.target.value)}><option value="">Daraja</option>{Array.from({ length: max }, (_, i) => i + 1).map((v) => <option key={v} value={v}>{v}</option>)}</select>
        <input className="i compact" placeholder="Izoh (ixtiyoriy)" value={note} onChange={(e) => setNote(e.target.value)} />
        <button className="btn sm primary" disabled={!code || !lv} onClick={() => run(D.setSelfScore, { cardId: card.id, employeeId: emp.id, code, level: Number(lv), note }, 'Saqlandi') && setNote('')}>Saqlash</button>
      </div>
      {Object.keys(card.selfScores || {}).length > 0 && <div className="small" style={{ marginTop: 6 }}>Mening baholarim: {Object.entries(card.selfScores).map(([k, v]) => `${k} — ${v.level}`).join(', ')}</div>}
    </Panel>
  );
}

function Step({ ok, title, children }) {
  return (
    <div className={`onb-step ${ok ? 'ok' : ''}`}>
      <span className="pt-n">{ok ? '✓' : '○'}</span>
      <div style={{ flex: 1 }}><b>{title}</b><div className="small ink2">{children}</div></div>
    </div>
  );
}

export default function MyOnboarding({ emp }) {
  const s = useAppState();
  const ob = D.onboardingOf(s, emp.id);
  if (!ob) return <Empty>Moslashuv dasturi yo‘q.</Empty>;
  const r = D.onboardingScore(s, ob);
  const day = D.onbDay(s, ob);
  const mt = D.ceoMeetingOf(s, emp.id);
  const obs = D.onbObservations(s, ob);
  const kpiFrom = D.addDays(ob.startedAt, D.ONB_DAYS);
  const mentor = emp.supervisorId ? D.getEmployee(s, emp.supervisorId) : null;
  const buddy = emp.buddyId ? D.getEmployee(s, emp.buddyId) : null;
  const days = D.obDays(s, ob);
  const head = D.branchHead(s, emp.branchId);
  return (
    <>
      <section className="panel hero compact-hero">
        <div className="row between">
          <div>
            <div className="row"><h1>Moslashuv dasturim</h1>{ob.reboarding && <Pill tone="brand">Reboarding</Pill>}{ob.status === 'completed' && <Pill tone="good">yakunlangan</Pill>}{ob.status === 'active' && ob.extension && <Pill tone="warn">uzaytirilgan</Pill>}</div>
            <p className="ink2">Adaptatsiya 60 kun davom etadi. Moslashuv dasturi {days} kun: lavozimingizga mos kurslar, test va amaliy topshiriqlar{r.needObs ? ', metodistning dars kuzatuvi' : ''} va CEO/HRD bilan uchrashuv. Oxirida onboarding natijasi (1–5) chiqadi va uni filial rahbari tasdiqlaydi. Mentoringiz: <b>{mentor?.name || '—'}</b>{buddy && <> · buddy: <b>{buddy.name}</b></>}. 60-kunda kompetensiya kartasi bo‘yicha birinchi lavozim darajangiz e’lon qilinadi.</p>
          </div>
          <div style={{ minWidth: 170 }}>{ob.status === 'active' ? <OnbStages day={day} days={days} /> : <div className="small">Yakunlangan: {fmtDate(ob.final?.at)}</div>}</div>
        </div>
        {ob.final?.passed && <div className="callout good"><b>Onboarding muvaffaqiyatli yakunlandi</b><div className="small">Natija {num(ob.final.score)} / 5 — {ob.final.label}. Barcha qismlar minimumdan o‘tdi. Tasdiqladi: {ob.final.by}.</div></div>}
        {ob.status === 'active' && ob.extension && <div className="callout warn small"><b>Onboarding {fmtDate(ob.extension.until)} gacha uzaytirildi.</b> Qayta baholanadigan qism: {ob.extension.parts.map((k) => D.ONB_PARTS[k][0]).join(', ')}. Mentor rejasi: {ob.extension.plan}{Object.keys(ob.extension.regrades || {}).length > 0 && <> · Qayta baholangan: {Object.entries(ob.extension.regrades).map(([k, v]) => `${D.ONB_PARTS[k][0]} — ${v.grade} / 5`).join(', ')}</>}</div>}
        {ob.restored?.length > 0 && <div className="callout small"><b>Qaytganingiz bilan!</b> {ob.restored.map((x) => x.text).join('; ')}.</div>}
      </section>
      <div className="split">
        <div className="stack">
          <Panel title="Qadamlar">
            <div className="stack">
              {D.onbEnrollments(s, ob).map((enr) => {
                const c = D.getCourse(s, enr.courseId);
                const doneN = c.components.filter((x) => D.componentDone(c, enr, x.id)).length;
                return (
                  <Step key={enr.id} ok={enr.status === 'completed'} title={<a href={`#/learn/${enr.id}`}>{c.title}</a>}>
                    {enr.status === 'completed' ? `Yakunlangan ${fmtDate(enr.completedAt)} · kurs bahosi ${num(D.courseGrade(c, enr))}` : enr.awaitingFeedback ? 'Kontent bajarildi — kursni yakunlash uchun 2 ta savolga javob bering (qoniqish bahosi va NPS)' : `Kurslar bajarilishi ${Math.round((100 * doneN) / c.components.length)}% (${doneN}/${c.components.length})${D.courseGrade(c, enr) !== null ? ` · kurs bahosi ${num(D.courseGrade(c, enr))}` : ''} · muddat ${fmtDate(enr.deadline)}${enr.deadline < s.today ? ' — muddat o‘tdi' : ''}`}
                  </Step>
                );
              })}
              {r.card.tasks.map((t) => { const g = ob.taskGrades?.[t.id]; return <Step key={t.id} ok={!!g} title={`Amaliy topshiriq: ${t.name}`}>{g ? `${g.grade} / 5 — ${g.by}${g.note ? `: ${g.note}` : ''}` : 'Mentoringiz topshiriqni beradi va 1–5 baholaydi.'}</Step>; })}
              {r.card.practice === 'work' && r.need > 0 && <Step ok={r.checks >= r.need} title={`Ish amaliyotidagi kuzatuv — ${r.checks} / ${r.need}`}>{D.onbWorkChecks(s, ob).map((w) => `${fmtDate(w.date)}: ${num(Math.round(D.obsMean(w) * 10) / 10)} — ${w.by}`).join(' · ') || `Filial rahbari ish ko‘rsatkichlaringizni baholaydi: ${r.card.indicators.join(', ')}.`}</Step>}
              {r.needObs > 0 && <Step ok={obs.length >= r.needObs} title={`Dars kuzatuvi — ${obs.length} / ${r.needObs}`}>{obs.length ? obs.map((o) => `${fmtDate(o.date)}: ${num(Math.round(D.obsMean(o) * 10) / 10)} ball — ${o.note}`).join(' · ') : 'Metodist darsingizni kuzatadi, sanani oldindan aytadi.'}</Step>}
              <Step ok={mt?.attended.includes(emp.id)} title="CEO va HRD bilan uchrashuv">
                {mt ? (mt.attended.includes(emp.id) ? `Qatnashdingiz (${fmtDate(mt.date)})` : mt.date >= s.today ? <>«{mt.title}» — {fmtDate(mt.date)}, {mt.time}. {mt.format === 'online' ? <span className="code">{mt.link}</span> : mt.place}</> : 'Uchrashuvda qatnashilmagan — HR keyingisiga taklif qiladi') : 'Bir oy ishlagandan keyin HR taklif yuboradi.'}
              </Step>
              <Step ok={day >= 60} title="So‘rovnomalar — D8, D30, D60">Siz D8 va D30 bosqichiga o‘tganingizda va 60-kunda Telegram bot va platformada keladi (<a href="#/surveys">So‘rovnomalarim</a>). Har so‘rovnomada javoblaringiz anonimmi yoki HR’ga ismingiz bilan ko‘rinishi oldindan yoziladi.</Step>
              <Step ok={ob.status === 'completed'} title="Onboarding natijasi">{ob.final ? `${num(ob.final.score)} / 5 — ${ob.final.label}${ob.final.passed ? ', muvaffaqiyatli yakunlandi' : ''}` : `${days} kunlik dastur yakunida ${head ? `filial rahbari (${head.name})` : 'HR'} tasdiqlaydi.`}</Step>
            </div>
          </Panel>
          <SelfAssess s={s} emp={emp} />
        </div>
        <div className="stack sticky">
          <Panel title="Onboarding natijam — izohlari bilan">
            <div className="stack">
              <OnbScore v={ob.final?.score ?? r.score} big />
              <table className="small"><tbody>{r.parts.map((p) => <tr key={p.key}><td>{p.label}<div className="muted">{p.hint}</div></td><td className="num"><b>{num(p.value)}</b></td><td className="num">{p.value === null ? '' : p.ok ? <Pill tone="good">≥ {r.min}</Pill> : <Pill tone="bad">&lt; {r.min}</Pill>}</td></tr>)}</tbody></table>
              <div className="small muted">Umumiy natija — qismlar o‘rtachasi. Har bir qism kamida {r.min} bo‘lsa, onboarding muvaffaqiyatli yakunlanadi. Bu onboarding natijasi — kompetensiya darajasi ham, lavozim darajasi ham emas.</div>
            </div>
          </Panel>
          <Panel title="KPI">
            {day < D.ONB_DAYS && ob.status === 'active'
              ? <div><Pill tone="muted">O‘lchanmagan</Pill><div className="small ink2" style={{ marginTop: 6 }}>Birinchi 30 kunda KPI hisoblanmaydi. {fmtDate(kpiFrom)} dan keyin Edu tizimidan olinadi va shu yerda ko‘rinadi.</div></div>
              : <div className="small">30 kun o‘tdi — KPI Edu’dan olinadi.{emp.position === 'GE' && <> <a href="#/kpi">KPI ko‘rsatkichlari</a></>}</div>}
          </Panel>
        </div>
      </div>
    </>
  );
}
