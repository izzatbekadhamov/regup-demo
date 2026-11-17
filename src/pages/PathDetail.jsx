import { useState } from 'react';
import { useAppState, run } from '../state/store.js';
import { Panel, Pill, Person, Empty, Icon, go, fmtDate } from '../ui/common.jsx';
import * as D from '../core/domain.js';
import { competencyLibrary, profileConditions, positionName } from '../core/modelKit.js';
import { fmtPct } from '../core/calc.js';
import { RuleChips } from './Courses.jsx';

/** Learning Path yaqinlik va lavozim shartlari (KPI, staj) — xodim va admin ko'rinishida umumiy. */
export function pathStatus(s, emp, path) {
  const model = D.activeModel(s, path.target.modelId);
  const profile = model?.profiles.find((p) => p.code === path.target.profileCode);
  const ready = model && profile ? D.positionReadiness(s, emp, model, profile) : null;
  const courses = path.courses.map((cid) => {
    const course = D.getCourse(s, cid);
    const enr = s.enrollments.filter((e) => e.employeeId === emp.id && e.courseId === cid).sort((a, b) => (a.status === 'completed' ? -1 : 1))[0] || null;
    const done = enr ? course.components.filter((x) => D.componentDone(course, enr, x.id)).length : 0;
    return { course, enr, done, total: course.components.length, locked: enr ? D.courseLocked(s, enr) : false, completed: enr?.status === 'completed', pending: enr ? Object.values(enr.progress).some((p) => p.status === 'pending') : false };
  });
  const conds = profile ? profileConditions(model, profile) : [];
  const tenureMin = conds.find((c) => c.type === 'tenure_months')?.params.min;
  const kpiMin = conds.find((c) => c.type === 'kpi_threshold')?.params.min;
  const tenure = D.monthsBetween(emp.levelSince, s.today);
  const extra = [
    tenureMin && { label: `Joriy lavozimda staj ≥ ${tenureMin} oy`, ok: tenure >= tenureMin, value: `${tenure} oy` },
    kpiMin && { label: `KPI ≥ ${kpiMin}%`, ok: (emp.kpi10m ?? 0) >= kpiMin, value: emp.kpi10m ? `${emp.kpi10m}%` : 'ma’lumot yo‘q' },
  ].filter(Boolean);
  return { model, profile, ready, courses, extra, coursesDone: courses.filter((c) => c.completed).length };
}

