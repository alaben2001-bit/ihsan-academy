'use strict';
/*
 * أكاديمية الإحسان في بناء الإنسان — Local Development + Repository/Service core
 * خادم محلي + قاعدة JSON. ليس متصلًا بسحابة حقيقية.
 *
 * مبادئ الأمان في هذا الملف:
 *  - لا نثق بأي role / student_id / parent_id قادم من المتصفح: الدور يؤخذ من الجلسة في الخادم فقط.
 *  - كل قراءة وكتابة تمر عبر نطاق المستخدم (scopedStudents / visibleGroupIds).
 *  - كلمات المرور مجزّأة (scrypt) ولا تُرسل للواجهة أبدًا.
 *  - الملفات الثابتة تُخدَّم من قائمة بيضاء فقط (index.html, manifest.json, assets/).
 */
const http = require('http'), https = require('https'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const { createStorage } = require('./storage');
const { CoreRepository } = require('./repositories/core');
const { CoreService } = require('./services/core');
const { handleAdvanced } = require('./advanced');
const { seedEducationalContent } = require('./educational-content');

const ROOT = path.join(__dirname, '..');
const APP_VERSION = require('../package.json').version;
const DATA = process.env.ACADEMY_DB_FILE ? path.resolve(process.env.ACADEMY_DB_FILE) : path.join(ROOT, 'data', 'db.json');
const ASSETS = path.join(ROOT, 'assets');
const PORT = Number(process.env.PORT) || 3000;
const storage = createStorage({ root: ROOT, dataFile: DATA });
const CONFIG = {
  mode: process.env.ACADEMY_DB_MODE || storage.kind,
  storage: storage.kind,
  cloudUrl: process.env.ACADEMY_CLOUD_URL || '',
  cloudKey: process.env.ACADEMY_CLOUD_KEY || ''
};
const SESSION_TTL = Math.max(30, Number(process.env.ACADEMY_SESSION_TTL_HOURS) || 12) * 3600 * 1000;
const sessions = new Map();      // token -> {uid, exp}
const loginFails = new Map();    // ip|email -> {n, until}
const requestHits = new Map();
const RATE_WINDOW = 60 * 1000;
const RATE_LIMIT = Math.max(60, Number(process.env.ACADEMY_RATE_LIMIT_PER_MINUTE) || 240);
const PRODUCTION = process.env.NODE_ENV === 'production' || process.env.ACADEMY_PRODUCTION === '1';
const REQUIRE_HTTPS = PRODUCTION && process.env.ACADEMY_REQUIRE_HTTPS !== '0';
const COOKIE_NAME = 'academy_session';
const CSRF_COOKIE = 'academy_csrf';
const COOKIE_SECURE = PRODUCTION || process.env.ACADEMY_COOKIE_SECURE === '1';
const MEDIA_ROOT = path.resolve(process.env.ACADEMY_MEDIA_ROOT || path.join(ROOT, 'data', 'uploads'));
const csrfTokens = new Map();

let db = null;

/* ───────────── أدوات عامة ───────────── */
class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
const fail = (status, msg) => { throw new HttpError(status, msg); };
const uid = prefix => prefix + crypto.randomBytes(5).toString('hex');
const pad = n => String(n).padStart(2, '0');
const localISO = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return localISO(d); };
const isDate = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + 'T12:00:00')) && localISO(new Date(s + 'T12:00:00')) === s;
const termForDate = date => { if (!isDate(date)) return null; return db.terms?.find(t => t.active !== false && date >= t.start && date <= t.end) || db.terms?.find(t => date >= t.start && date <= t.end) || null; };
const isMonth = s => typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
const prevMonth = m => { const [y, mo] = m.split('-').map(Number); return mo === 1 ? `${y - 1}-12` : `${y}-${pad(mo - 1)}`; };
const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const monthLabel = m => `${MONTHS_AR[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}`;
const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
const clean = (v, max) => String(v == null ? '' : v).trim().slice(0, max);
const safeUrl = v => { try { const u=new URL(String(v||'')); return ['http:','https:'].includes(u.protocol) ? u.href : ''; } catch { return ''; } };

function rateLimit(req) {
  const ip=String(req.socket.remoteAddress||'unknown'), now=Date.now(); const h=requestHits.get(ip);
  if(!h || now-h.at>=RATE_WINDOW){requestHits.set(ip,{n:1,at:now});return;}
  h.n++; if(h.n>RATE_LIMIT) fail(429,'تم تجاوز حد الطلبات مؤقتًا، حاول بعد قليل.');
}

let lastPersistenceError = null;
function save() {
  if (CONFIG.mode === 'cloud') return Promise.resolve();
  try {
    const result = storage.save(db);
    return Promise.resolve(result).then(() => { lastPersistenceError = null; }).catch(err => { lastPersistenceError = err; throw err; });
  } catch (err) {
    lastPersistenceError = err;
    return Promise.reject(err);
  }
}

const coreRepo = new CoreRepository({ getDb: () => db, persist: () => save() });
const coreService = new CoreService(coreRepo, { hashPassword, uid: prefix => uid(prefix), now: () => new Date().toISOString() });

/* ───────────── كلمات المرور ───────────── */
function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `scrypt$${salt}$${crypto.scryptSync(pw, salt, 64).toString('hex')}`;
}
function verifyPassword(pw, stored) {
  const [alg, salt, hash] = String(stored || '').split('$');
  if (alg !== 'scrypt' || !salt || !hash) return false;
  const a = crypto.scryptSync(pw, salt, 64), b = Buffer.from(hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
const DUMMY_HASH = hashPassword('x'); // لتقليل الفرق الزمني عند بريد غير موجود

const MAX_SESSIONS = 1000;
const MAX_AUDIT = 1000;
function audit(user, action, meta = {}) {
  db.audit_log = Array.isArray(db.audit_log) ? db.audit_log : [];
  db.audit_log.unshift({ id: uid('au'), user_id: user ? user.id : null, action: clean(action, 80), meta, at: new Date().toISOString() });
  if (db.audit_log.length > MAX_AUDIT) db.audit_log.length = MAX_AUDIT;
}
function lessonAccessible(user, lesson) {
  if (!lesson) return false;
  if (user.role === 'admin') return true;
  const ss = scopedStudents(user);
  if (!ss.length) return false;
  const subject=db.subjects.find(x=>x.id===lesson.subject_id);
  if (subject && subject.required===false) return ss.some(st=>db.optional_enrollments.some(e=>e.student_id===st.id&&e.subject_id===subject.id&&e.status!=='withdrawn'));
  return true; // المنهج الأساسي متاح ضمن نطاق الأكاديمية
}
function getGoalForUser(user, id, write = false) {
  const g = db.goals.find(x => x.id === id);
  if (!g) fail(404, 'الهدف غير موجود');
  const s = db.students.find(x => x.id === g.student_id);
  if (!s || !(write ? canEdit(user, s) || (user.role === 'student' && s.user_id === user.id) : canView(user, s))) fail(write ? 403 : 404, 'هذا الهدف خارج نطاقك');
  return g;
}

/* ───────────── ترحيل البيانات (آمن ويمكن تكراره) ───────────── */
function migrate() {
  let changed = false;
  const set = (o, k, v) => { if (o[k] === undefined) { o[k] = v; changed = true; } };

  db.users.forEach(u => { if (typeof u.password === 'string' && !u.password.startsWith('scrypt$')) { u.password = hashPassword(u.password); changed = true; } });

  ['attendance', 'grades', 'tests', 'teacher_notes', 'reports', 'memorization', 'goals', 'subjects', 'lessons', 'schedule', 'posts', 'post_reads', 'notifications', 'lesson_progress', 'audit_log', 'quran_sessions', 'quran_evaluations', 'quran_levels', 'assignments', 'assignment_submissions', 'calendar_events', 'messages', 'group_join_requests', 'optional_enrollments', 'student_tasks', 'media_posts', 'media_reads', 'media_reactions', 'media_comments', 'quran_halaqas', 'quran_plans', 'quran_reviews', 'quran_attendance', 'quran_certificates','academic_years','terms','journey_items','student_journey','student_diagnostics','challenges','challenge_participants','anonymous_feedback','exam_excuses','teacher_profiles','donation_intents','learning_plans','quran_submissions','question_bank','question_attempts','discussions','discussion_replies','media_bookmarks','security_events','privacy_requests','app_metrics','teams','team_members','team_tasks','team_supervisors','supervisor_requests','quran_schools','schools','school_staff','attendance_weekly','transport_routes','transport_assignments','roster_imports'].forEach(k => { if (!Array.isArray(db[k])) { db[k] = []; changed = true; } });
  db.memberships = db.memberships || [];
  db.teacher_groups = db.teacher_groups || [];
  db.group_join_requests = db.group_join_requests || [];
  db.optional_enrollments = db.optional_enrollments || [];
  db.student_tasks = db.student_tasks || [];
  db.media_posts = db.media_posts || [];
  db.media_reads = db.media_reads || [];
  db.media_reactions = db.media_reactions || [];
  db.media_comments = db.media_comments || [];
  db.quran_halaqas = db.quran_halaqas || [];
  db.quran_plans = db.quran_plans || [];
  db.quran_reviews = db.quran_reviews || [];
  db.quran_attendance = db.quran_attendance || [];
  db.quran_certificates = db.quran_certificates || [];
  db.academic_years = db.academic_years || [{id:'ay1',name:db.institution?.academic_year||'2026–2027',start:'2026-09-01',end:'2027-06-30',active:true}];
  db.terms = db.terms || [{id:'term1',academic_year_id:db.academic_years[0]?.id||'ay1',name:'الفصل الأول',start:'2026-09-01',end:'2027-01-15',active:true}];
  db.attendance.forEach(a => { if (!a.term_id) { const t=termForDate(a.date); if(t){a.term_id=t.id; changed=true;} } });
  db.tests.forEach(t => { if (!t.term_id) { const tr=termForDate(t.date); if(tr){t.term_id=tr.id; changed=true;} } });
  db.journey_items = db.journey_items || [];
  db.student_journey = db.student_journey || [];
  db.student_diagnostics = db.student_diagnostics || [];
  db.challenges = db.challenges || [];
  db.challenge_participants = db.challenge_participants || [];
  db.anonymous_feedback = db.anonymous_feedback || [];
  db.exam_excuses = db.exam_excuses || [];
  db.teacher_profiles = db.teacher_profiles || [];
  db.donation_intents = db.donation_intents || [];
  db.learning_plans = db.learning_plans || [];
  db.teams = db.teams || [];
  db.team_members = db.team_members || [];
  db.team_tasks = db.team_tasks || [];
  db.team_supervisors = db.team_supervisors || [];
   db.supervisor_requests = db.supervisor_requests || [];
  db.quran_schools = db.quran_schools || [{ id:'qs1', name:'مدرسة مسجد الرحمان القرآنية', description:'مدخل المدرسة القرآنية للحفظ والمراجعة والتجويد والتربية.', active:true, order:1, school_id:'school1' }];
  // إنشاء المدير الأول من متغيرات البيئة فقط إذا لم يوجد أي مدير. لا نضع كلمة مرور إنتاجية ثابتة داخل المشروع.
  // في الإنتاج نعطّل حسابات العرض المحلية حتى لا تدخل الأكاديمية العامة ببيانات التجربة.
  if (PRODUCTION) db.users.forEach(u => { if (String(u.email||'').toLowerCase().endsWith('@academy.local') && u.active !== false) { u.active=false; changed=true; } });
  // One-time, explicitly enabled administrator recovery. Remove the flag after the recovery deploy.
  const recoveryEmail = clean(process.env.ACADEMY_BOOTSTRAP_ADMIN_EMAIL || '', 200).toLowerCase();
  const recoveryPassword = String(process.env.ACADEMY_BOOTSTRAP_ADMIN_PASSWORD || '');
  if (process.env.ACADEMY_FORCE_ADMIN_PASSWORD_RESET === '1' && recoveryEmail && recoveryPassword.length >= 12 && /^\S+@\S+\.\S+$/.test(recoveryEmail)) {
    const recoveryUser = db.users.find(u => String(u.email || '').toLowerCase() === recoveryEmail && u.role === 'admin');
    if (recoveryUser) {
      recoveryUser.password = hashPassword(recoveryPassword);
      recoveryUser.active = true;
      changed = true;
    }
  }
  if (!db.users.some(u => u.role === 'admin' && u.active !== false)) {
    const email = clean(process.env.ACADEMY_BOOTSTRAP_ADMIN_EMAIL || '', 200).toLowerCase();
    const password = String(process.env.ACADEMY_BOOTSTRAP_ADMIN_PASSWORD || '');
    const name = clean(process.env.ACADEMY_BOOTSTRAP_ADMIN_NAME || 'مدير أكاديمية الإحسان', 120);
    if (email && password.length >= 12 && /^\S+@\S+\.\S+$/.test(email)) {
      const existing = db.users.find(u => u.email === email);
      if (existing) { existing.name=name; existing.password=hashPassword(password); existing.role='admin'; existing.active=true; }
      else db.users.push({ id:uid('u'), name, email, password:hashPassword(password), role:'admin', active:true, created_at:new Date().toISOString() });
      changed = true;
    }
  }
  if (!db.journey_items.length) db.journey_items.push(
    {id:'ji1',title:'قراءة القرآن',description:'قراءة يومية هادئة مع تصحيح القراءة.',category:'القرآن',level:'المستوى 1',order:1,required:true,active:true},
    {id:'ji2',title:'الفاتحة',description:'إتقان الفاتحة قراءةً وفهمًا وآدابًا.',category:'القرآن',level:'المستوى 1',order:2,required:true,active:true},
    {id:'ji3',title:'أذكار أساسية',description:'حفظ الأذكار الأساسية وفهم معناها والعمل بها.',category:'الذكر',level:'المستوى 1',order:3,required:true,active:true},
    {id:'ji4',title:'حديث 1',description:'حفظ الحديث وفهمه واستخراج العمل منه.',category:'الحديث',level:'المستوى 1',order:4,required:false,active:true},
    {id:'ji5',title:'آداب المسلم',description:'تحويل العلم إلى سلوك ظاهر في الحياة اليومية.',category:'الأخلاق',level:'المستوى 1',order:5,required:false,active:true},
    {id:'ji6',title:'تنظيم الأسبوع',description:'خطة أسبوعية خفيفة قابلة للاستمرار دون إجهاد.',category:'التنظيم',level:'المستوى 1',order:6,required:false,active:true}
  );
  set(db, 'institution', { name: 'أكاديمية الإحسان في بناء الإنسان', motto: 'نبني الإنسان علمًا وخلقًا وعادةً', academic_year: '2026–2027', term: 'الفصل الأول', phone: '', email: '' });

  const gByName = Object.fromEntries(db.groups.map(g => [g.name, g.id]));
  db.students.forEach(s => set(s, 'group_id', gByName[s.group_name] || null));
  db.memberships.forEach(m => { if (!m.student_id) { const s = db.students.find(x => x.user_id && x.user_id === m.user_id); if (s) { m.student_id = s.id; changed = true; } } });
  db.students.forEach(s => {
    if (s.group_id && !db.memberships.some(m => m.student_id === s.id && m.group_id === s.group_id)) {
      db.memberships.push({ user_id: s.user_id || null, student_id: s.id, group_id: s.group_id }); changed = true;
    }
  });

  if (!db.teacher_groups) {
    // المعلم الافتراضي مسؤول عن الأفواج الثلاثة الأولى فقط؛ فوج التميز خارج نطاقه عمدًا لاختبار العزل.
    const ids = ['g1', 'g2', 'g3'].filter(id => db.groups.some(g => g.id === id));
    db.teacher_groups = db.users.filter(u => u.role === 'teacher').flatMap(u => ids.map(g => ({ teacher_id: u.id, group_id: g })));
    changed = true;
  }
  const testSubject = { t1: 'sub1', t2: 'sub2', t3: 'sub3' };
  db.tests.forEach(t => { set(t, 'subject_id', testSubject[t.id] || null); set(t, 'description', ''); set(t, 'created_by', null); set(t, 'type', 'understand'); });
  db.subjects.forEach(x => { set(x,'learning_mode', x.classification || 'understand'); set(x,'study_method', 'فهم ثم مراجعة وتطبيق عند الحاجة'); });
  db.lessons.forEach(x => { set(x,'learning_mode', (db.subjects.find(s=>s.id===x.subject_id)||{}).learning_mode || 'understand'); set(x,'study_method', 'اقرأ، افهم، لخّص، ثم راجع حسب طبيعة المادة'); });
  db.lessons.forEach(x => { if (!x.content || typeof x.content !== 'object') x.content={}; const c=x.content; set(c,'opening',''); set(c,'ayahs',[]); set(c,'hadiths',[]); set(c,'story',''); set(c,'explanation',x.description||''); set(c,'examples',[]); set(c,'reflection_questions',[]); set(c,'action',''); set(c,'memorize',''); set(c,'review',''); set(c,'source_notes',''); set(c,'source_status','draft'); });
  db.teacher_notes.forEach(n => {
    set(n, 'shared', n.category !== 'سلوكي');
    set(n, 'teacher_name', (db.users.find(u => u.id === n.teacher_id) || {}).name || '');
  });
  db.notifications.forEach(n => { set(n, 'group_id', null); set(n, 'read_by', []); });
  set(db, 'report_settings', { late_weight: 0.75, excused_counts_as_absence: false });
  // V56: add missing starter curriculum and practice questions without overwriting existing records.
  const educationalSeed = seedEducationalContent(db);
  if (educationalSeed.changed) changed = true;
  if (changed) save();
}
const storageReady = Promise.resolve(storage.load()).then(async loaded => { db = loaded; migrate(); if (storage.kind === 'postgres') await storage.save(db); return db; });
// Mark the startup promise as handled even in redirect-only mode, where the database is intentionally bypassed.
void storageReady.catch(() => {});

/* ───────────── الصلاحيات والنطاق ───────────── */
const isStaff = u => u.role === 'admin' || u.role === 'teacher';
const teacherGroupIds = u => db.teacher_groups.filter(x => x.teacher_id === u.id).map(x => x.group_id);
// العضويات هي المصدر الأساسي؛ group_id احتياطي لسجلات الطلبة القديمة التي لم تُنشأ لها عضوية بعد.
const studentGroupIds = s => {
  if (!s) return [];
  const memberships = [...new Set(db.memberships.filter(m => m.student_id === s.id).map(m => m.group_id))]
    .filter(id => db.groups.some(g => g.id === id));
  if (memberships.length) return memberships;
  return s.group_id && db.groups.some(g => g.id === s.group_id) ? [s.group_id] : [];
};

function scopedStudents(u) {
  if (u.role === 'admin') return db.students;
  if (u.role === 'teacher') { const g = teacherGroupIds(u); return db.students.filter(s => studentGroupIds(s).some(x => g.includes(x))); }
  if (u.role === 'student') return db.students.filter(s => s.user_id === u.id);
  if (u.role === 'parent') return db.students.filter(s => s.parent_id === u.id);
  return [];
}
function visibleGroupIds(u) {
  if (u.role === 'admin') return db.groups.map(g => g.id);
  if (u.role === 'teacher') return teacherGroupIds(u);
  return [...new Set(scopedStudents(u).flatMap(studentGroupIds))];
}
const canView = (u, s) => scopedStudents(u).some(x => x.id === s.id);
const canEdit = (u, s) => isStaff(u) && canView(u, s);
const ownsGroup = (u, gid) => db.groups.some(g => g.id === gid) && (u.role === 'admin' || teacherGroupIds(u).includes(gid));
const studentForUser = u => u.role === 'student' ? db.students.find(s => s.user_id === u.id) : null;
const hasMembership = (sid, gid) => db.memberships.some(m => m.student_id === sid && m.group_id === gid);
const addMembership = (sid, gid) => { if (!hasMembership(sid, gid)) { const s=db.students.find(x=>x.id===sid); db.memberships.push({ user_id:s?.user_id||null, student_id:sid, group_id:gid }); } };
const removeMembership = (sid, gid) => { db.memberships = db.memberships.filter(m => !(m.student_id===sid && m.group_id===gid)); };
const subjectIsOptional = sid => { const s=db.subjects.find(x=>x.id===sid); return !!s && s.required===false; };
const studentHasOptional = (sid,sid2) => db.optional_enrollments.some(x=>x.student_id===sid && x.subject_id===sid2 && x.status!=='withdrawn');
const requireStaff = u => { if (!isStaff(u)) fail(403, 'غير مسموح'); };
function getStudent(u, id, write = false) {
  const s = db.students.find(x => x.id === id);
  // نفس الرد للحالتين (غير موجود / خارج النطاق) حتى لا نكشف وجود طلاب آخرين
  if (!s || !(write ? canEdit(u, s) : canView(u, s))) fail(write ? 403 : 404, write ? 'هذا الطالب خارج نطاقك' : 'غير موجود');
  return s;
}
const safeUser = u => ({ id: u.id, name: u.name, email: String(u.email||'').endsWith('@no-email.invalid') ? '' : u.email, role: u.role, role_label: ((db?.schools||[]).some(sc=>sc.director_user_id===u.id) || (db?.school_staff||[]).some(x=>x.user_id===u.id&&x.role==='director')) ? 'مدير المدرسة' : ({admin:'مدير الأكاديمية',teacher:'الشيخ / المعلم',student:'الطالب',parent:'ولي الأمر',chief_supervisor:'المشرف الرئيسي'}[u.role]||u.role), font_scale: Number(u.font_scale)||1, high_contrast: !!u.high_contrast, reduced_motion: !!u.reduced_motion, theme: ['emerald','sand','indigo','olive'].includes(u.theme) ? u.theme : 'emerald' });

/* ───────────── الحضور والتقارير ───────────── */
function attStats(recs) {
  const c = { present: 0, late: 0, absent: 0, excused: 0 };
  recs.forEach(r => { if (c[r.status] !== undefined) c[r.status]++; });
  const w = db.report_settings;
  const counted = c.present + c.late + c.absent + (w.excused_counts_as_absence ? c.excused : 0);
  const rate = counted ? Math.round((c.present + c.late * w.late_weight) / counted * 100) : null;
  return { ...c, total: recs.length, counted, rate };
}
// الحضور المستورد أسبوعيًا لا يحتوي تواريخ فردية، لذلك لا نحوّله إلى أحداث يومية وهمية.
// نستخدمه كطبقة تجميعية عند غياب السجل التفصيلي، ونُبقي مصدره واضحًا في ملف الطالب.
function weeklyAttendanceStats(rows) {
  const c = { present: 0, late: 0, absent: 0, excused: 0 };
  rows.forEach(r => {
    c.present += Number(r.present) || 0;
    c.late += Number(r.late) || 0;
    c.absent += Number(r.absent) || 0;
    c.excused += Number(r.excused) || 0;
  });
  const w = db.report_settings;
  const counted = c.present + c.late + c.absent + (w.excused_counts_as_absence ? c.excused : 0);
  const rate = counted ? Math.round((c.present + c.late * w.late_weight) / counted * 100) : null;
  return { ...c, total: rows.length, counted, rate, source: 'weekly_aggregate' };
}
function weeklyAttendanceRows(studentId, start, end) {
  return (db.attendance_weekly || []).filter(r => r.student_id === studentId && (!start || r.end >= start) && (!end || r.start <= end));
}
function attendanceForStudent(studentId, start = '', end = '') {
  const raw = db.attendance.filter(a => a.student_id === studentId && (!start || a.date >= start) && (!end || a.date <= end));
  if (raw.length) return { summary: attStats(raw), records: raw.sort((a, b) => b.date.localeCompare(a.date)), weekly: [] };
  const weekly = weeklyAttendanceRows(studentId, start, end);
  return { summary: weekly.length ? weeklyAttendanceStats(weekly) : attStats([]), records: [], weekly };
}
function studentView(s, user) {
  const raw = db.attendance.filter(a => a.student_id === s.id);
  const st = raw.length ? attStats(raw) : weeklyAttendanceStats(db.attendance_weekly?.filter(x => x.student_id === s.id) || []);
  const groups = studentGroupIds(s).map(id => db.groups.find(g => g.id === id)).filter(Boolean).map(g => ({ id: g.id, name: g.name }));
  const o = { ...s, attendance_rate: st.rate == null ? s.attendance_rate : st.rate, groups, demo: !!s.demo, school_id: s.school_id || null };
  if (!isStaff(user)) { delete o.user_id; delete o.parent_id; }
  return o;
}
function notesFor(user, studentIds) {
  let list = db.teacher_notes.filter(n => studentIds.includes(n.student_id));
  if (!isStaff(user)) list = list.filter(n => n.shared); // الطالب وولي الأمر يرون المشارَك فقط
  return list.map(n => ({ ...n, student_name: (db.students.find(s => s.id === n.student_id) || {}).name || '' }))
    .sort((a, b) => (b.date + b.id).localeCompare(a.date + a.id));
}
function monthMetrics(s, month) {
  const inM = d => typeof d === 'string' && d.startsWith(month);
  const rawMonth = db.attendance.filter(a => a.student_id === s.id && inM(a.date));
  const weeklyMonth = weeklyAttendanceRows(s.id, `${month}-01`, `${month}-31`);
  const att = rawMonth.length ? attStats(rawMonth) : (weeklyMonth.length ? weeklyAttendanceStats(weeklyMonth) : attStats([]));
  const gids = studentGroupIds(s);
  const testsM = db.tests.filter(t => gids.includes(t.group_id) && inM(t.date));
  const items = testsM.map(t => {
    const g = db.grades.find(x => x.test_id === t.id && x.student_id === s.id);
    return g ? { title: t.title, date: t.date, score: g.score, max: t.max_score, pct: Math.round(g.score / t.max_score * 100) } : null;
  }).filter(Boolean);
  const avg = items.length ? Math.round(mean(items.map(i => i.pct))) : null;
  return { att, grades: { tests_in_month: testsM.length, count: items.length, average: avg, items } };
}
function computeMonthly(user, s, month) {
  const today = localISO();
  const cur = monthMetrics(s, month), prev = monthMetrics(s, prevMonth(month));
  const mem = db.memorization.filter(m => m.student_id === s.id);
  const goals = db.goals.filter(g => g.student_id === s.id && g.status === 'active');
  const notes = notesFor(user, [s.id]).filter(n => n.date.startsWith(month));
  const byCat = {}; notes.forEach(n => { byCat[n.category] = (byCat[n.category] || 0) + 1; });
  const m = {
    month, month_label: monthLabel(month),
    attendance: cur.att,
    grades: cur.grades,
    memorization: {
      items: mem.length, memorized: mem.filter(x => x.status === 'memorized').length,
      mastery: mem.length ? Math.round(mean(mem.map(x => x.mastery))) : null,
      due: mem.filter(x => x.next_review_at && x.next_review_at <= today).length
    },
    goals: { count: goals.length, progress: goals.length ? Math.round(mean(goals.map(g => g.progress))) : null },
    notes: { count: notes.length, shared_count: notes.filter(n => n.shared).length, by_category: byCat, items: notes.slice(0, 5).map(n => ({ date: n.date, category: n.category, text: n.text, teacher_name: n.teacher_name, shared: !!n.shared })) },
    compared: {
      prev_month: prevMonth(month), prev_label: monthLabel(prevMonth(month)),
      attendance_delta: cur.att.rate != null && prev.att.rate != null ? cur.att.rate - prev.att.rate : null,
      average_delta: cur.grades.average != null && prev.grades.average != null ? cur.grades.average - prev.grades.average : null
    }
  };
  const { strengths, improvements } = strengthsAndGaps(m);
  m.strengths = strengths; m.improvements = improvements;
  m.summary = buildSummary(s.name, m);
  return m;
}
function strengthsAndGaps(m) {
  const S = [], I = [], a = m.attendance, g = m.grades, me = m.memorization, go = m.goals, c = m.compared;
  if (a.rate != null) {
    if (a.rate >= 90) S.push('التزام ممتاز بالحضور');
    else if (a.rate < 75) I.push('الحضور يحتاج إلى انتظام أكبر');
    if (a.late >= 2) I.push('تكرر التأخر هذا الشهر');
    if (a.absent >= 2) I.push('تكرر الغياب دون عذر مسجل');
  } else I.push('لم يُسجَّل حضور هذا الشهر');
  if (g.average != null) {
    if (g.average >= 85) S.push('مستوى مرتفع في الاختبارات');
    else if (g.average >= 70) S.push('مستوى جيد في الاختبارات');
    else if (g.average < 60) I.push('نتائج الاختبارات تحتاج إلى دعم ومراجعة');
  }
  if (me.mastery != null) {
    if (me.mastery >= 80) S.push('إتقان جيد للمحفوظ');
    else if (me.mastery < 60) I.push('تثبيت المحفوظ يحتاج مراجعة أقرب');
    if (me.due > 0) I.push(`توجد مراجعات مستحقة (${me.due})`);
  }
  if (go.progress != null) {
    if (go.progress >= 75) S.push('تقدم واضح في الأهداف');
    else if (go.progress < 50) I.push('الأهداف تحتاج إلى خطوات أصغر وأوضح');
  }
  if (c.attendance_delta > 0) S.push('تحسّن الحضور عن الشهر الماضي');
  if (c.average_delta > 0) S.push('تحسّنت الدرجات عن الشهر الماضي');
  if (c.attendance_delta < 0) I.push('انخفض الحضور عن الشهر الماضي');
  if (c.average_delta < 0) I.push('انخفضت الدرجات عن الشهر الماضي');
  if (!S.length && !I.length) I.push('لا توجد بيانات كافية لهذا الشهر بعد');
  return { strengths: S, improvements: I };
}
function buildSummary(name, m) {
  const p = [`هذا ملخص شهر ${m.month_label} للطالب ${name}.`];
  const a = m.attendance;
  if (a.rate == null) p.push('لم يُسجَّل حضور هذا الشهر بعد.');
  else {
    const q = a.rate >= 90 ? 'والتزامه ممتاز' : a.rate >= 75 ? 'وحضوره جيد مع مجال للانتظام' : 'وهي نسبة تحتاج إلى متابعة لطيفة لمعرفة سبب الغياب أو التأخر';
    p.push(`بلغت نسبة الحضور ${a.rate}% (أيام الحضور: ${a.present}، التأخر: ${a.late}، الغياب: ${a.absent}${a.excused ? `، الغياب بعذر: ${a.excused}` : ''})، ${q}.`);
  }
  if (m.grades.average != null) p.push(`بلغ متوسط درجاته ${m.grades.average}% في ${m.grades.count} اختبار مسجَّل.`);
  else if (m.grades.tests_in_month) p.push('توجد اختبارات هذا الشهر لم تُرصد درجاتها بعد.');
  if (m.memorization.mastery != null) p.push(`إتقان المحفوظ ${m.memorization.mastery}%${m.memorization.due ? `، ويوجد ${m.memorization.due} من المراجعات المستحقة` : ''}.`);
  if (m.goals.progress != null) p.push(`متوسط التقدم في الأهداف ${m.goals.progress}%.`);
  const c = m.compared;
  const cmp = [];
  if (c.attendance_delta != null && c.attendance_delta !== 0) cmp.push(`الحضور ${c.attendance_delta > 0 ? 'ارتفع' : 'انخفض'} ${Math.abs(c.attendance_delta)} نقطة`);
  if (c.average_delta != null && c.average_delta !== 0) cmp.push(`الدرجات ${c.average_delta > 0 ? 'ارتفعت' : 'انخفضت'} ${Math.abs(c.average_delta)} نقطة`);
  if (cmp.length) p.push(`مقارنةً بنفسه في ${c.prev_label}: ${cmp.join('، و')}.`);
  if (m.notes.shared_count) p.push(`عدد ملاحظات المعلم المشاركة هذا الشهر: ${m.notes.shared_count}.`);
  p.push(m.improvements.length && m.improvements[0] !== 'لا توجد بيانات كافية لهذا الشهر بعد'
    ? `الخطوة المقترحة للشهر القادم: ${m.improvements[0]}، بخطوة صغيرة وثابتة دون إرهاق.`
    : 'نوصي بالاستمرار على نفس الوتيرة الهادئة.');
  return p.join(' ');
}

/* ───────────── الاختبارات والدرجات ───────────── */
const testsFor = user => { const g = visibleGroupIds(user); return db.tests.filter(t => user.role === 'admin' || g.includes(t.group_id)); };
function enrichTest(t, user) {
  const subj = db.subjects.find(s => s.id === t.subject_id), grp = db.groups.find(g => g.id === t.group_id);
  const term = db.terms.find(x => x.id === t.term_id); const o = { ...t, subject_name: subj ? subj.name : null, group_name: grp ? grp.name : null, term_name: term ? term.name : null };
  if (isStaff(user)) {
    const roster = db.students.filter(s => studentGroupIds(s).includes(t.group_id));
    o.roster_count = roster.length;
    o.graded_count = db.grades.filter(g => g.test_id === t.id && roster.some(s => s.id === g.student_id)).length;
  } else {
    o.my_grades = scopedStudents(user).filter(s => studentGroupIds(s).includes(t.group_id)).map(s => {
      const g = db.grades.find(x => x.test_id === t.id && x.student_id === s.id);
      return { student_id: s.id, student_name: s.name, score: g ? g.score : null, note: g ? g.note : '' };
    });
  }
  return o;
}
function getTestForStaff(user, id) {
  const t = db.tests.find(x => x.id === id);
  if (!t || !(user.role === 'admin' || teacherGroupIds(user).includes(t.group_id))) fail(404, 'الاختبار غير موجود');
  return t;
}
function parseScore(v, max) {
  const n = Number(v);
  if (v === '' || v == null || !Number.isFinite(n) || n < 0 || n > max) return null;
  return Math.round(n * 100) / 100;
}
function upsertGrade(test, studentId, score, note, user) {
  let g = db.grades.find(x => x.test_id === test.id && x.student_id === studentId);
  if (g) Object.assign(g, { score, max_score: test.max_score, note, recorded_by: user.id, updated_at: new Date().toISOString() });
  else { g = { id: uid('gr'), test_id: test.id, student_id: studentId, score, max_score: test.max_score, note, recorded_by: user.id }; db.grades.push(g); }
  return g;
}
function upsertAttendance(studentId, date, status, note, user) {
  let r = db.attendance.find(a => a.student_id === studentId && a.date === date);
  if (r) Object.assign(r, { status, note, recorded_by: user.id, updated_at: new Date().toISOString() });
  else { r = { id: uid('a'), student_id: studentId, date, term_id: termForDate(date)?.id || null, status, note, recorded_by: user.id }; db.attendance.push(r); }
  if (r && !r.term_id) { const tr = termForDate(date); if (tr) r.term_id = tr.id; }
  return r;
}
const ATT_STATUS = ['present', 'late', 'absent', 'excused'];
const NOTE_CATS = ['تعليمي', 'سلوكي', 'تحفيزي', 'متابعة'];
function checkAttDate(date) {
  if (!isDate(date)) fail(400, 'تاريخ غير صحيح');
  if (date > addDays(localISO(), 1)) fail(400, 'لا يمكن تسجيل الحضور لتاريخ في المستقبل');
}

function weeklyAttendanceFromRaw(studentId, start, end) {
  const rows = db.attendance.filter(a => a.student_id === studentId && a.date >= start && a.date <= end);
  const stats = attStats(rows);
  return { present: stats.present, late: stats.late, absent: stats.absent, excused: stats.excused, source: 'attendance_records' };
}
function attendanceAdvice(row) {
  const a = row.absent || 0, p = row.present || 0, l = row.late || 0;
  if (a >= 3) return {
    priority: 'متابعة مهمة',
    comment: `لم يحضر ${a} مرات مسجلة هذا الأسبوع${p ? `، وحضر ${p} مرة` : ''}.`,
    advice: 'لا تُثقل عليه بالعتاب؛ تواصل معه أو مع ولي أمره لمعرفة السبب، ثم ضع خطوة صغيرة واضحة للعودة إلى الانتظام.'
  };
  if (a === 2) return {
    priority: 'متابعة',
    comment: `سُجّل عليه غيابان هذا الأسبوع${p ? `، مع حضور ${p} مرة` : ''}.`,
    advice: 'يستحسن سؤال الطالب عن العائق بهدوء، ثم تذكيره بموعد الحلقة ومساعدته على تثبيت الحضور.'
  };
  if (a === 1) return {
    priority: 'تنبيه لطيف',
    comment: `سُجّل غياب واحد هذا الأسبوع${p ? `، وحضر ${p} مرة` : ''}.`,
    advice: 'تنبيه لطيف يكفي ما لم يتكرر الأمر؛ لا حاجة لتحويل الغياب الواحد إلى ضغط أو حكم على الطالب.'
  };
  if (p === 0 && l === 0) return {
    priority: 'يحتاج بيانات',
    comment: 'لا توجد حالة حضور مسجلة في هذا الملخص.',
    advice: 'تحقق من التسجيل قبل التواصل مع الطالب حتى لا يُبنى الحكم على بيانات ناقصة.'
  };
  return {
    priority: 'مطمئن',
    comment: `حضر ${p} مرة ولم يُسجل عليه غياب في هذا الملخص.`,
    advice: 'استمر على هذا النسق، ومع الحضور الجيد يمكن الاكتفاء بالتشجيع والمتابعة الخفيفة.'
  };
}
function buildWeeklyAttendanceReport(user, start, end, groupId = '') {
  if (!isDate(start) || !isDate(end) || start > end) fail(400, 'الفترة الأسبوعية غير صحيحة');
  const scoped = scopedStudents(user);
  const ids = new Set(scoped.filter(s => !groupId || studentGroupIds(s).includes(groupId)).map(s => s.id));
  if (groupId && !ownsGroup(user, groupId)) fail(403, 'هذا الفوج خارج نطاقك');
  const rows = [...ids].map(id => {
    const s = db.students.find(x => x.id === id);
    const imported = db.attendance_weekly.find(x => x.student_id === id && x.start === start && x.end === end);
    const raw = imported ? imported : weeklyAttendanceFromRaw(id, start, end);
    const a = { present: Number(raw.present)||0, late: Number(raw.late)||0, absent: Number(raw.absent)||0, excused: Number(raw.excused)||0 };
    const advice = attendanceAdvice(a);
    return { student_id:id, name:s.name, demo:!!s.demo, school_id:s.school_id||null, group_names:studentGroupIds(s).map(g=>db.groups.find(x=>x.id===g)?.name).filter(Boolean), ...a, ...advice, source:raw.source||'manual' };
  }).sort((a,b) => (b.absent-a.absent) || a.name.localeCompare(b.name,'ar'));
  const followup = rows.filter(x => x.absent >= 2 && !x.demo);
  const real = rows.filter(x => !x.demo);
  return {
    period:{start,end,label:`${start} — ${end}`},
    generated_at:new Date().toISOString(),
    totals:{students:rows.length,real_students:real.length,demo_students:rows.filter(x=>x.demo).length,followup_count:followup.length,absent_events:rows.reduce((n,x)=>n+x.absent,0),present_events:rows.reduce((n,x)=>n+x.present,0)},
    rows,
    followup:followup.map(x=>({student_id:x.student_id,name:x.name,absent:x.absent,comment:x.comment,advice:x.advice}))
  };
}

/* ───────────── ملف الطالب (المركز) ───────────── */
function buildFile(user, s, month) {
  const gids = studentGroupIds(s), subj = id => (db.subjects.find(x => x.id === id) || {}).name || '';
  const gname = id => (db.groups.find(g => g.id === id) || {}).name || '';
  const today = localISO();
  const attendance = attendanceForStudent(s.id);
  const mem = db.memorization.filter(m => m.student_id === s.id).map(m => ({ ...m, subject_name: subj(m.subject_id), due: !!m.next_review_at && m.next_review_at <= today }));
  return {
    student: studentView(s, user),
    can_edit: canEdit(user, s),
    attendance: { summary: attendance.summary, records: attendance.records.slice(0, 60), weekly: attendance.weekly },
    curriculum: db.schedule.filter(x => !x.group_id || gids.includes(x.group_id)).map(x => ({
      day: x.day, time: x.time, type: x.type, group_name: x.group_id ? gname(x.group_id) : 'الجميع',
      subject_name: subj(x.subject_id), lesson_title: (db.lessons.find(l => l.id === x.lesson_id) || {}).title || ''
    })),
    memorization: mem,
    review: { intervals_days: (db.review_settings || {}).intervals_days || [1, 3, 7, 14, 30], items: mem.filter(m => m.next_review_at).sort((a, b) => a.next_review_at.localeCompare(b.next_review_at)) },
    tests: db.tests.filter(t => gids.includes(t.group_id)).sort((a, b) => b.date.localeCompare(a.date)).map(t => {
      const g = db.grades.find(x => x.test_id === t.id && x.student_id === s.id);
      return { id: t.id, title: t.title, date: t.date, max_score: t.max_score, subject_name: subj(t.subject_id), group_name: gname(t.group_id), grade: g ? { score: g.score, note: g.note } : null };
    }),
    goals: db.goals.filter(g => g.student_id === s.id),
    notes: notesFor(user, [s.id]),
    reports: db.reports.filter(r => r.student_id === s.id).sort((a, b) => b.period.localeCompare(a.period)),
    monthly: computeMonthly(user, s, month)
  };
}

/* ───────────── HTTP ───────────── */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8' };
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self' http: https: blob:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'";
function send(res, status, data, type = 'application/json; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY', 'Content-Security-Policy': CSP, 'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()', 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Resource-Policy': 'same-origin', ...(res.socket && res.socket.encrypted ? {'Strict-Transport-Security':'max-age=31536000; includeSubDomains'} : {})
  });
  res.end(typeof data === 'string' || Buffer.isBuffer(data) ? data : JSON.stringify(data));
}
const json = (res, status, obj) => send(res, status, obj);
function body(req) {
  return new Promise((resolve, reject) => {
    let b = '', over = false;
    req.on('data', c => { if (over) return; b += c; if (b.length > 18e6) { over = true; reject(new HttpError(413, 'الحجم كبير جدًا')); } });
    req.on('end', () => { if (over) return; try { resolve(b ? JSON.parse(b) : {}); } catch { reject(new HttpError(400, 'صيغة البيانات غير صحيحة')); } });
    req.on('error', reject);
  });
}
function parseCookies(req) { const out={}; for(const part of String(req.headers.cookie||'').split(';')){const i=part.indexOf('=');if(i>0)out[part.slice(0,i).trim()]=decodeURIComponent(part.slice(i+1).trim())} return out; }
function cookie(name,value,opts={}) { const a=[`${name}=${encodeURIComponent(value)}`,`Path=${opts.path||'/'}`,`SameSite=${opts.sameSite||'Lax'}`]; if(opts.maxAge!=null)a.push(`Max-Age=${opts.maxAge}`); if(opts.httpOnly)a.push('HttpOnly'); if(opts.secure)a.push('Secure'); return a.join('; '); }
function setAuthCookies(res,token) { const csrf=crypto.randomBytes(24).toString('hex'); csrfTokens.set(csrf,Date.now()+SESSION_TTL); const max=Math.floor(SESSION_TTL/1000); res.setHeader('Set-Cookie',[cookie(COOKIE_NAME,token,{secure:COOKIE_SECURE,httpOnly:true,maxAge:max}),cookie(CSRF_COOKIE,csrf,{secure:COOKIE_SECURE,httpOnly:false,maxAge:max})]); }
function clearAuthCookies(res) { res.setHeader('Set-Cookie',[cookie(COOKIE_NAME,'',{secure:COOKIE_SECURE,httpOnly:true,maxAge:0}),cookie(CSRF_COOKIE,'',{secure:COOKIE_SECURE,maxAge:0})]); }
function authToken(req) { const h=req.headers.authorization||''; if(h.startsWith('Bearer ')) return {token:h.slice(7),source:'bearer'}; const c=parseCookies(req); return c[COOKIE_NAME]?{token:c[COOKIE_NAME],source:'cookie'}:null; }
function authUser(req) { const a=authToken(req); if(!a)return null; const s=sessions.get(a.token); if(!s)return null; if(s.exp<Date.now()){sessions.delete(a.token);return null;} req.authSource=a.source; req.sessionToken=a.token; return db.users.find(u=>u.id===s.uid)||null; }
function requireCsrf(req) { if(req.authSource!=='cookie' || ['GET','HEAD','OPTIONS'].includes(req.method)) return; const c=parseCookies(req), token=req.headers['x-csrf-token']; if(!token || token!==c[CSRF_COOKIE] || !csrfTokens.has(token) || csrfTokens.get(token)<Date.now()) fail(403,'رمز الحماية CSRF غير صالح'); }

