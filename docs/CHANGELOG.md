# سجل التغييرات — أكاديمية الإحسان (Cloudflare)

## 2026-11-15 — V72: فتح التسجيل للجميع باعتماد، وبوابة التيسير العامة، وحماية المنصة الداخلية من الفهرسة

- **بوابة التيسير** (`deploy/taysir/`): موقع عام ساكن بلا حساب ولا نماذج ولا كوكيز، للتعريف بالأكاديمية ورسالتها وبرامجها وطرق الانضمام (طالب/شيخ–معلم/زائر–محسن) وطرق المساهمة، بروابط واضحة للأكاديمية (`a-ihsan.pages.dev/#signup=student|teacher|visitor`). SEO كامل: robots مفتوح + sitemap + canonical + OG/Twitter + JSON-LD، و`script-src 'self' 'unsafe-inline'`. **غير منشورة بعد** (قرار المالك + إنشاء مشروع Pages باسم `at-taysir` أو نطاق آخر).
- **أكاديمية الإحسان أصبحت منصة داخلية حصرًا**: `X-Robots-Tag: noindex,nofollow,noarchive` في `_headers` وجدول `robots.txt` (Disallow: /) + `sitemap.xml` فارغة + `<meta name="robots" content="noindex">` + `x-robots-tag` على استجابات الـ API + حذف canonical وJSON-LD من صفحاتها. التيسير تستضيف التعريف والفهرسة بدلًا عنها.
- **التسجيل والدخول متاحان للجميع** (`migrations/0009_signup_join_requests.sql`): دور `visitor` جديد في `users` (إعادة بناء الجدول مع الحفاظ على البيانات)؛ `join_requests` (`school_join` للطالب، `teacher_request` للشيخ/المعلم) — تبدأ دائمًا `pending`؛ الاعتماد بمسؤول مخوّل فقط (admin، أو director ضمن المدارس المسندة، أو teacher لمدرسة فيها فوج نشط يدرّسه) مع إسناد فوج إلزامي عند اعتماد طالب. **لا يُمنح أي دور إداري/إشرافي عند التسجيل** (أسرد البوابة لا تقبل `kind=admin|supervisor`). الطالب بلا فوج يُحجب عن مسار القرآن حتى الاعتماد؛ الزائر/المحسن يقرأ عن الأكاديمية ويساهم ويطلب الانضمام دون بيانات الطلاب (`canViewGroup` يرفض الزائر دائمًا، و`scopedRecords` يرجع فارغًا له).
- **واجهة الدخول**: تبويبات «تسجيل الدخول / إنشاء حساب»، اختيار «طالب · زائر/محسن · شيخ/معلم» ببطاقات، تحميل المدارس النشطة، ورسائل واضحة عند بقاء الطلب قيد الاعتماد. **لا تُحفظ هوية الدخول ولا كلمة المرور على الجهاز** (أُزيل ملء الهوية المسبق وتخزين `ihsan_last_identity` وتخزين `PasswordCredential`؛ autocomplete=off؛ «تذكّر» اختياري غير مفعّل افتراضيًا).
- **طلبات الانضمام للشيخ/المسؤول**: تبويب جديد «طلبات الانضمام» (`#join-requests`) للاعتماد/الرفض مع اختيار الفوج عند اعتماد الطالب، وعرض الملغاة/المرفوضة لاحقًا.
- **برنامج الثمانية أشهر معتمد رسميًا**: أرقام التثبيت 15/30/45/60 + خطط 4/8/12 ثُمنًا أسبوعيًا (`QURAN_THABIT_REFERENCE_STATUS="adopted"`)؛ الورد اليومي يبقى منفصلًا (`quran_reading`) عن الحفظ (`quran_entry`) والتثبيت؛ نقاط النشاط تُمنع التكرار في اليوم (`INSERT OR IGNORE` + سقف يومي).
- **الكاميرا مفعّلة للماسح**: `Permissions-Policy: camera=(self)` في `_headers` (كانت `camera=()` تحجب الماسح كليًا) مع بقاء البث محليًا وjsQR احتياطيًا.
- **اختبار الرحلة الكاملة** (`scripts/signup-journey-test.mjs`، 62 فحصًا محليًا — نجح): تسجيل → طلب انضمام قيد الاعتماد → اعتماد الشيخ بإسناد فوج → دخول الطالب لخطته → الشيخ يرى طلابه → مسح البطاقة (مسار API نفسه) ورفض السر الخطأ → تسجيل حضور + حفظ + تثبيت + ورد → منع نقاط مكررة → عزل مدرسة كامل (شيخ لا يرى طلب مدرسة أخرى) → المحسن يتحول طالبًا بالاعتماد → هلالة الخروج. **المتطلبات المحلية: مدرسة `qs-rahman` (seed) ومدرسة `qs-shuayb` مزروعة مرة واحدة + `DELETE FROM rate_limits WHERE bucket IN ('signup','join-request')` عند إعادة التشغيل لنفس القاعدة.**
- **غير مُختبر بصريًا/ميدانيًا**: الكاميرا الفعلية على هاتف حقيقي، الطباعة، مظهر التيسير/الأكاديمية على جوال حقيقي؛ المتصفح الداخلي كان غير متصل أثناء التنفيذ.
- **الإنتاج لم يُمسّ**: ترحيل `0009` غير مطبّق على D1 الإنتاجية (يحتاج نسخة احتياطية + موافقة + `--remote`)، والنشر يحتاج إذنًا؛ بوابة التيسير تحتاج إنشاء مشروع Pages منفصل.


