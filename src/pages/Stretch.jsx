import { useState } from 'react';
import { competencyLibrary, positionName } from '../core/modelKit.js';
import { fmtPct } from '../core/calc.js';
import { useAppState, run } from '../state/store.js';
import { Panel, Pill, go, fmtDate, Empty, Person } from '../ui/common.jsx';
import * as D from '../core/domain.js';
import { STRETCH_STATUS } from '../ui/labels.js';

export function StretchHistory({ st }) {
  return (
    <div className="hist">
      {st.submissions.map((x, i) => (
        <div key={i} className={`it ${x.review?.decision === 'approved' ? 'ok' : x.review?.decision === 'returned' ? 'ret' : 'wait'}`}>
          <div className="row between"><b>{i + 1}-yuborish</b><span className="muted small">{fmtDate(x.at)}</span></div>
          <p className="small" style={{ marginTop: 4 }}>{x.text}</p>
          {x.link && <div className="code" style={{ marginTop: 4 }}>{x.link}</div>}
          {x.review ? (
            <div className={`callout ${x.review.decision === 'approved' ? 'good' : 'bad'} small`} style={{ marginTop: 6 }}>
              {x.review.decision === 'approved' ? 'Tasdiqlandi' : 'Qaytarildi'}: {x.review.reason} — {x.review.by}, {fmtDate(x.review.at)}
            </div>
          ) : <div className="muted small" style={{ marginTop: 4 }}>Tekshiruv kutilmoqda</div>}
        </div>
      ))}
    </div>
  );
}

export function StretchInfo({ st, s }) {
  const rows = [
    ['Ko‘lam', st.scope], ['Muddat', fmtDate(st.deadline)], ['Mustaqil vakolat', st.authority], ['Kutilgan natija', st.expected],
    ['Tekshirish mezoni', st.criteria], ['Kompetensiyalar', st.competencies.join(', ')], ['Mentor', st.mentor || '—'],
  ];
  return (
    <table><tbody>{rows.map(([k, v]) => <tr key={k}><td className="muted small" style={{ width: 160 }}>{k}</td><td>{v}</td></tr>)}</tbody></table>
  );
}

