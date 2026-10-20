const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
  "content-security-policy": "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
};
const json = (data, status = 200, extra = {}) => new Response(JSON.stringify(data), { status, headers: { ...JSON_HEADERS, ...extra } });
const fail = (status, error) => json({ error }, status);
const nowIso = () => new Date().toISOString();
const clean = (v, max = 200) => String(v ?? "").trim().slice(0, max);
const uuid = () => crypto.randomUUID();
const hex = bytes => [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, "0")).join("");
const unhex = value => new Uint8Array((value.match(/.{1,2}/g) || []).map(x => parseInt(x, 16)));
const hashToken = async token => hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)));
async function passwordHash(password, saltHex = hex(crypto.getRandomValues(new Uint8Array(16)))) {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: unhex(saltHex), iterations: 50000 }, material, 256);
  return `pbkdf2-sha256$50000$${saltHex}$${hex(bits)}`;
}
async function verifyPassword(password, stored) {
  const [algorithm, roundsText, salt, expected] = String(stored || "").split("$");
  if (algorithm !== "pbkdf2-sha256" || roundsText !== "50000" || !salt || !expected) return false;
  const actual = (await passwordHash(password, salt)).split("$")[3];
  if (actual.length !== expected.length) return false;
  let diff = 0; for (let i = 0; i < actual.length; i++) diff |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}