## 2026-11-14 — منصة التيسير (قريبًا) + تعطيل حسابات المعلمين + كبير مشرفين عام + الأدعية والأذكار + حالات مراجعة المحتوى (V67، غير منشورة)

- **الوحدة الثانية (منهج الإحسان) صارت teaser فقط**: بطاقة «قريبًا · استعراض العناوين»، ونافذة `openIhsanTeaser` تعرض عناوين الأقسام (معرفة الله، صحبتها، القرآن، الحال المرتحل، السنة، الأدب) دون محتوى أو بيانات أو تسجيل أو نقاط. `IHSAN_PREVIEW_ONLY=true` blocks direct `S.mode="ihsan"` in `start()`, `switchModule()`, `page()`, `popstate` and `[data-open-ihsan]`; saved locked mode is cleared on startup. لا توجد صلاحيات أو مسارات خلفية للوحدة zweite.
- **حسابات المعلمين: تعطيل (soft deactivation)، لا حذف**. `DELETE /api/teachers/:id` (admin-only) blocks deletion while the teacher is assigned to any active group, then sets `users.active=0`, clears sessions, and logs `teacher_deactivate`. الواجهة تستخدم `data-delete-teacher` وتسمية «تعطيل الحساب».
- **كبير مشرفين عام (طالب واحد يشرف على جميع مشرفي الفرق)**. يُخزَّن إضافيًا في `academy_records` collection `student_chief_supervisors` (لا جدول جديد). Endpoints: `GET/POST /api/admin/chief-supervisors`, `DELETE /api/admin/chief-supervisors/:studentId`. قرارات مشرفي الفرق وطلبات النقل تُخوّل المدير العام **أو** كبير المشرفين العام **أو** كبير مشرف الفوج. `/api/student-teams` يُعيد `is_global_chief`, `chief_groups`, ويُمكّن محدد الفوج للطالب المعيّن.
- **الأدعية والأذكار امتداد للمحتوى (لا متجر متوازٍ)**: `CONTENT_KINDS` أضيف `duas: "dua_items"` و`adhkar: "adhkar_items"`؛ `CONTENT_STATUSES` = draft/needs_source/pending_review/approved/published/archived؛ `CONTENT_ATTRIBUTIONS` = نقل كما هو / نقل بتصرف يسير / تلخيص / شرح-صياغة / متعدد المصادر. `POST/PATCH /api/content` يقبل 6 حالات و`attribution` و`author`؛ النشر لا يزال يتطلب مصدرًا ومرجعًا.
- **زرع مسوّدات موثّقة**: `POST /api/admin/content/seed-duas` (admin-only) يُدرج 5 أدعية + 4 أذكار من مصادر منشورة، **دائمًا** بحالة `pending_review`، مع تخطي المكرر حسب العنوان. لا نشر تلقائي. `docs/DUAS-AND-ADHKAR-DRAFT.md` يوثّق النصوص والمصادر والنسب.
- **واجهة المحتوى**: 4 تبويبات (حديث، متون، أدعية، أذكار)، شارات حالة، نسبه/مؤلف، اختيار حالة من 6، وزر `#seed-duas`. تسميات الحالات بالعربية («بانتظار مراجعة الشيخ»).
- **اختبارات**: `test:mobile:local` 44/44 (2026-11-14) — يشمل تعطيل المعلم، seed الأدعية، تعيين/إلغاء كبير المشرفين العام، ونطاق عبر الأفواج. `npm run check` PASS. E2E كامل على قاعدة نظيفة (journey 93/93 → points 62/62 → quran 44/44 → backup 53/53 → role 0 → competitions 124/124 → mobile 44/44).
- **نسخة الأصول** `20261114-2`، وكاش PWA `v146-20261114-2`.
- **لم يُنشر هذا الإصدار**، ولا توجد ترحيلات إنتاجية جديدة. التحقق البصري بالمتصفح غير متاح (المتصفح غير متصل).

