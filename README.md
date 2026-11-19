# RegUP — kompetensiyalarni boshqarish (demo prototip)

RegUP LMS'ning ishlaydigan demo-prototipi. RegUP — ichki akademiya, ya'ni tizim: reja, jarayonlar va metodika. RegUP LMS esa shu tizimni qo'llab-quvvatlaydigan va avtomatlashtiradigan alohida, mustaqil dastur. U Jobster, EduTizim va Google Workspace bilan integratsiyada ishlaydi; hozirgi Exode'dan faqat kurs kontenti (video va o'quv materiallari) ko'chiriladi. Hamma narsa brauzerda ishlaydi: server yo'q, ma'lumotlar `localStorage`'da saqlanadi.

## Ishga tushirish

```bash
cd app
npm install
npm run dev      # http://localhost:5180
npm test         # 15 ta UAT + hisoblash, ish oqimi va onboarding tizimi testlari (56 ta)
npm run build    # dist/ — statik sayt, istalgan hostingga qo'yiladi
```

## Nimalar bor

**Admin ko'rinishi**
- **Bosh panel** — baholash qamrovi, maqsadga yetganlar ulushi, DE, kechikkan kartalar, tayyorlik ro'yxati.
- **Baholash kartalari** — qoralamadan e'longacha butun ish oqimi; 1–5 rubrika, dalillar (intervyu, keys, audit, dars kuzatuvi), asos bilan yakuniy daraja, HR-01–HR-11 → FUN-05, shartlarning shaffof hisobi, panel protokoli, rasmiy tayinlash va qayta baholash.
- **Stretch vazifalar** — stretch vazifalar: biriktirish, yuborish, qaytarish yoki tasdiqlash tarixi, panelga bog'lanishi.
- **Qo‘shimcha dalillar** — qo'shimcha kompetensiya dalillari; kursning maksimal darajasi bo'yicha cheklov.
- **Rivojlanish rejalari (IDP)**, **Vorislik** — qiziqish, HR qarori, kadrlar zaxirasi.
- **Lavozim modellari (konstruktor)** — FR V0.3 va General English ustozi (LT-0…LT-4) modellari, yangi lavozim modelini noldan yoki nusxadan yaratish, versiyalar (qoralama → tekshiruv → faol → arxiv), qoidalarni sinash.
- **Excel import** — varaq va qator bo'yicha tekshiruv; xato bo'lsa butun import bekor qilinadi.
- **Yangi filial KPI**, **Audit jurnali**, **Qabul sinovlari** (15 ta UAT brauzerda jonli bajariladi).

**Xodim ko'rinishi** (yuqoridagi tanlovdan xodimni tanlang)
- Mening natijam, Karyera yo'lim (ikki rolni solishtirish, qiziqish bildirish, qo'shimcha dalil yuborish), Stretch vazifam, Bildirishnomalar.

## Demo ssenariysi
1. Admin → Baholash kartalari → **Dilshod Karimov (FR-1 → FR-2)**. Bu kartada LDR-05 baholanmagan. Uni 4 bilan baholang va asos yozing. Keyin «Keyingi qadam» blokidagi tugma bilan bosqichma-bosqich o‘ting, panel protokolini kiriting va natijani e'lon qiling. So'ng rasmiy tayinlashni qayd eting: joriy daraja faqat shundan keyin FR-2 bo'ladi.
2. Admin → Stretch vazifalar → **Uch filial loyihasi**. Dalilni qaytaring. Xodim ko'rinishida Nodira Rahimova sifatida uni qayta yuboring. Admin ko'rinishiga qaytib tasdiqlang.
3. Admin → Baholash kartalari → **Malika Yusupova (LT-1 → LT-2, General English)**. «Dars kuzatuvi» blokida bitta darsda bir nechta kompetensiyani baholang — har bahosi o'z kompetensiyasiga dalil bo'ladi. «Majburiy talablar (gate)» blokida Teacher Training Course'ni dalil bilan belgilang. O'ngdagi shartlarda kuzatuv soni, kuzatuv o'rtachasi, kamida 2 usul va 100% moslik qoidalari ko'rinadi.
4. Admin → Lavozim modellari → **+ Yangi lavozim modeli**: nom, kod va shkalani (1–3 … 1–6) tanlang. Qoralamada kompetensiya yarating yoki kutubxonadan oling, indikatorlarni yozing, usullarni va (xohlasangiz) vaznlarni belgilang, profillar va har profilning o'z shartlarini kiriting, «Qoidalarni sinash»da tekshiring, so'ng tekshiruv → tasdiqlash.
5. Xodim ko'rinishida Malika Yusupova → Karyera yo'lim: LT-2 bilan yonma-yon FR-1 ni ham tanlab ko'ring (LDR-05 bo'yicha o'quv dalili, FR uchun real ish dalili talabi).

