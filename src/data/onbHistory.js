// Onboarding dashboard uchun DEMO tarixiy kogorta (may–oktabr 2026). Sun'iy, lekin ichki mantiqli:
// sifat (q) ball qismlariga, ketish ehtimoliga, D8 so'rovnomasiga va 2-oy KPI'ga ta'sir qiladi.
// Kuzatuv bahosi KPI bilan eng kuchli, test — eng kuchsiz bog'langan (metodologiyani tekshirish misoli).
// Ishchi tizimda bu ma'lumot Jobster (retention, so'rovnoma), Edu (KPI, ketish sababi) va RegUP'dan yig'iladi.

function rng(seed) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const r1 = (v) => Math.round(v * 10) / 10;
const addDays = (iso, n) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

const FIRST = ['Aziza', 'Bekzod', 'Charos', 'Diyor', 'Elyor', 'Feruza', 'G‘ayrat', 'Hilola', 'Islom', 'Jasmina', 'Kamron', 'Laziza', 'Mirjalol', 'Nargiza', 'Oybek', 'Parizoda', 'Rustam', 'Sabina', 'Temur', 'Umida', 'Vohid', 'Xurshida', 'Yulduz', 'Zarina'];
const LAST = ['Abdullayev', 'Boboyev', 'Valiyev', 'G‘aniyev', 'Ergashev', 'Jo‘rayev', 'Zokirov', 'Ismoilov', 'Karimov', 'Latipov', 'Mahmudov', 'Nurmatov', 'Olimov', 'Po‘latov', 'Rahimov', 'Saidov', 'To‘xtayev', 'Umarov', 'Fayzullayev', 'Xolmatov'];
const fem = new Set(['Aziza', 'Charos', 'Feruza', 'Hilola', 'Jasmina', 'Laziza', 'Nargiza', 'Parizoda', 'Sabina', 'Umida', 'Xurshida', 'Yulduz', 'Zarina']);
const BR = ['b-chil', 'b-yunus', 'b-serg', 'b-yangi', 'b-mirz', 'b-olm', 'b-samq'];
const GE_MENTOR = { 'b-chil': 'Gulbahor Rasulova', 'b-yunus': 'Sherzod Ismoilov', 'b-serg': 'Muhayyo Karimova', 'b-yangi': 'Doniyor Aliyev', 'b-mirz': 'Sevara Yo‘ldosheva', 'b-olm': 'Kamron Usmonov', 'b-samq': 'Aziz Raximov' };
const MENTOR_EFFECT = { 'Sherzod Ismoilov': 0.35, 'Gulbahor Rasulova': 0.2, 'Muhayyo Karimova': -0.55, 'Kamron Usmonov': -0.15 };
const REASONS = ['Ish yuklamasi kutilganidan ko‘p', 'Maosh kutilganidan past', 'Jamoaga moslasha olmadi', 'O‘qish yoki boshqa shaharga ko‘chish', 'Boshqa ish taklifi'];
const PROGRAM = { GE: ['CRS-ON-CORP', 'CRS-ON-GE'], FIN: ['CRS-ON-CORP', 'CRS-ON-FIN'], FR: ['CRS-ON-CORP'] };
const DIFFICULTY = { 'CRS-ON-CORP': 0.4, 'CRS-ON-GE': -0.35, 'CRS-ON-FIN': -0.1 };

