import { describe, it, expect } from 'vitest';
import { UAT } from '../src/core/uat.js';
import { computeMatch, computeRScope, minIntegerForThreshold, computeNewBranchKpi, auditAverage, independentSources, DE } from '../src/core/calc.js';
import { validateModel } from '../src/core/rules.js';
import { validateImport } from '../src/core/importValidate.js';
import { frModel, teacherModel } from '../src/data/models.js';
import { createSeed } from '../src/data/seed.js';
import { SAMPLE_IMPORT_OK } from '../src/core/uat.js';

describe('Qabul sinovlari (UAT 01–15)', () => {
  for (const u of UAT) {
    it(`${u.id} — ${u.title}`, () => {
      const r = u.run();
      expect(r.pass, r.actual).toBe(true);
    });
  }
});

describe('Hisoblash yadrosi', () => {
  it('FR maqsadli yig‘indilar 48 / 61 / 76', () => {
    expect(frModel.profiles.map((p) => Object.values(p.targets).reduce((a, b) => a + b, 0))).toEqual([48, 61, 76]);
  });
  it('95% uchun minimal butun ball: 48 / 58 / 73', () => {
    expect([48, 61, 76].map((t) => minIntegerForThreshold(t, 95))).toEqual([46, 58, 73]);
  });
  it('FR-3: 72 ÷ 76 = 94,7%, 73 ÷ 76 = 96,1%', () => {
    const t = frModel.profiles[2].targets;
    const s72 = { ...t, 'KOR-01': 4, 'KOR-02': 4, 'KOR-03': 4, 'LDR-01': 4 };
    const s73 = { ...t, 'KOR-01': 4, 'KOR-02': 4, 'KOR-03': 4 };
    expect(computeMatch(t, s72).match.toFixed(1)).toBe('94.7');
    expect(computeMatch(t, s73).match.toFixed(1)).toBe('96.1');
  });
  it('R ko‘lami', () => {
    expect(computeRScope(1, 40)).toBe('R1');
    expect(computeRScope(1, 41)).toBe('R2');
    expect(computeRScope(2, 100)).toBe('R2');
    expect(computeRScope(2, 101)).toBe('R3');
    expect(computeRScope(3, 20)).toBe('R3');
  });
  it('Yangi filial KPI namunasi 89,3%', () => {
    const k = computeNewBranchKpi(createSeed().kpiNewBranch.items, { compliance: true, complianceEvidence: 'akt' });
    expect(k.result.toFixed(1)).toBe('89.3');
    expect(k.passed).toBe(true);
  });
  it('Audit o‘rtachasi kamida 2 dalilli band bilan', () => {
    expect(auditAverage([{ level: 4, evidence: 'x' }])).toBe(DE);
    expect(auditAverage([{ level: 4, evidence: 'x' }, { level: 3, evidence: 'y' }])).toBe(3.5);
  });
  it('Bir hujjat nusxalari bitta mustaqil manba', () => {
    expect(independentSources([{ sourceId: 'A' }, { sourceId: 'A' }, { sourceId: 'B' }])).toBe(2);
  });
  it('Modellar e’lon tekshiruvidan o‘tadi', () => {
    expect(validateModel(frModel)).toEqual([]);
    expect(validateModel(teacherModel)).toEqual([]);
  });
  it('To‘g‘ri import qoralama ma’lumot qaytaradi', () => {
    const r = validateImport(SAMPLE_IMPORT_OK);
    expect(r.ok).toBe(true);
    expect(r.data.profiles[0].targets).toEqual({ 'SRV-01': 3, 'SRV-02': 3 });
  });
});

import * as D from '../src/core/domain.js';
describe('Ish oqimi', () => {
  it('E’lon qilingan tavsiya tayinlashdan keyin o‘zgarmaydi', () => {
    let s = createSeed();
    s = D.setScore(s, { cardId: 'c-101', code: 'LDR-05', final: 4, basis: 'x' });
    s = D.advanceStage(s, { cardId: 'c-101' });
    s = D.recordPanel(s, { cardId: 'c-101', decision: 'appoint', protocol: 'p', members: 'm' });
    s = D.advanceStage(s, { cardId: 'c-101' });
    s = D.advanceStage(s, { cardId: 'c-101' });
    s = D.recordAppointment(s, { cardId: 'c-101', docNo: 'B-1', effectiveDate: '2026-12-01' });
    expect(D.cardDecision(s, D.getCard(s, 'c-101')).status).toBe('recommend_appoint');
  });
  it('Panel tayyor bo‘lmagan kartaga tayinlash qarorini bera olmaydi', () => {
    let s = createSeed();
    s = D.setScore(s, { cardId: 'c-101', code: 'LDR-05', final: 2, basis: 'x' });
    s = D.advanceStage(s, { cardId: 'c-101' });
    expect(() => D.recordPanel(s, { cardId: 'c-101', decision: 'appoint', protocol: 'p' })).toThrow(/Tayyor emas/);
  });
  it('Faol karta dublikati bloklanadi', () => {
    const s = createSeed();
    expect(() => D.openCard(s, { cycleId: 'cy-2026-k', employeeId: 'e-dilshod', modelId: 'FR', profileTo: 'FR-2', branchId: 'b-chil' })).toThrow(/dublikat/);
  });
});

import { weightedLevel } from '../src/core/calc.js';
import { evaluateDecision } from '../src/core/rules.js';
import { geModel } from '../src/data/models.js';
import { profileThreshold, compMethods } from '../src/core/modelKit.js';

describe('Moslashuvchan model', () => {
  it('General English modeli jadvaldagi maqsad yig‘indilariga mos (25/44/66/84/100) va e’lon tekshiruvidan o‘tadi', () => {
    const sums = geModel.profiles.map((p) => Object.values(p.targets).reduce((a, b) => a + b, 0));
    expect(sums).toEqual([25, 44, 66, 84, 100]);
    expect(geModel.competencies).toHaveLength(22);
    expect(validateModel(geModel)).toEqual([]);
    expect(profileThreshold(geModel, 'LT-2')).toBe(100);
    expect(profileThreshold(geModel, 'LT-4')).toBe(95);
  });

  it('Konstruktor: 1–4 shkalali yangi lavozim → kompetensiya, usul, profil, faollashtirish, karta va qaror', () => {
    let s = createSeed();
    s = D.createModel(s, { modelId: 'SOTUV', name: 'Sotuv menejeri', scaleMax: 4 });
    const id = 'SOTUV@0.1';
    expect(validateModel(D.getModel(s, id)).length).toBeGreaterThan(0);
    s = D.addCompetency(s, { id, fromCode: 'KOR-01' }); // umumiy korporativ kompetensiya kutubxonadan
    s = D.addCompetency(s, { id, comp: { code: 'SOT-01', name: 'Mijoz ehtiyojini aniqlash', layer: 'Kasbiy' } });
    expect(() => D.addCompetency(s, { id, comp: { code: 'SOT-01', name: 'x' } })).toThrow(/allaqachon/);
    s = D.addMethod(s, { id, name: 'Mijoz bilan rolli o‘yin', kind: 'case' });
    s = D.addProfile(s, { id, code: 'SOT-1', name: 'Sotuv menejeri' });
    s = D.updateDraft(s, { id, patch: (m) => {
      for (const c of m.competencies) c.levels = { 1: 'a', 2: 'b', 3: 'c', 4: 'd' }; // 1–4 indikatorlar (KOR-01 5 darajali edi — qayta yoziladi)
      m.profiles[0].targets = { 'KOR-01': 3, 'SOT-01': 4 };
      m.scoring = { mode: 'weighted', weights: { interview: 40, case_2: 20, case: 30, work_sample: 30 } }; // 120% — xato
    } });
    expect(validateModel(D.getModel(s, id)).some((e) => e.includes('vazn'))).toBe(true);
    s = D.updateDraft(s, { id, patch: (m) => { m.scoring.weights = { interview: 40, case: 30, work_sample: 30, case_2: 0 }; m.methods = m.methods.filter((x) => x !== 'case_2'); delete m.scoring.weights.case_2; } });
    expect(validateModel(D.getModel(s, id))).toEqual([]);
    s = D.setModelStatus(s, { id, status: 'review', actor: 'HR/L&D' });
    s = D.setModelStatus(s, { id, status: 'active', actor: 'HRD' });
    s = D.openCard(s, { cycleId: 'cy-2026-k', employeeId: 'e-sardor', modelId: 'SOTUV', profileTo: 'SOT-1', branchId: 'b-samq' });
    const card = s.cards[0];
    expect(() => D.setScore(s, { cardId: card.id, code: 'SOT-01', final: 5, basis: 'x' })).toThrow(/1–4/);
    s = D.addEvidence(s, { cardId: card.id, code: 'SOT-01', method: 'interview', value: 4, note: '' });
    s = D.addEvidence(s, { cardId: card.id, code: 'SOT-01', method: 'case', value: 3, note: '' });
    const evs = D.getCard(s, card.id).scores['SOT-01'].evidences;
    expect(weightedLevel(evs, D.getModel(s, id).scoring.weights, 4)).toMatchObject({ value: 4, missing: ['work_sample'] }); // (40·4 + 30·3) / 70 = 3,57 → 4
    s = D.setScore(s, { cardId: card.id, code: 'SOT-01', final: 4, basis: 'Rolli o‘yin va intervyu' });
    s = D.setScore(s, { cardId: card.id, code: 'KOR-01', final: 3, basis: 'BEI' });
    const d = D.cardDecision(s, D.getCard(s, card.id));
    expect(d.match.match).toBe(100);
    expect(d.status).toBe('met');
  });

  it('Bitta dars kuzatuvi bir nechta kompetensiyaga dalil bo‘ladi; gate bajarilmasa daraja bloklanadi', () => {
    let s = createSeed();
    s = D.addObservation(s, { cardId: 'c-103', obs: { methodist: 'M', date: '2026-11-08', lesson: 'L', group: 'G', behavior: 'B', ratings: { 'BEH-01': 3, 'GEN-02': 4, 'GEN-07': '' } } });
    const card = D.getCard(s, 'c-103');
    expect(card.observations).toHaveLength(2);
    expect(card.scores['BEH-01'].evidences[0].method).toBe('observation');
    expect(card.scores['GEN-07']).toBeUndefined();
    expect(D.observationAverage(card.observations)).toBeCloseTo((2.75 + 3.5) / 2);
    expect(() => D.setGate(s, { cardId: 'c-103', code: 'course', met: true, evidence: '' })).toThrow(/dalil/);
    // Hamma kompetensiya maqsadda, lekin "course" gate ochiq → tayyor emas
    const p = geModel.profiles.find((x) => x.code === 'LT-2');
    const ev = Object.fromEntries(Object.keys(p.targets).map((c) => [c, compMethods(geModel, geModel.competencies.find((x) => x.code === c))]));
    const ctx = { currentLevel: 'LT-1', tenureMonths: 11, kpi: { type: 'regular', value: 82 }, observations: 2, observationAvg: 3.2, evidenceMethods: ev, gates: { lang: { met: true } } };
    const d = evaluateDecision(geModel, p, p.targets, ctx);
    expect(d.status).toBe('not_ready');
    expect(d.reasons.join(' ')).toMatch(/Teacher Training Course/);
    expect(evaluateDecision(geModel, p, p.targets, { ...ctx, gates: { lang: { met: true }, course: { met: true } } }).status).toBe('recommend_reserve');
  });
});

