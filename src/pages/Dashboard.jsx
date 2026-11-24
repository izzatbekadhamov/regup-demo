import * as D from '../core/domain.js';
import { useAppState } from '../state/store.js';
import { Panel, Stat, Pill, Person, Meter, go, fmtDate } from '../ui/common.jsx';
import { cardDecision, getEmployee, getModel, getBranch, monthName } from '../core/domain.js';
import { safeRatio, fmtPct, isNum } from '../core/calc.js';
import { STAGE_LABELS } from '../data/models.js';
import { computeMatch } from '../core/calc.js';
import { cardScores } from '../core/domain.js';
import { profileThreshold } from '../core/modelKit.js';

export default function Dashboard() {
  const s = useAppState();
  const active = s.cards.filter((c) => c.stage !== 'closed');
  const published = active.filter((c) => c.stage === 'published');
  const decisions = active.map((c) => ({ c, d: cardDecision(s, c) }));

  // Maqsadga yetganlar ulushi = maqsadga yetgan baholar ÷ sonli yakuniy baholar (e'lon qilingan kartalar)
  let reached = 0;
  let numeric = 0;
  for (const c of published) {
    const model = getModel(s, c.modelVersionId);
    const p = model.profiles.find((x) => x.code === c.profileTo);
    for (const it of computeMatch(p.targets, cardScores(s, c)).items) {
      if (it.state === 'scored') {
        numeric += 1;
        if (it.gap === 0) reached += 1;
      }
    }
  }
  const coverage = safeRatio(published.length, active.length);
  const reachedPct = safeRatio(reached, numeric);
  const deCount = decisions.filter((x) => x.d.status === 'de').length;
  const overdue = active.filter((c) => c.stage !== 'published' && c.deadline && c.deadline < s.today);
  const idpDue = s.idp.filter((x) => x.status !== 'done' && x.due && x.due <= '2027-01-31').length;

  const byStage = Object.keys(STAGE_LABELS).map((k) => [k, active.filter((c) => c.stage === k).length]);
  const max = Math.max(1, ...byStage.map(([, n]) => n));

  // Sizni kutayotgan ishlar: har biri bitta aniq harakat bilan
  const todo = [];
  for (const { c, d } of decisions) {
    if (c.stage === 'published') {
      if (c.panel?.decision === 'appoint' && !c.appointment) todo.push({ key: c.id, tone: 'warn', who: getEmployee(s, c.employeeId).name, what: 'Rasmiy tayinlash hujjatini kiriting', go: `/cards/${c.id}` });
      continue;
    }
    const e = getEmployee(s, c.employeeId).name;
    const late = c.deadline && c.deadline < s.today;
    const unrated = d.match.counts.unrated;
    let what;
    if (unrated) what = `${unrated} ta kompetensiya baholanmagan`;
    else if (d.status === 'de') what = 'Dalil yetarli emas — qo‘shimcha dalil yig‘ing';
    else if (c.stage === 'panel' && !c.panel) what = 'Panel protokolini kiriting';
    else what = `Keyingi bosqichga o‘tkazing (${STAGE_LABELS[c.stage]})`;
    todo.push({ key: c.id, tone: late ? 'bad' : 'brand', who: e, what, late, go: `/cards/${c.id}` });
  }
  for (const st of s.stretches.filter((x) => x.status === 'submitted')) todo.push({ key: st.id, tone: 'brand', who: getEmployee(s, st.employeeId).name, what: `Stretch dalilini ko‘rib chiqing: «${st.title}»`, go: `/stretch/${st.id}` });
  const idpNew = s.idp.filter((x) => x.status === 'proposed');
  if (idpNew.length) todo.push({ key: 'idp-new', tone: 'brand', who: `${idpNew.length} ta vazifa`, what: 'Rivojlanish rejasi takliflarini tasdiqlang (tizim va xodim takliflari)', go: '/idp' });
  const idpRev = s.idp.filter((x) => x.status === 'review');
  if (idpRev.length) todo.push({ key: 'idp-rev', tone: 'brand', who: `${idpRev.length} ta vazifa`, what: 'Xodimlar bajargan rivojlanish vazifalarini tekshiring', go: '/idp' });
  const taskRev = (s.enrollments || []).filter((e) => !D.getCourse(s, e.courseId)?.onboarding).reduce((a, e) => a + Object.values(e.progress).filter((p) => p.status === 'pending').length, 0);
  if (taskRev) todo.push({ key: 'crs-rev', tone: 'brand', who: `${taskRev} ta topshiriq`, what: 'Kurslardagi amaliy topshiriqlarga mentor xulosasini bering', go: '/courses' });
  const pendingEv = s.evidenceQueue.filter((x) => x.status === 'pending');
  if (pendingEv.length) todo.push({ key: 'ev', tone: 'brand', who: `${pendingEv.length} ta dalil`, what: 'Xodimlar yuborgan qo‘shimcha dalillarni tekshiring', go: '/evidence' });
  for (const [m, x] of Object.entries(s.kpiInbox || {})) todo.push({ key: `kpi-${m}`, tone: 'warn', who: `${x.rows.length} ustoz`, what: `${monthName(m)} KPI hisoboti tayyor — natijalarni oling, chegaradan pastlarga kurs biriktiriladi`, go: '/teachers' });
  const skillClaims = (s.empSkills || []).filter((x) => x.claim).length;
  if (skillClaims) todo.push({ key: 'skills', tone: 'brand', who: `${skillClaims} ta ko‘nikma`, what: 'Xodimlar dalil bilan yuborgan ko‘nikmalarni tasdiqlang', go: '/skills' });
  // Moslashuv (onboarding)
  if (s.hrInbox?.length) todo.push({ key: 'hr-inbox', tone: 'warn', who: `${s.hrInbox.length} ta hodisa`, what: 'Jobster/Edu integratsiya navbati: yangi xodimlar, arxiv va qaytish', go: '/integration' });
  for (const ob of (s.onboardings || []).filter((o) => o.status === 'active' && (D.onboardingScore(s, o).ready || D.onbDay(s, o) >= D.obDays(s, o)))) todo.push({ key: `onb-${ob.id}`, tone: 'brand', who: getEmployee(s, ob.employeeId).name, what: 'Moslashuv dasturi yakunlandi — onboarding bahosini tasdiqlang (filial rahbari)', go: `/onboarding/${ob.id}` });
  const onbTasks = (s.enrollments || []).filter((e) => D.getCourse(s, e.courseId)?.onboarding && e.status !== 'archived').reduce((a, e) => a + Object.values(e.progress).filter((p) => p.status === 'pending').length, 0);
  if (onbTasks) todo.push({ key: 'onb-tasks', tone: 'brand', who: `${onbTasks} ta topshiriq`, what: 'Moslashuv kursidagi topshiriqni baholang (1–5) — mentor yoki kurator', go: '/tasks' });
  const rem = D.dueReminders(s).filter((r) => !s.notifications.some((n) => n.key.startsWith(r.key)));
  if (rem.length) todo.push({ key: 'rem', tone: 'warn', who: `${rem.length} ta xodim`, what: 'Bugungi kurs eslatmalari (platforma + Telegram) yuborilmagan', go: '/reminders' });
  todo.sort((a, b) => (b.late ? 1 : 0) - (a.late ? 1 : 0));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Bosh panel</h1>
          <p>2026 kuz sikli: kimni baholash kerak, kim qaysi bosqichda va kim keyingi darajaga tayyor.</p>
        </div>
      </div>
      <Panel title={<div className="row"><h2>Sizni kutayotgan ishlar</h2><Pill tone={todo.some((t) => t.late) ? 'bad' : 'brand'}>{todo.length}</Pill></div>} tight>
        {todo.length ? (
          <div className="todo-list">
            {todo.map((t) => (
              <button key={t.key} className="todo" onClick={() => go(t.go)}>
                <span className={`dot-ic ${t.tone}`} />
                <b>{t.who}</b>
                <span className="ink2">{t.what}</span>
                {t.late && <Pill tone="bad">muddati o‘tgan</Pill>}
                <span className="todo-go">Ochish →</span>
              </button>
            ))}
          </div>
        ) : <div className="empty">Hozircha kutayotgan ish yo‘q.</div>}
      </Panel>
      <div className="grid g4">
        <Stat k="Baholash yakunlangan" v={coverage === null ? '—' : fmtPct(coverage)} s={`${published.length} ta karta e’lon qilingan, jami ${active.length}`} icon="cards" />
        <Stat k="Maqsad darajasiga yetgan baholar" v={reachedPct === null ? '—' : fmtPct(reachedPct)} s={`${numeric} ta bahodan ${reached} tasi maqsadda`} icon="target" tone="teal" />
        <Stat k="Dalil yetarli bo‘lmagan kartalar" v={deCount} s="Qo‘shimcha dalil yig‘ish kerak" icon="alert" tone={deCount ? 'warn' : 'good'} />
        <Stat k="Muddati o‘tgan kartalar" v={overdue.length} s={idpDue ? `${idpDue} ta rivojlanish vazifasi muddati yaqin` : 'Rivojlanish vazifalari muddatida'} icon="clock" tone={overdue.length ? 'bad' : 'good'} />
      </div>
      <div className="grid g12">
        <Panel title="Kartalar bosqichlar bo‘yicha">
          <div className="bars">
            {byStage.map(([k, n]) => (
              <div className={`b ${k === 'published' ? 'pub' : ''}`} key={k}>
                <span>{STAGE_LABELS[k]}</span>
                <span className="t"><i style={{ width: `${(100 * n) / max}%` }} /></span>
                <b>{n}</b>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Keyingi darajaga tayyorlik" tight>
          <table>
            <thead>
              <tr><th>Xodim</th><th>O‘tish</th><th className="num">Moslik</th><th>Holat</th></tr>
            </thead>
            <tbody>
              {decisions.map(({ c, d }) => {
                const e = getEmployee(s, c.employeeId);
                return (
                  <tr key={c.id} className="clickable" onClick={() => go(`/cards/${c.id}`)}>
                    <td><Person name={e.name} sub={getBranch(s, c.branchId)?.name} /></td>
                    <td style={{ whiteSpace: 'nowrap' }}>{c.profileFrom ? `${c.profileFrom} → ${c.profileTo}` : c.profileTo}<div className="muted small">{STAGE_LABELS[c.stage]}</div></td>
                    <td className="num" style={{ minWidth: 110 }}>{isNum(d.match.match) ? <b>{fmtPct(d.match.match)}</b> : <span className="muted small" style={{ whiteSpace: 'nowrap' }}>{d.match.counts.scored}/{d.match.counts.total} baholangan</span>}<div style={{ marginTop: 6 }}><Meter thin value={d.match.match ?? (100 * d.match.creditedSum) / d.match.targetSum} threshold={profileThreshold(getModel(s, c.modelVersionId), c.profileTo)} /></div></td>
                    <td><Pill tone={d.tone}>{d.label}</Pill></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>
      </div>
      <details className="panel history">
        <summary>Demo bo‘yicha qisqa yo‘riqnoma</summary>
        <ol className="steps-list" style={{ padding: 16 }}>
          <li><span><a href="#/cards/c-101">Dilshod Karimov (FR-1 → FR-2)</a>: «Keyingi qadam» blokidagi tugma bilan LDR-05 ni oching, darajani rubrikadan tanlang, so‘ng panel protokoli, e’lon va rasmiy tayinlash.</span></li>
          <li><span><a href="#/stretch/s-201">Stretch vazifa</a>: dalilni qaytaring; xodim ko‘rinishida (Nodira Rahimova) qayta yuboring va tasdiqlang.</span></li>
          <li><span><a href="#/cards/c-103">Malika Yusupova (LT-1 → LT-2)</a>: bitta dars kuzatuvida bir nechta kompetensiyani baholang, majburiy talablarni belgilang.</span></li>
          <li><span><a href="#/models">Kompetensiya modellari</a>: yangi lavozim modelini yarating yoki mavjudini solishtiring.</span></li>
          <li><span>Xodim ko‘rinishi → Malika Yusupova → <b>Karyera yo‘lim</b>.</span></li>
        </ol>
        <p className="muted small" style={{ padding: '0 16px 16px' }}>Bugungi sana (demo): {fmtDate(s.today)}</p>
      </details>
    </>
  );
}
