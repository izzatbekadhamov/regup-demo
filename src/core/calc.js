// RegUP hisoblash yadrosi. Barcha funksiyalar sof (pure): UI va store'dan mustaqil.
// Qaror to'liq aniqlikdagi qiymat bilan tekshiriladi, ekranda 1 kasr xonasigacha ko'rsatiladi (CALC 01).

export const DE = 'DE';
export const NA = 'NA';

export const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/** Ekran uchun foiz: 93.44 -> "93,4%". Qaror uchun ishlatilmaydi. */
export function fmtPct(v, digits = 1) {
  if (!isNum(v)) return '—';
  return `${v.toFixed(digits).replace('.', ',')}%`;
}

export function fmtNum(v, digits = 1) {
  if (!isNum(v)) return '—';
  return Number.isInteger(v) ? String(v) : v.toFixed(digits).replace('.', ',');
}

/** Ball holati: scored | de | na | unrated */
export function scoreState(v) {
  if (isNum(v)) return 'scored';
  if (v === DE) return 'de';
  if (v === NA) return 'na';
  return 'unrated';
}

/**
 * Tarkibli kompetensiya (masalan FUN-05 = HR-01..HR-11 o'rtachasi, butun songa yaxlitlanadi).
 * Hammasi bo'sh -> null (baholanmagan). Bittasi bo'sh yoki DE -> DE.
 */
export function compositeScore(parts, partScores) {
  const vals = parts.map((c) => partScores?.[c]);
  if (vals.every((v) => v === undefined || v === null || v === '')) return null;
  if (vals.some((v) => !isNum(v))) return DE;
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  return Math.round(mean);
}

/** Model bo'yicha yakuniy ballar xaritasi: oddiy ballar + tarkibli kompetensiyalar. */
export function resolveScores(model, rawScores = {}, partScores = {}) {
  const out = { ...rawScores };
  for (const [code, def] of Object.entries(model.composites || {})) {
    out[code] = compositeScore(def.parts, partScores);
  }
  return out;
}

/**
 * Vaznli baholash rejimi uchun taklif qilinadigan daraja: har usul bo'yicha sonli dalillar o'rtachasi,
 * so'ng usul vaznlari bo'yicha o'rtacha (faqat dalili bor usullar vazni normallashtiriladi), butun songa yaxlitlanadi.
 * Bu faqat taklif — yakuniy darajani baholovchi asos bilan kiritadi.
 */
export function weightedLevel(evidences = [], weights = {}, max = 5) {
  const by = {};
  for (const e of evidences) if (isNum(e.value) && weights[e.method] > 0) (by[e.method] ||= []).push(e.value);
  const used = Object.keys(by);
  const missing = Object.keys(weights).filter((m) => weights[m] > 0 && !by[m]);
  if (!used.length) return { value: null, exact: null, used, missing };
  const wSum = used.reduce((a, m) => a + weights[m], 0);
  const exact = used.reduce((a, m) => a + (weights[m] * by[m].reduce((x, y) => x + y, 0)) / by[m].length, 0) / wSum;
  return { value: Math.min(max, Math.max(1, Math.round(exact))), exact, used, missing };
}

/**
 * Kompetensiya mosligi (FR 02):
 *  hisobga olingan ball = min(baho, maqsad); moslik = 100 * Σ hisobga olingan / Σ maqsad.
 *  "Qo'llanmaydi" (NA) maxrajdan chiqariladi. Foiz faqat barcha bandlar sonli bo'lganda chiqadi.
 */
export function computeMatch(targets, scores = {}) {
  const items = Object.entries(targets).map(([code, target]) => {
    const score = scores[code] ?? null;
    const state = scoreState(score);
    return {
      code,
      target,
      score,
      state,
      credited: state === 'scored' ? Math.min(score, target) : null,
      gap: state === 'scored' ? Math.max(0, target - score) : null,
    };
  });
  const counted = items.filter((i) => i.state !== 'na');
  const scored = counted.filter((i) => i.state === 'scored');
  const targetSum = counted.reduce((a, i) => a + i.target, 0);
  const creditedSum = scored.reduce((a, i) => a + i.credited, 0);
  const scoredTargetSum = scored.reduce((a, i) => a + i.target, 0);
  const complete = counted.length > 0 && scored.length === counted.length;
  return {
    items,
    targetSum,
    creditedSum,
    match: complete && targetSum > 0 ? (100 * creditedSum) / targetSum : null,
    // Qisman ko'rinish (karyera kabineti): faqat baholangan bandlar bo'yicha, qaror uchun emas.
    partialMatch: scoredTargetSum > 0 ? (100 * creditedSum) / scoredTargetSum : null,
    coverage: counted.length ? scored.length / counted.length : 0,
    complete,
    counts: {
      total: items.length,
      scored: scored.length,
      de: items.filter((i) => i.state === 'de').length,
      na: items.filter((i) => i.state === 'na').length,
      unrated: items.filter((i) => i.state === 'unrated').length,
    },
  };
}

/** Maqsadli ballar yig'indisidan berilgan chegara uchun minimal butun ball (masalan 61 * 95% -> 58). */
export function minIntegerForThreshold(targetSum, threshold) {
  return Math.ceil((targetSum * threshold) / 100 - 1e-9);
}