describe('Rivojlanish rejasi (IDP)', () => {
  it('E’lon → aniq taklif → faollashtirish → xodim dalili → qaytarish → qayta yuborish → qabul', () => {
    let s = createSeed();
    s = D.setScore(s, { cardId: 'c-101', code: 'LDR-05', final: 4, basis: 'BEI' });
    s = D.advanceStage(s, { cardId: 'c-101' });
    s = D.recordPanel(s, { cardId: 'c-101', decision: 'appoint', protocol: 'p', members: 'm' });
    s = D.advanceStage(s, { cardId: 'c-101' });
    s = D.advanceStage(s, { cardId: 'c-101' });
    const props = s.idp.filter((x) => x.cardId === 'c-101');
    expect(props.map((x) => x.competency).sort()).toEqual(['FUN-04', 'LDR-02']);
    const it0 = props.find((x) => x.competency === 'LDR-02');
    expect(it0.status).toBe('proposed');
    expect(it0.goal.length).toBeGreaterThan(10);
    expect(it0.task).toMatch(/4-darajaga yetish/);
    expect(it0.due).toBe('2027-02-08');
    s = D.activateIdp(s, { id: it0.id });
    expect(s.notifications.some((n) => n.to === 'Dilshod Karimov' && n.text.includes('Rivojlanish rejangizga'))).toBe(true);
    expect(() => D.submitIdpEvidence(s, { id: it0.id, employeeId: 'e-dilshod', evidence: '' })).toThrow();
    s = D.submitIdpEvidence(s, { id: it0.id, employeeId: 'e-dilshod', evidence: 'Ikki keys tahlili, mentor qaydi' });
    expect(() => D.reviewIdp(s, { id: it0.id, decision: 'returned', reason: '' })).toThrow(/sababi/);
    s = D.reviewIdp(s, { id: it0.id, decision: 'returned', reason: 'Natija raqamlari yo‘q' });
    s = D.submitIdpEvidence(s, { id: it0.id, employeeId: 'e-dilshod', evidence: 'Keys tahlili + CRM raqamlari' });
    s = D.reviewIdp(s, { id: it0.id, decision: 'done' });
    expect(s.idp.find((x) => x.id === it0.id).status).toBe('done');
    expect(s.notifications.filter((n) => n.to === 'Dilshod Karimov' && n.text.startsWith('Rivojlanish vazifasi')).length).toBe(2);
  });
});

describe('Demo ma’lumotlari izchilligi', () => {
  it('E’lon qilingan har kartadagi har bir yetishmovchilikka rivojlanish vazifasi bor (boshlang‘ich daraja bilan)', () => {
    const s = createSeed();
    for (const c of s.cards.filter((x) => x.published)) {
      const gaps = D.cardDecision(s, c).match.items.filter((i) => (i.state === 'scored' && i.gap > 0) || i.state === 'de').map((i) => i.code).sort();
      const items = s.idp.filter((x) => x.cardId === c.id);
      expect(items.map((x) => x.competency).sort()).toEqual(gaps);
      for (const x of items) expect(x.fromLevel === null || typeof x.fromLevel === 'number').toBe(true);
    }
    expect(s.idp.filter((x) => x.employeeId === 'e-jasur').map((x) => `${x.competency}:${x.fromLevel}`).sort()).toEqual(['FUN-03:3', 'KOR-01:3', 'LDR-01:3', 'LDR-04:3']);
  });
});

describe('Rivojlanish rejasi: qo‘lda qo‘shish', () => {
  it('Xodim taklifi mentor tasdig‘igacha kutadi; mentor qo‘shgani darhol faol', () => {
    let s = createSeed();
    expect(() => D.addIdpItem(s, { employeeId: 'e-jasur', competency: 'FUN-02', targetLevel: 4, task: '', due: '2027-03-01', by: 'employee' })).toThrow();
    s = D.addIdpItem(s, { employeeId: 'e-jasur', competency: 'FUN-02', targetLevel: 4, task: 'Marketing kursi va filial kampaniyasi', due: '2027-03-01', by: 'employee' });
    const own = s.idp.at(-1);
    expect(own).toMatchObject({ source: 'employee', status: 'proposed', fromLevel: 3, cardId: null });
    expect(own.goal.length).toBeGreaterThan(5);
    s = D.activateIdp(s, { id: own.id });
    expect(s.idp.at(-1).status).toBe('open');
    expect(s.notifications.some((n) => n.to === 'Jasur Toshmatov' && n.text.startsWith('Taklif qilgan vazifangiz tasdiqlandi'))).toBe(true);
    s = D.addIdpItem(s, { employeeId: 'e-malika', competency: 'GEN-05', targetLevel: 3, task: 'Haftada 1 marta hamkasb darsini kuzatish va feedback tahlili', owner: 'Shahnoza Mirzayeva', due: '2027-01-15', by: 'mentor' });
    expect(s.idp.at(-1)).toMatchObject({ source: 'mentor', status: 'open', fromLevel: 2 });
    expect(() => D.addIdpItem(s, { employeeId: 'e-malika', competency: 'GEN-05', targetLevel: 9, task: 'x', owner: 'M', due: '2027-01-15', by: 'mentor' })).toThrow(/1–5/);
  });
});

import { abModel } from '../src/data/models.js';
describe('Akademik bo‘lim rahbari — alohida lavozim, ustozlikdan rotatsiya', () => {
  it('Model to‘liq; LT-2 dan o‘tish mumkin, LT-1 dan emas; tayinlashda lavozim modeli almashadi', () => {
    expect(validateModel(abModel)).toEqual([]);
    expect(abModel.competencies.map((c) => c.layer).filter((v, i, a) => a.indexOf(v) === i)).toEqual(['Korporativ', 'Ustozlikdan', 'Boshqaruv', 'Akademik boshqaruv']);
    const p = abModel.profiles[0];
    const ev = Object.fromEntries(Object.keys(p.targets).map((c) => [c, compMethods(abModel, abModel.competencies.find((x) => x.code === c))]));
    const gates = { rec: { met: true }, pilot: { met: true } };
    const ctx = { tenureMonths: 14, kpi: { type: 'regular', value: 85 }, evidenceMethods: ev, gates, targetRole: null };
    expect(evaluateDecision(abModel, p, p.targets, { ...ctx, currentLevel: 'LT-2' }).status).toBe('recommend_reserve');
    const low = evaluateDecision(abModel, p, p.targets, { ...ctx, currentLevel: 'LT-1' });
    expect(low.status).toBe('not_ready');
    expect(low.reasons.join(' ')).toMatch(/LT-1 dan AB-1 ga o‘tib bo‘lmaydi/);
    // tayinlash: ustoz → akademik bo‘lim rahbari
    let s = createSeed();
    s = D.openCard(s, { cycleId: 'cy-2026-k', employeeId: 'e-aziza', modelId: 'AB', profileTo: 'AB-1', branchId: 'b-yunus' });
    const c = s.cards[0];
    expect(c.profileFrom).toBe('LT-1');
    expect(s.models.find((m) => m.id === 'AB@0.1')).toBeTruthy();
  });
});

describe('Nomzod tanlash', () => {
  it('AB-1 nomzodlari: o‘tish huquqi borlar tayyorlik bo‘yicha; eng yaqinini tayyorlash rejaga kiritadi', () => {
    let s = createSeed();
    const list = D.candidatesFor(s, 'AB', 'AB-1');
    const byId = Object.fromEntries(list.map((c) => [c.emp.id, c]));
    expect(byId['e-sherzod'].eligible && byId['e-gulbahor'].eligible).toBe(true);
    expect(byId['e-malika'].eligible).toBe(false);
    expect(byId['e-malika'].reason).toMatch(/LT-2, LT-3, LT-4/);
    expect(list[0].emp.id).toBe('e-sherzod');
    expect(Math.round(byId['e-sherzod'].near)).toBe(67);
    expect(Math.round(byId['e-gulbahor'].near)).toBe(56);
    expect(byId['e-gulbahor'].interest).toBeTruthy();
    expect(list.some((c) => c.complete && c.eligible)).toBe(false);
    s = D.startPreparation(s, { employeeId: 'e-sherzod', modelId: 'AB', profileCode: 'AB-1' });
    const plan = s.idp.filter((x) => x.employeeId === 'e-sherzod' && x.source === 'plan');
    expect(plan.map((x) => x.competency).sort()).toEqual(byId['e-sherzod'].gaps.map((g) => g.code).sort());
    expect(s.succession.find((x) => x.employeeId === 'e-sherzod' && x.target === 'AB-1').status).toBe('developing');
    expect(() => D.startPreparation(s, { employeeId: 'e-malika', modelId: 'AB', profileCode: 'AB-1' })).toThrow(/o‘ta olmaydi/);
  });
});

