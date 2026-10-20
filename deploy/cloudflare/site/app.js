let ihsanInstallPrompt=null;
let ihsanGoogleNonce="";
let ihsanGoogleScriptPromise=null;
function ihsanIsInstalled(){return Boolean(window.matchMedia&&window.matchMedia("(display-mode: standalone)").matches)||navigator.standalone===true}
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();ihsanInstallPrompt=e;document.documentElement.classList.add("ihsan-install-available")});
window.addEventListener("appinstalled",()=>{ihsanInstallPrompt=null;const b=document.getElementById("install-app");if(b){b.disabled=true;b.textContent="التطبيق مثبت"}toast("تم تثبيت أكاديمية الإحسان على جهازك.")});
if("serviceWorker" in navigator&&location.protocol==="https:")window.addEventListener("load",()=>navigator.serviceWorker.register("/service-worker.js").catch(()=>{}));
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
    S.token=data.token;S.user=data.user;storeSessionToken(S.token,remember);safeStore.set("ihsan_last_identity",String(data.user?.email||""));if(S.user?.must_change_password){renderTopActions();showPasswordChange(true)}else{await start()}
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
function storeSessionToken(token,remember){if(remember){safeStore.set("ihsan_token",token);safeStore.removeSession("ihsan_token")}else{safeStore.remove("ihsan_token");safeStore.setSession("ihsan_token",token)}}
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
const S={token:safeStore.get("ihsan_token")||safeStore.getSession("ihsan_token"),user:null,tab:"home",mode:"hub",groups:[],students:[],teachers:[],staff:[],schools:[],date:localDateISO()};
const themes=[
{name:"زمردي",green:"#087f5b",mint:"#ddfaed",gold:"#f5b942",paper:"#f2fbf7",ink:"#0d2b22",muted:"#456b5a",line:"#bfe5d1",surface:"#ffffff",surface2:"#eaf8f0"},
{name:"أزرق",green:"#1456c0",mint:"#e2efff",gold:"#ffc857",paper:"#f4f8ff",ink:"#102548",muted:"#49658d",line:"#c5daf9",surface:"#ffffff",surface2:"#edf4ff"},
{name:"بنفسجي",green:"#7440c8",mint:"#f1eaff",gold:"#f3c257",paper:"#faf7ff",ink:"#2e164e",muted:"#70568e",line:"#ddcff7",surface:"#ffffff",surface2:"#f5efff"},
{name:"رملي",green:"#8a4c10",mint:"#fff0dc",gold:"#e9ac32",paper:"#fffbf4",ink:"#3b2917",muted:"#795c3c",line:"#ebd4b5",surface:"#fffefa",surface2:"#fff5e7"}];
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
if(safeStore.get("ihsan_reduce_motion")==="1")document.documentElement.classList.add("ihsan-reduced-motion");
const esc=v=>String(v==null?"":v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
async function api(path,opt={}){const h={"content-type":"application/json",...(S.token?{authorization:"Bearer "+S.token}:{}),...(opt.headers||{})};const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);try{const r=await fetch("/api"+path,{...opt,headers:h,signal:controller.signal});const raw=await r.text();let d;try{d=raw?JSON.parse(raw):{}}catch{const type=r.headers.get("content-type")||"غير محدد";const preview=raw.replace(/\\s+/g," ").slice(0,180);throw Error("رد غير صالح من الخادم — "+r.status+" — نوع المحتوى: "+type+(preview?" — "+preview:" — استجابة فارغة"))}if(!r.ok)throw Error(d.error||("فشل الطلب ("+r.status+")"));return d}catch(e){if(e.name==="AbortError")throw Error("انتهت مهلة الاتصال بالخادم بعد 12 ثانية أثناء انتظار الاستجابة. أعد المحاولة؛ إذا تكرر الأمر فالمشكلة في مسار API أو قاعدة البيانات.");if(e instanceof TypeError)throw Error("تعذّر الاتصال بخادم الأكاديمية. تحقق من الاتصال ثم أعد المحاولة.");throw e}finally{clearTimeout(timer)}}
function toast(t,err=false){const old=$(".toast");if(old)old.remove();const e=document.createElement("div");e.className="toast"+(err?" error":"");e.textContent=t;document.body.append(e);setTimeout(()=>e.remove(),3500)}
function renderTopActions(){
 const installed=ihsanIsInstalled();
 $("#top-actions").innerHTML='<button class="btn secondary" id="settings-open" type="button" aria-label="إعدادات الأكاديمية">الإعدادات</button> <button class="btn secondary install-app-button" id="install-app" type="button" '+(installed?'disabled aria-label="التطبيق مثبت بالفعل"':'aria-label="تثبيت أكاديمية الإحسان على الهاتف"')+'>'+(installed?'التطبيق مثبت':'تثبيت التطبيق')+'</button>'+(S.user?' <button class="btn secondary" id="switch-module-top" type="button">تبديل الواجهة</button> <button class="btn secondary" id="logout" type="button">خروج</button>':"");
 $("#settings-open")?.addEventListener("click",showSettings);$("#switch-module-top")?.addEventListener("click",()=>moduleChooser());$("#logout")?.addEventListener("click",logout);
 $("#install-app")?.addEventListener("click",async()=>{if(ihsanIsInstalled()){toast("أكاديمية الإحسان مثبتة بالفعل على هذا الجهاز.");return}const p=ihsanInstallPrompt;if(!p){showInstallGuide();return}ihsanInstallPrompt=null;try{await p.prompt();const choice=await p.userChoice;if(choice?.outcome==="accepted")toast("اتبع تعليمات المتصفح لإكمال تثبيت الأكاديمية.");else toast("يمكنك التثبيت لاحقًا من قائمة المتصفح.")}catch{showInstallGuide()}});
}
function showSettings(){
 const old=$("#settings-dialog");if(old)old.remove();
 const themeMode=safeStore.get("ihsan_theme_mode")||"random";
 const storedIndex=themeMode==="fixed"?safeStore.get("ihsan_theme_index"):safeStore.getSession("ihsan_session_theme_index");
 const rawIndex=Number(storedIndex||0);
 const selectedIndex=Number.isInteger(rawIndex)&&rawIndex>=0&&rawIndex<themes.length?rawIndex:0;
 const reduced=safeStore.get("ihsan_reduce_motion")==="1";
 const notes=["اللون الأساسي للأكاديمية","أزرق هادئ وواضح","بنفسجي متوازن","رملي دافئ"];
 const themeMarkup=themes.map((t,i)=>'<button type="button" class="theme-choice" data-theme-index="'+i+'" aria-pressed="'+(i===selectedIndex)+'"><span class="theme-swatch theme-swatch-'+i+'" aria-hidden="true"><i></i></span><span class="theme-choice-copy"><strong>'+esc(t.name)+'</strong><small>'+notes[i]+'</small></span><span class="theme-check" aria-hidden="true">✓</span></button>').join("");
 const securityMarkup=S.user?'<section class="settings-section"><div class="settings-section-title"><span class="settings-icon" aria-hidden="true">⌑</span><div><h3>الحساب والأمان</h3><p>احمِ حسابك بكلمة مرور قوية لا تستخدمها في موقع آخر.</p></div></div><div class="student-actions"><button type="button" class="btn" id="settings-password">تغيير كلمة المرور</button><button type="button" class="btn secondary" id="settings-google-link">ربط حساب Google</button></div><div id="settings-google-link-area" class="google-login-section hidden"><div id="settings-google-link-host"></div><p id="settings-google-link-note" class="muted small">اربط حساب Google بعد تسجيل الدخول إلى حسابك الحالي؛ لن يُنشأ حساب طالب جديد.</p></div></section>':'<section class="settings-section"><h3>الحساب والأمان</h3><p class="muted small">سجّل الدخول لإدارة إعدادات حسابك وكلمة المرور.</p></section>';
 const markup='<dialog id="settings-dialog" class="settings-dialog" aria-labelledby="settings-title"><div class="settings-head"><div><span class="eyebrow">تفضيلاتك الشخصية</span><h2 id="settings-title">إعدادات الأكاديمية</h2><p>اضبط الواجهة بما يريحك، وتُحفظ اختياراتك على هذا الجهاز.</p></div><button type="button" class="settings-close" id="settings-close" aria-label="إغلاق الإعدادات">×</button></div><div class="settings-body"><section class="settings-section"><div class="settings-section-title"><span class="settings-icon" aria-hidden="true">◈</span><div><h3>ألوان الواجهة</h3><p>اختر سمة، وستتغيّر ألوان الصفحات والبطاقات معًا.</p></div></div><div class="theme-options">'+themeMarkup+'</div><div class="theme-mode-controls"><button type="button" id="settings-theme-random" class="btn secondary" aria-pressed="'+(themeMode!=="fixed")+'">🎲 عشوائي كل جلسة</button><span class="pill" id="theme-mode-status">'+(themeMode==="fixed"?'السمة المثبتة: '+esc(themes[selectedIndex].name):'يتغيّر اللون تلقائيًا مع كل جلسة جديدة')+'</span></div></section><section class="settings-section"><div class="settings-section-title"><span class="settings-icon" aria-hidden="true">◌</span><div><h3>الحركة والراحة</h3><p>خفّف الحركات الانتقالية إذا فضّلت واجهة أكثر هدوءًا.</p></div></div><label class="settings-preference" for="settings-reduced-motion"><span><strong>تقليل الحركة</strong><small>إيقاف الحركات والزخارف المتحركة غير الضرورية.</small></span><input id="settings-reduced-motion" type="checkbox" '+(reduced?'checked':'')+'></label></section>'+securityMarkup+'</div><div class="settings-foot"><span>أكاديمية الإحسان في بناء الإنسان</span><button type="button" class="btn secondary" id="settings-done">تم</button></div></dialog>';
 document.body.insertAdjacentHTML("beforeend",markup);
 const dialog=$("#settings-dialog");
 const close=()=>{try{if(dialog.open)dialog.close()}catch{}dialog.remove()};
 $("#settings-close").onclick=close;$("#settings-done").onclick=close;
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
    note.textContent="تم ربط Google بهذا الحساب. في المرات القادمة يمكنك الدخول به دون إنشاء حساب جديد.";
    host.innerHTML="";
    toast("تم ربط حساب Google بحساب الأكاديمية الحالي.");
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

function auth(setup){renderTopActions();app.innerHTML='<div class="auth-layout"><section class="welcome"><div><span class="eyebrow">بِسْمِ اللهِ الرَّحْمَنِ الرَّحِيمِ</span><h1>في بساتين الوحي، نتعلّم لنحيا بالقرآن والسنة.</h1><p>رحلة هادئة بين آيات الهداية، وأحاديث النبي ﷺ، ومعاني أسماء الله الحسنى، وسِيَر الصالحين؛ نقرأ ونتدبّر ونسأل ونعمل، حتى يثمر العلم إيمانًا وعبادةً وأدبًا ورحمة.</p></div><div class="verse">﴿ وَقُلْ رَبِّ زِدْنِي عِلْمًا ﴾</div></section><section class="panel stack">'+(setup?'<div class="notice">أول دخول: أنشئ حساب المدير مرة واحدة.</div>':'')+'<div><h2>'+(setup?"إعداد الأكاديمية":"تسجيل الدخول")+'</h2><p class="muted small">'+(setup?"احتفظ برمز الإعداد لنفسك فقط.":"استخدم اسم الدخول أو البريد الذي أنشأه لك المدير.")+'</p></div><form id="auth-form" class="stack">'+(setup?'<label class="field">رمز الإعداد<input name="code" type="password" required autocomplete="off"></label><label class="field">الاسم الكامل<input name="name" required maxlength="120"></label><label class="field">البريد الإلكتروني<input name="email" type="email" required></label><label class="field">كلمة مرور المدير (14 حرفًا على الأقل)<input name="password" type="password" minlength="14" required autocomplete="new-password"></label>':'<label class="field">اسم الدخول أو الاسم الكامل<input name="username" value="'+esc(safeStore.get("ihsan_last_identity"))+'" required autocomplete="username"></label><label class="field">كلمة المرور<input name="password" type="password" required autocomplete="current-password"></label><p class="password-manager-note">يمكنك حفظ كلمة المرور في مدير كلمات مرور المتصفح عند ظهور الطلب؛ الأكاديمية لا تحفظها كنص مكشوف.</p><label class="remember-option"><input name="remember" type="checkbox"> تذكّر دخولي على هذا الجهاز لمدة تصل إلى 30 يومًا. لا تفعّلها على جهاز مشترك.</label>')+'<div id="auth-error" class="notice error hidden"></div><button class="btn" type="submit">'+(setup?"إنشاء حساب المدير":"دخول إلى الأكاديمية")+'</button></form>'+(!setup?'<div class="login-divider"><span>أو</span></div><section class="google-login-section" aria-label="تسجيل الدخول باستخدام Google"><div id="google-signin"></div><p id="google-login-note" class="muted small">جارٍ التحقق من إعدادات الدخول بجوجل…</p></section>':'')+'</section></div>';
$("#auth-form").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.currentTarget),b=e.currentTarget.querySelector("button"),err=$("#auth-error");b.disabled=true;err.classList.add("hidden");try{if(setup){await api("/admin/bootstrap",{method:"POST",headers:{"x-bootstrap-secret":String(f.get("code"))},body:JSON.stringify({name:f.get("name"),email:f.get("email"),password:f.get("password")})});toast("تم إنشاء المدير. سجّل الدخول.");auth(false)}else{const d=await api("/login",{method:"POST",body:JSON.stringify({identity:f.get("username"),password:f.get("password"),remember:f.get("remember")==="on"})});S.token=d.token;S.user=d.user;storeSessionToken(S.token,f.get("remember")==="on");safeStore.set("ihsan_last_identity",String(f.get("username")||""));if(S.user?.must_change_password){renderTopActions();showPasswordChange(true)}else{if("PasswordCredential" in window&&navigator.credentials&&navigator.credentials.store){try{await navigator.credentials.store(new PasswordCredential({id:String(f.get("username")),password:String(f.get("password")),name:d.user?.name||String(f.get("username"))}))}catch{}}await start()}}}catch(x){err.textContent=x.message;err.classList.remove("hidden")}finally{b.disabled=false}}
 if(!setup)initGoogleSignIn();
}
async function boot(){try{const st=await api("/setup/status");if(!S.token){auth(st.needs_admin&&st.setup_enabled);return}try{S.user=await api("/me");if(S.user?.must_change_password){renderTopActions();showPasswordChange(true)}else{await start()}}catch{S.token="";clearSessionToken();auth(st.needs_admin&&st.setup_enabled)}}catch{app.innerHTML='<div class="panel"><h2>تعذّر الاتصال</h2><p class="muted">تعذّر الوصول إلى قاعدة البيانات. حدّث الصفحة بعد قليل.</p><button class="btn" id="boot-retry">إعادة المحاولة</button></div>';$("#boot-retry")?.addEventListener("click",()=>location.reload())}}
async function logout(){const prayers=[
"تقبّل الله منك ما تعلّمت وعملت، وبارك في وقتك، وجعل ما حفظت نورًا لك وحجةً لك لا عليك. نلقاك على خير بإذن الله.",
"انصرفتَ من رحلتك اليوم، فلا تنصرف عن القرآن. اللهم ثبّت قلبك على طاعتك، واجعل القرآن رفيقك في الدنيا والآخرة.",
"أحسنتَ اليوم بخطوة، وغدًا بإذن الله خطوات. اللهم بارك في سعيك، واغفر تقصيرك، وارفع بالقرآن درجتك.",
"حفظك الله أينما كنت، وفتح لك أبواب الخير، وجعل علمك نافعًا وعملك صالحًا، ورزقك الإخلاص والقبول.",
"اللهم استودعناك قلبًا يتعلّم كتابك، فأنر بصيرته، وزكِّ نفسه، وبارك في عمره، واجعل القرآن نور قلبه ودربه."
];const prayer=prayers[Math.floor(Math.random()*prayers.length)];ihsanPrayerDialog({title:"نستودع الله يومك وعملك",text:prayer,icon:"☾",primary:"أستودع الله ديني وأمانتي",secondary:"البقاء في الأكاديمية",onPrimary:async()=>{try{await api("/logout",{method:"POST",body:"{}"})}catch{}try{history.replaceState({ihsanMode:"auth"},"",location.pathname+"#login")}catch{}document.body.classList.remove("app-authenticated");S.token="";S.user=null;S.mode="hub";S.tab="home";clearSessionToken();auth(false)}})}
async function load(){const r=await Promise.allSettled([api("/groups"),api("/students")]);S.groups=r[0].status==="fulfilled"?r[0].value:[];S.students=r[1].status==="fulfilled"?r[1].value:[];if(["admin","director"].includes(S.user.role))try{S.teachers=await api("/teachers")}catch{S.teachers=[]}if(S.user.role==="admin"){const extra=await Promise.allSettled([api("/admin/staff"),api("/public/quran-schools")]);S.staff=extra[0].status==="fulfilled"?extra[0].value:[];S.schools=extra[1].status==="fulfilled"?extra[1].value:[]}}
function items(){
 if(S.mode==="ihsan")return [["all","نظرة عامة"],["allah","معرفة الله"],["prophet","الرسول ﷺ"],["quranpath","القرآن الكريم"],["sunnah","السنة والمتون"],["adab","الأدب والعمل"]];
 if(S.user.role==="admin")return [["home","الرئيسية"],["groups","الأفواج"],["teachers","المعلمون والفريق"],["students","الطلاب"],["attendance","الحضور"],["assignments","الواجبات"],["gradebook","السجل التعليمي"],["reports","التقارير"],["quran","متابعة القرآن"],["tests","الاختبارات"],["posts","مكتبة الشيخ"],["notifications","التنبيهات"],["messages","الرسائل"],["system-check","فحص النظام"]];
 if(S.user.role==="director")return [["home","الرئيسية"],["groups","أفواج المدرسة"],["students","طلاب المدرسة"],["attendance","الحضور"],["assignments","الواجبات"],["gradebook","السجل التعليمي"],["reports","التقارير"],["quran","متابعة القرآن"],["tests","الاختبارات"],["posts","مكتبة الشيخ"],["notifications","التنبيهات"],["messages","الرسائل"]];
 if(S.user.role==="supervisor")return [["home","الرئيسية"],["students","طلاب فريقي"],["attendance","الحضور"],["assignments","الواجبات"],["gradebook","السجل التعليمي"],["reports","التقارير"],["quran","متابعة القرآن"],["tests","الاختبارات"],["posts","مكتبة الشيخ"],["notifications","التنبيهات"],["messages","الرسائل"]];
 if(S.user.role==="teacher")return [["home","الرئيسية"],["students","طلبتي"],["attendance","الحضور"],["assignments","الواجبات"],["gradebook","السجل التعليمي"],["reports","التقارير"],["quran","متابعة القرآن"],["tests","الاختبارات"],["posts","مكتبة الشيخ"],["notifications","التنبيهات"],["messages","الرسائل"]];
 return [["home","الرئيسية"],["profile","ملفي"],["quran","تقدمي في القرآن"],["assignments","واجباتي"],["gradebook","تقدمي ودرجاتي"],["attendance","حضوري"],["tests","اختباراتي"],["posts","مكتبة الشيخ"],["notifications","التنبيهات"],["messages","الرسائل"],["leaderboard","ترتيب الفوج"]];
}
const ROLE_LABELS={admin:"مدير الأكاديمية",director:"مدير المدرسة",teacher:"المعلم",supervisor:"مشرف الفريق",student:"الطالب"};
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
 allah:'<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 0 4 22z"/><path d="M4 18.5A2.5 2.5 0 0 1 6.5 16H20M8 7h8M8 11h6"/>',
 prophet:'<path d="M12 3 14 8l5 2-5 2-2 5-2-5-5-2 5-2z"/><path d="M19 16v5M16.5 18.5h5"/>',
 quranpath:'<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v18H6.5A2.5 2.5 0 0 1 4 17.5z"/><path d="M4 17.5A2.5 2.5 0 0 1 6.5 15H20"/>',
 sunnah:'<path d="M6 3h12v18l-6-4-6 4z"/><path d="m9 9 2 2 4-4"/>',
 adab:'<path d="M12 3 14 9l6 1-4.5 4 1 6-4.5-3-4.5 3 1-6L4 10l6-1z"/>'
};
function navIcon(id){return '<svg viewBox="0 0 24 24" class="nav-icon" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'+(NAV_ICON_PATHS[id]||'<circle cx="12" cy="12" r="8"/>')+'</svg>'}
function navigationGroups(){
 const list=items();if(S.mode==="ihsan")return [{title:"منهج الإحسان",items:list}];
 const makeGroup=(title,ids)=>({title,items:list.filter(x=>ids.includes(x[0]))});
 if(S.user.role==="admin")return [makeGroup("إدارة الأكاديمية",["home","groups","teachers","students","system-check"]),makeGroup("التعليم والمتابعة",["attendance","assignments","gradebook","reports","quran","tests","posts","notifications","messages"])].filter(g=>g.items.length);
 if(["teacher","director","supervisor"].includes(S.user.role))return [makeGroup(S.user.role==="director"?"إدارة المدرسة والمتابعة":S.user.role==="supervisor"?"متابعة الفريق":"التدريس والمتابعة",["home","groups","students","attendance","assignments","gradebook","reports","quran","tests","posts","notifications","messages"])].filter(g=>g.items.length);
 return [makeGroup("رحلتي التعليمية",["home","profile","quran","assignments","gradebook","attendance","tests","posts","notifications","messages","leaderboard"])].filter(g=>g.items.length);
}
function navMarkup(){return navigationGroups().map(group=>'<div class="nav-section"><div class="nav-section-title">'+esc(group.title)+'</div>'+group.items.map(x=>'<button class="nav-btn '+(S.tab===x[0]?"active":"")+'" data-tab="'+esc(x[0])+'"><span class="nav-icon-wrap">'+navIcon(x[0])+'</span><span class="nav-label">'+esc(x[1])+'</span><span class="nav-chevron" aria-hidden="true">‹</span></button>').join("")+'</div>').join("")}

