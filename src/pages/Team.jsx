import { useAppState, run } from '../state/store.js';
import { Panel, Pill, Avatar, fmtDate } from '../ui/common.jsx';
import * as D from '../core/domain.js';

/** Jamoa a'zolari: har bir shaxsga alohida huquqlar va filial doirasi (TZ'dagi qat'iy rollar o'rniga). */
export default function Team({ user, focus }) {
  const s = useAppState();
  const u = D.getStaff(s, focus) || s.staff.find((x) => x.role !== 'super');
  const isSuper = u.role === 'super';
  const n = isSuper ? D.ALL_RIGHTS.length : (u.rights || []).length;
  const sc = u.scope || { kind: 'all' };
  const toggle = (right, on) => run(D.setStaffRight, { userId: u.id, right, on, actor: user.name });
  const setGroup = (list, on) => list.forEach(([k]) => { if ((u.rights || []).includes(k) !== on) toggle(k, on); });
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Jamoa a’zolari</h1>
          <p>Huquqlar qat’iy rolga emas, shaxsga beriladi. Filialdagi holatga qarab bir vazifani turli lavozimdagi odam bajarishi mumkin. Har bir huquq tanlangan filial doirasida ishlaydi.</p>
        </div>
      </div>
      <div className="grid" style={{ gridTemplateColumns: 'minmax(220px, 280px) 1fr', alignItems: 'start' }}>
        <Panel title="Jamoa">
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
                <h3 className="small" style={{ margin: 0 }}>Filial doirasi</h3>
                <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
                  {Object.entries(D.SCOPE_LABEL).map(([k, l]) => (
                    <label key={k} className="row small" style={{ gap: 6 }}>
                      <input type="radio" name="scope" checked={sc.kind === k} onChange={() => run(D.setStaffScope, { userId: u.id, kind: k, branchIds: k === 'branches' ? (sc.branchIds?.length ? sc.branchIds : u.branchIds || [s.branches[0].id]) : [], actor: user.name })} /> {l}
                    </label>
                  ))}
                </div>
                {sc.kind === 'branches' && (
                  <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
                    {s.branches.map((b) => {
                      const on = (sc.branchIds || []).includes(b.id);
                      return (
                        <label key={b.id} className="row small" style={{ gap: 4 }}>
                          <input type="checkbox" checked={on} onChange={() => run(D.setStaffScope, { userId: u.id, kind: 'branches', branchIds: on ? sc.branchIds.filter((x) => x !== b.id) : [...sc.branchIds, b.id], actor: user.name })} /> {b.name}
                        </label>
                      );
                    })}
                  </div>
                )}
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