## 2026-11-14 — هوية المستخدم والوصول الإداري على الهاتف + سرعة إضافة الفوج (V66، غير منشورة)

- **سبب العطل:** كانت قاعدة CSS على الهاتف تُخفي `.workspace-user` عمدًا، فلم يعرف المستخدم من هو ولا دوره؛ وكانت أدوات الإدارة مربوطة بتفضيل `ihsan_admin_focus === "full"` غير المضبوط أصلًا، فيبقى المدير في «المهام اليومية» ولا يرى الأفواج والأدوات. هذا يفسر تقرير المالك: «لا أدري من أنا، ولا أستطيع التبديل، والامتيازات فارغة».
- الهوية الآن ظاهرة على كل المقاسات: زر `#identity-open` في رأس مساحة العمل يعرض الاسم والدور، ويُخفي النص الزائد بـellipsis بدل إخفاء العنصر.
- نافذة «حسابي» (`identitySheet`) تجمع في مكان واحد: الهوية والدور، التبديل بين المدرسة القرآنية ومنهج الإحسان، تبديل «كل أدوات الإدارة/المهام اليومية» للمدير، الإعدادات، وتسجيل الخروج — على الهاتف والحاسوب.
- أدوات الإدارة صارت ظاهرة افتراضيًا عبر `adminFocusIsFull()`؛ التفضيل المخزّن لم يعد شرطًا للوصول. زر الشريط الجانبي يستخدم المنطق نفسه.
- صفحة اختيار المنارة تعرض سطر هوية (الاسم والدور) فلا يضيع المستخدم بعد الدخول.
- إضافة الفوج لم تعد تستدعي `load()` الثقيل (أكثر من خمسة طلبات)؛ تُحدَّث `S.groups` من استجابة `POST /api/groups` مباشرة، ويُعطَّل زر الإرسال أثناء الطلب، ثم يُمرَّر إلى قائمة الأفواج. القياس المحلي: إنشاء الفوج ~56ms وقائمة الأفواج ~52ms بعد الإحماء.
- `scripts/mobile-smoke-test.mjs` (21 فحصًا) + `npm run test:mobile:local`، ومربوط بـ`npm run check` وCI بعد اختبارات المسابقات: يتحقق من الأصول المخدومة، وحراسات الهوية والتبديل، وتسجيل دخول المدير، وسرعة إنشاء الفوج، ثم يعطّل الفوج الذي أنشأه.
- نسخة الأصول `20261114-1`، وكاش PWA `v145-20261114-1`.
- **لم يُنشر هذا الإصدار**، ولا توجد ترحيلات إنتاجية جديدة. التحقق البصري بالمتصفح تعذّر لأن المتصفح غير متصل بالجلسة؛ الاعتماد على الأصول المخدومة وفحوص HTTP المحلية.
- ملاحظة: تقرير «الأستاذ أحمد والنموذج حذف» ما يزال غامضًا ولم يُتخذ فيه أي إجراء على بيانات المعلمين أو الطلاب.

