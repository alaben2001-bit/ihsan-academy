'use strict';

/*
 * Seed pack for the student-development curriculum.
 * Idempotent: never overwrites user-authored content; only adds missing records
 * marked with a stable seed_key. The teacher/admin can edit or archive seeded
 * lessons and questions through the existing interfaces.
 */
const SUBJECTS = [
  { key:'quran', name:'القرآن الكريم وعلومه', category:'القرآن وعلومه', learning_mode:'memorize', required:true, study_method:'قراءة صحيحة، فهم إجمالي، حفظ متدرج، ثم مراجعة وتطبيق.' },
  { key:'hadith', name:'السنة النبوية والحديث', category:'السنة والحديث', learning_mode:'memorize', required:true, study_method:'حفظ النص المعتمد، فهم المعنى، معرفة المصدر، ثم العمل به.' },
  { key:'aqidah', name:'العقيدة والتوحيد', category:'العقيدة', learning_mode:'understand', required:true, study_method:'تعلّم الأصل بدليله، ثم شرحه بكلمات واضحة، والرجوع للشيخ عند الإشكال.' },
  { key:'fiqh', name:'الفقه والعبادات', category:'الفقه', learning_mode:'apply', required:true, study_method:'فهم الحكم وشروط العبادة عمليًا، مع الرجوع للشيخ في المسائل التفصيلية.' },
  { key:'seerah', name:'السيرة والشمائل', category:'السيرة والتاريخ', learning_mode:'understand', required:true, study_method:'قراءة قصصية موثقة، ترتيب الأحداث، واستخراج الخلق والعمل.' },
  { key:'arabic', name:'اللغة العربية ومهارات التعبير', category:'اللغة العربية', learning_mode:'apply', required:true, study_method:'قراءة، استخراج المفردات، تلخيص الفكرة، ثم التعبير عنها شفهيًا وكتابيًا.' },
  { key:'tazkiyah', name:'الأخلاق وتزكية النفس', category:'الأخلاق والتزكية', learning_mode:'apply', required:true, study_method:'فهم الخلق، ملاحظة النفس برفق، والتدرّب على عمل صغير ثابت.' },
  { key:'learning', name:'مهارات التعلم وتنظيم الوقت', category:'مهارات الحياة', learning_mode:'apply', required:true, study_method:'هدف صغير، استرجاع من الذاكرة، مراجعة متباعدة، وقياس التقدم دون إنهاك.' },
  { key:'thinking', name:'التفكير والتحقق من المعلومات', category:'التفكير والإعلام', learning_mode:'discussion', required:true, study_method:'توقف، تحقق من المصدر، فرّق بين الخبر والرأي، ثم ناقش بأدب.' },
  { key:'health', name:'الصحة والعادات الرقمية', category:'الصحة والعادات', learning_mode:'apply', required:false, study_method:'عادات واقعية متدرجة للنوم والحركة والراحة وتقليل التشتت.' },
  { key:'family', name:'الأسرة وآداب التعامل', category:'الآداب والعلاقات', learning_mode:'apply', required:true, study_method:'مواقف حياتية وتمثيل عملي للكلمة الطيبة والإنصات والإحسان.' },
  { key:'duaa', name:'الدعاء والذكر', category:'الذكر والدعاء', learning_mode:'memorize', required:true, study_method:'حفظ ذكر صحيح، فهم معناه، معرفة وقته ومصدره، والمحافظة عليه.' }
];

