import { useState } from 'react';
import { useAppState, run } from '../state/store.js';
import { Panel, Pill, Person, Empty, Stat, go, fmtDate } from '../ui/common.jsx';
import * as D from '../core/domain.js';
import { positionName } from '../core/modelKit.js';

const pct = (v) => (v === null || v === undefined ? '—' : `${v.toFixed(1).replace('.', ',')}%`);
const ACTION = {
  course: ['Majburiy kurs biriktirildi', 'bad'],
  already: ['Kurs hali yakunlanmagan', 'warn'],
  repeat: ['Kursdan keyin ham past — individual reja', 'bad'],
  improved: ['Ko‘rsatkich tiklandi', 'good'],
  note: ['Nazorat izohi', 'brand'],
};

/** Bitta ko'rsatkich katakchasi: qiymat, asos, oldingi oyga nisbatan. */
function KpiCell({ s, emp, month, rule }) {
  const v = D.kpiValue(D.kpiResult(s, emp.id, month), rule);
  if (!v) return <span className="muted small">ma’lumot yo‘q</span>;
  const prevMonths = D.kpiMonths(s).filter((m) => m < month);
  const p = prevMonths.length ? D.kpiValue(D.kpiResult(s, emp.id, prevMonths.at(-1)), rule) : null;
  const diff = p && p.pct !== null && v.pct !== null ? v.pct - p.pct : null;
  if (v.unmeasured) return <div><b className="muted" style={{ fontSize: 15 }}>O‘lchanmagan</b><div className="muted small">ishga kirganiga 30 kun to‘lmagan</div></div>;
  return (
    <div>
      <b style={{ color: v.few ? 'var(--muted)' : v.below ? 'var(--bad)' : 'var(--good)', fontSize: 15 }}>{pct(v.pct)}</b>
      {diff !== null && Math.abs(diff) >= 0.1 && <span className="small" style={{ marginLeft: 6, color: diff > 0 ? 'var(--good)' : 'var(--bad)' }}>{diff > 0 ? '▲' : '▼'} {Math.abs(diff).toFixed(1).replace('.', ',')}</span>}
      <div className="muted small">{v.num} / {v.base}{v.few ? ' · kam ma’lumot, baholanmaydi' : v.below ? ` · chegara ${rule.min}%` : ''}</div>
    </div>
  );
}

/** Ustozga qo'llangan choralar: majburiy kurslar holati. */
function Measures({ s, emp }) {
  const list = s.enrollments.filter((e) => e.employeeId === emp.id && e.mandatory);
  const repeat = s.kpiActions.find((a) => a.employeeId === emp.id && a.kind === 'repeat');
  if (!list.length && !repeat) return <span className="muted small">—</span>;
  return (
    <div className="stack" style={{ gap: 4 }}>
      {list.map((e) => {
        const c = D.getCourse(s, e.courseId);
        const done = c.components.filter((x) => D.componentDone(c, e, x.id)).length;
        const late = e.status !== 'completed' && e.mandatory.deadline < s.today;
        return (
          <div key={e.id} className="small">
            {e.status === 'completed' ? <span style={{ color: 'var(--good)' }}>✓ </span> : null}
            <b>{c.title}</b>
            <div className="muted">
              {e.status === 'completed' ? `yakunlangan ${fmtDate(e.completedAt)}` : <>{done} / {c.components.length} bajarildi · <span style={{ color: late ? 'var(--bad)' : undefined, fontWeight: late ? 650 : undefined }}>muddat {fmtDate(e.mandatory.deadline)}{late ? ' — o‘tgan' : ''}</span></>}
            </div>
          </div>
        );
      })}
      {repeat && <div className="small" style={{ color: 'var(--bad)' }}>Kursdan keyin ham past — individual reja kerak</div>}
    </div>
  );
}

