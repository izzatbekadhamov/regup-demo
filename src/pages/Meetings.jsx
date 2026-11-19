import { useState } from 'react';
import { useAppState, run } from '../state/store.js';
import { Panel, Pill, Person, Empty, fmtDate } from '../ui/common.jsx';
import * as D from '../core/domain.js';

function NewMeeting({ user, onDone }) {
  const s = useAppState();
  const manage = D.can(user, 'onb.meetings') && D.scopeEmployees(s, user) === null;
  const [f, setF] = useState({ title: '', kind: manage ? 'ceo' : 'share', date: D.addDays(s.today, 7), time: '15:00', format: 'online', link: '', place: '' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <Panel title="Yangi uchrashuv" actions={<button className="btn sm" onClick={onDone}>Yopish</button>}>
      <div className="grid g3">
        <label className="f" style={{ gridColumn: 'span 2' }}>Nomi<input className="i" placeholder={f.kind === 'ceo' ? 'CEO va HRD bilan uchrashuv — Dekabr' : 'Bilim almashish: …'} value={f.title} onChange={set('title')} /></label>
        <label className="f">Turi<select className="i" value={f.kind} onChange={set('kind')} disabled={!manage}><option value="ceo">CEO va HRD bilan (moslashuv)</option><option value="share">Bilim almashish</option></select></label>
        <label className="f">Sana<input className="i" type="date" value={f.date} onChange={set('date')} /></label>
        <label className="f">Vaqt<input className="i" type="time" value={f.time} onChange={set('time')} /></label>
        <label className="f">Shakl<select className="i" value={f.format} onChange={set('format')}><option value="online">Onlayn</option><option value="offline">Oflayn</option></select></label>
        {f.format === 'online' ? <label className="f" style={{ gridColumn: 'span 3' }}>Havola<input className="i" placeholder="https://meet.google.com/…" value={f.link} onChange={set('link')} /></label>
          : <label className="f" style={{ gridColumn: 'span 3' }}>Joy<input className="i" placeholder="Bosh ofis, majlislar zali" value={f.place} onChange={set('place')} /></label>}
      </div>
      <div className="row" style={{ marginTop: 10 }}>
        <button className="btn primary" onClick={() => run(D.createMeeting, { ...f, organizer: `${user.name}${user.role === 'hr' ? ' (HR Admin)' : ''}`, actor: user.name }, 'Uchrashuv yaratildi') && onDone()}>Yaratish</button>
        <span className="small muted">Keyin xodimlarni filtr bo‘yicha tanlab taklif yuborasiz — havola platforma va Telegram orqali boradi.</span>
      </div>
    </Panel>
  );
}

function Invite({ s, m, user }) {
  const [f, setF] = useState({ branch: '', position: '', onlyOnb: m.kind === 'ceo', notMet: m.kind === 'ceo' });
  const [pick, setPick] = useState(null);
  const cands = D.activeEmployees(s).filter((e) => !m.invited.includes(e.id) && (!f.branch || e.branchId === f.branch) && (!f.position || e.position === f.position)
    && (!f.onlyOnb || D.onboardingOf(s, e.id)?.status === 'active' || (D.onboardingOf(s, e.id) && D.daysBetween(D.onboardingOf(s, e.id).startedAt, s.today) <= 60))
    && (!f.notMet || !s.meetings.some((x) => x.kind === 'ceo' && x.attended.includes(e.id))));
  const sel = pick ?? cands.map((e) => e.id);
  return (
    <div className="panel add-box">
      <b className="small">Taklif yuborish — xodimlarni filtr bilan tanlang</b>
      <div className="row" style={{ marginTop: 6 }}>
        <select className="i compact" value={f.branch} onChange={(e) => { setF({ ...f, branch: e.target.value }); setPick(null); }}><option value="">Barcha filiallar</option>{s.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
        <select className="i compact" value={f.position} onChange={(e) => { setF({ ...f, position: e.target.value }); setPick(null); }}><option value="">Barcha lavozimlar</option><option value="GE">Ustoz (GE)</option><option value="FIN">Moliya menejeri</option><option value="FR">Filial rahbari</option></select>
        <label className="chk"><input type="checkbox" checked={f.onlyOnb} onChange={(e) => { setF({ ...f, onlyOnb: e.target.checked }); setPick(null); }} /> Moslashuvdagi yangi xodimlar</label>
        <label className="chk"><input type="checkbox" checked={f.notMet} onChange={(e) => { setF({ ...f, notMet: e.target.checked }); setPick(null); }} /> CEO uchrashuvida hali qatnashmagan</label>
      </div>
      <div className="row" style={{ marginTop: 8, gap: 6 }}>
        {cands.map((e) => <label key={e.id} className={`chip-pick ${sel.includes(e.id) ? 'on' : ''}`}><input type="checkbox" checked={sel.includes(e.id)} onChange={(ev) => setPick(ev.target.checked ? [...sel, e.id] : sel.filter((x) => x !== e.id))} /> {e.name} <span className="muted">· {D.getBranch(s, e.branchId)?.name}</span></label>)}
        {!cands.length && <span className="small muted">Filtrga mos xodim yo‘q.</span>}
      </div>
      <div className="row" style={{ marginTop: 8 }}>
        <button className="btn primary sm" disabled={!sel.length} onClick={() => run(D.inviteToMeeting, { id: m.id, employeeIds: sel, actor: user.name }, `${sel.length} ta xodimga taklif yuborildi`) && setPick(null)}>Taklif va havolani yuborish ({sel.length})</button>
        <span className="small muted">Platforma + Telegram</span>
      </div>
    </div>
  );
}

function MeetingCard({ s, m, user }) {
  const [open, setOpen] = useState(m.kind === 'ceo' && m.date >= s.today);
  const past = m.date <= s.today;
  const canEdit = (D.can(user, 'onb.meetings') && D.scopeEmployees(s, user) === null) || m.organizer?.startsWith(user.name);
  return (
    <Panel title={<div><div className="row"><h2>{m.title}</h2>{m.kind === 'ceo' ? <Pill tone="brand">CEO va HRD</Pill> : <Pill tone="teal">bilim almashish</Pill>}{past ? <Pill tone="muted">o‘tgan</Pill> : <Pill tone="good">rejada</Pill>}</div>
      <div className="muted small">{fmtDate(m.date)}, {m.time} · {m.format === 'online' ? <>onlayn · <span className="code">{m.link}</span></> : `oflayn · ${m.place}`} · tashkilotchi: {m.organizer}</div></div>}
      actions={<button className="btn sm" onClick={() => setOpen(!open)}>{open ? 'Yopish' : 'Ochish'}</button>}>
      <div className="small">Taklif qilingan: <b>{m.invited.length}</b>{past && <> · qatnashdi: <b>{m.attended.length}</b></>}</div>
      {open && (
        <div className="stack" style={{ marginTop: 8 }}>
          {m.invited.length > 0 && (
            <table>
              <tbody>{m.invited.map((id) => {
                const e = D.getEmployee(s, id);
                const ob = D.onboardingOf(s, id);
                return (
                  <tr key={id}>
                    <td><Person name={e.name} sub={`${e.currentLevel} · ${D.getBranch(s, e.branchId)?.name}${e.status === 'archived' ? ' · arxivda' : ''}`} /></td>
                    <td className="small muted">{ob ? `moslashuv: ${ob.status === 'active' ? `${D.onbDay(s, ob)}-kun` : ob.status === 'completed' ? 'yakunlangan' : 'to‘xtatilgan'}` : ''}</td>
                    <td className="num">{past ? (canEdit ? <label className="chk"><input type="checkbox" checked={m.attended.includes(id)} onChange={(ev) => run(D.markAttendance, { id: m.id, employeeId: id, attended: ev.target.checked, actor: user.name }, ev.target.checked ? 'Qatnashuv belgilandi' : 'Qatnashuv olib tashlandi')} /> qatnashdi</label> : (m.attended.includes(id) ? '✓' : '—')) : <span className="small muted">taklif yuborilgan</span>}</td>
                  </tr>
                );
              })}</tbody>
            </table>
          )}
          {!past && canEdit && <Invite s={s} m={m} user={user} />}
          {past && <div className="small muted">Qatnashuv moslashuv hisobotida ko‘rinadi.</div>}
        </div>
      )}
    </Panel>
  );
}

export default function Meetings({ user }) {
  const s = useAppState();
  const [creating, setCreating] = useState(false);
  const list = [...s.meetings].sort((a, b) => (a.date < b.date ? 1 : -1));
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Uchrashuvlar</h1>
          <p>Bir oy ishlagan yangi xodimlar CEO va HRD bilan uchrashadi: kompaniya haqida taqdimot (onlayn yoki oflayn). Jadvalni HR Admin boshqaradi. Boshqa xodimlar ham bilim almashish uchrashuvlarini tashkil qila oladi.</p>
        </div>
        {!creating && <button className="btn primary" onClick={() => setCreating(true)}>+ Uchrashuv</button>}
      </div>
      {creating && <NewMeeting user={user} onDone={() => setCreating(false)} />}
      {list.length ? list.map((m) => <MeetingCard key={m.id} s={s} m={m} user={user} />) : <Empty>Uchrashuv yo‘q.</Empty>}
    </>
  );
}
