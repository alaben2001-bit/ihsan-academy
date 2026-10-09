'use strict';
/* أكاديمية بناء الإنسان — واجهة V22
   - لا يوجد onclick داخل HTML: كل التفاعل عبر data-act / data-in / data-ch / data-form (متوافق مع CSP).
   - كل نص قادم من الخادم يمر عبر html`` الذي يهرّب المحارف الخطرة تلقائيًا.
   - الصلاحيات الحقيقية في الخادم؛ الواجهة تُخفي ما لا يلزم فقط. */
(() => {
const $ = (s, r = document) => r.querySelector(s);
let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstallPrompt=e; const box=$('#installPrompt'); if(box) box.classList.remove('hidden'); });
window.addEventListener('appinstalled', () => { deferredInstallPrompt=null; const box=$('#installPrompt'); if(box) box.classList.add('hidden'); });
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('/service-worker.js').catch(()=>{}));
function setupInstallPrompt(){const b=$('#installBtn'),c=$('#installClose');if(b)b.onclick=async()=>{if(!deferredInstallPrompt)return;deferredInstallPrompt.prompt();await deferredInstallPrompt.userChoice;deferredInstallPrompt=null;$('#installPrompt')?.classList.add('hidden');};if(c)c.onclick=()=>$('#installPrompt')?.classList.add('hidden');}
window.addEventListener('DOMContentLoaded',setupInstallPrompt);
/* ── ديكور هادئ متجدد كل أسبوعين + أصوات تفاعلية اختيارية ── */
const THEME_NAMES = ['emerald','sand','indigo','olive'];
function setupAcademyAtmosphere(){
  const epoch = Math.floor(new Date('2026-01-01T00:00:00Z').getTime()/86400000);
  const todayEpoch = Math.floor(Date.now()/86400000);
  const storedTheme = localStorage.getItem('academy_theme');
  const theme = THEME_NAMES.includes(storedTheme) ? storedTheme : THEME_NAMES[Math.floor((todayEpoch-epoch)/14)%THEME_NAMES.length];
  document.documentElement.dataset.theme = theme;
  const reduce = localStorage.getItem('academy_reduced_motion') === '1' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if(reduce) document.documentElement.classList.add('reduced-motion');
  window.__academySound = window.__academySound !== false;
}
function academyTone(kind='soft'){
  if(window.__academySound===false) return;
  try{
    const C=window.AudioContext||window.webkitAudioContext; if(!C)return;
    const c=window.__academyAudio||(window.__academyAudio=new C());
    if(c.state==='suspended') c.resume().catch(()=>{});
    const o=c.createOscillator(), g=c.createGain();
    o.type='sine'; o.frequency.value=kind==='success'?660:kind==='message'?520:390;
    g.gain.setValueAtTime(.0001,c.currentTime); g.gain.exponentialRampToValueAtTime(.025,c.currentTime+.015); g.gain.exponentialRampToValueAtTime(.0001,c.currentTime+.11);
    o.connect(g);g.connect(c.destination);o.start();o.stop(c.currentTime+.12);
  }catch{}
}
window.addEventListener('DOMContentLoaded',setupAcademyAtmosphere);

window.addEventListener('DOMContentLoaded',async()=>{try{const schools=await fetch('/api/public/quran-schools').then(r=>r.json());const box=$('#quranSchools');if(box&&Array.isArray(schools))put(box,html`${schools.map(x=>html`<button type="button" class="portal-card" data-entry="quran"><span class="brandmark">ق</span><span><b>${x.name}</b><small>${x.description||'حفظ ومراجعة وتجويد وتربية'}</small></span></button>`)}`);}catch{}});
document.addEventListener('click',e=>{const tab=e.target.closest('[data-act="news-tab"]');if(tab){drawNewsTab(tab.dataset.tab);return;}const b=e.target.closest('[data-entry="quran"]');if(b){try{sessionStorage.setItem('academy_entry','quran')}catch{}} if(e.target.closest('button,.btn,.nav button,.portal-card')) academyTone('soft');});

const p2 = n => String(n).padStart(2, '0');
const today = () => { const d = new Date(); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`; };
const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

/* ── تهريب HTML تلقائي ── */
class Safe { constructor(s) { this.s = s; } }
const raw = s => new Safe(String(s));
const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const one = v => v instanceof Safe ? v.s : Array.isArray(v) ? v.map(one).join('') : esc(v);
const html = (st, ...v) => { let o = st[0]; v.forEach((x, i) => { o += one(x) + st[i + 1]; }); return new Safe(o); };
const put = (el, s) => { el.innerHTML = s instanceof Safe ? s.s : esc(s); };

const ICON = {
  home: 'M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  check: 'M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1zM8 6H6a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1h-2M9 14l2 2 4-4',
  doc: 'M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM14 3v5h5M9 13h6M9 17h6',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  group: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20a6 6 0 0 1 12 0M16 11a3 3 0 1 0 0-6M17 14a6 6 0 0 1 4 6',
  book: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19V5M8 7h7',
  news: 'M5 4h11a1 1 0 0 1 1 1v15H6a2 2 0 0 1-2-2V5a1 1 0 0 1 1-1zM17 8h3v10a2 2 0 0 1-2 2M8 8h6M8 12h6M8 16h4',
  bell: 'M6 17V11a6 6 0 1 1 12 0v6l2 2H4zM10 21h4',
  spark: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z',
  brain: 'M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 6 1V5a2 2 0 0 0-3-1zM15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-6 1',
  chart: 'M4 20V4M4 20h16M8 16v-5M12 16V8M16 16v-3',
  quran: 'M5 4h14a1 1 0 0 1 1 1v15H6a2 2 0 0 1-2-2V5a1 1 0 0 1 1-1zM8 8h8M8 12h6M8 16h8',
  tools: 'M4 7h10M18 7h2M4 17h2M10 17h10M14 5v4M8 15v4',
  trend: 'M4 17l5-5 4 4 7-8M15 8h5v5',
  print: 'M7 8V3h10v5M7 17H5a1 1 0 0 1-1-1v-6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1h-2M7 14h10v7H7z',
  plus: 'M12 5v14M5 12h14',
  back: 'M9 6l6 6-6 6',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  out: 'M10 4H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4M14 8l4 4-4 4M18 12H9',
  save: 'M5 4h11l3 3v13H5zM8 4v5h7V4M8 20v-6h8v6',
  calendar: 'M6 3v4M18 3v4M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1z',
  media: 'M4 5h16v14H4zM8 15l3-3 2 2 2-3 3 4M8 9h.01',
  mic: 'M12 15a3 3 0 0 0 3-3V7a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3zM5 12a7 7 0 0 0 14 0M12 19v3M8 22h8',
  play: 'M8 5v14l11-7z',
  bookmark: 'M6 4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17l-6-4-6 4z',
  discuss: 'M5 5h14v10H9l-4 4z',
  settings: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0-5 1 2.1a8 8 0 0 1 1.8.7L17 4l2 2-1.8 2.2c.3.6.5 1.2.7 1.8L20 11v2l-2.1 1c-.2.6-.4 1.2-.7 1.8L19 18l-2 2-2.2-1.8a8 8 0 0 1-1.8.7L12 21h-2l-1-2.1a8 8 0 0 1-1.8-.7L5 20l-2-2 1.8-2.2a8 8 0 0 1-.7-1.8L2 13v-2l2.1-1c.2-.6.4-1.2.7-1.8L3 6l2-2 2.2 1.8a8 8 0 0 1 1.8-.7L10 3z'
};
const ico = n => raw(`<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICON[n] || ''}"/></svg>`);

/* ── الحالة العامة ── */
const S = { token: null, user: null, groups: [], students: [], posts: [], notifications: [], subjects: [], quran: null, page: 'dashboard', att: {}, grading: null, file: { id: null, tab: 'overview', month: today().slice(0, 7), data: null }, rep: { student_id: null, month: today().slice(0, 7) } };

const PLAYER = { id: null, title: '', src: '', rate: 1 };
function mediaSrc(m){ return m?.url || (m?.file_path ? '/api/media/'+encodeURIComponent(m.id)+'/file' : ''); }
function showAudioDock(m){ const a=$('#academyPlayer'); if(!a)return; const src=mediaSrc(m); if(!src)return toast('لا يوجد تسجيل قابل للتشغيل',true); PLAYER.id=m.id; PLAYER.title=m.title; PLAYER.src=src; PLAYER.rate=Number(localStorage.getItem('academy_audio_rate')||'1')||1; $('#audioDockTitle').textContent=m.title||'تسجيل'; $('#audioDockMeta').textContent=(m.author_name||'مكتبة الأكاديمية')+' · استماع'; a.src=src; a.playbackRate=PLAYER.rate; const saved=JSON.parse(localStorage.getItem('academy_audio_'+m.id)||'null'); if(saved?.time>0){ try{a.currentTime=saved.time;}catch{} } $('#audioDock')?.classList.remove('hidden'); a.play().catch(()=>{}); post('/api/media/'+encodeURIComponent(m.id)+'/read',{}).catch(()=>{}); }
function closeAudioDock(){ const a=$('#academyPlayer'); if(a){a.pause();a.removeAttribute('src');a.load();} PLAYER.id=null; $('#audioDock')?.classList.add('hidden'); }
function setupAudioDock(){ const a=$('#academyPlayer'); if(!a)return; try{a.playbackRate=Number(localStorage.getItem('academy_audio_rate')||'1')||1;}catch{} a.addEventListener('timeupdate',()=>{ if(!PLAYER.id)return; try{localStorage.setItem('academy_audio_'+PLAYER.id,JSON.stringify({time:Math.floor(a.currentTime),rate:a.playbackRate}));}catch{} }); a.addEventListener('ratechange',()=>{ PLAYER.rate=a.playbackRate; try{localStorage.setItem('academy_audio_rate',String(a.playbackRate));}catch{} }); $('#audioDockClose')?.addEventListener('click',closeAudioDock); }

window.addEventListener('DOMContentLoaded',setupAudioDock);
// ومضات تربوية أصلية تتبدل بحسب اليوم، دون نسبتها إلى مصدر شرعي.
const dailyTips = [
  "لا تجعل كثرة البدايات تغريك؛ العبرة بحسن الإتمام والثبات.",
  "إذا تعلمت مسألة، فاسأل نفسك: كيف أعمل بها؟ وكيف أعلّمها بأدب؟",
  "ليس النجاح أن تسبق الناس كلهم؛ بل أن تتقدم اليوم على تقصير الأمس.",
  "احفظ للعلم هيبته بالتواضع، وللمتعلم حقه بالرفق، وللوقت حرمته.",
  "ابدأ بمهمة صغيرة تؤديها بإتقان؛ فالإتقان عادة تُبنى بالتكرار.",
  "اجعل للقرآن نصيبًا ثابتًا من يومك، لا فضلة الوقت فقط.",
  "إذا أخطأت في التعلم، صحح الخطأ وافهم سببه ثم أعد المحاولة.",
  "العلم النافع يزيد صاحبه بصيرة وتواضعًا وحسن عمل."
];
function setDailyTip() {
  const node = document.getElementById('dailyTip');
  if (!node) return;
  const day = Math.floor(Date.now() / 86400000);
  node.textContent = dailyTips[((day % dailyTips.length) + dailyTips.length) % dailyTips.length];
}
setDailyTip();
document.addEventListener('click', event => {
  const button = event.target.closest('[data-theme-option]');
  if (!button) return;
  const form = button.closest('form[data-form="settings"]');
  if (!form || !form.elements.theme) return;
  const theme = button.dataset.themeOption;
  form.elements.theme.value = theme;
  document.documentElement.dataset.theme = theme;
  localStorage.setItem('academy_theme', theme);
  form.querySelectorAll('[data-theme-option]').forEach(option => {
    const selected = option === button;
    option.classList.toggle('selected', selected);
    option.setAttribute('aria-pressed', selected ? 'true' : 'false');
  });
});

const ROLE = { admin: 'مدير الأكاديمية', chief_supervisor: 'المشرف الرئيسي', teacher: 'الشيخ / المعلم', student: 'الطالب', parent: 'ولي الأمر' };
const ATT = [['present', 'حاضر', 'ok'], ['late', 'متأخر', 'late'], ['absent', 'غائب', 'bad'], ['excused', 'غائب بعذر', 'info']];
const attLabel = k => (ATT.find(a => a[0] === k) || [k, k, ''])[1];
const attTone = k => (ATT.find(a => a[0] === k) || [0, 0, ''])[2];
const CATS = ['تعليمي', 'سلوكي', 'تحفيزي', 'متابعة'];
const V = () => $('#view');

const fmtDate = d => { try { return new Date(d + 'T12:00:00').toLocaleDateString('ar-u-nu-latn', { weekday: 'long', day: 'numeric', month: 'long' }); } catch { return d; } };
const fmtStamp = s => /^\d{4}-\d{2}-\d{2}/.test(s || '') ? fmtDate(String(s).slice(0, 10)) : (s || '');
const clamp = p => Math.max(0, Math.min(100, Number(p) || 0));
const pct = v => v == null ? '—' : v + '%';
const bar = p => html`<div class="progress"><i data-w="${clamp(p)}"></i></div>`;
const empty = (t, s = '') => html`<div class="empty"><b>${t}</b>${s}</div>`;
const initial = n => String(n || '؟').trim()[0] || '؟';

function render(s) { put(V(), s); requestAnimationFrame(() => document.querySelectorAll('.progress i[data-w]').forEach(i => { i.style.width = i.dataset.w + '%'; })); }
let toastT;
function toast(msg, err) { const t = $('#toast'); t.textContent = msg; t.className = 'toast show' + (err ? ' err' : ''); clearTimeout(toastT); toastT = setTimeout(() => { t.className = 'toast'; }, 2600); }

async function api(url, opt = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (S.token) headers.Authorization = 'Bearer ' + S.token;
  const r = await fetch(url, { ...opt, headers });
  let d = {}; try { d = await r.json(); } catch { /* لا شيء */ }
  if (r.status === 401 && S.token && url !== '/api/login') { endSession(); throw new Error('انتهت الجلسة، سجّل الدخول مجددًا'); }
  if (!r.ok) throw new Error(d.error || 'حدث خطأ');
  return d;
}
const post = (url, data) => api(url, { method: 'POST', body: JSON.stringify(data || {}) });
async function guard(fn) { try { return await fn(); } catch (e) { toast(e.message, true); } }

/* ── الجلسة ── */
function endSession() { S.token = null; S.user = null; try { sessionStorage.removeItem('ab_token'); sessionStorage.removeItem('academy_entry'); } catch { /* */ } try { history.replaceState({ academy: true, page: 'login' }, '', location.pathname); } catch { /* */ } closeOverlay(); showLogin(); }
function showLogin() { $('#appView').classList.add('hidden'); $('#loginView').classList.remove('hidden'); $('#loginPass').value = ''; }
function establishHistoryGuard(page = 'dashboard') {
  const url = location.pathname + '#' + encodeURIComponent(page);
  try {
    history.replaceState({ academy: true, page, root: true }, '', url);
    history.pushState({ academy: true, page, guard: true }, '', url);
  } catch { /* history may be unavailable in embedded contexts */ }
}
async function startSession() {
  S.user = await api('/api/me');
  const [groups, students, notifs, posts, subjects] = await Promise.all([api('/api/groups'), api('/api/students'), api('/api/notifications'), api('/api/posts'), api('/api/subjects')]);
  Object.assign(S, { groups, students, notifications: notifs, posts, subjects });
  $('#loginView').classList.add('hidden'); $('#appView').classList.remove('hidden');
  $('#accName').textContent = S.user.role === 'admin' ? '' : S.user.name; $('#accRole').textContent = ROLE[S.user.role]; document.documentElement.dataset.role = S.user.role; document.documentElement.dataset.theme = S.user.theme || 'emerald'; document.documentElement.style.fontSize=(Number(S.user.font_scale)||1)+'em'; document.documentElement.classList.toggle('high-contrast',!!S.user.high_contrast); document.documentElement.classList.toggle('reduced-motion',!!S.user.reduced_motion);
  put($('#logoutBtn'), ico('out'));
  buildNav();
  const entry = sessionStorage.getItem('academy_entry') || ''; sessionStorage.removeItem('academy_entry');
  const landing = entry === 'quran' ? 'quran' : 'dashboard';
  establishHistoryGuard(landing);
  showPage(landing, { history: false });
}

/* ── التنقل ── */
const isStaff = () => S.user && (S.user.role === 'admin' || S.user.role === 'teacher');
function navGroups() {
  const n = (id, label, ic) => [id, label, ic];
  const common = [n('academy-map', 'خريطة الأكاديمية والصلاحيات', 'chart'), n('school-directory', 'هيكلة المدرسة', 'users'), n('news', 'مكتبة الشيخ والمنشورات', 'news'), n('community', 'مجتمع التعلم', 'discuss'), n('notifications', 'الإشعارات', 'bell'), n('settings', 'الإعدادات والخصوصية', 'settings')];
  const group = (label, items) => ({ label, items });
  if (S.user.role === 'admin') return [
    group('الرئيسية', [n('dashboard', 'الرئيسية', 'home'), n('quran', 'المدرسة القرآنية', 'quran')]),
    group('القيادة والإدارة', [n('hierarchy', 'هيكلة المنصة', 'group'), n('admin', 'الإدارة العليا', 'tools'), n('ops', 'مركز التشغيل', 'trend')]),
    group('التعليم والمنهج', [n('program', 'البرامج', 'book'), n('curriculum', 'المواد والمنهج', 'book')]),
    group('الطلبة والمتابعة', [n('students', 'الطلاب', 'user'), n('groups', 'الأفواج', 'group'), n('teams', 'فرق المدرسة', 'group'), n('attendance', 'الحضور', 'check'), n('tracking', 'المتابعة', 'trend'), n('tests', 'الاختبارات', 'doc'), n('assignments', 'الواجبات', 'doc')]),
    group('الخدمات والتواصل', [n('calendar', 'التقويم', 'calendar'), n('transport', 'النقل الجماعي', 'bus'), n('messages', 'المراسلات', 'bell'), n('media', 'مكتبة الشيخ', 'media'), n('question-bank', 'بنك الأسئلة', 'doc')]),
    group('عام', common)
  ];
  if (S.user.role === 'chief_supervisor') return [
    group('الإشراف', [n('dashboard', 'الرئيسية', 'home'), n('school-directory', 'هيكلة المدرسة', 'users'), n('teams', 'فرق المدرسة', 'group'), n('supervisor-requests', 'طلبات الإشراف', 'check')]),
    group('عام', [n('notifications', 'الإشعارات', 'bell'), n('settings', 'الإعدادات والخصوصية', 'settings')])
  ];
  if (S.user.role === 'teacher') return [
    group('الرئيسية', [n('dashboard', 'الرئيسية', 'home'), n('teacher-tools', 'لوحة المعلم', 'tools'), n('quran', 'المدرسة القرآنية', 'quran')]),
    group('طلبتي', [n('students', 'طلبتي', 'user'), n('groups', 'الأفواج', 'group'), n('teams', 'فرق المدرسة', 'group'), n('attendance', 'الحضور', 'check'), n('tracking', 'المتابعة', 'trend')]),
    group('التعليم والتقويم', [n('curriculum', 'المواد والمنهج', 'book'), n('tests', 'الاختبارات', 'doc'), n('assignments', 'الواجبات', 'doc'), n('question-bank', 'بنك الأسئلة', 'doc')]),
    group('الخدمات والتواصل', [n('calendar', 'التقويم', 'calendar'), n('transport', 'النقل الجماعي', 'bus'), n('messages', 'المراسلات', 'bell'), n('media', 'مكتبة الشيخ', 'media')]),
    group('عام', common)
  ];
  if (S.user.role === 'student') return [
    group('يومي', [n('dashboard', 'الرئيسية', 'home'), n('quran', 'المدرسة القرآنية', 'quran'), n('journey', 'رحلتي', 'trend'), n('learning', 'تعلّمي', 'brain'), n('tasks', 'مهامي', 'check'), n('profile', 'ملفي', 'user')]),
    group('دراستي', [n('reports', 'تقاريري', 'chart'), n('tests', 'اختباراتي', 'doc'), n('curriculum', 'المواد والمنهج', 'book'), n('assignments', 'الواجبات', 'doc'), n('question-bank', 'اختبر نفسك', 'doc')]),
    group('مدرستي', [n('groups', 'الأفواج والطلبات', 'group'), n('teams', 'فريقي', 'group'), n('calendar', 'التقويم', 'calendar'), n('transport', 'النقل الجماعي', 'bus'), n('messages', 'المراسلات', 'bell'), n('media', 'مكتبة الشيخ', 'media')]),
    group('عام', common)
  ];
  return [
    group('الرئيسية', [n('dashboard', 'الرئيسية', 'home'), n('quran', 'المدرسة القرآنية', 'quran')]),
    group('الأبناء والمتابعة', [n('children', 'أبنائي', 'user'), n('reports', 'التقارير', 'chart'), n('tests', 'الاختبارات', 'doc'), n('groups', 'الأفواج والطلبات', 'group')]),
    group('الخدمات', [n('calendar', 'التقويم', 'calendar'), n('transport', 'النقل الجماعي', 'bus'), n('media', 'مكتبة الشيخ', 'media')]),
    group('عام', common)
  ];
}
function navItems() { return navGroups().flatMap(g => g.items); }
function buildNav() {
  const groups = navGroups();
  const items = groups.flatMap(g => g.items);
  put($('#nav'), html`${groups.map(g => html`<div class="nav-group"><div class="nav-label">${g.label}</div>${g.items.map(([id, l, ic]) => html`<button data-act="nav" data-page="${id}" title="${l}">${ico(ic)}<span>${l}</span></button>`)}</div>`)}`);
  const mainIds = S.user.role === 'student' ? ['dashboard', 'learning-hub', 'media'] : S.user.role === 'teacher' ? ['dashboard', 'students', 'curriculum'] : S.user.role === 'admin' ? ['dashboard', 'students', 'curriculum'] : S.user.role === 'chief_supervisor' ? ['dashboard', 'teams', 'school-directory'] : ['dashboard', 'children', 'media'];
  const main = mainIds.map(id => items.find(x => x[0] === id) || (id === 'learning-hub' ? ['learning-hub','برنامج التعلّم','brain'] : null)).filter(Boolean);
  put($('#bottomNav'), html`${main.map(([id, l, ic]) => html`<button data-act="nav" data-page="${id}">${ico(ic)}<span>${l}</span></button>`)}<button data-act="more">${ico('more')}<span>المزيد</span></button>`);
}


