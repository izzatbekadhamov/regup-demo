export const SUCCESSION_STATUS = {
  interested: ['Qiziqish bildirgan', 'muted'],
  developing: ['Rivojlanmoqda', 'brand'],
  trial: ['Amaliy sinovga tavsiya', 'warn'],
  assessed: ['Tayyorligi baholangan', 'good'],
  reserve: ['Kadrlar zaxirasi', 'good'],
  appointed: ['Tayinlangan', 'good'],
};
export const SUCCESSION_ORDER = ['interested', 'developing', 'trial', 'assessed', 'reserve'];

export const STRETCH_STATUS = {
  assigned: ['Bajarilmoqda', 'brand'],
  submitted: ['Tekshiruvda', 'warn'],
  returned: ['Qaytarilgan', 'bad'],
  approved: ['Tasdiqlangan', 'good'],
};

export const MODEL_STATUS = {
  draft: ['Qoralama', 'muted'],
  review: ['Tekshiruvda', 'warn'],
  active: ['Tasdiqlangan va faol', 'good'],
  archived: ['Arxiv', 'muted'],
};

export const IDP_STATUS = {
  proposed: ['Taklif', 'muted'],
  open: ['Bajarilmoqda', 'brand'],
  review: ['Tekshiruvda', 'warn'],
  done: ['Bajarildi', 'good'],
  rejected: ['Rad etildi', 'muted'],
  returned: ['Qaytarilgan', 'bad'],
};

export const CONTEXT_LABEL = { work: 'ish dalili', learning: 'o‘quv dalili' };

export const IDP_SOURCE = { plan: ['Lavozimga tayyorlash', 'teal'], auto: ['Tizim taklifi', 'muted'], employee: ['O‘z taklifim', 'teal'], mentor: ['Mentor qo‘shgan', 'brand'], hr: ['HR qo‘shgan', 'brand'] };

export const SUCCESSION_VIA = { interest: ['Xodim qiziqish bildirgan', 'teal'], plan: ['HR tayyorlashga olgan', 'brand'], assessment: ['Baholash natijasi', 'good'], hr: ['HR qarori bilan kiritilgan', 'muted'] };
