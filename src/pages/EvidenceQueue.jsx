import { useState } from 'react';
import { useAppState, run } from '../state/store.js';
import { Panel, Pill, Empty, fmtDate } from '../ui/common.jsx';
import * as D from '../core/domain.js';
import { CONTEXT_LABEL } from '../ui/labels.js';
import { competencyLibrary } from '../core/modelKit.js';

function Item({ x, s }) {
  const act = s.activities.find((a) => a.id === x.activityId);
  const [f, setF] = useState({ level: String(Math.min(act?.maxLevel || 3, 3)), reason: '' });
  const comp = competencyLibrary(s.models).find((c) => c.code === x.competency);
  return (
    <div className="panel" style={{ padding: 14 }}>
      <div className="row between">
        <b>{D.getEmployee(s, x.employeeId).name} · <span className="code">{x.competency}</span> {comp?.name}</b>
        <span className="muted small">{fmtDate(x.at)}</span>
      </div>
      <p className="small" style={{ marginTop: 6 }}>{x.description}</p>
      <div className="row small" style={{ marginTop: 6 }}>
        <Pill tone="brand">{CONTEXT_LABEL[x.context]}</Pill>
        {act && <span>Faoliyat: {act.name} · <b>maks. {act.maxLevel}-daraja</b></span>}
        {x.link && <span className="code">{x.link}</span>}
      </div>
      {x.status === 'pending' ? (
        <div className="row" style={{ marginTop: 10 }}>
          <select className="i compact" value={f.level} onChange={(e) => setF({ ...f, level: e.target.value })}>{Array.from({ length: comp?.scaleMax || 5 }, (_, i) => i + 1).map((n) => <option key={n}>{n}</option>)}</select>
          <input className="i" style={{ flex: 1 }} placeholder="Asos: rubrika indikatori va dalil" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} />
          <button className="btn primary sm" onClick={() => run(D.reviewExtraEvidence, { id: x.id, decision: 'approved', level: Number(f.level), reason: f.reason }, 'Dalil tasdiqlandi va profilga yozildi')}>Tasdiqlash</button>
          <button className="btn danger sm" onClick={() => run(D.reviewExtraEvidence, { id: x.id, decision: 'rejected', level: null, reason: f.reason }, 'Dalil rad etildi')}>Rad etish</button>
        </div>
      ) : (
        <div className={`callout ${x.status === 'approved' ? 'good' : 'bad'} small`} style={{ marginTop: 10 }}>
          {x.status === 'approved' ? `Tasdiqlandi: ${x.level}-daraja · ${CONTEXT_LABEL[x.context]}` : 'Rad etildi'} — {x.review.reason} ({x.review.by})
        </div>
      )}
    </div>
  );
}

export default function EvidenceQueue() {
  const s = useAppState();
  const pending = s.evidenceQueue.filter((x) => x.status === 'pending');
  const done = s.evidenceQueue.filter((x) => x.status !== 'pending');
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Qo‘shimcha dalillar</h1>
          <p>Xodim joriy lavozimidan tashqari kompetensiyaga yuborgan ish yoki o‘quv dalillari. Kurs, test yoki keys orqali faqat faoliyat chegarasidagi daraja tasdiqlanadi; tasdiqlangan natija dalil turi bilan profilda ko‘rinadi.</p>
        </div>
      </div>
      <Panel title={`Tekshiruv kutilmoqda (${pending.length})`}>
        <div className="stack">{pending.length ? pending.map((x) => <Item key={x.id} x={x} s={s} />) : <Empty>Navbat bo‘sh. Xodim ko‘rinishi → Karyera yo‘lim → «Qo‘shimcha kompetensiya dalili» orqali yuboring.</Empty>}</div>
      </Panel>
      {done.length > 0 && <Panel title="Ko‘rib chiqilgan"><div className="stack">{done.map((x) => <Item key={x.id} x={x} s={s} />)}</div></Panel>}
    </>
  );
}