function History({ s, emp, rules }) {
  const months = D.kpiMonths(s);
  const acts = s.kpiActions.filter((a) => a.employeeId === emp.id);
  return (
    <div className="split" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)' }}>
      <table>
        <thead><tr><th>Oy</th>{rules.map((r) => <th key={r.id}>{D.KPI_METRICS[r.metric].label}</th>)}</tr></thead>
        <tbody>{months.map((m) => (
          <tr key={m}><td className="small">{D.monthName(m)}</td>{rules.map((r) => <td key={r.id}><KpiCell s={s} emp={emp} month={m} rule={r} /></td>)}</tr>
        ))}</tbody>
      </table>
      <div className="stack" style={{ gap: 6 }}>
        <div className="small" style={{ fontWeight: 650 }}>Choralar va izohlar</div>
        {acts.length ? acts.map((a) => {
          const r = s.kpiRules.find((x) => x.id === a.ruleId);
          return (
            <div key={a.id} className="small">
              <span className={`pill ${ACTION[a.kind][1]}`}>{ACTION[a.kind][0]}</span> <span className="muted">{fmtDate(a.at)}</span>
              <div className="ink2">{a.kind === 'note' ? <>{a.by}: «{a.text}»</> : <>{D.monthName(a.month)} · {D.KPI_METRICS[r.metric].label} {pct(a.value)} (chegara {a.min}%){a.enrollmentId ? ` · «${D.getCourse(s, s.enrollments.find((e) => e.id === a.enrollmentId)?.courseId)?.title}»` : ''}</>}</div>
            </div>
          );
        }) : <span className="muted small">Hali chora bo‘lmagan.</span>}
      </div>
    </div>
  );
}

function NoteForm({ emp, by }) {
  const [t, setT] = useState('');
  return (
    <div className="row">
      <input className="i" style={{ flex: 1 }} placeholder="Nazorat izohi: suhbat, dars kuzatuvi, kelishilgan qadam" value={t} onChange={(e) => setT(e.target.value)} />
      <button className="btn sm primary" disabled={!t.trim()} onClick={() => run(D.addKpiNote, { employeeId: emp.id, text: t, by }, 'Izoh saqlandi — ustozga xabar yuborildi') && setT('')}>Izoh qoldirish</button>
    </div>
  );
}

/** Ustozlar jadvali — admin va mas'ul shaxs uchun umumiy. */
export function KpiTable({ s, emps, month, noteBy, showSupervisor = true }) {
  const [open, setOpen] = useState(null);
  const rules = s.kpiRules.filter((r) => r.position === 'GE');
  if (!emps.length) return <Empty>Ustoz topilmadi.</Empty>;
  return (
    <table>
      <thead><tr><th>Ustoz</th>{showSupervisor && <th>Mas’ul</th>}{rules.map((r) => <th key={r.id} style={{ minWidth: 130 }}>{D.KPI_METRICS[r.metric].label}<div className="muted small" style={{ fontWeight: 400 }}>chegara {r.min}%</div></th>)}<th>Chora</th><th /></tr></thead>
      <tbody>
        {emps.map((e) => {
          const sup = D.kpiSupervisor(s, e);
          const isOpen = open === e.id;
          return [
            <tr key={e.id} className="clickable" onClick={() => setOpen(isOpen ? null : e.id)}>
              <td><Person name={e.name} sub={`${e.currentLevel} ${positionName(s.models, e.currentLevel)} · ${D.getBranch(s, e.branchId)?.name}`} /></td>
              {showSupervisor && <td className="small">{sup ? sup.name : <span className="muted">Akademik bo‘lim</span>}</td>}
              {rules.map((r) => <td key={r.id}><KpiCell s={s} emp={e} month={month} rule={r} /></td>)}
              <td><Measures s={s} emp={e} /></td>
              <td className="num small muted">{isOpen ? 'Yopish ▴' : 'Tarix ▾'}</td>
            </tr>,
            isOpen && (
              <tr key={`${e.id}-d`} className="edit-row"><td colSpan={rules.length + (showSupervisor ? 4 : 3)}>
                <div className="stack">
                  <History s={s} emp={e} rules={rules} />
                  {noteBy && <NoteForm emp={e} by={noteBy === true ? (sup?.name || 'Akademik bo‘lim') : noteBy} />}
                </div>
              </td></tr>
            ),
          ];
        })}
      </tbody>
    </table>
  );
}

