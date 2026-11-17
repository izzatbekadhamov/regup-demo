import { useState } from 'react';
import { useAppState, run } from '../state/store.js';
import { Panel, Pill, Empty, fmtDate, Gauge } from '../ui/common.jsx';
import * as D from '../core/domain.js';
import { computeMatch, fmtPct, isNum } from '../core/calc.js';
import { CONTEXT_LABEL } from '../ui/labels.js';
import { competencyLibrary, compMethods, methodLabel, nextProfile, profileThreshold } from '../core/modelKit.js';

const NEXT_CHECK = (model, code) => compMethods(model, model.competencies.find((c) => c.code === code)).slice(0, 2).map((m) => methodLabel(model, m)).join(' + ') || 'baholash';

function profileOptions(s) {
  const out = [];
  for (const m of s.models.filter((x) => x.status === 'active')) for (const p of m.profiles) out.push({ key: `${m.id}|${p.code}`, model: m, profile: p, label: `${p.code} — ${p.name}` });
  return out;
}

function Column({ opt, emp }) {
  const { model, profile } = opt;
  const policy = model.evidencePolicy?.context || 'work';
  const rows = Object.entries(profile.targets).map(([code, target]) => {
    const recs = emp.records[code] || [];
    const work = recs.filter((r) => r.context === 'work').at(-1);
    const learning = recs.filter((r) => r.context === 'learning').at(-1);
    const best = work || learning;
    let status, tone, hint = null;
    if (work && work.level >= target) { status = 'Bajarilgan'; tone = 'good'; }
    else if (work) { status = `${target - work.level} ball yetishmaydi`; tone = 'warn'; hint = 'Rivojlanish vazifasi'; }
    else if (learning) { status = policy === 'work' ? 'Ish dalili kerak' : 'O‘quv dalili'; tone = 'brand'; hint = 'Mentor bilan amaliy vazifa'; }
    else { status = 'Hali baholanmagan'; tone = 'muted'; hint = NEXT_CHECK(model, code); }
    return { code, target, best, status, tone, hint, workLevel: work?.level };
  });
  const scores = Object.fromEntries(rows.filter((r) => isNum(r.workLevel)).map((r) => [r.code, r.workLevel]));
  const m = computeMatch(profile.targets, scores);
  const open = rows.filter((r) => r.tone !== 'good').length;
  const threshold = profileThreshold(model, profile.code);
  return (
    <Panel title={<div><div className="row"><h2>{profile.code} — {profile.name}</h2>{emp.currentLevel === profile.code && <Pill tone="good">joriy darajangiz</Pill>}</div><div className="muted small">{model.name} · {emp.currentLevel === profile.code ? 'shu darajaga tayinlangansiz' : `o‘tish uchun ${threshold}% moslik`}</div></div>} tight>
      <div className="panel-body" style={{ borderBottom: '1px solid var(--line-2)' }}>
        <div className="row" style={{ gap: 14, flexWrap: 'nowrap' }}>
          <Gauge size={92} value={isNum(m.match) ? m.match : null} partial={(100 * m.creditedSum) / m.targetSum} threshold={threshold} label={isNum(m.match) ? fmtPct(m.match) : '—'} />
          <div>
            <b>{open ? `${open} ta talab ochiq` : 'Barcha talablar bajarilgan'}</b>
            <div className="small muted">{rows.length - open} / {rows.length} kompetensiya tasdiqlangan.{!isNum(m.match) && ' Foiz hamma kompetensiya tasdiqlangach chiqadi.'}</div>
          </div>
        </div>
      </div>
      <table>
        <thead><tr><th>Kompetensiya</th><th className="num">Kerak</th><th className="num">Sizda</th><th>Holat</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.code}>
              <td><span className="code">{r.code}</span> {model.competencies.find((c) => c.code === r.code)?.name}</td>
              <td className="num">{r.target}</td>
              <td className="num">{r.best ? <span className={`score ${r.best.context === 'work' && r.best.level >= r.target ? 'ok' : ''}`} title={CONTEXT_LABEL[r.best.context]}>{r.best.level}</span> : <span className="muted">—</span>}</td>
              <td className="small"><Pill tone={r.tone}>{r.status}</Pill>{r.hint && <div className="muted small" style={{ marginTop: 3 }}>{r.hint}</div>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

/** Kompetensiya qaysi lavozim darajalarida talab qilinadi (barcha faol modellar bo'yicha). */
function positionsFor(s, code) {
  const out = [];
  for (const m of s.models.filter((x) => x.status === 'active')) for (const p of m.profiles) if (p.targets[code] !== undefined) out.push({ model: m, profile: p, target: p.targets[code] });
  return out;
}
const workLevel = (emp, code) => (emp.records[code] || []).filter((r) => r.context === 'work').at(-1)?.level;
const learnLevel = (emp, code) => (emp.records[code] || []).filter((r) => r.context === 'learning').at(-1)?.level;

/** Har lavozim darajasiga yaqinlik: tasdiqlangan ish dalillari bo'yicha to'plangan ball ÷ maqsadli ball. */
function approachAll(s, emp) {
  const out = [];
  for (const m of s.models.filter((x) => x.status === 'active')) {
    const ownIdx = m.modelId === emp.position ? m.profiles.findIndex((p) => p.code === emp.currentLevel) : -1;
    m.profiles.forEach((p, i) => {
      if (ownIdx >= 0 && i < ownIdx) return; // o'z modelidagi pastki darajalar ko'rsatilmaydi
      const entries = Object.entries(p.targets);
      const scores = Object.fromEntries(entries.map(([c]) => [c, workLevel(emp, c)]).filter(([, v]) => isNum(v)));
      const mm = computeMatch(p.targets, scores);
      const met = entries.filter(([c, t]) => (workLevel(emp, c) ?? 0) >= t).length;
      const learning = entries.filter(([c]) => !isNum(workLevel(emp, c)) && isNum(learnLevel(emp, c))).length;
      out.push({ key: `${m.id}|${p.code}`, model: m, profile: p, total: entries.length, met, learning, credited: mm.creditedSum, targetSum: mm.targetSum, near: mm.targetSum ? (100 * mm.creditedSum) / mm.targetSum : 0, current: i === ownIdx });
    });
  }
  return out.sort((a, b) => (b.current ? 1 : 0) - (a.current ? 1 : 0) || b.near - a.near);
}

function Approach({ s, emp, focus, setFocus, onCompare, right }) {
  const lib = competencyLibrary(s.models);
  const [all, setAll] = useState(false);
  const rows = approachAll(s, emp);
  const own = rows.filter((r) => r.model.modelId === emp.position).sort((a, b) => a.model.profiles.indexOf(a.profile) - b.model.profiles.indexOf(b.profile));
  const others = rows.filter((r) => r.model.modelId !== emp.position)
    .sort((a, b) => (focus ? (b.profile.targets[focus] !== undefined ? 1 : 0) - (a.profile.targets[focus] !== undefined ? 1 : 0) : 0) || b.near - a.near);
  const othersShown = all ? others : others.slice(0, 4);
  const Row = ({ r }) => {
    const t = focus ? r.profile.targets[focus] : undefined;
    const have = focus ? workLevel(emp, focus) : undefined;
    return (
      <tr className={`${t !== undefined ? 'focus-row' : ''} ${right === r.key ? 'open' : ''}`}>
        <td>
          <div className="row" style={{ gap: 6 }}><b>{r.profile.code} — {r.profile.name}</b>{r.current && <Pill tone="good">joriy darajangiz</Pill>}</div>
          <div className="muted small">{r.model.name}</div>
        </td>
        <td>
          <div className="row" style={{ flexWrap: 'nowrap', gap: 10 }}>
            <div className="near-bar"><i style={{ width: `${r.near}%` }} /></div>
            <b className="small" style={{ minWidth: 44, textAlign: 'right' }}>{fmtPct(r.near, 0)}</b>
          </div>
        </td>
        <td className="num"><b>{r.met}</b> / {r.total}{r.learning > 0 && <div className="muted small">+{r.learning} o‘quv dalili bilan</div>}</td>
        {focus && <td className="small">{t !== undefined ? <>kerak <b>{t}</b> · sizda {isNum(have) ? <b>{have}</b> : '—'}{isNum(have) && have >= t ? <span style={{ color: 'var(--good)' }}> ✓</span> : ''}</> : <span className="muted">talab qilinmaydi</span>}</td>}
        <td className="num">{!r.current && <button className="btn sm" onClick={() => onCompare(r.key)}>Solishtirish</button>}</td>
      </tr>
    );
  };
  const cols = focus ? 5 : 4;
  return (
    <Panel title={<div><h2>Qaysi lavozimlarga yaqinlashyapsiz</h2><div className="muted small">Tasdiqlangan darajalaringiz o‘z lavozimingizning keyingi darajalari va boshqa lavozimlar bilan solishtiriladi. Bir kompetensiyani rivojlantirsangiz, u talab qilinadigan barcha lavozimlarda hisobga olinadi.</div></div>} actions={
      <label className="row small ink2" style={{ flexWrap: 'nowrap' }}>Kompetensiya bo‘yicha ko‘rish:
        <select className="i compact" value={focus} onChange={(e) => setFocus(e.target.value)}>{lib.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.name.length > 38 ? `${c.name.slice(0, 38)}…` : c.name}</option>)}</select>
      </label>
    } tight>
      <table>
        <thead><tr><th>Lavozim va daraja</th><th style={{ minWidth: 220 }}>Yaqinlik</th><th className="num">Bajarilgan talablar</th>{focus && <th>Tanlangan: {focus}</th>}<th /></tr></thead>
        <tbody>
          {own.length > 0 && <tr className="group-row"><td colSpan={cols}>Joriy lavozimingiz bo‘yicha — {own[0].model.name}</td></tr>}
          {own.map((r) => <Row key={r.key} r={r} />)}
          {others.length > 0 && <tr className="group-row"><td colSpan={cols}>Boshqa lavozimlar</td></tr>}
          {others.length > 0 && focus && <tr className="legend-row"><td colSpan={cols}><span className="legend-bar" />Yashil chiziqli lavozimlarda siz tanlagan <b>{focus} — {lib.find((c) => c.code === focus)?.name}</b> kompetensiyasi talab qilinadi. Uni rivojlantirsangiz, shu lavozimlarga yaqinlashasiz.</td></tr>}
          {othersShown.map((r) => <Row key={r.key} r={r} />)}
        </tbody>
      </table>
      {others.length > 4 && <div className="panel-body" style={{ paddingTop: 8, paddingBottom: 10 }}><button className="link-btn" onClick={() => setAll(!all)}>{all ? 'Qisqartirish' : `Boshqa lavozimlarni hammasini ko‘rsatish (${others.length})`}</button></div>}
    </Panel>
  );
}

