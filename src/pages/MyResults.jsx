import { useState } from 'react';
import { useAppState, run } from '../state/store.js';
import { Panel, Pill, Empty, fmtDate, Avatar, Gauge, ScoreChip, Stepper } from '../ui/common.jsx';
import * as D from '../core/domain.js';
import { positionName, profileThreshold, competencyLibrary } from '../core/modelKit.js';
import { fmtPct, isNum } from '../core/calc.js';
import { IDP_STATUS, CONTEXT_LABEL } from '../ui/labels.js';
import { STAGE_LABELS } from '../data/models.js';


/** Shikoyat: e'lon qilingan natijadan norozi bo'lsa, 10 kun ichida izoh bilan. */
function Appeal({ card, emp, today }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const a = card.appeal;
  const until = D.appealDeadline(card);
  if (a) return <div className={`callout small ${a.status === 'open' ? 'warn' : ''}`}><b>Shikoyatingiz</b> ({fmtDate(a.at)}): {a.status === 'open' ? 'boshqa baholovchi ko‘rib chiqmoqda.' : a.status === 'upheld' ? `natija o‘zgarmadi — ${a.note}` : `qayta baholanadi — ${a.note}`}</div>;
  if (today > until) return null;
  return open ? (
    <div className="stack small">
      <label className="f">Nimadan norozisiz va nega?<textarea className="i" value={text} onChange={(e) => setText(e.target.value)} placeholder="Masalan: GEN-05 bo‘yicha oktabrdagi dars kuzatuvi hisobga olinmagan" /></label>
      <div className="row"><button className="btn primary sm" disabled={text.trim().length < 10} onClick={() => run(D.fileAppeal, { cardId: card.id, employeeId: emp.id, text }, 'Shikoyat yuborildi') && setOpen(false)}>Yuborish</button><button className="btn sm" onClick={() => setOpen(false)}>Bekor qilish</button></div>
      <div className="muted">Shikoyatni kartani baholamagan boshqa baholovchi ko‘rib chiqadi; qaror va sababi sizga yuboriladi.</div>
    </div>
  ) : <div className="small"><button className="btn sm" onClick={() => setOpen(true)}>Natijadan norozimisiz? Shikoyat yuborish</button> <span className="muted">{fmtDate(until)} gacha</span></div>;
}

