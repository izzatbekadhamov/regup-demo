import { useState } from 'react';
import { useAppState, run } from '../state/store.js';
import { Panel, Pill, Person, Empty, fmtDate } from '../ui/common.jsx';
import * as D from '../core/domain.js';

const RULES = [
  ['Kurs biriktirildi', 'Kursni boshlash eslatmasi', 'Xodim', 'Biriktirilgan kuni'],
  ['Boshlanmagan', 'Har 10 kunda', 'Xodim + mentor + filial rahbari', '10, 20, … kun — hali birorta dars ochilmagan'],
  ['Reja bo‘yicha ortda', 'Har 10 kunda', 'Xodim + mentor + filial rahbari', 'Bajarilgan ulush o‘tgan vaqtdan 25%+ orqada'],
  ['Davriy eslatma', 'Har 15 kunda', 'Xodim', 'Faol o‘qiyotganlarga (15-kun holati shu yerda)'],
  ['Muddat yaqin', '3 va 1 kun qolganda', 'Xodim', ''],
  ['Bugun muddat', 'Muddat kuni', 'Xodim', ''],
  ['Muddat o‘tdi', 'Ertasiga, keyin har 10 kunda', 'Xodim + mentor + filial rahbari', 'Mas’ullar kechikkanini ko‘radi'],
  ['Kurs yakunlandi', 'Yakunlangan kuni', 'Xodim', ''],
];

export default function Reminders({ user }) {
  const s = useAppState();
  const scope = D.scopeEmployees(s, user);
  const manage = !user || ['super', 'hr'].includes(user.role);
  const [date, setDate] = useState(s.today);
  const due = D.dueReminders(s, date).filter((r) => !scope || scope.has(r.employeeId));
  const sentKeys = (r) => s.notifications.some((n) => n.key.startsWith(r.key));
  const history = s.notifications.filter((n) => n.key.startsWith('rem:') && (manage || n.to === user.name || scope.has(n.key.split(':')[1])));
  const sample = due[0];
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Eslatmalar</h1>
          <p>Kurs eslatmalari platformada va Telegram bot orqali boradi. Muammoli holatlarda (boshlanmagan, ortda, kechikkan) xabar xodimning mentori va filial rahbariga ham boradi. Bir xodimga kuniga bitta eslatma: eng muhim holat tanlanadi, bir xil holatdagi kurslar bitta xabarga birlashtiriladi.</p>
        </div>
      </div>
      <div className="grid g2">
        <Panel tight title={<div className="row between" style={{ width: '100%' }}><h2>{date === s.today ? 'Bugun yuboriladi' : `${fmtDate(date)} kuni yuboriladi`}</h2>
          <label className="row small" style={{ gap: 6 }}>Sana bo‘yicha ko‘rish <input className="i compact" type="date" value={date} min={s.today} onChange={(e) => setDate(e.target.value || s.today)} /></label></div>}>
          {due.length ? (
            <table><tbody>{due.map((r) => {
              const e = D.getEmployee(s, r.employeeId);
              const [lbl, tone] = D.REMINDER_KINDS[r.kind];
              return (
                <tr key={r.key}>
                  <td><Person name={e.name} sub={D.getBranch(s, e.branchId)?.name} /></td>
                  <td><Pill tone={tone}>{lbl}</Pill>{r.also.length > 0 && <div className="small muted">+ {r.also.join(', ')}</div>}<div className="small" style={{ marginTop: 4 }}>{r.text}</div><div className="small muted">→ {r.to.map((t) => `${t.name} (${t.role.toLowerCase()})`).join(', ')}</div></td>
                  <td className="num">{date === s.today && sentKeys(r) ? <Pill tone="good">yuborildi</Pill> : null}</td>
                </tr>
              );
            })}</tbody></table>
          ) : <Empty icon="check">Bu kunga eslatma yo‘q.</Empty>}
          {manage && date === s.today && due.some((r) => !sentKeys(r)) && <div className="panel-body"><button className="btn primary" onClick={() => run(D.sendReminders, {}, 'Eslatmalar yuborildi: platforma + Telegram')}>Bugungi eslatmalarni yuborish</button> <span className="small muted">Ishchi tizimda har kuni avtomatik.</span></div>}
          {date !== s.today && <div className="panel-body small muted">Oldindan ko‘rish — yuborish faqat o‘z kunida.</div>}
        </Panel>
        <div className="stack">
          {sample && (
            <Panel title="Telegram’da qanday ko‘rinadi">
              <div className="tg-chat">
                <div className="tg-head"><span className="tg-ava">R</span><div><b>RegUP bot</b><div className="small">bot</div></div></div>
                <div className="tg-msg">🔔 <b>{D.REMINDER_KINDS[sample.kind][0]}</b><br />{sample.text}<div className="tg-btn">Kursni ochish</div><span className="tg-time">09:00</span></div>
              </div>
            </Panel>
          )}
          <Panel tight title="Qoidalar">
            <table className="small"><thead><tr><th>Holat</th><th>Qachon</th><th>Kimga</th></tr></thead>
              <tbody>{RULES.map(([a, b, c, d]) => <tr key={a}><td><b>{a}</b>{d && <div className="muted">{d}</div>}</td><td>{b}</td><td>{c}</td></tr>)}</tbody></table>
          </Panel>
        </div>
      </div>
      <Panel tight title={<div className="row"><h2>Yuborilgan eslatmalar</h2><span className="muted small">{history.length} ta</span></div>}>
        {history.length ? <table><tbody>{history.map((n) => <tr key={n.id}><td className="small"><b>{n.to}</b></td><td className="small">{n.text}</td><td className="small muted" style={{ whiteSpace: 'nowrap' }}><span className="tg-mark">TG</span> {fmtDate(n.at)}</td></tr>)}</tbody></table> : <Empty>Hali yuborilmagan.</Empty>}
      </Panel>
    </>
  );
}