function ExtraEvidence({ emp, s, competency, setCompetency }) {
  const [f, setF] = useState({ activityId: 'act-mentor', description: '', link: '' });
  const acts = s.activities.filter((a) => a.competency === '*' || a.competency === competency);
  const act = s.activities.find((a) => a.id === f.activityId) || acts[0];
  const mine = s.evidenceQueue.filter((x) => x.employeeId === emp.id);
  const lib = competencyLibrary(s.models);
  const actives = s.models.filter((m) => m.status === 'active');
  const shared = lib.filter((c) => actives.filter((m) => m.competencies.some((x) => x.code === c.code)).length > 1);
  const groups = [
    ...(shared.length ? [['Bir nechta lavozimda umumiy', shared]] : []),
    ...actives.map((m) => [m.name, lib.filter((c) => m.competencies.some((x) => x.code === c.code) && !shared.includes(c))]),
  ];
  const where = positionsFor(s, competency);
  const comp = lib.find((c) => c.code === competency);
  const w = workLevel(emp, competency);
  const l = learnLevel(emp, competency);
  return (
    <Panel title="Qo‘shimcha kompetensiya dalili">
      <div className="stack">
        <p className="small ink2">Joriy lavozimingizdan tashqaridagi kompetensiyaga ham ish yoki o‘quv dalili yuboring. Tasdiqlangan daraja shu kompetensiya talab qilinadigan barcha lavozimlarda hisobga olinadi.</p>
        <label className="f">Kompetensiya
          <select className="i" value={competency} onChange={(e) => { const c = e.target.value; setCompetency(c); const a = s.activities.find((x) => x.competency === c) || s.activities.find((x) => x.competency === '*'); setF({ ...f, activityId: a.id }); }}>
            {groups.map(([g, list]) => list.length > 0 && <optgroup key={g} label={g}>{list.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.name}{shared.includes(c) ? ` · ${actives.filter((m) => m.competencies.some((x) => x.code === c.code)).map((m) => m.name).join(', ')}` : ''}</option>)}</optgroup>)}
          </select>
        </label>
        <div className="where">
          <div className="row between"><b className="small">{comp?.name}</b><span className="small">Sizda: {isNum(w) ? <b>{w} (ish dalili)</b> : isNum(l) ? <b>{l} (o‘quv dalili)</b> : <span className="muted">tasdiqlanmagan</span>}</span></div>
          <div className="small muted" style={{ marginTop: 4 }}>Qaysi lavozimlarda kerak:</div>
          <div className="row" style={{ marginTop: 4 }}>
            {where.map((x) => {
              const ok = isNum(w) && w >= x.target;
              return <span key={`${x.model.id}${x.profile.code}`} className={`pos-chip ${ok ? 'ok' : ''}`} title={x.model.name}>{x.profile.code} {x.profile.name.split(' (')[0]} · <b>{x.target}</b>{ok ? ' ✓' : ''}</span>;
            })}
          </div>
        </div>
        <label className="f">Faoliyat
          <select className="i" value={act?.id} onChange={(e) => setF({ ...f, activityId: e.target.value })}>
            {acts.map((a) => <option key={a.id} value={a.id}>{a.name} (maks. {a.maxLevel}-daraja)</option>)}
          </select>
        </label>
        <textarea className="i" placeholder="Nima qildingiz, shaxsiy hissangiz va natija" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        <input className="i" placeholder="Ilova yoki havola (ixtiyoriy)" value={f.link} onChange={(e) => setF({ ...f, link: e.target.value })} />
        <button className="btn primary" disabled={!f.description.trim()} onClick={() => run(D.submitExtraEvidence, { employeeId: emp.id, competency, activityId: act?.id, description: f.description, link: f.link, context: act?.type === 'course' ? 'learning' : 'work' }, 'Dalil HR/baholovchiga yuborildi') && setF({ ...f, description: '', link: '' })}>Yuborish</button>
        {mine.length > 0 && (
          <table><tbody>{mine.map((x) => <tr key={x.id}><td className="code">{x.competency}</td><td className="small">{x.description}</td><td><Pill tone={x.status === 'approved' ? 'good' : x.status === 'pending' ? 'warn' : 'bad'}>{x.status === 'approved' ? `${x.level}-daraja · ${CONTEXT_LABEL[x.context]}` : x.status === 'pending' ? 'Tekshiruvda' : 'Rad etilgan'}</Pill></td></tr>)}</tbody></table>
        )}
      </div>
    </Panel>
  );
}

