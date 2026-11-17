// Demo ma'lumotlar. Ismlar va raqamlar shartli — faqat namoyish uchun.
import { frModel, geModel, abModel, HR_CODES } from './models.js';
import { compMethods } from '../core/modelKit.js';
import { resolveScores, computeMatch } from '../core/calc.js';
import { idpProposal } from '../core/domain.js';
import { COURSES, PATHS } from './courses.js';

import { createOnbHistory } from './onbHistory.js';
export const TODAY = '2026-11-10';

const sc = (final, basis, evidences = []) => ({ final, basis, evidences, by: 'Baholovchi', at: '2026-10-28' });
const ev = (method, value, note, sourceId) => ({ method, value, note, sourceId });

function frScores(map, extras = {}) {
  const out = {};
  for (const [code, v] of Object.entries(map)) {
    if (code === 'FUN-05') continue;
    if (v === null) continue;
    out[code] = extras[code] || sc(v, `Ish dalillari ${v}-daraja indikatorlarini tasdiqlaydi.`, [ev('interview', v, 'BEI intervyu', `INT-${code}`)]);
  }
  return out;
}
const hr = (vals) => Object.fromEntries(HR_CODES.map((c, i) => [c, vals[i]]));

// Aziza: LT-1 → LT-2, e'lon qilingan. Har kompetensiya kamida 2 usul bilan, kuzatuvga tegishlilari dars kuzatuvi bilan tasdiqlangan.
function geAzizaCard() {
  const strong = { 'BEH-02': 4, 'GEN-04': 4, 'GEN-11': 4 };
  const lt2 = geModel.profiles.find((p) => p.code === 'LT-2').targets;
  const obsIds = ['OBS-A1', 'OBS-A2'];
  const scores = {};
  for (const [code, t] of Object.entries(lt2)) {
    const comp = geModel.competencies.find((c) => c.code === code);
    const ms = compMethods(geModel, comp);
    const pick = ms.includes('observation') ? ['observation', ms.find((m) => m !== 'observation')] : ms.slice(0, 2);
    const v = strong[code] || t;
    scores[code] = sc(v, `${v}-daraja indikatorlari ${pick.length} mustaqil manba bilan tasdiqlandi.`, pick.map((m, i) => ev(m, v, '', m === 'observation' ? obsIds[i % 2] : `${m.toUpperCase()}-A-${code}`)));
  }
  const obsCodes = Object.keys(scores).filter((c) => scores[c].evidences.some((e) => e.method === 'observation'));
  const half = Math.ceil(obsCodes.length / 2);
  const rate = (codes) => Object.fromEntries(codes.map((c) => [c, scores[c].final]));
  return {
    id: 'c-105', cycleId: 'cy-2026-k', employeeId: 'e-aziza', modelVersionId: 'GE@1.0', profileFrom: 'LT-1', profileTo: 'LT-2',
    branchId: 'b-yunus', stage: 'published', revision: 6, deadline: '2026-11-05', targetRoleId: null, stretchId: null,
    assessors: { evaluator: 'Shahnoza Mirzayeva (metodist)', calibrator: 'Akademik rahbar' },
    scores, hrScores: {},
    gates: { lang: { met: true, evidence: 'IELTS 8.0 (W 7.0, S 7.5)', by: 'HR/L&D', at: '2026-10-04' }, course: { met: true, evidence: 'Teacher Training Course sertifikati №TTC-0412', by: 'HR/L&D', at: '2026-10-04' } },
    observations: [
      { id: 'OBS-A1', methodist: 'Shahnoza Mirzayeva', date: '2026-10-08', lesson: 'Elementary, Unit 3', group: 'EL-07 (14 o‘quvchi)', behavior: 'Exit ticket orqali tushunish tekshirildi; lesson plan bosqichlari aniq.', ratings: rate(obsCodes.slice(0, half)) },
      { id: 'OBS-A2', methodist: 'Shahnoza Mirzayeva', date: '2026-10-22', lesson: 'Intermediate, Speaking club', group: 'IN-03 (11 o‘quvchi)', behavior: 'Juftlik ishida barcha o‘quvchilar gapirdi; feedback keyingi qadam bilan.', ratings: rate(obsCodes.slice(half)) },
    ],
    kpi: { type: 'regular', value: 85 }, panel: null, appointment: null, published: { at: '2026-11-06', by: 'Akademik rahbar + HRD', revision: 6 }, createdAt: '2026-10-04',
  };
}

