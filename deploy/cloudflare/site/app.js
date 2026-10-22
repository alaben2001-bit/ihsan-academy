/* Arabic anti-self-XSS notice for the academy's own developer console. */
console.warn("تنبيه أمني من أكاديمية الإحسان:\nقد يتيح استخدام وحدة التحكم (Console) للمهاجمين انتحال هويتك وسرقة معلوماتك عبر هجوم يُعرف باسم Self-XSS.\nلا تُدخل أو تلصق أي شيفرة لا تفهمها، ولا تنفّذ تعليمات يرسلها إليك مجهول.");
let ihsanInstallPrompt=null;
let ihsanGoogleNonce="";
let ihsanGoogleScriptPromise=null;
function ihsanIsInstalled(){return Boolean(window.matchMedia&&window.matchMedia("(display-mode: standalone)").matches)||navigator.standalone===true}
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();ihsanInstallPrompt=e;document.documentElement.classList.add("ihsan-install-available")});
window.addEventListener("appinstalled",()=>{ihsanInstallPrompt=null;const b=document.getElementById("install-app");if(b){b.disabled=true;b.textContent="التطبيق مثبت"}toast("تم تثبيت أكاديمية الإحسان على جهازك.")});
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
    S.token="";clearSessionToken();S.user=data.user;safeStore.set("ihsan_last_identity",String(data.user?.email||""));if(S.user?.must_change_password){renderTopActions();showPasswordChange(true)}else{await start()}
   }catch(err){setNote(err.message||"تعذر الدخول باستخدام Google.",true);if(error){error.textContent=err.message||"تعذر الدخول باستخدام Google.";error.classList.remove("hidden")}if(submit)submit.disabled=false}
  }});
  host.innerHTML="";window.google.accounts.id.renderButton(host,{type:"standard",theme:"outline",size:"large",shape:"rectangular",text:"signin_with",locale:"ar",width:320});
  setNote("استخدم بريد Google نفسه المسجل لحسابك في الأكاديمية.");
 }catch{setNote("تعذر تحميل Google. يمكنك الدخول باسم المستخدم وكلمة المرور.",true)}
}
function showInstallGuide(){
 const old=$("#install-help-dialog");if(old)old.remove();const ua=navigator.userAgent||"";let intro="أضف الأكاديمية إلى الشاشة الرئيسية لتفتحها كأنها تطبيق مستقل.",steps=[];
 if(/iPhone|iPad|iPod/i.test(ua)||(/Macintosh/i.test(ua)&&navigator.maxTouchPoints>1)){intro="على أجهزة Apple يتم التثبيت من قائمة المشاركة في Safari.";steps=["افتح الأكاديمية في Safari.","اضغط زر المشاركة.","اختر «إضافة إلى الشاشة الرئيسية».","اضغط «إضافة» للتأكيد."]}
 else if(/Android/i.test(ua)){intro="يمكن تثبيت الأكاديمية مجانًا من قائمة المتصفح.";steps=["افتح الأكاديمية في Chrome.","اضغط القائمة ⋮ أعلى الشاشة.","اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».","اضغط «تثبيت» أو «إضافة» للتأكيد."]}
 else{steps=["افتح الموقع في Chrome أو Edge.","افتح قائمة المتصفح.","اختر «تثبيت التطبيق» أو «تثبيت هذا الموقع كتطبيق».","أكّد التثبيت عند ظهور النافذة."]}
 document.body.insertAdjacentHTML("beforeend",'<dialog id="install-help-dialog" class="install-guide-dialog" aria-labelledby="install-guide-title"><header class="install-guide-head"><span class="install-guide-mark" aria-hidden="true">↓</span><div><h2 id="install-guide-title">تثبيت أكاديمية الإحسان</h2><p>'+intro+'</p></div><button type="button" class="install-guide-x" id="install-guide-x" aria-label="إغلاق">×</button></header><div class="install-guide-content"><ol>'+steps.map(s=>"<li>"+s+"</li>").join("")+'</ol><p class="install-guide-note">التثبيت يضيف أيقونة للأكاديمية إلى جهازك ولا يحذف بيانات حسابك.</p></div><footer class="install-guide-footer"><button type="button" class="btn" id="install-guide-close">حسنًا</button></footer></dialog>');
 const d=$("#install-help-dialog"),close=()=>{if(!d)return;try{if(d.open)d.close()}catch{}d.remove()};$("#install-guide-close")?.addEventListener("click",close);$("#install-guide-x")?.addEventListener("click",close);d?.addEventListener("click",e=>{if(e.target===d)close()});if(typeof d?.showModal==="function")d.showModal();else d?.setAttribute("open","");
}
window.addEventListener("error",function(e){var a=document.getElementById("app");if(a&&a.querySelector(".loading")){a.innerHTML="<section class=\"panel\"><h2>خطأ في تشغيل الواجهة</h2><p class=\"muted\"></p></section>";a.querySelector("p").textContent=(e.message||"JavaScript error")+" — "+(e.filename||"")+(e.lineno?":"+e.lineno:"");}});window.addEventListener("unhandledrejection",function(e){var a=document.getElementById("app");if(a&&a.querySelector(".loading"))a.textContent="تعذّر بدء الأكاديمية: "+String(e.reason&&e.reason.message||e.reason||"خطأ غير معروف");});
const $=s=>document.querySelector(s), app=$("#app");
const safeStore={get(k){try{return localStorage.getItem(k)||""}catch{return ""}},set(k,v){try{localStorage.setItem(k,v)}catch{}},remove(k){try{localStorage.removeItem(k)}catch{}},getSession(k){try{return sessionStorage.getItem(k)||""}catch{return ""}},setSession(k,v){try{sessionStorage.setItem(k,v)}catch{}},removeSession(k){try{sessionStorage.removeItem(k)}catch{}}};
function clearSessionToken(){safeStore.remove("ihsan_token");safeStore.removeSession("ihsan_token")}
function storeSessionToken(){clearSessionToken()}
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