## 2026-11-13 — رحلة الطالب + المتجر الصادق + مراجعة الخطط (V65، غير منشورة)

- رحلة بداية للطالب من ثمانية أسئلة، سؤال واحد في كل مرة، تُحفظ إجابتها فورًا في `academy_records` ضمن المجموعة `student_journey`؛ لا جدول جديد ولا محفظة جديدة، وتُستأنف الرحلة بعد الانقطاع من حيث توقفت.
- توصية خطة من ثلاثة خيارات (خفيفة/متوازنة/مكثفة) تُحسب من وقت الطالب المعلن لا من قدرته المالية، مع تقدير دقائق الحفظ والتثبيت والورد وأيام الأسبوع ويوم الاستدراك.
- تطبيق الخطة يعيد استخدام كاتبي مسار القرآن القائمين (`/api/quran/path` و`/api/quran/plan`) عبر دوال مشتركة، فلا تتكرر الجداول ولا تُنشأ خطة موازية.
- اعتماد الخطة يجري عبر `GET/POST /api/journey/review`: الشيخ يرى الإجابات الثماني وتكلفة الوقت ومدى ملاءمتها، ثم يعتمد أو يطلب تعديلًا بملاحظة إلزامية. قرار التعديل يعيد الرحلة إلى `in_progress`، ولا يوقف تعلم الطالب ولا يمسّ سجل حفظه.
- أرقام التثبيت المرجعية (60←نصف، 45←ثلاثة أثمان، 30←ربع، 15←ثمن) و5 أيام عمل تبقى **مقترحًا ينتظر اعتماد الشيخ**، لا شرطًا نهائيًا.
- المتجر يعرض للطالب المكافآت الحقيقية فقط من `store_items`: المتاح، والأقرب إلى رصيده، والمقفل برصيد غير كافٍ، والنافد، والذي بلغ حدّه. لا بذر تجريبي ولا منتجات وهمية، والإدارة وحدها تضيف المخزون وتعدّله وتخفيه.
- طلب الصرف يحجز رصيد المتجر فورًا، ورفض الطلب يعيد الرصيد والمخزون تلقائيًا، والتنفيذ نهائي؛ وتظهر شروط الصرف للطالب قبل الطلب.
- واجهة الشيخ: تبويب «خطط الطلاب» داخل صفحة القرآن بثلاث حالات (بانتظار الاعتماد/طلبات تعديل/معتمدة) مع ملخص الإجابات وقرار موثّق.
- `scripts/journey-store-test.mjs` (93 فحصًا) + `npm run test:journey:local`، ومربوط بـ`npm run check` وCI، مع حراسات ثابتة في `security-check.mjs` تمنع تكرار جداول الرحلة أو بذر متجر وهمي. يُشغَّل أولًا في CI لأنه يتحقق من متجر فارغ، ويُفشل نفسه برسالة صريحة إن وُجدت مكافآت مسبقة. تشمل الفحوص انتقال الطالب بين الأفواج وانتقال صلاحية اعتماد خطته إلى شيخ الفوج الجديد وحجبها عن شيخ الفوج القديم.
- نسخة الأصول 20261113-2، وكاش PWA v144-20261113-2، وسجل التطبيق V65.
- **لم يُنشر هذا الإصدار إلى الإنتاج**، ولم تُنفَّذ ترحيلات إنتاجية جديدة. ينتظر قرار المالك بكتالوج المتجر الحقيقي واعتماد أرقام التثبيت.

