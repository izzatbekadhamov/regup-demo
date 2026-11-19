import { useState } from 'react';
import { useAppState, run } from '../state/store.js';
import { Panel, Pill, Person, Empty, fmtDate } from '../ui/common.jsx';
import * as D from '../core/domain.js';
import { levelName } from '../core/modelKit.js';

const GRADES = { 5: 'A’lo — mezonlarning barchasi, mustaqil', 4: 'Yaxshi — mezonlar bajarilgan, kichik kamchilik', 3: 'Qoniqarli — asosiy mezonlar bor, tuzatish kerak', 2: 'Past — mezonlarning ko‘pi yo‘q', 1: 'Bajarilmagan darajada' };

function Item({ s, e, cid, p, user }) {
  const course = D.getCourse(s, e.courseId);
  const comp = course.components.find((c) => c.id === cid);
  const rules = course.rules.filter((r) => r.needs.includes(cid));
  const cap = Math.max(0, ...rules.map((r) => r.level));
  const [f, setF] = useState({ level: String(cap), grade: '4', note: '' });
  const emp = D.getEmployee(s, e.employeeId);
  const who = D.taskReviewer(s, e);
  const args = { enrollmentId: e.id, componentId: cid, note: f.note, mentor: user.role === 'super' ? 'HR/L&D' : user.name, reviewerId: user.id };
  return (
    <div className="idp-row">
      <div className="row between">
        <Person name={emp.name} sub={`${course.title} · yuborilgan ${fmtDate(p.submittedAt)}`} />
        <div className="row">{course.onboarding && <Pill tone="brand">moslashuv kursi</Pill>}<Pill tone="muted">tekshiradi: {who.kind === 'curator' ? `kurator ${who.user.name}` : who.kind === 'mentor' ? `mentor ${who.user.name}` : 'HR'}</Pill></div>
      </div>
      <div className="small"><b>{comp.title}.</b> <span className="ink2">Mezon: {comp.criteria}</span></div>
      <div className="callout small"><b>Xodim yuborgan natija:</b> {p.text}{p.link && <div className="code" style={{ marginTop: 4 }}>{p.link}</div>}</div>
      <div className="row">
        {course.onboarding && (
          <label className="f">Baho (1–5)
            <select className="i compact" value={f.grade} onChange={(ev) => setF({ ...f, grade: ev.target.value })}>{[5, 4, 3, 2, 1].map((g) => <option key={g} value={g}>{g} — {GRADES[g]}</option>)}</select>
          </label>
        )}
        {cap > 0 && (
          <label className="f">Kompetensiya darajasi
            <select className="i compact" value={f.level} onChange={(ev) => setF({ ...f, level: ev.target.value })}>{Array.from({ length: cap }, (_, i) => cap - i).map((l) => <option key={l} value={l}>{l} — {levelName(null, l)}</option>)}</select>
          </label>
        )}
        <label className="f" style={{ flex: 1, minWidth: 240 }}>Xulosa<input className="i" placeholder="Qaysi mezon bajarildi, nimani tuzatish kerak" value={f.note} onChange={(ev) => setF({ ...f, note: ev.target.value })} /></label>
      </div>
      <div className="row">
        <button className="btn primary sm" disabled={!f.note.trim()} onClick={() => run(D.reviewTask, { ...args, decision: 'accepted', level: Number(f.level), grade: Number(f.grade) }, 'Topshiriq qabul qilindi')}>Qabul qilish</button>
        <button className="btn danger sm" disabled={!f.note.trim()} onClick={() => run(D.reviewTask, { ...args, decision: 'returned' }, 'Topshiriq qaytarildi')}>Qaytarish</button>
      </div>
    </div>
  );
}

export default function TaskQueue({ user }) {
  const s = useAppState();
  const items = s.enrollments.filter((e) => e.status !== 'archived' && D.canReviewTask(s, user, e))
    .flatMap((e) => Object.entries(e.progress).filter(([, p]) => p.status === 'pending').map(([cid, p]) => ({ e, cid, p })));
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Topshiriqlarni tekshirish</h1>
          <p>Bitta topshiriqni bitta mas’ul tekshiradi: kursga kurator biriktirilgan bo‘lsa — kurator, aks holda xodimning mentori. Moslashuv kursida 1–5 baho qo‘yiladi (30 kunlik bahoga kiradi), boshqa kurslarda kompetensiya darajasi.</p>
          {!D.can(user, 'courses.manage') && <p className="small muted">{user.title}: faqat siz tekshiradigan topshiriqlar.</p>}
        </div>
      </div>
      <Panel tight title={<div className="row"><h2>Tekshiruv navbati</h2><span className="muted small">{items.length} ta</span></div>}>
        {items.length ? <div className="stack panel-body">{items.map(({ e, cid, p }) => <Item key={e.id + cid} s={s} e={e} cid={cid} p={p} user={user} />)}</div> : <Empty icon="check">Tekshiriladigan topshiriq yo‘q.</Empty>}
      </Panel>
    </>
  );
}
