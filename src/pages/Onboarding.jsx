import { Fragment, useState } from 'react';
import { useAppState, run } from '../state/store.js';
import { Panel, Pill, Stat, Person, Empty, fmtDate } from '../ui/common.jsx';
import * as D from '../core/domain.js';
import { positionName } from '../core/modelKit.js';

const num = (v) => (v === null || v === undefined ? '—' : String(v).replace('.', ','));

/** Onboarding natijasi — kompetensiya darajasidan farqli ko'rinish: «4,2 / 5» (K1). */
export function OnbScore({ v, big }) {
  const tone = v === null ? 'muted' : v >= 4.5 ? 'good' : v >= 3.5 ? 'teal' : v >= 2.5 ? 'warn' : 'bad';
  return (
    <span className={`onb-score ${tone} ${big ? 'big' : ''}`} title="Onboarding natijasi (1–5). Kompetensiya darajasi emas.">
      <b>{num(v)}</b><small> / 5 ball</small>{big && v !== null && <em>{D.ONB_LABEL(v)}</em>}
    </span>
  );
}

export function OnbStages({ day, days = D.ONB_DAYS }) {
  const st = D.onbStage(day);
  const idx = D.ONB_STAGES.findIndex(([k]) => k === st);
  return (
    <div>
      <div className="stage-track" title="Jobster ATS bosqichlari: Induction → D8 → D30 → D60">
        {D.ONB_STAGES.map(([k], i) => <i key={k} className={i < idx ? 'done' : i === idx ? 'cur' : ''} />)}
      </div>
      <div className="small" style={{ marginTop: 4 }}><b>{Math.min(day, 99)}</b> / {D.ADAPT_DAYS} kun · {D.adaptPhase(day)[1]} · dastur {days} kun</div>
    </div>
  );
}

export function OnbTags({ s, ob }) {
  const late = D.onbLateDays(ob);
  return (
    <span className="row" style={{ gap: 4, marginTop: 4 }}>
      {ob.reboarding && <span className="pill brand">Reboarding</span>}
      {late >= s.onboardingConfig.lateDays && <span className="pill warn">Kech kiritildi: {late} kun</span>}
      {ob.source === 'branch' && <span className="pill muted">Filial o‘zi olgan</span>}
      {ob.final?.passed && <span className="pill good">Muvaffaqiyatli yakunlandi</span>}
    </span>
  );
}

function reviewerText(s, enr) {
  const r = D.taskReviewer(s, enr);
  return r.kind === 'curator' ? `kurator ${r.user.name}` : r.kind === 'mentor' ? `mentor ${r.user.name}` : 'HR';
}

const progressText = (r) => [`kurslar ${r.coursesDone}/${r.courses}`, r.card.tasks.length ? `topshiriqlar ${r.tasksDone}/${r.card.tasks.length}` : null, r.need ? `${r.card.practice === 'lesson' ? 'dars kuzatuvi' : 'ish kuzatuvi'} ${r.checks}/${r.need}` : null].filter(Boolean).join(', ');

