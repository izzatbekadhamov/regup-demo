import { Pill, Avatar, fmtDate } from '../ui/common.jsx';
import * as D from '../core/domain.js';
import { positionName } from '../core/modelKit.js';

const n1 = (v) => (v === null || v === undefined ? '—' : String(v).replace('.', ','));
const MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
const bday = (iso) => (iso ? `${Number(iso.slice(8, 10))}-${MONTHS[Number(iso.slice(5, 7)) - 1]}` : '—');

/** Xodim profili. Ma'lumotlar EduTizim'dan. admin — to'liq foydalanuvchi tarixi; colleague — yakunlangan kurslar, yutuqlar, badge'lar. */
export default function Profile({ s, emp, mode = 'colleague' }) {
  const p = emp.profile || {};
  const badges = D.employeeBadges(s, emp.id);
  const pts = D.employeePoints(s, emp.id).total;
  const certs = D.certificates(s, emp.id);
  const done = (s.enrollments || []).filter((e) => e.employeeId === emp.id && e.status === 'completed');
  const rank = D.ratingList(s, { position: emp.position }).find((r) => r.emp.id === emp.id)?.rank;
  const fields = [
    ['F.I.O.', emp.name], ['Jins', p.gender || '—'], ['Shahar', p.city || '—'], ['Filial', D.getBranch(s, emp.branchId)?.name],
    ['Bo‘lim', D.getDepartment(s, emp.departmentId)?.name || '—'], ['Lavozim', positionName(s.models, emp.currentLevel) || emp.currentLevel],
    ['Telegram', p.telegram || '—'], ['Telefon', p.phone || emp.phone || '—'], ['Tug‘ilgan kun', bday(p.birthday)], ['Gmail', p.email || '—'],
  ];
  return (
    <div className="stack">
      <div className="row" style={{ gap: 12 }}>
        <Avatar name={emp.name} size="lg" />
        <div><h2 style={{ margin: 0 }}>{emp.name}</h2><div className="muted small">{positionName(s.models, emp.currentLevel)} · {D.getBranch(s, emp.branchId)?.name}</div>
          {badges.length > 0 && <div style={{ marginTop: 4 }}>{badges.map((b) => <span key={b.id} title={`${b.name}: ${b.desc}`} style={{ fontSize: 20, marginRight: 4 }}>{b.icon}</span>)}</div>}</div>
      </div>
      <table className="small"><tbody>{fields.map(([k, v]) => <tr key={k}><td className="muted" style={{ width: 120 }}>{k}</td><td>{v}</td></tr>)}</tbody></table>
      {p.about && <div className="small"><div className="muted">Shaxsiy ma’lumot</div>{p.about}</div>}
      <div className="small muted">Ma’lumotlar EduTizim’dan keladi; o‘zgartirish HR orqali.</div>
      <div className="hr" />
      <h3 className="small" style={{ margin: 0 }}>Yutuqlar</h3>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <Pill tone="brand">{pts} ball</Pill>
        {rank && pts > 0 && <Pill tone="muted">lavozim reytingida {rank}-o‘rin</Pill>}
        <Pill tone="good">{certs.length} sertifikat</Pill>
        <Pill tone="muted">{done.length} kurs yakunlangan</Pill>
      </div>
      {badges.length > 0 ? <div className="stack" style={{ gap: 4 }}>{badges.map((b) => <div key={b.id} className="small"><span style={{ fontSize: 16 }}>{b.icon}</span> <b>{b.name}</b> — {b.desc}</div>)}</div> : <div className="small muted">Badge hali yo‘q.</div>}
      {mode === 'colleague' ? (
        <>
          <h3 className="small" style={{ margin: 0 }}>Yakunlangan kurslar</h3>
          {done.length ? <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>{done.map((e) => <li key={e.id}>{D.getCourse(s, e.courseId)?.title}</li>)}</ul> : <div className="small muted">Hali yakunlangan kurs yo‘q.</div>}
        </>
      ) : (
        <>
          <h3 className="small" style={{ margin: 0 }}>Foydalanuvchi tarixi</h3>
          {D.userHistory(s, emp.id).length ? (
            <table className="small">
              <thead><tr><th>Kurs</th><th>Boshlagan</th><th>Tugatgan</th><th className="num">Bajarilishi</th><th className="num">Kurs bahosi</th><th>Sertifikat</th></tr></thead>
              <tbody>{D.userHistory(s, emp.id).map((h) => <tr key={h.enr.id}><td>{h.course?.title}{h.enr.onboardingId && <> <Pill tone="muted">onboarding</Pill></>}</td><td>{fmtDate(h.startedAt)}</td><td>{h.completedAt ? fmtDate(h.completedAt) : <span className="muted">jarayonda</span>}</td><td className="num">{h.pct}%</td><td className="num">{n1(h.grade)}</td><td>{h.cert ? <Pill tone="good">{D.certificates(s, emp.id).find((c) => c.enr.id === h.enr.id)?.no}</Pill> : <span className="muted">—</span>}</td></tr>)}</tbody>
            </table>
          ) : <div className="small muted">Kurs tarixi yo‘q.</div>}
        </>
      )}
    </div>
  );
}