const knowledgeVerses=[
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
let knowledgeVerseTimer=null;
function rotateKnowledgeVerses(){
 const box=$("#knowledge-verse");
 if(!box)return;
 const quote=box.querySelector(".knowledge-verse-text"),source=box.querySelector(".knowledge-verse-source"),next=box.querySelector("#knowledge-verse-next");
 if(!quote||!source)return;
 if(knowledgeVerseTimer!==null)clearInterval(knowledgeVerseTimer);
 let index=Math.floor(Math.random()*knowledgeVerses.length);
 const show=()=>{const verse=knowledgeVerses[index];quote.textContent="﴿ "+verse.text+" ﴾";source.textContent=verse.reference;index=(index+1)%knowledgeVerses.length};
 const schedule=()=>{if(knowledgeVerseTimer!==null)clearInterval(knowledgeVerseTimer);knowledgeVerseTimer=setInterval(show,12000)};
 show();schedule();
 if(next)next.addEventListener("click",()=>{show();schedule()});
}

clearSessionToken();
const themes=[
{name:"زمردي",green:"#087f5b",mint:"#ddfaed",gold:"#f5b942",paper:"#f2fbf7",ink:"#0d2b22",muted:"#456b5a",line:"#bfe5d1",surface:"#ffffff",surface2:"#eaf8f0"},
{name:"أزرق",green:"#1456c0",mint:"#e2efff",gold:"#ffc857",paper:"#f4f8ff",ink:"#102548",muted:"#49658d",line:"#c5daf9",surface:"#ffffff",surface2:"#edf4ff"},
{name:"بنفسجي",green:"#7440c8",mint:"#f1eaff",gold:"#f3c257",paper:"#faf7ff",ink:"#2e164e",muted:"#70568e",line:"#ddcff7",surface:"#ffffff",surface2:"#f5efff"},
{name:"رملي",green:"#8a4c10",mint:"#fff0dc",gold:"#e9ac32",paper:"#fffbf4",ink:"#3b2917",muted:"#795c3c",line:"#ebd4b5",surface:"#fffefa",surface2:"#fff5e7"},
{name:"فيروزي",green:"#087e8b",mint:"#def7f5",gold:"#d9b86c",paper:"#f2fbfc",ink:"#12383d",muted:"#4d7276",line:"#bfe3e5",surface:"#ffffff",surface2:"#e8f8f8"},
{name:"وردي هادئ",green:"#9b4b70",mint:"#f9e6ef",gold:"#d6b16b",paper:"#fff7fa",ink:"#452537",muted:"#805d70",line:"#efcede",surface:"#ffffff",surface2:"#fff0f5"}];
function applyTheme(){
 const validIndex=value=>{const i=Number(value);return Number.isInteger(i)&&i>=0&&i<themes.length?i:-1};
 const mode=safeStore.get("ihsan_theme_mode")||"random";
 let i=-1;
 if(mode==="fixed"){
  i=validIndex(safeStore.get("ihsan_theme_index"));
  if(i<0)i=0;
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
 document.querySelector('meta[name="theme-color"]')?.setAttribute("content",t.green);
}
applyTheme();
function applyAppearanceSettings(){
 const root=document.documentElement;
 const mode=safeStore.get("ihsan_appearance_mode")||"auto";
 const effectiveDark=mode==="dark"||(mode==="auto"&&!!window.matchMedia?.("(prefers-color-scheme: dark)").matches);
 const background=safeStore.get("ihsan_appearance_background")||"glow";
 const iconStyle=safeStore.get("ihsan_icon_style")||"soft";
 const iconSize=safeStore.get("ihsan_icon_size")||"medium";
 const fontScale=Math.min(1.8,Math.max(.85,Number(safeStore.get("ihsan_font_scale")||1)));
 // Re-apply the selected palette first, then override every semantic surface token for dark mode.
 applyTheme();
 root.dataset.appearance=mode;root.dataset.appearanceBackground=background;root.dataset.iconStyle=iconStyle;root.dataset.iconSize=iconSize;
 root.style.setProperty("--user-font-scale",String(fontScale));
 root.dataset.appearancePalette=effectiveDark?"dark":"light";
 root.style.colorScheme=effectiveDark?"dark":"light";
 if(effectiveDark){
  const dark={green:"#75dfb7",mint:"#183b32",gold:"#e8c77c",paper:"#0b1517",ink:"#e7f0eb",muted:"#adc0b7",line:"#304a43",surface:"#142321","surface-2":"#1b2d2a",glow:"#75dfb726",shadow:"0 12px 30px #0005", "shadow-raised":"0 24px 52px #0006"};
  for(const [key,value] of Object.entries(dark))root.style.setProperty("--"+key,value);
  const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.setAttribute("content","#0b1517");
 }else{
  const selected=themes.find(t=>t.name===root.dataset.ihsanTheme)||themes[0];
  const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.setAttribute("content",selected.green);
 }
}
applyAppearanceSettings();
if(window.matchMedia){const systemDark=window.matchMedia("(prefers-color-scheme: dark)");systemDark.addEventListener?.("change",()=>{if((safeStore.get("ihsan_appearance_mode")||"auto")==="auto")applyAppearanceSettings()})}
if(safeStore.get("ihsan_reduce_motion")==="1")document.documentElement.classList.add("ihsan-reduced-motion");
const esc=v=>String(v==null?"":v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function readCsrfCookie(){try{const part=document.cookie.split(";").map(x=>x.trim()).find(x=>x.startsWith("__Host-ihsan_csrf="));return part?decodeURIComponent(part.slice("__Host-ihsan_csrf=".length)):""}catch{return ""}}
function offlineUserKey(){return "ihsan_offline_user"}
function rememberOfflineUser(){
 if(!S.user?.id)return;
 const user={id:S.user.id,name:S.user.name,role:S.user.role,student_id:S.user.student_id||null,group_id:S.user.group_id||null,school_ids:S.user.school_ids||[],group_ids:S.user.group_ids||[]};
 try{safeStore.set(offlineUserKey(),JSON.stringify(user))}catch{}
}
function loadOfflineUser(){
 try{const raw=safeStore.get(offlineUserKey());if(!raw)return null;const u=JSON.parse(raw);return u&&u.id&&u.role?u:null}catch{return null}
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
  const duration=kind==="success"?.055:kind==="error"?.045:.022;
  const length=Math.max(1,Math.floor(ctx.sampleRate*duration));
  const buffer=ctx.createBuffer(1,length,ctx.sampleRate),data=buffer.getChannelData(0);
  for(let i=0;i<length;i++){const fade=1-i/length;data[i]=(Math.random()*2-1)*fade*fade;}
  const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();
  filter.type="lowpass";filter.frequency.value=kind==="error"?650:kind==="success"?1700:2400;filter.Q.value=.35;
  gain.gain.setValueAtTime(kind==="success"?.055:kind==="error"?.045:.035,ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+duration);
  source.buffer=buffer;source.connect(filter);filter.connect(gain);gain.connect(ctx.destination);source.start();source.stop(ctx.currentTime+duration);
 }catch{}
}
function toast(t,err=false){const old=$(".toast");if(old)old.remove();const e=document.createElement("div");e.className="toast"+(err?" error":"");e.textContent=t;document.body.append(e);if(err)playUiSound("error");else if(/تم|نجاح|حُفظ|نُشر|أُضيف|اكتمل|تفعيل|تثبيت/.test(t))playUiSound("success");setTimeout(()=>e.remove(),3500)}
document.addEventListener("click",e=>{if(safeStore.get("ihsan_ui_sounds")==="0")return;const target=e.target instanceof Element?e.target.closest("button,[role=button],.pressable"):null;if(!target||target.disabled||target.id==="settings-sound-preview")return;playUiSound("click")},true);
function showAcademyAbout(){
 const old=$("#academy-about-dialog");if(old)old.remove();
 const dialog=document.createElement("dialog");
 dialog.id="academy-about-dialog";
 dialog.className="academy-about-dialog";
 dialog.setAttribute("aria-labelledby","academy-about-title");
 dialog.innerHTML='<div class="academy-about-head"><div><span class="eyebrow">التعريف بالتطبيق · الرؤية والرسالة</span><h2 id="academy-about-title">أكاديمية الإحسان في بناء الإنسان</h2><p>علمٌ يُفهم، وقرآنٌ يُتقن، وخُلُقٌ يثمر عملًا.</p></div><button type="button" class="settings-close" id="academy-about-close" aria-label="إغلاق التعريف">×</button></div><div class="academy-about-body"><section class="academy-about-vision"><span class="about-kicker">رؤيتنا</span><h3>بناء إنسانٍ يعرف ربَّه، ويصحب هدي نبيّه ﷺ، ويحمل القرآن علمًا وعملًا.</h3><p>منصة تعليمية تجمع بين بناء الصلة بالوحي، وإتقان حفظ القرآن ومراجعته، وتزكية الأخلاق، وتنظيم متابعة الطالب والمعلم في بيئة واضحة ومحفّزة.</p></section><div class="academy-about-grid"><article class="academy-about-card"><span class="about-number">01</span><h3>المدرسة القرآنية</h3><p>تنظيم أفواج الطلاب، ومتابعة الحضور والحفظ والمراجعة، والواجبات والاختبارات، وسجل التقدم بحسب صلاحيات كل دور.</p></article><article class="academy-about-card"><span class="about-number">02</span><h3>بساتين الإحسان</h3><p>خمسة أصول للتعلم: معرفة الله تعالى، وسيرة الرسول ﷺ، والقرآن فهمًا وحفظًا وتدبرًا، والسنة النبوية، والأدب وسائر العلم النافع.</p></article><article class="academy-about-card"><span class="about-number">03</span><h3>برنامج «الحال المرتحل»</h3><p>مسار تراكمي لتثبيت القرآن: ست مراحل تستهدف كلٌّ منها عشرة أحزاب، ثم مرحلة للتمكين والمراجعة والختم. المدة المستهدفة تقارب ثمانية أشهر، وتُستكمل مرحلة التمكين بحسب الإتقان الفعلي لا بمجرد مرور الوقت.</p></article><article class="academy-about-card"><span class="about-number">04</span><h3>التدرّج والرفق</h3><p>المهمات اليومية والأسبوعية تقدّم للطالب مقدارًا واضحًا يناسب مرحلته؛ فلا تُحمّله الصفحة التعريفية تفاصيل البرنامج كاملة، ولا تُقدّم السرعة على سلامة التلاوة.</p></article><article class="academy-about-card"><span class="about-number">05</span><h3>متابعة ذات معنى</h3><p>أهداف واضحة، تقدم يمكن مراجعته، محطات تقييم مع الشيخ، وفوائد وأدعية موثقة المصدر مع تمييز ما تصوغه الأكاديمية عن النصوص المنقولة.</p></article><article class="academy-about-card"><span class="about-number">06</span><h3>واجهة تناسبك</h3><p>واجهة عربية مهيأة للهاتف والحاسوب، وخيارات للمظهر والوضع الليلي والخلفيات والأيقونات وحجم الخط وتقليل الحركة.</p></article><article class="academy-about-card"><span class="about-number">07</span><h3>الأدب والتزكية</h3><p>تربية الطالب على توقير الشيخ والمعلم، وحسن السؤال والشكر والدعاء، وقبول النصيحة، وترك الجفاء والسخرية؛ مع تدريب عملي على الإخلاص والتواضع والرفق وحسن الخلق.</p></article></div><section class="academy-about-principles"><h3>الأدب والتعليم والتحفيز من صميم رسالتنا وأهدافنا</h3><p><strong>أدب الطالب مع شيخه:</strong> توقير الشيخ والمعلم، وحسن الخطاب والإنصات والاستئذان، وشكر التعليم والدعاء للمعلم والثناء على إحسانه بصدق، وحسن السؤال والاستيضاح دون جفاء أو تعالٍ؛ فالأدب لا يمنع السؤال، ولا يعني الغلو أو التملّق.</p><p><strong>أدب الشيخ والمعلّم:</strong> الرفق والعدل وصيانة كرامة الطالب، وبيان الخطأ دون تحقير، والثناء الصادق المحدد الذي يشجّع على الإتقان، من غير مبالغة ولا تفضيل جائر.</p><p><strong>التعليم والتحفيز:</strong> يحسن الشيخ بيان الخطأ دون تحقير، ويثني على الاجتهاد بصدق واعتدال، ويحفّز الطالب على التقدم؛ ويتأدب الطالب بحسن الاستماع والسؤال، وقبول التصحيح، وشكر معلمه والدعاء له.</p><p><strong>صحبة القرآن:</strong> احترام مجلسه، وحسن الاستماع، وحفظ اللسان، ومساعدة الزملاء، وترك السخرية والغيبة والتشهير.</p><p><strong>أهدافنا التربوية:</strong> أن يتأدب الطالب مع القرآن وشيخه ومعلميه، ويشكر فضلهم ويدعو لهم، ويقبل التوجيه، ويسأل بأدب، ويتحلّى بالإخلاص والتواضع والصدق والرحمة؛ وأن يكون المعلم قدوةً في العلم والعدل والرفق، ويحفّز طلابه ويثني على اجتهادهم بصدق دون تحقير أو محاباة.</p></section><section class="academy-about-principles"><h3>كيف نعمل؟</h3><p><strong>الإتقان قبل الانتقال:</strong> لا يُحسب التقدم بمجرد إكمال الأيام، بل بثبات المحفوظ وسلامة الأداء.</p><p><strong>النص الشرعي بأمانة:</strong> تُذكر مراجع الآيات والأحاديث حيث ترد، وتُوسم العبارات الإنشائية بأنها من صياغة الأكاديمية.</p><p><strong>الحزم مع الرفق:</strong> يصحّح الخطأ ويُنظّم الاستدراك دون إذلال الطالب أو تحميله ما يضرّه.</p><p><strong>المهام لاحقًا:</strong> التفاصيل الدقيقة للتكرار والتسميع والربط ستظهر في المهام اليومية والخطط الأسبوعية ذات الصلة.</p></section><p class="academy-about-footnote">«الحال المرتحل» اسم تربوي للمسار، وليس تصحيحًا لنسبة الحديث الوارد بهذا اللفظ.</p></div><div class="academy-about-footer"><span>اللهم بارك في العلم والعمل، واجعل هذا السعي نافعًا مباركًا.</span><button type="button" class="btn" id="academy-about-done">متابعة</button></div>';
 document.body.append(dialog);
 const close=()=>{try{if(dialog.open)dialog.close()}catch{}dialog.remove()};
 $("#academy-about-close")?.addEventListener("click",close);
 $("#academy-about-done")?.addEventListener("click",close);
 dialog.addEventListener("click",e=>{if(e.target===dialog)close()});
 if(typeof dialog.showModal==="function")dialog.showModal();else dialog.setAttribute("open","");
}
function renderTopActions(){
 const installed=ihsanIsInstalled();
 const entryView=!S.user||S.mode==="hub";
 let actions=!S.user?'<button class="btn secondary academy-about-trigger" id="academy-about-open" type="button" aria-label="التعريف بالأكاديمية ورؤيتها">عن الأكاديمية</button> ':"";
 if(S.user)actions+='<button class="btn secondary" id="settings-open" type="button" aria-label="إعدادات الأكاديمية">الإعدادات</button> ';
 if(entryView)actions+='<button class="btn secondary install-app-button" id="install-app" type="button" '+(installed?'disabled aria-label="التطبيق مثبت بالفعل"':'aria-label="تثبيت أكاديمية الإحسان على الهاتف"')+'>'+(installed?'التطبيق مثبت':'تثبيت التطبيق')+'</button>';
 if(S.user)actions+=' <button class="btn secondary" id="logout" type="button">خروج</button>';
 const topActions=$("#top-actions");if(topActions)topActions.innerHTML=actions;
 $("#academy-about-open")?.addEventListener("click",showAcademyAbout);$("#settings-open")?.addEventListener("click",showSettings);$("#switch-module-top")?.addEventListener("click",()=>moduleChooser());$("#logout")?.addEventListener("click",logout);
 $("#install-app")?.addEventListener("click",async()=>{if(ihsanIsInstalled()){toast("أكاديمية الإحسان مثبتة بالفعل على هذا الجهاز.");return}const p=ihsanInstallPrompt;if(!p){showInstallGuide();return}ihsanInstallPrompt=null;try{await p.prompt();const choice=await p.userChoice;if(choice?.outcome==="accepted")toast("اتبع تعليمات المتصفح لإكمال تثبيت الأكاديمية.");else toast("يمكنك التثبيت لاحقًا من قائمة المتصفح.")}catch{showInstallGuide()}});
}

function showSettings(){
 const old=$("#settings-dialog");if(old)old.remove();
 const themeMode=safeStore.get("ihsan_theme_mode")||"random";
 const storedIndex=themeMode==="fixed"?safeStore.get("ihsan_theme_index"):safeStore.getSession("ihsan_session_theme_index");
 const rawIndex=Number(storedIndex||0);
 const selectedIndex=Number.isInteger(rawIndex)&&rawIndex>=0&&rawIndex<themes.length?rawIndex:0;
 const reduced=safeStore.get("ihsan_reduce_motion")==="1";
 const notes=["أخضر قرآني عميق","أزرق هادئ وواضح","بنفسجي متوازن","رملي دافئ","فيروزي منعش ومتزن","وردي هادئ بلمسة ذهبية"];
 const themeMarkup=themes.map((t,i)=>'<button type="button" class="theme-choice" data-theme-index="'+i+'" aria-pressed="'+(i===selectedIndex)+'"><span class="theme-swatch theme-swatch-'+i+'" aria-hidden="true"><i></i></span><span class="theme-choice-copy"><strong>'+esc(t.name)+'</strong><small>'+notes[i]+'</small></span><span class="theme-check" aria-hidden="true">✓</span></button>').join("");
 const googleLinked=safeStore.get("ihsan_google_linked")==="1";
 const securityMarkup=S.user?'<section class="settings-section"><div class="settings-section-title"><span class="settings-icon" aria-hidden="true">⌑</span><div><h3>الحساب والأمان</h3><p>احمِ حسابك بكلمة مرور قوية لا تستخدمها في موقع آخر.</p></div></div><div class="student-actions"><button type="button" class="btn" id="settings-password">تغيير كلمة المرور</button>'+(googleLinked?'<span class="google-linked-status" role="status">✓ Google مرتبط بهذا الحساب</span>':'<button type="button" class="btn secondary" id="settings-google-link">ربط حساب Google</button>')+'</div><div id="settings-google-link-area" class="google-login-section hidden"><div id="settings-google-link-host"></div><p id="settings-google-link-note" class="muted small">اربط حساب Google بحساب الأكاديمية الحالي؛ لن يُنشأ حساب جديد.</p></div></section>':'<section class="settings-section"><h3>الحساب والأمان</h3><p class="muted small">سجّل الدخول لإدارة إعدادات حسابك وكلمة المرور.</p></section>';
 const markup='<dialog id="settings-dialog" class="settings-dialog" aria-labelledby="settings-title"><div class="settings-head"><div><span class="eyebrow">تفضيلاتك الشخصية</span><h2 id="settings-title">إعدادات الأكاديمية</h2><p>اضبط الواجهة بما يريحك، وتُحفظ اختياراتك على هذا الجهاز.</p></div><button type="button" class="settings-close" id="settings-close" aria-label="إغلاق الإعدادات">×</button></div><div class="settings-body"><section class="settings-section settings-contact-section"><div class="settings-section-title"><span class="settings-icon" aria-hidden="true">✆</span><div><h3>التواصل والمساعدة</h3><p>قنوات مباشرة للملاحظات والتحسين والتنبيهات.</p></div></div><div class="settings-help-grid"><article class="settings-help-card"><h4>التواصل مع صاحب الأكاديمية</h4><p>للاستفسارات وملاحظات الاستخدام.</p><a class="btn" href="https://wa.me/213652358723?text=%D8%A7%D9%84%D8%B3%D9%84%D8%A7%D9%85%20%D8%B9%D9%84%D9%8A%D9%83%D9%85%D8%8C%20%D8%A3%D8%B1%D9%8A%D8%AF%20%D8%A7%D9%84%D8%AA%D9%88%D8%A7%D8%B5%D9%84%20%D8%A8%D8%B4%D8%A3%D9%86%20%D8%A3%D9%83%D8%A7%D8%AF%D9%8A%D9%85%D9%8A%D8%A9%20%D8%A7%D9%84%D8%A5%D8%AD%D8%B3%D8%A7%D9%86" target="_blank" rel="noopener noreferrer">واتساب · 0652358723</a></article><article class="settings-help-card"><h4>اقتراح تطوير</h4><p>شاركنا فكرة واضحة أو مشكلة واجهتك، مع اسم الصفحة والخطوات التي تظهر بها.</p><a class="btn secondary" href="https://wa.me/213652358723?text=%D8%A7%D9%82%D8%AA%D8%B1%D8%A7%D8%AD%20%D8%AA%D8%B7%D9%88%D9%8A%D8%B1%20%D9%84%D8%A3%D9%83%D8%A7%D8%AF%D9%8A%D9%85%D9%8A%D8%A9%20%D8%A7%D9%84%D8%A5%D8%AD%D8%B3%D8%A7%D9%86" target="_blank" rel="noopener noreferrer">إرسال اقتراح عبر واتساب</a></article><article class="settings-help-card"><h4>دعم الأكاديمية</h4><p>للتبرع أو المساهمة في تطوير المشروع، تواصل مباشرة مع صاحب الأكاديمية لترتيب طريقة آمنة؛ لا تُدخل بيانات دفع في المنصة.</p><a class="btn secondary" href="https://wa.me/213652358723?text=%D8%A3%D8%B1%D8%BA%D8%A8%20%D9%81%D9%8A%20%D8%AF%D8%B9%D9%85%20%D8%A3%D9%83%D8%A7%D8%AF%D9%8A%D9%85%D9%8A%D8%A9%20%D8%A7%D9%84%D8%A5%D8%AD%D8%B3%D8%A7%D9%86" target="_blank" rel="noopener noreferrer">التواصل بشأن التبرع</a></article><article class="settings-help-card"><h4>التنبيهات والأخطاء</h4><p>راجع التنبيهات، وأرسل بلاغًا مع اسم الصفحة والخطوات التي سبقت الخطأ.</p><button type="button" class="btn secondary" id="settings-open-notifications">فتح التنبيهات</button><a class="btn secondary" href="https://wa.me/213652358723?text=%D8%A8%D9%84%D8%A7%D8%BA%20%D8%B9%D9%86%20%D8%AE%D8%B7%D8%A3%3A%20%D8%A7%D8%B3%D9%85%20%D8%A7%D9%84%D8%B5%D9%81%D8%AD%D8%A9%20%D9%88%D8%B5%D9%81%20%D8%A7%D9%84%D8%AE%D8%B7%D8%A3%20%D9%88%D8%A7%D9%84%D8%AE%D8%B7%D9%88%D8%A7%D8%AA" target="_blank" rel="noopener noreferrer">الإبلاغ عن خطأ</a></article><article class="settings-help-card"><h4>ساعدنا على التطوير</h4><p>سجّل الحفظ بعد الحلقة مباشرة، وتأكد من رقم الثمن، واقترح تحسينًا محددًا مع ذكر الصفحة التي تخصه.</p><a class="btn secondary" href="https://wa.me/213652358723?text=%D8%A7%D9%82%D8%AA%D8%B1%D8%A7%D8%AD%20%D9%84%D8%AA%D8%B7%D9%88%D9%8A%D8%B1%20%D8%A3%D9%83%D8%A7%D8%AF%D9%8A%D9%85%D9%8A%D8%A9%20%D8%A7%D9%84%D8%A5%D8%AD%D8%B3%D8%A7%D9%86%3A%20" target="_blank" rel="noopener noreferrer">إرسال اقتراح</a></article><article class="settings-help-card"><h4>دعم الأكاديمية بالتبرع</h4><p>للتبرع والاستفسار عن وسيلة الدعم المتاحة، تواصل مع المالك؛ لم تُضف بيانات دفع غير مؤكدة.</p><a class="btn" href="https://wa.me/213652358723?text=%D8%A3%D8%B1%D8%BA%D8%A8%20%D9%81%D9%8A%20%D8%AF%D8%B9%D9%85%20%D8%A3%D9%83%D8%A7%D8%AF%D9%8A%D9%85%D9%8A%D8%A9%20%D8%A7%D9%84%D8%A5%D8%AD%D8%B3%D8%A7%D9%86%20%D8%A8%D8%A7%D9%84%D8%AA%D8%A8%D8%B1%D8%B9" target="_blank" rel="noopener noreferrer">التبرع ودعم المشروع</a></article></div></section><section class="settings-section"><div class="settings-section-title"><span class="settings-icon" aria-hidden="true">◈</span><div><h3>ألوان الواجهة</h3><p>اختر سمة، وستتغيّر ألوان الصفحات والبطاقات معًا.</p></div></div><div class="theme-options">'+themeMarkup+'</div><div class="theme-mode-controls"><button type="button" id="settings-theme-random" class="btn secondary" aria-pressed="'+(themeMode!=="fixed")+'">🎲 عشوائي كل جلسة</button><span class="pill" id="theme-mode-status">'+(themeMode==="fixed"?'السمة المثبتة: '+esc(themes[selectedIndex].name):'يتغيّر اللون تلقائيًا مع كل جلسة جديدة')+'</span></div></section><section class="settings-section appearance-studio"><div class="settings-section-title"><span class="settings-icon" aria-hidden="true">✦</span><div><h3>استوديو المظهر</h3><p>اضبط الوضع الليلي والخلفية والأيقونات وحجم الخط بما يناسبك.</p></div></div><div class="appearance-grid"><div class="appearance-field"><label>الوضع اللوني</label><div class="appearance-buttons"><button type="button" class="appearance-choice" data-appearance-mode="light">☀ نهاري</button><button type="button" class="appearance-choice" data-appearance-mode="dark">☾ ليلي مبهر</button><button type="button" class="appearance-choice" data-appearance-mode="auto">◐ تلقائي</button></div></div><div class="appearance-field"><label>خلفية الصفحات</label><div class="appearance-buttons"><button type="button" class="appearance-choice" data-appearance-bg="glow">✦ وهج</button><button type="button" class="appearance-choice" data-appearance-bg="geometry">◇ هندسية</button><button type="button" class="appearance-choice" data-appearance-bg="plain">○ صافية</button></div></div><div class="appearance-field"><label>شكل الأيقونات</label><div class="appearance-buttons appearance-icon-style-options"><button type="button" class="appearance-choice" data-icon-style="soft"><span class="appearance-demo-icon" data-demo-style="soft" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3 14.8 9.2 21 12 14.8 14.8 12 21 9.2 14.8 3 12 9.2 9.2Z"/></svg></span><span>ناعمة</span></button><button type="button" class="appearance-choice" data-icon-style="bold"><span class="appearance-demo-icon" data-demo-style="bold" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3 14.8 9.2 21 12 14.8 14.8 12 21 9.2 14.8 3 12 9.2 9.2Z"/></svg></span><span>بارزة</span></button><button type="button" class="appearance-choice" data-icon-style="framed"><span class="appearance-demo-icon" data-demo-style="framed" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3 14.8 9.2 21 12 14.8 14.8 12 21 9.2 14.8 3 12 9.2 9.2Z"/></svg></span><span>مؤطّرة</span></button></div></div><div class="appearance-field"><label>حجم الأيقونات <span class="muted small">معاينة بالحجم الحقيقي</span></label><div class="appearance-buttons appearance-icon-size-options"><button type="button" class="appearance-choice" data-icon-size="small"><span class="appearance-size-demo" data-demo-size="small" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 12h16M12 4v16"/><circle cx="12" cy="12" r="8"/></svg></span><span>صغير</span></button><button type="button" class="appearance-choice" data-icon-size="medium"><span class="appearance-size-demo" data-demo-size="medium" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 12h16M12 4v16"/><circle cx="12" cy="12" r="8"/></svg></span><span>متوسط</span></button><button type="button" class="appearance-choice" data-icon-size="large"><span class="appearance-size-demo" data-demo-size="large" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 12h16M12 4v16"/><circle cx="12" cy="12" r="8"/></svg></span><span>كبير</span></button></div></div><div class="appearance-live-preview" aria-live="polite"><div><strong>معاينة الأيقونات في الأكاديمية</strong><p>تتغيّر هذه الأمثلة فورًا مع اختيار الحجم والشكل، لتتخيّل ظهورها في القوائم والبطاقات.</p></div><div class="appearance-live-icons"><span class="appearance-live-item"><svg viewBox="0 0 24 24" class="nav-icon" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/></svg><small>الرئيسية</small></span><span class="appearance-live-item"><svg viewBox="0 0 24 24" class="nav-icon" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v18H6.5A2.5 2.5 0 0 1 4 17.5z"/><path d="M4 17.5A2.5 2.5 0 0 1 6.5 15H20"/></svg><small>القرآن</small></span><span class="appearance-live-item"><svg viewBox="0 0 24 24" class="nav-icon" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m12 21-1.45-1.32C5.4 14.99 2 11.9 2 8.1 2 5 4.42 2.5 7.5 2.5c1.74 0 3.41.81 4.5 2.1 1.09-1.29 2.76-2.1 4.5-2.1C19.58 2.5 22 5 22 8.1c0 3.8-3.4 6.89-8.55 11.59z"/></svg><small>إنجازي</small></span><span class="appearance-live-item"><svg viewBox="0 0 24 24" class="nav-icon" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 4 4L19 6"/></svg><small>المهام</small></span></div></div><div class="appearance-field appearance-font-field"><label for="settings-font-scale">حجم الخط <output id="settings-font-scale-value">100%</output></label><input id="settings-font-scale" type="range" min="85" max="180" step="5" value="'+Math.round(Math.min(1.8,Math.max(.85,Number(safeStore.get("ihsan_font_scale")||1)))*100)+'"><div class="appearance-range-labels"><span>أصغر</span><span>أكبر</span></div><p class="appearance-font-preview" id="settings-font-preview">بسم الله الرحمن الرحيم — العلم النافع والعمل الصالح</p></div></div></section><section class="settings-section"><div class="settings-section-title"><span class="settings-icon" aria-hidden="true">◌</span><div><h3>الأصوات والراحة</h3><p>مؤثرات قصيرة غير لحنية، دون موسيقى أو نغمات؛ للنقر والنجاح والتنبيه.</p></div></div><label class="settings-preference" for="settings-ui-sounds"><span><strong>مؤثرات الواجهة</strong><small>تشغيل أو إيقاف أصوات الضغط والنتائج على هذا الجهاز.</small></span><input id="settings-ui-sounds" type="checkbox" '+(safeStore.get("ihsan_ui_sounds")!=="0"?'checked':'')+'></label><div class="student-actions"><button type="button" class="btn secondary" id="settings-sound-preview">تجربة الصوت</button><span class="muted small" id="settings-sound-status">'+(safeStore.get("ihsan_ui_sounds")==="0"?'الأصوات متوقفة':'الأصوات مفعّلة')+'</span></div></section><section class="settings-section"><div class="settings-section-title"><span class="settings-icon" aria-hidden="true">◌</span><div><h3>الحركة والراحة</h3><p>خفّف الحركات الانتقالية إذا فضّلت واجهة أكثر هدوءًا.</p></div></div><label class="settings-preference" for="settings-reduced-motion"><span><strong>تقليل الحركة</strong><small>إيقاف الحركات والزخارف المتحركة غير الضرورية.</small></span><input id="settings-reduced-motion" type="checkbox" '+(reduced?'checked':'')+'></label></section>'+securityMarkup+'</div><div class="settings-foot"><span>أكاديمية الإحسان في بناء الإنسان</span></div></dialog>';
 document.body.insertAdjacentHTML("beforeend",markup);
 const dialog=$("#settings-dialog");
 const close=()=>{try{if(dialog.open)dialog.close()}catch{}dialog.remove()};
 $("#settings-close").onclick=close;$("#settings-open-notifications")?.addEventListener("click",()=>{close();go("notifications")});
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
 form.onsubmit=async e=>{e.preventDefault();const f=new FormData(form),error=$("#password-error"),button=form.querySelector('button[type="submit"]');error.classList.add("hidden");if(String(f.get("new_password")||"").length<10){error.textContent="كلمة المرور الجديدة يجب أن تكون 10 أحرف على الأقل.";error.classList.remove("hidden");return}if(f.get("new_password")!==f.get("confirm_password")){error.textContent="كلمتا المرور الجديدتان غير متطابقتين.";error.classList.remove("hidden");return}button.disabled=true;try{await api("/me/password",{method:"POST",body:JSON.stringify({current_password:f.get("current_password"),new_password:f.get("new_password")})});S.user=await api("/me");if("PasswordCredential" in window&&navigator.credentials&&navigator.credentials.store&&S.user?.email){try{await navigator.credentials.store(new PasswordCredential({id:String(S.user.email),password:String(f.get("new_password")),name:S.user?.name||String(S.user.email)}))}catch{}}toast("تم تغيير كلمة المرور");dialog.close();dialog.remove();if(forced)await start()}catch(x){error.textContent=x.message;error.classList.remove("hidden")}finally{if(button.isConnected)button.disabled=false}}
 if(typeof dialog.showModal==="function")dialog.showModal();else dialog.setAttribute("open","");
}

function auth(setup){renderTopActions();
const authSupplications=[
 {title:"دعاء قرآني لزيادة العلم",text:"وَقُلْ رَبِّ زِدْنِي عِلْمًا",source:"القرآن الكريم · طه: 114"},
 {title:"دعاء نبوي للعلم النافع",text:"اللَّهُمَّ إِنِّي أَسْأَلُكَ عِلْمًا نَافِعًا، وَرِزْقًا طَيِّبًا، وَعَمَلًا مُتَقَبَّلًا",source:"سنن ابن ماجه (925)"},
 {title:"دعاء نبوي على العبادة",text:"اللَّهُمَّ أَعِنِّي عَلَى ذِكْرِكَ وَشُكْرِكَ وَحُسْنِ عِبَادَتِكَ",source:"سنن أبي داود (1522)، والنسائي (1303)"},
 {title:"دعاء قرآني جامع",text:"رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ",source:"القرآن الكريم · البقرة: 201"}
];
const authBenefits=[
 {title:"بشارة فضيلة تعليم القرآن",text:"«خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ»؛ نسأل الله تعالى أن يجعل تعليمكم مباركًا، وأن يكتب لكم أجر ما تغرسونه من خير.",source:"صحيح البخاري (5027)؛ والتشجيع بصياغة الأكاديمية."},
 {title:"فضل طريق العلم",text:"«مَنْ سَلَكَ طَرِيقًا يَلْتَمِسُ فِيهِ عِلْمًا، سَهَّلَ اللَّهُ لَهُ بِهِ طَرِيقًا إِلَى الْجَنَّةِ»؛ بارك الله تعالى في مجلس العلم وأهله.",source:"صحيح مسلم (2699)؛ والتشجيع بصياغة الأكاديمية."},
 {title:"رسالة تقدير لفضيلة الشيخ",text:"فضيلة الشيخ، أحسن الله إليكم، وبارك في وقتكم وعلمكم، ونفع بكم وبطلابكم، وجعل ما تبذلونه في تعليم القرآن وتربية النفوس في ميزان حسناتكم.",source:"دعاء من صياغة الأكاديمية، وليس حديثًا نبويًا."},
 {title:"الدعوة بالقول والعمل",text:"﴿وَمَنْ أَحْسَنُ قَوْلًا مِمَّنْ دَعَا إِلَى اللَّهِ وَعَمِلَ صَالِحًا﴾؛ نسأل الله تعالى أن يبارك في تعليمكم، ويجمع لكم نفع العلم وصلاح العمل.",source:"القرآن الكريم، سورة فصلت: 33؛ والدعاء من صياغة الأكاديمية."}
];

const authDua=authSupplications[Math.floor(Math.random()*authSupplications.length)];
const authWisdom=authBenefits[Math.floor(Math.random()*authBenefits.length)];
app.innerHTML=app.innerHTML='<div class="auth-layout"><section class="welcome"><div><span class="eyebrow">بِسْمِ اللهِ الرَّحْمَنِ الرَّحِيمِ</span><h1>في بساتين الوحي، نتعلّم لنحيا بالقرآن والسنة.</h1><p>رحلة هادئة بين آيات الهداية، وأحاديث النبي ﷺ، ومعاني أسماء الله الحسنى، وسِيَر الصالحين؛ نقرأ ونتدبّر ونسأل ونعمل، حتى يثمر العلم إيمانًا وعبادةً وأدبًا ورحمة.</p></div><div class="welcome-bottom"><div class="verse knowledge-verse" id="knowledge-verse" dir="rtl" aria-live="polite" aria-atomic="true"><span class="knowledge-verse-text"></span><small class="knowledge-verse-source"></small></div><div class="auth-entry-nourishment"><article class="auth-entry-card"><strong>'+esc(authDua.title)+'</strong><p>'+esc(authDua.text)+'</p><small>'+esc(authDua.source)+'</small></article><article class="auth-entry-card"><strong>'+esc(authWisdom.title)+'</strong><p>'+esc(authWisdom.text)+'</p><small>'+esc(authWisdom.source||"فائدة من إعداد الأكاديمية")+'</small></article></div><button type="button" class="btn academy-about-welcome" id="about-open-welcome">التعريف بالأكاديمية ورؤيتها</button></div></section><section class="panel stack">'+(setup?'<div class="notice">أول دخول: أنشئ حساب المدير مرة واحدة.</div>':'')+'<div><h2>'+(setup?"إعداد الأكاديمية":"تسجيل الدخول")+'</h2><p class="muted small">'+(setup?"احتفظ برمز الإعداد لنفسك فقط.":"استخدم اسم الدخول أو البريد الذي أنشأه لك المدير.")+'</p></div><form id="auth-form" class="stack">'+(setup?'<label class="field">رمز الإعداد<input name="code" type="password" required autocomplete="off"></label><label class="field">الاسم الكامل<input name="name" required maxlength="120"></label><label class="field">البريد الإلكتروني<input name="email" type="email" required></label><label class="field">كلمة مرور المدير (14 حرفًا على الأقل)<input name="password" type="password" minlength="14" required autocomplete="new-password"></label>':'<label class="field">اسم الدخول أو الاسم الكامل<input name="username" value="'+esc(safeStore.get("ihsan_last_identity"))+'" required autocomplete="username"></label><label class="field">كلمة المرور<input name="password" type="password" required autocomplete="current-password"></label><p class="password-manager-note">يمكنك حفظ كلمة المرور في مدير كلمات مرور المتصفح عند ظهور الطلب؛ الأكاديمية لا تحفظها كنص مكشوف.</p><label class="remember-option"><input name="remember" type="checkbox" checked> احفظ جلسة الدخول على هذا الجهاز لمدة تصل إلى 30 يومًا؛ ألغِ الخيار على الأجهزة المشتركة.</label>')+'<div id="auth-error" class="notice error hidden"></div><button class="btn" type="submit">'+(setup?"إنشاء حساب المدير":"تسجيل الدخول")+'</button></form>'+(!setup?'<div class="login-divider"><span>أو</span></div><section class="google-login-section" aria-label="تسجيل الدخول باستخدام Google"><div id="google-signin"></div><p id="google-login-note" class="muted small">جارٍ التحقق من إعدادات الدخول بجوجل…</p></section>':'')+'</section></div>';
$("#auth-form").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.currentTarget),b=e.currentTarget.querySelector("button"),err=$("#auth-error");b.disabled=true;err.classList.add("hidden");try{if(setup){await api("/admin/bootstrap",{method:"POST",headers:{"x-bootstrap-secret":String(f.get("code"))},body:JSON.stringify({name:f.get("name"),email:f.get("email"),password:f.get("password")})});toast("تم إنشاء المدير. سجّل الدخول.");auth(false)}else{const d=await api("/login",{method:"POST",body:JSON.stringify({identity:f.get("username"),password:f.get("password"),remember:f.get("remember")==="on"})});S.token="";clearSessionToken();S.user=d.user;safeStore.set("ihsan_last_identity",String(f.get("username")||""));if(S.user?.must_change_password){renderTopActions();showPasswordChange(true)}else{if("PasswordCredential" in window&&navigator.credentials&&navigator.credentials.store){try{await navigator.credentials.store(new PasswordCredential({id:String(f.get("username")),password:String(f.get("password")),name:d.user?.name||String(f.get("username"))}))}catch{}}await start()}}}catch(x){err.textContent=x.message;err.classList.remove("hidden")}finally{b.disabled=false}}
 rotateKnowledgeVerses();
 $("#about-open-welcome")?.addEventListener("click",showAcademyAbout);
 if(!setup)initGoogleSignIn();
}
async function boot(){try{const st=await api("/setup/status");try{S.user=await api("/me");if(S.user?.must_change_password){renderTopActions();showPasswordChange(true)}else{await start()}}catch{const localUser=loadOfflineUser();if(localUser&&!navigator.onLine){S.user=localUser;S.token="";start()}else{S.token="";clearSessionToken();auth(st.needs_admin&&st.setup_enabled)}}}catch{const localUser=loadOfflineUser();if(localUser){S.user=localUser;S.token="";start();toast("وضع دون اتصال: عُرضت آخر بيانات محفوظة، وستتزامن العمليات المعلّقة عند عودة الشبكة.");return}app.innerHTML='<div class="panel"><h2>تعذّر الاتصال</h2><p class="muted">تعذّر الوصول إلى قاعدة البيانات. حدّث الصفحة بعد قليل.</p><button class="btn" id="boot-retry">إعادة المحاولة</button></div>';$("#boot-retry")?.addEventListener("click",()=>location.reload())}}
async function logout(){
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
ihsanPrayerDialog({title:prayer.title,text:prayer.text,source:prayer.source||(prayer.kind?prayer.kind+"؛ ليس نصًا منسوبًا إلى السنة":""),icon:"☾",primary:"تسجيل الخروج",secondary:"البقاء في الأكاديمية",onPrimary:async()=>{try{await api("/logout",{method:"POST",body:"{}"})}catch{}try{history.replaceState({ihsanMode:"auth"},"",location.pathname+"#login")}catch{}document.body.classList.remove("app-authenticated");S.token="";S.user=null;S.mode="hub";S.tab="home";safeStore.remove(offlineUserKey());clearSessionToken();auth(false)}})}
async function load(){const r=await Promise.allSettled([api("/groups"),api("/students")]);S.groups=r[0].status==="fulfilled"?r[0].value:[];S.students=r[1].status==="fulfilled"?r[1].value:[];if(["admin","director"].includes(S.user.role))try{S.teachers=await api("/teachers")}catch{S.teachers=[]}if(S.user.role==="admin"){const extra=await Promise.allSettled([api("/admin/staff"),api("/public/quran-schools")]);S.staff=extra[0].status==="fulfilled"?extra[0].value:[];S.schools=extra[1].status==="fulfilled"?extra[1].value:[]}}
function items(){
 if(S.mode==="ihsan")return [["all","نظرة عامة"],["allah","معرفة الله"],["prophet","الرسول ﷺ"],["quranpath","القرآن الكريم"],["hifzprogram","الحال المرتحل"],["sunnah","السنة والمتون"],["adab","الأدب والعمل"]];
 if(S.user.role==="admin"){
  const full=safeStore.get("ihsan_admin_focus")==="full";
  if(!full)return [["home","الرئيسية"],["students","طلابي وطلاب المدرسة"],["attendance","الحضور"],["quran","متابعة القرآن"],["gradebook","السجل التعليمي"],["reports","التقارير"],["notifications","التنبيهات"],["messages","الرسائل"]];
  return [["home","الرئيسية"],["groups","الأفواج والمعلمون والفرق"],["students","طلابي وطلاب المدرسة"],["attendance","الحضور"],["quran","متابعة القرآن"],["gradebook","السجل التعليمي"],["reports","التقارير"],["notifications","التنبيهات"],["messages","الرسائل"],["assignments","الواجبات"],["tests","الاختبارات"],["system-check","فحص النظام"]];
 }
 if(S.user.role==="director")return [["home","الرئيسية"],["groups","الأفواج والمعلمون والفرق"],["students","طلاب المدرسة"],["attendance","الحضور"],["quran","متابعة القرآن"],["gradebook","السجل التعليمي"],["reports","التقارير"],["notifications","التنبيهات"],["messages","الرسائل"],["assignments","الواجبات"],["tests","الاختبارات"]];
 if(S.user.role==="supervisor")return [["home","الرئيسية"],["students","طلاب فريقي"],["teams","فرقي الطلابية"],["attendance","الحضور"],["quran","متابعة القرآن"],["gradebook","السجل التعليمي"],["reports","التقارير"],["notifications","التنبيهات"],["messages","الرسائل"],["assignments","الواجبات"],["tests","الاختبارات"]];
 if(S.user.role==="teacher")return [["home","الرئيسية"],["students","طلبتي"],["teams","فرقي الطلابية"],["attendance","الحضور"],["quran","متابعة القرآن"],["gradebook","السجل التعليمي"],["reports","التقارير"],["notifications","التنبيهات"],["messages","الرسائل"],["assignments","الواجبات"],["tests","الاختبارات"]];
 return [["home","الرئيسية"],["profile","ملفي"],["teams","فرقتي وطلبات النقل"],["quran","تقدمي في القرآن"],["assignments","واجباتي"],["gradebook","تقدمي ودرجاتي"],["attendance","حضوري"],["tests","اختباراتي"],["notifications","التنبيهات"],["messages","الرسائل"],["leaderboard","الترتيب العام"]];
}

