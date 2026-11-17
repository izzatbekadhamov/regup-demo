// Lavozim modeli yordamchilari. Umumiy mohiyat bitta: kompetensiya → daraja indikatorlari → dalil → yakuniy daraja →
// moslik va shartlar. Lavozimga qarab o'zgaradigan qismlar (shkala, kompetensiyalar soni va turi, usullar,
// usul vaznlari, profillar, qoidalar) shu yerda model konfiguratsiyasidan o'qiladi.

export const SCALE_OPTIONS = [3, 4, 5, 6];
const NAMES = {
  3: { 1: 'Boshlang‘ich', 2: 'Mustaqil', 3: 'Ekspert' },
  4: { 1: 'Boshlang‘ich', 2: 'Asosiy', 3: 'Mustaqil', 4: 'Ekspert' },
  5: { 1: 'Boshlang‘ich', 2: 'Asosiy', 3: 'Mustaqil', 4: 'Ilg‘or', 5: 'Ekspert' },
  6: { 1: 'Boshlang‘ich', 2: 'Asosiy', 3: 'Mustaqil', 4: 'Ilg‘or', 5: 'Ekspert', 6: 'Strategik' },
};

export const scaleMax = (model) => model?.scale?.max || 5;
export const scaleLevels = (model) => Array.from({ length: scaleMax(model) }, (_, i) => i + 1);
export const levelName = (model, l) => model?.scale?.labels?.[l] || NAMES[scaleMax(model)]?.[l] || `${l}-daraja`;
export const isLevel = (model, v) => Number.isInteger(v) && v >= 1 && v <= scaleMax(model);

/** Usullar kutubxonasi: turi tizim xatti-harakatini belgilaydi (masalan, kuzatuv bloki). Nomi modelda o'zgartiriladi. */
export const METHOD_KINDS = {
  interview: 'Intervyu (BEI)',
  case: 'Keys / amaliy topshiriq',
  audit: 'Audit / checklist',
  observation: 'Kuzatuv (dars, ish joyi)',
  work_sample: 'Ish namunasi / portfolio',
  test: 'Test / bilim sinovi',
  course: 'Kurs / o‘quv faoliyati',
  feedback360: '360° fikr-mulohaza',
  kpi: 'Natija ko‘rsatkichi (KPI)',
  self: 'O‘z-o‘zini baholash',
};

export const methodKind = (model, code) => model?.methodDefs?.[code]?.kind || code;
const SHORT = { interview: 'Intervyu', case: 'Keys / amaliy topshiriq', audit: 'Audit', observation: 'Kuzatuv', work_sample: 'Ish namunasi', test: 'Test', course: 'Kurs / test', feedback360: '360° fikr', kpi: 'KPI natijasi', self: 'O‘z-o‘zini baholash' };
export function methodLabel(model, code) {
  return model?.methodDefs?.[code]?.name || SHORT[code] || code;
}
/** Kompetensiyaga qo'llanadigan usullar: kompetensiyada ro'yxat bo'lsa — o'sha, aks holda modeldagi barcha usullar. */
export function compMethods(model, comp) {
  const all = model.methods || [];
  return comp?.methods?.length ? comp.methods.filter((m) => all.includes(m)) : all;
}
export const observationMethods = (model) => (model.methods || []).filter((c) => methodKind(model, c) === 'observation');

export const scoringMode = (model) => model.scoring?.mode || 'judgment';
export const SCORING_LABELS = {
  judgment: 'Baholovchi xulosasi: dalillar rubrikaga solishtiriladi, yakuniy daraja asos bilan kiritiladi',
  weighted: 'Vaznli o‘rtacha: tizim usul vaznlari bo‘yicha daraja taklif qiladi, baholovchi asos bilan tasdiqlaydi',
};

/** Tarkibli kompetensiya qismlari (masalan FUN-05 = HR-01…HR-11). */
export function compositeParts(model, code) {
  const def = model.composites?.[code];
  if (!def) return [];
  return def.partDefs || def.parts.map((c) => ({ code: c, name: c }));
}

/** Barcha modellardagi kompetensiyalar (kod bo'yicha takrorsiz) — yangi modelga umumiy kompetensiyani olish uchun. */
export function competencyLibrary(models) {
  const out = new Map();
  for (const m of models) for (const c of m.competencies) if (!c.composite && !out.has(c.code)) out.set(c.code, { ...c, from: m.id, scaleMax: scaleMax(m) });
  return [...out.values()];
}

/** Kompetensiya modeli hali tuzilmagan lavozimlar (demo). */
export const OTHER_POSITIONS = { MOL: 'Moliya menejeri' };

/** Lavozim kodi bo'yicha nom (faol modellardagi profillardan). */
export function positionName(models, code) {
  for (const m of models) if (m.status === 'active') {
    const p = m.profiles.find((x) => x.code === code);
    if (p) return p.name;
  }
  return OTHER_POSITIONS[code] || code;
}

/** Xodimning joriy darajasidan keyingi profil (bir model ichida), bo'lmasa birinchi profil. */
export function nextProfile(model, currentLevel) {
  const i = model.profiles.findIndex((p) => p.code === currentLevel);
  if (i === -1) return model.profiles[0]?.code;
  return model.profiles[Math.min(i + 1, model.profiles.length - 1)].code;
}

/** Profilga xos shartlar: profilda o'z ro'yxati bo'lsa — o'sha, aks holda model shartlari. */
export const profileConditions = (model, profile) => (profile?.conditions?.length ? profile.conditions : model?.rules?.conditions || []);
export function profileThreshold(model, profileCode) {
  const p = model?.profiles?.find((x) => x.code === profileCode);
  return profileConditions(model, p).find((c) => c.type === 'match_threshold')?.params?.threshold;
}