function NewStretch({ s, onDone }) {
  const actives = s.models.filter((m) => m.status === 'active');
  const lib = competencyLibrary(s.models);
  const [f, setF] = useState({ employeeId: '', target: '', title: '', scope: '', deadline: '', authority: '', expected: '', criteria: '', mentor: '', competencies: [] });
  const emp = f.employeeId ? D.getEmployee(s, f.employeeId) : null;
  let model = null; let profile = null;
  for (const m of actives) { const p = m.profiles.find((x) => x.code === f.target); if (p) { model = m; profile = p; break; } }
  const ready = emp && profile ? D.positionReadiness(s, emp, model, profile) : null;
  // Xodim tanlanganda: qiziqish bildirgan yoki vorislikdagi lavozim oldindan tanlanadi
  const pickEmp = (id) => {
    const e = D.getEmployee(s, id);
    const t = s.succession.find((x) => x.employeeId === id)?.target || s.interests.find((x) => x.employeeId === id)?.target || '';
    setF({ ...f, employeeId: id, target: e ? t : '', competencies: [] });
  };
  const suggest = ready ? [...ready.gaps].sort((a, b) => (b.target - (b.level ?? 0)) - (a.target - (a.level ?? 0))).slice(0, 3).map((g) => g.code) : [];
  const comps = f.competencies.length ? f.competencies : suggest;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const toggle = (code) => { const cur = comps; setF({ ...f, competencies: cur.includes(code) ? cur.filter((x) => x !== code) : [...cur, code] }); };
  return (
    <Panel title="Stretch vazifa biriktirish" actions={<button className="btn sm" onClick={onDone}>Yopish</button>}>
      <div className="stack">
        <div className="grid g3" style={{ gap: 10 }}>
          <label className="f">Xodim
            <select className="i" value={f.employeeId} onChange={(e) => pickEmp(e.target.value)}>
              <option value="">— tanlang —</option>
              {D.activeEmployees(s).map((e) => <option key={e.id} value={e.id}>{e.name} · {positionName(s.models, e.currentLevel)}</option>)}
            </select>
          </label>
          <label className="f">Maqsadli lavozim
            <select className="i" value={f.target} onChange={(e) => setF({ ...f, target: e.target.value, competencies: [] })}>
              <option value="">— tanlang —</option>
              {actives.map((m) => <optgroup key={m.modelId} label={m.name}>{m.profiles.map((p) => <option key={p.code} value={p.code}>{p.code} — {p.name}</option>)}</optgroup>)}
            </select>
          </label>
          <label className="f">Muddat<input className="i" type="date" value={f.deadline} onChange={set('deadline')} /></label>
        </div>
        {ready && (
          <div className={`callout small ${ready.eligible ? '' : 'warn'}`}>
            {emp.name}: {profile.code} ga tayyorlik <b>{fmtPct(ready.near, 0)}</b> ({ready.met} / {ready.total} talab). {ready.eligible ? 'O‘tish sharti mos.' : `Diqqat: ${ready.reason}.`} Vazifa yetishmayotgan kompetensiyalarni rivojlantirishga qaratilsa, foydaliroq.
          </div>
        )}
        <label className="f">Vazifa nomi<input className="i" placeholder="Masalan: 4 ustozdan iborat jamoani 3 oy muvofiqlashtirish" value={f.title} onChange={set('title')} /></label>
        <div className="grid g2" style={{ gap: 10 }}>
          <label className="f">Ko‘lam (filiallar, jamoa, ko‘rsatkich)<input className="i" placeholder="Chilonzor filiali, 4 ustoz" value={f.scope} onChange={set('scope')} /></label>
          <label className="f">Mustaqil vakolat<input className="i" placeholder="Ustozlarga kuzatuv va metodik vazifa berish" value={f.authority} onChange={set('authority')} /></label>
          <label className="f">Kutilgan natija (o‘lchanadigan)<input className="i" placeholder="Kuzatuv o‘rtachasi 3,0 → 3,5" value={f.expected} onChange={set('expected')} /></label>
          <label className="f">Tekshirish mezoni va manba<input className="i" placeholder="Kuzatuv varaqlari, oldin/keyin natija" value={f.criteria} onChange={set('criteria')} /></label>
          <label className="f">Mentor<input className="i" placeholder="Akademik rahbar" value={f.mentor} onChange={set('mentor')} /></label>
        </div>
        {profile && (
          <div className="f">Qaysi kompetensiyalarni ko‘rsatadi {suggest.length > 0 && !f.competencies.length && <span className="muted small" style={{ fontWeight: 400 }}>— tizim yetishmayotganlarni taklif qildi</span>}
            <div className="row">
              {Object.keys(profile.targets).map((code) => {
                const gap = ready?.gaps.find((g) => g.code === code);
                return <label key={code} className="chk" title={lib.find((c) => c.code === code)?.name}><input type="checkbox" checked={comps.includes(code)} onChange={() => toggle(code)} />{code}{gap ? ` · ${gap.level ?? '—'}→${gap.target}` : ' ✓'}</label>;
              })}
            </div>
          </div>
        )}
        <div className="row">
          <button className="btn primary" disabled={!f.employeeId || !f.target || !f.title.trim()} onClick={() => run(D.createStretch, { ...f, competencies: comps }, 'Stretch vazifa biriktirildi — xodimga bildirishnoma yuborildi') && onDone()}>Biriktirish</button>
          <span className="muted small">Xodim «Stretch vazifam»da ko‘radi; vorislikdagi holati «Amaliy sinovga tavsiya» bo‘ladi; ochiq baholash kartasi bo‘lsa, unga bog‘lanadi.</span>
        </div>
      </div>
    </Panel>
  );
}

