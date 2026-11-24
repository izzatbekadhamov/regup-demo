import { useState } from 'react';
import { useAppState, run } from '../state/store.js';
import { Panel, Empty, fmtDate } from '../ui/common.jsx';
import * as D from '../core/domain.js';

/** Qo'lda xabar: doiradagi xodimlarga filtr bilan, platforma va Telegram, bir tomonlama (qaror №63). */
export default function Messages({ user }) {
  const s = useAppState();
  const [f, setF] = useState({ branchId: '', position: '', departmentId: '', text: '' });
  const n = D.messageRecipients(s, user, f).length;
  return (
    <>
      <div className="page-head"><div><h1>Xabar yuborish</h1><p>Doirangizdagi xodimlarga filial, bo‘lim va lavozim bo‘yicha tanlab xabar yuborasiz: platforma va Telegram. Xabar bir tomonlama — javob olinmaydi. Har xabar jurnalga yoziladi.</p></div></div>
      <Panel title="Yangi xabar">
        <div className="filter-row">
          <select className="i compact" value={f.branchId} onChange={(e) => setF({ ...f, branchId: e.target.value })}><option value="">Barcha filiallar (doira ichida)</option>{s.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
          <select className="i compact" value={f.departmentId} onChange={(e) => setF({ ...f, departmentId: e.target.value })}><option value="">Barcha bo‘limlar</option>{(s.departments || []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
          <select className="i compact" value={f.position} onChange={(e) => setF({ ...f, position: e.target.value })}><option value="">Barcha lavozimlar</option>{['GE', 'FIN', 'FR'].map((p) => <option key={p} value={p}>{p}</option>)}</select>
          <span className="small muted">Qabul qiluvchilar: <b>{n}</b></span>
        </div>
        <textarea className="i" rows={3} style={{ marginTop: 8, width: '100%' }} placeholder="Xabar matni" value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} />
        <div className="row" style={{ marginTop: 8 }}><button className="btn primary" disabled={!n} onClick={() => run(D.sendMessage, { userId: user.id, ...f }, `${n} ta xodimga yuborildi`) && setF({ ...f, text: '' })}>Yuborish ({n})</button></div>
      </Panel>
      <Panel title="Yuborilgan xabarlar" tight>
        {(s.messages || []).length ? <table className="small"><tbody>{s.messages.map((m) => <tr key={m.id}><td className="muted" style={{ whiteSpace: 'nowrap' }}>{fmtDate(m.at)}</td><td>{m.text}</td><td className="muted">{m.by} · {m.n} ta xodim</td></tr>)}</tbody></table> : <Empty>Hali xabar yuborilmagan.</Empty>}
      </Panel>
    </>
  );
}