Chap pastdagi «Demoni qayta boshlash» tugmasi demoni boshlang'ich holatga qaytaradi.

## Kurslar va Learning Path (LMS)
- **Kurs** = darslar + test(lar) + amaliy topshiriq(lar). Kurs yaratilganda «kompetensiyaga ta'sir» qoidalari sozlanadi: qaysi komponent bajarilsa, qaysi kompetensiya qaysi darajagacha va qanday dalil sifatida tasdiqlanadi.
  - Test → **o'quv dalili** (avtomatik, kursdagi chegaragacha).
  - Amaliy topshiriq (keys, stretch yoki ishdagi topshiriq; o'z tashabbusi yoki rahbar topshirig'i bilan) → mentor xulosasi → **ish dalili**. Mentor bergan daraja kurs chegarasidan oshmaydi; mavjud yuqori daraja pasaytirilmaydi.
- **Learning Path** — maqsadli lavozimga olib boradigan 3–5 kurs (ketma-ket yoki erkin). Yo'l sahifasida lavozimga tayyorlik, KPI va staj shartlari ko'rinadi; yakunlanishi lavozimga avtomatik o'tish emas — baholash kartasi va panel orqali.
- Admin: Kurslar va Learning Path (katalog, kurs konstruktori, yo'llar, mentor tekshiruvi). Xodim: Kurslarim (yo'llar, tavsiyalar, kurs o'tish).
- Namunaviy ma'lumot: `src/data/courses.js` — 13 kurs, 4 Learning Path (FR-1, FR-2, Akademik bo'lim rahbari, LT-2).