async function pgJourney(){
  if(S.user.role!=='student'){ return showPage('dashboard'); }
  const [j,c]=await Promise.all([api('/api/journey'),api('/api/challenges')]);
  const done=j.items.filter(x=>x.status==='done').length;
  render(html`<div class="stack">
    <div class="card hero"><span class="eyebrow">رحلتي</span><h2>أنت تبني نفسك خطوة خطوة</h2><p>تعلم على دفعات صغيرة، واكتشف تقدمك من خلال إنجازاتك ومهامك الواضحة.</p><div class="progress" style="margin-top:16px"><i style="width:${j.progress}%"></i></div><div class="row wrap" style="margin-top:10px;justify-content:space-between"><span class="muted small">${done} من ${j.items.length} مهام مكتملة</span><b>${j.progress}%</b></div></div>
    <div class="grid g3">${j.items.map(x=>html`<div class="card"><div class="row"><span class="badge">${x.level}</span>${x.status==='done'?html`<span class="badge ok">مكتمل</span>`:html`<span class="badge gold">قادم</span>`}</div><h3 style="margin-top:12px">${x.title}</h3><p class="muted">${x.description||''}</p>${x.status!=='done'?html`<button class="btn sm" data-act="journey-done" data-id="${x.id}">أنجزت هذا</button>`:''}</div>`)}</div>
    <div class="card"><div class="sec"><div><h3>تحديات الزملاء</h3><p class="muted">تحدٍ اختياري للمنافسة النظيفة، دون ربط القيمة الشخصية بالنتيجة.</p></div></div>${c.length?c.map(x=>html`<div class="item"><div class="row wrap"><div><b>${x.title}</b><p>${x.description||''}</p></div><span class="badge">${x.participants} مشارك</span></div>${x.joined?html`<span class="badge ok">أنت مشارك</span>`:html`<button class="btn sm" data-act="challenge-join" data-id="${x.id}">أشارك</button>`}</div>`):empty('لا توجد تحديات حاليًا')}</div>
  </div>`);
}
async function openSubjectModal(id){ const c=await api('/api/program'); const x=id?c.subjects.find(s=>s.id===id):null; openModal(x?'تعديل المادة':'مادة جديدة',html`<form data-form="program-subject" data-id="${x?.id||''}" class="stack"><label class="field"><span>اسم المادة</span><input name="name" required maxlength="120" value="${x?.name||''}"></label><div class="two"><label class="field"><span>المجال</span><input name="category" value="${x?.category||''}"></label><label class="field"><span>طريقة التعلم</span><select name="learning_mode">${[['memorize','حفظ'],['understand','فهم'],['review','مراجعة'],['apply','تطبيق'],['discussion','نقاش'],['optional','اختياري']].map(([v,l])=>html`<option value="${v}"${x?.learning_mode===v?' selected':''}>${l}</option>`)}</select></label></div><label class="field"><span>وصف المادة</span><textarea name="description" rows="3">${x?.description||''}</textarea></label><label class="field"><span>كيف تُدرس؟</span><textarea name="study_method" rows="3">${x?.study_method||''}</textarea></label><label class="showpw"><input type="checkbox" name="required"${x?.required!==false?' checked':''}><span>مادة أساسية</span></label><button class="btn">حفظ</button></form>`); }
async function openLessonModal(id,subjectId){
 const c=await api('/api/program'); const x=id?c.lessons.find(l=>l.id===id):null; const ct=x?.content||{};
 openModal(x?'تعديل الدرس':'درس جديد',html`<form data-form="program-lesson" data-id="${x?.id||''}" class="stack">
 <label class="field"><span>المادة</span><select name="subject_id" required>${c.subjects.map(s=>html`<option value="${s.id}"${(x?.subject_id===s.id||(!x&&subjectId===s.id))?' selected':''}>${s.name}</option>`)}</select></label>
 <label class="field"><span>عنوان الدرس</span><input name="title" required maxlength="160" value="${x?.title||''}"></label>
 <label class="field"><span>وصف مختصر</span><textarea name="description" rows="3">${x?.description||''}</textarea></label>
 <label class="field"><span>طريقة دراسة الدرس</span><textarea name="study_method" rows="3">${x?.study_method||''}</textarea></label>
 <label class="field"><span>نوع الدرس</span><select name="learning_mode">${[['memorize','حفظ'],['understand','فهم'],['review','مراجعة'],['apply','تطبيق'],['discussion','نقاش']].map(([v,l])=>html`<option value="${v}"${x?.learning_mode===v?' selected':''}>${l}</option>`)}</select></label>
 <div class="card flat"><b>مجلس الدرس</b><p class="muted small">اكتب المادة كما سيقرؤها الطالب، لا كعنوان تقني مختصر.</p></div>
 <label class="field"><span>افتتاحية الشيخ</span><textarea name="opening" rows="5">${ct.opening||''}</textarea></label>
 <label class="field"><span>القصة والموعظة</span><textarea name="story" rows="6">${ct.story||''}</textarea></label>
 <label class="field"><span>الشرح الموسع</span><textarea name="explanation" rows="10">${ct.explanation||''}</textarea></label>
 <label class="field"><span>الأمثلة — كل سطر مثال</span><textarea name="examples" rows="4">${(ct.examples||[]).join('\n')}</textarea></label>
 <label class="field"><span>أسئلة التدبر والنقاش — كل سطر سؤال</span><textarea name="reflection_questions" rows="4">${(ct.reflection_questions||[]).join('\n')}</textarea></label>
 <label class="field"><span>العمل الأسبوعي</span><textarea name="action" rows="4">${ct.action||''}</textarea></label>
 <label class="field"><span>الحفظ والمراجعة</span><textarea name="memorize" rows="3">${ct.memorize||''}</textarea></label>
 <label class="field"><span>ملاحظات المصادر</span><textarea name="source_notes" rows="3">${ct.source_notes||''}</textarea></label>
 <label class="field"><span>حالة المادة الشرعية</span><select name="source_status"><option value="draft"${ct.source_status==='draft'?' selected':''}>مسودة</option><option value="needs_review"${ct.source_status==='needs_review'?' selected':''}>تحتاج مراجعة الشيخ</option><option value="verified"${ct.source_status==='verified'?' selected':''}>مراجعة المصدر مكتملة</option></select></label>
 <button class="btn">حفظ الدرس والمجلس</button></form>`);
}
async function openSubjectLessons(id){ const c=await api('/api/program'); const s=c.subjects.find(x=>x.id===id); const ls=c.lessons.filter(x=>x.subject_id===id && x.active!==false); openModal('دروس: '+(s?.name||''),html`<div class="stack">${ls.length?ls.map(l=>html`<div class="item"><div class="row wrap"><div><b>${l.title}</b><p class="muted small">${l.description||''}</p></div><button class="btn sm sec2" data-act="edit-lesson" data-id="${l.id}">تعديل</button></div></div>`):empty('لا توجد دروس بعد')}<button class="btn" data-act="new-lesson-for" data-id="${id}">إضافة درس لهذه المادة</button></div>`); }
async function pgProgram(){
  if(S.user.role!=='admin') return showPage('dashboard');
  const c=await api('/api/program'); const plans=await api('/api/plans'); const activeYear=c.academic_years.find(x=>x.active)||c.academic_years[0]; const activeTerms=c.terms.filter(t=>t.active!==false);
  render(html`<div class="stack"><div class="card hero"><div class="sec"><div><span class="eyebrow">بناء المنهج V27</span><h2>المنهج داخل سنة دراسية واضحة</h2><p>المواد والدروس والبرنامج الأسبوعي مرتبطة بالسنة والفصل، حتى تبقى الخطة قابلة للمتابعة والتقرير.</p></div><div class="row wrap"><button class="btn sm" data-act="new-academic-year">${ico('plus')} سنة دراسية</button><button class="btn sm sec2" data-act="new-term">${ico('plus')} فصل</button></div></div><div class="grid g3" style="margin-top:14px"><div class="card"><span class="muted small">السنة النشطة</span><h3>${activeYear?.name||'—'}</h3><p>${activeYear?fmtDate(activeYear.start)+' — '+fmtDate(activeYear.end):'لم تُحدد'}</p></div>${activeTerms.slice(0,2).map(t=>html`<div class="card"><span class="muted small">فصل</span><h3>${t.name}</h3><p>${fmtDate(t.start)} — ${fmtDate(t.end)}</p><button class="btn sm sec2" data-act="edit-term" data-id="${t.id}">تعديل</button></div>`)}</div></div><div class="row wrap"><button class="btn sm" data-act="new-subject">${ico('plus')} مادة جديدة</button><button class="btn sm sec2" data-act="new-lesson">${ico('plus')} درس جديد</button><button class="btn sm sec2" data-act="new-plan">${ico('plus')} خطة أسبوعية/شهرية</button></div><div class="grid g3">${c.subjects.map(x=>html`<div class="card"><div class="row"><b>${x.name}</b><span class="badge">${x.required?'أساسي':'اختياري'}</span></div><p>${x.description||''}</p><div class="chips"><span class="chip">${x.learning_mode}</span><span class="chip">${x.study_method||''}</span></div><p class="muted small">${c.lessons.filter(l=>l.subject_id===x.id && l.active!==false).length} درس</p><div class="row wrap"><button class="btn sm sec2" data-act="edit-subject" data-id="${x.id}">تعديل المادة</button><button class="btn sm sec2" data-act="edit-subject-lessons" data-id="${x.id}">دروس المادة</button></div></div>`)}</div><div class="card"><div class="sec"><div><h3>البرامج والخطط</h3><p class="muted">خطة خفيفة ومتدرجة، تُعرض للطالب وولي الأمر دون إرهاق.</p></div></div><div class="grid g3">${plans.map(x=>html`<div class="item"><div class="row wrap"><span class="badge">${x.type==='weekly'?'أسبوعية':x.type==='monthly'?'شهرية':'سنوية'}</span><span class="badge ${x.published?'ok':'gold'}">${x.published?'منشورة':'مسودة'}</span></div><b>${x.title}</b><p class="muted small">${x.description||''}</p><p class="muted small">${(x.items||[]).length} عناصر${x.start?` · ${fmtDate(x.start)}${x.end?' — '+fmtDate(x.end):''}`:''}</p><div class="row wrap"><button class="btn sm sec2" data-act="edit-plan" data-id="${x.id}">تعديل</button></div></div>`)}</div></div></div>`);
}
function openAcademicYearModal(){ openModal('سنة دراسية جديدة',html`<form data-form="academic-year" class="stack"><label class="field"><span>الاسم</span><input name="name" required placeholder="2028–2029"></label><div class="two"><label class="field"><span>البداية</span><input name="start" type="date" required></label><label class="field"><span>النهاية</span><input name="end" type="date" required></label></div><label class="showpw"><input type="checkbox" name="active" checked><span>تفعيلها مباشرة</span></label><button class="btn">حفظ</button></form>`); }
async function openTermModal(id){ const c=await api('/api/program'); const t=c.terms.find(x=>x.id===id); openModal(t?'تعديل الفصل':'فصل جديد',html`<form data-form="term" data-id="${t?.id||''}" class="stack"><label class="field"><span>السنة الدراسية</span><select name="academic_year_id">${c.academic_years.map(y=>html`<option value="${y.id}"${y.id===(t?.academic_year_id||c.academic_years.find(x=>x.active)?.id)?raw(' selected'):''}>${y.name}</option>`)}</select></label><label class="field"><span>اسم الفصل</span><input name="name" required value="${t?.name||''}"></label><div class="two"><label class="field"><span>البداية</span><input name="start" type="date" required value="${t?.start||''}"></label><label class="field"><span>النهاية</span><input name="end" type="date" required value="${t?.end||''}"></label></div><label class="showpw"><input type="checkbox" name="active"${t?.active!==false?' checked':''}><span>الفصل نشط</span></label><button class="btn">حفظ</button></form>`); }
async function openPlanModal(id){ const plans=await api('/api/plans'); const c=await api('/api/program'); const x=id?plans.find(p=>p.id===id):null; openModal(x?'تعديل الخطة':'خطة جديدة',html`<form data-form="learning-plan" data-id="${x?.id||''}" class="stack"><div class="two"><label class="field"><span>نوع الخطة</span><select name="type">${[['weekly','أسبوعية'],['monthly','شهرية'],['annual','سنوية']].map(([v,l])=>html`<option value="${v}"${x?.type===v?' selected':''}>${l}</option>`)}</select></label><label class="field"><span>العنوان</span><input name="title" required maxlength="160" value="${x?.title||''}"></label></div><div class="two"><label class="field"><span>البداية</span><input name="start" type="date" value="${x?.start||''}"></label><label class="field"><span>النهاية</span><input name="end" type="date" value="${x?.end||''}"></label></div><label class="field"><span>الفوج المستهدف</span><select name="group_id"><option value="">كل الأفواج</option>${c.groups.map(g=>html`<option value="${g.id}"${x?.group_id===g.id?' selected':''}>${g.name}</option>`)}</select></label><label class="field"><span>الوصف</span><textarea name="description" rows="3">${x?.description||''}</textarea></label><label class="field"><span>العناصر — كل سطر مهمة/درس</span><textarea name="items" rows="6">${(x?.items||[]).join('\n')}</textarea></label><label class="showpw"><input type="checkbox" name="published"${x?.published?' checked':''}><span>منشورة للطلاب</span></label><button class="btn">حفظ الخطة</button></form>`); }

/* ═══════════ V44–V49: القرآن المتقدم، الاختبارات، المجتمع، الإعدادات والتشغيل ═══════════ */
async function pgQuestionBank(){
  const qs=await api('/api/question-bank'); const attempts=await api('/api/question-attempts');
  if(isStaff()) render(html`<div class="stack"><div class="card hero hero-main"><div class="hero-copy"><span class="eyebrow">بنك الأسئلة</span><h2>نسأل لنفهم، لا لنخاف من الاختبار</h2><p>أسئلة قصيرة ومتنوعة تعين الشيخ على قياس الفهم، وتعين الطالب على اكتشاف ما يحتاج إلى مراجعة.</p></div><div class="hero-orbit"><span>؟</span><i></i><i></i></div></div><div class="row wrap"><button class="btn" data-act="new-question">${ico('plus')} إضافة سؤال</button><button class="btn sec2" data-act="nav" data-page="tests">الاختبارات والدرجات</button></div><div class="grid g2">${qs.length?qs.map(q=>html`<div class="card"><div class="row"><span class="badge">${q.type==='single_choice'?'اختيار واحد':q.type==='multiple_choice'?'اختيارات متعددة':q.type==='true_false'?'صح أو خطأ':'إجابة قصيرة'}</span><span class="badge">${q.points} نقطة</span></div><h3 style="margin-top:10px">${q.title}</h3><p class="muted small">${q.explanation||'لا يوجد شرح تصحيحي بعد.'}</p><div class="chips">${(q.options||[]).slice(0,5).map(o=>html`<span class="chip">${o}</span>`)}</div></div>`):empty('لا توجد أسئلة بعد','أضف أول سؤال إلى بنك الأكاديمية.')}</div><div class="card"><div class="sec"><h3>آخر المحاولات</h3><span class="badge">${attempts.length}</span></div>${attempts.slice(0,12).map(a=>html`<div class="item"><div class="row"><b>${a.student_name||'طالب'}</b><span class="badge ${a.status==='graded'?'ok':'gold'}">${a.score==null?'بانتظار التصحيح':a.score+' / '+a.max_score}</span></div><p>${a.question?.title||'سؤال'}</p><p class="muted small">${fmtStamp(a.submitted_at)}</p></div>`)}</div></div>`);
  else render(html`<div class="stack"><div class="card hero hero-main"><div class="hero-copy"><span class="eyebrow">اختبر نفسك</span><h2>خذ سؤالًا واحدًا، ثم فكّر قبل أن تجيب</h2><p>الاختبار هنا وسيلة للمراجعة وقياس الفهم، وليس حكمًا على قيمة الطالب.</p></div><div class="hero-orbit"><span>؟</span><i></i><i></i></div></div><div class="grid g2">${qs.length?qs.map(q=>html`<div class="card"><div class="row"><span class="badge">${q.type==='single_choice'?'اختيار واحد':q.type==='multiple_choice'?'اختيارات متعددة':q.type==='true_false'?'صح أو خطأ':'إجابة قصيرة'}</span><span class="badge">${q.points} نقطة</span></div><h3 style="margin-top:10px">${q.title}</h3><button class="btn" style="margin-top:12px" data-act="solve-question" data-id="${q.id}">${ico('play')} أجيب عن السؤال</button></div>`):empty('لا توجد أسئلة منشورة بعد','سيظهر هنا ما ينشره الشيخ.')}</div><div class="card"><div class="sec"><h3>محاولاتي</h3><button class="btn sec2 sm" data-act="nav" data-page="reports">التقارير</button></div>${attempts.filter(a=>a.student_id===((S.students.find(x=>x.user_id===S.user.id)||S.students[0])||{}).id).slice(0,10).map(a=>html`<div class="item"><div class="row"><b>${a.question?.title||'سؤال'}</b><span class="badge ${a.status==='graded'?'ok':'gold'}">${a.score==null?'قيد المراجعة':a.score+' / '+a.max_score}</span></div><p class="muted small">${fmtStamp(a.submitted_at)}</p>${a.feedback?html`<p>${a.feedback}</p>`:''}</div>`)}</div></div>`);
}
function openQuestionModal(){
  if(!isStaff())return;
  openModal('إضافة سؤال إلى بنك الأسئلة',html`<form data-form="question" class="form"><label class="field"><span>السؤال</span><textarea name="title" rows="4" maxlength="400" required></textarea></label><div class="two"><label class="field"><span>النوع</span><select name="type"><option value="single_choice">اختيار واحد</option><option value="multiple_choice">اختيارات متعددة</option><option value="true_false">صح أو خطأ</option><option value="short_answer">إجابة قصيرة</option></select></label><label class="field"><span>الدرجة</span><input name="points" type="number" min="1" max="100" value="1"></label></div><label class="field"><span>الخيارات (كل سطر خيار)</span><textarea name="options" rows="5" placeholder="يظهر للاختيار من بينها"></textarea></label><label class="field"><span>الإجابة الصحيحة</span><input name="correct_answer" maxlength="300" placeholder="في الاختيارات: اكتب نص الخيار المطابق"></label><label class="field"><span>شرح التصحيح</span><textarea name="explanation" rows="4" maxlength="1200"></textarea></label><div class="two"><label class="field"><span>المادة</span><select name="subject_id"><option value="">عام</option>${S.subjects.map(x=>html`<option value="${x.id}">${x.name}</option>`)}</select></label><label class="field"><span>الفوج</span><select name="group_id"><option value="">كل النطاق</option>${S.groups.map(x=>html`<option value="${x.id}">${x.name}</option>`)}</select></label></div><button class="btn">حفظ السؤال</button></form>`);
}
async function openQuestionSolve(id){ const qs=await api('/api/question-bank'); const q=qs.find(x=>x.id===id); if(!q)return toast('السؤال غير موجود',true); const choice=q.type==='single_choice'?html`${q.options.map(o=>html`<label class="choice"><input type="radio" name="answer" value="${o}" required><span>${o}</span></label>`)}`:q.type==='multiple_choice'?html`${q.options.map(o=>html`<label class="choice"><input type="checkbox" name="answer" value="${o}"><span>${o}</span></label>`)}`:q.type==='true_false'?html`<div class="chips"><label class="choice"><input type="radio" name="answer" value="true" required><span>صحيح</span></label><label class="choice"><input type="radio" name="answer" value="false"><span>خطأ</span></label></div>`:html`<textarea name="answer" rows="6" maxlength="1200" required placeholder="اكتب إجابتك بهدوء…"></textarea>`; openModal('حل السؤال',html`<form data-form="question-attempt" data-id="${q.id}" class="form"><div class="question-prompt"><span class="eyebrow">${q.points} نقطة</span><h3>${q.title}</h3></div>${choice}<button class="btn" type="submit">إرسال الإجابة</button></form>`); }

async function pgCommunity(){ const ds=await api('/api/discussions'); render(html`<div class="stack"><div class="card hero hero-main"><div class="hero-copy"><span class="eyebrow">مجتمع التعلم</span><h2>اسأل، ناقش، واستفد بأدب</h2><p>النقاش هنا جزء من التعلم: سؤال حسن، جواب نافع، واحترام للعلم والناس.</p></div><div class="hero-orbit"><span>ح</span><i></i><i></i></div></div><div class="row wrap"><button class="btn" data-act="new-discussion">${ico('plus')} موضوع جديد</button><button class="btn sec2" data-act="nav" data-page="media">المكتبة</button></div><div class="grid g2">${ds.length?ds.map(d=>html`<article class="card"><div class="row wrap"><div><span class="eyebrow">${d.group_id?'نقاش المجموعة':'نقاش عام'}</span><h3>${d.title}</h3></div><span class="badge ${d.status==='open'?'ok':'late'}">${d.status==='open'?'مفتوح':'مغلق'}</span></div><p>${d.content}</p><div class="row small muted"><span>${d.author_name}</span><span>${d.replies_count} رد</span><button class="btn sm sec2" data-act="open-discussion" data-id="${d.id}">فتح النقاش</button></div></article>`):empty('لا توجد نقاشات بعد','كن أول من يفتح بابًا نافعًا للنقاش.')}</div></div>`); }
async function openDiscussion(id){ const ds=await api('/api/discussions'), d=ds.find(x=>x.id===id), replies=await api('/api/discussions/'+encodeURIComponent(id)+'/replies'); if(!d)return toast('الموضوع غير موجود',true); openModal(d.title,html`<div class="stack"><div class="card flat"><p style="white-space:pre-wrap">${d.content}</p><p class="muted small">${d.author_name} · ${fmtStamp(d.created_at)}</p></div><div>${replies.length?replies.map(r=>html`<div class="item"><div class="row"><b>${r.author_name}</b><span class="muted small">${fmtStamp(r.created_at)}</span></div><p style="white-space:pre-wrap">${r.content}</p></div>`):empty('لا ردود بعد')}</div>${d.status==='open'?html`<form data-form="discussion-reply" data-id="${d.id}" class="form"><textarea name="content" rows="4" maxlength="1800" placeholder="اكتب ردك…" required></textarea><button class="btn">إضافة الرد</button></form>`:empty('الموضوع مغلق')}</div>`); }
function openDiscussionModal(){ openModal('موضوع جديد',html`<form data-form="discussion" class="form"><label class="field"><span>العنوان</span><input name="title" maxlength="180" required></label><label class="field"><span>المحتوى</span><textarea name="content" rows="7" maxlength="2500" required></textarea></label><label class="field"><span>النطاق</span><select name="group_id"><option value="">عام</option>${S.groups.map(g=>html`<option value="${g.id}">${g.name}</option>`)}</select></label><button class="btn">نشر الموضوع</button></form>`); }

async function pgSettings(){ const st=await api('/api/settings'); render(html`<div class="stack"><div class="card hero"><span class="eyebrow">راحة العين والعقل</span><h2>إعداداتك في الأكاديمية</h2><p>اختر ما يساعدك على القراءة والتعلم دون تكلف.</p></div><div class="card"><form data-form="settings" class="stack"><div class="theme-options" role="group" aria-label="اختر لون الواجهة">${[['emerald','أخضر زمردي','#176b55'],['sand','رملي هادئ','#b89a5a'],['indigo','أزرق نيلي','#4757a6'],['olive','زيتوني','#68783b']].map(([v,l,c])=>html`<button type="button" class="theme-swatch ${(st.theme||'emerald')===v?'selected':''}" data-theme-option="${v}" aria-pressed="${(st.theme||'emerald')===v?'true':'false'}" style="--swatch:${c}"><i aria-hidden="true"></i><span>${l}</span></button>`)}</div><label class="field"><span>لون الواجهة</span><select name="theme">${[['emerald','أخضر زمردي'],['sand','رملي هادئ'],['indigo','أزرق نيلي'],['olive','زيتوني']].map(([v,l])=>html`<option value="${v}"${(st.theme||'emerald')===v?' selected':''}>${l}</option>`)}</select></label><label class="field"><span>حجم الخط</span><select name="font_scale">${[.9,1,1.1,1.2,1.3].map(x=>html`<option value="${x}"${Number(st.font_scale)===x?' selected':''}>${x===1?'افتراضي':x<1?'أصغر':'أكبر'}</option>`)}</select></label><label class="check"><input type="checkbox" name="high_contrast"${st.high_contrast?' checked':''}><span>تباين أعلى</span></label><label class="check"><input type="checkbox" name="reduced_motion"${st.reduced_motion?' checked':''}><span>تقليل الحركة</span></label><button class="btn">حفظ التفضيلات</button></form></div><div class="card"><h3>تغيير كلمة المرور</h3><form data-form="change-password" class="stack"><label class="field"><span>كلمة المرور الحالية</span><input type="password" name="current_password" autocomplete="current-password" required></label><label class="field"><span>كلمة المرور الجديدة</span><input type="password" name="new_password" minlength="8" autocomplete="new-password" required></label><label class="field"><span>تأكيد كلمة المرور الجديدة</span><input type="password" name="confirm_password" minlength="8" autocomplete="new-password" required></label><button class="btn sec2">تغيير كلمة المرور</button></form></div><div class="card"><h3>الخصوصية</h3><p class="muted">يمكنك طلب الوصول إلى بياناتك أو تصحيحها أو حذفها عندما لا يمنع ذلك التزام تعليمي أو نظامي.</p><div class="chips"><button class="btn sec2 sm" data-act="privacy-request" data-type="access">طلب الوصول</button><button class="btn sec2 sm" data-act="privacy-request" data-type="correct">طلب التصحيح</button><button class="btn sec2 sm" data-act="privacy-request" data-type="delete">طلب الحذف</button></div><a class="btn sm" href="/privacy.html" target="_blank" rel="noopener" style="margin-top:12px">قراءة سياسة الخصوصية</a></div><div class="card"><h3>أمان الجلسة</h3><p class="muted">الجلسة الخادمية منفصلة عن كلمة المرور، وتُحفظ Cookies الحساسة بطريقة HttpOnly/SameSite، مع حماية CSRF للطلبات المعتمدة على Cookie.</p></div></div>`); }
async function pgOps(){ if(S.user.role!=='admin')return showPage('dashboard'); const [h,m]=await Promise.all([api('/api/health'),api('/api/metrics').catch(e=>({recent:[],requests:0}))]); render(html`<div class="stack"><div class="card hero"><div class="hero-copy"><span class="eyebrow">مركز التشغيل</span><h2>ننظر إلى صحة الأكاديمية قبل أن نشكو من أعراضها</h2><p>هذه الصفحة تساعد المدير على رؤية حالة التخزين والذاكرة ومؤشرات الطلبات.</p></div></div><div class="grid g3"><div class="card stat"><span class="ic">✓</span><div><div class="lbl">الخدمة</div><div class="num">${h.ok?'سليمة':'تحتاج تدخلًا'}</div></div></div><div class="card stat"><span class="ic">↗</span><div><div class="lbl">الطلبات المسجلة</div><div class="num">${m.requests||0}</div></div></div><div class="card stat"><span class="ic">◌</span><div><div class="lbl">الذاكرة</div><div class="num">${m.memory?Math.round(m.memory.heap_used/1048576)+' MB':'—'}</div></div></div></div><div class="card"><div class="sec"><h3>حالة التخزين</h3><span class="badge ${h.storage_healthy?'ok':'bad'}">${h.storage_healthy?'سليم':'غير سليم'}</span></div><p class="muted">النوع: ${h.storage||'—'} · الإنتاج: ${h.production?'نعم':'لا'} · HTTPS مطلوب: ${h.https_required?'نعم':'لا'}</p></div><div class="card"><div class="sec"><h3>المقاييس الحديثة</h3><button class="btn sec2 sm" data-act="nav" data-page="admin">الإدارة</button></div>${(m.recent||[]).slice(-20).reverse().map(x=>html`<div class="item"><div class="row"><b>${x.method} ${x.path}</b><span class="muted">${fmtStamp(x.at)}</span></div></div>`)}</div></div>`); }
function openPrivacyRequest(type){ const labels={access:'الوصول إلى بياناتي',correct:'تصحيح بياناتي',delete:'حذف بياناتي'}; openModal('طلب '+labels[type],html`<form data-form="privacy-request" data-type="${type}" class="form"><p class="muted">اكتب التفاصيل التي تساعد إدارة الأكاديمية على فهم طلبك.</p><textarea name="details" rows="6" maxlength="1500" placeholder="التفاصيل (اختياري)"></textarea><button class="btn">إرسال الطلب</button></form>`); }
function openQuranSubmission(){ if(S.user.role!=='student')return; openModal('إرسال تسميع للشيخ',html`<form data-form="quran-submission" class="form"><div class="card flat"><b>اجعل الغاية الإتقان لا كثرة التسجيلات.</b><p class="muted small">ارفع تلاوتك كما هي، وسيصل التسجيل إلى الشيخ للمراجعة.</p></div><div class="two"><label class="field"><span>السورة</span><input name="surah" required maxlength="120"></label><label class="field"><span>من آية</span><input name="from_ayah" type="number" min="1" required></label></div><label class="field"><span>إلى آية</span><input name="to_ayah" type="number" min="1" required></label><label class="field"><span>التسجيل الصوتي</span><input name="file" type="file" accept="audio/*" required></label><label class="field"><span>ملاحظتك للشيخ</span><textarea name="notes" maxlength="1000" rows="4"></textarea></label><button class="btn">رفع التسميع</button></form>`); }
async function openQuranSubmissionReview(id){ const rows=await api('/api/quran/submissions'); const x=rows.find(r=>r.id===id); if(!x)return toast('التسميع غير موجود',true); openModal('مراجعة التسميع',html`<div class="stack"><div class="item"><b>${x.student_name} · ${x.surah} ${x.from_ayah}–${x.to_ayah}</b><p>${x.notes||'لا ملاحظات من الطالب'}</p><audio controls style="width:100%;margin-top:10px" src="/api/quran/submissions/${encodeURIComponent(x.id)}/file"></audio></div><form data-form="quran-review" data-id="${x.id}" class="form"><label class="field"><span>الحالة</span><select name="status"><option value="reviewed">مقبول</option><option value="needs_repeat">يحتاج إعادة</option><option value="pending">إبقاء للمراجعة</option></select></label><label class="field"><span>الدرجة</span><input name="score" type="number" min="0" max="100" value="${x.score??''}"></label><label class="field"><span>ملاحظة الشيخ</span><textarea name="teacher_note" rows="5" maxlength="1600">${x.teacher_note||''}</textarea></label><button class="btn">حفظ المراجعة</button></form></div>`); }

async function pgTransport(){
  const routes=await api('/api/transport');
  const admin=S.user.role==='admin';
  render(html`<div class="stack"><div class="card hero"><div class="sec"><div><span class="eyebrow">النقل الجماعي</span><h2>نقل الطلبة بأقل عبء إداري</h2><p>خطوط النقل، السائق، نقاط التوقف والطلبة المسجلون في مكان واحد.</p></div>${admin?html`<button class="btn" data-act="new-transport-route">${ico('plus')} إضافة خط</button>`:''}</div></div>${routes.length?html`<div class="grid g2">${routes.map(r=>html`<div class="card"><div class="row wrap"><h3>${r.name}</h3><span class="badge ok">${r.assignments.length} طالب</span></div><p class="muted small">${r.driver||'سائق غير محدد'}${r.vehicle?' · '+r.vehicle:''}${r.phone?' · '+r.phone:''}</p><div class="chips">${(r.pickup_points||[]).map(x=>html`<span class="chip">${x}</span>`)}</div><div class="stack" style="margin-top:12px">${r.assignments.map(a=>html`<div class="item"><div class="row wrap"><b>${a.student.name}</b><span class="badge">${a.stop||'نقطة غير محددة'}</span></div>${a.notes?html`<p class="muted small">${a.notes}</p>`:''}${admin?html`<button class="btn sm danger" data-act="remove-transport" data-id="${a.id}">إزالة</button>`:''}</div>`)}</div>${admin?html`<div class="row wrap" style="margin-top:12px"><button class="btn sm sec2" data-act="edit-transport-route" data-id="${r.id}">تعديل الخط</button><button class="btn sm" data-act="add-transport-student" data-id="${r.id}">إضافة طالب</button></div>`:''}</div>`)}</div>`:empty('لا توجد خطوط نقل بعد',admin?'أضف أول خط نقل من الزر أعلاه.':'لم يُسجل لك نقل جماعي بعد.')}</div>`);
}
function openTransportRouteModal(id){
  if(S.user.role!=='admin')return; api('/api/transport').then(routes=>{const r=id?routes.find(x=>x.id===id):null;openModal(r?'تعديل خط النقل':'خط نقل جديد',html`<form data-form="transport-route" data-id="${r?.id||''}" class="stack"><label class="field"><span>اسم الخط</span><input name="name" required maxlength="120" value="${r?.name||''}" placeholder="مثال: خط حي الهضاب"></label><div class="two"><label class="field"><span>السائق</span><input name="driver" value="${r?.driver||''}"></label><label class="field"><span>الهاتف</span><input name="phone" value="${r?.phone||''}"></label></div><label class="field"><span>المركبة</span><input name="vehicle" value="${r?.vehicle||''}"></label><label class="field"><span>نقاط التوقف — كل سطر نقطة</span><textarea name="pickup_points" rows="5">${(r?.pickup_points||[]).join('\n')}</textarea></label><button class="btn">حفظ</button></form>`)});
}
async function openTransportStudentModal(routeId){if(S.user.role!=='admin')return;const routes=await api('/api/transport');const r=routes.find(x=>x.id===routeId);if(!r)return;openModal('إضافة طالب إلى النقل',html`<form data-form="transport-assign" data-route="${routeId}" class="stack"><label class="field"><span>الطالب</span><select name="student_id">${S.students.map(s=>html`<option value="${s.id}">${s.name}</option>`)}</select></label><label class="field"><span>نقطة التوقف</span><select name="stop"><option value="">غير محددة</option>${(r.pickup_points||[]).map(x=>html`<option>${x}</option>`)}</select></label><label class="field"><span>ملاحظة</span><input name="notes" maxlength="300"></label><button class="btn">إضافة</button></form>`)}

