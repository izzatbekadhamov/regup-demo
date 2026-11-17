import { useState } from 'react';
import { useAppState, run } from '../state/store.js';
import { Panel, Pill, Icon, fmtDate } from '../ui/common.jsx';
import * as D from '../core/domain.js';
import { competencyLibrary } from '../core/modelKit.js';
import { KIND, TASK_TYPE, CTX } from './Courses.jsx';

function TestBlock({ enr, c, p, readOnly }) {
  const [ans, setAns] = useState({});
  const passed = (p?.best ?? -1) >= c.passScore;
  return (
    <div className="stack">
      {p && <div className={`callout small ${passed ? 'good' : 'warn'}`}>Oxirgi natija: {p.last}% · eng yaxshi: {p.best}% · {p.attempts} urinish. {passed ? 'Test topshirildi.' : `O‘tish uchun ${c.passScore}% kerak — qayta urinib ko‘ring.`}</div>}
      {!passed && !readOnly && (
        <>
          {c.questions.map((qq, i) => (
            <div key={i} className="quiz-q">
              <b className="small">{i + 1}. {qq.text}</b>
              {qq.options.map((o, j) => (
                <label key={j} className={`quiz-opt ${Number(ans[i]) === j ? 'on' : ''}`}><input type="radio" name={`q${c.id}${i}`} checked={Number(ans[i]) === j} onChange={() => setAns({ ...ans, [i]: j })} /> {o}</label>
              ))}
            </div>
          ))}
          <div className="row"><button className="btn primary" disabled={Object.keys(ans).length < c.questions.length} onClick={() => run(D.submitTest, { enrollmentId: enr.id, componentId: c.id, answers: c.questions.map((_, i) => ans[i]) }, 'Test topshirildi') && setAns({})}>Testni topshirish</button><span className="muted small">O‘tish bali {c.passScore}%</span></div>
        </>
      )}
    </div>
  );
}

function TaskBlock({ enr, c, p, readOnly }) {
  const [f, setF] = useState({ text: '', link: '', origin: 'self', assignedBy: '' });
  const status = p?.status;
  return (
    <div className="stack">
      <div className="small"><b>Vazifa:</b> {c.description}</div>
      <div className="small ink2"><b>Mentor nimaga qarab baholaydi:</b> {c.criteria}</div>
      {status === 'pending' && <div className="callout warn small">Natijangiz {fmtDate(p.submittedAt)} da yuborildi — mentor xulosasi kutilmoqda. {p.origin === 'manager' ? `Topshiriq bergan: ${p.assignedBy}.` : 'O‘z tashabbusingiz bilan.'}</div>}
      {status === 'accepted' && <div className="callout good small"><b>Qabul qilindi — {p.mentor.grade ? `${p.mentor.grade} / 5 ball` : `${p.mentor.level}-daraja`}.</b> {p.mentor.note} <span className="muted">({p.mentor.by}, {fmtDate(p.mentor.at)})</span></div>}
      {status === 'returned' && <div className="callout bad small"><b>Qaytarildi:</b> {p.mentor.note} <span className="muted">({p.mentor.by})</span></div>}
      {!readOnly && status !== 'pending' && status !== 'accepted' && (
        <div className="panel add-box">
          <div className="row">
            <label className="chk"><input type="radio" name={`o${c.id}`} checked={f.origin === 'self'} onChange={() => setF({ ...f, origin: 'self' })} /> O‘z tashabbusim bilan</label>
            <label className="chk"><input type="radio" name={`o${c.id}`} checked={f.origin === 'manager'} onChange={() => setF({ ...f, origin: 'manager' })} /> Rahbar topshirig‘i bilan</label>
            {f.origin === 'manager' && <input className="i compact" style={{ minWidth: 220 }} placeholder="Kim topshirdi (masalan, filial rahbari)" value={f.assignedBy} onChange={(e) => setF({ ...f, assignedBy: e.target.value })} />}
          </div>
          <label className="f" style={{ marginTop: 8 }}>Nima qildingiz va natija
            <textarea className="i" placeholder="Qilgan ishingiz, shaxsiy hissangiz, oldin/keyin ko‘rsatkich" value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} />
          </label>
          <label className="f" style={{ marginTop: 8 }}>Ilova yoki havola (ixtiyoriy)<input className="i" placeholder="hisobot, jadval, fayl" value={f.link} onChange={(e) => setF({ ...f, link: e.target.value })} /></label>
          <div className="row" style={{ marginTop: 8 }}><button className="btn primary" disabled={!f.text.trim() || (f.origin === 'manager' && !f.assignedBy.trim())} onClick={() => run(D.submitTask, { enrollmentId: enr.id, componentId: c.id, ...f }, 'Natija mentorga yuborildi')}>Mentorga yuborish</button></div>
        </div>
      )}
    </div>
  );
}

