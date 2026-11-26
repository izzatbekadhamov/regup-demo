import { useAppState } from '../state/store.js';
import { fmtDate } from '../ui/common.jsx';
import { DsBadge, DsButton, DsIcon, JourneyStep, ProgressRing, RewardChip } from '../ui/ds.jsx';
import * as D from '../core/domain.js';

const ADAPT_DAYS = 60; // adaptatsiya davri (moslashuv dasturi uning ichida)
const KIND_WORD = { lesson: 'Dars', test: 'Test', task: 'Amaliy topshiriq' };

/** Eng yaqin olinmagan badge: katalogdagi shart bo'yicha progress eng katta bo'lgani. Badge — faqat noodatiy natija uchun. */
function nearestBadge(s, emp) {
  const enrs = (s.enrollments || []).filter((e) => e.employeeId === emp.id && e.status === 'completed');
  const val = {
    grade5: enrs.filter((e) => D.courseGrade(D.getCourse(s, e.courseId), e) === 5).length,
    streak: D.learningStreak(s, emp.id),
    points: D.employeePoints(s, emp.id).total,
    courses: enrs.length,
  };
  return (s.gamification?.badges || [])
    .filter((b) => b.active !== false && b.n > 0 && (val[b.kind] ?? 0) < b.n)
    .map((b) => ({ ...b, value: val[b.kind] ?? 0, ratio: (val[b.kind] ?? 0) / b.n, unit: D.BADGE_KINDS[b.kind]?.[1] || '' }))
    .sort((a, b) => b.ratio - a.ratio)[0] || null;
}

/** Bajarilmagan qadamlar: avval moslashuv kurslari, keyin boshqa kurslar; har kursda tartib bo'yicha. */
function nextSteps(s, emp, ob) {
  const onb = ob && ob.status === 'active' ? D.onbEnrollments(s, ob) : [];
  const other = (s.enrollments || []).filter((e) => e.employeeId === emp.id && !onb.some((x) => x.id === e.id));
  const rules = s.gamification?.points || {};
  const pts = (k) => Number(rules[k] ?? D.POINT_ACTIONS[k]?.[1] ?? 0);
  const out = [];
  for (const enr of [...onb, ...other]) {
    if (enr.status === 'completed' || enr.status === 'archived') continue;
    const course = D.getCourse(s, enr.courseId);
    if (!course) continue;
    for (const c of course.components) {
      if (D.componentDone(course, enr, c.id)) continue;
      const waiting = c.kind === 'task' && enr.progress[c.id]?.status === 'pending';
      out.push({ key: `${enr.id}-${c.id}`, enrId: enr.id, course: course.title, title: c.title, kind: c.kind, minutes: c.minutes, points: pts(c.kind), deadline: enr.deadline, waiting });
    }
  }
  return out;
}

function deadlineBadge(s, deadline) {
  if (!deadline) return null;
  if (deadline < s.today) return <DsBadge tone="danger">Muddat o‘tdi</DsBadge>;
  if (D.daysBetween(s.today, deadline) <= 7) return <DsBadge tone="warning">{fmtDate(deadline).slice(0, 5)} gacha</DsBadge>;
  return null;
}