describe('LMS: kurslar va Learning Path', () => {
  it('Test → o‘quv dalili (chegara 2); amaliy topshiriq + mentor xulosasi → ish dalili (mentor bahosi, chegaradan oshmaydi)', () => {
    let s = createSeed();
    s = D.enrollCourse(s, { employeeId: 'e-jasur', courseId: 'CRS-CX-01' });
    const enr = s.enrollments.at(-1);
    expect(() => D.submitTest(s, { enrollmentId: enr.id, componentId: 't1', answers: [0] })).toThrow(/Barcha savollarga/);
    s = D.submitTest(s, { enrollmentId: enr.id, componentId: 't1', answers: [1, 1] }); // 0% — o'tmadi
    expect((D.getEmployee(s, 'e-jasur').records['FUN-03'] || []).some((r) => r.context === 'learning')).toBe(false);
    s = D.submitTest(s, { enrollmentId: enr.id, componentId: 't1', answers: [0, 0] }); // 100%
    expect(D.getEmployee(s, 'e-jasur').records['FUN-03'].filter((r) => r.context === 'learning').at(-1).level).toBe(2);
    s = D.completeLesson(s, { enrollmentId: enr.id, componentId: 'l1' });
    expect(() => D.submitTask(s, { enrollmentId: enr.id, componentId: 'a1', text: 'x', origin: 'manager' })).toThrow(/rahbarni/);
    s = D.submitTask(s, { enrollmentId: enr.id, componentId: 'a1', text: 'Birinchi qo‘ng‘iroq vaqti 2 soatdan 20 daqiqaga', origin: 'manager', assignedBy: 'Olmazor filiali rahbari' });
    expect(() => D.reviewTask(s, { enrollmentId: enr.id, componentId: 'a1', decision: 'accepted', level: 4, note: 'ok' })).toThrow(/1–3/);
    s = D.reviewTask(s, { enrollmentId: enr.id, componentId: 'a1', decision: 'returned', note: 'Oldin/keyin raqam yo‘q' });
    s = D.submitTask(s, { enrollmentId: enr.id, componentId: 'a1', text: 'CRM: 2 soat → 20 daqiqa, NPS 41 → 52', origin: 'manager', assignedBy: 'Olmazor filiali rahbari' });
    s = D.reviewTask(s, { enrollmentId: enr.id, componentId: 'a1', decision: 'accepted', level: 3, note: 'Real chora va o‘lchov bor', mentor: 'Operatsion direktor' });
    const emp = D.getEmployee(s, 'e-jasur');
    // Jasurda FUN-03 ish dalili 3 edi (karta) — pasaytirilmaydi, qayta yozilmaydi; kurs yakunlandi
    expect(emp.records['FUN-03'].filter((r) => r.context === 'work').at(-1).level).toBe(3);
    // Kontent bajarildi, lekin kurs 2 ta majburiy savoldan (qoniqish + NPS) keyin yakunlanadi
    expect(D.getEnrollment(s, enr.id)).toMatchObject({ status: 'in_progress', awaitingFeedback: true });
    s = D.submitCourseFeedback(s, { enrollmentId: enr.id, satisfaction: 5, nps: 9 });
    expect(D.getEnrollment(s, enr.id).status).toBe('completed');
    expect(D.getEnrollment(s, enr.id).completedAt).toBe(s.today);
  });

  it('Learning Path: ketma-ketlik, kurs natijasi lavozimga tayyorlikni oshiradi, yo‘l yakunlanadi', () => {
    let s = createSeed();
    const fr = s.models.find((m) => m.id === 'FR@0.3');
    const fr1 = fr.profiles.find((p) => p.code === 'FR-1');
    const before = D.positionReadiness(s, D.getEmployee(s, 'e-rustam'), fr, fr1).near;
    const next = s.enrollments.find((e) => e.employeeId === 'e-rustam' && e.courseId === 'CRS-LDR-04');
    expect(D.courseLocked(s, next)).toBe(true); // 2-kurs hali yakunlanmagan
    expect(() => D.completeLesson(s, { enrollmentId: next.id, componentId: 'l1' })).toThrow(/oldingi kurs/);
    s = D.reviewTask(s, { enrollmentId: 'enr-7', componentId: 'a1', decision: 'accepted', level: 3, note: 'Konversiya CRM’da tasdiqlandi', mentor: 'Sotuv direktori' });
    const emp = D.getEmployee(s, 'e-rustam');
    expect(emp.records['FUN-01'].at(-1)).toMatchObject({ level: 3, context: 'work' });
    expect(emp.records['LDR-01'].at(-1)).toMatchObject({ level: 3, context: 'work' });
    expect(D.positionReadiness(s, emp, fr, fr1).near).toBeGreaterThan(before);
    expect(D.courseLocked(s, D.getEnrollment(s, next.id))).toBe(true); // fikr qoldirilmaguncha kurs yakunlanmagan
    s = D.submitCourseFeedback(s, { enrollmentId: 'enr-7', satisfaction: 4, nps: 8 });
    expect(D.courseLocked(s, D.getEnrollment(s, next.id))).toBe(false);
    expect(D.positionReadiness(s, emp, fr, fr1).eligible).toBe(true); // FR-1 — kirish darajasi
  });

  it('Kurs konstruktori: qoidasiz yoki ish dalili uchun topshiriqsiz kurs e’lon qilinmaydi', () => {
    let s = createSeed();
    s = D.createCourse(s, { title: 'Sinov kursi', direction: 'KOR' });
    const c = s.courses.at(-1);
    expect(() => D.publishCourse(s, { id: c.id })).toThrow();
    s = D.updateCourse(s, { id: c.id, patch: (x) => { x.components.push({ id: 't1', kind: 'test', title: 'T', passScore: 70, questions: [{ text: 'S?', options: ['a', 'b'], answer: 0 }] }); x.rules.push({ competency: 'KOR-01', level: 3, context: 'work', needs: ['t1'] }); } });
    expect(D.validateCourse(s, s.courses.at(-1)).join(' ')).toMatch(/ish dalili uchun amaliy topshiriq/);
    s = D.updateCourse(s, { id: c.id, patch: (x) => { x.rules[0].context = 'learning'; x.rules[0].level = 2; } });
    s = D.publishCourse(s, { id: c.id });
    expect(s.courses.at(-1).status).toBe('active');
  });
});

describe('Stretch biriktirish', () => {
  it('HR Gulbahorga AB-1 uchun stretch biriktiradi; tekshiruvlar, vorislik va bildirishnoma', () => {
    let s = createSeed();
    const base = { employeeId: 'e-gulbahor', target: 'AB-1', title: '3 ustoz jamoasini muvofiqlashtirish', scope: 'Chilonzor, 4 ustoz', deadline: '2027-02-10', authority: 'Ustozlarga kuzatuv va metodik vazifa berish', expected: '4 ustozda kuzatuv o‘rtachasi 3,0 → 3,5', criteria: 'Kuzatuv varaqlari, oldin/keyin', competencies: ['AB-01', 'LDR-04'], mentor: 'Akademik rahbar' };
    expect(() => D.createStretch(s, { ...base, competencies: ['FUN-01'] })).toThrow(/talablarida yo‘q/);
    expect(() => D.createStretch(s, { ...base, deadline: '2026-01-01' })).toThrow(/Muddat/);
    s = D.createStretch(s, base);
    const st = s.stretches.at(-1);
    expect(st).toMatchObject({ status: 'assigned', target: 'AB-1', kind: 'LT-3 → AB-1' });
    expect(s.succession.find((x) => x.employeeId === 'e-gulbahor' && x.target === 'AB-1').status).toBe('trial');
    expect(s.notifications.some((n) => n.to === 'Gulbahor Rasulova' && n.text.includes('stretch vazifa'))).toBe(true);
    expect(() => D.createStretch(s, base)).toThrow(/ochiq stretch/);
    s = D.submitStretch(s, { id: st.id, text: 'Kuzatuv o‘rtachasi 3,1 → 3,6', link: '', actor: 'Gulbahor Rasulova' });
    s = D.reviewStretch(s, { id: st.id, decision: 'approved', reason: 'Kuzatuv varaqlari bilan tasdiqlandi' });
    expect(s.stretches.at(-1).status).toBe('approved');
  });
});

describe('Ustozlar natijalari: konversiya, retention va avtomatik majburiy kurs', () => {
  it('Oktabr hisoboti olinganda chegaradan pastlarga mos kurs biriktiriladi, takror yozilmaydi', async () => {
    const D = await import('../src/core/domain.js');
    let s = createSeed();
    const rule = (id) => s.kpiRules.find((r) => r.id === id);
    // Formula: 200 boshida, 20 ketdi, bitirgan yo'q → 90%
    expect(D.kpiValue({ newStudents: 0, stayedNew: 0, start: 200, graduated: 0, left: 20 }, rule('kr-ret')).pct).toBe(90);
    expect(D.kpiValue({ newStudents: 10, stayedNew: 9, start: 200, graduated: 20, left: 18 }, rule('kr-ret')).pct).toBe(90);
    const before = s.enrollments.length;
    s = D.importKpiMonth(s, { month: '2026-10' });
    expect(s.kpiInbox['2026-10']).toBeUndefined();
    const mal = s.enrollments.find((e) => e.employeeId === 'e-malika' && e.courseId === 'CRS-GE-CONV');
    expect(mal.by).toBe('kpi');
    expect(mal.mandatory.ruleId).toBe('kr-conv');
    expect(s.enrollments.find((e) => e.employeeId === 'e-dildora' && e.courseId === 'CRS-GE-RET')).toBeTruthy();
    expect(s.enrollments.length).toBe(before + 2); // Farrux kursni hali o'qiyapti — yangi yozuv yo'q
    const kinds = (id) => s.kpiActions.filter((a) => a.employeeId === id && a.month === '2026-10').map((a) => a.kind);
    expect(kinds('e-farrux')).toEqual(['already']);
    expect(kinds('e-aziza')).toEqual(['improved']);
    expect(kinds('e-kamola')).toEqual([]); // 3 ta yangi o'quvchi — kam ma'lumot, baholanmaydi
    // TZ: ishga kirganiga 30 kun to'lmagan (2026-10-14) — ko'rsatkich past bo'lsa ham «O'lchanmagan», kurs yozilmaydi
    expect(kinds('e-nilufar')).toEqual([]);
    expect(s.enrollments.some((e) => e.employeeId === 'e-nilufar' && e.by === 'kpi')).toBe(false); // moslashuv kurslari bor, KPI kursi yo'q
    expect(D.kpiValue(D.kpiResult(s, 'e-nilufar', '2026-10'), rule('kr-ret'))).toMatchObject({ unmeasured: true, below: false });
    expect(D.kpiUnmeasured(s, D.getEmployee(s, 'e-nilufar'), '2026-11')).toBe(false);
    expect(s.notifications.some((n) => n.text.includes('Nilufar'))).toBe(false);
    expect(s.notifications.some((n) => n.to === 'Gulbahor Rasulova' && n.text.includes('Malika'))).toBe(true);
    expect(s.notifications.some((n) => n.to === 'Malika Yusupova' && n.text.includes('majburiy'))).toBe(true);
    // Qayta kiritish — takroriy kurs yoki chora yo'q
    const n = s.enrollments.length;
    s = D.saveKpiResult(s, { employeeId: 'e-malika', month: '2026-10', newStudents: 16, stayedNew: 10, start: 74, graduated: 0, left: 5 });
    expect(s.enrollments.length).toBe(n);
    expect(() => D.saveKpiResult(s, { employeeId: 'e-malika', month: '2026-10', newStudents: 5, stayedNew: 6, start: 10, graduated: 0, left: 0 })).toThrow();
    expect(() => D.updateKpiRule(s, { id: 'kr-conv', min: 150, months: 1, courseId: 'CRS-GE-CONV' })).toThrow();
    s = D.addKpiNote(s, { employeeId: 'e-malika', text: 'Suhbat: yangi guruhlar bilan 2-hafta qo‘ng‘irog‘i kelishildi', by: 'Gulbahor Rasulova' });
    expect(s.kpiActions[0].kind).toBe('note');
  });
});

