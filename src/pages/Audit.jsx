import { useState } from 'react';
import { useAppState } from '../state/store.js';
import { Panel, fmtDate } from '../ui/common.jsx';

export default function Audit() {
  const s = useAppState();
  const [q, setQ] = useState('');
  const rows = s.audit.filter((a) => !q || JSON.stringify(a).toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <div className="page-head">
        <div>
          <h1>O‘zgarishlar jurnali</h1>
          <p>Obyekt, amal, ijrochi, vaqt, oldingi va yangi qiymat hamda sabab. Baholash, tasdiqlash, dalilga kirish va qayta ochish yoziladi. Sanalar Toshkent vaqtida.</p>
        </div>
        <input className="i compact" placeholder="Qidirish…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <Panel tight>
        <table>
          <thead><tr><th>Vaqt</th><th>Ijrochi</th><th>Amal</th><th>Obyekt</th><th>Oldingi → yangi</th><th>Sabab</th></tr></thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id}>
                <td className="small" style={{ whiteSpace: 'nowrap' }}>{fmtDate(a.at)}</td>
                <td className="small">{a.actor}</td>
                <td><b>{a.action}</b></td>
                <td className="code">{a.object}</td>
                <td className="small">{a.before !== undefined || a.after !== undefined ? `${a.before ?? '—'} → ${a.after ?? '—'}` : ''}</td>
                <td className="small ink2">{a.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </>
  );
}
