// Shartlar katalogi va qaror holati. Model versiyasidagi parametrlar bilan boshqariladi:
// yangi chegara (masalan 90%) yoki yangi shart qo'shish uchun kod tahrirlanmaydi (MOD 01).
import { scaleMax, scaleLevels, observationMethods, profileConditions, methodLabel, compMethods } from './modelKit.js';
import { computeMatch, fmtPct, isNum } from './calc.js';

export const CONDITION_CATALOG = {
  all_numeric: { label: 'Barcha bandlar sonli baholangan', group: 'evidence', params: [] },
  observation_count: { label: 'Dars kuzatuvlari soni', group: 'evidence', params: ['min'] },
  min_methods: { label: 'Har kompetensiya bo‘yicha mustaqil usullar soni', group: 'evidence', params: ['min'] },
  required_method: { label: 'Majburiy usul bo‘yicha dalil', group: 'evidence', params: ['method'] },
  gates: { label: 'Majburiy talablar (gate)', group: 'eligibility', params: ['items'] },
  observation_avg: { label: 'Dars amaliyoti minimumi (kuzatuvlar o‘rtachasi)', group: 'competency', params: ['min'] },
  sequential: { label: 'Ketma-ket o‘tish', group: 'eligibility', params: [] },
  entry_levels: { label: 'Qaysi lavozim darajasidan o‘tish mumkin', group: 'eligibility', params: ['levels'] },
  min_level_all: { label: 'Har bir kompetensiya minimal darajada', group: 'competency', params: ['min'] },
  min_level_items: { label: 'Kritik kompetensiyalar minimumi', group: 'competency', params: ['items'] },
  max_gap: { label: 'Maksimal tafovut', group: 'competency', params: ['max'] },
  match_threshold: { label: 'Kompetensiya mosligi', group: 'competency', params: ['threshold'] },
  tenure_months: { label: 'Joriy darajada tajriba', group: 'performance', params: ['min'] },
  kpi_threshold: { label: 'KPI natijasi', group: 'performance', params: ['min'] },
  stretch_approved: { label: 'Stretch dalili tasdiqlangan', group: 'performance', params: [] },
  target_role: { label: 'Bo‘sh o‘rin (maqsadli lavozim)', group: 'role', params: [] },
};

export const STATUS = {
  incomplete: { label: 'Baholash tugallanmagan', tone: 'muted', next: 'Qolgan bandlarni baholang' },
  de: { label: 'DE — dalil yetarli emas', tone: 'warn', next: 'Qo‘shimcha dalil yig‘ing va qayta assessment sanasini belgilang' },
  not_ready: { label: 'Tayyor emas', tone: 'bad', next: 'Individual rivojlanish rejasi (IDP) tuzing' },
  not_yet: { label: 'Hozircha tayyor emas', tone: 'warn', next: 'Natija, tajriba yoki stretch dalilini to‘ldiring' },
  recommend_appoint: { label: 'Tayinlashga tavsiya', tone: 'good', next: 'Promotion paneliga kiriting', explain: 'Barcha talablar bajarilgan va mos bo‘sh o‘rin bor. Panel qaroridan va rasmiy buyruqdan keyin tayinlanadi.' },
  recommend_reserve: { label: 'Tayyor — rezervga tavsiya', tone: 'good', next: 'Kadrlar zaxirasiga kiritish uchun panelga kiriting', explain: 'Barcha talablar bajarilgan, lekin hozir bo‘sh o‘rin yo‘q. Xodim keyingi darajaga tayyor deb qayd etiladi va kadrlar zaxirasiga kiradi — o‘rin ochilganda qayta baholashsiz, panel qarori bilan tayinlanadi.' },
  conditional: { label: 'Rivojlanish sharti bilan', tone: 'warn', next: 'IDP bilan rivojlanish sharti va qayta baholash muddatini belgilang' },
  met: { label: 'Shartlar bajarilgan', tone: 'good', next: 'Natijani tasdiqlang va e’lon qiling' },
};

/** Model turiga qarab holat nomi (ustoz modelida "Shart bajarilmagan"). */
export function statusLabel(status, model) {
  const override = model?.statusLabels?.[status];
  return override || STATUS[status]?.label || status;
}

