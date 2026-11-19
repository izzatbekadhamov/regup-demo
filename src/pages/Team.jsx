import { useAppState, run } from '../state/store.js';
import { Panel, Pill, Avatar, fmtDate } from '../ui/common.jsx';
import * as D from '../core/domain.js';

const POS = { GE: 'Ustoz (GE)', FIN: 'Moliya menejeri', FR: 'Filial rahbari', ADM: 'Markaz admini' };
function Checks({ label, items, value, onChange }) {
  return (
    <div>
      <div className="small muted">{label}</div>
      <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
        {items.map(([k, l]) => { const on = value.includes(k); return <label key={k} className="row small" style={{ gap: 4 }}><input type="checkbox" checked={on} onChange={() => onChange(on ? value.filter((x) => x !== k) : [...value, k])} /> {l}</label>; })}
      </div>
    </div>
  );
}

/** Adminlar: har bir shaxsga alohida huquqlar va doira — filial, bo'lim yoki lavozim (TZ'dagi qat'iy rollar o'rniga). */
export default function Team({ user, focus }) {
  const s = useAppState();
  const u = D.getStaff(s, focus) || s.staff.find((x) => x.role !== 'super');
  const isSuper = u.role === 'super';
  const n = isSuper ? D.ALL_RIGHTS.length : (u.rights || []).length;
  const sc = u.scope || { kind: 'all' };
  const setScope = (x) => run(D.setStaffScope, { userId: u.id, kind: x.kind, branchIds: x.branchIds || [], departmentIds: x.departmentIds || [], positions: x.positions || [], actor: user.name });
  const positions = [...new Set(s.employees.map((e) => e.position))];
  const toggle = (right, on) => run(D.setStaffRight, { userId: u.id, right, on, actor: user.name });
  const setGroup = (list, on) => list.forEach(([k]) => { if ((u.rights || []).includes(k) !== on) toggle(k, on); });
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Adminlar</h1>
          <p>Huquqlar qat’iy rolga emas, shaxsga beriladi. Filialdagi holatga qarab bir vazifani turli lavozimdagi odam bajarishi mumkin. Har bir huquq tanlangan doirada ishlaydi: bir yoki bir nechta filial, bo‘lim yoki barcha filiallardagi bir lavozim (masalan, barcha GE ustozlari). Barcha xodimlar «Umumiy jamoa a’zolari» bo‘limida.</p>
        </div>
      </div>
      <div className="grid" style={{ gridTemplateColumns: 'minmax(220px, 280px) 1fr', alignItems: 'start' }}>
        <Panel title="Adminlar">
          <div className="stack" style={{ gap: 4 }}>
            {s.staff.map((x) => (
              <a key={x.id} href={`#/team/${x.id}`} className={`team-row ${x.id === u.id ? 'on' : ''}`}>
                <Avatar name={x.role === 'super' ? 'HR LD' : x.name} />
                <span><b>{x.name}</b><span className="small muted" style={{ display: 'block' }}>{x.title}</span></span>
                {x.active === false && <Pill tone="muted">nofaol</Pill>}
              </a>
            ))}
          </div>
        </Panel>

        <div className="stack">
          <Panel title={<div className="row" style={{ gap: 12 }}><Avatar name={isSuper ? 'HR LD' : u.name} /><div><h2 style={{ margin: 0 }}>{u.name}</h2><div className="small muted">{u.title} · shablon: {D.ROLE_LABEL[u.role]}</div></div></div>}
            actions={!isSuper && (
              <div className="row" style={{ gap: 6 }}>
                <Pill tone={u.active === false ? 'muted' : 'good'}>{u.active === false ? 'Nofaol' : 'Faol'}</Pill>
                <button className="btn sm" onClick={() => run(D.setStaffActive, { userId: u.id, active: u.active === false, actor: user.name })}>{u.active === false ? 'Faollashtirish' : 'Nofaol qilish'}</button>
              </div>
            )}>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <Pill tone="brand">{n} ta huquq berilgan</Pill>
              {u.changedAt && <span className="small muted">{fmtDate(u.changedAt)} o‘zgartirildi</span>}
              {isSuper && <span className="small muted">Super Admin barcha huquqlarga ega va barcha filiallarni ko‘radi.</span>}
            </div>
            {!isSuper && (
              <div className="stack" style={{ marginTop: 12 }}>
                <h3 className="small" style={{ margin: 0 }}>Doira: qaysi xodimlar ko‘rinadi</h3>
                <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
                  {Object.entries(D.SCOPE_LABEL).map(([k, l]) => (
                    <label key={k} className="row small" style={{ gap: 6 }}>
                      <input type="radio" name="scope" checked={sc.kind === k} onChange={() => setScope({ kind: k, branchIds: k === 'branches' ? (sc.branchIds?.length ? sc.branchIds : u.branchIds || [s.branches[0].id]) : k === 'all' || k === 'assigned' ? [] : sc.branchIds || [], departmentIds: sc.departmentIds?.length ? sc.departmentIds : [s.departments[0].id], positions: sc.positions?.length ? sc.positions : ['GE'] })} /> {l}
                    </label>
                  ))}
                </div>
                {sc.kind === 'departments' && <Checks label="Bo‘limlar" items={s.departments.map((d) => [d.id, d.name])} value={sc.departmentIds || []} onChange={(v) => setScope({ ...sc, departmentIds: v })} />}
                {sc.kind === 'positions' && <Checks label="Lavozimlar" items={positions.map((p) => [p, POS[p] || p])} value={sc.positions || []} onChange={(v) => setScope({ ...sc, positions: v })} />}
                {['branches', 'departments', 'positions'].includes(sc.kind) && <Checks label={sc.kind === 'branches' ? 'Filiallar' : 'Filiallar (tanlanmasa — barcha filiallarda)'} items={s.branches.map((b) => [b.id, b.name])} value={sc.branchIds || []} onChange={(v) => setScope({ ...sc, branchIds: v })} />}
                <div className="small muted">Hozir: {D.scopeText(s, sc)} · {(() => { const ids = D.scopeEmployees(s, u); return ids === null ? 'barcha xodimlar' : `${ids.size} ta xodim`; })()}</div>
                {sc.kind === 'assigned' && <div className="small muted">Mentor yoki buddy sifatida biriktirilgan xodimlar{u.positions?.length ? `, lavozimlar: ${u.positions.join(', ')}` : ''}{u.courseIds?.length ? `, kurslar: ${u.courseIds.length} ta` : ''}.</div>}
              </div>
            )}
          </Panel>

          {D.RIGHTS.map(([group, list]) => {
            const all = isSuper || list.every(([k]) => (u.rights || []).includes(k));
            return (
              <Panel key={group} title={<div className="row" style={{ gap: 12 }}><h2 className="caps" style={{ margin: 0 }}>{group}</h2>{!isSuper && <button className="link-btn small" onClick={() => setGroup(list, !all)}>{all ? 'Barchasini olib tashlash' : 'Barchasini tanlash'}</button>}</div>}>
                <div className="stack" style={{ gap: 8 }}>
                  {list.map(([k, l, hint]) => {
                    const on = isSuper || (u.rights || []).includes(k);
                    return (
                      <label key={k} className={`right-row ${on ? 'on' : ''}`}>
                        <input type="checkbox" checked={on} disabled={isSuper} onChange={() => toggle(k, !on)} />
                        <span><b>{l}</b><span className="small muted" style={{ display: 'block' }}>{hint}</span></span>
                      </label>
                    );
                  })}
                </div>
              </Panel>
            );
          })}
        </div>
      </div>
    </>
  );
}
