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
    syncShared(s, card, code);
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
    syncShared(s, card, code);
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
      if (cardAssessors(card).includes(actor)) fail(`${actor} bu kartada baholovchi bo‘lgan — darajani boshqa «E’lon va tayinlash» huquqi bor admin e’lon qiladi`);
      const self = (s.staff || []).find((u) => u.name === actor);
      if (isSelf(self, card.employeeId)) fail('O‘z darajangizni e’lon qila olmaysiz');
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
  return mutate(state, (s) => { reopenCard(s, getCard(s, cardId), codes, actor); });
}
function reopenCard(s, prev, codes, actor) {
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
  return id;
}

// ---------- Tizimga kirish: Telegram, SMS kod yoki login va parol (TZ 14-bo'lim). Prototipda — demo, haqiqiy autentifikatsiya yo'q ----------
export const DEMO_SMS_CODE = '1234';
export const DEMO_PASSWORD = 'demo';
const digits = (x) => String(x || '').replace(/\D/g, '');
/** method: 'telegram' (username), 'sms' (telefon), 'password' (Gmail yoki admin logini). Topilsa sessiya qismi qaytadi. */
export function findLogin(s, { method, value, password }) {
  const v = String(value || '').trim().toLowerCase();
  if (!v) fail(method === 'telegram' ? 'Telegram username kiriting' : method === 'sms' ? 'Telefon raqamini kiriting' : 'Login kiriting');
  const act = activeEmployees(s);
  if (method === 'telegram') {
    const e = act.find((x) => (x.profile?.telegram || '').toLowerCase() === (v.startsWith('@') ? v : `@${v}`));
    if (!e) fail('Bu Telegram akkaunti EduTizim profilida topilmadi');
    return { mode: 'employee', employeeId: e.id, name: e.name };
  }
  if (method === 'sms') {
    const e = act.find((x) => digits(x.profile?.phone || x.phone).endsWith(digits(v).slice(-9)) && digits(v).length >= 9);
    if (!e) fail('Bu telefon raqami EduTizim profilida topilmadi');
    return { mode: 'employee', employeeId: e.id, name: e.name };
  }
  if (password !== DEMO_PASSWORD) fail('Login yoki parol noto‘g‘ri');
  const u = s.staff.find((x) => x.active !== false && (x.id === v || x.id === `u-${v}`));
  if (u) return { mode: 'admin', userId: u.id, name: u.name };
  const e = act.find((x) => (x.profile?.email || '').toLowerCase() === v);
  if (!e) fail('Login yoki parol noto‘g‘ri');
  return { mode: 'employee', employeeId: e.id, name: e.name };
}

