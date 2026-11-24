import { useState } from 'react';
import { useAppState, run } from '../state/store.js';
import { Panel, Pill, Empty, fmtDate } from '../ui/common.jsx';
import * as D from '../core/domain.js';

/** Xodim: uchrashuv taklif qiladi (HR tasdiqlaydi) va tasdiqlangan bilim almashish uchrashuvlariga o'zi yoziladi. */
export default function MyMeetings({ emp }) {
  const s = useAppState();
  const [f, setF] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const open = s.meetings.filter((m) => m.kind === 'share' && D.meetingVisible(m) && m.date >= s.today).sort((a, b) => (a.date > b.date ? 1 : -1));
  const mine = s.meetings.filter((m) => m.proposerId === emp.id);
  const invited = s.meetings.filter((m) => m.kind === 'ceo' && m.invited.includes(emp.id));
  return (
    <>
      <div className="page-head">
        <div><h1>Uchrashuvlar</h1><p>Bilim almashish uchrashuvini istalgan xodim taklif qila oladi — HR tasdiqlagach e’lon qilinadi va xodimlar o‘zi xohlab yoziladi. CEO va HRD bilan uchrashuvga taklif HR’dan keladi.</p></div>
        {!f && <button className="btn primary" onClick={() => setF({ title: '', about: '', date: D.addDays(s.today, 7), time: '16:00', format: 'online', link: '', place: '' })}>+ Uchrashuv taklif qilish</button>}
      </div>
      {f && (
        <Panel title="Uchrashuv taklifi" actions={<button className="btn sm" onClick={() => setF(null)}>Yopish</button>}>
          <div className="grid g3">
            <label className="f" style={{ gridColumn: 'span 3' }}>Mavzu<input className="i" value={f.title} onChange={set('title')} placeholder="Bilim almashish: …" /></label>
            <label className="f" style={{ gridColumn: 'span 3' }}>Qisqacha<input className="i" value={f.about} onChange={set('about')} /></label>
            <label className="f">Sana<input className="i" type="date" value={f.date} onChange={set('date')} /></label>
            <label className="f">Vaqt<input className="i" type="time" value={f.time} onChange={set('time')} /></label>
            <label className="f">Shakl<select className="i" value={f.format} onChange={set('format')}><option value="online">Onlayn</option><option value="offline">Oflayn</option></select></label>
            {f.format === 'online' ? <label className="f" style={{ gridColumn: 'span 3' }}>Havola<input className="i" value={f.link} onChange={set('link')} placeholder="https://meet.google.com/…" /></label> : <label className="f" style={{ gridColumn: 'span 3' }}>Joy<input className="i" value={f.place} onChange={set('place')} /></label>}
          </div>
          <div className="row" style={{ marginTop: 10 }}><button className="btn primary" onClick={() => run(D.proposeMeeting, { employeeId: emp.id, ...f }, 'Taklif HR’ga yuborildi') && setF(null)}>Taklif yuborish</button><span className="small muted">HR’dagi admin tasdiqlaydi.</span></div>
        </Panel>
      )}
      {mine.length > 0 && <Panel title="Mening takliflarim" tight><table className="small"><tbody>{mine.map((m) => <tr key={m.id}><td><b>{m.title}</b><div className="muted">{fmtDate(m.date)}, {m.time}</div></td><td><Pill tone={m.status === 'approved' ? 'good' : m.status === 'rejected' ? 'bad' : 'warn'}>{m.status === 'approved' ? 'tasdiqlangan' : m.status === 'rejected' ? 'rad etilgan' : 'tasdiq kutilmoqda'}</Pill>{m.review?.note && <div className="muted">{m.review.note}</div>}</td><td className="num">yozilganlar: {m.invited.length}</td></tr>)}</tbody></table></Panel>}
      <Panel title="Yozilish ochiq uchrashuvlar" tight>
        {open.length ? <table className="small"><tbody>{open.map((m) => {
          const on = m.invited.includes(emp.id);
          return (
            <tr key={m.id}><td><b>{m.title}</b><div className="muted">{m.about || ''}</div></td><td className="muted">{fmtDate(m.date)}, {m.time} · {m.format === 'online' ? 'onlayn' : m.place} · {m.organizer}</td><td className="num">{m.invited.length} ta</td>
              <td className="num">{m.proposerId === emp.id ? <Pill tone="brand">tashkilotchi</Pill> : m.selfSignup ? <button className={`btn sm ${on ? '' : 'primary'}`} onClick={() => run(D.joinMeeting, { id: m.id, employeeId: emp.id, leave: on }, on ? 'Yozilish bekor qilindi' : 'Yozildingiz')}>{on ? 'Chiqish' : 'Yozilish'}</button> : on ? <Pill tone="good">taklif qilingan</Pill> : <span className="muted">taklif bilan</span>}</td></tr>
          );
        })}</tbody></table> : <Empty>Hozircha ochiq uchrashuv yo‘q.</Empty>}
      </Panel>
      {invited.length > 0 && <Panel title="CEO va HRD bilan uchrashuv" tight><table className="small"><tbody>{invited.map((m) => <tr key={m.id}><td><b>{m.title}</b></td><td className="muted">{fmtDate(m.date)}, {m.time} · {m.format === 'online' ? m.link : m.place}</td><td>{m.attended.includes(emp.id) ? <Pill tone="good">qatnashdi</Pill> : m.date >= s.today ? <Pill tone="brand">taklif qilingan</Pill> : <Pill tone="muted">qatnashmadi</Pill>}</td></tr>)}</tbody></table></Panel>}
    </>
  );
}