/** Uzun ro'yxatni qisqartiradi: 5 ta + «yana N ta». */
const short = (arr, n = 5) => (arr.length > n + 1 ? `${arr.slice(0, n).join('; ')} va yana ${arr.length - n} ta` : arr.join('; '));

const levelNo = (code) => Number(String(code || '').replace(/\D/g, '')) || 0;

function evalCondition(cond, ctx) {
  const { m, profileTo, context, model } = ctx;
  const p = cond.params || {};
  const base = { type: cond.type, group: CONDITION_CATALOG[cond.type]?.group || 'competency', label: cond.label || CONDITION_CATALOG[cond.type]?.label };
  const name = (code) => model.competencies?.find((c) => c.code === code)?.name || code;
  switch (cond.type) {
    case 'all_numeric': {
      const open = m.items.filter((i) => i.state === 'unrated' || i.state === 'de');
      return {
        ...base,
        passed: open.length === 0,
        detail: `${m.counts.scored}/${m.counts.total - m.counts.na} sonli baho`,
        reason: open.length ? short(open.map((i) => `${i.code}: ${i.state === 'de' ? 'DE' : 'baholanmagan'}`)) : null,
      };
    }
    case 'observation_count': {
      const n = context.observations ?? 0;
      return { ...base, passed: n >= p.min, detail: `${n}/${p.min} kuzatuv`, reason: n >= p.min ? null : `Kamida ${p.min} ta dars kuzatuvi kerak, mavjud: ${n}` };
    }
    case 'sequential': {
      const cur = levelNo(context.currentLevel);
      const tgt = levelNo(profileTo.code);
      const ok = tgt === cur + 1;
      return { ...base, passed: ok, detail: `${context.currentLevel || '—'} → ${profileTo.code}`, reason: ok ? null : `Joriy daraja ${context.currentLevel || 'yo‘q'}; o‘tish faqat bir pog‘ona yuqoriga` };
    }
    case 'entry_levels': {
      const list = p.levels || [];
      const ok = list.includes(context.currentLevel);
      return { ...base, label: `O‘tish mumkin bo‘lgan darajalar: ${list.join(', ')}`, passed: ok, detail: `Joriy daraja: ${context.currentLevel || '—'}`, reason: ok ? null : `${context.currentLevel || 'Joriy daraja'} dan ${profileTo.code} ga o‘tib bo‘lmaydi (mumkin: ${list.join(', ')})` };
    }
    case 'min_level_all': {
      const bad = m.items.filter((i) => i.state === 'scored' && i.score < p.min);
      return { ...base, label: `${base.label}: kamida ${p.min}`, passed: bad.length === 0, reason: bad.length ? bad.map((i) => `${i.code} ${name(i.code)}: ${i.score} < ${p.min}`).join('; ') : null };
    }
    case 'min_level_items': {
      const bad = Object.entries(p.items || {}).filter(([code, min]) => {
        const v = ctx.scores[code];
        return isNum(v) && v < min;
      });
      return {
        ...base,
        detail: Object.entries(p.items || {}).map(([c, v]) => `${c} ≥ ${v}`).join(', '),
        passed: bad.length === 0,
        reason: bad.length ? bad.map(([c, min]) => `${c} ${name(c)}: ${ctx.scores[c]} < ${min}`).join('; ') : null,
      };
    }
    case 'max_gap': {
      const bad = m.items.filter((i) => i.state === 'scored' && i.gap > p.max);
      return { ...base, label: `${base.label}: ko‘pi bilan ${p.max}`, passed: bad.length === 0, reason: bad.length ? bad.map((i) => `${i.code} ${name(i.code)}: tafovut ${i.gap} > ${p.max}`).join('; ') : null };
    }
    case 'match_threshold': {
      if (m.match === null) return { ...base, label: `${base.label} ≥ ${p.threshold}%`, passed: null, detail: 'Foiz barcha bandlar sonli baholangach chiqadi', reason: null };
      const ok = m.match >= p.threshold;
      const conditional = !ok && isNum(p.conditionalFrom) && m.match >= p.conditionalFrom;
      const band = isNum(p.conditionalFrom) ? ` (${p.conditionalFrom}–<${p.threshold}% — rivojlanish sharti bilan)` : '';
      return { ...base, label: `${base.label} ≥ ${p.threshold}%${band}`, passed: ok, conditional, detail: `${m.creditedSum} ÷ ${m.targetSum} = ${fmtPct(m.match)}`, reason: ok ? null : conditional ? `${fmtPct(m.match)}: ${p.conditionalFrom}–<${p.threshold}% oralig‘i — rivojlanish sharti bilan` : `${fmtPct(m.match)} < ${p.threshold}%` };
    }
    case 'tenure_months': {
      const n = context.tenureMonths;
      const ok = isNum(n) && n >= p.min;
      return { ...base, label: `${base.label}: kamida ${p.min} oy`, passed: ok, detail: isNum(n) ? `${n} oy` : 'ma’lumot yo‘q', reason: ok ? null : `Joriy darajada ${isNum(n) ? n : 0} oy < ${p.min} oy` };
    }
    case 'kpi_threshold': {
      const k = context.kpi || {};
      if (k.type === 'rampup') {
        const ok = !!k.passed;
        return { ...base, label: `Yangi filial ramp-up KPI ≥ ${p.min}%`, passed: ok, detail: isNum(k.value) ? fmtPct(k.value) : '—', reason: ok ? null : (k.reasons || ['Ramp-up KPI sharti bajarilmagan']).join('; ') };
      }
      const ok = isNum(k.value) && k.value >= p.min;
      return { ...base, label: `${p.period || 'Oxirgi 10 oy'} KPI ≥ ${p.min}%`, passed: ok, detail: isNum(k.value) ? fmtPct(k.value) : 'ma’lumot yo‘q', reason: ok ? null : `KPI ${isNum(k.value) ? fmtPct(k.value) : 'yo‘q'} < ${p.min}%` };
    }
    case 'stretch_approved': {
      const ok = context.stretch === 'approved';
      const st = { approved: 'tasdiqlangan', submitted: 'tekshiruvda', returned: 'qaytarilgan', assigned: 'bajarilmoqda' }[context.stretch] || 'biriktirilmagan';
      return { ...base, passed: ok, detail: st, reason: ok ? null : `Stretch dalili ${st}` };
    }
    case 'target_role': {
      const r = context.targetRole;
      if (!r) return { ...base, passed: null, detail: model.roleHint || 'Hozir bo‘sh o‘rin yo‘q. Shartlar bajarilsa xodim «tayyor» deb topiladi va kadrlar zaxirasiga kiradi; o‘rin ochilganda tayinlanadi.', reason: null, roleExists: false };
      const ok = r.profileCode ? r.profileCode === profileTo.code : levelNo(r.rScope) === levelNo(profileTo.code);
      return { ...base, passed: ok, roleExists: true, detail: r.rScope ? `${r.name} · ${r.rScope}` : r.name, reason: ok ? null : `Rol ko‘lami ${r.rScope} maqsadli ${profileTo.code} ga mos emas — lavozim darajasi qayta ko‘riladi` };
    }
    case 'min_methods': {
      const ev = context.evidenceMethods;
      if (!ev) return { ...base, label: `${base.label}: kamida ${p.min}`, passed: null, detail: 'Dalillar ma’lumoti yo‘q', reason: null };
      const bad = m.items.filter((i) => i.state === 'scored' && (ev[i.code]?.length || 0) < p.min);
      return { ...base, label: `${base.label}: kamida ${p.min}`, passed: bad.length === 0, detail: `${m.items.filter((i) => i.state === 'scored').length - bad.length}/${m.items.filter((i) => i.state === 'scored').length} kompetensiya`, reason: bad.length ? short(bad.map((i) => `${i.code}: ${ev[i.code]?.length || 0} usul`)) : null };
    }
    case 'required_method': {
      const ev = context.evidenceMethods;
      const label = `${methodLabel(model, p.method)} dalili majburiy`;
      if (!ev) return { ...base, label, passed: null, detail: 'Dalillar ma’lumoti yo‘q', reason: null };
      const need = m.items.filter((i) => i.state === 'scored' && compMethods(model, model.competencies.find((c) => c.code === i.code)).includes(p.method));
      const bad = need.filter((i) => !(ev[i.code] || []).includes(p.method));
      return { ...base, label, passed: bad.length === 0, detail: `${need.length - bad.length}/${need.length} kompetensiya`, reason: bad.length ? `${methodLabel(model, p.method)} dalili yo‘q: ${short(bad.map((i) => i.code), 8)}` : null };
    }
    case 'observation_avg': {
      const v = context.observationAvg;
      const ok = isNum(v) && v >= p.min;
      return { ...base, label: `${base.label} ≥ ${String(p.min).replace('.', ',')}`, passed: isNum(v) ? ok : false, detail: isNum(v) ? `o‘rtacha ${v.toFixed(2).replace('.', ',')}` : 'kuzatuv yo‘q', reason: ok ? null : isNum(v) ? `Kuzatuvlar o‘rtachasi ${v.toFixed(2).replace('.', ',')} < ${String(p.min).replace('.', ',')}` : 'Dars kuzatuvi o‘tkazilmagan' };
    }
    case 'gates': {
      const items = p.items || [];
      const g = context.gates || {};
      const bad = items.filter((it) => !g[it.code]?.met);
      return { ...base, passed: bad.length === 0, detail: `${items.length - bad.length}/${items.length} bajarilgan`, reason: bad.length ? `Bajarilmagan: ${bad.map((it) => it.label).join('; ')}` : null, gateItems: items.map((it) => ({ ...it, met: !!g[it.code]?.met, evidence: g[it.code]?.evidence })) };
    }
    default:
      return { ...base, passed: null, reason: `Noma’lum shart turi: ${cond.type}` };
  }
}