const PAGES = {
  dashboard: ['الرئيسية', 'نظرة هادئة على اليوم', pgDashboard], 'academy-map': ['خريطة الأكاديمية والصلاحيات', 'تعريف واضح بالأدوار وحدود كل صلاحية', pgAcademyMap], 'learning-hub': ['برنامج التعلّم الممتع', 'خمسة مجالات لبناء المعرفة والعمل', pgLearningHub], 'school-directory': ['هيكلة المدرسة', 'الأسماء والرتب والمهام والمراسلة', pgSchoolDirectory], journey: ['رحلتي', 'مسار شخصي خفيف ومتدرج', pgJourney], program: ['بناء المنهج', 'إدارة المواد والدروس وطرق التعلم', pgProgram], quran: ['المدرسة القرآنية', 'حفظ وتسميع ومراجعة وتجويد وتقويم', pgQuran], admin: ['الإدارة العليا', 'صلاحيات كاملة وإدارة النظام', pgAdmin], hierarchy: ['هيكلة المنصة', 'المدير العام والمدارس والأفواج والفرق', pgHierarchy], news: ['ما الجديد؟', 'الإعلانات والتحديثات', pgNews],
  groups: ['الأفواج', 'تنظيم الطلاب ومجموعاتهم', pgGroups], transport: ['النقل الجماعي', 'خطوط النقل ونقاط التوقف والطلبة', pgTransport], curriculum: ['المنهج', 'المواد والبرنامج الأسبوعي', pgCurriculum],
  students: ['الطلاب', 'اضغط على الطالب لفتح ملفه', pgStudents], file: ['ملف الطالب', 'مركز المتابعة', pgFile],
  profile: ['ملفي', 'بياناتي وتقدمي', pgProfile], children: ['أبنائي', 'متابعة الأبناء', pgChildren],
  tracking: ['المتابعة', 'الحضور والتقدم في نطاقك', pgTracking], learning: ['تعلّمي', 'الحفظ والمراجعة والأهداف', pgLearning],
  reports: ['التقارير', 'تقرير شهري واضح ومحترم', pgReports], tests: ['الاختبارات', 'الاختبارات والدرجات', pgTests],
  attendance: ['تسجيل الحضور', 'اختر الفوج والتاريخ ثم سجّل الجميع مرة واحدة', pgAttendance],
  assignments: ['الواجبات', 'تكليف، تسليم، تصحيح ومتابعة', pgAssignments],
  calendar: ['التقويم الدراسي', 'الحصص والاختبارات والأنشطة والمواعيد', pgCalendar],
  messages: ['المراسلات', 'تواصل منظم داخل الأكاديمية', pgMessages],
  media: ['مكتبة الشيخ', 'مقاطع وملفات ودروس منشورة مع متابعة المشاهدة والتفاعل', pgMedia],
  tasks: ['مهامي', 'المهام الشخصية المكلّف بها', pgTasks],
  'teacher-tools': ['لوحة المعلم', 'اختصارات يومية', pgTeacherTools], notifications: ['الإشعارات', 'تنبيهات الأكاديمية', pgNotifications],
  'question-bank': ['بنك الأسئلة', 'تدريب وفهم وتصحيح', pgQuestionBank], community: ['مجتمع التعلم', 'أسئلة ونقاشات تربوية داخل نطاق الأكاديمية', pgCommunity],
  'supervisor-requests': ['طلبات الإشراف', 'مراجعة طلبات كبار الطلبة', pgSupervisorRequests], settings: ['الإعدادات والخصوصية', 'تفضيلات القراءة وطلبات الخصوصية', pgSettings], ops: ['مركز التشغيل', 'صحة النظام والمراقبة والجاهزية للنشر', pgOps],
  future: ['المراحل القادمة', 'ما سنبنيه لاحقًا', pgFuture]
};
function topActions(page) {
  const bell = html`<button class="btn sec2 hide-m" data-act="nav" data-page="notifications" aria-label="الإشعارات">${ico('bell')}<span>${S.notifications.filter(n => !n.read).length}</span></button>`;
  let extra = '';
  if (isStaff() && page === 'news') extra = html`<button class="btn" data-act="new-post">${ico('plus')}<span>منشور</span></button>`;
  if (isStaff() && page === 'media') extra = html`<button class="btn" data-act="new-media">${ico('plus')}<span>محتوى جديد</span></button>`;
  if (isStaff() && page === 'tests' && !S.grading) extra = html`<button class="btn" data-act="new-test">${ico('plus')}<span>اختبار</span></button>`;
  if (isStaff() && page === 'question-bank') extra = html`<button class="btn" data-act="new-question">${ico('plus')}<span>سؤال</span></button>`;
  return html`${bell}${extra}`;
}
function navFor(page) { if (page === 'file') return S.user.role === 'student' ? 'profile' : S.user.role === 'parent' ? 'children' : 'students'; return page; }
function showPage(id, opts = {}) {
  if (!PAGES[id]) id = 'dashboard';
  if (opts.history === true) { try { history.pushState({ academy: true, page: id }, '', '#'+encodeURIComponent(id)); } catch { /* */ } }
  else if (opts.history !== false) { try { if (!history.state || !history.state.academy) history.replaceState({ academy: true, page: id }, '', location.pathname); } catch { /* */ } }
  S.page = id; S.grading = id === 'tests' && opts.grading ? opts.grading : null; document.documentElement.dataset.page = id;
  const [title, sub, fn] = PAGES[id];
  $('#pgTitle').textContent = title; $('#pgSub').textContent = sub; put($('#topActions'), topActions(id));
  document.querySelectorAll('[data-page]').forEach(b => b.classList.toggle('active', b.dataset.page === navFor(id)));
  closeOverlay(); window.scrollTo(0, 0);
  render(raw('<div class="skel" aria-busy="true"><span class="sr">جارٍ التحميل…</span><i></i><i></i><i></i></div>'));
  guard(fn).then(() => {});
}

/* ── النوافذ ── */
function openModal(title, body, mount) {
  put($('#overlay'), html`<div class="modal" data-act="close-modal-bg"><div class="modalbox" role="dialog" aria-modal="true" aria-label="${title}"><div class="row" style="margin-bottom:14px"><h3>${title}</h3><button class="btn sec2 sm" data-act="close-modal" aria-label="إغلاق">×</button></div>${body}</div></div>`);
  const f = $('#overlay input,#overlay select,#overlay textarea'); if (f) f.focus();
  if (mount) mount($('#overlay'));
}
function closeOverlay() { put($('#overlay'), ''); }
function openMore() {
  const groups = navGroups();
  put($('#overlay'), html`<div class="more-sheet" data-act="close-modal-bg"><div class="more-panel"><div class="more-heading"><div><span class="eyebrow">مساحة الأكاديمية</span><h2>انتقل إلى ما تحتاجه</h2></div><button class="btn sec2 sm" data-act="close-modal" aria-label="إغلاق القائمة">×</button></div><div class="more-sections">${groups.map(g=>html`<section class="more-section"><h3>${g.label}</h3><div class="more-grid">${g.items.map(([id,l,ic])=>html`<button data-act="nav" data-page="${id}" class="${id===navFor(S.page)?'active':''}">${ico(ic)}<span>${l}</span><span class="more-arrow" aria-hidden="true">‹</span></button>`)}</div></section>`)}</div><button class="more-logout" data-act="logout">${ico('out')}<span>تسجيل الخروج</span></button></div></div>`);
}

/* ═══════════ الرئيسية ═══════════ */
async function pgDashboard() {
  const role = S.user.role;
  const [d, tests] = await Promise.all([api('/api/dashboard'), api('/api/tests')]);
  const up = tests.filter(t => t.date >= today()).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4);
  const hero = {
    admin: ['إدارة الأكاديمية', 'نظام منظم لبناء الإنسان تدريجيًا، مع متابعة واضحة وبدون إرهاق.'],
    teacher: ['أهلًا بك، ' + S.user.name, 'سجّل الحضور، أنشئ الاختبارات، وتابع طلابك من مكان واحد.'],
    student: ['استمر خطوة بخطوة', 'هدفنا الإتقان والاستمرار، لا كثرة المهام.'],
    parent: ['متابعة هادئة وواضحة', 'تابع تقدم أبنائك بصورة مختصرة ومطمئنة.']
  }[role];
  const stats = isStaff()
    ? [['الطلاب', d.students_count], ['الأفواج', d.groups_count], ['نسبة الحضور', d.attendance_rate + '%'], ['متوسط التقدم', d.progress_avg + '%']]
    : role === 'student'
      ? [['نسبة الحضور', d.attendance_rate + '%'], ['متوسط التقدم', d.progress_avg + '%'], ['مراجعات مستحقة', d.due_reviews], ['اختبارات قادمة', d.upcoming_tests]]
      : [['الأبناء', d.students_count], ['الحضور', d.attendance_rate + '%'], ['التقدم', d.progress_avg + '%'], ['اختبارات قادمة', d.upcoming_tests]];
  const daily = role === 'teacher' ? ['رسالة اليوم', 'القليل المستمر خير من الكثير المنقطع.', 'اجعل متابعة الطالب خفيفة، واضحة، ومفيدة.']
    : role === 'student' ? ['خطوة اليوم', 'ثبّت عادة صغيرة قبل أن تضيف مهمة جديدة.', 'الاستمرار أهم من الضغط على نفسك.']
    : role === 'parent' ? ['لولي الأمر', 'اسأل عن التقدم قبل أن تسأل عن النتيجة.', 'الدعم الهادئ يصنع بيئة أفضل للتعلم.']
    : ['فلسفة الأكاديمية', 'نبني الإنسان قبل أن نكدّس المعلومات.', 'علم نافع، خلق، عادة، صحة، وعلاقات متوازنة.'];
  render(html`<div class="stack">
    <div class="card hero hero-main"><div class="hero-copy"><span class="eyebrow">${role === 'admin' ? 'لوحة الإدارة' : 'أكاديمية بناء الإنسان'}</span><h2>${hero[0]}</h2><p>${hero[1]}</p><span class="when">${fmtDate(today())}</span></div><div class="hero-orbit"><img src="/assets/ihsan-emblem.svg" alt="شعار أكاديمية الإحسان"><i></i><i></i></div></div>
    <div class="daily-note card"><span class="daily-icon">${ico('spark')}</span><div><span class="eyebrow">${daily[0]}</span><b>${daily[1]}</b><p>${daily[2]}</p></div></div>
    <div class="grid g4">${stats.map((s, i) => { const page = s[0] === 'الطلاب' ? 'students' : s[0] === 'الأبناء' ? 'children' : s[0] === 'الأفواج' ? 'groups' : (s[0] === 'نسبة الحضور' || s[0] === 'الحضور') ? 'attendance' : null; return page && isStaff() ? html`<button type="button" class="card stat stat-link" data-act="nav" data-page="${page}" aria-label="فتح ${s[0]}" style="text-align:inherit;color:inherit;width:100%;cursor:pointer"><span class="ic">${ico(['user', 'group', 'check', 'trend'][i % 4])}</span><div><div class="lbl">${s[0]}</div><div class="num">${s[1]}</div></div></button>` : html`<div class="card stat"><span class="ic">${ico(['user', 'group', 'check', 'trend'][i % 4])}</span><div><div class="lbl">${s[0]}</div><div class="num">${s[1]}</div></div></div>`; })}</div>
    ${role === 'student' && d.today_plan ? html`<div class="card today-plan"><div class="sec"><div><span class="eyebrow">يومك في الأكاديمية</span><h3>خطواتك اليوم</h3><p class="muted">${d.today_message}</p></div><span class="badge ok">${d.today_plan.length} خطوات</span></div><div class="today-steps">${d.today_plan.length ? d.today_plan.map((x,i)=>html`<div class="today-step ${x.priority==='due'?'urgent':''}"><span class="step-no">${i+1}</span><div class="today-step-copy"><b>${x.title}</b><p>${x.detail}</p></div><span class="chip">${x.type==='review'?'مراجعة':x.type==='lesson'?'درس':x.type==='test'?'اختبار':'مهمة'}</span><button type="button" class="today-step-open" data-act="nav" data-page="${x.type==='review'?'quran':x.type==='lesson'?'curriculum':x.type==='test'?'tests':x.type==='task'?'tasks':'learning'}" aria-label="${'فتح: '+x.title}">ابدأ <span aria-hidden="true">←</span></button></div>`):html`<div class="today-empty"><span class="today-empty-mark">✦</span><div><b>مساحة لخطوة نافعة</b><p>لا توجد مهام مستحقة الآن. يمكنك مراجعة وردك القرآني أو استكشاف رحلتك التعليمية.</p></div><button type="button" class="btn sm" data-act="nav" data-page="quran">ابدأ بورد القرآن</button></div>`}</div></div>` : ''}
    ${d.quran_today ? html`<div class="grid g2"><div class="card q-home-card"><div class="sec"><div><span class="eyebrow">المدرسة القرآنية</span><h3>وردك القرآني</h3><p class="muted">الحفظ لا يثبت بكثرة الجديد وحده، وإنما بالمراجعة والتعاهد.</p></div><button class="btn sm sec2" data-act="nav" data-page="quran">فتح المدرسة</button></div><div class="q-home-metrics"><div><b>${d.quran_today.mastery == null ? '—' : d.quran_today.mastery + '%'}</b><span>الإتقان</span></div><div><b>${d.quran_today.due_reviews}</b><span>مراجعات مستحقة</span></div><div><b>${d.quran_today.total_sessions}</b><span>جلسات مسجلة</span></div></div>${d.quran_today.latest_session ? html`<div class="q-home-last"><b>آخر تسميع</b><span>${d.quran_today.latest_session.surah} · ${d.quran_today.latest_session.from_ayah}–${d.quran_today.latest_session.to_ayah}</span></div>` : ''}</div><div class="card home-pulse"><div class="sec"><div><span class="eyebrow">تنبيهاتك</span><h3>ما يحتاج انتباهك</h3></div></div><div class="home-pulse-list"><button data-act="nav" data-page="notifications"><b>${d.unread_notifications || 0}</b><span>إشعارات غير مقروءة</span></button><button data-act="nav" data-page="messages"><b>${d.unread_messages || 0}</b><span>رسائل غير مقروءة</span></button><button data-act="nav" data-page="media"><b>${d.media_unseen || 0}</b><span>مواد لم تشاهدها</span></button></div></div></div>` : ''}
    ${isStaff() ? html`<div class="card flat row wrap"><b>اختصارات سريعة</b><div class="chips"><button class="btn sm" data-act="nav" data-page="attendance">تسجيل الحضور</button><button class="btn sm sec2" data-act="new-test">إنشاء اختبار</button><button class="btn sm sec2" data-act="nav" data-page="tests">إدخال الدرجات</button></div></div>` : ''}
    <div class="cols">
      <div class="card"><div class="sec"><h3>آخر المستجدات</h3><button class="btn sec2 sm" data-act="nav" data-page="news">عرض الكل</button></div>${S.posts.length ? S.posts.slice(0, 4).map(p => html`<div class="item"><b>${p.title}</b><p>${p.body}</p></div>`) : empty('لا توجد تحديثات بعد')}</div>
      <div class="card"><div class="sec"><h3>اختبارات قادمة</h3></div>${up.length ? up.map(t => html`<div class="item"><div class="row"><b>${t.title}</b><span class="badge">${t.max_score} درجة</span></div><p>${fmtDate(t.date)}${t.group_name ? ' · ' + t.group_name : ''}</p></div>`) : empty('لا توجد اختبارات قادمة')}</div>
    </div></div>`);
}

/* ═══════════ فرق المدرسة ═══════════ */
async function pgSupervisorRequests(){
  if(!['admin','chief_supervisor','teacher'].includes(S.user.role)) return showPage('dashboard');
  const rows=await api('/api/supervisor-requests');
  const canReview=['admin','chief_supervisor'].includes(S.user.role);
  render(html`<div class="stack"><div class="card hero hero-main"><div class="hero-copy"><span class="eyebrow">مسؤولية وأمانة</span><h2>طلبات الإشراف الطلابي</h2><p>يُختار المشرف من كبار الطلبة لخدمة زملائه وتنظيم العمل، لا للتسلط أو الحلول محل الشيخ.</p></div></div><div class="card"><div class="sec"><h3>الطلبات</h3><span class="badge">${rows.filter(x=>x.status==='pending').length} قيد المراجعة</span></div>${rows.length?rows.map(x=>html`<div class="item"><div class="row wrap"><div><b>${x.student_name}</b><p class="muted small">${x.team_name} · ${x.group_name}</p></div><span class="badge ${x.status==='approved'?'ok':x.status==='rejected'?'bad':'gold'}">${x.status==='approved'?'مقبول':x.status==='rejected'?'مرفوض':'قيد المراجعة'}</span></div>${x.reason?html`<p>${x.reason}</p>`:''}<p class="muted small">تاريخ الطلب: ${String(x.created_at||'').slice(0,10)} ${x.reviewer_name?'· راجعه '+x.reviewer_name:''}</p>${canReview&&x.status==='pending'?html`<div class="row wrap"><button class="btn sm" data-act="review-supervisor-request" data-id="${x.id}" data-decision="approve">الموافقة</button><button class="btn sm danger" data-act="review-supervisor-request" data-id="${x.id}" data-decision="reject">رفض الطلب</button></div>`:''}</div>`):empty('لا توجد طلبات بعد','ستظهر هنا طلبات كبار الطلبة الراغبين في خدمة فرقهم.')}</div></div>`);
}
function openTeamStudentModal(teamId){
  openModal('إضافة طالب إلى الفريق',html`<form class="form" data-form="team-student" data-id="${teamId}"><label class="field"><span>اسم الطالب ثم لقبه</span><input name="name" maxlength="120" required placeholder="مثال: محمد مداني"><small class="muted">اكتب الاسم أولًا ثم اللقب؛ كلمة المرور الافتراضية تعتمد على الاسم الأول.</small></label><label class="field"><span>البريد الإلكتروني (اختياري)</span><input name="email" type="email"></label><label class="field"><span>كلمة مرور أولية (اختيارية)</span><div class="row"><input id="teamStudentPassword" name="password" type="password" minlength="8" autocomplete="new-password" placeholder="افتراضيًا: الاسم الأول +123"><label class="check"><input type="checkbox" data-ch="passwordVisibility" data-target="teamStudentPassword"><span>إظهار</span></label></div></label><label class="field"><span>تأكيد كلمة المرور (إذا أدخلتها يدويًا)</span><div class="row"><input id="teamStudentConfirm" name="confirm_password" type="password" minlength="8" autocomplete="new-password"><label class="check"><input type="checkbox" data-ch="passwordVisibility" data-target="teamStudentConfirm"><span>إظهار</span></label></div></label><button class="btn" type="submit">إنشاء حساب الطالب</button></form>`);
}
async function pgTeams(){
  const teams=await api('/api/teams');
  if(S.user.role==='student'){
    const requests=await api('/api/supervisor-requests');
    render(html`<div class="stack"><div class="card hero hero-main"><div class="hero-copy"><span class="eyebrow">فريقي</span><h2>نعمل معًا، وكل واحد له أثر</h2><p>فرق صغيرة داخل الفوج، بمهام واضحة ومشرفين من الطلبة المتقدمين.</p></div><div class="hero-orbit"><span>ف</span><i></i><i></i></div></div>${teams.length?teams.map(t=>html`<div class="card"><div class="row wrap"><div><h3>${t.name}</h3><p class="muted">${t.description||''}</p>${t.members.some(m=>m.user_id===S.user.id)&&!t.supervisors.some(x=>t.members.some(m=>m.id===x.id&&m.user_id===S.user.id))?(requests.some(r=>r.team_id===t.id&&r.status==='pending')?html`<span class="badge gold">طلب الإشراف قيد المراجعة</span>`:html`<button class="btn sm sec2" data-act="apply-team-supervisor" data-id="${t.id}">طلب الانضمام إلى المشرفين</button>`):''}</div><div class="chips">${t.supervisors.map(x=>html`<span class="badge">مشرف: ${x.name}</span>`)}</div></div><div class="grid g2" style="margin-top:14px"><div><b>أعضاء الفريق</b>${t.members.map(m=>html`<div class="item"><b>${m.name}</b>${t.supervisors.some(x=>x.id===m.id)?html`<span class="badge ok" style="margin-right:8px">مشرف</span>`:''}</div>`)}</div><div><b>مهام الفريق</b>${t.tasks.length?t.tasks.map(x=>html`<div class="item"><div class="row wrap"><b>${x.title}</b><span class="badge ${x.status==='done'?'ok':'gold'}">${x.status==='done'?'مكتملة':'قيد العمل'}</span></div><p class="muted small">${x.assigned_student_name?`مكلف بـ ${x.assigned_student_name}`:'مهمة جماعية'}${x.due_date?' · '+x.due_date:''}</p>${x.assigned_student_id===((S.students.find(q=>q.user_id===S.user.id)||{}).id)?html`<button class="btn sm sec2" data-act="team-task-done" data-id="${x.id}">أنجزتها</button>`:''}</div>`):empty('لا توجد مهام بعد')}${t.can_manage?html`<button class="btn sm sec2" style="margin-top:8px" data-act="new-team-task" data-id="${t.id}">إضافة مهمة للفريق</button><button class="btn sm sec2" style="margin-top:8px" data-act="new-team-student" data-id="${t.id}">إضافة طالب</button>`:''}</div></div></div>`):empty('لم يُسند لك فريق بعد','سيظهر فريقك هنا عندما يوزعه الشيخ أو المشرف.')}</div>`);return;
  }
  const canCreate=['admin','teacher','chief_supervisor'].includes(S.user.role);
  render(html`<div class="stack"><div class="card hero hero-main"><div class="hero-copy"><span class="eyebrow">فرق المدرسة</span><h2>فرق صغيرة داخل الأفواج</h2><p>لكل فريق اسم ومهام وأعضاء، ويمكن اختيار كبار الفوج ليكونوا مشرفين عليه. المشرف طالب متقدم، وليس بديلًا عن الشيخ.</p></div><div class="hero-orbit"><span>ف</span><i></i><i></i></div></div><div class="row wrap">${canCreate?html`<button class="btn" data-act="new-team">${ico('plus')} فريق جديد</button>`:''}<span class="muted small">صلاحيات الشيخ/المعلم تبقى أعلى من صلاحيات مشرف الفريق.</span></div><div class="grid g2">${teams.length?teams.map(t=>html`<div class="card"><div class="sec"><div><h3>${t.name}</h3><p class="muted">${(S.groups.find(g=>g.id===t.group_id)||{}).name||''} · ${t.description||''}</p></div><span class="badge ${t.active===false?'bad':'ok'}">${t.active===false?'معطل':'نشط'}</span></div><p><b>${t.members.length}</b> أعضاء · <b>${t.supervisors.length}</b> مشرفين</p><div class="chips">${t.supervisors.map(x=>html`<span class="badge">مشرف: ${x.name}</span>`)}</div><div class="row wrap" style="margin-top:12px"><button class="btn sm sec2" data-act="edit-team-members" data-id="${t.id}">الأعضاء والمشرفون</button><button class="btn sm sec2" data-act="new-team-task" data-id="${t.id}">مهمة للفريق</button></div><div style="margin-top:12px">${t.tasks.slice(0,4).map(x=>html`<div class="item"><div class="row wrap"><b>${x.title}</b><span class="badge ${x.status==='done'?'ok':'gold'}">${x.status==='done'?'تمت':'قيد العمل'}</span></div></div>`)}</div></div>`):empty('لا توجد فرق بعد','أنشئ فرقًا صغيرة داخل كل فوج، ثم اختر كبار الفوج كمشرفين.')}</div></div>`);
}
async function openTeamModal(){
  if(!['admin','teacher','chief_supervisor'].includes(S.user.role))return;
  const groups=S.groups.filter(g=>S.user.role!=='teacher'||g.active!==false);
  openModal('إنشاء فريق صغير',html`<form data-form="team" class="stack"><label class="field"><span>الفوج</span><select name="group_id" required>${groups.map(g=>html`<option value="${g.id}">${g.name}</option>`)}</select></label><label class="field"><span>اسم الفريق</span><input name="name" maxlength="100" required placeholder="مثال: فريق الهمة"></label><label class="field"><span>الوصف</span><textarea name="description" maxlength="600" rows="3" placeholder="ما مهمة الفريق؟"></textarea></label><button class="btn">إنشاء الفريق</button></form>`);
}
async function openTeamMembers(id){
  const teams=await api('/api/teams'),t=teams.find(x=>x.id===id);if(!t)return;
  if(!t.can_manage){return toast('لا تملك إدارة هذا الفريق',true)}
  const roster=S.students.filter(s=>(s.groups||[]).some(g=>g.id===t.group_id));
  const memberIds=new Set(t.members.map(x=>x.id)),supIds=new Set(t.supervisors.map(x=>x.id));
  openModal('تعيين كبار الطلبة مشرفين للفريق',html`<form data-form="team-members" data-id="${t.id}" class="stack"><div class="card flat"><b>١. أعضاء الفريق</b><p class="muted small">اختر الطلبة الذين ينتمون إلى هذا الفريق.</p><div class="stack">${roster.map(s=>html`<label class="check"><input type="checkbox" name="student_ids" value="${s.id}"${memberIds.has(s.id)?' checked':''}><span>${s.name}</span></label>`)}${!roster.length?empty('لا يوجد طلاب في نطاقك لهذا الفوج'):''}</div></div><div class="card flat"><b>٢. كبير الطلبة / مشرف الفريق</b><p class="muted small">حدّد طالبًا أو أكثر ليتولّى تنظيم مهام الفريق ومتابعة أعضائه. هذه صلاحية إشراف على الفريق المحدد فقط، وليست صلاحية مدير أو معلم.</p><div class="stack">${roster.map(s=>html`<label class="check"><input type="checkbox" name="supervisor_ids" value="${s.id}"${supIds.has(s.id)?' checked':''}><span>${s.name}</span></label>`)}</div></div><button class="btn">حفظ أعضاء الفريق والمشرفين</button></form>`);
}
async function openTeamTaskModal(id){
  const teams=await api('/api/teams'),t=teams.find(x=>x.id===id);if(!t||!t.can_manage)return toast('لا تملك إدارة هذا الفريق',true);
  openModal('مهمة جديدة للفريق',html`<form data-form="team-task" data-id="${t.id}" class="stack"><label class="field"><span>المهمة</span><input name="title" maxlength="160" required></label><label class="field"><span>الوصف</span><textarea name="description" maxlength="800" rows="3"></textarea></label><label class="field"><span>المكلّف</span><select name="assigned_student_id"><option value="">الفريق كله</option>${t.members.map(m=>html`<option value="${m.id}">${m.name}</option>`)}</select></label><label class="field"><span>آخر أجل</span><input name="due_date" type="date"></label><button class="btn">إضافة المهمة</button></form>`);
}
/* ═══════════ الإدارة العليا V22 ═══════════ */
async function pgAdmin() {
  if (S.user.role !== 'admin') return showPage('dashboard');
  const [o, users, groups, teachers] = await Promise.all([api('/api/admin/overview'), api('/api/admin/users'), api('/api/admin/groups'), api('/api/admin/teachers')]);
  const roleLabel = {admin:'مدير الأكاديمية', chief_supervisor:'المشرف الرئيسي', teacher:'الشيخ', student:'طالب', parent:'ولي أمر'};
  render(html`<div class="stack admin-panel">
    <div class="card hero hero-main"><div class="hero-copy"><span class="eyebrow">مركز القيادة</span><h2>كل شيء تحت سيطرتك</h2><p>إدارة المستخدمين والصلاحيات ومراقبة النظام والنسخ الاحتياطي من مكان واحد.</p></div><div class="hero-orbit"><span>⚙</span><i></i><i></i></div></div>
    <div class="grid g4">${[['المستخدمون',o.users],['الطلاب',o.students],['الدروس',o.lessons],['الجلسات',o.active_sessions]].map((x,i)=>html`<div class="card stat"><span class="ic">${ico(['user','user','book','bell'][i])}</span><div><div class="lbl">${x[0]}</div><div class="num">${x[1]}</div></div></div>`)}</div>
    <div class="grid g2">
      <div class="card"><div class="sec"><div><h3>المستخدمون</h3><p class="muted">إنشاء الحسابات، تغيير الأدوار، التعطيل وإعادة كلمة المرور.</p></div><button class="btn sm" data-act="admin-new-user">${ico('plus')} مستخدم جديد</button></div>
        <div class="table-wrap"><table><thead><tr><th>الاسم</th><th>الدور</th><th>الحالة</th><th>إجراء</th></tr></thead><tbody>${users.map(u=>html`<tr><td><b>${u.name}</b><small class="muted">${u.email}</small></td><td><span class="badge">${roleLabel[u.role]||u.role}</span></td><td>${u.active?html`<span class="badge ok">نشط</span>`:html`<span class="badge bad">معطل</span>`}</td><td><button class="btn sec2 sm" data-act="admin-edit-user" data-id="${u.id}">إدارة</button></td></tr>`)}</tbody></table></div>
      </div>
      <div class="card"><div class="sec"><div><h3>الصلاحيات الكلية</h3><p class="muted">المدير يملك جميع وظائف النظام دون تجاوز نطاقات الحماية.</p></div></div><div class="chips">${o.permissions.map(x=>html`<span class="chip">✓ ${x.label}</span>`)}</div><hr><div class="row wrap"><div><b>نسخة البرنامج:</b> V26</div><div><b>Node:</b> ${o.node}</div><div><b>قاعدة البيانات:</b> ${Math.round(o.db_bytes/1024)} KB</div></div><button class="btn" data-act="admin-backup">${ico('save')} تنزيل نسخة احتياطية كاملة</button></div>
    </div>
    <div class="grid g2">
      <div class="card"><div class="sec"><div><h3>الأفواج</h3><p class="muted">إنشاء الأفواج وتعديلها وإسناد الشيوخ إليها.</p></div><button class="btn sm" data-act="admin-new-group">${ico('plus')} فوج جديد</button></div>${groups.length?groups.map(g=>html`<div class="item"><div class="row wrap"><div><b>${g.name}</b><p class="muted small">${g.level||'عام'} · ${g.student_count} طالب</p></div><span class="badge ${g.active===false?'bad':'ok'}">${g.active===false?'معطل':'نشط'}</span></div><p class="muted small">${g.teachers.length?'الشيوخ: '+g.teachers.map(t=>t.name).join('، '):'لا يوجد شيخ مسند'}</p><div class="chips"><button class="btn sm sec2" data-act="admin-edit-group" data-id="${g.id}">إدارة الفوج</button><button class="btn sm sec2" data-act="admin-group-teachers" data-id="${g.id}">إسناد الشيوخ</button></div></div>`):empty('لا توجد أفواج')}
      </div>
      <div class="card"><div class="sec"><div><h3>المناهج</h3><p class="muted">المواد المؤرشفة تبقى محفوظة للتاريخ ولا تظهر للطلاب.</p></div></div><div class="chips">${o.permissions.map(x=>html`<span class="chip">✓ ${x.label}</span>`)}</div><p class="muted small" style="margin-top:12px">المعلمون المتاحون للإسناد: ${teachers.length}</p></div>
    </div>
    <div class="card"><div class="sec"><div><h3>فرق المدرسة</h3><p class="muted">فرق صغيرة داخل الأفواج، بمشرفين من كبار الطلبة ومهام قابلة للمتابعة.</p></div><button class="btn sm" data-act="nav" data-page="teams">إدارة الفرق</button></div><p class="muted small">المشرف طالب مسؤول عن التنظيم والتحفيز فقط؛ لا يستطيع تجاوز صلاحيات الشيخ أو الاطلاع على بيانات خارج فريقه.</p></div>
    <div class="card"><div class="sec"><h3>آخر العمليات</h3><span class="badge">${o.audit_count} مسجلة</span></div>${o.recent.length?o.recent.map(a=>html`<div class="item"><div class="row"><b>${a.action}</b><span class="muted">${a.user_name}</span></div><p class="muted">${a.at} · ${JSON.stringify(a.meta||{})}</p></div>`):empty('لا توجد عمليات')}</div>
  </div>`);
}
async function openGroupModal(id) {
  const groups=await api('/api/admin/groups'); const g=id?groups.find(x=>x.id===id):null;
  openModal(g?'إدارة الفوج':'إنشاء فوج',html`<form data-form="admin-group" data-id="${g?.id||''}" class="stack"><label class="field"><span>اسم الفوج</span><input name="name" required maxlength="120" value="${g?.name||''}"></label><label class="field"><span>المستوى</span><input name="level" maxlength="80" value="${g?.level||''}"></label><label class="field"><span>الوصف</span><textarea name="description" maxlength="600">${g?.description||''}</textarea></label>${g?html`<label class="showpw"><input type="checkbox" name="active"${g.active!==false?' checked':''}><span>الفوج نشط</span></label>`:''}<button class="btn">حفظ</button></form>`);
}
async function openGroupTeachers(id){
  const [groups,teachers]=await Promise.all([api('/api/admin/groups'),api('/api/admin/teachers')]); const g=groups.find(x=>x.id===id); if(!g)return;
  const assigned=new Set(g.teachers.map(x=>x.id));
  openModal('إسناد شيوخ الفوج',html`<form data-form="admin-group-teachers" data-id="${id}" class="stack"><p class="muted">اختر الشيوخ المسؤولين عن هذا الفوج. الإسناد يؤثر مباشرة في نطاق الوصول للطلاب.</p><div class="chips">${teachers.map(t=>html`<label class="check"><input type="checkbox" name="teacher_ids" value="${t.id}"${assigned.has(t.id)?' checked':''}><span>${t.name}</span></label>`)}</div><button class="btn">حفظ الإسناد</button></form>`);
}
async function copyCredentialText(value) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
    } else {
      const box=document.createElement('textarea'); box.value=value; box.setAttribute('readonly','');
      box.style.position='fixed'; box.style.opacity='0'; document.body.appendChild(box); box.select();
      const ok=document.execCommand('copy'); box.remove(); if(!ok) throw new Error('تعذر النسخ تلقائيًا');
    }
    toast('تم النسخ');
  } catch (e) { toast('تعذر النسخ؛ يمكنك تحديد النص ونسخه يدويًا', true); }
}
function showLoginCredentials(name, email, password) {
  openModal('بيانات الدخول — احفظها وأرسلها بأمان', html`<div class="stack">
    <div class="card flat"><b>المستخدم</b><p>${name}</p></div>
    <label class="field"><span>${email?'البريد الإلكتروني':'اسم المستخدم'}</span><div class="row"><input id="loginCredentialEmail" readonly value="${email||name}" dir="ltr"><button class="btn sec2 sm" type="button" data-act="copy-login-credential" data-target="loginCredentialEmail">نسخ</button></div></label>
    <label class="field"><span>كلمة المرور الأولية</span><div class="row"><input id="loginCredentialPassword" readonly value="${password}" dir="ltr" autocomplete="off"><button class="btn sec2 sm" type="button" data-act="copy-login-credential" data-target="loginCredentialPassword">نسخ كلمة المرور</button></div></label>
    <button class="btn" type="button" data-act="copy-login-both">نسخ البريد وكلمة المرور</button>
    <p class="muted small">تظهر كلمة المرور هنا مرة واحدة بعد الإنشاء أو إعادة التعيين فقط. تُحفظ في قاعدة البيانات بصيغة مجزّأة، ولا يمكن استرجاع كلمة المرور القديمة. أرسلها للمعني على قناة خاصة واطلب منه تغييرها بعد الدخول.</p>
  </div>`);
}
function openAdminUserModal(id) {
  api('/api/admin/users').then(users => {
    const u = id ? users.find(x=>x.id===id) : null;
    const roles = [['admin','مدير عام'],['chief_supervisor','كبير المشرفين'],['teacher','شيخ / أستاذ'],['student','طالب'],['parent','ولي أمر']];
    openModal(u?'إدارة المستخدم':'إنشاء مستخدم', html`<form data-form="admin-user" data-id="${u?.id||''}" class="stack"><label class="field"><span>الاسم</span><input name="name" required maxlength="120" value="${u?.name||''}"></label><label class="field"><span>البريد</span><input name="email" type="email" ${u?.role==='student'?'':'required'} value="${u?.email||''}" dir="ltr"></label><label class="field"><span>الدور</span><select name="role" data-ch="adminUserRole">${roles.map(r=>html`<option value="${r[0]}"${u?.role===r[0]?' selected':''}>${r[1]}</option>`)}</select></label><label class="field"><span>${u?'كلمة مرور جديدة (اختياري)':'كلمة المرور'}</span><div class="row"><input name="password" id="adminUserPassword" type="password" minlength="8" ${u?'':'required'} placeholder="8 أحرف على الأقل" autocomplete="new-password"><label class="check"><input type="checkbox" data-ch="adminPasswordVisibility"><span>إظهار</span></label></div></label>${!u?html`<label class="field"><span>تأكيد كلمة المرور</span><input name="confirm_password" type="password" minlength="8" autocomplete="new-password"></label><div id="studentProvisionFields" class="stack"${u?.role==='student'?'':' style="display:none"'}><div class="card flat"><b>إعدادات الطالب عند الإنشاء</b><p class="muted small">هذه الخيارات تخص الطالب فقط. الشيخ أو الأستاذ لا يُضاف إلى أفواج الطلبة من هنا؛ إسناد الشيخ للفوج يتم من إدارة الأفواج.</p><div class="field"><span>إضافة الطالب إلى أفواج</span><div class="chips">${S.groups.map(g=>html`<label class="check"><input type="checkbox" name="group_ids" value="${g.id}"><span>${g.name}</span></label>`)}</div></div><label class="field"><span>مهمة أولى للطالب (اختياري)</span><input name="task_title" maxlength="160" placeholder="مثال: مراجعة سورة الملك"></label><div class="two"><label class="field"><span>وصف المهمة</span><input name="task_description" maxlength="800"></label><label class="field"><span>موعدها</span><input name="task_due" type="date"></label></div></div></div>`:''}${u?html`<label class="showpw"><input type="checkbox" name="active"${u.active?' checked':''}><span>الحساب نشط</span></label>`:''}<button class="btn" type="submit">حفظ</button></form>`);
  }).catch(e=>toast(e.message,true));
}

