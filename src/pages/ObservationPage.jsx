import { useState } from 'react';
import { useAppState, run } from '../state/store.js';
import { Panel, Pill, Person, Empty, fmtDate } from '../ui/common.jsx';
import * as D from '../core/domain.js';

const firstLine = (t) => String(t || '').split('\n')[0];

function Checklist({ s, emp, user, onDone }) {
  const model = D.activeModel(s, 'GE');
  const comps = s.onboardingConfig.obsCodes.map((c) => model.competencies.find((k) => k.code === c)).filter(Boolean);
  const [o, setO] = useState({ date: s.today, lesson: '', group: '', note: '' });
  const [r, setR] = useState({});
  const [show, setShow] = useState(null);
  const set = (k) => (e) => setO({ ...o, [k]: e.target.value });
  const rated = Object.values(r).filter(Boolean).length;
  return (
    <Panel title={`Kuzatuv checklisti — ${emp.name}`} actions={<button className="btn sm" onClick={onDone}>Yopish</button>}>
      <div className="grid g3">
        <label className="f">Sana<input className="i" type="date" max={s.today} value={o.date} onChange={set('date')} /></label>
        <label className="f">Dars<input className="i" placeholder="Beginner, Unit 5" value={o.lesson} onChange={set('lesson')} /></label>
        <label className="f">Guruh<input className="i" placeholder="BG-12 (9 o‘quvchi)" value={o.group} onChange={set('group')} /></label>
      </div>
      <table className="small" style={{ marginTop: 10 }}>
        <thead><tr><th>Kompetensiya</th><th>Ball (1–5)</th></tr></thead>
        <tbody>{comps.map((c) => (
          <tr key={c.code}>
            <td><span className="code">{c.code}</span> <b>{c.name}</b> <button className="btn-link" onClick={() => setShow(show === c.code ? null : c.code)}>{show === c.code ? 'mezonlarni yopish' : 'mezonlar'}</button>
              {show === c.code && <ol className="crit">{[1, 2, 3, 4, 5].map((l) => <li key={l}><b>{l}</b> — {firstLine(c.levels?.[l])}</li>)}</ol>}
            </td>
            <td style={{ whiteSpace: 'nowrap' }}>{[1, 2, 3, 4, 5].map((l) => <button key={l} className={`score-btn ${Number(r[c.code]) === l ? 'on' : ''}`} title={firstLine(c.levels?.[l])} onClick={() => setR({ ...r, [c.code]: Number(r[c.code]) === l ? '' : l })}>{l}</button>)}</td>
          </tr>
        ))}</tbody>
      </table>
      <label className="f" style={{ marginTop: 8 }}>Xulosa va keyingi qadam<textarea className="i" placeholder="Kuzatilgan dalil, kuchli tomon, 1–2 aniq keyingi qadam" value={o.note} onChange={set('note')} /></label>
      <div className="row" style={{ marginTop: 8 }}>
        <button className="btn primary" disabled={rated < 3 || !o.note.trim()} onClick={() => run(D.addOnbObservation, { employeeId: emp.id, methodist: user.role === 'methodist' ? user.name : 'Metodist', ...o, ratings: r, userId: user.id }, 'Kuzatuv saqlandi') && onDone()}>Saqlash ({rated}/{comps.length})</button>
        <span className="small muted">Kamida 3 band. Ballar onboarding natijasining «Ish amaliyotidagi kuzatuv» qismiga kiradi; filial rahbari tasdiqlagach kompetensiya profiliga ish dalili sifatida yoziladi.</span>
      </div>
    </Panel>
  );
}

export default function ObservationPage({ user, focus }) {
  const s = useAppState();
  const scope = D.scopeEmployees(s, user);
  const [open, setOpen] = useState(focus || null);
  const rows = s.onboardings.filter((o) => o.status === 'active' && (!scope || scope.has(o.employeeId)))
    .map((ob) => ({ ob, emp: D.getEmployee(s, ob.employeeId), need: D.onbProgram(s, D.getEmployee(s, ob.employeeId))?.observations || 0 }))
    .filter((x) => x.need > 0);
  const emp = open && D.getEmployee(s, open);
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Dars kuzatuvi (observation)</h1>
          <p>Metodist moslashuvdagi har bir ustozni moslashuv dasturi davomida kamida 2 marta kuzatadi. Checklist GE modelining kompetensiya mezonlariga tayanadi (har ballning ta’rifi ko‘rinadi). Ballar 30 kunlik bahoga kiradi, yakuniy qarorni filial rahbari tasdiqlaydi.</p>
        </div>
      </div>
      {emp && <Checklist key={emp.id} s={s} emp={emp} user={user} onDone={() => setOpen(null)} />}
      <Panel tight title="Moslashuvdagi ustozlar">
        {rows.length ? (
          <table>
            <thead><tr><th>Ustoz</th><th>Kun</th><th>Kuzatuvlar</th><th /></tr></thead>
            <tbody>{rows.map(({ ob, emp: e, need }) => {
              const list = D.onbObservations(s, ob);
              const day = D.onbDay(s, ob);
              return (
                <tr key={ob.id}>
                  <td><Person name={e.name} sub={`${e.currentLevel} · ${D.getBranch(s, e.branchId)?.name}`} /></td>
                  <td className="small">{day} / {D.obDays(s, ob)}{list.length < need && day >= 20 && <div><Pill tone="warn">muddat yaqin</Pill></div>}</td>
                  <td className="small">{list.length} / {need}{list.map((o) => <div key={o.id} className="muted">{fmtDate(o.date)} · o‘rtacha {String(Math.round(D.obsMean(o) * 10) / 10).replace('.', ',')}</div>)}</td>
                  <td className="num"><button className="btn sm" onClick={() => setOpen(e.id)}>{list.length < need ? 'Kuzatuv kiritish' : 'Yana kuzatuv'}</button></td>
                </tr>
              );
            })}</tbody>
          </table>
        ) : <Empty icon="check">Moslashuvda kuzatiladigan ustoz yo‘q.</Empty>}
      </Panel>
    </>
  );
}