describe('Ko‘nikmalar: kompetensiyadan alohida qatlam', () => {
  it('O‘zi belgilash, dalil bilan tasdiqlash, kurs orqali avtomatik tasdiqlanish', () => {
    let s = createSeed();
    const rec = (e, k) => D.empSkill(s, e, k);
    // Dilshod AI-01: o'zi 1, dalil bilan 2 so'ragan → tasdiqlash
    expect(rec('e-dilshod', 'SK-AI-01').claim.level).toBe(2);
    expect(() => D.reviewSkill(s, { id: rec('e-dilshod', 'SK-AI-01').id, decision: 'confirmed', note: '' })).toThrow();
    s = D.reviewSkill(s, { id: rec('e-dilshod', 'SK-AI-01').id, decision: 'confirmed', level: 2, note: 'Namuna hisobot ko‘rildi', by: 'Hududiy menejer' });
    expect(rec('e-dilshod', 'SK-AI-01')).toMatchObject({ level: 2, status: 'confirmed', claim: null });
    // Tasdiqlangan darajani dalilsiz oshirib bo'lmaydi
    expect(() => D.declareSkill(s, { employeeId: 'e-dilshod', skillId: 'SK-AI-01', level: 3 })).toThrow();
    // Yangi ko'nikma o'zi belgilanadi — tasdiqlanmagan
    s = D.declareSkill(s, { employeeId: 'e-malika', skillId: 'SK-COL-01', level: 1 });
    expect(rec('e-malika', 'SK-COL-01').status).toBe('self');
    // Kurs: test → SK-AI-02 (1), test + mentor qabul qilgan topshiriq → SK-AI-01 (2), kompetensiya FUN-07 ham
    s = D.enrollCourse(s, { employeeId: 'e-jasur', courseId: 'CRS-AI-01' });
    const enr = s.enrollments.at(-1);
    for (const l of ['l1', 'l2']) s = D.completeLesson(s, { enrollmentId: enr.id, componentId: l });
    s = D.submitTest(s, { enrollmentId: enr.id, componentId: 't1', answers: [0, 0, 0] });
    expect(rec('e-jasur', 'SK-AI-02')).toMatchObject({ level: 1, status: 'confirmed' });
    expect(rec('e-jasur', 'SK-AI-01')).toBeNull();
    s = D.submitTask(s, { enrollmentId: enr.id, componentId: 'a1', text: 'Haftalik hisobot AI bilan', link: '', origin: 'self', assignedBy: '' });
    s = D.reviewTask(s, { enrollmentId: enr.id, componentId: 'a1', decision: 'accepted', level: 2, note: 'Prompt va tekshiruv aniq', mentor: 'Mentor' });
    expect(rec('e-jasur', 'SK-AI-01')).toMatchObject({ level: 2, status: 'confirmed' });
    // Ko'nikma lavozimga moslik hisobiga ta'sir qilmaydi
    const m = s.models.find((x) => x.modelId === 'FR' && x.status === 'active');
    const p = m.profiles.find((x) => x.code === 'FR-2');
    const before = D.positionReadiness(createSeed(), createSeed().employees.find((e) => e.id === 'e-dilshod'), m, p).near;
    const after = D.positionReadiness(s, D.getEmployee(s, 'e-dilshod'), m, p).near;
    expect(after).toBe(before);
    s = D.setSkillProfile(s, { profileCode: 'FR-1', skillId: 'SK-COL-01', level: 1 });
    expect(D.skillProfile(s, 'FR-1').some((x) => x.skillId === 'SK-COL-01')).toBe(true);
    s = D.createSkill(s, { name: 'Telegram bot va kanal yuritish', group: 'biz', supports: ['FUN-02'] });
    expect(s.skillCatalog.at(-1).id).toBe('SK-BIZ-02');
  });
});

describe('Onboarding (TZ): integratsiya, 30 kunlik moslashuv, rollar, eslatmalar', () => {
  it('Integratsiya: kartochka ochiladi, Markaz admini shaxsiy raqamga, kech kiritilgan belgilanadi, arxiv va reboarding', () => {
    let s = createSeed();
    const n = s.employees.length;
    s = D.processHrInbox(s);
    expect(s.hrInbox).toHaveLength(0);
    expect(s.employees.length).toBe(n + 3); // Shahlo, Bobur va Dilnoza (Markaz admini — shaxsiy raqam bilan)
    expect(s.employees.find((e) => e.name === 'Dilnoza Rahimova')).toMatchObject({ phone: '+998 97 321 45 67', centerAccount: '+998 71 200 00 01' });
    const bobur = s.employees.find((e) => e.name === 'Bobur Xolmatov');
    const ob = D.onboardingOf(s, bobur.id);
    expect(D.onbLateDays(ob)).toBe(9);
    expect(D.onbEnrollments(s, ob).map((e) => e.courseId)).toEqual(['CRS-ON-CORP', 'CRS-ON-FIN']);
    expect(D.onbEnrollments(s, ob)[0].deadline).toBe('2026-12-01'); // ish boshlagan kun + 30
    expect(s.notifications.some((n) => n.to === 'Madina Xasanova' && n.text.includes('9 kun'))).toBe(true);
    expect(s.employees.find((e) => e.name === 'Shahlo Nazarova').supervisorId).toBe('e-gulbahor');
    // Arxiv: ma'lumot saqlanadi, ro'yxatlardan chiqadi, Edu kutadi
    const z = D.getEmployee(s, 'e-ziyoda');
    expect(z.status).toBe('archived');
    expect(z.eduArchiveAt).toBe('2026-12-07');
    expect(s.enrollments.filter((e) => e.employeeId === 'e-ziyoda').every((e) => e.status !== 'in_progress')).toBe(true);
    expect(D.activeEmployees(s).some((e) => e.id === 'e-ziyoda')).toBe(false);
    expect(D.dueReminders(s, '2026-11-20').some((r) => r.employeeId === 'e-ziyoda')).toBe(false);
    // Reboarding: o'zgarmagan kurs tiklanadi, yangilangan (v1 → v2) qayta o'qiladi
    const lob = D.onboardingOf(s, 'e-lola');
    expect(lob.reboarding).toBe(true);
    expect(lob.restored.map((r) => [r.courseId, r.kind])).toEqual([['CRS-ON-CORP', 'restored'], ['CRS-ON-GE', 'retake']]);
    const le = D.onbEnrollments(s, lob);
    expect(le.find((e) => e.courseId === 'CRS-ON-CORP').status).toBe('completed');
    expect(le.find((e) => e.courseId === 'CRS-ON-GE')).toMatchObject({ status: 'in_progress', courseVersion: 2 });
    // Takroriy telefon raqami — xato, kartochka ochilmaydi
    s.hrInbox = [{ id: 'ev-x', type: 'hire', at: s.today, payload: { name: 'Dublikat', position: 'GE', level: 'LT-0', branchId: 'b-chil', department: 'Akademik bo‘lim', phone: '+998 90 111 22 33', startedAt: s.today, source: 'recruiting' } }];
    const m = s.employees.length;
    s = D.processHrInbox(s);
    expect(s.employees.length).toBe(m);
    expect(s.hrLog[0].tone).toBe('bad');
  });

  it('Onboarding natijasi: lavozim kartasi, har qism minimumi, o‘rtacha, filial rahbari tasdiqlaydi (badge emas)', () => {
    let s = createSeed();
    const sanjar = D.onboardingScore(s, D.onboardingOf(s, 'e-sanjar'));
    expect(sanjar.score).toBeNull(); // hali hech narsa — «Past» emas
    const nil = D.onboardingScore(s, D.onboardingOf(s, 'e-nilufar'));
    expect(nil).toMatchObject({ ready: false, obs: 1, needObs: 2, coursesDone: 1, min: 3 });
    expect(nil.parts.map((p) => p.key)).toEqual(['onTime', 'courses', 'tasks', 'practice']);
    expect(nil.parts.find((p) => p.key === 'courses').value).toBe(4.5); // kurs baholari: 5 va 4
    expect(() => D.approveOnboarding(s, { id: 'onb-1', userId: 'u-hr' })).toThrow(/erta/);
    expect(() => D.approveOnboarding(s, { id: 'onb-1', userId: 'u-br-chil' })).toThrow(/filial rahbari/);
    // Moliya menejeri: kursdan tashqari topshiriq va ish ko'rsatkichlari kuzatuvi (metodist emas)
    const fin = D.onboardingScore(s, D.onboardingOf(s, 'e-jahongir'));
    expect(fin).toMatchObject({ ready: false, needObs: 0, need: 1 });
    expect(() => D.gradeOnbTask(s, { onboardingId: 'onb-2', taskId: 'ft1', grade: 4, userId: 'u-cur' })).toThrow(/mentor/);
    s = D.gradeOnbTask(s, { onboardingId: 'onb-2', taskId: 'ft1', grade: 4, userId: 'u-br-chil' });
    expect(() => D.addWorkCheck(s, { employeeId: 'e-jahongir', ratings: { 'Mijoz va ota-onani kutib olish': 4 }, userId: 'u-br-chil' })).toThrow(/Barcha/);
    s = D.addWorkCheck(s, { employeeId: 'e-jahongir', ratings: { 'Mijoz va ota-onani kutib olish': 4, 'To‘lov va hujjatlarni to‘g‘ri rasmiylashtirish': 4, 'Topshiriqni bajarish sifati va muddati': 3 }, userId: 'u-br-chil' });
    const r = D.onboardingScore(s, D.onboardingOf(s, 'e-jahongir'));
    expect(r.parts.map((p) => [p.key, p.value])).toEqual([['onTime', 5], ['courses', 4.8], ['tasks', 4], ['practice', 3.7]]);
    expect(r).toMatchObject({ ready: true, passed: true, score: 4.4 });
    s = D.approveOnboarding(s, { id: 'onb-2', userId: 'u-br-chil' });
    const f = D.getOnboarding(s, 'onb-2').final;
    expect(f).toMatchObject({ score: 4.4, label: 'Yaxshi', passed: true, by: 'Anvar Qosimov' });
    expect(f.badge).toBeUndefined();
    expect(s.notifications.find((n) => n.to === 'Jahongir Ortiqov' && n.text.includes('muvaffaqiyatli')).tg).toBe(true);
    // Minimum sozlanadi: 4 bo'lsa, ish kuzatuvi (3,7) o'tmaydi
    s = D.setOnbCard(s, { position: 'FIN', patch: { min: 4 } });
    const r4 = D.onboardingScore(s, D.onboardingOf(s, 'e-jahongir'));
    expect(r4.passed).toBe(false);
    expect(r4.parts.find((p) => !p.ok).key).toBe('practice');
    // Muddatida yakunlash qismi ixtiyoriy
    s = D.setOnbCard(s, { position: 'GE', patch: { onTime: false } });
    expect(D.onboardingScore(s, D.onboardingOf(s, 'e-nilufar')).parts.map((p) => p.key)).toEqual(['courses', 'tasks', 'practice']);
  });

  it('Kuzatuv metodistdan, topshiriqni bitta mas’ul tekshiradi (kurator yoki mentor), kuzatuv kompetensiyaga yoziladi', () => {
    let s = createSeed();
    expect(() => D.addOnbObservation(s, { employeeId: 'e-nilufar', date: s.today, ratings: { 'GEN-01': 4 }, note: 'x', userId: 'u-met' })).toThrow(/3 band/);
    expect(() => D.addOnbObservation(s, { employeeId: 'e-nilufar', date: s.today, ratings: { 'GEN-01': 4, 'GEN-03': 3, 'GEN-04': 4 }, note: 'x', userId: 'u-cur' })).toThrow(/metodist/);
    s = D.addOnbObservation(s, { employeeId: 'e-nilufar', date: s.today, lesson: 'BG-12', ratings: { 'GEN-01': 4, 'GEN-03': 3, 'GEN-04': 4, 'GEN-05': 3 }, note: 'ICQ ishlatildi', userId: 'u-met' });
    const enr = D.getEnrollment(s, 'enr-o2');
    expect(D.taskReviewer(s, enr).user.id).toBe('u-men-sher');
    expect(D.canReviewTask(s, D.getStaff(s, 'u-men-gul'), enr)).toBe(false);
    expect(() => D.reviewTask(s, { enrollmentId: 'enr-o2', componentId: 'a1', decision: 'accepted', grade: 4, note: 'ok', reviewerId: 'u-cur' })).toThrow(/mentori/);
    expect(() => D.reviewTask(s, { enrollmentId: 'enr-o2', componentId: 'a1', decision: 'accepted', note: 'ok', reviewerId: 'u-men-sher' })).toThrow(/1–5/);
    s = D.reviewTask(s, { enrollmentId: 'enr-o2', componentId: 'a1', decision: 'accepted', grade: 4, note: 'Maqsad aniq', mentor: 'Sherzod Ismoilov', reviewerId: 'u-men-sher' });
    s = D.submitCourseFeedback(s, { enrollmentId: 'enr-o2', satisfaction: 4, nps: 9 });
    expect(D.getEnrollment(s, 'enr-o2').status).toBe('completed');
    expect(D.onboardingScore(s, D.onboardingOf(s, 'e-nilufar')).ready).toBe(false); // kursdan tashqari topshiriq hali baholanmagan
    s = D.gradeOnbTask(s, { onboardingId: 'onb-1', taskId: 'gt1', grade: 4, userId: 'u-men-sher' });
    const r = D.onboardingScore(s, D.onboardingOf(s, 'e-nilufar'));
    expect(r.ready).toBe(true);
    // Yunusobod rahbari vakant — HR tasdiqlaydi; kuzatuv o'rtachasi ish dalili sifatida yoziladi
    s = D.approveOnboarding(s, { id: 'onb-1', userId: 'u-hr' });
    expect(D.getEmployee(s, 'e-nilufar').records['GEN-01'].at(-1)).toMatchObject({ level: 4, context: 'work' }); // (3 + 4) / 2 → 4
    expect(D.getOnboarding(s, 'onb-1').final.byRole).toMatch(/vakant/);
  });

  it('Rol doirasi: filial rahbari, mentor, metodist, kurator faqat o‘zinikini ko‘radi', () => {
    const s = createSeed();
    const sc = (u) => D.scopeEmployees(s, D.getStaff(s, u));
    expect(sc('u-super')).toBeNull();
    expect(sc('u-br-chil').has('e-sanjar')).toBe(true);
    expect(sc('u-br-chil').has('e-nilufar')).toBe(false);
    expect([...sc('u-men-sher')].sort()).toEqual(['e-aziza', 'e-farrux', 'e-kamola', 'e-lola', 'e-nilufar']);
    expect(sc('u-met').has('e-rustam')).toBe(false);
    expect(sc('u-cur').has('e-jahongir')).toBe(true);
  });

  it('Eslatmalar: kuniga bitta, mas’ullarga faqat muammoli holat, takror yuborilmaydi', () => {
    let s = createSeed();
    const due = D.dueReminders(s);
    expect(due.map((r) => [r.employeeId, r.kind])).toEqual([['e-nilufar', 'soon'], ['e-sanjar', 'notStarted']]);
    const san = due.find((r) => r.employeeId === 'e-sanjar');
    expect(san.enrollmentIds).toHaveLength(2); // ikki kurs — bitta xabar
    expect(san.to.map((t) => t.role)).toEqual(['Xodim', 'Mentor', 'Filial rahbari']);
    expect(due.find((r) => r.employeeId === 'e-nilufar').to).toHaveLength(1);
    expect(D.dueReminders(s, '2026-11-12').map((r) => [r.employeeId, r.kind])).toEqual([['e-farrux', 'overdue'], ['e-nilufar', 'soon']]);
    s = D.sendReminders(s);
    expect(s.notifications.filter((n) => n.key.startsWith('rem:'))).toHaveLength(4);
    expect(() => D.sendReminders(s)).toThrow(/yangi eslatma yo‘q/);
  });

  it('Uchrashuvlar: taklif havolasi bilan, qatnashuv faqat uchrashuvdan keyin', () => {
    let s = createSeed();
    expect(() => D.createMeeting(s, { title: 'X', date: s.today, format: 'online', link: '' })).toThrow(/havola/);
    s = D.inviteToMeeting(s, { id: 'mt-2', employeeIds: ['e-nilufar', 'e-sanjar'] });
    expect(s.notifications.find((n) => n.to === 'Sanjar Komilov').text).toContain('meet.google.com');
    expect(() => D.markAttendance(s, { id: 'mt-2', employeeId: 'e-sanjar', attended: true })).toThrow(/hali bo‘lmagan/);
    s = D.markAttendance(s, { id: 'mt-1', employeeId: 'e-nilufar', attended: true });
    expect(D.ceoMeetingOf(s, 'e-nilufar').id).toBe('mt-1');
    expect(() => D.inviteToMeeting(s, { id: 'mt-2', employeeIds: ['e-nilufar'] })).toThrow();
  });
});