async function ihsanPrayerDialog({title,text,icon="✦",primary="متابعة",secondary="لاحقًا",onPrimary=()=>{},onSecondary=()=>{}}){
 const previous=document.getElementById("ihsan-prayer-dialog");if(previous)previous.remove();
 const dialog=document.createElement("dialog");dialog.id="ihsan-prayer-dialog";dialog.dir="rtl";dialog.style.cssText="width:min(520px,calc(100% - 32px));border:1px solid #bfe5d1;border-radius:24px;padding:0;color:#173d30;background:#fff;box-shadow:0 24px 80px #102b2040";
 if(!document.getElementById("ihsan-prayer-dialog-style")){const style=document.createElement("style");style.id="ihsan-prayer-dialog-style";style.textContent="#ihsan-prayer-dialog::backdrop{background:#10251dcc;backdrop-filter:blur(5px)}";document.head.appendChild(style)}
 const wrap=document.createElement("div");wrap.style.cssText="padding:clamp(22px,5vw,34px);text-align:center";
 const mark=document.createElement("div");mark.textContent=icon;mark.setAttribute("aria-hidden","true");mark.style.cssText="display:grid;place-items:center;width:54px;height:54px;margin:0 auto 15px;border-radius:18px;background:#ddfaed;color:#087f5b;font-size:27px";
 const brand=document.createElement("p");brand.textContent="أكاديمية الإحسان في بناء الإنسان";brand.style.cssText="font-size:12px;color:#456b5a;margin:0 0 8px";
 const h=document.createElement("h2");h.textContent=title;h.style.cssText="font-size:clamp(21px,4vw,27px);line-height:1.5;margin:0 0 12px";
 const p=document.createElement("p");p.textContent=text;p.style.cssText="font-size:16px;line-height:2.05;margin:0 auto 23px;max-width:42ch";
 const actions=document.createElement("div");actions.style.cssText="display:flex;flex-wrap:wrap;gap:10px;justify-content:center";
 const makeButton=(label,primary)=>{const b=document.createElement("button");b.type="button";b.textContent=label;b.style.cssText="min-height:44px;border-radius:12px;padding:10px 18px;cursor:pointer;font:inherit;font-weight:600;border:1px solid "+(primary?"#087f5b":"#bfe5d1")+";background:"+(primary?"#087f5b":"transparent")+";color:"+(primary?"white":"#173d30");return b};
 const yes=makeButton(primary,true),no=makeButton(secondary,false);actions.append(yes,no);wrap.append(mark,brand,h,p,actions);dialog.append(wrap);document.body.append(dialog);
 const close=async fn=>{try{if(dialog.open)dialog.close()}catch{}dialog.remove();await fn()};
 yes.addEventListener("click",()=>close(onPrimary));no.addEventListener("click",()=>close(onSecondary));dialog.addEventListener("cancel",e=>{e.preventDefault();close(onSecondary)});dialog.addEventListener("click",e=>{if(e.target===dialog)close(onSecondary)});
 if(typeof dialog.showModal==="function")dialog.showModal();else dialog.setAttribute("open","");
 yes.focus()
}
function start(){renderTopActions();S.tab="home";S.mode="hub";moduleChooser(false);const prayers=[
["بسم الله نبدأ، وعلى الله نتوكّل","أهلًا بك في أكاديمية الإحسان، حيث نبني بالعلم عقلًا، وبالقرآن قلبًا، وبالأخلاق إنسانًا. نسأل الله أن يبارك في خطاك، ويجعلك مفتاحًا للخير مبارك الأثر."],
["حيّاك الله في رحاب العلم والإحسان","اللهم بارك في يومك، وأنر قلبك بكتابك، وافتح لك أبواب العلم النافع والعمل الصالح، واجعلك من أهل القرآن الذين هم أهل الله وخاصته."],
["أهلًا بك في بساتين الإحسان","اللهم علّمك ما ينفعك، وانفعك بما علّمتك، وزدك علمًا وهدًى، وارزقك فهمًا نافعًا وقلبًا خاشعًا وعملًا متقبّلًا."],
["مرحبًا بك في رحلتك مع القرآن والعلم","اللهم اجعل القرآن ربيع قلبك ونور صدرك، وذهاب همّك، وارزقك الإخلاص والقبول، واجعل كل خطوة في طلب العلم رفعةً لك."],
["بداية جديدة وأجر نرجوه من الله","استعن بالله ولا تعجز. اللهم بارك في وقتك وسعيك، واشرح صدرك، وثبّت حفظك، وحسّن خُلُقك، واجعل علمك حجةً لك لا عليك."]
];const prayer=prayers[Math.floor(Math.random()*prayers.length)];ihsanPrayerDialog({title:prayer[0],text:prayer[1],icon:"☀",primary:"ابدأ رحلتي",secondary:"لاحقًا"})}
function moduleChooser(push=true){document.body.classList.remove("app-authenticated");const outerHeader=document.querySelector("header.topbar"),actionBar=$("#top-actions");if(outerHeader&&actionBar&&!outerHeader.contains(actionBar))outerHeader.appendChild(actionBar);S.mode="hub";if(push){try{history.pushState({ihsanMode:"hub"},"",location.pathname+"#home")}catch{}}document.body.classList.remove("app-authenticated");renderTopActions();app.innerHTML='<section class="module-welcome"><span class="eyebrow">أَكَادِيمِيَّةُ الإِحْسَانِ فِي بِنَاءِ الإِنْسَان</span><h1>تجوّل في بساتين الإحسان</h1><p>من هنا تبدأ رحلتان متكاملتان: مدرسةٌ تحفظ القرآن وتتابع الحفظ والمراجعة، وبساتينُ علمٍ تتفيّأ ظلال الوحي؛ تتعرّف فيها إلى ربك تعالى، وتصحب سيرة رسوله ﷺ، وتفتح نوافذ التدبّر في القرآن، وتنهل من السنة، ثم ترى أثر العلم في عبادتك وخُلُقك ومعاملتك.</p></section><div class="module-grid"><button class="module-card school-module" id="open-school"><span class="module-symbol">⌂</span><span class="module-label">المدرسة القرآنية</span><span class="module-desc">الحفظ والمراجعة، الأفواج، الطلاب، المعلمون، الحضور والمتابعة.</span><span class="module-link">الدخول إلى المدرسة ←</span></button><button class="module-card ihsan-module" id="open-ihsan"><span class="module-symbol">✦</span><span class="module-label">منهج الإحسان</span><span class="module-desc">رحلة تعلّم لبناء المعرفة والإيمان والأدب والعمل الصالح خطوةً خطوة.</span><span class="module-link">الدخول إلى المنهج ←</span></button></div><p class="module-foot">«وَقُلْ رَبِّ زِدْنِي عِلْمًا»</p>';
$("#open-school").onclick=async()=>{try{history.pushState({ihsanMode:"school",ihsanTab:"home"},"",location.pathname)}catch{}S.mode="school";S.tab="home";await load();shell();await page()};
$("#open-ihsan").onclick=()=>{try{history.pushState({ihsanMode:"ihsan",ihsanTab:"all"},"",location.pathname)}catch{}S.mode="ihsan";S.tab="all";shell();page()}}

