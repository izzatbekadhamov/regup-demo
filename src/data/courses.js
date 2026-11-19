// Namunaviy LMS kurslari va Learning Path'lar (demo). Har kursda: darslar, test(lar), amaliy topshiriq(lar)
// va «kompetensiyaga ta'sir» qoidalari. Qoida: qaysi komponentlar bajarilsa, qaysi kompetensiya qaysi darajagacha
// va qanday dalil sifatida (o'quv / ish) tasdiqlanadi (CAR 02: chegara har faoliyat uchun sozlanadi).
//
// Komponent turlari: lesson — dars (o'qish/video); test — avtomatik baholanadi (passScore %);
// task — amaliy topshiriq (case | stretch | work), mentor xulosasi bilan tasdiqlanadi.
// Qoida konteksti: learning — o'quv dalili (odatda test/keys, past chegara); work — real ish dalili (mentor tasdig'i bilan).

const q = (text, options, answer, lvl) => ({ text, options, answer, ...(lvl ? { lvl } : {}) }); // lvl — savol qaysi daraja indikatorini tekshiradi
const lesson = (id, title, minutes) => ({ id, kind: 'lesson', title, minutes });
const test = (id, title, passScore, questions) => ({ id, kind: 'test', title, passScore, questions });
const task = (id, title, taskType, description, criteria) => ({ id, kind: 'task', title, taskType, description, criteria, mentorRequired: true });
const rule = (competency, level, context, needs, note) => ({ competency, level, context, needs, note });

export const DIRECTIONS = {
  FR: 'Filial rahbari',
  GE: 'General English ustozi',
  AB: 'Akademik bo‘lim rahbari',
  KOR: 'Umumiy (korporativ)',
  ONB: 'Moslashuv (onboarding)',
};

