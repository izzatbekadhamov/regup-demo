import { useState } from 'react';
import { useAppState, run } from '../state/store.js';
import { Panel, Pill, Person, Empty, Icon, fmtDate } from '../ui/common.jsx';
import * as D from '../core/domain.js';
import { competencyLibrary } from '../core/modelKit.js';
import { DIRECTIONS } from '../data/courses.js';
import { KIND, TASK_TYPE, CTX } from './Courses.jsx';

const upd = (c, fn, ok) => run(D.updateCourse, { id: c.id, patch: fn }, ok);

function AddComponent({ c }) {
  const [f, setF] = useState({ kind: 'lesson', title: '', minutes: 30, passScore: 70, taskType: 'work', description: '', criteria: '', qtext: '', options: 'A variant\nB variant\nC variant', answer: 0 });
  // Identifikator prefikslari: l — dars, t — test, a — amaliy topshiriq; band bo'lsa keyingi raqam.
  const prefix = { lesson: 'l', test: 't', task: 'a' }[f.kind];
  let n = c.components.filter((x) => x.kind === f.kind).length + 1;
  while (c.components.some((x) => x.id === `${prefix}${n}`)) n += 1;
  const id = `${prefix}${n}`;
  const add = () => upd(c, (x) => {
    const base = { id, kind: f.kind, title: f.title.trim() };
    if (f.kind === 'lesson') x.components.push({ ...base, minutes: Number(f.minutes) });
    if (f.kind === 'test') x.components.push({ ...base, passScore: Number(f.passScore), questions: f.qtext.trim() ? [{ text: f.qtext.trim(), options: f.options.split('\n').map((o) => o.trim()).filter(Boolean), answer: Number(f.answer) }] : [] });
    if (f.kind === 'task') x.components.push({ ...base, taskType: f.taskType, description: f.description, criteria: f.criteria, mentorRequired: true });
  }, `${KIND[f.kind]} qo‘shildi`) && setF({ ...f, title: '', qtext: '', description: '', criteria: '' });
  return (
    <div className="panel add-box">
      <h3>+ Komponent qo‘shish</h3>
      <div className="grid g3" style={{ gap: 8, marginTop: 8 }}>
        <label className="f">Turi<select className="i" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>{Object.entries(KIND).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <label className="f" style={{ gridColumn: 'span 2' }}>Nomi<input className="i" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
        {f.kind === 'lesson' && <label className="f">Davomiyligi, daqiqa<input className="i" type="number" value={f.minutes} onChange={(e) => setF({ ...f, minutes: e.target.value })} /></label>}
        {f.kind === 'test' && <>
          <label className="f">O‘tish bali, %<input className="i" type="number" value={f.passScore} onChange={(e) => setF({ ...f, passScore: e.target.value })} /></label>
          <label className="f" style={{ gridColumn: 'span 2' }}>Birinchi savol<input className="i" value={f.qtext} onChange={(e) => setF({ ...f, qtext: e.target.value })} /></label>
          <label className="f" style={{ gridColumn: 'span 2' }}>Variantlar (har biri yangi qatorda)<textarea className="i" value={f.options} onChange={(e) => setF({ ...f, options: e.target.value })} /></label>
          <label className="f">To‘g‘ri javob (1-dan)<input className="i" type="number" min="1" value={Number(f.answer) + 1} onChange={(e) => setF({ ...f, answer: Number(e.target.value) - 1 })} /></label>
        </>}
        {f.kind === 'task' && <>
          <label className="f">Topshiriq turi<select className="i" value={f.taskType} onChange={(e) => setF({ ...f, taskType: e.target.value })}>{Object.entries(TASK_TYPE).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <label className="f" style={{ gridColumn: 'span 2' }}>Nima qilinadi<input className="i" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></label>
          <label className="f" style={{ gridColumn: 'span 3' }}>Mentor nimaga qarab baholaydi<input className="i" value={f.criteria} onChange={(e) => setF({ ...f, criteria: e.target.value })} /></label>
        </>}
      </div>
      <div className="row" style={{ marginTop: 8 }}><button className="btn primary sm" disabled={!f.title.trim()} onClick={add}>Qo‘shish</button></div>
    </div>
  );
}

function AddRule({ s, c }) {
  const lib = competencyLibrary(s.models);
  const [f, setF] = useState({ competency: lib[0]?.code, level: 2, context: 'learning', needs: [] });
  return (
    <div className="panel add-box">
      <h3>+ Kompetensiyaga ta’sir qoidasi</h3>
      <div className="grid g3" style={{ gap: 8, marginTop: 8 }}>
        <label className="f">Kompetensiya<select className="i" value={f.competency} onChange={(e) => setF({ ...f, competency: e.target.value })}>{lib.map((k) => <option key={k.code} value={k.code}>{k.code} — {k.name}</option>)}</select></label>
        <label className="f">Maksimal daraja<select className="i" value={f.level} onChange={(e) => setF({ ...f, level: Number(e.target.value) })}>{[1, 2, 3, 4, 5].map((l) => <option key={l}>{l}</option>)}</select></label>
        <label className="f">Dalil turi<select className="i" value={f.context} onChange={(e) => setF({ ...f, context: e.target.value })}><option value="learning">O‘quv dalili (test/keys)</option><option value="work">Ish dalili (amaliy topshiriq + mentor)</option></select></label>
      </div>
      <div className="f" style={{ marginTop: 8 }}>Qaysi komponentlar bajarilsa
        <div className="row">{c.components.filter((x) => x.kind !== 'lesson').map((x) => (
          <label key={x.id} className="chk"><input type="checkbox" checked={f.needs.includes(x.id)} onChange={(e) => setF({ ...f, needs: e.target.checked ? [...f.needs, x.id] : f.needs.filter((y) => y !== x.id) })} />{KIND[x.kind]}: {x.title}</label>
        ))}{!c.components.some((x) => x.kind !== 'lesson') && <span className="muted small">Avval test yoki amaliy topshiriq qo‘shing</span>}</div>
      </div>
      <div className="row" style={{ marginTop: 8 }}><button className="btn primary sm" disabled={!f.needs.length} onClick={() => upd(c, (x) => { x.rules.push({ ...f, note: '' }); }, 'Qoida qo‘shildi') && setF({ ...f, needs: [] })}>Qo‘shish</button></div>
    </div>
  );
}

export default function CourseDetail({ id }) {
  const s = useAppState();
  const c = D.getCourse(s, id);
  if (!c) return <Panel>Kurs topilmadi. <a href="#/courses">Kurslarga qaytish</a></Panel>;
  const editable = c.status === 'draft';
  const lib = competencyLibrary(s.models);
  const errs = editable ? D.validateCourse(s, c) : [];
  const learners = (s.enrollments || []).filter((e) => e.courseId === c.id);
  const paths = s.paths.filter((p) => p.courses.includes(c.id));
  return (
    <>
      <section className="panel hero compact-hero">
        <div className="hero-top">
          <div style={{ minWidth: 0 }}>
            <div className="crumbs"><a href="#/courses"><Icon name="back" size={13} /> Kurslar</a><span className="code">{c.id}{c.exodeId ? ` · eski Exode ID ${c.exodeId}` : ''}</span></div>
            <div className="row" style={{ marginTop: 4 }}><h1>{c.title}</h1>{editable ? <Pill tone="muted">qoralama</Pill> : <Pill tone="good">faol</Pill>}</div>
            <p className="ink2" style={{ marginTop: 4 }}>{c.summary}</p>
            <div className="meta"><span>{DIRECTIONS[c.direction]}</span><span>{c.hours} soat</span><span>{learners.length} o‘quvchi</span>{paths.length > 0 && <span>Learning Path: {paths.map((p) => p.title).join(', ')}</span>}</div>
          </div>
          {editable && <button className="btn primary" disabled={errs.length > 0} title={errs.join('; ')} onClick={() => run(D.publishCourse, { id: c.id }, 'Kurs faollashtirildi')}>Kursni faollashtirish</button>}
        </div>
        {editable && errs.length > 0 && <div className="callout bad small"><b>Faollashtirishdan oldin:</b><ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>{errs.map((e) => <li key={e}>{e}</li>)}</ul></div>}
      </section>

      <div className="split">
        <div className="grid">
          <Panel title="Kurs tarkibi" tight>
            {c.components.length ? (
              <table>
                <tbody>
                  {c.components.map((x, i) => (
                    <tr key={x.id}>
                      <td className="num muted" style={{ width: 36 }}>{i + 1}</td>
                      <td><Pill tone={x.kind === 'task' ? 'warn' : x.kind === 'test' ? 'brand' : 'muted'}>{KIND[x.kind]}</Pill></td>
                      <td>
                        <b>{x.title}</b>
                        {x.kind === 'test' && <div className="muted small">{x.questions.length} savol · o‘tish bali {x.passScore}%</div>}
                        {x.kind === 'task' && <div className="small ink2">{TASK_TYPE[x.taskType]} · {x.description}<div className="muted">Mentor baholaydi: {x.criteria}</div></div>}
                        {x.kind === 'lesson' && <div className="muted small">{x.minutes} daqiqa</div>}
                      </td>
                      <td className="num">{editable && <button className="btn sm danger" onClick={() => upd(c, (y) => { y.components = y.components.filter((z) => z.id !== x.id); y.rules.forEach((r) => { r.needs = r.needs.filter((n) => n !== x.id); }); })}>olib tashlash</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <Empty>Hali komponent yo‘q.</Empty>}
          </Panel>
          {editable && <AddComponent c={c} />}

          <Panel title="O‘quvchilar" tight>
            {learners.length ? (
              <table>
                <thead><tr><th>Xodim</th><th>Boshlagan</th><th className="num">Bajarilgan</th><th>Holat</th></tr></thead>
                <tbody>{learners.map((e) => {
                  const done = c.components.filter((x) => D.componentDone(c, e, x.id)).length;
                  const pend = Object.values(e.progress).some((p) => p.status === 'pending');
                  return <tr key={e.id}><td><Person name={D.getEmployee(s, e.employeeId).name} sub={e.pathId ? D.getPath(s, e.pathId)?.title : 'alohida kurs'} /></td><td className="small">{fmtDate(e.startedAt)}{e.by !== 'employee' && <div className="muted">HR biriktirgan</div>}</td><td className="num">{done} / {c.components.length}</td><td>{e.status === 'completed' ? <Pill tone="good">yakunlangan {fmtDate(e.completedAt)}</Pill> : pend ? <Pill tone="warn">mentor tekshiruvi</Pill> : D.courseLocked(s, e) ? <Pill tone="muted">navbatda</Pill> : <Pill tone="brand">o‘qimoqda</Pill>}</td></tr>;
                })}</tbody>
              </table>
            ) : <Empty>Hali hech kim yozilmagan.</Empty>}
          </Panel>
        </div>

        <div className="grid sticky">
          <Panel title="Kompetensiyaga ta’sir">
            <div className="stack">
              <p className="small ink2">Kurs yakunida avtomatik yoziladi. Ish dalili faqat amaliy topshiriq mentor tomonidan qabul qilinganda; mentor bergan daraja chegaradan oshmaydi. Mavjud yuqori daraja pasaytirilmaydi.</p>
              {c.rules.map((r, i) => (
                <div key={i} className={`rule-box ${r.context}`}>
                  <div className="row between">
                    <b>{r.competency} → {r.level}-daraja</b>
                    <span className={`pill ${CTX[r.context][1]}`}>{CTX[r.context][0]}</span>
                  </div>
                  <div className="small ink2">{lib.find((k) => k.code === r.competency)?.name}</div>
                  <div className="small muted">Shart: {r.needs.map((n) => c.components.find((x) => x.id === n)?.title || n).join(' + ')}{r.note ? ` · ${r.note}` : ''}</div>
                  {editable && <button className="link-btn" onClick={() => upd(c, (y) => { y.rules.splice(i, 1); })}>olib tashlash</button>}
                </div>
              ))}
              {!c.rules.length && <Empty>Qoida yo‘q.</Empty>}
            </div>
          </Panel>
          {editable && <AddRule s={s} c={c} />}
        </div>
      </div>
    </>
  );
}