function shell(){
 document.body.classList.add("app-authenticated");
 const current=items().find(x=>x[0]===S.tab);
 const currentTitle=current?current[1]:(S.mode==="ihsan"?"منهج الإحسان":"الرئيسية");
 const role=ROLE_LABELS[S.user.role]||"عضو الأكاديمية";
 const initial=esc((S.user.name||"إ").trim().slice(0,1));
 const banner=S.tab==="home"&&S.mode!=="ihsan"?'<div class="hero workspace-banner"><div><span class="eyebrow">أَكَادِيمِيَّةُ الإِحْسَانِ فِي بِنَاءِ الإِنْسَان</span><h2>مرحبًا، '+esc(S.user.name)+'</h2><p>'+(S.user.role==="admin"?"إدارة واضحة، متابعة دقيقة، وخطوات عملية.":S.user.role==="teacher"?"متابعة الطلبة والحضور والتقدم في الحفظ.":S.user.role==="director"?"صورة أوضح عن المدرسة، أفواجها، وتقدّم طلابها.":S.user.role==="supervisor"?"خطوات واضحة لمتابعة فريقك وخدمة زملائك.":"خطوة صغيرة ثابتة اليوم تصنع فرقًا مع الوقت.")+'</p></div></div>':'';
 const options=items().map(x=>'<option value="'+esc(x[1])+'"></option>').join("");
 app.innerHTML='<div class="layout app-shell"><nav class="sidebar" aria-label="القائمة الرئيسية"><div class="sidebar-brand"><span class="sidebar-brand-mark">إ</span><span><strong>أكاديمية الإحسان</strong><small>في بناء الإنسان</small></span></div><div class="sidebar-navigation">'+navMarkup()+'</div><button class="nav-btn mobile-logout" id="mobile-logout" type="button" aria-label="تسجيل الخروج"><span class="nav-icon-wrap" aria-hidden="true">↪</span><span class="nav-label">خروج</span></button><div class="sidebar-bottom"><div class="sidebar-account"><span class="account-mark">'+initial+'</span><span class="account-copy"><strong>'+esc(S.user.name)+'</strong><small>'+esc(role)+'</small></span></div><button class="module-switch" id="switch-module" type="button"><span aria-hidden="true">↔</span> تبديل الواجهة</button></div></nav><section class="workspace"><header class="workspace-head"><div class="workspace-heading"><div class="breadcrumbs"><span>الأكاديمية</span><span class="breadcrumb-separator" aria-hidden="true">/</span><strong id="workspace-title">'+esc(currentTitle)+'</strong></div><p>آياتٌ تُتلى وتُتدبّر · هديٌ يُتّبع · علمٌ يزكّي القلب ويهذّب السلوك</p></div><label class="workspace-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/></svg><input id="nav-search" type="search" list="nav-search-options" placeholder="ابحث عن صفحة…" aria-label="ابحث عن صفحة في القائمة"><datalist id="nav-search-options">'+options+'</datalist></label><div class="workspace-user"><span class="workspace-status" aria-hidden="true"></span><span>'+esc(S.user.name)+'</span></div></header><div class="content-area">'+banner+'<section id="view" class="content"><div class="loading">جار التحميل…</div></section></div></section></div>';
 const actionBar=$("#top-actions"),innerHeader=document.querySelector(".workspace-head");if(actionBar&&innerHeader)innerHeader.appendChild(actionBar);
 document.querySelectorAll(".nav-btn[data-tab]").forEach(b=>b.onclick=()=>go(b.dataset.tab));$("#mobile-logout")?.addEventListener("click",logout);
 $("#switch-module")?.addEventListener("click",moduleChooser);
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
adab:["ثمار العلم في الخُلُق والحياة","حين يستقر العلم في القلب تظهر ثمرته في الصدق والرفق والأمانة والتواضع وحسن المعاملة.","هذا الموضع ليس قائمة شعارات؛ بل تدريبٌ على تحويل المعرفة إلى سلوك. نتعلّم أدب الخلاف، وحقوق الوالدين والجيران والزملاء، وحفظ اللسان والوقت، والرفق بالنفس والخلق. اختر خُلُقًا، وتعرّف إلى دليله، وضع له تطبيقًا واضحًا لهذا الأسبوع، ثم راجع نفسك بلا قسوة ولا ادّعاء."]
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
if(trackable)html+='<section class="card curriculum-progress-card"><div class="section-head"><div><h3>متابعة تعلّمك في هذا المحور</h3><p>سجّل الخطوات التي أنجزتها؛ سيُحفظ تقدمك في حسابك.</p></div><span class="progress-count">'+savedSteps.length+' / 3</span></div><form id="curriculum-progress-form" class="stack"><label class="progress-step"><input type="checkbox" name="steps" value="understood" '+(savedSteps.includes("understood")?"checked":"")+'><span><strong>فهمت أصل المسألة</strong><small>أستطيع شرح الفكرة بكلامي.</small></span></label><label class="progress-step"><input type="checkbox" name="steps" value="applied" '+(savedSteps.includes("applied")?"checked":"")+'><span><strong>طبّقت فائدة عملية</strong><small>ربطت ما تعلمته بعمل أو سلوك.</small></span></label><label class="progress-step"><input type="checkbox" name="steps" value="reviewed" '+(savedSteps.includes("reviewed")?"checked":"")+'><span><strong>راجعت ما تعلمته</strong><small>عدت إلى الدرس أو المصدر وثبّت الفائدة.</small></span></label><label class="field">فائدة أريد تذكّرها <textarea name="reflection" maxlength="1200" rows="3" placeholder="اكتب خلاصة قصيرة أو عملًا تنوي المحافظة عليه...">'+esc(saved.reflection||"")+'</textarea></label><div class="student-actions"><button class="btn" type="submit">حفظ تقدمي</button><span class="muted small" id="curriculum-save-status" aria-live="polite">'+(saved.updated_at?"آخر حفظ: "+esc(saved.updated_at):"لم يُسجّل تقدم في هذا المحور بعد.")+'</span></div></form></section>';
html+='<div class="curriculum-tiles"><button class="curriculum-tile" data-lesson="allah"><strong>الله تعالى</strong><span>الأسماء الحسنى والإيمان</span>'+progressBadge(progress,"allah")+'</button><button class="curriculum-tile" data-lesson="prophet"><strong>الرسول ﷺ</strong><span>السيرة والشمائل والاتباع</span>'+progressBadge(progress,"prophet")+'</button><button class="curriculum-tile" data-lesson="quranpath"><strong>القرآن</strong><span>حفظ وفهم وتدبر وعمل</span>'+progressBadge(progress,"quran")+'</button><button class="curriculum-tile" data-lesson="sunnah"><strong>السنة والمتون</strong><span>حديث وعلم شرعي</span>'+progressBadge(progress,"sunnah")+'</button><button class="curriculum-tile" data-lesson="adab"><strong>الأدب والعمل</strong><span>أخلاق وتطبيق ومراجعة</span>'+progressBadge(progress,"adab")+'</button>'+custom.map(q=>'<button class="curriculum-tile" data-custom-lesson="'+esc(q.id)+'"><strong>'+esc(q.title)+'</strong><span>'+esc(q.description)+'</span>'+progressBadge(progress,q.id)+'</button>').join("")+'</div>';
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

const head=(a,b)=>'<div class="section-head"><div><h2>'+a+'</h2><p>'+b+'</p></div></div>';
const field=(label,name,type="text",min="")=>'<label class="field">'+label+'<input name="'+name+'" type="'+type+'" '+(min?'minlength="'+min+'"':"")+' required></label>';
const groupOpts=()=>S.groups.map(g=>'<option value="'+esc(g.id)+'">'+esc(g.name)+'</option>').join("");
function go(id){try{history.pushState({ihsanMode:S.mode,ihsanTab:id},"",location.pathname+"#"+encodeURIComponent(id))}catch{}S.tab=id;shell();page()}
window.addEventListener("popstate",async e=>{if(!S.user)return;const st=e.state||{};if(st.ihsanMode==="hub"){S.mode="hub";moduleChooser(false);return;}if(st.ihsanMode==="school"||st.ihsanMode==="ihsan"){S.mode=st.ihsanMode;S.tab=st.ihsanTab||(S.mode==="ihsan"?"all":"home");if(S.mode==="school")await load();shell();await page();if(st.ihsanSubView==="student-profile")await studentProfile($("#view"),st.studentId);return;}S.mode="hub";moduleChooser(false);});
async function page(){const v=$("#view");if(S.mode==="ihsan")return curriculumPage(v);v.innerHTML='<div class="loading">جار تحميل البيانات…</div>';try{if(S.tab==="home")return await home(v);if(S.tab==="system-check")return await systemCheckPage(v);if(S.tab==="backup")return await backupPage(v);if(S.tab==="audit")return await auditPage(v);if(S.tab==="groups")return groups(v);if(S.tab==="teachers")return teachers(v);if(S.tab==="students")return students(v);if(S.tab==="attendance")return attendance(v);if(S.tab==="assignments")return await assignmentsPage(v);if(S.tab==="gradebook")return await gradebookPage(v);if(S.tab==="messages")return await messagesPage(v);if(S.tab==="reports")return reportsPage(v);if(S.tab==="leaderboard")return leaderboardPage(v);if(S.tab==="profile")return studentProfile(v,S.user.student_id);if(S.tab==="quran")return quran(v);if(S.tab==="tests")return testsPage(v);if(S.tab==="posts")return postsPage(v);if(S.tab==="notifications")return notificationsPage(v)}catch(e){v.innerHTML='<div class="panel"><h2>تعذّر تحميل البيانات</h2><p class="notice error">'+esc(e.message)+'</p><button class="btn" id="retry">إعادة المحاولة</button></div>';$("#retry").onclick=page}}
async function home(v){const d=await api("/dashboard");let html=head("الرئيسية","نظرة مختصرة على يومك.");if(S.user.role!=="student")html+='<div class="stats"><div class="stat"><span class="stat-icon" aria-hidden="true">'+navIcon("students")+'</span><small>الطلاب</small><strong>'+d.students_count+'</strong></div><div class="stat"><span class="stat-icon" aria-hidden="true">'+navIcon("groups")+'</span><small>الأفواج</small><strong>'+d.groups_count+'</strong></div>'+(S.user.role==="admin"?'<div class="stat"><span class="stat-icon" aria-hidden="true">'+navIcon("attendance")+'</span><small>سُجّل حضورهم اليوم</small><strong>'+d.attendance_marked+'</strong></div>':'')+'</div>';else {
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
 html+='<div class="student-dashboard">'+(gam?'<section class="card achievement-card"><h3>إنجازك اليوم</h3><p>النقاط: <strong>'+Number(gam.points||0)+'</strong> · أيام متابعة القرآن: <strong>'+Number(gam.stats?.quran_days||0)+'</strong> · الاختبارات: <strong>'+Number(gam.stats?.tests||0)+'</strong></p><p>تحدي اليوم: '+esc(gam.daily_challenge?.title||'ورد اليوم')+' — '+esc(gam.daily_challenge?.description||'اقرأ وردك وراجعه بإتقان.')+'</p><p class="muted small">'+(gam.badges||[]).map(b=>esc(b.name)).join(' · ')+'</p><p class="muted small">القلوب المتبقية اليوم: '+Number(gam.hearts??5)+'</p>'+(gam.challenge_claimed?'<p class="notice">استلمت مكافأة اليوم بالفعل.</p>':'<button class="btn" data-claim-challenge="'+esc(gam.daily_challenge?.id||"daily-quran")+'">استلام مكافأة التحدي</button>')+'</section>': '')+'<div class="card student-welcome"><div class="eyebrow">خطوتك اليوم</div><h3>﴿ وَقُلْ رَبِّ زِدْنِي عِلْمًا ﴾</h3><p>اختر مهمة صغيرة، أنجزها بإتقان، ثم سجّل تقدمك. الاستمرار أهم من كثرة البداية.</p><div class="student-actions"><button class="btn" data-go="quran">متابعة القرآن</button><button class="btn secondary" data-go="tests">ابدأ اختبارًا</button></div></div><div class="stats"><div class="stat"><small>متابعات القرآن</small><strong>'+quranRows.length+'</strong></div><div class="stat"><small>سجلات الحضور</small><strong>'+attendanceRows.length+'</strong></div><div class="stat"><small>اختبارات متاحة</small><strong>'+tests.length+'</strong></div><div class="stat"><small>واجبات غير منجزة</small><strong>'+assignments.filter(a=>!a.my_submission||a.my_submission.status!=="reviewed").length+'</strong></div><div class="stat"><small>ترتيب فوجك</small><strong>'+(me?"#"+me.rank:"—")+'</strong></div></div><section class="card path-cards-section"><div class="section-head"><div><h3>مساراتك وبطاقات تقدمك</h3><p>اختر الخطوة التالية، وتابع تقدمك دون مقارنة جائرة بغيرك.</p></div></div><div class="path-cards"><button class="path-card" data-go="quran"><span class="path-icon">۞</span><strong>مسار القرآن</strong><small>'+(gam?.plan?esc(({starter:"المسار التمهيدي","15":"ختمة 15 يومًا","30":"ختمة 30 يومًا","45":"ختمة 45 يومًا",khatma:"الختمة الكاملة"}[gam.plan.path_id]||"خطة القرآن")):"اختر مسار ختمتك")+'</small><span class="path-meter"><i style="width:'+Math.min(100,quranRows.length*5)+'%"></i></span><small>'+quranRows.length+' متابعة مسجلة</small></button><button class="path-card" data-go="tests"><span class="path-icon">✧</span><strong>الاختبارات</strong><small>تعلّم، اختبر، ثم راجع أخطاءك</small><span class="path-meter"><i style="width:'+Math.min(100,tests.length?tests.filter(t=>t.my_attempt).length/tests.length*100:0)+'%"></i></span><small>'+tests.filter(t=>t.my_attempt).length+' من '+tests.length+' مكتمل</small></button><button class="path-card" data-go="assignments"><span class="path-icon">✓</span><strong>واجباتي</strong><small>اطلع على التكليفات وسلّم إجابتك وتابع ملاحظات المعلم</small><span class="path-meter"><i style="width:'+Math.min(100,assignments.length?assignments.filter(a=>a.my_submission&&a.my_submission.status==="reviewed").length/assignments.length*100:0)+'%"></i></span><small>'+assignments.filter(a=>a.my_submission&&a.my_submission.status==="reviewed").length+' من '+assignments.length+' تمت مراجعتها</small></button><button class="path-card" data-open-ihsan><span class="path-icon">✦</span><strong>تخصصات العلم</strong><small>الله تعالى، الرسول ﷺ، القرآن، السنة، الأدب والعمل</small><span class="path-link">استكشف المسارات ←</span></button></div></section><div class="card"><h3>اقتراح اليوم</h3><p>'+(qToday?'سُجّلت متابعة قرآن اليوم. أحسنت، راجع ما حفظته وثبّته.':"راجع وردك من القرآن، واطلب من معلمك تسجيل الحفظ والمراجعة عند التسميع.")+'</p><p>'+(todayAttendance?'حضور اليوم مسجّل: '+esc(({"present":"حاضر","absent":"غائب","late":"متأخر","excused":"بعذر"}[todayAttendance.status]||todayAttendance.status))+'.':"تحقق من سجل حضورك بعد انتهاء الحلقة.")+'</p><p>'+(unanswered?'لديك '+unanswered+' اختبار/اختبارات لم ترسلها بعد.':'راجع نتائج اختباراتك السابقة إن وُجدت.')+'</p><button class="btn secondary" data-go="profile">عرض ملفي وتقدّمي</button></div></div>';
}const quickIds=S.user.role==="admin"?["groups","students","attendance","quran","tests"]:["teacher","director","supervisor"].includes(S.user.role)?["students","attendance","quran","tests"]:[];
const quickItems=items().filter(x=>quickIds.includes(x[0]));
if(quickItems.length)html+='<section class="card quick-actions-card"><div class="section-head"><div><h3>خطوات سريعة</h3><p>انتقل مباشرةً إلى أكثر المهام استخدامًا.</p></div></div><div class="quick-actions">'+quickItems.map(x=>'<button class="quick-action" type="button" data-go="'+x[0]+'"><span class="quick-action-icon">'+navIcon(x[0])+'</span><span class="quick-action-copy"><strong>'+esc(x[1])+'</strong><small>فتح القسم</small></span><span class="quick-action-arrow" aria-hidden="true">←</span></button>').join("")+'</div></section>';
v.innerHTML=html;v.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>go(b.dataset.go));v.querySelectorAll("[data-open-ihsan]").forEach(b=>b.onclick=()=>{S.mode="ihsan";S.tab="all";try{history.pushState({ihsanMode:"ihsan",ihsanTab:"all"},"",location.pathname)}catch{}shell();page()});v.querySelectorAll("[data-claim-challenge]").forEach(b=>b.onclick=async()=>{b.disabled=true;try{await api("/gamification/claim",{method:"POST",body:JSON.stringify({challenge_id:b.dataset.claimChallenge})});toast("تم تسجيل إنجازك ومكافأتك اليومية");await page()}catch(e){toast(e.message,true);b.disabled=false}})}
function groups(v){
const teacherOptions=(selected)=>'<option value="">غير معيّن</option>'+(S.user.role==="admin"?'<option value="'+esc(S.user.id)+'" '+(S.user.id===selected?'selected':'')+'>'+esc(S.user.name)+' — مدير ومعلم</option>':"")+S.teachers.map(t=>'<option value="'+esc(t.id)+'" '+(t.id===selected?'selected':'')+'>'+esc(t.name)+' ('+esc(t.username)+')</option>').join("");
v.innerHTML=head("الأفواج","أنشئ الأفواج وعيّن المعلم أو غيّر تعيينه في أي وقت.")+'<div class="card"><form id="gform" class="form-grid"><div class="wide">'+field("اسم الفوج","name")+'</div><label class="field wide">المعلم المسؤول<select name="teacher_id">'+teacherOptions("")+'</select></label><div class="wide"><button class="btn">إضافة الفوج</button></div></form></div><div class="divider"></div><div class="list">'+(S.groups.length?S.groups.map(g=>'<div class="list-row"><div style="flex:1;min-width:220px"><strong>'+esc(g.name)+'</strong><label class="field small">المعلم المسؤول<select data-teacher-for="'+esc(g.id)+'">'+teacherOptions(g.teacher_id)+'</select></label></div><button class="btn" data-save-group="'+esc(g.id)+'">حفظ التعيين</button><button class="btn danger" data-del="'+esc(g.id)+'">إيقاف</button></div>').join(""):'<div class="empty">لا توجد أفواج بعد.</div>')+'</div>';
$("#gform").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.currentTarget);try{await api("/groups",{method:"POST",body:JSON.stringify({name:f.get("name"),teacher_id:f.get("teacher_id")})});toast("تمت إضافة الفوج");await load();shell();page()}catch(x){toast(x.message,true)}};
v.querySelectorAll("[data-save-group]").forEach(b=>b.onclick=async()=>{const id=b.dataset.saveGroup,sel=v.querySelector('[data-teacher-for="'+id+'"]');try{await api("/groups/"+encodeURIComponent(id),{method:"PATCH",body:JSON.stringify({teacher_id:sel.value||null})});toast("تم حفظ تعيين المعلم");await load();shell();page()}catch(x){toast(x.message,true)}});
v.querySelectorAll("[data-del]").forEach(b=>b.onclick=async()=>{if(!confirm("إيقاف الفوج؟"))return;try{await api("/groups/"+b.dataset.del,{method:"DELETE"});await load();shell();page()}catch(x){toast(x.message,true)}})
}
async function teachers(v){
 const isAdmin=S.user.role==="admin";let team=[];if(isAdmin){try{team=await api("/admin/staff")}catch{team=[]}}
 const roleName=r=>r==="director"?"مدير مدرسة":"مشرف فريق";
 const scopeText=s=>s.role==="director"?"المدارس: "+(s.school_ids||[]).map(id=>(S.schools.find(x=>x.id===id)||{}).name||id).join("، "):"الأفواج: "+(s.group_ids||[]).map(id=>(S.groups.find(x=>x.id===id)||{}).name||id).join("، ");
 const schoolIds=[...new Set([...S.schools.map(x=>x.id),...S.groups.map(x=>x.school_id).filter(Boolean)])];
 const schools=schoolIds.map(id=>'<option value="'+esc(id)+'">'+esc((S.schools.find(x=>x.id===id)||{}).name||id)+'</option>').join("");
 const groups=S.groups.map(g=>'<option value="'+esc(g.id)+'">'+esc(g.name)+'</option>').join("");
 v.innerHTML=head("المعلمون والفريق","حسابات المعلمين وأدوار الفريق مع تحديد نطاق الصلاحيات.")+'<section class="card"><h3>إضافة معلم</h3><form id="tform" class="form-grid"><div>'+field("الاسم الكامل","name")+'</div><div>'+field("اسم الدخول","username")+'</div><div>'+field("كلمة مرور مؤقتة","password","password","8")+'</div><div class="wide"><button class="btn">إنشاء حساب المعلم</button></div></form></section>'+
 (isAdmin?'<section class="card"><h3>إنشاء مدير مدرسة أو مشرف فريق</h3><form id="staff-form" class="stack"><div class="form-grid"><label class="field">الدور<select name="role" id="staff-role"><option value="director">مدير مدرسة</option><option value="supervisor">مشرف فريق</option></select></label><label class="field">الاسم<input name="name" required maxlength="120"></label><label class="field">اسم الدخول<input name="username" required maxlength="120"></label><label class="field">كلمة مرور مؤقتة (12 حرفًا على الأقل)<input name="password" type="password" minlength="12" required></label></div><div id="director-scope"><label class="field">المدارس المحددة<select name="school_ids" id="staff-schools" multiple size="3">'+schools+'</select></label></div><div id="supervisor-scope" class="hidden"><label class="field">الأفواج المحددة<select name="group_ids" id="staff-groups" multiple size="5">'+groups+'</select></label></div><button class="btn" type="submit">إنشاء الحساب وتثبيت الصلاحيات</button></form></section><section class="card"><h3>مديرو المدارس والمشرفون النشطون</h3><div class="list">'+(team.length?team.map(s=>'<div class="list-row"><div><strong>'+esc(s.name)+'</strong><small>'+roleName(s.role)+' · '+esc(s.username)+'</small><small>'+esc(scopeText(s))+'</small></div><button class="btn danger" data-disable-staff="'+esc(s.id)+'">تعطيل</button></div>').join(""):'<div class="empty">لا توجد حسابات لهذه الأدوار بعد.</div>')+'</div><p class="muted small">تعطيل الحساب يلغي جلساته ولا يحذف سجلات الطلاب.</p></section>':'<section class="card"><h3>المعلمون ضمن نطاقك</h3><div class="list">'+(S.teachers.length?S.teachers.map(t=>'<div class="list-row"><strong>'+esc(t.name)+'</strong></div>').join(""):'<p class="muted">لا توجد حسابات معلمين ضمن نطاقك.</p>')+'</div></section>');
 $("#tform")?.addEventListener("submit",async e=>{e.preventDefault();const f=new FormData(e.currentTarget);try{await api("/teachers",{method:"POST",body:JSON.stringify({name:f.get("name"),username:f.get("username"),password:f.get("password")})});toast("تم إنشاء حساب المعلم");await load();shell();await page()}catch(err){toast(err.message,true)}});
 if(isAdmin){
  const role=$("#staff-role"),ds=$("#director-scope"),ss=$("#supervisor-scope");
  const change=()=>{const d=role.value==="director";ds.classList.toggle("hidden",!d);ss.classList.toggle("hidden",d);$("#staff-schools").disabled=!d;$("#staff-groups").disabled=d;$("#staff-schools").required=d;$("#staff-groups").required=!d};role.addEventListener("change",change);change();
  $("#staff-form")?.addEventListener("submit",async e=>{e.preventDefault();const form=e.currentTarget,f=new FormData(form),selected=n=>[...form.querySelectorAll('select[name="'+n+'"] option:checked')].map(o=>o.value);const body={role:f.get("role"),name:f.get("name"),username:f.get("username"),password:f.get("password"),school_ids:selected("school_ids"),group_ids:selected("group_ids")};if(body.role==="director"&&!body.school_ids.length)return toast("اختر مدرسة واحدة على الأقل.",true);if(body.role==="supervisor"&&!body.group_ids.length)return toast("اختر فوجًا واحدًا على الأقل.",true);const b=form.querySelector('button[type="submit"]');b.disabled=true;try{await api("/admin/staff",{method:"POST",body:JSON.stringify(body)});toast("تم إنشاء الحساب مع نطاق الصلاحيات");await load();shell();await page()}catch(err){toast(err.message,true);b.disabled=false}});
  v.querySelectorAll("[data-disable-staff]").forEach(b=>b.onclick=async()=>{if(!confirm("تعطيل حساب هذا العضو؟ لن تُحذف بيانات الطلاب."))return;try{await api("/admin/staff/"+encodeURIComponent(b.dataset.disableStaff),{method:"DELETE"});toast("تم تعطيل الحساب");await load();shell();await page()}catch(err){toast(err.message,true)}});
 }
}