export const COURSES = [
  // ---------------- Filial rahbari ----------------
  {
    id: 'CRS-FIN-01', exodeId: 'EX-1001', direction: 'FR', title: 'Filial moliyasi va P&L', hours: 8, status: 'active',
    summary: 'Filial daromad-xarajat hisobi, tannarx, marja va byudjetni rejalashtirish.',
    components: [
      lesson('l1', 'Filial P&L tuzilmasi: tushum, o‘zgaruvchan va doimiy xarajatlar', 35),
      lesson('l2', 'Guruh to‘liqligi, narx va marja: ssenariy tahlili', 40),
      test('t1', 'Moliya asoslari testi', 70, [
        q('Filial marjasi qanday hisoblanadi?', ['Tushum − barcha xarajatlar', 'Tushum ÷ o‘quvchilar soni', 'Ustozlar maoshi ÷ tushum'], 0),
        q('Guruh to‘liqligi 60% dan 80% ga oshsa, odatda nima o‘zgaradi?', ['Doimiy xarajat oshadi', 'Bir o‘quvchiga xarajat kamayadi', 'Narx avtomatik pasayadi'], 1),
        q('Byudjet rejasida birinchi navbatda nima belgilanadi?', ['Tushum rejasi va asosiy farazlar', 'Ofis jihozlari', 'Faqat xarajatlar'], 0),
      ]),
      task('a1', 'Filial byudjeti: keyingi chorak rejasi', 'work',
        'O‘z filialingiz (yoki rahbaringiz bergan filial) uchun keyingi chorak tushum va xarajat rejasini tuzing: 3 ssenariy (past / asosiy / yuqori), guruh to‘liqligi va narx farazlari bilan.',
        'Farazlar asoslangan; 3 ssenariy; marja va to‘liqlik bo‘yicha choralar; filial rahbari yoki moliya bo‘limi fikri.'),
    ],
    rules: [
      rule('FUN-04', 2, 'learning', ['t1'], 'Test orqali — o‘quv dalili'),
      rule('FUN-04', 3, 'work', ['t1', 'a1'], 'Real filial byudjeti + mentor xulosasi — ish dalili'),
    ],
  },
  {
    id: 'CRS-SALES-01', exodeId: 'EX-1002', direction: 'FR', title: 'Sotuv voronkasi va sinov darsidan to‘lovga konversiya', hours: 6, status: 'active',
    summary: 'Lid → sinov darsi → to‘lov voronkasi, CRM intizomi va konversiyani oshirish choralari.',
    components: [
      lesson('l1', 'Voronka bosqichlari va CRM ko‘rsatkichlari', 30),
      lesson('l2', 'Sinov darsidan keyingi 24 soat: aloqa skripti', 25),
      test('t1', 'Sotuv voronkasi testi', 70, [
        q('Konversiya qanday hisoblanadi?', ['To‘lov qilganlar ÷ sinov darsiga kelganlar', 'Lidlar ÷ to‘lovlar', 'Sinov darslari soni'], 0),
        q('Sinov darsidan keyin aloqaning eng muhim sharti?', ['24 soat ichida qo‘ng‘iroq', 'Bir hafta kutish', 'Faqat SMS'], 0),
        q('CRM’da lid holati nega muntazam yangilanadi?', ['Voronkadagi uzilishni ko‘rish uchun', 'Hisobot chiroyli bo‘lishi uchun', 'Shart emas'], 0),
      ]),
      task('a1', 'Konversiyani oshirish loyihasi (stretch)', 'stretch',
        'Filialda 6–8 hafta davomida sinov darsidan to‘lovga konversiyani oshirish loyihasini yuriting: boshlang‘ich ko‘rsatkich, sabab tahlili, choralar, yakuniy natija.',
        'Boshlang‘ich va yakuniy konversiya CRM’dan; shaxsiy qaror va hissa; takrorlash mumkin bo‘lgan amaliyot.'),
    ],
    rules: [
      rule('FUN-01', 2, 'learning', ['t1'], 'Test — o‘quv dalili'),
      rule('FUN-01', 3, 'work', ['t1', 'a1'], 'Real loyiha + mentor xulosasi'),
      rule('LDR-01', 3, 'work', ['a1'], 'Natijaga erishish: loyiha natijasi'),
    ],
  },
  {
    id: 'CRS-LDR-04', exodeId: 'EX-1003', direction: 'FR', title: 'Jamoani boshqarish va rivojlantirish', hours: 10, status: 'active',
    summary: 'Maqsad qo‘yish, 1:1 uchrashuvlar, delegatsiya, xodimni rivojlantirish va vorislarni tayyorlash.',
    components: [
      lesson('l1', 'Jamoa maqsadlari va haftalik ritm', 30),
      lesson('l2', '1:1 uchrashuv va konstruktiv feedback', 35),
      lesson('l3', 'Delegatsiya va vorislarni tayyorlash', 30),
      test('t1', 'Jamoani boshqarish testi', 75, [
        q('Delegatsiyada nimani aniq kelishish kerak?', ['Natija, muddat va vakolat', 'Faqat muddat', 'Hech narsani — xodim o‘zi biladi'], 0),
        q('Yaxshi 1:1 uchrashuvning asosiy qismi?', ['Xodimning gapi va keyingi qadam', 'Rahbarning ma’ruzasi', 'Faqat KPI raqamlari'], 0),
        q('Vorisni tayyorlashning birinchi qadami?', ['Uning rivojlanish rejasini kelishish', 'Uni darhol almashtirish', 'Kutish'], 0),
      ]),
      task('a1', '2 xodim uchun rivojlanish rejasi va 1:1 ritmi', 'work',
        'Jamoangizdagi (yoki rahbaringiz biriktirgan) 2 xodim uchun 8 haftalik rivojlanish rejasi tuzing va haftalik 1:1 o‘tkazing. Natija va xodimlar fikrini yozing.',
        'Har xodim uchun maqsad va o‘lchov; 1:1 qaydlari; xodimlar fikri; mentor kuzatuvi.'),
    ],
    rules: [
      rule('LDR-04', 2, 'learning', ['t1'], 'Test — o‘quv dalili'),
      rule('LDR-04', 3, 'work', ['t1', 'a1'], 'Real jamoa bilan ish + mentor xulosasi'),
    ],
  },
  {
    id: 'CRS-LDR-05', exodeId: 'EX-1004', direction: 'FR', title: 'O‘zgarishlarga yetakchilik qilish', hours: 6, status: 'active',
    summary: 'O‘zgarish sababini tushuntirish, qarshilik bilan ishlash va yangi tartibni joriy qilish (keys asosida).',
    components: [
      lesson('l1', 'O‘zgarish sabablari va jamoaga yetkazish', 30),
      test('t1', 'O‘zgarishlarni boshqarish testi', 70, [
        q('Qarshilik bilan ishlashning birinchi qadami?', ['Sababini tinglash', 'Buyruq berish', 'E’tibor bermaslik'], 0, 1),
        q('Yangi tartibni joriy qilishda nima muhim?', ['Bosqichlar va mas’ullar', 'Faqat e’lon', 'Tezlik'], 0, 2),
      ]),
      task('a1', 'Keys: filialda yangi jadvalga o‘tish', 'case',
        'Keysdagi filialda yangi dars jadvaliga o‘tish rejasini tuzing: kim, qachon, qanday qarshilik va unga javob.',
        'Reja bosqichlari; qarshilik va javob; o‘lchov.'),
    ],
    rules: [
      rule('LDR-05', 2, 'learning', ['t1', 'a1'], 'Kurs + test + keys — o‘quv dalili (hujjatdagi demo misoli)'),
    ],
  },
  {
    id: 'CRS-CX-01', exodeId: 'EX-1005', direction: 'FR', title: 'Mijoz tajribasi va NPS', hours: 5, status: 'active',
    summary: 'Mijoz yo‘li, NPS, shikoyatlar bilan ishlash va xizmat standartlari.',
    components: [
      lesson('l1', 'Mijoz yo‘li va «uzilish nuqtalari»', 30),
      test('t1', 'Mijoz tajribasi testi', 70, [
        q('NPS nimani o‘lchaydi?', ['Tavsiya qilish ehtimolini', 'Tushumni', 'Davomatni'], 0),
        q('Shikoyatga birinchi javob?', ['Tinglash va muddatli yechim', 'Rad etish', 'Kechiktirish'], 0),
      ]),
      task('a1', 'Filialda 1 ta uzilish nuqtasini bartaraf etish', 'work',
        'Mijoz yo‘lidagi bitta uzilishni (masalan, birinchi qo‘ng‘iroqqa javob vaqti) aniqlang va 4 haftada tuzating.',
        'Oldin/keyin ko‘rsatkich; ko‘rilgan chora; mijozlar fikri.'),
    ],
    rules: [
      rule('FUN-03', 2, 'learning', ['t1'], 'Test — o‘quv dalili'),
      rule('FUN-03', 3, 'work', ['t1', 'a1'], 'Real chora + mentor xulosasi'),
    ],
  },
  {
    id: 'CRS-FIN-02', exodeId: 'EX-1006', direction: 'FR', title: 'Filial moliyasi: ilg‘or daraja', hours: 8, status: 'active',
    summary: 'Bir necha filial byudjeti, investitsiya qarori va moliyaviy xavflarni boshqarish.',
    components: [
      lesson('l1', 'Bir necha filialni moliyaviy solishtirish', 40),
      test('t1', 'Ilg‘or moliya testi', 75, [
        q('Yangi guruh ochish qarorida asosiy mezon?', ['Qoplanish nuqtasi va talab', 'Xona borligi', 'Ustoz xohishi'], 0),
        q('Moliyaviy xavfni kamaytirish usuli?', ['Ssenariy va zaxira rejasi', 'Xarajatni yashirish', 'Kutish'], 0),
      ]),
      task('a1', 'Ikki filial bo‘yicha investitsiya taklifi', 'stretch',
        'Ikki filial uchun yangi yo‘nalish yoki guruh ochish bo‘yicha moliyaviy asoslangan taklif tayyorlang va rahbariyatga taqdim eting.',
        'Qoplanish nuqtasi; xavflar; qaror va natija.'),
    ],
    rules: [rule('FUN-04', 4, 'work', ['t1', 'a1'], 'Bir necha filial ko‘lamidagi real taklif + mentor xulosasi')],
  },
  {
    id: 'CRS-DEC-01', exodeId: 'EX-1007', direction: 'FR', title: 'Qaror qabul qilish va ma’lumot tahlili', hours: 6, status: 'active',
    summary: 'Ma’lumotga tayangan qaror, ildiz sabab tahlili va xavfni baholash.',
    components: [
      lesson('l1', 'Ildiz sabab tahlili (5 nega, Ishikawa)', 30),
      test('t1', 'Tahlil va qaror testi', 70, [
        q('Ildiz sababni topishning oddiy usuli?', ['5 marta «nega?» so‘rash', 'Birinchi javobni olish', 'Taxmin qilish'], 0),
        q('Qaror sifati nimaga bog‘liq?', ['Ma’lumot va muqobillarga', 'Tezlikka', 'Lavozimga'], 0),
      ]),
      task('a1', 'Filial muammosi bo‘yicha tahliliy qaror', 'case',
        'Filialingizdagi bitta takroriy muammo bo‘yicha ildiz sabab tahlili va qaror variantlarini tayyorlang.',
        'Ma’lumot; sabab; 2–3 muqobil; tanlangan qaror va asos.'),
    ],
    rules: [
      rule('LDR-02', 2, 'learning', ['t1'], 'Test — o‘quv dalili'),
      rule('LDR-02', 3, 'work', ['t1', 'a1'], 'Real muammo tahlili + mentor xulosasi'),
      rule('LDR-03', 3, 'work', ['a1'], 'Qaror qabul qilish: asoslangan qaror'),
    ],
  },

  // ---------------- General English ustozi ----------------
  {
    id: 'CRS-GE-CCQ', exodeId: 'EX-2001', direction: 'GE', title: 'Ko‘rsatma berish va CCQ/ICQ', hours: 4, status: 'active',
    summary: 'Qisqa ko‘rsatma, namuna va tushunishni tekshirish savollari.',
    components: [
      lesson('l1', 'Instruction giving: qisqa, ketma-ket, namuna bilan', 25),
      lesson('l2', 'CCQ va ICQ: misollar', 25),
      test('t1', 'CCQ/ICQ testi', 75, [
        q('ICQ nimani tekshiradi?', ['O‘quvchi topshiriqni qanday bajarishni tushunganini', 'Grammatikani', 'Davomatni'], 0),
        q('«Tushundingizmi?» savolining kamchiligi?', ['Haqiqiy tushunishni ko‘rsatmaydi', 'Juda uzun', 'Kamchiligi yo‘q'], 0),
      ]),
      task('a1', 'Darsda CCQ/ICQ qo‘llash (dars kuzatuvi bilan)', 'work',
        'O‘z darsingizda 3 ta topshiriqda ko‘rsatma va CCQ/ICQ qo‘llang. Metodist darsni kuzatadi.',
        'Ko‘rsatmalar qisqa; namuna; CCQ/ICQ maqsadli; o‘quvchilar topshiriqni mustaqil boshlaydi.'),
    ],
    rules: [
      rule('GEN-03', 2, 'learning', ['t1'], 'Test — o‘quv dalili'),
      rule('GEN-03', 3, 'work', ['t1', 'a1'], 'Dars kuzatuvi + metodist xulosasi'),
    ],
  },
  {
    id: 'CRS-GE-FB', exodeId: 'EX-2002', direction: 'GE', title: 'Monitoring va feedback', hours: 4, status: 'active',
    summary: 'Speaking paytida xatolarni kuzatish, self/peer correction va keyingi qadamli feedback.',
    components: [
      lesson('l1', 'Monitoring: darsni to‘xtatmasdan xatolarni yozish', 25),
      test('t1', 'Feedback testi', 70, [
        q('Self-correction nima?', ['O‘quvchi xatosini o‘zi tuzatishi', 'Ustoz tuzatishi', 'Test'], 0),
        q('Yaxshi feedbackda nima bo‘ladi?', ['Aniq keyingi qadam', 'Faqat «yaxshi»', 'Ball'], 0),
      ]),
      task('a1', 'Error log va feedback sessiyasi', 'work',
        'Bir hafta davomida bitta guruhda error log yuriting va xatolar bo‘yicha 1 ta feedback sessiyasi o‘tkazing.',
        'Error log; takroriy xatolar tahlili; feedback sessiyasi; keyingi mashq.'),
    ],
    rules: [
      rule('GEN-05', 2, 'learning', ['t1'], 'Test — o‘quv dalili'),
      rule('GEN-05', 3, 'work', ['t1', 'a1'], 'Real guruh + metodist xulosasi'),
    ],
  },
  {
    id: 'CRS-GE-DIFF', exodeId: 'EX-2003', direction: 'GE', title: 'Differentiation va scaffolding', hours: 5, status: 'active',
    summary: 'Turli darajadagi o‘quvchilar uchun support va extension topshiriqlari.',
    components: [
      lesson('l1', 'Task, support, time bo‘yicha differensiatsiya', 30),
      test('t1', 'Differensiatsiya testi', 70, [
        q('Extension topshiriq kim uchun?', ['Tez ishlaydigan o‘quvchilar', 'Hamma uchun bir xil', 'Faqat sustlar'], 0),
        q('Scaffolding nima?', ['Vaqtinchalik yordam va bosqichma-bosqich qo‘llab-quvvatlash', 'Uy vazifasi', 'Imtihon'], 0),
      ]),
      task('a1', 'Bitta dars uchun 3 darajali topshiriqlar', 'work',
        'Bitta dars rejasida support, asosiy va extension topshiriqlarni tayyorlang va darsda qo‘llang.',
        '3 daraja; maqsadga mos; natija kuzatilgan.'),
    ],
    rules: [
      rule('GEN-07', 2, 'learning', ['t1'], 'Test — o‘quv dalili'),
      rule('GEN-07', 3, 'work', ['t1', 'a1'], 'Real dars + metodist xulosasi'),
    ],
  },

  {
    id: 'CRS-GE-CONV', exodeId: 'EX-2004', direction: 'GE', title: 'Birinchi oy: yangi o‘quvchini ushlab qolish', hours: 4, status: 'active',
    summary: 'Birinchi darslar tajribasi, darajaga moslash, ota-ona/o‘quvchi bilan aloqa va 2–3-hafta xavf signallari. 1-oy konversiyasi past bo‘lsa majburiy.',
    components: [
      lesson('l1', 'Birinchi dars: tanishuv, maqsad va «tez yutuq»', 25),
      lesson('l2', 'Birinchi 4 hafta: kuzatish, darajaga moslash, aloqa', 25),
      test('t1', 'Birinchi oy testi', 75, [
        q('Yangi o‘quvchi uchun birinchi darsdagi eng muhim natija?', ['O‘zi biror narsani muvaffaqiyatli gapira olgani', 'Uy vazifasi berilgani', 'Grammatika qoidasini yozib olgani'], 0),
        q('2-haftada o‘quvchi 2 dars qoldirdi. Nima qilasiz?', ['Shu kuni o‘zi/ota-onasi bilan bog‘lanib sababni bilaman', 'Oy oxirini kutaman', 'Administratorga topshiraman'], 0),
        q('Yangi o‘quvchi guruh darajasidan past. Birinchi qadam?', ['Support topshiriq va individual reja', 'Boshqa guruhga darhol o‘tkazish', 'E’tibor bermaslik'], 0),
      ]),
      task('a1', 'Yangi o‘quvchilar bilan 4 haftalik kuzatuv', 'work',
        'Shu oy yangi kelgan har bir o‘quvchi uchun birinchi 4 haftada: 1-dars maqsadi, 2-hafta aloqa (o‘quvchi yoki ota-ona), xavf signali va ko‘rilgan chora. Jadvalni metodistga yuboring.',
        'Har yangi o‘quvchi qamrab olingan; aloqa vaqtida; xavf signallari va choralar aniq; keyingi oy konversiyasi kuzatiladi.'),
    ],
    rules: [
      rule('BEH-02', 2, 'learning', ['t1'], 'Test — o‘quv dalili'),
      rule('BEH-02', 3, 'work', ['t1', 'a1'], '4 haftalik kuzatuv + metodist xulosasi'),
    ],
  },
  {
    id: 'CRS-GE-RET', exodeId: 'EX-2005', direction: 'GE', title: 'O‘quvchi retentioni: motivatsiya va ketish xavfi', hours: 5, status: 'active',
    summary: 'Ketish sabablari, erta xavf signallari (davomat, uy vazifasi, faollik), progressni ko‘rsatish va individual yondashuv. Oylik retention past bo‘lsa majburiy.',
    components: [
      lesson('l1', 'Nega o‘quvchilar ketadi: 5 asosiy sabab', 25),
      lesson('l2', 'Progressni ko‘rsatish va individual maqsad', 30),
      test('t1', 'Retention testi', 75, [
        q('Ketish xavfining eng erta signali?', ['Ketma-ket dars qoldirish va uy vazifasini bajarmaslik', 'Oy oxiridagi test bali', 'To‘lov kuni'], 0),
        q('O‘quvchi «rivojlanmayapman» dedi. Eng yaxshi javob?', ['Oldin/keyin natijani ko‘rsatib, keyingi aniq maqsadni kelishish', 'Ko‘proq uy vazifasi berish', 'Hammasi yaxshi deb ishontirish'], 0),
        q('Retentionga kursni bitirgan o‘quvchi qanday ta’sir qiladi?', ['Ketgan hisoblanmaydi', 'Ketgan hisoblanadi', 'Yangi o‘quvchi hisoblanadi'], 0),
      ]),
      task('a1', 'Xavf guruhidagi o‘quvchilar bilan 1 oylik reja', 'work',
        'Guruhingizdagi ketish xavfi bor o‘quvchilarni aniqlang (davomat, faollik, uy vazifasi). Har biri bilan suhbat, individual maqsad va 4 hafta kuzatuv. Natijani metodistga yuboring.',
        'Xavf mezonlari aniq; har o‘quvchi bilan suhbat va maqsad; 4 haftalik kuzatuv; oy oxiridagi natija.'),
    ],
    rules: [
      rule('BEH-03', 2, 'learning', ['t1'], 'Test — o‘quv dalili'),
      rule('BEH-03', 3, 'work', ['t1', 'a1'], 'Real guruh + metodist xulosasi'),
    ],
  },

  // ---------------- Akademik bo'lim rahbari ----------------
  {
    id: 'CRS-AB-OBS', exodeId: 'EX-3001', direction: 'AB', title: 'Dars kuzatuvi va ustozlarga metodik feedback', hours: 8, status: 'active',
    summary: 'Mezonli kuzatuv, dalilga tayangan feedback va ustoz bilan keyingi qadamni kelishish.',
    components: [
      lesson('l1', 'Kuzatuv mezonlari va kuzatuv varag‘i', 35),
      lesson('l2', 'Feedback suhbati: dalil → ta’sir → keyingi qadam', 35),
      test('t1', 'Kuzatuv va feedback testi', 75, [
        q('Feedback suhbati nimadan boshlanadi?', ['Kuzatilgan dalildan', 'Bahodan', 'Tanqiddan'], 0),
        q('Kuzatuvdan keyin ustoz bilan nechta keyingi qadam kelishish ma’qul?', ['1–2 ta aniq qadam', '10 ta', 'Hech qanday'], 0),
      ]),
      task('a1', '3 ustoz darsini kuzatish va feedback', 'work',
        '3 nafar ustoz darsini kuzating, kuzatuv varag‘ini to‘ldiring va har biri bilan feedback suhbati o‘tkazing. 2 haftadan keyin natijani tekshiring.',
        'Mezonli kuzatuv varaqlari; dalilga tayangan feedback; kelishilgan qadam va uning bajarilishi.'),
    ],
    rules: [
      rule('AB-01', 2, 'learning', ['t1'], 'Test — o‘quv dalili'),
      rule('AB-01', 3, 'work', ['t1', 'a1'], 'Real kuzatuvlar + mentor xulosasi'),
    ],
  },
  {
    id: 'CRS-AB-QUAL', exodeId: 'EX-3002', direction: 'AB', title: 'Akademik sifat va o‘quvchi natijalari tahlili', hours: 6, status: 'active',
    summary: 'Mock, Mid/End va retention bo‘yicha tahlil, past guruhlar uchun intervention.',
    components: [
      lesson('l1', 'Akademik ko‘rsatkichlar va oylik tahlil', 30),
      test('t1', 'Akademik sifat testi', 70, [
        q('Past natijali guruh uchun birinchi qadam?', ['Sabab tahlili va reteach rejasi', 'Ustozni almashtirish', 'Kutish'], 0),
        q('Intervention samarasini qanday bilamiz?', ['Oldin/keyin natija bilan', 'Ustoz fikri bilan', 'Bilib bo‘lmaydi'], 0),
      ]),
      task('a1', 'Filial bo‘yicha oylik akademik tahlil va 1 intervention', 'work',
        'Filial guruhlari natijalarini tahlil qiling, eng past guruh uchun intervention rejasini tuzing va 4 haftada natijani o‘lchang.',
        'Tahlil jadvali; intervention rejasi; oldin/keyin natija.'),
    ],
    rules: [
      rule('AB-02', 2, 'learning', ['t1'], 'Test — o‘quv dalili'),
      rule('AB-02', 3, 'work', ['t1', 'a1'], 'Real tahlil va intervention + mentor xulosasi'),
    ],
  },

  // ---------------- Umumiy (korporativ) ----------------
  {
    id: 'CRS-AI-01', exodeId: 'EX-9002', direction: 'KOR', title: 'AI bilan ishlash: kundalik ish uchun', hours: 4, status: 'active',
    summary: 'ChatGPT/Claude kabi AI yordamchilardan xat, hisobot, dars materiali va tahlil uchun foydalanish; natijani tekshirish va maxfiylik qoidalari.',
    components: [
      lesson('l1', 'AI yordamchi nima qila oladi va nima qila olmaydi', 20),
      lesson('l2', 'Yaxshi prompt: vazifa, kontekst, format, tekshirish', 25),
      test('t1', 'AI bilan ishlash testi', 75, [
        q('AI bergan raqam yoki faktni qanday ishlatasiz?', ['Manbadan tekshirib, keyin ishlataman', 'To‘g‘ridan-to‘g‘ri ishlataman', 'Umuman ishlatmayman'], 0),
        q('O‘quvchi yoki mijozning shaxsiy ma’lumotini AI ga kiritish mumkinmi?', ['Yo‘q — maxfiy ma’lumot kiritilmaydi', 'Ha, istalgancha', 'Faqat telefon raqamini'], 0),
        q('Yaxshi promptda nima bo‘ladi?', ['Vazifa, kontekst, kerakli format va cheklovlar', 'Faqat bitta so‘z', 'Faqat «yordam ber»'], 0),
      ]),
      task('a1', 'Bitta takroriy ishni AI bilan tezlashtirish', 'work',
        'Ishingizdagi bitta takroriy vazifani (hisobot, xat, dars materiali, tahlil) AI yordamida bajaring: prompt, natija, qanday tekshirganingiz va tejagan vaqt.',
        'Prompt aniq; natija tekshirilgan; maxfiy ma’lumot kiritilmagan; vaqt yoki sifat foydasi ko‘rsatilgan.'),
    ],
    rules: [
      rule('FUN-07', 2, 'learning', ['t1'], 'Test — o‘quv dalili (raqamli savodxonlik)'),
      rule('FUN-07', 3, 'work', ['t1', 'a1'], 'Ishdagi topshiriq + mentor xulosasi'),
    ],
    skills: [
      { skillId: 'SK-AI-02', level: 1, needs: ['t1'] },
      { skillId: 'SK-AI-01', level: 2, needs: ['t1', 'a1'] },
    ],
  },
  {
    id: 'CRS-KOR-03', exodeId: 'EX-9001', direction: 'KOR', title: 'Jamoaviylik va bo‘limlararo hamkorlik', hours: 4, status: 'active',
    summary: 'Ma’lumot almashish, kelishmovchilikni konstruktiv hal qilish va umumiy maqsad.',
    components: [
      lesson('l1', 'Hamkorlik qoidalari va bo‘limlararo vazifalar', 25),
      test('t1', 'Jamoaviylik testi', 70, [
        q('Kelishmovchilikni hal qilishning birinchi qadami?', ['Tomonlar fikrini tinglash', 'Rahbarga shikoyat', 'E’tibor bermaslik'], 0),
        q('Bo‘limlararo vazifada nima muhim?', ['Kim nima uchun javobgarligi', 'Faqat muddat', 'Hech narsa'], 0),
      ]),
      task('a1', 'Bo‘limlararo kichik loyiha', 'work',
        'Boshqa bo‘lim bilan birgalikda kichik vazifani bajaring (masalan, ochiq dars kuni) va rolingizni yozing.',
        'Rol va hissa; hamkorlar fikri; natija.'),
    ],
    rules: [
      rule('KOR-03', 2, 'learning', ['t1'], 'Test — o‘quv dalili'),
      rule('KOR-03', 4, 'work', ['t1', 'a1'], 'Real bo‘limlararo loyiha + mentor xulosasi'),
    ],
  },
  // ---------------- Moslashuv (onboarding, TZ): 30 kun, 1–5 baho, kompetensiya qoidasi yo'q ----------------
  {
    id: 'CRS-ON-CORP', exodeId: 'EX-0001', direction: 'ONB', title: 'Registon Academy’ga xush kelibsiz', hours: 2, status: 'active', onboarding: true, version: 1, curatorId: 'u-cur',
    summary: 'Kompaniya tarixi, qadriyatlar, tuzilma, ichki tartib va xavfsizlik. Barcha yangi xodimlar uchun.',
    components: [
      lesson('l1', 'Kompaniya tarixi, qadriyatlar va tuzilma', 20),
      lesson('l2', 'Ichki tartib, ish vaqti, xavfsizlik va kimga murojaat qilish', 15),
      test('t1', 'Korporativ test', 70, [
        q('Ish bo‘yicha savol tug‘ilsa, birinchi kimga murojaat qilasiz?', ['Mentorga yoki bevosita rahbarga', 'Bosh direktorga', 'Hech kimga'], 0),
        q('O‘quvchi ma’lumotlarini kim bilan ulashish mumkin?', ['Ijtimoiy tarmoqlarda', 'Faqat ish jarayonida vakolatli xodimlar bilan', 'Istalgan odam bilan'], 1),
        q('Ishdan qolish kerak bo‘lsa nima qilasiz?', ['Hech kimga aytmayman', 'Oldindan rahbarni ogohlantiraman va almashtiruvchini kelishaman', 'Ertasi kuni aytaman'], 1),
        q('Kompaniya qadriyatlaridan biri:', ['O‘quvchi natijasi birinchi o‘rinda', 'Faqat tezlik', 'Shaxsiy manfaat'], 0),
      ]),
    ],
    rules: [],
  },
  {
    id: 'CRS-ON-GE', exodeId: 'EX-0002', direction: 'ONB', title: 'Ustozning birinchi 30 kuni', hours: 6, status: 'active', onboarding: true, version: 2,
    changelog: 'v2 (2026-10-01): amaliy topshiriqqa o‘tkazilgan dars tahlili qo‘shildi',
    summary: 'Registon dars standarti, Edu’da davomat va uy vazifasi, birinchi darslarni rejalash. Topshiriqni mentor tekshiradi.',
    components: [
      lesson('l1', 'Registon dars standarti: bosqichlar, vaqt, STT/TTT', 30),
      lesson('l2', 'Edu: davomat, uy vazifasi, natijalar', 20),
      test('t1', 'Dars standarti testi', 70, [
        q('Lesson plan’da birinchi navbatda nima belgilanadi?', ['Darsning o‘lchanadigan maqsadi', 'Faqat mavzu nomi', 'Uy vazifasi'], 0),
        q('Ko‘rsatma berilgach tushunganini qanday tekshirasiz?', ['«Tushundingizmi?» deb so‘rayman', 'ICQ — aniq tekshiruv savollari bilan', 'Tekshirmayman'], 1),
        q('Davomat Edu’da qachon belgilanadi?', ['Oy oxirida', 'Har dars davomida yoki darhol keyin', 'Kerak bo‘lmaydi'], 1),
        q('Speaking mashqida ustozning gapirish ulushi (TTT) qanday bo‘lishi kerak?', ['Iloji boricha kam, o‘quvchilar ko‘proq gapiradi', 'Ko‘proq ustoz gapiradi', 'Farqi yo‘q'], 0),
      ]),
      task('a1', 'Lesson plan va o‘tkazilgan dars tahlili', 'work', 'Bitta darsingizning lesson planini yozing, darsni o‘tkazing va qisqa tahlil qiling: nima ishladi, nimani o‘zgartirasiz.', 'Maqsad aniq va o‘lchanadi; bosqichlar va vaqt; ICQ/CCQ; tahlilda 1–2 aniq o‘zgarish.'),
    ],
    rules: [],
  },
  {
    id: 'CRS-ON-FIN', exodeId: 'EX-0003', direction: 'ONB', title: 'Moliya menejerining birinchi oyi', hours: 4, status: 'active', onboarding: true, version: 1, curatorId: 'u-cur',
    summary: 'To‘lovlar, qarzdorlik va undirish jarayoni, Edu tizimidagi hisobotlar. Topshiriqni kurs kuratori tekshiradi.',
    components: [
      lesson('l1', 'To‘lov va qarzdorlik jarayoni, Edu hisobotlari', 30),
      test('t1', 'Qarzdorlik jarayoni testi', 70, [
        q('Qarzdorlik qachon qayd etiladi?', ['To‘lov muddati o‘tgan kundan', 'Yil oxirida', 'O‘quvchi ketganda'], 0),
        q('Undirish rejasida birinchi qadam:', ['Ota-ona bilan muloqot va to‘lov jadvali', 'Darsdan chetlatish', 'Hech narsa'], 0),
        q('Qarzdorlik hisobotini qayerdan olasiz?', ['Edu tizimidan', 'Telegram guruhdan', 'Xotiradan'], 0),
      ]),
      task('a1', 'Filial qarzdorlari ro‘yxati va undirish rejasi', 'work', 'Edu’dan filial qarzdorlari ro‘yxatini oling, guruhlang va 2 haftalik undirish rejasini tuzing.', 'Ro‘yxat to‘liq; ustuvorlik; mas’ul va muddat; kutilgan natija.'),
    ],
    rules: [],
  },
];

