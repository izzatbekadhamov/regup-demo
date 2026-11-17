// Lavozim modellari. FR V0.3 — pilot bazasi (Drive manbalaridan). Ustoz modeli — demo konfiguratsiya.
import catalog from './frCatalog.json';
import geCatalog from './geCatalog.json';

export const HR_CODES = catalog.hr.map((h) => h.code);
export const CATALOG = catalog;

const FR_TARGETS = {
  //          FR-1 FR-2 FR-3
  'KOR-01': [3, 4, 5],
  'KOR-02': [3, 4, 5],
  'KOR-03': [3, 4, 5],
  'KOR-04': [3, 3, 4],
  'LDR-01': [3, 4, 5],
  'LDR-02': [3, 4, 5],
  'LDR-03': [3, 4, 5],
  'LDR-04': [3, 4, 5],
  'LDR-05': [3, 4, 5],
  'FUN-01': [3, 4, 5],
  'FUN-02': [3, 3, 4],
  'FUN-03': [3, 4, 5],
  'FUN-04': [3, 4, 5],
  'FUN-05': [3, 4, 4],
  'FUN-06': [3, 4, 5],
  'FUN-07': [3, 3, 4],
};
const frTargets = (i) => Object.fromEntries(Object.entries(FR_TARGETS).map(([c, t]) => [c, t[i]]));

const shortName = (n) => n.split('|')[0].replace(/\s+/g, ' ').trim();

export const FR_COMPETENCIES = catalog.competencies.map((c) => ({
  ...c,
  name: shortName(c.name),
  composite: c.code === 'FUN-05',
}));

export const frModel = {
  id: 'FR@0.3',
  modelId: 'FR',
  name: 'Filial rahbari',
  version: '0.3',
  status: 'active',
  createdBy: 'HR/L&D',
  approvedBy: 'HRD',
  approvedAt: '2026-10-01',
  formulaVersion: 'capped-ratio@1',
  transition: true,
  panelRequired: true,
  note: 'FR V0.3 pilot bazasi: 16 kompetensiya, HR-01–HR-11, 52 audit bandi.',
  scale: { max: 5 },
  scoring: { mode: 'judgment' },
  approverLabel: 'HRD',
  evaluatorRole: 'Assessor',
  methods: ['interview', 'case', 'audit', 'work_sample'],
  evidencePolicy: { context: 'work' },
  competencies: FR_COMPETENCIES,
  composites: {
    'FUN-05': {
      parts: HR_CODES, method: 'mean-round', label: 'HR-01–HR-11 o‘rtachasi, butun songa yaxlitlanadi',
      partDefs: catalog.hr.map((h) => ({ code: h.code, name: h.name, definition: h.definition })),
    },
  },
  profiles: [
    { code: 'FR-1', name: 'Standart filial rahbari', scope: 'R1', targets: frTargets(0) },
    { code: 'FR-2', name: 'Katta filial rahbari', scope: 'R2', targets: frTargets(1) },
    { code: 'FR-3', name: 'Klaster / bir nechta filiallar rahbari', scope: 'R3', targets: frTargets(2) },
  ],
  rules: {
    conditions: [
      { type: 'all_numeric' },
      { type: 'sequential' },
      { type: 'min_level_all', params: { min: 3 } },
      { type: 'max_gap', params: { max: 1 } },
      { type: 'match_threshold', params: { threshold: 95 } },
      { type: 'tenure_months', params: { min: 10 } },
      { type: 'kpi_threshold', params: { min: 75 } },
      { type: 'stretch_approved' },
      { type: 'target_role' },
    ],
  },
  stages: ['draft', 'evidence', 'assessment', 'panel', 'approval', 'published'],
};

// ---------- General English ustozi (GENERAL english teacher modeli, Google Sheets) ----------
export const GE_CATALOG = geCatalog;

export const GE_COMPETENCIES = geCatalog.competencies.map((c) => ({
  code: c.code, name: c.name, layer: c.layer, definition: c.definition, levels: c.levels, negative: c.negative,
  criterion: c.criterion, evidenceHint: c.evidenceHint, questions: geCatalog.questions[c.code] || [],
  // Jadvaldagi dalil manbalaridan; «kamida 2 mustaqil manba» qoidasi uchun bitta usulli kompetensiyaga ikkinchisi qo'shiladi.
  methods: c.methods.length >= 2 ? c.methods : [...c.methods, c.methods.includes('observation') ? 'work_sample' : 'observation'],
}));
const geTargets = (i) => Object.fromEntries(geCatalog.competencies.map((c) => [c.code, c.targets[i]]));