export default function Learn({ id, emp }) {
  const s = useAppState();
  const enr = D.getEnrollment(s, id);
  const [open, setOpen] = useState(null);
  if (!enr || enr.employeeId !== emp.id) return <Panel>Kurs topilmadi. <a href="#/learning">Kurslarimga qaytish</a></Panel>;
  const course = D.getCourse(s, enr.courseId);
  const locked = D.courseLocked(s, enr);
  const lib = competencyLibrary(s.models);
  const done = course.components.filter((x) => D.componentDone(course, enr, x.id)).length;
  const first = course.components.find((x) => !D.componentDone(course, enr, x.id))?.id;
  const cur = open ?? first;
  return (
    <>
      <section className="panel hero compact-hero">
        <div className="crumbs"><a href="#/learning"><Icon name="back" size={13} /> Kurslarim</a>{enr.pathId && <span>{D.getPath(s, enr.pathId)?.title}</span>}</div>
        <div className="row" style={{ marginTop: 4 }}><h1>{course.title}</h1>{enr.status === 'completed' ? <Pill tone="good">yakunlangan</Pill> : <Pill tone="brand">{done} / {course.components.length}</Pill>}</div>
        <p className="ink2">{course.summary}</p>
        <div className="near-bar" style={{ maxWidth: 420 }}><i style={{ width: `${(100 * done) / course.components.length}%` }} /></div>
        {enr.mandatory && enr.status !== 'completed' && (() => { const r = s.kpiRules.find((x) => x.id === enr.mandatory.ruleId); return <div className="callout warn small"><b>Majburiy kurs</b> — {D.monthName(enr.mandatory.month)}: {D.KPI_METRICS[r.metric].label} {enr.mandatory.value.toFixed(1).replace('.', ',')}%, chegara {enr.mandatory.min}%. Muddat: {fmtDate(enr.mandatory.deadline)}. Mas’ulingiz natijani kuzatib boradi.</div>; })()}
        {enr.onboardingId && enr.status !== 'completed' && <div className="callout small"><b>Moslashuv kursi</b> — muddat {fmtDate(enr.deadline)}. Test va topshiriq 1–5 ballga aylanadi va 30 kunlik bahoga kiradi. Topshiriqni {D.taskReviewer(s, enr).kind === 'curator' ? `kurs kuratori (${D.taskReviewer(s, enr).user.name})` : 'mentoringiz'} tekshiradi.</div>}
        {locked && <div className="callout warn small">Bu kurs Learning Path’dagi oldingi kurs yakunlangach ochiladi.</div>}
      </section>
      <div className="split">
        <div className="stack" style={{ gap: 10 }}>
          {course.components.map((c, i) => {
            const p = enr.progress[c.id];
            const ok = D.componentDone(course, enr, c.id);
            const isOpen = cur === c.id;
            return (
              <section key={c.id} className={`panel learn-item ${ok ? 'done' : ''} ${isOpen ? 'open' : ''}`}>
                <button className="learn-head" onClick={() => setOpen(isOpen ? '' : c.id)}>
                  <span className="pt-n">{ok ? '✓' : i + 1}</span>
                  <span style={{ flex: 1, textAlign: 'left' }}><b>{c.title}</b><div className="small muted">{KIND[c.kind]}{c.kind === 'task' ? ` · ${TASK_TYPE[c.taskType]}` : ''}{c.kind === 'lesson' ? ` · ${c.minutes} daqiqa` : ''}{p?.status === 'pending' ? ' · mentor tekshiruvida' : ''}</div></span>
                  <Pill tone={ok ? 'good' : p?.status === 'pending' ? 'warn' : p?.status === 'returned' ? 'bad' : 'muted'}>{ok ? 'bajarildi' : p?.status === 'pending' ? 'tekshiruvda' : p?.status === 'returned' ? 'qaytarildi' : 'kutilmoqda'}</Pill>
                </button>
                {isOpen && (
                  <div className="learn-body">
                    {c.kind === 'lesson' && (
                      <div className="stack">
                        <div className="lesson-stub"><Icon name="cards" size={18} /> Dars materiali (video / matn) Exode LMS’da: «{c.title}»</div>
                        {!ok && !locked && <div><button className="btn primary sm" onClick={() => run(D.completeLesson, { enrollmentId: enr.id, componentId: c.id }, 'Dars o‘qildi')}>O‘qidim — keyingisi</button></div>}
                      </div>
                    )}
                    {c.kind === 'test' && <TestBlock enr={enr} c={c} p={p} readOnly={locked} />}
                    {c.kind === 'task' && <TaskBlock enr={enr} c={c} p={p} readOnly={locked} />}
                  </div>
                )}
              </section>
            );
          })}
        </div>
        <div className="grid sticky">
          <Panel title="Bu kurs nima beradi">
            <div className="stack">
              {course.rules.map((r, i) => {
                const applied = enr.applied?.includes(i);
                const lvl = D.ruleOutcome(course, enr, r);
                return (
                  <div key={i} className={`rule-box ${r.context} ${applied ? 'applied' : ''}`}>
                    <div className="row between"><b>{r.competency} → {applied && lvl !== null ? lvl : r.level}-daraja</b><span className={`pill ${CTX[r.context][1]}`}>{CTX[r.context][0]}</span></div>
                    <div className="small ink2">{lib.find((k) => k.code === r.competency)?.name}</div>
                    <div className="small muted">{applied ? '✓ Profilingizga yozildi' : `Shart: ${r.needs.map((n) => course.components.find((x) => x.id === n)?.title).join(' + ')}`}</div>
                  </div>
                );
              })}
              {(course.skills || []).map((k, i) => {
                const sk = s.skillCatalog.find((x) => x.id === k.skillId);
                const got = enr.skillApplied?.includes(i);
                return (
                  <div key={`sk${i}`} className={`rule-box skill ${got ? 'applied' : ''}`}>
                    <div className="row between"><b>{sk?.name}</b><span className="pill teal">ko‘nikma · {D.SKILL_LEVELS[k.level][0]}</span></div>
                    <div className="small muted">{got ? '✓ Ko‘nikmalaringizga tasdiqlangan holda yozildi' : `Shart: ${k.needs.map((n) => course.components.find((x) => x.id === n)?.title).join(' + ')}`}</div>
                  </div>
                );
              })}
              {course.onboarding && <p className="small">Bu moslashuv kursi: kompetensiya darajasi bermaydi, natijasi 30 kunlik moslashuv bahosiga kiradi (test foizi → 1–5 ball, topshiriq — mentor/kurator bahosi).</p>}
              <p className="small muted">Ish dalili darajasini mentor amaliy topshiriq natijasiga qarab belgilaydi (ko‘rsatilgan darajagacha). Lavozimga o‘tish uchun baholash kartasi va panel qarori alohida.</p>
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
