import { useAppState, run } from '../state/store.js';
import { Panel, Pill, Empty, fmtDate } from '../ui/common.jsx';
import * as D from '../core/domain.js';

const TYPE = { hire: ['Yangi xodim', 'brand'], archive: ['Arxivlash', 'warn'], return: ['Qayta ishga kirish', 'teal'] };
const FLOW = ['Hiring manager ma’qulladi', '«Ishga qabul qilish» — 3 ish kuni', '«Приступил к работе»', 'Onboarding Board → Induction', 'Edu: kartochka', 'RegUP: kartochka + kurslar'];

function Payload({ s, ev }) {
  const p = ev.payload;
  if (ev.type === 'hire') {
    const late = D.daysBetween(p.startedAt, s.today);
    return (
      <div className="small">
        <b>{p.name}</b> · {p.position === 'GE' ? 'Ustoz (GE)' : p.position === 'FIN' ? 'Moliya menejeri' : p.department} · {D.getBranch(s, p.branchId)?.name}
        <div className="muted">ID {p.jobsterId} / {p.eduId} · tel. {p.phone} · bo‘lim: {p.department} · ish boshlagan {fmtDate(p.startedAt)}{late >= s.onboardingConfig.lateDays && <b style={{ color: 'var(--warn)' }}> ({late} kun oldin)</b>} · {p.source === 'branch' ? 'filial o‘zi olgan' : 'recruiting orqali'}</div>
      </div>
    );
  }
  const emp = D.getEmployee(s, p.employeeId);
  if (ev.type === 'archive') return <div className="small"><b>{emp?.name}</b> · ketgan {fmtDate(p.leftAt)} · {p.reason}<div className="muted">Edu kutish muddati: {p.eduWaitDays} kun</div></div>;
  return <div className="small"><b>{emp?.name}</b> · qayta ishga kirdi {fmtDate(p.startedAt)} · {D.getBranch(s, p.branchId)?.name}<div className="muted">Avval arxivlangan {fmtDate(emp?.archivedAt)} — {emp?.archiveReason}</div></div>;
}

export default function Integration() {
  const s = useAppState();
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Integratsiya navbati</h1>
          <p>Jobster ATS va Edu tizimidan keladigan hodisalar: yangi xodim, ishdan ketish (arxiv) va qayta ishga kirish. Prototipda hodisalar tayyor turadi va bir tugma bilan qabul qilinadi. Ishchi tizimda ular avtomatik keladi (texnik mexanizm — webhook yoki navbat — dasturchilar bilan kelishiladi).</p>
        </div>
        {s.hrInbox.length > 0 && <button className="btn primary" onClick={() => run(D.processHrInbox, {}, `${s.hrInbox.length} ta hodisa qabul qilindi`)}>Hammasini qabul qilish ({s.hrInbox.length})</button>}
      </div>
      <div className="flow-strip">{FLOW.map((x, i) => <span key={x} className={i >= 3 ? 'on' : ''}>{x}</span>)}</div>
      <div className="callout small">
        <b>Qoidalar:</b> kartochka ID, ism-familiya, telefon, lavozim va filial bilan ochiladi. «Markaz admini» bo‘limiga kartochka ochilmaydi, chunki korporativ raqam bir nechta xodimga berilishi mumkin. Ish boshlaganidan ≥ {s.onboardingConfig.lateDays} kun keyin kiritilgan xodim belgilanadi va HR hamda filial rahbariga xabar boradi. Ketgan xodim RegUP’da darhol arxivlanadi (Edu esa 15–30 kun kutadi). Ma’lumotlari o‘chirilmaydi.
      </div>
      <Panel tight title={<div className="row"><h2>Kutilayotgan hodisalar</h2><span className="muted small">{s.hrInbox.length} ta</span></div>}>
        {s.hrInbox.length ? (
          <table>
            <thead><tr><th>Hodisa</th><th>Ma’lumot</th><th>Jobster bosqichi</th><th /></tr></thead>
            <tbody>{s.hrInbox.map((ev) => (
              <tr key={ev.id}>
                <td><Pill tone={TYPE[ev.type][1]}>{TYPE[ev.type][0]}</Pill><div className="small muted" style={{ marginTop: 4 }}>{fmtDate(ev.at)}</div></td>
                <td><Payload s={s} ev={ev} /></td>
                <td className="small">{ev.stage}</td>
                <td className="num"><button className="btn sm" onClick={() => run(D.processHrInbox, { id: ev.id }, 'Hodisa qabul qilindi')}>Qabul qilish</button></td>
              </tr>
            ))}</tbody>
          </table>
        ) : <Empty icon="check">Navbat bo‘sh — barcha hodisalar qabul qilingan.</Empty>}
      </Panel>
      <Panel tight title="Qabul qilingan hodisalar natijasi">
        {s.hrLog.length ? (
          <table><tbody>{s.hrLog.map((l) => (
            <tr key={l.id}>
              <td style={{ width: 150 }}><Pill tone={TYPE[l.type][1]}>{TYPE[l.type][0]}</Pill></td>
              <td><b className="small">{l.who}</b><div className={`small ${l.tone === 'bad' ? '' : 'ink2'}`} style={l.tone === 'bad' ? { color: 'var(--bad)' } : l.tone === 'warn' ? { color: 'var(--warn)' } : {}}>{l.text}</div></td>
              <td className="num">{l.employeeId && D.onboardingOf(s, l.employeeId) && <a className="btn sm" href={`#/onboarding/${D.onboardingOf(s, l.employeeId).id}`}>Moslashuv</a>}</td>
            </tr>
          ))}</tbody></table>
        ) : <Empty>Hali hodisa qabul qilinmagan.</Empty>}
      </Panel>
    </>
  );
}