function students(v){
const bulkAccountStudentIds=["roster-20261020-01","roster-20261020-04","roster-20261020-05","roster-20261020-07","roster-20261020-09","roster-20261020-11","roster-20261020-13","roster-20261020-14","roster-20261020-15","roster-20261020-16","roster-20261020-18","roster-20261020-19","roster-20261020-20","roster-20261020-22","roster-20261020-23","roster-20261020-24","roster-20261020-26","roster-20261020-27","roster-20261020-28","roster-20261020-29","roster-20261020-30","roster-20261020-32","roster-20261020-33","roster-20261020-35","roster-20261020-36","roster-20261020-37","roster-20261020-38","roster-20261020-39","roster-20261020-42","roster-20261020-43","roster-20261020-44","roster-20261020-46","roster-20261020-47","roster-20261020-48","roster-20261020-49","roster-20261020-50","roster-20261020-51","roster-20261020-53","roster-20261020-54","roster-20261020-55"];
const bulkAccountCandidates=()=>bulkAccountStudentIds.filter(id=>S.students.some(s=>s.id===id&&S.groups.some(g=>g.id===s.group_id)));
const groupName=id=>(S.groups.find(g=>g.id===id)||{}).name||"بلا فوج";
v.innerHTML=head("الطلاب","اختر الفوج لعرض طلابه منفصلين. الحسابات الموجودة تبقى كما هي.")+(S.groups.length?'<div class="card"><form id="sform" class="form-grid"><div>'+field("اسم الطالب الكامل","name")+'</div><div>'+field("كلمة مرور مؤقتة","password","password","8")+'</div><label class="field">الفوج<select name="group_id" required><option value="">اختر الفوج</option>'+groupOpts()+'</select></label><div class="wide"><button class="btn">إنشاء حساب طالب</button></div></form><p class="muted small">هذا النموذج ينشئ حساب دخول. الطلاب المسجلون في القائمة الاسمية دون حساب يظهرون منفصلين ولا يتطلبون كلمة مرور.</p></div>':'<div class="notice">أنشئ فوجًا أولًا، ثم أضف الطلاب إليه.</div>')+'<div class="card"><div class="stats roster-account-stats"><div class="stat"><small>ملفات الطلاب</small><strong id="roster-total">0</strong></div><div class="stat"><small>لديهم حساب دخول</small><strong id="roster-linked">0</strong></div><div class="stat"><small>بحاجة إلى حساب</small><strong id="roster-missing">0</strong></div></div><div class="roster-filters"><label class="field">فرز القائمة حسب الفوج<select id="student-group-filter"><option value="all">كل الأفواج — عرض منفصل</option>'+S.groups.slice().sort((a,b)=>a.name.localeCompare(b.name,"ar")).map(g=>'<option value="'+esc(g.id)+'">'+esc(g.name)+'</option>').join("")+'</select></label><label class="field">حالة الحساب<select id="student-login-filter"><option value="all">كل الطلاب</option><option value="missing">بلا حساب دخول</option><option value="linked">لديهم حساب دخول</option></select></label></div>'+(S.user.role==="admin"?'<div class="roster-actions"><button id="bulk-onboard-students" class="btn" type="button" '+(bulkAccountCandidates().length?'':'disabled')+'>تجهيز دخول الأسماء الكاملة ('+bulkAccountCandidates().length+')</button><p class="muted small">إجراء للمدير لإنشاء حسابات الأسماء الكاملة. يحصل كل طالب على كلمة مرور مؤقتة عشوائية وفريدة، ويجب تغييرها عند أول دخول. تُعرض بيانات الدخول مرة واحدة فقط؛ احفظها بأمان. الأسماء غير المكتملة تبقى لائحة اسمية إلى حين استكمال بياناتها.</p></div>':'')+'<p class="muted small">تُنشأ الحسابات للأسماء المحددة فقط. لكل حساب كلمة مرور مؤقتة فريدة ويُفرض تغييرها عند أول دخول. لا تُشارك ملف بيانات الدخول إلا مع صاحب الصلاحية، واحذفه بعد تسليم البيانات للطلاب.</p></div><div id="bulk-onboarding-results" aria-live="polite"></div><div id="students-roster"></div>';
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
$("#sform")?.addEventListener("submit",async e=>{e.preventDefault();const f=new FormData(e.currentTarget);try{const created=await api("/students",{method:"POST",body:JSON.stringify({name:f.get("name"),username:String(f.get("name")||"").trim(),password:f.get("password"),group_id:f.get("group_id")})});toast("تم إنشاء الطالب؛ اسم الدخول: "+created.username);await load();shell();page()}catch(x){toast(x.message,true)}});
}
async function attendance(v){
if(S.user.role==="student"){const rows=await api("/attendance?date="+S.date);v.innerHTML=head("حضوري","سجل الحضور الخاص بك.")+'<div class="card"><label class="field">التاريخ<input id="date" type="date" value="'+S.date+'"></label><div class="divider"></div><div class="list">'+(rows.length?rows.map(r=>'<div class="list-row"><div><strong>'+esc(r.date)+'</strong><small>'+esc(r.note||"")+'</small></div><span class="pill">'+({"present":"حاضر","absent":"غائب","late":"متأخر","excused":"بعذر"}[r.status]||r.status)+'</span></div>').join(""):'<div class="empty">لا يوجد سجل لهذا التاريخ.</div>')+'</div></div>';$("#date").onchange=()=>{S.date=$("#date").value;attendance(v)};return}
v.innerHTML=head("الحضور","اختر الفوج والتاريخ، ثم عاين السجل أو افتح نموذج التعديل قبل الحفظ.")+'<div class="card"><div class="attendance-controls"><label class="field">الفوج<select id="ag"><option value="">اختر الفوج</option>'+groupOpts()+'</select></label><label class="field">التاريخ<input id="ad" type="date" value="'+S.date+'"></label><button id="preview-att" class="btn secondary">معاينة الحضور</button><button id="load-att" class="btn">تسجيل / تعديل الحضور</button></div><div id="att-list" class="muted small">اختر الفوج والتاريخ ثم اضغط «معاينة الحضور» لعرض السجل دون تعديل.</div></div>';
$("#ad").onchange=()=>S.date=$("#ad").value;
async function showAttendance(edit){
const group=$("#ag").value,date=$("#ad").value;if(!group)return toast("اختر الفوج",true);
try{
const pair=await Promise.all([api("/students?group_id="+encodeURIComponent(group)),api("/attendance?group_id="+encodeURIComponent(group)+"&date="+encodeURIComponent(date))]);
const students=pair[0],old={};pair[1].forEach(x=>old[x.student_id]=x);const host=$("#att-list");
if(!students.length){host.innerHTML='<div class="empty">لا يوجد طلاب في هذا الفوج.</div>';return}
const statusName=x=>({"present":"حاضر","absent":"غائب","late":"متأخر","excused":"بعذر"}[x]||"غير مسجل");
if(!edit){host.innerHTML='<div class="card"><h3>معاينة سجل الحضور</h3><p class="muted small">'+esc((S.groups.find(g=>g.id===group)||{}).name||"الفوج")+' · '+esc(date)+' · '+students.length+' طالبًا</p><div class="table-wrap"><table><thead><tr><th>الطالب</th><th>الحالة المسجلة</th><th>الملاحظة</th></tr></thead><tbody>'+students.map(st=>'<tr><td>'+esc(st.name)+'</td><td><span class="pill">'+statusName(old[st.id]?.status)+'</span></td><td>'+esc(old[st.id]?.note||"—")+'</td></tr>').join("")+'</tbody></table></div><p class="muted small">هذه معاينة فقط؛ لم يُحفظ أي تغيير.</p><button id="edit-after-preview" class="btn">تعديل هذا السجل</button></div>';$("#edit-after-preview").onclick=()=>showAttendance(true);return}
host.innerHTML='<form id="attform"><p class="muted small">غيّر الحالات ثم اضغط «حفظ الحضور». لن تُحفظ التغييرات قبل الضغط.</p><div class="table-wrap"><table><thead><tr><th>الطالب</th><th>الحالة</th><th>ملاحظة</th></tr></thead><tbody>'+students.map(st=>'<tr><td>'+esc(st.name)+'</td><td><select class="status-select" name="st_'+esc(st.id)+'"><option value="present" '+((old[st.id]?.status||"present")==="present"?"selected":"")+'>حاضر</option><option value="absent" '+(old[st.id]?.status==="absent"?"selected":"")+'>غائب</option><option value="late" '+(old[st.id]?.status==="late"?"selected":"")+'>متأخر</option><option value="excused" '+(old[st.id]?.status==="excused"?"selected":"")+'>بعذر</option></select></td><td><input name="note_'+esc(st.id)+'" value="'+esc(old[st.id]?.note||"")+'" style="width:120px" placeholder="اختياري"></td></tr>').join("")+'</tbody></table></div><button class="btn" style="margin-top:15px">حفظ الحضور</button><button type="button" id="back-preview" class="btn secondary" style="margin:15px 8px 0">رجوع إلى المعاينة</button></form>';
$("#back-preview").onclick=()=>showAttendance(false);
$("#attform").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.currentTarget);const items=students.map(st=>({student_id:st.id,status:f.get("st_"+st.id),note:f.get("note_"+st.id)}));try{const r=await api("/attendance",{method:"POST",body:JSON.stringify({group_id:group,date,items})});toast("تم حفظ حضور "+r.saved+" طالبًا");showAttendance(false)}catch(x){toast(x.message,true)}}
}catch(x){toast(x.message,true)}
}
$("#preview-att").onclick=()=>showAttendance(false);$("#load-att").onclick=()=>showAttendance(true)
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
 v.innerHTML=head("متابعة القرآن","سجّل الحفظ والمراجعة والتسميع وعدد الأخطاء والتقدير والتصحيح، واربطها بملف الطالب.")+'<section id="qplan" class="card"><p class="muted">اختر الطالب لعرض المسار الحالي أو تعيين مسار جديد.</p></section><section class="card"><form id="qform" class="form-grid"><input type="hidden" name="record_id"><label class="field wide">الطالب<select name="student_id" required><option value="">اختر الطالب</option>'+S.students.map(st=>'<option value="'+esc(st.id)+'">'+esc(st.name)+' — '+esc((S.groups.find(g=>g.id===st.group_id)||{}).name||"")+'</option>').join("")+'</select></label><label class="field">نوع المتابعة<select name="activity"><option value="memorization">حفظ جديد</option><option value="revision">مراجعة</option><option value="recitation" selected>تسميع</option><option value="correction">تصحيح</option></select></label><label class="field">التاريخ<input name="date" type="date" required value="'+esc(S.date)+'"></label><label class="field">الحفظ الجديد<input name="memorized" maxlength="300" placeholder="السورة والآيات أو المقدار"></label><label class="field">المراجعة<input name="reviewed" maxlength="300" placeholder="ما راجعه الطالب"></label><label class="field wide">التسميع والملاحظات الصوتية/الأداء<textarea name="recitation" maxlength="500" rows="2" placeholder="الآيات المسمّعة ومستوى الأداء"></textarea></label><label class="field">عدد الأخطاء<input name="errors" type="number" min="0" max="200" value="0" required></label><label class="field">التقدير من 10<input name="grade" type="number" min="0" max="10" step="0.5" placeholder="اختياري"></label><label class="field wide">تصحيح الأخطاء<textarea name="feedback" maxlength="800" rows="2" placeholder="مواضع الخطأ وطريقة التصحيح أو التجويد"></textarea></label><label class="field wide">المهمة القادمة<textarea name="next_assignment" maxlength="300" rows="2" placeholder="المقدار المطلوب في اللقاء القادم"></textarea></label><label class="field wide">ملاحظات إضافية<textarea name="notes" maxlength="500" rows="2"></textarea></label><label class="remember-option wide"><input name="corrected" type="checkbox"> تم تصحيح الأخطاء ومراجعتها مع الطالب</label><div class="wide student-actions"><button id="q-save" class="btn" type="submit">حفظ المتابعة</button><button id="q-cancel-edit" class="btn secondary" type="button" hidden>إلغاء التعديل</button></div></form></section><div id="qhistory" class="list"><div class="empty">اختر طالبًا لعرض سجل المتابعة.</div></div>';
 const form=$("#qform"),hist=$("#qhistory"),studentSelect=form.elements.student_id;
 async function loadQuranPlan(id){if(!id){$("#qplan").innerHTML='<p class="muted">اختر الطالب لعرض المسار الحالي أو تعيين مسار جديد.</p>';return}try{const plan=await api("/quran/plan?student_id="+encodeURIComponent(id));$("#qplan").innerHTML=quranPlanMarkup(levels,plan,id,false);wireQuranPlan($("#qplan"),levels)}catch(x){$("#qplan").innerHTML='<div class="notice error">'+esc(x.message)+'</div>'}}
 function clearProgressForm(){form.reset();form.elements.record_id.value="";form.elements.student_id.value=studentSelect.value;form.elements.date.value=S.date;form.elements.errors.value="0";$("#q-save").textContent="حفظ المتابعة";$("#q-cancel-edit").hidden=true}
 function renderProgressRows(rows){
  hist.innerHTML=quranProgressSummary(rows)+'<section class="card"><h3>سجل الطالب</h3><div class="list">'+(rows.length?rows.map(r=>'<article class="list-row"><div><strong>'+esc(r.date)+' · '+esc(quranActivityName(r.activity))+'</strong><small>الحفظ: '+esc(r.memorized||"—")+' · المراجعة: '+esc(r.reviewed||"—")+'</small><small>التسميع: '+esc(r.recitation||"—")+'</small><small>الأخطاء: '+Number(r.errors||0)+' · التقدير: '+(r.grade===null||r.grade===undefined?"—":esc(r.grade+"/10"))+' · التصحيح: '+(r.corrected?"تم":"قيد المتابعة")+'</small><small>ملاحظة: '+esc(r.feedback||r.notes||"—")+'</small><small>المهمة القادمة: '+esc(r.next_assignment||"—")+'</small></div><div class="student-actions"><button class="btn secondary" data-edit-progress="'+esc(r.id)+'">تعديل</button>'+(S.user.role==="admin"?'<button class="btn danger" data-delete-progress="'+esc(r.id)+'">حذف</button>':"")+'</div></article>').join(""):'<div class="empty">لا توجد متابعة لهذا الطالب حتى الآن.</div>')+'</div></section>';
  hist.querySelectorAll("[data-edit-progress]").forEach(b=>b.onclick=()=>{const r=rows.find(x=>x.id===b.dataset.editProgress);if(!r)return;for(const k of ["record_id","student_id","date","activity","memorized","reviewed","recitation","errors","grade","feedback","next_assignment","notes"])if(form.elements[k])form.elements[k].value=r[k]??"";form.elements.corrected.checked=!!r.corrected;$("#q-save").textContent="حفظ تعديل المتابعة";$("#q-cancel-edit").hidden=false;form.scrollIntoView({behavior:"smooth",block:"start"})});
  hist.querySelectorAll("[data-delete-progress]").forEach(b=>b.onclick=async()=>{if(!confirm("حذف سجل المتابعة هذا نهائيًا؟"))return;try{await api("/quran/progress/"+encodeURIComponent(b.dataset.deleteProgress),{method:"DELETE"});toast("تم حذف السجل");await refreshHistory(studentSelect.value)}catch(e){toast(e.message,true)}});
 }
 async function refreshHistory(id){if(!id){hist.innerHTML='<div class="empty">اختر طالبًا لعرض سجل المتابعة.</div>';return}try{const rows=await api("/quran/progress?student_id="+encodeURIComponent(id));renderProgressRows(rows)}catch(e){hist.innerHTML='<div class="notice error">'+esc(e.message)+'</div>'}}
 studentSelect.onchange=async()=>{clearProgressForm();await loadQuranPlan(studentSelect.value);await refreshHistory(studentSelect.value)};
 $("#q-cancel-edit").onclick=clearProgressForm;
 form.onsubmit=async e=>{e.preventDefault();const f=new FormData(form),id=String(f.get("record_id")||"");
  const body={student_id:f.get("student_id"),date:f.get("date"),activity:f.get("activity"),memorized:f.get("memorized"),reviewed:f.get("reviewed"),recitation:f.get("recitation"),errors:Number(f.get("errors")||0),grade:f.get("grade")===""?null:Number(f.get("grade")),corrected:f.get("corrected")==="on",feedback:f.get("feedback"),next_assignment:f.get("next_assignment"),notes:f.get("notes")};
  if(!body.memorized&&!body.reviewed&&!body.recitation&&!body.feedback&&!body.next_assignment&&!body.notes){toast("أدخل الحفظ أو المراجعة أو التسميع أو الملاحظات",true);return}
  try{if(id){delete body.student_id;await api("/quran/progress/"+encodeURIComponent(id),{method:"PATCH",body:JSON.stringify(body)});toast("تم تحديث سجل المتابعة")}else{await api("/quran/progress",{method:"POST",body:JSON.stringify(body)});toast("تم حفظ سجل المتابعة")}
   const studentId=String(f.get("student_id"));clearProgressForm();await refreshHistory(studentId);await loadQuranPlan(studentId);
  }catch(x){toast(x.message,true)}
 };
 if(S.students.length){studentSelect.value=S.students[0].id;await loadQuranPlan(studentSelect.value);await refreshHistory(studentSelect.value)}
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
  const data=await Promise.all(jobs),progress=data[0]||[],attendanceRows=data[1]||[],testRows=data[2]||[];
  const present=attendanceRows.filter(x=>x.status==="present").length,absent=attendanceRows.filter(x=>x.status==="absent").length,late=attendanceRows.filter(x=>x.status==="late").length;
  let html=head("ملخص الطالب",st.name)+'<div class="stats"><div class="stat"><small>سجلات الحضور</small><strong>'+attendanceRows.length+'</strong></div><div class="stat"><small>الحضور</small><strong>'+present+'</strong></div><div class="stat"><small>الغياب</small><strong>'+absent+'</strong></div><div class="stat"><small>التأخر</small><strong>'+late+'</strong></div><div class="stat"><small>متابعات القرآن</small><strong>'+progress.length+'</strong></div><div class="stat"><small>محاولات الاختبارات</small><strong>'+testRows.length+'</strong></div></div><section class="card"><h3>سجل الحضور</h3><div class="list">'+(attendanceRows.length?attendanceRows.slice(0,40).map(r=>'<div class="list-row"><div><strong>'+esc(r.date)+'</strong><small>'+esc(r.note||"")+'</small></div><span class="pill">'+({"present":"حاضر","absent":"غائب","late":"متأخر","excused":"بعذر"}[r.status]||"غير مسجل")+'</span></div>').join(""):'<div class="empty">لا توجد سجلات حضور لهذا الطالب.</div>')+'</div></section><section class="card"><h3>متابعة القرآن</h3><div class="list">'+(progress.length?progress.map(r=>'<div class="list-row"><div><strong>'+esc(r.date)+'</strong><small>الحفظ: '+esc(r.memorized||"—")+' · المراجعة: '+esc(r.reviewed||"—")+' · '+esc(r.notes||"")+'</small></div></div>').join(""):'<div class="empty">لا توجد متابعة قرآنية مسجّلة.</div>')+'</div></section>';
  html+='<section class="card"><h3>نتائج الاختبارات</h3><div class="list">'+(testRows.length?testRows.map(r=>'<div class="list-row"><div><strong>'+esc(r.title||"اختبار")+'</strong><small>'+esc(r.submitted_at||"")+'</small></div><strong>'+r.score+' / '+r.total+'</strong></div>').join(""):'<div class="empty">لا توجد نتائج اختبارات لهذا الطالب.</div>')+'</div></section>';
  v.innerHTML=html+'<button id="back-students-bottom" class="btn secondary">العودة إلى قائمة الطلاب</button>';$("#back-students-bottom").onclick=()=>{S.tab="students";shell();page()};
 }catch(e){v.innerHTML=head("ملف الطالب",st.name)+'<div class="notice error">'+esc(e.message)+'</div><button class="btn secondary" id="back-students">العودة إلى قائمة الطلاب</button>';$("#back-students").onclick=()=>{S.tab="students";shell();page()}}
}
async function reportsPage(v){
 if(S.user.role==="student"){v.innerHTML=head("التقارير","غير مسموح");return}
 v.innerHTML=head("التقارير الأسبوعية","ملخص الحضور لكل طالب في الفوج المحدد، دون حذف السجلات القديمة.")+'<section class="card"><label class="field">الفوج<select id="report-group">'+groupOpts()+'</select></label><button class="btn" id="load-report" style="margin-top:12px">عرض تقرير آخر 7 أيام</button></section><div id="report-result" class="loading">اختر الفوج ثم اعرض التقرير.</div>';
 const render=async()=>{const gid=$("#report-group").value;if(!gid)return toast("اختر الفوج",true);const host=$("#report-result");host.innerHTML='<div class="loading">جار إعداد التقرير…</div>';try{const rows=await api("/attendance?group_id="+encodeURIComponent(gid)+"&history=1");const cutoff=shiftLocalDateISO(localDateISO(),-6);const week=rows.filter(r=>String(r.date)>=cutoff);const students=S.students.filter(st=>st.group_id===gid).slice().sort((a,b)=>String(a.name).localeCompare(String(b.name),"ar"));const count=(id,status)=>week.filter(r=>r.student_id===id&&r.status===status).length;const present=week.filter(r=>r.status==="present").length,absent=week.filter(r=>r.status==="absent").length,late=week.filter(r=>r.status==="late").length,marked=week.length;host.innerHTML='<div class="stats"><div class="stat"><small>سجلات الأسبوع</small><strong>'+marked+'</strong></div><div class="stat"><small>حاضر</small><strong>'+present+'</strong></div><div class="stat"><small>غائب</small><strong>'+absent+'</strong></div><div class="stat"><small>متأخر</small><strong>'+late+'</strong></div></div><section class="card"><h3>تفصيل الطلاب · '+esc(cutoff)+' إلى '+esc(localDateISO())+'</h3><div class="table-wrap"><table><thead><tr><th>الطالب</th><th>حاضر</th><th>غائب</th><th>متأخر</th><th>بعذر</th><th>السجلات</th></tr></thead><tbody>'+students.map(st=>'<tr><td>'+esc(st.name)+'</td><td>'+count(st.id,"present")+'</td><td>'+count(st.id,"absent")+'</td><td>'+count(st.id,"late")+'</td><td>'+count(st.id,"excused")+'</td><td>'+week.filter(r=>r.student_id===st.id).length+'</td></tr>').join("")+'</tbody></table></div></section>'}catch(e){host.innerHTML='<div class="notice error">'+esc(e.message)+'</div>'}};
 $("#load-report").onclick=render;if(S.groups.length)render();
}