export default function Career({ emp }) {
  const s = useAppState();
  const opts = profileOptions(s);
  const curKey = opts.find((o) => o.profile.code === emp.currentLevel)?.key || opts[0].key;
  const curOpt = opts.find((o) => o.profile.code === emp.currentLevel);
  const nextDefault = curOpt ? nextProfile(curOpt.model, emp.currentLevel) : opts[0].profile.code;
  const [left, setLeft] = useState(curKey);
  const [right, setRight] = useState(opts.find((o) => o.profile.code === nextDefault)?.key || opts[1].key);
  const L = opts.find((o) => o.key === left);
  const R = opts.find((o) => o.key === right);
  const target = R.profile.code;
  const interest = s.interests.find((x) => x.employeeId === emp.id && x.target === target);
  const suc = s.succession.find((x) => x.employeeId === emp.id && x.target === target);
  const [note, setNote] = useState('');
  const [focus, setFocus] = useState(() => (emp.position === 'FR' ? 'KOR-03' : 'LDR-04'));
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Karyera yo‘lim</h1>
          <p>Qaysi lavozimlarga qanchalik yaqinsiz, nimasi yetishmaydi va qanday rivojlanish mumkin — o‘z lavozimingiz va boshqa lavozimlar bo‘yicha.</p>
        </div>
        <div className="row">
          <select className="i compact" value={left} onChange={(e) => setLeft(e.target.value)}>{opts.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}</select>
          <span>⇄</span>
          <select className="i compact" value={right} onChange={(e) => setRight(e.target.value)}>{opts.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}</select>
        </div>
      </div>
      <Approach s={s} emp={emp} focus={focus} setFocus={setFocus} right={right} onCompare={(k) => { setRight(k); setTimeout(() => document.querySelector('.cmp')?.scrollIntoView({ behavior: 'smooth' }), 30); }} />
      <div className="cmp">
        <Column opt={L} emp={emp} />
        <Column opt={R} emp={emp} />
      </div>
      <div className="grid g2">
        <Panel title={`Qiziqish va rivojlanish: ${target}`}>
          {interest ? (
            <div className="stack">
              <div className="callout good">Qiziqish {fmtDate(interest.at)} da HRga bildirilgan. «{interest.note}»</div>
              {suc && <div className="small">HR ro‘yxatidagi holat: <b>{{ interested: 'Qiziqish bildirgan', developing: 'Rivojlanmoqda', trial: 'Amaliy sinovga tavsiya', assessed: 'Tayyorligi baholangan', reserve: 'Kadrlar zaxirasi', appointed: 'Tayinlangan' }[suc.status]}</b> · keyingi qadam: {suc.next || 'HR rejalashtiradi'}</div>}
              <p className="muted small">Rezervga kiritish maqsadli lavozim bo‘yicha e’lon qilingan tayyorlik xulosasi va vakolatli qarorga bog‘liq.</p>
            </div>
          ) : (
            <div className="stack">
              <p className="small ink2">Tanlangan yo‘nalishga qiziqishingizni HRga bildiring. Keyingi qadam sifatida kurs, keys, mentor bilan ish yoki real loyiha rejalashtiriladi.</p>
              <textarea className="i" placeholder="Nega bu yo‘nalish? Qanday amaliy vazifaga tayyorsiz?" value={note} onChange={(e) => setNote(e.target.value)} />
              <button className="btn primary" onClick={() => run(D.expressInterest, { employeeId: emp.id, target, note: note || '—' }, 'Qiziqish HRga bildirildi')}>HRga qiziqish bildirish</button>
            </div>
          )}
        </Panel>
        <ExtraEvidence emp={emp} s={s} competency={focus} setCompetency={setFocus} />
      </div>
    </>
  );
}