describe('Onboarding dashboard analitikasi', () => {
  it('Retention 30/60 kun faqat muddati to‘lganlardan; kogorta, manba va ketish bosqichlari', async () => {
    const A = await import('../src/core/onbAnalytics.js');
    const s = createSeed();
    const rows = A.onbRows(s);
    expect(rows.filter((r) => !r.live)).toHaveLength(48);
    const r30 = A.retention(rows, s.today, 30);
    const r60 = A.retention(rows, s.today, 60);
    expect(r30.n).toBeGreaterThan(r60.n); // 60 kuni to'lmaganlar kirmaydi
    const oct = A.cohorts(rows, s.today).find((c) => c.month === '2026-10');
    expect(oct.r60.n).toBe(0);
    const src = Object.fromEntries(A.breakdown(rows, s.today, 'source').map((b) => [b.key, b.r30.pct]));
    expect(src.recruiting).toBeGreaterThan(src.branch);
    const lv = A.leaveStages(rows, s.today);
    expect(lv.stages.reduce((a, x) => a + x.n, 0)).toBe(lv.total);
    expect(lv.early.n).toBeLessThanOrEqual(lv.early.of); // T3: faqat 30 kuni to'lganlardan
    expect(lv.early.n).toBe(rows.filter((r) => r.leftDay !== null && r.leftDay < 30 && D.addDays(r.startedAt, 30) <= s.today).length);
    // Filtr: filial rahbari faqat o'z filiali
    expect(A.onbRows(s, {}, new Set(['b-chil'])).every((r) => r.branchId === 'b-chil')).toBe(true);
  });

  it('Bog‘liqlik, metodologiya tekshiruvi, kurslar bajarilishi va xavf guruhi', async () => {
    const A = await import('../src/core/onbAnalytics.js');
    let s = createSeed();
    expect(A.pearson([1, 2, 3, 4], [2, 4, 6, 8])).toBeCloseTo(1);
    expect(A.pearson([1, 2], [1, 2])).toBeNull();
    const c = A.correlation(A.onbRows(s).filter((r) => r.position === 'GE'));
    expect(c.r).toBeGreaterThan(0.4);
    const best = [...c.parts].sort((a, b) => b.r - a.r)[0];
    expect(best.key).toBe('practice'); // dars kuzatuvi
    expect(c.hi.kpi).toBeGreaterThan(c.lo.kpi);
    const m = A.masteryStats(A.onbRows(s));
    expect(m.byCourse.find((x) => x.courseId === 'CRS-ON-GE').onTime).toBeLessThan(m.byCourse.find((x) => x.courseId === 'CRS-ON-CORP').onTime);
    expect(A.liveProgress(s, D.onboardingOf(s, 'e-sanjar')).status).toBe('notStarted');
    expect(A.liveProgress(s, D.onboardingOf(s, 'e-nilufar')).status).toBe('ontrack');
    const risk = A.riskList(s);
    expect(risk.map((x) => x.emp.id).sort()).toEqual(['e-jahongir', 'e-sanjar', 'e-ziyoda']);
    // Yangi mezon (qaror №55): D30 tekshiruvi 2 kundan ortiq kechikmoqda.
    expect(risk.find((x) => x.emp.id === 'e-jahongir').reasons.join(' ')).toMatch(/tekshiruv kechikmoqda/);
    s = D.flagRisk(s, { onboardingId: D.onboardingOf(s, 'e-sanjar').id, reasons: ['boshlamagan'] });
    expect(s.notifications[0]).toMatchObject({ to: 'Gulbahor Rasulova', tg: true });
    expect(() => D.flagRisk(s, { onboardingId: D.onboardingOf(s, 'e-sanjar').id, reasons: ['boshlamagan'] })).toThrow(/allaqachon/);
  });
});