async function leaderboardPage(v){
 const isStudent=S.user.role==="student";
 const staff=["admin","director","teacher","supervisor"].includes(S.user.role);
 let groupId=isStudent?(S.user.group_id||((S.groups[0]||{}).id||"")):"";
 if(staff&&S.groups.length)groupId=S.groups[0].id;
 v.innerHTML=head("ترتيب الفوج","ترتيب تشجيعي يقدّر المواظبة والحفظ ونتائج الاختبارات، لا يقيس قيمة الطالب ولا يستبدل تقييم المعلم.")+
 (staff?'<section class="card"><label class="field">الفوج<select id="leaderboard-group">'+groupOpts()+'</select></label><button class="btn" id="leaderboard-refresh" style="margin-top:12px">تحديث الترتيب</button></section>':'<p class="muted small">يعرض هذا الترتيب طلاب فوجك فقط. النقاط: 5 للحضور المسجّل، و10 لكل متابعة قرآن، و3 لكل إجابة صحيحة في أفضل محاولة لكل اختبار.</p>')+
 '<div id="leaderboard-content" class="loading">جار حساب النقاط…</div>';
 const render=async()=>{
  const group=staff?($("#leaderboard-group")?.value||""):groupId;
  const host=$("#leaderboard-content");
  if(staff&&!group){host.innerHTML='<div class="empty">اختر فوجًا لعرض ترتيبه.</div>';return}
  host.innerHTML='<div class="loading">جار حساب النقاط…</div>';
  try{
   const rows=await api("/leaderboard"+(staff?"?group_id="+encodeURIComponent(group):""));
   if(!rows.length){host.innerHTML='<div class="card empty">لا توجد بيانات كافية للترتيب بعد. يبدأ الترتيب مع تسجيل الحضور ومتابعة القرآن والاختبارات.</div>';return}
   host.innerHTML='<section class="card"><div class="notice">ترتيب من 100 نقطة: المواظبة 25٪، انتظام القرآن 35٪، إتقان الاختبارات 30٪، التحديات 10٪. تُحسب النسب بدل جمع مقدار الحفظ الخام، حتى لا يتقدم الأقدم لمجرد طول مدة تسجيله.</div><div class="table-wrap"><table><thead><tr><th>الترتيب</th><th>الطالب</th><th>النتيجة /100</th><th>المواظبة</th><th>القرآن</th><th>إتقان الاختبار</th><th>التحديات</th></tr></thead><tbody>'+rows.map(r=>'<tr '+(r.is_self?'class="leaderboard-self"':"")+'><td>'+r.rank+'</td><td>'+esc(r.name)+(r.is_self?' <span class="pill">أنت</span>':"")+'</td><td><strong>'+r.points+'</strong></td><td>'+Number(r.attendance_rate||0)+'٪</td><td>'+Number(r.quran_rate||0)+'٪</td><td>'+Number(r.quiz_rate||0)+'٪</td><td>'+Number(r.challenge_rate||0)+'٪</td></tr>').join("")+'</tbody></table></div><p class="muted small">الترتيب للتحفيز فقط، ولا يحل محل تقدير المعلم لجودة الحفظ والتجويد والفهم.</p></section>';
  }catch(e){host.innerHTML='<div class="notice error">'+esc(e.message)+'</div>'}
 };
 $("#leaderboard-refresh")?.addEventListener("click",render);
 $("#leaderboard-group")?.addEventListener("change",render);
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
 let html=head("الرسائل","تواصل مع المعلم أو الإدارة من خلال رسائل خاصة لا يراها إلا طرفاها.");
 if(errors.length)html+='<div class="notice error">'+esc(errors.join(" · "))+'</div>';
 html+='<section class="card"><h3>رسالة جديدة</h3><form id="private-message-form" class="stack"><label class="field">إرسال إلى<select name="recipient_user_id" required><option value="">اختر المستلم</option>'+recipients.map(r=>'<option value="'+esc(r.id)+'">'+esc(r.name)+' — '+esc(ROLE_LABELS[r.role]||r.role)+'</option>').join("")+'</select></label><label class="field">عنوان الرسالة<input name="title" required maxlength="160" placeholder="موضوع مختصر وواضح"></label><label class="field">الرسالة<textarea name="content" required maxlength="8000" rows="4" placeholder="اكتب رسالتك باحترام ووضوح…"></textarea></label><button class="btn" type="submit" '+(recipients.length?"":"disabled")+'>إرسال الرسالة</button><p class="muted small">'+(recipients.length?"تظهر الرسالة للمرسل والمستلم فقط. يحدد النظام المستلمين المسموحين بحسب الدور والفوج.":"لا يوجد مستلم متاح لهذا الحساب حاليًا.")+'</p></form></section><div class="divider"></div><section class="messages-inbox"><div class="section-head"><div><h3>صندوق الرسائل</h3><p class="muted small">'+rows.filter(m=>!m.outgoing&&!m.read_at).length+' رسالة غير مقروءة</p></div><button class="btn secondary" id="refresh-messages" type="button">تحديث</button></div><div class="list">'+(rows.length?rows.map(m=>'<article class="card message-card"><div class="section-head"><div><span class="pill">'+(m.outgoing?"مرسلة":m.read_at?"مقروءة":"جديدة")+'</span><h3>'+esc(m.title)+'</h3><p class="muted small">'+(m.outgoing?"إلى: "+esc(m.recipient_name):"من: "+esc(m.sender_name))+' · '+esc(m.created_at||"")+'</p></div>'+(!m.outgoing&&!m.read_at?'<button class="btn secondary" type="button" data-message-read="'+esc(m.id)+'">تحديد كمقروءة</button>':"")+'</div><p class="content-body">'+esc(m.content)+'</p></article>').join(""):'<div class="empty">لا توجد رسائل بعد. يمكنك بدء تواصل خاص مع معلمك أو الإدارة.</div>')+'</div></section>';
 v.innerHTML=html;
 $("#private-message-form")?.addEventListener("submit",async e=>{e.preventDefault();const form=e.currentTarget,fd=new FormData(form),button=form.querySelector('button[type="submit"]');button.disabled=true;try{await api("/messages",{method:"POST",body:JSON.stringify({recipient_user_id:fd.get("recipient_user_id"),title:fd.get("title"),content:fd.get("content")})});toast("أُرسلت الرسالة");await page()}catch(err){toast(err.message,true);button.disabled=false}});
 $("#refresh-messages")?.addEventListener("click",()=>page());
 v.querySelectorAll("[data-message-read]").forEach(button=>button.addEventListener("click",async()=>{button.disabled=true;try{await api("/messages/read",{method:"POST",body:JSON.stringify({id:button.dataset.messageRead})});toast("تم تحديد الرسالة كمقروءة");await page()}catch(err){toast(err.message,true);button.disabled=false}}));
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
async function postsPage(v){
 let rows=[];try{rows=await api("/posts")}catch(e){v.innerHTML=head("مكتبة الشيخ","تعذّر تحميل المنشورات.")+'<div class="notice error">'+esc(e.message)+'</div>';return}
 const staff=["admin","director","teacher","supervisor"].includes(S.user.role);
 let html=head("مكتبة الشيخ","فوائد ومنشورات تربوية تظهر بحسب صلاحيات الحساب والفوج.");
 if(staff)html+='<section class="card"><h3>نشر فائدة أو منشور</h3><form id="post-form" class="stack"><label class="field">العنوان<input name="title" required maxlength="160"></label><label class="field">المحتوى<textarea name="content" required maxlength="6000" rows="5"></textarea></label><label class="field">الجمهور<select name="group_id" '+(S.user.role==="admin"?"":"required")+'>'+(S.user.role==="admin"?'<option value="">عام لجميع الطلاب</option>':'<option value="">اختر فوجًا</option>')+groupOpts()+'</select></label><button class="btn">نشر</button></form></section><div class="divider"></div>';
 html+='<div class="list">'+(rows.length?rows.map(p=>'<article class="card"><h3>'+esc(p.title)+'</h3><p class="content-body">'+esc(p.content)+'</p><small class="muted">'+(p.group_id?esc((S.groups.find(g=>g.id===p.group_id)||{}).name||"فوج"):"منشور عام")+' · '+esc(p.created_at||"")+'</small></article>').join(""):'<div class="empty">لا توجد منشورات حتى الآن.</div>')+'</div>';
 v.innerHTML=html;
 $("#post-form")?.addEventListener("submit",async e=>{e.preventDefault();const f=new FormData(e.currentTarget);try{await api("/posts",{method:"POST",body:JSON.stringify({title:f.get("title"),content:f.get("content"),group_id:f.get("group_id")})});toast("نُشر المحتوى");await page()}catch(x){toast(x.message,true)}});
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