## 2026-11-13 — نظام المسابقات القرآنية والعلمية + نسخة كاملة v4

- هجرة إضافية `0006_competitions.sql`: 8 جداول (`competition_categories`, `competitions`, `competition_registrations`, `competition_judges`, `competition_scores`, `competition_results`, `competition_events`, `competition_reference_terms`)، مع بذور 4 فئات حزب (15/30/45/60) + عامة، ومصطلح مرجعي عام، وقاعدة نقاط `competition_award`. لا حذف لأي سجل مسابقات قديم في `academy_records`.
- إعادة استخدام كامل للمستخدمين والطلاب والأفواج والفرق و`point_events`؛ لا حسابات ولا محافظ ولا `xp`/`coins` جديدة.
- شروط استحقاق قابلة للتحرير لكل دورة: السن، فئة الحزب (مع تفضيل `student_profiles.memorized_hizb` والرجوع إلى `quran_paths.hifz_category`)، الرواية، وحد المشاركين.
- دورة حياة يفرضها الخادم: `draft → announced → registration → judging → results → honored → archived`، مع رفض القفز بين المراحل.
- تحكيم بشري: معايير قابلة للتخصيص تُطبَّع إلى 0–100، متوسط عدة محكمين، ولا تصحيح تلاوة آلي. تسجيل النتائج وتوليدها واعتمادها محكوم بالصلاحية، ولا تُمنح الجائزة إلا مرة واحدة بمفتاح `competition:<id>:<studentId>:award`.
- فصل صريح بين درجة المسابقة ورصيد `achievement` ورصيد `store`؛ الجوائز الافتراضية للمراكز الثلاثة فقط (100/50، 70/30، 50/20) وقابلة للتحرير، ونقاط المشاركة صفر افتراضيًا. المسابقات لا تمسّ سجلات الحضور أو الحفظ الأصلية.
- واجهة عربية RTL للطالب (متاح/مسابقاتي/التقويم) وللطاقم (إدارة/تحكيم/نتائج/تقويم/شروط)، مع نماذج إنشاء وتحرير المعايير والجوائز، وتسجيل الطالب، وتحويلات المراحل، وتعيين المحكمين.
- `student_profiles` يدعم `riwaya` و`memorized_hizb` (0–60) قراءةً وكتابةً.
- النسخة الاحتياطية الكاملة أصبحت `ihsan-academy-full-backup-v4` وتشمل الجداول الثمانية؛ الاستعادة تقبل `v2`/`v3`/`v4`.
- `scripts/competitions-test.mjs` (124 فحصًا) + `npm run test:competitions:local`، ومربوط بـ`npm run check` وCI؛ تحديث `backup-restore-test.mjs` إلى v4 (53 فحصًا) و`points-local-test.mjs` (62 فحصًا، يعيد قاعدة الحضور إلى 5/2).
- حراسات `security-check.mjs` تغطي الجداول الثمانية وبذرة `competition_award` وعدم حذف السجلات القديمة وعناصر واجهة المسابقات.
- نسخة الأصول 20261113-1، وكاش PWA v143-20261113-1، وسجل التطبيق V64.

## 2026-11-12 — نسخة كاملة v3 للاستعادة (published 20261112-3)