// Har o'tishning o'z shartlari ("O'tish shartlari" va "KPI baholash yo'riqnoma" varaqlari).
const geRules = ({ minAll, threshold, conditional, tenure, kpi, obsMin, obsAvg, gates }) => [
  { type: 'all_numeric' },
  { type: 'required_method', params: { method: 'observation' } },
  { type: 'min_methods', params: { min: 2 } },
  { type: 'observation_count', params: { min: obsMin } },
  { type: 'gates', params: { items: gates } },
  ...(tenure ? [{ type: 'sequential' }] : []),
  { type: 'min_level_all', params: { min: minAll } },
  { type: 'max_gap', params: { max: 1 } },
  { type: 'match_threshold', params: conditional ? { threshold, conditionalFrom: conditional } : { threshold } },
  { type: 'observation_avg', params: { min: obsAvg } },
  ...(tenure ? [{ type: 'tenure_months', params: { min: tenure } }] : []),
  ...(kpi ? [{ type: 'kpi_threshold', params: { min: kpi, period: 'Oxirgi 6 oy' } }] : []),
  { type: 'target_role' },
];
const gate = (code, label) => ({ code, label });

export const geModel = {
  id: 'GE@1.0',
  modelId: 'GE',
  name: 'General English ustozi',
  version: '1.0',
  status: 'active',
  createdBy: 'Akademik bo‘lim',
  approvedBy: 'Akademik rahbar + HRD',
  approvedAt: '2026-10-15',
  formulaVersion: 'capped-ratio@1',
  transition: true,
  panelRequired: true,
  approverLabel: 'Akademik rahbar + HRD',
  evaluatorRole: 'Metodist',
  panelLabel: 'Attestatsiya kengashi',
  panelMembers: 'Akademik rahbar, HR, metodist',
  roleHint: 'Hozir bu daraja uchun guruh yuklamasi (bo‘sh o‘rin) yo‘q. Shartlar bajarilsa ustoz «tayyor» deb topiladi va kadrlar zaxirasiga kiradi; yuklama ochilganda tayinlanadi.',
  note: 'GENERAL english teacher modeli: 22 kompetensiya (4 korporativ, 5 pedagogik xulq-atvor, 13 funksional), LT-0…LT-4, dars kuzatuvi asosiy usul. Validatsiya holati: ekspert tekshiruvi kerak.',
  scale: { max: 5, labels: { 1: 'Boshlang‘ich', 2: 'Rivojlanayotgan', 3: 'Rol standarti', 4: 'Ilg‘or', 5: 'Ekspert ustoz' } },
  scoring: { mode: 'judgment' },
  methods: ['observation', 'interview', 'case', 'work_sample', 'feedback360', 'kpi'],
  methodDefs: {
    observation: { name: 'Dars kuzatuvi (lesson observation)', kind: 'observation' },
    interview: { name: 'BEI intervyu', kind: 'interview' },
    case: { name: 'Keys / rol o‘yini / in-basket', kind: 'case' },
    work_sample: { name: 'Lesson plan, materiallar, portfolio', kind: 'work_sample' },
    feedback360: { name: 'O‘quvchi, ota-ona va hamkasb fikri (NPS, 180/360)', kind: 'feedback360' },
    kpi: { name: 'Akademik natija (mock, Mid/End, retention)', kind: 'kpi' },
  },
  evidencePolicy: { context: 'work' },
  competencies: GE_COMPETENCIES,
  composites: {},
  profiles: [
    { code: 'LT-0', name: 'Support — Tajribasiz', targets: geTargets(0),
      conditions: geRules({ minAll: 1, threshold: 100, obsMin: 1, obsAvg: 2, gates: [gate('lang', 'Til minimumi: IELTS ≥ 7.0'), gate('course', 'Registon onboarding; Teachers’ English Core')] }) },
    { code: 'LT-1', name: 'Junior — Ustozlikka yangi o‘tgan ustoz', targets: geTargets(1),
      conditions: geRules({ minAll: 2, threshold: 100, tenure: 3, kpi: 60, obsMin: 2, obsAvg: 2.5, gates: [gate('lang', 'Til minimumi: IELTS ≥ 7.5'), gate('course', 'Teachers’ English Core kursi'), gate('mentor', 'Mentor tavsiyasi va sinov muddati yakuni')] }) },
    { code: 'LT-2', name: 'Teacher — Standart ustoz', targets: geTargets(2),
      conditions: geRules({ minAll: 3, threshold: 100, tenure: 6, kpi: 70, obsMin: 2, obsAvg: 3, gates: [gate('lang', 'Til minimumi: IELTS ≥ 7.5; Writing ≥ 7.0; Speaking ≥ 7.0'), gate('course', 'Teacher Training Course')] }) },
    { code: 'LT-3', name: 'Middle — Head teacher', targets: geTargets(3),
      conditions: geRules({ minAll: 3, threshold: 95, conditional: 90, tenure: 10, kpi: 75, obsMin: 3, obsAvg: 4, gates: [gate('lang', 'Til minimumi: IELTS ≥ 8.0; Writing ≥ 7.5; Speaking ≥ 7.5'), gate('course', 'Academic Department PDC'), gate('stretch', 'Head teacher stretch-topshirig‘i yoki assessment dalili')] }) },
    { code: 'LT-4', name: 'Senior — Bir nechta filiallar ustozi', targets: geTargets(4),
      conditions: geRules({ minAll: 3, threshold: 95, conditional: 90, tenure: 24, kpi: 80, obsMin: 3, obsAvg: 4.5, gates: [gate('lang', 'Til minimumi: IELTS ≥ 8.5'), gate('course', 'CELTA + ichki kalibratsiya / mentorlik tayyorgarligi'), gate('project', 'Filiallararo loyiha va sifat auditi dalili')] }) },
  ],
  rules: { conditions: geRules({ minAll: 3, threshold: 100, tenure: 6, kpi: 70, obsMin: 2, obsAvg: 3, gates: [] }) },
  statusLabels: { recommend_appoint: 'Darajaga tayinlashga tavsiya', recommend_reserve: 'Tayyor — kadrlar zaxirasiga' },
  stages: ['draft', 'evidence', 'assessment', 'panel', 'approval', 'published'],
};

