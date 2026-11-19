import { useState } from 'react';
import { useAppState } from '../state/store.js';
import { Panel, Avatar, Empty } from '../ui/common.jsx';
import * as D from '../core/domain.js';
import { positionName } from '../core/modelKit.js';
import Profile from './Profile.jsx';

const POS = { GE: 'Ustoz (GE)', FIN: 'Moliya menejeri', FR: 'Filial rahbari', ADM: 'Markaz admini' };

/** Jamoadoshlar: xodim sukut bo'yicha o'z filialidagi barcha xodimlarni ko'radi; doira admin tomonidan sozlanadi. */
export default function Colleagues({ emp, focus }) {
  const s = useAppState();
  const all = D.colleaguesOf(s, emp);
  const [f, setF] = useState({ q: '', branch: '', dept: '', position: '' });
  const [open, setOpen] = useState(focus || null);
  const list = all.filter((e) => (!f.branch || e.branchId === f.branch) && (!f.dept || e.departmentId === f.dept) && (!f.position || e.position === f.position) && (!f.q || e.name.toLowerCase().includes(f.q.toLowerCase())));
  const cur = open && all.find((e) => e.id === open);
  const branches = [...new Set(all.map((e) => e.branchId))];
  const depts = [...new Set(all.map((e) => e.departmentId).filter(Boolean))];
  const positions = [...new Set(all.map((e) => e.position))];
  const sc = emp.colleagues || { kind: 'branch' };
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Jamoadoshlar</h1>
          <p>{sc.kind === 'department' ? `${D.getBranch(s, emp.branchId)?.name} filialidagi ${D.getDepartment(s, emp.departmentId)?.name || 'bo‘limingiz'} xodimlari` : sc.kind === 'branches' ? `${[emp.branchId, ...sc.branchIds].map((b) => D.getBranch(s, b)?.name).join(', ')} filiallari xodimlari` : `${D.getBranch(s, emp.branchId)?.name} filialidagi barcha xodimlar`} · {all.length} ta. Kartani bosing — profil, yakunlangan kurslar, yutuqlar va badge’lar.</p>
        </div>
      </div>
      <div className="filter-row">
        <input className="i compact" placeholder="Ism" style={{ width: 140 }} value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
        {branches.length > 1 && <select className="i compact" value={f.branch} onChange={(e) => setF({ ...f, branch: e.target.value })}><option value="">Barcha filiallar</option>{branches.map((b) => <option key={b} value={b}>{D.getBranch(s, b)?.name}</option>)}</select>}
        <select className="i compact" value={f.dept} onChange={(e) => setF({ ...f, dept: e.target.value })}><option value="">Barcha bo‘limlar</option>{depts.map((d) => <option key={d} value={d}>{D.getDepartment(s, d)?.name}</option>)}</select>
        <select className="i compact" value={f.position} onChange={(e) => setF({ ...f, position: e.target.value })}><option value="">Barcha lavozimlar</option>{positions.map((p) => <option key={p} value={p}>{POS[p] || p}</option>)}</select>
      </div>
      <div className="grid" style={{ gridTemplateColumns: cur ? 'minmax(0,1fr) minmax(320px, 420px)' : '1fr', alignItems: 'start' }}>
        {list.length ? (
          <div className="mate-grid">
            {list.map((e) => (
              <button key={e.id} className={`mate ${open === e.id ? 'on' : ''}`} onClick={() => setOpen(open === e.id ? null : e.id)}>
                <Avatar name={e.name} size="lg" />
                <b>{e.name}</b>
                <span className="small muted">{positionName(s.models, e.currentLevel)}</span>
                <span className="small muted">{D.getBranch(s, e.branchId)?.name} · {D.getDepartment(s, e.departmentId)?.name || '—'}</span>
                <span className="mate-badges">{D.employeeBadges(s, e.id).map((b) => <span key={b.id} title={b.name}>{b.icon}</span>)}</span>
              </button>
            ))}
          </div>
        ) : <Panel><Empty>Filtr bo‘yicha jamoadosh yo‘q.</Empty></Panel>}
        {cur && <Panel className="sticky" title={<div className="row between" style={{ width: '100%' }}><h2>Profil</h2><button className="btn sm" onClick={() => setOpen(null)}>Yopish</button></div>}><Profile s={s} emp={cur} mode="colleague" /></Panel>}
      </div>
    </>
  );
}