function route(req, p, method, pattern) {
  if (req.method !== method) return null;
  const names = [];
  const re = new RegExp('^' + pattern.replace(/:([a-z_]+)/g, (_, n) => { names.push(n); return '([^/]+)'; }) + '$');
  const m = re.exec(p);
  if (!m) return null;
  const o = {}; names.forEach((n, i) => { o[n] = decodeURIComponent(m[i + 1]); });
  return o;
}
function teamById(id) { return db.teams.find(t => t.id === id); }
function teamStudentIds(team) { return [...new Set(db.team_members.filter(x => x.team_id === team.id).map(x => x.student_id))]; }
function teamSupervisorIds(team) { return [...new Set(db.team_supervisors.filter(x => x.team_id === team.id).map(x => x.student_id))]; }
function teamVisibleTo(user, team) {
  if (!team || team.active === false) return false;
  if (user.role === 'admin' || user.role === 'chief_supervisor') return true;
  if (user.role === 'teacher') return teacherGroupIds(user).includes(team.group_id);
  const ids = teamStudentIds(team);
  if (user.role === 'student') { const s=studentForUser(user); return !!s && ids.includes(s.id); }
  if (user.role === 'parent') return scopedStudents(user).some(s => ids.includes(s.id));
  return false;
}
function teamCanManage(user, team) {
  if (!teamVisibleTo(user, team)) return false;
  if (user.role === 'admin' || user.role === 'chief_supervisor') return true;
  if (user.role === 'teacher') return teacherGroupIds(user).includes(team.group_id);
  if (user.role === 'student') { const s=studentForUser(user); return !!s && teamSupervisorIds(team).includes(s.id); }
  return false;
}
function teamView(team, user) {
  const members = teamStudentIds(team).map(id => db.students.find(s => s.id === id)).filter(Boolean).map(s => ({id:s.id,name:s.name,level:s.level||'',user_id:s.user_id||null}));
  const supervisors = teamSupervisorIds(team).map(id => db.students.find(s => s.id === id)).filter(Boolean).map(s => ({id:s.id,name:s.name}));
  const tasks = db.team_tasks.filter(t => t.team_id === team.id).sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))).map(t=>({...t,assigned_student_name:(db.students.find(s=>s.id===t.assigned_student_id)||{}).name||null}));
  return {...team,members,supervisors,tasks,can_manage:teamCanManage(user,team)};
}

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    const o = new URL(origin);
    const host = req.headers.host || '';
    return o.host === host;
  } catch { return false; }
}

function serveStatic(res, p) {
  let rel;
  try { rel = p === '/' ? 'index.html' : decodeURIComponent(p).replace(/^\/+/, ''); } catch { return send(res, 400, 'Bad request', 'text/plain'); }
  const fp = path.resolve(ROOT, rel);
  const ok = fp === path.join(ROOT, 'index.html') || fp === path.join(ROOT, 'offline.html') || fp === path.join(ROOT, 'privacy.html') || fp === path.join(ROOT, 'masjid-alrahma-rules.html') || fp === path.join(ROOT, 'manifest.json') || fp === path.join(ROOT, 'service-worker.js') || fp === path.join(ROOT, 'robots.txt') || fp === path.join(ROOT, 'sitemap.xml') || fp.startsWith(ASSETS + path.sep);
  if (!ok || !fs.existsSync(fp) || !fs.statSync(fp).isFile()) return send(res, 404, 'Not found', 'text/plain');
  send(res, 200, fs.readFileSync(fp), MIME[path.extname(fp)] || 'application/octet-stream');
}

async function login(req, res) {
  const b = await body(req);
  const identity = clean(b.identity !== undefined ? b.identity : b.email, 200).trim().toLowerCase(), key = (req.socket.remoteAddress || '') + '|' + identity;
  const f = loginFails.get(key);
  if (f && f.until > Date.now()) return json(res, 429, { error: 'محاولات كثيرة. حاول مرة أخرى بعد قليل.' });
  if (CONFIG.mode === 'cloud') return json(res, 503, { error: 'قاعدة السحابة لم تُربط بعد. ضع بيانات الاتصال في متغيرات البيئة.' });
  const u = coreRepo.findUserByEmail(identity) || db.users.find(x => String(x.name || '').trim().toLowerCase() === identity);
  const ok = verifyPassword(String(b.password || ''), u ? u.password : DUMMY_HASH) && !!u && u.active !== false;
  if (!ok) {
    let n = f ? f.n : 0; if (f && f.until && f.until <= Date.now()) n = 0;
    n++; loginFails.set(key, { n, until: n >= 5 ? Date.now() + 10 * 60000 : 0 });
    return json(res, 401, { error: 'الاسم واللقب أو البريد الإلكتروني أو كلمة المرور غير صحيحة' });
  }
  loginFails.delete(key);
  if (sessions.size >= MAX_SESSIONS) {
    const first = sessions.keys().next().value; if (first) sessions.delete(first);
  }
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { uid: u.id, exp: Date.now() + SESSION_TTL });
  audit(u, 'login'); save(); setAuthCookies(res, token);
  return json(res, 200, { token, user: safeUser(u), csrf_required: true });
}