export default function Stretch({ id }) {
  const s = useAppState();
  const [rev, setRev] = useState({ reason: '' });
  const [creating, setCreating] = useState(false);
  if (!id) {
    return (
      <>
        <div className="page-head">
          <div>
            <h1>Stretch vazifalar</h1>
            <p>Keyingi rol ko‘lamidagi amaliy ish: filiallararo loyiha, vaqtinchalik klaster boshqaruvi yoki assessment. Tasdiqlangan dalil «KPI va ko‘lam» hamda «Panel qarori»ga bog‘lanadi.</p>
          </div>
          {!creating && <button className="btn primary" onClick={() => setCreating(true)}>+ Stretch vazifa biriktirish</button>}
        </div>
        {creating && <NewStretch s={s} onDone={() => setCreating(false)} />}
        <Panel tight>
          <table>
            <thead><tr><th>Xodim</th><th>O‘tish</th><th>Vazifa</th><th>Muddat</th><th>Yuborishlar</th><th>Holat</th></tr></thead>
            <tbody>
              {s.stretches.map((st) => (
                <tr key={st.id} className="clickable" onClick={() => go(`/stretch/${st.id}`)}>
                  <td><Person name={D.getEmployee(s, st.employeeId).name} /></td>
                  <td>{st.kind}</td>
                  <td>{st.title}<div className="muted small">{st.scope}</div></td>
                  <td>{fmtDate(st.deadline)}</td>
                  <td>{st.submissions.length}</td>
                  <td><Pill tone={STRETCH_STATUS[st.status][1]}>{STRETCH_STATUS[st.status][0]}</Pill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </>
    );
  }
  const st = D.getStretch(s, id);
  if (!st) return <Panel>Topilmadi</Panel>;
  const emp = D.getEmployee(s, st.employeeId);
  const card = s.cards.find((c) => c.stretchId === st.id);
  const pending = st.submissions.at(-1) && !st.submissions.at(-1).review;
  const d = card ? D.cardDecision(s, card) : null;
  return (
    <>
      <div className="page-head">
        <div>
          <a href="#/stretch" className="small">← Stretch vazifalari</a>
          <h1 style={{ marginTop: 6 }}>{st.title}</h1>
          <p>{emp.name} · {st.kind}</p>
        </div>
        <Pill tone={STRETCH_STATUS[st.status][1]}>{STRETCH_STATUS[st.status][0]}</Pill>
      </div>
      <div className="split">
        <div className="grid">
          <Panel title="Vazifa biriktirish"><StretchInfo st={st} s={s} /></Panel>
          <Panel title="Dalil topshirish tarixi">{st.submissions.length ? <StretchHistory st={st} /> : <Empty>Hali yuborilmagan.</Empty>}</Panel>
        </div>
        <div className="grid sticky">
          <Panel title="Tekshirish">
            {pending ? (
              <div className="stack">
                <p className="small ink2">Rahbar shaxsan bajargan ish, qaror, o‘lchangan natija va filiallar kesimidagi ta’sirni tekshiring.</p>
                <textarea className="i" placeholder="Asos (majburiy)" value={rev.reason} onChange={(e) => setRev({ reason: e.target.value })} />
                <div className="row">
                  <button className="btn primary" onClick={() => run(D.reviewStretch, { id, decision: 'approved', reason: rev.reason }, 'Stretch dalili tasdiqlandi') && setRev({ reason: '' })}>Tasdiqlash</button>
                  <button className="btn danger" onClick={() => run(D.reviewStretch, { id, decision: 'returned', reason: rev.reason }, 'Dalil qaytarildi') && setRev({ reason: '' })}>Qaytarish</button>
                </div>
              </div>
            ) : <p className="muted small">Tekshiriladigan yangi yuborish yo‘q. {st.status === 'returned' && 'Xodim qayta yuborishi kutilmoqda (xodim ko‘rinishi → Stretch vazifam).'}</p>}
          </Panel>
          <Panel title="Panelga bog‘lanish">
            {card ? (
              <div className="stack">
                <a href={`#/cards/${card.id}`}>Karta {card.id} · {card.profileFrom} → {card.profileTo}</a>
                {d.conditions.filter((c) => ['stretch_approved', 'kpi_threshold', 'tenure_months', 'target_role'].includes(c.type)).map((c) => (
                  <div key={c.type} className="row small"><Pill tone={c.passed ? 'good' : c.passed === false ? 'bad' : 'muted'}>{c.passed ? '✓' : c.passed === false ? '✕' : '○'}</Pill>{c.label} <span className="muted">{c.detail}</span></div>
                ))}
                <p className="muted small">Kompetensiya darajalari stretch dalili asosida avtomatik o‘zgarmaydi — baholovchi har birini rubrika bo‘yicha alohida kiritadi.</p>
              </div>
            ) : <Empty>Bog‘langan baholash kartasi yo‘q.</Empty>}
          </Panel>
        </div>
      </div>
    </>
  );
}
