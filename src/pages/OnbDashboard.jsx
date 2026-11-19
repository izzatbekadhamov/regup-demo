import { useState } from 'react';
import { useAppState, run } from '../state/store.js';
import { Panel, Pill, Stat, Person, Empty } from '../ui/common.jsx';
import * as D from '../core/domain.js';
import * as A from '../core/onbAnalytics.js';
import { OnbScore, OnbStages } from './Onboarding.jsx';

const P = (v) => (v === null || v === undefined ? '—' : `${Math.round(v)}%`);
const N1 = (v) => (v === null || v === undefined ? '—' : (Math.round(v * 10) / 10).toString().replace('.', ','));
const R2 = (v) => (v === null || v === undefined ? '—' : v.toFixed(2).replace('.', ','));
const POS = { GE: 'Ustoz (GE)', FIN: 'Moliya menejeri', FR: 'Filial rahbari' };
const SRC = { recruiting: 'Recruiting orqali', branch: 'Filial o‘zi olgan' };
const C1 = 'var(--brand)';
const C2 = 'var(--teal)';

/** Gorizontal ustun: 24px dan ingichka, uchi yumaloq, qiymat — uchida. */
function HBar({ v, max = 100, color = C1, label, title }) {
  const w = v === null || v === undefined ? 0 : Math.max(0, Math.min(100, (100 * v) / max));
  return (
    <div className="hbar" title={title}>
      <div className="hbar-track"><i style={{ width: `${w}%`, background: color }} /></div>
      <span className="hbar-v">{label ?? P(v)}</span>
    </div>
  );
}
function Legend({ items }) {
  return <div className="legend">{items.map(([c, l]) => <span key={l}><i style={{ background: c }} />{l}</span>)}</div>;
}

function Scatter({ pts, metric }) {
  const [hov, setHov] = useState(null);
  const W = 520; const H = 260; const pad = { l: 44, r: 14, t: 12, b: 34 };
  const ys = pts.map((p) => p.y);
  const yMin = Math.floor((Math.min(...ys) - 2) / 5) * 5;
  const yMax = Math.ceil((Math.max(...ys) + 2) / 5) * 5;
  const x = (v) => pad.l + ((v - 1) / 4) * (W - pad.l - pad.r);
  const y = (v) => H - pad.b - ((v - yMin) / (yMax - yMin)) * (H - pad.t - pad.b);
  const ticks = []; for (let t = yMin; t <= yMax; t += 5) ticks.push(t);
  return (
    <div className="scatter">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Onboarding bahosi va 2-oy KPI">
        {ticks.map((t) => <g key={t}><line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} className="grid" /><text x={pad.l - 6} y={y(t) + 4} className="ax" textAnchor="end">{t}%</text></g>)}
        {[1, 2, 3, 4, 5].map((t) => <text key={t} x={x(t)} y={H - pad.b + 16} className="ax" textAnchor="middle">{t}</text>)}
        <text x={(W + pad.l) / 2} y={H - 4} className="ax" textAnchor="middle">Onboarding bahosi (1–5)</text>
        {pts.map((p, i) => (
          <circle key={p.row.id} cx={x(p.x)} cy={y(p.y)} r={hov === i ? 7 : 5} fill={C1} stroke="#fff" strokeWidth="2" onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)} style={{ cursor: 'pointer' }} />
        ))}
      </svg>
      <div className="scatter-tip small">{hov !== null ? <><b>{pts[hov].row.name}</b> · {D.ONB_LABEL(pts[hov].x)} {N1(pts[hov].x)} ball → 2-oy {metric === 'retention' ? 'o‘quvchi retentioni' : 'konversiya'} <b>{N1(pts[hov].y)}%</b> · mentor {pts[hov].row.mentor}</> : <span className="muted">Nuqta ustiga olib boring — xodim, ball va KPI.</span>}</div>
    </div>
  );
}