function RuleCard({ s, rule }) {
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState({ min: rule.min, months: rule.months, courseId: rule.courseId });
  const m = D.KPI_METRICS[rule.metric];
  const course = D.getCourse(s, rule.courseId);
  return (
    <section className="panel model-card">
      <div className="row between"><h2>{m.label}</h2>{!edit && <button className="btn sm" onClick={() => setEdit(true)}>Sozlash</button>}</div>
      <p className="small ink2">{m.hint}</p>
      <div className="code small" style={{ margin: '6px 0' }}>{rule.metric === 'conversion' ? 'qolgan yangi o‘quvchilar ÷ shu oy yangi kelganlar' : '(oy boshida − bitirgan − ketgan) ÷ (oy boshida − bitirgan)'}</div>
      {rule.metric === 'retention' && <p className="small muted">Misol: oy boshida 200 o‘quvchi, 20 tasi bitirmasdan ketdi → 180 / 200 = 90%.</p>}
      {edit ? (
        <div className="stack" style={{ gap: 8 }}>
          <div className="row">
            <label className="f">Chegara, %<input className="i compact" type="number" style={{ width: 90 }} value={f.min} onChange={(e) => setF({ ...f, min: e.target.value })} /></label>
            <label className="f">Ketma-ket necha oy past bo‘lsa<input className="i compact" type="number" min="1" style={{ width: 90 }} value={f.months} onChange={(e) => setF({ ...f, months: e.target.value })} /></label>
            <label className="f" style={{ flex: 1 }}>Biriktiriladigan kurs
              <select className="i compact" value={f.courseId} onChange={(e) => setF({ ...f, courseId: e.target.value })}>{s.courses.filter((c) => c.status === 'active' && c.direction === 'GE').map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select>
            </label>
          </div>
          <div className="row"><button className="btn primary sm" onClick={() => run(D.updateKpiRule, { id: rule.id, ...f }, 'Qoida saqlandi — keyingi hisobotdan qo‘llanadi') && setEdit(false)}>Saqlash</button><button className="btn sm" onClick={() => setEdit(false)}>Bekor qilish</button></div>
        </div>
      ) : (
        <div className="small">
          <div>Chegara: <b>{rule.min}%</b> · {rule.months > 1 ? `ketma-ket ${rule.months} oy past bo‘lsa` : '1 oy past bo‘lsa'} · kamida {rule.minBase} {rule.metric === 'conversion' ? 'yangi o‘quvchi' : 'o‘quvchi'} bo‘lsa baholanadi</div>
          <div style={{ marginTop: 4 }}>Past bo‘lsa avtomatik majburiy: <a href={`#/courses/${course.id}`} onClick={(e) => e.stopPropagation()}>«{course.title}»</a> · muddat 30 kun</div>
        </div>
      )}
    </section>
  );
}

function ManualEntry({ s, onDone }) {
  const months = D.kpiMonths(s);
  const teachers = D.activeEmployees(s).filter((e) => e.position === 'GE' && (!scope || scope.has(e.id)));
  const [f, setF] = useState({ employeeId: '', month: months.at(-1), newStudents: '', stayedNew: '', start: '', graduated: '0', left: '' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const num = (k, l) => <label className="f">{l}<input className="i compact" type="number" min="0" style={{ width: 110 }} value={f[k]} onChange={set(k)} /></label>;
  return (
    <Panel title="Natijani qo‘lda kiritish yoki tuzatish" actions={<button className="btn sm" onClick={onDone}>Yopish</button>}>
      <div className="stack">
        <div className="row">
          <label className="f">Ustoz<select className="i compact" value={f.employeeId} onChange={set('employeeId')}><option value="">— tanlang —</option>{teachers.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select></label>
          <label className="f">Oy<input className="i compact" type="month" value={f.month} onChange={set('month')} /></label>
        </div>
        <div className="row">
          {num('newStudents', 'Shu oy yangi kelgan')}{num('stayedNew', 'Ulardan qolgan')}
          <span style={{ width: 16 }} />
          {num('start', 'Oy boshida')}{num('graduated', 'Bitirgan')}{num('left', 'Bitirmasdan ketgan')}
        </div>
        <div className="row"><button className="btn primary" disabled={!f.employeeId || f.newStudents === '' || f.start === '' || f.left === ''} onClick={() => run(D.saveKpiResult, f, 'Natija saqlandi va qoidalar qo‘llandi') && onDone()}>Saqlash</button><span className="muted small">Saqlangach chegara tekshiriladi; past bo‘lsa kurs avtomatik biriktiriladi.</span></div>
      </div>
    </Panel>
  );
}

/** Admin: Ustozlar KPI. */
export default function TeacherKpi({ user }) {
  const s = useAppState();
  const scope = D.scopeEmployees(s, user);
  const manage = !user || ['super', 'hr'].includes(user.role);
  const months = D.kpiMonths(s);
  const [month, setMonth] = useState(null);
  const [sup, setSup] = useState('');
  const [onlyBad, setOnlyBad] = useState(false);
  const [manual, setManual] = useState(false);
  const m = month && months.includes(month) ? month : months.at(-1);
  const rules = s.kpiRules.filter((r) => r.position === 'GE');
  const inbox = manage ? Object.entries(s.kpiInbox || {}) : [];
  const teachers = s.employees.filter((e) => e.position === 'GE');
  const supervisors = [...new Set(teachers.map((e) => e.supervisorId).filter(Boolean))].map((id) => D.getEmployee(s, id));
  const isBad = (e) => rules.some((r) => D.kpiValue(D.kpiResult(s, e.id, m), r)?.below);
  const list = teachers.filter((e) => (!sup || e.supervisorId === sup) && (!onlyBad || isBad(e)))
    .sort((a, b) => (isBad(b) ? 1 : 0) - (isBad(a) ? 1 : 0));
  const badN = teachers.filter(isBad).length;
  const openMand = s.enrollments.filter((e) => e.mandatory && e.status !== 'completed' && (!scope || scope.has(e.employeeId)));
  const late = openMand.filter((e) => e.mandatory.deadline < s.today).length;
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Ustozlar KPI</h1>
          <p>Har oy Edu hisobotidan ustozning 1-oy konversiyasi va retentioni olinadi. Chegaradan past bo‘lsa — mos kurs avtomatik majburiy biriktiriladi, ustoz va uning mas’uliga xabar boradi.</p>
        </div>
        {manage && !manual && <button className="btn" onClick={() => setManual(true)}>Qo‘lda kiritish</button>}
      </div>

      {inbox.map(([mm, x]) => (
        <div key={mm} className="callout warn row between">
          <div><b>{D.monthName(mm)} hisoboti tayyor</b> — {x.source}, {fmtDate(x.readyAt)}. {x.rows.length} ustoz natijasi. Olinganda chegaralar tekshiriladi va kerakli kurslar biriktiriladi.</div>
          <button className="btn primary" onClick={() => { if (run(D.importKpiMonth, { month: mm }, `${D.monthName(mm)} natijalari olindi`)) setMonth(mm); }}>Natijalarni olish</button>
        </div>
      ))}
      {manual && <ManualEntry s={s} onDone={() => setManual(false)} />}

      <div className="grid g4">
        <Stat k="Ustozlar" v={teachers.length} s={D.monthName(m)} icon="users" />
        <Stat k="Chegaradan past" v={badN} s="kamida bitta ko‘rsatkich bo‘yicha" icon="chart" tone={badN ? 'bad' : ''} />
        <Stat k="Majburiy kurs o‘qiyapti" v={openMand.length} s="KPI bo‘yicha biriktirilgan" icon="cards" />
        <Stat k="Muddati o‘tgan" v={late} s="mas’ul nazoratida" icon="target" tone={late ? 'bad' : ''} />
      </div>

      {manage ? <div className="grid g2">{rules.map((r) => <RuleCard key={r.id} s={s} rule={r} />)}</div> : <div className="callout small">Siz <b>{user.title}</b> sifatida faqat o‘zingizga biriktirilgan ustozlarni ko‘rasiz. Chegara va kurslarni HR sozlaydi.</div>}

      <Panel tight title={<div className="row"><h2>Ustozlar natijalari</h2><span className="muted small">{D.monthName(m)} · qatorni bosing — oylar tarixi va choralar</span></div>} actions={
        <div className="row">
          <select className="i compact" value={m} onChange={(e) => setMonth(e.target.value)}>{months.map((x) => <option key={x} value={x}>{D.monthName(x)}</option>)}</select>
          <select className="i compact" value={sup} onChange={(e) => setSup(e.target.value)}><option value="">Barcha mas’ullar</option>{supervisors.map((x) => <option key={x.id} value={x.id}>{x.name} jamoasi</option>)}</select>
          <label className="chk"><input type="checkbox" checked={onlyBad} onChange={(e) => setOnlyBad(e.target.checked)} /> Faqat pastlar</label>
        </div>
      }>
        <KpiTable s={s} emps={list} month={m} noteBy={manage ? true : user.name} />
      </Panel>
    </>
  );
}

/** Xodim kabineti: o'z KPI va (mas'ul bo'lsa) jamoasi. */
export function MyKpi({ emp }) {
  const s = useAppState();
  const months = D.kpiMonths(s);
  const m = months.at(-1);
  const rules = D.kpiRulesFor(s, emp);
  const team = s.employees.filter((e) => e.supervisorId === emp.id);
  const mine = D.kpiResult(s, emp.id, m);
  const mand = s.enrollments.filter((e) => e.employeeId === emp.id && e.mandatory && e.status !== 'completed');
  return (
    <>
      <div className="page-head">
        <div>
          <h1>KPI ko‘rsatkichlari</h1>
          <p>{D.monthName(m)} natijalari Edu hisobotidan. Chegaradan past bo‘lsa, mos kurs avtomatik majburiy biriktiriladi.</p>
        </div>
      </div>
      {mine && (
        <div className="grid g2">
          {rules.map((r) => {
            const v = D.kpiValue(mine, r);
            return (
              <section key={r.id} className="panel model-card">
                <div className="row between"><h2>{D.KPI_METRICS[r.metric].label}</h2>{v.unmeasured ? <Pill tone="muted">o‘lchanmagan</Pill> : v.few ? <Pill tone="muted">kam ma’lumot</Pill> : v.below ? <Pill tone="bad">chegaradan past</Pill> : <Pill tone="good">me’yorda</Pill>}</div>
                <div style={{ fontSize: 30, fontWeight: 750, color: v.few || v.unmeasured ? 'var(--muted)' : v.below ? 'var(--bad)' : 'var(--good)' }}>{v.unmeasured ? 'O‘lchanmagan' : pct(v.pct)}</div>
                <div className="small ink2">{v.unmeasured ? `Ishga kirganingizga 30 kun to‘lmagan (${D.hireDate(emp)}). KPI keyingi oydan hisoblanadi.` : `${D.KPI_METRICS[r.metric].text(v)} · chegara ${r.min}%`}</div>
                <div className="small muted" style={{ marginTop: 4 }}>{D.KPI_METRICS[r.metric].hint}</div>
              </section>
            );
          })}
        </div>
      )}
      {mand.length > 0 && (
        <Panel title="Majburiy kurslar">
          <div className="stack">{mand.map((e) => {
            const c = D.getCourse(s, e.courseId);
            const r = s.kpiRules.find((x) => x.id === e.mandatory.ruleId);
            const late = e.mandatory.deadline < s.today;
            return (
              <div key={e.id} className="idp-row">
                <div className="row between"><div><b>{c.title}</b> <Pill tone={late ? 'bad' : 'warn'}>muddat {fmtDate(e.mandatory.deadline)}{late ? ' — o‘tgan' : ''}</Pill></div><button className="btn sm primary" onClick={() => go(`/learn/${e.id}`)}>Kursga o‘tish</button></div>
                <div className="small ink2">Sabab: {D.monthName(e.mandatory.month)} — {D.KPI_METRICS[r.metric].label} {pct(e.mandatory.value)}, chegara {e.mandatory.min}%.</div>
              </div>
            );
          })}</div>
        </Panel>
      )}
      {rules.length > 0 && (
        <Panel title="Oylar bo‘yicha" tight>
          <div className="panel-body"><History s={s} emp={emp} rules={rules} /></div>
        </Panel>
      )}
      {!rules.length && !team.length && <Panel><Empty>Lavozimingiz uchun KPI kuzatuvi sozlanmagan.</Empty></Panel>}
      {team.length > 0 && (
        <Panel tight title={<div><h2>Jamoam natijalari</h2><div className="muted small">Siz mas’ul bo‘lgan {team.length} ustoz · {D.monthName(m)} · qatorni bosing — tarix va izoh qoldirish</div></div>}>
          <KpiTable s={s} emps={team} month={m} noteBy={emp.name} showSupervisor={false} />
        </Panel>
      )}
    </>
  );
}