/** R1–R3 ish ko'lami (04 bo'lim). */
export function computeRScope(branchCount, activeEmployees) {
  if (!branchCount || branchCount < 1) return null;
  if (branchCount >= 3) return 'R3';
  if (activeEmployees >= 101) return 'R3';
  if (branchCount === 2) return 'R2';
  if (activeEmployees >= 41) return 'R2';
  return 'R1';
}

const levelNo = (code) => Number(String(code).replace(/\D/g, '')) || 0;

/** FR-n rahbar R≤n ko'lamdagi rolni boshqarishi mumkin. */
export function canLeadScope(frCode, rScope) {
  return levelNo(frCode) >= levelNo(rScope);
}

/**
 * Yangi filial KPI (FR 04). items: [{stage, name, weight, plan, fact, evidence, checklist}]
 * Yakuniy foiz = Σ min(fakt/reja, 1) * og'irlik.
 */
export function computeNewBranchKpi(items, { compliance = false, complianceEvidence = '', expectedCount = 8, threshold = 75 } = {}) {
  const errors = [];
  if (items.length !== expectedCount) errors.push(`KPI bandlari soni ${items.length}, kerak: ${expectedCount}`);
  const weightSum = items.reduce((a, i) => a + (isNum(i.weight) ? i.weight : 0), 0);
  if (Math.abs(weightSum - 100) > 1e-9) errors.push(`Og'irliklar jami ${fmtNum(weightSum)}%, kerak: 100%`);
  const rows = items.map((it, idx) => {
    const rowErr = [];
    if (!isNum(it.weight)) rowErr.push("og'irlik yo'q");
    if (!isNum(it.plan) || it.plan <= 0) rowErr.push('reja > 0 bo‘lishi kerak');
    if (!isNum(it.fact) || it.fact < 0) rowErr.push('fakt ≥ 0 bo‘lishi kerak');
    if (it.checklist) {
      if (isNum(it.plan) && !Number.isInteger(it.plan)) rowErr.push('checklist rejasi butun son');
      if (isNum(it.fact) && !Number.isInteger(it.fact)) rowErr.push('checklist fakti butun son');
      if (isNum(it.fact) && isNum(it.plan) && it.fact > it.plan) rowErr.push('checklist fakti rejadan oshmaydi');
    }
    if (!String(it.evidence || '').trim()) rowErr.push('dalil yo‘q');
    rowErr.forEach((e) => errors.push(`${idx + 1}-band (${it.name}): ${e}`));
    const done = isNum(it.plan) && it.plan > 0 && isNum(it.fact) ? it.fact / it.plan : null;
    const weighted = done !== null && isNum(it.weight) ? Math.min(done, 1) * it.weight : null;
    return { ...it, done, weighted, errors: rowErr };
  });
  const result = rows.reduce((a, r) => a + (r.weighted ?? 0), 0);
  const complianceOk = !!compliance && !!String(complianceEvidence).trim();
  const valid = errors.length === 0;
  const reasons = [];
  if (!valid) reasons.push('KPI jadvali to‘liq emas');
  if (!complianceOk) reasons.push('Majburiy compliance dalil bilan tasdiqlanmagan');
  if (result < threshold) reasons.push(`Natija ${fmtPct(result)} < ${threshold}%`);
  return { rows, result, valid, errors, complianceOk, passed: valid && complianceOk && result >= threshold, reasons };
}

/**
 * Audit o'rtachasi (EVD 01): kamida ikkita dalilli band bo'lsa kompetensiya bo'yicha o'rtacha.
 * O'rtacha avtomatik yakuniy daraja emas — baholovchi yakuniy darajani rubrika bo'yicha kiritadi.
 */
export function auditAverage(items) {
  const scored = items.filter((i) => isNum(i.level) && String(i.evidence || '').trim());
  if (scored.length < 2) return DE;
  return scored.reduce((a, i) => a + i.level, 0) / scored.length;
}

/** Mustaqil manbalar soni: bir hujjat nusxalari bir marta hisoblanadi (FLOW 02). */
export function independentSources(evidences) {
  return new Set(evidences.map((e) => e.sourceId).filter(Boolean)).size;
}

/**
 * O'quv faoliyati orqali tasdiqlanadigan maksimal daraja (CAR 02, UAT 12).
 * Chegaradan yuqori daraja rad etiladi.
 */
export function checkActivityCap(level, activity) {
  if (!isNum(level) || level < 1 || level > (activity.scaleMax || 5)) return { ok: false, reason: `Daraja 1–${activity.scaleMax || 5} oralig‘ida bo‘lishi kerak` };
  if (level > activity.maxLevel) {
    return { ok: false, reason: `«${activity.name}» orqali ko‘pi bilan ${activity.maxLevel}-daraja tasdiqlanadi` };
  }
  return { ok: true };
}

/** Maqsad real ish dalilini talab qilsa, o'quv dalili talabni yopmaydi. */
export function evidenceSatisfies(requirement, record) {
  if (!record || !isNum(record.level)) return false;
  if (record.level < requirement.level) return false;
  if (requirement.context === 'work' && record.context !== 'work') return false;
  return true;
}

/** Hisobot ulushlari: maxraj nol bo'lsa null ("Ma'lumot yetarli emas"). */
export function safeRatio(num, den) {
  return den > 0 ? (100 * num) / den : null;
}