## Onboarding tizimi (2026-11-19 yangilanishi)
Tizim hujjati — «RegUP onboarding tizimi» (Claude Doc). Prototipda:
- **60 kunlik adaptatsiya** (orientation 1–7, functional 8–60); moslashuv dasturi muddati lavozim bo'yicha sozlanadi (standart 30 kun), onboarding bahosi shu muddat yakunida.
- **Huquqlar shaxsga beriladi** («Jamoa a'zolari»): har huquq filial doirasi bilan (barcha / tanlangan / o'ziga biriktirilganlar). TZ'dagi 6 ta qat'iy rol o'rniga. Mentor va **buddy** biriktiriladi.
- **Kompetensiya kartasi rekrutingdan**: modeli bor lavozimda birinchi kundan ochiladi, rekruting baholari shartli; 60-kunda birinchi lavozim darajasi. Rasmiy e'lon yiliga 1–2 marta (sozlanadi). Modeli yo'q lavozimda karta yo'q, kurslar ishlaydi.
- **Kurs ↔ kompetensiya**: test savollari daraja indikatoriga bog'lanadi, daraja topilgan indikatorlardan; kurs bahosi alohida, dalil uchun kamida 4 (sozlanadi).
- **Kurs fikrlari** (barcha kurslar): dars bahosi, «Kursdan qoniqish bahosi» (1–5), NPS (0–10), ochiq fikr — anonim; e'lonni «Kurs izohlarini boshqarish» huquqi egasi qiladi.
- **So'rovnomalar anonim**: D8/D30/D60/Fail Case faqat filial va lavozim kesimida; 8 bandli standartlar nazorat ro'yxati; javob ulushi past filiallarga eslatma.
- **Offboarding**: ketish turiga qarab Fail Case yoki exit-intervyu; haydalish faqat ikki sabab bilan; «Qaytadi» va dublikatga so'rovnoma yo'q. «Markaz admini» — shaxsiy raqamga alohida akkaunt.
- Dashboard'dagi ko'rsatkichlar kelishilgan ro'yxat bo'yicha (kohorta retention 30/60/90, 30 kun ichida ketganlar, mentor yuklamasi, eNPS, ma'lumot sifati, reboarding, ishga tayyor bo'lish vaqti; baho ↔ KPI bog'liqligi faqat 100+ xodimdan keyin xulosa).

## Moslashuvchan model
Mohiyat hamma lavozimda bir xil: kompetensiya → daraja indikatorlari → dalil → yakuniy daraja → moslik (`100 × Σmin(baho, maqsad) ÷ Σmaqsad`) va shartlar → qaror. Lavozimga qarab quyidagilar model konfiguratsiyasida sozlanadi:
- **Kompetensiyalar** soni va turi (qatlam), har birining ta'rifi, salbiy indikatorlari va savollari; umumiy kompetensiyalar (masalan KOR-01…04) kutubxonadan olinadi.
- **Shkala**: 1–3, 1–4, 1–5 yoki 1–6, daraja nomlari bilan.
- **Baholash usullari**: kutubxonadagi turlar (kuzatuv, BEI, keys, ish namunasi, test, 360°, KPI, o'z-o'zini baholash) va o'z nomi bilan yangi usullar; har kompetensiyaga qaysi usullar qo'llanishi.
- **Yakuniy daraja**: baholovchi xulosasi yoki usul vaznlari bo'yicha tizim taklifi.
- **Profillar** va har profilning **o'z shartlari**: chegara (va «rivojlanish sharti bilan» zonasi), minimal daraja, tafovut, staj, KPI, kuzatuv soni va o'rtachasi, kamida N mustaqil usul, majburiy usul, majburiy gate'lar, panel.

`src/data/geCatalog.json` — «GENERAL english teacher modeli» jadvalidan olingan: 22 kompetensiya, 1–5 indikatorlar, salbiy indikatorlar, dalil manbalari, intervyu savollari, LT-0…LT-4 maqsadlari (25/44/66/84/100).

## Dizayn
`src/styles.css` — yagona dizayn tizimi: lojuvard va feruza (Registon koshinlari) ohanglari, ikonkali navigatsiya, avatarlar, rangli baho belgilari (maqsadga yetgan — yashil, 1 ball kam — sariq, 2+ kam — qizil), bosqich chizig'i. Umumiy komponentlar `src/ui/common.jsx` da: `Icon`, `Avatar`, `Person`, `Stat`, `Stepper`, `ScoreChip`, `Meter`.

## Tuzilma
```
src/core/calc.js            hisoblash: moslik, FUN-05, R ko'lami, yangi filial KPI, audit o'rtachasi
src/core/rules.js           shartlar katalogi va qaror holatlari (parametrlar modelda yoki profilda)
src/core/modelKit.js        model yordamchilari: shkala, usullar, profil shartlari, kompetensiya kutubxonasi
src/core/domain.js          ish oqimi amallari: karta, panel, tayinlash, stretch, IDP, versiyalar, ruxsatlar
src/core/importValidate.js  Excel import tekshiruvi
src/core/uat.js             15 ta qabul sinovi (vitest va UI uchun umumiy)
src/data/frCatalog.json     FR V0.3 pilot jadvallaridan olingan: 16 kompetensiya, 1–5 indikatorlar, HR-01–HR-11, 52 audit bandi, intervyu savollari
src/data/models.js          FR V0.3 va General English ustozi modellari
src/data/seed.js            demo xodimlar, filiallar, kartalar
src/pages/*                 ekranlar
```

## Cheklovlar (prototip)
- Autentifikatsiya, server, fayl saqlash va Jobster, EduTizim va Google Workspace bilan integratsiya hamda Exode'dan kontent ko'chirish yo'q. Ishchi RegUP LMS'da hisob, ruxsat va audit server tomonida bajariladi; `src/core` mantiqini server kodiga ko'chirish mumkin.
- Excel import `.xlsx` fayl o'rniga varaqlar tarkibini JSON ko'rinishida qabul qiladi.
- General English modeli jadvalda «Ekspert tekshiruvi kerak» holatida; jadvaldagi ayrim ziddiyatlar (KPI chegaralari, rol nomlari) prototipda bitta variant bilan olingan.
- Ismlar va raqamlar shartli.