export default function OnbDashboard({ user }) {
  const s = useAppState();
  const scope = D.scopeBranches(s, user);
  const [f, setF] = useState({ branch: '', position: '', source: '', from: '', to: '' });
  const [dim, setDim] = useState('mentor');
  const [metric, setMetric] = useState('retention');
  const rows = A.onbRows(s, f, scope);
  const histN = rows.filter((r) => !r.live).length;
  const r30 = A.retention(rows, s.today, 30);
  const r60 = A.retention(rows, s.today, 60);
  const coh = A.cohorts(rows, s.today);
  const leave = A.leaveStages(rows, s.today);
  const proc = A.processByBranch(s, scope).filter((r) => !f.branch || r.branchId === f.branch);
  const tot = A.processTotals(proc);
  const load = A.mentorLoad(s, scope);
  const dq = A.dataQuality(s, scope);

  const active = (s.onboardings || []).filter((o) => o.status === 'active' && (!scope || scope.has(D.getEmployee(s, o.employeeId).branchId))).filter((o) => {
    const e = D.getEmployee(s, o.employeeId);
    return (!f.branch || e.branchId === f.branch) && (!f.position || e.position === f.position) && (!f.source || o.source === f.source);
  }).map((ob) => ({ ob, emp: D.getEmployee(s, ob.employeeId), p: A.liveProgress(s, ob) }));
  const risk = A.riskList(s, scope).filter((x) => active.some((a) => a.ob.id === x.ob.id));
  const mast = A.masteryStats(rows);
  const teachers = rows.filter((r) => r.position === 'GE');
  const cor = A.correlation(teachers, metric);
  const corOk = cor.n >= A.CORR_MIN_N;
  const best = [...cor.parts].filter((p) => p.r !== null).sort((a, b) => b.r - a.r);
  const prod = A.productivity(rows);
  const dimRows = A.breakdown(dim === 'mentor' ? teachers : rows, s.today, dim === 'mentor' ? 'mentor' : 'branchId');
  const srcRows = A.breakdown(rows, s.today, 'source');
  const months = [...new Set((s.onbHistory || []).map((r) => A.monthOf(r.startedAt)).concat((s.onboardings || []).map((o) => A.monthOf(o.startedAt))))].sort();
  const stCount = Object.keys(A.LIVE_STATUS).map((k) => [k, active.filter((a) => a.p.status === k).length]);
  const worstCourse = [...mast.byCourse].sort((a, b) => a.onTime - b.onTime)[0];
  const completed = rows.filter((r) => r.score !== null);
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Onboarding dashboard</h1>
          <p>Yangi xodimlar ishda qolyaptimi, moslashuv qanday ketyapti, kim xavf ostida va onboarding bahosi keyingi natijani bashorat qiladimi.</p>
          <p className="small"><Pill tone="warn">Demo ma’lumot</Pill> <span className="muted">{histN} ta sun’iy tarixiy yozuv (may–oktabr 2026) + {rows.length - histN} ta jonli moslashuv. Ishchi tizimda Jobster, Edu va RegUP’dan yig‘iladi.</span></p>
        </div>
      </div>
      <div className="filter-row">
        {!scope && <select className="i compact" value={f.branch} onChange={(e) => setF({ ...f, branch: e.target.value })}><option value="">Barcha filiallar</option>{s.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>}
        <select className="i compact" value={f.position} onChange={(e) => setF({ ...f, position: e.target.value })}><option value="">Barcha lavozimlar</option>{Object.entries(POS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <select className="i compact" value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })}><option value="">Barcha manbalar</option>{Object.entries(SRC).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <span className="small muted">Ishga kirgan oy:</span>
        <select className="i compact" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })}><option value="">boshidan</option>{months.map((m) => <option key={m} value={m}>{D.monthName(m)}</option>)}</select>
        <select className="i compact" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })}><option value="">oxirigacha</option>{months.map((m) => <option key={m} value={m}>{D.monthName(m)}</option>)}</select>
        {scope && <span className="small muted">{user.title}: faqat o‘z filialingiz</span>}
      </div>

      <div className="grid g3">
        <Stat k="1 oylik retention" v={P(r30.pct)} s={`${r30.kept} / ${r30.n} xodim 30-kunda ishlayapti`} icon="users" tone={r30.pct !== null && r30.pct < 75 ? 'bad' : ''} />
        <Stat k="2 oylik retention" v={P(r60.pct)} s={`${r60.kept} / ${r60.n} xodim 60-kunda ishlayapti`} icon="users" tone={r60.pct !== null && r60.pct < 70 ? 'bad' : ''} />
        <Stat k="Hozir moslashuvda" v={active.length} s={`${stCount.find(([k]) => k === 'ontrack')[1]} tasi reja bo‘yicha · ${risk.length} tasi xavf guruhida`} icon="route" tone={risk.length ? 'warn' : ''} />
        <Stat k="Kurslarni muddatida yakunlash" v={P(mast.onTime)} s={`birinchi urinishda test: ${P(mast.firstPass)}`} icon="cards" />
        <Stat k="O‘rtacha onboarding bahosi" v={N1(completed.length ? completed.reduce((a, r) => a + r.score, 0) / completed.length : null)} s={`${completed.length} ta yakunlangan · badge ${P(100 * completed.filter((r) => r.badge).length / (completed.length || 1))}`} icon="check" />
        <Stat k="30 kun ichida ketganlar" v={P(leave.early.pct)} s={`${leave.early.n} / ${leave.early.of} xodim · 30 kuni to‘lganlardan`} icon="trend" tone={leave.early.pct !== null && leave.early.pct > 20 ? 'bad' : ''} />
        <Stat k="Standartlar bajarilishi" v={P(tot.checklist)} s={`8 bandli nazorat ro‘yxati · javob ulushi ${P(tot.rate)}`} icon="check" tone={tot.checklist !== null && tot.checklist < 80 ? 'warn' : ''} />
        <Stat k="eNPS (D30, D60)" v={tot.enps === null ? '—' : Math.round(tot.enps)} s="tavsiya qilish, −100…+100 · anonim" icon="users" />
      </div>

      <div className="grid g2">
        <Panel title={<div><h2>Kohorta bo‘yicha retention: 30, 60, 90 kun</h2><div className="muted small">Ishga kirgan oy bo‘yicha: 30, 60 va 90 kun o‘tganda nechasi ishlayapti</div></div>} actions={<Legend items={[[C1, '30-kun'], [C2, '60-kun']]} />}>
          <table className="small">
            <thead><tr><th>Ishga kirgan oy</th><th className="num">Kirdi</th><th style={{ width: '58%' }}>Ishda qolganlar</th><th className="num">90-kun</th></tr></thead>
            <tbody>{coh.map((c) => (
              <tr key={c.month}>
                <td>{D.monthName(c.month)}</td>
                <td className="num">{c.n}</td>
                <td>
                  {c.r30.n ? <HBar v={c.r30.pct} color={C1} label={`${P(c.r30.pct)} (${c.r30.kept}/${c.r30.n})`} /> : <span className="muted">30 kun hali to‘lmagan</span>}
                  <div style={{ height: 4 }} />
                  {c.r60.n ? <HBar v={c.r60.pct} color={C2} label={`${P(c.r60.pct)} (${c.r60.kept}/${c.r60.n})`} /> : <span className="muted">60 kun hali to‘lmagan</span>}
                </td>
                <td className="num">{c.r90.n ? <>{P(c.r90.pct)} <span className="muted">{c.r90.kept}/{c.r90.n}</span></> : <span className="muted">—</span>}</td>
              </tr>
            ))}</tbody>
          </table>
        </Panel>

        <Panel title={<div><h2>Qaysi bosqichda ketishadi</h2><div className="muted small">Birinchi 60 kunda ketganlar: {leave.total} ta</div></div>}>
          <div className="stack">
            {leave.stages.map((x) => <div key={x.key}><div className="small">{x.label}</div><HBar v={x.n} max={Math.max(1, ...leave.stages.map((y) => y.n))} label={`${x.n} ta`} /></div>)}
            <div className="small"><b>Ketish sabablari (Edu):</b> {leave.reasons.map(([r, n]) => `${r} — ${n}`).join(' · ') || '—'}</div>
            <div className="callout small"><b>30 kun ichida ketganlar:</b> {leave.early.n} ta ({P(leave.early.pct)}). Sabablari: {leave.early.reasons.map(([r, n]) => `${r} — ${n}`).join(' · ') || '—'}. Ularga Jobster orqali Fail Case so‘rovnomasi avtomatik boradi.</div>
          </div>
        </Panel>
      </div>

      <div className="stack">
        <Panel title={<div><h2>Jarayondagilar holati</h2><div className="muted small">O‘zlashtirish indeksi = bajarilgani ÷ shu kungacha rejadagisi</div></div>}>
          {active.length ? (
            <div className="stack">
              <div className="stackbar">{stCount.filter(([, n]) => n).map(([k, n]) => <i key={k} className={A.LIVE_STATUS[k][1]} style={{ flex: n }} title={`${A.LIVE_STATUS[k][0]}: ${n}`} />)}</div>
              <div className="legend">{stCount.map(([k, n]) => <span key={k}><i className={`dot-${A.LIVE_STATUS[k][1]}`} />{A.LIVE_STATUS[k][0]}: {n}</span>)}</div>
              <table className="small"><tbody>{active.sort((a, b) => a.p.index - b.p.index).map(({ ob, emp, p }) => (
                <tr key={ob.id}>
                  <td><a href={`#/onboarding/${ob.id}`}><b>{emp.name}</b></a><div className="muted">{D.getBranch(s, emp.branchId)?.name}</div></td>
                  <td><OnbStages day={p.day} /></td>
                  <td style={{ width: '34%' }}><HBar v={Math.min(100, p.index * 100)} label={`${p.done}/${p.total}`} color={p.status === 'ontrack' ? 'var(--good)' : p.status === 'overdue' ? 'var(--bad)' : 'var(--warn)'} /></td>
                  <td><Pill tone={A.LIVE_STATUS[p.status][1]}>{A.LIVE_STATUS[p.status][0]}</Pill>{p.pending > 0 && <div className="muted">{p.pending} ta topshiriq tekshiruvda</div>}</td>
                </tr>
              ))}</tbody></table>
            </div>
          ) : <Empty>Moslashuvda xodim yo‘q.</Empty>}
        </Panel>

        <Panel title={<div><h2>Xavf guruhi — oldindan ogohlantirish</h2><div className="muted small">Ortda qolish, boshlamaslik, kech kiritilish, kuzatuv yo‘qligi. So‘rovnomalar anonim, shuning uchun bu yerda ishlatilmaydi.</div></div>}>
          {risk.length ? <div className="grid g2">{risk.map(({ ob, emp, p, reasons }) => {
            const sent = (ob.riskFlags || []).some((x) => x.at === s.today);
            const mentor = emp.supervisorId ? D.getEmployee(s, emp.supervisorId)?.name : null;
            return (
              <div key={ob.id} className="idp-row">
                <div className="row between"><Person name={emp.name} sub={`${p.day}-kun · ${D.getBranch(s, emp.branchId)?.name} · mentor: ${mentor || 'biriktirilmagan'}`} />
                  {sent ? <Pill tone="good">xabar yuborildi</Pill> : <button className="btn sm" onClick={() => run(D.flagRisk, { onboardingId: ob.id, reasons, actor: user.name }, `${mentor || 'HR'}ga xabar yuborildi`)}>{mentor ? 'Mentorga xabar' : 'HR’ga xabar'}</button>}
                </div>
                <div className="row" style={{ gap: 4 }}>{reasons.map((r) => <span key={r} className="pill warn">{r}</span>)}</div>
              </div>
            );
          })}</div> : <Empty icon="check">Xavf belgisi bor xodim yo‘q.</Empty>}
        </Panel>
      </div>

      <Panel title={<div><h2>Onboarding jarayoni filiallar kesimida</h2><div className="muted small">Anonim so‘rovnomalar (Google Forms → Sheets) va Jobster/EduTizim jamlanmasi · {D.monthName(s.surveyStats.period)} · DEMO raqamlar</div></div>}
        actions={!scope && <button className="btn sm" disabled={!tot.low} onClick={() => run(D.remindLowResponse, { actor: user.name }, 'Filial rahbarlariga eslatma yuborildi')}>Javob ulushi past filiallarga eslatma ({tot.low})</button>}>
        <div className="grid g4">
          <div><div className="small muted">Ma’lumot 3 kun ichida keldi</div><div className="big-num">{P(tot.dataIn3)}</div></div>
          <div><div className="small muted">Jobster’da o‘z vaqtida tasdiqlandi</div><div className="big-num">{P(tot.jobsterOnTime)}</div></div>
          <div><div className="small muted">So‘rovnomaga javob ulushi</div><div className="big-num">{P(tot.rate)}</div><div className="small muted">maqsad ≥ {D.SURVEY_MIN_RATE}%</div></div>
          <div><div className="small muted">Standartlar bajarilishi</div><div className="big-num">{P(tot.checklist)}</div><div className="small muted">maqsad 100%</div></div>
        </div>
        <table className="small" style={{ marginTop: 12 }}>
          <thead><tr><th>Filial</th><th className="num">Yangi xodim</th><th className="num">Javob ulushi</th><th className="num">D8</th><th className="num">D30</th><th className="num">D60</th><th className="num">eNPS</th><th style={{ width: '22%' }}>Standartlar</th></tr></thead>
          <tbody>{proc.map((r) => <tr key={r.branchId}><td>{D.getBranch(s, r.branchId)?.name}</td><td className="num">{r.hires}</td><td className="num">{r.rate !== null && r.rate < D.SURVEY_MIN_RATE ? <Pill tone="warn">{P(r.rate)}</Pill> : P(r.rate)}</td><td className="num">{N1(r.d8[1])}</td><td className="num">{N1(r.d30[1])}</td><td className="num">{N1(r.d60[1])}</td><td className="num">{r.enps}</td><td><HBar v={r.checklistPct} color={r.checklistPct < 80 ? 'var(--warn)' : 'var(--good)'} /></td></tr>)}</tbody>
        </table>
        <h3 className="small" style={{ margin: '14px 0 6px' }}>Nazorat ro‘yxati: har band bo‘yicha «Ha» ulushi</h3>
        <table className="small"><tbody>{D.CHECKLIST_ITEMS.map(([src, label], i) => <tr key={label}><td><span className="muted">{src}</span> {label}</td><td style={{ width: '34%' }}><HBar v={tot.items[i]} color={tot.items[i] < 80 ? 'var(--warn)' : 'var(--good)'} /></td></tr>)}</tbody></table>
        <div className="small muted" style={{ marginTop: 6 }}>So‘rovnomalarda xodim ID’si yo‘q: natijalar faqat filial va lavozim bo‘yicha ko‘rsatiladi, alohida xodimga bog‘lanmaydi.</div>
      </Panel>

      <div className="grid g2">
        <Panel title={<div><h2>Mentor yuklamasi</h2><div className="muted small">Hozir moslashuvdagi yangi xodimlar, mentor bo‘yicha</div></div>}>
          {load.length ? <table className="small"><tbody>{load.map(([m, n]) => <tr key={m}><td>{m}</td><td style={{ width: '50%' }}><HBar v={n} max={Math.max(3, ...load.map((x) => x[1]))} label={`${n} ta`} color={m === 'biriktirilmagan' ? 'var(--warn)' : C1} /></td></tr>)}</tbody></table> : <Empty>Moslashuvda xodim yo‘q.</Empty>}
          <div className="small muted" style={{ marginTop: 6 }}>Mentorlar natijasi pastdagi «Mentorlar kesimida» jadvalida.</div>
        </Panel>
        <Panel title={<div><h2>Ma’lumot sifati</h2><div className="muted small">Kech yoki noto‘g‘ri ma’lumot boshqa ko‘rsatkichlarni buzadi</div></div>}>
          <table className="small"><tbody>
            <tr><td>EduTizim’ga kech kiritilgan (≥ {s.onboardingConfig.lateDays} kun)</td><td className="num"><b>{dq.late}</b> / {dq.lateOf}</td></tr>
            <tr><td>Dublikat akkauntlar</td><td className="num"><b>{dq.dups}</b></td></tr>
            <tr><td>1 oydan kech arxivlangan</td><td className="num"><b>{dq.lateArchive}</b></td></tr>
            <tr><td>Reboarding — qaytib kelganlar</td><td className="num"><b>{dq.reboarding}</b></td></tr>
            <tr><td>CEO/HRD uchrashuvida qatnashgan (30 kuni to‘lganlardan)</td><td className="num"><b>{dq.ceo}</b> / {dq.ceoOf}</td></tr>
          </tbody></table>
        </Panel>
      </div>

      <Panel title={<div><h2>O‘zlashtirish ko‘rsatkichi</h2><div className="muted small">Moslashuv kurslari bo‘yicha: {mast.n} ta kurs yozuvi</div></div>}>
        <div className="grid g4">
          <div><div className="small muted">Muddatida yakunlandi</div><div className="big-num">{P(mast.onTime)}</div></div>
          <div><div className="small muted">Testni birinchi urinishda topshirdi</div><div className="big-num">{P(mast.firstPass)}</div></div>
          <div><div className="small muted">O‘rtacha test natijasi</div><div className="big-num">{P(mast.test)}</div></div>
          <div><div className="small muted">O‘rtacha yakunlash vaqti</div><div className="big-num">{N1(mast.days)} kun</div></div>
        </div>
        <table className="small" style={{ marginTop: 12 }}>
          <thead><tr><th>Kurs</th><th className="num">Yozuv</th><th style={{ width: '24%' }}>Muddatida</th><th style={{ width: '24%' }}>1-urinishda test</th><th className="num">O‘rt. test</th><th className="num">O‘rt. kun</th></tr></thead>
          <tbody>{mast.byCourse.map((c) => <tr key={c.courseId}><td>{D.getCourse(s, c.courseId)?.title}</td><td className="num">{c.n}</td><td><HBar v={c.onTime} /></td><td><HBar v={c.firstPass} /></td><td className="num">{P(c.test)}</td><td className="num">{N1(c.days)}</td></tr>)}</tbody>
        </table>
        {worstCourse && worstCourse.onTime < 50 && <div className="callout warn small" style={{ marginTop: 10 }}>«{D.getCourse(s, worstCourse.courseId)?.title}» kursini muddatida faqat {P(worstCourse.onTime)} yakunlayapti. Kurs hajmini yoki 30 kunlik muddatni qayta ko‘rib chiqish kerak.</div>}
      </Panel>

      <Panel title={<div><h2>Onboarding bahosi va 2-oy KPI (ustozlar)</h2><div className="muted small">Har nuqta — bitta ustoz. Bog‘liqlik bor degani sabab bor degani emas.</div></div>} actions={
        <select className="i compact" value={metric} onChange={(e) => setMetric(e.target.value)}><option value="retention">2-oy o‘quvchi retentioni</option><option value="conversion">2-oy 1-oy konversiyasi</option></select>}>
        <div className="grid g2">
          {cor.pts.length ? <Scatter pts={cor.pts} metric={metric} /> : <Empty>Ma’lumot yetarli emas.</Empty>}
          <div className="stack">
            <div className="row" style={{ gap: 12, alignItems: 'baseline' }}><div className="big-num">r = {R2(cor.r)}</div><span className="small">{A.rWord(cor.r)} bog‘liqlik · {cor.n} ustoz</span></div>
            {!corOk && <div className="callout warn small">Xulosa uchun kamida {A.CORR_MIN_N} ta xodim kerak, hozir {cor.n} ta. Raqamlar faqat yo‘nalish ko‘rsatadi, og‘irliklar shunga qarab o‘zgartirilmaydi.</div>}
            <table className="small"><tbody>
              <tr><td>Ball ≥ 4 bo‘lgan ustozlar ({cor.hi.n})</td><td className="num"><b>{N1(cor.hi.kpi)}%</b></td></tr>
              <tr><td>Ball &lt; 3,5 bo‘lgan ustozlar ({cor.lo.n})</td><td className="num"><b>{N1(cor.lo.kpi)}%</b></td></tr>
            </tbody></table>
            <h3 className="small" style={{ margin: '6px 0 0' }}>Metodologiyani tekshirish: qaysi qism KPI’ni yaxshiroq bashorat qiladi</h3>
            <table className="small"><tbody>{cor.parts.map((p) => <tr key={p.key}><td>{p.label}</td><td style={{ width: '45%' }}><HBar v={p.r === null ? 0 : Math.max(0, p.r) * 100} label={`r = ${R2(p.r)}`} /></td></tr>)}</tbody></table>
            {corOk && best.length > 1 && <div className="callout small">Eng kuchli bashoratchi — <b>{best[0].label.toLowerCase()}</b> (r = {R2(best[0].r)}), eng kuchsizi — <b>{best.at(-1).label.toLowerCase()}</b> (r = {R2(best.at(-1).r)}). Taklif: og‘irlikni kuchli qismga oshirish (hozir hammasi {s.onboardingConfig.weights.obs}%) — «Moslashuv» sahifasidagi metodologiya blokida.</div>}
          </div>
        </div>
      </Panel>

      <div className="stack">
        <Panel title={<div><h2>{dim === 'mentor' ? 'Mentorlar kesimida (ustozlar)' : 'Filiallar kesimida'}</h2><div className="muted small">Onboarding sifati — xodimlar raqobat reytingi emas</div></div>} actions={
          <select className="i compact" value={dim} onChange={(e) => setDim(e.target.value)}><option value="mentor">Mentor</option><option value="branch">Filial</option></select>}>
          <table className="small">
            <thead><tr><th>{dim === 'mentor' ? 'Mentor' : 'Filial'}</th><th className="num">Xodim</th><th className="num">30-kun</th><th className="num">60-kun</th><th className="num">O‘rt. ball</th><th className="num">2-oy KPI</th></tr></thead>
            <tbody>{dimRows.map((b) => <tr key={b.key}><td>{dim === 'mentor' ? (b.key && b.key !== '—' ? b.key : 'biriktirilmagan') : D.getBranch(s, b.key)?.name}</td><td className="num">{b.n}</td><td className="num">{P(b.r30.pct)} <span className="muted">{b.r30.kept}/{b.r30.n}</span></td><td className="num">{b.r60.n ? <>{P(b.r60.pct)} <span className="muted">{b.r60.kept}/{b.r60.n}</span></> : '—'}</td><td className="num">{N1(b.score)}</td><td className="num">{b.kpi === null ? '—' : `${N1(b.kpi)}%`}</td></tr>)}</tbody>
          </table>
          <div className="small muted" style={{ marginTop: 6 }}>60-kun faqat 60 kuni to‘lgan xodimlardan hisoblanadi, shuning uchun 30-kundan yuqori chiqishi mumkin. 5 tadan kam xodimli qator bo‘yicha xulosa qilmang.</div>
        </Panel>

        <div className="grid g2">
          <Panel title="Manba: recruiting yoki filial o‘zi olgan" actions={<Legend items={[[C1, SRC.recruiting], [C2, SRC.branch]]} />}>
            <table className="small"><tbody>
              {[['30-kun retention', (b) => b.r30.pct, 100, P], ['60-kun retention', (b) => b.r60.pct, 100, P], ['O‘rtacha ball', (b) => b.score, 5, N1]].map(([l, get, max, fmt]) => (
                <tr key={l}><td style={{ width: '32%' }}>{l}</td><td>{['recruiting', 'branch'].map((k) => { const b = srcRows.find((x) => x.key === k); return b ? <HBar key={k} v={get(b)} max={max} color={k === 'recruiting' ? C1 : C2} label={fmt(get(b))} /> : null; })}</td></tr>
              ))}
            </tbody></table>
            <div className="small muted" style={{ marginTop: 4 }}>{srcRows.map((b) => `${SRC[b.key]}: ${b.n} ta`).join(' · ')}</div>
          </Panel>
          <Panel title={<div><h2>Ishga tayyor bo‘lish vaqti</h2><div className="muted small">Yangi ustoz KPI chegarasini (retention 90%) birinchi marta qaysi oyda bajardi</div></div>}>
            <div className="cols">{prod.buckets.map((b) => (
              <div key={b.label} className="col"><span className="col-v">{b.n}</span><i style={{ height: `${(100 * b.n) / Math.max(1, ...prod.buckets.map((x) => x.n))}%` }} /><span className="col-l">{b.label}</span></div>
            ))}</div>
            <div className="small muted">O‘rtacha: {N1(prod.avg)}-oy · {prod.n} ustoz</div>
          </Panel>
        </div>
      </div>
      {completed.length > 0 && <p className="small muted">Ball shkalasi: <OnbScore v={4.5} /> a’lo · <OnbScore v={3.5} /> yaxshi · <OnbScore v={2.5} /> qoniqarli. Kompetensiya baholari reytingga kirmaydi (TZ).</p>}
    </>
  );
}
