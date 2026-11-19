import { useState } from 'react';
import { useAppState, run } from '../state/store.js';
import { Panel, Pill, Person, Empty } from '../ui/common.jsx';
import * as D from '../core/domain.js';
import { positionName } from '../core/modelKit.js';
import Profile from './Profile.jsx';

const POS = { GE: 'Ustoz (GE)', FIN: 'Moliya menejeri', FR: 'Filial rahbari', ADM: 'Markaz admini' };

function OrgStructure({ s, user }) {
  const [f, setF] = useState({ id: null, name: '', branchIds: [] });
  const edit = (d) => setF({ id: d.id, name: d.name, branchIds: d.branchIds || [] });
  return (
    <div className="grid g2" style={{ alignItems: 'start' }}>
      <Panel tight title={<div><h2>Bo‘limlar</h2><div className="muted small">Tashkiliy tuzilma LMS’da qo‘lda yuritiladi: filial → bo‘lim. Xodim ma’lumotlari EduTizim’dan keladi.</div></div>}>
        <table>
          <thead><tr><th>Bo‘lim</th><th>Filiallar</th><th className="num">Xodim</th><th /></tr></thead>
          <tbody>{s.departments.map((d) => (
            <tr key={d.id}>
              <td><b>{d.name}</b></td>
              <td className="small">{d.branchIds?.length ? d.branchIds.map((b) => D.getBranch(s, b)?.name).join(', ') : 'barcha filiallar'}</td>
              <td className="num">{D.activeEmployees(s).filter((e) => e.departmentId === d.id).length}</td>
              <td className="num"><span className="row" style={{ gap: 4, justifyContent: 'flex-end' }}><button className="btn sm" onClick={() => edit(d)}>Tahrirlash</button><button className="btn sm" onClick={() => run(D.removeDepartment, { id: d.id, userId: user.id }, 'Bo‘lim o‘chirildi')}>O‘chirish</button></span></td>
            </tr>
          ))}</tbody>
        </table>
      </Panel>
      <Panel title={f.id ? 'Bo‘limni tahrirlash' : 'Yangi bo‘lim'}>
        <div className="stack">
          <input className="i" placeholder="Bo‘lim nomi" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          <div className="small muted">Qaysi filiallarda bor (tanlanmasa — barcha filiallarda)</div>
          <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>{s.branches.map((b) => { const on = f.branchIds.includes(b.id); return <label key={b.id} className="row small" style={{ gap: 4 }}><input type="checkbox" checked={on} onChange={() => setF({ ...f, branchIds: on ? f.branchIds.filter((x) => x !== b.id) : [...f.branchIds, b.id] })} /> {b.name}</label>; })}</div>
          <div className="row" style={{ gap: 6 }}>
            <button className="btn primary sm" onClick={() => run(D.saveDepartment, { ...f, userId: user.id }, 'Saqlandi') && setF({ id: null, name: '', branchIds: [] })}>Saqlash</button>
            {f.id && <button className="btn sm" onClick={() => setF({ id: null, name: '', branchIds: [] })}>Bekor qilish</button>}
          </div>
        </div>
      </Panel>
    </div>
  );
}