/* ═══════════ المنشورات ═══════════ */
let NEWS_MEDIA = [];
async function pgNews() {
  NEWS_MEDIA = await api('/api/media').catch(()=>[]);
  render(html`<div class="stack"><div class="card"><div class="sec"><div><h3>ما الجديد؟</h3><p class="muted small">محتوى الشيخ في واجهتين: ريلز للفيديوهات، ومنشورات للتصفح والقراءة.</p></div></div><div class="media-filter"><button class="active" data-act="news-tab" data-tab="reels">ريلز الفيديوهات</button><button data-act="news-tab" data-tab="posts">منشورات الشيخ</button></div><div id="newsContent"></div></div></div>`);
  drawNewsTab('reels');
}
function drawNewsTab(tab,q='') {
  document.querySelectorAll('[data-act="news-tab"]').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
  const host=$('#newsContent'); if(!host)return;
  if(tab==='posts') {
    const list=S.posts.filter(p=>(p.title+' '+p.body+' '+(p.author_name||'')).toLowerCase().includes(q.toLowerCase()));
    put(host,list.length?html`<label class="field"><span>ابحث في منشورات الشيخ</span><input id="postSearch" placeholder="ابحث في المنشورات…" data-in="postSearch" value="${q}"></label><div class="sheikh-post-feed">${list.map(p=>html`<article class="item sheikh-post"><div class="row wrap"><b>${p.title}</b><span class="badge">${p.group_id?'منشور لفوج':'منشور للأكاديمية'}</span></div><p class="post-body">${p.body}</p><div class="muted small">${p.author_name||'الشيخ'} · ${fmtStamp(p.created_at)}</div></article>`)}</div>`:html`<label class="field"><span>ابحث في منشورات الشيخ</span><input id="postSearch" placeholder="ابحث في المنشورات…" data-in="postSearch" value="${q}"></label>${empty('لا توجد منشورات مطابقة')}`);
    return;
  }
  const videos=NEWS_MEDIA.filter(m=>m.type==='video'&&(m.title+' '+(m.description||'')).toLowerCase().includes(q.toLowerCase()));
  put(host,videos.length?html`<div class="reels-feed">${videos.map(m=>html`<article class="reel-card"><div class="reel-video">${mediaSrc(m)?html`<video controls playsinline preload="metadata" src="${mediaSrc(m)}"></video>`:html`<div class="empty">الفيديو غير متاح للعرض</div>`}</div><div class="reel-caption"><b>${m.title}</b><p>${m.description||''}</p><span class="muted small">${m.author_name||'الشيخ'} · ${fmtStamp(m.created_at)}</span><div class="chips"><button class="btn sm sec2" data-act="media-comments" data-id="${m.id}">التعليقات</button><button class="btn sm sec2" data-act="media-bookmark" data-id="${m.id}">حفظ</button></div></div></article>`)}</div>`:empty('لا توجد فيديوهات منشورة بعد','ستظهر فيديوهات الشيخ هنا بتصفح عمودي شبيه بالريلز.'));
}
function drawPosts(q) { drawNewsTab('posts',q); }
function openPostModal() {
  if (!isStaff()) return;
  openModal('نشر تحديث', html`<form class="form" data-form="post"><label class="field"><span>العنوان</span><input name="title" maxlength="160" required></label><label class="field"><span>المحتوى</span><textarea name="body" maxlength="5000" required></textarea></label><div class="two"><label class="field"><span>الجمهور</span><select name="aud" data-ch="postAud"><option value="all">كل الأكاديمية</option><option value="group">فوج محدد</option></select></label><label class="field hidden" id="postGroupWrap"><span>الفوج</span><select name="group">${S.groups.map(g => html`<option value="${g.id}">${g.name}</option>`)}</select></label></div><button class="btn" type="submit">نشر الآن</button></form>`);
}

function openTeacherGroupModal(id){
  if(S.user.role!=='teacher')return;const g=id?S.groups.find(x=>x.id===id):null;
  openModal(g?'تعديل الفوج':'إضافة فوج',html`<form class="form" data-form="teacher-group" data-id="${g?.id||''}"><label class="field"><span>اسم الفوج</span><input name="name" maxlength="120" required value="${g?.name||''}"></label><label class="field"><span>المهمة أو الوصف</span><textarea name="description" maxlength="600" rows="3">${g?.description||''}</textarea></label><label class="field"><span>المستوى</span><input name="level" maxlength="80" value="${g?.level||'عام'}"></label><button class="btn" type="submit">حفظ</button></form>`);
}
function openTeacherStudentModal(id){
  if(S.user.role!=='teacher')return;const st=id?S.students.find(x=>x.id===id):null;
  if(st){openModal('تعديل بيانات الطالب',html`<form class="form" data-form="teacher-student" data-id="${st.id}"><label class="field"><span>اسم الطالب</span><input name="name" maxlength="120" required value="${st.name||''}"></label><label class="field"><span>المستوى</span><input name="level" maxlength="80" value="${st.level||'المستوى الأساسي'}"></label><p class="muted small">لتغيير الفوج استخدم زر «طلب نقل»؛ النقل المباشر يبقى من صلاحية المدير.</p><button class="btn" type="submit">حفظ التعديل</button></form>`);return;}
  openModal('إضافة طالب',html`<form class="form" data-form="teacher-student"><label class="field"><span>اسم الطالب ثم لقبه</span><input name="name" maxlength="120" required placeholder="مثال: محمد مداني"><small class="muted">اكتب الاسم أولًا ثم اللقب؛ فالاسم الأول يدخل في كلمة المرور الافتراضية.</small></label><label class="field"><span>البريد الإلكتروني (اختياري)</span><input name="email" type="email"></label><label class="field"><span>كلمة مرور أولية (اختيارية)</span><div class="row"><input id="teacherStudentPassword" name="password" type="password" minlength="8" autocomplete="new-password" placeholder="افتراضيًا: الاسم الأول +123"><label class="check"><input type="checkbox" data-ch="passwordVisibility" data-target="teacherStudentPassword"><span>إظهار</span></label></div></label><label class="field"><span>تأكيد كلمة المرور (إذا أدخلتها يدويًا)</span><div class="row"><input id="teacherStudentConfirm" name="confirm_password" type="password" minlength="8" autocomplete="new-password"><label class="check"><input type="checkbox" data-ch="passwordVisibility" data-target="teacherStudentConfirm"><span>إظهار</span></label></div></label><label class="field"><span>الفوج</span><select name="group_id" required>${S.groups.map(g=>html`<option value="${g.id}">${g.name}</option>`)}</select></label><label class="field"><span>المستوى</span><input name="level" maxlength="80" value="المستوى الأساسي"></label><button class="btn" type="submit">إنشاء حساب الطالب</button></form>`);
}

/* ═══════════ الأفواج والمنهج ═══════════ */
async function pgGroups() {
  const catalog = await api('/api/group-catalog');
  const reqs = await api('/api/group-requests');
  const pending = reqs.filter(r=>r.status==='pending');
  if (S.user.role === 'student') {
    render(html`<div class="stack"><div class="card hero"><h2>الأفواج والطلبات</h2><p>يمكنك طلب الانضمام إلى فوج آخر، لكن لا يتغير فوجك إلا بعد اعتماد الإدارة.</p></div>
      <div class="card"><div class="sec"><div><h3>فوجي الحالي</h3><p class="muted">${S.groups.map(g=>g.name).join('، ')||'لم يُسند بعد'}</p></div></div>${pending.length?pending.map(r=>html`<div class="item"><div class="row wrap"><div><b>${r.group_name}</b><p class="muted">${r.reason||'بدون ملاحظة'}</p></div><span class="badge gold">قيد موافقة المدير</span></div><button class="btn sm sec2" data-act="cancel-group-request" data-id="${r.id}">إلغاء الطلب</button></div>`):''}</div>
      <div class="grid g3">${catalog.map(g=>html`<div class="card"><div class="row"><span class="avatar">${initial(g.name)}</span><span class="badge">${g.level||'أساسي'}</span></div><h3 style="margin-top:10px">${g.name}</h3><p class="muted">${g.description||''}</p><div class="chips"><span class="chip">${g.student_count} طالب</span><span class="chip">${(g.teachers||[]).join('، ')||'لم يُسند شيخ بعد'}</span></div>${S.groups.some(x=>x.id===g.id)?html`<span class="badge ok">منضم</span>`:html`<button class="btn sm" data-act="request-group" data-id="${g.id}">طلب الانضمام</button>`}</div>`)}</div></div>`);
    return;
  }
  render(html`<div class="stack"><div class="card"><div class="sec"><div><h3>إدارة الأفواج والطلبات</h3><p class="muted">${S.user.role==='teacher'?'أدر الأفواج المسندة إليك وطلابها.':'المدير يعتمد الطلبات ويملك النقل المباشر.'}</p></div>${S.user.role==='teacher'?html`<button class="btn" data-act="teacher-new-group">إضافة فوج</button>`:''}</div>
    ${reqs.length?reqs.map(r=>html`<div class="item"><div class="row wrap"><div><b>${r.student_name}</b><p class="muted small">${r.current_group_name} ← ${r.group_name}</p></div><span class="badge ${r.status==='approved'?'ok':r.status==='rejected'?'bad':'gold'}">${r.status==='approved'?'مقبول':r.status==='rejected'?'مرفوض':'بانتظار المدير'}</span></div><p>${r.reason||''}</p>${S.user.role==='admin'&&r.status==='pending'?html`<div class="chips"><button class="btn sm" data-act="approve-group-request" data-id="${r.id}">موافقة ونقل</button><button class="btn sm sec2" data-act="reject-group-request" data-id="${r.id}">رفض</button></div>`:''}</div>`):empty('لا توجد طلبات أفواج')}</div>
    <div class="grid g3">${catalog.map(g=>html`<div class="card"><div class="row"><b>${g.name}</b><span class="badge">${g.student_count} طالب</span></div><p class="muted">${g.description||''}</p><div class="small muted">${(g.teachers||[]).join('، ')||'بدون شيخ'}</div>${S.user.role==='teacher'?html`<div class="chips" style="margin-top:10px"><button class="btn sm sec2" data-act="teacher-edit-group" data-id="${g.id}">تعديل</button><button class="btn sm danger" data-act="teacher-delete-group" data-id="${g.id}">حذف</button></div>`:''}</div>`)}</div></div>`);
}
async function openLearningSubjectLessons(id) {
  const learning = await api('/api/learning');
  const subject = learning.subjects.find(x => x.id === id);
  const lessons = learning.lessons.filter(x => x.subject_id === id);
  openModal('مسار: ' + (subject?.name || 'المادة'), html`<div class="stack">
    <p class="muted">اختر درسًا واحدًا، وافهمه بهدوء، ثم سجّل إكماله بعد الانتهاء.</p>
    ${lessons.length ? lessons.map((lesson, i) => html`<div class="item subject-lesson-row"><div class="row wrap"><div class="subject-lesson-copy"><span class="badge ${lesson.completed ? 'ok' : ''}">${lesson.completed ? 'مكتمل' : 'الدرس ' + (i + 1)}</span><b>${lesson.title}</b><p class="muted small">${lesson.description || 'خطوة في هذا المسار'}</p></div><button class="btn sm" type="button" data-act="open-lesson" data-id="${lesson.id}">${lesson.completed ? 'راجع الدرس' : 'ابدأ الدرس'}</button></div></div>`) : empty('لم تُضف دروس لهذا المسار بعد', 'يمكنك العودة لاحقًا أو سؤال الشيخ عن الخطة.') }
  </div>`);
}

async function pgCurriculum() {
  const c = await api('/api/curriculum'); const optional = S.user.role==='student' ? await api('/api/optional-curriculum') : [];
  const cls = { memorize: ['حفظ', 'gold'], understand: ['فهم', ''], review: ['مراجعة', ''], apply: ['تطبيق', ''], discussion: ['نقاش', ''], optional: ['اختياري', ''] };
  const subj = Object.fromEntries(c.subjects.map(s => [s.id, s.name]));
  render(html`<div class="stack"><div class="card hero"><h2>خريطة المنهج</h2><p>ليس كل علم يُحفظ: بعضه يُفهم، وبعضه يُطبَّق، وبعضه يحتاج مراجعة دورية.</p><div class="chips">${c.classifications.map(x => html`<span class="chip">${x.name}</span>`)}</div></div>
  <div class="grid g3">${c.subjects.map(s => { const m = cls[s.classification] || [s.classification, '']; return html`<div class="card"><div class="row"><span class="badge ${m[1]}">${m[0]}</span><span class="badge">${s.required ? 'أساسي' : 'اختياري'}</span></div><h3 style="margin-top:10px">${s.name}</h3><p class="muted">${s.description}</p><div class="chips" style="margin-top:12px"><span class="chip">${s.category}</span><span class="chip">${c.lessons.filter(l => l.subject_id === s.id).length} درس</span></div>${S.user.role==='student' && (s.required || optional.some(x => x.id === s.id && x.enrolled))?html`<button class="btn sm sec2 subject-open" type="button" data-act="view-subject-lessons" data-id="${s.id}">استكشف الدروس <span aria-hidden="true">←</span></button>` : ''}</div>`; })}</div>
  <div class="card"><div class="sec"><h3>البرنامج الأسبوعي</h3></div>${c.schedule.length ? c.schedule.map(x => html`<div class="item"><div class="row"><b>${x.day} · ${x.time}</b><span class="badge">${x.type}</span></div><p>${subj[x.subject_id] || ''} · ${(c.lessons.find(l => l.id === x.lesson_id) || {}).title || ''}</p></div>`) : empty('لا يوجد برنامج')}</div>${S.user.role==='student'?html`<div class="card"><div class="sec"><div><h3>المناهج الإضافية</h3><p class="muted">اختر ما يناسبك؛ المواد الاختيارية لا تدخل مسارك الأساسي إلا بمشاركتك.</p></div></div>${optional.length?optional.map(x=>html`<div class="item"><div class="row wrap"><div><b>${x.name}</b><p class="muted small">${x.description||''} · ${x.lesson_count} درس</p></div>${x.enrolled?html`<span class="badge ok">مشترك</span>`:html`<button class="btn sm" data-act="enroll-optional" data-id="${x.id}">أشارك في هذا المسار</button>`}</div></div>`):empty('لا توجد مواد إضافية متاحة')}</div>`:''}</div></div>`);
}