const LESSONS = [
  {key:'quran-taqwa',subject:'quran',title:'ميزان التفاضل: التقوى لا المظاهر',description:'فهم معنى التقوى وأثرها في نظرة المسلم إلى الناس.',learning_mode:'understand',study_method:'اقرأ الآية، اشرح معناها الإجمالي، ثم اذكر سلوكًا يدل على التقوى.',content:{
    opening:'قد ينجذب الناس إلى المال أو الشكل أو النسب، لكن ميزان الكرامة عند الله تعالى مختلف.',
    ayahs:[{text:'إِنَّ أَكْرَمَكُمْ عِنْدَ اللَّهِ أَتْقَاكُمْ',reference:'سورة الحجرات، الآية 13'}],
    hadiths:[],story:'تخيّل طالبين: أحدهما مشهور لكنه يؤذي زملاءه، والآخر هادئ صادق يعينهم. لا تحكم على قيمة الإنسان بالمظهر أو الشهرة.',
    explanation:'التقوى هي أن يجعل المسلم بينه وبين سخط الله وقاية بطاعته واجتناب معصيته. لا تعني ادعاء الكمال ولا احتقار الناس، بل مراقبة النفس والتواضع وحسن العمل.',
    examples:['ألا تسخر من زميل بسبب مظهره أو مستواه.','أن تعترف بخطئك ولو لم يرك أحد.','أن تحسن العمل طلبًا لرضا الله لا للمدح فقط.'],
    reflection_questions:['ما حكمٌ متسرع قد أطلقه على شخص بسبب مظهره؟','ما عمل خفي أستطيع إصلاحه هذا الأسبوع؟'],
    action:'اختر موقفًا واحدًا تتعامل فيه مع شخص بإنصاف واحترام، ثم راجع نفسك آخر اليوم.',
    memorize:'احفظ موضع الاستدلال من سورة الحجرات: الآية 13، مع مراجعة الآية كاملة من المصحف.',
    review:'اشرح الآية بكلماتك، ثم اذكر مثالًا على ترك التفاخر ومثالًا على حسن الخلق.',
    source_notes:'النص القرآني: سورة الحجرات 49:13. يراجع الطالب الآية كاملة من المصحف المعتمد.',
    source_status:'verified'
  }},
  {key:'quran-fatiha',subject:'quran',title:'الفاتحة: الثناء والاستعانة والهداية',description:'التعرّف على المعاني الكبرى لسورة الفاتحة دون تعقيد.',learning_mode:'understand',study_method:'استمع لقراءة صحيحة، اقرأ المعنى الإجمالي، ثم اشرح انتقال السورة من الثناء إلى الدعاء.',content:{
    opening:'نقرأ الفاتحة في كل ركعة؛ وتكرارها فرصة لتجديد فهمنا لا لمجرد تحريك اللسان.',
    ayahs:[{text:'إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ',reference:'سورة الفاتحة، الآية 5'},{text:'اهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ',reference:'سورة الفاتحة، الآية 6'}],
    hadiths:[],story:'قبل مهمة صعبة، يجمع الطالب بين بذل السبب وطلب العون من الله؛ فلا يتكل على نفسه وحدها ولا يترك العمل بحجة التوكل.',
    explanation:'تعلّمنا الفاتحة الثناء على الله، وإفراده بالعبادة والاستعانة، وسؤاله الهداية. وفهم المعنى يعين على حضور القلب في الصلاة.',
    examples:['أستعين بالله ثم أراجع درسي.','أسأل الهداية وأحرص على معرفة الحق والعمل به.','أقرأ الصلاة بهدوء وأحاول فهم ما أقول.'],
    reflection_questions:['ما الفرق بين طلب العون من الله وترك الأسباب؟','كيف أجعل قراءتي للفاتحة أهدأ وأكثر فهمًا؟'],
    action:'في الصلاة القادمة، قف لحظة قبلها لتتذكر أنك تسأل الله الهداية فعلًا.',
    memorize:'راجع سورة الفاتحة كاملة من المصحف، مع تصحيح المخارج عند الشيخ.',
    review:'اذكر المعاني الثلاثة: الثناء، العبادة والاستعانة، وطلب الهداية.',
    source_notes:'الآيات من سورة الفاتحة. تفاصيل التفسير تُراجع في تفسير موثوق وتحت إشراف المعلم.',
    source_status:'verified'
  }},
  {key:'hadith-intention',subject:'hadith',title:'النية: لماذا أفعل هذا العمل؟',description:'تمييز قصد العبادة والعمل الصالح عن طلب السمعة وحدها.',learning_mode:'memorize',study_method:'احفظ الحديث من مصدره، افهم أثر النية، وطبّق ذلك دون ترك العمل أو الوسوسة في النيات.',content:{
    opening:'قد يقوم شخصان بالعمل نفسه، لكن المقصد الذي في القلب يغيّر معنى العمل وأجره.',
    ayahs:[],hadiths:[{text:'إنما الأعمال بالنيات، وإنما لكل امرئ ما نوى',reference:'صحيح البخاري، حديث 1؛ وصحيح مسلم، حديث 1907'}],
    story:'طالب يساعد زميله: مرة ليُمدح أمام الناس، ومرة ابتغاء الخير. المطلوب أن يتعلم تصحيح قصده، لا أن يترك المساعدة خوفًا من فساد النية.',
    explanation:'النية قصد القلب، وهي أساس في قبول الأعمال التعبدية. لا يطلب من المسلم تفتيش قلبه بقلق متكرر؛ بل يستحضر القصد الصالح ويمضي في الخير.',
    examples:['أتعلم لأرفع الجهل عن نفسي وأنفع غيري.','أساعد في البيت طلبًا للأجر وبرًا بأهلي.','إذا مدحني أحد لا أترك العمل الصالح ولا أجعله للمدح.'],
    reflection_questions:['ما نية صالحة أستطيع استحضارها قبل الدراسة؟','كيف أفرّق بين إصلاح النية والوسوسة فيها؟'],
    action:'قبل درس واحد اليوم، استحضر نية صالحة في جملة قصيرة ثم ابدأ مباشرة.',
    memorize:'احفظ صدر الحديث: «إنما الأعمال بالنيات، وإنما لكل امرئ ما نوى».',
    review:'اذكر مثالين لعمل يومي يمكن أن تؤجر عليهما بالنية الصالحة.',
    source_notes:'الحديث مشهور في الصحيحين؛ راجع اللفظ والسياق في نسخة موثوقة.',
    source_status:'verified'
  }},
  {key:'hadith-kindness',subject:'hadith',title:'الرفق قوة تضبطها الحكمة',description:'فهم أثر الرفق في النصيحة والتعليم والعلاقات.',learning_mode:'apply',study_method:'افهم الحديث، وقارن بين نصيحة جارحة ونصيحة واضحة رحيمة.',content:{
    opening:'ليس كل كلام قوي مؤثرًا؛ قد تصل الحقيقة بالرفق إلى القلب أكثر من الصراخ.',
    ayahs:[],hadiths:[{text:'إن الرفق لا يكون في شيء إلا زانه، ولا ينزع من شيء إلا شانه',reference:'صحيح مسلم، حديث 2594'}],
    story:'أخطأ طالب في التسميع. يستطيع الشيخ أن يفضحه أمام زملائه، أو يصحح له الخطأ بوضوح ويعطيه فرصة للإعادة. الرفق لا يعني ترك التصحيح.',
    explanation:'الرفق هو لين مناسب لا يلغي الحق ولا يبرر الظلم. يجمع المربي بين وضوح الحكم، واحترام الشخص، واختيار الأسلوب والوقت.',
    examples:['أقول: «هذه الإجابة تحتاج مراجعة» بدل «أنت لا تفهم».','أسمع الطرف الآخر قبل الرد.','أضع حدًا للسلوك المؤذي دون إهانة صاحبه.'],
    reflection_questions:['متى خلطت بين الحزم والقسوة؟','ما عبارة أستطيع استبدالها اليوم بعبارة أرفق؟'],
    action:'قدّم نصيحة واحدة بعبارة واضحة ومحترمة، ثم راقب أثرها.',
    memorize:'احفظ الحديث من صحيح مسلم وراجعه على الشيخ.',
    review:'اذكر موقفًا يحتاج إلى رفق، وموقفًا يحتاج إلى حزم عادل.',
    source_notes:'صحيح مسلم، كتاب البر والصلة والآداب، حديث 2594.',
    source_status:'verified'
  }},
  {key:'aqidah-worship',subject:'aqidah',title:'لماذا خُلق الإنسان؟',description:'فهم العبادة بمعناها الواسع وصلتها بالحياة اليومية.',learning_mode:'understand',study_method:'اقرأ الآية، تعرّف المعنى الإجمالي للعبادة، ثم صنّف أعمالًا من يومك.',content:{
    opening:'العبادة ليست محصورة في لحظات محددة؛ بل تشمل ما يحبه الله ويرضاه من الأقوال والأعمال الظاهرة والباطنة.',
    ayahs:[{text:'وَمَا خَلَقْتُ الْجِنَّ وَالْإِنْسَ إِلَّا لِيَعْبُدُونِ',reference:'سورة الذاريات، الآية 56'}],
    hadiths:[],story:'طالب يدرس بإتقان، ويبر والديه، ويحفظ لسانه، ويصلي؛ يتعلم أن حياته كلها يمكن أن تتجه إلى طاعة الله مع صحة النية ومشروعية العمل.',
    explanation:'أصل العبادة إفراد الله تعالى بها، وتتسع لتشمل الأعمال المشروعة إذا صحت النية. ليست كل رغبة عبادة، ولا يكفي حسن القصد لفعل ما هو محرم.',
    examples:['الصلاة عبادة.','الدراسة النافعة قد تكون قربة مع النية الصالحة.','بر الوالدين وحفظ الأمانة من أعمال الخير.'],
    reflection_questions:['ما عمل مباح أستطيع تحويله إلى عمل صالح بالنية؟','لماذا لا يكفي حسن القصد إذا كان الفعل نفسه غير مشروع؟'],
    action:'اختر عملًا يوميًا نافعًا، واستحضر نية صالحة مع إتقانه.',
    memorize:'راجع الآية من سورة الذاريات 56.',
    review:'اشرح كيف يمكن أن يكون العمل اليومي نافعًا ومشروعًا وذا نية صالحة.',
    source_notes:'الآية: سورة الذاريات 51:56. المعاني التفصيلية تراجع مع المعلم.',
    source_status:'verified'
  }},
  {key:'fiqh-prayer',subject:'fiqh',title:'الصلاة: علمٌ وعملٌ ومراجعة',description:'طريقة عملية لتعلم أحكام الصلاة دون تخمين أو إحراج.',learning_mode:'apply',study_method:'تعلم الحكم من الشيخ أو مصدر معتمد، ثم طبّقه عمليًا ودوّن السؤال الذي لم يتضح.',content:{
    opening:'العبادة تحتاج علمًا صحيحًا وتطبيقًا هادئًا؛ والخطأ الذي نتعلم تصحيحه ليس سببًا لليأس.',
    ayahs:[{text:'إِنَّ الصَّلَاةَ كَانَتْ عَلَى الْمُؤْمِنِينَ كِتَابًا مَوْقُوتًا',reference:'سورة النساء، الآية 103'}],
    hadiths:[],story:'لاحظ طالب أنه يسرع في الصلاة. بدل أن يخمّن الأحكام، يسأل الشيخ عن الطمأنينة والصفة الصحيحة، ثم يتدرب خطوة خطوة.',
    explanation:'يتعلم المسلم شروط الصلاة وأركانها وواجباتها وسننها من أهل العلم، مع مراعاة ما يدرّسه شيخه من أحكام المذهب أو المنهج المعتمد. لا تُحسم المسائل الخلافية من سؤال قصير.',
    examples:['أسأل عن الخطأ الذي لا أعرف حكمه.','أتعلم الوضوء والصلاة بالمشاهدة والتطبيق.','أراجع ما تعلمته دون تهويل أو استهزاء.'],
    reflection_questions:['ما مسألة في الصلاة أحتاج أن أسأل عنها الشيخ؟','كيف أتعامل مع خطأ تعلمته دون يأس؟'],
    action:'راجع صفة الوضوء أو الصلاة مع الشيخ، واكتب سؤالًا واحدًا واضحًا إن بقي إشكال.',
    memorize:'احفظ موضع الاستدلال: سورة النساء، الآية 103.',
    review:'اذكر مصدرًا موثوقًا تتعلم منه صفة الصلاة، ولماذا لا تعتمد على التخمين.',
    source_notes:'الآية: سورة النساء 4:103. هذا درس تمهيدي وليس فتوى تفصيلية.',
    source_status:'verified'
  }},
  {key:'seerah-character',subject:'seerah',title:'الخلق الحسن من دلائل كمال التعلم',description:'ربط العلم بالأدب والرحمة والصدق.',learning_mode:'apply',study_method:'اقرأ النص، ناقش موقفًا، ثم اختر سلوكًا عمليًا للتطبيق.',content:{
    opening:'ليس المقصود من العلم أن يكثر كلام الإنسان فقط، بل أن يهديه إلى الحق ويحسن أثره في الناس.',
    ayahs:[{text:'وَإِنَّكَ لَعَلَىٰ خُلُقٍ عَظِيمٍ',reference:'سورة القلم، الآية 4'}],
    hadiths:[],story:'قد يعرف الطالب جوابًا صحيحًا، لكنه يسخر ممن أخطأ. هنا يحتاج إلى تعلم أدب العلم كما تعلم المعلومة.',
    explanation:'أخلاق النبي ﷺ هي قدوة للمسلم. ومن ثمرات العلم الصدق والتواضع والصبر والرحمة، مع التزام الحق وعدم مداهنة الخطأ.',
    examples:['أصحح المعلومة دون إذلال صاحبها.','أفي بوعدي وأعتذر إذا أخطأت.','أحترم وقت المعلم وزملائي.'],
    reflection_questions:['أي خلق يحتاج مني تدريبًا هذا الأسبوع؟','كيف أظهر احترام العلم في تصرفي؟'],
    action:'اختر خلقًا واحدًا، ودوّن موقفًا واحدًا طبّقته فيه.',
    memorize:'راجع الآية من سورة القلم 4.',
    review:'اذكر فرقًا بين معرفة الخلق الحسن وتطبيقه.',
    source_notes:'الآية: سورة القلم 68:4. قصص السيرة التفصيلية تُضاف بعد مراجعة مصادرها.',
    source_status:'verified'
  }},
  {key:'arabic-summary',subject:'arabic',title:'كيف تلخّص درسًا دون أن تفقد فكرته؟',description:'تدريب الطالب على الفهم والتعبير بدل النسخ الطويل.',learning_mode:'apply',study_method:'اقرأ فقرة، استخرج فكرتها، اكتب ثلاث جمل من صياغتك، ثم قارنها بالأصل.',content:{
    opening:'التلخيص ليس حذف كلمات عشوائيًا؛ بل معرفة ما لا يستقيم المعنى بدونه.',
    ayahs:[],hadiths:[],story:'قرأ طالب صفحة كاملة، لكنه لم يستطع شرحها. عندما حدد الفكرة الرئيسة وثلاث نقاط مساندة، صار قادرًا على عرضها.',
    explanation:'ابدأ بسؤال: ما الفكرة الرئيسة؟ ثم استخرج نقطتين أو ثلاثًا تدعمها. اكتب بأسلوبك، ولا تنسب إلى الكاتب ما لم يقله.',
    examples:['عنوان الدرس في جملة.','ثلاث نقاط رئيسة دون تكرار.','سؤال بقي غير واضح يحتاج إلى مراجعة.'],
    reflection_questions:['هل أستطيع شرح ما قرأت دون النظر إلى النص؟','ما الفرق بين النسخ والفهم؟'],
    action:'لخّص هذا الدرس في ثلاث جمل، ثم اشرحه شفهيًا خلال دقيقة.',
    memorize:'لا يلزم حفظ نص التلخيص؛ المقصود امتلاك الفكرة والمفردات.',
    review:'قارن تلخيصك بالأصل: هل حفظت الفكرة؟ هل أضفت معنى غير موجود؟',
    source_notes:'محتوى مهاري تعليمي من إعداد الأكاديمية، لا يتضمن نقلًا شرعيًا.',
    source_status:'draft'
  }},
  {key:'tazkiyah-repentance',subject:'tazkiyah',title:'التوبة: رجوع وأمل وعمل',description:'فهم التوبة بوصفها رجوعًا إلى الله دون قنوط أو تسويف.',learning_mode:'understand',study_method:'اقرأ الآية، تعرف شروط التوبة إجمالًا مع الشيخ، وضع خطوة عملية للإصلاح.',content:{
    opening:'قد يخطئ الإنسان، لكن الخطأ لا يعني أن يغلق باب الإصلاح على نفسه.',
    ayahs:[{text:'لَا تَقْنَطُوا مِنْ رَحْمَةِ اللَّهِ',reference:'سورة الزمر، الآية 53'}],
    hadiths:[],story:'طالب ترك عادة سيئة ثم عاد إليها. لا يبررها ولا يكره نفسه؛ بل يتوب، ويعرف السبب، ويأخذ بالأسباب التي تعينه على الثبات.',
    explanation:'التوبة الصادقة تتضمن الإقلاع عن الذنب والندم والعزم على عدم العودة، ورد الحقوق إلى أهلها إذا تعلق الذنب بحقوق الناس. إذا تعثر المرء عاد إلى التوبة ولم يستسلم للقنوط.',
    examples:['أوقف سببًا يقودني إلى الخطأ.','أعتذر وأرد الحق إذا ظلمت أحدًا.','أطلب مساعدة موثوقة عند تكرر المشكلة.'],
    reflection_questions:['ما خطوة إصلاح صغيرة أقدر عليها اليوم؟','كيف أفرق بين الندم النافع واحتقار النفس؟'],
    action:'حدد سببًا واحدًا يضعفك وخطوة عملية لتقليله، واستعن بالله.',
    memorize:'راجع الآية كاملة من سورة الزمر 53.',
    review:'اذكر شروط التوبة إجمالًا، ومتى يلزم رد الحقوق.',
    source_notes:'الآية: سورة الزمر 39:53. تفاصيل التوبة وحقوق العباد تُراجع مع أهل العلم.',
    source_status:'verified'
  }},
  {key:'learning-spaced-review',subject:'learning',title:'كيف تثبّت ما تتعلمه؟',description:'الاسترجاع من الذاكرة والمراجعة المتباعدة بدل إعادة القراءة فقط.',learning_mode:'apply',study_method:'اقرأ جزءًا صغيرًا، أغلق المصدر، استرجع ما فهمته، ثم راجع الخطأ وكرر بعد فاصل.',content:{
    opening:'الشعور بأن المعلومة مألوفة لا يعني دائمًا أنك تستطيع استرجاعها وقت الحاجة.',
    ayahs:[],hadiths:[],story:'طالب يقرأ الصفحة خمس مرات وهو ينظر إليها، ثم يعجز عن شرحها. جرّب إغلاق الكتاب وشرح الفكرة، فعرف مواضع النقص.',
    explanation:'قسّم المادة، واسترجعها من الذاكرة، وصحح أخطاءك، ثم راجعها على فترات. في الحفظ القرآني اتبع خطة الشيخ ولا تجعل السرعة على حساب صحة التلاوة.',
    examples:['بعد القراءة اكتب ما تتذكره.','راجع بعد ساعات ثم في اليوم التالي وفق خطة مناسبة.','ضع علامة على موضع الخطأ لتعود إليه.'],
    reflection_questions:['هل أقيس فهمي بالاسترجاع أم بعدد مرات القراءة؟','ما وقت مراجعة واقعي أستطيع الالتزام به؟'],
    action:'طبّق جلسة 10 دقائق: تعلّم، أغلق المصدر، استرجع، صحح، ثم حدد موعد مراجعة.',
    memorize:'اكتب القاعدة: تعلّم قليلًا، استرجع، صحح، راجع لاحقًا.',
    review:'اشرح خطوات المراجعة المتباعدة وطبّقها على درس واحد.',
    source_notes:'محتوى مهاري تعليمي؛ يراعى تخصيص طريقة الحفظ حسب عمر الطالب وطبيعة المادة.',
    source_status:'draft'
  }},
  {key:'thinking-verify',subject:'thinking',title:'قبل أن تنشر الخبر: تحقّق',description:'تعلم التوقف وفحص المصدر قبل تصديق الخبر أو نشره.',learning_mode:'discussion',study_method:'افصل بين الادعاء والدليل، افحص المصدر والتاريخ والسياق، ثم قرر ما إذا كان النشر مناسبًا.',content:{
    opening:'سرعة وصول الخبر لا تعني صحة الخبر، وكثرة من يشاركونه لا تجعله موثوقًا.',
    ayahs:[{text:'فَتَبَيَّنُوا',reference:'سورة الحجرات، الآية 6'}],
    hadiths:[],story:'وصلت رسالة تزعم أن شخصًا فعل أمرًا سيئًا. نشرها الطالب قبل التحقق، ثم تبين أنها مبتورة. الضرر لا يزول بمجرد حذف الرسالة.',
    explanation:'اسأل: من المصدر الأصلي؟ متى نُشر؟ هل يعرض دليلًا؟ هل نقلت العبارة من سياقها؟ وهل يؤدي نشرها إلى ظلم أو كشف خصوصية؟ إذا لم تعرف، فتوقف واسأل مختصًا.',
    examples:['أفتح المصدر الأصلي بدل الاكتفاء بصورة مقتطعة.','أميّز الرأي الشخصي من الخبر المدعوم بدليل.','لا أعيد نشر ما يمس أعراض الناس أو خصوصيتهم.'],
    reflection_questions:['ما علامة تجعلني أتوقف قبل مشاركة خبر؟','كيف أصحح خطأ نشرته؟'],
    action:'تحقق اليوم من معلومة واحدة قبل مشاركتها، أو اختر ألا تنشرها إن لم تثبت.',
    memorize:'تذكر قاعدة: لا أصدّق ولا أنشر حتى أتحقق من المصدر والسياق.',
    review:'اذكر ثلاث خطوات للتحقق، ومثالًا على ضرر نشر خبر غير ثابت.',
    source_notes:'الآية: سورة الحجرات 49:6. تطبق قواعد التحقق أيضًا على الأخبار الرقمية المعاصرة.',
    source_status:'verified'
  }},
  {key:'health-digital',subject:'health',title:'الهاتف أداة: اجعل له وقتًا وحدودًا',description:'بناء عادات رقمية تخدم الدراسة والعبادة والنوم والعلاقات.',learning_mode:'apply',study_method:'راقب عادة واحدة دون لوم، ثم ضع حدًا واضحًا وبديلًا نافعًا.',content:{
    opening:'المشكلة ليست في وجود الهاتف وحده، بل في أن يبتلع وقتًا كان ينبغي أن يذهب للنوم أو التعلم أو الأسرة.',
    ayahs:[],hadiths:[],story:'يستيقظ طالب ويفتح المقاطع القصيرة، فيتأخر عن خطته. جرّب أن يترك الهاتف خارج مكان النوم ويبدأ يومه بالماء والصلاة وخطوة صغيرة.',
    explanation:'ضع وقتًا محددًا للاستخدام، وأوقف التنبيهات غير الضرورية، وأبعد الهاتف عن جلسة الحفظ والنوم. لا تجعل التعثر سببًا لجلد الذات؛ عد إلى الخطة تدريجيًا.',
    examples:['الهاتف خارج مكان النوم.','جلسة دراسة قصيرة دون إشعارات.','وقت ترفيه محدد بعد إتمام الأولويات.'],
    reflection_questions:['ما أكثر وقت يضيع مني على الهاتف؟','ما بديل واقعي أستطيع فعله عندما أريد فتحه بلا هدف؟'],
    action:'اختر حدًا واحدًا لمدة أسبوع، مثل عدم فتح المقاطع قبل إنجاز أول مهمة.',
    memorize:'لا يوجد نص للحفظ؛ المقصود تجربة عادة عملية وقياس أثرها.',
    review:'سجّل ما تغير في وقتك وتركيزك بعد أسبوع دون مبالغة أو لوم.',
    source_notes:'محتوى توعوي عام؛ لا يُستخدم للتشخيص الطبي.',
    source_status:'draft'
  }},
  {key:'family-parents',subject:'family',title:'الإحسان إلى الوالدين في الكلام والعمل',description:'تحويل البر إلى سلوك يومي واضح مع حفظ الأدب.',learning_mode:'apply',study_method:'اقرأ الآية، ناقش مواقف واقعية، ثم اختر عمل بر ممكنًا.',content:{
    opening:'قد يكون البر في كلمة هادئة أو خدمة صغيرة أو إنصات صادق، وليس في الكلام الكبير فقط.',
    ayahs:[{text:'وَبِالْوَالِدَيْنِ إِحْسَانًا',reference:'سورة الإسراء، الآية 23'}],
    hadiths:[],story:'طلب أحد الوالدين مساعدة والابن منشغل. يستطيع أن يجيب باحترام، ويوضح متى ينتهي من عمله، بدل الصراخ أو التجاهل.',
    explanation:'الإحسان يشمل القول الكريم والخدمة والدعاء. وإذا اختلف الإنسان مع والديه في أمر، فيحفظ الأدب ويطلب المشورة في كيفية التصرف دون ظلم أو إساءة.',
    examples:['أجيب بكلمة محترمة.','أساعد في عمل منزلي دون انتظار طلب متكرر.','أعتذر عن التقصير وأحاول إصلاحه.'],
    reflection_questions:['ما عمل بر بسيط أستطيع فعله اليوم؟','كيف أعبر عن اختلاف بأدب؟'],
    action:'قم بعمل نافع في البيت اليوم، ثم اشكر والديك على ما تستطيع.',
    memorize:'راجع موضع الآية من سورة الإسراء 23.',
    review:'اذكر ثلاثة أمثلة للإحسان، وماذا تفعل إذا لم تعرف حكم موقف صعب؟',
    source_notes:'الآية: سورة الإسراء 17:23. الحالات الأسرية المعقدة تحتاج إلى نصيحة موثوقة مناسبة.',
    source_status:'verified'
  }},
  {key:'duaa-meaning',subject:'duaa',title:'الدعاء: عبادة وفهم وافتقار',description:'تعلم الدعاء مع فهم معناه وحسن الأدب فيه.',learning_mode:'understand',study_method:'اختر دعاءً ثابتًا، تحقق من مصدره، افهم ألفاظه، وتعلم موضعه.',content:{
    opening:'الدعاء ليس كلمات تقال بلا فهم؛ إنه سؤال لله تعالى وعبادة وافتقار إليه.',
    ayahs:[{text:'ادْعُونِي أَسْتَجِبْ لَكُمْ',reference:'سورة غافر، الآية 60'}],
    hadiths:[],story:'يدعو طالب بالتوفيق، ثم يأخذ بأسباب الدراسة، ويقبل أن الإجابة قد تأتي على وجه لا يعرف حكمته في الحال.',
    explanation:'يتعلم المسلم الأدعية الثابتة من القرآن والسنة، ويفهم معانيها، ويجمع بين الدعاء والعمل. لا ينسب دعاءً إلى النبي ﷺ حتى يتحقق من صحته.',
    examples:['أتعلم دعاءً ثابتًا وأفهمه.','أدعو ثم أعمل بالأسباب المشروعة.','أسأل الشيخ عن لفظ أو نسبة غير متأكد منها.'],
    reflection_questions:['ما دعاء ثابت أريد أن أفهم معناه؟','كيف أجمع بين الدعاء والعمل؟'],
    action:'اختر دعاءً من مصدر موثوق، واكتب معناه ومصدره ووقت قوله إن كان له وقت مخصوص.',
    memorize:'احفظ دعاءً ثابتًا بعد التحقق من لفظه ومصدره.',
    review:'ما الفرق بين دعاء ثابت ودعاء شائع لا تعرف مصدره؟',
    source_notes:'الآية: سورة غافر 40:60. يجب التحقق من ألفاظ الأدعية المنقولة قبل نشرها.',
    source_status:'verified'
  }}
];