- إصلاح عطل حقيقي في النسخ الاحتياطي: التصدير الكامل والاستعادة كانا يستثنيان اقتصاد النقاط وجداول مسار القرآن الستة، أي فقدان بيانات صامت عند الاستعادة.
- التصدير الكامل أصبح `ihsan-academy-full-backup-v3` ويضم: `point_rules`, `point_events`, `store_items`, `store_redemptions`, `quran_paths`, `quran_daily`, `quran_pairs`, `quran_pair_sessions`, `quran_stations`, `quran_makeups`.
- الاستعادة تتحقق من كل صف (معرّفات، علاقات، قيم، تواريخ)، وتفحص تعارضات المفاتيح الفريدة قبل بدء الدمج وتُعيد 409.
- قبول ملفات v2 القديمة؛ الحقول الغائبة تُعامل كقوائم فارغة. حدّ الملف 16 ميغابايت.
- `scripts/backup-restore-test.mjs` (34 فحصًا) + `npm run test:backup:local`، ومربوط بـ`npm run check` وCI.
- حراسات ثابتة في `security-check.mjs` تمنع تراجع التصدير/الاستعادة عن جداول الاقتصاد والقرآن.
- نسخة الأصول 20261112-3، وكاش PWA v142-20261112-3.

## 2026-11-12 — 374a59e (published 20261112-2)

- مسار القرآن: صفحة طالب واحدة بأربعة تبويبات (اليومي، الخطة، الرفيق، المحطات) + بطاقة الرحلة والاستدراك.
- للطاقم: متابعة الفوج (حفظ/مراجعة جماعية) ووضع الإشراف (الخطط، الرفيق، المحطات، الاستدراك).
- هجرة `0005_quran_path.sql`: `quran_paths`, `quran_daily`, `quran_pairs`, `quran_pair_sessions`, `quran_stations`, `quran_makeups`، مع bootstrap وقت التشغيل.
- فئات المحفوظ 15/30/45/60 → تثبيت ثمن/ربع/ثلاثة أثمان/نصف حزب، وورد 1/2/4 أحزاب.
- الرفيق تسميع ثنائي بشري ببطاقة 50/20/15/15 وتقدير، والتجاوز اليدوي الكبير يتطلب سببًا.
- محطات الشيخ 15/30/45/60 بقرار للطاقم فقط، واستدراك يمنع الحفظ الجديد عند الحاجة.
- طباعة: بطاقة متابعة الطالب وبطاقة الرفيق (RTL → PDF).
- `quran-path-test.mjs` (44 فحصًا) داخل `npm run check` وCI؛ role-permission 0 failures.
- إصلاح كامن: `weekStart` في تقرير القرآن و`quranStreak` يستخدمان `addCalendarDays` بدل تمرير رقم إلى `academyDate`.
- نسخة الأصول 20261112-2، وكاش PWA v141-20261112-2.
- أسماء الخطط صارت وصفية (المكثفة / المتوسطة / المتدرجة) مع سطر توضيحي للحمل اليومي في نموذج التسجيل.
- خطط الحفظ الثلاث موثّقة في `docs/programs/QURAN-PATH-PLANS.md` (مقترح للاعتماد).

## 2026-11-11 — 6c963e2 (published 20261111-4)

- worldPage (`world`): 6 ranks, garden, daily quests, claim, reading streak.
- cardPage (`card`): bank-style student pass, serial, badges, history, print.
- guidePage (`guide`): daily sentence, 6 steps, live rules table, weights 25/35/30/10, ranks.
- wallet chips in workspace header.
- Ruby Noire theme + card cascade fix (`#ihsan-prayer-dialog` removed from background `:is()`).
- `/api/points/reading` GET/POST (one per student/day, dedupe via event key).
- `quran_reading` rule (5/2, max 1/day) in 0004 + runtime bootstrap.
- Asset version 20261111-4, SW cache v139-20261111-4.
- Default student tab = world.

## 2026-11-07 — d08ea92

- Economy: point_rules, point_events, store_items, store_redemptions (0004).
- Unified tasks, content (hadith/mutoon), competitions.
- points-local-test.mjs (69 checks).
- REBUILD-PLAN-2026-11.md.

## 2026-11-03 — caf1d72