export default function PathDetail({ id }) {
  const s = useAppState();
  const path = D.getPath(s, id);
  const [emp, setEmp] = useState('');
  if (!path) return <Panel>Learning Path topilmadi. <a href="#/courses">Kurslarga qaytish</a></Panel>;
  const model = D.activeModel(s, path.target.modelId);
  const profile = model?.profiles.find((p) => p.code === path.target.profileCode);
  const lib = competencyLibrary(s.models);
  const covered = new Set(path.courses.flatMap((cid) => D.getCourse(s, cid)?.rules.map((r) => r.competency) || []));
  const targetCodes = Object.keys(profile?.targets || {});
  const learners = s.pathEnrollments.filter((x) => x.pathId === path.id);
  const others = D.activeEmployees(s).filter((e) => !learners.some((l) => l.employeeId === e.id));
  return (
    <>
      <section className="panel hero compact-hero">
        <div className="crumbs"><a href="#/courses"><Icon name="back" size={13} /> Kurslar va Learning Path</a></div>
        <div className="row" style={{ marginTop: 4 }}><h1>{path.title}</h1><Pill tone="teal">→ {profile?.code} {profile?.name}</Pill></div>
        <p className="ink2">{path.summary}</p>
        <div className="meta"><span>{path.courses.length} kurs</span><span>{path.weeks} hafta</span><span>{path.sequential ? 'Ketma-ket: keyingi kurs oldingisi yakunlangach ochiladi' : 'Kurslar istalgan tartibda'}</span><span>Kimlar uchun: {path.audience}</span></div>
      </section>
      <div className="split">
        <div className="grid">
          <Panel title="Kurslar ketma-ketligi" tight>
            <table>
              <tbody>{path.courses.map((cid, i) => {
                const c = D.getCourse(s, cid);
                return <tr key={cid} className="clickable" onClick={() => go(`/courses/${cid}`)}><td className="num"><span className="step-n">{i + 1}</span></td><td><b>{c.title}</b><div className="muted small">{c.hours} soat · {c.components.filter((x) => x.kind === 'task').length} amaliy topshiriq</div></td><td><RuleChips s={s} course={c} compact /></td></tr>;
              })}</tbody>
            </table>
          </Panel>
          <Panel title="O‘quvchilar va lavozimga tayyorlik" tight actions={
            <div className="row">
              <select className="i compact" value={emp} onChange={(e) => setEmp(e.target.value)}><option value="">Xodim tanlang</option>{others.map((e) => <option key={e.id} value={e.id}>{e.name} · {positionName(s.models, e.currentLevel)}</option>)}</select>
              <button className="btn sm primary" disabled={!emp} onClick={() => run(D.enrollPath, { employeeId: emp, pathId: path.id, by: 'hr' }, 'Learning Path biriktirildi') && setEmp('')}>Biriktirish</button>
            </div>
          }>
            {learners.length ? (
              <table>
                <thead><tr><th>Xodim</th><th className="num">Kurslar</th><th style={{ minWidth: 170 }}>{profile?.code} ga tayyorlik</th><th>KPI va staj</th><th>Holat</th></tr></thead>
                <tbody>{learners.map((l) => {
                  const e = D.getEmployee(s, l.employeeId);
                  const st = pathStatus(s, e, path);
                  return (
                    <tr key={l.id}>
                      <td><Person name={e.name} sub={`${positionName(s.models, e.currentLevel)} · ${fmtDate(l.startedAt)} dan${l.by === 'hr' ? ' · HR biriktirgan' : ''}`} /></td>
                      <td className="num"><b>{st.coursesDone}</b> / {path.courses.length}{st.courses.some((c) => c.pending) && <div className="small" style={{ color: 'var(--warn)' }}>topshiriq tekshiruvda</div>}</td>
                      <td><div className="row" style={{ flexWrap: 'nowrap', gap: 8 }}><div className="near-bar"><i style={{ width: `${st.ready?.near || 0}%` }} /></div><b className="small">{fmtPct(st.ready?.near || 0, 0)}</b></div><div className="muted small">{st.ready?.met} / {st.ready?.total} talab</div></td>
                      <td className="small">{st.extra.map((x) => <div key={x.label} style={{ color: x.ok ? 'var(--good)' : 'var(--warn)' }}>{x.ok ? '✓' : '○'} {x.label} ({x.value})</div>)}</td>
                      <td>{l.status === 'completed' ? <Pill tone="good">yakunlangan</Pill> : <Pill tone="brand">jarayonda</Pill>}</td>
                    </tr>
                  );
                })}</tbody>
              </table>
            ) : <Empty>Hali hech kim yozilmagan.</Empty>}
          </Panel>
        </div>
        <div className="grid sticky">
          <Panel title={`${profile?.code} talablarini qamrab olishi`}>
            <div className="stack">
              <p className="small ink2">Learning Path kurslari maqsadli lavozimning {targetCodes.filter((c) => covered.has(c)).length} / {targetCodes.length} kompetensiyasiga ta’sir qiladi. Qolganlari ish jarayonida va baholashda tasdiqlanadi.</p>
              <div className="row" style={{ gap: 6 }}>
                {targetCodes.map((c) => <span key={c} className={`pos-chip ${covered.has(c) ? 'ok' : ''}`} title={lib.find((k) => k.code === c)?.name}>{c}{covered.has(c) ? ' ✓' : ''}</span>)}
              </div>
              <div className="callout small">Learning Path yakunlanishi — lavozimga avtomatik o‘tish emas. Kompetensiya tayyorligi, KPI, staj va majburiy talablar bajarilgach HR baholash kartasini ochadi; qaror panel orqali.</div>
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