const QUESTIONS = [
  {key:'quran-taqwa-1',lesson:'quran-taqwa',type:'single_choice',title:'بحسب سورة الحجرات، ما ميزان الكرامة عند الله تعالى؟',options:['المال وكثرة الممتلكات','النسب وحده','التقوى','الشهرة بين الناس'],correct_answer:'التقوى',explanation:'قال تعالى: «إن أكرمكم عند الله أتقاكم» (الحجرات: 13).',points:2},
  {key:'quran-taqwa-2',lesson:'quran-taqwa',type:'true_false',title:'يجوز الحكم على قيمة الإنسان من مظهره وحده.',options:[],correct_answer:'false',explanation:'المظهر ليس ميزان التفاضل عند الله، وعلى المسلم ترك السخرية والتفاخر.',points:1},
  {key:'quran-taqwa-3',lesson:'quran-taqwa',type:'single_choice',title:'أي عمل يدل على التواضع؟',options:['السخرية من المخطئ','الاعتراف بالخطأ وإصلاحه','التفاخر على الزملاء','رفض النصيحة دائمًا'],correct_answer:'الاعتراف بالخطأ وإصلاحه',explanation:'التواضع يظهر في قبول الحق وإصلاح الخطأ.',points:2},
  {key:'quran-fatiha-1',lesson:'quran-fatiha',type:'single_choice',title:'ماذا نتعلم من «إياك نعبد وإياك نستعين»؟',options:['الاستغناء عن العمل','إفراد الله بالعبادة وطلب العون منه','ترك التعلم','طلب مدح الناس'],correct_answer:'إفراد الله بالعبادة وطلب العون منه',explanation:'تجمع الآية بين العبادة والاستعانة بالله تعالى.',points:2},
  {key:'quran-fatiha-2',lesson:'quran-fatiha',type:'true_false',title:'فهم معاني الفاتحة يعين على حضور القلب في الصلاة.',options:[],correct_answer:'true',explanation:'فهم ما يقرأه المصلي يعينه على التدبر والخشوع.',points:1},
  {key:'quran-fatiha-3',lesson:'quran-fatiha',type:'single_choice',title:'بعد الاستعانة بالله، ماذا يفعل الطالب؟',options:['يترك الأسباب','يبذل السبب المشروع','ينتظر دون عمل','يتكبر على الناس'],correct_answer:'يبذل السبب المشروع',explanation:'الاستعانة بالله لا تعني ترك العمل والأسباب.',points:2},
  {key:'hadith-intention-1',lesson:'hadith-intention',type:'single_choice',title:'أين تكون النية في الأصل؟',options:['في القلب','في عدد الكلمات فقط','في لباس الإنسان','في مدح الناس'],correct_answer:'في القلب',explanation:'النية قصد القلب، ويعمل المسلم على تصحيحها دون وسوسة.',points:2},
  {key:'hadith-intention-2',lesson:'hadith-intention',type:'true_false',title:'الخوف من فساد النية سبب لترك كل عمل صالح.',options:[],correct_answer:'false',explanation:'يستحضر المسلم النية الصالحة ويمضي في الخير ولا يستسلم للوسوسة.',points:1},
  {key:'hadith-intention-3',lesson:'hadith-intention',type:'single_choice',title:'أي نية مناسبة لطلب العلم؟',options:['التعالي على الآخرين','طلب المدح وحده','رفع الجهل عن النفس ونفع الناس','إحراج الزملاء'],correct_answer:'رفع الجهل عن النفس ونفع الناس',explanation:'من المقاصد الصالحة طلب العلم النافع والعمل به.',points:2},
  {key:'hadith-kindness-1',lesson:'hadith-kindness',type:'single_choice',title:'هل الرفق يعني ترك تصحيح الخطأ؟',options:['نعم دائمًا','لا، بل تصحيح الخطأ بأدب وحكمة','نعم إذا كان الطالب صغيرًا','لا يعني إلا الصمت'],correct_answer:'لا، بل تصحيح الخطأ بأدب وحكمة',explanation:'الرفق لا يلغي الحق ولا يبرر ترك التعليم.',points:2},
  {key:'hadith-kindness-2',lesson:'hadith-kindness',type:'true_false',title:'قد يكون الحزم عادلًا إذا خلا من الإهانة والظلم.',options:[],correct_answer:'true',explanation:'الحزم والرفق يجتمعان عند وضع حدود واضحة باحترام.',points:1},
  {key:'hadith-kindness-3',lesson:'hadith-kindness',type:'single_choice',title:'أي عبارة أرفق عند تصحيح الإجابة؟',options:['أنت لا تفهم أبدًا','هذا خطأ سخيف','هذه النقطة تحتاج إلى مراجعة، لنجرب ثانية','لن أشرح لك مجددًا'],correct_answer:'هذه النقطة تحتاج إلى مراجعة، لنجرب ثانية',explanation:'تصف العبارة الخطأ وتفتح طريقًا للتعلم دون إهانة.',points:2},
  {key:'aqidah-worship-1',lesson:'aqidah-worship',type:'single_choice',title:'ما الأصل الذي تقوم عليه العبادة؟',options:['طلب ثناء الناس','إفراد الله بالعبادة','التفاخر بالعمل','اتباع كل عادة بلا تفكير'],correct_answer:'إفراد الله بالعبادة',explanation:'توحيد الله وإفراده بالعبادة أصل عظيم في الإسلام.',points:2},
  {key:'aqidah-worship-2',lesson:'aqidah-worship',type:'true_false',title:'كل عمل مباح يمكن أن يكون قربة إذا صحت النية وكان مشروعًا.',options:[],correct_answer:'true',explanation:'يشترط أن يكون العمل مشروعًا وأن تصح النية.',points:1},
  {key:'aqidah-worship-3',lesson:'aqidah-worship',type:'single_choice',title:'هل يكفي حسن القصد لتصحيح أي فعل؟',options:['نعم، مهما كان الفعل','لا، فلا بد أن يكون الفعل مشروعًا','نعم إذا كان سرًا','لا يحتاج العمل إلى نية أصلًا'],correct_answer:'لا، فلا بد أن يكون الفعل مشروعًا',explanation:'حسن القصد لا يجعل الفعل المحرم مشروعًا.',points:2},
  {key:'fiqh-prayer-1',lesson:'fiqh-prayer',type:'single_choice',title:'إذا جهل الطالب حكمًا تفصيليًا في الصلاة، فما التصرف الأنسب؟',options:['يخترع حكمًا','يسخر ممن يسأل','يرجع إلى الشيخ أو مصدر موثوق','ينشر تخمينه'],correct_answer:'يرجع إلى الشيخ أو مصدر موثوق',explanation:'الأحكام التعبدية تتعلم من مصادر معتمدة وأهل العلم.',points:2},
  {key:'fiqh-prayer-2',lesson:'fiqh-prayer',type:'true_false',title:'التعلم والتصحيح بعد الخطأ سبب لليأس من العبادة.',options:[],correct_answer:'false',explanation:'يتعلم المسلم ويصحح ما يستطيع دون تهويل أو يأس.',points:1},
  {key:'fiqh-prayer-3',lesson:'fiqh-prayer',type:'single_choice',title:'أي طريقة أنفع لتعلم صفة الوضوء والصلاة؟',options:['التخمين','المشاهدة والتطبيق مع معلم موثوق','الاكتفاء بالسخرية من أخطاء الآخرين','ترك السؤال'],correct_answer:'المشاهدة والتطبيق مع معلم موثوق',explanation:'التطبيق العملي مع التعليم الموثوق يساعد على إتقان العبادة.',points:2},
  {key:'seerah-character-1',lesson:'seerah-character',type:'single_choice',title:'ما علامة نافعة على أثر العلم؟',options:['زيادة التكبر','حسن الخلق والعمل بالمعلومة','احتقار المخطئ','كثرة الجدل بلا دليل'],correct_answer:'حسن الخلق والعمل بالمعلومة',explanation:'من ثمرات العلم النافع العمل والأدب والتواضع.',points:2},
  {key:'seerah-character-2',lesson:'seerah-character',type:'true_false',title:'يمكن أن يعرف الإنسان المعلومة الصحيحة لكنه يحتاج إلى تعلم أدب عرضها.',options:[],correct_answer:'true',explanation:'صحة المعلومة لا تبرر الإهانة أو سوء الخلق.',points:1},
  {key:'seerah-character-3',lesson:'seerah-character',type:'single_choice',title:'كيف يصحح الطالب خطأ زميله؟',options:['يفضحه أمام الجميع','يصححه باحترام ووضوح','ينشر خطأه','يسكت دائمًا حتى لو طُلبت المساعدة'],correct_answer:'يصححه باحترام ووضوح',explanation:'النصيحة تجمع بين الحق وحسن الأسلوب.',points:2},
  {key:'arabic-summary-1',lesson:'arabic-summary',type:'single_choice',title:'ما الخطوة الأولى المفيدة في التلخيص؟',options:['نسخ الصفحة كلها','تحديد الفكرة الرئيسة','حذف كل الأمثلة','إضافة معلومات من الخيال'],correct_answer:'تحديد الفكرة الرئيسة',explanation:'تحديد الفكرة الرئيسة يوجه بقية التلخيص.',points:2},
  {key:'arabic-summary-2',lesson:'arabic-summary',type:'true_false',title:'التلخيص الجيد يسمح بإضافة ادعاءات لم يذكرها النص.',options:[],correct_answer:'false',explanation:'ينبغي أن يحفظ التلخيص معنى النص وألا ينسب إليه ما لم يقله.',points:1},
  {key:'arabic-summary-3',lesson:'arabic-summary',type:'single_choice',title:'كيف نختبر فهم النص؟',options:['بعدد الصفحات المنسوخة','بشرح الفكرة بكلماتنا ومقارنتها بالأصل','بسرعة إغلاق الكتاب','بحفظ العنوان فقط'],correct_answer:'بشرح الفكرة بكلماتنا ومقارنتها بالأصل',explanation:'الشرح والاسترجاع يكشفان مواضع الفهم والنقص.',points:2},
  {key:'tazkiyah-repentance-1',lesson:'tazkiyah-repentance',type:'single_choice',title:'ماذا يفعل المسلم إذا وقع في خطأ ثم ندم؟',options:['يقنط من الرحمة','يبرر الخطأ دائمًا','يتوب ويأخذ بأسباب الإصلاح','يؤذي نفسه'],correct_answer:'يتوب ويأخذ بأسباب الإصلاح',explanation:'التوبة رجوع وإصلاح مع عدم القنوط من رحمة الله.',points:2},
  {key:'tazkiyah-repentance-2',lesson:'tazkiyah-repentance',type:'true_false',title:'إذا تعلق الذنب بحق إنسان آخر، فقد يلزم رد الحق أو طلب المسامحة.',options:[],correct_answer:'true',explanation:'حقوق العباد تحتاج إلى رد الحقوق أو التحلل منها بحسب الحال.',points:1},
  {key:'tazkiyah-repentance-3',lesson:'tazkiyah-repentance',type:'single_choice',title:'أي فرق صحيح بين الندم النافع واحتقار النفس؟',options:['لا فرق بينهما','الندم يدفع إلى التوبة والإصلاح، واحتقار النفس قد يعطل الإصلاح','كلاهما يوجب ترك الخير','احتقار النفس شرط للتوبة'],correct_answer:'الندم يدفع إلى التوبة والإصلاح، واحتقار النفس قد يعطل الإصلاح',explanation:'المطلوب إصلاح الخطأ مع الرجاء والعمل، لا اليأس.',points:2},
  {key:'learning-spaced-review-1',lesson:'learning-spaced-review',type:'single_choice',title:'ما أفضل اختبار سريع لمعرفة هل فهمت فقرة؟',options:['إعادة قراءتها فقط','إغلاق المصدر ومحاولة شرحها ثم التصحيح','تلوينها كلها','عدّ دقائق القراءة فقط'],correct_answer:'إغلاق المصدر ومحاولة شرحها ثم التصحيح',explanation:'الاسترجاع من الذاكرة يكشف ما ثبت وما يحتاج إلى مراجعة.',points:2},
  {key:'learning-spaced-review-2',lesson:'learning-spaced-review',type:'true_false',title:'المراجعة المتباعدة تعني توزيع المراجعة على أوقات مختلفة.',options:[],correct_answer:'true',explanation:'توزيع المراجعة يساعد على تثبيت التعلم طويل الأمد.',points:1},
  {key:'learning-spaced-review-3',lesson:'learning-spaced-review',type:'single_choice',title:'إذا أخطأت في استرجاع معلومة، فما الخطوة المفيدة؟',options:['إخفاء الخطأ','تحديد الخطأ وتصحيحه ثم مراجعته لاحقًا','ترك المادة نهائيًا','لوم النفس دون مراجعة'],correct_answer:'تحديد الخطأ وتصحيحه ثم مراجعته لاحقًا',explanation:'الخطأ معلومة عن موضع يحتاج إلى تدريب.',points:2},
  {key:'thinking-verify-1',lesson:'thinking-verify',type:'single_choice',title:'ما أول تصرف مناسب قبل نشر خبر حساس؟',options:['إعادة نشره فورًا','التحقق من المصدر والسياق','الاكتفاء بعدد المشاركات','حذف اسم المصدر'],correct_answer:'التحقق من المصدر والسياق',explanation:'الانتشار ليس دليلًا على الصحة، والتحقق يحمي من الظلم.',points:2},
  {key:'thinking-verify-2',lesson:'thinking-verify',type:'true_false',title:'كثرة مشاركة الخبر دليل كافٍ على صحته.',options:[],correct_answer:'false',explanation:'يجب التحقق من المصدر والدليل والسياق.',points:1},
  {key:'thinking-verify-3',lesson:'thinking-verify',type:'single_choice',title:'إذا لم تستطع التحقق من خبر يمس شخصًا، فما الأفضل؟',options:['نشره مع عبارة «يقال»','إرساله إلى كل الأصدقاء','التوقف عن نشره وطلب التثبت','إضافة تفاصيل غير مؤكدة'],correct_answer:'التوقف عن نشره وطلب التثبت',explanation:'التوقف عن النشر عند غياب التحقق يحمي الناس من الضرر.',points:2},
  {key:'health-digital-1',lesson:'health-digital',type:'single_choice',title:'ما طريقة عملية لتقليل تشتت الهاتف أثناء الدراسة؟',options:['فتح كل التنبيهات','وضع الهاتف بعيدًا وإيقاف التنبيهات غير الضرورية','التنقل بين التطبيقات كل دقيقة','الدراسة مع المقاطع القصيرة دائمًا'],correct_answer:'وضع الهاتف بعيدًا وإيقاف التنبيهات غير الضرورية',explanation:'تغيير البيئة يقلل المقاطعات ويساعد على التركيز.',points:2},
  {key:'health-digital-2',lesson:'health-digital',type:'true_false',title:'إذا تعثرت في عادة رقمية، فمن الأفضل الاستسلام نهائيًا.',options:[],correct_answer:'false',explanation:'التدرج والعودة إلى الخطة أنفع من الاستسلام ولوم النفس.',points:1},
  {key:'health-digital-3',lesson:'health-digital',type:'single_choice',title:'ما الهدف من تنظيم استخدام الهاتف؟',options:['الخوف من كل تقنية','جعل التقنية تخدم الأولويات بدل أن تبتلعها','منع كل ترفيه مباح','مقارنة النفس بالآخرين'],correct_answer:'جعل التقنية تخدم الأولويات بدل أن تبتلعها',explanation:'الهدف هو الاستخدام الواعي المتوازن.',points:2},
  {key:'family-parents-1',lesson:'family-parents',type:'single_choice',title:'أي سلوك أقرب إلى الإحسان للوالدين؟',options:['الصراخ عند الاختلاف','الكلمة الكريمة والخدمة الممكنة','التجاهل المتعمد','السخرية من النصيحة'],correct_answer:'الكلمة الكريمة والخدمة الممكنة',explanation:'الإحسان يظهر في القول الكريم والعمل النافع.',points:2},
  {key:'family-parents-2',lesson:'family-parents',type:'true_false',title:'يمكن للإنسان أن يختلف بأدب دون إساءة.',options:[],correct_answer:'true',explanation:'حفظ الأدب لا يمنع السؤال وطلب المشورة.',points:1},
  {key:'family-parents-3',lesson:'family-parents',type:'single_choice',title:'إذا لم تعرف كيف تتصرف في مشكلة أسرية معقدة، فماذا تفعل؟',options:['تنشر خصوصيات الأسرة','تطلب نصيحة موثوقة مناسبة','تؤذي الطرف الآخر','تتبع أول تعليق على الإنترنت'],correct_answer:'تطلب نصيحة موثوقة مناسبة',explanation:'المشكلات المعقدة تحتاج إلى نصيحة تراعي ظروفها وخصوصيتها.',points:2},
  {key:'duaa-meaning-1',lesson:'duaa-meaning',type:'single_choice',title:'ما الذي ينبغي فعله قبل نسبة دعاء إلى النبي ﷺ؟',options:['نشره لأن تصميمه جميل','التحقق من لفظه ومصدره','الاكتفاء بأنه مشهور','تغيير ألفاظه ثم نسبته'],correct_answer:'التحقق من لفظه ومصدره',explanation:'لا تُنسب الألفاظ إلى النبي ﷺ دون تحقق.',points:2},
  {key:'duaa-meaning-2',lesson:'duaa-meaning',type:'true_false',title:'الدعاء والعمل بالأسباب المشروعة يجتمعان.',options:[],correct_answer:'true',explanation:'يدعو المسلم ربه ويأخذ بالأسباب المشروعة.',points:1},
  {key:'duaa-meaning-3',lesson:'duaa-meaning',type:'single_choice',title:'ما فائدة فهم ألفاظ الدعاء؟',options:['معرفة المعنى وحضور القلب','الاستغناء عن العمل','نسبة كل عبارة إلى السنة','ترك التحقق من المصدر'],correct_answer:'معرفة المعنى وحضور القلب',explanation:'فهم الدعاء يعين على حضوره ومعرفة ما يسأل العبد ربه.',points:2}
];


