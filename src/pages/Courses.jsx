import { useState } from 'react';
import { useAppState, run, getState } from '../state/store.js';
import { Panel, Pill, Person, Empty, go, fmtDate } from '../ui/common.jsx';
import * as D from '../core/domain.js';
import { competencyLibrary, levelName } from '../core/modelKit.js';
import { DIRECTIONS } from '../data/courses.js';

export const KIND = { lesson: 'Dars', test: 'Test', task: 'Amaliy topshiriq' };
export const TASK_TYPE = { case: 'Keys', stretch: 'Stretch vazifa', work: 'Ishdagi topshiriq' };
export const CTX = { learning: ['o‘quv dalili', 'brand'], work: ['ish dalili', 'good'] };

export function RuleChips({ s, course, compact }) {
  const lib = competencyLibrary(s.models);
  return (
    <div className="row" style={{ gap: 6 }}>
      {!compact && (course.skills || []).map((k, i) => <span key={`sk${i}`} className="pos-chip skill">{s.skillCatalog?.find((x) => x.id === k.skillId)?.name} · ko‘nikma</span>)}
      {course.rules.map((r, i) => (
        <span key={i} className={`pos-chip ${r.context === 'work' ? 'ok' : ''}`} title={`${lib.find((c) => c.code === r.competency)?.name || ''} — ${r.note || ''}`}>
          {r.competency}{!compact && ` ${(lib.find((c) => c.code === r.competency)?.name || '').slice(0, 26)}`} → <b>{r.level}</b> · {CTX[r.context][0]}
        </span>
      ))}
    </div>
  );
}

/** Mentor tekshiruvi navbati: yuborilgan amaliy topshiriqlar. */
export function ReviewQueue({ s }) {
  const items = (s.enrollments || []).filter((e) => !D.getCourse(s, e.courseId)?.onboarding && e.status !== 'archived').flatMap((e) => Object.entries(e.progress).filter(([, p]) => p.status === 'pending').map(([cid, p]) => ({ e, cid, p })));
  return items.length ? <div className="stack" style={{ gap: 12 }}>{items.map(({ e, cid, p }) => <ReviewItem key={`${e.id}-${cid}`} s={s} e={e} cid={cid} p={p} />)}</div>
    : <Empty icon="check">Tekshiriladigan amaliy topshiriq yo‘q.</Empty>;
}

function ReviewItem({ s, e, cid, p }) {
  const course = D.getCourse(s, e.courseId);
  const comp = course.components.find((c) => c.id === cid);
  const rules = course.rules.filter((r) => r.needs.includes(cid));
  const cap = Math.max(...rules.map((r) => r.level));
  const [f, setF] = useState({ level: String(cap), note: '', mentor: 'Mentor' });
  const emp = D.getEmployee(s, e.employeeId);
  return (
    <div className="idp-row">
      <div className="row between">
        <Person name={emp.name} sub={`${course.title} · yuborilgan ${fmtDate(p.submittedAt)}`} />
        <div className="row"><Pill tone="warn">{TASK_TYPE[comp.taskType]}</Pill><Pill tone={p.origin === 'manager' ? 'brand' : 'teal'}>{p.origin === 'manager' ? `Rahbar topshirig‘i: ${p.assignedBy}` : 'O‘z tashabbusi bilan'}</Pill></div>
      </div>
      <div className="small"><b>{comp.title}.</b> <span className="ink2">{comp.criteria}</span></div>
      <div className="callout small"><b>Xodim yuborgan natija:</b> {p.text}{p.link && <div className="code" style={{ marginTop: 4 }}>{p.link}</div>}</div>
      <div className="small ink2">Qabul qilinsa: {rules.map((r) => `${r.competency} → ${r.level}-darajagacha (${CTX[r.context][0]})`).join(', ')}</div>
      <div className="row">
        <label className="f">Mentor<input className="i compact" style={{ width: 170 }} value={f.mentor} onChange={(ev) => setF({ ...f, mentor: ev.target.value })} /></label>
        <label className="f">Ko‘rsatilgan daraja
          <select className="i compact" value={f.level} onChange={(ev) => setF({ ...f, level: ev.target.value })}>{Array.from({ length: cap }, (_, i) => cap - i).map((l) => <option key={l} value={l}>{l} — {levelName(null, l)}</option>)}</select>
        </label>
        <label className="f" style={{ flex: 1, minWidth: 240 }}>Mentor xulosasi (dalil sifatida biriktiriladi)<input className="i" placeholder="Qaysi indikator ko‘rindi, natija va izoh" value={f.note} onChange={(ev) => setF({ ...f, note: ev.target.value })} /></label>
      </div>
      <div className="row">
        <button className="btn primary sm" disabled={!f.note.trim()} onClick={() => run(D.reviewTask, { enrollmentId: e.id, componentId: cid, decision: 'accepted', level: Number(f.level), note: f.note, mentor: f.mentor }, 'Topshiriq qabul qilindi — kompetensiya yangilandi')}>Qabul qilish</button>
        <button className="btn danger sm" disabled={!f.note.trim()} onClick={() => run(D.reviewTask, { enrollmentId: e.id, componentId: cid, decision: 'returned', note: f.note, mentor: f.mentor }, 'Topshiriq qaytarildi')}>Qaytarish</button>
      </div>
    </div>
  );
}

