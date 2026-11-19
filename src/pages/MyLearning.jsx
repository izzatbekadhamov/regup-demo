import { useAppState, run } from '../state/store.js';
import { Panel, Pill, Empty, go, fmtDate } from '../ui/common.jsx';
import * as D from '../core/domain.js';
import { fmtPct } from '../core/calc.js';
import { nextProfile } from '../core/modelKit.js';
import { RuleChips } from './Courses.jsx';
import { useState } from 'react';
import { pathStatus } from './PathDetail.jsx';

const n1 = (v) => (v === null || v === undefined ? '—' : String(v).replace('.', ','));

function PathCard({ s, emp, path, pe }) {
  const st = pathStatus(s, emp, path);
  const allDone = st.coursesDone === path.courses.length;
  const readyAll = st.ready?.complete && st.extra.every((x) => x.ok);
  const [open, setOpen] = useState(false);
  return (
    <Panel title={<div><div className="row"><h2>{path.title}</h2><Pill tone="teal">→ {st.profile?.code} {st.profile?.name}</Pill></div><div className="muted small">{fmtDate(pe.startedAt)} dan · {path.weeks} hafta{pe.by === 'hr' ? ' · HR biriktirgan' : ''}</div></div>}
      actions={<div className="row" style={{ gap: 6 }}><Pill tone={pe.status === 'completed' ? 'good' : 'brand'}>{st.coursesDone} / {path.courses.length} kurs</Pill><Pill tone="muted">Kurslar bajarilishi {st.pct}%</Pill><button className="btn sm" title="Har bir kurs bahosini ko‘rish" onClick={() => setOpen(!open)}>O‘rtacha kurs bahosi: <b>{n1(st.grade)}</b> {open ? '▴' : '▾'}</button></div>}>
      {open && <table className="small" style={{ marginBottom: 10 }}><thead><tr><th>Kurs</th><th className="num">Bajarilishi</th><th className="num">Kurs bahosi</th></tr></thead><tbody>{st.courses.map((c) => <tr key={c.course.id}><td>{c.course.title}</td><td className="num">{c.pct}%</td><td className="num"><b>{n1(c.grade)}</b></td></tr>)}<tr><td><b>O‘rtacha</b></td><td className="num">{st.pct}%</td><td className="num"><b>{n1(st.grade)}</b></td></tr></tbody></table>}
      <div className="split" style={{ gridTemplateColumns: 'minmax(0,1fr) 300px' }}>
        <ol className="path-track">
          {st.courses.map((c, i) => (
            <li key={c.course.id} className={c.completed ? 'done' : c.locked ? 'locked' : 'cur'}>
              <span className="pt-n">{c.completed ? '✓' : i + 1}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <b>{c.course.title}</b>
                <div className="small muted">{c.completed ? `Yakunlangan ${fmtDate(c.enr.completedAt)} · kurs bahosi ${n1(c.grade)}` : c.locked ? 'Oldingi kurs yakunlangach ochiladi' : `Kurslar bajarilishi ${c.pct}% (${c.done} / ${c.total})${c.grade !== null ? ` · kurs bahosi ${n1(c.grade)}` : ''}${c.pending ? ' · topshiriq mentor tekshiruvida' : ''}`}</div>
                <div style={{ marginTop: 4 }}><RuleChips s={s} course={c.course} compact /></div>
              </div>
              {c.enr && !c.locked && !c.completed && <button className="btn sm primary" onClick={() => go(`/learn/${c.enr.id}`)}>Davom ettirish</button>}
              {c.completed && <button className="btn sm" onClick={() => go(`/learn/${c.enr.id}`)}>Ko‘rish</button>}
            </li>
          ))}
        </ol>
        <div className="stack">
          <div className="small" style={{ fontWeight: 650 }}>{st.profile?.code} lavozimiga tayyorligingiz</div>
          <div className="row" style={{ flexWrap: 'nowrap', gap: 8 }}><div className="near-bar"><i style={{ width: `${st.ready?.near || 0}%` }} /></div><b>{fmtPct(st.ready?.near || 0, 0)}</b></div>
          <div className="small muted">{st.ready?.met} / {st.ready?.total} kompetensiya talabi bajarilgan</div>
          <div className="hr" />
          <div className="small" style={{ fontWeight: 650 }}>Lavozim shartlari</div>
          {st.extra.map((x) => <div key={x.label} className="small" style={{ color: x.ok ? 'var(--good)' : 'var(--ink-2)' }}>{x.ok ? '✓' : '○'} {x.label} · {x.value}</div>)}
          <div className="small" style={{ color: allDone ? 'var(--good)' : 'var(--ink-2)' }}>{allDone ? '✓' : '○'} Learning Path kurslari yakunlangan</div>
          <div className={`callout small ${readyAll ? 'good' : ''}`}>{readyAll ? 'Barcha talablar bajarilgan — HR baholash kartasini ochadi, qaror panel orqali.' : 'Kurslar, ishdagi amaliy topshiriqlar va KPI talablari bajarilgach HR baholashga taklif qiladi.'}</div>
        </div>
      </div>
    </Panel>
  );
}