describe('Onboarding tizimi (2026-11-19): huquqlar, karta, kurslar, fikrlar, so‘rovnomalar, offboarding', () => {
  it('Huquq shaxsga beriladi va filial doirasida ishlaydi', () => {
    let s = createSeed();
    const u = (id) => D.getStaff(s, id);
    expect(D.can(u('u-super'), 'team.manage')).toBe(true);
    expect(D.can(u('u-men-sher'), 'onb.approve')).toBe(false);
    expect(() => D.approveOnboarding(s, { id: 'onb-2', userId: 'u-men-gul' })).toThrow(/huquqi/);
    // L&D assistentga tasdiqlash huquqi beriladi — barcha filiallar doirasida ishlaydi
    s = D.setStaffRight(s, { userId: 'u-lda', right: 'onb.approve', on: true });
    expect(D.can(D.getStaff(s, 'u-lda'), 'onb.approve')).toBe(true);
    // Filial rahbari doirasi kengaytiriladi: Yunusobod ham
    s = D.setStaffScope(s, { userId: 'u-br-chil', kind: 'branches', branchIds: ['b-chil', 'b-yunus'] });
    expect(D.scopeEmployees(s, D.getStaff(s, 'u-br-chil')).has('e-nilufar')).toBe(true);
    expect(() => D.setStaffRight(s, { userId: 'u-super', right: 'onb.view', on: false })).toThrow(/Super Admin/);
    expect(() => D.setStaffScope(s, { userId: 'u-hr', kind: 'branches', branchIds: [] })).toThrow(/filial/);
    // Buddy biriktirish: huquq va doira kerak; buddy mentorga teng bo'lmasin
    expect(() => D.assignMentorBuddy(s, { employeeId: 'e-sanjar', mentorId: 'e-gulbahor', buddyId: 'e-gulbahor', userId: 'u-br-chil' })).toThrow(/buddy/);
    s = D.assignMentorBuddy(s, { employeeId: 'e-sanjar', mentorId: 'e-gulbahor', buddyId: 'e-malika', userId: 'u-br-chil' });
    expect(D.getEmployee(s, 'e-sanjar').buddyId).toBe('e-malika');
    expect(() => D.assignMentorBuddy(s, { employeeId: 'e-sanjar', buddyId: 'e-malika', userId: 'u-cur' })).toThrow(/huquqi/);
  });

  it('Kompetensiya kartasi rekrutingdan: birinchi kundan, baholar shartli, 60-kunda daraja; modelsiz lavozimda karta yo‘q', () => {
    let s = createSeed();
    s = D.processHrInbox(s);
    const sh = s.employees.find((e) => e.name === 'Shahlo Nazarova');
    const card = D.onboardingCardOf(s, sh.id);
    expect(card).toMatchObject({ origin: 'onboarding', provisional: true, profileTo: 'LT-0', stage: 'evidence', deadline: '2027-01-08' });
    expect(card.scores['GEN-01'].evidences[0]).toMatchObject({ method: 'interview', value: 2 });
    expect(card.scores['GEN-01'].final).toBeNull(); // rekruting bahosi — dalil, yakuniy daraja emas
    const bobur = s.employees.find((e) => e.name === 'Bobur Xolmatov');
    expect(D.onboardingCardOf(s, bobur.id)).toBeNull(); // moliya menejeri modeli hali yo'q
    expect(D.nextAnnounce(s)).toBe('2026-12-25');
    s = D.setAnnounceDates(s, { dates: ['03-31'] });
    expect(D.nextAnnounce(s)).toBe('2027-03-31');
    expect(() => D.setAnnounceDates(s, { dates: ['01-31', '05-31', '09-30'] })).toThrow(/1 yoki 2/);
  });

  it('Moslashuv dasturi muddati lavozim bo‘yicha sozlanadi; adaptatsiya 60 kun', () => {
    let s = createSeed();
    s = D.setProgramDays(s, { position: 'GE', days: 45 });
    s = D.processHrInbox(s);
    const sh = s.employees.find((e) => e.name === 'Shahlo Nazarova');
    const ob = D.onboardingOf(s, sh.id);
    expect(ob.days).toBe(45);
    expect(D.onbEnrollments(s, ob)[0].deadline).toBe('2026-12-24');
    expect(D.adaptPhase(0)[0]).toBe('orientation'); // birinchi ish kuni
    expect(D.adaptPhase(5)[0]).toBe('orientation');
    expect(D.adaptPhase(40)[0]).toBe('functional');
    expect(() => D.setProgramDays(s, { position: 'GE', days: 90 })).toThrow(/7–60/);
  });

  it('Kurs: daraja indikatorlardan topiladi, kurs bahosi alohida, dalil uchun kamida 4', () => {
    const qs = [{ answer: 0, lvl: 1 }, { answer: 1, lvl: 2 }, { answer: 2, lvl: 3 }];
    expect(D.foundLevel(qs, [0, 1, 2], 3)).toBe(3);
    expect(D.foundLevel(qs, [0, 1, 0], 3)).toBe(2);
    expect(D.foundLevel(qs, [1, 1, 2], 3)).toBe(0); // 1-daraja topilmasa, yuqorisi hisoblanmaydi
    expect(D.foundLevel([{ answer: 0 }], [0], 3)).toBeNull(); // bog'lanmagan test — eski qoida
    const course = { components: [{ id: 't1', kind: 'test', passScore: 70 }, { id: 'a1', kind: 'task' }], rules: [] };
    const enr = { progress: { t1: { best: 75 }, a1: { status: 'accepted', mentor: { grade: 5 } } } };
    expect(D.courseGrade(course, enr)).toBe(4.5); // 75% → 4 ball, topshiriq 5 → 4,5
    expect(D.courseMinGrade(course)).toBe(4);
    let s = createSeed();
    s = D.setCourseMinGrade(s, { id: 'CRS-LDR-05', value: 5 });
    expect(D.courseMinGrade(D.getCourse(s, 'CRS-LDR-05'))).toBe(5);
  });

  it('Kurs fikrlari anonim: ism faqat rozilik bilan, bir marta, e’lonni huquq egasi qiladi', () => {
    let s = createSeed();
    const n0 = s.courseFeedback.length;
    s = D.submitCourseFeedback(s, { enrollmentId: 'enr-1', satisfaction: 4, nps: 9, comment: 'Keys juda amaliy', showName: false });
    const f = s.courseFeedback.at(-1);
    expect(s.courseFeedback).toHaveLength(n0 + 1);
    expect(f).toMatchObject({ author: null, status: 'pending', branchId: 'b-chil', position: 'GE' });
    expect(f.employeeId).toBeUndefined();
    expect(() => D.submitCourseFeedback(s, { enrollmentId: 'enr-1', satisfaction: 4, nps: 9 })).toThrow(/allaqachon/);
    expect(() => D.moderateFeedback(s, { id: f.id, decision: 'published', userId: 'u-cur' })).toThrow(/huquqi/);
    s = D.moderateFeedback(s, { id: f.id, decision: 'published', userId: 'u-lda' });
    const st = D.courseFeedbackStats(s, 'CRS-LDR-05');
    expect(st).toMatchObject({ n: 1, nps: 100, satisfaction: 4 });
    expect(D.courseFeedbackStats(s, 'CRS-ON-CORP').nps).toBe(0); // 10, 8, 6 → (1 − 1) / 3
  });

  it('So‘rovnomalar faqat filial kesimida; javob ulushi past filiallarga eslatma bir marta', () => {
    let s = createSeed();
    expect(D.surveyBranch(s, 'b-serg').rate).toBe(25);
    expect(D.CHECKLIST_ITEMS).toHaveLength(8);
    expect(s.onboardings.every((o) => o.survey === undefined)).toBe(true);
    s = D.remindLowResponse(s);
    expect(s.notifications.filter((n) => n.key.startsWith('svrate:'))).toHaveLength(2); // Sergeli 25%, Samarqand 33%
    expect(() => D.remindLowResponse(s)).toThrow(/yo‘q/);
  });

  it('Offboarding: ketish turiga qarab so‘rovnoma; haydalish faqat ikki sabab bilan', () => {
    const s = createSeed();
    const z = D.getEmployee(s, 'e-ziyoda');
    expect(D.exitPlan(s, z, { exitType: 'self', leftAt: '2026-11-07' }).survey).toBe('Fail Case 30-day');
    const old = D.getEmployee(s, 'e-farrux');
    expect(D.exitPlan(s, old, { exitType: 'fired', fireReason: 'skills', leftAt: '2026-11-10' }).survey).toMatch(/haydalgan/);
    expect(D.exitPlan(s, old, { exitType: 'fired', fireReason: 'boshqa', leftAt: '2026-11-10' })).toMatchObject({ type: 'self' });
    expect(D.exitPlan(s, old, { exitType: 'returns', leftAt: '2026-11-10' }).survey).toBeNull();
    expect(D.exitPlan(s, old, { exitType: 'self', leftAt: '2026-09-01' })).toMatchObject({ survey: null, late: true });
    const s2 = D.processHrInbox(s);
    expect(D.getEmployee(s2, 'e-ziyoda').exit).toMatchObject({ type: 'self', survey: 'Fail Case 30-day' });
  });
});

describe('Kurslar bajarilishi, gamifikatsiya, tashkiliy tuzilma va jamoadoshlar', () => {
  it('Kurslar bajarilishi har element teng; Learning Path kurs baholari o‘rtachasi va X / N kurs', () => {
    const s = createSeed();
    const enr = D.getEnrollment(s, 'enr-o2');
    const c = D.getCourse(s, enr.courseId);
    const pr = D.courseProgress(c, enr);
    expect(pr.pct).toBe(Math.round((100 * pr.done) / pr.total));
    const res = D.pathResult(s, 'e-nilufar', ['CRS-ON-CORP', 'CRS-ON-GE']);
    expect(res).toMatchObject({ coursesDone: 1, total: 2 });
    expect(res.rows.map((r) => r.grade)).toEqual([5, 4]); // CORP 100% → 5; GE test 75% → 4 (topshiriq tekshiruvda)
    expect(res.grade).toBe(4.5);
  });

  it('Ballar, badge katalogi va reyting; badge sharti sozlanadi', () => {
    let s = createSeed();
    const p = D.employeePoints(s, 'e-jahongir');
    expect(p.total).toBeGreaterThan(0);
    expect(p.items.some((x) => x.kind === 'grade5')).toBe(true); // CORP 5 bilan yakunlangan
    expect(D.employeeBadges(s, 'e-jahongir').map((b) => b.name)).toContain('A’lochi');
    expect(() => D.saveBadge(s, { badge: { name: '', kind: 'points', n: 10 } })).toThrow(/nom/);
    s = D.saveBadge(s, { badge: { name: 'Faol', icon: '🚀', kind: 'points', n: 10, desc: '10 ball' } });
    expect(D.employeeBadges(s, 'e-jahongir').map((b) => b.name)).toContain('Faol');
    s = D.setPointRule(s, { kind: 'course', points: 100 });
    expect(D.employeePoints(s, 'e-jahongir').total).toBeGreaterThan(p.total);
    const r = D.ratingList(s, { position: 'FIN' });
    expect(r[0].rank).toBe(1);
    expect(r.every((x, i) => i === 0 || r[i - 1].points >= x.points)).toBe(true);
  });

  it('Admin doirasi: bo‘lim yoki barcha filiallardagi bir lavozim; Umumiy jamoa a’zolari', () => {
    let s = createSeed();
    s = D.setStaffScope(s, { userId: 'u-lda', kind: 'positions', positions: ['GE'] });
    const ge = D.scopeEmployees(s, D.getStaff(s, 'u-lda'));
    expect([...ge].every((id) => D.getEmployee(s, id).position === 'GE')).toBe(true);
    expect(new Set([...ge].map((id) => D.getEmployee(s, id).branchId)).size).toBeGreaterThan(1); // barcha filiallarda
    s = D.setStaffScope(s, { userId: 'u-lda', kind: 'departments', departmentIds: ['d-fin'], branchIds: ['b-chil'] });
    const fin = D.scopeEmployees(s, D.getStaff(s, 'u-lda'));
    expect([...fin].every((id) => D.getEmployee(s, id).departmentId === 'd-fin' && D.getEmployee(s, id).branchId === 'b-chil')).toBe(true);
    expect(() => D.setStaffScope(s, { userId: 'u-lda', kind: 'departments', departmentIds: [] })).toThrow(/bo‘lim/);
    // Tashkiliy tuzilma LMS'da qo'lda
    expect(() => D.saveDepartment(s, { name: 'Marketing', userId: 'u-lda' })).toThrow(/huquq/);
    s = D.saveDepartment(s, { name: 'Marketing', branchIds: ['b-chil'], userId: 'u-hr' });
    const mk = s.departments.find((d) => d.name === 'Marketing');
    expect(() => D.setEmployeeDepartment(s, { employeeId: 'e-aziza', departmentId: mk.id, userId: 'u-hr' })).toThrow(/filialida/);
    s = D.setEmployeeDepartment(s, { employeeId: 'e-rustam', departmentId: mk.id, userId: 'u-hr' });
    expect(() => D.removeDepartment(s, { id: mk.id, userId: 'u-hr' })).toThrow(/xodim bor/);
    // Foydalanuvchi tarixi va sertifikat
    const h = D.userHistory(s, 'e-jahongir');
    expect(h.every((x) => x.startedAt)).toBe(true);
    expect(D.certificates(s, 'e-jahongir').length).toBe(2);
  });

  it('Jamoadoshlar: sukut bo‘yicha o‘z filiali; bo‘lim yoki bir necha filialga sozlanadi', () => {
    let s = createSeed();
    const sanjar = D.getEmployee(s, 'e-sanjar');
    const def = D.colleaguesOf(s, sanjar);
    expect(def.every((e) => e.branchId === 'b-chil' && e.id !== 'e-sanjar')).toBe(true);
    s = D.setColleaguesScope(s, { employeeId: 'e-sanjar', kind: 'department', userId: 'u-hr' });
    expect(D.colleaguesOf(s, D.getEmployee(s, 'e-sanjar')).every((e) => e.departmentId === 'd-acad' && e.branchId === 'b-chil')).toBe(true);
    s = D.setColleaguesScope(s, { employeeId: 'e-sanjar', kind: 'branches', branchIds: ['b-yunus'], userId: 'u-hr' });
    expect(new Set(D.colleaguesOf(s, D.getEmployee(s, 'e-sanjar')).map((e) => e.branchId))).toEqual(new Set(['b-chil', 'b-yunus']));
    expect(() => D.setColleaguesScope(s, { employeeId: 'e-sanjar', kind: 'branch', userId: 'u-men-gul' })).toThrow(/Huquq/);
  });
});