// ---------- Shikoyat (apellyatsiya): e'londan keyin 10 kun ichida, boshqa baholovchi ko'rib chiqadi (TZ, 2026-11-24) ----------
export const APPEAL_DAYS = 10;
/** Kartani baholagan shaxslar — shikoyatni ular ko'rib chiqa olmaydi. */
export const cardAssessors = (card) => [...new Set(Object.values(card.scores || {}).map((x) => x.by).filter(Boolean))];
export const appealDeadline = (card) => (card.published ? addDays(card.published.at, APPEAL_DAYS) : null);
export function fileAppeal(state, { cardId, employeeId, text }) {
  return mutate(state, (s) => {
    const card = getCard(s, cardId);
    if (!card || card.stage !== 'published') fail('Shikoyat faqat e’lon qilingan natija bo‘yicha');
    if (card.employeeId !== employeeId) fail('Shikoyatni faqat xodimning o‘zi yuboradi');
    if (card.appeal) fail('Bu natija bo‘yicha shikoyat allaqachon yuborilgan');
    if (s.today > appealDeadline(card)) fail(`Shikoyat muddati o‘tgan: e’londan keyin ${APPEAL_DAYS} kun ichida (${appealDeadline(card)} gacha)`);
    if (String(text || '').trim().length < 10) fail('Nimadan norozi ekaningizni va sababini yozing');
    const emp = getEmployee(s, employeeId);
    card.appeal = { text: text.trim(), at: s.today, status: 'open' };
    const hr = s.staff.find((u) => u.role === 'hr');
    notify(s, `appeal:${card.id}`, hr?.name || 'HR Admin', `${emp.name}: ${card.id} natijasi bo‘yicha shikoyat. Uni kartani baholamagan boshqa baholovchi ko‘rib chiqadi.`);
    log(s, emp.name, 'Shikoyat yuborildi', card.id, { reason: text.trim() });
  });
}
/** decision: 'upheld' — natija o'zgarmaydi; 'reassess' — tanlangan bandlar qayta baholash kartasida ochiladi. */
export function reviewAppeal(state, { cardId, decision, note, codes = [], userId }) {
  return mutate(state, (s) => {
    const card = getCard(s, cardId);
    if (card?.appeal?.status !== 'open') fail('Ko‘rib chiqiladigan shikoyat yo‘q');
    const user = getStaff(s, userId);
    if (!user || !can(user, 'cards.publish')) fail('Shikoyatni «E’lon va tayinlash» huquqi bor shaxs ko‘rib chiqadi');
    if (cardAssessors(card).includes(user.name)) fail('Shikoyatni kartani baholamagan boshqa baholovchi ko‘rib chiqadi');
    if (!['upheld', 'reassess'].includes(decision)) fail('Noto‘g‘ri qaror');
    if (!String(note || '').trim()) fail('Qaror sababi majburiy');
    const reopened = decision === 'reassess' ? reopenCard(s, card, codes, user.name) : null;
    card.appeal = { ...card.appeal, status: decision, note: note.trim(), by: user.name, decidedAt: s.today, reopened };
    const emp = getEmployee(s, card.employeeId);
    notify(s, `appeal-done:${card.id}`, emp.name, decision === 'upheld' ? `Shikoyatingiz ko‘rib chiqildi: natija o‘zgarmadi. Sabab: ${note.trim()}` : `Shikoyatingiz qabul qilindi: ${codes.join(', ')} qayta baholanadi (${reopened}). ${note.trim()}`);
    log(s, user.name, 'Shikoyat ko‘rib chiqildi', card.id, { after: decision, reason: note.trim() });
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

/** Kurs yakuni (platformaning o'zidan, tashqi manbadan yoki qo'lda): takroriy yozuv dublikat yaratmaydi (INT 01). */
export function courseCompleted(state, { employeeId, courseId, externalId, actor = 'RegUP LMS' }) {
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

/** Test urinishlari: standart 3, testda sozlanadi. Kurs bahosiga OXIRGI urinish kiradi (TZ, 2026-11-24). */
export const TEST_ATTEMPTS = 3;
export const testAttempts = (c) => c?.maxAttempts ?? TEST_ATTEMPTS;
export const testScore = (p) => (p ? (isNum(p.last) ? p.last : isNum(p.best) ? p.best : null) : null);
/** Komponent bajarilganmi: dars — o'qildi; test — o'tish bali; topshiriq — mentor qabul qildi. */
export function componentDone(course, enr, compId) {
  const c = course.components.find((x) => x.id === compId);
  const p = enr.progress[compId];
  if (!c || !p) return false;
  if (c.kind === 'lesson') return !!p.done;
  if (c.kind === 'test') return isNum(testScore(p)) && testScore(p) >= c.passScore;
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

/** Kurs bahosi (1–5): kurs qanchalik yaxshi yakunlangani — testlar (foiz → ball) va topshiriq baholari o'rtachasi. Kompetensiya darajasi emas. */
export const COURSE_MIN_GRADE = 4;
export function courseGrade(course, enr) {
  const xs = [];
  for (const c of course.components) {
    const p = enr.progress[c.id];
    if (c.kind === 'test' && isNum(testScore(p))) xs.push(testBall(testScore(p)));
    if (c.kind === 'task' && p?.status === 'accepted' && isNum(p.mentor?.grade)) xs.push(p.mentor.grade);
  }
  return xs.length ? Math.round((10 * xs.reduce((a, b) => a + b, 0)) / xs.length) / 10 : null;
}
export const courseMinGrade = (course) => course.minGrade ?? COURSE_MIN_GRADE;
/** Kurslar bajarilishi: kurs kontentining (dars, test, topshiriq) necha foizi bajarilgan; har element teng. */
export function courseProgress(course, enr) {
  const total = course.components.length;
  const done = enr ? course.components.filter((c) => componentDone(course, enr, c.id)).length : 0;
  return { done, total, pct: total ? Math.round((100 * done) / total) : 0 };
}
/** Learning Path natijasi: kurs baholari o'rtachasi (bosilganda har kurs), kurslar bajarilishi va «X / N kurs». */
export function pathResult(s, employeeId, courseIds) {
  const rows = courseIds.map((cid) => {
    const course = getCourse(s, cid);
    const enr = (s.enrollments || []).filter((e) => e.employeeId === employeeId && e.courseId === cid).sort((a) => (a.status === 'completed' ? -1 : 1))[0] || null;
    return { course, enr, grade: enr ? courseGrade(course, enr) : null, ...courseProgress(course, enr), completed: enr?.status === 'completed' };
  });
  const gs = rows.map((r) => r.grade).filter(isNum);
  const all = rows.reduce((a, r) => a + r.total, 0);
  return { rows, grade: gs.length ? Math.round((10 * gs.reduce((a, b) => a + b, 0)) / gs.length) / 10 : null, pct: all ? Math.round((100 * rows.reduce((a, r) => a + r.done, 0)) / all) : 0, coursesDone: rows.filter((r) => r.completed).length, total: rows.length };
}
/** Test savollari indikator darajasiga bog'langan bo'lsa (q.lvl): topilgan daraja — shu va undan past darajalarning barcha savollari to'g'ri. */
export function foundLevel(questions, answers, cap) {
  if (!questions.some((qq) => isNum(qq.lvl))) return null;
  let found = 0;
  for (let l = 1; l <= cap; l += 1) {
    const qs = questions.map((qq, i) => [qq, i]).filter(([qq]) => qq.lvl === l);
    if (qs.length && !qs.every(([qq, i]) => Number(answers[i]) === qq.answer)) break;
    found = l;
  }
  return found;
}
/** Kurs qoidasi bajarilganda topilgan daraja: test indikatorlari va mentor belgilagan indikatorlar, kurs chegarasidan oshmaydi. 0 — indikator topilmadi. */
export function ruleOutcome(course, enr, r) {
  if (!r.needs.every((id) => componentDone(course, enr, id))) return null;
  const parts = r.needs.map((id) => course.components.find((c) => c.id === id));
  const taskLevels = parts.filter((c) => c?.kind === 'task').map((c) => enr.progress[c.id]?.mentor?.level).filter(isNum);
  const testLevels = parts.filter((c) => c?.kind === 'test').map((c) => enr.progress[c.id]?.found).filter(isNum);
  return Math.min(r.level, ...taskLevels, ...testLevels);
}

function settleEnrollment(s, enr, actor) {
  const course = getCourse(s, enr.courseId);
  const emp = getEmployee(s, enr.employeeId);
  enr.applied ||= [];
  const changed = [];
  const grade = courseGrade(course, enr);
  const gradeOk = grade === null || grade >= courseMinGrade(course);
  course.rules.forEach((r, i) => {
    if (enr.applied.includes(i)) return;
    const lvl = ruleOutcome(course, enr, r);
    if (lvl === null || lvl < 1) return;
    if (!gradeOk) {
      notify(s, `crs-low:${enr.id}:${i}`, emp.name, `«${course.title}»: kurs bahosi ${String(grade).replace('.', ',')} — kompetensiyaga dalil bo‘lishi uchun kamida ${courseMinGrade(course)} kerak.`);
      return;
    }
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
    // Kurs yakunlanishi kursdan qoniqish bahosi va NPS'dan keyin qayd etiladi (2 ta majburiy savol, TZ 2026-11-24).
    if (!enr.feedbackGiven) {
      if (!enr.awaitingFeedback) {
        enr.awaitingFeedback = true;
        enr.doneAt = s.today;
        notify(s, `crs-fb:${enr.id}`, emp.name, `«${course.title}»: kontent bajarildi. Kurs yakunlanishi uchun 2 ta savolga javob bering — kursdan qoniqish bahosi va tavsiya qilish (NPS).`);
      }
      return;
    }
    finishEnrollment(s, enr, course, emp, actor);
  }
}

function finishEnrollment(s, enr, course, emp, actor) {
  enr.status = 'completed';
  enr.completedAt = enr.doneAt || s.today;
  delete enr.awaitingFeedback;
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
    if ((p.attempts || 0) >= testAttempts(c)) fail(`Urinishlar tugadi (${p.attempts}/${testAttempts(c)}). Bahoga oxirgi urinish kirdi`);
    const course = getCourse(s, enr.courseId);
    const cap = Math.max(0, ...course.rules.filter((r) => r.needs.includes(componentId)).map((r) => r.level));
    const found = cap ? foundLevel(c.questions, answers, cap) : null;
    enr.progress[componentId] = { ...p, attempts: (p.attempts || 0) + 1, last: score, best: Math.max(p.best ?? 0, score), at: s.today, ...(found !== null ? { found } : {}) };
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
      if (isSelf(getStaff(s, reviewerId), enr.employeeId)) fail('O‘z topshirig‘ingizni tekshira olmaysiz — uni boshqa baholovchi tekshiradi');
      fail(`Bu topshiriqni ${REVIEWER_KIND[r.kind]}${r.user ? ` (${r.user.name})` : ''} tekshiradi`);
    }
    if (!String(note || '').trim()) fail('Mentor xulosasi majburiy');
    const cap = Math.max(0, ...course.rules.filter((r) => r.needs.includes(componentId)).map((r) => r.level));
    if (decision === 'accepted' && cap > 0 && !(Number.isInteger(level) && level >= 1 && level <= cap)) fail(`Daraja 1–${cap} oralig‘ida (kurs chegarasi)`);
    if (decision === 'accepted' && course.onboarding && !(Number.isInteger(grade) && grade >= 1 && grade <= 5)) fail('Moslashuv kursi: 1–5 baho qo‘ying');
    if (decision === 'accepted' && grade !== undefined && grade !== null && !(Number.isInteger(grade) && grade >= 1 && grade <= 5)) fail('Kurs bahosi 1–5');
    if (decision === 'accepted' && cap === 0 && !course.onboarding) fail('Kursda bu topshiriq uchun qoida yo‘q');
    p.status = decision;
    p.mentor = { level: decision === 'accepted' && cap > 0 ? level : null, grade: decision === 'accepted' && isNum(grade) ? grade : null, note, by: mentor, at: s.today };
    p.history = [...(p.history || []), { at: s.today, review: decision, note, by: mentor }];
    const emp = getEmployee(s, enr.employeeId);
    notify(s, `task:${enr.id}:${componentId}:${p.history.length}`, emp.name, decision === 'accepted' ? `«${course.title}»: amaliy topshiriq qabul qilindi (${course.onboarding ? `${grade} / 5 ball` : `${level}-daraja`}). ${note}` : `«${course.title}»: amaliy topshiriq qaytarildi — ${note}`);
    log(s, mentor, decision === 'accepted' ? 'Amaliy topshiriq qabul qilindi' : 'Amaliy topshiriq qaytarildi', `${emp.id} · ${course.id} · ${componentId}`, { after: String(level ?? '—'), reason: note });
    if (decision === 'accepted') settleEnrollment(s, enr, mentor);
  });
}

// ---------- Kurs fikrlari: dars bahosi, kursdan qoniqish bahosi, NPS, ochiq fikr (barcha kurslar) ----------
// Anonim: yozuvda faqat filial va lavozim; ism faqat xodim roziligi bilan, e'lon qilinadigan fikr uchun.
export function rateLesson(state, { enrollmentId, componentId, value }) {
  return mutate(state, (s) => {
    const enr = getEnrollment(s, enrollmentId);
    const course = getCourse(s, enr.courseId);
    const c = course.components.find((x) => x.id === componentId);
    if (c?.kind !== 'lesson' || !componentDone(course, enr, componentId)) fail('Darsni avval o‘qing');
    const v = Number(value);
    if (!(Number.isInteger(v) && v >= 1 && v <= 5)) fail('Dars bahosi 1–5');
    enr.lessonRated ||= {};
    if (enr.lessonRated[componentId]) fail('Bu dars allaqachon baholangan');
    const emp = getEmployee(s, enr.employeeId);
    s.courseFeedback.push({ id: nextId(s, 'fb'), kind: 'lesson', courseId: course.id, lessonId: componentId, value: v, branchId: emp.branchId, position: emp.position, at: s.today });
    enr.lessonRated[componentId] = true;
  });
}
export function submitCourseFeedback(state, { enrollmentId, satisfaction, nps, comment = '', showName = false }) {
  return mutate(state, (s) => {
    const enr = getEnrollment(s, enrollmentId);
    if (enr.status !== 'completed' && !enr.awaitingFeedback) fail('Fikr kurs kontenti bajarilgach qoldiriladi');
    if (enr.feedbackGiven) fail('Bu kurs bo‘yicha fikr allaqachon qoldirilgan');
    const sat = Number(satisfaction);
    const n = Number(nps);
    if (!(Number.isInteger(sat) && sat >= 1 && sat <= 5)) fail('Kursdan qoniqish bahosi 1–5');
    if (!(Number.isInteger(n) && n >= 0 && n <= 10)) fail('Tavsiya qilish bahosi 0–10');
    const emp = getEmployee(s, enr.employeeId);
    const text = String(comment || '').trim();
    s.courseFeedback.push({ id: nextId(s, 'fb'), kind: 'course', courseId: enr.courseId, satisfaction: sat, nps: n, comment: text, author: text && showName ? emp.name : null,
      status: text ? 'pending' : null, branchId: emp.branchId, position: emp.position, at: s.today });
    enr.feedbackGiven = true;
    if (enr.awaitingFeedback) finishEnrollment(s, enr, getCourse(s, enr.courseId), emp, emp.name);
  });
}
export function moderateFeedback(state, { id, decision, userId }) {
  return mutate(state, (s) => {
    const user = getStaff(s, userId);
    if (!can(user, 'courses.comments')) fail('Fikrlarni «Kurs izohlarini boshqarish» huquqi bor xodim e’lon qiladi');
    const f = s.courseFeedback.find((x) => x.id === id);
    if (!f?.comment) fail('Fikr topilmadi');
    if (!['published', 'hidden'].includes(decision)) fail('Noto‘g‘ri qaror');
    f.status = decision;
    log(s, user.name, decision === 'published' ? 'Kurs fikri e’lon qilindi' : 'Kurs fikri yashirildi', `${f.courseId} · ${id}`);
  });
}
/** Anonim jamlanma kamida 5 ta javob bo'lsa ko'rsatiladi (TZ, 2026-11-24). */
export const ANON_MIN = 5;
/** Kurs bo'yicha jamlanma: dars baholari, kursdan qoniqish, NPS (promouterlar % − tanqidchilar %). few — javob kam, ko'rsatilmaydi. */
export function courseFeedbackStats(s, courseId) {
  const all = (s.courseFeedback || []).filter((f) => f.courseId === courseId);
  const course = getCourse(s, courseId);
  const lessons = course.components.filter((c) => c.kind === 'lesson').map((c) => {
    const xs = all.filter((f) => f.kind === 'lesson' && f.lessonId === c.id).map((f) => f.value);
    return { id: c.id, title: c.title, n: xs.length, few: xs.length < ANON_MIN, avg: xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null };
  });
  const cs = all.filter((f) => f.kind === 'course');
  const npsN = cs.length;
  const nps = npsN ? Math.round((100 * (cs.filter((f) => f.nps >= 9).length - cs.filter((f) => f.nps <= 6).length)) / npsN) : null;
  return { lessons, n: cs.length, few: cs.length < ANON_MIN, satisfaction: cs.length ? cs.reduce((a, f) => a + f.satisfaction, 0) / cs.length : null, nps, comments: cs.filter((f) => f.comment) };
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

/** Dalil uchun eng past kurs bahosi (3–5) — faol kursda ham sozlanadi, keyingi yakunlarga qo'llanadi. */
export function setCourseMinGrade(state, { id, value, actor = 'HR/L&D' }) {
  return mutate(state, (s) => {
    const c = getCourse(s, id);
    const v = Number(value);
    if (!c || !(v >= 3 && v <= 5)) fail('Chegara 3–5');
    const before = courseMinGrade(c);
    c.minGrade = v;
    log(s, actor, 'Kurs dalil chegarasi', id, { before: String(before), after: String(v) });
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

/** Edu oylik hisobotini olish (demo: tayyor hisobot) va qoidalarni qo'llash. */
export function importKpiMonth(state, { month, actor = 'Edu (avtomatik)' }) {
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
// 30 kunlik moslashuv dasturi, onboarding natijasi 1–5 (lavozim kartasi, minimum sharti; filial rahbari tasdiqlaydi).
// Arxivlash va reboarding, CEO/HRD uchrashuvlari, eslatmalar, rollar.
// ---------------------------------------------------------------------------
export const ONB_DAYS = 30; // moslashuv dasturining standart muddati (lavozimda sozlanadi)
export const ADAPT_DAYS = 60; // butun adaptatsiya: preboarding → orientation (1–7) → functional (8–60)
// onbDay: ish boshlagan kun — 0, demak 1–7-kunlar = 0…6, 8–60-kunlar = 7…59.
export const ADAPT_PHASES = [['preboarding', 'Preboarding', -3, 0], ['orientation', 'Orientation', 1, 7], ['functional', 'Functional onboarding', 8, 60]];
export const adaptPhase = (day) => (day < 0 ? ADAPT_PHASES[0] : day < 7 ? ADAPT_PHASES[1] : ADAPT_PHASES[2]);
export const daysBetween = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
export { addDays };
export const activeEmployees = (s) => s.employees.filter((e) => e.status !== 'archived');
export const ONB_STAGES = [['induction', 'Induction', 0], ['d8', 'D8', 8], ['d30', 'D30', 30], ['d60', 'D60', 60]];
export const onbStage = (day) => (day >= 60 ? 'd60' : day >= 30 ? 'd30' : day >= 8 ? 'd8' : 'induction');
export const getOnboarding = (s, id) => (s.onboardings || []).find((o) => o.id === id);
export const onboardingOf = (s, employeeId) => (s.onboardings || []).filter((o) => o.employeeId === employeeId).at(-1) || null;
export const onbProgram = (s, emp) => (s.onboardingPrograms || []).find((p) => p.position === emp.position) || null;
export const onbDay = (s, ob) => daysBetween(ob.startedAt, s.today);
/** Shu lavozim uchun belgilangan moslashuv dasturi muddati (standart 30 kun). */
export const progDays = (s, emp) => onbProgram(s, emp)?.days || ONB_DAYS;
export const obDays = (s, ob) => ob.days || progDays(s, getEmployee(s, ob.employeeId));
export const onbLateDays = (ob) => daysBetween(ob.startedAt, ob.enteredAt);
export const onbEnrollments = (s, ob) => (s.enrollments || []).filter((e) => e.onboardingId === ob.id);
export const onbObservations = (s, ob) => (s.observations || []).filter((o) => o.employeeId === ob.employeeId && o.date >= ob.startedAt);
export const getStaff = (s, id) => (s.staff || []).find((u) => u.id === id);
export const branchHead = (s, branchId) => (s.staff || []).find((u) => u.role === 'branch' && u.branchIds.includes(branchId)) || null;
export const enrDeadline = (enr) => enr.deadline || enr.mandatory?.deadline || null;

/** Test foizi → 1–5 ball (Q1 taklifi; admin metodologiyani keyin almashtiradi). */
export const testBall = (pct) => (pct >= 90 ? 5 : pct >= 75 ? 4 : pct >= 60 ? 3 : pct >= 40 ? 2 : 1);
export const ONB_LABEL = (v) => (v === null ? '—' : v >= 4.5 ? 'A’lo' : v >= 3.5 ? 'Yaxshi' : v >= 2.5 ? 'Qoniqarli' : 'Past');
// Onboarding natijasi — lavozimga moslanadigan baholash kartasi (har qism 1–5). Badge emas: minimumdan o'tish = «muvaffaqiyatli yakunlandi».
export const ONB_PARTS = {
  onTime: ['Kursni muddatida yakunlash', 'Barcha onboarding kurslari muddatida — 5, hech biri — 1. Ixtiyoriy qism'],
  courses: ['Kurs bahosi', 'Onboarding kurslari baholarining o‘rtachasi; kurs bahosi kursning o‘z testlari va amaliy topshiriqlaridan'],
  tasks: ['Amaliy topshiriqlar bahosi', 'Kursdan tashqari, nomi bilan belgilangan maxsus topshiriqlar; mentor 1–5 baholaydi'],
  practice: ['Ish amaliyotidagi kuzatuv', 'Ustozda metodistning dars kuzatuvi, menejerda ish ko‘rsatkichlari; 1–5 o‘rtacha'],
};
export const ONB_MIN = 3;
export const PRACTICE_KIND = { lesson: 'Dars kuzatuvi (metodist)', work: 'Ish ko‘rsatkichlari (filial rahbari)' };
const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const r1 = (v) => (v === null ? null : Math.round(v * 10) / 10);
export const obsMean = (o) => avg(Object.values(o.ratings).map(Number));
/** Lavozim kartasi: qaysi qismlar kiradi, minimum, kursdan tashqari topshiriqlar, kuzatuv turi va soni. */
export function onbCard(prog) {
  const c = prog?.card || {};
  const kind = c.practice || (prog?.observations ? 'lesson' : 'work');
  return {
    onTime: c.onTime !== false,
    min: c.min ?? ONB_MIN,
    tasks: c.tasks || [],
    practice: kind,
    need: kind === 'lesson' ? (prog?.observations || 0) : (c.checks ?? 1),
    indicators: c.indicators || [],
  };
}
export const onbWorkChecks = (s, ob) => (s.workChecks || []).filter((w) => w.employeeId === ob.employeeId && w.date >= ob.startedAt);

/** Onboarding natijasi: qismlar, umumiy o'rtacha, minimum sharti va tayyorlik. */
export function onboardingScore(s, ob) {
  const emp = getEmployee(s, ob.employeeId);
  const prog = onbProgram(s, emp);
  const card = onbCard(prog);
  const enrs = onbEnrollments(s, ob);
  const grades = [];
  let onTime = 0;
  let due = 0; // muddati kelgan yoki yakunlangan kurslar — hali muddati bor kurs jazolanmaydi
  for (const enr of enrs) {
    const g = courseGrade(getCourse(s, enr.courseId), enr);
    if (g !== null) grades.push(g);
    if (enr.status === 'completed' || (enr.deadline && enr.deadline < s.today)) due += 1;
    if (enr.status === 'completed' && (!enr.deadline || enr.completedAt <= enr.deadline)) onTime += 1;
  }
  const taskGrades = card.tasks.map((t) => ob.taskGrades?.[t.id]?.grade).filter(isNum);
  const checks = card.practice === 'lesson' ? onbObservations(s, ob) : onbWorkChecks(s, ob);
  const vals = {
    onTime: due ? 1 + (4 * onTime) / due : null,
    courses: avg(grades),
    tasks: avg(taskGrades),
    practice: card.need ? avg(checks.map(obsMean)) : null,
  };
  const on = { onTime: card.onTime, courses: true, tasks: card.tasks.length > 0, practice: card.need > 0 };
  const regr = ob.extension?.regrades || {};
  const parts = Object.keys(ONB_PARTS).filter((k) => on[k]).map((k) => {
    const value = regr[k] ? regr[k].grade : r1(vals[k]);
    return { key: k, label: ONB_PARTS[k][0], hint: k === 'practice' ? PRACTICE_KIND[card.practice] : k === 'tasks' ? card.tasks.map((t) => t.name).join('; ') : ONB_PARTS[k][1], value, ok: value !== null && value >= card.min, regraded: !!regr[k] };
  });
  const used = parts.filter((p) => p.value !== null);
  const score = used.length ? r1(avg(used.map((p) => p.value))) : null;
  const coursesDone = enrs.filter((e) => e.status === 'completed').length;
  const tasksDone = taskGrades.length;
  const ready = enrs.length > 0 && coursesDone === enrs.length && checks.length >= card.need && tasksDone === card.tasks.length;
  const passed = ready && parts.every((p) => p.ok);
  const failed = parts.filter((p) => p.value !== null && !p.ok).map((p) => p.key);
  const obs = card.practice === 'lesson' ? checks.length : 0;
  return { parts, failed, extension: ob.extension || null, score, label: ONB_LABEL(score), ready, passed, min: card.min, card, coursesDone, courses: enrs.length, tasksDone, checks: checks.length, need: card.need, obs, needObs: card.practice === 'lesson' ? card.need : 0 };
}

function onbNotify(s, key, to, text) {
  if (notify(s, key, to, text)) s.notifications[0].tg = true;
}

/** Lavozim dasturi bo'yicha moslashuv kurslarini biriktiradi (reboarding'da avvalgi natijalar tiklanadi). */
function startOnboarding(s, emp, { startedAt, enteredAt, source, reboarding = false, actor }) {
  const prog = onbProgram(s, emp);
  const id = nextId(s, 'onb');
  const days = progDays(s, emp);
  const deadline = addDays(startedAt, days);
  const ob = { id, employeeId: emp.id, startedAt, enteredAt, source, status: 'active', reboarding, days, final: null, restored: [] };
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
    : `Registon Academy’ga xush kelibsiz! ${days} kunlik moslashuv dasturi boshlandi: ${n} ta kurs, muddat ${deadline}.`);
  const mentor = emp.supervisorId ? getEmployee(s, emp.supervisorId) : null;
  if (mentor) onbNotify(s, `onb:${id}:mentor`, mentor.name, `${emp.name} (${emp.currentLevel}) sizga moslashuv uchun biriktirildi. Muddat ${deadline}.`);
  log(s, actor, reboarding ? 'Reboarding boshlandi' : 'Moslashuv dasturi boshlandi', `${emp.id} · ${id}`, { courses: n });
  return ob;
}

// ---------- Doimiy kompetensiya kartasi: rekrutingdan boshlanadi ----------
/** Rasmiy e'lon sanalari (oy-kun), yiliga 1–2 marta, sozlanadi. Ungacha kartadagi baholar «shartli». */
export function nextAnnounce(s, from = s.today) {
  const md = [...(s.announceConfig?.dates || ['06-30', '12-25'])].sort();
  const y = Number(from.slice(0, 4));
  const hit = md.find((d) => `${y}-${d}` >= from);
  return hit ? `${y}-${hit}` : `${y + 1}-${md[0]}`;
}
export function setAnnounceDates(state, { dates, actor = 'HR/L&D' }) {
  return mutate(state, (s) => {
    const list = [...new Set(dates.map((d) => String(d).trim()).filter(Boolean))];
    if (list.length < 1 || list.length > 2) fail('Rasmiy e’lon yiliga 1 yoki 2 marta');
    if (list.some((d) => !/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(d))) fail('Sana OO-KK ko‘rinishida, masalan 06-30');
    const before = (s.announceConfig?.dates || []).join(', ');
    s.announceConfig = { ...(s.announceConfig || {}), dates: list.sort() };
    log(s, actor, 'Rasmiy e’lon sanalari', 'announce', { before, after: list.join(', ') });
  });
}
/** Lavozim uchun kompetensiya modeli bormi (yo'q bo'lsa karta mantig'i ishlamaydi — kurslar va topshiriqlar ishlayveradi). */
export const positionModel = (s, position) => activeModel(s, position) || null;
export const onboardingCardOf = (s, employeeId) => s.cards.find((c) => c.employeeId === employeeId && c.origin === 'onboarding') || null;

/** Yangi xodimga birinchi kundan karta: rekruting xulosalari shartli baho sifatida, 60-kunda birinchi lavozim darajasi. */
function openOnboardingCard(s, emp, ob, recruiting) {
  const model = positionModel(s, emp.position);
  if (!model || !model.profiles.some((p) => p.code === emp.currentLevel)) return null;
  const id = nextId(s, 'c');
  const scores = {};
  for (const [code, lv] of Object.entries(recruiting?.scores || {})) {
    if (!model.competencies.some((c) => c.code === code)) continue;
    scores[code] = { final: null, basis: '', evidences: [{ method: model.methods.includes('interview') ? 'interview' : model.methods[0], value: Number(lv), note: `Rekruting xulosasi (${recruiting.via === 'jobster' ? 'Jobster' : 'Telegram'})${recruiting.note ? `: ${recruiting.note}` : ''}`, sourceId: `REC-${emp.id}` }] };
  }
  s.cards.unshift({
    id, cycleId: 'onboarding', origin: 'onboarding', provisional: true, employeeId: emp.id, modelVersionId: model.id, profileFrom: null, profileTo: emp.currentLevel, branchId: emp.branchId,
    stage: 'evidence', revision: 1, deadline: addDays(ob.startedAt, ADAPT_DAYS), targetRoleId: null, stretchId: null,
    assessors: { evaluator: model.evaluatorRole || 'Assessor', calibrator: 'L&D' },
    scores, hrScores: {}, observations: [], gates: {}, kpi: null, panel: null, appointment: null, published: null, createdAt: s.today,
  });
  ob.cardId = id;
  log(s, 'Integratsiya', 'Onboarding kompetensiya kartasi ochildi', id, { after: `${model.id} · ${emp.currentLevel} · rekruting: ${Object.keys(scores).length} ta baho (shartli)` });
  return id;
}

// ---------- Offboarding: ketish turi → qaysi so'rovnoma (exit-intervyu) ----------
const fmtIso = (d) => d;
export const EXIT_TYPES = {
  self: 'O‘z xohishi bilan',
  fired: 'Haydaldi',
  returns: 'Qaytadi (rahbar bilan kelishib vaqtincha to‘xtatdi)',
  duplicate: 'Ikkinchi akkaunt / dublikat',
};
/** Haydalish uch sabab bilan qayd etiladi (qaror №44); boshqa barcha holat — «o'z xohishi bilan». */
export const FIRE_REASONS = { skills: 'Lavozim uchun ko‘nikma yetarli emas', discipline: 'Ishga mas’uliyatsiz yondashuv', values: 'Qadriyatlari mos kelmadi' };
/**
 * Ketish sabablari katalogi — 20 ta (TZ 12-bo'lim). Yagona katalog EduTizim'da yuritiladi; RegUP ro'yxatni va
 * sababni arxiv signali bilan oladi. Uchinchi ustun — sabab tanlanganda ketish turi.
 */
export const EXIT_REASONS = [
  ['growth', 'O‘sish va rivojlanish sharoitlari qoniqarli emasligi', 'self'],
  ['manager', 'Rahbar bilan murakkab munosabatlar', 'self'],
  ['duties', 'Lavozimdagi funksional vazifalardan qoniqmaslik', 'self'],
  ['workload', 'Juda katta ish hajmi', 'self'],
  ['salary', 'Oylik maosh', 'self'],
  ['offer', 'Boshqa joydan yaxshiroq taklif', 'self'],
  ['team', 'Jamoaga moslasha olmaslik', 'self'],
  ['unclear', 'Jarayonlar tushunarli emas edi', 'self'],
  ['process', 'Kompaniyada ichki jarayonlar yetarli darajada yo‘lga qo‘yilmaganligi', 'self'],
  ['schedule', 'Ish grafigi', 'self'],
  ['place', 'Ish joyining noqulayligi', 'self'],
  ['personal', 'Shaxsiy sabablar (rejalar o‘zgarishi, sog‘liq, ko‘chib ketish, oilaviy vaziyat)', 'self'],
  ['group', 'Guruh yig‘ib berilmaganligi', 'self'],
  ['motivation', 'Ishga nisbatan past motivatsiya', 'self'],
  ['contract', 'Shartnoma bandlari nomzodga mos kelmadi', 'self'],
  ['fired-skills', 'Ishdan ketkazilgan: lavozim uchun ko‘nikmalar kamligi', 'fired', 'skills'],
  ['fired-discipline', 'Ishdan ketkazilgan: ishga nisbatan mas’uliyatsizlik', 'fired', 'discipline'],
  ['fired-values', 'Ishdan ketkazilgan: qadriyatlari mos kelmadi', 'fired', 'values'],
  ['duplicate', 'Ikkinchi akkaunt', 'duplicate'],
  ['returns', 'Vaqtinchalik to‘xtatyapti. Qaytadi', 'returns'],
];
export const exitReason = (code) => EXIT_REASONS.find((r) => r[0] === code) || null;
export function exitPlan(s, emp, p) {
  const cat = exitReason(p.reasonCode);
  const p2 = cat ? { ...p, exitType: cat[2], fireReason: cat[3] || null } : p;
  const type = p2.exitType === 'fired' && !FIRE_REASONS[p2.fireReason] ? 'self' : (p2.exitType || 'self');
  const worked = daysBetween(emp.rehiredAt || emp.hiredAt, p.leftAt);
  const sinceLeft = daysBetween(p.leftAt, s.today);
  if (type === 'returns') return { type, survey: null, text: 'Exit-intervyu yuborilmaydi — dam olishi yaxshi o‘tishi tilanadi' };
  if (type === 'duplicate') return { type, survey: null, text: 'Qo‘shimcha akkaunt — so‘rovnoma yuborilmaydi' };
  if (sinceLeft > 30) return { type, survey: null, late: true, text: `Ketganiga ${sinceLeft} kun bo‘lgan — xodimga yozilmaydi; filialdan kechikish sababi so‘raladi` };
  if (worked < 30) return { type, survey: 'Fail Case 30-day', text: 'Fail Case so‘rovnomasi RegUP havolasi bilan boradi (tizimga kirmasdan to‘ldiriladi); filial rahbariga rahbar so‘rovnomasi' };
  return { type, survey: type === 'fired' ? 'Ish haydalgan | D60 exit intervyu' : 'O‘z xohishi | D60 exit intervyu', text: 'L&D menejeriga topshiriqlar doskasida vazifa: xayrlashish va mos exit-intervyuni yuborish; filial rahbariga rahbar so‘rovnomasi' };
}

function hrResult(s, ev, tone, text, employeeId = null) {
  s.hrLog.unshift({ id: nextId(s, 'hl'), eventId: ev.id, type: ev.type, at: s.today, tone, text, employeeId, who: ev.payload.name || getEmployee(s, ev.payload.employeeId)?.name });
}

function applyHrEvent(s, ev, actor) {
  const p = ev.payload;
  if (ev.type === 'hire') {
    // «Markaz admini»: EduTizim'dagi markaz akkaunti keyingi xodimga o'tadi — RegUP'da shaxsiy raqamga alohida akkaunt ochiladi.
    const centerAdmin = p.department === 'Markaz admini';
    if (centerAdmin && !p.personalPhone) return hrResult(s, ev, 'bad', 'Xato: «Markaz admini» — markaz akkaunti umumiy. Xodimning shaxsiy telefon raqami kerak, RegUP akkaunti shunga ochiladi.');
    const phone = centerAdmin ? p.personalPhone : p.phone;
    const dup = s.employees.find((e) => e.phone && e.phone === phone);
    if (dup) return hrResult(s, ev, 'bad', `Xato: ${phone} raqami bilan xodim bor (${dup.name}). Qaytgan xodim bo‘lsa — «qayta ishga kirish» hodisasi kerak.`);
    const id = nextId(s, 'e');
    const emp = { id, name: p.name, position: p.position, currentLevel: p.level, branchId: p.branchId, phone, centerAccount: centerAdmin ? p.phone : null, jobsterId: p.jobsterId, eduId: p.eduId, source: p.source,
      hiredAt: p.startedAt, levelSince: p.startedAt, kpi10m: null, status: 'active', supervisorId: (s.onboardingConfig.mentors || {})[`${p.position}:${p.branchId}`] || null,
      history: [{ level: p.level, from: p.startedAt, doc: `Jobster ATS · ${p.jobsterId}` }], records: {} };
    emp.departmentId = deptFor(s, p.position, p.department);
    emp.profile = { gender: p.gender || null, city: getBranch(s, p.branchId)?.region || '', telegram: p.telegram || '', birthday: p.birthday || null, email: p.email || '', about: '' };
    s.employees.push(emp);
    const ob = startOnboarding(s, emp, { startedAt: p.startedAt, enteredAt: s.today, source: p.source, actor });
    const cardId = openOnboardingCard(s, emp, ob, p.recruiting);
    const late = onbLateDays(ob);
    if (late >= s.onboardingConfig.lateDays) {
      const head = branchHead(s, p.branchId);
      onbNotify(s, `late:${ob.id}`, s.staff.find((u) => u.role === 'hr')?.name || 'HR Admin', `${emp.name} (${getBranch(s, p.branchId)?.name}) ish boshlaganidan ${late} kun keyin tizimga kiritildi.`);
      if (head) onbNotify(s, `late:${ob.id}:head`, head.name, `${emp.name} ish boshlaganidan ${late} kun keyin tizimga kiritildi — xodimni birinchi kunida kiriting.`);
    }
    return hrResult(s, ev, late >= s.onboardingConfig.lateDays ? 'warn' : 'good', `${centerAdmin ? `Markaz admini: markaz akkaunti ${p.phone} belgilandi, RegUP akkaunti shaxsiy raqamga (${phone}) ochildi. ` : ''}Kartochka ochildi, ${onbEnrollments(s, ob).length} ta moslashuv kursi biriktirildi${cardId ? `, kompetensiya kartasi ${cardId} (rekruting baholari shartli)` : '. Kompetensiya modeli hali yo‘q — karta ochilmadi'}${late >= s.onboardingConfig.lateDays ? `. Kech kiritildi: ${late} kun` : ''}.`, id);
  }
  const emp = getEmployee(s, p.employeeId);
  if (!emp) return hrResult(s, ev, 'bad', 'Xato: xodim topilmadi.');
  if (ev.type === 'archive') {
    if (emp.status === 'archived') return hrResult(s, ev, 'muted', 'Allaqachon arxivda.', emp.id);
    const plan = exitPlan(s, emp, p);
    const cat = exitReason(p.reasonCode);
    Object.assign(emp, { status: 'archived', archivedAt: s.today, leftAt: p.leftAt, archiveReason: cat ? cat[1] : p.reason, eduArchiveAt: addDays(p.leftAt, p.eduWaitDays),
      exit: { type: plan.type, reasonCode: p.reasonCode || null, fireReason: plan.type === 'fired' ? (cat?.[3] || p.fireReason) : null, survey: plan.survey, text: plan.text, interviewer: p.interviewer || null } });
    exitFollowUps(s, emp, plan);
    if (plan.late) { const head = branchHead(s, emp.branchId); if (head) onbNotify(s, `latearch:${emp.id}`, head.name, `${emp.name} ${fmtIso(p.leftAt)} da ketgan, arxivga ${daysBetween(p.leftAt, s.today)} kun kechikib yuborildi. Kechikish sababini yozing va keyingi safar ketgan kuni yuboring.`); }
    for (const ob of s.onboardings.filter((o) => o.employeeId === emp.id && o.status === 'active')) ob.status = 'archived';
    for (const e of s.enrollments.filter((x) => x.employeeId === emp.id && x.status === 'in_progress')) e.status = 'archived';
    log(s, actor, 'Xodim arxivlandi', emp.id, { reason: p.reason });
    return hrResult(s, ev, 'warn', `RegUP: arxivlandi, ma’lumotlari saqlandi. Edu: kutish rejimi, ${emp.eduArchiveAt} da avtomatik arxivlanadi. Ketish turi: ${EXIT_TYPES[plan.type]}${plan.survey ? `; so‘rovnoma: «${plan.survey}»` : ''} — ${plan.text}.`, emp.id);
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
    if (!user || !can(user, 'onb.approve') || !inScope(s, user, emp)) fail('Yakuniy bahoni tasdiqlash huquqi va xodim doirasi kerak (odatda filial rahbari)');
    if (isSelf(user, emp.id)) fail('O‘z onboarding natijangizni tasdiqlay olmaysiz — uni shu huquqi bor boshqa admin yoki L&D tasdiqlaydi');
    const r = onboardingScore(s, ob);
    if (!r.passed && !ob.extension && (r.ready || onbDay(s, ob) >= obDays(s, ob))) fail(`Minimumdan o‘tmagan qism bor (${r.parts.filter((p) => !p.ok).map((p) => p.label).join(', ') || 'dastur to‘liq bajarilmagan'}): avval mentor rejasi bilan ${ONB_EXTEND_DAYS} kungacha uzaytiring, past qismlar qayta baholanadi`);
    if (!r.ready && !ob.extension && onbDay(s, ob) < obDays(s, ob)) fail(`Hali erta: ${onbDay(s, ob)}-kun, kurslar ${r.coursesDone}/${r.courses}${r.card.tasks.length ? `, topshiriqlar ${r.tasksDone}/${r.card.tasks.length}` : ''}${r.need ? `, kuzatuv ${r.checks}/${r.need}` : ''}`);
    ob.status = 'completed';
    ob.final = { score: r.score, label: r.label, passed: r.passed, min: r.min, ready: r.ready, parts: r.parts, extended: !!ob.extension, by: user.name, at: s.today, byRole: user.role === 'branch' ? 'Filial rahbari' : head ? user.title : `${user.title} (filial rahbari vakant)` };
    const obs = onbObservations(s, ob);
    const codes = [...new Set(obs.flatMap((o) => Object.keys(o.ratings)))];
    for (const code of codes) {
      const lv = Math.round(avg(obs.map((o) => Number(o.ratings[code])).filter(isNum)));
      emp.records[code] = [...(emp.records[code] || []), { level: lv, context: 'work', source: `Moslashuv: dars kuzatuvlari (${obs.length}), ${user.name} tasdig‘i`, date: s.today }];
    }
    onbNotify(s, `onb-done:${id}`, emp.name, r.passed
      ? `Onboarding muvaffaqiyatli yakunlandi: natija ${String(r.score).replace('.', ',')} / 5 (${r.label}). Barcha qismlar minimumdan (${r.min}) o‘tdi.`
      : `Onboarding yakunlandi: natija ${r.score === null ? '—' : String(r.score).replace('.', ',')} / 5 (${r.label}). Qayta baholashdan keyin ham minimumdan o‘tmagan qism: ${r.parts.filter((p) => !p.ok).map((p) => p.label).join(', ') || 'dastur to‘liq bajarilmagan'}. Keyingi qarorni filial rahbari va HR qabul qiladi.`);
    log(s, user.name, 'Onboarding natijasi tasdiqlandi', `${emp.id} · ${id}`, { after: String(r.score), passed: r.passed });
  });
}

/** Lavozim uchun moslashuv dasturi muddati (kun). Yangi boshlanadigan dasturlarga qo'llanadi. */
export function setProgramDays(state, { position, days, actor = 'HR/L&D' }) {
  return mutate(state, (s) => {
    const d = Number(days);
    if (!(Number.isInteger(d) && d >= 7 && d <= 60)) fail('Muddat 7–60 kun oralig‘ida');
    const prog = s.onboardingPrograms.find((p) => p.position === position);
    if (!prog) fail('Bu lavozim uchun moslashuv dasturi yo‘q');
    const before = prog.days || ONB_DAYS;
    prog.days = d;
    log(s, actor, 'Moslashuv dasturi muddati', position, { before: String(before), after: String(d) });
  });
}

/** Lavozimning onboarding natijasi kartasini sozlash: muddatida yakunlash qismi, minimum, kursdan tashqari topshiriqlar, kuzatuv turi. */
export function setOnbCard(state, { position, patch, actor = 'HR/L&D' }) {
  return mutate(state, (s) => {
    const prog = s.onboardingPrograms.find((p) => p.position === position);
    if (!prog) fail('Bu lavozim uchun moslashuv dasturi yo‘q');
    const card = { ...onbCard(prog), ...(prog.card || {}), ...patch };
    const min = Number(card.min);
    if (!(min >= 1 && min <= 5)) fail('Minimum 1–5 oralig‘ida');
    if (!PRACTICE_KIND[card.practice]) fail('Kuzatuv turi noto‘g‘ri');
    const tasks = (card.tasks || []).map((t) => ({ ...t, name: String(t.name || '').trim() })).filter((t) => t.name);
    const indicators = (card.indicators || []).map((x) => String(x).trim()).filter(Boolean);
    if (card.practice === 'work' && Number(card.checks ?? 1) > 0 && !indicators.length) fail('Ish ko‘rsatkichlari ro‘yxatini kiriting');
    const before = JSON.stringify(onbCard(prog));
    prog.card = { onTime: !!card.onTime, min, tasks, practice: card.practice, checks: Number(card.checks ?? 1), indicators };
    if (card.practice === 'lesson' && patch.observations !== undefined) prog.observations = Number(patch.observations);
    if (card.practice === 'work') prog.observations = 0;
    else if (!prog.observations) prog.observations = 2;
    log(s, actor, 'Onboarding natijasi kartasi', position, { before, after: JSON.stringify(onbCard(prog)) });
  });
}

// ---------- Minimumdan o'tmasa: uzaytirish va faqat past qismlarni qayta baholash (TZ, 2026-11-24) ----------
export const ONB_EXTEND_DAYS = 14;
export const onbExtendMax = (s) => s.onboardingConfig?.extendDays ?? ONB_EXTEND_DAYS;
/** Onboarding holati: faol, uzaytirilgan, yakunlangan, arxivlangan. */
export const onbStatusLabel = (ob) => (ob.status === 'active' ? (ob.extension ? 'uzaytirilgan' : 'faol') : ob.status === 'completed' ? (ob.final?.passed ? 'muvaffaqiyatli' : 'yakunlangan') : ob.status === 'archived' ? 'arxivlangan' : ob.status);
export function extendOnboarding(state, { id, days, plan, userId }) {
  return mutate(state, (s) => {
    const ob = getOnboarding(s, id);
    if (!ob || ob.status !== 'active') fail('Faol moslashuv topilmadi');
    if (ob.extension) fail('Onboarding faqat bir marta uzaytiriladi');
    const emp = getEmployee(s, ob.employeeId);
    const user = getStaff(s, userId);
    if (!user || !can(user, 'onb.approve') || !inScope(s, user, emp)) fail('Uzaytirishni onboarding natijasini tasdiqlash huquqi bor shaxs (odatda filial rahbari) qiladi');
    const r = onboardingScore(s, ob);
    if (!(r.ready || onbDay(s, ob) >= obDays(s, ob))) fail('Dastur hali yakunlanmagan — uzaytirish natija chiqqandan keyin');
    if (r.passed) fail('Barcha qismlar minimumdan o‘tgan — uzaytirish kerak emas');
    const d = Number(days);
    const max = onbExtendMax(s);
    if (!(Number.isInteger(d) && d >= 1 && d <= max)) fail(`Uzaytirish 1–${max} kun`);
    if (!String(plan || '').trim()) fail('Mentor rejasi majburiy: past qism bo‘yicha nima qilinadi');
    const parts = r.failed.length ? r.failed : r.parts.filter((p) => p.value === null).map((p) => p.key);
    ob.extension = { at: s.today, until: addDays(s.today, d), days: d, parts, plan: plan.trim(), by: user.name, regrades: {} };
    const labels = parts.map((k) => ONB_PARTS[k][0]).join(', ');
    onbNotify(s, `onb-ext:${ob.id}`, emp.name, `Onboarding ${d} kunga (${ob.extension.until} gacha) uzaytirildi. Qayta baholanadigan qism: ${labels}. Reja: ${plan.trim()}`);
    const mentor = emp.supervisorId ? getEmployee(s, emp.supervisorId) : null;
    if (mentor) onbNotify(s, `onb-ext:${ob.id}:mentor`, mentor.name, `${emp.name}: onboarding ${ob.extension.until} gacha uzaytirildi. Qayta baholash: ${labels}.`);
    log(s, user.name, 'Onboarding uzaytirildi', `${emp.id} · ${ob.id}`, { after: `${d} kun`, reason: plan.trim() });
  });
}
/** Uzaytirish davrida faqat past qismni qayta baholash (1–5); yangi baho shu qismning qiymatini almashtiradi. */
export function reassessOnbPart(state, { id, part, grade, note = '', userId }) {
  return mutate(state, (s) => {
    const ob = getOnboarding(s, id);
    if (!ob || ob.status !== 'active' || !ob.extension) fail('Uzaytirilgan faol onboarding topilmadi');
    if (!ob.extension.parts.includes(part)) fail('Faqat minimumdan o‘tmagan qism qayta baholanadi');
    const emp = getEmployee(s, ob.employeeId);
    const user = getStaff(s, userId);
    if (!user || !canAny(user, ['onb.assign', 'onb.approve', 'onb.observe']) || !inScope(s, user, emp)) fail('Qayta baholashni mentor, kuzatuvchi yoki filial rahbari qiladi (huquq va xodim doirasi kerak)');
    if (isSelf(user, emp.id)) fail('O‘zingizni baholay olmaysiz — boshqa baholovchi kerak');
    const g = Number(grade);
    if (!(Number.isInteger(g) && g >= 1 && g <= 5)) fail('Baho 1–5');
    if (!String(note || '').trim()) fail('Qayta baholash izohi majburiy');
    ob.extension.regrades = { ...(ob.extension.regrades || {}), [part]: { grade: g, note: note.trim(), by: user.name, at: s.today } };
    onbNotify(s, `onb-re:${ob.id}:${part}:${g}`, emp.name, `«${ONB_PARTS[part][0]}» qayta baholandi: ${g} / 5 — ${note.trim()}.`);
    log(s, user.name, 'Onboarding qismi qayta baholandi', `${emp.id} · ${part}`, { after: String(g), reason: note.trim() });
  });
}

/** Kursdan tashqari amaliy topshiriqqa baho (mentor yoki mas'ul shaxs). */
export function gradeOnbTask(state, { onboardingId, taskId, grade, note = '', userId }) {
  return mutate(state, (s) => {
    const ob = getOnboarding(s, onboardingId);
    if (!ob || ob.status !== 'active') fail('Faol moslashuv topilmadi');
    const emp = getEmployee(s, ob.employeeId);
    const user = getStaff(s, userId);
    if (!user || !canAny(user, ['onb.assign', 'onb.approve']) || !inScope(s, user, emp)) fail('Topshiriqni mentor yoki mas’ul shaxs baholaydi (huquq va xodim doirasi kerak)');
    if (isSelf(user, emp.id)) fail('O‘zingizni baholay olmaysiz — boshqa baholovchi kerak');
    const task = onbCard(onbProgram(s, emp)).tasks.find((t) => t.id === taskId);
    if (!task) fail('Topshiriq topilmadi');
    const g = Number(grade);
    if (!(Number.isInteger(g) && g >= 1 && g <= 5)) fail('Baho 1–5');
    ob.taskGrades = { ...(ob.taskGrades || {}), [taskId]: { grade: g, note, by: user.name, at: s.today } };
    onbNotify(s, `onb-task:${ob.id}:${taskId}:${g}`, emp.name, `«${task.name}» topshirig‘ingiz baholandi: ${g} / 5${note ? ` — ${note}` : ''}.`);
    log(s, user.name, 'Onboarding topshirig‘i baholandi', `${emp.id} · ${task.name}`, { after: String(g) });
  });
}

/** Menejer (ustoz bo'lmagan) uchun ish amaliyotidagi kuzatuv: lavozim kartasidagi ko'rsatkichlar, 1–5. */
export function addWorkCheck(state, { employeeId, ratings, note = '', userId, date }) {
  return mutate(state, (s) => {
    const emp = getEmployee(s, employeeId);
    if (!emp || emp.status === 'archived') fail('Xodim topilmadi');
    const user = getStaff(s, userId);
    if (!user || !canAny(user, ['onb.observe', 'onb.approve']) || !inScope(s, user, emp)) fail('Ish kuzatuvini filial rahbari yoki kuzatuv huquqi bor shaxs kiritadi');
    if (isSelf(user, emp.id)) fail('O‘zingizni baholay olmaysiz — boshqa baholovchi kerak');
    const card = onbCard(onbProgram(s, emp));
    const r = Object.fromEntries(card.indicators.map((k) => [k, ratings?.[k]]).filter(([, v]) => v !== '' && v !== null && v !== undefined).map(([k, v]) => [k, Number(v)]));
    if (Object.keys(r).length < card.indicators.length) fail('Barcha ko‘rsatkichlarni 1–5 baholang');
    if (Object.values(r).some((v) => !(v >= 1 && v <= 5))) fail('Baho 1–5');
    s.workChecks ||= [];
    const id = nextId(s, 'wc');
    s.workChecks.push({ id, employeeId, by: user.name, date: date || s.today, ratings: r, note });
    onbNotify(s, `wc:${id}`, emp.name, `Ish amaliyotingiz kuzatildi (${user.name}): o‘rtacha ${String(r1(avg(Object.values(r)))).replace('.', ',')} / 5.${note ? ` ${note}` : ''}`);
    log(s, user.name, 'Ish amaliyoti kuzatuvi', emp.id, { after: String(r1(avg(Object.values(r)))) });
  });
}

/** Metodist kuzatuvi (checklist, 1–5). */
export function addOnbObservation(state, { employeeId, methodist, date, lesson, group, ratings, note, userId }) {
  return mutate(state, (s) => {
    const emp = getEmployee(s, employeeId);
    if (!emp || emp.status === 'archived') fail('Xodim topilmadi');
    const user = userId ? getStaff(s, userId) : null;
    if (user && !(can(user, 'onb.observe') && inScope(s, user, emp))) fail('Kuzatuvni «Dars kuzatuvi» huquqi bor xodim (metodist) kiritadi');
    if (isSelf(user, emp.id)) fail('O‘zingizni baholay olmaysiz — boshqa baholovchi kerak');
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

// ---------- So'rovnomalar: anonim, faqat filial va lavozim kesimida ----------
/** Onboarding standartlari nazorat ro'yxati: D8 va D30 dagi «Ha/Yo'q» bandlar (1–5 shkalali savollar kirmaydi). */
export const CHECKLIST_ITEMS = [
  ['D8', 'Ishga chiqishdan oldin manzil, vaqt va birinchi kun tartibi yuborildi'],
  ['D8', 'Rahbariyat kompaniya taqdimotini o‘tkazdi'],
  ['D8', 'Rahbar bilan 1:1 suhbat bo‘ldi'],
  ['D8', 'Birinchi kundan mentor yoki buddy biriktirildi'],
  ['D8', 'Ish qurollari va jihozlar bilan ta’minlandi'],
  ['D8', 'Welcome pack berildi'],
  ['D30', 'Tanishtiruv videosi jamoa guruhiga yuborildi'],
  ['D30', 'Bir oylik natijalar bo‘yicha rahbar bilan 1:1 feedback suhbati bo‘ldi'],
];
export const SURVEY_MIN_RATE = 50;
/** Filial bo'yicha so'rovnoma jamlanmasi (javob ulushi, o'rtachalar, eNPS, standartlar bajarilishi). */
export function surveyBranch(s, branchId) {
  const v = s.surveyStats?.byBranch?.[branchId];
  if (!v) return null;
  const rate = v.hires ? (100 * v.d8[0]) / v.hires : null;
  const checklist = v.checklist.length ? v.checklist.reduce((a, b) => a + b, 0) / v.checklist.length : null;
  // Javoblar mazmuni (o'rtachalar, eNPS, standartlar) kamida 5 ta javob bo'lsa ko'rsatiladi; javob ulushi — qatnashuv, har doim.
  return { ...v, branchId, rate, checklistPct: checklist, few: { d8: v.d8[0] < ANON_MIN, d30: v.d30[0] < ANON_MIN, d60: v.d60[0] < ANON_MIN, enps: v.d30[0] + v.d60[0] < ANON_MIN } };
}
/** Javob ulushi past filiallar rahbarlariga eslatma: «filialingizda qatnashish foizi past». */
export function remindLowResponse(state, { actor = 'Tizim (eslatmalar)' } = {}) {
  return mutate(state, (s) => {
    let n = 0;
    for (const id of Object.keys(s.surveyStats?.byBranch || {})) {
      const r = surveyBranch(s, id);
      if (r.rate === null || r.rate >= SURVEY_MIN_RATE) continue;
      const head = branchHead(s, id);
      const to = head?.name || s.staff.find((u) => u.role === 'hr')?.name || 'HR Admin';
      if (notify(s, `svrate:${s.surveyStats.period}:${id}`, to, `${getBranch(s, id)?.name}: yangi xodimlarning so‘rovnomaga javob ulushi ${Math.round(r.rate)}% (maqsad ${SURVEY_MIN_RATE}%). Yangi xodimlarga D8/D30 so‘rovnomasini eslatib qo‘ying — javoblar anonim.`)) { s.notifications[0].tg = true; n += 1; }
    }
    if (!n) fail('Eslatma yuboriladigan filial yo‘q (yoki bu oy yuborilgan)');
    log(s, actor, 'So‘rovnoma qatnashuvi bo‘yicha eslatma', s.surveyStats.period, { n });
  });
}

// ---------- Huquqlar: shaxsga beriladi, har biri filial doirasi bilan (TZ'dagi 6 ta qat'iy rol o'rniga) ----------
export const RIGHTS = [
  ['Moslashuv (onboarding)', [
    ['onb.view', 'Moslashuvni kuzatish', 'Yangi xodimlarning moslashuv jarayoni va onboarding dashboard'],
    ['onb.approve', 'Onboarding natijasini tasdiqlash', 'Dastur yakunida onboarding natijasini tasdiqlaydi'],
    ['onb.assign', 'Mentor, buddy va kurs biriktirish', 'Doirasidagi xodimlarga mentor, buddy va qo‘shimcha kurs biriktiradi'],
    ['onb.observe', 'Ish amaliyotini kuzatish', 'Ustozda dars kuzatuvi (checklist), menejerda ish ko‘rsatkichlari, 1–5'],
    ['onb.integration', 'Integratsiya navbati', 'Jobster va EduTizim hodisalarini qabul qiladi'],
    ['onb.board', 'Onboarding doskasini yuritish', 'Kartani ustunlar orasida qo‘lda ko‘chiradi, izoh qo‘shadi, «Ketdi» deb belgilaydi'],
    ['onb.checkin', 'D8/D30 tekshiruvini tasdiqlash', '«Tekshirish» ustunlarida xodim «Ishlayapti» yoki «Ketdi» deb tasdiqlaydi'],
    ['onb.surveys', 'So‘rovnomalarni boshqarish', 'So‘rovnoma yaratadi, bosqichga bog‘laydi, natijalarni ko‘radi (ismli so‘rovnomada — ism bilan)'],
    ['onb.tasks', 'Topshiriqlar doskasi', 'SOP standartlari va offboarding vazifalarini ko‘radi va «Bajarildi» deb belgilaydi'],
    ['onb.risk', 'Xavf guruhini ko‘rish', 'Doiradagi xavf guruhi ro‘yxati va har xodimning sababi'],
    ['onb.meetings', 'Uchrashuvlarni boshqarish', 'CEO/HRD uchrashuvi: taklif, havola, qatnashuv'],
    ['onb.meetApprove', 'Uchrashuvlarni tasdiqlash', 'Xodimlar taklif qilgan uchrashuvni tasdiqlaydi yoki rad etadi'],
    ['onb.reminders', 'Eslatmalar', 'Kurs va so‘rovnoma eslatmalarini yuboradi'],
  ]],
  ['Baholash', [
    ['cards.assign', 'Baholash kartasini biriktirish', 'Model ruxsat bergan usul va topshiriqlarni tanlaydi'],
    ['cards.assess', 'Kartada baholash', 'Mezon bo‘yicha kompetensiya darajasini qo‘yadi'],
    ['cards.publish', 'E’lon va tayinlash', 'Panel, natijani e’lon qilish, rasmiy tayinlash, stretch va qo‘shimcha dalillar'],
    ['talent.view', 'IDP, nomzod va vorislik', 'Rivojlanish rejalari, ko‘nikmalar, nomzod tanlash, kadrlar zaxirasi'],
    ['models.manage', 'Kompetensiya modellarini boshqarish', 'Model konstruktori: kompetensiyalar, indikatorlar, maqsadli darajalar, o‘tish shartlari'],
  ]],
  ['Kurslar', [
    ['courses.view', 'Kurslarni ko‘rish', 'Kurslar ro‘yxati va mazmuni'],
    ['courses.manage', 'Kurslarni boshqarish', 'Kurs, dars, test va kontent'],
    ['courses.review', 'Kurs kuratori', 'Amaliy topshiriqlarni tekshiradi'],
    ['courses.comments', 'Kurs izohlarini boshqarish', 'Xodimlar fikrini e’lon qiladi (moderatsiya)'],
  ]],
  ['Xodimlar va hisobotlar', [
    ['kpi.view', 'KPI ko‘rsatkichlari', 'Ustozlar KPI va yangi filial KPI'],
    ['people.view', 'Umumiy jamoa a’zolari', 'Doirasidagi barcha xodimlar, profil va foydalanuvchi tarixi'],
    ['org.manage', 'Tashkiliy tuzilma', 'Bo‘limlarni yuritadi, xodimni bo‘limga va jamoadoshlar doirasini belgilaydi'],
    ['team.manage', 'Adminlik berish', 'Adminlarga huquq va doira beradi — faqat o‘zidagi huquqlarni, o‘z doirasi ichida'],
    ['people.message', 'Xabar yuborish', 'Doiradagi xodimlarga filtr bilan qo‘lda xabar: platforma va Telegram'],
    ['gami.manage', 'Gamifikatsiyani boshqarish', 'Ball qoidalari va badge’lar katalogi: nom, belgi, berilish sharti'],
  ]],
  ['Tizim', [
    ['audit.view', 'O‘zgarishlar jurnali', 'Kim nimani o‘zgartirganini ko‘radi'],
    ['system.import', 'Import va qabul sinovlari', 'Exceldan import, UAT'],
  ]],
];
export const ALL_RIGHTS = RIGHTS.flatMap(([, list]) => list.map(([k]) => k));
export const RIGHT_LABEL = Object.fromEntries(RIGHTS.flatMap(([, list]) => list.map(([k, l]) => [k, l])));
/** Lavozim shabloni — faqat yorliq va boshlang'ich huquqlar to'plami; amalda shaxsga berilgan huquqlar ishlaydi. */
export const ROLE_LABEL = { super: 'Super Admin', hr: 'HR Admin', lda: 'L&D assistent', branch: 'Filial rahbari', supervisor: 'Nazoratchi', academic: 'Akademik bo‘lim', mentor: 'Mentor', methodist: 'Metodist', curator: 'Kurator' };
/** Lavozim shablonlarining boshlang'ich huquqlari (TZ 3-bo'lim). Keyin har bir huquq alohida yoqiladi yoki o'chiriladi. */
export const ROLE_PRESETS = {
  hr: ['onb.view', 'onb.approve', 'onb.assign', 'onb.observe', 'onb.integration', 'onb.board', 'onb.surveys', 'onb.tasks', 'onb.risk', 'onb.meetings', 'onb.meetApprove', 'onb.reminders', 'cards.assign', 'cards.assess', 'talent.view', 'courses.view', 'courses.manage', 'courses.review', 'courses.comments', 'kpi.view', 'audit.view', 'people.view', 'people.message', 'org.manage', 'team.manage'],
  lda: ['onb.view', 'onb.assign', 'onb.integration', 'onb.board', 'onb.surveys', 'onb.tasks', 'onb.risk', 'onb.meetings', 'onb.reminders', 'cards.assign', 'cards.publish', 'courses.view', 'courses.comments', 'people.view', 'people.message', 'gami.manage', 'team.manage'],
  branch: ['onb.view', 'onb.approve', 'onb.assign', 'onb.observe', 'onb.checkin', 'onb.tasks', 'onb.meetings', 'onb.reminders', 'cards.assign', 'cards.publish', 'kpi.view', 'courses.view', 'people.view'],
  supervisor: ['onb.view', 'onb.assign', 'onb.tasks', 'cards.assess', 'courses.view', 'people.view'],
  academic: ['onb.view', 'cards.assess', 'models.manage', 'people.view', 'people.message', 'courses.view'],
  mentor: ['onb.view', 'onb.assign', 'cards.assign', 'courses.review', 'kpi.view', 'onb.meetings'],
  methodist: ['onb.view', 'onb.observe', 'cards.assess', 'onb.meetings'],
  curator: ['courses.review', 'courses.view'],
};
export const SCOPE_LABEL = { all: 'Barcha filiallar', branches: 'Tanlangan filiallar', departments: 'Tanlangan bo‘limlar', positions: 'Tanlangan lavozimlar', assigned: 'Faqat o‘ziga biriktirilganlar' };
export const can = (user, right) => !!user && user.active !== false && (user.role === 'super' || (user.rights || []).includes(right));
export const canAny = (user, rights) => rights.some((r) => can(user, r));

/** Huquq doirasidagi xodimlar (null — barcha filiallar). */
export function scopeEmployees(s, user) {
  if (!user) return new Set();
  const sc = user.scope || { kind: 'all' };
  if (user.role === 'super' || sc.kind === 'all') return null;
  if (sc.kind === 'branches') return new Set(s.employees.filter((e) => (sc.branchIds || []).includes(e.branchId)).map((e) => e.id));
  // Bo'lim yoki lavozim bo'yicha doira; filiallar tanlanmasa — barcha filiallarda (masalan, barcha GE ustozlari).
  const inBr = (e) => !(sc.branchIds || []).length || sc.branchIds.includes(e.branchId);
  if (sc.kind === 'departments') return new Set(s.employees.filter((e) => inBr(e) && (sc.departmentIds || []).includes(e.departmentId)).map((e) => e.id));
  if (sc.kind === 'positions') return new Set(s.employees.filter((e) => inBr(e) && (sc.positions || []).includes(e.position)).map((e) => e.id));
  const ids = new Set();
  if (user.employeeId) for (const e of s.employees) if (e.supervisorId === user.employeeId || e.buddyId === user.employeeId) ids.add(e.id);
  for (const e of s.employees) if ((user.positions || []).includes(e.position)) ids.add(e.id);
  for (const en of s.enrollments) if ((user.courseIds || []).includes(en.courseId)) ids.add(en.employeeId);
  return ids;
}
/** Doiradagi filiallar (null — hammasi): dashboard va filial kesimidagi hisobotlar uchun. */
export function scopeBranches(s, user) {
  const ids = scopeEmployees(s, user);
  if (ids === null) return null;
  if ((user.scope || {}).kind === 'branches') return new Set(user.scope.branchIds || []);
  if (['departments', 'positions'].includes((user.scope || {}).kind) && (user.scope.branchIds || []).length) return new Set(user.scope.branchIds);
  return new Set(s.employees.filter((e) => ids.has(e.id)).map((e) => e.branchId));
}
export const inScope = (s, user, emp) => { const sc = scopeEmployees(s, user); return sc === null || sc.has(emp.id); };

/** Mentor va buddy biriktirish (huquq: «Mentor, buddy va kurs biriktirish», xodim doirada bo'lishi kerak). */
export function assignMentorBuddy(state, { employeeId, mentorId, buddyId, userId }) {
  return mutate(state, (s) => {
    const emp = getEmployee(s, employeeId);
    const user = getStaff(s, userId);
    if (!emp) fail('Xodim topilmadi');
    if (!can(user, 'onb.assign') || !inScope(s, user, emp)) fail('Mentor va buddy biriktirish huquqi va xodim doirasi kerak');
    if (mentorId && mentorId === buddyId) fail('Mentor va buddy bir odam bo‘lmasin — buddy norasmiy qo‘llab-quvvatlovchi');
    for (const id of [mentorId, buddyId].filter(Boolean)) if (id === employeeId || !getEmployee(s, id)) fail('Mentor yoki buddy noto‘g‘ri tanlangan');
    const before = `${emp.supervisorId || '—'} / ${emp.buddyId || '—'}`;
    if (mentorId !== undefined) emp.supervisorId = mentorId || null;
    if (buddyId !== undefined) emp.buddyId = buddyId || null;
    const b = buddyId ? getEmployee(s, buddyId) : null;
    if (b) onbNotify(s, `buddy:${emp.id}:${b.id}`, b.name, `Siz ${emp.name}ga buddy etib biriktirildingiz: birinchi oyda jamoaga moslashishda norasmiy qo‘llab-quvvatlang.`);
    log(s, user.name, 'Mentor/buddy biriktirildi', emp.id, { before, after: `${emp.supervisorId || '—'} / ${emp.buddyId || '—'}` });
  });
}

/** Huquq beruvchi: «Adminlik berish» huquqi bor, o'zida yo'q huquqni bera olmaydi (TZ 3-bo'lim, qaror №57). */
function checkGranter(s, byId, right) {
  if (!byId) return null;
  const by = getStaff(s, byId);
  if (!by || !can(by, 'team.manage')) fail('Huquq berish uchun «Adminlik berish» huquqi kerak');
  if (right && !can(by, right)) fail(`O‘zingizda yo‘q huquqni bera olmaysiz: «${RIGHT_LABEL[right]}»`);
  return by;
}
/** Doira tor-kengligi: berilayotgan doira beruvchining doirasidan keng bo'lmasin. */
function scopeWithin(s, by, scope) {
  const mine = scopeEmployees(s, by);
  if (mine === null) return true;
  const theirs = scopeEmployees(s, { scope, role: 'x' });
  return theirs !== null && [...theirs].every((id) => mine.has(id));
}
export function setStaffRight(state, { userId, right, on, actor = 'Super Admin', byId }) {
  return mutate(state, (s) => {
    const u = getStaff(s, userId);
    if (!u) fail('Admin topilmadi');
    if (u.role === 'super') fail('Super Admin barcha huquqlarga ega');
    if (!ALL_RIGHTS.includes(right)) fail('Noma’lum huquq');
    const by = checkGranter(s, byId, right);
    if (by && by.id === u.id) fail('O‘zingizga huquq bera olmaysiz');
    const set = new Set(u.rights || []);
    if (on) set.add(right); else set.delete(right);
    u.rights = ALL_RIGHTS.filter((r) => set.has(r));
    u.changedAt = s.today;
    log(s, actor, on ? 'Huquq berildi' : 'Huquq olib tashlandi', `${u.name} · ${RIGHT_LABEL[right]}`);
  });
}
export function setStaffScope(state, { userId, kind, branchIds = [], departmentIds = [], positions = [], actor = 'Super Admin', byId }) {
  return mutate(state, (s) => {
    const u = getStaff(s, userId);
    if (!u) fail('Admin topilmadi');
    if (!SCOPE_LABEL[kind]) fail('Noma’lum doira');
    const by = checkGranter(s, byId);
    if (by && kind !== 'assigned' && !scopeWithin(s, by, { kind, branchIds, departmentIds, positions })) fail('O‘z doirangizdan kengroq doira bera olmaysiz');
    if (kind === 'branches' && !branchIds.length) fail('Kamida bitta filialni tanlang');
    if (kind === 'departments' && !departmentIds.length) fail('Kamida bitta bo‘limni tanlang');
    if (kind === 'positions' && !positions.length) fail('Kamida bitta lavozimni tanlang');
    u.scope = kind === 'branches' ? { kind, branchIds } : kind === 'departments' ? { kind, departmentIds, branchIds } : kind === 'positions' ? { kind, positions, branchIds } : { kind };
    if (kind === 'branches') u.branchIds = branchIds;
    u.changedAt = s.today;
    log(s, actor, 'Huquq doirasi o‘zgardi', u.name, { after: scopeText(s, u.scope) });
  });
}
/** Doira matni: «Akademik bo'lim — Chilonzor», «GE — barcha filiallarda». */
export function scopeText(s, sc = { kind: 'all' }) {
  const br = (sc.branchIds || []).map((b) => getBranch(s, b)?.name).join(', ');
  if (sc.kind === 'branches') return br;
  if (sc.kind === 'departments') return `${(sc.departmentIds || []).map((d) => getDepartment(s, d)?.name).join(', ')} — ${br || 'barcha filiallarda'}`;
  if (sc.kind === 'positions') return `${(sc.positions || []).join(', ')} — ${br || 'barcha filiallarda'}`;
  return SCOPE_LABEL[sc.kind];
}
export function setStaffActive(state, { userId, active, actor = 'Super Admin' }) {
  return mutate(state, (s) => {
    const u = getStaff(s, userId);
    if (!u || u.role === 'super') fail('Bu akkauntni o‘chirib bo‘lmaydi');
    u.active = !!active;
    log(s, actor, active ? 'Admin faollashtirildi' : 'Admin nofaol qilindi', u.name);
  });
}

/** Admin o'z yozuvi bo'yicha baholovchi bo'la olmaydi (TZ 3-bo'lim, qaror №59). */
export const isSelf = (user, employeeId) => !!user && !!employeeId && user.employeeId === employeeId;
/**
 * Topshiriqni bitta mas'ul tekshiradi. Zaxira tartib: kurs kuratori (topshiriq egasining o'zi bo'lmasa) → mentor →
 * doiradagi boshqa «Kurs kuratori» → L&D. Hech kim o'z topshirig'ini tekshirmaydi.
 */
export function taskReviewer(s, enr) {
  const course = getCourse(s, enr.courseId);
  const emp = getEmployee(s, enr.employeeId);
  const ok = (u) => u && u.active !== false && !isSelf(u, emp.id);
  const cur = course.curatorId ? getStaff(s, course.curatorId) : null;
  if (ok(cur)) return { kind: 'curator', user: cur };
  const mentor = emp.supervisorId ? s.staff.find((u) => u.role === 'mentor' && u.employeeId === emp.supervisorId) : null;
  if (ok(mentor)) return { kind: 'mentor', user: mentor };
  const other = s.staff.find((u) => u.role !== 'super' && ok(u) && u.id !== cur?.id && can(u, 'courses.review') && inScope(s, u, emp));
  if (other) return { kind: 'curator2', user: other };
  const ld = s.staff.find((u) => u.role === 'lda' && ok(u)) || s.staff.find((u) => u.role === 'hr' && ok(u));
  return { kind: 'ld', user: ld || null };
}
export const REVIEWER_KIND = { curator: 'kurs kuratori', mentor: 'xodim mentori', curator2: 'boshqa kurator (zaxira)', ld: 'L&D (zaxira)' };
export function canReviewTask(s, user, enr) {
  if (!user || isSelf(user, enr.employeeId)) return false;
  if (can(user, 'courses.manage')) return true;
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

// ---------------------------------------------------------------------------
// Gamifikatsiya: ballar (TZ «yulduzlar») va badge'lar katalogi. Badge — faqat noodatiy natija uchun;
// onboardingni minimumdan o'tish badge emas. Kompetensiya darajalari ball va reytingga kirmaydi.
// ---------------------------------------------------------------------------
export const POINT_ACTIONS = {
  lesson: ['Dars o‘qildi', 5],
  test: ['Test topshirildi', 10],
  task: ['Amaliy topshiriq qabul qilindi', 15],
  course: ['Kurs yakunlandi', 30],
  grade5: ['Kurs 5 bahoga yakunlandi (qo‘shimcha)', 20],
};
export const BADGE_KINDS = {
  grade5: ['Kursni 5 kurs bahosi bilan yakunlash', 'kurs'],
  streak: ['Uzluksiz o‘qish: har hafta faol', 'hafta'],
  points: ['Ball chegarasi', 'ball'],
  courses: ['Yakunlangan kurslar soni', 'kurs'],
};
const weekKey = (iso) => { const d = new Date(`${iso}T00:00:00Z`); const day = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - day); return d.toISOString().slice(0, 10); };
/** Xodim harakatlari va to'plangan ballar (kurs yozuvlaridan hisoblanadi). */
export function employeePoints(s, employeeId) {
  const rules = s.gamification?.points || {};
  const pts = (k) => Number(rules[k] ?? POINT_ACTIONS[k][1]);
  const items = [];
  for (const enr of (s.enrollments || []).filter((e) => e.employeeId === employeeId)) {
    const course = getCourse(s, enr.courseId);
    if (!course) continue;
    for (const c of course.components) {
      const p = enr.progress[c.id];
      if (!p) continue;
      if (c.kind === 'lesson' && p.done) items.push({ kind: 'lesson', at: p.at, course: course.title });
      if (c.kind === 'test' && isNum(testScore(p)) && testScore(p) >= c.passScore) items.push({ kind: 'test', at: p.at, course: course.title });
      if (c.kind === 'task' && p.status === 'accepted') items.push({ kind: 'task', at: p.mentor?.at || p.submittedAt, course: course.title });
    }
    if (enr.status === 'completed') {
      items.push({ kind: 'course', at: enr.completedAt, course: course.title });
      if (courseGrade(course, enr) === 5) items.push({ kind: 'grade5', at: enr.completedAt, course: course.title });
    }
  }
  items.forEach((x) => { x.points = pts(x.kind); });
  return { total: items.reduce((a, x) => a + x.points, 0), items: items.sort((a, b) => ((b.at || '') > (a.at || '') ? 1 : -1)) };
}
/** Ketma-ket faol haftalar (eng uzun seriya). */
export function learningStreak(s, employeeId) {
  const weeks = [...new Set(employeePoints(s, employeeId).items.filter((x) => x.at).map((x) => weekKey(x.at)))].sort();
  let best = 0; let cur = 0; let prev = null;
  for (const w of weeks) {
    cur = prev && daysBetween(prev, w) === 7 ? cur + 1 : 1;
    best = Math.max(best, cur);
    prev = w;
  }
  return best;
}
/** Xodimga berilgan badge'lar: katalogdagi shart bajarilganmi (holat kurs yozuvlaridan hisoblanadi). */
export function employeeBadges(s, employeeId) {
  const enrs = (s.enrollments || []).filter((e) => e.employeeId === employeeId && e.status === 'completed');
  const five = enrs.filter((e) => courseGrade(getCourse(s, e.courseId), e) === 5).length;
  const pts = employeePoints(s, employeeId).total;
  const streak = learningStreak(s, employeeId);
  const val = { grade5: five, streak, points: pts, courses: enrs.length };
  return (s.gamification?.badges || []).filter((b) => b.active !== false).map((b) => ({ ...b, value: val[b.kind], earned: val[b.kind] >= b.n })).filter((b) => b.earned);
}
/** Reyting: ballar bo'yicha, lavozim / filial / umumiy kesimda. Kompetensiya darajasi kirmaydi. */
export function ratingList(s, { position = '', branchId = '' } = {}) {
  return activeEmployees(s).filter((e) => (!position || e.position === position) && (!branchId || e.branchId === branchId))
    .map((e) => ({ emp: e, points: employeePoints(s, e.id).total, badges: employeeBadges(s, e.id) }))
    .sort((a, b) => b.points - a.points || a.emp.name.localeCompare(b.emp.name))
    .map((r, i) => ({ ...r, rank: i + 1 }));
}
export function saveBadge(state, { badge, actor = 'L&D' }) {
  return mutate(state, (s) => {
    const name = String(badge.name || '').trim();
    if (!name) fail('Badge nomini kiriting');
    if (!BADGE_KINDS[badge.kind]) fail('Shart turini tanlang');
    const n = Number(badge.n);
    if (!(Number.isInteger(n) && n >= 1)) fail('Shart qiymati butun son, kamida 1');
    s.gamification ||= { points: {}, badges: [] };
    const list = s.gamification.badges;
    const b = { id: badge.id || nextId(s, 'bdg'), name, icon: badge.icon || '🏅', kind: badge.kind, n, desc: String(badge.desc || '').trim(), active: badge.active !== false };
    const i = list.findIndex((x) => x.id === b.id);
    if (i >= 0) list[i] = b; else list.push(b);
    log(s, actor, i >= 0 ? 'Badge o‘zgartirildi' : 'Badge qo‘shildi', name, { after: `${BADGE_KINDS[b.kind][0]} ≥ ${n}` });
  });
}
export function removeBadge(state, { id, actor = 'L&D' }) {
  return mutate(state, (s) => {
    const b = (s.gamification?.badges || []).find((x) => x.id === id);
    if (!b) fail('Badge topilmadi');
    s.gamification.badges = s.gamification.badges.filter((x) => x.id !== id);
    log(s, actor, 'Badge o‘chirildi', b.name);
  });
}
export function setPointRule(state, { kind, points, actor = 'L&D' }) {
  return mutate(state, (s) => {
    if (!POINT_ACTIONS[kind]) fail('Noma’lum harakat');
    const v = Number(points);
    if (!(Number.isInteger(v) && v >= 0 && v <= 1000)) fail('Ball 0–1000, butun son');
    s.gamification ||= { points: {}, badges: [] };
    const before = s.gamification.points[kind] ?? POINT_ACTIONS[kind][1];
    s.gamification.points[kind] = v;
    log(s, actor, 'Ball qoidasi', POINT_ACTIONS[kind][0], { before: String(before), after: String(v) });
  });
}

// ---------------------------------------------------------------------------
// Tashkiliy tuzilma (LMS'da qo'lda): filial → bo'lim. Xodim ma'lumotlari EduTizim'dan keladi.
// Jamoadoshlar: xodim sukut bo'yicha o'z filialini ko'radi; doira sozlanadi (bo'lim yoki bir necha filial).
// ---------------------------------------------------------------------------
export const getDepartment = (s, id) => (s.departments || []).find((d) => d.id === id);
export const branchDepartments = (s, branchId) => (s.departments || []).filter((d) => !d.branchIds?.length || d.branchIds.includes(branchId));
export const COLLEAGUE_SCOPE = { branch: 'O‘z filiali (standart)', department: 'O‘z filialidagi bo‘limi', branches: 'Tanlangan filiallar' };
export function colleaguesOf(s, emp) {
  const sc = emp.colleagues || { kind: 'branch' };
  return activeEmployees(s).filter((e) => e.id !== emp.id && (
    sc.kind === 'department' ? e.branchId === emp.branchId && e.departmentId === emp.departmentId
      : sc.kind === 'branches' ? [emp.branchId, ...(sc.branchIds || [])].includes(e.branchId)
        : e.branchId === emp.branchId));
}
/** Sertifikat: yakunlangan kurs, kurs bahosi chegaradan past emas. */
export function certificates(s, employeeId) {
  return (s.enrollments || []).filter((e) => e.employeeId === employeeId && e.status === 'completed').map((e) => ({ enr: e, course: getCourse(s, e.courseId), grade: courseGrade(getCourse(s, e.courseId), e) }))
    .filter((x) => x.course && x.course.certificate !== false && (x.grade === null || x.grade >= courseMinGrade(x.course)))
    .map((x) => ({ ...x, no: `RU-${x.enr.id.replace(/\D/g, '').padStart(4, '0')}`, at: x.enr.completedAt }));
}
/** Foydalanuvchi tarixi (admin ko'radi): kurslar, boshlangan va tugagan sanalar, kurs bahosi, sertifikat. */
export function userHistory(s, employeeId) {
  const certs = new Set(certificates(s, employeeId).map((c) => c.enr.id));
  return (s.enrollments || []).filter((e) => e.employeeId === employeeId).map((e) => {
    const course = getCourse(s, e.courseId);
    return { enr: e, course, startedAt: e.startedAt, completedAt: e.status === 'completed' ? e.completedAt : null, grade: courseGrade(course, e), ...courseProgress(course, e), cert: certs.has(e.id) };
  }).sort((a, b) => (b.startedAt > a.startedAt ? 1 : -1));
}
export function saveDepartment(state, { id, name, branchIds = [], userId }) {
  return mutate(state, (s) => {
    const user = getStaff(s, userId);
    if (!can(user, 'org.manage')) fail('Tashkiliy tuzilmani «Tashkiliy tuzilma» huquqi bor admin yuritadi');
    const nm = String(name || '').trim();
    if (!nm) fail('Bo‘lim nomini kiriting');
    s.departments ||= [];
    if (s.departments.some((d) => d.id !== id && d.name.toLowerCase() === nm.toLowerCase())) fail('Bunday bo‘lim bor');
    const d = id ? getDepartment(s, id) : null;
    if (d) Object.assign(d, { name: nm, branchIds });
    else s.departments.push({ id: nextId(s, 'd'), name: nm, branchIds });
    log(s, user.name, d ? 'Bo‘lim o‘zgartirildi' : 'Bo‘lim qo‘shildi', nm, { after: branchIds.length ? branchIds.map((b) => getBranch(s, b)?.name).join(', ') : 'barcha filiallar' });
  });
}
export function removeDepartment(state, { id, userId }) {
  return mutate(state, (s) => {
    const user = getStaff(s, userId);
    if (!can(user, 'org.manage')) fail('Huquq yo‘q');
    const d = getDepartment(s, id);
    if (!d) fail('Bo‘lim topilmadi');
    const n = activeEmployees(s).filter((e) => e.departmentId === id).length;
    if (n) fail(`Bo‘limda ${n} ta xodim bor — avval ularni boshqa bo‘limga o‘tkazing`);
    s.departments = s.departments.filter((x) => x.id !== id);
    log(s, user.name, 'Bo‘lim o‘chirildi', d.name);
  });
}
export function setEmployeeDepartment(state, { employeeId, departmentId, userId }) {
  return mutate(state, (s) => {
    const user = getStaff(s, userId);
    const emp = getEmployee(s, employeeId);
    if (!emp) fail('Xodim topilmadi');
    if (!can(user, 'org.manage') || !inScope(s, user, emp)) fail('Huquq va xodim doirasi kerak');
    const d = getDepartment(s, departmentId);
    if (!d || (d.branchIds?.length && !d.branchIds.includes(emp.branchId))) fail('Bu bo‘lim xodim filialida yo‘q');
    const before = getDepartment(s, emp.departmentId)?.name || '—';
    emp.departmentId = departmentId;
    log(s, user.name, 'Xodim bo‘limi', emp.name, { before, after: d.name });
  });
}
export function setColleaguesScope(state, { employeeId, kind, branchIds = [], userId }) {
  return mutate(state, (s) => {
    const user = getStaff(s, userId);
    const emp = getEmployee(s, employeeId);
    if (!emp) fail('Xodim topilmadi');
    if (!can(user, 'org.manage') || !inScope(s, user, emp)) fail('Huquq va xodim doirasi kerak');
    if (!COLLEAGUE_SCOPE[kind]) fail('Noma’lum doira');
    if (kind === 'branches' && !branchIds.filter((b) => b !== emp.branchId).length) fail('Qo‘shimcha filialni tanlang');
    emp.colleagues = kind === 'branch' ? undefined : kind === 'branches' ? { kind, branchIds: branchIds.filter((b) => b !== emp.branchId) } : { kind };
    log(s, user.name, 'Jamoadoshlar doirasi', emp.name, { after: COLLEAGUE_SCOPE[kind] });
  });
}

export const DEPT_BY_POSITION = { GE: 'd-acad', FIN: 'd-fin', FR: 'd-mgmt', ADM: 'd-adm' };
/** EduTizim'dagi bo'lim nomi yoki lavozim bo'yicha LMS bo'limi. */
export function deptFor(s, position, name) {
  const byName = name && (s.departments || []).find((d) => d.name.toLowerCase().startsWith(String(name).toLowerCase().split(' ')[0]));
  return byName?.id || DEPT_BY_POSITION[position] || null;
}

// ---------------------------------------------------------------------------
// Onboarding doskasi (TZ 5-bo'lim): Jobster'dagi «Мониторинг Адаптации» o'rnini bosadi.
// Karta ish boshlash sanasidan kunlar bo'yicha avtomatik o'tadi; «Tekshirish» ustunida filial rahbari
// tasdiqlamaguncha keyingi ustunga o'tmaydi; «Onboarding doskasini yuritish» huquqi bor admin qo'lda ko'chiradi.
// ---------------------------------------------------------------------------
export const ONB_BOARD = [
  ['start', 'Начальный (qabul kuni)', 'Preboarding: akkaunt, dastur, mentor va buddy'],
  ['induction', 'Induction', 'Ishga chiqqan kundan 7-kungacha: orientatsiya'],
  ['check8', 'Tekshirish — D8', 'Filial rahbari «Ishlayapti» yoki «Ketdi» deb tasdiqlaydi'],
  ['d8', 'D8', 'D8 so‘rovnomasi yuboriladi'],
  ['check30', 'Tekshirish — D30', 'Filial rahbari tasdiqlaydi'],
  ['d30', 'D30', 'D30 so‘rovnomasi; KPI kela boshlaydi'],
  ['hrd', 'HRD bilan suhbat', 'CEO/HRD uchrashuvi; 60-kungacha turadi'],
];
export const BOARD_LABEL = Object.fromEntries(ONB_BOARD.map(([k, l]) => [k, l]));
const boardIdx = (k) => ONB_BOARD.findIndex(([x]) => x === k);
export const CHECK_DUE = { d8: 7, d30: 30 };
export const CHECK_LATE_DAYS = 2;
/** Kunlar va tasdiqlar bo'yicha avtomatik ustun. */
export function boardAuto(s, ob) {
  const day = onbDay(s, ob);
  const c = ob.checks || {};
  if (day <= 0) return 'start';
  if (day < CHECK_DUE.d8) return 'induction';
  if (!c.d8) return 'check8';
  if (day < CHECK_DUE.d30) return 'd8';
  if (!c.d30) return 'check30';
  const ceo = ceoMeetingOf(s, ob.employeeId);
  return ceo ? 'hrd' : 'd30';
}
/** Qo'lda ko'chirish avtomatik ustun o'zgarmaguncha amal qiladi. */
export function boardColumn(s, ob) {
  const auto = boardAuto(s, ob);
  const mv = ob.boardMove;
  return mv && mv.autoAt === auto ? mv.column : auto;
}
/** «Tekshirish» ustunida necha kun turibdi (kechikish: 2 kundan ortiq). */
export function checkLate(s, ob) {
  const col = boardColumn(s, ob);
  if (col !== 'check8' && col !== 'check30') return 0;
  const due = col === 'check8' ? CHECK_DUE.d8 : CHECK_DUE.d30;
  return Math.max(0, onbDay(s, ob) - due);
}
export const boardItems = (s, user) => (s.onboardings || []).filter((o) => o.status === 'active' && (!user || inScope(s, user, getEmployee(s, o.employeeId))));
function boardLog(s, ob, by, text) {
  ob.boardLog = [...(ob.boardLog || []), { at: s.today, by, text }];
}
export function moveBoardCard(state, { id, column, note = '', userId }) {
  return mutate(state, (s) => {
    const ob = getOnboarding(s, id);
    if (!ob || ob.status !== 'active') fail('Faol moslashuv topilmadi');
    const emp = getEmployee(s, ob.employeeId);
    const user = getStaff(s, userId);
    if (!can(user, 'onb.board') || !inScope(s, user, emp)) fail('Kartani ko‘chirish uchun «Onboarding doskasini yuritish» huquqi va xodim doirasi kerak');
    if (boardIdx(column) < 0) fail('Noma’lum ustun');
    const from = boardColumn(s, ob);
    if (from === column) fail('Karta allaqachon shu ustunda');
    ob.boardMove = { column, autoAt: boardAuto(s, ob), at: s.today, by: user.name };
    boardLog(s, ob, user.name, `${BOARD_LABEL[from]} → ${BOARD_LABEL[column]} (qo‘lda)${note ? `: ${note}` : ''}`);
    log(s, user.name, 'Onboarding doskasi: karta ko‘chirildi', `${emp.id} · ${ob.id}`, { before: from, after: column, reason: note || undefined });
  });
}
export function addBoardNote(state, { id, text, userId }) {
  return mutate(state, (s) => {
    const ob = getOnboarding(s, id);
    const emp = ob && getEmployee(s, ob.employeeId);
    const user = getStaff(s, userId);
    if (!ob || !can(user, 'onb.board') || !inScope(s, user, emp)) fail('Izoh uchun «Onboarding doskasini yuritish» huquqi va xodim doirasi kerak');
    if (!String(text || '').trim()) fail('Izoh matnini yozing');
    ob.notes = [...(ob.notes || []), { at: s.today, by: user.name, text: text.trim() }];
    log(s, user.name, 'Onboarding doskasi: izoh', `${emp.id} · ${ob.id}`, { after: text.trim() });
  });
}
/** D8/D30 tekshiruvi: «Ishlayapti» — karta keyingi ustunga o'tadi; «Ketdi» — ketish kutilmoqda + HR'ga EduTizim'da arxivlash vazifasi. */
export function confirmCheck(state, { id, which, result, note = '', userId }) {
  return mutate(state, (s) => {
    const ob = getOnboarding(s, id);
    if (!ob || ob.status !== 'active') fail('Faol moslashuv topilmadi');
    const emp = getEmployee(s, ob.employeeId);
    const user = getStaff(s, userId);
    if (!can(user, result === 'left' ? 'onb.checkin' : 'onb.checkin') || !inScope(s, user, emp)) fail('Tekshiruvni «D8/D30 tekshiruvini tasdiqlash» huquqi bor admin (odatda filial rahbari) tasdiqlaydi');
    if (isSelf(user, emp.id)) fail('O‘zingiz bo‘yicha tekshiruvni tasdiqlay olmaysiz');
    if (!CHECK_DUE[which]) fail('Tekshiruv turi noto‘g‘ri');
    if (onbDay(s, ob) < CHECK_DUE[which]) fail(`${which.toUpperCase()} tekshiruvi ${CHECK_DUE[which]}-kundan boshlanadi`);
    if ((ob.checks || {})[which]) fail('Bu tekshiruv allaqachon tasdiqlangan');
    if (which === 'd30' && !(ob.checks || {}).d8) fail('Avval D8 tekshiruvi tasdiqlanadi');
    const late = Math.max(0, onbDay(s, ob) - CHECK_DUE[which]);
    if (result === 'working') {
      ob.checks = { ...(ob.checks || {}), [which]: { at: s.today, by: user.name, late } };
      boardLog(s, ob, user.name, `${which.toUpperCase()} tekshiruvi: ishlayapti${late > CHECK_LATE_DAYS ? ` (${late} kun kechikib)` : ''}`);
      log(s, user.name, `${which.toUpperCase()} tekshiruvi tasdiqlandi`, `${emp.id} · ${ob.id}`, { after: 'ishlayapti' });
      return;
    }
    if (result !== 'left') fail('Natija: «Ishlayapti» yoki «Ketdi»');
    markLeaving(s, ob, emp, user.name, note || `${which.toUpperCase()} tekshiruvida`);
  });
}
function markLeaving(s, ob, emp, by, note) {
  if (ob.leaving) fail('Xodim allaqachon «ketish kutilmoqda» holatida');
  ob.leaving = { at: s.today, by, note };
  boardLog(s, ob, by, `Ketdi deb belgilandi — ${note}`);
  const hr = s.staff.find((u) => u.role === 'hr');
  addBoardTask(s, { key: `archive:${emp.id}`, title: `${emp.name}: EduTizim'da arxivlang (ketish turi va sababi bilan)`, source: 'offboarding', branchId: emp.branchId, employeeId: null, about: emp.id, assignee: hr?.name || 'HR' });
  log(s, by, 'Xodim «Ketdi» deb belgilandi', `${emp.id} · ${ob.id}`, { reason: note });
}
export function markLeft(state, { id, note = '', userId }) {
  return mutate(state, (s) => {
    const ob = getOnboarding(s, id);
    if (!ob || ob.status !== 'active') fail('Faol moslashuv topilmadi');
    const emp = getEmployee(s, ob.employeeId);
    const user = getStaff(s, userId);
    if (!canAny(user, ['onb.board', 'onb.checkin']) || !inScope(s, user, emp)) fail('«Ketdi» belgisi uchun doska yoki tekshiruv huquqi va xodim doirasi kerak');
    markLeaving(s, ob, emp, user.name, note || 'doskada belgilandi');
  });
}
/** D8/D30 tekshiruvlarini o'z vaqtida (2 kun ichida) tasdiqlash ulushi. */
export function checkTimeliness(s, scope = null) {
  const list = (s.onboardings || []).filter((o) => !scope || scope.has(getEmployee(s, o.employeeId)?.branchId)).flatMap((o) => Object.values(o.checks || {}));
  if (!list.length) return { n: 0, pct: null };
  return { n: list.length, pct: (100 * list.filter((c) => (c.late || 0) <= CHECK_LATE_DAYS).length) / list.length };
}

/** Jobster'dan o'tish: jarayondagi xodimlar ustuni, sanalari va izohlari bilan import qilinadi; «Department» → «Начальный». */
export const JOBSTER_COLUMN = { 'Начальный': 'start', Department: 'start', Induction: 'induction', 'Tekshirish - D8': 'check8', D8: 'd8', 'Tekshirish - D30': 'check30', D30: 'd30', 'HRD bilan suhbat': 'hrd' };
export function importJobsterBoard(state, { userId }) {
  return mutate(state, (s) => {
    const user = getStaff(s, userId);
    if (!can(user, 'onb.integration')) fail('Import uchun «Integratsiya navbati» huquqi kerak');
    const rows = (s.jobsterBoard || []).filter((r) => !r.imported);
    if (!rows.length) fail('Jobster doskasidan import qilinadigan yozuv qolmagan');
    for (const r of rows) {
      const id = nextId(s, 'e');
      const emp = { id, name: r.name, position: r.position, currentLevel: r.level, branchId: r.branchId, phone: r.phone, jobsterId: r.jobsterId, eduId: r.eduId, source: r.source || 'recruiting',
        hiredAt: r.startedAt, levelSince: r.startedAt, kpi10m: null, status: 'active', supervisorId: null, history: [{ level: r.level, from: r.startedAt, doc: `Jobster ATS · ${r.jobsterId}` }], records: {} };
      emp.departmentId = deptFor(s, r.position, r.department);
      emp.profile = { gender: r.gender || null, city: getBranch(s, r.branchId)?.region || '', telegram: r.telegram || '', birthday: null, email: '', about: '' };
      s.employees.push(emp);
      const ob = startOnboarding(s, emp, { startedAt: r.startedAt, enteredAt: r.startedAt, source: emp.source, actor: 'Jobster import' });
      const column = JOBSTER_COLUMN[r.column] || 'start';
      const ci = boardIdx(column);
      ob.checks = {};
      if (ci > boardIdx('check8')) ob.checks.d8 = { at: r.columnAt || s.today, by: 'Jobster (import)', late: 0 };
      if (ci > boardIdx('check30')) ob.checks.d30 = { at: r.columnAt || s.today, by: 'Jobster (import)', late: 0 };
      if (boardAuto(s, ob) !== column) ob.boardMove = { column, autoAt: boardAuto(s, ob), at: s.today, by: 'Jobster (import)' };
      ob.imported = { from: 'jobster', column: r.column, columnAt: r.columnAt || null };
      ob.notes = r.note ? [{ at: r.columnAt || s.today, by: 'Jobster', text: r.note }] : [];
      ob.boardLog = [{ at: r.columnAt || s.today, by: 'Jobster (import)', text: `Jobster ustuni «${r.column}» → ${BOARD_LABEL[column]}` }];
      r.imported = id;
    }
    log(s, user.name, 'Jobster doskasidan import', 'onboarding', { count: rows.length });
  });
}

// ---------------------------------------------------------------------------
// Topshiriqlar doskasi (TZ 11-bo'lim): «Yangi» va «Bajarildi».
// ---------------------------------------------------------------------------
function addBoardTask(s, { key, title, source, branchId, employeeId = null, about = null, assignee, standard = null }) {
  s.boardTasks ||= [];
  if (key && s.boardTasks.some((t) => t.key === key && t.status !== 'done')) return null;
  const t = { id: nextId(s, 'tk'), key, title, source, branchId, employeeId, about, assignee, standard, status: 'new', createdAt: s.today };
  s.boardTasks.unshift(t);
  if (assignee) onbNotify(s, `task:${t.id}`, assignee, `Topshiriqlar doskasida yangi vazifa: ${title}`);
  return t;
}
export const TASK_SOURCE = { survey: 'So‘rovnoma (SOP standarti)', offboarding: 'Offboarding' };
export const canSeeTask = (s, user, t) => {
  if (!can(user, 'onb.tasks')) return false;
  const br = scopeBranches(s, user);
  return br === null || br.has(t.branchId);
};
/** Mas'ul «Bajarildi» deb belgilaydi; ismli holatda vazifa xodim tasdig'idan keyin yopiladi. */
export function completeBoardTask(state, { id, note = '', userId }) {
  return mutate(state, (s) => {
    const t = (s.boardTasks || []).find((x) => x.id === id);
    const user = getStaff(s, userId);
    if (!t || t.status !== 'new') fail('Ochiq vazifa topilmadi');
    if (!canSeeTask(s, user, t)) fail('Vazifani yopish uchun «Topshiriqlar doskasi» huquqi va filial doirasi kerak');
    t.doneBy = user.name; t.doneAt = s.today; t.note = note;
    if (t.employeeId) {
      t.status = 'confirm';
      const emp = getEmployee(s, t.employeeId);
      onbNotify(s, `task-confirm:${t.id}`, emp.name, `${user.name}: «${t.title}» bajarildi deb belgiladi. Tasdiqlang yoki izoh yozing.`);
    } else t.status = 'done';
    log(s, user.name, 'Topshiriqlar doskasi: bajarildi', t.id, { after: t.title });
  });
}
export function confirmBoardTask(state, { id, employeeId, ok = true }) {
  return mutate(state, (s) => {
    const t = (s.boardTasks || []).find((x) => x.id === id);
    if (!t || t.status !== 'confirm' || t.employeeId !== employeeId) fail('Tasdiqlanadigan vazifa topilmadi');
    t.status = ok ? 'done' : 'new';
    t.confirmedAt = s.today;
    log(s, getEmployee(s, employeeId).name, ok ? 'Vazifa bajarilganini tasdiqladi' : 'Vazifa bajarilmagan deb qaytardi', t.id);
  });
}

// ---------------------------------------------------------------------------
// So'rovnoma konstruktori (TZ 11-bo'lim): D8, D30, D60, Fail Case, exit-intervyu, rahbar so'rovnomasi va qo'lda.
// «Javoblar HR bo'limiga ko'rinsin» — har so'rovnomada, standart o'chiq (anonim).
// ---------------------------------------------------------------------------
export const SURVEY_TRIGGERS = { d8: 'D8 ustuni', d30: 'D30 ustuni', d60: '60-kun', fail: 'Fail Case (30 kun ichida ketdi)', 'exit-self': 'Exit: o‘z xohishi bilan', 'exit-fired': 'Exit: haydalgan', 'manager-exit': 'Rahbar so‘rovnomasi (ketish)', manual: 'Qo‘lda yuborish' };
export const QUESTION_TYPES = { yesno: 'Ha / Yo‘q', scale5: 'Shkala 1–5', nps: 'Tavsiya 0–10', single: 'Bitta tanlov', multi: 'Bir nechta tanlov', text: 'Matn' };
export const isNegative = (q, v) => {
  if (v === undefined || v === null || v === '') return false;
  if (q.type === 'yesno') return (q.standard !== null && q.standard !== undefined || q.negative) && v === 'no';
  if (q.type === 'scale5') return !!q.negative && Number(v) <= 2;
  if (q.type === 'nps') return !!q.negative && Number(v) <= 6;
  if (q.type === 'single') return !!q.negative && (q.negativeOptions || []).includes(v);
  return false;
};
export function saveSurvey(state, { survey, userId }) {
  return mutate(state, (s) => {
    const user = getStaff(s, userId);
    if (!can(user, 'onb.surveys')) fail('So‘rovnoma uchun «So‘rovnomalarni boshqarish» huquqi kerak');
    const name = String(survey.name || '').trim();
    if (!name) fail('So‘rovnoma nomi majburiy');
    if (!SURVEY_TRIGGERS[survey.trigger]) fail('Bog‘lanish turini tanlang');
    const qs = (survey.questions || []).map((q) => ({ ...q, text: String(q.text || '').trim(), options: (q.options || []).map((o) => String(o).trim()).filter(Boolean) })).filter((q) => q.text);
    if (!qs.length) fail('Kamida bitta savol kiriting');
    for (const q of qs) {
      if (!QUESTION_TYPES[q.type]) fail(`Savol turi noto‘g‘ri: ${q.text}`);
      if (['single', 'multi'].includes(q.type) && q.options.length < 2) fail(`«${q.text}»: kamida 2 ta variant`);
    }
    s.surveys ||= [];
    const prev = survey.id && s.surveys.find((x) => x.id === survey.id);
    const id = prev ? prev.id : nextId(s, 'sv');
    const out = { id, name, trigger: survey.trigger, hrVisible: !!survey.hrVisible, active: survey.active !== false, questions: qs.map((q, i) => ({ ...q, id: q.id || `q${i + 1}` })), updatedAt: s.today, by: user.name };
    if (prev) Object.assign(prev, out); else s.surveys.push(out);
    log(s, user.name, prev ? 'So‘rovnoma o‘zgartirildi' : 'So‘rovnoma yaratildi', id, { after: `${name} · ${SURVEY_TRIGGERS[out.trigger]} · ${out.hrVisible ? 'ismli' : 'anonim'}` });
  });
}
export const surveyFor = (s, trigger) => (s.surveys || []).find((x) => x.trigger === trigger && x.active !== false) || null;
export const surveyLink = (sendId) => `regup.uz/s/${sendId}`;
function sendSurvey(s, sv, { employeeId = null, to, about = null, onboardingId = null, link = false }) {
  if (!sv) return null;
  s.surveySends ||= [];
  const key = `${sv.id}:${employeeId || to}:${about || ''}`;
  if (s.surveySends.some((x) => x.key === key)) return null;
  const id = nextId(s, 'ss');
  s.surveySends.push({ id, key, surveyId: sv.id, employeeId, to, about, onboardingId, at: s.today, answeredAt: null, link });
  onbNotify(s, `sv:${id}`, to, `So‘rovnoma: «${sv.name}». ${sv.hrVisible ? 'Javoblaringiz HR bo‘limiga ismingiz bilan ko‘rinadi.' : 'Javoblar anonim — faqat filial va lavozim kesimida ko‘rinadi.'} Havola: ${surveyLink(id)}${link ? ' (tizimga kirmasdan to‘ldiriladi)' : ''}`);
  return id;
}
/** Doskadagi bosqichga yetgan, hali yuborilmagan onboarding so'rovnomalari. */
export function dueSurveySends(s) {
  const out = [];
  for (const ob of (s.onboardings || []).filter((o) => o.status === 'active' && !o.leaving)) {
    const col = boardColumn(s, ob);
    const day = onbDay(s, ob);
    const emp = getEmployee(s, ob.employeeId);
    for (const [trig, ok] of [['d8', boardIdx(col) >= boardIdx('d8')], ['d30', boardIdx(col) >= boardIdx('d30')], ['d60', day >= 60]]) {
      const sv = surveyFor(s, trig);
      if (!ok || !sv) continue;
      if ((s.surveySends || []).some((x) => x.surveyId === sv.id && x.employeeId === emp.id)) continue;
      out.push({ ob, emp, sv });
    }
  }
  return out;
}
export function sendDueSurveys(state, { actor = 'Tizim (so‘rovnomalar)' } = {}) {
  return mutate(state, (s) => {
    const list = dueSurveySends(s);
    if (!list.length) fail('Yuboriladigan yangi so‘rovnoma yo‘q');
    for (const { ob, emp, sv } of list) sendSurvey(s, sv, { employeeId: emp.id, to: emp.name, onboardingId: ob.id });
    log(s, actor, 'Onboarding so‘rovnomalari yuborildi', s.today, { count: list.length });
  });
}
export function sendManualSurvey(state, { surveyId, branchId = '', position = '', userId }) {
  return mutate(state, (s) => {
    const user = getStaff(s, userId);
    if (!can(user, 'onb.surveys')) fail('«So‘rovnomalarni boshqarish» huquqi kerak');
    const sv = (s.surveys || []).find((x) => x.id === surveyId);
    if (!sv) fail('So‘rovnoma topilmadi');
    const list = activeEmployees(s).filter((e) => inScope(s, user, e) && (!branchId || e.branchId === branchId) && (!position || e.position === position));
    let n = 0;
    for (const e of list) if (sendSurvey(s, sv, { employeeId: e.id, to: e.name })) n += 1;
    if (!n) fail('Yangi qabul qiluvchi yo‘q (filtr yoki avval yuborilgan)');
    log(s, user.name, 'So‘rovnoma qo‘lda yuborildi', sv.id, { count: n });
  });
}
/** Javob: anonim so'rovnomada xodim javobga bog'lanmaydi. Salbiy javoblar → doska vazifasi va (ismli bo'lsa) xavf guruhi. */
export function answerSurvey(state, { sendId, answers }) {
  return mutate(state, (s) => {
    const send = (s.surveySends || []).find((x) => x.id === sendId);
    if (!send) fail('Havola noto‘g‘ri');
    if (send.answeredAt) fail('Bu so‘rovnomaga javob berilgan');
    const sv = (s.surveys || []).find((x) => x.id === send.surveyId);
    for (const q of sv.questions) if (q.type !== 'text' && (answers?.[q.id] === undefined || answers[q.id] === '' || (Array.isArray(answers[q.id]) && !answers[q.id].length))) fail(`Savolga javob bering: «${q.text}»`);
    const emp = getEmployee(s, send.about || send.employeeId);
    const branchId = emp?.branchId || null;
    const position = emp?.position || null;
    send.answeredAt = s.today;
    s.surveyResponses ||= [];
    s.surveyResponses.push({ id: nextId(s, 'sr'), surveyId: sv.id, employeeId: sv.hrVisible ? send.employeeId : null, about: sv.hrVisible ? send.about : null, branchId, position, at: s.today, answers: { ...answers } });
    const negatives = sv.questions.filter((q) => isNegative(q, answers[q.id]));
    if (sv.hrVisible && send.employeeId) {
      const respondent = getEmployee(s, send.employeeId);
      for (const q of negatives.filter((x) => x.standard !== null && x.standard !== undefined)) {
        const head = branchHead(s, respondent.branchId);
        addBoardTask(s, { key: `std:${send.id}:${q.id}`, title: `${respondent.name}: «${CHECKLIST_ITEMS[q.standard][1]}» — bajarilmagan`, source: 'survey', branchId: respondent.branchId, employeeId: respondent.id, assignee: head?.name || 'HR', standard: q.standard });
      }
      const ob = onboardingOf(s, respondent.id);
      if (ob && ob.status === 'active' && negatives.length) ob.surveyFlags = [...(ob.surveyFlags || []), { at: s.today, survey: sv.name, items: negatives.map((q) => q.text) }];
    } else if (branchId) {
      // Anonim: filial bo'yicha nomsiz vazifa, faqat filialda shu so'rovnomaga kamida 5 ta javob bo'lsa.
      const rs = s.surveyResponses.filter((r) => r.surveyId === sv.id && r.branchId === branchId);
      if (rs.length >= ANON_MIN) {
        for (const q of sv.questions.filter((x) => x.type === 'yesno' && x.standard !== null && x.standard !== undefined)) {
          const no = rs.filter((r) => r.answers[q.id] === 'no').length;
          if (!no) continue;
          const head = branchHead(s, branchId);
          addBoardTask(s, { key: `std:${sv.id}:${branchId}:${q.id}`, title: `${getBranch(s, branchId)?.name}: «${CHECKLIST_ITEMS[q.standard][1]}» — ${no} ta yangi xodim «Yo‘q» dedi (${rs.length} ta javob)`, source: 'survey', branchId, assignee: head?.name || 'HR', standard: q.standard });
        }
      }
    }
    log(s, sv.hrVisible ? (emp?.name || send.to) : 'Anonim respondent', 'So‘rovnomaga javob', sv.id);
  });
}
/** Natijalar: anonim so'rovnoma faqat agregat va kamida 5 ta javob bo'lsa; ismli — ism bilan (huquq bilan). */
export function surveyResults(s, surveyId, user, { branchId = '', position = '' } = {}) {
  const sv = (s.surveys || []).find((x) => x.id === surveyId);
  const br = user ? scopeBranches(s, user) : null;
  const rs = (s.surveyResponses || []).filter((r) => r.surveyId === surveyId && (br === null || br.has(r.branchId)) && (!branchId || r.branchId === branchId) && (!position || r.position === position));
  const sent = (s.surveySends || []).filter((x) => x.surveyId === surveyId).length;
  const few = !sv.hrVisible && rs.length < ANON_MIN;
  const questions = sv.questions.map((q) => {
    const vals = rs.map((r) => r.answers[q.id]).filter((v) => v !== undefined && v !== '');
    let summary = null;
    if (q.type === 'yesno') summary = { yes: vals.length ? (100 * vals.filter((v) => v === 'yes').length) / vals.length : null };
    if (q.type === 'scale5') summary = { avg: vals.length ? avg(vals.map(Number)) : null };
    if (q.type === 'nps') { const n = vals.map(Number); summary = { nps: n.length ? (100 * (n.filter((v) => v >= 9).length - n.filter((v) => v <= 6).length)) / n.length : null }; }
    if (q.type === 'single' || q.type === 'multi') { const flat = vals.flatMap((v) => (Array.isArray(v) ? v : [v])); summary = { counts: q.options.map((o) => [o, flat.filter((v) => v === o).length]) }; }
    if (q.type === 'text') summary = { texts: vals };
    return { q, n: vals.length, summary };
  });
  return { sv, n: rs.length, sent, few, questions, named: sv.hrVisible ? rs : [] };
}
/** Ketish yo'nalishi: Fail Case yoki exit-intervyu havolasi, L&D vazifasi, rahbar so'rovnomasi. */
function exitFollowUps(s, emp, plan) {
  for (const t of (s.boardTasks || []).filter((x) => x.key === `archive:${emp.id}` && x.status === 'new')) Object.assign(t, { status: 'done', doneAt: s.today, doneBy: 'EduTizim arxiv signali' });
  if (plan.type === 'returns' || plan.type === 'duplicate' || plan.late) return;
  const trig = plan.survey === 'Fail Case 30-day' ? 'fail' : plan.type === 'fired' ? 'exit-fired' : 'exit-self';
  sendSurvey(s, surveyFor(s, trig), { employeeId: emp.id, to: emp.name, link: true });
  if (trig !== 'fail') {
    const ld = s.staff.find((u) => u.role === 'lda') || s.staff.find((u) => u.role === 'hr');
    addBoardTask(s, { key: `exit:${emp.id}`, title: `${emp.name}: xayrlashish va exit-intervyuni yuborish (${EXIT_TYPES[plan.type]})`, source: 'offboarding', branchId: emp.branchId, about: emp.id, assignee: ld?.name || 'L&D' });
  }
  const head = branchHead(s, emp.branchId);
  if (head) sendSurvey(s, surveyFor(s, 'manager-exit'), { to: head.name, about: emp.id, link: true });
}

// ---------------------------------------------------------------------------
// Uchrashuvlar: istalgan xodim taklif qiladi, HR'dagi admin tasdiqlaydi, xodimlar o'zi yoziladi (qaror №62).
// ---------------------------------------------------------------------------
export function proposeMeeting(state, { employeeId, title, about = '', date, time, format, link, place }) {
  return mutate(state, (s) => {
    const emp = getEmployee(s, employeeId);
    if (!emp || emp.status === 'archived') fail('Xodim topilmadi');
    if (!String(title || '').trim()) fail('Mavzuni yozing');
    if (!date || date <= s.today) fail('Sana bugundan keyin bo‘lsin');
    if (format === 'online' && !String(link || '').trim()) fail('Onlayn uchrashuv uchun havola kerak');
    if (format === 'offline' && !String(place || '').trim()) fail('Joyini yozing');
    const id = nextId(s, 'mt');
    s.meetings.push({ id, title: title.trim(), about: about.trim(), kind: 'share', status: 'proposed', proposerId: emp.id, date, time: time || '15:00', format, link: format === 'online' ? link.trim() : '', place: format === 'offline' ? place.trim() : '', organizer: emp.name, invited: [], attended: [], selfSignup: true });
    for (const u of s.staff.filter((x) => x.role !== 'super' && can(x, 'onb.meetApprove'))) onbNotify(s, `mtp:${id}:${u.id}`, u.name, `${emp.name} uchrashuv taklif qildi: «${title.trim()}» (${date}). Tasdiqlang yoki rad eting.`);
    log(s, emp.name, 'Uchrashuv taklif qilindi', id, { after: title.trim() });
  });
}
export function reviewMeeting(state, { id, decision, note = '', userId }) {
  return mutate(state, (s) => {
    const m = s.meetings.find((x) => x.id === id);
    const user = getStaff(s, userId);
    if (!m || m.status !== 'proposed') fail('Tasdiq kutayotgan uchrashuv topilmadi');
    if (!can(user, 'onb.meetApprove')) fail('Uchrashuvni «Uchrashuvlarni tasdiqlash» huquqi bor admin (HR) tasdiqlaydi');
    if (decision === 'rejected' && !String(note).trim()) fail('Rad etish sababini yozing');
    m.status = decision === 'approved' ? 'approved' : 'rejected';
    m.review = { by: user.name, at: s.today, note };
    const emp = getEmployee(s, m.proposerId);
    if (emp) onbNotify(s, `mtr:${id}`, emp.name, m.status === 'approved' ? `«${m.title}» tasdiqlandi — xodimlar endi unga yozila oladi.` : `«${m.title}» rad etildi: ${note}`);
    log(s, user.name, m.status === 'approved' ? 'Uchrashuv tasdiqlandi' : 'Uchrashuv rad etildi', id, { reason: note || undefined });
  });
}
export function joinMeeting(state, { id, employeeId, leave = false }) {
  return mutate(state, (s) => {
    const m = s.meetings.find((x) => x.id === id);
    if (!m || (m.status && m.status !== 'approved') || !m.selfSignup) fail('Yozilish ochiq uchrashuv topilmadi');
    if (m.date < s.today) fail('Uchrashuv o‘tib ketgan');
    if (m.proposerId === employeeId) fail('Siz tashkilotchisiz');
    m.invited = m.invited.filter((x) => x !== employeeId);
    if (!leave) m.invited.push(employeeId);
    log(s, getEmployee(s, employeeId).name, leave ? 'Uchrashuvdan chiqdi' : 'Uchrashuvga yozildi', id);
  });
}
export const meetingVisible = (m) => !m.status || m.status === 'approved';

// ---------------------------------------------------------------------------
// Qo'lda xabar (qaror №63): doiradagi xodimlarga filtr bilan, platforma va Telegram, bir tomonlama.
// ---------------------------------------------------------------------------
export function messageRecipients(s, user, { branchId = '', position = '', departmentId = '' } = {}) {
  return activeEmployees(s).filter((e) => inScope(s, user, e) && (!branchId || e.branchId === branchId) && (!position || e.position === position) && (!departmentId || e.departmentId === departmentId));
}
export function sendMessage(state, { userId, text, branchId = '', position = '', departmentId = '' }) {
  return mutate(state, (s) => {
    const user = getStaff(s, userId);
    if (!can(user, 'people.message')) fail('Xabar uchun «Xabar yuborish» huquqi kerak');
    if (!String(text || '').trim()) fail('Xabar matnini yozing');
    const list = messageRecipients(s, user, { branchId, position, departmentId });
    if (!list.length) fail('Filtrga mos xodim yo‘q');
    const id = nextId(s, 'msg');
    for (const e of list) onbNotify(s, `${id}:${e.id}`, e.name, `${user.name}: ${text.trim()}`);
    s.messages ||= [];
    s.messages.unshift({ id, by: user.name, at: s.today, text: text.trim(), filter: { branchId, position, departmentId }, n: list.length });
    log(s, user.name, 'Xabar yuborildi', id, { count: list.length, after: text.trim() });
  });
}

// ---------------------------------------------------------------------------
// O'z-o'zini baholash (qaror №60): baholovchiga ko'rinadi, daraja va «2 manba» qoidasiga kirmaydi.
// ---------------------------------------------------------------------------
export function setSelfScore(state, { cardId, employeeId, code, level, note = '' }) {
  return mutate(state, (s) => {
    const card = getCard(s, cardId);
    if (!card || card.employeeId !== employeeId) fail('Karta topilmadi');
    if (card.stage === 'published' || card.stage === 'closed') fail('E’lon qilingan kartada o‘zini baholab bo‘lmaydi');
    const model = getModel(s, card.modelVersionId);
    if (!model.competencies.some((c) => c.code === code)) fail('Kompetensiya topilmadi');
    const lv = Number(level);
    if (!(Number.isInteger(lv) && lv >= 1 && lv <= scaleMax(model))) fail(`Daraja 1–${scaleMax(model)}`);
    card.selfScores = { ...(card.selfScores || {}), [code]: { level: lv, note: String(note).trim(), at: s.today } };
    log(s, getEmployee(s, employeeId).name, 'O‘zini baholadi', `${cardId} · ${code}`, { after: String(lv) });
  });
}

// ---------------------------------------------------------------------------
// Ikki rolli xodim (qaror №50): karta bitta — ichida har rol modeli alohida bo'lim, har bo'limda o'z lavozim
// darajasi. Korporativ klaster kompetensiyalari bir marta baholanadi va ikkala bo'limga tatbiq etiladi.
// Prototipda bo'lim — asosiy kartaga bog'langan yozuv (sectionOf); e'lon har bo'limda alohida.
// ---------------------------------------------------------------------------
export const SHARED_LAYER = 'Korporativ';
/** Kartaning barcha bo'limlari (asosiy birinchi). */
export function cardSections(s, card) {
  const root = card.sectionOf ? getCard(s, card.sectionOf) : card;
  if (!root) return [card];
  return [root, ...s.cards.filter((c) => c.sectionOf === root.id && c.stage !== 'closed')];
}
export function isSharedComp(s, card, code) {
  const model = getModel(s, card.modelVersionId);
  return model?.competencies.find((c) => c.code === code)?.layer === SHARED_LAYER;
}
/** Korporativ baho bir bo'limda o'zgarsa — boshqa bo'limlarga ham yoziladi (ikki marta baholanmaydi). */
function syncShared(s, card, code) {
  if (!isSharedComp(s, card, code)) return;
  for (const other of cardSections(s, card)) {
    if (other.id === card.id || other.stage === 'published') continue;
    const m = getModel(s, other.modelVersionId);
    if (!m.competencies.some((c) => c.code === code)) continue;
    other.scores[code] = { ...structuredClone(card.scores[code]), sharedFrom: card.id };
  }
}
/** Ikkinchi rol bo'limini ochish: xodimning ikkinchi lavozimi modeli bo'yicha, korporativ baholar ko'chiriladi. */
export function openRoleSection(state, { cardId, actor = 'HR/L&D', userId }) {
  return mutate(state, (s) => {
    const root = getCard(s, cardId);
    if (!root || root.sectionOf) fail('Asosiy karta topilmadi');
    if (root.stage === 'published' || root.stage === 'closed') fail('E’lon qilingan kartaga bo‘lim qo‘shilmaydi');
    const user = userId ? getStaff(s, userId) : null;
    if (user && !can(user, 'cards.assign')) fail('Bo‘lim ochish uchun «Baholash kartasini biriktirish» huquqi kerak');
    const emp = getEmployee(s, root.employeeId);
    const r2 = emp.secondRole;
    if (!r2) fail('Xodimda ikkinchi rol belgilanmagan');
    if (cardSections(s, root).length > 1) fail('Ikkinchi rol bo‘limi allaqachon ochilgan');
    const model = activeModel(s, r2.position);
    if (!model) fail(`${r2.position} lavozimi uchun kompetensiya modeli yo‘q — bo‘lim ochilmaydi`);
    if (!model.profiles.some((p) => p.code === r2.level)) fail(`${r2.level} darajasi ${model.name} modelida yo‘q`);
    const id = nextId(s, 'c');
    const scores = {};
    for (const [code, v] of Object.entries(root.scores)) if (isSharedComp(s, root, code) && model.competencies.some((c) => c.code === code)) scores[code] = { ...structuredClone(v), sharedFrom: root.id };
    s.cards.unshift({
      id, sectionOf: root.id, cycleId: root.cycleId, origin: root.origin, provisional: root.provisional, employeeId: emp.id, modelVersionId: model.id,
      profileFrom: model.transition ? (r2.from || null) : null, profileTo: r2.level, branchId: root.branchId, stage: root.stage === 'draft' ? 'draft' : 'evidence', revision: 1, deadline: root.deadline,
      targetRoleId: null, stretchId: null, assessors: { evaluator: model.evaluatorRole || 'Assessor', calibrator: 'L&D' },
      scores, hrScores: {}, observations: [], gates: {}, kpi: null, panel: null, appointment: null, published: null, createdAt: s.today,
    });
    log(s, user?.name || actor, 'Ikkinchi rol bo‘limi ochildi', `${root.id} → ${id}`, { after: `${model.id} · ${r2.level} · umumiy korporativ: ${Object.keys(scores).length}` });
  });
}