export default function Today({ emp }) {
  const s = useAppState();
  const ob = D.onboardingOf(s, emp.id);
  const activeOb = ob && ob.status === 'active' ? ob : null;
  const day = activeOb ? Math.min(D.onbDay(s, activeOb), ADAPT_DAYS) : null;
  const pts = D.employeePoints(s, emp.id);
  const streak = D.learningStreak(s, emp.id);
  const badges = D.employeeBadges(s, emp.id);
  const goal = nearestBadge(s, emp);
  const steps = nextSteps(s, emp, ob);
  const current = steps.find((x) => !x.waiting);
  const rest = steps.filter((x) => x !== current).slice(0, 3);
  const mentor = emp.supervisorId ? D.getEmployee(s, emp.supervisorId) : null;
  const first = emp.name.split(' ')[0];

  return (
    <div className="today">
      <section className="today-hero" aria-label="Bugungi holat">
        <div className="today-chips">
          <RewardChip kind="streak" value={streak} onBrand />
          <RewardChip kind="points" value={pts.total} onBrand />
          <RewardChip kind="badge" value={badges.length} onBrand />
        </div>
        <div className="today-hello">
          {activeOb
            ? <ProgressRing value={day} max={ADAPT_DAYS} sublabel={`/ ${ADAPT_DAYS} kun`} onBrand ariaLabel={`Moslashuv: ${ADAPT_DAYS} kundan ${day} kun o‘tdi`} />
            : <ProgressRing value={pts.items.length} max={Math.max(pts.items.length, 1)} center={pts.total} sublabel="ball" onBrand ariaLabel={`${pts.total} ball`} />}
          <div>
            <h1>Salom, {first}</h1>
            <p>
              {activeOb ? 'Moslashuv davri davom etmoqda. ' : ''}
              {goal ? <>«{goal.name}» badge’igacha: <b>{goal.value} / {goal.n} {goal.unit}</b></> : badges.length ? `Sizda ${badges.length} ta badge bor.` : ''}
            </p>
          </div>
        </div>
      </section>

      <section className="today-card" aria-label="Keyingi qadamlar">
        <div className="today-card-head"><h2>Keyingi qadamlar</h2>{steps.length > 0 && <span className="small muted">{steps.length} ta qoldi</span>}</div>
        {current ? (
          <>
            <JourneyStep state="current" meta={`Hozir · ${current.minutes ? `${current.minutes} daqiqa · ` : ''}+${current.points} ball`} title={current.title} last={!rest.length && !goal}>
              <span className="small muted">{KIND_WORD[current.kind]} · {current.course}</span>
              <div><DsButton href={`#/learn/${current.enrId}`} icon="arrow">Boshlash</DsButton></div>
            </JourneyStep>
            {rest.map((x, i) => (
              <JourneyStep key={x.key} index={i + 2} last={i === rest.length - 1 && !goal}
                title={<span className="row between" style={{ gap: 8, flexWrap: 'wrap' }}><span>{x.title}</span>{x.waiting ? <DsBadge tone="primary">Mentor tekshiryapti</DsBadge> : deadlineBadge(s, x.deadline)}</span>} />
            ))}
            {goal && <JourneyStep state="reward" last title={`Badge: ${goal.name}`} />}
          </>
        ) : steps.length ? (
          <p className="small ink2">Topshiriqlaringiz mentor tekshiruvida. Natija chiqqach, bu yerda keyingi qadam ko‘rinadi.</p>
        ) : (
          <p className="small ink2">Hozircha bajariladigan dars yo‘q. Yangi kurslar <a href="#/learning">Kurslarim</a> bo‘limida.</p>
        )}
      </section>

      {mentor && (
        <section className="today-mentor" aria-label="Mentor">
          <span className="ru-avatar ru-avatar--md" aria-hidden="true">{mentor.name.split(' ').map((w) => w[0]).join('').slice(0, 2)}</span>
          <span className="nm"><b>{mentor.name}</b><small>Mentoringiz</small></span>
          <DsButton variant="ghost" size="sm" href="#/meetings">Uchrashuv</DsButton>
        </section>
      )}

      <nav className="today-links" aria-label="Bo‘limlar">
        {ob && <a href="#/onboarding"><DsIcon name="layers" size={18} />Moslashuv dasturim</a>}
        <a href="#/results"><DsIcon name="trend" size={18} />Darajalarim</a>
        <a href="#/learning"><DsIcon name="book" size={18} />Kurslarim</a>
        <a href="#/idp"><DsIcon name="check" size={18} />Rivojlanish rejam</a>
      </nav>
    </div>
  );
}
