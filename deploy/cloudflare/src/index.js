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
export const validDateOnly = value => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  if (!match) return false;
  const year=Number(match[1]), month=Number(match[2]), day=Number(match[3]);
  const date=new Date(0);
  date.setUTCHours(0,0,0,0);
  date.setUTCFullYear(year,month-1,day);
  return date.getUTCFullYear()===year && date.getUTCMonth()===month-1 && date.getUTCDate()===day;
};
const BULK_STUDENT_ONBOARDING_IDS=["roster-20261020-01","roster-20261020-04","roster-20261020-05","roster-20261020-07","roster-20261020-09","roster-20261020-11","roster-20261020-13","roster-20261020-14","roster-20261020-15","roster-20261020-16","roster-20261020-18","roster-20261020-19","roster-20261020-20","roster-20261020-22","roster-20261020-23","roster-20261020-24","roster-20261020-26","roster-20261020-27","roster-20261020-28","roster-20261020-29","roster-20261020-30","roster-20261020-32","roster-20261020-33","roster-20261020-35","roster-20261020-36","roster-20261020-37","roster-20261020-38","roster-20261020-39","roster-20261020-42","roster-20261020-43","roster-20261020-44","roster-20261020-46","roster-20261020-47","roster-20261020-48","roster-20261020-49","roster-20261020-50","roster-20261020-51","roster-20261020-53","roster-20261020-54","roster-20261020-55"];
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
let googleJwksCache = null;
let googleJwksCacheUntil = 0;
function googleBase64UrlBytes(value) {
 const b64=String(value).replace(/-/g,"+").replace(/_/g,"/");
 const padded=b64+"=".repeat((4-b64.length%4)%4);
 const binary=atob(padded);
 return Uint8Array.from(binary,ch=>ch.charCodeAt(0));
}
function googleDecodeJson(part){return JSON.parse(new TextDecoder().decode(googleBase64UrlBytes(part)))}
async function googleSigningKeys(force=false){
 if(!force&&googleJwksCache&&Date.now()<googleJwksCacheUntil)return googleJwksCache;
 let response;try{response=await fetch("https://www.googleapis.com/oauth2/v3/certs",{headers:{accept:"application/json"}})}catch{throw new Error("google_keys_unavailable")}
 if(!response.ok)throw new Error("google_keys_unavailable");
 const data=await response.json();if(!Array.isArray(data.keys)||!data.keys.length)throw new Error("google_keys_unavailable");
 const cc=response.headers.get("cache-control")||"",mt=(cc.match(/max-age=(\d+)/i)||[])[1],age=Math.max(60,Math.min(3600,Number(mt||300)));
 googleJwksCache=data.keys;googleJwksCacheUntil=Date.now()+age*1000;return googleJwksCache;
}
async function verifyGoogleIdToken(token,nonce,clientId){
 if(typeof token!=="string"||token.length<100||token.length>12000)throw new Error("invalid_google_token");
 const parts=token.split(".");if(parts.length!==3)throw new Error("invalid_google_token");
 let header,claims;try{header=googleDecodeJson(parts[0]);claims=googleDecodeJson(parts[1])}catch{throw new Error("invalid_google_token")}
 if(!header||header.alg!=="RS256"||typeof header.kid!=="string")throw new Error("invalid_google_token");
 const now=Math.floor(Date.now()/1000),aud=claims.aud===clientId||(Array.isArray(claims.aud)&&claims.aud.includes(clientId));
 if(!["accounts.google.com","https://accounts.google.com"].includes(claims.iss)||!aud||(claims.azp&&claims.azp!==clientId)||!Number.isFinite(Number(claims.exp))||Number(claims.exp)<=now||!Number.isFinite(Number(claims.iat))||Number(claims.iat)>now+60||Number(claims.iat)<now-3600||typeof claims.sub!=="string"||!claims.sub||claims.nonce!==nonce||!(claims.email_verified===true||claims.email_verified==="true")||typeof claims.email!=="string"||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(claims.email))throw new Error("invalid_google_token");
 let keys=await googleSigningKeys(),jwk=keys.find(k=>k.kid===header.kid&&k.kty==="RSA"&&(!k.use||k.use==="sig"));
 if(!jwk){keys=await googleSigningKeys(true);jwk=keys.find(k=>k.kid===header.kid&&k.kty==="RSA"&&(!k.use||k.use==="sig"))}
 if(!jwk)throw new Error("invalid_google_token");
 try{const key=await crypto.subtle.importKey("jwk",jwk,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["verify"]);const ok=await crypto.subtle.verify("RSASSA-PKCS1-v1_5",key,googleBase64UrlBytes(parts[2]),new TextEncoder().encode(parts[0]+"."+parts[1]));if(!ok)throw new Error("invalid_google_token")}catch(e){if(e&&e.message==="invalid_google_token")throw e;throw new Error("invalid_google_token")}
 return claims;
}

