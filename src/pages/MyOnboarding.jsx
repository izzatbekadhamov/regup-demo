import { useAppState } from '../state/store.js';
import { Panel, Pill, Empty, fmtDate } from '../ui/common.jsx';
import * as D from '../core/domain.js';
import { OnbScore, OnbStages } from './Onboarding.jsx';

const num = (v) => (v === null || v === undefined ? '—' : String(v).replace('.', ','));

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
            <div className="row"><h1>Moslashuv dasturim</h1>{ob.reboarding && <Pill tone="brand">Reboarding</Pill>}{ob.status === 'completed' && <Pill tone="good">yakunlangan</Pill>}</div>
            <p className="ink2">Adaptatsiya 60 kun davom etadi. Moslashuv dasturi {days} kun: lavozimingizga mos kurslar, test va amaliy topshiriqlar{r.needObs ? ', metodistning dars kuzatuvi' : ''} va CEO/HRD bilan uchrashuv. Oxirida 1–5 ballik baho chiqadi va uni filial rahbari tasdiqlaydi. Mentoringiz: <b>{mentor?.name || '—'}</b>{buddy && <> · buddy: <b>{buddy.name}</b></>}. 60-kunda kompetensiya kartasi bo‘yicha birinchi lavozim darajangiz e’lon qilinadi.</p>
          </div>
          <div style={{ minWidth: 170 }}>{ob.status === 'active' ? <OnbStages day={day} days={days} /> : <div className="small">Yakunlangan: {fmtDate(ob.final?.at)}</div>}</div>
        </div>
        {ob.final?.badge && <div className="badge-earned">🏅 <div><b>«Moslashuv yakunlandi»</b><div className="small">{num(ob.final.score)} / 5 ball — {ob.final.label}. Tasdiqladi: {ob.final.by}.</div></div></div>}
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
                    {enr.status === 'completed' ? `Yakunlangan ${fmtDate(enr.completedAt)}` : `${doneN}/${c.components.length} bajarildi · muddat ${fmtDate(enr.deadline)}${enr.deadline < s.today ? ' — muddat o‘tdi' : ''}`}
                  </Step>
                );
              })}
              {r.needObs > 0 && <Step ok={obs.length >= r.needObs} title={`Dars kuzatuvi — ${obs.length} / ${r.needObs}`}>{obs.length ? obs.map((o) => `${fmtDate(o.date)}: ${num(Math.round(D.obsMean(o) * 10) / 10)} ball — ${o.note}`).join(' · ') : 'Metodist darsingizni kuzatadi, sanani oldindan aytadi.'}</Step>}
              <Step ok={mt?.attended.includes(emp.id)} title="CEO va HRD bilan uchrashuv">
                {mt ? (mt.attended.includes(emp.id) ? `Qatnashdingiz (${fmtDate(mt.date)})` : mt.date >= s.today ? <>«{mt.title}» — {fmtDate(mt.date)}, {mt.time}. {mt.format === 'online' ? <span className="code">{mt.link}</span> : mt.place}</> : 'Uchrashuvda qatnashilmagan — HR keyingisiga taklif qiladi') : 'Bir oy ishlagandan keyin HR taklif yuboradi.'}
              </Step>
              <Step ok={day >= 60} title="So‘rovnomalar — D8, D30, D60 (anonim)">Telegram bot orqali {fmtDate(D.addDays(ob.startedAt, 7))}, {fmtDate(D.addDays(ob.startedAt, 30))} va {fmtDate(D.addDays(ob.startedAt, 60))} da keladi. Javoblaringiz anonim: ism so‘ralmaydi, natija faqat filial bo‘yicha ko‘rinadi.</Step>
              <Step ok={ob.status === 'completed'} title="Yakuniy baho">{ob.final ? `${num(ob.final.score)} / 5 — ${ob.final.label}` : `${days} kunlik dastur yakunida ${head ? `filial rahbari (${head.name})` : 'HR'} tasdiqlaydi.`}</Step>
            </div>
          </Panel>
        </div>
        <div className="stack sticky">
          <Panel title="Natijam — izohlari bilan">
            <div className="stack">
              <OnbScore v={ob.final?.score ?? r.score} big />
              <table className="small"><tbody>{r.parts.map((p) => <tr key={p.key}><td>{p.label}<div className="muted">{p.hint}</div></td><td className="num"><b>{num(p.value)}</b></td></tr>)}</tbody></table>
              <div className="small muted">Bu onboarding bahosi — kompetensiya darajasi ham, lavozim darajasi ham emas. Badge: barcha kurslar{r.needObs ? `, ${r.needObs} ta kuzatuv` : ''} va ball ≥ {num(s.onboardingConfig.badgeMin)}.</div>
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