/* ═══════════ الطلاب وملف الطالب ═══════════ */
async function openStudentGroupChange(id){
  const st=S.students.find(x=>x.id===id), catalog=await api('/api/group-catalog'); if(!st)return;
  if(S.user.role==='admin'){ openModal('تغيير أفواج الطالب',html`<form class="form" data-form="student-groups" data-id="${id}"><p class="muted">يمكن للمدير نقل الطالب مباشرة أو إبقاؤه في أكثر من فوج.</p><div class="stack">${catalog.map(g=>html`<label class="check"><input type="checkbox" name="group_ids" value="${g.id}"${(st.groups||[]).some(x=>x.id===g.id)?raw(' checked'):''}><span>${g.name}</span></label>`)}</div><button class="btn" type="submit">حفظ التغيير</button></form>`); }
  else { openModal('طلب نقل الطالب',html`<form class="form" data-form="group-request" data-student="${id}"><label class="field"><span>الفوج المطلوب</span><select name="group_id" required>${catalog.filter(g=>!(st.groups||[]).some(x=>x.id===g.id)).map(g=>html`<option value="${g.id}">${g.name}</option>`)}</select></label><label class="field"><span>السبب</span><textarea name="reason" maxlength="500"></textarea></label><button class="btn" type="submit">رفع الطلب للمدير</button></form>`); }
}
function pgStudents() {
  render(html`<div class="card"><div class="toolbar"><label class="field"><span>بحث</span><input id="stuQ" placeholder="اسم الطالب" data-in="stuFilter"></label><label class="field"><span>الفوج</span><select id="stuG" data-ch="stuFilter"><option value="">كل الأفواج</option>${S.groups.map(g => html`<option value="${g.id}">${g.name}</option>`)}</select></label>${S.user.role==='teacher'?html`<button class="btn" data-act="teacher-new-student">إضافة طالب</button>`:''}</div><div id="stuList"></div></div>`);
  drawStudents();
}
function drawStudents() {
  const q = ($('#stuQ') || {}).value || '', g = ($('#stuG') || {}).value || '';
  const list = S.students.filter(s => s.name.includes(q.trim()) && (!g || (s.groups || []).some(x => x.id === g)));
  put($('#stuList'), list.length ? html`<div class="scroll"><table class="tbl stack-m"><thead><tr><th>الطالب</th><th>الفوج</th><th>الحضور</th><th style="width:22%">التقدم</th><th>إدارة</th></tr></thead><tbody>${list.map(s => html`<tr class="click" data-act="open-file" data-id="${s.id}" tabindex="0"><td data-l="الطالب"><div class="person"><span class="avatar">${initial(s.name)}</span><b>${s.name}</b>${s.demo?html`<span class="badge" style="margin-right:6px">نموذج</span>`:''}</div></td><td data-l="الفوج">${(s.groups || []).map(x => x.name).join('، ') || '—'}</td><td data-l="الحضور">${s.attendance_rate || 0}%</td><td data-l="التقدم">${bar(s.progress)}</td><td><div class="chips"><button class="btn sm sec2" data-act="change-student-group" data-id="${s.id}">${S.user.role==='admin'?'تغيير الفوج':'طلب نقل'}</button>${S.user.role==='teacher'?html`<button class="btn sm sec2" data-act="teacher-edit-student" data-id="${s.id}">تعديل</button><button class="btn sm danger" data-act="teacher-delete-student" data-id="${s.id}">حذف</button>`:''}</div></td></tr>`)}</tbody></table></div>` : empty('لا يوجد طلاب مطابقون'));
  requestAnimationFrame(() => document.querySelectorAll('.progress i[data-w]').forEach(i => { i.style.width = i.dataset.w + '%'; }));
}
function openFile(id) { S.file = { id, tab: 'overview', month: today().slice(0, 7), data: null }; showPage('file'); }
function pgProfile() { const s = S.students[0]; if (!s) return render(html`<div class="card">${empty('لا يوجد ملف مرتبط بحسابك بعد')}</div>`); S.file = { ...S.file, id: s.id, data: null }; return pgFile(); }
const TABS = [['overview', 'نظرة عامة'], ['attendance', 'الحضور'], ['curriculum', 'المنهج'], ['memo', 'الحفظ'], ['review', 'المراجعة'], ['tests', 'الاختبارات والدرجات'], ['goals', 'الأهداف'], ['notes', 'الملاحظات'], ['report', 'التقرير']];
async function pgFile() {
  const F = S.file; if (!F.id) return showPage('dashboard');
  F.data = await api(`/api/students/${encodeURIComponent(F.id)}/file?month=${F.month}`);
  drawFile();
}
function drawFile() {
  const F = S.file, d = F.data, s = d.student;
  const back = S.user.role === 'student' ? '' : html`<button class="back noprint" data-act="nav" data-page="${S.user.role === 'parent' ? 'children' : 'students'}">${ico('back')}<span>رجوع</span></button>`;
  render(html`${back}<div class="card hero file-hero"><div class="file-head"><span class="avatar">${initial(s.name)}</span><div><h2 style="margin:0">${s.name}</h2><p>${s.level || ''}${s.groups.length ? ' · ' + s.groups.map(g => g.name).join('، ') : ''}</p></div></div></div>
    <div class="rail noprint" role="tablist">${TABS.map(([k, l]) => html`<button role="tab" data-act="file-tab" data-tab="${k}" aria-selected="${k === F.tab}" class="${k === F.tab ? 'active' : ''}">${l}</button>`)}</div>
    <div class="tab-body" id="tabBody">${tabContent(F.tab, d)}</div>`);
}
function tabContent(tab, d) {
  const m = d.monthly, a = d.attendance;
  switch (tab) {
    case 'overview': return html`<div class="stack"><div class="grid g4"><div class="metric"><b>${pct(m.attendance.rate)}</b><span>حضور ${m.month_label}</span></div><div class="metric"><b>${pct(m.grades.average)}</b><span>متوسط الدرجات</span></div><div class="metric"><b>${pct(m.memorization.mastery)}</b><span>إتقان الحفظ</span></div><div class="metric"><b>${pct(m.goals.progress)}</b><span>تقدم الأهداف</span></div></div>
      <div class="card"><div class="lists"><div><h3 style="margin-bottom:6px">نقاط القوة</h3>${m.strengths.length ? html`<ul class="pts good">${m.strengths.map(x => html`<li>${x}</li>`)}</ul>` : html`<p class="muted">ستظهر مع تراكم البيانات.</p>`}</div><div><h3 style="margin-bottom:6px">ما يحتاج تحسينًا</h3>${m.improvements.length ? html`<ul class="pts gap">${m.improvements.map(x => html`<li>${x}</li>`)}</ul>` : html`<p class="muted">لا شيء ملحّ الآن.</p>`}</div></div></div>
      <div class="card"><div class="sec"><h3>الملخص</h3><button class="btn sec2 sm" data-act="file-tab" data-tab="report">فتح التقرير</button></div><p style="line-height:2">${m.summary}</p></div></div>`;
    case 'attendance': return html`<div class="stack"><div class="grid g4"><div class="metric"><b>${pct(a.summary.rate)}</b><span>نسبة الحضور (كل السجل)</span></div>${ATT.slice(0, 3).map(([k, l]) => html`<div class="metric"><b>${a.summary[k]}</b><span>${l}</span></div>`)}</div>
      ${a.weekly?.length ? html`<div class="card"><div class="sec"><div><h3>ملخص الحضور الأسبوعي</h3><p class="muted small">هذه بيانات مجمعة أدخلت للأسبوع، ولم تُعطَ تواريخ كل جلسة؛ لذلك لم ننشئ تواريخ وهمية.</p></div><span class="chip">${a.summary.present} حضور</span></div><table class="tbl"><thead><tr><th>الفترة</th><th>الحضور</th><th>التأخر</th><th>الغياب</th><th>بعذر</th></tr></thead><tbody>${a.weekly.map(r => html`<tr><td>${fmtDate(r.start)} — ${fmtDate(r.end)}</td><td><b>${r.present}</b></td><td>${r.late||0}</td><td>${r.absent||0}</td><td>${r.excused||0}</td></tr>`)}</tbody></table></div>` : ''}
      <div class="card"><div class="sec"><h3>سجل الحضور التفصيلي</h3><span class="chip">بعذر: ${a.summary.excused}</span></div>${a.records.length ? html`<table class="tbl"><thead><tr><th>التاريخ</th><th>الحالة</th><th>ملاحظة</th></tr></thead><tbody>${a.records.map(r => html`<tr><td>${fmtDate(r.date)}</td><td><span class="badge ${attTone(r.status)}">${attLabel(r.status)}</span></td><td class="muted">${r.note || ''}</td></tr>`)}</tbody></table>` : empty(a.weekly?.length ? 'لا توجد أحداث يومية مفصلة بعد' : 'لا يوجد حضور مسجّل')}</div></div>`;
    case 'curriculum': return html`<div class="card"><div class="sec"><h3>برنامجه الأسبوعي</h3></div>${d.curriculum.length ? d.curriculum.map(x => html`<div class="item"><div class="row"><b>${x.day} · ${x.time}</b><span class="badge">${x.type}</span></div><p>${x.subject_name}${x.lesson_title ? ' · ' + x.lesson_title : ''} <span class="muted small">(${x.group_name})</span></p></div>`) : empty('لا يوجد برنامج')}</div>`;
    case 'memo': return html`<div class="card"><div class="sec"><h3>سجل الحفظ والإتقان</h3></div>${d.memorization.length ? d.memorization.map(x => html`<div class="item"><div class="row"><b>${x.item_name}</b><span class="badge ${x.status === 'memorized' ? 'ok' : 'late'}">${x.status === 'memorized' ? 'محفوظ' : 'قيد التعلم'}</span></div><div class="row small muted" style="margin:6px 0 5px"><span>${x.subject_name}</span><span>الإتقان ${x.mastery}%</span></div>${bar(x.mastery)}</div>`) : empty('لا يوجد سجل حفظ بعد')}</div>`;
    case 'review': return html`<div class="card"><div class="sec"><h3>المراجعة المتباعدة</h3></div><div class="chips" style="margin-bottom:12px"><span class="chip">الفواصل الحالية: ${d.review.intervals_days.join(' · ')} يومًا</span><span class="chip">آلية تنظيمية قابلة للتعديل</span></div>${d.review.items.length ? d.review.items.map(x => html`<div class="item"><div class="row"><b>${x.item_name}</b><span class="badge ${x.due ? 'late' : ''}">${x.due ? 'مستحقة اليوم' : 'القادمة ' + x.next_review_at}</span></div><p class="small muted">آخر مراجعة: ${x.last_reviewed_at || '—'} · الإتقان ${x.mastery}%</p></div>`) : empty('لا توجد مراجعات مجدولة')}</div>`;
    case 'tests': return html`<div class="card"><div class="sec"><h3>الاختبارات والدرجات</h3></div>${d.tests.length ? html`<table class="tbl"><thead><tr><th>الاختبار</th><th>التاريخ</th><th>الدرجة</th></tr></thead><tbody>${d.tests.map(t => html`<tr><td><b>${t.title}</b><div class="muted small">${t.subject_name || ''}</div></td><td>${fmtDate(t.date)}</td><td>${t.grade ? html`<b>${t.grade.score}</b> / ${t.max_score}<div class="muted small">${t.grade.note || ''}</div>` : html`<span class="badge">لم تُرصد</span>`}</td></tr>`)}</tbody></table>` : empty('لا توجد اختبارات')}</div>`;
    case 'goals': return html`<div class="card"><div class="sec"><h3>الأهداف</h3></div>${d.goals.length ? d.goals.map(g => html`<div class="item"><div class="row"><b>${g.title}</b><span class="badge">${g.progress}%</span></div><p class="small muted" style="margin-bottom:6px">${g.target}</p>${bar(g.progress)}</div>`) : empty('لا توجد أهداف بعد')}</div>`;
    case 'notes': return html`<div class="stack">${d.can_edit ? html`<div class="card"><div class="sec"><h3>ملاحظة جديدة</h3></div><form class="form" data-form="note"><div class="two"><label class="field"><span>التصنيف</span><select name="category">${CATS.map(c => html`<option>${c}</option>`)}</select></label><label class="check" style="align-self:end"><input type="checkbox" name="shared"><span>مشاركة مع الطالب وولي الأمر</span></label></div><label class="field"><span>الملاحظة</span><textarea name="text" maxlength="1000" placeholder="اكتب ملاحظة قصيرة ونافعة تساعده في الخطوة القادمة" required></textarea></label><div><button class="btn" type="submit">${ico('save')}<span>حفظ الملاحظة</span></button></div></form></div>` : ''}
      <div class="card"><div class="sec"><h3>الملاحظات السابقة</h3></div>${d.notes.length ? d.notes.map(n => html`<div class="item"><div class="row wrap"><div class="chips"><span class="badge ${n.category === 'سلوكي' ? 'late' : n.category === 'تحفيزي' ? 'ok' : ''}">${n.category}</span>${d.can_edit ? html`<span class="badge ${n.shared ? 'info' : ''}">${n.shared ? 'مشاركة' : 'للمعلمين فقط'}</span>` : ''}</div><span class="muted small">${fmtDate(n.date)}</span></div><p>${n.text}</p><div class="muted small" style="margin-top:4px">${n.teacher_name || ''}</div></div>`) : empty('لا توجد ملاحظات بعد')}</div></div>`;
    case 'report': return html`<div class="stack"><div class="toolbar noprint"><label class="field"><span>الشهر</span><select data-ch="fileMonth">${monthOptions(S.file.month)}</select></label><button class="btn sec2" data-act="print-report">${ico('print')}<span>طباعة / حفظ PDF</span></button>${d.can_edit ? html`<button class="btn" data-act="save-report">${ico('save')}<span>حفظ في السجل</span></button>` : ''}</div>${reportSheet(d.student, d.monthly)}
      ${d.reports.length ? html`<div class="card noprint"><div class="sec"><h3>التقارير المحفوظة</h3></div>${d.reports.map(r => html`<div class="item"><div class="row"><b>${r.period}</b><span class="badge">${r.type === 'yearly' ? 'سنوي' : 'شهري'}${r.auto ? ' · تلقائي' : ''}</span></div><div class="row small muted" style="margin-top:6px"><span>الحضور ${r.attendance_rate}%</span><span>المعدل ${r.average}%</span><span>الحفظ ${r.memorization_mastery}%</span><span>الأهداف ${r.goals_progress}%</span></div></div>`)}</div>` : ''}</div>`;
    default: return '';
  }
}
function monthOptions(sel) {
  const out = [], d = new Date(); d.setDate(1);
  for (let i = 0; i < 12; i++) { const v = `${d.getFullYear()}-${p2(d.getMonth() + 1)}`; out.push(html`<option value="${v}"${v === sel ? raw(' selected') : ''}>${MONTHS[d.getMonth()]} ${d.getFullYear()}</option>`); d.setMonth(d.getMonth() - 1); }
  return out;
}
function reportSheet(s, m) {
  const a = m.attendance, g = m.grades, sharedNotes = (m.notes.items || []).filter(n => n.shared);
  return html`<article class="sheet print-area" id="reportSheet">
    <div class="sheet-head"><div><h2>أكاديمية بناء الإنسان</h2><div class="muted">التقرير الشهري · ${m.month_label}</div></div><span class="brandmark">ب</span></div>
    <div class="row wrap"><div><b style="font-size:18px">${s.name}</b><div class="muted">${s.level || ''}${s.groups && s.groups.length ? ' · ' + s.groups.map(x => x.name).join('، ') : ''}</div></div></div>
    <div class="metrics"><div class="metric"><b>${pct(a.rate)}</b><span>نسبة الحضور</span></div><div class="metric"><b>${pct(g.average)}</b><span>متوسط الدرجات</span></div><div class="metric"><b>${pct(m.memorization.mastery)}</b><span>إتقان الحفظ</span></div><div class="metric"><b>${pct(m.goals.progress)}</b><span>تقدم الأهداف</span></div></div>
    <div class="chips"><span class="chip">أيام الحضور: ${a.present}</span><span class="chip">التأخر: ${a.late}</span><span class="chip">الغياب: ${a.absent}</span><span class="chip">بعذر: ${a.excused}</span><span class="chip">الاختبارات: ${g.count} من ${g.tests_in_month}</span><span class="chip">محفوظ: ${m.memorization.memorized} من ${m.memorization.items}</span></div>
    <h4>الملخص</h4><div class="summary">${m.summary}</div>
    <div class="lists"><div><h4>نقاط القوة</h4>${m.strengths.length ? html`<ul class="pts good">${m.strengths.map(x => html`<li>${x}</li>`)}</ul>` : html`<p class="muted">—</p>`}</div><div><h4>ما يحتاج تحسينًا</h4>${m.improvements.length ? html`<ul class="pts gap">${m.improvements.map(x => html`<li>${x}</li>`)}</ul>` : html`<p class="muted">—</p>`}</div></div>
    ${g.items.length ? html`<h4>الاختبارات</h4><table class="tbl"><tbody>${g.items.map(i => html`<tr><td>${i.title}</td><td>${fmtDate(i.date)}</td><td><b>${i.score}</b> / ${i.max}</td></tr>`)}</tbody></table>` : ''}
    ${sharedNotes.length ? html`<h4>ملاحظات المعلم</h4>${sharedNotes.map(n => html`<div class="item"><div class="row"><b>${n.category}</b><span class="muted small">${fmtDate(n.date)}</span></div><p>${n.text}</p></div>`)}` : ''}
    <div class="sign"><div>المعلم</div><div>ولي الأمر</div></div>
    <div class="foot"><span>هذا التقرير مولَّد تلقائيًا من البيانات المسجّلة ويقيس نمو الطالب مقارنةً بنفسه.</span><span>${fmtDate(today())}</span></div></article>`;
}
function printReport() { document.body.classList.add('print-report'); const done = () => { document.body.classList.remove('print-report'); window.removeEventListener('afterprint', done); }; window.addEventListener('afterprint', done); window.print(); }

/* ═══════════ أبناء الطالب / ولي الأمر ═══════════ */
function pgChildren() {
  render(S.students.length ? html`<div class="grid g2">${S.students.map(s => html`<div class="card"><div class="person"><span class="avatar">${initial(s.name)}</span><div><b>${s.name}</b><div class="muted small">${(s.groups || []).map(g => g.name).join('، ') || s.level || ''}</div></div></div>
    <div style="margin-top:16px"><div class="row small"><span>الحضور</span><b>${s.attendance_rate}%</b></div>${bar(s.attendance_rate)}</div><div style="margin-top:12px"><div class="row small"><span>التقدم</span><b>${s.progress}%</b></div>${bar(s.progress)}</div><div style="margin-top:12px"><div class="row small"><span>المراجعة</span><b>${s.review}%</b></div>${bar(s.review)}</div>
    <div class="chips" style="margin-top:16px"><button class="btn sm" data-act="open-file" data-id="${s.id}">فتح الملف</button><button class="btn sm sec2" data-act="child-report" data-id="${s.id}">التقرير الشهري</button></div></div>`)}</div>` : html`<div class="card">${empty('لا يوجد أبناء مرتبطون بهذا الحساب بعد')}</div>`);
}
function pgTracking() {
  const bars = k => S.students.map(s => html`<div style="margin:14px 0"><div class="row"><span>${s.name}</span><b>${s[k] || 0}%</b></div>${bar(s[k])}</div>`);
  render(html`<div class="cols" style="grid-template-columns:1fr 1fr"><div class="card"><div class="sec"><h3>الحضور</h3></div>${S.students.length ? bars('attendance_rate') : empty('لا يوجد طلاب')}</div><div class="card"><div class="sec"><h3>التقدم التعليمي</h3></div>${S.students.length ? bars('progress') : empty('لا يوجد طلاب')}</div></div><p class="muted small" style="margin-top:12px">للمتابعة الفردية افتح ملف الطالب؛ الأكاديمية تقيس تقدم كل طالب مقارنةً بنفسه.</p>`);
}
let LDATA = null;
let LQUERY = '';
let PRACTICE = null;
async function pgLearning() {
  LDATA = await api('/api/learning');
  if (!LDATA.student) return render(html`<div class="card">${empty('لا يوجد ملف طالب مرتبط بحسابك بعد')}</div>`);
  const [r, g] = await Promise.all([api('/api/review'), api('/api/goals')]);
  LDATA.review = r; LDATA.goals = g; LQUERY = '';
  drawLearning();
}
function drawLearning() {
  const L = LDATA, r = L.review || [], g = L.goals || [];
  const completed = L.lessons.filter(x => x.completed).length, total = L.lessons.length;
  const next = L.lessons.find(x => !x.completed);
  const list = L.lessons.filter(x => `${x.title} ${x.subject_name} ${x.description || ''}`.toLowerCase().includes(LQUERY.toLowerCase()));
  render(html`<div class="stack">
    <div class="card hero hero-main"><div class="hero-copy"><span class="eyebrow">رحلتك التعليمية</span><h2>تقدّم بهدوء، وتعلّم ما ينفعك</h2><p>أكمل الدروس على مهل، وارجع للمراجعة حين تحتاج. لا يوجد سباق ولا ضغط.</p><div class="when">${completed} من ${total} درس مكتمل · ${total ? Math.round(completed / total * 100) : 0}%</div></div><div class="hero-orbit"><span>ب</span><i></i><i></i></div></div>
    ${next ? html`<div class="card continue-card"><div><span class="eyebrow">الخطوة التالية</span><h3>${next.title}</h3><p class="muted">${next.subject_name} · ${next.description || 'درس جديد في رحلتك التعليمية'}</p></div><button class="btn" data-act="open-lesson" data-id="${next.id}">فتح الدرس</button></div>` : html`<div class="card flat"><b>أتممت جميع الدروس المتاحة 🎉</b><p class="muted">يمكنك الآن التركيز على المراجعة وتثبيت ما تعلمته.</p></div>`}
    <div class="grid g3">${L.subjects.filter(x => x.lesson_count).map(x => html`<div class="card"><div class="row"><b>${x.name}</b><span class="badge">${x.completed}/${x.lesson_count}</span></div><p class="muted small" style="margin:6px 0 9px">${x.description || ''}</p>${bar(x.progress)}<div class="row small muted" style="margin-top:7px"><span>${x.required ? 'أساسي' : 'اختياري'}</span><b>${x.progress}%</b></div></div>`)}</div>
    <div class="card"><div class="sec"><div><h3>الدروس</h3><p class="muted small">افتح الدرس لقراءة المحتوى والهدف، ثم علّم عليه كمكتمل بعد الانتهاء.</p></div><label class="field lesson-search"><span class="sr">البحث في الدروس</span><input placeholder="ابحث عن درس…" value="${LQUERY}" data-in="lessonSearch"></label></div>${list.length ? list.map(x => html`<div class="item lesson-row"><div class="row wrap"><div style="min-width:0"><div class="row" style="justify-content:flex-start"><span class="badge ${x.completed ? 'ok' : ''}">${x.completed ? 'مكتمل' : 'لم يبدأ'}</span><b>${x.title}</b></div><p class="muted small" style="margin-top:4px">${x.subject_name} · ${x.description || ''}</p></div><div class="chips"><button class="btn sm sec2" data-act="open-lesson" data-id="${x.id}">فتح الدرس</button>${x.completed ? html`<button class="btn sm sec2" data-act="lesson-uncomplete" data-id="${x.id}">إلغاء الإكمال</button>` : ''}</div></div></div>`) : empty('لا توجد دروس مطابقة للبحث')}</div>
    <div class="cols">
      <div class="card"><div class="sec"><h3>المراجعة المستحقة</h3><span class="badge gold">${r.length} اليوم</span></div>${r.length ? r.map(x => html`<div class="item"><div class="row"><b>${x.item_name}</b><span class="badge gold">مستحقة</span></div><p class="small muted" style="margin-bottom:6px">الإتقان الحالي ${x.mastery}%</p>${bar(x.mastery)}</div>`) : empty('لا توجد مراجعات مستحقة اليوم','استمر بهدوء.')}</div>
      <div class="card"><div class="sec"><h3>أهدافي</h3><button class="btn sm sec2" data-act="new-goal">هدف جديد</button></div>${g.length ? g.map(x => html`<div class="item"><div class="row"><b>${x.title}</b><span class="badge ${x.status === 'completed' ? 'ok' : ''}">${x.progress}%</span></div><p class="small muted" style="margin-bottom:6px">${x.target}</p>${bar(x.progress)}<div class="chips" style="margin-top:8px">${[25,50,75,100].map(n => html`<button class="chip goal-chip" data-act="goal-progress" data-id="${x.id}" data-progress="${n}">${n}%</button>`)}</div></div>`) : empty('لا توجد أهداف بعد','ضع هدفًا صغيرًا واضحًا لهذا الأسبوع.')}</div>
    </div></div>`);
}
async function lessonSection(title, body, cls='') { if (!body) return ''; return html`<section class="lesson-section ${cls}"><h3>${title}</h3>${body}</section>`; }
function lessonList(items, cls='lesson-list') { return Array.isArray(items) && items.length ? html`<ul class="${cls}">${items.map(x => html`<li>${x}</li>`)}</ul>` : ''; }
function lessonSources(items, kind) {
  if (!Array.isArray(items) || !items.length) return '';
  return html`<div class="source-grid">${items.map(x => {
    const ref = x.reference || x.source || '';
    const text = x.text || x.content || x.title || '';
    return html`<div class="source-card ${kind}"><div class="source-label">${kind === 'ayah' ? 'آية' : 'حديث'}</div><p class="source-text">${text}</p>${ref ? html`<div class="source-ref">${ref}</div>` : ''}</div>`;
  })}</div>`;
}
function richLessonContent(c) {
  if (!c || typeof c !== 'object') return html`<p class="lesson-content">${c || 'لا يوجد محتوى تفصيلي لهذا الدرس بعد.'}</p>`;
  return html`<div class="lesson-reading">
    ${lessonSection('كلمة الشيخ', c.opening, 'opening')}
    ${lessonSources(c.ayahs, 'ayah')}
    ${lessonSources(c.hadiths, 'hadith')}
    ${lessonSection('قصة وموعظة', c.story, 'story')}
    ${lessonSection('الشرح', c.explanation, 'explanation')}
    ${lessonSection('أمثلة قريبة من حياتك', lessonList(c.examples), 'examples')}
    ${lessonSection('قف مع نفسك', lessonList(c.reflection_questions), 'reflection')}
    ${lessonSection('ثمرة الدرس والعمل به', c.action, 'action')}
    ${lessonSection('الحفظ', c.memorize, 'memorize')}
    ${lessonSection('المراجعة', c.review, 'review')}
    ${c.source_notes ? html`<details class="lesson-sources-note"><summary>ملاحظات المصادر</summary><p>${c.source_notes}</p></details>` : ''}
  </div>`;
}
async function openLesson(id) {
  await guard(async () => {
    const d = await api(`/api/lessons/${encodeURIComponent(id)}`);
    const l = d.lesson, c = l.content;
    const completeBtn = l.completed
      ? html`<button class="btn sec2" data-act="lesson-uncomplete" data-id="${l.id}">إلغاء إكمال الدرس</button>`
      : html`<button class="btn" data-act="lesson-complete-modal" data-id="${l.id}">أتممت الدرس</button>`;
    openModal(l.title, html`<div class="lesson-detail">
      <div class="lesson-cover"><div><span class="eyebrow">مجلس العلم</span><h2>${l.title}</h2><p>${l.subject_name} · ${l.duration_minutes} دقيقة تقريبًا · ${l.type_label}</p></div><div class="lesson-seal">علم<br><small>وعمل</small></div></div>
      <div class="card flat lesson-objective"><b>هدف الدرس</b><p>${l.objective}</p></div>
      ${richLessonContent(c)}
      <div class="lesson-footer row wrap"><span class="muted small">${l.completed ? 'تم إكمال هذا الدرس سابقًا.' : 'اقرأ على مهل، وتأمل، ثم اجعل للدرس أثرًا في عملك.'}</span>${S.user.role === 'student' ? html`<button class="btn sec2" type="button" data-act="open-practice" data-id="${l.id}">اختبر فهمك</button>` : ''}${completeBtn}</div>
    </div>`);
  });
}
async function openPractice(lessonId) {
  await guard(async () => {
    const data = await api('/api/learning/questions?lesson_id=' + encodeURIComponent(lessonId));
    if (!data.questions.length) {
      openModal('اختبر فهمك', html`<div class="practice-empty"><span class="practice-mark">✦</span><h3>لا توجد أسئلة تدريبية لهذا الدرس بعد</h3><p class="muted">يمكنك مراجعة الفكرة الأساسية، وسيضيف المعلم الأسئلة المناسبة لاحقًا.</p><button class="btn sec2" data-act="close-modal">العودة إلى الدرس</button></div>`);
      return;
    }
    PRACTICE = { lessonId, questions: data.questions, index: 0, result: null, score: 0, points: 0 };
    drawPractice();
  });
}
function drawPractice() {
  if (!PRACTICE) return;
  if (PRACTICE.index >= PRACTICE.questions.length) {
    openModal('أحسنت على المحاولة', html`<div class="practice-summary"><span class="practice-mark">✦</span><h3>أنهيت تدريب الدرس</h3><div class="practice-score">${PRACTICE.score} / ${PRACTICE.questions.length}</div><p>إجابات صحيحة</p><p class="muted">النقاط الجديدة: ${PRACTICE.points}. يمكنك إعادة قراءة الدرس ثم العودة للتدريب متى شئت.</p><button class="btn" data-act="close-modal">العودة إلى الدرس</button></div>`);
    return;
  }
  const q = PRACTICE.questions[PRACTICE.index];
  const options = q.type === 'true_false' ? [{value:'true',label:'صحيح'},{value:'false',label:'خطأ'}] : q.options.map(x => ({value:x,label:x}));
  const result = PRACTICE.result;
  openModal('اختبر فهمك', html`<div class="practice-view">
    <div class="practice-progress"><span>السؤال ${PRACTICE.index + 1} من ${PRACTICE.questions.length}</span><span>${PRACTICE.score} إجابات صحيحة</span></div>
    <div class="practice-track"><span style="width:${Math.round((PRACTICE.index + 1) / PRACTICE.questions.length * 100)}%"></span></div>
    <h3 class="practice-question">${q.title}</h3>
    ${result ? html`<div class="practice-feedback ${result.correct ? 'is-correct' : 'is-wrong'}"><b>${result.correct ? 'أحسنت، إجابة صحيحة' : 'ليست هذه الإجابة الصحيحة'}</b><p>الإجابة: ${result.correct_answer === 'true' ? 'صحيح' : result.correct_answer === 'false' ? 'خطأ' : result.correct_answer}</p><p>${result.explanation}</p>${result.points_awarded ? html`<span class="chip">+${result.points_awarded} نقطة</span>` : ''}</div>` : html`<form class="practice-options" data-form="practice-answer"><div class="stack">${options.map((o,i)=>html`<label class="practice-option"><input type="radio" name="answer" value="${o.value}" required><span class="practice-letter">${String.fromCharCode(65+i)}</span><span>${o.label}</span></label>`)}</div><button class="btn practice-submit" type="submit">تحقق من الإجابة</button></form>`}
    ${result ? html`<button class="btn practice-submit" type="button" data-act="practice-next">${PRACTICE.index + 1 === PRACTICE.questions.length ? 'عرض النتيجة' : 'السؤال التالي'}</button>` : ''}
  </div>`);
}
async function submitPracticeAnswer(form) {
  await guard(async () => {
    const selected = form.querySelector('input[name="answer"]:checked');
    if (!selected) { toast('اختر إجابة أولًا', true); return; }
    const q = PRACTICE?.questions[PRACTICE.index];
    if (!q || PRACTICE.result) return;
    const result = await post('/api/learning/attempts', { lesson_id: PRACTICE.lessonId, question_id: q.id, answer: selected.value });
    PRACTICE.result = result;
    if (result.correct) PRACTICE.score += 1;
    PRACTICE.points += result.points_awarded || 0;
    drawPractice();
  });
}
function nextPracticeQuestion() {
  if (!PRACTICE || !PRACTICE.result) return;
  PRACTICE.index += 1;
  PRACTICE.result = null;
  drawPractice();
}
function completeLessonFromModal(id) {
  return guard(async () => { await post(`/api/lessons/${encodeURIComponent(id)}/complete`); closeOverlay(); toast('أحسنت، تم تسجيل إكمال الدرس'); await pgLearning(); });
}
function openGoalModal() {
  openModal('هدف جديد', html`<form class="form" data-form="goal"><label class="field"><span>اسم الهدف</span><input name="title" maxlength="120" required placeholder="مثال: مراجعة 5 أيام هذا الأسبوع"></label><label class="field"><span>كيف أعرف أنني أنجزته؟</span><input name="target" maxlength="240" required placeholder="مثال: 20 دقيقة يوميًا لمدة 5 أيام"></label><label class="field"><span>نوع الهدف</span><select name="type"><option value="habit">عادة</option><option value="mastery">إتقان</option><option value="reading">قراءة</option><option value="personal">شخصي</option></select></label><button class="btn" type="submit">حفظ الهدف</button></form>`);
}

/* ═══════════ التقارير (طالب / ولي أمر) ═══════════ */
async function pgReports() {
  if (!S.students.length) return render(html`<div class="card">${empty('لا توجد بيانات مرتبطة بحسابك')}</div>`);
  const R = S.rep; if (!S.students.some(s => s.id === R.student_id)) R.student_id = S.students[0].id;
  const d = await api(`/api/reports/monthly?student_id=${encodeURIComponent(R.student_id)}&month=${R.month}`);
  render(html`<div class="stack"><div class="toolbar noprint">${S.students.length > 1 ? html`<label class="field"><span>الابن</span><select data-ch="repStudent">${S.students.map(s => html`<option value="${s.id}"${s.id === R.student_id ? raw(' selected') : ''}>${s.name}</option>`)}</select></label>` : ''}<label class="field"><span>الشهر</span><select data-ch="repMonth">${monthOptions(R.month)}</select></label><button class="btn sec2" data-act="print-report">${ico('print')}<span>طباعة / حفظ PDF</span></button></div>${reportSheet(d.student, d.report)}</div>`);
}