export function createOnbHistory(today) {
  const rand = rng(20261110);
  const norm = () => (rand() + rand() + rand() - 1.5) * 1.15; // ~N(0, 0.55)
  const months = ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'];
  const rows = [];
  for (let i = 0; i < 48; i += 1) {
    const position = i % 12 < 8 ? 'GE' : i % 12 < 11 ? 'FIN' : 'FR';
    const branchId = BR[Math.floor(rand() * BR.length)];
    const source = rand() < 0.24 ? 'branch' : 'recruiting';
    const mentor = position === 'GE' ? GE_MENTOR[branchId] : position === 'FIN' ? (branchId === 'b-chil' ? 'Rustam Aliyev' : 'Moliya bo‘limi') : 'Hududiy menejer';
    const q = norm() + (source === 'branch' ? -0.35 : 0) + (MENTOR_EFFECT[mentor] || 0);
    const m = months[Math.floor(i / 8)];
    const startedAt = `${m}-${String(1 + Math.floor(rand() * 24)).padStart(2, '0')}`;
    const f = FIRST[Math.floor(rand() * FIRST.length)];
    const l = LAST[Math.floor(rand() * LAST.length)];
    const name = `${f} ${fem.has(f) ? `${l}a` : l}`;
    const d8 = r1(clamp(3.9 + 0.55 * q + norm() * 0.5, 2.4, 5));
    // Ketish: erta (30 kungacha) yoki 30–60 kun oralig'ida. Past sifat, filial o'zi olgan, past D8 — xavf yuqori.
    const pEarly = clamp(0.1 + (q < -0.4 ? 0.2 : 0) + (source === 'branch' ? 0.08 : 0) + (d8 < 3.6 ? 0.25 : 0), 0, 0.65);
    const pLate = clamp(0.06 + (q < -0.2 ? 0.1 : 0), 0, 0.4);
    let leftDay = null;
    if (rand() < pEarly) leftDay = 3 + Math.floor(rand() * 26);
    else if (rand() < pLate) leftDay = 30 + Math.floor(rand() * 30);
    let leftAt = leftDay !== null ? addDays(startedAt, leftDay) : null;
    if (leftAt && leftAt > today) { leftAt = null; leftDay = null; }
    const reason = leftAt ? REASONS[Math.floor(rand() * (q < -0.4 ? 3 : REASONS.length))] : null;
    const finished = !leftAt || leftDay >= 30;
    const courses = PROGRAM[position].map((courseId) => {
      const k = 0.6 * q + DIFFICULTY[courseId] + norm() * 1.1;
      return { courseId, testPct: Math.round(clamp(78 + 12 * k, 45, 100)), firstPass: k > -0.45, onTime: k > -0.3, days: Math.round(clamp(16 - 7 * k, 4, 34)), done: finished || leftDay > 20 };
    });
    const ball = (pct) => (pct >= 90 ? 5 : pct >= 75 ? 4 : pct >= 60 ? 3 : pct >= 40 ? 2 : 1);
    // Onboarding natijasi kartasi: muddatida yakunlash (FR'da yo'q), kurs bahosi, kursdan tashqari topshiriq, ish amaliyotidagi kuzatuv.
    const testsAvg = courses.reduce((a, c) => a + ball(c.testPct), 0) / courses.length;
    const taskV = finished ? clamp(3.6 + 0.7 * q + norm() * 1.0, 1, 5) : null;
    const parts = finished ? {
      onTime: position === 'FR' ? null : r1(1 + 4 * (courses.filter((c) => c.onTime).length / courses.length)),
      courses: r1((testsAvg + taskV) / 2),
      tasks: position === 'FR' ? null : r1(clamp(taskV + 0.3 * q, 1, 5)),
      practice: position === 'GE' ? r1(clamp(3.4 + 1.2 * q + norm() * 0.35, 1, 5)) : r1(clamp(3.7 + 0.8 * q, 1, 5)),
    } : null;
    const vals = parts ? Object.values(parts).filter((v) => v !== null) : [];
    const score = parts ? r1(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
    // 2-oy KPI (faqat ustozlar, 60 kun ishlagan bo'lsa): o'quvchi retentioni va 1-oy konversiyasi.
    const has60 = addDays(startedAt, 60) <= today && (!leftAt || leftDay >= 60);
    const qObs = position === 'GE' ? (parts?.practice ?? 3.4) : 3.4;
    const kpi2 = position === 'GE' && has60 ? {
      retention: r1(clamp(86 + 2.6 * (qObs - 3.4) + 0.8 * q + norm() * 3.4, 70, 99)),
      conversion: r1(clamp(70 + 4 * (qObs - 3.4) + norm() * 7, 40, 95)),
    } : null;
    const reached = kpi2 ? (kpi2.retention >= 90 ? 2 : q > 0.1 ? 3 : q > -0.4 ? 4 : null) : null;
    rows.push({
      id: `h-${i + 1}`, name, position, branchId, mentor, source, startedAt, leftAt, leftDay, reason,
      survey: { d8: leftDay !== null && leftDay < 8 ? null : d8, d30: finished ? r1(clamp(d8 + norm() * 0.3, 2.4, 5)) : null },
      courses, parts, score, kpi2, kpiReachedMonth: reached, passed: score !== null && finished && vals.every((v) => v >= 3),
    });
  }
  return rows;
}
