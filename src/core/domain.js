// Domen amallari: har bir amal holatning nusxasini o'zgartirib qaytaradi va auditga yozadi.
// Prototipda server o'rnida ishlaydi; ishchi tizimda shu qoidalar server tomonida bajariladi.
import { computeNewBranchKpi, computeRScope, resolveScores, isNum, DE, NA, checkActivityCap, computeMatch } from './calc.js';
import { evaluateDecision, validateModel } from './rules.js';
import { scaleMax, isLevel, methodKind, compMethods, profileConditions } from './modelKit.js';

export class DomainError extends Error {}
const fail = (msg) => {
  throw new DomainError(msg);
};

// ---------- Selektorlar ----------
export const getModel = (s, id) => s.models.find((m) => m.id === id);
export const activeModel = (s, modelId) => s.models.find((m) => m.modelId === modelId && m.status === 'active');
export const getEmployee = (s, id) => s.employees.find((e) => e.id === id);
export const getCard = (s, id) => s.cards.find((c) => c.id === id);
export const getBranch = (s, id) => s.branches.find((b) => b.id === id);
export const getStretch = (s, id) => s.stretches.find((x) => x.id === id);

export function monthsBetween(from, to) {
  if (!from || !to) return null;
  const a = new Date(from);
  const b = new Date(to);
  let m = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (b.getDate() < a.getDate()) m -= 1;
  return Math.max(0, m);
}

export function roleInfo(s, roleId) {
  const r = s.roles.find((x) => x.id === roleId);
  if (!r) return null;
  const staff = r.branchIds.reduce((a, id) => a + (getBranch(s, id)?.activeEmployees || 0), 0);
  return { ...r, activeEmployees: staff, branchCount: r.branchIds.length, rScope: computeRScope(r.branchIds.length, staff) };
}

export function cardScores(s, card) {
  const model = getModel(s, card.modelVersionId);
  const raw = Object.fromEntries(Object.entries(card.scores || {}).map(([c, v]) => [c, v.final]));
  return resolveScores(model, raw, card.hrScores || {});
}

export function cardContext(s, card) {
  const model = getModel(s, card.modelVersionId);
  const emp = getEmployee(s, card.employeeId);
  const profileTo = model.profiles.find((p) => p.code === card.profileTo);
  let kpi = null;
  if (emp.rampUp) {
    const k = computeNewBranchKpi(s.kpiNewBranch.items, s.kpiNewBranch);
    kpi = { type: 'rampup', value: k.result, passed: k.passed, reasons: k.reasons };
  } else if (card.kpi) kpi = { type: 'regular', value: card.kpi.value };
  const role = card.targetRoleId ? roleInfo(s, card.targetRoleId) : null;
  return {
    model,
    emp,
    profileTo,
    scores: cardScores(s, card),
    // E'lon qilingan natija o'sha paytdagi kontekst bilan muzlatiladi (keyingi tayinlash yoki KPI o'zgarishi uni o'zgartirmaydi).
    context: card.published?.context || {
      currentLevel: emp.currentLevel,
      tenureMonths: monthsBetween(emp.levelSince, s.today),
      kpi,
      stretch: card.stretchId ? getStretch(s, card.stretchId)?.status : null,
      targetRole: role && role.vacant ? role : null,
      observations: (card.observations || []).length,
      observationAvg: observationAverage(card.observations || []),
      evidenceMethods: evidenceMethods(model, card),
      gates: card.gates || {},
    },
  };
}

/** Kuzatuvlar o'rtachasi: har kuzatuvning baholangan kompetensiyalari o'rtachasi, so'ng kuzatuvlar o'rtachasi. */
export function observationAverage(observations) {
  const per = observations.map((o) => {
    const vals = Object.values(o.ratings || (o.indicator ? { [o.indicator]: o.level } : {})).filter(isNum);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  }).filter(isNum);
  return per.length ? per.reduce((a, b) => a + b, 0) / per.length : null;
}

/** Kompetensiya bo'yicha dalil usullari (takrorsiz): {code: [method, ...]}; tarkibli kompetensiya qismlari bitta usul sifatida. */
export function evidenceMethods(model, card) {
  const out = {};
  for (const [code, v] of Object.entries(card.scores || {})) out[code] = [...new Set((v.evidences || []).map((e) => e.method))];
  for (const code of Object.keys(model.composites || {})) if (Object.keys(card.hrScores || {}).length) out[code] = [...new Set([...(out[code] || []), ...compMethods(model, model.competencies.find((c) => c.code === code))])];
  return out;
}

export function cardDecision(s, card) {
  const { model, profileTo, scores, context } = cardContext(s, card);
  return evaluateDecision(model, profileTo, scores, context);
}

