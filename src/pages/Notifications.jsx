import { useAppState, setState, getState } from '../state/store.js';
import { Panel, Empty, fmtDate } from '../ui/common.jsx';
import { markNotificationsRead } from '../core/domain.js';

export default function Notifications({ emp }) {
  const s = useAppState();
  const list = s.notifications.filter((n) => n.to === emp.name);
  return (
    <>
      <div className="page-head">
        <div><h1>Bildirishnomalar</h1><p>Tayinlash, eslatma, qaytarish va natija e’loni. Takroriy so‘rov yangi bildirishnoma yaratmaydi.</p></div>
        <button className="btn" onClick={() => setState(markNotificationsRead(getState(), emp.name))}>Hammasini o‘qilgan deb belgilash</button>
      </div>
      <Panel tight>
        {list.length ? (
          <table><tbody>{list.map((n) => <tr key={n.id}><td style={{ width: 20 }}>{!n.read && <span style={{ color: 'var(--brand)' }}>●</span>}</td><td>{n.text}</td><td className="muted small" style={{ whiteSpace: 'nowrap' }}>{fmtDate(n.at)}</td></tr>)}</tbody></table>
        ) : <Empty>Bildirishnoma yo‘q.</Empty>}
      </Panel>
    </>
  );
}