// Learning Path — bir nechta kursdan iborat kompleks yechim: maqsadli lavozim, kurslar ketma-ketligi va muddat.
// Kurslardan tashqari lavozim shartlari (KPI, staj, majburiy talablar) maqsadli modeldan olinadi.
export const PATHS = [
  {
    id: 'LP-FR1', title: 'Filial rahbari (FR-1) ga tayyorgarlik', target: { modelId: 'FR', profileCode: 'FR-1' }, weeks: 16, sequential: true, status: 'active',
    audience: 'Moliya menejeri, sotuv menejeri, LT-2+ ustoz va filial rahbari zaxirasidagi xodimlar',
    summary: 'Filial moliyasi, sotuv voronkasi, jamoani boshqarish, mijoz tajribasi va qaror qabul qilish. Har kursdagi amaliy topshiriq ishda (o‘z tashabbusi yoki filial rahbari topshirig‘i bilan) bajariladi va mentor xulosasi bilan ish dalili bo‘ladi.',
    courses: ['CRS-FIN-01', 'CRS-SALES-01', 'CRS-LDR-04', 'CRS-CX-01', 'CRS-DEC-01'],
  },
  {
    id: 'LP-FR2', title: 'Katta filial rahbari (FR-2) ga tayyorgarlik', target: { modelId: 'FR', profileCode: 'FR-2' }, weeks: 20, sequential: true, status: 'active',
    audience: 'FR-1 filial rahbarlari',
    summary: 'Ilg‘or moliya, o‘zgarishlarga yetakchilik, jamoaviylik va murakkab qarorlar. KPI va staj talablari bajarilganda lavozim sharti to‘liq bajarilgan deb topiladi.',
    courses: ['CRS-FIN-02', 'CRS-LDR-05', 'CRS-KOR-03', 'CRS-DEC-01'],
  },
  {
    id: 'LP-AB1', title: 'Akademik bo‘lim rahbariga tayyorgarlik', target: { modelId: 'AB', profileCode: 'AB-1' }, weeks: 16, sequential: true, status: 'active',
    audience: 'LT-2, LT-3, LT-4 ustozlar (rotatsiya)',
    summary: 'Dars kuzatuvi va metodik feedback, akademik sifat tahlili, jamoani boshqarish va qaror qabul qilish.',
    courses: ['CRS-AB-OBS', 'CRS-AB-QUAL', 'CRS-LDR-04', 'CRS-DEC-01'],
  },
  {
    id: 'LP-LT2', title: 'Standart ustoz (LT-2) ga tayyorgarlik', target: { modelId: 'GE', profileCode: 'LT-2' }, weeks: 10, sequential: false, status: 'active',
    audience: 'LT-1 Junior ustozlar',
    summary: 'Ko‘rsatma va CCQ/ICQ, monitoring va feedback, differentiation. Amaliy topshiriqlar dars kuzatuvi bilan tasdiqlanadi.',
    courses: ['CRS-GE-CCQ', 'CRS-GE-FB', 'CRS-GE-DIFF'],
  },
];