// ---------- Ichki yordamchilar ----------
function nextId(s, prefix) {
  s.seq += 1;
  return `${prefix}-${s.seq}`;
}
function log(s, actor, action, object, extra = {}) {
  s.audit.unshift({ id: nextId(s, 'a'), at: nowStamp(s), actor, action, object, ...extra });
}
function nowStamp(s) {
  const t = new Date();
  return `${s.today}T${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
}
/** Idempotent bildirishnoma: bir xil kalit ikkinchi marta yaratilmaydi (NFR 01, UAT 15). */
function notify(s, key, to, text) {
  if (s.notifications.some((n) => n.key === key)) return false;
  s.notifications.unshift({ id: nextId(s, 'n'), key, to, text, at: nowStamp(s), read: false });
  return true;
}
function mutate(state, fn) {
  const s = structuredClone(state);
  fn(s);
  return s;
}
function editableCard(s, cardId, expectedRevision) {
  const card = getCard(s, cardId);
  if (!card) fail('Karta topilmadi');
  if (card.stage === 'published') fail('E’lon qilingan karta tahrirlanmaydi. Tuzatish uchun kartani qayta oching (yangi reviziya).');
  if (card.stage === 'closed') fail('Karta yopilgan');
  if (expectedRevision !== undefined && expectedRevision !== card.revision) {
    fail(`Eskirgan reviziya: siz r${expectedRevision} ni tahrirlayapsiz, joriy r${card.revision}. Sahifani yangilang.`);
  }
  return card;
}

// ---------- Baholash kartasi ----------
export function openCard(state, { cycleId, employeeId, modelId, profileTo, branchId, targetRoleId = null, actor = 'HR/L&D' }) {
  return mutate(state, (s) => {
    const model = activeModel(s, modelId);
    if (!model) fail('Faol model versiyasi yo‘q');
    const dup = s.cards.find(
      (c) => c.cycleId === cycleId && c.employeeId === employeeId && c.profileTo === profileTo && c.branchId === branchId && c.stage !== 'closed',
    );
    if (dup) fail(`Faol karta dublikati: ${dup.id} (sikl, xodim, profil va filial bir xil)`);
    const emp = getEmployee(s, employeeId);
    const id = nextId(s, 'c');
    s.cards.unshift({
      id, cycleId, employeeId, modelVersionId: model.id, profileFrom: model.transition ? emp.currentLevel : null, profileTo, branchId,
      stage: 'draft', revision: 1, deadline: null, targetRoleId, stretchId: null,
      assessors: { evaluator: model.evaluatorRole || 'Assessor', calibrator: 'L&D' },
      scores: {}, hrScores: {}, observations: [], gates: {}, kpi: emp.kpi10m ? { type: 'regular', value: emp.kpi10m } : null,
      panel: null, appointment: null, published: null, createdAt: s.today,
    });
    notify(s, `assign:${id}`, emp.name, `Sizga ${model.name} bo‘yicha baholash kartasi ochildi (${model.id}).`);
    log(s, actor, 'Karta ochildi', id, { after: `${model.id} · ${profileTo}` });
  });
}

export function setScore(state, { cardId, code, final, basis, expectedRevision, actor = 'Baholovchi' }) {
  return mutate(state, (s) => {
    const card = editableCard(s, cardId, expectedRevision);
    const model = getModel(s, card.modelVersionId);
    const comp = model.competencies.find((c) => c.code === code);
    if (!comp) fail(`${code} modelda yo‘q`);
    if (comp.composite) fail(`${code} tarkibli kompetensiya — ${model.composites[code].label}`);
    if (!isLevel(model, final) && final !== DE && final !== NA) fail(`Yakuniy daraja 1–${scaleMax(model)} butun son, DE yoki «Qo‘llanmaydi»`);
    if (!String(basis || '').trim()) fail('Asos (rubrika bo‘yicha izoh) majburiy');
    const before = card.scores[code]?.final ?? '—';
    card.scores[code] = { ...(card.scores[code] || { evidences: [] }), final, basis, by: actor, at: s.today };
    card.revision += 1;
    log(s, actor, 'Yakuniy daraja kiritildi', `${cardId} · ${code}`, { before: String(before), after: String(final), reason: basis });
  });
}

export function addEvidence(state, { cardId, code, method, value, note, sourceId, actor = 'Baholovchi' }) {
  return mutate(state, (s) => {
    const card = editableCard(s, cardId);
    if (!method) fail('Dalil usuli tanlanmagan');
    const model = getModel(s, card.modelVersionId);
    const comp = model.competencies.find((c) => c.code === code);
    if (comp && !compMethods(model, comp).includes(method)) fail(`«${method}» usuli ${code} uchun belgilanmagan`);
    if (value !== null && value !== undefined && !(isNum(value) && value >= 1 && value <= scaleMax(model))) fail(`Dalil bali 1–${scaleMax(model)} oralig‘ida bo‘lishi kerak`);
    const entry = card.scores[code] || { final: null, basis: '', evidences: [] };
    entry.evidences = [...(entry.evidences || []), { method, value, note, sourceId: sourceId || nextId(s, 'SRC') }];
    card.scores[code] = entry;
    card.revision += 1;
    log(s, actor, 'Dalil qo‘shildi', `${cardId} · ${code}`, { after: `${method}: ${value ?? '—'}` });
  });
}

export function setHrScore(state, { cardId, hrCode, value, actor = 'Baholovchi' }) {
  return mutate(state, (s) => {
    const card = editableCard(s, cardId);
    const model = getModel(s, card.modelVersionId);
    if (value !== null && value !== DE && !isLevel(model, value)) fail(`Qism bahosi 1–${scaleMax(model)} yoki DE`);
    const before = card.hrScores[hrCode] ?? '—';
    if (value === null) delete card.hrScores[hrCode];
    else card.hrScores[hrCode] = value;
    card.revision += 1;
    log(s, actor, 'HR yo‘nalishi bahosi', `${cardId} · ${hrCode}`, { before: String(before), after: String(value ?? '—') });
  });
}

export function addObservation(state, { cardId, obs, actor = 'Metodist' }) {
  return mutate(state, (s) => {
    const card = editableCard(s, cardId);
    for (const f of ['methodist', 'date', 'lesson', 'group', 'behavior']) if (!String(obs[f] || '').trim()) fail(`Kuzatuv maydoni to‘ldirilmagan: ${f}`);
    const model = getModel(s, card.modelVersionId);
    // Bitta dars kuzatuvida bir nechta kompetensiya baholanadi (ratings); eski format: indicator + level.
    const ratings = obs.ratings ? Object.fromEntries(Object.entries(obs.ratings).filter(([, v]) => v !== '' && v !== null && v !== undefined).map(([k, v]) => [k, Number(v)])) : { [obs.indicator]: obs.level };
    if (!Object.keys(ratings).length) fail('Kamida bitta kompetensiya bo‘yicha kuzatilgan darajani belgilang');
    for (const [code, v] of Object.entries(ratings)) {
      if (!model.competencies.some((c) => c.code === code)) fail(`${code} modelda yo‘q`);
      if (!isLevel(model, v)) fail(`${code}: kuzatilgan daraja 1–${scaleMax(model)}`);
    }
    const method = obs.method || model.methods.find((m) => methodKind(model, m) === 'observation') || 'observation';
    const id = nextId(s, 'OBS');
    card.observations.push({ ...obs, ratings, id, indicator: Object.keys(ratings)[0], level: Object.values(ratings)[0] });
    for (const [code, v] of Object.entries(ratings)) {
      const entry = card.scores[code] || { final: null, basis: '', evidences: [] };
      entry.evidences = [...(entry.evidences || []), { method, value: v, note: `${obs.lesson}: ${obs.behavior}`, sourceId: id }];
      card.scores[code] = entry;
    }
    card.revision += 1;
    log(s, actor, 'Dars kuzatuvi qayd etildi', `${cardId} · ${Object.keys(ratings).join(', ')}`, { after: `${obs.date}, ${obs.lesson}` });
  });
}

export function setGate(state, { cardId, code, met, evidence, actor = 'HR/L&D' }) {
  return mutate(state, (s) => {
    const card = editableCard(s, cardId);
    if (met && !String(evidence || '').trim()) fail('Gate bajarilganini tasdiqlovchi dalil (hujjat, sertifikat) majburiy');
    card.gates = { ...(card.gates || {}), [code]: { met: !!met, evidence: evidence || '', by: actor, at: s.today } };
    card.revision += 1;
    log(s, actor, met ? 'Majburiy talab bajarildi' : 'Majburiy talab bekor qilindi', `${cardId} · ${code}`, { after: evidence || '—' });
  });
}

const NEXT_STAGE = (model, stage) => {
  const i = model.stages.indexOf(stage);
  return model.stages[i + 1];
};

export function advanceStage(state, { cardId, actor = 'HR/L&D', requestKey }) {
  return mutate(state, (s) => {
    const card = getCard(s, cardId);
    if (!card) fail('Karta topilmadi');
    const model = getModel(s, card.modelVersionId);
    if (card.stage === 'published') {
      // Takroriy e'lon so'rovi yangi qaror yoki bildirishnoma yaratmaydi.
      log(s, actor, 'Takroriy e’lon so‘rovi e’tiborsiz qoldirildi', cardId, { reason: requestKey || 'idempotent' });
      return;
    }
    const to = NEXT_STAGE(model, card.stage);
    const d = cardDecision(s, card);
    if (to === 'panel' || to === 'approval') {
      if (d.status === 'incomplete') fail(`Baholash tugallanmagan: ${d.match.counts.unrated} ta band baholanmagan`);
    }
    if (to === 'approval' && model.panelRequired && !card.panel) fail('Panel protokoli kiritilmagan — panel bosqichi majburiy');
    if (to === 'published') {
      card.published = { at: s.today, by: actor, revision: card.revision, context: cardContext(s, card).context };
      publishEffects(s, card, model, d);
    }
    const from = card.stage;
    card.stage = to;
    card.revision += 1;
    log(s, actor, 'Bosqich o‘zgardi', cardId, { before: from, after: to });
  });
}

const addDays = (iso, n) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
/** Maqsadli daraja indikatorining birinchi qatori — xodimga «nimaga erishish kerak»ni aniq aytadi. */
export function levelHeadline(model, code, level) {
  const txt = model.competencies.find((c) => c.code === code)?.levels?.[level] || '';
  return txt.split('\n').map((x) => x.replace(/^[-•\s]*(\d+[.)]\s*)?/, '').trim()).find(Boolean) || '';
}
export function idpProposal(s, model, code, target, de) {
  const comp = model.competencies.find((c) => c.code === code);
  const goal = levelHeadline(model, code, target);
  const methods = compMethods(model, comp).map((m) => model.methodDefs?.[m]?.name || m).slice(0, 2).join(' va ');
  return {
    goal,
    task: de
      ? `Daraja aniqlanmadi — qo‘shimcha dalil kerak: ${methods}.`
      : `${target}-darajaga yetish uchun mentor bilan amaliy vazifa: ${goal ? goal.charAt(0).toLowerCase() + goal.slice(1) : comp?.name}.`,
    owner: de ? (model.evaluatorRole || 'Baholovchi') : 'Bevosita rahbar (mentor)',
    courseId: null, evidence: '', due: addDays(s.today, 90), reassessAt: addDays(s.today, 105),
  };
}

function publishEffects(s, card, model, d) {
  const emp = getEmployee(s, card.employeeId);
  notify(s, `publish:${card.id}:${card.published.revision}`, emp.name, `${model.name}: natija e’lon qilindi — ${d.label}.`);
  // Tasdiqlangan natija xodim profiliga (ish dalili sifatida)
  const scores = cardScores(s, card);
  for (const [code, v] of Object.entries(scores)) {
    if (!isNum(v)) continue;
    emp.records[code] = [...(emp.records[code] || []), { level: v, context: 'work', source: `Baholash kartasi ${card.id} (${model.id})`, date: s.today }];
  }
  // IDP takliflari: ijobiy tafovut va DE (DEV 02)
  const profile = model.profiles.find((p) => p.code === card.profileTo);
  const m = computeMatch(profile.targets, scores);
  for (const it of m.items) {
    const exists = s.idp.some((x) => x.cardId === card.id && x.competency === it.code);
    if (exists) continue;
    if (it.state === 'scored' && it.gap > 0) {
      s.idp.push({ id: nextId(s, 'idp'), employeeId: emp.id, cardId: card.id, competency: it.code, fromLevel: it.score, targetLevel: it.target, ...idpProposal(s, model, it.code, it.target, false), status: 'proposed', source: 'auto', priority: it.score < 3 });
    } else if (it.state === 'de') {
      s.idp.push({ id: nextId(s, 'idp'), employeeId: emp.id, cardId: card.id, competency: it.code, fromLevel: null, targetLevel: it.target, ...idpProposal(s, model, it.code, it.target, true), status: 'proposed', source: 'auto', priority: true });
    }
  }
  // Vorislik: panel rezerv qarori + e'lon qilingan tayyorlik xulosasi
  if (card.panel?.decision === 'reserve' && d.ready) {
    upsertSuccession(s, emp.id, card.profileTo, { status: 'reserve', decision: { by: card.panel.by, at: card.panel.date, reason: card.panel.protocol }, next: 'Kadrlar zaxirasida; vakant rol paydo bo‘lsa tayinlash paneli' }, 'assessment');
  } else if (d.ready) {
    upsertSuccession(s, emp.id, card.profileTo, { status: 'assessed', next: d.next }, 'assessment');
  }
}

/** Vorislik yozuvi; via — xodim ro'yxatga qanday kirgani (birinchi marta): interest | plan | assessment | hr. */
function upsertSuccession(s, employeeId, target, patch, via = 'hr') {
  let row = s.succession.find((x) => x.employeeId === employeeId && x.target === target);
  if (!row) {
    row = { id: nextId(s, 'suc'), employeeId, target, status: 'interested', owner: 'HR/L&D', next: '', decision: null, via, addedAt: s.today };
    s.succession.push(row);
  }
  Object.assign(row, patch);
}

export function returnStage(state, { cardId, toStage, reason, actor = 'Kalibratsiya mas’uli' }) {
  return mutate(state, (s) => {
    const card = editableCard(s, cardId);
    if (!String(reason || '').trim()) fail('Qaytarish sababi majburiy');
    const from = card.stage;
    card.stage = toStage;
    card.revision += 1;
    const emp = getEmployee(s, card.employeeId);
    notify(s, `return:${card.id}:${card.revision}`, emp.name, `Karta ${card.id} «${toStage}» bosqichiga qaytarildi: ${reason}`);
    log(s, actor, 'Karta qaytarildi', cardId, { before: from, after: toStage, reason });
  });
}

export function recordPanel(state, { cardId, decision, protocol, members, date, actor = 'HRD va qaror paneli' }) {
  return mutate(state, (s) => {
    const card = editableCard(s, cardId);
    const model = getModel(s, card.modelVersionId);
    if (!model.panelRequired) fail('Bu model uchun panel bosqichi yo‘q');
    if (card.stage !== 'panel') fail('Panel protokoli faqat «Kalibratsiya / panel» bosqichida kiritiladi');
    if (!String(protocol || '').trim()) fail('Panel xulosasi va asosi majburiy');
    const d = cardDecision(s, card);
    if ((decision === 'appoint' || decision === 'reserve') && !d.ready) fail(`Hisoblangan tavsiya «${d.label}»: ${d.reasons.join('; ') || 'shartlar bajarilmagan'}`);
    if (decision === 'appoint' && d.status !== 'recommend_appoint') fail('Mos vakant rol yo‘q — faqat rezerv qarori mumkin');
    card.panel = { decision, protocol, members, date: date || s.today, by: actor };
    card.revision += 1;
    log(s, actor, 'Panel protokoli', cardId, { after: decision, reason: protocol });
  });
}

/** Rasmiy tayinlash: joriy FR faqat shu yozuvdan keyin yangilanadi (UAT 09). */
export function recordAppointment(state, { cardId, docNo, effectiveDate, actor = 'Tayinlash vakolati (CEO/HRD)' }) {
  return mutate(state, (s) => {
    const card = getCard(s, cardId);
    if (card.stage !== 'published') fail('Avval natija e’lon qilinishi kerak');
    if (card.panel?.decision !== 'appoint') fail('Panel tayinlash qarorini bermagan');
    if (card.appointment) fail('Tayinlash allaqachon qayd etilgan');
    if (!String(docNo || '').trim() || !effectiveDate) fail('Tayinlash hujjati raqami va kuchga kirish sanasi majburiy');
    const emp = getEmployee(s, card.employeeId);
    const before = emp.currentLevel;
    card.appointment = { docNo, effectiveDate, by: actor, at: s.today };
    emp.currentLevel = card.profileTo;
    emp.position = getModel(s, card.modelVersionId).modelId; // rotatsiyada lavozim modeli ham almashadi
    emp.levelSince = effectiveDate;
    emp.history.push({ level: card.profileTo, from: effectiveDate, doc: docNo });
    const role = s.roles.find((r) => r.id === card.targetRoleId);
    if (role) {
      role.vacant = false;
      role.holder = emp.id;
    }
    upsertSuccession(s, emp.id, card.profileTo, { status: 'appointed', next: `Tayinlangan: ${docNo}, ${effectiveDate}` }, 'assessment');
    notify(s, `appoint:${card.id}`, emp.name, `Tabriklaymiz! ${card.profileTo} darajasiga tayinlandingiz (${docNo}).`);
    log(s, actor, 'Rasmiy tayinlash', emp.id, { before, after: card.profileTo, reason: docNo });
  });
}

/** Qayta baholash: avvalgi kartaga bog'langan, faqat tanlangan bandlar qayta ochiladi (DEV 02, UAT 14). */
export function openReassessment(state, { cardId, codes, actor = 'HR/L&D' }) {
  return mutate(state, (s) => {
    const prev = getCard(s, cardId);
    if (prev.stage !== 'published') fail('Qayta baholash faqat e’lon qilingan karta bo‘yicha');
    if (!codes?.length) fail('Qayta ochiladigan bandlarni tanlang');
    const id = nextId(s, 'c');
    const scores = structuredClone(prev.scores);
    const hrScores = structuredClone(prev.hrScores);
    for (const c of codes) {
      if (c === 'FUN-05') for (const k of Object.keys(hrScores)) delete hrScores[k];
      delete scores[c];
    }
    s.cards.unshift({
      ...structuredClone(prev), id, prevCardId: prev.id, reopened: codes, scores, hrScores, stage: 'assessment', revision: 1,
      panel: null, appointment: null, published: null, createdAt: s.today,
    });
    log(s, actor, 'Qayta baholash ochildi', id, { before: prev.id, after: codes.join(', ') });
  });
}

// ---------- IDP ----------
/**
 * Qo'lda vazifa qo'shish. by: 'employee' — xodimning o'z taklifi (mentor tasdiqlaguncha «taklif»);
 * 'mentor' yoki 'hr' — darhol faol. Tizim takliflari e'londa avtomatik yaratiladi (source: 'auto').
 */
export function addIdpItem(state, { employeeId, competency, targetLevel, task, owner, due, by = 'mentor', actor }) {
  return mutate(state, (s) => {
    const emp = getEmployee(s, employeeId);
    if (!emp) fail('Xodim topilmadi');
    if (!competency) fail('Kompetensiya tanlanmagan');
    if (!String(task || '').trim()) fail('Vazifani yozing: nima qilinadi va qanday natija kutiladi');
    if (!due) fail('Muddat majburiy');
    if (by !== 'employee' && !String(owner || '').trim()) fail('Mentor / mas’ul majburiy');
    const model = s.models.find((m) => m.status === 'active' && m.competencies.some((c) => c.code === competency));
    if (!model) fail(`${competency} faol modellarda yo‘q`);
    const recs = emp.records[competency] || [];
    const fromLevel = recs.filter((r) => r.context === 'work').at(-1)?.level ?? null;
    const lvl = Number(targetLevel);
    if (!isLevel(model, lvl)) fail(`Maqsadli daraja 1–${scaleMax(model)} bo‘lishi kerak`);
    if (fromLevel !== null && lvl <= fromLevel) fail(`Maqsadli daraja hozirgi darajadan (${fromLevel}) yuqori bo‘lishi kerak`);
    if (s.idp.some((x) => x.employeeId === employeeId && x.competency === competency && !['done', 'returned'].includes(x.status) && x.source !== 'auto' && x.task === task)) fail('Bunday vazifa allaqachon bor');
    const id = nextId(s, 'idp');
    const who = actor || (by === 'employee' ? emp.name : by === 'hr' ? 'HR/L&D' : 'Mentor');
    s.idp.push({
      id, employeeId, cardId: null, modelId: model.modelId, competency, fromLevel, targetLevel: lvl, goal: levelHeadline(model, competency, lvl),
      task: task.trim(), owner: by === 'employee' ? (owner?.trim() || 'Bevosita rahbar (mentor)') : owner.trim(), courseId: null, evidence: '',
      due, reassessAt: null, status: by === 'employee' ? 'proposed' : 'open', source: by, createdBy: who, activatedAt: by === 'employee' ? null : s.today,
    });
    if (by === 'employee') log(s, who, 'Xodim rivojlanish vazifasini taklif qildi', id, { after: task });
    else {
      notify(s, `idp-open:${id}`, emp.name, `${who} rivojlanish rejangizga vazifa qo‘shdi: ${competency} — muddat ${due}.`);
      log(s, who, 'Rivojlanish vazifasi qo‘lda qo‘shildi', id, { after: task });
    }
  });
}

export function activateIdp(state, { id, patch = {}, actor = 'HR/L&D' }) {
  return mutate(state, (s) => {
    const item = s.idp.find((x) => x.id === id);
    if (!item) fail('IDP bandi topilmadi');
    if (item.status !== 'proposed') fail('Faqat taklif holatidagi band faollashtiriladi');
    const next = { ...item, ...patch };
    if (!String(next.task || '').trim() || !String(next.owner || '').trim() || !next.due) fail('Vazifa, mas’ul va muddat majburiy');
    Object.assign(item, patch, { status: 'open', activatedAt: s.today });
    const emp = getEmployee(s, item.employeeId);
    notify(s, `idp-open:${id}`, emp.name, item.source === 'employee' ? `Taklif qilgan vazifangiz tasdiqlandi: ${item.competency} — muddat ${item.due}.` : `Rivojlanish rejangizga yangi vazifa qo‘shildi: ${item.competency} — muddat ${item.due}.`);
    log(s, actor, 'IDP bandi faollashtirildi', id, { after: item.task });
  });
}

/** Xodim bajarganini dalil bilan yuboradi; band HR/mentor tekshiruviga o'tadi. */
export function submitIdpEvidence(state, { id, employeeId, evidence }) {
  return mutate(state, (s) => {
    const item = s.idp.find((x) => x.id === id);
    if (!item || item.employeeId !== employeeId) fail('IDP bandi topilmadi');
    if (!['open', 'returned'].includes(item.status)) fail('Bu band hozir dalil kutmayapti');
    if (!String(evidence || '').trim()) fail('Nima qilganingizni va natijani yozing');
    Object.assign(item, { status: 'review', evidence, submittedAt: s.today });
    log(s, getEmployee(s, employeeId).name, 'IDP dalili yuborildi', id, { after: evidence });
  });
}

export function reviewIdp(state, { id, decision, reason, actor = 'HR/L&D' }) {
  return mutate(state, (s) => {
    const item = s.idp.find((x) => x.id === id);
    if (!item || item.status !== 'review') fail('Band tekshiruvda emas');
    if (decision === 'returned' && !String(reason || '').trim()) fail('Qaytarish sababi majburiy');
    Object.assign(item, { status: decision === 'done' ? 'done' : 'returned', review: { by: actor, at: s.today, reason: reason || '' } });
    const emp = getEmployee(s, item.employeeId);
    notify(s, `idp-${decision}:${id}:${s.today}:${(item.reviews = (item.reviews || 0) + 1)}`, emp.name, decision === 'done'
      ? `Rivojlanish vazifasi qabul qilindi: ${item.competency}. Daraja qayta baholashda yangilanadi.`
      : `Rivojlanish vazifasi qaytarildi: ${item.competency} — ${reason}`);
    log(s, actor, decision === 'done' ? 'IDP bandi qabul qilindi' : 'IDP bandi qaytarildi', id, { reason });
  });
}

export function updateIdp(state, { id, patch, actor = 'HR/L&D' }) {
  return mutate(state, (s) => {
    const item = s.idp.find((x) => x.id === id);
    if (!item) fail('IDP bandi topilmadi');
    if (patch.status === 'done' && !String(patch.evidence ?? item.evidence).trim()) fail('Bajarilish dalili kiritilmagan');
    Object.assign(item, patch);
    log(s, actor, 'IDP yangilandi', id, { after: JSON.stringify(patch) });
  });
}

/** Kurs yakuni (Exode'dan yoki qo'lda): takroriy yozuv dublikat yaratmaydi (INT 01). */
export function courseCompleted(state, { employeeId, courseId, externalId, actor = 'Exode integratsiyasi' }) {
  return mutate(state, (s) => {
    s.courseEvents ||= [];
    if (s.courseEvents.includes(externalId)) {
      log(s, actor, 'Takroriy kurs yozuvi o‘tkazib yuborildi', externalId);
      return;
    }
    s.courseEvents.push(externalId);
    for (const it of s.idp.filter((x) => x.employeeId === employeeId && x.courseId === courseId)) {
      it.learningStatus = 'Kurs yakunlangan';
    }
    log(s, actor, 'Kurs yakuni qayd etildi', `${employeeId} · ${courseId}`, { reason: externalId });
  });
}

// ---------- Stretch ----------
export function submitStretch(state, { id, text, link, actor }) {
  return mutate(state, (s) => {
    const st = getStretch(s, id);
    if (!st) fail('Vazifa topilmadi');
    if (st.status === 'approved') fail('Dalil allaqachon tasdiqlangan');
    if (!String(text || '').trim()) fail('Natija va shaxsiy hissangizni yozing');
    st.submissions.push({ at: s.today, text, link, review: null });
    st.status = 'submitted';
    log(s, actor || getEmployee(s, st.employeeId).name, 'Stretch dalili yuborildi', id);
  });
}

/** Stretch vazifa biriktirish: maqsadli lavozim ko'lamidagi amaliy ish. Ochiq baholash kartasiga va vorislikka bog'lanadi. */
export function createStretch(state, { employeeId, target, title, scope, deadline, authority, expected, criteria, competencies = [], mentor, actor = 'HR/L&D' }) {
  return mutate(state, (s) => {
    const emp = getEmployee(s, employeeId);
    if (!emp) fail('Xodim tanlanmagan');
    let model = null; let profile = null;
    for (const m of s.models.filter((x) => x.status === 'active')) { const p = m.profiles.find((x) => x.code === target); if (p) { model = m; profile = p; break; } }
    if (!profile) fail('Maqsadli lavozim tanlanmagan');
    const req = { 'Vazifa nomi': title, 'Ko‘lam': scope, 'Kutilgan natija': expected, 'Tekshirish mezoni': criteria };
    for (const [k, v] of Object.entries(req)) if (!String(v || '').trim()) fail(`${k} majburiy`);
    if (!deadline) fail('Muddat majburiy');
    if (deadline <= s.today) fail('Muddat bugundan keyin bo‘lishi kerak');
    if (!competencies.length) fail('Kamida bitta kompetensiya tanlang');
    const bad = competencies.filter((c) => profile.targets[c] === undefined);
    if (bad.length) fail(`${bad.join(', ')} ${target} lavozimi talablarida yo‘q`);
    if (s.stretches.some((x) => x.employeeId === employeeId && x.target === target && x.status !== 'approved')) fail(`${emp.name}da ${target} bo‘yicha ochiq stretch vazifa bor`);
    const id = nextId(s, 's');
    s.stretches.push({ id, employeeId, target, kind: `${emp.currentLevel} → ${target}`, title: title.trim(), scope, deadline, authority: authority || '—', expected, criteria, competencies, mentor: mentor || '—', status: 'assigned', submissions: [], createdAt: s.today, createdBy: actor });
    const card = s.cards.find((c) => c.employeeId === employeeId && c.profileTo === target && c.stage !== 'published' && c.stage !== 'closed' && !c.stretchId);
    if (card) card.stretchId = id;
    upsertSuccession(s, employeeId, target, { status: 'trial', owner: actor, next: `Stretch: «${title.trim()}» — muddat ${deadline}` }, 'plan');
    notify(s, `stretch-new:${id}`, emp.name, `Sizga stretch vazifa biriktirildi: «${title.trim()}» (${target}), muddat ${deadline}.`);
    log(s, actor, 'Stretch vazifa biriktirildi', id, { after: `${emp.id} → ${target}` });
  });
}

export function reviewStretch(state, { id, decision, reason, actor = 'HR/L&D' }) {
  return mutate(state, (s) => {
    const st = getStretch(s, id);
    const last = st.submissions[st.submissions.length - 1];
    if (!last || last.review) fail('Tekshiriladigan yangi yuborish yo‘q');
    if (!String(reason || '').trim()) fail('Asos majburiy');
    last.review = { decision, reason, by: actor, at: s.today };
    st.status = decision === 'approved' ? 'approved' : 'returned';
    const emp = getEmployee(s, st.employeeId);
    notify(s, `stretch:${id}:${st.submissions.length}`, emp.name, decision === 'approved' ? `Stretch dalili tasdiqlandi: ${st.title}` : `Stretch dalili qaytarildi: ${reason}`);
    log(s, actor, decision === 'approved' ? 'Stretch tasdiqlandi' : 'Stretch qaytarildi', id, { reason });
  });
}

// ---------- Karyera va vorislik ----------
export function expressInterest(state, { employeeId, target, note }) {
  return mutate(state, (s) => {
    if (s.interests.some((x) => x.employeeId === employeeId && x.target === target)) fail('Bu yo‘nalishga qiziqish allaqachon bildirilgan');
    s.interests.push({ id: nextId(s, 'int'), employeeId, target, at: s.today, note });
    upsertSuccession(s, employeeId, target, {}, 'interest');
    notify(s, `interest:${employeeId}:${target}`, 'HR/L&D', `${getEmployee(s, employeeId).name} ${target} yo‘nalishiga qiziqish bildirdi.`);
    log(s, getEmployee(s, employeeId).name, 'Qiziqish bildirildi', target, { reason: note });
  });
}

// ---------- Nomzod tanlash: lavozimga tayyorlik ----------
const workLevelOf = (emp, code) => (emp.records[code] || []).filter((r) => r.context === 'work').at(-1)?.level;

/** Xodimning lavozim darajasiga tayyorligi: tasdiqlangan ish dalillari bo'yicha to'plangan ball ÷ maqsadli ball, yetishmovchiliklar va o'tish huquqi. */
export function positionReadiness(s, emp, model, profile) {
  const entries = Object.entries(profile.targets);
  let credited = 0;
  let sum = 0;
  const gaps = [];
  for (const [code, t] of entries) {
    const l = workLevelOf(emp, code);
    sum += t;
    credited += Math.min(isNum(l) ? l : 0, t);
    if (!(isNum(l) && l >= t)) gaps.push({ code, target: t, level: isNum(l) ? l : null });
  }
  const conds = profileConditions(model, profile);
  const entry = conds.find((c) => c.type === 'entry_levels')?.params.levels;
  const sameModel = emp.position === model.modelId;
  const curIdx = sameModel ? model.profiles.findIndex((p) => p.code === emp.currentLevel) : -1;
  const tgtIdx = model.profiles.indexOf(profile);
  let eligible = true;
  let reason = null;
  if (sameModel && curIdx >= tgtIdx) { eligible = false; reason = 'Shu yoki yuqori darajada ishlaydi'; }
  else if (entry?.length) { eligible = entry.includes(emp.currentLevel); if (!eligible) reason = `O‘tish faqat ${entry.join(', ')} darajasidan`; }
  else if (sameModel && tgtIdx !== curIdx + 1) { eligible = false; reason = `Avval ${model.profiles[curIdx + 1]?.code} darajasi`; }
  else if (!sameModel && tgtIdx > 0) { eligible = false; reason = `Avval ${model.profiles[0].code} darajasi`; }
  return { near: sum ? (100 * credited) / sum : 0, credited, sum, met: entries.length - gaps.length, total: entries.length, gaps, complete: gaps.length === 0, eligible, reason };
}

/** Lavozim darajasiga barcha nomzodlar: o'tish huquqi borlar oldin, so'ng tayyorlik foizi bo'yicha. */
export function candidatesFor(s, modelId, profileCode) {
  const model = activeModel(s, modelId);
  const profile = model?.profiles.find((p) => p.code === profileCode);
  if (!profile) return [];
  return activeEmployees(s)
    .filter((e) => !(e.position === modelId && model.profiles.findIndex((p) => p.code === e.currentLevel) >= model.profiles.indexOf(profile)))
    .map((e) => ({
      emp: e, ...positionReadiness(s, e, model, profile),
      interest: s.interests.find((x) => x.employeeId === e.id && x.target === profileCode) || null,
      succession: s.succession.find((x) => x.employeeId === e.id && x.target === profileCode) || null,
      card: s.cards.find((c) => c.employeeId === e.id && c.profileTo === profileCode && c.stage !== 'closed') || null,
    }))
    .sort((a, b) => (b.eligible ? 1 : 0) - (a.eligible ? 1 : 0) || b.near - a.near);
}

/** Eng yaqin nomzodni lavozimga tayyorlash: har bir yetishmovchilik uchun rivojlanish vazifasi + vorislik holati «Rivojlanmoqda». */
export function startPreparation(state, { employeeId, modelId, profileCode, actor = 'HR/L&D' }) {
  return mutate(state, (s) => {
    const model = activeModel(s, modelId);
    const profile = model?.profiles.find((p) => p.code === profileCode);
    const emp = getEmployee(s, employeeId);
    if (!profile || !emp) fail('Lavozim yoki xodim topilmadi');
    const r = positionReadiness(s, emp, model, profile);
    if (!r.eligible) fail(`${emp.name} hozir ${profileCode} ga o‘ta olmaydi: ${r.reason}`);
    if (r.complete) fail('Nomzod 100% tayyor — tayyorlash emas, baholash kartasini oching');
    let added = 0;
    for (const g of r.gaps) {
      const has = s.idp.some((x) => x.employeeId === emp.id && x.competency === g.code && !['done', 'rejected'].includes(x.status) && x.targetLevel >= g.target);
      if (has) continue;
      s.idp.push({ id: nextId(s, 'idp'), employeeId: emp.id, cardId: null, modelId, targetPosition: profileCode, competency: g.code, fromLevel: g.level, targetLevel: g.target,
        ...idpProposal(s, model, g.code, g.target, false), status: 'open', source: 'plan', createdBy: actor, activatedAt: s.today });
      added += 1;
    }
    upsertSuccession(s, emp.id, profileCode, { status: 'developing', owner: actor, next: `${profile.name}: tayyorlash rejasi — ${added} ta vazifa, ${fmtPctPlain(r.near)} tayyor`, plan: { at: s.today, modelId, near: r.near } }, 'plan');
    notify(s, `prep:${emp.id}:${profileCode}`, emp.name, `Siz «${profile.name}» lavozimiga tayyorlash rejasiga kiritildingiz: ${added} ta rivojlanish vazifasi.`);
    log(s, actor, 'Lavozimga tayyorlash boshlandi', `${emp.id} → ${profileCode}`, { after: `${added} vazifa · ${fmtPctPlain(r.near)}` });
  });
}
const fmtPctPlain = (v) => `${Math.round(v)}%`;

export function setSuccessionStatus(state, { id, status, reason, actor = 'HR/L&D' }) {
  return mutate(state, (s) => {
    const row = s.succession.find((x) => x.id === id);
    if (!String(reason || '').trim()) fail('Qaror asosi majburiy');
    if (status === 'reserve') {
      const ok = s.cards.some((c) => c.employeeId === row.employeeId && c.profileTo === row.target && c.stage === 'published' && cardDecision(s, c).ready);
      if (!ok) fail('Rezervga kiritish uchun maqsadli lavozim bo‘yicha e’lon qilingan tayyorlik xulosasi kerak');
    }
    const before = row.status;
    row.status = status;
    row.decision = { by: actor, at: s.today, reason };
    log(s, actor, 'Vorislik holati', id, { before, after: status, reason });
  });
}

export function submitExtraEvidence(state, { employeeId, competency, activityId, context, description, link }) {
  return mutate(state, (s) => {
    if (!competency || !String(description || '').trim()) fail('Kompetensiya va dalil tavsifi majburiy');
    s.evidenceQueue.push({ id: nextId(s, 'ev'), employeeId, competency, activityId, context, description, link, status: 'pending', at: s.today });
    log(s, getEmployee(s, employeeId).name, 'Qo‘shimcha kompetensiya dalili yuborildi', competency);
  });
}

export function reviewExtraEvidence(state, { id, decision, level, reason, actor = 'Baholovchi' }) {
  return mutate(state, (s) => {
    const item = s.evidenceQueue.find((x) => x.id === id);
    if (!item || item.status !== 'pending') fail('Dalil navbatda emas');
    if (!String(reason || '').trim()) fail('Asos majburiy');
    if (decision === 'approved') {
      const act = { ...(s.activities.find((a) => a.id === item.activityId) || { name: 'Ish dalili', maxLevel: 5 }) };
      const owner = s.models.find((m) => m.status === 'active' && m.competencies.some((c) => c.code === item.competency));
      if (owner) act.scaleMax = scaleMax(owner);
      const chk = checkActivityCap(level, act);
      if (!chk.ok) fail(chk.reason);
      const emp = getEmployee(s, item.employeeId);
      emp.records[item.competency] = [...(emp.records[item.competency] || []), { level, context: item.context, source: act.name, date: s.today }];
    }
    Object.assign(item, { status: decision, level, review: { by: actor, at: s.today, reason } });
    log(s, actor, decision === 'approved' ? 'Dalil tasdiqlandi' : 'Dalil rad etildi', `${item.employeeId} · ${item.competency}`, { after: String(level ?? '—'), reason });
  });
}

// ---------- Model versiyalari ----------
export function createDraft(state, { fromId, actor = 'HR/L&D' }) {
  return mutate(state, (s) => {
    const src = getModel(s, fromId);
    if (s.models.some((m) => m.modelId === src.modelId && (m.status === 'draft' || m.status === 'review'))) fail('Bu model uchun ochiq qoralama allaqachon bor');
    const versions = s.models.filter((m) => m.modelId === src.modelId).length;
    const v = `${src.version.split('-')[0].split('.')[0]}.${Number(src.version.split('-')[0].split('.')[1] || 0) + versions}`;
    const draft = { ...structuredClone(src), id: `${src.modelId}@${v}`, version: v, status: 'draft', approvedBy: null, approvedAt: null, createdBy: actor, basedOn: src.id };
    s.models.push(draft);
    log(s, actor, 'Qoralama versiya yaratildi', draft.id, { before: src.id });
  });
}

export function updateDraft(state, { id, patch, actor = 'HR/L&D' }) {
  return mutate(state, (s) => {
    const m = getModel(s, id);
    if (m.status !== 'draft') fail('Faqat qoralama tahrirlanadi');
    patch(m);
    log(s, actor, 'Qoralama tahrirlandi', id);
  });
}

export function setModelStatus(state, { id, status, actor }) {
  return mutate(state, (s) => {
    const m = getModel(s, id);
    if (status === 'review') {
      if (m.status !== 'draft') fail('Tekshiruvga faqat qoralama yuboriladi');
    } else if (status === 'active') {
      if (m.status !== 'review') fail('Faollashtirishdan oldin tekshiruv bosqichi kerak');
      const errs = validateModel(m);
      if (errs.length) fail(`E’lon qilinmadi: ${errs.slice(0, 3).join('; ')}`);
      for (const o of s.models) if (o.modelId === m.modelId && o.status === 'active') o.status = 'archived';
      m.approvedBy = actor;
      m.approvedAt = s.today;
    } else if (status === 'draft') {
      if (m.status !== 'review') fail('Faqat tekshiruvdagi versiya qaytariladi');
    }
    const before = m.status;
    m.status = status;
    log(s, actor || 'HRD', 'Model holati', id, { before, after: status });
  });
}

export function importDraft(state, { data, name, modelId, actor = 'HR/L&D' }) {
  return mutate(state, (s) => {
    const id = `${modelId}@0.1`;
    if (getModel(s, id)) fail(`${id} allaqachon mavjud`);
    s.models.push({
      id, modelId, name, version: '0.1', status: 'draft', createdBy: actor, formulaVersion: 'capped-ratio@1', transition: false, panelRequired: false,
      note: 'Excel importidan yaratilgan qoralama', methods: ['interview', 'case', 'work_sample'], evidencePolicy: { context: 'work' },
      competencies: data.competencies, composites: {}, profiles: data.profiles, evidenceRules: data.evidenceRules,
      rules: { conditions: [{ type: 'all_numeric' }, { type: 'min_level_all', params: { min: 3 } }, { type: 'match_threshold', params: { threshold: 90 } }] },
      stages: ['draft', 'evidence', 'assessment', 'approval', 'published'],
    });
    log(s, actor, 'Import: qoralama versiya ochildi', id);
  });
}

// ---------- Model konstruktori (yangi lavozim) ----------
const DEFAULT_STAGES = ['draft', 'evidence', 'assessment', 'approval', 'published'];
const CODE_RE = /^[A-Z0-9][A-Z0-9-]{0,15}$/;

export function createModel(state, { modelId, name, scaleMax: max = 5, template = 'blank', fromId, actor = 'HR/L&D' }) {
  return mutate(state, (s) => {
    const mid = String(modelId || '').trim().toUpperCase();
    if (!CODE_RE.test(mid)) fail('Model kodi: lotin bosh harflari, raqam va «-» (masalan SOTUV)');
    if (!String(name || '').trim()) fail('Lavozim nomi majburiy');
    if (s.models.some((m) => m.modelId === mid)) fail(`${mid} kodli model allaqachon bor`);
    if (![3, 4, 5, 6].includes(Number(max))) fail('Shkala 3–6 darajali bo‘lishi mumkin');
    const base = template === 'copy' ? getModel(s, fromId) : null;
    if (template === 'copy' && !base) fail('Nusxa olinadigan model tanlanmagan');
    const id = `${mid}@0.1`;
    const sameScale = base && scaleMax(base) === Number(max);
    s.models.push({
      id, modelId: mid, name: name.trim(), version: '0.1', status: 'draft', createdBy: actor, basedOn: base?.id,
      formulaVersion: 'capped-ratio@1', transition: base ? base.transition : false, panelRequired: base ? base.panelRequired : false,
      approverLabel: 'HRD', evaluatorRole: base?.evaluatorRole || 'Assessor',
      note: base ? `${base.id} asosida yaratilgan qoralama.` : 'Konstruktorda yaratilgan yangi lavozim modeli.',
      scale: { max: Number(max) },
      scoring: base ? structuredClone(base.scoring || { mode: 'judgment' }) : { mode: 'judgment' },
      methods: base ? [...base.methods] : ['interview', 'case', 'work_sample'],
      methodDefs: base ? structuredClone(base.methodDefs || {}) : {},
      evidencePolicy: { context: 'work' },
      // Shkala boshqa bo'lsa indikatorlar ko'chirilmaydi: ular yangi shkala uchun qayta yoziladi.
      competencies: base ? base.competencies.map((c) => ({ ...structuredClone(c), levels: sameScale ? structuredClone(c.levels) : {} })) : [],
      composites: base ? structuredClone(base.composites || {}) : {},
      profiles: base ? base.profiles.map((p) => ({ ...structuredClone(p), targets: sameScale ? { ...p.targets } : {} })) : [],
      rules: base ? structuredClone(base.rules) : { conditions: [{ type: 'all_numeric' }, { type: 'min_level_all', params: { min: Math.ceil(Number(max) / 2) } }, { type: 'match_threshold', params: { threshold: 90 } }] },
      stages: base ? [...base.stages] : [...DEFAULT_STAGES],
    });
    log(s, actor, 'Yangi lavozim modeli yaratildi', id, { after: `${name} · 1–${max} shkala` });
  });
}

function draftModel(s, id) {
  const m = getModel(s, id);
  if (!m) fail('Model topilmadi');
  if (m.status !== 'draft') fail('Faqat qoralama tahrirlanadi');
  return m;
}

export function addCompetency(state, { id, comp, fromCode, actor = 'HR/L&D' }) {
  return mutate(state, (s) => {
    const m = draftModel(s, id);
    let c;
    if (fromCode) {
      const src = s.models.flatMap((x) => x.competencies.map((k) => ({ k, max: scaleMax(x) }))).find((x) => x.k.code === fromCode);
      if (!src) fail(`${fromCode} kutubxonada yo‘q`);
      c = { ...structuredClone(src.k), levels: src.max === scaleMax(m) ? structuredClone(src.k.levels) : {} };
      delete c.composite;
    } else {
      const code = String(comp?.code || '').trim().toUpperCase();
      if (!CODE_RE.test(code)) fail('Kompetensiya kodi: lotin bosh harflari, raqam va «-» (masalan SOT-01)');
      if (!String(comp?.name || '').trim()) fail('Kompetensiya nomi majburiy');
      c = { code, name: comp.name.trim(), layer: String(comp.layer || '').trim() || 'Kasbiy', definition: comp.definition || '', levels: {}, methods: comp.methods || [] };
    }
    if (m.competencies.some((x) => x.code === c.code)) fail(`${c.code} modelda allaqachon bor`);
    m.competencies.push(c);
    log(s, actor, 'Kompetensiya qo‘shildi', `${id} · ${c.code}`);
  });
}

export function removeCompetency(state, { id, code, actor = 'HR/L&D' }) {
  return mutate(state, (s) => {
    const m = draftModel(s, id);
    m.competencies = m.competencies.filter((c) => c.code !== code);
    delete m.composites?.[code];
    for (const p of m.profiles) delete p.targets[code];
    for (const c of m.rules.conditions) if (c.type === 'min_level_items') delete c.params.items[code];
    log(s, actor, 'Kompetensiya olib tashlandi', `${id} · ${code}`);
  });
}

export function addProfile(state, { id, code, name, actor = 'HR/L&D' }) {
  return mutate(state, (s) => {
    const m = draftModel(s, id);
    const pc = String(code || '').trim().toUpperCase();
    if (!CODE_RE.test(pc)) fail('Profil kodi: lotin bosh harflari, raqam va «-» (masalan SOT-1)');
    if (!String(name || '').trim()) fail('Profil nomi majburiy');
    if (m.profiles.some((p) => p.code === pc)) fail(`${pc} profili allaqachon bor`);
    m.profiles.push({ code: pc, name: name.trim(), targets: {} });
    log(s, actor, 'Profil qo‘shildi', `${id} · ${pc}`);
  });
}

export function removeProfile(state, { id, code, actor = 'HR/L&D' }) {
  return mutate(state, (s) => {
    const m = draftModel(s, id);
    m.profiles = m.profiles.filter((p) => p.code !== code);
    log(s, actor, 'Profil olib tashlandi', `${id} · ${code}`);
  });
}

export function addMethod(state, { id, name, kind, actor = 'HR/L&D' }) {
  return mutate(state, (s) => {
    const m = draftModel(s, id);
    if (!String(name || '').trim()) fail('Usul nomi majburiy');
    if (!kind) fail('Usul turi tanlanmagan');
    let code = kind;
    let n = 2;
    while (m.methods.includes(code) || m.methodDefs?.[code]) code = `${kind}_${n++}`;
    m.methodDefs = { ...(m.methodDefs || {}), [code]: { name: name.trim(), kind } };
    m.methods.push(code);
    log(s, actor, 'Baholash usuli qo‘shildi', `${id} · ${name}`);
  });
}

// ---------- Ruxsatlar (NFR 01) ----------
export function canAccessCard(state, user, card) {
  if (['hr', 'hrd', 'assessor'].includes(user.role)) return true;
  if (user.role === 'regional') return getBranch(state, card.branchId)?.region === user.region;
  if (user.role === 'employee') return card.employeeId === user.employeeId;
  return false;
}

export function requestEvidenceFile(state, { user, cardId, file }) {
  const card = getCard(state, cardId);
  const allowed = canAccessCard(state, user, card);
  const next = mutate(state, (s) => {
    log(s, user.name, allowed ? 'Dalil fayli ochildi' : 'Ruxsatsiz fayl so‘rovi rad etildi', `${cardId} · ${file}`);
  });
  return { state: next, allowed };
}

export function markNotificationsRead(state, to) {
  return mutate(state, (s) => {
    for (const n of s.notifications) if (!to || n.to === to) n.read = true;
  });
}

export function updateKpi(state, { patch, actor = 'HR/L&D' }) {
  return mutate(state, (s) => {
    patch(s.kpiNewBranch);
    log(s, actor, 'Yangi filial KPI yangilandi', s.kpiNewBranch.branchId);
  });
}

// ======================= LMS: kurslar va Learning Path =======================
// Kurs komponentlari (dars, test, amaliy topshiriq) bajarilganda kursdagi qoidalar bo'yicha kompetensiya darajasi
// o'quv yoki ish dalili sifatida yoziladi. Chegara (maksimal daraja) kursda sozlanadi (CAR 02).
// Amaliy topshiriq mentor xulosasi bilan tasdiqlanadi; mentor bergan daraja qoida chegarasidan oshmaydi.
export const getCourse = (s, id) => (s.courses || []).find((c) => c.id === id);
export const getPath = (s, id) => (s.paths || []).find((p) => p.id === id);
export const getEnrollment = (s, id) => (s.enrollments || []).find((e) => e.id === id);

/** Komponent bajarilganmi: dars — o'qildi; test — o'tish bali; topshiriq — mentor qabul qildi. */
export function componentDone(course, enr, compId) {
  const c = course.components.find((x) => x.id === compId);
  const p = enr.progress[compId];
  if (!c || !p) return false;
  if (c.kind === 'lesson') return !!p.done;
  if (c.kind === 'test') return isNum(p.best) && p.best >= c.passScore;
  return p.status === 'accepted';
}

/** Ketma-ket Learning Path'da oldingi kurs yakunlanmaguncha keyingisi yopiq. */
export function courseLocked(s, enr) {
  if (!enr.pathId) return false;
  const path = getPath(s, enr.pathId);
  if (!path?.sequential) return false;
  const i = path.courses.indexOf(enr.courseId);
  if (i <= 0) return false;
  const prev = s.enrollments.find((e) => e.employeeId === enr.employeeId && e.courseId === path.courses[i - 1] && e.pathId === enr.pathId);
  return prev?.status !== 'completed';
}

/** Kurs qoidasi bajarilganda qaysi daraja beriladi (topshiriq bo'lsa — mentor bahosi, qoida chegarasidan oshmaydi). */
export function ruleOutcome(course, enr, r) {
  if (!r.needs.every((id) => componentDone(course, enr, id))) return null;
  const taskLevels = r.needs.map((id) => course.components.find((c) => c.id === id)).filter((c) => c?.kind === 'task').map((c) => enr.progress[c.id]?.mentor?.level).filter(isNum);
  return Math.min(r.level, ...taskLevels);
}

function settleEnrollment(s, enr, actor) {
  const course = getCourse(s, enr.courseId);
  const emp = getEmployee(s, enr.employeeId);
  enr.applied ||= [];
  const changed = [];
  course.rules.forEach((r, i) => {
    if (enr.applied.includes(i)) return;
    const lvl = ruleOutcome(course, enr, r);
    if (lvl === null) return;
    enr.applied.push(i);
    const cur = (emp.records[r.competency] || []).filter((x) => x.context === r.context).at(-1)?.level;
    if (isNum(cur) && cur >= lvl) return; // mavjud daraja yuqori bo'lsa pasaytirilmaydi
    emp.records[r.competency] = [...(emp.records[r.competency] || []), { level: lvl, context: r.context, source: `Kurs «${course.title}»${r.context === 'work' ? ' — amaliy topshiriq, mentor xulosasi' : ''}`, date: s.today, courseId: course.id }];
    changed.push(`${r.competency} → ${lvl} (${r.context === 'work' ? 'ish dalili' : 'o‘quv dalili'})`);
    log(s, actor, 'Kurs natijasi kompetensiyaga yozildi', `${emp.id} · ${r.competency}`, { after: String(lvl), reason: course.id });
  });
  if (changed.length) notify(s, `crs-rec:${enr.id}:${enr.applied.join(',')}`, emp.name, `«${course.title}»: ${changed.join(', ')}.`);
  // Kurs ko'nikma ham beradi (kompetensiyadan alohida): shart bajarilsa — tasdiqlangan ko'nikma.
  enr.skillApplied ||= [];
  (course.skills || []).forEach((k, i) => {
    if (enr.skillApplied.includes(i) || !k.needs.every((n) => componentDone(course, enr, n))) return;
    enr.skillApplied.push(i);
    awardSkill(s, emp, k.skillId, k.level, `Kurs «${course.title}»`, actor);
  });
  if (enr.status !== 'completed' && course.components.every((c) => componentDone(course, enr, c.id))) {
    enr.status = 'completed';
    enr.completedAt = s.today;
    for (const it of s.idp.filter((x) => x.employeeId === emp.id && (x.courseId === course.id || x.courseId === course.exodeId))) it.learningStatus = 'Kurs yakunlangan';
    notify(s, `crs-done:${enr.id}`, emp.name, `Kurs yakunlandi: «${course.title}».`);
    log(s, actor, 'Kurs yakunlandi', `${emp.id} · ${course.id}`);
    if (enr.pathId) {
      const path = getPath(s, enr.pathId);
      const pe = s.pathEnrollments.find((x) => x.employeeId === emp.id && x.pathId === path.id);
      const all = path.courses.every((cid) => s.enrollments.some((e) => e.employeeId === emp.id && e.courseId === cid && e.status === 'completed'));
      if (pe && all && pe.status !== 'completed') {
        pe.status = 'completed';
        pe.completedAt = s.today;
        notify(s, `path-done:${pe.id}`, emp.name, `Learning Path yakunlandi: «${path.title}». Lavozim shartlari (KPI, staj, baholash) bo‘yicha HR bilan keyingi qadam.`);
        log(s, actor, 'Learning Path yakunlandi', `${emp.id} · ${path.id}`);
      }
    }
  }
}

function learnEnr(s, enrollmentId) {
  const enr = getEnrollment(s, enrollmentId);
  if (!enr) fail('Kursga yozilish topilmadi');
  if (courseLocked(s, enr)) fail('Bu kurs Learning Path’dagi oldingi kurs yakunlangach ochiladi');
  return enr;
}

export function enrollCourse(state, { employeeId, courseId, pathId = null, by = 'employee', actor, deadline = null }) {
  return mutate(state, (s) => {
    const course = getCourse(s, courseId);
    if (!course || course.status !== 'active') fail('Kurs faol emas');
    if (s.enrollments.some((e) => e.employeeId === employeeId && e.courseId === courseId && e.status !== 'completed')) fail('Bu kursga allaqachon yozilgansiz');
    const id = nextId(s, 'enr');
    if (deadline && deadline <= s.today) fail('Muddat bugundan keyin bo‘lsin');
    s.enrollments.push({ id, employeeId, courseId, pathId, by, startedAt: s.today, status: 'in_progress', progress: {}, applied: [], ...(deadline ? { deadline } : {}), courseVersion: course.version || 1 });
    const emp = getEmployee(s, employeeId);
    if (by !== 'employee') notify(s, `enr:${id}`, emp.name, `Sizga kurs biriktirildi: «${course.title}»${deadline ? `, muddat ${deadline}` : ''}${actor ? ` (${actor})` : ''}.`);
    log(s, actor || (by === 'employee' ? emp.name : 'HR/L&D'), 'Kursga yozildi', `${employeeId} · ${courseId}`);
  });
}

export function enrollPath(state, { employeeId, pathId, by = 'employee', actor }) {
  return mutate(state, (s) => {
    const path = getPath(s, pathId);
    if (!path) fail('Learning Path topilmadi');
    if (s.pathEnrollments.some((x) => x.employeeId === employeeId && x.pathId === pathId && x.status !== 'completed')) fail('Bu Learning Path’ga allaqachon yozilgansiz');
    const emp = getEmployee(s, employeeId);
    s.pathEnrollments.push({ id: nextId(s, 'lpe'), employeeId, pathId, by, startedAt: s.today, status: 'active' });
    for (const cid of path.courses) {
      const done = s.enrollments.find((e) => e.employeeId === employeeId && e.courseId === cid && e.status === 'completed');
      if (done) continue; // avval yakunlangan kurs hisobga olinadi
      const open = s.enrollments.find((e) => e.employeeId === employeeId && e.courseId === cid && e.status !== 'completed');
      if (open) { open.pathId = pathId; continue; }
      s.enrollments.push({ id: nextId(s, 'enr'), employeeId, courseId: cid, pathId, by, startedAt: s.today, status: 'in_progress', progress: {}, applied: [] });
    }
    for (const e of s.enrollments.filter((x) => x.employeeId === employeeId && path.courses.includes(x.courseId) && x.status === 'completed')) e.pathId ||= pathId;
    notify(s, `lp:${employeeId}:${pathId}`, emp.name, by === 'employee' ? `Learning Path boshlandi: «${path.title}».` : `Sizga Learning Path biriktirildi: «${path.title}» (${path.courses.length} kurs).`);
    log(s, actor || (by === 'employee' ? emp.name : 'HR/L&D'), 'Learning Path’ga yozildi', `${employeeId} · ${pathId}`);
  });
}

export function completeLesson(state, { enrollmentId, componentId }) {
  return mutate(state, (s) => {
    const enr = learnEnr(s, enrollmentId);
    enr.progress[componentId] = { ...(enr.progress[componentId] || {}), done: true, at: s.today };
    settleEnrollment(s, enr, getEmployee(s, enr.employeeId).name);
  });
}

export function submitTest(state, { enrollmentId, componentId, answers }) {
  return mutate(state, (s) => {
    const enr = learnEnr(s, enrollmentId);
    const c = getCourse(s, enr.courseId).components.find((x) => x.id === componentId);
    if (c?.kind !== 'test') fail('Test topilmadi');
    if (c.questions.some((_, i) => answers[i] === undefined || answers[i] === null)) fail('Barcha savollarga javob bering');
    const correct = c.questions.filter((qq, i) => Number(answers[i]) === qq.answer).length;
    const score = Math.round((100 * correct) / c.questions.length);
    const p = enr.progress[componentId] || { attempts: 0 };
    enr.progress[componentId] = { ...p, attempts: (p.attempts || 0) + 1, last: score, best: Math.max(p.best ?? 0, score), at: s.today };
    log(s, getEmployee(s, enr.employeeId).name, 'Test topshirildi', `${enr.courseId} · ${componentId}`, { after: `${score}%` });
    settleEnrollment(s, enr, 'Tizim');
  });
}

/** origin: 'self' — o'z tashabbusi bilan; 'manager' — rahbar topshirig'i bilan (assignedBy). */
export function submitTask(state, { enrollmentId, componentId, text, link, origin = 'self', assignedBy }) {
  return mutate(state, (s) => {
    const enr = learnEnr(s, enrollmentId);
    const c = getCourse(s, enr.courseId).components.find((x) => x.id === componentId);
    if (c?.kind !== 'task') fail('Topshiriq topilmadi');
    if (!String(text || '').trim()) fail('Nima qilganingiz, natija va shaxsiy hissangizni yozing');
    if (origin === 'manager' && !String(assignedBy || '').trim()) fail('Topshiriqni bergan rahbarni ko‘rsating');
    const p = enr.progress[componentId] || { history: [] };
    if (p.status === 'accepted') fail('Topshiriq allaqachon qabul qilingan');
    enr.progress[componentId] = { ...p, status: 'pending', text, link, origin, assignedBy: origin === 'manager' ? assignedBy : null, submittedAt: s.today, history: [...(p.history || []), { at: s.today, text, link }] };
    log(s, getEmployee(s, enr.employeeId).name, 'Amaliy topshiriq yuborildi', `${enr.courseId} · ${componentId}`);
  });
}

/** Mentor xulosasi: qabul (daraja + izoh) yoki qaytarish (izoh). Daraja qoida chegarasidan oshmaydi. */
export function reviewTask(state, { enrollmentId, componentId, decision, level, grade, note, mentor = 'Mentor', reviewerId }) {
  return mutate(state, (s) => {
    const enr = getEnrollment(s, enrollmentId);
    const course = getCourse(s, enr.courseId);
    const p = enr.progress[componentId];
    if (!p || p.status !== 'pending') fail('Topshiriq tekshiruvda emas');
    if (reviewerId && !canReviewTask(s, getStaff(s, reviewerId), enr)) {
      const r = taskReviewer(s, enr);
      fail(`Bu topshiriqni ${r.kind === 'curator' ? `kurs kuratori (${r.user.name})` : r.kind === 'mentor' ? `xodim mentori (${r.user.name})` : 'HR'} tekshiradi`);
    }
    if (!String(note || '').trim()) fail('Mentor xulosasi majburiy');
    const cap = Math.max(0, ...course.rules.filter((r) => r.needs.includes(componentId)).map((r) => r.level));
    if (decision === 'accepted' && cap > 0 && !(Number.isInteger(level) && level >= 1 && level <= cap)) fail(`Daraja 1–${cap} oralig‘ida (kurs chegarasi)`);
    if (decision === 'accepted' && course.onboarding && !(Number.isInteger(grade) && grade >= 1 && grade <= 5)) fail('Moslashuv kursi: 1–5 baho qo‘ying');
    if (decision === 'accepted' && cap === 0 && !course.onboarding) fail('Kursda bu topshiriq uchun qoida yo‘q');
    p.status = decision;
    p.mentor = { level: decision === 'accepted' && cap > 0 ? level : null, grade: decision === 'accepted' && course.onboarding ? grade : null, note, by: mentor, at: s.today };
    p.history = [...(p.history || []), { at: s.today, review: decision, note, by: mentor }];
    const emp = getEmployee(s, enr.employeeId);
    notify(s, `task:${enr.id}:${componentId}:${p.history.length}`, emp.name, decision === 'accepted' ? `«${course.title}»: amaliy topshiriq qabul qilindi (${course.onboarding ? `${grade} / 5 ball` : `${level}-daraja`}). ${note}` : `«${course.title}»: amaliy topshiriq qaytarildi — ${note}`);
    log(s, mentor, decision === 'accepted' ? 'Amaliy topshiriq qabul qilindi' : 'Amaliy topshiriq qaytarildi', `${emp.id} · ${course.id} · ${componentId}`, { after: String(level ?? '—'), reason: note });
    if (decision === 'accepted') settleEnrollment(s, enr, mentor);
  });
}

// ---------- Kurs konstruktori ----------
export function validateCourse(s, c) {
  const errs = [];
  if (!String(c.title || '').trim()) errs.push('Kurs nomi yo‘q');
  if (!c.components.length) errs.push('Kamida bitta dars, test yoki topshiriq kerak');
  if (!c.components.some((x) => x.kind !== 'lesson')) errs.push('Kamida bitta test yoki amaliy topshiriq kerak');
  const ids = c.components.map((x) => x.id);
  if (new Set(ids).size !== ids.length) errs.push('Komponent identifikatorlari takrorlangan');
  for (const x of c.components) {
    if (x.kind === 'test' && !(x.questions || []).length) errs.push(`«${x.title}»: savol yo‘q`);
    if (x.kind === 'test' && (x.questions || []).some((qq) => qq.options.length < 2 || !qq.text.trim())) errs.push(`«${x.title}»: savol yoki variantlar to‘liq emas`);
    if (x.kind === 'task' && !String(x.description || '').trim()) errs.push(`«${x.title}»: topshiriq tavsifi yo‘q`);
  }
  if (!c.rules.length) errs.push('Kompetensiyaga ta’sir qoidasi yo‘q');
  const lib = new Set(s.models.flatMap((m) => m.competencies.map((k) => k.code)));
  for (const r of c.rules) {
    if (!lib.has(r.competency)) errs.push(`${r.competency} kompetensiyalar kutubxonasida yo‘q`);
    if (!(Number.isInteger(r.level) && r.level >= 1 && r.level <= 5)) errs.push(`${r.competency}: daraja 1–5`);
    if (!r.needs.length) errs.push(`${r.competency}: qaysi komponentlar bajarilishi kerakligi tanlanmagan`);
    if (r.context === 'work' && !r.needs.some((id) => c.components.find((x) => x.id === id)?.kind === 'task')) errs.push(`${r.competency}: ish dalili uchun amaliy topshiriq (mentor xulosasi) kerak`);
  }
  return errs;
}

export function createCourse(state, { title, direction, hours, summary, actor = 'HR/L&D' }) {
  return mutate(state, (s) => {
    if (!String(title || '').trim()) fail('Kurs nomi majburiy');
    const id = `CRS-NEW-${String((s.courses || []).filter((c) => c.id.startsWith('CRS-NEW')).length + 1).padStart(2, '0')}`;
    s.courses.push({ id, exodeId: null, direction: direction || 'KOR', title: title.trim(), hours: Number(hours) || 4, summary: summary || '', status: 'draft', components: [], rules: [] });
    log(s, actor, 'Kurs qoralamasi yaratildi', id, { after: title });
  });
}

export function updateCourse(state, { id, patch, actor = 'HR/L&D' }) {
  return mutate(state, (s) => {
    const c = getCourse(s, id);
    if (!c) fail('Kurs topilmadi');
    if (c.status !== 'draft') fail('Faqat qoralama kurs tahrirlanadi (faol kursning yangi versiyasini oching)');
    patch(c);
    log(s, actor, 'Kurs tahrirlandi', id);
  });
}

export function publishCourse(state, { id, actor = 'HR/L&D' }) {
  return mutate(state, (s) => {
    const c = getCourse(s, id);
    const errs = validateCourse(s, c);
    if (errs.length) fail(`Kurs e’lon qilinmadi: ${errs.slice(0, 3).join('; ')}`);
    c.status = 'active';
    log(s, actor, 'Kurs faollashtirildi', id);
  });
}

// ---------------------------------------------------------------------------
// Ustozlar natijalari: 1-oy konversiyasi va oylik retention.
// Chegara bajarilmasa — mos kurs avtomatik majburiy biriktiriladi; ustoz va mas'ul shaxsga xabar.
// ---------------------------------------------------------------------------
export const KPI_METRICS = {
  conversion: {
    label: '1-oy konversiyasi',
    hint: 'Shu oy yangi kelgan o‘quvchilardan nechtasi keyingi oyga ham qoldi (to‘lov qildi).',
    calc: (r) => ({ num: r.stayedNew, base: r.newStudents }),
    text: (v) => `${v.num} / ${v.base} yangi o‘quvchi qoldi`,
  },
  retention: {
    label: 'Oylik retention',
    hint: 'Oy boshidagi o‘quvchilardan nechtasi oy oxirida qoldi. Shu oy yangi kelganlar kirmaydi; kursni bitirganlar ketgan hisoblanmaydi.',
    calc: (r) => ({ num: r.start - r.graduated - r.left, base: r.start - r.graduated }),
    text: (v) => `${v.base} dan ${v.num} tasi qoldi (${v.base - v.num} ketdi)`,
  },
};
const MONTHS_UZ = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'];
export const monthName = (m) => `${MONTHS_UZ[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
const prevMonth = (m) => { const y = Number(m.slice(0, 4)); const mm = Number(m.slice(5, 7)); return mm === 1 ? `${y - 1}-12` : `${y}-${String(mm - 1).padStart(2, '0')}`; };

export function kpiResult(s, employeeId, month) {
  const row = (s.kpiResults || []).find((r) => r.employeeId === employeeId && r.month === month) || null;
  return row && kpiUnmeasured(s, getEmployee(s, employeeId), month) ? { ...row, unmeasured: true } : row;
}
/** Ishga kirgan sana: `hiredAt`, bo'lmasa birinchi lavozim tarixi. */
export const hireDate = (emp) => emp?.hiredAt || emp?.history?.[0]?.from || emp?.levelSince || null;
/** TZ: ishga kirgandan keyingi 30 kun KPI hisoblanmaydi. Oy oxirida 30 kun to'lmagan bo'lsa — «O'lchanmagan». */
export function kpiUnmeasured(s, emp, month) {
  const h = hireDate(emp);
  if (!h) return false;
  const [y, m] = month.split('-').map(Number);
  const monthEnd = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  return addDays(h, 30) > monthEnd;
}
/** Bitta ko'rsatkich qiymati; asos juda kichik bo'lsa — baholanmaydi (tasodifiy tebranish). */
export function kpiValue(row, rule) {
  if (!row) return null;
  const v = KPI_METRICS[rule.metric].calc(row);
  if (row.unmeasured) return { ...v, pct: v.base > 0 ? (100 * v.num) / v.base : null, few: false, unmeasured: true, below: false };
  const pct = v.base > 0 ? (100 * v.num) / v.base : null;
  const few = v.base < (rule.minBase || 1);
  return { ...v, pct, few, below: !few && pct !== null && pct < rule.min };
}
export function kpiRulesFor(s, emp) {
  return (s.kpiRules || []).filter((r) => r.position === emp.position);
}
export function kpiSupervisor(s, emp) {
  return emp.supervisorId ? getEmployee(s, emp.supervisorId) : null;
}
export function kpiMonths(s) {
  return [...new Set((s.kpiResults || []).map((r) => r.month))].sort();
}
/** Ketma-ket `rule.months` oy chegaradan past bo'lsa — chora kerak. */
function kpiBelowStreak(s, employeeId, month, rule) {
  let m = month;
  for (let i = 0; i < (rule.months || 1); i += 1) {
    if (!kpiValue(kpiResult(s, employeeId, m), rule)?.below) return false;
    m = prevMonth(m);
  }
  return true;
}

function applyKpiRules(s, employeeId, month, actor) {
  const emp = getEmployee(s, employeeId);
  const sup = kpiSupervisor(s, emp);
  for (const rule of kpiRulesFor(s, emp)) {
    if (s.kpiActions.some((a) => a.employeeId === employeeId && a.ruleId === rule.id && a.month === month && a.kind !== 'note')) continue;
    const val = kpiValue(kpiResult(s, employeeId, month), rule);
    const metric = KPI_METRICS[rule.metric].label;
    const base = { id: nextId(s, 'ka'), employeeId, ruleId: rule.id, month, value: val?.pct ?? null, min: rule.min, at: s.today, by: actor };
    if (!kpiBelowStreak(s, employeeId, month, rule)) {
      const prev = s.kpiActions.find((a) => a.employeeId === employeeId && a.ruleId === rule.id && a.month === prevMonth(month) && ['course', 'already', 'repeat'].includes(a.kind));
      if (prev && val && !val.below && !val.few) s.kpiActions.unshift({ ...base, kind: 'improved' });
      continue;
    }
    const course = getCourse(s, rule.courseId);
    const open = s.enrollments.find((e) => e.employeeId === employeeId && e.courseId === rule.courseId && e.status !== 'completed');
    const doneBefore = s.enrollments.find((e) => e.employeeId === employeeId && e.courseId === rule.courseId && e.status === 'completed' && e.mandatory?.ruleId === rule.id);
    const pct = `${val.pct.toFixed(1).replace('.', ',')}%`;
    if (open) {
      open.mandatory = open.mandatory || { ruleId: rule.id, month, value: val.pct, min: rule.min, deadline: addDays(s.today, 30) };
      s.kpiActions.unshift({ ...base, kind: 'already', enrollmentId: open.id });
      if (sup) notify(s, `kpi:${base.id}:sup`, sup.name, `${emp.name}: ${metric} ${monthName(month)} — ${pct} (chegara ${rule.min}%). «${course.title}» kursi hali yakunlanmagan, muddat ${open.mandatory.deadline}.`);
    } else if (doneBefore) {
      s.kpiActions.unshift({ ...base, kind: 'repeat', enrollmentId: doneBefore.id });
      if (sup) notify(s, `kpi:${base.id}:sup`, sup.name, `${emp.name}: ${metric} kurs yakunlangandan keyin ham past (${pct}). Individual reja va dars kuzatuvi kerak.`);
    } else {
      const id = nextId(s, 'enr');
      const deadline = addDays(s.today, 30);
      s.enrollments.push({ id, employeeId, courseId: rule.courseId, pathId: null, by: 'kpi', startedAt: s.today, status: 'in_progress', progress: {}, applied: [],
        mandatory: { ruleId: rule.id, month, value: val.pct, min: rule.min, deadline } });
      s.kpiActions.unshift({ ...base, kind: 'course', enrollmentId: id });
      notify(s, `kpi:${base.id}`, emp.name, `${monthName(month)}: ${metric} ${pct} — chegara ${rule.min}%. Sizga «${course.title}» kursi majburiy biriktirildi, muddat ${deadline}.`);
      if (sup) notify(s, `kpi:${base.id}:sup`, sup.name, `${emp.name}ga «${course.title}» majburiy kursi biriktirildi: ${metric} ${pct} (chegara ${rule.min}%).`);
    }
    log(s, actor, 'KPI chorasi', `${employeeId} · ${rule.id} · ${month}`, { value: val.pct, min: rule.min });
  }
}

function validKpiRow(r) {
  const n = ['newStudents', 'stayedNew', 'start', 'graduated', 'left'];
  for (const k of n) if (!Number.isInteger(Number(r[k])) || Number(r[k]) < 0) fail('Barcha sonlar butun va manfiy emas bo‘lishi kerak');
  if (Number(r.stayedNew) > Number(r.newStudents)) fail('Qolgan yangi o‘quvchilar yangi kelganlardan ko‘p bo‘lishi mumkin emas');
  if (Number(r.graduated) + Number(r.left) > Number(r.start)) fail('Bitirgan + ketgan oy boshidagi o‘quvchilardan ko‘p bo‘lishi mumkin emas');
}

/** Exode LMS oylik hisobotini olish (demo: tayyor hisobot) va qoidalarni qo'llash. */
export function importKpiMonth(state, { month, actor = 'Exode LMS (avtomatik)' }) {
  return mutate(state, (s) => {
    const inbox = s.kpiInbox?.[month];
    if (!inbox) fail('Bu oy uchun hisobot topilmadi');
    for (const r of inbox.rows) {
      validKpiRow(r);
      s.kpiResults = s.kpiResults.filter((x) => !(x.employeeId === r.employeeId && x.month === month));
      s.kpiResults.push({ ...r, month, source: inbox.source });
    }
    delete s.kpiInbox[month];
    log(s, actor, 'Oylik natijalar olindi', month, { rows: inbox.rows.length });
    for (const r of inbox.rows) applyKpiRules(s, r.employeeId, month, actor);
  });
}

/** Bitta ustoz natijasini qo'lda kiritish yoki tuzatish. */
export function saveKpiResult(state, { employeeId, month, actor = 'HR/L&D', ...nums }) {
  return mutate(state, (s) => {
    const emp = getEmployee(s, employeeId);
    if (!emp) fail('Xodim topilmadi');
    if (!/^\d{4}-\d{2}$/.test(month || '')) fail('Oy tanlanmagan');
    const row = Object.fromEntries(['newStudents', 'stayedNew', 'start', 'graduated', 'left'].map((k) => [k, Number(nums[k])]));
    validKpiRow(row);
    s.kpiResults = s.kpiResults.filter((x) => !(x.employeeId === employeeId && x.month === month));
    s.kpiResults.push({ employeeId, month, ...row, source: `Qo‘lda: ${actor}` });
    log(s, actor, 'Oylik natija kiritildi', `${employeeId} · ${month}`, row);
    applyKpiRules(s, employeeId, month, actor);
  });
}

export function updateKpiRule(state, { id, min, months, courseId, actor = 'HR/L&D' }) {
  return mutate(state, (s) => {
    const r = s.kpiRules.find((x) => x.id === id);
    if (!r) fail('Qoida topilmadi');
    const m = Number(min);
    if (!(m > 0 && m <= 100)) fail('Chegara 1–100% oralig‘ida bo‘lishi kerak');
    if (!getCourse(s, courseId) || getCourse(s, courseId).status !== 'active') fail('Faol kurs tanlang');
    const before = { min: r.min, months: r.months, courseId: r.courseId };
    Object.assign(r, { min: m, months: Math.max(1, Number(months) || 1), courseId });
    log(s, actor, 'KPI qoidasi o‘zgardi', id, { before, after: { min: r.min, months: r.months, courseId } });
  });
}

/** Mas'ul shaxsning nazorat izohi (suhbat, dars kuzatuvi, kelishuv). */
export function addKpiNote(state, { employeeId, text, by }) {
  return mutate(state, (s) => {
    if (!String(text || '').trim()) fail('Izoh bo‘sh');
    s.kpiActions.unshift({ id: nextId(s, 'ka'), employeeId, kind: 'note', text: text.trim(), by, at: s.today, month: kpiMonths(s).at(-1) });
    const emp = getEmployee(s, employeeId);
    if (by !== emp.name) notify(s, `kpinote:${s.seq}`, emp.name, `${by} natijalaringiz bo‘yicha izoh qoldirdi: «${text.trim()}»`);
    log(s, by, 'Nazorat izohi', employeeId);
  });
}

// ---------------------------------------------------------------------------
// Ko'nikmalar (skills): aniq vosita va texnologiyalarni bilish — kompetensiya modelidan alohida.
// Kompetensiyani to'ldiradi (supports), lekin lavozimga moslik hisobiga kirmaydi.
// Manba: xodim o'zi belgilaydi (tasdiqlanmagan), dalil bilan — mentor/HR tasdiqlaydi, kurs — avtomatik tasdiqlangan.
// ---------------------------------------------------------------------------
export const SKILL_LEVELS = {
  1: ['Boshlang‘ich', 'Asosiy funksiyalardan ko‘rsatma yoki namuna bilan foydalanadi.'],
  2: ['Amaliy', 'Ishda mustaqil va muntazam foydalanadi, natijasi ko‘rinadi.'],
  3: ['Ilg‘or', 'Boshqalarga o‘rgatadi, jarayonni shu vosita bilan yaxshilaydi.'],
};
export const SKILL_GROUPS = {
  ai: 'Sun’iy intellekt',
  collab: 'Hamkorlik va vazifa boshqaruvi',
  data: 'Ma’lumot va tahlil',
  edu: 'Ta’lim vositalari',
  biz: 'Sotuv va mijoz tizimlari',
};
export const getSkill = (s, id) => (s.skillCatalog || []).find((k) => k.id === id);
export const empSkill = (s, employeeId, skillId) => (s.empSkills || []).find((x) => x.employeeId === employeeId && x.skillId === skillId) || null;
/** Lavozim (profil) uchun tavsiya etilgan ko'nikmalar. */
export const skillProfile = (s, code) => (s.skillProfiles || {})[code] || [];

function awardSkill(s, emp, skillId, level, source, actor) {
  let r = empSkill(s, emp.id, skillId);
  if (r && r.status === 'confirmed' && r.level >= level) return;
  if (!r) { r = { id: nextId(s, 'sk'), employeeId: emp.id, skillId }; s.empSkills.push(r); }
  Object.assign(r, { level, status: 'confirmed', source, at: s.today });
  if (r.claim && r.claim.level <= level) r.claim = null;
  notify(s, `skill:${r.id}:${level}`, emp.name, `Ko‘nikma tasdiqlandi: ${getSkill(s, skillId).name} — ${SKILL_LEVELS[level][0]} (${source}).`);
  log(s, actor, 'Ko‘nikma tasdiqlandi', `${emp.id} · ${skillId}`, { after: String(level), reason: source });
}

/** Xodim ko'nikmasini belgilaydi. Dalil bo'lsa — tasdiqlashga yuboriladi. */
export function declareSkill(state, { employeeId, skillId, level, evidence = '', link = '' }) {
  return mutate(state, (s) => {
    const emp = getEmployee(s, employeeId);
    const skill = getSkill(s, skillId);
    if (!emp || !skill) fail('Xodim yoki ko‘nikma topilmadi');
    const lvl = Number(level);
    if (!SKILL_LEVELS[lvl]) fail('Darajani tanlang');
    let r = empSkill(s, employeeId, skillId);
    const hasEv = String(evidence).trim().length > 0;
    if (r?.status === 'confirmed' && lvl <= r.level) fail('Bu daraja allaqachon tasdiqlangan');
    if (r?.status === 'confirmed' && !hasEv) fail('Tasdiqlangan darajani oshirish uchun dalil kerak');
    if (!r) { r = { id: nextId(s, 'sk'), employeeId, skillId, level: lvl, status: 'self', source: 'O‘zi belgilagan', at: s.today }; s.empSkills.push(r); }
    else if (r.status !== 'confirmed') Object.assign(r, { level: lvl, at: s.today });
    if (hasEv) r.claim = { level: lvl, evidence: evidence.trim(), link, at: s.today };
    log(s, emp.name, hasEv ? 'Ko‘nikma tasdiqlashga yuborildi' : 'Ko‘nikma belgilandi', `${employeeId} · ${skillId}`, { after: String(lvl) });
  });
}

export function reviewSkill(state, { id, decision, level, note = '', by = 'Mentor' }) {
  return mutate(state, (s) => {
    const r = s.empSkills.find((x) => x.id === id);
    if (!r?.claim) fail('Tasdiqlash so‘rovi topilmadi');
    if (!String(note).trim()) fail('Izoh majburiy');
    const emp = getEmployee(s, r.employeeId);
    const skill = getSkill(s, r.skillId);
    if (decision === 'confirmed') {
      const lvl = Number(level || r.claim.level);
      if (lvl > r.claim.level) fail('Xodim so‘ragan darajadan yuqori tasdiqlab bo‘lmaydi');
      r.review = { by, at: s.today, note, decision };
      r.claim = null;
      awardSkill(s, emp, r.skillId, lvl, `Tasdiqladi: ${by}`, by);
    } else {
      r.review = { by, at: s.today, note, decision: 'rejected', level: r.claim.level };
      r.claim = null;
      notify(s, `skillrej:${r.id}:${s.seq}`, emp.name, `«${skill.name}» tasdiqlanmadi: ${note}`);
      log(s, by, 'Ko‘nikma tasdiqlanmadi', `${emp.id} · ${r.skillId}`, { reason: note });
    }
  });
}

export function createSkill(state, { name, group, description = '', supports = [], actor = 'HR/L&D' }) {
  return mutate(state, (s) => {
    if (!String(name || '').trim()) fail('Nomi majburiy');
    if (!SKILL_GROUPS[group]) fail('Guruhni tanlang');
    if (s.skillCatalog.some((k) => k.name.toLowerCase() === name.trim().toLowerCase())) fail('Bunday ko‘nikma bor');
    const n = s.skillCatalog.filter((k) => k.group === group).length + 1;
    const id = `SK-${group.toUpperCase()}-${String(n).padStart(2, '0')}${s.skillCatalog.some((k) => k.id === `SK-${group.toUpperCase()}-${String(n).padStart(2, '0')}`) ? `-${s.seq}` : ''}`;
    s.skillCatalog.push({ id, name: name.trim(), group, description: description.trim(), supports });
    log(s, actor, 'Ko‘nikma qo‘shildi', id);
  });
}

/** Lavozim uchun tavsiya etilgan ko'nikma: level null — olib tashlash. */
export function setSkillProfile(state, { profileCode, skillId, level, actor = 'HR/L&D' }) {
  return mutate(state, (s) => {
    if (!getSkill(s, skillId)) fail('Ko‘nikma topilmadi');
    const list = (s.skillProfiles[profileCode] ||= []);
    const i = list.findIndex((x) => x.skillId === skillId);
    if (level === null || level === undefined || level === '') { if (i >= 0) list.splice(i, 1); }
    else if (i >= 0) list[i].level = Number(level);
    else list.push({ skillId, level: Number(level) });
    log(s, actor, 'Lavozim ko‘nikmasi', `${profileCode} · ${skillId}`, { after: String(level ?? '—') });
  });
}

// ---------------------------------------------------------------------------
// Onboarding (TZ): Jobster ATS → Edu → RegUP. Kartochka integratsiyadan ochiladi,
// 30 kunlik moslashuv dasturi, yakuniy 1–5 baho (filial rahbari tasdiqlaydi), badge.
// Arxivlash va reboarding, CEO/HRD uchrashuvlari, eslatmalar, rollar.
// ---------------------------------------------------------------------------
export const ONB_DAYS = 30;
export const daysBetween = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
export { addDays };
export const activeEmployees = (s) => s.employees.filter((e) => e.status !== 'archived');
export const ONB_STAGES = [['induction', 'Induction', 0], ['d8', 'D8', 8], ['d30', 'D30', 30]];
export const onbStage = (day) => (day >= 30 ? 'd30' : day >= 8 ? 'd8' : 'induction');
export const getOnboarding = (s, id) => (s.onboardings || []).find((o) => o.id === id);
export const onboardingOf = (s, employeeId) => (s.onboardings || []).filter((o) => o.employeeId === employeeId).at(-1) || null;
export const onbProgram = (s, emp) => (s.onboardingPrograms || []).find((p) => p.position === emp.position) || null;
export const onbDay = (s, ob) => daysBetween(ob.startedAt, s.today);
export const onbLateDays = (ob) => daysBetween(ob.startedAt, ob.enteredAt);
export const onbEnrollments = (s, ob) => (s.enrollments || []).filter((e) => e.onboardingId === ob.id);
export const onbObservations = (s, ob) => (s.observations || []).filter((o) => o.employeeId === ob.employeeId && o.date >= ob.startedAt);
export const getStaff = (s, id) => (s.staff || []).find((u) => u.id === id);
export const branchHead = (s, branchId) => (s.staff || []).find((u) => u.role === 'branch' && u.branchIds.includes(branchId)) || null;
export const enrDeadline = (enr) => enr.deadline || enr.mandatory?.deadline || null;

/** Test foizi → 1–5 ball (Q1 taklifi; admin metodologiyani keyin almashtiradi). */
export const testBall = (pct) => (pct >= 90 ? 5 : pct >= 75 ? 4 : pct >= 60 ? 3 : pct >= 40 ? 2 : 1);
export const ONB_LABEL = (v) => (v === null ? '—' : v >= 4.5 ? 'A’lo' : v >= 3.5 ? 'Yaxshi' : v >= 2.5 ? 'Qoniqarli' : 'Past');
export const ONB_PARTS = {
  courses: ['Kurslarni muddatida yakunlash', 'Barcha kurslar muddatida yakunlansa — 5, hech biri — 1'],
  tests: ['Testlar', 'Eng yaxshi natija: 90%+ → 5, 75–89 → 4, 60–74 → 3, 40–59 → 2, past → 1'],
  tasks: ['Amaliy topshiriqlar', 'Mentor yoki kurator qo‘ygan 1–5 baho'],
  obs: ['Dars kuzatuvi (observation)', 'Metodist checklisti, 1–5 ball o‘rtachasi (faqat ustozlar)'],
};
const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const r1 = (v) => (v === null ? null : Math.round(v * 10) / 10);
export const obsMean = (o) => avg(Object.values(o.ratings).map(Number));

/** Moslashuv natijasi: komponentlar, yakuniy ball, tayyorlik va badge sharti. */
export function onboardingScore(s, ob) {
  const emp = getEmployee(s, ob.employeeId);
  const prog = onbProgram(s, emp);
  const enrs = onbEnrollments(s, ob);
  const tests = [];
  const tasks = [];
  let onTime = 0;
  let due = 0; // muddati kelgan yoki yakunlangan kurslar — hali muddati bor kurs jazolanmaydi
  for (const enr of enrs) {
    const course = getCourse(s, enr.courseId);
    for (const c of course.components) {
      const p = enr.progress[c.id];
      if (c.kind === 'test' && isNum(p?.best)) tests.push(testBall(p.best));
      if (c.kind === 'task' && p?.status === 'accepted' && isNum(p.mentor?.grade)) tasks.push(p.mentor.grade);
    }
    if (enr.status === 'completed' || (enr.deadline && enr.deadline < s.today)) due += 1;
    if (enr.status === 'completed' && (!enr.deadline || enr.completedAt <= enr.deadline)) onTime += 1;
  }
  const obs = onbObservations(s, ob);
  const needObs = prog?.observations || 0;
  const vals = {
    courses: due ? 1 + (4 * onTime) / due : null,
    tests: avg(tests),
    tasks: avg(tasks),
    obs: needObs ? avg(obs.map(obsMean)) : null,
  };
  const w = s.onboardingConfig.weights;
  const parts = Object.keys(ONB_PARTS).filter((k) => k !== 'obs' || needObs).map((k) => ({ key: k, label: ONB_PARTS[k][0], hint: ONB_PARTS[k][1], value: r1(vals[k]), weight: w[k] }));
  const used = parts.filter((p) => p.value !== null && p.weight > 0);
  const tw = used.reduce((a, p) => a + p.weight, 0);
  const score = tw ? r1(used.reduce((a, p) => a + p.value * p.weight, 0) / tw) : null;
  const coursesDone = enrs.filter((e) => e.status === 'completed').length;
  const ready = enrs.length > 0 && coursesDone === enrs.length && obs.length >= needObs;
  return { parts, score, label: ONB_LABEL(score), ready, coursesDone, courses: enrs.length, obs: obs.length, needObs, badge: ready && score !== null && score >= s.onboardingConfig.badgeMin };
}

function onbNotify(s, key, to, text) {
  if (notify(s, key, to, text)) s.notifications[0].tg = true;
}

/** Lavozim dasturi bo'yicha moslashuv kurslarini biriktiradi (reboarding'da avvalgi natijalar tiklanadi). */
function startOnboarding(s, emp, { startedAt, enteredAt, source, reboarding = false, actor }) {
  const prog = onbProgram(s, emp);
  const id = nextId(s, 'onb');
  const deadline = addDays(startedAt, ONB_DAYS);
  const ob = { id, employeeId: emp.id, startedAt, enteredAt, source, status: 'active', reboarding, survey: { d8: null, d30: null }, final: null, restored: [] };
  s.onboardings.push(ob);
  for (const cid of prog?.courses || []) {
    const course = getCourse(s, cid);
    const prev = s.enrollments.filter((e) => e.employeeId === emp.id && e.courseId === cid).at(-1);
    const sameVersion = prev && (prev.courseVersion || 1) === (course.version || 1);
    if (reboarding && prev && sameVersion && prev.status === 'completed') {
      prev.onboardingId = id;
      ob.restored.push({ courseId: cid, kind: 'restored', text: `«${course.title}» — avvalgi natija tiklandi (v${course.version || 1})` });
      continue;
    }
    if (reboarding && prev && sameVersion && prev.status === 'archived') {
      Object.assign(prev, { status: 'in_progress', onboardingId: id, deadline });
      ob.restored.push({ courseId: cid, kind: 'resumed', text: `«${course.title}» — to‘xtagan joyidan davom etadi` });
      continue;
    }
    if (reboarding && prev) ob.restored.push({ courseId: cid, kind: 'retake', text: `«${course.title}» yangilangan (v${prev.courseVersion || 1} → v${course.version}) — qayta o‘qish shart` });
    s.enrollments.push({ id: nextId(s, 'enr'), employeeId: emp.id, courseId: cid, pathId: null, by: 'onboarding', onboardingId: id, startedAt: enteredAt, deadline, courseVersion: course.version || 1, status: 'in_progress', progress: {}, applied: [] });
  }
  const n = (prog?.courses || []).length;
  onbNotify(s, `onb:${id}`, emp.name, reboarding
    ? `Qaytganingiz bilan! Reboarding boshlandi: ${ob.restored.filter((r) => r.kind === 'restored').length} kurs natijasi tiklandi, ${ob.restored.filter((r) => r.kind === 'retake').length} ta yangilangan kursni qayta o‘qish kerak. Muddat ${deadline}.`
    : `Registon Academy’ga xush kelibsiz! 30 kunlik moslashuv dasturi boshlandi: ${n} ta kurs, muddat ${deadline}.`);
  const mentor = emp.supervisorId ? getEmployee(s, emp.supervisorId) : null;
  if (mentor) onbNotify(s, `onb:${id}:mentor`, mentor.name, `${emp.name} (${emp.currentLevel}) sizga moslashuv uchun biriktirildi. Muddat ${deadline}.`);
  log(s, actor, reboarding ? 'Reboarding boshlandi' : 'Moslashuv dasturi boshlandi', `${emp.id} · ${id}`, { courses: n });
  return ob;
}

function hrResult(s, ev, tone, text, employeeId = null) {
  s.hrLog.unshift({ id: nextId(s, 'hl'), eventId: ev.id, type: ev.type, at: s.today, tone, text, employeeId, who: ev.payload.name || getEmployee(s, ev.payload.employeeId)?.name });
}

function applyHrEvent(s, ev, actor) {
  const p = ev.payload;
  if (ev.type === 'hire') {
    if (p.department === 'Markaz admini') return hrResult(s, ev, 'muted', 'O‘tkazib yuborildi: «Markaz admini» — korporativ raqam bir nechta xodimga berilishi mumkin, kartochka ochilmaydi.');
    const dup = s.employees.find((e) => e.phone && e.phone === p.phone);
    if (dup) return hrResult(s, ev, 'bad', `Xato: ${p.phone} raqami bilan xodim bor (${dup.name}). Qaytgan xodim bo‘lsa — «qayta ishga kirish» hodisasi kerak.`);
    const id = nextId(s, 'e');
    const emp = { id, name: p.name, position: p.position, currentLevel: p.level, branchId: p.branchId, phone: p.phone, jobsterId: p.jobsterId, eduId: p.eduId, source: p.source,
      hiredAt: p.startedAt, levelSince: p.startedAt, kpi10m: null, status: 'active', supervisorId: (s.onboardingConfig.mentors || {})[`${p.position}:${p.branchId}`] || null,
      history: [{ level: p.level, from: p.startedAt, doc: `Jobster ATS · ${p.jobsterId}` }], records: {} };
    s.employees.push(emp);
    const ob = startOnboarding(s, emp, { startedAt: p.startedAt, enteredAt: s.today, source: p.source, actor });
    const late = onbLateDays(ob);
    if (late >= s.onboardingConfig.lateDays) {
      const head = branchHead(s, p.branchId);
      onbNotify(s, `late:${ob.id}`, s.staff.find((u) => u.role === 'hr')?.name || 'HR Admin', `${emp.name} (${getBranch(s, p.branchId)?.name}) ish boshlaganidan ${late} kun keyin tizimga kiritildi.`);
      if (head) onbNotify(s, `late:${ob.id}:head`, head.name, `${emp.name} ish boshlaganidan ${late} kun keyin tizimga kiritildi — xodimni birinchi kunida kiriting.`);
    }
    return hrResult(s, ev, late >= s.onboardingConfig.lateDays ? 'warn' : 'good', `Kartochka ochildi, ${onbEnrollments(s, ob).length} ta moslashuv kursi biriktirildi${late >= s.onboardingConfig.lateDays ? `. Kech kiritildi: ${late} kun` : ''}.`, id);
  }
  const emp = getEmployee(s, p.employeeId);
  if (!emp) return hrResult(s, ev, 'bad', 'Xato: xodim topilmadi.');
  if (ev.type === 'archive') {
    if (emp.status === 'archived') return hrResult(s, ev, 'muted', 'Allaqachon arxivda.', emp.id);
    Object.assign(emp, { status: 'archived', archivedAt: s.today, leftAt: p.leftAt, archiveReason: p.reason, eduArchiveAt: addDays(p.leftAt, p.eduWaitDays) });
    for (const ob of s.onboardings.filter((o) => o.employeeId === emp.id && o.status === 'active')) ob.status = 'archived';
    for (const e of s.enrollments.filter((x) => x.employeeId === emp.id && x.status === 'in_progress')) e.status = 'archived';
    log(s, actor, 'Xodim arxivlandi', emp.id, { reason: p.reason });
    return hrResult(s, ev, 'warn', `RegUP: arxivlandi, ma’lumotlari saqlandi. Edu: kutish rejimi, ${emp.eduArchiveAt} da avtomatik arxivlanadi.`, emp.id);
  }
  if (ev.type === 'return') {
    if (emp.status !== 'archived') return hrResult(s, ev, 'bad', 'Xato: xodim arxivda emas.', emp.id);
    Object.assign(emp, { status: 'active', reboarding: true, rehiredAt: p.startedAt, branchId: p.branchId || emp.branchId, archivedAt: null });
    emp.history.push({ level: emp.currentLevel, from: p.startedAt, doc: 'Qayta ishga kirish (reboarding)' });
    const ob = startOnboarding(s, emp, { startedAt: p.startedAt, enteredAt: s.today, source: p.source || 'recruiting', reboarding: true, actor });
    return hrResult(s, ev, 'good', `Edu’da arxivdan chiqarildi → RegUP’da avtomatik tiklandi. ${ob.restored.map((r) => r.text).join('; ')}.`, emp.id);
  }
  return hrResult(s, ev, 'bad', 'Noma’lum hodisa');
}

/** Integratsiya navbatidagi hodisalarni qabul qilish (bitta yoki hammasi). */
export function processHrInbox(state, { id = null, actor = 'Integratsiya (Jobster → Edu → RegUP)' } = {}) {
  return mutate(state, (s) => {
    const list = s.hrInbox.filter((e) => !id || e.id === id);
    if (!list.length) fail('Navbatda hodisa yo‘q');
    for (const ev of list) applyHrEvent(s, ev, actor);
    s.hrInbox = s.hrInbox.filter((e) => !list.includes(e));
  });
}

/** Filial rahbari (yoki HR) 30 kunlik yakuniy bahoni tasdiqlaydi. Kuzatuv o'rtachalari kompetensiyaga yoziladi. */
export function approveOnboarding(state, { id, userId = 'u-super' }) {
  return mutate(state, (s) => {
    const ob = getOnboarding(s, id);
    if (!ob || ob.status !== 'active') fail('Faol moslashuv topilmadi');
    const emp = getEmployee(s, ob.employeeId);
    const user = getStaff(s, userId);
    const head = branchHead(s, emp.branchId);
    if (!user || !(['super', 'hr'].includes(user.role) || (user.role === 'branch' && user.branchIds.includes(emp.branchId)))) fail('Yakuniy bahoni xodimning filial rahbari tasdiqlaydi');
    const r = onboardingScore(s, ob);
    if (!r.ready && onbDay(s, ob) < ONB_DAYS) fail(`Hali erta: ${onbDay(s, ob)}-kun, kurslar ${r.coursesDone}/${r.courses}${r.needObs ? `, kuzatuv ${r.obs}/${r.needObs}` : ''}`);
    ob.status = 'completed';
    ob.final = { score: r.score, label: r.label, badge: r.badge, ready: r.ready, parts: r.parts, by: user.name, at: s.today, byRole: user.role === 'branch' ? 'Filial rahbari' : head ? user.title : `${user.title} (filial rahbari vakant)` };
    const obs = onbObservations(s, ob);
    const codes = [...new Set(obs.flatMap((o) => Object.keys(o.ratings)))];
    for (const code of codes) {
      const lv = Math.round(avg(obs.map((o) => Number(o.ratings[code])).filter(isNum)));
      emp.records[code] = [...(emp.records[code] || []), { level: lv, context: 'work', source: `Moslashuv: dars kuzatuvlari (${obs.length}), ${user.name} tasdig‘i`, date: s.today }];
    }
    onbNotify(s, `onb-done:${id}`, emp.name, r.badge
      ? `Moslashuv dasturi yakunlandi: ${String(r.score).replace('.', ',')} / 5 (${r.label}). Sizga «Moslashuv yakunlandi» badge’i berildi!`
      : `Moslashuv dasturi yakunlandi: ${r.score === null ? '—' : String(r.score).replace('.', ',')} / 5 (${r.label}). Badge sharti bajarilmadi — mentoringiz bilan rivojlanish rejasi tuziladi.`);
    log(s, user.name, 'Moslashuv yakuniy bahosi tasdiqlandi', `${emp.id} · ${id}`, { after: String(r.score), badge: r.badge });
  });
}

export function setOnboardingWeights(state, { weights, badgeMin, actor = 'HR/L&D' }) {
  return mutate(state, (s) => {
    const w = Object.fromEntries(Object.keys(ONB_PARTS).map((k) => [k, Number(weights[k])]));
    if (Object.values(w).some((v) => !(v >= 0 && v <= 100))) fail('Og‘irlik 0–100 oralig‘ida');
    if (!Object.values(w).some((v) => v > 0)) fail('Kamida bitta komponent og‘irligi 0 dan katta bo‘lsin');
    const b = Number(badgeMin);
    if (!(b >= 1 && b <= 5)) fail('Badge chegarasi 1–5');
    const before = { ...s.onboardingConfig.weights, badgeMin: s.onboardingConfig.badgeMin };
    Object.assign(s.onboardingConfig, { weights: w, badgeMin: b });
    log(s, actor, 'Moslashuv baholash og‘irliklari', 'onboarding', { before, after: { ...w, badgeMin: b } });
  });
}

/** Metodist kuzatuvi (checklist, 1–5). */
export function addOnbObservation(state, { employeeId, methodist, date, lesson, group, ratings, note, userId }) {
  return mutate(state, (s) => {
    const emp = getEmployee(s, employeeId);
    if (!emp || emp.status === 'archived') fail('Xodim topilmadi');
    const user = userId ? getStaff(s, userId) : null;
    if (user && !(['super', 'hr'].includes(user.role) || (user.role === 'methodist' && user.positions.includes(emp.position)))) fail('Kuzatuvni metodist kiritadi');
    const r = Object.fromEntries(Object.entries(ratings || {}).filter(([, v]) => v !== '' && v !== null && v !== undefined).map(([k, v]) => [k, Number(v)]));
    if (Object.keys(r).length < 3) fail('Checklistdan kamida 3 bandni baholang');
    if (Object.values(r).some((v) => !(Number.isInteger(v) && v >= 1 && v <= 5))) fail('Ball 1–5');
    if (!String(note || '').trim()) fail('Kuzatuv xulosasi majburiy');
    if (!date || date > s.today) fail('Sana bugundan keyin bo‘lmasin');
    const id = nextId(s, 'obs');
    s.observations.push({ id, employeeId, methodist: methodist || user?.name || 'Metodist', date, lesson: lesson || '—', group: group || '—', ratings: r, note: note.trim() });
    onbNotify(s, `obs:${id}`, emp.name, `Darsingiz kuzatildi (${methodist || user?.name}): o‘rtacha ${String(r1(avg(Object.values(r)))).replace('.', ',')} / 5. ${note.trim()}`);
    log(s, methodist || 'Metodist', 'Dars kuzatuvi (moslashuv)', `${employeeId} · ${id}`);
  });
}

// ---------- Rollar ----------
export const ROLE_LABEL = { super: 'Super Admin', hr: 'HR Admin', branch: 'Filial rahbari', mentor: 'Mentor', methodist: 'Metodist', curator: 'Kurator' };
/** Rol ko'radigan xodimlar (null — hammasi). */
export function scopeEmployees(s, user) {
  if (!user || ['super', 'hr'].includes(user.role)) return null;
  if (user.role === 'branch') return new Set(s.employees.filter((e) => user.branchIds.includes(e.branchId)).map((e) => e.id));
  if (user.role === 'mentor') return new Set(s.employees.filter((e) => e.supervisorId === user.employeeId).map((e) => e.id));
  if (user.role === 'methodist') return new Set(s.employees.filter((e) => user.positions.includes(e.position)).map((e) => e.id));
  if (user.role === 'curator') return new Set(s.enrollments.filter((e) => user.courseIds.includes(e.courseId)).map((e) => e.employeeId));
  return new Set();
}
/** Bitta topshiriqni bitta mas'ul tekshiradi: kursda kurator bo'lsa — kurator, aks holda xodim mentori (K4). */
export function taskReviewer(s, enr) {
  const course = getCourse(s, enr.courseId);
  if (course.curatorId) return { kind: 'curator', user: getStaff(s, course.curatorId) };
  const emp = getEmployee(s, enr.employeeId);
  const mentor = emp.supervisorId ? s.staff.find((u) => u.role === 'mentor' && u.employeeId === emp.supervisorId) : null;
  return mentor ? { kind: 'mentor', user: mentor } : { kind: 'hr', user: null };
}
export function canReviewTask(s, user, enr) {
  if (!user) return false;
  if (['super', 'hr'].includes(user.role)) return true;
  return taskReviewer(s, enr).user?.id === user.id;
}

// ---------- Uchrashuvlar (CEO/HRD va bilim almashish) ----------
export function createMeeting(state, { title, kind = 'share', date, time, format, link, place, organizer, actor }) {
  return mutate(state, (s) => {
    if (!String(title || '').trim()) fail('Uchrashuv nomi majburiy');
    if (!date || date < s.today) fail('Sana bugun yoki keyin bo‘lsin');
    if (format === 'online' && !String(link || '').trim()) fail('Onlayn uchrashuv uchun havola kerak');
    if (format === 'offline' && !String(place || '').trim()) fail('Joyini yozing');
    const id = nextId(s, 'mt');
    s.meetings.push({ id, title: title.trim(), kind, date, time: time || '10:00', format, link: format === 'online' ? link.trim() : '', place: format === 'offline' ? place.trim() : '', organizer: organizer || actor, invited: [], attended: [] });
    log(s, actor || organizer, 'Uchrashuv yaratildi', id, { after: title });
  });
}
export function inviteToMeeting(state, { id, employeeIds, actor = 'HR Admin' }) {
  return mutate(state, (s) => {
    const m = s.meetings.find((x) => x.id === id);
    if (!m) fail('Uchrashuv topilmadi');
    const add = employeeIds.filter((e) => !m.invited.includes(e));
    if (!add.length) fail('Yangi taklif qilinadigan xodim yo‘q');
    m.invited.push(...add);
    for (const eid of add) {
      const emp = getEmployee(s, eid);
      onbNotify(s, `mt:${id}:${eid}`, emp.name, `Taklif: «${m.title}» — ${m.date}, ${m.time}. ${m.format === 'online' ? `Havola: ${m.link}` : `Joy: ${m.place}`}`);
    }
    log(s, actor, 'Uchrashuvga taklif yuborildi', id, { count: add.length });
  });
}
export function markAttendance(state, { id, employeeId, attended, actor = 'HR Admin' }) {
  return mutate(state, (s) => {
    const m = s.meetings.find((x) => x.id === id);
    if (!m) fail('Uchrashuv topilmadi');
    if (m.date > s.today) fail('Uchrashuv hali bo‘lmagan — qatnashuv uchrashuvdan keyin belgilanadi');
    if (!m.invited.includes(employeeId)) fail('Xodim taklif qilinmagan');
    m.attended = m.attended.filter((x) => x !== employeeId);
    if (attended) m.attended.push(employeeId);
    log(s, actor, attended ? 'Uchrashuvda qatnashdi' : 'Qatnashuv olib tashlandi', `${id} · ${employeeId}`);
  });
}
export const ceoMeetingOf = (s, employeeId) => {
  const list = (s.meetings || []).filter((m) => m.kind === 'ceo' && m.invited.includes(employeeId));
  return list.find((m) => m.attended.includes(employeeId)) || list.at(-1) || null;
};

// ---------- Eslatmalar (platforma + Telegram) ----------
export const REMINDER_KINDS = {
  deadline: ['Bugun muddat', 'bad', false],
  overdue: ['Muddat o‘tdi', 'bad', true],
  soon: ['Muddat yaqin', 'warn', false],
  notStarted: ['Boshlanmagan', 'warn', true],
  slow: ['Reja bo‘yicha ortda', 'warn', true],
  progress: ['Davriy eslatma', 'muted', false],
};
/** Berilgan kunda yuboriladigan eslatmalar. Bitta kursga kuniga ko'pi bilan bitta (ustuvorlik — REMINDER_KINDS tartibi). */
export function dueReminders(s, date = s.today) {
  const out = [];
  for (const enr of s.enrollments || []) {
    const dl = enrDeadline(enr);
    if (enr.status !== 'in_progress' || !dl) continue;
    const emp = getEmployee(s, enr.employeeId);
    if (!emp || emp.status === 'archived' || date < enr.startedAt) continue;
    const course = getCourse(s, enr.courseId);
    const d = daysBetween(enr.startedAt, date);
    const left = daysBetween(date, dl);
    const total = course.components.length;
    const doneN = course.components.filter((c) => componentDone(course, enr, c.id)).length;
    const started = Object.keys(enr.progress).length > 0;
    const span = Math.max(1, daysBetween(enr.startedAt, dl));
    const slow = started && doneN / total + 0.25 < d / span;
    let kind = null;
    if (left === 0) kind = 'deadline';
    else if (left < 0 && (left === -1 || -left % 10 === 0)) kind = 'overdue';
    else if (left === 3 || left === 1) kind = 'soon';
    else if (!started && d > 0 && d % 10 === 0) kind = 'notStarted';
    else if (slow && d > 0 && d % 10 === 0) kind = 'slow';
    else if (started && !slow && d > 0 && d % 15 === 0) kind = 'progress';
    if (!kind) continue;
    const t = `«${course.title}»`;
    const body = {
      deadline: `bugun muddat. Bajarilgan ${doneN}/${total}.`,
      overdue: `muddat ${-left} kun oldin tugagan (${dl}). Bajarilgan ${doneN}/${total}.`,
      soon: `muddatgacha ${left} kun qoldi (${dl}). Bajarilgan ${doneN}/${total}.`,
      notStarted: `biriktirilganiga ${d} kun bo‘ldi, hali boshlanmagan. Muddat ${dl}.`,
      slow: `reja bo‘yicha ortda — ${doneN}/${total} bajarildi, ${d}/${span} kun o‘tdi.`,
      progress: `${d} kun o‘tdi, ${doneN}/${total} bajarildi — davom eting!`,
    }[kind];
    const text = `${t}: ${body}`;
    const to = [{ name: emp.name, role: 'Xodim' }];
    if (REMINDER_KINDS[kind][2]) {
      const mentor = emp.supervisorId ? getEmployee(s, emp.supervisorId) : null;
      if (mentor) to.push({ name: mentor.name, role: 'Mentor' });
      const head = branchHead(s, emp.branchId);
      if (head) to.push({ name: head.name, role: 'Filial rahbari' });
    }
    out.push({ key: `rem:${enr.id}:${date}`, enrollmentId: enr.id, employeeId: emp.id, kind, text, title: t, body, to, date });
  }
  // Bitta xodimga kuniga bitta eslatma: eng ustuvor holat, bir xil holatdagi kurslar birlashtiriladi (K6).
  const order = Object.keys(REMINDER_KINDS);
  out.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
  const byEmp = new Map();
  for (const r of out) {
    const cur = byEmp.get(r.employeeId);
    if (!cur) byEmp.set(r.employeeId, { ...r, key: `rem:${r.employeeId}:${date}`, enrollmentIds: [r.enrollmentId], also: [] });
    else if (cur.kind === r.kind) { cur.titles = [...(cur.titles || [cur.title]), r.title]; cur.text = `${cur.titles.length} ta kurs (${cur.titles.join(', ')}): ${cur.body}`; cur.enrollmentIds.push(r.enrollmentId); }
    else cur.also.push(REMINDER_KINDS[r.kind][0]);
  }
  return [...byEmp.values()];
}
export function sendReminders(state, { actor = 'Tizim (eslatmalar)' } = {}) {
  return mutate(state, (s) => {
    const list = dueReminders(s).filter((r) => !s.notifications.some((n) => n.key.startsWith(r.key)));
    if (!list.length) fail('Bugun yuboriladigan yangi eslatma yo‘q');
    for (const r of list) for (const t of r.to) onbNotify(s, `${r.key}:${t.role}`, t.name, t.role === 'Xodim' ? r.text : `${getEmployee(s, r.employeeId).name} — ${r.text}`);
    log(s, actor, 'Eslatmalar yuborildi', s.today, { count: list.length });
  });
}

/** Xavf guruhidagi xodim bo'yicha mentorga (bo'lmasa HR'ga) ogohlantirish — kuniga bir marta. */
export function flagRisk(state, { onboardingId, reasons, actor = 'HR/L&D' }) {
  return mutate(state, (s) => {
    const ob = getOnboarding(s, onboardingId);
    if (!ob || ob.status !== 'active') fail('Faol moslashuv topilmadi');
    const emp = getEmployee(s, ob.employeeId);
    const to = (emp.supervisorId && getEmployee(s, emp.supervisorId)?.name) || s.staff.find((u) => u.role === 'hr')?.name;
    if (!onbNotifyFlag(s, `risk:${ob.id}:${s.today}`, to, `Xavf guruhi: ${emp.name} (${onbDay(s, ob)}-kun) — ${reasons.join('; ')}. Bu hafta 1:1 suhbat o‘tkazing va natijani qayd eting.`)) fail('Bugun allaqachon xabar yuborilgan');
    ob.riskFlags = [...(ob.riskFlags || []), { at: s.today, reasons, by: actor }];
    log(s, actor, 'Xavf guruhi: mentorga xabar', `${emp.id} · ${ob.id}`, { reason: reasons.join('; ') });
  });
}
function onbNotifyFlag(s, key, to, text) {
  if (!notify(s, key, to, text)) return false;
  s.notifications[0].tg = true;
  return true;
}
