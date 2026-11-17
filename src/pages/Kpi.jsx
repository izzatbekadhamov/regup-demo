import { useAppState, run } from '../state/store.js';
import { Panel, Pill, Gauge } from '../ui/common.jsx';
import { computeNewBranchKpi, fmtPct } from '../core/calc.js';
import * as D from '../core/domain.js';

export default function Kpi() {
  const s = useAppState();
  const k = s.kpiNewBranch;
  const r = computeNewBranchKpi(k.items, k);
  const emp = D.getEmployee(s, k.employeeId);
  const setItem = (i, field, raw) => run(D.updateKpi, { patch: (kk) => { kk.items[i][field] = field === 'evidence' ? raw : raw === '' ? null : Number(String(raw).replace(',', '.')); } });
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Yangi filial KPI (ramp-up)</h1>
          <p>8 band, 3 bosqich: ochilishga tayyorgarlik, ishga tushirish, barqarorlashuv. Yakuniy foiz = Σ [min(fakt ÷ reja, 1) × og‘irlik]. Shart: barcha bandlar to‘liq, compliance alohida dalil bilan tasdiqlangan va natija ≥ 75%.</p>
          <p className="small muted">{D.getBranch(s, k.branchId)?.name} · Rahbar: {emp.name} · Davr: {k.period}</p>
        </div>
        <Pill tone={r.passed ? 'good' : 'bad'}>{r.passed ? 'KPI sharti bajarilgan' : 'KPI sharti bajarilmagan'}</Pill>
      </div>
      <Panel tight>
        <table>
          <thead><tr><th>Bosqich</th><th>KPI ko‘rsatkichi</th><th className="num">Og‘irlik %</th><th className="num">Reja</th><th className="num">Fakt</th><th className="num">Bajarilish</th><th className="num">Natija</th><th>Dalil</th></tr></thead>
          <tbody>
            {r.rows.map((it, i) => (
              <tr key={i}>
                <td className="small">{it.stage}</td>
                <td>{it.name}{it.checklist && <span className="tag" style={{ marginLeft: 6 }}>checklist</span>}{it.errors.length > 0 && <div className="small" style={{ color: 'var(--bad)' }}>{it.errors.join('; ')}</div>}</td>
                {['weight', 'plan', 'fact'].map((f) => <td key={f} className="num"><input className="i compact" style={{ width: 70, textAlign: 'right' }} defaultValue={it[f] ?? ''} onBlur={(e) => setItem(i, f, e.target.value)} /></td>)}
                <td className="num">{it.done === null ? '—' : fmtPct(100 * it.done)}</td>
                <td className="num"><b>{it.weighted === null ? '—' : fmtPct(it.weighted)}</b></td>
                <td><input className="i compact" defaultValue={it.evidence} onBlur={(e) => setItem(i, 'evidence', e.target.value)} /></td>
              </tr>
            ))}
            <tr className="group-row"><td colSpan={2}>Jami</td><td className="num">{r.rows.reduce((a, x) => a + (x.weight || 0), 0)}%</td><td colSpan={3} /><td className="num">{fmtPct(r.result)}</td><td /></tr>
          </tbody>
        </table>
      </Panel>
      <div className="grid g2">
        <Panel title="Majburiy xavfsizlik / compliance">
          <div className="stack">
            <label className="row"><input type="checkbox" checked={k.compliance} onChange={(e) => run(D.updateKpi, { patch: (kk) => { kk.compliance = e.target.checked; } })} /> Majburiy compliance talablari bajarilgan</label>
            <input className="i" placeholder="Tasdiqlovchi hujjat (masalan, Yong‘in xavfsizligi akti №12)" defaultValue={k.complianceEvidence} onBlur={(e) => run(D.updateKpi, { patch: (kk) => { kk.complianceEvidence = e.target.value; } })} />
          </div>
        </Panel>
        <Panel title="Xulosa">
          <div className="stack">
            <div className="gauge-row"><Gauge value={r.result} threshold={75} tone={r.passed ? 'good' : 'bad'} label={fmtPct(r.result)} sub="chegara 75%" /><div className="small ink2">Natija = Σ min(fakt ÷ reja, 1) × vazn. Compliance alohida dalil bilan tasdiqlanishi shart.</div></div>
            {r.passed ? <div className="callout good">KPI sharti bajarilgan. Bu natija {emp.name} kartasidagi «KPI natijasi» shartiga ramp-up KPI sifatida uzatiladi.</div> : <div className="callout bad">{r.reasons.join('; ')}</div>}
            {r.errors.length > 0 && <ul className="small" style={{ color: 'var(--bad)', margin: 0 }}>{r.errors.map((e) => <li key={e}>{e}</li>)}</ul>}
          </div>
        </Panel>
      </div>
    </>
  );
}