function Settings({ s, emp, user }) {
  const sc = emp.colleagues || { kind: 'branch' };
  const [br, setBr] = useState(sc.branchIds || []);
  return (
    <div className="panel add-box">
      <b className="small">Tashkiliy sozlamalar</b>
      <div className="row small" style={{ gap: 8, marginTop: 6 }}>Bo‘lim
        <select className="i compact" value={emp.departmentId || ''} onChange={(e) => run(D.setEmployeeDepartment, { employeeId: emp.id, departmentId: e.target.value, userId: user.id }, 'Bo‘lim saqlandi')}>
          <option value="" disabled>—</option>{D.branchDepartments(s, emp.branchId).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>
      <div className="small" style={{ marginTop: 8 }}>Jamoadoshlar doirasi — xodim kabinetida kimlarni ko‘radi</div>
      <div className="row small" style={{ gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
        {Object.entries(D.COLLEAGUE_SCOPE).map(([k, l]) => <label key={k} className="row" style={{ gap: 4 }}><input type="radio" name={`col-${emp.id}`} checked={sc.kind === k} onChange={() => k !== 'branches' && run(D.setColleaguesScope, { employeeId: emp.id, kind: k, userId: user.id }, 'Doira saqlandi')} /> {l}</label>)}
      </div>
      <div className="row small" style={{ gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
        {s.branches.filter((b) => b.id !== emp.branchId).map((b) => { const on = br.includes(b.id); return <label key={b.id} className="row" style={{ gap: 4 }}><input type="checkbox" checked={on} onChange={() => setBr(on ? br.filter((x) => x !== b.id) : [...br, b.id])} /> {b.name}</label>; })}
        <button className="btn sm" disabled={!br.length} onClick={() => run(D.setColleaguesScope, { employeeId: emp.id, kind: 'branches', branchIds: br, userId: user.id }, 'Doira saqlandi')}>Bir necha filialni saqlash</button>
      </div>
      <div className="small muted" style={{ marginTop: 4 }}>Hozir: {D.COLLEAGUE_SCOPE[sc.kind]}{sc.kind === 'branches' ? ` + ${sc.branchIds.map((b) => D.getBranch(s, b)?.name).join(', ')}` : ''} · {D.colleaguesOf(s, emp).length} ta jamoadosh</div>
    </div>
  );
}

export default function People({ user, focus }) {
  const s = useAppState();
  const scope = D.scopeEmployees(s, user);
  const orgAdmin = D.can(user, 'org.manage');
  const [tab, setTab] = useState('list');
  const [f, setF] = useState({ q: '', branch: '', dept: '', position: '' });
  const [open, setOpen] = useState(focus || null);
  const mine = D.activeEmployees(s).filter((e) => !scope || scope.has(e.id));
  const list = mine.filter((e) => (!f.branch || e.branchId === f.branch) && (!f.dept || e.departmentId === f.dept) && (!f.position || e.position === f.position) && (!f.q || e.name.toLowerCase().includes(f.q.toLowerCase())));
  const cur = open && mine.find((e) => e.id === open);
  const positions = [...new Set(mine.map((e) => e.position))];
  const branches = [...new Set(mine.map((e) => e.branchId))];
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Umumiy jamoa a’zolari</h1>
          <p>Doirangizdagi barcha xodimlar: {scope === null ? 'barcha filiallar' : D.scopeText(s, user.scope)} · {mine.length} ta. Xodim ma’lumotlari EduTizim’dan keladi; to‘liq foydalanuvchi tarixi faqat adminlarga ko‘rinadi.</p>
        </div>
      </div>
      {orgAdmin && <div className="tabs">{[['list', 'Xodimlar'], ['org', 'Tashkiliy tuzilma']].map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>}
      {tab === 'org' && orgAdmin ? <OrgStructure s={s} user={user} /> : (
        <div className="grid" style={{ gridTemplateColumns: cur ? 'minmax(0,1fr) minmax(340px, 460px)' : '1fr', alignItems: 'start' }}>
          <Panel tight title={<div className="row"><h2>Xodimlar</h2><span className="muted small">{list.length} ta</span></div>} actions={
            <div className="row">
              <input className="i compact" placeholder="Ism" style={{ width: 120 }} value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
              <select className="i compact" value={f.branch} onChange={(e) => setF({ ...f, branch: e.target.value })}><option value="">Barcha filiallar</option>{branches.map((b) => <option key={b} value={b}>{D.getBranch(s, b)?.name}</option>)}</select>
              <select className="i compact" value={f.dept} onChange={(e) => setF({ ...f, dept: e.target.value })}><option value="">Barcha bo‘limlar</option>{s.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
              <select className="i compact" value={f.position} onChange={(e) => setF({ ...f, position: e.target.value })}><option value="">Barcha lavozimlar</option>{positions.map((p) => <option key={p} value={p}>{POS[p] || p}</option>)}</select>
            </div>}>
            {list.length ? (
              <table>
                <thead><tr><th>Xodim</th><th>Bo‘lim</th><th>Telefon</th><th className="num">Kurslar</th><th className="num">Ball</th></tr></thead>
                <tbody>{list.map((e) => {
                  const h = D.userHistory(s, e.id);
                  return (
                    <tr key={e.id} className={`clickable ${open === e.id ? 'row-me' : ''}`} onClick={() => setOpen(open === e.id ? null : e.id)}>
                      <td><Person name={e.name} sub={`${positionName(s.models, e.currentLevel)} · ${D.getBranch(s, e.branchId)?.name}`} /></td>
                      <td className="small">{D.getDepartment(s, e.departmentId)?.name || <span className="muted">—</span>}</td>
                      <td className="small">{e.profile?.phone || e.phone || '—'}</td>
                      <td className="num">{h.filter((x) => x.completedAt).length} / {h.length}</td>
                      <td className="num">{D.employeePoints(s, e.id).total}</td>
                    </tr>
                  );
                })}</tbody>
              </table>
            ) : <Empty>Filtr bo‘yicha xodim yo‘q.</Empty>}
          </Panel>
          {cur && (
            <Panel className="sticky" title={<div className="row between" style={{ width: '100%' }}><h2>Profil</h2><button className="btn sm" onClick={() => setOpen(null)}>Yopish</button></div>}>
              <Profile s={s} emp={cur} mode="admin" />
              {orgAdmin && <Settings key={cur.id + JSON.stringify(cur.colleagues || {})} s={s} emp={cur} user={user} />}
            </Panel>
          )}
        </div>
      )}
      {!orgAdmin && <Pill tone="muted">Tashkiliy tuzilmani «Tashkiliy tuzilma» huquqi bor admin yuritadi.</Pill>}
    </>
  );
}