// ---------- Akademik bo'lim rahbari — alohida lavozim (demo konfiguratsiya, tasdiq kutadi) ----------
// Ustozlikdan rotatsiya orqali o'tiladi. Kompetensiya kartasi: korporativ + ustozlikdan olingan ko'nikmalar + boshqaruv + akademik bo'lim rahbariga xos.
const lv5 = (a, b, c, d, e) => ({ 1: a, 2: b, 3: c, 4: d, 5: e });
const fromModel = (list, code, methods) => ({ ...list.find((c) => c.code === code), methods });
export const AB_OWN_COMPETENCIES = [
  {
    code: 'AB-01', name: 'Dars kuzatuvi va ustozlarga metodik feedback', layer: 'Akademik boshqaruv',
    definition: 'Ustozlar darsini mezon asosida kuzatadi, dalilga tayangan feedback beradi va keyingi qadamni kelishadi.',
    levels: lv5(
      'Tayyor kuzatuv varag‘i bilan darsni kuzatadi, kuzatganini yozib boradi.',
      'Kuzatuv mezonlari bo‘yicha kuchli va zaif tomonlarni qayd etadi, umumiy feedback beradi.',
      'Kuzatuvni mezon va dalil bilan yakunlaydi, ustoz bilan 1–2 aniq keyingi qadamni kelishadi va bajarilishini tekshiradi.',
      'Ustozlar orasida kuzatuv natijalarini kalibrlaydi, takroriy muammolar bo‘yicha qisqa metodik sessiya o‘tkazadi.',
      'Filiallar bo‘yicha kuzatuv standartini va kuzatuvchilarni tayyorlash tizimini yaratadi.',
    ),
    methods: ['observation', 'work_sample'],
  },
  {
    code: 'AB-02', name: 'Akademik sifat va o‘quvchi natijalarini boshqarish', layer: 'Akademik boshqaruv',
    definition: 'Filial guruhlari bo‘yicha o‘zlashtirish, mock va retention ko‘rsatkichlarini kuzatadi, past natijali guruhlarga choralar belgilaydi.',
    levels: lv5(
      'Guruhlar natijalarini jadvalga yig‘adi va rahbarga yetkazadi.',
      'Past natijali guruhlarni aniqlaydi va ustoz bilan sababini muhokama qiladi.',
      'Har oy natijalarni tahlil qiladi, past guruhlar uchun reteach yoki intervention rejasini tuzadi va natijasini o‘lchaydi.',
      'Filial bo‘yicha akademik sifat ko‘rsatkichlarini barqaror o‘stiradi, choralarning samarasini dalil bilan ko‘rsatadi.',
      'Bir nechta filial uchun akademik sifat va natijalar tizimini (mezon, hisobot, chora) joriy qiladi.',
    ),
    methods: ['kpi', 'work_sample'],
  },
  {
    code: 'AB-03', name: 'Dars jadvali, guruhlar va ustoz yuklamasini rejalashtirish', layer: 'Akademik boshqaruv',
    definition: 'Guruhlarni daraja bo‘yicha shakllantiradi, ustozlarni malakasiga mos biriktiradi va yuklamani muvozanatlaydi.',
    levels: lv5(
      'Tayyor jadval asosida o‘zgarishlarni kiritadi.',
      'Guruh va ustoz biriktirishni rahbar ko‘rsatmasi bilan bajaradi.',
      'Guruhlarni daraja va soni bo‘yicha mustaqil shakllantiradi, ustoz darajasini guruh talabiga moslab biriktiradi.',
      'Yuklama, almashtirish va yangi guruh ochishni oldindan rejalashtiradi; bo‘sh qolgan dars va kechikishlarni kamaytiradi.',
      'Bir nechta filial bo‘yicha jadval va yuklama rejalashtirish tartibini yaratadi.',
    ),
    methods: ['work_sample', 'interview'],
  },
];