function honorificDisplayName(name,role){const clean=String(name||"").replace(/^فضيلة الشيخ[،\s]*/,"").replace(/[،,]?\s*حفظه الله ونفع به$/,"").trim();if(["admin","director","teacher"].includes(role))return "فضيلة الشيخ "+clean+"، حفظه الله ونفع به";return clean||"مستخدم"}
const ROLE_LABELS={admin:"فضيلة الشيخ · مدير الأكاديمية",director:"فضيلة الشيخ · مدير المدرسة",teacher:"فضيلة الشيخ",supervisor:"مشرف الفرقة الطلابية",student:"الطالب"};
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
 "system-check":'<path d="M12 3 20 6v5c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z"/><path d="m8.5 12 2.2 2.2 4.8-5"/>',
 all:'<path d="M4 19V5"/><path d="M4 19h17"/><path d="m7 15 4-4 3 2 5-6"/>',
 allah:'<path d="M12 21v-9"/><path d="M12 15C5 15 3 11 3 6c5 0 9 2 9 9Z"/><path d="M12 12c0-5 3-8 9-8 0 5-3 8-9 8Z"/>',
 prophet:'<path d="M7 3.5h11a2 2 0 0 1 2 2v15H8a3 3 0 0 1-3-3v-11a3 3 0 0 1 2-3Z"/><path d="M5 17.5a3 3 0 0 1 3-3h12M9 8h7M9 11h5"/>',
 quranpath:'<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v18H6.5A2.5 2.5 0 0 1 4 17.5z"/><path d="M4 17.5A2.5 2.5 0 0 1 6.5 15H20"/>',
 sunnah:'<path d="M6 3h12v18l-6-4-6 4z"/><path d="m9 9 2 2 4-4"/>',
 adab:'<path d="M12 3 14 9l6 1-4.5 4 1 6-4.5-3-4.5 3 1-6L4 10l6-1z"/>',
 hifzprogram:'<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v18H6.5A2.5 2.5 0 0 1 4 17.5z"/><path d="M4 17.5A2.5 2.5 0 0 1 6.5 15H20M8 6h7M8 9h6"/>'
};
function navIcon(id){return '<svg viewBox="0 0 24 24" class="nav-icon" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'+(NAV_ICON_PATHS[id]||'<circle cx="12" cy="12" r="8"/>')+'</svg>'}
function navigationGroups(){
 const list=items();if(S.mode==="ihsan")return [{title:"منهج الإحسان",items:list}];
 const makeGroup=(title,ids)=>({title,items:list.filter(x=>ids.includes(x[0]))});
 if(S.user.role==="admin"){
  const full=safeStore.get("ihsan_admin_focus")==="full";
  if(!full)return [
   makeGroup("مهام الشيخ اليومية",["home","students","attendance","quran"]),
   makeGroup("المتابعة والتواصل",["gradebook","reports","notifications","messages"])
  ].filter(g=>g.items.length);
  return [
   makeGroup("إدارة الأكاديمية",["home","groups","students"]),
   makeGroup("المهام الأساسية اليومية",["attendance","quran"]),
   makeGroup("المتابعة والتقويم",["gradebook","reports","notifications","messages"]),
   makeGroup("أدوات إضافية وتحسينية",["assignments","tests","system-check"])
  ].filter(g=>g.items.length);
 }
 if(["teacher","director","supervisor"].includes(S.user.role))return [
  makeGroup(S.user.role==="director"?"إدارة المدرسة":S.user.role==="supervisor"?"متابعة الفريق":"التدريس والمتابعة",["home","groups","students","teams"]),
  makeGroup("المهام الأساسية اليومية",["attendance","quran"]),
  makeGroup("المتابعة والتقويم",["gradebook","reports","notifications","messages"]),
  makeGroup("أدوات إضافية",["assignments","tests"])
 ].filter(g=>g.items.length);
 return [makeGroup("رحلتي التعليمية",["home","profile","teams","quran","assignments","gradebook","attendance","tests","notifications","messages","leaderboard"])].filter(g=>g.items.length);
}

function navMarkup(){return navigationGroups().map(group=>'<div class="nav-section"><div class="nav-section-title">'+esc(group.title)+'</div>'+group.items.map(x=>'<button class="nav-btn '+(S.tab===x[0]?"active":"")+'" data-tab="'+esc(x[0])+'"><span class="nav-icon-wrap">'+navIcon(x[0])+'</span><span class="nav-label">'+esc(x[1])+'</span><span class="nav-chevron" aria-hidden="true">‹</span></button>').join("")+'</div>').join("")}

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
 rememberOfflineUser();flushOfflineQueue(true);
 renderTopActions();
 const savedMode=safeStore.getSession("ihsan_last_mode"),savedTab=safeStore.getSession("ihsan_last_tab");
 if(savedMode==="school"||savedMode==="ihsan"){
  S.mode=savedMode;S.tab=savedTab||(savedMode==="ihsan"?"all":"home");if(["backup","audit","school-managers","posts","teachers"].includes(S.tab))S.tab=S.user?.role==="admin"?"groups":"home";if(S.tab==="system-check"&&S.user?.role!=="admin")S.tab="home";
  showRotatingEntryPrayer();
  if(S.mode==="school")load().then(()=>{shell();page()});else{shell();page()}
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
  onPrimary:student?()=>{
   if(!inHub){S.mode=currentMode;S.tab=currentTab;return}
   S.mode="ihsan";S.tab="all";safeStore.setSession("ihsan_last_mode","ihsan");safeStore.setSession("ihsan_last_tab","all");
   try{history.pushState({ihsanMode:"ihsan",ihsanTab:"all"},"",location.pathname)}catch{}
   shell();page();
  }:async()=>{
   if(!inHub){S.mode=currentMode;S.tab=currentTab;return}
   S.mode="school";S.tab="home";safeStore.setSession("ihsan_last_mode","school");safeStore.setSession("ihsan_last_tab","home");
   try{history.pushState({ihsanMode:"school",ihsanTab:"home"},"",location.pathname)}catch{}
   await load();shell();await page();
  },
  onSecondary:()=>{}
 });
}

function moduleChooser(push=true){safeStore.setSession("ihsan_last_mode","hub");safeStore.removeSession("ihsan_last_tab");document.body.classList.remove("app-authenticated");const outerHeader=document.querySelector("header.topbar"),actionBar=$("#top-actions");if(outerHeader&&actionBar&&!outerHeader.contains(actionBar))outerHeader.appendChild(actionBar);S.mode="hub";if(push){try{history.pushState({ihsanMode:"hub"},"",location.pathname+"#home")}catch{}}document.body.classList.remove("app-authenticated");renderTopActions();app.innerHTML='<section class="module-welcome"><span class="eyebrow">أَكَادِيمِيَّةُ الإِحْسَانِ فِي بِنَاءِ الإِنْسَان</span><h1>'+(S.user.role==="student"?"تجوّل في بساتين الإحسان":"مناراتُ العلم وبساتينُ الإحسان")+'</h1><p>'+(S.user.role==="student"?"من هنا تبدأ رحلتان متكاملتان: مدرسةٌ تحفظ القرآن وتتابع الحفظ والمراجعة، وبساتينُ علمٍ تتفيّأ ظلال الوحي؛ تتعرّف فيها إلى ربك تعالى، وتصحب سيرة رسوله ﷺ، وتفتح نوافذ التدبّر في القرآن، وتنهل من السنة، ثم ترى أثر العلم في عبادتك وخُلُقك ومعاملتك.":"من هُنا تُبنى العقول، وتُهذَّب النفوس، وتُصاغ هممُ الرجال؛ بالقرآن نهتدي، وبالسنة نقتدي، وبالعلم نرتقي، وبالأخلاق نسمو، وبالعمل نُثمر؛ لنُخرّج جيلًا راسخَ العلم، كريمَ الخُلُق، عظيمَ الأثر، يحمل نورَ الوحي إلى العالمين، ويترك في الحياة بصمةَ المحسنين خارجا من ظلمة الغافلين.")+'</p></section><div class="module-grid"><button class="module-card school-module" id="open-school"><span class="module-art school-art" aria-hidden="true"><svg viewBox="0 0 64 64"><path d="M7 27 32 9l25 18v28H7z"/><path d="M17 55V34h30v21M26 55V41h12v14M17 27h30M23 20h18"/></svg></span><span class="module-label">المدرسة القرآنية</span><span class="module-desc">الحفظ والمراجعة، الأفواج، الطلاب، المعلمون، الحضور والمتابعة.</span><span class="module-link">الدخول إلى المدرسة ←</span></button><button class="module-card ihsan-module" id="open-ihsan"><span class="module-art ihsan-art" aria-hidden="true"><svg viewBox="0 0 64 64"><path d="M32 7 38 22 54 27 38 33 32 49 26 33 10 27 26 22z"/><path d="M48 40 51 47 58 50 51 53 48 60 45 53 38 50 45 47zM15 7l2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/></svg></span><span class="module-label">منهج الإحسان</span><span class="module-desc">مساحة علمية تجمع معرفة الله تعالى، وسيرة الرسول ﷺ، والقرآن والسنة، والأدب والعمل الصالح.</span><span class="module-link">الدخول إلى المنهج ←</span></button></div><div class="module-about-action"><button type="button" class="btn secondary" id="about-open-hub">رؤية عامة ومميزات الأكاديمية</button></div><p class="module-foot">«وَقُلْ رَبِّ زِدْنِي عِلْمًا»</p>';
$("#about-open-hub")?.addEventListener("click",showAcademyAbout);
$("#open-school").onclick=async()=>{safeStore.setSession("ihsan_last_mode","school");safeStore.setSession("ihsan_last_tab","home");try{history.pushState({ihsanMode:"school",ihsanTab:"home"},"",location.pathname)}catch{}S.mode="school";S.tab="home";await load();shell();await page()};
$("#open-ihsan").onclick=()=>{safeStore.setSession("ihsan_last_mode","ihsan");safeStore.setSession("ihsan_last_tab","all");try{history.pushState({ihsanMode:"ihsan",ihsanTab:"all"},"",location.pathname)}catch{}S.mode="ihsan";S.tab="all";shell();page()}}

function shell(){
 document.body.classList.add("app-authenticated");
 const current=items().find(x=>x[0]===S.tab);
 const currentTitle=current?current[1]:(S.mode==="ihsan"?"منهج الإحسان":"الرئيسية");
 const role=ROLE_LABELS[S.user.role]||"عضو الأكاديمية";
 const initial=esc((S.user.name||"إ").trim().slice(0,1));
 const displayUserName=honorificDisplayName(S.user.name,S.user.role);
 const banner="";
 const options=items().map(x=>'<option value="'+esc(x[1])+'"></option>').join("");
 app.innerHTML='<div class="layout app-shell"><nav class="sidebar" aria-label="القائمة الرئيسية"><div class="sidebar-brand"><span class="sidebar-brand-mark">إ</span><span><strong>أكاديمية الإحسان</strong><small>في بناء الإنسان</small></span></div><div class="sidebar-navigation">'+navMarkup()+'</div><button class="nav-btn mobile-logout" id="mobile-logout" type="button" aria-label="تسجيل الخروج"><span class="nav-icon-wrap" aria-hidden="true">↪</span><span class="nav-label">خروج</span></button><div class="sidebar-bottom"><div class="sidebar-account"><span class="account-mark">'+initial+'</span><span class="account-copy"><strong>'+esc(displayUserName)+'</strong><small>'+esc(role)+'</small></span></div>' +(S.user.role==="admin"?'<button class="admin-focus-toggle" id="admin-focus-toggle" type="button">' +(safeStore.get("ihsan_admin_focus")==="full"?"العودة إلى مهام الشيخ":"واجهة الإدارة") +'</button>':"") +'<button class="module-switch" id="switch-module" type="button"><span aria-hidden="true">↔</span> '+(S.mode==="school"?"الذهاب إلى منهج الإحسان":"الذهاب إلى المدرسة القرآنية")+'</button></div></nav><section class="workspace"><header class="workspace-head"><div class="workspace-heading"><div class="breadcrumbs"><span>الأكاديمية</span><span class="breadcrumb-separator" aria-hidden="true">/</span><strong id="workspace-title">'+esc(currentTitle)+'</strong></div><p>آياتٌ تُتلى وتُتدبّر · هديٌ يُتّبع · علمٌ يزكّي القلب ويهذّب السلوك</p></div><label class="workspace-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/></svg><input id="nav-search" type="search" list="nav-search-options" placeholder="ابحث عن صفحة…" aria-label="ابحث عن صفحة في القائمة"><datalist id="nav-search-options">'+options+'</datalist></label><div class="workspace-user"><span class="workspace-status" aria-hidden="true"></span><span>'+esc(displayUserName)+'</span></div></header><div class="content-area">'+banner+'<section id="view" class="content"><div class="loading">جار التحميل…</div></section></div></section></div>';
 const actionBar=$("#top-actions"),innerHeader=document.querySelector(".workspace-head");if(actionBar&&innerHeader)innerHeader.appendChild(actionBar);
 document.querySelectorAll(".nav-btn[data-tab]").forEach(b=>b.onclick=()=>go(b.dataset.tab));$("#mobile-logout")?.addEventListener("click",logout);
 $("#switch-module")?.addEventListener("click",async()=>{const target=S.mode==="school"?"ihsan":"school";S.mode=target;S.tab=target==="ihsan"?"all":"home";safeStore.setSession("ihsan_last_mode",target);safeStore.setSession("ihsan_last_tab",S.tab);try{history.pushState({ihsanMode:target,ihsanTab:S.tab},"",location.pathname+"#"+encodeURIComponent(S.tab))}catch{}if(target==="school")await load();shell();await page()});
 $("#admin-focus-toggle")?.addEventListener("click",()=>{const next=(safeStore.get("ihsan_admin_focus")==="full"?"daily":"full");safeStore.set("ihsan_admin_focus",next);if(next==="daily"&&["groups","system-check","teachers","backup","audit","school-managers","posts"].includes(S.tab))S.tab="home";shell();page()});
 const search=$("#nav-search");
 search?.addEventListener("keydown",event=>{if(event.key!=="Enter")return;event.preventDefault();const query=search.value.trim().toLocaleLowerCase();const found=items().find(x=>x[1]===search.value.trim())||items().find(x=>x[1].toLocaleLowerCase().includes(query));if(found)go(found[0]);else toast("لم أعثر على صفحة مطابقة",true)});
}

