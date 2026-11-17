// 15 ta qabul sinovi (10-bo'lim). Har biri seed holatidan mustaqil ishlaydi.
// Shu ro'yxat ham vitest'da, ham ilovadagi «Qabul sinovlari» sahifasida bajariladi.
import { createSeed } from '../data/seed.js';
import { computeMatch, compositeScore, computeNewBranchKpi, checkActivityCap, evidenceSatisfies, fmtPct, DE } from './calc.js';
import { evaluateDecision } from './rules.js';
import { validateImport } from './importValidate.js';
import * as D from './domain.js';
import { HR_CODES, geModel, frModel } from '../data/models.js';
import { profileThreshold, compMethods } from './modelKit.js';

const ok = (pass, actual) => ({ pass: !!pass, actual });
const tryErr = (fn) => {
  try {
    fn();
    return null;
  } catch (e) {
    return e.message;
  }
};

export const SAMPLE_IMPORT_OK = {
  Competencies: [
    { competency_code: 'SRV-01', name: 'Mijozga xizmat', layer: 'Funksional', definition: 'Mijoz murojaatini standart bo‘yicha hal qiladi' },
    { competency_code: 'SRV-02', name: 'CRM intizomi', layer: 'Funksional', definition: 'Har murojaatni to‘liq qayd qiladi' },
  ],
  Levels: [1, 2, 3, 4, 5].map((n) => ({ level_no: n, name: ['Boshlang‘ich', 'Asosiy', 'Mustaqil', 'Ilg‘or', 'Ekspert'][n - 1] })),
  Indicators: ['SRV-01', 'SRV-02'].flatMap((c) => [1, 2, 3, 4, 5].map((n) => ({ indicator_code: `${c}-L${n}`, competency_code: c, level_no: n, text: `${c} ${n}-daraja indikatori` }))),
  Profiles: [
    { profile_code: 'SERVIS-M', competency_code: 'SRV-01', target_level: 3 },
    { profile_code: 'SERVIS-M', competency_code: 'SRV-02', target_level: 3 },
  ],
  EvidenceRules: [{ competency_code: 'SRV-01', method: 'observation', max_level: 5 }],
};

export const SAMPLE_IMPORT_BAD = {
  ...SAMPLE_IMPORT_OK,
  Indicators: [...SAMPLE_IMPORT_OK.Indicators, { indicator_code: 'SRV-01-L3', competency_code: 'SRV-01', level_no: 3, text: 'Dublikat' }, { indicator_code: 'SRV-09-L1', competency_code: 'SRV-09', level_no: 1, text: 'Uzilgan' }],
  Profiles: [...SAMPLE_IMPORT_OK.Profiles, { profile_code: 'SERVIS-M', competency_code: 'SRV-02', target_level: 7 }],
};

const fr2 = frModel.profiles.find((p) => p.code === 'FR-2');
const fr2Targets = fr2.targets;
const hrAll = (v) => Object.fromEntries(HR_CODES.map((c) => [c, v]));