const AB_TARGETS = {
  //          AB-1 AB-2
  'KOR-01': [3, 4], 'KOR-02': [3, 4], 'KOR-03': [4, 4], 'KOR-04': [3, 4],
  'GEN-01': [4, 4], 'GEN-06': [4, 5], 'GEN-10': [4, 5],
  'LDR-02': [3, 4], 'LDR-03': [3, 4], 'LDR-04': [3, 4],
  'AB-01': [3, 4], 'AB-02': [3, 4], 'AB-03': [3, 4],
};
const abTargets = (i) => Object.fromEntries(Object.entries(AB_TARGETS).map(([c, t]) => [c, t[i]]));
const abRules = ({ from, tenure, kpi, threshold, gates }) => [
  { type: 'all_numeric' },
  { type: 'min_methods', params: { min: 2 } },
  { type: 'entry_levels', params: { levels: from } },
  { type: 'gates', params: { items: gates } },
  { type: 'min_level_all', params: { min: 3 } },
  { type: 'max_gap', params: { max: 1 } },
  { type: 'match_threshold', params: { threshold, conditionalFrom: 90 } },
  { type: 'tenure_months', params: { min: tenure } },
  { type: 'kpi_threshold', params: { min: kpi, period: 'Oxirgi 6 oy' } },
  { type: 'target_role' },
];