async function bodyJson(request, maxBytes = 32000) {
  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > maxBytes) throw new Error("payload_too_large");
  try { return raw ? JSON.parse(raw) : {}; } catch { throw new Error("invalid_json"); }
}
async function currentUser(request, env) {
  const match = /^Bearer\s+([a-f0-9]{64})$/i.exec(request.headers.get("authorization") || "");
  if (!match) return null;
  const row = await env.DB.prepare("SELECT u.id,u.display_name,u.identity_normalized,u.role,u.active FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.active=1").bind(await hashToken(match[1]), nowIso()).first();
  if (!row) return null;
  const student = row.role === "student" ? await env.DB.prepare("SELECT id,group_id FROM students WHERE user_id=? AND active=1").bind(row.id).first() : null;
  return { id: row.id, name: row.display_name, email: row.identity_normalized, role: row.role, active: !!row.active, student_id: student?.id || null, group_id: student?.group_id || null };
}
const safeUser = u => ({ id:u.id, name:u.name, email:u.email, role:u.role, active:true, theme:"emerald", font_scale:1, high_contrast:false, reduced_motion:false, student_id:u.student_id || null, group_id:u.group_id || null });
const records = async (env, collection, where = "", binds = []) => {
  const result = await env.DB.prepare("SELECT payload_json FROM academy_records WHERE collection=?" + where + " ORDER BY updated_at DESC LIMIT 500").bind(collection, ...binds).all();
  return (result.results || []).flatMap(row => { try { return [JSON.parse(row.payload_json)]; } catch { return []; } });
};
async function saveRecord(env, collection, value) {
  const payload = JSON.stringify(value);
  await env.DB.prepare("INSERT INTO academy_records (collection,id,owner_user_id,group_id,student_id,payload_json,updated_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(collection,id) DO UPDATE SET owner_user_id=excluded.owner_user_id,group_id=excluded.group_id,student_id=excluded.student_id,payload_json=excluded.payload_json,updated_at=excluded.updated_at")
    .bind(collection, String(value.id), value.owner_user_id || null, value.group_id || null, value.student_id || null, payload, nowIso()).run();
}
async function log(env, userId, action, meta = {}) {
  await env.DB.prepare("INSERT INTO audit_log (id,user_id,action,metadata_json) VALUES (?,?,?,?)").bind(uuid(), userId || null, action, JSON.stringify(meta)).run();
}
async function groupRow(env, id) { return env.DB.prepare("SELECT id,name,school_id,teacher_id,active FROM groups WHERE id=?").bind(id).first(); }
async function canManageGroup(env, user, groupId) {
  if (user.role === "admin") return true;
  if (user.role !== "teacher") return false;
  const g = await groupRow(env, groupId);
  return !!g && g.teacher_id === user.id && g.active === 1;
}
async function canViewGroup(env, user, groupId) {
  if (!groupId || user.role === "admin") return true;
  if (user.role === "teacher") return canManageGroup(env, user, groupId);
  if (user.role === "student") return user.group_id === groupId;
  return false;
}
async function scopedRecords(env, user, collection, publishedOnly = false) {
  const rows = await records(env, collection);
  const visible = [];
  for (const row of rows) {
    if (publishedOnly && row.status !== "published") continue;
    if (await canViewGroup(env, user, row.group_id || null)) visible.push(row);
  }
  return visible;
}
async function parseBody(request) {
  try { return { value: await bodyJson(request), error: null }; }
  catch (e) { return { value: null, error: fail(e.message === "payload_too_large" ? 413 : 400, e.message) }; }
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url), path = url.pathname, method = request.method.toUpperCase();
    try {
    if (method === "OPTIONS") return new Response(null, { status:204, headers:{ ...JSON_HEADERS, "access-control-allow-methods":"GET, POST, PUT, PATCH, DELETE, OPTIONS", "access-control-allow-headers":"Content-Type, Authorization" }});
    if (path === "/api/health" && method === "GET") {
      try { const [db, users] = await Promise.all([env.DB.prepare("SELECT 1 AS ok").first(), env.DB.prepare("SELECT COUNT(*) AS n FROM users").first()]); return json({ok:db?.ok===1,app:"ihsan-academy",runtime:"cloudflare-pages-functions",storage:"d1",users:users?.n||0}); } catch { return fail(503,"database_unavailable"); }
    }
    if (path === "/api/setup/status" && method === "GET") {
      try { const r=await env.DB.prepare("SELECT COUNT(*) AS n FROM users WHERE role='admin' AND active=1").first(); return json({needs_admin:(r?.n||0)===0,setup_enabled:!!env.BOOTSTRAP_SECRET}); } catch { return fail(503,"database_unavailable"); }
    }
    if (path === "/api/privacy" && method === "GET") return json({title:"سياسة الخصوصية — أكاديمية الإحسان",principles:["نجمع أقل قدر لازم للتعليم والإدارة.","لا نبيع البيانات الشخصية.","تُقيّد صلاحيات الوصول بحسب الدور والفوج.","كلمات المرور لا تُخزّن كنص واضح."]});
    if (path === "/api/public/quran-schools" && method === "GET") {
      const r=await env.DB.prepare("SELECT id,name,description FROM quran_schools WHERE active=1 ORDER BY sort_order,name").all(); return json(r.results||[]);
    }
    if (path === "/api/admin/bootstrap" && method === "POST") {
      if (!env.BOOTSTRAP_SECRET) return fail(503,"setup_not_configured");
      if (request.headers.get("x-bootstrap-secret") !== env.BOOTSTRAP_SECRET) return fail(403,"رمز الإعداد غير صحيح");
      let bootstrapStage = "قراءة البيانات";
      try {
        const parsed=await parseBody(request); if(parsed.error)return parsed.error; const b=parsed.value;
        const name=clean(b.name,120), identity=clean(b.email,200).toLowerCase(), password=String(b.password||"");
        if(!name||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identity)||password.length<14||password.length>256) return fail(400,"أدخل الاسم والبريد وكلمة مرور من 14 حرفًا على الأقل");
        bootstrapStage = "التحقق من المدير الحالي";
        const exists=await env.DB.prepare("SELECT COUNT(*) AS n FROM users WHERE role='admin'").first(); if((exists?.n||0)>0)return fail(409,"تم إنشاء المدير الأول بالفعل");
        bootstrapStage = "التحقق من البريد";
        const identityExists=await env.DB.prepare("SELECT id FROM users WHERE identity_normalized=? LIMIT 1").bind(identity).first();
        if(identityExists)return fail(409,"هذا البريد مستخدم بالفعل. استخدم بريدًا آخر.");
        bootstrapStage = "تشفير كلمة المرور";
        const hashedPassword=await passwordHash(password);
        bootstrapStage = "حفظ حساب المدير";
        const id=uuid();
        await env.DB.prepare("INSERT INTO users (id,display_name,identity_normalized,password_hash,role,active) VALUES (?,?,?,?, 'admin',1)").bind(id,name,identity,hashedPassword).run();
        // Audit logging must not turn a successful account creation into a misleading 500.
        try { await log(env,id,"admin_bootstrap",{identity}); }
        catch (auditError) { console.error("Ihsan audit log failed after admin bootstrap", { message:String(auditError?.message||auditError) }); }
        return json({ok:true,message:"تم إنشاء حساب المدير. سجّل الدخول الآن."},201);
      } catch (error) {
        console.error("Ihsan administrator setup failed", { stage:bootstrapStage, message:String(error?.message||error) });
        return fail(500,"تعذّر إنشاء حساب المدير أثناء خطوة: "+bootstrapStage+". لم يتم إظهار تفاصيل تقنية حساسة؛ أعد المحاولة بعد تحديث الصفحة.");
      }
    }
    if (path === "/api/login" && method === "POST") {
      const parsed=await parseBody(request); if(parsed.error)return parsed.error; const b=parsed.value;
      const identity=clean(b.identity??b.email,200).toLowerCase(), password=String(b.password||"");
      if(!identity||!password||password.length>1024)return fail(400,"أدخل اسم الدخول وكلمة المرور");
      const now=nowIso(), attempt=await env.DB.prepare("SELECT failures,locked_until FROM login_attempts WHERE identity_normalized=?").bind(identity).first();
      if(attempt?.locked_until && attempt.locked_until>now)return fail(429,"محاولات كثيرة. انتظر 15 دقيقة ثم أعد المحاولة.");
      const user=await env.DB.prepare("SELECT id,display_name,identity_normalized,password_hash,role,active FROM users WHERE identity_normalized=? LIMIT 1").bind(identity).first();
      const valid=!!user && user.active===1 && await verifyPassword(password,user.password_hash);
      if(!valid){
        const failures=(attempt?.failures||0)+1, locked=failures>=8?new Date(Date.now()+15*60*1000).toISOString():null;
        await env.DB.prepare("INSERT INTO login_attempts(identity_normalized,failures,locked_until,updated_at) VALUES(?,?,?,?) ON CONFLICT(identity_normalized) DO UPDATE SET failures=excluded.failures,locked_until=excluded.locked_until,updated_at=excluded.updated_at").bind(identity,locked?0:failures,locked,now).run();
        return fail(401,"بيانات الدخول غير صحيحة");
      }
      await env.DB.prepare("DELETE FROM login_attempts WHERE identity_normalized=?").bind(identity).run();
      const token=hex(crypto.getRandomValues(new Uint8Array(32)));
      const remember=b.remember===true;
      const sessionLifetimeMs=(remember?30*24:12)*60*60*1000;
      await env.DB.prepare("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)").bind(await hashToken(token),user.id,new Date(Date.now()+sessionLifetimeMs).toISOString()).run();
      await log(env,user.id,"login");
      const student=user.role==="student"?await env.DB.prepare("SELECT id,group_id FROM students WHERE user_id=? AND active=1").bind(user.id).first():null;
      return json({token,user:safeUser({id:user.id,name:user.display_name,email:user.identity_normalized,role:user.role,student_id:student?.id,group_id:student?.group_id})});
    }
    if (!path.startsWith("/api/")) return env.ASSETS.fetch(request);
    if (path === "/api/logout" && method === "POST") {
      const match=/^Bearer\s+([a-f0-9]{64})$/i.exec(request.headers.get("authorization")||""); if(match)await env.DB.prepare("DELETE FROM sessions WHERE token_hash=?").bind(await hashToken(match[1])).run(); return json({ok:true});
    }
    const user=await currentUser(request,env); if(!user)return fail(401,"يرجى تسجيل الدخول");
    if(path==="/api/me"&&method==="GET")return json(safeUser(user));
    if(path==="/api/dashboard"&&method==="GET"){
      const isStaff=user.role==="admin"||user.role==="teacher";
      const [groups,students,att,tests]=await Promise.all([
        isStaff?env.DB.prepare("SELECT COUNT(*) AS n FROM groups WHERE active=1"+(user.role==="teacher"?" AND teacher_id=?":"")).bind(...(user.role==="teacher"?[user.id]:[])).first():{n:0},
        isStaff?env.DB.prepare("SELECT COUNT(*) AS n FROM students WHERE active=1"+(user.role==="teacher"?" AND group_id IN (SELECT id FROM groups WHERE teacher_id=?)":"")).bind(...(user.role==="teacher"?[user.id]:[])).first():{n:0},
        records(env,"attendance",user.role==="student"?" AND student_id=?":"",user.role==="student"?[user.student_id||""]:[]),
        records(env,"tests")
      ]);
      const today=nowIso().slice(0,10), todayRows=att.filter(x=>x.date===today);
      return json({students_count:students?.n||0,groups_count:groups?.n||0,attendance_rate:todayRows.length?Math.round(100*todayRows.filter(x=>x.status==="present").length/todayRows.length):0,attendance_marked:todayRows.length,progress_avg:0,upcoming_tests:tests.length});
    }
    if(path==="/api/groups"&&method==="GET"){
      let rows;
      if(user.role==="admin")rows=await env.DB.prepare("SELECT id,name,school_id,teacher_id,active FROM groups WHERE active=1 ORDER BY name").all();
      else if(user.role==="teacher")rows=await env.DB.prepare("SELECT id,name,school_id,teacher_id,active FROM groups WHERE active=1 AND teacher_id=? ORDER BY name").bind(user.id).all();
      else if(user.role==="student"&&user.group_id){const g=await groupRow(env,user.group_id);rows={results:g?[g]:[]};}
      else rows={results:[]};
      return json(rows.results||[]);
    }
    if(path==="/api/groups"&&method==="POST"){
      if(user.role!=="admin")return fail(403,"هذه العملية للمدير فقط"); const parsed=await parseBody(request);if(parsed.error)return parsed.error;
      const name=clean(parsed.value.name,120),teacherId=clean(parsed.value.teacher_id,80)||null;if(!name)return fail(400,"اسم الفوج مطلوب");
      if(teacherId){const t=await env.DB.prepare("SELECT id FROM users WHERE id=? AND role IN ('teacher','admin') AND active=1").bind(teacherId).first();if(!t)return fail(400,"المعلم المحدد غير صالح");}
      const id=uuid();await env.DB.prepare("INSERT INTO groups(id,name,school_id,teacher_id,active) VALUES(?,?,?, ?,1)").bind(id,name,"qs-rahman",teacherId).run();await log(env,user.id,"group_create",{id,name});return json({id,name,teacher_id:teacherId,active:1},201);
    }
    const groupMatch=path.match(/^\/api\/groups\/([^/]+)$/);
    if(groupMatch&&method==="PATCH"){
      if(user.role!=="admin")return fail(403,"هذه العملية للمدير فقط");const parsed=await parseBody(request);if(parsed.error)return parsed.error;const id=groupMatch[1],b=parsed.value;
      const g=await groupRow(env,id);if(!g)return fail(404,"الفوج غير موجود");const name=clean(b.name??g.name,120),teacherId=b.teacher_id===undefined?g.teacher_id:(clean(b.teacher_id,80)||null);
      if(teacherId){const t=await env.DB.prepare("SELECT id FROM users WHERE id=? AND role IN ('teacher','admin') AND active=1").bind(teacherId).first();if(!t)return fail(400,"المعلم المحدد غير صالح");}
      await env.DB.prepare("UPDATE groups SET name=?,teacher_id=? WHERE id=?").bind(name,teacherId,id).run();return json({ok:true});
    }
    if(groupMatch&&method==="DELETE"){
      if(user.role!=="admin")return fail(403,"هذه العملية للمدير فقط");await env.DB.prepare("UPDATE groups SET active=0 WHERE id=?").bind(groupMatch[1]).run();return json({ok:true});
    }
    if(path==="/api/teachers"&&method==="GET"){
      if(user.role!=="admin")return fail(403,"هذه القائمة للمدير فقط");const r=await env.DB.prepare("SELECT id,display_name AS name,identity_normalized AS username FROM users WHERE role='teacher' AND active=1 ORDER BY display_name").all();return json(r.results||[]);
    }
    if(path==="/api/teachers"&&method==="POST"){
      if(user.role!=="admin")return fail(403,"إضافة المعلمين للمدير فقط");const parsed=await parseBody(request);if(parsed.error)return parsed.error;const b=parsed.value;
      const name=clean(b.name,120),identity=clean(b.username,100).toLowerCase(),password=String(b.password||"");
      if(!name||!identity||identity.length>120||password.length<8||password.length>256)return fail(400,"أدخل الاسم وكلمة مرور من 8 أحرف على الأقل");
      const id=uuid();try{await env.DB.prepare("INSERT INTO users(id,display_name,identity_normalized,password_hash,role,active) VALUES(?,?,?,?, 'teacher',1)").bind(id,name,identity,await passwordHash(password)).run();}catch{return fail(409,"اسم الدخول مستخدم بالفعل");}
      await log(env,user.id,"teacher_create",{id,name});return json({id,name,username:identity},201);
    }
    const teacherMatch=path.match(/^\/api\/teachers\/([^/]+)$/);
    if(teacherMatch&&method==="PATCH"){
      if(user.role!=="admin")return fail(403,"تعديل حسابات المعلمين للمدير فقط");
      const parsed=await parseBody(request);if(parsed.error)return parsed.error;const b=parsed.value;
      const target=await env.DB.prepare("SELECT id FROM users WHERE id=? AND role='teacher' AND active=1").bind(teacherMatch[1]).first();
      if(!target)return fail(404,"المعلم غير موجود");
      const name=clean(b.name,120),identity=clean(b.username,120).toLowerCase(),password=String(b.password||"");
      if(!name||!identity||identity.length>120||(password&&(password.length<8||password.length>256)))return fail(400,"تحقق من الاسم واسم الدخول وكلمة المرور (8 أحرف على الأقل)");
      const duplicate=await env.DB.prepare("SELECT id FROM users WHERE identity_normalized=? AND id<>? LIMIT 1").bind(identity,target.id).first();
      if(duplicate)return fail(409,"اسم الدخول مستخدم بالفعل");
      if(password)await env.DB.prepare("UPDATE users SET display_name=?,identity_normalized=?,password_hash=? WHERE id=?").bind(name,identity,await passwordHash(password),target.id).run();
      else await env.DB.prepare("UPDATE users SET display_name=?,identity_normalized=? WHERE id=?").bind(name,identity,target.id).run();
      await log(env,user.id,"teacher_update",{id:target.id,name});return json({ok:true,name,username:identity});
    }
    if(path==="/api/students"&&method==="GET"){
      if(user.role==="student"){
        const r=await env.DB.prepare("SELECT id,display_name AS name,group_id,active FROM students WHERE user_id=? AND active=1").bind(user.id).all();return json(r.results||[]);
      }
      if(user.role!=="admin"&&user.role!=="teacher")return fail(403,"غير مسموح");
      const groupId=url.searchParams.get("group_id");
      if(groupId&&!await canManageGroup(env,user,groupId))return fail(403,"هذا الفوج خارج صلاحيتك");
      const base="SELECT students.id,students.display_name AS name,students.group_id,students.user_id,students.active,(SELECT identity_normalized FROM users WHERE users.id=students.user_id) AS username FROM students WHERE students.active=1";
      const r=user.role==="teacher"?await env.DB.prepare(base+" AND group_id IN (SELECT id FROM groups WHERE teacher_id=?)"+(groupId?" AND group_id=?":"")+" ORDER BY display_name").bind(user.id,...(groupId?[groupId]:[])).all():await env.DB.prepare(base+(groupId?" AND group_id=?":"")+" ORDER BY display_name").bind(...(groupId?[groupId]:[])).all();
      return json(r.results||[]);
    }
    if(path==="/api/students"&&method==="POST"){
      if(user.role!=="admin"&&user.role!=="teacher")return fail(403,"غير مسموح");const parsed=await parseBody(request);if(parsed.error)return parsed.error;const b=parsed.value;
      const name=clean(b.name,120),identity=clean(b.username,100).toLowerCase(),password=String(b.password||""),groupId=clean(b.group_id,80);
      if(!name||!identity||identity.length>120||password.length<8||password.length>256||!groupId)return fail(400,"أكمل الاسم وكلمة المرور والفوج");
      if(!await canManageGroup(env,user,groupId))return fail(403,"لا تملك صلاحية هذا الفوج");
      const id=uuid(),studentId=uuid();
      try{await env.DB.prepare("INSERT INTO users(id,display_name,identity_normalized,password_hash,role,active) VALUES(?,?,?,?, 'student',1)").bind(id,name,identity,await passwordHash(password)).run();
        await env.DB.prepare("INSERT INTO students(id,user_id,display_name,group_id,active) VALUES(?,?,?,?,1)").bind(studentId,id,name,groupId).run();}
      catch{await env.DB.prepare("DELETE FROM users WHERE id=?").bind(id).run();return fail(409,"اسم الدخول مستخدم بالفعل");}
      await log(env,user.id,"student_create",{student_id:studentId,group_id:groupId});return json({id:studentId,user_id:id,name,username:identity,group_id:groupId},201);
    }
    const rosterAccountMatch=path.match(/^\/api\/students\/([^/]+)\/account$/);
    if(rosterAccountMatch&&method==="POST"){
      if(user.role!=="admin"&&user.role!=="teacher")return fail(403,"غير مسموح");
      const parsed=await parseBody(request);if(parsed.error)return parsed.error;const b=parsed.value;
      const s=await env.DB.prepare("SELECT id,user_id,display_name,group_id FROM students WHERE id=? AND active=1").bind(rosterAccountMatch[1]).first();
      if(!s)return fail(404,"الطالب غير موجود");
      if(!await canManageGroup(env,user,s.group_id))return fail(403,"لا تملك صلاحية هذا الطالب");
      if(s.user_id)return fail(409,"لدى الطالب حساب دخول بالفعل");
      const name=clean(b.name||s.display_name,120),identity=clean(b.username,120).toLowerCase(),password=String(b.password||"");
      if(!name||!identity||password.length<8||password.length>256)return fail(400,"أدخل اسم الدخول وكلمة مرور من 8 أحرف على الأقل");
      const duplicate=await env.DB.prepare("SELECT id FROM users WHERE identity_normalized=? LIMIT 1").bind(identity).first();
      if(duplicate)return fail(409,"اسم الدخول مستخدم بالفعل؛ اختر اسمًا آخر");
      const userId=uuid();
      try{
        await env.DB.prepare("INSERT INTO users(id,display_name,identity_normalized,password_hash,role,active) VALUES(?,?,?,?, 'student',1)").bind(userId,name,identity,await passwordHash(password)).run();
        await env.DB.prepare("UPDATE students SET user_id=?,display_name=? WHERE id=?").bind(userId,name,s.id).run();
      }catch(error){
        await env.DB.prepare("DELETE FROM users WHERE id=?").bind(userId).run();
        return fail(409,"تعذّر إنشاء الحساب؛ تحقّق من اسم الدخول ثم أعد المحاولة");
      }
      await log(env,user.id,"student_account_created",{student_id:s.id,group_id:s.group_id});
      return json({ok:true,id:s.id,user_id:userId,name,username:identity,group_id:s.group_id},201);
    }
    const studentMatch=path.match(/^\/api\/students\/([^/]+)$/);
    if(studentMatch&&method==="PATCH"){
      if(user.role!=="admin"&&user.role!=="teacher")return fail(403,"غير مسموح");
      const s=await env.DB.prepare("SELECT id,user_id,display_name,group_id FROM students WHERE id=? AND active=1").bind(studentMatch[1]).first();
      if(!s)return fail(404,"الطالب غير موجود");
      if(!await canManageGroup(env,user,s.group_id))return fail(403,"لا تملك صلاحية هذا الطالب");
      const parsed=await parseBody(request);if(parsed.error)return parsed.error;const b=parsed.value;
      const name=b.name===undefined?s.display_name:clean(b.name,120);
      const nextGroup=b.group_id===undefined?s.group_id:clean(b.group_id,80);
      const identity=b.username===undefined?null:clean(b.username,120).toLowerCase();
      const password=String(b.password||"");
      if(!name||!nextGroup)return fail(400,"اسم الطالب والفوج مطلوبان");
      if(!await canManageGroup(env,user,nextGroup))return fail(403,"لا تملك صلاحية الفوج الجديد");
      if(identity!==null&&(!s.user_id||!identity||identity.length>120))return fail(400,"لا يمكن تعديل اسم الدخول قبل إنشاء حساب للطالب");
      if(password&&(!s.user_id||password.length<8||password.length>256))return fail(400,"كلمة المرور يجب أن تكون 8 أحرف على الأقل ولحساب موجود");
      if(identity!==null){
        const duplicate=await env.DB.prepare("SELECT id FROM users WHERE identity_normalized=? AND id<>? LIMIT 1").bind(identity,s.user_id).first();
        if(duplicate)return fail(409,"اسم الدخول مستخدم بالفعل");
      }
      await env.DB.prepare("UPDATE students SET display_name=?,group_id=? WHERE id=?").bind(name,nextGroup,s.id).run();
      if(s.user_id&&identity!==null){
        if(password)await env.DB.prepare("UPDATE users SET display_name=?,identity_normalized=?,password_hash=? WHERE id=?").bind(name,identity,await passwordHash(password),s.user_id).run();
        else await env.DB.prepare("UPDATE users SET display_name=?,identity_normalized=? WHERE id=?").bind(name,identity,s.user_id).run();
      }else if(s.user_id&&b.name!==undefined){
        await env.DB.prepare("UPDATE users SET display_name=? WHERE id=?").bind(name,s.user_id).run();
      }
      await log(env,user.id,"student_update",{student_id:s.id,name,old_group_id:s.group_id,new_group_id:nextGroup});
      return json({ok:true,name,group_id:nextGroup});
    }
    if(studentMatch&&method==="DELETE"){
      if(user.role!=="admin"&&user.role!=="teacher")return fail(403,"غير مسموح");const s=await env.DB.prepare("SELECT id,user_id,group_id FROM students WHERE id=? AND active=1").bind(studentMatch[1]).first();if(!s)return fail(404,"الطالب غير موجود");if(!await canManageGroup(env,user,s.group_id))return fail(403,"لا تملك صلاحية هذا الطالب");
      await env.DB.prepare("UPDATE students SET active=0 WHERE id=?").bind(s.id).run();if(s.user_id)await env.DB.prepare("UPDATE users SET active=0 WHERE id=?").bind(s.user_id).run();await log(env,user.id,"student_deactivate",{student_id:s.id});return json({ok:true});
    }
    if(path==="/api/attendance"&&method==="GET"){
      const date=clean(url.searchParams.get("date"),10)||nowIso().slice(0,10),groupId=clean(url.searchParams.get("group_id"),80),history=url.searchParams.get("history")==="1",studentId=clean(url.searchParams.get("student_id"),80);
      if(user.role==="student"){
        const rows=await records(env,"attendance"," AND student_id=?",[user.student_id||""]);
        return json(history?rows.sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,120):rows.filter(x=>x.date===date));
      }
      if(studentId){
        const student=await env.DB.prepare("SELECT group_id FROM students WHERE id=? AND active=1").bind(studentId).first();
        if(!student||!await canManageGroup(env,user,student.group_id))return fail(403,"لا تملك صلاحية ملف هذا الطالب");
        if(groupId&&groupId!==student.group_id)return fail(400,"الفوج المحدد لا يطابق فوج الطالب الحالي");
        let rows=await records(env,"attendance"," AND student_id=?",[studentId]);
        rows.sort((a,b)=>String(b.date).localeCompare(String(a.date)));
        return json(history?rows.slice(0,500):rows.filter(x=>x.date===date));
      }
      if(!groupId||!await canManageGroup(env,user,groupId))return fail(403,"اختر فوجًا ضمن صلاحيتك");
      const rows=await records(env,"attendance"," AND group_id=?",[groupId]);
      return json(history?rows.sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,500):rows.filter(x=>x.date===date));
    }
    if(path==="/api/attendance"&&method==="POST"){
      if(user.role!=="admin"&&user.role!=="teacher")return fail(403,"تسجيل الحضور للمعلم أو المدير");const parsed=await parseBody(request);if(parsed.error)return parsed.error;const b=parsed.value,groupId=clean(b.group_id,80),date=clean(b.date,10),items=Array.isArray(b.items)?b.items:[];
      if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!items.length||items.length>200||!await canManageGroup(env,user,groupId))return fail(400,"بيانات الحضور غير صحيحة");
      const active=await env.DB.prepare("SELECT id FROM students WHERE group_id=? AND active=1").bind(groupId).all(),allowed=new Set((active.results||[]).map(x=>x.id)),stmts=[];
      for(const item of items){if(!allowed.has(String(item.student_id))||!["present","absent","late","excused"].includes(item.status))return fail(400,"يوجد طالب أو حالة غير صحيحة");const row={id:date+":"+item.student_id,student_id:item.student_id,group_id:groupId,date,status:item.status,note:clean(item.note,300),marked_by:user.id,updated_at:nowIso()};stmts.push(env.DB.prepare("INSERT INTO academy_records(collection,id,owner_user_id,group_id,student_id,payload_json,updated_at) VALUES('attendance',?,?,?,?,?,?) ON CONFLICT(collection,id) DO UPDATE SET owner_user_id=excluded.owner_user_id,group_id=excluded.group_id,student_id=excluded.student_id,payload_json=excluded.payload_json,updated_at=excluded.updated_at").bind(row.id,user.id,groupId,item.student_id,JSON.stringify(row),row.updated_at));}
      if(stmts.length)await env.DB.batch(stmts);await log(env,user.id,"attendance_save",{group_id:groupId,date,count:items.length});return json({ok:true,saved:items.length});
    }
    if(path==="/api/quran/progress"&&method==="GET"){
      if(user.role==="student"){const rows=await records(env,"quran_progress"," AND student_id=?",[user.student_id||""]);return json(rows);}
      if(user.role!=="admin"&&user.role!=="teacher")return fail(403,"غير مسموح");const studentId=clean(url.searchParams.get("student_id"),80);if(!studentId)return fail(400,"حدد الطالب");
      const s=await env.DB.prepare("SELECT group_id FROM students WHERE id=? AND active=1").bind(studentId).first();if(!s||!await canManageGroup(env,user,s.group_id))return fail(403,"لا تملك صلاحية هذا الطالب");
      return json(await records(env,"quran_progress"," AND student_id=?",[studentId]));
    }
    if(path==="/api/quran/progress"&&method==="POST"){
      if(user.role!=="admin"&&user.role!=="teacher")return fail(403,"تسجيل التقدم للمعلم أو المدير");const parsed=await parseBody(request);if(parsed.error)return parsed.error;const b=parsed.value,studentId=clean(b.student_id,80),date=clean(b.date,10)||nowIso().slice(0,10),memorized=clean(b.memorized,200),reviewed=clean(b.reviewed,200),notes=clean(b.notes,500);
      const s=await env.DB.prepare("SELECT group_id FROM students WHERE id=? AND active=1").bind(studentId).first();if(!s||!await canManageGroup(env,user,s.group_id))return fail(403,"لا تملك صلاحية هذا الطالب");if(!memorized&&!reviewed&&!notes)return fail(400,"أدخل الحفظ أو المراجعة أو ملاحظة");
      const row={id:uuid(),student_id:studentId,group_id:s.group_id,date,memorized,reviewed,notes,teacher_id:user.id,created_at:nowIso()};await saveRecord(env,"quran_progress",row);await log(env,user.id,"quran_progress_add",{student_id:studentId});return json(row,201);
    }
    if(path==="/api/tests"&&method==="GET"){
      const all=await scopedRecords(env,user,"tests",user.role==="student");
      if(user.role==="student"){
        const attempts=await records(env,"test_attempts");
        return json(all.map(t=>{
          const latest=attempts.filter(a=>a.student_id===user.student_id&&a.test_id===t.id).sort((a,b)=>String(b.submitted_at).localeCompare(String(a.submitted_at)))[0];
          return {...t,questions:(t.questions||[]).map(q=>({id:q.id,prompt:q.prompt,choices:q.choices})),my_attempt:latest?{score:latest.score,total:latest.total,submitted_at:latest.submitted_at}:null};
        }));
      }
      if(user.role==="teacher")return json(all.filter(t=>!!t.group_id));
      return json(all);
    }
    if(path==="/api/tests"&&method==="POST"){
      if(user.role!=="admin"&&user.role!=="teacher")return fail(403,"إنشاء الاختبارات للمعلم أو المدير");
      const parsed=await parseBody(request);if(parsed.error)return parsed.error;const b=parsed.value;
      const title=clean(b.title,160),description=clean(b.description,2000),groupId=clean(b.group_id,80)||null;
      const questions=Array.isArray(b.questions)?b.questions:[];
      if(!title||questions.length<1||questions.length>30)return fail(400,"أدخل عنوان الاختبار وسؤالًا واحدًا على الأقل (حتى 30 سؤالًا)");
      if(!groupId&&user.role!=="admin")return fail(403,"يمكن للمدير وحده إنشاء اختبار عام");
      if(groupId&&!await canManageGroup(env,user,groupId))return fail(403,"لا تملك صلاحية هذا الفوج");
      const normalized=[];
      for(const q0 of questions){
        const q=q0||{},prompt=clean(q.prompt,500),choices=Array.isArray(q.choices)?q.choices.map(c=>clean(c,250)).filter(Boolean):[],correct=Number(q.correct_index);
        if(!prompt||choices.length<2||choices.length>6||!Number.isInteger(correct)||correct<0||correct>=choices.length)return fail(400,"تحقق من نص كل سؤال وخياراته والإجابة الصحيحة");
        normalized.push({id:clean(q.id,80)||uuid(),prompt,choices,correct_index:correct,explanation:clean(q.explanation,500)});
      }
      const due=String(b.due_date||"");
      const test={id:uuid(),title,description,group_id:groupId,due_date:due.length===10?due:null,questions:normalized,status:"published",created_by:user.id,created_at:nowIso()};
      await saveRecord(env,"tests",test);await log(env,user.id,"test_create",{test_id:test.id,group_id:groupId,questions:normalized.length});
      return json(test,201);
    }
    if(path==="/api/test-submit"&&method==="POST"){
      if(user.role!=="student"||!user.student_id||!user.group_id)return fail(403,"تقديم الاختبار متاح لحساب الطالب المرتبط بفوج");
      const testId=clean(url.searchParams.get("id"),80);
      const raw=await env.DB.prepare("SELECT payload_json FROM academy_records WHERE collection='tests' AND id=?").bind(testId).first();
      if(!raw)return fail(404,"الاختبار غير موجود");
      let test;try{test=JSON.parse(raw.payload_json)}catch{return fail(500,"تعذّر قراءة الاختبار")}
      if(test.status!=="published"||(test.group_id&&test.group_id!==user.group_id))return fail(403,"هذا الاختبار غير متاح لحسابك");
      const parsed=await parseBody(request);if(parsed.error)return parsed.error;
      const submitted=Array.isArray(parsed.value.answers)?parsed.value.answers:[];
      const answerMap=new Map(submitted.map(a=>[String(a.question_id),Number(a.selected_index)]));
      let score=0;
      for(const q of (test.questions||[])){if(answerMap.get(String(q.id))===q.correct_index)score++;}
      const attempt={id:uuid(),test_id:test.id,title:test.title,student_id:user.student_id,group_id:user.group_id,score,total:(test.questions||[]).length,submitted_at:nowIso()};
      await saveRecord(env,"test_attempts",attempt);await log(env,user.id,"test_submit",{test_id:test.id,score,total:attempt.total});
      return json({ok:true,score,total:attempt.total,percent:attempt.total?Math.round(score*100/attempt.total):0,submitted_at:attempt.submitted_at});
    }
    if(path==="/api/test-history"&&method==="GET"){
      const studentId=clean(url.searchParams.get("student_id"),80);
      if(user.role==="student"){
        if(!user.student_id||studentId!==user.student_id)return fail(403,"لا يمكنك عرض نتائج طالب آخر");
      }else{
        if(user.role!=="admin"&&user.role!=="teacher")return fail(403,"عرض نتائج الطالب للمعلم أو المدير");
        const student=await env.DB.prepare("SELECT id,group_id FROM students WHERE id=? AND active=1").bind(studentId).first();
        if(!student||!await canManageGroup(env,user,student.group_id))return fail(403,"لا تملك صلاحية هذا الطالب");
      }
      const attempts=await records(env,"test_attempts");
      return json(attempts.filter(a=>a.student_id===studentId).sort((a,b)=>String(b.submitted_at).localeCompare(String(a.submitted_at))).slice(0,100).map(a=>({id:a.id,test_id:a.test_id,title:a.title,score:a.score,total:a.total,submitted_at:a.submitted_at})));
    }
    if(path==="/api/test-results"&&method==="GET"){
      if(user.role!=="admin"&&user.role!=="teacher")return fail(403,"عرض النتائج للمعلم أو المدير");
      const testId=clean(url.searchParams.get("id"),80);
      const raw=await env.DB.prepare("SELECT payload_json FROM academy_records WHERE collection='tests' AND id=?").bind(testId).first();
      if(!raw)return fail(404,"الاختبار غير موجود");
      let test;try{test=JSON.parse(raw.payload_json)}catch{return fail(500,"تعذّر قراءة الاختبار")}
      if(test.group_id&&!await canManageGroup(env,user,test.group_id))return fail(403,"لا تملك صلاحية نتائج هذا الاختبار");
      if(!test.group_id&&user.role!=="admin")return fail(403,"لا تملك صلاحية نتائج هذا الاختبار");
      const attempts=await records(env,"test_attempts");
      return json(attempts.filter(a=>a.test_id===test.id).map(a=>({id:a.id,student_id:a.student_id,score:a.score,total:a.total,submitted_at:a.submitted_at})));
    }
    if(path==="/api/test-delete"&&method==="POST"){
      if(user.role!=="admin"&&user.role!=="teacher")return fail(403,"حذف الاختبارات للمعلم أو المدير");
      const parsed=await parseBody(request);if(parsed.error)return parsed.error;
      const testId=clean(parsed.value.id,80);
      const raw=await env.DB.prepare("SELECT payload_json FROM academy_records WHERE collection='tests' AND id=?").bind(testId).first();
      if(!raw)return fail(404,"الاختبار غير موجود");
      let test;try{test=JSON.parse(raw.payload_json)}catch{return fail(500,"تعذّر قراءة الاختبار")}
      if(test.group_id&&!await canManageGroup(env,user,test.group_id))return fail(403,"لا تملك صلاحية هذا الاختبار");
      if(!test.group_id&&user.role!=="admin")return fail(403,"لا تملك صلاحية هذا الاختبار");
      await env.DB.prepare("DELETE FROM academy_records WHERE collection='tests' AND id=?").bind(test.id).run();
      await log(env,user.id,"test_delete",{test_id:test.id});return json({ok:true});
    }
    if(path==="/api/posts"&&method==="GET")return json(await scopedRecords(env,user,"posts",user.role==="student"));
    if(path==="/api/posts"&&method==="POST"){
      if(user.role!=="admin"&&user.role!=="teacher")return fail(403,"النشر للمعلم أو المدير");
      const parsed=await parseBody(request);if(parsed.error)return parsed.error;const b=parsed.value;
      const title=clean(b.title,160),content=clean(b.content,6000),groupId=clean(b.group_id,80)||null;
      if(!title||!content)return fail(400,"أدخل عنوان المنشور ومحتواه");
      if(!groupId&&user.role!=="admin")return fail(403,"يمكن للمدير وحده نشر محتوى عام");
      if(groupId&&!await canManageGroup(env,user,groupId))return fail(403,"لا تملك صلاحية هذا الفوج");
      const post={id:uuid(),title,content,group_id:groupId,status:"published",created_by:user.id,created_at:nowIso()};
      await saveRecord(env,"posts",post);await log(env,user.id,"post_create",{post_id:post.id,group_id:groupId});return json(post,201);
    }
    if(path==="/api/notifications"&&method==="GET")return json(await scopedRecords(env,user,"notifications",user.role==="student"));
    if(path==="/api/notifications"&&method==="POST"){
      if(user.role!=="admin"&&user.role!=="teacher")return fail(403,"إنشاء التنبيهات للمعلم أو المدير");
      const parsed=await parseBody(request);if(parsed.error)return parsed.error;const b=parsed.value;
      const title=clean(b.title,160),content=clean(b.content,2000),groupId=clean(b.group_id,80)||null;
      if(!title||!content)return fail(400,"أدخل عنوان التنبيه ومحتواه");
      if(!groupId&&user.role!=="admin")return fail(403,"يمكن للمدير وحده إرسال تنبيه عام");
      if(groupId&&!await canManageGroup(env,user,groupId))return fail(403,"لا تملك صلاحية هذا الفوج");
      const notice={id:uuid(),title,content,group_id:groupId,status:"published",created_by:user.id,created_at:nowIso()};
      await saveRecord(env,"notifications",notice);await log(env,user.id,"notification_create",{notification_id:notice.id,group_id:groupId});return json(notice,201);
    }
    if(path==="/api/subjects"&&method==="GET"){
      const custom=await scopedRecords(env,user,"subjects");
      return json([
        {id:"allah",title:"معرفة الله تعالى",description:"الأسماء الحسنى ومعانيها وآثارها في القلب والعمل.",builtin:true},
        {id:"prophet",title:"معرفة الرسول ﷺ",description:"السيرة النبوية والشمائل والاقتداء.",builtin:true},
        {id:"quran",title:"القرآن الكريم",description:"حفظ وفهم ومراجعة وتدبر وعمل.",builtin:true},
        {id:"sunnah",title:"السنة والمتون",description:"الأحاديث الجامعة والمتون التأسيسية.",builtin:true},
        {id:"adab",title:"الأدب والعمل",description:"آداب طالب العلم والأخلاق والتطبيق.",builtin:true},
        ...custom
      ]);
    }
    if(path==="/api/subjects"&&method==="POST"){
      if(user.role!=="admin")return fail(403,"إدارة المقررات للمدير فقط");
      const parsed=await parseBody(request);if(parsed.error)return parsed.error;const b=parsed.value;
      const title=clean(b.title,160),description=clean(b.description,2000);
      if(!title||!description)return fail(400,"أدخل عنوان المقرر ووصفه");
      const subject={id:uuid(),title,description,status:"published",created_by:user.id,created_at:nowIso()};
      await saveRecord(env,"subjects",subject);await log(env,user.id,"subject_create",{subject_id:subject.id});return json(subject,201);
    }
    if(path==="/api/quran"&&method==="GET")return json({levels:[],students:[],can_edit:user.role==="admin"||user.role==="teacher"});
    if(path==="/api/leaderboard"&&method==="GET"){
      const groupId=user.role==="student"?user.group_id:clean(url.searchParams.get("group_id"),80);
      if(!groupId)return fail(400,"لا يوجد فوج مرتبط بالحساب");
      if(user.role!=="student"&&!await canManageGroup(env,user,groupId))return fail(403,"لا تملك صلاحية هذا الفوج");
      if(user.role==="student"&&groupId!==user.group_id)return fail(403,"يمكنك رؤية ترتيب فوجك فقط");
      const students=await env.DB.prepare("SELECT id,display_name FROM students WHERE group_id=? AND active=1 ORDER BY display_name").bind(groupId).all();
      const roster=students.results||[];
      const [attendanceRows,quranRows,testRows]=await Promise.all([
        records(env,"attendance"," AND group_id=?",[groupId]),
        records(env,"quran_progress"," AND group_id=?",[groupId]),
        records(env,"test_attempts"," AND group_id=?",[groupId])
      ]);
      const bestTests=new Map();
      for(const attempt of testRows){const key=String(attempt.student_id)+":"+String(attempt.test_id);if(!bestTests.has(key)||Number(attempt.score)>Number(bestTests.get(key)))bestTests.set(key,Number(attempt.score)||0);}
      const ranked=roster.map(st=>{
        const present=attendanceRows.filter(a=>a.student_id===st.id&&a.status==="present").length;
        const quran=quranRows.filter(q=>q.student_id===st.id).length;
        let quizCorrect=0;for(const [key,score] of bestTests){if(key.startsWith(String(st.id)+":"))quizCorrect+=score;}
        return {name:st.display_name,points:present*5+quran*10+quizCorrect*3,present_days:present,quran_records:quran,quiz_correct:quizCorrect,is_self:user.role==="student"&&st.id===user.student_id};
      }).sort((a,b)=>b.points-a.points||a.name.localeCompare(b.name,"ar"));
      return json(ranked.map((r,i)=>({...r,rank:i+1})));
    }
    if(path==="/api/metrics"&&method==="GET"){
      if(user.role!=="admin")return fail(403,"forbidden");const counts=await env.DB.prepare("SELECT (SELECT COUNT(*) FROM users) AS users,(SELECT COUNT(*) FROM students WHERE active=1) AS students,(SELECT COUNT(*) FROM groups WHERE active=1) AS groups,(SELECT COUNT(*) FROM academy_records) AS records").first();return json({...counts,storage:"d1"});
    }
    return fail(404,"المسار غير موجود");
    } catch (error) {
      console.error("Ihsan API request failed", { path, method, message: String(error?.message || error) });
      if (path.startsWith("/api/")) return fail(500, "حدث خطأ داخلي أثناء معالجة الطلب. تم تسجيل الخطأ للتشخيص؛ أعد المحاولة.");
      return new Response("Internal Server Error", { status: 500 });
    }
  }
};