function CourseCard({ s, c }) {
  const n = (k) => c.components.filter((x) => x.kind === k).length;
  const learners = (s.enrollments || []).filter((e) => e.courseId === c.id);
  return (
    <section className="panel model-card clickable-card" onClick={() => go(`/courses/${c.id}`)}>
      <div className="row between"><span className="tag">{c.id}</span>{c.status === 'draft' ? <Pill tone="muted">qoralama</Pill> : <Pill tone="good">faol</Pill>}</div>
      <h2 style={{ marginTop: 8, fontSize: 14.5 }}>{c.title}</h2>
      <p className="small ink2">{c.summary}</p>
      <div className="small muted" style={{ marginTop: 6 }}>{c.hours} soat · {n('lesson')} dars · {n('test')} test · {n('task')} amaliy topshiriq · {learners.length} o‘quvchi</div>
      <div style={{ marginTop: 8 }}><RuleChips s={s} course={c} compact /></div>
      {(c.skills || []).length > 0 && <div className="small" style={{ marginTop: 6, color: 'var(--teal)' }}>+ ko‘nikma: {c.skills.map((k) => s.skillCatalog.find((x) => x.id === k.skillId)?.name).join(', ')}</div>}
    </section>
  );
}

function NewCourse({ onDone }) {
  const [f, setF] = useState({ title: '', direction: 'FR', hours: 4, summary: '' });
  return (
    <Panel title="Yangi kurs" actions={<button className="btn sm" onClick={onDone}>Yopish</button>}>
      <div className="grid g4" style={{ alignItems: 'end' }}>
        <label className="f" style={{ gridColumn: 'span 2' }}>Kurs nomi<input className="i" placeholder="Masalan: Filialda xavfsizlik va compliance" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
        <label className="f">Yo‘nalish<select className="i" value={f.direction} onChange={(e) => setF({ ...f, direction: e.target.value })}>{Object.entries(DIRECTIONS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <label className="f">Davomiyligi, soat<input className="i" type="number" value={f.hours} onChange={(e) => setF({ ...f, hours: e.target.value })} /></label>
        <label className="f" style={{ gridColumn: 'span 4' }}>Qisqa tavsif<input className="i" value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })} /></label>
      </div>
      <div className="row" style={{ marginTop: 10 }}>
        <button className="btn primary" disabled={!f.title.trim()} onClick={() => { if (run(D.createCourse, f, 'Kurs qoralamasi yaratildi')) go(`/courses/${getState().courses.at(-1).id}`); }}>Yaratish va sozlash</button>
        <span className="muted small">Keyin: darslar, test, amaliy topshiriq va kompetensiyaga ta’sir qoidalari.</span>
      </div>
    </Panel>
  );
}

export default function Courses() {
  const s = useAppState();
  const [tab, setTab] = useState('courses');
  const [creating, setCreating] = useState(false);
  const pending = (s.enrollments || []).reduce((a, e) => a + Object.values(e.progress).filter((p) => p.status === 'pending').length, 0);
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Kurslar va Learning Path</h1>
          <p>Kurs — darslar, test va amaliy topshiriqlar. Kurs yaratilganda qaysi komponent bajarilsa qaysi kompetensiya qaysi darajagacha ko‘tarilishi sozlanadi: test — o‘quv dalili, ishdagi amaliy topshiriq + mentor xulosasi — ish dalili. Learning Path — maqsadli lavozimga olib boradigan bir nechta kursdan iborat kompleks yo‘l.</p>
        </div>
        {tab === 'courses' && !creating && <button className="btn primary" onClick={() => setCreating(true)}>+ Yangi kurs</button>}
      </div>
      <div className="tabs">
        {[['courses', `Kurslar (${s.courses.length})`], ['paths', `Learning Path (${s.paths.length})`], ['review', 'Mentor tekshiruvi']].map(([k, l]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}{k === 'review' && pending > 0 && <span className="tab-n bad">{pending}</span>}</button>
        ))}
      </div>
      {tab === 'courses' && (
        <>
          {creating && <NewCourse onDone={() => setCreating(false)} />}
          {Object.entries(DIRECTIONS).map(([k, l]) => {
            const list = s.courses.filter((c) => c.direction === k);
            return list.length > 0 && (
              <div key={k} className="stack">
                <h2>{l} <span className="muted small">· {list.length} kurs</span></h2>
                <div className="grid g3">{list.map((c) => <CourseCard key={c.id} s={s} c={c} />)}</div>
              </div>
            );
          })}
        </>
      )}
      {tab === 'paths' && (
        <div className="grid g2">
          {s.paths.map((p) => {
            const model = D.activeModel(s, p.target.modelId);
            const prof = model?.profiles.find((x) => x.code === p.target.profileCode);
            const learners = s.pathEnrollments.filter((x) => x.pathId === p.id);
            return (
              <section key={p.id} className="panel model-card clickable-card" onClick={() => go(`/paths/${p.id}`)}>
                <div className="row between"><Pill tone="teal">→ {p.target.profileCode} {prof?.name}</Pill><span className="small muted">{p.weeks} hafta · {p.sequential ? 'ketma-ket' : 'erkin tartib'}</span></div>
                <h2 style={{ marginTop: 8 }}>{p.title}</h2>
                <p className="small ink2">{p.summary}</p>
                <ol className="path-steps">{p.courses.map((cid) => <li key={cid}>{D.getCourse(s, cid)?.title}</li>)}</ol>
                <div className="small muted">Kimlar uchun: {p.audience} · {learners.length} o‘quvchi</div>
              </section>
            );
          })}
        </div>
      )}
      {tab === 'review' && <Panel title="Amaliy topshiriqlar — mentor xulosasi kutilmoqda"><ReviewQueue s={s} /></Panel>}
    </>
  );
}
