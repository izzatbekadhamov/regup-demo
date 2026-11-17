import { useState } from 'react';
import { Panel, Pill, Gauge } from '../ui/common.jsx';
import { runAll } from '../core/uat.js';

export default function Uat() {
  const [res, setRes] = useState(() => runAll());
  const passed = res.filter((r) => r.pass).length;
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Qabul sinovlari</h1>
          <p>Texnik yo‘riqnomaning 10-bo‘limidagi 15 ta ssenariy. Har biri toza demo ma’lumotda hisoblash yadrosi va ish oqimi orqali jonli bajariladi (joriy demo holatiga ta’sir qilmaydi). Xuddi shu ssenariylar <span className="code">npm test</span> bilan ham ishga tushadi.</p>
        </div>
        <div className="row">
          <button className="btn" onClick={() => setRes(runAll())}>Qayta bajarish</button>
        </div>
      </div>
      <section className="panel uat-sum">
        <Gauge size={96} value={(100 * passed) / res.length} tone={passed === res.length ? 'good' : 'bad'} label={`${passed}/${res.length}`} />
        <div className="stack" style={{ gap: 4 }}>
          <h2>{passed === res.length ? 'Barcha qabul sinovlari o‘tdi' : `${res.length - passed} ta sinov o‘tmadi`}</h2>
          <p className="small ink2">Moslik, DE, FUN-05, versiya, R ko‘lami, import, ruxsatlar, KPI va ish oqimi ssenariylari.</p>
        </div>
        <Pill tone={passed === res.length ? 'good' : 'bad'}>{passed} / {res.length} o‘tdi</Pill>
      </section>
      <Panel tight>
        <table>
          <thead><tr><th>ID</th><th>Sinov</th><th>Kutiladigan natija</th><th>Haqiqiy natija</th><th>Holat</th></tr></thead>
          <tbody>
            {res.map((r) => (
              <tr key={r.id}>
                <td className="code" style={{ whiteSpace: 'nowrap' }}>{r.id}</td>
                <td><b>{r.title}</b></td>
                <td className="small ink2">{r.expected}</td>
                <td className="small">{r.actual}</td>
                <td><Pill tone={r.pass ? 'good' : 'bad'}>{r.pass ? 'O‘tdi' : 'O‘tmadi'}</Pill></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </>
  );
}