/** Kursdan tashqari amaliy topshiriqlar: mentor yoki mas'ul shaxs 1–5 baholaydi. */
function OnbTasks({ s, ob, r, user }) {
  const emp = D.getEmployee(s, ob.employeeId);
  const can = ob.status === 'active' && D.canAny(user, ['onb.assign', 'onb.approve']) && D.inScope(s, user, emp);
  const [g, setG] = useState({});
  return (
    <>
      <h3>Amaliy topshiriqlar (kursdan tashqari) — {r.tasksDone} / {r.card.tasks.length}</h3>
      {r.card.tasks.map((t) => {
        const done = ob.taskGrades?.[t.id];
        return (
          <div key={t.id} className="onb-course">
            <div className="row between"><b>{t.name}</b>{done ? <Pill tone="good">{done.grade} / 5 · {done.by}</Pill> : <Pill tone="muted">baholanmagan</Pill>}</div>
            {done?.note && <div className="small ink2">{done.note}</div>}
            {can && (
              <div className="row" style={{ gap: 6, marginTop: 6 }}>
                <select className="i compact" value={g[t.id] || ''} onChange={(e) => setG({ ...g, [t.id]: e.target.value })}><option value="">baho</option>{[5, 4, 3, 2, 1].map((x) => <option key={x} value={x}>{x}</option>)}</select>
                <button className="btn sm" disabled={!g[t.id]} onClick={() => run(D.gradeOnbTask, { onboardingId: ob.id, taskId: t.id, grade: g[t.id], userId: user.id }, 'Topshiriq baholandi')}>{done ? 'Qayta baholash' : 'Baholash'}</button>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

/** Menejerlar uchun ish amaliyotidagi kuzatuv: lavozim kartasidagi ko'rsatkichlar. */
function WorkChecks({ s, ob, emp, r, user }) {
  const list = D.onbWorkChecks(s, ob);
  const can = ob.status === 'active' && D.canAny(user, ['onb.observe', 'onb.approve']) && D.inScope(s, user, emp);
  const [f, setF] = useState({});
  const [note, setNote] = useState('');
  return (
    <>
      <h3>Ish amaliyotidagi kuzatuv — {list.length} / {r.need}</h3>
      {list.map((w) => <div key={w.id} className="obs-card small"><div className="row between"><b>{fmtDate(w.date)}</b><span className="muted">{w.by}</span></div><div style={{ marginTop: 4 }}>{Object.entries(w.ratings).map(([k, v]) => `${k}: ${v}`).join(' · ')} · o‘rtacha <b>{num(Math.round(D.obsMean(w) * 10) / 10)}</b>{w.note ? ` — ${w.note}` : ''}</div></div>)}
      {!list.length && <div className="muted small">Hali kuzatuv yo‘q — filial rahbari ish ko‘rsatkichlarini 1–5 baholaydi.</div>}
      {can && (
        <div className="panel add-box">
          <b className="small">Ish kuzatuvini kiritish</b>
          <div className="stack" style={{ gap: 6, marginTop: 6 }}>
            {r.card.indicators.map((k) => <label key={k} className="row between small">{k}<select className="i compact" value={f[k] || ''} onChange={(e) => setF({ ...f, [k]: e.target.value })}><option value="">—</option>{[5, 4, 3, 2, 1].map((x) => <option key={x} value={x}>{x}</option>)}</select></label>)}
            <input className="i compact" placeholder="Izoh (ixtiyoriy)" value={note} onChange={(e) => setNote(e.target.value)} />
            <button className="btn sm" disabled={r.card.indicators.some((k) => !f[k])} onClick={() => run(D.addWorkCheck, { employeeId: emp.id, ratings: f, note, userId: user.id }, 'Kuzatuv saqlandi') && (setF({}), setNote(''))}>Saqlash</button>
          </div>
        </div>
      )}
    </>
  );
}

/** Kurslar, kuzatuv, uchrashuv, so'rovnoma va ball tarkibi. */
export function OnbDetail({ s, ob, user }) {
  const emp = D.getEmployee(s, ob.employeeId);
  const r = D.onboardingScore(s, ob);
  const obs = D.onbObservations(s, ob);
  const mt = D.ceoMeetingOf(s, emp.id);
  const day = D.onbDay(s, ob);
  const head = D.branchHead(s, emp.branchId);
  const canApprove = ob.status === 'active' && D.can(user, 'onb.approve') && D.inScope(s, user, emp);
  const mentor = emp.supervisorId ? D.getEmployee(s, emp.supervisorId) : null;
  const buddy = emp.buddyId ? D.getEmployee(s, emp.buddyId) : null;
  const days = D.obDays(s, ob);
  return (
    <div className="onb-detail">
      <div className="grid g2">
        <div className="stack">
          <h3>Kurslar</h3>
          {D.onbEnrollments(s, ob).map((enr) => {
            const c = D.getCourse(s, enr.courseId);
            const t = c.components.find((x) => x.kind === 'test');
            const a = c.components.find((x) => x.kind === 'task');
            const tp = t && enr.progress[t.id];
            const ap = a && enr.progress[a.id];
            const doneN = c.components.filter((x) => D.componentDone(c, enr, x.id)).length;
            const late = enr.status !== 'completed' && enr.deadline < s.today;
            return (
              <div key={enr.id} className="onb-course">
                <div className="row between"><b>{c.title} <span className="tag">v{enr.courseVersion || 1}</span></b>
                  {enr.status === 'completed' ? <Pill tone="good">yakunlangan {fmtDate(enr.completedAt)}</Pill> : <Pill tone={late ? 'bad' : 'brand'}>{doneN}/{c.components.length} · muddat {fmtDate(enr.deadline)}</Pill>}
                </div>
                <div className="small ink2">
                  {t && <>Test: {typeof tp?.best === 'number' ? `${tp.best}% → ${D.testBall(tp.best)} ball` : 'topshirilmagan'}</>}
                  {a && <> · Topshiriq: {ap?.status === 'accepted' ? `${ap.mentor.grade} ball (${ap.mentor.by})` : ap?.status === 'pending' ? `tekshiruvda — ${reviewerText(s, enr)}` : ap?.status === 'returned' ? 'qaytarilgan' : 'yuborilmagan'}</>}
                  {' · '}Kurs bahosi: <b>{num(D.courseGrade(c, enr))}</b>
                </div>
              </div>
            );
          })}
          {r.card.tasks.length > 0 && <OnbTasks s={s} ob={ob} r={r} user={user} />}
          {r.card.practice === 'work' && r.need > 0 && <WorkChecks s={s} ob={ob} emp={emp} r={r} user={user} />}
          {ob.restored?.length > 0 && <div className="callout small"><b>Reboarding:</b> {ob.restored.map((x) => x.text).join('; ')}.</div>}
          {r.needObs > 0 && (
            <>
              <h3>Dars kuzatuvi — {obs.length} / {r.needObs}</h3>
              {obs.length ? obs.map((o) => (
                <div key={o.id} className="obs-card small">
                  <div className="row between"><b>{o.lesson}</b><span className="muted">{fmtDate(o.date)} · {o.methodist}</span></div>
                  <div style={{ marginTop: 4 }}>O‘rtacha <b>{num(Math.round(D.obsMean(o) * 10) / 10)}</b> / 5 · {o.note}</div>
                </div>
              )) : <div className="muted small">Hali kuzatuv yo‘q — metodist kamida {r.needObs} marta kuzatadi.</div>}
            </>
          )}
        </div>
        <div className="stack">
          <h3>Onboarding natijasi</h3>
          <div className="row" style={{ gap: 14 }}><OnbScore v={ob.final?.score ?? r.score} big />{ob.final ? <span className="small">Tasdiqladi: {ob.final.by} ({ob.final.byRole}), {fmtDate(ob.final.at)}</span> : <span className="small muted">Taxminiy — yakuniy bahoni filial rahbari tasdiqlaydi</span>}</div>
          <table className="small">
            <tbody>
              {r.parts.map((p) => <tr key={p.key}><td>{p.label}<div className="muted">{p.hint}</div></td><td className="num"><b>{num(p.value)}</b></td><td className="num">{p.value === null ? <span className="muted">—</span> : p.ok ? <Pill tone="good">≥ {r.min}</Pill> : <Pill tone="bad">&lt; {r.min}</Pill>}</td></tr>)}
            </tbody>
          </table>
          <div className="small ink2">
            <div>Kompetensiya kartasi: {D.onboardingCardOf(s, emp.id) ? <><a href={`#/cards/${D.onboardingCardOf(s, emp.id).id}`}>{D.onboardingCardOf(s, emp.id).id}</a> — rekrutingdan boshlangan, baholar shartli; birinchi lavozim darajasi {fmtDate(D.addDays(ob.startedAt, D.ADAPT_DAYS))} gacha</> : D.positionModel(s, emp.position) ? 'ochilmagan' : <span className="muted">bu lavozim uchun kompetensiya modeli hali ishlab chiqilmagan — kurslar va topshiriqlar ishlaydi, karta model tayyor bo‘lgach qo‘shiladi</span>}</div>
            <div>So‘rovnomalar anonim — natija faqat filial va lavozim kesimida, onboarding dashboard’da.</div>
            <div>CEO va HRD bilan uchrashuv: {mt ? (mt.attended.includes(emp.id) ? <b style={{ color: 'var(--good)' }}>qatnashdi ({fmtDate(mt.date)})</b> : mt.date >= s.today ? `taklif qilingan (${fmtDate(mt.date)})` : 'qatnashmadi') : 'hali taklif qilinmagan'}</div>
            <div>Mentor: {mentor?.name || '—'} · Buddy: {buddy?.name || '—'} · Filial rahbari: {head?.name || 'vakant — HR tasdiqlaydi'} · Ish boshlagan {fmtDate(ob.startedAt)}, tizimga kiritilgan {fmtDate(ob.enteredAt)}</div>
          </div>
          <div className="small muted">Umumiy natija — qismlar o‘rtachasi. Har bir qism kamida {r.min} bo‘lishi shart; hammasi o‘tsa, onboarding muvaffaqiyatli yakunlanadi (bu holat, badge emas).</div>
          {ob.status === 'active' && (
            <div className={`callout small ${r.ready ? (r.passed ? 'good' : 'warn') : day >= days ? 'warn' : ''}`}>
              {r.ready ? (r.passed ? `Dastur bajarildi, barcha qismlar minimumdan (${r.min}) o‘tdi.` : `Dastur bajarildi, lekin minimumdan o‘tmagan qism bor: ${r.parts.filter((p) => !p.ok).map((p) => p.label).join(', ')}.`)
                : day >= days ? `${days} kunlik dastur muddati o‘tdi, to‘liq bajarilmagan (${progressText(r)}).`
                  : `Dastur tugashiga ${days - day} kun qoldi: ${progressText(r)}.`}
            </div>
          )}
          {canApprove && (r.ready || day >= days) && <div><button className="btn primary" onClick={() => run(D.approveOnboarding, { id: ob.id, userId: user.id }, 'Onboarding natijasi tasdiqlandi')}>Onboarding natijasini tasdiqlash</button> <span className="small muted">Kuzatuv ballari kompetensiya profiliga ish dalili sifatida yoziladi.</span></div>}
          {ob.final && <div className={`callout small ${ob.final.passed ? 'good' : 'warn'}`}>{ob.final.passed ? 'Onboarding muvaffaqiyatli yakunlandi: barcha qismlar minimumdan o‘tgan.' : 'Minimumdan o‘tmagan qism bor — mentor bilan rivojlanish rejasi tuziladi.'} 30 kundan keyin KPI Edu’dan olinadi; 60-kunda kompetensiya kartasi bo‘yicha birinchi lavozim darajasi beriladi.</div>}
          {D.can(user, 'onb.assign') && ob.status === 'active' && <AssignPeople s={s} emp={emp} user={user} />}
          {user?.role === 'mentor' && ob.status === 'active' && <AssignCourse s={s} emp={emp} user={user} />}
        </div>
      </div>
    </div>
  );
}

function AssignPeople({ s, emp, user }) {
  const pool = D.activeEmployees(s).filter((e) => e.id !== emp.id && e.branchId === emp.branchId && !s.onboardings.some((o) => o.employeeId === e.id && o.status === 'active'));
  const [f, setF] = useState({ mentorId: emp.supervisorId || '', buddyId: emp.buddyId || '' });
  return (
    <div className="panel add-box">
      <b className="small">Mentor va buddy</b>
      <div className="row" style={{ marginTop: 6 }}>
        <label className="f small">Mentor<select className="i compact" value={f.mentorId} onChange={(e) => setF({ ...f, mentorId: e.target.value })}><option value="">— biriktirilmagan —</option>{[...new Set([emp.supervisorId, ...pool.map((e) => e.id)])].filter(Boolean).map((id) => <option key={id} value={id}>{D.getEmployee(s, id)?.name}</option>)}</select></label>
        <label className="f small">Buddy<select className="i compact" value={f.buddyId} onChange={(e) => setF({ ...f, buddyId: e.target.value })}><option value="">— biriktirilmagan —</option>{pool.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select></label>
        <button className="btn sm" onClick={() => run(D.assignMentorBuddy, { employeeId: emp.id, mentorId: f.mentorId || null, buddyId: f.buddyId || null, userId: user.id }, 'Saqlandi')}>Saqlash</button>
      </div>
      <div className="small muted" style={{ marginTop: 4 }}>Buddy — norasmiy qo‘llab-quvvatlovchi «do‘st», mentordan alohida. Ro‘yxatda shu filial xodimlari.</div>
    </div>
  );
}

function AssignCourse({ s, emp, user }) {
  const [f, setF] = useState({ courseId: '', deadline: D.addDays(s.today, 21) });
  const list = s.courses.filter((c) => c.status === 'active' && !c.onboarding && !s.enrollments.some((e) => e.employeeId === emp.id && e.courseId === c.id && e.status === 'in_progress'));
  return (
    <div className="panel add-box">
      <b className="small">Qo‘shimcha kurs biriktirish (mentor)</b>
      <div className="row" style={{ marginTop: 6 }}>
        <select className="i compact" style={{ flex: 1, minWidth: 200 }} value={f.courseId} onChange={(e) => setF({ ...f, courseId: e.target.value })}><option value="">— kurs —</option>{list.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select>
        <input className="i compact" type="date" value={f.deadline} onChange={(e) => setF({ ...f, deadline: e.target.value })} />
        <button className="btn sm" disabled={!f.courseId} onClick={() => run(D.enrollCourse, { employeeId: emp.id, courseId: f.courseId, by: 'mentor', deadline: f.deadline, actor: `mentor ${user.name}` }, 'Kurs biriktirildi') && setF({ ...f, courseId: '' })}>Biriktirish</button>
      </div>
      <div className="small muted" style={{ marginTop: 4 }}>Mentor kurs yarata yoki tahrirlay olmaydi — faqat mavjud kursni o‘z xodimiga biriktiradi.</div>
    </div>
  );
}

function ProgDays({ p }) {
  const [d, setD] = useState(p.days || D.ONB_DAYS);
  return <label className="f small">{p.position}<span className="row" style={{ gap: 4 }}><input className="i compact" style={{ width: 64 }} type="number" value={d} onChange={(e) => setD(e.target.value)} /><button className="btn sm" disabled={Number(d) === (p.days || D.ONB_DAYS)} onClick={() => run(D.setProgramDays, { position: p.position, days: d }, 'Muddat saqlandi')}>OK</button></span></label>;
}

function CardConfig({ s, p }) {
  const c = D.onbCard(p);
  const [f, setF] = useState({ onTime: c.onTime, min: c.min, practice: c.practice, checks: c.practice === 'work' ? c.need : 1, observations: p.observations || 2, indicators: c.indicators.join('\n'), tasks: c.tasks });
  const save = () => run(D.setOnbCard, { position: p.position, patch: { onTime: f.onTime, min: f.min, practice: f.practice, checks: Number(f.checks), observations: f.observations, indicators: f.indicators.split('\n'), tasks: f.tasks } }, 'Karta saqlandi');
  return (
    <div className="onb-course">
      <div className="row between"><b>{p.position === 'GE' ? 'Ustoz (GE)' : p.position === 'FIN' ? 'Moliya menejeri' : p.position === 'FR' ? 'Filial rahbari' : p.position === 'ADM' ? 'Markaz admini' : p.position}</b><ProgDays p={p} /></div>
      <div className="row small" style={{ gap: 14, flexWrap: 'wrap', marginTop: 6 }}>
        <label className="row" style={{ gap: 4 }}><input type="checkbox" checked={f.onTime} onChange={(e) => setF({ ...f, onTime: e.target.checked })} /> Kursni muddatida yakunlash</label>
        <span>Kurs bahosi — doim</span>
        <label className="row" style={{ gap: 4 }}>Kuzatuv<select className="i compact" value={f.practice} onChange={(e) => setF({ ...f, practice: e.target.value })}>{Object.entries(D.PRACTICE_KIND).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        {f.practice === 'lesson'
          ? <label className="row" style={{ gap: 4 }}>soni<input className="i compact" style={{ width: 56 }} type="number" value={f.observations} onChange={(e) => setF({ ...f, observations: e.target.value })} /></label>
          : <label className="row" style={{ gap: 4 }}>soni<input className="i compact" style={{ width: 56 }} type="number" value={f.checks} onChange={(e) => setF({ ...f, checks: e.target.value })} /></label>}
        <label className="row" style={{ gap: 4 }}>Har qism minimumi<input className="i compact" style={{ width: 56 }} type="number" step="0.5" value={f.min} onChange={(e) => setF({ ...f, min: e.target.value })} /></label>
      </div>
      <div className="grid g2" style={{ marginTop: 6 }}>
        <div>
          <div className="small muted">Kursdan tashqari amaliy topshiriqlar</div>
          {f.tasks.map((t, i) => <div key={t.id} className="row" style={{ gap: 4, marginTop: 4 }}><input className="i compact" style={{ flex: 1 }} value={t.name} onChange={(e) => setF({ ...f, tasks: f.tasks.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} /><button className="btn sm" onClick={() => setF({ ...f, tasks: f.tasks.filter((_, j) => j !== i) })}>×</button></div>)}
          <button className="link-btn small" onClick={() => setF({ ...f, tasks: [...f.tasks, { id: `t${Date.now().toString(36)}`, name: '' }] })}>+ topshiriq qo‘shish</button>
        </div>
        {f.practice === 'work' && <label className="f small">Ish ko‘rsatkichlari (har qatorda bittasi)<textarea className="i" rows={3} value={f.indicators} onChange={(e) => setF({ ...f, indicators: e.target.value })} /></label>}
      </div>
      <button className="btn sm" style={{ marginTop: 6 }} onClick={save}>Saqlash</button>
    </div>
  );
}

function CardsConfig({ s }) {
  return (
    <Panel title={<div><h2>Onboarding natijasi kartasi — lavozimlar bo‘yicha</h2><div className="muted small">Umumiy natija = kiritilgan qismlarning o‘rtachasi (1–5). Har qism minimumdan o‘tsa — onboarding muvaffaqiyatli yakunlanadi. Bu badge emas: badge faqat noodatiy natija uchun.</div></div>}>
      <div className="stack">{s.onboardingPrograms.map((p) => <CardConfig key={p.position + JSON.stringify(p.card || {})} s={s} p={p} />)}</div>
    </Panel>
  );
}

export function StaffInbox({ s, user }) {
  const list = s.notifications.filter((n) => n.to === user.name).slice(0, 6);
  if (!list.length) return null;
  return (
    <Panel tight title={<div className="row"><h2>Sizga kelgan xabarlar</h2><span className="muted small">platforma + Telegram</span></div>}>
      <table><tbody>{list.map((n) => <tr key={n.id}><td className="small">{n.text}</td><td className="small muted" style={{ whiteSpace: 'nowrap' }}>{n.tg && <span className="tg-mark">TG</span>} {fmtDate(n.at)}</td></tr>)}</tbody></table>
    </Panel>
  );
}

export default function Onboarding({ user, focus }) {
  const s = useAppState();
  const scope = D.scopeEmployees(s, user);
  const manage = D.scopeEmployees(s, user) === null;
  const [f, setF] = useState({ branch: '', position: '', status: 'active', q: '' });
  const [open, setOpen] = useState(focus || null);
  const all = s.onboardings.filter((o) => !scope || scope.has(o.employeeId)).map((o) => ({ ob: o, emp: D.getEmployee(s, o.employeeId) }));
  const active = all.filter((x) => x.ob.status === 'active');
  const list = all.filter(({ ob, emp }) => (f.status === 'all' || ob.status === f.status) && (!f.branch || emp.branchId === f.branch) && (!f.position || emp.position === f.position) && (!f.q || emp.name.toLowerCase().includes(f.q.toLowerCase())))
    .sort((a, b) => (b.ob.startedAt > a.ob.startedAt ? 1 : -1));
  const ready = active.filter(({ ob }) => D.onboardingScore(s, ob).ready || D.onbDay(s, ob) >= D.obDays(s, ob)).length;
  const late = active.filter(({ ob }) => D.onbLateDays(ob) >= s.onboardingConfig.lateDays).length;
  const own = active.filter(({ ob }) => ob.source === 'branch').length;
  const passed = all.filter(({ ob }) => ob.final?.passed).length;
  const archived = s.employees.filter((e) => e.status === 'archived' && (!scope || scope.has(e.id)));
  const branches = [...new Set(all.map((x) => x.emp.branchId))];
  const positions = [...new Set(all.map((x) => x.emp.position))];
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Moslashuv — 60 kunlik adaptatsiya</h1>
          <p>Xodim Jobster’da Induction ustuniga o‘tganda EduTizim, keyin RegUP LMS kartasi avtomatik ochiladi va lavozimiga mos kurslar biriktiriladi. Adaptatsiya 60 kun: orientation (1–7) va functional onboarding (8–60). Moslashuv dasturi lavozim uchun belgilangan muddatda (standart 30 kun) tugaydi va onboarding natijasi (1–5) chiqadi. Birinchi 30 kunda KPI «O‘lchanmagan»; 60-kunda birinchi lavozim darajasi beriladi.</p>
          {!manage && <p className="small muted">{user.title}: faqat sizga biriktirilgan xodimlar ko‘rinadi.</p>}
        </div>
      </div>
      {manage && s.hrInbox.length > 0 && <div className="callout warn row between"><div><b>Integratsiya navbatida {s.hrInbox.length} ta hodisa</b> — yangi xodimlar, arxiv va qaytish signallari.</div><a className="btn primary" href="#/integration">Navbatni ochish</a></div>}
      <div className="grid g4">
        <Stat k="Moslashuvda" v={active.length} s={`${own} tasi filial o‘zi olgan`} icon="users" />
        <Stat k="Yakuniy bahoga tayyor" v={ready} s="dastur bajarilgan yoki muddati o‘tgan" icon="check" tone={ready ? 'warn' : ''} />
        <Stat k="Kech kiritilgan" v={late} s={`ish boshlaganidan ≥ ${s.onboardingConfig.lateDays} kun keyin`} icon="clock" tone={late ? 'bad' : ''} />
        <Stat k="Muvaffaqiyatli yakunlagan" v={passed} s="barcha qismlar minimumdan o‘tgan" icon="target" />
      </div>
      {!manage && <StaffInbox s={s} user={user} />}
      <Panel tight title={<div className="row"><h2>Xodimlar</h2><span className="muted small">qatorni bosing — kurslar, kuzatuv, ball tarkibi</span></div>} actions={
        <div className="row">
          <input className="i compact" placeholder="Ism" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} style={{ width: 120 }} />
          <select className="i compact" value={f.branch} onChange={(e) => setF({ ...f, branch: e.target.value })}><option value="">Barcha filiallar</option>{branches.map((b) => <option key={b} value={b}>{D.getBranch(s, b)?.name}</option>)}</select>
          <select className="i compact" value={f.position} onChange={(e) => setF({ ...f, position: e.target.value })}><option value="">Barcha lavozimlar</option>{positions.map((p) => <option key={p} value={p}>{p === 'GE' ? 'Ustoz (GE)' : p === 'FIN' ? 'Moliya menejeri' : p}</option>)}</select>
          <select className="i compact" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="active">Faol</option><option value="completed">Yakunlangan</option><option value="archived">To‘xtatilgan (arxiv)</option><option value="all">Hammasi</option></select>
        </div>
      }>
        {list.length ? (
          <table>
            <thead><tr><th>Xodim</th><th>Bosqich</th><th className="num">Kurslar</th><th className="num">Kuzatuv</th><th>CEO/HRD</th><th>Mentor / buddy</th><th className="num">Natija</th></tr></thead>
            <tbody>{list.map(({ ob, emp }) => {
              const r = D.onboardingScore(s, ob);
              const mt = D.ceoMeetingOf(s, emp.id);
              const isOpen = open === ob.id;
              return (
                <Fragment key={ob.id}>
                  <tr className="clickable" onClick={() => setOpen(isOpen ? null : ob.id)}>
                    <td><Person name={emp.name} sub={`${positionName(s.models, emp.currentLevel)} · ${D.getBranch(s, emp.branchId)?.name}`} /><OnbTags s={s} ob={ob} /></td>
                    <td>{ob.status === 'active' ? <OnbStages day={D.onbDay(s, ob)} days={D.obDays(s, ob)} /> : ob.status === 'archived' ? <Pill tone="muted">to‘xtatildi</Pill> : <Pill tone="good">yakunlandi {fmtDate(ob.final?.at)}</Pill>}</td>
                    <td className="num">{r.coursesDone}/{r.courses}</td>
                    <td className="num">{r.needObs ? `${r.obs}/${r.needObs}` : '—'}</td>
                    <td className="small">{mt ? (mt.attended.includes(emp.id) ? <span style={{ color: 'var(--good)' }}>✓ qatnashdi</span> : mt.date >= s.today ? 'taklif qilingan' : 'qatnashmadi') : <span className="muted">—</span>}</td>
                    <td className="small">{emp.supervisorId ? D.getEmployee(s, emp.supervisorId)?.name : <span className="muted">mentor yo‘q</span>}<div className="muted">{emp.buddyId ? `buddy: ${D.getEmployee(s, emp.buddyId)?.name}` : 'buddy yo‘q'}</div></td>
                    <td className="num"><OnbScore v={ob.final?.score ?? r.score} /></td>
                  </tr>
                  {isOpen && <tr className="edit-row"><td colSpan={7}><OnbDetail s={s} ob={ob} user={user} /></td></tr>}
                </Fragment>
              );
            })}</tbody>
          </table>
        ) : <Empty>Tanlangan filtr bo‘yicha xodim yo‘q.</Empty>}
      </Panel>
      {archived.length > 0 && (
        <Panel tight title={<div className="row"><h2>Arxiv</h2><span className="muted small">ma’lumotlar o‘chirilmaydi — qaytsa, reboarding’da tiklanadi</span></div>}>
          <table>
            <thead><tr><th>Xodim</th><th>Ketgan</th><th>Sabab</th><th>Exit-intervyu</th><th>RegUP</th><th>Edu</th></tr></thead>
            <tbody>{archived.map((e) => <tr key={e.id}><td><Person name={e.name} sub={`${e.currentLevel} · ${D.getBranch(s, e.branchId)?.name}`} /></td><td className="small">{fmtDate(e.leftAt)}</td><td className="small">{e.archiveReason}{e.exit && <div className="muted">{D.EXIT_TYPES[e.exit.type]}{e.exit.fireReason ? `: ${D.FIRE_REASONS[e.exit.fireReason]}` : ''}</div>}</td><td className="small">{e.exit?.survey ? `«${e.exit.survey}»` : <span className="muted">yuborilmaydi</span>}</td><td><Pill tone="muted">arxivda {fmtDate(e.archivedAt)}</Pill></td><td className="small">{e.eduArchiveAt > s.today ? `kutish rejimi, ${fmtDate(e.eduArchiveAt)} gacha` : `arxivlangan ${fmtDate(e.eduArchiveAt)}`}</td></tr>)}</tbody>
          </table>
        </Panel>
      )}
      {manage && <CardsConfig s={s} />}
    </>
  );
}