async function curriculumPage(v){
const lessons={
all:["بساتين الإحسان","رحلة علمية وإيمانية تتفتح فيها أبواب المعرفة كما تتفتح البساتين؛ من معرفة الله تعالى إلى صحبة الرسول ﷺ، ومن تدبّر القرآن إلى نور السنة، ثم إلى الأدب والعمل.","سر على مهل بين أبواب هذا المنهج: تعرّف إلى الله تعالى بأسمائه وصفاته كما جاءت في الوحي، واقترب من سيرة نبيه ﷺ وهديه، وأقم مع القرآن تلاوةً وفهمًا وتدبّرًا، واغترف من السنة الصحيحة، ثم اجعل لكل معرفة أثرًا صادقًا في العبادة والرحمة والخلق. لا نريد معلوماتٍ عابرة، بل علمًا يرسخ في القلب ويهدي العمل."],
allah:["معرفة الله تعالى","بابٌ إلى محبة الله وتعظيمه ورجائه؛ نتعرّف إليه من أسمائه الحسنى وآياته في الوحي والخلق.","في هذا البستان نتأمل اسمًا من أسماء الله الحسنى: معناه الثابت بالدليل، وما يدل عليه من كمال الله تعالى، وكيف يزيدنا معرفةً ومحبةً وخشيةً ورجاءً. نستضيء بآية أو حديث صحيح وشرح موثوق، ثم نسأل: ما الأثر الذي ينبغي أن يظهر في دعائي وعبادتي وتوكلي ورحمتي بالخلق؟ لا ننسب إلى الله إلا ما ثبت في القرآن والسنة."],
prophet:["صحبة الرسول ﷺ","نقترب من سيرته وشمائله ومواقفه، ونرى كيف تجلّى الوحي رحمةً وعدلًا وحكمةً في حياته.","نفتح صفحةً موثوقة من السيرة، ونفهم سياقها، ونتأمل ما تكشفه من رحمته ﷺ وشجاعته وتواضعه وعبادته وحسن معاملته. نميّز بين الرواية الثابتة وما لا يصح، ثم نختار هديًا نبويًا يمكن أن نقتدي به في البيت أو المسجد أو الدراسة أو التعامل مع الناس."],
quranpath:["عيون القرآن وتدبّره","مجالس مع كلام الله تعالى: تلاوةٌ صحيحة، وفهمٌ من تفسير موثوق، وتدبّرٌ يقود إلى العمل.","اختر آياتٍ تناسب مستواك، واقرأها بتأنٍّ، وتعلّم مفرداتها وسياقها من تفسير معتبر، ثم استخرج هدايةً دلّ عليها النص. اجمع بين الحفظ والمراجعة والفهم والعمل، ولا تجعل خاطرتك الشخصية تفسيرًا جازمًا للآية. دوّن فائدةً واحدةً وارجع إليها في يومك."],
sunnah:["ينابيع السنة النبوية","أحاديث صحيحة تهدي الفكر والعبادة والمعاملة، مع عنايةٍ بثبوت النص وفهمه.","نقرأ الحديث من مصدره، ونتحقق من درجته ولفظه، ونفهمه بالرجوع إلى شرح موثوق، ونتأمل صلته بالقرآن وباب العلم الذي نتعلمه. ثم نختار فائدةً عمليةً: ذكرًا، أو عبادةً، أو أدبًا، أو حقًا من حقوق الناس، ونراجع أثرها في حياتنا."],
adab:["ثمار العلم في الخُلُق والحياة","حين يستقر العلم في القلب تظهر ثمرته في الصدق والرفق والأمانة والتواضع وحسن المعاملة.","هذا الموضع ليس قائمة شعارات؛ بل تدريبٌ على تحويل المعرفة إلى سلوك. نتعلّم أدب الخلاف، وحقوق الوالدين والجيران والزملاء، وحفظ اللسان والوقت، والرفق بالنفس والخلق. اختر خُلُقًا، وتعرّف إلى دليله، وضع له تطبيقًا واضحًا لهذا الأسبوع، ثم راجع نفسك بلا قسوة ولا ادّعاء."],
hifzprogram:["برنامج الحال المرتحل: من النصف إلى السدس ثم الختم","خطة تشغيلية تمتد ستة أشهر لبناء حفظ القرآن في ستة أسداس، ثم مرحلة تمكين وختم كلي. تجمع بين تثبيت نصف حزب يوميًا، والربط التراكمي على الزميل، والمراجعة العابرة بين السدسين، ومحطات اختبار أمام الشيخ.","المقياس ليس السرعة وحدها؛ بل حفظ متين، وتلاوة سليمة، وتصحيح للأخطاء، ومراجعة مستمرة. أوقات البرنامج أهداف تنظيمية تتغير حسب حال الطالب، ولا يُضحّى بالتجويد أو الصحة لمجرد بلوغ رقم زمني."]
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
if(currentTab==="hifzprogram")html += "<div class=\"hifz-program-stack\"><section class=\"card hifz-program-intro\"><span class=\"eyebrow\">الخريطة الكبرى · الهدف نحو 8 أشهر</span><h3>من 1/20 إلى 20/20، ثم التمكين</h3><p>برنامج لبناء حفظ متين في ستة أسداس، يتبعه شهران مستهدفان للمراجعة والتمكين والختم. تقدّم الطالب مرتبط بالإتقان الفعلي، لا بانقضاء الأيام وحده.</p><div class=\"hifz-stat-grid\"><div><strong>20 نصف حزب</strong><span>في المرحلة الشهرية</span></div><div><strong>10 أحزاب</strong><span>محصول المرحلة</span></div><div><strong>6 مراحل</strong><span>لبلوغ 60 حزبًا</span></div><div><strong>شهران</strong><span>للتمكين والمراجعة</span></div></div></section><section class=\"card\"><h3>أركان المسار</h3><div class=\"hifz-daily-grid\"><article><span class=\"hifz-number\">01</span><h4>تثبيت الجديد</h4><p>يُبنى كل يوم على مقدار مناسب من الحفظ الجديد، مع التكرار حتى يثبت.</p></article><article><span class=\"hifz-number\">02</span><h4>الربط مع الزميل</h4><p>يُربط الجديد بالمحفوظ في المرحلة الجارية، ويُراجع السرد بأمانة قبل محطة الشيخ.</p></article><article><span class=\"hifz-number\">03</span><h4>صيانة القديم</h4><p>تُراجع مواضع التشابه بين المراحل، حتى لا يؤدي التركيز على السدس الجاري إلى إهمال المحفوظ السابق.</p></article></div><div class=\"notice hifz-program-note\"><strong>كيف تُعطى التفاصيل؟</strong><p>لن نضع تفاصيل التكرار والدقائق ومقادير السرد كلها في هذه الصفحة. ستُعرض لاحقًا في المهام اليومية والخطة الأسبوعية، بحسب موضع الطالب ومرحلة تقدمه.</p></div></section><section class=\"card\"><h3>محطات الترحال</h3><p>المحطات الكبرى تقيس ثبات الحفظ وتساعد الشيخ على متابعة الإتقان. أما المحطات الوسيطة فيمكن تهيئتها ومراجعتها مع الزميل، وفق نظام الحلقة.</p><div class=\"hifz-milestone-grid\"><article><span class=\"eyebrow\">التأسيس</span><strong>5 أحزاب</strong><p>اختبار مبكر لسلامة الأساس.</p></article><article><span class=\"eyebrow\">التمكين</span><strong>7.5 أحزاب</strong><p>تثبيت الربط ومعالجة المتشابهات.</p></article><article class=\"hifz-milestone-key\"><span class=\"eyebrow\">بوابة الشيخ</span><strong>10 أحزاب</strong><p>إتمام السدس الأول.</p></article><article class=\"hifz-milestone-key\"><span class=\"eyebrow\">ربع القرآن</span><strong>15 حزبًا</strong><p>محطة إلزامية للتحقق من الثبات.</p></article><article><span class=\"eyebrow\">منتصف الطريق</span><strong>30 حزبًا</strong><p>اختبار نصف القرآن.</p></article><article><span class=\"eyebrow\">ثلاثة الأرباع</span><strong>45 حزبًا</strong><p>اختبار واسع قبل الختم.</p></article><article class=\"hifz-milestone-key\"><span class=\"eyebrow\">التاج</span><strong>60 حزبًا</strong><p>الختم الكلي والتمكين النهائي.</p></article></div><section class=\"hifz-city-journey\" aria-label=\"مدن رحلة القرآن الاختيارية\"><h4>مدن الرحلة الاختيارية</h4><p>محطات تحفيزية رمزية تُفعّل وفق الخطة الأسبوعية، ولا تُعدّ اجتيازًا للحفظ حتى يثبت بالتسميع.</p><div class=\"hifz-city-grid\"><span>مدينة الفاتحين</span><span>مدينة المصابرة</span><span>مدينة الثبات</span><span>مدينة الهدى</span><span>مدينة التقوى</span><span>مدينة الصادقين</span><span>مدينة الأبرار</span></div></section><div class=\"notice hifz-program-note hifz-program-note--info\">تُفصّل متطلبات كل مدينة ومقدارها وموعد اختبارها في الخطة الأسبوعية أو مهمة الطالب ذات الصلة، بدل عرضها كلها دفعة واحدة.</div></section><section class=\"card hifz-program-phases\"><h3>خريطة الأشهر</h3><div class=\"hifz-phase-line\"><div><span>1–6</span><strong>بناء المحفوظ</strong><p>مرحلة لكل سدس، وفق الورد والتقدم الموثّق.</p></div><div><span>7–8</span><strong>التمكين والمراجعة</strong><p>ربط المحفوظ، وإعادة اختبار المواضع الضعيفة، والاستعداد للختم.</p></div></div><p class=\"muted small\">هذه مدة مستهدفة وليست ضمانًا زمنيًا؛ وقد تتغير بحسب جودة الحفظ والحاجة إلى الاستدراك.</p></section><section class=\"card hifz-accountability\"><h3>قاعدة الإتقان</h3><ul><li>لا يتقدم الطالب إلى مقدار جديد إذا لم يثبت المقدار السابق.</li><li>تُصحّح الأخطاء ويُعاد اختبارها، مع تقديم سلامة التلاوة على سرعة الحدر.</li><li>تكون المتابعة والمساءلة بسرية ورفق وحزم، ويُقسّم الاستدراك إلى جلسات معقولة تحفظ الصحة والقدرة على الاستمرار.</li></ul><div class=\"notice hifz-program-note hifz-program-note--important\"><strong>تنبيه في اسم البرنامج:</strong> «الحال المرتحل» اسم تربوي للمسار، وليس تصحيحًا لنسبة الحديث الوارد بهذا اللفظ؛ فقد قال الترمذي عن إسناده إنه «ليس بالقوي».</div></section></div>";
if(trackable)html+='<section class="card curriculum-progress-card"><div class="section-head"><div><h3>متابعة تعلّمك في هذا المحور</h3><p>سجّل الخطوات التي أنجزتها؛ سيُحفظ تقدمك في حسابك.</p></div><span class="progress-count">'+savedSteps.length+' / 3</span></div><form id="curriculum-progress-form" class="stack"><label class="progress-step"><input type="checkbox" name="steps" value="understood" '+(savedSteps.includes("understood")?"checked":"")+'><span><strong>فهمت أصل المسألة</strong><small>أستطيع شرح الفكرة بكلامي.</small></span></label><label class="progress-step"><input type="checkbox" name="steps" value="applied" '+(savedSteps.includes("applied")?"checked":"")+'><span><strong>طبّقت فائدة عملية</strong><small>ربطت ما تعلمته بعمل أو سلوك.</small></span></label><label class="progress-step"><input type="checkbox" name="steps" value="reviewed" '+(savedSteps.includes("reviewed")?"checked":"")+'><span><strong>راجعت ما تعلمته</strong><small>عدت إلى الدرس أو المصدر وثبّت الفائدة.</small></span></label><label class="field">فائدة أريد تذكّرها <textarea name="reflection" maxlength="1200" rows="3" placeholder="اكتب خلاصة قصيرة أو عملًا تنوي المحافظة عليه...">'+esc(saved.reflection||"")+'</textarea></label><div class="student-actions"><button class="btn" type="submit">حفظ تقدمي</button><span class="muted small" id="curriculum-save-status" aria-live="polite">'+(saved.updated_at?"آخر حفظ: "+esc(saved.updated_at):"لم يُسجّل تقدم في هذا المحور بعد.")+'</span></div></form></section>';
html+='<div class="curriculum-tiles"><button class="curriculum-tile" data-lesson="allah"><strong>الله تعالى</strong><span>الأسماء الحسنى والإيمان</span>'+progressBadge(progress,"allah")+'</button><button class="curriculum-tile" data-lesson="prophet"><strong>الرسول ﷺ</strong><span>السيرة والشمائل والاتباع</span>'+progressBadge(progress,"prophet")+'</button><button class="curriculum-tile" data-lesson="quranpath"><strong>القرآن</strong><span>حفظ وفهم وتدبر وعمل</span>'+progressBadge(progress,"quran")+'</button><button class="curriculum-tile" data-lesson="sunnah"><strong>السنة والمتون</strong><span>حديث وعلم شرعي</span>'+progressBadge(progress,"sunnah")+'</button><button class="curriculum-tile" data-lesson="hifzprogram"><strong>برنامج الحال المرتحل</strong><span>خطة الستة أشهر ومحطات الإتقان</span></button><button class="curriculum-tile" data-lesson="adab"><strong>الأدب والعمل</strong><span>أخلاق وتطبيق ومراجعة</span>'+progressBadge(progress,"adab")+'</button>'+custom.map(q=>'<button class="curriculum-tile" data-custom-lesson="'+esc(q.id)+'"><strong>'+esc(q.title)+'</strong><span>'+esc(q.description)+'</span>'+progressBadge(progress,q.id)+'</button>').join("")+'</div>';
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

const head=(a,b)=>'<div class="section-head"><div><h2>'+esc(a)+'</h2><p>'+esc(b)+'</p></div></div>';
const field=(label,name,type="text",min="",placeholder="")=>'<label class="field">'+esc(label)+'<input name="'+esc(name)+'" type="'+esc(type)+'" '+(min?'minlength="'+esc(min)+'"':"")+(placeholder?' placeholder="'+esc(placeholder)+'"':"")+' required></label>';
const groupOpts=()=>S.groups.map(g=>'<option value="'+esc(g.id)+'">'+esc(g.name)+'</option>').join("");
function go(id){if(S.user?.role==="admin"&&id==="groups")safeStore.set("ihsan_admin_focus","full");safeStore.setSession("ihsan_last_mode",S.mode);safeStore.setSession("ihsan_last_tab",id);try{history.pushState({ihsanMode:S.mode,ihsanTab:id},"",location.pathname+"#"+encodeURIComponent(id))}catch{}S.tab=id;shell();page()}
window.addEventListener("popstate",async e=>{if(!S.user)return;const st=e.state||{};if(st.ihsanMode==="hub"){S.mode="hub";moduleChooser(false);return;}if(st.ihsanMode==="school"||st.ihsanMode==="ihsan"){S.mode=st.ihsanMode;S.tab=st.ihsanTab||(S.mode==="ihsan"?"all":"home");if(S.mode==="school")await load();shell();await page();if(st.ihsanSubView==="student-profile")await studentProfile($("#view"),st.studentId);return;}S.mode="hub";moduleChooser(false);});
async function page(){const v=$("#view");if(S.mode==="ihsan")return curriculumPage(v);v.innerHTML='<div class="loading">جار تحميل البيانات…</div>';try{if(S.tab==="system-check"&&S.user.role==="admin")return systemCheckPage(v);if(S.tab==="home")return await home(v);if(S.tab==="teams")return await teamsPage(v);if(S.tab==="groups")return groups(v);if(S.tab==="teachers")return teachers(v);if(S.tab==="students")return students(v);if(S.tab==="attendance")return attendance(v);if(S.tab==="assignments")return await assignmentsPage(v);if(S.tab==="gradebook")return await gradebookPage(v);if(S.tab==="messages")return await messagesPage(v);if(S.tab==="reports")return reportsPage(v);if(S.tab==="leaderboard")return leaderboardPage(v);if(S.tab==="profile")return studentProfile(v,S.user.student_id);if(S.tab==="quran")return quran(v);if(S.tab==="tests")return testsPage(v);if(S.tab==="notifications")return notificationsPage(v);v.innerHTML=head("القسم غير متاح","هذا القسم لم يعد متاحًا. اختر قسمًا من القائمة.")+'<button class="btn" id="back-home">العودة إلى الرئيسية</button>';$("#back-home").onclick=()=>go("home");return}catch(e){v.innerHTML='<div class="panel"><h2>تعذّر تحميل البيانات</h2><p class="notice error">'+esc(e.message)+'</p><button class="btn" id="retry">إعادة المحاولة</button></div>';$("#retry").onclick=page}}
async function home(v){const d=await api("/dashboard");let html="";
if(S.user.role!=="student"){
 const studentLabel=["admin","director"].includes(S.user.role)?"طلابي وطلاب المدرسة":"طلبتي";
 html+='<div class="stats"><button type="button" class="stat stat-link" data-go="students"><span class="stat-icon" aria-hidden="true">'+navIcon("students")+'</span><small>'+studentLabel+'</small><strong>'+d.students_count+'</strong></button><button type="button" class="stat stat-link" data-go="groups"><span class="stat-icon" aria-hidden="true">'+navIcon("groups")+'</span><small>الأفواج</small><strong>'+d.groups_count+'</strong></button><button type="button" class="stat stat-link" data-go="attendance"><span class="stat-icon" aria-hidden="true">'+navIcon("attendance")+'</span><small>سُجّل حضورهم اليوم</small><strong>'+(d.attendance_marked??0)+'</strong></button></div>';
 if(["admin","teacher","director"].includes(S.user.role))html+='<section class="card sheikh-greeting"><span class="eyebrow">رسالة تقدير</span><h3>فضيلة الشيخ، بارك الله تعالى في علمكم وجهدكم</h3><p>نسأل الله تعالى أن ينفع بكم، ويبارك في تعليمكم القرآن وتربية الطلاب، ويجعل ذلك في ميزان حسناتكم.</p></section>';
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
 html+='<div class="student-dashboard">'+(gam?'<section class="card achievement-card"><h3>إنجازك اليوم</h3><p>النقاط: <strong>'+Number(gam.points||0)+'</strong> · أيام متابعة القرآن: <strong>'+Number(gam.stats?.quran_days||0)+'</strong> · الاختبارات: <strong>'+Number(gam.stats?.tests||0)+'</strong></p><p>تحدي اليوم: '+esc(gam.daily_challenge?.title||'ورد اليوم')+' — '+esc(gam.daily_challenge?.description||'اقرأ وردك وراجعه بإتقان.')+'</p><p class="muted small">'+(gam.badges||[]).map(b=>esc(b.name)).join(' · ')+'</p><p class="muted small">القلوب المتبقية اليوم: '+Number(gam.hearts??5)+'</p>'+(gam.challenge_claimed?'<p class="notice">استلمت مكافأة اليوم بالفعل.</p>':'<button class="btn" data-claim-challenge="'+esc(gam.daily_challenge?.id||"daily-quran")+'">استلام مكافأة التحدي</button>')+'</section>': '')+'<div class="card student-welcome"><div class="eyebrow">خطوتك اليوم</div><h3>﴿ وَقُلْ رَبِّ زِدْنِي عِلْمًا ﴾</h3><p>اختر مهمة صغيرة، أنجزها بإتقان، ثم سجّل تقدمك. الاستمرار أهم من كثرة البداية.</p><div class="student-actions"><button class="btn" data-go="quran">متابعة القرآن</button><button class="btn secondary" data-go="tests">ابدأ اختبارًا</button></div></div><section class="card student-adab-card"><h3>أدب الطالب مع فضيلة الشيخ</h3><p>قال الله تعالى حكايةً عن موسى عليه السلام في خطابه للخضر: ﴿هَلْ أَتَّبِعُكَ عَلَى أَنْ تُعَلِّمَنِ مِمَّا عُلِّمْتَ رُشْدًا﴾ [الكهف: 66]. نتعلم منها التواضع والاستئذان وحسن السؤال.</p><p>مثال: «فضيلة الشيخ، أحسن الله إليكم، هل تتكرمون بتوضيح هذه المسألة؟» أنصت للتصحيح، واشكر معلمك، وادعُ له.</p><p><strong>مثال موثّق من سير العلماء:</strong> قال الحسن الزعفراني في ترجمة الإمام الشافعي: «ما قرأت على الشافعي حرفًا من هذه الكتب إلا وأحمد حاضر»؛ أي إن الإمام أحمد كان يحضر مجلس الشافعي ليتعلّم. ونقل الذهبي عن الميموني أن أحمد كان يدعو للشافعي في السَّحر.</p><p class="muted small">المصدر: الذهبي، <em>سير أعلام النبلاء</em>، ترجمة الإمام الشافعي. هذه أخبار تراجم، وليست أحاديث نبوية. ومن الكتب المعروفة في آداب الطلب: <em>جامع بيان العلم وفضله</em> لابن عبد البر، و<em>تذكرة السامع والمتكلم</em> لابن جماعة.</p></section><div class="stats"><div class="stat"><small>متابعات القرآن</small><strong>'+quranRows.length+'</strong></div><div class="stat"><small>سجلات الحضور</small><strong>'+attendanceRows.length+'</strong></div><div class="stat"><small>اختبارات متاحة</small><strong>'+tests.length+'</strong></div><div class="stat"><small>واجبات غير منجزة</small><strong>'+assignments.filter(a=>!a.my_submission||a.my_submission.status!=="reviewed").length+'</strong></div><div class="stat"><small>ترتيب فوجك</small><strong>'+(me?"#"+me.rank:"—")+'</strong></div></div><section class="card path-cards-section"><div class="section-head"><div><h3>مساراتك وبطاقات تقدمك</h3><p>اختر الخطوة التالية، وتابع تقدمك دون مقارنة جائرة بغيرك.</p></div></div><div class="path-cards"><button class="path-card" data-go="quran"><span class="path-icon">۞</span><strong>مسار القرآن</strong><small>'+(gam?.plan?esc(({starter:"المسار التمهيدي","15":"ختمة 15 يومًا","30":"ختمة 30 يومًا","45":"ختمة 45 يومًا",khatma:"الختمة الكاملة"}[gam.plan.path_id]||"خطة القرآن")):"اختر مسار ختمتك")+'</small><span class="path-meter"><i style="width:'+Math.min(100,quranRows.length*5)+'%"></i></span><small>'+quranRows.length+' متابعة مسجلة</small></button><button class="path-card" data-go="tests"><span class="path-icon">✧</span><strong>الاختبارات</strong><small>تعلّم، اختبر، ثم راجع أخطاءك</small><span class="path-meter"><i style="width:'+Math.min(100,tests.length?tests.filter(t=>t.my_attempt).length/tests.length*100:0)+'%"></i></span><small>'+tests.filter(t=>t.my_attempt).length+' من '+tests.length+' مكتمل</small></button><button class="path-card" data-go="assignments"><span class="path-icon">✓</span><strong>واجباتي</strong><small>اطلع على التكليفات وسلّم إجابتك وتابع ملاحظات المعلم</small><span class="path-meter"><i style="width:'+Math.min(100,assignments.length?assignments.filter(a=>a.my_submission&&a.my_submission.status==="reviewed").length/assignments.length*100:0)+'%"></i></span><small>'+assignments.filter(a=>a.my_submission&&a.my_submission.status==="reviewed").length+' من '+assignments.length+' تمت مراجعتها</small></button><button class="path-card" data-open-ihsan><span class="path-icon">'+navIcon("allah")+'</span><strong>تخصصات العلم</strong><small>الله تعالى، الرسول ﷺ، القرآن، السنة، الأدب والعمل</small><span class="path-link">استكشف المسارات ←</span></button></div></section><div class="card"><h3>اقتراح اليوم</h3><p>'+(qToday?'سُجّلت متابعة قرآن اليوم. أحسنت، راجع ما حفظته وثبّته.':"راجع وردك من القرآن، واطلب من معلمك تسجيل الحفظ والمراجعة عند التسميع.")+'</p><p>'+(todayAttendance?'حضور اليوم مسجّل: '+esc(({"present":"حاضر","absent":"غائب","late":"متأخر","excused":"بعذر"}[todayAttendance.status]||todayAttendance.status))+'.':"تحقق من سجل حضورك بعد انتهاء الحلقة.")+'</p><p>'+(unanswered?'لديك '+unanswered+' اختبار/اختبارات لم ترسلها بعد.':'راجع نتائج اختباراتك السابقة إن وُجدت.')+'</p><button class="btn secondary" data-go="profile">عرض ملفي وتقدّمي</button></div></div>';
}
const daySeed=Math.floor(Math.random()*1000000);
const dailySupplications=[
{title:"دعاء من القرآن",text:"وَقُلْ رَبِّ زِدْنِي عِلْمًا",source:"سورة طه: 114"},
{title:"دعاء من القرآن",text:"رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ",source:"سورة البقرة: 201"},
{title:"دعاء من القرآن",text:"رَبَّنَا لَا تُزِغْ قُلُوبَنَا بَعْدَ إِذْ هَدَيْتَنَا وَهَبْ لَنَا مِنْ لَدُنْكَ رَحْمَةً إِنَّكَ أَنْتَ الْوَهَّابُ",source:"سورة آل عمران: 8"},
{title:"دعاء نبوي",text:"اللَّهُمَّ أَعِنِّي عَلَى ذِكْرِكَ وَشُكْرِكَ وَحُسْنِ عِبَادَتِكَ",source:"أبو داود: 1522؛ النسائي: 1303"}
];
const dailyWisdom=[
{title:"أدب الطالب مع شيخه",text:"أين أدبك مع فضيلة الشيخ؟ أنصت، واستأذن قبل السؤال، واشكر التعليم، وادعُ لشيخك. قال موسى للخضر عليهما السلام: ﴿هَلْ أَتَّبِعُكَ عَلَى أَنْ تُعَلِّمَنِ مِمَّا عُلِّمْتَ رُشْدًا﴾ [الكهف: 66]."},
{title:"حسن السؤال",text:"ابدأ سؤالك بأدب، وحدّد ما لم تفهمه، ولا تقاطع معلّمك. التواضع لا يمنع طلب الدليل، بل يحسّن طريقة السؤال."},
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
const dua=dailySupplications[((daySeed%dailySupplications.length)+dailySupplications.length)%dailySupplications.length];
const wisdom=wisdomPool[Math.floor(Math.random()*wisdomPool.length)];
html+='<section class="daily-nourishment-grid"><article class="card daily-nourishment dua-of-day"><div class="daily-kicker">'+esc(dua.title)+'</div><h3>'+esc(dua.text)+'</h3><p class="daily-source">'+esc(dua.source)+'</p></article><article class="card daily-nourishment wisdom-of-day"><div class="daily-kicker">'+esc(wisdom.title)+'</div><p>'+esc(wisdom.text)+'</p><span class="daily-source">'+esc(wisdom.source||"فائدة تربوية من إعداد الأكاديمية، وليست نصًا شرعيًا منقولًا.")+'</span></article></section>';
const quickIds=S.user.role==="admin"?["attendance","quran","tests"]:["teacher","director","supervisor"].includes(S.user.role)?["attendance","quran","tests"]:[];
const quickItems=items().filter(x=>quickIds.includes(x[0]));
if(quickItems.length)html+='<section class="card quick-actions-card"><div class="section-head"><div><h3>خطوات سريعة</h3><p>انتقل مباشرةً إلى أكثر المهام استخدامًا.</p></div></div><div class="quick-actions">'+quickItems.map(x=>'<button class="quick-action" type="button" data-go="'+x[0]+'"><span class="quick-action-icon">'+navIcon(x[0])+'</span><span class="quick-action-copy"><strong>'+esc(x[1])+'</strong><small>فتح القسم</small></span><span class="quick-action-arrow" aria-hidden="true">←</span></button>').join("")+'</div></section>';
v.innerHTML=html;v.querySelectorAll("[data-go]").forEach(b=>{b.onclick=()=>{const next=b.dataset.go;if(S.user.role==="admin"&&next==="groups"&&safeStore.get("ihsan_admin_focus")!=="full")safeStore.set("ihsan_admin_focus","full");go(next)}});v.querySelectorAll("[data-open-ihsan]").forEach(b=>b.onclick=()=>{S.mode="ihsan";S.tab="all";try{history.pushState({ihsanMode:"ihsan",ihsanTab:"all"},"",location.pathname)}catch{}shell();page()});v.querySelectorAll("[data-claim-challenge]").forEach(b=>b.onclick=async()=>{b.disabled=true;try{await api("/gamification/claim",{method:"POST",body:JSON.stringify({challenge_id:b.dataset.claimChallenge})});toast("تم تسجيل إنجازك ومكافأتك اليومية");await page()}catch(e){toast(e.message,true);b.disabled=false}})}
async function groups(v){
const teacherOptions=(selected)=>'<option value="">غير معيّن</option>'+(S.user.role==="admin"?'<option value="'+esc(S.user.id)+'" '+(S.user.id===selected?'selected':'')+'>'+esc(honorificDisplayName(S.user.name,S.user.role))+' — مدير ومعلم</option>':"")+S.teachers.map(t=>'<option value="'+esc(t.id)+'" '+(t.id===selected?'selected':'')+'>'+esc(honorificDisplayName(t.name,"teacher"))+' ('+esc(t.username)+')</option>').join("");
v.innerHTML=head("الأفواج والمعلمون والفرق","تنظيم واحد للأفواج والمعلمين والفرق والإشراف الطلابي.")+(S.user.role==="admin"?'<div class="organization-shortcuts"><button type="button" class="btn secondary" id="open-teachers-panel">إدارة المعلمين وتعيينهم</button><p class="muted small">تُسند مهمة مشرف الفرقة إلى طالب من الفوج نفسه، ويُعيّن كبير المشرفين من الطلبة المسجلين؛ هذا تكليف تنظيمي ولا يمنح صلاحيات إدارية في الحساب.</p></div>':"")+'<div class="card"><form id="gform" class="form-grid"><div class="wide">'+field("اسم الفوج","name")+'</div><label class="field wide">المعلم المسؤول<select name="teacher_id">'+teacherOptions("")+'</select></label><div class="wide"><button class="btn">إضافة الفوج</button></div></form></div><div class="divider"></div><div class="list">'+(S.groups.length?S.groups.map(g=>'<div class="list-row"><div style="flex:1;min-width:220px"><strong>'+esc(g.name)+'</strong><label class="field small">المعلم المسؤول<select data-teacher-for="'+esc(g.id)+'">'+teacherOptions(g.teacher_id)+'</select></label></div><button class="btn" data-save-group="'+esc(g.id)+'">حفظ التعيين</button><button class="btn danger" data-del="'+esc(g.id)+'">إيقاف</button></div>').join(""):'<div class="empty">لا توجد أفواج بعد.</div>')+'</div>'+(S.user.role==="admin"?'<section class="card" id="teachers-inline-panel"></section>':"");
$("#open-teachers-panel")?.addEventListener("click",()=>$("#teachers-inline-panel")?.scrollIntoView({behavior:"smooth",block:"start"}));
if($("#teachers-inline-panel"))await teachers($("#teachers-inline-panel"));
$("#gform").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.currentTarget);try{const result=await api("/groups",{method:"POST",body:JSON.stringify({name:f.get("name"),teacher_id:f.get("teacher_id")})});toast(result?.queued_offline?"حُفظ إنشاء الفوج على هذا الجهاز، وسيتزامن عند عودة الاتصال.":"تمت إضافة الفوج");await load();shell();page()}catch(x){toast(x.message,true)}};
v.querySelectorAll("[data-save-group]").forEach(b=>b.onclick=async()=>{const id=b.dataset.saveGroup,sel=v.querySelector('[data-teacher-for="'+id+'"]');try{const result=await api("/groups/"+encodeURIComponent(id),{method:"PATCH",body:JSON.stringify({teacher_id:sel.value||null})});toast(result?.queued_offline?"حُفظ التعيين على هذا الجهاز، وسيتزامن عند عودة الاتصال.":"تم حفظ تعيين المعلم");await load();shell();page()}catch(x){toast(x.message,true)}});
v.querySelectorAll("[data-del]").forEach(b=>b.onclick=async()=>{if(!confirm("إيقاف الفوج؟"))return;try{await api("/groups/"+b.dataset.del,{method:"DELETE"});await load();shell();page()}catch(x){toast(x.message,true)}});
if(S.user.role!=="admin")return;
let assignments=[];
try{assignments=await api("/admin/student-team-supervisors")}catch(error){toast("تعذّر تحميل تعيينات مشرفي الفرق: "+error.message,true)}
const students=S.students.slice().sort((a,b)=>String(a.name||"").localeCompare(String(b.name||""),"ar"));
const groupName=id=>(S.groups.find(g=>g.id===id)||{}).name||"فوج غير معروف";
const assignmentList=assignments.length?assignments.map(a=>'<div class="list-row"><div><strong>'+esc(groupName(a.group_id))+' · '+esc(a.team_name||"الفرقة الأولى")+'</strong><small>مشرف الفرقة: '+esc(a.supervisor_name||"—")+'</small><small>كبير المشرفين: '+esc(a.head_supervisor_name||"—")+'</small></div><button type="button" class="btn secondary" data-edit-supervision="'+esc(a.id)+'">تعديل الفرقة</button></div>').join(""):'<div class="empty">لم تُنشأ فرق طلابية بعد.</div>';
v.insertAdjacentHTML("beforeend",'<section class="card student-supervisors-section"><div class="section-head"><div><span class="eyebrow">التنظيم الطلابي</span><h3>الفرق ومشرفوها وكبير المشرفين</h3><p>داخل كل فوج فرق صغيرة بأسماء مميزة، ولكل فرقة مشرف من طلاب الفوج نفسه. كبير المشرفين طالب من الفوج يتابع مشرفي الفرق، ولا تُنشأ حسابات جديدة.</p></div></div><form id="student-supervisors-form" class="form-grid"><input type="hidden" id="supervisor-team-id" name="team_id"><label class="field">الفوج<select id="supervisor-group" name="group_id" required><option value="">اختر الفوج</option>'+S.groups.map(g=>'<option value="'+esc(g.id)+'">'+esc(g.name)+'</option>').join("")+'</select></label><label class="field">اسم الفرقة<input id="supervisor-team-name" name="team_name" required maxlength="80" placeholder="مثال: فرقة الهمم"></label><label class="field">مشرف الفرقة من طلبة الفوج<select id="supervisor-student" name="supervisor_student_id" required><option value="">اختر الفوج أولًا</option></select></label><label class="field">كبير المشرفين من طلبة الفوج<select id="head-supervisor-student" name="head_supervisor_student_id" required><option value="">اختر الفوج أولًا</option></select></label><div class="wide form-actions"><button class="btn" type="submit" '+(S.groups.length&&students.length>1?"":"disabled")+' >حفظ الفرقة والتعيين</button><button class="btn secondary" type="button" id="reset-supervision-form">فرقة جديدة</button></div><p class="muted small wide">كبير المشرفين يشرف على مشرفي الفرق فقط؛ ومشرف الفرقة مسؤول عن أعضاء فرقته. لا تتغير حسابات الدخول أو درجات الطلبة بهذا التعيين.</p></form><div class="divider"></div><h3>الفرق والتعيينات الحالية</h3><div class="list" id="student-supervisor-assignment-list">'+assignmentList+'</div></section>');
const groupSelect=$("#supervisor-group"),supervisorSelect=$("#supervisor-student"),headSelect=$("#head-supervisor-student"),assignmentForm=$("#student-supervisors-form"),teamIdInput=$("#supervisor-team-id"),teamNameInput=$("#supervisor-team-name");
function fillStudentOptions(select,groupId,placeholder,selected=""){
 const roster=students.filter(st=>st.group_id===groupId);
 select.innerHTML='<option value="">'+placeholder+'</option>'+roster.map(st=>'<option value="'+esc(st.id)+'">'+esc(st.name)+'</option>').join("");
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
 '<section class="card"><h3>حسابات المعلمين</h3><div class="list">'+(S.teachers.length?S.teachers.map(t=>'<div class="list-row"><div><strong>'+esc(honorificDisplayName(t.name,"teacher"))+'</strong><small>اسم الدخول: '+esc(t.username||"غير متاح")+'</small></div></div>').join(""):'<div class="empty">لا توجد حسابات معلمين بعد.</div>')+'</div></section>';
 $("#tform")?.addEventListener("submit",async e=>{e.preventDefault();const f=new FormData(e.currentTarget),button=e.currentTarget.querySelector('button[type="submit"],button:not([type])');if(button)button.disabled=true;try{await api("/teachers",{method:"POST",body:JSON.stringify({name:f.get("name"),username:f.get("username"),password:f.get("password")})});toast("تم إنشاء حساب المعلم");await load();shell();await page()}catch(err){toast(err.message,true);if(button)button.disabled=false}});
}
async function teamsPage(v){
 const isStudent=S.user.role==="student",isStaff=["admin","teacher","director","supervisor"].includes(S.user.role);
 let groupId=isStudent?"":(S.groups.find(g=>g.id===safeStore.getSession("ihsan_team_group"))?.id||S.groups[0]?.id||"");
 if(!isStudent&&!groupId){v.innerHTML=head("الفرق الطلابية","أنشئ فوجًا أولًا قبل إضافة الفرق وأعضائها.");return}
 v.innerHTML=head(isStudent?"فرقتي وطلبات النقل":"الفرق الطلابية","فوج واحد، فرقة واحدة لكل طالب، والنقل لا يتم إلا بطلب رسمي وموافقة كبير المشرفين.")+'<div class="loading">جار تحميل الفرق والعضوية…</div>';
 try{
  const data=await api("/student-teams"+(isStudent?"":"?group_id="+encodeURIComponent(groupId)));
  let roster=isStaff?await api("/students?group_id="+encodeURIComponent(groupId)):(data.eligible_students||[]);
  const teams=data.teams||[],memberships=data.memberships||[],requests=data.requests||[],supervisorRequests=data.supervisor_requests||[];
  const teamById=new Map(teams.map(t=>[t.id,t]));
  const ownMembership=data.current_membership||memberships.find(m=>m.student_id===data.current_student_id)||null;
  const groupOptions=S.groups.map(g=>'<option value="'+esc(g.id)+'" '+(g.id===groupId?"selected":"")+'>'+esc(g.name)+'</option>').join("");
  const memberRows=memberships.length?memberships.map(m=>'<div class="list-row"><div><strong>'+esc(m.student_name||"طالب")+'</strong><small>'+esc(m.team_name||teamById.get(m.team_id)?.team_name||"فرقة غير معروفة")+'</small></div></div>').join(""):'<div class="empty">لا توجد عضويات ظاهرة في هذا النطاق بعد.</div>';
  const requestRows=requests.length?requests.map(r=>'<div class="list-row"><div style="flex:1;min-width:180px"><strong>'+esc(r.student_name||"طالب")+'</strong><small>'+esc(r.from_team_name||"بلا فرقة")+' ← '+esc(r.target_team_name||"فرقة أخرى")+'</small><small>الحالة: '+esc(({pending:"قيد انتظار موافقة كبير المشرفين",approved:"مقبول",rejected:"مرفوض"})[r.status]||r.status)+'</small></div>'+(data.can_approve_transfers&&r.status==="pending"?'<button class="btn" data-transfer-decision="approve" data-request-id="'+esc(r.id)+'">موافقة</button><button class="btn secondary" data-transfer-decision="reject" data-request-id="'+esc(r.id)+'">رفض</button>':"")+'</div>').join(""):'<div class="empty">لا توجد طلبات نقل ظاهرة.</div>';
  let html='';
  if(isStaff)html+='<section class="card"><label class="field">الفوج<select id="teams-group">'+groupOptions+'</select></label></section>';
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
   html+='<section class="card"><h3>إسناد طالب إلى فرقة</h3><p class="muted small">لا يُضاف الطالب إلى فرقتين. إذا كان مسجلًا في فرقة أخرى، فيلزم طلب نقل رسمي وموافقة كبير المشرفين.</p>'+(assignableTeams.length?'<form id="team-member-form" class="form-grid"><label class="field">الطالب<select name="student_id" required><option value="">اختر طالبًا</option>'+eligible.map(st=>'<option value="'+esc(st.id)+'">'+esc(st.name)+'</option>').join("")+'</select></label><label class="field">الفرقة<select name="team_id" required><option value="">اختر الفرقة</option>'+assignableTeams.map(t=>'<option value="'+esc(t.id)+'">'+esc(t.team_name)+'</option>').join("")+'</select></label><div class="wide"><button class="btn" type="submit">إسناد الطالب</button></div></form>':'<p class="empty">لم تُنشأ فرق أو لم تُعيّن لك فرقة للإشراف.</p>')+'</section>';
  }
  if(supervisorRequests.length||data.can_approve_supervisor_requests) {
   const supervisorRequestRows=supervisorRequests.length?supervisorRequests.map(r=>'<div class="list-row"><div style="flex:1;min-width:180px"><strong>'+esc(r.student_name||"طالب")+'</strong><small>طلب الانضمام إلى مشرفي الفرق</small><small>الحالة: '+esc(({pending:"قيد المراجعة",approved:"معتمد",rejected:"مرفوض"})[r.status]||r.status)+'</small></div>'+(data.can_approve_supervisor_requests&&r.status==="pending"?'<button class="btn" data-supervisor-decision="approve" data-request-id="'+esc(r.id)+'">اعتماد</button><button class="btn secondary" data-supervisor-decision="reject" data-request-id="'+esc(r.id)+'">رفض</button>':"")+'</div>').join(""):'<div class="empty">لا توجد طلبات انضمام معلّقة.</div>';
   html+='<section class="card"><h3>طلبات الانضمام إلى مشرفي الفرق</h3><p class="muted small">يعتمد كبير المشرفين الطلبات قبل تعيين الطالب مشرفًا على فرقة.</p><div class="list">'+supervisorRequestRows+'</div></section>';
  }
  html+='<section class="card"><h3>أعضاء الفرق</h3><div class="list">'+memberRows+'</div></section><section class="card"><h3>طلبات النقل</h3><p class="muted small">كبير المشرفين هو المسؤول عن الموافقة أو الرفض.</p><div class="list">'+requestRows+'</div></section>';
  v.innerHTML=head(isStudent?"فرقتي وطلبات النقل":"الفرق الطلابية",isStudent?"تابع عضويتك واطلب النقل رسميًا عند الحاجة.":"إدارة عضوية الطلبة وطلبات النقل ضمن الفوج المحدد.")+html;
  $("#teams-group")?.addEventListener("change",e=>{safeStore.setSession("ihsan_team_group",e.target.value);teamsPage(v)});
  $("#team-member-form")?.addEventListener("submit",async e=>{e.preventDefault();const f=new FormData(e.currentTarget),button=e.currentTarget.querySelector('button[type="submit"]');button.disabled=true;try{await api("/student-team-memberships",{method:"POST",body:JSON.stringify({student_id:f.get("student_id"),team_id:f.get("team_id")})});toast("تم إسناد الطالب إلى الفرقة");await teamsPage(v)}catch(err){toast(err.message,true);button.disabled=false}});
  $("#request-team-supervisor")?.addEventListener("click",async e=>{const button=e.currentTarget;button.disabled=true;try{await api("/student-team-supervisor-requests",{method:"POST",body:JSON.stringify({})});toast("أُرسل طلب الانضمام إلى كبير المشرفين");await teamsPage(v)}catch(err){toast(err.message,true);button.disabled=false}});
  v.querySelectorAll("[data-supervisor-decision]").forEach(button=>button.addEventListener("click",async()=>{button.disabled=true;try{await api("/student-team-supervisor-requests/"+encodeURIComponent(button.dataset.requestId)+"/decision",{method:"POST",body:JSON.stringify({decision:button.dataset.supervisorDecision})});toast(button.dataset.supervisorDecision==="approve"?"تم اعتماد الطالب ضمن مشرفي الفرق":"تم رفض طلب الانضمام");await teamsPage(v)}catch(err){toast(err.message,true);button.disabled=false}}));
  $("#team-transfer-form")?.addEventListener("submit",async e=>{e.preventDefault();const f=new FormData(e.currentTarget),button=e.currentTarget.querySelector('button[type="submit"]');button.disabled=true;try{await api("/student-team-transfer-requests",{method:"POST",body:JSON.stringify({target_team_id:f.get("target_team_id")})});toast("أُرسل طلب النقل إلى كبير المشرفين");await teamsPage(v)}catch(err){toast(err.message,true);button.disabled=false}});
  v.querySelectorAll("[data-transfer-decision]").forEach(button=>button.addEventListener("click",async()=>{button.disabled=true;try{await api("/student-team-transfer-requests/"+encodeURIComponent(button.dataset.requestId)+"/decision",{method:"POST",body:JSON.stringify({decision:button.dataset.transferDecision})});toast(button.dataset.transferDecision==="approve"?"تمت الموافقة على طلب النقل":"تم رفض طلب النقل");await teamsPage(v)}catch(err){toast(err.message,true);button.disabled=false}}));
 }catch(error){v.innerHTML=head("الفرق الطلابية","تعذر تحميل العضوية أو طلبات النقل.")+'<div class="notice error">'+esc(error.message)+'</div><button class="btn" id="retry-teams">إعادة المحاولة</button>';$("#retry-teams")?.addEventListener("click",()=>teamsPage(v))}
}
function students(v){
const bulkAccountStudentIds=["roster-20261020-01","roster-20261020-04","roster-20261020-05","roster-20261020-07","roster-20261020-09","roster-20261020-11","roster-20261020-13","roster-20261020-14","roster-20261020-15","roster-20261020-16","roster-20261020-18","roster-20261020-19","roster-20261020-20","roster-20261020-22","roster-20261020-23","roster-20261020-24","roster-20261020-26","roster-20261020-27","roster-20261020-28","roster-20261020-29","roster-20261020-30","roster-20261020-32","roster-20261020-33","roster-20261020-35","roster-20261020-36","roster-20261020-37","roster-20261020-38","roster-20261020-39","roster-20261020-42","roster-20261020-43","roster-20261020-44","roster-20261020-46","roster-20261020-47","roster-20261020-48","roster-20261020-49","roster-20261020-50","roster-20261020-51","roster-20261020-53","roster-20261020-54","roster-20261020-55"];
const bulkAccountCandidates=()=>bulkAccountStudentIds.filter(id=>S.students.some(s=>s.id===id&&S.groups.some(g=>g.id===s.group_id)));
const groupName=id=>(S.groups.find(g=>g.id===id)||{}).name||"بلا فوج";
v.innerHTML=head("الطلاب","اختر الفوج لعرض طلابه منفصلين. الحسابات الموجودة تبقى كما هي.")+(S.groups.length?'<div class="card"><form id="sform" class="form-grid"><div>'+field("اسم الطالب الكامل","name")+'</div><div>'+field("كلمة مرور مؤقتة (اختيارية)","password","password","","اتركها فارغة للتوليد الآمن")+'<small class="muted">اتركها فارغة لتوليد كلمة عشوائية آمنة تظهر مرة واحدة.</small></div><label class="field">الفوج<select name="group_id" required><option value="">اختر الفوج</option>'+groupOpts()+'</select></label><div class="wide"><button class="btn">إنشاء حساب طالب</button></div></form></div>':'<div class="notice">أنشئ فوجًا أولًا، ثم أضف الطلاب إليه.</div>')+'<div class="card"><div class="stats roster-account-stats"><div class="stat"><small>ملفات الطلاب</small><strong id="roster-total">0</strong></div><div class="stat"><small>لديهم حساب دخول</small><strong id="roster-linked">0</strong></div><div class="stat"><small>بحاجة إلى حساب</small><strong id="roster-missing">0</strong></div></div><div class="roster-filters"><label class="field">فرز القائمة حسب الفوج<select id="student-group-filter"><option value="all">كل الأفواج — عرض منفصل</option>'+S.groups.slice().sort((a,b)=>a.name.localeCompare(b.name,"ar")).map(g=>'<option value="'+esc(g.id)+'">'+esc(g.name)+'</option>').join("")+'</select></label><label class="field">حالة الحساب<select id="student-login-filter"><option value="all">كل الطلاب</option><option value="missing">بلا حساب دخول</option><option value="linked">لديهم حساب دخول</option></select></label></div>'+(S.user.role==="admin"?'<div class="roster-actions"><button id="bulk-onboard-students" class="btn" type="button" '+(bulkAccountCandidates().length?'':'disabled')+'>تجهيز دخول الأسماء الكاملة ('+bulkAccountCandidates().length+')</button><p class="muted small">إجراء للمدير لإنشاء حسابات الأسماء الكاملة. يحصل كل طالب على كلمة مرور مؤقتة عشوائية وفريدة، ويجب تغييرها عند أول دخول. تُعرض بيانات الدخول مرة واحدة فقط؛ احفظها بأمان. الأسماء غير المكتملة تبقى لائحة اسمية إلى حين استكمال بياناتها.</p></div>':'')+'<p class="muted small">تُنشأ الحسابات للأسماء المحددة فقط. لكل حساب كلمة مرور مؤقتة فريدة ويُفرض تغييرها عند أول دخول. لا تُشارك ملف بيانات الدخول إلا مع صاحب الصلاحية، واحذفه بعد تسليم البيانات للطلاب.</p></div><div id="bulk-onboarding-results" aria-live="polite"></div><div id="students-roster"></div>';
if(S.user.role==="admin")api("/admin/students/bulk-onboarding/status").then(status=>{if(status.completed)document.querySelector(".roster-actions")?.remove()}).catch(()=>{});
const host=$("#students-roster");
function renderRoster(){
const selected=$("#student-group-filter")?.value||"all";
const loginFilter=$("#student-login-filter")?.value||"all";
const matchesLogin=s=>loginFilter==="all"||(loginFilter==="missing"?!s.user_id:!!s.user_id);
$("#roster-total").textContent=String(S.students.length);
$("#roster-linked").textContent=String(S.students.filter(s=>!!s.user_id).length);
$("#roster-missing").textContent=String(S.students.filter(s=>!s.user_id).length);
const groups=S.groups.slice().sort((a,b)=>a.name.localeCompare(b.name,"ar")).filter(g=>selected==="all"||g.id===selected);
let html="";
for(const g of groups){
const list=S.students.filter(s=>s.group_id===g.id&&matchesLogin(s)).slice().sort((a,b)=>String(a.name||"").localeCompare(String(b.name||""),"ar"));
html+='<section class="card"><h3>'+esc(g.name)+' <span class="muted small">('+list.length+')</span></h3><div class="list">'+(list.length?list.map(s=>{const availableGroups=S.groups.filter(x=>x.id!==s.group_id);const actions=S.user.role==="student"?"":'<button class="btn secondary" data-profile-student="'+esc(s.id)+'">ملف الطالب</button>'+(!s.user_id?'<button class="btn" data-create-student-account="'+esc(s.id)+'">إنشاء دخول</button>':'<button class="btn" data-edit-student="'+esc(s.id)+'">تعديل الحساب</button>')+(availableGroups.length?'<span class="move-control"><select data-move-student="'+esc(s.id)+'" aria-label="الفوج الجديد">'+availableGroups.map(g2=>'<option value="'+esc(g2.id)+'">'+esc(g2.name)+'</option>').join("")+'</select><button class="btn secondary" data-save-move="'+esc(s.id)+'">نقل الفوج</button></span>':"")+(s.user_id?'<button class="btn danger" data-del-student="'+esc(s.id)+'">تعطيل</button>':"");return '<div class="list-row student-row"><div><strong>'+esc(s.name)+'</strong><small>'+(s.user_id?'اسم الدخول: '+esc(s.username||"غير متاح"):'قائمة اسمية — بلا حساب دخول')+'</small></div><div class="student-actions">'+actions+'</div></div>'}).join(""):'<div class="empty">لا يوجد طلاب في هذا الفوج.</div>')+'</div></section>';
}
if(selected==="all"){
const ungrouped=S.students.filter(s=>!S.groups.some(g=>g.id===s.group_id)&&matchesLogin(s)).slice().sort((a,b)=>String(a.name||"").localeCompare(String(b.name||""),"ar"));
if(ungrouped.length)html+='<section class="card"><h3>طلاب بلا فوج ('+ungrouped.length+')</h3><div class="list">'+ungrouped.map(s=>'<div class="list-row"><div><strong>'+esc(s.name)+'</strong><small>'+(s.user_id?'اسم الدخول: '+esc(s.username||"غير متاح"):'قائمة اسمية — بلا حساب دخول')+'</small></div></div>').join("")+'</div></section>';
}
host.innerHTML=html||'<div class="empty">لا توجد أفواج لعرضها.</div>';
host.querySelectorAll("[data-profile-student]").forEach(b=>b.onclick=()=>{const id=b.dataset.profileStudent;try{history.pushState({ihsanMode:"school",ihsanTab:"students",ihsanSubView:"student-profile",studentId:id},"",location.pathname+"#student-"+encodeURIComponent(id))}catch{}studentProfile(v,id)});
host.querySelectorAll("[data-create-student-account]").forEach(b=>b.onclick=async()=>{const student=S.students.find(x=>x.id===b.dataset.createStudentAccount);if(!student)return;const username=prompt("اسم الدخول للطالب:",student.name);if(username===null||!username.trim())return;const password=prompt("كلمة مرور مؤقتة (8 أحرف على الأقل):","");if(password===null)return;if(password.length<8)return toast("كلمة المرور يجب أن تكون 8 أحرف على الأقل",true);try{const result=await api("/students/"+encodeURIComponent(student.id)+"/account",{method:"POST",body:JSON.stringify({username:username.trim(),password})});toast("أُنشئ حساب الطالب. اسم الدخول: "+result.username);await load();shell();page()}catch(x){toast(x.message,true)}});
host.querySelectorAll("[data-save-move]").forEach(b=>b.onclick=async()=>{const id=b.dataset.saveMove,select=host.querySelector('[data-move-student="'+id+'"]');if(!select||!select.value)return toast("اختر الفوج الجديد",true);const student=S.students.find(x=>x.id===id);if(!student||student.group_id===select.value)return toast("اختر فوجًا مختلفًا",true);if(!confirm("نقل "+student.name+" إلى الفوج المحدد؟ سيبقى سجل الحفظ والحضور السابق محفوظًا."))return;try{await api("/students/"+encodeURIComponent(id),{method:"PATCH",body:JSON.stringify({group_id:select.value})});toast("تم نقل الطالب مع الاحتفاظ بسجله");await load();shell();page()}catch(x){toast(x.message,true)}});
host.querySelectorAll("[data-edit-student]").forEach(b=>b.onclick=async()=>{const s=S.students.find(x=>x.id===b.dataset.editStudent);if(!s)return;const name=prompt("اسم الطالب الكامل:",s.name);if(name===null)return;const username=prompt("اسم الدخول:",s.username||s.name);if(username===null)return;const password=prompt("كلمة مرور جديدة (اتركها فارغة للإبقاء على الحالية):","");if(password===null)return;try{await api("/students/"+s.id,{method:"PATCH",body:JSON.stringify({name,username,password})});toast("تم تعديل حساب الطالب");await load();shell();page()}catch(x){toast(x.message,true)}});
host.querySelectorAll("[data-del-student]").forEach(b=>b.onclick=async()=>{if(!confirm("تعطيل حساب الطالب؟"))return;try{await api("/students/"+b.dataset.delStudent,{method:"DELETE"});await load();shell();page()}catch(x){toast(x.message,true)}});
}
$("#student-group-filter").onchange=renderRoster;
$("#student-login-filter").onchange=renderRoster;
renderRoster();
$("#bulk-onboard-students")?.addEventListener("click",async()=>{
 const candidateIds=bulkAccountCandidates();
 if(!candidateIds.length)return toast("لا توجد أسماء مكتملة تحتاج إلى حساب دخول.");
 if(!confirm("سيتم تجهيز الأسماء الكاملة الـ"+candidateIds.length+" فقط: إنشاء حسابات للأسماء التي لا تملك حسابًا، وإعادة تعيين كلمة المرور للحسابات المرتبطة بهذه القائمة، ما يجعل كلمات المرور القديمة غير صالحة. سيحصل كل طالب على كلمة مرور عشوائية فريدة ويجب تغييرها عند أول دخول. ستُعرض بيانات الدخول مرة واحدة؛ نزّل الملف واحفظه بأمان. الأسماء المختصرة تبقى لائحة اسمية بلا حساب. متابعة؟"))return;
 const button=$("#bulk-onboard-students");if(button){button.disabled=true;button.textContent="جار إنشاء الحسابات…"}
 try{
  const result=await api("/admin/students/bulk-onboarding",{method:"POST",body:JSON.stringify({student_ids:candidateIds,reset_existing:true})});
  const rows=Array.isArray(result.credentials)?result.credentials:[];
  await load();shell();await page();
  const host=$("#bulk-onboarding-results");if(!host)return;
  document.querySelector(".roster-actions")?.remove();
  host.innerHTML='<section class="card"><h3>بيانات الدخول الجديدة</h3><p class="muted small">نزّل الملف واحفظه بأمان. كلمات المرور لا تُحفظ كنص واضح، ولا يمكن استعادتها بعد إخفاء الشاشة أو تحديثها.</p><p>أُنشئت '+Number(result.created||0)+' حسابات جديدة، وأُعيد تعيين '+Number(result.reset||0)+' حساب موجود، وتجاوز النظام '+Number(result.skipped||0)+' ملفًا.</p>'+(rows.length?'<div class="table-wrap"><table><thead><tr><th>الطالب</th><th>الفوج</th><th>اسم الدخول</th><th>كلمة المرور المؤقتة</th></tr></thead><tbody>'+rows.map(r=>'<tr><td>'+esc(r.name)+'</td><td>'+esc((S.groups.find(g=>g.id===r.group_id)||{}).name||"—")+'</td><td dir="ltr">'+esc(r.username)+'</td><td dir="ltr">'+esc(r.password)+'</td></tr>').join("")+'</tbody></table></div><button id="download-bulk-credentials" class="btn" type="button">تنزيل بيانات الدخول CSV</button> <button id="hide-bulk-credentials" class="btn secondary" type="button">إخفاء كلمات المرور</button>':'')+'</section>';
  $("#download-bulk-credentials")?.addEventListener("click",()=>{
   const csv="\uFEFF"+[["اسم الطالب","الفوج","اسم الدخول","كلمة المرور المؤقتة"],...rows.map(r=>[r.name,(S.groups.find(g=>g.id===r.group_id)||{}).name||"",r.username,r.password])].map(row=>row.map(v=>'"'+String(v??"").replace(/"/g,'""')+'"').join(",")).join("\r\n");
   const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));const link=document.createElement("a");link.href=url;link.download="ihsan-student-login-credentials.csv";document.body.append(link);link.click();link.remove();window.setTimeout(()=>URL.revokeObjectURL(url),1500);
  });
  $("#hide-bulk-credentials")?.addEventListener("click",()=>{$("#bulk-onboarding-results").textContent="أُخفيت كلمات المرور من الشاشة؛ احتفظ بملف التنزيل الآمن."});
  toast("تم تجهيز "+Number(result.created||0)+" حسابًا؛ نزّل بيانات الدخول.");
 }catch(err){toast(err.message,true);const b=$("#bulk-onboard-students");if(b)b.disabled=false}
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
$("#sform")?.addEventListener("submit",async e=>{e.preventDefault();const f=new FormData(e.currentTarget),chosenPassword=String(f.get("password")||"").trim(),alphabet="ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";const password=chosenPassword||Array.from(crypto.getRandomValues(new Uint8Array(18)),n=>alphabet[n%alphabet.length]).join("");const button=e.currentTarget.querySelector("button");if(button)button.disabled=true;try{const created=await api("/students",{method:"POST",body:JSON.stringify({name:f.get("name"),username:String(f.get("name")||"").trim(),password,group_id:f.get("group_id")})});toast("تم إنشاء الطالب؛ اسم الدخول: "+created.username+(chosenPassword?"":"؛ كلمة المرور المؤقتة: "+password+" — احفظها الآن، وسيُطلب تغييرها عند أول دخول."));await load();shell();page()}catch(x){toast(x.message,true);if(button)button.disabled=false}});
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
 else v.innerHTML=head("الحضور","اختر الفوج واليوم من التقويم؛ الأيام الخضراء لها سجلات محفوظة.")+'<div class="card"><div class="attendance-controls"><label class="field">الفوج<select id="ag"><option value="">اختر الفوج</option>'+groupOpts()+'</select></label><label class="field">التاريخ<input id="ad" type="date" value="'+date+'"></label><button id="preview-att" class="btn secondary">معاينة الحضور</button><button id="load-att" class="btn">تسجيل / تعديل الحضور</button></div><div id="date-calendar">'+calendarMarkup(date,[])+'</div><div id="att-list" class="muted small">اختر الفوج والتاريخ ثم اعرض السجل.</div></div>';
 const input=$(student?"#date":"#ad"),cal=$("#date-calendar");
 const redraw=(view)=>{cal.innerHTML=calendarMarkup(input.value,marked,view||cal.querySelector(".date-calendar")?.dataset.viewMonth||input.value.slice(0,7)+"-01")};
 const choose=async d=>{input.value=d;S.date=d;safeStore.set("ihsan_attendance_date",d);if(student){await attendance(v)}else redraw(d.slice(0,7)+"-01")};
 cal.addEventListener("click",async e=>{const b=e.target.closest("button");if(!b)return;if(b.dataset.calMonth){const d=new Date((cal.querySelector(".date-calendar")?.dataset.viewMonth||input.value.slice(0,7)+"-01")+"T12:00:00");d.setMonth(d.getMonth()+Number(b.dataset.calMonth));redraw(d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-01")}else if(b.dataset.calPick)await choose(b.dataset.calPick);else if(b.dataset.calShift){const d=new Date(input.value+"T12:00:00");d.setDate(d.getDate()+Number(b.dataset.calShift));await choose(d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"))}});
 input.addEventListener("change",()=>{if(input.value){S.date=input.value;safeStore.set("ihsan_attendance_date",input.value);if(student)attendance(v);else redraw(input.value.slice(0,7)+"-01")}});
 if(student)return;
 $("#ag").addEventListener("change",async()=>{const g=$("#ag").value;if(!g){marked=[];redraw();return}try{const h=await api("/attendance?group_id="+encodeURIComponent(g)+"&history=1");marked=[...new Set(h.map(r=>r.date).filter(Boolean))];redraw()}catch(e){toast("تعذّر تحميل الأيام المسجّلة: "+e.message,true)}});
 async function showAttendance(edit){const group=$("#ag").value,day=$("#ad").value;if(!group)return toast("اختر الفوج",true);try{const pair=await Promise.all([api("/students?group_id="+encodeURIComponent(group)),api("/attendance?group_id="+encodeURIComponent(group)+"&date="+encodeURIComponent(day))]);const students=pair[0],old={};pair[1].forEach(x=>old[x.student_id]=x);const host=$("#att-list");if(!students.length){host.innerHTML='<div class="empty">لا يوجد طلاب في هذا الفوج.</div>';return}const statusName=x=>({"present":"حاضر","absent":"غائب","late":"متأخر","excused":"بعذر"}[x]||"غير مسجل");if(!edit){host.innerHTML='<div class="card"><h3>معاينة سجل الحضور</h3><p class="muted small">'+esc((S.groups.find(g=>g.id===group)||{}).name||"الفوج")+' · '+esc(day)+' · '+students.length+' طالبًا</p><div class="table-wrap"><table><thead><tr><th>الطالب</th><th>الحالة المسجلة</th><th>الملاحظة</th></tr></thead><tbody>'+students.map(st=>'<tr><td>'+esc(st.name)+'</td><td><span class="pill">'+statusName(old[st.id]?.status)+'</span></td><td>'+esc(old[st.id]?.note||"—")+'</td></tr>').join("")+'</tbody></table></div><p class="muted small">هذه معاينة فقط؛ لم يُحفظ أي تغيير.</p><button id="edit-after-preview" class="btn">تعديل هذا السجل</button></div>';$("#edit-after-preview").onclick=()=>showAttendance(true);return}host.innerHTML='<form id="attform"><p class="muted small">غيّر الحالات ثم اضغط «حفظ الحضور». لن تُحفظ التغييرات قبل الضغط.</p><div class="table-wrap"><table><thead><tr><th>الطالب</th><th>الحالة</th><th>ملاحظة</th></tr></thead><tbody>'+students.map(st=>'<tr><td>'+esc(st.name)+'</td><td><select class="status-select" name="st_'+esc(st.id)+'"><option value="present" '+((old[st.id]?.status||"present")==="present"?"selected":"")+'>حاضر</option><option value="absent" '+(old[st.id]?.status==="absent"?"selected":"")+'>غائب</option><option value="late" '+(old[st.id]?.status==="late"?"selected":"")+'>متأخر</option><option value="excused" '+(old[st.id]?.status==="excused"?"selected":"")+'>بعذر</option></select></td><td><input name="note_'+esc(st.id)+'" value="'+esc(old[st.id]?.note||"")+'" style="width:120px" placeholder="اختياري"></td></tr>').join("")+'</tbody></table></div><button class="btn" style="margin-top:15px">حفظ الحضور</button><button type="button" id="back-preview" class="btn secondary" style="margin:15px 8px 0">رجوع إلى المعاينة</button></form>';$("#back-preview").onclick=()=>showAttendance(false);$("#attform").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.currentTarget),items=students.map(st=>({student_id:st.id,status:f.get("st_"+st.id),note:f.get("note_"+st.id)}));try{const r=await api("/attendance",{method:"POST",body:JSON.stringify({group_id:group,date:day,items})});toast(r.queued_offline?"حُفظ الحضور على هذا الجهاز، وسيتزامن عند عودة الاتصال.":"تم حفظ حضور "+r.saved+" طالبًا");marked=[...new Set([...marked,day])];redraw();showAttendance(false)}catch(x){toast(x.message,true)}}}catch(x){toast(x.message,true)}}
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
async function quran(v){
 const isStudent=S.user.role==="student";
 let levels=[];
 try{const pathData=await api("/quran");levels=pathData.levels||[]}catch{}
 if(isStudent){
  const result=await Promise.allSettled([api("/quran/progress"),api("/quran/plan")]);
  const rows=result[0].status==="fulfilled"?result[0].value:[],plan=result[1].status==="fulfilled"?result[1].value:null;
  v.innerHTML=head("تقدمي في القرآن","مسارك وهدفك الأسبوعي، مع سجل الحفظ والمراجعة والتسميع وتصحيح المعلم.")+quranPlanMarkup(levels,plan,S.user.student_id,true)+quranProgressSummary(rows)+'<section class="card"><h3>سجل الحفظ والمراجعة والتسميع</h3><div class="list">'+(rows.length?rows.map(r=>'<article class="list-row"><div><strong>'+esc(r.date)+' · '+esc(quranActivityName(r.activity))+'</strong><small>الحفظ: '+esc(r.memorized||"—")+' · المراجعة: '+esc(r.reviewed||"—")+' · التسميع: '+esc(r.recitation||"—")+'</small><small>الأخطاء: '+Number(r.errors||0)+' · التقدير: '+(r.grade===null||r.grade===undefined?"—":esc(r.grade+"/10"))+' · التصحيح: '+(r.corrected?"تم":"قيد المتابعة")+'</small><small>ملاحظة المعلم: '+esc(r.feedback||r.notes||"—")+'</small><small>المهمة القادمة: '+esc(r.next_assignment||"—")+'</small></div><span class="pill">متابعة</span></article>').join(""):'<div class="empty">لم تُسجّل متابعة بعد. سيظهر تقدمك هنا عند تسميع القرآن للمعلم.</div>')+'</div></section>';
  wireQuranPlan(v,levels);return;
 }
 v.innerHTML=head("متابعة القرآن","تسجيل مختصر للحفظ من الأثمان أو مراجعتها، مع ترتيب السجل من الأحدث إلى الأقدم.")+
 '<section class="card quran-quick-entry"><form id="qform" class="form-grid"><label class="field wide">الطالب<select name="student_id" required><option value="">اختر الطالب</option>'+S.students.slice().sort((a,b)=>String(a.name||"").localeCompare(String(b.name||""),"ar")).map(st=>'<option value="'+esc(st.id)+'">'+esc(st.name)+' — '+esc((S.groups.find(g=>g.id===st.group_id)||{}).name||"بلا فوج")+'</option>').join("")+'</select></label><label class="field">نوع التسجيل<select name="activity" required><option value="memorization">حفظ ثمن</option><option value="revision">مراجعة ثمن</option></select></label><label class="field">رقم الثمن<input name="thumn" type="number" inputmode="numeric" min="1" max="480" step="1" required placeholder="من 1 إلى 480"></label><label class="field">التاريخ<input name="date" type="date" required value="'+esc(S.date)+'"></label><label class="field wide">ملاحظة مختصرة (اختياري)<input name="notes" maxlength="300" placeholder="موضع يحتاج إلى تثبيت أو تنبيه"></label><div class="wide student-actions"><button class="btn" type="submit">حفظ التسجيل</button></div></form><p class="muted small">رقم الثمن مطلوب من 1 إلى 480. السجلات السابقة محفوظة كما هي.</p></section><section class="card"><div class="section-head"><div><h3>سجل الحفظ والمراجعة</h3><p class="muted small">مرتب من الأحدث إلى الأقدم.</p></div></div><div id="qhistory" class="list"><div class="empty">اختر طالبًا لعرض السجل.</div></div></section>';
 const form=$("#qform"),hist=$("#qhistory"),studentSelect=form.elements.student_id;
 const savedStudent=safeStore.getSession("ihsan_quran_student");
 if(savedStudent&&S.students.some(st=>st.id===savedStudent))studentSelect.value=savedStudent;
 async function refreshHistory(id){
  if(!id){hist.innerHTML='<div class="empty">اختر طالبًا لعرض السجل.</div>';return}
  try{
   const rows=await api("/quran/progress?student_id="+encodeURIComponent(id));
   rows.sort((a,b)=>String(b.date||"").localeCompare(String(a.date||""))||String(b.created_at||"").localeCompare(String(a.created_at||"")));
   hist.innerHTML=rows.length?rows.map(r=>{
    const activity=r.activity==="revision"?"مراجعة ثمن":"حفظ ثمن";
    const amount=r.activity==="revision"?(r.reviewed||"—"):(r.memorized||"—");
    return '<article class="list-row quran-entry-row"><div><strong>'+esc(r.date||"—")+' · '+activity+'</strong><small>'+esc((S.students.find(st=>st.id===r.student_id)||{}).name||"الطالب")+' · '+esc(amount)+'</small>'+(r.notes?'<small>ملاحظة: '+esc(r.notes)+'</small>':"")+'</div><span class="pill">'+activity+'</span></article>';
   }).join(""):'<div class="empty">لا توجد تسجيلات لهذا الطالب حتى الآن.</div>';
  }catch(e){hist.innerHTML='<div class="notice error">'+esc(e.message)+'</div>'}
 }
 studentSelect.onchange=()=>{safeStore.setSession("ihsan_quran_student",studentSelect.value);refreshHistory(studentSelect.value)};
 form.onsubmit=async e=>{
  e.preventDefault();
  const f=new FormData(form),studentId=String(f.get("student_id")||""),number=Number(f.get("thumn")),activity=String(f.get("activity")||"memorization");
  if(!studentId){toast("اختر الطالب أولًا",true);return}
  if(!Number.isInteger(number)||number<1||number>480){toast("رقم الثمن يجب أن يكون بين 1 و480",true);return}
  const amount="الثمن رقم "+number;
  const body={student_id:studentId,date:f.get("date"),activity,memorized:activity==="memorization"?amount:"",reviewed:activity==="revision"?amount:"",recitation:"",errors:0,grade:null,corrected:false,feedback:"",next_assignment:"",notes:String(f.get("notes")||"").trim()};
  const submit=form.querySelector('button[type="submit"]');submit.disabled=true;
  try{
   const saved=await api("/quran/progress",{method:"POST",body:JSON.stringify({...body,group_id:(S.students.find(st=>st.id===studentId)||{}).group_id||""})});
   safeStore.setSession("ihsan_quran_student",studentId);studentSelect.value=studentId;form.elements.thumn.value="";form.elements.notes.value="";form.elements.date.value=S.date;
   toast(saved?.queued_offline?"حُفظ تسجيل القرآن على هذا الجهاز، وسيتزامن عند عودة الاتصال.":"تم حفظ التسجيل");await refreshHistory(studentId);
  }catch(error){toast(error.message,true)}
  finally{submit.disabled=false}
 };
 if(studentSelect.value)await refreshHistory(studentSelect.value);
 else if(S.students.length){studentSelect.value=S.students.slice().sort((a,b)=>String(a.name||"").localeCompare(String(b.name||""),"ar"))[0].id;safeStore.setSession("ihsan_quran_student",studentSelect.value);await refreshHistory(studentSelect.value)}
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
  const data=await Promise.all(jobs),progress=data[0]||[],attendanceRows=data[1]||[],testRows=data[2]||[],profile=data[3]||{};
  const present=attendanceRows.filter(x=>x.status==="present").length,absent=attendanceRows.filter(x=>x.status==="absent").length,late=attendanceRows.filter(x=>x.status==="late").length;
  let html=head("ملخص الطالب",st.name)+'<div class="stats"><div class="stat"><small>سجلات الحضور</small><strong>'+attendanceRows.length+'</strong></div><div class="stat"><small>الحضور</small><strong>'+present+'</strong></div><div class="stat"><small>الغياب</small><strong>'+absent+'</strong></div><div class="stat"><small>التأخر</small><strong>'+late+'</strong></div><div class="stat"><small>متابعات القرآن</small><strong>'+progress.length+'</strong></div><div class="stat"><small>محاولات الاختبارات</small><strong>'+testRows.length+'</strong></div></div><section class="card"><h3>سجل الحضور</h3><div class="list">'+(attendanceRows.length?attendanceRows.slice(0,40).map(r=>'<div class="list-row"><div><strong>'+esc(r.date)+'</strong><small>'+esc(r.note||"")+'</small></div><span class="pill">'+({"present":"حاضر","absent":"غائب","late":"متأخر","excused":"بعذر"}[r.status]||"غير مسجل")+'</span></div>').join(""):'<div class="empty">لا توجد سجلات حضور لهذا الطالب.</div>')+'</div></section><section class="card"><h3>متابعة القرآن</h3><div class="list">'+(progress.length?progress.map(r=>'<div class="list-row"><div><strong>'+esc(r.date)+'</strong><small>الحفظ: '+esc(r.memorized||"—")+' · المراجعة: '+esc(r.reviewed||"—")+' · '+esc(r.notes||"")+'</small></div></div>').join(""):'<div class="empty">لا توجد متابعة قرآنية مسجّلة.</div>')+'</div></section>';
  html+='<section class="card"><h3>نتائج الاختبارات</h3><div class="list">'+(testRows.length?testRows.map(r=>'<div class="list-row"><div><strong>'+esc(r.title||"اختبار")+'</strong><small>'+esc(r.submitted_at||"")+'</small></div><strong>'+r.score+' / '+r.total+'</strong></div>').join(""):'<div class="empty">لا توجد نتائج اختبارات لهذا الطالب.</div>')+'</div></section>';
  if(!isStudent){
   html+='<section class="card"><h3>البيانات الإدارية والدراسية</h3><p class="muted small">تُحفظ هذه البيانات في ملف الطالب ولا تغيّر سجلات الحضور أو الاختبارات.</p><form id="student-profile-form" class="form-grid"><label class="field">رقم هاتف الطالب<input name="phone" maxlength="50" value="'+esc(profile.phone||"")+'"></label><label class="field">طريقة التواصل المفضلة<select name="preferred_contact"><option value="">غير محددة</option>'+["الهاتف","واتساب","ولي الأمر","أخرى"].map(x=>'<option '+(profile.preferred_contact===x?'selected':'')+'>'+x+'</option>').join("")+'</select></label><label class="field">اسم ولي الأمر<input name="guardian_name" maxlength="120" value="'+esc(profile.guardian_name||"")+'"></label><label class="field">هاتف ولي الأمر<input name="guardian_phone" maxlength="50" value="'+esc(profile.guardian_phone||"")+'"></label><label class="field">العمر<input name="age" type="number" min="3" max="100" step="1" value="'+esc(profile.age??"")+'"></label><label class="field">المستوى الدراسي<input name="school_grade" maxlength="120" value="'+esc(profile.school_grade||"")+'"></label><label class="field">المؤسسة التعليمية<input name="school_name" maxlength="160" value="'+esc(profile.school_name||"")+'"></label><label class="field">المعدل من 20<input name="average" type="number" min="0" max="20" step="0.01" value="'+esc(profile.average??"")+'"></label><label class="field wide">ملاحظات إدارية/دراسية<textarea name="notes" rows="3" maxlength="1200">'+esc(profile.notes||"")+'</textarea></label><div class="wide"><button class="btn" type="submit">حفظ بيانات الملف</button><span class="muted small" id="student-profile-status">'+(profile.updated_at?'آخر تحديث: '+esc(profile.updated_at):'لم تُسجّل بيانات إضافية بعد.')+'</span></div></form></section>';
  }
  v.innerHTML=html+'<button id="back-students-bottom" class="btn secondary">العودة إلى قائمة الطلاب</button>';$("#back-students-bottom").onclick=()=>{S.tab="students";shell();page()};
  $("#student-profile-form")?.addEventListener("submit",async e=>{e.preventDefault();const form=e.currentTarget,button=form.querySelector('button[type="submit"]'),f=new FormData(form);if(button){button.disabled=true;button.textContent="جار الحفظ…"}try{const saved=await api("/students/"+encodeURIComponent(st.id)+"/profile",{method:"PATCH",body:JSON.stringify(Object.fromEntries(f.entries()))});const status=$("#student-profile-status");if(status)status.textContent="حُفظت البيانات بنجاح — "+String(saved.updated_at||"");toast("تم حفظ ملف الطالب بنجاح.")}catch(err){toast(err.message,true)}finally{if(button){button.disabled=false;button.textContent="حفظ بيانات الملف"}}});

 }catch(e){v.innerHTML=head("ملف الطالب",st.name)+'<div class="notice error">'+esc(e.message)+'</div><button class="btn secondary" id="back-students">العودة إلى قائمة الطلاب</button>';$("#back-students").onclick=()=>{S.tab="students";shell();page()}}
}
async function reportsPage(v){
 if(S.user.role==="student"){v.innerHTML=head("التقارير","غير مسموح");return}
 v.innerHTML=head("التقارير الأسبوعية","ملخص الحضور لكل طالب في الفوج المحدد، دون حذف السجلات القديمة.")+'<section class="card"><label class="field">الفوج<select id="report-group">'+groupOpts()+'</select></label><button class="btn" id="load-report" style="margin-top:12px">عرض تقرير آخر 7 أيام</button></section><div id="report-result" class="loading">اختر الفوج ثم اعرض التقرير.</div>';
 const render=async()=>{const gid=$("#report-group").value;if(!gid)return toast("اختر الفوج",true);const host=$("#report-result");host.innerHTML='<div class="loading">جار إعداد التقرير…</div>';try{const rows=await api("/attendance?group_id="+encodeURIComponent(gid)+"&history=1");const cutoff=shiftLocalDateISO(localDateISO(),-6);const week=rows.filter(r=>String(r.date)>=cutoff);const students=S.students.filter(st=>st.group_id===gid).slice().sort((a,b)=>String(a.name).localeCompare(String(b.name),"ar"));const count=(id,status)=>week.filter(r=>r.student_id===id&&r.status===status).length;const present=week.filter(r=>r.status==="present").length,absent=week.filter(r=>r.status==="absent").length,late=week.filter(r=>r.status==="late").length,marked=week.length;host.innerHTML='<div class="stats"><div class="stat"><small>سجلات الأسبوع</small><strong>'+marked+'</strong></div><div class="stat"><small>حاضر</small><strong>'+present+'</strong></div><div class="stat"><small>غائب</small><strong>'+absent+'</strong></div><div class="stat"><small>متأخر</small><strong>'+late+'</strong></div></div><section class="card"><h3>تفصيل الطلاب · '+esc(cutoff)+' إلى '+esc(localDateISO())+'</h3><div class="table-wrap"><table><thead><tr><th>الطالب</th><th>حاضر</th><th>غائب</th><th>متأخر</th><th>بعذر</th><th>السجلات</th></tr></thead><tbody>'+students.map(st=>'<tr><td>'+esc(st.name)+'</td><td>'+count(st.id,"present")+'</td><td>'+count(st.id,"absent")+'</td><td>'+count(st.id,"late")+'</td><td>'+count(st.id,"excused")+'</td><td>'+week.filter(r=>r.student_id===st.id).length+'</td></tr>').join("")+'</tbody></table></div></section>'}catch(e){host.innerHTML='<div class="notice error">'+esc(e.message)+'</div>'}};
 $("#load-report").onclick=render;if(S.groups.length)render();
}

async function leaderboardPage(v){
 const isStudent=S.user.role==="student",isAdmin=S.user.role==="admin";
 const staff=["admin","director","teacher","supervisor"].includes(S.user.role);
 let groupId=isStudent?(S.user.group_id||((S.groups[0]||{}).id||"")):(safeStore.getSession("ihsan_leaderboard_group")||((S.groups[0]||{}).id||""));
 const savedScope=safeStore.getSession("ihsan_leaderboard_scope")||"group";
 const selectedScope=isAdmin&&savedScope==="all"?"__all__":groupId;
 const sortOptions=[["points","النتيجة العامة"],["attendance_rate","المواظبة والحضور"],["quran_rate","متابعة القرآن"],["quiz_rate","إتقان الاختبارات"],["challenge_rate","التحديات"]];
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
   if(!rows.length){host.innerHTML='<div class="card empty">لا توجد بيانات كافية للترتيب بعد. يبدأ الترتيب مع تسجيل الحضور ومتابعة القرآن والاختبارات.</div>';return}
   const sorted=rows.slice().sort((a,b)=>Number(b[sortKey]||0)-Number(a[sortKey]||0)||Number(b.points||0)-Number(a.points||0)||String(a.name||"").localeCompare(String(b.name||""),"ar"));
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

async function systemCheckPage(v){
 if(S.user.role!=="admin"){v.innerHTML=head("فحص النظام","هذه الصفحة متاحة للمدير فقط.")+'<div class="notice error">لا تملك صلاحية فحص بيانات النظام.</div>';return}
 v.innerHTML=head("فحص النظام","قراءة تشخيصية لا تعدّل بيانات الطلاب أو الأفواج.")+'<div class="loading">جار فحص سلامة البيانات…</div>';
 try{
  const result=await api("/admin/system-check"),c=result.counts||{};
  const checks=[
   {title:"حساب المدير",value:Number(c.active_admins||0),ok:Number(c.active_admins||0)>0,good:"يوجد مدير نشط",bad:"لا يوجد مدير نشط"},
   {title:"حسابات الطلاب",value:Number(c.active_students||0),ok:Number(c.students_without_login||0)===0,good:"كل ملفات الطلاب مرتبطة بحسابات دخول",bad:Number(c.students_without_login||0)+" ملف طالب بلا حساب دخول"},
   {title:"ارتباط الطلاب بالأفواج",value:Number(c.students_without_active_group||0),ok:Number(c.students_without_active_group||0)===0,good:"كل الطلاب مرتبطون بأفواج نشطة",bad:Number(c.students_without_active_group||0)+" طالب بلا فوج نشط"},
   {title:"تعيين معلمي الأفواج",value:Number(c.groups_without_valid_teacher||0),ok:Number(c.groups_without_valid_teacher||0)===0,good:"كل الأفواج لها معلم صالح",bad:Number(c.groups_without_valid_teacher||0)+" فوج دون معلم صالح"},
   {title:"إعداد المدير الأول",value:result.bootstrap_setup_enabled?"مفعّل":"مغلق",ok:!result.bootstrap_setup_enabled,good:"مسار الإعداد الأولي مغلق",bad:"تحقق من إغلاق الإعداد الأولي"}
  ];
  const roles=Array.isArray(result.roles)?result.roles:[];
  const roleLabel={admin:"المدير",director:"مدير المدرسة",teacher:"المعلم",supervisor:"المشرف",student:"الطالب"};
  v.innerHTML=head("فحص النظام","آخر فحص: "+esc(result.checked_at||"غير متاح"))+
   '<section class="card"><div class="section-head"><div><h3>البيانات الأساسية</h3><p>تتصل الصفحة بقاعدة البيانات الفعلية، وتعرض أعدادًا فقط دون أسماء أو كلمات مرور.</p></div><button class="btn secondary" id="system-check-refresh" type="button">إعادة الفحص</button></div><div class="stats system-check-stats"><div class="stat"><small>حسابات نشطة</small><strong>'+Number(c.active_users||0)+'</strong></div><div class="stat"><small>ملفات الطلاب النشطة</small><strong>'+Number(c.active_students||0)+'</strong></div><div class="stat"><small>السجلات التعليمية</small><strong>'+Number(c.saved_records||0)+'</strong></div><div class="stat"><small>جلسات منتهية</small><strong>'+Number(c.expired_sessions||0)+'</strong></div></div><p class="muted small">التخزين: '+esc(result.storage||"غير معروف")+'</p></section>'+
   '<section class="card"><h3>مؤشرات سلامة النظام</h3><div class="system-check-list">'+checks.map(x=>'<article class="system-check-item '+(x.ok?"is-ok":"is-warning")+'"><span class="system-check-mark" aria-hidden="true">'+(x.ok?"✓":"!")+'</span><div><strong>'+esc(x.title)+'</strong><small>'+esc(x.ok?x.good:x.bad)+'</small></div><span class="system-check-value">'+esc(x.value)+'</span></article>').join("")+'</div></section>'+
   '<section class="card"><h3>توزيع الحسابات حسب الدور</h3><div class="system-role-list">'+(roles.length?roles.map(r=>'<div class="system-role-row"><span>'+esc(roleLabel[r.role]||r.role)+'</span><strong>'+Number(r.total||0)+'</strong></div>').join(""):'<p class="muted">لا توجد حسابات نشطة.</p>')+'</div>'+
   (Number(c.active_director_supervisor_accounts||0)>0?'<div class="notice error">توجد حسابات مدير مدرسة أو مشرف؛ يجب اختبار صلاحياتها وحدود نطاقها قبل الاعتماد.</div>':'<p class="muted small">لا توجد حسابات مدير مدرسة أو مشرف نشطة حاليًا؛ إنشاء هذه الأدوار وتحديد نطاقها ما زال عملًا مستقلًا مطلوبًا قبل استخدامها.</p>')+'</section>'+
   '<section class="card"><h3>السجلات المحفوظة حسب النوع</h3><div class="system-role-list">'+((result.collections||[]).length?result.collections.map(row=>'<div class="system-role-row"><span>'+esc(row.collection)+'</span><strong>'+Number(row.total||0)+'</strong></div>').join(""):'<p class="muted">لا توجد سجلات بعد.</p>')+'</div></section>'+
   '<p class="muted small">هذا فحص للاتساق والأعداد فقط، وليس اختبارًا كاملًا لكل صفحة أو لكل صلاحية.</p>';
  $("#system-check-refresh")?.addEventListener("click",()=>systemCheckPage(v));
 }catch(e){v.innerHTML=head("فحص النظام","تعذّر إكمال الفحص.")+'<div class="notice error">'+esc(e.message)+'</div><button class="btn" id="system-check-retry">إعادة المحاولة</button>';$("#system-check-retry")?.addEventListener("click",()=>systemCheckPage(v))}
}
async function auditPage(v){
 if(S.user.role!=="admin"){v.innerHTML=head("سجل العمليات","هذه الصفحة متاحة للمدير فقط.")+'<div class="notice error">لا تملك صلاحية عرض سجل العمليات.</div>';return}
 v.innerHTML=head("سجل العمليات","مراجعة أحدث العمليات الإدارية لتسهيل تتبع التغييرات.")+'<div class="loading">جار تحميل السجل…</div>';
 try{
  const rows=await api("/admin/audit");
  const labels={login:"تسجيل دخول",logout:"تسجيل خروج",admin_bootstrap:"إنشاء المدير",password_change:"تغيير كلمة المرور",group_create:"إنشاء فوج",group_update:"تعديل فوج",teacher_create:"إنشاء معلم",teacher_update:"تعديل معلم",student_create:"إنشاء طالب",student_update:"تعديل طالب",attendance_save:"حفظ الحضور",quran_progress_add:"إضافة متابعة قرآنية",quran_progress_update:"تعديل متابعة قرآنية",quran_progress_delete:"حذف متابعة قرآنية",test_create:"إنشاء اختبار",test_submit:"تقديم اختبار",post_create:"نشر محتوى",notification_create:"نشر تنبيه",admin_backup_export:"تصدير نسخة احتياطية",admin_backup_full_export:"تصدير نسخة كاملة",admin_backup_restore:"استعادة نسخة",lesson_create:"إضافة درس",lesson_update:"تعديل درس",lesson_delete:"حذف درس"};
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
 '<section class="card stack"><h3>٢. النسخة الكاملة للاستعادة</h3><p>تتضمن كل المستخدمين مع بصمات كلمات المرور، وكل الأفواج والطلاب والسجلات والمدارس وسجل التدقيق. لا تتضمن رموز الجلسات ومحاولات الدخول.</p>'+
 '<div class="notice error">ملف النسخة الكاملة سرّي جدًا: يحوي بصمات كلمات المرور وبيانات الطلاب. لا ترسله لأحد، ولا ترفعه إلى GitHub أو أي موقع عام.</div>'+
 '<button class="btn" id="backup-full-export">تنزيل النسخة الكاملة القابلة للاستعادة</button>'+
 '<p class="muted small">الاستعادة أدناه تدمج البيانات وتحدّث السجلات ذات المعرّفات المطابقة؛ لا تحذف سجلات موجودة خارج الملف. جرّبها أولًا في بيئة منفصلة قبل الاعتماد عليها للطوارئ.</p></section>'+
 '<section class="card stack"><h3>٣. دمج نسخة كاملة محفوظة</h3>'+
 '<label class="field">ملف النسخة الكاملة v2<input id="restore-file" type="file" accept=".json,application/json"></label>'+
 '<div id="restore-preview" class="notice hidden">اختر ملفًا لمعاينة محتوياته.</div>'+
 '<label class="field">اكتب «استعادة» للتأكيد<input id="restore-confirm" autocomplete="off" maxlength="20" placeholder="استعادة"></label>'+
 '<label class="remember-option"><input id="restore-approve" type="checkbox"> أفهم أن الاستعادة تحدّث السجلات المطابقة، ولا تحذف سجلات أخرى.</label>'+
 '<button class="btn" id="restore-submit" disabled>دمج النسخة في قاعدة البيانات</button>'+
 '<p class="muted small">الحد الأقصى للملف 8 ميغابايت. إذا توقفت الاستعادة بعد جزء من الدفعات، أعد المحاولة بالملف نفسه؛ الدمج بمعرّفات ثابتة قابل لإعادة المحاولة.</p></section>';
 const download=(data,name)=>{const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json;charset=utf-8"});const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)};
 $("#backup-export")?.addEventListener("click",async e=>{const b=e.currentTarget;b.disabled=true;b.textContent="جار تجهيز النسخة…";try{const data=await api("/admin/backup/export");download(data,"ihsan-academy-operational-backup-"+localDateISO()+".json");toast("تم تنزيل النسخة التشغيلية؛ احفظها في مكان آمن.")}catch(err){toast(err.message||"تعذّر إنشاء النسخة",true)}finally{if(b.isConnected){b.disabled=false;b.textContent="تنزيل النسخة التشغيلية JSON"}}});
 $("#backup-full-export")?.addEventListener("click",async e=>{const b=e.currentTarget;if(!confirm("النسخة الكاملة تتضمن بصمات كلمات المرور وبيانات الطلاب. هل تريد تنزيلها إلى هذا الجهاز؟"))return;b.disabled=true;b.textContent="جار تجهيز النسخة الكاملة…";try{const data=await api("/admin/backup/full-export");download(data,"ihsan-academy-full-backup-"+localDateISO()+".json");toast("تم تنزيل النسخة الكاملة. احفظها بعيدًا عن المشاركة العامة.")}catch(err){toast(err.message||"تعذّر إنشاء النسخة",true)}finally{if(b.isConnected){b.disabled=false;b.textContent="تنزيل النسخة الكاملة القابلة للاستعادة"}}});
 let restoreBackup=null;
 $("#restore-file")?.addEventListener("change",async e=>{const file=e.currentTarget.files?.[0],info=$("#restore-preview"),submit=$("#restore-submit");restoreBackup=null;submit.disabled=true;info.classList.remove("hidden","error");if(!file){info.textContent="اختر ملفًا لمعاينة محتوياته.";return}if(file.size>8*1024*1024){info.textContent="حجم الملف أكبر من 8 ميغابايت.";info.classList.add("error");return}try{const data=JSON.parse(await file.text());if(data.format!=="ihsan-academy-full-backup-v2"||!data.data){throw Error("هذه ليست نسخة كاملة v2؛ لن يتم إرسال الملف.")}restoreBackup=data;const d=data.data;info.textContent="النسخة صالحة مبدئيًا — الحسابات: "+(d.users?.length||0)+"، الأفواج: "+(d.groups?.length||0)+"، الطلاب: "+(d.students?.length||0)+"، السجلات: "+(d.academy_records?.length||0)+"، المدارس: "+(d.quran_schools?.length||0)+"، عمليات التدقيق: "+(d.audit_log?.length||0)+". فحص العلاقات يتم على الخادم قبل الحفظ.";submit.disabled=false}catch(err){info.textContent=err.message||"تعذر قراءة ملف النسخة.";info.classList.add("error")}});
 $("#restore-submit")?.addEventListener("click",async e=>{e.preventDefault();const b=e.currentTarget;if(!restoreBackup)return toast("اختر نسخة كاملة صالحة أولًا.",true);if($("#restore-confirm")?.value.trim()!=="استعادة")return toast("اكتب كلمة «استعادة» لتأكيد العملية.",true);if(!$("#restore-approve")?.checked)return toast("ضع علامة الموافقة قبل الدمج.",true);if(!confirm("سيُدمج الملف في قاعدة البيانات. السجلات ذات المعرّفات المطابقة ستُحدّث من النسخة، ولن تُحذف بقية السجلات. المتابعة؟"))return;b.disabled=true;b.textContent="جار التحقق والدمج…";try{const result=await api("/admin/backup/restore",{method:"POST",body:JSON.stringify({...restoreBackup,confirm_restore:"RESTORE-IHSAN-ACADEMY"})});toast("تم الدمج: "+(result.restored?.students||0)+" سجل طالب و"+(result.restored?.records||0)+" سجلًا تطبيقيًا.");await backupPage(v)}catch(err){toast(err.message||"تعذّرت الاستعادة",true);b.disabled=false;b.textContent="دمج النسخة في قاعدة البيانات"}});
}
function questionEditor(n){return '<div class="question-builder" data-question><h4>السؤال '+n+'</h4><label class="field">نص السؤال<textarea data-q-prompt required maxlength="500" placeholder="اكتب السؤال هنا"></textarea></label><div class="form-grid">'+[0,1,2,3].map(i=>'<label class="field">الخيار '+(i+1)+'<input data-q-choice="'+i+'" required maxlength="250" placeholder="نص الخيار"></label>').join("")+'</div><label class="field">الإجابة الصحيحة<select data-q-correct><option value="0">الخيار الأول</option><option value="1">الخيار الثاني</option><option value="2">الخيار الثالث</option><option value="3">الخيار الرابع</option></select></label></div>'}
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
  html+='<div class="list">'+(tests.length?tests.map(t=>'<section class="card"><h3>'+esc(t.title)+'</h3><p class="muted small">'+esc(t.description||"")+(t.due_date?' · آخر موعد: '+esc(t.due_date):"")+'</p>'+(t.my_attempt?'<div class="notice">آخر نتيجة: '+t.my_attempt.score+' / '+t.my_attempt.total+' · '+Math.round(100*t.my_attempt.score/Math.max(1,t.my_attempt.total))+'% · '+esc(t.my_attempt.submitted_at||"")+'</div>':"")+'<form class="quiz-form" data-submit-test="'+esc(t.id)+'">'+(t.questions||[]).map((q,qi)=>'<fieldset class="question-view"><legend>'+(qi+1)+'. '+esc(q.prompt)+'</legend>'+(q.choices||[]).map((choice,ci)=>'<label class="quiz-option"><input type="radio" name="q_'+esc(q.id)+'" value="'+ci+'" required> '+esc(choice)+'</label>').join("")+'</fieldset>').join("")+'<button class="btn" type="submit">إرسال الإجابات وتصحيحها</button></form></section>').join(""):'<div class="empty">لا توجد اختبارات منشورة لفوجك حاليًا.</div>')+'</div>';
 }
 let historyRows=[];
 if(isStudent&&S.user.student_id){try{historyRows=await api("/test-history?student_id="+encodeURIComponent(S.user.student_id))}catch{}}
 if(isStudent)html+='<section class="card"><h3>سجل نتائجك</h3><div class="result-list">'+(historyRows.length?historyRows.map(r=>'<div class="list-row"><div><strong>'+esc(r.title||"اختبار")+'</strong><small>'+esc(r.submitted_at||"")+'</small></div><strong>'+Number(r.score||0)+' / '+Number(r.total||0)+' · '+Math.round(Number(r.score||0)*100/Math.max(1,Number(r.total||0)))+'٪</strong></div>').join(""):'<p class="muted">ستظهر نتائجك السابقة هنا بعد إكمال الاختبارات.</p>')+'</div></section>';
 v.innerHTML=html;
 if(!isStudent){
  $("#add-question")?.addEventListener("click",()=>{const host=$("#questions-editor");if(host.querySelectorAll("[data-question]").length>=30)return toast("الحد الأقصى 30 سؤالًا",true);host.insertAdjacentHTML("beforeend",questionEditor(host.querySelectorAll("[data-question]").length+1))});
  $("#test-create-form")?.addEventListener("submit",async e=>{e.preventDefault();const form=e.currentTarget,f=new FormData(form);const questions=[...form.querySelectorAll("[data-question]")].map(q=>({prompt:q.querySelector("[data-q-prompt]").value.trim(),choices:[...q.querySelectorAll("[data-q-choice]")].map(x=>x.value.trim()),correct_index:Number(q.querySelector("[data-q-correct]").value)}));if(questions.some(q=>!q.prompt||q.choices.some(c=>!c))){toast("أكمل نص كل سؤال وخياراته الأربعة",true);return}try{const result=await api("/tests",{method:"POST",body:JSON.stringify({title:f.get("title"),description:f.get("description"),group_id:f.get("group_id"),due_date:f.get("due_date"),recurring:form.elements.recurring.checked,questions})});toast("نُشر الاختبار وحُفظت إجاباته الصحيحة");await load();shell();await page()}catch(x){toast(x.message,true)}});
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
 if(!allowedStaff){v.innerHTML=head("السجل التعليمي","لا يملك هذا الحساب صلاحية عرض السجل التعليمي.")+'<div class="notice">يرجى الدخول بحساب الإدارة أو المعلم.</div>';return}
 const savedGroup=safeStore.get("ihsan_gradebook_group");
 const defaultGroup=S.groups.some(g=>g.id===savedGroup)?savedGroup:(S.groups.length===1?S.groups[0].id:"");
 let html=head("السجل التعليمي","اجمع صورة الطالب في الحضور والقرآن والاختبارات والواجبات دون خلطها في درجة واحدة.")+
  '<section class="card"><form id="gradebook-filter" class="form-grid"><label class="field wide">الفوج<select name="group_id" required><option value="">اختر الفوج</option>'+S.groups.map(g=>'<option value="'+esc(g.id)+'" '+(g.id===defaultGroup?"selected":"")+'>'+esc(g.name)+'</option>').join("")+'</select></label><div class="wide"><button class="btn" type="submit">عرض السجل</button></div></form></section><div id="gradebook-results"></div>';
 v.innerHTML=html;
 const filter=$("#gradebook-filter"),host=$("#gradebook-results");
 const renderRows=data=>{
  const rows=data.students||[];
  if(!rows.length){host.innerHTML='<div class="empty">لا يوجد طلاب نشطون في هذا الفوج.</div>';return}
  const csvRows=[["الطالب","الحضور %","الحاضر","الغائب","المتأخر","بعذر","متابعات القرآن","متوسط القرآن /10","محاولات الاختبار","نتيجة الاختبار %","الواجبات المسلّمة","تمت مراجعتها","بانتظار المراجعة","متوسط الواجبات %"],...rows.map(s=>[s.name,s.attendance.rate??"",s.attendance.present,s.attendance.absent,s.attendance.late,s.attendance.excused,s.quran.sessions,s.quran.average_grade??"",s.tests.attempts,s.tests.percent??"",s.assignments.submitted,s.assignments.reviewed,s.assignments.pending,s.assignments.average_percent??""])];
  const csv="\uFEFF"+csvRows.map(row=>row.map(value=>'"'+String(value??"").replace(/"/g,'""')+'"').join(",")).join("\r\n");
  host.innerHTML='<section class="card"><div class="section-head"><div><h3>سجل الفوج</h3><p class="muted small">'+rows.length+' طالبًا · آخر تحديث '+esc(data.updated_at||"")+'</p></div><button class="btn secondary" id="gradebook-csv" type="button">تصدير CSV</button></div><div class="stats">'+stat("متابعات القرآن",rows.reduce((n,s)=>n+s.quran.sessions,0))+stat("محاولات الاختبار",rows.reduce((n,s)=>n+s.tests.attempts,0))+stat("واجبات بانتظار المراجعة",rows.reduce((n,s)=>n+s.assignments.pending,0))+stat("سجلات الحضور",rows.reduce((n,s)=>n+s.attendance.sessions,0))+'</div><div class="table-wrap"><table><thead><tr><th>الطالب</th><th>الحضور</th><th>القرآن</th><th>الاختبارات</th><th>الواجبات</th><th>تفاصيل</th></tr></thead><tbody>'+rows.map(s=>'<tr><td><strong>'+esc(s.name)+'</strong></td><td>'+formatPercent(s.attendance.rate)+'<small>'+s.attendance.present+' حاضر · '+s.attendance.absent+' غائب</small></td><td>'+s.quran.sessions+' متابعة<small>متوسط '+(s.quran.average_grade===null?"—":esc(s.quran.average_grade)+"/10")+'</small></td><td>'+formatPercent(s.tests.percent)+'<small>'+s.tests.correct+'/'+s.tests.total+' إجابة · '+s.tests.attempts+' محاولات</small></td><td>'+s.assignments.reviewed+'/'+s.assignments.available+' مراجعة<small>'+s.assignments.pending+' بانتظار المعلم</small></td><td><button class="btn secondary" type="button" data-gradebook-student="'+esc(s.student_id)+'">ملف الطالب</button></td></tr>').join("")+'</tbody></table></div></section>';
  $("#gradebook-csv")?.addEventListener("click",()=>{const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));const link=document.createElement("a");link.href=url;link.download="ihsan-gradebook.csv";document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1500)});
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
 html+='<section class="wa-messenger" dir="rtl"><aside class="wa-contact-panel"><div class="wa-panel-head"><div><span class="eyebrow">تواصل المدرسة</span><h3>المحادثات</h3></div><span class="wa-total-badge">'+rows.filter(m=>!m.outgoing&&!m.read_at).length+'</span></div><label class="wa-search"><span aria-hidden="true">⌕</span><input id="wa-contact-search" type="search" placeholder="ابحث عن شخص أو محادثة" aria-label="البحث في المحادثات"></label><div class="wa-contact-list">'+(peopleRows.length?peopleRows.map(p=>'<button type="button" class="wa-contact '+(p.id===selectedId?"active":"")+'" data-wa-contact="'+esc(p.id)+'" data-name="'+esc(p.name.toLocaleLowerCase("ar"))+'"><span class="wa-avatar">'+esc((p.name||"؟").trim().slice(0,1))+'</span><span class="wa-contact-copy"><strong>'+esc(honorificDisplayName(p.name,p.role))+'</strong><small>'+esc(p.lastText||ROLE_LABELS[p.role]||"ابدأ محادثة جديدة")+'</small></span><span class="wa-contact-meta">'+(p.lastAt?'<small>'+esc(p.lastAt.slice(0,10))+'</small>':"")+(p.unread?'<span class="wa-unread">'+p.unread+'</span>':"")+'</span></button>').join(""):'<div class="empty">لا يوجد مستلم متاح. تحقق من الفوج وصلاحيات المراسلة.</div>')+'</div></aside><section class="wa-chat-panel"><header class="wa-chat-head">'+(selected?'<span class="wa-avatar large">'+esc((selected.name||"؟").trim().slice(0,1))+'</span><div class="wa-chat-identity"><h3>'+esc(honorificDisplayName(selected.name,selected.role))+'</h3><p>'+esc(ROLE_LABELS[selected.role]||"مراسلة خاصة داخل الأكاديمية")+'</p></div>':'<div><h3>اختر محادثة</h3><p class="muted">اختر اسمًا من القائمة لبدء المراسلة.</p></div>')+'<button type="button" class="btn secondary" id="wa-refresh">تحديث</button></header><div class="wa-thread" id="wa-thread">'+(selected?(thread.length?thread.map(m=>'<article class="wa-bubble-row '+(m.outgoing?"outgoing":"incoming")+'"><div class="wa-bubble"><p>'+esc(m.content||"")+'</p><div class="wa-bubble-meta"><small>'+esc(m.created_at?new Date(m.created_at).toLocaleString("ar-DZ",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}):"")+'</small>'+(m.outgoing?'<span class="wa-delivery" aria-label="حالة الرسالة">'+(m.read_at?"✓✓":"✓")+'</span>':!m.read_at?'<button type="button" class="wa-mark-read" data-message-read="'+esc(m.id)+'">تحديد كمقروءة</button>':"")+'</div></div></article>').join(""):'<div class="wa-empty"><span aria-hidden="true">✉</span><strong>ابدأ المحادثة</strong><p>اكتب رسالة واضحة ومحترمة، وستظهر هنا في سجل المحادثة.</p></div>'):'<div class="empty">اختر مستلمًا من القائمة.</div>')+'</div>'+(selected?'<form id="private-message-form" class="wa-compose"><input type="hidden" name="recipient_user_id" value="'+esc(selectedId)+'"><input type="hidden" name="title" value="محادثة خاصة"><textarea name="content" maxlength="8000" rows="2" required placeholder="اكتب رسالة…"></textarea><button class="btn" type="submit" aria-label="إرسال الرسالة">إرسال ↗</button><small>الرسائل خاصة بين طرفيها. لا ترسل كلمات المرور أو البيانات الحساسة.</small></form>':'')+'</section></section>';
 v.innerHTML=html;
 const threadHost=$("#wa-thread");if(threadHost)threadHost.scrollTop=threadHost.scrollHeight;
 $("#wa-contact-search")?.addEventListener("input",e=>{const q=String(e.currentTarget.value||"").toLocaleLowerCase("ar");v.querySelectorAll("[data-wa-contact]").forEach(b=>{b.hidden=!String(b.dataset.name||"").includes(q)&&!String(b.textContent||"").toLocaleLowerCase("ar").includes(q)})});
 v.querySelectorAll("[data-wa-contact]").forEach(button=>button.addEventListener("click",()=>{safeStore.setSession("ihsan_message_contact",button.dataset.waContact);page()}));
 $("#wa-refresh")?.addEventListener("click",()=>page());
 v.querySelectorAll("[data-message-read]").forEach(button=>button.addEventListener("click",async()=>{button.disabled=true;try{await api("/messages/read",{method:"POST",body:JSON.stringify({id:button.dataset.messageRead})});await page()}catch(err){toast(err.message,true);button.disabled=false}}));
 $("#private-message-form")?.addEventListener("submit",async e=>{e.preventDefault();const form=e.currentTarget,fd=new FormData(form),button=form.querySelector('button[type="submit"]'),content=String(fd.get("content")||"").trim();if(!content){toast("اكتب الرسالة أولًا",true);return}button.disabled=true;try{await api("/messages",{method:"POST",body:JSON.stringify({recipient_user_id:fd.get("recipient_user_id"),title:fd.get("title")||"محادثة خاصة",content})});toast("أُرسلت الرسالة");await page()}catch(err){toast(err.message,true);button.disabled=false}});
}
async function assignmentsPage(v){
 const isStudent=S.user.role==="student";
 const staff=["admin","director","teacher","supervisor"].includes(S.user.role);
 let rows=[];
 try{rows=await api("/assignments")}catch(e){v.innerHTML=head("الواجبات","تعذّر تحميل الواجبات.")+'<div class="notice error">'+esc(e.message)+'</div>';return}
 let html=head(isStudent?"واجباتي":"الواجبات والتكليفات",isStudent?"أنجز المطلوب بهدوء، ثم أرسل إجابتك ليطلع عليها معلمك.":"أنشئ واجبًا لفوجك، وتابع التسليمات وراجع إجابات الطلاب.");
 if(staff)html+='<section class="card"><h3>إنشاء واجب جديد</h3><form id="assignment-create-form" class="stack"><label class="field">عنوان الواجب<input name="title" required maxlength="180" placeholder="مثال: مراجعة حفظ الأسبوع"></label><label class="field">التعليمات وما المطلوب من الطالب<textarea name="description" required maxlength="5000" rows="4" placeholder="اكتب المطلوب بوضوح، ومقدار العمل المتوقع."></textarea></label><label class="field">الفوج المستهدف<select name="group_id" '+(S.user.role==="admin"?"":"required")+'>'+(S.user.role==="admin"?'<option value="">واجب عام لكل الطلاب</option>':'<option value="">اختر فوجًا</option>')+groupOpts()+'</select></label><div class="form-grid"><label class="field">آخر موعد للتسليم<input name="due_date" type="date"></label><label class="field">الدرجة الكلية<input name="points_total" type="number" min="1" max="1000" value="100" required></label></div><button class="btn" type="submit">نشر الواجب</button><p class="muted small">لن يرى الطالب إلا الواجبات المنشورة له أو لفوجه، ولن يستطيع المعلم مراجعة واجبات فوج خارج نطاقه.</p></form></section><div class="divider"></div>';
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
 $("#assignment-create-form")?.addEventListener("submit",async e=>{e.preventDefault();const form=e.currentTarget,fd=new FormData(form),button=form.querySelector('button[type="submit"]');button.disabled=true;try{await api("/assignments",{method:"POST",body:JSON.stringify({title:fd.get("title"),description:fd.get("description"),group_id:fd.get("group_id"),due_date:fd.get("due_date"),points_total:Number(fd.get("points_total"))})});toast("نُشر الواجب بنجاح");await page()}catch(err){toast(err.message,true);button.disabled=false}});
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

boot();
// Deploy trigger: keep the student entry/exit prayer dialogs in the latest Pages build.