export const UAT = [
  {
    id: 'UAT 01',
    title: 'FR va ustoz kartasi ochiladi',
    expected: 'FR 95% va o‘z instrumentlari bilan ishlaydi. Ustoz modelida har daraja o‘z chegarasi bilan (LT-2 100%, LT-3 95%) va dars kuzatuvi majburiy.',
    run() {
      const s = createSeed();
      const fr = D.cardContext(s, D.getCard(s, 'c-101')).model;
      const tc = D.cardContext(s, D.getCard(s, 'c-103')).model;
      const lt2 = tc.profiles.find((p) => p.code === 'LT-2').conditions;
      const pass = profileThreshold(fr, 'FR-2') === 95 && profileThreshold(tc, 'LT-2') === 100 && profileThreshold(tc, 'LT-3') === 95
        && tc.methods.includes('observation') && lt2.some((c) => c.type === 'required_method' && c.params.method === 'observation') && lt2.some((c) => c.type === 'observation_count') && fr.methods.includes('audit');
      return ok(pass, `FR: ${profileThreshold(fr, 'FR-2')}%, usullar: ${fr.methods.join(', ')} · Ustoz: LT-2 ${profileThreshold(tc, 'LT-2')}%, LT-3 ${profileThreshold(tc, 'LT-3')}%, kuzatuv majburiy, ${tc.competencies.length} kompetensiya`);
    },
  },
  {
    id: 'UAT 02',
    title: 'Ustoz modeli yangi versiyasi e’lon qilinadi',
    expected: 'Yangi karta yangi mezonlarni oladi. Oldingi karta, hisob va tarix avvalgi versiyaga bog‘liq qoladi.',
    run() {
      let s = createSeed();
      const beforeDecision = D.cardDecision(s, D.getCard(s, 'c-105')).match.match;
      s = D.createDraft(s, { fromId: 'GE@1.0' });
      const draft = s.models.find((m) => m.modelId === 'GE' && m.status === 'draft');
      s = D.updateDraft(s, { id: draft.id, patch: (m) => { m.profiles.find((p) => p.code === 'LT-3').conditions.find((c) => c.type === 'match_threshold').params.threshold = 97; } });
      s = D.setModelStatus(s, { id: draft.id, status: 'review', actor: 'HR/L&D' });
      s = D.setModelStatus(s, { id: draft.id, status: 'active', actor: 'Akademik rahbar + HRD' });
      s = D.openCard(s, { cycleId: 'cy-2026-k', employeeId: 'e-aziza', modelId: 'GE', profileTo: 'LT-3', branchId: 'b-yunus' });
      const newCard = s.cards[0];
      const old = D.getCard(s, 'c-105');
      const pass = newCard.modelVersionId === draft.id && old.modelVersionId === 'GE@1.0' && D.getModel(s, 'GE@1.0').status === 'archived' && D.cardDecision(s, old).match.match === beforeDecision && profileThreshold(D.getModel(s, draft.id), 'LT-3') === 97;
      return ok(pass, `Yangi karta → ${newCard.modelVersionId} (LT-3 chegarasi 97%); eski karta → ${old.modelVersionId} (arxiv), moslik ${fmtPct(beforeDecision)} o‘zgarmadi`);
    },
  },
  {
    id: 'UAT 03',
    title: 'Importda dublikat indikator yoki uzilgan bog‘lanish',
    expected: 'Aniq varaq va qator ko‘rsatiladi. Yozuvlar qisman import qilinmaydi.',
    run() {
      const r = validateImport(SAMPLE_IMPORT_BAD);
      const dupe = r.errors.find((e) => e.sheet === 'Indicators' && /Dublikat/.test(e.msg));
      const broken = r.errors.find((e) => e.sheet === 'Indicators' && /Uzilgan/.test(e.msg));
      const pass = !r.ok && !r.data && dupe?.row === 12 && broken?.row === 13;
      return ok(pass, r.errors.map((e) => `${e.sheet}!${e.row}: ${e.msg}`).join(' | '));
    },
  },
  {
    id: 'UAT 04',
    title: 'Intervyu 4, keys 3, audit 3,5',
    expected: 'Yakuniy daraja baholovchi rubrika va dalil asosida kiritgach chiqadi.',
    run() {
      let s = createSeed();
      // Yangi bandda faqat dalillar bor — yakuniy daraja avtomatik chiqmaydi
      s = D.addEvidence(s, { cardId: 'c-101', code: 'LDR-05', method: 'interview', value: 4, note: '' });
      s = D.addEvidence(s, { cardId: 'c-101', code: 'LDR-05', method: 'case', value: 3, note: '' });
      s = D.addEvidence(s, { cardId: 'c-101', code: 'LDR-05', method: 'audit', value: 3.5, note: '' });
      const before = D.cardScores(s, D.getCard(s, 'c-101'))['LDR-05'];
      const noBasis = tryErr(() => D.setScore(s, { cardId: 'c-101', code: 'LDR-05', final: 3, basis: '' }));
      s = D.setScore(s, { cardId: 'c-101', code: 'LDR-05', final: 3, basis: 'Ish dalillari 3-daraja indikatorlarini tasdiqladi' });
      const after = D.cardScores(s, D.getCard(s, 'c-101'))['LDR-05'];
      return ok(before == null && !!noBasis && after === 3, `Dalillardan keyin: ${before ?? 'baholanmagan'}; asossiz: «${noBasis}»; asos bilan: ${after}`);
    },
  },
  {
    id: 'UAT 05',
    title: 'HR-11 bo‘sh yoki DE',
    expected: 'FUN-05 = DE. FR yakuniy foizi va tayyorlik tasdiqlanmaydi.',
    run() {
      const s = createSeed();
      const empty = compositeScore(HR_CODES, { ...hrAll(4), 'HR-11': undefined });
      const de = compositeScore(HR_CODES, { ...hrAll(4), 'HR-11': DE });
      const d = D.cardDecision(s, D.getCard(s, 'c-106'));
      return ok(empty === DE && de === DE && d.match.match === null && !d.ready && d.status === 'de', `bo‘sh → ${empty}, DE → ${de}; karta: foiz ${d.match.match === null ? 'chiqmaydi' : fmtPct(d.match.match)}, holat «${d.label}»`);
    },
  },
  {
    id: 'UAT 06',
    title: 'FR-2 maqsadi 61, hisoblangan ball 57 va 58',
    expected: 'Mos ravishda 93,4% va 95,1%. Yuqori baho har bandda maqsad darajasi bilan chegaralanadi.',
    run() {
      const s57 = { ...fr2Targets, 'KOR-01': 3, 'LDR-01': 3, 'LDR-04': 3, 'FUN-03': 3 };
      const s58 = { ...fr2Targets, 'KOR-01': 3, 'LDR-01': 3, 'LDR-04': 3, 'FUN-02': 5, 'KOR-04': 5 };
      const a = computeMatch(fr2Targets, s57);
      const b = computeMatch(fr2Targets, s58);
      const pass = a.creditedSum === 57 && b.creditedSum === 58 && fmtPct(a.match) === '93,4%' && fmtPct(b.match) === '95,1%';
      return ok(pass, `57 ÷ 61 = ${fmtPct(a.match)}; 58 ÷ 61 = ${fmtPct(b.match)} (FUN-02=5 va KOR-04=5 maqsad 3 bilan chegaralandi)`);
    },
  },
  {
    id: 'UAT 07',
    title: 'FR mosligi ≥95%, bir majburiy band bajarilmagan',
    expected: 'Tayyorlik bloklanadi va aniq band hamda sabab ko‘rsatiladi.',
    run() {
      const scores = { ...fr2Targets, 'FUN-04': 2, 'FUN-02': 5, 'KOR-04': 5 };
      // 61 - 2 = 59 → 96,7%, lekin FUN-04 = 2 (<3, tafovut 2)
      const d = evaluateDecision(frModel, fr2, scores, { currentLevel: 'FR-1', tenureMonths: 12, kpi: { type: 'regular', value: 80 }, stretch: 'approved', targetRole: null });
      const pass = d.match.match >= 95 && !d.ready && d.reasons.some((r) => r.includes('FUN-04'));
      return ok(pass, `Moslik ${fmtPct(d.match.match)}; holat «${d.label}»; sabab: ${d.reasons.join(' | ')}`);
    },
  },
  {
    id: 'UAT 08',
    title: 'Yangi filial KPI ≥75%, compliance dalilsiz',
    expected: 'KPI sharti bajarilmagan. Barcha 8 band va compliance dalili tekshiriladi.',
    run() {
      const s = createSeed();
      const k = computeNewBranchKpi(s.kpiNewBranch.items, s.kpiNewBranch);
      const withDoc = computeNewBranchKpi(s.kpiNewBranch.items, { compliance: true, complianceEvidence: 'Yong‘in xavfsizligi akti №12' });
      const seven = computeNewBranchKpi(s.kpiNewBranch.items.slice(0, 7), { compliance: true, complianceEvidence: 'akt' });
      return ok(k.result >= 75 && !k.passed && withDoc.passed && !seven.passed, `Natija ${fmtPct(k.result)} → ${k.passed ? 'o‘tdi' : 'o‘tmadi'} (${k.reasons.join('; ')}); dalil bilan → ${withDoc.passed ? 'o‘tdi' : 'o‘tmadi'}; 7 band → ${seven.passed ? 'o‘tdi' : 'o‘tmadi'}`);
    },
  },
  {
    id: 'UAT 09',
    title: 'FR tayyor, mos rol bor yoki yo‘q',
    expected: 'Mos rol bo‘lsa tayinlash tavsiyasi, rol bo‘lmasa rezerv tavsiyasi. Joriy FR faqat rasmiy tayinlashdan keyin yangilanadi.',
    run() {
      let s = createSeed();
      s = D.setScore(s, { cardId: 'c-101', code: 'LDR-05', final: 4, basis: 'Ikki filialda o‘zgarishni joriy qilgan' });
      const withRole = D.cardDecision(s, D.getCard(s, 'c-101')).status;
      const noRole = D.cardDecision(s, { ...D.getCard(s, 'c-101'), targetRoleId: null }).status;
      s = D.advanceStage(s, { cardId: 'c-101' }); // → panel
      s = D.recordPanel(s, { cardId: 'c-101', decision: 'appoint', protocol: 'Dalillar ko‘rildi, FR-2 ga tayinlash', members: 'HRD, CEO, L&D' });
      s = D.advanceStage(s, { cardId: 'c-101' }); // → approval
      s = D.advanceStage(s, { cardId: 'c-101' }); // → published
      const lvlBefore = D.getEmployee(s, 'e-dilshod').currentLevel;
      s = D.recordAppointment(s, { cardId: 'c-101', docNo: 'Buyruq №233-K', effectiveDate: '2026-12-01' });
      const lvlAfter = D.getEmployee(s, 'e-dilshod').currentLevel;
      return ok(withRole === 'recommend_appoint' && noRole === 'recommend_reserve' && lvlBefore === 'FR-1' && lvlAfter === 'FR-2', `Rol bor → ${withRole}; rol yo‘q → ${noRole}; e’londan keyin joriy: ${lvlBefore}; tayinlashdan keyin: ${lvlAfter}`);
    },
  },
  {
    id: 'UAT 10',
    title: 'Stretch dalili qaytariladi va qayta yuboriladi',
    expected: 'Ikki yuborish tarixda qoladi. Tasdiqlangan yozuv panelga bog‘lanadi va kompetensiya bahosi alohida kiritiladi.',
    run() {
      let s = createSeed();
      s = D.reviewStretch(s, { id: 's-201', decision: 'returned', reason: 'Mirzo Ulug‘bek bo‘yicha sabab tahlili va shaxsiy qaroringizni qo‘shing' });
      s = D.submitStretch(s, { id: 's-201', text: 'Qo‘shimcha: Mirzo Ulug‘bekda qo‘ng‘iroq navbati qayta taqsimlandi, konversiya 44% ga yetdi.', link: 'drive://s-201/v2' });
      const midStatus = D.cardDecision(s, D.getCard(s, 'c-102')).conditions.find((c) => c.type === 'stretch_approved').passed;
      s = D.reviewStretch(s, { id: 's-201', decision: 'approved', reason: 'Edu hisobotlari bilan tasdiqlandi' });
      const st = D.getStretch(s, 's-201');
      const cond = D.cardDecision(s, D.getCard(s, 'c-102')).conditions.find((c) => c.type === 'stretch_approved');
      const ldr04Unchanged = D.getCard(s, 'c-102').scores['LDR-04'].final === 5;
      return ok(st.submissions.length === 2 && midStatus === false && cond.passed && ldr04Unchanged, `Yuborishlar: ${st.submissions.length} (${st.submissions.map((x) => x.review?.decision).join(' → ')}); panel sharti: ${cond.passed ? 'bajarilgan' : 'ochiq'}; kompetensiya bahosi avtomatik o‘zgarmadi`);
    },
  },
  {
    id: 'UAT 11',
    title: 'Ustoz LT-3: ≥95% tayyor, 90–<95% shartli, <90% yoki gate/kuzatuv bajarilmasa tayyor emas, DE',
    expected: 'Mos ravishda tayyor (zaxiraga), rivojlanish sharti bilan, tayyor emas va dalil yetarli emas. Qaror sababi ko‘rinadi.',
    run() {
      const p = geModel.profiles.find((x) => x.code === 'LT-3');
      const codes = Object.keys(p.targets);
      const full = { ...p.targets };
      const lower = (n) => { const o = { ...full }; codes.filter((c) => o[c] > 3).slice(0, n).forEach((c) => { o[c] -= 1; }); return o; };
      const ev = Object.fromEntries(codes.map((c) => [c, compMethods(geModel, geModel.competencies.find((x) => x.code === c))]));
      const gates = Object.fromEntries(p.conditions.find((c) => c.type === 'gates').params.items.map((g) => [g.code, { met: true }]));
      const ctx = { currentLevel: 'LT-2', tenureMonths: 14, kpi: { type: 'regular', value: 82 }, observations: 3, observationAvg: 4.2, evidenceMethods: ev, gates, targetRole: null };
      const a = evaluateDecision(geModel, p, full, ctx);
      const b = evaluateDecision(geModel, p, lower(6), ctx); // 78/84 = 92,9%
      const c = evaluateDecision(geModel, p, lower(13), ctx); // 71/84 = 84,5%
      const d = evaluateDecision(geModel, p, { ...full, 'GEN-04': DE }, ctx);
      const e = evaluateDecision(geModel, p, full, { ...ctx, observationAvg: 3.5 });
      const f = evaluateDecision(geModel, p, full, { ...ctx, gates: { ...gates, lang: { met: false } } });
      const pass = a.status === 'recommend_reserve' && b.status === 'conditional' && c.status === 'not_ready' && d.status === 'de' && e.status === 'not_ready' && f.status === 'not_ready' && f.reasons.some((r) => r.includes('IELTS'));
      return ok(pass, `${fmtPct(a.match.match)} → «${a.label}»; ${fmtPct(b.match.match)} → «${b.label}»; ${fmtPct(c.match.match)} → «${c.label}»; DE → «${d.label}»; kuzatuv 3,5 → «${e.label}»; IELTS gate → «${f.label}»`);
    },
  },
  {
    id: 'UAT 12',
    title: 'Kurs 2-darajagacha, dalilga 3 kiritiladi',
    expected: '3 rad etiladi. Tasdiqlangan 2 profilga o‘quv dalili sifatida yoziladi va real ish talabini yopmaydi.',
    run() {
      let s = createSeed();
      s = D.submitExtraEvidence(s, { employeeId: 'e-aziza', competency: 'LDR-05', activityId: 'act-ldr05', context: 'learning', description: 'Kurs, test va keys yakunlandi' });
      const id = s.evidenceQueue[0].id;
      const rejected = tryErr(() => D.reviewExtraEvidence(s, { id, decision: 'approved', level: 3, reason: 'Keys yaxshi' }));
      s = D.reviewExtraEvidence(s, { id, decision: 'approved', level: 2, reason: 'Kurs chegarasi bo‘yicha' });
      const rec = D.getEmployee(s, 'e-aziza').records['LDR-05'].at(-1);
      const covers = evidenceSatisfies({ level: 2, context: 'work' }, rec);
      const capOk = checkActivityCap(2, s.activities[0]).ok;
      return ok(!!rejected && rec.level === 2 && rec.context === 'learning' && !covers && capOk, `3 → rad: «${rejected}»; profil: ${rec.level}-daraja · o‘quv dalili; real ish talabini yopadimi: ${covers ? 'ha' : 'yo‘q'}`);
    },
  },
  {
    id: 'UAT 13',
    title: 'Xodim ikki rolni solishtiradi, qiziqish bildiradi',
    expected: 'Tafovut, dalil qamrovi va keyingi qadam ko‘rinadi. HR ro‘yxatida qiziqish chiqadi. Rezerv uchun tayyorlik xulosasi talab qilinadi.',
    run() {
      let s = createSeed();
      s = D.expressInterest(s, { employeeId: 'e-aziza', target: 'FR-1', note: 'Filial boshqaruviga qiziqaman' });
      const row = s.succession.find((x) => x.employeeId === 'e-aziza' && x.target === 'FR-1');
      const reserveErr = tryErr(() => D.setSuccessionStatus(s, { id: row.id, status: 'reserve', reason: 'Tavsiya' }));
      const emp = D.getEmployee(s, 'e-malika');
      const fr1 = frModel.profiles[0];
      const scores = Object.fromEntries(Object.entries(emp.records).map(([c, r]) => [c, r.filter((x) => x.context === 'work').at(-1)?.level]).filter(([, v]) => v));
      const m = computeMatch(fr1.targets, scores);
      return ok(!!row && row.status === 'interested' && !!reserveErr && m.coverage < 1, `HR ro‘yxatida: ${row?.status}; rezerv: «${reserveErr}»; Malika FR-1 qamrovi ${Math.round(m.coverage * 100)}%`);
    },
  },
  {
    id: 'UAT 14',
    title: 'IDP yakunlanadi va qayta baholash ochiladi',
    expected: 'Oldingi va yangi natija bog‘lanadi. Kurs yakuni rivojlanish holatini yangilaydi.',
    run() {
      let s = createSeed();
      s = D.courseCompleted(s, { employeeId: 'e-jasur', courseId: 'CRS-LDR-04', externalId: 'exode:enr-7781' });
      s = D.courseCompleted(s, { employeeId: 'e-jasur', courseId: 'CRS-LDR-04', externalId: 'exode:enr-7781' });
      const learning = s.idp.find((x) => x.id === 'idp-2').learningStatus;
      s = D.updateIdp(s, { id: 'idp-2', patch: { status: 'done', evidence: '2 o‘rinbosar tayyorlandi, mentor qaydi' } });
      s = D.openReassessment(s, { cardId: 'c-104', codes: ['LDR-04', 'KOR-01'] });
      const re = s.cards[0];
      const prev = D.getCard(s, 'c-104');
      const pass = re.prevCardId === 'c-104' && !re.scores['LDR-04'] && re.scores['LDR-02'] && prev.stage === 'published' && learning === 'Kurs yakunlangan' && s.courseEvents.length === 1;
      return ok(pass, `Yangi karta ${re.id} ← ${re.prevCardId}; qayta ochilgan: ${re.reopened.join(', ')}; kurs holati: ${learning}; takroriy kurs yozuvi: ${s.courseEvents.length} ta`);
    },
  },
  {
    id: 'UAT 15',
    title: 'Ruxsatsiz fayl so‘rovi yoki takroriy e’lon',
    expected: 'Faylga kirish rad etiladi. Takroriy so‘rov yangi qaror yoki bildirishnoma yaratmaydi.',
    run() {
      let s = createSeed();
      const r = D.requestEvidenceFile(s, { user: { role: 'employee', employeeId: 'e-malika', name: 'Malika Yusupova' }, cardId: 'c-102', file: 'natija.xlsx' });
      s = r.state;
      const targets = geModel.profiles.find((p) => p.code === 'LT-2').targets;
      for (const code of Object.keys(targets)) s = D.setScore(s, { cardId: 'c-103', code, final: 3, basis: 'Kuzatuv va ish namunasi' });
      s = D.advanceStage(s, { cardId: 'c-103' }); // assessment
      s = D.advanceStage(s, { cardId: 'c-103' }); // panel
      s = D.recordPanel(s, { cardId: 'c-103', decision: 'not_ready', protocol: 'Dalillar to‘liq emas — IDP', members: 'Akademik rahbar, HR' });
      s = D.advanceStage(s, { cardId: 'c-103' }); // approval
      s = D.advanceStage(s, { cardId: 'c-103' }); // published
      const n1 = s.notifications.length;
      const idp1 = s.idp.length;
      s = D.advanceStage(s, { cardId: 'c-103', requestKey: 'retry' });
      const stale = tryErr(() => D.setScore(s, { cardId: 'c-101', code: 'LDR-05', final: 4, basis: 'x', expectedRevision: 1 }));
      return ok(!r.allowed && D.getCard(s, 'c-103').stage === 'published' && s.notifications.length === n1 && s.idp.length === idp1 && !!stale, `Fayl: ${r.allowed ? 'ochildi' : 'rad etildi'}; takroriy e’lon: bildirishnomalar ${n1} → ${s.notifications.length}; eskirgan reviziya: «${stale}»`);
    },
  },
];

export function runAll() {
  return UAT.map((u) => {
    try {
      return { ...u, ...u.run() };
    } catch (e) {
      return { ...u, pass: false, actual: `Xato: ${e.message}` };
    }
  });
}