export const abModel = {
  id: 'AB@0.1',
  modelId: 'AB',
  name: 'Akademik bo‘lim rahbari',
  version: '0.1-demo',
  status: 'active',
  demo: true,
  createdBy: 'HR/L&D',
  approvedBy: 'Demo (akademik bo‘lim tasdig‘i kutilmoqda)',
  approvedAt: '2026-11-11',
  formulaVersion: 'capped-ratio@1',
  transition: true,
  panelRequired: true,
  approverLabel: 'Akademik rahbar + HRD',
  evaluatorRole: 'Akademik rahbar',
  panelLabel: 'Attestatsiya kengashi',
  panelMembers: 'Akademik rahbar, HR, filial rahbari',
  note: 'Alohida lavozim: ustozlikdan rotatsiya orqali o‘tiladi (LT-2 va undan yuqori). 13 kompetensiya: 4 korporativ, 3 ustozlikdan, 3 boshqaruv (filial rahbari modelidan), 3 akademik boshqaruvga xos. Demo konfiguratsiya — akademik bo‘lim tasdig‘i kerak.',
  scale: { max: 5 },
  scoring: { mode: 'judgment' },
  methods: ['observation', 'interview', 'case', 'work_sample', 'feedback360', 'kpi'],
  methodDefs: {
    observation: { name: 'Kuzatuv (dars kuzatuvi va metodik sessiya)', kind: 'observation' },
    interview: { name: 'BEI intervyu', kind: 'interview' },
    case: { name: 'Keys / boshqaruv vaziyati', kind: 'case' },
    work_sample: { name: 'Hujjatlar: kuzatuv varaqlari, rejalar, hisobotlar', kind: 'work_sample' },
    feedback360: { name: 'Ustozlar va rahbar fikri (180/360)', kind: 'feedback360' },
    kpi: { name: 'Filial akademik natijalari', kind: 'kpi' },
  },
  evidencePolicy: { context: 'work' },
  competencies: [
    ...['KOR-01', 'KOR-02', 'KOR-03', 'KOR-04'].map((c) => fromModel(GE_COMPETENCIES, c, ['interview', 'feedback360'])),
    fromModel(GE_COMPETENCIES, 'GEN-01', ['observation', 'work_sample']),
    fromModel(GE_COMPETENCIES, 'GEN-06', ['work_sample', 'kpi']),
    fromModel(GE_COMPETENCIES, 'GEN-10', ['work_sample', 'interview']),
    ...['LDR-02', 'LDR-03', 'LDR-04'].map((c) => ({ ...fromModel(FR_COMPETENCIES, c, ['interview', 'case', 'feedback360']), layer: 'Boshqaruv' })),
    ...AB_OWN_COMPETENCIES,
  ].map((c) => (c.code.startsWith('GEN') ? { ...c, layer: 'Ustozlikdan' } : c)),
  composites: {},
  profiles: [
    { code: 'AB-1', name: 'Akademik bo‘lim rahbari (1 filial)', targets: abTargets(0),
      conditions: abRules({ from: ['LT-2', 'LT-3', 'LT-4'], tenure: 10, kpi: 75, threshold: 95, gates: [gate('rec', 'Akademik rahbar tavsiyasi'), gate('pilot', '3 oylik sinov: 3–5 ustozdan iborat jamoani muvofiqlashtirish')] }) },
    { code: 'AB-2', name: 'Katta akademik bo‘lim rahbari (bir nechta filial)', targets: abTargets(1),
      conditions: abRules({ from: ['AB-1'], tenure: 12, kpi: 80, threshold: 95, gates: [gate('audit', 'Filiallararo akademik sifat auditi dalili')] }) },
  ],
  rules: { conditions: abRules({ from: ['LT-2', 'LT-3', 'LT-4'], tenure: 10, kpi: 75, threshold: 95, gates: [] }) },
  statusLabels: { recommend_appoint: 'Akademik bo‘lim rahbari lavozimiga tavsiya', recommend_reserve: 'Tayyor — kadrlar zaxirasiga' },
  stages: ['draft', 'evidence', 'assessment', 'panel', 'approval', 'published'],
};

// Eski nomlar bilan moslik (UAT va importlar uchun)
export const TEACHER_COMPETENCIES = GE_COMPETENCIES;
export const teacherModel = geModel;

export function competencyNames(model) {
  return Object.fromEntries(model.competencies.map((c) => [c.code, c.name]));
}

export const METHOD_LABELS = {
  interview: 'Intervyu',
  case: 'Keys / amaliy topshiriq',
  audit: 'Audit',
  observation: 'Dars kuzatuvi',
  work_sample: 'Ish namunasi',
  course: 'Kurs / test',
  test: 'Test',
  feedback360: '360° fikr',
  kpi: 'KPI natijasi',
  self: 'O‘z-o‘zini baholash',
};

export const STAGE_LABELS = {
  draft: 'Qoralama',
  evidence: 'Dalil yig‘ish',
  assessment: 'Baholash',
  panel: 'Kalibratsiya / panel',
  approval: 'Tasdiqlash',
  published: 'E’lon qilingan',
};
