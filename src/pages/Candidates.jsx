import { useState } from 'react';
import { useAppState, run, getState } from '../state/store.js';
import { Panel, Pill, Person, Empty, go, fmtDate } from '../ui/common.jsx';
import * as D from '../core/domain.js';
import { fmtPct } from '../core/calc.js';
import { positionName, competencyLibrary } from '../core/modelKit.js';
import { SUCCESSION_STATUS } from '../ui/labels.js';

export default function Candidates({ initial }) {
  const s = useAppState();
  const actives = s.models.filter((m) => m.status === 'active');
  const [key, setKey] = useState(initial || 'AB|AB-1');
  const [onlyInterested, setOnlyInterested] = useState(false);
  const [showIneligible, setShowIneligible] = useState(false);
  const [open, setOpen] = useState(null);
  const [modelId, code] = key.split('|');
  const model = actives.find((m) => m.modelId === modelId) || actives[0];
  const profile = model.profiles.find((p) => p.code === code) || model.profiles[0];
  const lib = competencyLibrary(s.models);
  const all = D.candidatesFor(s, model.modelId, profile.code);
  const list = all.filter((c) => (!onlyInterested || c.interest) && (showIneligible || c.eligible));
  const hiddenIneligible = all.filter((c) => !c.eligible && (!onlyInterested || c.interest)).length;
  const eligible = all.filter((c) => c.eligible);
  const ready = eligible.filter((c) => c.complete);
  const best = eligible[0];
  const role = s.roles.find((r) => r.vacant && (r.profileCode === profile.code));

  const openCard = (c) => {
    if (c.card) return go(`/cards/${c.card.id}`);
    const ok = run(D.openCard, { cycleId: 'cy-2026-k', employeeId: c.emp.id, modelId: model.modelId, profileTo: profile.code, branchId: c.emp.branchId, targetRoleId: role?.id || null }, 'Baholash kartasi ochildi');
    const card = ok && getState().cards.find((x) => x.employeeId === c.emp.id && x.profileTo === profile.code);
    if (card) go(`/cards/${card.id}`);
  };
  const prepare = (c) => run(D.startPreparation, { employeeId: c.emp.id, modelId: model.modelId, profileCode: profile.code }, `${c.emp.name}: tayyorlash rejasi yaratildi`);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Nomzod tanlash</h1>
          <p>Lavozimni tanlang — tizim <b>barcha xodimlarni</b> shu lavozimga tayyorligi bo‘yicha saralaydi (<a href="#/succession">Vorislik</a> sahifasida esa faqat ro‘yxatga kiritilganlar). 100% tayyor nomzod bo‘lsa, u tayinlash uchun baholanadi; bo‘lmasa, eng yaqin nomzodni tayyorlash boshlanadi.</p>
        </div>
        <label className="f" style={{ minWidth: 320 }}>Lavozim va daraja
          <select className="i" value={`${model.modelId}|${profile.code}`} onChange={(e) => { setKey(e.target.value); setOpen(null); }}>
            {actives.map((m) => <optgroup key={m.modelId} label={m.name}>{m.profiles.map((p) => <option key={p.code} value={`${m.modelId}|${p.code}`}>{p.code} — {p.name}</option>)}</optgroup>)}
          </select>
        </label>
      </div>

      <section className={`panel next-step ${ready.length ? 'good' : best ? 'info' : 'warn'}`}>
        <div className="ns-main">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="ns-k">Tizim tavsiyasi · {profile.code} — {profile.name}</div>
            {ready.length ? (
              <>
                <b>{ready.length} ta nomzod 100% tayyor: {ready.map((c) => c.emp.name).join(', ')}</b>
                <div className="small ink2">Kompetensiya talablari bajarilgan. Tayinlash uchun baholash kartasini oching — KPI, staj, majburiy talablar va panel qarori kartada tekshiriladi.</div>
              </>
            ) : best ? (
              <>
                <b>100% tayyor nomzod yo‘q. Eng yaqini — {best.emp.name}: {fmtPct(best.near, 0)}</b>
                <div className="small ink2">{best.gaps.length} ta kompetensiya yetishmaydi ({best.gaps.slice(0, 4).map((g) => g.code).join(', ')}{best.gaps.length > 4 ? '…' : ''}). Tayyorlash rejasi har bir yetishmovchilik uchun mentor va muddatli vazifa yaratadi.</div>
              </>
            ) : (
              <>
                <b>Bu lavozimga o‘ta oladigan nomzod yo‘q</b>
                <div className="small ink2">O‘tish shartiga mos daraja yoki lavozimdagi xodimlar topilmadi.</div>
              </>
            )}
          </div>
          {ready.length > 0 && <button className="btn primary" onClick={() => openCard(ready[0])}>{ready[0].card ? 'Kartani ochish' : `${ready[0].emp.name}: baholash kartasini ochish`}</button>}
          {!ready.length && best && (best.succession?.status === 'developing'
            ? <Pill tone="brand">Tayyorlanmoqda</Pill>
            : <button className="btn primary" onClick={() => prepare(best)}>{best.emp.name}ni tayyorlashni boshlash</button>)}
        </div>
      </section>

      <Panel tight title={<div className="row"><h2>Nomzodlar</h2><span className="muted small">{eligible.length} tasi o‘tish shartiga mos · {all.filter((c) => c.interest).length} tasi qiziqish bildirgan</span></div>}
        actions={<label className="chk"><input type="checkbox" checked={onlyInterested} onChange={(e) => setOnlyInterested(e.target.checked)} /> Faqat qiziqish bildirganlar</label>}>
        {list.length ? (
          <table>
            <thead><tr><th className="num">#</th><th>Xodim</th><th>Joriy lavozim</th><th style={{ minWidth: 200 }}>Tayyorlik</th><th className="num">Talablar</th><th>O‘tish huquqi</th><th>Holat</th><th /></tr></thead>
            <tbody>
              {list.map((c, i) => {
                const isOpen = open === c.emp.id;
                const status = c.succession ? SUCCESSION_STATUS[c.succession.status] : null;
                return [
                  <tr key={c.emp.id} className={`clickable ${isOpen ? 'open' : ''} ${!c.eligible ? 'dim-row' : ''}`} onClick={() => setOpen(isOpen ? null : c.emp.id)}>
                    <td className="num">{c.eligible ? <b>{eligible.indexOf(c) + 1}</b> : <span className="muted">—</span>}</td>
                    <td><Person name={c.emp.name} sub={D.getBranch(s, c.emp.branchId)?.name} />{c.eligible && c === best && !ready.length && <div style={{ marginTop: 4 }}><Pill tone="teal">eng yaqin</Pill></div>}</td>
                    <td>{c.emp.currentLevel}<div className="muted small">{positionName(s.models, c.emp.currentLevel)}</div></td>
                    <td>
                      <div className="row" style={{ flexWrap: 'nowrap', gap: 10 }}>
                        <div className="near-bar"><i style={{ width: `${c.near}%`, background: c.complete ? 'var(--good)' : undefined }} /></div>
                        <b className="small" style={{ minWidth: 40, textAlign: 'right' }}>{fmtPct(c.near, 0)}</b>
                      </div>
                    </td>
                    <td className="num"><b>{c.met}</b> / {c.total}</td>
                    <td className="small">{c.eligible ? <span style={{ color: 'var(--good)' }}>✓ mos</span> : <span className="muted">{c.reason}</span>}</td>
                    <td>
                      {c.interest && <div><Pill tone="teal">qiziqish bildirgan</Pill></div>}
                      {status && c.succession.status !== 'interested' && <div style={{ marginTop: 3 }}><Pill tone={status[1]}>{status[0]}</Pill></div>}
                      {!c.interest && !status && <span className="muted small">—</span>}
                    </td>
                    <td className="num" onClick={(e) => e.stopPropagation()}>
                      {c.eligible && c.complete && <button className="btn sm primary" onClick={() => openCard(c)}>{c.card ? 'Karta' : 'Baholash kartasi'}</button>}
                      {c.eligible && !c.complete && c.succession?.status !== 'developing' && <button className="btn sm" onClick={() => prepare(c)}>Tayyorlashni boshlash</button>}
                      {c.succession?.status === 'developing' && <span className="small muted">rejada</span>}
                    </td>
                  </tr>,
                  isOpen && (
                    <tr key={`${c.emp.id}-x`}><td colSpan={8} className="expand">
                      {c.interest && <div className="small"><b>Xodim izohi ({fmtDate(c.interest.at)}):</b> «{c.interest.note}»</div>}
                      <div className="small" style={{ fontWeight: 650 }}>{c.gaps.length ? `Yetishmaydi — ${c.gaps.length} ta kompetensiya:` : 'Barcha kompetensiya talablari bajarilgan.'}</div>
                      {c.gaps.length > 0 && (
                        <div className="row">
                          {c.gaps.map((g) => <span key={g.code} className="pos-chip" title={lib.find((x) => x.code === g.code)?.name}>{g.code} {(lib.find((x) => x.code === g.code)?.name || '').slice(0, 32)} · <b>{g.level ?? '—'} → {g.target}</b></span>)}
                        </div>
                      )}
                      {c.succession?.next && <div className="small muted">{c.succession.next}</div>}
                    </td></tr>
                  ),
                ];
              })}
            </tbody>
          </table>
        ) : <Empty>Bu shartga mos nomzod yo‘q.</Empty>}
        {hiddenIneligible > 0 && <div className="panel-body" style={{ paddingTop: 8, paddingBottom: 8 }}><button className="link-btn" onClick={() => setShowIneligible(!showIneligible)}>{showIneligible ? 'O‘tish huquqi yo‘qlarni yashirish' : `O‘tish huquqi hozircha yo‘q xodimlarni ham ko‘rsatish (${hiddenIneligible})`}</button></div>}
        <div className="panel-body small ink2">Tayyorlik faqat tasdiqlangan (e’lon qilingan yoki tekshirilgan) ish dalillari bo‘yicha hisoblanadi: to‘plangan ball ÷ maqsadli ball. Rasmiy qaror baribir baholash kartasi va panel orqali qabul qilinadi.</div>
      </Panel>
    </>
  );
}