export default function MyResults({ emp }) {
  const s = useAppState();
  const cards = s.cards.filter((c) => c.employeeId === emp.id);
  const published = cards.filter((c) => c.stage === 'published');
  const inProgress = cards.filter((c) => c.stage !== 'published');
  const idp = s.idp.filter((x) => x.employeeId === emp.id && x.status !== 'proposed');
  return (
    <>
      <div className="panel welcome">
        <Avatar name={emp.name} size="lg" />
        <div>
          <h1>Assalomu alaykum, {emp.name.split(' ')[0]}!</h1>
          <p>Joriy lavozimingiz: <b>{emp.currentLevel} — {positionName(s.models, emp.currentLevel)}</b> · {D.getBranch(s, emp.branchId)?.name} · {fmtDate(emp.levelSince)} dan</p>
        </div>
      </div>
      {inProgress.map((c) => {
        const model = D.getModel(s, c.modelVersionId);
        return (
          <Panel key={c.id} title={<div><h2>Baholashingiz davom etmoqda: {c.profileFrom ? `${c.profileFrom} → ${c.profileTo}` : c.profileTo}</h2><div className="muted small">Muddat: {fmtDate(c.deadline)} · baholovchi: {c.assessors?.evaluator}</div></div>}>
            <div className="stack">
              <Stepper stages={model.stages} current={c.stage} />
              <p className="small ink2">Hozir: <b>{STAGE_LABELS[c.stage]}</b>. Sizdan hech narsa talab qilinmaydi — natija e’lon qilingach shu yerda ko‘rinadi va bildirishnoma keladi.</p>
            </div>
          </Panel>
        );
      })}
      {published.length === 0 && inProgress.length === 0 && <Panel><Empty>Hozircha e’lon qilingan natija yo‘q.</Empty></Panel>}
      {published.map((c) => {
        const d = D.cardDecision(s, c);
        const model = D.getModel(s, c.modelVersionId);
        return (
          <Panel key={c.id} title={<div><h2>Natijangiz: {c.profileFrom ? `${c.profileFrom} → ${c.profileTo}` : c.profileTo}</h2><div className="muted small">{model.name} · e’lon qilingan {fmtDate(c.published.at)}</div></div>} actions={<Pill tone={d.tone}>{d.label}</Pill>}>
            <div className="split" style={{ gridTemplateColumns: '1fr 300px' }}>
              <table>
                <thead><tr><th>Kompetensiya</th><th className="num">Maqsad</th><th className="num">Sizning darajangiz</th><th className="num">Yetishmaydi</th></tr></thead>
                <tbody>{d.match.items.map((it) => <tr key={it.code}><td><span className="code">{it.code}</span> {model.competencies.find((x) => x.code === it.code)?.name}</td><td className="num">{it.target}</td><td className="num"><ScoreChip v={it.score} target={it.target} /></td><td className="num">{it.gap ? <span style={{ color: 'var(--warn)', fontWeight: 700 }}>−{it.gap}</span> : <span className="muted">—</span>}</td></tr>)}</tbody>
              </table>
              <div className="stack">
                <Gauge value={isNum(d.match.match) ? d.match.match : null} partial={(100 * d.match.creditedSum) / d.match.targetSum} threshold={profileThreshold(model, c.profileTo)}
                  label={isNum(d.match.match) ? fmtPct(d.match.match) : '—'} sub={`${d.match.creditedSum} / ${d.match.targetSum} ball`} />
                {d.reasons.length > 0 && <div className="callout warn small"><b>Nimalar yetishmadi</b><ul style={{ margin: '4px 0 0', paddingLeft: 16 }}>{d.reasons.slice(0, 4).map((r) => <li key={r}>{r}</li>)}</ul></div>}
                {d.explain && <div className="callout good small">{d.explain}</div>}
                <div className="small"><b>Keyingi qadam:</b> {d.ready ? 'Natija rahbaringiz va HR bilan muhokama qilinadi.' : 'Rivojlanish rejangizdagi vazifalarni bajaring.'}</div>
                <Appeal card={c} emp={emp} today={s.today} />
              </div>
            </div>
          </Panel>
        );
      })}
      <div className={idp.length ? 'grid g2 c1200' : 'grid'}>
        {idp.length > 0 && (
          <Panel title="Rivojlanish rejam" actions={<a className="btn sm" href="#/idp">Ochish →</a>}>
            <div className="stack" style={{ gap: 6 }}>
              {idp.slice(0, 4).map((x) => <div key={x.id} className="row between small"><span><span className="code">{x.competency}</span> {x.targetLevel}-darajaga · {fmtDate(x.due)} gacha</span><Pill tone={IDP_STATUS[x.status][1]}>{IDP_STATUS[x.status][0]}</Pill></div>)}
            </div>
          </Panel>
        )}
        <Panel title="Tasdiqlangan darajalarim" tight>
          <table><thead><tr><th>Kompetensiya</th><th className="num">Daraja</th><th>Dalil turi</th></tr></thead><tbody>
            {Object.entries(emp.records).map(([code, recs]) => {
              const r = recs.at(-1);
              return <tr key={code}><td><span className="code">{code}</span> {competencyLibrary(s.models).find((x) => x.code === code)?.name}</td><td className="num"><span className="score">{r.level}</span></td><td><Pill tone={r.context === 'work' ? 'good' : 'brand'}>{CONTEXT_LABEL[r.context]}</Pill><div className="muted small">{r.source}</div></td></tr>;
            })}
          </tbody></table>
          {!Object.keys(emp.records).length && <Empty>Tasdiqlangan yozuv yo‘q.</Empty>}
        </Panel>
      </div>
      <Panel title="Lavozim tarixi">
        <div className="hist">{emp.history.map((h, i) => <div key={i} className="it ok"><b>{h.level}</b> · {fmtDate(h.from)} dan · <span className="muted">{h.doc}</span></div>)}</div>
      </Panel>
    </>
  );
}