- Asset cache bust (academy update #89).

## 2026-11-02 — origin/main

- Mark main as historical; point to Cloudflare source.

## Notes

- Legacy app (root server/, android-app/) is historical (V65), not the deployed app.
- APK out of scope (decision).

## 2026-11-15 — ترتيب هيكل المدرسة وخارطة الطريق + خصم الجزاءات + صور متجر + تقرير التدقيق (V68–V70، غير منشورة)

- **V68 — هيكل المدرسة وخارطة الطريق (لوحة المدير)**: تبويب `hierarchy` (هيكلي: المدير، المشرفون، المعلّمون، الفرق، كبير مشرفين، شاغر/مشغول) وتبويب `roadmap` (11 مرحلة). نسخة الأصول `20261114-3`، Service Worker `v147`. 44/44 smoke.
- **V69 — خصم جزاءات (admin-only)**: `POST /api/penalties` يخصم من رصيد المتجر فقط (`kind='store'`، `points=-N`)، يطلب سببًا ≥5 أحرف، لا يتجاوز الرصيد، ويُسجّل `points_penalty`. `GET /api/penalties?student_id=`. 62/62 points.
- **V70 — صور متجر** (additive): عمود nullable `store_items.image_url` (migration `0007_store_images.sql` + `ALTER TABLE` وقت التشغيل)، helper `storeItemImage`، حقل `image_url` في admin، CSS `.store-item-image`. 55/55 backup.
- **تقرير التدقيق** `docs/AUDIT-REPORT-2026-11-15.md`: تدقيق مستقل + ملحق + توصية AI (GitHub Copilot Agent + GitHub Actions) + مصفوفة accomplished/remaining.

## 2026-11-15 — بطاقات الطلاب بثلاثة رموز QR + عالم المهام + rate limiting + صرفة متساوية (V71، غير منشورة)

- **بطاقات الطلاب (V71)**: سجلات في `academy_records` collection `student_cards`، **معرّف البطاقة = معرّف الطالب** (بطاقة واحدة). 3 رموز مستقلة: `add_points` (90 يومًا)، `profile` (365 يومًا)، `login` (365 يومًا، مجهول). `/api/cards/resolve` قبل بوابة الدخول؛ QR الدخول يعيد name+username+`requires_password:true` فقط (لا جلسة). أكواد profile/add_points تتطلب جلسة ونطاق فوج. إصدار/إبطال/طباعة (single + bulk) مع تدقيق. `site/qr.js` مشفّر QR مستقل (byte mode، EC level M، versions 1–10، mask 0، SVG) — تحقّق jsQR 8/8.
- **عالم المهام (V71)**: 5 معالم story (من وقائع حقيقية، بلا نقاط)، 4 مهام جانبية يومية مستلمة عبر `awardPointsForEvent` (event_type=`mission_side`) مع dedupe يومي. السجلات في `student_missions`. قاعدة جديدة `rule-mission-side` (5 achievement / 2 store، حد 1/يوم) قابلة للتعديل.
- **Rate limiting (V71)**: جدول D1 `rate_limits` (migration `0008`) + lazy schema + graceful allow-if-missing. Buckets: `card-resolve:<kind>` (12 login / 40 others per 600s per بطاقة للدخول)، `store-redeem` (20/600s)، `mission-claim` (10/600s).
- **صرفة متجر متساوية (V71)**: معرّف صرفة حتمي `"rdm-"+sha256("redeem:"+student_id+":"+request_id).slice(0,32)`؛ طلب مكرر يعيد الصرف الموجود دون خصم مخزون مزدوج.
- **واجهة (V71)**: تبويب `cards` (staff)، `staffCardsPage`، `cardQrSheet`/QR figures، `readScanHash`/`processPendingScan`، `scanNotice` في `auth()`، `worldPage` missions UI، print datasets `data-print="card"/"cards"`. CSS: `.card-qr*`, `.mission-*`, `.scan-notice`, reduced-motion، `@media print` for `body[data-print]`.
- **أصول**: نسخة `20261115-1` في index/about/privacy، `/qr.js` في index + SW `v148-20261115-1`. `public/` مُعاد توليده. 51/51 cards-missions. `npm run check` PASS.
