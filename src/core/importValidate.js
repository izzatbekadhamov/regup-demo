// Excel import tekshiruvi (MOD 03). Xatolik bo'lsa butun import bekor qilinadi;
// muvaffaqiyatli import yangi qoralama versiya uchun ma'lumot qaytaradi.

export const IMPORT_SHEETS = {
  Competencies: ['competency_code', 'name', 'layer', 'definition'],
  Levels: ['level_no', 'name'],
  Indicators: ['indicator_code', 'competency_code', 'level_no', 'text'],
  Profiles: ['profile_code', 'competency_code', 'target_level'],
  EvidenceRules: ['competency_code', 'method', 'max_level'],
};

const blank = (v) => v === undefined || v === null || String(v).trim() === '';

export function validateImport(workbook) {
  const errors = [];
  const err = (sheet, row, msg) => errors.push({ sheet, row, msg });

  for (const [sheet, cols] of Object.entries(IMPORT_SHEETS)) {
    const rows = workbook[sheet];
    if (!Array.isArray(rows)) {
      err(sheet, null, 'Varaq topilmadi');
      continue;
    }
    rows.forEach((r, i) => {
      for (const c of cols) if (blank(r[c])) err(sheet, i + 2, `«${c}» majburiy maydon bo‘sh`);
    });
  }
  if (errors.some((e) => e.row === null)) return { ok: false, errors };

  const levels = new Set();
  workbook.Levels.forEach((r, i) => {
    const n = Number(r.level_no);
    if (!Number.isInteger(n) || n < 1 || n > 5) err('Levels', i + 2, `Noto‘g‘ri daraja: ${r.level_no}`);
    else if (levels.has(n)) err('Levels', i + 2, `Dublikat daraja: ${n}`);
    else levels.add(n);
  });

  const comps = new Set();
  workbook.Competencies.forEach((r, i) => {
    if (comps.has(r.competency_code)) err('Competencies', i + 2, `Dublikat kompetensiya: ${r.competency_code}`);
    comps.add(r.competency_code);
  });

  const indicators = new Set();
  workbook.Indicators.forEach((r, i) => {
    if (indicators.has(r.indicator_code)) err('Indicators', i + 2, `Dublikat indikator: ${r.indicator_code}`);
    indicators.add(r.indicator_code);
    if (!blank(r.competency_code) && !comps.has(r.competency_code)) err('Indicators', i + 2, `Uzilgan bog‘lanish: ${r.competency_code} Competencies varag‘ida yo‘q`);
    if (!blank(r.level_no) && !levels.has(Number(r.level_no))) err('Indicators', i + 2, `Noto‘g‘ri daraja: ${r.level_no}`);
  });

  const profilePairs = new Set();
  workbook.Profiles.forEach((r, i) => {
    const key = `${r.profile_code}|${r.competency_code}`;
    if (profilePairs.has(key)) err('Profiles', i + 2, `Dublikat profil bandi: ${r.profile_code} / ${r.competency_code}`);
    profilePairs.add(key);
    if (!blank(r.competency_code) && !comps.has(r.competency_code)) err('Profiles', i + 2, `Uzilgan bog‘lanish: ${r.competency_code} Competencies varag‘ida yo‘q`);
    if (!blank(r.target_level) && !levels.has(Number(r.target_level))) err('Profiles', i + 2, `Noto‘g‘ri maqsadli daraja: ${r.target_level}`);
  });

  workbook.EvidenceRules.forEach((r, i) => {
    if (!blank(r.competency_code) && !comps.has(r.competency_code)) err('EvidenceRules', i + 2, `Uzilgan bog‘lanish: ${r.competency_code} Competencies varag‘ida yo‘q`);
    if (!blank(r.max_level) && !levels.has(Number(r.max_level))) err('EvidenceRules', i + 2, `Noto‘g‘ri daraja: ${r.max_level}`);
  });

  if (errors.length) return { ok: false, errors };

  // Muvaffaqiyatli: qoralama versiya uchun tuzilma
  const competencies = workbook.Competencies.map((c) => ({
    code: c.competency_code,
    name: c.name,
    layer: c.layer,
    definition: c.definition,
    levels: Object.fromEntries(
      workbook.Indicators.filter((x) => x.competency_code === c.competency_code).map((x) => [Number(x.level_no), x.text]),
    ),
  }));
  const profiles = {};
  for (const r of workbook.Profiles) (profiles[r.profile_code] ||= {})[r.competency_code] = Number(r.target_level);
  return {
    ok: true,
    errors: [],
    data: {
      competencies,
      profiles: Object.entries(profiles).map(([code, targets]) => ({ code, name: code, targets })),
      evidenceRules: workbook.EvidenceRules.map((r) => ({ competency: r.competency_code, method: r.method, maxLevel: Number(r.max_level) })),
    },
  };
}