async function openAttendanceWeeklyReport(){
  const end = today();
  const startDate = new Date(end + 'T12:00:00');
  startDate.setDate(startDate.getDate() - 6);
  const start = `${startDate.getFullYear()}-${p2(startDate.getMonth()+1)}-${p2(startDate.getDate())}`;
  const group=S.att.group_id||'';
  const r=await api(`/api/attendance/weekly-report?start=${start}&end=${end}${group?'&group_id='+encodeURIComponent(group):''}`);
  openModal('التقرير الأسبوعي الآلي للحضور',html`<div class="stack">
    <div class="card flat"><div class="row wrap"><div><b>${r.period.label}</b><p class="muted small">التقرير مساعد للشيخ: يعرض الحضور الذي أُدخل يدويًا أو استورد كملخص أسبوعي، ثم يقترح متابعة لطيفة بدل كتابة التعليقات يدويًا.</p></div><span class="badge">${r.totals.real_students} طالبًا حقيقيًا</span></div><div class="chips" style="margin-top:10px"><span class="chip">غيابات: ${r.totals.absent_events}</span><span class="chip">حضور: ${r.totals.present_events}</span><span class="chip">يحتاجون متابعة: ${r.totals.followup_count}</span></div></div>
    <div class="card"><h3>المتابعة المقترحة</h3>${r.followup.length?r.followup.map(x=>html`<div class="item"><div class="row wrap"><b>${x.name}</b><span class="badge late">${x.absent} غياب</span></div><p>${x.comment}</p><p class="muted small">النصيحة: ${x.advice}</p></div>`):empty('لا توجد حالات تحتاج متابعة مهمة')}</div>
    <div class="card"><h3>تفصيل الطلبة</h3><div class="scroll"><table class="tbl"><thead><tr><th>الطالب</th><th>الحضور</th><th>الغياب</th><th>التعليق</th></tr></thead><tbody>${r.rows.map(x=>html`<tr><td><b>${x.name}</b>${x.demo?html`<span class="badge" style="margin-right:6px">نموذج</span>`:''}</td><td>${x.present}</td><td>${x.absent}</td><td><span class="badge">${x.priority}</span><div class="small muted" style="margin-top:5px">${x.comment}</div></td></tr>`)}</tbody></table></div></div>
  </div>`);
}
/* ═══════════ الحضور (واجهة المعلم) ═══════════ */
async function pgAttendance() {
  if (!S.groups.length) return render(html`<div class="card">${empty('لا توجد أفواج مسندة إليك', 'اطلب من الإدارة إسناد فوج لحسابك.')}</div>`);
  const A = S.att; if (!S.groups.some(g => g.id === A.group_id)) A.group_id = (S.groups.find(g => g.id === 'g5') || S.groups[0]).id; A.date = A.date || today();
  render(html`<div class="card"><div class="toolbar"><label class="field"><span>الفوج</span><select data-ch="attGroup">${S.groups.map(g => html`<option value="${g.id}"${g.id === A.group_id ? raw(' selected') : ''}>${g.name}</option>`)}</select></label><label class="field"><span>التاريخ</span><input type="date" value="${A.date}" max="${today()}" data-ch="attDate"></label><button class="btn sec2" data-act="att-all">الكل حاضر</button><button class="btn sec2" data-act="attendance-weekly-report">تقرير أسبوعي آلي</button></div><div id="attSheet"></div></div>`);
  await loadSheet();
}
async function loadSheet() {
  const A = S.att;
  const d = await api(`/api/attendance/sheet?group_id=${encodeURIComponent(A.group_id)}&date=${A.date}`);
  A.rows = d.students; A.loaded = d.students.some(r => r.status); drawSheet();
}
function tallyHtml() {
  const rows = S.att.rows || [], c = k => rows.filter(r => r.status === k).length;
  return html`${ATT.map(([k, l, t]) => html`<span class="badge ${t}">${l} ${c(k)}</span>`)}<span class="badge">لم يُحدَّد ${rows.filter(r => !r.status).length}</span>`;
}
function drawSheet() {
  const A = S.att, box = $('#attSheet'); if (!box) return;
  put(box, A.rows.length ? html`${A.loaded ? html`<p class="muted small" style="margin-bottom:6px">تم تحميل الحضور المسجَّل سابقًا لهذا اليوم؛ يمكنك تعديله.</p>` : ''}
    ${A.rows.map(r => html`<div class="att-row" data-row="${r.id}"><div class="person"><span class="avatar">${initial(r.name)}</span><b>${r.name}</b></div><div class="ctrl"><div class="seg" role="radiogroup" aria-label="حضور ${r.name}">${ATT.map(([k, l]) => html`<label><input type="radio" name="st_${r.id}" value="${k}" data-ch="attStatus" data-sid="${r.id}"${r.status === k ? raw(' checked') : ''}><span class="s-${k}">${l}</span></label>`)}</div><input class="note-in" placeholder="ملاحظة (اختياري)" maxlength="300" value="${r.note || ''}" data-in="attNote" data-sid="${r.id}"></div></div>`)}
    <div class="row wrap" style="margin-top:16px"><div class="tally" id="tally">${tallyHtml()}</div><button class="btn" data-act="att-save">${ico('save')}<span>حفظ حضور الجميع</span></button></div>` : empty('لا يوجد طلاب في هذا الفوج'));
}
async function saveAttendance(btn) {
  const A = S.att;
  const records = (A.rows || []).filter(r => ATT.some(([k]) => k === r.status))
    .map(r => ({ student_id: String(r.id), status: r.status, note: String(r.note || '').trim().slice(0, 300) }));
  if (!records.length) return toast('حدّد حالة طالب واحد على الأقل', true);
  const unique = new Set(records.map(r => r.student_id));
  if (unique.size !== records.length) return toast('تكرّر طالب في القائمة؛ أعد تحميل سجل الحضور', true);
  btn.disabled = true;
  try {
    const result = await post('/api/attendance/bulk', { group_id: A.group_id, date: A.date, records });
    // أعد القراءة من الخادم حتى تظهر القيم المحفوظة نفسها في سجل الفوج وملف الطالب.
    await loadSheet();
    toast(`تم حفظ ${result.saved} سجل حضور وتحديث القائمة`);
    document.querySelectorAll('.att-row').forEach(e => { e.classList.remove('flash'); void e.offsetWidth; e.classList.add('flash'); });
  } catch (e) {
    toast(e.message, true);
  } finally {
    btn.disabled = false;
  }
}

/* ═══════════ الاختبارات والدرجات ═══════════ */
async function pgTests() {
  if (S.grading) return drawGrading();
  const tests = await api('/api/tests');
  if (!tests.length) return render(html`<div class="card">${empty('لا توجد اختبارات بعد', isStaff() ? 'أنشئ أول اختبار من زر «اختبار».' : '')}</div>`);
  render(html`<div class="grid g2">${tests.map(t => html`<div class="card"><div class="row"><b style="font-size:17px">${t.title}</b><span class="badge ${t.status === 'graded' ? 'ok' : t.date < today() ? 'late' : ''}">${t.status === 'graded' ? 'مكتمل' : t.date < today() ? 'بانتظار الدرجات' : 'قادم'}</span></div>
    <p class="muted" style="margin-top:4px">${t.subject_name || ''}${t.group_name ? ' · ' + t.group_name : ''}</p>${t.description ? html`<p style="margin-top:6px">${t.description}</p>` : ''}
    <div class="chips" style="margin-top:12px"><span class="chip">${fmtDate(t.date)}</span><span class="chip">من ${t.max_score}</span></div>
    ${isStaff() ? html`<div class="row" style="margin-top:14px"><span class="muted small">رُصدت درجات ${t.graded_count} من ${t.roster_count}</span><button class="btn sm" data-act="grade-test" data-id="${t.id}">إدخال الدرجات</button></div>` : html`<div style="margin-top:14px">${t.my_grades.map(g => html`<div class="row small" style="padding:4px 0"><span>${S.students.length > 1 ? g.student_name : 'درجتك'}</span>${g.score == null ? html`<span class="badge">لم تُرصد بعد</span>` : html`<b>${g.score} / ${t.max_score}</b>`}</div>${g.note ? html`<p class="small muted">${g.note}</p>` : ''}`)}</div>`}</div>`)}</div>`);
}
function openTestModal() {
  if (!isStaff()) return;
  if (!S.groups.length) return toast('لا توجد أفواج مسندة إليك', true);
  openModal('إنشاء اختبار', html`<form class="form" data-form="test"><label class="field"><span>عنوان الاختبار</span><input name="title" maxlength="160" required placeholder="مثال: مراجعة سورة الملك"></label><div class="two"><label class="field"><span>المادة</span><select name="subject_id" required>${S.subjects.map(s => html`<option value="${s.id}">${s.name}</option>`)}</select></label><label class="field"><span>الفوج</span><select name="group_id" required>${S.groups.map(g => html`<option value="${g.id}">${g.name}</option>`)}</select></label></div><div class="two"><label class="field"><span>التاريخ</span><input type="date" name="date" value="${today()}" required></label><label class="field"><span>الدرجة القصوى</span><input type="number" name="max_score" value="100" min="1" max="1000" required></label></div><label class="field"><span>وصف الاختبار (اختياري)</span><textarea name="description" maxlength="500"></textarea></label><button class="btn" type="submit">إنشاء الاختبار</button></form>`);
}
let G = null;
async function drawGrading() {
  const d = await api(`/api/tests/${encodeURIComponent(S.grading)}/grades`);
  G = { test: d.test, rows: d.students.map(s => ({ ...s, score: s.score == null ? '' : String(s.score), note: s.note || '' })) };
  const t = G.test;
  render(html`<button class="back" data-act="back-tests">${ico('back')}<span>رجوع للاختبارات</span></button><div class="card"><div class="sec"><div><h3>${t.title}</h3><div class="muted">${t.subject_name || ''} · ${t.group_name || ''} · ${fmtDate(t.date)}</div></div><span class="badge">من ${t.max_score}</span></div>
    ${G.rows.length ? html`<div class="scroll"><table class="tbl"><thead><tr><th>الطالب</th><th>الدرجة</th><th>ملاحظة</th></tr></thead><tbody>${G.rows.map(r => html`<tr><td><div class="person"><span class="avatar">${initial(r.name)}</span><b>${r.name}</b></div></td><td><input class="score" type="number" inputmode="decimal" min="0" max="${t.max_score}" step="0.5" value="${r.score}" data-in="gradeScore" data-sid="${r.id}" aria-label="درجة ${r.name}"></td><td><input class="note-in" maxlength="300" value="${r.note}" placeholder="ملاحظة" data-in="gradeNote" data-sid="${r.id}" aria-label="ملاحظة ${r.name}"></td></tr>`)}</tbody></table></div>
    <div class="row wrap" style="margin-top:16px"><span class="muted" id="gradeCount"></span><button class="btn" data-act="grades-save">${ico('save')}<span>حفظ الدرجات</span></button></div>` : empty('لا يوجد طلاب في فوج هذا الاختبار')}</div>`);
  updateGradeCount();
}
function updateGradeCount() { const el = $('#gradeCount'); if (el && G) el.textContent = `أُدخلت ${G.rows.filter(r => r.score !== '').length} من ${G.rows.length}`; }
async function saveGrades(btn) {
  const max = G.test.max_score, bad = G.rows.find(r => r.score !== '' && !(Number(r.score) >= 0 && Number(r.score) <= max));
  if (bad) return toast(`درجة ${bad.name} يجب أن تكون بين 0 و ${max}`, true);
  if (!G.rows.some(r => r.score !== '')) return toast('أدخل درجة واحدة على الأقل', true);
  btn.disabled = true;
  try { const r = await post(`/api/tests/${encodeURIComponent(G.test.id)}/grades`, { grades: G.rows.map(x => ({ student_id: x.id, score: x.score, note: x.note })) }); toast(`تم حفظ ${r.saved} درجة`); }
  catch (e) { toast(e.message, true); } finally { btn.disabled = false; }
}

/* ═══════════ مكتبة الشيخ والمهام V22 ═══════════ */
async function pgMedia(){
  const list=await api('/api/media');
  const typeLabel={video:'مرئي',audio:'صوتي',file:'ملف',link:'رابط'};
  const symbol={video:'▶',audio:'♫',file:'▤',link:'↗'};
  render(html`<div class="stack">
    <div class="card hero hero-main"><div class="hero-copy"><span class="eyebrow">مكتبة الشيخ</span><h2>العلم يُسمع ويُقرأ ويُعاش</h2><p>دروس ومواعظ وتسجيلات نافعة في مكان واحد، لتعود إلى ما تحتاجه في وقتك وبالطريقة التي تناسبك.</p></div><div class="hero-orbit"><span>♫</span><i></i><i></i></div></div>
    <div class="media-filter"><button class="active" data-act="media-filter" data-type="all">الكل</button><button data-act="media-filter" data-type="audio">الصوتيات</button><button data-act="media-filter" data-type="video">المقاطع</button><button data-act="media-filter" data-type="file">الملفات</button></div>
    ${list.length?html`<div class="grid media-grid" id="mediaGrid">${list.map(m=>html`<article class="card media-card" data-media-type="${m.type}">
      <div class="media-cover"><span class="media-symbol">${symbol[m.type]||'•'}</span></div>
      <div class="media-head"><div class="row wrap"><div><span class="media-tag">${typeLabel[m.type]||'محتوى'}</span><h3 style="margin-top:7px">${m.title}</h3></div><span class="muted small">${fmtStamp(m.created_at)}</span></div></div>
      <div class="media-body"><p class="media-description">${m.description||'مادة نافعة من مكتبة الأكاديمية.'}</p>
      ${m.type==='audio'?html`<div class="audio-player"><button class="btn" data-act="play-media" data-id="${m.id}" data-title="${m.title}" data-src="${mediaSrc(m)}">${ico('play')} استماع</button><button class="btn sec2" data-act="bookmark-media" data-id="${m.id}">${m.bookmarked?'★ محفوظ':'☆ حفظ'}</button><div class="audio-tools"><span class="muted small">مشغل الأكاديمية يحفظ موضع الاستماع</span></div></div>`:''}
      ${m.type==='video'&&m.url?html`<video controls preload="metadata" style="width:100%;margin-top:13px;border-radius:16px;display:block" src="${m.url}"></video>`:''}
      <div class="media-meta"><span class="muted small">${m.author_name} · ${m.read?'شاهدته':'لم تشاهده بعد'}</span><div class="chips"><button class="btn sm sec2" data-act="like-media" data-id="${m.id}">${m.liked?'♥':'♡'} ${m.likes}</button><button class="btn sm sec2" data-act="media-comments" data-id="${m.id}">نقاش</button></div></div>
      ${m.file_path?html`<button class="btn sm" style="margin-top:10px;width:100%" data-act="open-media-file" data-id="${m.id}">${ico('doc')} فتح الملف</button>`:m.url&&m.type==='link'?html`<a class="btn sm" style="margin-top:10px;width:100%" href="${m.url}" target="_blank" rel="noopener">فتح المحتوى</a>`:''}
    </article>`)}</div>`:empty('لا توجد مواد منشورة بعد')}</div>`);
  document.querySelectorAll('[data-act="media-filter"]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-act="media-filter"]').forEach(x=>x.classList.remove('active'));b.classList.add('active');const t=b.dataset.type;document.querySelectorAll('[data-media-type]').forEach(x=>x.style.display=t==='all'||x.dataset.mediaType===t?'':'none');});
  document.querySelectorAll('audio[data-audio-id]').forEach(a=>{ const key='academy_audio_'+a.dataset.audioId; try{const saved=JSON.parse(localStorage.getItem(key)||'null'); if(saved?.time>0) a.currentTime=saved.time; if(saved?.rate) a.playbackRate=saved.rate;}catch{} a.addEventListener('timeupdate',()=>{try{localStorage.setItem(key,JSON.stringify({time:Math.floor(a.currentTime),rate:a.playbackRate}))}catch{}}); a.addEventListener('ratechange',()=>{try{localStorage.setItem(key,JSON.stringify({time:Math.floor(a.currentTime),rate:a.playbackRate}))}catch{}}); });
}
async function openMediaComments(id){ const comments=await api('/api/media/'+encodeURIComponent(id)+'/comments'); openModal('النقاش حول المحتوى',html`<div class="stack">${comments.length?comments.map(c=>html`<div class="item"><b>${c.author_name}</b><p>${c.body}</p><span class="muted small">${fmtStamp(c.created_at)}</span></div>`):empty('لا توجد تعليقات بعد')}<form data-form="media-comment" data-id="${id}" class="form"><textarea name="body" rows="3" maxlength="800" placeholder="اكتب تعليقك أو سؤالك للشيخ..." required></textarea><button class="btn">إرسال التعليق</button></form></div>`); }
function openMediaModal(){ if(!isStaff())return; openModal('نشر محتوى من الشيخ',html`<form class="form" data-form="media"><label class="field"><span>العنوان</span><input name="title" maxlength="160" required></label><label class="field"><span>الوصف</span><textarea name="description" maxlength="1500"></textarea></label><div class="two"><label class="field"><span>النوع</span><select name="type"><option value="video">مقطع فيديو</option><option value="audio">مقطع صوتي</option><option value="file">ملف</option><option value="link">رابط خارجي</option></select></label><label class="field"><span>الجمهور</span><select name="group_id"><option value="">كل الأكاديمية</option>${S.groups.map(g=>html`<option value="${g.id}">${g.name}</option>`)}</select></label></div><label class="field"><span>رابط المحتوى (اختياري)</span><input name="url" type="url" placeholder="رابط فيديو/صوت أو ملف"></label><label class="field"><span>أو اختر ملفًا محليًا (حتى نحو 7MB)</span><input name="file" type="file" accept="video/*,audio/*,.pdf,.doc,.docx,.ppt,.pptx,.txt,.png,.jpg,.jpeg,.webp"></label><button class="btn" type="submit">نشر الآن</button></form>`); }
async function submitMedia(f){ const v=fd(f), file=f.querySelector('[name=file]').files[0]; let data={title:v.title,description:v.description,type:v.type,group_id:v.group_id,url:v.url}; if(file){ if(file.size>7*1024*1024) throw new Error('الملف أكبر من الحد المحلي 7MB'); data.file_name=file.name;data.mime=file.type;data.file_data=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(file);}); } await post('/api/media',data); closeOverlay();toast('تم نشر المحتوى');showPage('media'); }
async function pgTasks(){ const t=await api('/api/student-tasks'); render(html`<div class="card"><div class="sec"><div><h3>مهامي</h3><p class="muted">مهام شخصية واضحة، بموعد وحالة إنجاز.</p></div></div>${t.length?t.map(x=>html`<div class="item"><div class="row wrap"><div><b>${x.title}</b><p class="muted">${x.description||''}</p></div><span class="badge ${x.status==='done'?'ok':''}">${x.status==='done'?'منجزة':'مطلوبة'}</span></div><div class="row small muted"><span>${x.due_date?'موعد: '+fmtDate(x.due_date):'بدون موعد'}</span>${S.user.role==='student'&&x.status!=='done'?html`<button class="btn sm" data-act="task-done" data-id="${x.id}">تم الإنجاز</button>`:''}</div></div>`):empty('لا توجد مهام خاصة بك بعد')}</div>`); }
/* ═══════════ لوحة المعلم / الإشعارات / المستقبل ═══════════ */
async function pgTeacherTools() {
  const notes = await api('/api/teacher-notes');
  render(html`<div class="stack"><div class="grid g3">
    <div class="card" role="button" tabindex="0" data-act="nav" data-page="attendance"><span class="avatar">${ico('check')}</span><h3 style="margin-top:12px">تسجيل الحضور</h3><p class="muted">اختر الفوج والتاريخ، وسجّل الجميع مرة واحدة.</p></div>
    <div class="card" role="button" tabindex="0" data-act="new-test"><span class="avatar">${ico('plus')}</span><h3 style="margin-top:12px">إنشاء اختبار</h3><p class="muted">حدّد المادة والفوج والتاريخ والدرجة القصوى.</p></div>
    <div class="card" role="button" tabindex="0" data-act="nav" data-page="tests"><span class="avatar">${ico('doc')}</span><h3 style="margin-top:12px">إدخال الدرجات</h3><p class="muted">جدول بالطلاب مع الدرجة والملاحظة.</p></div></div>
  <div class="card"><div class="sec"><h3>ملاحظة سريعة</h3></div>${S.students.length ? html`<form class="form" data-form="quicknote"><div class="two"><label class="field"><span>الطالب</span><select name="student_id">${S.students.map(s => html`<option value="${s.id}">${s.name}</option>`)}</select></label><label class="field"><span>التصنيف</span><select name="category">${CATS.map(c => html`<option>${c}</option>`)}</select></label></div><label class="field"><span>الملاحظة</span><textarea name="text" maxlength="1000" required></textarea></label><label class="check"><input type="checkbox" name="shared"><span>مشاركة مع الطالب وولي الأمر</span></label><div><button class="btn" type="submit">حفظ الملاحظة</button></div></form>` : empty('لا يوجد طلاب في نطاقك')}</div>
  <div class="card"><div class="sec"><h3>آخر الملاحظات</h3></div>${notes.length ? notes.slice(0, 8).map(n => html`<div class="item"><div class="row"><b>${n.student_name}</b><span class="badge">${n.category}</span></div><p>${n.text}</p><div class="muted small" style="margin-top:4px">${fmtDate(n.date)}</div></div>`) : empty('لا توجد ملاحظات بعد')}</div></div>`);
}
async function pgQuran() {
  const [data, submissions] = await Promise.all([api('/api/quran'), api('/api/quran/submissions').catch(()=>[])]); S.quran=data;
  let halaqas=[]; try { halaqas=await api('/api/quran/halaqas'); } catch {};
  const students = data.students || [];
  const my = students[0];
  const canEdit = !!data.can_edit;
  const cards = students.map(x => {
    const st=x.student, q=x; return html`<button class="qstudent" data-act="quran-student" data-id="${st.id}"><div class="avatar">${initial(st.name)}</div><div><b>${st.name}</b><div class="muted small">${st.level || 'مسار قرآني'}</div></div><div class="qmini"><span>إتقان ${q.mastery == null ? '—' : q.mastery+'%'}</span><span>${q.due_reviews ? q.due_reviews+' مراجعة مستحقة' : 'لا مراجعات مستحقة'}</span></div></button>`;
  });
  const detail = my ? quranDetailHtml(my, canEdit) : empty('لا يوجد طلاب في نطاقك');
  const myStudentId=(S.students.find(x=>x.user_id===S.user.id)||S.students[0]||{}).id;
  const visibleSubs=isStaff()?submissions.slice(0,12):submissions.filter(x=>x.student_id===myStudentId).slice(0,8);
  const submissionCard=html`<div class="card q-submissions"><div class="sec"><div><h3>التسميع المرسل</h3><p class="muted">تسجيلات الطالب تصل إلى الشيخ للمراجعة، ثم تعود بملاحظة واضحة وحالة مفهومة.</p></div>${S.user.role==='student'?html`<button class="btn" data-act="quran-submit">${ico('mic')} إرسال تسميع</button>`:''}</div>${visibleSubs.length?visibleSubs.map(x=>html`<div class="item"><div class="row wrap"><div><b>${x.student_name||'تسميع'}</b><p class="muted small">${x.surah} · ${x.from_ayah}–${x.to_ayah} · ${fmtStamp(x.submitted_at)}</p></div><span class="badge ${x.status==='reviewed'?'ok':x.status==='needs_repeat'?'gold':''}">${x.status==='reviewed'?'تمت المراجعة':x.status==='needs_repeat'?'يحتاج إعادة':'بانتظار الشيخ'}</span></div>${x.teacher_note?html`<p>${x.teacher_note}</p>`:''}${x.score!=null?html`<span class="chip">${x.score}/100</span>`:''}${x.file_path||x.url?html`<div class="audio-line"><audio controls preload="metadata" src="${x.url||('/api/quran/submissions/'+encodeURIComponent(x.id)+'/file')}"></audio>${isStaff()&&x.status==='pending'?html`<button class="btn sm" data-act="quran-submission-review" data-id="${x.id}">مراجعة</button>`:''}</div>`:''}</div>`):empty('لا توجد تسجيلات مرسلة بعد') }</div>`;
  render(html`<div class="qhero"><div><span class="eyebrow">المدرسة القرآنية V26</span><h2>حفظٌ متقن، مراجعةٌ ثابتة، وحلقةٌ تُتابع بالأرقام</h2><p>الحلقة والحضور والتقدم والتقارير والشهادات أصبحت مرتبطة بالخادم ونطاق الصلاحية.</p></div><div class="qseal">ق<br><small>قرآن</small></div></div><div class="grid g3 qstats"><div class="card stat"><span>الطلاب في نطاقك</span><b>${students.length}</b></div><div class="card stat"><span>مراجعات مستحقة</span><b>${students.reduce((n,x)=>n+x.due_reviews,0)}</b></div><div class="card stat"><span>متوسط الإتقان</span><b>${students.length ? Math.round(students.filter(x=>x.mastery!=null).reduce((n,x)=>n+x.mastery,0)/Math.max(1,students.filter(x=>x.mastery!=null).length))+'%' : '—'}</b></div></div><div class="card" style="margin-bottom:16px"><div class="sec"><div><h3>أدوات المدرسة القرآنية</h3><p class="muted">الحضور والتقدم والتنبيهات والتقرير الدوري.</p></div><div class="row wrap">${canEdit&&halaqas.length?html`<button class="btn" data-act="quran-attendance">${ico('check')} حضور الحلقة</button>`:''}<button class="btn sec2" data-act="quran-report">تقرير الفترة</button></div></div></div><div class="grid qlayout"><div class="card"><div class="sec"><div><h3>حلقات القرآن</h3><p class="muted">${halaqas.length?`${halaqas.length} حلقة مسجلة`:'لا توجد حلقات مسجلة'}</p></div>${canEdit?html`<button class="btn" data-act="quran-session">${ico('plus')}تسجيل تسميع</button>`:''}</div>${halaqas.length?halaqas.map(h=>html`<div class="item"><div class="row wrap"><b>${h.name}</b><span class="badge">${h.level||'تمهيدي'}</span></div><p class="muted">${h.group_name} · ${h.teacher_name}</p><p>${h.days||'الأيام غير محددة'} ${h.start_time?'· '+h.start_time:''}${h.end_time?' — '+h.end_time:''}</p></div>`):''}<div class="qstudents">${cards.length?cards:empty('لا توجد بيانات')}</div></div><div class="card">${detail}</div></div>${submissionCard}</div>`);
}
async function openQuranAttendance(){
  const hs=await api('/api/quran/halaqas'); if(!hs.length) return toast('لا توجد حلقات في نطاقك',true);
  const h=hs[0], date=today(), sheet=await api('/api/quran/attendance/sheet?halaqa_id='+encodeURIComponent(h.id)+'&date='+date);
  openModal('حضور الحلقة',html`<form data-form="quran-attendance" data-halaqa="${h.id}" data-date="${date}" class="stack"><p class="muted">${h.name} · ${fmtDate(date)}</p><div class="scroll"><table class="tbl"><thead><tr><th>الطالب</th><th>الحالة</th><th>ملاحظة</th></tr></thead><tbody>${sheet.students.map(st=>html`<tr><td><b>${st.name}</b></td><td><select name="status_${st.id}"><option value="present" ${st.status==='present'?'selected':''}>حاضر</option><option value="late" ${st.status==='late'?'selected':''}>متأخر</option><option value="absent" ${st.status==='absent'?'selected':''}>غائب</option><option value="excused" ${st.status==='excused'?'selected':''}>بعذر</option></select></td><td><input name="note_${st.id}" value="${st.note||''}" maxlength="300"></td></tr>`)}</tbody></table></div><button class="btn">حفظ الحضور</button></form>`);
}
async function openQuranReport(){ const r=await api('/api/quran/reports?date='+today()+'&period=month'); openModal('التقرير القرآني',html`<div class="stack"><p class="muted">الفترة: ${fmtDate(r.period.start)} — ${fmtDate(r.period.end)}</p>${r.students.map(x=>html`<div class="item"><div class="row"><b>${x.student.name}</b><span class="badge">${x.progress.average_evaluation==null?'—':x.progress.average_evaluation+'%'} تقويم</span></div><p>جلسات: ${x.progress.sessions} · مراجعات: ${x.progress.reviews_done}/${x.progress.reviews} · حضور الحلقة: ${x.progress.attendance_rate==null?'—':x.progress.attendance_rate+'%'}</p><p>خطط الحفظ: ${x.progress.plans_completed}/${x.progress.plans}</p></div>`)}</div>`); }