/**
 * Hisoblangan tavsiya. Tavsiya ≠ vakolatli qaror ≠ tayinlash (Ishlab chiqish vazifasi).
 * @param model     model versiyasi (rules.conditions, transition)
 * @param profileTo maqsadli profil {code, targets}
 * @param scores    yakuniy ballar (resolveScores natijasi)
 * @param context   {currentLevel, tenureMonths, kpi, stretch, targetRole, observations}
 */
export function evaluateDecision(model, profileTo, scores, context = {}) {
  const m = computeMatch(profileTo.targets, scores);
  const conditions = profileConditions(model, profileTo).map((c) => evalCondition(c, { m, profileTo, context, model, scores }));
  const failed = (g) => conditions.filter((c) => c.group === g && c.passed === false);

  let status;
  if (m.counts.unrated > 0) status = 'incomplete';
  else if (m.counts.de > 0 || failed('evidence').length) status = 'de';
  else if (failed('eligibility').length || failed('competency').some((c) => !c.conditional)) status = 'not_ready';
  else if (failed('performance').length) status = 'not_yet';
  else if (failed('competency').length) status = 'conditional';
  else if (!model.transition) status = 'met';
  else {
    const role = conditions.find((c) => c.type === 'target_role');
    status = role?.roleExists && role.passed ? 'recommend_appoint' : 'recommend_reserve';
  }

  const blocking = conditions.filter((c) => c.passed === false);
  return {
    match: m,
    conditions,
    status,
    label: statusLabel(status, model),
    tone: STATUS[status]?.tone,
    next: model.statusNext?.[status] || STATUS[status]?.next,
    explain: STATUS[status]?.explain || null,
    reasons: blocking.map((c) => `${c.label}: ${c.reason}`),
    ready: ['recommend_appoint', 'recommend_reserve', 'met'].includes(status),
  };
}