async function handler(req, res) {
  try { await storageReady; } catch (e) {
    console.error('Storage initialization failed:', e && e.message ? e.message : e);
    return json(res, 503, { ok: false, error: 'تهيئة قاعدة البيانات غير مكتملة؛ حاول لاحقًا.' });
  }
  try { rateLimit(req); } catch(e) { return json(res,e.status||429,{error:e.message}); }
  db.app_metrics = Array.isArray(db.app_metrics) ? db.app_metrics : []; db.app_metrics.push({id:uid('mx'),path:new URL(req.url,'http://localhost').pathname,method:req.method,count:1,at:new Date().toISOString()}); if(db.app_metrics.length>5000) db.app_metrics.splice(0,db.app_metrics.length-5000);
  const u = new URL(req.url, 'http://localhost'), p = u.pathname, q = Object.fromEntries(u.searchParams);
  if (req.method === 'GET' && !p.startsWith('/api/')) return serveStatic(res, p);
  if (!p.startsWith('/api/')) return json(res, 404, { error: 'المسار غير موجود' });
  try {
    if (p === '/api/health' && req.method === 'GET') { const h=await storage.health(); return json(res, h.healthy && !lastPersistenceError ? 200 : 503, { ok:h.healthy && !lastPersistenceError, version:APP_VERSION, storage:h.kind, storage_healthy:h.healthy, persistence_error:lastPersistenceError?lastPersistenceError.message:null, production:PRODUCTION, https_required:REQUIRE_HTTPS }); }
    if (p === '/api/privacy' && req.method === 'GET') return json(res,200,{title:'سياسة الخصوصية — أكاديمية الإحسان في بناء الإنسان',version:'V41',updated_at:'2026-10-08',principles:['نجمع أقل قدر لازم للتعليم والإدارة.','لا نبيع البيانات الشخصية ولا نشاركها للإعلانات.','الصلاحيات تحدد ما يراه كل مستخدم.','السجلات الحساسة تُحفظ في الخادم ولا تُرسل إلا عند الحاجة.'],data_types:['الحساب وبيانات التواصل','السجل التعليمي والحضور والدرجات','السجل القرآني والتقارير','الرسائل والملاحظات التعليمية','سجل العمليات الأمنية'],retention:'تحتفظ الأكاديمية بالبيانات ما دامت لازمة للغرض التعليمي أو النظامي، ثم تُؤرشف أو تُحذف وفق سياسة الإدارة.',rights:['طلب الوصول إلى البيانات','طلب تصحيح البيانات','طلب حذف البيانات عندما لا يوجد التزام تعليمي أو نظامي يمنع ذلك'],contact:(db.institution||{}).email||''});
    if (p === '/api/public/quran-schools' && req.method === 'GET') return json(res,200,db.quran_schools.filter(x=>x.active!==false).sort((a,b)=>(a.order||0)-(b.order||0)).map(x=>({id:x.id,name:x.name,description:x.description||'',school_id:x.school_id||null})));
    if (!sameOrigin(req)) return json(res, 403, { error: 'مصدر الطلب غير مسموح' });
    if (p === '/api/login' && req.method === 'POST') return await login(req, res);

    const user = authUser(req);
    if (!user) return json(res, 401, { error: 'غير مسجل الدخول' });
    requireCsrf(req);
    let r;

    if (p === '/api/logout' && req.method === 'POST') { if(req.sessionToken) sessions.delete(req.sessionToken); const c=parseCookies(req); if(c[CSRF_COOKIE]) csrfTokens.delete(c[CSRF_COOKIE]); audit(user, 'logout'); await save(); clearAuthCookies(res); return json(res, 200, { ok: true }); }
    if (p === '/api/me' && req.method === 'GET') return json(res, 200, safeUser(user));

    /* ═══════════ الإدارة العليا V23 ═══════════
       حساب المدير يملك صلاحيات النظام كاملة، لكن لا نعيد كلمات المرور أو الأسرار للواجهة. */
    const requireAdmin = () => { if (user.role !== 'admin') fail(403, 'هذه العملية متاحة لمدير الأكاديمية فقط'); };
    if (p === '/api/admin/health/storage' && req.method === 'GET') { requireAdmin(); const h=await storage.health(); return json(res, h.healthy ? 200 : 503, { version:APP_VERSION, mode:CONFIG.mode, storage:h, migration:{reversible:true, json_source:DATA} }); }
    const adminUserView = u => ({ id: u.id, name: u.name, email: String(u.email||'').endsWith('@no-email.invalid') ? '' : u.email, role: u.role, active: u.active !== false, created_at: u.created_at || null });
    const ALL_PERMISSIONS = {
      'dashboard:read':'لوحة التحكم', 'users:manage':'إدارة المستخدمين', 'roles:manage':'إدارة الصلاحيات',
      'groups:manage':'إدارة الأفواج', 'students:manage':'إدارة الطلاب', 'curriculum:manage':'إدارة المنهج',
      'attendance:manage':'إدارة الحضور', 'tests:manage':'إدارة الاختبارات', 'grades:manage':'إدارة الدرجات',
      'notes:manage':'إدارة الملاحظات', 'reports:manage':'إدارة التقارير', 'posts:manage':'إدارة المنشورات',
      'notifications:manage':'إدارة الإشعارات', 'audit:read':'سجل العمليات', 'backup:manage':'النسخ الاحتياطي',
      'settings:manage':'إعدادات النظام'
    };
    if (p === '/api/admin/overview' && req.method === 'GET') {
      requireAdmin();
      const storageStatus = await storage.health();
      const now = Date.now();
      const activeSessions = [...sessions.values()].filter(x => x.exp > now).length;
      const recent = db.audit_log.slice(0, 8).map(x => ({ ...x, user_name: (db.users.find(u => u.id === x.user_id) || {}).name || 'النظام' }));
      return json(res, 200, {
        version: APP_VERSION, mode: CONFIG.mode, node: process.version,
        users: db.users.length, active_users: db.users.filter(x => x.active !== false).length,
        students: db.students.length, groups: db.groups.length, subjects: db.subjects.length, lessons: db.lessons.length,
        active_sessions: activeSessions, audit_count: db.audit_log.length, db_bytes: storageStatus.bytes || 0, storage: storageStatus,
        permissions: Object.entries(ALL_PERMISSIONS).map(([id,label]) => ({id,label})), recent
      });
    }
    if (p === '/api/admin/schools' && req.method === 'GET') {
      requireAdmin();
      return json(res,200,db.schools.map(sc=>({
        ...sc,
        director:sc.director_user_id?adminUserView(db.users.find(u=>u.id===sc.director_user_id)||{}):null,
        groups:db.groups.filter(g=>g.school_id===sc.id).map(g=>({id:g.id,name:g.name,school_id:g.school_id||null}))
      })));
    }
    if (p === '/api/admin/schools' && req.method === 'POST') {
      requireAdmin();
      const b=await body(req),name=clean(b.name,160);
      if(name.length<2)fail(400,'اسم المدرسة مطلوب');
      if(db.schools.some(sc=>String(sc.name||'').trim().toLowerCase()===name.toLowerCase()))fail(409,'اسم المدرسة موجود بالفعل');
      const row={id:uid('sc'),name,description:clean(b.description,800),type:clean(b.type,40)||'quran',director_user_id:null,active:true,created_at:new Date().toISOString()};
      db.schools.push(row);audit(user,'school.create',{school_id:row.id});await save();return json(res,201,row);
    }
    if ((r=route(req,p,'POST','/api/admin/schools/:id/director'))) {
      requireAdmin();
      const school=db.schools.find(sc=>sc.id===r.id);if(!school)fail(404,'المدرسة غير موجودة');
      const b=await body(req),name=clean(b.name,120),email=clean(b.email,200).toLowerCase(),password=String(b.password||'');
      if(name.length<2||!/^\\S+@\\S+\\.\\S+$/.test(email)||password.length<8)fail(400,'أدخل اسم المدير وبريده وكلمة مرور مؤقتة لا تقل عن 8 أحرف');
      if(db.users.some(u=>String(u.email||'').toLowerCase()===email))fail(409,'البريد الإلكتروني مستخدم بالفعل');
      const groupIds=Array.isArray(b.group_ids)?[...new Set(b.group_ids.map(String))]:[];
      const selected=groupIds.map(id=>db.groups.find(g=>g.id===id)).filter(Boolean);
      if(selected.some(g=>g.school_id&&g.school_id!==school.id))fail(409,'أحد الأفواج مرتبط بمدرسة أخرى؛ لا يمكن نقله تلقائيًا');
      const previousDirectorId=school.director_user_id||null;
      const created=coreService.createUser({name,email,password,role:'teacher'});
      if(previousDirectorId){
        const schoolGroupIds=new Set(db.groups.filter(g=>g.school_id===school.id).map(g=>g.id));
        db.teacher_groups=db.teacher_groups.filter(x=>!(x.teacher_id===previousDirectorId&&schoolGroupIds.has(x.group_id)));
      }
      selected.forEach(g=>{g.school_id=school.id;if(!db.teacher_groups.some(x=>x.teacher_id===created.id&&x.group_id===g.id))db.teacher_groups.push({teacher_id:created.id,group_id:g.id});});
      school.director_user_id=created.id;
      db.school_staff=db.school_staff.filter(x=>!(x.school_id===school.id&&x.role==='director'));
      db.school_staff.push({id:uid('ss'),school_id:school.id,user_id:created.id,role:'director',created_at:new Date().toISOString()});
      audit(user,'school.director_assign',{school_id:school.id,user_id:created.id,group_ids:selected.map(g=>g.id)});
      await save();
      return json(res,201,{school_id:school.id,school_name:school.name,user:adminUserView(created),initial_password:password,group_ids:selected.map(g=>g.id)});
    }
    if (p === '/api/admin/platform-hierarchy' && req.method === 'GET') {
      requireAdmin();
      return json(res,200,{
        platform:{name:db.institution?.name||'أكاديمية الإحسان في بناء الإنسان',role:'المدير العام / المشرف العام'},
        schools:db.schools.map(sc=>({id:sc.id,name:sc.name,type:sc.type,description:sc.description,director:sc.director_user_id?adminUserView(db.users.find(u=>u.id===sc.director_user_id)||{}):null,groups:db.groups.filter(g=>g.school_id===sc.id).map(g=>({id:g.id,name:g.name,student_count:new Set(db.memberships.filter(m=>m.group_id===g.id).map(m=>m.student_id)).size,teachers:db.teacher_groups.filter(t=>t.group_id===g.id).map(t=>{const u=db.users.find(x=>x.id===t.teacher_id);return u?{id:u.id,name:u.name,role:u.role}:null}).filter(Boolean),teams:db.teams.filter(t=>t.group_id===g.id).map(t=>({id:t.id,name:t.name,supervisors:teamSupervisorIds(t).map(id=>(db.students.find(s=>s.id===id)||{}).name).filter(Boolean)}))}))}))
      });
    }
    if (p === '/api/school-directory' && req.method === 'GET') {
      const rows = db.users.filter(u => u.active !== false).map(u => {
        const student = db.students.find(st => st.user_id === u.id);
        const isTeamSupervisor = !!(student && (student.level === 'مشرف طالب' || db.team_supervisors.some(x => x.student_id === student.id)));
        const roleLabel = ((db.schools||[]).some(sc=>sc.director_user_id===u.id) || (db.school_staff||[]).some(x=>x.user_id===u.id&&x.role==='director')) ? 'مدير المدرسة' : u.role === 'admin' ? 'مدير الأكاديمية' : u.role === 'teacher' ? 'الشيخ / المعلم' : u.role === 'chief_supervisor' ? 'المشرف الرئيسي' : isTeamSupervisor ? 'مشرف فريق' : u.role === 'student' ? 'طالب' : 'ولي أمر';
        return { id:u.id, name:u.name, role:u.role, role_label:roleLabel, is_team_supervisor:isTeamSupervisor, active:true };
      });
      const rank = u => u.role === 'admin' ? 0 : u.role === 'teacher' && /جابر/i.test(u.name) ? 1 : u.role === 'teacher' && /عبد\\s*الصمد/i.test(u.name) ? 2 : u.role === 'chief_supervisor' ? 3 : u.is_team_supervisor ? 4 : u.role === 'teacher' ? 5 : u.role === 'student' ? 6 : 7;
      rows.sort((a,b) => rank(a)-rank(b) || String(a.name).localeCompare(String(b.name),'ar'));
      return json(res,200,rows);
    }
    if (p === '/api/admin/users' && req.method === 'GET') { requireAdmin(); return json(res, 200, coreRepo.allUsers().map(adminUserView)); }
    if (p === '/api/admin/users' && req.method === 'POST') {
      requireAdmin(); const b = await body(req);
      const name = clean(b.name, 120), suppliedEmail = clean(b.email, 200).toLowerCase(), role = clean(b.role, 20);
      const password = String(b.password || '');
      if (name.length < 2 || (suppliedEmail && !/^\S+@\S+\.\S+$/.test(suppliedEmail)) || (!suppliedEmail && role !== 'student') || (password.length < 8 && !(role === 'student' && !password)) || !['admin','teacher','student','parent','chief_supervisor'].includes(role)) fail(400, 'أدخل الاسم والبريد الصحيح إن وُجد وكلمة مرور مناسبة والدور');
      if (suppliedEmail && db.users.some(x => String(x.email).toLowerCase() === suppliedEmail)) fail(409, 'البريد مستخدم بالفعل');
      const email = suppliedEmail || ('student-' + uid('mail') + '@no-email.invalid');
      const initialPassword = password || crypto.randomBytes(18).toString('base64url');
      const nu = coreService.createUser({ name, email, password:initialPassword, role });
      if(role==='student'){
        const st={id:uid('s'),user_id:nu.id,parent_id:null,name,group_name:'',level:'المستوى الأساسي',attendance_rate:0,progress:0,memorized:'—',review:0,group_id:null}; db.students.push(st);
        const gids=Array.isArray(b.group_ids)?[...new Set(b.group_ids.filter(id=>db.groups.some(g=>g.id===id)))]:[]; gids.forEach(gid=>addMembership(st.id,gid)); st.group_id=gids[0]||null; st.group_name=gids[0]?((db.groups.find(g=>g.id===gids[0])||{}).name||''):'';
        if(clean(b.task_title,160)){ db.student_tasks.push({id:uid('task'),student_id:st.id,title:clean(b.task_title,160),description:clean(b.task_description,800),due_date:isDate(b.task_due)?b.task_due:null,status:'pending',created_by:user.id,created_at:new Date().toISOString()}); }
      }
      audit(user, 'admin.user_create', { id: nu.id, role }); await save(); return json(res, 201, { ...adminUserView(nu), initial_password: role === 'student' ? initialPassword : undefined, email_optional: role === 'student' && !suppliedEmail });
    }
    if ((r = route(req, p, 'PATCH', '/api/admin/users/:id'))) {
      requireAdmin(); const b = await body(req); const target = coreRepo.findUserById(r.id); if (!target) fail(404, 'المستخدم غير موجود');
      const oldRole = target.role;
      if (b.name !== undefined) { const name = clean(b.name, 120); if (name.length < 2) fail(400, 'الاسم قصير'); target.name = name; }
      if (b.email !== undefined) { const email = clean(b.email, 200).toLowerCase(); if (!/^\S+@\S+\.\S+$/.test(email)) fail(400, 'البريد غير صالح'); if (db.users.some(x => x.id !== target.id && String(x.email).toLowerCase() === email)) fail(409, 'البريد مستخدم بالفعل'); target.email = email; }
      if (b.role !== undefined) { if (!['admin','teacher','student','parent','chief_supervisor'].includes(b.role)) fail(400, 'الدور غير صالح'); target.role = b.role; }
      if (b.active !== undefined) { if (target.id === user.id && b.active === false) fail(400, 'لا يمكنك تعطيل حسابك الحالي'); target.active = !!b.active; }
      if (b.password !== undefined) { if (String(b.password).length < 8) fail(400, 'كلمة المرور يجب أن تكون 8 أحرف على الأقل'); target.password = hashPassword(String(b.password)); }
      audit(user, 'admin.user_update', { id: target.id, role_from: oldRole, role_to: target.role }); await save(); return json(res, 200, adminUserView(target));
    }
    if ((r = route(req, p, 'POST', '/api/admin/users/:id/reset-password'))) {
      requireAdmin(); const b = await body(req); const target = coreRepo.findUserById(r.id); if (!target) fail(404, 'المستخدم غير موجود');
      const password = String(b.password || ''); if (password.length < 8) fail(400, 'كلمة المرور يجب أن تكون 8 أحرف على الأقل'); target.password = hashPassword(password); target.active = true;
      audit(user, 'admin.password_reset', { id: target.id }); await save(); return json(res, 200, { ok: true });
    }
    if (p === '/api/admin/backup' && req.method === 'GET') {
      requireAdmin(); audit(user, 'admin.backup_export'); await save();
      res.statusCode = 200; res.setHeader('Content-Type','application/json; charset=utf-8'); res.setHeader('Content-Disposition','attachment; filename="academy-backup-v20.json"');
      return res.end(JSON.stringify(db, null, 2));
    }
    if (p === '/api/admin/settings' && req.method === 'GET') {
      requireAdmin(); return json(res, 200, { report_settings: db.report_settings || {}, session_ttl_hours: SESSION_TTL / 3600000, local_mode: CONFIG.mode !== 'cloud', storage: CONFIG.storage });
    }

    /* ═══════════ المدرسة القرآنية V23 ═══════════
       مسار مستقل داخل الأكاديمية: حفظ، تسميع، مراجعة، تجويد، وتقويم المعلم. */
    const quranScopedIds = () => scopedStudents(user).map(s => s.id);
    const quranStudent = (id, write=false) => getStudent(user, id, write);
    const quranSummary = s => {
      const ids = [s.id];
      const mem = db.memorization.filter(x => ids.includes(x.student_id) && x.subject_id === 'sub1');
      const sess = db.quran_sessions.filter(x => ids.includes(x.student_id));
      const evals = db.quran_evaluations.filter(x => ids.includes(x.student_id));
      const today = localISO();
      const due = mem.filter(x => x.next_review_at && x.next_review_at <= today).length;
      const reviews = db.quran_reviews.filter(x => x.student_id === s.id && x.status !== 'done');
      const plan = db.quran_plans.filter(x => x.student_id === s.id).sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)))[0] || null;
      const mastery = mem.length ? Math.round(mean(mem.map(x => Number(x.mastery)||0))) : null;
      const overall = evals.length ? Math.round(mean(evals.map(x => Number(x.overall)||0)) * 20) : null;
      return { student: studentView(s,user), memorization: mem, sessions: sess.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,20), evaluations: evals.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,10), due_reviews: due, pending_reviews: reviews.length, mastery, overall, total_sessions: sess.length, plan };
    };
    if (p === '/api/quran' && req.method === 'GET') {
      const ids = quranScopedIds();
      const students = scopedStudents(user).map(s => quranSummary(s));
      return json(res, 200, { levels: db.quran_levels, students, can_edit: isStaff(user) });
    }
    if (p === '/api/quran/halaqas' && req.method === 'GET') {
      const allowed = user.role === 'admin' ? db.groups.map(g=>g.id) : visibleGroupIds(user);
      return json(res,200,db.quran_halaqas.filter(h=>allowed.includes(h.group_id)).map(h=>({...h,group_name:(db.groups.find(g=>g.id===h.group_id)||{}).name||'',teacher_name:(db.users.find(u=>u.id===h.teacher_id)||{}).name||''})));
    }

    const quranHalaqa = (id, write=false) => {
      const h = db.quran_halaqas.find(x => x.id === id);
      if (!h) fail(404, 'الحلقة غير موجودة');
      if (user.role === 'admin') return h;
      if (user.role === 'teacher' && teacherGroupIds(user).includes(h.group_id) && h.teacher_id === user.id) return h;
      if (!write && visibleGroupIds(user).includes(h.group_id)) return h;
      fail(write ? 403 : 404, write ? 'الحلقة خارج نطاقك' : 'الحلقة غير موجودة');
    };
    const validTime = v => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
    const quranRoster = h => db.students.filter(s => studentGroupIds(s).includes(h.group_id));
    const quranPeriod = (date, kind='month') => {
      if (!isDate(date)) return null;
      if (kind === 'week') {
        const d = new Date(date+'T12:00:00'); const day=(d.getDay()+6)%7; d.setDate(d.getDate()-day);
        const start=localISO(d); d.setDate(d.getDate()+6); return {start,end:localISO(d)};
      }
      return {start:date.slice(0,7)+'-01',end:addDays(date.slice(0,7)+'-'+new Date(Number(date.slice(0,4)),Number(date.slice(5,7)),0).getDate(),0)};
    };
    const quranProgress = (s, start, end) => {
      const inP = x => x >= start && x <= end;
      const sessions=db.quran_sessions.filter(x=>x.student_id===s.id && inP(x.date));
      const reviews=db.quran_reviews.filter(x=>x.student_id===s.id && inP(x.due_date));
      const doneReviews=reviews.filter(x=>x.status==='done').length;
      const att=db.quran_attendance.filter(x=>x.student_id===s.id && inP(x.date));
      const evals=db.quran_evaluations.filter(x=>x.student_id===s.id && inP(x.date));
      const plans=db.quran_plans.filter(x=>x.student_id===s.id && inP(x.target_date));
      const mastered=plans.filter(x=>x.status==='completed').length;
      return {sessions:sessions.length, reviews:reviews.length, reviews_done:doneReviews, review_rate:reviews.length?Math.round(doneReviews/reviews.length*100):null, attendance:att.length, present:att.filter(x=>x.status==='present').length, attendance_rate:att.length?Math.round(att.filter(x=>x.status==='present').length/att.length*100):null, evaluations:evals.length, average_evaluation:evals.length?Math.round(mean(evals.map(x=>Number(x.overall)||0))*20):null, plans:plans.length, plans_completed:mastered, completion_rate:plans.length?Math.round(mastered/plans.length*100):null};
    };
    if (p === '/api/quran/halaqas' && req.method === 'PATCH') {
      requireStaff(user); const b=await body(req); const h=quranHalaqa(b.id,true);
      if (user.role==='teacher' && h.teacher_id!==user.id) fail(403,'تعديل الحلقة من صلاحية الشيخ المسؤول فقط');
      if (b.days!==undefined) h.days=clean(b.days,120);
      if (b.start_time!==undefined && b.start_time!=='' && !validTime(b.start_time)) fail(400,'وقت البداية غير صحيح');
      if (b.end_time!==undefined && b.end_time!=='' && !validTime(b.end_time)) fail(400,'وقت النهاية غير صحيح');
      if (b.start_time!==undefined) h.start_time=clean(b.start_time,5);
      if (b.end_time!==undefined) h.end_time=clean(b.end_time,5);
      if (b.name!==undefined) h.name=clean(b.name,120)||h.name;
      if (b.level!==undefined) h.level=clean(b.level,80)||h.level;
      audit(user,'quran.halaqa_update',{id:h.id}); await save(); return json(res,200,h);
    }
    if (p === '/api/quran/attendance/sheet' && req.method === 'GET') {
      const h=quranHalaqa(q.halaqa_id,false); const date=q.date||localISO(); if(!isDate(date)) fail(400,'التاريخ غير صحيح');
      const roster=quranRoster(h); return json(res,200,{halaqa:h,date,students:roster.map(s=>{const a=db.quran_attendance.find(x=>x.halaqa_id===h.id&&x.student_id===s.id&&x.date===date);return {id:s.id,name:s.name,status:a?.status||null,note:a?.note||''};})});
    }
    if (p === '/api/quran/attendance/bulk' && req.method === 'POST') {
      requireStaff(user); const b=await body(req); const h=quranHalaqa(b.halaqa_id,true); const date=b.date; if(!isDate(date)) fail(400,'التاريخ غير صحيح');
      if (date>localISO()) fail(400,'لا يمكن تسجيل حضور مستقبلي'); if(!Array.isArray(b.records)) fail(400,'سجلات الحضور غير صحيحة');
      const allowed=new Set(quranRoster(h).map(s=>s.id)); const statuses=['present','absent','late','excused'];
      for(const rec of b.records){ if(!allowed.has(rec.student_id)) fail(403,'طالب ليس من الحلقة'); if(!statuses.includes(rec.status)) fail(400,'حالة الحضور غير صحيحة'); }
      b.records.forEach(rec=>{let row=db.quran_attendance.find(x=>x.halaqa_id===h.id&&x.student_id===rec.student_id&&x.date===date); if(row){row.status=rec.status;row.note=clean(rec.note,300);row.recorded_by=user.id;}else{row={id:uid('qa'),halaqa_id:h.id,student_id:rec.student_id,date,status:rec.status,note:clean(rec.note,300),recorded_by:user.id};db.quran_attendance.push(row);}});
      audit(user,'quran.attendance_bulk',{halaqa_id:h.id,date,count:b.records.length}); await save(); return json(res,200,{ok:true,count:b.records.length});
    }
    if (p === '/api/quran/progress' && req.method === 'GET') {
      const st=quranStudent(q.student_id || (user.role==='student'?scopedStudents(user)[0]?.id:''),false); if(!st) fail(404,'الطالب غير موجود'); const date=isDate(q.date)?q.date:localISO(); const kind=q.period==='week'?'week':'month'; const per=quranPeriod(date,kind); return json(res,200,{student:studentView(st,user),period:{kind,date,...per},progress:quranProgress(st,per.start,per.end)});
    }
    if (p === '/api/quran/alerts' && req.method === 'GET') {
      const ids=new Set(scopedStudents(user).map(s=>s.id)); const today=localISO(); const alerts=[];
      db.quran_reviews.filter(x=>ids.has(x.student_id)&&x.status!=='done'&&x.due_date<=today).forEach(x=>alerts.push({type:'review_due',id:x.id,student_id:x.student_id,date:x.due_date,text:'مراجعة قرآنية مستحقة'}));
      db.quran_plans.filter(x=>ids.has(x.student_id)&&x.status==='planned'&&x.target_date<today).forEach(x=>alerts.push({type:'plan_overdue',id:x.id,student_id:x.student_id,date:x.target_date,text:'خطة حفظ متأخرة'}));
      return json(res,200,alerts.sort((a,b)=>String(a.date).localeCompare(String(b.date))).slice(0,100));
    }
    if (p === '/api/quran/reports' && req.method === 'GET') {
      const date=isDate(q.date)?q.date:localISO(); const kind=q.period==='week'?'week':'month'; const per=quranPeriod(date,kind); const list=scopedStudents(user).map(s=>({student:studentView(s,user),progress:quranProgress(s,per.start,per.end)})); return json(res,200,{period:{kind,date,...per},students:list});
    }
    if (p === '/api/quran/certificates' && req.method === 'POST') {
      if(user.role!=='admin') fail(403,'إصدار الشهادات من صلاحية الإدارة'); const b=await body(req); const st=db.students.find(s=>s.id===b.student_id); if(!st) fail(404,'الطالب غير موجود'); const level=db.quran_levels.find(x=>x.id===b.level_id || x.name===b.level); if(!level) fail(400,'المستوى غير موجود');
      const row={id:uid('qc'),student_id:st.id,level_id:level.id,level_name:level.name,certificate_no:'Q-'+Date.now().toString(36).toUpperCase()+'-'+crypto.randomBytes(3).toString('hex').toUpperCase(),date:isDate(b.date)?b.date:localISO(),note:clean(b.note,500),issued_by:user.id}; db.quran_certificates.unshift(row); audit(user,'quran.certificate_issue',{id:row.id,student_id:st.id}); await save(); return json(res,201,row);
    }
    if (p === '/api/quran/certificates' && req.method === 'GET') {
      const ids=new Set(scopedStudents(user).map(s=>s.id)); return json(res,200,db.quran_certificates.filter(x=>ids.has(x.student_id)).map(x=>({...x,student_name:(db.students.find(s=>s.id===x.student_id)||{}).name||''})));
    }
    if (p === '/api/quran/halaqas' && req.method === 'POST') {
      requireStaff(user); const b=await body(req); const group=db.groups.find(g=>g.id===b.group_id); if(!group) fail(400,'الفوج غير موجود');
      if(user.role==='teacher' && !teacherGroupIds(user).includes(group.id)) fail(403,'هذا الفوج خارج نطاقك');
      const teacherId=b.teacher_id || user.id; const teacher=db.users.find(u=>u.id===teacherId && u.active !== false && u.role==='teacher');
      if(!teacher) fail(400,'الشيخ غير صالح'); if(!teacherGroupIds(teacher).includes(group.id)) fail(400,'الشيخ لا يملك هذا الفوج');
      const row={id:uid('qh'),group_id:group.id,teacher_id:teacher.id,name:clean(b.name,120)||('حلقة '+group.name),level:clean(b.level,80)||'تمهيدي',days:clean(b.days,120),start_time:clean(b.start_time,10),end_time:clean(b.end_time,10),created_by:user.id};
      db.quran_halaqas.push(row); audit(user,'quran.halaqa_create',{id:row.id}); await save(); return json(res,201,row);
    }
    if (p === '/api/quran/plans' && req.method === 'POST') {
      requireStaff(user); const b=await body(req); const st=quranStudent(b.student_id,true); const target=b.target_date;
      if(!isDate(target)) fail(400,'تاريخ الخطة غير صحيح'); if(target<localISO()) fail(400,'لا يمكن إنشاء خطة بتاريخ منتهٍ');
      const amount=Math.max(1,Math.min(50,Number(b.pages)||1)); const fa=Number(b.from_ayah), ta=Number(b.to_ayah);
      if(!b.surah || !Number.isInteger(fa) || !Number.isInteger(ta) || fa<1 || ta<fa || ta>300) fail(400,'نطاق الآيات غير صحيح');
      const row={id:uid('qp'),student_id:st.id,teacher_id:user.id,target_date:target,surah:clean(b.surah,80),from_ayah:fa,to_ayah:ta,pages:amount,notes:clean(b.notes,800),status:'planned',created_at:new Date().toISOString()};
      db.quran_plans.push(row); audit(user,'quran.plan_create',{student_id:st.id}); await save(); return json(res,201,row);
    }
    if (p === '/api/quran/plans' && req.method === 'GET') {
      const st=quranStudent(q.student_id || (user.role==='student'?scopedStudents(user)[0]?.id:''),false); if(!st) fail(404,'الطالب غير موجود');
      return json(res,200,db.quran_plans.filter(x=>x.student_id===st.id).sort((a,b)=>String(a.target_date).localeCompare(String(b.target_date))).slice(0,100));
    }
    if (p === '/api/quran/reviews' && req.method === 'POST') {
      requireStaff(user); const b=await body(req); const st=quranStudent(b.student_id,true); if(!isDate(b.due_date)) fail(400,'موعد المراجعة غير صحيح');
      const fa=Number(b.from_ayah), ta=Number(b.to_ayah); if(!b.surah || !Number.isInteger(fa)||!Number.isInteger(ta)||fa<1||ta<fa||ta>300) fail(400,'نطاق الآيات غير صحيح');
      const row={id:uid('qr'),student_id:st.id,teacher_id:user.id,surah:clean(b.surah,80),from_ayah:fa,to_ayah:ta,due_date:b.due_date,status:'pending',notes:clean(b.notes,800),created_at:new Date().toISOString()};
      db.quran_reviews.push(row); audit(user,'quran.review_create',{student_id:st.id}); await save(); return json(res,201,row);
    }
    if (p.startsWith('/api/quran/reviews/') && p.endsWith('/complete') && req.method === 'POST') {
      const id=p.split('/')[4], x=db.quran_reviews.find(x=>x.id===id); if(!x) fail(404,'المراجعة غير موجودة'); const st=quranStudent(x.student_id,false);
      if(user.role==='student' && st.user_id!==user.id) fail(403,'هذه المراجعة ليست لك');
      if(user.role!=='student' && !canEdit(user,st)) fail(403,'خارج نطاقك'); x.status='done'; x.completed_at=new Date().toISOString(); x.completed_by=user.id; audit(user,'quran.review_complete',{id:x.id,student_id:st.id}); await save(); return json(res,200,x);
    }
    if (p === '/api/quran/levels' && req.method === 'GET') return json(res, 200, db.quran_levels);
    if (p === '/api/quran/session' && req.method === 'POST') {
      requireStaff(user); const b=await body(req); const st=quranStudent(b.student_id,true);
      const types=['تسميع','مراجعة','قراءة','اختبار حفظ']; if(!types.includes(b.type)) fail(400,'نوع الحلقة غير صحيح');
      const date=isDate(b.date)?b.date:localISO(); const fa=Number(b.from_ayah), ta=Number(b.to_ayah);
      if(!b.surah || !Number.isInteger(fa) || !Number.isInteger(ta) || fa<1 || ta<fa || ta>300) fail(400,'بيانات المقطع غير صحيحة');
      const rating=Math.max(1,Math.min(5,Number(b.rating)||1)), taj=Math.max(1,Math.min(5,Number(b.tajweed)||1)), flu=Math.max(1,Math.min(5,Number(b.fluency)||1));
      const row={id:uid('qs'),student_id:st.id,date,type:b.type,surah:clean(b.surah,80),from_ayah:fa,to_ayah:ta,rating,tajweed:taj,fluency:flu,notes:clean(b.notes,800),teacher_id:user.id};
      db.quran_sessions.push(row); audit(user,'quran.session_create',{student_id:st.id}); await save(); return json(res,201,row);
    }
    if (p === '/api/quran/evaluation' && req.method === 'POST') {
      requireStaff(user); const b=await body(req); const st=quranStudent(b.student_id,true); const vals=['reading','tajweed','memorization','adab'].map(k=>Number(b[k]));
      if(vals.some(x=>!Number.isInteger(x)||x<1||x>5)) fail(400,'كل بنود التقييم يجب أن تكون من 1 إلى 5');
      const row={id:uid('qe'),student_id:st.id,date:isDate(b.date)?b.date:localISO(),reading:vals[0],tajweed:vals[1],memorization:vals[2],adab:vals[3],overall:Math.round(mean(vals)),notes:clean(b.notes,800),teacher_id:user.id};
      db.quran_evaluations.push(row); audit(user,'quran.evaluation_create',{student_id:st.id}); await save(); return json(res,201,row);
    }
    if (p === '/api/quran/student' && req.method === 'GET') {
      const st=quranStudent(q.student_id || (user.role==='student' ? scopedStudents(user)[0]?.id : ''),false); if(!st) fail(404,'الطالب غير موجود'); return json(res,200,quranSummary(st));
    }

    /* لوحة الرئيسية */

    /* ───────────── V25: المسار الشخصي والبرامج والمجتمع ───────────── */
    const journeyFor = sid => {
      const s = db.students.find(x=>x.id===sid); if(!s) fail(404,'الطالب غير موجود');
      const items = db.journey_items.filter(x=>x.active!==false).sort((a,b)=>(a.order||0)-(b.order||0));
      const done = new Set(db.student_journey.filter(x=>x.student_id===sid && x.status==='done').map(x=>x.item_id));
      return {student:{id:s.id,name:s.name},items:items.map(x=>({...x,status:done.has(x.id)?'done':'pending'})),progress:items.length?Math.round(done.size/items.length*100):0};
    };
    if (p === '/api/journey' && req.method === 'GET') {
      const s = user.role==='student' ? studentForUser(user) : getStudent(user,q.student_id,false); if(!s) fail(404,'الطالب غير موجود');
      return json(res,200,journeyFor(s.id));
    }
    if (p === '/api/journey/complete' && req.method === 'POST') {
      if(user.role!=='student') fail(403,'إتمام عناصر الرحلة من صلاحية الطالب'); const s=studentForUser(user); const b=await body(req); const it=db.journey_items.find(x=>x.id===b.item_id&&x.active!==false); if(!it) fail(404,'عنصر الرحلة غير موجود');
      let row=db.student_journey.find(x=>x.student_id===s.id&&x.item_id===it.id); if(row) row.status='done'; else db.student_journey.push({id:uid('sj'),student_id:s.id,item_id:it.id,status:'done',completed_at:new Date().toISOString()}); audit(user,'journey.complete',{item_id:it.id}); await save(); return json(res,200,journeyFor(s.id));
    }
    if (p === '/api/admin/journey-items' && req.method === 'POST') {
      requireAdmin(); const b=await body(req); if(!clean(b.title,160)) fail(400,'عنوان العنصر مطلوب'); const row={id:uid('ji'),title:clean(b.title,160),description:clean(b.description,800),category:clean(b.category,80)||'أساسيات',level:clean(b.level,80)||'المستوى 1',order:Number.isFinite(Number(b.order))?Number(b.order):db.journey_items.length+1,required:b.required!==false,active:true}; db.journey_items.push(row); audit(user,'journey.item_create',{id:row.id}); await save(); return json(res,201,row);
    }
    if ((r=route(req,p,'PATCH','/api/admin/journey-items/:id'))) { requireAdmin(); const x=db.journey_items.find(x=>x.id===r.id); if(!x)fail(404,'عنصر الرحلة غير موجود'); const b=await body(req); for(const k of ['title','description','category','level']) if(b[k]!==undefined)x[k]=clean(b[k],k==='description'?800:160); if(b.order!==undefined)x.order=Number(b.order)||0;if(b.required!==undefined)x.required=!!b.required;if(b.active!==undefined)x.active=!!b.active;audit(user,'journey.item_update',{id:x.id});await save();return json(res,200,x); }
    if ((r=route(req,p,'DELETE','/api/admin/journey-items/:id'))) { requireAdmin(); const x=db.journey_items.find(x=>x.id===r.id); if(!x)fail(404,'عنصر الرحلة غير موجود'); x.active=false;audit(user,'journey.item_archive',{id:x.id});await save();return json(res,200,x); }
    if (p === '/api/academic-years' && req.method === 'GET') return json(res,200,db.academic_years);
    if (p === '/api/admin/academic-years' && req.method === 'POST') {
      requireAdmin(); const b=await body(req); if(!clean(b.name,80)||!isDate(b.start)||!isDate(b.end)||b.start>b.end) fail(400,'بيانات السنة الدراسية غير صحيحة'); const row={id:uid('ay'),name:clean(b.name,80),start:b.start,end:b.end,active:b.active!==false}; if(row.active) db.academic_years.forEach(x=>x.active=false); db.academic_years.push(row); audit(user,'academic_year.create',{id:row.id}); await save(); return json(res,201,row);
    }
    if (p === '/api/admin/terms' && req.method === 'POST') {
      requireAdmin(); const b=await body(req); const ay=db.academic_years.find(x=>x.id===b.academic_year_id); if(!clean(b.name,80)||!ay||!isDate(b.start)||!isDate(b.end)||b.start>b.end||b.start<ay.start||b.end>ay.end) fail(400,'بيانات الفصل غير صحيحة أو خارج السنة الدراسية'); const row={id:uid('term'),academic_year_id:ay.id,name:clean(b.name,80),start:b.start,end:b.end,active:b.active!==false}; if(row.active) db.terms.forEach(x=>x.active=false); db.terms.push(row); audit(user,'term.create',{id:row.id}); await save(); return json(res,201,row);
    }
    if (p.startsWith('/api/admin/academic-years/') && req.method === 'PATCH') {
      requireAdmin(); const id=decodeURIComponent(p.split('/').pop()), x=db.academic_years.find(x=>x.id===id); if(!x) fail(404,'السنة الدراسية غير موجودة'); const b=await body(req); const start=b.start!==undefined?b.start:x.start, end=b.end!==undefined?b.end:x.end; if(b.name!==undefined&&!clean(b.name,80)) fail(400,'اسم السنة مطلوب'); if(!isDate(start)||!isDate(end)||start>end) fail(400,'تواريخ السنة غير صحيحة'); x.name=b.name!==undefined?clean(b.name,80):x.name; x.start=start; x.end=end; if(b.active!==undefined)x.active=!!b.active; if(x.active)db.academic_years.forEach(y=>{if(y.id!==x.id)y.active=false}); audit(user,'academic_year.update',{id}); await save(); return json(res,200,x);
    }
    if (p.startsWith('/api/admin/terms/') && req.method === 'PATCH') {
      requireAdmin(); const id=decodeURIComponent(p.split('/').pop()), x=db.terms.find(x=>x.id===id); if(!x) fail(404,'الفصل غير موجود'); const b=await body(req); const ay=db.academic_years.find(y=>y.id===(b.academic_year_id!==undefined?b.academic_year_id:x.academic_year_id)); if(!ay) fail(400,'السنة الدراسية غير موجودة'); const start=b.start!==undefined?b.start:x.start,end=b.end!==undefined?b.end:x.end; if(b.name!==undefined&&!clean(b.name,80)||!isDate(start)||!isDate(end)||start>end||start<ay.start||end>ay.end) fail(400,'بيانات الفصل غير صحيحة أو خارج السنة الدراسية'); x.academic_year_id=ay.id; x.name=b.name!==undefined?clean(b.name,80):x.name; x.start=start;x.end=end;if(b.active!==undefined)x.active=!!b.active;if(x.active)db.terms.forEach(t=>{if(t.id!==x.id)t.active=false});audit(user,'term.update',{id});await save();return json(res,200,x);
    }
    if ((r=route(req,p,'DELETE','/api/admin/terms/:id'))) {
      requireAdmin(); const x=db.terms.find(x=>x.id===r.id); if(!x) fail(404,'الفصل غير موجود'); if(db.schedule.some(s=>s.term_id===x.id)) fail(409,'لا يمكن حذف فصل مرتبط بجدول'); x.active=false; audit(user,'term.archive',{id:x.id}); await save(); return json(res,200,x);
    }
    if (p === '/api/program' && req.method === 'GET') {
      const allowed = user.role==='admin' ? db.subjects : db.subjects.filter(sub=>sub.active!==false && (sub.required!==false || scopedStudents(user).some(s=>studentHasOptional(s.id,sub.id))));
      const gids=new Set(visibleGroupIds(user)); const lessons=db.lessons.filter(l=>allowed.some(s=>s.id===l.subject_id) && (user.role==='admin'||l.active!==false)); const schedule=db.schedule.filter(x=>!x.group_id||gids.has(x.group_id));
      return json(res,200,{subjects:allowed,lessons,schedule,academic_years:db.academic_years,terms:db.terms});
    }
    if (p === '/api/plans' && req.method === 'GET') {
      const visible = user.role==='admin' ? db.learning_plans : db.learning_plans.filter(x=>x.published===true && (x.group_id==null || visibleGroupIds(user).includes(x.group_id)));
      return json(res,200,visible.sort((a,b)=>(a.type||'').localeCompare(b.type||'') || String(a.start||'').localeCompare(String(b.start||''))));
    }
    if (p === '/api/admin/plans' && req.method === 'POST') {
      requireAdmin(); const b=await body(req);
      const types=['weekly','monthly','annual']; if(!types.includes(b.type)||!clean(b.title,160)) fail(400,'نوع الخطة والعنوان مطلوبان');
      if(b.start && !isDate(b.start)) fail(400,'تاريخ البداية غير صحيح'); if(b.end && !isDate(b.end)) fail(400,'تاريخ النهاية غير صحيح');
      if(b.start&&b.end&&b.end<b.start) fail(400,'نهاية الخطة قبل بدايتها');
      if(b.group_id && !db.groups.some(g=>g.id===b.group_id)) fail(400,'الفوج غير موجود');
      const row={id:uid('lp'),type:b.type,title:clean(b.title,160),description:clean(b.description,1000),start:b.start||null,end:b.end||null,academic_year_id:b.academic_year_id||null,term_id:b.term_id||null,group_id:b.group_id||null,items:Array.isArray(b.items)?b.items.slice(0,50).map(x=>clean(x,300)).filter(Boolean):[],published:b.published===true,created_by:user.id,created_at:new Date().toISOString()};
      db.learning_plans.push(row); audit(user,'plan.create',{id:row.id,type:row.type}); await save(); return json(res,201,row);
    }
    if ((r=route(req,p,'PATCH','/api/admin/plans/:id'))) {
      requireAdmin(); const x=db.learning_plans.find(x=>x.id===r.id); if(!x) fail(404,'الخطة غير موجودة'); const b=await body(req);
      if(b.type!==undefined&&!['weekly','monthly','annual'].includes(b.type)) fail(400,'نوع الخطة غير صحيح');
      for(const k of ['title','description']) if(b[k]!==undefined)x[k]=clean(b[k],k==='description'?1000:160);
      for(const k of ['start','end']) if(b[k]!==undefined){if(b[k]&&!isDate(b[k]))fail(400,'تاريخ غير صحيح');x[k]=b[k]||null;}
      if(b.group_id!==undefined){if(b.group_id&&!db.groups.some(g=>g.id===b.group_id))fail(400,'الفوج غير موجود');x.group_id=b.group_id||null;} if(b.items!==undefined)x.items=Array.isArray(b.items)?b.items.slice(0,50).map(v=>clean(v,300)).filter(Boolean):[]; if(b.published!==undefined)x.published=!!b.published;
      if(x.start&&x.end&&x.end<x.start) fail(400,'نهاية الخطة قبل بدايتها');
      for(const k of ['academic_year_id','term_id','group_id']) if(b[k]!==undefined)x[k]=b[k]||null;
      if(b.items!==undefined){if(!Array.isArray(b.items))fail(400,'عناصر الخطة يجب أن تكون قائمة');x.items=b.items.slice(0,50).map(v=>clean(v,300)).filter(Boolean);}
      if(b.published!==undefined)x.published=!!b.published; audit(user,'plan.update',{id:x.id});await save();return json(res,200,x);
    }
    if ((r=route(req,p,'DELETE','/api/admin/plans/:id'))) { requireAdmin(); const x=db.learning_plans.find(x=>x.id===r.id); if(!x)fail(404,'الخطة غير موجودة'); x.published=false;x.archived=true;audit(user,'plan.archive',{id:x.id});await save();return json(res,200,x); }
    if (p === '/api/admin/program/subjects' && req.method === 'POST') {
      requireAdmin(); const b=await body(req); if(!clean(b.name,120)) fail(400,'اسم المادة مطلوب'); const modes=['memorize','understand','review','apply','discussion','optional']; if(b.learning_mode && !modes.includes(b.learning_mode)) fail(400,'طريقة التعلم غير صحيحة'); const row={id:uid('sub'),name:clean(b.name,120),description:clean(b.description,500),category:clean(b.category,80)||'عام',required:b.required!==false,classification:b.learning_mode||'understand',learning_mode:b.learning_mode||'understand',study_method:clean(b.study_method,600)||'اقرأ، افهم، لخّص، ثم راجع'}; db.subjects.push(row); audit(user,'program.subject_create',{id:row.id}); await save(); return json(res,201,row);
    }
    if (p === '/api/admin/program/lessons' && req.method === 'POST') {
      requireAdmin(); const b=await body(req); if(!db.subjects.some(x=>x.id===b.subject_id)||!clean(b.title,160)) fail(400,'بيانات الدرس غير صحيحة'); const row={id:uid('les'),subject_id:b.subject_id,title:clean(b.title,160),description:clean(b.description,1000),learning_mode:clean(b.learning_mode,40)||(db.subjects.find(x=>x.id===b.subject_id)||{}).learning_mode||'understand',study_method:clean(b.study_method,600)||'قراءة وفهم ثم مراجعة'}; db.lessons.push(row); audit(user,'program.lesson_create',{id:row.id}); await save(); return json(res,201,row);
    }

    if (p.startsWith('/api/admin/program/subjects/') && req.method === 'PATCH') {
      requireAdmin(); const id=decodeURIComponent(p.split('/').pop()), x=db.subjects.find(x=>x.id===id); if(!x) fail(404,'المادة غير موجودة'); const b=await body(req); const modes=['memorize','understand','review','apply','discussion','optional']; if(b.learning_mode!==undefined&&!modes.includes(b.learning_mode)) fail(400,'طريقة التعلم غير صحيحة'); for(const k of ['name','description','category','study_method']) if(b[k]!==undefined) x[k]=clean(b[k], k==='description'?500:k==='study_method'?600:120); if(b.required!==undefined)x.required=!!b.required; if(b.active!==undefined)x.active=!!b.active; if(b.learning_mode!==undefined){x.learning_mode=b.learning_mode;x.classification=b.learning_mode;} audit(user,'program.subject_update',{id});await save();return json(res,200,x);
    }
    if ((r=route(req,p,'DELETE','/api/admin/program/subjects/:id'))) {
      requireAdmin(); const x=db.subjects.find(x=>x.id===r.id); if(!x) fail(404,'المادة غير موجودة'); x.active=false; audit(user,'program.subject_archive',{id:x.id}); await save(); return json(res,200,x);
    }
    if ((r=route(req,p,'DELETE','/api/admin/program/lessons/:id'))) {
      requireAdmin(); const x=db.lessons.find(x=>x.id===r.id); if(!x) fail(404,'الدرس غير موجود'); x.active=false; audit(user,'program.lesson_archive',{id:x.id}); await save(); return json(res,200,x);
    }
    if (p.startsWith('/api/admin/program/lessons/') && p.endsWith('/content') && req.method === 'PATCH') {
      requireAdmin(); const parts=p.split('/'); const id=decodeURIComponent(parts[5]), x=db.lessons.find(x=>x.id===id); if(!x) fail(404,'الدرس غير موجود'); const b=await body(req); const c=x.content&&typeof x.content==='object'?x.content:{};
      const textFields=['opening','story','explanation','action','memorize','review','source_notes']; const listFields=['ayahs','hadiths','examples','reflection_questions'];
      for(const k of textFields) if(b[k]!==undefined)c[k]=clean(b[k],k==='explanation'?12000:k==='source_notes'?2000:5000);
      for(const k of listFields) if(b[k]!==undefined){if(!Array.isArray(b[k]))fail(400,'الحقول القائمة يجب أن تكون قوائم');c[k]=b[k].slice(0,30).map(v=>typeof v==='object'?v:clean(v,1000));}
      if(b.source_status!==undefined){if(!['draft','verified','needs_review'].includes(b.source_status))fail(400,'حالة المصدر غير صحيحة');c.source_status=b.source_status;}
      x.content=c; audit(user,'program.lesson_content_update',{id}); await save(); return json(res,200,x);
    }
    if (p.startsWith('/api/admin/program/lessons/') && req.method === 'PATCH') {
      requireAdmin(); const id=decodeURIComponent(p.split('/').pop()), x=db.lessons.find(x=>x.id===id); if(!x) fail(404,'الدرس غير موجود'); const b=await body(req); if(b.subject_id!==undefined&&!db.subjects.some(s=>s.id===b.subject_id)) fail(400,'المادة غير موجودة'); for(const k of ['title','description','study_method','learning_mode']) if(b[k]!==undefined)x[k]=clean(b[k],k==='description'?1000:600); if(b.subject_id!==undefined)x.subject_id=b.subject_id; audit(user,'program.lesson_update',{id});await save();return json(res,200,x);
    }
    if (p.startsWith('/api/lessons/') && req.method === 'GET') {
      const id=decodeURIComponent(p.split('/').pop()), lesson=db.lessons.find(x=>x.id===id); if(!lesson || (lesson.active===false && user.role!=='admin')) fail(404,'الدرس غير موجود');
      const subject=db.subjects.find(x=>x.id===lesson.subject_id); return json(res,200,{...lesson,subject_name:subject?.name||'',content:lesson.content||{}});
    }
    if (p === '/api/admin/program/schedule' && req.method === 'POST') {
      requireAdmin(); const b=await body(req); if(b.group_id&&!db.groups.some(g=>g.id===b.group_id)) fail(400,'الفوج غير موجود'); if(!db.subjects.some(x=>x.id===b.subject_id)) fail(400,'المادة غير موجودة'); if(b.lesson_id&&!db.lessons.some(x=>x.id===b.lesson_id&&x.subject_id===b.subject_id)) fail(400,'الدرس غير مرتبط بالمادة'); const term=b.term_id?db.terms.find(t=>t.id===b.term_id):null; if(b.term_id&&!term)fail(400,'الفصل غير موجود'); if(term&&term.active===false)fail(400,'الفصل مؤرشف'); const row={id:uid('sch'),day:clean(b.day,30),time:clean(b.time,60),group_id:b.group_id||null,subject_id:b.subject_id,lesson_id:b.lesson_id||null,term_id:term?term.id:null,academic_year_id:term?term.academic_year_id:null,type:clean(b.type,60)||'درس'}; if(!row.day||!row.time)fail(400,'اليوم والوقت مطلوبان'); if(db.schedule.some(s=>s.day===row.day&&s.time===row.time&&s.group_id===row.group_id&&s.term_id===row.term_id)) fail(409,'يوجد موعد مطابق لهذا الفوج في نفس الوقت والفصل'); db.schedule.push(row);audit(user,'program.schedule_create',{id:row.id});await save();return json(res,201,row);
    }
    if (p.startsWith('/api/admin/program/schedule/') && req.method === 'PATCH') {
      requireAdmin(); const id=decodeURIComponent(p.split('/').pop()),x=db.schedule.find(x=>x.id===id);if(!x)fail(404,'موعد البرنامج غير موجود');const b=await body(req);for(const k of ['day','time','type'])if(b[k]!==undefined)x[k]=clean(b[k],60);if(b.group_id!==undefined){if(b.group_id&&!db.groups.some(g=>g.id===b.group_id))fail(400,'الفوج غير موجود');x.group_id=b.group_id||null;}if(b.term_id!==undefined){const term=b.term_id?db.terms.find(t=>t.id===b.term_id):null;if(b.term_id&&!term)fail(400,'الفصل غير موجود');if(term&&term.active===false)fail(400,'الفصل مؤرشف');x.term_id=term?term.id:null;x.academic_year_id=term?term.academic_year_id:null;}if(b.subject_id!==undefined){if(!db.subjects.some(s=>s.id===b.subject_id))fail(400,'المادة غير موجودة');x.subject_id=b.subject_id;}if(b.lesson_id!==undefined){if(b.lesson_id&&!db.lessons.some(l=>l.id===b.lesson_id&&l.subject_id===x.subject_id))fail(400,'الدرس غير مرتبط بالمادة');x.lesson_id=b.lesson_id||null;}audit(user,'program.schedule_update',{id});await save();return json(res,200,x);
    }
    if (p === '/api/diagnostic' && req.method === 'GET') {
      const s=user.role==='student'?studentForUser(user):getStudent(user,q.student_id,false); if(!s) fail(404,'الطالب غير موجود'); const d=db.student_diagnostics.filter(x=>x.student_id===s.id).sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)))[0]||null; return json(res,200,d);
    }
    if (p === '/api/diagnostic' && req.method === 'POST') {
      if(!isStaff(user)) fail(403,'التشخيص من صلاحية المعلم والإدارة'); const b=await body(req); const s=getStudent(user,b.student_id,true); const row={id:uid('diag'),student_id:s.id,created_by:user.id,created_at:new Date().toISOString(),strengths:clean(b.strengths,1500),needs:clean(b.needs,1500),learning_style:clean(b.learning_style,300),memorization_method:clean(b.memorization_method,800),avoid_method:clean(b.avoid_method,800),goals:clean(b.goals,1000)}; db.student_diagnostics.unshift(row); audit(user,'student.diagnostic_create',{student_id:s.id}); await save(); return json(res,201,row);
    }
    if (p === '/api/challenges' && req.method === 'GET') {
      const gids=new Set(visibleGroupIds(user)); const list=db.challenges.filter(c=>c.status==='open' && (!c.group_id||gids.has(c.group_id))); return json(res,200,list.map(c=>({...c,participants:db.challenge_participants.filter(x=>x.challenge_id===c.id).length,joined:db.challenge_participants.some(x=>x.challenge_id===c.id&&x.user_id===user.id)})));
    }
    if (p === '/api/challenges' && req.method === 'POST') {
      const b=await body(req); if(!clean(b.title,160)) fail(400,'عنوان التحدي مطلوب');
      if(isStaff(user)) { if(b.group_id&&!ownsGroup(user,b.group_id)) fail(403,'الفوج خارج نطاقك'); }
      else if(user.role==='student') { const me=studentForUser(user), target=db.students.find(x=>x.id===b.to_student_id); if(!me||!target) fail(404,'الطالب غير موجود'); const common=studentGroupIds(me).filter(g=>studentGroupIds(target).includes(g)); if(!common.length) fail(403,'يمكن تحدي زميل من نفس الفوج فقط'); b.group_id=common[0]; }
      else fail(403,'إنشاء التحديات للطلاب والطاقم فقط');
      const row={id:uid('ch'),title:clean(b.title,160),description:clean(b.description,800),group_id:b.group_id||null,start:isDate(b.start)?b.start:localISO(),end:isDate(b.end)?b.end:addDays(localISO(),7),status:'open',created_by:user.id,target_student_id:user.role==='student'?b.to_student_id:null}; db.challenges.push(row);
      if(user.role==='student'){const me=studentForUser(user);db.challenge_participants.push({id:uid('cp'),challenge_id:row.id,user_id:user.id,student_id:me.id,progress:0,joined_at:new Date().toISOString()});if(row.target_student_id){const tu=db.students.find(x=>x.id===row.target_student_id);db.notifications.unshift({id:uid('n'),title:'تحدٍ جديد',body:`${me.name} أرسل لك تحديًا: ${row.title}`,group_id:row.group_id,read_by:[],created_at:new Date().toISOString()});}}
      audit(user,'challenge.create',{id:row.id}); await save(); return json(res,201,row);
    }
    if (p === '/api/challenges/join' && req.method === 'POST') {
      if(user.role!=='student') fail(403,'المشاركة للطلاب'); const b=await body(req); const c=db.challenges.find(x=>x.id===b.challenge_id&&x.status==='open'); if(!c) fail(404,'التحدي غير موجود'); const s=studentForUser(user); if(c.group_id&&!studentGroupIds(s).includes(c.group_id)) fail(403,'التحدي خارج نطاقك'); if(!db.challenge_participants.some(x=>x.challenge_id===c.id&&x.user_id===user.id)){db.challenge_participants.push({id:uid('cp'),challenge_id:c.id,user_id:user.id,student_id:s.id,progress:0,joined_at:new Date().toISOString()});await save();} return json(res,200,{ok:true});
    }
    if (p === '/api/challenges/progress' && req.method === 'POST') { if(user.role!=='student') fail(403,'التقدم للطالب'); const b=await body(req); const x=db.challenge_participants.find(x=>x.challenge_id===b.challenge_id&&x.user_id===user.id); if(!x) fail(404,'أنت غير مشارك في التحدي'); const progress=Number(b.progress); if(!Number.isFinite(progress)||progress<0||progress>100) fail(400,'نسبة التقدم غير صحيحة'); x.progress=Math.round(progress);x.updated_at=new Date().toISOString();await save();return json(res,200,x); }
    if (p === '/api/feedback' && req.method === 'POST') {
      if(!['student','parent'].includes(user.role)) fail(403,'هذه القناة للطلاب وأولياء الأمور'); const b=await body(req); const text=clean(b.text,3000); if(text.length<5) fail(400,'اكتب رسالة أو مشكلة واضحة'); const row={id:uid('fb'),text,category:clean(b.category,80)||'عام',anonymous:b.anonymous!==false,author_id:b.anonymous===false?user.id:null,created_at:new Date().toISOString(),status:'new'}; db.anonymous_feedback.unshift(row); audit(user,'feedback.submit',{anonymous:row.anonymous}); await save(); return json(res,201,{ok:true,id:row.id});
    }
    if (p === '/api/admin/feedback' && req.method === 'GET') { requireAdmin(); return json(res,200,db.anonymous_feedback.slice(0,200).map(x=>({...x,author_name:x.author_id?(db.users.find(u=>u.id===x.author_id)||{}).name:null}))); }
    if (p === '/api/exam-excuses' && req.method === 'POST') {
      if(user.role!=='student') fail(403,'طلب الاعتذار قبل الاختبار من الطالب'); const b=await body(req); const t=db.tests.find(x=>x.id===b.test_id); const s=studentForUser(user); if(!t||!s||!testsFor(user).some(x=>x.id===t.id)) fail(404,'الاختبار غير موجود'); if(!clean(b.reason,20)) fail(400,'سبب الاعتذار مطلوب'); const row={id:uid('ex'),test_id:t.id,student_id:s.id,reason:clean(b.reason,1000),attachment_name:clean(b.attachment_name,180),attachment_data:typeof b.attachment_data==='string'&&b.attachment_data.length<150000?b.attachment_data:'',status:'pending',created_at:new Date().toISOString()}; db.exam_excuses.unshift(row); audit(user,'exam_excuse.submit',{test_id:t.id}); await save(); return json(res,201,{id:row.id,status:row.status});
    }
    if (p === '/api/exam-excuses' && req.method === 'GET') { const ids=new Set(scopedStudents(user).map(s=>s.id)); return json(res,200,db.exam_excuses.filter(x=>ids.has(x.student_id))); }
    if (p === '/api/admin/exam-excuses/review' && req.method === 'POST') { requireAdmin(); const b=await body(req); const x=db.exam_excuses.find(e=>e.id===b.id); if(!x) fail(404,'الطلب غير موجود'); if(!['approved','rejected'].includes(b.status)) fail(400,'الحالة غير صحيحة'); x.status=b.status;x.reviewed_by=user.id;x.reviewed_at=new Date().toISOString(); audit(user,'exam_excuse.review',{id:x.id,status:x.status});await save();return json(res,200,x); }
    if (p === '/api/teachers/profiles' && req.method === 'GET') { const ids=new Set(db.users.filter(u=>u.role==='teacher').map(u=>u.id)); return json(res,200,db.teacher_profiles.filter(x=>ids.has(x.teacher_id)).map(x=>({...x,teacher_name:(db.users.find(u=>u.id===x.teacher_id)||{}).name||''}))); }
    if (p === '/api/teacher/profile' && req.method === 'POST') { if(user.role!=='teacher'&&user.role!=='admin') fail(403,'ملف الشيخ للشيخ والإدارة'); const id=user.role==='admin'?q.teacher_id:user.id; if(!id) fail(400,'الشيخ مطلوب'); const u=db.users.find(x=>x.id===id&&x.role==='teacher'); if(!u) fail(404,'الشيخ غير موجود'); const b=await body(req); let x=db.teacher_profiles.find(x=>x.teacher_id===id); if(!x){x={id:uid('tp'),teacher_id:id};db.teacher_profiles.push(x);} x.bio=clean(b.bio,2000);x.cv=clean(b.cv,5000);x.contact=clean(b.contact,1000);x.updated_at=new Date().toISOString();audit(user,'teacher.profile_update',{teacher_id:id});await save();return json(res,200,x); }
    if (p === '/api/donations/intent' && req.method === 'POST') { if(!['student','parent'].includes(user.role)) fail(403,'طلب الإعانة متاح للمستخدمين فقط'); const b=await body(req); const amount=Number(b.amount); if(!Number.isFinite(amount)||amount<=0||amount>100000000) fail(400,'المبلغ غير صحيح'); const row={id:uid('don'),amount,method:'CCP',note:clean(b.note,500),user_id:user.id,status:'pending',created_at:new Date().toISOString()};db.donation_intents.unshift(row);audit(user,'donation.intent',{id:row.id});await save();return json(res,201,{id:row.id,status:row.status}); }
    if (p === '/api/admin/donations' && req.method === 'GET') { requireAdmin(); return json(res,200,db.donation_intents.map(x=>({...x,user_name:(db.users.find(u=>u.id===x.user_id)||{}).name||''}))); }
    if (p === '/api/dashboard' && req.method === 'GET') {
      const list = scopedStudents(user).map(s => studentView(s, user)), today = localISO();
      const ids = list.map(s => s.id);
      const base = {
        students_count: list.length,
        groups_count: visibleGroupIds(user).length,
        attendance_today_count: new Set(db.attendance.filter(a => ids.includes(a.student_id) && String(a.date || '').slice(0, 10) === today).map(a => a.student_id)).size,
        attendance_rate: Math.round(mean(list.map(s => s.attendance_rate)) || 0),
        progress_avg: Math.round(mean(list.map(s => s.progress)) || 0),
        upcoming_tests: testsFor(user).filter(t => t.date >= today).length,
        due_reviews: db.memorization.filter(m => ids.includes(m.student_id) && m.next_review_at && m.next_review_at <= today).length
      };
      if (user.role !== 'student') return json(res, 200, base);
      const st = studentForUser(user);
      const gids = st ? studentGroupIds(st) : [];
      const tasks = db.student_tasks.filter(x => x.student_id === st?.id && x.status !== 'done').sort((a,b) => String(a.due_date||'9999').localeCompare(String(b.due_date||'9999'))).slice(0,5).map(x => ({type:'task',id:x.id,title:x.title,detail:x.due_date ? `موعد: ${x.due_date}` : 'مهمة اليوم',priority:x.due_date && x.due_date <= today ? 'due' : 'normal'}));
      const reviews = db.memorization.filter(x => x.student_id === st?.id && x.next_review_at && x.next_review_at <= today).slice(0,5).map(x => ({type:'review',id:x.id,title:`مراجعة ${x.surah||'المقرر'}`,detail:`من ${x.from_ayah||''} إلى ${x.to_ayah||''}`.trim()}));
      const schedule = db.schedule.filter(x => (!x.group_id || gids.includes(x.group_id)) && x.day === new Date().getDay()).slice(0,5).map(x => ({type:'lesson',id:x.id,title:(db.lessons.find(l=>l.id===x.lesson_id)||{}).title||'حصة دراسية',detail:`${x.time||''}${x.type ? ' · '+x.type : ''}`}));
      const testsToday = testsFor(user).filter(t => t.date === today).slice(0,3).map(t => ({type:'test',id:t.id,title:t.title,detail:`اليوم · ${t.max_score||0} درجة`}));
      base.today_plan = [...testsToday,...reviews,...tasks,...schedule].slice(0,10);
      base.today_message = base.today_plan.length ? 'ابدأ بأقرب خطوة، ثم انتقل لما بعدها. لا تجمع كل الطريق في لحظة واحدة.' : 'ليس المطلوب أن تملأ يومك بالمهام؛ اختر عملًا نافعًا واحدًا وابدأ به.';
      const qs = quranSummary(st);
      base.quran_today = { mastery: qs.mastery, due_reviews: qs.due_reviews, total_sessions: qs.total_sessions, latest_session: qs.sessions?.[0] || null, latest_evaluation: qs.evaluations?.[0] || null };
      base.unread_notifications = db.notifications.filter(n => !(n.read_by || []).includes(user.id) && (!n.group_id || gids.includes(n.group_id))).length;
      base.unread_messages = db.messages.filter(m => m.recipient_id === user.id && !m.read_at).length;
      base.media_unseen = db.media_posts.filter(m => !m.group_id || gids.includes(m.group_id)).filter(m => !db.media_reads.some(r2 => r2.media_id === m.id && r2.user_id === user.id)).length;
      return json(res, 200, base);
    }

    /* المنشورات */
    if (p === '/api/posts' && req.method === 'GET') {
      const g = visibleGroupIds(user);
      const list = db.posts.filter(x => !x.group_id || user.role === 'admin' || g.includes(x.group_id));
      return json(res, 200, list.map(x => ({ ...x, read: db.post_reads.some(r2 => r2.post_id === x.id && r2.user_id === user.id) })));
    }
    if (p === '/api/posts' && req.method === 'POST') {
      requireStaff(user);
      const b = await body(req);
      const title = clean(b.title, 160), text = clean(b.body, 5000);
      if (!title || !text) return json(res, 400, { error: 'العنوان والمحتوى مطلوبان' });
      const gid = b.group_id || null;
      if (gid && !ownsGroup(user, gid)) return json(res, 403, { error: 'هذا الفوج خارج نطاقك' });
      const imageUrl = safeUrl(b.image_url); if (b.image_url && !imageUrl) return json(res, 400, { error: 'رابط الصورة يجب أن يبدأ بـ http أو https' });
      const post = { id: uid('p'), title, body: text, image_url: imageUrl || null, group_id: gid, author_id: user.id, author_name: user.name, created_at: new Date().toISOString() };
      db.posts.unshift(post);
      db.notifications.unshift({ id: uid('n'), title, body: text, group_id: gid, read_by: [], created_at: post.created_at });
      await save(); return json(res, 201, post);
    }
    if ((r = route(req, p, 'POST', '/api/posts/:id/read'))) {
      const post = db.posts.find(x => x.id === r.id);
      const g = visibleGroupIds(user);
      if (!post || (post.group_id && user.role !== 'admin' && !g.includes(post.group_id))) return json(res, 404, { error: 'المنشور غير موجود' });
      if (!db.post_reads.some(x => x.post_id === r.id && x.user_id === user.id)) { db.post_reads.push({ post_id: r.id, user_id: user.id, read_at: new Date().toISOString() }); await save(); }
      return json(res, 200, { ok: true });
    }

    if (p === '/api/group-catalog' && req.method === 'GET') { const visible=visibleGroupIds(user); return json(res,200,db.groups.filter(g=>user.role==='admin'||visible.includes(g.id)).map(g=>({...g,student_count:new Set(db.memberships.filter(m=>m.group_id===g.id).map(m=>m.student_id)).size,teachers:db.teacher_groups.filter(x=>x.group_id===g.id).map(x=>(db.users.find(u=>u.id===x.teacher_id)||{}).name).filter(Boolean)}))); }
    if (p === '/api/admin/quran-schools' && req.method === 'GET') { requireAdmin(); return json(res,200,db.quran_schools); }
    if (p === '/api/admin/quran-schools' && req.method === 'POST') {
      requireAdmin(); const b=await body(req), name=clean(b.name,160); if(!name) fail(400,'اسم المدرسة القرآنية مطلوب');
      if(db.quran_schools.some(x=>x.name.trim().toLowerCase()===name.toLowerCase())) fail(409,'اسم المدرسة مستخدم');
      const row={id:uid('qs'),name,description:clean(b.description,800),active:b.active!==false,order:Number(b.order)||db.quran_schools.length+1,school_id:clean(b.school_id,80)||null}; db.quran_schools.push(row); audit(user,'quran_school.create',{id:row.id}); await save(); return json(res,201,row);
    }
    if ((r=route(req,p,'PATCH','/api/admin/quran-schools/:id'))) { requireAdmin(); const x=db.quran_schools.find(x=>x.id===r.id); if(!x)fail(404,'المدرسة القرآنية غير موجودة'); const b=await body(req); if(b.name!==undefined){const name=clean(b.name,160);if(!name)fail(400,'اسم المدرسة مطلوب');x.name=name;} if(b.description!==undefined)x.description=clean(b.description,800);if(b.active!==undefined)x.active=!!b.active;if(b.order!==undefined)x.order=Number(b.order)||0;await save();audit(user,'quran_school.update',{id:x.id});return json(res,200,x);}

    if (p === '/api/admin/teams' && req.method === 'GET') {
      requireAdmin(); return json(res,200,db.teams.map(t=>teamView(t,user)));
    }
    if (p === '/api/admin/teams' && req.method === 'POST') {
      requireAdmin(); const b=await body(req), name=clean(b.name,100), gid=clean(b.group_id,80); if(!name||!gid||!db.groups.some(g=>g.id===gid))fail(400,'اسم الفريق والفوج مطلوبان');
      if(db.teams.some(t=>t.group_id===gid&&t.name.trim().toLowerCase()===name.toLowerCase()))fail(409,'اسم الفريق مستخدم داخل هذا الفوج');
      const row={id:uid('tm'),group_id:gid,name,description:clean(b.description,600),active:true,created_by:user.id,created_at:new Date().toISOString()};db.teams.push(row);audit(user,'team.create',{id:row.id,group_id:gid});await save();return json(res,201,teamView(row,user));
    }
    if ((r=route(req,p,'PATCH','/api/admin/teams/:id'))) { requireAdmin(); const t=teamById(r.id);if(!t)fail(404,'الفريق غير موجود');const b=await body(req);if(b.name!==undefined)t.name=clean(b.name,100);if(b.description!==undefined)t.description=clean(b.description,600);if(b.active!==undefined)t.active=!!b.active;await save();audit(user,'team.update',{id:t.id});return json(res,200,teamView(t,user));}
    if ((r=route(req,p,'PUT','/api/admin/teams/:id/members'))) {
      requireAdmin(); const t=teamById(r.id);if(!t)fail(404,'الفريق غير موجود');const b=await body(req);if(!Array.isArray(b.student_ids))fail(400,'قائمة الطلبة مطلوبة');
      const valid=[...new Set(b.student_ids)].filter(id=>{const s=db.students.find(x=>x.id===id);return s&&studentGroupIds(s).includes(t.group_id);});
      db.team_members=db.team_members.filter(x=>x.team_id!==t.id);valid.forEach(student_id=>db.team_members.push({id:uid('tmem'),team_id:t.id,student_id}));
      const sup=[...new Set(Array.isArray(b.supervisor_ids)?b.supervisor_ids:[])].filter(id=>valid.includes(id));db.team_supervisors=db.team_supervisors.filter(x=>x.team_id!==t.id);sup.forEach(student_id=>db.team_supervisors.push({id:uid('tsup'),team_id:t.id,student_id}));
      audit(user,'team.members_replace',{team_id:t.id,members:valid,supervisors:sup});await save();return json(res,200,teamView(t,user));
    }
    if ((r=route(req,p,'DELETE','/api/admin/teams/:id'))) { requireAdmin();const t=teamById(r.id);if(!t)fail(404,'الفريق غير موجود');db.team_members=db.team_members.filter(x=>x.team_id!==t.id);db.team_supervisors=db.team_supervisors.filter(x=>x.team_id!==t.id);db.team_tasks=db.team_tasks.filter(x=>x.team_id!==t.id);db.teams=db.teams.filter(x=>x.id!==t.id);audit(user,'team.delete',{id:t.id});await save();return json(res,200,{ok:true});}

    // Student-led supervisor applications. Approval is restricted to the chief supervisor or platform admin.
    if (p === '/api/supervisor-requests' && req.method === 'GET') {
      let rows = db.supervisor_requests;
      if (user.role === 'student') rows = rows.filter(x => x.requested_by === user.id);
      else if (user.role === 'teacher') {
        const gids = new Set(teacherGroupIds(user));
        rows = rows.filter(x => { const t=teamById(x.team_id); return t && gids.has(t.group_id); });
      } else if (!['admin','chief_supervisor'].includes(user.role)) fail(403,'طلبات الإشراف غير متاحة لهذا الحساب');
      return json(res,200,rows.slice().sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))).map(x=>{
        const t=teamById(x.team_id), st=db.students.find(s=>s.id===x.student_id);
        const g=t&&db.groups.find(q=>q.id===t.group_id), reviewer=db.users.find(u=>u.id===x.reviewed_by);
        return {...x,team_name:t?.name||'فريق محذوف',group_name:g?.name||'',student_name:st?.name||'طالب محذوف',reviewer_name:reviewer?.name||null};
      }));
    }
    if (p === '/api/supervisor-requests' && req.method === 'POST') {
      if (user.role !== 'student') fail(403,'طلب الإشراف متاح للطلبة فقط');
      const b=await body(req), team=teamById(clean(b.team_id,80)), st=studentForUser(user);
      if(!st||!team||!teamVisibleTo(user,team)) fail(404,'الفريق غير موجود');
      if(!teamStudentIds(team).includes(st.id)) fail(403,'يجب أن تكون عضوًا في الفريق قبل طلب الإشراف');
      if(teamSupervisorIds(team).includes(st.id)) fail(409,'أنت مشرف في هذا الفريق بالفعل');
      if(db.supervisor_requests.some(x=>x.team_id===team.id&&x.student_id===st.id&&['pending','approved'].includes(x.status))) fail(409,'لديك طلب قائم أو موافقة سابقة لهذا الفريق');
      const row={id:uid('sreq'),team_id:team.id,student_id:st.id,requested_by:user.id,reason:clean(b.reason,800),status:'pending',created_at:new Date().toISOString(),reviewed_by:null,reviewed_at:null};
      db.supervisor_requests.push(row);
      const recipients=new Set(db.users.filter(u=>u.active!==false&&['admin','chief_supervisor'].includes(u.role)).map(u=>u.id));
      db.teacher_groups.filter(x=>x.group_id===team.group_id).forEach(x=>recipients.add(x.teacher_id));
      recipients.forEach(user_id=>db.notifications.unshift({id:uid('n'),user_id,title:'طلب جديد للإشراف على فريق',body:`${st.name} طلب الإشراف على فريق ${team.name}.`,group_id:team.group_id,created_at:row.created_at,read:false}));
      audit(user,'team.supervisor_request',{id:row.id,team_id:team.id,student_id:st.id}); await save(); return json(res,201,row);
    }
    const supervisorReview=route(req,p,'PATCH','/api/supervisor-requests/:id/review');
    if(supervisorReview){
      if(!['admin','chief_supervisor'].includes(user.role)) fail(403,'اعتماد طلبات الإشراف من صلاحية كبير المشرفين أو المدير العام');
      const row=db.supervisor_requests.find(x=>x.id===supervisorReview.id); if(!row)fail(404,'الطلب غير موجود');
      if(row.status!=='pending')fail(409,'تمت معالجة هذا الطلب من قبل');
      const b=await body(req); if(!['approve','reject'].includes(b.decision))fail(400,'قرار المراجعة غير صحيح');
      const team=teamById(row.team_id), st=db.students.find(x=>x.id===row.student_id);
      if(b.decision==='approve'){
        if(!team||!st||!teamStudentIds(team).includes(st.id))fail(409,'تعذر الاعتماد: الطالب لم يعد عضوًا في الفريق');
        if(!teamSupervisorIds(team).includes(st.id))db.team_supervisors.push({id:uid('tsup'),team_id:team.id,student_id:st.id});
        row.status='approved';
      } else row.status='rejected';
      row.reviewed_by=user.id; row.reviewed_at=new Date().toISOString();
      if(st?.user_id)db.notifications.unshift({id:uid('n'),user_id:st.user_id,title:row.status==='approved'?'تمت الموافقة على طلب الإشراف':'لم تتم الموافقة على طلب الإشراف',body:row.status==='approved'?'أصبحت مشرفًا على فريقك، والتزم بحدود المسؤولية والصلاحيات.':'يمكنك مواصلة التعلم وخدمة زملائك، وطلب التوجيه من الشيخ.',group_id:team?.group_id||null,created_at:row.reviewed_at,read:false});
      audit(user,'team.supervisor_request_review',{id:row.id,decision:b.decision,team_id:row.team_id,student_id:row.student_id}); await save(); return json(res,200,row);
    }

    if (p === '/api/teams' && req.method === 'GET') return json(res,200,db.teams.filter(t=>teamVisibleTo(user,t)).map(t=>teamView(t,user)));
    if (p === '/api/teams' && req.method === 'POST') {
      if(!['admin','teacher','chief_supervisor'].includes(user.role)) fail(403,'إنشاء الفرق متاح للمدير والمشرف الرئيسي والشيخ'); const b=await body(req),name=clean(b.name,100),gid=clean(b.group_id,80); if(!name||!gid||!db.groups.some(g=>g.id===gid))fail(400,'اسم الفريق والفوج مطلوبان'); if(user.role==='teacher'&&!teacherGroupIds(user).includes(gid))fail(403,'الفوج خارج نطاقك'); if(db.teams.some(t=>t.group_id===gid&&t.name.trim().toLowerCase()===name.toLowerCase()))fail(409,'اسم الفريق مستخدم داخل هذا الفوج'); const row={id:uid('tm'),group_id:gid,name,description:clean(b.description,600),active:true,created_by:user.id,created_at:new Date().toISOString()};db.teams.push(row);audit(user,'team.create',{id:row.id,group_id:gid});await save();return json(res,201,teamView(row,user));
    }
    if ((r=route(req,p,'PUT','/api/teams/:id/members'))) {
      const t=teamById(r.id);if(!t||!teamVisibleTo(user,t))fail(404,'الفريق غير موجود');if(user.role!=='admin'&&user.role!=='chief_supervisor'&&!(user.role==='teacher'&&teacherGroupIds(user).includes(t.group_id)))fail(403,'لا تملك إدارة أعضاء الفريق');const b=await body(req);if(!Array.isArray(b.student_ids))fail(400,'قائمة الطلبة مطلوبة');const valid=[...new Set(b.student_ids)].filter(id=>{const st=db.students.find(x=>x.id===id);return st&&studentGroupIds(st).includes(t.group_id);});db.team_members=db.team_members.filter(x=>x.team_id!==t.id);valid.forEach(student_id=>db.team_members.push({id:uid('tmem'),team_id:t.id,student_id}));const sup=[...new Set(Array.isArray(b.supervisor_ids)?b.supervisor_ids:[])].filter(id=>valid.includes(id));db.team_supervisors=db.team_supervisors.filter(x=>x.team_id!==t.id);sup.forEach(student_id=>db.team_supervisors.push({id:uid('tsup'),team_id:t.id,student_id}));audit(user,'team.members_replace',{team_id:t.id,members:valid,supervisors:sup});await save();return json(res,200,teamView(t,user));
    }
    if ((r=route(req,p,'POST','/api/teams/:id/students'))) {
      const t=teamById(r.id);if(!t||!teamCanManage(user,t))fail(403,'لا تملك صلاحية إضافة طالب إلى هذا الفريق');
      const b=await body(req),name=clean(b.name,120),suppliedEmail=clean(b.email,200).toLowerCase(),password=String(b.password||'');
      if(name.length<2||(suppliedEmail&&!/^\S+@\S+\.\S+$/.test(suppliedEmail))||password.length<8)fail(400,'أدخل الاسم والبريد الصحيح إن وُجد وكلمة مرور مؤقتة لا تقل عن 8 أحرف');
      if(suppliedEmail&&db.users.some(x=>String(x.email).toLowerCase()===suppliedEmail))fail(409,'البريد مستخدم بالفعل');
      const email=suppliedEmail||('student-'+uid('mail')+'@no-email.invalid'),initialPassword=password;
      const group=db.groups.find(g=>g.id===t.group_id);if(!group)fail(404,'فوج الفريق غير موجود');
      const nu=coreService.createUser({name,email,password:initialPassword,role:'student'});
      const st={id:uid('s'),user_id:nu.id,parent_id:null,name,group_name:group.name||'',level:'المستوى الأساسي',attendance_rate:0,progress:0,memorized:'—',review:0,group_id:t.group_id};
      db.students.push(st);addMembership(st.id,t.group_id);db.team_members.push({id:uid('tmem'),team_id:t.id,student_id:st.id});
      audit(user,'team.student.create',{student_id:st.id,team_id:t.id,group_id:t.group_id});await save();
      return json(res,201,{id:st.id,name,group_id:t.group_id,team_id:t.id,initial_password:initialPassword,email:suppliedEmail});
    }
    if ((r=route(req,p,'POST','/api/teams/:id/tasks'))) {
      const t=teamById(r.id);if(!t||!teamCanManage(user,t))fail(404,'الفريق غير موجود أو لا تملك إدارته');const b=await body(req),title=clean(b.title,160);if(!title)fail(400,'عنوان المهمة مطلوب');const assigned=clean(b.assigned_student_id,80);if(assigned&&!teamStudentIds(t).includes(assigned))fail(400,'الطالب المكلّف ليس في الفريق');const task={id:uid('tt'),team_id:t.id,title,description:clean(b.description,800),assigned_student_id:assigned||null,due_date:isDate(b.due_date)?b.due_date:null,status:'pending',created_by:user.id,created_at:new Date().toISOString()};db.team_tasks.push(task);audit(user,'team.task_create',{team_id:t.id,id:task.id});await save();return json(res,201,task);
    }
    if ((r=route(req,p,'PATCH','/api/team-tasks/:id'))) {
      const task=db.team_tasks.find(x=>x.id===r.id);if(!task)fail(404,'المهمة غير موجودة');const t=teamById(task.team_id);if(!t||!teamVisibleTo(user,t))fail(404,'المهمة غير موجودة');const b=await body(req);const s=studentForUser(user);const supervisor=teamSupervisorIds(t).includes(s?.id);if(!teamCanManage(user,t)&&!(user.role==='student'&&task.assigned_student_id===s?.id))fail(403,'لا تملك تعديل هذه المهمة');if(b.status!==undefined&&!['pending','done','cancelled'].includes(b.status))fail(400,'حالة المهمة غير صحيحة');if(b.status!==undefined)task.status=b.status;if(teamCanManage(user,t)&&b.title!==undefined)task.title=clean(b.title,160);await save();audit(user,'team.task_update',{id:task.id,status:task.status});return json(res,200,task);}

    if (p === '/api/roster-imports' && req.method === 'POST') {
      requireStaff(user);
      const b=await body(req),gid=String(b.group_id||'');
      const group=db.groups.find(g=>g.id===gid);
      if(!group)fail(404,'الفوج غير موجود');
      if(user.role!=='admin'&&!teacherGroupIds(user).includes(gid))fail(403,'اختر فوجًا تشرف عليه');
      if(!Array.isArray(b.names))fail(400,'قائمة الأسماء غير صحيحة');
      const names=b.names.map(x=>clean(String(x||'').replace(/\s+/g,' '),120)).filter(Boolean);
      if(!names.length)fail(400,'أدخل اسمًا واحدًا على الأقل');
      if(names.length>500)fail(400,'الحد الأقصى 500 اسم في الدفعة الواحدة');
      if(names.some(n=>n.length<2))fail(400,'يوجد اسم قصير جدًا؛ راجع القائمة');
      const fingerprint=crypto.createHash('sha256').update(JSON.stringify({group_id:gid,names})).digest('hex');
      const prior=db.roster_imports.find(x=>x.group_id===gid&&x.fingerprint===fingerprint);
      if(prior)return json(res,200,{ok:true,duplicate_submission:true,created_count:0,existing_count:prior.student_ids.length,student_ids:prior.student_ids});
      const groupName=group.name;
      const created=[];
      for(const name of names){
        const st={id:uid('s'),user_id:null,parent_id:null,name,group_name:groupName,level:'المستوى الأساسي',attendance_rate:0,progress:0,memorized:'—',review:0,group_id:gid};
        db.students.push(st);addMembership(st.id,gid);created.push(st.id);
      }
      db.roster_imports.push({id:uid('ri'),user_id:user.id,group_id:gid,fingerprint,student_ids:created,created_at:new Date().toISOString()});
      audit(user,'roster.import',{group_id:gid,count:created.length});
      await save();
      return json(res,201,{ok:true,duplicate_submission:false,created_count:created.length,student_ids:created});
    }
    if (p === '/api/admin/groups' && req.method === 'GET') {
      requireAdmin();
      return json(res,200,db.groups.map(g=>({...g,student_count:new Set(db.memberships.filter(m=>m.group_id===g.id).map(m=>m.student_id)).size,teachers:db.teacher_groups.filter(x=>x.group_id===g.id).map(x=>{const t=db.users.find(u=>u.id===x.teacher_id);return t?{id:t.id,name:t.name,email:t.email}:null}).filter(Boolean)})));
    }
    // Teacher-scoped group management: a teacher can manage only groups assigned to them.
    if (p === '/api/teacher/groups' && req.method === 'POST') {
      requireStaff(user); if(user.role!=='teacher') fail(403,'هذه العملية مخصصة للشيخ');
      const b=await body(req), name=clean(b.name,120); if(!name) fail(400,'اسم الفوج مطلوب');
      if(db.groups.some(g=>g.name.trim().toLowerCase()===name.toLowerCase())) fail(409,'اسم الفوج مستخدم');
      const row={id:uid('g'),name,description:clean(b.description,600),level:clean(b.level,80)||'عام',active:true};
      db.groups.push(row); db.teacher_groups.push({teacher_id:user.id,group_id:row.id}); audit(user,'teacher.group.create',{id:row.id}); await save(); return json(res,201,row);
    }
    if ((r=route(req,p,'PATCH','/api/teacher/groups/:id'))) {
      requireStaff(user); if(user.role!=='teacher'||!teacherGroupIds(user).includes(r.id)) fail(403,'هذا الفوج خارج نطاقك');
      const g=db.groups.find(x=>x.id===r.id); if(!g) fail(404,'الفوج غير موجود'); const b=await body(req);
      if(b.name!==undefined){const name=clean(b.name,120);if(!name)fail(400,'اسم الفوج مطلوب');if(db.groups.some(x=>x.id!==g.id&&x.name.trim().toLowerCase()===name.toLowerCase()))fail(409,'اسم الفوج مستخدم');g.name=name;}
      if(b.description!==undefined)g.description=clean(b.description,600);if(b.level!==undefined)g.level=clean(b.level,80);
      audit(user,'teacher.group.update',{id:g.id});await save();return json(res,200,g);
    }
    if ((r=route(req,p,'DELETE','/api/teacher/groups/:id'))) {
      requireStaff(user);if(user.role!=='teacher'||!teacherGroupIds(user).includes(r.id))fail(403,'هذا الفوج خارج نطاقك');
      const g=db.groups.find(x=>x.id===r.id);if(!g)fail(404,'الفوج غير موجود');
      const members=db.memberships.some(x=>x.group_id===g.id)||db.students.some(x=>x.group_id===g.id),pending=db.group_join_requests.some(x=>x.requested_group_id===g.id&&x.status==='pending');
      if(members||pending)fail(409,'لا يمكن حذف فوج مرتبط بطلاب أو طلبات معلقة؛ عدّل الفوج أو اطلب من الإدارة تعطيله');
      db.teacher_groups=db.teacher_groups.filter(x=>!(x.teacher_id===user.id&&x.group_id===g.id));db.groups=db.groups.filter(x=>x.id!==g.id);audit(user,'teacher.group.delete',{id:g.id});await save();return json(res,200,{ok:true});
    }
    if (p === '/api/teacher/students' && req.method === 'POST') {
      requireStaff(user);if(user.role!=='teacher')fail(403,'هذه العملية مخصصة للشيخ');
      const b=await body(req),name=clean(b.name,120),suppliedEmail=clean(b.email,200).toLowerCase(),password=String(b.password||''),gid=String(b.group_id||'');
      if(name.length<2||(suppliedEmail&&!/^\S+@\S+\.\S+$/.test(suppliedEmail))||(password&&password.length<8))fail(400,'أدخل الاسم والبريد الصحيح إن وُجد وكلمة مرور مناسبة');
      if(!teacherGroupIds(user).includes(gid))fail(403,'اختر فوجًا تشرف عليه');if(suppliedEmail&&db.users.some(x=>String(x.email).toLowerCase()===suppliedEmail))fail(409,'البريد مستخدم بالفعل');
      const email=suppliedEmail||('student-'+uid('mail')+'@no-email.invalid'),initialPassword=password||crypto.randomBytes(18).toString('base64url');
      const nu=coreService.createUser({name,email,password:initialPassword,role:'student'});const st={id:uid('s'),user_id:nu.id,parent_id:null,name,group_name:(db.groups.find(g=>g.id===gid)||{}).name||'',level:clean(b.level,80)||'المستوى الأساسي',attendance_rate:0,progress:0,memorized:'—',review:0,group_id:gid};db.students.push(st);addMembership(st.id,gid);audit(user,'teacher.student.create',{student_id:st.id,group_id:gid});await save();return json(res,201,{id:st.id,name:st.name,group_id:gid,initial_password:initialPassword,email:suppliedEmail});
    }
    if ((r=route(req,p,'PATCH','/api/teacher/students/:id'))) {
      requireStaff(user);if(user.role!=='teacher')fail(403,'هذه العملية مخصصة للشيخ');const st=db.students.find(x=>x.id===r.id);if(!st||!canEdit(user,st))fail(403,'هذا الطالب خارج نطاقك');const b=await body(req);
      if(b.name!==undefined){const name=clean(b.name,120);if(name.length<2)fail(400,'الاسم قصير');st.name=name;const u=db.users.find(x=>x.id===st.user_id);if(u)u.name=name;}
      if(b.level!==undefined)st.level=clean(b.level,80);audit(user,'teacher.student.update',{student_id:st.id});await save();return json(res,200,studentView(st,user));
    }
    if ((r=route(req,p,'DELETE','/api/teacher/students/:id'))) {
      requireStaff(user);if(user.role!=='teacher')fail(403,'هذه العملية مخصصة للشيخ');const st=db.students.find(x=>x.id===r.id);if(!st||!canEdit(user,st))fail(403,'هذا الطالب خارج نطاقك');
      const u=db.users.find(x=>x.id===st.user_id);db.memberships=db.memberships.filter(m=>m.student_id!==st.id||!teacherGroupIds(user).includes(m.group_id));const remaining=db.memberships.some(m=>m.student_id===st.id);if(!remaining){st.group_id=null;st.group_name='';if(u)u.active=false;}
      audit(user,'teacher.student.remove_from_groups',{student_id:st.id});await save();return json(res,200,{ok:true,archived:true});
    }
    if (p === '/api/admin/groups' && req.method === 'POST') {
      requireAdmin(); const b=await body(req); const name=clean(b.name,120); if(!name) fail(400,'اسم الفوج مطلوب');
      if(db.groups.some(g=>g.name.trim().toLowerCase()===name.toLowerCase())) fail(409,'اسم الفوج مستخدم');
      const row={id:uid('g'),name,description:clean(b.description,600),level:clean(b.level,80)||'عام',active:b.active!==false};
      db.groups.push(row); audit(user,'group.create',{id:row.id}); await save(); return json(res,201,row);
    }
    if ((r=route(req,p,'PATCH','/api/admin/groups/:id'))) {
      requireAdmin(); const g=db.groups.find(x=>x.id===r.id); if(!g) fail(404,'الفوج غير موجود'); const b=await body(req);
      if(b.name!==undefined){const name=clean(b.name,120); if(!name) fail(400,'اسم الفوج مطلوب'); if(db.groups.some(x=>x.id!==g.id&&x.name.trim().toLowerCase()===name.toLowerCase())) fail(409,'اسم الفوج مستخدم'); g.name=name;}
      if(b.description!==undefined)g.description=clean(b.description,600); if(b.level!==undefined)g.level=clean(b.level,80); if(b.active!==undefined)g.active=!!b.active;
      audit(user,'group.update',{id:g.id}); await save(); return json(res,200,g);
    }
    if ((r=route(req,p,'DELETE','/api/admin/groups/:id'))) {
      requireAdmin(); const g=db.groups.find(x=>x.id===r.id); if(!g) fail(404,'الفوج غير موجود');
      const members=db.memberships.some(x=>x.group_id===g.id), teachers=db.teacher_groups.some(x=>x.group_id===g.id), pending=db.group_join_requests.some(x=>x.requested_group_id===g.id&&x.status==='pending');
      if(members||teachers||pending) fail(409,'لا يمكن حذف فوج مرتبط بطلاب أو معلمين أو طلبات معلقة؛ عطّله بدلًا من ذلك');
      db.groups=db.groups.filter(x=>x.id!==g.id); audit(user,'group.delete',{id:g.id}); await save(); return json(res,200,{ok:true});
    }
    if ((r=route(req,p,'PUT','/api/admin/groups/:id/teachers'))) {
      requireAdmin(); const g=db.groups.find(x=>x.id===r.id); if(!g) fail(404,'الفوج غير موجود'); const b=await body(req);
      if(!Array.isArray(b.teacher_ids)) fail(400,'قائمة المعلمين مطلوبة'); const ids=[...new Set(b.teacher_ids)].filter(id=>{const u=db.users.find(x=>x.id===id);return u&&u.role==='teacher'&&u.active!==false;});
      db.teacher_groups=db.teacher_groups.filter(x=>x.group_id!==g.id); ids.forEach(teacher_id=>db.teacher_groups.push({teacher_id,group_id:g.id})); audit(user,'group.teachers_replace',{group_id:g.id,teacher_ids:ids}); await save(); return json(res,200,{group_id:g.id,teacher_ids:ids});
    }
    if (p === '/api/admin/teachers' && req.method === 'GET') { requireAdmin(); return json(res,200,db.users.filter(x=>x.role==='teacher'&&x.active!==false).map(x=>({id:x.id,name:x.name,email:x.email}))); }
    /* ═══════════ العضوية في الأفواج والمناهج الإضافية V23 ═══════════ */
    if (p === '/api/group-requests' && req.method === 'GET') {
      const mine = db.group_join_requests.filter(r => user.role === 'admin' || r.requested_by === user.id || (user.role === 'teacher' && (teacherGroupIds(user).includes(r.current_group_id) || teacherGroupIds(user).includes(r.requested_group_id))));
      return json(res, 200, mine.sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))).map(r=>({ ...r,
        student_name:(db.students.find(s=>s.id===r.student_id)||{}).name||'',
        group_name:(db.groups.find(g=>g.id===r.requested_group_id)||{}).name||'',
        current_group_name:(db.groups.find(g=>g.id===r.current_group_id)||{}).name||'بدون فوج',
        reviewer_name:(db.users.find(u=>u.id===r.reviewed_by)||{}).name||''
      })));
    }
    if (p === '/api/group-requests' && req.method === 'POST') {
      const b=await body(req), target=db.groups.find(g=>g.id===b.group_id); if(!target) fail(404,'الفوج غير موجود');
      let st = user.role==='student' ? studentForUser(user) : db.students.find(s=>s.id===b.student_id);
      if(!st) fail(404,'الطالب غير موجود');
      if(user.role==='student' && st.user_id!==user.id) fail(403,'غير مسموح');
      if(user.role==='teacher' && !canEdit(user,st)) fail(403,'الطالب خارج نطاقك');
      if(user.role==='parent') fail(403,'ولي الأمر لا ينشئ طلبات تغيير الأفواج');
      if(user.role!=='admin' && hasMembership(st.id,target.id)) fail(409,'الطالب موجود أصلًا في هذا الفوج');
      if(db.group_join_requests.some(r=>r.student_id===st.id&&r.requested_group_id===target.id&&r.status==='pending')) fail(409,'هناك طلب معلّق بالفعل');
      const current=studentGroupIds(st)[0]||null;
      const mode=b.mode==='transfer'?'transfer':'join'; const row={id:uid('grq'),student_id:st.id,requested_group_id:target.id,current_group_id:current,mode,reason:clean(b.reason,500),requested_by:user.id,status:'pending',created_at:new Date().toISOString(),reviewed_by:null,reviewed_at:null,review_note:''};
      db.group_join_requests.push(row); audit(user,'group_join_request',{id:row.id,student_id:st.id,group_id:target.id}); await save(); return json(res,201,row);
    }
    if ((r=route(req,p,'POST','/api/group-requests/:id/cancel'))) {
      const row=db.group_join_requests.find(x=>x.id===r.id); if(!row) fail(404,'الطلب غير موجود');
      if(row.status!=='pending') fail(409,'لا يمكن إلغاء طلب تمت معالجته');
      const st=db.students.find(s=>s.id===row.student_id);
      if(user.role!=='admin' && (!st || st.user_id!==user.id) && !(user.role==='teacher' && row.requested_by===user.id)) fail(403,'غير مسموح');
      row.status='cancelled'; row.reviewed_by=user.id; row.reviewed_at=new Date().toISOString(); row.review_note=clean((await body(req)).note,500)||'أُلغي الطلب';
      audit(user,'group_request_cancel',{id:row.id}); await save(); return json(res,200,row);
    }
    if ((r=route(req,p,'POST','/api/group-requests/:id/review'))) {
      if(user.role!=='admin') fail(403,'موافقة طلبات تغيير الأفواج من صلاحية المدير');
      const row=db.group_join_requests.find(x=>x.id===r.id); if(!row) fail(404,'الطلب غير موجود');
      const b=await body(req), decision=b.decision==='approve'?'approved':b.decision==='reject'?'rejected':null; if(!decision) fail(400,'القرار غير صحيح');
      row.status=decision; row.reviewed_by=user.id; row.reviewed_at=new Date().toISOString(); row.review_note=clean(b.note,500);
      if(decision==='approved'){ if(row.mode==='transfer') db.memberships=db.memberships.filter(m=>m.student_id!==row.student_id); addMembership(row.student_id,row.requested_group_id); const st=db.students.find(s=>s.id===row.student_id); if(st){st.group_id=row.requested_group_id;st.group_name=(db.groups.find(g=>g.id===row.requested_group_id)||{}).name||'';} }
      audit(user,'group_request_review',{id:row.id,decision}); await save(); return json(res,200,row);
    }
    if ((r=route(req,p,'PATCH','/api/admin/students/:id/groups'))) {
      requireStaff(user); if(user.role!=='admin') fail(403,'تغيير العضوية المباشر من صلاحية المدير فقط');
      const st=db.students.find(s=>s.id===r.id); if(!st) fail(404,'الطالب غير موجود');
      const b=await body(req), gids=Array.isArray(b.group_ids)?[...new Set(b.group_ids.filter(id=>db.groups.some(g=>g.id===id)))]:[];
      db.memberships=db.memberships.filter(m=>m.student_id!==st.id); gids.forEach(gid=>addMembership(st.id,gid)); st.group_id=gids[0]||null; st.group_name=gids[0]?((db.groups.find(g=>g.id===gids[0])||{}).name||''):'';
      audit(user,'student_groups_replace',{student_id:st.id,group_ids:gids}); await save(); return json(res,200,studentView(st,user));
    }
    if (p === '/api/optional-curriculum' && req.method === 'GET') {
      const s=studentForUser(user); const enrolled=new Set((s?db.optional_enrollments.filter(x=>x.student_id===s.id&&x.status!=='withdrawn'):[]).map(x=>x.subject_id));
      return json(res,200,db.subjects.filter(x=>x.active!==false&&x.required===false).map(x=>({...x,enrolled:enrolled.has(x.id),lesson_count:db.lessons.filter(l=>l.subject_id===x.id).length})));
    }
    if (p === '/api/optional-curriculum' && req.method === 'POST') {
      if(user.role!=='student') fail(403,'المشاركة في المناهج الإضافية متاحة للطالب');
      const b=await body(req), s=studentForUser(user), sub=db.subjects.find(x=>x.id===String(b.subject_id)); if(!s||!sub||sub.required!==false) fail(400,'المادة الإضافية غير متاحة');
      let row=db.optional_enrollments.find(x=>x.student_id===s.id&&x.subject_id===sub.id); if(row) row.status='active'; else { row={id:uid('oe'),student_id:s.id,subject_id:sub.id,status:'active',enrolled_at:new Date().toISOString()}; db.optional_enrollments.push(row); }
      audit(user,'optional_enroll',{subject_id:sub.id}); await save(); return json(res,201,row);
    }
    if ((r=route(req,p,'DELETE','/api/optional-curriculum/:subject_id'))) {
      if(user.role!=='student') fail(403,'غير مسموح'); const s=studentForUser(user), row=db.optional_enrollments.find(x=>x.student_id===s?.id&&x.subject_id===r.subject_id); if(!row) fail(404,'المشاركة غير موجودة'); row.status='withdrawn'; audit(user,'optional_withdraw',{subject_id:r.subject_id}); await save(); return json(res,200,row);
    }

    /* الأفواج والطلاب */
    if (p === '/api/groups' && req.method === 'GET') {
      const g = visibleGroupIds(user);
      return json(res, 200, coreRepo.allGroups().filter(x => g.includes(x.id)).map(x => ({ ...x, student_count: new Set(coreRepo.memberships().filter(m => m.group_id === x.id).map(m => m.student_id)).size })));
    }
    if (p === '/api/students' && req.method === 'GET') return json(res, 200, scopedStudents(user).map(s => studentView(s, user)));
    if (p === '/api/core/summary' && req.method === 'GET') {
      return json(res, 200, { users: coreRepo.allUsers().length, groups: coreRepo.allGroups().length, students: coreRepo.allStudents().length, storage: storage.kind });
    }
    if ((r = route(req, p, 'GET', '/api/students/:id/file'))) {
      const s = getStudent(user, r.id);
      const month = isMonth(q.month) ? q.month : localISO().slice(0, 7);
      return json(res, 200, buildFile(user, s, month));
    }
    if ((r = route(req, p, 'GET', '/api/students/:id'))) return json(res, 200, studentView(getStudent(user, r.id), user));

    /* المنهج */
    if (p === '/api/subjects' && req.method === 'GET') return json(res, 200, db.subjects.filter(x=>user.role==='admin'||x.active!==false));
    if (p === '/api/lessons' && req.method === 'GET') return json(res, 200, (q.subject_id ? db.lessons.filter(x => x.subject_id === q.subject_id) : db.lessons).filter(x=>user.role==='admin'||x.active!==false));
    if ((r = route(req, p, 'GET', '/api/lessons/:id'))) {
      const lesson = db.lessons.find(x => x.id === r.id);
      if (!lesson || !lessonAccessible(user, lesson)) return json(res, 404, { error: 'الدرس غير موجود' });
      const s = user.role === 'student' ? scopedStudents(user)[0] : null;
      const progress = s ? db.lesson_progress.find(x => x.student_id === s.id && x.lesson_id === lesson.id) : null;
      const typeMap = { memorize: 'حفظ', review: 'مراجعة', apply: 'تطبيق', understand: 'فهم', discussion: 'نقاش', optional: 'اختياري' };
      return json(res, 200, { lesson: {
        ...lesson,
        subject_name: (db.subjects.find(x => x.id === lesson.subject_id) || {}).name || '',
        duration_minutes: Number(lesson.duration_minutes) || 15,
        objective: lesson.objective || lesson.description || 'فهم الفكرة الأساسية وتطبيقها بخطوة عملية صغيرة.',
        content: lesson.content || lesson.description || 'لا يوجد محتوى تفصيلي لهذا الدرس بعد.',
        type_label: typeMap[lesson.lesson_type] || 'درس',
        completed: !!progress, completed_at: progress?.completed_at || null
      }});
    }
    const visibleSchedule = () => { const g = visibleGroupIds(user); return db.schedule.filter(x => user.role === 'admin' || !x.group_id || g.includes(x.group_id)); };
    if (p === '/api/schedule' && req.method === 'GET') return json(res, 200, visibleSchedule());
    if (p === '/api/curriculum' && req.method === 'GET') {
      return json(res, 200, {
        subjects: db.subjects, lessons: db.lessons.slice(0, 100), schedule: visibleSchedule(),
        classifications: [
          { id: 'memorize', name: 'حفظ', description: 'مادة يراد تثبيتها واستحضارها.' },
          { id: 'understand', name: 'فهم', description: 'مادة يركز فيها على الفهم والتحليل.' },
          { id: 'review', name: 'مراجعة', description: 'مادة سبق تعلمها وتحتاج إلى تثبيت.' },
          { id: 'apply', name: 'تطبيق', description: 'تحويل العلم إلى سلوك أو مهارة عملية.' },
          { id: 'discussion', name: 'نقاش', description: 'حوار وأسئلة ومناقشة منظمة.' },
          { id: 'optional', name: 'اختياري', description: 'مادة إضافية لمن يريد التوسع.' }
        ]
      });
    }

    /* التعلم الفعلي: الدروس والتقدم الشخصي */
    if (p === '/api/learning' && req.method === 'GET') {
      const s = scopedStudents(user)[0];
      if (!s) return json(res, 200, { student: null, subjects: [], lessons: [] });
      const done = db.lesson_progress.filter(x => x.student_id === s.id);
      const doneMap = new Map(done.map(x => [x.lesson_id, x]));
      const enrolledOptional = new Set(db.optional_enrollments.filter(x => x.student_id===s.id && x.status!=='withdrawn').map(x=>x.subject_id));
      const allowedSubject = x => x.active !== false && (x.required !== false || enrolledOptional.has(x.id));
      const subjects = db.subjects.filter(allowedSubject).map(x => {
        const ls = db.lessons.filter(l => l.subject_id === x.id);
        const completed = ls.filter(l => doneMap.has(l.id)).length;
        return { ...x, lesson_count: ls.length, completed, progress: ls.length ? Math.round(completed / ls.length * 100) : 0 };
      });
      const lessons = db.lessons.filter(l => subjects.some(x => x.id === l.subject_id)).sort((a,b) => (a.subject_id+a.order_no).localeCompare(b.subject_id+b.order_no)).map(l => ({ ...l, subject_name: (db.subjects.find(x => x.id === l.subject_id) || {}).name || '', completed: doneMap.has(l.id), completed_at: doneMap.get(l.id)?.completed_at || null }));
      return json(res, 200, { student: studentView(s, user), subjects, lessons });
    }
    if (p === '/api/learning/questions' && req.method === 'GET') {
      if (user.role !== 'student') fail(403, 'التدريب الذاتي متاح للطالب فقط');
      const student = scopedStudents(user)[0];
      if (!student) return json(res, 200, { lesson_id: q.lesson_id || '', questions: [] });
      const lesson = db.lessons.find(x => x.id === String(q.lesson_id || ''));
      if (!lesson || !lessonAccessible(user, lesson)) fail(404, 'الدرس غير موجود');
      const questions = db.question_bank.filter(x => x.lesson_id === lesson.id && x.active !== false && ['single_choice', 'true_false'].includes(x.type)).map(x => ({
        id: x.id, type: x.type, title: x.title, options: Array.isArray(x.options) ? x.options : [], points: Math.max(1, Number(x.points) || 1)
      }));
      return json(res, 200, { lesson_id: lesson.id, questions });
    }
    if (p === '/api/learning/attempts' && req.method === 'POST') {
      if (user.role !== 'student') fail(403, 'التدريب الذاتي متاح للطالب فقط');
      const student = scopedStudents(user)[0];
      if (!student) fail(403, 'لا يوجد ملف طالب مرتبط بهذا الحساب');
      const b = await body(req), lesson = db.lessons.find(x => x.id === String(b.lesson_id || ''));
      const question = db.question_bank.find(x => x.id === String(b.question_id || ''));
      if (!lesson || !lessonAccessible(user, lesson) || !question || question.lesson_id !== lesson.id || question.active === false || !['single_choice', 'true_false'].includes(question.type)) fail(404, 'السؤال غير متاح');
      const answer = clean(String(b.answer == null ? '' : b.answer), 300);
      if (!answer) fail(400, 'اختر إجابة أولًا');
      const correct = answer.trim().toLowerCase() === String(question.correct_answer || '').trim().toLowerCase();
      const alreadyCorrect = db.question_attempts.some(x => x.student_id === student.id && x.question_id === question.id && x.correct === true);
      const pointsAwarded = correct && !alreadyCorrect ? Math.max(1, Number(question.points) || 1) : 0;
      const attempt = { id: uid('qa'), student_id: student.id, lesson_id: lesson.id, question_id: question.id, answer, correct, points_awarded: pointsAwarded, attempted_at: new Date().toISOString() };
      db.question_attempts.push(attempt);
      audit(user, 'learning.question_attempt', { lesson_id: lesson.id, question_id: question.id, correct });
      await save();
      return json(res, 200, { correct, correct_answer: question.correct_answer, explanation: question.explanation || '', points_awarded: pointsAwarded, already_correct: alreadyCorrect });
    }
    if ((r = route(req, p, 'POST', '/api/lessons/:id/complete'))) {
      if (user.role !== 'student') return json(res, 403, { error: 'هذه العملية متاحة للطالب فقط' });
      const s = scopedStudents(user)[0], lesson = db.lessons.find(x => x.id === r.id);
      if (!s || !lesson || !lessonAccessible(user, lesson)) return json(res, 404, { error: 'الدرس غير موجود' });
      let row = db.lesson_progress.find(x => x.student_id === s.id && x.lesson_id === lesson.id);
      if (row) row.completed_at = new Date().toISOString();
      else { row = { id: uid('lp'), student_id: s.id, lesson_id: lesson.id, completed_at: new Date().toISOString() }; db.lesson_progress.push(row); }
      audit(user, 'lesson_complete', { lesson_id: lesson.id }); await save();
      return json(res, 200, { ok: true, progress: row });
    }
    if ((r = route(req, p, 'POST', '/api/lessons/:id/uncomplete'))) {
      if (user.role !== 'student') return json(res, 403, { error: 'هذه العملية متاحة للطالب فقط' });
      const s = scopedStudents(user)[0];
      const i = db.lesson_progress.findIndex(x => x.student_id === (s || {}).id && x.lesson_id === r.id);
      if (i >= 0) db.lesson_progress.splice(i, 1);
      audit(user, 'lesson_uncomplete', { lesson_id: r.id }); await save();
      return json(res, 200, { ok: true });
    }

    /* الحضور */
    if (p === '/api/attendance/weekly-report' && req.method === 'GET') {
      requireStaff(user);
      const end = q.end || localISO(), start = q.start || addDays(end, -6);
      return json(res,200,buildWeeklyAttendanceReport(user,start,end,q.group_id||''));
    }
    if (p === '/api/schools' && req.method === 'GET') {
      return json(res,200,db.schools.filter(x=>x.active!==false).map(sc=>({id:sc.id,name:sc.name,type:sc.type,description:sc.description,director_name:sc.director_user_id?(db.users.find(u=>u.id===sc.director_user_id)||{}).name||null:null,group_count:db.groups.filter(g=>g.school_id===sc.id).length}))); 
    }
    if (p === '/api/attendance/sheet' && req.method === 'GET') {
      requireStaff(user);
      if (!ownsGroup(user, q.group_id)) return json(res, 403, { error: 'هذا الفوج خارج نطاقك' });
      const date = q.date || localISO(); checkAttDate(date);
      const roster = db.students.filter(s => studentGroupIds(s).includes(q.group_id));
      return json(res, 200, {
        group: db.groups.find(g => g.id === q.group_id), date,
        students: roster.map(s => { const a = db.attendance.find(x => x.student_id === s.id && x.date === date); return { id: s.id, name: s.name, status: a ? a.status : null, note: a ? a.note : '' }; })
      });
    }
    if (p === '/api/attendance/bulk' && req.method === 'POST') {
      requireStaff(user);
      const b = await body(req);
      if (!ownsGroup(user, b.group_id)) return json(res, 403, { error: 'هذا الفوج خارج نطاقك' });
      checkAttDate(b.date);
      if (!Array.isArray(b.records) || b.records.length > 300) return json(res, 400, { error: 'قائمة الحضور غير صحيحة' });
      const roster = db.students.filter(s => studentGroupIds(s).includes(b.group_id)).map(s => s.id);
      const todo = [];
      const seenStudents = new Set();
      for (const rec of b.records) {
        if (!rec || !rec.status) continue;
        if (typeof rec.student_id !== 'string' || !rec.student_id) return json(res, 400, { error: 'معرّف الطالب غير صحيح' });
        if (seenStudents.has(rec.student_id)) return json(res, 400, { error: 'تكرر الطالب في سجل الحضور؛ أعد تحميل القائمة' });
        seenStudents.add(rec.student_id);
        if (!roster.includes(rec.student_id)) return json(res, 403, { error: 'طالب ليس من هذا الفوج' });
        if (!ATT_STATUS.includes(rec.status)) return json(res, 400, { error: 'حالة حضور غير صحيحة' });
        todo.push(rec);
      }
      todo.forEach(rec => upsertAttendance(rec.student_id, b.date, rec.status, clean(rec.note, 300), user));
      await save(); return json(res, 200, { saved: todo.length });
    }
    if (p === '/api/attendance' && req.method === 'POST') {
      requireStaff(user);
      const b = await body(req);
      if (!b.student_id || !b.date || !b.status) return json(res, 400, { error: 'بيانات الحضور ناقصة' });
      if (!ATT_STATUS.includes(b.status)) return json(res, 400, { error: 'حالة غير صحيحة' });
      checkAttDate(b.date);
      const s = getStudent(user, b.student_id, true);
      const row = upsertAttendance(s.id, b.date, b.status, clean(b.note, 300), user);
      await save(); return json(res, 201, row);
    }
    if (p === '/api/attendance' && req.method === 'GET') {
      const ids = scopedStudents(user).map(s => s.id);
      return json(res, 200, db.attendance.filter(a => ids.includes(a.student_id)));
    }

    /* النقل الجماعي للطلبة */
    if (p === '/api/transport' && req.method === 'GET') {
      const routes = db.transport_routes.filter(x => x.active !== false).map(r => ({
        ...r,
        assignments: db.transport_assignments.filter(a => a.route_id === r.id).map(a => ({...a, student: db.students.find(s=>s.id===a.student_id)||null})).filter(a=>a.student)
      }));
      if (user.role === 'admin') return json(res,200,routes);
      const ids = new Set(scopedStudents(user).map(s=>s.id));
      return json(res,200,routes.map(r=>({...r, assignments:r.assignments.filter(a=>ids.has(a.student_id))})).filter(r=>user.role==='student'||user.role==='parent' ? r.assignments.length : true));
    }
    if (p === '/api/admin/transport/routes' && req.method === 'POST') {
      requireAdmin(); const b=await body(req); const name=clean(b.name,120); if(!name) fail(400,'اسم خط النقل مطلوب');
      const row={id:uid('tr'),name,driver:clean(b.driver,120),phone:clean(b.phone,40),vehicle:clean(b.vehicle,120),pickup_points:Array.isArray(b.pickup_points)?b.pickup_points.slice(0,30).map(x=>clean(x,160)).filter(Boolean):[],active:b.active!==false};
      db.transport_routes.push(row); audit(user,'transport.route_create',{id:row.id}); await save(); return json(res,201,row);
    }
    if ((r=route(req,p,'PATCH','/api/admin/transport/routes/:id'))) {
      requireAdmin(); const x=db.transport_routes.find(x=>x.id===r.id); if(!x)fail(404,'خط النقل غير موجود'); const b=await body(req);
      for(const k of ['name','driver','phone','vehicle']) if(b[k]!==undefined)x[k]=clean(b[k],k==='phone'?40:120);
      if(b.pickup_points!==undefined)x.pickup_points=Array.isArray(b.pickup_points)?b.pickup_points.slice(0,30).map(v=>clean(v,160)).filter(Boolean):[];
      if(b.active!==undefined)x.active=!!b.active; audit(user,'transport.route_update',{id:x.id}); await save(); return json(res,200,x);
    }
    if (p === '/api/admin/transport/assign' && req.method === 'POST') {
      requireAdmin(); const b=await body(req); if(!db.transport_routes.some(r=>r.id===b.route_id))fail(400,'خط النقل غير موجود'); if(!db.students.some(s=>s.id===b.student_id))fail(400,'الطالب غير موجود');
      const exists=db.transport_assignments.find(a=>a.route_id===b.route_id&&a.student_id===b.student_id); if(exists)return json(res,200,exists);
      const row={id:uid('ta'),route_id:b.route_id,student_id:b.student_id,stop:clean(b.stop,160),notes:clean(b.notes,300),active:b.active!==false}; db.transport_assignments.push(row); audit(user,'transport.assign',{id:row.id}); await save(); return json(res,201,row);
    }
    if ((r=route(req,p,'DELETE','/api/admin/transport/assign/:id'))) {
      requireAdmin(); const i=db.transport_assignments.findIndex(x=>x.id===r.id); if(i<0)fail(404,'اشتراك النقل غير موجود'); db.transport_assignments.splice(i,1); audit(user,'transport.unassign',{id:r.id}); await save(); return json(res,200,{ok:true});
    }

    /* الاختبارات والدرجات */
    if (p === '/api/tests' && req.method === 'GET') return json(res, 200, testsFor(user).map(t => enrichTest(t, user)).sort((a, b) => b.date.localeCompare(a.date)));
    if (p === '/api/tests' && req.method === 'POST') {
      requireStaff(user);
      const b = await body(req);
      const title = clean(b.title, 160), max = Number(b.max_score);
      if (!title) return json(res, 400, { error: 'عنوان الاختبار مطلوب' });
      if (!db.subjects.some(s => s.id === b.subject_id)) return json(res, 400, { error: 'اختر المادة' });
      if (!ownsGroup(user, b.group_id)) return json(res, 403, { error: 'هذا الفوج خارج نطاقك' });
      if (!isDate(b.date)) return json(res, 400, { error: 'تاريخ الاختبار غير صحيح' });
      const testTerm = b.term_id ? db.terms.find(x => x.id === b.term_id) : termForDate(b.date);
      if (b.term_id && !testTerm) return json(res, 400, { error: 'الفصل الدراسي غير موجود' });
      if (testTerm && (b.date < testTerm.start || b.date > testTerm.end)) return json(res, 400, { error: 'تاريخ الاختبار خارج حدود الفصل' });
      if (!Number.isFinite(max) || max <= 0 || max > 1000) return json(res, 400, { error: 'الدرجة القصوى يجب أن تكون بين 1 و 1000' });
      const testTypes=['memorize','understand','apply','discussion','practical'];
      if (b.type !== undefined && !testTypes.includes(b.type)) return json(res,400,{error:'نوع الاختبار غير صحيح'});
      const t = { id: uid('t'), group_id: b.group_id, subject_id: b.subject_id, title, description: clean(b.description, 500), date: b.date, term_id: testTerm ? testTerm.id : null, max_score: max, type: testTypes.includes(b.type)?b.type:'understand', status: 'scheduled', created_by: user.id };
      db.tests.push(t);
      db.notifications.unshift({ id: uid('n'), title: 'اختبار جديد: ' + title, body: `موعد الاختبار ${b.date}`, group_id: t.group_id, read_by: [], created_at: new Date().toISOString() });
      await save(); return json(res, 201, enrichTest(t, user));
    }
    if ((r = route(req, p, 'GET', '/api/tests/:id/grades'))) {
      requireStaff(user);
      const t = getTestForStaff(user, r.id);
      const roster = db.students.filter(s => studentGroupIds(s).includes(t.group_id));
      return json(res, 200, {
        test: enrichTest(t, user),
        students: roster.map(s => { const g = db.grades.find(x => x.test_id === t.id && x.student_id === s.id); return { id: s.id, name: s.name, score: g ? g.score : null, note: g ? g.note : '' }; })
      });
    }
    if ((r = route(req, p, 'POST', '/api/tests/:id/grades'))) {
      requireStaff(user);
      const t = getTestForStaff(user, r.id), b = await body(req);
      if (!Array.isArray(b.grades) || b.grades.length > 300) return json(res, 400, { error: 'قائمة الدرجات غير صحيحة' });
      const roster = db.students.filter(s => studentGroupIds(s).includes(t.group_id));
      const todo = [];
      for (const row of b.grades) {
        if (!row || row.score === '' || row.score == null) continue;
        const s = roster.find(x => x.id === row.student_id);
        if (!s) return json(res, 403, { error: 'طالب ليس من فوج هذا الاختبار' });
        const score = parseScore(row.score, t.max_score);
        if (score == null) return json(res, 400, { error: `درجة ${s.name} يجب أن تكون بين 0 و ${t.max_score}` });
        todo.push({ s, score, note: clean(row.note, 300) });
      }
      todo.forEach(x => upsertGrade(t, x.s.id, x.score, x.note, user));
      const graded = roster.filter(s => db.grades.some(g => g.test_id === t.id && g.student_id === s.id)).length;
      t.status = roster.length && graded === roster.length ? 'graded' : graded ? 'in_progress' : t.status;
      await save(); return json(res, 200, { saved: todo.length, status: t.status });
    }
    if (p === '/api/grades' && req.method === 'POST') {   // مسار V14 (درجة واحدة) — بعد تشديد التحقق
      requireStaff(user);
      const b = await body(req);
      const t = getTestForStaff(user, b.test_id);
      const s = getStudent(user, b.student_id, true);
      if (!studentGroupIds(s).includes(t.group_id)) return json(res, 403, { error: 'الطالب ليس من فوج هذا الاختبار' });
      const score = parseScore(b.score, t.max_score);
      if (score == null) return json(res, 400, { error: `الدرجة يجب أن تكون بين 0 و ${t.max_score}` });
      const row = upsertGrade(t, s.id, score, clean(b.note, 300), user);
      await save(); return json(res, 201, row);
    }
    if (p === '/api/grades' && req.method === 'GET') {
      const ids = scopedStudents(user).map(s => s.id);
      return json(res, 200, db.grades.filter(g => ids.includes(g.student_id)));
    }

    /* الملاحظات */
    if (p === '/api/teacher-notes' && req.method === 'POST') {
      requireStaff(user);
      const b = await body(req);
      const text = clean(b.text, 1000), cat = b.category || 'تعليمي';
      if (!b.student_id || !text) return json(res, 400, { error: 'الملاحظة ناقصة' });
      if (!NOTE_CATS.includes(cat)) return json(res, 400, { error: 'تصنيف غير صحيح' });
      const s = getStudent(user, b.student_id, true);
      const row = { id: uid('n'), student_id: s.id, teacher_id: user.id, teacher_name: user.name, date: localISO(), text, category: cat, shared: b.shared === true };
      db.teacher_notes.push(row); await save();
      return json(res, 201, { ...row, student_name: s.name });
    }
    if (p === '/api/teacher-notes' && req.method === 'GET') {
      let ids = scopedStudents(user).map(s => s.id);
      if (q.student_id) ids = ids.filter(i => i === q.student_id);
      return json(res, 200, notesFor(user, ids));
    }

    /* التقارير */
    if (p === '/api/reports' && req.method === 'GET') {
      const ids = scopedStudents(user).map(s => s.id);
      return json(res, 200, db.reports.filter(x => ids.includes(x.student_id)));
    }
    if (p === '/api/reports/monthly' && req.method === 'GET') {
      const s = getStudent(user, q.student_id);
      const month = isMonth(q.month) ? q.month : localISO().slice(0, 7);
      return json(res, 200, { student: studentView(s, user), report: computeMonthly(user, s, month) });
    }
    if (p === '/api/reports/generate' && req.method === 'POST') {
      requireStaff(user);
      const b = await body(req);
      const s = getStudent(user, b.student_id, true);
      if (!isMonth(b.month)) return json(res, 400, { error: 'الشهر غير صحيح' });
      const m = computeMonthly(user, s, b.month);
      const snap = {
        id: uid('r'), student_id: s.id, period: b.month, type: 'monthly', auto: true,
        attendance_rate: m.attendance.rate == null ? 0 : m.attendance.rate,
        memorization_mastery: m.memorization.mastery == null ? 0 : m.memorization.mastery,
        average: m.grades.average == null ? 0 : m.grades.average,
        goals_progress: m.goals.progress == null ? 0 : m.goals.progress,
        summary: m.summary, strengths: m.strengths, improvements: m.improvements,
        generated_at: new Date().toISOString(), generated_by: user.id
      };
      const i = db.reports.findIndex(x => x.student_id === s.id && x.period === b.month && x.type === 'monthly');
      if (i >= 0) { snap.id = db.reports[i].id; db.reports[i] = snap; } else db.reports.push(snap);
      await save(); return json(res, 201, snap);
    }

    /* الحفظ والأهداف والمراجعة */
    const withName = x => ({ ...x, student_name: (db.students.find(s => s.id === x.student_id) || {}).name || '' });
    const mine = list => { const ids = scopedStudents(user).map(s => s.id); return list.filter(x => ids.includes(x.student_id)).map(withName); };
    if (p === '/api/memorization' && req.method === 'GET') return json(res, 200, mine(db.memorization));
    if (p === '/api/goals' && req.method === 'GET') return json(res, 200, mine(db.goals));
    if (p === '/api/goals' && req.method === 'POST') {
      if (user.role !== 'student') return json(res, 403, { error: 'إضافة الهدف متاحة للطالب من حسابه' });
      const s = scopedStudents(user)[0], b = await body(req);
      const title = clean(b.title, 120), target = clean(b.target, 240);
      if (!s || !title || !target) return json(res, 400, { error: 'عنوان الهدف وطريقته مطلوبان' });
      const row = { id: uid('goal'), student_id: s.id, title, type: clean(b.type, 40) || 'personal', target, progress: 0, status: 'active', created_at: new Date().toISOString() };
      db.goals.push(row); audit(user, 'goal_create', { goal_id: row.id }); await save();
      return json(res, 201, row);
    }
    if ((r = route(req, p, 'POST', '/api/goals/:id/progress'))) {
      const g = getGoalForUser(user, r.id, true), b = await body(req), n = Number(b.progress);
      if (!Number.isFinite(n) || n < 0 || n > 100) return json(res, 400, { error: 'التقدم يجب أن يكون بين 0 و100' });
      g.progress = Math.round(n); if (g.progress === 100) g.status = 'completed'; else if (g.status === 'completed') g.status = 'active';
      audit(user, 'goal_progress', { goal_id: g.id, progress: g.progress }); await save(); return json(res, 200, g);
    }
    if (p === '/api/review' && req.method === 'GET') { const today = localISO(); return json(res, 200, mine(db.memorization).filter(x => x.next_review_at && x.next_review_at <= today)); }


    /* ═══════════ الحياة الدراسية V23 ═══════════
       واجبات + تقويم مؤسسي + مراسلات داخلية. كل مورد محكوم بنطاق الدور. */
    const myStudent = () => scopedStudents(user)[0] || null;
    const assignmentFor = id => db.assignments.find(x => x.id === id);
    const assignmentVisible = a => {
      if (!a) return false;
      if (user.role === 'admin') return true;
      if (user.role === 'teacher') return ownsGroup(user, a.group_id);
      return scopedStudents(user).some(s => studentGroupIds(s).includes(a.group_id));
    };
    if (p === '/api/assignments' && req.method === 'GET') {
      const list = db.assignments.filter(assignmentVisible).sort((a,b) => String(a.due_date).localeCompare(String(b.due_date)) || String(b.created_at).localeCompare(String(a.created_at)));
      return json(res, 200, list.map(a => {
        const sub = db.assignment_submissions.find(x => x.assignment_id === a.id && scopedStudents(user).some(s => s.id === x.student_id));
        return { ...a, subject_name: (db.subjects.find(s => s.id === a.subject_id)||{}).name || '', group_name: (db.groups.find(g => g.id === a.group_id)||{}).name || '', submission: sub ? {status:sub.status, submitted_at:sub.submitted_at, grade:sub.grade, note:sub.note} : null};
      }));
    }
    if (p === '/api/assignments' && req.method === 'POST') {
      requireStaff(user); const b = await body(req); const title=clean(b.title,160), description=clean(b.description,4000), due=isDate(b.due_date)?b.due_date:null;
      if (!title || !due || !ownsGroup(user,b.group_id)) fail(400,'عنوان الواجب والتاريخ وفوجك مطلوبة');
      if (b.subject_id && !db.subjects.some(x=>x.id===b.subject_id)) fail(400,'المادة غير موجودة');
      const row={id:uid('as'),title,description,subject_id:b.subject_id||null,group_id:b.group_id,due_date:due,max_score:Math.max(1,Math.min(1000,Number(b.max_score)||10)),created_by:user.id,created_at:new Date().toISOString()};
      db.assignments.push(row); db.notifications.push({id:uid('n'),title:'واجب جديد: '+title,body:'تم نشر واجب جديد لفوجك. موعد التسليم '+due,group_id:row.group_id,created_at:new Date().toISOString(),read_by:[]}); audit(user,'assignment_create',{id:row.id,group_id:row.group_id}); await save(); return json(res,201,row);
    }
    if ((r=route(req,p,'GET','/api/assignments/:id'))) {
      const a=assignmentFor(r.id); if(!assignmentVisible(a)) fail(404,'الواجب غير موجود');
      const subs=db.assignment_submissions.filter(x=>x.assignment_id===a.id).filter(x=>user.role==='admin'||(user.role==='teacher'&&ownsGroup(user,a.group_id)||canView(user,db.students.find(s=>s.id===x.student_id))));
      return json(res,200,{...a,subject_name:(db.subjects.find(s=>s.id===a.subject_id)||{}).name||'',group_name:(db.groups.find(g=>g.id===a.group_id)||{}).name||'',submissions:subs.map(x=>({...x,student_name:(db.students.find(s=>s.id===x.student_id)||{}).name||''}))});
    }
    if ((r=route(req,p,'POST','/api/assignments/:id/submit'))) {
      const a=assignmentFor(r.id), s=myStudent(); if(!a||!assignmentVisible(a)||!s||!studentGroupIds(s).includes(a.group_id)) fail(403,'لا يمكنك تسليم هذا الواجب');
      const b=await body(req), answer=clean(b.answer,6000); if(!answer) fail(400,'الإجابة مطلوبة');
      const now=new Date(), late=a.due_date && a.due_date < localISO(now); const row={id:uid('sub'),assignment_id:a.id,student_id:s.id,answer,status:late?'late':'submitted',submitted_at:now.toISOString(),grade:null,note:late?'تسليم متأخر':'' ,graded_by:null};
      const i=db.assignment_submissions.findIndex(x=>x.assignment_id===a.id&&x.student_id===s.id); if(i>=0){row.id=db.assignment_submissions[i].id;db.assignment_submissions[i]=row}else db.assignment_submissions.push(row);
      audit(user,'assignment_submit',{assignment_id:a.id}); await save(); return json(res,201,row);
    }
    if ((r=route(req,p,'POST','/api/assignments/:id/grade'))) {
      requireStaff(user); const a=assignmentFor(r.id); if(!a||!ownsGroup(user,a.group_id)) fail(404,'الواجب غير موجود');
      const b=await body(req), st=db.students.find(s=>s.id===b.student_id); if(!st||!canEdit(user,st)||!studentGroupIds(st).includes(a.group_id)) fail(403,'الطالب خارج نطاقك');
      const score=Number(b.grade); if(!Number.isFinite(score)||score<0||score>a.max_score) fail(400,'الدرجة غير صحيحة');
      const sub=db.assignment_submissions.find(x=>x.assignment_id===a.id&&x.student_id===st.id); if(!sub) fail(404,'لا يوجد تسليم'); sub.grade=score; sub.note=clean(b.note,800); sub.status='graded'; sub.graded_by=user.id; sub.graded_at=new Date().toISOString(); audit(user,'assignment_grade',{assignment_id:a.id,student_id:st.id}); await save(); return json(res,200,sub);
    }

    const calendarVisible = e => !e.group_id || user.role==='admin' || visibleGroupIds(user).includes(e.group_id);
    if (p === '/api/calendar' && req.method === 'GET') return json(res,200,db.calendar_events.filter(calendarVisible).sort((a,b)=>(a.date+a.start_time).localeCompare(b.date+b.start_time)).slice(0,100).map(e=>({...e,group_name:(db.groups.find(g=>g.id===e.group_id)||{}).name||'الأكاديمية'})));
    if (p === '/api/calendar' && req.method === 'POST') {
      requireStaff(user); const b=await body(req); if(!clean(b.title,160)||!isDate(b.date)) fail(400,'عنوان وتاريخ الحدث مطلوبان'); if(b.group_id&&!ownsGroup(user,b.group_id)) fail(403,'الفوج خارج نطاقك');
      const row={id:uid('ev'),title:clean(b.title,160),date:b.date,start_time:clean(b.start_time,10),end_time:clean(b.end_time,10),type:clean(b.type,40)||'نشاط',group_id:b.group_id||null,location:clean(b.location,120),description:clean(b.description,800),created_by:user.id}; db.calendar_events.push(row); audit(user,'calendar_event_create',{id:row.id}); await save(); return json(res,201,row);
    }

    const messageVisible = m => m.sender_id===user.id || m.recipient_id===user.id;
    if (p === '/api/messages' && req.method === 'GET') {
      const list=db.messages.filter(messageVisible).sort((a,b)=>b.created_at.localeCompare(a.created_at)).slice(0,100).map(m=>({...m,sender_name:(db.users.find(u=>u.id===m.sender_id)||{}).name||'',recipient_name:(db.users.find(u=>u.id===m.recipient_id)||{}).name||''})); return json(res,200,list);
    }
    if (p === '/api/messages' && req.method === 'POST') {
      const b=await body(req), to=db.users.find(u=>u.id===b.recipient_id&&u.active!==false), msg=clean(b.body,3000); if(!to||!msg) fail(400,'المستلم والرسالة مطلوبان');
      if(user.role!=='admin' && to.role==='admin') { /* يسمح بطلب التواصل مع الإدارة */ }
      const row={id:uid('msg'),sender_id:user.id,recipient_id:to.id,body:msg,created_at:new Date().toISOString(),read_at:null}; db.messages.push(row); audit(user,'message_send',{recipient_id:to.id}); await save(); return json(res,201,{...row,recipient_name:to.name});
    }
    if ((r=route(req,p,'POST','/api/messages/:id/read'))) { const m=db.messages.find(x=>x.id===r.id&&x.recipient_id===user.id); if(!m) fail(404,'الرسالة غير موجودة'); m.read_at=new Date().toISOString(); await save(); return json(res,200,{ok:true}); }

    /* ═══════════ تواصل ومكتبة الشيخ V23 ═══════════ */
    if (p === '/api/contacts' && req.method === 'GET') {
      return json(res,200,db.users.filter(u=>u.active!==false&&u.id!==user.id).map(u=>({id:u.id,name:u.name,role:u.role,active:true})));
    }
    const mediaVisible=m=>m&&(user.role==='admin'||!m.group_id||visibleGroupIds(user).includes(m.group_id));
    if (p === '/api/media' && req.method === 'GET') {
      const list=db.media_posts.filter(mediaVisible).sort((a,b)=>b.created_at.localeCompare(a.created_at)).slice(0,100).map(m=>({...m,author_name:(db.users.find(u=>u.id===m.author_id)||{}).name||'',read:db.media_reads.some(x=>x.media_id===m.id&&x.user_id===user.id),likes:db.media_reactions.filter(x=>x.media_id===m.id&&x.type==='like').length,liked:db.media_reactions.some(x=>x.media_id===m.id&&x.user_id===user.id&&x.type==='like'),bookmarked:db.media_bookmarks?.some(x=>x.media_id===m.id&&x.user_id===user.id)||false}));
      return json(res,200,list);
    }
    if (p === '/api/media' && req.method === 'POST') {
      requireStaff(user); const b=await body(req), title=clean(b.title,160), description=clean(b.description,1500), type=['video','audio','file','link'].includes(b.type)?b.type:'file'; const gid=b.group_id||null; if(gid&&!ownsGroup(user,gid)) fail(403,'الفوج خارج نطاقك'); if(!title) fail(400,'العنوان مطلوب');
      const externalUrl=safeUrl(b.url); if(b.url && !externalUrl) fail(400,'الرابط يجب أن يبدأ بـ http أو https'); const row={id:uid('med'),title,description,type,group_id:gid,url:externalUrl,file_name:clean(b.file_name,180),mime:clean(b.mime,120),file_path:'',author_id:user.id,created_at:new Date().toISOString()};
      if(type!=='link'&&!row.url&&!b.file_data) fail(400,'أضف رابطًا أو ملفًا');
      if(b.file_data){ const rawData=String(b.file_data).split(',').pop(); const byteSize=Math.floor(rawData.length*3/4); if(byteSize>7*1024*1024) fail(413,'الملف كبير جدًا؛ الحد المحلي 7MB'); const safeName=clean(b.file_name||'file.bin',100).replace(/[^\w\-.\u0600-\u06ff ]/g,'_'); const ext=path.extname(safeName).toLowerCase(); const allowed=['.pdf','.png','.jpg','.jpeg','.webp','.mp4','.webm','.mp3','.m4a','.wav','.ogg','.txt','.doc','.docx','.ppt','.pptx']; if(!allowed.includes(ext)) fail(400,'نوع الملف غير مسموح به'); const dir=MEDIA_ROOT; fs.mkdirSync(dir,{recursive:true}); const fp=path.join(dir,row.id+'_'+safeName); fs.writeFileSync(fp,Buffer.from(rawData,'base64')); row.file_path=fp; row.file_name=safeName; row.url=''; row.mime='application/octet-stream'; }
      db.media_posts.unshift(row); db.notifications.unshift({id:uid('n'),title:'محتوى جديد: '+title,body:description||'نُشر محتوى جديد من المعلم/الإدارة.',group_id:gid,created_at:row.created_at,read_by:[]}); audit(user,'media_create',{id:row.id,type,group_id:gid}); await save(); return json(res,201,row);
    }
    if ((r=route(req,p,'GET','/api/media/:id/file'))) {
      const m=db.media_posts.find(x=>x.id===r.id); if(!mediaVisible(m)||!m.file_path||!fs.existsSync(m.file_path)) fail(404,'الملف غير موجود'); const safePath=path.resolve(m.file_path); if(!safePath.startsWith(MEDIA_ROOT+path.sep)) fail(404,'الملف غير موجود'); const ext=path.extname(m.file_name||'').toLowerCase(); const mimeMap={'.pdf':'application/pdf','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.mp4':'video/mp4','.webm':'video/webm','.mp3':'audio/mpeg','.m4a':'audio/mp4','.wav':'audio/wav','.ogg':'audio/ogg','.txt':'text/plain','.doc':'application/octet-stream','.docx':'application/octet-stream','.ppt':'application/octet-stream','.pptx':'application/octet-stream'}; res.writeHead(200,{'Content-Type':mimeMap[ext]||'application/octet-stream','Content-Disposition':`inline; filename="${(m.file_name||'file').replace(/"/g,'')}"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}); return res.end(fs.readFileSync(m.file_path));
    }
    if ((r=route(req,p,'POST','/api/media/:id/read'))) { const m=db.media_posts.find(x=>x.id===r.id); if(!mediaVisible(m)) fail(404,'المحتوى غير موجود'); if(!db.media_reads.some(x=>x.media_id===m.id&&x.user_id===user.id)){db.media_reads.push({media_id:m.id,user_id:user.id,read_at:new Date().toISOString()});await save();} return json(res,200,{ok:true}); }
    if ((r=route(req,p,'POST','/api/media/:id/like'))) { const m=db.media_posts.find(x=>x.id===r.id); if(!mediaVisible(m)) fail(404,'المحتوى غير موجود'); const i=db.media_reactions.findIndex(x=>x.media_id===m.id&&x.user_id===user.id&&x.type==='like'); if(i>=0) db.media_reactions.splice(i,1); else db.media_reactions.push({id:uid('mr'),media_id:m.id,user_id:user.id,type:'like',created_at:new Date().toISOString()}); await save(); return json(res,200,{liked:i<0,likes:db.media_reactions.filter(x=>x.media_id===m.id&&x.type==='like').length}); }
    if ((r=route(req,p,'GET','/api/media/:id/comments'))) {
      const m=db.media_posts.find(x=>x.id===r.id); if(!mediaVisible(m)) fail(404,'المحتوى غير موجود');
      return json(res,200,db.media_comments.filter(x=>x.media_id===m.id).sort((a,b)=>a.created_at.localeCompare(b.created_at)).map(x=>({...x,author_name:(db.users.find(u=>u.id===x.user_id)||{}).name||'مستخدم'})));
    }
    if ((r=route(req,p,'POST','/api/media/:id/comments'))) {
      const m=db.media_posts.find(x=>x.id===r.id); if(!mediaVisible(m)) fail(404,'المحتوى غير موجود'); const b=await body(req), text=clean(b.body,800); if(!text) fail(400,'التعليق فارغ');
      const row={id:uid('mc'),media_id:m.id,user_id:user.id,body:text,created_at:new Date().toISOString()}; db.media_comments.push(row); audit(user,'media_comment',{media_id:m.id}); await save(); return json(res,201,{...row,author_name:user.name});
    }
    if ((r=route(req,p,'GET','/api/media/:id/viewers'))) { const m=db.media_posts.find(x=>x.id===r.id); if(user.role!=='admin'&&!(m&&m.author_id===user.id)) fail(403,'المشاهدات للمدير وصاحب المحتوى'); return json(res,200,db.media_reads.filter(x=>x.media_id===r.id).map(x=>({user_id:x.user_id,name:(db.users.find(u=>u.id===x.user_id)||{}).name||'',read_at:x.read_at}))); }

    if (p === '/api/account/password' && req.method === 'POST') {
      const b = await body(req), current = String(b.current_password || ''), next = String(b.new_password || '');
      if (!verifyPassword(current, user.password)) fail(400, 'كلمة المرور الحالية غير صحيحة');
      if (next.length < 8) fail(400, 'كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل');
      if (next === current) fail(400, 'اختر كلمة مرور مختلفة عن الحالية');
      user.password = hashPassword(next); audit(user, 'account.password_change'); await save();
      return json(res, 200, { ok: true, message: 'تم تغيير كلمة المرور' });
    }
    if ((await handleAdvanced({req,res,p,q,user,db,fail,json,body,uid,clean,isDate,isStaff,canView,canEdit,scopedStudents,studentForUser,studentGroupIds,visibleGroupIds,ownsGroup,audit,save,ROOT,storageHealth:()=>storage.health(),lastPersistenceError})) !== false) return;

    if (p === '/api/student-tasks' && req.method === 'GET') {
      const ids=scopedStudents(user).map(s=>s.id); return json(res,200,db.student_tasks.filter(t=>user.role==='admin'||ids.includes(t.student_id)).sort((a,b)=>String(a.due_date||'9999').localeCompare(String(b.due_date||'9999'))));
    }
    if (p === '/api/student-tasks' && req.method === 'POST') {
      requireStaff(user); const b=await body(req), st=db.students.find(s=>s.id===b.student_id); if(!st||!canEdit(user,st)) fail(403,'الطالب خارج نطاقك'); const title=clean(b.title,160); if(!title) fail(400,'عنوان المهمة مطلوب'); const row={id:uid('task'),student_id:st.id,title,description:clean(b.description,800),due_date:isDate(b.due_date)?b.due_date:null,status:'pending',created_by:user.id,created_at:new Date().toISOString()}; db.student_tasks.push(row); audit(user,'student_task_create',{student_id:st.id}); await save(); return json(res,201,row);
    }
    if ((r=route(req,p,'POST','/api/student-tasks/:id/status'))) {
      const t=db.student_tasks.find(x=>x.id===r.id), st=t&&db.students.find(s=>s.id===t.student_id); if(!t||!st) fail(404,'المهمة غير موجودة'); if(!(user.role==='student'&&st.user_id===user.id) && !(isStaff(user)&&canEdit(user,st))) fail(403,'غير مسموح'); const b=await body(req); if(!['pending','done'].includes(b.status)) fail(400,'حالة المهمة غير صحيحة'); t.status=b.status; t.completed_at=b.status==='done'?new Date().toISOString():null; audit(user,'student_task_status',{task_id:t.id,status:t.status}); await save(); return json(res,200,t);
    }
    if (p === '/api/admin/institution' && req.method === 'GET') { requireAdmin(); return json(res,200,db.institution||{}); }
    if (p === '/api/admin/institution' && req.method === 'PATCH') { requireAdmin(); const b=await body(req); const i=db.institution||{}; for(const k of ['name','motto','academic_year','term','phone','email']) if(b[k]!==undefined) i[k]=clean(b[k],160); db.institution=i; audit(user,'institution_update'); await save(); return json(res,200,i); }

    if (p === '/api/audit' && req.method === 'GET') {
      if (user.role !== 'admin') return json(res, 403, { error: 'غير مسموح' });
      return json(res, 200, db.audit_log.slice(0, 200).map(x => ({ ...x, user_name: (db.users.find(u => u.id === x.user_id) || {}).name || 'النظام' })));
    }

    /* الإشعارات (لكل مستخدم حالة قراءة مستقلة) */
    const visibleNotifs = () => { const g = visibleGroupIds(user); return db.notifications.filter(n => (n.user_id===user.id) || !n.user_id && (!n.group_id || user.role === 'admin' || g.includes(n.group_id))); };
    if (p === '/api/notifications' && req.method === 'GET') return json(res, 200, visibleNotifs().map(n => ({ id: n.id, title: n.title, body: n.body, created_at: n.created_at, read: (n.read_by || []).includes(user.id) })));
    if (p === '/api/notifications/read-all' && req.method === 'POST') {
      visibleNotifs().forEach(n => { n.read_by = n.read_by || []; if (!n.read_by.includes(user.id)) n.read_by.push(user.id); });
      await save(); return json(res, 200, { ok: true });
    }

    return json(res, 404, { error: 'المسار غير موجود' });
  } catch (e) {
    if (e instanceof HttpError) return json(res, e.status, { error: e.message });
    console.error(e);
    return json(res, 500, { error: 'خطأ داخلي' });
  }
}

const TLS_CERT=process.env.ACADEMY_TLS_CERT_FILE, TLS_KEY=process.env.ACADEMY_TLS_KEY_FILE;
if (REQUIRE_HTTPS && (!TLS_CERT || !TLS_KEY)) throw new Error('الإنتاج يتطلب ACADEMY_TLS_CERT_FILE وACADEMY_TLS_KEY_FILE.');
// Optional redirect-only mode for the legacy Oregon service. The canonical app and database live in Frankfurt.
const FRANKFURT_CANONICAL_URL = 'https://ihsan-academy-frankfurt.onrender.com';
const requestHandler = (req, res) => {
  if (process.env.ACADEMY_REDIRECT_TO_FRANKFURT === '1') {
    const incoming = new URL(req.url || '/', 'http://redirect.local');
    if (req.method === 'GET' && incoming.pathname === '/api/health') {
      return send(res, 200, { ok: true, redirect: true, canonical: FRANKFURT_CANONICAL_URL });
    }
    const destination = new URL(FRANKFURT_CANONICAL_URL);
    destination.pathname = incoming.pathname;
    destination.search = incoming.search;
    res.writeHead(308, {
      Location: destination.toString(),
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    });
    return res.end();
  }
  return handler(req, res);
};
const server = (TLS_CERT && TLS_KEY) ? https.createServer({cert:fs.readFileSync(path.resolve(TLS_CERT)),key:fs.readFileSync(path.resolve(TLS_KEY))},requestHandler) : http.createServer(requestHandler);
setInterval(() => { const now = Date.now(); for (const [t, s] of sessions) if (s.exp < now) sessions.delete(t); }, 10 * 60 * 1000).unref();
async function shutdown(signal) {
  try {
    if (storage && typeof storage.close === 'function') await storage.close();
  } finally {
    process.exit(0);
  }
}
process.once('SIGTERM', () => { void shutdown('SIGTERM'); });
process.once('SIGINT', () => { void shutdown('SIGINT'); });

if (require.main === module) {
  // افتراضيًا يستمع على كل واجهات الشبكة ليُفتح من الهاتف على نفس الواي فاي.
  // للحاسوب فقط: ACADEMY_LOCAL_ONLY=1
  const HOST = process.env.ACADEMY_LOCAL_ONLY === '1' ? '127.0.0.1' : '0.0.0.0';
  server.listen(PORT, HOST, () => {
    console.log(`\n  أكاديمية الإحسان في بناء الإنسان — V${APP_VERSION}`);
    console.log(`  على هذا الحاسوب:  http://localhost:${PORT}`);
    if (HOST !== '127.0.0.1') {
      const ips = Object.values(require('os').networkInterfaces()).flat().filter(i => i && i.family === 'IPv4' && !i.internal).map(i => i.address);
      ips.forEach(ip => console.log(`  على الهاتف (نفس الواي فاي):  http://${ip}:${PORT}`));
      if (!ips.length) console.log('  لا توجد شبكة متصلة؛ الهاتف لن يستطيع الوصول الآن.');
    }
    console.log('  للإيقاف: اضغط Ctrl + C\n');
  });
}
module.exports = { server };