describe('TZ 2026-11-24 qarorlari', () => {
  it('Test: standart 3 urinish, kurs bahosiga oxirgi urinish kiradi', () => {
    let s = createSeed();
    s = D.enrollCourse(s, { employeeId: 'e-jasur', courseId: 'CRS-CX-01' });
    const id = s.enrollments.at(-1).id;
    s = D.submitTest(s, { enrollmentId: id, componentId: 't1', answers: [0, 0] }); // 100%
    s = D.submitTest(s, { enrollmentId: id, componentId: 't1', answers: [1, 1] }); // 0% — oxirgisi hisoblanadi
    const p = D.getEnrollment(s, id).progress.t1;
    expect(D.testScore(p)).toBe(0);
    expect(D.componentDone(D.getCourse(s, 'CRS-CX-01'), D.getEnrollment(s, id), 't1')).toBe(false);
    s = D.submitTest(s, { enrollmentId: id, componentId: 't1', answers: [0, 0] });
    expect(D.testScore(D.getEnrollment(s, id).progress.t1)).toBe(100);
    expect(() => D.submitTest(s, { enrollmentId: id, componentId: 't1', answers: [0, 0] })).toThrow(/Urinishlar tugadi/);
  });

  it('Onboarding minimumdan o‘tmasa: avval uzaytirish (≤14 kun), faqat past qism qayta baholanadi', () => {
    let s = createSeed();
    s = D.gradeOnbTask(s, { onboardingId: 'onb-2', taskId: 'ft1', grade: 4, userId: 'u-br-chil' });
    s = D.addWorkCheck(s, { employeeId: 'e-jahongir', ratings: { 'Mijoz va ota-onani kutib olish': 4, 'To‘lov va hujjatlarni to‘g‘ri rasmiylashtirish': 4, 'Topshiriqni bajarish sifati va muddati': 3 }, userId: 'u-br-chil' });
    s = D.setOnbCard(s, { position: 'FIN', patch: { min: 4 } }); // ish kuzatuvi 3,7 — o'tmaydi
    expect(() => D.approveOnboarding(s, { id: 'onb-2', userId: 'u-br-chil' })).toThrow(/uzaytiring/);
    expect(() => D.extendOnboarding(s, { id: 'onb-2', days: 20, plan: 'x', userId: 'u-br-chil' })).toThrow(/1–14/);
    expect(() => D.extendOnboarding(s, { id: 'onb-2', days: 14, plan: '', userId: 'u-br-chil' })).toThrow(/reja/);
    s = D.extendOnboarding(s, { id: 'onb-2', days: 14, plan: 'Har kuni 2 ta mijoz bilan ishlash, filial rahbari kuzatadi', userId: 'u-br-chil' });
    const ob = D.getOnboarding(s, 'onb-2');
    expect(ob.extension).toMatchObject({ days: 14, until: D.addDays(s.today, 14), parts: ['practice'] });
    expect(D.onbStatusLabel(ob)).toBe('uzaytirilgan');
    expect(() => D.reassessOnbPart(s, { id: 'onb-2', part: 'courses', grade: 5, note: 'x', userId: 'u-br-chil' })).toThrow(/past qism|o‘tmagan/);
    s = D.reassessOnbPart(s, { id: 'onb-2', part: 'practice', grade: 4, note: 'Mijozni kutib olish standarti bajarilmoqda', userId: 'u-br-chil' });
    expect(D.onboardingScore(s, D.getOnboarding(s, 'onb-2'))).toMatchObject({ passed: true });
    s = D.approveOnboarding(s, { id: 'onb-2', userId: 'u-br-chil' });
    expect(D.getOnboarding(s, 'onb-2').final).toMatchObject({ passed: true, extended: true });
  });

  it('Anonim natija kamida 5 ta javob bo‘lsa ko‘rsatiladi', () => {
    const s = createSeed();
    expect(D.ANON_MIN).toBe(5);
    expect(D.courseFeedbackStats(s, 'CRS-ON-CORP').few).toBe(true); // 3 ta javob
    const chil = D.surveyBranch(s, 'b-chil');
    expect(chil.few).toMatchObject({ d8: false, d30: false, d60: true, enps: false });
  });

  it('Shikoyat: e’londan keyin 10 kun ichida, kartani baholamagan shaxs ko‘rib chiqadi', () => {
    let s = createSeed();
    expect(() => D.fileAppeal(s, { cardId: 'c-105', employeeId: 'e-malika', text: 'Mening natijam emas' })).toThrow(/o‘zi/);
    s = D.fileAppeal(s, { cardId: 'c-105', employeeId: 'e-aziza', text: 'GEN-05 bo‘yicha oktabrdagi kuzatuv hisobga olinmagan' });
    expect(() => D.fileAppeal(s, { cardId: 'c-105', employeeId: 'e-aziza', text: 'Yana bir shikoyat matni' })).toThrow(/allaqachon/);
    const code = Object.keys(D.getCard(s, 'c-105').scores)[0];
    D.getCard(s, 'c-105').scores[code].by = 'Shahzoda Donyorova';
    expect(() => D.reviewAppeal(s, { cardId: 'c-105', decision: 'upheld', note: 'ok', userId: 'u-lda' })).toThrow(/baholamagan/);
    expect(() => D.reviewAppeal(s, { cardId: 'c-105', decision: 'upheld', note: 'ok', userId: 'u-men-gul' })).toThrow(/huquqi/);
    s = D.reviewAppeal(s, { cardId: 'c-105', decision: 'reassess', note: 'Kuzatuv dalili qayta ko‘riladi', codes: [code], userId: 'u-super' });
    const c = D.getCard(s, 'c-105');
    expect(c.appeal).toMatchObject({ status: 'reassess', by: 'HR / L&D boshqaruvchisi' });
    expect(D.getCard(s, c.appeal.reopened).prevCardId).toBe('c-105');
    const late = { ...createSeed(), today: '2026-11-30' };
    expect(() => D.fileAppeal(late, { cardId: 'c-105', employeeId: 'e-aziza', text: 'Kech yuborilgan shikoyat' })).toThrow(/muddati/);
  });

  it('Kirish: Telegram, SMS kod yoki login va parol (demo)', () => {
    const s = createSeed();
    const e = D.activeEmployees(s)[0];
    expect(D.findLogin(s, { method: 'telegram', value: e.profile.telegram })).toMatchObject({ mode: 'employee', employeeId: e.id });
    expect(D.findLogin(s, { method: 'sms', value: e.profile.phone })).toMatchObject({ mode: 'employee', employeeId: e.id });
    expect(D.findLogin(s, { method: 'password', value: 'hr', password: D.DEMO_PASSWORD })).toMatchObject({ mode: 'admin', userId: 'u-hr' });
    expect(() => D.findLogin(s, { method: 'password', value: 'hr', password: 'x' })).toThrow(/noto‘g‘ri/);
    expect(() => D.findLogin(s, { method: 'telegram', value: '@yoq_odam' })).toThrow(/topilmadi/);
  });
});