export function createSeed() {
  const branches = [
    { id: 'b-chil', name: 'Chilonzor', region: 'Toshkent', activeEmployees: 38 },
    { id: 'b-yunus', name: 'Yunusobod', region: 'Toshkent', activeEmployees: 72 },
    { id: 'b-serg', name: 'Sergeli', region: 'Toshkent', activeEmployees: 46 },
    { id: 'b-yangi', name: 'Yangiyo‘l', region: 'Toshkent', activeEmployees: 39 },
    { id: 'b-mirz', name: 'Mirzo Ulug‘bek', region: 'Toshkent', activeEmployees: 41 },
    { id: 'b-samq', name: 'Samarqand (yangi)', region: 'Samarqand', activeEmployees: 24, isNew: true },
    { id: 'b-olm', name: 'Olmazor', region: 'Toshkent', activeEmployees: 35 },
  ];

  // Maqsadli lavozimlar (shtat). R ko'lami filiallar va faol xodimlar sonidan hisoblanadi.
  const roles = [
    { id: 'r-yunus', name: 'Yunusobod filiali rahbari', branchIds: ['b-yunus'], vacant: true },
    { id: 'r-sy', name: 'Sergeli + Yangiyo‘l rahbari', branchIds: ['b-serg', 'b-yangi'], vacant: false },
  ];

  const employees = [
    {
      id: 'e-dilshod', name: 'Dilshod Karimov', position: 'FR', currentLevel: 'FR-1', branchId: 'b-chil',
      levelSince: '2025-08-01', kpi10m: 82, history: [{ level: 'FR-1', from: '2025-08-01', doc: 'Buyruq №118-K' }], records: {},
    },
    {
      id: 'e-nodira', name: 'Nodira Rahimova', position: 'FR', currentLevel: 'FR-2', branchId: 'b-serg',
      levelSince: '2025-10-01', kpi10m: 88, history: [{ level: 'FR-1', from: '2023-09-01', doc: 'Buyruq №64-K' }, { level: 'FR-2', from: '2025-10-01', doc: 'Buyruq №141-K' }], records: {},
    },
    {
      id: 'e-jasur', name: 'Jasur Toshmatov', position: 'FR', currentLevel: 'FR-1', branchId: 'b-olm',
      levelSince: '2025-06-01', kpi10m: 79, history: [{ level: 'FR-1', from: '2025-06-01', doc: 'Buyruq №97-K' }], records: {},
    },
    {
      id: 'e-bekzod', name: 'Bekzod Aliyev', position: 'FR', currentLevel: 'FR-1', branchId: 'b-mirz',
      levelSince: '2025-03-01', kpi10m: 77, history: [{ level: 'FR-1', from: '2025-03-01', doc: 'Buyruq №52-K' }], records: {},
    },
    {
      id: 'e-sardor', name: 'Sardor Nazarov', position: 'FR', currentLevel: 'FR-1', branchId: 'b-samq',
      levelSince: '2026-01-15', kpi10m: null, rampUp: true, history: [{ level: 'FR-1', from: '2026-01-15', doc: 'Buyruq №7-K' }], records: {},
    },
    {
      id: 'e-malika', name: 'Malika Yusupova', position: 'GE', currentLevel: 'LT-1', branchId: 'b-chil', kpi10m: 82, supervisorId: 'e-gulbahor',
      levelSince: '2025-12-01', history: [{ level: 'LT-0', from: '2025-06-01', doc: 'Buyruq №118-K' }, { level: 'LT-1', from: '2025-12-01', doc: 'Buyruq №201-K' }],
      records: {
        'KOR-01': [{ level: 3, context: 'work', source: 'LT-1 attestatsiyasi', date: '2025-11-20' }],
        'KOR-03': [{ level: 3, context: 'work', source: 'LT-1 attestatsiyasi', date: '2025-11-20' }],
        'GEN-01': [{ level: 3, context: 'work', source: 'LT-1 attestatsiyasi', date: '2025-11-20' }],
        'GEN-03': [{ level: 2, context: 'work', source: 'LT-1 attestatsiyasi', date: '2025-11-20' }],
        'GEN-04': [{ level: 3, context: 'work', source: 'LT-1 attestatsiyasi', date: '2025-11-20' }],
        'BEH-02': [{ level: 3, context: 'work', source: 'LT-1 attestatsiyasi', date: '2025-11-20' }],
        'LDR-05': [{ level: 2, context: 'learning', source: '«O‘zgarishlarga yetakchilik qilish» kursi, test va keys', date: '2026-09-30' }],
      },
    },
    {
      id: 'e-aziza', name: 'Aziza Qodirova', position: 'GE', currentLevel: 'LT-1', branchId: 'b-yunus', kpi10m: 85, supervisorId: 'e-sherzod',
      levelSince: '2025-09-01', history: [{ level: 'LT-1', from: '2025-09-01', doc: 'Buyruq №155-K' }],
      records: {
        'BEH-03': [{ level: 2, context: 'learning', source: 'Kurs «O‘quvchi retentioni: motivatsiya va ketish xavfi»', date: '2026-10-12', courseId: 'CRS-GE-RET' }, { level: 3, context: 'work', source: 'Kurs «O‘quvchi retentioni» — amaliy topshiriq, metodist xulosasi', date: '2026-10-28', courseId: 'CRS-GE-RET' }],
      },
    },
    {
      id: 'e-rustam', name: 'Rustam Aliyev', position: 'FIN', currentLevel: 'MOL', branchId: 'b-chil', kpi10m: 91,
      levelSince: '2024-03-01', history: [{ level: 'MOL', from: '2024-03-01', doc: 'Buyruq №40-K' }],
      records: {
        'FUN-04': [{ level: 2, context: 'learning', source: 'Kurs «Filial moliyasi va P&L»', date: '2026-09-12', courseId: 'CRS-FIN-01' }, { level: 3, context: 'work', source: 'Kurs «Filial moliyasi va P&L» — amaliy topshiriq, mentor xulosasi', date: '2026-10-15', courseId: 'CRS-FIN-01' }],
        'FUN-01': [{ level: 2, context: 'learning', source: 'Kurs «Sotuv voronkasi va sinov darsidan to‘lovga konversiya»', date: '2026-10-25', courseId: 'CRS-SALES-01' }],
        'KOR-01': [{ level: 3, context: 'work', source: 'Moliya bo‘limi attestatsiyasi', date: '2025-12-10' }],
        'KOR-02': [{ level: 3, context: 'work', source: 'Moliya bo‘limi attestatsiyasi', date: '2025-12-10' }],
        'KOR-03': [{ level: 3, context: 'work', source: 'Moliya bo‘limi attestatsiyasi', date: '2025-12-10' }],
        'KOR-04': [{ level: 3, context: 'work', source: 'Moliya bo‘limi attestatsiyasi', date: '2025-12-10' }],
        'LDR-02': [{ level: 3, context: 'work', source: 'Moliya bo‘limi attestatsiyasi', date: '2025-12-10' }],
      },
    },
    {
      id: 'e-gulbahor', name: 'Gulbahor Rasulova', position: 'GE', currentLevel: 'LT-3', branchId: 'b-chil', kpi10m: 84,
      levelSince: '2025-02-01', history: [{ level: 'LT-2', from: '2023-09-01', doc: 'Buyruq №77-K' }, { level: 'LT-3', from: '2025-02-01', doc: 'Buyruq №31-K' }], records: {},
    },
    {
      id: 'e-sherzod', name: 'Sherzod Ismoilov', position: 'GE', currentLevel: 'LT-4', branchId: 'b-yunus', kpi10m: 88,
      levelSince: '2024-09-01', history: [{ level: 'LT-3', from: '2022-09-01', doc: 'Buyruq №120-K' }, { level: 'LT-4', from: '2024-09-01', doc: 'Buyruq №166-K' }],
      records: {
        'LDR-04': [{ level: 3, context: 'work', source: 'Mentorlik dasturi: 6 ustozni boshqarish (qo‘shimcha dalil)', date: '2026-06-15' }],
        'AB-01': [{ level: 2, context: 'work', source: 'Filiallararo dars kuzatuvi loyihasi (qo‘shimcha dalil)', date: '2026-05-20' }],
      },
    },
    {
      id: 'e-dildora', name: 'Dildora Saidova', position: 'GE', currentLevel: 'LT-0', branchId: 'b-chil', kpi10m: null, supervisorId: 'e-gulbahor',
      levelSince: '2026-06-01', history: [{ level: 'LT-0', from: '2026-06-01', doc: 'Buyruq №92-K' }], records: {},
    },
    {
      id: 'e-otabek', name: 'Otabek Rahimov', position: 'GE', currentLevel: 'LT-2', branchId: 'b-chil', kpi10m: 86, supervisorId: 'e-gulbahor',
      levelSince: '2025-05-01', history: [{ level: 'LT-1', from: '2024-03-01', doc: 'Buyruq №45-K' }, { level: 'LT-2', from: '2025-05-01', doc: 'Buyruq №88-K' }], records: {},
    },
    {
      id: 'e-kamola', name: 'Kamola Ergasheva', position: 'GE', currentLevel: 'LT-1', branchId: 'b-yunus', kpi10m: 80, supervisorId: 'e-sherzod',
      levelSince: '2026-02-01', history: [{ level: 'LT-1', from: '2026-02-01', doc: 'Buyruq №19-K' }], records: {},
    },
    {
      id: 'e-farrux', name: 'Farrux Yo‘ldoshev', position: 'GE', currentLevel: 'LT-2', branchId: 'b-yunus', kpi10m: 78, supervisorId: 'e-sherzod',
      levelSince: '2025-09-01', history: [{ level: 'LT-2', from: '2025-09-01', doc: 'Buyruq №150-K' }], records: {},
    },
    {
      id: 'e-nilufar', name: 'Nilufar Tursunova', position: 'GE', currentLevel: 'LT-0', branchId: 'b-yunus', kpi10m: null, supervisorId: 'e-sherzod', hiredAt: '2026-10-14',
      phone: '+998 99 415 72 08', jobsterId: 'JB-5188', eduId: 'EDU-30051', source: 'recruiting',
      levelSince: '2026-10-14', history: [{ level: 'LT-0', from: '2026-10-14', doc: 'Buyruq №171-K' }], records: {},
    },
    // Moslashuv (onboarding) davridagi va arxivdagi xodimlar — Jobster ATS → Edu orqali kelgan.
    {
      id: 'e-jahongir', name: 'Jahongir Ortiqov', position: 'FIN', currentLevel: 'MOL', branchId: 'b-chil', kpi10m: null, supervisorId: 'e-rustam', hiredAt: '2026-10-05',
      phone: '+998 90 512 40 17', jobsterId: 'JB-5302', eduId: 'EDU-30177', source: 'recruiting',
      levelSince: '2026-10-05', history: [{ level: 'MOL', from: '2026-10-05', doc: 'Jobster ATS · JB-5302' }], records: {},
    },
    {
      id: 'e-sanjar', name: 'Sanjar Komilov', position: 'GE', currentLevel: 'LT-0', branchId: 'b-chil', kpi10m: null, supervisorId: 'e-gulbahor', hiredAt: '2026-10-31',
      phone: '+998 94 630 11 85', jobsterId: 'JB-5468', eduId: 'EDU-30355', source: 'branch',
      levelSince: '2026-10-31', history: [{ level: 'LT-0', from: '2026-10-31', doc: 'Jobster ATS · JB-5468' }], records: {},
    },
    {
      id: 'e-ziyoda', name: 'Ziyoda Hamidova', position: 'GE', currentLevel: 'LT-0', branchId: 'b-serg', kpi10m: null, supervisorId: null, hiredAt: '2026-10-22',
      phone: '+998 97 201 33 40', jobsterId: 'JB-5411', eduId: 'EDU-30290', source: 'recruiting',
      levelSince: '2026-10-22', history: [{ level: 'LT-0', from: '2026-10-22', doc: 'Jobster ATS · JB-5411' }], records: {},
    },
    {
      id: 'e-lola', name: 'Lola Mahmudova', position: 'GE', currentLevel: 'LT-0', branchId: 'b-yunus', kpi10m: null, supervisorId: 'e-sherzod', hiredAt: '2026-06-02',
      phone: '+998 91 778 02 64', jobsterId: 'JB-4720', eduId: 'EDU-29511', source: 'recruiting',
      status: 'archived', archivedAt: '2026-08-20', leftAt: '2026-08-20', archiveReason: 'O‘qishni davom ettirish uchun ketdi', eduArchiveAt: '2026-09-19',
      levelSince: '2026-06-02', history: [{ level: 'LT-0', from: '2026-06-02', doc: 'Jobster ATS · JB-4720' }], records: {},
    },
  ];


  const cycles = [{ id: 'cy-2026-k', name: '2026 kuz sikli', from: '2026-10-01', to: '2026-12-15', status: 'active' }];

  const t = (code) => frModel.profiles.find((p) => p.code === code).targets;

  // c1: FR-1 → FR-2, bitta kompetensiya (LDR-05) baholanmagan
  const dilshod = { ...t('FR-2'), 'LDR-02': 3, 'FUN-04': 3, 'FUN-02': 4, 'LDR-05': null };
  const dilshodExtras = {
    'LDR-02': sc(3, 'Intervyu 4 bo‘lsa-da, keys va auditdagi ish dalillari 3-daraja indikatorlarini tasdiqlaydi: manbalarni solishtiradi, ildiz sababni mustaqil tekshiradi.', [
      ev('interview', 4, 'BEI: 2 ta hisobotni solishtirgan misol', 'INT-LDR-02'),
      ev('case', 3, 'FK-1 keys: 3-oy hisobi to‘g‘ri, sabab tahlili qisman', 'CASE-FK1'),
      ev('audit', 3.5, 'LDR-02-A1: 4, LDR-02-A2: 3', 'AUD-CHIL-2026'),
    ]),
  };

  const cards = [
    {
      id: 'c-101', cycleId: 'cy-2026-k', employeeId: 'e-dilshod', modelVersionId: 'FR@0.3', profileFrom: 'FR-1', profileTo: 'FR-2',
      branchId: 'b-chil', stage: 'assessment', revision: 3, deadline: '2026-11-25', targetRoleId: 'r-yunus', stretchId: 's-200',
      assessors: { evaluator: 'Gulnora Saidova (assessor)', calibrator: 'Rustam Ergashev (L&D)' },
      scores: frScores(dilshod, dilshodExtras), hrScores: hr([4, 4, 4, 3, 4, 4, 4, 3, 4, 4, 4]),
      kpi: { type: 'regular', value: 82 }, observations: [], panel: null, appointment: null, published: null,
      createdAt: '2026-10-02',
    },
    {
      id: 'c-102', cycleId: 'cy-2026-k', employeeId: 'e-nodira', modelVersionId: 'FR@0.3', profileFrom: 'FR-2', profileTo: 'FR-3',
      branchId: 'b-serg', stage: 'evidence', revision: 2, deadline: '2026-12-10', targetRoleId: null, stretchId: 's-201',
      assessors: { evaluator: 'Gulnora Saidova (assessor)', calibrator: 'Rustam Ergashev (L&D)' },
      scores: frScores({ ...t('FR-3'), 'LDR-03': 4, 'FUN-01': 4, 'KOR-04': 3 }), hrScores: hr([4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4]),
      kpi: { type: 'regular', value: 88 }, observations: [], panel: null, appointment: null, published: null,
      createdAt: '2026-10-03',
    },
    {
      id: 'c-103', cycleId: 'cy-2026-k', employeeId: 'e-malika', modelVersionId: 'GE@1.0', profileFrom: 'LT-1', profileTo: 'LT-2',
      branchId: 'b-chil', stage: 'evidence', revision: 1, deadline: '2026-11-30', targetRoleId: null, stretchId: null,
      assessors: { evaluator: 'Shahnoza Mirzayeva (metodist)', calibrator: 'Akademik rahbar' },
      scores: {
        'GEN-03': { final: null, basis: '', evidences: [ev('observation', 3, '1-kuzatuv: CCQ/ICQ bilan tushunish tekshirildi', 'OBS-1')] },
        'GEN-04': { final: null, basis: '', evidences: [ev('observation', 3, '1-kuzatuv: juftlik ishi, vaqt nazorati', 'OBS-1')] },
        'GEN-05': { final: null, basis: '', evidences: [ev('observation', 2, '1-kuzatuv: feedback umumiy', 'OBS-1')] },
        'BEH-02': { final: null, basis: '', evidences: [ev('observation', 3, '1-kuzatuv', 'OBS-1')] },
        'KOR-01': sc(3, 'BEI: natija uchun shaxsiy javobgarlik misollari; rahbar fikri mos.', [ev('interview', 3, 'BEI', 'INT-M1'), ev('feedback360', 3, 'Bevosita rahbar fikri', 'FB-M1')]),
      },
      hrScores: {}, gates: { lang: { met: true, evidence: 'IELTS 8.0 (W 7.5, S 7.5), 2026-03', by: 'HR/L&D', at: '2026-10-05' } },
      observations: [
        { id: 'OBS-1', methodist: 'Shahnoza Mirzayeva', date: '2026-10-21', lesson: 'Pre-Intermediate, Unit 6: Past Continuous', group: 'PI-14 (12 o‘quvchi)',
          behavior: 'Ko‘rsatmalar qisqa, CCQ/ICQ bilan tekshirildi; juftlik ishida vaqt nazorati yaxshi; xatolarga feedback umumiy bo‘ldi.',
          ratings: { 'GEN-03': 3, 'GEN-04': 3, 'GEN-05': 2, 'BEH-02': 3 }, indicator: 'GEN-03', level: 3 },
      ],
      kpi: { type: 'regular', value: 82 }, panel: null, appointment: null, published: null, createdAt: '2026-10-05',
    },
    {
      id: 'c-104', cycleId: 'cy-2026-k', employeeId: 'e-jasur', modelVersionId: 'FR@0.3', profileFrom: 'FR-1', profileTo: 'FR-2',
      branchId: 'b-olm', stage: 'published', revision: 4, deadline: '2026-11-01', targetRoleId: 'r-yunus', stretchId: null,
      assessors: { evaluator: 'Gulnora Saidova (assessor)', calibrator: 'Rustam Ergashev (L&D)' },
      // 57 / 61 = 93,4%
      scores: frScores({ ...t('FR-2'), 'KOR-01': 3, 'LDR-01': 3, 'LDR-04': 3, 'FUN-03': 3 }), hrScores: hr([4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4]),
      kpi: { type: 'regular', value: 79 }, observations: [], panel: null, appointment: null,
      published: { at: '2026-11-02', by: 'HRD', revision: 4 }, createdAt: '2026-10-02',
    },
    geAzizaCard(),
    {
      id: 'c-106', cycleId: 'cy-2026-k', employeeId: 'e-bekzod', modelVersionId: 'FR@0.3', profileFrom: 'FR-1', profileTo: 'FR-2',
      branchId: 'b-mirz', stage: 'assessment', revision: 2, deadline: '2026-11-08', targetRoleId: 'r-yunus', stretchId: null,
      assessors: { evaluator: 'Gulnora Saidova (assessor)', calibrator: 'Rustam Ergashev (L&D)' },
      scores: frScores(t('FR-2')), hrScores: hr([4, 4, 3, 4, 4, 4, 3, 4, 4, 4, 'DE']),
      kpi: { type: 'regular', value: 77 }, observations: [], panel: null, appointment: null, published: null,
      createdAt: '2026-10-02',
    },
  ];

  const stretches = [
    {
      id: 's-200', employeeId: 'e-dilshod', kind: 'FR-1 → FR-2', title: 'Chilonzor + Olmazor: murojaatlarga javob standarti',
      scope: '2 filial, 73 faol xodim', deadline: '2026-09-30', authority: 'Ikki filial servis menejerlariga vazifa berish',
      expected: 'Javob vaqti 24 soatdan 4 soatga', criteria: 'CRM hisobotida 8 hafta dinamikasi', competencies: ['LDR-01', 'FUN-03', 'KOR-03'],
      mentor: 'Nodira Rahimova', status: 'approved',
      submissions: [{ at: '2026-09-28', text: 'Javob vaqti 8 haftada 26 soatdan 3,5 soatga tushdi. Ikki filialda yagona skript va navbatchilik jadvali joriy qilindi.', link: 'drive://stretch/s-200/hisobot.pdf', review: { decision: 'approved', reason: 'CRM hisoboti bilan tasdiqlandi', by: 'HR/L&D', at: '2026-10-02' } }],
    },
    {
      id: 's-201', employeeId: 'e-nodira', kind: 'FR-2 → FR-3', title: 'Uch filialda sinov darsidan to‘lovga o‘tishni yaxshilash',
      scope: 'Sergeli, Yangiyo‘l, Mirzo Ulug‘bek — 3 filial', deadline: '2026-11-20', authority: 'Uch filial rahbarlariga vazifa berish, sinov darsi skriptini o‘zgartirish',
      expected: 'Sinov darsidan to‘lovga konversiya 38% → 48%', criteria: 'Edu/CRM: boshlang‘ich va yakuniy konversiya, filiallar kesimi', competencies: ['LDR-04', 'LDR-05', 'FUN-01'],
      mentor: 'Operatsion direktor', status: 'submitted',
      submissions: [{ at: '2026-11-04', text: 'Konversiya 3 filialda o‘rtacha 37,6% dan 45,9% ga oshdi. Asosiy sabab: sinov darsidan keyingi 24 soat ichida qo‘ng‘iroq qilinmagan. Filial rahbarlariga kunlik nazorat vazifasi berildi; Mirzo Ulug‘bekda o‘sish eng past (41%), sabab tahlili davom etmoqda.', link: 'drive://stretch/s-201/natija.xlsx', review: null }],
    },
  ];

  const idp = [
    { id: 'idp-1', employeeId: 'e-jasur', cardId: 'c-104', competency: 'KOR-01', targetLevel: 4, task: 'Bo‘limlararo 2 loyihada egalikni belgilash va bajarilishini nazorat qilish', courseId: null, owner: 'Bevosita rahbar', due: '2027-02-01', evidence: '', reassessAt: '2027-02-15', status: 'open', source: 'auto' },
    { id: 'idp-2', employeeId: 'e-jasur', cardId: 'c-104', competency: 'LDR-04', targetLevel: 4, task: 'Rahbarlar uchun mentorlik dasturi + 2 o‘rinbosar tayyorlash', courseId: 'CRS-LDR-04', owner: 'HR/L&D', due: '2027-02-01', evidence: '', reassessAt: '2027-02-15', status: 'open', source: 'auto' },
  ];

  const interests = [
    { id: 'int-1', employeeId: 'e-malika', target: 'FR-1', at: '2026-10-12', note: 'Filial rahbari yo‘nalishiga qiziqaman, mentor bilan amaliy vazifa bajarishga tayyorman.' },
    { id: 'int-2', employeeId: 'e-gulbahor', target: 'AB-1', at: '2026-10-20', note: 'LT-4 emas, akademik bo‘lim rahbari bo‘lishni xohlayman: ustozlar jamoasi bilan ishlash menga yaqin.' },
  ];

  const succession = [
    { id: 'suc-1', employeeId: 'e-malika', target: 'FR-1', via: 'interest', addedAt: '2026-10-12', status: 'interested', owner: 'HR/L&D', next: 'FR-1 uchun real ish dalili: mentor bilan amaliy vazifa', decision: null },
    { id: 'suc-2', employeeId: 'e-nodira', target: 'FR-3', via: 'hr', addedAt: '2026-10-03', status: 'trial', owner: 'HRD', next: 'Stretch dalilini tekshirish va panelga kiritish', decision: null },
    { id: 'suc-3', employeeId: 'e-jasur', target: 'FR-2', via: 'assessment', addedAt: '2026-11-02', status: 'developing', owner: 'Bevosita rahbar', next: 'IDP: KOR-01, LDR-04 — qayta baholash 2027-02-15', decision: null },
    { id: 'suc-4', employeeId: 'e-dilshod', target: 'FR-2', via: 'hr', addedAt: '2026-10-02', status: 'trial', owner: 'HRD', next: 'Kartadagi qolgan kompetensiya va panel', decision: null },
    { id: 'suc-5', employeeId: 'e-gulbahor', target: 'AB-1', via: 'interest', addedAt: '2026-10-20', status: 'interested', owner: 'HR/L&D', next: 'Nomzodlar bilan solishtirish', decision: null },
  ];

  const activities = [
    { id: 'act-ldr05', name: '«O‘zgarishlarga yetakchilik qilish» kursi + test + keys', competency: 'LDR-05', maxLevel: 2, type: 'course' },
    { id: 'act-fun04', name: '«Filial moliyasi» kursi + keys', competency: 'FUN-04', maxLevel: 2, type: 'course' },
    { id: 'act-mentor', name: 'Mentor bilan real loyiha', competency: '*', maxLevel: 5, type: 'work' },
  ];

  const evidenceQueue = [];

  const kpiNewBranch = {
    branchId: 'b-samq', employeeId: 'e-sardor', period: '2026-01 — 2026-10',
    items: [
      { stage: 'Ochilishga tayyorgarlik', name: 'Tasdiqlangan shtat rejasining bajarilishi', weight: 15, plan: 15, fact: 13, evidence: 'Shtat jadvali', checklist: false },
      { stage: 'Ochilishga tayyorgarlik', name: 'Majburiy ochilish tayyorgarligi (20 band)', weight: 15, plan: 20, fact: 20, evidence: 'Checklist akti', checklist: true },
      { stage: 'Ishga tushirish', name: 'Tasdiqlangan qabul rejasining bajarilishi', weight: 15, plan: 200, fact: 170, evidence: 'Edu hisobot', checklist: false },
      { stage: 'Ishga tushirish', name: 'Dars va xizmat jarayonlarining ishga tushishi (20 band)', weight: 10, plan: 20, fact: 18, evidence: 'Checklist akti', checklist: true },
      { stage: 'Barqarorlashuv', name: 'Tasdiqlangan ta’lim sifati ko‘rsatkichi', weight: 10, plan: 100, fact: 80, evidence: 'Akademik hisobot', checklist: false },
      { stage: 'Barqarorlashuv', name: 'Retention / mijozlar tajribasi', weight: 10, plan: 200, fact: 180, evidence: 'Servis hisobot', checklist: false },
      { stage: 'Barqarorlashuv', name: 'Tasdiqlangan tushum va xarajat rejasi', weight: 15, plan: 100, fact: 90, evidence: 'Moliya hisobot', checklist: false },
      { stage: 'Barqarorlashuv', name: 'Jamoa barqarorligi va asosiy rollar to‘liqligi', weight: 10, plan: 100, fact: 90, evidence: 'HR hisobot', checklist: false },
    ],
    compliance: false,
    complianceEvidence: '',
  };

  // Tasdiqlangan profil: har xodim joriy darajasiga tayinlangan attestatsiya natijalari (shu daraja maqsadlari bajarilgan),
  // so'ng seed'dagi e'lon qilingan kartalar natijalari (ular keyinroq, shuning uchun ustun turadi).
  const models = [frModel, geModel, abModel];
  for (const e of employees) {
    const m = models.find((x) => x.modelId === e.position);
    const p = m?.profiles.find((x) => x.code === e.currentLevel);
    if (!p) continue;
    const appointed = e.history.find((h) => h.level === e.currentLevel);
    for (const [code, t] of Object.entries(p.targets)) {
      if (e.records[code]?.some((r) => r.context === 'work')) continue;
      e.records[code] = [{ level: t, context: 'work', source: `${e.currentLevel} attestatsiyasi (${appointed?.doc || 'buyruq'})`, date: appointed?.from || e.levelSince }, ...(e.records[code] || [])];
    }
  }
  let idpSeq = 0;
  for (const c of cards.filter((x) => x.published)) {
    const m = models.find((x) => x.id === c.modelVersionId);
    const e = employees.find((x) => x.id === c.employeeId);
    const raw = Object.fromEntries(Object.entries(c.scores).map(([k, v]) => [k, v.final]));
    const resolved = resolveScores(m, raw, c.hrScores || {});
    for (const [code, v] of Object.entries(resolved)) {
      if (typeof v !== 'number') continue;
      e.records[code] = [...(e.records[code] || []), { level: v, context: 'work', source: `Baholash kartasi ${c.id} (${m.id})`, date: c.published.at }];
    }
    // E'lon qilingan kartadagi har bir yetishmovchilik uchun rivojlanish vazifasi — tizim e'londa qanday yaratsa, shunday (HR faollashtirgan).
    const profile = m.profiles.find((p) => p.code === c.profileTo);
    for (const it of computeMatch(profile.targets, resolved).items) {
      if (!(it.state === 'scored' && it.gap > 0) && it.state !== 'de') continue;
      const existing = idp.find((x) => x.cardId === c.id && x.competency === it.code);
      if (existing) { existing.fromLevel = it.state === 'scored' ? it.score : null; continue; }
      idp.push({ id: `idp-s${++idpSeq}`, employeeId: e.id, cardId: c.id, competency: it.code, fromLevel: it.state === 'scored' ? it.score : null, targetLevel: it.target,
        ...idpProposal({ today: c.published.at }, m, it.code, it.target, it.state === 'de'), status: 'open', source: 'auto', activatedAt: c.published.at, priority: it.state === 'de' || it.score < 3 });
    }
  }

  // LMS demo: Malika — «O‘zgarishlarga yetakchilik» kursi yakunlangan (hujjatdagi demo: LDR-05 · 2-daraja · o‘quv dalili);
  // Sherzod — «Akademik bo‘lim rahbariga tayyorgarlik» yo‘lida, 1-kursning amaliy topshirig‘i mentor tekshiruvida;
  // Rustam (moliya menejeri) — «FR-1 ga tayyorgarlik» yo‘lida: 1-kurs yakunlangan, 2-kursda topshiriq tekshiruvda.
  const done = (ids, extra = {}) => Object.fromEntries(ids.map((id) => [id, { done: true, at: '2026-10-10', ...extra }]));
  const enrollments = [
    { id: 'enr-1', employeeId: 'e-malika', courseId: 'CRS-LDR-05', pathId: null, by: 'employee', startedAt: '2026-09-10', status: 'completed', completedAt: '2026-09-30', applied: [0],
      progress: { ...done(['l1']), t1: { attempts: 1, last: 100, best: 100, at: '2026-09-25' }, a1: { status: 'accepted', text: 'Keys: yangi jadvalga o‘tish rejasi', origin: 'self', mentor: { level: 2, note: 'Reja bosqichlari va qarshilikka javob aniq.', by: 'L&D trener', at: '2026-09-30' }, history: [] } } },
    { id: 'enr-2', employeeId: 'e-sherzod', courseId: 'CRS-AB-OBS', pathId: 'LP-AB1', by: 'hr', startedAt: '2026-10-01', status: 'in_progress', applied: [0],
      progress: { ...done(['l1', 'l2']), t1: { attempts: 1, last: 100, best: 100, at: '2026-10-08' },
        a1: { status: 'pending', origin: 'manager', assignedBy: 'Akademik rahbar (Yunusobod)', submittedAt: '2026-11-05', text: '3 ustoz darsini kuzatdim (EL-04, PI-12, IN-02), har biri bilan feedback suhbati o‘tkazdim va 1–2 qadam kelishdik. 2 haftadan keyin: 2 ustozda CCQ qo‘llanishi kuzatildi, 1 tasida jarayonda.', link: 'drive://ab/kuzatuv-varaqlari.pdf', history: [{ at: '2026-11-05', text: '…' }] } } },
    { id: 'enr-3', employeeId: 'e-sherzod', courseId: 'CRS-AB-QUAL', pathId: 'LP-AB1', by: 'hr', startedAt: '2026-10-01', status: 'in_progress', applied: [], progress: {} },
    { id: 'enr-4', employeeId: 'e-sherzod', courseId: 'CRS-LDR-04', pathId: 'LP-AB1', by: 'hr', startedAt: '2026-10-01', status: 'in_progress', applied: [], progress: {} },
    { id: 'enr-5', employeeId: 'e-sherzod', courseId: 'CRS-DEC-01', pathId: 'LP-AB1', by: 'hr', startedAt: '2026-10-01', status: 'in_progress', applied: [], progress: {} },
    { id: 'enr-6', employeeId: 'e-rustam', courseId: 'CRS-FIN-01', pathId: 'LP-FR1', by: 'employee', startedAt: '2026-09-01', status: 'completed', completedAt: '2026-10-15', applied: [0, 1],
      progress: { ...done(['l1', 'l2']), t1: { attempts: 1, last: 100, best: 100, at: '2026-09-12' }, a1: { status: 'accepted', origin: 'manager', assignedBy: 'Chilonzor filiali rahbari', submittedAt: '2026-10-10', text: 'Chilonzor filiali uchun 4-chorak byudjeti: 3 ssenariy, guruh to‘liqligi 72% → 80% rejasi.', mentor: { level: 3, note: 'Farazlar asoslangan, 3 ssenariy va choralar aniq. Filial rahbari tasdiqladi.', by: 'Moliya direktori (mentor)', at: '2026-10-15' }, history: [] } } },
    { id: 'enr-7', employeeId: 'e-rustam', courseId: 'CRS-SALES-01', pathId: 'LP-FR1', by: 'employee', startedAt: '2026-10-16', status: 'in_progress', applied: [0],
      progress: { ...done(['l1', 'l2']), t1: { attempts: 2, last: 100, best: 100, at: '2026-10-25' },
        a1: { status: 'pending', origin: 'self', submittedAt: '2026-11-08', text: 'O‘z tashabbusim bilan Chilonzorda 6 hafta: sinov darsidan keyin 24 soatda qo‘ng‘iroq va CRM nazorati. Konversiya 34% → 43%.', link: 'drive://fr1/crm-konversiya.xlsx', history: [{ at: '2026-11-08', text: '…' }] } } },
    ...['CRS-LDR-04', 'CRS-CX-01', 'CRS-DEC-01'].map((cid, i) => ({ id: `enr-${8 + i}`, employeeId: 'e-rustam', courseId: cid, pathId: 'LP-FR1', by: 'employee', startedAt: '2026-09-01', status: 'in_progress', applied: [], progress: {} })),
    // Sentabr natijalari bo'yicha avtomatik majburiy kurslar: Aziza yakunladi (oktabrda retention tiklandi), Farrux muddatini o'tkazdi.
    { id: 'enr-11', employeeId: 'e-aziza', courseId: 'CRS-GE-RET', pathId: null, by: 'kpi', startedAt: '2026-10-03', status: 'completed', completedAt: '2026-10-28', applied: [0, 1],
      mandatory: { ruleId: 'kr-ret', month: '2026-09', value: 86.6, min: 90, deadline: '2026-11-02' },
      progress: { ...done(['l1', 'l2']), t1: { attempts: 1, last: 100, best: 100, at: '2026-10-12' }, a1: { status: 'accepted', origin: 'self', submittedAt: '2026-10-25', text: 'Xavf guruhida 7 o‘quvchi: har biri bilan suhbat, individual maqsad, 4 hafta davomat kuzatuvi. 6 tasi qoldi.', mentor: { level: 3, note: 'Mezonlar aniq, har o‘quvchi bilan ishlangan, natija o‘lchangan.', by: 'Metodist', at: '2026-10-28' }, history: [] } } },
    { id: 'enr-12', employeeId: 'e-farrux', courseId: 'CRS-GE-RET', pathId: null, by: 'kpi', startedAt: '2026-10-03', status: 'in_progress', applied: [],
      mandatory: { ruleId: 'kr-ret', month: '2026-09', value: 88.2, min: 90, deadline: '2026-11-02' }, progress: { ...done(['l1']) } },
  ];
  const pathEnrollments = [
    { id: 'lpe-1', employeeId: 'e-sherzod', pathId: 'LP-AB1', by: 'hr', startedAt: '2026-10-01', status: 'active' },
    { id: 'lpe-2', employeeId: 'e-rustam', pathId: 'LP-FR1', by: 'employee', startedAt: '2026-09-01', status: 'active' },
  ];

  // Ustozlar natijalari (Exode LMS oylik hisoboti). Qator: yangi kelgan, ulardan qolgan, oy boshida, bitirgan, ketgan.
  const KR = (employeeId, month, [newStudents, stayedNew, start, graduated, left]) => ({ employeeId, month, newStudents, stayedNew, start, graduated, left, source: 'Exode LMS · oylik hisobot' });
  const T = {
    'e-malika': [[14, 12, 62, 0, 3], [18, 14, 70, 4, 4], [16, 10, 74, 0, 5]],
    'e-aziza': [[10, 8, 80, 6, 5], [12, 10, 82, 0, 11], [11, 9, 78, 5, 5]],
    'e-gulbahor': [[8, 7, 48, 0, 2], [9, 8, 52, 3, 2], [10, 9, 55, 0, 2]],
    'e-sherzod': [[6, 5, 40, 0, 1], [7, 6, 44, 2, 2], [5, 5, 46, 0, 1]],
    'e-dildora': [[12, 9, 30, 0, 2], [15, 12, 38, 0, 3], [14, 11, 46, 0, 7]],
    'e-otabek': [[16, 14, 90, 8, 4], [18, 15, 95, 0, 6], [20, 17, 101, 6, 5]],
    'e-kamola': [[3, 2, 25, 0, 1], [4, 2, 26, 0, 2], [3, 1, 27, 0, 1]],
    'e-farrux': [[9, 8, 70, 0, 5], [11, 9, 72, 4, 8], [12, 10, 70, 0, 9]],
  };
  const kpiResults = Object.entries(T).flatMap(([id, rows]) => [KR(id, '2026-08', rows[0]), KR(id, '2026-09', rows[1])]);
  const kpiInbox = { '2026-10': { source: 'Exode LMS · oylik hisobot', readyAt: '2026-11-03', rows: Object.entries(T).map(([id, rows]) => { const { month, source, ...r } = KR(id, '2026-10', rows[2]); return r; }).concat([{ employeeId: 'e-nilufar', newStudents: 10, stayedNew: 6, start: 20, graduated: 0, left: 4 }]) } };
  const kpiRules = [
    { id: 'kr-conv', position: 'GE', metric: 'conversion', min: 75, months: 1, minBase: 5, courseId: 'CRS-GE-CONV' },
    { id: 'kr-ret', position: 'GE', metric: 'retention', min: 90, months: 1, minBase: 10, courseId: 'CRS-GE-RET' },
  ];
  const kpiActions = [
    { id: 'ka-2', employeeId: 'e-farrux', ruleId: 'kr-ret', month: '2026-09', kind: 'course', value: 88.2, min: 90, enrollmentId: 'enr-12', at: '2026-10-03', by: 'Exode LMS (avtomatik)' },
    { id: 'ka-1', employeeId: 'e-aziza', ruleId: 'kr-ret', month: '2026-09', kind: 'course', value: 86.6, min: 90, enrollmentId: 'enr-11', at: '2026-10-03', by: 'Exode LMS (avtomatik)' },
  ];

  // Ko'nikmalar katalogi (kompetensiyadan alohida). supports — qaysi kompetensiyani to'ldiradi.
  const skillCatalog = [
    { id: 'SK-AI-01', group: 'ai', name: 'AI yordamchilar (ChatGPT, Claude, Gemini)', description: 'Xat, hisobot, tahlil va g‘oya uchun AI yordamchidan foydalanish, natijani tekshirish.', supports: ['FUN-07', 'GEN-08'] },
    { id: 'SK-AI-02', group: 'ai', name: 'Prompt yozish va natijani tekshirish', description: 'Vazifa, kontekst, format berish; faktlarni tekshirish; maxfiylik qoidalari.', supports: ['FUN-07'] },
    { id: 'SK-AI-03', group: 'ai', name: 'AI bilan dars materiali tayyorlash', description: 'Darajaga mos matn, mashq, test va speaking kartalarini AI bilan tayyorlash va moslashtirish.', supports: ['GEN-08', 'GEN-13'] },
    { id: 'SK-COL-01', group: 'collab', name: 'Miro', description: 'Onlayn doska: jamoaviy rejalash, jarayon xaritasi, retrospektiva.', supports: ['KOR-03'] },
    { id: 'SK-COL-02', group: 'collab', name: 'Google Workspace (Docs, Sheets, Drive)', description: 'Hujjatlar bilan birgalikda ishlash, ulashish va versiya nazorati.', supports: ['FUN-07'] },
    { id: 'SK-COL-03', group: 'collab', name: 'ClickUp / Trello — vazifa boshqaruvi', description: 'Vazifa, muddat va mas’ulni yuritish, jamoa doskasi.', supports: ['FUN-06'] },
    { id: 'SK-DAT-01', group: 'data', name: 'Excel / Google Sheets: formula va pivot', description: 'Formulalar, filtr, pivot jadval, oddiy grafik.', supports: ['FUN-07', 'FUN-04', 'LDR-02'] },
    { id: 'SK-DAT-02', group: 'data', name: 'Looker Studio / Power BI dashboard', description: 'Ko‘rsatkichlar dashboardini yig‘ish va o‘qish.', supports: ['FUN-07', 'LDR-02'] },
    { id: 'SK-EDU-01', group: 'edu', name: 'Exode LMS', description: 'Guruh, davomat, uy vazifasi va natijalarni LMS’da yuritish.', supports: ['FUN-07', 'GEN-08'] },
    { id: 'SK-EDU-02', group: 'edu', name: 'Canva — vizual material', description: 'Dars slaydlari, flashcard va e’lonlarni tayyorlash.', supports: ['GEN-08'] },
    { id: 'SK-EDU-03', group: 'edu', name: 'Interaktiv vositalar (Kahoot, Quizlet, Wordwall)', description: 'Darsda o‘yin va tezkor tekshiruv vositalari.', supports: ['GEN-08', 'GEN-04'] },
    { id: 'SK-BIZ-01', group: 'biz', name: 'amoCRM', description: 'Lid, sinov darsi va to‘lov voronkasini CRM’da yuritish va hisobot olish.', supports: ['FUN-01', 'FUN-07'] },
  ];
  // Lavozim bo'yicha tavsiya etilgan ko'nikmalar — majburiy emas, lavozimga moslik hisobiga kirmaydi.
  const SP = (list) => list.map(([skillId, level]) => ({ skillId, level }));
  const skillProfiles = {
    'FR-1': SP([['SK-BIZ-01', 2], ['SK-DAT-01', 2], ['SK-COL-02', 2], ['SK-AI-01', 1]]),
    'FR-2': SP([['SK-BIZ-01', 2], ['SK-DAT-01', 2], ['SK-DAT-02', 1], ['SK-AI-01', 2], ['SK-COL-03', 1]]),
    'FR-3': SP([['SK-DAT-02', 2], ['SK-DAT-01', 3], ['SK-AI-01', 2], ['SK-COL-01', 2]]),
    'LT-0': SP([['SK-EDU-01', 1]]),
    'LT-1': SP([['SK-EDU-01', 2], ['SK-EDU-03', 1], ['SK-AI-01', 1]]),
    'LT-2': SP([['SK-EDU-01', 2], ['SK-EDU-02', 2], ['SK-EDU-03', 2], ['SK-AI-03', 1]]),
    'LT-3': SP([['SK-AI-03', 2], ['SK-EDU-02', 2], ['SK-COL-01', 1]]),
    'LT-4': SP([['SK-AI-03', 3], ['SK-COL-01', 2], ['SK-DAT-01', 1]]),
    'AB-1': SP([['SK-COL-01', 2], ['SK-DAT-01', 2], ['SK-AI-01', 2], ['SK-COL-03', 1]]),
    'AB-2': SP([['SK-DAT-02', 2], ['SK-AI-01', 3], ['SK-COL-01', 3]]),
  };
  let skSeq = 0;
  const ES = (employeeId, skillId, level, status, source, at, extra = {}) => ({ id: `sk-s${++skSeq}`, employeeId, skillId, level, status, source, at, ...extra });
  const empSkills = [
    ES('e-dilshod', 'SK-BIZ-01', 3, 'confirmed', 'Tasdiqladi: Hududiy menejer', '2026-03-10'),
    ES('e-dilshod', 'SK-DAT-01', 2, 'confirmed', 'Tasdiqladi: Hududiy menejer', '2026-03-10'),
    ES('e-dilshod', 'SK-AI-01', 1, 'self', 'O‘zi belgilagan', '2026-10-20', { claim: { level: 2, evidence: 'Har hafta filial hisobotini AI yordamida tayyorlayman: CRM eksportidan xulosa va rahbarga xat. Vaqt 2 soatdan 30 daqiqaga tushdi; raqamlarni Sheets bilan tekshiraman.', link: 'drive://dilshod/ai-hisobot-namuna.pdf', at: '2026-11-07' } }),
    ES('e-nodira', 'SK-BIZ-01', 3, 'confirmed', 'Tasdiqladi: Hududiy menejer', '2025-11-02'),
    ES('e-nodira', 'SK-DAT-01', 3, 'confirmed', 'Tasdiqladi: Moliya bo‘limi', '2025-11-02'),
    ES('e-nodira', 'SK-DAT-02', 2, 'confirmed', 'Tasdiqladi: Moliya bo‘limi', '2026-04-15'),
    ES('e-nodira', 'SK-COL-01', 2, 'self', 'O‘zi belgilagan', '2026-06-01'),
    ES('e-nodira', 'SK-AI-01', 2, 'self', 'O‘zi belgilagan', '2026-09-01'),
    ES('e-jasur', 'SK-BIZ-01', 2, 'confirmed', 'Tasdiqladi: Hududiy menejer', '2025-09-01'),
    ES('e-jasur', 'SK-COL-02', 2, 'self', 'O‘zi belgilagan', '2026-02-01'),
    ES('e-bekzod', 'SK-BIZ-01', 2, 'confirmed', 'Tasdiqladi: Hududiy menejer', '2025-05-01'),
    ES('e-rustam', 'SK-DAT-01', 3, 'confirmed', 'Tasdiqladi: Moliya direktori', '2024-12-01'),
    ES('e-rustam', 'SK-DAT-02', 3, 'confirmed', 'Tasdiqladi: Moliya direktori', '2025-06-01'),
    ES('e-rustam', 'SK-AI-01', 2, 'self', 'O‘zi belgilagan', '2026-08-01'),
    ES('e-malika', 'SK-EDU-01', 2, 'confirmed', 'Tasdiqladi: Metodist', '2026-01-15'),
    ES('e-malika', 'SK-EDU-03', 2, 'self', 'O‘zi belgilagan', '2026-03-01'),
    ES('e-malika', 'SK-EDU-02', 1, 'self', 'O‘zi belgilagan', '2026-03-01'),
    ES('e-aziza', 'SK-EDU-01', 2, 'confirmed', 'Tasdiqladi: Metodist', '2025-11-01'),
    ES('e-aziza', 'SK-AI-03', 1, 'self', 'O‘zi belgilagan', '2026-09-15'),
    ES('e-gulbahor', 'SK-EDU-01', 3, 'confirmed', 'Tasdiqladi: Metodist', '2024-02-01'),
    ES('e-gulbahor', 'SK-EDU-02', 3, 'confirmed', 'Tasdiqladi: Metodist', '2025-03-01'),
    ES('e-gulbahor', 'SK-AI-03', 2, 'confirmed', 'Tasdiqladi: Akademik bo‘lim', '2026-05-20'),
    ES('e-gulbahor', 'SK-COL-01', 1, 'self', 'O‘zi belgilagan', '2026-07-01'),
    ES('e-sherzod', 'SK-AI-03', 3, 'confirmed', 'Tasdiqladi: Akademik bo‘lim', '2026-02-10'),
    ES('e-sherzod', 'SK-COL-01', 2, 'confirmed', 'Tasdiqladi: Akademik bo‘lim', '2026-02-10'),
    ES('e-sherzod', 'SK-AI-01', 3, 'confirmed', 'Tasdiqladi: Akademik bo‘lim', '2026-02-10'),
    ES('e-sherzod', 'SK-DAT-01', 2, 'self', 'O‘zi belgilagan', '2026-04-01'),
    ES('e-otabek', 'SK-EDU-01', 2, 'confirmed', 'Tasdiqladi: Metodist', '2025-06-01'),
    ES('e-otabek', 'SK-EDU-03', 3, 'confirmed', 'Tasdiqladi: Metodist', '2025-06-01'),
    ES('e-otabek', 'SK-EDU-02', 2, 'self', 'O‘zi belgilagan', '2026-01-10'),
    ES('e-dildora', 'SK-EDU-01', 1, 'self', 'O‘zi belgilagan', '2026-06-10'),
    ES('e-kamola', 'SK-EDU-01', 2, 'confirmed', 'Tasdiqladi: Metodist', '2026-03-01'),
    ES('e-farrux', 'SK-EDU-01', 2, 'confirmed', 'Tasdiqladi: Metodist', '2025-10-01'),
    ES('e-farrux', 'SK-AI-03', 2, 'self', 'O‘zi belgilagan', '2026-08-20'),
  ];

  // ---------------- Onboarding (TZ): rollar, moslashuv dasturlari, integratsiya navbati, uchrashuvlar ----------------
  const staff = [
    { id: 'u-super', role: 'super', name: 'HR / L&D boshqaruvchisi', title: 'Super Admin' },
    { id: 'u-hr', role: 'hr', name: 'Madina Xasanova', title: 'HR Admin' },
    { id: 'u-br-chil', role: 'branch', name: 'Anvar Qosimov', title: 'Chilonzor filiali rahbari', branchIds: ['b-chil'] },
    { id: 'u-men-gul', role: 'mentor', name: 'Gulbahor Rasulova', title: 'Mentor — Chilonzor ustozlari', employeeId: 'e-gulbahor' },
    { id: 'u-men-sher', role: 'mentor', name: 'Sherzod Ismoilov', title: 'Mentor — Yunusobod ustozlari', employeeId: 'e-sherzod' },
    { id: 'u-met', role: 'methodist', name: 'Shahnoza Mirzayeva', title: 'Metodist — General English', positions: ['GE'] },
    { id: 'u-cur', role: 'curator', name: 'Laylo Karimova', title: 'Kurator — korporativ va moliya kurslari', courseIds: ['CRS-ON-CORP', 'CRS-ON-FIN'] },
  ];
  const onboardingPrograms = [
    { position: 'GE', courses: ['CRS-ON-CORP', 'CRS-ON-GE'], observations: 2 },
    { position: 'FIN', courses: ['CRS-ON-CORP', 'CRS-ON-FIN'], observations: 0 },
    { position: 'FR', courses: ['CRS-ON-CORP'], observations: 0 },
  ];
  const onboardingConfig = {
    weights: { courses: 25, tests: 25, tasks: 25, obs: 25 }, badgeMin: 3, lateDays: 7,
    obsCodes: ['GEN-01', 'GEN-03', 'GEN-04', 'GEN-05', 'BEH-01', 'BEH-02'],
    mentors: { 'GE:b-chil': 'e-gulbahor', 'GE:b-yunus': 'e-sherzod', 'FIN:b-chil': 'e-rustam' },
    surveyBranchAvg: { 'b-chil': 4.1, 'b-yunus': 4.3, 'b-serg': 3.6, 'b-yangi': 3.9, 'b-mirz': 4.0, 'b-samq': 3.8, 'b-olm': 4.2 },
  };
  const onboardings = [
    { id: 'onb-0', employeeId: 'e-lola', startedAt: '2026-06-02', enteredAt: '2026-06-02', source: 'recruiting', status: 'completed', reboarding: false, survey: { d8: 4.5, d30: 4.4 }, restored: [],
      final: { score: 4.2, label: 'Yaxshi', badge: true, ready: true, parts: [], by: 'Yunusobod filiali rahbari', byRole: 'Filial rahbari', at: '2026-07-03' } },
    { id: 'onb-1', employeeId: 'e-nilufar', startedAt: '2026-10-14', enteredAt: '2026-10-14', source: 'recruiting', status: 'active', reboarding: false, survey: { d8: 4.6, d30: null }, final: null, restored: [] },
    { id: 'onb-2', employeeId: 'e-jahongir', startedAt: '2026-10-05', enteredAt: '2026-10-06', source: 'recruiting', status: 'active', reboarding: false, survey: { d8: 4.2, d30: 4.5 }, final: null, restored: [] },
    { id: 'onb-3', employeeId: 'e-sanjar', startedAt: '2026-10-31', enteredAt: '2026-10-31', source: 'branch', status: 'active', reboarding: false, survey: { d8: 3.8, d30: null }, final: null, restored: [] },
    { id: 'onb-4', employeeId: 'e-ziyoda', startedAt: '2026-10-22', enteredAt: '2026-10-24', source: 'recruiting', status: 'active', reboarding: false, survey: { d8: 3.1, d30: null }, final: null, restored: [] },
  ];
  const OE = (id, employeeId, onboardingId, courseId, startedAt, deadline, extra) => ({ id, employeeId, courseId, pathId: null, by: 'onboarding', onboardingId, startedAt, deadline, courseVersion: 1, status: 'in_progress', applied: [], progress: {}, ...extra });
  const T100 = (at) => ({ attempts: 1, last: 100, best: 100, at });
  enrollments.push(
    OE('enr-o9', 'e-lola', 'onb-0', 'CRS-ON-CORP', '2026-06-02', '2026-07-02', { status: 'completed', completedAt: '2026-06-05', progress: { ...done(['l1', 'l2']), t1: T100('2026-06-05') } }),
    OE('enr-o10', 'e-lola', 'onb-0', 'CRS-ON-GE', '2026-06-02', '2026-07-02', { status: 'completed', completedAt: '2026-06-25',
      progress: { ...done(['l1', 'l2']), t1: { attempts: 1, last: 75, best: 75, at: '2026-06-12' }, a1: { status: 'accepted', origin: 'self', submittedAt: '2026-06-22', text: 'Elementary guruh uchun lesson plan', mentor: { level: null, grade: 4, note: 'Maqsad aniq, bosqichlar to‘g‘ri.', by: 'Sherzod Ismoilov', at: '2026-06-25' }, history: [] } } }),
    OE('enr-o1', 'e-nilufar', 'onb-1', 'CRS-ON-CORP', '2026-10-14', '2026-11-13', { status: 'completed', completedAt: '2026-10-16', progress: { ...done(['l1', 'l2']), t1: T100('2026-10-16') } }),
    OE('enr-o2', 'e-nilufar', 'onb-1', 'CRS-ON-GE', '2026-10-14', '2026-11-13', { courseVersion: 2,
      progress: { ...done(['l1', 'l2']), t1: { attempts: 2, last: 75, best: 75, at: '2026-10-24' },
        a1: { status: 'pending', origin: 'self', submittedAt: '2026-11-07', text: 'Beginner (BG-12, 9 o‘quvchi) «Daily routines» darsining lesson plani: maqsad — 10 ta fe’l bilan kun tartibini aytib bera olish. Darsdan keyin tahlil: juftlik ishida 2 o‘quvchi gapirmadi — keyingi darsda rollarni aniq bo‘laman, ICQ’ni oldindan yozib qo‘yaman.', link: 'drive://onb/nilufar-lesson-plan.pdf', history: [{ at: '2026-11-07', text: '…' }] } } }),
    OE('enr-o3', 'e-jahongir', 'onb-2', 'CRS-ON-CORP', '2026-10-06', '2026-11-04', { status: 'completed', completedAt: '2026-10-09', progress: { ...done(['l1', 'l2']), t1: T100('2026-10-09') } }),
    OE('enr-o4', 'e-jahongir', 'onb-2', 'CRS-ON-FIN', '2026-10-06', '2026-11-04', { status: 'completed', completedAt: '2026-10-30',
      progress: { ...done(['l1']), t1: { attempts: 2, last: 100, best: 100, at: '2026-10-14' }, a1: { status: 'accepted', origin: 'manager', assignedBy: 'Chilonzor filiali rahbari', submittedAt: '2026-10-27', text: 'Chilonzor: 23 qarzdor, 3 guruhga ajratildi; 2 haftalik reja, har biriga mas’ul va sana.', mentor: { level: null, grade: 4, note: 'Ro‘yxat to‘liq, ustuvorlik bor. Kutilgan natija summada ko‘rsatilmagan.', by: 'Laylo Karimova', at: '2026-10-30' }, history: [] } } }),
    OE('enr-o5', 'e-sanjar', 'onb-3', 'CRS-ON-CORP', '2026-10-31', '2026-11-30', {}),
    OE('enr-o6', 'e-sanjar', 'onb-3', 'CRS-ON-GE', '2026-10-31', '2026-11-30', { courseVersion: 2 }),
    OE('enr-o7', 'e-ziyoda', 'onb-4', 'CRS-ON-CORP', '2026-10-24', '2026-11-21', { status: 'completed', completedAt: '2026-10-27', progress: { ...done(['l1', 'l2']), t1: { attempts: 1, last: 75, best: 75, at: '2026-10-27' } } }),
    OE('enr-o8', 'e-ziyoda', 'onb-4', 'CRS-ON-GE', '2026-10-24', '2026-11-21', { courseVersion: 2, progress: { ...done(['l1']) } }),
  );
  const R = (a, b, c, d, e, f) => ({ 'GEN-01': a, 'GEN-03': b, 'GEN-04': c, 'GEN-05': d, 'BEH-01': e, 'BEH-02': f });
  const observations = [
    { id: 'obs-l1', employeeId: 'e-lola', methodist: 'Shahnoza Mirzayeva', date: '2026-06-15', lesson: 'Beginner, Unit 2', group: 'BG-04 (10 o‘quvchi)', ratings: R(4, 4, 3, 4, 4, 4), note: 'Dars standartiga mos.' },
    { id: 'obs-l2', employeeId: 'e-lola', methodist: 'Shahnoza Mirzayeva', date: '2026-06-29', lesson: 'Beginner, Unit 4', group: 'BG-04 (10 o‘quvchi)', ratings: R(4, 4, 4, 4, 4, 5), note: 'Feedback aniq, o‘quvchilar faol.' },
    { id: 'obs-n1', employeeId: 'e-nilufar', methodist: 'Shahnoza Mirzayeva', date: '2026-10-28', lesson: 'Beginner, «Daily routines»', group: 'BG-12 (9 o‘quvchi)', ratings: R(3, 2, 3, 2, 3, 3), note: 'Maqsad aniq, ko‘rsatmalar uzun — ICQ ishlatilmadi. Juftlik ishida 2 o‘quvchi passiv. Keyingi kuzatuv: ICQ va feedback.' },
  ];
  const meetings = [
    { id: 'mt-1', kind: 'ceo', title: 'CEO va HRD bilan uchrashuv — Oktabr', date: '2026-10-29', time: '10:00', format: 'offline', link: '', place: 'Bosh ofis, 3-qavat majlislar zali', organizer: 'Madina Xasanova (HR Admin)', invited: ['e-jahongir', 'e-nilufar', 'e-ziyoda'], attended: ['e-jahongir'] },
    { id: 'mt-2', kind: 'ceo', title: 'CEO va HRD bilan uchrashuv — Noyabr', date: '2026-11-26', time: '15:00', format: 'online', link: 'https://meet.google.com/reg-ceo-nov', place: '', organizer: 'Madina Xasanova (HR Admin)', invited: [], attended: [] },
    { id: 'mt-3', kind: 'share', title: 'Bilim almashish: Kahoot va Wordwall bilan tezkor tekshiruv', date: '2026-11-18', time: '16:00', format: 'offline', link: '', place: 'Chilonzor filiali, 2-xona', organizer: 'Gulbahor Rasulova', invited: ['e-malika', 'e-dildora', 'e-otabek', 'e-sanjar'], attended: [] },
  ];
  // Integratsiya navbati: Jobster ATS → Edu → RegUP hodisalari (demo — bir tugma bilan qabul qilinadi).
  const hrInbox = [
    { id: 'ev-1', type: 'hire', at: '2026-11-10', stage: 'Induction', payload: { name: 'Shahlo Nazarova', position: 'GE', level: 'LT-0', branchId: 'b-chil', department: 'Akademik bo‘lim', phone: '+998 90 111 22 33', jobsterId: 'JB-5521', eduId: 'EDU-30412', startedAt: '2026-11-09', source: 'recruiting' } },
    { id: 'ev-2', type: 'hire', at: '2026-11-10', stage: 'Induction', payload: { name: 'Bobur Xolmatov', position: 'FIN', level: 'MOL', branchId: 'b-serg', department: 'Moliya', phone: '+998 93 444 55 66', jobsterId: 'JB-5534', eduId: 'EDU-30418', startedAt: '2026-11-01', source: 'branch' } },
    { id: 'ev-3', type: 'hire', at: '2026-11-10', stage: 'Induction', payload: { name: 'Dilnoza Rahimova', position: 'ADM', level: 'ADM', branchId: 'b-yunus', department: 'Markaz admini', phone: '+998 71 200 00 01', jobsterId: 'JB-5540', eduId: 'EDU-30420', startedAt: '2026-11-10', source: 'recruiting' } },
    { id: 'ev-4', type: 'archive', at: '2026-11-10', stage: 'D30 dan oldin chiqarildi', payload: { employeeId: 'e-ziyoda', reason: 'O‘z xohishi bilan ketdi (D8 dan keyin)', leftAt: '2026-11-07', eduWaitDays: 30 } },
    { id: 'ev-5', type: 'return', at: '2026-11-10', stage: 'Qayta ishga kirish', payload: { employeeId: 'e-lola', startedAt: '2026-11-10', branchId: 'b-yunus', source: 'recruiting' } },
  ];

  return {
    schema: 16,
    today: TODAY,
    models,
    branches,
    roles,
    employees,
    cycles,
    cards,
    stretches,
    idp,
    interests,
    succession,
    activities,
    evidenceQueue,
    kpiNewBranch,
    courses: structuredClone(COURSES),
    paths: structuredClone(PATHS),
    enrollments,
    pathEnrollments,
    kpiResults,
    kpiInbox,
    kpiRules,
    kpiActions,
    skillCatalog,
    skillProfiles,
    empSkills,
    staff,
    onboardingPrograms,
    onboardingConfig,
    onboardings,
    observations,
    meetings,
    hrInbox,
    hrLog: [],
    onbHistory: createOnbHistory(TODAY),
    notifications: [],
    audit: [{ id: 'a-0', at: '2026-10-01T09:00', actor: 'HRD', action: 'Model faollashtirildi', object: 'FR@0.3', reason: 'Pilot bazasi' }],
    seq: 1000,
  };
}