const REFLECTION_QUESTIONS = [
  {key:'quran-taqwa-reflect',lesson:'quran-taqwa',title:'اذكر موقفًا عمليًا تستطيع فيه ترك التفاخر أو إنصاف شخص حكمت عليه بسرعة.',explanation:'تُقبل الإجابة إذا تضمنت موقفًا واقعيًا وخطوة عملية محترمة.'},
  {key:'quran-fatiha-reflect',lesson:'quran-fatiha',title:'اشرح بكلماتك معنى الاستعانة بالله مع بذل الأسباب.',explanation:'ينتظر من الطالب ذكر طلب العون من الله مع القيام بالعمل المشروع.'},
  {key:'hadith-intention-reflect',lesson:'hadith-intention',title:'اكتب نية صالحة للدراسة اليوم، واذكر كيف تتجنب تحويل مراجعة النية إلى وسوسة.',explanation:'تُقبل الإجابة إذا جمعت قصدًا صالحًا والمضي في العمل دون تكرار قلِق.'},
  {key:'hadith-kindness-reflect',lesson:'hadith-kindness',title:'أعد صياغة نصيحة جارحة لتصبح واضحة ورفيقة دون إخفاء الخطأ.',explanation:'تُقيّم الإجابة على وضوح التصحيح واحترام الشخص.'},
  {key:'aqidah-worship-reflect',lesson:'aqidah-worship',title:'اذكر عملًا يوميًا مباحًا يمكن أن تنوي به خيرًا، وبيّن شرطين لصلاحه.',explanation:'ينتظر مثالًا مشروعًا مع نية صالحة وعدم مخالفة الشرع.'},
  {key:'fiqh-prayer-reflect',lesson:'fiqh-prayer',title:'اكتب سؤالًا محددًا عن عبادة تريد تعلمها، وحدد مصدرًا موثوقًا لتعلمها.',explanation:'تُقبل الإجابة إذا كان السؤال واضحًا والمصدر مناسبًا.'},
  {key:'seerah-character-reflect',lesson:'seerah-character',title:'اذكر خلقًا تريد تحسينه، وموقفًا ستطبقه فيه هذا الأسبوع.',explanation:'تُقيّم الإجابة على ارتباط الخلق بخطوة عملية.'},
  {key:'arabic-summary-reflect',lesson:'arabic-summary',title:'لخّص فكرة هذا الدرس في ثلاث جمل من صياغتك دون إضافة معنى غير موجود.',explanation:'تُقيّم الإجابة على حفظ الفكرة، والاختصار، وعدم تحريف المعنى.'},
  {key:'tazkiyah-repentance-reflect',lesson:'tazkiyah-repentance',title:'اشرح الفرق بين الندم الذي يدفع للإصلاح والقنوط الذي يعطّل العمل.',explanation:'ينتظر من الطالب ذكر الرجوع والإصلاح مع الرجاء وعدم الاستسلام.'},
  {key:'learning-spaced-review-reflect',lesson:'learning-spaced-review',title:'صمّم خطة مراجعة بسيطة لدرس واحد تتضمن الاسترجاع وموعد مراجعة لاحقًا.',explanation:'تُقيّم الإجابة على وجود استرجاع وتصحيح وتوقيت واقعي للمراجعة.'},
  {key:'thinking-verify-reflect',lesson:'thinking-verify',title:'طبّق ثلاث خطوات للتحقق من خبر قبل نشره، واذكر متى تقرر عدم نشره.',explanation:'ينتظر مصدرًا أصليًا وسياقًا ودليلًا، مع الامتناع عن النشر عند غياب التحقق.'},
  {key:'health-digital-reflect',lesson:'health-digital',title:'اختر عادة رقمية واحدة تريد تغييرها، واكتب حدًا واقعيًا وبديلًا نافعًا.',explanation:'تُقيّم الإجابة على كون الخطة محددة وقابلة للتطبيق دون مبالغة.'},
  {key:'family-parents-reflect',lesson:'family-parents',title:'اذكر عمل بر تستطيع القيام به اليوم، وكيف تتصرف بأدب عند الاختلاف.',explanation:'تُقيّم الإجابة على احترام الوالدين ووضوح العمل الممكن.'},
  {key:'duaa-meaning-reflect',lesson:'duaa-meaning',title:'اختر دعاءً تريد تعلمه، واذكر كيف تتحقق من لفظه ومصدره ومعناه.',explanation:'ينتظر من الطالب ذكر مصدر موثوق وفهم المعنى وعدم نسبة غير المتحقق إلى السنة.'}
].map(x=>({...x,type:'short_answer',points:3,options:[],correct_answer:'',group_id:null}));