function quranDetailHtml(x, canEdit){
  const s=x.student, last=x.sessions?.[0], ev=x.evaluations?.[0];
  return html`<div class="sec"><div><span class="eyebrow">ملف قرآني</span><h3>${s.name}</h3></div>${canEdit?html`<div class="row wrap"><button class="btn sec2" data-act="quran-plan" data-id="${s.id}">خطة حفظ</button><button class="btn sec2" data-act="quran-review" data-id="${s.id}">مراجعة</button><button class="btn" data-act="quran-eval" data-id="${s.id}">تقويم</button></div>`:''}</div><div class="qring"><div class="ring"><b>${x.mastery==null?'—':x.mastery+'%'}</b><small>إتقان المحفوظ</small></div><div><p><b>${x.total_sessions}</b> جلسة مسجلة</p><p><b>${x.due_reviews}</b> مراجعة مستحقة</p><p>آخر تقويم: <b>${ev?fmtDate(ev.date):'—'}</b></p></div></div><div class="qmetrics"><div><span>القراءة</span><b>${ev?ev.reading+'/5':'—'}</b></div><div><span>التجويد</span><b>${ev?ev.tajweed+'/5':'—'}</b></div><div><span>الحفظ</span><b>${ev?ev.memorization+'/5':'—'}</b></div><div><span>الآداب</span><b>${ev?ev.adab+'/5':'—'}</b></div></div><div class="sec"><h4>آخر التسميع والمراجعة</h4></div>${last?html`<div class="qsession"><b>${last.type} — ${last.surah}</b><span>${last.from_ayah}–${last.to_ayah} • ${fmtDate(last.date)}</span><small>التجويد ${last.tajweed}/5 • الطلاقة ${last.fluency}/5 • التقييم ${last.rating}/5</small><p>${last.notes||'لا توجد ملاحظة.'}</p></div>`:empty('لم تسجل جلسات بعد')}`;
}
async function openQuranStudent(id){ const d=await api('/api/quran/student?student_id='+encodeURIComponent(id)); const modal=html`<div class="modal" data-act="close-modal-bg"><div class="modalbox"><button class="x" data-act="close-modal">×</button>${quranDetailHtml(d,isStaff())}</div></div>`; put($('#overlay'),modal); $('#overlay').classList.add('show'); }
function openQuranSession(){
 const opts=(S.students||[]).map(s=>`<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('');
 const m=html`<div class="modal" data-act="close-modal-bg"><div class="modalbox"><button class="x" data-act="close-modal">×</button><h3>تسجيل تسميع / مراجعة</h3><form data-form="quran-session" class="formgrid"><label class="field"><span>الطالب</span><select name="student_id">${raw(opts)}</select></label><label class="field"><span>النوع</span><select name="type"><option>تسميع</option><option>مراجعة</option><option>قراءة</option><option>اختبار حفظ</option></select></label><label class="field"><span>السورة</span><input name="surah" required placeholder="مثال: الملك"></label><label class="field"><span>من آية</span><input name="from_ayah" type="number" min="1" required></label><label class="field"><span>إلى آية</span><input name="to_ayah" type="number" min="1" required></label><label class="field"><span>التاريخ</span><input name="date" type="date" value="${today()}"></label><label class="field"><span>التقييم العام</span><select name="rating"><option>5</option><option selected>4</option><option>3</option><option>2</option><option>1</option></select></label><label class="field"><span>التجويد</span><select name="tajweed"><option>5</option><option selected>4</option><option>3</option><option>2</option><option>1</option></select></label><label class="field"><span>الطلاقة</span><select name="fluency"><option>5</option><option selected>4</option><option>3</option><option>2</option><option>1</option></select></label><label class="field full"><span>ملاحظة المعلم</span><textarea name="notes" rows="3" placeholder="موضع يحتاج تثبيتًا، تنبيه تجويد، أو توجيه تربوي..."></textarea></label><button class="btn full" type="submit">حفظ جلسة القرآن</button></form></div></div>`;
 put($('#overlay'),m); $('#overlay').classList.add('show');
}
function openQuranEval(id){
 const m=html`<div class="modal" data-act="close-modal-bg"><div class="modalbox"><button class="x" data-act="close-modal">×</button><h3>تقويم قرآني شامل</h3><form data-form="quran-eval" class="formgrid"><input type="hidden" name="student_id" value="${id}"><label class="field"><span>القراءة</span><select name="reading"><option>5</option><option selected>4</option><option>3</option><option>2</option><option>1</option></select></label><label class="field"><span>التجويد</span><select name="tajweed"><option>5</option><option selected>4</option><option>3</option><option>2</option><option>1</option></select></label><label class="field"><span>الحفظ</span><select name="memorization"><option>5</option><option selected>4</option><option>3</option><option>2</option><option>1</option></select></label><label class="field"><span>الآداب</span><select name="adab"><option>5</option><option selected>4</option><option>3</option><option>2</option><option>1</option></select></label><label class="field full"><span>الملاحظة</span><textarea name="notes" rows="3"></textarea></label><button class="btn full">حفظ التقويم</button></form></div></div>`;
 put($('#overlay'),m); $('#overlay').classList.add('show');
}


function openQuranPlan(id){ openModal('خطة حفظ جديدة',html`<form data-form="quran-plan" data-id="${id}" class="formgrid"><input name="surah" required placeholder="السورة"><input name="from_ayah" type="number" min="1" value="1" required><input name="to_ayah" type="number" min="1" value="5" required><input name="target_date" type="date" value="${today()}" required><input name="pages" type="number" min="1" max="50" value="1"><textarea name="notes" maxlength="800" placeholder="ملاحظات الشيخ"></textarea><button class="btn">حفظ الخطة</button></form>`); }
function openQuranReview(id){ openModal('موعد مراجعة',html`<form data-form="quran-review" data-id="${id}" class="formgrid"><input name="surah" required placeholder="السورة"><input name="from_ayah" type="number" min="1" value="1" required><input name="to_ayah" type="number" min="1" value="5" required><input name="due_date" type="date" value="${today()}" required><textarea name="notes" maxlength="800" placeholder="ما يحتاج إلى تثبيت"></textarea><button class="btn">حفظ المراجعة</button></form>`); }
async function pgAssignments(){
  const list=await api('/api/assignments');
  render(html`<div class="stack"><div class="card hero"><div class="hero-copy"><span class="eyebrow">التعلّم والمتابعة</span><h2>الواجبات</h2><p>تكليفات واضحة، تسليم منظم، وتصحيح محفوظ في سجل الطالب.</p></div></div><div class="card"><div class="sec"><div><h3>قائمة الواجبات</h3><p class="muted">${list.length} واجب في نطاقك</p></div>${isStaff()?html`<button class="btn" data-act="new-assignment">${ico('plus')} واجب جديد</button>`:''}</div>${list.length?html`<div class="stack">${list.map(a=>html`<div class="item"><div class="row"><div><b>${a.title}</b><p class="muted">${a.subject_name||'عام'} · ${a.group_name}</p></div><span class="badge ${a.submission?.status==='graded'?'ok':a.submission?.status==='late'?'gold':''}">${a.submission?.status==='graded'?'مصحح':a.submission?.status==='late'?'مسلّم متأخر':a.submission?.status==='submitted'?'مسلّم':'مفتوح'}</span></div><p>${a.description||'لا يوجد وصف.'}</p><div class="row wrap"><span class="muted">آخر أجل: ${fmtDate(a.due_date)}</span>${!isStaff()&&!a.submission?html`<button class="btn sm sec2" data-act="submit-assignment" data-id="${a.id}">تسليم</button>`:isStaff()?html`<button class="btn sm sec2" data-act="grade-assignment" data-id="${a.id}">التسليمات والتصحيح</button>`:''}</div></div>`)}</div>`:empty('لا توجد واجبات بعد')}</div></div>`);
}
async function openAssignmentGrade(id){ const a=await api('/api/assignments/'+encodeURIComponent(id)); openModal('تسليمات الواجب',html`<div class="stack">${a.submissions?.length?a.submissions.map(s=>html`<div class="item"><div class="row wrap"><div><b>${s.student_name}</b><p class="muted">${s.status==='late'?'تسليم متأخر':'تسليم'} · ${fmtStamp(s.submitted_at)}</p></div><span class="badge">${s.grade==null?'لم يُصحح':s.grade+' / '+a.max_score}</span></div><p style="white-space:pre-wrap">${s.answer||'بدون إجابة'}</p><form data-form="assignment-grade" data-id="${id}" data-student="${s.student_id}" class="formgrid"><input name="grade" type="number" min="0" max="${a.max_score}" value="${s.grade??''}" placeholder="الدرجة" required><input name="note" maxlength="800" value="${s.note||''}" placeholder="ملاحظة التصحيح"><button class="btn">حفظ التصحيح</button></form></div>`):empty('لا توجد تسليمات بعد')}</div>`); }
async function openAssignmentModal(){
  if(!isStaff()) return; const groups=S.groups||[], subjects=S.subjects||[];
  openModal('إنشاء واجب',html`<form data-form="assignment" class="formgrid"><label class="field"><span>العنوان</span><input name="title" required maxlength="160"></label><label class="field"><span>الفوج</span><select name="group_id">${groups.map(g=>html`<option value="${g.id}">${g.name}</option>`)}</select></label><label class="field"><span>المادة</span><select name="subject_id"><option value="">عام</option>${subjects.map(x=>html`<option value="${x.id}">${x.name}</option>`)}</select></label><label class="field"><span>آخر أجل</span><input name="due_date" type="date" required value="${today()}"></label><label class="field"><span>الدرجة</span><input name="max_score" type="number" min="1" max="1000" value="10"></label><label class="field full"><span>الوصف</span><textarea name="description" maxlength="4000" rows="4"></textarea></label><button class="btn full">نشر الواجب</button></form>`);
}
async function openSubmitAssignment(id){ openModal('تسليم الواجب',html`<form data-form="assignment-submit" data-id="${id}" class="stack"><p class="muted">اكتب إجابتك أو ملاحظتك هنا. يمكن تعديل التسليم قبل الإغلاق.</p><textarea name="answer" rows="8" maxlength="6000" required placeholder="إجابتك..."></textarea><button class="btn">تسليم</button></form>`); }
async function pgCalendar(){ const list=await api('/api/calendar'); render(html`<div class="card"><div class="sec"><div><h3>التقويم الدراسي</h3><p class="muted">مواعيد الأكاديمية في مكان واحد.</p></div>${isStaff()?html`<button class="btn" data-act="new-calendar">${ico('plus')} إضافة موعد</button>`:''}</div>${list.length?list.map(e=>html`<div class="item"><div class="row"><b>${e.title}</b><span class="badge">${e.type||'نشاط'}</span></div><p>${fmtDate(e.date)} ${e.start_time?'· '+e.start_time:''}${e.end_time?' — '+e.end_time:''} · ${e.group_name}</p><p class="muted">${e.location||''}</p></div>`):empty('لا توجد مواعيد مسجلة')}</div>`); }
async function openCalendarModal(){ openModal('إضافة موعد',html`<form data-form="calendar" class="formgrid"><label class="field"><span>العنوان</span><input name="title" required maxlength="160"></label><label class="field"><span>التاريخ</span><input name="date" type="date" required value="${today()}"></label><label class="field"><span>البداية</span><input name="start_time" type="time"></label><label class="field"><span>النهاية</span><input name="end_time" type="time"></label><label class="field"><span>النوع</span><select name="type"><option>حصة</option><option>اختبار</option><option>نشاط</option><option>اجتماع</option><option>حلقة قرآن</option></select></label><label class="field"><span>الفوج</span><select name="group_id"><option value="">كل الأكاديمية</option>${S.groups.map(g=>html`<option value="${g.id}">${g.name}</option>`)}</select></label><label class="field full"><span>المكان</span><input name="location" maxlength="120"></label><label class="field full"><span>ملاحظات</span><textarea name="description" rows="3" maxlength="800"></textarea></label><button class="btn full">حفظ الموعد</button></form>`); }
async function pgMessages(){ const list=await api('/api/messages'); const unread=list.filter(x=>x.recipient_id===S.user.id&&!x.read_at).length; render(html`<div class="card"><div class="sec"><div><h3>المراسلات الداخلية</h3><p class="muted">تواصل مباشر محفوظ داخل الأكاديمية · ${unread} غير مقروءة</p></div><button class="btn" data-act="new-message">${ico('plus')} رسالة جديدة</button></div>${list.length?list.map(m=>html`<div class="item"><div class="row"><b>${m.sender_id===S.user.id?'إلى: '+m.recipient_name:'من: '+m.sender_name}</b><span class="badge ${m.read_at?'':'gold'}">${m.read_at?'مقروءة':'جديدة'}</span></div><p>${m.body}</p><div class="muted small">${fmtStamp(m.created_at)}</div>${m.recipient_id===S.user.id&&!m.read_at?html`<button class="btn sec2 sm" data-act="read-message" data-id="${m.id}">تحديد كمقروءة</button>`:''}</div>`) : empty('لا توجد رسائل')}</div>`); }
async function openMessageModal(preselectedId=''){ const users=await api('/api/contacts').catch(()=>[]); const targets=users.filter(u=>u.id!==S.user.id&&u.active); openModal('رسالة جديدة',html`<form data-form="message" class="stack"><label class="field"><span>إلى</span><select name="recipient_id" required>${targets.map(u=>html`<option value="${u.id}"${u.id===preselectedId?' selected':''}>${u.name} — ${ROLE[u.role]||u.role}</option>`)}</select></label><label class="field"><span>الرسالة</span><textarea name="body" rows="7" maxlength="3000" required></textarea></label><button class="btn">إرسال</button></form>`); }

function pgNotifications() {
  render(html`<div class="card"><div class="sec"><h3>مركز الإشعارات</h3><button class="btn sec2 sm" data-act="read-all">تحديد الكل كمقروء</button></div>${S.notifications.length ? S.notifications.map(n => html`<div class="item"><div class="row"><b>${n.title}</b><span class="badge ${n.read ? '' : 'gold'}">${n.read ? 'مقروء' : 'جديد'}</span></div><p>${n.body}</p></div>`) : empty('لا توجد إشعارات')}</div>`);
}
async function pgSchoolDirectory(){
  const people=await api('/api/school-directory');
  render(html`<div class="stack">
    <div class="card hero hero-main"><div class="hero-copy"><span class="eyebrow">هيكلة المدرسة</span><h2>لكل فرد مكانه ومهمته</h2><p>قائمة موحّدة لأهل المدرسة، مرتبة حسب المسؤولية، مع إمكانية مراسلة كل شخص مباشرة.</p></div><div class="hero-orbit"><span>هـ</span><i></i><i></i></div></div>
    <div class="card"><div class="sec"><div><h3>أهل المدرسة</h3><p class="muted small">المدير، الشيوخ، المشرف الرئيسي، مشرفو الفرق، ثم الطلبة.</p></div><span class="badge">${people.length} شخصًا</span></div>
      ${people.length?people.map((p,i)=>html`<div class="item"><div class="row wrap"><div class="row" style="gap:12px"><span class="avatar">${i+1}</span><div><b>${p.name}</b><p class="muted small">${p.role_label}</p></div></div><button class="btn sm sec2" data-act="message-user" data-id="${p.id}" ${p.id===S.user.id?'disabled':''}>${ico('mail')} مراسلة</button></div></div>`):empty('لا توجد حسابات نشطة بعد')}</div>
    <div class="card flat"><p class="muted small">تُعرض الرتب وفق الحسابات والأدوار المسجلة. تأكد أن أسماء الحسابات مكتوبة كما تريد ظهورها في الهيكلة.</p></div>
  </div>`);
}
function pgAcademyMap(){
  const roles=[
    ['المدير العام','إدارة المنصة والمدارس والمديرين والحسابات والإعدادات والأمان والنسخ الاحتياطية.'],
    ['مدير المدرسة','إدارة مدرسته فقط: المعلمون والأفواج والطلبة والبرامج والتقارير داخل مدرسته.'],
    ['المعلم','إدارة الأفواج والطلبة المسندين إليه، والحضور والدروس والاختبارات والمتابعة التعليمية.'],
    ['مشرف الفريق من الطلبة','متابعة مهام فريقه وأعضائه فقط، ورفع الملاحظات والطلبات؛ لا يرى ملفات بقية المدرسة ولا يدير المعلمين أو الحسابات العامة.'],
    ['الطالب','مساره ومهامه ودروسه واختباراته وتقدمه وفريقه، دون بيانات الطلاب الآخرين الخاصة.']
  ];
  render(html`<div class="stack">
    <div class="card hero hero-main"><div class="hero-copy"><span class="eyebrow">خريطة مرئية للجميع</span><h2>كل فرد يعرف طريقه وحدود مسؤوليته</h2><p>خريطة تعريفية عامة لا تعرض ملفات الطلاب أو البيانات الخاصة. الصلاحيات الفعلية تُفرض من الخادم، لا من إخفاء الأزرار فقط.</p></div><div class="hero-orbit"><span>هـ</span><i></i><i></i></div></div>
    <div class="card academy-map-card"><div class="row wrap"><div><span class="eyebrow">الخريطة البصرية</span><h3>عالم أكاديمية الإحسان</h3><p class="muted small">يمكن للجميع رؤية التصور العام للمنصة.</p></div><span class="badge">خريطة عامة</span></div><div class="academy-map-frame"><img src="/assets/academy-world-map.png" alt="الخريطة البصرية لأكاديمية الإحسان في بناء الإنسان" loading="lazy"></div></div>
    <div class="card"><h3>سُلّم الصلاحيات</h3><div class="permission-flow"><span>المدير العام</span><i>←</i><span>مدير المدرسة</span><i>←</i><span>المعلم</span><i>←</i><span>مشرف الفريق</span><i>←</i><span>الطالب</span></div><p class="muted small">كل مستوى يرى ما يحتاجه فقط، ولا يرث صلاحيات المستوى الأعلى.</p></div>
    <div class="grid g2">${roles.map((r,i)=>html`<article class="card permission-card"><div class="row wrap"><span class="badge">${String(i+1).padStart(2,'0')}</span><h3>${r[0]}</h3></div><p>${r[1]}</p></article>`)}</div>
    <div class="card flat"><b>قاعدة الخصوصية</b><p>مشرف الفريق لا يطّلع على ملفات بقية المدرسة ولا يملك صلاحيات المعلم أو المدير. وإذا احتاج أمرًا خارج نطاقه، يرفعه إلى المعلم أو مدير المدرسة.</p></div>
  </div>`);
}
function pgLearningHub(){
  const domains=[
    ['معرفة الله تعالى','أسماء الله وصفاته من الوحي الصحيح، ومعانٍ تقود إلى العبادة والعمل.','✧','curriculum'],
    ['معرفة الرسول ﷺ','السيرة والهدي والشمائل، مع تطبيق خُلُق نبوي في الحياة.','ﷺ','curriculum'],
    ['القرآن الكريم','حفظ وفهم وتجويد ومراجعة، ومسارات تناسب مستوى الطالب.','۞','quran'],
    ['الحديث النبوي','الأربعون النووية: حفظ الحديث وفهمه ومعرفة مصدره والعمل به.','٤٠','curriculum'],
    ['باقي العلوم والفوائد','آداب طلب العلم، اللغة، المتون، مهارات الحياة، وفوائد قصيرة موثقة.','✦','curriculum']
  ];
  render(html`<div class="stack">
    <div class="card hero hero-main"><div class="hero-copy"><span class="eyebrow">برنامج التعلّم الممتع</span><h2>خمس بوابات، وخطوة واضحة في كل مرة</h2><p>اختر مجالًا واحدًا، تعلّم شيئًا قصيرًا، أجب عن سؤال، ثم طبّق فائدة واحدة. لا نقاط تُشعرك بالفشل ولا قلوب عقابية.</p></div><div class="hero-orbit"><span>ع</span><i></i><i></i></div></div>
    <div class="grid g2">${domains.map((d,i)=>html`<article class="card learning-domain"><span class="learning-domain-symbol">${d[2]}</span><span class="eyebrow">المجال ${['الأول','الثاني','الثالث','الرابع','الخامس'][i]}</span><h3>${d[0]}</h3><p class="muted">${d[1]}</p><button class="btn sm" data-act="nav" data-page="${d[3]}">ادخل المجال <span aria-hidden="true">←</span></button></article>`)}</div>
    <div class="card"><div class="sec"><div><h3>طريقة التعلّم</h3><p class="muted small">درس قصير ← سؤال تفاعلي ← تطبيق عملي ← مراجعة لاحقة</p></div></div><div class="learning-steps"><span>تعلّم</span><i>←</i><span>جرّب</span><i>←</i><span>طبّق</span><i>←</i><span>راجع</span></div></div>
  </div>`);
}
async function pgHierarchy(){
  if(S.user.role!=='admin') return showPage('dashboard');
  const h=await api('/api/admin/platform-hierarchy');
  render(html`<div class="stack">
    <div class="card hero hero-main"><div class="hero-copy"><span class="eyebrow">خريطة المنصة</span><h2>من الأكاديمية إلى الطالب</h2><p>المدير العام يشرف على المدارس، ولكل مدرسة مدير ومعلمون وأفواج، وداخل مدرسة مسجد الرحمان توجد فرق صغيرة يشرف عليها كبار الطلبة دون أن تصبح لهم صلاحيات المعلمين.</p></div><div class="hero-orbit"><span>ه</span><i></i><i></i></div></div>
    <div class="card academy-map-card"><div class="row wrap"><div><span class="eyebrow">الخريطة البصرية</span><h3>عالم أكاديمية الإحسان</h3><p class="muted small">هذه الخريطة تلخص البناء الذي نعتمده. العناصر التي لم تُفعّل بعد تبقى رؤية مستقبلية وليست وظيفة متاحة حاليًا.</p></div><span class="badge">خريطة مرجعية</span></div><div class="academy-map-frame"><img src="/assets/academy-world-map.png" alt="الخريطة البصرية لأكاديمية الإحسان في بناء الإنسان" loading="lazy"></div></div>
    <div class="card"><div class="row wrap"><div><span class="eyebrow">المستوى الأعلى</span><h3>${h.platform.name}</h3></div><span class="badge ok">${h.platform.role}</span></div><p class="muted small">صلاحيات هذا المستوى: إدارة المدارس، المديرين، الشيوخ، الأفواج، النظام، البيانات، الأمان والنسخ الاحتياطية.</p></div>
    ${h.schools.map(sc=>html`<div class="card"><div class="row wrap"><div><span class="eyebrow">مدرسة</span><h3>${sc.name}</h3><p class="muted">${sc.description||''}</p></div><span class="badge">${sc.director?.name||'مدير المدرسة: يُعيَّن من المدير العام'}</span></div><div class="grid g2" style="margin-top:12px">${sc.groups.map(g=>html`<div class="card flat"><div class="row wrap"><div><b>${g.name}</b><p class="muted small">${g.student_count} طالبًا</p></div><span class="badge">${g.teachers.length} معلم</span></div><p class="small muted">المعلمون: ${g.teachers.map(t=>t.name).join('، ')||'لم يُسند بعد'}</p>${g.teams.length?html`<div class="chips">${g.teams.map(t=>html`<span class="chip">${t.name} · مشرفون: ${t.supervisors.join('، ')||'—'}</span>`)}</div>`:html`<p class="small muted">لا توجد فرق صغيرة بعد.</p>`}</div>`)}</div></div>`)}
    <div class="card"><h3>القاعدة الذهبية للصلاحيات</h3><p>كل مستوى يرى ما يحتاجه فقط: المدير العام ← مدير المدرسة ← المعلم ← مشرف الفريق ← الطالب. مشرف الفريق لا يطّلع على ملفات بقية المدرسة ولا يملك صلاحيات المعلم أو المدير.</p></div>
  </div>`);
}
function pgFuture() {
  const items = [
    ['منظومة المشرفين الطلابيين', 'حسابات لكبار الطلبة مرتبطة بفريقهم، لمتابعة المهام والتنظيم والتحفيز دون صلاحيات المعلم أو المدير.', false],
    ['الاختبارات التلقائية', 'الطالب يدخل الاختبار من هاتفه أو حاسوبه، يجيب، ثم يصحح النظام الأسئلة القابلة للتصحيح آليًا ويجمع النتيجة والتغذية الراجعة.', false],
    ['الحضور بالبصمة', 'ربط المدرسة لاحقًا بجهاز بصمة فعلي لتسجيل الدخول والحضور الواقعي ثم مزامنة السجلات مع الأكاديمية.', false],
    ['إدارة المدارس', 'مدير عام فوق المنصة، ثم مدارس مستقلة بمديرين ومعلمين وأفواج وطلاب، مع عزل الصلاحيات والبيانات بحسب المدرسة.', false],
    ['تقارير أذكى للشيخ', 'التقرير الأسبوعي يولّد التعليق الأولي والنصيحة وحالات المتابعة، حتى يراجع الشيخ ما يحتاجه بدل كتابة كل شيء يدويًا.', true],
    ['مدرسة مسجد الرحمان القرآنية', 'الاسم معتمد داخل النموذج الحالي، وفوجاها المبدئيان: صحبة القرآن والفوج الأول، ثم تقسيمهما لاحقًا إلى فرق.', true]
  ];
  render(html`<div class="grid g3">${items.map(x => html`<div class="card"><div class="row"><b style="font:700 20px var(--font-head)">${x[0]}</b>${x[2] ? html`<span class="badge ok">موجود الآن</span>` : html`<span class="badge gold">لاحقًا</span>`}</div><p class="muted" style="margin-top:8px">${x[1]}</p></div>`)}</div>`);
}

/* ═══════════ الأحداث (تفويض واحد) ═══════════ */
window.addEventListener('popstate', e => {
  if (!S.user) return;
  const state = e.state;
  const page = state && state.academy && PAGES[state.page] ? state.page : 'dashboard';
  // When the user reaches the app's root history entry, add a guard entry
  // so browser Back returns to the academy instead of leaving it unexpectedly.
  if (!state || !state.academy || state.root) {
    try { history.pushState({ academy: true, page, guard: true }, '', location.pathname + '#' + encodeURIComponent(page)); } catch { /* */ }
  }
  showPage(page, { history: false });
});
const ACT = {
  nav: el => showPage(el.dataset.page, { history: true }),
  'teacher-new-group': () => openTeacherGroupModal(), 'teacher-edit-group': el => openTeacherGroupModal(el.dataset.id),
  'teacher-delete-group': el => guard(async()=>{if(!confirm('حذف هذا الفوج؟ لا يمكن حذف فوج مرتبط بطلاب.'))return;await api('/api/teacher/groups/'+encodeURIComponent(el.dataset.id),{method:'DELETE'});toast('تم حذف الفوج');showPage('groups');}),
  'teacher-new-student': () => openTeacherStudentModal(), 'teacher-edit-student': el => openTeacherStudentModal(el.dataset.id),
  'teacher-delete-student': el => guard(async()=>{if(!confirm('سيُعطّل حساب الطالب وتُزال عضويته من أفواجك مع الاحتفاظ بسجلاته. متابعة؟'))return;await api('/api/teacher/students/'+encodeURIComponent(el.dataset.id),{method:'DELETE'});toast('تم تعطيل حساب الطالب وإزالته من أفواجك');S.groups=await api('/api/groups');S.students=await api('/api/students');showPage('students');}),

  'journey-done': el => guard(async()=>{await post('/api/journey/complete',{item_id:el.dataset.id});toast('تم تسجيل الإنجاز');showPage('journey');}),
  'challenge-join': el => guard(async()=>{await post('/api/challenges/join',{challenge_id:el.dataset.id});toast('تم الانضمام إلى التحدي');showPage('journey');}), more: openMore, logout: () => { const token = S.token; endSession(); if (token) fetch('/api/logout', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: '{}' }).catch(() => {}); },
  'close-modal': closeOverlay, 'close-modal-bg': (el, e) => { if (e.target === el) closeOverlay(); },
  'quran-student': el => guard(()=>openQuranStudent(el.dataset.id)), 'quran-attendance': ()=>guard(openQuranAttendance), 'quran-report': ()=>guard(openQuranReport), 'quran-session': openQuranSession, 'quran-eval': el => openQuranEval(el.dataset.id), 'quran-plan': el => guard(()=>openQuranPlan(el.dataset.id)), 'quran-review': el => guard(()=>openQuranReview(el.dataset.id)),
  'quran-submit': openQuranSubmission, 'quran-submission-review': el=>guard(()=>openQuranSubmissionReview(el.dataset.id)), 'new-question': openQuestionModal, 'solve-question': el=>guard(()=>openQuestionSolve(el.dataset.id)), 'new-discussion': openDiscussionModal, 'open-discussion': el=>guard(()=>openDiscussion(el.dataset.id)), 'privacy-request': el=>openPrivacyRequest(el.dataset.type),
  'new-post': openPostModal, 'new-media': openMediaModal, 'change-student-group': el=>guard(()=>openStudentGroupChange(el.dataset.id)), 'request-group': el=>guard(async()=>{const reason=window.prompt('سبب طلب الانضمام (اختياري):')||'';await post('/api/group-requests',{group_id:el.dataset.id,reason,mode:'join'});toast('أرسل الطلب إلى المدير');showPage('groups');}), 'cancel-group-request': el=>guard(async()=>{await post('/api/group-requests/'+encodeURIComponent(el.dataset.id)+'/cancel',{});toast('تم إلغاء الطلب');showPage('groups');}), 'approve-group-request': el=>guard(async()=>{await post('/api/group-requests/'+encodeURIComponent(el.dataset.id)+'/review',{decision:'approve'});toast('تمت الموافقة ونقل الطالب');showPage('groups');}), 'reject-group-request': el=>guard(async()=>{await post('/api/group-requests/'+encodeURIComponent(el.dataset.id)+'/review',{decision:'reject'});toast('تم رفض الطلب');showPage('groups');}), 'audio-speed': el=>{const a=document.querySelector('[data-audio-id="'+CSS.escape(el.dataset.id)+'"]');if(!a)return;const speeds=[1,1.25,1.5,1.75,2];const n=speeds[(speeds.indexOf(a.playbackRate)+1)%speeds.length];a.playbackRate=n;el.textContent=n+'×';}, 'audio-sleep': el=>{const a=document.querySelector('[data-audio-id="'+CSS.escape(el.dataset.id)+'"]');if(!a)return;clearTimeout(a._sleep);const ms=15*60*1000; a._sleep=setTimeout(()=>a.pause(),ms);el.textContent='مؤقت فعّال'; toast('سيتوقف الصوت بعد 15 دقيقة');}, 'open-media-file': el=>guard(async()=>{await post('/api/media/'+encodeURIComponent(el.dataset.id)+'/read',{});const r=await fetch('/api/media/'+encodeURIComponent(el.dataset.id)+'/file',{headers:{Authorization:'Bearer '+S.token}});if(!r.ok)throw new Error('تعذر فتح الملف');const blob=await r.blob();const u=URL.createObjectURL(blob);window.open(u,'_blank');setTimeout(()=>URL.revokeObjectURL(u),60000);}), 'like-media': el=>guard(async()=>{await post('/api/media/'+encodeURIComponent(el.dataset.id)+'/like',{});showPage('media');}), 'play-media': el=>guard(async()=>{const id=el.dataset.id,title=el.dataset.title||'تسجيل',src=el.dataset.src||''; if(src) showAudioDock({id,title,url:src});}), 'bookmark-media': el=>guard(async()=>{const r=await post('/api/media/'+encodeURIComponent(el.dataset.id)+'/bookmark',{});el.textContent=r.bookmarked?'★ محفوظ':'☆ حفظ';}), 'media-comments': el=>guard(()=>openMediaComments(el.dataset.id)), 'media-viewers': el=>guard(async()=>{const v=await api('/api/media/'+encodeURIComponent(el.dataset.id)+'/viewers');openModal('المشاهدون',html`<div>${v.length?v.map(x=>html`<div class="item"><b>${x.name}</b><div class="muted small">${fmtStamp(x.read_at)}</div></div>`):empty('لم يشاهده أحد بعد')}</div>`);}), 'view-subject-lessons': el=>guard(()=>openLearningSubjectLessons(el.dataset.id)), 'enroll-optional': el=>guard(async()=>{await post('/api/optional-curriculum',{subject_id:el.dataset.id});toast('تمت إضافة المادة إلى مسارك');showPage('curriculum');}), 'task-done': el=>guard(async()=>{await post('/api/student-tasks/'+encodeURIComponent(el.dataset.id)+'/status',{status:'done'});toast('أحسنت، تم إنهاء المهمة');showPage('tasks');}),  'new-assignment': openAssignmentModal, 'submit-assignment': el=>openSubmitAssignment(el.dataset.id), 'grade-assignment': el=>guard(()=>openAssignmentGrade(el.dataset.id)), 'new-calendar': openCalendarModal, 'new-message': ()=>guard(openMessageModal), 'message-user': el=>guard(()=>openMessageModal(el.dataset.id)), 'new-team-student': el=>openTeamStudentModal(el.dataset.id), 'read-message': el=>guard(async()=>{await post('/api/messages/'+encodeURIComponent(el.dataset.id)+'/read');showPage('messages');}), 'new-test': openTestModal, 'admin-new-user': () => openAdminUserModal(), 'admin-edit-user': el => openAdminUserModal(el.dataset.id), 'admin-new-group': () => openGroupModal(), 'admin-edit-group': el => openGroupModal(el.dataset.id), 'admin-group-teachers': el => openGroupTeachers(el.dataset.id), 'apply-team-supervisor': el=>guard(async()=>{const reason=window.prompt('لماذا ترغب في خدمة فريقك كمشرف؟ (اختياري)')||'';await post('/api/supervisor-requests',{team_id:el.dataset.id,reason});toast('أُرسل طلبك إلى الشيخ والإدارة وكبير المشرفين');showPage('teams');}), 'review-supervisor-request': el=>guard(async()=>{await api('/api/supervisor-requests/'+encodeURIComponent(el.dataset.id)+'/review',{method:'PATCH',body:JSON.stringify({decision:el.dataset.decision})});toast(el.dataset.decision==='approve'?'تمت الموافقة وتعيين المشرف':'تم رفض الطلب');showPage('supervisor-requests');}), 'new-team': ()=>guard(openTeamModal), 'edit-team-members': el=>guard(()=>openTeamMembers(el.dataset.id)), 'new-team-task': el=>guard(()=>openTeamTaskModal(el.dataset.id)), 'team-task-done': el=>guard(async()=>{await api('/api/team-tasks/'+encodeURIComponent(el.dataset.id),{method:'PATCH',body:JSON.stringify({status:'done'})});toast('تم تعليم المهمة كمكتملة');showPage('teams');}), 'new-academic-year': openAcademicYearModal, 'new-subject': ()=>guard(()=>openSubjectModal()), 'edit-subject': el=>guard(()=>openSubjectModal(el.dataset.id)), 'edit-subject-lessons': el=>guard(()=>openSubjectLessons(el.dataset.id)), 'new-lesson': ()=>guard(()=>openLessonModal()), 'new-lesson-for': el=>guard(()=>openLessonModal(null,el.dataset.id)), 'edit-lesson': el=>guard(()=>openLessonModal(el.dataset.id)), 'new-term': () => guard(()=>openTermModal()), 'new-plan': () => guard(()=>openPlanModal()), 'edit-plan': el => guard(()=>openPlanModal(el.dataset.id)), 'edit-term': el => guard(()=>openTermModal(el.dataset.id)), 'admin-backup': () => guard(async()=>{ const r=await fetch('/api/admin/backup',{headers:{Authorization:'Bearer '+S.token}}); if(!r.ok) throw new Error('تعذر تنزيل النسخة الاحتياطية'); const blob=await r.blob(); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='academy-backup-v21.json'; a.click(); URL.revokeObjectURL(a.href); toast('تم تنزيل النسخة الاحتياطية'); }),
  'open-file': el => openFile(el.dataset.id),
  'child-report': el => { S.rep.student_id = el.dataset.id; showPage('reports'); },
  'file-tab': el => { S.file.tab = el.dataset.tab; drawFile(); },
  'print-report': printReport,
  'save-report': el => guard(async () => { el.disabled = true; try { await post('/api/reports/generate', { student_id: S.file.id, month: S.file.month }); toast('تم حفظ التقرير في السجل'); await pgFile(); } finally { el.disabled = false; } }),
  'attendance-weekly-report': ()=>guard(openAttendanceWeeklyReport), 'new-transport-route': ()=>guard(()=>openTransportRouteModal()), 'edit-transport-route': el=>guard(()=>openTransportRouteModal(el.dataset.id)), 'add-transport-student': el=>guard(()=>openTransportStudentModal(el.dataset.id)), 'remove-transport': el=>guard(async()=>{await api('/api/admin/transport/assign/'+encodeURIComponent(el.dataset.id),{method:'DELETE'});toast('تمت إزالة الطالب من خط النقل');showPage('transport');}), 'att-all': () => { (S.att.rows || []).forEach(r => { r.status = 'present'; }); drawSheet(); },
  'att-save': el => saveAttendance(el),
  'grade-test': el => showPage('tests', { grading: el.dataset.id }),
  'back-tests': () => showPage('tests', { grading: null }),
  'grades-save': el => saveGrades(el),
  'open-lesson': el => openLesson(el.dataset.id),
  'open-practice': el => openPractice(el.dataset.id),
  'practice-next': nextPracticeQuestion,
  'lesson-complete-modal': el => completeLessonFromModal(el.dataset.id),
  'lesson-complete': el => guard(async () => { el.disabled = true; await post(`/api/lessons/${encodeURIComponent(el.dataset.id)}/complete`); toast('أحسنت، تم تسجيل إكمال الدرس'); showPage('learning'); }),
  'lesson-uncomplete': el => guard(async () => { el.disabled = true; await post(`/api/lessons/${encodeURIComponent(el.dataset.id)}/uncomplete`); toast('تم إلغاء الإكمال'); showPage('learning'); }),
  'new-goal': openGoalModal,
  'goal-progress': el => guard(async () => { await post(`/api/goals/${encodeURIComponent(el.dataset.id)}/progress`, { progress: Number(el.dataset.progress) }); toast('تم تحديث تقدم الهدف'); showPage('learning'); }),
  'read-all': () => guard(async () => { await post('/api/notifications/read-all'); S.notifications = await api('/api/notifications'); toast('تم تحديث الإشعارات'); showPage('notifications'); })
};
const INP = {
  postSearch: el => drawPosts(el.value), stuFilter: drawStudents, lessonSearch: el => { LQUERY = el.value; drawLearning(); },
  attNote: el => { const r = S.att.rows.find(x => x.id === el.dataset.sid); if (r) r.note = el.value; },
  gradeScore: el => { const r = G.rows.find(x => x.id === el.dataset.sid); if (!r) return; r.score = el.value; const v = Number(el.value); el.classList.toggle('bad', el.value !== '' && !(v >= 0 && v <= G.test.max_score)); updateGradeCount(); },
  gradeNote: el => { const r = G.rows.find(x => x.id === el.dataset.sid); if (r) r.note = el.value; }
};
const CHG = {
  adminPasswordVisibility: el => { const input=$('#adminUserPassword'); if(input) input.type=el.checked?'text':'password'; },
  passwordVisibility: el => { const input=document.getElementById(el.dataset.target); if(input) input.type=el.checked?'text':'password'; },
  stuFilter: drawStudents,
  postAud: el => $('#postGroupWrap').classList.toggle('hidden', el.value !== 'group'),
  attGroup: el => guard(async () => { S.att.group_id = el.value; await loadSheet(); }),
  attDate: el => guard(async () => { if (!el.value) return; S.att.date = el.value; await loadSheet(); }),
  attStatus: el => { const r = S.att.rows.find(x => x.id === el.dataset.sid); if (r) r.status = el.value; put($('#tally'), tallyHtml()); },
  fileMonth: el => { S.file.month = el.value; guard(pgFile); },
  repStudent: el => { S.rep.student_id = el.value; guard(pgReports); },
  repMonth: el => { S.rep.month = el.value; guard(pgReports); },
  adminUserRole: el => { const form=el.closest('form'),box=form?.querySelector('#studentProvisionFields'),email=form?.querySelector('[name=email]'),password=form?.querySelector('[name=password]'); if (box) box.style.display = el.value === 'student' ? '' : 'none'; if(email) email.required=el.value!=='student'; if(password&&!form.dataset.id){password.required=el.value!=='student';password.minLength=el.value==='student'?0:8;password.placeholder=el.value==='student'?'اتركها فارغة لتوليد كلمة من الاسم +123':'8 أحرف على الأقل';} }
};
const fd = f => Object.fromEntries(new FormData(f).entries());
const FORM = {
  post: f => guard(async () => { const v = fd(f); await post('/api/posts', { title: v.title, body: v.body, group_id: v.aud === 'group' ? v.group : null }); S.posts = await api('/api/posts'); S.notifications = await api('/api/notifications'); closeOverlay(); toast('تم نشر التحديث'); showPage('news'); }),
  test: f => guard(async () => { const v = fd(f); const t = await post('/api/tests', { title: v.title, subject_id: v.subject_id, group_id: v.group_id, date: v.date, max_score: Number(v.max_score), description: v.description }); closeOverlay(); toast('تم إنشاء الاختبار'); showPage('tests', { grading: t.id }); }),
  note: f => guard(async () => { const v = fd(f); await post('/api/teacher-notes', { student_id: S.file.id, category: v.category, text: v.text, shared: v.shared === 'on' }); toast('تم حفظ الملاحظة'); await pgFile(); }),
  quicknote: f => guard(async () => { const v = fd(f); await post('/api/teacher-notes', { student_id: v.student_id, category: v.category, text: v.text, shared: v.shared === 'on' }); toast('تم حفظ الملاحظة'); showPage('teacher-tools'); }),
  'quran-attendance': f => guard(async()=>{ const v=fd(f), rows=[...f.querySelectorAll('[name^=\"status_\"]')].map(x=>{const id=x.name.slice(7);return {student_id:id,status:x.value,note:f.querySelector('[name=\"note_'+id+'\"]')?.value||''};}); await post('/api/quran/attendance/bulk',{halaqa_id:f.dataset.halaqa,date:f.dataset.date,records:rows}); closeOverlay(); toast('تم حفظ حضور الحلقة'); showPage('quran'); }),
  'quran-session': f => guard(async () => { const v=fd(f); await post('/api/quran/session',{student_id:v.student_id,type:v.type,surah:v.surah,from_ayah:Number(v.from_ayah),to_ayah:Number(v.to_ayah),date:v.date,rating:Number(v.rating),tajweed:Number(v.tajweed),fluency:Number(v.fluency),notes:v.notes}); closeOverlay(); toast('تم تسجيل جلسة القرآن'); showPage('quran'); }),
  'quran-eval': f => guard(async () => { const v=fd(f); await post('/api/quran/evaluation',{student_id:v.student_id,reading:Number(v.reading),tajweed:Number(v.tajweed),memorization:Number(v.memorization),adab:Number(v.adab),notes:v.notes,date:today()}); closeOverlay(); toast('تم حفظ التقويم القرآني'); showPage('quran'); }), 'quran-plan': f => guard(async()=>{const v=fd(f); await post('/api/quran/plans',{student_id:f.dataset.id,target_date:v.target_date,surah:v.surah,from_ayah:Number(v.from_ayah),to_ayah:Number(v.to_ayah),pages:Number(v.pages),notes:v.notes}); closeOverlay(); toast('تم حفظ خطة الحفظ'); showPage('quran');}), 'quran-review': f => guard(async()=>{const v=fd(f); await post('/api/quran/reviews',{student_id:f.dataset.id,due_date:v.due_date,surah:v.surah,from_ayah:Number(v.from_ayah),to_ayah:Number(v.to_ayah),notes:v.notes}); closeOverlay(); toast('تم جدولة المراجعة'); showPage('quran');}),
  goal: f => guard(async () => { const v = fd(f); await post('/api/goals', { title: v.title, target: v.target, type: v.type }); closeOverlay(); toast('تم حفظ الهدف'); showPage('learning'); }),
  'quran-submission': f=>guard(async()=>{const v=fd(f),file=f.querySelector('[name=file]').files[0];if(!file)throw new Error('أرفق تسجيلًا صوتيًا');if(file.size>12*1024*1024)throw new Error('التسجيل أكبر من 12MB');const data=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(file)});await post('/api/quran/submissions',{surah:v.surah,from_ayah:Number(v.from_ayah),to_ayah:Number(v.to_ayah),notes:v.notes,file_name:file.name,mime:file.type,file_data:data});closeOverlay();toast('تم إرسال التسميع إلى الشيخ');showPage('quran');}),
  'quran-submission-review': f=>guard(async()=>{const v=fd(f);await post('/api/quran/submissions/'+encodeURIComponent(f.dataset.id)+'/review',{status:v.status,score:v.score,teacher_note:v.teacher_note});closeOverlay();toast('تم حفظ مراجعة التسميع');showPage('quran');}),
  question: f=>guard(async()=>{const v=fd(f);const options=String(v.options||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);let correct=String(v.correct_answer||'').trim();if(v.type==='multiple_choice')correct=correct.split(',').map(x=>x.trim()).filter(Boolean);await post('/api/question-bank',{title:v.title,type:v.type,points:Number(v.points),options,correct_answer:correct,explanation:v.explanation,subject_id:v.subject_id||null,group_id:v.group_id||null});closeOverlay();toast('تم حفظ السؤال');showPage('question-bank');}),
  'question-attempt': f=>guard(async()=>{let answer;if(f.elements.answer?.length&&f.elements.answer[0]?.type==='checkbox')answer=[...f.querySelectorAll('[name=answer]:checked')].map(x=>x.value);else answer=f.querySelector('[name=answer]')?.value||'';const r=await post('/api/question-bank/'+encodeURIComponent(f.dataset.id)+'/attempt',{answer});closeOverlay();toast(r.status==='graded'?`أحسنت، ${r.score}/${r.max_score}`:'وصلت إجابتك وسيتم التصحيح');showPage('question-bank');}),
  discussion: f=>guard(async()=>{const v=fd(f);await post('/api/discussions',{title:v.title,content:v.content,group_id:v.group_id||null});closeOverlay();toast('تم نشر الموضوع');showPage('community');}),
  'discussion-reply': f=>guard(async()=>{const v=fd(f);await post('/api/discussions/'+encodeURIComponent(f.dataset.id)+'/replies',{content:v.content});closeOverlay();toast('تم إضافة الرد');openDiscussion(f.dataset.id);}),
  settings: f=>guard(async()=>{const v=fd(f);await api('/api/settings',{method:'PATCH',body:JSON.stringify({theme:v.theme,font_scale:Number(v.font_scale),high_contrast:f.elements.high_contrast.checked,reduced_motion:f.elements.reduced_motion.checked})});localStorage.setItem('academy_theme',v.theme||'emerald');localStorage.setItem('academy_reduced_motion',f.elements.reduced_motion.checked?'1':'0');closeOverlay();document.documentElement.dataset.theme=v.theme||'emerald';document.documentElement.style.fontSize=(Number(v.font_scale)||1)+'em';document.documentElement.classList.toggle('high-contrast',f.elements.high_contrast.checked);document.documentElement.classList.toggle('reduced-motion',f.elements.reduced_motion.checked);toast('تم حفظ التفضيلات');showPage('settings');}),
  'change-password': f=>guard(async()=>{const v=fd(f);if(v.new_password!==v.confirm_password)throw new Error('تأكيد كلمة المرور غير مطابق');await post('/api/account/password',{current_password:v.current_password,new_password:v.new_password});toast('تم تغيير كلمة المرور بنجاح');showPage('settings');}),
  'privacy-request': f=>guard(async()=>{await post('/api/privacy/request',{type:f.dataset.type,details:fd(f).details});closeOverlay();toast('تم إرسال طلب الخصوصية');showPage('settings');}),
  assignment: f => guard(async()=>{const v=fd(f);await post('/api/assignments',{title:v.title,description:v.description,due_date:v.due_date,max_score:Number(v.max_score),group_id:v.group_id,subject_id:v.subject_id||null});closeOverlay();toast('تم نشر الواجب');showPage('assignments');}),
  'assignment-submit': f => guard(async()=>{const v=fd(f);await post('/api/assignments/'+encodeURIComponent(f.dataset.id)+'/submit',{answer:v.answer});closeOverlay();toast('تم تسليم الواجب');showPage('assignments');}), 'assignment-grade': f => guard(async()=>{const v=fd(f);await post('/api/assignments/'+encodeURIComponent(f.dataset.id)+'/grade',{student_id:f.dataset.student,grade:Number(v.grade),note:v.note});toast('تم حفظ التصحيح');openAssignmentGrade(f.dataset.id);}),
  calendar: f => guard(async()=>{const v=fd(f);await post('/api/calendar',v);closeOverlay();toast('تم حفظ الموعد');showPage('calendar');}),
  message: f => guard(async()=>{const v=fd(f);await post('/api/messages',v);academyTone('message');closeOverlay();toast('تم إرسال الرسالة');showPage('messages');}),
  media: f => guard(()=>submitMedia(f)), 'media-comment': f => guard(async()=>{const v=fd(f);await post('/api/media/'+encodeURIComponent(f.dataset.id)+'/comments',{body:v.body});closeOverlay();toast('تم نشر التعليق');openMediaComments(f.dataset.id);}),
  'student-groups': f => guard(async()=>{const groups=[...f.querySelectorAll('[name=group_ids]:checked')].map(x=>x.value);await api('/api/admin/students/'+encodeURIComponent(f.dataset.id)+'/groups',{method:'PATCH',body:JSON.stringify({group_ids:groups})});closeOverlay();toast('تم تحديث أفواج الطالب');S.students=await api('/api/students');showPage('students');}),
  'group-request': f => guard(async()=>{const v=fd(f);await post('/api/group-requests',{student_id:f.dataset.student,group_id:v.group_id,reason:v.reason,mode:'transfer'});closeOverlay();toast('تم رفع طلب النقل إلى المدير');showPage('groups');}),
  'admin-group': f => guard(async () => { const v=fd(f), id=f.dataset.id; const payload={name:v.name,level:v.level,description:v.description}; if(id){payload.active=f.querySelector('[name=active]')?.checked!==false;await api('/api/admin/groups/'+encodeURIComponent(id),{method:'PATCH',body:JSON.stringify(payload)});}else await post('/api/admin/groups',payload); closeOverlay();toast('تم حفظ الفوج');showPage('admin'); }),
  'admin-group-teachers': f => guard(async () => { const ids=[...f.querySelectorAll('[name=teacher_ids]:checked')].map(x=>x.value); await api('/api/admin/groups/'+encodeURIComponent(f.dataset.id)+'/teachers',{method:'PUT',body:JSON.stringify({teacher_ids:ids})}); closeOverlay();toast('تم تحديث إسناد الشيوخ');showPage('admin'); }),
  'copy-login-credential': el => { const input=$('#'+el.dataset.target); if(input) copyCredentialText(input.value); },
  'copy-login-both': () => copyCredentialText('البريد الإلكتروني: '+($('#loginCredentialEmail')?.value||'')+'\nكلمة المرور: '+($('#loginCredentialPassword')?.value||'')),
  'admin-user': f => guard(async () => { const v=fd(f), id=f.dataset.id; if(!id && v.password && v.password!==v.confirm_password) throw new Error('كلمتا المرور غير متطابقتين'); const payload={name:v.name,role:v.role,group_ids:[...f.querySelectorAll('[name=group_ids]:checked')].map(x=>x.value),task_title:v.task_title,task_description:v.task_description,task_due:v.task_due}; if(v.email) payload.email=v.email; if(v.password) payload.password=v.password; if(id) { payload.active=f.querySelector('[name=active]')?.checked !== false; await api('/api/admin/users/'+encodeURIComponent(id),{method:'PATCH',body:JSON.stringify(payload)}); } else { const created=await post('/api/admin/users',payload); closeOverlay(); showPage('admin'); if(v.role==='student') showLoginCredentials(v.name,v.email||'',created.initial_password||v.password); else if(v.password) showLoginCredentials(v.name,v.email,v.password); else toast('تم حفظ المستخدم'); return; } closeOverlay(); showPage('admin'); if(v.password) showLoginCredentials(v.name,v.email,v.password); else toast('تم حفظ المستخدم'); })
};

document.addEventListener('click', e => { const el = e.target.closest('[data-act]'); if (el && ACT[el.dataset.act]) { if (el.tagName === 'A') e.preventDefault(); ACT[el.dataset.act](el, e); } });
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.dataset && e.target.dataset.in === 'gradeScore') { e.preventDefault(); const all = [...document.querySelectorAll('[data-in="gradeScore"]')], i = all.indexOf(e.target); (all[i + 1] || e.target).focus(); }
  if (e.key === 'Enter' && e.target.dataset && e.target.dataset.act === 'open-file') ACT['open-file'](e.target);
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('[role=button][data-act]')) { e.preventDefault(); e.target.click(); }
  if (e.key === 'Escape') closeOverlay();
});
document.addEventListener('input', e => { const k = e.target.dataset && e.target.dataset.in; if (k && INP[k]) INP[k](e.target); });
document.addEventListener('change', e => { const k = e.target.dataset && e.target.dataset.ch; if (k && CHG[k]) CHG[k](e.target); });
document.addEventListener('submit', async e => {
  const f=e.target;
  if (f.dataset.form === 'practice-answer') { e.preventDefault(); await submitPracticeAnswer(f); return; }
  if(f.dataset.form==='teacher-group'){e.preventDefault();try{const d=fd(f),id=f.dataset.id;await api(id?'/api/teacher/groups/'+encodeURIComponent(id):'/api/teacher/groups',{method:id?'PATCH':'POST',body:JSON.stringify(d)});closeOverlay();toast('تم حفظ الفوج');S.groups=await api('/api/groups');S.students=await api('/api/students');showPage('groups');}catch(err){toast(err.message,true)}return;}
  if(f.dataset.form==='team-student'){e.preventDefault();try{const d=fd(f);if(d.password&&d.password!==d.confirm_password)throw new Error('كلمتا المرور غير متطابقتين');const created=await post('/api/teams/'+encodeURIComponent(f.dataset.id)+'/students',d);closeOverlay();S.groups=await api('/api/groups');S.students=await api('/api/students');showPage('teams');showLoginCredentials(d.name,d.email||'',created.initial_password||d.password);}catch(err){toast(err.message,true)}return;}
  if(f.dataset.form==='teacher-student'){e.preventDefault();try{const d=fd(f),id=f.dataset.id;if(!id&&d.password&&d.password!==d.confirm_password)throw new Error('كلمتا المرور غير متطابقتين');if(id){await api('/api/teacher/students/'+encodeURIComponent(id),{method:'PATCH',body:JSON.stringify({name:d.name,level:d.level})});closeOverlay();toast('تم تعديل بيانات الطالب');}else{const created=await post('/api/teacher/students',{...d});closeOverlay();showLoginCredentials(d.name,d.email||'',created.initial_password||d.password);}S.groups=await api('/api/groups');S.students=await api('/api/students');showPage('students');}catch(err){toast(err.message,true)}return;} if(f.dataset.form==='academic-year'){e.preventDefault(); try{const d=fd(f);d.active=f.elements.active.checked;await post('/api/admin/academic-years',d);closeOverlay();toast('تم إنشاء السنة الدراسية');showPage('program')}catch(err){toast(err.message,true)}}
  if(f.dataset.form==='program-subject'){e.preventDefault(); try{const d=fd(f);d.required=f.elements.required.checked;const id=f.dataset.id;await api(id?'/api/admin/program/subjects/'+encodeURIComponent(id):'/api/admin/program/subjects',{method:id?'PATCH':'POST',body:JSON.stringify(d)});closeOverlay();toast('تم حفظ المادة');showPage('program')}catch(err){toast(err.message,true)}}
  if(f.dataset.form==='program-lesson'){e.preventDefault(); try{const d=fd(f);const id=f.dataset.id;const core={subject_id:d.subject_id,title:d.title,description:d.description,study_method:d.study_method,learning_mode:d.learning_mode};const saved=await api(id?'/api/admin/program/lessons/'+encodeURIComponent(id):'/api/admin/program/lessons',{method:id?'PATCH':'POST',body:JSON.stringify(core)});if(id){const content={opening:d.opening,story:d.story,explanation:d.explanation,examples:String(d.examples||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean),reflection_questions:String(d.reflection_questions||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean),action:d.action,memorize:d.memorize,source_notes:d.source_notes,source_status:d.source_status};await api('/api/admin/program/lessons/'+encodeURIComponent(saved.id)+'/content',{method:'PATCH',body:JSON.stringify(content)});}closeOverlay();toast('تم حفظ الدرس والمجلس');showPage('program')}catch(err){toast(err.message,true)}}
  if(f.dataset.form==='learning-plan'){e.preventDefault(); try{const d=fd(f);d.published=f.elements.published.checked;d.items=String(d.items||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);const id=f.dataset.id;await api(id?'/api/admin/plans/'+encodeURIComponent(id):'/api/admin/plans',{method:id?'PATCH':'POST',body:JSON.stringify(d)});closeOverlay();toast('تم حفظ الخطة');showPage('program')}catch(err){toast(err.message,true)}}
  if(f.dataset.form==='transport-route'){e.preventDefault();try{const d=fd(f);d.pickup_points=String(d.pickup_points||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);const id=f.dataset.id;await api(id?'/api/admin/transport/routes/'+encodeURIComponent(id):'/api/admin/transport/routes',{method:id?'PATCH':'POST',body:JSON.stringify(d)});closeOverlay();toast('تم حفظ خط النقل');showPage('transport')}catch(err){toast(err.message,true)}}
  if(f.dataset.form==='transport-assign'){e.preventDefault();try{const d=fd(f);await api('/api/admin/transport/assign',{method:'POST',body:JSON.stringify({route_id:f.dataset.route,...d})});closeOverlay();toast('تمت إضافة الطالب إلى النقل');showPage('transport')}catch(err){toast(err.message,true)}}
  if(f.dataset.form==='term'){e.preventDefault(); try{const d=fd(f);d.active=f.elements.active.checked;const id=f.dataset.id;await api(id?'/api/admin/terms/'+encodeURIComponent(id):'/api/admin/terms',{method:id?'PATCH':'POST',body:JSON.stringify(d)});closeOverlay();toast('تم حفظ الفصل');showPage('program')}catch(err){toast(err.message,true)}}
});
document.addEventListener('submit', e => {
  const f=e.target;
  if(f.dataset.form==='team'){e.preventDefault();const d=fd(f);guard(async()=>{await post('/api/teams',{name:d.name,group_id:d.group_id,description:d.description});closeOverlay();toast('تم إنشاء الفريق');showPage('teams');})();return;}
  if(f.dataset.form==='team-members'){e.preventDefault();const student_ids=[...f.querySelectorAll('[name=student_ids]:checked')].map(x=>x.value),supervisor_ids=[...f.querySelectorAll('[name=supervisor_ids]:checked')].map(x=>x.value);guard(async()=>{await api('/api/teams/'+encodeURIComponent(f.dataset.id)+'/members',{method:'PUT',body:JSON.stringify({student_ids,supervisor_ids})});closeOverlay();toast('تم حفظ أعضاء الفريق ومشرفيه');showPage('teams');})();return;}
  if(f.dataset.form==='team-task'){e.preventDefault();const d=fd(f);guard(async()=>{await post('/api/teams/'+encodeURIComponent(f.dataset.id)+'/tasks',d);closeOverlay();toast('تمت إضافة المهمة');showPage('teams');})();return;}
  const form=e.target.closest('[data-form]'); if (form) { e.preventDefault(); FORM[form.dataset.form](form); }
});

$('#showPass').addEventListener('change', e => { $('#loginPass').type = e.target.checked ? 'text' : 'password'; });
$('#loginForm').addEventListener('submit', async e => {
  e.preventDefault(); const btn = $('#loginBtn'), err = $('#loginErr'); err.textContent = ''; btn.disabled = true;
  try {
    const r = await api('/api/login', { method: 'POST', body: JSON.stringify({ identity: $('#loginEmail').value, password: $('#loginPass').value }) });
    S.token = r.token; try { sessionStorage.setItem('ab_token', r.token); } catch { /* */ }
    await startSession();
  } catch (ex) { err.textContent = ex.message; } finally { btn.disabled = false; }
});

(async function boot() {
  try { S.token = sessionStorage.getItem('ab_token'); } catch { S.token = null; }
  if (!S.token) return showLogin();
  try { await startSession(); } catch { endSession(); }
})();
})();