export default function MyLearning({ emp }) {
  const s = useAppState();
  const myPaths = s.pathEnrollments.filter((x) => x.employeeId === emp.id);
  const solo = s.enrollments.filter((e) => e.employeeId === emp.id && !e.pathId);
  const pending = s.enrollments.filter((e) => e.employeeId === emp.id).reduce((a, e) => a + Object.values(e.progress).filter((p) => p.status === 'pending').length, 0);
  // Tavsiyalar: keyingi daraja yoki qiziqish bildirgan lavozimga olib boradigan yo'llar; rejadagi kompetensiyalarga mos kurslar.
  const model = D.activeModel(s, emp.position);
  const nextCode = model ? nextProfile(model, emp.currentLevel) : null;
  const interestTargets = s.interests.filter((x) => x.employeeId === emp.id).map((x) => x.target);
  const recPaths = s.paths.filter((p) => !myPaths.some((m) => m.pathId === p.id) && (p.target.profileCode === nextCode && nextCode !== emp.currentLevel || interestTargets.includes(p.target.profileCode)));
  const idpCodes = s.idp.filter((x) => x.employeeId === emp.id && ['open', 'returned'].includes(x.status)).map((x) => x.competency);
  const recCourses = s.courses.filter((c) => c.status === 'active' && c.rules.some((r) => idpCodes.includes(r.competency)) && !s.enrollments.some((e) => e.employeeId === emp.id && e.courseId === c.id));
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Kurslarim</h1>
          <p>Learning Path — maqsadli lavozimga olib boradigan kurslar to‘plami. Har kursdagi test o‘quv dalili, ishda bajarilgan amaliy topshiriq esa mentor xulosasi bilan ish dalili bo‘ladi va kompetensiyangiz darajasini ko‘taradi.</p>
        </div>
        {pending > 0 && <Pill tone="warn">{pending} ta topshiriq mentor tekshiruvida</Pill>}
      </div>
      {myPaths.map((pe) => <PathCard key={pe.id} s={s} emp={emp} path={D.getPath(s, pe.pathId)} pe={pe} />)}
      {solo.length > 0 && (
        <Panel title="Alohida kurslar" tight>
          <table><tbody>{solo.map((e) => {
            const c = D.getCourse(s, e.courseId);
            const pr = D.courseProgress(c, e);
            const g = D.courseGrade(c, e);
            return <tr key={e.id} className="clickable" onClick={() => go(`/learn/${e.id}`)}><td><b>{c.title}</b>{e.mandatory && e.status !== 'completed' && <> <Pill tone={e.mandatory.deadline < s.today ? 'bad' : 'warn'}>majburiy · muddat {fmtDate(e.mandatory.deadline)}</Pill></>}<div className="muted small">Kurslar bajarilishi {pr.pct}% ({pr.done} / {pr.total}){g !== null ? ` · kurs bahosi ${n1(g)}` : ''}{e.mandatory ? ` · KPI bo‘yicha biriktirilgan (${D.monthName(e.mandatory.month)})` : ''}</div></td><td><RuleChips s={s} course={c} compact /></td><td>{e.status === 'completed' ? <Pill tone="good">yakunlangan</Pill> : <Pill tone="brand">o‘qimoqda</Pill>}</td></tr>;
          })}</tbody></table>
        </Panel>
      )}
      {!myPaths.length && !solo.length && <Panel><Empty icon="route">Hali kursga yozilmagansiz. Quyidagi tavsiyalardan boshlang.</Empty></Panel>}
      {(recPaths.length > 0 || recCourses.length > 0) && (
        <Panel title="Siz uchun tavsiya">
          <div className="stack">
            {recPaths.map((p) => (
              <div key={p.id} className="idp-row">
                <div className="row between"><div><b>{p.title}</b> <Pill tone="teal">→ {p.target.profileCode}</Pill>{interestTargets.includes(p.target.profileCode) && <> <Pill tone="brand">qiziqishingiz</Pill></>}</div><button className="btn sm primary" onClick={() => run(D.enrollPath, { employeeId: emp.id, pathId: p.id }, 'Learning Path boshlandi')}>Boshlash</button></div>
                <div className="small ink2">{p.summary}</div>
                <div className="small muted">{p.courses.length} kurs · {p.weeks} hafta</div>
              </div>
            ))}
            {recCourses.map((c) => (
              <div key={c.id} className="idp-row">
                <div className="row between"><div><b>{c.title}</b> <Pill tone="muted">rivojlanish rejangizga mos</Pill></div><button className="btn sm" onClick={() => run(D.enrollCourse, { employeeId: emp.id, courseId: c.id }, 'Kursga yozildingiz')}>Yozilish</button></div>
                <RuleChips s={s} course={c} />
              </div>
            ))}
          </div>
        </Panel>
      )}
      <Panel title="Barcha Learning Path'lar" tight>
        <table><tbody>{s.paths.filter((p) => !myPaths.some((m) => m.pathId === p.id)).map((p) => (
          <tr key={p.id}><td><b>{p.title}</b><div className="muted small">{p.audience}</div></td><td className="small">{p.courses.length} kurs · {p.weeks} hafta</td><td className="num"><button className="btn sm" onClick={() => run(D.enrollPath, { employeeId: emp.id, pathId: p.id }, 'Learning Path boshlandi')}>Boshlash</button></td></tr>
        ))}</tbody></table>
      </Panel>
    </>
  );
}