/** Model e'lon qilinishidan oldingi tekshiruv (MOD 02). Shkala, usullar va kompetensiyalar modeldan o'qiladi. */
export function validateModel(model) {
  const errors = [];
  const max = scaleMax(model);
  const levels = scaleLevels(model);
  const codes = new Set();
  if (!String(model.name || '').trim()) errors.push('Lavozim nomi kiritilmagan');
  if (!model.competencies?.length) errors.push('Kamida bitta kompetensiya kerak');
  for (const c of model.competencies || []) {
    if (codes.has(c.code)) errors.push(`${c.code}: kod takrorlangan`);
    codes.add(c.code);
    if (!String(c.name || '').trim()) errors.push(`${c.code}: nomi yo‘q`);
    if (c.composite) {
      if (!model.composites?.[c.code]?.parts?.length) errors.push(`${c.code}: tarkibli kompetensiya qismlari belgilanmagan`);
    } else if (levels.some((l) => !String(c.levels?.[l] || '').trim())) errors.push(`${c.code}: 1–${max} indikatorlar to‘liq emas`);
    for (const m of c.methods || []) if (!(model.methods || []).includes(m)) errors.push(`${c.code}: «${m}» usuli modelda yoqilmagan`);
  }
  if (!model.methods?.length) errors.push('Kamida bitta baholash usuli kerak');
  if (model.scoring?.mode === 'weighted') {
    const w = model.scoring.weights || {};
    const sum = (model.methods || []).reduce((a, m) => a + (Number(w[m]) || 0), 0);
    if (Math.round(sum) !== 100) errors.push(`Usul vaznlari yig‘indisi 100% bo‘lishi kerak (hozir ${sum}%)`);
  }
  if (!model.profiles?.length) errors.push('Kamida bitta profil kerak');
  const pcodes = new Set();
  for (const p of model.profiles || []) {
    if (pcodes.has(p.code)) errors.push(`${p.code}: profil kodi takrorlangan`);
    pcodes.add(p.code);
    if (!Object.keys(p.targets || {}).length) errors.push(`${p.code}: maqsadli darajalar belgilanmagan`);
    for (const [code, t] of Object.entries(p.targets || {})) {
      if (!codes.has(code)) errors.push(`${p.code}: ${code} katalogda yo‘q`);
      if (!isNum(t) || t < 1 || t > max) errors.push(`${p.code}: ${code} maqsadi 1–${max} bo‘lishi kerak`);
    }
  }
  const allConds = [...(model.rules?.conditions || []), ...(model.profiles || []).flatMap((p) => p.conditions || [])];
  for (const cond of allConds) {
    if (!CONDITION_CATALOG[cond.type]) errors.push(`Noma’lum shart: ${cond.type}`);
    const p = cond.params || {};
    if (cond.type === 'match_threshold' && !(isNum(p.threshold) && p.threshold > 0 && p.threshold <= 100)) errors.push('Moslik chegarasi 1–100 oralig‘ida bo‘lishi kerak');
    if (cond.type === 'min_level_all' && !(isNum(p.min) && p.min >= 1 && p.min <= max)) errors.push(`Minimal daraja 1–${max} oralig‘ida bo‘lishi kerak`);
    if (cond.type === 'min_level_items') for (const [c, v] of Object.entries(p.items || {})) {
      if (!codes.has(c)) errors.push(`Kritik shart: ${c} katalogda yo‘q`);
      if (!(isNum(v) && v >= 1 && v <= max)) errors.push(`Kritik shart: ${c} darajasi 1–${max} bo‘lishi kerak`);
    }
    if ((cond.type === 'observation_count' || cond.type === 'observation_avg') && !observationMethods(model).length) errors.push('Kuzatuv sharti bor, lekin modelda kuzatuv usuli yoqilmagan');
    if (cond.type === 'required_method' && !(model.methods || []).includes(p.method)) errors.push(`Majburiy usul «${p.method}» modelda yoqilmagan`);
    if (cond.type === 'gates' && (p.items || []).some((it) => !String(it.label || '').trim())) errors.push('Gate nomi bo‘sh');
    if (cond.type === 'entry_levels' && !(p.levels || []).length) errors.push('O‘tish mumkin bo‘lgan darajalar ko‘rsatilmagan');
    if (cond.type === 'min_methods') for (const c of model.competencies || []) if (!c.composite && compMethods(model, c).length < p.min) errors.push(`${c.code}: kamida ${p.min} usul kerak, belgilangan ${compMethods(model, c).length}`);
  }
  return [...new Set(errors)];
}
