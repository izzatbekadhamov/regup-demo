// Onboarding dashboard analitikasi: retention (30/60 kun), jarayon holati, kurslar bajarilishi va kurs bahosi,
// ball va 2-oy KPI bog'liqligi, ketish nuqtalari, mentor/filial va manba kesimlari.
// Manba: demo tarixiy kogorta (s.onbHistory) + jonli moslashuvlar (s.onboardings).
import * as D from './domain.js';

const avg = (xs) => { const v = xs.filter((x) => x !== null && x !== undefined && !Number.isNaN(x)); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
const pct = (a, b) => (b ? (100 * a) / b : null);
export const monthOf = (iso) => iso.slice(0, 7);

/** Jonli moslashuv yozuvini tarixiy qator ko'rinishiga keltiradi. */
function liveRow(s, ob) {
  const emp = D.getEmployee(s, ob.employeeId);
  const enrs = D.onbEnrollments(s, ob);
  const r = D.onboardingScore(s, ob);
  const leftAt = emp.status === 'archived' && ob.status === 'archived' ? emp.leftAt : null;
  const courses = enrs.map((e) => {
    const c = D.getCourse(s, e.courseId);
    const t = c.components.find((x) => x.kind === 'test');
    const p = t && e.progress[t.id];
    const doneN = c.components.filter((x) => D.componentDone(c, e, x.id)).length;
    return { courseId: e.courseId, grade: D.courseGrade(c, e), pct: c.components.length ? (100 * doneN) / c.components.length : 0, testPct: typeof p?.best === 'number' ? p.best : null, firstPass: p ? p.attempts === 1 && p.best >= t.passScore : null,
      onTime: e.status === 'completed' ? e.completedAt <= e.deadline : e.deadline < s.today ? false : null, days: e.status === 'completed' ? D.daysBetween(e.startedAt, e.completedAt) : null, done: e.status === 'completed' };
  });
  const parts = Object.fromEntries(r.parts.map((p) => [p.key, p.value]));
  return { id: ob.id, live: true, ob, name: emp.name, position: emp.position, branchId: emp.branchId, mentor: emp.supervisorId ? D.getEmployee(s, emp.supervisorId)?.name : '—', source: ob.source,
    startedAt: ob.startedAt, leftAt, leftDay: leftAt ? D.daysBetween(ob.startedAt, leftAt) : null, reason: leftAt ? emp.archiveReason : null,
    courses, parts, score: ob.final?.score ?? (ob.status === 'completed' ? r.score : null), kpi2: null, kpiReachedMonth: null, passed: !!ob.final?.passed, active: ob.status === 'active' };
}

export function onbRows(s, f = {}, scope = null) {
  const live = (s.onboardings || []).filter((o) => !o.reboarding).map((o) => liveRow(s, o));
  const hist = (s.onbHistory || []).map((h) => ({ ...h, live: false, active: false }));
  return [...hist, ...live].filter((r) => (!scope || scope.has(r.branchId)) && (!f.branch || r.branchId === f.branch) && (!f.position || r.position === f.position)
    && (!f.source || r.source === f.source) && (!f.from || monthOf(r.startedAt) >= f.from) && (!f.to || monthOf(r.startedAt) <= f.to));
}

/** N kunlik retention: kogortada N kuni to'lganlardan nechtasi N-kungacha ketmagan. */
export function retention(rows, today, days) {
  const el = rows.filter((r) => D.addDays(r.startedAt, days) <= today);
  const kept = el.filter((r) => r.leftDay === null || r.leftDay >= days).length;
  return { n: el.length, kept, pct: pct(kept, el.length) };
}

export function cohorts(rows, today) {
  const ms = [...new Set(rows.map((r) => monthOf(r.startedAt)))].sort();
  return ms.map((m) => { const g = rows.filter((r) => monthOf(r.startedAt) === m); return { month: m, n: g.length, r30: retention(g, today, 30), r60: retention(g, today, 60), r90: retention(g, today, 90) }; });
}

export function breakdown(rows, today, dim) {
  const keys = [...new Set(rows.map((r) => r[dim]))];
  return keys.map((k) => {
    const g = rows.filter((r) => r[dim] === k);
    return { key: k, n: g.length, r30: retention(g, today, 30), r60: retention(g, today, 60), score: avg(g.map((r) => r.score)), kpi: avg(g.map((r) => r.kpi2?.retention ?? null)), passed: pct(g.filter((r) => r.passed).length, g.filter((r) => r.score !== null).length) };
  }).sort((a, b) => b.n - a.n);
}

export const LEAVE_STAGES = [['induction', 'Induction (1–7 kun)', 0, 8], ['d8', 'D8 (8–29 kun)', 8, 30], ['d30', 'D30 dan keyin (30–59 kun)', 30, 60]];
export function leaveStages(rows, today) {
  const left = rows.filter((r) => r.leftDay !== null && r.leftDay < 60);
  const stages = LEAVE_STAGES.map(([k, l, a, b]) => ({ key: k, label: l, n: left.filter((r) => r.leftDay >= a && r.leftDay < b).length }));
  const reasons = Object.entries(left.reduce((m, r) => ({ ...m, [r.reason]: (m[r.reason] || 0) + 1 }), {})).sort((a, b) => b[1] - a[1]);
  // T3: 30 kun ichida ketganlar — faqat 30 kuni to'lgan kogortadan
  const el = rows.filter((r) => D.addDays(r.startedAt, 30) <= today);
  const early = el.filter((r) => r.leftDay !== null && r.leftDay < 30);
  const earlyReasons = Object.entries(early.reduce((m, r) => ({ ...m, [r.reason]: (m[r.reason] || 0) + 1 }), {})).sort((a, b) => b[1] - a[1]);
  return { total: left.length, stages, reasons, early: { n: early.length, of: el.length, pct: pct(early.length, el.length), reasons: earlyReasons } };
}

/** Jonli xodimning bajarilish indeksi: bajarilgan qism ÷ shu kungacha rejadagi qism. */
export function liveProgress(s, ob) {
  const day = D.onbDay(s, ob);
  const enrs = D.onbEnrollments(s, ob);
  // Reja kurs berilgan kundan hisoblanadi (kech kiritilgan xodim ishga kirgan kundan jazolanmaydi).
  const from = enrs.map((e) => e.startedAt).sort()[0] || ob.startedAt;
  const until = enrs.map((e) => e.deadline).sort().at(-1) || D.addDays(from, D.obDays(s, ob));
  const since = D.daysBetween(from, s.today);
  let total = 0; let done = 0; let started = false; let overdue = false; let pending = 0;
  for (const e of enrs) {
    const c = D.getCourse(s, e.courseId);
    total += c.components.length;
    done += c.components.filter((x) => D.componentDone(c, e, x.id)).length;
    if (Object.keys(e.progress).length) started = true;
    if (e.status !== 'completed' && e.deadline < s.today) overdue = true;
    pending += Object.values(e.progress).filter((p) => p.status === 'pending').length;
  }
  const expected = total * Math.min(1, since / Math.max(1, D.daysBetween(from, until)));
  const index = since < 3 || !expected ? 1 : Math.min(1.5, done / expected);
  const status = overdue ? 'overdue' : !started && since >= 3 ? 'notStarted' : index < 0.75 ? 'behind' : 'ontrack';
  return { day, since, total, done, index, status, pending };
}
export const LIVE_STATUS = { ontrack: ['Reja bo‘yicha', 'good'], behind: ['Ortda', 'warn'], notStarted: ['Boshlamagan', 'warn'], overdue: ['Muddat o‘tgan', 'bad'] };

/** Xavf guruhi: ortda qolish, boshlamaslik, kech kiritilish, kuzatuv yo'qligi. So'rovnoma anonim — xodimga bog'lanmaydi. */
export function riskList(s, scope = null) {
  return (s.onboardings || []).filter((o) => o.status === 'active' && (!scope || scope.has(D.getEmployee(s, o.employeeId).branchId))).map((ob) => {
    const p = liveProgress(s, ob);
    const reasons = [];
    if (p.status !== 'ontrack') reasons.push(LIVE_STATUS[p.status][0].toLowerCase() + (p.status === 'behind' ? ` (${Math.round(p.index * 100)}% reja)` : ''));
    if (D.onbLateDays(ob) >= s.onboardingConfig.lateDays) reasons.push(`kech kiritilgan (${D.onbLateDays(ob)} kun)`);
    const r = D.onboardingScore(s, ob);
    if (r.needObs && p.day >= 15 && r.obs === 0) reasons.push('dars kuzatuvi yo‘q');
    return { ob, emp: D.getEmployee(s, ob.employeeId), p, reasons };
  }).filter((x) => x.reasons.length).sort((a, b) => b.reasons.length - a.reasons.length);
}

const ballOf = (pctv) => (pctv === null || pctv === undefined ? null : pctv >= 90 ? 5 : pctv >= 75 ? 4 : pctv >= 60 ? 3 : pctv >= 40 ? 2 : 1);
const gradeOf = (c) => c.grade ?? ballOf(c.testPct);
const pctOf = (c) => c.pct ?? (c.done ? 100 : 50);
/** Onboarding dasturi (lavozim Learning Path'i) bo'yicha: o'rtacha kurs bahosi, kurslar bajarilishi, kurs bo'yicha tafsilot. */
export function programStats(rows) {
  const ps = [...new Set(rows.map((r) => r.position))];
  return ps.map((position) => {
    const g = rows.filter((r) => r.position === position);
    const cs = g.flatMap((r) => r.courses);
    const ids = [...new Set(cs.map((c) => c.courseId))];
    return {
      position, n: g.length, grade: avg(cs.map(gradeOf)), pct: avg(cs.map(pctOf)), done: avg(g.map((r) => r.courses.filter((c) => c.done).length)), total: ids.length,
      byCourse: ids.map((id) => { const x = cs.filter((c) => c.courseId === id); return { courseId: id, n: x.length, grade: avg(x.map(gradeOf)), pct: avg(x.map(pctOf)) }; }),
    };
  }).sort((a, b) => b.n - a.n);
}

export function masteryStats(rows) {
  const cs = rows.flatMap((r) => r.courses.filter((c) => c.done || c.onTime === false).map((c) => ({ ...c, row: r })));
  const byCourse = [...new Set(cs.map((c) => c.courseId))].map((id) => {
    const g = cs.filter((c) => c.courseId === id);
    return { courseId: id, n: g.length, grade: avg(g.map(gradeOf)), pct: avg(g.map(pctOf)), onTime: pct(g.filter((c) => c.onTime).length, g.length), firstPass: pct(g.filter((c) => c.firstPass).length, g.filter((c) => c.firstPass !== null).length), test: avg(g.map((c) => c.testPct)), days: avg(g.map((c) => c.days)) };
  });
  return { n: cs.length, grade: avg(cs.map(gradeOf)), pct: avg(cs.map(pctOf)), onTime: pct(cs.filter((c) => c.onTime).length, cs.length), firstPass: pct(cs.filter((c) => c.firstPass).length, cs.filter((c) => c.firstPass !== null).length), test: avg(cs.map((c) => c.testPct)), days: avg(cs.map((c) => c.days)), byCourse };
}

export function pearson(xs, ys) {
  const n = xs.length;
  if (n < 3) return null;
  const mx = avg(xs); const my = avg(ys);
  let a = 0; let bx = 0; let by = 0;
  for (let i = 0; i < n; i += 1) { a += (xs[i] - mx) * (ys[i] - my); bx += (xs[i] - mx) ** 2; by += (ys[i] - my) ** 2; }
  return bx && by ? a / Math.sqrt(bx * by) : null;
}
export const rWord = (r) => (r === null ? '—' : Math.abs(r) >= 0.7 ? 'kuchli' : Math.abs(r) >= 0.4 ? 'o‘rtacha' : Math.abs(r) >= 0.2 ? 'kuchsiz' : 'deyarli yo‘q');

export function correlation(rows, metric = 'retention') {
  const pts = rows.filter((r) => r.score !== null && r.kpi2).map((r) => ({ x: r.score, y: r.kpi2[metric], row: r }));
  const r = pearson(pts.map((p) => p.x), pts.map((p) => p.y));
  const hi = pts.filter((p) => p.x >= 4); const lo = pts.filter((p) => p.x < 3.5);
  const parts = Object.keys(D.ONB_PARTS).map((k) => {
    const g = rows.filter((x) => x.parts?.[k] !== null && x.parts?.[k] !== undefined && x.kpi2);
    return { key: k, label: D.ONB_PARTS[k][0], n: g.length, r: pearson(g.map((x) => x.parts[k]), g.map((x) => x.kpi2[metric])) };
  });
  return { pts, r, n: pts.length, hi: { n: hi.length, kpi: avg(hi.map((p) => p.y)) }, lo: { n: lo.length, kpi: avg(lo.map((p) => p.y)) }, parts };
}

export function productivity(rows) {
  const g = rows.filter((r) => r.position === 'GE' && r.kpi2);
  const buckets = [[2, '2-oyda'], [3, '3-oyda'], [4, '4-oyda'], [null, 'Hali bajarmagan']];
  return { n: g.length, avg: avg(g.map((r) => r.kpiReachedMonth)), buckets: buckets.map(([m, l]) => ({ label: l, n: g.filter((r) => r.kpiReachedMonth === m).length })) };
}

/** Korrelyatsiya ishonchli bo'lishi uchun kerakli minimal xodim soni (T10). */
export const CORR_MIN_N = 100;

/** Filiallar kesimida so'rovnoma va jarayon ko'rsatkichlari (anonim jamlanma). */
export function processByBranch(s, scope = null) {
  return Object.keys(s.surveyStats?.byBranch || {}).filter((id) => !scope || scope.has(id)).map((id) => D.surveyBranch(s, id));
}
export function processTotals(list) {
  const sum = (k) => list.reduce((a, r) => a + (r[k] || 0), 0);
  const hires = sum('hires');
  const w = (k) => (hires ? list.reduce((a, r) => a + (r[k] ?? 0) * r.hires, 0) / hires : null);
  const items = D.CHECKLIST_ITEMS.map((_, i) => (hires ? list.reduce((a, r) => a + r.checklist[i] * r.hires, 0) / hires : null));
  const resp = list.reduce((a, r) => a + r.d8[0], 0);
  const enpsW = list.filter((r) => r.d30[0] + r.d60[0] > 0);
  const enpsN = enpsW.reduce((a, r) => a + r.d30[0] + r.d60[0], 0);
  return { hires, rate: pct(resp, hires), checklist: avg(items), items, jobsterOnTime: w('jobsterOnTime'), dataIn3: w('dataIn3'), enps: enpsN ? enpsW.reduce((a, r) => a + r.enps * (r.d30[0] + r.d60[0]), 0) / enpsN : null, low: list.filter((r) => r.rate !== null && r.rate < D.SURVEY_MIN_RATE).length };
}

/** Mentor yuklamasi (T7): hozir moslashuvdagi xodimlar soni, mentor bo'yicha. */
export function mentorLoad(s, scope = null) {
  const m = {};
  for (const ob of (s.onboardings || []).filter((o) => o.status === 'active')) {
    const e = D.getEmployee(s, ob.employeeId);
    if (scope && !scope.has(e.branchId)) continue;
    const name = e.supervisorId ? D.getEmployee(s, e.supervisorId)?.name : 'biriktirilmagan';
    m[name] = (m[name] || 0) + 1;
  }
  return Object.entries(m).sort((x, y) => y[1] - x[1]);
}

/** Ma'lumot sifati (T11), kech kiritish, reboarding (T12), CEO/HRD uchrashuvi. */
export function dataQuality(s, scope = null) {
  const inScope = (e) => !scope || scope.has(e.branchId);
  const obs = (s.onboardings || []).filter((o) => inScope(D.getEmployee(s, o.employeeId)));
  const late = obs.filter((o) => D.onbLateDays(o) >= s.onboardingConfig.lateDays).length;
  const dups = (s.hrLog || []).filter((l) => l.tone === 'bad' && /raqami bilan xodim bor/.test(l.text)).length + (s.dataIssues?.duplicates || 0);
  const lateArchive = s.employees.filter((e) => inScope(e) && e.status === 'archived' && e.leftAt && e.archivedAt && D.daysBetween(e.leftAt, e.archivedAt) > 30).length + (s.dataIssues?.lateArchive || 0);
  const reboarding = obs.filter((o) => o.reboarding).length;
  const due = obs.filter((o) => D.onbDay(s, o) >= 30 && o.status !== 'archived');
  const ceo = due.filter((o) => D.ceoMeetingOf(s, o.employeeId)).length;
  return { late, lateOf: obs.length, dups, lateArchive, reboarding, ceo, ceoOf: due.length };
}