function norm(s){ return String(s||'').trim().toLocaleLowerCase('ar'); }
function uniqueId(rows, base){ let id=base, n=2; const used=new Set(rows.map(x=>x.id)); while(used.has(id)) id=base+'-'+n++; return id; }

function seedEducationalContent(db){
  let changed=false;
  for(const key of ['subjects','lessons','question_bank','journey_items']) if(!Array.isArray(db[key])) db[key]=[];
  const subjectIds={};
  for(const spec of SUBJECTS){
    let row=db.subjects.find(x=>x.seed_key==='formation-subject-'+spec.key)||db.subjects.find(x=>norm(x.name)===norm(spec.name));
    if(!row){
      row={id:uniqueId(db.subjects,'seed-sub-'+spec.key),seed_key:'formation-subject-'+spec.key,name:spec.name,description:'مسار تعليمي ضمن برنامج بناء الإنسان.',category:spec.category,learning_mode:spec.learning_mode,classification:spec.learning_mode,study_method:spec.study_method,required:spec.required,active:true,created_at:new Date().toISOString()};
      db.subjects.push(row); changed=true;
    }else if(!row.seed_key && norm(row.name)===norm(spec.name)){ row.seed_key='formation-subject-'+spec.key; changed=true; }
    subjectIds[spec.key]=row.id;
  }
  const lessonIds={};
  for(const spec of LESSONS){
    let row=db.lessons.find(x=>x.seed_key==='formation-lesson-'+spec.key);
    if(!row){
      row={id:uniqueId(db.lessons,'seed-les-'+spec.key),seed_key:'formation-lesson-'+spec.key,subject_id:subjectIds[spec.subject],title:spec.title,description:spec.description,learning_mode:spec.learning_mode,study_method:spec.study_method,active:true,duration_minutes:15,objective:spec.description,content:JSON.parse(JSON.stringify(spec.content)),created_at:new Date().toISOString()};
      db.lessons.push(row); changed=true;
    }
    lessonIds[spec.key]=row.id;
  }
  for(const spec of [...QUESTIONS,...REFLECTION_QUESTIONS]){
    if(db.question_bank.some(x=>x.seed_key==='formation-question-'+spec.key)) continue;
    const lesson=LESSONS.find(x=>x.key===spec.lesson);
    const row={id:uniqueId(db.question_bank,'seed-q-'+spec.key),seed_key:'formation-question-'+spec.key,title:spec.title,type:spec.type,points:spec.points,options:spec.options,correct_answer:spec.correct_answer,explanation:spec.explanation,subject_id:subjectIds[lesson.subject],lesson_id:lessonIds[spec.lesson],group_id:null,active:true,created_by:null,created_at:new Date().toISOString()};
    db.question_bank.push(row); changed=true;
  }
  if(!db.journey_items.some(x=>x.seed_key==='formation-journey-start')){
    const items=[
      {key:'formation-journey-start',title:'ابدأ بالنية والخطة',description:'اختر هدفًا صغيرًا للأسبوع وحدد وقتًا واقعيًا له.',category:'التنظيم',level:'التمهيد',order:10,required:true},
      {key:'formation-journey-quran',title:'ورد القرآن والتصحيح',description:'قراءة أو حفظ وفق خطة الشيخ، مع مراجعة الأخطاء بهدوء.',category:'القرآن',level:'الأساس',order:20,required:true},
      {key:'formation-journey-knowledge',title:'درس وفهم واسترجاع',description:'ادرس درسًا، ثم اشرحه بكلماتك وأجب عن أسئلته.',category:'العلم',level:'الأساس',order:30,required:true},
      {key:'formation-journey-character',title:'خلق واحد أطبقه',description:'اختر خلقًا وطبقه في موقف حقيقي، ثم راجع أثره.',category:'الأخلاق',level:'العمل',order:40,required:true},
      {key:'formation-journey-review',title:'راجع دون إنهاك',description:'راجع ما تعلمته بعد فاصل، وسجل ما يحتاج إلى مساعدة.',category:'المراجعة',level:'الاستمرار',order:50,required:true}
    ];
    for(const it of items){
      db.journey_items.push({id:uniqueId(db.journey_items,it.key),seed_key:it.key,title:it.title,description:it.description,category:it.category,level:it.level,order:it.order,required:it.required,active:true});
    }
    changed=true;
  }
  return {changed,subjects:SUBJECTS.length,lessons:LESSONS.length,questions:QUESTIONS.length+REFLECTION_QUESTIONS.length,journey_items:5};
}

module.exports={seedEducationalContent,SUBJECTS,LESSONS,QUESTIONS,REFLECTION_QUESTIONS};