describe('Eski TZ va Jobster qarorlari (2026-11-24)', () => {
  it('Adminlik berish: o‘zida yo‘q huquqni bera olmaydi, huquqsiz admin umuman bera olmaydi', () => {
    let s = createSeed();
    expect(() => D.setStaffRight(s, { userId: 'u-cur', right: 'audit.view', on: true, byId: 'u-lda' })).toThrow(/O‘zingizda yo‘q/);
    s = D.setStaffRight(s, { userId: 'u-cur', right: 'onb.view', on: true, byId: 'u-lda' });
    expect(D.getStaff(s, 'u-cur').rights).toContain('onb.view');
    expect(() => D.setStaffRight(s, { userId: 'u-cur', right: 'onb.view', on: false, byId: 'u-br-chil' })).toThrow(/Adminlik berish/);
    // Doira: filial rahbariga «Adminlik berish» berilsa ham, barcha filiallar doirasini bera olmaydi.
    s = D.setStaffRight(s, { userId: 'u-br-chil', right: 'team.manage', on: true });
    expect(() => D.setStaffScope(s, { userId: 'u-cur', kind: 'all', byId: 'u-br-chil' })).toThrow(/kengroq/);
    expect(() => D.setStaffScope(s, { userId: 'u-cur', kind: 'branches', branchIds: ['b-chil'], byId: 'u-br-chil' })).not.toThrow();
  });

  it('Hech kim o‘zini baholamaydi: kurator o‘z topshirig‘ini tekshirmaydi — zaxira tekshiruvchiga o‘tadi', () => {
    const s = createSeed();
    const enr = s.enrollments.find((e) => e.id === 'enr-o5'); // Sanjar, CRS-ON-CORP (kurator Laylo Karimova)
    expect(D.taskReviewer(s, enr).kind).toBe('curator');
    D.getStaff(s, 'u-cur').employeeId = 'e-sanjar';
    const r = D.taskReviewer(s, enr);
    expect(r.kind).not.toBe('curator');
    expect(D.canReviewTask(s, D.getStaff(s, 'u-cur'), enr)).toBe(false);
    expect(D.isSelf(D.getStaff(s, 'u-cur'), 'e-sanjar')).toBe(true);
  });

  it('Onboarding doskasi: kunlar bo‘yicha ustun, «Tekshirish»da tasdiqsiz o‘tmaydi, qo‘lda ko‘chirish huquq bilan', () => {
    let s = createSeed();
    const ob = D.onboardingOf(s, 'e-sanjar'); // 10-kun, D8 tasdiqlanmagan
    expect(D.boardColumn(s, ob)).toBe('check8');
    expect(D.checkLate(s, ob)).toBe(3);
    expect(D.boardColumn(s, D.onboardingOf(s, 'e-jahongir'))).toBe('check30');
    expect(() => D.moveBoardCard(s, { id: ob.id, column: 'd8', userId: 'u-br-chil' })).toThrow(/Onboarding doskasini yuritish/);
    expect(() => D.confirmCheck(s, { id: ob.id, which: 'd8', result: 'working', userId: 'u-lda' })).toThrow(/D8\/D30 tekshiruvini/);
    s = D.confirmCheck(s, { id: ob.id, which: 'd8', result: 'working', userId: 'u-br-chil' });
    expect(D.boardColumn(s, D.onboardingOf(s, 'e-sanjar'))).toBe('d8');
    s = D.moveBoardCard(s, { id: ob.id, column: 'induction', note: 'qayta orientatsiya', userId: 'u-hr' });
    expect(D.boardColumn(s, D.onboardingOf(s, 'e-sanjar'))).toBe('induction');
    // D8 so'rovnomasi doskadagi ustun bo'yicha: qo'lda orqaga ko'chirilgan xodimga hali yuborilmaydi.
    expect(D.dueSurveySends(s).some((x) => x.emp.id === 'e-sanjar')).toBe(false);
  });

  it('«Ketdi»: ketish kutilmoqda + HR’ga EduTizim’da arxivlash vazifasi; arxiv signali vazifani yopadi', () => {
    let s = createSeed();
    const ob = D.onboardingOf(s, 'e-sanjar');
    s = D.confirmCheck(s, { id: ob.id, which: 'd8', result: 'left', note: 'Ishga chiqmayapti', userId: 'u-br-chil' });
    expect(D.onboardingOf(s, 'e-sanjar').leaving).toMatchObject({ by: 'Anvar Qosimov' });
    const t = s.boardTasks.find((x) => x.key === 'archive:e-sanjar');
    expect(t).toMatchObject({ status: 'new', assignee: 'Madina Xasanova' });
    s = { ...s, hrInbox: [{ id: 'ev-x', type: 'archive', at: s.today, payload: { employeeId: 'e-sanjar', reasonCode: 'schedule', leftAt: s.today, eduWaitDays: 30 } }] };
    s = D.processHrInbox(s, { id: 'ev-x' });
    expect(s.boardTasks.find((x) => x.key === 'archive:e-sanjar').status).toBe('done');
    // 30 kun ichida ketgan: Fail Case havola orqali va filial rahbariga rahbar so'rovnomasi.
    expect(s.surveySends.some((x) => x.surveyId === 'sv-fail' && x.employeeId === 'e-sanjar' && x.link)).toBe(true);
    expect(s.surveySends.some((x) => x.surveyId === 'sv-manager' && x.about === 'e-sanjar' && x.to === 'Anvar Qosimov')).toBe(true);
  });

  it('Ketish sabablari katalogi: 20 ta, haydalish 3 sabab, «Qaytadi» — exit-intervyusiz', () => {
    expect(D.EXIT_REASONS).toHaveLength(20);
    expect(D.EXIT_REASONS.filter((r) => r[2] === 'fired').map((r) => r[3])).toEqual(['skills', 'discipline', 'values']);
    const s = createSeed();
    const emp = D.getEmployee(s, 'e-dildora');
    expect(D.exitPlan(s, emp, { reasonCode: 'returns', leftAt: s.today })).toMatchObject({ type: 'returns', survey: null });
    expect(D.exitPlan(s, emp, { reasonCode: 'fired-values', leftAt: s.today }).type).toBe('fired');
    expect(D.exitPlan(s, emp, { reasonCode: 'salary', leftAt: s.today }).type).toBe('self');
  });

  it('So‘rovnoma: anonim javob xodimga bog‘lanmaydi; ismli salbiy javob — nomli vazifa va xavf guruhi', () => {
    let s = createSeed();
    s = D.confirmCheck(s, { id: D.onboardingOf(s, 'e-sanjar').id, which: 'd8', result: 'working', userId: 'u-br-chil' });
    s = D.sendDueSurveys(s);
    const send = s.surveySends.find((x) => x.employeeId === 'e-sanjar' && x.surveyId === 'sv-d8');
    expect(send).toBeTruthy();
    const all = { q1: 'yes', q2: 'yes', q3: 'yes', q4: 'yes', q5: 'yes', q6: 'no', q7: '4', q8: '' };
    expect(() => D.answerSurvey(s, { sendId: send.id, answers: { q1: 'yes' } })).toThrow(/javob bering/);
    s = D.answerSurvey(s, { sendId: send.id, answers: all });
    expect(s.surveyResponses.at(-1)).toMatchObject({ employeeId: null, branchId: 'b-chil' });
    expect(() => D.answerSurvey(s, { sendId: send.id, answers: all })).toThrow(/javob berilgan/);
    // Ismli so'rovnoma (Malika, mentor bilan ishlash): «Yo'q» → xavf belgisi.
    s = D.answerSurvey(s, { sendId: 'ss-2', answers: { q1: 'no', q2: '2', q3: '' } });
    expect(s.surveyResponses.at(-1).employeeId).toBe('e-malika');
    // Anonim natija: 5 tadan kam javobda ko'rsatilmaydi.
    expect(D.surveyResults(s, 'sv-d30', null).few).toBe(true);
    expect(D.surveyResults(s, 'sv-d8', null).few).toBe(false);
  });

  it('Jobster’dan import: ustun va sanalar bilan, «Department» → «Начальный»', () => {
    expect(() => D.importJobsterBoard(createSeed(), { userId: 'u-br-chil' })).toThrow(/Integratsiya navbati/);
    const s = D.importJobsterBoard(createSeed(), { userId: 'u-hr' });
    const byName = (n) => D.onboardingOf(s, s.employees.find((e) => e.name === n).id);
    expect(D.boardColumn(s, byName('Bobur Rahmonov'))).toBe('start');
    expect(D.boardColumn(s, byName('Madina Sobirova'))).toBe('check30');
    expect(D.boardColumn(s, byName('Javohir Ergashev'))).toBe('d8');
    expect(() => D.importJobsterBoard(s, { userId: 'u-hr' })).toThrow(/qolmagan/);
  });

  it('Uchrashuv: xodim taklif qiladi, HR tasdiqlaydi, xodimlar o‘zi yoziladi', () => {
    let s = createSeed();
    s = D.proposeMeeting(s, { employeeId: 'e-dildora', title: 'Bilim almashish: Kids English o‘yinlari', date: '2026-11-25', format: 'offline', place: 'Chilonzor, 2-xona' });
    const id = s.meetings.at(-1).id;
    expect(() => D.joinMeeting(s, { id, employeeId: 'e-otabek' })).toThrow(/Yozilish ochiq/);
    expect(() => D.reviewMeeting(s, { id, decision: 'approved', userId: 'u-br-chil' })).toThrow(/Uchrashuvlarni tasdiqlash/);
    s = D.reviewMeeting(s, { id, decision: 'approved', userId: 'u-hr' });
    s = D.joinMeeting(s, { id, employeeId: 'e-otabek' });
    expect(s.meetings.find((m) => m.id === id).invited).toEqual(['e-otabek']);
  });

  it('Xabar yuborish huquq va doira bilan; o‘zini baholash daraja hisobiga kirmaydi', () => {
    let s = createSeed();
    expect(() => D.sendMessage(s, { userId: 'u-br-chil', text: 'Salom' })).toThrow(/Xabar yuborish/);
    s = D.sendMessage(s, { userId: 'u-hr', text: 'Ertaga metodik kun', branchId: 'b-chil', position: 'GE' });
    expect(s.messages[0].n).toBeGreaterThan(0);
    const before = D.cardDecision(s, D.getCard(s, 'c-110'));
    s = D.setSelfScore(s, { cardId: 'c-110', employeeId: 'e-nilufar', code: 'GEN-01', level: 4, note: 'Lesson plan yozaman' });
    expect(D.getCard(s, 'c-110').selfScores['GEN-01'].level).toBe(4);
    expect(D.cardDecision(s, D.getCard(s, 'c-110')).match.match).toEqual(before.match.match);
    expect(() => D.setSelfScore(s, { cardId: 'c-110', employeeId: 'e-malika', code: 'GEN-01', level: 3 })).toThrow(/topilmadi/);
  });
});

describe('Ikki rolli xodim (qaror №50)', () => {
  it('Bitta karta, ikki bo‘lim: korporativ baho bir marta qo‘yiladi va ikkala bo‘limga yoziladi', () => {
    let s = createSeed();
    const secs = D.cardSections(s, D.getCard(s, 'c-101'));
    expect(secs.map((c) => c.modelVersionId)).toEqual(['FR@0.3', 'GE@1.0']);
    const ge = secs[1];
    expect(ge).toMatchObject({ sectionOf: 'c-101', profileTo: 'LT-3' });
    expect(() => D.openRoleSection(s, { cardId: 'c-101' })).toThrow(/allaqachon/);
    s = D.setScore(s, { cardId: ge.id, code: 'KOR-01', final: 4, basis: 'Ikkala rolda ham mas’uliyatli' });
    expect(D.getCard(s, 'c-101').scores['KOR-01']).toMatchObject({ final: 4, sharedFrom: ge.id });
    // Funksional kompetensiya bo'limlararo ko'chirilmaydi.
    const fun = D.getModel(s, 'GE@1.0').competencies.find((c) => c.layer === 'Funksional').code;
    s = D.setScore(s, { cardId: ge.id, code: fun, final: 3, basis: 'Dars kuzatuvi' });
    expect(D.getCard(s, 'c-101').scores[fun]).toBeUndefined();
    // Ikkinchi roli yo'q xodimda bo'lim ochilmaydi.
    expect(() => D.openRoleSection(s, { cardId: 'c-103' })).toThrow(/ikkinchi rol/);
  });
});
