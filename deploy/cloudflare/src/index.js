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
      const s=await env.DB.prepare("SELECT id,user_id,group_id FROM students WHERE id=? AND active=1").bind(studentMatch[1]).first();
      if(!s)return fail(404,"الطالب غير موجود");if(!await canManageGroup(env,user,s.group_id))return fail(403,"لا تملك صلاحية هذا الطالب");
      const parsed=await parseBody(request);if(parsed.error)return parsed.error;const b=parsed.value;
      const name=clean(b.name,120),identity=clean(b.username,120).toLowerCase(),password=String(b.password||"");
      if(!s.user_id||!name||!identity||identity.length>120||(password&&(password.length<8||password.length>256)))return fail(400,"تحقق من الاسم واسم الدخول وكلمة المرور (8 أحرف على الأقل)");
      const duplicate=await env.DB.prepare("SELECT id FROM users WHERE identity_normalized=? AND id<>? LIMIT 1").bind(identity,s.user_id).first();
      if(duplicate)return fail(409,"اسم الدخول مستخدم بالفعل");
      await env.DB.prepare("UPDATE students SET display_name=? WHERE id=?").bind(name,s.id).run();
      if(password)await env.DB.prepare("UPDATE users SET display_name=?,identity_normalized=?,password_hash=? WHERE id=?").bind(name,identity,await passwordHash(password),s.user_id).run();
      else await env.DB.prepare("UPDATE users SET display_name=?,identity_normalized=? WHERE id=?").bind(name,identity,s.user_id).run();
      await log(env,user.id,"student_update",{student_id:s.id,name});return json({ok:true,name,username:identity});
    }
    if(studentMatch&&method==="DELETE"){
      if(user.role!=="admin"&&user.role!=="teacher")return fail(403,"غير مسموح");const s=await env.DB.prepare("SELECT id,user_id,group_id FROM students WHERE id=? AND active=1").bind(studentMatch[1]).first();if(!s)return fail(404,"الطالب غير موجود");if(!await canManageGroup(env,user,s.group_id))return fail(403,"لا تملك صلاحية هذا الطالب");
      await env.DB.prepare("UPDATE students SET active=0 WHERE id=?").bind(s.id).run();if(s.user_id)await env.DB.prepare("UPDATE users SET active=0 WHERE id=?").bind(s.user_id).run();await log(env,user.id,"student_deactivate",{student_id:s.id});return json({ok:true});
    }
    if(path==="/api/attendance"&&method==="GET"){
      const date=clean(url.searchParams.get("date"),10)||nowIso().slice(0,10),groupId=clean(url.searchParams.get("group_id"),80);
      if(user.role==="student"){const rows=await records(env,"attendance"," AND student_id=?",[user.student_id||""]);return json(rows.filter(x=>x.date===date));}
      if(!groupId||!await canManageGroup(env,user,groupId))return fail(403,"اختر فوجًا ضمن صلاحيتك");
      return json(await records(env,"attendance"," AND group_id=?",[groupId]).then(a=>a.filter(x=>x.date===date)));
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
    if(path==="/api/tests"&&method==="GET")return json(user.role==="student"?[]:await records(env,"tests"));
    if(path==="/api/notifications"&&method==="GET")return json([]);
    if(path==="/api/posts"&&method==="GET")return json([]);
    if(path==="/api/subjects"&&method==="GET")return json([]);
    if(path==="/api/quran"&&method==="GET")return json({levels:[],students:[],can_edit:user.role==="admin"||user.role==="teacher"});
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
