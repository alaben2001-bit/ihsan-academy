/* Arabic anti-self-XSS notice for the academy's own developer console. */
console.warn("تنبيه أمني من أكاديمية الإحسان:\nقد يتيح استخدام وحدة التحكم (Console) للمهاجمين انتحال هويتك وسرقة معلوماتك عبر هجوم يُعرف باسم Self-XSS.\nلا تُدخل أو تلصق أي شيفرة لا تفهمها، ولا تنفّذ تعليمات يرسلها إليك مجهول.");
let ihsanInstallPrompt=null;
let ihsanGoogleNonce="";
let ihsanGoogleScriptPromise=null;
function ihsanIsInstalled(){return Boolean(window.matchMedia&&window.matchMedia("(display-mode: standalone)").matches)||navigator.standalone===true}
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();ihsanInstallPrompt=e;document.documentElement.classList.add("ihsan-install-available")});
window.addEventListener("appinstalled",()=>{ihsanInstallPrompt=null;try{localStorage.setItem("ihsan_app_installed","1")}catch{}const b=document.getElementById("install-app");if(b){b.disabled=true;b.textContent="التطبيق مثبت"}toast("تم تثبيت أكاديمية الإحسان على جهازك.")});
function showAcademyUpdateNotice(){
 if(document.getElementById("academy-update-notice"))return;
 const box=document.createElement("section");box.id="academy-update-notice";box.className="academy-update-notice";box.setAttribute("role","status");box.setAttribute("dir","rtl");
 box.innerHTML='<div class="academy-update-copy"><strong>يتوفر تحديث جديد للأكاديمية</strong><span>حدّث الصفحة لتظهر لك أحدث التحسينات على هذا الجهاز.</span></div><div class="academy-update-actions"><button type="button" class="btn" id="academy-update-now">تحديث التطبيق</button><button type="button" class="btn secondary" id="academy-update-dismiss">إخفاء</button></div>';
 document.body.appendChild(box);
 document.getElementById("academy-update-now")?.addEventListener("click",()=>location.reload());
 document.getElementById("academy-update-dismiss")?.addEventListener("click",()=>box.remove());
 try{if("Notification" in window&&Notification.permission==="granted")new Notification("تحديث أكاديمية الإحسان",{body:"يتوفر إصدار أحدث؛ افتح التطبيق من جديد لتطبيقه."})}catch{}
}
if("serviceWorker" in navigator&&location.protocol==="https:")window.addEventListener("load",async()=>{
 const hadController=Boolean(navigator.serviceWorker.controller);
 try{
  const registration=await navigator.serviceWorker.register("/service-worker.js");
  registration.addEventListener("updatefound",()=>{
   const installing=registration.installing;
   installing?.addEventListener("statechange",()=>{if(hadController&&installing.state==="installed")showAcademyUpdateNotice()});
  });
  if(hadController&&registration.waiting)showAcademyUpdateNotice();
  registration.update().catch(()=>{});
 }catch{}
});
async function loadGoogleIdentityLibrary(){
 if(window.google&&window.google.accounts&&window.google.accounts.id)return;
 if(!ihsanGoogleScriptPromise)ihsanGoogleScriptPromise=new Promise((resolve,reject)=>{const s=document.createElement("script");s.src="https://accounts.google.com/gsi/client";s.async=true;s.defer=true;s.onload=resolve;s.onerror=()=>reject(new Error("تعذر تحميل Google Identity Services"));document.head.appendChild(s)});
 await ihsanGoogleScriptPromise;
 if(!window.google||!window.google.accounts||!window.google.accounts.id)throw new Error("خدمة Google غير متاحة");
}
async function initGoogleSignIn(){
 const host=$("#google-signin"),note=$("#google-login-note");if(!host)return;
 const setNote=(t,err=false)=>{if(note){note.textContent=t;note.classList.toggle("google-note-error",err)}};
 host.innerHTML='<button class="google-signin-placeholder" type="button"><span class="google-letter" aria-hidden="true">G</span><span>الدخول باستخدام Google</span></button>';
 try{
  const cfg=await api("/auth/google/config");
  if(!cfg.enabled||!cfg.client_id){setNote("يحتاج الدخول بجوجل إلى ربط معرّف OAuth في إعدادات Cloudflare أولًا.");host.querySelector("button")?.addEventListener("click",()=>setNote("لم يُفعّل الدخول بجوجل بعد. يلزم إنشاء Web OAuth Client ID في Google Cloud وإضافة GOOGLE_CLIENT_ID إلى إعدادات Cloudflare Pages.",true));return}
  await loadGoogleIdentityLibrary();
  ihsanGoogleNonce=Array.from(crypto.getRandomValues(new Uint8Array(24)),b=>b.toString(16).padStart(2,"0")).join("");
  window.google.accounts.id.initialize({client_id:cfg.client_id,nonce:ihsanGoogleNonce,callback:async res=>{
   const error=$("#auth-error"),submit=$("#auth-form button[type=submit]");if(error)error.classList.add("hidden");if(submit)submit.disabled=true;setNote("جارٍ التحقق من حساب Google…");
   try{
    const remember=$("#auth-form input[name=remember]")?.checked===true;
    const data=await api("/auth/google",{method:"POST",body:JSON.stringify({credential:res.credential,nonce:ihsanGoogleNonce,remember})});
    S.token="";clearSessionToken();S.user=data.user;S.user=await api("/me");if(S.user?.must_change_password){renderTopActions();showPasswordChange(true)}else{await start()}
   }catch(err){setNote(err.message||"تعذر الدخول باستخدام Google.",true);if(error){error.textContent=err.message||"تعذر الدخول باستخدام Google.";error.classList.remove("hidden")}if(submit)submit.disabled=false}
  }});
  host.innerHTML="";window.google.accounts.id.renderButton(host,{type:"standard",theme:"outline",size:"large",shape:"rectangular",text:"signin_with",locale:"ar",width:320});
  setNote("استخدم بريد Google نفسه المسجل لحسابك في الأكاديمية.");
 }catch{setNote("تعذر تحميل Google. يمكنك الدخول باسم المستخدم وكلمة المرور.",true)}
}
function showInstallGuide(){
 const old=$("#install-help-dialog");if(old)old.remove();const ua=navigator.userAgent||"";
 const isIphone=/iPhone|iPad|iPod/i.test(ua)||(/Macintosh/i.test(ua)&&navigator.maxTouchPoints>1);
 const isIosSafari=isIphone&&/Safari/i.test(ua)&&!/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);
 const isAndroid=/Android/i.test(ua);
 const isAndroidFirefox=isAndroid&&/Firefox/i.test(ua);
 const isDesktopFirefox=!isAndroid&&!isIphone&&/Firefox/i.test(ua);
 let intro,steps;
 if(isIphone&&!isIosSafari){intro="التثبيت على أجهزة Apple يتم من متصفح Safari فقط (وليس من Chrome أو Firefox).";steps=["انسخ رابط الأكاديمية بزر «نسخ رابط الأكاديمية» بالأسفل.","افتح Safari وألصق الرابط في شريط العنوان.","اضغط زر المشاركة، ثم «إضافة إلى الشاشة الرئيسية»، ثم «إضافة»."]}
 else if(isIphone){intro="على أجهزة Apple يتم التثبيت من قائمة المشاركة في Safari.";steps=["اضغط زر المشاركة في Safari.","اختر «إضافة إلى الشاشة الرئيسية».","اضغط «إضافة» للتأكيد."]}
 else if(isAndroidFirefox){intro="Firefox على Android لا يدعم تثبيت تطبيقات الويب.";steps=["انسخ رابط الأكاديمية بزر «نسخ رابط الأكاديمية» بالأسفل.","افتحه في Chrome أو Samsung Internet.","اضغط القائمة ⋮ ثم «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية»."]}
 else if(isAndroid){intro="يمكن تثبيت الأكاديمية مجانًا من قائمة المتصفح في Chrome.";steps=["اضغط القائمة ⋮ أعلى الشاشة.","اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».","اضغط «تثبيت» أو «إضافة» للتأكيد."]}
 else if(isDesktopFirefox){intro="Firefox لا يدعم تثبيت تطبيقات الويب.";steps=["انسخ رابط الأكاديمية بزر «نسخ رابط الأكاديمية» بالأسفل.","افتحه في Chrome أو Edge.","اختر «تثبيت التطبيق» من قائمة المتصفح أو من أيقونة التثبيت في شريط العنوان."]}
 else{intro="يمكن تثبيت الأكاديمية من شريط العنوان أو من قائمة المتصفح في Chrome أو Edge.";steps=["اضغط أيقونة التثبيت في شريط العنوان، أو افتح قائمة المتصفح.","اختر «تثبيت التطبيق» أو «تثبيت هذا الموقع كتطبيق».","أكّد التثبيت عند ظهور النافذة."]}
 const url=location.origin+"/";
 document.body.insertAdjacentHTML("beforeend",'<dialog id="install-help-dialog" class="install-guide-dialog" aria-labelledby="install-guide-title"><header class="install-guide-head"><span class="install-guide-mark" aria-hidden="true">↓</span><div><h2 id="install-guide-title">تثبيت أكاديمية الإحسان</h2><p>'+intro+'</p></div><button type="button" class="install-guide-x" id="install-guide-x" aria-label="إغلاق">×</button></header><div class="install-guide-content"><ol>'+steps.map(s=>"<li>"+s+"</li>").join("")+'</ol><p class="install-guide-note">التثبيت يضيف أيقونة للأكاديمية إلى جهازك ولا يحذف بيانات حسابك.</p><button type="button" class="btn secondary" id="install-copy-link">نسخ رابط الأكاديمية</button></div><footer class="install-guide-footer"><button type="button" class="btn" id="install-guide-close">حسنًا</button></footer></dialog>');
 const d=$("#install-help-dialog"),close=()=>{if(!d)return;try{if(d.open)d.close()}catch{}d.remove()};$("#install-guide-close")?.addEventListener("click",close);$("#install-guide-x")?.addEventListener("click",close);d?.addEventListener("click",e=>{if(e.target===d)close()});$("#install-copy-link")?.addEventListener("click",async e=>{const b=e.currentTarget;let done=false;try{await navigator.clipboard.writeText(url);done=true}catch{try{const ta=document.createElement("textarea");ta.value=url;ta.style.position="fixed";ta.style.opacity="0";document.body.appendChild(ta);ta.select();done=document.execCommand("copy");ta.remove()}catch{}}b.textContent=done?"نُسخ الرابط ✓":url});if(typeof d?.showModal==="function")d.showModal();else d?.setAttribute("open","");
}
window.addEventListener("error",function(e){var a=document.getElementById("app");if(a&&a.querySelector(".loading")){a.innerHTML="<section class=\"panel\"><h2>خطأ في تشغيل الواجهة</h2><p class=\"muted\"></p></section>";a.querySelector("p").textContent=(e.message||"JavaScript error")+" — "+(e.filename||"")+(e.lineno?":"+e.lineno:"");}});window.addEventListener("unhandledrejection",function(e){var a=document.getElementById("app");if(a&&a.querySelector(".loading"))a.textContent="تعذّر بدء الأكاديمية: "+String(e.reason&&e.reason.message||e.reason||"خطأ غير معروف");});
const $=s=>document.querySelector(s), app=$("#app");
const safeStore={get(k){try{return localStorage.getItem(k)||""}catch{return ""}},set(k,v){try{localStorage.setItem(k,v)}catch{}},remove(k){try{localStorage.removeItem(k)}catch{}},getSession(k){try{return sessionStorage.getItem(k)||""}catch{return ""}},setSession(k,v){try{sessionStorage.setItem(k,v)}catch{}},removeSession(k){try{sessionStorage.removeItem(k)}catch{}}};
function clearSessionToken(){safeStore.remove("ihsan_token");safeStore.removeSession("ihsan_token")}
const localDateISO=(value=new Date())=>{
 const parts=new Intl.DateTimeFormat("en-US",{timeZone:"Africa/Algiers",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(value);
 const fields=Object.fromEntries(parts.map(part=>[part.type,part.value]));
 return fields.year+"-"+fields.month+"-"+fields.day;
};
const shiftLocalDateISO=(dateOnly,days)=>{
 const [y,m,d]=dateOnly.split("-").map(Number),shifted=new Date(Date.UTC(y,m-1,d+days));
 return shifted.getUTCFullYear()+"-"+String(shifted.getUTCMonth()+1).padStart(2,"0")+"-"+String(shifted.getUTCDate()).padStart(2,"0");
};
const S={token:"",user:null,tab:"home",mode:"hub",groups:[],students:[],teachers:[],staff:[],schools:[],date:safeStore.get("ihsan_attendance_date")||localDateISO()};
let offlineSessionActive=false;

const knowledgeVerses=[
 {text:"رَبَّنَا لَا تُزِغْ قُلُوبَنَا بَعْدَ إِذْ هَدَيْتَنَا وَهَبْ لَنَا مِنْ لَدُنْكَ رَحْمَةً إِنَّكَ أَنْتَ الْوَهَّابُ",reference:"سورة آل عمران، الآية 8"},
 {text:"وَقُلْ رَبِّ زِدْنِي عِلْمًا",reference:"سورة طه، الآية 114"},
 {text:"عَلَّمَ الْإِنسَانَ مَا لَمْ يَعْلَمْ",reference:"سورة العلق، الآية 5"},
 {text:"قُلْ هَلْ يَسْتَوِي الَّذِينَ يَعْلَمُونَ وَالَّذِينَ لَا يَعْلَمُونَ",reference:"سورة الزمر، الآية 9"},
 {text:"يَرْفَعِ اللَّهُ الَّذِينَ آمَنُوا مِنكُمْ وَالَّذِينَ أُوتُوا الْعِلْمَ دَرَجَاتٍ",reference:"سورة المجادلة، الآية 11"},
 {text:"إِنَّمَا يَخْشَى اللَّهَ مِنْ عِبَادِهِ الْعُلَمَاءُ",reference:"سورة فاطر، الآية 28"},
 {text:"وَلَا تَقْفُ مَا لَيْسَ لَكَ بِهِ عِلْمٌ",reference:"سورة الإسراء، الآية 36"},
 {text:"يُؤْتِي الْحِكْمَةَ مَن يَشَاءُ ۚ وَمَن يُؤْتَ الْحِكْمَةَ فَقَدْ أُوتِيَ خَيْرًا كَثِيرًا",reference:"سورة البقرة، الآية 269"},
 {text:"فَاسْأَلُوا أَهْلَ الذِّكْرِ إِن كُنتُمْ لَا تَعْلَمُونَ",reference:"سورة النحل، الآية 43"},
 {text:"وَمَا أُوتِيتُم مِّنَ الْعِلْمِ إِلَّا قَلِيلًا",reference:"سورة الإسراء، الآية 85"}
];
function rotateKnowledgeVerses(){
 const box=$("#knowledge-verse");if(!box)return;
 const quote=box.querySelector(".knowledge-verse-text"),source=box.querySelector(".knowledge-verse-source");
 if(!quote||!source)return;
 const previousRaw=safeStore.get("ihsan_last_knowledge_verse_index");
 const previous=previousRaw===""?-1:Number(previousRaw);
 const choices=knowledgeVerses.map((_,index)=>index).filter(index=>index!==previous);
 const index=choices[Math.floor(Math.random()*choices.length)]??0;
 safeStore.set("ihsan_last_knowledge_verse_index",String(index));
 const verse=knowledgeVerses[index];
 quote.textContent="﴿ "+verse.text+" ﴾";source.textContent=verse.reference;
}

clearSessionToken();
const themes=[
{name:"عنابي ليلي",green:"#a64b5e",mint:"#3b222b",gold:"#d8b66e",paper:"#100d12",ink:"#f5e9ed",muted:"#c3a8b0",line:"#593640",surface:"#21171d",surface2:"#302029"},
{name:"زمردي ليلي",green:"#21a47a",mint:"#183a31",gold:"#dec078",paper:"#091411",ink:"#eaf4ee",muted:"#a8beb2",line:"#2b4a3e",surface:"#14251f",surface2:"#1b3229"}]
function applyTheme(){
 const validIndex=value=>{const i=Number(value);return Number.isInteger(i)&&i>=0&&i<themes.length?i:-1};
 const savedMode=safeStore.get("ihsan_theme_mode");
 const mode="fixed";
 if(savedMode!==mode)safeStore.set("ihsan_theme_mode",mode);
 let i=-1;
 if(mode==="fixed"){
  i=validIndex(safeStore.get("ihsan_theme_index"));
  if(i<0)i=1;
 }else{
  i=validIndex(safeStore.getSession("ihsan_session_theme_index"));
  if(i<0){
   const previousRaw=safeStore.get("ihsan_last_random_theme_index");
   const previous=previousRaw===""?-1:validIndex(previousRaw);
   const all=themes.map((theme,index)=>index);
   const choices=all.filter(index=>index!==previous);
   const candidates=choices.length?choices:all;
   i=candidates[Math.floor(Math.random()*candidates.length)];
   safeStore.setSession("ihsan_session_theme_index",String(i));
   safeStore.set("ihsan_last_random_theme_index",String(i));
  }
 }
 const t=themes[i];
 for(const [k,v] of Object.entries({green:t.green,mint:t.mint,gold:t.gold,paper:t.paper,ink:t.ink,muted:t.muted,line:t.line,surface:t.surface,"surface-2":t.surface2,glow:t.green+"22"}))document.documentElement.style.setProperty("--"+k,v);
 document.documentElement.dataset.ihsanTheme=t.name;
 document.documentElement.dataset.ihsanThemeMode=mode;
 document.querySelector('meta[name="theme-color"]')?.setAttribute("content","#030705");
}
applyTheme();
function applyAppearanceSettings(){
 const root=document.documentElement;
 const background=safeStore.get("ihsan_appearance_background")||"glow";
 const iconStyle=safeStore.get("ihsan_icon_style")||"soft";
 const iconSize=safeStore.get("ihsan_icon_size")||"medium";
 const fontScale=Math.min(1.8,Math.max(.85,Number(safeStore.get("ihsan_font_scale")||1)));
 // Permanent night appearance. Select either a deep burgundy or emerald accent.
 safeStore.set("ihsan_appearance_mode","dark");
 applyTheme();
 root.dataset.appearance="dark";
 root.dataset.appearanceBackground=background;
 root.dataset.iconStyle=iconStyle;
 root.dataset.iconSize=iconSize;
 root.dataset.appearancePalette="dark";
 root.style.colorScheme="dark";
 root.style.setProperty("--user-font-scale",String(fontScale));
 const selected=themes.find(t=>t.name===root.dataset.ihsanTheme)||themes[0];
 const meta=document.querySelector('meta[name="theme-color"]');
 if(meta)meta.setAttribute("content","#030705");
}
applyAppearanceSettings();
if(safeStore.get("ihsan_reduce_motion")==="1")document.documentElement.classList.add("ihsan-reduced-motion");


const esc=v=>String(v==null?"":v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const studentNameCorrections={"بوعون إسحاق":"إسحاق بوعون","عكوش أنس":"أنس عكوش","بلمولود محمد":"محمد بلمولود","كتفي يونس":"يونس كتفي","بوهيبة علي":"علي بوهيبة","حفاظ كرم":"كرم حفاظ","حداد أيمن":"أيمن حداد","بكار وسيم":"وسيم بكار"};
const studentDisplayName=name=>studentNameCorrections[String(name||"").trim()]||String(name||"").trim();
const studentSortKey=name=>studentDisplayName(name).normalize("NFKC").replace(/[ً-ٰٟ]/g,"").trim();
const compareStudentNames=(a,b)=>studentSortKey(a).localeCompare(studentSortKey(b),"ar",{sensitivity:"base"});
const studentAlphabetIndex=name=>{const n=studentDisplayName(name).replace(/^[\s\u064B-\u065F\u0670]+/,"");return (n.match(/[ء-ي]/)||["—"])[0]};
function readCsrfCookie(){try{const part=document.cookie.split(";").map(x=>x.trim()).find(x=>x.startsWith("__Host-ihsan_csrf="));return part?decodeURIComponent(part.slice("__Host-ihsan_csrf=".length)):""}catch{return ""}}
function offlineUserKey(){return "ihsan_offline_user"}
function rememberOfflineUser(){
 if(offlineSessionActive||!S.user?.id)return;
 const user={id:S.user.id,name:S.user.name,role:S.user.role,student_id:S.user.student_id||null,group_id:S.user.group_id||null,school_ids:S.user.school_ids||[],group_ids:S.user.group_ids||[],saved_at:Date.now()};
 try{safeStore.set(offlineUserKey(),JSON.stringify(user))}catch{}
}
function loadOfflineUser(){
 try{const raw=safeStore.get(offlineUserKey());if(!raw)return null;const u=JSON.parse(raw),age=Date.now()-Number(u?.saved_at||0);if(!u?.id||!u?.role||!Number.isFinite(age)||age<0||age>30*24*60*60*1000){safeStore.remove(offlineUserKey());return null}return u}catch{return null}
}
function offlineQueueKey(){return S.user?.id?"ihsan_offline_pending_v1_"+S.user.id:""}
function readOfflineQueue(){
 const key=offlineQueueKey();if(!key)return [];
 try{const q=JSON.parse(safeStore.get(key)||"[]");return Array.isArray(q)?q:[]}catch{return []}
}
function writeOfflineQueue(q){const key=offlineQueueKey();if(!key)return false;try{localStorage.setItem(key,JSON.stringify(q.slice(-300)));return true}catch{return false}}
function offlineCacheKey(path){return "ihsan_offline_cache_"+(S.user?.id||"anonymous")+"_"+encodeURIComponent(path)}
function cacheableApiPath(path,method){
 if(method!=="GET")return false;
 const base=String(path).split("?")[0];
 return ["/dashboard","/groups","/students","/teachers","/admin/student-team-supervisors","/attendance","/quran","/quran/plan","/quran/progress","/tests","/assignments","/gamification","/leaderboard","/messages","/messages/recipients","/notifications"].includes(base);
}
function parseOfflineBody(body){
 if(body&&typeof body==="object")return body;
 if(typeof body==="string"){try{return JSON.parse(body)}catch{}}
 return null;
}
function canQueueOffline(path,method){
 const base=String(path).split("?")[0];
 return (method==="POST"&&["/attendance","/quran/progress","/groups"].includes(base))||(method==="PATCH"&&/^\/groups\/[^/]+$/.test(base));
}
function enqueueOfflineWrite(path,method,body){
 if(!S.user?.id||!canQueueOffline(path,method)||!body)return false;
 const q=readOfflineQueue(),base=String(path).split("?")[0],id=String(body.id||"");
 const entry={queue_id:crypto.randomUUID?crypto.randomUUID():String(Date.now())+"-"+Math.random().toString(36).slice(2),userId:S.user.id,path,method,body,created_at:new Date().toISOString()};
 if(base==="/attendance"){
  const day=String(body.date||""),group=String(body.group_id||"");
  for(let i=q.length-1;i>=0;i--)if(q[i].userId===S.user.id&&q[i].path==="/attendance"&&String(q[i].body?.date)===day&&String(q[i].body?.group_id)===group)q.splice(i,1);
 }else if(base==="/quran/progress"&&id){
  for(let i=q.length-1;i>=0;i--)if(q[i].userId===S.user.id&&q[i].path==="/quran/progress"&&String(q[i].body?.id)===id)q.splice(i,1);
 }else if(base==="/groups"&&method==="POST"&&id){
  for(let i=q.length-1;i>=0;i--)if(q[i].userId===S.user.id&&q[i].path==="/groups"&&String(q[i].body?.id)===id)q.splice(i,1);
 }else if(method==="PATCH"){
  for(let i=q.length-1;i>=0;i--)if(q[i].userId===S.user.id&&q[i].path===path&&q[i].method==="PATCH")q.splice(i,1);
 }
 q.push(entry);return writeOfflineQueue(q);
}
function mergeOfflineQueue(path,value){
 if(!Array.isArray(value))return value;
 const url=new URL(path,location.origin),base=url.pathname,queue=readOfflineQueue().filter(x=>x.userId===S.user?.id);
 const merged=value.slice();
 if(base==="/groups"){
  for(const item of queue){
   if(item.method==="POST"&&item.path==="/groups"&&item.body?.id&&!merged.some(g=>g.id===item.body.id)){
    merged.push({id:item.body.id,name:item.body.name,school_id:item.body.school_id||"qs-rahman",teacher_id:item.body.teacher_id||null,active:1,offline_pending:true});
   }
   if(item.method==="PATCH"&&/^\/groups\/[^/]+$/.test(item.path)){
    const id=item.path.split("/").pop(),index=merged.findIndex(g=>g.id===id);
    if(index>=0)merged[index]={...merged[index],...item.body,offline_pending:true};
   }
  }
 }
 if(base==="/attendance"){
  const targetGroup=url.searchParams.get("group_id")||"",targetDate=url.searchParams.get("date")||"";
  for(const item of queue.filter(x=>x.method==="POST"&&x.path==="/attendance")){
   const b=item.body||{};
   if(targetGroup&&String(b.group_id)!==targetGroup)continue;
   if(targetDate&&String(b.date)!==targetDate)continue;
   for(const row of (b.items||[])){
    const r={id:String(b.date)+":"+String(row.student_id),student_id:row.student_id,group_id:b.group_id,date:b.date,status:row.status,note:row.note||"",updated_at:item.created_at,offline_pending:true};
    const n=merged.findIndex(x=>x.student_id===r.student_id&&x.date===r.date);
    if(n>=0)merged[n]=r;else merged.push(r);
   }
  }
  merged.sort((a,b)=>String(b.date||"").localeCompare(String(a.date||"")));
 }
 if(base==="/quran/progress"){
  const targetStudent=url.searchParams.get("student_id")||(S.user?.role==="student"?S.user.student_id:"");
  for(const item of queue.filter(x=>x.method==="POST"&&x.path==="/quran/progress")){
   const b=item.body||{};if(targetStudent&&String(b.student_id)!==String(targetStudent))continue;
   const student=S.students.find(st=>st.id===b.student_id);
   const r={...b,group_id:b.group_id||student?.group_id||"",teacher_id:S.user?.id,created_at:item.created_at,updated_at:item.created_at,offline_pending:true};
   const n=merged.findIndex(x=>x.id===r.id);if(n>=0)merged[n]=r;else merged.push(r);
  }
  merged.sort((a,b)=>String(b.date||"").localeCompare(String(a.date||""))||String(b.created_at||"").localeCompare(String(a.created_at||"")));
 }
 return merged;
}
let offlineFlushRunning=false;
async function flushOfflineQueue(quiet=true){
 if(offlineFlushRunning||!navigator.onLine||!S.user?.id)return;
 offlineFlushRunning=true;let synced=0;
 try{
  const queue=readOfflineQueue();
  for(const item of queue){
   if(item.userId!==S.user.id)continue;
   try{
    const headers={"content-type":"application/json"},csrf=readCsrfCookie();if(csrf)headers["x-csrf-token"]=csrf;
    const response=await fetch("/api"+item.path,{method:item.method,credentials:"same-origin",headers,body:JSON.stringify(item.body)});
    if(!response.ok)break;
    let latest=readOfflineQueue();latest=latest.filter(x=>x.queue_id!==item.queue_id);writeOfflineQueue(latest);synced++;
   }catch{break}
  }
 }finally{offlineFlushRunning=false}
 if(synced&&!quiet)toast("تمت مزامنة "+synced+" عملية محفوظة دون اتصال.");
}
window.addEventListener("online",()=>flushOfflineQueue(false));
async function api(path,opt={}){
 const method=String(opt.method||"GET").toUpperCase(),base=String(path).split("?")[0];
 let bodyData=parseOfflineBody(opt.body),requestOptions={...opt};
 if(method==="POST"&&(base==="/quran/progress"||base==="/groups")&&bodyData&&!bodyData.id){
  bodyData={...bodyData,id:"offline-"+(crypto.randomUUID?crypto.randomUUID():Date.now()+"-"+Math.random().toString(36).slice(2))};
  requestOptions.body=JSON.stringify(bodyData);
 }
 const h={"content-type":"application/json",...(S.token?{authorization:"Bearer "+S.token}:{}),...(requestOptions.headers||{})};
 if(["POST","PUT","PATCH","DELETE"].includes(method)){const csrf=readCsrfCookie();if(csrf)h["x-csrf-token"]=csrf}
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
 try{
  const r=await fetch("/api"+path,{...requestOptions,credentials:"same-origin",headers:h,signal:controller.signal});
  const raw=await r.text();let d;
  try{d=raw?JSON.parse(raw):{}}
  catch{const type=r.headers.get("content-type")||"غير محدد";const preview=raw.replace(/\\s+/g," ").slice(0,180);throw Error("رد غير صالح من الخادم — "+r.status+" — نوع المحتوى: "+type+(preview?" — "+preview:" — استجابة فارغة"))}
  if(!r.ok)throw Error(d.error||("فشل الطلب ("+r.status+")"));
  if(offlineSessionActive){offlineSessionActive=false;rememberOfflineUser()}
  if(cacheableApiPath(path,method)){
   try{const serialized=JSON.stringify({saved_at:Date.now(),value:d});if(serialized.length<1500000)safeStore.set(offlineCacheKey(path),serialized)}catch{}
  }
  return d;
 }catch(e){
  if(e instanceof TypeError||(!navigator.onLine&&e.name!=="AbortError")){
   if(canQueueOffline(path,method)&&enqueueOfflineWrite(path,method,bodyData)){
    if(base==="/attendance")return {ok:true,saved:(bodyData?.items||[]).length,queued_offline:true};
    if(base==="/quran/progress")return {...bodyData,queued_offline:true};
    if(base==="/groups"&&method==="POST")return {...bodyData,queued_offline:true};
    if(method==="PATCH")return {ok:true,queued_offline:true};
   }
   if(method==="GET"&&cacheableApiPath(path,method)){
    try{const raw=safeStore.get(offlineCacheKey(path));if(raw){const cached=JSON.parse(raw),value=mergeOfflineQueue(path,cached.value);return value}}catch{}
   }
   if(e.name==="AbortError")throw Error("انتهت مهلة الاتصال بالخادم بعد 12 ثانية. أعد المحاولة عند استقرار الشبكة.");
   throw Error(method==="GET"?"لا يوجد اتصال؛ تعذّر الاتصال بالخادم ولا توجد نسخة محفوظة لهذا القسم على هذا الجهاز.":"لا يوجد اتصال. لم تُحفظ العملية محليًا لهذا النوع؛ أعدها عند عودة الشبكة.");
  }
  if(e.name==="AbortError")throw Error("انتهت مهلة الاتصال بالخادم بعد 12 ثانية أثناء انتظار الاستجابة. أعد المحاولة؛ إذا تكرر الأمر فالمشكلة في مسار API أو قاعدة البيانات.");
  if(e instanceof TypeError)throw Error("تعذّر الاتصال بخادم الأكاديمية. تحقق من الاتصال ثم أعد المحاولة.");
  throw e;
 }finally{clearTimeout(timer)}
}


function playUiSound(kind="click"){
 if(safeStore.get("ihsan_ui_sounds")==="0")return;
 try{
  const Ctx=window.AudioContext||window.webkitAudioContext;if(!Ctx)return;
  const ctx=playUiSound.ctx||(playUiSound.ctx=new Ctx());
  if(ctx.state==="suspended")ctx.resume().catch(()=>{});
  const patterns=kind==="success"?[{f:659.25,t:0,d:.12},{f:830.61,t:.105,d:.14},{f:987.77,t:.23,d:.22}]:kind==="error"?[{f:392,t:0,d:.12},{f:311.13,t:.12,d:.18}]:[{f:740,t:0,d:.045},{f:988,t:.035,d:.055}];
  for(const note of patterns){
   const osc=ctx.createOscillator(),gain=ctx.createGain(),tone=ctx.createBiquadFilter();
   osc.type=kind==="click"?"sine":"triangle";osc.frequency.setValueAtTime(note.f,ctx.currentTime+note.t);
   tone.type="lowpass";tone.frequency.value=kind==="click"?2600:1900;
   const start=ctx.currentTime+note.t,end=start+note.d;
   gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(kind==="click"?.018:.045,start+.012);
   gain.gain.exponentialRampToValueAtTime(.0001,end);
   osc.connect(tone);tone.connect(gain);gain.connect(ctx.destination);osc.start(start);osc.stop(end+.015);
  }
 }catch{}
}
function toast(t,err=false){const old=$(".toast");if(old)old.remove();const e=document.createElement("div");e.className="toast"+(err?" error":"");e.textContent=t;document.body.append(e);if(err)playUiSound("error");else if(/تم|نجاح|حُفظ|نُشر|أُضيف|اكتمل|تفعيل|تثبيت/.test(t))playUiSound("success");setTimeout(()=>e.remove(),3500)}
document.addEventListener("click",e=>{if(safeStore.get("ihsan_ui_sounds")==="0")return;const target=e.target instanceof Element?e.target.closest("button,[role=button],.pressable"):null;if(!target||target.disabled||target.id==="settings-sound-preview")return;playUiSound("click")},true);
function showAcademyAbout(){
 const old=$("#academy-about-dialog");if(old)old.remove();
 const dialog=document.createElement("dialog");dialog.id="academy-about-dialog";dialog.className="academy-about-dialog";
 dialog.setAttribute("aria-labelledby","academy-about-title");
 dialog.innerHTML='<div class="academy-about-head"><div><span class="eyebrow">أكاديمية الإحسان</span><h2 id="academy-about-title">منارات العلم وبساتين الإحسان</h2><p>قرآنٌ يُتقن، وعلمٌ ينفع، وخُلُقٌ يزكو.</p></div><button type="button" class="settings-close" id="academy-about-close" aria-label="إغلاق">×</button></div><div class="academy-about-body"><section class="academy-about-vision"><span class="about-kicker">رسالتنا</span><h3>بناء إنسانٍ يعرف ربَّه، ويتبع هدي نبيّه ﷺ، ويعمل بعلمه.</h3></section><div class="academy-about-grid"><article class="academy-about-card"><span class="about-number">01</span><h3>المدرسة القرآنية</h3><p>الطلاب · الأفواج · الحضور · الحفظ والمراجعة.</p></article><article class="academy-about-card"><span class="about-number">02</span><h3>منهج الإحسان</h3><p>معرفة الله تعالى · السيرة · القرآن · السنة · الأدب والعمل.</p></article><article class="academy-about-card"><span class="about-number">03</span><h3>التقدم والتحفيز</h3><p>بطاقات · نقاط · مستويات · جوائز بضوابط واضحة.</p></article><article class="academy-about-card"><span class="about-number">04</span><h3>التربية</h3><p>إخلاص · إتقان · رفق · عدل · أدب.</p></article><article class="academy-about-card"><span class="about-number">05</span><h3>برنامج «الحال المرتحل»</h3><p>مسار متدرّج لتثبيت القرآن ومراجعته.</p></article></div><section class="academy-about-principles"><h3>الهيكل التنظيمي</h3><div class="ihsan-org-chart"><div class="ihsan-org-node ihsan-org-root">الشيخ · إدارة الأكاديمية</div><span class="ihsan-org-line"></span><div class="ihsan-org-node">المدرسة القرآنية</div><span class="ihsan-org-line"></span><div class="ihsan-org-node">الأفواج</div><span class="ihsan-org-line"></span><div class="ihsan-org-node">الفرق والطلاب</div><div class="ihsan-org-supervisors"><span>كبير المشرفين</span><span>المشرفون</span><span>الفرق</span></div></div></section><p class="academy-about-footnote" aria-label="ستظهر في المهام اليومية والخطط الأسبوعية ذات الصلة">النصوص الشرعية تُنقل بأمانة، وما كان من صياغة الأكاديمية لا يُنسب إلى الوحي.</p></div><div class="academy-about-footer"><span>اللهم ارزقنا الإخلاص والقبول.</span><button type="button" class="btn" id="academy-about-done">متابعة</button></div>';
 document.body.append(dialog);
 const close=()=>{try{if(dialog.open)dialog.close()}catch{}dialog.remove()};
 $("#academy-about-close")?.addEventListener("click",close);$("#academy-about-done")?.addEventListener("click",close);
 dialog.addEventListener("click",e=>{if(e.target===dialog)close()});
 if(typeof dialog.showModal==="function")dialog.showModal();else dialog.setAttribute("open","");
}
function renderTopActions(){
 const installed=ihsanIsInstalled();
 const entryView=!S.user||S.mode==="hub";
 let actions=!S.user?'<button class="btn secondary academy-about-trigger" id="academy-about-open" type="button" aria-label="التعريف بالأكاديمية ورؤيتها">عن الأكاديمية</button> ':"";
 if(S.user)actions+='<button class="btn secondary" id="settings-open" type="button" aria-label="إعدادات الأكاديمية">الإعدادات</button> ';
 if(entryView)actions+='<button class="btn secondary install-app-button" id="install-app" type="button" '+(installed?'disabled aria-label="التطبيق مثبت بالفعل"':'aria-label="تثبيت أكاديمية الإحسان على الهاتف"')+'>'+(installed?'التطبيق مثبت':'تثبيت الأكاديمية')+'</button>';
 if(S.user)actions+=' <button class="btn secondary" id="logout" type="button">خروج</button>';
 const topActions=$("#top-actions");if(topActions)topActions.innerHTML=actions;
 $("#academy-about-open")?.addEventListener("click",showAcademyAbout);$("#settings-open")?.addEventListener("click",showSettings);$("#switch-module-top")?.addEventListener("click",()=>moduleChooser());$("#logout")?.addEventListener("click",logout);
 $("#install-app")?.addEventListener("click",async()=>{if(ihsanIsInstalled()){toast("أكاديمية الإحسان مثبتة بالفعل على هذا الجهاز.");return}const p=ihsanInstallPrompt;if(!p){showInstallGuide();return}ihsanInstallPrompt=null;try{await p.prompt();const choice=await p.userChoice;if(choice?.outcome==="accepted")toast("اتبع تعليمات المتصفح لإكمال تثبيت الأكاديمية.");else toast("يمكنك التثبيت لاحقًا من قائمة المتصفح.")}catch{showInstallGuide()}});
}

function showSettings(){
 const old=$("#settings-dialog");if(old)old.remove();
 const themeMode="fixed";
 const storedIndex=safeStore.get("ihsan_theme_index");
 const rawIndex=Number(storedIndex||0);
 const selectedIndex=Number.isInteger(rawIndex)&&rawIndex>=0&&rawIndex<themes.length?rawIndex:0;
 const reduced=safeStore.get("ihsan_reduce_motion")==="1";
 const notes=["الهوية الرسمية لأكاديمية الإحسان","هدوء قرآني بلمسة زمردية"];
 const themeMarkup=themes.map((t,i)=>'<button type="button" class="theme-choice" data-theme-index="'+i+'" aria-pressed="'+(i===selectedIndex)+'"><span class="theme-swatch theme-swatch-'+i+'" aria-hidden="true"><i></i></span><span class="theme-choice-copy"><strong>'+esc(t.name)+'</strong><small>'+notes[i]+'</small></span><span class="theme-check" aria-hidden="true">✓</span></button>').join("");
 const googleLinked=Boolean(S.user?.google_linked)||safeStore.get("ihsan_google_linked")==="1";
 const securityMarkup=S.user?'<section class="settings-section"><div class="settings-section-title"><span class="settings-icon" aria-hidden="true">⌑</span><div><h3>الحساب والأمان</h3><p>احمِ حسابك بكلمة مرور قوية لا تستخدمها في موقع آخر.</p></div></div><div class="student-actions"><button type="button" class="btn" id="settings-password">تغيير كلمة المرور</button>'+(googleLinked?'<span class="google-linked-status" role="status">✓ Google مرتبط بهذا الحساب</span>':'<button type="button" class="btn secondary" id="settings-google-link">ربط حساب Google</button>')+'</div><div id="settings-google-link-area" class="google-login-section hidden"><div id="settings-google-link-host"></div><p id="settings-google-link-note" class="muted small">اربط حساب Google بحساب الأكاديمية الحالي؛ لن يُنشأ حساب جديد.</p></div></section>':'<section class="settings-section"><h3>الحساب والأمان</h3><p class="muted small">سجّل الدخول لإدارة إعدادات حسابك وكلمة المرور.</p></section>';
 const releaseMarkup='<section class="settings-section release-history-section"><div class="settings-section-title"><span class="settings-icon" aria-hidden="true">▤</span><div><h3>المميزات وسجل التطوير</h3><p>أهم مراحل المشروع الموثقة في سجل المستودع؛ هذه قائمة بالمراحل الكبرى لا بكل إصلاح صغير.</p></div></div><div class="release-history-list"><article class="release-history-item"><strong>V65 — رحلة الطالب والمتجر الصادق ومراجعة الخطط</strong><p>أُضيفت رحلة بداية تحاور الطالب سؤالًا واحدًا في كل مرة، وتحفظ تقدمها لتُستأنف بعد الانقطاع، ثم تعرض ثلاث خطط حفظ وتثبيت وورد بتكلفة الوقت لا بالمال، وتطبّق الخطة عبر مسار القرآن القائم نفسه دون جدول أو محفظة جديدة. ويمكن للطالب قبول التوصية أو تعديلها، وتُرسل الخطة إلى الشيخ ليعتمدها أو يطلب تعديلًا بملاحظة موثّقة عبر تبويب «خطط الطلاب» في واجهة الشيخ. كما أُعيد بناء المتجر ليعرض فقط المكافآت الحقيقية التي يعتمدها المدير مع تكلفتها ومخزونها وحدّها لكل طالب وشروط صرفها؛ لا منتجات وهمية ولا بذر تجريبي، وتُحجز النقاط عند الطلب وتُعاد تلقائيًا عند الرفض. أرقام التثبيت المرجعية (60←نصف، 45←ثلاثة أثمان، 30←ربع، 15←ثمن) معروضة كمقترح ينتظر اعتماد الشيخ، وليست شرطًا نهائيًا.</p></article><article class="release-history-item"><strong>V64 — نظام المسابقات القرآنية والعلمية</strong><p>أُضيف نظام مسابقات كامل داخل الأكاديمية نفسها: تصنيفات حفظ (15/30/45/60 حزبًا ومسابقة 60 حزبًا مستقلة)، وأنواع حفظ وترتيل وتجويد وحديث ومتون وسيرة وثقافة إسلامية، وشروط سنّ وحزب ورواية قابلة للتعديل، ودورة حياة من المسودة إلى الإعلان فالتسجيل فالتحكيم فالنتائج فالتكريم فالأرشفة. التحكيم بشري بمعايير قابلة للتخصيص ومتوسط عدة محكمين، والنتائج لا تُعتمد ولا تُمنح الجوائز إلا بصلاحية صريحة، وكل جائزة تُمنح مرة واحدة عبر سجل النقاط القائم دون المساس بسجلات الحضور أو الحفظ الأصلية. كما أصبح التقويم وشروط كل دورة بيانات قابلة للتحرير دون تعديل الشيفرة، والنسخة الاحتياطية الكاملة v4 تشمل جداول المسابقات.</p></article><article class="release-history-item"><strong>V63 — نسخة كاملة v3 للاستعادة</strong><p>أُصلح نقص خطير: النسخة الكاملة السابقة كانت تصدّر الحسابات والأفواج والطلاب والسجلات والمدارس وسجل التدقيق فقط، بينما كانت الاستعادة تتجاهل اقتصاد النقاط ومسار القرآن. الآن تشمل النسخة v3 قواعد النقاط وحركاتها والمتجر وطلبات الصرف وخطط القرآن واليومي والرفيق والمحطات والاستدراك، مع تحقق كامل من العلاقات ورفض التعارضات قبل الدمج. ملفات v2 القديمة ما زالت مقبولة، والحد الأقصى للملف 16 ميغابايت.</p></article><article class="release-history-item"><strong>V14 · الأساس التقني</strong><p>تهيئة واجهات وواجهات API، وفحوص صحة، وضبط الصلاحيات، وتجهيز مسارات الانتقال إلى قاعدة بيانات منظمة.</p></article><article class="release-history-item"><strong>V18 · متابعة التعليم</strong><p>أدوات الحضور الجماعي، والواجبات والاختبارات، وسجل الطالب، وملاحظات المعلم والتقارير الشهرية ولوحة ولي الأمر ضمن نطاق الصلاحيات.</p></article><article class="release-history-item"><strong>V23 · ربط التعلم بالحياة الدراسية</strong><p>توسيع المحتوى التعليمي، ومهام الطالب، والتواصل، ومسارات التعلم ومتابعة الإنجاز.</p></article><article class="release-history-item"><strong>V31 · نواة بيانات منظمة</strong><p>إضافة مخطط وترحيل قابلين للتحقق للبيانات المنظمة؛ لا يعني ذلك أن كل مسار تشغيل قد انتقل إلى تلك النواة.</p></article><article class="release-history-item"><strong>V49 · تنظيم المدرسة والفرق</strong><p>تنظيم الفرق الطلابية ومشرفيها، وبوابة المدرسة القرآنية، وتحسينات التثبيت والاستخدام على الهاتف.</p></article><article class="release-history-item"><strong>V56–V58 · المحتوى التعليمي</strong><p>حزم أولية للدروس والأسئلة، ثم توسيعها إلى 26 درسًا و92 سؤالًا تدريبيًا بحسب سجل المشروع؛ ويظل المحتوى الشرعي قابلًا لمراجعة الشيخ قبل نشره.</p></article><article class="release-history-item"><strong>نسخة Cloudflare · Pages وD1</strong><p>واجهة عربية RTL، وجلسات عبر كوكيز آمنة، وربط Google للحسابات المربوطة، وتطبيق ويب قابل للتثبيت.</p></article><article class="release-history-item"><strong>مسار القرآن · حفظ وتثبيت وورد ورفيق ومحطات واستدراك</strong><p>صفحة قرآنية واحدة للطالب تجمع الحفظ الجديد والتثبيت والورد اليومي، وتسميع الرفيق الثنائي ببطاقة 50/20/15/15، ومحطات الشيخ 15/30/45/60، وسجل استدراك يمنع الحفظ الجديد عند وجود مقدار أساسي متأخر. السجلات تُحفظ في D1 وتُطبع بطاقاتها.</p></article><article class="release-history-item"><strong>صيانة 22 أكتوبر 2026 · منشورة</strong><p>تحسين التباين الليلي والخط، وتنظيم القوائم، وتدوير الآيات دون زر يدوي، وترتيب الطلاب حسب المجالات، وحفظ الحضور وتسجيلات القرآن وبعض تعديلات الأفواج محليًا عند انقطاع الشبكة ثم مزامنتها عند عودتها. اجتازت فحوص الكود والبناء والنشر؛ ولا يزال اختبار الاستخدام الفعلي على الهاتف والحاسوب مطلوبًا لتأكيد التجربة كاملة.</p></article></div></section>';
 const notificationsMarkup='<section class="settings-section browser-notifications-section"><div class="settings-section-title"><span class="settings-icon" aria-hidden="true">♧</span><div><h3>تنبيهات التطبيق على الهاتف</h3><p>إشعار المتصفح لتحديثات الأكاديمية على هذا الجهاز.</p></div></div><p class="muted small" id="settings-notification-state">جارٍ التحقق من صلاحية إشعارات المتصفح.</p><div class="student-actions"><button type="button" class="btn" id="settings-notifications-enable">تفعيل التنبيهات</button><button type="button" class="btn secondary" id="settings-notifications-test">تجربة إشعار</button></div><p class="muted small">هذه إشعارات المتصفح المتاحة حاليًا، وليست بعدُ خدمة إشعارات دفع تعمل من الخادم بعد إغلاق التطبيق.</p></section>';
 const markup='<dialog id="settings-dialog" class="settings-dialog" aria-labelledby="settings-title"><div class="settings-head"><div><span class="eyebrow">تفضيلاتك الشخصية</span><h2 id="settings-title">إعدادات الأكاديمية</h2><p id="settings-chapter-subtitle">الحساب والأمان — الهوية وكلمة المرور</p></div><button type="button" class="settings-close" id="settings-close" aria-label="إغلاق الإعدادات">×</button></div><div class="settings-layout"><nav class="settings-rail" id="settings-rail" aria-label="أقسام الإعدادات"></nav><div class="settings-body"><section class="settings-section settings-contact-section"><div class="settings-section-title"><span class="settings-icon" aria-hidden="true">✆</span><div><h3>التواصل والمساعدة</h3><p>قنوات مباشرة للملاحظات والتحسين والتنبيهات.</p></div></div><div class="settings-help-grid"><article class="settings-help-card"><h4>التواصل مع صاحب الأكاديمية</h4><p>للاستفسارات وملاحظات الاستخدام.</p><a class="btn" href="https://wa.me/213652358723?text=%D8%A7%D9%84%D8%B3%D9%84%D8%A7%D9%85%20%D8%B9%D9%84%D9%8A%D9%83%D9%85%D8%8C%20%D8%A3%D8%B1%D9%8A%D8%AF%20%D8%A7%D9%84%D8%AA%D9%88%D8%A7%D8%B5%D9%84%20%D8%A8%D8%B4%D8%A3%D9%86%20%D8%A3%D9%83%D8%A7%D8%AF%D9%8A%D9%85%D9%8A%D8%A9%20%D8%A7%D9%84%D8%A5%D8%AD%D8%B3%D8%A7%D9%86" target="_blank" rel="noopener noreferrer">واتساب · 0652358723</a></article><article class="settings-help-card"><h4>التنبيهات والأخطاء</h4><p>راجع التنبيهات، وأرسل بلاغًا مع اسم الصفحة والخطوات التي سبقت الخطأ.</p><button type="button" class="btn secondary" id="settings-open-notifications">فتح التنبيهات</button><a class="btn secondary" href="https://wa.me/213652358723?text=%D8%A8%D9%84%D8%A7%D8%BA%20%D8%B9%D9%86%20%D8%AE%D8%B7%D8%A3%3A%20%D8%A7%D8%B3%D9%85%20%D8%A7%D9%84%D8%B5%D9%81%D8%AD%D8%A9%20%D9%88%D8%B5%D9%81%20%D8%A7%D9%84%D8%AE%D8%B7%D8%A3%20%D9%88%D8%A7%D9%84%D8%AE%D8%B7%D9%88%D8%A7%D8%AA" target="_blank" rel="noopener noreferrer">الإبلاغ عن خطأ</a></article><article class="settings-help-card"><h4>ساعدنا على التطوير</h4><p>سجّل الحفظ بعد الحلقة مباشرة، وتأكد من رقم الثمن، واقترح تحسينًا محددًا مع ذكر الصفحة التي تخصه.</p><a class="btn secondary" href="https://wa.me/213652358723?text=%D8%A7%D9%82%D8%AA%D8%B1%D8%A7%D8%AD%20%D9%84%D8%AA%D8%B7%D9%88%D9%8A%D8%B1%20%D8%A3%D9%83%D8%A7%D8%AF%D9%8A%D9%85%D9%8A%D8%A9%20%D8%A7%D9%84%D8%A5%D8%AD%D8%B3%D8%A7%D9%86%3A%20" target="_blank" rel="noopener noreferrer">إرسال اقتراح</a></article><article class="settings-help-card"><h4>دعم الأكاديمية بالتبرع</h4><p>للتبرع والاستفسار عن وسيلة الدعم المتاحة، تواصل مع المالك؛ لم تُضف بيانات دفع غير مؤكدة.</p><a class="btn" href="https://wa.me/213652358723?text=%D8%A3%D8%B1%D8%BA%D8%A8%20%D9%81%D9%8A%20%D8%AF%D8%B9%D9%85%20%D8%A3%D9%83%D8%A7%D8%AF%D9%8A%D9%85%D9%8A%D8%A9%20%D8%A7%D9%84%D8%A5%D8%AD%D8%B3%D8%A7%D9%86%20%D8%A8%D8%A7%D9%84%D8%AA%D8%A8%D8%B1%D8%B9" target="_blank" rel="noopener noreferrer">التبرع ودعم المشروع</a></article></div></section>'+notificationsMarkup+'<section class="settings-section"><div class="settings-section-title"><span class="settings-icon" aria-hidden="true">◈</span><div><h3>ألوان الواجهة</h3><p>اختر سمة، وستتغيّر ألوان الصفحات والبطاقات معًا.</p></div></div><div class="theme-options">'+themeMarkup+'</div></section><section class="settings-section appearance-studio"><div class="settings-section-title"><span class="settings-icon" aria-hidden="true">✦</span><div><h3>تخصيص الواجهة</h3><p>خصّص الخلفية والأيقونات وحجم الخط بما يناسبك.</p></div></div><div class="appearance-grid"><div class="appearance-field"><label>خلفية الصفحات</label><div class="appearance-buttons"><button type="button" class="appearance-choice" data-appearance-bg="glow">✦ وهج</button><button type="button" class="appearance-choice" data-appearance-bg="geometry">◇ هندسية</button><button type="button" class="appearance-choice" data-appearance-bg="plain">○ صافية</button></div></div><div class="appearance-field"><label>شكل الأيقونات</label><div class="appearance-buttons appearance-icon-style-options"><button type="button" class="appearance-choice" data-icon-style="soft"><span class="appearance-demo-icon" data-demo-style="soft" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3 14.8 9.2 21 12 14.8 14.8 12 21 9.2 14.8 3 12 9.2 9.2Z"/></svg></span><span>ناعمة</span></button><button type="button" class="appearance-choice" data-icon-style="bold"><span class="appearance-demo-icon" data-demo-style="bold" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3 14.8 9.2 21 12 14.8 14.8 12 21 9.2 14.8 3 12 9.2 9.2Z"/></svg></span><span>بارزة</span></button><button type="button" class="appearance-choice" data-icon-style="framed"><span class="appearance-demo-icon" data-demo-style="framed" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3 14.8 9.2 21 12 14.8 14.8 12 21 9.2 14.8 3 12 9.2 9.2Z"/></svg></span><span>مؤطّرة</span></button></div></div><div class="appearance-field"><label>حجم الأيقونات <span class="muted small">معاينة بالحجم الحقيقي</span></label><div class="appearance-buttons appearance-icon-size-options"><button type="button" class="appearance-choice" data-icon-size="small"><span class="appearance-size-demo" data-demo-size="small" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 12h16M12 4v16"/><circle cx="12" cy="12" r="8"/></svg></span><span>صغير</span></button><button type="button" class="appearance-choice" data-icon-size="medium"><span class="appearance-size-demo" data-demo-size="medium" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 12h16M12 4v16"/><circle cx="12" cy="12" r="8"/></svg></span><span>متوسط</span></button><button type="button" class="appearance-choice" data-icon-size="large"><span class="appearance-size-demo" data-demo-size="large" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 12h16M12 4v16"/><circle cx="12" cy="12" r="8"/></svg></span><span>كبير</span></button></div></div><div class="appearance-live-preview" aria-live="polite"><div><strong>معاينة الأيقونات في الأكاديمية</strong><p>تتغيّر هذه الأمثلة فورًا مع اختيار الحجم والشكل، لتتخيّل ظهورها في القوائم والبطاقات.</p></div><div class="appearance-live-icons"><span class="appearance-live-item"><svg viewBox="0 0 24 24" class="nav-icon" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/></svg><small>الرئيسية</small></span><span class="appearance-live-item"><svg viewBox="0 0 24 24" class="nav-icon" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v18H6.5A2.5 2.5 0 0 1 4 17.5z"/><path d="M4 17.5A2.5 2.5 0 0 1 6.5 15H20"/></svg><small>القرآن</small></span><span class="appearance-live-item"><svg viewBox="0 0 24 24" class="nav-icon" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m12 21-1.45-1.32C5.4 14.99 2 11.9 2 8.1 2 5 4.42 2.5 7.5 2.5c1.74 0 3.41.81 4.5 2.1 1.09-1.29 2.76-2.1 4.5-2.1C19.58 2.5 22 5 22 8.1c0 3.8-3.4 6.89-8.55 11.59z"/></svg><small>إنجازي</small></span><span class="appearance-live-item"><svg viewBox="0 0 24 24" class="nav-icon" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 4 4L19 6"/></svg><small>المهام</small></span></div></div><div class="appearance-field appearance-font-field"><label for="settings-font-scale">حجم الخط <output id="settings-font-scale-value">100%</output></label><input id="settings-font-scale" type="range" min="85" max="180" step="5" value="'+Math.round(Math.min(1.8,Math.max(.85,Number(safeStore.get("ihsan_font_scale")||1)))*100)+'"><div class="appearance-range-labels"><span>أصغر</span><span>أكبر</span></div><p class="appearance-font-preview" id="settings-font-preview">بسم الله الرحمن الرحيم — العلم النافع والعمل الصالح</p></div></div></section><section class="settings-section"><div class="settings-section-title"><span class="settings-icon" aria-hidden="true">◌</span><div><h3>الأصوات والراحة</h3><p>مؤثرات قصيرة غير لحنية، دون موسيقى أو نغمات؛ للنقر والنجاح والتنبيه.</p></div></div><label class="settings-preference" for="settings-ui-sounds"><span><strong>مؤثرات الواجهة</strong><small>تشغيل أو إيقاف أصوات الضغط والنتائج على هذا الجهاز.</small></span><input id="settings-ui-sounds" type="checkbox" '+(safeStore.get("ihsan_ui_sounds")!=="0"?'checked':'')+'></label><div class="student-actions"><button type="button" class="btn secondary" id="settings-sound-preview">تجربة الصوت</button><span class="muted small" id="settings-sound-status">'+(safeStore.get("ihsan_ui_sounds")==="0"?'الأصوات متوقفة':'الأصوات مفعّلة')+'</span></div></section><section class="settings-section"><div class="settings-section-title"><span class="settings-icon" aria-hidden="true">◌</span><div><h3>الحركة والراحة</h3><p>خفّف الحركات الانتقالية إذا فضّلت واجهة أكثر هدوءًا.</p></div></div><label class="settings-preference" for="settings-reduced-motion"><span><strong>تقليل الحركة</strong><small>إيقاف الحركات والزخارف المتحركة غير الضرورية.</small></span><input id="settings-reduced-motion" type="checkbox" '+(reduced?'checked':'')+'></label></section>'+securityMarkup+releaseMarkup+'</div></div><div class="settings-foot"><span>أكاديمية الإحسان في بناء الإنسان</span></div></dialog>';
 document.body.insertAdjacentHTML("beforeend",markup);
 const dialog=$("#settings-dialog");
  // Organize the long settings panel into four quiet chapters; every existing control stays in place.
  const settingsBody=dialog.querySelector(".settings-body");
  const rail=dialog.querySelector("#settings-rail");
  const subtitle=dialog.querySelector("#settings-chapter-subtitle");
  const chapters=[
   {icon:"⌑",label:"الحساب والأمان",hint:"الهوية وكلمة المرور",match:/الحساب والأمان/},
   {icon:"✦",label:"المظهر والألوان",hint:"الهوية البصرية",match:/ألوان الواجهة|تخصيص الواجهة/},
   {icon:"♧",label:"الراحة والتنبيهات",hint:"تجربة أهدأ",match:/تنبيهات التطبيق|الأصوات والراحة|الحركة والراحة/},
   {icon:"✆",label:"المساعدة والمعلومات",hint:"تواصل وسجل التطوير",match:/التواصل والمساعدة|المميزات وسجل التطوير/}
  ];
  const sections=settingsBody?[...settingsBody.querySelectorAll(":scope > .settings-section")]:[];
  sections.forEach((section,index)=>{
   const title=(section.querySelector("h3")?.textContent||"").trim();
   const found=chapters.findIndex(chapter=>chapter.match.test(title));
   const chapter=found<0?chapters.length-1:found;
   section.dataset.settingsChapter=String(chapter);
   section.id=section.id||"settings-section-"+(index+1);
   section.hidden=chapter!==0;
  });
  if(rail){
   chapters.forEach((chapter,index)=>{
    const button=document.createElement("button");
    button.type="button";button.className="settings-rail-btn";button.dataset.settingsChapter=String(index);
    button.setAttribute("aria-pressed",String(index===0));
    const controlled=sections.filter(item=>Number(item.dataset.settingsChapter)===index).map(item=>item.id).join(" ");
    if(controlled)button.setAttribute("aria-controls",controlled);
    button.innerHTML='<span class="settings-rail-icon" aria-hidden="true">'+chapter.icon+'</span><span class="settings-rail-copy"><strong>'+chapter.label+'</strong><small>'+chapter.hint+'</small></span><span class="settings-rail-arrow" aria-hidden="true">‹</span>';
    button.addEventListener("click",()=>{
     sections.forEach(section=>{section.hidden=Number(section.dataset.settingsChapter)!==index});
     rail.querySelectorAll(".settings-rail-btn").forEach(item=>item.setAttribute("aria-pressed",String(item===button)));
     if(subtitle)subtitle.textContent=chapter.label+" — "+chapter.hint;
     if(settingsBody)settingsBody.scrollTop=0;
    });
    rail.appendChild(button);
   });
  }
 const close=()=>{try{if(dialog.open)dialog.close()}catch{}dialog.remove()};
 $("#settings-close").onclick=close;$("#settings-open-notifications")?.addEventListener("click",()=>{close();go("notifications")});
 const updateNotificationState=()=>{const el=$("#settings-notification-state");if(el)el.textContent="حالة التنبيهات: "+(typeof Notification==="undefined"?"غير مدعومة":Notification.permission==="granted"?"مسموح بها":Notification.permission==="denied"?"محظورة من إعدادات المتصفح":"لم يُطلب الإذن بعد")};
 $("#settings-notifications-enable")?.addEventListener("click",async()=>{if(!("Notification" in window)){toast("هذا المتصفح لا يدعم إشعارات النظام.",true);return}try{const permission=await Notification.requestPermission();if(permission==="granted"){safeStore.set("ihsan_browser_notifications","1");toast("فُعّلت إشعارات المتصفح على هذا الجهاز.")}else toast(permission==="denied"?"الإشعارات محظورة؛ غيّر إذن الموقع من إعدادات المتصفح.":"لم تُمنح صلاحية الإشعارات.");updateNotificationState()}catch{toast("تعذّر طلب إذن الإشعارات من هذا المتصفح.",true)}});
 $("#settings-notifications-test")?.addEventListener("click",()=>{if(!("Notification" in window)||Notification.permission!=="granted"){toast("فعّل إذن الإشعارات أولًا.",true);updateNotificationState();return}try{new Notification("أكاديمية الإحسان",{body:"التنبيهات تعمل على هذا الجهاز."})}catch{toast("تعذّر عرض الإشعار؛ قد يتطلب المتصفح تثبيت التطبيق أو إذنًا إضافيًا.",true)}});
 updateNotificationState();
 dialog.addEventListener("click",e=>{if(e.target===dialog)close()});
 const refreshThemeChoices=()=>{
  const mode=safeStore.get("ihsan_theme_mode")||"random";
  const current=themes.findIndex(t=>t.name===document.documentElement.dataset.ihsanTheme);
  dialog.querySelectorAll("[data-theme-index]").forEach(b=>b.setAttribute("aria-pressed",String(Number(b.dataset.themeIndex)===current)));
  $("#settings-theme-random")?.setAttribute("aria-pressed",String(mode!=="fixed"));
  const status=$("#theme-mode-status");
  if(status)status.textContent=mode==="fixed"?"السمة المثبتة: "+(themes[current]?.name||"مخصصة"):"عشوائي لهذه الجلسة؛ سيتغيّر عند بدء جلسة جديدة";
 };
 dialog.querySelectorAll("[data-theme-index]").forEach(button=>button.addEventListener("click",()=>{
  const i=Number(button.dataset.themeIndex);if(!Number.isInteger(i)||i<0||i>=themes.length)return;
  safeStore.set("ihsan_theme_mode","fixed");
  safeStore.set("ihsan_theme_index",String(i));
  safeStore.removeSession("ihsan_session_theme_index");
  applyTheme();
  refreshThemeChoices();
  toast("تم تثبيت سمة "+themes[i].name+" حتى تختار غيرها");
 }));
 $("#settings-theme-random")?.addEventListener("click",()=>{
  safeStore.set("ihsan_theme_mode","random");
  safeStore.removeSession("ihsan_session_theme_index");
  applyTheme();
  refreshThemeChoices();
  toast("تم تفعيل الألوان العشوائية لكل جلسة");
 });
 refreshThemeChoices();
 const appearanceControls=dialog.querySelectorAll("[data-appearance-mode],[data-appearance-bg],[data-icon-style],[data-icon-size]");
 const refreshAppearanceControls=()=>{
  dialog.querySelectorAll("[data-appearance-mode]").forEach(b=>b.classList.toggle("active",b.dataset.appearanceMode===(safeStore.get("ihsan_appearance_mode")||"auto")));
  dialog.querySelectorAll("[data-appearance-bg]").forEach(b=>b.classList.toggle("active",b.dataset.appearanceBg===(safeStore.get("ihsan_appearance_background")||"glow")));
  dialog.querySelectorAll("[data-icon-style]").forEach(b=>b.classList.toggle("active",b.dataset.iconStyle===(safeStore.get("ihsan_icon_style")||"soft")));
  dialog.querySelectorAll("[data-icon-size]").forEach(b=>b.classList.toggle("active",b.dataset.iconSize===(safeStore.get("ihsan_icon_size")||"medium")));
 };
 dialog.querySelectorAll("[data-appearance-mode]").forEach(b=>b.addEventListener("click",()=>{safeStore.set("ihsan_appearance_mode",b.dataset.appearanceMode);applyAppearanceSettings();refreshAppearanceControls()}));
 dialog.querySelectorAll("[data-appearance-bg]").forEach(b=>b.addEventListener("click",()=>{safeStore.set("ihsan_appearance_background",b.dataset.appearanceBg);applyAppearanceSettings();refreshAppearanceControls()}));
 dialog.querySelectorAll("[data-icon-style]").forEach(b=>b.addEventListener("click",()=>{safeStore.set("ihsan_icon_style",b.dataset.iconStyle);applyAppearanceSettings();refreshAppearanceControls()}));
 dialog.querySelectorAll("[data-icon-size]").forEach(b=>b.addEventListener("click",()=>{safeStore.set("ihsan_icon_size",b.dataset.iconSize);applyAppearanceSettings();refreshAppearanceControls()}));
 const fontRange=$("#settings-font-scale"),fontValue=$("#settings-font-scale-value");
 const updateFontScale=()=>{const scale=Number(fontRange.value)/100;safeStore.set("ihsan_font_scale",String(scale));applyAppearanceSettings();if(fontValue)fontValue.textContent=fontRange.value+"%";};
 fontRange?.addEventListener("input",updateFontScale);
 refreshAppearanceControls();
 $("#settings-ui-sounds")?.addEventListener("change",e=>{const enabled=e.currentTarget.checked;if(enabled)safeStore.set("ihsan_ui_sounds","1");else safeStore.set("ihsan_ui_sounds","0");const status=$("#settings-sound-status");if(status)status.textContent=enabled?"الأصوات مفعّلة":"الأصوات متوقفة";if(enabled)playUiSound("click");});$("#settings-sound-preview")?.addEventListener("click",()=>{if(safeStore.get("ihsan_ui_sounds")==="0"){safeStore.set("ihsan_ui_sounds","1");const toggle=$("#settings-ui-sounds");if(toggle)toggle.checked=true;const status=$("#settings-sound-status");if(status)status.textContent="الأصوات مفعّلة";}playUiSound("success");});
 $("#settings-reduced-motion").addEventListener("change",e=>{
  const enabled=e.currentTarget.checked;
  if(enabled)safeStore.set("ihsan_reduce_motion","1");else safeStore.remove("ihsan_reduce_motion");
  document.documentElement.classList.toggle("ihsan-reduced-motion",enabled);
  toast(enabled?"تم تقليل الحركة":"عادت الحركات إلى إعدادها الطبيعي");
 });
 $("#settings-password")?.addEventListener("click",()=>{close();showPasswordChange()});
 $("#settings-google-link")?.addEventListener("click",()=>linkGoogleAccount());
 if(typeof dialog.showModal==="function")dialog.showModal();else dialog.setAttribute("open","");
}
async function linkGoogleAccount(){
 const area=$("#settings-google-link-area"),host=$("#settings-google-link-host"),note=$("#settings-google-link-note");
 if(!area||!host||!note)return;
 area.classList.remove("hidden");
 host.innerHTML='<span class="muted small">جار تجهيز ربط Google…</span>';
 try{
  const cfg=await api("/auth/google/config");
  if(!cfg.enabled||!cfg.client_id)throw new Error("الدخول بجوجل غير مهيأ بعد.");
  await loadGoogleIdentityLibrary();
  const nonce=Array.from(crypto.getRandomValues(new Uint8Array(24)),b=>b.toString(16).padStart(2,"0")).join("");
  host.innerHTML="";
  window.google.accounts.id.initialize({client_id:cfg.client_id,nonce,callback:async res=>{
   const button=$("#settings-google-link");
   if(button)button.disabled=true;
   note.textContent="جار التحقق من Google وربطه بحسابك الحالي…";
   try{
    await api("/auth/google/link",{method:"POST",body:JSON.stringify({credential:res.credential,nonce})});
    note.textContent="تم الربط بنجاح. لن تحتاج إلى ربطه مرة أخرى؛ سيظهر خيار الدخول به في صفحة الدخول.";
    safeStore.set("ihsan_google_linked","1");
    host.innerHTML="";
    area.classList.add("hidden");
    $("#settings-google-link")?.remove();
    toast("تم ربط Google بهذا الحساب.");
   }catch(error){note.textContent=error.message||"تعذر ربط حساب Google.";toast(note.textContent,true)}
   finally{if(button)button.disabled=false}
  }});
  window.google.accounts.id.renderButton(host,{type:"standard",theme:"outline",size:"large",shape:"rectangular",text:"continue_with",locale:"ar",width:280});
  note.textContent="اختر حساب Google الذي تريد ربطه بحساب الأكاديمية المفتوح الآن.";
 }catch(error){host.innerHTML="";note.textContent=error.message||"تعذر تجهيز ربط Google.";toast(note.textContent,true)}
}
function showPasswordChange(forced=false){
 const old=document.querySelector("#password-dialog");if(old)old.remove();
 document.body.insertAdjacentHTML("beforeend",'<dialog id="password-dialog" class="password-dialog"><form id="password-form" class="stack"><h2>'+(forced?"تغيير كلمة المرور المؤقتة":"تغيير كلمة المرور")+'</h2><p class="muted small">'+(forced?"هذه كلمة مرور مؤقتة؛ يجب اختيار كلمة مرور شخصية جديدة لا تقل عن 10 أحرف قبل متابعة استخدام الأكاديمية.":"استخدم كلمة مرور جديدة لا تقل عن 10 أحرف. سيتم إبطال جلسات حسابك الأخرى بعد الحفظ.")+'</p><label class="field">كلمة المرور الحالية<input name="current_password" type="password" required autocomplete="current-password"></label><label class="field">كلمة المرور الجديدة<input name="new_password" type="password" required minlength="10" autocomplete="new-password"></label><label class="field">تأكيد كلمة المرور الجديدة<input name="confirm_password" type="password" required minlength="10" autocomplete="new-password"></label><div id="password-error" class="notice error hidden"></div><div class="student-actions"><button class="btn" type="submit">حفظ كلمة المرور</button>'+(forced?'<button class="btn secondary" type="button" id="force-logout">الخروج من الحساب</button>':'<button class="btn secondary" type="button" id="cancel-password">إلغاء</button>')+'</div></form></dialog>');
 const dialog=$("#password-dialog"),form=$("#password-form");
 const closeDialog=()=>{try{if(dialog.open)dialog.close()}catch{}dialog.remove()};
 $("#cancel-password")?.addEventListener("click",closeDialog);
 $("#force-logout")?.addEventListener("click",async()=>{closeDialog();await logout()});
 dialog.addEventListener("cancel",e=>{if(forced)e.preventDefault()});
 dialog.addEventListener("click",e=>{if(e.target===dialog&&!forced)closeDialog()});
 form.onsubmit=async e=>{e.preventDefault();const f=new FormData(form),error=$("#password-error"),button=form.querySelector('button[type="submit"]');error.classList.add("hidden");if(String(f.get("new_password")||"").length<10){error.textContent="كلمة المرور الجديدة يجب أن تكون 10 أحرف على الأقل.";error.classList.remove("hidden");return}if(f.get("new_password")!==f.get("confirm_password")){error.textContent="كلمتا المرور الجديدتان غير متطابقتين.";error.classList.remove("hidden");return}button.disabled=true;try{await api("/me/password",{method:"POST",body:JSON.stringify({current_password:f.get("current_password"),new_password:f.get("new_password")})});S.user=await api("/me");toast("تم تغيير كلمة المرور");dialog.close();dialog.remove();if(forced)await start()}catch(x){error.textContent=x.message;error.classList.remove("hidden")}finally{if(button.isConnected)button.disabled=false}}
 if(typeof dialog.showModal==="function")dialog.showModal();else dialog.setAttribute("open","");
}

function auth(setup){renderTopActions();
const authSupplications=[
 {title:"دعاء قرآني لزيادة العلم",text:"وَقُلْ رَبِّ زِدْنِي عِلْمًا",source:"القرآن الكريم · طه: 114"},
 {title:"دعاء نبوي للعلم النافع",text:"اللَّهُمَّ إِنِّي أَسْأَلُكَ عِلْمًا نَافِعًا، وَرِزْقًا طَيِّبًا، وَعَمَلًا مُتَقَبَّلًا",source:"سنن ابن ماجه (925)"},
 {title:"دعاء نبوي على العبادة",text:"اللَّهُمَّ أَعِنِّي عَلَى ذِكْرِكَ وَشُكْرِكَ وَحُسْنِ عِبَادَتِكَ",source:"سنن أبي داود (1522)، والنسائي (1303)؛ صححه الألباني"},
 {title:"دعاء قرآني جامع",text:"رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ",source:"القرآن الكريم · البقرة: 201"}
];
const authBenefits=[
 {title:"بشارة فضيلة تعليم القرآن",text:"«خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ»؛ نسأل الله تعالى أن يجعل تعليمكم مباركًا، وأن يكتب لكم أجر ما تغرسونه من خير.",source:"صحيح البخاري (5027)؛ والتشجيع بصياغة الأكاديمية."},
 {title:"فضل طريق العلم",text:"«مَنْ سَلَكَ طَرِيقًا يَلْتَمِسُ فِيهِ عِلْمًا، سَهَّلَ اللَّهُ لَهُ بِهِ طَرِيقًا إِلَى الْجَنَّةِ»؛ بارك الله تعالى في مجلس العلم وأهله.",source:"صحيح مسلم (2699)؛ والتشجيع بصياغة الأكاديمية."},
 {title:"رسالة تقدير لفضيلة الشيخ",text:"فضيلة الشيخ، أحسن الله إليكم، وبارك في وقتكم وعلمكم، ونفع بكم وبطلابكم، وجعل ما تبذلونه في تعليم القرآن وتربية النفوس في ميزان حسناتكم.",source:"دعاء من صياغة الأكاديمية، وليس حديثًا نبويًا."},
 {title:"الدعوة بالقول والعمل",text:"﴿وَمَنْ أَحْسَنُ قَوْلًا مِمَّنْ دَعَا إِلَى اللَّهِ وَعَمِلَ صَالِحًا﴾؛ نسأل الله تعالى أن يبارك في تعليمكم، ويجمع لكم نفع العلم وصلاح العمل.",source:"القرآن الكريم، سورة فصلت: 33؛ والدعاء من صياغة الأكاديمية."}
];



const scanNotice=(()=>{try{const text=safeStore.getSession("ihsan_scan_notice");if(text)safeStore.removeSession("ihsan_scan_notice");return String(text||"")}catch{return ""}})();
const authTabs=setup?'':'<div class="auth-tabs" role="tablist" aria-label="تسجيل الدخول أو إنشاء حساب"><button type="button" class="auth-tab is-active" id="tab-login" role="tab" aria-selected="true">تسجيل الدخول</button><button type="button" class="auth-tab" id="tab-signup" role="tab" aria-selected="false">إنشاء حساب</button></div>';
const loginPane='<div id="login-pane" role="tabpanel">'+'<form id="auth-form" class="stack" autocomplete="off">'+(setup?'<label class="field">رمز الإعداد<input name="code" type="password" required autocomplete="off"></label><label class="field">الاسم الكامل<input name="name" required maxlength="120"></label><label class="field">البريد الإلكتروني<input name="email" type="email" required></label><label class="field">كلمة مرور المدير (14 حرفًا على الأقل)<input name="password" type="password" minlength="14" required autocomplete="new-password"></label>':'<label class="field">الاسم الكامل أو اسم الدخول<input name="username" id="login-identity" type="text" required autocomplete="off" spellcheck="false" autocapitalize="off"></label><label class="field">كلمة المرور<span class="password-input-wrap"><input name="password" id="login-password" type="password" required autocomplete="off"><button type="button" class="password-visibility" id="toggle-login-password" aria-label="إظهار كلمة المرور" aria-pressed="false">إظهار</button></span></label>')+'<div id="auth-error" class="notice error hidden"></div><button class="btn" type="submit">'+(setup?"إنشاء حساب المدير":"تسجيل الدخول")+'</button></form>'+(!setup?'<div class="login-divider"><span>أو</span></div><section class="google-login-section" aria-label="تسجيل الدخول باستخدام Google"><div id="google-signin"></div><p id="google-login-note" class="muted small">جارٍ التحقق من إعدادات الدخول بجوجل…</p></section><p class="muted small auth-taysir-link">زائر أو محسن؟ التعرّف على الأكاديمية والمساهمة في <a href="'+esc(TAYSIR_URL)+'" rel="noopener" target="_blank">بوابة التيسير</a>؛ هذا الفضاء داخلي للطلاب والشيوخ المسجلين.</p>':'')+'</div>';
const signupPane=setup?'':'<div id="signup-pane" role="tabpanel" hidden><form id="signup-form" class="stack" autocomplete="off">'
 +'<div class="signup-kind" role="radiogroup" aria-label="نوع الحساب">'
 +'<label class="signup-kind-option"><input type="radio" name="kind" value="student" checked><span class="signup-kind-card"><strong>طالب</strong><small>أنشئ حسابك ثم اطلب الانضمام إلى المدرسة؛ يبقى طلبك قيد الاعتماد حتى يوافق الشيخ أو الإدارة</small></span></label>'
 +'<label class="signup-kind-option"><input type="radio" name="kind" value="teacher"><span class="signup-kind-card"><strong>شيخ / معلم</strong><small>طلب الانضمام بصفة شيخ أو معلم؛ لا تُفعّل الصلاحية إلا باعتماد الإدارة</small></span></label>'
 +'</div>'
 +'<label class="field">الاسم الكامل<input name="name" required maxlength="120" autocomplete="off"></label>'
 +'<label class="field">البريد الإلكتروني<input name="email" type="email" required maxlength="200" autocomplete="off" spellcheck="false" autocapitalize="off"></label>'
 +'<label class="field">كلمة المرور (10 أحرف على الأقل)<input name="password" type="password" minlength="10" maxlength="256" required autocomplete="new-password"></label>'
 +'<label class="field" id="signup-school-field">المدرسة التي تريد الانضمام إليها<select id="signup-school" name="school_id"><option value="">جار تحميل المدارس…</option></select><small class="muted">يُسند طلبك إلى هذه المدرسة ويبقى قيد الاعتماد حتى يوافق الشيخ أو الإدارة.</small></label>'
 +'<label class="field" id="signup-note-field">ملاحظة للإدارة (اختياري)<input name="note" maxlength="500" placeholder="مثال: أحفظ عدة أجزاء من القرآن"></label>'
 +'<div id="signup-error" class="notice error hidden"></div>'
 +'<button class="btn" type="submit">إنشاء الحساب</button>'
 +'</form>'
 +'<p class="muted small signup-assurance">إنشاء الحساب لا يمنحك أي صلاحيات خاصة: طالب ← يُسند إلى فوج بعد اعتماد طلبك من الشيخ أو الإدارة · شيخ/معلم ← تُفعّل الصلاحية باعتماد الإدارة فقط. أما الزائرون والمحسنون فيتعرّفون على الأكاديمية عبر بوابة التيسير.</p></div>';
app.innerHTML='<div class="auth-layout"><section class="welcome"><div><span class="eyebrow">بِسْمِ اللهِ الرَّحْمَنِ الرَّحِيمِ</span><h1>أكاديمية الإحسان في بناء الإنسان</h1></div><div class="welcome-bottom"><button type="button" class="btn academy-about-welcome" id="about-open-welcome">الهيكل التنظيمي</button></div></section><section class="panel stack">'+(setup?'<div class="notice">أول دخول: أنشئ حساب المدير مرة واحدة.</div>':'')+'<div><h2 id="auth-title">'+(setup?"إعداد الأكاديمية":"تسجيل الدخول")+'</h2></div>'+(scanNotice?'<div class="notice scan-notice" role="status">'+esc(scanNotice)+'</div>':"")+authTabs+loginPane+signupPane+'</section></div>';
$("#toggle-login-password")?.addEventListener("click",()=>{const input=$("#login-password"),button=$("#toggle-login-password");if(!input||!button)return;const reveal=input.type==="password";input.type=reveal?"text":"password";button.textContent=reveal?"إخفاء":"إظهار";button.setAttribute("aria-label",reveal?"إخفاء كلمة المرور":"إظهار كلمة المرور");button.setAttribute("aria-pressed",String(reveal));input.focus()});
 // لا تُحفظ هوية الدخول ولا كلمة المرور على هذا الجهاز؛ يعيد المستخدم إدخالها عند كل عودة.
 $("#auth-form").setAttribute("autocomplete","off");
 $("#auth-form").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.currentTarget),b=e.currentTarget.querySelector("button"),err=$("#auth-error");b.disabled=true;err.classList.add("hidden");try{if(setup){await api("/admin/bootstrap",{method:"POST",headers:{"x-bootstrap-secret":String(f.get("code"))},body:JSON.stringify({name:f.get("name"),email:f.get("email"),password:f.get("password")})});toast("تم إنشاء المدير. سجّل الدخول.");auth(false)}else{const d=await api("/login",{method:"POST",body:JSON.stringify({identity:f.get("username"),password:f.get("password"),remember:f.get("remember")==="on"})});S.token="";clearSessionToken();S.user=d.user;if(S.user?.must_change_password){renderTopActions();showPasswordChange(true)}else{await start()}}}catch(x){err.textContent=x.message;err.classList.remove("hidden")}finally{b.disabled=false}}
if(!setup){
  let signupSchoolsPromise=null;
  const loadSchools=()=>{if(!signupSchoolsPromise){signupSchoolsPromise=api("/public/signup-options").then(d=>{const select=$("#signup-school");if(!select)return d;const schools=(d&&d.schools)||[];select.innerHTML=schools.length?'<option value="">اختر المدرسة…</option>'+schools.map(s=>'<option value="'+esc(s.id)+'">'+esc(s.name)+'</option>').join(""):'<option value="">لا توجد مدارس نشطة حاليًا</option>';return d}).catch(error=>{signupSchoolsPromise=null;const select=$("#signup-school");if(select)select.innerHTML='<option value="">تعذر تحميل المدارس — أعد فتح التبويب للمحاولة</option>';throw error})}return signupSchoolsPromise};
  const syncSignupKind=()=>{const kind=($('#signup-form input[name="kind"]:checked')||{}).value||"student";$("#signup-school-field")?.classList.toggle("hidden",kind!=="student");const noteField=$("#signup-note-field");if(noteField)noteField.querySelector("input").placeholder=kind==="teacher"?"مثال: حافظ لكتاب الله وخبرة في تدريس الصغار":"مثال: أحفظ عدة أجزاء من القرآن";if(kind==="student")loadSchools().catch(()=>{})};
  const setAuthTab=tab=>{const isSignup=tab==="signup";$("#login-pane")&&($("#login-pane").hidden=isSignup);$("#signup-pane")&&($("#signup-pane").hidden=!isSignup);$("#tab-login")?.classList.toggle("is-active",!isSignup);$("#tab-signup")?.classList.toggle("is-active",isSignup);$("#tab-login")?.setAttribute("aria-selected",String(!isSignup));$("#tab-signup")?.setAttribute("aria-selected",String(isSignup));$("#auth-title")&&($("#auth-title").textContent=isSignup?"إنشاء حساب جديد":"تسجيل الدخول");if(isSignup)syncSignupKind()};
  $("#tab-login")?.addEventListener("click",()=>setAuthTab("login"));
  $("#tab-signup")?.addEventListener("click",()=>setAuthTab("signup"));
  document.querySelectorAll('#signup-form input[name="kind"]').forEach(radio=>radio.addEventListener("change",syncSignupKind));
  const signupForm=$("#signup-form");
  if(signupForm)signupForm.onsubmit=async e=>{e.preventDefault();const f=new FormData(e.currentTarget),b=e.currentTarget.querySelector("button[type=submit]"),err=$("#signup-error");b.disabled=true;err.classList.add("hidden");const kind=String(f.get("kind")||"student");try{const d=await api("/signup",{method:"POST",body:JSON.stringify({name:f.get("name"),email:f.get("email"),password:f.get("password"),kind,school_id:kind==="student"?String(f.get("school_id")||""):"",note:f.get("note")||""})});S.token="";clearSessionToken();S.user=d.user;toast(d.join_note||"تم إنشاء حسابك");renderTopActions();await start()}catch(x){const msg=String(x?.message||"");const validation=/^(أدخل|هذا البريد|كلمة المرور|اختر|المدرسة|هذا الحساب|هذا الطلب|التسجيل للطلاب|تم )/.test(msg);err.textContent=validation?msg:"تعذّر إنشاء الحساب حاليًا بسبب قيد تقني مؤقت؛ يجري تجهيز التسجيل الأولي. حاول بعد قليل أو تواصل مع إدارة الأكاديمية.";err.classList.remove("hidden");err.title=msg;b.disabled=false}};
  try{const match=/#signup=(student|teacher)/.exec(location.hash||"");if(match){const wanted=match[1];const radio=document.querySelector('#signup-form input[name="kind"][value="'+wanted+'"]');if(radio){radio.checked=true;setAuthTab("signup")}}}catch{}
 }
  rotateKnowledgeVerses();
 $("#about-open-welcome")?.addEventListener("click",showAcademyAbout);
 if(!setup)initGoogleSignIn();
}
function isOfflineNetworkError(error){
 const message=String(error?.message||error||"");
 return !navigator.onLine||/لا يوجد اتصال|تعذّر الاتصال بالخادم|تعذر الاتصال بخادم الأكاديمية|انتهت مهلة الاتصال بالخادم/.test(message);
}
function startOfflineFromCache(){
 const cachedUser=loadOfflineUser();if(!cachedUser)return false;
 offlineSessionActive=true;S.user=cachedUser;S.token="";start();toast("وضع دون اتصال: عُرضت البيانات المحفوظة على هذا الجهاز. ستُزامن العمليات المعلّقة عند عودة الاتصال.");return true;
}
async function boot(){
 try{
  const scan=readScanHash();if(scan)savePendingScan(scan);
  const statusRequest=api("/setup/status");
  const sessionRequest=api("/me");
  const st=await statusRequest;
  try{
   S.user=await sessionRequest;
   const pending=pendingScan();
   if(pending&&pending.kind==="login"){
    try{const r=await api("/cards/resolve",{method:"POST",body:JSON.stringify({kind:"login",card_id:pending.cardId,secret:pending.secret})});toast("بطاقة "+String(r.student?.name||"الطالب")+" — أنت مسجّل الدخول بالفعل.")}catch{}
    clearPendingScan();
   }
   if(S.user?.must_change_password){renderTopActions();showPasswordChange(true)}else{await start()}
  }catch(error){
   if(isOfflineNetworkError(error)&&startOfflineFromCache())return;
   S.token="";clearSessionToken();
   const pending=pendingScan();
   if(pending&&pending.kind==="login"){
    try{const r=await api("/cards/resolve",{method:"POST",body:JSON.stringify({kind:"login",card_id:pending.cardId,secret:pending.secret})});safeStore.setSession("ihsan_scan_notice","بطاقة "+String(r.student?.name||"الطالب")+" — أدخل كلمة المرور للمتابعة.")}catch{}
    clearPendingScan();
   }
   auth(st.needs_admin&&st.setup_enabled)
  }
 }catch(error){
  if(isOfflineNetworkError(error)&&startOfflineFromCache())return;
  app.innerHTML='<div class="panel"><h2>تعذّر الاتصال</h2><p class="muted">تعذّر الوصول إلى قاعدة البيانات. حدّث الصفحة بعد قليل.</p><button class="btn" id="boot-retry">إعادة المحاولة</button></div>';
  $("#boot-retry")?.addEventListener("click",()=>location.reload())
 }
}

async function logout(){
try{window.IhsanScanner&&window.IhsanScanner.stop()}catch{}
const prayers=[
{title:"وداع اليوم بدعاء من القرآن",text:"رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ",source:"سورة البقرة، الآية 201"},
{title:"دعاء قرآني للثبات",text:"رَبَّنَا لَا تُزِغْ قُلُوبَنَا بَعْدَ إِذْ هَدَيْتَنَا وَهَبْ لَنَا مِنْ لَدُنْكَ رَحْمَةً إِنَّكَ أَنْتَ الْوَهَّابُ",source:"سورة آل عمران، الآية 8"},
{title:"دعاء نبوي في طلب العلم النافع",text:"اللَّهُمَّ إِنِّي أَسْأَلُكَ عِلْمًا نَافِعًا، وَرِزْقًا طَيِّبًا، وَعَمَلًا مُتَقَبَّلًا",source:"سنن ابن ماجه، حديث 925"},
{title:"نستودع الله يومك وعملك",text:"تقبّل الله منك ما تعلّمت وعملت، وبارك في وقتك، وجعل ما حفظت نورًا لك وحجةً لك لا عليك. نلقاك على خير بإذن الله.",kind:"دعاء بصياغة الأكاديمية"},
{title:"لا تنصرف عن القرآن",text:"انتهت جلستك، لكن صلتك بالقرآن لا تنتهي. اللهم ثبّت قلبك على طاعتك، واجعل ما تعلمته نورًا يهدي خطوتك.",kind:"دعاء بصياغة الأكاديمية"},
{title:"خطوة اليوم بذرة الغد",text:"أحسنتَ بخطوة اليوم؛ وغدًا تبدأ من حيث وصلت، لا من الصفر. اللهم بارك في سعيك، واغفر تقصيرك، وارزقك الإخلاص والقبول.",kind:"دعاء بصياغة الأكاديمية"},
{title:"استوداع وأمل",text:"حفظك الله أينما كنت، وفتح لك أبواب الخير، وجعل علمك نافعًا وعملك صالحًا، ورزقك الإخلاص والقبول.",kind:"دعاء بصياغة الأكاديمية"}
];
const prayer=prayers[Math.floor(Math.random()*prayers.length)];
ihsanPrayerDialog({title:prayer.title,text:prayer.text,source:prayer.source||(prayer.kind?prayer.kind+"؛ ليس نصًا منسوبًا إلى السنة":""),icon:"☾",primary:"تسجيل الخروج",secondary:"البقاء في الأكاديمية",onPrimary:async()=>{try{await api("/logout",{method:"POST",body:"{}"})}catch{}try{history.replaceState({ihsanMode:"auth"},"",location.pathname+"#login")}catch{}document.body.classList.remove("app-authenticated");offlineSessionActive=false;S.token="";S.user=null;S.mode="hub";S.tab="home";safeStore.removeSession("ihsan_last_mode");safeStore.removeSession("ihsan_last_tab");safeStore.remove(offlineUserKey());clearSessionToken();auth(false)}})}
async function load(){
 const jobs=[api("/groups"),api("/students")];
 const teachersIndex=["admin","director"].includes(S.user.role)?jobs.push(api("/teachers"))-1:-1;
 const staffIndex=S.user.role==="admin"?jobs.push(api("/admin/staff"))-1:-1;
 const schoolsIndex=S.user.role==="admin"?jobs.push(api("/public/quran-schools"))-1:-1;
 const results=await Promise.allSettled(jobs);
 S.groups=results[0].status==="fulfilled"&&Array.isArray(results[0].value)?results[0].value:(Array.isArray(S.groups)?S.groups:[]);
 if(results[1].status==="fulfilled"&&Array.isArray(results[1].value)){
  S.students=results[1].value;
  S.studentsLoadError="";
 }else{
  S.studentsLoadError=results[1].status==="rejected"?String(results[1].reason?.message||"تعذر تحميل ملفات الطلاب"):"استجابة قائمة الطلاب غير صالحة";
  if(!Array.isArray(S.students))S.students=[];
  console.error("Ihsan roster load failed",results[1].status==="rejected"?results[1].reason:results[1].value);
 }
 S.teachers=teachersIndex>=0&&results[teachersIndex].status==="fulfilled"?results[teachersIndex].value:(Array.isArray(S.teachers)?S.teachers:[]);
 S.staff=staffIndex>=0&&results[staffIndex].status==="fulfilled"?results[staffIndex].value:(Array.isArray(S.staff)?S.staff:[]);
 S.schools=schoolsIndex>=0&&results[schoolsIndex].status==="fulfilled"?results[schoolsIndex].value:(Array.isArray(S.schools)?S.schools:[]);
}
function adminFocusIsFull(){return safeStore.get("ihsan_admin_focus")!=="daily"}
function items(){
 if(S.mode==="ihsan"){const curriculum=[["all","نظرة عامة"],["allah","معرفة الله"],["prophet","الرسول ﷺ"],["quranpath","القرآن الكريم"],["hifzprogram","الحال المرتحل"],["sunnah","السنة والمتون"],["adab","الأدب والعمل"]];if(S.user.role==="teacher")curriculum.push(["groups","أفواجي"]);return curriculum;}
 const staff=["admin","director","teacher","supervisor"].includes(S.user.role);
 if(S.user.role==="admin"){
  const full=adminFocusIsFull();
  const daily=[["home","الرئيسية"],["groups","الأفواج وحسابات المعلمين"],["students","الطلاب"],["cards","بطاقات الطلاب"],["scan","المسح والمتابعة", "join-requests","طلبات الانضمام"],["join-requests","طلبات الانضمام"],["attendance","الحضور"],["quran","الحفظ والمراجعة"],["effort","تسجيل المتابعة اليومية"],["teams","الفرق"],["effort-ranking","الترتيب الأسبوعي/الشهري"],["points","النقاط والمتجر"],["notifications","التنبيهات"],["messages","الرسائل"]];
  if(!full)return daily;
  return [["home","الرئيسية"],["groups","الأفواج"],["students","الطلاب"],["cards","بطاقات الطلاب"],["scan","المسح والمتابعة", "join-requests","طلبات الانضمام"],["join-requests","طلبات الانضمام"],["attendance","الحضور"],["quran","الحفظ والمراجعة"],["effort","تسجيل المتابعة اليومية"],["teams","الفرق"],["effort-ranking","الترتيب الأسبوعي/الشهري"],["points","النقاط والمتجر"],["notifications","التنبيهات"],["messages","الرسائل"],["assignments","الواجبات"],["tests","الاختبارات"],["hadith","الحديث والمتون"],["competitions","المسابقات"],["system-check","فحص النظام"],["hierarchy","التسلسل الإداري"],["roadmap","خريطة الإنجاز"]];
 }
 if(S.user.role==="director")return [["home","الرئيسية"],["groups","الأفواج والمعلمون والفرق"],["students","طلاب المدرسة"],["cards","بطاقات الطلاب"],["scan","المسح والمتابعة", "join-requests","طلبات الانضمام"],["join-requests","طلبات الانضمام"],["roster-bulk","إضافة أسماء الطلبة"],["attendance","الحضور"],["quran","الحفظ والمراجعة"],["effort-ranking","الترتيب الأسبوعي/الشهري"],["points","النقاط والمتجر"],["effort","تسجيل المتابعة اليومية"],["notifications","التنبيهات"],["messages","الرسائل"],["assignments","الواجبات"],["tests","الاختبارات"],["hadith","الحديث والمتون"],["competitions","المسابقات"]];
 if(S.user.role==="supervisor")return [["home","الرئيسية"],["students","طلاب فريقي"],["cards","بطاقات الطلاب"],["scan","المسح والمتابعة", "join-requests","طلبات الانضمام"],["teams","فرقي الطلابية"],["attendance","الحضور"],["quran","متابعة الحفظ والمراجعة"],["effort-ranking","الترتيب الأسبوعي/الشهري"],["points","النقاط والمتجر"],["effort","تسجيل المتابعة اليومية"],["notifications","التنبيهات"],["messages","الرسائل"],["assignments","الواجبات"],["tests","الاختبارات"],["hadith","الحديث والمتون"],["competitions","المسابقات"]];
 if(S.user.role==="teacher")return [["home","الرئيسية"],["students","طلبتي"],["cards","بطاقات الطلاب"],["scan","المسح والمتابعة", "join-requests","طلبات الانضمام"],["join-requests","طلبات الانضمام"],["roster-bulk","إضافة أسماء الطلبة"],["groups","أفواجي"],["teams","فرقي الطلابية"],["attendance","الحضور"],["quran","متابعة الحفظ والمراجعة"],["effort-ranking","الترتيب الأسبوعي/الشهري"],["points","النقاط والمتجر"],["effort","تسجيل المتابعة اليومية"],["reports","التقارير"],["sheikh-check","فحص واجهة الشيخ"],["notifications","التنبيهات"],["messages","الرسائل"],["assignments","الواجبات"],["tests","الاختبارات"],["hadith","الحديث والمتون"],["competitions","المسابقات"]];
 if(S.user.role==="visitor")return [["home","الرئيسية"]];
 if(S.user.role==="student"&&!S.user.group_id)return [["home","الرئيسية"]];
 return [["world","عالمي"],["home","الرئيسية"],["profile","ملفي"],["tasks","مهامي"],["quran","تقدمي في القرآن"],["card","بطاقتي"],["points","النقاط والمتجر"],["leaderboard","الترتيب العام"],["guide","دليل الرحلة"],["teams","فرقتي وطلبات النقل"],["hadith","الحديث والمتون"],["competitions","المسابقات"],["assignments","واجباتي"],["gradebook","تقدمي ودرجاتي"],["attendance","حضوري"],["tests","اختباراتي"],["notifications","التنبيهات"],["messages","الرسائل"]];
}



function honorificDisplayName(name,role){const clean=String(name||"").replace(/^فضيلة الشيخ[،\s]*/,"").replace(/[،]?\s*حفظه الله ونفع به$/,"").trim();if(["admin","director","teacher"].includes(role))return "فضيلة الشيخ "+clean+"، حفظه الله ونفع به";return clean||"مستخدم"}
const ROLE_LABELS={admin:"فضيلة الشيخ · مدير الأكاديمية",director:"فضيلة الشيخ · مدير المدرسة",teacher:"فضيلة الشيخ",supervisor:"مشرف الفرقة الطلابية",student:"الطالب",visitor:"زائر / محسن"};
// بوابة التيسير العامة (خارج الأكاديمية) — حدّث الرابط إذا نُشرت التيسير على نطاق آخر.
const TAYSIR_URL="https://a-taysir.pages.dev";
const IHSAN_PREVIEW_ONLY=true;
const IHSAN_PREVIEW_SECTIONS=[
 {id:"allah",title:"معرفة الله تعالى"},
 {id:"prophet",title:"صحبة الرسول ﷺ"},
 {id:"quranpath",title:"القرآن الكريم"},
 {id:"hifzprogram",title:"الحال المرتحل"},
 {id:"sunnah",title:"السنة والمتون"},
 {id:"adab",title:"الأدب والعمل"}
];
const NAV_ICON_PATHS={
 home:'<path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9"/><path d="M9 20v-6h6v6"/>',
 groups:'<path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
 teachers:'<path d="M12 15l-3 3-3-3"/><path d="M9 18v3"/><circle cx="9" cy="8" r="4"/><path d="M16 11h5"/><path d="M18.5 8.5v5"/>',
 students:'<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0"/><path d="M19 8v6"/><path d="M16 11h6"/>',
 attendance:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/><path d="m8 15 2 2 5-5"/>',
 assignments:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
 gradebook:'<path d="M4 19V5"/><path d="M4 19h17"/><path d="m7 15 3-4 3 2 5-7"/><circle cx="18" cy="6" r="1"/>',
 messages:'<path d="M21 11.5a7.5 7.5 0 0 1-7.5 7.5H7l-4 2v-5.5A7.5 7.5 0 1 1 21 11.5Z"/><path d="M8 11h8M8 14h5"/>',
 posts:'<path d="M4 4h16v16H4z"/><path d="M8 8h8M8 12h8M8 16h5"/>',
 notifications:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
 reports:'<path d="M4 19V5"/><path d="M4 19h17"/><rect x="7" y="11" width="3" height="5" rx=".5"/><rect x="13" y="7" width="3" height="9" rx=".5"/><rect x="19" y="4" width="2" height="12" rx=".5"/>',
 quran:'<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v18H6.5A2.5 2.5 0 0 1 4 17.5z"/><path d="M4 17.5A2.5 2.5 0 0 1 6.5 15H20"/><path d="M8 6h7M8 9h6"/>',
 tests:'<path d="M8 4H5v17h14V4h-3"/><rect x="8" y="2" width="8" height="4" rx="1"/><path d="m8 12 2 2 4-4M8 17h7"/>',
 profile:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
 leaderboard:'<path d="M8 21h8M12 17v4"/><path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4v2a4 4 0 0 0 4 4M17 6h3v2a4 4 0 0 1-4 4"/>',
 points:'<circle cx="12" cy="12" r="8"/><path d="m12 8 1.2 2.4 2.8.4-2 2 .5 2.7-2.5-1.3-2.5 1.3.5-2.7-2-2 2.8-.4z"/>',
 "system-check":'<path d="M12 3 20 6v5c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z"/><path d="m8.5 12 2.2 2.2 4.8-5"/>',
 all:'<path d="M4 19V5"/><path d="M4 19h17"/><path d="m7 15 4-4 3 2 5-6"/>',
 allah:'<path d="M12 21v-9"/><path d="M12 15C5 15 3 11 3 6c5 0 9 2 9 9Z"/><path d="M12 12c0-5 3-8 9-8 0 5-3 8-9 8Z"/>',
 prophet:'<path d="M7 3.5h11a2 2 0 0 1 2 2v15H8a3 3 0 0 1-3-3v-11a3 3 0 0 1 2-3Z"/><path d="M5 17.5a3 3 0 0 1 3-3h12M9 8h7M9 11h5"/>',
 quranpath:'<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v18H6.5A2.5 2.5 0 0 1 4 17.5z"/><path d="M4 17.5A2.5 2.5 0 0 1 6.5 15H20"/>',
 sunnah:'<path d="M6 3h12v18l-6-4-6 4z"/><path d="m9 9 2 2 4-4"/>',
 adab:'<path d="M12 3 14 9l6 1-4.5 4 1 6-4.5-3-4.5 3 1-6L4 10l6-1z"/>',
 hifzprogram:'<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v18H6.5A2.5 2.5 0 0 1 4 17.5z"/><path d="M4 17.5A2.5 2.5 0 0 1 6.5 15H20M8 6h7M8 9h6"/>',
 tasks:'<path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9"/>',
 world:'<path d="M4 20h16"/><path d="M6 20v-7a6 6 0 0 1 12 0v7"/><path d="M12 3v2"/><path d="m9 20-.5-6M15 20l.5-6"/><path d="m12 8 1 2 2 .5-1.5 1.5.3 2-1.8-1-1.8 1 .3-2L9 10.5l2-.5z"/>',
 card:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18"/><path d="M7 15h4"/>',
 guide:'<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
 hadith:'<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v18H6.5A2.5 2.5 0 0 1 4 17.5z"/><path d="M4 17.5A2.5 2.5 0 0 1 6.5 15H20"/><path d="m11 6 1.5 1.5L15 5"/>',
 competitions:'<path d="M8 3h8v5a4 4 0 0 1-8 0z"/><path d="M8 5H5v2a3 3 0 0 0 3 3M16 5h3v2a3 3 0 0 1-3 3"/><path d="M12 12v5M9 21h6M10 17h4"/>',
 scan:'<rect x="4" y="4" width="6" height="6" rx="1.2"/><rect x="14" y="4" width="6" height="6" rx="1.2"/><rect x="4" y="14" width="6" height="6" rx="1.2"/><path d="M14 14h2.5v2.5M20 14v.01M14 20v.01M17.5 17.5H20V20"/>',
 'join-requests':'<rect x="4" y="4" width="16" height="16" rx="2"/><path d="m9.5 12.2 1.8 1.8 3.7-4"/>',
 effort:'<path d="M9 5h11M9 12h11M9 19h11"/><path d="m3.5 5 1.3 1.3L7.5 3.5M3.5 12l1.3 1.3 2.7-2.8M3.5 19l1.3 1.3 2.7-2.8"/>'
};
function navIcon(id){return '<svg viewBox="0 0 24 24" class="nav-icon" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'+(NAV_ICON_PATHS[id]||'<circle cx="12" cy="12" r="8"/>')+'</svg>'}
function navigationGroups(){
 const list=items();if(S.mode==="ihsan")return [{title:"منهج الإحسان",items:list}];
 const makeGroup=(title,ids)=>({title,items:list.filter(x=>ids.includes(x[0]))});
 const effortGroup=()=>makeGroup("الترتيب الأسبوعي/الشهري",["effort-ranking"]);
 if(S.user.role==="admin"){
  const full=adminFocusIsFull();
  if(!full)return [
   makeGroup("الرئيسية والطلاب",["home","students","cards","scan","join-requests", "join-requests","طلبات الانضمام"]),
   makeGroup("المهام الأساسية اليومية",["attendance","quran","effort"]),
   makeGroup("الأفواج والفرق",["groups","teams"]),
   effortGroup(),
   makeGroup("النقاط والمتجر",["points"]),
   makeGroup("التواصل",["notifications","messages"])
  ].filter(g=>g.items.length);
  return [
   makeGroup("إدارة الأكاديمية",["home","groups","students","cards","scan","join-requests", "join-requests","طلبات الانضمام","teams"]),
   makeGroup("المهام الأساسية اليومية",["attendance","quran","effort"]),
   effortGroup(),
   makeGroup("النقاط والمتجر",["points"]),
   makeGroup("التواصل",["notifications","messages"]),
   makeGroup("أدوات إضافية وتحسينية",["assignments","tests","hadith","competitions","system-check"])
  ].filter(g=>g.items.length);
 }
 if(S.user.role==="supervisor")return [
  makeGroup("متابعة الفريق",["home","students","cards","scan","teams", "join-requests","طلبات الانضمام"]),
  makeGroup("المهام الأساسية اليومية",["attendance","quran"]),
  effortGroup(),
  makeGroup("النقاط والمتجر",["points"]),
  makeGroup("المتابعة والتقويم",["gradebook","reports","notifications","messages"]),
  makeGroup("أدوات إضافية",["assignments","tests","hadith","competitions"])
 ].filter(g=>g.items.length);
 if(["teacher","director"].includes(S.user.role))return [
  makeGroup(S.user.role==="director"?"إدارة المدرسة":"التدريس والمتابعة",["home","groups","students","cards","scan","join-requests", "join-requests","طلبات الانضمام","teams"]),
  makeGroup("المهام الأساسية اليومية",["attendance","quran"]),
  effortGroup(),
  makeGroup("النقاط والمتجر",["points"]),
  makeGroup("المتابعة والتقويم",["gradebook","reports","notifications","messages"]),
  makeGroup("أدوات إضافية",["assignments","tests","hadith","competitions"])
 ].filter(g=>g.items.length);
 if(S.user.role==="visitor"||(S.user.role==="student"&&!S.user.group_id))return [makeGroup("الرئيسية",["home"])];
 return [makeGroup("عالمي",["world","card"]),makeGroup("رحلتي اليومية",["home","profile","tasks","quran","attendance","tests"]),makeGroup("إنجازاتي",["points","leaderboard","gradebook","guide"]),makeGroup("محتوى الأكاديمية",["hadith","competitions","assignments"]),makeGroup("التواصل والفرق",["teams","notifications","messages"])].filter(g=>g.items.length);
}

function navMarkup(){const seen=new Set();return navigationGroups().map(group=>{const unique=group.items.filter(x=>{if(seen.has(x[0]))return false;seen.add(x[0]);return true});return unique.length?'<div class="nav-section"><div class="nav-section-title">'+esc(group.title)+'</div>'+unique.map(x=>'<button class="nav-btn '+(S.tab===x[0]?"active":"")+'" data-tab="'+esc(x[0])+'"><span class="nav-icon-wrap">'+navIcon(x[0])+'</span><span class="nav-label">'+esc(x[1])+'</span><span class="nav-chevron" aria-hidden="true">‹</span></button>').join("")+'</div>':""}).join("")}

async function ihsanPrayerDialog({title,text,source="",icon="✦",primary="متابعة",secondary="لاحقًا",onPrimary=()=>{},onSecondary=()=>{}}){
 const previous=document.getElementById("ihsan-prayer-dialog");if(previous)previous.remove();
 const dialog=document.createElement("dialog");dialog.id="ihsan-prayer-dialog";dialog.dir="rtl";dialog.style.cssText="width:min(520px,calc(100% - 32px));border:1px solid var(--line);border-radius:24px;padding:0;color:var(--ink);background:var(--surface);box-shadow:0 24px 80px #0004";
 if(!document.getElementById("ihsan-prayer-dialog-style")){const style=document.createElement("style");style.id="ihsan-prayer-dialog-style";style.textContent="#ihsan-prayer-dialog::backdrop{background:#10251dcc;backdrop-filter:blur(5px)}";document.head.appendChild(style)}
 const wrap=document.createElement("div");wrap.style.cssText="padding:clamp(22px,5vw,34px);text-align:center";
 const mark=document.createElement("div");mark.textContent=icon;mark.setAttribute("aria-hidden","true");mark.style.cssText="display:grid;place-items:center;width:54px;height:54px;margin:0 auto 15px;border-radius:18px;background:var(--mint);color:var(--green);font-size:27px";
 const brand=document.createElement("p");brand.textContent="أكاديمية الإحسان في بناء الإنسان";brand.style.cssText="font-size:12px;color:var(--muted);margin:0 0 8px";
 const h=document.createElement("h2");h.textContent=title;h.style.cssText="font-size:clamp(21px,4vw,27px);line-height:1.5;margin:0 0 12px";
 const p=document.createElement("p");p.textContent=text;p.style.cssText="font-size:16px;line-height:2.05;margin:0 auto 16px;max-width:42ch";
 const sourceLine=document.createElement("p");sourceLine.textContent=source;sourceLine.style.cssText="font-size:12px;line-height:1.8;color:var(--muted);margin:0 auto 22px;max-width:46ch";sourceLine.hidden=!source;
 const actions=document.createElement("div");actions.style.cssText="display:flex;flex-wrap:wrap;gap:10px;justify-content:center";
 const makeButton=(label,primary)=>{const b=document.createElement("button");b.type="button";b.textContent=label;b.style.cssText="min-height:44px;border-radius:12px;padding:10px 18px;cursor:pointer;font:inherit;font-weight:700;border:1px solid "+(primary?"var(--green)":"var(--line)")+";background:"+(primary?"var(--green)":"var(--surface-2)")+";color:"+(primary?"#fff":"var(--ink)");return b};
 const yes=makeButton(primary,true),no=secondary?makeButton(secondary,false):null;actions.append(yes);if(no)actions.append(no);wrap.append(mark,brand,h,p,sourceLine,actions);dialog.append(wrap);document.body.append(dialog);
 const close=async fn=>{try{if(dialog.open)dialog.close()}catch{}dialog.remove();await fn()};
 yes.addEventListener("click",()=>close(onPrimary));if(no)no.addEventListener("click",()=>close(onSecondary));dialog.addEventListener("cancel",e=>{e.preventDefault();close(onSecondary)});dialog.addEventListener("click",e=>{if(e.target===dialog)close(onSecondary)});
 if(typeof dialog.showModal==="function")dialog.showModal();else dialog.setAttribute("open","");
 yes.focus()
}
function start(){
 startLiveSync();
 rememberOfflineUser();flushOfflineQueue(true);
 renderTopActions();
 const pending=pendingScan();
 const savedMode=safeStore.getSession("ihsan_last_mode"),savedTab=safeStore.getSession("ihsan_last_tab");
 if(pending&&pending.kind!=="login"){
  const target=pending.kind==="profile"&&S.user?.role==="student"?"profile":"students";
  S.mode="school";S.tab=target;safeStore.setSession("ihsan_last_mode","school");safeStore.setSession("ihsan_last_tab",target);
  load().then(async()=>{shell();await page();await processPendingScan()});
  return;
 }
 const isVisitor=S.user?.role==="visitor";
 const isPendingStudent=S.user?.role==="student"&&!S.user?.group_id;
 if(isVisitor||isPendingStudent){S.mode="school";S.tab="home";safeStore.setSession("ihsan_last_mode","school");safeStore.setSession("ihsan_last_tab","home");load().then(async()=>{shell();await page()});return}
 if(savedMode==="ihsan"){safeStore.setSession("ihsan_last_mode","hub");safeStore.removeSession("ihsan_last_tab");S.tab="home";S.mode="hub";moduleChooser(false);return}
 if(savedMode==="school"){
  S.mode=savedMode;
  const wanted=savedTab||(S.user?.role==="student"?"world":"home");
  let allowed=new Set();
  try{allowed=new Set(items().flatMap(pair=>Array.isArray(pair)?[pair[0]]:[]))}catch{}
  S.tab=allowed.size&&allowed.has(wanted)?wanted:(S.user?.role==="student"?"world":"home");
  if(["backup","audit","school-managers","posts","teachers"].includes(S.tab))S.tab=S.user?.role==="admin"?"groups":"home";if(S.tab==="system-check"&&S.user?.role!=="admin")S.tab="home";
  load().then(async()=>{shell();await page();await processPendingScan()});
  return;
 }
 S.tab="home";S.mode="hub";showRotatingEntryPrayer();moduleChooser(false);
}
function showRotatingEntryPrayer(){
 const prayers=[
  {title:"دعاء قرآني لزيادة العلم",text:"وَقُلْ رَبِّ زِدْنِي عِلْمًا",source:"القرآن الكريم، سورة طه: 114"},
  {title:"دعاء قرآني للثبات والرحمة",text:"رَبَّنَا لَا تُزِغْ قُلُوبَنَا بَعْدَ إِذْ هَدَيْتَنَا وَهَبْ لَنَا مِنْ لَدُنْكَ رَحْمَةً إِنَّكَ أَنْتَ الْوَهَّابُ",source:"القرآن الكريم، سورة آل عمران: 8"},
  {title:"دعاء من القرآن الكريم",text:"رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ",source:"القرآن الكريم، سورة البقرة: 201"},
  {title:"دعاء نبوي للعلم النافع",text:"اللَّهُمَّ إِنِّي أَسْأَلُكَ عِلْمًا نَافِعًا، وَرِزْقًا طَيِّبًا، وَعَمَلًا مُتَقَبَّلًا",source:"سنن ابن ماجه (925)، وصححه الألباني في صحيح ابن ماجه"},
  {title:"دعاء نبوي على ذكر الله",text:"اللَّهُمَّ أَعِنِّي عَلَى ذِكْرِكَ وَشُكْرِكَ وَحُسْنِ عِبَادَتِكَ",source:"سنن أبي داود (1522)، وصححه الألباني"},
  {title:"دعاء نبوي للثبات",text:"يَا مُقَلِّبَ الْقُلُوبِ ثَبِّتْ قَلْبِي عَلَى دِينِكَ",source:"جامع الترمذي (2140)، قال الترمذي: حديث حسن"}
 ];
 const previous=Number(safeStore.getSession("ihsan_last_prayer_index")||-1);
 const candidates=prayers.map((p,i)=>({p,i})).filter(x=>x.i!==previous);
 const picked=candidates[Math.floor(Math.random()*candidates.length)]||{p:prayers[0],i:0};
 safeStore.setSession("ihsan_last_prayer_index",String(picked.i));
 const currentMode=S.mode,currentTab=S.tab,student=S.user?.role==="student";
 const inHub=currentMode==="hub"||!currentMode;
 return ihsanPrayerDialog({
  title:picked.p.title,text:picked.p.text,source:picked.p.source,icon:"☾",
  primary:"متابعة",
  secondary:"",
  onPrimary:()=>{
   if(!inHub){S.mode=currentMode;S.tab=currentTab;return}
   moduleChooser();
  },
  onSecondary:()=>{}
 });
}

function ihsanIntentionReminder(){
 const previous=safeStore.getSession("ihsan_entry_reminder")||"ikhlas";
 const next=previous==="niyyah"?"ikhlas":"niyyah";
 safeStore.setSession("ihsan_entry_reminder",next);
 return next==="niyyah"?{title:"جدّد النية",text:"نتعلّم ونعمل ابتغاء مرضاة الله."}:{title:"جدّد الإخلاص",text:"اجعل قصدك لله وحده، واسأله القبول."};
}
function animateModuleChange(work){
 if(document.body.classList.contains("ihsan-module-transition"))return;
 document.body.classList.add("ihsan-module-transition");
 const reminder=ihsanIntentionReminder();
 const overlay=document.createElement("div");
 overlay.className="ihsan-transition-screen";
 overlay.setAttribute("aria-hidden","true");
 overlay.innerHTML='<div class="ihsan-transition-mark">إحسان</div><span class="ihsan-transition-spinner" aria-hidden="true"></span><strong class="ihsan-transition-reminder">'+reminder.title+'</strong><p class="ihsan-transition-reminder-text">'+reminder.text+'</p>';
 document.body.append(overlay);
 requestAnimationFrame(()=>overlay.classList.add("is-visible"));
 Promise.resolve().then(work).catch(error=>{console.error(error);toast(error?.message||"تعذر فتح القسم",true)}).finally(()=>{
  overlay.classList.remove("is-visible");
  window.setTimeout(()=>{overlay.remove();document.body.classList.remove("ihsan-module-transition")},160);
 });
}
function moduleChooser(push=true){
 safeStore.setSession("ihsan_last_mode","hub");safeStore.removeSession("ihsan_last_tab");document.body.classList.remove("app-authenticated");
 const outerHeader=document.querySelector("header.topbar"),actionBar=$("#top-actions");if(outerHeader&&actionBar&&!outerHeader.contains(actionBar))outerHeader.appendChild(actionBar);
 S.mode="hub";if(push){try{history.pushState({ihsanMode:"hub"},"",location.pathname+"#home")}catch{}}
 renderTopActions();
 const hubName=honorificDisplayName(S.user.name,S.user.role),hubRole=ROLE_LABELS[S.user.role]||"عضو الأكاديمية",hubInitial=esc((S.user.name||"إ").trim().slice(0,1)),entryReminder=ihsanIntentionReminder();
 app.innerHTML='<section class="module-welcome"><span class="eyebrow">أَكَادِيمِيَّةُ الإِحْسَانِ فِي بِنَاءِ الإِنْسَان</span><h1>'+(S.user.role==="student"?"تجوّل في بساتين الإحسان":"منارات العلم وبساتين الإحسان")+'</h1><div class="module-user-line"><span class="module-user-avatar" aria-hidden="true">'+hubInitial+'</span><span class="module-user-copy"><strong>'+esc(hubName)+'</strong><small>'+esc(hubRole)+'</small></span></div><div class="ihsan-entry-reminder"><span>'+esc(entryReminder.title)+'</span><strong>'+esc(entryReminder.text)+'</strong></div></section><div class="module-grid"><button class="module-card school-module" id="open-school"><span class="module-art school-art" aria-hidden="true"><svg viewBox="0 0 64 64"><path d="M7 27 32 9l25 18v28H7z"/><path d="M17 55V34h30v21M26 55V41h12v14M17 27h30M23 20h18"/></svg></span><span class="module-label">المدرسة القرآنية</span><span class="module-desc">قرآن · طلاب · أفواج · متابعة</span><span class="module-link">دخول المدرسة ←</span></button><button class="module-card ihsan-module" id="open-ihsan"><span class="module-art ihsan-art" aria-hidden="true"><svg viewBox="0 0 64 64"><path d="M32 7 38 22 54 27 38 33 32 49 26 33 10 27 26 22z"/><path d="M48 40 51 47 58 50 51 53 48 60 45 53 38 50 45 47zM15 7l2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/></svg></span><span class="module-label">منهج الإحسان</span><span class="module-desc">وحي · علم · أدب · عمل</span><span class="module-link">استعراض العناوين · قريبًا ←</span></button></div><div class="module-about-action"><button type="button" class="btn secondary" id="about-open-hub">الهيكل التنظيمي</button></div><p class="module-foot">﴿ وَقُلْ رَبِّ زِدْنِي عِلْمًا ﴾</p>';
 $("#about-open-hub")?.addEventListener("click",showAcademyAbout);$("#open-school").onclick=openSchoolModule;$("#open-ihsan").onclick=openIhsanTeaser;
}
function openSchoolModule(){return animateModuleChange(async()=>{const tab=S.user?.role==="student"?"world":"home";safeStore.setSession("ihsan_last_mode","school");safeStore.setSession("ihsan_last_tab",tab);try{history.pushState({ihsanMode:"school",ihsanTab:tab},"",location.pathname+"#school")}catch{}S.mode="school";S.tab=tab;await load();shell();await page()})}
function openIhsanTeaser(){
 if(!IHSAN_PREVIEW_ONLY)return;
 const existing=$("#ihsan-teaser");if(existing)existing.remove();
 const dialog=document.createElement("dialog");
 dialog.id="ihsan-teaser";dialog.dir="rtl";dialog.className="ihsan-teaser";
 dialog.innerHTML='<div class="ihsan-teaser-head"><span class="eyebrow">الوحدة الثانية · قريبًا</span><h2>منهج الإحسان</h2><p>ستُفتح هذه الوحدة بعد اعتماد محتواها ومراجعته من أهل العلم. نعرض الآن عناوين الأقسام فقط، دون محتوى أو بيانات.</p></div><ul class="ihsan-teaser-sections">'+IHSAN_PREVIEW_SECTIONS.map((s,i)=>'<li><span class="ihsan-teaser-num" aria-hidden="true">'+String(i+1).padStart(2,"0")+'</span><strong>'+esc(s.title)+'</strong><small>بانتظار الإطلاق</small></li>').join("")+'</ul><p class="ihsan-teaser-note">لا يتوفر الآن تسجيل أو بيانات أو نقاط لهذه الوحدة. المدرسة القرآنية هي المساحة الفعّالة حاليًا.</p><div class="ihsan-teaser-actions"><button type="button" class="btn" id="teaser-school">الدخول إلى المدرسة القرآنية</button><button type="button" class="btn secondary" id="teaser-close">إغلاق</button></div>';
 document.body.append(dialog);
 const close=()=>{try{if(dialog.open)dialog.close()}catch{}dialog.remove()};
 $("#teaser-close")?.addEventListener("click",close);
 $("#teaser-school")?.addEventListener("click",()=>{close();openSchoolModule()});
 dialog.addEventListener("click",e=>{if(e.target===dialog)close()});
 if(typeof dialog.showModal==="function")dialog.showModal();else dialog.setAttribute("open","");
 $("#teaser-close")?.focus();
}


function mobilePrimaryItems(){
 const list=items(),preferred=S.user?.role==="student"?["world","quran","tasks","points"]:["home","students","scan","attendance","quran"];
 const chosen=preferred.map(id=>list.find(x=>x[0]===id)).filter(Boolean),result=chosen.slice(0,4);
 for(const item of list){if(result.length>=4)break;if(!result.some(x=>x[0]===item[0]))result.push(item)}
 return result;
}
function mobilePrimaryMarkup(){
 const chosen=mobilePrimaryItems();
 return '<nav class="mobile-primary-nav" aria-label="التنقل السريع">'+chosen.map(item=>'<button type="button" class="mobile-primary-item'+(S.tab===item[0]?" is-active":"")+'" data-tab="'+esc(item[0])+'" aria-current="'+(S.tab===item[0]?"page":"false")+'"><span class="mobile-primary-icon">'+navIcon(item[0])+'</span><span>'+esc(item[1])+'</span></button>').join("")+'<button type="button" class="mobile-primary-item mobile-primary-more" id="mobile-more-open" aria-haspopup="dialog"><span class="mobile-primary-icon" aria-hidden="true">⋯</span><span>المزيد</span></button></nav>';
}
function mobileMoreMarkup(){
 const showSwitch=!(S.user?.role==="visitor"||(S.user?.role==="student"&&!S.user?.group_id));
 const adminButton=S.user?.role==="admin"?'<button type="button" class="mobile-more-action" id="mobile-more-admin"><span>▦</span><strong>'+(adminFocusIsFull()?"العودة إلى مهام الشيخ":"عرض كل أدوات الإدارة")+'</strong></button>':"";
 const switchButton=showSwitch?'<button type="button" class="mobile-more-action" id="mobile-more-switch"><span>↔</span><strong>'+(S.mode==="school"?"منهج الإحسان":"المدرسة القرآنية")+'</strong></button>':"";
 return '<dialog id="mobile-more-dialog" class="mobile-more-dialog" dir="rtl" aria-labelledby="mobile-more-title"><div class="mobile-more-grabber" aria-hidden="true"></div><header class="mobile-more-head"><div><span class="eyebrow">مساحة الأكاديمية</span><h2 id="mobile-more-title">كل الأقسام والأدوات</h2><p>جميع الصفحات المتاحة لحسابك، مرتبة بحسب المهمة والصلاحية.</p></div><button type="button" class="settings-close" id="mobile-more-close" aria-label="إغلاق">×</button></header><div class="mobile-more-scroll">'+navMarkup()+'</div><div class="mobile-more-actions"><button type="button" class="mobile-more-action" id="mobile-more-account"><span>◉</span><strong>حسابي</strong></button><button type="button" class="mobile-more-action" id="mobile-more-settings"><span>⚙</span><strong>الإعدادات</strong></button>'+adminButton+switchButton+'<button type="button" class="mobile-more-action" id="mobile-more-install"><span>↓</span><strong>تثبيت التطبيق</strong></button><button type="button" class="mobile-more-action is-danger" id="mobile-more-logout"><span>↪</span><strong>تسجيل الخروج</strong></button></div></dialog>';
}
function closeMobileMore(){const dialog=$("#mobile-more-dialog");if(dialog?.open){try{dialog.close()}catch{dialog.removeAttribute("open")}}}

function shell(){
 const retainedActions=$("#top-actions"),retainedHeader=document.querySelector("header.topbar");if(retainedActions&&retainedHeader&&!retainedHeader.contains(retainedActions))retainedHeader.appendChild(retainedActions);
 document.body.classList.add("app-authenticated");
 const current=items().find(x=>x[0]===S.tab);
 const currentTitle=current?current[1]:(S.mode==="ihsan"?"منهج الإحسان":"الرئيسية");
 const role=ROLE_LABELS[S.user.role]||"عضو الأكاديمية";
 const initial=esc((S.user.name||"إ").trim().slice(0,1));
 const displayUserName=honorificDisplayName(S.user.name,S.user.role);
 const banner="";
 const options=items().map(x=>'<option value="'+esc(x[1])+'"></option>').join("");
 const showModuleSwitch=!(S.user?.role==="visitor"||(S.user?.role==="student"&&!S.user?.group_id));
 app.innerHTML='<div class="layout app-shell"><nav class="sidebar" aria-label="القائمة الرئيسية"><div class="sidebar-brand"><img class="sidebar-brand-logo" src="/icon.svg" alt="" width="48" height="48"><span class="sidebar-brand-copy"><strong>أكاديمية الإحسان</strong><small>في بناء الإنسان</small></span></div><div class="sidebar-navigation">'+navMarkup()+'</div><button class="nav-btn mobile-settings" id="mobile-settings" type="button" aria-label="إعدادات الأكاديمية"><span class="nav-icon-wrap" aria-hidden="true">⚙</span><span class="nav-label">الإعدادات</span></button><button class="nav-btn mobile-logout" id="mobile-logout" type="button" aria-label="تسجيل الخروج"><span class="nav-icon-wrap" aria-hidden="true">↪</span><span class="nav-label">خروج</span></button><div class="sidebar-bottom">' +(S.user.role==="admin"?'<button class="admin-focus-toggle" id="admin-focus-toggle" type="button">' +(adminFocusIsFull()?"العودة إلى مهام الشيخ":"واجهة الإدارة") +'</button>':"") +(showModuleSwitch?'<button class="module-switch" id="switch-module" type="button"><span aria-hidden="true">↔</span> '+(S.mode==="school"?"منهج الإحسان (قريبًا)":"الذهاب إلى المدرسة القرآنية")+'</button>':"")+'</div></nav><section class="workspace"><header class="workspace-head"><div class="workspace-heading"><div class="breadcrumbs"><strong id="workspace-title">'+esc(currentTitle)+'</strong></div><p>'+esc(role)+'</p></div><label class="workspace-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/></svg><input id="nav-search" type="search" list="nav-search-options" placeholder="ابحث عن صفحة…" aria-label="ابحث عن صفحة في القائمة"><datalist id="nav-search-options">'+options+'</datalist></label><div class="workspace-wallet" id="workspace-wallet" aria-live="polite"></div><button class="workspace-user" id="identity-open" type="button" aria-haspopup="dialog" aria-label="حسابي: '+esc(displayUserName)+' — '+esc(role)+'"><span class="workspace-status" aria-hidden="true"></span><span class="workspace-user-copy"><strong>'+esc(displayUserName)+'</strong><small>'+esc(role)+'</small></span><span class="workspace-user-caret" aria-hidden="true">⌄</span></button></header><div class="content-area">'+banner+'<section id="view" class="content"><div class="loading">جار التحميل…</div></section></div></section></div>'+mobilePrimaryMarkup()+mobileMoreMarkup();
 const actionBar=$("#top-actions"),innerHeader=document.querySelector(".workspace-head");if(actionBar&&innerHeader)innerHeader.appendChild(actionBar);
 document.querySelectorAll(".nav-btn[data-tab]").forEach(b=>b.onclick=()=>{closeMobileMore();go(b.dataset.tab)});document.querySelectorAll(".mobile-primary-item[data-tab]").forEach(b=>b.onclick=()=>go(b.dataset.tab));$("#mobile-settings")?.addEventListener("click",showSettings);$("#mobile-logout")?.addEventListener("click",logout);
  const moreDialog=$("#mobile-more-dialog");
  $("#mobile-more-open")?.addEventListener("click",()=>{if(typeof moreDialog?.showModal==="function")moreDialog.showModal();else moreDialog?.setAttribute("open","")});
  $("#mobile-more-close")?.addEventListener("click",closeMobileMore);
  moreDialog?.addEventListener("click",event=>{if(event.target===moreDialog)closeMobileMore()});
  $("#mobile-more-account")?.addEventListener("click",()=>{closeMobileMore();identitySheet()});
  $("#mobile-more-settings")?.addEventListener("click",()=>{closeMobileMore();showSettings()});
  $("#mobile-more-admin")?.addEventListener("click",()=>{closeMobileMore();toggleAdminFocus()});
  $("#mobile-more-switch")?.addEventListener("click",()=>{closeMobileMore();switchModule()});
  $("#mobile-more-install")?.addEventListener("click",()=>{closeMobileMore();showInstallGuide()});
  $("#mobile-more-logout")?.addEventListener("click",()=>{closeMobileMore();logout()});
 $("#switch-module")?.addEventListener("click",switchModule);
 $("#admin-focus-toggle")?.addEventListener("click",toggleAdminFocus);
 $("#identity-open")?.addEventListener("click",identitySheet);
 const search=$("#nav-search");
 search?.addEventListener("keydown",event=>{if(event.key!=="Enter")return;event.preventDefault();const query=search.value.trim().toLocaleLowerCase();const found=items().find(x=>x[1]===search.value.trim())||items().find(x=>x[1].toLocaleLowerCase().includes(query));if(found)go(found[0]);else toast("لم أعثر على صفحة مطابقة",true)});
 refreshWallet();
}

function switchModule(){
 if(S.mode!=="school"){openIhsanTeaser();return}
 animateModuleChange(async()=>{
  S.mode="school";S.tab="home";
  safeStore.setSession("ihsan_last_mode","school");safeStore.setSession("ihsan_last_tab","home");
  try{history.pushState({ihsanMode:"school",ihsanTab:"home"},"",location.pathname+"#school")}catch{}
  await load();
  shell();await page();
 });
}

function toggleAdminFocus(){
 const next=adminFocusIsFull()?"daily":"full";
 safeStore.set("ihsan_admin_focus",next);
 if(next==="daily"&&["groups","system-check","teachers","backup","audit","school-managers","posts"].includes(S.tab))S.tab="home";
 shell();page();
}

function identitySheet(){
 const existing=$("#identity-sheet");if(existing)existing.remove();
 const role=ROLE_LABELS[S.user.role]||"عضو الأكاديمية";
 const name=honorificDisplayName(S.user.name,S.user.role);
 const initial=esc((S.user.name||"إ").trim().slice(0,1));
 const isAdmin=S.user.role==="admin",full=adminFocusIsFull();
 const showSwitch=!(S.user?.role==="visitor"||(S.user?.role==="student"&&!S.user?.group_id));
 const dialog=document.createElement("dialog");
 dialog.id="identity-sheet";dialog.dir="rtl";dialog.className="identity-sheet";
 dialog.innerHTML='<div class="identity-sheet-head"><span class="identity-sheet-avatar" aria-hidden="true">'+initial+'</span><div><strong>'+esc(name)+'</strong><small>'+esc(role)+'</small></div><button type="button" class="settings-close" id="identity-sheet-close" aria-label="إغلاق">×</button></div><div class="identity-sheet-body"><p class="identity-sheet-note">هذه هويتك داخل الأكاديمية. تظهر لك الأقسام حسب دورك وصلاحياتك.</p><div class="identity-sheet-actions">'+(showSwitch?'<button type="button" class="btn secondary" id="identity-switch-module">'+(S.mode==="school"?"منهج الإحسان (قريبًا)":"الانتقال إلى المدرسة القرآنية")+'</button>':"")+(isAdmin?'<button type="button" class="btn secondary" id="identity-admin-focus">'+(full?"العودة إلى مهام الشيخ اليومية":"عرض كل أدوات الإدارة")+'</button>':"")+'<button type="button" class="btn secondary" id="identity-settings">الإعدادات</button><button type="button" class="btn danger" id="identity-logout">تسجيل الخروج</button></div><p class="identity-sheet-role">'+(isAdmin?(full?"وضع العرض الحالي: كل أدوات الإدارة ظاهرة.":"وضع العرض الحالي: المهام اليومية فقط. افتح كل الأدوات من الزر أعلاه."):"صلاحيتك الحالية: "+esc(role)+".")+'</p></div>';
 document.body.append(dialog);
 const close=()=>{try{if(dialog.open)dialog.close()}catch{}dialog.remove()};
 $("#identity-sheet-close")?.addEventListener("click",close);
 dialog.addEventListener("click",e=>{if(e.target===dialog)close()});
 $("#identity-switch-module")?.addEventListener("click",()=>{close();switchModule()});
 $("#identity-admin-focus")?.addEventListener("click",()=>{close();toggleAdminFocus()});
 $("#identity-settings")?.addEventListener("click",()=>{close();showSettings()});
 $("#identity-logout")?.addEventListener("click",()=>{close();logout()});
 if(typeof dialog.showModal==="function")dialog.showModal();else dialog.setAttribute("open","");
}

async function refreshWallet(){
 const host=$("#workspace-wallet");if(!host)return;
 if(S.user?.role!=="student"||S.mode!=="school"){host.innerHTML="";return}
 try{
  const [summary,reading]=await Promise.all([api("/points/summary"),api("/points/reading")]);
  const achievement=Number(summary.totals?.achievement||0),store=Number(summary.totals?.store||0),streak=Number(reading?.streak||0);
  host.innerHTML='<button type="button" class="wallet-chip" data-wallet-go="points" title="رصيد النقاط"><span aria-hidden="true">★</span><strong>'+store+'</strong><small>نقطة</small></button><button type="button" class="wallet-chip wallet-chip-streak" data-wallet-go="world" title="سلسلة ورد القراءة"><span aria-hidden="true">🔥</span><strong>'+streak+'</strong><small>يوم</small></button>';
  host.querySelectorAll("[data-wallet-go]").forEach(btn=>btn.onclick=()=>go(btn.dataset.walletGo));
 }catch{host.innerHTML=""}
}

async function curriculumPage(v){
const lessons={
all:["بساتين الإحسان","رحلة علمية وإيمانية تتفتح فيها أبواب المعرفة كما تتفتح البساتين؛ من معرفة الله تعالى إلى صحبة الرسول ﷺ، ومن تدبّر القرآن إلى نور السنة، ثم إلى الأدب والعمل.","سر على مهل بين أبواب هذا المنهج: تعرّف إلى الله تعالى بأسمائه وصفاته كما جاءت في الوحي، واقترب من سيرة نبيه ﷺ وهديه، وأقم مع القرآن تلاوةً وفهمًا وتدبّرًا، واغترف من السنة الصحيحة، ثم اجعل لكل معرفة أثرًا صادقًا في العبادة والرحمة والخلق. لا نريد معلوماتٍ عابرة، بل علمًا يرسخ في القلب ويهدي العمل."],
allah:["معرفة الله تعالى","بابٌ إلى محبة الله وتعظيمه ورجائه؛ نتعرّف إليه من أسمائه الحسنى وآياته في الوحي والخلق.","في هذا البستان نتأمل اسمًا من أسماء الله الحسنى: معناه الثابت بالدليل، وما يدل عليه من كمال الله تعالى، وكيف يزيدنا معرفةً ومحبةً وخشيةً ورجاءً. نستضيء بآية أو حديث صحيح وشرح موثوق، ثم نسأل: ما الأثر الذي ينبغي أن يظهر في دعائي وعبادتي وتوكلي ورحمتي بالخلق؟ لا ننسب إلى الله إلا ما ثبت في القرآن والسنة."],
prophet:["صحبة الرسول ﷺ","نقترب من سيرته وشمائله ومواقفه، ونرى كيف تجلّى الوحي رحمةً وعدلًا وحكمةً في حياته.","نفتح صفحةً موثوقة من السيرة، ونفهم سياقها، ونتأمل ما تكشفه من رحمته ﷺ وشجاعته وتواضعه وعبادته وحسن معاملته. نميّز بين الرواية الثابتة وما لا يصح، ثم نختار هديًا نبويًا يمكن أن نقتدي به في البيت أو المسجد أو الدراسة أو التعامل مع الناس."],
quranpath:["عيون القرآن وتدبّره","مجالس مع كلام الله تعالى: تلاوةٌ صحيحة، وفهمٌ من تفسير موثوق، وتدبّرٌ يقود إلى العمل.","اختر آياتٍ تناسب مستواك، واقرأها بتأنٍّ، وتعلّم مفرداتها وسياقها من تفسير معتبر، ثم استخرج هدايةً دلّ عليها النص. اجمع بين الحفظ والمراجعة والفهم والعمل، ولا تجعل خاطرتك الشخصية تفسيرًا جازمًا للآية. دوّن فائدةً واحدةً وارجع إليها في يومك."],
sunnah:["ينابيع السنة النبوية","أحاديث صحيحة تهدي الفكر والعبادة والمعاملة، مع عنايةٍ بثبوت النص وفهمه.","نقرأ الحديث من مصدره، ونتحقق من درجته ولفظه، ونفهمه بالرجوع إلى شرح موثوق، ونتأمل صلته بالقرآن وباب العلم الذي نتعلمه. ثم نختار فائدةً عمليةً: ذكرًا، أو عبادةً، أو أدبًا، أو حقًا من حقوق الناس، ونراجع أثرها في حياتنا."],
adab:["ثمار العلم في الخُلُق والحياة","حين يستقر العلم في القلب تظهر ثمرته في الصدق والرفق والأمانة والتواضع وحسن المعاملة.","هذا الموضع ليس قائمة شعارات؛ بل تدريبٌ على تحويل المعرفة إلى سلوك. نتعلّم أدب الخلاف، وحقوق الوالدين والجيران والزملاء، وحفظ اللسان والوقت، والرفق بالنفس والخلق. اختر خُلُقًا، وتعرّف إلى دليله، وضع له تطبيقًا واضحًا لهذا الأسبوع، ثم راجع نفسك بلا قسوة ولا ادّعاء."],
hifzprogram:["نموذج تجريبي لبرنامج الحال المرتحل","تصور تجريبي لمراحل حفظ القرآن والربط والمراجعة ومحطات الاختبار، قابل للتعديل بعد التجربة ومراجعة الشيخ. لا يُعدّ خطة نهائية أو إلزامية للطلاب.","المقياس ليس السرعة وحدها؛ بل حفظ متين، وتلاوة سليمة، وتصحيح للأخطاء، ومراجعة مستمرة. هذه الخريطة للاستئناس والتجربة فقط، ولا تُعتمد خطةً للطالب حتى يراجعها الشيخ ويقرّها."]
};
let subjects=[],progress=[];
try{subjects=await api("/subjects")}catch{}
try{progress=await api("/curriculum/progress")}catch(e){v.innerHTML=head("منهج الإحسان","تعذّر تحميل تقدمك المحفوظ.")+'<div class="notice error">'+esc(e.message)+'</div><button class="btn" id="retry-curriculum">إعادة المحاولة</button>';$("#retry-curriculum")?.addEventListener("click",()=>curriculumPage(v));return}
const custom=subjects.filter(x=>!x.builtin);
const currentTab=S.tab||"all";
let x=lessons[currentTab]||lessons.all;
let subjectId=currentTab==="quranpath"?"quran":currentTab;
if(currentTab.startsWith("custom-")){
 const item=custom.find(q=>q.id===currentTab.slice(7));
 if(item){x=[item.title,item.description,"هذا محور تعليمي أضافه مدير الأكاديمية. ادرس مادته ومراجعه بإتقان، ثم سجّل فهمك وتطبيقك ومراجعتك."];subjectId=item.id}
}
const trackable=currentTab!=="all"&&(Object.prototype.hasOwnProperty.call(lessons,currentTab)||currentTab.startsWith("custom-"));
const saved=progress.find(p=>p.subject_id===subjectId)||{steps:[],reflection:""};
const savedSteps=Array.isArray(saved.steps)?saved.steps:[];
const completionCount=subjects.filter(s=>!s.builtin||["allah","prophet","quran","sunnah","adab"].includes(s.id)).filter(s=>{const p=progress.find(q=>q.subject_id===s.id);return !!p&&p.completed}).length;
const totalAreas=5+custom.length;
let html='<div class="curriculum-banner"><span class="eyebrow">مَنْهَجُ الإِحْسَان</span><h2>'+esc(x[0])+'</h2><p>'+esc(x[1])+'</p><div class="curriculum-overall"><span>محاور أتممتها</span><strong>'+completionCount+' / '+totalAreas+'</strong><span class="curriculum-overall-meter"><i style="width:'+Math.min(100,completionCount/Math.max(1,totalAreas)*100)+'%"></i></span></div></div><div class="card curriculum-card"><h3>خطوتك التعليمية</h3><p>'+esc(x[2])+'</p><div class="notice">قاعدة المنهج: تعلّم قليلًا بإتقان، وطبّق ما تعلّمت، ثم راجع واستمر.</div></div>';
const evidenceByTab={
 all:{title:"فضل العلم والإيمان",text:"يَرْفَعِ اللَّهُ الَّذِينَ آمَنُوا مِنكُمْ وَالَّذِينَ أُوتُوا الْعِلْمَ دَرَجَاتٍ",reference:"سورة المجادلة، الآية 11",reflection:"ما فائدة واحدة تثبتها اليوم ثم تحوّلها إلى عمل؟"},
 allah:{title:"معرفة الله تعالى",text:"هُوَ اللَّهُ الَّذِي لَا إِلَٰهَ إِلَّا هُوَ عَالِمُ الْغَيْبِ وَالشَّهَادَةِ هُوَ الرَّحْمَٰنُ الرَّحِيمُ",reference:"سورة الحشر، الآية 22",reflection:"كيف يثمر تعلّم أسماء الله الحسنى عبادةً ورجاءً وتوكّلًا صحيحًا؟"},
 prophet:{title:"الاقتداء برسول الله ﷺ",text:"لَقَدْ كَانَ لَكُمْ فِي رَسُولِ اللَّهِ أُسْوَةٌ حَسَنَةٌ",reference:"سورة الأحزاب، الآية 21",reflection:"ما خُلُق ثابت الدليل يمكنك الاقتداء به اليوم؟"},
 quranpath:{title:"هداية القرآن",text:"إِنَّ هَٰذَا الْقُرْآنَ يَهْدِي لِلَّتِي هِيَ أَقْوَمُ",reference:"سورة الإسراء، الآية 9",reflection:"اقرأ الآية في سياقها من تفسير موثوق، ثم اذكر هداية دلّ عليها النص."},
 sunnah:{title:"فضل سلوك طريق العلم",text:"مَنْ سَلَكَ طَرِيقًا يَلْتَمِسُ فِيهِ عِلْمًا، سَهَّلَ اللَّهُ لَهُ بِهِ طَرِيقًا إِلَى الْجَنَّةِ",reference:"صحيح مسلم، حديث 2699",reflection:"تحقّق من لفظ الحديث ومصدره، ثم اذكر فائدة عملية فهمتها."},
 adab:{title:"الرفق من محاسن الأخلاق",text:"إِنَّ الرِّفْقَ لَا يَكُونُ فِي شَيْءٍ إِلَّا زَانَهُ، وَلَا يُنْزَعُ مِنْ شَيْءٍ إِلَّا شَانَهُ",reference:"صحيح مسلم، حديث 2594",reflection:"كيف تجمع بين بيان الحق ورفق الأسلوب في موقف واقعي؟"}
};
const evidence=evidenceByTab[currentTab];
if(evidence)html+='<section class="card curriculum-evidence"><span class="eyebrow">أصل من الوحي</span><h3>'+esc(evidence.title)+'</h3><blockquote class="curriculum-evidence-text" lang="ar">'+esc(evidence.text)+'</blockquote><p class="muted small curriculum-evidence-source">'+esc(evidence.reference)+'</p><div class="notice"><strong>سؤال للتدبر:</strong> '+esc(evidence.reflection)+'</div></section>';
if(currentTab==="hifzprogram")html += "<div class=\"hifz-program-stack\"><section class=\"card hifz-program-intro\"><span class=\"eyebrow\">نموذج تجريبي قيد المراجعة · غير معتمد نهائيًا</span><h3>تصور للمراحل ومحطات الإتقان</h3><p>هذه خريطة تجريبية قابلة للتعديل، وليست خطة معتمدة أو إلزامية. لا تغيّر ورد الطالب ولا تُنشئ تكليفًا تلقائيًا؛ اعتماد أي خطة يكون بعد مراجعة الشيخ.</p><div class=\"hifz-stat-grid\"><div><strong>20 نصف حزب</strong><span>في المرحلة الشهرية</span></div><div><strong>10 أحزاب</strong><span>محصول المرحلة</span></div><div><strong>6 مراحل</strong><span>لبلوغ 60 حزبًا</span></div><div><strong>شهران</strong><span>للتمكين والمراجعة</span></div></div></section><section class=\"card\"><h3>أركان المسار</h3><div class=\"hifz-daily-grid\"><article><span class=\"hifz-number\">01</span><h4>تثبيت الجديد</h4><p>يُبنى كل يوم على مقدار مناسب من الحفظ الجديد، مع التكرار حتى يثبت.</p></article><article><span class=\"hifz-number\">02</span><h4>الربط مع الزميل</h4><p>يُربط الجديد بالمحفوظ في المرحلة الجارية، ويُراجع السرد بأمانة قبل محطة الشيخ.</p></article><article><span class=\"hifz-number\">03</span><h4>صيانة القديم</h4><p>تُراجع مواضع التشابه بين المراحل، حتى لا يؤدي التركيز على السدس الجاري إلى إهمال المحفوظ السابق.</p></article></div><div class=\"notice hifz-program-note\"><strong>كيف تُعطى التفاصيل؟</strong><p>لن نضع تفاصيل التكرار والدقائق ومقادير السرد كلها في هذه الصفحة. ستُعرض لاحقًا في المهام اليومية والخطة الأسبوعية، بحسب موضع الطالب ومرحلة تقدمه.</p></div></section><section class=\"card\"><h3>محطات الترحال</h3><p>المحطات الكبرى تقيس ثبات الحفظ وتساعد الشيخ على متابعة الإتقان. أما المحطات الوسيطة فيمكن تهيئتها ومراجعتها مع الزميل، وفق نظام الحلقة.</p><div class=\"hifz-milestone-grid\"><article><span class=\"eyebrow\">التأسيس</span><strong>5 أحزاب</strong><p>اختبار مبكر لسلامة الأساس.</p></article><article><span class=\"eyebrow\">التمكين</span><strong>7.5 أحزاب</strong><p>تثبيت الربط ومعالجة المتشابهات.</p></article><article class=\"hifz-milestone-key\"><span class=\"eyebrow\">بوابة الشيخ</span><strong>10 أحزاب</strong><p>إتمام السدس الأول.</p></article><article class=\"hifz-milestone-key\"><span class=\"eyebrow\">ربع القرآن</span><strong>15 حزبًا</strong><p>محطة مقترحة للتحقق من الثبات ضمن هذا التصور التجريبي.</p></article><article><span class=\"eyebrow\">منتصف الطريق</span><strong>30 حزبًا</strong><p>اختبار نصف القرآن.</p></article><article><span class=\"eyebrow\">ثلاثة الأرباع</span><strong>45 حزبًا</strong><p>اختبار واسع قبل الختم.</p></article><article class=\"hifz-milestone-key\"><span class=\"eyebrow\">التاج</span><strong>60 حزبًا</strong><p>الختم الكلي والتمكين النهائي.</p></article></div><section class=\"hifz-city-journey\" aria-label=\"مدن رحلة القرآن الاختيارية\"><h4>مدن الرحلة الاختيارية</h4><p>محطات تحفيزية رمزية تُفعّل وفق الخطة الأسبوعية، ولا تُعدّ اجتيازًا للحفظ حتى يثبت بالتسميع.</p><div class=\"hifz-city-grid\"><span>مدينة الفاتحين</span><span>مدينة المصابرة</span><span>مدينة الثبات</span><span>مدينة الهدى</span><span>مدينة التقوى</span><span>مدينة الصادقين</span><span>مدينة الأبرار</span></div></section><div class=\"notice hifz-program-note hifz-program-note--info\">تُفصّل متطلبات كل مدينة ومقدارها وموعد اختبارها في الخطة الأسبوعية أو مهمة الطالب ذات الصلة، بدل عرضها كلها دفعة واحدة.</div></section><section class=\"card hifz-program-phases\"><h3>خريطة الأشهر</h3><div class=\"hifz-phase-line\"><div><span>1–6</span><strong>بناء المحفوظ</strong><p>مرحلة لكل سدس، وفق الورد والتقدم الموثّق.</p></div><div><span>7–8</span><strong>التمكين والمراجعة</strong><p>ربط المحفوظ، وإعادة اختبار المواضع الضعيفة، والاستعداد للختم.</p></div></div><p class=\"muted small\">هذه مدة مستهدفة وليست ضمانًا زمنيًا؛ وقد تتغير بحسب جودة الحفظ والحاجة إلى الاستدراك.</p></section><section class=\"card hifz-accountability\"><h3>قاعدة الإتقان</h3><ul><li>لا يتقدم الطالب إلى مقدار جديد إذا لم يثبت المقدار السابق.</li><li>تُصحّح الأخطاء ويُعاد اختبارها، مع تقديم سلامة التلاوة على سرعة الحدر.</li><li>تكون المتابعة والمساءلة بسرية ورفق وحزم، ويُقسّم الاستدراك إلى جلسات معقولة تحفظ الصحة والقدرة على الاستمرار.</li></ul><div class=\"notice hifz-program-note hifz-program-note--important\"><strong>تنبيه في اسم البرنامج:</strong> «الحال المرتحل» اسم تربوي للمسار، وليس تصحيحًا لنسبة الحديث الوارد بهذا اللفظ؛ فقد قال الترمذي عن إسناده إنه «ليس بالقوي».</div></section></div>";
if(trackable)html+='<section class="card curriculum-progress-card"><div class="section-head"><div><h3>متابعة تعلّمك في هذا المحور</h3><p>سجّل الخطوات التي أنجزتها؛ سيُحفظ تقدمك في حسابك.</p></div><span class="progress-count">'+savedSteps.length+' / 3</span></div><form id="curriculum-progress-form" class="stack"><label class="progress-step"><input type="checkbox" name="steps" value="understood" '+(savedSteps.includes("understood")?"checked":"")+'><span><strong>فهمت أصل المسألة</strong><small>أستطيع شرح الفكرة بكلامي.</small></span></label><label class="progress-step"><input type="checkbox" name="steps" value="applied" '+(savedSteps.includes("applied")?"checked":"")+'><span><strong>طبّقت فائدة عملية</strong><small>ربطت ما تعلمته بعمل أو سلوك.</small></span></label><label class="progress-step"><input type="checkbox" name="steps" value="reviewed" '+(savedSteps.includes("reviewed")?"checked":"")+'><span><strong>راجعت ما تعلمته</strong><small>عدت إلى الدرس أو المصدر وثبّت الفائدة.</small></span></label><label class="field">فائدة أريد تذكّرها <textarea name="reflection" maxlength="1200" rows="3" placeholder="اكتب خلاصة قصيرة أو عملًا تنوي المحافظة عليه...">'+esc(saved.reflection||"")+'</textarea></label><div class="student-actions"><button class="btn" type="submit">حفظ تقدمي</button><span class="muted small" id="curriculum-save-status" aria-live="polite">'+(saved.updated_at?"آخر حفظ: "+esc(saved.updated_at):"لم يُسجّل تقدم في هذا المحور بعد.")+'</span></div></form></section>';
html+='<div class="curriculum-tiles"><button class="curriculum-tile" data-lesson="allah"><strong>الله تعالى</strong><span>الأسماء الحسنى والإيمان</span>'+progressBadge(progress,"allah")+'</button><button class="curriculum-tile" data-lesson="prophet"><strong>الرسول ﷺ</strong><span>السيرة والشمائل والاتباع</span>'+progressBadge(progress,"prophet")+'</button><button class="curriculum-tile" data-lesson="quranpath"><strong>القرآن</strong><span>حفظ وفهم وتدبر وعمل</span>'+progressBadge(progress,"quran")+'</button><button class="curriculum-tile" data-lesson="sunnah"><strong>السنة والمتون</strong><span>حديث وعلم شرعي</span>'+progressBadge(progress,"sunnah")+'</button><button class="curriculum-tile" data-lesson="hifzprogram"><strong>برنامج الحال المرتحل</strong><span>تصور تجريبي للمراحل ومحطات الإتقان، قيد المراجعة</span></button><button class="curriculum-tile" data-lesson="adab"><strong>الأدب والعمل</strong><span>أخلاق وتطبيق ومراجعة</span>'+progressBadge(progress,"adab")+'</button>'+custom.map(q=>'<button class="curriculum-tile" data-custom-lesson="'+esc(q.id)+'"><strong>'+esc(q.title)+'</strong><span>'+esc(q.description)+'</span>'+progressBadge(progress,q.id)+'</button>').join("")+'</div>';
if(S.user.role==="admin")html+='<section class="card" style="margin-top:16px"><h3>إضافة محور تعليمي</h3><form id="subject-form" class="stack"><label class="field">اسم المحور<input name="title" required maxlength="160" placeholder="مثال: فقه العبادات"></label><label class="field">وصفه وهدفه<textarea name="description" required maxlength="2000" rows="3" placeholder="بيّن ما سيتعلمه الطالب"></textarea></label><button class="btn">حفظ المحور</button><p class="muted small">يُحفظ عنوان المحور ووصفه. لا يُعدّ ذلك وحده منهجًا كاملًا؛ يلزم إضافة الدروس التفصيلية والمراجع والأسئلة.</p></form></section>';
v.innerHTML=html;
v.querySelectorAll("[data-lesson]").forEach(b=>b.onclick=()=>{S.tab=b.dataset.lesson;shell();page()});
v.querySelectorAll("[data-custom-lesson]").forEach(b=>b.onclick=()=>{S.tab="custom-"+b.dataset.customLesson;shell();page()});
$("#subject-form")?.addEventListener("submit",async e=>{e.preventDefault();const f=new FormData(e.currentTarget);try{await api("/subjects",{method:"POST",body:JSON.stringify({title:f.get("title"),description:f.get("description")})});toast("تم حفظ المحور التعليمي");await curriculumPage(v)}catch(err){toast(err.message,true)}});
$("#curriculum-progress-form")?.addEventListener("submit",async e=>{
 e.preventDefault();const form=e.currentTarget,button=form.querySelector('button[type="submit"]'),status=$("#curriculum-save-status");
 const steps=[...form.querySelectorAll('input[name="steps"]:checked')].map(input=>input.value);
 const reflection=form.elements.reflection.value;
 if(steps.length===0&&!reflection.trim()){toast("اختر خطوة أنجزتها أو اكتب فائدة تريد تذكّرها.",true);return}
 button.disabled=true;if(status)status.textContent="جارٍ حفظ تقدمك…";
 try{const saved=await api("/curriculum/progress",{method:"POST",body:JSON.stringify({subject_id:subjectId,steps,reflection})});toast(saved.completed?"أحسنت؛ أتممت خطوات هذا المحور.":"تم حفظ تقدمك.");await curriculumPage(v)}
 catch(err){if(status)status.textContent="تعذّر الحفظ؛ لم يتغير تقدمك المحفوظ.";toast(err.message,true)}
 finally{if(button.isConnected)button.disabled=false}
});
}
function progressBadge(rows,id){const p=rows.find(x=>x.subject_id===id);return '<small class="curriculum-progress-badge">'+(p&&p.completed?"أُنجزت الخطوات الثلاث":p&&p.steps?.length?"أُنجزت "+p.steps.length+" من 3":"لم يبدأ بعد")+'</small>'}

const head=(a,b)=>'<div class="section-head"><div><h2>'+esc(a)+'</h2>'+(b&&String(b).length<=54?'<p>'+esc(b)+'</p>':'')+'</div></div>';
const field=(label,name,type="text",min="",placeholder="")=>'<label class="field">'+esc(label)+'<input name="'+esc(name)+'" type="'+esc(type)+'" '+(min?'minlength="'+esc(min)+'"':"")+(placeholder?' placeholder="'+esc(placeholder)+'"':"")+' required></label>';
const groupOpts=()=>S.groups.map(g=>'<option value="'+esc(g.id)+'">'+esc(g.name)+'</option>').join("");
const assignedGroups=()=>{const role=S.user?.role;if(role==="admin")return S.groups.slice();if(role==="director"){const ids=(S.user.school_ids||[]).map(String);return S.groups.filter(g=>ids.includes(String(g.school_id||"")));}if(role==="teacher")return S.groups.filter(g=>String(g.teacher_id||"")===String(S.user.id));if(role==="supervisor")return S.groups.filter(g=>(S.user.group_ids||[]).map(String).includes(String(g.id)));return S.groups.slice()};
function go(id){if(S.user?.role==="admin"&&id==="groups")safeStore.set("ihsan_admin_focus","full");safeStore.setSession("ihsan_last_mode",S.mode);safeStore.setSession("ihsan_last_tab",id);try{history.pushState({ihsanMode:S.mode,ihsanTab:id},"",location.pathname+"#"+encodeURIComponent(id))}catch{}S.tab=id;shell();page()}
window.addEventListener("popstate",async e=>{if(!S.user)return;const st=e.state||{};if(st.ihsanMode==="hub"){S.mode="hub";moduleChooser(false);return;}if(st.ihsanMode==="ihsan"){S.mode="hub";moduleChooser(false);openIhsanTeaser();return;}if(st.ihsanMode==="school"){S.mode="school";S.tab=st.ihsanTab||"home";await load();shell();await page();if(st.ihsanSubView==="student-profile")await studentProfile($("#view"),st.studentId);return;}S.mode="hub";moduleChooser(false);});
async function page(){const v=$("#view");try{window.IhsanScanner&&window.IhsanScanner.stop()}catch{}
if(S.mode==="ihsan"){S.mode="hub";moduleChooser(false);return}
if((S.user?.role==="visitor"||(S.user?.role==="student"&&!S.user?.group_id))&&S.tab!=="home")S.tab="home";
const allowedTabs=items().map(x=>x[0]);
if(!allowedTabs.includes(S.tab))S.tab=S.user?.role==="student"&&allowedTabs.includes("world")?"world":(allowedTabs[0]||"home");
v.innerHTML='<div class="loading" role="status" aria-label="تحميل البيانات"><span class="loading-spinner" aria-hidden="true"></span></div>';try{if(S.tab==="system-check"&&S.user.role==="admin")return systemCheckPage(v);if(S.tab==="join-requests"&&["admin","teacher","director"].includes(S.user.role))return await joinRequestsPage(v);if(S.tab==="sheikh-check"&&S.user.role==="teacher")return sheikhCheckPage(v);if(S.tab==="world")return await worldPage(v);if(S.tab==="card")return await cardPage(v);if(S.tab==="cards")return await staffCardsPage(v);if(S.tab==="scan"&&["admin","teacher","director","supervisor"].includes(S.user.role))return await scanPage(v);if(S.tab==="guide")return await guidePage(v);if(S.tab==="home" && S.user.role==="student" && !S.user.group_id) return pendingStudentHome(v);
 if(S.tab==="home")return await home(v);if(S.tab==="teams")return await teamsPage(v);if(S.tab==="groups")return groups(v);if(S.tab==="tasks")return await tasksPage(v);if(S.tab==="hadith")return await contentPage(v);if(S.tab==="competitions")return await competitionsPage(v);if(S.tab==="points")return await pointsPage(v);if(S.tab==="teachers")return teachers(v);if(S.tab==="students")return students(v);if(S.tab==="attendance")return attendance(v);if(S.tab==="assignments")return await assignmentsPage(v);if(S.tab==="gradebook")return await gradebookPage(v);if(S.tab==="messages")return await messagesPage(v);if(S.tab==="reports")return reportsPage(v);if(S.tab==="leaderboard")return leaderboardPage(v);if(S.tab==="profile")return studentProfile(v,S.user.student_id);if(S.tab==="quran")return quran(v);if(S.tab==="effort")return effortPage(v);if(S.tab==="effort-ranking")return effortRankingPage(v);if(S.tab==="roster-bulk")return bulkRosterPage(v);if(S.tab==="quran-achievement")return quranAchievementPage(v);if(S.tab==="roadmap")return roadmapPage(v);if(S.tab==="hierarchy")return hierarchyPage(v);if(S.tab==="tests")return testsPage(v);
 if(S.tab==="notifications")return notificationsPage(v);v.innerHTML=head("القسم غير متاح","هذا القسم لم يعد متاحًا. اختر قسمًا من القائمة.")+'<button class="btn" id="back-home">العودة إلى الرئيسية</button>';$("#back-home").onclick=()=>go("home");return}catch(e){v.innerHTML='<div class="panel"><h2>تعذّر تحميل البيانات</h2><p class="notice error">'+esc(e.message)+'</p><button class="btn" id="retry">إعادة المحاولة</button></div>';$("#retry").onclick=page}}
function pointsStatusLabel(status){const labels={pending:"قيد المراجعة",approved:"معتمد",rejected:"مرفوض",fulfilled:"منفذ",cancelled:"ملغى"};return labels[status]||status}
function pointsDate(value){const text=String(value||"");return text?esc(text.replace("T"," ").slice(0,16)):"—"}
function storeItemImage(item){
 const raw=String(item?.image_url||"").trim();
 const safeUrl=/^(https:\/\/|\/[^/])/.test(raw)&&!/[\u0000-\u001f]/.test(raw)?raw:"";
 return '<div class="store-product-media">'+
  '<span class="store-reco-icon" aria-hidden="true">'+esc(item?.icon||"🎁")+'</span>'+
  (safeUrl?'<img class="store-item-image" src="'+esc(safeUrl)+'" alt="'+esc(item.name||"صورة المكافأة")+'" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.remove()">':"")+
 '</div>';
}
function storeItemState(item,balance){
 const stock=item.stock===null||item.stock===undefined?null:Number(item.stock);
 const max=item.max_per_student===null||item.max_per_student===undefined?null:Number(item.max_per_student);
 const used=Number(item.used||0),cost=Number(item.cost)||0;
 return {stock,max,used,cost,soldOut:stock!==null&&stock<=0,maxed:max!==null&&used>=max,missing:Math.max(0,cost-Number(balance||0))};
}
function storeItemFacts(item,balance){
 const state=storeItemState(item,balance),parts=["التكلفة: "+Number(item.cost)+" من رصيد النقاط"];
 if(state.stock!==null)parts.push(state.stock>0?"المتبقي: "+state.stock:"نفدت الكمية");
 if(state.max!==null)parts.push("الحد لكل طالب: "+state.max+(state.used?" · استخدمت: "+state.used:""));
 return parts.join(" · ");
}
function storeTermsMarkup(){
 return '<details class="store-terms"><summary>شروط الصرف قبل أن تطلب</summary><ul><li>طلبك يُراجع من الشيخ أو الإدارة قبل التنفيذ، ولا يُسلَّم تلقائيًا.</li><li>يُحجز مبلغ المكافأة من رصيد النقاط فور الطلب، ويُعاد تلقائيًا إذا رُفض الطلب.</li><li>بعد تنفيذ الطلب لا يمكن إلغاؤه؛ تأكد من اختيارك.</li><li>رصيدك هو مجموع نقاطك، وتستخدم النقاط نفسها لطلب المكافآت من المتجر.</li><li>لا نعرض مكافأة نفدت كميتها أو بلغت حدّها؛ ونُحدّث المتاح فور الطلب.</li></ul></details>';
}
function storeStudentMarkup(store,summary){
 const reco=store?.recommendations||null;
 const balance=Number(reco?.balance??store?.balance??summary?.totals?.store??0);
 let html='<section class="card store-student"><div class="section-head"><div><span class="eyebrow">متجر المكافآت</span><h3>مكافآت حقيقية، لا وهم</h3><p>نعرض فقط ما اعتمدته الإدارة ومتوفر فعليًا. رصيد النقاط الحالي: <strong>'+balance+'</strong>.</p></div></div>';
 if(!reco||reco.empty){
  html+='<div class="store-empty-honest"><strong>المتجر فارغ بصدق.</strong><p>لم تعتمد الإدارة مكافآت حقيقية بعد، ولن نعرض لك منتجات وهمية أو صورًا تجريبية. سيظهر هنا كل ما يُعتمد فعليًا مع تكلفته ومخزونه وشروطه.</p><small>رصيدك محفوظ ولا ينقص بانتظار إضافة المكافآت.</small></div>'+storeTermsMarkup()+'</section>';
  return html;
 }
 if(reco.affordable.length){
  html+='<div class="store-reco-grid">'+reco.affordable.map(item=>{
   const state=storeItemState(item,balance);
   return '<article class="store-reco-card">'+storeItemImage(item)+'<span class="eyebrow">متاحة الآن</span><strong>'+esc(item.name)+'</strong><p>'+esc(item.description||"")+'</p><small>'+esc(storeItemFacts(item,balance))+'</small><div class="student-actions"><button class="btn" type="button" data-redeem="'+esc(item.id)+'"'+(state.maxed?" disabled":"")+'>'+(state.maxed?"بلغت الحد الأقصى":"طلب الصرف")+'</button></div></article>';
  }).join("")+'</div>';
 }else{
  html+='<div class="notice"><strong>لا توجد مكافأة ضمن رصيدك الآن.</strong><p>واصل مهامك؛ كل حركة نقاط مسجلة، ولا نعرض مكافأة لا تستطيع صرفها كأنها متاحة.</p></div>';
 }
 if(reco.nearest){
  const nearest=reco.nearest;
  html+='<div class="store-nearest"><div><span class="eyebrow">أقرب مكافأة إلى رصيدك</span><strong>'+esc(nearest.name)+'</strong><small>تفصلك '+Number(nearest.missing||0)+' من رصيد النقاط · التكلفة '+Number(nearest.cost)+'</small></div><div class="store-nearest-meter" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+Number(nearest.progress||0)+'"><i style="width:'+Number(nearest.progress||0)+'%"></i></div></div>';
 }
 const lockedOthers=(reco.locked||[]).filter(item=>String(item.id)!==String(reco.nearest?.id||""));
 if(lockedOthers.length){
  html+='<div class="store-locked"><span class="eyebrow">مكافآت تحتاج رصيدًا أكبر</span><div class="store-reco-grid">'+lockedOthers.map(item=>'<article class="store-reco-card store-reco-card--locked">'+storeItemImage(item)+'<strong>'+esc(item.name)+'</strong><small>'+esc(storeItemFacts(item,balance))+' · تحتاج '+Math.max(0,Number(item.cost)-balance)+' إضافية</small><span class="pill">مقفلة مؤقتًا</span></article>').join("")+'</div></div>';
 }
 const exhausted=[];
 if((reco.sold_out||[]).length)exhausted.push("نفدت كميتها: "+reco.sold_out.join("، "));
 if((reco.maxed||[]).length)exhausted.push("بلغت حدّها لك: "+reco.maxed.join("، "));
 if(exhausted.length)html+='<p class="muted small store-exhausted">'+esc(exhausted.join(" · "))+'</p>';
 html+=storeTermsMarkup()+'</section>';
 return html;
}
function storeStaffMarkup(store,canEdit){
 const items=store?.items||[];
 if(!canEdit){
  return '<section class="card"><div class="section-head"><div><h3>المتجر</h3><p>عرض فقط؛ إضافة المخزون وتعديله من صلاحية المدير. لا تُنشأ مكافآت نيابة عن الإدارة من هنا.</p></div></div><div class="list">'+(items.length?items.map(item=>'<div class="list-row"><div><strong>'+esc(item.icon||"🎁")+' '+esc(item.name)+'</strong><small>'+esc(item.description||"")+' · '+Number(item.cost)+' نقطة + (المخزون: '+(item.stock===null?"بلا حد":Number(item.stock))+')</small></div><span class="pill">'+(Number(item.active)===0?"مخفية":"معروضة")+'</span></div>').join(""):'<p class="muted">لم تُضف مواد إلى المتجر بعد.</p>')+'</div></section>';
 }
 const rows=items.map(item=>{
  const active=Number(item.active)!==0;
  return '<div class="list-row"><div><strong>'+esc(item.icon||"🎁")+' '+esc(item.name)+(active?"":" · مخفية")+'</strong><small>'+esc(item.description||"")+' · '+Number(item.cost)+' نقطة · المخزون: '+(item.stock===null?"بلا حد":Number(item.stock))+' · حد الطالب: '+(item.max_per_student===null?"بلا حد":Number(item.max_per_student))+' · الترتيب: '+Number(item.sort_order||0)+'</small></div><div class="student-actions"><button class="btn secondary" type="button" data-store-edit="'+esc(item.id)+'">تعديل</button><button class="btn secondary" type="button" data-store-toggle="'+esc(item.id)+'">'+(active?"إخفاء":"إظهار")+'</button></div></div>';
 }).join("");
 return '<section class="card store-admin"><div class="section-head"><div><span class="eyebrow">إدارة المتجر</span><h3>أضف مكافآت حقيقية فقط</h3><p>لا توجد مواد افتراضية. أدخل كتالوج الأكاديمية المعتمد فقط: الاسم والتكلفة والصورة والمخزون وشروط الصرف.</p></div></div>'+
 '<h4 id="store-form-title">إضافة مادة إلى المتجر</h4><form id="store-item-form" class="form-grid"><input type="hidden" name="item_id" value=""><label class="field">اسم المادة<input name="name" required maxlength="160"></label><label class="field">التكلفة (رصيد النقاط)<input name="cost" type="number" min="1" max="100000" required></label><label class="field">المخزون (فارغ = بلا حد)<input name="stock" type="number" min="0"></label><label class="field">حد الطالب (فارغ = بلا حد)<input name="max_per_student" type="number" min="1"></label><label class="field">الرمز<input name="icon" maxlength="8" placeholder="🎁"></label><label class="field">رابط الصورة (اختياري)<input name="image_url" maxlength="500" placeholder="https://..."></label><label class="field">الترتيب<input name="sort_order" type="number" value="0"></label><label class="field wide">الوصف<textarea name="description" maxlength="2000" rows="2"></textarea></label><label class="field wide"><span><input name="active" type="checkbox" checked> معروضة للطلاب الآن</span></label><div class="student-actions"><button class="btn" type="submit">حفظ المادة</button><button class="btn secondary" type="button" id="store-form-cancel" hidden>إلغاء التعديل</button></div></form>'+
 '<div class="list">'+(rows||'<p class="muted">لم تُضف مواد إلى المتجر بعد.</p>')+'</div></section>';
}

function idempotentFormRequestId(form,payload){
 const signature=JSON.stringify(payload);
 if(form.dataset.idempotencyKey&&form.dataset.idempotencyPayload===signature)return form.dataset.idempotencyKey;
 const requestId=(window.crypto&&crypto.randomUUID)?crypto.randomUUID():String(Date.now())+"-"+Math.random().toString(36).slice(2);
 form.dataset.idempotencyKey=requestId;
 form.dataset.idempotencyPayload=signature;
 return requestId;
}

async function pointsPage(v){
 const isStudent=S.user.role==="student",canManage=["admin","teacher","director","supervisor"].includes(S.user.role);
 if(!isStudent&&!S.students.length)await load();
 let students=[];
 if(!isStudent){
  const allowedGroups=assignedGroups().map(g=>String(g.id));
  students=S.students.filter(st=>allowedGroups.includes(String(st.group_id))).sort((a,b)=>String(a.name||a.display_name||"").localeCompare(String(b.name||b.display_name||""),"ar"));
  if(!students.some(st=>st.id===S.pointsStudentId))S.pointsStudentId=students[0]?.id||"";
  if(!S.pointsStudentId){v.innerHTML=head("النقاط والمتجر","لا يوجد طالب ضمن نطاق صلاحيتك.");return}
 }
 const studentId=isStudent?S.user.student_id:S.pointsStudentId;
 const summary=await api("/points/summary"+(!isStudent?"?student_id="+encodeURIComponent(studentId):""));
 const store=await api("/store/items");
 const redemptions=await api("/store/redemptions");
 const rules=S.user.role==="admin"?await api("/points/rules"):[];
 const redemptionRows=(redemptions||[]).map(r=>{
  const canDecide=canManage&&r.status==="pending";
  const noteInput=canDecide?'<input data-decision-note="'+esc(r.id)+'" placeholder="ملاحظة القرار (إلزامية للرفض)" maxlength="500" style="margin-top:6px">':"";
  const buttons=canDecide?'<div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn secondary" type="button" data-decision="approved" data-redemption="'+esc(r.id)+'">اعتماد</button><button class="btn" type="button" data-decision="fulfilled" data-redemption="'+esc(r.id)+'">تنفيذ</button><button class="btn danger" type="button" data-decision="rejected" data-redemption="'+esc(r.id)+'">رفض</button></div>':"";
  return '<div class="list-row"><div><strong>'+esc(r.item_name)+' — '+Number(r.cost)+'</strong><small>'+esc(r.display_name||"")+' · '+pointsDate(r.requested_at)+' · '+esc(pointsStatusLabel(r.status))+(r.decision_note?' · '+esc(r.decision_note):"")+'</small>'+noteInput+'</div>'+buttons+'</div>';
 }).join("");
 const eventRows=(summary.recent||[]).map(e=>'<div class="list-row"><div><strong>'+esc(e.reason||e.event_type)+'</strong><small>'+esc(e.kind_label)+' · '+pointsDate(e.created_at)+(e.reversed?' · معكوسة: '+esc(e.reversal_reason||""):"")+'</small></div><div style="display:flex;gap:8px;align-items:center"><span class="pill">'+(Number(e.points)>0?"+":"")+Number(e.points)+'</span>'+(S.user.role==="admin"&&!e.reversed&&e.event_type!=="store_redemption"?'<button class="btn secondary" type="button" data-reverse="'+esc(e.id)+'">عكس</button>':"")+'</div></div>').join("");
 let html=head("النقاط والمتجر",isStudent?"رصيدك وسجل حركاتك وطلبات الصرف.":"متابعة نقاط الطالب وإدارة المتجر وقواعد المنح.");
 if(!isStudent)html+='<div class="card"><label class="field">اختر الطالب<select id="points-student-select">'+students.map(st=>'<option value="'+esc(st.id)+'"'+(st.id===studentId?" selected":"")+'>'+esc(st.name||st.display_name||"طالب")+'</option>').join("")+'</select></label><p class="muted small">الفوج: '+esc(summary.student.group_name||"—")+'</p></div>';
 html+='<div class="stats"><div class="stat"><small>رصيد النقاط الموحد</small><strong>'+Number(summary.totals.balance??summary.totals.achievement??0)+'</strong></div><div class="stat"><small>طلبات قيد المراجعة</small><strong>'+Number(summary.pending_redemptions)+'</strong></div></div>';
 html+='<div class="notice">رصيدك واحد: تجمع فيه نقاط إنجازك، وتستخدم الرصيد نفسه لطلب المكافآت. كل حركة مسجلة، والتصحيح بعكس موثّق بسبب.</div>';
 html+=isStudent?storeStudentMarkup(store,summary):storeStaffMarkup(store,S.user.role==="admin");
 html+='<section class="card"><h3>طلبات الصرف</h3><div class="list">'+(redemptionRows||'<p class="muted">لا توجد طلبات صرف بعد.</p>')+'</div></section>';
 if(S.user.role==="admin")html+='<section class="card"><h3>منح النقاط — الشيخ فقط</h3><form id="points-award-form" class="form-grid"><label class="field">عدد النقاط<input name="points" type="number" min="1" max="1000" required value="10"></label><label class="field">سبب المنح (إلزامي)<input name="reason" required minlength="3" maxlength="500"></label><button class="btn" type="submit">اعتماد النقاط</button></form></section>';
 if(S.user.role==="admin")html+='<section class="card"><h3>إضافة / خصم عام</h3><p class="muted small">حركة مستقلة عن بطاقات الحفظ والمراجعة؛ لا تعدّل سجل الحفظ. كل حركة تحفظ بسببها ولا تتكرر عند إعادة الطلب.</p><form id="points-adjust-form" class="form-grid"><label class="field">نوع الحركة<select name="direction"><option value="add">إضافة</option><option value="subtract">خصم</option></select></label><label class="field">عدد النقاط<input name="amount" type="number" min="1" max="1000" step="1" required></label><label class="field wide">السبب (إلزامي)<input name="reason" minlength="3" maxlength="500" required></label><button class="btn" type="submit">حفظ الحركة العامة</button></form></section>';
 if(S.user.role==="admin"){
  const qp=(t)=>'<button class="btn secondary" type="button" data-quick-reason="'+t+'">'+t+'</button>';
  html+='<section class="card sheikh-panel" id="sheikh-panel"><h3>لوحة الشيخ — إجراءات بعد مسح البطاقة</h3><p class="muted small">منح النقاط المعتمدة، خصم الجزاء، وورد سريع للمكافآت الشائعة.</p>';
  html+='<div class="student-actions" id="quick-reasons">'+qp("ورد قراءة يومي منتظم")+qp("إتقان حفظ وتثبيت")+qp("حضور الحلقة")+qp("مراجعة ممتازة")+'</div>';
  html+='<form id="penalty-form" class="form-grid" style="margin-top:10px"><label class="field">خصم جزاء (من رصيد النقاط)<input name="store_points" type="number" min="1" max="1000" required></label><label class="field">سبب الجزاء (5 أحرف على الأقل)<input name="reason" required minlength="5" maxlength="500" placeholder="مثال: غياب متكرر دون عذر"></label><button class="btn danger" type="submit">خصم الجزاء</button></form>';
  html+='</section>';
 }
 html+='<section class="card"><h3>آخر الحركات</h3>'+(canManage?'<label class="field">سبب العكس قبل الضغط على «عكس»<input id="points-reverse-reason" maxlength="500" placeholder="مثال: تصحيح خطأ في تسجيل الحضور"></label>':"")+'<div class="list">'+(eventRows||'<p class="muted">لا توجد حركات نقاط بعد.</p>')+'</div></section>';
 if(S.user.role==="admin"){
  const ruleRows=rules.map(rule=>{
   const config=encodeURIComponent(JSON.stringify({id:rule.id,event_type:rule.event_type,name:rule.name,description:rule.description||"",sort_order:rule.sort_order||0,auto_award:rule.auto_award}));
   return '<tr><td><strong>'+esc(rule.name)+'</strong><br><small class="muted">'+esc(rule.event_type)+'</small></td><td><input type="number" min="0" max="100000" value="'+Number(rule.achievement_points)+'" data-rule-achievement style="width:84px"></td><td><input type="number" min="0" max="100000" value="'+Number(rule.store_points)+'" data-rule-store style="width:84px"></td><td><input type="number" min="0" max="300" value="'+Number(rule.bonus_percent||0)+'" data-rule-bonus style="width:72px" aria-label="نسبة الزيادة بالمئة"></td><td><input type="number" min="1" max="1000" value="'+(rule.max_per_day??"")+'" data-rule-max style="width:72px"></td><td><input type="checkbox" '+(Number(rule.active)===1?"checked":"")+' data-rule-active></td><td><button class="btn secondary" type="button" data-rule-config="'+esc(config)+'">حفظ</button></td></tr>';
  }).join("");
  html+='<section class="card"><h3>قواعد النقاط</h3><p class="muted small">القيم هنا هي مصدر المنح؛ نسبة الزيادة تُحسب على نقاط الإنجاز الأصلي (مثل دعم الآخرين)، ويعتمدها الشيخ وحده.</p><div class="table-wrap"><table><thead><tr><th>القاعدة</th><th>إنجاز</th><th>متجر</th><th>زيادة %</th><th>سقف/يوم</th><th>مفعلة</th><th></th></tr></thead><tbody>'+ruleRows+'</tbody></table></div></section>';
 }
 v.innerHTML=html;
 $("#points-student-select")?.addEventListener("change",e=>{S.pointsStudentId=e.target.value;pointsPage(v)});
 document.querySelectorAll("[data-redeem]").forEach(btn=>btn.onclick=async()=>{btn.disabled=true;try{const result=await api("/store/redeem",{method:"POST",body:JSON.stringify({item_id:btn.dataset.redeem})});toast("تم إرسال طلب الصرف. الرصيد المتبقي: "+result.balance);await pointsPage(v)}catch(error){btn.disabled=false;toast(error.message,true)}});
 document.querySelectorAll("[data-decision]").forEach(btn=>btn.onclick=async()=>{
  const redemptionId=btn.dataset.redemption,decision=btn.dataset.decision;
  const noteInput=document.querySelector('[data-decision-note="'+redemptionId+'"]');
  const note=noteInput?noteInput.value.trim():"";
  if(decision==="rejected"&&note.length<3){toast("اكتب سبب رفض الطلب",true);noteInput?.focus();return}
  try{await api("/store/redemptions/"+encodeURIComponent(redemptionId)+"/decision",{method:"POST",body:JSON.stringify({decision,note})});toast("تم تسجيل قرار طلب الصرف");await pointsPage(v)}catch(error){toast(error.message,true)}
 });
 document.querySelectorAll("[data-reverse]").forEach(btn=>btn.onclick=async()=>{
  const reason=($("#points-reverse-reason")?.value||"").trim();
  if(reason.length<3){toast("اكتب سبب عكس الحركة (3 أحرف على الأقل)",true);$("#points-reverse-reason")?.focus();return}
  try{await api("/points/events/"+encodeURIComponent(btn.dataset.reverse)+"/reverse",{method:"POST",body:JSON.stringify({reason})});toast("تم عكس الحركة مع إبقاء سجلها");await pointsPage(v)}catch(error){toast(error.message,true)}
 });
 $("#points-adjust-form")?.addEventListener("submit",async e=>{
  e.preventDefault();const form=e.currentTarget;if(form.dataset.submitting==="1")return;
  const data=new FormData(form),amount=Number(data.get("amount")),delta=data.get("direction")==="subtract"?-amount:amount,button=form.querySelector('button[type="submit"]');
  if(!Number.isInteger(amount)||amount<1||amount>1000)return toast("أدخل عددًا صحيحًا بين 1 و1000",true);
  form.dataset.submitting="1";button.disabled=true;
  try{const payload={student_id:studentId,points:delta,reason:data.get("reason")};const result=await api("/points/adjust",{method:"POST",body:JSON.stringify({...payload,request_id:idempotentFormRequestId(form,payload)})});toast((delta>0?"أُضيفت ":"خُصمت ")+amount+" نقطة. الرصيد الآن: "+Number(result.totals.balance||0));await pointsPage(v)}
  catch(error){toast(error.message,true);button.disabled=false}
  finally{form.dataset.submitting="0"}
 });
 $("#points-award-form")?.addEventListener("submit",async e=>{
  e.preventDefault();const form=e.currentTarget;if(form.dataset.submitting==="1")return;
  const data=new FormData(form),button=form.querySelector('button[type="submit"]');
  form.dataset.submitting="1";button.disabled=true;
  try{const payload={student_id:studentId,points:Number(data.get("points")||0),reason:data.get("reason")};await api("/points/award",{method:"POST",body:JSON.stringify({...payload,request_id:idempotentFormRequestId(form,payload)})});toast("تم منح النقاط");await pointsPage(v)}
  catch(error){toast(error.message,true);button.disabled=false}
  finally{form.dataset.submitting="0"}
 });
  // لوحة الشيخ: منح النقاط، خصم الجزاء، وورد سريع.
  if(canManage){
   document.querySelectorAll("[data-quick-reason]").forEach(btn=>btn.addEventListener("click",()=>{
     const input=$("#points-award-form")?.querySelector('input[name="reason"]');if(input){input.value=btn.dataset.quickReason||"";input.focus();toast("اختر النقاط ثم اضغط «منح النقاط»")}
   }));
   $("#penalty-form")?.addEventListener("submit",async e=>{
     e.preventDefault();const form=e.currentTarget,data=new FormData(form);
     try{await api("/penalties",{method:"POST",body:JSON.stringify({student_id:studentId,store_points:Number(data.get("store_points")||0),reason:data.get("reason")})});toast("تم خصم الجزاء من رصيد النقاط");await pointsPage(v)}catch(error){toast(error.message,true)}
   });
  }
 const storeForm=$("#store-item-form");
 function resetStoreForm(){
  if(!storeForm)return;
  storeForm.reset();
  const idField=storeForm.querySelector('[name="item_id"]');
  if(idField)idField.value="";
  const activeField=storeForm.querySelector('[name="active"]');
  if(activeField)activeField.checked=true;
  const title=$("#store-form-title"),cancel=$("#store-form-cancel");
  if(title)title.textContent="إضافة مادة إلى المتجر";
  if(cancel)cancel.hidden=true;
 }
 function fillStoreForm(item){
  if(!storeForm||!item)return;
  const set=(name,value)=>{const field=storeForm.querySelector('[name="'+name+'"]');if(field)field.value=value??""};
  set("item_id",item.id);set("name",item.name);set("cost",item.cost);set("stock",item.stock===null?"":item.stock);set("max_per_student",item.max_per_student===null?"":item.max_per_student);set("icon",item.icon||"??");set("image_url",item.image_url||"");set("sort_order",item.sort_order||0);set("description",item.description||"");
  const active=storeForm.querySelector('[name="active"]');if(active)active.checked=Number(item.active)!==0;
  const title=$("#store-form-title"),cancel=$("#store-form-cancel");
  if(title)title.textContent="تعديل مادة في المتجر";
  if(cancel)cancel.hidden=false;
  storeForm.scrollIntoView({block:"center"});
 }
 $("#store-form-cancel")?.addEventListener("click",resetStoreForm);
 document.querySelectorAll("[data-store-edit]").forEach(btn=>btn.onclick=()=>{
  const item=(store.items||[]).find(x=>x.id===btn.dataset.storeEdit);
  fillStoreForm(item);
 });
 $("#store-item-form")?.addEventListener("submit",async e=>{
  e.preventDefault();const form=e.currentTarget,data=new FormData(form),submit=form.querySelector('button[type="submit"]');
  if(submit)submit.disabled=true;
  try{const itemId=String(data.get("item_id")||"");await api("/store/items",{method:"POST",body:JSON.stringify({id:itemId||undefined,name:data.get("name"),description:data.get("description"),icon:data.get("icon"),image_url:data.get("image_url"),cost:Number(data.get("cost")),stock:data.get("stock")===""?null:Number(data.get("stock")),max_per_student:data.get("max_per_student")===""?null:Number(data.get("max_per_student")),sort_order:Number(data.get("sort_order")||0),active:Boolean(data.get("active"))})});toast(itemId?"تم حفظ تعديل المادة":"تمت إضافة المادة بعد تأكيدك");await pointsPage(v)}catch(error){if(submit)submit.disabled=false;toast(error.message,true)}
 });
 document.querySelectorAll("[data-store-toggle]").forEach(btn=>btn.onclick=async()=>{
  const item=(store.items||[]).find(x=>x.id===btn.dataset.storeToggle);
  if(!item)return;
  btn.disabled=true;
  try{await api("/store/items",{method:"POST",body:JSON.stringify({id:item.id,name:item.name,description:item.description,icon:item.icon,cost:Number(item.cost),stock:item.stock,max_per_student:item.max_per_student,sort_order:Number(item.sort_order||0),active:Number(item.active)===0})});toast("تم تحديث حالة المادة");await pointsPage(v)}catch(error){btn.disabled=false;toast(error.message,true)}
 });
 document.querySelectorAll("[data-rule-config]").forEach(btn=>btn.onclick=async()=>{
  try{
   const config=JSON.parse(decodeURIComponent(btn.dataset.ruleConfig)),tr=btn.closest("tr");
   await api("/points/rules",{method:"POST",body:JSON.stringify({...config,achievement_points:Number(tr.querySelector("[data-rule-achievement]").value),store_points:Number(tr.querySelector("[data-rule-store]").value),bonus_percent:Number(tr.querySelector("[data-rule-bonus]").value),max_per_day:tr.querySelector("[data-rule-max]").value===""?null:Number(tr.querySelector("[data-rule-max]").value),active:tr.querySelector("[data-rule-active]").checked})});
   toast("تم حفظ قاعدة النقاط");await pointsPage(v);
  }catch(error){toast(error.message,true)}
 });
}
async function contentPage(v){
 const isAdmin=S.user.role==="admin",isStudent=S.user.role==="student";
 const KINDS={hadith:"الحديث النبوي",mutoon:"المتون العلمية",duas:"الأدعية المأثورة",adhkar:"الأذكار"};
 const STATUS_LABELS={draft:"مسودة",needs_source:"بحاجة إلى توثيق",pending_review:"بانتظار مراجعة الشيخ",approved:"معتمد",published:"منشور",archived:"مؤرشف"};
 const ATTRIB_LABELS={verbatim:"نقل كما هو",light_edit:"نقل بتصرف يسير",summary:"تلخيص من كلام المؤلف",academy:"شرح أو صياغة تربوية من الأكاديمية",multi_source:"إضافة من مصادر متعددة"};
 if(!KINDS[S.contentKind])S.contentKind="hadith";
 const kind=S.contentKind,kindLabel=KINDS[kind];
 v.innerHTML=head("الحديث والمتون والأدعية","نصوص منتقاة مع ذكر المصدر والمرجع وحالة المراجعة قبل النشر.")+'<div class="loading">جار تحميل المحتوى…</div>';
 let rows=[];
 try{rows=await api("/content?kind="+encodeURIComponent(kind))}catch(e){v.innerHTML=head("الحديث والمتون والأدعية",kindLabel)+'<div class="notice error">'+esc(e.message)+'</div>';return}
 const tabs='<div class="student-actions content-kind-tabs" style="margin-bottom:12px">'+Object.entries(KINDS).map(([key,label])=>'<button class="btn '+(kind===key?"":"secondary")+'" type="button" data-content-kind="'+key+'">'+label+'</button>').join("")+'</div>';
 let html=head("الحديث والمتون والأدعية",kindLabel+" · نصوص منتقاة مع ذكر المصدر والمرجع وحالة المراجعة.")+tabs;
 if(isAdmin){
  const statusOptions=Object.entries(STATUS_LABELS).map(([key,label])=>'<option value="'+key+'"'+(key==="draft"?" selected":"")+'>'+label+'</option>').join("");
  const attribOptions=Object.entries(ATTRIB_LABELS).map(([key,label])=>'<option value="">—</option><option value="'+key+'">'+label+'</option>').join("");
  html+='<section class="card"><h3>إضافة نص جديد</h3><form id="content-create-form" class="form-grid"><input type="hidden" name="kind" value="'+esc(kind)+'"><label class="field wide">العنوان<input name="title" required maxlength="200"></label><label class="field wide">المتن<textarea name="text" required maxlength="8000" rows="4"></textarea></label><label class="field">المصدر<input name="source" maxlength="200" placeholder="مثال: صحيح البخاري"></label><label class="field">المرجع<input name="reference" maxlength="200" placeholder="رقم الحديث أو الصفحة"></label><label class="field">درجة النص<select name="grade"><option value="">غير محددة</option><option value="صحيح">صحيح</option><option value="حسن">حسن</option><option value="ضعيف">ضعيف</option></select></label><label class="field">نوع النسبة<select name="attribution">'+attribOptions+'</select></label><label class="field">المؤلف أو المصدر الأصلي<input name="author" maxlength="160" placeholder="اسم المؤلف إن وُجد"></label><label class="field">حالة المحتوى<select name="status">'+statusOptions+'</select></label><div class="wide"><button class="btn" type="submit">حفظ النص</button><span class="muted small">لا يُنشر النص دون مصدر ومرجع. حالة «منشور» تعني اعتماد الشيخ ومراجعته.</span></div></form>'+(kind==="duas"||kind==="adhkar"?'<div class="divider"></div><p class="muted small">يمكن إدراج مسودات أولية معتمدة على مصادر منشورة، وتُحفظ دائمًا بحالة «بانتظار مراجعة الشيخ» ولا تظهر للطلبة قبل الاعتماد.</p><button class="btn secondary" type="button" id="seed-duas">إدراج مسودات الأدعية والأذكار للمراجعة</button>':"")+'</section>';
 }
 html+='<section class="card"><h3>'+esc(kindLabel)+' ('+rows.length+')</h3><div class="list">'+(rows.length?rows.map(item=>{
  const progress=item.my_progress?('<span class="pill">'+(item.my_progress.status==="memorized"?"محفوظ":"قيد المراجعة")+'</span>'):"";
  const adminActions=isAdmin?'<button class="btn secondary" type="button" data-content-publish="'+esc(item.id)+'" data-content-status="'+(item.status==="published"?"approved":"published")+'">'+(item.status==="published"?"إلغاء النشر":"نشر")+'</button>':"";
  const studentActions=isStudent?'<button class="btn secondary" type="button" data-content-progress="'+esc(item.id)+'" data-content-progress-status="'+(item.my_progress?.status==="memorized"?"reviewing":"memorized")+'">'+(item.my_progress?.status==="memorized"?"إعادة للمراجعة":"أتممت الحفظ")+'</button>':"";
  const statusPill=item.status!=="published"?'<span class="pill is-warn">'+esc(STATUS_LABELS[item.status]||item.status)+'</span>':"";
  const attribution=item.attribution?esc(ATTRIB_LABELS[item.attribution]||item.attribution):"";
  const author=item.author?" · المؤلف: "+esc(item.author):"";
  return '<article class="card assignment-card"><div class="section-head"><div><h3>'+esc(item.title)+'</h3><p class="muted small">'+esc(item.source||"دون مصدر")+(item.reference?" · "+esc(item.reference):"")+(item.grade?" · "+esc(item.grade):"")+(attribution?" · "+attribution:"")+author+'</p></div><div class="student-actions">'+statusPill+progress+adminActions+studentActions+'</div></div><p class="content-body">'+esc(item.text)+'</p></article>';
 }).join(""):'<div class="empty">لا توجد نصوص في هذا القسم بعد.</div>')+'</div></section>';
 v.innerHTML=html;
 document.querySelectorAll("[data-content-kind]").forEach(btn=>btn.onclick=()=>{S.contentKind=btn.dataset.contentKind;page()});
 $("#content-create-form")?.addEventListener("submit",async e=>{
  e.preventDefault();const form=e.currentTarget,fd=new FormData(form),button=form.querySelector('button[type="submit"]');
  button.disabled=true;
  try{await api("/content",{method:"POST",body:JSON.stringify({kind:fd.get("kind"),title:fd.get("title"),text:fd.get("text"),source:fd.get("source"),reference:fd.get("reference"),grade:fd.get("grade"),status:fd.get("status"),attribution:fd.get("attribution"),author:fd.get("author")})});toast("حُفظ النص");await page()}catch(err){toast(err.message,true);button.disabled=false}
 });
 $("#seed-duas")?.addEventListener("click",async e=>{
  if(!confirm("إدراج مسودات الأدعية والأذكار المعتمدة على مصادر منشورة؟ ستُحفظ بحالة «بانتظار مراجعة الشيخ» ولن تظهر للطلبة حتى تعتمدها."))return;
  const button=e.currentTarget;button.disabled=true;
  try{const result=await api("/admin/content/seed-duas",{method:"POST",body:JSON.stringify({})});toast("أُدرجت "+Number(result.created||0)+" مسودة، وتُجاوزت "+Number(result.skipped||0)+" موجودة");await page()}catch(err){toast(err.message,true);button.disabled=false}
 });
 document.querySelectorAll("[data-content-publish]").forEach(btn=>btn.onclick=async()=>{
  btn.disabled=true;
  try{await api("/content/"+encodeURIComponent(btn.dataset.contentPublish),{method:"PATCH",body:JSON.stringify({status:btn.dataset.contentStatus})});toast("تم تحديث حالة المحتوى");await page()}catch(err){toast(err.message,true);btn.disabled=false}
 });
 document.querySelectorAll("[data-content-progress]").forEach(btn=>btn.onclick=async()=>{
  btn.disabled=true;
  try{await api("/content/"+encodeURIComponent(btn.dataset.contentProgress)+"/progress",{method:"POST",body:JSON.stringify({status:btn.dataset.contentProgressStatus})});toast("تم تحديث تتبع الحفظ");await page()}catch(err){toast(err.message,true);btn.disabled=false}
 });
}
async function competitionsPage(v){
 const role=S.user.role,isStudent=role==="student";
 const staff=["admin","teacher","director","supervisor"].includes(role);
 const canCreate=["admin","director"].includes(role);
 const kindLabels={quran_hifz:"حفظ القرآن",quran_tilawa:"الترتيل",quran_tajweed:"التجويد",hadith:"الحديث",mutoon:"المتون",seerah:"السيرة",islamic_culture:"الثقافة الإسلامية",other:"عام"};
 const statusLabels={draft:"مسودة",announced:"معلنة",registration:"التسجيل مفتوح",judging:"التحكيم",results:"النتائج",honored:"التكريم",archived:"مؤرشفة"};
 const regLabels={pending:"بانتظار الاعتماد",approved:"معتمد",rejected:"مرفوض",withdrawn:"منسحب",disqualified:"مستبعد"};
 const resultLabels={draft:"مسودة",approved:"معتمد",published:"منشور"};
 const flow={draft:["announced"],announced:["registration","draft"],registration:["judging","announced"],judging:["results","registration"],results:["honored","judging"],honored:["archived","results"],archived:[]};
 const criteriaDefaults={
  quran_hifz:[["الحفظ والإتقان",50],["الأداء والترتيل",20],["التجويد",15],["الوقار والالتزام",15]],
  quran_tilawa:[["صحة التلاوة",50],["التجويد",25],["حسن الصوت",15],["الوقار والالتزام",10]],
  quran_tajweed:[["تطبيق الأحكام",50],["المخارج والصفات",25],["التمثّل في التلاوة",15],["الوقار والالتزام",10]],
  hadith:[["الحفظ والاستظهار",50],["الفهم والاستنباط",25],["العرض والأداء",15],["الأدب والالتزام",10]],
  mutoon:[["حفظ المتن",50],["فهم المتن",25],["العرض",15],["الأدب والالتزام",10]],
  seerah:[["المعرفة والضبط",50],["الفهم والاستنباط",25],["العرض",15],["الأدب والالتزام",10]],
  islamic_culture:[["المعرفة والضبط",50],["الفهم والاستدلال",25],["العرض",15],["الأدب والالتزام",10]],
  other:[["المعرفة والإتقان",50],["الفهم",25],["العرض",15],["الأدب والالتزام",10]]
 };
 const tabs=isStudent?[["available","المتاحة لي"],["mine","مشاركاتي ونتائجي"],["calendar","الرزنامة"]]:[["manage","المسابقات"],["judging","التسجيلات والتحكيم"],["results","النتائج"],["calendar","الرزنامة"],...(canCreate?[["terms","الشروط المرجعية"]]:[])];
 if(!tabs.some(t=>t[0]===S.competitionTab))S.competitionTab=tabs[0][0];
 const tab=S.competitionTab;
 let competitions=[],categories=[],calendar=[];
 try{competitions=await api("/competitions")}catch(e){v.innerHTML=head("المسابقات","منظومة المسابقات القرآنية والعلمية")+'<div class="notice error">'+esc(e.message)+'</div>';return}
 try{categories=await api("/competitions/categories")}catch{}
 if(role==="admin"&&!S.schools?.length){try{S.schools=await api("/public/quran-schools")}catch{}}
 if(tab==="calendar"){try{calendar=await api("/competitions/calendar")}catch{calendar=[]}}
 const catName=id=>{const c=categories.find(x=>x.id===id);return c?c.name:""};
 const fmtDate=value=>value?esc(String(value).slice(0,10)):"—";
 const dateText=item=>{const parts=[];if(item.registration_starts_at||item.registration_ends_at)parts.push("التسجيل: "+(item.registration_starts_at?fmtDate(item.registration_starts_at):"?")+" — "+(item.registration_ends_at?fmtDate(item.registration_ends_at):"?"));if(item.starts_at||item.ends_at)parts.push("المسابقة: "+(item.starts_at?fmtDate(item.starts_at):"?")+" — "+(item.ends_at?fmtDate(item.ends_at):"?"));return parts.join(" · ")};
 const conditionsText=item=>{const parts=[];if(item.min_age!==null&&item.min_age!==undefined||item.max_age!==null&&item.max_age!==undefined)parts.push("العمر: "+(item.min_age??"")+"–"+(item.max_age??""));if(item.min_hizb!==null&&item.min_hizb!==undefined||item.max_hizb!==null&&item.max_hizb!==undefined)parts.push("الحفظ: "+(item.min_hizb??"")+"–"+(item.max_hizb??"")+" حزبًا");if(item.riwayat&&item.riwayat.length)parts.push("الروايات: "+item.riwayat.join("، "));if(item.requires_approval)parts.push("يتطلب اعتماد التسجيل");if(item.max_participants)parts.push("الحد الأقصى: "+Number(item.max_participants)+" مشاركًا");return parts.join(" · ")};
 function criterionRow(c){const id=c.id||("criterion_"+Math.random().toString(36).slice(2,7));return '<div class="form-grid" data-criterion-row data-criterion-id="'+esc(id)+'"><label class="field">المعيار<input data-criterion-label maxlength="120" value="'+esc(c.label||"")+'"></label><label class="field">الدرجة القصوى<input data-criterion-max type="number" min="1" max="100" value="'+esc(c.max??50)+'"></label><div class="wide"><button class="btn secondary" type="button" data-remove-row>حذف المعيار</button></div></div>'}
 function awardRow(a){return '<div class="form-grid" data-award-row><label class="field">المرتبة<input data-award-place type="number" min="1" max="100" value="'+esc(a.place??1)+'"></label><label class="field">الوصف<input data-award-label maxlength="80" value="'+esc(a.label||"")+'"></label><label class="field">رصيد النقاط<input data-award-achievement type="number" min="0" max="100000" value="'+Number(a.achievement||0)+'"></label><label class="field">رصيد النقاط<input data-award-store type="number" min="0" max="100000" value="'+Number(a.store||0)+'"></label><div class="wide"><button class="btn secondary" type="button" data-remove-row>حذف المكافأة</button></div></div>'}
 function formMarkup(item){
  const kind=item?.kind||"quran_hifz";
  const crit=(item&&item.judging_criteria&&item.judging_criteria.length)?item.judging_criteria:(criteriaDefaults[kind]||criteriaDefaults.other).map(([label,max],i)=>({id:"criterion_"+(i+1),label,max}));
  const awards=(item&&item.awards&&item.awards.length)?item.awards:[{place:1,label:"المرتبة الأولى",achievement:100,store:50},{place:2,label:"المرتبة الثانية",achievement:70,store:30},{place:3,label:"المرتبة الثالثة",achievement:50,store:20}];
  const kindOptions=Object.entries(kindLabels).map(([k,label])=>'<option value="'+k+'"'+(kind===k?" selected":"")+'>'+esc(label)+'</option>').join("");
  const categoryOptions=categories.map(c=>'<option value="'+esc(c.id)+'"'+(item?.category_id===c.id?" selected":"")+'>'+esc(c.name)+'</option>').join("");
  const schoolField=role==="admin"?'<label class="field">المدرسة (اختياري)<select name="school_id"><option value="">كل المدارس</option>'+(S.schools||[]).map(s=>'<option value="'+esc(s.id)+'"'+(item?.school_id===s.id?" selected":"")+'>'+esc(s.name)+'</option>').join("")+'</select></label>':"";
  return '<section class="card" id="competition-editor"><div class="section-head"><div><h3>'+(item?"تعديل المسابقة":"مسابقة جديدة")+'</h3><p>المواعيد والشروط والمعايير والمكافآت كلها بيانات قابلة للتعديل لكل دورة.</p></div><button class="btn secondary" type="button" data-competition-editor-close>إغلاق</button></div><form id="competition-form" data-competition-id="'+esc(item?.id||"")+'" class="form-grid">'+
   '<label class="field wide">عنوان المسابقة<input name="title" required maxlength="180" value="'+esc(item?.title||"")+'"></label>'+
   '<label class="field wide">الوصف<textarea name="description" maxlength="6000" rows="2">'+esc(item?.description||"")+'</textarea></label>'+
   '<label class="field">نوع المسابقة<select name="kind" id="competition-kind">'+kindOptions+'</select></label>'+
   '<label class="field">الموسم<input name="season" maxlength="80" value="'+esc(item?.season||"general")+'" placeholder="المولد، رمضان، الختام…"></label>'+
   '<label class="field">الفئة<select name="category_id"><option value="">بدون فئة</option>'+categoryOptions+'</select></label>'+schoolField+
   '<label class="field">بدء التسجيل<input name="registration_starts_at" type="date" value="'+esc(item?.registration_starts_at||"")+'"></label>'+
   '<label class="field">انتهاء التسجيل<input name="registration_ends_at" type="date" value="'+esc(item?.registration_ends_at||"")+'"></label>'+
   '<label class="field">بداية المسابقة<input name="starts_at" type="date" value="'+esc(item?.starts_at||"")+'"></label>'+
   '<label class="field">نهاية المسابقة<input name="ends_at" type="date" value="'+esc(item?.ends_at||"")+'"></label>'+
   '<label class="field">أدنى عمر<input name="min_age" type="number" min="3" max="100" value="'+esc(item?.min_age??"")+'"></label>'+
   '<label class="field">أقصى عمر<input name="max_age" type="number" min="3" max="100" value="'+esc(item?.max_age??"")+'"></label>'+
   '<label class="field">أدنى حفظ (أحزاب)<input name="min_hizb" type="number" min="0" max="60" value="'+esc(item?.min_hizb??"")+'"></label>'+
   '<label class="field">أقصى حفظ (أحزاب)<input name="max_hizb" type="number" min="1" max="60" value="'+esc(item?.max_hizb??"")+'"></label>'+
   '<label class="field wide">الروايات المسموحة (مفصولة بفاصلة)<input name="riwayat" maxlength="400" value="'+esc((item?.riwayat||[]).join("، "))+'"></label>'+
   '<label class="field">الحد الأقصى للمشاركين<input name="max_participants" type="number" min="1" value="'+esc(item?.max_participants??"")+'"></label>'+
   '<label class="field">نقاط إنجاز للمشاركة<input name="participation_achievement" type="number" min="0" max="100000" value="'+Number(item?.participation_achievement||0)+'"></label>'+
   '<label class="field">رصيد متجر للمشاركة<input name="participation_store" type="number" min="0" max="100000" value="'+Number(item?.participation_store||0)+'"></label>'+
   '<label class="field wide">شروط المسابقة<textarea name="rules" maxlength="8000" rows="3">'+esc(item?.rules||"")+'</textarea></label>'+
   '<label class="field wide"><span><input name="requires_approval" type="checkbox"'+(item?.requires_approval?" checked":"")+'> يتطلب اعتماد الإدارة للتسجيل</span></label>'+
   '<div class="wide"><div class="section-head"><div><h4>معايير التحكيم</h4><p>تُجمع درجات المحكمين وتُحوَّل إلى نسبة من 100.</p></div><button class="btn secondary" type="button" data-add-criterion>إضافة معيار</button></div><div id="competition-criteria">'+crit.map(criterionRow).join("")+'</div></div>'+
   '<div class="wide"><div class="section-head"><div><h4>المكافآت</h4><p>تُمنح مرة واحدة عند اعتماد النتائج، ولا تُغيّر سجلات الحفظ أو الحضور.</p></div><button class="btn secondary" type="button" data-add-award>إضافة مكافأة</button></div><div id="competition-awards">'+awards.map(awardRow).join("")+'</div></div>'+
   '<div class="wide"><button class="btn" type="submit">'+(item?"حفظ التعديلات":"إنشاء المسابقة")+'</button></div></form></section>';
 }
 function studentCard(item){
  const reg=item.my_registration;
  let action="";
  if(reg){action='<div class="notice">تسجيلك: <strong>'+esc(regLabels[reg.status]||reg.status)+'</strong>'+(reg.decision_note?' — '+esc(reg.decision_note):"")+'</div>'}
  else if(item.eligibility?.eligible){
   const riwayaField=item.riwayat&&item.riwayat.length?'<label class="field">الرواية<select name="riwaya">'+item.riwayat.map(r=>'<option value="'+esc(r)+'">'+esc(r)+'</option>').join("")+'</select></label>':"";
   action='<form data-register-form="'+esc(item.id)+'" class="form-grid">'+riwayaField+'<label class="field wide">ملاحظة (اختياري)<input name="note" maxlength="1000"></label><div class="wide"><button class="btn" type="submit">سجّل في المسابقة</button></div></form>';
  }else{action='<div class="notice">'+(item.eligibility?.reasons||["غير مؤهل"]).map(r=>esc(r)).join(" · ")+'</div>'}
  const resultBtn=reg?'<button class="btn secondary" type="button" data-my-result="'+esc(item.id)+'">نتيجتي</button>':"";
  return '<article class="card"><div class="section-head"><div><h3>'+esc(item.title)+'</h3><p class="muted small">'+esc(kindLabels[item.kind]||item.kind)+(item.season?" · "+esc(item.season):"")+(item.category_id?" · "+esc(catName(item.category_id)):"")+'</p></div><span class="pill">'+esc(statusLabels[item.status]||item.status)+'</span></div><p class="content-body">'+esc(item.description||"")+'</p><p class="muted small">'+dateText(item)+'</p>'+(conditionsText(item)?'<p class="muted small">'+esc(conditionsText(item))+'</p>':"")+(item.rules?'<details><summary>الشروط</summary><p class="content-body">'+esc(item.rules)+'</p></details>':"")+action+'<div class="student-actions" style="margin-top:8px">'+resultBtn+'</div><div id="competition-panel-'+esc(item.id)+'"></div></article>';
 }
 function staffCard(item){
  const nexts=flow[item.status]||[];
  const statusButtons=canCreate?nexts.map(next=>'<button class="btn secondary" type="button" data-competition-status="'+esc(item.id)+'" data-competition-next="'+next+'">'+esc(statusLabels[next])+'</button>').join(""):"";
  const editBtn=canCreate?'<button class="btn secondary" type="button" data-competition-edit="'+esc(item.id)+'">تعديل</button>':"";
  return '<article class="card"><div class="section-head"><div><h3>'+esc(item.title)+'</h3><p class="muted small">'+esc(kindLabels[item.kind]||item.kind)+(item.season?" · "+esc(item.season):"")+' · '+esc(statusLabels[item.status]||item.status)+'</p></div><span class="pill">'+Number(item.entries_count||0)+' تسجيل</span></div><p class="muted small">'+dateText(item)+'</p><p class="muted small">معتمد: '+Number(item.approved_count||0)+' · مُقيَّم: '+Number(item.scored_count||0)+'</p><div class="student-actions" style="margin-top:8px"><button class="btn secondary" type="button" data-competition-manage="'+esc(item.id)+'">إدارة</button>'+editBtn+statusButtons+'</div><div id="competition-panel-'+esc(item.id)+'"></div></article>';
 }
 function registrationRow(detail,r,crit){
  const avg=r.average_score!==null&&r.average_score!==undefined?' · متوسط المحكمين: '+Number(r.average_score):"";
  const locked=["approved","published"].includes(r.result_status||"");
  const decide=!locked?'<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px"><button class="btn secondary" type="button" data-reg-decision="approved" data-reg-id="'+esc(r.id)+'">اعتماد</button><button class="btn secondary" type="button" data-reg-decision="withdrawn" data-reg-id="'+esc(r.id)+'">انسحاب</button><button class="btn danger" type="button" data-reg-decision="rejected" data-reg-id="'+esc(r.id)+'">رفض</button><button class="btn danger" type="button" data-reg-decision="disqualified" data-reg-id="'+esc(r.id)+'">استبعاد</button></div><input data-reg-note placeholder="سبب الرفض أو الاستبعاد (إلزامي للرفض)" maxlength="600" style="margin-top:6px">':"";
  const scoreForm=detail.status==="judging"&&r.status==="approved"?'<form data-score-form data-reg-id="'+esc(r.id)+'" class="form-grid" style="margin-top:8px">'+crit.map(c=>'<label class="field">'+esc(c.label)+' (من '+Number(c.max)+')<input data-score-criterion="'+esc(c.id)+'" type="number" min="0" max="'+Number(c.max)+'" step="0.5" required></label>').join("")+'<label class="field">ملاحظة<input name="note" maxlength="1000"></label><div class="wide"><button class="btn" type="submit">حفظ التقييم</button></div></form>':"";
  return '<div class="list-row" style="display:block"><div><strong>'+esc(r.student_name||"طالب")+'</strong><small>'+esc(r.group_name||"")+' · العمر: '+esc(r.age_at_registration??"—")+' · الحفظ: '+esc(r.hizb_at_registration||"—")+(r.riwaya?' · '+esc(r.riwaya):"")+' · '+esc(regLabels[r.status]||r.status)+avg+(r.rank?' · المرتبة '+Number(r.rank):"")+'</small>'+(r.decision_note?'<p class="muted small">'+esc(r.decision_note)+'</p>':"")+'</div>'+decide+scoreForm+'</div>';
 }
 function managePanelMarkup(detail,regs){
  const crit=detail.judging_criteria||[],awards=detail.awards||[];
  let h='<div class="divider"></div><p class="muted small">'+esc(kindLabels[detail.kind]||detail.kind)+(detail.season?" · "+esc(detail.season):"")+(detail.category_id?" · "+esc(catName(detail.category_id)):"")+'</p>';
  if(conditionsText(detail))h+='<p class="muted small">'+esc(conditionsText(detail))+'</p>';
  if(detail.rules)h+='<details><summary>الشروط</summary><p class="content-body">'+esc(detail.rules)+'</p></details>';
  h+='<p class="muted small">المعايير: '+crit.map(c=>esc(c.label)+" ("+Number(c.max)+")").join(" · ")+'</p>';
  h+='<p class="muted small">المكافآت: '+(awards.length?awards.map(a=>esc(a.label||("المرتبة "+a.place))+": "+Number(a.achievement)+" إنجاز / "+Number(a.store)+" متجر").join(" · "):"لا مكافآت محددة")+'</p>';
  if(canCreate){
   h+='<div class="section-head"><div><h4>المحكمون</h4><p class="muted small">يمكن للمعلم تصحيح طلاب أفواجه، أو تعيين محكمين للمسابقة.</p></div></div><div class="list">'+((detail.judges||[]).length?detail.judges.map(j=>'<div class="list-row"><span>'+esc(j.display_name)+'</span><button class="btn secondary" type="button" data-judge-remove="'+esc(j.user_id)+'">إزالة</button></div>').join(""):'<p class="muted small">لم يُعيَّن محكمون بعد.</p>')+'</div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"><select data-judge-select><option value="">اختر محكمًا…</option></select><button class="btn secondary" type="button" data-judge-add>تعيين</button></div>';
  }
  h+='<h4>التسجيلات ('+regs.length+')</h4><div class="list">'+(regs.length?regs.map(r=>registrationRow(detail,r,crit)).join(""):'<p class="muted small">لا توجد تسجيلات بعد.</p>')+'</div>';
  if(canCreate){
   h+='<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">';
   if(["judging","results"].includes(detail.status))h+='<button class="btn" type="button" data-panel-generate="'+esc(detail.id)+'">توليد النتائج من درجات المحكمين</button>';
   if(detail.status==="results")h+='<button class="btn" type="button" data-panel-approve="'+esc(detail.id)+'">اعتماد النتائج وإصدار المكافآت مرة واحدة</button>';
   h+='</div>';
  }
  h+='<h4>الرزنامة</h4><div class="list">'+((detail.events||[]).length?detail.events.map(e=>'<div class="list-row"><div><strong>'+esc(e.title)+'</strong><small>'+fmtDate(e.event_date)+' · '+esc(e.description||"")+'</small></div>'+(canCreate?'<button class="btn secondary" type="button" data-event-delete="'+esc(e.id)+'">حذف</button>':"")+'</div>').join(""):'<p class="muted small">لا أحداث مرتبطة.</p>')+'</div>';
  if(canCreate)h+='<form data-event-form="'+esc(detail.id)+'" class="form-grid" style="margin-top:8px"><label class="field">عنوان الحدث<input name="title" required maxlength="180"></label><label class="field">التاريخ<input name="event_date" type="date" required></label><label class="field">النوع<select name="kind"><option value="announcement">إعلان</option><option value="registration">تسجيل</option><option value="judging">تحكيم</option><option value="result">نتيجة</option><option value="honoring">تكريم</option><option value="other">أخرى</option></select></label><label class="field">وصف<input name="description" maxlength="3000"></label><div class="wide"><button class="btn secondary" type="submit">إضافة حدث</button></div></form>';
  return h;
 }
 async function showResults(id,host,btn){
  if(btn)btn.disabled=true;
  try{
   const data=await api("/competitions/"+encodeURIComponent(id)+"/results");
   if(Array.isArray(data)){
    host.innerHTML='<div class="divider"></div><h4>النتائج</h4>'+(data.length?'<div class="table-wrap"><table><thead><tr><th>المرتبة</th><th>الطالب</th><th>الفوج</th><th>الدرجة</th><th>المكافأة</th><th>الحالة</th></tr></thead><tbody>'+data.map(r=>'<tr><td>'+esc(r.rank??"—")+'</td><td>'+esc(r.student_name)+'</td><td>'+esc(r.group_name||"")+'</td><td>'+esc(r.final_score??"—")+'</td><td>'+Number(r.award_achievement||0)+' / '+Number(r.award_store||0)+'</td><td>'+esc(resultLabels[r.status]||r.status)+'</td></tr>').join("")+'</tbody></table></div>':'<p class="muted small">لا نتائج بعد.</p>');
   }else{
    host.innerHTML='<div class="divider"></div><h4>نتيجتي</h4>'+(data.mine?'<div class="stats"><div class="stat"><small>المرتبة</small><strong>'+esc(data.mine.rank??"—")+'</strong></div><div class="stat"><small>الدرجة</small><strong>'+esc(data.mine.final_score??"—")+'</strong></div><div class="stat"><small>المكافأة</small><strong>'+Number(data.mine.award_achievement||0)+' / '+Number(data.mine.award_store||0)+'</strong></div></div>':'<p class="muted small">لم تُنشر نتيجتك بعد.</p>')+'<h4>الترتيب</h4>'+(data.ranking&&data.ranking.length?'<div class="list">'+data.ranking.map(r=>'<div class="list-row"><span>'+esc(r.rank)+'. '+(r.is_self?"أنت":esc(r.student_name))+'</span><span class="pill">'+esc(r.final_score)+'</span></div>').join("")+'</div>':'<p class="muted small">لا ترتيب منشور بعد.</p>');
   }
  }catch(e){toast(e.message,true)}finally{if(btn)btn.disabled=false}
 }
 async function generateResults(id){
  try{const res=await api("/competitions/"+encodeURIComponent(id)+"/results/generate",{method:"POST",body:"{}"});toast("وُلّدت النتائج: "+Number(res.results?.length||0));await competitionsPage(v)}catch(e){toast(e.message,true)}
 }
 async function approveResults(id){
  if(!confirm("اعتماد النتائج وإصدار المكافآت مرة واحدة؟"))return;
  try{const res=await api("/competitions/"+encodeURIComponent(id)+"/results/approve",{method:"POST",body:"{}"});toast("اعتُمدت النتائج. المكافآت الممنوحة: "+Number(res.awarded||0));await competitionsPage(v)}catch(e){toast(e.message,true)}
 }
 async function openManage(id,host,btn){
  if(btn)btn.disabled=true;
  try{
   const [detail,regs]=await Promise.all([api("/competitions/"+encodeURIComponent(id)),api("/competitions/"+encodeURIComponent(id)+"/registrations")]);
   host.innerHTML=managePanelMarkup(detail,regs);
   const rerender=()=>openManage(detail.id,host,null);
   host.querySelectorAll("[data-reg-decision]").forEach(b=>b.onclick=async()=>{
    const row=b.closest(".list-row"),note=row?.querySelector("[data-reg-note]")?.value.trim()||"",decision=b.dataset.regDecision;
    if(decision==="rejected"&&note.length<3){toast("اكتب سبب الرفض",true);return}
    b.disabled=true;
    try{await api("/competitions/"+encodeURIComponent(detail.id)+"/registrations/"+encodeURIComponent(b.dataset.regId)+"/decision",{method:"POST",body:JSON.stringify({decision,note})});toast("تم تسجيل القرار");await rerender()}catch(e){toast(e.message,true);b.disabled=false}
   });
   host.querySelectorAll("[data-score-form]").forEach(form=>form.addEventListener("submit",async e=>{
    e.preventDefault();const submit=form.querySelector('button[type="submit"]');submit.disabled=true;
    try{const criteria=[...form.querySelectorAll("[data-score-criterion]")].map(input=>({id:input.dataset.scoreCriterion,score:Number(input.value)}));const note=form.querySelector('input[name="note"]')?.value||"";await api("/competitions/"+encodeURIComponent(detail.id)+"/registrations/"+encodeURIComponent(form.dataset.regId)+"/score",{method:"POST",body:JSON.stringify({criteria,note})});toast("حُفظ التقييم");await rerender()}catch(err){toast(err.message,true);submit.disabled=false}
   }));
   host.querySelector("[data-panel-generate]")?.addEventListener("click",()=>generateResults(detail.id));
   host.querySelector("[data-panel-approve]")?.addEventListener("click",()=>approveResults(detail.id));
   host.querySelectorAll("[data-event-delete]").forEach(b=>b.onclick=async()=>{b.disabled=true;try{await api("/competition-events/"+encodeURIComponent(b.dataset.eventDelete),{method:"DELETE"});toast("حُذف الحدث");await rerender()}catch(e){toast(e.message,true);b.disabled=false}});
   host.querySelectorAll("[data-event-form]").forEach(form=>form.addEventListener("submit",async e=>{
    e.preventDefault();const fd=new FormData(form),submit=form.querySelector('button[type="submit"]');submit.disabled=true;
    try{await api("/competition-events",{method:"POST",body:JSON.stringify({competition_id:form.dataset.eventForm,title:fd.get("title"),description:fd.get("description"),event_date:fd.get("event_date"),kind:fd.get("kind")})});toast("أُضيف الحدث");await rerender()}catch(err){toast(err.message,true);submit.disabled=false}
   }));
   host.querySelectorAll("[data-judge-remove]").forEach(b=>b.onclick=async()=>{b.disabled=true;try{await api("/competitions/"+encodeURIComponent(detail.id)+"/judges/"+encodeURIComponent(b.dataset.judgeRemove),{method:"DELETE"});toast("أُزيل المحكم");await rerender()}catch(e){toast(e.message,true);b.disabled=false}});
   const select=host.querySelector("[data-judge-select]");
   if(select){
    let candidates=[];try{candidates=await api("/teachers")}catch{}
    if(role==="admin"){try{const staffRows=await api("/admin/staff");candidates=candidates.concat(staffRows)}catch{}}
    const assigned=new Set((detail.judges||[]).map(j=>j.user_id));
    const roleNames={admin:"مدير",director:"مدير مدرسة",teacher:"معلم",supervisor:"مشرف"};
    candidates.filter(c=>c&&c.id&&!assigned.has(c.id)).forEach(c=>{const option=document.createElement("option");option.value=c.id;option.textContent=(c.name||c.display_name||"")+(c.role?" — "+(roleNames[c.role]||c.role):"");select.append(option)});
    host.querySelector("[data-judge-add]")?.addEventListener("click",async()=>{if(!select.value){toast("اختر محكمًا",true);return}try{await api("/competitions/"+encodeURIComponent(detail.id)+"/judges",{method:"POST",body:JSON.stringify({user_id:select.value})});toast("عُيّن المحكم");await rerender()}catch(e){toast(e.message,true)}});
   }
  }catch(e){toast(e.message,true)}finally{if(btn)btn.disabled=false}
 }
 let html=head("المسابقات",isStudent?"المسابقات المتاحة لك وشروطها ومواعيدها ونتائجك.":"إدارة المسابقات والفئات والشروط والتحكيم والنتائج.");
 html+='<div style="display:flex;gap:8px;flex-wrap:wrap;margin:12px 0">'+tabs.map(t=>'<button class="btn '+(tab===t[0]?"":"secondary")+'" type="button" data-competition-tab="'+t[0]+'">'+t[1]+'</button>').join("")+'</div>';
 if(tab==="available"){
  const rows=competitions.filter(c=>["announced","registration","judging","results","honored"].includes(c.status));
  html+='<div class="list">'+(rows.length?rows.map(studentCard).join(""):'<div class="empty">لا توجد مسابقات متاحة لك حاليًا.</div>')+'</div>';
 }
 if(tab==="mine"){
  const rows=competitions.filter(c=>c.my_registration);
  html+='<div class="list">'+(rows.length?rows.map(studentCard).join(""):'<div class="empty">لم تسجّل في أي مسابقة بعد. افتح «المتاحة لي» للتسجيل.</div>')+'</div>';
 }
 if(tab==="manage"){
  if(canCreate)html+='<div class="student-actions" style="margin-bottom:10px"><button class="btn" type="button" data-competition-new>مسابقة جديدة</button></div>';
  if(S.competitionEditor)html+=formMarkup(S.competitionEditor==="new"?null:competitions.find(c=>c.id===S.competitionEditor));
  html+='<div class="list">'+(competitions.length?competitions.map(staffCard).join(""):'<div class="empty">لا توجد مسابقات بعد.</div>')+'</div>';
 }
 if(tab==="judging"){
  const options=competitions.filter(c=>["registration","judging","results","honored"].includes(c.status));
  html+='<section class="card"><label class="field">اختر المسابقة<select id="competition-judge-select"><option value="">—</option>'+options.map(c=>'<option value="'+esc(c.id)+'"'+(S.competitionJudgeId===c.id?" selected":"")+'>'+esc(c.title)+' — '+esc(statusLabels[c.status]||c.status)+'</option>').join("")+'</select></label></section><div id="competition-judge-panel"></div>';
 }
 if(tab==="results"){
  const rows=competitions.filter(c=>["judging","results","honored","archived"].includes(c.status));
  html+='<div class="list">'+(rows.length?rows.map(item=>'<article class="card"><div class="section-head"><div><h3>'+esc(item.title)+'</h3><p class="muted small">'+esc(statusLabels[item.status]||item.status)+' · '+Number(item.approved_count||0)+' معتمد</p></div></div><div class="student-actions"><button class="btn secondary" type="button" data-results-view="'+esc(item.id)+'">عرض النتائج</button>'+(canCreate&&item.status==="judging"?'<button class="btn secondary" type="button" data-results-generate="'+esc(item.id)+'">توليد النتائج</button>':"")+(canCreate&&item.status==="results"?'<button class="btn" type="button" data-results-approve="'+esc(item.id)+'">اعتماد وإصدار المكافآت</button>':"")+'</div><div id="competition-results-'+esc(item.id)+'"></div></article>').join(""):'<div class="empty">لا مسابقات في مرحلة النتائج.</div>')+'</div>';
 }
 if(tab==="calendar"){
  html+='<section class="card"><div class="section-head"><div><h3>الرزنامة</h3><p>مواعيد الإعلان والتسجيل والتحكيم والنتائج والتكريم.</p></div></div>'+(calendar.length?'<div class="list">'+calendar.map(ev=>'<div class="list-row"><div><strong>'+esc(ev.title)+'</strong><small>'+fmtDate(ev.event_date)+' · '+esc({announcement:"إعلان",registration:"تسجيل",judging:"تحكيم",result:"نتيجة",honoring:"تكريم",other:"أخرى"}[ev.kind]||ev.kind)+(ev.competition_title?" · "+esc(ev.competition_title):"")+'</small>'+(ev.description?'<p class="muted small">'+esc(ev.description)+'</p>':"")+'</div>'+(canCreate?'<button class="btn secondary" type="button" data-calendar-delete="'+esc(ev.id)+'"'+(ev.derived?' disabled title="يُدار من مواعيد المسابقة"':"")+'>حذف</button>':"")+'</div>').join("")+'</div>':'<div class="empty">لا أحداث في الرزنامة بعد.</div>')+'</section>';
  if(canCreate)html+='<section class="card"><h3>إضافة حدث للرزنامة</h3><form id="calendar-form" class="form-grid"><label class="field">العنوان<input name="title" required maxlength="180"></label><label class="field">التاريخ<input name="event_date" type="date" required></label><label class="field">النوع<select name="kind"><option value="announcement">إعلان</option><option value="registration">تسجيل</option><option value="judging">تحكيم</option><option value="result">نتيجة</option><option value="honoring">تكريم</option><option value="other">أخرى</option></select></label><label class="field">المسابقة (اختياري)<select name="competition_id"><option value="">عام</option>'+competitions.map(c=>'<option value="'+esc(c.id)+'">'+esc(c.title)+'</option>').join("")+'</select></label><label class="field wide">الوصف<input name="description" maxlength="3000"></label><div class="wide"><button class="btn" type="submit">إضافة الحدث</button></div></form></section>';
 }
 if(tab==="terms"){
  let terms=[];try{terms=await api("/competition-terms")}catch(e){terms=[]}
  html+='<section class="card"><h3>الشروط المرجعية</h3><p class="muted small">شروط قابلة للتعديل لكل دورة؛ لا تُعتمد شروط دورة سابقة تلقائيًا.</p><div class="list">'+(terms.length?terms.map(t=>'<div class="list-row" style="display:block"><strong>'+esc(t.title)+'</strong><small>'+esc(kindLabels[t.kind]||t.kind)+(t.source?" · "+esc(t.source):"")+'</small><textarea data-term-body="'+esc(t.id)+'" rows="3" style="margin-top:6px">'+esc(t.body||"")+'</textarea><div style="display:flex;gap:6px;margin-top:6px"><button class="btn secondary" type="button" data-term-save="'+esc(t.id)+'">حفظ</button><button class="btn danger" type="button" data-term-delete="'+esc(t.id)+'">أرشفة</button></div></div>').join(""):'<p class="muted small">لا شروط مرجعية بعد.</p>')+'</div></section>';
  html+='<section class="card"><h3>إضافة شرط مرجعي</h3><form id="term-form" class="form-grid"><label class="field">النوع<select name="kind">'+Object.entries(kindLabels).map(([k,label])=>'<option value="'+k+'">'+esc(label)+'</option>').join("")+'</select></label><label class="field">العنوان<input name="title" required maxlength="180"></label><label class="field wide">النص<textarea name="body" required maxlength="8000" rows="4"></textarea></label><label class="field">المصدر<input name="source" maxlength="300"></label><div class="wide"><button class="btn" type="submit">إضافة</button></div></form></section>';
 }
 v.innerHTML=html;
 document.querySelectorAll("[data-competition-tab]").forEach(btn=>btn.onclick=()=>{S.competitionTab=btn.dataset.competitionTab;S.competitionEditor=null;competitionsPage(v)});
 document.querySelectorAll("[data-register-form]").forEach(form=>form.addEventListener("submit",async e=>{
  e.preventDefault();const submit=form.querySelector('button[type="submit"]');submit.disabled=true;
  try{const fd=new FormData(form);await api("/competitions/"+encodeURIComponent(form.dataset.registerForm)+"/register",{method:"POST",body:JSON.stringify({note:fd.get("note")||"",riwaya:fd.get("riwaya")||""})});toast("تم إرسال طلب التسجيل");await competitionsPage(v)}catch(err){toast(err.message,true);submit.disabled=false}
 }));
 document.querySelectorAll("[data-my-result]").forEach(btn=>btn.onclick=()=>showResults(btn.dataset.myResult,$("#competition-panel-"+CSS.escape(btn.dataset.myResult)),btn));
 document.querySelectorAll("[data-competition-new]").forEach(btn=>btn.onclick=()=>{S.competitionEditor="new";competitionsPage(v)});
 document.querySelectorAll("[data-competition-edit]").forEach(btn=>btn.onclick=()=>{S.competitionEditor=btn.dataset.competitionEdit;competitionsPage(v)});
 document.querySelectorAll("[data-competition-manage]").forEach(btn=>btn.onclick=()=>{const host=$("#competition-panel-"+CSS.escape(btn.dataset.competitionManage));if(!host)return;if(host.dataset.open==="1"){host.innerHTML="";host.dataset.open="";return}host.dataset.open="1";openManage(btn.dataset.competitionManage,host,btn)});
 document.querySelectorAll("[data-competition-status]").forEach(btn=>btn.onclick=async()=>{btn.disabled=true;try{await api("/competitions/"+encodeURIComponent(btn.dataset.competitionStatus)+"/status",{method:"POST",body:JSON.stringify({status:btn.dataset.competitionNext})});toast("تم تحديث حالة المسابقة");await competitionsPage(v)}catch(err){toast(err.message,true);btn.disabled=false}});
 document.querySelectorAll("[data-results-view]").forEach(btn=>btn.onclick=()=>{const host=$("#competition-results-"+CSS.escape(btn.dataset.resultsView));if(!host)return;if(host.dataset.open==="1"){host.innerHTML="";host.dataset.open="";return}host.dataset.open="1";showResults(btn.dataset.resultsView,host,btn)});
 document.querySelectorAll("[data-results-generate]").forEach(btn=>btn.onclick=()=>generateResults(btn.dataset.resultsGenerate));
 document.querySelectorAll("[data-results-approve]").forEach(btn=>btn.onclick=()=>approveResults(btn.dataset.resultsApprove));
 $("#competition-judge-select")?.addEventListener("change",e=>{S.competitionJudgeId=e.target.value;competitionsPage(v)});
 if(tab==="judging"&&S.competitionJudgeId){const host=$("#competition-judge-panel");if(host)openManage(S.competitionJudgeId,host,null)}
 $("#calendar-form")?.addEventListener("submit",async e=>{
  e.preventDefault();const form=e.currentTarget,fd=new FormData(form),submit=form.querySelector('button[type="submit"]');submit.disabled=true;
  try{await api("/competition-events",{method:"POST",body:JSON.stringify({competition_id:fd.get("competition_id")||null,title:fd.get("title"),description:fd.get("description"),event_date:fd.get("event_date"),kind:fd.get("kind")})});toast("أُضيف الحدث");await competitionsPage(v)}catch(err){toast(err.message,true);submit.disabled=false}
 });
 document.querySelectorAll("[data-calendar-delete]").forEach(btn=>btn.onclick=async()=>{btn.disabled=true;try{await api("/competition-events/"+encodeURIComponent(btn.dataset.calendarDelete),{method:"DELETE"});toast("حُذف الحدث");await competitionsPage(v)}catch(err){toast(err.message,true);btn.disabled=false}});
 document.querySelectorAll("[data-term-save]").forEach(btn=>btn.onclick=async()=>{const body=document.querySelector('[data-term-body="'+CSS.escape(btn.dataset.termSave)+'"]')?.value||"";btn.disabled=true;try{await api("/competition-terms/"+encodeURIComponent(btn.dataset.termSave),{method:"PATCH",body:JSON.stringify({body})});toast("حُفظ الشرط");await competitionsPage(v)}catch(err){toast(err.message,true);btn.disabled=false}});
 document.querySelectorAll("[data-term-delete]").forEach(btn=>btn.onclick=async()=>{btn.disabled=true;try{await api("/competition-terms/"+encodeURIComponent(btn.dataset.termDelete),{method:"DELETE"});toast("أُرشف الشرط");await competitionsPage(v)}catch(err){toast(err.message,true);btn.disabled=false}});
 $("#term-form")?.addEventListener("submit",async e=>{
  e.preventDefault();const form=e.currentTarget,fd=new FormData(form),submit=form.querySelector('button[type="submit"]');submit.disabled=true;
  try{await api("/competition-terms",{method:"POST",body:JSON.stringify({kind:fd.get("kind"),title:fd.get("title"),body:fd.get("body"),source:fd.get("source")})});toast("أُضيف الشرط");await competitionsPage(v)}catch(err){toast(err.message,true);submit.disabled=false}
 });
 const form=$("#competition-form");
 if(form){
  form.querySelectorAll("[data-remove-row]").forEach(btn=>btn.onclick=()=>btn.closest("[data-criterion-row],[data-award-row]")?.remove());
  form.querySelector("[data-competition-editor-close]")?.addEventListener("click",()=>{S.competitionEditor=null;competitionsPage(v)});
  form.querySelector("[data-add-criterion]")?.addEventListener("click",()=>{$("#competition-criteria").insertAdjacentHTML("beforeend",criterionRow({id:"criterion_"+Math.random().toString(36).slice(2,7),label:"",max:10}))});
  form.querySelector("[data-add-award]")?.addEventListener("click",()=>{$("#competition-awards").insertAdjacentHTML("beforeend",awardRow({place:4,label:"",achievement:0,store:0}))});
  $("#competition-criteria")?.addEventListener("input",()=>{const host=$("#competition-criteria");if(host)host.dataset.dirty="1"});
  $("#competition-kind")?.addEventListener("change",e=>{const host=$("#competition-criteria");if(!host||host.dataset.dirty==="1")return;host.innerHTML=(criteriaDefaults[e.target.value]||criteriaDefaults.other).map(([label,max],i)=>criterionRow({id:"criterion_"+(i+1),label,max})).join("")});
  form.addEventListener("submit",async e=>{
   e.preventDefault();const submit=form.querySelector('button[type="submit"]');submit.disabled=true;
   try{
    const criteria=[...form.querySelectorAll("[data-criterion-row]")].map((row,index)=>({id:row.dataset.criterionId||("criterion_"+(index+1)),label:row.querySelector("[data-criterion-label]").value.trim(),max:Number(row.querySelector("[data-criterion-max]").value)})).filter(x=>x.label&&Number.isFinite(x.max)&&x.max>0);
    if(!criteria.length){toast("أضف معيارًا واحدًا على الأقل للتحكيم",true);submit.disabled=false;return}
    const awards=[...form.querySelectorAll("[data-award-row]")].map(row=>({place:Number(row.querySelector("[data-award-place]").value),label:row.querySelector("[data-award-label]").value.trim(),achievement:Number(row.querySelector("[data-award-achievement]").value||0),store:Number(row.querySelector("[data-award-store]").value||0)})).filter(x=>Number.isInteger(x.place)&&x.place>0);
    const fd=new FormData(form);
    const payload={title:fd.get("title"),description:fd.get("description"),kind:fd.get("kind"),season:fd.get("season"),category_id:fd.get("category_id")||null,registration_starts_at:fd.get("registration_starts_at")||null,registration_ends_at:fd.get("registration_ends_at")||null,starts_at:fd.get("starts_at")||null,ends_at:fd.get("ends_at")||null,min_age:fd.get("min_age")===""?null:Number(fd.get("min_age")),max_age:fd.get("max_age")===""?null:Number(fd.get("max_age")),min_hizb:fd.get("min_hizb")===""?null:Number(fd.get("min_hizb")),max_hizb:fd.get("max_hizb")===""?null:Number(fd.get("max_hizb")),riwayat:String(fd.get("riwayat")||"").split(/[،,]/).map(x=>x.trim()).filter(Boolean),requires_approval:fd.get("requires_approval")==="on",max_participants:fd.get("max_participants")===""?null:Number(fd.get("max_participants")),rules:fd.get("rules"),participation_achievement:Number(fd.get("participation_achievement")||0),participation_store:Number(fd.get("participation_store")||0),judging_criteria:criteria,awards};
    if(role==="admin")payload.school_id=fd.get("school_id")||null;
    const id=form.dataset.competitionId;
    await api(id?"/competitions/"+encodeURIComponent(id):"/competitions",{method:id?"PATCH":"POST",body:JSON.stringify(payload)});
    toast(id?"تم حفظ التعديلات":"تم إنشاء المسابقة");S.competitionEditor=null;await competitionsPage(v);
   }catch(err){toast(err.message,true);submit.disabled=false}
  });
 }
}
async function tasksPage(v){
 const data=await api("/tasks"),tasks=data.tasks||[],counts=data.counts||{};
 const order=["pending","late","submitted","done"];
 const labels=data.status_labels||{pending:"مطلوب",submitted:"بانتظار التصحيح",done:"منجز",late:"متأخر"};
 const sections=order.map(status=>{
  const rows=tasks.filter(task=>task.status===status);
  if(!rows.length)return "";
  return '<section class="card"><h3>'+esc(labels[status]||status)+' ('+rows.length+')</h3><div class="list">'+rows.map(task=>{
   const target=task.type==="assignment"?"assignments":(task.type==="memorization"||task.type==="revision")?"quran":"attendance";
   const grade=task.grade!==null&&task.grade!==undefined?' · الدرجة: '+esc(task.grade)+(task.points_total?' / '+Number(task.points_total):""):"";
   const feedback=task.feedback?'<p class="muted small">ملاحظة المعلم: '+esc(task.feedback)+'</p>':"";
   return '<div class="list-row"><div><strong>'+esc(task.title)+'</strong><small>'+esc(task.type_label)+(task.due_date?' · آخر موعد: '+esc(task.due_date):"")+grade+'</small>'+(task.description?'<p class="muted small">'+esc(task.description)+'</p>':"")+feedback+'</div><div class="student-actions"><span class="pill">'+esc(task.status_label)+'</span><button class="btn secondary" type="button" data-task-go="'+esc(target)+'">فتح</button></div></div>';
  }).join("")+'</div></section>';
 }).join("");
 let html=head("مهامي","مهام موحّدة تجمع الواجبات وورد الحفظ والمراجعة والحضور في مكان واحد.");
 html+='<div class="stats"><div class="stat"><small>مطلوب</small><strong>'+Number(counts.pending||0)+'</strong></div><div class="stat"><small>متأخر</small><strong>'+Number(counts.late||0)+'</strong></div><div class="stat"><small>بانتظار التصحيح</small><strong>'+Number(counts.submitted||0)+'</strong></div><div class="stat"><small>منجز</small><strong>'+Number(counts.done||0)+'</strong></div></div>';
 html+=sections||'<section class="card"><div class="empty">لا توجد مهام مطلوبة الآن. أحسنت في متابعة وردك.</div></section>';
 v.innerHTML=html;
 document.querySelectorAll("[data-task-go]").forEach(btn=>btn.onclick=()=>go(btn.dataset.taskGo));
}
const WORLD_STAGES=[
 {min:0,name:"البذرة",title:"بداية الطريق",icon:"🌱",line:"كل بستان يبدأ ببذرة؛ خطوتك الأولى اليوم هي أصل ما تراه غدًا."},
 {min:80,name:"النبتة",title:"نبتة صاعدة",icon:"🌿",line:"بدأت خطواتك تؤتي أكلها؛ حافظ على الورد ولا تنتظر دفعة واحدة."},
 {min:250,name:"الشجرة",title:"شجرة مثمرة",icon:"🌳",line:"علمك صار شجرة تُظلّك وتُثمر؛ ثبّت الجذور بالمراجعة."},
 {min:600,name:"البستان",title:"بستان الإحسان",icon:"🌺",line:"تفتّحت فيك أبواب الخير؛ اجعل أثر العلم ظاهرًا في خُلقك."},
 {min:1200,name:"النور",title:"نور المعرفة",icon:"✨",line:"صرت علامة على الجدّ والثبات؛ فكن قدوة في الأدب قبل الدرجة."},
 {min:2400,name:"المحراب",title:"محبّ العلم",icon:"🕌",line:"بلغت مرتبة يحبها أهل العلم؛ فازدد تواضعًا وإتقانًا ورفقًا."}
];
function worldStage(points){
 const value=Number(points||0);let index=0;
 for(let i=0;i<WORLD_STAGES.length;i++)if(value>=WORLD_STAGES[i].min)index=i;
 const stage=WORLD_STAGES[index],next=WORLD_STAGES[index+1]||null;
 const progress=next?Math.max(0,Math.min(100,Math.round((value-stage.min)/Math.max(1,next.min-stage.min)*100))):100;
 return {index:index+1,count:WORLD_STAGES.length,min:stage.min,name:stage.name,title:stage.title,icon:stage.icon,line:stage.line,next,progress,remaining:next?Math.max(0,next.min-value):0,points:value};
}
function passSerial(value){
 let hash=2166136261;for(const ch of String(value||"ihsan")){hash^=ch.charCodeAt(0);hash=Math.imul(hash,16777619)}
 const code=(hash>>>0).toString(36).toUpperCase().padStart(7,"0");
 return "IHSN-"+code.slice(0,3)+"-"+code.slice(3,7);
}
function worldDate(value){const text=String(value||"");return text?esc(text.replace("T"," ").slice(0,16)):"—"}

// ---------------------------------------------------------------------------
// واجهة رحلة الطالب: سؤال واحد في كل مرة، حفظ تلقائي، توصية قابلة للاختيار،
// ثم بطاقة «الثمن: وقتك وانتباهك» وتطبيق الخطة عبر مسار القرآن القائم.
// ---------------------------------------------------------------------------
let journeyUi = null;
function journeyAnswerLabel(data, id) {
  const question = (data.questions || []).find(item => item.id === id);
  const value = data.answers ? data.answers[id] : "";
  return question?.options?.find(option => option.value === String(value))?.label || "";
}
function journeyFirstUnanswered(data) {
  const questions = data.questions || [];
  const index = questions.findIndex(question => !data.answers || data.answers[question.id] === undefined);
  return index < 0 ? 0 : index;
}
function journeyNextUnanswered(data, fromIndex) {
  const questions = data.questions || [];
  for (let i = fromIndex + 1; i < questions.length; i += 1) {
    if (!data.answers || data.answers[questions[i].id] === undefined) return i;
  }
  for (let i = 0; i < questions.length; i += 1) {
    if (!data.answers || data.answers[questions[i].id] === undefined) return i;
  }
  return -1;
}
function journeyStoreTeaser(store) {
  const reco = store?.recommendations;
  if (!reco) return "";
  if (reco.empty) {
    return '<div class="journey-store"><span class="eyebrow">المتجر</span><p>لا توجد مكافآت معتمدة بعد. لن نعرض لك منتجات وهمية؛ عندما تعتمد الإدارة مخزونًا حقيقيًا سيظهر هنا.</p></div>';
  }
  if (reco.nearest) {
    return '<div class="journey-store"><span class="eyebrow">مكافأتك القادمة</span><strong>' + esc(reco.nearest.name) + '</strong><div class="journey-store-meter" aria-hidden="true"><i style="width:' + Number(reco.nearest.progress || 0) + '%"></i></div><small>تفصلك ' + Number(reco.nearest.missing || 0) + ' من رصيد النقاط · رصيدك ' + Number(reco.balance || 0) + '</small></div>';
  }
  const top = (reco.affordable || [])[0];
  return '<div class="journey-store"><span class="eyebrow">متجرك</span><strong>' + (top ? esc(top.name) + ' متاحة الآن' : 'رصيدك جاهز') + '</strong><small>رصيد النقاط: ' + Number(reco.balance || 0) + '</small></div>';
}
function journeyIntroMarkup(data, store) {
  const answered = Number(data.answered || 0), total = Number(data.total || 8);
  const progress = total ? Math.round(answered / total * 100) : 0;
  const firstName = String(S.user?.name || "الطالب").trim().split(/\s+/)[0];
  const resume = answered > 0;
  const changes = data.approval_status === "changes_requested" && data.review_note
    ? '<div class="notice error"><strong>طلب الشيخ تعديلًا على خطتك:</strong> ' + esc(data.review_note) + '</div>' : "";
  const tiers = [
    ["خفيفة", "وجه واحد وتثبيت ثابت", "للبداية أو ضيق الوقت"],
    ["متوازنة", "صفحة مع تثبيت وورد", "الخيار الأكثر استدامة"],
    ["مكثفة", "صفحتان وورد أوسع", "لمن يملك وقتًا وانتظامًا"]
  ].map(([name, line, hint]) => '<div class="journey-tier"><strong>' + name + '</strong><span>' + line + '</span><small>' + hint + '</small></div>').join("");
  return changes +
    '<div class="journey-intro-grid"><div class="journey-intro-copy"><span class="eyebrow">رحلة البداية · ' + answered + ' من ' + total + '</span><h3>أهلًا ' + esc(firstName) + '، لنرسم خطتك</h3><p>ثمانية أسئلة قصيرة، سؤال واحد في كل مرة. نحفظ تقدمك إن غادرت، ونعرض عليك خطة بوقتك لا بمالك. لا أسئلة عن أسرارك، ولا حكم على شخصك.</p><div class="journey-meter" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + progress + '"><i style="width:' + progress + '%"></i></div><div class="journey-tier-strip">' + tiers + '</div><button class="btn" type="button" data-journey-start>' + (resume ? "أكمل من حيث توقفت" : "ابدأ رحلة الخطة") + '</button><small class="muted">تقدير الوقت تقريبي، وأرقام التثبيت المرجعية تنتظر اعتماد الشيخ.</small></div><aside class="journey-price-preview"><span class="eyebrow">الثمن</span><strong>وقتك وانتباهك</strong><p>لا رسوم مالية، ولا اشتراك مدفوع. الثمن وقت تمنحه، وانتباه تحفظه، واستمرار تعود عليه.</p><ul><li>خطة حفظ وتثبيت وورد تناسب وقتك.</li><li>يمكنك اختيار الأخف أو الأعدل أو الأكثر.</li><li>مراجعة الشيخ قبل تثبيت الأرقام المرجعية.</li></ul>' + journeyStoreTeaser(store) + '</aside></div>';
}
function journeyStepMarkup(data, index) {
  const question = (data.questions || [])[index];
  if (!question) return journeyIntroMarkup(data, journeyUi?.store);
  const total = Number(data.total || 8);
  const progress = Math.round(Number(data.answered || 0) / total * 100);
  const current = data.answers ? data.answers[question.id] : undefined;
  const options = (question.options || []).map(option => {
    const selected = current !== undefined && String(current) === String(option.value);
    return '<button type="button" class="journey-option' + (selected ? " is-selected" : "") + '" data-journey-answer="' + esc(option.value) + '"><strong>' + esc(option.label) + '</strong><small>' + esc(option.detail || "") + '</small></button>';
  }).join("");
  return '<div class="journey-step"><div class="journey-step-head"><span class="eyebrow">السؤال ' + (index + 1) + ' من ' + total + '</span><div class="journey-meter" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + progress + '"><i style="width:' + progress + '%"></i></div></div><h3>' + esc(question.title) + '</h3><p>' + esc(question.hint || "") + '</p><div class="journey-options">' + options + '</div><div class="journey-step-actions">' + (index > 0 ? '<button class="btn secondary" type="button" data-journey-back>السابق</button>' : "") + '<span class="muted small">يُحفظ تقدمك تلقائيًا بعد كل إجابة.</span></div></div>';
}
function journeyReviewMarkup(data, options = {}) {
  const reco = data.recommendation;
  if (!reco) return journeyIntroMarkup(data, journeyUi?.store);
  const variants = reco.variants || [];
  const selected = variants.find(item => item.id === options.variant) || reco.recommended || variants[1];
  if (!selected) return journeyIntroMarkup(data, journeyUi?.store);
  const ack = Boolean(options.ack);
  const restValue = options.rest !== undefined && options.rest !== null ? String(options.rest) : String(selected.rest_day ?? "none");
  const restQuestion = (data.questions || []).find(question => question.id === "rest_day");
  const restOptions = (restQuestion?.options || []).map(option => '<option value="' + esc(option.value) + '" ' + (String(option.value) === restValue ? "selected" : "") + '>' + esc(option.label) + '</option>').join("");
  const changes = data.approval_status === "changes_requested" && data.review_note
    ? '<div class="notice error"><strong>ملاحظة الشيخ:</strong> ' + esc(data.review_note) + '</div>' : "";
  const variantCards = variants.map(variant => {
    const isSelected = variant.id === selected.id;
    const fit = variant.fits ? '<span class="pill is-good">داخل وقتك</span>' : '<span class="pill is-warn">تتجاوز وقتك بـ ' + Number(variant.over_by || 0) + ' دقيقة</span>';
    return '<button type="button" class="journey-plan-card' + (isSelected ? " is-selected" : "") + '" data-journey-variant="' + esc(variant.id) + '"><span class="journey-plan-kicker">' + esc(variant.label) + '</span><strong>~' + Number(variant.estimated_daily_minutes) + ' دقيقة يوميًا</strong><small>' + esc(variant.description) + '</small><span class="journey-plan-parts">' + esc(variant.hifz_amount + " " + variant.hifz_unit) + ' · تثبيت ' + esc(variant.thabit_label) + ' · ورد ' + esc(variant.ward_label) + '</span>' + fit + '</button>';
  }).join("");
  const warning = !selected.fits
    ? '<div class="notice error"><strong>هذه الخطة تتجاوز الوقت الذي أعلنته بـ ' + Number(selected.over_by || 0) + ' دقيقة يوميًا.</strong><p>إن اخترتها، ستبقى خطة مقترحة تحتاج مراجعة الشيخ. الأفضل أن تبدأ بما تستطيع الوفاء به.</p><label class="check-line"><input type="checkbox" data-journey-ack ' + (ack ? "checked" : "") + '> أتفهم ذلك وأريد المتابعة بعد مراجعة الشيخ.</label></div>'
    : '<div class="notice">خطتك داخل الوقت الذي أعلنته. الباقي راحة أو مراجعة حرة، لا مهام إضافية.</div>';
  return changes +
    '<div class="journey-review"><div class="journey-review-head"><span class="eyebrow">خطتك المقترحة</span><h3>اختر ما يناسبك، ثم ابدأ</h3><p>الخطة ليست عقدًا دائمًا؛ يمكنك تعديلها لاحقًا مع الشيخ. الأرقام المرجعية للتثبيت مقترحة وتنتظر اعتماده.</p></div>' +
    '<div class="journey-plan-grid">' + variantCards + '</div>' +
    '<div class="journey-commitment"><div class="journey-commitment-main"><span class="eyebrow">الثمن</span><strong>~' + Number(selected.estimated_daily_minutes) + ' دقيقة يوميًا</strong><small>' + Number(selected.estimated_weekly_minutes) + ' دقيقة أسبوعيًا · ' + Number(reco.price?.days_per_week || 5) + ' أيام · راحة ' + esc((restQuestion?.options || []).find(option => String(option.value) === String(selected.rest_day ?? "none"))?.label || "بدون يوم محدد") + '</small></div><div class="journey-breakdown"><span>حفظ ~' + Number(selected.breakdown?.hifz || 0) + ' د</span><span>تثبيت ~' + Number(selected.breakdown?.thabit || 0) + ' د</span><span>ورد ~' + Number(selected.breakdown?.ward || 0) + ' د</span></div><div class="journey-commitment-line"><strong>لا رسوم مالية.</strong> الثمن وقتك وانتباهك، وما تكسبه من رصيد النقاط مكافأة تنظيمية لا ثمنًا للعبادة.</div></div>' +
    warning +
    '<div class="journey-form-row"><label class="field">يوم الاستدراك<select id="journey-rest">' + restOptions + '</select></label><label class="field">ملاحظة للشيخ (اختيارية)<textarea id="journey-note" maxlength="500" rows="2" placeholder="مثال: أحتاج مراجعة الخطة مع الشيخ قبل تثبيتها">' + esc(options.note || "") + '</textarea></label></div>' +
    '<div class="student-actions"><button class="btn" type="button" data-journey-apply ' + (!selected.fits && !ack ? "disabled" : "") + '>ابدأ بهذه الخطة</button><button class="btn secondary" type="button" data-journey-edit>تعديل الإجابات</button></div>' +
    '<p class="muted small">تطبيق الخطة يبدأ مهامك فورًا، ويُرسل طلب اعتماد إلى الشيخ. لا يتوقف تعلمك بانتظار الاعتماد، ولا تُغيّر خطتك جذريًا دون إشعارك.</p></div>';
}
function journeyStatusMarkup(data) {
  const plan = data.applied_plan || {};
  const pending = data.approval_status !== "approved";
  const changes = data.approval_status === "changes_requested";
  const note = changes && data.review_note ? '<div class="notice error"><strong>طلب الشيخ تعديلًا:</strong> ' + esc(data.review_note) + '</div>' : "";
  return note + '<div class="journey-status"><span class="eyebrow">خطتك سارية · ' + (pending ? "بانتظار اعتماد الشيخ" : "معتمدة") + '</span><h3>' + esc(plan.plan_label || "خطتك القرآنية") + ' · فئة ' + esc(plan.hifz_category_label || "") + '</h3><p>يمكنك البدء الآن. اعتماد الشيخ يثبت الخطة، وطلبه للتعديل لا يوقف تعلمك.</p><div class="journey-status-grid"><div><small>الحفظ اليومي</small><strong>' + esc(plan.hifz_amount || "—") + ' ' + esc(plan.hifz_unit || "") + '</strong></div><div><small>التثبيت</small><strong>' + esc(plan.thabit_label || "—") + '</strong></div><div><small>الورد</small><strong>' + esc(plan.ward_label || "—") + '</strong></div><div><small>الثمن اليومي</small><strong>~' + Number(plan.estimated_daily_minutes || 0) + ' د</strong></div></div><div class="student-actions"><button class="btn" type="button" data-journey-quran>ابدأ مهمة اليوم</button>' + (changes ? '<button class="btn secondary" type="button" data-journey-edit>راجع خطتك</button>' : "") + '</div></div>';
}
function journeyStageMarkup(data, store) {
  if (!data) return "";
  if (data.status === "applied" && data.approval_status === "approved") return "";
  if (data.status === "applied") return journeyStatusMarkup(data);
  if (data.complete && data.recommendation) return journeyReviewMarkup(data, { variant: data.recommendation.recommended_variant });
  return journeyIntroMarkup(data, store);
}
function journeyWorldMarkup(data, store) {
  if (!data) return "";
  const stage = journeyStageMarkup(data, store);
  if (!stage) return "";
  return '<section class="journey-shell" id="journey-shell" aria-labelledby="journey-shell-title"><div id="journey-stage">' + stage + '</div></section>';
}
function wireJourneyWorld(v, data, store) {
  const stage = v.querySelector("#journey-stage");
  if (!stage || !data) return;
  journeyUi = { data, store, stage, index: journeyFirstUnanswered(data), variant: data.recommendation?.recommended_variant || "balanced", ack: false, rest: undefined, note: "" };
  const ui = journeyUi;
  function bind() {
    stage.querySelectorAll("[data-journey-start]").forEach(button => button.onclick = () => { ui.index = journeyFirstUnanswered(ui.data); showStep(); });
    stage.querySelectorAll("[data-journey-edit]").forEach(button => button.onclick = () => { ui.index = 0; showStep(); });
    stage.querySelectorAll("[data-journey-quran]").forEach(button => button.onclick = () => go("quran"));
    stage.querySelectorAll("[data-journey-variant]").forEach(button => button.onclick = () => {
      readForm();
      ui.variant = button.dataset.journeyVariant;
      ui.ack = false;
      showReview();
    });
    stage.querySelector("[data-journey-ack]")?.addEventListener("change", event => { readForm(); ui.ack = event.target.checked; showReview(); });
    stage.querySelector("[data-journey-apply]")?.addEventListener("click", apply);
  }
  function readForm() {
    const rest = stage.querySelector("#journey-rest"), note = stage.querySelector("#journey-note"), ack = stage.querySelector("[data-journey-ack]");
    if (rest) ui.rest = rest.value;
    if (note) ui.note = note.value;
    if (ack) ui.ack = ack.checked;
  }
  function showStep() {
    stage.innerHTML = journeyStepMarkup(ui.data, ui.index);
    stage.querySelectorAll("[data-journey-answer]").forEach(button => button.onclick = async () => {
      const question = (ui.data.questions || [])[ui.index];
      if (!question) return;
      button.disabled = true;
      try {
        const updated = await api("/journey", { method: "POST", body: JSON.stringify({ key: question.id, value: button.dataset.journeyAnswer }) });
        ui.data = updated;
        if (updated.complete) {
          ui.variant = updated.recommendation?.recommended_variant || ui.variant;
          showReview();
          return;
        }
        const next = journeyNextUnanswered(updated, ui.index);
        ui.index = next < 0 ? 0 : next;
        showStep();
      } catch (error) { button.disabled = false; toast(error.message, true); }
    });
    stage.querySelector("[data-journey-back]")?.addEventListener("click", () => { ui.index = Math.max(0, ui.index - 1); showStep(); });
  }
  function showReview() {
    stage.innerHTML = journeyReviewMarkup(ui.data, { variant: ui.variant, ack: ui.ack, rest: ui.rest, note: ui.note });
    bind();
  }
  async function apply() {
    readForm();
    const selected = (ui.data.recommendation?.variants || []).find(item => item.id === ui.variant);
    if (!selected) return toast("اختر خطة أولًا", true);
    if (!selected.fits && !ui.ack) return toast("أكّد أنك تفهم أن الخطة تتجاوز وقتك المعلن", true);
    const button = stage.querySelector("[data-journey-apply]");
    if (button) button.disabled = true;
    try {
      const rest = ui.rest === undefined || ui.rest === null || ui.rest === "" ? selected.rest_day : (ui.rest === "none" ? null : Number(ui.rest));
      await api("/journey/apply", { method: "POST", body: JSON.stringify({ variant: ui.variant, rest_day: rest, note: ui.note || "", acknowledge_over_budget: ui.ack }) });
      toast("بدأت خطتك. أول مهمة تنتظرك في مسار القرآن.");
      if (typeof refreshWallet === "function") refreshWallet();
      await worldPage(v);
    } catch (error) { if (button) button.disabled = false; toast(error.message, true); }
  }
  bind();
}

async function worldPage(v){
 if(S.user.role!=="student"){v.innerHTML=head("عالمي","هذه الصفحة مخصّصة لحساب الطالب.")+'<div class="notice">عد إلى الرئيسية لمتابعة مهامك.</div>';return}
 v.innerHTML='<div class="loading">جار تجهيز عالمك…</div>';
 const result=await Promise.allSettled([api("/points/summary"),api("/gamification"),api("/tasks"),api("/leaderboard"),api("/points/reading"),api("/journey"),api("/store/items"),api("/missions")]);
 if(result[0].status!=="fulfilled"){
  v.innerHTML=head("عالمي","تعذّر تحميل بياناتك الآن.")+'<div class="notice error">'+esc(result[0].reason?.message||"تعذّر التحميل")+'</div><button class="btn" id="world-retry">إعادة المحاولة</button>';
  $("#world-retry")?.addEventListener("click",()=>worldPage(v));return;
 }
 const summary=result[0].value;
 const gam=result[1].status==="fulfilled"?result[1].value:null;
 const tasks=result[2].status==="fulfilled"?result[2].value:{tasks:[],counts:{}};
 const board=result[3].status==="fulfilled"?result[3].value:[];
 const reading=result[4].status==="fulfilled"?result[4].value:null;
 const journey=result[5].status==="fulfilled"?result[5].value:null;
 const storeData=result[6].status==="fulfilled"?result[6].value:null;
 const missions=result[7].status==="fulfilled"?result[7].value:null;
 const achievement=Number(summary.totals?.achievement||0),store=Number(summary.totals?.store||0);
 const stage=worldStage(achievement);
 const me=board.find(x=>x.is_self);
 const counts=tasks.counts||{};
 const streak=Number(reading?.streak||0);
 const firstName=String(summary.student?.name||S.user.name||"الطالب").trim().split(/\s+/)[0];
 const quest=(title,value,icon,target)=>"<button type=\"button\" class=\"world-quest\" data-world-go=\""+esc(target)+"\"><span class=\"world-quest-icon\" aria-hidden=\"true\">"+icon+"</span><span><strong>"+esc(title)+"</strong><small>"+esc(String(value))+"</small></span><span class=\"world-quest-arrow\" aria-hidden=\"true\">‹</span></button>";
 const garden=WORLD_STAGES.map((item,i)=>{
  const unlocked=achievement>=item.min,current=stage.index===i+1;
  return '<article class="world-plot '+(unlocked?"is-grown":"")+(current?" is-current":"")+'"><span class="world-plot-icon" aria-hidden="true">'+(unlocked?item.icon:"🔒")+'</span><strong>'+esc(item.name)+'</strong><small>'+Number(item.min)+' نقطة</small></article>';
 }).join("");
 const recentEntries=(reading?.entries||[]).slice(0,3).map(entry=>'<div class="list-row"><div><strong>'+esc(entry.surah||"ورد")+(entry.portion?' · '+esc(entry.portion):"")+'</strong><small>'+esc(entry.day||"")+(entry.reflection?' · '+esc(entry.reflection):"")+'</small></div><span class="pill">+ورد</span></div>').join("");
 const readingBlock=reading?.logged_today
  ? '<div class="notice world-reading-done"><strong>سجّلت ورد اليوم.</strong> سلسلتك الآن '+Number(streak)+' يومًا. عُد غدًا لتبني عليها.</div>'
  : '<form id="world-reading-form" class="world-reading-form"><label class="field">السورة أو الجزء<input name="surah" required maxlength="80" placeholder="مثال: سورة الملك"></label><label class="field">المقدار<input name="portion" maxlength="120" placeholder="مثال: صفحتان بتدبّر"></label><label class="field">خاطرة أو تدبّر<textarea name="reflection" maxlength="600" rows="2" placeholder="فائدة واحدة فهمتها اليوم…"></textarea></label><div class="student-actions"><button class="btn" type="submit">تسجيل ورد القراءة</button><span class="muted small">تُمنح مرة واحدة كل يوم.</span></div></form>';
 const challengeBlock=gam&&!gam.challenge_claimed
  ? '<div class="world-challenge-box"><div><span class="eyebrow">تحدي اليوم</span><strong>'+esc(gam.daily_challenge?.title||"ورد اليوم")+'</strong><p>'+esc(gam.daily_challenge?.description||"اقرأ وردك وراجعه بإتقان.")+'</p></div><button class="btn" type="button" id="world-claim">استلام المكافأة</button></div>'
  : '<div class="notice">'+(gam?.challenge_claimed?"استلمت مكافأة تحدي اليوم. أحسنت!":"تحدي اليوم يظهر عندما يجهز حسابك في فوج.")+'</div>';
 const missionStory=(missions?.story||[]).map(m=>'<article class="mission-story '+(m.done?"is-done":"")+'"><span class="mission-icon" aria-hidden="true">'+esc(m.icon)+'</span><div class="mission-body"><strong>'+esc(m.title)+'</strong><small>'+esc(m.text)+'</small><div class="mission-meter"><i style="width:'+Number(m.progress||0)+'%"></i></div></div><span class="pill">'+Number(m.value)+' / '+Number(m.target)+'</span></article>').join("");
 const missionSide=(missions?.side||[]).map(m=>'<button type="button" class="mission-side '+(m.claimed?"is-claimed":m.done?"is-ready":"")+'" data-mission-claim="'+esc(m.id)+'" '+(m.claimable?"":"disabled")+'><span class="mission-icon" aria-hidden="true">'+esc(m.icon)+'</span><span class="mission-body"><strong>'+esc(m.title)+'</strong><small>'+esc(m.text)+'</small></span><span class="pill">'+(m.claimed?"مستلمة":m.done?"استلم":"لم تكتمل")+'</span></button>').join("");
 const collectibles=(missions?.collectibles||[]).map(c=>'<span class="mission-collectible '+(c.unlocked?"is-unlocked":"")+'" title="'+esc(c.title)+'" aria-label="'+esc(c.title)+'">'+esc(c.icon)+'</span>').join("");
 const missionsBlock=missions?'<section class="card world-missions"><div class="section-head"><div><span class="eyebrow">عالم المهام</span><h3>قصص ومهام يومية</h3><p>القصص تُفتح بأعمال سجّلتها فعليًا، والمهام اليومية تُستلم مرة واحدة عبر محرك النقاط نفسه.</p></div><div class="mission-collectibles">'+collectibles+'</div></div><div class="mission-story-grid">'+missionStory+'</div><div class="mission-side-grid">'+missionSide+'</div></section>':"";
 v.innerHTML='<div class="world-page">'+
  '<section class="world-hero"><div class="world-avatar" style="--world-progress:'+stage.progress+'%"><span class="world-avatar-halo" aria-hidden="true"></span><span class="world-avatar-icon" aria-hidden="true">'+stage.icon+'</span><span class="world-avatar-level">المستوى '+stage.index+'</span></div><div class="world-hero-copy"><span class="eyebrow">عالمك في الإحسان · '+esc(stage.title)+'</span><h2>بستان '+esc(firstName)+'</h2><p>'+esc(stage.line)+'</p><div class="world-progress"><div class="world-progress-head"><span>'+esc(stage.name)+'</span><span>'+(stage.next?Number(stage.remaining)+' نقطة إلى '+esc(stage.next.name):"أعلى مرتبة في العالم")+'</span></div><div class="world-meter"><i style="width:'+stage.progress+'%"></i></div></div><div class="world-chips"><span class="world-chip"><b>★</b> '+Number(achievement)+' إنجاز</span><span class="world-chip"><b>◈</b> '+Number(store)+' رصيد متجر</span><span class="world-chip"><b>🔥</b> '+streak+' يوم قراءة</span><span class="world-chip"><b>#</b> '+(me?Number(me.rank):"—")+' في الفوج</span></div></div></section>'+
  journeyWorldMarkup(journey,storeData)+'<div class="world-grid"><section class="card world-garden"><div class="section-head"><div><span class="eyebrow">بستانك</span><h3>مراتب تنمو بأعمالك</h3><p>كل مرتبة تفتح بخطوات حقيقية: حضور، حفظ، مراجعة، واجبات، اختبارات، وقراءة.</p></div><span class="pill">'+stage.index+' / '+stage.count+'</span></div><div class="world-plots">'+garden+'</div></section>'+
  '<section class="card world-quests"><div class="section-head"><div><span class="eyebrow">مهام اليوم</span><h3>خطوات صغيرة تبني عالمك</h3><p>ابدأ بأقرب خطوة؛ لا تنتظر يومًا كاملًا لتتحرك.</p></div></div><div class="world-quest-grid">'+quest("ورد القرآن",Number(gam?.stats?.quran_days||0)+" يوم","۞","quran")+quest("الحضور",Number(gam?.stats?.attendance||0)+" مرات","✓","attendance")+quest("المهام المنجزة",Number(counts.done||0)+" مهام","▤","tasks")+quest("الترتيب في الفوج",me?"#"+Number(me.rank):"—","#","leaderboard")+'</div>'+challengeBlock+'</section></div>'+
  missionsBlock+'<section class="card world-reading"><div class="section-head"><div><span class="eyebrow">ورد القراءة</span><h3>سجّل قراءتك اليوم</h3><p>القراءة اليومية تبني سلسلة وتمنحك نقاط إنجاز ورصيد متجر مرة واحدة كل يوم.</p></div><span class="world-streak">🔥 '+streak+'</span></div>'+readingBlock+(recentEntries?'<div class="list world-reading-list">'+recentEntries+'</div>':"")+'</section>'+
  '<section class="card world-journey"><div class="section-head"><div><span class="eyebrow">الطريق</span><h3>من البذرة إلى المحراب</h3><p>هذه ليست لعبة منفصلة عن الأكاديمية؛ كل مرتبة هنا مبنية على عمل سجّلته فعليًا.</p></div><button class="btn secondary" type="button" data-world-go="guide">دليل الرحلة</button></div><div class="world-journey-track">'+WORLD_STAGES.map((item,i)=>'<div class="world-journey-stop '+(achievement>=item.min?"is-done":"")+(stage.index===i+1?" is-current":"")+'"><span>'+item.icon+'</span><strong>'+esc(item.name)+'</strong><small>'+Number(item.min)+'</small></div>').join("")+'</div></section>'+
  '</div>';
 v.querySelectorAll("[data-world-go]").forEach(btn=>btn.onclick=()=>go(btn.dataset.worldGo));
 wireJourneyWorld(v,journey,storeData);
 $("#world-claim")?.addEventListener("click",async event=>{
  const button=event.currentTarget;button.disabled=true;
  try{await api("/gamification/claim",{method:"POST",body:JSON.stringify({challenge_id:gam?.daily_challenge?.id||"daily-quran"})});toast("تم تسجيل إنجازك ومكافأتك اليومية");await worldPage(v);refreshWallet()}
  catch(error){button.disabled=false;toast(error.message,true)}
 });
 v.querySelectorAll("[data-mission-claim]").forEach(btn=>btn.onclick=async()=>{
  const missionId=btn.dataset.missionClaim;btn.disabled=true;
  try{await api("/missions/claim",{method:"POST",body:JSON.stringify({mission_id:missionId})});toast("تم استلام مكافأة المهمة");await worldPage(v);refreshWallet()}
  catch(error){btn.disabled=false;toast(error.message,true)}
 });
 $("#world-reading-form")?.addEventListener("submit",async event=>{
  event.preventDefault();const form=event.currentTarget,button=form.querySelector('button[type="submit"]'),data=new FormData(form);
  button.disabled=true;
  try{await api("/points/reading",{method:"POST",body:JSON.stringify({surah:data.get("surah"),portion:data.get("portion"),reflection:data.get("reflection")})});toast("حُفظ وردك ومنحتك الأكاديمية نقاطه");await worldPage(v);refreshWallet()}
  catch(error){button.disabled=false;toast(error.message,true)}
 });
}

const CARD_QR_META={
 add_points:{title:"إضافة نقاط",desc:"يمسحه الشيخ أو المشرف بعد التحقق من صلاحيته، ثم يمنح النقاط يدويًا."},
 profile:{title:"الملف الشخصي",desc:"يفتح ملف الطالب لصاحب الصلاحية بعد تسجيل الدخول."},
 login:{title:"الدخول السريع",desc:"يملأ اسم المستخدم فقط؛ كلمة المرور تبقى مطلوبة دائمًا."}
};
function qrSvg(link,size){try{return window.IhsanQR?window.IhsanQR.svg(link,{size:size||168,margin:2,dark:"#0b1f17",light:"#ffffff"}):""}catch{return ""}}
function cardQrBadge(kind,links){
 const link=links?.[kind],meta=CARD_QR_META[kind]||{title:kind},svg=link?qrSvg(link,132):"";
 return '<figure class="id-card-qr '+(link?"":"is-missing")+'"><div class="id-card-qr-code">'+(svg||'<span class="card-qr-missing" aria-hidden="true">?</span>')+'</div><figcaption>'+esc(meta.title)+'</figcaption></figure>';
}
function cardQrFigure(kind,links){
 const link=links?.[kind],meta=CARD_QR_META[kind]||{title:kind,desc:""},svg=link?qrSvg(link,168):"";
 return '<figure class="card-qr '+(link?"":"is-missing")+'"><div class="card-qr-code">'+(svg||'<span class="card-qr-missing" aria-hidden="true">—</span>')+'</div><figcaption><strong>'+esc(meta.title)+'</strong><small>'+esc(link?meta.desc:"الرمز غير مفعّل؛ أعد إصدار البطاقة.")+'</small></figcaption></figure>';
}
function cardQrSheet(links,actions){
 return '<section class="card card-qr-sheet"><div class="section-head"><div><span class="eyebrow">رموز البطاقة</span><h3>ثلاثة رموز مستقلة</h3><p>لكل رمز صلاحية منفصلة؛ لا تشاركه مع غير أهله، ويمكن إلغاؤه أو إعادة إصداره في أي وقت.</p></div>'+(actions?'<div class="card-qr-actions">'+actions+'</div>':"")+'</div><div class="card-qr-grid">'+["add_points","profile","login"].map(kind=>cardQrFigure(kind,links)).join("")+'</div><p class="muted small">رمز الدخول السريع لا يسجّل الدخول تلقائيًا؛ يعرض الاسم ويملأ اسم المستخدم فقط. رموز إضافة النقاط والملف تتطلب جلسة وصلاحية على الفوج.</p></section>';
}
const SCAN_KEY="ihsan_pending_scan";
function readScanHash(){
 const raw=String(location.hash||"").replace(/^#/,"");
 if(!raw.startsWith("scan="))return null;
 let value="";try{value=decodeURIComponent(raw.slice(5))}catch{value=raw.slice(5)}
 const parts=value.split(".");
 if(parts.length<3)return null;
 const kind=parts[0],cardId=parts[1],secret=parts.slice(2).join(".");
 if(!["add_points","profile","login"].includes(kind)||!cardId||!secret)return null;
 return {kind,cardId,secret};
}
function pendingScan(){try{const raw=safeStore.getSession(SCAN_KEY);return raw?JSON.parse(raw):null}catch{return null}}
function savePendingScan(scan){try{safeStore.setSession(SCAN_KEY,JSON.stringify(scan))}catch{}}
function clearPendingScan(){try{safeStore.removeSession(SCAN_KEY)}catch{}}
async function processPendingScan(){
 const scan=pendingScan();
 if(!scan||!S.user)return;
 clearPendingScan();
 try{
  const result=await api("/cards/resolve",{method:"POST",body:JSON.stringify({kind:scan.kind,card_id:scan.cardId,secret:scan.secret})});
  if(scan.kind==="login"){toast("بطاقة "+String(result.student?.name||"الطالب")+" — سجّل الدخول بكلمة المرور.");return}
  if(scan.kind==="profile"){
   if(S.user.role==="student"){go("profile");return}
   S.mode="school";S.tab="students";safeStore.setSession("ihsan_last_mode","school");safeStore.setSession("ihsan_last_tab","students");shell();
   await studentProfile($("#view"),result.student.id);
   toast("ملف "+String(result.student?.name||"الطالب"));
   return;
  }
  if(scan.kind==="add_points"){
   S.scanStudentId=result.student.id;S.scanTaskType="points";S.scanDate=localDateISO();S.scanActivity="";
   go("scan");
   toast("تم التعرف إلى "+String(result.student?.name||"الطالب")+"؛ اختر نشاط النقاط ثم اعتمد الإنجاز.");
  }
 }catch(error){toast(error.message,true)}
}
window.addEventListener("hashchange",()=>{const scan=readScanHash();if(!scan)return;savePendingScan(scan);if(S.user)processPendingScan()});

async function cardPage(v){
 if(S.user.role!=="student"){v.innerHTML=head("بطاقتي","هذه الصفحة مخصّصة لحساب الطالب.");return}
 v.innerHTML='<div class="loading">جار تجهيز بطاقتك…</div>';
 const result=await Promise.allSettled([api("/points/summary"),api("/gamification"),api("/leaderboard"),api("/points/reading"),api("/student-cards")]);
 if(result[0].status!=="fulfilled"){
  v.innerHTML=head("بطاقتي","تعذّر تحميل بطاقتك الآن.")+'<div class="notice error">'+esc(result[0].reason?.message||"تعذّر التحميل")+'</div><button class="btn" id="card-retry">إعادة المحاولة</button>';
  $("#card-retry")?.addEventListener("click",()=>cardPage(v));return;
 }
 const summary=result[0].value,gam=result[1].status==="fulfilled"?result[1].value:null,board=result[2].status==="fulfilled"?result[2].value:[],reading=result[3].status==="fulfilled"?result[3].value:null;
 let cardData=result[4].status==="fulfilled"?result[4].value:null;
 if(!cardData||!cardData.card){
  try{cardData=await api("/student-cards",{method:"POST",body:JSON.stringify({student_id:S.user.student_id})})}catch(error){cardData=cardData||null;toast(error.message,true)}
 }
 const links=cardData?.links||{};
 const student=summary.student||{},achievement=Number(summary.totals?.achievement||0),store=Number(summary.totals?.store||0),stage=worldStage(achievement),me=board.find(x=>x.is_self);
 const serial=passSerial(student.id||S.user.student_id||S.user.id),year=new Date().getFullYear();
 const recent=(summary.recent||[]).slice(0,6).map(event=>'<div class="list-row"><div><strong>'+esc(event.reason||event.event_type)+'</strong><small>'+esc(event.kind_label||"")+' · '+worldDate(event.created_at)+'</small></div><span class="pill">'+(Number(event.points)>0?"+":"")+Number(event.points)+'</span></div>').join("");
 const badges=(gam?.badges||[]).map(badge=>'<span class="pass-badge"><span aria-hidden="true">'+esc(badge.icon||"★")+'</span>'+esc(badge.name)+'</span>').join("");
 v.innerHTML='<div class="card-page">'+
  '<div class="card-page-head"><div><span class="eyebrow">هويتك في الأكاديمية</span><h2>بطاقة الطالب</h2><p>بطاقة شخصية تجمع مستواك ورصيدك وترتيبك ورمزك الفريد في مكان واحد؛ اعرضها أو اطبعها.</p></div><div class="student-actions"><button class="btn secondary" type="button" id="card-qr-reissue">إعادة إصدار الرموز</button><button class="btn secondary" type="button" id="pass-print">طباعة البطاقة</button></div></div>'+
  '<section class="printable"><section class="student-pass-wrap"><article class="student-pass" aria-label="بطاقة الطالب"><span class="pass-shine" aria-hidden="true"></span><div class="pass-pattern" aria-hidden="true"></div><div class="pass-head"><span class="pass-brand"><span class="pass-brand-mark" aria-hidden="true">إ</span>أكاديمية الإحسان</span><span class="pass-type">بطاقة طالب</span></div><div class="pass-middle"><span class="pass-chip" aria-hidden="true"><i></i><i></i><i></i></span><span class="pass-level">'+esc(stage.name)+' · المستوى '+stage.index+'</span><span class="pass-qr" aria-label="رمز الطالب">'+(links.add_points?qrSvg(links.add_points,144):'<span class="card-qr-missing">—</span>')+'</span></div><div class="pass-name">'+esc(student.name||S.user.name||"الطالب")+'</div><div class="pass-serial" dir="ltr">'+esc(serial)+'</div><div class="pass-grid"><div><small>نقاط الإنجاز</small><strong>'+Number(achievement)+'</strong></div><div><small>رصيد المتجر</small><strong>'+Number(store)+'</strong></div><div><small>ترتيب الفوج</small><strong>'+(me?"#"+Number(me.rank):"—")+'</strong></div><div><small>سلسلة القراءة</small><strong>'+Number(reading?.streak||0)+'</strong></div></div><div class="pass-foot"><span>الفوج: '+esc(student.group_name||"—")+'</span><span>صالحة حتى '+year+'-09</span></div></article></section>'+
  '<div class="pass-stats"><div class="stat"><small>أيام القرآن</small><strong>'+Number(gam?.stats?.quran_days||0)+'</strong></div><div class="stat"><small>مرات الحضور</small><strong>'+Number(gam?.stats?.attendance||0)+'</strong></div><div class="stat"><small>الاختبارات</small><strong>'+Number(gam?.stats?.tests||0)+'</strong></div><div class="stat"><small>أيام القراءة</small><strong>'+Number(reading?.total_days||0)+'</strong></div></div>'+
  '<div class="card-page-grid"><section class="card"><div class="section-head"><div><h3>أوسمتك</h3><p>تُفتح تلقائيًا عند تحقق شرطها.</p></div></div><div class="pass-badges">'+(badges||'<p class="muted">لم تُفتح وسام بعد؛ ابدأ بورد اليوم.</p>')+'</div></section><section class="card"><div class="section-head"><div><h3>آخر حركات الرصيد</h3><p>كل حركة مسجّلة ولا تُحذف.</p></div><button class="btn secondary" type="button" data-card-go="points">كل الحركات</button></div><div class="list">'+(recent||'<p class="muted">لا توجد حركات نقاط بعد.</p>')+'</div></section></div>'+
  '</div>';
 $("#pass-print")?.addEventListener("click",()=>{document.body.dataset.print="card";window.print()});
 window.addEventListener("afterprint",()=>{delete document.body.dataset.print},{once:true});
 $("#card-qr-reissue")?.addEventListener("click",async event=>{
  const button=event.currentTarget;button.disabled=true;
  try{const updated=await api("/student-cards/"+encodeURIComponent(cardData?.card?.id||S.user.student_id)+"/reissue",{method:"POST",body:JSON.stringify({})});toast("أُصدرت رموز جديدة، والرموز السابقة لم تعد صالحة");if(updated?.links)cardData={...cardData,links:updated.links,card:updated.card};await cardPage(v)}
  catch(error){button.disabled=false;toast(error.message,true)}
 });
 v.querySelectorAll("[data-card-go]").forEach(btn=>btn.onclick=()=>go(btn.dataset.cardGo));
}

function staffStudentPassMarkup(row){
 const student=row.student||{},link=row.links?.add_points||"",serial=passSerial(student.id);
 const qr=link?qrSvg(link,180):"";
 return '<article class="student-pass student-pass-print" data-card-student="'+esc(student.id)+'" aria-label="بطاقة '+esc(student.name)+'"><span class="pass-shine" aria-hidden="true"></span><div class="pass-pattern" aria-hidden="true"></div><div class="pass-head"><span class="pass-brand"><span class="pass-brand-mark" aria-hidden="true">إ</span>أكاديمية الإحسان</span><span class="pass-type">بطاقة طالب</span></div><div class="pass-middle"><span class="pass-chip" aria-hidden="true"><i></i><i></i><i></i></span><span class="pass-level">هوية الطالب</span><span class="pass-qr" aria-label="رمز الطالب">'+(qr||'<span class="card-qr-missing">—</span>')+'</span></div><div class="pass-name">'+esc(student.name||"الطالب")+'</div><div class="pass-serial" dir="ltr">'+esc(serial)+'</div><div class="pass-foot"><span>الفوج: '+esc(student.group_name||"—")+'</span><span>أكاديمية الإحسان</span></div></article>';
}
async function staffCardsPage(v){
 if(!["admin","teacher","director","supervisor"].includes(S.user.role)){v.innerHTML=head("بطاقات الطلاب","هذه الصفحة للشيخ أو المشرف.");return}
 if(!S.groups.length)await load();
 const groups=assignedGroups();
 if(!groups.length){v.innerHTML=head("بطاقات الطلاب","لا يوجد فوج ضمن صلاحيتك.");return}
 if(!S.cardsGroupId||!groups.some(g=>g.id===S.cardsGroupId))S.cardsGroupId=groups[0].id;
 const allValue="__all_managed_groups__";
 v.innerHTML=head("بطاقات الطلاب","معاينة البطاقة كاملة قبل الطباعة. رمز إضافة النقاط داخل التصميم، ولا تُعرض أرصدة الطلاب في بطاقات الإدارة.")+
  '<div class="card cards-toolbar"><label class="field">نطاق البطاقات<select id="cards-group"><option value="'+allValue+'">جميع الطلاب ضمن صلاحيتي</option>'+groups.map(g=>'<option value="'+esc(g.id)+'"'+(g.id===S.cardsGroupId?" selected":"")+'>'+esc(g.name)+'</option>').join("")+'</select></label><div class="student-actions"><button class="btn secondary" type="button" id="cards-print">طباعة النطاق المحدد</button><span class="muted small" id="cards-count"></span></div><p class="muted small">كل بطاقة تضم رمز QR الخاص بالطالب داخل تصميم البطاقة نفسه. الطباعة الفردية متاحة من بطاقة كل طالب.</p></div>'+
  '<div id="cards-sheet" class="cards-sheet"><div class="loading">جار تجهيز معاينة البطاقات…</div></div>';
 const loadCards=async()=>{
  const host=$("#cards-sheet");if(!host)return;host.innerHTML='<div class="loading">جار تجهيز معاينة البطاقات…</div>';
  try{
   const selected=$("#cards-group")?.value||S.cardsGroupId;
   const selectedGroups=selected===allValue?groups:groups.filter(g=>g.id===selected);
   if(!selectedGroups.length)throw new Error("لا يوجد فوج ضمن صلاحيتك");
   const datasets=[];
   for(const group of selectedGroups){
    let offset=0;
    while(true){
     const data=await api("/student-cards/bulk",{method:"POST",body:JSON.stringify({group_id:group.id,offset,limit:200})});
     datasets.push(...(data.cards||[]));
     if(!data.has_more)break;
     const next=Number(data.next_offset);
     if(!Number.isInteger(next)||next<=offset)throw new Error("تعذر إكمال تحميل بطاقات الفوج بأمان");
     offset=next;
    }
   }
   const count=$("#cards-count");if(count)count.textContent=datasets.length+" بطاقة · "+selectedGroups.length+" فوج";
   const pages=[];
   for(let offset=0;offset<datasets.length;offset+=8){
    const items=datasets.slice(offset,offset+8).map(row=>
     '<section class="student-card-print-item" data-card-item="'+esc(row.student.id)+'">'+staffStudentPassMarkup(row)+'<div class="student-card-print-actions"><button class="btn secondary" type="button" data-card-print-one="'+esc(row.student.id)+'">طباعة هذه البطاقة</button><button class="btn secondary" type="button" data-card-reissue="'+esc(row.student.id)+'">إعادة إصدار الرموز</button><button class="btn danger" type="button" data-card-revoke="'+esc(row.student.id)+'">إلغاء الرموز</button></div></section>'
    );
    pages.push('<section class="cards-print-page"><div class="cards-sheet-grid">'+items.join("")+'</div></section>');
   }
   host.innerHTML=pages.join("")||'<div class="notice">لا توجد بطاقات في النطاق المحدد.</div>';
   host.querySelectorAll("[data-card-print-one]").forEach(btn=>btn.onclick=()=>{
    document.body.dataset.print="card-one";document.body.dataset.printStudent=btn.dataset.cardPrintOne;host.querySelectorAll(".student-card-print-item").forEach(item=>item.classList.toggle("is-print-target",item.dataset.cardItem===btn.dataset.cardPrintOne));window.print();
   });
   host.querySelectorAll("[data-card-reissue]").forEach(btn=>btn.onclick=async()=>{
    btn.disabled=true;
    try{await api("/student-cards/"+encodeURIComponent(btn.dataset.cardReissue)+"/reissue",{method:"POST",body:JSON.stringify({})});toast("أُصدرت رموز جديدة، والرموز السابقة لم تعد صالحة");await loadCards()}
    catch(error){btn.disabled=false;toast(error.message,true)}
   });
   host.querySelectorAll("[data-card-revoke]").forEach(btn=>btn.onclick=async()=>{
    const reason=String(window.prompt("سبب إلغاء رموز البطاقة (3 أحرف على الأقل):")||"").trim();
    if(reason.length<3){toast("اكتب سبب الإلغاء",true);return}
    btn.disabled=true;
    try{await api("/student-cards/"+encodeURIComponent(btn.dataset.cardRevoke)+"/revoke",{method:"POST",body:JSON.stringify({reason})});toast("أُلغيت رموز البطاقة");await loadCards()}
    catch(error){btn.disabled=false;toast(error.message,true)}
   });
  }catch(error){host.innerHTML='<div class="notice error">'+esc(error.message)+'</div>'}
 };
 $("#cards-group")?.addEventListener("change",e=>{S.cardsGroupId=e.target.value;loadCards()});
 $("#cards-print")?.addEventListener("click",()=>{document.body.dataset.print="cards";window.print()});
 window.addEventListener("afterprint",()=>{delete document.body.dataset.print;delete document.body.dataset.printStudent;document.querySelectorAll(".student-card-print-item.is-print-target").forEach(item=>item.classList.remove("is-print-target"))});
 await loadCards();
}

// ---- برنامج الثمانية أشهر: خطط الحفظ الثلاث + التثبيت بحسب المحفوظ + الورد المستقل ----
function quranEightMonthMarkup(pathData){
 const plans=pathData?.thabit_plans||{};
 const cats=pathData?.categories||{};
 const ward=pathData?.ward_options||{};
 const planCards=Object.entries(plans).map(([id,p])=>'<article class="quran-eight-plan"><span class="quran-eight-num">'+esc(String(p.thumns))+'</span><strong>'+esc(p.label||id)+'</strong><small>ضمن برنامج الثمانية أشهر · بالقدر الأسبوعي من الأثمان · خمسة أيام في الأسبوع مع يوم استراحة</small></article>').join("");
 const catRows=Object.entries(cats).map(([id,c])=>'<tr><th>'+esc(c.label||id)+'</th><td>'+esc(c.thabitLabel||"")+' يوميًا</td><td>'+Number(c.workDays||5)+' أيام أسبوعيًا</td></tr>').join("");
 const wardChips=Object.entries(ward).map(([id,label])=>'<span class="world-chip"><b>الورد</b> '+esc(label)+'</span>').join("");
 return '<section class="card quran-plans-eight"><div class="section-head"><div><span class="eyebrow">برنامج الثمانية أشهر</span><h3>خطط الحفظ الثلاث</h3><p>ثلاثة مقادير أسبوعية ضمن برنامج الثمانية أشهر؛ يعتمد الشيخ ما يناسب وقتك وقدرتك. أرقام التثبيت معتمدة من الشيخ، ولا تتغير خطتك تلقائيًا.</p></div></div>'
  +'<div class="quran-eight-grid">'+planCards+'</div>'
  +'<h4>التثبيت بحسب مقدار المحفوظ</h4><div class="table-wrap"><table><thead><tr><th>مقدار المحفوظ</th><th>التثبيت اليومي</th><th>أيام العمل</th></tr></thead><tbody>'+catRows+'</tbody></table></div>'
  +'<h4>الورد اليومي (مستقل عن الحفظ والتثبيت)</h4><div class="quran-path-chips">'+wardChips+'</div><p class="muted small">الورد قراءة يومية مستقلة لا تُغني عن الحفظ الجديد ولا عن التثبيت، ولا يُحسب إنجازه بدلًا عنهما. تُسجّل الثلاثة مفصولة في حسابك، ولا تُخلط نقاطها بعضها ببعض.</p></section>';
}

// ---- جدولي: بطاقة البرنامج + مسيرة 8 أشهر + شهري + أسبوعي + تقويم + طباعة ----
function quranPhCardStyles(){
  return 'body{font-family:"IBM Plex Sans Arabic",Tahoma,Arial,sans-serif;direction:rtl;color:#111;margin:0;padding:20px;background:#fff}h1{font-size:22px;margin:0 0 4px}h2{font-size:16px;margin:22px 0 8px;border-bottom:2px solid #14532d;padding-bottom:6px;color:#14532d}p{margin:4px 0;font-size:13px}table{width:100%;border-collapse:collapse;font-size:12px;margin:8px 0 16px}th,td{border:1px solid #999;padding:7px 8px;text-align:right;vertical-align:top}th{background:#eef5ee;color:#14532d}.meta{color:#444;font-size:12px}.chip{display:inline-block;border:1px solid #14532d;border-radius:999px;padding:2px 10px;font-size:12px;margin:2px}.blank{border-bottom:1px solid #777;display:inline-block;min-width:180px}.page{page-break-after:always}@page{size:A4;margin:14mm}.muted{color:#555}.tafew{text-align:center}.small{font-size:11px}';
}
function quranScheduleTasks(pathInfo){
  const info=pathInfo||{};
  const hifzAmount=String(info.hifz_amount||"").trim()||"المقدار المحدد";
  const hifzUnit=String(info.hifz_unit||"").trim();
  const thabit=String(info.thabit_label||"").trim()||"التثبيت المقرر";
  const ward=String(info.ward_label||"").trim()||"الورد المقرر";
  return [
    {kind:"hifz",label:"الحفظ الجديد: "+hifzAmount+(hifzUnit?" "+hifzUnit:"")+" — مع الربط بما سبقه"},
    {kind:"thabit",label:"التثبيت: "+thabit+" — 15 تكرارًا مع مراجعة الربط"},
    {kind:"ward",label:"الورد اليومي: "+ward+" — قراءة مستقلة عن الحفظ والتثبيت"}
  ];
}
function quranScheduleMarkup(pathData, todayData, summary, monthLogs){
  const enrolled=Boolean(pathData&&pathData.enrolled);
  const info=(pathData&&pathData.path)||{};
  const logs=(monthLogs&&Array.isArray(monthLogs))?monthLogs:[];
  const totals=(summary&&summary.totals)||{};
  const stations=(summary&&summary.stations)||{};
  const weekdayName=(d)=>QURAN_WEEKDAYS[Number(d)]||"";
  const restName=(info.rest_day!==null&&info.rest_day!==undefined)?weekdayName(info.rest_day):"";
  const nineMonths=[
    {m:1,title:"الانطلاق من خطتك",note:"ثبت إيقاعك اليومي: الحفظ، ثم التثبيت مع الربط، ثم الورد، والزم يوم الاستراحة.",gate:"—"},
    {m:2,title:"الاستمرار والمراجعة التراكمية",note:"ركّز على ما مضى مع المتشابهات بين السور.",gate:"—"},
    {m:3,title:"المحطة الأولى",note:"اعرض على الشيخ ما بلغت من الحفظ، واطلب اعتماد محطة 15 حزبًا.",gate:"محطة 15 حزبًا"},
    {m:4,title:"التثبيت والعزم",note:"واصل بخطتك؛ لا تزد على مقدارك قبل اعتماد الشيخ.",gate:"—"},
    {m:5,title:"المحطة الثانية",note:"اعرض على الشيخ ما بلغت، وأكمل تثبيت ما سبقها من الأحزاب.",gate:"محطة 30 حزبًا"},
    {m:6,title:"نحو التمكين",note:"ربط متشابهات المراحل وتكرار المعاني والمتشابهات.",gate:"—"},
    {m:7,title:"التمكين والمراجعة الشاملة",note:"سرد وتمكين قبل الختمة، على وتيرة خطتك نفسها.",gate:"محطة 45 حزبًا"},
    {m:8,title:"الختم والاختبار الختامي",note:"المحطة الرابعة والاختبار الختامي مع الشيخ؛ النجاح بالإتقان لا بالسرعة.",gate:"محطة 60 حزبًا — الختم"}
  ];
  if(!enrolled){
    return '<section class="card quran-program-card"><div class="section-head"><div><span class="eyebrow">جدولي</span><h3>لم تُنشئ مسارك بعد</h3><p>أنشئ خطتك أولًا من تبويب «يومي» أو «خطتي»، ثم ارجع إلى «جدولي» لتظهر لك البطاقة كاملة مع المسيرة والتقويم والطباعة.</p></div></div></section>';
  }
  const chips='<div class="quran-path-chips">'
    +'<span class="world-chip"><b>المسار</b> '+esc(info.hifz_plan_label||"—")+'</span>'
    +'<span class="world-chip"><b>الفئة</b> '+esc(info.hifz_category_label||"—")+'</span>'
    +'<span class="world-chip"><b>الحفظ</b> '+esc(info.hifz_amount||"—")+' '+esc(info.hifz_unit||"")+'</span>'
    +'<span class="world-chip"><b>التثبيت</b> '+esc(info.thabit_label||"—")+'</span>'
    +'<span class="world-chip"><b>الورد</b> '+esc(info.ward_label||"—")+'</span>'
    +(restName?'<span class="world-chip"><b>الاستدراك</b> '+esc(restName)+'</span>':"")
    +'</div>';
  const totalsRow='<div class="quran-program-stats">'
    +'<div><small>أيام الحفظ</small><strong>'+Number(totals.hifz?.days||0)+'</strong></div>'
    +'<div><small>أيام التثبيت</small><strong>'+Number(totals.thabit?.days||0)+'</strong></div>'
    +'<div><small>أحزاب التثبيت</small><strong>'+quranFmtAmount(totals.thabit?.total||0,"حزب")+'</strong></div>'
    +'<div><small>أيام الورد</small><strong>'+Number(totals.ward?.days||0)+'</strong></div>'
    +'<div><small>محطات معتمدة</small><strong>'+Number(stations.approved||0)+' / 4</strong></div>'
    +'</div>';
  const journeyRows=nineMonths.map(row=>'<tr><td class="tafew"><strong>الشهر '+row.m+'</strong></td><td><strong>'+esc(row.title)+'</strong><br><small class="muted">'+esc(row.note)+'</small></td><td class="tafew">'+esc(row.gate)+'</td></tr>').join("");
  const now=new Date();
  const monthStr=localDateISO().slice(0,7);
  const monthLabel=new Date(monthStr+"-02T12:00:00").toLocaleDateString("ar-DZ",{month:"long",year:"numeric"});
  const monthName=monthLabel;
  const daysInMonth=new Date(now.getFullYear(),now.getMonth()+1,0).getDate();
  const weeks=[];
  for(let start=1,w=1;start<=daysInMonth;start+=7,w++){const end=Math.min(daysInMonth,start+6);weeks.push({n:w,from:start,to:end});}
  const monthRows=weeks.map(w=>'<tr><td class="tafew"><strong>الأسبوع '+w.n+'</strong></td><td class="tafew">من '+monthStr+'-'+String(w.from).padStart(2,"0")+' إلى '+monthStr+'-'+String(w.to).padStart(2,"0")+'</td><td>الحفظ: '+esc(info.hifz_amount||"—")+' '+esc(info.hifz_unit||"")+' يوميًا × 5 أيام · التثبيت: '+esc(info.thabit_label||"—")+' · الورد: '+esc(info.ward_label||"—")+'</td></tr>').join("");
  const tasks=quranScheduleTasks(info);
  const weekRows=QURAN_WEEKDAYS.map((name,i)=>{
    const rest=Number(info.rest_day)===i;
    return '<tr'+(rest?' class="quran-week-rest"':"")+'><th>'+esc(name)+(rest?' <small>استدراك</small>':"")+'</th><td>'+(rest?'راحة محددة في خطتك — يستعاض عنها بيوم آخر مع الشيخ عند الحاجة.':tasks.map(t=>'• '+esc(t.label)).join("<br>"))+'</td><td class="tafew">'+(rest?'—':'<span class="quran-check"></span>')+'</td></tr>';
  }).join("");
  const done={};
  for(const row of logs){done[row.day]=done[row.day]||{};done[row.day][row.kind]=row;}
  const todayIso=localDateISO();
  const firstWeekday=new Date(monthStr+"-01T12:00:00").getDay();
  const cellCount=firstWeekday+daysInMonth;
  const trailing=(7-(cellCount%7))%7;
  let cells="";
  for(let i=0;i<firstWeekday;i++)cells+='<div class="qcal-cell is-empty" aria-hidden="true"></div>';
  for(let d=1;d<=daysInMonth;d++){
    const iso=monthStr+"-"+String(d).padStart(2,"0");
    const wd=new Date(iso+"T12:00:00").getDay();
    const isRest=Number(info.rest_day)===wd;
    const dLogs=done[iso]||{};
    const doneCount=["hifz","thabit","ward"].filter(k=>dLogs[k]).length;
    const isToday=iso===todayIso;
    cells+='<button type="button" class="qcal-cell'+(isRest?" is-rest":"")+(isToday?" is-today":"")+(doneCount===3?" is-complete":"")+'" data-qcal-day="'+iso+'" aria-label="'+iso+' — '+doneCount+' من 3"><span class="qcal-daynum">'+d+'</span><span class="qcal-marks">'+(isRest?'<i class="qcal-rest-dot" title="استدراك"></i>':"")+["hifz","thabit","ward"].map(k=>'<i class="qcal-dot qcal-dot-'+k+(dLogs[k]?" is-done":"")+'" title="'+({hifz:"حفظ",thabit:"تثبيت",ward:"ورد"}[k])+'"></i>').join("")+'</span></button>';
  }
  for(let i=0;i<trailing;i++)cells+='<div class="qcal-cell is-empty" aria-hidden="true"></div>';
  return '<section class="card quran-program-card"><div class="section-head"><div><span class="eyebrow">جدولي</span><h3>بطاقة برنامجي</h3><p>ملخص مسارك كما هو سارٍ الآن؛ اطبعه وعلّقه حتى يبقى أمام عينيك.</p></div><div class="student-actions"><button class="btn" type="button" data-sch-print="all">طباعة جدولي كاملًا</button></div></div>'
   +chips+totalsRow+'</section>'
   +'<section class="card quran-eight-journey"><div class="section-head"><div><span class="eyebrow">مسيرة الثمانية أشهر</span><h3>خارطة الطريق من الآن إلى الختم</h3><p>المحطات 15 و30 و45 و60 حزبًا يعتمدها الشيخ؛ وأنت تمشي على إيقاع خطتك نفسها شهرًا شهرًا.</p></div><button class="btn secondary" type="button" data-sch-print="all">طباعة المسيرة</button></div>'
   +'<div class="table-wrap"><table><thead><tr><th>الشهر</th><th>المطلوب</th><th>المحطة</th></tr></thead><tbody>'+journeyRows+'</tbody></table></div></section>'
   +'<section class="card quran-month-plan"><div class="section-head"><div><span class="eyebrow">الجدول الشهري</span><h3>خطة '+esc(monthName)+'</h3><p>كل أسبوع = خمسة أيام عمل بحسب خطتك، والسبت والجمعة بحسب يوم راحتك.</p></div><button class="btn secondary" type="button" data-sch-print="month">طباعة الجدول الشهري</button></div>'
   +'<div class="table-wrap"><table><thead><tr><th>الأسبوع</th><th>النطاق</th><th>المهام اليومية</th></tr></thead><tbody>'+monthRows+'</tbody></table></div></section>'
   +'<section class="card quran-week-plan"><div class="section-head"><div><span class="eyebrow">الجدول الأسبوعي</span><h3>مهامك في كل يوم</h3><p>الأسماء الدقيقة لكل مهمة كما هي في خطتك؛ انسخها وعلّقها، وعلّم أمام كل مهمة عند إتمامها.</p></div><button class="btn secondary" type="button" data-sch-print="week">طباعة الجدول الأسبوعي</button></div>'
   +'<div class="table-wrap"><table><thead><tr><th>اليوم</th><th>المهام</th><th>✓</th></tr></thead><tbody>'+weekRows+'</tbody></table></div></section>'
   +'<section class="card quran-calendar"><div class="section-head"><div><span class="eyebrow">التقويم</span><h3>مهامك على التقويم</h3><p>اضغط أي يوم لعرض مهامه أو تسجيل المنجز منه؛ الأخضر يعني أن المهمة أُنجزت يومها.</p></div><div class="qcal-nav"><button class="btn secondary" type="button" id="qcal-prev" aria-label="الشهر السابق">‹ السابق</button><strong id="qcal-title" class="qcal-title"></strong><button class="btn secondary" type="button" id="qcal-today">اليوم</button><button class="btn secondary" type="button" id="qcal-next" aria-label="الشهر التالي">التالي ›</button><button class="btn secondary" type="button" data-sch-print="calendar">طباعة التقويم</button></div></div>'
   +'<div class="qcal-weekdays"><span>الأحد</span><span>الإثنين</span><span>الثلاثاء</span><span>الأربعاء</span><span>الخميس</span><span>الجمعة</span><span>السبت</span></div>'
   +'<div class="qcal-grid" id="qcal-grid">'+cells+'</div>'
   +'<div class="qcal-detail" id="qcal-detail"><p class="muted">اختر يومًا من التقويم لعرض مهامه.</p></div>'
   +'</section>';
}
function quranSchedulePrintSheet(info, summary, monthLogs, monthStr, name){
  const win=window.open("","_blank","width=900,height=1300");
  if(!win){toast("تعذر فتح نافذة الطباعة؛ اسمح بالنوافذ المنبثقة",true);return}
  const infoSafe=info||{};
  const totals=(summary&&summary.totals)||{};
  const tasks=quranScheduleTasks(infoSafe);
  const restName=(infoSafe.rest_day!==null&&infoSafe.rest_day!==undefined)?(QURAN_WEEKDAYS[Number(infoSafe.rest_day)]||""):"";
  const todayStr=new Date().toLocaleDateString("ar-DZ",{weekday:"long",year:"numeric",month:"long",day:"numeric"});
  const journey=[["الشهر 1","الانطلاق من خطتك","—"],["الشهر 2","الاستمرار والمراجعة التراكمية","—"],["الشهر 3","المحطة الأولى — اعرض على الشيخ","محطة 15 حزبًا"],["الشهر 4","التثبيت والعزم","—"],["الشهر 5","المحطة الثانية","محطة 30 حزبًا"],["الشهر 6","نحو التمكين","—"],["الشهر 7","التمكين والمراجعة الشاملة","محطة 45 حزبًا"],["الشهر 8","الختم والاختبار الختامي","محطة 60 حزبًا — الختم"]];
  const journeyRows=journey.map(r=>'<tr><td><strong>'+esc(r[0])+'</strong></td><td>'+esc(r[1])+'</td><td>'+esc(r[2])+'</td></tr>').join("");
  const now=new Date(monthStr+"-02T12:00:00");
  const daysInMonth=new Date(now.getFullYear(),now.getMonth()+1,0).getDate();
  const weeks=[];
  for(let start=1,w=1;start<=daysInMonth;start+=7,w++){const end=Math.min(daysInMonth,start+6);weeks.push('<tr><td><strong>الأسبوع '+w+'</strong></td><td>من '+monthStr+'-'+String(start).padStart(2,"0")+' إلى '+monthStr+'-'+String(end).padStart(2,"0")+'</td><td>الحفظ: '+esc(infoSafe.hifz_amount||"—")+' '+esc(infoSafe.hifz_unit||"")+' يوميًا × 5 · التثبيت: '+esc(infoSafe.thabit_label||"—")+' · الورد: '+esc(infoSafe.ward_label||"—")+'</td></tr>');}
  const done={};
  for(const row of (monthLogs||[])){done[row.day]=done[row.day]||{};done[row.day][row.kind]=true;}
  const firstWeekday=new Date(monthStr+"-01T12:00:00").getDay();
  const cellCount=firstWeekday+daysInMonth;
  const trailing=(7-(cellCount%7))%7;
  let calCells="";
  for(let i=0;i<firstWeekday;i++)calCells+='<td class="muted"></td>';
  for(let d=1;d<=daysInMonth;d++){
    const iso=monthStr+"-"+String(d).padStart(2,"0");
    const wd=new Date(iso+"T12:00:00").getDay();
    const isRest=Number(infoSafe.rest_day)===wd;
    const dLogs=done[iso]||{};
    calCells+='<td class="'+(isRest?'tafew':'')+'"><strong>'+d+'</strong>'+(isRest?'<br><span class="small">استدراك</span>':'<br><span class="small">'+(dLogs.hifz?"✓ حفظ ":"• حفظ ")+(dLogs.thabit?"✓ تثبيت ":"• تثبيت ")+(dLogs.ward?"✓ ورد":"• ورد")+'</span>')+'</td>';
    if((firstWeekday+d)%7===0&&d!==daysInMonth)calCells+='</tr><tr>';
  }
  if(trailing)for(let i=0;i<trailing;i++)calCells+='<td class="muted"></td>';
  const weekRows=QURAN_WEEKDAYS.map((n,i)=>{
    const rest=Number(infoSafe.rest_day)===i;
    return '<tr><th>'+esc(n)+(rest?' — استدراك':"")+'</th><td>'+(rest?'راحة محددة في خطتك':tasks.map(t=>'• '+esc(t.label)).join("<br>"))+'</td><td class="tafew">'+(rest?"—":"☐")+'</td></tr>';
  }).join("");
  win.document.write('<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>جدولي — '+esc(name||"")+'</title><style>'+quranPhCardStyles()+'</style></head><body>'
    +'<div class="page"><h1>أكاديمية الإحسان — جدولي القرآني</h1><p class="meta">الطالب: <strong>'+esc(name||"")+'</strong> · التاريخ: '+esc(todayStr)+'</p>'
    +'<h2>بطاقة البرنامج</h2><table><tbody>'
    +'<tr><th>المسار</th><td>'+esc(infoSafe.hifz_plan_label||"—")+' ('+esc(infoSafe.hifz_category_label||"")+')</td></tr>'
    +'<tr><th>الحفظ اليومي</th><td>'+esc(infoSafe.hifz_amount||"—")+' '+esc(infoSafe.hifz_unit||"")+'</td></tr>'
    +'<tr><th>التثبيت اليومي</th><td>'+esc(infoSafe.thabit_label||"—")+' (15 تكرارًا، خمسة أيام في الأسبوع)</td></tr>'
    +'<tr><th>الورد اليومي</th><td>'+esc(infoSafe.ward_label||"—")+' — مستقل عن الحفظ والتثبيت</td></tr>'
    +'<tr><th>يوم الاستدراك</th><td>'+esc(restName||"بلا يوم محدد")+'</td></tr>'
    +'<tr><th>التقدم</th><td>أيام الحفظ: '+Number(totals.hifz?.days||0)+' · أيام التثبيت: '+Number(totals.thabit?.days||0)+' · أيام الورد: '+Number(totals.ward?.days||0)+'</td></tr>'
    +'</tbody></table><h2>التوقيع</h2><p>الطالب: <span class="blank"></span> &nbsp;&nbsp; الشيخ: <span class="blank"></span></p></div>'
    +'<div class="page"><h2>مسيرة الثمانية أشهر</h2><table><thead><tr><th>الشهر</th><th>المطلوب</th><th>المحطة</th></tr></thead><tbody>'+journeyRows+'</tbody></table><p class="muted small">أرقام التثبيت المرجعية (15←ثمن، 30←ربع، 45←ثلاثة أثمان، 60←نصف) مقترحة وتنتظر اعتماد الشيخ.</p></div>'
    +'<div class="page"><h2>الجدول الشهري</h2><table><thead><tr><th>الأسبوع</th><th>النطاق</th><th>المهام اليومية</th></tr></thead><tbody>'+weeks.join("")+'</tbody></table></div>'
    +'<div class="page"><h2>الجدول الأسبوعي</h2><table><thead><tr><th>اليوم</th><th>المهام</th><th>✓</th></tr></thead><tbody>'+weekRows+'</tbody></table></div>'
    +'<div class="page"><h2>تقويم الشهر ('+esc(monthStr)+')</h2><table><thead><tr><th>الأحد</th><th>الإثنين</th><th>الثلاثاء</th><th>الأربعاء</th><th>الخميس</th><th>الجمعة</th><th>السبت</th></tr></thead><tbody><tr>'+calCells+'</tr></tbody></table><p class="muted small">✓ تعني مُسجَّلة ذلك اليوم.</p></div>'
    +'</body></html>');
  win.document.close();win.focus();setTimeout(()=>{try{win.print()}catch{}},350);
}

function wireQuranSchedule(v,pathData,summary){
  const info=(pathData&&pathData.path)||{};
  const gridHost=v.querySelector("#qcal-grid");
  const detailHost=v.querySelector("#qcal-detail");
  const titleHost=v.querySelector("#qcal-title");
  if(!gridHost)return;
  let monthStr=localDateISO().slice(0,7);
  let selected=localDateISO();
  const hifzDefault=(()=>{const n=parseFloat(String(info.hifz_amount||""));return isFinite(n)?n:""})();
  const tasks=quranScheduleTasks(info);
  function doneMap(logs){
    const done={};
    for(const row of logs){done[row.day]=done[row.day]||{};done[row.day][row.kind]=row;}
    return done;
  }
  function renderGrid(logs){
    const [y,m]=monthStr.split("-").map(Number);
    const daysInMonth=new Date(y,m,0).getDate();
    const firstWeekday=new Date(y,m-1,1,12).getDay();
    const todayIso=localDateISO();
    const done=doneMap(logs);
    const trailing=(7-((firstWeekday+daysInMonth)%7))%7;
    let cells="";
    for(let i=0;i<firstWeekday;i++)cells+='<div class="qcal-cell is-empty" aria-hidden="true"></div>';
    for(let d=1;d<=daysInMonth;d++){
      const iso=y+"-"+String(m).padStart(2,"0")+"-"+String(d).padStart(2,"0");
      const wd=new Date(iso+"T12:00:00").getDay();
      const isRest=Number(info.rest_day)===wd;
      const dLogs=done[iso]||{};
      const doneCount=["hifz","thabit","ward"].filter(k=>dLogs[k]).length;
      cells+='<button type="button" class="qcal-cell'+(isRest?" is-rest":"")+(iso===todayIso?" is-today":"")+(doneCount===3?" is-complete":"")+(iso===selected?" is-selected":"")+'" data-qcal-day="'+iso+'" aria-label="'+iso+' — '+doneCount+' من 3 مهام منجزة"><span class="qcal-daynum">'+d+'</span><span class="qcal-marks">'+(isRest?'<i class="qcal-rest-dot"></i>':"")+["hifz","thabit","ward"].map(k=>'<i class="qcal-dot qcal-dot-'+k+(dLogs[k]?" is-done":"")+'"></i>').join("")+'</span></button>';
    }
    for(let i=0;i<trailing;i++)cells+='<div class="qcal-cell is-empty" aria-hidden="true"></div>';
    gridHost.innerHTML=cells;
    if(titleHost)titleHost.textContent=new Date(y,m-1,1,12).toLocaleDateString("ar-DZ",{month:"long",year:"numeric"});
    gridHost.querySelectorAll("[data-qcal-day]").forEach(btn=>btn.onclick=()=>{selected=btn.dataset.qcalDay;renderGrid(logs);renderDetail(logs);});
  }
  function renderDetail(logs){
    if(!detailHost)return;
    const todayIso=localDateISO();
    const isFuture=selected>todayIso;
    const wd=new Date(selected+"T12:00:00").getDay();
    const isRest=Number(info.rest_day)===wd;
    const done=doneMap(logs);
    const dLogs=done[selected]||{};
    const rows=isRest
      ?'<div class="notice">يوم استدراك محدد في خطتك — راحة مقررة؛ معرفته راحة لا كسلًا.</div>'
      :tasks.map(t=>{
        const logged=dLogs[t.kind];
        const canLog=!isFuture&&!logged&&S.user.role==="student";
        const defVal=t.kind==="hifz"?hifzDefault:t.kind==="thabit"?(info.thabit_amount??""):t.kind==="ward"?(info.ward_ahzab??""):"";
        return '<form class="qcal-task'+(logged?" is-done":"")+'" data-qcal-log="'+t.kind+'"><div class="qcal-task-main"><span class="qcal-task-check" aria-hidden="true">'+(logged?"✓":"")+'</span><span class="qcal-task-label">'+esc(t.label)+'</span></div>'
          +(logged?'<small class="muted">أُنجز: '+esc(quranFmtAmount(logged.amount,logged.unit))+(Number(logged.repetitions)?' · '+Number(logged.repetitions)+' تكرارًا':'')+'</small>'
            :(canLog?'<label class="qcal-amount"><span style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">المقدار</span><input type="number" step="0.01" min="0" max="1000" name="amount" placeholder="المقدار" value="'+esc(String(defVal))+'" required></label><button class="btn secondary sm" type="submit">أتممتها</button>'
            :'<small class="muted">يوم قادم؛ ستُفتح مهامه يومه.</small>'))
          +'</form>';
      }).join("");
    detailHost.innerHTML='<h4>'+esc(new Date(selected+"T12:00:00").toLocaleDateString("ar-DZ",{weekday:"long",day:"numeric",month:"long",year:"numeric"}))+(selected===todayIso?' <span class="pill">اليوم</span>':'')+'</h4>'+rows;
    detailHost.querySelectorAll("[data-qcal-log]").forEach(form=>form.onsubmit=async event=>{
      event.preventDefault();
      const kind=form.dataset.qcalLog,button=form.querySelector('button[type="submit"]');
      if(button)button.disabled=true;
      const defaults={hifz:{unit:info.hifz_unit||"صفحة",reps:0},thabit:{unit:"حزب",reps:15},ward:{unit:"حزب",reps:0}}[kind];
      const amount=Number(form.querySelector('input[name=amount]').value);
      try{await api("/quran/daily",{method:"POST",body:JSON.stringify({kind,amount,unit:defaults.unit,repetitions:defaults.reps,day:selected})});toast("أُثبتت المهمة في تقويمك");await reload();}
      catch(error){if(button)button.disabled=false;toast(error.message,true);}
    });
  }
  async function reload(){
    try{const logs=await api("/quran/logs?month="+encodeURIComponent(monthStr));renderGrid(logs);renderDetail(logs);}
    catch(error){toast(error.message,true);}
  }
  v.querySelector("#qcal-prev")?.addEventListener("click",()=>{const [y,m]=monthStr.split("-").map(Number);const d=new Date(y,m-2,1);monthStr=d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0");reload();});
  v.querySelector("#qcal-next")?.addEventListener("click",()=>{const [y,m]=monthStr.split("-").map(Number);const d=new Date(y,m,1);monthStr=d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0");reload();});
  v.querySelector("#qcal-today")?.addEventListener("click",()=>{monthStr=localDateISO().slice(0,7);selected=localDateISO();reload();});
  v.querySelectorAll("[data-sch-print]").forEach(btn=>btn.addEventListener("click",async()=>{
    let monthLogs=[];
    try{monthLogs=await api("/quran/logs?month="+encodeURIComponent(localDateISO().slice(0,7)));}catch{}
    quranSchedulePrintSheet(info,summary,monthLogs,localDateISO().slice(0,7),S.user.name);
  }));
  reload();
}

let ihsanScannerAssetsPromise=null;
function ihsanLoadScript(src){return new Promise((resolve,reject)=>{const script=document.createElement("script");script.src=src;script.async=true;script.onload=resolve;script.onerror=()=>reject(new Error("تعذر تحميل أداة المسح: "+src));document.head.appendChild(script)})}
function ensureScannerAssets(){if(window.IhsanScanner)return Promise.resolve();if(!ihsanScannerAssetsPromise){ihsanScannerAssetsPromise=(async()=>{if(!("BarcodeDetector" in window)&&typeof window.jsQR!=="function")await ihsanLoadScript("/jsQR.js?v=20261121-22");await ihsanLoadScript("/scanner.js?v=20261121-22")})().catch(error=>{ihsanScannerAssetsPromise=null;throw error})}return ihsanScannerAssetsPromise}
// ---- واجهة الشيخ: المسح والمتابعة (QR حقيقي أو اختيار يدوي) ----
async function scanPage(v){
  if(!["admin","teacher","director","supervisor"].includes(S.user.role)){v.innerHTML=head("المسح والمتابعة","هذه الصفحة متاحة للشيخ أو المشرف أو المدير فقط.");return}
  const scannerReady=ensureScannerAssets();
  if(!S.groups.length||!S.students.length)await load();
  await scannerReady;
  const groups=assignedGroups(),allowedGroupIds=new Set(groups.map(g=>String(g.id)));
  const students=S.students.filter(st=>allowedGroupIds.has(String(st.group_id))).slice().sort((a,b)=>compareStudentNames(a.name,b.name));
  v.__scanStudents=students;
  const taskDefinitions=[
    {id:"attendance",label:"الحضور",hint:"30 نقطة",symbol:"✓"},
    {id:"hifz",label:"الحفظ",hint:"20 نقطة",symbol:"آ"}
  ];
  const selectedTaskIds=()=>String(taskType.value||"").split(",").filter(id=>["attendance","hifz"].includes(id));
  const taskLabel=()=>selectedTaskIds().map(id=>taskDefinitions.find(t=>t.id===id)?.label).filter(Boolean).join(" + ");
  const taskTiles=taskDefinitions.map(t=>'<button type="button" class="scan-task-option scan-task-simple" data-scan-task="'+t.id+'" aria-pressed="false"><span class="scan-task-symbol" aria-hidden="true">'+t.symbol+'</span><span class="scan-task-copy"><strong>'+t.label+'</strong><small>'+t.hint+'</small></span><span class="scan-task-check" aria-hidden="true">✓</span></button>').join("");
  const savedIds=String(safeStore.get("ihsan_scan_task_type")||S.scanTaskType||"").split(",").filter(id=>["attendance","hifz"].includes(id));
  const savedTask=savedIds.join(",");
  v.innerHTML=head("المسح والمتابعة","")
    +'<section class="card scan-task-setup scan-task-studio"><input id="scan-task-type" type="hidden" value="'+esc(savedTask)+'">'
    +'<div class="scan-task-topline"><strong class="scan-task-kicker">اختر ما تريد تسجيله</strong><span class="scan-task-date-hint">اليوم</span></div>'
    +'<div class="scan-task-controls"><button type="button" id="scan-task-toggle" class="scan-task-launcher" aria-expanded="false" aria-controls="scan-task-picker"><span class="scan-task-launcher-symbol" aria-hidden="true">✦</span><span class="scan-task-launcher-copy"><strong id="scan-task-launcher-title">اختر المهمة</strong><small id="scan-task-launcher-subtitle">الحضور 30 · الحفظ 20</small></span><span class="scan-task-launcher-arrow" aria-hidden="true">⌄</span></button>'
    +'<input id="scan-task-date" type="hidden" value="'+localDateISO()+'"></div>'
    +'<div id="scan-task-picker" class="scan-task-picker is-open" aria-label="مهام المتابعة"><div class="scan-task-grid-inner"><div class="scan-task-grid scan-task-grid-two" role="group" aria-label="الحضور والحفظ">'+taskTiles+'</div></div></div>'
    +'<div class="scan-task-feedback"><span class="scan-task-feedback-dot" aria-hidden="true"></span><span id="scan-task-ready" role="status">اختر مهمة لفتح المسح.</span></div></section>'
    +'<div class="scan-layout">'
    +'<section class="card scan-camera-card"><div class="section-head"><div><span class="eyebrow">المسح الذكي</span><h3>امسح بطاقة الطالب</h3></div></div>'
    +'<div class="scan-video-wrap"><video id="scan-video" playsinline muted aria-label="بث الكاميرا لمسح بطاقة الطالب"></video><div class="scan-frame" aria-hidden="true"></div></div>'
    +'<div id="scan-status" class="notice" role="status">اختر مهمة</div>'
    +'<div class="student-actions"><button class="btn" type="button" id="scan-start" disabled>تشغيل الكاميرا</button><button class="btn secondary" type="button" id="scan-stop">إيقاف الكاميرا</button></div></section>'
    +'<section class="card scan-manual-card"><div class="section-head"><div><span class="eyebrow">بديل سريع</span><h3>ابحث عن الطالب</h3><p>لا تحتاج إلى اختيار الفوج؛ تظهر لك أسماء الطلاب الذين تقع متابعتهم ضمن صلاحيتك.</p></div></div>'
    +'<label class="field">اسم الطالب<input id="scan-search" type="search" placeholder="اكتب الاسم أو جزءًا منه…" autocomplete="off"></label>'
    +'<div id="scan-student-list" class="scan-student-list" role="listbox" aria-label="قائمة الطلاب"></div></section></div><div id="scan-panel"></div>';
  const status=v.querySelector("#scan-status"),video=v.querySelector("#scan-video"),listEl=v.querySelector("#scan-student-list");
  const taskType=v.querySelector("#scan-task-type"),taskDate=v.querySelector("#scan-task-date"),ready=v.querySelector("#scan-task-ready");
  const picker=v.querySelector("#scan-task-picker"),toggle=v.querySelector("#scan-task-toggle"),startButton=v.querySelector("#scan-start");
  taskType.value=savedTask;taskDate.value=localDateISO();S.scanDate=taskDate.value;S.date=taskDate.value;
  const setPickerOpen=open=>{picker.classList.toggle("is-open",Boolean(open));picker.inert=!open;toggle.setAttribute("aria-expanded",String(Boolean(open)));toggle.classList.toggle("is-open",Boolean(open))};
  const renderList=()=>{
    const q=String(v.querySelector("#scan-search")?.value||"").trim().toLocaleLowerCase("ar");
    const matches=students.filter(st=>!q||String(st.name||"").toLocaleLowerCase("ar").includes(q));
    listEl.innerHTML=matches.length?matches.slice(0,100).map(st=>{
      const group=groups.find(g=>String(g.id)===String(st.group_id));
      return '<button type="button" class="scan-student-item'+(String(S.scanStudentId)===String(st.id)?" is-selected":"")+'" role="option" aria-selected="'+(String(S.scanStudentId)===String(st.id)?"true":"false")+'" data-scan-pick="'+esc(st.id)+'"><strong>'+esc(studentDisplayName(st.name))+'</strong><small>'+esc(group?.name||"")+'</small></button>';
    }).join(""):'<div class="empty">لا توجد نتائج مطابقة ضمن الأفواج المسموح بها.</div>';
    listEl.querySelectorAll("[data-scan-pick]").forEach(btn=>btn.onclick=()=>selectStudent(btn.dataset.scanPick));
  };
  const updateTask=()=>{
    const ids=selectedTaskIds();
    S.scanTaskType=ids.join(",");safeStore.set("ihsan_scan_task_type",ids.join(","));S.scanDate=taskDate.value;S.date=taskDate.value;safeStore.set("ihsan_attendance_date",taskDate.value);
    const selected=ids.map(id=>taskDefinitions.find(t=>t.id===id)).filter(Boolean);
    const label=selected.map(t=>t.label).join(" + ");
    v.querySelector("#scan-task-launcher-title").textContent=label||"اختر مهمة المتابعة";
    v.querySelector("#scan-task-launcher-subtitle").textContent=selected.length===2?"الحضور والحفظ · 50 نقطة":selected.length===1?(selected[0].id==="attendance"?"30 نقطة":"20 نقطة"):"اختر مهمة";
    toggle.classList.toggle("has-selection",selected.length>0);
    const activityReady=true;
    ready.textContent=!selected.length?"اختر مهمة":selected.length===2?"جاهز · 50 نقطة":selected[0].id==="attendance"?"جاهز · 30 نقطة":"جاهز · 20 نقطة";
    ready.parentElement.classList.toggle("is-ready",Boolean(selected.length&&activityReady));
    startButton.disabled=!(selected.length&&taskDate.value&&activityReady);
    v.querySelectorAll("[data-scan-task]").forEach(button=>{const active=ids.includes(button.dataset.scanTask);button.classList.toggle("is-selected",active);button.setAttribute("aria-pressed",String(active))});
    status.textContent=selected.length&&taskDate.value?"جاهز للمسح":"اختر مهمة";
    renderList();
  };
  const openTaskPicker=()=>{setPickerOpen(true);toggle.focus()};
  const selectStudent=id=>{
    const st=students.find(x=>String(x.id)===String(id));
    if(!selectedTaskIds().length||!taskDate.value){openTaskPicker();toast("اختر المهمة أولًا.",true);return}
    if(!st){toast("هذا الطالب خارج نطاق صلاحيتك؛ لم تُفتح المتابعة.",true);return}
    S.scanGroupId=String(st.group_id||"");S.scanStudentId=st.id;
    try{window.IhsanScanner&&window.IhsanScanner.stop()}catch{}
    status.textContent="تم تحديد الطالب — "+(taskLabel()||"المتابعة")+" · "+(groups.find(g=>String(g.id)===String(st.group_id))?.name||"");
    renderList();renderScanPanel(v,st.id);
  };
  toggle.addEventListener("click",()=>setPickerOpen(!picker.classList.contains("is-open")));
  taskDate.addEventListener("change",updateTask);
  v.querySelectorAll("[data-scan-task]").forEach(button=>button.addEventListener("click",()=>{const id=button.dataset.scanTask;let ids=selectedTaskIds();if(["attendance","hifz"].includes(id)){ids=ids.filter(x=>["attendance","hifz"].includes(x));ids=ids.includes(id)?ids.filter(x=>x!==id):[...ids,id];}else{ids=[id];}taskType.value=ids.join(",");if(!ids.some(x=>["points","general"].includes(x)))S.scanActivity="";updateTask();if(!["attendance","hifz"].includes(id)||!ids.length)setPickerOpen(false)}));
  v.querySelector("#scan-search").addEventListener("input",renderList);
  let scanning=false;
  startButton.addEventListener("click",async()=>{
    if(!selectedTaskIds().length||!taskDate.value){openTaskPicker();toast("اختر المهمة أولًا.",true);return}
    if(scanning)return;
    if(!window.IhsanScanner){status.textContent="تعذر تحميل الماسح. حدّث الصفحة وحاول مجددًا.";status.classList.add("error");return}
    scanning=true;status.textContent="تشغيل الكاميرا…";status.classList.remove("error");
    const ok=await window.IhsanScanner.start(video,async raw=>{scanning=false;try{window.IhsanScanner.stop()}catch{}await handleScannedText(v,raw);if(v.isConnected&&selectedTaskIds().some(id=>["attendance","hifz"].includes(id)))setTimeout(()=>{if(v.isConnected&&!scanning)startButton.click()},250)},err=>{scanning=false;status.textContent=(err&&err.message)||"تعذر تشغيل الكاميرا";status.classList.add("error")});
    if(ok)status.textContent="وجّه الكاميرا للبطاقة";else scanning=false;
  });
  v.querySelector("#scan-stop").addEventListener("click",()=>{scanning=false;try{window.IhsanScanner.stop()}catch{}status.textContent="الكاميرا متوقفة."});
  setPickerOpen(true);updateTask();
  if(S.scanStudentId&&students.some(st=>String(st.id)===String(S.scanStudentId))&&taskType.value&&taskDate.value){
    const existing=students.find(st=>String(st.id)===String(S.scanStudentId));S.scanGroupId=String(existing.group_id||"");renderScanPanel(v,S.scanStudentId);
  }
}
function studentsForScanCheck(id){return (S.students||[]).find(st=>String(st.id)===String(id))||null}
async function handleScannedText(v,raw){
  const match=String(raw||"").match(/scan=([^#\s"']+)/);
  const payload=match?match[1]:String(raw||"").trim();
  const parts=payload.split(".");
  const kind=parts[0];
  if(parts.length<3||!["add_points","profile","login"].includes(kind)){toast("هذا الرمز ليس بطاقة طالب صالحة أو أنه غير مكتمل",true);return}
  const cardId=parts[1],secret=parts.slice(2).join(".");
  try{
    const taskIds=String(S.scanTaskType||safeStore.get("ihsan_scan_task_type")||"").split(",").filter(id=>["attendance","hifz"].includes(id));
    if(!taskIds.length||!S.scanDate){toast("اختر الحضور أو الحفظ أولًا.",true);return}
    if(kind!=="add_points"){toast("امسح بطاقة إضافة النقاط الخاصة بالطالب.",true);return}
    const tasks=taskIds;
    const results=[];
    for(const task of tasks){
      results.push(await api("/cards/resolve",{method:"POST",body:JSON.stringify({kind,task,card_id:cardId,secret})}));
    }
    const result=results[0],student=result&&result.student;
    if(!student||!student.id)throw new Error("تعذر قراءة بيانات البطاقة");
    const authorizedRoster=v.__scanStudents||[];
    const rosterStudent=authorizedRoster.find(st=>String(st.id)===String(student.id));
    if(!rosterStudent){toast("هذا الطالب خارج نطاق صلاحيتك؛ لم تُفتح المتابعة.",true);return}
    // Use the roster row matched by immutable student ID; never match or award by name.
    S.scanGroupId=String(rosterStudent.group_id||"");
    S.scanStudentId=String(rosterStudent.id);
    const attendanceResult=results.find((_,i)=>tasks[i]==="attendance");
    const hifzResult=results.find((_,i)=>tasks[i]==="hifz");
    const name=String(rosterStudent.name||student.name||"طالب");
    if(kind==="add_points"&&tasks.length>1){
      const a=attendanceResult?.attendance_awards?.length?"30 نقطة حضور":"الحضور مسجل اليوم";
      const h=hifzResult?.hifz_awards?.some(x=>x.status==="awarded")?"20 نقطة حفظ":"مكافأة الحفظ مسجلة اليوم";
      toast(name+" — "+a+" + "+h);
    }else if(kind==="add_points"&&tasks[0]==="attendance")toast("حضور "+name+" — "+(result.attendance_awards?.length?"30 نقطة، ولا تتكرر اليوم":"تم تسجيل الحضور مسبقًا اليوم."));
    else if(kind==="add_points"&&tasks[0]==="hifz")toast("حفظ "+name+" — "+(result.hifz_awards?.some(x=>x.status==="awarded")?"20 نقطة":"مكافأة الحفظ مسجلة اليوم."));
    else toast("تم ربط البطاقة بالطالب: "+name+" · "+({add_points:"رمز إضافة النقاط",profile:"رمز الملف الشخصي",login:"رمز الدخول"}[kind]||"بطاقة"));
    renderScanPanel(v,String(rosterStudent.id));
  }catch(error){toast(error.message||"تعذر استخدام البطاقة",true)}
}

async function renderScanPanel(v,studentId){
  const host=v.querySelector("#scan-panel");
  if(!host)return;
  host.innerHTML='<div class="loading">جار تحميل بيانات الطالب…</div>';
  let summary,pathData,today,events;
  const res=await Promise.allSettled([
    api("/points/summary?student_id="+encodeURIComponent(studentId)),
    api("/quran/path?student_id="+encodeURIComponent(studentId)),
    api("/quran/today?student_id="+encodeURIComponent(studentId)),
    api("/points/history?student_id="+encodeURIComponent(studentId)+"&limit=8"),
    S.user.role==="admin"?api("/points/ethics?student_id="+encodeURIComponent(studentId)):Promise.resolve(null),
    S.user.role==="admin"?api("/points/streak?student_id="+encodeURIComponent(studentId)):Promise.resolve([]),
    S.user.role==="admin"?api("/points/referrals?student_id="+encodeURIComponent(studentId)):Promise.resolve([])
  ]);
  if(res[0].status!=="fulfilled"){host.innerHTML='<div class="notice error">'+esc(res[0].reason?.message||"تعذر تحميل بيانات الطالب")+'</div>';return}
  summary=res[0].value;
  pathData=res[1].status==="fulfilled"?res[1].value:{enrolled:false};
  today=res[2].status==="fulfilled"?res[2].value:{enrolled:false,logs:{}};
  events=res[3].status==="fulfilled"?res[3].value:[];
  const ethics=res[4]?.status==="fulfilled"?res[4].value:null;
  const streaks=res[5]?.status==="fulfilled"?res[5].value:[];
  const referrals=res[6]?.status==="fulfilled"?res[6].value:[];
  const s=summary.student||{},t=summary.totals||{};
  const info=(pathData&&pathData.path)||null;
  const logs=(today&&today.logs)||{};
  const todayIso=S.scanDate||localDateISO();
  const planChips=info
    ?'<div class="quran-path-chips"><span class="world-chip"><b>الفئة</b> '+esc(info.hifz_category_label||"—")+'</span><span class="world-chip"><b>الحفظ</b> '+esc(info.hifz_amount||"—")+" "+esc(info.hifz_unit||"")+'</span><span class="world-chip"><b>التثبيت</b> '+esc(info.thabit_label||"—")+'</span><span class="world-chip"><b>الورد</b> '+esc(info.ward_label||"—")+'</span>'+(info.rest_day!==null&&info.rest_day!==undefined?'<span class="world-chip"><b>الاستدراك</b> '+esc(QURAN_WEEKDAYS[Number(info.rest_day)]||"")+'</span>':"")+(today.is_rest_day?'<span class="pill">اليوم يوم استدراك</span>':"")+'</div>'
    :'<div class="notice">لم يشترك هذا الطالب في مسار القرآن بعد؛ يبدأ من «عالمي» داخل حسابه.</div>';
  const thabitUnitFor=a=>({0.125:"ثمن حزب",0.25:"ربع حزب",0.375:"ثلاثة أثمان حزب",0.5:"نصف حزب",1:"حزب"}[String(Number(a))]||"حزب");
  const wardUnitFor=a=>({1:"حزب",2:"حزبان",4:"أربعة أحزاب"}[String(Number(a))]||"حزب");
  const quranQuick=(kind,label,defAmount,units,defReps,defUnit)=>{
    if(!info)return "";
    const logged=logs[kind];
    if(logged)return '<div class="scan-quran-row is-done"><div><strong>'+esc(label)+'</strong><small>تم اليوم: '+esc(quranFmtAmount(logged.amount,logged.unit))+(Number(logged.repetitions)?" · "+Number(logged.repetitions)+" تكرارًا":"")+'</small></div><span class="pill">مُسجَّل</span></div>';
    return '<form class="scan-quran-row" data-scan-quran="'+kind+'"><div class="scan-quran-head"><strong>'+esc(label)+'</strong><button class="btn secondary sm" type="submit">تسجيل الإنجاز</button></div><div class="scan-quran-fields"><label class="field">المقدار<input type="number" step="0.01" min="0" max="1000" name="amount" required value="'+esc(String(defAmount??""))+'"></label><label class="field">الوحدة<select name="unit">'+units.map(u=>'<option '+(u===defUnit?"selected":"")+'>'+u+'</option>').join("")+'</select></label>'+(kind==="hifz"?'':'<label class="field">التكرار<input type="number" min="0" max="100" name="repetitions" value="'+Number(defReps||0)+'"></label>')+'</div><label class="field">ملاحظات<input name="notes" maxlength="600" placeholder="اختياري — مثل موضع يحتاج تثبيتًا"></label></form>';
  };
  const activityButtons=[["fajr","الفجر · 30"],["shuruq","الشروق · 20"],["maghrib","المغرب · 10"],["hizb","قراءة حزب · 10"],["hifz_no_errors","حفظ ثمن بلا أخطاء · 20"],["hifz_tajweed","حفظ ثمن بالتجويد · 20"],["poetry","أربعة أبيات · 5"],["support","دعم الآخرين · +30%"]].filter(([a])=>!S.scanActivity||a===S.scanActivity).map(([a,l])=>'<button type="button" class="btn" data-scan-activity="'+a+'">'+esc(S.scanActivity?"اعتماد: "+l:l)+'</button>').join("");
  const attButtons=[["present","حاضر"],["late","متأخر"],["absent","غائب"],["excused","بعذر"]].map(([st,l])=>'<button type="button" class="btn secondary" data-scan-att="'+st+'">'+esc(l)+'</button>').join("");
  const studentRow=(S.students||[]).find(st=>String(st.id)===String(studentId));
  const recipientUserId=studentRow?.user_id||"";
  const assignTaskMarkup=recipientUserId
    ?'<h4>تعيين مهمة للطالب</h4><form id="scan-assign-task" class="form-grid"><label class="field full">عنوان المهمة<input name="title" required minlength="3" maxlength="160" placeholder="مثال: مراجعة المتشابهات بين سورتي الرحمن والقارعة"></label><label class="field full">التفاصيل والمطلوب<textarea name="content" required minlength="3" maxlength="8000" rows="2" placeholder="المطلوب من الطالب إنجازه، والموعد، وكيفية التسليم"></textarea></label><button class="btn" type="submit">أرسل المهمة إلى الطالب</button></form>'
    :'<h4>تعيين مهمة للطالب</h4><div class="notice">هذا الطالب بلا حساب داخل المنصة؛ أنشئ حسابه أولًا من صفحة الطلاب ثم عُد لتعيين المهمة.</div>';
  const eventRows=(events||[]).map(e=>'<div class="list-row"><div><strong>'+esc(e.reason||e.event_type)+'</strong><small>'+esc(e.kind_label||e.kind)+' · '+esc(pointsDate(e.created_at))+(e.awarded_by_name?' · اعتماد الشيخ':"")+(e.reversed?' · معكوسة':"")+'</small></div><span class="pill">'+(Number(e.points)>0?"+":"")+Number(e.points)+'</span></div>').join("");
  const isSheikh=S.user.role==="admin";
  const canGrantPoints=S.user.role==="admin";
  const pointsTaskSelected=S.scanTaskType==="points"||S.scanTaskType==="general";
  const referralOptions=(S.students||[]).filter(st=>String(st.id)!==String(studentId)).map(st=>'<option value="'+esc(st.id)+'">'+esc(st.name||st.display_name||"طالب")+'</option>').join("");
  const streakRows=(streaks||[]).map(x=>'<div class="list-row"><strong>'+esc({hifz:"الحفظ",fajr:"الفجر",shuruq:"الشروق"}[x.activity]||x.activity)+'</strong><span class="pill">'+Number(x.current_days)+' يوم · آخر تسجيل '+esc(x.last_date||"—")+'</span></div>').join("");
  const referralRows=(referrals||[]).filter(x=>x.status==="pending").map(x=>'<div class="list-row"><div><strong>'+esc(x.invited_name||"الزميل")+'</strong><small>دُعي بواسطة '+esc(x.inviter_name||"")+' · '+pointsDate(x.created_at)+'</small></div><button class="btn secondary" type="button" data-referral-confirm="'+esc(x.id)+'">اعتماد بعد أسبوع</button></div>').join("");
  const adminPointTools=isSheikh
    ?'<section class="card"><h4>الاستمرارية</h4><p class="muted small">سجّل اليوم بعد التحقق؛ المكافأة +50% عند 5 و10 و20 و30 يومًا متتالية، ولا تتكرر المحطة.</p><div class="list">'+(streakRows||'<p class="muted">لم تبدأ سلسلة بعد.</p>')+'</div><form id="scan-streak-form" class="form-grid"><label class="field">المسار<select name="activity"><option value="hifz">الحفظ</option><option value="fajr">الفجر</option><option value="shuruq">الشروق</option></select></label><label class="field">نقاط الإنجاز الأساسية<input name="base_points" type="number" min="1" max="1000" value="30" required></label><button class="btn" type="submit">اعتماد يوم الاستمرارية</button></form>'
    +'<h4>الأخلاق والتنبيهات</h4><p class="muted small">التنبيهات المعتمدة تُسجّل بسببها. بعد ثلاثة تنبيهات يتوقف امتياز المضاعفة؛ والحرمان النهائي لا يُعاد.</p><div class="notice">التنبيهات: '+Number(ethics?.warnings||0)+' · حالة المضاعفة: '+esc({active:"مفعّلة",suspended:"موقوفة بعد 3 تنبيهات",forfeited:"حرمان نهائي"}[ethics?.multiplier_status||"active"])+'</div><form id="scan-ethics-form" class="form-grid"><label class="field">الإجراء<select name="action"><option value="warning">تسجيل تنبيه</option><option value="award">منح مكافأة الأخلاق</option><option value="forfeit">حرمان نهائي من المضاعفة</option><option value="restore">إعادة الامتياز (إن لم يكن نهائيًا)</option></select></label><label class="field">خصم النقاط بعد التنبيه الثالث<input name="deduction_points" type="number" min="1" max="1000" placeholder="اختياري قبل التنبيه الرابع"></label><label class="field full">السبب (إلزامي)<input name="reason" required minlength="3" maxlength="500"></label><button class="btn danger" type="submit">اعتماد الإجراء</button></form>'
    +'<h4>إحضار زميل</h4><form id="scan-referral-form" class="form-grid"><label class="field">الزميل الجديد<select name="invited_student_id" required><option value="">اختر الطالب</option>'+referralOptions+'</select></label><button class="btn" type="submit">تسجيل الإحالة</button></form><div class="list">'+(referralRows||'<p class="muted">لا توجد إحالات معلّقة.</p>')+'</div></section>'
    :'<div class="notice">اعتماد النقاط والمكافآت والتنبيهات والاستمرارية من صلاحية الشيخ وحده.</div>';
  host.innerHTML='<section class="card scan-panel-card"><div class="section-head"><div><span class="eyebrow">المهمة: '+esc({attendance:"الحضور والغياب",hifz:"الحفظ الجديد",revision:"المراجعة والتثبيت",ward:"الورد اليومي",points:"إنجاز ونقاط",assignment:"تعيين مهمة للطالب",general:"متابعة شاملة"}[S.scanTaskType]||"غير محددة")+' · '+esc(S.scanDate||todayIso)+'</span><h3>'+esc(studentDisplayName(s.name||"طالب"))+'</h3><p>'+esc(s.group_name||"")+'</p></div><div class="student-actions"><button class="btn secondary" type="button" id="scan-open-profile">الملف الكامل</button><button class="btn secondary" type="button" id="scan-open-plans">خطط الطلاب واعتمادها</button></div></div>'
   +'<div class="stats"><div class="stat"><small>رصيد النقاط الموحد</small><strong>'+Number(t.balance??t.achievement??0)+'</strong></div></div>'
   +'<h4>خطته المعتمدة</h4>'+planChips
   +'<h4>تسجيل الحضور اليوم</h4><div class="student-actions" id="scan-attendance-buttons">'+attButtons+'</div>'
   +'<h4>تسجيل إنجاز اليوم (حفظ / تثبيت / ورد)</h4><div class="scan-quran-grid">'+quranQuick("hifz","الحفظ الجديد","",Array.from(new Set([info&&info.hifz_unit,"صفحة","سطر","آية","وجه"].filter(Boolean))),0,info?(info.hifz_unit||"صفحة"):"صفحة")+quranQuick("thabit","التثبيت",info?info.thabit_amount:"",["حزب","نصف حزب","ثلاثة أثمان حزب","ربع حزب","ثمن حزب"],15,info?thabitUnitFor(info.thabit_amount):"ربع حزب")+quranQuick("ward","الورد اليومي",info?info.ward_ahzab:"",["حزب","حزبان","أربعة أحزاب"],0,info?wardUnitFor(info.ward_ahzab):"حزب")+'</div>'
   +(canGrantPoints&&pointsTaskSelected?'<h4>منح النقاط</h4><p class="muted small">اختر النشاط الذي أنجزه الطالب، أو أدخل النقاط يدويًا. لا تُضاف النقاط بمجرد المسح؛ تُحفظ بعد اعتماد النشاط بنجاح.</p><div class="student-actions" id="scan-activity-buttons">'+activityButtons+'</div><div id="scan-activity-result" class="muted small" aria-live="polite"></div><form id="scan-manual-award" class="form-grid"><label class="field">عدد النقاط<input type="number" name="points" min="1" max="1000" value="10" required></label><label class="field full">سبب المنح<input name="reason" required minlength="3" maxlength="500" placeholder="مثال: حفظ ثمن دون أخطاء"></label><button class="btn" type="submit">اعتماد النقاط</button></form>':'<div class="notice">'+(canGrantPoints?'اختر «إنجاز ونقاط» في نوع المهمة قبل المسح لإظهار أدوات منح النقاط.':'منح النقاط غير متاح لهذا الدور.')+'</div>')+adminPointTools
   +assignTaskMarkup
   +'<h4>آخر العمليات على حساب الطالب</h4><div class="list">'+(eventRows||'<div class="empty">لا توجد عمليات بعد.</div>')+'</div>'
   +'</section>';
  const refresh=()=>renderScanPanel(v,studentId);
  host.querySelector("#scan-open-profile").onclick=()=>studentProfile(v,studentId);
  host.querySelector("#scan-open-plans").onclick=()=>{safeStore.setSession("ihsan_quran_staff_tab","plans");go("quran")};
  host.querySelectorAll("[data-scan-att]").forEach(btn=>btn.onclick=async()=>{
    btn.disabled=true;
    try{await api("/attendance",{method:"POST",body:JSON.stringify({group_id:s.group_id,date:todayIso,items:[{student_id:studentId,status:btn.dataset.scanAtt}]})});
      const label={present:"حاضر",absent:"غائب",late:"متأخر",excused:"بعذر"}[btn.dataset.scanAtt]||btn.dataset.scanAtt;
      toast("تم تسجيل الحضور: "+label);await refresh()}
    catch(error){btn.disabled=false;toast(error.message,true)}
  });
  host.querySelectorAll("[data-scan-quran]").forEach(form=>form.onsubmit=async event=>{
    event.preventDefault();
    const kind=form.dataset.scanQuran,button=form.querySelector('button[type="submit"]'),data=new FormData(form);
    button.disabled=true;
    try{const result=await api("/quran/daily",{method:"POST",body:JSON.stringify({student_id:studentId,kind,amount:Number(data.get("amount")),unit:data.get("unit"),repetitions:Number(data.get("repetitions")||0),notes:data.get("notes")||""})});
      const awarded=(result.awards||[]).find(a=>a.status==="awarded"&&a.kind==="achievement")?.points||0;
      toast("تم تسجيل "+({hifz:"الحفظ الجديد",thabit:"التثبيت",ward:"الورد"}[kind]||"الإنجاز")+(awarded?" — أُضيفت "+awarded+" نقطة":""));await refresh()}
    catch(error){button.disabled=false;toast(error.message,true)}
  });
  host.querySelectorAll("[data-scan-activity]").forEach(btn=>btn.onclick=async()=>{
    const activity=btn.dataset.scanActivity,resultHost=host.querySelector("#scan-activity-result");
    btn.disabled=true;
    try{
      const payload={student_id:studentId,activity,date:todayIso};
      if(activity==="support"){const base=Number(window.prompt("كم نقطة للإنجاز الذي قدّم فيه الطالب دعمًا؟"));if(!Number.isInteger(base)||base<1||base>1000)throw new Error("أدخل عدد نقاط صحيحًا بين 1 و1000");payload.base_points=base;}
      if(activity==="poetry")payload.request_id=(window.crypto&&crypto.randomUUID)?crypto.randomUUID():String(Date.now())+"-"+Math.random().toString(36).slice(2);
      const result=await api("/points/activity",{method:"POST",body:JSON.stringify(payload)});
      const first=(result.awards||[]).find(a=>a.kind==="achievement")||result.awards?.[0];const parts=first?[first.status==="awarded"?"+"+first.points+" نقطة":first.status==="duplicate"?"مكررة اليوم (لم تُمنح مرتين)":"بلغ الحد اليومي"]:["لا توجد قاعدة نقاط نشطة لهذا النشاط"];
      if(resultHost)resultHost.textContent="النتيجة: "+parts.join(" · ");
      toast("تم — "+parts.join(" · "));await refresh()}
    catch(error){btn.disabled=false;if(resultHost)resultHost.textContent="تعذر المنح: "+error.message;toast(error.message,true)}
  });
  const streakForm=host.querySelector("#scan-streak-form");
  if(streakForm)streakForm.onsubmit=async event=>{event.preventDefault();const data=new FormData(streakForm),button=streakForm.querySelector("button");button.disabled=true;try{const result=await api("/points/streak",{method:"POST",body:JSON.stringify({student_id:studentId,activity:data.get("activity"),base_points:Number(data.get("base_points")),date:todayIso})});toast(result.bonus?"مكافأة الاستمرارية: +"+result.bonus+" نقطة":"سُجّل اليوم · السلسلة "+result.days+" أيام");await refresh()}catch(error){toast(error.message,true);button.disabled=false}};
  const ethicsForm=host.querySelector("#scan-ethics-form");
  if(ethicsForm)ethicsForm.onsubmit=async event=>{event.preventDefault();const data=new FormData(ethicsForm),button=ethicsForm.querySelector("button");button.disabled=true;try{await api("/points/ethics",{method:"POST",body:JSON.stringify({student_id:studentId,action:data.get("action"),reason:data.get("reason"),deduction_points:Number(data.get("deduction_points")||0)})});toast("تم اعتماد سجل الأخلاق");await refresh()}catch(error){toast(error.message,true);button.disabled=false}};
  const referralForm=host.querySelector("#scan-referral-form");
  if(referralForm)referralForm.onsubmit=async event=>{event.preventDefault();const data=new FormData(referralForm),button=referralForm.querySelector("button");button.disabled=true;try{await api("/points/referrals",{method:"POST",body:JSON.stringify({inviter_student_id:studentId,invited_student_id:data.get("invited_student_id")})});toast("سُجلت الإحالة؛ تُعتمد مكافأتها بعد أسبوع من الثبات");await refresh()}catch(error){toast(error.message,true);button.disabled=false}};
  host.querySelectorAll("[data-referral-confirm]").forEach(button=>button.onclick=async()=>{button.disabled=true;try{const result=await api("/points/referrals/"+encodeURIComponent(button.dataset.referralConfirm)+"/confirm",{method:"POST",body:"{}"});toast("اعتمدت مكافأة الإحالة: "+result.points+" نقطة");await refresh()}catch(error){toast(error.message,true);button.disabled=false}});
  const assignForm=host.querySelector("#scan-assign-task");
  if(assignForm)assignForm.addEventListener("submit",async event=>{
    event.preventDefault();
    const button=assignForm.querySelector('button[type="submit"]'),data=new FormData(assignForm);
    button.disabled=true;
    try{await api("/messages",{method:"POST",body:JSON.stringify({recipient_user_id:recipientUserId,title:String(data.get("title")||"").trim(),content:String(data.get("content")||"").trim()})});
      toast("وصلت المهمة إلى الطالب في رسائله");assignForm.reset()}
    catch(error){toast(error.message,true)}finally{button.disabled=false}
  });
  const manualForm=host.querySelector("#scan-manual-award");
  if(manualForm)manualForm.addEventListener("submit",async event=>{
    event.preventDefault();if(manualForm.dataset.submitting==="1")return;
    const button=manualForm.querySelector('button[type="submit"]'),data=new FormData(manualForm);
    manualForm.dataset.submitting="1";button.disabled=true;
    try{const payload={student_id:studentId,points:Number(data.get("points")||0),reason:String(data.get("reason")||"").trim()};await api("/points/award",{method:"POST",body:JSON.stringify({...payload,request_id:idempotentFormRequestId(manualForm,payload)})});
      toast("تم منح النقاط وتحديث الرصيد");await refresh();delete manualForm.dataset.idempotencyKey;delete manualForm.dataset.idempotencyPayload}
    catch(error){button.disabled=false;toast(error.message,true)}
    finally{manualForm.dataset.submitting="0"}
  });
}

async function guidePage(v){
 let rules=[];
 try{rules=await api("/points/rules")}catch(error){rules=[]}
 const ruleRows=rules.map(rule=>'<tr><td><strong>'+esc(rule.name)+'</strong><br><small class="muted">'+esc(rule.description||rule.event_type)+'</small></td><td>'+Number(rule.achievement_points||rule.store_points||0)+'</td><td>'+(rule.max_per_day?"مرة كل يوم":"—")+'</td></tr>').join("");
 const readingRule=rules.find(rule=>rule.event_type==="quran_reading");
 const readingPoints=Number(readingRule?.achievement_points||5),readingStore=Number(readingRule?.store_points||2);
 const stageRows=WORLD_STAGES.map((item,index)=>'<tr><td><strong>'+esc(item.name)+'</strong><br><small class="muted">'+esc(item.title)+'</small></td><td>'+Number(item.min)+'</td><td>'+esc(item.line)+'</td></tr>').join("");
 const steps=[
  ["01","احضر حلقتك","سجّل حضورك مع الشيخ؛ المواظبة أول رصيد يبنيه عالمك.","attendance"],
  ["02","احفظ وراجع","سجّل الحفظ والمراجعة اليومية؛ ٣٥٪ من ترتيبك من القرآن.","quran"],
  ["03","أتمّ واجبك","سلّم الواجب في وقته؛ الإتقان يمنحك نقاطًا أعلى.","assignments"],
  ["04","اختبر نفسك","الاختبارات تقيس الفهم، و٣٠٪ من ترتيبك من إتقانها.","tests"],
  ["05","سجّل قراءتك","ورد يومي يمنحك "+readingPoints+" نقاط إنجاز و"+readingStore+" رصيد متجر، مرة واحدة يوميًا.","world"],
  ["06","استلم تحديك","تحدي اليوم يمنحك دفعة إضافية ويحفظ سلسلتك.","world"]
 ];
 const stepCards=steps.map(step=>'<button type="button" class="guide-step" data-guide-go="'+esc(step[3])+'"><span class="guide-step-number">'+step[0]+'</span><strong>'+esc(step[1])+'</strong><p>'+esc(step[2])+'</p><span class="guide-step-link">افتح ›</span></button>').join("");
 v.innerHTML='<div class="guide-page">'+
  '<section class="guide-hero"><span class="eyebrow">دليل الرحلة · بأرقام واضحة</span><h2>كيف تنمو في عالم الإحسان؟</h2><p>في كل يوم، اقرأ هذه الجملة كاملة: <strong>احضر حلقتك، واحفظ وراجع وردك، وأتمّ واجبك، واختبر نفسك، وسجّل قراءتك، واستلم تحديك؛ فكل خطوة تُضاف إلى نقاط إنجازك وترتيبك ورصيد متجرك.</strong></p><div class="guide-hero-stats"><span><strong>6</strong> خطوات يومية</span><span><strong>25/35/30/10</strong> وزن الترتيب</span><span><strong>6</strong> مراتب للعالم</span></div></section>'+
  '<section class="card guide-steps-section"><div class="section-head"><div><span class="eyebrow">دورة النمو</span><h3>ست خطوات، ثم تتحرك مرتبتك</h3><p>اضغط أي خطوة لتنتقل إلى مكان تنفيذها مباشرة.</p></div></div><div class="guide-steps">'+stepCards+'</div></section>'+
  '<section class="card"><div class="section-head"><div><span class="eyebrow">من أين تأتي النقاط؟</span><h3>قواعد النقاط المعتمدة</h3><p>القيم تُدار من الأكاديمية وليست ثابتة في الكود؛ تُحدّث من لوحة المدير.</p></div></div><div class="table-wrap"><table><thead><tr><th>القاعدة</th><th>النقاط</th><th>السقف</th></tr></thead><tbody>'+(ruleRows||'<tr><td colspan="3">ستظهر القواعد بعد تهيئة الاقتصاد التعليمي في حسابك.</td></tr>')+'</tbody></table></div><div class="notice"><strong>رصيد واحد:</strong> جميع الإنجازات تضيف إلى الرصيد نفسه، وتُستخدم النقاط نفسها في المتجر. كل حركة مسجّلة، والتصحيح بعكس موثّق بسبب.</div></section>'+
  '<div class="guide-grid"><section class="card"><div class="section-head"><div><span class="eyebrow">الترتيب</span><h3>كيف يُحسب ترتيب الفوج؟</h3></div></div><div class="guide-formula"><div><strong>25٪</strong><span>المواظبة والحضور</span></div><div><strong>35٪</strong><span>الحفظ والمراجعة</span></div><div><strong>30٪</strong><span>إتقان الاختبارات</span></div><div><strong>10٪</strong><span>التحديات اليومية</span></div></div><p class="muted small">الترتيب تحفيزي لا يقيس قيمة الطالب، ولا يستبدل تقييم الشيخ لجودة الحفظ والتجويد والفهم.</p></section>'+
  '<section class="card"><div class="section-head"><div><span class="eyebrow">منهج السلوك</span><h3>قواعد الإحسان</h3></div></div><ul class="guide-rules"><li>لا تُمنح النقاط اليدوية ولا الخصومات ولا التنبيهات إلا باعتماد الشيخ.</li><li>بعد ثلاثة تنبيهات يتوقف امتياز المضاعفة، ويبدأ الخصم الذي يحدده الشيخ من التنبيه الرابع.</li><li>الحرمان النهائي من المضاعفة لا يُعاد، ولا تمحى محفوظات القرآن أو الإنجازات الموثقة.</li><li>كل إنجاز يُحتسب مرة واحدة، والتصحيح يكون بعكس موثّق بسبب لا بحذف التاريخ.</li></ul></section></div>'+
  '<section class="card"><div class="section-head"><div><span class="eyebrow">مراتب العالم</span><h3>من البذرة إلى المحراب</h3><p>المرتبة تُفتح برصيد النقاط المتراكمة، لا بالوقت وحده.</p></div></div><div class="table-wrap"><table><thead><tr><th>المرتبة</th><th>تبدأ من</th><th>معناها</th></tr></thead><tbody>'+stageRows+'</tbody></table></div></section>'+
  '<div class="guide-actions"><button class="btn" type="button" data-guide-go="world">العودة إلى عالمي</button><button class="btn secondary" type="button" data-guide-go="card">بطاقتي</button><button class="btn secondary" type="button" data-guide-go="tasks">مهامي</button></div>'+
  '</div>';
 v.querySelectorAll("[data-guide-go]").forEach(btn=>btn.onclick=()=>go(btn.dataset.guideGo));
}

// ---- طلبات الانضمام: لوحة الاعتماد للشيخ/المسؤول المخوّل ----
async function joinRequestsPage(v){
 if(!["admin","teacher","director"].includes(S.user.role)){v.innerHTML=head("طلبات الانضمام","هذه الصفحة متاحة للشيخ أو للمسؤول المخوّل فقط.");return}
 let status="pending";
 const canReviewKind=r=>S.user.role!=="teacher"||r.kind==="school_join";
 const groupsCache={};
 const groupsFor=async schoolId=>{if(!schoolId)return [];if(!groupsCache[schoolId]){try{groupsCache[schoolId]=await api("/join/assignable-groups?school_id="+encodeURIComponent(schoolId))}catch{groupsCache[schoolId]=[]}}return groupsCache[schoolId]};
 const render=async()=>{
  let requests=[];
  try{requests=await api("/join/requests?status="+encodeURIComponent(status))}catch(error){v.innerHTML=head("طلبات الانضمام","تعذر تحميل الطلبات.")+'<div class="notice error">'+esc(error.message)+'</div>';return}
  const schoolReqs=requests.filter(r=>r.kind==="school_join"),teacherReqs=requests.filter(r=>r.kind==="teacher_request");
  const schoolGroups={};for(const r of schoolReqs)if(r.school_id&&!(r.school_id in schoolGroups))schoolGroups[r.school_id]=await groupsFor(r.school_id);
  const kindLabel={school_join:"انضمام طالب إلى المدرسة",teacher_request:"انضمام بصفة شيخ/معلم"};
  const statusLabel={pending:"قيد الاعتماد",approved:"معتمد",rejected:"مرفوض",cancelled:"ملغى"};
  const rowHtml=(r)=>{
   const decided=r.status!=="pending";
   const title='<strong>'+esc(r.user_name||"—")+'</strong><small>'+esc(r.user_email||"")+' · '+esc(kindLabel[r.kind]||r.kind)+(r.school_name?' · '+esc(r.school_name):"")+' · '+esc(pointsDate(r.created_at))+'</small>'+(r.requested_note?'<small>ملاحظة: '+esc(r.requested_note)+'</small>':"")+(decided?'<small>القرار: '+esc(statusLabel[r.status]||r.status)+(r.decision_note?' — '+esc(r.decision_note):"")+'</small>':"");
   if(decided)return '<div class="list-row"><div>'+title+'</div><span class="pill">'+esc(statusLabel[r.status]||r.status)+'</span></div>';
   if(!canReviewKind(r))return '<div class="list-row"><div>'+title+'</div><div class="muted small">الاعتماد من اختصاص المدير أو الإدارة فقط</div></div>';
   let controls='';
   if(r.kind==="school_join"){
    const options=(schoolGroups[r.school_id]||[]).map(g=>'<option value="'+esc(g.id)+'">'+esc(g.name)+'</option>').join("");
    controls='<label class="field">الفوج<select data-join-group="'+esc(r.id)+'"><option value="">اختر الفوج…</option>'+options+'</select></label>';
   }
   controls+='<label class="field">ملاحظة القرار (اختياري)<input data-join-note="'+esc(r.id)+'" maxlength="500" placeholder="'+(r.kind==="teacher_request"?"مثال: اعتماد طلبك بصفة شيخ بعد التحقق":"مثال: اعتمادك في فوج الشيخ جابر")+'"></label>';
   controls+='<div class="student-actions"><button class="btn" type="button" data-join-approve="'+esc(r.id)+'" data-join-kind="'+esc(r.kind)+'">اعتماد</button><button class="btn danger" type="button" data-join-reject="'+esc(r.id)+'">رفض</button></div>';
   return '<div class="list-row join-request-row"><div>'+title+'</div><div class="join-request-controls">'+controls+'</div></div>';
  };
  let html=head("طلبات الانضمام","راجع طلبات الطلاب الجدد والراغبين في التدريس. لا يُعتمد أي طلب إلا بموافقة صريحة منك، وإسناد الفوج إلزامي عند اعتماد طالب.")
   +'<div class="quran-staff-switch">'+[["pending","قيد الاعتماد"],["approved","المعتمدة"],["rejected","المرفوضة"],["cancelled","الملغاة"]].map(([id,label])=>'<button type="button" class="btn secondary '+(status===id?"is-active":"")+'" data-join-status="'+id+'">'+label+'</button>').join("")+'</div>';
  html+='<section class="card"><h3>طلبات الطلاب ('+schoolReqs.length+')</h3><div class="list">'+(schoolReqs.length?schoolReqs.map(rowHtml).join(""):'<div class="empty">لا توجد طلبات طلاب في هذه الحالة.</div>')+'</div></section>';
  html+='<section class="card"><h3>طلبات المشايخ والمعلمين ('+teacherReqs.length+')</h3><div class="list">'+(teacherReqs.length?teacherReqs.map(rowHtml).join(""):'<div class="empty">لا توجد طلبات مشاعل أو معلمين في هذه الحالة.</div>')+'</div></section>';
  v.innerHTML=html;
  v.querySelectorAll("[data-join-status]").forEach(btn=>btn.onclick=()=>{status=btn.dataset.joinStatus;render()});
  const decide=async(id,decision)=>{
   const row=requests.find(r=>r.id===id);if(!row)return;
   const body={decision,decision_note:(v.querySelector('[data-join-note="'+CSS.escape(id)+'"]')?.value||"").trim()};
   if(decision==="approved"&&row.kind==="school_join"){
    const groupId=v.querySelector('[data-join-group="'+CSS.escape(id)+'"]')?.value||"";
    if(!groupId){toast("اختر الفوج الذي سيُسند إليه الطالب قبل الاعتماد",true);return}
    body.group_id=groupId;
   }
   try{await api("/join/requests/"+encodeURIComponent(id)+"/decision",{method:"POST",body:JSON.stringify(body)});toast(decision==="approved"?"تم الاعتماد":"تم الرفض");await render()}catch(error){toast(error.message,true)}
  };
  v.querySelectorAll("[data-join-approve]").forEach(btn=>btn.onclick=()=>decide(btn.dataset.joinApprove,"approved"));
  v.querySelectorAll("[data-join-reject]").forEach(btn=>btn.onclick=()=>decide(btn.dataset.joinReject,"rejected"));
 };
 await render();
}

// ---- طلب الانضمام الظاهر للطالب غير المُسند وللزائر/المحسن ----
function myJoinRequestsHtml(requests){
 const kindLabel={school_join:"انضمام طالب",teacher_request:"بصفة شيخ/معلم"};
 const statusLabel={pending:"قيد الاعتماد",approved:"معتمد",rejected:"مرفوض",cancelled:"ملغى"};
 if(!requests.length)return '<div class="empty">لا توجد طلبات بعد.</div>';
 return '<div class="list">'+requests.map(r=>'<div class="list-row"><div><strong>'+esc(kindLabel[r.kind]||r.kind)+(r.school_name?' · '+esc(r.school_name):"")+'</strong><small>'+esc(pointsDate(r.created_at))+(r.requested_note?' · '+esc(r.requested_note):"")+(r.decision_note?' · رد الإدارة: '+esc(r.decision_note):"")+'</small></div><div class="student-actions"><span class="pill">'+esc(statusLabel[r.status]||r.status)+'</span>'+(r.status==="pending"?'<button class="btn danger sm" type="button" data-join-cancel="'+esc(r.id)+'">إلغاء الطلب</button>':"")+'</div></div>').join("")+'</div>';
}
async function wireJoinCancels(v,onDone){
 v.querySelectorAll("[data-join-cancel]").forEach(btn=>btn.onclick=async()=>{btn.disabled=true;try{await api("/join/requests/"+encodeURIComponent(btn.dataset.joinCancel)+"/cancel",{method:"POST",body:"{}"});toast("أُلغي الطلب");if(onDone)await onDone()}catch(error){btn.disabled=false;toast(error.message,true)}});
}
async function joinSectionHtml(opts){
 // opts: {showTeacher:boolean}
 let requests=[];try{requests=await api("/join/my-requests")}catch{requests=[]}
 const pendingSchool=requests.find(r=>r.kind==="school_join"&&r.status==="pending");
 const pendingTeacher=requests.find(r=>r.kind==="teacher_request"&&r.status==="pending");
 let html='<section class="card"><div class="section-head"><div><span class="eyebrow">الانضمام</span><h3>طلب الانضمام إلى المدرسة أو كمعلم</h3><p>يُعتمد طلبك من الشيخ أو من الإدارة المختصة، ولا تتغير صلاحياتك قبل الاعتماد.</p></div></div>'+myJoinRequestsHtml(requests);
 if(!pendingSchool){
  let schools=[];try{const d=await api("/public/signup-options");schools=(d&&d.schools)||[]}catch{}
  html+='<form id="join-school-form" class="form-grid"><label class="field">المدرسة<select name="school_id" required><option value="">اختر المدرسة…</option>'+schools.map(s=>'<option value="'+esc(s.id)+'">'+esc(s.name)+'</option>').join("")+'</select></label><label class="field">ملاحظة (اختياري)<input name="note" maxlength="500" placeholder="مثال: أحفظ ثلاثة أجزاء"></label><div class="wide"><button class="btn" type="submit">قدّم طلب انضمام كطالب</button></div></form>';
 }
 if(opts.showTeacher&&!pendingTeacher){html+='<form id="join-teacher-form" class="form-grid"><label class="field wide">ملاحظة لطلب الانضمام بصفة شيخ/معلم (اختياري)<input name="note" maxlength="500" placeholder="مثال: حافظ لكتاب الله، وخبرة في تعليم الناشئة"></label><div class="wide"><button class="btn secondary" type="submit">طلب الانضمام بصفة شيخ/معلم</button></div></form>'}
 html+='</section>';
 return {html,requests};
}
async function wireJoinForms(v,onDone){
 const submitForm=(formId,kind)=>{const form=v.querySelector(formId);if(!form)return;form.addEventListener("submit",async event=>{event.preventDefault();const button=form.querySelector('button[type="submit"]'),data=new FormData(form);button.disabled=true;try{await api("/join/requests",{method:"POST",body:JSON.stringify({kind,school_id:String(data.get("school_id")||""),note:String(data.get("note")||"")})});toast("أُضيف طلبك وهو قيد الاعتماد");if(onDone)await onDone()}catch(error){button.disabled=false;toast(error.message,true)}})};
 submitForm("#join-school-form","school_join");
 submitForm("#join-teacher-form","teacher_request");
 await wireJoinCancels(v,onDone);
}
async function visitorHome(v){
 const section=await joinSectionHtml({showTeacher:true});
 let html=head("مرحبًا بك في أكاديمية الإحسان","حساب زائر/محسن: تستطيع التعرف على الأكاديمية والمساهمة في دعمها، ولا تملك الوصول إلى بيانات الطلاب أو الأفواج.")
 +'<section class="card"><h3>عن الأكاديمية</h3><p>مساحة علمية قرآنية تجمع حفظ القرآن ومراجعته وفهمه، وتعلّم الحديث والسيرة والآداب، وصحبة الصالحين؛ تُدار اليوم عبر «مدرسة الرحمان القرآنية»، ولدَيها فوجان ولله الحمد.</p><div class="student-actions"><a class="btn secondary" href="'+esc(TAYSIR_URL)+'" rel="noopener" target="_blank">بوابة التيسير — التعريف العام بالأكاديمية</a></div></section>'
 +'<section class="card"><h3>كيف تساهم في دعم الأكاديمية؟</h3><ul class="visitor-ways"><li><strong>دعم مالي أو عيني:</strong> المصاحف، الجوائز، كفالة طالب علم أو حلقة — بالاتفاق مع إدارة المدرسة.</li><li><strong>تطوع بوقتك وعلمك:</strong> دروس، تعليم تجويد، تصحيح لوحات، إدارة فعاليات.</li><li><strong>نشر الخير:</strong> تعريف الناس ببرامج المدرسة عبر بوابة التيسير وموادها.</li></ul><p class="muted small">للمساهمة الفعلية يُفضَّل التواصل مع إدارة المدرسة من خلال الإدارة، أو إنشاء حساب وطلب دورك المناسب من الزر أدناه.</p></section>'
 +section.html;
 v.innerHTML=html;
 await wireJoinForms(v,()=>visitorHome(v));
}
async function pendingStudentHome(v){
 const section=await joinSectionHtml({showTeacher:false});
 let html=head("طلب انضمامك إلى المدرسة","أنت مسجّل بلا فوج بعد؛ يبقى طلبك قيد الاعتماد حتى يوافق الشيخ أو الإدارة المختصة، ثم تُسند إلى فوجك.")
 +'<section class="card"><h3>لماذا لا أرى مهامي بعد؟</h3><p>حفاظًا على خصوصية الطلاب لا تُفتح أي بيانات أو مهام قبل اعتماد طلبك وإسنادك إلى فوج. فور الاعتماد ستظهر لك مهامك وخطتك وتقدّمك في حسابك مباشرة.</p></section>'
 +section.html;
 v.innerHTML=html;
 await wireJoinForms(v,()=>pendingStudentHome(v));
}
async function home(v){
if(S.user?.role==="visitor")return visitorHome(v);
if(S.user?.role==="student"&&!S.user?.group_id)return pendingStudentHome(v);
const d=await api("/dashboard");let html="";
if(S.user.role!=="student"){
  const studentLabel=S.user.role==="director"?"طلاب المدرسة":"الطلاب";
  const visibleGroups=["teacher","director","supervisor"].includes(S.user.role)?assignedGroups():S.groups;
  const visibleStudents=["teacher","director","supervisor"].includes(S.user.role)?S.students.filter(st=>visibleGroups.some(g=>String(g.id)===String(st.group_id))):S.students;
 const attendanceStat=["admin","director","teacher"].includes(S.user.role)?"":'<button type="button" class="stat stat-link" data-go="attendance"><span class="stat-icon" aria-hidden="true">'+navIcon("attendance")+'</span><small>معاينة الحضور الأسبوعي</small><strong>'+(d.attendance_marked??0)+'</strong></button>';
 html+='<div class="stats"><button type="button" class="stat stat-link" data-go="students"><span class="stat-icon" aria-hidden="true">'+navIcon("students")+'</span><small>'+studentLabel+'</small><strong>'+(S.studentsLoadError?"—":visibleStudents.length)+'</strong></button><button type="button" class="stat stat-link" data-go="groups"><span class="stat-icon" aria-hidden="true">'+navIcon("groups")+'</span><small>الأفواج</small><strong>'+visibleGroups.length+'</strong></button>'+attendanceStat+'</div>';

} else {
 const result=await Promise.allSettled([api("/quran/progress"),api("/attendance?history=1"),api("/tests"),api("/leaderboard"),api("/gamification"),api("/assignments")]);
 const quranRows=result[0].status==="fulfilled"?result[0].value:[];
 const attendanceRows=result[1].status==="fulfilled"?result[1].value:[];
 const tests=result[2].status==="fulfilled"?result[2].value:[];
 const board=result[3].status==="fulfilled"?result[3].value:[];
 const gam=result[4].status==="fulfilled"?result[4].value:null;
 const assignments=result[5].status==="fulfilled"?result[5].value:[];
 const me=board.find(x=>x.is_self);
 const today=S.date;
 const qToday=quranRows.find(x=>x.date===today);
 const todayAttendance=attendanceRows.find(x=>x.date===today);
 const unanswered=tests.filter(t=>!t.my_attempt).length;
 html+='<div class="student-dashboard">'+(gam?'<section class="card achievement-card"><h3>إنجازك اليوم</h3><p>النقاط: <strong>'+Number(gam.points||0)+'</strong> · أيام التقدم في القرآن: <strong>'+Number(gam.stats?.quran_days||0)+'</strong> · الاختبارات: <strong>'+Number(gam.stats?.tests||0)+'</strong></p><p>تحدي اليوم: '+esc(gam.daily_challenge?.title||'ورد اليوم')+' — '+esc(gam.daily_challenge?.description||'اقرأ وردك وراجعه بإتقان.')+'</p><p class="muted small">'+(gam.badges||[]).map(b=>esc(b.name)).join(' · ')+'</p>'+(gam.challenge_claimed?'<p class="notice">استلمت مكافأة اليوم بالفعل.</p>':'<button class="btn" data-claim-challenge="'+esc(gam.daily_challenge?.id||"daily-quran")+'">استلام مكافأة التحدي</button>')+'</section>': '')+'<div class="card student-welcome"><div class="eyebrow">خطوتك اليوم</div><h3>﴿ وَقُلْ رَبِّ زِدْنِي عِلْمًا ﴾</h3><p>اختر مهمة صغيرة، أنجزها بإتقان، ثم سجّل تقدمك. الاستمرار أهم من كثرة البداية.</p><div class="student-actions"><button class="btn" data-go="quran">الحفظ والمراجعة</button><button class="btn secondary" data-go="tests">ابدأ اختبارًا</button></div></div><div class="stats"><div class="stat"><small>متابعات القرآن</small><strong>'+quranRows.length+'</strong></div><div class="stat"><small>سجلات الحضور</small><strong>'+attendanceRows.length+'</strong></div><div class="stat"><small>اختبارات متاحة</small><strong>'+tests.length+'</strong></div><div class="stat"><small>واجبات غير منجزة</small><strong>'+assignments.filter(a=>!a.my_submission||a.my_submission.status!=="reviewed").length+'</strong></div><div class="stat"><small>ترتيب فوجك</small><strong>'+(me?"#"+me.rank:"—")+'</strong></div></div><section class="card path-cards-section"><div class="section-head"><div><h3>مساراتك وبطاقات تقدمك</h3><p>اختر الخطوة التالية، وتابع تقدمك دون مقارنة جائرة بغيرك.</p></div></div><div class="path-cards"><button class="path-card" data-go="quran"><span class="path-icon">۞</span><strong>مسار القرآن</strong><small>'+(gam?.plan?esc(({starter:"المسار التمهيدي","15":"ختمة 15 يومًا","30":"ختمة 30 يومًا","45":"ختمة 45 يومًا",khatma:"الختمة الكاملة"}[gam.plan.path_id]||"خطة القرآن")):"اختر مسار ختمتك")+'</small><span class="path-meter"><i style="width:'+Math.min(100,quranRows.length*5)+'%"></i></span><small>'+quranRows.length+' متابعة مسجلة</small></button><button class="path-card" data-go="tests"><span class="path-icon">✧</span><strong>الاختبارات</strong><small>تعلّم، اختبر، ثم راجع أخطاءك</small><span class="path-meter"><i style="width:'+Math.min(100,tests.length?tests.filter(t=>t.my_attempt).length/tests.length*100:0)+'%"></i></span><small>'+tests.filter(t=>t.my_attempt).length+' من '+tests.length+' مكتمل</small></button><button class="path-card" data-go="assignments"><span class="path-icon">✓</span><strong>واجباتي</strong><small>اطلع على التكليفات وسلّم إجابتك وتابع ملاحظات المعلم</small><span class="path-meter"><i style="width:'+Math.min(100,assignments.length?assignments.filter(a=>a.my_submission&&a.my_submission.status==="reviewed").length/assignments.length*100:0)+'%"></i></span><small>'+assignments.filter(a=>a.my_submission&&a.my_submission.status==="reviewed").length+' من '+assignments.length+' تمت مراجعتها</small></button><button class="path-card" data-open-ihsan><span class="path-icon">'+navIcon("allah")+'</span><strong>تخصصات العلم</strong><small>الله تعالى، الرسول ﷺ، القرآن، السنة، الأدب والعمل</small><span class="path-link">استكشف المسارات ←</span></button></div></section><div class="card"><h3>اقتراح اليوم</h3><p>'+(qToday?'سُجّلت متابعة قرآن اليوم. أحسنت، راجع ما حفظته وثبّته.':"راجع وردك من القرآن، واطلب من معلمك تسجيل الحفظ والمراجعة عند التسميع.")+'</p><p>'+(todayAttendance?'حضور اليوم مسجّل: '+esc(({"present":"حاضر","absent":"غائب","late":"متأخر","excused":"بعذر"}[todayAttendance.status]||todayAttendance.status))+'.':"تحقق من سجل حضورك بعد انتهاء الحلقة.")+'</p><p>'+(unanswered?'لديك '+unanswered+' اختبار/اختبارات لم ترسلها بعد.':'راجع نتائج اختباراتك السابقة إن وُجدت.')+'</p><button class="btn secondary" data-go="profile">عرض ملفي وتقدّمي</button></div></div>';
}
const daySeed=Math.floor(Math.random()*1000000);
const dailySupplications=[
{title:"دعاء من القرآن",text:"وَقُلْ رَبِّ زِدْنِي عِلْمًا",source:"سورة طه: 114"},
{title:"دعاء من القرآن",text:"رَبِّ اشْرَحْ لِي صَدْرِي ۝ وَيَسِّرْ لِي أَمْرِي",source:"سورة طه: 25–26"},
{title:"دعاء من القرآن",text:"رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ",source:"سورة البقرة: 201"},
{title:"دعاء من القرآن",text:"رَبَّنَا لَا تُزِغْ قُلُوبَنَا بَعْدَ إِذْ هَدَيْتَنَا وَهَبْ لَنَا مِنْ لَدُنْكَ رَحْمَةً إِنَّكَ أَنْتَ الْوَهَّابُ",source:"سورة آل عمران: 8"},
{title:"دعاء من القرآن",text:"رَبَّنَا تَقَبَّلْ مِنَّا إِنَّكَ أَنْتَ السَّمِيعُ الْعَلِيمُ",source:"سورة البقرة: 127"},
{title:"دعاء من القرآن",text:"رَبَّنَا أَفْرِغْ عَلَيْنَا صَبْرًا وَثَبِّتْ أَقْدَامَنَا",source:"سورة البقرة: 250"},
{title:"دعاء من القرآن",text:"رَبَّنَا ظَلَمْنَا أَنْفُسَنَا وَإِنْ لَمْ تَغْفِرْ لَنَا وَتَرْحَمْنَا لَنَكُونَنَّ مِنَ الْخَاسِرِينَ",source:"سورة الأعراف: 23"},
{title:"دعاء من القرآن",text:"رَبِّ اجْعَلْنِي مُقِيمَ الصَّلَاةِ وَمِنْ ذُرِّيَّتِي رَبَّنَا وَتَقَبَّلْ دُعَاءِ",source:"سورة إبراهيم: 40"},
{title:"دعاء نبوي",text:"اللَّهُمَّ أَعِنِّي عَلَى ذِكْرِكَ وَشُكْرِكَ وَحُسْنِ عِبَادَتِكَ",source:"سنن أبي داود (1522)، والنسائي (1303)"},
{title:"دعاء نبوي",text:"اللَّهُمَّ إِنِّي أَسْأَلُكَ الْهُدَى وَالتُّقَى وَالْعَفَافَ وَالْغِنَى",source:"صحيح مسلم (2721)"},
{title:"دعاء نبوي",text:"اللَّهُمَّ إِنِّي أَسْأَلُكَ عِلْمًا نَافِعًا، وَرِزْقًا طَيِّبًا، وَعَمَلًا مُتَقَبَّلًا",source:"سنن ابن ماجه (925)"},
{title:"دعاء نبوي",text:"يَا مُقَلِّبَ الْقُلُوبِ، ثَبِّتْ قَلْبِي عَلَى دِينِكَ",source:"جامع الترمذي (2140)، حديث حسن"},
{title:"دعاء نبوي",text:"اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْهَمِّ وَالْحَزَنِ، وَالْعَجْزِ وَالْكَسَلِ",source:"صحيح البخاري (6369)"},
{title:"دعاء نبوي",text:"اللَّهُمَّ إِنِّي أَسْأَلُكَ الْعَفْوَ وَالْعَافِيَةَ فِي الدُّنْيَا وَالْآخِرَةِ",source:"سنن أبي داود (5074)، وسنن ابن ماجه (3871)"}
];
const dailyWisdom=[
{title:"من أدب موسى عليه السلام في طلب العلم",text:"طلب موسى عليه السلام الإذن من الخضر بأدب فقال: ﴿هَلْ أَتَّبِعُكَ عَلَى أَنْ تُعَلِّمَنِ مِمَّا عُلِّمْتَ رُشْدًا﴾؛ جمع السؤال بين التواضع ووضوح المقصد.",source:"القرآن الكريم، سورة الكهف: 66."},
{title:"من آثار العلماء في توقير المعلّم",text:"ورد في «جامع بيان العلم وفضله» أن ابن عباس رضي الله عنهما أخذ بركاب زيد بن ثابت توقيرًا له، فقال زيد: خلِّ عنه يا ابن عم رسول الله، فقال ابن عباس: «هكذا يُفعل بالعلماء والكبراء». يُذكر هنا أثرًا في آداب العلم، لا حديثًا نبويًا.",source:"ابن عبد البر، جامع بيان العلم وفضله، باب جامع في آداب العالم والمتعلم؛ أثر مروي في آداب العلماء."},
{title:"قاعدة في أدب الطالب",text:"يؤكد الشيخ بكر أبو زيد في «حلية طالب العلم» حسن الاستماع والسؤال، وترك مقاطعة الشيخ. يظهر توقير المعلّم في الإصغاء، والسؤال الهادئ، والعمل بما يُفهم من العلم.",source:"بكر بن عبد الله أبو زيد، حلية طالب العلم، فصل «أدب الطالب مع شيخه»."},
{title:"قطيفة في مراجعة القرآن",text:"سمّع ما حفظت قبل زيادة الجديد، واجعل للمراجعة وردًا ثابتًا؛ فالمحفوظ يُصان بالتعاهد."},
{title:"فائدة في التثبت",text:"لا تنشر حديثًا أو أثرًا لمجرد اشتهاره؛ تحقّق من لفظه ومصدره ودرجته قبل نسبته إلى النبي ﷺ أو العلماء."},
{title:"مدحٌ يربّي",text:"إذا أحسن زميلك فاذكر ما أتقنه بصدق: أحسنت مراجعتك، أو ثبتّ بعد صعوبة. لا تبالغ في الثناء ولا تنتقص من غيره."},
{title:"الاجتهاد عند الخطأ",text:"إذا أخطأت فلا تخجل من الرجوع إلى الصواب؛ اقبل التصحيح، وأعد المحاولة، واسأل حتى تفهم."},
{title:"أدب مجلس القرآن",text:"أكرم مجلس القرآن بالإنصات وحسن الجلسة، وصُن لسانك عن العبث؛ واجعل أثر التلاوة ظاهرًا في خلقك وأمانتك."},
{title:"فائدة في الصحبة",text:"أعِن زميلك على الخير، واستر زلّته، وافرَح بتقدّمه؛ فالمنافسة المحمودة ترفع الهمة ولا تنتقص من قدر أحد."},
{title:"التثبت من العلم",text:"اكتب الفائدة مع مصدرها، وميّز بين الآية والحديث وكلام العلماء واجتهادك الشخصي؛ فالأمانة أصل من أصول طلب العلم."},
{title:"فائدة في الانضباط",text:"احضر في الوقت، وأتمّ واجبك، واحفظ حق زملائك في الهدوء؛ فاحترام النظام من احترام مجلس العلم."},
{title:"التواضع في الطلب",text:"لا تحتقر مبتدئًا، ولا تجعل سبقك سببًا للتعالي؛ اشكر الله على ما تعلمت واسأل عمّا خفي عليك."},
{title:"الشكر العملي",text:"اشكر الله تعالى على نعمة القرآن والمعلم والصحبة الصالحة، واجعل شكرها بالمحافظة عليها والعمل بما تعلمت."}
];
const dailyWisdomForSheikh=[
{title:"بشارة لمعلّم القرآن",text:"قال رسول الله ﷺ: «خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ». نسأل الله تعالى أن يجعل تعليم فضيلة الشيخ مباركًا، وأن يكتب له أجر ما يغرسه من خير.",source:"صحيح البخاري، حديث 5027."},
{title:"أجر الدلالة على الخير",text:"قال النبي ﷺ: «مَنْ دَلَّ عَلَى خَيْرٍ فَلَهُ مِثْلُ أَجْرِ فَاعِلِهِ». فما يتركه التعليم الصادق من أثر طيب باب واسع من الخير بإذن الله تعالى.",source:"صحيح مسلم، حديث 1893."},
{title:"هدي النبوة في التعليم",text:"قال رسول الله ﷺ: «يَسِّرُوا وَلَا تُعَسِّرُوا، وَبَشِّرُوا وَلَا تُنَفِّرُوا». نسأل الله تعالى أن يجعل مجالس فضيلة الشيخ عامرة بالعلم والرفق والبشارة.",source:"صحيح البخاري، حديث 69."},
{title:"فضل الرحمة",text:"قال النبي ﷺ: «الرَّاحِمُونَ يَرْحَمُهُمُ الرَّحْمَنُ». بارك الله تعالى في رحمة فضيلة الشيخ بطلابه، وجعلها سببًا للسكينة وقبول العلم.",source:"جامع الترمذي، حديث 1924؛ قال الترمذي: حسن صحيح."},
{title:"شرف الدعوة إلى الله",text:"قال الله تعالى: ﴿وَمَنْ أَحْسَنُ قَوْلًا مِمَّنْ دَعَا إِلَى اللَّهِ وَعَمِلَ صَالِحًا﴾. نسأل الله تعالى أن يبارك في علم فضيلة الشيخ وعمله، وينفع بهما.",source:"القرآن الكريم، سورة فصلت: 33."},
{title:"ثمرة التعليم",text:"فضيلة الشيخ، أحسن الله إليكم، ورفع قدركم، وبارك في وقتكم وعلمكم، وجعل للقرآن الذي تعلّمونه أثرًا باقيًا في قلوب طلابكم وأعمالهم.",source:"دعاء وصياغة تشجيعية من إعداد الأكاديمية، وليست نصًا شرعيًا منقولًا."},
{title:"الثناء الصادق",text:"ما يُبذل في تعليم القرآن ورعاية الناشئة عمل جليل؛ نسأل الله تعالى أن يتقبل جهد فضيلة الشيخ، وأن يرزقه الإخلاص والإتقان وحسن الأثر.",source:"صياغة تشجيعية من إعداد الأكاديمية، وليست نصًا شرعيًا منقولًا."},
{title:"دعاء لأهل القرآن",text:"اللهم بارك لفضيلة الشيخ في علمه وعمله، وانفع به، واجعل ما يعلّمه من كتابك الكريم نورًا وهدايةً وأجرًا جاريًا، وارزقه القبول.",source:"دعاء من صياغة الأكاديمية، وليس حديثًا نبويًا."}
];



const wisdomPool=["admin","teacher","director","supervisor"].includes(S.user.role)?dailyWisdomForSheikh:dailyWisdom;
const previousDuaRaw=safeStore.getSession("ihsan_last_dashboard_dua_index"),previousDuaIndex=previousDuaRaw===""?-1:Number(previousDuaRaw);const duaChoices=dailySupplications.map((_,index)=>index).filter(index=>index!==previousDuaIndex);const duaIndex=duaChoices[Math.floor(Math.random()*duaChoices.length)]??0;safeStore.setSession("ihsan_last_dashboard_dua_index",String(duaIndex));const dua=dailySupplications[duaIndex];
const wisdom=wisdomPool[Math.floor(Math.random()*wisdomPool.length)];
html+='<section class="daily-nourishment-grid"><article class="card daily-nourishment dua-of-day"><div class="daily-kicker">'+esc(dua.title)+'</div><h3>'+esc(dua.text)+'</h3><p class="daily-source">'+esc(dua.source)+'</p></article><article class="card daily-nourishment wisdom-of-day"><div class="daily-kicker">'+esc(wisdom.title)+'</div><p>'+esc(wisdom.text)+'</p><span class="daily-source">'+esc(wisdom.source||"فائدة تربوية من إعداد الأكاديمية، وليست نصًا شرعيًا منقولًا.")+'</span></article></section>';
const quickIds=["admin"].includes(S.user.role)?["attendance","quran","effort"]:["teacher","supervisor"].includes(S.user.role)?["attendance","quran","tests"]:[];
const quickItems=items().filter(x=>quickIds.includes(x[0]));
if(quickItems.length)html+='<section class="card quick-actions-card"><div class="section-head"><div><h3>خطوات سريعة</h3><p>انتقل مباشرةً إلى أكثر المهام استخدامًا.</p></div></div><div class="quick-actions">'+quickItems.map(x=>'<button class="quick-action" type="button" data-go="'+x[0]+'"><span class="quick-action-icon">'+navIcon(x[0])+'</span><span class="quick-action-copy"><strong>'+esc(x[1])+'</strong><small>فتح القسم</small></span><span class="quick-action-arrow" aria-hidden="true">←</span></button>').join("")+'</div></section>';
v.innerHTML=html;v.querySelectorAll("[data-go]").forEach(b=>{b.onclick=()=>{const next=b.dataset.go;if(S.user.role==="admin"&&next==="groups"&&safeStore.get("ihsan_admin_focus")!=="full")safeStore.set("ihsan_admin_focus","full");go(next)}});v.querySelectorAll("[data-open-ihsan]").forEach(b=>b.onclick=()=>openIhsanTeaser());v.querySelectorAll("[data-claim-challenge]").forEach(b=>b.onclick=async()=>{b.disabled=true;try{await api("/gamification/claim",{method:"POST",body:JSON.stringify({challenge_id:b.dataset.claimChallenge})});toast("تم تسجيل إنجازك ومكافأتك اليومية");await page()}catch(e){toast(e.message,true);b.disabled=false}})}
async function groups(v){
if(S.user.role==="teacher"){
 const ownGroups=S.groups.filter(g=>g.teacher_id===S.user.id);
 v.innerHTML=head("أفواجي","أنشئ أفواجك الخاصة وعدّل بياناتها ضمن نطاقك؛ لا يمكنك تعديل أفواج شيخ آخر.")+
 '<section class="card"><h3>إنشاء فوج جديد</h3><form id="teacher-group-create" class="form-grid"><label class="field wide">اسم الفوج<input name="name" maxlength="120" required placeholder="اسم الفوج"></label><label class="field wide">الوصف<textarea name="description" maxlength="600" rows="2" placeholder="وصف مختصر للفوج (اختياري)"></textarea></label><label class="field wide">المستوى<input name="level" maxlength="80" placeholder="مثال: حفظ ومراجعة" value="عام"></label><div class="wide"><button class="btn" type="submit">إنشاء الفوج</button></div></form></section><div class="divider"></div><h3>الأفواج التابعة لي</h3><div class="list">'+(ownGroups.length?ownGroups.map(g=>'<section class="card"><form class="teacher-group-edit form-grid" data-teacher-group-edit="'+esc(g.id)+'"><label class="field wide">اسم الفوج<input name="name" maxlength="120" required value="'+esc(g.name)+'"></label><label class="field wide">الوصف<textarea name="description" maxlength="600" rows="2">'+esc(g.description||"")+'</textarea></label><label class="field wide">المستوى<input name="level" maxlength="80" value="'+esc(g.level||"عام")+'"></label><div class="wide form-actions"><button class="btn" type="submit">حفظ التعديلات</button><button class="btn danger" type="button" data-teacher-group-delete="'+esc(g.id)+'">إيقاف الفوج</button></div></form></section>').join(""):'<div class="empty">لم تنشئ أفواجًا بعد. أنشئ أول فوج من النموذج أعلاه.</div>')+'</div>';
 $("#teacher-group-create").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.currentTarget);const submit=e.currentTarget.querySelector('button[type="submit"]');submit.disabled=true;try{await api("/teacher/groups",{method:"POST",body:JSON.stringify({name:f.get("name"),description:f.get("description"),level:f.get("level")})});toast("تم إنشاء الفوج");await load();shell();page()}catch(x){toast(x.message||"تعذر إنشاء الفوج",true);submit.disabled=false}};
 v.querySelectorAll("[data-teacher-group-edit]").forEach(form=>form.onsubmit=async e=>{e.preventDefault();const f=new FormData(form),id=form.dataset.teacherGroupEdit,submit=form.querySelector('button[type="submit"]');submit.disabled=true;try{await api("/teacher/groups/"+encodeURIComponent(id),{method:"PATCH",body:JSON.stringify({name:f.get("name"),description:f.get("description"),level:f.get("level")})});toast("تم حفظ تعديلات الفوج");await load();shell();page()}catch(x){toast(x.message||"تعذر تعديل الفوج",true);submit.disabled=false}});
 v.querySelectorAll("[data-teacher-group-delete]").forEach(b=>b.onclick=async()=>{if(!confirm("هل تريد إيقاف هذا الفوج؟ لا يمكن إيقاف فوج يضم طلابًا نشطين."))return;b.disabled=true;try{await api("/teacher/groups/"+encodeURIComponent(b.dataset.teacherGroupDelete),{method:"DELETE"});toast("تم إيقاف الفوج");await load();shell();page()}catch(x){toast(x.message||"تعذر إيقاف الفوج",true);b.disabled=false}});
 return;
}
const teacherOptions=(selected)=>'<option value="">غير معيّن</option>'+(S.user.role==="admin"?'<option value="'+esc(S.user.id)+'" '+(S.user.id===selected?'selected':'')+'>'+esc(honorificDisplayName(S.user.name,S.user.role))+' — مدير ومعلم</option>':"")+S.teachers.map(t=>'<option value="'+esc(t.id)+'" '+(t.id===selected?'selected':'')+'>'+esc(honorificDisplayName(t.name,"teacher"))+' ('+esc(t.username)+')</option>').join("");
v.innerHTML=head("الأفواج والمعلمون والفرق","تنظيم واحد للأفواج والمعلمين والفرق والإشراف الطلابي.")+(S.user.role==="admin"?'<div class="organization-shortcuts"><button type="button" class="btn secondary" id="open-teachers-panel">إدارة المعلمين وتعيينهم</button><p class="muted small">تُسند مهمة مشرف الفرقة إلى طالب من الفوج نفسه، ويُعيّن كبير المشرفين من الطلبة المسجلين؛ هذا تكليف تنظيمي ولا يمنح صلاحيات إدارية في الحساب.</p></div>':"")+'<div class="card" id="group-create-panel"><form id="gform" class="form-grid"><div class="wide">'+field("اسم الفوج","name")+'</div><label class="field wide">المعلم المسؤول<select name="teacher_id">'+teacherOptions("")+'</select></label><div class="wide"><button class="btn">إضافة الفوج</button></div></form></div><div class="divider"></div><div class="list" id="groups-list-panel">'+(S.groups.length?S.groups.map(g=>'<div class="list-row"><div style="flex:1;min-width:220px"><strong>'+esc(g.name)+'</strong><label class="field small">المعلم المسؤول<select data-teacher-for="'+esc(g.id)+'">'+teacherOptions(g.teacher_id)+'</select></label></div><button class="btn" data-save-group="'+esc(g.id)+'">حفظ التعيين</button><button class="btn danger" data-del="'+esc(g.id)+'">إيقاف</button></div>').join(""):'<div class="empty">لا توجد أفواج بعد.</div>')+'</div>'+(S.user.role==="admin"?'<section class="card" id="teachers-inline-panel"></section>':"");
$("#open-teachers-panel")?.addEventListener("click",()=>$("#teachers-inline-panel")?.scrollIntoView({behavior:"smooth",block:"start"}));
if($("#teachers-inline-panel"))await teachers($("#teachers-inline-panel"));
if(S.user.role==="admin"){v.querySelector(".section-head")?.insertAdjacentHTML("afterend",'<nav class="hub-cards organization-hub" aria-label="أقسام إدارة الأفواج"><button type="button" class="hub-card" data-org-target="#group-create-panel"><span class="hub-card-icon">＋</span><strong>إضافة الفوج</strong><small>إنشاء فوج وتعيين معلمه</small></button><button type="button" class="hub-card" data-org-target="#groups-list-panel"><span class="hub-card-icon">▤</span><strong>الاطلاع على الأفواج والمعلمين</strong><small>عرض الأفواج والمعلمين المسؤولين</small></button><button type="button" class="hub-card" data-org-target="#groups-list-panel"><span class="hub-card-icon">♙</span><strong>إدارة المعلمين وتعيينهم</strong><small>تعديل التعيينات ومتابعة الحسابات</small></button><button type="button" class="hub-card" data-org-target="#teachers-inline-panel"><span class="hub-card-icon">◉</span><strong>حسابات المعلمين</strong><small>إنشاء حسابات المعلمين ومراجعتها</small></button><button type="button" class="hub-card" data-org-target="#team-supervisors-panel"><span class="hub-card-icon">◎</span><strong>الفرق ومشرفوها وكبير المشرفين</strong><small>كبير المشرفين يتابع جميع الفرق</small></button></nav>');v.querySelectorAll("[data-org-target]").forEach(b=>b.addEventListener("click",()=>{const target=v.querySelector(b.dataset.orgTarget);target?.scrollIntoView({behavior:"smooth",block:"start"});target?.classList.add("hub-target-focus");setTimeout(()=>target?.classList.remove("hub-target-focus"),1300)}));}
$("#gform").onsubmit=async e=>{e.preventDefault();const form=e.currentTarget,f=new FormData(form),submit=form.querySelector('button[type="submit"],button:not([type])');if(submit)submit.disabled=true;try{const created=await api("/groups",{method:"POST",body:JSON.stringify({name:f.get("name"),teacher_id:f.get("teacher_id")})});S.groups=[...S.groups,{...created,description:"",level:"عام"}].sort((a,b)=>String(a.name||"").localeCompare(String(b.name||""),"ar"));toast("تمت إضافة الفوج");shell();await page();v.querySelector("#groups-list-panel")?.scrollIntoView({behavior:"smooth",block:"start"})}catch(x){toast(x.message,true);if(submit)submit.disabled=false}};
v.querySelectorAll("[data-save-group]").forEach(b=>b.onclick=async()=>{const id=b.dataset.saveGroup,sel=v.querySelector('[data-teacher-for="'+id+'"]');try{await api("/groups/"+encodeURIComponent(id),{method:"PATCH",body:JSON.stringify({teacher_id:sel.value||null})});toast("تم حفظ تعيين المعلم");await load();shell();page()}catch(x){toast(x.message,true)}});
v.querySelectorAll("[data-del]").forEach(b=>b.onclick=async()=>{if(!confirm("إيقاف الفوج؟"))return;try{await api("/groups/"+b.dataset.del,{method:"DELETE"});await load();shell();page()}catch(x){toast(x.message,true)}});
if(S.user.role!=="admin")return;
let assignments=[];
try{assignments=await api("/admin/student-team-supervisors")}catch(error){toast("تعذّر تحميل تعيينات مشرفي الفرق: "+error.message,true)}
const students=S.students.slice().sort((a,b)=>compareStudentNames(a.name,b.name));
const groupName=id=>(S.groups.find(g=>g.id===id)||{}).name||"فوج غير معروف";
const assignmentList=assignments.length?assignments.map(a=>'<div class="list-row"><div><strong>'+esc(groupName(a.group_id))+' · '+esc(a.team_name||"الفرقة الأولى")+'</strong><small>مشرف الفرقة: '+esc(a.supervisor_name||"—")+'</small><small>كبير المشرفين: '+esc(a.head_supervisor_name||"—")+'</small></div><button type="button" class="btn secondary" data-edit-supervision="'+esc(a.id)+'">تعديل الفرقة</button></div>').join(""):'<div class="empty">لم تُنشأ فرق طلابية بعد.</div>';
v.insertAdjacentHTML("beforeend",'<section class="card student-supervisors-section" id="team-supervisors-panel"><div class="section-head"><div><span class="eyebrow">التنظيم الطلابي</span><h3>الفرق ومشرفوها وكبير المشرفين</h3><p>داخل كل فوج فرق صغيرة بأسماء مميزة، ولكل فرقة مشرف من طلاب الفوج نفسه. كبير المشرفين واحد للفوج، ويتابع جميع فرقه ومشرفيها، لا فرقة واحدة فقط.</p></div></div><form id="student-supervisors-form" class="form-grid"><input type="hidden" id="supervisor-team-id" name="team_id"><label class="field">الفوج<select id="supervisor-group" name="group_id" required><option value="">اختر الفوج</option>'+S.groups.map(g=>'<option value="'+esc(g.id)+'">'+esc(g.name)+'</option>').join("")+'</select></label><label class="field">اسم الفرقة<input id="supervisor-team-name" name="team_name" required maxlength="80" placeholder="مثال: فرقة الهمم"></label><label class="field">مشرف الفرقة من طلبة الفوج<select id="supervisor-student" name="supervisor_student_id" required><option value="">اختر الفوج أولًا</option></select></label><label class="field">كبير المشرفين لجميع فرق الفوج<select id="head-supervisor-student" name="head_supervisor_student_id" required><option value="">اختر الفوج أولًا</option></select></label><div class="wide form-actions"><button class="btn" type="submit" '+(S.groups.length&&students.length>1?"":"disabled")+' >حفظ الفرقة والتعيين</button><button class="btn secondary" type="button" id="reset-supervision-form">فرقة جديدة</button></div><p class="muted small wide">كبير المشرفين يتابع جميع مشرفي الفرق داخل الفوج، ومشرف الفرقة مسؤول عن أعضاء فرقته فقط. لا تتغير حسابات الدخول أو درجات الطلبة بهذا التعيين.</p></form><div class="divider"></div><h3>الفرق والتعيينات الحالية</h3><div class="list" id="student-supervisor-assignment-list">'+assignmentList+'</div></section>');
const groupSelect=$("#supervisor-group"),supervisorSelect=$("#supervisor-student"),headSelect=$("#head-supervisor-student"),assignmentForm=$("#student-supervisors-form"),teamIdInput=$("#supervisor-team-id"),teamNameInput=$("#supervisor-team-name");
function fillStudentOptions(select,groupId,placeholder,selected=""){
 const roster=students.filter(st=>st.group_id===groupId);
 select.innerHTML='<option value="">'+placeholder+'</option>'+roster.map(st=>'<option value="'+esc(st.id)+'">'+esc(studentDisplayName(st.name))+'</option>').join("");
 if(selected&&roster.some(st=>st.id===selected))select.value=selected;
}
function selectGroup(groupId,assignment=null){
 groupSelect.value=groupId;
 fillStudentOptions(supervisorSelect,groupId,"اختر مشرف الفرقة",assignment?.supervisor_student_id||"");
 const groupHead=assignments.find(a=>a.group_id===groupId)?.head_supervisor_student_id||assignment?.head_supervisor_student_id||"";
 fillStudentOptions(headSelect,groupId,"اختر كبير المشرفين",groupHead);
 if(assignment){teamIdInput.value=assignment.id||"";teamNameInput.value=assignment.team_name||"الفرقة الأولى"}
 else{teamIdInput.value="";teamNameInput.value=""}
}
groupSelect.onchange=()=>selectGroup(groupSelect.value);
function resetSupervisionForm(){assignmentForm.reset();teamIdInput.value="";supervisorSelect.innerHTML='<option value="">اختر الفوج أولًا</option>';headSelect.innerHTML='<option value="">اختر الفوج أولًا</option>'}
$("#reset-supervision-form")?.addEventListener("click",resetSupervisionForm);
v.querySelectorAll("[data-edit-supervision]").forEach(button=>button.addEventListener("click",()=>{const current=assignments.find(a=>String(a.id)===button.dataset.editSupervision);if(current)selectGroup(current.group_id,current);assignmentForm.scrollIntoView({behavior:"smooth",block:"center"})}));
assignmentForm.onsubmit=async e=>{
 e.preventDefault();
 const fd=new FormData(assignmentForm),groupId=String(fd.get("group_id")||""),teamName=String(fd.get("team_name")||"").trim(),teamId=String(fd.get("team_id")||""),supervisorId=String(fd.get("supervisor_student_id")||""),headId=String(fd.get("head_supervisor_student_id")||""),button=assignmentForm.querySelector('button[type="submit"]');
 if(!groupId||!teamName||!supervisorId||!headId){toast("أكمل الفوج واسم الفرقة ومشرفها وكبير المشرفين",true);return}
 if(supervisorId===headId){toast("اختر طالبين مختلفين لمهمة الإشراف ومهمة كبير المشرفين",true);return}
 button.disabled=true;
 try{
  await api("/admin/student-team-supervisors",{method:"POST",body:JSON.stringify({team_id:teamId,team_name:teamName,group_id:groupId,supervisor_student_id:supervisorId,head_supervisor_student_id:headId})});
  toast(teamId?"تم تحديث الفرقة وتعييناتها":"تمت إضافة الفرقة وحفظ تعييناتها");
  await load();shell();await page();
 }catch(error){toast(error.message,true);button.disabled=false}
};
if(S.groups.length)selectGroup(S.groups[0].id);
}
async function teachers(v){
 const isAdmin=S.user.role==="admin";
 if(!isAdmin){v.innerHTML=head("المعلمون","هذه الصفحة مخصصة لإدارة حسابات المعلمين.");return}
 v.innerHTML=head("المعلمون","إنشاء حسابات المعلمين وإدارة هويات الدخول.")+
 '<section class="card"><h3>إضافة معلم</h3><form id="tform" class="form-grid"><div>'+field("الاسم الكامل","name")+'</div><div>'+field("اسم الدخول","username")+'</div><div>'+field("كلمة مرور مؤقتة","password","password","8")+'</div><div class="wide"><button class="btn">إنشاء حساب المعلم</button></div></form><p class="muted small">يُطلب من المعلم تغيير كلمة المرور المؤقتة بعد أول دخول.</p></section>'+
 '<section class="card"><h3>حسابات المعلمين</h3><div class="list">'+(S.teachers.length?S.teachers.map(t=>'<div class="list-row"><div><strong>'+esc(honorificDisplayName(t.name,"teacher"))+'</strong><small>اسم الدخول: '+esc(t.username||"غير متاح")+'</small></div><button class="btn secondary" type="button" data-reset-teacher-password="'+esc(t.id)+'">إعادة كلمة المرور</button><button class="btn danger" type="button" data-delete-teacher="'+esc(t.id)+'">تعطيل الحساب</button></div>').join(""):'<div class="empty">لا توجد حسابات معلمين بعد.</div>')+'</div><p class="muted small">تعطيل الحساب يمنع الدخول ويحفظ كل السجلات؛ لا يُحذف شيء. إن كان المعلم مسؤولًا عن فوج نشط، أعد تعيين الفوج أولًا.</p></section>';
 $("#tform")?.addEventListener("submit",async e=>{e.preventDefault();const f=new FormData(e.currentTarget),button=e.currentTarget.querySelector('button[type="submit"],button:not([type])');if(button)button.disabled=true;try{await api("/teachers",{method:"POST",body:JSON.stringify({name:f.get("name"),username:f.get("username"),password:f.get("password")})});toast("تم إنشاء حساب المعلم");await load();shell();await page()}catch(err){toast(err.message,true);if(button)button.disabled=false}});
 v.querySelectorAll("[data-reset-teacher-password]").forEach(button=>button.onclick=async()=>{const teacher=S.teachers.find(item=>item.id===button.dataset.resetTeacherPassword);if(!teacher)return;const password=prompt("كلمة المرور المؤقتة الجديدة (8 أحرف على الأقل):","");if(password===null)return;if(password.length<8)return toast("كلمة المرور يجب ألا تقل عن 8 أحرف",true);const confirmation=prompt("أعد كتابة كلمة المرور المؤقتة:","");if(confirmation===null)return;if(password!==confirmation)return toast("كلمتا المرور غير متطابقتين",true);if(!confirm("ستُلغى جلسات المعلم الحالية ويُطلب منه تغيير كلمة المرور عند أول دخول. متابعة؟"))return;button.disabled=true;try{await api("/teachers/"+encodeURIComponent(teacher.id),{method:"PATCH",body:JSON.stringify({name:teacher.name,username:teacher.username,password})});toast("تمت إعادة تعيين كلمة مرور المعلم؛ أرسلها له على قناة خاصة");await load();shell();await page()}catch(error){toast(error.message||"تعذرت إعادة التعيين",true);button.disabled=false}});
v.querySelectorAll("[data-delete-teacher]").forEach(button=>button.onclick=async()=>{
  const teacher=S.teachers.find(item=>item.id===button.dataset.deleteTeacher);
  if(!confirm("تعطيل حساب "+(teacher?.name||"المعلم")+"؟ سيُمنع من الدخول، وتبقى بياناته وسجلاته محفوظة."))return;
  button.disabled=true;
  try{await api("/teachers/"+encodeURIComponent(button.dataset.deleteTeacher),{method:"DELETE"});S.teachers=S.teachers.filter(item=>item.id!==button.dataset.deleteTeacher);toast("تم تعطيل حساب المعلم");await teachers(v)}catch(err){toast(err.message,true);button.disabled=false}
 });
}
async function teamsPage(v){
 const isStudent=S.user.role==="student",isStaff=["admin","teacher","director","supervisor"].includes(S.user.role);
 let groupId=isStudent?(safeStore.getSession("ihsan_team_group")||""):(S.groups.find(g=>g.id===safeStore.getSession("ihsan_team_group"))?.id||S.groups[0]?.id||"");
 if(!isStudent&&!groupId){v.innerHTML=head("الفرق الطلابية","أنشئ فوجًا أولًا قبل إضافة الفرق وأعضائها.");return}
 v.innerHTML=head(isStudent?"فرقتي وطلبات النقل":"الفرق الطلابية","فوج واحد، فرقة واحدة لكل طالب، والنقل لا يتم إلا بطلب رسمي وموافقة كبير المشرفين.")+'<div class="loading">جار تحميل الفرق والعضوية…</div>';
 try{
  const data=await api("/student-teams"+(groupId?"?group_id="+encodeURIComponent(groupId):""));
  const isGlobalChief=!!data.is_global_chief;
  groupId=data.group_id||groupId;
  let roster=isStaff?await api("/students?group_id="+encodeURIComponent(groupId)):(data.eligible_students||[]);
  let chiefs=[];
  if(S.user.role==="admin"){try{chiefs=await api("/admin/chief-supervisors")}catch{}}
  const teams=data.teams||[],memberships=data.memberships||[],requests=data.requests||[],supervisorRequests=data.supervisor_requests||[];
  const teamById=new Map(teams.map(t=>[t.id,t]));
  const ownMembership=data.current_membership||memberships.find(m=>m.student_id===data.current_student_id)||null;
  const groupSource=isGlobalChief?(data.chief_groups||[]):S.groups;
  const groupOptions=groupSource.map(g=>'<option value="'+esc(g.id)+'" '+(g.id===groupId?"selected":"")+'>'+esc(g.name)+'</option>').join("");
  const memberRows=memberships.length?memberships.map(m=>'<div class="list-row"><div><strong>'+esc(m.student_name||"طالب")+'</strong><small>'+esc(m.team_name||teamById.get(m.team_id)?.team_name||"فرقة غير معروفة")+'</small></div></div>').join(""):'<div class="empty">لا توجد عضويات ظاهرة في هذا النطاق بعد.</div>';
  const requestRows=requests.length?requests.map(r=>'<div class="list-row"><div style="flex:1;min-width:180px"><strong>'+esc(r.student_name||"طالب")+'</strong><small>'+esc(r.from_team_name||"بلا فرقة")+' ← '+esc(r.target_team_name||"فرقة أخرى")+'</small><small>الحالة: '+esc(({pending:"قيد انتظار موافقة كبير المشرفين",approved:"مقبول",rejected:"مرفوض"})[r.status]||r.status)+'</small></div>'+(data.can_approve_transfers&&r.status==="pending"?'<button class="btn" data-transfer-decision="approve" data-request-id="'+esc(r.id)+'">موافقة</button><button class="btn secondary" data-transfer-decision="reject" data-request-id="'+esc(r.id)+'">رفض</button>':"")+'</div>').join(""):'<div class="empty">لا توجد طلبات نقل ظاهرة.</div>';
  let html='';
  if(isGlobalChief)html+='<div class="notice">أنت كبير مشرفي الفرق على جميع الأفواج. اختر الفوج لمراجعة طلبات النقل وطلبات الانضمام واعتمادها.</div>';
  if(isStaff||isGlobalChief)html+='<section class="card"><label class="field">'+(isGlobalChief?"الفوج الذي تراجعه":"الفوج")+'<select id="teams-group">'+groupOptions+'</select></label></section>';
  if(isStudent){
   const ownTeam=ownMembership?teamById.get(ownMembership.team_id):null;
   html+='<section class="card"><span class="eyebrow">عضويتك الحالية</span><h3>'+(ownTeam?esc(ownTeam.team_name):"لم تُسند إلى فرقة بعد")+'</h3><p>'+(ownTeam?"مشرف الفرقة: "+esc(ownTeam.supervisor_name||"لم يُعيّن بعد")+" · كبير المشرفين: "+esc(ownTeam.head_supervisor_name||"لم يُعيّن بعد"):"تواصل مع مشرف الفرقة أو الشيخ لإسنادك إلى فرقة.")+'</p>';
   if(ownMembership&&teams.length>1)html+='<form id="team-transfer-form" class="form-grid"><label class="field wide">طلب الانتقال إلى فرقة أخرى<select name="target_team_id" required><option value="">اختر الفرقة الجديدة</option>'+teams.filter(t=>t.id!==ownMembership.team_id).map(t=>'<option value="'+esc(t.id)+'">'+esc(t.team_name)+'</option>').join("")+'</select></label><div class="wide"><button class="btn" type="submit">إرسال طلب النقل الرسمي</button></div><p class="muted small wide">لن تتغير عضويتك حتى يوافق كبير المشرفين.</p></form>';
   const mySupervisorRequest=supervisorRequests.find(r=>r.student_id===data.current_student_id);
   if(!data.is_chief_supervisor&&!teams.some(t=>t.supervisor_student_id===data.current_student_id)){
    if(mySupervisorRequest?.status==="pending")html+='<div class="notice">طلب الانضمام إلى مشرفي الفرق قيد مراجعة كبير المشرفين.</div>';
    else if(mySupervisorRequest?.status==="approved")html+='<div class="notice">تم اعتمادك ضمن مشرفي الفرق. يتولى المدير تعيينك على فرقة مناسبة.</div>';
    else html+='<button type="button" class="btn" id="request-team-supervisor">طلب الانضمام إلى مشرفي الفرق</button>';
   }
   html+='</section>';
  }
  if(data.can_assign_members){
   const supervisedTeam=isStudent?teams.find(t=>t.supervisor_student_id===data.current_student_id):null;
   const assignableTeams=isStudent?(supervisedTeam?[supervisedTeam]:[]):teams;
   const eligible=roster.filter(st=>!st.assigned_team_id&&!memberships.some(m=>m.student_id===st.id));
   html+='<section class="card"><h3>إسناد طالب إلى فرقة</h3><p class="muted small">لا يُضاف الطالب إلى فرقتين. إذا كان مسجلًا في فرقة أخرى، فيلزم طلب نقل رسمي وموافقة كبير المشرفين.</p>'+(assignableTeams.length?'<form id="team-member-form" class="form-grid"><label class="field">الطالب<select name="student_id" required><option value="">اختر طالبًا</option>'+eligible.map(st=>'<option value="'+esc(st.id)+'">'+esc(studentDisplayName(st.name))+'</option>').join("")+'</select></label><label class="field">الفرقة<select name="team_id" required><option value="">اختر الفرقة</option>'+assignableTeams.map(t=>'<option value="'+esc(t.id)+'">'+esc(t.team_name)+'</option>').join("")+'</select></label><div class="wide"><button class="btn" type="submit">إسناد الطالب</button></div></form>':'<p class="empty">لم تُنشأ فرق أو لم تُعيّن لك فرقة للإشراف.</p>')+'</section>';
  }
  if(supervisorRequests.length||data.can_approve_supervisor_requests) {
   const supervisorRequestRows=supervisorRequests.length?supervisorRequests.map(r=>'<div class="list-row"><div style="flex:1;min-width:180px"><strong>'+esc(r.student_name||"طالب")+'</strong><small>طلب الانضمام إلى مشرفي الفرق</small><small>الحالة: '+esc(({pending:"قيد المراجعة",approved:"معتمد",rejected:"مرفوض"})[r.status]||r.status)+'</small></div>'+(data.can_approve_supervisor_requests&&r.status==="pending"?'<button class="btn" data-supervisor-decision="approve" data-request-id="'+esc(r.id)+'">اعتماد</button><button class="btn secondary" data-supervisor-decision="reject" data-request-id="'+esc(r.id)+'">رفض</button>':"")+'</div>').join(""):'<div class="empty">لا توجد طلبات انضمام معلّقة.</div>';
   html+='<section class="card"><h3>طلبات الانضمام إلى مشرفي الفرق</h3><p class="muted small">يعتمد كبير المشرفين الطلبات قبل تعيين الطالب مشرفًا على فرقة.</p><div class="list">'+supervisorRequestRows+'</div></section>';
  }
  if(S.user.role==="admin"){
   const activeChiefs=chiefs.filter(c=>c.active&&c.student_active);
   const chiefRows=activeChiefs.length?activeChiefs.map(c=>'<div class="list-row"><div style="flex:1;min-width:180px"><strong>'+esc(studentDisplayName(c.student_name||"طالب"))+'</strong><small>'+esc(c.group_name||"بلا فوج")+'</small></div><button class="btn danger" type="button" data-chief-revoke="'+esc(c.student_id)+'">إلغاء التعيين</button></div>').join(""):'<div class="empty">لم يُعيَّن كبير مشرفين عام بعد.</div>';
   const assignedIds=new Set(activeChiefs.map(c=>c.student_id));
   const candidates=S.students.filter(st=>!assignedIds.has(st.id));
   html+='<section class="card"><h3>كبير مشرفي الفرق (كل الأفواج)</h3><p class="muted small">طالب واحد يشرف على جميع مشرفي الفرق في الأكاديمية، ويعتمد طلبات النقل والانضمام في كل الأفواج.</p><div class="list">'+chiefRows+'</div>'+(candidates.length?'<form id="chief-appoint-form" class="form-grid"><label class="field wide">الطالب<select name="student_id" required><option value="">اختر طالبًا</option>'+candidates.map(st=>'<option value="'+esc(st.id)+'">'+esc(studentDisplayName(st.name))+' — '+esc((S.groups.find(g=>g.id===st.group_id)||{}).name||"بلا فوج")+'</option>').join("")+'</select></label><div class="wide"><button class="btn" type="submit">تعيين كبير مشرفين عام</button></div></form>':'<p class="empty">كل الطلبة النشطين معيّنون أو لا يوجد طلبة.</p>')+'</section>';
  }
  html+='<section class="card"><h3>أعضاء الفرق</h3><div class="list">'+memberRows+'</div></section><section class="card"><h3>طلبات النقل</h3><p class="muted small">كبير المشرفين هو المسؤول عن الموافقة أو الرفض.</p><div class="list">'+requestRows+'</div></section>';
  v.innerHTML=head(isStudent?"فرقتي وطلبات النقل":"الفرق الطلابية",isStudent?"تابع عضويتك واطلب النقل رسميًا عند الحاجة.":"إدارة عضوية الطلبة وطلبات النقل ضمن الفوج المحدد.")+html;
  $("#teams-group")?.addEventListener("change",e=>{safeStore.setSession("ihsan_team_group",e.target.value);teamsPage(v)});
  $("#team-member-form")?.addEventListener("submit",async e=>{e.preventDefault();const f=new FormData(e.currentTarget),button=e.currentTarget.querySelector('button[type="submit"]');button.disabled=true;try{await api("/student-team-memberships",{method:"POST",body:JSON.stringify({student_id:f.get("student_id"),team_id:f.get("team_id")})});toast("تم إسناد الطالب إلى الفرقة");await teamsPage(v)}catch(err){toast(err.message,true);button.disabled=false}});
  $("#request-team-supervisor")?.addEventListener("click",async e=>{const button=e.currentTarget;button.disabled=true;try{await api("/student-team-supervisor-requests",{method:"POST",body:JSON.stringify({})});toast("أُرسل طلب الانضمام إلى كبير المشرفين");await teamsPage(v)}catch(err){toast(err.message,true);button.disabled=false}});
  v.querySelectorAll("[data-supervisor-decision]").forEach(button=>button.addEventListener("click",async()=>{button.disabled=true;try{await api("/student-team-supervisor-requests/"+encodeURIComponent(button.dataset.requestId)+"/decision",{method:"POST",body:JSON.stringify({decision:button.dataset.supervisorDecision})});toast(button.dataset.supervisorDecision==="approve"?"تم اعتماد الطالب ضمن مشرفي الفرق":"تم رفض طلب الانضمام");await teamsPage(v)}catch(err){toast(err.message,true);button.disabled=false}}));
  $("#chief-appoint-form")?.addEventListener("submit",async e=>{e.preventDefault();const f=new FormData(e.currentTarget),button=e.currentTarget.querySelector('button[type="submit"]');button.disabled=true;try{await api("/admin/chief-supervisors",{method:"POST",body:JSON.stringify({student_id:f.get("student_id")})});toast("تم تعيين كبير مشرفي الفرق على جميع الأفواج");await teamsPage(v)}catch(err){toast(err.message,true);button.disabled=false}});
  v.querySelectorAll("[data-chief-revoke]").forEach(button=>button.addEventListener("click",async()=>{if(!confirm("إلغاء تعيين كبير مشرفي الفرق؟ سيبقى الطالب في فرقته، وتعود صلاحية الاعتماد لكبير مشرف الفرقة والمدير العام."))return;button.disabled=true;try{await api("/admin/chief-supervisors/"+encodeURIComponent(button.dataset.chiefRevoke),{method:"DELETE"});toast("تم إلغاء تعيين كبير مشرفي الفرق");await teamsPage(v)}catch(err){toast(err.message,true);button.disabled=false}}));
  $("#team-transfer-form")?.addEventListener("submit",async e=>{e.preventDefault();const f=new FormData(e.currentTarget),button=e.currentTarget.querySelector('button[type="submit"]');button.disabled=true;try{await api("/student-team-transfer-requests",{method:"POST",body:JSON.stringify({target_team_id:f.get("target_team_id")})});toast("أُرسل طلب النقل إلى كبير المشرفين");await teamsPage(v)}catch(err){toast(err.message,true);button.disabled=false}});
  v.querySelectorAll("[data-transfer-decision]").forEach(button=>button.addEventListener("click",async()=>{button.disabled=true;try{await api("/student-team-transfer-requests/"+encodeURIComponent(button.dataset.requestId)+"/decision",{method:"POST",body:JSON.stringify({decision:button.dataset.transferDecision})});toast(button.dataset.transferDecision==="approve"?"تمت الموافقة على طلب النقل":"تم رفض طلب النقل");await teamsPage(v)}catch(err){toast(err.message,true);button.disabled=false}}));
 }catch(error){v.innerHTML=head("الفرق الطلابية","تعذر تحميل العضوية أو طلبات النقل.")+'<div class="notice error">'+esc(error.message)+'</div><button class="btn" id="retry-teams">إعادة المحاولة</button>';$("#retry-teams")?.addEventListener("click",()=>teamsPage(v))}
}
function students(v){
const bulkAccountCandidates=()=>S.students.filter(s=>!s.user_id&&s.group_id&&S.groups.some(g=>g.id===s.group_id)).map(s=>s.id);

const groupName=id=>(S.groups.find(g=>g.id===id)||{}).name||"بلا فوج";
v.innerHTML=head("الطلاب","اختر الفوج لعرض طلابه منفصلين. الحسابات المرتبطة مسبقًا تبقى كما هي.")+(S.groups.length?'<div class="card"><details class="student-create-details"><summary class="btn" aria-controls="sform">إنشاء حساب طالب</summary><div class="student-create-body"><p class="muted small">أدخل اسم الطالب والفوج. كلمة المرور الأولية الموحدة 12345678، ويجب تغييرها عند أول دخول.</p><form id="sform" class="form-grid"><div>'+field("اسم الطالب الكامل","name")+'</div><label class="field">الفوج<select name="group_id" required><option value="">اختر الفوج</option>'+assignedGroups().map(g=>'<option value="'+esc(g.id)+'">'+esc(g.name)+'</option>').join("")+'</select></label><div class="wide"><button class="btn" type="submit">إنشاء حساب الطالب</button></div></form></div></details></div>':'<div class="notice">أنشئ فوجًا أولًا، ثم أضف الطلاب إليه.</div>')+'<div class="card"><div class="stats roster-account-stats"><div class="stat"><small>ملفات الطلاب</small><strong id="roster-total">0</strong></div><div class="stat"><small>لديهم حساب دخول</small><strong id="roster-linked">0</strong></div><div class="stat"><small>بحاجة إلى حساب</small><strong id="roster-missing">0</strong></div></div><div class="roster-filters"><label class="field">البحث عن طالب<input id="student-name-search" type="search" placeholder="اكتب اسم الطالب..." autocomplete="off"></label><label class="field">فرز القائمة حسب الفوج<select id="student-group-filter"><option value="all">كل الأفواج — عرض منفصل</option>'+assignedGroups().slice().sort((a,b)=>a.name.localeCompare(b.name,"ar")).map(g=>'<option value="'+esc(g.id)+'">'+esc(g.name)+'</option>').join("")+'</select></label><label class="field">حالة الحساب<select id="student-login-filter"><option value="all">كل الطلاب</option><option value="missing">بلا حساب دخول</option><option value="linked">لديهم حساب دخول</option></select></label></div>'+(S.user.role==="admin"?'<div class="roster-actions"><button id="bulk-onboard-students" class="btn" type="button" '+(bulkAccountCandidates().length?'':'disabled')+'>تجهيز حسابات الطلاب ('+bulkAccountCandidates().length+')</button><p class="muted small">إجراء للمدير لتجهيز كل طالب نشط ضمن فوج ولا يملك حسابًا. كلمة المرور الأولية موحدة 12345678 ويجب تغييرها عند أول دخول. يُربط الحساب السابق غير المرتبط فقط إذا كان تطابق الاسم فريدًا من الطرفين؛ الأسماء الملتبسة تُترك للمراجعة ولا تُنشأ لها حسابات مكررة.</p></div>':'')+'<p class="muted small">تُنشأ الحسابات للطلاب الذين لا يملكون دخولًا ضمن الأفواج النشطة. الحسابات المرتبطة مسبقًا لا تُعاد كلمة مرورها ولا تُمس سجلات الطلاب.</p></div><div id="bulk-onboarding-results" aria-live="polite"></div><div id="students-roster"></div>';
if(S.user.role==="admin")api("/admin/students/bulk-onboarding/status").then(status=>{if(status.completed)document.querySelector(".roster-actions")?.remove()}).catch(()=>{});
const host=$("#students-roster");
v.querySelector(".section-head")?.insertAdjacentHTML("afterend",'<nav class="hub-cards student-hub" aria-label="أقسام الطلاب"><button type="button" class="hub-card" data-student-target=".student-create-details"><span class="hub-card-icon">＋</span><strong>إنشاء حساب طالب</strong><small>إضافة حساب وربطه بالفوج</small></button><button type="button" class="hub-card" data-student-target="#student-name-search"><span class="hub-card-icon">⌕</span><strong>البحث عن طالب</strong><small>اكتب الاسم للوصول إلى ملف الطالب</small></button><button type="button" class="hub-card" data-student-target="#students-roster"><span class="hub-card-icon">♙</span><strong>الطلاب</strong><small>عرض القوائم حسب الأفواج</small></button></nav>');
v.querySelectorAll("[data-student-target]").forEach(b=>b.addEventListener("click",()=>{const target=v.querySelector(b.dataset.studentTarget);target?.scrollIntoView({behavior:"smooth",block:"center"});target?.classList.add("hub-target-focus");setTimeout(()=>target?.classList.remove("hub-target-focus"),1300)}));
function renderRoster(){
const selected=$("#student-group-filter")?.value||"all";
const loginFilter=$("#student-login-filter")?.value||"all";
const query=String($("#student-name-search")?.value||"").trim().toLocaleLowerCase("ar");
const matchesLogin=s=>(!query||String(s.name||"").toLocaleLowerCase("ar").includes(query))&&(loginFilter==="all"||(loginFilter==="missing"?!s.user_id:!!s.user_id));
const rosterStudentSet=S.user.role==="admin"?S.students:S.students.filter(s=>assignedGroups().some(g=>String(g.id)===String(s.group_id)));
const studentsReady=!S.studentsLoadError;
$("#roster-total").textContent=studentsReady?String(rosterStudentSet.length):"—";
$("#roster-linked").textContent=studentsReady?String(rosterStudentSet.filter(s=>!!s.user_id).length):"—";
$("#roster-missing").textContent=studentsReady?String(rosterStudentSet.filter(s=>!s.user_id).length):"—";
if(!studentsReady){
 host.innerHTML='<div class="notice error" role="alert">تعذر تحميل ملفات الطلاب من الخادم؛ لم نعرض صفرًا مضللًا ولم نغيّر أي سجل. أعد المحاولة بعد لحظة. <button class="btn secondary" id="retry-student-roster" type="button">إعادة المحاولة</button></div>';
 host.querySelector("#retry-student-roster")?.addEventListener("click",async()=>{const b=host.querySelector("#retry-student-roster");b.disabled=true;try{await load();shell();await page()}catch(e){toast(e.message||"تعذر تحديث القائمة",true);b.disabled=false}});
 return;
}
const accessibleGroups=assignedGroups();
 const groups=accessibleGroups.slice().sort((a,b)=>a.name.localeCompare(b.name,"ar")).filter(g=>selected==="all"||g.id===selected);
let html="";
for(const g of groups){
const list=S.students.filter(s=>s.group_id===g.id&&matchesLogin(s)).slice().sort((a,b)=>compareStudentNames(a.name,b.name));
html+='<section class="card"><h3>'+esc(g.name)+' <span class="muted small">('+list.length+')</span></h3><div class="list">'+(list.length?list.map(s=>{const availableGroups=accessibleGroups.filter(x=>x.id!==s.group_id);const actions=S.user.role==="student"?"":'<button class="btn secondary" data-profile-student="'+esc(s.id)+'">ملف الطالب</button>'+(!s.user_id?'<button class="btn" data-create-student-account="'+esc(s.id)+'">إنشاء دخول</button>':'<button class="btn" data-edit-student="'+esc(s.id)+'">تعديل الحساب</button><button class="btn secondary" data-reset-student-password="'+esc(s.id)+'">إعادة كلمة المرور</button>')+(availableGroups.length?'<details class="move-control"><summary class="btn secondary">نقل الفوج</summary><div class="move-control-options"><label class="field">الفوج الجديد<select data-move-student="'+esc(s.id)+'" required><option value="" selected disabled>اختر الفوج الجديد</option>'+availableGroups.map(g2=>'<option value="'+esc(g2.id)+'">'+esc(g2.name)+'</option>').join("")+'</select></label><button class="btn secondary" data-save-move="'+esc(s.id)+'">تأكيد النقل</button></div></details>':"")+(s.user_id?'<button class="btn danger" data-del-student="'+esc(s.id)+'">تعطيل</button>':"");return '<div class="list-row student-row"><div><strong>'+esc(studentDisplayName(s.name))+'</strong><small class="muted small">الفهرس الأبجدي: '+esc(studentAlphabetIndex(s.name))+'</small><small>'+(s.user_id?'اسم الدخول: '+esc(s.username||"غير متاح"):'قائمة اسمية — بلا حساب دخول')+'</small></div><div class="student-actions">'+actions+'</div></div>'}).join(""):'<div class="empty">لا يوجد طلاب في هذا الفوج.</div>')+'</div></section>';
}
if(selected==="all"&&["admin","director"].includes(S.user.role)){
const ungrouped=S.students.filter(s=>!S.groups.some(g=>g.id===s.group_id)&&matchesLogin(s)).slice().sort((a,b)=>compareStudentNames(a.name,b.name));
if(ungrouped.length)html+='<section class="card"><h3>طلاب بلا فوج ('+ungrouped.length+')</h3><div class="list">'+ungrouped.map(s=>'<div class="list-row"><div><strong>'+esc(studentDisplayName(s.name))+'</strong><small class="muted small">الفهرس الأبجدي: '+esc(studentAlphabetIndex(s.name))+'</small><small>'+(s.user_id?'اسم الدخول: '+esc(s.username||"غير متاح"):'قائمة اسمية — بلا حساب دخول')+'</small></div></div>').join("")+'</div></section>';
}
host.innerHTML=html||'<div class="empty">لا توجد أفواج لعرضها.</div>';
host.querySelectorAll("[data-profile-student]").forEach(b=>b.onclick=()=>{const id=b.dataset.profileStudent;try{history.pushState({ihsanMode:"school",ihsanTab:"students",ihsanSubView:"student-profile",studentId:id},"",location.pathname+"#student-"+encodeURIComponent(id))}catch{}studentProfile(v,id)});
host.querySelectorAll("[data-create-student-account]").forEach(b=>b.onclick=async()=>{const student=S.students.find(x=>x.id===b.dataset.createStudentAccount);if(!student)return;const username=prompt("اسم الدخول للطالب (الاسم الكامل افتراضيًا):",student.name);if(username===null||!username.trim())return;try{const result=await api("/students/"+encodeURIComponent(student.id)+"/account",{method:"POST",body:JSON.stringify({username:username.trim()})});toast("أُنشئ حساب الطالب. اسم الدخول: "+result.username+"؛ كلمة المرور الأولية 12345678 ويجب تغييرها عند أول دخول.");await load();shell();page()}catch(x){toast(x.message,true)}});
host.querySelectorAll("[data-save-move]").forEach(b=>b.onclick=async()=>{const id=b.dataset.saveMove,select=host.querySelector('[data-move-student="'+id+'"]');if(!select||!select.value)return toast("اختر الفوج الجديد",true);const student=S.students.find(x=>x.id===id);if(!student||student.group_id===select.value)return toast("اختر فوجًا مختلفًا",true);if(!confirm("نقل "+student.name+" إلى الفوج المحدد؟ سيبقى سجل الحفظ والحضور السابق محفوظًا."))return;try{await api("/students/"+encodeURIComponent(id),{method:"PATCH",body:JSON.stringify({group_id:select.value})});toast("تم نقل الطالب مع الاحتفاظ بسجله");await load();shell();page()}catch(x){toast(x.message,true)}});
host.querySelectorAll("[data-edit-student]").forEach(b=>b.onclick=async()=>{const s=S.students.find(x=>x.id===b.dataset.editStudent);if(!s)return;const name=prompt("اسم الطالب الكامل:",s.name);if(name===null)return;const username=prompt("اسم الدخول:",s.username||s.name);if(username===null)return;const password=prompt("كلمة مرور جديدة (اتركها فارغة للإبقاء على الحالية):","");if(password===null)return;try{const scrollY=window.scrollY;await api("/students/"+encodeURIComponent(s.id),{method:"PATCH",body:JSON.stringify({name,username,password})});toast("تم تعديل حساب الطالب");await load();renderRoster();window.scrollTo({top:scrollY,behavior:"auto"})}catch(x){toast(x.message,true)}});
host.querySelectorAll("[data-reset-student-password]").forEach(b=>b.onclick=async()=>{const s=S.students.find(x=>x.id===b.dataset.resetStudentPassword);if(!s||!s.user_id)return toast("لا يوجد حساب دخول لهذا الطالب",true);const password=prompt("كلمة المرور المؤقتة الجديدة (8 أحرف على الأقل):","");if(password===null)return;if(password.length<8)return toast("كلمة المرور يجب ألا تقل عن 8 أحرف",true);const confirmPassword=prompt("أعد كتابة كلمة المرور المؤقتة:","");if(confirmPassword===null)return;if(password!==confirmPassword)return toast("كلمتا المرور غير متطابقتين",true);if(!confirm("سيتم إلغاء جلسات الطالب الحالية وإجباره على تغيير كلمة المرور عند أول دخول. متابعة؟"))return;b.disabled=true;try{await api("/students/"+encodeURIComponent(s.id),{method:"PATCH",body:JSON.stringify({name:s.name,username:s.username||s.name,password})});toast("تمت إعادة التعيين؛ أرسل كلمة المرور المؤقتة للطالب على قناة خاصة");await load();renderRoster();}catch(error){toast(error.message||"تعذرت إعادة التعيين",true);b.disabled=false}});
host.querySelectorAll("[data-del-student]").forEach(b=>b.onclick=async()=>{if(!confirm("تعطيل حساب الطالب؟"))return;try{await api("/students/"+b.dataset.delStudent,{method:"DELETE"});await load();shell();page()}catch(x){toast(x.message,true)}});
}
$("#student-group-filter").onchange=renderRoster;
$("#student-login-filter").onchange=renderRoster;
$("#student-name-search")?.addEventListener("input",renderRoster);
renderRoster();
$("#bulk-onboard-students")?.addEventListener("click",async()=>{
 const candidateIds=bulkAccountCandidates();
 if(!candidateIds.length)return toast("لا توجد أسماء مكتملة تحتاج إلى حساب دخول.");
 if(!confirm("سيتم تجهيز "+candidateIds.length+" ملفًا لطلاب لا يملكون حساب دخول ضمن الأفواج النشطة. كلمة المرور الأولية 12345678 ويجب تغييرها عند أول دخول. سيُربط الحساب السابق غير المرتبط فقط عند تطابق الاسم بشكل فريد من الطرفين؛ الأسماء الملتبسة ستُترك دون إنشاء حساب مكرر. الحسابات المرتبطة مسبقًا لن تُمس. سيتم التنفيذ على دفعات صغيرة للحفاظ على استقرار الخدمة. متابعة؟"))return;
 const button=$("#bulk-onboard-students"),chunks=[];
 for(let i=0;i<candidateIds.length;i+=10)chunks.push(candidateIds.slice(i,i+10));
 const aggregate={created:0,linked_existing:0,skipped:0,credentials:[],skipped_rows:[],remaining:candidateIds.length,completed:false,processed:0};
 const renderResults=(partial=false)=>{
  const host=$("#bulk-onboarding-results");if(!host)return;
  const rows=aggregate.credentials;
  const reasonLabel={ambiguous_existing_account:"اسم ملتبس مع حساب سابق",missing_group:"بلا فوج",inactive_group:"الفوج غير نشط",already_linked:"مرتبط بحساب مسبقًا",link_race_or_conflict:"تعارض أثناء الربط",link_failed:"تعذر ربط الحساب السابق",creation_failed:"تعذر إنشاء الحساب"};
  host.innerHTML='<section class="card"><h3>بيانات الدخول المهيأة</h3><p class="muted small">'+(partial?'توقف التنفيذ بعد '+aggregate.processed+' دفعة؛ احتفظ ببيانات الدخول أدناه قبل إعادة المحاولة. ':'')+'كلمة المرور الأولية الموحدة هي 12345678، ويُلزم كل طالب بتغييرها عند أول دخول.</p><p>أُنشئت '+aggregate.created+' حسابات جديدة، ورُبطت '+aggregate.linked_existing+' حسابات موجودة غير مرتبطة، وتُركت '+aggregate.skipped+' ملفات للمراجعة دون مساس بها. المتبقي ضمن الأفواج النشطة: '+aggregate.remaining+'.</p>'+(rows.length?'<div class="table-wrap"><table><thead><tr><th>الطالب</th><th>الفوج</th><th>اسم الدخول</th><th>نوع الحساب</th><th>كلمة المرور الأولية</th></tr></thead><tbody>'+rows.map(r=>'<tr><td>'+esc(r.name)+'</td><td>'+esc((S.groups.find(g=>g.id===r.group_id)||{}).name||"—")+'</td><td dir="ltr">'+esc(r.username)+'</td><td>'+(r.linked_existing?'حساب سابق':'حساب جديد')+'</td><td dir="ltr">'+esc(r.password)+'</td></tr>').join("")+'</tbody></table></div><button id="download-bulk-credentials" class="btn" type="button">تنزيل بيانات الدخول CSV</button> <button id="hide-bulk-credentials" class="btn secondary" type="button">إخفاء كلمات المرور</button>':'')+(aggregate.skipped_rows.length?'<details><summary>الملفات التي تحتاج مراجعة ('+aggregate.skipped_rows.length+')</summary><ul>'+aggregate.skipped_rows.map(x=>'<li>'+esc(x.name||x.student_id)+' — '+esc(reasonLabel[x.reason]||x.reason)+'</li>').join("")+'</ul></details>':'')+'</section>';
  $("#download-bulk-credentials")?.addEventListener("click",()=>{
   const csv="\uFEFF"+[["اسم الطالب","الفوج","اسم الدخول","نوع الحساب","كلمة المرور الأولية"],...rows.map(r=>[r.name,(S.groups.find(g=>g.id===r.group_id)||{}).name||"",r.username,r.linked_existing?"حساب سابق":"حساب جديد",r.password])].map(row=>row.map(v=>'"'+String(v??"").replace(/"/g,'""')+'"').join(",")).join("\r\n");
   const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));const link=document.createElement("a");link.href=url;link.download="ihsan-student-login-credentials.csv";document.body.append(link);link.click();link.remove();window.setTimeout(()=>URL.revokeObjectURL(url),1500);
  });
  $("#hide-bulk-credentials")?.addEventListener("click",()=>{$("#bulk-onboarding-results").textContent="أُخفيت كلمات المرور من الشاشة؛ احتفظ بملف التنزيل الآمن."});
 };
 if(button){button.disabled=true;button.textContent="جار تجهيز 0 / "+chunks.length+"…"}
 try{
  for(let i=0;i<chunks.length;i++){
   if(button)button.textContent="جار تجهيز "+(i+1)+" / "+chunks.length+"…";
   const result=await api("/admin/students/bulk-onboarding",{method:"POST",body:JSON.stringify({student_ids:chunks[i]})});
   aggregate.created+=Number(result.created||0);
   aggregate.linked_existing+=Number(result.linked_existing||0);
   aggregate.skipped+=Number(result.skipped||0);
   aggregate.credentials.push(...(Array.isArray(result.credentials)?result.credentials:[]));
   aggregate.skipped_rows.push(...(Array.isArray(result.skipped_rows)?result.skipped_rows:[]));
   aggregate.remaining=Number(result.remaining||0);
   aggregate.completed=result.completed===true;
   aggregate.processed=i+1;
  }
  await load();shell();await page();
  renderResults(false);
  if(aggregate.completed)document.querySelector(".roster-actions")?.remove();
  toast("تم تجهيز الحسابات: "+aggregate.created+" جديد، و"+aggregate.linked_existing+" ربط آمن، و"+aggregate.skipped+" للمراجعة.");
 }catch(err){
  renderResults(true);
  const b=$("#bulk-onboard-students");if(b){b.disabled=false;b.textContent="إعادة محاولة الملفات المتبقية"};
  toast("توقف التجهيز بعد "+aggregate.processed+" من "+chunks.length+" دفعات: "+(err.message||"خطأ غير متوقع"),true);
 }
});
$("#roster-add-form")?.addEventListener("submit",async e=>{
 e.preventDefault();const form=e.currentTarget,button=form.querySelector('button[type="submit"]'),values=new FormData(form),names=String(values.get("names")||"").split(/\r?\n/).map(x=>x.trim()).filter(Boolean),group_id=String(values.get("group_id")||"");
 if(!group_id||!names.length)return toast("اختر الفوج وأدخل الأسماء.",true);if(names.length>100)return toast("الحد الأقصى 100 اسم في الدفعة الواحدة.",true);
 const group=(S.groups.find(g=>g.id===group_id)||{}).name||"الفوج المحدد";
 if(!confirm("سيتم إضافة الأسماء إلى «"+group+"» دون إنشاء حسابات دخول. ستُحفظ الأسماء المكررة بالعدد المطلوب، ولن تُحذف أي سجلات موجودة. متابعة؟"))return;
 if(button){button.disabled=true;button.textContent="جار إضافة الأسماء…"}
 try{const result=await api("/admin/roster-add",{method:"POST",body:JSON.stringify({group_id,names})});toast("تمت إضافة "+Number(result.created||0)+" طالبًا؛ تم تجاوز "+Number(result.skipped||0)+" اسمًا موجودًا بالفعل.");await load();shell();await page()}
 catch(err){toast(err.message,true);if(button){button.disabled=false;button.textContent="إضافة القائمة إلى الفوج المحدد"}}
});
$("#sform")?.addEventListener("submit",async e=>{e.preventDefault();const f=new FormData(e.currentTarget),button=e.currentTarget.querySelector("button");if(button)button.disabled=true;try{const created=await api("/students",{method:"POST",body:JSON.stringify({name:f.get("name"),username:String(f.get("name")||"").trim(),group_id:f.get("group_id")})});toast("تم إنشاء الطالب؛ اسم الدخول: "+created.username+"؛ كلمة المرور الأولية 12345678 ويجب تغييرها عند أول دخول.");await load();shell();page()}catch(x){toast(x.message,true);if(button)button.disabled=false}});
}
function calendarMarkup(selected,marked,viewMonth){
 const picked=selected||localDateISO(),view=viewMonth||picked.slice(0,7)+"-01",month=new Date(view+"T12:00:00"),y=month.getFullYear(),m=month.getMonth(),offset=(new Date(y,m,1,12).getDay()+6)%7,days=new Date(y,m+1,0,12).getDate(),marks=new Set(marked||[]),names=["الإثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت","الأحد"];
 let h='<section class="date-calendar" data-view-month="'+view+'"><style>.date-calendar{margin:14px 0;padding:14px;border:1px solid var(--line);border-radius:16px;background:var(--surface);color:var(--ink)}.date-calendar *{box-sizing:border-box}.calendar-toolbar,.calendar-day-nav{display:flex;align-items:center;justify-content:space-between;gap:8px}.calendar-toolbar strong{font-size:1rem}.calendar-toolbar button,.calendar-day-nav button{border:1px solid var(--line);background:var(--surface-2);color:var(--ink);border-radius:10px;padding:8px 12px;cursor:pointer}.calendar-day-nav{margin:12px 0}.calendar-day-nav button{flex:1}.calendar-weekdays,.calendar-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:5px}.calendar-weekdays span{text-align:center;color:var(--muted);font-size:.76rem;padding:6px 0}.calendar-day,.calendar-empty{position:relative;min-height:38px;border-radius:9px}.calendar-day{border:1px solid transparent;background:var(--surface-2);color:var(--ink);cursor:pointer;font:inherit}.calendar-day.has-record{background:#d8f5e6;color:#075c3d;border-color:#39a875;font-weight:800}.calendar-day.has-record:after{content:"";position:absolute;width:5px;height:5px;border-radius:50%;background:#087443;bottom:4px;left:calc(50% - 2px)}.calendar-day.is-selected{outline:2px solid var(--gold);outline-offset:1px}.calendar-day.has-record.is-selected{background:#a7e8c6}.calendar-legend{display:flex;gap:7px;align-items:center;margin-top:10px;color:var(--muted);font-size:.82rem}.calendar-legend i{width:10px;height:10px;border-radius:3px;background:#d8f5e6;border:1px solid #39a875;display:inline-block}@media(max-width:420px){.date-calendar{padding:9px}.calendar-grid,.calendar-weekdays{gap:3px}.calendar-day,.calendar-empty{min-height:34px}.calendar-toolbar button,.calendar-day-nav button{padding:7px 9px}}</style><div class="calendar-toolbar"><button type="button" data-cal-month="-1">‹</button><strong>'+month.toLocaleDateString("ar-DZ",{month:"long",year:"numeric"})+'</strong><button type="button" data-cal-month="1">›</button></div><div class="calendar-day-nav"><button type="button" data-cal-shift="-1">← أمس</button><span class="muted small">'+new Date(picked+"T12:00:00").toLocaleDateString("ar-DZ",{weekday:"long",day:"numeric",month:"short"})+'</span><button type="button" data-cal-shift="1">غدًا →</button></div><div class="calendar-weekdays">'+names.map(n=>'<span>'+n+'</span>').join("")+'</div><div class="calendar-grid">';
 for(let i=0;i<offset;i++)h+='<span class="calendar-empty"></span>';
 for(let d=1;d<=days;d++){const iso=y+"-"+String(m+1).padStart(2,"0")+"-"+String(d).padStart(2,"0");h+='<button type="button" class="calendar-day '+(iso===picked?'is-selected ':'')+(marks.has(iso)?'has-record':'')+'" data-cal-pick="'+iso+'">'+d+'</button>'}
 return h+'</div><div class="calendar-legend"><i></i><span>يوم له سجل حضور محفوظ</span></div></section>';
}
async function attendance(v){
 const student=S.user.role==="student";let date=S.date||localDateISO(),marked=[],rows=[];
 if(student){const rs=await Promise.allSettled([api("/attendance?date="+encodeURIComponent(date)),api("/attendance?history=1")]);rows=rs[0].status==="fulfilled"?rs[0].value:[];marked=rs[1].status==="fulfilled"?[...new Set(rs[1].value.map(r=>r.date).filter(Boolean))]:[];v.innerHTML=head("حضوري","اختر يومًا من التقويم؛ الأيام الخضراء لها سجل محفوظ.")+'<div class="card"><label class="field">التاريخ<input id="date" type="date" value="'+date+'"></label><div id="date-calendar">'+calendarMarkup(date,marked)+'</div><div class="divider"></div><div class="list">'+(rows.length?rows.map(r=>'<div class="list-row"><div><strong>'+esc(r.date)+'</strong><small>'+esc(r.note||"")+'</small></div><span class="pill">'+({"present":"حاضر","absent":"غائب","late":"متأخر","excused":"بعذر"}[r.status]||r.status)+'</span></div>').join(""):'<div class="empty">لا يوجد سجل لهذا التاريخ.</div>')+'</div></div>'}
 else v.innerHTML=head("تسجيل الحضور ومعاينته","اختر فوجك واليوم، ثم عاين السجل أو سجّل الحالات. التقارير الأسبوعية داخل هذه الصفحة.")+'<div class="card"><div class="attendance-controls"><label class="field">الفوج<select id="ag"><option value="">اختر فوجك</option>'+assignedGroups().map(g=>'<option value="'+esc(g.id)+'">'+esc(g.name)+'</option>').join("")+'</select></label><label class="field">التاريخ<input id="ad" type="date" value="'+date+'"></label><button id="preview-att" class="btn secondary">معاينة الحضور</button><button id="load-att" class="btn">تسجيل / تعديل الحضور</button><label class="field report-period-select">فترة التقرير<select id="attendance-report-period"><option value="week">أسبوعي · آخر 7 أيام</option><option value="month">شهري · الشهر الحالي</option></select></label><button id="weekly-report-toggle" class="btn secondary" type="button" aria-expanded="false">عرض التقرير وطباعته</button></div><div id="date-calendar">'+calendarMarkup(date,[])+'</div><div id="att-list" class="muted small">اختر الفوج والتاريخ ثم اعرض السجل.</div><div id="weekly-report-inline" hidden></div></div>';
 const input=$(student?"#date":"#ad"),cal=$("#date-calendar");
 const redraw=(view)=>{cal.innerHTML=calendarMarkup(input.value,marked,view||cal.querySelector(".date-calendar")?.dataset.viewMonth||input.value.slice(0,7)+"-01")};
 const choose=async d=>{input.value=d;S.date=d;safeStore.set("ihsan_attendance_date",d);if(student){await attendance(v)}else redraw(d.slice(0,7)+"-01")};
 cal.addEventListener("click",async e=>{const b=e.target.closest("button");if(!b)return;if(b.dataset.calMonth){const d=new Date((cal.querySelector(".date-calendar")?.dataset.viewMonth||input.value.slice(0,7)+"-01")+"T12:00:00");d.setMonth(d.getMonth()+Number(b.dataset.calMonth));redraw(d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-01")}else if(b.dataset.calPick)await choose(b.dataset.calPick);else if(b.dataset.calShift){const d=new Date(input.value+"T12:00:00");d.setDate(d.getDate()+Number(b.dataset.calShift));await choose(d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"))}});
 input.addEventListener("change",()=>{if(input.value){S.date=input.value;safeStore.set("ihsan_attendance_date",input.value);if(student)attendance(v);else redraw(input.value.slice(0,7)+"-01")}});
 if(student)return;
 $("#ag").addEventListener("change",async()=>{const g=$("#ag").value;if(!g){marked=[];redraw();return}try{const h=await api("/attendance?group_id="+encodeURIComponent(g)+"&history=1");marked=[...new Set(h.map(r=>r.date).filter(Boolean))];redraw()}catch(e){toast("تعذّر تحميل الأيام المسجّلة: "+e.message,true)}});
 $("#weekly-report-toggle").addEventListener("click",async()=>{const host=$("#weekly-report-inline"),button=$("#weekly-report-toggle");if(!host)return;if(!host.hidden){host.hidden=true;button.setAttribute("aria-expanded","false");return}const gid=$("#ag").value;if(!gid)return toast("اختر الفوج أولًا",true);host.hidden=false;button.setAttribute("aria-expanded","true");host.innerHTML='<div class="loading">جار إعداد التقرير الدوري…</div>';try{const rows=await api("/attendance?group_id="+encodeURIComponent(gid)+"&history=1");const period=$("#attendance-report-period")?.value||"week",today=localDateISO(),cutoff=period==="month"?today.slice(0,7)+"-01":shiftLocalDateISO(today,-6),periodRows=rows.filter(r=>String(r.date)>=cutoff&&String(r.date)<=today),students=S.students.filter(st=>String(st.group_id)===String(gid)).slice().sort((a,b)=>compareStudentNames(a.name,b.name)),count=(id,status)=>periodRows.filter(r=>r.student_id===id&&r.status===status).length;const present=periodRows.filter(r=>r.status==="present").length,absent=periodRows.filter(r=>r.status==="absent").length,late=periodRows.filter(r=>r.status==="late").length,periodLabel=period==="month"?"الشهري":"الأسبوعي",reportTitle="التقرير "+periodLabel+" للحضور — "+((S.groups.find(g=>String(g.id)===String(gid))||{}).name||"الفوج");const reportTable='<table><thead><tr><th>الطالب</th><th>حاضر</th><th>غائب</th><th>متأخر</th><th>بعذر</th><th>السجلات</th></tr></thead><tbody>'+students.map(st=>'<tr><td>'+esc(studentDisplayName(st.name))+'</td><td>'+count(st.id,"present")+'</td><td>'+count(st.id,"absent")+'</td><td>'+count(st.id,"late")+'</td><td>'+count(st.id,"excused")+'</td><td>'+periodRows.filter(r=>String(r.student_id)===String(st.id)).length+'</td></tr>').join("")+'</tbody></table>';host.innerHTML='<section class="card weekly-inline-report"><div class="section-head"><div><h3>'+esc(reportTitle)+'</h3><p class="muted small">'+esc(cutoff)+' إلى '+esc(today)+'</p></div><div class="report-actions"><button class="btn secondary" id="share-weekly-inline" type="button">مشاركة</button><button class="btn secondary" id="print-weekly-inline" type="button">تحميل PDF</button></div></div><div class="stats"><div class="stat"><small>سجلات الفترة</small><strong>'+periodRows.length+'</strong></div><div class="stat"><small>حاضر</small><strong>'+present+'</strong></div><div class="stat"><small>غائب</small><strong>'+absent+'</strong></div><div class="stat"><small>متأخر</small><strong>'+late+'</strong></div></div><div class="table-wrap">'+reportTable+'</div></section>';$("#share-weekly-inline").onclick=async()=>{const textReport=reportTitle+"\nالفترة: "+cutoff+" إلى "+today+"\nحضور: "+present+"، غياب: "+absent+"، تأخر: "+late+"\n"+students.map(st=>st.name+": حاضر "+count(st.id,"present")+"، غائب "+count(st.id,"absent")+"، متأخر "+count(st.id,"late")+"، بعذر "+count(st.id,"excused")).join("\n");try{if(navigator.share)await navigator.share({title:reportTitle,text:textReport});else if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(textReport);toast("نُسخ التقرير للمشاركة")}else toast("المشاركة غير مدعومة في هذا المتصفح.",true)}catch(e){if(e.name!=="AbortError")toast("تعذّرت مشاركة التقرير.",true)}};$("#print-weekly-inline").onclick=()=>printReportWindow(reportTitle,reportTable,cutoff+" إلى "+today);}catch(e){host.innerHTML='<div class="notice error">'+esc(e.message)+'</div>'}});
 async function showAttendance(edit){const group=$("#ag").value,day=$("#ad").value;if(!group)return toast("اختر الفوج",true);try{const pair=await Promise.all([api("/students?group_id="+encodeURIComponent(group)),api("/attendance?group_id="+encodeURIComponent(group)+"&date="+encodeURIComponent(day))]);const students=pair[0],old={};pair[1].forEach(x=>old[x.student_id]=x);const host=$("#att-list");if(!students.length){host.innerHTML='<div class="empty">لا يوجد طلاب في هذا الفوج.</div>';return}const statusName=x=>({"present":"حاضر","absent":"غائب","late":"متأخر","excused":"بعذر"}[x]||"غير مسجل");if(!edit){host.innerHTML='<div class="card"><h3>معاينة سجل الحضور</h3><p class="muted small">'+esc((S.groups.find(g=>g.id===group)||{}).name||"الفوج")+' · '+esc(day)+' · '+students.length+' طالبًا</p><div class="table-wrap"><table><thead><tr><th>الطالب</th><th>الحالة المسجلة</th><th>الملاحظة</th></tr></thead><tbody>'+students.map(st=>'<tr><td>'+esc(studentDisplayName(st.name))+'</td><td><span class="pill">'+statusName(old[st.id]?.status)+'</span></td><td>'+esc(old[st.id]?.note||"—")+'</td></tr>').join("")+'</tbody></table></div><p class="muted small">هذه معاينة فقط؛ لم يُحفظ أي تغيير.</p><button id="edit-after-preview" class="btn">تعديل هذا السجل</button></div>';$("#edit-after-preview").onclick=()=>showAttendance(true);return}host.innerHTML='<form id="attform"><p class="muted small">غيّر الحالات ثم اضغط «حفظ الحضور». لن تُحفظ التغييرات قبل الضغط.</p><div class="attendance-bulk-actions"><button type="button" id="att-all-present" class="btn secondary">الكل حاضر</button><button type="button" id="att-all-absent" class="btn secondary">الكل غائب</button></div><div class="table-wrap"><table><thead><tr><th>الطالب</th><th>الحالة</th><th>ملاحظة</th></tr></thead><tbody>'+students.map(st=>'<tr><td>'+esc(studentDisplayName(st.name))+'</td><td><select class="status-select" name="st_'+esc(st.id)+'"><option value="present" '+((old[st.id]?.status||"present")==="present"?"selected":"")+'>حاضر</option><option value="absent" '+(old[st.id]?.status==="absent"?"selected":"")+'>غائب</option><option value="late" '+(old[st.id]?.status==="late"?"selected":"")+'>متأخر</option><option value="excused" '+(old[st.id]?.status==="excused"?"selected":"")+'>بعذر</option></select></td><td><input name="note_'+esc(st.id)+'" value="'+esc(old[st.id]?.note||"")+'" style="width:120px" placeholder="اختياري"></td></tr>').join("")+'</tbody></table></div><button class="btn" style="margin-top:15px">حفظ الحضور</button><button type="button" id="back-preview" class="btn secondary" style="margin:15px 8px 0">رجوع إلى المعاينة</button></form>';$("#back-preview").onclick=()=>showAttendance(false);$("#att-all-present").onclick=()=>{$("#attform").querySelectorAll(".status-select").forEach(sel=>sel.value="present");toast("تم تحديد جميع الطلبة حاضرين؛ اضغط حفظ الحضور للتأكيد")};$("#att-all-absent").onclick=()=>{$("#attform").querySelectorAll(".status-select").forEach(sel=>sel.value="absent");toast("تم تحديد جميع الطلبة غائبين؛ اضغط حفظ الحضور للتأكيد")};$("#attform").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.currentTarget),items=students.map(st=>({student_id:st.id,status:f.get("st_"+st.id),note:f.get("note_"+st.id)}));try{const r=await api("/attendance",{method:"POST",body:JSON.stringify({group_id:group,date:day,items})});toast(r.queued_offline?"حُفظ الحضور على هذا الجهاز، وسيتزامن عند عودة الاتصال.":"تم حفظ حضور "+r.saved+" طالبًا");marked=[...new Set([...marked,day])];redraw();showAttendance(false)}catch(x){toast(x.message,true)}}}catch(x){toast(x.message,true)}}
 $("#preview-att").onclick=()=>showAttendance(false);$("#load-att").onclick=()=>showAttendance(true);
}

function quranPlanMarkup(levels,plan,studentId,isStudent){
 const currentPath=(plan&&plan.path_id)||"starter";
 const selectedLevel=levels.find(x=>x.id===currentPath)||levels[0]||{weekly_goal_default:"ورد أسبوعي ثابت"};
 const goal=(plan&&plan.weekly_goal)||selectedLevel.weekly_goal_default||"ورد أسبوعي ثابت من الحفظ والمراجعة";
 const existingTargets=Array.isArray(plan?.weekly_targets)?plan.weekly_targets:[];
 const field=(week,key,label,placeholder)=>'<label class="field">'+label+'<textarea data-week-target="'+week+'" data-week-part="'+key+'" rows="2" maxlength="180" placeholder="'+placeholder+'">'+esc(existingTargets[week]?.[key]||"")+'</textarea></label>';
 const weeks=[0,1,2,3].map(i=>'<details class="quran-week-target" '+(i===0?'open':"")+'><summary><strong>الأسبوع '+(i+1)+'</strong><span class="muted small">الحفظ والمراجعة والفهم والعمل</span></summary><div class="quran-week-fields">'+
 field(i,"memorization","الحفظ الجديد","حدّد مقدار الحفظ الجديد")+
 field(i,"revision","المراجعة","ما الذي ستراجعه من المحفوظ؟")+
 field(i,"understanding","الفهم والتدبر","معنى أو فائدة ستفهمها")+
 field(i,"application","التطبيق والعمل","عمل واحد تطبّق به ما تعلمت")+
 '</div></details>').join("");
 return '<section class="card quran-plan-card"><div class="eyebrow">مسار قرآني يناسب قدرتك</div><h3>اختر المسار والهدف الأسبوعي</h3><p class="muted small">الاتساق والإتقان مقدّمان على كثرة المقدار. اختر هدفًا يمكن الاستمرار عليه، وعدّله مع المعلم عند الحاجة.</p><form class="quran-plan-form stack" data-quran-plan-form>'+(isStudent?"":'<input type="hidden" name="student_id" value="'+esc(studentId)+'">')+'<label class="field">المسار القرآني<select name="path_id">'+levels.map(l=>'<option value="'+esc(l.id)+'" data-goal="'+esc(l.weekly_goal_default||"")+'" '+(l.id===currentPath?'selected':"")+'>'+esc(l.name)+(l.duration_days?' · '+l.duration_days+' يومًا':"")+'</option>').join("")+'</select></label><p class="muted small" data-quran-path-description>'+esc(selectedLevel.description||"")+'</p><label class="field">الهدف الأسبوعي<textarea name="weekly_goal" required maxlength="250" rows="2">'+esc(goal)+'</textarea></label><h4>خطة الأسابيع الأربعة القادمة</h4><p class="muted small">افتح كل أسبوع وحدّد الحفظ والمراجعة ومعنى تتدبّره وعملًا تطبّقه. تُحفظ هذه الأهداف في خطة الطالب.</p>'+weeks+'<button class="btn" type="submit">حفظ المسار والأهداف</button></form><p class="muted small">عند تفعيل خيار التكرار في الاختبار، تُجهّز الدورة التالية كلما فُتح قسم الاختبارات بعد موعدها. راجع القسم بانتظام لتظهر الدورة المستحقة.</p></section>';
}
function wireQuranPlan(host,levels){
 const form=host.querySelector("[data-quran-plan-form]");if(!form)return;
 const pathSelect=form.elements.path_id,goal=form.elements.weekly_goal,description=form.querySelector("[data-quran-path-description]");
 pathSelect.onchange=()=>{const opt=pathSelect.selectedOptions[0];if(opt.dataset.goal)goal.value=opt.dataset.goal;const item=levels.find(x=>x.id===pathSelect.value);if(description)description.textContent=item?.description||""};
 form.onsubmit=async e=>{
  e.preventDefault();const data=new FormData(form);
  const body={path_id:data.get("path_id"),weekly_goal:data.get("weekly_goal"),weekly_targets:[0,1,2,3].map(i=>({week:i+1,
   memorization:form.querySelector('[data-week-target="'+i+'"][data-week-part="memorization"]')?.value.trim()||"",
   revision:form.querySelector('[data-week-target="'+i+'"][data-week-part="revision"]')?.value.trim()||"",
   understanding:form.querySelector('[data-week-target="'+i+'"][data-week-part="understanding"]')?.value.trim()||"",
   application:form.querySelector('[data-week-target="'+i+'"][data-week-part="application"]')?.value.trim()||""
  }))};
  if(data.get("student_id"))body.student_id=data.get("student_id");
  const btn=form.querySelector("button[type=submit],button:not([type])");if(btn)btn.disabled=true;
  try{await api("/quran/plan",{method:"POST",body:JSON.stringify(body)});toast("تم حفظ المسار والأهداف الأربعة");if(S.user.role==="student"){await quran($("#view"))}else{const id=body.student_id;if(id)await loadQuranPlan(id)}}catch(x){toast(x.message,true)}finally{if(btn)btn.disabled=false}
 };
}
function quranActivityName(a){return ({memorization:"حفظ جديد",revision:"مراجعة",recitation:"تسميع",correction:"تصحيح"})[a]||"متابعة قرآنية"}
function quranProgressSummary(rows){
 return '<div class="stats"><div class="stat"><small>سجلات المتابعة</small><strong>'+rows.length+'</strong></div><div class="stat"><small>سجلات التسميع</small><strong>'+rows.filter(r=>r.activity==="recitation").length+'</strong></div><div class="stat"><small>سجلات المراجعة</small><strong>'+rows.filter(r=>r.activity==="revision").length+'</strong></div><div class="stat"><small>متوسط التقدير</small><strong>'+(rows.filter(r=>r.grade!==null&&r.grade!==undefined&&r.grade!=="").length?(rows.reduce((n,r)=>n+(r.grade!==null&&r.grade!==undefined&&r.grade!==""?Number(r.grade)||0:0),0)/rows.filter(r=>r.grade!==null&&r.grade!==undefined&&r.grade!=="").length).toFixed(1):"—")+'</strong></div></div>';
}
function quranPeriodReportMarkup(rows){
 const today=localDateISO(),weekStart=shiftLocalDateISO(today,-6),monthStart=today.slice(0,7)+"-01";
 const stats=(period)=>{const filtered=rows.filter(r=>String(r.date||"")>=period.start&&String(r.date||"")<=today);return {rows:filtered,entries:filtered.length,memorization:filtered.filter(r=>r.activity==="memorization").length,revision:filtered.filter(r=>r.activity==="revision").length,thumns:new Set(filtered.flatMap(r=>[r.memorized,r.reviewed]).filter(Boolean)).size,days:new Set(filtered.map(r=>r.date).filter(Boolean)).size};};
 const w=stats({start:weekStart}),m=stats({start:monthStart});
 const card=(label,x)=>'<article class="card"><h4>'+label+'</h4><div class="stats"><div class="stat"><small>عدد المتابعات</small><strong>'+x.entries+'</strong></div><div class="stat"><small>أيام المتابعة</small><strong>'+x.days+'</strong></div><div class="stat"><small>الحفظ</small><strong>'+x.memorization+'</strong></div><div class="stat"><small>المراجعة</small><strong>'+x.revision+'</strong></div></div></article>';
 return '<section class="card quran-period-report"><div class="section-head"><div><h3>التقرير الدوري لالحفظ والمراجعة</h3><p class="muted small">ملخص تلقائي من سجلات الحفظ والمراجعة المسجلة.</p></div></div><div class="report-period-grid">'+card("الأسبوع الحالي · آخر 7 أيام",w)+card("الشهر الحالي",m)+'</div></section>';
}
const QURAN_CAT_UI={
  "15":{label:"15 حزبًا",thabit:0.125,thabitLabel:"ثمن حزب",hint:"التثبيت اليومي: ثمن حزب، خمسة أيام في الأسبوع."},
  "30":{label:"30 حزبًا",thabit:0.25,thabitLabel:"ربع حزب",hint:"التثبيت اليومي: ربع حزب، خمسة أيام في الأسبوع."},
  "45":{label:"45 حزبًا",thabit:0.375,thabitLabel:"ثلاثة أثمان حزب",hint:"التثبيت اليومي: ثلاثة أثمان حزب، خمسة أيام في الأسبوع."},
  "60":{label:"60 حزبًا",thabit:0.5,thabitLabel:"نصف حزب",hint:"التثبيت اليومي: نصف حزب، خمسة أيام في الأسبوع."}
};
const QURAN_PLAN_UI={plan_a:"الخطة الأولى · المكثفة",plan_b:"الخطة الثانية · المتوسطة",plan_c:"الخطة الثالثة · المتدرجة"};
const QURAN_WARD_UI={1:"حزب واحد",2:"حزبان",4:"أربعة أحزاب"};
const QURAN_WEEKDAYS=["الأحد","الإثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];
const QURAN_KIND_UI={
  hifz:{label:"الحفظ الجديد",eyebrow:"الحفظ",hint:"سجّل ما حفظته اليوم من خطتك المختارة، مع الربط بما سبقه."},
  thabit:{label:"التثبيت",eyebrow:"التثبيت",hint:"المقدار الجديد يكرر خمس عشرة مرة غيبًا، مع الربط بما سبق."},
  ward:{label:"الورد",eyebrow:"الورد",hint:"الورد مستقل عن الحفظ والتثبيت؛ ما لم يُحفظ يُقرأ من المصحف."}
};
const QURAN_REASON_UI={shortcoming:"تقصير",interruption:"انقطاع",incapacity:"عجز عن الإنجاز",circumstance:"ظرف يحتاج إلى معالجة"};
const QURAN_STATION_UI={scheduled:"مجدولة",approved:"معتمدة",rejected:"مرفوضة",cancelled:"ملغاة"};
const QURAN_MAKEUP_UI={open:"مفتوح",planned:"مجدول",done:"منجز",cancelled:"ملغى"};
function quranFmtAmount(value,unit){
  const n=Number(value)||0;
  const names={0.125:"ثمن",0.25:"ربع",0.375:"ثلاثة أثمان",0.5:"نصف",0.75:"ثلاثة أرباع"};
  if(names[n])return names[n]+" "+(unit||"حزب");
  const shown=Number.isInteger(n)?String(n):String(Number(n.toFixed(2)));
  return shown+(unit?" "+unit:"");
}
function quranScorePreview(values){
  const safe=v=>Math.max(0,Number(v)||0);
  const accuracy=Math.max(0,50-Math.min(50,safe(values.errors)*2));
  const steady=Math.max(0,20-Math.min(20,safe(values.hesitations)*2));
  const flow=Math.max(0,15-Math.min(15,safe(values.prompts)*3));
  let time=15;
  if(safe(values.expected_minutes)>0&&safe(values.minutes)>safe(values.expected_minutes)){const over=(safe(values.minutes)-safe(values.expected_minutes))/safe(values.expected_minutes);time=Math.max(0,15-Math.ceil(over*15))}
  const total=Math.max(0,Math.min(100,Math.round(accuracy+steady+flow+time)));
  return {accuracy,steady,flow,time,total};
}
function quranGradeLabel(score){const n=Number(score)||0;if(n>=95)return "متقن";if(n>=85)return "ممتاز";if(n>=75)return "جيد جدًا";if(n>=60)return "جيد";return "يحتاج إلى تثبيت"}
function quranTabsMarkup(active){
  const tabs=[["daily","يومي"],["plan","خطتي"],["schedule","جدولي"],["companion","الرفيق"],["stations","المحطات والاستدراك"]];
  return '<nav class="quran-subtabs" aria-label="أقسام مسار القرآن">'+tabs.map(([id,label])=>'<button type="button" class="quran-subtab '+(id===active?"is-active":"")+'" data-quran-tab="'+id+'">'+label+'</button>').join("")+'</nav>';
}
function quranOption(value,label,selected){
  return '<option value="'+esc(String(value))+'" '+(String(selected)===String(value)?"selected":"")+'>'+esc(label)+'</option>';
}
function quranEnrollMarkup(existing){
  const p=existing||{},editing=Boolean(existing);
  return '<section class="card quran-enroll"><div class="section-head"><div><span class="eyebrow">'+(editing?"تعديل الخطة":"بداية الرحلة")+'</span><h3>'+(editing?"خطتك وفئة محفوظك":"اختر خطتك وفئة محفوظك")+'</h3><p>الطالب يختار الخطة التي تناسب طاقته، ويلتزم بها؛ ولا تغيّرها المنصة تلقائيًا. الجداول التفصيلية تُضاف لاحقًا، وهذا الهيكل يستقبلها دون إعادة بناء.</p></div></div>'+
    '<form id="quran-enroll-form" class="quran-enroll-form">'+
    '<div class="quran-enroll-grid">'+
    '<label class="field">خطة الحفظ<select name="hifz_plan">'+Object.entries(QURAN_PLAN_UI).map(([id,label])=>quranOption(id,label,p.hifz_plan)).join("")+'</select></label>'+
    '<label class="field">فئة المحفوظ<select name="hifz_category">'+Object.entries(QURAN_CAT_UI).map(([id,item])=>quranOption(id,item.label+" — "+item.thabitLabel+" يوميًا",p.hifz_category)).join("")+'</select></label>'+
    '<label class="field">مقدار الحفظ اليومي<input name="hifz_amount" required maxlength="80" value="'+esc(p.hifz_amount||"")+'" placeholder="مثال: 5 أسطر أو صفحة"></label>'+
    '<label class="field">وحدة القياس<select name="hifz_unit">'+["سطر","صفحة","آية","وجه"].map(unit=>quranOption(unit,unit,p.hifz_unit||"سطر")).join("")+'</select></label>'+
    '<label class="field">الورد اليومي<select name="ward_ahzab">'+Object.entries(QURAN_WARD_UI).map(([id,label])=>quranOption(id,label,p.ward_ahzab)).join("")+'</select></label>'+
    '<label class="field">يوم الاستدراك (اختياري)<select name="rest_day"><option value="" '+(p.rest_day===null||p.rest_day===undefined?"selected":"")+'>بدون تثبيت يوم</option>'+QURAN_WEEKDAYS.map((name,i)=>quranOption(i,name,p.rest_day)).join("")+'</select></label>'+
    '<label class="field">تاريخ البداية<input type="date" name="start_date" value="'+esc(p.start_date||localDateISO())+'"></label>'+
    '</div>'+
    '<p class="muted small">المكثفة: صفحتان يوميًا · المتوسطة: صفحة واحدة · المتدرجة: وجه. يوم استدراك أسبوعي اختياري وأسبوع بعد كل شهر، ويمكن تغيير اليوم لاحقًا.</p>'+
    '<button class="btn" type="submit">'+(editing?"حفظ التعديل":"بدء المسار")+'</button></form></section>';
}
function quranLogCard(kind,pathInfo,logged){
  const meta=QURAN_KIND_UI[kind];
  const defaults=kind==="thabit"?{amount:pathInfo.thabit_amount,unit:"حزب",reps:15,link:"ربط المحفوظ بما سبقه"}
    :kind==="ward"?{amount:pathInfo.ward_ahzab,unit:"حزب",reps:0,link:""}
    :{amount:"",unit:pathInfo.hifz_unit||"سطر",reps:0,link:""};
  const units=kind==="hifz"?["سطر","صفحة","آية","وجه"]:["حزب","ثمن حزب","ربع حزب"];
  const done=logged?'<div class="quran-log-done"><strong>تم تسجيل '+meta.label+' اليوم</strong><small>'+esc(quranFmtAmount(logged.amount,logged.unit))+(Number(logged.repetitions)?' · '+Number(logged.repetitions)+' تكرار':'')+'</small>'+(logged.notes?'<small>'+esc(logged.notes)+'</small>':"")+'</div>'
    :'<form class="quran-log-form" data-quran-log="'+kind+'"><div class="quran-log-fields"><label class="field">المقدار<input type="number" step="0.01" min="0" max="1000" name="amount" required value="'+esc(defaults.amount)+'"></label><label class="field">الوحدة<select name="unit">'+units.map(u=>'<option '+(u===defaults.unit?"selected":"")+'>'+u+'</option>').join("")+'</select></label>'+(kind==="hifz"?'':'<label class="field">التكرارات<input type="number" min="0" max="100" name="repetitions" value="'+defaults.reps+'"></label>')+'</div>'+
      (kind==="hifz"?'<label class="field">الربط التراكمي<input name="linked_scope" maxlength="120" placeholder="مثال: ربط آخر وجه بما قبله"></label>':'')+
      '<label class="field">ملاحظة<textarea name="notes" rows="2" maxlength="600" placeholder="موضع خطأ أو ملاحظة قصيرة…"></textarea></label><button class="btn" type="submit">تسجيل '+meta.label+'</button></form>';
  return '<article class="card quran-log-card '+(logged?"is-done":"")+'"><div class="section-head"><div><span class="eyebrow">'+meta.eyebrow+'</span><h3>'+meta.label+'</h3><p>'+meta.hint+'</p></div><span class="pill">'+(logged?"سُجّل":"لم يُسجّل")+'</span></div>'+done+'</article>';
}
function quranJourneyMarkup(summary,pathInfo,stations){
  const totals=summary?.totals||{},makeups=summary?.makeups||{};
  const thabit=Number(totals.thabit?.total||0),ward=Number(totals.ward?.total||0);
  const approvedStages=new Set((stations||[]).filter(row=>row.status==="approved").map(row=>String(row.stage)));
  const gates=["15","30","45","60"].map(stage=>{
    const approved=approvedStages.has(stage);
    return '<div class="quran-gate '+(approved?"is-approved":"")+'"><span>'+stage+'</span><strong>'+stage+' حزبًا</strong><small>'+(approved?"معتمدة":"بانتظار الشيخ")+'</small></div>';
  }).join("");
  return '<section class="card quran-journey"><div class="section-head"><div><span class="eyebrow">الرحلة</span><h3>محطاتك الكبرى</h3><p>الشيخ يعتمد المحطات 15 و30 و45 و60؛ أما المقادير الوسيطة فيتابعها الرفيق.</p></div><button class="btn secondary" type="button" data-quran-print="journey">طباعة بطاقة المتابعة</button></div><div class="quran-gates">'+gates+'</div><div class="quran-journey-stats"><div><small>أيام الحفظ</small><strong>'+Number(totals.hifz?.days||0)+'</strong></div><div><small>أيام التثبيت</small><strong>'+Number(totals.thabit?.days||0)+'</strong></div><div><small>أحزاب التثبيت</small><strong>'+quranFmtAmount(thabit,"حزب")+'</strong></div><div><small>أيام الورد</small><strong>'+Number(totals.ward?.days||0)+'</strong></div><div><small>أحزاب الورد</small><strong>'+quranFmtAmount(ward,"حزب")+'</strong></div><div><small>استدراكات مفتوحة</small><strong>'+Number((makeups.open||0)+(makeups.planned||0))+'</strong></div></div></section>';
}
function quranDailyMarkup(pathData,todayData,summary,stations){
  if(!pathData?.enrolled)return '<section class="card quran-start-callout"><span class="eyebrow">بداية الرحلة</span><h3>لن نختار عنك عشوائيًا</h3><p>ابدأ من عالمك بأسئلة قصيرة، وسنقترح عليك خطة حفظ وتثبيت وورد بحسب محفوظك ووقتك، ثم تطبقها هنا مباشرة. يمكنك أيضًا اختيار الخطة يدويًا.</p><button class="btn" type="button" data-go-world>ابدأ رحلة الخطة</button></section><details class="quran-plan-edit"><summary class="btn secondary">اختيار الخطة يدويًا</summary>'+quranEnrollMarkup()+'</details>';
  const pathInfo=pathData.path||{},logs=todayData?.logs||{};
  const blocked=Boolean(todayData?.blocked);
  const rest=todayData?.is_rest_day;
  const header='<section class="card quran-path-hero"><div class="section-head"><div><span class="eyebrow">فئة '+esc(pathInfo.hifz_category_label||"")+'</span><h3>'+esc(pathInfo.hifz_plan_label||"خطتك")+'</h3><p>'+esc(QURAN_CAT_UI[pathInfo.hifz_category]?.hint||"")+'</p></div><span class="quran-streak">🔥 '+Number(todayData?.streak||0)+'</span></div><div class="quran-path-chips"><span class="world-chip"><b>حفظ</b> '+esc(pathInfo.hifz_amount||"—")+' '+esc(pathInfo.hifz_unit||"")+'</span><span class="world-chip"><b>تثبيت</b> '+esc(pathInfo.thabit_label||"")+'</span><span class="world-chip"><b>ورد</b> '+esc(pathInfo.ward_label||"")+'</span>'+(pathInfo.rest_day!==null&&pathInfo.rest_day!==undefined?'<span class="world-chip"><b>استدراك</b> '+esc(QURAN_WEEKDAYS[Number(pathInfo.rest_day)]||"")+'</span>':"")+'</div>'+(rest?'<div class="notice">اليوم يوم استدراك وراحة؛ إن شئت راجع ما فاتك دون إضافة مقدار جديد.</div>':"")+(blocked?'<div class="notice error">لديك مقدار أساسي غير منجز. أكمل الاستدراك واعتمده قبل تسجيل حفظ جديد.</div>':"")+'</section>';
  const cards=quranLogCard("hifz",pathInfo,logs.hifz)+quranLogCard("thabit",pathInfo,logs.thabit)+quranLogCard("ward",pathInfo,logs.ward);
  return header+'<div class="quran-daily-grid">'+cards+'</div>'+quranJourneyMarkup(summary,pathInfo,stations)+'<details class="quran-plan-edit"><summary class="btn secondary">تعديل خطة المسار</summary>'+quranEnrollMarkup(pathInfo)+'</details>';
}
function quranCompanionMarkup(data){
  if(!data?.paired)return '<section class="card quran-companion"><div class="section-head"><div><span class="eyebrow">الرفيق</span><h3>تسميع ثنائي حضوري</h3><p>الرفيق طالب يرافقك منذ بداية الرحلة؛ يسمّع كل منكما الآخر حضورياً، وليس ذكاءً اصطناعياً ولا شيخاً إلكترونياً.</p></div></div><div class="empty">لم يُربط لك رفيق بعد. تواصل مع الشيخ لربط الرفيقين في الفوج.</div></section>';
  const pair=data.pair||{};
  return '<section class="card quran-companion"><div class="section-head"><div><span class="eyebrow">الرفيق</span><h3>رفيقك: '+esc(pair.partner_name||"—")+'</h3><p>'+esc(pair.group_name||"")+' · بطاقة التسميع تُطبع وتُوقّع، ثم تُدخل نتائجها هنا.</p></div><button class="btn secondary" type="button" data-quran-print="companion">طباعة بطاقة الرفيق</button></div>'+
    '<div class="quran-pledge">«أتعهد بالصدق والأمانة، فلا أزيد في الأخطاء ولا أنقص منها، ولا أجامل على حساب إتقان كتاب الله».</div>'+
    '<form id="quran-session-form" class="quran-session-form">'+
    '<div class="quran-log-fields"><label class="field">المُسمِّع<select name="reciter_id"><option value="'+esc(S.user.student_id)+'">أنا</option><option value="'+esc(pair.partner_id)+'">'+esc(pair.partner_name)+'</option></select></label><label class="field">المستمع<select name="listener_id"><option value="'+esc(pair.partner_id)+'">'+esc(pair.partner_name)+'</option><option value="'+esc(S.user.student_id)+'">أنا</option></select></label><label class="field">مقدار التسميع<input name="amount" required maxlength="120" placeholder="مثال: حزبان"></label></div>'+
    '<div class="quran-log-fields"><label class="field">الأخطاء<input type="number" min="0" max="10000" name="errors" value="0"></label><label class="field">التردد والتوقف<input type="number" min="0" max="10000" name="hesitations" value="0"></label><label class="field">مرات التلقين<input type="number" min="0" max="10000" name="prompts" value="0"></label><label class="field">الزمن (دقائق)<input type="number" min="0" max="1000" step="0.5" name="minutes" value="0"></label><label class="field">الزمن المستهدف<input type="number" min="0" max="1000" step="0.5" name="expected_minutes" value="0"></label></div>'+
    '<label class="field">مواضع الأخطاء<input name="error_positions" maxlength="600" placeholder="مثال: الآية 5، مدّ، تشابه"></label>'+
    '<label class="field">ملاحظات<textarea name="notes" rows="2" maxlength="600"></textarea></label>'+
    '<label class="check-line"><input type="checkbox" name="signed_reciter" value="1"> وقّع المُسمِّع</label><label class="check-line"><input type="checkbox" name="signed_listener" value="1"> وقّع المستمع</label>'+
    '<div class="quran-score-preview" data-quran-score>الدرجة المحسوبة: <strong>100</strong> · متقن</div>'+
    '<button class="btn" type="submit">حفظ نتيجة التسميع</button></form>'+
    '<div class="quran-rubric"><div><strong>50</strong><span>سلامة الحفظ وقلة الأخطاء</span></div><div><strong>20</strong><span>عدم التردد وكثرة التوقف</span></div><div><strong>15</strong><span>الاسترسال والطلاقة</span></div><div><strong>15</strong><span>الالتزام بالوقت</span></div></div>'+
    '<h4>آخر جلسات الرفيق</h4><div class="list">'+((data.sessions||[]).length?data.sessions.slice(0,12).map(row=>'<div class="list-row"><div><strong>'+esc(row.day)+' · الدرجة '+Number(row.score||0)+'</strong><small>أخطاء: '+Number(row.errors||0)+' · تردد: '+Number(row.hesitations||0)+' · تلقين: '+Number(row.prompts||0)+' · '+Number(row.minutes||0)+' د</small></div><span class="pill">'+esc(row.grade||quranGradeLabel(row.score))+'</span></div>').join(""):'<div class="empty">لا توجد جلسات بعد.</div>')+'</div></section>';
}
function quranStationsMarkup(stations,makeups){
  const stationList=(stations||[]).map(row=>'<div class="list-row"><div><strong>محطة '+esc(row.stage)+' حزبًا · '+esc(row.scheduled_for)+'</strong><small>'+esc(row.memorized_amount||"")+(row.notes?' · '+esc(row.notes):"")+'</small></div><span class="pill">'+esc(QURAN_STATION_UI[row.status]||row.status)+(row.score!==null&&row.score!==undefined?' · '+Number(row.score):"")+'</span></div>').join("");
  const makeupList=(makeups||[]).map(row=>'<div class="list-row"><div><strong>'+esc(row.kind_label||QURAN_KIND_UI[row.kind]?.label||row.kind)+' · استحقاق '+esc(row.due_date)+'</strong><small>'+esc(row.reason_label||QURAN_REASON_UI[row.reason]||row.reason)+(row.reason_note?' · '+esc(row.reason_note):"")+' · مقترح: '+esc(row.proposed_date||"—")+'</small></div><span class="pill">'+esc(QURAN_MAKEUP_UI[row.status]||row.status)+'</span></div>').join("");
  return '<div class="quran-stations-grid"><section class="card"><div class="section-head"><div><span class="eyebrow">محطات الشيخ</span><h3>اطلب موعد محطتك</h3><p>الشيخ يعتمد 15 و30 و45 و60 حزبًا. المقادير الوسيطة يتابعها الرفيق.</p></div></div><form id="quran-station-form" class="quran-log-form"><div class="quran-log-fields"><label class="field">المحطة<select name="stage"><option value="15">15 حزبًا</option><option value="30">30 حزبًا</option><option value="45">45 حزبًا</option><option value="60">60 حزبًا</option></select></label><label class="field">الموعد<input type="date" name="scheduled_for" required value="'+localDateISO()+'"></label></div><label class="field">مقدار المحفوظ<input name="memorized_amount" maxlength="120" placeholder="مثال: 15 حزبًا كاملة"></label><label class="field">ملاحظة<textarea name="notes" rows="2" maxlength="600"></textarea></label><button class="btn" type="submit">طلب المحطة</button></form><div class="list">'+(stationList||'<div class="empty">لا توجد محطات مسجلة.</div>')+'</div></section>'+
    '<section class="card"><div class="section-head"><div><span class="eyebrow">الاستدراك</span><h3>بلّغ عن مقدار متأخر</h3><p>تسألك المنصة عن السبب، وتقترح خطة استدراك، وترفع الحالة للشيخ عند الحاجة.</p></div></div><form id="quran-makeup-form" class="quran-log-form"><div class="quran-log-fields"><label class="field">القسم<select name="kind"><option value="hifz">الحفظ</option><option value="thabit">التثبيت</option><option value="ward">الورد</option></select></label><label class="field">تاريخ الاستحقاق<input type="date" name="due_date" required value="'+localDateISO()+'"></label></div><div class="quran-log-fields"><label class="field">المقدار<input name="amount" maxlength="120" placeholder="مثال: نصف حزب"></label><label class="field">السبب<select name="reason">'+Object.entries(QURAN_REASON_UI).map(([id,label])=>'<option value="'+id+'">'+label+'</option>').join("")+'</select></label><label class="field">الموعد المقترح<input type="date" name="proposed_date" value="'+shiftLocalDateISO(localDateISO(),3)+'"></label></div><label class="field">توضيح مختصر<textarea name="reason_note" rows="2" maxlength="600"></textarea></label><button class="btn" type="submit">إضافة إلى قائمة الاستدراك</button></form><div class="list">'+(makeupList||'<div class="empty">لا توجد متأخرات.</div>')+'</div></section></div>'+mobilePrimaryMarkup()+mobileMoreMarkup();
}
function quranPrintStyles(){
  return 'body{font-family:"IBM Plex Sans Arabic","Segoe UI",Tahoma,sans-serif;background:#fff;color:#111;margin:0;padding:24px;direction:rtl}h1{font-size:20px;margin:0 0 4px}h2{font-size:15px;margin:18px 0 8px}.muted{color:#666;font-size:12px}.card{border:1px solid #ccc;border-radius:12px;padding:16px;margin:12px 0}.row{display:flex;justify-content:space-between;gap:12px;padding:6px 0;border-bottom:1px dashed #ddd}.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.line{border-bottom:1px solid #999;min-height:22px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #bbb;padding:6px;text-align:right}.pledge{border:1px dashed #888;padding:10px;border-radius:8px;font-size:12px}.sig{display:flex;justify-content:space-between;margin-top:28px;font-size:12px}.sig span{width:45%;border-top:1px solid #999;padding-top:6px;text-align:center}@page{size:A4;margin:14mm}';
}
function quranPrintSheet(title,inner){
  const win=window.open("","_blank","width=900,height=1200");
  if(!win){toast("اسمح بالنوافذ المنبثقة لإتمام الطباعة",true);return}
  win.document.write('<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>'+esc(title)+'</title><style>'+quranPrintStyles()+'</style></head><body>'+inner+'</body></html>');
  win.document.close();win.focus();setTimeout(()=>{try{win.print()}catch{}},350);
}
function quranPrintJourney(summary,pathInfo){
  const totals=summary?.totals||{},stations=summary?.stations||{},makeups=summary?.makeups||{};
  const rows=[["الطالب",S.user.name||"—"],["فئة المحفوظ",pathInfo?.hifz_category_label||"—"],["خطة الحفظ",pathInfo?.hifz_plan_label||"—"],["مقدار الحفظ اليومي",(pathInfo?.hifz_amount||"—")+" "+(pathInfo?.hifz_unit||"")],["التثبيت اليومي",pathInfo?.thabit_label||"—"],["الورد اليومي",pathInfo?.ward_label||"—"],["أيام الحفظ",Number(totals.hifz?.days||0)],["أيام التثبيت",Number(totals.thabit?.days||0)],["أحزاب التثبيت",quranFmtAmount(totals.thabit?.total||0,"حزب")],["أيام الورد",Number(totals.ward?.days||0)],["أحزاب الورد",quranFmtAmount(totals.ward?.total||0,"حزب")],["المحطات المعتمدة",Number(stations.approved||0)+" / 4"],["استدراكات مفتوحة",Number((makeups.open||0)+(makeups.planned||0))]];
  quranPrintSheet("بطاقة متابعة الطالب",'<h1>أكاديمية الإحسان — بطاقة متابعة الطالب</h1><p class="muted">مسار القرآن الكريم · '+esc(new Date().toLocaleDateString("ar-DZ"))+'</p><div class="card">'+rows.map(([k,v])=>'<div class="row"><strong>'+esc(k)+'</strong><span>'+esc(String(v))+'</span></div>').join("")+'</div><div class="sig"><span>توقيع الطالب</span><span>توقيع الشيخ</span></div>');
}
function quranPrintCompanion(data){
  const pair=data?.pair||{};
  quranPrintSheet("بطاقة الرفيق",'<h1>أكاديمية الإحسان — بطاقة الرفيق</h1><p class="muted">التسميع الثنائي الحضوري</p><div class="card"><div class="grid"><div><strong>الطالب:</strong> '+esc(S.user.name||"")+'</div><div><strong>الرفيق:</strong> '+esc(pair.partner_name||"")+'</div><div><strong>الفوج:</strong> '+esc(pair.group_name||"")+'</div><div><strong>التاريخ:</strong> <span class="line">&nbsp;</span></div></div><div class="pledge" style="margin-top:12px">«أتعهد بالصدق والأمانة، فلا أزيد في الأخطاء ولا أنقص منها، ولا أجامل على حساب إتقان كتاب الله».</div></div><h2>بيانات التسميع</h2><table><tr><th>المقدار</th><td></td><th>الزمن</th><td></td></tr><tr><th>عدد الأخطاء</th><td></td><th>مواضع الأخطاء</th><td></td></tr><tr><th>التردد والتوقف</th><td></td><th>مرات التلقين</th><td></td></tr><tr><th>الدرجة /100</th><td></td><th>التقدير</th><td></td></tr></table><h2>التقييم</h2><table><tr><th>سلامة الحفظ وقلة الأخطاء</th><th>عدم التردد</th><th>الاسترسال والطلاقة</th><th>الالتزام بالوقت</th></tr><tr><td>50</td><td>20</td><td>15</td><td>15</td></tr></table><div class="sig"><span>توقيع المُسمِّع</span><span>توقيع المستمع</span></div>');
}
async function quran(v){
 const isStudent=S.user.role==="student";
 let levels=[];
 try{const pathData=await api("/quran");levels=pathData.levels||[]}catch{}
 if(isStudent){
  const result=await Promise.allSettled([api("/quran/progress"),api("/quran/plan"),api("/quran/path"),api("/quran/today"),api("/quran/summary"),api("/quran/companion"),api("/quran/stations"),api("/quran/makeups"),api("/quran/logs?month="+encodeURIComponent(localDateISO().slice(0,7)))]);
  const rows=result[0].status==="fulfilled"?result[0].value:[],plan=result[1].status==="fulfilled"?result[1].value:null;
  const pathData=result[2].status==="fulfilled"?result[2].value:{enrolled:false};
  const todayData=result[3].status==="fulfilled"?result[3].value:{enrolled:false,logs:{}};
  const summary=result[4].status==="fulfilled"?result[4].value:null;
  const companion=result[5].status==="fulfilled"?result[5].value:{paired:false,sessions:[]};
  const stations=result[6].status==="fulfilled"?result[6].value:[];
  const makeups=result[7].status==="fulfilled"?result[7].value:[];
  const monthLogs=result[8].status==="fulfilled"?result[8].value:[];
  const tab=safeStore.getSession("ihsan_quran_tab")||"daily";
  let body="";
  if(tab==="plan")body=quranEightMonthMarkup(pathData)+quranPlanMarkup(levels,plan,S.user.student_id,true)+quranProgressSummary(rows)+quranPeriodReportMarkup(rows)+quranLogList(rows);
  else if(tab==="schedule")body=quranScheduleMarkup(pathData,todayData,summary,monthLogs);
  else if(tab==="companion")body=quranCompanionMarkup(companion);
  else if(tab==="stations")body=quranStationsMarkup(stations,makeups);
  else body=quranDailyMarkup(pathData,todayData,summary,stations);
  v.innerHTML=head("مسار القرآن","الحفظ والتثبيت والورد والرفيق والمحطات في مسار واحد، مع سجل تراكمي لا يُحذف.")+quranTabsMarkup(tab)+body;
  v.querySelectorAll("[data-quran-tab]").forEach(btn=>btn.onclick=()=>{safeStore.setSession("ihsan_quran_tab",btn.dataset.quranTab);quran(v)});
  if(tab==="plan")wireQuranPlan(v,levels);
  else if(tab==="daily")wireQuranDaily(v,pathData,todayData,summary,stations);
  else if(tab==="schedule")wireQuranSchedule(v,pathData,summary);
  else if(tab==="companion")wireQuranCompanion(v,companion);
  else if(tab==="stations")wireQuranStations(v);
  return;
 }
 const tab=safeStore.getSession("ihsan_quran_staff_tab")||"roster";
 const staffTabs=[["roster","تسجيل الحفظ والمراجعة"],["supervision","الرفيق والمحطات والاستدراك"],["plans","خطط الطلاب"]];
 const staffSwitch='<div class="quran-staff-switch">'+staffTabs.map(([id,label])=>'<button type="button" class="btn secondary '+(id===tab?"is-active":"")+'" data-quran-staff-tab="'+id+'">'+label+'</button>').join("")+'</div>';
 const wireStaffSwitch=host=>host.querySelectorAll("[data-quran-staff-tab]").forEach(btn=>btn.onclick=()=>{safeStore.setSession("ihsan_quran_staff_tab",btn.dataset.quranStaffTab);quran(v)});
 if(tab==="supervision"){
  v.innerHTML=head("الرفيق والمحطات والاستدراك","اربط الرفيقين في الفوج، واعتمد المحطات، وتابع الاستدراك دون خلط بينه وبين تسجيل الحفظ.")+staffSwitch+'<div id="quran-staff-body"></div>';
  wireStaffSwitch(v);
  await quranSupervisionPage($("#quran-staff-body"));
  return;
 }
 if(tab==="plans"){
  v.innerHTML=head("خطط الطلاب","راجع خطط الطلاب كما طلبوها، واعتمدها أو اطلب تعديلًا بملاحظة واضحة. لا تتغير خطة الطالب تلقائيًا، وتعلمه لا يتوقف بانتظار الاعتماد.")+staffSwitch+'<div id="quran-staff-body"></div>';
  wireStaffSwitch(v);
  await quranPlansReviewPage($("#quran-staff-body"));
  return;
 }
 v.innerHTML=head("متابعة الحفظ والمراجعة","سجّل الحفظ والمراجعة، أو انتقل إلى متابعة الرفاق والمحطات والاستدراك أو مراجعة خطط الطلاب.")+staffSwitch+'<div id="quran-staff-body"></div>';
 wireStaffSwitch(v);
 await quranRosterPage($("#quran-staff-body"));
}
function quranLogList(rows){
  return '<section class="card"><h3>سجل الحفظ والمراجعة والتسميع</h3><div class="list">'+(rows.length?rows.map(r=>'<article class="list-row"><div><strong>'+esc(r.date)+' · '+esc(quranActivityName(r.activity))+'</strong><small>الحفظ: '+esc(r.memorized||"—")+' · المراجعة: '+esc(r.reviewed||"—")+' · التسميع: '+esc(r.recitation||"—")+'</small><small>الأخطاء: '+Number(r.errors||0)+' · التقدير: '+(r.grade===null||r.grade===undefined?"—":esc(r.grade+"/10"))+' · التصحيح: '+(r.corrected?"تم":"قيد المتابعة")+'</small><small>ملاحظة المعلم: '+esc(r.feedback||r.notes||"—")+'</small><small>المهمة القادمة: '+esc(r.next_assignment||"—")+'</small></div><span class="pill">متابعة</span></article>').join(""):'<div class="empty">لم تُسجّل متابعة بعد. سيظهر تقدمك هنا عند تسميع القرآن للمعلم.</div>')+'</div></section>';
}
function wireQuranDaily(v,pathData,todayData,summary,stations){
  v.querySelector("[data-go-world]")?.addEventListener("click",()=>go("world"));
  const enroll=v.querySelector("#quran-enroll-form");
  if(enroll)enroll.onsubmit=async event=>{
    event.preventDefault();const form=event.currentTarget,button=form.querySelector('button[type="submit"]');button.disabled=true;
    const data=new FormData(form);
    try{await api("/quran/path",{method:"POST",body:JSON.stringify({hifz_plan:data.get("hifz_plan"),hifz_category:data.get("hifz_category"),hifz_amount:data.get("hifz_amount"),hifz_unit:data.get("hifz_unit"),ward_ahzab:Number(data.get("ward_ahzab")),rest_day:data.get("rest_day")===""?null:Number(data.get("rest_day")),start_date:data.get("start_date")})});toast("تم بدء مسارك القرآني");await quran(v)}catch(error){button.disabled=false;toast(error.message,true)}
  };
  v.querySelectorAll("[data-quran-log]").forEach(form=>{
    form.onsubmit=async event=>{
      event.preventDefault();const kind=form.dataset.quranLog,button=form.querySelector('button[type="submit"]'),data=new FormData(form);button.disabled=true;
      try{await api("/quran/daily",{method:"POST",body:JSON.stringify({kind,amount:Number(data.get("amount")),unit:data.get("unit"),repetitions:Number(data.get("repetitions")||0),linked_scope:data.get("linked_scope")||"",notes:data.get("notes")||""})});toast("حُفظ سجل "+QURAN_KIND_UI[kind].label);await quran(v)}catch(error){button.disabled=false;toast(error.message,true)}
    };
  });
  v.querySelectorAll("[data-quran-print]").forEach(btn=>btn.onclick=()=>{
    if(btn.dataset.quranPrint==="journey")quranPrintJourney(summary,pathData?.path,stations);
  });
}
function wireQuranCompanion(v,data){
  v.querySelectorAll("[data-quran-print]").forEach(btn=>btn.onclick=()=>quranPrintCompanion(data));
  const form=v.querySelector("#quran-session-form");
  if(!form)return;
  const preview=form.querySelector("[data-quran-score]");
  const read=()=>{const f=new FormData(form);return {errors:Number(f.get("errors")||0),hesitations:Number(f.get("hesitations")||0),prompts:Number(f.get("prompts")||0),minutes:Number(f.get("minutes")||0),expected_minutes:Number(f.get("expected_minutes")||0)}};
  const paint=()=>{const s=quranScorePreview(read());if(preview)preview.innerHTML='الدرجة المحسوبة: <strong>'+s.total+'</strong> · '+quranGradeLabel(s.total)};
  form.addEventListener("input",paint);paint();
  form.onsubmit=async event=>{
    event.preventDefault();const button=form.querySelector('button[type="submit"]'),f=new FormData(form);button.disabled=true;
    try{await api("/quran/companion/session",{method:"POST",body:JSON.stringify({reciter_id:f.get("reciter_id"),listener_id:f.get("listener_id"),amount:f.get("amount"),errors:Number(f.get("errors")||0),hesitations:Number(f.get("hesitations")||0),prompts:Number(f.get("prompts")||0),minutes:Number(f.get("minutes")||0),expected_minutes:Number(f.get("expected_minutes")||0),error_positions:f.get("error_positions")||"",notes:f.get("notes")||"",signed_reciter:Boolean(f.get("signed_reciter")),signed_listener:Boolean(f.get("signed_listener"))})});toast("حُفظت نتيجة التسميع");await quran(v)}catch(error){button.disabled=false;toast(error.message,true)}
  };
}
function wireQuranStations(v){
  const station=v.querySelector("#quran-station-form");
  if(station)station.onsubmit=async event=>{
    event.preventDefault();const form=event.currentTarget,button=form.querySelector('button[type="submit"]'),f=new FormData(form);button.disabled=true;
    try{await api("/quran/stations",{method:"POST",body:JSON.stringify({stage:f.get("stage"),scheduled_for:f.get("scheduled_for"),memorized_amount:f.get("memorized_amount")||"",notes:f.get("notes")||""})});toast("سُجّل طلب المحطة");await quran(v)}catch(error){button.disabled=false;toast(error.message,true)}
  };
  const makeup=v.querySelector("#quran-makeup-form");
  if(makeup)makeup.onsubmit=async event=>{
    event.preventDefault();const form=event.currentTarget,button=form.querySelector('button[type="submit"]'),f=new FormData(form);button.disabled=true;
    try{await api("/quran/makeups",{method:"POST",body:JSON.stringify({kind:f.get("kind"),due_date:f.get("due_date"),amount:f.get("amount")||"",reason:f.get("reason"),reason_note:f.get("reason_note")||"",proposed_date:f.get("proposed_date")||""})});toast("أُضيف إلى قائمة الاستدراك");await quran(v)}catch(error){button.disabled=false;toast(error.message,true)}
  };
}
async function quranPlansReviewPage(v){
 const statuses=[["pending","بانتظار الاعتماد"],["changes_requested","طلبات تعديل"],["approved","معتمدة"]];
 const current=safeStore.getSession("ihsan_plan_review_status")||"pending";
 const embedded=v.id==="quran-staff-body";
 v.innerHTML='<div class="loading">جار تحميل خطط الطلاب…</div>';
 try{
  const data=await api("/journey/review?status="+encodeURIComponent(current));
  const counts=data.counts||{},items=data.items||[];
  const tabs='<div class="quran-staff-switch">'+statuses.map(([id,label])=>'<button type="button" class="btn secondary '+(id===current?"is-active":"")+'" data-plan-review-status="'+id+'">'+label+' ('+Number(counts[id]||0)+')</button>').join("")+'</div>';
  const rows=items.map(item=>{
   const plan=item.plan||{};
   const budget=plan.fits===false?'<span class="pill is-warn">تتجاوز الوقت بـ '+Number(plan.over_by||0)+' د</span>':'<span class="pill is-good">داخل الوقت المعلن</span>';
   const summary=(item.answers_summary||[]).map(answer=>'<div class="list-row"><div><strong>'+esc(answer.title)+'</strong><small>'+esc(answer.label)+'</small></div></div>').join("");
   const requestNote=item.request_note?'<div class="notice"><strong>ملاحظة الطالب:</strong> '+esc(item.request_note)+'</div>':"";
   const reviewNote=item.review_note?'<div class="notice '+(item.approval_status==="changes_requested"?"error":"")+'"><strong>ملاحظة المراجعة:</strong> '+esc(item.review_note)+'</div>':"";
   const actions=item.approval_status==="pending"?'<div class="plan-review-actions"><label class="field">ملاحظة للطالب (إلزامية عند طلب التعديل)<textarea data-plan-review-note="'+esc(item.student_id)+'" rows="2" maxlength="500" placeholder="مثال: خفّف الحفظ إلى وجه واحد مع تثبيت أثبت، ثم أعد الإرسال."></textarea></label><div class="student-actions"><button class="btn" type="button" data-plan-decision="approved" data-plan-student="'+esc(item.student_id)+'">اعتماد الخطة</button><button class="btn secondary" type="button" data-plan-decision="changes_requested" data-plan-student="'+esc(item.student_id)+'">طلب تعديل</button></div></div>':"";
   return '<article class="card plan-review-card"><div class="section-head"><div><span class="eyebrow">'+esc(item.group_name||"بلا فوج")+' · '+esc(String(item.applied_at||"").slice(0,10))+'</span><h3>'+esc(item.student_name||"طالب")+'</h3><p>'+esc(plan.plan_label||"—")+' · فئة '+esc(plan.hifz_category_label||"—")+' · حفظ '+esc(plan.hifz_amount||"—")+' '+esc(plan.hifz_unit||"")+' · تثبيت '+esc(plan.thabit_label||"—")+' · ورد '+esc(plan.ward_label||"—")+'</p></div><div class="plan-review-pills">'+budget+'<span class="pill">~'+Number(plan.estimated_daily_minutes||0)+' د/يوم</span><span class="pill">'+(item.approval_status==="approved"?"معتمدة":item.approval_status==="changes_requested"?"بانتظار تعديل الطالب":"بانتظار قرارك")+'</span></div></div>'+requestNote+reviewNote+'<details class="plan-review-answers"><summary>إجابات الطالب ('+Number((item.answers_summary||[]).length)+')</summary><div class="list">'+(summary||'<div class="empty">لا توجد إجابات محفوظة.</div>')+'</div></details>'+actions+'</article>';
  }).join("");
  v.innerHTML=(embedded?"":head("خطط الطلاب","راجع خطط الطلاب كما طلبوها، واعتمدها أو اطلب تعديلًا بملاحظة واضحة. لا تتغير خطة الطالب تلقائيًا، وتعلمه لا يتوقف بانتظار الاعتماد."))+tabs+
   '<div class="notice">الأرقام المرجعية للتثبيت (60←نصف، 45←ثلاثة أثمان، 30←ربع، 15←ثمن) مقترحة وتنتظر اعتماد الشيخ. الاعتماد يثبت خطة الطالب الحالية فقط، ولا يمنح نقاطًا أو يعدّل سجل حفظه.</div>'+
   (rows||'<div class="empty">لا توجد خطط في هذه الحالة الآن.</div>');
  v.querySelectorAll("[data-plan-review-status]").forEach(btn=>btn.onclick=()=>{safeStore.setSession("ihsan_plan_review_status",btn.dataset.planReviewStatus);quranPlansReviewPage(v)});
  v.querySelectorAll("[data-plan-decision]").forEach(btn=>btn.onclick=async()=>{
   const studentId=btn.dataset.planStudent,decision=btn.dataset.planDecision;
   const noteInput=v.querySelector('[data-plan-review-note="'+studentId+'"]');
   const note=noteInput?noteInput.value.trim():"";
   if(decision==="changes_requested"&&note.length<3){toast("اكتب ملاحظة واضحة للطالب قبل طلب التعديل",true);noteInput?.focus();return}
   btn.disabled=true;
   try{await api("/journey/review",{method:"POST",body:JSON.stringify({student_id:studentId,decision,note})});toast(decision==="approved"?"اعتُمدت خطة الطالب":"أُرسل طلب التعديل إلى الطالب");await quranPlansReviewPage(v)}
   catch(error){btn.disabled=false;toast(error.message,true)}
  });
 }catch(error){
  v.innerHTML=(embedded?"":head("خطط الطلاب","تعذّر تحميل خطط الطلاب الآن."))+'<div class="notice error">'+esc(error.message)+'</div><button class="btn" id="retry-plan-review">إعادة المحاولة</button>';
  $("#retry-plan-review")?.addEventListener("click",()=>quranPlansReviewPage(v));
 }
}
async function quranSupervisionPage(v){
  const embedded=v.id==="quran-staff-body";
  const groups=assignedGroups().slice().sort((a,b)=>compareStudentNames(a.name,b.name));
  v.innerHTML=(embedded?"":head("الرفيق والمحطات والاستدراك","اربط الرفيقين في الفوج، واعتمد المحطات، وتابع الاستدراك دون خلط بينه وبين تسجيل الحفظ."))+'<section class="card"><div class="section-head"><div><span class="eyebrow">اختيار الفوج</span><h3>ابدأ من فوجك</h3></div></div><label class="field">الفوج<select id="quran-sup-group"><option value="">اختر فوجًا</option>'+groups.map(g=>'<option value="'+esc(g.id)+'">'+esc(g.name)+'</option>').join("")+'</select></label><div id="quran-sup-body"><div class="empty">اختر فوجًا لعرض طلابه.</div></div></section>';
  const select=$("#quran-sup-group"),host=$("#quran-sup-body");
  select.onchange=()=>render();
  async function render(){
    const gid=select.value;
    if(!gid){host.innerHTML='<div class="empty">اختر فوجًا لعرض طلابه.</div>';return}
    host.innerHTML='<div class="loading">جار تحميل طلاب الفوج…</div>';
    try{
      const students=await api("/students?group_id="+encodeURIComponent(gid));
      host.innerHTML='<div class="divider"></div><h4>الرفيق</h4><p class="muted small">اختر طالبين من الفوج نفسه لربطهما كرفيقين. الربط الجديد يوقف الربط السابق لأي منهما.</p><form id="quran-pair-form" class="quran-pair-form"><div class="quran-log-fields"><label class="field">الطالب الأول<select name="student_a">'+students.map(st=>'<option value="'+esc(st.id)+'">'+esc(studentDisplayName(st.name))+'</option>').join("")+'</select></label><label class="field">الطالب الثاني<select name="student_b">'+students.map(st=>'<option value="'+esc(st.id)+'">'+esc(studentDisplayName(st.name))+'</option>').join("")+'</select></label></div><button class="btn" type="submit">ربط الرفيقين</button></form><div class="divider"></div><h4>متابعة طالب</h4><label class="field">الطالب<select id="quran-sup-student"><option value="">اختر طالبًا</option>'+students.map(st=>'<option value="'+esc(st.id)+'">'+esc(studentDisplayName(st.name))+'</option>').join("")+'</select></label><div id="quran-sup-student-body"></div>';
      $("#quran-pair-form").onsubmit=async event=>{
        event.preventDefault();const form=event.currentTarget,button=form.querySelector('button[type="submit"]'),f=new FormData(form);button.disabled=true;
        try{await api("/quran/companion/pair",{method:"POST",body:JSON.stringify({student_a:f.get("student_a"),student_b:f.get("student_b")})});toast("تم ربط الرفيقين")}catch(error){toast(error.message,true)}finally{button.disabled=false}
      };
      $("#quran-sup-student").onchange=event=>loadStudent(event.target.value);
    }catch(error){host.innerHTML='<div class="notice error">'+esc(error.message)+'</div>'}
  }
  async function loadStudent(studentId){
    const host=$("#quran-sup-student-body");
    if(!studentId){host.innerHTML="";return}
    host.innerHTML='<div class="loading">جار تحميل بيانات الطالب…</div>';
    try{
      const [pathData,stations,makeups,companion]=await Promise.all([api("/quran/path?student_id="+encodeURIComponent(studentId)),api("/quran/stations?student_id="+encodeURIComponent(studentId)),api("/quran/makeups?student_id="+encodeURIComponent(studentId)),api("/quran/companion?student_id="+encodeURIComponent(studentId))]);
      const info=pathData.path||{};
      host.innerHTML='<div class="quran-sup-summary"><span class="pill">'+esc(info.hifz_category_label||"لم يبدأ المسار")+'</span><span class="pill">'+esc(info.thabit_label||"—")+'</span><span class="pill">'+esc(info.ward_label||"—")+'</span><span class="pill">الرفيق: '+esc(companion.paired?companion.pair.partner_name:"—")+'</span></div>'+
        '<h4>المحطات</h4><div class="list">'+(stations.length?stations.map(row=>'<div class="list-row"><div><strong>'+esc(row.stage)+' حزبًا · '+esc(row.scheduled_for)+'</strong><small>'+esc(QURAN_STATION_UI[row.status]||row.status)+(row.score!==null&&row.score!==undefined?' · '+Number(row.score):"")+'</small></div>'+(row.status==="scheduled"?'<span class="quran-sup-actions"><button class="btn secondary" type="button" data-station-approve="'+esc(row.id)+'">اعتماد</button><button class="btn secondary" type="button" data-station-reject="'+esc(row.id)+'">رفض</button></span>':"")+'</div>').join(""):'<div class="empty">لا محطات.</div>')+'</div>'+
        '<h4>الاستدراك</h4><div class="list">'+(makeups.length?makeups.map(row=>'<div class="list-row"><div><strong>'+esc(row.kind_label||row.kind)+' · '+esc(row.due_date)+'</strong><small>'+esc(row.reason_label||row.reason)+' · '+esc(QURAN_MAKEUP_UI[row.status]||row.status)+(row.blocks_new?' · يمنع الجديد':"")+'</small></div>'+(row.status!=="done"?'<span class="quran-sup-actions"><button class="btn secondary" type="button" data-makeup-done="'+esc(row.id)+'">إنجاز</button><button class="btn secondary" type="button" data-makeup-block="'+esc(row.id)+'" data-block="'+(row.blocks_new?"0":"1")+'">'+(row.blocks_new?"إلغاء المنع":"منع الجديد")+'</button></span>':"")+'</div>').join(""):'<div class="empty">لا متأخرات.</div>')+'</div>';
      host.querySelectorAll("[data-station-approve],[data-station-reject]").forEach(btn=>btn.onclick=async()=>{
        const approve=Boolean(btn.dataset.stationApprove),id=btn.dataset.stationApprove||btn.dataset.stationReject;
        let score=null;
        if(approve){const raw=prompt("درجة المحطة من 100 (اتركها فارغة إن لم تُرصد):","");if(raw===null)return;score=raw===""?null:Number(raw)}
        try{await api("/quran/stations/decision",{method:"POST",body:JSON.stringify({id,status:approve?"approved":"rejected",score})});toast(approve?"اعتُمدت المحطة":"رُفضت المحطة");await loadStudent(studentId)}catch(error){toast(error.message,true)}
      });
      host.querySelectorAll("[data-makeup-done],[data-makeup-block]").forEach(btn=>btn.onclick=async()=>{
        const done=Boolean(btn.dataset.makeupDone),id=btn.dataset.makeupDone||btn.dataset.makeupBlock;
        try{await api("/quran/makeups/update",{method:"POST",body:JSON.stringify(done?{id,status:"done"}:{id,status:"open",blocks_new:btn.dataset.block==="1"})});toast("حُدّث سجل الاستدراك");await loadStudent(studentId)}catch(error){toast(error.message,true)}
      });
    }catch(error){host.innerHTML='<div class="notice error">'+esc(error.message)+'</div>'}
  }
}



const EFFORT_TASKS=[
 ["mandatory_classes","حضور الحصص الإجبارية"],
 ["asr","صلاة العصر"],
 ["adhkar","الأذكار"],
 ["wird","الورد القرآني"],
 ["thabit","تثبيت المحفوظ"],
 ["bring","إحضار المطلوب"],
 ["quran_classes","حضور حصص القرآن"]
];
const EFFORT_STATUS={done:"أُنجز",missed:"لم يُنجز",excused:"بعذر"};
async function effortPage(v){
 const groups=assignedGroups().slice().sort((a,b)=>compareStudentNames(a.name,b.name));
 const today=localDateISO();
 v.innerHTML=head("الاجتهاد فيه","سجّل بنود اليوم لكل طالب بالطريقة المباشرة نفسها المستخدمة في الحضور.")+
 '<section class="card"><div class="form-grid"><label class="field">الفوج<select id="effort-group"><option value="">اختر الفوج</option>'+groups.map(g=>'<option value="'+esc(g.id)+'">'+esc(g.name)+'</option>').join("")+'</select></label><label class="field">التاريخ<input id="effort-date" type="date" value="'+today+'" max="'+today+'"></label><div class="wide"><button type="button" class="btn" id="effort-load">عرض الطلبة</button></div></div><div id="effort-roster" class="muted small">اختر الفوج والتاريخ.</div></section>';
 const groupSel=$("#effort-group"),dateInput=$("#effort-date"),host=$("#effort-roster");
 const saved=safeStore.getSession("ihsan_effort_group");if(saved&&groups.some(g=>String(g.id)===saved))groupSel.value=saved;
 $("#effort-load").onclick=async()=>{
  const gid=groupSel.value,date=dateInput.value;if(!gid||!date)return toast("اختر الفوج والتاريخ",true);
  safeStore.setSession("ihsan_effort_group",gid);host.innerHTML='<div class="loading">جار تحميل السجل…</div>';
  try{
   const [students,logs]=await Promise.all([api("/students?group_id="+encodeURIComponent(gid)),api("/effort?group_id="+encodeURIComponent(gid)+"&date="+encodeURIComponent(date))]);
   if(!students.length){host.innerHTML='<div class="empty">لا يوجد طلبة في هذا الفوج.</div>';return}
   const byStudent={};logs.forEach(r=>{(byStudent[r.student_id]||(byStudent[r.student_id]={}))[r.category]=r.status});
   host.innerHTML='<p class="muted small">'+esc((groups.find(g=>String(g.id)===gid)||{}).name||"الفوج")+' · '+esc(date)+' · '+students.length+' طالبًا</p><div class="attendance-bulk-actions"><button type="button" class="btn secondary" id="effort-all-done">الكل أُنجز</button><button type="button" class="btn secondary" id="effort-all-missed">الكل لم يُنجز</button><button type="button" class="btn secondary" id="effort-all-clear">مسح الحالات</button></div><div class="effort-roster">'+students.map(st=>'<article class="card effort-student" data-effort-student="'+esc(st.id)+'"><h3>'+esc(studentDisplayName(st.name))+'</h3><div class="form-grid">'+EFFORT_TASKS.map(([key,label])=>'<label class="field">'+esc(label)+'<select data-effort-task="'+key+'"><option value="">لم يُسجّل</option><option value="done" '+(byStudent[st.id]?.[key]==="done"?"selected":"")+'>أُنجز</option><option value="missed" '+(byStudent[st.id]?.[key]==="missed"?"selected":"")+'>لم يُنجز</option><option value="excused" '+(byStudent[st.id]?.[key]==="excused"?"selected":"")+'>بعذر</option></select></label>').join("")+'</div></article>').join("")+'</div><button type="button" class="btn" id="effort-save">حفظ المتابعة</button>';
   $("#effort-all-done").onclick=()=>host.querySelectorAll("[data-effort-task]").forEach(sel=>sel.value="done");
   $("#effort-all-missed").onclick=()=>host.querySelectorAll("[data-effort-task]").forEach(sel=>sel.value="missed");
   $("#effort-all-clear").onclick=()=>host.querySelectorAll("[data-effort-task]").forEach(sel=>sel.value="");
   $("#effort-save").onclick=async()=>{
    const items=[...host.querySelectorAll("[data-effort-student]")].map(card=>({student_id:card.dataset.effortStudent,checks:Object.fromEntries([...card.querySelectorAll("[data-effort-task]")].map(sel=>[sel.dataset.effortTask,sel.value]).filter(pair=>pair[1]))})).filter(item=>Object.keys(item.checks).length);
    if(!items.length)return toast("سجّل حالة واحدة على الأقل قبل الحفظ",true);
    const btn=$("#effort-save");btn.disabled=true;
    try{const result=await api("/effort",{method:"POST",body:JSON.stringify({group_id:gid,date,items})});toast("تم حفظ "+result.saved+" حالة متابعة");await $("#effort-load").click()}catch(e){toast(e.message,true)}finally{if(btn.isConnected)btn.disabled=false}
   };
  }catch(e){host.innerHTML='<div class="notice error">'+esc(e.message)+'</div>'}
 };
}
async function effortRankingPage(v){
 const groups=assignedGroups().slice().sort((a,b)=>compareStudentNames(a.name,b.name));
 const isStudent=S.user.role==="student";
 const initialScope=isStudent?"group":(safeStore.getSession("ihsan_effort_scope")||"group");
 v.innerHTML=head("الترتيب الأسبوعي/الشهري/السنوي","نقاط كل فترة مستقلة، مع مقارنة بالمدة السابقة. الحفظ وسجلاته لا تتغير بهذا الترتيب.")+
 '<section class="card"><div class="form-grid"><label class="field">نطاق الترتيب<select id="ranking-scope"><option value="academy">الأكاديمية</option><option value="group">الفوج</option><option value="team">الفرقة</option></select></label><label class="field" id="ranking-group-wrap">الفوج<select id="ranking-group"><option value="">اختر الفوج</option>'+groups.map(g=>'<option value="'+esc(g.id)+'">'+esc(g.name)+'</option>').join("")+'</select></label><label class="field" id="ranking-student-wrap" hidden>طالب من الفرقة<select id="ranking-student"><option value="">اختر طالبًا من الفرقة</option></select></label><label class="field">الفترة<select id="ranking-period"><option value="weekly">أسبوعي</option><option value="monthly">شهري</option><option value="yearly">سنوي</option></select></label><div class="wide"><button type="button" class="btn" id="ranking-load">عرض الترتيب</button></div></div><div id="ranking-result" class="muted small">اختر نطاق الترتيب والفترة.</div></section>';
 const scopeSel=$("#ranking-scope"),groupSel=$("#ranking-group"),studentSel=$("#ranking-student"),periodSel=$("#ranking-period"),host=$("#ranking-result");
 if(!["academy","group","team"].includes(initialScope))scopeSel.value="group";else scopeSel.value=initialScope;
 if(isStudent){scopeSel.value="group";scopeSel.querySelector('option[value="academy"]').disabled=true;}
 const saved=safeStore.getSession("ihsan_effort_group");if(saved&&groups.some(g=>String(g.id)===saved))groupSel.value=saved;else if(groups.length)groupSel.value=String(groups[0].id);
 const refreshStudents=()=>{
  const roster=(S.students||[]).filter(st=>String(st.group_id)===String(groupSel.value)).slice().sort((x,y)=>compareStudentNames(x.name,y.name));
  studentSel.innerHTML='<option value="">اختر طالبًا من الفرقة</option>'+roster.map(st=>'<option value="'+esc(st.id)+'">'+esc(st.name)+'</option>').join("");
  if(isStudent&&S.user.student_id)studentSel.value=S.user.student_id;
 };
 const updateControls=()=>{
  $("#ranking-group-wrap").hidden=scopeSel.value==="academy";
  $("#ranking-student-wrap").hidden=scopeSel.value!=="team";
  if(scopeSel.value==="team")refreshStudents();
 };
 updateControls();
 const render=async()=>{
  const scope=scopeSel.value,groupId=groupSel.value,studentId=studentSel.value;
  if((scope==="group"||scope==="team")&&!groupId)return toast("اختر الفوج أولًا",true);
  if(scope==="team"&&!studentId)return toast("اختر طالبًا مسندًا إلى الفرقة",true);
  safeStore.setSession("ihsan_effort_scope",scope);
  if(groupId)safeStore.setSession("ihsan_effort_group",String(groupId));
  host.innerHTML='<div class="loading">جار حساب نقاط الفترة ومقارنتها…</div>';
  try{
   const query=new URLSearchParams({scope,period:periodSel.value});
   if(scope!=="academy")query.set("group_id",groupId);
   if(scope==="team"||isStudent&&scope==="academy")query.set("student_id",studentId||S.user.student_id||"");
   const data=await api("/effort/ranking?"+query.toString());
   const scopeName=scope==="academy"?"الأكاديمية":scope==="group"?((groups.find(g=>String(g.id)===String(groupId))||{}).name||"الفوج"):(data.team_name||"الفرقة");
   const periodLabel={weekly:"الأسبوعي",monthly:"الشهري",yearly:"السنوي"}[periodSel.value];
   const metrics=[["attendance","الحضور"],["wird","الورد"],["thabit","التثبيت"],["bring","الإحضار"],["memorization","الحفظ"]];
   const change=row=>row.rank_change===null||row.rank_change===undefined?'<span class="muted">—</span>':row.rank_change>0?'<strong style="color:#16834a">↑ '+row.rank_change+'</strong>':row.rank_change<0?'<strong style="color:#c0392b">↓ '+Math.abs(row.rank_change)+'</strong>':'<span class="muted">— ثابت</span>';
   if(!data.rows.length){host.innerHTML='<div class="empty">'+(scope==="team"?"لم تُسند عضوية فرقة لهذا الطالب بعد.":"لا توجد بيانات كافية لهذه الفترة.")+'</div>';return;}
   const tableHtml='<div class="table-wrap ranking-table-wrap"><table class="ranking-table"><thead><tr><th>الترتيب</th><th>الطالب</th><th>نقاط الفترة</th><th>التغير</th>'+metrics.map(m=>'<th>'+m[1]+'</th>').join("")+'</tr></thead><tbody>'+data.rows.map(row=>'<tr><td><span class="rank-badge'+(row.rank===1?' is-first':row.rank===2?' is-second':row.rank===3?' is-third':'')+'">'+row.rank+'</span></td><td class="ranking-student">'+esc(row.name)+'</td><td class="ranking-score"><strong>'+Number(row.score||0)+'</strong></td><td>'+change(row)+'</td>'+metrics.map(m=>'<td class="ranking-metric'+(row.metrics[m[0]]===null?' is-empty':'')+'">'+(row.metrics[m[0]]===null?'—':row.metrics[m[0]]+'%')+'</td>').join("")+'</tr>').join("")+'</tbody></table></div>';
   const subtitle=scopeName+' · '+data.from_date+' إلى '+data.to_date+' · '+Number(data.total_count||data.rows.length)+' طالبًا';
   host.innerHTML='<div class="section-head"><p class="muted small ranking-meta">'+esc(subtitle)+' · المقارنة السابقة: '+esc(data.previous_from_date||"—")+' إلى '+esc(data.previous_to_date||"—")+'</p><button type="button" class="btn secondary" id="ranking-print">طباعة / حفظ PDF</button></div>'+tableHtml+'<p class="muted small ranking-note">↑ صعود بعدد المراكز · ↓ تراجع بعدد المراكز · — ثبات أو عدم توفر فترة سابقة. النقاط هي صافي نقاط الإنجاز المسجلة داخل الفترة فقط، ولا تشمل رصيد المتجر.</p>';
   $("#ranking-print")?.addEventListener("click",()=>printReportWindow("الترتيب "+periodLabel+" — "+scopeName,tableHtml,subtitle,{landscape:true}));
  }catch(e){host.innerHTML='<div class="notice error">'+esc(e.message)+'</div>'}
 };
 scopeSel.addEventListener("change",()=>{updateControls();render()});
 groupSel.addEventListener("change",()=>{refreshStudents();safeStore.setSession("ihsan_effort_group",String(groupSel.value||""));if(scopeSel.value!=="academy")render()});
 studentSel.addEventListener("change",()=>{if(scopeSel.value==="team"&&studentSel.value)render()});
 periodSel.addEventListener("change",render);
 $("#ranking-load").onclick=render;
 if(isStudent){refreshStudents();studentSel.value=S.user.student_id||"";}
 if((scopeSel.value==="academy")||groupSel.value)render();
}

async function bulkRosterPage(v){
 const groups=assignedGroups().slice().sort((a,b)=>compareStudentNames(a.name,b.name));
 v.innerHTML=head("إضافة أسماء الطلبة","إضافة سجلات طلاب بلا حسابات دخول، مع منع التكرار داخل الفوج والحفاظ على السجلات الحالية.")+
 '<section class="card"><form id="bulk-roster-form" class="stack"><label class="field">الفوج<select id="bulk-roster-group" required><option value="">اختر الفوج</option>'+groups.map(g=>'<option value="'+esc(g.id)+'" '+(/الإرشاد|الإصلاح/.test(g.name||"")?"":"")+'>'+esc(g.name)+'</option>').join("")+'</select></label><label class="field">أسماء الطلبة · اسم في كل سطر<textarea id="bulk-roster-names" rows="12" required placeholder="اكتب كل اسم في سطر مستقل"></textarea></label><p class="muted small">لن تُنشأ حسابات دخول أو كلمات مرور. الأسماء المطابقة الموجودة في الفوج ستُتجاوز تلقائيًا.</p><button type="submit" class="btn">إضافة الأسماء إلى الفوج</button><div id="bulk-roster-result" aria-live="polite"></div></form></section>';
 const group=$("#bulk-roster-group"),form=$("#bulk-roster-form"),result=$("#bulk-roster-result");
 const suggested=groups.find(g=>/الإرشاد|الإصلاح/.test(g.name||""));if(suggested)group.value=suggested.id;
 form.onsubmit=async e=>{
  e.preventDefault();const gid=group.value,names=$("#bulk-roster-names").value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  if(!gid||!names.length)return toast("اختر الفوج وأدخل الأسماء",true);
  const btn=form.querySelector('button[type="submit"]');btn.disabled=true;result.textContent="جار إضافة الأسماء…";
  try{const data=await api("/students/roster-bulk",{method:"POST",body:JSON.stringify({group_id:gid,names})});await load();result.innerHTML='<div class="notice">أُضيف '+data.added_count+' طالبًا. تم تجاوز '+data.skipped_count+' اسمًا مكررًا أو موجودًا بالفعل.</div>'+(data.skipped.length?'<p class="muted small">الأسماء المتجاوزة: '+esc(data.skipped.join("، "))+'</p>':"");toast("تمت إضافة "+data.added_count+" طالبًا بلا حسابات دخول")}catch(err){result.innerHTML='<div class="notice error">'+esc(err.message)+'</div>'}finally{btn.disabled=false}
 };
}

async function quranRosterPage(v){
 const activity=safeStore.getSession("ihsan_quran_subtab")==="revision"?"revision":"memorization";
 const activityLabel=activity==="revision"?"المراجعة":"الحفظ";
 const groups=assignedGroups().slice().sort((a,b)=>compareStudentNames(a.name,b.name));
 const today=localDateISO(),savedGroup=safeStore.getSession("ihsan_quran_group")||"";
 v.innerHTML=head("متابعة "+activityLabel,"قائمة الفوج كاملة؛ سجّل مقدار الحفظ أو المراجعة لكل طالب ثم احفظ دفعة واحدة، مثل طريقة الحضور.")+
 '<section class="quran-mode-grid"><button type="button" class="quran-mode-card '+(activity==="memorization"?"active":"")+'" data-quran-roster-mode="memorization"><span class="quran-mode-symbol">✓</span><strong>متابعة الحفظ</strong></button><button type="button" class="quran-mode-card '+(activity==="revision"?"active":"")+'" data-quran-roster-mode="revision"><span class="quran-mode-symbol">↻</span><strong>متابعة المراجعة</strong></button></section>'+
 '<section class="card"><div class="form-grid"><label class="field">الفوج<select id="quran-roster-group"><option value="">اختر الفوج</option>'+groups.map(g=>'<option value="'+esc(g.id)+'" '+(String(g.id)===savedGroup?"selected":"")+'>'+esc(g.name)+'</option>').join("")+'</select></label><label class="field">التاريخ<input id="quran-roster-date" type="date" value="'+esc(S.date||today)+'" max="'+today+'"></label><div class="wide"><button type="button" class="btn" id="quran-roster-load">عرض الطلبة</button></div></div><div id="quran-roster-list" class="muted small">اختر الفوج والتاريخ.</div></section>';
 v.querySelectorAll("[data-quran-roster-mode]").forEach(button=>button.onclick=()=>{safeStore.setSession("ihsan_quran_subtab",button.dataset.quranRosterMode);quran($("#view"))});
 const group=$("#quran-roster-group"),date=$("#quran-roster-date"),host=$("#quran-roster-list");
 $("#quran-roster-load").onclick=async()=>{
  const gid=group.value,day=date.value;if(!gid||!day)return toast("اختر الفوج والتاريخ",true);
  if(day>today)return toast("لا يمكن تسجيل متابعة بتاريخ مستقبلي",true);
  safeStore.setSession("ihsan_quran_group",gid);safeStore.setSession("ihsan_quran_date",day);S.date=day;
  host.innerHTML='<div class="loading">جار تحميل قائمة الطلبة وسجلاتهم…</div>';
  try{
   const students=await api("/students?group_id="+encodeURIComponent(gid));
   if(!students.length){host.innerHTML='<div class="empty">لا يوجد طلاب في هذا الفوج.</div>';return}
   const records=await Promise.all(students.map(async student=>({student,rows:await api("/quran/progress?student_id="+encodeURIComponent(student.id))})));
   const existing={};records.forEach(({student,rows})=>{const row=rows.filter(x=>x.date===day&&x.activity===activity).sort((a,b)=>String(b.updated_at||"").localeCompare(String(a.updated_at||"")))[0];if(row)existing[student.id]=row});
   host.innerHTML='<p class="muted small">'+esc((groups.find(g=>String(g.id)===gid)||{}).name||"الفوج")+' · '+esc(day)+' · '+students.length+' طالبًا</p><div class="quran-roster-list">'+students.map(student=>{const old=existing[student.id],value=activity==="revision"?(old?.reviewed||""):(old?.memorized||"");return '<article class="card quran-roster-student" data-quran-roster-student="'+esc(student.id)+'" data-existing-id="'+esc(old?.id||"")+'"><h3>'+esc(studentDisplayName(student.name))+'</h3><label class="field">'+(activity==="revision"?"مقدار المراجعة":"مقدار الحفظ")+'<input data-quran-amount maxlength="300" value="'+esc(value)+'" placeholder="'+(activity==="revision"?"مثال: مراجعة الأثمان 10–15":"مثال: حفظ الثمن 15")+'"></label><label class="field">ملاحظة مختصرة<input data-quran-note maxlength="500" value="'+esc(old?.notes||"")+'" placeholder="اختياري"></label>'+(old?'<small class="muted">يوجد سجل محفوظ لهذا اليوم؛ سيُحدّث بدل إنشاء سجل مكرر.</small>':'')+'</article>'}).join("")+'</div><button type="button" class="btn" id="quran-roster-save">حفظ '+activityLabel+' للفوج</button>';
   $("#quran-roster-save").onclick=async()=>{
    const cards=[...host.querySelectorAll("[data-quran-roster-student]")].map(card=>({card,student_id:card.dataset.quranRosterStudent,id:card.dataset.existingId,amount:card.querySelector("[data-quran-amount]").value.trim(),notes:card.querySelector("[data-quran-note]").value.trim()})).filter(x=>x.amount||x.notes);
    if(!cards.length)return toast("أدخل مقدار الحفظ أو المراجعة لطالب واحد على الأقل",true);
    const btn=$("#quran-roster-save");btn.disabled=true;let saved=0,failed=[];
    for(const entry of cards){
     const body={date:day,activity,memorized:activity==="memorization"?entry.amount:"",reviewed:activity==="revision"?entry.amount:"",notes:entry.notes,errors:0,corrected:false};
     try{if(entry.id)await api("/quran/progress/"+encodeURIComponent(entry.id),{method:"PATCH",body:JSON.stringify(body)});else await api("/quran/progress",{method:"POST",body:JSON.stringify({...body,student_id:entry.student_id})});saved++}catch(error){failed.push({name:entry.card.querySelector("h3")?.textContent||"طالب",message:error.message})}
    }
    toast("حُفظت متابعة "+saved+" طالبًا"+(failed.length?"؛ تعذّر حفظ "+failed.length:""));
    if(failed.length)host.insertAdjacentHTML("afterbegin",'<div class="notice error">تعذّر حفظ: '+esc(failed.map(x=>x.name+" ("+x.message+")").join("، "))+'</div>');
    await $("#quran-roster-load").click();btn.disabled=false;
   };
  }catch(error){host.innerHTML='<div class="notice error">'+esc(error.message)+'</div>'}
 };
}
async function quranAchievementPage(v){
 const groups=assignedGroups().slice().sort((a,b)=>compareStudentNames(a.name,b.name));
 v.innerHTML=head("إنجاز الطلاب وترتيب الاجتهاد","سجلات الحفظ والمراجعة المحفوظة فعلًا، مرتبة بحسب الإنجاز خلال الفترة المحددة.")+'<section class="card"><div class="form-grid"><label class="field">الفوج<select id="achievement-group"><option value="">اختر الفوج</option>'+groups.map(g=>'<option value="'+esc(g.id)+'">'+esc(g.name)+'</option>').join("")+'</select></label><label class="field">الفترة<select id="achievement-period"><option value="week">آخر 7 أيام</option><option value="month">الشهر الحالي</option></select></label><div class="wide"><button id="achievement-load" class="btn" type="button">عرض الإنجاز والترتيب</button></div></div><div id="achievement-result" class="muted small">اختر الفوج والفترة لعرض النتائج.</div></section>';
 const groupSelect=$("#achievement-group"),periodSelect=$("#achievement-period"),host=$("#achievement-result"),savedGroup=safeStore.getSession("ihsan_quran_group");
 if(savedGroup&&groups.some(g=>String(g.id)===String(savedGroup)))groupSelect.value=savedGroup;
 $("#achievement-load").onclick=async()=>{
  const gid=groupSelect.value;if(!gid)return toast("اختر الفوج أولًا",true);
  const members=S.students.filter(st=>String(st.group_id)===String(gid));
  if(!members.length){host.innerHTML='<div class="empty">لا يوجد طلاب في هذا الفوج ضمن صلاحياتك.</div>';return}
  host.innerHTML='<div class="loading">جار قراءة سجلات الإنجاز…</div>';
  try{
   const today=localDateISO(),fromDate=periodSelect.value==="month"?today.slice(0,7)+"-01":shiftLocalDateISO(today,-6);
   const results=await Promise.all(members.map(async student=>({student,rows:await api("/quran/progress?student_id="+encodeURIComponent(student.id))})));
   const amountCount=r=>{const from=Number(r.thumn_from),to=Number(r.thumn_to);if(Number.isInteger(from)&&from>0&&Number.isInteger(to)&&to>=from)return to-from+1;const value=String(r.activity==="revision"?(r.reviewed||""):(r.memorized||""));const m=value.match(/(?:من\s+رقم\s*|الأثمان\s+من\s+رقم\s*|الثمن\s+من\s+رقم\s*|رقم\s*)(\d+)(?:\s*(?:إلى\s+رقم\s*|إلى\s*)(\d+))?/);return m?Math.max(1,Number(m[2]||m[1])-Number(m[1])+1):0};
   const stats=results.map(({student,rows})=>{const recent=rows.filter(r=>String(r.date||"")>=fromDate&&String(r.date||"")<=today&&(r.activity==="memorization"||r.activity==="revision"));return {student,mem:recent.filter(r=>r.activity==="memorization").reduce((n,r)=>n+amountCount(r),0),rev:recent.filter(r=>r.activity==="revision").reduce((n,r)=>n+amountCount(r),0),days:new Set(recent.map(r=>r.date).filter(Boolean)).size,entries:recent.length}}).sort((a,b)=>b.mem-a.mem||b.rev-a.rev||b.days-a.days||String(a.student.name).localeCompare(String(b.student.name),"ar"));
   const groupName=(groups.find(g=>String(g.id)===String(gid))||{}).name||"الفوج";
   host.innerHTML='<p class="muted small">'+esc(groupName)+' · '+esc(fromDate)+' إلى '+esc(today)+'</p><div class="stats"><div class="stat"><small>الطلاب</small><strong>'+stats.length+'</strong></div><div class="stat"><small>أثمان الحفظ</small><strong>'+stats.reduce((n,x)=>n+x.mem,0)+'</strong></div><div class="stat"><small>أثمان المراجعة</small><strong>'+stats.reduce((n,x)=>n+x.rev,0)+'</strong></div></div><div class="table-wrap"><table><thead><tr><th>الترتيب</th><th>الطالب</th><th>أثمان الحفظ</th><th>أثمان المراجعة</th><th>أيام المتابعة</th><th>عدد المتابعات</th></tr></thead><tbody>'+stats.map((x,i)=>'<tr><td>'+(i+1)+'</td><td>'+esc(x.student.name)+'</td><td>'+x.mem+'</td><td>'+x.rev+'</td><td>'+x.days+'</td><td>'+x.entries+'</td></tr>').join("")+'</tbody></table></div><p class="muted small">الترتيب مبني على سجلات الحفظ والمراجعة المسجلة خلال الفترة، ولا يحكم على قيمة الطالب أو إتقانه.</p>';
  }catch(error){host.innerHTML='<div class="notice error">'+esc(error.message)+'</div>'}
 };
}
async function studentProfile(v,id){
 const st=S.students.find(x=>x.id===id);
 if(!st){v.innerHTML=head("ملف الطالب","لم يعد الطالب ظاهرًا في هذا الفوج.");return}
 v.innerHTML=head("ملف الطالب",st.name+" · "+((S.groups.find(g=>g.id===st.group_id)||{}).name||"بلا فوج"))+'<button id="back-students" class="btn secondary">العودة إلى قائمة الطلاب</button><div class="loading">جار تحميل السجل…</div>';
 $("#back-students").onclick=()=>{S.tab="students";shell();page()};
 const isStudent=S.user.role==="student",base=st.group_id?"/attendance?group_id="+encodeURIComponent(st.group_id)+"&history=1&student_id="+encodeURIComponent(st.id):"/attendance?history=1";
 try{
  const jobs=[api("/quran/progress"+(isStudent?"":"?student_id="+encodeURIComponent(st.id))),api(base)];
  jobs.push(api("/test-history?student_id="+encodeURIComponent(st.id)));

  jobs.push(api("/students/"+encodeURIComponent(st.id)+"/profile"));
  jobs.push(api("/points/summary"+(isStudent?"":"?student_id="+encodeURIComponent(st.id))).catch(()=>null));
  jobs.push(api("/tasks"+(isStudent?"":"?student_id="+encodeURIComponent(st.id))).catch(()=>null));
  jobs.push(api("/quran/summary"+(isStudent?"":"?student_id="+encodeURIComponent(st.id))).catch(()=>null));
  jobs.push(api("/points/streak"+(isStudent?"":"?student_id="+encodeURIComponent(st.id))).catch(()=>null));
  const data=await Promise.all(jobs),progress=data[0]||[],attendanceRows=data[1]||[],testRows=data[2]||[],profile=data[3]||{},pointsSummary=data[4]||null,taskData=data[5]||null,quranSummary=data[6]||null,streakData=data[7]||{streaks:[],badges:[]};
  const present=attendanceRows.filter(x=>x.status==="present").length,absent=attendanceRows.filter(x=>x.status==="absent").length,late=attendanceRows.filter(x=>x.status==="late").length;
  let html=head("ملخص الطالب",st.name)+'<div class="stats"><div class="stat"><small>سجلات الحضور</small><strong>'+attendanceRows.length+'</strong></div><div class="stat"><small>الحضور</small><strong>'+present+'</strong></div><div class="stat"><small>الغياب</small><strong>'+absent+'</strong></div><div class="stat"><small>التأخر</small><strong>'+late+'</strong></div><div class="stat"><small>متابعات القرآن</small><strong>'+progress.length+'</strong></div><div class="stat"><small>محاولات الاختبارات</small><strong>'+testRows.length+'</strong></div></div><section class="card"><h3>سجل الحضور</h3><div class="list">'+(attendanceRows.length?attendanceRows.slice(0,40).map(r=>'<div class="list-row"><div><strong>'+esc(r.date)+'</strong><small>'+esc(r.note||"")+'</small></div><span class="pill">'+({"present":"حاضر","absent":"غائب","late":"متأخر","excused":"بعذر"}[r.status]||"غير مسجل")+'</span></div>').join(""):'<div class="empty">لا توجد سجلات حضور لهذا الطالب.</div>')+'</div></section><section class="card"><h3>الحفظ والمراجعة</h3><div class="list">'+(progress.length?progress.map(r=>'<div class="list-row"><div><strong>'+esc(r.date)+'</strong><small>الحفظ: '+esc(r.memorized||"—")+' · المراجعة: '+esc(r.reviewed||"—")+' · '+esc(r.notes||"")+'</small></div></div>').join(""):'<div class="empty">لا توجد متابعة قرآنية مسجّلة.</div>')+'</div></section>';
  const dailyLogs=(quranSummary&&quranSummary.recent)||[],dailyTotals=(quranSummary&&quranSummary.totals)||{};
  const dailyKindLabel={hifz:"الحفظ الجديد",thabit:"التثبيت",ward:"الورد"};
  const streakLabels={hifz:"الحفظ الجديد",thabit:"التثبيت",ward:"الورد",wird:"الورد اليومي",asr:"صلاة العصر",adhkar:"الأذكار",mandatory_classes:"الحصص الإلزامية",quran_classes:"حصص القرآن",bring:"إحضار المطلوب",fajr:"صلاة الفجر",shuruq:"صلاة الشروق",maghrib:"صلاة المغرب",attendance:"الحضور"};
  const milestoneLabels={3:"بداية موفقة",5:"ثابت خمسة أيام",7:"مواظب أسبوعًا",14:"همة أسبوعين",30:"صاحب الهمة – 30 يومًا",60:"ثبات شهرين",90:"همة 90 يومًا",180:"نصف عام من المواظبة",365:"عام من الثبات"};
  const streakCards=(streakData.streaks||[]).map(row=>'<div class="stat"><small>'+esc(streakLabels[row.activity]||row.activity)+'</small><strong>'+(Number(row.current_days||0)>0?Number(row.current_days||0)+' يوم متتابع':'انقطعت السلسلة')+'</strong><small>آخر إنجاز: '+esc(row.last_date||"—")+'</small></div>').join("");
  const badgeCards=(streakData.badges||[]).map(row=>'<div class="list-row"><div><strong>🏅 '+esc(milestoneLabels[Number(row.milestone_days)]||("وسام "+row.milestone_days+" يوم"))+'</strong><small>'+esc(streakLabels[row.activity]||row.activity)+' · '+esc(row.awarded_at||"")+'</small></div><strong>+'+Number(row.points_awarded||0)+'</strong></div>').join("");
  html+='<section class="card"><h3>سلسلة المواظبة والأوسمة</h3><div class="stats">'+(streakCards||'<div class="empty">ابدأ إنجازك اليومي لتظهر سلسلة مواظبتك هنا.</div>')+'</div><div class="list">'+(badgeCards||'<div class="empty">أوسمتك تظهر تلقائيًا عند بلوغ مدد الاستمرار.</div>')+'</div><p class="muted small">تُحتسب السلسلة من السجلات اليومية المعتمدة، وتُمنح مكافآت الإنجاز تلقائيًا عند بلوغ المدد المحددة.</p></section>';
  html+='<section class="card"><h3>سجل الحفظ اليومي</h3><div class="stats"><div class="stat"><small>الحفظ الجديد</small><strong>'+Number(dailyTotals.hifz?.days||0)+' يوم · '+Number(dailyTotals.hifz?.total||0)+'</strong></div><div class="stat"><small>التثبيت</small><strong>'+Number(dailyTotals.thabit?.days||0)+' يوم · '+Number(dailyTotals.thabit?.total||0)+'</strong></div><div class="stat"><small>الورد</small><strong>'+Number(dailyTotals.ward?.days||0)+' يوم · '+Number(dailyTotals.ward?.total||0)+'</strong></div></div><div class="list">'+(dailyLogs.length?dailyLogs.map(r=>'<div class="list-row"><div><strong>'+esc(r.day)+'</strong><small>'+esc(dailyKindLabel[r.kind]||r.kind)+' · '+esc(r.amount)+' '+esc(r.unit||"")+'</small></div></div>').join(""):'<div class="empty">لا توجد سجلات يومية للحفظ أو التثبيت أو الورد بعد.</div>')+'</div><p class="muted small">هذا السجل مستقل عن متابعة التسميع والمراجعة، ولا يتأثر بإضافة النقاط العامة أو خصمها.</p></section>';
  const taskCounts=(taskData&&taskData.counts)||{},taskRows=(taskData&&taskData.tasks)||[],openTasks=taskRows.filter(t=>t.status==="pending"||t.status==="late");
  html+='<section class="card"><h3>النقاط والمهام</h3><div class="stats"><div class="stat"><small>رصيد النقاط</small><strong>'+Number(pointsSummary?.totals?.balance??pointsSummary?.totals?.achievement??0)+'</strong></div><div class="stat"><small>مهام مطلوبة</small><strong>'+Number(taskCounts.pending||0)+'</strong></div><div class="stat"><small>مهام متأخرة</small><strong>'+Number(taskCounts.late||0)+'</strong></div></div>'+(openTasks.length?'<div class="list">'+openTasks.slice(0,6).map(t=>'<div class="list-row"><div><strong>'+esc(t.title)+'</strong><small>'+esc(t.type_label)+(t.due_date?' · '+esc(t.due_date):"")+'</small></div><span class="pill">'+esc(t.status_label)+'</span></div>').join("")+'</div>':'<p class="muted small">لا توجد مهام مفتوحة على هذا الطالب.</p>')+'</section>';
  html+='<section class="card"><h3>نتائج الاختبارات</h3><div class="list">'+(testRows.length?testRows.map(r=>'<div class="list-row"><div><strong>'+esc(r.title||"اختبار")+'</strong><small>'+esc(r.submitted_at||"")+'</small></div><strong>'+r.score+' / '+r.total+'</strong></div>').join(""):'<div class="empty">لا توجد نتائج اختبارات لهذا الطالب.</div>')+'</div></section>';
  html+='<section class="card" id="student-period-ranking"><div class="section-head"><div><h3>ترتيب الطالب</h3><p class="muted small">ترتيب نقاط الإنجاز في الفترة المختارة، دون رصيد المتجر.</p></div><label class="field">الفترة<select id="student-ranking-period"><option value="weekly">أسبوعي</option><option value="monthly">شهري</option><option value="yearly">سنوي</option></select></label></div><div id="student-ranking-results" class="loading">جار حساب الترتيب…</div></section>';
  if(!isStudent){
   html+='<section class="card"><h3>البيانات الإدارية والدراسية</h3><p class="muted small">تُحفظ هذه البيانات في ملف الطالب ولا تغيّر سجلات الحضور أو الاختبارات.</p><form id="student-profile-form" class="form-grid"><label class="field">رقم هاتف الطالب<input name="phone" maxlength="50" value="'+esc(profile.phone||"")+'"></label><label class="field">طريقة التواصل المفضلة<select name="preferred_contact"><option value="">غير محددة</option>'+["الهاتف","واتساب","ولي الأمر","أخرى"].map(x=>'<option '+(profile.preferred_contact===x?'selected':'')+'>'+x+'</option>').join("")+'</select></label><label class="field">اسم ولي الأمر<input name="guardian_name" maxlength="120" value="'+esc(profile.guardian_name||"")+'"></label><label class="field">هاتف ولي الأمر<input name="guardian_phone" maxlength="50" value="'+esc(profile.guardian_phone||"")+'"></label><label class="field">العمر<input name="age" type="number" min="3" max="100" step="1" value="'+esc(profile.age??"")+'"></label><label class="field">المستوى الدراسي<input name="school_grade" maxlength="120" value="'+esc(profile.school_grade||"")+'"></label><label class="field">المؤسسة التعليمية<input name="school_name" maxlength="160" value="'+esc(profile.school_name||"")+'"></label><label class="field">المعدل من 20<input name="average" type="number" min="0" max="20" step="0.01" value="'+esc(profile.average??"")+'"></label><label class="field wide">ملاحظات إدارية/دراسية<textarea name="notes" rows="3" maxlength="1200">'+esc(profile.notes||"")+'</textarea></label><div class="wide"><button class="btn" type="submit">حفظ بيانات الملف</button><span class="muted small" id="student-profile-status">'+(profile.updated_at?'آخر تحديث: '+esc(profile.updated_at):'لم تُسجّل بيانات إضافية بعد.')+'</span></div></form></section>';
  }
  v.innerHTML=html+'<button id="back-students-bottom" class="btn secondary">العودة إلى قائمة الطلاب</button>';$("#back-students-bottom").onclick=()=>{S.tab="students";shell();page()};
  $("#student-profile-form")?.addEventListener("submit",async e=>{e.preventDefault();const form=e.currentTarget,button=form.querySelector('button[type="submit"]'),f=new FormData(form);if(button){button.disabled=true;button.textContent="جار الحفظ…"}try{const saved=await api("/students/"+encodeURIComponent(st.id)+"/profile",{method:"PATCH",body:JSON.stringify(Object.fromEntries(f.entries()))});const status=$("#student-profile-status");if(status)status.textContent="حُفظت البيانات بنجاح — "+String(saved.updated_at||"");toast("تم حفظ ملف الطالب بنجاح.")}catch(err){toast(err.message,true)}finally{if(button){button.disabled=false;button.textContent="حفظ بيانات الملف"}}});
  const rankingPeriod=$("#student-ranking-period"),rankingHost=$("#student-ranking-results");
  const renderStudentRankings=async(period)=>{
   if(!rankingHost)return;
   rankingHost.innerHTML='<div class="loading">جار حساب الترتيب…</div>';
   const params="&period="+encodeURIComponent(period)+"&group_id="+encodeURIComponent(st.group_id||"")+"&student_id="+encodeURIComponent(st.id);
   const scopes=[["academy","الأكاديمية"],["group","الفوج"],["team","الفرقة"]];
   try{
    const results=await Promise.all(scopes.map(([scope])=>api("/effort/ranking?scope="+scope+params).catch(error=>({error:error.message}))));
    const cards=results.map((data,index)=>{
     const label=scopes[index][1];
     if(data?.error)return '<div class="list-row"><strong>'+label+'</strong><span class="muted">غير متاح</span></div>';
     const row=(data.rows||[]).find(item=>item.student_id===st.id);
     if(!row)return '<div class="list-row"><div><strong>'+label+'</strong><small>'+(index===2?"لم تُسند إلى فرقة بعد":"لا توجد بيانات كافية لهذه الفترة")+'</small></div><span class="muted">—</span></div>';
     const movement=row.rank_change===null||row.rank_change===undefined?'<span class="muted">لا توجد مقارنة سابقة</span>':row.rank_change>0?'<strong style="color:#16834a">↑ صعد '+row.rank_change+' مركزًا</strong>':row.rank_change<0?'<strong style="color:#c0392b">↓ تراجع '+Math.abs(row.rank_change)+' مركزًا</strong>':'<span class="muted">— ثابت</span>';
     return '<div class="list-row"><div><strong>'+label+'</strong><small>'+esc(data.from_date||"")+' إلى '+esc(data.to_date||"")+' · '+movement+'</small></div><strong>'+row.rank+' / '+Number(data.total_count||0)+'</strong></div>';
    });
    rankingHost.innerHTML='<div class="list">'+cards.join("")+'</div>';
   }catch(error){rankingHost.innerHTML='<div class="notice error">'+esc(error.message)+'</div>'}
  };
  rankingPeriod?.addEventListener("change",()=>renderStudentRankings(rankingPeriod.value));
  renderStudentRankings(rankingPeriod?.value||"weekly");

 }catch(e){v.innerHTML=head("ملف الطالب",st.name)+'<div class="notice error">'+esc(e.message)+'</div><button class="btn secondary" id="back-students">العودة إلى قائمة الطلاب</button>';$("#back-students").onclick=()=>{S.tab="students";shell();page()}}
}
function printReportWindow(title,content,subtitle="",options={}){
 const landscape=!!options.landscape;
 const w=window.open("","_blank");
 if(!w){toast("اسمح بفتح نافذة التقرير ثم أعد المحاولة.",true);return}
 w.opener=null;w.document.open();
 w.document.write('<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(title)+'</title><style>@page{size:A4 '+(landscape?"landscape":"portrait")+';margin:8mm}body{font-family:Arial,Tahoma,sans-serif;color:#17382e;margin:24px;line-height:1.7}h1,h2,h3{color:#075540;margin:0 0 8px}p{color:#52665e;margin:0 0 10px}.table-wrap{overflow:visible}table{width:100%;border-collapse:collapse;margin-top:12px;font-size:'+(landscape?"12px":"14px")+'}th,td{border:1px solid #ccd8d2;padding:'+(landscape?"5px 6px":"8px")+';text-align:right;vertical-align:top;word-break:break-word}th{background:#e8f4ed}button{padding:10px 16px;border:0;border-radius:8px;background:#075540;color:#fff;font-weight:700;cursor:pointer}@media print{body{margin:0}button{display:none}tr{break-inside:avoid}}</style></head><body><h1>'+esc(title)+'</h1>'+(subtitle?'<p>'+esc(subtitle)+'</p>':'')+content+'<p><button id="print-report" type="button">طباعة / حفظ PDF</button></p></body></html>');
 w.document.close();
 const print=()=>{try{w.focus();w.print()}catch{}};
 w.document.getElementById("print-report")?.addEventListener("click",print);
 setTimeout(print,350);
}

async function reportsPage(v){
 if(S.user.role==="student"){v.innerHTML=head("التقارير","غير مسموح");return}
 v.innerHTML=head("التقارير الأسبوعية","ملخص الحضور لكل طالب في الفوج المحدد، دون حذف السجلات القديمة.")+'<section class="card"><label class="field">الفوج<select id="report-group">'+groupOpts()+'</select></label><button class="btn" id="load-report" style="margin-top:12px">عرض تقرير آخر 7 أيام</button></section><div id="report-result" class="loading">اختر الفوج ثم اعرض التقرير.</div>';
 const render=async()=>{const gid=$("#report-group").value;if(!gid)return toast("اختر الفوج",true);const host=$("#report-result");host.innerHTML='<div class="loading">جار إعداد التقرير…</div>';try{const rows=await api("/attendance?group_id="+encodeURIComponent(gid)+"&history=1");const cutoff=shiftLocalDateISO(localDateISO(),-6);const week=rows.filter(r=>String(r.date)>=cutoff);const students=S.students.filter(st=>st.group_id===gid).slice().sort((a,b)=>compareStudentNames(a.name,b.name));const count=(id,status)=>week.filter(r=>r.student_id===id&&r.status===status).length;const present=week.filter(r=>r.status==="present").length,absent=week.filter(r=>r.status==="absent").length,late=week.filter(r=>r.status==="late").length,marked=week.length;host.innerHTML='<div class="stats"><div class="stat"><small>سجلات الأسبوع</small><strong>'+marked+'</strong></div><div class="stat"><small>حاضر</small><strong>'+present+'</strong></div><div class="stat"><small>غائب</small><strong>'+absent+'</strong></div><div class="stat"><small>متأخر</small><strong>'+late+'</strong></div></div><section class="card"><h3>تفصيل الطلاب · '+esc(cutoff)+' إلى '+esc(localDateISO())+'</h3><div class="table-wrap"><table><thead><tr><th>الطالب</th><th>حاضر</th><th>غائب</th><th>متأخر</th><th>بعذر</th><th>السجلات</th></tr></thead><tbody>'+students.map(st=>'<tr><td>'+esc(studentDisplayName(st.name))+'</td><td>'+count(st.id,"present")+'</td><td>'+count(st.id,"absent")+'</td><td>'+count(st.id,"late")+'</td><td>'+count(st.id,"excused")+'</td><td>'+week.filter(r=>r.student_id===st.id).length+'</td></tr>').join("")+'</tbody></table></div></section>'}catch(e){host.innerHTML='<div class="notice error">'+esc(e.message)+'</div>'}};
 $("#load-report").onclick=render;if(S.groups.length)render();
}

async function leaderboardPage(v){
 const isStudent=S.user.role==="student",isAdmin=S.user.role==="admin";
 const staff=["admin","director","teacher","supervisor"].includes(S.user.role);
 let groupId=isStudent?(S.user.group_id||((S.groups[0]||{}).id||"")):(safeStore.getSession("ihsan_leaderboard_group")||((S.groups[0]||{}).id||""));
 const savedScope=safeStore.getSession("ihsan_leaderboard_scope")||"group";
 const selectedScope=isAdmin&&savedScope==="all"?"__all__":groupId;
 const sortOptions=[["points","النتيجة العامة"],["attendance_rate","المواظبة والحضور"],["quran_rate","الحفظ والمراجعة"],["quiz_rate","إتقان الاختبارات"],["challenge_rate","التحديات"]];
 const savedSort=safeStore.getSession("ihsan_leaderboard_sort")||"points";
 const domainOptions=sortOptions.map(x=>'<option value="'+x[0]+'" '+(savedSort===x[0]?"selected":"")+'>'+x[1]+'</option>').join("");
 const scopeOptions=(isAdmin?'<option value="__all__" '+(selectedScope==="__all__"?"selected":"")+' >كل الأفواج</option>':"")+S.groups.map(g=>'<option value="'+esc(g.id)+'" '+(selectedScope===g.id?"selected":"")+'>'+esc(g.name)+'</option>').join("");
 v.innerHTML=head("الترتيب العام","ترتيب تشجيعي يوازن بين المواظبة والقرآن والاختبارات والتحديات، ولا يقيس قيمة الطالب.")+
 (staff?'<section class="card leaderboard-controls"><div class="form-grid">'+
 '<label class="field">نطاق الترتيب<select id="leaderboard-group">'+scopeOptions+'</select></label>'+
 '<label class="field">رتّب حسب<select id="leaderboard-domain">'+domainOptions+'</select></label>'+
 '</div><p class="muted small">يمكن للمدير العام عرض جميع الأفواج؛ أما بقية الأدوار فتظهر لها الأفواج الواقعة ضمن صلاحياتها فقط.</p><button class="btn" id="leaderboard-refresh">تحديث الترتيب</button></section>':
 '<p class="muted small">يعرض هذا الترتيب طلاب فوجك فقط. النتيجة العامة: 25٪ المواظبة، 35٪ القرآن، 30٪ إتقان الاختبارات، 10٪ التحديات.</p>')+
 '<div id="leaderboard-content" class="loading">جار حساب الترتيب…</div>';
 const render=async()=>{
  const scope=staff?($("#leaderboard-group")?.value||""):"";
  const all=Boolean(isAdmin&&scope==="__all__");
  const group=staff&&!all?scope:groupId;
  const sortKey=staff?($("#leaderboard-domain")?.value||"points"):savedSort;
  const host=$("#leaderboard-content");
  if(staff&&!all&&!group){host.innerHTML='<div class="empty">اختر فوجًا لعرض ترتيبه.</div>';return}
  host.innerHTML='<div class="loading">جار حساب الترتيب…</div>';
  try{
   const query=staff?(all?"?scope=all":"?group_id="+encodeURIComponent(group)):"";
   const rows=await api("/leaderboard"+query);
   if(!rows.length){host.innerHTML='<div class="card empty">لا توجد بيانات كافية للترتيب بعد. يبدأ الترتيب مع تسجيل الحضور والحفظ والمراجعة والاختبارات.</div>';return}
   const sorted=rows.slice().sort((a,b)=>Number(b[sortKey]||0)-Number(a[sortKey]||0)||Number(b.points||0)-Number(a.points||0)||compareStudentNames(a.name,b.name));
   const percent=value=>Number(value||0).toLocaleString("ar-DZ")+"٪";
   host.innerHTML='<section class="card leaderboard-results"><div class="notice">الترتيب للتحفيز فقط، ولا يستبدل تقييم المعلم لجودة الحفظ والتجويد والفهم.</div><div class="table-wrap"><table><thead><tr><th>الترتيب</th><th>الطالب</th>'+(all?'<th>الفوج</th>':"")+'<th>النتيجة /100</th><th>المواظبة</th><th>القرآن</th><th>الاختبارات</th><th>التحديات</th></tr></thead><tbody>'+sorted.map((r,i)=>'<tr '+(r.is_self?'class="leaderboard-self"':"")+'><td>'+(i+1)+'</td><td>'+esc(r.name)+(r.is_self?' <span class="pill">أنت</span>':"")+'</td>'+(all?'<td>'+esc(r.group_name||"بلا فوج")+'</td>':"")+'<td><strong>'+Number(r.points||0)+'</strong></td><td>'+percent(r.attendance_rate)+'</td><td>'+percent(r.quran_rate)+'</td><td>'+percent(r.quiz_rate)+'</td><td>'+percent(r.challenge_rate)+'</td></tr>').join("")+'</tbody></table></div></section>';
  }catch(e){host.innerHTML='<div class="notice error">'+esc(e.message)+'</div>'}
 };
 $("#leaderboard-refresh")?.addEventListener("click",render);
 $("#leaderboard-group")?.addEventListener("change",()=>{
  const value=$("#leaderboard-group").value;
  if(isAdmin)safeStore.setSession("ihsan_leaderboard_scope",value==="__all__"?"all":"group");
  if(value!=="__all__")safeStore.setSession("ihsan_leaderboard_group",value);
  render();
 });
 $("#leaderboard-domain")?.addEventListener("change",()=>{safeStore.setSession("ihsan_leaderboard_sort",$("#leaderboard-domain").value);render()});
 if(!staff||S.groups.length)await render();
}



async function sheikhCheckPage(v){
 if(S.user.role!=="teacher"){v.innerHTML=head("فحص واجهة الشيخ","هذه الصفحة مخصصة لحساب الشيخ.");return}
 v.innerHTML=head("فحص واجهة الشيخ","فحص قراءة محدود بطلابك وأفواجك فقط، دون تعديل أي سجل.")+'<div class="loading">جار فحص نطاق الشيخ…</div>';
 try{
  const [groups,students]=await Promise.all([api("/groups"),api("/students")]);
  const activeGroups=(Array.isArray(groups)?groups:[]).filter(g=>g.active!==false);
  const groupIds=new Set(activeGroups.map(g=>String(g.id)));
  const visibleStudents=Array.isArray(students)?students:[];
  const withoutGroup=visibleStudents.filter(s=>!s.group_id||!groupIds.has(String(s.group_id))).length;
  const checks=[
   {label:"الأفواج المتاحة للشيخ",value:activeGroups.length,ok:activeGroups.length>0,detail:activeGroups.length?"توجد أفواج ضمن نطاق حسابك":"لا تظهر أفواج مرتبطة بحسابك"},
   {label:"الطلاب ضمن نطاقك",value:visibleStudents.length,ok:true,detail:"هذه أعداد الطلاب الذين تسمح صلاحيات حسابك بعرضهم"},
   {label:"ارتباط الطلاب بأفواجك",value:withoutGroup,ok:withoutGroup===0,detail:withoutGroup===0?"كل الطلاب الظاهرين مرتبطون بأفواجك النشطة":withoutGroup+" طالبًا يحتاج مراجعة ارتباطه بالفوج"}
  ];
  v.innerHTML=head("فحص واجهة الشيخ","فحص قراءة محدود بطلابك وأفواجك فقط.")+
   '<section class="card"><div class="section-head"><div><h3>نتيجة الفحص</h3><p class="muted small">لا تُعرض أسماء الطلاب ولا تُجرى أي تغييرات على البيانات.</p></div><button class="btn secondary" id="sheikh-check-refresh" type="button">إعادة الفحص</button></div><div class="system-check-list">'+checks.map(x=>'<article class="system-check-item '+(x.ok?"is-ok":"is-warning")+'"><span class="system-check-mark" aria-hidden="true">'+(x.ok?"✓":"!")+'</span><div><strong>'+esc(x.label)+'</strong><small>'+esc(x.detail)+'</small></div><span class="system-check-value">'+Number(x.value)+'</span></article>').join("")+'</div></section>'+
   '<p class="muted small">هذا فحص أولي لحدود البيانات التي يعيدها النظام لحسابك، وليس اختبار اختراق أو تحققًا من كل وظيفة.</p>';
  $("#sheikh-check-refresh")?.addEventListener("click",()=>sheikhCheckPage(v));
 }catch(e){v.innerHTML=head("فحص واجهة الشيخ","تعذّر إكمال الفحص.")+'<div class="notice error">'+esc(e.message)+'</div>'}
}
async function systemCheckPage(v){
 if(S.user.role!=="admin"){v.innerHTML=head("فحص النظام","هذه الصفحة متاحة للمدير فقط.")+'<div class="notice error">لا تملك صلاحية فحص بيانات النظام.</div>';return}
 v.innerHTML=head("فحص النظام","قراءة تشخيصية لا تعدّل بيانات الطلاب أو الأفواج.")+'<div class="loading">جار فحص سلامة البيانات…</div>';
 try{
  const result=await api("/admin/system-check"),c=result.counts||{},sc=result.schema||{};
  const checks=[
   {title:"ترحيل التسجيل 0009 (join_requests + دور visitor)",value:Number(sc.join_requests_table||0)&&Number(sc.visitor_role_allowed||0)?"مكتمل":"ناقص",ok:Number(sc.join_requests_table||0)===1&&Number(sc.visitor_role_allowed||0)===1,good:"ترحيل 0009 مطبّق على قاعدة البيانات",bad:"الترحيل 0009 غير مطبّق؛ التسجيل الذاتي يرجع 500 والنشر الحيّ يعمل ناقصًا"},
   {title:"حساب المدير",value:Number(c.active_admins||0),ok:Number(c.active_admins||0)>0,good:"يوجد مدير نشط",bad:"لا يوجد مدير نشط"},
   {title:"حسابات الطلاب",value:Number(c.active_students||0),ok:Number(c.students_without_login||0)===0,good:"كل ملفات الطلاب مرتبطة بحسابات دخول",bad:Number(c.students_without_login||0)+" ملف طالب بلا حساب دخول"},
   {title:"ارتباط الطلاب بالأفواج",value:Number(c.students_without_active_group||0),ok:Number(c.students_without_active_group||0)===0,good:"كل الطلاب مرتبطون بأفواج نشطة",bad:Number(c.students_without_active_group||0)+" طالب بلا فوج نشط"},
   {title:"تعيين معلمي الأفواج",value:Number(c.groups_without_valid_teacher||0),ok:Number(c.groups_without_valid_teacher||0)===0,good:"كل الأفواج لها معلم صالح",bad:Number(c.groups_without_valid_teacher||0)+" فوج دون معلم صالح"},
   {title:"إعداد المدير الأول",value:result.bootstrap_setup_enabled?"مفعّل":"مغلق",ok:!result.bootstrap_setup_enabled,good:"مسار الإعداد الأولي مغلق",bad:"تحقق من إغلاق الإعداد الأولي"}
  ];
  const roles=Array.isArray(result.roles)?result.roles:[];
  const roleLabel={admin:"المدير",director:"مدير المدرسة",teacher:"المعلم",supervisor:"المشرف",student:"الطالب",visitor:"زائر/محسن"};
  v.innerHTML=head("فحص النظام","آخر فحص: "+esc(result.checked_at||"غير متاح"))+
   '<section class="card"><div class="section-head"><div><h3>البيانات الأساسية</h3><p>تتصل الصفحة بقاعدة البيانات الفعلية، وتعرض أعدادًا فقط دون أسماء أو كلمات مرور.</p></div><button class="btn secondary" id="system-check-refresh" type="button">إعادة الفحص</button></div><div class="stats system-check-stats"><div class="stat"><small>حسابات نشطة</small><strong>'+Number(c.active_users||0)+'</strong></div><div class="stat"><small>ملفات الطلاب النشطة</small><strong>'+Number(c.active_students||0)+'</strong></div><div class="stat"><small>السجلات التعليمية</small><strong>'+Number(c.saved_records||0)+'</strong></div><div class="stat"><small>جلسات منتهية</small><strong>'+Number(c.expired_sessions||0)+'</strong></div></div><p class="muted small">التخزين: '+esc(result.storage||"غير معروف")+'</p></section>'+
   '<section class="card"><h3>مؤشرات سلامة النظام</h3><div class="system-check-list">'+checks.map(x=>'<article class="system-check-item '+(x.ok?"is-ok":"is-warning")+'"><span class="system-check-mark" aria-hidden="true">'+(x.ok?"✓":"!")+'</span><div><strong>'+esc(x.title)+'</strong><small>'+esc(x.ok?x.good:x.bad)+'</small></div><span class="system-check-value">'+esc(x.value)+'</span></article>').join("")+'</div></section>'+
   '<section class="card"><h3>توزيع الحسابات حسب الدور</h3><div class="system-role-list">'+(roles.length?roles.map(r=>'<div class="system-role-row"><span>'+esc(roleLabel[r.role]||r.role)+'</span><strong>'+Number(r.total||0)+'</strong></div>').join(""):'<p class="muted">لا توجد حسابات نشطة.</p>')+'</div>'+
   (Number(c.active_director_supervisor_accounts||0)>0?'<div class="notice error">توجد حسابات مدير مدرسة أو مشرف؛ يجب اختبار صلاحياتها وحدود نطاقها قبل الاعتماد.</div>':'<p class="muted small">لا توجد حسابات مدير مدرسة أو مشرف نشطة حاليًا؛ إنشاء هذه الأدوار وتحديد نطاقها ما زال عملًا مستقلًا مطلوبًا قبل استخدامها.</p>')+'</section>'+
   '<section class="card"><h3>السجلات المحفوظة حسب النوع</h3><div class="system-role-list">'+((result.collections||[]).length?result.collections.map(row=>'<div class="system-role-row"><span>'+esc(row.collection)+'</span><strong>'+Number(row.total||0)+'</strong></div>').join(""):'<p class="muted">لا توجد سجلات بعد.</p>')+'</div></section>'+
   (Number(sc.join_requests_table||0)===1&&Number(sc.visitor_role_allowed||0)===1?'<p class="muted small">ترحيل 0009 مطبّق؛ التسجيل الذاتي يعمل على الإنتاج.</p>':'<section class="card" id="migrate-0009-card"><h3>تفعيل التسجيل الذاتي (ترحيل 0009)</h3><p class="muted small">يُنشئ جدول طلبات الانضمام ودور «زائر/محسن». يحفظ نسخة احتياطية داخلية داخل academy_records أولًا، ثم يُطبّق التغييرات في معاملة واحدة ويستعيد كل الروابط والجلسات — لا تُفقد أي بيانات.</p><div class="student-actions"><button class="btn" id="migrate-0009-btn" type="button">تطبيق الترحيل 0009 الآن</button><span class="muted small" id="migrate-0009-status"></span></div></section>')+
   '<p class="muted small">هذا فحص للاتساق والأعداد فقط، وليس اختبارًا كاملًا لكل صفحة أو لكل صلاحية.</p>';
  $("#migrate-0009-btn")?.addEventListener("click",async()=>{
    const btn=$("#migrate-0009-btn"),status=$("#migrate-0009-status");
    if(btn.dataset.armed!=="1"){btn.dataset.armed="1";btn.textContent="تأكيد التطبيق — اضغط مرة أخرى";if(status)status.textContent="سيُنشأ جدول join_requests ودور visitor.";return}
    btn.disabled=true;if(status)status.textContent="جار تطبيق الترحيل وحفظ النسخة الاحتياطية…";
    try{
      const r=await api("/admin/migrate/0009",{method:"POST",body:JSON.stringify({confirm:"APPLY-0009"})});
      toast(r.applied?"طُطبّق الترحيل 0009؛ التسجيل الذاتي أصبح يعمل":"الترحيل كان مطبّقًا بالفعل");
      await systemCheckPage(v);
    }catch(error){btn.disabled=false;btn.dataset.armed="";if(status)status.textContent=error.message}
  });
  $("#system-check-refresh")?.addEventListener("click",()=>systemCheckPage(v));
 }catch(e){v.innerHTML=head("فحص النظام","تعذّر إكمال الفحص.")+'<div class="notice error">'+esc(e.message)+'</div><button class="btn" id="system-check-retry">إعادة المحاولة</button>';$("#system-check-retry")?.addEventListener("click",()=>systemCheckPage(v))}
}
async function auditPage(v){
 if(S.user.role!=="admin"){v.innerHTML=head("سجل العمليات","هذه الصفحة متاحة للمدير فقط.")+'<div class="notice error">لا تملك صلاحية عرض سجل العمليات.</div>';return}
 v.innerHTML=head("سجل العمليات","مراجعة أحدث العمليات الإدارية لتسهيل تتبع التغييرات.")+'<div class="loading">جار تحميل السجل…</div>';
 try{
  const rows=await api("/admin/audit");
  const labels={login:"تسجيل دخول",logout:"تسجيل خروج",migrate_0009_applied:"تطبيق ترحيل 0009",migrate_0009_skipped:"ترحيل 0009 كان مطبّقًا",admin_bootstrap:"إنشاء المدير",password_change:"تغيير كلمة المرور",group_create:"إنشاء فوج",group_update:"تعديل فوج",teacher_create:"إنشاء معلم",teacher_update:"تعديل معلم",student_create:"إنشاء طالب",student_update:"تعديل طالب",attendance_save:"حفظ الحضور",quran_progress_add:"إضافة متابعة قرآنية",quran_progress_update:"تعديل متابعة قرآنية",quran_progress_delete:"حذف متابعة قرآنية",test_create:"إنشاء اختبار",test_submit:"تقديم اختبار",post_create:"نشر محتوى",notification_create:"نشر تنبيه",admin_backup_export:"تصدير نسخة احتياطية",admin_backup_full_export:"تصدير نسخة كاملة",admin_backup_restore:"استعادة نسخة",lesson_create:"إضافة درس",lesson_update:"تعديل درس",lesson_delete:"حذف درس"};
  v.innerHTML=head("سجل العمليات","أحدث 200 عملية محفوظة في سجل التدقيق.")+'<section class="card"><div class="student-actions"><button class="btn secondary" id="audit-refresh">تحديث السجل</button><span class="muted small">'+rows.length+' عملية معروضة</span></div>'+
  (rows.length?'<div class="table-wrap"><table><thead><tr><th>الوقت</th><th>الحساب</th><th>العملية</th><th>تفاصيل</th></tr></thead><tbody>'+rows.map(r=>'<tr><td>'+esc(r.created_at||"")+'</td><td>'+esc(r.actor||"")+'</td><td>'+esc(labels[r.action]||r.action||"عملية")+'</td><td><details><summary>عرض التفاصيل</summary><pre class="audit-metadata">'+esc(JSON.stringify(r.metadata||{},null,2))+'</pre></details></td></tr>').join("")+'</tbody></table></div>':'<div class="empty">لا توجد عمليات مسجلة بعد.</div>')+
 '<p class="muted small">سجل التدقيق يساعد على التتبع ولا يغني عن النسخ الاحتياطي. لا تعرض هذه الصفحة كلمات المرور أو رموز الجلسات.</p></section>';
  $("#audit-refresh")?.addEventListener("click",()=>auditPage(v));
 }catch(e){v.innerHTML=head("سجل العمليات","تعذّر تحميل سجل التدقيق.")+'<div class="notice error">'+esc(e.message)+'</div><button class="btn" id="audit-retry">إعادة المحاولة</button>';$("#audit-retry")?.addEventListener("click",()=>auditPage(v))}
}
async function backupPage(v){
 if(S.user.role!=="admin"){v.innerHTML=head("النسخ الاحتياطي","هذه الصفحة متاحة للمدير فقط.")+'<div class="notice error">لا تملك صلاحية تصدير بيانات الأكاديمية.</div>';return}
 v.innerHTML=head("النسخ الاحتياطي","حافظ على بيانات الأكاديمية قبل التعديلات المهمة.")+'<div class="loading">جار فحص بيانات الأكاديمية…</div>';
 let summary;
 try{summary=await api("/admin/backup/summary")}catch(e){v.innerHTML=head("النسخ الاحتياطي","تعذّر فحص بيانات الأكاديمية.")+'<div class="notice error">'+esc(e.message)+'</div><button class="btn" id="backup-retry">إعادة المحاولة</button>';$("#backup-retry")?.addEventListener("click",()=>backupPage(v));return}
 const counts=summary.counts||{};
 v.innerHTML=head("النسخ الاحتياطي","نسختان مختلفتان: نسخة تشغيلية خفيفة، ونسخة كاملة قابلة للدمج والاستعادة.")+
 '<section class="card"><h3>ملخص البيانات الحالية</h3><div class="stats">'+
 '<div class="stat"><small>الحسابات النشطة</small><strong>'+Number(counts.users||0)+'</strong></div>'+
 '<div class="stat"><small>الأفواج النشطة</small><strong>'+Number(counts.groups||0)+'</strong></div>'+
 '<div class="stat"><small>الطلاب النشطون</small><strong>'+Number(counts.students||0)+'</strong></div>'+
 '<div class="stat"><small>السجلات التعليمية</small><strong>'+Number(counts.records||0)+'</strong></div>'+
 '<div class="stat"><small>سجل العمليات</small><strong>'+Number(counts.audit_entries||0)+'</strong></div></div>'+
 '<p class="muted small">آخر فحص: '+esc(summary.created_at||"")+'</p></section>'+
 '<section class="card stack"><h3>١. تصدير نسخة تشغيلية</h3><p>تتضمن بيانات الحسابات دون بصمات كلمات المرور، والأفواج، والطلاب، والسجلات التطبيقية، والمدارس القرآنية، وآخر 5000 عملية.</p>'+
 '<button class="btn secondary" id="backup-export">تنزيل النسخة التشغيلية JSON</button></section>'+
 '<section class="card stack"><h3>٢. النسخة الكاملة للاستعادة</h3><p>تتضمن كل المستخدمين مع بصمات كلمات المرور، وكل الأفواج والطلاب والسجلات والمدارس وسجل التدقيق، واقتصاد النقاط (القواعد والحركات والمتجر والصرف)، ومسار القرآن (الخطط واليومي والرفيق والمحطات والاستدراك). لا تتضمن رموز الجلسات ومحاولات الدخول.</p>'+
 '<div class="notice error">ملف النسخة الكاملة سرّي جدًا: يحوي بصمات كلمات المرور وبيانات الطلاب. لا ترسله لأحد، ولا ترفعه إلى GitHub أو أي موقع عام.</div>'+
 '<button class="btn" id="backup-full-export">تنزيل النسخة الكاملة القابلة للاستعادة</button>'+
 '<p class="muted small">الاستعادة أدناه تدمج البيانات وتحدّث السجلات ذات المعرّفات المطابقة؛ لا تحذف سجلات موجودة خارج الملف. جرّبها أولًا في بيئة منفصلة قبل الاعتماد عليها للطوارئ.</p></section>'+
 '<section class="card stack"><h3>٣. دمج نسخة كاملة محفوظة</h3>'+
 '<label class="field">ملف النسخة الكاملة v3 أو v2<input id="restore-file" type="file" accept=".json,application/json"></label>'+
 '<div id="restore-preview" class="notice hidden">اختر ملفًا لمعاينة محتوياته.</div>'+
 '<label class="field">اكتب «استعادة» للتأكيد<input id="restore-confirm" autocomplete="off" maxlength="20" placeholder="استعادة"></label>'+
 '<label class="remember-option"><input id="restore-approve" type="checkbox"> أفهم أن الاستعادة تحدّث السجلات المطابقة، ولا تحذف سجلات أخرى.</label>'+
 '<button class="btn" id="restore-submit" disabled>دمج النسخة في قاعدة البيانات</button>'+
 '<p class="muted small">الحد الأقصى للملف 16 ميغابايت. إذا توقفت الاستعادة بعد جزء من الدفعات، أعد المحاولة بالملف نفسه؛ الدمج بمعرّفات ثابتة قابل لإعادة المحاولة.</p></section>';
 const download=(data,name)=>{const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json;charset=utf-8"});const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)};
 $("#backup-export")?.addEventListener("click",async e=>{const b=e.currentTarget;b.disabled=true;b.textContent="جار تجهيز النسخة…";try{const data=await api("/admin/backup/export");download(data,"ihsan-academy-operational-backup-"+localDateISO()+".json");toast("تم تنزيل النسخة التشغيلية؛ احفظها في مكان آمن.")}catch(err){toast(err.message||"تعذّر إنشاء النسخة",true)}finally{if(b.isConnected){b.disabled=false;b.textContent="تنزيل النسخة التشغيلية JSON"}}});
 $("#backup-full-export")?.addEventListener("click",async e=>{const b=e.currentTarget;if(!confirm("النسخة الكاملة تتضمن بصمات كلمات المرور وبيانات الطلاب. هل تريد تنزيلها إلى هذا الجهاز؟"))return;b.disabled=true;b.textContent="جار تجهيز النسخة الكاملة…";try{const data=await api("/admin/backup/full-export");download(data,"ihsan-academy-full-backup-"+localDateISO()+".json");toast("تم تنزيل النسخة الكاملة. احفظها بعيدًا عن المشاركة العامة.")}catch(err){toast(err.message||"تعذّر إنشاء النسخة",true)}finally{if(b.isConnected){b.disabled=false;b.textContent="تنزيل النسخة الكاملة القابلة للاستعادة"}}});
 let restoreBackup=null;
 $("#restore-file")?.addEventListener("change",async e=>{const file=e.currentTarget.files?.[0],info=$("#restore-preview"),submit=$("#restore-submit");restoreBackup=null;submit.disabled=true;info.classList.remove("hidden","error");if(!file){info.textContent="اختر ملفًا لمعاينة محتوياته.";return}if(file.size>16*1024*1024){info.textContent="حجم الملف أكبر من 16 ميغابايت.";info.classList.add("error");return}try{const data=JSON.parse(await file.text());if(!["ihsan-academy-full-backup-v2","ihsan-academy-full-backup-v3"].includes(data.format)||!data.data){throw Error("هذه ليست نسخة كاملة v3 أو v2؛ لن يتم إرسال الملف.")}restoreBackup=data;const d=data.data;const n=k=>Array.isArray(d[k])?d[k].length:0;info.textContent="النسخة صالحة مبدئيًا — الحسابات: "+(d.users?.length||0)+"، الأفواج: "+(d.groups?.length||0)+"، الطلاب: "+(d.students?.length||0)+"، السجلات: "+(d.academy_records?.length||0)+"، المدارس: "+(d.quran_schools?.length||0)+"، التدقيق: "+(d.audit_log?.length||0)+"، حركات النقاط: "+n("point_events")+"، سجل القرآن: "+n("quran_daily")+"، المحطات: "+n("quran_stations")+"، الاستدراكات: "+n("quran_makeups")+". فحص العلاقات يتم على الخادم قبل الحفظ.";submit.disabled=false}catch(err){info.textContent=err.message||"تعذر قراءة ملف النسخة.";info.classList.add("error")}});
 $("#restore-submit")?.addEventListener("click",async e=>{e.preventDefault();const b=e.currentTarget;if(!restoreBackup)return toast("اختر نسخة كاملة صالحة أولًا.",true);if($("#restore-confirm")?.value.trim()!=="استعادة")return toast("اكتب كلمة «استعادة» لتأكيد العملية.",true);if(!$("#restore-approve")?.checked)return toast("ضع علامة الموافقة قبل الدمج.",true);if(!confirm("سيُدمج الملف في قاعدة البيانات. السجلات ذات المعرّفات المطابقة ستُحدّث من النسخة، ولن تُحذف بقية السجلات. المتابعة؟"))return;b.disabled=true;b.textContent="جار التحقق والدمج…";try{const result=await api("/admin/backup/restore",{method:"POST",body:JSON.stringify({...restoreBackup,confirm_restore:"RESTORE-IHSAN-ACADEMY"})});toast("تم الدمج: "+(result.restored?.students||0)+" سجل طالب و"+(result.restored?.records||0)+" سجلًا تطبيقيًا.");await backupPage(v)}catch(err){toast(err.message||"تعذّرت الاستعادة",true);b.disabled=false;b.textContent="دمج النسخة في قاعدة البيانات"}});
}
function questionEditor(n){return '<div class="question-builder" data-question><h4>السؤال '+n+'</h4><label class="field">نص السؤال<textarea data-q-prompt required maxlength="500" placeholder="اكتب السؤال هنا"></textarea></label><div class="form-grid">'+[0,1,2,3].map(i=>'<label class="field">الخيار '+(i+1)+'<input data-q-choice="'+i+'" required maxlength="250" placeholder="نص الخيار"></label>').join("")+'</div><label class="field">الإجابة الصحيحة<select data-q-correct><option value="0">الخيار الأول</option><option value="1">الخيار الثاني</option><option value="2">الخيار الثالث</option><option value="3">الخيار الرابع</option></select></label><label class="field">شرح الإجابة (اختياري — يظهر للطالب بعد التسليم)<textarea data-q-explanation maxlength="500" placeholder="لماذا هذه الإجابة صحيحة؟ مثال أو دليل"></textarea></label></div>'}
async function hierarchyPage(v){
 const isAdmin=S.user.role==="admin";
 if(!isAdmin){v.innerHTML=head("التسلسل الإداري","هذه الصفحة مخصصة للمدير العام.");return}
 v.innerHTML=head("التسلسل الإداري"," حقيقية من بيانات النظام (مستخدمون، أفواج، مشرفو فرق). لا أدوار فارغة.")+'<div class="loading">جار تحميل الهيكل…</div>';
 let staff=[],teachers=[],groups=[],chiefs=[];
 try{[staff,teachers,groups,chiefs]=await Promise.all([api("/admin/staff"),api("/teachers"),api("/groups"),api("/admin/chief-supervisors")])}catch(e){v.innerHTML=head("التسلسل الإداري","")+'<div class="notice error">'+esc(e.message)+'</div>';return}
 const byId=new Map(groups.map(g=>[g.id,g]));
 const directors=staff.filter(s=>s.role==="director");
 const supervisors=staff.filter(s=>s.role==="supervisor");
 const activeChiefs=chiefs.filter(c=>c.active);
 const groupsWithoutTeacher=groups.filter(g=>!g.teacher_id||!teachers.some(t=>t.id===g.teacher_id));
 const groupRows=groups.map(g=>{
  const teacher=teachers.find(t=>t.id===g.teacher_id);
  return '<div class="list-row"><div style="flex:1;min-width:180px"><strong>'+esc(g.name)+'</strong><small>'+(teacher?esc(honorificDisplayName(teacher.name,"teacher")):"لا معلم معين")+'</small></div><span class="pill '+(teacher?"is-good":"is-warn")+'">'+(teacher?"مشغول":"شاغر")+'</span></div>';
 }).join("");
 const directorRows=directors.length?directors.map(d=>'<div class="list-row"><div style="flex:1;min-width:180px"><strong>'+esc(honorificDisplayName(d.name,"director"))+'</strong><small>مدارس: '+(d.school_ids||[]).join(", ")+' · أفواج: '+(d.group_ids||[]).length+'</small></div><span class="pill is-good">مشغول</span></div>').join(""):'<div class="empty">لا يوجد مدير مدرسة معين.</div>';
 const supervisorRows=supervisors.length?supervisors.map(s=>'<div class="list-row"><div style="flex:1;min-width:180px"><strong>'+esc(honorificDisplayName(s.name,"supervisor"))+'</strong><small>أفواج: '+(s.group_ids||[]).length+'</small></div><span class="pill is-good">مشغول</span></div>').join(""):'<div class="empty">لا يوجد مشرف فريق (staff) معين.</div>';
 const chiefRows=activeChiefs.length?activeChiefs.map(c=>'<div class="list-row"><div style="flex:1;min-width:180px"><strong>'+esc(c.student_name||"طالب")+'</strong><small>'+esc(c.group_name||"بلا فوج")+' · يشرف على جميع مشرفي الفرق</small></div><span class="pill is-good">كبير مشرفين</span></div>').join(""):'<div class="empty">لم يُعيَّن كبير مشرفين عام.</div>';
 v.innerHTML=head("التسلسل الإداري"," حقيقية من بيانات النظام (مستخدمون، أفواج، مشرفو فرق). لا أدوار فارغة.")+
 '<section class="card"><h3>المدير العام</h3><div class="list"><div class="list-row"><div style="flex:1;min-width:180px"><strong>'+esc(honorificDisplayName(S.user.name,"admin"))+'</strong><small>صلاحيات: اعتماد، خصم، إدارة، تدقيق</small></div><span class="pill is-good">مشغول</span></div></div></section>'+
 '<section class="card"><h3>مديرو المدارس ('+directors.length+')</h3><div class="list">'+directorRows+'</div></section>'+
 '<section class="card"><h3>المعلمون ('+teachers.length+')</h3><div class="list">'+groupRows+'</div><p class="muted small">الأفواج بدون معلم معين: '+groupsWithoutTeacher.length+'</p></section>'+
 '<section class="card"><h3>مشرفو الفرق (staff) ('+supervisors.length+')</h3><div class="list">'+supervisorRows+'</div></section>'+
 '<section class="card"><h3>كبير مشرفين الفرق ('+activeChiefs.length+')</h3><div class="list">'+chiefRows+'</div></section>'+
 '<section class="card"><h3>صلاحيات (مرجع)</h3><div class="list">'+
 '<div class="list-row"><div style="flex:1;min-width:180px"><strong>المدير العام</strong><small>اعتماد/رفض/خصم/إدارة/تدقيق/نسخ احتياطي</small></div></div>'+
 '<div class="list-row"><div style="flex:1;min-width:180px"><strong>مدير المدرسة</strong><small>فوجه/معلموه/طلابه/تقاريره</small></div></div>'+
 '<div class="list-row"><div style="flex:1;min-width:180px"><strong>المعلم</strong><small>فوجه/طلبته/خططه/حضوره</small></div></div>'+
 '<div class="list-row"><div style="flex:1;min-width:180px"><strong>مشرف الفرقة (staff)</strong><small>متابعة طلاب فوجه</small></div></div>'+
 '<div class="list-row"><div style="flex:1;min-width:180px"><strong>كبير مشرفين (طالب)</strong><small>اعتماد طلبات النقل/الانضمام في كل الأفواج</small></div></div>'+
 '<div class="list-row"><div style="flex:1;min-width:180px"><strong>مشرف الفرقة (طالب)</strong><small>إدارة أعضاء فرقته</small></div></div>'+
 '</div></section>';
}
async function roadmapPage(v){
 const isAdmin=S.user.role==="admin";
 if(!isAdmin){v.innerHTML=head("خريطة الإنجاز","هذه الصفحة مخصصة للمدير العام.");return}
 const stages=[
  {name:"السياق والأدوار والصلاحيات",status:"منجز ومختبر",detail:"RBAC، managedGroupIds، supervisor staff، global chief"},
  {name:"خطط الحفظ (مبتدئ/متوسط/عالٍ + تمهيدي)",status:"معتمدة",detail:"البيانات 15/30/45/60؛ برنامج الثمانية أشهر معتمد بخطط 4/8/12 ثُمنًا أسبوعيًا"},
  {name:"الورد «فمي بشوق» (7 أجزاء)",status:"مخطط",detail:"توضيح تلاوة من المصحف vs استماع vs حفظ vs تسميع"},
  {name:"الثبات 8 أشهر",status:"مخطط",detail:"تصنيفات Thabit + 2.5/5/7.5 مُعلَّمة كاقتراح"},
  {name:"QCM تفاعلي",status:"مخطط",detail:"شرح ← مثال ← سؤال ← تصحيح ← إعادة"},
  {name:"التأخر والجزاء",status:"مخطط",detail:"عرض الم behind، نصيحة، خصم من الرصيد المُنفق فقط، مراجعة Sheikh"},
  {name:"العالم/المهام/الإنجازات/المتجر/المسابقات",status:"منجز جزئيًا",detail:"المتجر صادق، المسابقات كاملة، العالم أساسي"},
  {name:"التسلسل الإداري (بيانات حقيقية)",status:"منجز ومختبر",detail:"hierarchyPage"},
  {name:"خريطة الإنجاز",status:"منجز ومختبر",detail:"هذه الصفحة"},
  {name:"مركز الفيديو",status:"مخطط",detail:"5 فئات، حلقات، مراجعة، بدون مستخدمين/نقاط جديدة"},
  {name:"اختبارات المتصفح (22 تدفقًا)",status:"مخطط",detail:"قاعدة اختبار فقط، لا إجراءات إنتاجية مدمّرة"},
 ];
 const badgeClass=s=>s==="منجز ومختبر"?"is-good":s==="منجز جزئيًا"?"is-warn":"";
 v.innerHTML=head("خريطة الإنجاز","مراحل من بيانات المشروع (مرجع).")+
 '<section class="card"><div class="list">'+stages.map(s=>'<div class="list-row"><div style="flex:1;min-width:180px"><strong>'+esc(s.name)+'</strong><small>'+esc(s.detail)+'</small></div><span class="pill '+badgeClass(s.status)+'">'+esc(s.status)+'</span></div>').join("")+'</div></section>';
}
// مراجعة الاختبار بعد التسليم: تُظهر اختيار الطالب والإجابة الصحيحة والشرح (إن وُجد).
function quizReviewMarkup(t){
 const answers=(t.my_attempt&&t.my_attempt.answers)||{};
 const rows=(t.questions||[]).map((q,qi)=>{
  const raw=answers[String(q.id)];
  const yourIndex=raw===undefined||raw===null?NaN:Number(raw);
  const correct=Number(q.correct_index);
  const ok=yourIndex===correct;
  const choices=(q.choices||[]).map((choice,ci)=>{
   const isCorrect=ci===correct,isYours=!Number.isNaN(yourIndex)&&ci===yourIndex;
   const cls="quiz-review-choice"+(isCorrect?" is-correct":"")+(isYours?(isCorrect?" is-yours":" is-wrong"):"");
   const mark=isCorrect?"✓":(isYours?"✗":"");
   return '<div class="'+cls+'"><span class="quiz-review-mark" aria-hidden="true">'+mark+'</span><span>'+esc(choice)+'</span>'+(isYours?'<small class="muted">اختيارك</small>':"")+'</div>';
  }).join("");
  return '<fieldset class="question-view quiz-review '+(ok?"is-correct":"is-wrong")+'"><legend>'+(qi+1)+'. '+esc(q.prompt)+'<span class="quiz-verdict">'+(ok?"إجابتك صحيحة":"إجابتك خاطئة")+'</span></legend>'+choices+(q.explanation?'<p class="quiz-explanation"><strong>شرح الإجابة:</strong> '+esc(q.explanation)+'</p>':'<p class="quiz-explanation muted small">لم يضف الشيخ شرحًا لهذا السؤال بعد.</p>')+'</fieldset>';
 }).join("");
 return '<div class="notice">نتيجتك: '+t.my_attempt.score+' / '+t.my_attempt.total+' · '+Math.round(100*t.my_attempt.score/Math.max(1,t.my_attempt.total))+'% · '+esc(t.my_attempt.submitted_at||"")+'</div><div class="quiz-review-list">'+rows+'</div>';
}
async function testsPage(v){
 const isStudent=S.user.role==="student";
 let tests=[];
 try{tests=await api("/tests")}catch(e){v.innerHTML=head("الاختبارات","تعذّر جلب الاختبارات.")+'<div class="notice error">'+esc(e.message)+'</div>';return}
 const activeTests=tests.filter(t=>t.status!=="archived"),archivedTests=tests.filter(t=>t.status==="archived");
 let html=head(isStudent?"اختباراتي":"إدارة الاختبارات","اختبارات اختيار من متعدد تُصحّح آليًا وتُحفظ نتائجها في ملف الطالب.");
 if(!isStudent){
  html+='<section class="card"><h3>إنشاء اختبار</h3><form id="test-create-form" class="stack"><label class="field">عنوان الاختبار<input name="title" required maxlength="160"></label><label class="field">وصف مختصر<textarea name="description" maxlength="2000"></textarea></label><label class="field">الفوج المستهدف<select name="group_id" '+(S.user.role==="admin"?"":"required")+'>'+(S.user.role==="admin"?'<option value="">اختبار عام لجميع الطلاب</option>':'<option value="">اختر فوجًا</option>')+groupOpts()+'</select></label><label class="field">آخر موعد للاختبار<input name="due_date" type="date"></label><label class="remember-option"><input name="recurring" type="checkbox" checked> كرّر الاختبار كل 14 يومًا، مع حفظ نتائج كل دورة</label><div id="questions-editor">'+questionEditor(1)+'</div><button type="button" class="btn secondary" id="add-question">إضافة سؤال آخر</button><button class="btn" type="submit">نشر الاختبار</button><p class="muted small">اختر الإجابة الصحيحة لكل سؤال. عند ترك الموعد فارغًا، يُضبط موعد المراجعة بعد 14 يومًا. يمكن إضافة حتى 30 سؤالًا.</p></form></section><div class="divider"></div>';
  html+='<h3>الاختبارات المنشورة</h3><div class="list">'+(activeTests.length?activeTests.map(t=>'<section class="card"><div class="list-row"><div><strong>'+esc(t.title)+'</strong><small>'+(t.group_id?esc((S.groups.find(g=>g.id===t.group_id)||{}).name||"فوج"):"اختبار عام")+' · '+(t.questions||[]).length+' سؤال'+(t.due_date?' · الموعد: '+esc(t.due_date):"")+(t.recurring?' · يتكرر كل '+Number(t.frequency_days||14)+' يومًا':' · اختبار منفرد')+'</small></div><div class="student-actions"><button class="btn secondary" data-test-results="'+esc(t.id)+'">النتائج</button><button class="btn secondary" data-test-archive="'+esc(t.id)+'">أرشفة</button></div></div><div data-results-host="'+esc(t.id)+'"></div></section>').join(""):'<div class="empty">لم تُنشأ اختبارات بعد.</div>')+'</div>'+(archivedTests.length?'<details class="card archived-tests"><summary>الاختبارات المؤرشفة ('+archivedTests.length+')</summary><div class="list">'+archivedTests.map(t=>'<section class="card"><div class="section-head"><div><strong>'+esc(t.title)+'</strong><small class="muted">أُرشف في: '+esc(t.archived_at||"غير محدد")+'</small></div><button class="btn secondary" type="button" data-test-results="'+esc(t.id)+'">النتائج المحفوظة</button></div><div data-results-host="'+esc(t.id)+'"></div></section>').join("")+'</div></details>':"");
 }else{
  html+='<div class="list">'+(tests.length?tests.map(t=>'<section class="card"><h3>'+esc(t.title)+'</h3><p class="muted small">'+esc(t.description||"")+(t.due_date?' · آخر موعد: '+esc(t.due_date):"")+'</p>'+(t.my_attempt?quizReviewMarkup(t):'<form class="quiz-form" data-submit-test="'+esc(t.id)+'">'+(t.questions||[]).map((q,qi)=>'<fieldset class="question-view"><legend>'+(qi+1)+'. '+esc(q.prompt)+'</legend>'+(q.choices||[]).map((choice,ci)=>'<label class="quiz-option"><input type="radio" name="q_'+esc(q.id)+'" value="'+ci+'" required> '+esc(choice)+'</label>').join("")+'</fieldset>').join("")+'<button class="btn" type="submit">إرسال الإجابات وتصحيحها</button></form>')+'</section>').join(""):'<div class="empty">لا توجد اختبارات منشورة لفوجك حاليًا.</div>')+'</div>';
 }
 let historyRows=[];
 if(isStudent&&S.user.student_id){try{historyRows=await api("/test-history?student_id="+encodeURIComponent(S.user.student_id))}catch{}}
 if(isStudent)html+='<section class="card"><h3>سجل نتائجك</h3><div class="result-list">'+(historyRows.length?historyRows.map(r=>'<div class="list-row"><div><strong>'+esc(r.title||"اختبار")+'</strong><small>'+esc(r.submitted_at||"")+'</small></div><strong>'+Number(r.score||0)+' / '+Number(r.total||0)+' · '+Math.round(Number(r.score||0)*100/Math.max(1,Number(r.total||0)))+'٪</strong></div>').join(""):'<p class="muted">ستظهر نتائجك السابقة هنا بعد إكمال الاختبارات.</p>')+'</div></section>';
 v.innerHTML=html;
 if(!isStudent){
  $("#add-question")?.addEventListener("click",()=>{const host=$("#questions-editor");if(host.querySelectorAll("[data-question]").length>=30)return toast("الحد الأقصى 30 سؤالًا",true);host.insertAdjacentHTML("beforeend",questionEditor(host.querySelectorAll("[data-question]").length+1))});
  $("#test-create-form")?.addEventListener("submit",async e=>{e.preventDefault();const form=e.currentTarget,f=new FormData(form);const questions=[...form.querySelectorAll("[data-question]")].map(q=>({prompt:q.querySelector("[data-q-prompt]").value.trim(),choices:[...q.querySelectorAll("[data-q-choice]")].map(x=>x.value.trim()),correct_index:Number(q.querySelector("[data-q-correct]").value),explanation:(q.querySelector("[data-q-explanation]")?.value||"").trim()}));if(questions.some(q=>!q.prompt||q.choices.some(c=>!c))){toast("أكمل نص كل سؤال وخياراته الأربعة",true);return}try{const result=await api("/tests",{method:"POST",body:JSON.stringify({title:f.get("title"),description:f.get("description"),group_id:f.get("group_id"),due_date:f.get("due_date"),recurring:form.elements.recurring.checked,questions})});toast("نُشر الاختبار وحُفظت إجاباته الصحيحة");await load();shell();await page()}catch(x){toast(x.message,true)}});
  v.querySelectorAll("[data-test-archive]").forEach(b=>b.onclick=async()=>{const selected=tests.find(t=>t.id===b.dataset.testArchive);const prompt=selected?.recurring?"أرشفة سلسلة هذا الاختبار المتكرر بالكامل؟ ستبقى نتائج الطلاب محفوظة ولن تُنشأ دورات جديدة.":"أرشفة هذا الاختبار؟ سيختفي عن الطلاب وتبقى النتائج وسياق الاختبار محفوظين.";if(!confirm(prompt))return;b.disabled=true;try{await api("/test-delete",{method:"POST",body:JSON.stringify({id:b.dataset.testArchive,action:"archive"})});toast("أُرشف الاختبار مع الحفاظ على نتائجه");await page()}catch(x){toast(x.message,true);b.disabled=false}});
  v.querySelectorAll("[data-test-results]").forEach(b=>b.onclick=async()=>{const host=v.querySelector('[data-results-host="'+b.dataset.testResults+'"]');try{const rows=await api("/test-results?id="+encodeURIComponent(b.dataset.testResults));host.innerHTML='<div class="result-list">'+(rows.length?rows.map(r=>'<div class="list-row"><span>'+esc((S.students.find(st=>st.id===r.student_id)||{}).name||"طالب")+'</span><strong>'+r.score+' / '+r.total+'</strong><small>'+esc(r.submitted_at||"")+'</small></div>').join(""):'<p class="muted">لم يقدّم أي طالب هذا الاختبار بعد.</p>')+'</div>'}catch(x){toast(x.message,true)}});
 }else{
  v.querySelectorAll("[data-submit-test]").forEach(form=>form.onsubmit=async e=>{e.preventDefault();const test=tests.find(t=>t.id===form.dataset.submitTest);if(!test)return;const answers=(test.questions||[]).map(q=>{const chosen=form.querySelector('input[name="q_'+q.id+'"]:checked');return {question_id:q.id,selected_index:chosen?Number(chosen.value):-1}});if(answers.some(a=>a.selected_index<0)){toast("أجب عن جميع الأسئلة أولًا",true);return}try{const result=await api("/test-submit?id="+encodeURIComponent(test.id),{method:"POST",body:JSON.stringify({answers})});toast("نتيجتك: "+result.score+" من "+result.total+" ("+result.percent+"%)");await page()}catch(x){toast(x.message,true)}});
 }
}
async function gradebookPage(v){
 const isStudent=S.user.role==="student";
 const allowedStaff=["admin","director","teacher","supervisor"].includes(S.user.role);
 const formatPercent=value=>value===null||value===undefined?"—":Number(value).toLocaleString("ar-DZ",{maximumFractionDigits:1})+"٪";
 const stat=(label,value,detail="")=>'<div class="stat"><small>'+esc(label)+'</small><strong>'+esc(value)+'</strong>'+(detail?'<small>'+esc(detail)+'</small>':"")+'</div>';
 if(isStudent){
  let data;
  try{data=await api("/gradebook")}catch(e){v.innerHTML=head("تقدمي ودرجاتي","ملخص ما سُجّل لك في الأكاديمية.")+'<div class="notice error">'+esc(e.message)+'</div>';return}
  const s=(data.students||[])[0];
  if(!s){v.innerHTML=head("تقدمي ودرجاتي","ملخص ما سُجّل لك في الأكاديمية.")+'<div class="empty">لم يُربط حسابك بعد بملف طالب نشط.</div>';return}
  v.innerHTML=head("تقدمي ودرجاتي","هذه لوحة لمساعدتك على معرفة ما أُنجز وما يحتاج إلى متابعة، وليست حكمًا على قيمتك أو اجتهادك.")+
   '<div class="stats">'+stat("الحضور",formatPercent(s.attendance.rate),s.attendance.sessions+" سجلات")+
   stat("متوسط تقدير القرآن",s.quran.average_grade===null?"—":s.quran.average_grade+"/10",s.quran.sessions+" متابعات")+
   stat("نتائج الاختبارات",formatPercent(s.tests.percent),s.tests.attempts+" محاولات · "+s.tests.correct+"/"+s.tests.total+" إجابة صحيحة")+
   stat("واجبات راجعها المعلم",s.assignments.reviewed+" / "+s.assignments.available,s.assignments.pending+" بانتظار المراجعة")+'</div>'+
   '<section class="card"><h3>الحضور</h3><p>حاضر: <strong>'+s.attendance.present+'</strong> · غائب: '+s.attendance.absent+' · متأخر: '+s.attendance.late+' · بعذر: '+s.attendance.excused+'</p><p class="muted small">لا يحتسب السجل ما لم يُسجّل المعلم أو الإدارة حالة الحضور.</p></section>'+
   '<section class="card"><h3>القرآن الكريم</h3><p>متابعات: '+s.quran.sessions+' · الحفظ الجديد: '+s.quran.memorization+' · المراجعة: '+s.quran.revision+'</p><button class="btn secondary" data-gradebook-go="quran">عرض سجل القرآن</button></section>'+
   '<section class="card"><h3>الاختبارات والواجبات</h3><p>في الاختبارات: '+s.tests.attempts+' محاولة. في الواجبات: '+s.assignments.submitted+' تسليمًا، منها '+s.assignments.reviewed+' تمت مراجعته.</p><div class="student-actions"><button class="btn" data-gradebook-go="tests">الاختبارات</button><button class="btn secondary" data-gradebook-go="assignments">واجباتي</button></div></section>'+
   '<p class="muted small">آخر تحديث: '+esc(data.updated_at||"")+'. قد تختلف النتائج باختلاف السجلات التي أدخلها المعلم.</p>';
  v.querySelectorAll("[data-gradebook-go]").forEach(b=>b.addEventListener("click",()=>go(b.dataset.gradebookGo)));
  return;
 }
 if(!allowedStaff){v.innerHTML=head("السجل التعليمي والترتيب","لا يملك هذا الحساب صلاحية عرض السجل التعليمي.")+'<div class="notice">يرجى الدخول بحساب الإدارة أو المعلم.</div>';return}
 const savedGroup=safeStore.get("ihsan_gradebook_group");
 const defaultGroup=S.groups.some(g=>g.id===savedGroup)?savedGroup:(S.groups.length===1?S.groups[0].id:"");
 let html=head("السجل التعليمي والترتيب","اجمع صورة الطالب في الحضور والقرآن والاختبارات والواجبات دون خلطها في درجة واحدة.")+
  '<section class="card"><form id="gradebook-filter" class="form-grid"><label class="field wide">الفوج<select name="group_id" required><option value="">اختر الفوج</option>'+S.groups.map(g=>'<option value="'+esc(g.id)+'" '+(g.id===defaultGroup?"selected":"")+'>'+esc(g.name)+'</option>').join("")+'</select></label><div class="wide"><button class="btn" type="submit">عرض السجل</button></div></form></section><div id="gradebook-results"></div>';
 v.innerHTML=html;
 const filter=$("#gradebook-filter"),host=$("#gradebook-results");
 const renderRows=data=>{
  const rows=data.students||[];
  if(!rows.length){host.innerHTML='<div class="empty">لا يوجد طلاب نشطون في هذا الفوج.</div>';return}
  const csvRows=[["الطالب","الحضور %","الحاضر","الغائب","المتأخر","بعذر","متابعات القرآن","متوسط القرآن /10","محاولات الاختبار","نتيجة الاختبار %","الواجبات المسلّمة","تمت مراجعتها","بانتظار المراجعة","متوسط الواجبات %"],...rows.map(s=>[s.name,s.attendance.rate??"",s.attendance.present,s.attendance.absent,s.attendance.late,s.attendance.excused,s.quran.sessions,s.quran.average_grade??"",s.tests.attempts,s.tests.percent??"",s.assignments.submitted,s.assignments.reviewed,s.assignments.pending,s.assignments.average_percent??""])];
  const csv="\uFEFF"+csvRows.map(row=>row.map(value=>'"'+String(value??"").replace(/"/g,'""')+'"').join(",")).join("\r\n");
  host.innerHTML='<section class="card"><div class="section-head"><div><h3>السجل التعليمي والترتيب</h3><p class="muted small">'+rows.length+' طالبًا · آخر تحديث '+esc(data.updated_at||"")+'</p></div><div class="report-actions"><button class="btn secondary" id="gradebook-csv" type="button">مشاركة</button><button class="btn secondary" id="gradebook-pdf" type="button">تحميل PDF</button></div></div><div class="stats">'+stat("متابعات القرآن",rows.reduce((n,s)=>n+s.quran.sessions,0))+stat("محاولات الاختبار",rows.reduce((n,s)=>n+s.tests.attempts,0))+stat("واجبات بانتظار المراجعة",rows.reduce((n,s)=>n+s.assignments.pending,0))+stat("سجلات الحضور",rows.reduce((n,s)=>n+s.attendance.sessions,0))+'</div><div class="table-wrap"><table><thead><tr><th>الطالب</th><th>الحضور</th><th>القرآن</th><th>الاختبارات</th><th>الواجبات</th><th>تفاصيل</th></tr></thead><tbody>'+rows.map(s=>'<tr><td><strong>'+esc(studentDisplayName(s.name))+'</strong></td><td>'+formatPercent(s.attendance.rate)+'<small>'+s.attendance.present+' حاضر · '+s.attendance.absent+' غائب</small></td><td>'+s.quran.sessions+' متابعة<small>متوسط '+(s.quran.average_grade===null?"—":esc(s.quran.average_grade)+"/10")+'</small></td><td>'+formatPercent(s.tests.percent)+'<small>'+s.tests.correct+'/'+s.tests.total+' إجابة · '+s.tests.attempts+' محاولات</small></td><td>'+s.assignments.reviewed+'/'+s.assignments.available+' مراجعة<small>'+s.assignments.pending+' بانتظار المعلم</small></td><td><button class="btn secondary" type="button" data-gradebook-student="'+esc(s.student_id)+'">ملف الطالب</button></td></tr>').join("")+'</tbody></table></div></section>';
  const reportTitle="السجل التعليمي والترتيب — "+((S.groups.find(g=>g.id===filter.elements.group_id.value)||{}).name||"الفوج");
  $("#gradebook-csv")?.addEventListener("click",async()=>{const file=new File([csv],"ihsan-gradebook.csv",{type:"text/csv;charset=utf-8"});try{if(navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({title:reportTitle,text:"السجل التعليمي للفوج المحدد.",files:[file]});return}if(navigator.share){await navigator.share({title:reportTitle,text:rows.map(st=>st.name+" — حضور "+formatPercent(st.attendance.rate)+"، قرآن "+st.quran.sessions+" متابعة، اختبارات "+formatPercent(st.tests.percent)+"، واجبات "+st.assignments.reviewed+"/"+st.assignments.available).join("\\n")});return}}catch(e){if(e.name==="AbortError")return;toast("تعذّرت المشاركة؛ سيُنزّل ملف CSV بدلًا منها.",true)}const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));const link=document.createElement("a");link.href=url;link.download="ihsan-gradebook.csv";document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1500)});
  $("#gradebook-pdf")?.addEventListener("click",()=>{const table=host.querySelector(".table-wrap")?.innerHTML||"";printReportWindow(reportTitle,table,"آخر تحديث: "+(data.updated_at||"—"))});
  host.querySelectorAll("[data-gradebook-student]").forEach(button=>button.addEventListener("click",async()=>{
   const id=button.dataset.gradebookStudent;
   if(!S.students.some(student=>student.id===id)){toast("لا يظهر هذا الطالب ضمن الفوج الحالي.",true);return}
   try{history.pushState({ihsanMode:"school",ihsanTab:"students",ihsanSubView:"student-profile",studentId:id},"",location.pathname+"#student-"+encodeURIComponent(id))}catch{}
   S.tab="students";shell();await studentProfile($("#view"),id);
  }));
 };
 const loadGroup=async id=>{
  if(!id){host.innerHTML='<div class="empty">اختر الفوج أولًا لعرض السجل التعليمي.</div>';return}
  safeStore.set("ihsan_gradebook_group",id);host.innerHTML='<div class="loading">جار إعداد السجل التعليمي…</div>';
  try{renderRows(await api("/gradebook?group_id="+encodeURIComponent(id)))}catch(e){host.innerHTML='<div class="notice error">'+esc(e.message)+'</div>'}
 };
 filter.addEventListener("submit",async e=>{e.preventDefault();await loadGroup(String(new FormData(filter).get("group_id")||""))});
 if(defaultGroup)await loadGroup(defaultGroup);
 else host.innerHTML='<div class="empty">اختر الفوج ثم اضغط «عرض السجل».</div>';
}
async function messagesPage(v){
 let rows=[],recipients=[];
 const [messagesResult,recipientsResult]=await Promise.allSettled([api("/messages"),api("/messages/recipients")]);
 if(messagesResult.status==="fulfilled")rows=messagesResult.value;
 if(recipientsResult.status==="fulfilled")recipients=recipientsResult.value;
 const errors=[messagesResult,recipientsResult].filter(x=>x.status==="rejected").map(x=>x.reason?.message||"تعذّر التحميل");
 const me=S.user.id,people=new Map();
 recipients.forEach(r=>people.set(r.id,{id:r.id,name:r.name||"مستخدم",role:r.role||"",lastAt:"",lastText:"",unread:0}));
 rows.forEach(m=>{
  const otherId=m.sender_user_id===me?m.recipient_user_id:m.sender_user_id;
  const otherName=m.sender_user_id===me?m.recipient_name:m.sender_name;
  if(!otherId)return;
  const p=people.get(otherId)||{id:otherId,name:otherName||"حساب غير نشط",role:"",lastAt:"",lastText:"",unread:0};
  if(!p.lastAt||String(m.created_at||"")>p.lastAt){p.lastAt=String(m.created_at||"");p.lastText=String(m.content||m.title||"");}
  if(!m.outgoing&&!m.read_at)p.unread++;
  people.set(otherId,p);
 });
 const peopleRows=[...people.values()].sort((a,b)=>{
  if(a.lastAt&&b.lastAt)return b.lastAt.localeCompare(a.lastAt);
  if(a.lastAt)return -1;if(b.lastAt)return 1;return a.name.localeCompare(b.name,"ar");
 });
 let selectedId=safeStore.getSession("ihsan_message_contact");
 if(!people.has(selectedId))selectedId=peopleRows[0]?.id||"";
 const selected=people.get(selectedId);
 const thread=rows.filter(m=>(m.sender_user_id===me&&m.recipient_user_id===selectedId)||(m.sender_user_id===selectedId&&m.recipient_user_id===me)).sort((a,b)=>String(a.created_at||"").localeCompare(String(b.created_at||"")));
 let html=head("الرسائل","محادثات خاصة منظمة، وبحث سريع، وحالة قراءة واضحة.");
 if(errors.length)html+='<div class="notice error">'+esc(errors.join(" · "))+'</div>';
 html+='<section class="wa-messenger" dir="rtl"><aside class="wa-contact-panel"><div class="wa-panel-head"><div><span class="eyebrow">تواصل المدرسة</span><h3>المحادثات</h3></div><span class="wa-total-badge">'+rows.filter(m=>!m.outgoing&&!m.read_at).length+'</span></div><label class="wa-search"><span aria-hidden="true">⌕</span><input id="wa-contact-search" type="search" placeholder="ابحث عن شخص أو محادثة" aria-label="البحث في المحادثات"></label><div class="wa-contact-list">'+(peopleRows.length?peopleRows.map(p=>'<button type="button" class="wa-contact '+(p.id===selectedId?"active":"")+'" data-wa-contact="'+esc(p.id)+'" data-name="'+esc(p.name.toLocaleLowerCase("ar"))+'"><span class="wa-avatar">'+esc((p.name||"؟").trim().slice(0,1))+'</span><span class="wa-contact-copy"><strong>'+esc(honorificDisplayName(p.name,p.role))+'</strong><small>'+esc(p.lastText||ROLE_LABELS[p.role]||"ابدأ محادثة جديدة")+'</small></span><span class="wa-contact-meta">'+(p.lastAt?'<small>'+esc(p.lastAt.slice(0,10))+'</small>':"")+(p.unread?'<span class="wa-unread">'+p.unread+'</span>':"")+'</span></button>').join(""):'<div class="empty">لا يوجد مستلم متاح. تحقق من الفوج وصلاحيات المراسلة.</div>')+'</div></aside><section class="wa-chat-panel"><header class="wa-chat-head">'+(selected?'<span class="wa-avatar large">'+esc((selected.name||"؟").trim().slice(0,1))+'</span><div class="wa-chat-identity"><h3>'+esc(honorificDisplayName(selected.name,selected.role))+'</h3><p>'+esc(ROLE_LABELS[selected.role]||"مراسلة خاصة داخل الأكاديمية")+'</p></div>':'<div><h3>اختر محادثة</h3><p class="muted">اختر اسمًا من القائمة لبدء المراسلة.</p></div>')+'<button type="button" class="btn secondary" id="wa-refresh">تحديث</button></header><div class="wa-thread" id="wa-thread">'+(selected?(thread.length?thread.map(m=>'<article class="wa-bubble-row '+(m.outgoing?"outgoing":"incoming")+'"><div class="wa-bubble"><p>'+esc(m.content||"")+'</p><div class="wa-bubble-meta"><small>'+esc(m.created_at?new Date(m.created_at).toLocaleString("ar-DZ",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}):"")+'</small>'+(m.outgoing?'<span class="wa-delivery" aria-label="حالة الرسالة">'+(m.read_at?"✓✓ شاهدها":"✓ أُرسلت")+'</span>':!m.read_at?'<button type="button" class="wa-mark-read" data-message-read="'+esc(m.id)+'">تحديد كمقروءة</button>':"")+'</div></div></article>').join(""):'<div class="wa-empty"><span aria-hidden="true">✉</span><strong>ابدأ المحادثة</strong><p>اكتب رسالة واضحة ومحترمة، وستظهر هنا في سجل المحادثة.</p></div>'):'<div class="empty">اختر مستلمًا من القائمة.</div>')+'</div>'+(selected?'<form id="private-message-form" class="wa-compose"><input type="hidden" name="recipient_user_id" value="'+esc(selectedId)+'"><input type="hidden" name="title" value="محادثة خاصة"><textarea name="content" maxlength="8000" rows="2" required placeholder="اكتب رسالة…"></textarea><button class="btn" type="submit" aria-label="إرسال الرسالة">إرسال ↗</button><small>الرسائل خاصة بين طرفيها. لا ترسل كلمات المرور أو البيانات الحساسة.</small></form>':'')+'</section></section>';
 v.innerHTML=html;
 const threadHost=$("#wa-thread");if(threadHost)threadHost.scrollTop=threadHost.scrollHeight;
 $("#wa-contact-search")?.addEventListener("input",e=>{const q=String(e.currentTarget.value||"").toLocaleLowerCase("ar");v.querySelectorAll("[data-wa-contact]").forEach(b=>{b.hidden=!String(b.dataset.name||"").includes(q)&&!String(b.textContent||"").toLocaleLowerCase("ar").includes(q)})});
 v.querySelectorAll("[data-wa-contact]").forEach(button=>button.addEventListener("click",()=>{safeStore.setSession("ihsan_message_contact",button.dataset.waContact);page()}));
 $("#wa-refresh")?.addEventListener("click",()=>page());
 v.querySelectorAll("[data-message-read]").forEach(button=>button.addEventListener("click",async()=>{button.disabled=true;try{await api("/messages/read",{method:"POST",body:JSON.stringify({id:button.dataset.messageRead})});await page()}catch(err){toast(err.message,true);button.disabled=false}}));
 $("#private-message-form")?.addEventListener("submit",async e=>{e.preventDefault();const form=e.currentTarget,fd=new FormData(form),button=form.querySelector('button[type="submit"]'),content=String(fd.get("content")||"").trim();if(!content){toast("اكتب الرسالة أولًا",true);return}button.disabled=true;try{await api("/messages",{method:"POST",body:JSON.stringify({recipient_user_id:fd.get("recipient_user_id"),title:fd.get("title")||"محادثة خاصة",content})});await page();toast("تم إرسال الرسالة بنجاح")}catch(err){toast(err.message,true);button.disabled=false}});
}
async function assignmentsPage(v){
 const isStudent=S.user.role==="student";
 const staff=["admin","director","teacher","supervisor"].includes(S.user.role);
 let rows=[];
 try{rows=await api("/assignments")}catch(e){v.innerHTML=head("الواجبات","تعذّر تحميل الواجبات.")+'<div class="notice error">'+esc(e.message)+'</div>';return}
 let html=head(isStudent?"واجباتي":"الواجبات والتكليفات",isStudent?"أنجز المطلوب بهدوء، ثم أرسل إجابتك ليطلع عليها معلمك.":"أنشئ واجبًا لفوجك، وتابع التسليمات وراجع إجابات الطلاب.");
 if(staff)html+='<section class="card"><h3>إنشاء واجب جديد</h3><form id="assignment-create-form" class="stack"><label class="field">عنوان الواجب<input name="title" required maxlength="180" placeholder="مثال: مراجعة حفظ الأسبوع"></label><label class="field">التعليمات وما المطلوب من الطالب<textarea name="description" required maxlength="5000" rows="4" placeholder="اكتب المطلوب بوضوح، ومقدار العمل المتوقع."></textarea></label><label class="field">الفوج المستهدف<select name="group_id" '+(S.user.role==="admin"?"":"required")+'>'+(S.user.role==="admin"?'<option value="">واجب عام لكل الطلاب</option>':'<option value="">اختر فوجًا</option>')+groupOpts()+'</select></label><div class="form-grid"><label class="field">نوع المهمة<select name="task_type"><option value="assignment">واجب</option><option value="memorization">حفظ</option><option value="revision">مراجعة</option><option value="behavior">سلوك</option></select></label><label class="field">آخر موعد للتسليم<input name="due_date" type="date"></label><label class="field">الدرجة الكلية<input name="points_total" type="number" min="1" max="1000" value="100" required></label></div><button class="btn" type="submit">نشر الواجب</button><p class="muted small">لن يرى الطالب إلا الواجبات المنشورة له أو لفوجه، ولن يستطيع المعلم مراجعة واجبات فوج خارج نطاقه.</p></form></section><div class="divider"></div>';
 if(isStudent){
  html+='<div class="list">'+(rows.length?rows.map(a=>{
   const sub=a.my_submission||null, graded=!!sub&&sub.status==="reviewed";
   const status=!sub?"لم يُسلّم بعد":graded?"تمت المراجعة":"تم التسليم — بانتظار المعلم";
   return '<article class="card assignment-card"><div class="section-head"><div><h3>'+esc(a.title)+'</h3><p class="muted small">'+(a.due_date?'آخر موعد: '+esc(a.due_date):"دون موعد محدد")+' · الدرجة الكلية: '+Number(a.points_total||100)+'</p></div><span class="pill">'+status+'</span></div><p class="content-body">'+esc(a.description)+'</p>'+(graded?'<div class="notice"><strong>تمت مراجعة إجابتك.</strong><p>الدرجة: <strong>'+esc(a.my_submission.grade??"—")+'</strong> / '+Number(a.points_total||100)+'</p>'+(a.my_submission.feedback?'<p>ملاحظة المعلم: '+esc(a.my_submission.feedback)+'</p>':"")+'</div><p class="muted small">حُفظت المراجعة. إن احتجت إلى تعديل الإجابة، تواصل مع معلمك ليعيد فتح الواجب.</p>':'<form class="stack assignment-submit-form" data-assignment-submit="'+esc(a.id)+'"><label class="field">إجابتك أو وصف ما أنجزته<textarea name="response_text" required maxlength="8000" rows="4" placeholder="اكتب إجابتك هنا…">'+esc(sub?.response_text||"")+'</textarea></label><button class="btn" type="submit">'+(sub?"تحديث التسليم":"تسليم الواجب")+'</button></form>')+'<p class="muted small">'+(sub?.submitted_at?"آخر تسليم: "+esc(sub.submitted_at):"بعد التسليم يمكنك متابعة حالة المراجعة من هنا.")+'</p></article>';
  }).join(""):'<div class="empty">لا توجد واجبات مخصصة لك حاليًا. أحسنت في متابعة وردك حتى يصلك التكليف القادم.</div>')+'</div>';
 }else{
  html+='<div class="list">'+(rows.length?rows.map(a=>'<article class="card assignment-card"><div class="section-head"><div><h3>'+esc(a.title)+'</h3><p class="muted small">'+(a.group_id?esc((S.groups.find(g=>g.id===a.group_id)||{}).name||"فوج"):"واجب عام")+' · '+(a.due_date?'آخر موعد: '+esc(a.due_date):"دون موعد")+' · الدرجة الكلية: '+Number(a.points_total||100)+'</p></div><div class="student-actions"><button class="btn secondary" type="button" data-assignment-edit="'+esc(a.id)+'">تعديل</button><button class="btn secondary" type="button" data-assignment-review="'+esc(a.id)+'">التسليمات والمراجعة</button><button class="btn danger" type="button" data-assignment-delete="'+esc(a.id)+'">حذف</button></div></div><p class="content-body">'+esc(a.description)+'</p><div id="assignment-edit-'+esc(a.id)+'"></div><div id="assignment-submissions-'+esc(a.id)+'"></div></article>').join(""):'<div class="empty">لا توجد واجبات بعد. أنشئ أول تكليف واضح ومرتبط بهدف تعليمي.</div>')+'</div>';
 }
 v.innerHTML=html;
 $("#assignment-create-form")?.addEventListener("submit",async e=>{e.preventDefault();const form=e.currentTarget,fd=new FormData(form),button=form.querySelector('button[type="submit"]');button.disabled=true;try{await api("/assignments",{method:"POST",body:JSON.stringify({title:fd.get("title"),description:fd.get("description"),group_id:fd.get("group_id"),due_date:fd.get("due_date"),points_total:Number(fd.get("points_total")),task_type:fd.get("task_type")})});toast("نُشر الواجب بنجاح");await page()}catch(err){toast(err.message,true);button.disabled=false}});
 v.querySelectorAll("[data-assignment-submit]").forEach(form=>form.addEventListener("submit",async e=>{e.preventDefault();const target=e.currentTarget,button=target.querySelector('button[type="submit"]'),fd=new FormData(target);button.disabled=true;try{await api("/assignment-submit?id="+encodeURIComponent(target.dataset.assignmentSubmit),{method:"POST",body:JSON.stringify({response_text:fd.get("response_text")})});toast("تم تسليم الواجب وحفظ إجابتك");await page()}catch(err){toast(err.message,true);button.disabled=false}}));
 v.querySelectorAll("[data-assignment-edit]").forEach(button=>button.addEventListener("click",()=>{
  const id=button.dataset.assignmentEdit,a=rows.find(item=>item.id===id),host=$("#assignment-edit-"+CSS.escape(id));if(!a||!host)return;
  if(host.dataset.open==="1"){host.innerHTML="";host.dataset.open="";button.textContent="تعديل";return}
  host.innerHTML='<form class="stack assignment-edit-form" data-assignment-edit-form="'+esc(id)+'"><label class="field">عنوان الواجب<input name="title" required maxlength="180" value="'+esc(a.title)+'"></label><label class="field">التعليمات<textarea name="description" required maxlength="5000" rows="3">'+esc(a.description)+'</textarea></label><div class="form-grid"><label class="field">آخر موعد للتسليم<input name="due_date" type="date" value="'+esc(a.due_date||"")+'"></label><label class="field">الدرجة الكلية<input name="points_total" type="number" min="1" max="1000" required value="'+Number(a.points_total||100)+'"></label></div><div class="student-actions"><button class="btn" type="submit">حفظ التعديلات</button><button class="btn secondary" type="button" data-cancel-assignment-edit>إلغاء</button></div><p class="muted small">إذا كانت هناك تسليمات محفوظة، لا يمكن تغيير الدرجة الكلية أو حذف الواجب حتى لا يختل سجل الطلاب.</p></form>';
  host.dataset.open="1";button.textContent="إخفاء التعديل";
  const form=host.querySelector("[data-assignment-edit-form]");
  form?.addEventListener("submit",async e=>{e.preventDefault();const fd=new FormData(form),save=form.querySelector('button[type="submit"]');save.disabled=true;try{await api("/assignments/"+encodeURIComponent(id),{method:"PATCH",body:JSON.stringify({title:fd.get("title"),description:fd.get("description"),due_date:fd.get("due_date"),points_total:Number(fd.get("points_total"))})});toast("حُفظت تعديلات الواجب");await page()}catch(err){toast(err.message,true);save.disabled=false}});
  host.querySelector("[data-cancel-assignment-edit]")?.addEventListener("click",()=>{host.innerHTML="";host.dataset.open="";button.textContent="تعديل"});
 }));
 v.querySelectorAll("[data-assignment-delete]").forEach(button=>button.addEventListener("click",async()=>{
  const id=button.dataset.assignmentDelete,a=rows.find(item=>item.id===id);if(!a)return;
  if(!confirm("حذف الواجب «"+a.title+"»؟ لا يسمح النظام بحذف واجب له تسليمات محفوظة."))return;
  button.disabled=true;try{await api("/assignments/"+encodeURIComponent(id),{method:"DELETE"});toast("حُذف الواجب");await page()}catch(err){toast(err.message,true);button.disabled=false}
 }));
 v.querySelectorAll("[data-assignment-review]").forEach(button=>button.addEventListener("click",async()=>{
  const assignmentId=button.dataset.assignmentReview,host=$("#assignment-submissions-"+CSS.escape(assignmentId));if(!host)return;
  if(host.dataset.loaded==="1"){host.innerHTML="";host.dataset.loaded="";button.textContent="التسليمات والمراجعة";return}
  button.disabled=true;button.textContent="جار جلب التسليمات…";
  try{
   const submissions=await api("/assignment-submissions?id="+encodeURIComponent(assignmentId));
   host.innerHTML='<div class="divider"></div><h4>تسليمات الطلاب ('+submissions.length+')</h4>'+(submissions.length?'<div class="list">'+submissions.map(s=>'<section class="card submission-card"><div class="section-head"><div><strong>'+esc(s.student_name)+'</strong><p class="muted small">'+esc(s.submitted_at||"")+' · '+(s.status==="reviewed"?"تمت المراجعة":"بانتظار المراجعة")+'</p></div>'+(s.grade!==null&&s.grade!==undefined?'<span class="pill">الدرجة '+esc(s.grade)+'</span>':"")+'</div><p class="content-body">'+esc(s.response_text)+'</p><form class="stack assignment-review-form" data-assignment-id="'+esc(assignmentId)+'" data-student-id="'+esc(s.student_id)+'"><div class="form-grid"><label class="field">الدرجة<input name="grade" type="number" min="0" max="1000" step="0.5" value="'+(s.grade===null||s.grade===undefined?"":esc(s.grade))+'" placeholder="لم تُحدد"></label><label class="field">ملاحظة المعلم<textarea name="feedback" maxlength="2000" rows="2" placeholder="ما أتقنه الطالب وما يحتاج إلى تحسين…">'+esc(s.feedback||"")+'</textarea></label></div><button class="btn" type="submit">حفظ المراجعة</button></form>'+(s.status==="reviewed"?'<button class="btn secondary" type="button" data-assignment-reopen="'+esc(assignmentId)+'" data-student-id="'+esc(s.student_id)+'">إعادة فتح للتعديل</button>':"")+'</section>').join("")+'</div>':'<div class="empty">لم يسلّم أي طالب هذا الواجب حتى الآن.</div>');
   host.dataset.loaded="1";button.textContent="إخفاء التسليمات";
   host.querySelectorAll("[data-assignment-id]").forEach(form=>form.addEventListener("submit",async e=>{e.preventDefault();const current=e.currentTarget,fd=new FormData(current),save=current.querySelector('button[type="submit"]');save.disabled=true;try{await api("/assignment-review",{method:"POST",body:JSON.stringify({assignment_id:current.dataset.assignmentId,student_id:current.dataset.studentId,grade:fd.get("grade"),feedback:fd.get("feedback")})});toast("حُفظت مراجعة الطالب");current.querySelector("button[type='submit']").textContent="تم الحفظ";}catch(err){toast(err.message,true);save.disabled=false}}));
   host.querySelectorAll("[data-assignment-reopen]").forEach(reopen=>reopen.addEventListener("click",async()=>{
    const studentId=reopen.dataset.studentId;
    if(!confirm("إعادة فتح هذا التسليم للطالب؟ ستبقى المراجعة السابقة محفوظة في سجل المراجعات."))return;
    reopen.disabled=true;
    try{
      await api("/assignment-review",{method:"POST",body:JSON.stringify({assignment_id:reopen.dataset.assignmentReopen,student_id:studentId,reopen:true})});
      toast("أُعيد فتح التسليم؛ يمكن للطالب تعديله ثم إرساله من جديد.");
      await page();
    }catch(err){toast(err.message,true);reopen.disabled=false}
   }));
  }catch(err){host.innerHTML='<div class="notice error">'+esc(err.message)+'</div>';button.textContent="إعادة تحميل التسليمات"}
  button.disabled=false;
 }));
}
async function notificationsPage(v){
 let rows=[];try{rows=await api("/notifications")}catch(e){v.innerHTML=head("التنبيهات","تعذّر تحميل التنبيهات.")+'<div class="notice error">'+esc(e.message)+'</div>';return}
 const staff=["admin","director","teacher","supervisor"].includes(S.user.role);
 let html=head("التنبيهات","إعلانات مهمة للفوج أو لجميع طلاب الأكاديمية.");
 if(staff)html+='<section class="card"><h3>إرسال تنبيه</h3><form id="notice-form" class="stack"><label class="field">العنوان<input name="title" required maxlength="160"></label><label class="field">نص التنبيه<textarea name="content" required maxlength="2000" rows="3"></textarea></label><label class="field">الجمهور<select name="group_id" '+(S.user.role==="admin"?"":"required")+'>'+(S.user.role==="admin"?'<option value="">عام لجميع الطلاب</option>':'<option value="">اختر فوجًا</option>')+groupOpts()+'</select></label><button class="btn">نشر التنبيه</button></form></section><div class="divider"></div>';
 html+='<div class="list">'+(rows.length?rows.map(n=>'<article class="card"><h3>'+esc(n.title)+'</h3><p class="content-body">'+esc(n.content)+'</p><small class="muted">'+(n.group_id?esc((S.groups.find(g=>g.id===n.group_id)||{}).name||"فوج"):"تنبيه عام")+' · '+esc(n.created_at||"")+'</small></article>').join(""):'<div class="empty">لا توجد تنبيهات حاليًا.</div>')+'</div>';
 v.innerHTML=html;
 $("#notice-form")?.addEventListener("submit",async e=>{e.preventDefault();const f=new FormData(e.currentTarget);try{await api("/notifications",{method:"POST",body:JSON.stringify({title:f.get("title"),content:f.get("content"),group_id:f.get("group_id")})});toast("نُشر التنبيه");await page()}catch(x){toast(x.message,true)}});
}




/* Lightweight live sync: no page reloads, no form interruption. */
let ihsanLiveSyncTimer=null,ihsanLiveSyncBusy=false,ihsanLiveKnownNotices=null,ihsanLiveUserSignature="",ihsanLiveWalletValue=null;
function liveUserSignature(user){
 if(!user)return "";
 return JSON.stringify({id:user.id,role:user.role,group_id:user.group_id||null,school_id:user.school_id||null,must_change_password:Boolean(user.must_change_password),status:user.status||null});
}
async function syncLiveData(){
 if(document.hidden||!S.user||ihsanLiveSyncBusy||!navigator.onLine)return;
 ihsanLiveSyncBusy=true;
 try{
  const [freshUser,notices]=await Promise.all([api("/me"),api("/notifications")]);
  const signature=liveUserSignature(freshUser);
  if(!ihsanLiveUserSignature)ihsanLiveUserSignature=signature;
  else if(signature!==ihsanLiveUserSignature){
   const previous=S.user;S.user=freshUser;ihsanLiveUserSignature=signature;
   if(freshUser.must_change_password&&!previous?.must_change_password){renderTopActions();showPasswordChange(true)}
   else{toast("تم تحديث صلاحيات حسابك وبياناته تلقائيًا.");await start();return}
  }
  if(Array.isArray(notices)){
   const ids=notices.map(n=>String(n.id||n.created_at||n.title||"")).filter(Boolean);
   if(ihsanLiveKnownNotices===null)ihsanLiveKnownNotices=new Set(ids);
   else{
    const fresh=notices.filter(n=>{const id=String(n.id||n.created_at||n.title||"");return id&&!ihsanLiveKnownNotices.has(id)});
    ids.forEach(id=>ihsanLiveKnownNotices.add(id));
    if(ihsanLiveKnownNotices.size>150)ihsanLiveKnownNotices=new Set([...ihsanLiveKnownNotices].slice(-100));
    if(fresh.length){
     const latest=fresh[fresh.length-1],title=String(latest.title||"تنبيه جديد").slice(0,90);
     toast(fresh.length>1?"وصلت "+fresh.length+" تنبيهات جديدة؛ أحدثها: "+title:"تنبيه جديد: "+title);playUiSound("success");
     if(S.tab==="notifications")await page();
    }
   }
  }
  if(S.user.role==="student"&&S.mode==="school"){
   try{
    const wallet=await api("/points/summary"),value=Number(wallet.totals?.store||0);
    if(ihsanLiveWalletValue===null)ihsanLiveWalletValue=value;
    else if(value!==ihsanLiveWalletValue){
     const delta=value-ihsanLiveWalletValue;ihsanLiveWalletValue=value;
     toast(delta>0?"أُضيف إلى رصيدك "+delta+" نقطة.":"تحدّث رصيدك بمقدار "+Math.abs(delta)+" نقطة.");
     await refreshWallet();
     if(S.tab==="points")await page();
    }
   }catch{}
  }
 }catch{}
 finally{ihsanLiveSyncBusy=false}
}
function startLiveSync(){
 const currentSignature=liveUserSignature(S.user);
 if(ihsanLiveUserSignature&&currentSignature!==ihsanLiveUserSignature){ihsanLiveKnownNotices=null;ihsanLiveWalletValue=null;}
 ihsanLiveUserSignature=currentSignature;
 if(ihsanLiveSyncTimer)return;
 syncLiveData();
 ihsanLiveSyncTimer=window.setInterval(syncLiveData,18000);
}
window.addEventListener("online",()=>{if(S.user)syncLiveData()});
document.addEventListener("visibilitychange",()=>{if(!document.hidden&&S.user)syncLiveData()});

boot();
// Deploy trigger: keep the student entry/exit prayer dialogs in the latest Pages build.