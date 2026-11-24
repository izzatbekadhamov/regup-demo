import { useState } from 'react';
import { useAppState, run } from '../state/store.js';
import { Panel, Pill, Person, Empty, go, fmtDate } from '../ui/common.jsx';
import { cardDecision, getEmployee, getBranch, openCard, activeModel, roleInfo } from '../core/domain.js';
import * as D from '../core/domain.js';
import { fmtPct, isNum } from '../core/calc.js';
import { STAGE_LABELS } from '../data/models.js';
import { nextProfile } from '../core/modelKit.js';

function NewCard({ onDone }) {
  const s = useAppState();
  const pickFor = (emp) => {
    const m = activeModel(s, emp.position) || s.models.find((x) => x.status === 'active');
    return { employeeId: emp.id, branchId: emp.branchId, modelId: m.modelId, profileTo: nextProfile(m, emp.currentLevel) };
  };
  const [f, setF] = useState(() => ({ ...pickFor(s.employees.find((e) => e.id === 'e-aziza') || s.employees[0]), targetRoleId: '' }));
  const model = activeModel(s, f.modelId);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <Panel title="Yangi baholash kartasi" actions={<button className="btn sm" onClick={onDone}>Yopish</button>}>
      <div className="grid g3">
        <label className="f">Xodim
          <select className="i" value={f.employeeId} onChange={(e) => {
            setF({ ...f, ...pickFor(getEmployee(s, e.target.value)) });
          }}>
            {s.employees.filter((e) => e.status !== "archived").map((e) => <option key={e.id} value={e.id}>{e.name} ({e.currentLevel})</option>)}
          </select>
        </label>
        <label className="f">Lavozim modeli
          <select className="i" value={f.modelId} onChange={(e) => setF({ ...f, modelId: e.target.value, profileTo: activeModel(s, e.target.value)?.profiles[0].code })}>
            {[...new Set(s.models.map((m) => m.modelId))].map((id) => {
              const m = activeModel(s, id);
              return m ? <option key={id} value={id}>{m.name}</option> : null;
            })}
          </select>
        </label>
        <label className="f">Maqsadli profil
          <select className="i" value={f.profileTo} onChange={set('profileTo')}>
            {model?.profiles.map((p) => <option key={p.code} value={p.code}>{p.code} — {p.name}</option>)}
          </select>
        </label>
        <label className="f">Filial
          <select className="i" value={f.branchId} onChange={set('branchId')}>
            {s.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </label>
        <label className="f">Maqsadli rol (ixtiyoriy)
          <select className="i" value={f.targetRoleId} onChange={set('targetRoleId')}>
            <option value="">— vakant rol yo‘q —</option>
            {s.roles.map((r) => { const ri = roleInfo(s, r.id); return <option key={r.id} value={r.id}>{r.name} · {ri.rScope}{r.vacant ? ' · vakant' : ''}</option>; })}
          </select>
        </label>
        <div className="row" style={{ alignItems: 'end' }}>
          <button className="btn primary" onClick={() => run(openCard, { ...f, cycleId: 'cy-2026-k', targetRoleId: f.targetRoleId || null }, 'Karta ochildi') && onDone()}>Kartani ochish</button>
        </div>
      </div>
      <p className="muted small" style={{ marginTop: 10 }}>Model va maqsadli daraja xodimning lavozimidan avtomatik tanlanadi. Bir xodimga bir siklda bir daraja uchun faqat bitta karta ochiladi.</p>
    </Panel>
  );
}

const FILTERS = [
  ['open', 'Jarayonda', (c, s) => c.stage !== 'published'],
  ['late', 'Muddati o‘tgan', (c, s) => c.stage !== 'published' && c.deadline && c.deadline < s.today],
  ['pub', 'E’lon qilingan', (c) => c.stage === 'published'],
  ['all', 'Barchasi', () => true],
];

function Announce({ s }) {
  const [edit, setEdit] = useState(false);
  const [v, setV] = useState((s.announceConfig?.dates || []).join(', '));
  return (
    <p className="small">
      Rasmiy e’lon yiliga {(s.announceConfig?.dates || []).length} marta ({(s.announceConfig?.dates || []).join(', ')}), keyingisi <b>{fmtDate(D.nextAnnounce(s))}</b>.{' '}
      {edit ? <span className="row" style={{ display: 'inline-flex', gap: 4 }}><input className="i compact" style={{ width: 130 }} value={v} onChange={(e) => setV(e.target.value)} placeholder="06-30, 12-25" /><button className="btn sm" onClick={() => run(D.setAnnounceDates, { dates: v.split(',') }, 'E’lon sanalari saqlandi') && setEdit(false)}>Saqlash</button></span>
        : <button className="link-btn small" onClick={() => setEdit(true)}>sanalarni o‘zgartirish</button>}
    </p>
  );
}

export default function Cards() {
  const s = useAppState();
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState('open');
  const fn = FILTERS.find((f) => f[0] === filter)[2];
  const cards = s.cards.filter((c) => fn(c, s));
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Baholash kartalari</h1>
          <p>Har bir karta — bitta xodimning bitta darajaga baholanishi. Yangi xodimga karta rekrutingdan boshlanadi; baholar yil davomida yangilanadi va rasmiy e’longacha «shartli» bo‘ladi.</p>
          <Announce s={s} />
        </div>
        <button className="btn primary" onClick={() => setCreating(true)}>+ Yangi karta</button>
      </div>
      {creating && <NewCard onDone={() => setCreating(false)} />}
      <div className="seg">
        {FILTERS.map(([k, l, f]) => <button key={k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>{l} ({s.cards.filter((c) => f(c, s)).length})</button>)}
      </div>
      <Panel tight>
        {cards.length ? (
          <table>
            <thead>
              <tr><th>Xodim</th><th>O‘tish</th><th>Bosqich</th><th>Muddat</th><th className="num">Moslik</th><th>Holat</th></tr>
            </thead>
            <tbody>
              {cards.map((c) => {
                const d = cardDecision(s, c);
                const e = getEmployee(s, c.employeeId);
                const late = c.stage !== 'published' && c.deadline && c.deadline < s.today;
                const model = s.models.find((m) => m.id === c.modelVersionId);
                return (
                  <tr key={c.id} className="clickable" onClick={() => go(`/cards/${c.id}`)}>
                    <td><Person name={e.name} sub={getBranch(s, c.branchId)?.name} /></td>
                    <td style={{ whiteSpace: 'nowrap' }}>{c.profileFrom ? `${c.profileFrom} → ${c.profileTo}` : c.profileTo}<div className="muted small">{model?.name}{c.sectionOf ? ` · ${c.sectionOf} kartasining 2-rol bo‘limi` : ''}</div></td>
                    <td>{STAGE_LABELS[c.stage]}{c.prevCardId && <div className="muted small">qayta baholash</div>}{c.origin === 'onboarding' && <div><Pill tone="brand">onboarding</Pill></div>}{c.stage !== 'published' && <div className="muted small">shartli</div>}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(c.deadline)} {late && <Pill tone="bad">kechikkan</Pill>}</td>
                    <td className="num">{isNum(d.match.match) ? <b>{fmtPct(d.match.match)}</b> : <span className="muted small">{d.match.counts.scored}/{d.match.counts.total}</span>}</td>
                    <td><Pill tone={d.tone}>{d.label}</Pill></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : <Empty>Bu bo‘limda karta yo‘q.</Empty>}
      </Panel>
    </>
  );
}