async function bodyJson(request, maxBytes = 32000) {
  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > maxBytes) throw new Error("payload_too_large");
  try { return raw ? JSON.parse(raw) : {}; } catch { throw new Error("invalid_json"); }
}
async function currentUser(request, env) {
  const match = /^Bearer\s+([a-f0-9]{64})$/i.exec(request.headers.get("authorization") || "");
  if (!match) return null;
  const row = await env.DB.prepare("SELECT u.id,u.display_name,u.identity_normalized,u.role,u.active,u.must_change_password FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.active=1").bind(await hashToken(match[1]), nowIso()).first();
  if (!row) return null;
  const student = row.role === "student" ? await env.DB.prepare("SELECT id,group_id FROM students WHERE user_id=? AND active=1").bind(row.id).first() : null;
  let scope = null;
  if (row.role === "director" || row.role === "supervisor") {
    const storedScope = await env.DB.prepare("SELECT payload_json FROM academy_records WHERE collection='staff_scopes' AND owner_user_id=? ORDER BY updated_at DESC LIMIT 1").bind(row.id).first();
    try { scope = storedScope ? JSON.parse(storedScope.payload_json) : null; } catch { scope = null; }
  }
  return { id: row.id, name: row.display_name, email: row.identity_normalized, role: row.role, active: !!row.active, must_change_password: row.must_change_password===1, student_id: student?.id || null, group_id: student?.group_id || null, school_ids: Array.isArray(scope?.school_ids) ? scope.school_ids : [], group_ids: Array.isArray(scope?.group_ids) ? scope.group_ids : [] };
}
const safeUser = u => ({ id:u.id, name:u.name, email:u.email, role:u.role, active:true, must_change_password:!!u.must_change_password, theme:"emerald", font_scale:1, high_contrast:false, reduced_motion:false, student_id:u.student_id || null, group_id:u.group_id || null });
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
  const g = await groupRow(env, groupId);
  if (!g || g.active !== 1) return false;
  if (user.role === "teacher") return g.teacher_id === user.id;
  if (user.role === "director") return Array.isArray(user.school_ids) && user.school_ids.includes(g.school_id);
  if (user.role === "supervisor") return Array.isArray(user.group_ids) && user.group_ids.includes(g.id);
  return false;
}
async function canViewGroup(env, user, groupId) {
  if (!groupId || user.role === "admin") return true;
  if (user.role === "student") return user.group_id === groupId;
  return canManageGroup(env, user, groupId);
}
async function managedGroupIds(env, user) {
  if (user.role === "admin") return null;
  if (user.role === "teacher") {
    const rows = await env.DB.prepare("SELECT id FROM groups WHERE active=1 AND teacher_id=? ORDER BY name").bind(user.id).all();
    return (rows.results || []).map(row => row.id);
  }
  if (user.role === "director") {
    const ids = Array.isArray(user.school_ids) ? [...new Set(user.school_ids.filter(Boolean))] : [];
    if (!ids.length) return [];
    const marks = ids.map(() => "?").join(",");
    const rows = await env.DB.prepare("SELECT id FROM groups WHERE active=1 AND school_id IN (" + marks + ") ORDER BY name").bind(...ids).all();
    return (rows.results || []).map(row => row.id);
  }
  if (user.role === "supervisor") {
    const ids = Array.isArray(user.group_ids) ? [...new Set(user.group_ids.filter(Boolean))] : [];
    if (!ids.length) return [];
    const marks = ids.map(() => "?").join(",");
    const rows = await env.DB.prepare("SELECT id FROM groups WHERE active=1 AND id IN (" + marks + ") ORDER BY name").bind(...ids).all();
    return (rows.results || []).map(row => row.id);
  }
  return user.role === "student" && user.group_id ? [user.group_id] : [];
}
async function messageRecipientRows(env,user) {
  if(user.role==="admin"){
    const result=await env.DB.prepare("SELECT id,display_name,role FROM users WHERE active=1 AND id<>? ORDER BY display_name").bind(user.id).all();
    return (result.results||[]).map(row=>({id:row.id,name:row.display_name,role:row.role}));
  }
  const output=[],seen=new Set();
  const add=rows=>{for(const row of rows||[])if(row.id!==user.id&&!seen.has(row.id)){seen.add(row.id);output.push({id:row.id,name:row.display_name,role:row.role});}};
  const admins=await env.DB.prepare("SELECT id,display_name,role FROM users WHERE active=1 AND role='admin' AND id<>? ORDER BY display_name").bind(user.id).all();
  add(admins.results);
  if(user.role==="student"){
    if(user.group_id){
      const teacher=await env.DB.prepare("SELECT u.id,u.display_name,u.role FROM groups g JOIN users u ON u.id=g.teacher_id WHERE g.id=? AND g.active=1 AND u.active=1").bind(user.group_id).all();
      add(teacher.results);
    }
    return output.sort((a,b)=>a.name.localeCompare(b.name,"ar"));
  }
  if(!["teacher","director","supervisor"].includes(user.role))return output;
  const groupIds=await managedGroupIds(env,user);
  if(groupIds===null||!groupIds.length)return output.sort((a,b)=>a.name.localeCompare(b.name,"ar"));
  const marks=groupIds.map(()=>"?").join(",");
  const students=await env.DB.prepare("SELECT DISTINCT u.id,u.display_name,u.role FROM students s JOIN users u ON u.id=s.user_id WHERE s.active=1 AND u.active=1 AND s.group_id IN ("+marks+") ORDER BY u.display_name").bind(...groupIds).all();
  add(students.results);
  const teachers=await env.DB.prepare("SELECT DISTINCT u.id,u.display_name,u.role FROM groups g JOIN users u ON u.id=g.teacher_id WHERE g.active=1 AND u.active=1 AND g.id IN ("+marks+") ORDER BY u.display_name").bind(...groupIds).all();
  add(teachers.results);
  return output.sort((a,b)=>a.name.localeCompare(b.name,"ar"));
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
async function uniqueStudentIdentity(env, value, exceptUserId = null, studentId = "") {
  const base=clean(value,88).toLowerCase()||"student";
  const suffix=String(studentId||"user").slice(-4)||"user";
  for(let attempt=0;attempt<100;attempt++){
    let candidate;
    if(attempt===0)candidate=base;
    else if(attempt<50)candidate=base+" ("+suffix+(attempt>1?"-"+attempt:"")+")";
    else candidate="student-"+uuid().replace(/-/g,"").slice(0,12);
    const occupied=exceptUserId
      ? await env.DB.prepare("SELECT id FROM users WHERE identity_normalized=? AND id<>? LIMIT 1").bind(candidate,exceptUserId).first()
      : await env.DB.prepare("SELECT id FROM users WHERE identity_normalized=? LIMIT 1").bind(candidate).first();
    if(!occupied)return candidate;
  }
  throw new Error("تعذّر توليد اسم دخول فريد لهذا الطالب");
}
async function parseBody(request, maxBytes = 32000) {
  try { return { value: await bodyJson(request, maxBytes), error: null }; }
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
    if (path === "/api/auth/google/config" && method === "GET") {
      const clientId=clean(env.GOOGLE_CLIENT_ID,300),enabled=!!clientId&&clientId.endsWith(".apps.googleusercontent.com");
      return json({enabled,client_id:enabled?clientId:null});
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
    if (path === "/api/auth/google" && method === "POST") {
      const clientId=clean(env.GOOGLE_CLIENT_ID,300);
      if(!clientId.endsWith(".apps.googleusercontent.com"))return fail(503,"الدخول بجوجل غير مهيأ بعد. استخدم كلمة المرور مؤقتًا.");
      const parsed=await parseBody(request,18000);if(parsed.error)return parsed.error;
      const b=parsed.value,credential=String(b.credential||""),nonce=String(b.nonce||"");
      if(!credential||!/^[a-f0-9]{48,96}$/i.test(nonce))return fail(400,"تعذر بدء التحقق من حساب Google. أعد المحاولة.");
      let claims;try{claims=await verifyGoogleIdToken(credential,nonce,clientId)}catch(error){if(String(error&&(error.message||error))==="google_keys_unavailable")return fail(503,"تعذر الاتصال بخدمة التحقق من Google. أعد المحاولة.");return fail(401,"لم نستطع التحقق من حساب Google. أعد المحاولة.")}
      const identity=clean(claims.email,200).toLowerCase();
      const user=await env.DB.prepare("SELECT id,display_name,identity_normalized,role,active,must_change_password FROM users WHERE identity_normalized=? LIMIT 1").bind(identity).first();
      if(!user||user.active!==1)return fail(403,"لا يوجد حساب مفعّل مرتبط بهذا البريد. اطلب من الإدارة إنشاء حسابك بالبريد نفسه.");
      if(user.must_change_password===1)return fail(403,"لأول دخول، استخدم اسم الدخول وكلمة المرور المؤقتة المرسلة إليك وغيّرها أولًا؛ بعد ذلك يمكنك الدخول باستخدام Google.");
      const token=hex(crypto.getRandomValues(new Uint8Array(32))),remember=b.remember===true,lifetime=(remember?30*24:12)*60*60*1000;
      await env.DB.prepare("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)").bind(await hashToken(token),user.id,new Date(Date.now()+lifetime).toISOString()).run();
      const student=user.role==="student"?await env.DB.prepare("SELECT id,group_id FROM students WHERE user_id=? AND active=1").bind(user.id).first():null;
      await log(env,user.id,"google_login");
      return json({token,user:safeUser({id:user.id,name:user.display_name,email:user.identity_normalized,role:user.role,must_change_password:user.must_change_password===1,student_id:student&&student.id,group_id:student&&student.group_id})});
    }
    if (path === "/api/login" && method === "POST") {
      const parsed=await parseBody(request); if(parsed.error)return parsed.error; const b=parsed.value;
      const identity=clean(b.identity??b.email,200).toLowerCase(), password=String(b.password||"");
      if(!identity||!password||password.length>1024)return fail(400,"أدخل اسم الدخول وكلمة المرور");
      const now=nowIso(), attempt=await env.DB.prepare("SELECT failures,locked_until FROM login_attempts WHERE identity_normalized=?").bind(identity).first();
      if(attempt?.locked_until && attempt.locked_until>now)return fail(429,"محاولات كثيرة. انتظر 15 دقيقة ثم أعد المحاولة.");
      const user=await env.DB.prepare("SELECT id,display_name,identity_normalized,password_hash,role,active,must_change_password FROM users WHERE identity_normalized=? LIMIT 1").bind(identity).first();
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
      return json({token,user:safeUser({id:user.id,name:user.display_name,email:user.identity_normalized,role:user.role,must_change_password:user.must_change_password===1,student_id:student?.id,group_id:student?.group_id})});
    }
    if (!path.startsWith("/api/")) return env.ASSETS.fetch(request);
    if (path === "/api/logout" && method === "POST") {
      const match=/^Bearer\s+([a-f0-9]{64})$/i.exec(request.headers.get("authorization")||""); if(match)await env.DB.prepare("DELETE FROM sessions WHERE token_hash=?").bind(await hashToken(match[1])).run(); return json({ok:true});
    }
    const user=await currentUser(request,env); if(!user)return fail(401,"يرجى تسجيل الدخول");
    if(user.must_change_password && !["/api/me","/api/me/password","/api/logout"].includes(path))return fail(403,"يجب تغيير كلمة المرور المؤقتة قبل متابعة استخدام الأكاديمية.");
    if(path==="/api/me/password"&&method==="POST"){
      const parsed=await parseBody(request);if(parsed.error)return parsed.error;const b=parsed.value;
      const currentPassword=String(b.current_password||""),newPassword=String(b.new_password||"");
      if(!currentPassword||newPassword.length<10||newPassword.length>256)return fail(400,"أدخل كلمة المرور الحالية، واجعل الجديدة 10 أحرف على الأقل");
      const stored=await env.DB.prepare("SELECT password_hash FROM users WHERE id=? AND active=1").bind(user.id).first();
      if(!stored||!await verifyPassword(currentPassword,stored.password_hash))return fail(401,"كلمة المرور الحالية غير صحيحة");
      if(currentPassword===newPassword)return fail(400,"اختر كلمة مرور جديدة مختلفة");
      await env.DB.prepare("UPDATE users SET password_hash=?,must_change_password=0 WHERE id=?").bind(await passwordHash(newPassword),user.id).run();
      const match=/^Bearer\s+([a-f0-9]{64})$/i.exec(request.headers.get("authorization")||"");
      if(match)await env.DB.prepare("DELETE FROM sessions WHERE user_id=? AND token_hash<>?").bind(user.id,await hashToken(match[1])).run();
      await log(env,user.id,"password_change",{});
      return json({ok:true,message:"تم تغيير كلمة المرور وإبطال الجلسات الأخرى"});
    }
    if(path==="/api/me"&&method==="GET")return json(safeUser(user));
    if(path==="/api/dashboard"&&method==="GET"){
      const isAdmin=user.role==="admin";
      const staffRoles=["admin","teacher","director","supervisor"];
      const isStaff=staffRoles.includes(user.role);
      let groupIds=null;
      if(!isAdmin&&isStaff)groupIds=await managedGroupIds(env,user);
      const today=nowIso().slice(0,10);
      let groupsCount=0,studentsCount=0,attendanceRows=[],tests=[];
      if(isAdmin){
        const result=await Promise.all([
          env.DB.prepare("SELECT COUNT(*) AS n FROM groups WHERE active=1").first(),
          env.DB.prepare("SELECT COUNT(*) AS n FROM students WHERE active=1").first(),
          env.DB.prepare("SELECT payload_json FROM academy_records WHERE collection='attendance' AND json_extract(payload_json,'$.date')=? ORDER BY updated_at DESC LIMIT 1000").bind(today).all(),
          records(env,"tests")
        ]);
        groupsCount=result[0]?.n||0;studentsCount=result[1]?.n||0;
        attendanceRows=(result[2]?.results||[]).flatMap(row=>{try{return [JSON.parse(row.payload_json)]}catch{return []}});
        tests=result[3]||[];
      }else if(isStaff){
        if(groupIds===null){
          const result=await env.DB.prepare("SELECT COUNT(*) AS n FROM groups WHERE active=1").first();
          groupsCount=result?.n||0;
        }else if(groupIds.length){
          const marks=groupIds.map(()=>"?").join(",");
          const [studentResult,attendanceResult,testRows]=await Promise.all([
            env.DB.prepare("SELECT COUNT(*) AS n FROM students WHERE active=1 AND group_id IN ("+marks+")").bind(...groupIds).first(),
            env.DB.prepare("SELECT payload_json FROM academy_records WHERE collection='attendance' AND group_id IN ("+marks+") AND json_extract(payload_json,'$.date')=? ORDER BY updated_at DESC LIMIT 1000").bind(...groupIds,today).all(),
            records(env,"tests"," AND group_id IN ("+marks+")",groupIds)
          ]);
          studentsCount=studentResult?.n||0;
          attendanceRows=(attendanceResult.results||[]).flatMap(row=>{try{return [JSON.parse(row.payload_json)]}catch{return []}});
          tests=(testRows||[]).filter(test=>!!test.group_id&&groupIds.includes(test.group_id));
          groupsCount=groupIds.length;
        }
      }else if(user.role==="student"){
        attendanceRows=await records(env,"attendance"," AND student_id=?",[user.student_id||""]);
        tests=(await records(env,"tests"," AND group_id=?",[user.group_id||""])).filter(test=>test.status==="published"&&(!test.group_id||test.group_id===user.group_id));
      }
      const todayRows=attendanceRows.filter(row=>row.date===today);
      return json({students_count:studentsCount,groups_count:groupsCount,attendance_rate:(todayRows.filter(row=>["present","absent","late"].includes(row.status)).length)?Math.round(100*todayRows.filter(row=>row.status==="present"||row.status==="late").length/todayRows.filter(row=>["present","absent","late"].includes(row.status)).length):0,attendance_marked:isAdmin?todayRows.length:null,progress_avg:null,upcoming_tests:tests.filter(test=>!test.due_date||test.due_date>=today).length});
    }
    if(path==="/api/groups"&&method==="GET"){
      let rows;
      if(user.role==="admin")rows=await env.DB.prepare("SELECT id,name,school_id,teacher_id,active FROM groups WHERE active=1 ORDER BY name").all();
      else if(["teacher","director","supervisor"].includes(user.role)){
        const ids=await managedGroupIds(env,user);
        if(ids===null)rows=await env.DB.prepare("SELECT id,name,school_id,teacher_id,active FROM groups WHERE active=1 ORDER BY name").all();
        else if(ids.length){const marks=ids.map(()=>"?").join(",");rows=await env.DB.prepare("SELECT id,name,school_id,teacher_id,active FROM groups WHERE active=1 AND id IN ("+marks+") ORDER BY name").bind(...ids).all();}
        else rows={results:[]};
      }else if(user.role==="student"&&user.group_id){const g=await groupRow(env,user.group_id);rows={results:g&&g.active===1?[g]:[]};}
      else rows={results:[]};
      return json(rows.results||[]);
    }
    if(path==="/api/groups"&&method==="POST"){
      if(user.role!=="admin"&&user.role!=="director")return fail(403,"إنشاء الأفواج للمدير العام أو مدير المدرسة"); const parsed=await parseBody(request);if(parsed.error)return parsed.error;
      const name=clean(parsed.value.name,120),teacherId=clean(parsed.value.teacher_id,80)||null;
      const schoolId=clean(parsed.value.school_id,80)||(user.role==="director"?(user.school_ids||[])[0]:"qs-rahman");
      if(!name)return fail(400,"اسم الفوج مطلوب");
      if(user.role==="director"&&!(user.school_ids||[]).includes(schoolId))return fail(403,"هذه المدرسة خارج نطاق صلاحيتك");
      const school=await env.DB.prepare("SELECT id FROM quran_schools WHERE id=? AND active=1").bind(schoolId).first();if(!school)return fail(400,"المدرسة المحددة غير موجودة");
      if(teacherId){const t=await env.DB.prepare("SELECT id FROM users WHERE id=? AND role IN ('teacher','admin') AND active=1").bind(teacherId).first();if(!t)return fail(400,"المعلم المحدد غير صالح");}
      const id=uuid();await env.DB.prepare("INSERT INTO groups(id,name,school_id,teacher_id,active) VALUES(?,?,?, ?,1)").bind(id,name,schoolId,teacherId).run();await log(env,user.id,"group_create",{id,name,school_id:schoolId});return json({id,name,school_id:schoolId,teacher_id:teacherId,active:1},201);
    }
    const groupMatch=path.match(/^\/api\/groups\/([^/]+)$/);
    if(groupMatch&&method==="PATCH"){
      if(user.role!=="admin"&&user.role!=="director")return fail(403,"تعديل الأفواج للمدير العام أو مدير المدرسة");const parsed=await parseBody(request);if(parsed.error)return parsed.error;const id=groupMatch[1],b=parsed.value;
      const g=await groupRow(env,id);if(!g)return fail(404,"الفوج غير موجود");if(!await canManageGroup(env,user,id))return fail(403,"الفوج خارج نطاق صلاحيتك");
      const name=clean(b.name??g.name,120),teacherId=b.teacher_id===undefined?g.teacher_id:(clean(b.teacher_id,80)||null);
      if(!name)return fail(400,"اسم الفوج مطلوب");
      if(teacherId){const t=await env.DB.prepare("SELECT id FROM users WHERE id=? AND role IN ('teacher','admin') AND active=1").bind(teacherId).first();if(!t)return fail(400,"المعلم المحدد غير صالح");}
      await env.DB.prepare("UPDATE groups SET name=?,teacher_id=? WHERE id=?").bind(name,teacherId,id).run();await log(env,user.id,"group_update",{id,name});return json({ok:true});
    }
    if(groupMatch&&method==="DELETE"){
      if(user.role!=="admin"&&user.role!=="director")return fail(403,"إيقاف الأفواج للمدير العام أو مدير المدرسة");if(!await canManageGroup(env,user,groupMatch[1]))return fail(403,"الفوج خارج نطاق صلاحيتك");await env.DB.prepare("UPDATE groups SET active=0 WHERE id=?").bind(groupMatch[1]).run();await log(env,user.id,"group_deactivate",{id:groupMatch[1]});return json({ok:true});
    }
    if(path==="/api/teachers"&&method==="GET"){
      if(user.role==="admin"){const r=await env.DB.prepare("SELECT id,display_name AS name,identity_normalized AS username FROM users WHERE role='teacher' AND active=1 ORDER BY display_name").all();return json(r.results||[]);}
      if(user.role==="director"){
        const ids=await managedGroupIds(env,user);if(!ids.length)return json([]);
        const marks=ids.map(()=>"?").join(",");
        const r=await env.DB.prepare("SELECT DISTINCT u.id,u.display_name AS name,u.identity_normalized AS username FROM users u JOIN groups g ON g.teacher_id=u.id WHERE u.role='teacher' AND u.active=1 AND g.active=1 AND g.id IN ("+marks+") ORDER BY u.display_name").bind(...ids).all();
        return json(r.results||[]);
      }
      return fail(403,"هذه القائمة للمدير العام أو مدير المدرسة ضمن نطاقه");
    }
    if(path==="/api/admin/staff"&&method==="GET"){
      if(user.role!=="admin")return fail(403,"هذه القائمة للمدير العام فقط");
      const rows=await env.DB.prepare("SELECT id,display_name AS name,identity_normalized AS username,role FROM users WHERE active=1 AND role IN ('director','supervisor') ORDER BY role,display_name").all();
      const staff=[];
      for(const row of rows.results||[]){
        const q=await env.DB.prepare("SELECT payload_json FROM academy_records WHERE collection='staff_scopes' AND owner_user_id=? LIMIT 1").bind(row.id).first();
        let scope={school_ids:[],group_ids:[]};try{if(q)scope=JSON.parse(q.payload_json)}catch{}
        staff.push({...row,school_ids:Array.isArray(scope.school_ids)?scope.school_ids:[],group_ids:Array.isArray(scope.group_ids)?scope.group_ids:[]});
      }
      return json(staff);
    }
    if(path==="/api/admin/staff"&&method==="POST"){
      if(user.role!=="admin")return fail(403,"إنشاء حسابات الإدارة للمدير العام فقط");
      const parsed=await parseBody(request);if(parsed.error)return parsed.error;const b=parsed.value;
      const name=clean(b.name,120),identity=clean(b.username,120).toLowerCase(),password=String(b.password||""),role=clean(b.role,20);
      if(!name||!identity||identity.length>120||password.length<12||password.length>256||!["director","supervisor"].includes(role))return fail(400,"أدخل الاسم واسم الدخول وكلمة مرور من 12 حرفًا على الأقل وحدد الدور");
      let schoolIds=Array.isArray(b.school_ids)?[...new Set(b.school_ids.map(x=>clean(x,80)).filter(Boolean))]:[];
      let groupIds=Array.isArray(b.group_ids)?[...new Set(b.group_ids.map(x=>clean(x,80)).filter(Boolean))]:[];
      if(role==="director"){
        if(!schoolIds.length||schoolIds.length>20)return fail(400,"حدّد مدرسة واحدة على الأقل لمدير المدرسة");
        const found=await env.DB.prepare("SELECT id FROM quran_schools WHERE active=1 AND id IN ("+schoolIds.map(()=>"?").join(",")+")").bind(...schoolIds).all();
        if((found.results||[]).length!==schoolIds.length)return fail(400,"توجد مدرسة غير صالحة ضمن نطاق الحساب");
        groupIds=[];
      }else{
        if(!groupIds.length||groupIds.length>50)return fail(400,"حدّد فوجًا واحدًا على الأقل للمشرف");
        const found=await env.DB.prepare("SELECT id FROM groups WHERE active=1 AND id IN ("+groupIds.map(()=>"?").join(",")+")").bind(...groupIds).all();
        if((found.results||[]).length!==groupIds.length)return fail(400,"يوجد فوج غير صالح ضمن نطاق الحساب");
        schoolIds=[];
      }
      const id=uuid();
      try{
        await env.DB.prepare("INSERT INTO users(id,display_name,identity_normalized,password_hash,role,active,must_change_password) VALUES(?,?,?,?,?,1,1)").bind(id,name,identity,await passwordHash(password),role).run();
        await saveRecord(env,"staff_scopes",{id:"scope:"+id,owner_user_id:id,role,school_ids:schoolIds,group_ids:groupIds,created_by:user.id,created_at:nowIso()});
      }catch(error){
        await env.DB.prepare("DELETE FROM academy_records WHERE collection='staff_scopes' AND id=?").bind("scope:"+id).run();
        await env.DB.prepare("DELETE FROM users WHERE id=?").bind(id).run();
        if(String(error?.message||error).toLowerCase().includes("unique"))return fail(409,"اسم الدخول مستخدم بالفعل");
        console.error("Ihsan staff setup failed",{message:String(error?.message||error)});
        return fail(500,"تعذّر إنشاء حساب الفريق؛ لم يتم تغيير ملفات الطلاب");
      }
      await log(env,user.id,"staff_account_created",{id,role,school_count:schoolIds.length,group_count:groupIds.length});
      return json({ok:true,id,name,username:identity,role,school_ids:schoolIds,group_ids:groupIds},201);
    }
    const staffMatch=path.match(/^\/api\/admin\/staff\/([^/]+)$/);
    if(staffMatch&&method==="DELETE"){
      if(user.role!=="admin")return fail(403,"تعطيل حسابات الإدارة للمدير العام فقط");
      const target=await env.DB.prepare("SELECT id,role FROM users WHERE id=? AND role IN ('director','supervisor') AND active=1").bind(staffMatch[1]).first();
      if(!target)return fail(404,"حساب الفريق غير موجود");
      await env.DB.prepare("UPDATE users SET active=0 WHERE id=?").bind(target.id).run();
      await env.DB.prepare("DELETE FROM sessions WHERE user_id=?").bind(target.id).run();
      await log(env,user.id,"staff_account_deactivate",{id:target.id,role:target.role});
      return json({ok:true});
    }
    if(path==="/api/teachers"&&method==="POST"){
      if(user.role!=="admin")return fail(403,"إضافة المعلمين للمدير فقط");const parsed=await parseBody(request);if(parsed.error)return parsed.error;const b=parsed.value;
      const name=clean(b.name,120),identity=clean(b.username,100).toLowerCase(),password=String(b.password||"");
      if(!name||!identity||identity.length>120||password.length<8||password.length>256)return fail(400,"أدخل الاسم وكلمة مرور من 8 أحرف على الأقل");
      const id=uuid();try{await env.DB.prepare("INSERT INTO users(id,display_name,identity_normalized,password_hash,role,active,must_change_password) VALUES(?,?,?,?, 'teacher',1,1)").bind(id,name,identity,await passwordHash(password)).run();}catch{return fail(409,"اسم الدخول مستخدم بالفعل");}
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
      if(password)await env.DB.prepare("UPDATE users SET display_name=?,identity_normalized=?,password_hash=?,must_change_password=1 WHERE id=?").bind(name,identity,await passwordHash(password),target.id).run();
      else await env.DB.prepare("UPDATE users SET display_name=?,identity_normalized=? WHERE id=?").bind(name,identity,target.id).run();
      await log(env,user.id,"teacher_update",{id:target.id,name});return json({ok:true,name,username:identity});
    }
    if(path==="/api/students"&&method==="GET"){
      if(user.role==="student"){
        const r=await env.DB.prepare("SELECT id,display_name AS name,group_id,active FROM students WHERE user_id=? AND active=1").bind(user.id).all();return json(r.results||[]);
      }
      if(!["admin","teacher","director","supervisor"].includes(user.role))return fail(403,"غير مسموح");
      const groupId=clean(url.searchParams.get("group_id"),80);
      if(groupId&&!await canManageGroup(env,user,groupId))return fail(403,"هذا الفوج خارج صلاحيتك");
      const base="SELECT students.id,students.display_name AS name,students.group_id,students.user_id,students.active,(SELECT identity_normalized FROM users WHERE users.id=students.user_id) AS username FROM students WHERE students.active=1";
      const groupIds=await managedGroupIds(env,user);let sql=base,binds=[];
      if(groupIds!==null){if(!groupIds.length)return json([]);sql+=" AND group_id IN ("+groupIds.map(()=>"?").join(",")+")";binds.push(...groupIds);}
      if(groupId){sql+=" AND group_id=?";binds.push(groupId);}
      sql+=" ORDER BY display_name";
      const r=await env.DB.prepare(sql).bind(...binds).all();
      return json(r.results||[]);
    }
    if(path==="/api/students"&&method==="POST"){
      if(!["admin","teacher","director","supervisor"].includes(user.role))return fail(403,"غير مسموح");const parsed=await parseBody(request);if(parsed.error)return parsed.error;const b=parsed.value;
      const name=clean(b.name,120),identity=clean(b.username,100).toLowerCase(),password=String(b.password||""),groupId=clean(b.group_id,80);
      if(!name||!identity||identity.length>120||password.length<8||password.length>256||!groupId)return fail(400,"أكمل الاسم وكلمة المرور والفوج");
      if(!await canManageGroup(env,user,groupId))return fail(403,"لا تملك صلاحية هذا الفوج");
      const id=uuid(),studentId=uuid();
      try{await env.DB.prepare("INSERT INTO users(id,display_name,identity_normalized,password_hash,role,active,must_change_password) VALUES(?,?,?,?, 'student',1,1)").bind(id,name,identity,await passwordHash(password)).run();
        await env.DB.prepare("INSERT INTO students(id,user_id,display_name,group_id,active) VALUES(?,?,?,?,1)").bind(studentId,id,name,groupId).run();}
      catch{await env.DB.prepare("DELETE FROM users WHERE id=?").bind(id).run();return fail(409,"اسم الدخول مستخدم بالفعل");}
      await log(env,user.id,"student_create",{student_id:studentId,group_id:groupId});return json({id:studentId,user_id:id,name,username:identity,group_id:groupId},201);
    }
    const rosterAccountMatch=path.match(/^\/api\/students\/([^/]+)\/account$/);
    if(rosterAccountMatch&&method==="POST"){
      if(!["admin","teacher","director","supervisor"].includes(user.role))return fail(403,"غير مسموح");
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
        await env.DB.prepare("INSERT INTO users(id,display_name,identity_normalized,password_hash,role,active,must_change_password) VALUES(?,?,?,?, 'student',1,1)").bind(userId,name,identity,await passwordHash(password)).run();
        await env.DB.prepare("UPDATE students SET user_id=?,display_name=? WHERE id=?").bind(userId,name,s.id).run();
      }catch(error){
        await env.DB.prepare("DELETE FROM users WHERE id=?").bind(userId).run();
        return fail(409,"تعذّر إنشاء الحساب؛ تحقّق من اسم الدخول ثم أعد المحاولة");
      }
      await log(env,user.id,"student_account_created",{student_id:s.id,group_id:s.group_id});
      return json({ok:true,id:s.id,user_id:userId,name,username:identity,group_id:s.group_id},201);
    }
    if(path==="/api/admin/students/bulk-onboarding/status"&&method==="GET"){
      if(user.role!=="admin")return fail(403,"تهيئة حسابات الطلاب الجماعية للمدير العام فقط");
      const raw=await env.DB.prepare("SELECT payload_json FROM academy_records WHERE collection='platform_settings' AND id='student_bulk_onboarding_v1'").first();
      let state={};try{state=raw?JSON.parse(raw.payload_json):{}}catch{}
      const done=Array.isArray(state.completed_student_ids)?state.completed_student_ids:[];
      return json({completed:state.completed===true&&BULK_STUDENT_ONBOARDING_IDS.every(id=>done.includes(id)),completed_count:done.length,total:BULK_STUDENT_ONBOARDING_IDS.length});
    }
    if(path==="/api/admin/students/bulk-onboarding"&&method==="POST"){
      if(user.role!=="admin")return fail(403,"تهيئة حسابات الطلاب الجماعية للمدير العام فقط");
      const parsed=await parseBody(request);if(parsed.error)return parsed.error;const b=parsed.value;
      const requestedInput=Array.isArray(b.student_ids)?[...new Set(b.student_ids.map(x=>clean(x,80)).filter(Boolean))]:[];
      if(!requestedInput.length||requestedInput.length>BULK_STUDENT_ONBOARDING_IDS.length||requestedInput.some(id=>!BULK_STUDENT_ONBOARDING_IDS.includes(id)))return fail(400,"اختر أسماء الفوج المحددة في إجراء التهيئة فقط");
      const markerId="student_bulk_onboarding_v1";
      const rawState=await env.DB.prepare("SELECT payload_json FROM academy_records WHERE collection='platform_settings' AND id=?").bind(markerId).first();
      let state={};try{state=rawState?JSON.parse(rawState.payload_json):{}}catch{}
      const completedIds=new Set(Array.isArray(state.completed_student_ids)?state.completed_student_ids:[]);
      if(state.completed===true&&BULK_STUDENT_ONBOARDING_IDS.every(id=>completedIds.has(id)))return fail(409,"تم تجهيز حسابات الأسماء الكاملة بالفعل. أُخفي هذا الإجراء من المنصة.");
      const requested=requestedInput.filter(id=>!completedIds.has(id));
      if(!requested.length)return fail(409,"اكتملت أسماء هذه الدفعة سابقًا.");
      const credentials=[],skipped=[];let created=0,reset=0;
      const temporaryPassword=()=>"Ih!"+hex(crypto.getRandomValues(new Uint8Array(10)));
      for(const studentId of requested){
        const st=await env.DB.prepare("SELECT id,display_name,group_id,user_id FROM students WHERE id=? AND active=1").bind(studentId).first();
        if(!st||!st.group_id){skipped.push({student_id:studentId,reason:"not_eligible"});continue}
        const g=await groupRow(env,st.group_id);if(!g||g.active!==1){skipped.push({student_id:studentId,reason:"inactive_group"});continue}
        if(st.user_id){
          if(b.reset_existing!==true){skipped.push({student_id:studentId,reason:"already_linked"});continue}
          const existing=await env.DB.prepare("SELECT id,display_name,identity_normalized,role,active FROM users WHERE id=?").bind(st.user_id).first();
          if(!existing||existing.role!=="student"||existing.active!==1){skipped.push({student_id:studentId,reason:"invalid_linked_account"});continue}
          const password=temporaryPassword();
          const identity=await uniqueStudentIdentity(env,st.display_name,existing.id,st.id);
          await env.DB.prepare("UPDATE users SET display_name=?,identity_normalized=?,password_hash=?,must_change_password=1 WHERE id=?").bind(st.display_name,identity,await passwordHash(password),existing.id).run();
          credentials.push({student_id:st.id,name:st.display_name,group_id:st.group_id,username:identity,password,reset_existing:true});
          reset++;completedIds.add(st.id);
          await saveRecord(env,"platform_settings",{id:markerId,owner_user_id:user.id,completed:false,completed_student_ids:[...completedIds],target_student_ids:BULK_STUDENT_ONBOARDING_IDS,updated_at:nowIso()});
          continue;
        }
        const identity=await uniqueStudentIdentity(env,st.display_name,null,st.id);
        const password=temporaryPassword(),userId=uuid();
        try{
          await env.DB.prepare("INSERT INTO users(id,display_name,identity_normalized,password_hash,role,active,must_change_password) VALUES(?,?,?,?, 'student',1,1)").bind(userId,st.display_name,identity,await passwordHash(password)).run();
          await env.DB.prepare("UPDATE students SET user_id=? WHERE id=? AND user_id IS NULL").bind(userId,st.id).run();
          const linked=await env.DB.prepare("SELECT user_id FROM students WHERE id=?").bind(st.id).first();
          if(!linked||linked.user_id!==userId){await env.DB.prepare("DELETE FROM users WHERE id=?").bind(userId).run();skipped.push({student_id:studentId,reason:"already_linked"});continue}
          credentials.push({student_id:st.id,name:st.display_name,group_id:st.group_id,username:identity,password,reset_existing:false});
          created++;completedIds.add(st.id);
          await saveRecord(env,"platform_settings",{id:markerId,owner_user_id:user.id,completed:false,completed_student_ids:[...completedIds],target_student_ids:BULK_STUDENT_ONBOARDING_IDS,updated_at:nowIso()});
        }catch(error){
          await env.DB.prepare("UPDATE students SET user_id=NULL WHERE id=? AND user_id=?").bind(st.id,userId).run().catch(()=>{});
          await env.DB.prepare("DELETE FROM users WHERE id=?").bind(userId).run().catch(()=>{});
          skipped.push({student_id:studentId,reason:"creation_failed"});
          console.error("Ihsan bulk student onboarding failed",{student_id:studentId,message:String(error?.message||error)});
        }
      }
      const completed=BULK_STUDENT_ONBOARDING_IDS.every(id=>completedIds.has(id));
      await saveRecord(env,"platform_settings",{id:markerId,owner_user_id:user.id,completed,completed_student_ids:[...completedIds],target_student_ids:BULK_STUDENT_ONBOARDING_IDS,completed_at:completed?nowIso():null,updated_at:nowIso()});
      await log(env,user.id,"student_bulk_onboarding",{created,reset_existing:reset,skipped:skipped.length,completed});
      return json({ok:true,created,reset,skipped:skipped.length,completed,completed_count:completedIds.size,total:BULK_STUDENT_ONBOARDING_IDS.length,credentials,skipped_rows:skipped.map(x=>({student_id:x.student_id,reason:x.reason}))},201);
    }
    const studentMatch=path.match(/^\/api\/students\/([^/]+)$/);
    if(studentMatch&&method==="PATCH"){
      if(!["admin","teacher","director","supervisor"].includes(user.role))return fail(403,"غير مسموح");
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
        if(password)await env.DB.prepare("UPDATE users SET display_name=?,identity_normalized=?,password_hash=?,must_change_password=1 WHERE id=?").bind(name,identity,await passwordHash(password),s.user_id).run();
        else await env.DB.prepare("UPDATE users SET display_name=?,identity_normalized=? WHERE id=?").bind(name,identity,s.user_id).run();
      }else if(s.user_id&&b.name!==undefined){
        await env.DB.prepare("UPDATE users SET display_name=? WHERE id=?").bind(name,s.user_id).run();
      }
      await log(env,user.id,"student_update",{student_id:s.id,name,old_group_id:s.group_id,new_group_id:nextGroup});
      return json({ok:true,name,group_id:nextGroup});
    }
    if(studentMatch&&method==="DELETE"){
      if(!["admin","teacher","director","supervisor"].includes(user.role))return fail(403,"غير مسموح");const s=await env.DB.prepare("SELECT id,user_id,group_id FROM students WHERE id=? AND active=1").bind(studentMatch[1]).first();if(!s)return fail(404,"الطالب غير موجود");if(!await canManageGroup(env,user,s.group_id))return fail(403,"لا تملك صلاحية هذا الطالب");
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
      if(!["admin","teacher","director","supervisor"].includes(user.role))return fail(403,"تسجيل الحضور للمعلم أو المدير");const parsed=await parseBody(request);if(parsed.error)return parsed.error;const b=parsed.value,groupId=clean(b.group_id,80),date=clean(b.date,10),items=Array.isArray(b.items)?b.items:[];
      if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!items.length||items.length>200||!await canManageGroup(env,user,groupId))return fail(400,"بيانات الحضور غير صحيحة");
      const active=await env.DB.prepare("SELECT id FROM students WHERE group_id=? AND active=1").bind(groupId).all(),allowed=new Set((active.results||[]).map(x=>x.id)),stmts=[];
      for(const item of items){if(!allowed.has(String(item.student_id))||!["present","absent","late","excused"].includes(item.status))return fail(400,"يوجد طالب أو حالة غير صحيحة");const row={id:date+":"+item.student_id,student_id:item.student_id,group_id:groupId,date,status:item.status,note:clean(item.note,300),marked_by:user.id,updated_at:nowIso()};stmts.push(env.DB.prepare("INSERT INTO academy_records(collection,id,owner_user_id,group_id,student_id,payload_json,updated_at) VALUES('attendance',?,?,?,?,?,?) ON CONFLICT(collection,id) DO UPDATE SET owner_user_id=excluded.owner_user_id,group_id=excluded.group_id,student_id=excluded.student_id,payload_json=excluded.payload_json,updated_at=excluded.updated_at").bind(row.id,user.id,groupId,item.student_id,JSON.stringify(row),row.updated_at));}
      if(stmts.length)await env.DB.batch(stmts);await log(env,user.id,"attendance_save",{group_id:groupId,date,count:items.length});return json({ok:true,saved:items.length});
    }
    if(path==="/api/quran/progress"&&method==="GET"){
      if(user.role==="student"){const rows=await records(env,"quran_progress"," AND student_id=?",[user.student_id||""]);return json(rows);}
      if(!["admin","teacher","director","supervisor"].includes(user.role))return fail(403,"غير مسموح");const studentId=clean(url.searchParams.get("student_id"),80);if(!studentId)return fail(400,"حدد الطالب");
      const s=await env.DB.prepare("SELECT group_id FROM students WHERE id=? AND active=1").bind(studentId).first();if(!s||!await canManageGroup(env,user,s.group_id))return fail(403,"لا تملك صلاحية هذا الطالب");
      return json(await records(env,"quran_progress"," AND student_id=?",[studentId]));
    }
    if(path==="/api/quran/progress"&&method==="POST"){
      if(!["admin","teacher","director","supervisor"].includes(user.role))return fail(403,"تسجيل التقدم للمعلم أو المدير");
      const parsed=await parseBody(request);if(parsed.error)return parsed.error;const b=parsed.value;
      const studentId=clean(b.student_id,80),date=clean(b.date,10)||nowIso().slice(0,10);
      const memorized=clean(b.memorized,300),reviewed=clean(b.reviewed,300),recitation=clean(b.recitation,500);
      const notes=clean(b.notes,500),feedback=clean(b.feedback,800),nextAssignment=clean(b.next_assignment,300);
      const activity=clean(b.activity,24)||"recitation",allowedActivities=["memorization","revision","recitation","correction"];
      const errors=Number(b.errors??0),grade=b.grade===""||b.grade==null?null:Number(b.grade);
      const corrected=b.corrected===true||b.corrected==="true";
      if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return fail(400,"صيغة التاريخ غير صحيحة");
      const st=await env.DB.prepare("SELECT group_id FROM students WHERE id=? AND active=1").bind(studentId).first();
      if(!st||!await canManageGroup(env,user,st.group_id))return fail(403,"لا تملك صلاحية هذا الطالب");
      if(!allowedActivities.includes(activity))return fail(400,"اختر نوع متابعة صحيحًا");
      if(!memorized&&!reviewed&&!recitation&&!notes&&!feedback&&!nextAssignment)return fail(400,"أدخل الحفظ أو المراجعة أو التسميع أو ملاحظة");
      if(!Number.isInteger(errors)||errors<0||errors>200)return fail(400,"عدد الأخطاء يجب أن يكون بين 0 و200");
      if(grade!==null&&(!Number.isFinite(grade)||grade<0||grade>10))return fail(400,"التقدير يجب أن يكون بين 0 و10");
      const row={id:uuid(),student_id:studentId,group_id:st.group_id,date,activity,memorized,reviewed,recitation,errors,grade,corrected,feedback,next_assignment:nextAssignment,notes,teacher_id:user.id,created_at:nowIso(),updated_at:nowIso()};
      await saveRecord(env,"quran_progress",row);
      await log(env,user.id,"quran_progress_add",{student_id:studentId,activity,errors,grade});
      return json(row,201);
    }
    const quranProgressMatch=path.match(/^\/api\/quran\/progress\/([^/]+)$/);
    if(quranProgressMatch&&method==="PATCH"){
      if(!["admin","teacher","director","supervisor"].includes(user.role))return fail(403,"تعديل متابعة القرآن للمعلم أو المدير");
      const raw=await env.DB.prepare("SELECT payload_json FROM academy_records WHERE collection='quran_progress' AND id=?").bind(quranProgressMatch[1]).first();
      if(!raw)return fail(404,"سجل المتابعة غير موجود");
      let old;try{old=JSON.parse(raw.payload_json)}catch{return fail(500,"تعذّرت قراءة سجل المتابعة")}
      const st=await env.DB.prepare("SELECT group_id FROM students WHERE id=? AND active=1").bind(old.student_id).first();
      if(!st||!await canManageGroup(env,user,st.group_id))return fail(403,"لا تملك صلاحية تعديل هذا السجل");
      const parsed=await parseBody(request);if(parsed.error)return parsed.error;const b=parsed.value;
      const row={...old,date:b.date===undefined?old.date:clean(b.date,10),activity:b.activity===undefined?old.activity:clean(b.activity,24),memorized:b.memorized===undefined?old.memorized:clean(b.memorized,300),reviewed:b.reviewed===undefined?old.reviewed:clean(b.reviewed,300),recitation:b.recitation===undefined?old.recitation:clean(b.recitation,500),errors:b.errors===undefined?old.errors:Number(b.errors),grade:b.grade===undefined?old.grade:(b.grade===""||b.grade==null?null:Number(b.grade)),corrected:b.corrected===undefined?old.corrected:(b.corrected===true||b.corrected==="true"),feedback:b.feedback===undefined?old.feedback:clean(b.feedback,800),next_assignment:b.next_assignment===undefined?old.next_assignment:clean(b.next_assignment,300),notes:b.notes===undefined?old.notes:clean(b.notes,500),updated_at:nowIso()};
      if(!/^\d{4}-\d{2}-\d{2}$/.test(String(row.date||""))||!["memorization","revision","recitation","correction"].includes(row.activity)||!Number.isInteger(Number(row.errors))||Number(row.errors)<0||Number(row.errors)>200||(row.grade!==null&&(!Number.isFinite(Number(row.grade))||Number(row.grade)<0||Number(row.grade)>10)))return fail(400,"تحقق من التاريخ والنوع وعدد الأخطاء والتقدير");
      await saveRecord(env,"quran_progress",row);await log(env,user.id,"quran_progress_update",{student_id:row.student_id,record_id:row.id});
      return json({ok:true,record:row});
    }
    if(quranProgressMatch&&method==="DELETE"){
      if(user.role!=="admin")return fail(403,"حذف سجل القرآن للمدير فقط");
      const raw=await env.DB.prepare("SELECT payload_json FROM academy_records WHERE collection='quran_progress' AND id=?").bind(quranProgressMatch[1]).first();
      if(!raw)return fail(404,"سجل المتابعة غير موجود");
      let row;try{row=JSON.parse(raw.payload_json)}catch{return fail(500,"تعذّرت قراءة سجل المتابعة")}
      const st=await env.DB.prepare("SELECT group_id FROM students WHERE id=? AND active=1").bind(row.student_id).first();
      if(!st||!await canManageGroup(env,user,st.group_id))return fail(403,"لا تملك صلاحية هذا السجل");
      await env.DB.prepare("DELETE FROM academy_records WHERE collection='quran_progress' AND id=?").bind(row.id).run();
      await log(env,user.id,"quran_progress_delete",{student_id:row.student_id,record_id:row.id});
      return json({ok:true});
    }
    if(path==="/api/tests"&&method==="GET"){
      // Recurring assessments roll forward in fixed 14-day intervals when the test area is next opened.
      // Deterministic IDs prevent duplicate instances if multiple requests arrive together.
      const today=nowIso().slice(0,10),storedTests=await records(env,"tests"),latestBySeries=new Map();
      for(const item of storedTests){if(!item.recurring||!item.series_id)continue;const prior=latestBySeries.get(item.series_id);if(!prior||Number(item.sequence||1)>Number(prior.sequence||1))latestBySeries.set(item.series_id,item);}
      for(const latest of latestBySeries.values()){
        if(user.role==="student"&&latest.group_id&&latest.group_id!==user.group_id)continue;
        if(user.role==="teacher"&&(!latest.group_id||!await canManageGroup(env,user,latest.group_id)))continue;
        if(!latest.due_date||latest.due_date>today)continue;
        const interval=Math.max(1,Number(latest.frequency_days)||14),elapsed=Math.floor((Date.parse(today+"T00:00:00Z")-Date.parse(latest.due_date+"T00:00:00Z"))/(interval*86400000))+1;
        const sequence=Number(latest.sequence||1)+elapsed,id=String(latest.series_id)+":"+sequence;
        if(storedTests.some(item=>item.id===id))continue;
        const nextDue=new Date(Date.parse(latest.due_date+"T00:00:00Z")+elapsed*interval*86400000).toISOString().slice(0,10);
        await saveRecord(env,"tests",{...latest,id,sequence,due_date:nextDue,previous_test_id:latest.id,created_at:nowIso()});
      }
      let all=await scopedRecords(env,user,"tests",user.role==="student");
      if(user.role==="student"){
        const latestSequence=new Map();
        for(const item of all){if(!item.recurring||!item.series_id)continue;latestSequence.set(item.series_id,Math.max(latestSequence.get(item.series_id)||0,Number(item.sequence||1)));}
        all=all.filter(item=>!item.recurring||!item.series_id||Number(item.sequence||1)===latestSequence.get(item.series_id));
      }
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
      if(!["admin","teacher","director","supervisor"].includes(user.role))return fail(403,"إنشاء الاختبارات للمعلم أو المدير");
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
      const defaultDue=new Date(Date.now()+14*24*60*60*1000).toISOString().slice(0,10);
      const recurring=b.recurring!==false,seriesId=recurring?uuid():null;
      const test={id:uuid(),title,description,group_id:groupId,due_date:/^\d{4}-\d{2}-\d{2}$/.test(due)?due:defaultDue,frequency_days:14,recurring,series_id:seriesId,sequence:1,questions:normalized,status:"published",created_by:user.id,created_at:nowIso()};
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
        if(!["admin","teacher","director","supervisor"].includes(user.role))return fail(403,"عرض نتائج الطالب للمعلم أو المدير");
        const student=await env.DB.prepare("SELECT id,group_id FROM students WHERE id=? AND active=1").bind(studentId).first();
        if(!student||!await canManageGroup(env,user,student.group_id))return fail(403,"لا تملك صلاحية هذا الطالب");
      }
      const attempts=await records(env,"test_attempts");
      return json(attempts.filter(a=>a.student_id===studentId).sort((a,b)=>String(b.submitted_at).localeCompare(String(a.submitted_at))).slice(0,100).map(a=>({id:a.id,test_id:a.test_id,title:a.title,score:a.score,total:a.total,submitted_at:a.submitted_at})));
    }
    if(path==="/api/test-results"&&method==="GET"){
      if(!["admin","teacher","director","supervisor"].includes(user.role))return fail(403,"عرض النتائج للمعلم أو المدير");
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
      if(!["admin","teacher","director","supervisor"].includes(user.role))return fail(403,"حذف الاختبارات للمعلم أو المدير");
      const parsed=await parseBody(request);if(parsed.error)return parsed.error;
      const testId=clean(parsed.value.id,80);
      const raw=await env.DB.prepare("SELECT payload_json FROM academy_records WHERE collection='tests' AND id=?").bind(testId).first();
      if(!raw)return fail(404,"الاختبار غير موجود");
      let test;try{test=JSON.parse(raw.payload_json)}catch{return fail(500,"تعذّر قراءة الاختبار")}
      if(test.group_id&&!await canManageGroup(env,user,test.group_id))return fail(403,"لا تملك صلاحية هذا الاختبار");
      if(!test.group_id&&user.role!=="admin")return fail(403,"لا تملك صلاحية هذا الاختبار");
      if(test.recurring&&test.series_id){
        await env.DB.prepare("DELETE FROM academy_records WHERE collection='tests' AND id=?").bind(test.id).run();
        const series=await records(env,"tests");
        for(const item of series.filter(x=>x.series_id===test.series_id))await env.DB.prepare("DELETE FROM academy_records WHERE collection='tests' AND id=?").bind(item.id).run();
        await log(env,user.id,"test_series_delete",{test_id:test.id,series_id:test.series_id});
      }else{
        await env.DB.prepare("DELETE FROM academy_records WHERE collection='tests' AND id=?").bind(test.id).run();
        await log(env,user.id,"test_delete",{test_id:test.id});
      }
      return json({ok:true});
    }
    if(path==="/api/gradebook"&&method==="GET"){
      let groupId=clean(url.searchParams.get("group_id"),80);
      let studentRows=[],attendanceRows=[],quranRows=[],testAttempts=[],submissions=[];
      if(user.role==="student"){
        if(!user.student_id||!user.group_id)return fail(403,"ملف الدرجات متاح لحساب الطالب المرتبط بفوج");
        const me=await env.DB.prepare("SELECT id,display_name,group_id FROM students WHERE id=? AND user_id=? AND active=1").bind(user.student_id,user.id).first();
        if(!me)return fail(403,"لم يتم ربط حسابك بملف طالب فعال");
        groupId=me.group_id;studentRows=[me];
        [attendanceRows,quranRows,testAttempts,submissions]=await Promise.all([
          records(env,"attendance"," AND student_id=?",[me.id]),
          records(env,"quran_progress"," AND student_id=?",[me.id]),
          records(env,"test_attempts"," AND student_id=?",[me.id]),
          records(env,"assignment_submissions"," AND student_id=?",[me.id])
        ]);
      }else{
        if(!["admin","teacher","director","supervisor"].includes(user.role))return fail(403,"السجل التعليمي غير متاح لهذا الدور");
        if(!groupId)return fail(400,"اختر الفوج لعرض سجله التعليمي");
        if(!await canManageGroup(env,user,groupId))return fail(403,"هذا الفوج خارج صلاحيتك");
        const group=await groupRow(env,groupId);
        if(!group||group.active!==1)return fail(404,"الفوج غير موجود أو غير نشط");
        const found=await env.DB.prepare("SELECT id,display_name,group_id FROM students WHERE group_id=? AND active=1 ORDER BY display_name").bind(groupId).all();
        studentRows=found.results||[];
        [attendanceRows,quranRows,testAttempts,submissions]=await Promise.all([
          records(env,"attendance"," AND group_id=?",[groupId]),
          records(env,"quran_progress"," AND group_id=?",[groupId]),
          records(env,"test_attempts"," AND group_id=?",[groupId]),
          records(env,"assignment_submissions"," AND group_id=?",[groupId])
        ]);
      }
      const [assignments,tests]=await Promise.all([records(env,"assignments"),records(env,"tests")]);
      const visibleAssignments=assignments.filter(item=>item.status==="published"&&(!item.group_id||item.group_id===groupId));
      const visibleTests=tests.filter(item=>item.status==="published"&&(!item.group_id||item.group_id===groupId));
      const students=studentRows.map(student=>{
        const att=attendanceRows.filter(item=>item.student_id===student.id);
        const present=att.filter(item=>item.status==="present").length;
        const absent=att.filter(item=>item.status==="absent").length;
        const late=att.filter(item=>item.status==="late").length;
        const excused=att.filter(item=>item.status==="excused").length;
        const quran=quranRows.filter(item=>item.student_id===student.id);
        const quranGrades=quran.filter(item=>item.grade!==null&&item.grade!==undefined&&item.grade!==""&&Number.isFinite(Number(item.grade))).map(item=>Number(item.grade));
        const attempts=testAttempts.filter(item=>item.student_id===student.id);
        const correct=attempts.reduce((sum,item)=>sum+Math.max(0,Number(item.score)||0),0);
        const total=attempts.reduce((sum,item)=>sum+Math.max(0,Number(item.total)||0),0);
        const ownSubmissions=submissions.filter(item=>item.student_id===student.id);
        const reviewed=ownSubmissions.filter(item=>item.status==="reviewed"&&item.grade!==null&&item.grade!==undefined&&item.grade!=="");
        const pending=ownSubmissions.filter(item=>item.status!=="reviewed");
        const assignmentPercents=reviewed.map(item=>{
          const assignment=assignments.find(value=>value.id===item.assignment_id);
          const maximum=Math.max(1,Number(assignment?.points_total)||100);
          return Math.max(0,Math.min(100,Number(item.grade)/maximum*100));
        });
        const submittedIds=new Set(ownSubmissions.map(item=>item.assignment_id));
        return {
          student_id:student.id,name:student.display_name,
          attendance:{sessions:att.length,present,absent,late,excused,rate:(present+absent+late)?Math.round((present+late)/(present+absent+late)*100):null},
          quran:{sessions:quran.length,memorization:quran.filter(item=>item.activity==="memorization"||!!item.memorized).length,revision:quran.filter(item=>item.activity==="revision"||!!item.reviewed).length,average_grade:quranGrades.length?Math.round(quranGrades.reduce((sum,value)=>sum+value,0)/quranGrades.length*10)/10:null},
          tests:{available:visibleTests.length,attempts:attempts.length,correct,total,percent:total?Math.round(correct/total*1000)/10:null},
          assignments:{available:visibleAssignments.length,submitted:submittedIds.size,reviewed:reviewed.length,pending:pending.length,average_percent:assignmentPercents.length?Math.round(assignmentPercents.reduce((sum,value)=>sum+value,0)/assignmentPercents.length*10)/10:null}
        };
      });
      return json({group_id:groupId,students,updated_at:nowIso()});
    }
    if(path==="/api/assignments"&&method==="GET"){
      const rows=await scopedRecords(env,user,"assignments",user.role==="student");
      if(user.role!=="student")return json(rows);
      const submitted=await records(env,"assignment_submissions"," AND student_id=?",[user.student_id||""]);
      const byAssignment=new Map(submitted.map(item=>[item.assignment_id,item]));
      return json(rows.map(item=>({...item,my_submission:byAssignment.get(item.id)||null})));
    }
    if(path==="/api/assignments"&&method==="POST"){
      if(!["admin","teacher","director","supervisor"].includes(user.role))return fail(403,"إنشاء الواجبات للمعلم والإدارة فقط");
      const parsed=await parseBody(request);if(parsed.error)return parsed.error;const b=parsed.value;
      const title=clean(b.title,180),description=clean(b.description,5000),groupId=clean(b.group_id,80)||null,dueDate=clean(b.due_date,10);
      const pointsTotal=Number(b.points_total??100);
      if(!title||!description)return fail(400,"أدخل عنوان الواجب وتعليماته");
      if(!groupId&&user.role!=="admin")return fail(403,"يمكن للمدير العام وحده إنشاء واجب عام");
      if(groupId&&!await canManageGroup(env,user,groupId))return fail(403,"لا تملك صلاحية هذا الفوج");
      if(dueDate&&!validDateOnly(dueDate))return fail(400,"صيغة موعد التسليم غير صحيحة");
      if(!Number.isFinite(pointsTotal)||pointsTotal<1||pointsTotal>1000)return fail(400,"الدرجة الكلية يجب أن تكون من 1 إلى 1000");
      const assignment={id:uuid(),title,description,group_id:groupId,due_date:dueDate||null,points_total:pointsTotal,status:"published",created_by:user.id,created_at:nowIso()};
      await saveRecord(env,"assignments",assignment);await log(env,user.id,"assignment_create",{assignment_id:assignment.id,group_id:groupId});
      return json(assignment,201);
    }
    const assignmentMatch=path.match(/^\/api\/assignments\/([^/]+)$/);
    if(assignmentMatch&&method==="PATCH"){
      if(!["admin","teacher","director","supervisor"].includes(user.role))return fail(403,"تعديل الواجبات للمعلم والإدارة فقط");
      const assignmentId=clean(assignmentMatch[1],80);
      const raw=await env.DB.prepare("SELECT payload_json FROM academy_records WHERE collection='assignments' AND id=?").bind(assignmentId).first();
      if(!raw)return fail(404,"الواجب غير موجود");
      let old;try{old=JSON.parse(raw.payload_json)}catch{return fail(500,"تعذّرت قراءة الواجب")};
      if(old.group_id){if(!await canManageGroup(env,user,old.group_id))return fail(403,"لا تملك صلاحية هذا الواجب");}
      else if(user.role!=="admin")return fail(403,"الواجب العام متاح للمدير العام وحده");
      const parsed=await parseBody(request);if(parsed.error)return parsed.error;const b=parsed.value;
      const title=b.title===undefined?old.title:clean(b.title,180);
      const description=b.description===undefined?old.description:clean(b.description,5000);
      const dueDate=b.due_date===undefined?(old.due_date||""):clean(b.due_date,10);
      const pointsTotal=b.points_total===undefined?Number(old.points_total||100):Number(b.points_total);
      if(!title||!description)return fail(400,"العنوان والتعليمات مطلوبان");
      if(dueDate&&!validDateOnly(dueDate))return fail(400,"موعد التسليم غير صحيح");
      if(!Number.isFinite(pointsTotal)||pointsTotal<1||pointsTotal>1000)return fail(400,"الدرجة الكلية يجب أن تكون من 1 إلى 1000");
      if(pointsTotal!==Number(old.points_total||100)){
        const count=await env.DB.prepare("SELECT COUNT(*) AS n FROM academy_records WHERE collection='assignment_submissions' AND json_extract(payload_json,'$.assignment_id')=?").bind(assignmentId).first();
        if((count?.n||0)>0)return fail(409,"لا يمكن تغيير الدرجة الكلية بعد وجود تسليمات؛ حتى لا تتغير دلالة الدرجات السابقة");
      }
      const updated={...old,title,description,due_date:dueDate||null,points_total:pointsTotal,updated_by:user.id,updated_at:nowIso()};
      await saveRecord(env,"assignments",updated);await log(env,user.id,"assignment_update",{assignment_id:assignmentId});
      return json({ok:true,assignment:updated});
    }
    if(assignmentMatch&&method==="DELETE"){
      if(!["admin","teacher","director","supervisor"].includes(user.role))return fail(403,"حذف الواجبات للمعلم والإدارة فقط");
      const assignmentId=clean(assignmentMatch[1],80);
      const raw=await env.DB.prepare("SELECT payload_json FROM academy_records WHERE collection='assignments' AND id=?").bind(assignmentId).first();
      if(!raw)return fail(404,"الواجب غير موجود");
      let assignment;try{assignment=JSON.parse(raw.payload_json)}catch{return fail(500,"تعذّرت قراءة الواجب")};
      if(assignment.group_id){if(!await canManageGroup(env,user,assignment.group_id))return fail(403,"لا تملك صلاحية هذا الواجب");}
      else if(user.role!=="admin")return fail(403,"الواجب العام متاح للمدير العام وحده");
      const count=await env.DB.prepare("SELECT COUNT(*) AS n FROM academy_records WHERE collection='assignment_submissions' AND json_extract(payload_json,'$.assignment_id')=?").bind(assignmentId).first();
      if((count?.n||0)>0)return fail(409,"لا يمكن حذف واجب له تسليمات محفوظة؛ عدّله أو اترك سجله لحفظ أعمال الطلاب");
      await env.DB.prepare("DELETE FROM academy_records WHERE collection='assignments' AND id=?").bind(assignmentId).run();
      await log(env,user.id,"assignment_delete",{assignment_id:assignmentId});
      return json({ok:true});
    }
    if(path==="/api/assignment-submit"&&method==="POST"){
      if(user.role!=="student"||!user.student_id||!user.group_id)return fail(403,"تسليم الواجب متاح لحساب الطالب المرتبط بفوج");
      const assignmentId=clean(url.searchParams.get("id"),80);
      const raw=await env.DB.prepare("SELECT payload_json FROM academy_records WHERE collection='assignments' AND id=?").bind(assignmentId).first();
      if(!raw)return fail(404,"الواجب غير موجود");
      let assignment;try{assignment=JSON.parse(raw.payload_json)}catch{return fail(500,"تعذّرت قراءة الواجب")};
      if(assignment.status!=="published"||(assignment.group_id&&assignment.group_id!==user.group_id))return fail(403,"هذا الواجب غير متاح لفوجك");
      const parsed=await parseBody(request,12000);if(parsed.error)return parsed.error;
      const responseText=clean(parsed.value.response_text,8000);
      if(!responseText)return fail(400,"اكتب إجابتك أو ما أنجزته قبل التسليم");
      const submissionId=assignmentId+":"+user.student_id;
      const old=await env.DB.prepare("SELECT payload_json FROM academy_records WHERE collection='assignment_submissions' AND id=?").bind(submissionId).first();
      let previous=null;try{previous=old?JSON.parse(old.payload_json):null}catch{}
      if(previous?.status==="reviewed")return fail(409,"تمت مراجعة هذا الواجب بالفعل. تواصل مع معلمك إذا احتجت إلى إعادة فتحه للتعديل.");
      const submission={id:submissionId,assignment_id:assignmentId,student_id:user.student_id,group_id:user.group_id,response_text:responseText,status:"submitted",submitted_at:nowIso(),created_at:previous?.created_at||nowIso(),revision_number:Number(previous?.revision_number||0)+1,grade:null,feedback:"",reviewed_by:null,reviewed_at:null};
      await saveRecord(env,"assignment_submissions",submission);await log(env,user.id,"assignment_submit",{assignment_id:assignmentId});
      return json({ok:true,submission},201);
    }
    if(path==="/api/assignment-submissions"&&method==="GET"){
      if(!["admin","teacher","director","supervisor"].includes(user.role))return fail(403,"عرض تسليمات الواجب للمعلم والإدارة فقط");
      const assignmentId=clean(url.searchParams.get("id"),80);
      const raw=await env.DB.prepare("SELECT payload_json FROM academy_records WHERE collection='assignments' AND id=?").bind(assignmentId).first();
      if(!raw)return fail(404,"الواجب غير موجود");
      let assignment;try{assignment=JSON.parse(raw.payload_json)}catch{return fail(500,"تعذّرت قراءة الواجب")};
      if(assignment.group_id){if(!await canManageGroup(env,user,assignment.group_id))return fail(403,"لا تملك صلاحية هذا الواجب");}
      else if(user.role!=="admin")return fail(403,"الواجب العام متاح للمدير العام وحده");
      let result;
      if(assignment.group_id)result=await env.DB.prepare("SELECT payload_json FROM academy_records WHERE collection='assignment_submissions' AND group_id=? ORDER BY updated_at DESC LIMIT 500").bind(assignment.group_id).all();
      else result=await env.DB.prepare("SELECT payload_json FROM academy_records WHERE collection='assignment_submissions' ORDER BY updated_at DESC LIMIT 500").all();
      const submissions=(result.results||[]).flatMap(row=>{try{return [JSON.parse(row.payload_json)]}catch{return []}}).filter(row=>row.assignment_id===assignmentId);
      const students=assignment.group_id
        ? await env.DB.prepare("SELECT id,display_name FROM students WHERE group_id=? AND active=1").bind(assignment.group_id).all()
        : await env.DB.prepare("SELECT id,display_name FROM students WHERE active=1").all();
      const names=new Map((students.results||[]).map(row=>[row.id,row.display_name]));
      return json(submissions.map(row=>({...row,student_name:names.get(row.student_id)||"طالب غير نشط"})));
    }
    if(path==="/api/assignment-review"&&method==="POST"){
      if(!["admin","teacher","director","supervisor"].includes(user.role))return fail(403,"مراجعة الواجبات للمعلم والإدارة فقط");
      const parsed=await parseBody(request);if(parsed.error)return parsed.error;const b=parsed.value;
      const assignmentId=clean(b.assignment_id,80),studentId=clean(b.student_id,80);
      const raw=await env.DB.prepare("SELECT payload_json FROM academy_records WHERE collection='assignments' AND id=?").bind(assignmentId).first();
      if(!raw)return fail(404,"الواجب غير موجود");
      let assignment;try{assignment=JSON.parse(raw.payload_json)}catch{return fail(500,"تعذّرت قراءة الواجب")};
      if(assignment.group_id){if(!await canManageGroup(env,user,assignment.group_id))return fail(403,"لا تملك صلاحية هذا الواجب");}
      else if(user.role!=="admin")return fail(403,"الواجب العام متاح للمدير العام وحده");
      const submissionId=assignmentId+":"+studentId;
      const row=await env.DB.prepare("SELECT payload_json,group_id FROM academy_records WHERE collection='assignment_submissions' AND id=?").bind(submissionId).first();
      if(!row)return fail(404,"لا يوجد تسليم لهذا الطالب");
      let submission;try{submission=JSON.parse(row.payload_json)}catch{return fail(500,"تعذّرت قراءة التسليم")};
      if(submission.assignment_id!==assignmentId||(assignment.group_id&&submission.group_id!==assignment.group_id))return fail(403,"هذا التسليم لا يتبع هذا الواجب");
      if(b.reopen===true){
        if(submission.status!=="reviewed")return fail(409,"لا يمكن إعادة فتح تسليم لم تتم مراجعته بعد");
        const history=Array.isArray(submission.review_history)?submission.review_history:[];
        history.push({grade:submission.grade??null,feedback:submission.feedback||"",reviewed_by:submission.reviewed_by||null,reviewed_at:submission.reviewed_at||null,reopened_by:user.id,reopened_at:nowIso()});
        submission.review_history=history.slice(-10);
        submission.grade=null;submission.feedback="";submission.status="submitted";submission.reviewed_by=null;submission.reviewed_at=null;submission.reopened_by=user.id;submission.reopened_at=nowIso();submission.updated_at=nowIso();
        await saveRecord(env,"assignment_submissions",submission);
        await log(env,user.id,"assignment_reopen",{assignment_id:assignmentId,student_id:studentId});
        return json({ok:true,submission});
      }
      const grade=b.grade===""||b.grade===null||b.grade===undefined?null:Number(b.grade);
      if(grade!==null&&(!Number.isFinite(grade)||grade<0||grade>Number(assignment.points_total||100)))return fail(400,"الدرجة خارج النطاق المسموح");
      submission.grade=grade;submission.feedback=clean(b.feedback,2000);submission.status="reviewed";submission.reviewed_by=user.id;submission.reviewed_at=nowIso();submission.updated_at=nowIso();
      await saveRecord(env,"assignment_submissions",submission);await log(env,user.id,"assignment_review",{assignment_id:assignmentId,student_id:studentId,grade});
      return json({ok:true,submission});
    }
    if(path==="/api/messages/recipients"&&method==="GET"){
      return json(await messageRecipientRows(env,user));
    }
    if(path==="/api/messages"&&method==="GET"){
      const all=await records(env,"messages"," AND (owner_user_id=? OR json_extract(payload_json,'$.sender_user_id')=?)",[user.id,user.id]);
      const visible=all.filter(item=>item.sender_user_id===user.id||item.recipient_user_id===user.id);
      const ids=[...new Set(visible.flatMap(item=>[item.sender_user_id,item.recipient_user_id]).filter(Boolean))];
      const names=new Map();
      if(ids.length){const marks=ids.map(()=>"?").join(",");const found=await env.DB.prepare("SELECT id,display_name FROM users WHERE id IN ("+marks+")").bind(...ids).all();for(const row of found.results||[])names.set(row.id,row.display_name);}
      return json(visible.sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))).map(item=>({...item,sender_name:names.get(item.sender_user_id)||"حساب غير نشط",recipient_name:names.get(item.recipient_user_id)||"حساب غير نشط",outgoing:item.sender_user_id===user.id})));
    }
    if(path==="/api/messages"&&method==="POST"){
      const parsed=await parseBody(request,12000);if(parsed.error)return parsed.error;const b=parsed.value;
      const recipientId=clean(b.recipient_user_id,80),title=clean(b.title,160),content=clean(b.content,8000);
      if(!recipientId||!title||!content)return fail(400,"اختر المستلم وأدخل عنوان الرسالة ومحتواها");
      const recipient=(await messageRecipientRows(env,user)).find(item=>item.id===recipientId);
      if(!recipient)return fail(403,"لا تملك صلاحية مراسلة هذا الحساب");
      const message={id:uuid(),sender_user_id:user.id,recipient_user_id:recipientId,title,content,created_at:nowIso(),read_at:null};
      await saveRecord(env,"messages",{...message,owner_user_id:recipientId});
      await log(env,user.id,"message_send",{message_id:message.id,recipient_user_id:recipientId});
      return json({ok:true,id:message.id,created_at:message.created_at},201);
    }
    if(path==="/api/messages/read"&&method==="POST"){
      const parsed=await parseBody(request);if(parsed.error)return parsed.error;
      const id=clean(parsed.value.id,80);
      const raw=await env.DB.prepare("SELECT payload_json FROM academy_records WHERE collection='messages' AND id=?").bind(id).first();
      if(!raw)return fail(404,"الرسالة غير موجودة");
      let message;try{message=JSON.parse(raw.payload_json)}catch{return fail(500,"تعذّرت قراءة الرسالة")};
      if(message.recipient_user_id!==user.id)return fail(403,"لا تملك صلاحية تحديث حالة هذه الرسالة");
      if(!message.read_at){message.read_at=nowIso();await saveRecord(env,"messages",{...message,owner_user_id:user.id});}
      return json({ok:true,read_at:message.read_at});
    }
    if(path==="/api/posts"&&method==="GET")return json(await scopedRecords(env,user,"posts",user.role==="student"));
    if(path==="/api/posts"&&method==="POST"){
      if(!["admin","teacher","director","supervisor"].includes(user.role))return fail(403,"النشر للمعلم أو المدير");
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
      if(!["admin","teacher","director","supervisor"].includes(user.role))return fail(403,"إنشاء التنبيهات للمعلم أو المدير");
      const parsed=await parseBody(request);if(parsed.error)return parsed.error;const b=parsed.value;
      const title=clean(b.title,160),content=clean(b.content,2000),groupId=clean(b.group_id,80)||null;
      if(!title||!content)return fail(400,"أدخل عنوان التنبيه ومحتواه");
      if(!groupId&&user.role!=="admin")return fail(403,"يمكن للمدير وحده إرسال تنبيه عام");
      if(groupId&&!await canManageGroup(env,user,groupId))return fail(403,"لا تملك صلاحية هذا الفوج");
      const notice={id:uuid(),title,content,group_id:groupId,status:"published",created_by:user.id,created_at:nowIso()};
      await saveRecord(env,"notifications",notice);await log(env,user.id,"notification_create",{notification_id:notice.id,group_id:groupId});return json(notice,201);
    }
    if(path==="/api/curriculum/progress"&&method==="GET"){
      const result=await env.DB.prepare("SELECT payload_json FROM academy_records WHERE collection='curriculum_progress' AND owner_user_id=? ORDER BY updated_at DESC LIMIT 100").bind(user.id).all();
      return json((result.results||[]).flatMap(row=>{try{return [JSON.parse(row.payload_json)]}catch{return []}}));
    }
    if(path==="/api/curriculum/progress"&&method==="POST"){
      const parsed=await parseBody(request);if(parsed.error)return parsed.error;const b=parsed.value;
      const subjectId=clean(b.subject_id,80);
      const builtinIds=["allah","prophet","quran","sunnah","adab"];
      const customSubjects=await records(env,"subjects");
      if(!builtinIds.includes(subjectId)&&!customSubjects.some(subject=>subject.id===subjectId&&subject.status==="published"))return fail(400,"المحور التعليمي غير موجود");
      const allowedSteps=new Set(["understood","applied","reviewed"]);
      const steps=Array.isArray(b.steps)?[...new Set(b.steps.map(step=>clean(step,30)).filter(step=>allowedSteps.has(step)))]:[];
      const reflection=clean(b.reflection,1200);
      const record={id:user.id+":"+subjectId,owner_user_id:user.id,group_id:user.group_id||null,student_id:user.student_id||null,subject_id:subjectId,steps,completed:steps.length===3,reflection,updated_at:nowIso()};
      await saveRecord(env,"curriculum_progress",record);
      await log(env,user.id,"curriculum_progress_save",{subject_id:subjectId,completed:record.completed});
      return json(record);
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
    if(path==="/api/quran"&&method==="GET")return json({levels:[
      {id:"khatma",name:"الختمة الكاملة",duration_days:null,description:"مسار مرن لإتمام القرآن مع حفظ ما يناسب قدرة الطالب ومراجعته.",weekly_goal_default:"ورد أسبوعي ثابت من الحفظ والمراجعة"},
      {id:"45",name:"ختمة 45 يومًا",duration_days:45,description:"برنامج متوسط السرعة يجمع الإنجاز اليومي مع المراجعة.",weekly_goal_default:"قرابة جزء ونصف إلى جزأين يوميًا بحسب مستوى الطالب"},
      {id:"30",name:"ختمة 30 يومًا",duration_days:30,description:"برنامج مكثف يحتاج إلى وقت يومي كافٍ ومراجعة منتظمة.",weekly_goal_default:"قرابة جزء يوميًا مع مراجعة ما سبق"},
      {id:"15",name:"ختمة 15 يومًا",duration_days:15,description:"برنامج مكثف جدًا لا يناسب كل طالب؛ يحدّد المعلم المقدار بحسب الإتقان والقدرة.",weekly_goal_default:"ورد مكثف بإشراف المعلم مع مراجعة مناسبة"},
      {id:"starter",name:"المسار التمهيدي",duration_days:null,description:"للمبتدئ: تأسيس القراءة، وحفظ قصار السور، وتثبيت الورد قبل زيادة المقدار.",weekly_goal_default:"ورد قصير ثابت مع مراجعة يومية"}
    ],can_edit:user.role==="admin"||user.role==="teacher"});
    if(path==="/api/quran/plan"&&method==="GET"){
      let studentId=clean(url.searchParams.get("student_id"),80);
      if(user.role==="student"){
        if(!user.student_id)return fail(404,"حساب الطالب غير مرتبط بملف طالب");
        if(studentId&&studentId!==user.student_id)return fail(403,"لا يمكنك عرض خطة طالب آخر");
        studentId=user.student_id;
      }else{
        if(!["admin","teacher","director","supervisor"].includes(user.role))return fail(403,"غير مسموح");
        if(!studentId)return fail(400,"حدد الطالب");
        const st=await env.DB.prepare("SELECT group_id FROM students WHERE id=? AND active=1").bind(studentId).first();
        if(!st||!await canManageGroup(env,user,st.group_id))return fail(403,"لا تملك صلاحية هذا الطالب");
      }
      const row=await env.DB.prepare("SELECT payload_json FROM academy_records WHERE collection='quran_plan' AND student_id=? LIMIT 1").bind(studentId).first();
      if(!row)return json(null);
      try{return json(JSON.parse(row.payload_json))}catch{return fail(500,"تعذّرت قراءة خطة القرآن")}
    }
    if(path==="/api/quran/plan"&&method==="POST"){
      const parsed=await parseBody(request);if(parsed.error)return parsed.error;const b=parsed.value;
      let studentId=clean(b.student_id,80);
      if(user.role==="student"){
        if(!user.student_id)return fail(404,"حساب الطالب غير مرتبط بملف طالب");
        if(studentId&&studentId!==user.student_id)return fail(403,"لا يمكنك تغيير خطة طالب آخر");
        studentId=user.student_id;
      }else{
        if(!["admin","teacher","director","supervisor"].includes(user.role))return fail(403,"تعيين مسار القرآن للمعلم أو المدير");
        if(!studentId)return fail(400,"حدد الطالب");
      }
      const st=await env.DB.prepare("SELECT group_id FROM students WHERE id=? AND active=1").bind(studentId).first();
      if(!st||(user.role!=="student"&&!await canManageGroup(env,user,st.group_id)))return fail(403,"لا تملك صلاحية هذا الطالب");
      const pathId=clean(b.path_id,40),allowed=["khatma","45","30","15","starter"];
      if(!allowed.includes(pathId))return fail(400,"اختر مسارًا قرآنيًا صحيحًا");
      const weeklyGoal=clean(b.weekly_goal,250);
      if(!weeklyGoal)return fail(400,"اكتب هدفًا أسبوعيًا واضحًا");
      const existing=await env.DB.prepare("SELECT payload_json FROM academy_records WHERE collection='quran_plan' AND student_id=? LIMIT 1").bind(studentId).first();
      let previous={};try{if(existing)previous=JSON.parse(existing.payload_json)}catch{}
      const weeklyTargets=Array.isArray(b.weekly_targets)?b.weekly_targets.slice(0,12).map((w,i)=>({week:i+1,memorization:clean(w?.memorization,180),revision:clean(w?.revision,180),understanding:clean(w?.understanding,180),application:clean(w?.application,180)})):Array.isArray(previous.weekly_targets)?previous.weekly_targets:[];
      const plan={id:studentId,student_id:studentId,group_id:st.group_id,path_id:pathId,weekly_goal:weeklyGoal,weekly_targets:weeklyTargets,created_at:previous.created_at||nowIso(),updated_at:nowIso(),updated_by:user.id};
      await saveRecord(env,"quran_plan",plan);await log(env,user.id,"quran_plan_save",{student_id:studentId,path_id:pathId});
      return json({ok:true,plan});
    }
    if(path==="/api/curriculum"&&method==="GET"){
      const custom=await scopedRecords(env,user,"lessons",user.role==="student");
      const lessons=[
        {id:"lesson-tawhid-1",subject_id:"allah",title:"معرفة الله تعالى وأثرها في العبادة",objective:"أن يربط الطالب بين معرفة ربه وإخلاص العبادة له.",content:"يتعلم الطالب معنى إفراد الله تعالى بالعبادة، ويستخرج من النصوص ما يزيده محبةً وتعظيمًا ورجاءً.",references:[{kind:"quran",text:"الذاريات: 56"},{kind:"quran",text:"الفاتحة: 5"}],activities:["حفظ الآية ومعرفة معناها الإجمالي","ذكر مثال عملي على إخلاص العبادة"],stages:["فهم","حفظ","مراجعة","تطبيق"],builtin:true},
        {id:"lesson-sunnah-1",subject_id:"prophet",title:"النية والإخلاص",objective:"أن يستحضر الطالب النية الصالحة قبل العمل.",content:"الأعمال معتبرة بنياتها؛ يراجع الطالب قصده ويجدد نيته في طلب العلم وتعليم القرآن.",references:[{kind:"hadith",text:"إنما الأعمال بالنيات، صحيح البخاري (1)، وصحيح مسلم (1907)"}],activities:["شرح معنى النية بمثال من طلب العلم","كتابة نية صالحة لعمل اليوم"],stages:["فهم","حفظ","مراجعة","تطبيق"],builtin:true},
        {id:"lesson-quran-1",subject_id:"quran",title:"آداب تلاوة القرآن وتدبره",objective:"أن يجمع الطالب بين التلاوة الصحيحة وفهم المعنى والعمل.",content:"يتدرب الطالب على القراءة المتأنية، وفهم المعنى من تفسير موثوق، واستخراج عمل واحد تدل عليه الآية.",references:[{kind:"quran",text:"محمد: 24"},{kind:"quran",text:"ص: 29"}],activities:["تلاوة مقطع مضبوط","قراءة تفسير موثوق بإشراف المعلم","تدوين فائدة وعمل تطبيقي"],stages:["فهم","حفظ","مراجعة","تطبيق"],builtin:true},
        {id:"lesson-adab-1",subject_id:"adab",title:"الرفق وحسن الخلق",objective:"أن يطبق الطالب الرفق في تعامله مع زملائه.",content:"يتعرف الطالب معنى الرفق ويذكر صورًا عملية له في البيت والمسجد ومجلس العلم.",references:[{kind:"hadith",text:"إن الله رفيق يحب الرفق، صحيح مسلم (2593)"}],activities:["ذكر موقف يحتاج إلى الرفق","تطبيق خلق الرفق اليوم"],stages:["فهم","حفظ","مراجعة","تطبيق"],builtin:true},
        {id:"lesson-hifz-1",subject_id:"quran",title:"منهجية الحفظ والمراجعة",objective:"أن يلتزم الطالب وردًا مناسبًا مع مراجعة متقنة.",content:"يقسم الطالب المقدار إلى وحدات صغيرة، ويكرر حتى يتقن، ثم يربط الجديد بمراجعة السابق ويعرض حفظه على المعلم.",references:[{kind:"quran",text:"المزمل: 4"},{kind:"hadith",text:"تعاهدوا القرآن، صحيح البخاري (5033)، وصحيح مسلم (791)"}],activities:["تحديد ورد واقعي","تسميع المقطع","تسجيل مواضع الخطأ وتصحيحها"],stages:["فهم","حفظ","مراجعة","تطبيق"],builtin:true},
        {id:"lesson-quran-merit",subject_id:"quran",title:"فضل تعلم القرآن وتعليمه",objective:"أن يقدّر الطالب شرف تعلّم القرآن وتعليمه ويترجمه إلى مواظبة.",content:"يتعلم الطالب أن خيرية تعلّم القرآن وتعليمه فضل عظيم، وأنها مسؤولية تتطلب الإخلاص والتلقي الصحيح والصبر على المراجعة.",references:[{kind:"hadith",text:"خيركم من تعلم القرآن وعلمه، صحيح البخاري (5027)"}],activities:["شرح معنى تعلم القرآن وتعليمه","ذكر عمل واحد يظهر احترام القرآن"],stages:["فهم","حفظ","مراجعة","تطبيق"],builtin:true},
        {id:"lesson-quran-tadabbur",subject_id:"quran",title:"التدبر والعمل بالآيات",objective:"أن يستخرج الطالب معنى صحيحًا وفائدة عملية من آية.",content:"لا يكتفي الطالب بسرعة القراءة؛ يقرأ الآية في سياقها، ويرجع إلى تفسير موثوق، ثم يختار هداية عملية واضحة دون أن ينسب إلى الآية ما لا تدل عليه.",references:[{kind:"quran",text:"محمد: 24"},{kind:"quran",text:"ص: 29"}],activities:["اختيار آية من الورد","قراءة تفسير السعدي أو التفسير الميسر","كتابة فائدة وعمل قابل للتطبيق"],stages:["فهم","حفظ","مراجعة","تطبيق"],builtin:true},
        {id:"lesson-prophet-mercy",subject_id:"prophet",title:"رحمة النبي ﷺ بالناس",objective:"أن يقتدي الطالب برحمة النبي ﷺ في تعامله اليومي.",content:"يدرس الطالب شواهد الرحمة في السيرة، ويلاحظ أن الرفق لا يعني ترك الحق، بل إيصال الخير بحكمة ورحمة.",references:[{kind:"quran",text:"الأنبياء: 107"},{kind:"hadith",text:"من لا يَرحم لا يُرحم، صحيح البخاري (6013) وصحيح مسلم (2319)"}],activities:["ذكر موقف نبوي في الرحمة","تطبيق رحمة عملية في البيت أو المسجد"],stages:["فهم","حفظ","مراجعة","تطبيق"],builtin:true},
        {id:"lesson-hadith-sincerity",subject_id:"sunnah",title:"الدين النصيحة",objective:"أن يفهم الطالب النصيحة الشرعية ويؤديها بعلم ورفق.",content:"النصيحة إرادة الخير بإخلاص، وتكون بعلم وصدق ورفق، مع مراعاة المقام والقدرة، وليست تشهيرًا أو تتبعًا للعثرات.",references:[{kind:"hadith",text:"الدين النصيحة، صحيح مسلم (55)"}],activities:["تمييز النصيحة من التعيير","صياغة نصيحة لطيفة في موقف افتراضي"],stages:["فهم","حفظ","مراجعة","تطبيق"],builtin:true},
        {id:"lesson-adab-truth",subject_id:"adab",title:"الصدق وأمانة طالب العلم",objective:"أن يلتزم الطالب الصدق في كلامه ونقله للعلم.",content:"يحفظ الطالب لسانه من الكذب، ويتثبت من النصوص قبل نشرها، ويصرح بما لا يعرف بدل أن يخمّن أو ينسب قولًا إلى صاحبه بغير تحقق.",references:[{kind:"quran",text:"التوبة: 119"},{kind:"hadith",text:"عليكم بالصدق، صحيح البخاري (6094) وصحيح مسلم (2607)"}],activities:["التثبت من مصدر حديث أو أثر","تدريب: كيف أجيب إذا لم أعلم؟"],stages:["فهم","حفظ","مراجعة","تطبيق"],builtin:true},
        {id:"lesson-adab-gentleness",subject_id:"adab",title:"الرفق في التعليم والتعلم",objective:"أن يطبق الطالب الرفق عند الخطأ والتصحيح.",content:"الرفق يحسن طريقة التعليم والتصحيح؛ يحدد المعلم الخطأ بوضوح دون إهانة، ويقبل الطالب التصحيح ويعيد المحاولة.",references:[{kind:"hadith",text:"إن الله رفيق يحب الرفق، صحيح مسلم (2593)"}],activities:["إعادة صياغة تصحيح قاسٍ بأسلوب رفيق","تدريب على تقبل الملاحظة وإصلاح الخطأ"],stages:["فهم","حفظ","مراجعة","تطبيق"],builtin:true}
      ];
      return json([...lessons,...custom]);
    }
    if(path==="/api/curriculum"&&method==="POST"){
      if(!["admin","teacher","director","supervisor"].includes(user.role))return fail(403,"إدارة الدروس للمعلم أو المدير");
      const parsed=await parseBody(request);if(parsed.error)return parsed.error;const b=parsed.value;
      const title=clean(b.title,180),content=clean(b.content,5000),subjectId=clean(b.subject_id,80),lessonId=clean(b.id,80);
      if(!title||!content||!subjectId)return fail(400,"أدخل عنوان الدرس ومحتواه والمقرر");
      let previous=null;
      if(lessonId){
        const old=await env.DB.prepare("SELECT payload_json FROM academy_records WHERE collection='lessons' AND id=?").bind(lessonId).first();
        if(!old)return fail(404,"الدرس المراد تعديله غير موجود");
        try{previous=JSON.parse(old.payload_json)}catch{return fail(500,"تعذّرت قراءة الدرس")};
        if(previous.builtin)return fail(403,"لا يمكن تعديل الدروس الأساسية من هنا");
        if(user.role!=="admin"&&(!previous.group_id||!await canManageGroup(env,user,previous.group_id)))return fail(403,"لا تملك صلاحية تعديل هذا الدرس");
      }
      const lesson={id:lessonId||uuid(),title,content,subject_id:subjectId,objective:clean(b.objective,500),references:Array.isArray(b.references)?b.references.slice(0,10).map(r=>({kind:clean(r?.kind,30),text:clean(r?.text,300)})):[],activities:Array.isArray(b.activities)?b.activities.slice(0,10).map(x=>clean(x,300)):[],stages:["فهم","حفظ","مراجعة","تطبيق"],group_id:clean(b.group_id,80)||null,status:"published",created_by:previous?.created_by||user.id,created_at:previous?.created_at||nowIso(),updated_at:nowIso()};
      if(lesson.group_id&&!await canManageGroup(env,user,lesson.group_id))return fail(403,"لا تملك صلاحية هذا الفوج");
      if(!lesson.group_id&&user.role!=="admin")return fail(403,"يمكن للمدير وحده نشر درس عام");
      await saveRecord(env,"lessons",lesson);await log(env,user.id,previous?"lesson_update":"lesson_create",{lesson_id:lesson.id,subject_id:subjectId});return json(lesson,previous?200:201);
    }
    if(path==="/api/curriculum/delete"&&method==="POST"){
      if(!["admin","teacher","director","supervisor"].includes(user.role))return fail(403,"حذف الدروس للمعلم أو المدير");
      const parsed=await parseBody(request);if(parsed.error)return parsed.error;const id=clean(parsed.value.id,80);
      const raw=await env.DB.prepare("SELECT payload_json FROM academy_records WHERE collection='lessons' AND id=?").bind(id).first();
      if(!raw)return fail(404,"الدرس غير موجود");
      let lesson;try{lesson=JSON.parse(raw.payload_json)}catch{return fail(500,"تعذّرت قراءة الدرس")};
      if(lesson.builtin)return fail(403,"لا يمكن حذف الدروس الأساسية");
      if(user.role!=="admin"&&(!lesson.group_id||!await canManageGroup(env,user,lesson.group_id)))return fail(403,"لا تملك صلاحية حذف هذا الدرس");
      await env.DB.prepare("DELETE FROM academy_records WHERE collection='lessons' AND id=?").bind(id).run();
      await log(env,user.id,"lesson_delete",{lesson_id:id});return json({ok:true});
    }
    if(path==="/api/gamification/claim"&&method==="POST"){
      if(user.role!=="student"||!user.student_id||!user.group_id)return fail(403,"المكافآت متاحة لحساب الطالب المرتبط بفوج");
      const day=nowIso().slice(0,10),parsed=await parseBody(request);if(parsed.error)return parsed.error;
      const challengeId=clean(parsed.value.challenge_id,80);
      const daily=[{id:"daily-quran",points:10},{id:"daily-review",points:10},{id:"daily-adab",points:5}];
      const expected=daily[Number(day.replace(/-/g,""))%daily.length];
      if(challengeId!==expected.id)return fail(400,"أكمل تحدي اليوم المعروض في حسابك لاستلام مكافأته");
      const id=user.student_id+":"+day;
      const old=await env.DB.prepare("SELECT payload_json FROM academy_records WHERE collection='daily_claims' AND id=?").bind(id).first();
      if(old)return fail(409,"لقد استلمت مكافأة اليوم بالفعل");
      const points=expected.points;
      const claim={id,student_id:user.student_id,group_id:user.group_id,day,challenge_id:challengeId,points,claimed_at:nowIso()};
      await saveRecord(env,"daily_claims",claim);await log(env,user.id,"daily_challenge_claim",{challenge_id:challengeId,points,day});return json({ok:true,claim},201);
    }
    if(path==="/api/gamification"&&method==="GET"){
      if(user.role!=="student"||!user.student_id||!user.group_id)return fail(403,"لوحة الإنجاز متاحة لحساب الطالب المرتبط بفوج");
      const [attendance,quran,attempts,plans,claims]=await Promise.all([
        records(env,"attendance"," AND group_id=?",[user.group_id]),records(env,"quran_progress"," AND student_id=?",[user.student_id]),records(env,"test_attempts"," AND student_id=?",[user.student_id]),records(env,"quran_plan"," AND student_id=?",[user.student_id]),records(env,"daily_claims"," AND student_id=?",[user.student_id])
      ]);
      const present=attendance.filter(a=>a.student_id===user.student_id&&a.status==="present").length;
      const days=new Set(quran.map(q=>q.date)).size,tests=attempts.length,score=attempts.reduce((n,a)=>n+(Number(a.score)||0),0);
      const badges=[];if(days>=1)badges.push({id:"first-step",name:"الخطوة الأولى",description:"سجلت متابعة قرآنية",icon:"🌱"});if(days>=7)badges.push({id:"steady",name:"ثبات أسبوع",description:"تابعت القرآن في سبعة أيام مختلفة",icon:"🌿"});if(tests>=1)badges.push({id:"exam",name:"همة المتعلم",description:"أكملت اختبارًا",icon:"📘"});if(present>=5)badges.push({id:"attendance",name:"مواظب",description:"سجلت حضورًا خمس مرات",icon:"⭐"});
      const day=nowIso().slice(0,10),daily=[{id:"daily-quran",title:"ورد اليوم",description:"اقرأ وردك المقرر ثم راجعه بإتقان",points:10},{id:"daily-review",title:"مراجعة ثابتة",description:"راجع محفوظًا سابقًا قبل إضافة الجديد",points:10},{id:"daily-adab",title:"عمل بالعلم",description:"طبّق فائدة تعلمتها اليوم",points:5}];
      const challenge= daily[Number(day.replace(/-/g,""))%daily.length];
      return json({student_id:user.student_id,points:present*5+days*10+score*3+claims.reduce((n,c)=>n+(Number(c.points)||0),0),stats:{attendance:present,quran_days:days,tests,answers_correct:score},badges,daily_challenge:challenge,plan:plans[0]||null,hearts:Math.max(0,5-attempts.filter(a=>String(a.submitted_at||"").slice(0,10)===day).reduce((n,a)=>n+Math.max(0,Number(a.total||0)-Number(a.score||0)),0)),challenge_claimed:claims.some(c=>c.day===day),updated_at:nowIso()});
    }
    if(path==="/api/leaderboard"&&method==="GET"){
      const groupId=user.role==="student"?user.group_id:clean(url.searchParams.get("group_id"),80);
      if(!groupId)return fail(400,"لا يوجد فوج مرتبط بالحساب");
      if(user.role!=="student"&&!await canManageGroup(env,user,groupId))return fail(403,"لا تملك صلاحية هذا الفوج");
      if(user.role==="student"&&groupId!==user.group_id)return fail(403,"يمكنك رؤية ترتيب فوجك فقط");
      const students=await env.DB.prepare("SELECT id,display_name FROM students WHERE group_id=? AND active=1 ORDER BY display_name").bind(groupId).all();
      const roster=students.results||[];
      const parseStored=rows=>(rows.results||[]).flatMap(row=>{try{return [JSON.parse(row.payload_json)]}catch{return []}});
      const [attendanceResult,quranResult,testResult,claimResult]=await Promise.all([
        env.DB.prepare("SELECT payload_json FROM academy_records WHERE collection='attendance' AND group_id=?").bind(groupId).all(),
        env.DB.prepare("SELECT payload_json FROM academy_records WHERE collection='quran_progress' AND group_id=?").bind(groupId).all(),
        env.DB.prepare("SELECT payload_json FROM academy_records WHERE collection='test_attempts' AND group_id=?").bind(groupId).all(),
        env.DB.prepare("SELECT payload_json FROM academy_records WHERE collection='daily_claims' AND group_id=?").bind(groupId).all()
      ]);
      const attendanceRows=parseStored(attendanceResult),quranRows=parseStored(quranResult),testRows=parseStored(testResult),claimRows=parseStored(claimResult);
      const activeDays=new Set(attendanceRows.map(a=>String(a.date||"")).filter(Boolean)).size||1;
      const bestTests=new Map();
      for(const attempt of testRows){const key=String(attempt.student_id)+":"+String(attempt.test_id),ratio=Number(attempt.total)>0?Number(attempt.score)/Number(attempt.total):0;if(!bestTests.has(key)||ratio>bestTests.get(key))bestTests.set(key,ratio);}
      const ranked=roster.map(st=>{
        const mineAttendance=attendanceRows.filter(a=>a.student_id===st.id);
        const present=mineAttendance.filter(a=>a.status==="present").length;
        const quran=quranRows.filter(q=>q.student_id===st.id).length;
        const attendanceRate=Math.min(100,Math.round(present/activeDays*100));
        const quranRate=Math.min(100,Math.round(quran/Math.max(1,activeDays)*100));
        const quizValues=[...bestTests.entries()].filter(([key])=>key.startsWith(String(st.id)+":")).map(([,ratio])=>ratio);
        const quizRate=quizValues.length?Math.round(quizValues.reduce((n,x)=>n+x,0)/quizValues.length*100):0;
        const challengeCount=claimRows.filter(c=>c.student_id===st.id).length;
        const challengeRate=Math.min(100,Math.round(challengeCount/14*100));
        // Normalized 0–100 score rewards steady participation and mastery, not raw memorization volume.
        const points=Math.round(attendanceRate*.25+quranRate*.35+quizRate*.30+challengeRate*.10);
        const quizCorrect=testRows.filter(a=>a.student_id===st.id).reduce((n,a)=>n+(Number(a.score)||0),0);
        return {name:st.display_name,points,attendance_rate:attendanceRate,quran_rate:quranRate,quiz_rate:quizRate,challenge_rate:challengeRate,present_days:present,quran_records:quran,quiz_correct:quizCorrect,is_self:user.role==="student"&&st.id===user.student_id};
      }).sort((a,b)=>b.points-a.points||b.attendance_rate-a.attendance_rate||a.name.localeCompare(b.name,"ar"));
      return json(ranked.map((r,i)=>({...r,rank:i+1})));
    }
    if(path==="/api/metrics"&&method==="GET"){
      if(user.role!=="admin")return fail(403,"forbidden");const counts=await env.DB.prepare("SELECT (SELECT COUNT(*) FROM users) AS users,(SELECT COUNT(*) FROM students WHERE active=1) AS students,(SELECT COUNT(*) FROM groups WHERE active=1) AS groups,(SELECT COUNT(*) FROM academy_records) AS records").first();return json({...counts,storage:"d1"});
    }
    if(path==="/api/admin/system-check"&&method==="GET"){
      if(user.role!=="admin")return fail(403,"forbidden");
      const [counts,roles,collections]=await Promise.all([
        env.DB.prepare("SELECT (SELECT COUNT(*) FROM users WHERE role='admin' AND active=1) AS active_admins,(SELECT COUNT(*) FROM users WHERE active=1) AS active_users,(SELECT COUNT(*) FROM students WHERE active=1) AS active_students,(SELECT COUNT(*) FROM students s LEFT JOIN users u ON u.id=s.user_id AND u.active=1 AND u.role='student' WHERE s.active=1 AND u.id IS NULL) AS students_without_login,(SELECT COUNT(*) FROM students s LEFT JOIN groups g ON g.id=s.group_id AND g.active=1 WHERE s.active=1 AND g.id IS NULL) AS students_without_active_group,(SELECT COUNT(*) FROM groups g LEFT JOIN users u ON u.id=g.teacher_id AND u.active=1 AND u.role IN ('teacher','admin') WHERE g.active=1 AND (g.teacher_id IS NULL OR u.id IS NULL)) AS groups_without_valid_teacher,(SELECT COUNT(*) FROM sessions WHERE expires_at<=strftime('%Y-%m-%dT%H:%M:%fZ','now')) AS expired_sessions,(SELECT COUNT(*) FROM academy_records) AS saved_records,(SELECT COUNT(*) FROM users WHERE active=1 AND role IN ('director','supervisor')) AS active_director_supervisor_accounts").first(),
        env.DB.prepare("SELECT role,COUNT(*) AS total FROM users WHERE active=1 GROUP BY role ORDER BY role").all(),
        env.DB.prepare("SELECT collection,COUNT(*) AS total FROM academy_records GROUP BY collection ORDER BY collection").all()
      ]);
      return json({checked_at:nowIso(),storage:"cloudflare-d1",bootstrap_setup_enabled:!!env.BOOTSTRAP_SECRET,counts:counts||{},roles:roles.results||[],collections:collections.results||[]});
    }
    if(path==="/api/admin/audit"&&method==="GET"){
      if(user.role!=="admin")return fail(403,"forbidden");
      const rows=await env.DB.prepare("SELECT a.id,a.user_id,u.display_name AS actor,a.action,a.metadata_json,a.created_at FROM audit_log a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.created_at DESC LIMIT 200").all();
      return json((rows.results||[]).map(r=>{let metadata={};try{metadata=JSON.parse(r.metadata_json||"{}")}catch{}return {id:r.id,user_id:r.user_id,actor:r.actor||"حساب غير متاح",action:r.action,metadata,created_at:r.created_at};}));
    }
    if(path==="/api/admin/backup/summary"&&method==="GET"){
      if(user.role!=="admin")return fail(403,"forbidden");
      const [users,groups,students,recordsCount,audit]=await Promise.all([
        env.DB.prepare("SELECT COUNT(*) AS n FROM users WHERE active=1").first(),
        env.DB.prepare("SELECT COUNT(*) AS n FROM groups WHERE active=1").first(),
        env.DB.prepare("SELECT COUNT(*) AS n FROM students WHERE active=1").first(),
        env.DB.prepare("SELECT COUNT(*) AS n FROM academy_records").first(),
        env.DB.prepare("SELECT COUNT(*) AS n FROM audit_log").first()
      ]);
      return json({created_at:nowIso(),storage:"cloudflare-d1",counts:{users:users?.n||0,groups:groups?.n||0,students:students?.n||0,records:recordsCount?.n||0,audit_entries:audit?.n||0},includes:["الحسابات الأساسية دون كلمات المرور","الأفواج وتعيين المعلمين","قائمة الطلاب","سجلات الحضور والتقدم والاختبارات والمحتوى","آخر 5000 عملية إدارية"],excludes:["كلمات المرور وبصماتها","رموز الجلسات","محاولات تسجيل الدخول"]});
    }
    if(path==="/api/admin/backup/export"&&method==="GET"){
      if(user.role!=="admin")return fail(403,"forbidden");
      const [users,groups,students,recordsResult,schools,audit]=await Promise.all([
        env.DB.prepare("SELECT id,display_name,identity_normalized,role,active,created_at FROM users ORDER BY created_at").all(),
        env.DB.prepare("SELECT id,name,school_id,teacher_id,active,created_at FROM groups ORDER BY created_at").all(),
        env.DB.prepare("SELECT id,user_id,display_name,group_id,active,created_at FROM students ORDER BY created_at").all(),
        env.DB.prepare("SELECT collection,id,owner_user_id,group_id,student_id,payload_json,updated_at FROM academy_records ORDER BY collection,updated_at").all(),
        env.DB.prepare("SELECT id,name,description,active,sort_order,created_at FROM quran_schools ORDER BY sort_order,name").all(),
        env.DB.prepare("SELECT id,user_id,action,metadata_json,created_at FROM audit_log ORDER BY created_at DESC LIMIT 5000").all()
      ]);
      const payload={format:"ihsan-academy-operational-backup-v1",created_at:nowIso(),notice:"نسخة تشغيلية من البيانات؛ لا تتضمن كلمات المرور أو الجلسات ولا تُعد وحدها نسخة كاملة قابلة لإعادة إنشاء الحسابات.",data:{users:users.results||[],groups:groups.results||[],students:students.results||[],academy_records:(recordsResult.results||[]).map(r=>{let payload=null;try{payload=JSON.parse(r.payload_json)}catch{}const {payload_json,...metadata}=r;return {...metadata,payload}}),quran_schools:schools.results||[],audit_log:audit.results||[]}};
      await log(env,user.id,"admin_backup_export",{users:payload.data.users.length,groups:payload.data.groups.length,students:payload.data.students.length,records:payload.data.academy_records.length});
      return json(payload,200,{"content-disposition":'attachment; filename="ihsan-academy-backup.json"',"cache-control":"no-store"});
    }

    if(path==="/api/admin/backup/full-export"&&method==="GET"){
      if(user.role!=="admin")return fail(403,"forbidden");
      try { await log(env,user.id,"admin_backup_full_export",{format:"ihsan-academy-full-backup-v2"}); }
      catch (auditError) { console.error("Ihsan full-backup audit failed",{message:String(auditError?.message||auditError)}); }
      const [users,groups,students,recordsResult,schools,audit]=await Promise.all([
        env.DB.prepare("SELECT id,display_name,identity_normalized,password_hash,role,active,created_at FROM users ORDER BY created_at").all(),
        env.DB.prepare("SELECT id,name,school_id,active,created_at,teacher_id FROM groups ORDER BY created_at").all(),
        env.DB.prepare("SELECT id,user_id,display_name,group_id,active,created_at FROM students ORDER BY created_at").all(),
        env.DB.prepare("SELECT collection,id,owner_user_id,group_id,student_id,payload_json,updated_at FROM academy_records ORDER BY collection,updated_at").all(),
        env.DB.prepare("SELECT id,name,description,active,sort_order,created_at FROM quran_schools ORDER BY sort_order,name").all(),
        env.DB.prepare("SELECT id,user_id,action,metadata_json,created_at FROM audit_log ORDER BY created_at").all()
      ]);
      const payload={format:"ihsan-academy-full-backup-v2",created_at:nowIso(),notice:"نسخة كاملة قابلة للدمج والاستعادة: تتضمن بصمات كلمات المرور؛ تعامل معها كملف سري. لا تتضمن رموز الجلسات أو محاولات الدخول؛ سيحتاج المستخدمون إلى تسجيل الدخول مجددًا عند النقل إلى قاعدة جديدة.",data:{
        users:users.results||[],
        groups:groups.results||[],
        students:students.results||[],
        academy_records:(recordsResult.results||[]).map(r=>{let value=null;try{value=JSON.parse(r.payload_json)}catch{}return {collection:r.collection,id:r.id,owner_user_id:r.owner_user_id,group_id:r.group_id,student_id:r.student_id,updated_at:r.updated_at,payload:value}}),
        quran_schools:schools.results||[],
        audit_log:audit.results||[]
      }};
      return json(payload,200,{"content-disposition":'attachment; filename="ihsan-academy-full-backup.json"',"cache-control":"no-store"});
    }
    if(path==="/api/admin/backup/restore"&&method==="POST"){
      if(user.role!=="admin")return fail(403,"forbidden");
      const parsed=await parseBody(request,8*1024*1024); if(parsed.error)return parsed.error;
      const b=parsed.value;
      if(b.confirm_restore!=="RESTORE-IHSAN-ACADEMY")return fail(400,"أكد الاستعادة من واجهة الإدارة قبل الإرسال");
      if(!b.data||b.format!=="ihsan-academy-full-backup-v2")return fail(400,"صيغة النسخة غير مدعومة؛ يلزم ملف النسخة الكاملة v2");
      const d=b.data;
      const limits={users:10000,groups:10000,students:100000,academy_records:100000,quran_schools:1000,audit_log:100000};
      for(const [key,max] of Object.entries(limits)){
        if(!Array.isArray(d[key])||d[key].length>max)return fail(400,"قائمة غير صالحة أو أكبر من الحد المسموح: "+key);
      }
      const isObj=x=>!!x&&typeof x==="object"&&!Array.isArray(x);
      const txt=(x,max)=>typeof x==="string"&&x.trim().length>0&&x.length<=max;
      const optTxt=(x,max)=>x===null||x===undefined||x===""||(typeof x==="string"&&x.length<=max);
      const idOk=x=>txt(x,128);
      const optIdOk=x=>optTxt(x,128);
      const activeOk=x=>x===0||x===1;
      const dateOk=x=>txt(x,80);
      const unique=values=>new Set(values).size===values.length;
      const users=d.users.map(x=>isObj(x)?{id:x.id,display_name:x.display_name,identity_normalized:typeof x.identity_normalized==="string"?x.identity_normalized.toLowerCase():x.identity_normalized,password_hash:x.password_hash,role:x.role,active:x.active,created_at:x.created_at}:null);
      const groups=d.groups.map(x=>isObj(x)?{id:x.id,name:x.name,school_id:x.school_id??null,active:x.active,created_at:x.created_at,teacher_id:x.teacher_id??null}:null);
      const students=d.students.map(x=>isObj(x)?{id:x.id,user_id:x.user_id??null,display_name:x.display_name,group_id:x.group_id??null,active:x.active,created_at:x.created_at}:null);
      const schools=d.quran_schools.map(x=>isObj(x)?{id:x.id,name:x.name,description:x.description,active:x.active,sort_order:x.sort_order,created_at:x.created_at}:null);
      const records=d.academy_records.map(x=>isObj(x)?{collection:x.collection,id:x.id,owner_user_id:x.owner_user_id??null,group_id:x.group_id??null,student_id:x.student_id??null,updated_at:x.updated_at,payload:x.payload}:null);
      const audit=d.audit_log.map(x=>isObj(x)?{id:x.id,user_id:x.user_id??null,action:x.action,metadata_json:x.metadata_json,created_at:x.created_at}:null);
      if(users.some(x=>!x||!idOk(x.id)||!txt(x.display_name,120)||!txt(x.identity_normalized,200)||!/^[a-f0-9]{32}$/.test(String(x.password_hash||"").split("$")[2]||"")||!/^pbkdf2-sha256\$50000\$[a-f0-9]{32}\$[a-f0-9]{64}$/.test(String(x.password_hash||""))||!["admin","director","teacher","supervisor","student"].includes(x.role)||!activeOk(x.active)||!dateOk(x.created_at)))return fail(400,"تحتوي النسخة على بيانات حساب غير صالحة");
      if(groups.some(x=>!x||!idOk(x.id)||!txt(x.name,160)||!optIdOk(x.school_id)||!optIdOk(x.teacher_id)||!activeOk(x.active)||!dateOk(x.created_at)))return fail(400,"تحتوي النسخة على بيانات فوج غير صالحة");
      if(students.some(x=>!x||!idOk(x.id)||!optIdOk(x.user_id)||!txt(x.display_name,160)||!optIdOk(x.group_id)||!activeOk(x.active)||!dateOk(x.created_at)))return fail(400,"تحتوي النسخة على بيانات طالب غير صالحة");
      if(schools.some(x=>!x||!idOk(x.id)||!txt(x.name,200)||typeof x.description!=="string"||x.description.length>10000||!activeOk(x.active)||!Number.isInteger(x.sort_order)||!dateOk(x.created_at)))return fail(400,"تحتوي النسخة على بيانات مدرسة غير صالحة");
      if(records.some(x=>!x||!txt(x.collection,100)||!idOk(x.id)||!optIdOk(x.owner_user_id)||!optIdOk(x.group_id)||!optIdOk(x.student_id)||!dateOk(x.updated_at)||!("payload" in x)))return fail(400,"تحتوي النسخة على سجل تطبيقي غير صالح");
      if(audit.some(x=>!x||!idOk(x.id)||!optIdOk(x.user_id)||!txt(x.action,120)||typeof x.metadata_json!=="string"||x.metadata_json.length>100000||!dateOk(x.created_at)))return fail(400,"تحتوي النسخة على سجل تدقيق غير صالح");
      if(!unique(users.map(x=>x.id))||!unique(users.map(x=>x.identity_normalized))||!unique(groups.map(x=>x.id))||!unique(students.map(x=>x.id))||!unique(schools.map(x=>x.id))||!unique(records.map(x=>x.collection+"\u0000"+x.id))||!unique(audit.map(x=>x.id)))return fail(400,"تحتوي النسخة على معرفات مكررة");
      const userIds=new Set(users.map(x=>x.id)), groupIds=new Set(groups.map(x=>x.id));
      const currentAdminBackup=users.find(x=>x.id===user.id); if(!currentAdminBackup||currentAdminBackup.role!=="admin"||currentAdminBackup.active!==1)return fail(400,"يجب أن تتضمن النسخة حساب المدير الحالي نشطًا بصلاحيات المدير");
      if(students.some(x=>(x.user_id&&!userIds.has(x.user_id))||(x.group_id&&!groupIds.has(x.group_id))))return fail(400,"توجد إحالات طالب إلى حساب أو فوج غير موجود داخل النسخة");
      if(audit.some(x=>x.user_id&&!userIds.has(x.user_id)))return fail(400,"توجد إحالات في سجل التدقيق إلى حساب غير موجود داخل النسخة");
      for(const r of records){try{JSON.stringify(r.payload)}catch{return fail(400,"تعذّر قراءة محتوى أحد السجلات")}}
      const [existingUsers,existingStudents]=await Promise.all([
        env.DB.prepare("SELECT id,identity_normalized FROM users").all(),
        env.DB.prepare("SELECT id,user_id FROM students WHERE user_id IS NOT NULL").all()
      ]);
      const currentIdentity=new Map((existingUsers.results||[]).map(x=>[x.identity_normalized,x.id]));
      if(users.some(x=>currentIdentity.has(x.identity_normalized)&&currentIdentity.get(x.identity_normalized)!==x.id))return fail(409,"يوجد حساب حالي بالبريد/اسم الدخول نفسه ومعرّف مختلف؛ لم تبدأ الاستعادة");
      const currentStudentUsers=new Map((existingStudents.results||[]).filter(x=>x.user_id).map(x=>[x.user_id,x.id]));
      if(students.some(x=>x.user_id&&currentStudentUsers.has(x.user_id)&&currentStudentUsers.get(x.user_id)!==x.id))return fail(409,"يوجد حساب طالب مرتبط بسجل طالب مختلف؛ لم تبدأ الاستعادة");
      const statements=[];
      for(const x of users)statements.push(env.DB.prepare("INSERT INTO users (id,display_name,identity_normalized,password_hash,role,active,created_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET display_name=excluded.display_name,identity_normalized=excluded.identity_normalized,password_hash=excluded.password_hash,role=excluded.role,active=excluded.active,created_at=excluded.created_at").bind(x.id,x.display_name,x.identity_normalized,x.password_hash,x.role,x.active,x.created_at));
      for(const x of schools)statements.push(env.DB.prepare("INSERT INTO quran_schools (id,name,description,active,sort_order,created_at) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,description=excluded.description,active=excluded.active,sort_order=excluded.sort_order,created_at=excluded.created_at").bind(x.id,x.name,x.description,x.active,x.sort_order,x.created_at));
      for(const x of groups)statements.push(env.DB.prepare("INSERT INTO groups (id,name,school_id,active,created_at,teacher_id) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,school_id=excluded.school_id,active=excluded.active,created_at=excluded.created_at,teacher_id=excluded.teacher_id").bind(x.id,x.name,x.school_id,x.active,x.created_at,x.teacher_id));
      for(const x of students)statements.push(env.DB.prepare("INSERT INTO students (id,user_id,display_name,group_id,active,created_at) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET user_id=excluded.user_id,display_name=excluded.display_name,group_id=excluded.group_id,active=excluded.active,created_at=excluded.created_at").bind(x.id,x.user_id,x.display_name,x.group_id,x.active,x.created_at));
      for(const x of records)statements.push(env.DB.prepare("INSERT INTO academy_records (collection,id,owner_user_id,group_id,student_id,payload_json,updated_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(collection,id) DO UPDATE SET owner_user_id=excluded.owner_user_id,group_id=excluded.group_id,student_id=excluded.student_id,payload_json=excluded.payload_json,updated_at=excluded.updated_at").bind(x.collection,x.id,x.owner_user_id,x.group_id,x.student_id,JSON.stringify(x.payload),x.updated_at));
      for(const x of audit)statements.push(env.DB.prepare("INSERT INTO audit_log (id,user_id,action,metadata_json,created_at) VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET user_id=excluded.user_id,action=excluded.action,metadata_json=excluded.metadata_json,created_at=excluded.created_at").bind(x.id,x.user_id,x.action,x.metadata_json,x.created_at));
      try{
        for(let i=0;i<statements.length;i+=40)await env.DB.batch(statements.slice(i,i+40));
      }catch(restoreError){
        console.error("Ihsan backup restore failed",{message:String(restoreError?.message||restoreError),statements:statements.length});
        return fail(500,"توقفت الاستعادة أثناء الحفظ. قد تكون بعض الدفعات حُفظت؛ أعد المحاولة بالملف نفسه، فالدمج بمعرّفات ثابتة قابل لإعادة المحاولة.");
      }
      try{await log(env,user.id,"admin_backup_restore",{users:users.length,groups:groups.length,students:students.length,records:records.length,schools:schools.length,audit_entries:audit.length})}
      catch(auditError){console.error("Ihsan restore audit failed",{message:String(auditError?.message||auditError)})}
      return json({ok:true,mode:"merge",restored:{users:users.length,groups:groups.length,students:students.length,records:records.length,quran_schools:schools.length,audit_entries:audit.length},notice:"تم دمج النسخة. لم تُحذف السجلات الموجودة خارج الملف؛ راجع البيانات قبل المتابعة."});
    }

    return fail(404,"المسار غير موجود");
    } catch (error) {
      console.error("Ihsan API request failed", { path, method, message: String(error?.message || error) });
      if (path.startsWith("/api/")) return fail(500, "حدث خطأ داخلي أثناء معالجة الطلب. تم تسجيل الخطأ للتشخيص؛ أعد المحاولة.");
      return new Response("Internal Server Error", { status: 500 });
    }
  }
};
