import { useState } from 'react';
import { useAppState, run } from '../state/store.js';
import { Panel, Pill, Person, Empty } from '../ui/common.jsx';
import * as D from '../core/domain.js';
import { positionName } from '../core/modelKit.js';

const ICONS = ['🏅', '⭐', '🎓', '🔥', '🏆', '🚀', '💡', '🎯'];

function BadgeForm({ b, onDone }) {
  const [f, setF] = useState(b || { name: '', icon: '🏅', kind: 'grade5', n: 1, desc: '', active: true });
  return (
    <div className="panel add-box">
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <select className="i compact" value={f.icon} onChange={(e) => setF({ ...f, icon: e.target.value })}>{ICONS.map((x) => <option key={x}>{x}</option>)}</select>
        <input className="i compact" style={{ flex: 1, minWidth: 160 }} placeholder="Badge nomi" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <select className="i compact" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>{Object.entries(D.BADGE_KINDS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select>
        <label className="row small" style={{ gap: 4 }}>≥<input className="i compact" style={{ width: 70 }} type="number" value={f.n} onChange={(e) => setF({ ...f, n: e.target.value })} />{D.BADGE_KINDS[f.kind][1]}</label>
      </div>
      <input className="i compact" style={{ width: '100%', marginTop: 6 }} placeholder="Tavsif: nima uchun beriladi" value={f.desc} onChange={(e) => setF({ ...f, desc: e.target.value })} />
      <div className="row" style={{ gap: 6, marginTop: 6 }}>
        <label className="row small" style={{ gap: 4 }}><input type="checkbox" checked={f.active !== false} onChange={(e) => setF({ ...f, active: e.target.checked })} /> faol</label>
        <button className="btn sm primary" onClick={() => run(D.saveBadge, { badge: f }, 'Badge saqlandi') && onDone()}>Saqlash</button>
        <button className="btn sm" onClick={onDone}>Bekor qilish</button>
      </div>
    </div>
  );
}

function Badges({ s, canEdit }) {
  const [edit, setEdit] = useState(null);
  const earned = (b) => D.activeEmployees(s).filter((e) => D.employeeBadges(s, e.id).some((x) => x.id === b.id)).length;
  return (
    <Panel title={<div><h2>Badge’lar katalogi</h2><div className="muted small">Badge faqat noodatiy harakat va natija uchun. Minimum talabni bajarish (masalan, onboardingdan o‘tish) badge emas.</div></div>}
      actions={canEdit && edit === null && <button className="btn sm primary" onClick={() => setEdit('new')}>+ Badge qo‘shish</button>}>
      {edit === 'new' && <BadgeForm onDone={() => setEdit(null)} />}
      <table>
        <thead><tr><th>Badge</th><th>Berilish sharti</th><th className="num">Olganlar</th><th /></tr></thead>
        <tbody>{(s.gamification?.badges || []).map((b) => edit === b.id ? (
          <tr key={b.id}><td colSpan={4}><BadgeForm b={b} onDone={() => setEdit(null)} /></td></tr>
        ) : (
          <tr key={b.id}>
            <td><span style={{ fontSize: 22, marginRight: 8 }}>{b.icon}</span><b>{b.name}</b>{b.active === false && <> <Pill tone="muted">nofaol</Pill></>}<div className="muted small">{b.desc}</div></td>
            <td className="small">{D.BADGE_KINDS[b.kind][0]}: ≥ {b.n} {D.BADGE_KINDS[b.kind][1]}</td>
            <td className="num">{earned(b)}</td>
            <td className="num">{canEdit && <span className="row" style={{ gap: 4, justifyContent: 'flex-end' }}><button className="btn sm" onClick={() => setEdit(b.id)}>Tahrirlash</button><button className="btn sm" onClick={() => run(D.removeBadge, { id: b.id }, 'Badge o‘chirildi')}>O‘chirish</button></span>}</td>
          </tr>
        ))}</tbody>
      </table>
      {!(s.gamification?.badges || []).length && <Empty>Katalog bo‘sh.</Empty>}
    </Panel>
  );
}

function PointRow({ k, l, v, canEdit }) {
  const [x, setX] = useState(v);
  return (
    <tr><td>{l}</td><td className="num">{canEdit ? <span className="row" style={{ gap: 4, justifyContent: 'flex-end' }}><input className="i compact" style={{ width: 70 }} type="number" value={x} onChange={(e) => setX(e.target.value)} /><button className="btn sm" disabled={Number(x) === v} onClick={() => run(D.setPointRule, { kind: k, points: x }, 'Saqlandi')}>OK</button></span> : <b>{v}</b>}</td></tr>
  );
}

function Points({ s, canEdit }) {
  return (
    <Panel title={<div><h2>Ballar</h2><div className="muted small">Xodim harakatlari uchun ball to‘playdi; reyting shu ballar asosida tuziladi. Kompetensiya darajalari ballga kirmaydi.</div></div>}>
      <table className="small"><tbody>{Object.entries(D.POINT_ACTIONS).map(([k, [l, def]]) => <PointRow key={k + (s.gamification?.points?.[k] ?? def)} k={k} l={l} v={Number(s.gamification?.points?.[k] ?? def)} canEdit={canEdit} />)}</tbody></table>
    </Panel>
  );
}

export function Rating({ s, scope = null, me = null }) {
  const [f, setF] = useState({ position: '', branchId: me ? '' : '' });
  const list = D.ratingList(s, f).filter((r) => !scope || scope.has(r.emp.id));
  const positions = [...new Set(D.activeEmployees(s).map((e) => e.position))];
  return (
    <Panel tight title={<div><h2>Reyting</h2><div className="muted small">Ballar bo‘yicha · lavozim, filial va umumiy kesimda · badge’lar belgi sifatida</div></div>} actions={
      <div className="row">
        <select className="i compact" value={f.position} onChange={(e) => setF({ ...f, position: e.target.value })}><option value="">Barcha lavozimlar</option>{positions.map((p) => <option key={p} value={p}>{p}</option>)}</select>
        <select className="i compact" value={f.branchId} onChange={(e) => setF({ ...f, branchId: e.target.value })}><option value="">Barcha filiallar</option>{s.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
      </div>}>
      <table>
        <thead><tr><th className="num">#</th><th>Xodim</th><th>Badge’lar</th><th className="num">Ball</th></tr></thead>
        <tbody>{list.slice(0, 20).map((r) => (
          <tr key={r.emp.id} className={me === r.emp.id ? 'row-me' : ''}>
            <td className="num"><b>{r.rank}</b></td>
            <td><Person name={r.emp.name} sub={`${positionName(s.models, r.emp.currentLevel)} · ${D.getBranch(s, r.emp.branchId)?.name}`} /></td>
            <td>{r.badges.map((b) => <span key={b.id} title={`${b.name}: ${b.desc}`} style={{ fontSize: 18, marginRight: 4 }}>{b.icon}</span>)}</td>
            <td className="num"><b>{r.points}</b></td>
          </tr>
        ))}</tbody>
      </table>
    </Panel>
  );
}

export default function Gamification({ user }) {
  const s = useAppState();
  const canEdit = D.can(user, 'gami.manage');
  const [tab, setTab] = useState('badges');
  return (
    <>
      <div className="page-head"><div><h1>Gamifikatsiya</h1><p>Ballar va badge’lar. Katalogni «Gamifikatsiyani boshqarish» huquqi bor xodim (odatda L&D) yuritadi: nom, belgi va berilish sharti.</p></div></div>
      <div className="tabs">{[['badges', 'Badge’lar'], ['points', 'Ballar'], ['rating', 'Reyting']].map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
      {tab === 'badges' && <Badges s={s} canEdit={canEdit} />}
      {tab === 'points' && <Points s={s} canEdit={canEdit} />}
      {tab === 'rating' && <Rating s={s} scope={D.scopeEmployees(s, user)} />}
    </>
  );
}
