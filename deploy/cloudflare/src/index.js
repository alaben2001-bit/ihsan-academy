const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-robots-tag": "noindex, nofollow, noarchive",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
  "content-security-policy": "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
};
const json = (data, status = 200, extra = {}) => new Response(JSON.stringify(data), { status, headers: { ...JSON_HEADERS, ...extra } });
const fail = (status, error) => json({ error }, status);
const readCookie = (request, name) => {
  const header = request.headers.get("cookie") || "";
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index < 0 || part.slice(0,index).trim() !== name) continue;
    const raw = part.slice(index+1).trim();
    try { return decodeURIComponent(raw); } catch { return raw; }
  }
  return "";
};
const cookieSessionToken = request => {
  const token = readCookie(request, "__Host-ihsan_session");
  return /^[a-f0-9]{64}$/i.test(token) ? token : "";
};
const bearerSessionToken = request => {
  const match = /^Bearer\s+([a-f0-9]{64})$/i.exec(request.headers.get("authorization") || "");
  return match ? match[1] : "";
};
const requestSessionToken = request => bearerSessionToken(request) || cookieSessionToken(request);
const csrfIsValid = request => {
  const cookie = readCookie(request, "__Host-ihsan_csrf");
  const header = request.headers.get("x-csrf-token") || "";
  return /^[a-f0-9]{64}$/i.test(cookie) && cookie === header;
};
const sessionResponse = (data, token, remember, status = 200) => {
  const csrf = hex(crypto.getRandomValues(new Uint8Array(32)));
  const maxAge = remember ? "; Max-Age=2592000" : "";
  const headers = new Headers(JSON_HEADERS);
  headers.append("Set-Cookie", "__Host-ihsan_session=" + token + "; Path=/; Secure; HttpOnly; SameSite=Strict" + maxAge);
  headers.append("Set-Cookie", "__Host-ihsan_csrf=" + csrf + "; Path=/; Secure; SameSite=Strict" + maxAge);
  return new Response(JSON.stringify(data), { status, headers });
};
const clearedSessionResponse = (data = {ok:true}) => {
  const headers = new Headers(JSON_HEADERS);
  headers.append("Set-Cookie", "__Host-ihsan_session=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT");
  headers.append("Set-Cookie", "__Host-ihsan_csrf=; Path=/; Secure; SameSite=Strict; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT");
  return new Response(JSON.stringify(data), { status:200, headers });
};

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
export const academyDate = (value = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Algiers",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const fields = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return fields.year+"-"+fields.month+"-"+fields.day;
};
export const addCalendarDays = (dateOnly, days) => {
  if (!validDateOnly(dateOnly) || !Number.isInteger(days)) throw new Error("invalid_calendar_date");
  const [year, month, day] = dateOnly.split("-").map(Number);
  return new Date(Date.UTC(year, month-1, day+days)).toISOString().slice(0,10);
};
const BULK_STUDENT_ONBOARDING_IDS=["roster-20261020-01","roster-20261020-04","roster-20261020-05","roster-20261020-07","roster-20261020-09","roster-20261020-11","roster-20261020-13","roster-20261020-14","roster-20261020-15","roster-20261020-16","roster-20261020-18","roster-20261020-19","roster-20261020-20","roster-20261020-22","roster-20261020-23","roster-20261020-24","roster-20261020-26","roster-20261020-27","roster-20261020-28","roster-20261020-29","roster-20261020-30","roster-20261020-32","roster-20261020-33","roster-20261020-35","roster-20261020-36","roster-20261020-37","roster-20261020-38","roster-20261020-39","roster-20261020-42","roster-20261020-43","roster-20261020-44","roster-20261020-46","roster-20261020-47","roster-20261020-48","roster-20261020-49","roster-20261020-50","roster-20261020-51","roster-20261020-53","roster-20261020-54","roster-20261020-55"];
const clean = (v, max = 200) => String(v ?? "").trim().slice(0, max);
const normalizeStudentName = value => String(value || "").normalize("NFKC").replace(/[\u064B-\u065F\u0670\u0640]/g, "").replace(/\s+/g, " ").trim().toLocaleLowerCase("ar");
async function findDuplicateStudentByName(env, name, excludeId = "") {
  const key = normalizeStudentName(name);
  if (!key) return null;
  const rows = await env.DB.prepare("SELECT id,display_name,group_id,user_id FROM students WHERE active=1").all();
  return (rows.results || []).find(row => row.id !== excludeId && normalizeStudentName(row.display_name) === key) || null;
}
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
  try { const value=raw ? JSON.parse(raw) : {}; if(!value||typeof value!=="object"||Array.isArray(value))throw new Error("invalid_json"); return value; } catch { throw new Error("invalid_json"); }
}
async function currentUser(request, env) {
  const token = requestSessionToken(request);
  if (!token) return null;
  const row = await env.DB.prepare("SELECT u.id,u.display_name,u.identity_normalized,u.role,u.active,u.must_change_password FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.active=1").bind(await hashToken(token), nowIso()).first();
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
// ---------------------------------------------------------------------------
// طلبات الانضمام: لا مسار يمنح دورًا خاصًا عند التسجيل.
// التسجيل ينشئ حسابًا (طالب بلا فوج أو زائر/محسن) وطلبًا يبدأ «pending»؛
// الاعتماد بيد مسؤول مخوّل فقط (admin، أو director ضمن المدارس المُسندة إليه،
// أو teacher لمدرسة له فيها فوج نشط يدرّسه). عند الاعتماد يُسند الفوج للطالب
// (أو يترقى الزائر إلى طالب/شيخ) داخل معاملة واحدة قدر الإمكان.
// ---------------------------------------------------------------------------
const JOIN_KINDS = ["school_join", "teacher_request"];
const JOIN_STATUSES = ["pending", "approved", "rejected", "cancelled"];
const joinRequestJson = row => row ? ({ id: row.id, kind: row.kind, school_id: row.school_id || null, group_id: row.group_id || null, school_name: row.school_name || null, group_name: row.group_name || null, requested_note: row.requested_note || "", status: row.status, decision_note: row.decision_note || "", decided_at: row.decided_at || null, decided_by: row.decided_by || null, created_at: row.created_at, user_id: row.user_id, user_name: row.user_name || null, user_email: row.user_email || null, user_role: row.user_role || null }) : null;
const JOIN_SELECT = "SELECT jr.*, u.display_name AS user_name, u.identity_normalized AS user_email, u.role AS user_role, s.name AS school_name, g.name AS group_name FROM join_requests jr JOIN users u ON u.id = jr.user_id LEFT JOIN quran_schools s ON s.id = jr.school_id LEFT JOIN groups g ON g.id = jr.group_id";
async function joinRequestById(env, id) {
  return env.DB.prepare(JOIN_SELECT + " WHERE jr.id=?").bind(clean(id,80)).first();
}
async function teacherTeachesSchool(env, userId, schoolId) {
  if (!schoolId) return false;
  const row = await env.DB.prepare("SELECT id FROM groups WHERE school_id=? AND teacher_id=? AND active=1 LIMIT 1").bind(schoolId, userId).first();
  return !!row;
}
async function canDecideJoinRequest(env, user, request) {
  if (user.role === "admin") return true;
  if (user.role === "director") {
    if (request.kind === "teacher_request") return true;
    return Array.isArray(user.school_ids) && user.school_ids.includes(request.school_id);
  }
  if (user.role === "teacher") {
    return request.kind === "school_join" && await teacherTeachesSchool(env, user.id, request.school_id);
  }
  return false;
}

async function groupRow(env, id) { return env.DB.prepare("SELECT id,name,school_id,teacher_id,active FROM groups WHERE id=?").bind(id).first(); }
async function canManageGroup(env, user, groupId) {
  if (!groupId) return false;
  const g = await groupRow(env, groupId);
  if (!g || g.active !== 1) return false;
  if (user.role === "admin") return true;
  if (user.role === "teacher") return g.teacher_id === user.id;
  if (user.role === "director") return Array.isArray(user.school_ids) && user.school_ids.includes(g.school_id);
  if (user.role === "supervisor") return Array.isArray(user.group_ids) && user.group_ids.includes(g.id);
  return false;
}
async function canViewGroup(env, user, groupId) {
  if (!user) return false;
  if (user.role === "visitor") return false; // الزائر/المحسن لا يرى بيانات داخلية حتى لو كانت بلا فوج
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
function generateStudentTemporaryPassword() {
  const bytes=crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes,value=>String(value%10)).join("");
}
async function parseBody(request, maxBytes = 32000) {
  try { return { value: await bodyJson(request, maxBytes), error: null }; }
  catch (e) { return { value: null, error: fail(e.message === "payload_too_large" ? 413 : 400, e.message) }; }
}

// ---------------------------------------------------------------------------
// الاقتصاد التعليمي: دفتر نقاط غير قابل للحذف + متجر.
// نقاط الإنجاز مؤشر تراكمي، ورصيد المتجر هو ما يُصرف فقط.
// ---------------------------------------------------------------------------
const POINT_KINDS = ["achievement", "store"];
const POINT_KIND_LABELS = { achievement: "رصيد النقاط", store: "حركة نقاط" };
const MAX_RULE_POINTS = 100000;
const MAX_MANUAL_POINTS = 1000;

async function pointsTotals(env, studentId) {
  const row = await env.DB.prepare(
    "WITH grouped AS (SELECT event_key,MAX(CASE WHEN kind='achievement' THEN points END) AS achievement_points,MAX(CASE WHEN kind='store' AND event_type<>'store_redemption' THEN points END) AS store_points FROM point_events WHERE student_id=? AND reversed_at IS NULL AND event_type<>'store_redemption' GROUP BY event_key), redeemed AS (SELECT COALESCE(SUM(points),0) AS spent FROM point_events WHERE student_id=? AND reversed_at IS NULL AND event_type='store_redemption' AND kind='store') SELECT COALESCE(SUM(MAX(COALESCE(achievement_points,-100000),COALESCE(store_points,-100000))),0)+(SELECT spent FROM redeemed) AS balance FROM grouped"
  ).bind(studentId,studentId).first();
  const balance=Number(row?.balance||0); return { achievement: balance, store: balance, balance };
}

function storeItemAvailability(item, balance) {
  const stock = item.stock === null || item.stock === undefined ? null : Number(item.stock);
  const maxPerStudent = item.max_per_student === null || item.max_per_student === undefined ? null : Number(item.max_per_student);
  const used = Number(item.used || 0);
  const soldOut = stock !== null && stock <= 0;
  const maxed = maxPerStudent !== null && used >= maxPerStudent;
  const cost = Number(item.cost) || 0;
  return {
    sold_out: soldOut,
    maxed,
    eligible: !soldOut && !maxed,
    used,
    missing: Math.max(0, cost - Number(balance || 0))
  };
}
function storeRecommendationPayload(items, balance) {
  const active = (items || []).filter(item => Number(item.active) !== 0);
  const decorated = active.map(item => ({ ...item, ...storeItemAvailability(item, balance) }));
  const eligible = decorated.filter(item => item.eligible);
  const affordable = eligible.filter(item => Number(item.cost) <= Number(balance || 0)).sort((a, b) => Number(b.cost) - Number(a.cost));
  const locked = eligible.filter(item => Number(item.cost) > Number(balance || 0)).sort((a, b) => Number(a.cost) - Number(b.cost));
  const nearest = locked[0] || null;
  const publicItem = item => ({
    id: item.id, name: item.name, description: item.description, icon: item.icon,
    cost: Number(item.cost), stock: item.stock, max_per_student: item.max_per_student,
    used: Number(item.used || 0)
  });
  return {
    balance: Number(balance || 0),
    empty: active.length === 0,
    affordable: affordable.map(publicItem),
    locked: locked.map(publicItem),
    nearest: nearest ? { ...publicItem(nearest), missing: Number(nearest.cost) - Number(balance || 0), progress: Math.min(100, Math.round(Number(balance || 0) / Math.max(1, Number(nearest.cost)) * 100)) } : null,
    sold_out: decorated.filter(item => item.sold_out).map(item => item.name),
    maxed: decorated.filter(item => item.maxed).map(item => item.name)
  };
}

async function insertPointEvent(env, event) {
  const id = event.id || uuid();
  const result = await env.DB.prepare(
    "INSERT OR IGNORE INTO point_events (id,student_id,group_id,rule_id,event_type,kind,points,reason,event_key,awarded_date,source_collection,source_id,awarded_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)"
  ).bind(id, event.student_id, event.group_id || null, event.rule_id || null, event.event_type, event.kind, event.points, event.reason || "", event.event_key, event.awarded_date, event.source_collection || null, event.source_id || null, event.awarded_by || null).run();
  return { id, inserted: Number(result?.meta?.changes || 0) > 0 };
}

async function awardPointsForEvent(env, options) {
  const { studentId, groupId, eventType, eventKey, date, reason, sourceCollection, sourceId, awardedBy } = options;
  const student = await env.DB.prepare("SELECT id,group_id FROM students WHERE id=? AND active=1").bind(studentId).first();
  if (!student) return [];
  const rule = await env.DB.prepare("SELECT * FROM point_rules WHERE event_type=? AND active=1 AND auto_award=1").bind(eventType).first();
  if (!rule) return [];
  const results = [];
  for (const kind of POINT_KINDS) {
    const override = kind === "achievement" ? options.achievementPoints : options.storePoints;
    const baseAmount = Number(override !== undefined && override !== null ? override : (kind === "achievement" ? rule.achievement_points : rule.store_points));
    const amount = Number(rule.bonus_percent)>0 ? Math.round(baseAmount*(1+Number(rule.bonus_percent)/100)) : baseAmount;
    if (!Number.isFinite(amount) || amount <= 0) continue;
    if (rule.max_per_day !== null && rule.max_per_day !== undefined) {
      const used = await env.DB.prepare("SELECT COUNT(*) AS n FROM point_events WHERE student_id=? AND event_type=? AND kind=? AND awarded_date=? AND reversed_at IS NULL").bind(studentId, eventType, kind, date).first();
      if (Number(used?.n || 0) >= Number(rule.max_per_day)) { results.push({ kind, status: "capped", points: amount }); continue; }
    }
    const inserted = await insertPointEvent(env, { student_id: studentId, group_id: student.group_id || groupId || null, rule_id: rule.id, event_type: eventType, kind, points: amount, reason: reason || rule.name, event_key: eventKey, awarded_date: date, source_collection: sourceCollection, source_id: sourceId, awarded_by: awardedBy });
    results.push({ kind, status: inserted.inserted ? "awarded" : "duplicate", points: amount, id: inserted.id });
  }
  return results;
}

async function awardAttendancePoints(env, { groupId, date, studentIds, awardedBy }) {
  if (!Array.isArray(studentIds) || !studentIds.length) return 0;
  const rule = await env.DB.prepare("SELECT * FROM point_rules WHERE event_type='attendance_present' AND active=1 AND auto_award=1").first();
  if (!rule) return 0;
  const statements = [];
  for (const studentId of new Set(studentIds.map(String))) {
    const eventKey = "attendance:" + date + ":" + studentId;
    for (const kind of POINT_KINDS) {
      const amount = Number(kind === "achievement" ? rule.achievement_points : rule.store_points);
      if (!Number.isFinite(amount) || amount <= 0) continue;
      statements.push(env.DB.prepare("INSERT OR IGNORE INTO point_events (id,student_id,group_id,rule_id,event_type,kind,points,reason,event_key,awarded_date,source_collection,source_id,awarded_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(uuid(), studentId, groupId, rule.id, "attendance_present", kind, amount, rule.name, eventKey, date, "attendance", date + ":" + studentId, awardedBy || null));
    }
  }
  if (statements.length) await env.DB.batch(statements);
  return statements.length;
}

async function resolvePointStudent(env, user, studentId) {
  if (user.role === "student") {
    if (!user.student_id) return { error: fail(403, "حساب الطالب غير مرتبط بملف طالب") };
    if (studentId && studentId !== user.student_id) return { error: fail(403, "لا يمكنك عرض نقاط طالب آخر") };
    const row = await env.DB.prepare("SELECT s.id,s.display_name,s.group_id,g.name AS group_name FROM students s LEFT JOIN groups g ON g.id=s.group_id WHERE s.id=? AND s.active=1").bind(user.student_id).first();
    if (!row) return { error: fail(404, "ملف الطالب غير موجود") };
    return { row };
  }
  if (!["admin", "teacher", "director", "supervisor"].includes(user.role)) return { error: fail(403, "غير مسموح") };
  if (!studentId) return { error: fail(400, "حدّد الطالب") };
  const row = await env.DB.prepare("SELECT s.id,s.display_name,s.group_id,g.name AS group_name FROM students s LEFT JOIN groups g ON g.id=s.group_id WHERE s.id=? AND s.active=1").bind(studentId).first();
  if (!row) return { error: fail(404, "ملف الطالب غير موجود") };
  if (!await canManageGroup(env, user, row.group_id)) return { error: fail(403, "هذا الطالب خارج صلاحيتك") };
  return { row };
}

// ---------------------------------------------------------------------------
// V71: بطاقة الطالب بثلاثة رموز QR مستقلة، عالم المهام، وحدّ المعدل.
// البطاقة تُحفظ في academy_records (collection=student_cards) بلا جدول جديد،
// ومعرّفها هو معرّف الطالب حتى تبقى بطاقة واحدة لكل طالب ولا تتكرر.
// كل رمز سرّي محدود الأجل؛ نُخزّن بصمته للتحقق ونُبقي السرّ لطباعة البطاقة.
// ---------------------------------------------------------------------------
const CARD_KINDS = {
  add_points: { label: "إضافة نقاط", ttlDays: 90, requiresAuth: true },
  profile: { label: "الملف الشخصي", ttlDays: 365, requiresAuth: true },
  login: { label: "الدخول السريع", ttlDays: 365, requiresAuth: false }
};
const CARD_KIND_ORDER = ["add_points", "profile", "login"];
const CARD_SECRET_BYTES = 24;
const cardSecret = () => hex(crypto.getRandomValues(new Uint8Array(CARD_SECRET_BYTES)));
const cardExpiry = days => new Date(Date.now() + Number(days) * 86400000).toISOString();
const cardActive = token => Boolean(token) && !token.revoked_at && (!token.expires_at || token.expires_at > nowIso());

async function cardRecord(env, cardId) {
  const id = clean(cardId, 80);
  if (!id) return null;
  const row = await env.DB.prepare("SELECT payload_json FROM academy_records WHERE collection='student_cards' AND (id=? OR student_id=?) ORDER BY CASE WHEN id=? THEN 0 ELSE 1 END LIMIT 1").bind(id,id,id).first();
  if (!row) return null;
  try { return JSON.parse(row.payload_json); } catch { return null; }
}
async function ensureStudentCard(env, student, actorId = null) {
  if (!student?.id) throw new Error("student_card_requires_student_id");
  let card = await cardRecord(env, student.id);
  const created = !card;
  if (!card) card = { id: student.id, student_id: student.id, group_id: student.group_id || null, name: student.name || student.display_name || "", created_by: actorId, created_at: nowIso(), updated_at: nowIso(), tokens: {} };
  // Immutable student ID is the identity key; names are display data only.
  card = { ...card, id: student.id, student_id: student.id, group_id: student.group_id || null, name: student.name || student.display_name || card.name || "" };
  for (const kind of CARD_KIND_ORDER) {
    if (!card.tokens?.[kind] || !cardActive(card.tokens[kind]) || !card.tokens[kind].secret) card = await issueCardToken(card, kind);
  }
  await saveRecord(env, "student_cards", card);
  return { card, created };
}
function cardPublic(card) {
  const tokens = {};
  for (const kind of CARD_KIND_ORDER) {
    const token = card?.tokens?.[kind];
    tokens[kind] = {
      kind,
      label: CARD_KINDS[kind].label,
      issued_at: token?.issued_at || null,
      expires_at: token?.expires_at || null,
      revoked_at: token?.revoked_at || null,
      active: cardActive(token)
    };
  }
  return { id: card.id, student_id: card.student_id, group_id: card.group_id, name: card.name, created_at: card.created_at, updated_at: card.updated_at, tokens };
}
async function issueCardToken(card, kind) {
  const secret = cardSecret();
  const now = nowIso();
  const tokens = { ...(card.tokens || {}) };
  tokens[kind] = { hash: await hashToken(secret), secret, issued_at: now, expires_at: cardExpiry(CARD_KINDS[kind].ttlDays), revoked_at: null };
  return { ...card, tokens, updated_at: now };
}
function cardLinks(card, origin) {
  const base = String(origin || "").replace(/\/+$/, "");
  const links = {};
  for (const kind of CARD_KIND_ORDER) {
    const token = card?.tokens?.[kind];
    if (!cardActive(token) || !token.secret) continue;
    links[kind] = base + "/#scan=" + kind + "." + card.id + "." + token.secret;
  }
  return links;
}
async function verifyCardToken(card, kind, secret) {
  const token = card?.tokens?.[kind];
  if (!CARD_KINDS[kind] || !cardActive(token)) return false;
  const value = String(secret || "");
  if (!/^[a-f0-9]{32,64}$/i.test(value)) return false;
  return (await hashToken(value)) === token.hash;
}
async function studentCardRow(env, studentId) {
  return env.DB.prepare("SELECT s.id,s.display_name AS name,s.group_id,g.name AS group_name,u.identity_normalized AS username FROM students s LEFT JOIN groups g ON g.id=s.group_id LEFT JOIN users u ON u.id=s.user_id WHERE s.id=? AND s.active=1").bind(studentId).first();
}
async function canAccessStudentCard(env, user, student) {
  if (!user || !student) return false;
  if (user.role === "admin") return true;
  if (user.role === "student") return user.student_id === student.id;
  if (["teacher", "director", "supervisor"].includes(user.role)) return canManageGroup(env, user, student.group_id);
  return false;
}

// حدّ المعدل: جدول صغير مستقل، ويُسمح بالمرور إن لم يكن الجدول موجودًا بعد
// حتى لا يتعطل العمل الحقيقي قبل تطبيق الترحيل 0008.
const RATE_LIMIT_SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS rate_limits (
    bucket TEXT NOT NULL,
    key TEXT NOT NULL,
    window_start INTEGER NOT NULL,
    hits INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    PRIMARY KEY (bucket, key, window_start)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON rate_limits(window_start)`
];
let rateLimitSchemaReady = null;
async function ensureRateLimitSchema(env) {
  if (rateLimitSchemaReady) return rateLimitSchemaReady;
  rateLimitSchemaReady = (async () => {
    for (const statement of RATE_LIMIT_SCHEMA_STATEMENTS) await env.DB.prepare(statement).run();
    return true;
  })().catch(error => { rateLimitSchemaReady = null; throw error; });
  return rateLimitSchemaReady;
}
async function rateLimit(env, bucket, key, limit, windowSeconds) {
  const max = Math.max(1, Number(limit) || 1), seconds = Math.max(1, Number(windowSeconds) || 60);
  try {
    await ensureRateLimitSchema(env);
    const now = Date.now(), windowMs = seconds * 1000, windowStart = Math.floor(now / windowMs) * windowMs;
    const row = await env.DB.prepare("INSERT INTO rate_limits (bucket,key,window_start,hits,updated_at) VALUES (?,?,?,1,?) ON CONFLICT(bucket,key,window_start) DO UPDATE SET hits=hits+1,updated_at=excluded.updated_at RETURNING hits").bind(bucket, key, windowStart, nowIso()).first();
    const hits = Number(row?.hits || 1);
    return { allowed: hits <= max, degraded: false, hits, limit: max, retry_after: Math.max(1, Math.ceil((windowStart + windowMs - now) / 1000)) };
  } catch {
    return { allowed: true, degraded: true, hits: 0, limit: max, retry_after: 0 };
  }
}
const rateLimitKey = request => clean(request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "unknown", 120) || "unknown";

// عالم المهام: قصص ومراحل تُشتق من أعمال حقيقية مسجّلة، ومهام يومية تُستلم
// مرة واحدة عبر محرك النقاط الموجود (event_type=mission_side) بلا محفظة جديدة.
const MISSION_STORY = [
  { id: "story-seed", title: "البذرة", icon: "🌱", text: "سجّل أول ورد قراءة.", metric: "reading_days", target: 1 },
  { id: "story-steadfast", title: "الثبات", icon: "🌿", text: "حافظ على سلسلة قراءة سبعة أيام.", metric: "reading_streak", target: 7 },
  { id: "story-listener", title: "المتعلّم", icon: "📖", text: "سجّل عشرة دروس حفظ أو مراجعة.", metric: "quran_entries", target: 10 },
  { id: "story-present", title: "المواظب", icon: "🕌", text: "احضر خمس حلقات.", metric: "attendance_days", target: 5 },
  { id: "story-light", title: "النور", icon: "✨", text: "اجمع 500 نقطة إنجاز من أعمال حقيقية.", metric: "achievement", target: 500 }
];
const MISSION_SIDE = [
  { id: "side-attendance", title: "حاضر اليوم", icon: "✓", text: "سجّل حضورك في حلقتك اليوم.", metric: "attendance_today" },
  { id: "side-quran", title: "ورد القرآن", icon: "۞", text: "أضف حفظًا أو مراجعة اليوم.", metric: "quran_today" },
  { id: "side-reading", title: "قراءة وتدبّر", icon: "📖", text: "سجّل ورد قراءتك اليوم.", metric: "reading_today" },
  { id: "side-challenge", title: "تحدي اليوم", icon: "★", text: "استلم تحدي اليوم من عالمك.", metric: "challenge_today" }
];
const MISSION_COLLECTIBLES = [
  { id: "collectible-seed", title: "بذرة الإحسان", icon: "🌱", story: "story-seed" },
  { id: "collectible-light", title: "نور الورد", icon: "✨", story: "story-light" },
  { id: "collectible-heart", title: "قلب مواظب", icon: "🕌", story: "story-present" },
  { id: "collectible-book", title: "رفيق المصحف", icon: "📖", story: "story-listener" }
];
async function studentMissionFacts(env, studentId) {
  const today = academyDate();
  const [attendanceRows, quranRows, readingRows, challenge, totals] = await Promise.all([
    records(env, "attendance", " AND student_id=?", [studentId]),
    records(env, "quran_progress", " AND student_id=?", [studentId]),
    records(env, "reading_log", " AND student_id=?", [studentId]),
    env.DB.prepare("SELECT COUNT(*) AS n FROM point_events WHERE student_id=? AND event_type='daily_challenge' AND awarded_date=? AND reversed_at IS NULL").bind(studentId, today).first(),
    pointsTotals(env, studentId)
  ]);
  const attendanceDays = new Set(attendanceRows.filter(row => row.status === "present" && row.date).map(row => row.date)).size;
  const readingDays = new Set(readingRows.map(row => String(row.day || "")).filter(Boolean));
  let readingStreak = 0;
  for (let i = 0; i < 400; i += 1) { const day = academyDate(new Date(Date.now() - i * 86400000)); if (!readingDays.has(day)) break; readingStreak += 1; }
  return {
    today,
    attendance_today: attendanceRows.some(row => row.date === today && row.status === "present"),
    quran_today: quranRows.some(row => row.date === today),
    reading_today: readingDays.has(today),
    challenge_today: Number(challenge?.n || 0) > 0,
    attendance_days: attendanceDays,
    quran_entries: quranRows.length,
    reading_days: readingDays.size,
    reading_streak: readingStreak,
    achievement: Number(totals.achievement || 0)
  };
}
async function missionPayload(env, studentId) {
  const facts = await studentMissionFacts(env, studentId);
  const claimRow = await env.DB.prepare("SELECT payload_json FROM academy_records WHERE collection='student_missions' AND id=?").bind(studentId).first();
  let claims = {};
  if (claimRow) { try { claims = JSON.parse(claimRow.payload_json).claims || {}; } catch { claims = {}; } }
  const story = MISSION_STORY.map(mission => {
    const value = Number(facts[mission.metric] || 0);
    const progress = Math.min(100, Math.round(value / Math.max(1, mission.target) * 100));
    return { ...mission, value, progress, done: value >= mission.target };
  });
  const side = MISSION_SIDE.map(mission => {
    const done = Boolean(facts[mission.metric]);
    return { ...mission, done, claimed: Boolean(claims[mission.id]), claimable: done && !claims[mission.id] };
  });
  return {
    today: facts.today,
    story,
    side,
    badges: story.filter(mission => mission.done).map(mission => ({ id: mission.id, title: mission.title, icon: mission.icon })),
    collectibles: MISSION_COLLECTIBLES.map(item => ({ ...item, unlocked: Boolean(story.find(mission => mission.id === item.story && mission.done)) })),
    stats: { attendance_days: facts.attendance_days, quran_entries: facts.quran_entries, reading_days: facts.reading_days, reading_streak: facts.reading_streak, achievement: facts.achievement },
    bonus_rule: await env.DB.prepare("SELECT name,achievement_points,store_points,active FROM point_rules WHERE event_type='mission_side'").first()
  };
}

const TASK_TYPE_LABELS = { assignment: "واجب", memorization: "حفظ", revision: "مراجعة", attendance: "حضور", behavior: "سلوك" };const TASK_STATUS_LABELS = { pending: "مطلوب", submitted: "بانتظار التصحيح", done: "منجز", late: "متأخر" };
const CONTENT_KINDS = { hadith: "hadith_items", mutoon: "mutoon_items", duas: "dua_items", adhkar: "adhkar_items" };
const CONTENT_STATUSES = ["draft", "needs_source", "pending_review", "approved", "published", "archived"];
const CONTENT_ATTRIBUTIONS = {
  verbatim: "نقل كما هو",
  light_edit: "نقل بتصرف يسير",
  summary: "تلخيص من كلام المؤلف",
  academy: "شرح أو صياغة تربوية من الأكاديمية",
  multi_source: "إضافة من مصادر متعددة"
};
const DUAS_SEED = [
  {kind:"duas",title:"دعاء خيري الدنيا والآخرة",text:"رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ",source:"القرآن الكريم",reference:"سورة البقرة، الآية 201",attribution:"verbatim"},
  {kind:"duas",title:"دعاء الثبات على الهداية",text:"رَبَّنَا لَا تُزِغْ قُلُوبَنَا بَعْدَ إِذْ هَدَيْتَنَا وَهَبْ لَنَا مِنْ لَدُنْكَ رَحْمَةً إِنَّكَ أَنْتَ الْوَهَّابُ",source:"القرآن الكريم",reference:"سورة آل عمران، الآية 8",attribution:"verbatim"},
  {kind:"duas",title:"دعاء العلم النافع والرزق الطيب",text:"اللَّهُمَّ إِنِّي أَسْأَلُكَ عِلْمًا نَافِعًا، وَرِزْقًا طَيِّبًا، وَعَمَلًا مُتَقَبَّلًا",source:"سنن ابن ماجه",reference:"حديث 925",grade:"حسن",attribution:"verbatim"},
  {kind:"duas",title:"دعاء العون على الذكر والشكر",text:"اللَّهُمَّ أَعِنِّي عَلَى ذِكْرِكَ وَشُكْرِكَ وَحُسْنِ عِبَادَتِكَ",source:"سنن أبي داود",reference:"حديث 1522، وصححه الألباني",grade:"صحيح",attribution:"verbatim"},
  {kind:"duas",title:"دعاء تثبيت القلب على الدين",text:"يَا مُقَلِّبَ الْقُلُوبِ ثَبِّتْ قَلْبِي عَلَى دِينِكَ",source:"جامع الترمذي",reference:"حديث 2140، قال الترمذي: حسن",grade:"حسن",attribution:"verbatim"},
  {kind:"adhkar",title:"تسبيح الصباح والمساء",text:"سُبْحَانَ اللَّهِ وَبِحَمْدِهِ",source:"صحيح مسلم",reference:"حديث 2691",grade:"صحيح",attribution:"verbatim"},
  {kind:"adhkar",title:"ذكر التوحيد في الصباح والمساء",text:"لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ، وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ",source:"صحيح البخاري وصحيح مسلم",reference:"البخاري 3293، مسلم 2691",grade:"صحيح",attribution:"verbatim"},
  {kind:"adhkar",title:"الاستعاذة بكلمات الله التامات",text:"أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّاتِ مِنْ شَرِّ مَا خَلَقَ",source:"صحيح مسلم",reference:"حديث 2709",grade:"صحيح",attribution:"verbatim"},
  {kind:"adhkar",title:"ذكر الحفظ من الضرر",text:"بِسْمِ اللَّهِ الَّذِي لَا يَضُرُّ مَعَ اسْمِهِ شَيْءٌ فِي الْأَرْضِ وَلَا فِي السَّمَاءِ، وَهُوَ السَّمِيعُ الْعَلِيمُ",source:"سنن أبي داود وجامع الترمذي",reference:"أبو داود 5088، الترمذي 3388، وصححه الألباني",grade:"صحيح",attribution:"verbatim"}
];
const GLOBAL_CHIEF_COLLECTION = "student_chief_supervisors";
async function isGlobalChiefStudent(env, studentId) {
  if (!studentId) return false;
  const row = await env.DB.prepare("SELECT payload_json FROM academy_records WHERE collection=? AND id=?").bind(GLOBAL_CHIEF_COLLECTION, String(studentId)).first();
  if (!row) return false;
  try { const value = JSON.parse(row.payload_json); return value.active !== false; } catch { return false; }
}

// 0004_learning_economy is applied here as an additive, idempotent safety net.
// It only creates missing tables/indexes and seeds the default rules; it never
// alters or deletes existing data. The formal migration remains the source of
// truth, and running both is safe.
const LEARNING_SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS point_rules (
    id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    achievement_points INTEGER NOT NULL DEFAULT 0 CHECK (achievement_points >= 0 AND achievement_points <= 100000),
    store_points INTEGER NOT NULL DEFAULT 0 CHECK (store_points >= 0 AND store_points <= 100000),
    max_per_day INTEGER CHECK (max_per_day IS NULL OR (max_per_day >= 1 AND max_per_day <= 1000)),
    auto_award INTEGER NOT NULL DEFAULT 1 CHECK (auto_award IN (0, 1)),
    active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_point_rules_active_order ON point_rules(active, sort_order)`,
  `INSERT OR IGNORE INTO point_rules (id,event_type,name,description,achievement_points,store_points,max_per_day,auto_award,active,sort_order) VALUES
    ('rule-attendance-present','attendance_present','حضور حاضر','تُمنح عند تسجيل الطالب حاضرًا في الحضور اليومي.',5,2,1,1,1,10),
    ('rule-quran-entry','quran_entry','متابعة قرآنية','تُمنح عند إضافة متابعة حفظ أو مراجعة أو تسميع جديدة.',10,5,3,1,1,20),
    ('rule-assignment-reviewed','assignment_reviewed','مراجعة واجب','تُمنح عند اعتماد مراجعة تسليم الواجب.',10,5,5,1,1,30),
    ('rule-assignment-excellent','assignment_excellent','إتقان واجب','تُمنح عند اعتماد مراجعة تسليم بدرجة إتقان (80% فأكثر).',20,10,5,1,1,31),
    ('rule-test-completed','test_completed','إكمال اختبار','تُمنح عند إكمال اختبار ونشره في السجل.',10,5,3,1,1,40),
    ('rule-daily-challenge','daily_challenge','تحدي اليوم','تُمنح عند استلام تحدي اليوم.',5,5,1,1,1,50),
    ('rule-quran-reading','quran_reading','قراءة وتدبّر','تُمنح عند تسجيل ورد قراءة يومي مرة واحدة.',5,2,1,1,1,55),
    ('rule-mission-side','mission_side','مهمة يومية','تُمنح عند استلام مهمة يومية مكتملة من عالم الطالب، مرة واحدة يوميًا.',5,2,1,1,1,60),
    ('rule-level-promote','level_promote','ترقية المستوى','تُمنح عند ترقية الطالب إلى المستوى التالي بقرار الشيخ (يدويًا مع سبب موثّق).',25,10,NULL,1,1,65)`,
  `CREATE TABLE IF NOT EXISTS point_events (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    group_id TEXT REFERENCES groups(id) ON DELETE SET NULL,
    rule_id TEXT REFERENCES point_rules(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('achievement','store')),
    points INTEGER NOT NULL CHECK (points <> 0 AND points >= -100000 AND points <= 100000),
    reason TEXT NOT NULL DEFAULT '',
    event_key TEXT NOT NULL,
    awarded_date TEXT NOT NULL,
    source_collection TEXT,
    source_id TEXT,
    awarded_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    reversed_at TEXT,
    reversed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    reversal_reason TEXT
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_point_events_unique_event ON point_events(kind, event_key)`,
  `CREATE INDEX IF NOT EXISTS idx_point_events_student_date ON point_events(student_id, awarded_date)`,
  `CREATE INDEX IF NOT EXISTS idx_point_events_group_date ON point_events(group_id, awarded_date)`,
  `CREATE INDEX IF NOT EXISTS idx_point_events_dedupe ON point_events(student_id, event_type, kind, awarded_date)`,
  `CREATE TABLE IF NOT EXISTS store_items (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    icon TEXT NOT NULL DEFAULT '🎁',
    image_url TEXT,
    cost INTEGER NOT NULL CHECK (cost >= 1 AND cost <= 100000),
    stock INTEGER CHECK (stock IS NULL OR stock >= 0),
    max_per_student INTEGER CHECK (max_per_student IS NULL OR max_per_student >= 1),
    active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_store_items_active_order ON store_items(active, sort_order)`,
  `CREATE TABLE IF NOT EXISTS store_redemptions (
    id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL REFERENCES store_items(id) ON DELETE RESTRICT,
    item_name TEXT NOT NULL,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    group_id TEXT REFERENCES groups(id) ON DELETE SET NULL,
    cost INTEGER NOT NULL CHECK (cost >= 1),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','fulfilled','cancelled')),
    note TEXT NOT NULL DEFAULT '',
    requested_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    decided_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    decided_at TEXT,
    decision_note TEXT NOT NULL DEFAULT '',
    debit_event_id TEXT REFERENCES point_events(id) ON DELETE SET NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_store_redemptions_student ON store_redemptions(student_id, requested_at)`,
  `CREATE INDEX IF NOT EXISTS idx_store_redemptions_group ON store_redemptions(group_id, requested_at)`,
  `CREATE INDEX IF NOT EXISTS idx_store_redemptions_status ON store_redemptions(status, requested_at)`,
  `INSERT OR IGNORE INTO point_rules (id,event_type,name,description,achievement_points,store_points,max_per_day,auto_award,active,sort_order) VALUES
    ('rule-fajr','fajr','صلاة الفجر','تُعتمد بعد التحقق من الحضور.',30,30,1,1,1,5),
    ('rule-shuruq','shuruq','صلاة الشروق','تُعتمد بعد التحقق من الحضور.',20,20,1,1,1,6),
    ('rule-maghrib','maghrib','صلاة المغرب','تُعتمد بعد التحقق من الحضور.',10,10,1,1,1,7),
    ('rule-hifz-no-errors','hifz_no_errors','حفظ ثمن دون أخطاء','ثلاثون نقطة بدل نقاط الحفظ الأساسية.',30,30,1,1,1,8),
    ('rule-hifz-tajweed','hifz_tajweed','حفظ ثمن بالتجويد','خمس وعشرون نقطة بدل نقاط الحفظ الأساسية.',25,25,1,1,1,9),
    ('rule-poetry','poetry','أربعة أبيات','كل أربعة أبيات بخمسة نقاط.',5,5,1,1,1,10),
    ('rule-support-others','support_others','دعم الآخرين','زيادة ثلاثين بالمئة على الإنجاز المعتمد.',1,1,1,1,1,11)`,
  `UPDATE point_rules SET name='قراءة حزب',description='عشر نقاط للحزب المقروء.',achievement_points=10,store_points=10,max_per_day=1,auto_award=1,active=1 WHERE event_type='quran_reading'`,
  `UPDATE point_rules SET active=1,auto_award=1,achievement_points=30,store_points=30,max_per_day=1 WHERE event_type='attendance_present'`,
  `UPDATE point_rules SET active=1,auto_award=1,achievement_points=20,store_points=20,max_per_day=1,description='عشرون نقطة للحفظ المعتمد.' WHERE event_type IN ('hifz_no_errors','hifz_tajweed')`,
  `UPDATE point_rules SET active=0,auto_award=0 WHERE event_type='quran_entry'`,
  `CREATE TABLE IF NOT EXISTS student_point_streaks (
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    activity TEXT NOT NULL CHECK(activity IN ('hifz','fajr','shuruq')),
    current_days INTEGER NOT NULL DEFAULT 0,
    last_date TEXT,
    awarded_milestones TEXT NOT NULL DEFAULT '[]',
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    PRIMARY KEY(student_id,activity)
  )`,
  `CREATE TABLE IF NOT EXISTS student_ethics (
    student_id TEXT PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
    warnings INTEGER NOT NULL DEFAULT 0 CHECK(warnings >= 0),
    multiplier_status TEXT NOT NULL DEFAULT 'active' CHECK(multiplier_status IN ('active','suspended','forfeited')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_by TEXT REFERENCES users(id) ON DELETE SET NULL
  )`,
  `CREATE TABLE IF NOT EXISTS student_referrals (
    id TEXT PRIMARY KEY,
    inviter_student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    invited_student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','rejected')),
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    confirmed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    confirmed_at TEXT,
    UNIQUE(inviter_student_id,invited_student_id)
  )`
];
let learningSchemaReady = null;
async function ensureLearningSchema(env) {
  if (learningSchemaReady) return learningSchemaReady;
  learningSchemaReady = (async () => {
    // Run the additive statements once per worker isolate. Every statement is
    // idempotent, and the rule seeds use INSERT OR IGNORE so new default rules
    // appear even when the economy tables were created by an earlier release.
    for (const statement of LEARNING_SCHEMA_STATEMENTS) await env.DB.prepare(statement).run();
    try { await env.DB.prepare("ALTER TABLE store_items ADD COLUMN image_url TEXT").run(); } catch {}
    try { await env.DB.prepare("ALTER TABLE point_rules ADD COLUMN bonus_percent INTEGER NOT NULL DEFAULT 0 CHECK (bonus_percent >= 0 AND bonus_percent <= 300)").run(); } catch {}
    await env.DB.prepare("UPDATE point_rules SET bonus_percent=30 WHERE event_type='support_others'").run();
    return true;
  })().catch(error => { learningSchemaReady = null; throw error; });
  return learningSchemaReady;
}

// 0005_quran_path is applied here as an additive, idempotent safety net too.
// It only creates missing tables/indexes; it never alters or deletes data.
const QURAN_SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS quran_paths (
    student_id TEXT PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
    group_id TEXT REFERENCES groups(id) ON DELETE SET NULL,
    hifz_plan TEXT NOT NULL DEFAULT 'plan_a' CHECK (hifz_plan IN ('plan_a','plan_b','plan_c')),
    hifz_amount TEXT NOT NULL DEFAULT '',
    hifz_unit TEXT NOT NULL DEFAULT 'سطر',
    hifz_category TEXT NOT NULL DEFAULT '15' CHECK (hifz_category IN ('15','30','45','60')),
    ward_ahzab INTEGER NOT NULL DEFAULT 1 CHECK (ward_ahzab IN (1,2,4)),
    rest_day INTEGER CHECK (rest_day IS NULL OR (rest_day >= 0 AND rest_day <= 6)),
    start_date TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
    updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  )`,
  `CREATE TABLE IF NOT EXISTS quran_daily (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    day TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('hifz','thabit','ward')),
    amount REAL NOT NULL DEFAULT 0 CHECK (amount >= 0),
    unit TEXT NOT NULL DEFAULT '',
    repetitions INTEGER NOT NULL DEFAULT 0 CHECK (repetitions >= 0 AND repetitions <= 100),
    linked_scope TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_quran_daily_unique ON quran_daily(student_id, day, kind)`,
  `CREATE INDEX IF NOT EXISTS idx_quran_daily_student_day ON quran_daily(student_id, day)`,
  `CREATE TABLE IF NOT EXISTS quran_pairs (
    id TEXT PRIMARY KEY,
    group_id TEXT REFERENCES groups(id) ON DELETE SET NULL,
    student_a TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    student_b TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    CHECK (student_a <> student_b)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_quran_pairs_a ON quran_pairs(student_a, active)`,
  `CREATE INDEX IF NOT EXISTS idx_quran_pairs_b ON quran_pairs(student_b, active)`,
  `CREATE TABLE IF NOT EXISTS quran_pair_sessions (
    id TEXT PRIMARY KEY,
    pair_id TEXT NOT NULL REFERENCES quran_pairs(id) ON DELETE CASCADE,
    day TEXT NOT NULL,
    reciter_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    listener_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    amount TEXT NOT NULL DEFAULT '',
    errors INTEGER NOT NULL DEFAULT 0 CHECK (errors >= 0 AND errors <= 10000),
    error_positions TEXT NOT NULL DEFAULT '',
    hesitations INTEGER NOT NULL DEFAULT 0 CHECK (hesitations >= 0 AND hesitations <= 10000),
    prompts INTEGER NOT NULL DEFAULT 0 CHECK (prompts >= 0 AND prompts <= 10000),
    minutes REAL NOT NULL DEFAULT 0 CHECK (minutes >= 0 AND minutes <= 1000),
    expected_minutes REAL NOT NULL DEFAULT 0 CHECK (expected_minutes >= 0 AND expected_minutes <= 1000),
    score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
    notes TEXT NOT NULL DEFAULT '',
    signed_reciter INTEGER NOT NULL DEFAULT 0 CHECK (signed_reciter IN (0,1)),
    signed_listener INTEGER NOT NULL DEFAULT 0 CHECK (signed_listener IN (0,1)),
    override_reason TEXT NOT NULL DEFAULT '',
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    CHECK (reciter_id <> listener_id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_quran_pair_sessions_pair_day ON quran_pair_sessions(pair_id, day)`,
  `CREATE TABLE IF NOT EXISTS quran_stations (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    stage TEXT NOT NULL CHECK (stage IN ('15','30','45','60')),
    scheduled_for TEXT NOT NULL,
    memorized_amount TEXT NOT NULL DEFAULT '',
    score INTEGER CHECK (score IS NULL OR (score >= 0 AND score <= 100)),
    errors INTEGER NOT NULL DEFAULT 0 CHECK (errors >= 0 AND errors <= 10000),
    notes TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','approved','rejected','cancelled')),
    approved_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    approved_at TEXT,
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_quran_stations_student ON quran_stations(student_id, scheduled_for)`,
  `CREATE TABLE IF NOT EXISTS quran_makeups (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('hifz','thabit','ward')),
    due_date TEXT NOT NULL,
    amount TEXT NOT NULL DEFAULT '',
    reason TEXT NOT NULL CHECK (reason IN ('shortcoming','interruption','incapacity','circumstance')),
    reason_note TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','planned','done','cancelled')),
    proposed_date TEXT,
    blocks_new INTEGER NOT NULL DEFAULT 0 CHECK (blocks_new IN (0,1)),
    completed_at TEXT,
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_quran_makeups_student ON quran_makeups(student_id, status, due_date)`
];
let quranSchemaReady = null;
async function ensureQuranSchema(env) {
  if (quranSchemaReady) return quranSchemaReady;
  quranSchemaReady = (async () => {
    for (const statement of QURAN_SCHEMA_STATEMENTS) await env.DB.prepare(statement).run();
    return true;
  })().catch(error => { quranSchemaReady = null; throw error; });
  return quranSchemaReady;
}

// 0006_competitions is applied here as an additive, idempotent safety net too.
// It reuses the existing users/students/groups and point_events tables.
const COMPETITION_SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS competition_categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    kind TEXT NOT NULL DEFAULT 'quran_hifz' CHECK (kind IN ('quran_hifz','quran_tilawa','quran_tajweed','hadith','mutoon','seerah','islamic_culture','other')),
    min_hizb INTEGER CHECK (min_hizb IS NULL OR (min_hizb >= 0 AND min_hizb <= 60)),
    max_hizb INTEGER CHECK (max_hizb IS NULL OR (max_hizb >= 1 AND max_hizb <= 60)),
    min_age INTEGER CHECK (min_age IS NULL OR (min_age >= 3 AND min_age <= 100)),
    max_age INTEGER CHECK (max_age IS NULL OR (max_age >= 3 AND max_age <= 100)),
    active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_competition_categories_active_order ON competition_categories(active, sort_order)`,
  `INSERT OR IGNORE INTO competition_categories (id,name,code,kind,min_hizb,max_hizb,min_age,max_age,active,sort_order) VALUES
    ('cat-hizb-15','15 حزبًا','hizb15','quran_hifz',0,15,NULL,NULL,1,10),
    ('cat-hizb-30','30 حزبًا','hizb30','quran_hifz',15,30,NULL,NULL,1,20),
    ('cat-hizb-45','45 حزبًا','hizb45','quran_hifz',30,45,NULL,NULL,1,30),
    ('cat-hizb-60','60 حزبًا','hizb60','quran_hifz',45,60,NULL,NULL,1,40),
    ('cat-general','عام','general','other',NULL,NULL,NULL,NULL,1,90)`,
  `CREATE TABLE IF NOT EXISTS competitions (
    id TEXT PRIMARY KEY,
    school_id TEXT,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    kind TEXT NOT NULL DEFAULT 'quran_hifz' CHECK (kind IN ('quran_hifz','quran_tilawa','quran_tajweed','hadith','mutoon','seerah','islamic_culture','other')),
    season TEXT NOT NULL DEFAULT 'general',
    category_id TEXT REFERENCES competition_categories(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','announced','registration','judging','results','honored','archived')),
    registration_starts_at TEXT,
    registration_ends_at TEXT,
    starts_at TEXT,
    ends_at TEXT,
    min_age INTEGER CHECK (min_age IS NULL OR (min_age >= 3 AND min_age <= 100)),
    max_age INTEGER CHECK (max_age IS NULL OR (max_age >= 3 AND max_age <= 100)),
    riwayat_json TEXT NOT NULL DEFAULT '[]',
    min_hizb INTEGER CHECK (min_hizb IS NULL OR (min_hizb >= 0 AND min_hizb <= 60)),
    max_hizb INTEGER CHECK (max_hizb IS NULL OR (max_hizb >= 1 AND max_hizb <= 60)),
    requires_approval INTEGER NOT NULL DEFAULT 0 CHECK (requires_approval IN (0,1)),
    max_participants INTEGER CHECK (max_participants IS NULL OR (max_participants >= 1 AND max_participants <= 100000)),
    rules TEXT NOT NULL DEFAULT '',
    judging_criteria_json TEXT NOT NULL DEFAULT '[]',
    awards_json TEXT NOT NULL DEFAULT '[]',
    participation_achievement INTEGER NOT NULL DEFAULT 0 CHECK (participation_achievement >= 0 AND participation_achievement <= 100000),
    participation_store INTEGER NOT NULL DEFAULT 0 CHECK (participation_store >= 0 AND participation_store <= 100000),
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_competitions_status_dates ON competitions(status, registration_starts_at, registration_ends_at)`,
  `CREATE INDEX IF NOT EXISTS idx_competitions_school ON competitions(school_id, status)`,
  `CREATE TABLE IF NOT EXISTS competition_registrations (
    id TEXT PRIMARY KEY,
    competition_id TEXT NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    group_id TEXT REFERENCES groups(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','withdrawn','disqualified')),
    age_at_registration INTEGER CHECK (age_at_registration IS NULL OR (age_at_registration >= 3 AND age_at_registration <= 100)),
    hizb_at_registration TEXT NOT NULL DEFAULT '',
    riwaya TEXT NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT '',
    registered_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    decided_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    decided_at TEXT,
    decision_note TEXT NOT NULL DEFAULT '',
    UNIQUE (competition_id, student_id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_competition_registrations_competition ON competition_registrations(competition_id, status)`,
  `CREATE INDEX IF NOT EXISTS idx_competition_registrations_student ON competition_registrations(student_id, registered_at)`,
  `CREATE INDEX IF NOT EXISTS idx_competition_registrations_group ON competition_registrations(group_id, status)`,
  `CREATE TABLE IF NOT EXISTS competition_judges (
    competition_id TEXT NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    PRIMARY KEY (competition_id, user_id)
  )`,
  `CREATE TABLE IF NOT EXISTS competition_scores (
    id TEXT PRIMARY KEY,
    competition_id TEXT NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
    registration_id TEXT NOT NULL REFERENCES competition_registrations(id) ON DELETE CASCADE,
    judge_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    criteria_json TEXT NOT NULL DEFAULT '[]',
    total REAL NOT NULL CHECK (total >= 0 AND total <= 100),
    note TEXT NOT NULL DEFAULT '',
    scored_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    UNIQUE (competition_id, registration_id, judge_user_id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_competition_scores_registration ON competition_scores(registration_id)`,
  `CREATE TABLE IF NOT EXISTS competition_results (
    id TEXT PRIMARY KEY,
    competition_id TEXT NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
    registration_id TEXT NOT NULL REFERENCES competition_registrations(id) ON DELETE CASCADE,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    group_id TEXT REFERENCES groups(id) ON DELETE SET NULL,
    final_score REAL CHECK (final_score IS NULL OR (final_score >= 0 AND final_score <= 100)),
    rank INTEGER CHECK (rank IS NULL OR rank >= 1),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','published')),
    award_achievement INTEGER NOT NULL DEFAULT 0 CHECK (award_achievement >= 0 AND award_achievement <= 100000),
    award_store INTEGER NOT NULL DEFAULT 0 CHECK (award_store >= 0 AND award_store <= 100000),
    award_event_achievement_id TEXT,
    award_event_store_id TEXT,
    note TEXT NOT NULL DEFAULT '',
    approved_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    approved_at TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    UNIQUE (competition_id, registration_id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_competition_results_competition ON competition_results(competition_id, rank, status)`,
  `CREATE INDEX IF NOT EXISTS idx_competition_results_student ON competition_results(student_id, status)`,
  `CREATE TABLE IF NOT EXISTS competition_events (
    id TEXT PRIMARY KEY,
    competition_id TEXT REFERENCES competitions(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    event_date TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'other' CHECK (kind IN ('announcement','registration','judging','result','honoring','other')),
    active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_competition_events_date ON competition_events(event_date, active)`,
  `CREATE TABLE IF NOT EXISTS competition_reference_terms (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL DEFAULT 'other' CHECK (kind IN ('quran_hifz','quran_tilawa','quran_tajweed','hadith','mutoon','seerah','islamic_culture','other')),
    title TEXT NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    source TEXT NOT NULL DEFAULT '',
    active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_competition_terms_kind ON competition_reference_terms(kind, active, sort_order)`,
  `INSERT OR IGNORE INTO competition_reference_terms (id,kind,title,body,source,active,sort_order) VALUES
    ('term-general-template','other','قالب شروط عام','تُكتب هنا شروط كل دورة واعتمادها من الإدارة قبل الإعلان. لا تُعتمد شروط دورة سابقة تلقائيًا.','قالب قابل للتعديل',1,10)`,
  `INSERT OR IGNORE INTO point_rules (id,event_type,name,description,achievement_points,store_points,max_per_day,auto_award,active,sort_order) VALUES
    ('rule-competition-award','competition_award','مكافأة مسابقة','تُمنح باعتماد نتائج المسابقة وبمقدار مخصّص لكل مرتبة.',0,0,NULL,1,1,60)`
];
let competitionSchemaReady = null;
async function ensureCompetitionSchema(env) {
  if (competitionSchemaReady) return competitionSchemaReady;
  competitionSchemaReady = (async () => {
    for (const statement of COMPETITION_SCHEMA_STATEMENTS) await env.DB.prepare(statement).run();
    const marker = await env.DB.prepare("SELECT id FROM academy_records WHERE collection='platform_settings' AND id='competition_legacy_import_v1'").first();
    if (!marker) {
      // Best-effort import of the previous JSON-shaped competitions. The old
      // rows are never deleted; this only makes them visible in the new model.
      await env.DB.prepare(`INSERT OR IGNORE INTO competitions (id,school_id,title,description,kind,season,category_id,status,registration_starts_at,registration_ends_at,starts_at,ends_at,created_by,created_at,updated_at,rules,judging_criteria_json,awards_json)
        SELECT id,NULL,COALESCE(NULLIF(json_extract(payload_json,'$.title'),''),'مسابقة سابقة'),COALESCE(json_extract(payload_json,'$.description'),''),'other','general',NULL,
        CASE json_extract(payload_json,'$.status') WHEN 'published' THEN 'registration' WHEN 'closed' THEN 'archived' ELSE 'draft' END,
        NULL,NULL,json_extract(payload_json,'$.starts_at'),json_extract(payload_json,'$.ends_at'),NULL,
        COALESCE(json_extract(payload_json,'$.created_at'),strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        COALESCE(json_extract(payload_json,'$.updated_at'),strftime('%Y-%m-%dT%H:%M:%fZ','now')),'','[]','[]'
        FROM academy_records WHERE collection='competitions'`).run();
      await env.DB.prepare(`INSERT OR IGNORE INTO competition_registrations (id,competition_id,student_id,group_id,status,note,registered_at)
        SELECT id,json_extract(payload_json,'$.competition_id'),student_id,group_id,
        CASE WHEN json_extract(payload_json,'$.score') IS NULL THEN 'pending' ELSE 'approved' END,
        COALESCE(json_extract(payload_json,'$.note'),''),
        COALESCE(json_extract(payload_json,'$.created_at'),strftime('%Y-%m-%dT%H:%M:%fZ','now'))
        FROM academy_records WHERE collection='competition_entries' AND json_extract(payload_json,'$.competition_id') IS NOT NULL AND student_id IS NOT NULL`).run();
      await env.DB.prepare(`INSERT OR IGNORE INTO competition_results (id,competition_id,registration_id,student_id,group_id,final_score,rank,status,note,created_at)
        SELECT 'legacy-'||id,json_extract(payload_json,'$.competition_id'),id,student_id,group_id,
        CASE WHEN CAST(json_extract(payload_json,'$.score') AS REAL) > 100 THEN ROUND(CAST(json_extract(payload_json,'$.score') AS REAL)/10.0,2) ELSE CAST(json_extract(payload_json,'$.score') AS REAL) END,
        NULL,'draft','مستورد من النظام السابق',
        COALESCE(json_extract(payload_json,'$.updated_at'),strftime('%Y-%m-%dT%H:%M:%fZ','now'))
        FROM academy_records WHERE collection='competition_entries' AND json_extract(payload_json,'$.score') IS NOT NULL`).run();
      await env.DB.prepare("INSERT OR IGNORE INTO academy_records (collection,id,payload_json,updated_at) VALUES ('platform_settings','competition_legacy_import_v1',?,?)").bind(JSON.stringify({ completed: true, at: nowIso() }), nowIso()).run();
    }
    return true;
  })().catch(error => { competitionSchemaReady = null; throw error; });
  return competitionSchemaReady;
}

const COMPETITION_KINDS = {
  quran_hifz: "مسابقة حفظ القرآن",
  quran_tilawa: "مسابقة الترتيل",
  quran_tajweed: "مسابقة التجويد",
  hadith: "مسابقة الحديث",
  mutoon: "مسابقة المتون",
  seerah: "مسابقة السيرة",
  islamic_culture: "مسابقة الثقافة الإسلامية",
  other: "مسابقة عامة"
};
const COMPETITION_STATUSES = {
  draft: "مسودة",
  announced: "معلنة",
  registration: "التسجيل مفتوح",
  judging: "التحكيم",
  results: "النتائج",
  honored: "التكريم",
  archived: "مؤرشفة"
};
const COMPETITION_STATUS_FLOW = {
  draft: ["announced"],
  announced: ["registration", "draft"],
  registration: ["judging", "announced"],
  judging: ["results", "registration"],
  results: ["honored", "judging"],
  honored: ["archived", "results"],
  archived: []
};
const COMPETITION_REGISTRATION_STATUSES = {
  pending: "بانتظار الاعتماد",
  approved: "معتمد",
  rejected: "مرفوض",
  withdrawn: "منسحب",
  disqualified: "مستبعد"
};
const COMPETITION_DEFAULT_CRITERIA = {
  quran_hifz: [
    { id: "hifz", label: "الحفظ والإتقان", max: 50 },
    { id: "adau", label: "الأداء والترتيل", max: 20 },
    { id: "tajweed", label: "التجويد", max: 15 },
    { id: "adab", label: "الوقار والالتزام", max: 15 }
  ],
  quran_tilawa: [
    { id: "tilawa", label: "صحة التلاوة", max: 50 },
    { id: "tajweed", label: "التجويد", max: 25 },
    { id: "sawt", label: "حسن الصوت", max: 15 },
    { id: "adab", label: "الوقار والالتزام", max: 10 }
  ],
  quran_tajweed: [
    { id: "ahkam", label: "تطبيق الأحكام", max: 50 },
    { id: "makharij", label: "المخارج والصفات", max: 25 },
    { id: "tamathul", label: "التمثّل في التلاوة", max: 15 },
    { id: "adab", label: "الوقار والالتزام", max: 10 }
  ],
  hadith: [
    { id: "hifz", label: "الحفظ والاستظهار", max: 50 },
    { id: "fahm", label: "الفهم والاستنباط", max: 25 },
    { id: "adau", label: "العرض والأداء", max: 15 },
    { id: "adab", label: "الأدب والالتزام", max: 10 }
  ],
  mutoon: [
    { id: "hifz", label: "حفظ المتن", max: 50 },
    { id: "fahm", label: "فهم المتن", max: 25 },
    { id: "adau", label: "العرض", max: 15 },
    { id: "adab", label: "الأدب والالتزام", max: 10 }
  ],
  seerah: [
    { id: "maarifa", label: "المعرفة والضبط", max: 50 },
    { id: "fahm", label: "الفهم والاستنباط", max: 25 },
    { id: "adau", label: "العرض", max: 15 },
    { id: "adab", label: "الأدب والالتزام", max: 10 }
  ],
  islamic_culture: [
    { id: "maarifa", label: "المعرفة والضبط", max: 50 },
    { id: "fahm", label: "الفهم والاستدلال", max: 25 },
    { id: "adau", label: "العرض", max: 15 },
    { id: "adab", label: "الأدب والالتزام", max: 10 }
  ],
  other: [
    { id: "maarifa", label: "المعرفة والإتقان", max: 50 },
    { id: "fahm", label: "الفهم", max: 25 },
    { id: "adau", label: "العرض", max: 15 },
    { id: "adab", label: "الأدب والالتزام", max: 10 }
  ]
};

function competitionDefaultCriteria(kind) {
  return (COMPETITION_DEFAULT_CRITERIA[kind] || COMPETITION_DEFAULT_CRITERIA.other).map(item => ({ ...item }));
}
function numberOrNull(value, min, max) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(min, Math.min(max, n));
}
function defaultCompetitionAwards() {
  // Default editable awards: top 3 only. Participation defaults to zero so no
  // points are given for mere attendance.
  return [
    { place: 1, label: "المرتبة الأولى", achievement: 100, store: 50 },
    { place: 2, label: "المرتبة الثانية", achievement: 70, store: 30 },
    { place: 3, label: "المرتبة الثالثة", achievement: 50, store: 20 }
  ];
}
function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  try { const parsed = JSON.parse(value || "[]"); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
}
function normalizeCompetitionCriteria(value, kind) {
  const rows = parseJsonArray(value);
  const source = rows.length ? rows : competitionDefaultCriteria(kind);
  const seen = new Set();
  return source.map((row, index) => {
    const id = clean(row && row.id, 40).replace(/[^a-z0-9_]/gi, "") || "criterion_" + (index + 1);
    if (seen.has(id)) return null;
    seen.add(id);
    const label = clean(row && row.label, 120) || "معيار " + (index + 1);
    const max = Number(row && row.max);
    if (!Number.isFinite(max) || max < 1 || max > 100) return null;
    return { id, label, max: Math.round(max * 100) / 100 };
  }).filter(Boolean).slice(0, 12);
}
function normalizeCompetitionAwards(value) {
  const rows = parseJsonArray(value);
  return rows.map((row, index) => {
    const place = Number(row && row.place);
    const achievement = Number(row && row.achievement);
    const store = Number(row && row.store);
    if (!Number.isInteger(place) || place < 1 || place > 100) return null;
    if (!Number.isFinite(achievement) || achievement < 0 || achievement > 100000) return null;
    if (!Number.isFinite(store) || store < 0 || store > 100000) return null;
    return { place, label: clean(row && row.label, 80) || "المرتبة " + place, achievement: Math.round(achievement), store: Math.round(store) };
  }).filter(Boolean).slice(0, 20);
}
function normalizeRiwayat(value) {
  const rows = parseJsonArray(value);
  return [...new Set(rows.map(item => clean(typeof item === "string" ? item : item && item.name, 60)).filter(Boolean))].slice(0, 20);
}
function competitionHizbValue(value) {
  const text = String(value || "").trim();
  const match = text.match(/\d{1,2}/);
  return match ? Number(match[0]) : null;
}

const QURAN_CATEGORIES = {
  "15": { label: "15 حزبًا", thabit: 0.125, thabitLabel: "ثمن حزب", workDays: 5 },
  "30": { label: "30 حزبًا", thabit: 0.25, thabitLabel: "ربع حزب", workDays: 5 },
  "45": { label: "45 حزبًا", thabit: 0.375, thabitLabel: "ثلاثة أثمان حزب", workDays: 5 },
  "60": { label: "60 حزبًا", thabit: 0.5, thabitLabel: "نصف حزب", workDays: 5 }
};
const QURAN_THABIT_PLANS = {
  "4": { thumns: 4, thabit: 0.5, label: "4 أثمان أسبوعياً", months: 8 },
  "8": { thumns: 8, thabit: 1.0, label: "8 أثمان أسبوعياً", months: 8 },
  "12": { thumns: 12, thabit: 1.5, label: "12 ثمناً أسبوعياً", months: 8 }
};
const QURAN_THABIT_REFERENCE_STATUS = "adopted (8-month program, approved by Sheikh)";
const QURAN_PLANS = { plan_a: "الخطة الأولى · المكثفة", plan_b: "الخطة الثانية · المتوسطة", plan_c: "الخطة الثالثة · المتدرجة" };
const QURAN_WARD = { 1: "حزب واحد", 2: "حزبان", 4: "أربعة أحزاب" };
const QURAN_KIND_LABELS = { hifz: "الحفظ الجديد", thabit: "التثبيت", ward: "الورد" };
const QURAN_MAKEUP_REASONS = { shortcoming: "تقصير", interruption: "انقطاع", incapacity: "عجز عن الإنجاز", circumstance: "ظرف يحتاج إلى معالجة" };
const QURAN_RUBRIC = { accuracy: 50, steady: 20, flow: 15, time: 15 };

function quranSessionScore({ errors = 0, hesitations = 0, prompts = 0, minutes = 0, expected_minutes = 0 }) {
  const safe = value => Math.max(0, Number(value) || 0);
  const accuracy = Math.max(0, QURAN_RUBRIC.accuracy - Math.min(QURAN_RUBRIC.accuracy, safe(errors) * 2));
  const steady = Math.max(0, QURAN_RUBRIC.steady - Math.min(QURAN_RUBRIC.steady, safe(hesitations) * 2));
  const flow = Math.max(0, QURAN_RUBRIC.flow - Math.min(QURAN_RUBRIC.flow, safe(prompts) * 3));
  let time = QURAN_RUBRIC.time;
  if (safe(expected_minutes) > 0 && safe(minutes) > safe(expected_minutes)) {
    const over = (safe(minutes) - safe(expected_minutes)) / safe(expected_minutes);
    time = Math.max(0, QURAN_RUBRIC.time - Math.ceil(over * QURAN_RUBRIC.time));
  }
  const total = Math.max(0, Math.min(100, Math.round(accuracy + steady + flow + time)));
  return { accuracy, steady, flow, time, total };
}
function quranGrade(score) {
  const n = Number(score) || 0;
  if (n >= 95) return "متقن";
  if (n >= 85) return "ممتاز";
  if (n >= 75) return "جيد جدًا";
  if (n >= 60) return "جيد";
  return "يحتاج إلى تثبيت";
}
function quranDateISO(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  return match ? String(value) : "";
}
async function resolveQuranStudent(env, user, requestedId) {
  let studentId = clean(requestedId, 80);
  if (user.role === "student") {
    if (!user.student_id) return { error: fail(404, "حساب الطالب غير مرتبط بملف طالب") };
    if (!user.group_id) return { error: fail(403, "طلب انضمامك إلى المدرسة قيد الاعتماد؛ لن تظهر بيانات المسار والحفظ قبل اعتماد الشيخ طلبك وإسنادك إلى فوج") };
    if (studentId && studentId !== user.student_id) return { error: fail(403, "لا يمكنك الوصول إلى بيانات طالب آخر") };
    studentId = user.student_id;
  } else {
    if (!["admin", "teacher", "director", "supervisor"].includes(user.role)) return { error: fail(403, "غير مسموح") };
    if (!studentId) return { error: fail(400, "حدد الطالب") };
    const scoped = await env.DB.prepare("SELECT id,group_id FROM students WHERE id=? AND active=1").bind(studentId).first();
    if (!scoped) return { error: fail(404, "ملف الطالب غير موجود") };
    if (user.role !== "admin" && !await canManageGroup(env, user, scoped.group_id)) return { error: fail(403, "هذا الطالب خارج صلاحيتك") };
    return { student: scoped, staff: true };
  }
  const student = await env.DB.prepare("SELECT id,group_id FROM students WHERE id=? AND active=1").bind(studentId).first();
  if (!student) return { error: fail(404, "ملف الطالب غير موجود") };
  return { student, staff: false };
}
async function quranPathRow(env, studentId) {
  return env.DB.prepare("SELECT * FROM quran_paths WHERE student_id=? AND active=1").bind(studentId).first();
}
function quranPathPayload(row) {
  if (!row) return null;
  const category = QURAN_CATEGORIES[row.hifz_category] || QURAN_CATEGORIES["15"];
  return {
    student_id: row.student_id,
    group_id: row.group_id,
    hifz_plan: row.hifz_plan,
    hifz_plan_label: QURAN_PLANS[row.hifz_plan] || row.hifz_plan,
    hifz_amount: row.hifz_amount,
    hifz_unit: row.hifz_unit,
    hifz_category: row.hifz_category,
    hifz_category_label: category.label,
    thabit_amount: category.thabit,
    thabit_label: category.thabitLabel,
    work_days: category.workDays,
    ward_ahzab: Number(row.ward_ahzab || 1),
    ward_label: QURAN_WARD[row.ward_ahzab] || QURAN_WARD[1],
    rest_day: row.rest_day === null || row.rest_day === undefined ? null : Number(row.rest_day),
    start_date: row.start_date,
    updated_at: row.updated_at
  };
}
// ---------------------------------------------------------------------------
// رحلة الطالب: حوار تدريجي، توصية خطة، والثمن بالوقت والانتباه.
// الحالة تُحفظ في academy_records (collection=student_journey) بلا جدول جديد،
// والتطبيق يستخدم مسار القرآن والخطة القائمين نفسيهما.
// ---------------------------------------------------------------------------
const JOURNEY_QUESTIONS = [
  {
    id: "memorized",
    title: "كم تحفظ من كتاب الله الآن؟",
    hint: "اختر أقرب مقدار بصدق؛ الصدق بداية الخطة، ولا أحد يحاسبك على قلة المحفوظ.",
    options: [
      { value: "none", label: "لا أحفظ شيئًا بعد", detail: "نبدأ من التأسيس بلا ضغط." },
      { value: "lt5", label: "أقل من 5 أحزاب", detail: "قصار السور أو بدايات الحفظ." },
      { value: "5_15", label: "من 5 إلى أقل من 15 حزبًا", detail: "أساس يحتاج تثبيتًا منتظمًا." },
      { value: "15_30", label: "من 15 إلى أقل من 30 حزبًا", detail: "فئة 15 حزبًا المرجعية." },
      { value: "30_45", label: "من 30 إلى أقل من 45 حزبًا", detail: "فئة 30 حزبًا المرجعية." },
      { value: "45_60", label: "من 45 إلى أقل من 60 حزبًا", detail: "فئة 45 حزبًا المرجعية." },
      { value: "60_plus", label: "60 حزبًا أو أكثر", detail: "فئة 60 حزبًا المرجعية." }
    ]
  },
  {
    id: "riwaya",
    title: "بأي رواية تقرأ وتسمّع؟",
    hint: "تُسجَّل الرواية للشيخ، ولا تغيّر مقدار الخطة تلقائيًا.",
    options: [
      { value: "hafs", label: "حفص عن عاصم", detail: "الرواية الأكثر انتشارًا في المنطقة." },
      { value: "warsh", label: "ورش عن نافع", detail: "تُراجع مع الشيخ عند اعتماد الخطة." },
      { value: "qalun", label: "قالون عن نافع", detail: "تُراجع مع الشيخ عند اعتماد الخطة." },
      { value: "other", label: "رواية أخرى", detail: "اكتبها للشيخ عند المراجعة." }
    ]
  },
  {
    id: "daily_minutes",
    title: "كم دقيقة تستطيع أن تمنح القرآن يوميًا بصدق؟",
    hint: "الوقت الذي تلتزم به أفضل من وقت تتمناه ولا تستطيع الوفاء به.",
    options: [
      { value: "10", label: "10 دقائق", detail: "بداية صغيرة ثابتة." },
      { value: "20", label: "20 دقيقة", detail: "خطوة يومية هادئة." },
      { value: "30", label: "30 دقيقة", detail: "وقت متوازن لمعظم الطلاب." },
      { value: "45", label: "45 دقيقة", detail: "وقت جيد لمن يريد تسريع التقدم." },
      { value: "60", label: "ساعة", detail: "التزام يومي واضح." },
      { value: "90", label: "90 دقيقة", detail: "وقت مكثف يحتاج انتظامًا." }
    ]
  },
  {
    id: "goal",
    title: "ما هدفك في هذه المرحلة؟",
    hint: "لكل هدف خطة مختلفة؛ لا توجد خطة واحدة تناسب الجميع.",
    options: [
      { value: "start", label: "أبدأ الحفظ من الصفر", detail: "تأسيس القراءة وقصار السور أولًا." },
      { value: "stabilize", label: "أثبّت ما أحفظه", detail: "التثبيت والمراجعة قبل الزيادة." },
      { value: "increase", label: "أزيد مقدار الحفظ", detail: "حفظ جديد متدرج مع مراجعة." },
      { value: "complete", label: "أريد إتمام القرآن", detail: "مسار مرن للإتمام مع التثبيت." },
      { value: "repair", label: "أعالج تعثرًا ومراجعة متراكمة", detail: "نبدأ بخفيف ونعيد بناء الانتظام." }
    ]
  },
  {
    id: "mastery",
    title: "كيف ترى إتقانك لما حفظت؟",
    hint: "التقدير هنا لتخفيف الخطة أو شدّها، وليس حكمًا على شخصك.",
    options: [
      { value: "weak", label: "أحتاج تثبيتًا كثيرًا", detail: "نبدأ بالتثبيت قبل الجديد." },
      { value: "fair", label: "متوسط", detail: "أحتاج مراجعة منتظمة." },
      { value: "good", label: "جيد", detail: "أستطيع تحمّل مقدار متوازن." },
      { value: "strong", label: "قوي", detail: "أستطيع مقدارًا أكبر بإذن الله." }
    ]
  },
  {
    id: "difficulty",
    title: "ما أكثر ما يعوق استمرارك؟",
    hint: "لا حكم على شخصك؛ نبحث عن السبب لنخفف الطريق.",
    options: [
      { value: "time", label: "ضيق الوقت", detail: "سنخفف المقدار ونثبت الورد." },
      { value: "consistency", label: "الاستمرارية", detail: "نبدأ بخطوة صغيرة يومية." },
      { value: "memorization", label: "صعوبة الحفظ", detail: "نزيد التكرار ونقلل الجديد." },
      { value: "review_backlog", label: "تراكم المراجعة", detail: "نبدأ بخطة استدراك خفيفة." },
      { value: "none", label: "لا عائق كبير الآن", detail: "نبدأ بخطة متوازنة." }
    ]
  },
  {
    id: "ward",
    title: "كم تريد أن يكون وردك اليومي؟",
    hint: "الورد قراءة ومراجعة، وليس بديلًا عن التثبيت أو الحفظ.",
    options: [
      { value: "auto", label: "اقترح لي", detail: "نختاره بحسب وقتك ومحفوظك." },
      { value: "1", label: "حزب واحد", detail: "ورد خفيف ثابت." },
      { value: "2", label: "حزبان", detail: "ورد متوسط." },
      { value: "4", label: "أربعة أحزاب", detail: "ورد موسّع يحتاج وقتًا." }
    ]
  },
  {
    id: "rest_day",
    title: "أي يوم تجعله للاستدراك والراحة؟",
    hint: "يوم واحد أسبوعيًا يخفف التراكم، ويمكن تغييره لاحقًا.",
    options: [
      { value: "5", label: "الجمعة (مقترح)", detail: "الخيار الافتراضي." },
      { value: "0", label: "الأحد", detail: "يوم استدراك." },
      { value: "1", label: "الإثنين", detail: "يوم استدراك." },
      { value: "2", label: "الثلاثاء", detail: "يوم استدراك." },
      { value: "3", label: "الأربعاء", detail: "يوم استدراك." },
      { value: "4", label: "الخميس", detail: "يوم استدراك." },
      { value: "6", label: "السبت", detail: "يوم استدراك." },
      { value: "none", label: "بدون يوم محدد", detail: "لا نثبت يوم راحة." }
    ]
  }
];
const JOURNEY_QUESTION_IDS = JOURNEY_QUESTIONS.map(question => question.id);
const JOURNEY_VARIANTS = {
  light: { label: "الخفيفة", plan: "plan_c", hifz_amount: "1", hifz_unit: "وجه", hifz_minutes: 12, description: "وجه واحد، تثبيت ثابت، وورد قصير. للبداية أو عند ضيق الوقت." },
  balanced: { label: "المتوازنة", plan: "plan_b", hifz_amount: "1", hifz_unit: "صفحة", hifz_minutes: 20, description: "صفحة واحدة مع تثبيت وورد متوسط. الخيار الأكثر استدامة." },
  intense: { label: "المكثفة", plan: "plan_a", hifz_amount: "2", hifz_unit: "صفحة", hifz_minutes: 40, description: "صفحتان مع تثبيت وورد أوسع. لمن يملك وقتًا وانتظامًا." }
};
const JOURNEY_THABIT_MINUTES = { "15": 10, "30": 15, "45": 20, "60": 25 };
const JOURNEY_WARD_MINUTES = { 1: 15, 2: 30, 4: 55 };

function cleanJourneyAnswers(raw) {
  const value = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const answers = {};
  for (const question of JOURNEY_QUESTIONS) {
    const candidate = value[question.id];
    if (candidate === undefined || candidate === null || candidate === "") continue;
    const normalized = String(candidate);
    if (question.options.some(option => option.value === normalized)) answers[question.id] = normalized;
  }
  return answers;
}
function journeyAnsweredCount(answers) {
  return JOURNEY_QUESTION_IDS.filter(id => answers && answers[id] !== undefined).length;
}
function journeyComplete(answers) {
  return journeyAnsweredCount(answers) === JOURNEY_QUESTION_IDS.length;
}
function journeyCategoryFor(memorized) {
  if (["none", "lt5", "5_15", "15_30"].includes(memorized)) return "15";
  if (memorized === "30_45") return "30";
  if (memorized === "45_60") return "45";
  if (memorized === "60_plus") return "60";
  return "15";
}
function journeyWardFor(variantId, answers) {
  if (answers.ward && answers.ward !== "auto") return Number(answers.ward);
  if (variantId === "light") return 1;
  if (variantId === "intense") return Number(answers.daily_minutes) >= 90 ? 4 : 2;
  return Number(answers.daily_minutes) >= 30 ? 2 : 1;
}
function journeyRestDay(answers) {
  if (answers.rest_day === "none") return null;
  if (/^[0-6]$/.test(String(answers.rest_day ?? ""))) return Number(answers.rest_day);
  return 5;
}
function journeyVariant(answers, variantId) {
  const base = JOURNEY_VARIANTS[variantId] || JOURNEY_VARIANTS.balanced;
  const category = journeyCategoryFor(answers.memorized);
  const categoryInfo = QURAN_CATEGORIES[category] || QURAN_CATEGORIES["15"];
  const ward = journeyWardFor(variantId, answers);
  const wardMinutes = JOURNEY_WARD_MINUTES[ward] || JOURNEY_WARD_MINUTES[1];
  const thabitMinutes = JOURNEY_THABIT_MINUTES[category] || 10;
  const estimated = Number(base.hifz_minutes) + thabitMinutes + wardMinutes;
  const available = Number(answers.daily_minutes) || 0;
  const restDay = journeyRestDay(answers);
  const fits = available > 0 ? estimated <= available : false;
  const starter = ["start"].includes(answers.goal) || ["none", "lt5"].includes(answers.memorized);
  const pathId = starter ? "starter" : "khatma";
  return {
    id: variantId,
    label: base.label,
    description: base.description,
    plan: base.plan,
    plan_label: QURAN_PLANS[base.plan] || base.plan,
    hifz_amount: base.hifz_amount,
    hifz_unit: base.hifz_unit,
    hifz_category: category,
    hifz_category_label: categoryInfo.label,
    thabit_amount: categoryInfo.thabit,
    thabit_label: categoryInfo.thabitLabel,
    ward_ahzab: ward,
    ward_label: QURAN_WARD[ward] || QURAN_WARD[1],
    rest_day: restDay,
    path_id: pathId,
    weekly_goal: starter
      ? "تأسيس القراءة وحفظ قصار السور، مع تثبيت " + categoryInfo.thabitLabel + " وورد " + (QURAN_WARD[ward] || QURAN_WARD[1]) + " خمسة أيام في الأسبوع."
      : "حفظ " + base.hifz_amount + " " + base.hifz_unit + "، وتثبيت " + categoryInfo.thabitLabel + "، وورد " + (QURAN_WARD[ward] || QURAN_WARD[1]) + " خمسة أيام في الأسبوع.",
    estimated_daily_minutes: estimated,
    estimated_weekly_minutes: estimated * 5,
    available_daily_minutes: available,
    breakdown: { hifz: base.hifz_minutes, thabit: thabitMinutes, ward: wardMinutes },
    fits,
    over_by: Math.max(0, estimated - available)
  };
}
function journeyPreferredVariant(answers) {
  const minutes = Number(answers.daily_minutes) || 0;
  if (answers.goal === "start" || ["none", "lt5"].includes(answers.memorized)) return "light";
  if (answers.goal === "repair" || answers.difficulty === "review_backlog" || answers.mastery === "weak") return "light";
  if (answers.goal === "complete" && minutes >= 60 && answers.mastery === "strong" && answers.difficulty === "none") return "intense";
  if (minutes >= 45 && ["good", "strong"].includes(answers.mastery) && answers.difficulty === "none") return "balanced";
  return "balanced";
}
function journeyRecommendation(answers) {
  const variants = ["light", "balanced", "intense"].map(id => journeyVariant(answers, id));
  let recommended = journeyPreferredVariant(answers);
  const fits = id => variants.find(variant => variant.id === id)?.fits;
  if (!fits(recommended)) {
    if (fits("light")) recommended = "light";
    else if (fits("balanced")) recommended = "balanced";
    else if (fits("intense")) recommended = "intense";
    else recommended = variants.slice().sort((a, b) => a.over_by - b.over_by)[0].id;
  }
  const selected = variants.find(variant => variant.id === recommended) || variants[1];
  const reason = [];
  const memorizedLabel = JOURNEY_QUESTIONS.find(q => q.id === "memorized")?.options.find(o => o.value === answers.memorized)?.label;
  if (memorizedLabel) reason.push("محفوظك الحالي: " + memorizedLabel + ".");
  if (answers.daily_minutes) reason.push("وقتك المعلن: " + answers.daily_minutes + " دقيقة يوميًا.");
  if (answers.difficulty && answers.difficulty !== "none") {
    const difficultyLabel = JOURNEY_QUESTIONS.find(q => q.id === "difficulty")?.options.find(o => o.value === answers.difficulty)?.label;
    if (difficultyLabel) reason.push("راعينا عائق " + difficultyLabel + ".");
  }
  return {
    recommended_variant: recommended,
    recommended: selected,
    variants,
    category: selected.hifz_category,
    category_label: selected.hifz_category_label,
    thabit_label: selected.thabit_label,
    thabit_reference_status: "proposal",
    approval_required: true,
    estimate_label: "تقدير تقريبي بالدقائق، يضبطه الشيخ بعد المراجعة.",
    price: {
      title: "الثمن: وقتك وانتباهك",
      money: "لا رسوم مالية",
      daily_minutes: selected.estimated_daily_minutes,
      weekly_minutes: selected.estimated_weekly_minutes,
      days_per_week: 5,
      rest_day: selected.rest_day,
      available_daily_minutes: selected.available_daily_minutes,
      line: selected.fits
        ? "خطتك داخل الوقت الذي أعلنته. الباقي راحة أو مراجعة حرة، لا مهام إضافية."
        : "الخطة المقترحة تتجاوز وقتك المعلن. ابدأ بالأخف، أو أكّد المتابعة بعد مراجعة الشيخ."
    },
    reasons: reason,
    note: "أرقام التثبيت المرجعية (60←نصف، 45←ثلاثة أثمان، 30←ربع، 15←ثمن) مقترحة وتنتظر اعتماد الشيخ. لا نغيّر خطتك بعد التطبيق دون إشعارك، وما يحتاج قرارًا شرعيًا أو تربويًا يبقى للشيخ."
  };
}
function journeyRecordPayload(record, answers) {
  const count = journeyAnsweredCount(answers);
  const complete = journeyComplete(answers);
  return {
    id: record?.id || null,
    status: record?.status || "in_progress",
    approval_status: record?.approval_status || "none",
    answers,
    answered: count,
    total: JOURNEY_QUESTION_IDS.length,
    complete,
    recommendation: complete ? journeyRecommendation(answers) : null,
    path: record?.path || null,
    applied_plan: record?.applied_plan || null,
    request_note: record?.request_note || "",
    review_note: record?.review_note || "",
    applied_at: record?.applied_at || null,
    reviewed_at: record?.reviewed_at || null,
    revision: Number(record?.revision || 0)
  };
}

async function saveQuranPlanForStudent(env, user, student, body) {
  const pathId = clean(body.path_id, 40), allowed = ["khatma", "45", "30", "15", "starter"];
  if (!allowed.includes(pathId)) return { error: fail(400, "اختر مسارًا قرآنيًا صحيحًا") };
  const weeklyGoal = clean(body.weekly_goal, 250);
  if (!weeklyGoal) return { error: fail(400, "اكتب هدفًا أسبوعيًا واضحًا") };
  const existing = await env.DB.prepare("SELECT payload_json FROM academy_records WHERE collection='quran_plan' AND student_id=? LIMIT 1").bind(student.id).first();
  let previous = {};
  try { if (existing) previous = JSON.parse(existing.payload_json); } catch {}
  const weeklyTargets = Array.isArray(body.weekly_targets)
    ? body.weekly_targets.slice(0, 12).map((w, i) => ({
        week: i + 1,
        memorization: clean(w?.memorization, 180),
        revision: clean(w?.revision, 180),
        understanding: clean(w?.understanding, 180),
        application: clean(w?.application, 180)
      }))
    : Array.isArray(previous.weekly_targets) ? previous.weekly_targets : [];
  const plan = {
    id: student.id,
    student_id: student.id,
    group_id: student.group_id,
    path_id: pathId,
    weekly_goal: weeklyGoal,
    weekly_targets: weeklyTargets,
    created_at: previous.created_at || nowIso(),
    updated_at: nowIso(),
    updated_by: user.id
  };
  await saveRecord(env, "quran_plan", plan);
  await log(env, user.id, "quran_plan_save", { student_id: student.id, path_id: pathId });
  return { plan };
}
async function saveQuranPathForStudent(env, user, student, body) {
  const plan = clean(body.hifz_plan, 20), category = clean(body.hifz_category, 2), ward = Number(body.ward_ahzab);
  if (!QURAN_PLANS[plan]) return { error: fail(400, "اختر خطة حفظ من الخطط الثلاث") };
  if (!QURAN_CATEGORIES[category]) return { error: fail(400, "اختر فئة المحفوظ: 15 أو 30 أو 45 أو 60 حزبًا") };
  if (![1, 2, 4].includes(ward)) return { error: fail(400, "اختر مقدار الورد: حزب أو حزبان أو أربعة أحزاب") };
  const hifzAmount = clean(body.hifz_amount, 80), hifzUnit = clean(body.hifz_unit, 20) || "سطر";
  if (!hifzAmount) return { error: fail(400, "حدّد مقدار الحفظ اليومي المناسب لطاقتك") };
  const startDate = quranDateISO(body.start_date) || academyDate();
  if (!startDate || startDate > academyDate()) return { error: fail(400, "لا يمكن أن يبدأ المسار في تاريخ مستقبلي") };
  const restRaw = body.rest_day;
  const restDay = (restRaw === null || restRaw === undefined || restRaw === "") ? null : Number(restRaw);
  if (restDay !== null && (!Number.isInteger(restDay) || restDay < 0 || restDay > 6)) return { error: fail(400, "اختر يوم استدراك صحيحًا أو اتركه فارغًا") };
  await env.DB.prepare(`INSERT INTO quran_paths (student_id,group_id,hifz_plan,hifz_amount,hifz_unit,hifz_category,ward_ahzab,rest_day,start_date,active,updated_by,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,1,?,?)
    ON CONFLICT(student_id) DO UPDATE SET group_id=excluded.group_id,hifz_plan=excluded.hifz_plan,hifz_amount=excluded.hifz_amount,hifz_unit=excluded.hifz_unit,hifz_category=excluded.hifz_category,ward_ahzab=excluded.ward_ahzab,rest_day=excluded.rest_day,start_date=excluded.start_date,active=1,updated_by=excluded.updated_by,updated_at=excluded.updated_at`)
    .bind(student.id, student.group_id || null, plan, hifzAmount, hifzUnit, category, ward, restDay, startDate, user.id, nowIso()).run();
  await log(env, user.id, "quran_path_save", { student_id: student.id, plan, category, ward });
  const row = await quranPathRow(env, student.id);
  return { path: quranPathPayload(row) };
}

async function quranDayState(env, studentId, day) {
  const rows = await env.DB.prepare("SELECT * FROM quran_daily WHERE student_id=? AND day=?").bind(studentId, day).all();
  const byKind = {};
  for (const row of rows.results || []) byKind[row.kind] = row;
  return byKind;
}
async function quranStreak(env, studentId) {
  const rows = await env.DB.prepare("SELECT DISTINCT day FROM quran_daily WHERE student_id=? ORDER BY day DESC LIMIT 400").bind(studentId).all();
  const days = (rows.results || []).map(row => row.day).filter(Boolean);
  if (!days.length) return 0;
  const today = academyDate();
  let cursor = days[0] === today ? today : addCalendarDays(today, -1);
  let streak = 0;
  for (const day of days) {
    if (day !== cursor) break;
    streak += 1;
    cursor = addCalendarDays(cursor, -1);
  }
  return streak;
}

function buildStudentTasks(student, assignments, submissions, plan, progress, attendance) {
  const today = academyDate();
  const tasks = [];
  const submissionByAssignment = new Map((submissions || []).map(row => [row.assignment_id, row]));
  for (const assignment of assignments || []) {
    const submission = submissionByAssignment.get(assignment.id);
    const type = TASK_TYPE_LABELS[assignment.task_type] ? assignment.task_type : "assignment";
    let status = "pending";
    if (submission?.status === "reviewed") status = "done";
    else if (submission?.status === "submitted") status = "submitted";
    else if (assignment.due_date && String(assignment.due_date) < today) status = "late";
    tasks.push({
      id: "assignment:" + assignment.id,
      type,
      type_label: TASK_TYPE_LABELS[type],
      title: assignment.title,
      description: assignment.description || "",
      due_date: assignment.due_date || null,
      status,
      status_label: TASK_STATUS_LABELS[status],
      points_total: Number(assignment.points_total || 0),
      grade: submission?.grade ?? null,
      feedback: submission?.feedback || "",
      source_collection: "assignments",
      source_id: assignment.id,
    });
  }
  const progressRows = (progress || []).filter(row => typeof row.date === "string");
  const weekStart = addCalendarDays(academyDate(), -6);
  const recentProgress = progressRows.filter(row => row.date >= weekStart && row.date <= today);
  const memorizedThisWeek = recentProgress.some(row => String(row.memorized || "").trim() || row.activity === "memorization");
  const reviewedThisWeek = recentProgress.some(row => String(row.reviewed || "").trim() || row.activity === "revision");
  if (plan && plan.weekly_goal) {
    tasks.push({
      id: "quran-memorization:" + student.id,
      type: "memorization",
      type_label: TASK_TYPE_LABELS.memorization,
      title: "ورد الحفظ الأسبوعي",
      description: plan.weekly_goal,
      due_date: null,
      status: memorizedThisWeek ? "done" : "pending",
      status_label: TASK_STATUS_LABELS[memorizedThisWeek ? "done" : "pending"],
      points_total: 0,
      grade: null,
      feedback: "",
      source_collection: "quran_plan",
      source_id: plan.id || student.id,
    });
    const revisionTarget = Array.isArray(plan.weekly_targets) ? String(plan.weekly_targets[0]?.revision || "").trim() : "";
    if (revisionTarget) {
      tasks.push({
        id: "quran-revision:" + student.id,
        type: "revision",
        type_label: TASK_TYPE_LABELS.revision,
        title: "ورد المراجعة الأسبوعي",
        description: revisionTarget,
        due_date: null,
        status: reviewedThisWeek ? "done" : "pending",
        status_label: TASK_STATUS_LABELS[reviewedThisWeek ? "done" : "pending"],
        points_total: 0,
        grade: null,
        feedback: "",
        source_collection: "quran_plan",
        source_id: plan.id || student.id,
      });
    }
  }
  const todayAttendance = (attendance || []).find(row => row.date === today);
  if (todayAttendance) {
    const attendanceLabels = { present: "حاضر", absent: "غائب", late: "متأخر", excused: "بعذر" };
    tasks.push({
      id: "attendance:" + student.id + ":" + today,
      type: "attendance",
      type_label: TASK_TYPE_LABELS.attendance,
      title: "حضور اليوم",
      description: "تسجيل الحضور اليومي للطالب",
      due_date: today,
      status: "done",
      status_label: attendanceLabels[todayAttendance.status] || TASK_STATUS_LABELS.done,
      points_total: 0,
      grade: null,
      feedback: "",
      source_collection: "attendance",
      source_id: todayAttendance.id,
    });
  }
  return tasks;
}

async function recentPointEvents(env, studentId, limit = 50) {
  const result = await env.DB.prepare("SELECT pe.id,pe.event_type,pe.kind,pe.points,pe.reason,pe.event_key,pe.awarded_date,pe.source_collection,pe.source_id,pe.awarded_by,u.display_name AS awarded_by_name,pe.created_at,pe.reversed_at,pe.reversal_reason FROM point_events pe LEFT JOIN users u ON u.id=pe.awarded_by WHERE pe.student_id=? AND (pe.kind='achievement' OR pe.event_type='store_redemption' OR (pe.kind='store' AND NOT EXISTS (SELECT 1 FROM point_events pa WHERE pa.student_id=pe.student_id AND pa.event_key=pe.event_key AND pa.kind='achievement'))) ORDER BY pe.created_at DESC, pe.id DESC LIMIT ?").bind(studentId, limit).all();
  return (result.results || []).map(row => ({ ...row, kind_label: POINT_KIND_LABELS[row.kind] || row.kind, reversed: Boolean(row.reversed_at) }));
}
async function competitionStudentFacts(env, studentId) {
  const profileRow = await env.DB.prepare("SELECT payload_json FROM academy_records WHERE collection='student_profiles' AND id=?").bind(studentId).first();
  let profile = {};
  try { profile = profileRow ? JSON.parse(profileRow.payload_json) : {}; } catch { profile = {}; }
  const path = await env.DB.prepare("SELECT hifz_category FROM quran_paths WHERE student_id=? AND active=1").bind(studentId).first();
  const memorized = Number(profile.memorized_hizb);
  const memorizedValid = profile.memorized_hizb !== null && profile.memorized_hizb !== undefined && profile.memorized_hizb !== "" && Number.isInteger(memorized) && memorized >= 0 && memorized <= 60;
  return {
    age: Number.isInteger(Number(profile.age)) && Number(profile.age) >= 3 ? Number(profile.age) : null,
    riwaya: clean(profile.riwaya, 60),
    hizb: memorizedValid ? String(memorized) : (path?.hifz_category ? String(path.hifz_category) : ""),
    hizb_value: memorizedValid ? memorized : (path?.hifz_category ? competitionHizbValue(path.hifz_category) : null)
  };
}

async function competitionRegistrationRow(env, competitionId, studentId) {
  return env.DB.prepare("SELECT * FROM competition_registrations WHERE competition_id=? AND student_id=?").bind(competitionId, studentId).first();
}

async function competitionEligibility(env, user, competition) {
  const reasons = [];
  if (!user || user.role !== "student" || !user.student_id || !user.group_id) {
    return { eligible: false, reasons: ["المشاركة متاحة لحساب طالب مرتبط بفوج."], age: null, hizb: "", riwaya: "", registration: null };
  }
  const today = academyDate();
  if (competition.status !== "registration") reasons.push("التسجيل غير مفتوح حاليًا.");
  if (competition.registration_starts_at && today < competition.registration_starts_at) reasons.push("لم يبدأ التسجيل بعد.");
  if (competition.registration_ends_at && today > competition.registration_ends_at) reasons.push("انتهى موعد التسجيل.");
  const facts = await competitionStudentFacts(env, user.student_id);
  const minAge = competition.min_age === null || competition.min_age === undefined ? null : Number(competition.min_age);
  const maxAge = competition.max_age === null || competition.max_age === undefined ? null : Number(competition.max_age);
  if (minAge !== null || maxAge !== null) {
    if (facts.age === null) reasons.push("العمر غير مسجّل في ملف الطالب؛ راجع الشيخ لتحديثه.");
    else if (minAge !== null && facts.age < minAge) reasons.push("العمر أقل من الحد الأدنى للفئة.");
    else if (maxAge !== null && facts.age > maxAge) reasons.push("العمر أكبر من الحد الأعلى للفئة.");
  }
  const minHizb = competition.min_hizb === null || competition.min_hizb === undefined ? null : Number(competition.min_hizb);
  const maxHizb = competition.max_hizb === null || competition.max_hizb === undefined ? null : Number(competition.max_hizb);
  if (minHizb !== null || maxHizb !== null) {
    if (facts.hizb_value === null) reasons.push("مقدار الحفظ غير محدد في مسار القرآن؛ راجع الشيخ لتحديثه.");
    else if (minHizb !== null && facts.hizb_value < minHizb) reasons.push("مقدار الحفظ أقل من الحد الأدنى للفئة.");
    else if (maxHizb !== null && facts.hizb_value > maxHizb) reasons.push("مقدار الحفظ أكبر من الحد الأعلى للفئة.");
  }
  const allowedRiwayat = parseJsonArray(competition.riwayat_json).map(item => clean(item, 60)).filter(Boolean);
  if (allowedRiwayat.length && facts.riwaya && !allowedRiwayat.includes(facts.riwaya)) reasons.push("الرواية المسجلة ليست ضمن روايات المسابقة.");
  if (allowedRiwayat.length && !facts.riwaya) reasons.push("الرواية غير مسجلة في ملف الطالب؛ راجع الشيخ لتحديثها.");
  const registration = await competitionRegistrationRow(env, competition.id, user.student_id);
  if (registration && !["rejected", "withdrawn"].includes(registration.status)) reasons.push("لديك تسجيل قائم في هذه المسابقة.");
  return { eligible: reasons.length === 0, reasons, age: facts.age, hizb: facts.hizb, riwaya: facts.riwaya, registration };
}

async function competitionCanManage(env, user, competition) {
  if (!user || !competition) return false;
  if (user.role === "admin") return true;
  if (user.role === "director") return Boolean(competition.school_id) && Array.isArray(user.school_ids) && user.school_ids.includes(competition.school_id);
  return false;
}

async function competitionCanJudge(env, user, competition, registration) {
  if (!user) return false;
  if (user.role === "admin") return true;
  if (user.role === "director") return competitionCanManage(env, user, competition);
  if (["teacher", "supervisor"].includes(user.role)) {
    const assigned = await env.DB.prepare("SELECT 1 AS ok FROM competition_judges WHERE competition_id=? AND user_id=?").bind(competition.id, user.id).first();
    if (assigned) return true;
    return registration ? canManageGroup(env, user, registration.group_id) : false;
  }
  return false;
}

function competitionCriteriaTotal(criteria, values) {
  const map = new Map();
  for (const row of Array.isArray(values) ? values : []) {
    const id = clean(row && row.id, 40);
    const score = Number(row && row.score);
    if (id && Number.isFinite(score)) map.set(id, score);
  }
  let earned = 0, total = 0;
  const detail = [];
  for (const item of criteria) {
    const max = Number(item.max) || 0;
    const raw = map.has(item.id) ? Number(map.get(item.id)) : 0;
    const score = Math.max(0, Math.min(max, Number.isFinite(raw) ? raw : 0));
    earned += score; total += max;
    detail.push({ id: item.id, label: item.label, max, score });
  }
  const normalized = total > 0 ? Math.round((earned / total) * 10000) / 100 : 0;
  return { total: normalized, detail };
}

function competitionAwardForRank(awards, rank) {
  const row = (awards || []).find(item => Number(item.place) === Number(rank));
  return row ? { achievement: Number(row.achievement) || 0, store: Number(row.store) || 0, label: row.label || "" } : { achievement: 0, store: 0, label: "" };
}

function competitionJsonFields(row) {
  if (!row) return row;
  return {
    ...row,
    riwayat: parseJsonArray(row.riwayat_json).map(item => clean(item, 60)).filter(Boolean),
    judging_criteria: normalizeCompetitionCriteria(row.judging_criteria_json, row.kind),
    awards: normalizeCompetitionAwards(row.awards_json),
    requires_approval: Boolean(row.requires_approval)
  };
}

// النسخة الاحتياطية الكاملة — نفس استعلامات بوابة التصدير؛ يستخدمها التصدير والمجدول اليومي (R2).
async function buildFullBackup(env) {
const [users,groups,students,recordsResult,schools,audit,googleIdentities,pointRules,pointEvents,storeItems,storeRedemptions,quranPaths,quranDaily,quranPairs,quranPairSessions,quranStations,quranMakeups,competitionCategories,competitions,competitionRegistrations,competitionJudges,competitionScores,competitionResults,competitionEvents,competitionTerms]=await Promise.all([
  env.DB.prepare("SELECT id,display_name,identity_normalized,password_hash,role,active,must_change_password,created_at FROM users ORDER BY created_at").all(),
  env.DB.prepare("SELECT id,name,school_id,active,created_at,teacher_id FROM groups ORDER BY created_at").all(),
  env.DB.prepare("SELECT id,user_id,display_name,group_id,active,created_at FROM students ORDER BY created_at").all(),
  env.DB.prepare("SELECT collection,id,owner_user_id,group_id,student_id,payload_json,updated_at FROM academy_records ORDER BY collection,updated_at").all(),
  env.DB.prepare("SELECT id,name,description,active,sort_order,created_at FROM quran_schools ORDER BY sort_order,name").all(),
  env.DB.prepare("SELECT id,user_id,action,metadata_json,created_at FROM audit_log ORDER BY created_at").all(),
  env.DB.prepare("SELECT google_sub,user_id,email,linked_at FROM google_identities ORDER BY linked_at").all(),
  env.DB.prepare("SELECT * FROM point_rules ORDER BY sort_order,id").all(),
  env.DB.prepare("SELECT * FROM point_events ORDER BY created_at").all(),
  env.DB.prepare("SELECT * FROM store_items ORDER BY sort_order,id").all(),
  env.DB.prepare("SELECT * FROM store_redemptions ORDER BY requested_at").all(),
  env.DB.prepare("SELECT * FROM quran_paths ORDER BY created_at").all(),
  env.DB.prepare("SELECT * FROM quran_daily ORDER BY day,created_at").all(),
  env.DB.prepare("SELECT * FROM quran_pairs ORDER BY created_at").all(),
  env.DB.prepare("SELECT * FROM quran_pair_sessions ORDER BY day,created_at").all(),
  env.DB.prepare("SELECT * FROM quran_stations ORDER BY scheduled_for").all(),
  env.DB.prepare("SELECT * FROM quran_makeups ORDER BY due_date").all(),
  env.DB.prepare("SELECT * FROM competition_categories ORDER BY sort_order,id").all(),
  env.DB.prepare("SELECT * FROM competitions ORDER BY created_at").all(),
  env.DB.prepare("SELECT * FROM competition_registrations ORDER BY registered_at").all(),
  env.DB.prepare("SELECT * FROM competition_judges ORDER BY created_at").all(),
  env.DB.prepare("SELECT * FROM competition_scores ORDER BY scored_at").all(),
  env.DB.prepare("SELECT * FROM competition_results ORDER BY created_at").all(),
  env.DB.prepare("SELECT * FROM competition_events ORDER BY event_date").all(),
  env.DB.prepare("SELECT * FROM competition_reference_terms ORDER BY sort_order,id").all()
]);
const payload={format:"ihsan-academy-full-backup-v4",created_at:nowIso(),notice:"نسخة كاملة قابلة للدمج والاستعادة: تتضمن بصمات كلمات المرور وروابط Google، واقتصاد النقاط، ومسار القرآن، ومنظومة المسابقات. تعامل معها كملف سري. لا تتضمن رموز الجلسات أو محاولات الدخول؛ سيحتاج المستخدمون إلى تسجيل الدخول مجددًا عند النقل إلى قاعدة جديدة.",data:{
  users:users.results||[],
  google_identities:googleIdentities.results||[],
  groups:groups.results||[],
  students:students.results||[],
  academy_records:(recordsResult.results||[]).map(r=>{let value=null;try{value=JSON.parse(r.payload_json)}catch{}return {collection:r.collection,id:r.id,owner_user_id:r.owner_user_id,group_id:r.group_id,student_id:r.student_id,updated_at:r.updated_at,payload:value}}),
  quran_schools:schools.results||[],
  audit_log:audit.results||[],
  point_rules:pointRules.results||[],
  point_events:pointEvents.results||[],
  store_items:storeItems.results||[],
  store_redemptions:storeRedemptions.results||[],
  quran_paths:quranPaths.results||[],
  quran_daily:quranDaily.results||[],
  quran_pairs:quranPairs.results||[],
  quran_pair_sessions:quranPairSessions.results||[],
  quran_stations:quranStations.results||[],
  quran_makeups:quranMakeups.results||[],
  competition_categories:competitionCategories.results||[],
  competitions:competitions.results||[],
  competition_registrations:competitionRegistrations.results||[],
  competition_judges:competitionJudges.results||[],
  competition_scores:competitionScores.results||[],
  competition_results:competitionResults.results||[],
  competition_events:competitionEvents.results||[],
  competition_reference_terms:competitionTerms.results||[]
}};
  return payload;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url), path = url.pathname, method = request.method.toUpperCase();
    try {
    if (method === "OPTIONS") return new Response(null, { status:204, headers:{ ...JSON_HEADERS, "access-control-allow-methods":"GET, POST, PUT, PATCH, DELETE, OPTIONS", "access-control-allow-headers":"Content-Type, Authorization, X-CSRF-Token" }});
    if (path === "/api/health" && method === "GET") {
      try {
        const db = await env.DB.prepare("SELECT 1 AS ok").first();
        return json({ ok: db?.ok === 1, app: "ihsan-academy", runtime: "cloudflare-pages-functions", storage: "d1" });
      } catch {
        return fail(503, "database_unavailable");
      }
    }
    if (path === "/api/setup/status" && method === "GET") {
      try { const r=await env.DB.prepare("SELECT COUNT(*) AS n FROM users WHERE role='admin' AND active=1").first(); return json({needs_admin:(r?.n||0)===0,setup_enabled:!!env.BOOTSTRAP_SECRET}); } catch { return fail(503,"database_unavailable"); }
    }
    if (path === "/api/privacy" && method === "GET") return json({title:"سياسة الخصوصية — أكاديمية الإحسان",principles:["نجمع أقل قدر لازم للتعليم والإدارة.","لا نبيع البيانات الشخصية.","تُقيّد صلاحيات الوصول بحسب الدور والفوج.","كلمات المرور لا تُخزّن كنص واضح."]});
    if (path === "/api/public/quran-schools" && method === "GET") {
      const r=await env.DB.prepare("SELECT id,name,description FROM quran_schools WHERE active=1 ORDER BY sort_order,name").all(); return json(r.results||[]);
    }
    // خيارات إنشاء الحساب العام: المدارس النشطة فقط — لا تُكشف الأفواج ولا بيانات الطلاب لأي زائر.
    if (path === "/api/public/signup-options" && method === "GET") {
      try {
        const r=await env.DB.prepare("SELECT id,name,description FROM quran_schools WHERE active=1 ORDER BY sort_order,name").all();
        return json({schools:(r.results||[]).map(row=>({id:row.id,name:row.name,description:row.description||""}))},200,{"cache-control":"public, max-age=300"});
      } catch { return fail(503,"database_unavailable"); }
    }
    // التسجيل المفتوح: أي شخص يريد الانضمام يستطيع إنشاء حساب.
    // طالب  -> حساب طالب + طلب انضمام (قيد الاعتماد حتى يوافق الشيخ أو المسؤول المختص).
    // محسن/زائر -> حساب «visitor» يقرأ عن الأكاديمية ويساهم، ولا يصل إلى بيانات الطلاب أو الفرق.
    // شيخ/معلم -> حساب «visitor» + طلب انضمام بصفة شيخ/معلم؛ لا تُمنح الصلاحية إلا باعتماد مسؤول مخوّل.
    // لا يوجد مسار يمنح صلاحيات إدارية أو إشرافية عند التسجيل.
    if (path === "/api/signup" && method === "POST") {
      const limited=await rateLimit(env,"signup",rateLimitKey(request),10,3600);
      if(!limited.allowed)return fail(429,"طلبات إنشاء حسابات كثيرة خلال وقت قصير. انتظر قليلًا ثم أعد المحاولة.");
      const parsed=await parseBody(request); if(parsed.error)return parsed.error; const b=parsed.value;
      const name=clean(b.name,120),email=clean(b.email,200).toLowerCase(),password=String(b.password||"");
      const kind=clean(b.kind,20),schoolId=clean(b.school_id,80),note=clean(b.note,500);
      if(name.length<2)return fail(400,"أدخل الاسم الكامل");
      if(kind==="student"){
        const duplicateStudent=await findDuplicateStudentByName(env,name);
        if(duplicateStudent)return fail(409,"يوجد ملف طالب بهذا الاسم بالفعل. لا تنشئ ملفًا جديدًا؛ اطلب من الشيخ ربط حساب الدخول بالملف الموجود بعد التحقق من الهوية.");
      }
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))return fail(400,"أدخل بريدًا إلكترونيًا صحيحًا");
      if(password.length<10||password.length>256)return fail(400,"كلمة المرور يجب أن تكون 10 أحرف على الأقل ولا تتجاوز 256");
      if(!["student","teacher"].includes(kind))return fail(403,"التسجيل للطلاب والشيوخ فقط؛ الزائرون والمحسنون يتسجّلون عبر «بوابة التيسير».");
      let school=null;
      if(kind==="student"&&schoolId){school=await env.DB.prepare("SELECT id FROM quran_schools WHERE id=? AND active=1").bind(schoolId).first();if(!school)return fail(400,"المدرسة المختارة غير موجودة أو غير نشطة");}
      const existing=await env.DB.prepare("SELECT id FROM users WHERE identity_normalized=? LIMIT 1").bind(email).first();
      if(existing)return fail(409,"هذا البريد مسجّل بالفعل. سجّل الدخول بدل إنشاء حساب جديد.");
      const role=kind==="student"?"student":"visitor";
      const id=uuid();
      try {
        await env.DB.prepare("INSERT INTO users (id,display_name,identity_normalized,password_hash,role,active) VALUES (?,?,?,?,?,1)").bind(id,name,email,await passwordHash(password),role).run();
      } catch (error) {
        const message=String(error?.message||error);
        if(/unique|identity_normalized/i.test(message))return fail(409,"هذا البريد مسجّل بالفعل. سجّل الدخول بدل إنشاء حساب جديد.");
        throw error;
      }
      let studentId=null;
      if(kind==="student"){
        studentId=uuid();
        await env.DB.prepare("INSERT INTO students (id,user_id,display_name,group_id,active) VALUES (?,?,?,NULL,1)").bind(studentId,id,name).run();
        await ensureStudentCard(env,{id:studentId,name,group_id:null},id);
        if(school)await env.DB.prepare("INSERT INTO join_requests (id,user_id,kind,school_id,requested_note,status) VALUES (?,?,'school_join',?,?,'pending')").bind(uuid(),id,school.id,note).run();
      } else if(kind==="teacher"){
        await env.DB.prepare("INSERT INTO join_requests (id,user_id,kind,requested_note,status) VALUES (?,?,'teacher_request',?,'pending')").bind(uuid(),id,note).run();
      }
      const token=hex(crypto.getRandomValues(new Uint8Array(32)));
      await env.DB.prepare("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)").bind(await hashToken(token),id,new Date(Date.now()+12*60*60*1000).toISOString()).run();
      await log(env,id,"signup",{kind,school_id:school?.id||null});
      return sessionResponse({user:safeUser({id,name,email,role,must_change_password:0,student_id:studentId,group_id:null}),join_note:"تم إنشاء حسابك. "+(kind==="student"?"طلب انضمامك قيد الاعتماد؛ ستُشعَر عند اعتماد الشيخ طلبك.":kind==="teacher"?"طلب انضمامك بصفة شيخ/معلم قيد المراجعة؛ لا تُفعّل صلاحيات الشيخ إلا باعتماد إدارة الأكاديمية.":"يمكنك الآن التعرف على الأكاديمية والمساهمة، وستجد في حسابك تبويب «ملفي».")},token,false,201);
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
        const created=await env.DB.prepare("INSERT INTO users (id,display_name,identity_normalized,password_hash,role,active) SELECT ?,?,?,?, 'admin',1 WHERE NOT EXISTS (SELECT 1 FROM users WHERE role='admin')").bind(id,name,identity,hashedPassword).run();
         if(Number(created?.meta?.changes||0)!==1)return fail(409,"تم إنشاء حساب المدير الأول بالفعل؛ حدّث الصفحة وسجّل الدخول.");
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
      const user=await env.DB.prepare("SELECT u.id,u.display_name,u.identity_normalized,u.role,u.active,u.must_change_password FROM google_identities gi JOIN users u ON u.id=gi.user_id WHERE gi.google_sub=? LIMIT 1").bind(claims.sub).first();
      if(!user||user.active!==1)return fail(403,"حساب Google غير مربوط بحساب الأكاديمية. سجّل الدخول باسم المستخدم وكلمة المرور أولًا، ثم افتح الإعدادات واختر «ربط حساب Google».");
      if(user.must_change_password===1)return fail(403,"يجب تسجيل الدخول باسم المستخدم وتغيير كلمة المرور المؤقتة أولًا، ثم ربط Google من الإعدادات.");
      const token=hex(crypto.getRandomValues(new Uint8Array(32))),remember=b.remember===true,lifetime=(remember?30*24:12)*60*60*1000;
      await env.DB.prepare("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)").bind(await hashToken(token),user.id,new Date(Date.now()+lifetime).toISOString()).run();
      const student=user.role==="student"?await env.DB.prepare("SELECT id,group_id FROM students WHERE user_id=? AND active=1").bind(user.id).first():null;
      await log(env,user.id,"google_login");
      return sessionResponse({user:safeUser({id:user.id,name:user.display_name,email:user.identity_normalized,role:user.role,must_change_password:user.must_change_password===1,student_id:student&&student.id,group_id:student&&student.group_id})},token,remember);
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
      return sessionResponse({user:safeUser({id:user.id,name:user.display_name,email:user.identity_normalized,role:user.role,must_change_password:user.must_change_password===1,student_id:student?.id,group_id:student?.group_id})},token,remember);
    }
    if (!path.startsWith("/api/")) return env.ASSETS.fetch(request);
    if (path === "/api/logout" && method === "POST") {
      const legacyBearer = bearerSessionToken(request);
      const cookieToken = cookieSessionToken(request);
      if (!legacyBearer && cookieToken && !csrfIsValid(request)) return fail(403,"تعذّر التحقق من حماية الطلب. حدّث الصفحة ثم أعد المحاولة.");
      const token = requestSessionToken(request);
      if (token) await env.DB.prepare("DELETE FROM sessions WHERE token_hash=?").bind(await hashToken(token)).run();
      return clearedSessionResponse({ok:true});
    }
    // مسح رمز البطاقة: يُستدعى قبل بوابة الدخول لأن رمز «الدخول السريع» يُقرأ
    // بلا جلسة (ولا يسجّل الدخول تلقائيًا)، وبقية الأنواع تتطلب جلسة وصلاحية.
    if (path === "/api/cards/resolve" && method === "POST") {
      if (!bearerSessionToken(request) && cookieSessionToken(request) && !csrfIsValid(request)) return fail(403,"تعذّر التحقق من حماية الطلب. حدّث الصفحة ثم أعد المحاولة.");
      const parsed=await parseBody(request,4000);if(parsed.error)return parsed.error;const b=parsed.value;
      const kind=clean(b.kind,20),task=clean(b.task,20),cardId=clean(b.card_id,80),secret=clean(b.secret,80);
      if(!CARD_KINDS[kind])return fail(400,"نوع رمز البطاقة غير معروف");
      if(!cardId||!secret)return fail(400,"رمز البطاقة غير مكتمل");
      // حدّ المسح لكل بطاقة على حدة (لا لكل جهاز) حتى يستطيع الشيخ مسح بطاقات فوجه
      // كاملة من جهاز واحد، مع حماية كل بطاقة من تخمين الرمز السري.
      const limited=await rateLimit(env,"card-resolve:"+kind,kind==="login"?cardId:rateLimitKey(request),kind==="login"?12:300,600);
      if(!limited.allowed)return json({error:"محاولات مسح كثيرة خلال وقت قصير. انتظر قليلًا ثم أعد المحاولة.",retry_after:limited.retry_after},429,{"retry-after":String(limited.retry_after)});
      const card=await cardRecord(env,cardId);
      if(!card||!await verifyCardToken(card,kind,secret))return fail(404,"رمز البطاقة غير صالح أو منتهٍ. اطلب إعادة إصداره من الإدارة.");
      const student=await studentCardRow(env,card.student_id);
      if(!student)return fail(404,"ملف الطالب غير متاح");
      if(kind==="login"){
        await log(env,null,"student_card_scan_login",{card_id:card.id,student_id:student.id});
        return json({ok:true,kind,requires_password:true,student:{name:student.name,username:student.username||"",group_name:student.group_name||""},message:"امسح البطاقة ثم أدخل كلمة المرور. لا يتم الدخول تلقائيًا حفاظًا على الخصوصية."});
      }
      const scanner=await currentUser(request,env);
      if(!scanner)return fail(401,"سجّل الدخول أولًا ثم أعد مسح البطاقة.");
      if(!await canAccessStudentCard(env,scanner,student))return fail(403,"هذه البطاقة خارج صلاحيتك");
      if(kind==="add_points"&&!["admin","teacher","director","supervisor"].includes(scanner.role))return fail(403,"مسح بطاقة إضافة النقاط متاح للمشرفين المصرح لهم فقط");
      let attendance=null;
      let attendanceAwards=[];
      if(kind==="add_points"&&task==="attendance"){
        const date=academyDate();
        const row={id:date+":"+student.id,student_id:student.id,group_id:student.group_id,date,status:"present",note:"تسجيل حضور آلي بمسح بطاقة الطالب",marked_by:scanner.id,updated_at:nowIso()};
        await env.DB.prepare("INSERT INTO academy_records(collection,id,owner_user_id,group_id,student_id,payload_json,updated_at) VALUES('attendance',?,?,?,?,?,?) ON CONFLICT(collection,id) DO UPDATE SET owner_user_id=excluded.owner_user_id,group_id=excluded.group_id,student_id=excluded.student_id,payload_json=excluded.payload_json,updated_at=excluded.updated_at").bind(row.id,scanner.id,student.group_id,student.id,JSON.stringify(row),row.updated_at).run();
        await awardAttendancePoints(env,{groupId:student.group_id,date,studentIds:[student.id],awardedBy:scanner.id});
        attendance={date,status:"present",automatic:true};
        attendanceAwards=(await env.DB.prepare("SELECT kind,points,event_key FROM point_events WHERE student_id=? AND event_type='attendance_present' AND awarded_date=? AND event_key=? AND reversed_at IS NULL").bind(student.id,date,"attendance:"+date+":"+student.id).all()).results||[];
      }
      let hifzAwards=[];
      if(kind==="add_points"&&task==="hifz"){
        const date=academyDate();
        hifzAwards=await awardPointsForEvent(env,{studentId:student.id,groupId:student.group_id,eventType:"hifz_no_errors",eventKey:"hifz:"+date+":"+student.id,date,reason:"اعتماد حفظ الطالب بمسح البطاقة",sourceCollection:"student_card_scan",sourceId:date+":"+student.id,awardedBy:scanner.id});
      }
      const totals=await pointsTotals(env,student.id);
      await log(env,scanner.id,"student_card_scan_"+kind,{card_id:card.id,student_id:student.id});
      return json({ok:true,kind,student:{id:student.id,name:student.name,group_id:student.group_id,group_name:student.group_name||""},totals,attendance,attendance_awards:attendanceAwards,hifz_awards:hifzAwards,next:kind==="add_points"?"points":"profile"});
    }
    const user=await currentUser(request,env); if(!user)return fail(401,"يرجى تسجيل الدخول");
    if (!bearerSessionToken(request) && cookieSessionToken(request) && ["POST","PUT","PATCH","DELETE"].includes(method) && !csrfIsValid(request)) return fail(403,"تعذّر التحقق من حماية الطلب. حدّث الصفحة ثم أعد المحاولة.");
    if(user.must_change_password && !["/api/me","/api/me/password","/api/logout"].includes(path))return fail(403,"يجب تغيير كلمة المرور المؤقتة قبل متابعة استخدام الأكاديمية.");
    try { await ensureLearningSchema(env); } catch (error) {
      if (path.startsWith("/api/points") || path.startsWith("/api/store")) return fail(503, "تعذّر تهيئة جداول النقاط والمتجر. أعد المحاولة بعد قليل.");
    }
    try { await ensureQuranSchema(env); } catch (error) {
      if (/^\/api\/quran\/(path|today|daily|companion|stations|makeups|summary)/.test(path)) return fail(503, "تعذّر تهيئة جداول مسار القرآن. أعد المحاولة بعد قليل.");
    }
    try { await ensureCompetitionSchema(env); } catch (error) {
      if (path.startsWith("/api/competitions") || path.startsWith("/api/competition-")) return fail(503, "تعذّر تهيئة جداول المسابقات. أعد المحاولة بعد قليل.");
    }
    if(path==="/api/auth/google/link"&&method==="POST"){
      if(user.must_change_password)return fail(403,"غيّر كلمة المرور المؤقتة قبل ربط Google.");
      const clientId=clean(env.GOOGLE_CLIENT_ID,300);
      if(!clientId.endsWith(".apps.googleusercontent.com"))return fail(503,"الدخول بجوجل غير مهيأ بعد.");
      const parsed=await parseBody(request,18000);if(parsed.error)return parsed.error;
      const b=parsed.value,credential=String(b.credential||""),nonce=String(b.nonce||"");
      if(!credential||!/^[a-f0-9]{48,96}$/i.test(nonce))return fail(400,"تعذر بدء التحقق من حساب Google. أعد المحاولة.");
      let claims;try{claims=await verifyGoogleIdToken(credential,nonce,clientId)}catch(error){if(String(error&&(error.message||error))==="google_keys_unavailable")return fail(503,"تعذر الاتصال بخدمة التحقق من Google. أعد المحاولة.");return fail(401,"لم نستطع التحقق من حساب Google. أعد المحاولة.");}
      const existing=await env.DB.prepare("SELECT user_id FROM google_identities WHERE google_sub=? LIMIT 1").bind(claims.sub).first();
      if(existing&&existing.user_id!==user.id)return fail(409,"حساب Google هذا مربوط بحساب آخر في الأكاديمية. تواصل مع الإدارة لفك الربط بأمان.");
      try{
        await env.DB.prepare("INSERT INTO google_identities (google_sub,user_id,email,linked_at) VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET google_sub=excluded.google_sub,email=excluded.email,linked_at=excluded.linked_at").bind(claims.sub,user.id,clean(claims.email,200).toLowerCase(),nowIso()).run();
      }catch(error){return fail(409,"تعذر ربط حساب Google؛ قد يكون مرتبطًا بحساب آخر. لم تُحذف أي بيانات.");}
      await log(env,user.id,"google_link",{email:clean(claims.email,200).toLowerCase()});
      return json({ok:true,message:"تم ربط حساب Google بحساب الأكاديمية الحالي."});
    }
    if(path==="/api/me/password"&&method==="POST"){
      const parsed=await parseBody(request);if(parsed.error)return parsed.error;const b=parsed.value;
      const currentPassword=String(b.current_password||""),newPassword=String(b.new_password||"");
      if(!currentPassword||newPassword.length<10||newPassword.length>256)return fail(400,"أدخل كلمة المرور الحالية، واجعل الجديدة 10 أحرف على الأقل");
      const stored=await env.DB.prepare("SELECT password_hash FROM users WHERE id=? AND active=1").bind(user.id).first();
      if(!stored||!await verifyPassword(currentPassword,stored.password_hash))return fail(401,"كلمة المرور الحالية غير صحيحة");
      if(currentPassword===newPassword)return fail(400,"اختر كلمة مرور جديدة مختلفة");
      await env.DB.prepare("UPDATE users SET password_hash=?,must_change_password=0 WHERE id=?").bind(await passwordHash(newPassword),user.id).run();
      const currentToken=requestSessionToken(request);
      if(currentToken)await env.DB.prepare("DELETE FROM sessions WHERE user_id=? AND token_hash<>?").bind(user.id,await hashToken(currentToken)).run();
      await log(env,user.id,"password_change",{});
      return json({ok:true,message:"تم تغيير كلمة المرور وإبطال الجلسات الأخرى"});
    }
    if(path==="/api/me"&&method==="GET"){const linked=await env.DB.prepare("SELECT 1 AS linked FROM google_identities WHERE user_id=? LIMIT 1").bind(user.id).first();return json({...safeUser(user),google_linked:Boolean(linked)});}
    // ------------------------------------------------------------------
    // طلبات الانضمام (للمسجلين): تقديم/إلغاء/عرض/اعتماد
    // ------------------------------------------------------------------
    if(path==="/api/join/my-requests"&&method==="GET"){
      const rows=await env.DB.prepare(JOIN_SELECT+" WHERE jr.user_id=? ORDER BY jr.created_at DESC LIMIT 20").bind(user.id).all();
      return json((rows.results||[]).map(joinRequestJson));
    }
    if(path==="/api/join/requests"&&method==="POST"){
      if(!["student","visitor"].includes(user.role))return fail(403,"تقديم طلب انضمام متاح لحسابات الطلاب والزائرين/المحسنين");
      const limited=await rateLimit(env,"join-request",user.id,20,86400);
      if(!limited.allowed)return fail(429,"طلبات انضمام كثيرة خلال وقت قصير. حاول لاحقًا.");
      const parsed=await parseBody(request); if(parsed.error)return parsed.error; const b=parsed.value;
      const kind=clean(b.kind,20),schoolId=clean(b.school_id,80),note=clean(b.note,500);
      if(!JOIN_KINDS.includes(kind))return fail(400,"نوع الطلب غير صحيح");
      const pending=await env.DB.prepare("SELECT id FROM join_requests WHERE user_id=? AND kind=? AND status='pending' LIMIT 1").bind(user.id,kind).first();
      if(pending)return fail(409,kind==="teacher_request"?"لديك طلب انضمام بصفة شيخ/معلم قيد المراجعة بالفعل":"لديك طلب انضمام قيد المراجعة بالفعل");
      if(kind==="school_join"){
        if(user.role==="student"&&user.group_id)return fail(409,"أنت مسجّل في فوج بالفعل؛ لا حاجة لطلب انضمام جديد");
        if(!schoolId)return fail(400,"اختر المدرسة التي تريد الانضمام إليها");
        const school=await env.DB.prepare("SELECT id FROM quran_schools WHERE id=? AND active=1").bind(schoolId).first();
        if(!school)return fail(400,"المدرسة غير موجودة أو غير نشطة");
        const id=uuid();
        await env.DB.prepare("INSERT INTO join_requests (id,user_id,kind,school_id,requested_note,status) VALUES (?,?,'school_join',?,?,'pending')").bind(id,user.id,schoolId,note).run();
        await log(env,user.id,"join_request_create",{request_id:id,kind,school_id:schoolId});
        const created=await joinRequestById(env,id);
        return json({ok:true,request:joinRequestJson(created)},201);
      }
      // teacher_request — متاح للزائر/المحسن والطالب، ويبقى بلا صلاحية حتى الاعتماد
      if(user.role==="teacher")return fail(409,"أنت شيخ/معلم بالفعل");
      const approved=await env.DB.prepare("SELECT id FROM join_requests WHERE user_id=? AND kind='teacher_request' AND status='approved' LIMIT 1").bind(user.id).first();
      if(approved)return fail(409,"سبق اعتماد طلبك بصفة شيخ/معلم");
      const id=uuid();
      await env.DB.prepare("INSERT INTO join_requests (id,user_id,kind,requested_note,status) VALUES (?,?,'teacher_request',?,'pending')").bind(id,user.id,note).run();
      await log(env,user.id,"join_request_create",{request_id:id,kind});
      const created=await joinRequestById(env,id);
      return json({ok:true,request:joinRequestJson(created)},201);
    }
    const joinCancelMatch=path.match(/^\/api\/join\/requests\/([^/]+)\/cancel$/);
    if(joinCancelMatch&&method==="POST"){
      const row=await joinRequestById(env,joinCancelMatch[1]);
      if(!row)return fail(404,"الطلب غير موجود");
      if(row.user_id!==user.id)return fail(403,"لا يمكنك إلغاء طلب غيرك");
      if(row.status!=="pending")return fail(409,"لا يمكن إلغاء طلب تمت مراجعته بالفعل");
      await env.DB.prepare("UPDATE join_requests SET status='cancelled' WHERE id=? AND status='pending'").bind(row.id).run();
      await log(env,user.id,"join_request_cancel",{request_id:row.id});
      return json({ok:true});
    }
    if(path==="/api/join/requests"&&method==="GET"){
      if(!["admin","director","teacher"].includes(user.role))return fail(403,"مراجعة طلبات الانضمام متاحة للشيخ أو المسؤول المخوّل فقط");
      const status=clean(url.searchParams.get("status"),20)||"pending";
      if(!JOIN_STATUSES.includes(status))return fail(400,"حالة غير صحيحة");
      let sql=JOIN_SELECT+" WHERE jr.status=?",binds=[status];
      if(user.role==="director"){
        const ids=Array.isArray(user.school_ids)?[...new Set(user.school_ids.filter(Boolean))]:[];
        const teacherMarks="?";
        if(ids.length){
          const marks=ids.map(()=>"?").join(",");
          sql+=" AND (jr.kind='teacher_request' OR jr.school_id IN ("+marks+"))";
          binds.push(...ids);
        } else {
          sql+=" AND jr.kind='teacher_request'";
        }
      } else if(user.role==="teacher"){
        sql+=" AND jr.kind='school_join' AND EXISTS (SELECT 1 FROM groups g WHERE g.school_id=jr.school_id AND g.teacher_id=? AND g.active=1)";
        binds.push(user.id);
      }
      sql+=" ORDER BY jr.created_at ASC LIMIT 100";
      const rows=await env.DB.prepare(sql).bind(...binds).all();
      return json((rows.results||[]).map(joinRequestJson));
    }
    // مجموعات يمكن الاعتماد عليها عند قبول طلب انضمام مدرسة: نشطة وضمن نفس المدرسة
    if(path==="/api/join/assignable-groups"&&method==="GET"){
      if(!["admin","director","teacher"].includes(user.role))return fail(403,"غير مسموح");
      const schoolId=clean(url.searchParams.get("school_id"),80);
      if(!schoolId)return fail(400,"حدد المدرسة");
      if(user.role==="director"&&!(Array.isArray(user.school_ids)&&user.school_ids.includes(schoolId)))return fail(403,"هذه المدرسة خارج نطاقك");
      if(user.role==="teacher"&&!await teacherTeachesSchool(env,user.id,schoolId))return fail(403,"هذه المدرسة خارج نطاقك");
      const rows=await env.DB.prepare("SELECT id,name,school_id,teacher_id FROM groups WHERE active=1 AND school_id=? ORDER BY name").bind(schoolId).all();
      return json(rows.results||[]);
    }
    const joinDecisionMatch=path.match(/^\/api\/join\/requests\/([^/]+)\/decision$/);
    if(joinDecisionMatch&&method==="POST"){
      if(!["admin","director","teacher"].includes(user.role))return fail(403,"اعتماد طلبات الانضمام متاح للمسؤول المخوّل فقط");
      const row=await joinRequestById(env,joinDecisionMatch[1]);
      if(!row)return fail(404,"الطلب غير موجود");
      if(row.status!=="pending")return json({ok:true,request:joinRequestJson(row),already:true});
      if(!await canDecideJoinRequest(env,user,row))return fail(403,"هذا الطلب خارج صلاحيتك");
      const parsed=await parseBody(request); if(parsed.error)return parsed.error; const b=parsed.value;
      const decision=clean(b.decision,20),decisionNote=clean(b.decision_note,500),groupId=clean(b.group_id,80);
      if(!["approved","rejected"].includes(decision))return fail(400,"القرار يجب أن يكون approved أو rejected");
      if(decision==="approved"){
        if(row.kind==="school_join"){
          if(!groupId)return fail(400,"اختر الفوج الذي سيُسند إليه الطالب قبل الاعتماد");
          const group=await groupRow(env,groupId);
          if(!group||group.active!==1)return fail(400,"الفوج غير موجود أو غير نشط");
          if(row.school_id&&group.school_id!==row.school_id)return fail(400,"الفوج المختار لا يتبع المدرسة المطلوبة في الطلب");
          if(!row.school_id)row.school_id=group.school_id||null;
          const existingStudent=await env.DB.prepare("SELECT id FROM students WHERE user_id=? LIMIT 1").bind(row.user_id).first();
          if(existingStudent)await env.DB.prepare("UPDATE students SET group_id=?,active=1 WHERE id=?").bind(groupId,existingStudent.id).run();
          else await env.DB.prepare("INSERT INTO students (id,user_id,display_name,group_id,active) VALUES (?,?,?,?,1)").bind(uuid(),row.user_id,row.user_name||"طالب",groupId).run();
          await env.DB.prepare("UPDATE users SET role='student' WHERE id=? AND role='visitor'").bind(row.user_id).run();
          await env.DB.prepare("UPDATE join_requests SET status='approved',decided_by=?,decided_at=?,decision_note=?,group_id=?,school_id=? WHERE id=? AND status='pending'").bind(user.id,nowIso(),decisionNote,groupId,row.school_id||null,row.id).run();
        } else { // teacher_request — الضمان الوحيد للدور هو هذا القرار بمسؤول مخوّل
          await env.DB.prepare("UPDATE users SET role='teacher' WHERE id=? AND role IN ('visitor','student')").bind(row.user_id).run();
          await env.DB.prepare("UPDATE join_requests SET status='approved',decided_by=?,decided_at=?,decision_note=? WHERE id=? AND status='pending'").bind(user.id,nowIso(),decisionNote,row.id).run();
        }
      } else {
        await env.DB.prepare("UPDATE join_requests SET status='rejected',decided_by=?,decided_at=?,decision_note=? WHERE id=? AND status='pending'").bind(user.id,nowIso(),decisionNote,row.id).run();
      }
      await log(env,user.id,"join_request_decision",{request_id:row.id,kind:row.kind,decision,group_id:groupId||null});
      const updated=await joinRequestById(env,row.id);
      return json({ok:true,request:joinRequestJson(updated)});
    }
    if(path==="/api/dashboard"&&method==="GET"){
      const isAdmin=user.role==="admin";
      const staffRoles=["admin","teacher","director","supervisor"];
      const isStaff=staffRoles.includes(user.role);
      let groupIds=null;
      if(!isAdmin&&isStaff)groupIds=await managedGroupIds(env,user);
      const today=academyDate();
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
    const teacherGroupMatch=path.match(/^\/api\/teacher\/groups\/([^/]+)$/);
    if(path==="/api/teacher/groups"&&method==="POST"){
      if(user.role!=="teacher")return fail(403,"إضافة الأفواج متاحة للشيخ فقط");
      const parsed=await parseBody(request);if(parsed.error)return parsed.error;const b=parsed.value;
      const name=clean(b.name,120),description=clean(b.description,600),level=clean(b.level,80)||"عام";
      if(!name)return fail(400,"اسم الفوج مطلوب");
      const own=await env.DB.prepare("SELECT school_id FROM groups WHERE teacher_id=? AND active=1 ORDER BY name LIMIT 1").bind(user.id).first();
      const schoolId=own?.school_id||"qs-rahman";
      const school=await env.DB.prepare("SELECT id FROM quran_schools WHERE id=? AND active=1").bind(schoolId).first();
      if(!school)return fail(400,"لا توجد مدرسة نشطة مسندة إليك؛ اطلب من الإدارة إسنادك إلى مدرسة أولًا");
      const id=uuid();
      await env.DB.prepare("INSERT INTO groups(id,name,school_id,teacher_id,active) VALUES(?,?,?,?,1)").bind(id,name,schoolId,user.id).run();
      await saveRecord(env,"group_metadata",{id:"group:"+id,group_id:id,owner_user_id:user.id,description,level,created_by:user.id,created_at:nowIso()});
      await log(env,user.id,"teacher_group_create",{id,name,school_id:schoolId});
      return json({id,name,school_id:schoolId,teacher_id:user.id,active:1,description,level},201);
    }
    if(teacherGroupMatch&&(method==="PATCH"||method==="DELETE")){
      if(user.role!=="teacher")return fail(403,"هذه العملية متاحة للشيخ فقط");
      const id=teacherGroupMatch[1],g=await groupRow(env,id);
      if(!g||g.active!==1)return fail(404,"الفوج غير موجود أو غير نشط");
      if(g.teacher_id!==user.id)return fail(403,"لا يمكنك تعديل فوج خارج نطاقك");
      if(method==="DELETE"){
        const count=await env.DB.prepare("SELECT COUNT(*) AS n FROM students WHERE group_id=? AND active=1").bind(id).first();
        if((count?.n||0)>0)return fail(409,"لا يمكن حذف فوج يضم طلابًا؛ انقل الطلاب أولًا أو عطّل الفوج من الإدارة");
        await env.DB.prepare("UPDATE groups SET active=0 WHERE id=? AND teacher_id=?").bind(id,user.id).run();
        await log(env,user.id,"teacher_group_deactivate",{id});
        return json({ok:true});
      }
      const parsed=await parseBody(request);if(parsed.error)return parsed.error;const b=parsed.value;
      const name=clean(b.name??g.name,120),description=clean(b.description??"",600),level=clean(b.level??"عام",80)||"عام";
      if(!name)return fail(400,"اسم الفوج مطلوب");
      await env.DB.prepare("UPDATE groups SET name=? WHERE id=? AND teacher_id=?").bind(name,id,user.id).run();
      await saveRecord(env,"group_metadata",{id:"group:"+id,group_id:id,owner_user_id:user.id,description,level,updated_at:nowIso()});
      await log(env,user.id,"teacher_group_update",{id,name});
      return json({ok:true,id,name,description,level});
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
      const resultRows=rows.results||[];
      const enriched=[];
      for(const g of resultRows){
        const meta=await env.DB.prepare("SELECT payload_json FROM academy_records WHERE collection='group_metadata' AND id=?").bind("group:"+g.id).first();
        let extra={};try{extra=meta?JSON.parse(meta.payload_json):{}}catch{}
        enriched.push({...g,description:extra.description||"",level:extra.level||"عام"});
      }
      return json(enriched);
    }
    if(path==="/api/groups"&&method==="POST"){
      if(user.role!=="admin"&&user.role!=="director")return fail(403,"إنشاء الأفواج للمدير العام أو مدير المدرسة"); const parsed=await parseBody(request);if(parsed.error)return parsed.error;
      const name=clean(parsed.value.name,120),teacherId=clean(parsed.value.teacher_id,80)||null;
      const schoolId=clean(parsed.value.school_id,80)||(user.role==="director"?(user.school_ids||[])[0]:"qs-rahman");
      if(!name)return fail(400,"اسم الفوج مطلوب");
      if(user.role==="director"&&!(user.school_ids||[]).includes(schoolId))return fail(403,"هذه المدرسة خارج نطاق صلاحيتك");
      const school=await env.DB.prepare("SELECT id FROM quran_schools WHERE id=? AND active=1").bind(schoolId).first();if(!school)return fail(400,"المدرسة المحددة غير موجودة");
      if(teacherId){const t=await env.DB.prepare("SELECT id FROM users WHERE id=? AND role IN ('teacher','admin') AND active=1").bind(teacherId).first();if(!t)return fail(400,"المعلم المحدد غير صالح");}
      const requestedId=clean(parsed.value.id,80);if(requestedId&&!/^offline-[a-f0-9-]{20,60}$/i.test(requestedId))return fail(400,"معرّف الفوج غير صالح");const id=requestedId||uuid(),existing=requestedId?await groupRow(env,id):null;if(existing){if(existing.name!==name||existing.school_id!==schoolId||(existing.teacher_id||null)!==(teacherId||null))return fail(409,"يتعارض معرّف الفوج مع سجل موجود؛ لم تُغيّر البيانات");return json(existing,200)}await env.DB.prepare("INSERT INTO groups(id,name,school_id,teacher_id,active) VALUES(?,?,?,?,1)").bind(id,name,schoolId,teacherId).run();await log(env,user.id,"group_create",{id,name,school_id:schoolId});return json({id,name,school_id:schoolId,teacher_id:teacherId,active:1},201);
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
    if(path==="/api/admin/student-team-supervisors"&&method==="GET"){
      if(user.role!=="admin")return fail(403,"إدارة الفرق الطلابية من صلاحية المدير العام فقط");
      const result=await env.DB.prepare("SELECT payload_json FROM academy_records WHERE collection='student_team_supervisors' ORDER BY updated_at DESC").all();
      const assignments=[];
      for(const row of result.results||[]){try{const x=JSON.parse(row.payload_json);assignments.push({id:x.id,group_id:x.group_id,team_name:x.team_name||"الفرقة الأولى",supervisor_student_id:x.supervisor_student_id||x.student_id,supervisor_name:x.supervisor_name,head_supervisor_student_id:x.head_supervisor_student_id,head_supervisor_name:x.head_supervisor_name,updated_at:x.updated_at});}catch{}}
      return json(assignments);
    }
    if(path==="/api/admin/student-team-supervisors"&&method==="POST"){
      if(user.role!=="admin")return fail(403,"إدارة الفرق الطلابية من صلاحية المدير العام فقط");
      const parsed=await parseBody(request);if(parsed.error)return parsed.error;const b=parsed.value;
      const groupId=clean(b.group_id,80),teamName=clean(b.team_name,80),teamId=clean(b.team_id,100),supervisorId=clean(b.supervisor_student_id,80),headId=clean(b.head_supervisor_student_id,80);
      if(!groupId||!teamName||!supervisorId||!headId)return fail(400,"اختر الفوج واسم الفرقة ومشرفها وكبير المشرفين");
      if(supervisorId===headId)return fail(400,"اختر طالبين مختلفين لمهمة مشرف الفرقة وكبير المشرفين");
      const group=await groupRow(env,groupId);
      if(!group||group.active!==1)return fail(404,"الفوج المحدد غير موجود أو متوقف");
      const supervisor=await env.DB.prepare("SELECT id,display_name,group_id FROM students WHERE id=? AND group_id=? AND active=1").bind(supervisorId,groupId).first();
      if(!supervisor)return fail(400,"مشرف الفرقة يجب أن يكون طالبًا نشطًا من الفوج نفسه");
      const chief=await env.DB.prepare("SELECT id,display_name,group_id FROM students WHERE id=? AND group_id=? AND active=1").bind(headId,groupId).first();
      if(!chief)return fail(400,"كبير المشرفين يجب أن يكون طالبًا نشطًا من الفوج نفسه");
      let existing=null;
      if(teamId){
        const row=await env.DB.prepare("SELECT payload_json FROM academy_records WHERE collection='student_team_supervisors' AND id=?").bind(teamId).first();
        if(!row)return fail(404,"الفرقة المراد تعديلها غير موجودة");
        try{existing=JSON.parse(row.payload_json)}catch{}
        if(!existing||existing.group_id!==groupId)return fail(400,"لا يمكن نقل الفرقة إلى فوج آخر من شاشة التعديل؛ أنشئها ضمن الفوج الصحيح");
      }
      const approvalRows=await env.DB.prepare("SELECT payload_json FROM academy_records WHERE collection='student_team_supervisor_requests' AND student_id=? AND group_id=?").bind(supervisorId,groupId).all();
      const approved= (approvalRows.results||[]).some(row=>{try{return JSON.parse(row.payload_json).status==="approved"}catch{return false}});
      const currentSupervisor=existing&&(existing.supervisor_student_id||existing.student_id)===supervisorId;
      const existingTeam=await env.DB.prepare("SELECT id FROM academy_records WHERE collection='student_team_supervisors' AND group_id=? LIMIT 1").bind(groupId).first();
      if(!approved&&!currentSupervisor&&existingTeam)return fail(403,"لا يمكن تعيين الطالب مشرفًا قبل اعتماد طلبه من كبير المشرفين");
      const peers=await env.DB.prepare("SELECT payload_json FROM academy_records WHERE collection='student_team_supervisors' AND group_id=?").bind(groupId).all();
      for(const row of peers.results||[]){try{const x=JSON.parse(row.payload_json);if(String(x.id)!==teamId&&String(x.team_name||"الفرقة الأولى").trim().toLocaleLowerCase()===teamName.toLocaleLowerCase())return fail(409,"اسم هذه الفرقة مستخدم في الفوج؛ اختر اسمًا مميزًا");if(String(x.id)!==teamId&&(x.supervisor_student_id||x.student_id)===supervisor.id)return fail(409,"مشرف الفرقة معيّن بالفعل لفرقة أخرى");}catch{}}
      const id=teamId||uuid();
      for(const row of peers.results||[]){try{const x=JSON.parse(row.payload_json);if(String(x.id)===teamId)continue;if(x.head_supervisor_student_id!==chief.id){x.head_supervisor_student_id=chief.id;x.head_supervisor_name=chief.display_name;x.updated_at=nowIso();await saveRecord(env,"student_team_supervisors",x);}}catch{}}
      const assignment={id,owner_user_id:user.id,group_id:groupId,team_name:teamName,student_id:supervisor.id,supervisor_student_id:supervisor.id,supervisor_name:supervisor.display_name,head_supervisor_student_id:chief.id,head_supervisor_name:chief.display_name,updated_at:nowIso()};
      await saveRecord(env,"student_team_supervisors",assignment);
      await log(env,user.id,"student_team_supervisor_assign",{group_id:groupId,team_id:id,team_name:teamName,supervisor_student_id:supervisor.id,head_supervisor_student_id:chief.id});
      return json({ok:true,...assignment},201);
    }
    if(path==="/api/admin/chief-supervisors"&&method==="GET"){
      if(user.role!=="admin")return fail(403,"إدارة كبير المشرفين من صلاحية المدير العام فقط");
      const rows=await env.DB.prepare("SELECT payload_json FROM academy_records WHERE collection=? ORDER BY updated_at DESC").bind(GLOBAL_CHIEF_COLLECTION).all();
      const chiefs=[];
      for(const row of rows.results||[]){
        let value;try{value=JSON.parse(row.payload_json)}catch{continue}
        const student=await env.DB.prepare("SELECT s.id,s.display_name AS name,s.active,g.name AS group_name FROM students s LEFT JOIN groups g ON g.id=s.group_id WHERE s.id=?").bind(value.student_id||value.id).first();
        chiefs.push({student_id:value.student_id||value.id,student_name:student?.name||value.student_name||"",group_name:student?.group_name||value.group_name||"",student_active:student?student.active===1:false,active:value.active!==false,appointed_at:value.appointed_at||value.updated_at||""});
      }
      return json(chiefs);
    }
    if(path==="/api/admin/chief-supervisors"&&method==="POST"){
      if(user.role!=="admin")return fail(403,"تعيين كبير المشرفين من صلاحية المدير العام فقط");
      const parsed=await parseBody(request);if(parsed.error)return parsed.error;const b=parsed.value;
      const studentId=clean(b.student_id,80);
      if(!studentId)return fail(400,"اختر الطالب الذي سيصبح كبير المشرفين");
      const student=await env.DB.prepare("SELECT s.id,s.display_name,s.group_id,g.name AS group_name FROM students s LEFT JOIN groups g ON g.id=s.group_id WHERE s.id=? AND s.active=1").bind(studentId).first();
      if(!student)return fail(400,"كبير المشرفين يجب أن يكون طالبًا نشطًا");
      const existing=await env.DB.prepare("SELECT payload_json FROM academy_records WHERE collection=? AND id=?").bind(GLOBAL_CHIEF_COLLECTION,student.id).first();
      if(existing){let current;try{current=JSON.parse(existing.payload_json)}catch{};if(current&&current.active!==false)return fail(409,"هذا الطالب معيّن كبيرًا للمشرفين بالفعل")}
      const record={id:student.id,student_id:student.id,student_name:student.display_name,group_id:student.group_id,group_name:student.group_name||"",active:true,appointed_by:user.id,appointed_at:nowIso(),updated_at:nowIso()};
      await saveRecord(env,GLOBAL_CHIEF_COLLECTION,record);
      await log(env,user.id,"global_chief_appoint",{student_id:student.id,group_id:student.group_id});
      return json({ok:true,chief:record},201);
    }
    const chiefMatch=path.match(/^\/api\/admin\/chief-supervisors\/([^/]+)$/);
    if(chiefMatch&&method==="DELETE"){
      if(user.role!=="admin")return fail(403,"إلغاء كبير المشرفين من صلاحية المدير العام فقط");
      const row=await env.DB.prepare("SELECT payload_json FROM academy_records WHERE collection=? AND id=?").bind(GLOBAL_CHIEF_COLLECTION,chiefMatch[1]).first();
      if(!row)return fail(404,"كبير المشرفين غير موجود");
      let value;try{value=JSON.parse(row.payload_json)}catch{return fail(500,"تعذر قراءة بيانات كبير المشرفين")}
      value.active=false;value.revoked_by=user.id;value.revoked_at=nowIso();value.updated_at=nowIso();
      await saveRecord(env,GLOBAL_CHIEF_COLLECTION,value);
      await log(env,user.id,"global_chief_revoke",{student_id:value.student_id||value.id});
      return json({ok:true});
    }
    if(path==="/api/student-teams"&&method==="GET"){
      let groupId=clean(url.searchParams.get("group_id"),80),currentStudent=null,isTeamSupervisor=false,isChiefSupervisor=false,isGlobalChief=false,chiefGroups=[];
      if(user.role==="student"){
        currentStudent=await env.DB.prepare("SELECT id,group_id,display_name FROM students WHERE user_id=? AND active=1 LIMIT 1").bind(user.id).first();
        if(!currentStudent)return fail(404,"ملف الطالب غير موجود");
        isGlobalChief=await isGlobalChiefStudent(env,currentStudent.id);
        if(isGlobalChief){
          const groupRows=await env.DB.prepare("SELECT id,name FROM groups WHERE active=1 ORDER BY name").all();
          chiefGroups=(groupRows.results||[]).map(row=>({id:row.id,name:row.name}));
          if(!groupId||!chiefGroups.some(g=>g.id===groupId))groupId=currentStudent.group_id;
        }else groupId=currentStudent.group_id;
      }else{
        if(!groupId)return fail(400,"حدّد الفوج لعرض فرقه");
        if(!await canManageGroup(env,user,groupId))return fail(403,"هذا الفوج خارج صلاحيتك");
      }
      const teamRows=await env.DB.prepare("SELECT payload_json FROM academy_records WHERE collection='student_team_supervisors' AND group_id=? ORDER BY updated_at").bind(groupId).all();
      const teams=(teamRows.results||[]).flatMap(row=>{try{const x=JSON.parse(row.payload_json);return [{id:x.id,group_id:x.group_id,team_name:x.team_name||"الفرقة الأولى",supervisor_student_id:x.supervisor_student_id||x.student_id,supervisor_name:x.supervisor_name||"",head_supervisor_student_id:x.head_supervisor_student_id||"",head_supervisor_name:x.head_supervisor_name||""}]}catch{return []}});
      if(currentStudent){isTeamSupervisor=teams.some(t=>t.supervisor_student_id===currentStudent.id);isChiefSupervisor=isGlobalChief||teams.some(t=>t.head_supervisor_student_id===currentStudent.id);}
      const memberRows=await env.DB.prepare("SELECT payload_json FROM academy_records WHERE collection='student_team_memberships' AND group_id=? ORDER BY updated_at DESC").bind(groupId).all();
      let memberships=(memberRows.results||[]).flatMap(row=>{try{return [JSON.parse(row.payload_json)]}catch{return []}});
      const requestRows=await env.DB.prepare("SELECT payload_json FROM academy_records WHERE collection='student_team_transfer_requests' AND group_id=? ORDER BY updated_at DESC").bind(groupId).all();
      let requests=(requestRows.results||[]).flatMap(row=>{try{return [JSON.parse(row.payload_json)]}catch{return []}});
      const supervisorRequestRows=await env.DB.prepare("SELECT payload_json FROM academy_records WHERE collection='student_team_supervisor_requests' AND group_id=? ORDER BY updated_at DESC").bind(groupId).all();
      let supervisorRequests=(supervisorRequestRows.results||[]).flatMap(row=>{try{return [JSON.parse(row.payload_json)]}catch{return []}});
      if(currentStudent){
        if(isTeamSupervisor)memberships=memberships.filter(m=>teams.some(t=>t.id===m.team_id&&t.supervisor_student_id===currentStudent.id));
        else memberships=memberships.filter(m=>m.student_id===currentStudent.id);
        if(!isChiefSupervisor)requests=requests.filter(r=>r.student_id===currentStudent.id);
        else requests=requests.filter(r=>r.status==="pending");
        if(!isChiefSupervisor)supervisorRequests=supervisorRequests.filter(r=>r.student_id===currentStudent.id);
        else supervisorRequests=supervisorRequests.filter(r=>r.status==="pending");
      }
      const teamById=new Map(teams.map(t=>[t.id,t]));
      memberships=memberships.map(m=>({...m,team_name:teamById.get(m.team_id)?.team_name||m.team_name||"فرقة غير متاحة"}));
      const eligibleRows=currentStudent&&isTeamSupervisor?await env.DB.prepare("SELECT s.id,s.display_name AS name,(SELECT json_extract(ar.payload_json,'$.team_id') FROM academy_records ar WHERE ar.collection='student_team_memberships' AND ar.student_id=s.id LIMIT 1) AS assigned_team_id FROM students s WHERE s.group_id=? AND s.active=1 ORDER BY s.display_name").bind(groupId).all():{results:[]};
      let currentMembership=null;if(currentStudent){const currentRow=await env.DB.prepare("SELECT payload_json FROM academy_records WHERE collection='student_team_memberships' AND id=?").bind(currentStudent.id).first();if(currentRow){try{currentMembership=JSON.parse(currentRow.payload_json)}catch{}}}
      const approvedSupervisorIds=supervisorRequests.filter(r=>r.status==="approved").map(r=>r.student_id);
      return json({group_id:groupId,current_student_id:currentStudent?.id||null,current_membership:currentMembership,teams,memberships,requests,supervisor_requests:supervisorRequests,approved_supervisor_ids:approvedSupervisorIds,eligible_students:eligibleRows.results||[],is_chief_supervisor:isChiefSupervisor,is_global_chief:isGlobalChief,chief_groups:chiefGroups,can_assign_members:!currentStudent||isTeamSupervisor,can_approve_transfers:user.role==="admin"||isChiefSupervisor,can_approve_supervisor_requests:user.role==="admin"||isChiefSupervisor});
    }
    if(path==="/api/student-team-supervisor-requests"&&method==="POST"){
      if(user.role!=="student")return fail(403,"طلبات الانضمام إلى مشرفي الفرق مخصصة للطلبة");
      const student=await env.DB.prepare("SELECT id,display_name,group_id FROM students WHERE user_id=? AND active=1 LIMIT 1").bind(user.id).first();
      if(!student)return fail(404,"ملف الطالب غير موجود");
      const assignments=await env.DB.prepare("SELECT payload_json FROM academy_records WHERE collection='student_team_supervisors' AND group_id=?").bind(student.group_id).all();
      if((assignments.results||[]).some(row=>{try{return JSON.parse(row.payload_json).supervisor_student_id===student.id}catch{return false}}))return fail(409,"أنت مشرف فرقة بالفعل");
      const existing=await env.DB.prepare("SELECT payload_json FROM academy_records WHERE collection='student_team_supervisor_requests' AND student_id=? AND group_id=?").bind(student.id,student.group_id).all();
      for(const row of existing.results||[]){try{const x=JSON.parse(row.payload_json);if(["pending","approved"].includes(x.status))return fail(409,x.status==="approved"?"سبق اعتمادك ضمن مشرفي الفرق":"لديك طلب انضمام قيد المراجعة بالفعل")}catch{}}
      const record={id:uuid(),student_id:student.id,student_name:student.display_name,group_id:student.group_id,status:"pending",requested_at:nowIso(),updated_at:nowIso()};
      await saveRecord(env,"student_team_supervisor_requests",record);
      await log(env,user.id,"student_team_supervisor_request",{request_id:record.id,student_id:student.id,group_id:student.group_id});
      return json({ok:true,request:record},201);
    }
    const supervisorRequestDecision=path.match(/^\/api\/student-team-supervisor-requests\/([^/]+)\/decision$/);
    if(supervisorRequestDecision&&method==="POST"){
      const parsed=await parseBody(request);if(parsed.error)return parsed.error;const decision=clean(parsed.value.decision,20);
      if(!["approve","reject"].includes(decision))return fail(400,"اختر الموافقة أو الرفض");
      const row=await env.DB.prepare("SELECT payload_json FROM academy_records WHERE collection='student_team_supervisor_requests' AND id=?").bind(supervisorRequestDecision[1]).first();
      if(!row)return fail(404,"طلب الانضمام غير موجود");
      let supervisorRequest;try{supervisorRequest=JSON.parse(row.payload_json)}catch{return fail(500,"تعذر قراءة طلب الانضمام")};
      if(supervisorRequest.status!=="pending")return fail(409,"تمت معالجة هذا الطلب من قبل");
      let authorized=user.role==="admin";
      if(user.role==="student"){
        const actor=await env.DB.prepare("SELECT id,group_id FROM students WHERE user_id=? AND active=1 LIMIT 1").bind(user.id).first();
        if(actor){
          authorized=await isGlobalChiefStudent(env,actor.id);
          if(!authorized&&actor.group_id===supervisorRequest.group_id){
            const chiefRows=await env.DB.prepare("SELECT payload_json FROM academy_records WHERE collection='student_team_supervisors' AND group_id=?").bind(supervisorRequest.group_id).all();
            authorized=(chiefRows.results||[]).some(r=>{try{return JSON.parse(r.payload_json).head_supervisor_student_id===actor.id}catch{return false}});
          }
        }
      }
      if(!authorized)return fail(403,"اعتماد مشرفي الفرق من صلاحية كبير المشرفين المعيّن أو المدير العام");
      if(decision==="approve"){
        const student=await env.DB.prepare("SELECT id,display_name,group_id,active FROM students WHERE id=? AND group_id=? AND active=1").bind(supervisorRequest.student_id,supervisorRequest.group_id).first();
        if(!student)return fail(409,"الطالب لم يعد نشطًا في الفوج");
        supervisorRequest.status="approved";
      }else supervisorRequest.status="rejected";
      supervisorRequest.decided_by=user.id;supervisorRequest.decided_at=nowIso();supervisorRequest.updated_at=nowIso();
      await saveRecord(env,"student_team_supervisor_requests",supervisorRequest);
      await log(env,user.id,"student_team_supervisor_request_decision",{request_id:supervisorRequest.id,student_id:supervisorRequest.student_id,group_id:supervisorRequest.group_id,decision});
      return json({ok:true,request:supervisorRequest});
    }
    if(path==="/api/student-team-memberships"&&method==="POST"){
      const parsed=await parseBody(request);if(parsed.error)return parsed.error;const b=parsed.value;
      const studentId=clean(b.student_id,80),teamId=clean(b.team_id,100);
      if(!studentId||!teamId)return fail(400,"اختر الطالب والفرقة");
      const teamRow=await env.DB.prepare("SELECT payload_json FROM academy_records WHERE collection='student_team_supervisors' AND id=?").bind(teamId).first();
      if(!teamRow)return fail(404,"الفرقة غير موجودة");
      let team;try{team=JSON.parse(teamRow.payload_json)}catch{return fail(500,"تعذر قراءة بيانات الفرقة")};
      let actorStudent=null;
      if(user.role==="student"){
        actorStudent=await env.DB.prepare("SELECT id,group_id FROM students WHERE user_id=? AND active=1 LIMIT 1").bind(user.id).first();
        if(!actorStudent||actorStudent.group_id!==team.group_id||team.supervisor_student_id!==(actorStudent.id))return fail(403,"إضافة الطلبة إلى الفرقة من صلاحية مشرف الفرقة المعيّن فقط");
      }else if(!["admin","teacher","director","supervisor"].includes(user.role)||!await canManageGroup(env,user,team.group_id))return fail(403,"لا تملك صلاحية إدارة أعضاء هذا الفوج");
      const student=await env.DB.prepare("SELECT id,display_name,group_id,active FROM students WHERE id=? AND active=1").bind(studentId).first();
      if(!student||student.group_id!==team.group_id)return fail(400,"يجب أن يكون الطالب نشطًا ومن الفوج نفسه");
      const oldRow=await env.DB.prepare("SELECT payload_json FROM academy_records WHERE collection='student_team_memberships' AND id=?").bind(studentId).first();
      if(oldRow){let old;try{old=JSON.parse(oldRow.payload_json)}catch{};if(old?.team_id===team.id)return json({ok:true,already_assigned:true,membership:old});if(old?.team_id)return fail(409,"الطالب ضمن فرقة أخرى؛ يجب تقديم طلب نقل رسمي والموافقة عليه");}
      const membership={id:student.id,student_id:student.id,student_name:student.display_name,group_id:team.group_id,team_id:team.id,team_name:team.team_name||"الفرقة الأولى",assigned_by:user.id,updated_at:nowIso()};
      await saveRecord(env,"student_team_memberships",membership);
      await log(env,user.id,"student_team_member_assign",{student_id:student.id,group_id:team.group_id,team_id:team.id});
      return json({ok:true,membership},201);
    }
    if(path==="/api/student-team-transfer-requests"&&method==="POST"){
      if(user.role!=="student")return fail(403,"طلبات الانتقال مخصصة للطلبة");
      const parsed=await parseBody(request);if(parsed.error)return parsed.error;const b=parsed.value,targetTeamId=clean(b.target_team_id,100);
      if(!targetTeamId)return fail(400,"اختر الفرقة التي تريد الانتقال إليها");
      const student=await env.DB.prepare("SELECT id,display_name,group_id FROM students WHERE user_id=? AND active=1 LIMIT 1").bind(user.id).first();
      if(!student)return fail(404,"ملف الطالب غير موجود");
      const targetRow=await env.DB.prepare("SELECT payload_json FROM academy_records WHERE collection='student_team_supervisors' AND id=? AND group_id=?").bind(targetTeamId,student.group_id).first();
      if(!targetRow)return fail(404,"الفرقة المطلوبة غير موجودة في فوجك");
      const target=JSON.parse(targetRow.payload_json);
      const membershipRow=await env.DB.prepare("SELECT payload_json FROM academy_records WHERE collection='student_team_memberships' AND id=?").bind(student.id).first();
      if(!membershipRow)return fail(400,"اطلب من مشرفك إسنادك إلى فرقة أولًا قبل طلب النقل");
      const membership=JSON.parse(membershipRow.payload_json);
      if(membership.team_id===target.id)return fail(409,"أنت مسجل بالفعل في هذه الفرقة");
      const pending=await env.DB.prepare("SELECT payload_json FROM academy_records WHERE collection='student_team_transfer_requests' AND student_id=? AND group_id=?").bind(student.id,student.group_id).all();
      for(const row of pending.results||[]){try{const x=JSON.parse(row.payload_json);if(x.status==="pending")return fail(409,"لديك طلب نقل قيد الانتظار بالفعل")}catch{}}
      const requestRecord={id:uuid(),student_id:student.id,student_name:student.display_name,group_id:student.group_id,from_team_id:membership.team_id,from_team_name:membership.team_name||"",target_team_id:target.id,target_team_name:target.team_name||"الفرقة الأولى",status:"pending",requested_at:nowIso(),updated_at:nowIso()};
      await saveRecord(env,"student_team_transfer_requests",requestRecord);
      await log(env,user.id,"student_team_transfer_request",{request_id:requestRecord.id,student_id:student.id,group_id:student.group_id,target_team_id:target.id});
      return json({ok:true,request:requestRecord},201);
    }
    const teamTransferDecision=path.match(/^\/api\/student-team-transfer-requests\/([^/]+)\/decision$/);
    if(teamTransferDecision&&method==="POST"){
      const parsed=await parseBody(request);if(parsed.error)return parsed.error;const decision=clean(parsed.value.decision,20);
      if(!["approve","reject"].includes(decision))return fail(400,"اختر الموافقة أو الرفض");
      const requestRow=await env.DB.prepare("SELECT payload_json FROM academy_records WHERE collection='student_team_transfer_requests' AND id=?").bind(teamTransferDecision[1]).first();
      if(!requestRow)return fail(404,"طلب النقل غير موجود");
      let transfer;try{transfer=JSON.parse(requestRow.payload_json)}catch{return fail(500,"تعذر قراءة طلب النقل")};
      if(transfer.status!=="pending")return fail(409,"تمت معالجة هذا الطلب من قبل");
      let authorized=user.role==="admin";
      if(user.role==="student"){
        const actor=await env.DB.prepare("SELECT id,group_id FROM students WHERE user_id=? AND active=1 LIMIT 1").bind(user.id).first();
        if(actor){
          authorized=await isGlobalChiefStudent(env,actor.id);
          if(!authorized&&actor.group_id===transfer.group_id){
            const chiefRows=await env.DB.prepare("SELECT payload_json FROM academy_records WHERE collection='student_team_supervisors' AND group_id=?").bind(transfer.group_id).all();
            authorized=(chiefRows.results||[]).some(row=>{try{return JSON.parse(row.payload_json).head_supervisor_student_id===actor.id}catch{return false}});
          }
        }
      }
      if(!authorized)return fail(403,"الموافقة على طلبات النقل من صلاحية كبير المشرفين المعيّن أو المدير العام");
      if(decision==="approve"){
        const targetRow=await env.DB.prepare("SELECT payload_json FROM academy_records WHERE collection='student_team_supervisors' AND id=? AND group_id=?").bind(transfer.target_team_id,transfer.group_id).first();
        const student=await env.DB.prepare("SELECT id,display_name,group_id FROM students WHERE id=? AND active=1").bind(transfer.student_id).first();
        if(!targetRow||!student||student.group_id!==transfer.group_id)return fail(409,"تعذر إتمام النقل لأن الطالب أو الفرقة لم يعد صالحًا");
        const target=JSON.parse(targetRow.payload_json);
        const membership={id:student.id,student_id:student.id,student_name:student.display_name,group_id:student.group_id,team_id:target.id,team_name:target.team_name||"الفرقة الأولى",assigned_by:user.id,updated_at:nowIso()};
        await saveRecord(env,"student_team_memberships",membership);
        transfer.status="approved";transfer.decided_by=user.id;transfer.decided_at=nowIso();
      }else{transfer.status="rejected";transfer.decided_by=user.id;transfer.decided_at=nowIso();}
      transfer.updated_at=nowIso();await saveRecord(env,"student_team_transfer_requests",transfer);
      await log(env,user.id,"student_team_transfer_decision",{request_id:transfer.id,student_id:transfer.student_id,group_id:transfer.group_id,decision});
      return json({ok:true,request:transfer});
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
      if(password){await env.DB.prepare("UPDATE users SET display_name=?,identity_normalized=?,password_hash=?,must_change_password=1 WHERE id=?").bind(name,identity,await passwordHash(password),target.id).run();await env.DB.prepare("DELETE FROM sessions WHERE user_id=?").bind(target.id).run();}
      else await env.DB.prepare("UPDATE users SET display_name=?,identity_normalized=? WHERE id=?").bind(name,identity,target.id).run();
      await log(env,user.id,password?"teacher_password_reset":"teacher_update",{id:target.id,name,force_change:!!password});return json({ok:true,name,username:identity,must_change_password:!!password});
    }
    if(teacherMatch&&method==="DELETE"){
      if(user.role!=="admin")return fail(403,"تعطيل حسابات المعلمين للمدير فقط");
      const target=await env.DB.prepare("SELECT id,display_name FROM users WHERE id=? AND role='teacher' AND active=1").bind(teacherMatch[1]).first();
      if(!target)return fail(404,"المعلم غير موجود");
      const assigned=await env.DB.prepare("SELECT name FROM groups WHERE teacher_id=? AND active=1 ORDER BY name").bind(target.id).all();
      const assignedNames=(assigned.results||[]).map(row=>row.name).filter(Boolean);
      if(assignedNames.length)return fail(409,"لا يمكن تعطيل حساب المعلم قبل إعادة تعيين أفواجه: "+assignedNames.join("، "));
      await env.DB.prepare("UPDATE users SET active=0 WHERE id=?").bind(target.id).run();
      await env.DB.prepare("DELETE FROM sessions WHERE user_id=?").bind(target.id).run();
      await log(env,user.id,"teacher_deactivate",{id:target.id,name:target.display_name});
      return json({ok:true});
    }
    if(path==="/api/admin/roster-add"&&method==="POST"){
      if(user.role!=="admin")return fail(403,"إضافة القائمة الاسمية للمدير العام فقط");
      const parsed=await parseBody(request);if(parsed.error)return parsed.error;const b=parsed.value;
      const groupId=clean(b.group_id,80);
      const names=Array.isArray(b.names)?b.names.map(x=>clean(x,120).replace(/\s+/g," ")).filter(Boolean):[];
      if(!groupId||!names.length||names.length>100)return fail(400,"اختر الفوج وأدخل من اسم واحد إلى 100 اسم");
      if(!await canManageGroup(env,user,groupId))return fail(403,"لا تملك صلاحية هذا الفوج");
      const group=await groupRow(env,groupId);if(!group||group.active!==1)return fail(404,"الفوج غير موجود أو غير نشط");
      const normalizeName=value=>String(value||"").normalize("NFC").replace(/\s+/g," ").trim().toLocaleLowerCase("ar");
      const existing=await env.DB.prepare("SELECT display_name FROM students WHERE group_id=? AND active=1").bind(groupId).all();
      const counts=new Map();for(const row of existing.results||[]){const key=normalizeName(row.display_name);counts.set(key,(counts.get(key)||0)+1);}
      const targets=new Map();for(const name of names){const key=normalizeName(name);targets.set(key,(targets.get(key)||0)+1);}
      let created=0,skipped=0;
      for(const name of names){
        const key=normalizeName(name),count=counts.get(key)||0,target=targets.get(key)||1;
        if(count>0){skipped++;continue}
        await env.DB.prepare("INSERT INTO students(id,user_id,display_name,group_id,active) VALUES(?,NULL,?,?,1)").bind(uuid(),name,groupId).run();
        counts.set(key,1);created++;
      }
      await log(env,user.id,"student_roster_bulk_add",{group_id:groupId,created,skipped});
      return json({ok:true,group_id:groupId,group_name:group.name,created,skipped,total:names.length},201);
    }
    const studentProfileMatch=path.match(/^\/api\/students\/([^/]+)\/profile$/);
    if(studentProfileMatch&&method==="GET"){
      const s=await env.DB.prepare("SELECT id,user_id,display_name,group_id FROM students WHERE id=? AND active=1").bind(studentProfileMatch[1]).first();
      if(!s)return fail(404,"ملف الطالب غير موجود");
      if(user.role==="student"){if(user.student_id!==s.id)return fail(403,"لا يمكنك عرض ملف طالب آخر");}
      else if(!["admin","teacher","director","supervisor"].includes(user.role)||!await canManageGroup(env,user,s.group_id))return fail(403,"لا تملك صلاحية هذا الملف");
      const raw=await env.DB.prepare("SELECT payload_json FROM academy_records WHERE collection='student_profiles' AND id=?").bind(s.id).first();
      let p={};try{p=raw?JSON.parse(raw.payload_json):{}}catch{}
      const result={phone:p.phone||"",preferred_contact:p.preferred_contact||"",guardian_name:p.guardian_name||"",guardian_phone:p.guardian_phone||"",age:p.age??"",riwaya:p.riwaya||"",memorized_hizb:p.memorized_hizb??"",school_grade:p.school_grade||"",school_name:p.school_name||"",average:p.average??"",notes:p.notes||"",updated_at:p.updated_at||""};
      if(user.role==="student")delete result.notes;
      return json(result);
    }
    if(studentProfileMatch&&method==="PATCH"){
      if(!["admin","teacher","director","supervisor"].includes(user.role))return fail(403,"تعديل الملف الدراسي متاح للفريق التعليمي فقط");
      const s=await env.DB.prepare("SELECT id,display_name,group_id FROM students WHERE id=? AND active=1").bind(studentProfileMatch[1]).first();
      if(!s)return fail(404,"ملف الطالب غير موجود");
      if(!await canManageGroup(env,user,s.group_id))return fail(403,"لا تملك صلاحية تعديل هذا الطالب");
      const parsed=await parseBody(request);if(parsed.error)return parsed.error;const b=parsed.value;
      const ageText=clean(b.age,3),averageText=clean(b.average,8),hizbText=clean(b.memorized_hizb,2),age=ageText===""?null:Number(ageText),average=averageText===""?null:Number(averageText),memorized= hizbText===""?null:Number(hizbText);
      if(age!==null&&(!Number.isInteger(age)||age<3||age>100))return fail(400,"العمر يجب أن يكون عددًا صحيحًا بين 3 و100");
      if(average!==null&&(!Number.isFinite(average)||average<0||average>20))return fail(400,"المعدل يجب أن يكون بين 0 و20");
      if(memorized!==null&&(!Number.isInteger(memorized)||memorized<0||memorized>60))return fail(400,"مقدار الحفظ يجب أن يكون عدد أحزاب بين 0 و60");
      const profile={phone:clean(b.phone,50),preferred_contact:clean(b.preferred_contact,80),guardian_name:clean(b.guardian_name,120),guardian_phone:clean(b.guardian_phone,50),age,riwaya:clean(b.riwaya,60),memorized_hizb:memorized,school_grade:clean(b.school_grade,120),school_name:clean(b.school_name,160),average,notes:clean(b.notes,1200),updated_at:nowIso()};
      await saveRecord(env,"student_profiles",{id:s.id,owner_user_id:user.id,group_id:s.group_id,student_id:s.id,...profile});
      await log(env,user.id,"student_profile_update",{student_id:s.id,group_id:s.group_id});
      return json({ok:true,...profile});
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
      const students=r.results||[];
      // Roster reads stay read-only and fast. Student cards are provisioned when
      // a student is created or explicitly onboarded; never repair 165 cards on
      // every GET /api/students request (that can exceed the browser timeout).
      return json(students);
    }
    if(path==="/api/students"&&method==="POST"){
      if(!["admin","teacher","director","supervisor"].includes(user.role))return fail(403,"غير مسموح");const parsed=await parseBody(request);if(parsed.error)return parsed.error;const b=parsed.value;
      const name=clean(b.name,120),requestedIdentity=clean(b.username||b.name,100).toLowerCase(),providedPassword=String(b.password||""),groupId=clean(b.group_id,80);
      if(!name||!requestedIdentity||requestedIdentity.length>120||(providedPassword&&(providedPassword.length<8||providedPassword.length>256))||!groupId)return fail(400,"أكمل الاسم واسم الدخول والفوج؛ كلمة المرور اليدوية لا تقل عن 8 أحرف");
      if(!await canManageGroup(env,user,groupId))return fail(403,"لا تملك صلاحية هذا الفوج");
      const duplicateStudent=await findDuplicateStudentByName(env,name);
      if(duplicateStudent)return fail(409,"يوجد ملف طالب بهذا الاسم بالفعل. افتح الملف الموجود وأنشئ حساب الدخول منه؛ لن ننشئ طالبًا مكررًا.");
      const id=uuid(),studentId=uuid(),identity=await uniqueStudentIdentity(env,requestedIdentity,null,studentId),password=providedPassword||generateStudentTemporaryPassword();
      try{await env.DB.prepare("INSERT INTO users(id,display_name,identity_normalized,password_hash,role,active,must_change_password) VALUES(?,?,?,?, 'student',1,1)").bind(id,name,identity,await passwordHash(password)).run();
        await env.DB.prepare("INSERT INTO students(id,user_id,display_name,group_id,active) VALUES(?,?,?,?,1)").bind(studentId,id,name,groupId).run();
        await ensureStudentCard(env,{id:studentId,name,group_id:groupId},user.id);}
      catch(error){await env.DB.prepare("DELETE FROM students WHERE id=?").bind(studentId).run();await env.DB.prepare("DELETE FROM users WHERE id=?").bind(id).run();console.error("Ihsan student creation failed",{message:String(error?.message||error)});return fail(409,"تعذّر إنشاء الطالب؛ حدّث الصفحة وأعد المحاولة، ولم تُمسّ بيانات أي طالب آخر");}
      await log(env,user.id,"student_create",{student_id:studentId,group_id:groupId,card_auto_created:true,generated_password:!providedPassword});return json({id:studentId,user_id:id,name,username:identity,initial_password:password,group_id:groupId,card_created:true},201);
    }
    const rosterAccountMatch=path.match(/^\/api\/students\/([^/]+)\/account$/);
    if(rosterAccountMatch&&method==="POST"){
      if(!["admin","teacher","director","supervisor"].includes(user.role))return fail(403,"غير مسموح");
      const parsed=await parseBody(request);if(parsed.error)return parsed.error;const b=parsed.value;
      const s=await env.DB.prepare("SELECT id,user_id,display_name,group_id FROM students WHERE id=? AND active=1").bind(rosterAccountMatch[1]).first();
      if(!s)return fail(404,"الطالب غير موجود");
      if(!await canManageGroup(env,user,s.group_id))return fail(403,"لا تملك صلاحية هذا الطالب");
      if(s.user_id)return fail(409,"لدى الطالب حساب دخول بالفعل");
      const name=clean(b.name||s.display_name,120),requestedIdentity=clean(b.username||b.name||s.display_name,120).toLowerCase(),providedPassword=String(b.password||"");
      if(!name||!requestedIdentity||requestedIdentity.length>120||(providedPassword&&(providedPassword.length<8||providedPassword.length>256)))return fail(400,"أدخل اسم الطالب واسم الدخول؛ كلمة المرور اليدوية لا تقل عن 8 أحرف");
      const userId=uuid(),identity=await uniqueStudentIdentity(env,requestedIdentity,null,s.id),password=providedPassword||generateStudentTemporaryPassword();
      try{
        await env.DB.prepare("INSERT INTO users(id,display_name,identity_normalized,password_hash,role,active,must_change_password) VALUES(?,?,?,?, 'student',1,1)").bind(userId,name,identity,await passwordHash(password)).run();
        const linked=await env.DB.prepare("UPDATE students SET user_id=?,display_name=? WHERE id=? AND user_id IS NULL").bind(userId,name,s.id).run();
        if(Number(linked?.meta?.changes||0)!==1){
          await env.DB.prepare("DELETE FROM users WHERE id=?").bind(userId).run();
          return fail(409,"تم ربط حساب بهذا الطالب للتو. حدّث الصفحة ولا تنشئ حسابًا ثانيًا.");
        }
      }catch(error){
        await env.DB.prepare("DELETE FROM users WHERE id=?").bind(userId).run();
        return fail(409,"تعذّر إنشاء الحساب؛ تحقّق من اسم الدخول ثم أعد المحاولة");
      }
      await log(env,user.id,"student_account_created",{student_id:s.id,group_id:s.group_id});
      return json({ok:true,id:s.id,user_id:userId,name,username:identity,initial_password:password,group_id:s.group_id},201);
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
        if(password){await env.DB.prepare("UPDATE users SET display_name=?,identity_normalized=?,password_hash=?,must_change_password=1 WHERE id=?").bind(name,identity,await passwordHash(password),s.user_id).run();await env.DB.prepare("DELETE FROM sessions WHERE user_id=?").bind(s.user_id).run();}
        else await env.DB.prepare("UPDATE users SET display_name=?,identity_normalized=? WHERE id=?").bind(name,identity,s.user_id).run();
      }else if(s.user_id&&b.name!==undefined){
        await env.DB.prepare("UPDATE users SET display_name=? WHERE id=?").bind(name,s.user_id).run();
      }
      await log(env,user.id,password?"student_password_reset":"student_update",{student_id:s.id,name,old_group_id:s.group_id,new_group_id:nextGroup,force_change:!!password});
      return json({ok:true,name,group_id:nextGroup});
    }
    if(studentMatch&&method==="DELETE"){
      if(!["admin","teacher","director","supervisor"].includes(user.role))return fail(403,"غير مسموح");const s=await env.DB.prepare("SELECT id,user_id,group_id FROM students WHERE id=? AND active=1").bind(studentMatch[1]).first();if(!s)return fail(404,"الطالب غير موجود");if(!await canManageGroup(env,user,s.group_id))return fail(403,"لا تملك صلاحية هذا الطالب");
      await env.DB.prepare("UPDATE students SET active=0 WHERE id=?").bind(s.id).run();if(s.user_id)await env.DB.prepare("UPDATE users SET active=0 WHERE id=?").bind(s.user_id).run();await log(env,user.id,"student_deactivate",{student_id:s.id});return json({ok:true});
    }
    const effortCategories=["mandatory_classes","asr","adhkar","wird","thabit","bring","quran_classes"];
    if(path==="/api/students/roster-bulk"&&method==="POST"){
      if(!["admin","teacher","director","supervisor"].includes(user.role))return fail(403,"غير مسموح");
      const parsed=await parseBody(request);if(parsed.error)return parsed.error;const b=parsed.value;
      const groupId=clean(b.group_id,80),names=Array.isArray(b.names)?b.names.map(n=>clean(n,120)).filter(Boolean):[];
      if(!groupId||!names.length||names.length>100)return fail(400,"اختر الفوج وأدخل من اسم واحد إلى 100 اسم");
      if(!await canManageGroup(env,user,groupId))return fail(403,"لا تملك صلاحية هذا الفوج");
      const existing=await env.DB.prepare("SELECT display_name FROM students WHERE group_id=? AND active=1").bind(groupId).all();
      const normalizeName=n=>String(n||"").normalize("NFKC").replace(/[\u064B-\u065F\u0670]/g,"").replace(/\s+/g," ").trim().toLocaleLowerCase("ar");
      const seen=new Set((existing.results||[]).map(x=>normalizeName(x.display_name)));
      const added=[],skipped=[];const statements=[];
      for(const name of names){
        const key=normalizeName(name);
        if(!key||seen.has(key)){skipped.push(name);continue}
        seen.add(key);const id=uuid();
        statements.push(env.DB.prepare("INSERT INTO students(id,user_id,display_name,group_id,active) VALUES(?,NULL,?,?,1)").bind(id,name,groupId));
        added.push({id,name,group_id:groupId});
      }
      if(statements.length)await env.DB.batch(statements);
      await log(env,user.id,"student_roster_bulk_add",{group_id:groupId,added:added.length,skipped:skipped.length});
      return json({ok:true,added,added_count:added.length,skipped,skipped_count:skipped.length},201);
    }
    if(path==="/api/effort"&&method==="GET"){
      if(!["admin","teacher","director","supervisor"].includes(user.role))return fail(403,"متابعة الاجتهاد للشيخ أو المشرف");
      const groupId=clean(url.searchParams.get("group_id"),80),date=clean(url.searchParams.get("date"),10)||academyDate();
      if(!validDateOnly(date)||!groupId||!await canManageGroup(env,user,groupId))return fail(400,"اختر فوجًا وتاريخًا صحيحين ضمن صلاحيتك");
      return json((await records(env,"effort_logs"," AND group_id=?",[groupId])).filter(row=>row.date===date));
    }
    if(path==="/api/effort"&&method==="POST"){
      if(!["admin","teacher","director","supervisor"].includes(user.role))return fail(403,"تسجيل الاجتهاد للشيخ أو المشرف");
      const parsed=await parseBody(request);if(parsed.error)return parsed.error;const b=parsed.value;
      const groupId=clean(b.group_id,80),date=clean(b.date,10),items=Array.isArray(b.items)?b.items:[];
      if(!validDateOnly(date)||date>academyDate()||!groupId||!items.length||items.length>200||!await canManageGroup(env,user,groupId))return fail(400,"بيانات المتابعة غير صحيحة");
      const active=await env.DB.prepare("SELECT id FROM students WHERE group_id=? AND active=1").bind(groupId).all(),allowed=new Set((active.results||[]).map(x=>x.id)),statements=[],seen=new Set();let saved=0;
      for(const item of items){
        const studentId=String(item?.student_id||"");
        if(!allowed.has(studentId)||seen.has(studentId)||!item.checks||typeof item.checks!=="object"||Array.isArray(item.checks))return fail(400,"يوجد طالب مكرر أو خارج الفوج");
        seen.add(studentId);
        for(const category of effortCategories){
          const status=item.checks[category];
          if(status===undefined||status==="")continue;
          if(!["done","missed","excused"].includes(status))return fail(400,"حالة متابعة غير صحيحة");
          const id=date+":"+studentId+":"+category,row={id,student_id:studentId,group_id:groupId,date,category,status,marked_by:user.id,updated_at:nowIso()};
          statements.push(env.DB.prepare("INSERT INTO academy_records(collection,id,owner_user_id,group_id,student_id,payload_json,updated_at) VALUES('effort_logs',?,?,?,?,?,?) ON CONFLICT(collection,id) DO UPDATE SET owner_user_id=excluded.owner_user_id,group_id=excluded.group_id,student_id=excluded.student_id,payload_json=excluded.payload_json,updated_at=excluded.updated_at").bind(id,user.id,groupId,studentId,JSON.stringify(row),row.updated_at));saved++;
        }
      }
      if(!saved)return fail(400,"لم تختر أي حالات للحفظ");
      await env.DB.batch(statements);await log(env,user.id,"effort_save",{group_id:groupId,date,count:saved});
      return json({ok:true,saved});
    }
    if(path==="/api/effort/ranking"&&method==="GET"){
      if(!["admin","teacher","director","supervisor"].includes(user.role))return fail(403,"الترتيب متاح للشيخ أو المشرف");
      const groupId=clean(url.searchParams.get("group_id"),80),period=url.searchParams.get("period")==="monthly"?"monthly":"weekly",today=academyDate();
      if(!groupId||!await canManageGroup(env,user,groupId))return fail(400,"اختر فوجًا ضمن صلاحيتك");
      const fromDate=period==="monthly"?today.slice(0,7)+"-01":(()=>{const [y,m,d]=today.split("-").map(Number),x=new Date(Date.UTC(y,m-1,d-6));return x.getUTCFullYear()+"-"+String(x.getUTCMonth()+1).padStart(2,"0")+"-"+String(x.getUTCDate()).padStart(2,"0")})();
      const [studentsRows,effortRows,attendanceRows,quranRows,pointsRows]=await Promise.all([
        env.DB.prepare("SELECT id,display_name AS name FROM students WHERE group_id=? AND active=1 ORDER BY display_name").bind(groupId).all(),
        records(env,"effort_logs"," AND group_id=?",[groupId]),
        records(env,"attendance"," AND group_id=?",[groupId]),
        records(env,"quran_progress"," AND group_id=?",[groupId]),
        env.DB.prepare("SELECT student_id,COALESCE(SUM(points),0) AS achievement FROM point_events WHERE group_id=? AND kind='achievement' AND reversed_at IS NULL GROUP BY student_id").bind(groupId).all()
      ]);
      const achievementByStudent=new Map((pointsRows.results||[]).map(row=>[row.student_id,Number(row.achievement||0)]));
      const inPeriod=r=>String(r.date||"")>=fromDate&&String(r.date||"")<=today;
      const metrics=["attendance","mandatory_classes","asr","adhkar","wird","thabit","bring","quran_classes","memorization","revision"];
      const stats=(studentsRows.results||[]).map(student=>{
        const values={};
        const att=attendanceRows.filter(r=>r.student_id===student.id&&inPeriod(r)&&r.status!=="excused");
        if(att.length)values.attendance=att.reduce((n,r)=>n+(r.status==="present"?1:r.status==="late"?.5:0),0)/att.length;
        for(const cat of effortCategories){const rows=effortRows.filter(r=>r.student_id===student.id&&r.category===cat&&inPeriod(r)&&r.status!=="excused");if(rows.length)values[cat]=rows.filter(r=>r.status==="done").length/rows.length}
        for(const cat of ["memorization","revision"]){const rows=quranRows.filter(r=>r.student_id===student.id&&r.activity===cat&&inPeriod(r));const dates=new Set(rows.filter(r=>cat==="memorization"?String(r.memorized||"").trim():String(r.reviewed||"").trim()).map(r=>r.date));const opportunities=new Set(rows.map(r=>r.date).filter(Boolean));if(opportunities.size)values[cat]=dates.size/opportunities.size}
        const scored=metrics.filter(k=>values[k]!==undefined);
        const metricsAvg=scored.length?Math.round(100*scored.reduce((n,k)=>n+values[k],0)/scored.length):null;
        const score=Number(achievementByStudent.get(student.id)||0);
        return {student_id:student.id,name:student.name,score,achievement:score,metrics_average:metricsAvg,recorded_metrics:scored.length,metrics:Object.fromEntries(metrics.map(k=>[k,values[k]===undefined?null:Math.round(values[k]*100)]))};
      }).sort((a,b)=>(b.achievement??0)-(a.achievement??0)||(b.score??0)-(a.score??0)||(b.recorded_metrics-a.recorded_metrics)||a.name.localeCompare(b.name,"ar"));
      let rank=0;return json({period,from_date:fromDate,to_date:today,metrics,rows:stats.map(r=>({...r,rank:++rank}))});
    }
    if(path==="/api/attendance"&&method==="GET"){
      const date=clean(url.searchParams.get("date"),10)||academyDate(),groupId=clean(url.searchParams.get("group_id"),80),history=url.searchParams.get("history")==="1",studentId=clean(url.searchParams.get("student_id"),80);
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
      if(!validDateOnly(date)||!items.length||items.length>200||!await canManageGroup(env,user,groupId))return fail(400,"بيانات الحضور غير صحيحة");
      const active=await env.DB.prepare("SELECT id FROM students WHERE group_id=? AND active=1").bind(groupId).all(),allowed=new Set((active.results||[]).map(x=>x.id)),stmts=[];
      const seenStudentIds=new Set();for(const item of items){const studentId=String(item?.student_id??"");if(!item||typeof item!=="object"||Array.isArray(item)||seenStudentIds.has(studentId)||!allowed.has(studentId)||!["present","absent","late","excused"].includes(item.status))return fail(400,"يوجد طالب مكرر أو طالب أو حالة غير صحيحة");seenStudentIds.add(studentId);const row={id:date+":"+studentId,student_id:studentId,group_id:groupId,date,status:item.status,note:clean(item.note,300),marked_by:user.id,updated_at:nowIso()};stmts.push(env.DB.prepare("INSERT INTO academy_records(collection,id,owner_user_id,group_id,student_id,payload_json,updated_at) VALUES('attendance',?,?,?,?,?,?) ON CONFLICT(collection,id) DO UPDATE SET owner_user_id=excluded.owner_user_id,group_id=excluded.group_id,student_id=excluded.student_id,payload_json=excluded.payload_json,updated_at=excluded.updated_at").bind(row.id,user.id,groupId,studentId,JSON.stringify(row),row.updated_at));}
      if(stmts.length)await env.DB.batch(stmts);
      const presentStudentIds=items.filter(item=>item.status==="present").map(item=>String(item.student_id));
      await awardAttendancePoints(env,{groupId,date,studentIds:presentStudentIds,awardedBy:user.id});
      await log(env,user.id,"attendance_save",{group_id:groupId,date,count:items.length});return json({ok:true,saved:items.length});
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
      const studentId=clean(b.student_id,80),date=clean(b.date,10)||academyDate();
      const memorized=clean(b.memorized,300),reviewed=clean(b.reviewed,300),recitation=clean(b.recitation,500);
      const notes=clean(b.notes,500),feedback=clean(b.feedback,800),nextAssignment=clean(b.next_assignment,300);
      const activity=clean(b.activity,24)||"recitation",allowedActivities=["memorization","revision","recitation","correction"];
      const errors=Number(b.errors??0),grade=b.grade===""||b.grade==null?null:Number(b.grade);
      const corrected=b.corrected===true||b.corrected==="true";
      if(!validDateOnly(date))return fail(400,"صيغة التاريخ غير صحيحة");
      if(date>academyDate())return fail(400,"لا يمكن تسجيل متابعة القرآن بتاريخ مستقبلي");
      const st=await env.DB.prepare("SELECT group_id FROM students WHERE id=? AND active=1").bind(studentId).first();
      if(!st||!await canManageGroup(env,user,st.group_id))return fail(403,"لا تملك صلاحية هذا الطالب");
      if(!allowedActivities.includes(activity))return fail(400,"اختر نوع متابعة صحيحًا");
      if(!memorized&&!reviewed&&!recitation&&!notes&&!feedback&&!nextAssignment)return fail(400,"أدخل الحفظ أو المراجعة أو التسميع أو ملاحظة");
      if(!Number.isInteger(errors)||errors<0||errors>200)return fail(400,"عدد الأخطاء يجب أن يكون بين 0 و200");
      if(grade!==null&&(!Number.isFinite(grade)||grade<0||grade>10))return fail(400,"التقدير يجب أن يكون بين 0 و10");
      const requestedRecordId=clean(b.id,80),row={id:requestedRecordId&&/^offline-[a-f0-9-]{20,60}$/i.test(requestedRecordId)?requestedRecordId:uuid(),student_id:studentId,group_id:st.group_id,date,activity,memorized,reviewed,recitation,errors,grade,corrected,feedback,next_assignment:nextAssignment,notes,teacher_id:user.id,created_at:nowIso(),updated_at:nowIso()};
      if(requestedRecordId&&row.id===requestedRecordId){const existing=await env.DB.prepare("SELECT payload_json FROM academy_records WHERE collection='quran_progress' AND id=?").bind(row.id).first();if(existing){let prior;try{prior=JSON.parse(existing.payload_json)}catch{return fail(500,"تعذّرت قراءة سجل محفوظ")};if(prior.student_id!==studentId||prior.teacher_id!==user.id||prior.date!==date)return fail(409,"يتعارض معرّف التسجيل مع سجل آخر؛ لم تُغيّر البيانات");return json(prior,200)}}
      await saveRecord(env,"quran_progress",row);
      await awardPointsForEvent(env,{studentId,groupId:st.group_id,eventType:"quran_entry",eventKey:"quran:"+row.id,date,reason:"متابعة قرآنية ("+activity+")",sourceCollection:"quran_progress",sourceId:row.id,awardedBy:user.id});
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
      if(!validDateOnly(String(row.date||""))||String(row.date)>academyDate()||!["memorization","revision","recitation","correction"].includes(row.activity)||!Number.isInteger(Number(row.errors))||Number(row.errors)<0||Number(row.errors)>200||(row.grade!==null&&(!Number.isFinite(Number(row.grade))||Number(row.grade)<0||Number(row.grade)>10)))return fail(400,"تحقق من التاريخ والنوع وعدد الأخطاء والتقدير");
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
      const today=academyDate(),storedTests=await records(env,"tests"),latestBySeries=new Map();
      for(const item of storedTests){if(item.status==="archived"||!item.recurring||!item.series_id)continue;const prior=latestBySeries.get(item.series_id);if(!prior||Number(item.sequence||1)>Number(prior.sequence||1))latestBySeries.set(item.series_id,item);}
      for(const latest of latestBySeries.values()){
        // A request may roll forward only a series inside the caller's authorized scope.
        if(user.role==="student"){
          if(!latest.group_id||latest.group_id!==user.group_id)continue;
        }else if(user.role!=="admin"){
          if(!latest.group_id||!await canManageGroup(env,user,latest.group_id))continue;
        }
        if(!latest.due_date||latest.due_date>=today)continue;
        const interval=Math.max(1,Number(latest.frequency_days)||14),elapsed=Math.floor((Date.parse(today+"T00:00:00Z")-Date.parse(latest.due_date+"T00:00:00Z"))/(interval*86400000))+1;
        const sequence=Number(latest.sequence||1)+elapsed,id=String(latest.series_id)+":"+sequence;
        if(storedTests.some(item=>item.id===id))continue;
        const nextDue=new Date(Date.parse(latest.due_date+"T00:00:00Z")+elapsed*interval*86400000).toISOString().slice(0,10);
        const rolloverAt=nowIso();
        await saveRecord(env,"tests",{...latest,status:"archived",archived_at:rolloverAt,archived_by:"system",archive_reason:"recurring_rollover"});
        await saveRecord(env,"tests",{...latest,id,sequence,due_date:nextDue,previous_test_id:latest.id,status:"published",archived_at:null,archived_by:null,archive_reason:null,created_at:rolloverAt});
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
          const attemptAnswers=latest&&Array.isArray(latest.answers)?new Map(latest.answers.map(a=>[String(a.question_id),Number(a.selected_index)])):null;
          return {...t,questions:(t.questions||[]).map(q=>({id:q.id,prompt:q.prompt,choices:q.choices,...(latest?{correct_index:q.correct_index,explanation:clean(q.explanation,500)}:{})})),my_attempt:latest?{score:latest.score,total:latest.total,submitted_at:latest.submitted_at,answers:attemptAnswers?Object.fromEntries(attemptAnswers):null}:null};
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
      if(due&&!validDateOnly(due))return fail(400,"موعد الاختبار غير صحيح");
      const defaultDue=addCalendarDays(academyDate(),14);
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
      const attempt={id:uuid(),test_id:test.id,title:test.title,student_id:user.student_id,group_id:user.group_id,score,total:(test.questions||[]).length,day:academyDate(),submitted_at:nowIso(),answers: submitted.map(a => ({ question_id: String(a.question_id), selected_index: Number(a.selected_index) }))};
      await saveRecord(env,"test_attempts",attempt);
      await awardPointsForEvent(env,{studentId:user.student_id,groupId:user.group_id,eventType:"test_completed",eventKey:"test:"+attempt.id,date:attempt.day,reason:"إكمال اختبار: "+test.title,sourceCollection:"test_attempts",sourceId:attempt.id,awardedBy:user.id});
      await log(env,user.id,"test_submit",{test_id:test.id,score,total:attempt.total});
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
      const series=await records(env,"tests");
      const targets=test.recurring&&test.series_id?series.filter(item=>item.series_id===test.series_id):[test];
      for(const item of targets){
        if(item.group_id){if(!await canManageGroup(env,user,item.group_id))return fail(403,"تتضمن السلسلة اختبارًا خارج صلاحيتك");}
        else if(user.role!=="admin")return fail(403,"السلسلة العامة متاحة للمدير العام وحده");
      }
      if(parsed.value.action==="archive"){
        const archivedAt=nowIso();
        for(const item of targets)await saveRecord(env,"tests",{...item,status:"archived",archived_at:archivedAt,archived_by:user.id});
        await log(env,user.id,"test_archive",{test_id:test.id,series_id:test.series_id||null,archived_count:targets.length});
        return json({ok:true,archived:true,archived_count:targets.length});
      }
      const attempts=await records(env,"test_attempts");
      const targetIds=new Set(targets.map(item=>item.id));
      const savedAttempts=attempts.filter(item=>targetIds.has(item.test_id));
      if(savedAttempts.length)return fail(409,"لهذا الاختبار نتائج طلاب محفوظة؛ استخدم الأرشفة بدل الحذف حتى تبقى النتائج وسياق الاختبار محفوظين.");
      for(const item of targets)await env.DB.prepare("DELETE FROM academy_records WHERE collection='tests' AND id=?").bind(item.id).run();
      await log(env,user.id,"test_delete",{test_id:test.id,series_id:test.series_id||null,deleted_count:targets.length});
      return json({ok:true,deleted_count:targets.length});
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
      const assignment={id:uuid(),title,description,group_id:groupId,due_date:dueDate||null,points_total:pointsTotal,task_type:(TASK_TYPE_LABELS[clean(b.task_type,40)]?clean(b.task_type,40):"assignment"),status:"published",created_by:user.id,created_at:nowIso()};
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
      const taskType=b.task_type===undefined?(TASK_TYPE_LABELS[old.task_type]?old.task_type:"assignment"):(TASK_TYPE_LABELS[clean(b.task_type,40)]?clean(b.task_type,40):"assignment");
      if(!title||!description)return fail(400,"العنوان والتعليمات مطلوبان");
      if(dueDate&&!validDateOnly(dueDate))return fail(400,"موعد التسليم غير صحيح");
      if(!Number.isFinite(pointsTotal)||pointsTotal<1||pointsTotal>1000)return fail(400,"الدرجة الكلية يجب أن تكون من 1 إلى 1000");
      if(pointsTotal!==Number(old.points_total||100)){
        const count=await env.DB.prepare("SELECT COUNT(*) AS n FROM academy_records WHERE collection='assignment_submissions' AND json_extract(payload_json,'$.assignment_id')=?").bind(assignmentId).first();
        if((count?.n||0)>0)return fail(409,"لا يمكن تغيير الدرجة الكلية بعد وجود تسليمات؛ حتى لا تتغير دلالة الدرجات السابقة");
      }
      const updated={...old,title,description,due_date:dueDate||null,points_total:pointsTotal,task_type:taskType,updated_by:user.id,updated_at:nowIso()};
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
      const submission={id:submissionId,assignment_id:assignmentId,student_id:user.student_id,group_id:user.group_id,response_text:responseText,status:"submitted",submitted_at:nowIso(),created_at:previous?.created_at||nowIso(),revision_number:Number(previous?.revision_number||0)+1,review_history:Array.isArray(previous?.review_history)?previous.review_history:[],grade:null,feedback:"",reviewed_by:null,reviewed_at:null};
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
      await saveRecord(env,"assignment_submissions",submission);
      const assignmentTotal=Number(assignment.points_total||100);
      const excellent=grade!==null&&assignmentTotal>0&&grade/assignmentTotal>=0.8;
      await awardPointsForEvent(env,{studentId,groupId:assignment.group_id||submission.group_id||null,eventType:excellent?"assignment_excellent":"assignment_reviewed",eventKey:"assignment:"+submissionId+":"+(excellent?"excellent":"reviewed"),date:academyDate(),reason:(excellent?"إتقان واجب: ":"مراجعة واجب: ")+assignment.title,sourceCollection:"assignment_submissions",sourceId:submissionId,awardedBy:user.id});
      await log(env,user.id,"assignment_review",{assignment_id:assignmentId,student_id:studentId,grade});
      return json({ok:true,submission});
    }
    if(path==="/api/tasks"&&method==="GET"){
      let studentId=clean(url.searchParams.get("student_id"),80);
      if(user.role==="student"){
        if(!user.student_id)return fail(404,"حساب الطالب غير مرتبط بملف طالب");
        if(studentId&&studentId!==user.student_id)return fail(403,"لا يمكنك عرض مهام طالب آخر");
        studentId=user.student_id;
      }else{
        if(!["admin","teacher","director","supervisor"].includes(user.role))return fail(403,"غير مسموح");
        if(!studentId)return fail(400,"حدّد الطالب");
      }
      const student=await env.DB.prepare("SELECT id,group_id,display_name FROM students WHERE id=? AND active=1").bind(studentId).first();
      if(!student)return fail(404,"ملف الطالب غير موجود");
      if(user.role!=="student"&&!await canManageGroup(env,user,student.group_id))return fail(403,"هذا الطالب خارج صلاحيتك");
      const assignmentRows=(await env.DB.prepare("SELECT payload_json FROM academy_records WHERE collection='assignments' ORDER BY updated_at DESC LIMIT 500").all()).results||[];
      const assignments=assignmentRows.map(row=>{try{return JSON.parse(row.payload_json)}catch{return null}}).filter(row=>row&&row.status==="published"&&(!row.group_id||row.group_id===student.group_id));
      const submissions=await records(env,"assignment_submissions"," AND student_id=?",[studentId]);
      const planRow=await env.DB.prepare("SELECT payload_json FROM academy_records WHERE collection='quran_plan' AND student_id=? LIMIT 1").bind(studentId).first();
      let plan=null;if(planRow){try{plan=JSON.parse(planRow.payload_json)}catch{plan=null}}
      const progress=await records(env,"quran_progress"," AND student_id=?",[studentId]);
      const attendance=await records(env,"attendance"," AND student_id=?",[studentId]);
      const tasks=buildStudentTasks(student,assignments,submissions,plan,progress,attendance);
      const counts={pending:0,submitted:0,done:0,late:0};
      for(const task of tasks)counts[task.status]=(counts[task.status]||0)+1;
      return json({student:{id:student.id,name:student.display_name,group_id:student.group_id},tasks,counts,type_labels:TASK_TYPE_LABELS,status_labels:TASK_STATUS_LABELS,generated_at:nowIso()});
    }
    if(path==="/api/content"&&method==="GET"){
      const kind=clean(url.searchParams.get("kind"),20)||"hadith";
      const collection=CONTENT_KINDS[kind];
      if(!collection)return fail(400,"نوع المحتوى غير معروف");
      if(user.role==="student"){
        const rows=await records(env,collection," AND json_extract(payload_json,'$.status')='published'",[]);
        const progress=await records(env,"content_progress"," AND student_id=?",[user.student_id||""]);
        const byContent=new Map(progress.map(item=>[item.content_id,item]));
        return json(rows.sort((a,b)=>String(a.title).localeCompare(String(b.title),"ar")).map(item=>({...item,my_progress:byContent.get(item.id)||null})));
      }
      if(!["admin","teacher","director","supervisor"].includes(user.role))return fail(403,"غير مسموح");
      const rows=await records(env,collection,"",[]);
      return json(rows.sort((a,b)=>String(b.updated_at||"").localeCompare(String(a.updated_at||""))));
    }
    if(path==="/api/content"&&method==="POST"){
      if(user.role!=="admin")return fail(403,"إضافة المحتوى ونشره للمدير العام فقط");
      const parsed=await parseBody(request,20000);if(parsed.error)return parsed.error;const b=parsed.value;
      const kind=clean(b.kind,20)||"hadith",collection=CONTENT_KINDS[kind];
      if(!collection)return fail(400,"نوع المحتوى غير معروف");
      const title=clean(b.title,200),text=clean(b.text,8000),source=clean(b.source,200),reference=clean(b.reference,200),grade=clean(b.grade,40),status=clean(b.status,20)||"draft";
      const attribution=CONTENT_ATTRIBUTIONS[clean(b.attribution,30)]?clean(b.attribution,30):"";
      const author=clean(b.author,160);
      if(!title||!text)return fail(400,"أدخل عنوان النص ومتنه");
      if(!CONTENT_STATUSES.includes(status))return fail(400,"حالة المحتوى غير صحيحة");
      if(status==="published"&&(!source||!reference))return fail(400,"لا يمكن نشر نص دون تحديد المصدر والمرجع");
      const item={id:uuid(),kind,title,text,source,reference,grade,status,attribution,author,created_by:user.id,created_at:nowIso(),updated_at:nowIso()};
      await saveRecord(env,collection,item);await log(env,user.id,"content_create",{kind,id:item.id,status});
      return json(item,201);
    }
    if(path==="/api/admin/content/seed-duas"&&method==="POST"){
      if(user.role!=="admin")return fail(403,"تهيئة مسودات الأدعية والأذكار للمدير العام فقط");
      let created=0,skipped=0;
      for(const seed of DUAS_SEED){
        const collection=CONTENT_KINDS[seed.kind];
        const existing=await env.DB.prepare("SELECT id FROM academy_records WHERE collection=? AND json_extract(payload_json,'$.title')=?").bind(collection,seed.title).first();
        if(existing){skipped++;continue}
        const item={id:uuid(),kind:seed.kind,title:seed.title,text:seed.text,source:seed.source,reference:seed.reference,grade:seed.grade||"",status:"pending_review",attribution:seed.attribution,author:"",created_by:user.id,created_at:nowIso(),updated_at:nowIso()};
        await saveRecord(env,collection,item);created++;
      }
      await log(env,user.id,"content_seed_duas",{created,skipped});
      return json({ok:true,created,skipped,status:"pending_review"},created?201:200);
    }
    const contentMatch=path.match(/^\/api\/content\/([^/]+)$/);
    if(contentMatch&&method==="PATCH"){
      if(user.role!=="admin")return fail(403,"تعديل المحتوى للمدير العام فقط");
      const contentId=clean(contentMatch[1],80);
      let found=null;
      for(const kind of Object.keys(CONTENT_KINDS)){
        const row=await env.DB.prepare("SELECT payload_json FROM academy_records WHERE collection=? AND id=?").bind(CONTENT_KINDS[kind],contentId).first();
        if(row){try{found={kind,item:JSON.parse(row.payload_json)}}catch{}break}
      }
      if(!found)return fail(404,"المحتوى غير موجود");
      const parsed=await parseBody(request,20000);if(parsed.error)return parsed.error;const b=parsed.value;
      const title=b.title===undefined?found.item.title:clean(b.title,200);
      const text=b.text===undefined?found.item.text:clean(b.text,8000);
      const source=b.source===undefined?found.item.source:clean(b.source,200);
      const reference=b.reference===undefined?found.item.reference:clean(b.reference,200);
      const grade=b.grade===undefined?(found.item.grade||""):clean(b.grade,40);
      const status=b.status===undefined?(found.item.status||"draft"):clean(b.status,20);
      const attribution=b.attribution===undefined?(found.item.attribution||""):(CONTENT_ATTRIBUTIONS[clean(b.attribution,30)]?clean(b.attribution,30):"");
      const author=b.author===undefined?(found.item.author||""):clean(b.author,160);
      if(!title||!text)return fail(400,"العنوان والنص مطلوبان");
      if(!CONTENT_STATUSES.includes(status))return fail(400,"حالة المحتوى غير صحيحة");
      if(status==="published"&&(!source||!reference))return fail(400,"لا يمكن نشر نص دون تحديد المصدر والمرجع");
      const updated={...found.item,title,text,source,reference,grade,status,attribution,author,updated_by:user.id,updated_at:nowIso()};
      await saveRecord(env,CONTENT_KINDS[found.kind],updated);await log(env,user.id,"content_update",{kind:found.kind,id:contentId,status});
      return json({ok:true,item:updated});
    }
    const contentProgressMatch=path.match(/^\/api\/content\/([^/]+)\/progress$/);
    if(contentProgressMatch&&method==="POST"){
      if(user.role!=="student"||!user.student_id)return fail(403,"تتبع الحفظ متاح لحساب الطالب");
      const contentId=clean(contentProgressMatch[1],80);
      let found=null;
      for(const kind of Object.keys(CONTENT_KINDS)){
        const row=await env.DB.prepare("SELECT payload_json FROM academy_records WHERE collection=? AND id=? AND json_extract(payload_json,'$.status')='published'").bind(CONTENT_KINDS[kind],contentId).first();
        if(row){try{found={kind,item:JSON.parse(row.payload_json)}}catch{}break}
      }
      if(!found)return fail(404,"المحتوى غير متاح");
      const parsed=await parseBody(request);if(parsed.error)return parsed.error;
      const status=clean(parsed.value.status,20)||"memorized";
      if(!["memorized","reviewing"].includes(status))return fail(400,"حالة التتبع غير صحيحة");
      const id=user.student_id+":"+contentId;
      const existing=await env.DB.prepare("SELECT payload_json FROM academy_records WHERE collection='content_progress' AND id=?").bind(id).first();
      let previous={};try{if(existing)previous=JSON.parse(existing.payload_json)}catch{}
      const progress={id,content_id:contentId,kind:found.kind,student_id:user.student_id,group_id:user.group_id||null,status,created_at:previous.created_at||nowIso(),updated_at:nowIso()};
      await saveRecord(env,"content_progress",progress);await log(env,user.id,"content_progress",{content_id:contentId,status});
      return json({ok:true,progress});
    }
    // -----------------------------------------------------------------------
    // Competitions: data-driven categories, stages, human judging, results.
    // All writes reuse the existing session user and point_events ledger.
    // -----------------------------------------------------------------------
    if(path==="/api/competitions/categories"&&method==="GET"){
      const rows=await env.DB.prepare("SELECT * FROM competition_categories WHERE active=1 ORDER BY sort_order,name").all();
      return json(rows.results||[]);
    }
    if(path==="/api/competitions/calendar"&&method==="GET"){
      const today=academyDate();
      let mySchoolId=null;
      if(user.role==="student"&&user.group_id){const g=await env.DB.prepare("SELECT school_id FROM groups WHERE id=?").bind(user.group_id).first();mySchoolId=g?.school_id||null;}
      const events=await env.DB.prepare("SELECT e.*,c.title AS competition_title,c.status AS competition_status,c.school_id FROM competition_events e LEFT JOIN competitions c ON c.id=e.competition_id WHERE e.active=1 ORDER BY e.event_date").all();
      const visible=(events.results||[]).filter(row=>{
        if(user.role==="student"){
          if(row.competition_id&&row.competition_status==="draft")return false;
          return !row.school_id||row.school_id===mySchoolId;
        }
        if(user.role==="director")return !row.school_id||(Array.isArray(user.school_ids)&&user.school_ids.includes(row.school_id));
        return true;
      });
      const competitions=await env.DB.prepare("SELECT id,title,status,school_id,registration_starts_at,registration_ends_at,starts_at,ends_at FROM competitions WHERE status<>'draft' ORDER BY COALESCE(registration_starts_at,starts_at,created_at)").all();
      const derived=[];
      for(const row of competitions.results||[]){
        if(user.role==="director"&&row.school_id&&!(Array.isArray(user.school_ids)&&user.school_ids.includes(row.school_id)))continue;
        for(const [field,kind,label] of [["registration_starts_at","registration","بدء التسجيل"],["registration_ends_at","registration","انتهاء التسجيل"],["starts_at","judging","بدء المسابقة"],["ends_at","result","ختام المسابقة"]]){
          if(row[field])derived.push({id:"competition:"+row.id+":"+field,competition_id:row.id,competition_title:row.title,title:row.title+" — "+label,event_date:row[field],kind,derived:true});
        }
      }
      return json([...visible.map(row=>({...row,derived:false})),...derived].sort((a,b)=>String(a.event_date).localeCompare(String(b.event_date))));
    }
    if(path==="/api/competitions"&&method==="GET"){
      const rows=await env.DB.prepare("SELECT * FROM competitions ORDER BY COALESCE(starts_at,created_at) DESC").all();
      const all=rows.results||[];
      const counts=await env.DB.prepare("SELECT r.competition_id,COUNT(*) AS total,SUM(CASE WHEN r.status='approved' THEN 1 ELSE 0 END) AS approved,(SELECT COUNT(DISTINCT s.registration_id) FROM competition_scores s WHERE s.competition_id=r.competition_id) AS scored FROM competition_registrations r GROUP BY r.competition_id").all();
      const countMap=new Map((counts.results||[]).map(row=>[row.competition_id,row]));
      if(user.role==="student"){
        let schoolId=null;
        if(user.group_id){const g=await env.DB.prepare("SELECT school_id FROM groups WHERE id=?").bind(user.group_id).first();schoolId=g?.school_id||null;}
        const visible=all.filter(item=>["announced","registration","judging","results","honored"].includes(item.status)&&(!item.school_id||item.school_id===schoolId));
        const out=[];
        for(const item of visible){
          const competition=competitionJsonFields(item);
          const eligibility=await competitionEligibility(env,user,competition);
          out.push({...competition,my_registration:eligibility.registration,eligibility:{eligible:eligibility.eligible,reasons:eligibility.reasons},entries_count:Number(countMap.get(item.id)?.total||0)});
        }
        return json(out);
      }
      if(!["admin","teacher","director","supervisor"].includes(user.role))return fail(403,"غير مسموح");
      let visible=all;
      if(user.role==="director"){
        const schools=Array.isArray(user.school_ids)?user.school_ids:[];
        visible=all.filter(item=>!item.school_id||schools.includes(item.school_id));
      }else if(["teacher","supervisor"].includes(user.role)){
        visible=all.filter(item=>!["draft","archived"].includes(item.status)||item.created_by===user.id);
      }
      return json(visible.map(item=>{const row=competitionJsonFields(item),c=countMap.get(item.id)||{};return {...row,entries_count:Number(c.total||0),approved_count:Number(c.approved||0),scored_count:Number(c.scored||0)}}));
    }
    if(path==="/api/competitions"&&method==="POST"){
      if(!["admin","director"].includes(user.role))return fail(403,"إنشاء المسابقات متاح للإدارة");
      const parsed=await parseBody(request,24000);if(parsed.error)return parsed.error;const b=parsed.value;
      const title=clean(b.title,180),description=clean(b.description,6000),kind=clean(b.kind,40)||"quran_hifz",season=clean(b.season,80)||"general";
      if(!title)return fail(400,"أدخل عنوان المسابقة");
      if(!COMPETITION_KINDS[kind])return fail(400,"نوع المسابقة غير صحيح");
      let schoolId=clean(b.school_id,80)||null;
      if(user.role==="director"){
        const schools=Array.isArray(user.school_ids)?user.school_ids:[];
        if(!schoolId)schoolId=schools[0]||null;
        if(!schoolId||!schools.includes(schoolId))return fail(403,"اختر مدرسة من نطاقك");
      }else if(schoolId){
        const school=await env.DB.prepare("SELECT id FROM quran_schools WHERE id=? AND active=1").bind(schoolId).first();
        if(!school)return fail(400,"المدرسة غير موجودة");
      }
      const categoryId=clean(b.category_id,80)||null;
      let category=null;
      if(categoryId){category=await env.DB.prepare("SELECT * FROM competition_categories WHERE id=? AND active=1").bind(categoryId).first();if(!category)return fail(400,"الفئة غير موجودة");}
      const registrationStarts=clean(b.registration_starts_at,10)||null,registrationEnds=clean(b.registration_ends_at,10)||null,startsAt=clean(b.starts_at,10)||null,endsAt=clean(b.ends_at,10)||null;
      for(const [value,label] of [[registrationStarts,"بدء التسجيل"],[registrationEnds,"انتهاء التسجيل"],[startsAt,"بداية المسابقة"],[endsAt,"نهاية المسابقة"]])if(value&&!validDateOnly(value))return fail(400,"تاريخ "+label+" غير صحيح");
      if(registrationStarts&&registrationEnds&&registrationEnds<registrationStarts)return fail(400,"انتهاء التسجيل يجب أن يكون بعد بدايته");
      if(startsAt&&endsAt&&endsAt<startsAt)return fail(400,"نهاية المسابقة يجب أن تكون بعد بدايتها");
      const minAge=numberOrNull(b.min_age,3,100),maxAge=numberOrNull(b.max_age,3,100);
      if((minAge!==null&&maxAge!==null)&&maxAge<minAge)return fail(400,"الحد الأعلى للعمر يجب أن يكون أكبر من الأدنى");
      const minHizb=numberOrNull(b.min_hizb,0,60),maxHizb=numberOrNull(b.max_hizb,1,60);
      if((minHizb!==null&&maxHizb!==null)&&maxHizb<minHizb)return fail(400,"الحد الأعلى للحفظ يجب أن يكون أكبر من الأدنى");
      const criteria=normalizeCompetitionCriteria(b.judging_criteria,kind);
      if(!criteria.length)return fail(400,"أضف معيارًا واحدًا على الأقل للتحكيم");
      const awards=normalizeCompetitionAwards(b.awards&&parseJsonArray(b.awards).length?b.awards:defaultCompetitionAwards());
      const maxParticipants=numberOrNull(b.max_participants,1,100000);
      const competition={id:uuid(),school_id:schoolId,title,description,kind,season,category_id:categoryId,status:"draft",registration_starts_at:registrationStarts,registration_ends_at:registrationEnds,starts_at:startsAt,ends_at:endsAt,min_age:minAge??(category?.min_age??null),max_age:maxAge??(category?.max_age??null),riwayat_json:JSON.stringify(normalizeRiwayat(b.riwayat)),min_hizb:minHizb??(category?.min_hizb??null),max_hizb:maxHizb??(category?.max_hizb??null),requires_approval:b.requires_approval===true||b.requires_approval==="true"?1:0,max_participants:maxParticipants,rules:clean(b.rules,8000),judging_criteria_json:JSON.stringify(criteria),awards_json:JSON.stringify(awards),participation_achievement:numberOrNull(b.participation_achievement,0,100000)??0,participation_store:numberOrNull(b.participation_store,0,100000)??0,created_by:user.id,created_at:nowIso(),updated_at:nowIso()};
      await env.DB.prepare("INSERT INTO competitions (id,school_id,title,description,kind,season,category_id,status,registration_starts_at,registration_ends_at,starts_at,ends_at,min_age,max_age,riwayat_json,min_hizb,max_hizb,requires_approval,max_participants,rules,judging_criteria_json,awards_json,participation_achievement,participation_store,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(competition.id,competition.school_id,competition.title,competition.description,competition.kind,competition.season,competition.category_id,competition.status,competition.registration_starts_at,competition.registration_ends_at,competition.starts_at,competition.ends_at,competition.min_age,competition.max_age,competition.riwayat_json,competition.min_hizb,competition.max_hizb,competition.requires_approval,competition.max_participants,competition.rules,competition.judging_criteria_json,competition.awards_json,competition.participation_achievement,competition.participation_store,competition.created_by,competition.created_at,competition.updated_at).run();
      await log(env,user.id,"competition_create",{id:competition.id,kind,status:"draft"});
      return json(competitionJsonFields(competition),201);
    }
    const competitionIdMatch=path.match(/^\/api\/competitions\/([^/]+)$/);
    if(competitionIdMatch&&method==="GET"){
      const competitionId=clean(competitionIdMatch[1],80);
      const row=await env.DB.prepare("SELECT * FROM competitions WHERE id=?").bind(competitionId).first();
      if(!row)return fail(404,"المسابقة غير موجودة");
      const competition=competitionJsonFields(row);
      if(user.role==="student"){
        if(row.status==="draft")return fail(404,"المسابقة غير موجودة");
        const eligibility=await competitionEligibility(env,user,competition);
        const result=await env.DB.prepare("SELECT * FROM competition_results WHERE competition_id=? AND student_id=? AND status='published'").bind(competitionId,user.student_id||"").first();
        const events=await env.DB.prepare("SELECT * FROM competition_events WHERE competition_id=? AND active=1 ORDER BY event_date").bind(competitionId).all();
        return json({...competition,my_registration:eligibility.registration,eligibility:{eligible:eligibility.eligible,reasons:eligibility.reasons},my_result:result||null,events:events.results||[]});
      }
      if(!["admin","teacher","director","supervisor"].includes(user.role))return fail(403,"غير مسموح");
      if(user.role==="director"&&row.school_id&&!(Array.isArray(user.school_ids)&&user.school_ids.includes(row.school_id)))return fail(403,"هذه المسابقة خارج نطاق مدرستك");
      const [events,judges,terms]=await Promise.all([
        env.DB.prepare("SELECT * FROM competition_events WHERE competition_id=? AND active=1 ORDER BY event_date").bind(competitionId).all(),
        env.DB.prepare("SELECT j.user_id,u.display_name FROM competition_judges j JOIN users u ON u.id=j.user_id WHERE j.competition_id=?").bind(competitionId).all(),
        env.DB.prepare("SELECT * FROM competition_reference_terms WHERE active=1 AND (kind=? OR kind='other') ORDER BY sort_order").bind(row.kind).all()
      ]);
      return json({...competition,events:events.results||[],judges:judges.results||[],terms:terms.results||[]});
    }
    if(competitionIdMatch&&method==="PATCH"){
      const competitionId=clean(competitionIdMatch[1],80);
      const row=await env.DB.prepare("SELECT * FROM competitions WHERE id=?").bind(competitionId).first();
      if(!row)return fail(404,"المسابقة غير موجودة");
      if(!await competitionCanManage(env,user,row))return fail(403,"تعديل المسابقة متاح للإدارة المسؤولة");
      const parsed=await parseBody(request,24000);if(parsed.error)return parsed.error;const b=parsed.value;
      const kind=b.kind===undefined?row.kind:clean(b.kind,40);
      if(!COMPETITION_KINDS[kind])return fail(400,"نوع المسابقة غير صحيح");
      const scores=await env.DB.prepare("SELECT COUNT(*) AS n FROM competition_scores WHERE competition_id=?").bind(competitionId).first();
      if(Number(scores?.n||0)>0&&b.judging_criteria!==undefined)return fail(409,"لا يمكن تغيير معايير التحكيم بعد بدء التقييم");
      const title=b.title===undefined?row.title:clean(b.title,180);
      if(!title)return fail(400,"عنوان المسابقة مطلوب");
      const criteria=b.judging_criteria===undefined?parseJsonArray(row.judging_criteria_json):normalizeCompetitionCriteria(b.judging_criteria,kind);
      if(!criteria.length)return fail(400,"أضف معيارًا واحدًا على الأقل للتحكيم");
      const awards=b.awards===undefined?parseJsonArray(row.awards_json):normalizeCompetitionAwards(b.awards);
      const registrationStarts=b.registration_starts_at===undefined?row.registration_starts_at:(clean(b.registration_starts_at,10)||null);
      const registrationEnds=b.registration_ends_at===undefined?row.registration_ends_at:(clean(b.registration_ends_at,10)||null);
      const startsAt=b.starts_at===undefined?row.starts_at:(clean(b.starts_at,10)||null);
      const endsAt=b.ends_at===undefined?row.ends_at:(clean(b.ends_at,10)||null);
      for(const [value,label] of [[registrationStarts,"بدء التسجيل"],[registrationEnds,"انتهاء التسجيل"],[startsAt,"بداية المسابقة"],[endsAt,"نهاية المسابقة"]])if(value&&!validDateOnly(value))return fail(400,"تاريخ "+label+" غير صحيح");
      if(registrationStarts&&registrationEnds&&registrationEnds<registrationStarts)return fail(400,"انتهاء التسجيل يجب أن يكون بعد بدايته");
      if(startsAt&&endsAt&&endsAt<startsAt)return fail(400,"نهاية المسابقة يجب أن تكون بعد بدايتها");
      const minAge=b.min_age===undefined?row.min_age:numberOrNull(b.min_age,3,100);
      const maxAge=b.max_age===undefined?row.max_age:numberOrNull(b.max_age,3,100);
      if((minAge!==null&&maxAge!==null)&&maxAge<minAge)return fail(400,"الحد الأعلى للعمر يجب أن يكون أكبر من الأدنى");
      const minHizb=b.min_hizb===undefined?row.min_hizb:numberOrNull(b.min_hizb,0,60);
      const maxHizb=b.max_hizb===undefined?row.max_hizb:numberOrNull(b.max_hizb,1,60);
      if((minHizb!==null&&maxHizb!==null)&&maxHizb<minHizb)return fail(400,"الحد الأعلى للحفظ يجب أن يكون أكبر من الأدنى");
      const updated={...row,title,description:b.description===undefined?row.description:clean(b.description,6000),kind,season:b.season===undefined?row.season:clean(b.season,80),category_id:b.category_id===undefined?row.category_id:(clean(b.category_id,80)||null),registration_starts_at:registrationStarts,registration_ends_at:registrationEnds,starts_at:startsAt,ends_at:endsAt,min_age:minAge,max_age:maxAge,riwayat_json:b.riwayat===undefined?row.riwayat_json:JSON.stringify(normalizeRiwayat(b.riwayat)),min_hizb:minHizb,max_hizb:maxHizb,requires_approval:b.requires_approval===undefined?row.requires_approval:(b.requires_approval===true||b.requires_approval==="true"?1:0),max_participants:b.max_participants===undefined?row.max_participants:numberOrNull(b.max_participants,1,100000),rules:b.rules===undefined?row.rules:clean(b.rules,8000),judging_criteria_json:JSON.stringify(criteria),awards_json:JSON.stringify(awards),participation_achievement:b.participation_achievement===undefined?row.participation_achievement:(numberOrNull(b.participation_achievement,0,100000)??0),participation_store:b.participation_store===undefined?row.participation_store:(numberOrNull(b.participation_store,0,100000)??0),updated_at:nowIso()};
      await env.DB.prepare("UPDATE competitions SET title=?,description=?,kind=?,season=?,category_id=?,registration_starts_at=?,registration_ends_at=?,starts_at=?,ends_at=?,min_age=?,max_age=?,riwayat_json=?,min_hizb=?,max_hizb=?,requires_approval=?,max_participants=?,rules=?,judging_criteria_json=?,awards_json=?,participation_achievement=?,participation_store=?,updated_at=? WHERE id=?").bind(updated.title,updated.description,updated.kind,updated.season,updated.category_id,updated.registration_starts_at,updated.registration_ends_at,updated.starts_at,updated.ends_at,updated.min_age,updated.max_age,updated.riwayat_json,updated.min_hizb,updated.max_hizb,updated.requires_approval,updated.max_participants,updated.rules,updated.judging_criteria_json,updated.awards_json,updated.participation_achievement,updated.participation_store,updated.updated_at,competitionId).run();
      await log(env,user.id,"competition_update",{id:competitionId});
      return json({ok:true,competition:competitionJsonFields(updated)});
    }
    const competitionStatusMatch=path.match(/^\/api\/competitions\/([^/]+)\/status$/);
    if(competitionStatusMatch&&method==="POST"){
      const competitionId=clean(competitionStatusMatch[1],80);
      const row=await env.DB.prepare("SELECT * FROM competitions WHERE id=?").bind(competitionId).first();
      if(!row)return fail(404,"المسابقة غير موجودة");
      if(!await competitionCanManage(env,user,row))return fail(403,"تغيير حالة المسابقة متاح للإدارة المسؤولة");
      const parsed=await parseBody(request);if(parsed.error)return parsed.error;
      const next=clean(parsed.value.status,20);
      if(!COMPETITION_STATUSES[next])return fail(400,"حالة المسابقة غير صحيحة");
      const allowed=COMPETITION_STATUS_FLOW[row.status]||[];
      if(!allowed.includes(next))return fail(409,"لا يمكن الانتقال من «"+(COMPETITION_STATUSES[row.status]||row.status)+"» إلى «"+(COMPETITION_STATUSES[next]||next)+"»");
      if(next==="registration"){
        const criteria=normalizeCompetitionCriteria(row.judging_criteria_json,row.kind);
        if(!criteria.length)return fail(409,"أضف معايير التحكيم قبل فتح التسجيل");
      }
      if(next==="judging"){
        const approved=await env.DB.prepare("SELECT COUNT(*) AS n FROM competition_registrations WHERE competition_id=? AND status='approved'").bind(competitionId).first();
        if(Number(approved?.n||0)===0)return fail(409,"اعتمد مشاركًا واحدًا على الأقل قبل بدء التحكيم");
      }
      if(next==="results"){
        const results=await env.DB.prepare("SELECT COUNT(*) AS n FROM competition_results WHERE competition_id=?").bind(competitionId).first();
        if(Number(results?.n||0)===0)return fail(409,"ولّد النتائج أولًا قبل الانتقال إلى مرحلة النتائج");
      }
      await env.DB.prepare("UPDATE competitions SET status=?,updated_at=? WHERE id=?").bind(next,nowIso(),competitionId).run();
      await log(env,user.id,"competition_status",{id:competitionId,from:row.status,to:next});
      return json({ok:true,status:next,status_label:COMPETITION_STATUSES[next]});
    }
    const competitionRegisterMatch=path.match(/^\/api\/competitions\/([^/]+)\/register$/);
    if(competitionRegisterMatch&&method==="POST"){
      if(user.role!=="student")return fail(403,"التسجيل متاح لحساب الطالب");
      const competitionId=clean(competitionRegisterMatch[1],80);
      const row=await env.DB.prepare("SELECT * FROM competitions WHERE id=?").bind(competitionId).first();
      if(!row)return fail(404,"المسابقة غير موجودة");
      const competition=competitionJsonFields(row);
      const eligibility=await competitionEligibility(env,user,competition);
      if(!eligibility.eligible)return fail(409,eligibility.reasons[0]||"لا تستوفي شروط المسابقة");
      const parsed=await parseBody(request);if(parsed.error)return parsed.error;
      const note=clean(parsed.value.note,1000);
      const riwaya=clean(parsed.value.riwaya,60)||eligibility.riwaya;
      const allowedRiwayat=competition.riwayat;
      if(allowedRiwayat.length&&!allowedRiwayat.includes(riwaya))return fail(400,"اختر رواية ضمن روايات المسابقة");
      const max=row.max_participants===null?null:Number(row.max_participants);
      if(max!==null){const count=await env.DB.prepare("SELECT COUNT(*) AS n FROM competition_registrations WHERE competition_id=? AND status IN ('pending','approved')").bind(competitionId).first();if(Number(count?.n||0)>=max)return fail(409,"اكتمل العدد المحدد للمسابقة");}
      const status=row.requires_approval===1?"pending":"approved";
      const registration={id:uuid(),competition_id:competitionId,student_id:user.student_id,group_id:user.group_id,status,age_at_registration:eligibility.age,hizb_at_registration:eligibility.hizb,riwaya,note,registered_at:nowIso(),decided_by:status==="approved"?user.id:null,decided_at:status==="approved"?nowIso():null,decision_note:""};
      try{await env.DB.prepare("INSERT INTO competition_registrations (id,competition_id,student_id,group_id,status,age_at_registration,hizb_at_registration,riwaya,note,registered_at,decided_by,decided_at,decision_note) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(registration.id,registration.competition_id,registration.student_id,registration.group_id,registration.status,registration.age_at_registration,registration.hizb_at_registration,registration.riwaya,registration.note,registration.registered_at,registration.decided_by,registration.decided_at,registration.decision_note).run();}
      catch{return fail(409,"لديك تسجيل قائم في هذه المسابقة");}
      await log(env,user.id,"competition_register",{competition_id:competitionId,status});
      return json({ok:true,registration},201);
    }
    const competitionRegistrationsMatch=path.match(/^\/api\/competitions\/([^/]+)\/registrations$/);
    if(competitionRegistrationsMatch&&method==="GET"){
      if(!["admin","teacher","director","supervisor"].includes(user.role))return fail(403,"غير مسموح");
      const competitionId=clean(competitionRegistrationsMatch[1],80);
      const row=await env.DB.prepare("SELECT * FROM competitions WHERE id=?").bind(competitionId).first();
      if(!row)return fail(404,"المسابقة غير موجودة");
      if(user.role==="director"&&row.school_id&&!(Array.isArray(user.school_ids)&&user.school_ids.includes(row.school_id)))return fail(403,"هذه المسابقة خارج نطاق مدرستك");
      const groupIds=await managedGroupIds(env,user);
      let sql="SELECT r.*,s.display_name AS student_name,g.name AS group_name,(SELECT COUNT(*) FROM competition_scores cs WHERE cs.registration_id=r.id) AS scores_count,(SELECT ROUND(AVG(cs.total),2) FROM competition_scores cs WHERE cs.registration_id=r.id) AS average_score,cr.final_score,cr.rank,cr.status AS result_status,cr.award_achievement,cr.award_store FROM competition_registrations r JOIN students s ON s.id=r.student_id LEFT JOIN groups g ON g.id=r.group_id LEFT JOIN competition_results cr ON cr.competition_id=r.competition_id AND cr.registration_id=r.id WHERE r.competition_id=?";
      const binds=[competitionId];
      if(groupIds!==null){if(!groupIds.length)return json([]);sql+=" AND r.group_id IN ("+groupIds.map(()=>"?").join(",")+")";binds.push(...groupIds);}
      sql+=" ORDER BY r.registered_at DESC";
      const rows=await env.DB.prepare(sql).bind(...binds).all();
      return json(rows.results||[]);
    }
    const competitionDecisionMatch=path.match(/^\/api\/competitions\/([^/]+)\/registrations\/([^/]+)\/decision$/);
    if(competitionDecisionMatch&&method==="POST"){
      if(!["admin","teacher","director","supervisor"].includes(user.role))return fail(403,"غير مسموح");
      const competitionId=clean(competitionDecisionMatch[1],80),registrationId=clean(competitionDecisionMatch[2],80);
      const competition=await env.DB.prepare("SELECT * FROM competitions WHERE id=?").bind(competitionId).first();
      if(!competition)return fail(404,"المسابقة غير موجودة");
      const registration=await env.DB.prepare("SELECT * FROM competition_registrations WHERE id=? AND competition_id=?").bind(registrationId,competitionId).first();
      if(!registration)return fail(404,"التسجيل غير موجود");
      if(!await competitionCanManage(env,user,competition)&&!await canManageGroup(env,user,registration.group_id))return fail(403,"هذا التسجيل خارج صلاحيتك");
      const parsed=await parseBody(request);if(parsed.error)return parsed.error;
      const decision=clean(parsed.value.decision,20),note=clean(parsed.value.note,600);
      if(!["approved","rejected","withdrawn","disqualified"].includes(decision))return fail(400,"القرار غير صحيح");
      if(decision==="rejected"&&note.length<3)return fail(400,"اكتب سبب الرفض");
      if(registration.status==="disqualified"&&decision!=="approved")return fail(409,"لا يمكن تغيير قرار الاستبعاد");
      const result=await env.DB.prepare("SELECT status FROM competition_results WHERE competition_id=? AND registration_id=?").bind(competitionId,registrationId).first();
      if(result&&["approved","published"].includes(result.status))return fail(409,"النتيجة معتمدة؛ لا يمكن تغيير التسجيل");
      await env.DB.prepare("UPDATE competition_registrations SET status=?,decided_by=?,decided_at=?,decision_note=? WHERE id=?").bind(decision,user.id,nowIso(),note,registrationId).run();
      await log(env,user.id,"competition_registration_decision",{competition_id:competitionId,registration_id:registrationId,decision});
      return json({ok:true,status:decision,status_label:COMPETITION_REGISTRATION_STATUSES[decision]});
    }
    const competitionScoreMatch=path.match(/^\/api\/competitions\/([^/]+)\/registrations\/([^/]+)\/score$/);
    if(competitionScoreMatch&&method==="POST"){
      if(!["admin","teacher","director","supervisor"].includes(user.role))return fail(403,"التحكيم متاح للفريق التعليمي");
      const competitionId=clean(competitionScoreMatch[1],80),registrationId=clean(competitionScoreMatch[2],80);
      const competition=await env.DB.prepare("SELECT * FROM competitions WHERE id=?").bind(competitionId).first();
      if(!competition)return fail(404,"المسابقة غير موجودة");
      if(competition.status!=="judging")return fail(409,"التحكيم غير مفتوح حاليًا");
      const registration=await env.DB.prepare("SELECT * FROM competition_registrations WHERE id=? AND competition_id=?").bind(registrationId,competitionId).first();
      if(!registration)return fail(404,"التسجيل غير موجود");
      if(registration.status!=="approved")return fail(409,"لا يمكن تقييم مشارك غير معتمد");
      if(!await competitionCanJudge(env,user,competition,registration))return fail(403,"هذه المشاركة خارج صلاحيتك");
      const criteria=normalizeCompetitionCriteria(competition.judging_criteria_json,competition.kind);
      const parsed=await parseBody(request);if(parsed.error)return parsed.error;
      const values=Array.isArray(parsed.value.criteria)?parsed.value.criteria:null;
      if(!values)return fail(400,"أرسل درجات المعايير");
      const provided=new Set(values.map(row=>clean(row&&row.id,40)).filter(Boolean));
      for(const item of criteria)if(!provided.has(item.id))return fail(400,"أكمل درجة المعيار: "+item.label);
      const computed=competitionCriteriaTotal(criteria,values);
      const note=clean(parsed.value.note,1000);
      const id=uuid(),now=nowIso();
      await env.DB.prepare("INSERT INTO competition_scores (id,competition_id,registration_id,judge_user_id,criteria_json,total,note,scored_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(competition_id,registration_id,judge_user_id) DO UPDATE SET criteria_json=excluded.criteria_json,total=excluded.total,note=excluded.note,scored_at=excluded.scored_at").bind(id,competitionId,registrationId,user.id,JSON.stringify(computed.detail),computed.total,note,now).run();
      await log(env,user.id,"competition_score",{competition_id:competitionId,registration_id:registrationId,total:computed.total});
      return json({ok:true,total:computed.total,detail:computed.detail,scored_at:now});
    }
    const competitionJudgesMatch=path.match(/^\/api\/competitions\/([^/]+)\/judges$/);
    if(competitionJudgesMatch&&method==="POST"){
      const competitionId=clean(competitionJudgesMatch[1],80);
      const competition=await env.DB.prepare("SELECT * FROM competitions WHERE id=?").bind(competitionId).first();
      if(!competition)return fail(404,"المسابقة غير موجودة");
      if(!await competitionCanManage(env,user,competition))return fail(403,"تعيين المحكمين متاح للإدارة المسؤولة");
      const parsed=await parseBody(request);if(parsed.error)return parsed.error;
      const judgeId=clean(parsed.value.user_id,80);
      const judge=await env.DB.prepare("SELECT id,display_name,role FROM users WHERE id=? AND active=1").bind(judgeId).first();
      if(!judge||!["admin","teacher","director","supervisor"].includes(judge.role))return fail(400,"اختر محكمًا من الفريق التعليمي");
      await env.DB.prepare("INSERT OR IGNORE INTO competition_judges (competition_id,user_id,created_by) VALUES (?,?,?)").bind(competitionId,judgeId,user.id).run();
      await log(env,user.id,"competition_judge_add",{competition_id:competitionId,judge_id:judgeId});
      return json({ok:true,judge:{id:judge.id,name:judge.display_name,role:judge.role}});
    }
    const competitionJudgeDeleteMatch=path.match(/^\/api\/competitions\/([^/]+)\/judges\/([^/]+)$/);
    if(competitionJudgeDeleteMatch&&method==="DELETE"){
      const competitionId=clean(competitionJudgeDeleteMatch[1],80);
      const competition=await env.DB.prepare("SELECT * FROM competitions WHERE id=?").bind(competitionId).first();
      if(!competition)return fail(404,"المسابقة غير موجودة");
      if(!await competitionCanManage(env,user,competition))return fail(403,"تعيين المحكمين متاح للإدارة المسؤولة");
      await env.DB.prepare("DELETE FROM competition_judges WHERE competition_id=? AND user_id=?").bind(competitionId,clean(competitionJudgeDeleteMatch[2],80)).run();
      return json({ok:true});
    }
    const competitionResultsMatch=path.match(/^\/api\/competitions\/([^/]+)\/results$/);
    if(competitionResultsMatch&&method==="GET"){
      const competitionId=clean(competitionResultsMatch[1],80);
      const competition=await env.DB.prepare("SELECT * FROM competitions WHERE id=?").bind(competitionId).first();
      if(!competition)return fail(404,"المسابقة غير موجودة");
      if(user.role==="student"){
        const row=await env.DB.prepare("SELECT cr.*,s.display_name AS student_name FROM competition_results cr JOIN students s ON s.id=cr.student_id WHERE cr.competition_id=? AND cr.status='published' AND cr.student_id=?").bind(competitionId,user.student_id||"").first();
        const ranking=await env.DB.prepare("SELECT cr.rank,cr.final_score,s.display_name AS student_name,cr.student_id FROM competition_results cr JOIN students s ON s.id=cr.student_id WHERE cr.competition_id=? AND cr.status='published' ORDER BY cr.rank LIMIT 50").bind(competitionId).all();
        return json({mine:row||null,ranking:(ranking.results||[]).map(item=>({...item,is_self:item.student_id===user.student_id}))});
      }
      if(!["admin","teacher","director","supervisor"].includes(user.role))return fail(403,"غير مسموح");
      if(user.role==="director"&&competition.school_id&&!(Array.isArray(user.school_ids)&&user.school_ids.includes(competition.school_id)))return fail(403,"هذه المسابقة خارج نطاق مدرستك");
      const rows=await env.DB.prepare("SELECT cr.*,s.display_name AS student_name,g.name AS group_name FROM competition_results cr JOIN students s ON s.id=cr.student_id LEFT JOIN groups g ON g.id=cr.group_id WHERE cr.competition_id=? ORDER BY cr.rank IS NULL,cr.rank,cr.final_score DESC").bind(competitionId).all();
      return json(rows.results||[]);
    }
    const competitionGenerateMatch=path.match(/^\/api\/competitions\/([^/]+)\/results\/generate$/);
    if(competitionGenerateMatch&&method==="POST"){
      const competitionId=clean(competitionGenerateMatch[1],80);
      const competition=await env.DB.prepare("SELECT * FROM competitions WHERE id=?").bind(competitionId).first();
      if(!competition)return fail(404,"المسابقة غير موجودة");
      if(!await competitionCanManage(env,user,competition))return fail(403,"توليد النتائج متاح للإدارة المسؤولة");
      if(!["judging","results"].includes(competition.status))return fail(409,"ابدأ التحكيم قبل توليد النتائج");
      const approved=await env.DB.prepare("SELECT status FROM competition_results WHERE competition_id=? AND status IN ('approved','published') LIMIT 1").bind(competitionId).first();
      if(approved)return fail(409,"النتائج معتمدة؛ لا يمكن إعادة توليدها");
      const rows=await env.DB.prepare("SELECT r.id,r.student_id,r.group_id,ROUND(AVG(s.total),2) AS average,COUNT(s.id) AS judges FROM competition_registrations r LEFT JOIN competition_scores s ON s.registration_id=r.id WHERE r.competition_id=? AND r.status='approved' GROUP BY r.id ORDER BY average IS NULL,average DESC,r.registered_at").bind(competitionId).all();
      const list=rows.results||[];
      if(!list.length)return fail(409,"لا يوجد مشاركون معتمدون");
      const awards=normalizeCompetitionAwards(competition.awards_json);
      const ranked=list.filter(row=>row.average!==null);
      let lastScore=null,lastRank=0;
      const rankMap=new Map();
      ranked.forEach((row,index)=>{const score=Number(row.average);const rank=lastScore!==null&&score===lastScore?lastRank:index+1;lastScore=score;lastRank=rank;rankMap.set(row.id,rank);});
      await env.DB.prepare("DELETE FROM competition_results WHERE competition_id=? AND status='draft'").bind(competitionId).run();
      const statements=[];
      for(const row of list){
        const rank=rankMap.get(row.id)||null;
        const award=rank?competitionAwardForRank(awards,rank):{achievement:0,store:0,label:""};
        statements.push(env.DB.prepare("INSERT INTO competition_results (id,competition_id,registration_id,student_id,group_id,final_score,rank,status,award_achievement,award_store,note,created_at) VALUES (?,?,?,?,?,?,?,'draft',?,?,?,?)").bind(uuid(),competitionId,row.id,row.student_id,row.group_id,row.average===null?null:Number(row.average),rank,award.achievement,award.store,row.average===null?"لم يُقيَّم بعد":award.label,nowIso()));
      }
      if(statements.length)await env.DB.batch(statements);
      if(competition.status==="judging")await env.DB.prepare("UPDATE competitions SET status='results',updated_at=? WHERE id=?").bind(nowIso(),competitionId).run();
      await log(env,user.id,"competition_results_generate",{competition_id:competitionId,count:list.length});
      const results=await env.DB.prepare("SELECT cr.*,s.display_name AS student_name FROM competition_results cr JOIN students s ON s.id=cr.student_id WHERE cr.competition_id=? ORDER BY cr.rank IS NULL,cr.rank").bind(competitionId).all();
      return json({ok:true,status:"results",results:results.results||[]});
    }
    const competitionApproveMatch=path.match(/^\/api\/competitions\/([^/]+)\/results\/approve$/);
    if(competitionApproveMatch&&method==="POST"){
      const competitionId=clean(competitionApproveMatch[1],80);
      const competition=await env.DB.prepare("SELECT * FROM competitions WHERE id=?").bind(competitionId).first();
      if(!competition)return fail(404,"المسابقة غير موجودة");
      if(!await competitionCanManage(env,user,competition))return fail(403,"اعتماد النتائج متاح للإدارة المسؤولة");
      if(competition.status!=="results")return fail(409,"انتقل إلى مرحلة النتائج قبل الاعتماد");
      const rows=await env.DB.prepare("SELECT * FROM competition_results WHERE competition_id=?").bind(competitionId).all();
      const list=rows.results||[];
      if(!list.length)return fail(409,"لا توجد نتائج للاعتماد");
      if(list.some(row=>["approved","published"].includes(row.status)))return fail(409,"النتائج معتمدة مسبقًا");
      const date=academyDate();
      let awarded=0;
      for(const row of list){
        const award=row.rank?competitionAwardForRank(normalizeCompetitionAwards(competition.awards_json),row.rank):{achievement:0,store:0};
        const achievement=Number(row.award_achievement||award.achievement||0),store=Number(row.award_store||award.store||0);
        let achievementEventId=null,storeEventId=null;
        if(achievement>0||store>0){
          const events=await awardPointsForEvent(env,{studentId:row.student_id,groupId:row.group_id,eventType:"competition_award",eventKey:"competition:"+competitionId+":"+row.student_id+":award",date,reason:"مكافأة مسابقة: "+competition.title+(row.rank?" — المرتبة "+row.rank:""),sourceCollection:"competition_results",sourceId:row.id,awardedBy:user.id,achievementPoints:achievement,storePoints:store});
          achievementEventId=events.find(event=>event.kind==="achievement")?.id||null;
          storeEventId=events.find(event=>event.kind==="store")?.id||null;
          if(events.some(event=>event.status==="awarded"))awarded+=1;
        }
        await env.DB.prepare("UPDATE competition_results SET status='published',award_achievement=?,award_store=?,award_event_achievement_id=?,award_event_store_id=?,approved_by=?,approved_at=? WHERE id=?").bind(achievement,store,achievementEventId,storeEventId,user.id,nowIso(),row.id).run();
      }
      await log(env,user.id,"competition_results_approve",{competition_id:competitionId,count:list.length,awarded});
      return json({ok:true,status:"published",count:list.length,awarded});
    }
    if(path==="/api/competition-events"&&method==="GET"){
      const competitionId=clean(url.searchParams.get("competition_id"),80);
      const rows=competitionId?await env.DB.prepare("SELECT * FROM competition_events WHERE active=1 AND competition_id=? ORDER BY event_date").bind(competitionId).all():await env.DB.prepare("SELECT * FROM competition_events WHERE active=1 ORDER BY event_date").all();
      return json(rows.results||[]);
    }
    if(path==="/api/competition-events"&&method==="POST"){
      if(!["admin","director"].includes(user.role))return fail(403,"إدارة الرزنامة متاحة للإدارة");
      const parsed=await parseBody(request,8000);if(parsed.error)return parsed.error;const b=parsed.value;
      const title=clean(b.title,180),description=clean(b.description,3000),eventDate=clean(b.event_date,10),kind=clean(b.kind,30)||"other",competitionId=clean(b.competition_id,80)||null;
      if(!title||!validDateOnly(eventDate))return fail(400,"أدخل عنوان الحدث وتاريخه");
      if(!["announcement","registration","judging","result","honoring","other"].includes(kind))return fail(400,"نوع الحدث غير صحيح");
      if(competitionId){const competition=await env.DB.prepare("SELECT * FROM competitions WHERE id=?").bind(competitionId).first();if(!competition)return fail(400,"المسابقة غير موجودة");if(!await competitionCanManage(env,user,competition))return fail(403,"هذه المسابقة خارج صلاحيتك");}
      const id=uuid();
      await env.DB.prepare("INSERT INTO competition_events (id,competition_id,title,description,event_date,kind,active,created_by) VALUES (?,?,?,?,?,?,1,?)").bind(id,competitionId,title,description,eventDate,kind,user.id).run();
      await log(env,user.id,"competition_event_create",{id,competition_id:competitionId,event_date:eventDate});
      return json({ok:true,id,title,description,event_date:eventDate,kind,competition_id:competitionId},201);
    }
    const competitionEventMatch=path.match(/^\/api\/competition-events\/([^/]+)$/);
    if(competitionEventMatch&&method==="PATCH"){
      if(!["admin","director"].includes(user.role))return fail(403,"إدارة الرزنامة متاحة للإدارة");
      const event=await env.DB.prepare("SELECT * FROM competition_events WHERE id=?").bind(clean(competitionEventMatch[1],80)).first();
      if(!event)return fail(404,"الحدث غير موجود");
      if(event.competition_id){const competition=await env.DB.prepare("SELECT * FROM competitions WHERE id=?").bind(event.competition_id).first();if(competition&&!await competitionCanManage(env,user,competition))return fail(403,"هذه المسابقة خارج صلاحيتك");}
      const parsed=await parseBody(request,8000);if(parsed.error)return parsed.error;const b=parsed.value;
      const title=b.title===undefined?event.title:clean(b.title,180),description=b.description===undefined?event.description:clean(b.description,3000),eventDate=b.event_date===undefined?event.event_date:clean(b.event_date,10),kind=b.kind===undefined?event.kind:clean(b.kind,30);
      if(!title||!validDateOnly(eventDate))return fail(400,"أدخل عنوان الحدث وتاريخه");
      await env.DB.prepare("UPDATE competition_events SET title=?,description=?,event_date=?,kind=? WHERE id=?").bind(title,description,eventDate,kind,event.id).run();
      return json({ok:true});
    }
    if(competitionEventMatch&&method==="DELETE"){
      if(!["admin","director"].includes(user.role))return fail(403,"إدارة الرزنامة متاحة للإدارة");
      await env.DB.prepare("UPDATE competition_events SET active=0 WHERE id=?").bind(clean(competitionEventMatch[1],80)).run();
      return json({ok:true});
    }
    if(path==="/api/competition-terms"&&method==="GET"){
      const kind=clean(url.searchParams.get("kind"),40);
      const rows=kind?await env.DB.prepare("SELECT * FROM competition_reference_terms WHERE active=1 AND (kind=? OR kind='other') ORDER BY sort_order").bind(kind).all():await env.DB.prepare("SELECT * FROM competition_reference_terms WHERE active=1 ORDER BY sort_order").all();
      return json(rows.results||[]);
    }
    if(path==="/api/competition-terms"&&method==="POST"){
      if(!["admin","director"].includes(user.role))return fail(403,"إدارة الشروط المرجعية متاحة للإدارة");
      const parsed=await parseBody(request,12000);if(parsed.error)return parsed.error;const b=parsed.value;
      const kind=clean(b.kind,40)||"other",title=clean(b.title,180),body=clean(b.body,8000),source=clean(b.source,300);
      if(!COMPETITION_KINDS[kind])return fail(400,"نوع المرجع غير صحيح");
      if(!title||!body)return fail(400,"أدخل عنوان الشروط ونصها");
      const id=uuid();
      await env.DB.prepare("INSERT INTO competition_reference_terms (id,kind,title,body,source,active,sort_order,created_by) VALUES (?,?,?,?,?,1,?,?)").bind(id,kind,title,body,source,Number(b.sort_order||0),user.id).run();
      await log(env,user.id,"competition_term_create",{id,kind});
      return json({ok:true,id,kind,title,body,source},201);
    }
    const competitionTermMatch=path.match(/^\/api\/competition-terms\/([^/]+)$/);
    if(competitionTermMatch&&method==="PATCH"){
      if(!["admin","director"].includes(user.role))return fail(403,"إدارة الشروط المرجعية متاحة للإدارة");
      const term=await env.DB.prepare("SELECT * FROM competition_reference_terms WHERE id=?").bind(clean(competitionTermMatch[1],80)).first();
      if(!term)return fail(404,"المرجع غير موجود");
      const parsed=await parseBody(request,12000);if(parsed.error)return parsed.error;const b=parsed.value;
      await env.DB.prepare("UPDATE competition_reference_terms SET kind=?,title=?,body=?,source=?,sort_order=?,updated_at=? WHERE id=?").bind(b.kind===undefined?term.kind:clean(b.kind,40),b.title===undefined?term.title:clean(b.title,180),b.body===undefined?term.body:clean(b.body,8000),b.source===undefined?term.source:clean(b.source,300),b.sort_order===undefined?term.sort_order:Number(b.sort_order||0),nowIso(),term.id).run();
      return json({ok:true});
    }
    if(competitionTermMatch&&method==="DELETE"){
      if(!["admin","director"].includes(user.role))return fail(403,"إدارة الشروط المرجعية متاحة للإدارة");
      await env.DB.prepare("UPDATE competition_reference_terms SET active=0,updated_at=? WHERE id=?").bind(nowIso(),clean(competitionTermMatch[1],80)).run();
      return json({ok:true});
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
    if(path==="/api/journey"&&method==="GET"){
      const resolved=await resolveQuranStudent(env,user,url.searchParams.get("student_id"));
      if(resolved.error)return resolved.error;
      const student=resolved.student;
      const raw=await env.DB.prepare("SELECT payload_json FROM academy_records WHERE collection='student_journey' AND id=?").bind(student.id).first();
      let record=null;
      try { record=raw?JSON.parse(raw.payload_json):null; } catch { record=null; }
      const answers=cleanJourneyAnswers(record?.answers);
      const pathRow=await quranPathRow(env,student.id);
      const payload=journeyRecordPayload(record,answers);
      payload.student_id=student.id;
      payload.enrolled=Boolean(pathRow);
      payload.path=quranPathPayload(pathRow);
      payload.needs_onboarding=!pathRow&&(!record||record.status!=="applied");
      payload.questions=JOURNEY_QUESTIONS;
      if(resolved.staff){
        const named=await env.DB.prepare("SELECT display_name FROM students WHERE id=?").bind(student.id).first();
        payload.student_name=named?.display_name||"";
      }
      return json(payload);
    }
    if(path==="/api/journey"&&method==="POST"){
      if(user.role!=="student"||!user.student_id)return fail(403,"رحلة الخطة يبدأها الطالب من حسابه");
      const parsed=await parseBody(request,20000);if(parsed.error)return parsed.error;const b=parsed.value;
      if(b.student_id&&b.student_id!==user.student_id)return fail(403,"لا يمكنك تعديل رحلة طالب آخر");
      const resolved=await resolveQuranStudent(env,user,user.student_id);
      if(resolved.error)return resolved.error;
      const student=resolved.student;
      const raw=await env.DB.prepare("SELECT payload_json FROM academy_records WHERE collection='student_journey' AND id=?").bind(student.id).first();
      let record=null;
      try { record=raw?JSON.parse(raw.payload_json):null; } catch { record=null; }
      if(record?.status==="applied")return fail(409,"خطتك مطبقة بالفعل. اطلب تعديلها من الشيخ أو من صفحة مسار القرآن.");
      const existing=cleanJourneyAnswers(record?.answers);
      let answers={...existing};
      if(b.key!==undefined){
        const key=clean(b.key,40);
        const question=JOURNEY_QUESTIONS.find(item=>item.id===key);
        if(!question)return fail(400,"سؤال الرحلة غير معروف");
        const value=String(b.value??"");
        if(!question.options.some(option=>option.value===value))return fail(400,"اختر إجابة صحيحة من الخيارات");
        answers[key]=value;
      }
      if(b.answers!==undefined){
        if(!b.answers||typeof b.answers!=="object"||Array.isArray(b.answers))return fail(400,"صيغة إجابات الرحلة غير صحيحة");
        const cleaned=cleanJourneyAnswers(b.answers);
        for(const id of Object.keys(cleaned))answers[id]=cleaned[id];
      }
      answers=cleanJourneyAnswers(answers);
      const next={
        ...(record||{}),
        id:student.id,
        owner_user_id:user.id,
        group_id:student.group_id||null,
        student_id:student.id,
        answers,
        status:"in_progress",
        approval_status:record?.approval_status==="changes_requested"?"changes_requested":(record?.approval_status==="approved"?"approved":"none"),
        created_at:record?.created_at||nowIso(),
        updated_at:nowIso()
      };
      await saveRecord(env,"student_journey",next);
      if(!record)await log(env,user.id,"journey_start",{student_id:student.id});
      const payload=journeyRecordPayload(next,answers);
      payload.student_id=student.id;
      payload.enrolled=Boolean(await quranPathRow(env,student.id));
      payload.needs_onboarding=!payload.enrolled;
      payload.questions=JOURNEY_QUESTIONS;
      return json(payload);
    }
    if(path==="/api/journey/apply"&&method==="POST"){
      if(user.role!=="student"||!user.student_id)return fail(403,"تطبيق الخطة من حساب الطالب");
      const parsed=await parseBody(request,20000);if(parsed.error)return parsed.error;const b=parsed.value;
      if(b.student_id&&b.student_id!==user.student_id)return fail(403,"لا يمكنك تطبيق خطة طالب آخر");
      const resolved=await resolveQuranStudent(env,user,user.student_id);
      if(resolved.error)return resolved.error;
      const student=resolved.student;
      const raw=await env.DB.prepare("SELECT payload_json FROM academy_records WHERE collection='student_journey' AND id=?").bind(student.id).first();
      let record=null;
      try { record=raw?JSON.parse(raw.payload_json):null; } catch { record=null; }
      if(!record)return fail(409,"ابدأ رحلة الخطة وأكمل أسئلتها أولًا");
      if(record.status==="applied")return fail(409,"خطتك مطبقة بالفعل؛ يمكن للشيخ تعديلها من صفحة متابعة القرآن.");
      const answers=cleanJourneyAnswers(record.answers);
      if(!journeyComplete(answers))return fail(409,"أكمل أسئلة الرحلة الثمانية قبل تطبيق الخطة");
      const recommendation=journeyRecommendation(answers);
      const variantId=clean(b.variant,20)||recommendation.recommended_variant;
      const variant=recommendation.variants.find(item=>item.id===variantId);
      if(!variant)return fail(400,"اختر خطة صحيحة: خفيفة أو متوازنة أو مكثفة");
      if(!variant.fits&&b.acknowledge_over_budget!==true)return fail(409,"الخطة المختارة تتجاوز الوقت الذي أعلنته. اختر خطة أخف، أو أكّد المتابعة بعد مراجعة الشيخ.");
      const hasRestField=Object.prototype.hasOwnProperty.call(b,"rest_day");
      const restDay=!hasRestField||b.rest_day===""?variant.rest_day:(b.rest_day===null?null:Number(b.rest_day));
      if(restDay!==null&&(!Number.isInteger(restDay)||restDay<0||restDay>6))return fail(400,"اختر يوم استدراك صحيحًا أو اتركه فارغًا");
      const requestNote=clean(b.note,500);
      const pathResult=await saveQuranPathForStudent(env,user,student,{
        hifz_plan:variant.plan,
        hifz_category:variant.hifz_category,
        hifz_amount:variant.hifz_amount,
        hifz_unit:variant.hifz_unit,
        ward_ahzab:variant.ward_ahzab,
        rest_day:restDay,
        start_date:academyDate()
      });
      if(pathResult.error)return pathResult.error;
      const planResult=await saveQuranPlanForStudent(env,user,student,{
        path_id:variant.path_id,
        weekly_goal:variant.weekly_goal
      });
      if(planResult.error)return planResult.error;
      const appliedPlan={...variant,rest_day:restDay,weekly_goal:variant.weekly_goal};
      const next={
        ...record,
        answers,
        status:"applied",
        approval_status:"pending",
        applied_plan:appliedPlan,
        applied_at:nowIso(),
        request_note:requestNote,
        review_note:"",
        reviewed_by:null,
        reviewed_at:null,
        revision:Number(record.revision||0)+1,
        updated_at:nowIso()
      };
      await saveRecord(env,"student_journey",next);
      await log(env,user.id,"journey_apply",{student_id:student.id,variant:variant.id,category:variant.hifz_category,ward:variant.ward_ahzab,estimated_daily_minutes:variant.estimated_daily_minutes,over_budget:!variant.fits});
      const payload=journeyRecordPayload(next,answers);
      payload.student_id=student.id;
      payload.enrolled=true;
      payload.needs_onboarding=false;
      payload.path=pathResult.path;
      payload.plan=planResult.plan;
      return json({ok:true,...payload});
    }
    if(path==="/api/journey/review"&&method==="GET"){
      if(!["admin","teacher","director","supervisor"].includes(user.role))return fail(403,"مراجعة خطط الطلاب للشيخ أو الإدارة");
      const status=clean(url.searchParams.get("status"),20)||"pending";
      const allowedStatuses=["pending","approved","changes_requested"];
      if(!allowedStatuses.includes(status))return fail(400,"حالة المراجعة غير صحيحة");
      const rows=(await records(env,"student_journey")).filter(row=>row.applied_at);
      const studentIdsAll=[...new Set(rows.map(row=>row.student_id).filter(Boolean))];
      const currentGroupByStudent=new Map();
      if(studentIdsAll.length){
        const marks=studentIdsAll.map(()=>"?").join(",");
        const found=await env.DB.prepare("SELECT id,group_id FROM students WHERE id IN ("+marks+")").bind(...studentIdsAll).all();
        for(const row of found.results||[])currentGroupByStudent.set(row.id,row.group_id);
      }
      const groupFor=row=>currentGroupByStudent.has(row.student_id)?currentGroupByStudent.get(row.student_id):row.group_id;
      const groupIds=await managedGroupIds(env,user);
      const allowedGroups=groupIds===null?null:new Set(groupIds);
      const scoped=rows.filter(row=>allowedGroups===null||allowedGroups.has(groupFor(row)));
      const counts={pending:0,approved:0,changes_requested:0};
      for(const row of scoped){const state=row.approval_status||"pending";if(counts[state]!==undefined)counts[state]+=1;}
      const filtered=scoped.filter(row=>(row.approval_status||"pending")===status).sort((a,b)=>String(b.applied_at||b.updated_at||"").localeCompare(String(a.applied_at||a.updated_at||"")));
      const studentIds=[...new Set(filtered.map(row=>row.student_id).filter(Boolean))];
      const groupIdsInRows=[...new Set(filtered.map(row=>groupFor(row)).filter(Boolean))];
      const names=new Map(),groupNames=new Map();
      if(studentIds.length){
        const marks=studentIds.map(()=>"?").join(",");
        const found=await env.DB.prepare("SELECT id,display_name FROM students WHERE id IN ("+marks+")").bind(...studentIds).all();
        for(const row of found.results||[])names.set(row.id,row.display_name);
      }
      if(groupIdsInRows.length){
        const marks=groupIdsInRows.map(()=>"?").join(",");
        const found=await env.DB.prepare("SELECT id,name FROM groups WHERE id IN ("+marks+")").bind(...groupIdsInRows).all();
        for(const row of found.results||[])groupNames.set(row.id,row.name);
      }
      return json({
        status,
        counts,
        items:filtered.map(row=>({
          student_id:row.student_id,
          student_name:names.get(row.student_id)||"طالب",
          group_id:groupFor(row)||null,
          group_name:groupNames.get(groupFor(row))||"",
          approval_status:row.approval_status||"pending",
          applied_at:row.applied_at||null,
          updated_at:row.updated_at||null,
          revision:Number(row.revision||0),
          plan:row.applied_plan||null,
          answers:row.answers||{},
          answers_summary:JOURNEY_QUESTIONS.filter(question=>row.answers&&row.answers[question.id]!==undefined).map(question=>({id:question.id,title:question.title,label:question.options.find(option=>option.value===String(row.answers[question.id]))?.label||row.answers[question.id]})),
          request_note:row.request_note||"",
          review_note:row.review_note||"",
          reviewed_at:row.reviewed_at||null
        }))
      });
    }
    if(path==="/api/journey/review"&&method==="POST"){
      if(!["admin","teacher","director","supervisor"].includes(user.role))return fail(403,"مراجعة خطط الطلاب للشيخ أو الإدارة");
      const parsed=await parseBody(request,12000);if(parsed.error)return parsed.error;const b=parsed.value;
      const studentId=clean(b.student_id,80),decision=clean(b.decision,20),note=clean(b.note,500);
      if(!["approved","changes_requested"].includes(decision))return fail(400,"اختر قرارًا صحيحًا: اعتماد أو طلب تعديل");
      if(decision==="changes_requested"&&note.length<3)return fail(400,"اكتب ملاحظة واضحة للطالب عند طلب التعديل");
      const raw=await env.DB.prepare("SELECT payload_json FROM academy_records WHERE collection='student_journey' AND id=?").bind(studentId).first();
      if(!raw)return fail(404,"رحلة الطالب غير موجودة");
      let record=null;
      try { record=JSON.parse(raw.payload_json); } catch { return fail(500,"تعذّرت قراءة رحلة الطالب"); }
      if(!record.applied_at)return fail(409,"لم يطبّق الطالب خطته بعد");
      const currentStudent=await env.DB.prepare("SELECT group_id FROM students WHERE id=? AND active=1").bind(studentId).first();
      if(!currentStudent)return fail(404,"ملف الطالب غير موجود");
      if(!await canManageGroup(env,user,currentStudent.group_id))return fail(403,"هذه الخطة خارج صلاحيتك");
      const now=nowIso();
      const next={
        ...record,
        approval_status:decision,
        review_note:note,
        reviewed_by:user.id,
        reviewed_at:now,
        status:decision==="approved"?"applied":"in_progress",
        updated_at:now
      };
      await saveRecord(env,"student_journey",next);
      await log(env,user.id,decision==="approved"?"journey_review_approved":"journey_review_changes",{student_id:studentId,note});
      return json({ok:true,student_id:studentId,approval_status:decision,review_note:note,reviewed_at:now,status:next.status});
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
      const result=await saveQuranPlanForStudent(env,user,{id:studentId,group_id:st.group_id},b);
      if(result.error)return result.error;
      return json({ok:true,plan:result.plan});
    }
    if(path==="/api/quran/path"&&method==="GET"){
      const resolved=await resolveQuranStudent(env,user,url.searchParams.get("student_id"));
      if(resolved.error)return resolved.error;
      const row=await quranPathRow(env,resolved.student.id);
      return json({enrolled:Boolean(row),path:quranPathPayload(row),plans:QURAN_PLANS,categories:QURAN_CATEGORIES,ward_options:QURAN_WARD,thabit_plans:QURAN_THABIT_PLANS,thabit_reference_status:QURAN_THABIT_REFERENCE_STATUS});
    }
    if(path==="/api/quran/path"&&method==="POST"){
      const parsed=await parseBody(request);if(parsed.error)return parsed.error;const b=parsed.value;
      const resolved=await resolveQuranStudent(env,user,b.student_id);
      if(resolved.error)return resolved.error;
      const result=await saveQuranPathForStudent(env,user,resolved.student,b);
      if(result.error)return result.error;
      return json({ok:true,path:result.path});
    }
    if(path==="/api/quran/logs"&&method==="GET"){
      const resolved=await resolveQuranStudent(env,user,url.searchParams.get("student_id"));
      if(resolved.error)return resolved.error;
      const monthRaw=clean(url.searchParams.get("month"),7);
      const month=/^\d{4}-\d{2}$/.test(monthRaw)?monthRaw:academyDate().slice(0,7);
      const rows=await env.DB.prepare("SELECT id,day,kind,amount,unit,repetitions FROM quran_daily WHERE student_id=? AND day LIKE ? ORDER BY day,created_at").bind(resolved.student.id,month+"-%").all();
      return json((rows.results||[]).map(r=>({day:r.day,kind:r.kind,amount:Number(r.amount),unit:r.unit,repetitions:Number(r.repetitions||0)})));
    }
    if(path==="/api/quran/today"&&method==="GET"){
      const resolved=await resolveQuranStudent(env,user,url.searchParams.get("student_id"));
      if(resolved.error)return resolved.error;
      const pathRow=await quranPathRow(env,resolved.student.id);
      const day=academyDate();
      if(!pathRow)return json({enrolled:false,day,logs:{}});
      const info=quranPathPayload(pathRow);
      const logs=await quranDayState(env,resolved.student.id,day);
      const makeup=await env.DB.prepare("SELECT id,kind,due_date,amount,reason,reason_note,status,proposed_date,blocks_new FROM quran_makeups WHERE student_id=? AND status IN ('open','planned') ORDER BY due_date LIMIT 20").bind(resolved.student.id).all();
      const weekday=new Date(day+"T12:00:00Z").getUTCDay();
      const blocked=(makeup.results||[]).some(row=>Number(row.blocks_new)===1);
      return json({enrolled:true,day,weekday,is_rest_day:info.rest_day===weekday,path:info,logs:{hifz:logs.hifz||null,thabit:logs.thabit||null,ward:logs.ward||null},blocked,makeups:makeup.results||[],streak:await quranStreak(env,resolved.student.id)});
    }
    if(path==="/api/quran/daily"&&method==="POST"){
      const parsed=await parseBody(request);if(parsed.error)return parsed.error;const b=parsed.value;
      const resolved=await resolveQuranStudent(env,user,b.student_id);
      if(resolved.error)return resolved.error;
      const pathRow=await quranPathRow(env,resolved.student.id);
      if(!pathRow)return fail(409,"اختر خطة الحفظ وفئة المحفوظ أولًا");
      const kind=clean(b.kind,10);
      if(!QURAN_KIND_LABELS[kind])return fail(400,"نوع السجل غير صحيح");
      const day=quranDateISO(b.day)||academyDate();
      if(day>academyDate())return fail(400,"لا يمكن تسجيل يوم مستقبلي");
      if(day<addCalendarDays(academyDate(),-30))return fail(400,"لا يمكن إضافة سجل أقدم من 30 يومًا");
      if(kind==="hifz"){
        const block=await env.DB.prepare("SELECT 1 AS blocked FROM quran_makeups WHERE student_id=? AND status IN ('open','planned') AND blocks_new=1 LIMIT 1").bind(resolved.student.id).first();
        if(block)return fail(409,"لديك مقدار أساسي غير منجز؛ أكمل الاستدراك واعتمده أولًا ثم سجّل الحفظ الجديد.");
      }
      const amount=Number(b.amount);
      if(!Number.isFinite(amount)||amount<0||amount>1000)return fail(400,"أدخل مقدارًا صحيحًا");
      const repetitions=Number.isInteger(Number(b.repetitions))?Number(b.repetitions):0;
      if(repetitions<0||repetitions>100)return fail(400,"عدد التكرارات يجب أن يكون بين 0 و100");
      const unit=clean(b.unit,20),linkedScope=clean(b.linked_scope,120),notes=clean(b.notes,600);
      const existing=await env.DB.prepare("SELECT * FROM quran_daily WHERE student_id=? AND day=? AND kind=?").bind(resolved.student.id,day,kind).first();
      if(existing){
        if(Number(existing.amount)===amount&&existing.unit===unit&&Number(existing.repetitions)===repetitions&&existing.notes===notes)return json({ok:true,duplicate:true,entry:existing});
        return fail(409,"سجّلت هذا القسم اليوم بمقدار مختلف. راجع سجل اليوم قبل إعادة التسجيل.");
      }
      const id=uuid();
      await env.DB.prepare("INSERT INTO quran_daily (id,student_id,day,kind,amount,unit,repetitions,linked_scope,notes,created_by) VALUES (?,?,?,?,?,?,?,?,?,?)")
        .bind(id,resolved.student.id,day,kind,amount,unit,repetitions,linkedScope,notes,user.id).run();
      await log(env,user.id,"quran_daily_save",{student_id:resolved.student.id,day,kind,amount});
      const entry=await env.DB.prepare("SELECT * FROM quran_daily WHERE id=?").bind(id).first();
      const activityReason=kind==="hifz"?"حفظ قرآني (الحفظ الجديد)":kind==="thabit"?"تثبيت محفوظ":"ورد يومي";
      const awards=await awardPointsForEvent(env,{studentId:resolved.student.id,groupId:resolved.student.group_id,eventType:kind==="ward"?"quran_reading":"quran_entry",eventKey:"quran_daily:"+id,date:day,reason:activityReason,sourceCollection:"quran_daily",sourceId:id,awardedBy:user.id});
      return json({ok:true,entry,awards,totals:await pointsTotals(env,resolved.student.id)},201);
    }
    if(path==="/api/quran/companion"&&method==="GET"){
      const resolved=await resolveQuranStudent(env,user,url.searchParams.get("student_id"));
      if(resolved.error)return resolved.error;
      const studentId=resolved.student.id;
      const pair=await env.DB.prepare("SELECT p.*,sa.display_name AS student_a_name,sb.display_name AS student_b_name,g.name AS group_name FROM quran_pairs p JOIN students sa ON sa.id=p.student_a JOIN students sb ON sb.id=p.student_b LEFT JOIN groups g ON g.id=p.group_id WHERE p.active=1 AND (p.student_a=? OR p.student_b=?) ORDER BY p.created_at DESC LIMIT 1").bind(studentId,studentId).first();
      if(!pair)return json({paired:false,sessions:[],rubric:QURAN_RUBRIC});
      const partnerId=pair.student_a===studentId?pair.student_b:pair.student_a;
      const partnerName=pair.student_a===studentId?pair.student_b_name:pair.student_a_name;
      const sessions=await env.DB.prepare("SELECT * FROM quran_pair_sessions WHERE pair_id=? ORDER BY day DESC, created_at DESC LIMIT 30").bind(pair.id).all();
      return json({paired:true,pair:{id:pair.id,group_id:pair.group_id,group_name:pair.group_name,student_a:pair.student_a,student_b:pair.student_b,student_a_name:pair.student_a_name,student_b_name:pair.student_b_name,partner_id:partnerId,partner_name:partnerName},sessions:(sessions.results||[]).map(row=>({...row,grade:quranGrade(row.score)})),rubric:QURAN_RUBRIC});
    }
    if(path==="/api/quran/companion/pair"&&method==="POST"){
      if(!["admin","teacher","director","supervisor"].includes(user.role))return fail(403,"ربط الرفيقين من صلاحية الشيخ أو الإدارة");
      const parsed=await parseBody(request);if(parsed.error)return parsed.error;const b=parsed.value;
      const studentA=clean(b.student_a,80),studentB=clean(b.student_b,80);
      if(!studentA||!studentB||studentA===studentB)return fail(400,"اختر طالبين مختلفين");
      const rows=await env.DB.prepare("SELECT id,group_id,display_name FROM students WHERE id IN (?,?) AND active=1").bind(studentA,studentB).all();
      const list=rows.results||[];
      if(list.length!==2)return fail(404,"أحد الطالبين غير موجود");
      if(String(list[0].group_id||"")!==String(list[1].group_id||""))return fail(400,"يجب أن يكون الرفيقان في الفوج نفسه");
      if(user.role!=="admin"&&!await canManageGroup(env,user,list[0].group_id))return fail(403,"هذان الطالبان خارج صلاحيتك");
      await env.DB.prepare("UPDATE quran_pairs SET active=0 WHERE active=1 AND (student_a IN (?,?) OR student_b IN (?,?))").bind(studentA,studentB,studentA,studentB).run();
      const id=uuid();
      await env.DB.prepare("INSERT INTO quran_pairs (id,group_id,student_a,student_b,active,created_by) VALUES (?,?,?,?,1,?)").bind(id,list[0].group_id||null,studentA,studentB,user.id).run();
      await log(env,user.id,"quran_pair_create",{pair_id:id,student_a:studentA,student_b:studentB});
      return json({ok:true,pair:{id,student_a:studentA,student_b:studentB,group_id:list[0].group_id||null}},201);
    }
    if(path==="/api/quran/companion/session"&&method==="POST"){
      const parsed=await parseBody(request);if(parsed.error)return parsed.error;const b=parsed.value;
      const resolved=await resolveQuranStudent(env,user,b.student_id);
      if(resolved.error)return resolved.error;
      const studentId=resolved.student.id;
      const pair=await env.DB.prepare("SELECT * FROM quran_pairs WHERE active=1 AND (student_a=? OR student_b=?) ORDER BY created_at DESC LIMIT 1").bind(studentId,studentId).first();
      if(!pair)return fail(409,"لا يوجد رفيق مرتبط بحسابك بعد. تواصل مع الشيخ لربط الرفيقين.");
      const reciterId=clean(b.reciter_id,80),listenerId=clean(b.listener_id,80);
      const members=[pair.student_a,pair.student_b];
      if(!members.includes(reciterId)||!members.includes(listenerId)||reciterId===listenerId)return fail(400,"حدّد المُسمِّع والمستمع من الرفيقين المرتبطين");
      const amount=clean(b.amount,120);
      if(!amount)return fail(400,"حدّد مقدار التسميع");
      const errors=Math.max(0,Math.min(10000,Math.round(Number(b.errors)||0)));
      const hesitations=Math.max(0,Math.min(10000,Math.round(Number(b.hesitations)||0)));
      const prompts=Math.max(0,Math.min(10000,Math.round(Number(b.prompts)||0)));
      const minutes=Math.max(0,Math.min(1000,Number(b.minutes)||0));
      const expected=Math.max(0,Math.min(1000,Number(b.expected_minutes)||0));
      const computed=quranSessionScore({errors,hesitations,prompts,minutes,expected_minutes:expected});
      let score=computed.total,overrideReason="";
      if(b.score!==undefined&&b.score!==null&&b.score!==""){
        const manual=Math.round(Number(b.score));
        if(!Number.isFinite(manual)||manual<0||manual>100)return fail(400,"الدرجة يجب أن تكون بين 0 و100");
        if(Math.abs(manual-computed.total)>10){
          if(!b.confirm_override||clean(b.override_reason,300).length<5)return fail(400,"الدرجة اليدوية تختلف عن المحسوبة ("+computed.total+") بأكثر من 10. أعد التأكيد واكتب سببًا واضحًا.");
          overrideReason=clean(b.override_reason,300);
        }
        score=manual;
      }
      const id=uuid();
      await env.DB.prepare(`INSERT INTO quran_pair_sessions (id,pair_id,day,reciter_id,listener_id,amount,errors,error_positions,hesitations,prompts,minutes,expected_minutes,score,notes,signed_reciter,signed_listener,override_reason,created_by)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .bind(id,pair.id,academyDate(),reciterId,listenerId,amount,errors,clean(b.error_positions,600),hesitations,prompts,minutes,expected,score,clean(b.notes,600),b.signed_reciter?1:0,b.signed_listener?1:0,overrideReason,user.id).run();
      await log(env,user.id,"quran_companion_session",{pair_id:pair.id,reciter_id:reciterId,score});
      return json({ok:true,session:{id,score,grade:quranGrade(score),computed}},201);
    }
    if(path==="/api/quran/stations"&&method==="GET"){
      const resolved=await resolveQuranStudent(env,user,url.searchParams.get("student_id"));
      if(resolved.error)return resolved.error;
      const rows=await env.DB.prepare("SELECT * FROM quran_stations WHERE student_id=? ORDER BY scheduled_for DESC, created_at DESC LIMIT 50").bind(resolved.student.id).all();
      return json((rows.results||[]).map(row=>({...row,grade:row.score===null||row.score===undefined?null:quranGrade(row.score)})));
    }
    if(path==="/api/quran/stations"&&method==="POST"){
      const parsed=await parseBody(request);if(parsed.error)return parsed.error;const b=parsed.value;
      const resolved=await resolveQuranStudent(env,user,b.student_id);
      if(resolved.error)return resolved.error;
      const stage=clean(b.stage,2);
      if(!["15","30","45","60"].includes(stage))return fail(400,"اختر محطة صحيحة: 15 أو 30 أو 45 أو 60 حزبًا");
      const scheduledFor=quranDateISO(b.scheduled_for);
      if(!scheduledFor)return fail(400,"حدّد موعد المحطة");
      const id=uuid();
      await env.DB.prepare("INSERT INTO quran_stations (id,student_id,stage,scheduled_for,memorized_amount,notes,status,created_by) VALUES (?,?,?,?,?,?, 'scheduled',?)")
        .bind(id,resolved.student.id,stage,scheduledFor,clean(b.memorized_amount,120),clean(b.notes,600),user.id).run();
      await log(env,user.id,"quran_station_request",{student_id:resolved.student.id,stage,scheduled_for:scheduledFor});
      return json({ok:true,id},201);
    }
    if(path==="/api/quran/stations/decision"&&method==="POST"){
      if(!["admin","teacher","director","supervisor"].includes(user.role))return fail(403,"اعتماد المحطات من صلاحية الشيخ أو الإدارة");
      const parsed=await parseBody(request);if(parsed.error)return parsed.error;const b=parsed.value;
      const id=clean(b.id,80),status=clean(b.status,20);
      if(!["approved","rejected","cancelled"].includes(status))return fail(400,"حالة المحطة غير صحيحة");
      const station=await env.DB.prepare("SELECT s.id,s.student_id,st.group_id FROM quran_stations s JOIN students st ON st.id=s.student_id WHERE s.id=?").bind(id).first();
      if(!station)return fail(404,"المحطة غير موجودة");
      if(user.role!=="admin"&&!await canManageGroup(env,user,station.group_id))return fail(403,"هذه المحطة خارج صلاحيتك");
      const scoreRaw=b.score;
      const score=(scoreRaw===null||scoreRaw===undefined||scoreRaw==="")?null:Math.round(Number(scoreRaw));
      if(score!==null&&(!Number.isFinite(score)||score<0||score>100))return fail(400,"الدرجة يجب أن تكون بين 0 و100");
      const errors=Math.max(0,Math.min(10000,Math.round(Number(b.errors)||0)));
      await env.DB.prepare("UPDATE quran_stations SET status=?,score=?,errors=?,notes=?,approved_by=?,approved_at=? WHERE id=?")
        .bind(status,score,errors,clean(b.notes,600),user.id,nowIso(),id).run();
      await log(env,user.id,"quran_station_decision",{station_id:id,status,score});
      return json({ok:true,id,status,score,grade:score===null?null:quranGrade(score)});
    }
    if(path==="/api/quran/makeups"&&method==="GET"){
      const resolved=await resolveQuranStudent(env,user,url.searchParams.get("student_id"));
      if(resolved.error)return resolved.error;
      const rows=await env.DB.prepare("SELECT * FROM quran_makeups WHERE student_id=? ORDER BY status='done', due_date DESC LIMIT 50").bind(resolved.student.id).all();
      return json((rows.results||[]).map(row=>({...row,kind_label:QURAN_KIND_LABELS[row.kind]||row.kind,reason_label:QURAN_MAKEUP_REASONS[row.reason]||row.reason})));
    }
    if(path==="/api/quran/makeups"&&method==="POST"){
      const parsed=await parseBody(request);if(parsed.error)return parsed.error;const b=parsed.value;
      const resolved=await resolveQuranStudent(env,user,b.student_id);
      if(resolved.error)return resolved.error;
      const kind=clean(b.kind,10),reason=clean(b.reason,20);
      if(!QURAN_KIND_LABELS[kind])return fail(400,"حدّد نوع المقدار المتأخر");
      if(!QURAN_MAKEUP_REASONS[reason])return fail(400,"حدّد سبب التأخر");
      const dueDate=quranDateISO(b.due_date)||academyDate();
      if(dueDate>academyDate())return fail(400,"تاريخ الاستحقاق لا يكون في المستقبل");
      const proposed=quranDateISO(b.proposed_date)||addCalendarDays(academyDate(),3);
      const id=uuid();
      await env.DB.prepare("INSERT INTO quran_makeups (id,student_id,kind,due_date,amount,reason,reason_note,status,proposed_date,blocks_new,created_by) VALUES (?,?,?,?,?,?,?, 'open',?,0,?)")
        .bind(id,resolved.student.id,kind,dueDate,clean(b.amount,120),reason,clean(b.reason_note,600),proposed,user.id).run();
      await log(env,user.id,"quran_makeup_create",{student_id:resolved.student.id,kind,due_date:dueDate,reason});
      return json({ok:true,id,status:"open",proposed_date:proposed},201);
    }
    if(path==="/api/quran/makeups/update"&&method==="POST"){
      if(!["admin","teacher","director","supervisor"].includes(user.role))return fail(403,"تحديث الاستدراك من صلاحية الشيخ أو الإدارة");
      const parsed=await parseBody(request);if(parsed.error)return parsed.error;const b=parsed.value;
      const id=clean(b.id,80),status=clean(b.status,20);
      if(!["open","planned","done","cancelled"].includes(status))return fail(400,"حالة الاستدراك غير صحيحة");
      const row=await env.DB.prepare("SELECT m.id,m.student_id,st.group_id FROM quran_makeups m JOIN students st ON st.id=m.student_id WHERE m.id=?").bind(id).first();
      if(!row)return fail(404,"سجل الاستدراك غير موجود");
      if(user.role!=="admin"&&!await canManageGroup(env,user,row.group_id))return fail(403,"هذا السجل خارج صلاحيتك");
      const proposed=quranDateISO(b.proposed_date);
      const blocks=b.blocks_new===undefined?null:(b.blocks_new?1:0);
      await env.DB.prepare("UPDATE quran_makeups SET status=?,proposed_date=COALESCE(?,proposed_date),blocks_new=COALESCE(?,blocks_new),completed_at=?,updated_at=? WHERE id=?")
        .bind(status,proposed||null,blocks,status==="done"?nowIso():null,nowIso(),id).run();
      await log(env,user.id,"quran_makeup_update",{makeup_id:id,status,blocks_new:blocks});
      return json({ok:true,id,status});
    }
    if(path==="/api/quran/summary"&&method==="GET"){
      const resolved=await resolveQuranStudent(env,user,url.searchParams.get("student_id"));
      if(resolved.error)return resolved.error;
      const studentId=resolved.student.id;
      const pathRow=await quranPathRow(env,studentId);
      const totalsRow=await env.DB.prepare("SELECT kind,COUNT(*) AS days,COALESCE(SUM(amount),0) AS total FROM quran_daily WHERE student_id=? GROUP BY kind").bind(studentId).all();
      const byKind={hifz:{days:0,total:0},thabit:{days:0,total:0},ward:{days:0,total:0}};
      for(const row of totalsRow.results||[])if(byKind[row.kind])byKind[row.kind]={days:Number(row.days||0),total:Number(row.total||0)};
      const stations=await env.DB.prepare("SELECT status,COUNT(*) AS n FROM quran_stations WHERE student_id=? GROUP BY status").bind(studentId).all();
      const stationCounts={};for(const row of stations.results||[])stationCounts[row.status]=Number(row.n||0);
      const makeups=await env.DB.prepare("SELECT status,COUNT(*) AS n FROM quran_makeups WHERE student_id=? GROUP BY status").bind(studentId).all();
      const makeupCounts={};for(const row of makeups.results||[])makeupCounts[row.status]=Number(row.n||0);
      const recent=await env.DB.prepare("SELECT day,kind,amount,unit FROM quran_daily WHERE student_id=? ORDER BY day DESC LIMIT 30").bind(studentId).all();
      return json({enrolled:Boolean(pathRow),path:quranPathPayload(pathRow),totals:byKind,stations:stationCounts,makeups:makeupCounts,streak:await quranStreak(env,studentId),recent:recent.results||[]});
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
      const day=academyDate(),parsed=await parseBody(request);if(parsed.error)return parsed.error;
      const challengeId=clean(parsed.value.challenge_id,80);
      const daily=[{id:"daily-quran",points:10},{id:"daily-review",points:10},{id:"daily-adab",points:5}];
      const expected=daily[Number(day.replace(/-/g,""))%daily.length];
      if(challengeId!==expected.id)return fail(400,"أكمل تحدي اليوم المعروض في حسابك لاستلام مكافأته");
      const id=user.student_id+":"+day;
      const old=await env.DB.prepare("SELECT payload_json FROM academy_records WHERE collection='daily_claims' AND id=?").bind(id).first();
      if(old)return fail(409,"لقد استلمت مكافأة اليوم بالفعل");
      const points=expected.points;
      const claim={id,student_id:user.student_id,group_id:user.group_id,day,challenge_id:challengeId,points,claimed_at:nowIso()};
      await saveRecord(env,"daily_claims",claim);
      await awardPointsForEvent(env,{studentId:user.student_id,groupId:user.group_id,eventType:"daily_challenge",eventKey:"daily:"+user.student_id+":"+day,date:day,reason:"تحدي اليوم: "+challengeId,sourceCollection:"daily_claims",sourceId:id,awardedBy:user.id});
      await log(env,user.id,"daily_challenge_claim",{challenge_id:challengeId,points,day});return json({ok:true,claim},201);
    }
    if(path==="/api/gamification"&&method==="GET"){
      if(user.role!=="student"||!user.student_id||!user.group_id)return fail(403,"لوحة الإنجاز متاحة لحساب الطالب المرتبط بفوج");
      const [attendance,quran,attempts,plans,claims]=await Promise.all([
        records(env,"attendance"," AND group_id=?",[user.group_id]),records(env,"quran_progress"," AND student_id=?",[user.student_id]),records(env,"test_attempts"," AND student_id=?",[user.student_id]),records(env,"quran_plan"," AND student_id=?",[user.student_id]),records(env,"daily_claims"," AND student_id=?",[user.student_id])
      ]);
      const present=attendance.filter(a=>a.student_id===user.student_id&&a.status==="present").length;
      const days=new Set(quran.map(q=>q.date)).size,tests=attempts.length,score=attempts.reduce((n,a)=>n+(Number(a.score)||0),0);
      const badges=[];if(days>=1)badges.push({id:"first-step",name:"الخطوة الأولى",description:"سجلت متابعة قرآنية",icon:"🌱"});if(days>=7)badges.push({id:"steady",name:"ثبات أسبوع",description:"تابعت القرآن في سبعة أيام مختلفة",icon:"🌿"});if(tests>=1)badges.push({id:"exam",name:"همة المتعلم",description:"أكملت اختبارًا",icon:"📘"});if(present>=5)badges.push({id:"attendance",name:"مواظب",description:"سجلت حضورًا خمس مرات",icon:"⭐"});
      const day=academyDate(),daily=[{id:"daily-quran",title:"ورد اليوم",description:"اقرأ وردك المقرر ثم راجعه بإتقان",points:10},{id:"daily-review",title:"مراجعة ثابتة",description:"راجع محفوظًا سابقًا قبل إضافة الجديد",points:10},{id:"daily-adab",title:"عمل بالعلم",description:"طبّق فائدة تعلمتها اليوم",points:5}];
      const challenge= daily[Number(day.replace(/-/g,""))%daily.length];
      return json({student_id:user.student_id,points:present*5+days*10+score*3+claims.reduce((n,c)=>n+(Number(c.points)||0),0),stats:{attendance:present,quran_days:days,tests,answers_correct:score},badges,daily_challenge:challenge,plan:plans[0]||null,hearts:Math.max(0,5-attempts.filter(a=>(a.day||(a.submitted_at?academyDate(new Date(a.submitted_at)):""))===day).reduce((n,a)=>n+Math.max(0,Number(a.total||0)-Number(a.score||0)),0)),challenge_claimed:claims.some(c=>c.day===day),updated_at:nowIso()});
    }
    if(path==="/api/leaderboard"&&method==="GET"){
      const scopeAll=user.role==="admin"&&url.searchParams.get("scope")==="all";
      const groupId=user.role==="student"?user.group_id:clean(url.searchParams.get("group_id"),80);
      if(!scopeAll&&!groupId)return fail(400,"لا يوجد فوج مرتبط بالحساب");
      if(scopeAll&&user.role!=="admin")return fail(403,"الترتيب العام متاح للمدير فقط");
      if(!scopeAll&&user.role!=="student"&&!await canManageGroup(env,user,groupId))return fail(403,"لا تملك صلاحية هذا الفوج");
      if(user.role==="student"&&groupId!==user.group_id)return fail(403,"يمكنك رؤية ترتيب فوجك فقط");
      const students=scopeAll?await env.DB.prepare("SELECT s.id,s.display_name,s.group_id,g.name AS group_name FROM students s LEFT JOIN groups g ON g.id=s.group_id WHERE s.active=1 ORDER BY g.name,s.display_name").all():await env.DB.prepare("SELECT s.id,s.display_name,s.group_id,g.name AS group_name FROM students s LEFT JOIN groups g ON g.id=s.group_id WHERE s.group_id=? AND s.active=1 ORDER BY s.display_name").bind(groupId).all();
      const roster=students.results||[];
      const parseStored=rows=>(rows.results||[]).flatMap(row=>{try{return [JSON.parse(row.payload_json)]}catch{return []}});
      const [attendanceResult,quranResult,testResult,claimResult]=await Promise.all([
        env.DB.prepare("SELECT payload_json FROM academy_records WHERE collection='attendance'"+(scopeAll?"":" AND group_id=?")).bind(...(scopeAll?[]:[groupId])).all(),
        env.DB.prepare("SELECT payload_json FROM academy_records WHERE collection='quran_progress'"+(scopeAll?"":" AND group_id=?")).bind(...(scopeAll?[]:[groupId])).all(),
        env.DB.prepare("SELECT payload_json FROM academy_records WHERE collection='test_attempts'"+(scopeAll?"":" AND group_id=?")).bind(...(scopeAll?[]:[groupId])).all(),
        env.DB.prepare("SELECT payload_json FROM academy_records WHERE collection='daily_claims'"+(scopeAll?"":" AND group_id=?")).bind(...(scopeAll?[]:[groupId])).all()
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
        return {name:st.display_name,group_id:st.group_id,group_name:st.group_name||"",points,attendance_rate:attendanceRate,quran_rate:quranRate,quiz_rate:quizRate,challenge_rate:challengeRate,present_days:present,quran_records:quran,quiz_correct:quizCorrect,is_self:user.role==="student"&&st.id===user.student_id};
      }).sort((a,b)=>b.points-a.points||b.attendance_rate-a.attendance_rate||a.name.localeCompare(b.name,"ar"));
      return json(ranked.map((r,i)=>({...r,rank:i+1})));
    }
    // -----------------------------------------------------------------------
    // الاقتصاد التعليمي: النقاط والمتجر
    // -----------------------------------------------------------------------
    if(path==="/api/points/activity"&&method==="POST"){
      if(user.role!=="admin")return fail(403,"اعتماد منح النقاط اليدوي للشيخ وحده");
      const parsed=await parseBody(request);if(parsed.error)return parsed.error;const b=parsed.value;
      const activity=clean(b.activity,20);
      const ACTIVITY_MAP={
        fajr:{eventType:"fajr",reason:"صلاة الفجر"},shuruq:{eventType:"shuruq",reason:"صلاة الشروق"},maghrib:{eventType:"maghrib",reason:"صلاة المغرب"},
        hizb:{eventType:"quran_reading",reason:"قراءة حزب"},hifz_no_errors:{eventType:"hifz_no_errors",reason:"حفظ ثمن دون أخطاء"},hifz_tajweed:{eventType:"hifz_tajweed",reason:"حفظ ثمن بالتجويد"},
        poetry:{eventType:"poetry",reason:"حفظ أربعة أبيات"},support:{eventType:"support_others",reason:"دعم الآخرين"},attendance:{eventType:"attendance_present",reason:"حضور"}
      };
      const map=ACTIVITY_MAP[activity];
      if(!map)return fail(400,"نوع النشاط غير صحيح؛ الأنواع: حضور، حفظ، مراجعة، تثبيت، ورد");
      const resolved=await resolvePointStudent(env,user,clean(b.student_id,80));
      if(resolved.error)return resolved.error;
      const s=resolved.row;
      const date=quranDateISO(b.date)||academyDate();
      if(date>academyDate())return fail(400,"لا يمكن منح نقاط ليوم مستقبلي");
      if(date<addCalendarDays(academyDate(),-30))return fail(400,"لا يمكن منح نقاط لأكثر من 30 يومًا مضت");
      const note=clean(b.note,200);
      if((activity==="hifz_no_errors"||activity==="hifz_tajweed")){
        const prior=await env.DB.prepare("SELECT id FROM point_events WHERE student_id=? AND awarded_date=? AND event_type IN ('hifz_no_errors','hifz_tajweed') AND reversed_at IS NULL LIMIT 1").bind(s.id,date).first();
        if(prior)return fail(409,"تم اعتماد حفظ الثمن اليوم؛ 30 و25 بديلان لا يجتمعان");
      }
      const requestId=activity==="poetry"?clean(b.request_id,80):"";
      if(activity==="poetry"&&!requestId)return fail(400,"يلزم معرّف مستقل لكل مجموعة من أربعة أبيات");
      const eventKey=activity==="poetry"?"poetry:"+date+":"+s.id+":"+requestId:activity==="attendance"?"attendance:"+date+":"+s.id:"manual:"+activity+":"+date+":"+s.id;
      const basePoints=activity==="support"?Number(b.base_points):undefined;
      if(activity==="support"&&(!Number.isInteger(basePoints)||basePoints<1||basePoints>1000))return fail(400,"أدخل نقاط الإنجاز الأصلي ليحسب النظام زيادة 30%");
      const awards=await awardPointsForEvent(env,{studentId:s.id,groupId:s.group_id,eventType:map.eventType,eventKey,date,reason:map.reason+(note?" — "+note:""),sourceCollection:"points_activity",sourceId:eventKey,awardedBy:user.id,achievementPoints:basePoints,storePoints:basePoints});
      await log(env,user.id,"points_activity_award",{student_id:s.id,activity,date,awards:awards.map(a=>a.status+":"+a.kind)});
      return json({ok:true,activity,date,awards,totals:await pointsTotals(env,s.id)},201);
    }
    if(path==="/api/points/summary"&&method==="GET"){
      const resolved=await resolvePointStudent(env,user,clean(url.searchParams.get("student_id"),80));
      if(resolved.error)return resolved.error;
      const s=resolved.row;
      const [totals,recent,redemptions,pending]=await Promise.all([
        pointsTotals(env,s.id),
        recentPointEvents(env,s.id,20),
        env.DB.prepare("SELECT id,item_id,item_name,cost,status,note,requested_at,decision_note FROM store_redemptions WHERE student_id=? ORDER BY requested_at DESC LIMIT 10").bind(s.id).all(),
        env.DB.prepare("SELECT COUNT(*) AS n FROM store_redemptions WHERE student_id=? AND status='pending'").bind(s.id).first()
      ]);
      return json({student:{id:s.id,name:s.display_name,group_id:s.group_id,group_name:s.group_name||""},totals,recent,redemptions:redemptions.results||[],pending_redemptions:Number(pending?.n||0),kind_labels:POINT_KIND_LABELS});
    }
    if(path==="/api/points/history"&&method==="GET"){
      const resolved=await resolvePointStudent(env,user,clean(url.searchParams.get("student_id"),80));
      if(resolved.error)return resolved.error;
      const requested=Number(url.searchParams.get("limit")||50),limit=Number.isInteger(requested)&&requested>0?Math.min(requested,200):50;
      return json(await recentPointEvents(env,resolved.row.id,limit));
    }
    if(path==="/api/points/reading"&&method==="GET"){
      if(user.role!=="student"||!user.student_id)return fail(403,"سجل القراءة متاح لحساب الطالب");
      const [rows,rule]=await Promise.all([
        records(env,"reading_log"," AND student_id=?",[user.student_id]),
        env.DB.prepare("SELECT name,description,achievement_points,store_points,max_per_day,active FROM point_rules WHERE event_type='quran_reading'").first()
      ]);
      const day=academyDate(),days=new Set(rows.map(r=>String(r.day||"")).filter(Boolean));
      let streak=0;for(let i=0;i<400;i++){const d=academyDate(new Date(Date.now()-i*86400000));if(!days.has(d))break;streak++}
      return json({today:day,logged_today:rows.some(r=>r.day===day),total_days:days.size,streak,rule:rule||null,entries:rows.slice(0,30)});
    }
    if(path==="/api/points/reading"&&method==="POST"){
      if(user.role!=="student"||!user.student_id||!user.group_id)return fail(403,"سجل القراءة متاح لحساب الطالب المرتبط بفوج");
      const parsed=await parseBody(request);if(parsed.error)return parsed.error;const b=parsed.value;
      const day=academyDate(),surah=clean(b.surah,80),portion=clean(b.portion,120),reflection=clean(b.reflection,600);
      if(!surah)return fail(400,"اذكر السورة أو الجزء الذي قرأته");
      const id=user.student_id+":"+day;
      const old=await env.DB.prepare("SELECT id FROM academy_records WHERE collection='reading_log' AND id=?").bind(id).first();
      if(old)return fail(409,"سجلت قراءتك لهذا اليوم بالفعل. عُد غدًا لمواصلة سلسلتك.");
      const entry={id,student_id:user.student_id,group_id:user.group_id,day,surah,portion,reflection,created_at:nowIso()};
      await saveRecord(env,"reading_log",entry);
      const awards=await awardPointsForEvent(env,{studentId:user.student_id,groupId:user.group_id,eventType:"quran_reading",eventKey:"reading:"+user.student_id+":"+day,date:day,reason:"قراءة وتدبّر: "+surah+(portion?" · "+portion:""),sourceCollection:"reading_log",sourceId:id,awardedBy:user.id});
      await log(env,user.id,"reading_log",{day,surah,portion});
      return json({ok:true,entry,awards,totals:await pointsTotals(env,user.student_id)},201);
    }
    if(path==="/api/points/rules"&&method==="GET"){
      if(!user)return fail(401,"يلزم تسجيل الدخول");
      const rows=user.role==="admin"
        ? await env.DB.prepare("SELECT * FROM point_rules ORDER BY sort_order, created_at").all()
        : await env.DB.prepare("SELECT id,event_type,name,description,achievement_points,store_points,max_per_day,auto_award,active,sort_order FROM point_rules WHERE active=1 ORDER BY sort_order, created_at").all();
      return json(rows.results||[]);
    }
    if(path==="/api/points/rules"&&method==="POST"){
      if(user.role!=="admin")return fail(403,"تعديل قواعد النقاط للمدير فقط");
      const parsed=await parseBody(request);if(parsed.error)return parsed.error;const b=parsed.value;
      const eventType=clean(b.event_type,60).toLowerCase();
      const name=clean(b.name,120),description=clean(b.description,600);
      const achievement=Number(b.achievement_points??0),store=Number(b.store_points??0);
      const bonusPercent=Number(b.bonus_percent??0);
      if(!Number.isInteger(bonusPercent)||bonusPercent<0||bonusPercent>300)return fail(400,"نسبة الزيادة يجب أن تكون بين 0 و300");
      const rawMax=b.max_per_day,maxPerDay=rawMax===""||rawMax===null||rawMax===undefined?null:Number(rawMax);
      if(!/^[a-z0-9_]{3,60}$/.test(eventType))return fail(400,"نوع الحدث يجب أن يكون بأحرف لاتينية صغيرة وأرقام وشرطة سفلية");
      if(!name)return fail(400,"أدخل اسم قاعدة النقاط");
      if(!Number.isInteger(achievement)||achievement<0||achievement>MAX_RULE_POINTS||!Number.isInteger(store)||store<0||store>MAX_RULE_POINTS)return fail(400,"قيم النقاط يجب أن تكون أعدادًا صحيحة بين 0 و100000");
      if(achievement===0&&store===0)return fail(400,"حدّد نقاط إنجاز أو نقاط متجر أكبر من صفر");
      if(maxPerDay!==null&&(!Number.isInteger(maxPerDay)||maxPerDay<1||maxPerDay>1000))return fail(400,"السقف اليومي يجب أن يكون بين 1 و1000 أو فارغًا");
      const autoAward=b.auto_award===false||b.auto_award===0?0:1;
      const active=b.active===false||b.active===0?0:1;
      const sortOrder=Number.isInteger(Number(b.sort_order))?Number(b.sort_order):0;
      const requestedId=clean(b.id,80);
      let existing=requestedId?await env.DB.prepare("SELECT * FROM point_rules WHERE id=?").bind(requestedId).first():null;
      if(!existing)existing=await env.DB.prepare("SELECT * FROM point_rules WHERE event_type=?").bind(eventType).first();
      const now=nowIso();
      let rule;
      if(existing){
        await env.DB.prepare("UPDATE point_rules SET event_type=?,name=?,description=?,achievement_points=?,store_points=?,max_per_day=?,auto_award=?,active=?,sort_order=?,bonus_percent=?,updated_at=? WHERE id=?").bind(eventType,name,description,achievement,store,maxPerDay,autoAward,active,sortOrder,bonusPercent,now,existing.id).run();
        rule={...existing,event_type:eventType,name,description,achievement_points:achievement,store_points:store,max_per_day:maxPerDay,auto_award:autoAward,active,sort_order:sortOrder,bonus_percent:bonusPercent,updated_at:now};
      }else{
        const id=requestedId||uuid();
        await env.DB.prepare("INSERT INTO point_rules (id,event_type,name,description,achievement_points,store_points,max_per_day,auto_award,active,sort_order,bonus_percent,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(id,eventType,name,description,achievement,store,maxPerDay,autoAward,active,sortOrder,bonusPercent,user.id,now,now).run();
        rule={id,event_type:eventType,name,description,achievement_points:achievement,store_points:store,max_per_day:maxPerDay,auto_award:autoAward,active,sort_order:sortOrder,bonus_percent:bonusPercent,created_at:now,updated_at:now};
      }
      await log(env,user.id,"point_rule_save",{rule_id:rule.id,event_type:eventType,achievement,store,active});
      return json({ok:true,rule},existing?200:201);
    }
    if(path==="/api/points/award"&&method==="POST"){
      if(user.role!=="admin")return fail(403,"اعتماد منح النقاط اليدوي للشيخ وحده");
      const parsed=await parseBody(request);if(parsed.error)return parsed.error;const b=parsed.value;
      const resolved=await resolvePointStudent(env,user,clean(b.student_id,80));
      if(resolved.error)return resolved.error;
      const s=resolved.row,reason=clean(b.reason,500);
      const ruleId=clean(b.rule_id,80);
      const rule=ruleId?await env.DB.prepare("SELECT * FROM point_rules WHERE id=?").bind(ruleId).first():null;
      if(ruleId&&!rule)return fail(404,"قاعدة النقاط غير موجودة");
      if(!rule&&reason.length<3)return fail(400,"اكتب سبب منح النقاط (3 أحرف على الأقل)");
      const basePoints=Number(b.base_points??b.points??Math.max(Number(b.achievement_points)||0,Number(b.store_points)||0,Number(rule?.achievement_points)||0,Number(rule?.store_points)||0));
      const bonusPercent=Number(rule?.bonus_percent||0);
      const points=bonusPercent>0?Math.round(basePoints*(1+bonusPercent/100)):basePoints;
      if(!Number.isInteger(points)||points<=0||points>MAX_MANUAL_POINTS)return fail(400,"النقاط الممنوحة بعد المكافأة يجب أن تكون عددًا صحيحًا بين 1 و1000");
      const requestId=clean(b.request_id,80);
      const eventKey="manual:"+(/^[a-zA-Z0-9_-]{6,80}$/.test(requestId)?requestId:uuid());
      const date=academyDate(),events=[];
      for(const kind of POINT_KINDS){
        const inserted=await insertPointEvent(env,{student_id:s.id,group_id:s.group_id,rule_id:rule?.id||null,event_type:"manual",kind,points,reason:reason||rule.name,event_key:eventKey,awarded_date:date,awarded_by:user.id});
        events.push({kind,points,status:inserted.inserted?"awarded":"duplicate",id:inserted.id});
      }
      await log(env,user.id,"points_manual_award",{student_id:s.id,points,rule_id:rule?.id||null,event_key:eventKey});
      return json({ok:true,events,totals:await pointsTotals(env,s.id)},201);
    }
    if(path==="/api/points/streak"&&method==="GET"){
      const studentId=user.role==="student"?user.student_id:clean(url.searchParams.get("student_id"),80);
      if(!studentId)return fail(400,"حدّد الطالب");
      if(user.role!=="admin"&&!(user.role==="student"&&user.student_id===studentId))return fail(403,"عرض الاستمرارية متاح للشيخ والطالب نفسه");
      const rows=await env.DB.prepare("SELECT activity,current_days,last_date,awarded_milestones,updated_at FROM student_point_streaks WHERE student_id=? ORDER BY activity").bind(studentId).all();
      return json((rows.results||[]).map(row=>({...row,awarded_milestones:(()=>{try{return JSON.parse(row.awarded_milestones||"[]")}catch{return []}})()})));
    }
    if(path==="/api/points/referrals"&&method==="GET"){
      if(user.role!=="admin")return fail(403,"قائمة الإحالات للشيخ وحده");
      const studentId=clean(url.searchParams.get("student_id"),80);
      const rows=await env.DB.prepare("SELECT r.*,a.display_name AS inviter_name,b.display_name AS invited_name FROM student_referrals r JOIN students a ON a.id=r.inviter_student_id JOIN students b ON b.id=r.invited_student_id WHERE (?='' OR r.inviter_student_id=?) ORDER BY r.created_at DESC LIMIT 100").bind(studentId,studentId).all();
      return json(rows.results||[]);
    }
    if(path==="/api/points/streak"&&method==="POST"){
      if(user.role!=="admin")return fail(403,"اعتماد الاستمرارية ومكافآتها للشيخ وحده");
      const parsed=await parseBody(request);if(parsed.error)return parsed.error;const b=parsed.value;
      const studentId=clean(b.student_id,80),activity=clean(b.activity,20),date=quranDateISO(b.date)||academyDate();
      if(!["hifz","fajr","shuruq"].includes(activity))return fail(400,"المسار يجب أن يكون الحفظ أو الفجر أو الشروق");
      if(date>academyDate())return fail(400,"لا يمكن تسجيل استمرارية مستقبلية");
      const student=await env.DB.prepare("SELECT id,group_id FROM students WHERE id=? AND active=1").bind(studentId).first();if(!student)return fail(404,"الطالب غير موجود");
      const base=Number(b.base_points);if(!Number.isInteger(base)||base<1||base>1000)return fail(400,"أدخل نقاط الإنجاز الأساسية الصحيحة");
      const old=await env.DB.prepare("SELECT * FROM student_point_streaks WHERE student_id=? AND activity=?").bind(studentId,activity).first();
      if(old&&old.last_date===date)return fail(409,"سُجل هذا اليوم في سلسلة الاستمرارية بالفعل");
      let days=old&&old.last_date===addCalendarDays(date,-1)?Number(old.current_days)+1:1;
      let milestones=[];try{milestones=JSON.parse(old?.awarded_milestones||"[]")}catch{}
      const due=[5,10,20,30].includes(days)&&!milestones.includes(days);
      const now=nowIso();
      if(due)milestones.push(days);
      await env.DB.prepare("INSERT INTO student_point_streaks(student_id,activity,current_days,last_date,awarded_milestones,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(student_id,activity) DO UPDATE SET current_days=excluded.current_days,last_date=excluded.last_date,awarded_milestones=excluded.awarded_milestones,updated_at=excluded.updated_at").bind(studentId,activity,days,date,JSON.stringify(milestones),now).run();
      let bonus=0;
      if(due){bonus=Math.round(base*.5);for(const kind of POINT_KINDS)await insertPointEvent(env,{student_id:studentId,group_id:student.group_id,rule_id:null,event_type:"streak_bonus",kind,points:bonus,reason:"مكافأة استمرارية "+days+" يومًا — "+activity,event_key:"streak:"+studentId+":"+activity+":"+days,awarded_date:date,awarded_by:user.id});}
      await log(env,user.id,"points_streak_record",{student_id:studentId,activity,date,days,bonus});
      return json({ok:true,days,milestone:due?days:null,bonus,totals:await pointsTotals(env,studentId)});
    }
    if(path==="/api/points/ethics"&&method==="GET"){
      const studentId=user.role==="student"?user.student_id:clean(url.searchParams.get("student_id"),80);
      if(!studentId)return fail(400,"حدّد الطالب");
      if(user.role!=="admin"&&!(user.role==="student"&&user.student_id===studentId))return fail(403,"عرض سجل الأخلاق متاح للشيخ والطالب نفسه");
      const state=await env.DB.prepare("SELECT warnings,multiplier_status,updated_at FROM student_ethics WHERE student_id=?").bind(studentId).first();
      return json({student_id:studentId,warnings:Number(state?.warnings||0),multiplier_status:state?.multiplier_status||"active",ethics_points:state?.multiplier_status==="forfeited"?0:state?.multiplier_status==="suspended"?100:300});
    }
    if(path==="/api/points/ethics"&&method==="POST"){
      if(user.role!=="admin")return fail(403,"سجل الأخلاق والتنبيهات للشيخ وحده");
      const parsed=await parseBody(request);if(parsed.error)return parsed.error;const b=parsed.value;
      const studentId=clean(b.student_id,80),action=clean(b.action,20),reason=clean(b.reason,500);
      const student=await env.DB.prepare("SELECT id,group_id FROM students WHERE id=? AND active=1").bind(studentId).first();if(!student)return fail(404,"الطالب غير موجود");
      if(reason.length<3)return fail(400,"اكتب سبب الإجراء");
      let state=await env.DB.prepare("SELECT * FROM student_ethics WHERE student_id=?").bind(studentId).first();
      let warnings=Number(state?.warnings||0),status=state?.multiplier_status||"active";
      if(action==="award"){
        if(status==="forfeited")return fail(409,"حُرم الطالب من مكافأة الأخلاق نهائيًا");
        const amount=status==="suspended"?100:300,eventKey="ethics-award:"+studentId+":"+academyDate();
        for(const kind of POINT_KINDS)await insertPointEvent(env,{student_id:studentId,group_id:student.group_id,event_type:"ethics_reward",kind,points:amount,reason:"مكافأة الأخلاق: "+reason,event_key:eventKey,awarded_date:academyDate(),awarded_by:user.id});
        await log(env,user.id,"student_ethics_award",{student_id:studentId,amount,status});
        return json({ok:true,points:amount,multiplier_status:status,totals:await pointsTotals(env,studentId)});
      }else if(action==="warning"){
        if(status==="forfeited")return fail(409,"حُرم الطالب من المضاعفة نهائيًا");
        const deduction=Number(b.deduction_points||0);
        if(warnings>=3&&(!Number.isInteger(deduction)||deduction<1||deduction>1000))return fail(400,"بعد التنبيه الثالث يجب تحديد خصم النقاط");
        warnings++;if(warnings>=3)status="suspended";
        if(warnings>3){const eventKey="ethics-penalty:"+studentId+":"+warnings;for(const kind of POINT_KINDS)await insertPointEvent(env,{student_id:studentId,group_id:student.group_id,event_type:"penalty",kind,points:-deduction,reason:"جزاء أخلاقي: "+reason,event_key:eventKey,awarded_date:academyDate(),awarded_by:user.id});}
      }else if(action==="forfeit"){status="forfeited";}else if(action==="restore"){if(status==="forfeited")return fail(409,"الحرمان النهائي لا يُعاد");status="active";}else return fail(400,"الإجراء غير معروف");
      await env.DB.prepare("INSERT INTO student_ethics(student_id,warnings,multiplier_status,updated_at,updated_by) VALUES(?,?,?,?,?) ON CONFLICT(student_id) DO UPDATE SET warnings=excluded.warnings,multiplier_status=excluded.multiplier_status,updated_at=excluded.updated_at,updated_by=excluded.updated_by").bind(studentId,warnings,status,nowIso(),user.id).run();
      await log(env,user.id,"student_ethics_"+action,{student_id:studentId,warnings,status,reason});
      return json({ok:true,warnings,multiplier_status:status,ethics_points:status==="forfeited"?0:status==="suspended"?100:300,totals:await pointsTotals(env,studentId)});
    }
    if(path==="/api/points/referrals"&&method==="POST"){
      if(user.role!=="admin")return fail(403,"اعتماد الزملاء الجدد للشيخ وحده");
      const parsed=await parseBody(request);if(parsed.error)return parsed.error;const b=parsed.value;
      const inviter=clean(b.inviter_student_id,80),invited=clean(b.invited_student_id,80);
      if(!inviter||!invited||inviter===invited)return fail(400,"اختر طالبين مختلفين");
      const pair=await env.DB.prepare("SELECT id,group_id FROM students WHERE id IN (?,?) AND active=1").bind(inviter,invited).all();
      if((pair.results||[]).length!==2)return fail(404,"أحد الطالبين غير موجود");
      const id=uuid();const result=await env.DB.prepare("INSERT OR IGNORE INTO student_referrals(id,inviter_student_id,invited_student_id,status,created_by) VALUES(?,?,?,'pending',?)").bind(id,inviter,invited,user.id).run();
      if(!Number(result?.meta?.changes||0))return fail(409,"سُجلت هذه الإحالة من قبل");
      await log(env,user.id,"student_referral_create",{inviter_student_id:inviter,invited_student_id:invited});
      return json({ok:true,id,status:"pending",eligible_after_days:7},201);
    }
    const referralConfirm=path.match(/^\/api\/points\/referrals\/([^/]+)\/confirm$/);
    if(referralConfirm&&method==="POST"){
      if(user.role!=="admin")return fail(403,"اعتماد مكافأة الإحالة للشيخ وحده");
      const id=clean(referralConfirm[1],80),ref=await env.DB.prepare("SELECT * FROM student_referrals WHERE id=?").bind(id).first();
      if(!ref)return fail(404,"الإحالة غير موجودة");
      if(ref.status!=="pending")return fail(409,"الإحالة عولجت من قبل");
      const elapsed=await env.DB.prepare("SELECT (julianday('now')-julianday(created_at)) AS days FROM student_referrals WHERE id=?").bind(id).first();
      if(Number(elapsed?.days||0)<7)return fail(409,"لم يكتمل أسبوع الثبات بعد");
      const inviter=await env.DB.prepare("SELECT id,group_id FROM students WHERE id=? AND active=1").bind(ref.inviter_student_id).first();
      if(!inviter)return fail(404,"الطالب الداعي غير موجود");
      for(const kind of POINT_KINDS)await insertPointEvent(env,{student_id:inviter.id,group_id:inviter.group_id,event_type:"referral_week",kind,points:20,reason:"إحضار زميل ثبت أسبوعًا",event_key:"referral:"+id,awarded_date:academyDate(),awarded_by:user.id});
      await env.DB.prepare("UPDATE student_referrals SET status='confirmed',confirmed_by=?,confirmed_at=? WHERE id=? AND status='pending'").bind(user.id,nowIso(),id).run();
      await log(env,user.id,"student_referral_confirm",{referral_id:id,student_id:inviter.id});
      return json({ok:true,points:20,totals:await pointsTotals(env,inviter.id)});
    }
        const pointEventReverseMatch=path.match(/^\/api\/points\/events\/([^/]+)\/reverse$/);
    if(pointEventReverseMatch&&method==="POST"){
      if(user.role!=="admin")return fail(403,"عكس النقاط للشيخ وحده");
      const parsed=await parseBody(request);if(parsed.error)return parsed.error;
      const reason=clean(parsed.value.reason,500);
      if(reason.length<3)return fail(400,"اكتب سبب عكس الحركة");
      const eventId=clean(pointEventReverseMatch[1],80);
      const row=await env.DB.prepare("SELECT * FROM point_events WHERE id=?").bind(eventId).first();
      if(!row)return fail(404,"حركة النقاط غير موجودة");
      if(row.event_type==="store_redemption")return fail(409,"حركة الصرف تُعالج بقرار طلب الصرف لا بعكس النقاط");
      if(row.reversed_at)return fail(409,"هذه الحركة معكوسة بالفعل");
      const s=await env.DB.prepare("SELECT id,group_id FROM students WHERE id=?").bind(row.student_id).first();
      if(!s||!await canManageGroup(env,user,s.group_id))return fail(403,"هذه الحركة خارج صلاحيتك");
      const result=await env.DB.prepare("UPDATE point_events SET reversed_at=?,reversed_by=?,reversal_reason=? WHERE student_id=? AND event_key=? AND event_type=? AND reversed_at IS NULL AND event_type<>'store_redemption'").bind(nowIso(),user.id,reason,row.student_id,row.event_key,row.event_type).run();
      if(!Number(result?.meta?.changes||0))return fail(409,"تعذّر عكس الحركة؛ ربما عُكست للتو");
      await log(env,user.id,"points_event_reverse",{event_id:eventId,student_id:row.student_id,paired_events:Number(result.meta.changes),reason});
      return json({ok:true,totals:await pointsTotals(env,row.student_id)});
    }
    if(path==="/api/penalties"&&method==="GET"){
      if(!["admin","teacher","director","supervisor"].includes(user.role))return fail(403,"عرض الجزاءات من صلاحية الطاقم");
      const studentId=clean(url.searchParams.get("student_id"),80);
      if(!studentId)return fail(400,"حدّد الطالب");
      const s=await env.DB.prepare("SELECT id,group_id FROM students WHERE id=?").bind(studentId).first();
      if(!s||!await canManageGroup(env,user,s.group_id))return fail(403,"هذا الطالب خارج صلاحيتك");
      const rows=await env.DB.prepare("SELECT id,student_id,points,reason,awarded_date,awarded_by,created_at,reversed_at,reversal_reason FROM point_events WHERE student_id=? AND event_type='penalty' ORDER BY created_at DESC LIMIT 100").bind(studentId).all();
      return json(rows.results||[]);
    }
    if(path==="/api/penalties"&&method==="POST"){
      if(user.role!=="admin")return fail(403,"خصم النقاط من صلاحية الشيخ وحده");
      const parsed=await parseBody(request);if(parsed.error)return parsed.error;const b=parsed.value;
      const resolved=await resolvePointStudent(env,user,clean(b.student_id,80));
      if(resolved.error)return resolved.error;
      const s=resolved.row,reason=clean(b.reason,500);
      if(reason.length<5)return fail(400,"أدخل سبب الجزاء (5 أحرف على الأقل)");
      const amount=Number(b.store_points);
      if(!Number.isInteger(amount)||amount<=0||amount>MAX_MANUAL_POINTS)return fail(400,"مبلغ الخصم يجب أن يكون عددًا صحيحًا بين 1 و1000");
      const totals=await pointsTotals(env,s.id);
      if(amount>totals.store)return fail(409,"لا يمكن خصم أكثر من الرصيد المُنفق المتاح ("+totals.store+")");
      const inserted=await insertPointEvent(env,{student_id:s.id,group_id:s.group_id,rule_id:null,event_type:"penalty",kind:"store",points:-amount,reason,awarded_date:academyDate(),awarded_by:user.id,event_key:"penalty:"+uuid()});
      await log(env,user.id,"points_penalty",{student_id:s.id,amount,reason,event_id:inserted.id});
      return json({ok:true,deducted:amount,totals:await pointsTotals(env,s.id)},201);
    }
    // -----------------------------------------------------------------------
    // ترقية المستوى: سجل في academy_records (collection='student_levels') بلا جدول جديد.
    // المستوى يبدأ عند 1 ويزداد بقرار الشيخ (لا تلقائيًا بالنقاط)، وكل ترقية تُمنح
    // بمحرك النقاط الموجود (rule-level-promote) مع منع التكرار لكل مستوى.
    // -----------------------------------------------------------------------
    if(path==="/api/students/level"&&method==="GET"){
      const studentId=clean(url.searchParams.get("student_id"),80);
      if(!studentId)return fail(400,"حدّد الطالب");
      const s=await env.DB.prepare("SELECT id,group_id FROM students WHERE id=? AND active=1").bind(studentId).first();
      if(!s)return fail(404,"لا يوجد طالب بهذا المعرف");
      if(user.role==="student"){if(user.student_id!==studentId)return fail(403,"هذا الطالب خارج صلاحيتك")}
      else if(!["admin","teacher","director","supervisor"].includes(user.role)||!await canManageGroup(env,user,s.group_id))return fail(403,"هذا الطالب خارج صلاحيتك");
      const rec=await env.DB.prepare("SELECT payload_json FROM academy_records WHERE collection='student_levels' AND id=?").bind(s.id).first();
      let level=1,reason="",date="";try{const payload=JSON.parse(rec?.payload_json||"{}");level=Number(payload.level)||1;reason=String(payload.reason||"");date=String(payload.date||"")}catch{}
      return json({level,last_reason:reason,last_date:date});
    }
    if(path==="/api/students/level"&&method==="POST"){
      if(user.role!=="admin")return fail(403,"الترقية من صلاحية الشيخ وحده");
      const parsed=await parseBody(request,2000);if(parsed.error)return parsed.error;const b=parsed.value;
      const studentId=clean(b.student_id,80);
      if(!studentId)return fail(400,"حدّد الطالب");
      const s=await env.DB.prepare("SELECT id,group_id FROM students WHERE id=? AND active=1").bind(studentId).first();
      if(!s)return fail(404,"لا يوجد طالب بهذا المعرف");
      if(!await canManageGroup(env,user,s.group_id))return fail(403,"هذا الطالب خارج صلاحيتك");
      const reason=clean(b.reason,500);
      if(reason.length<3)return fail(400,"اكتب سبب الترقية (3 أحرف على الأقل)");
      const rec=await env.DB.prepare("SELECT payload_json FROM academy_records WHERE collection='student_levels' AND id=?").bind(s.id).first();
      let current=1;try{current=Number(JSON.parse(rec?.payload_json||"{}")?.level)||1}catch{}
      if(!Number.isFinite(current)||current<1||current>100)current=1;
      const target=current+1;
      const now=nowIso();
      const payload=JSON.stringify({level:target,promoted_by:user.id,reason,date:academyDate()});
      await env.DB.prepare("INSERT INTO academy_records (collection,id,owner_user_id,group_id,student_id,payload_json,updated_at) VALUES ('student_levels',?,?,?,?,?,?) ON CONFLICT(collection,id) DO UPDATE SET payload_json=excluded.payload_json,group_id=excluded.group_id,student_id=excluded.student_id,updated_at=excluded.updated_at").bind(s.id,user.id,s.group_id,s.id,payload,now).run();
      const awards=await awardPointsForEvent(env,{studentId:s.id,groupId:s.group_id,eventType:"level_promote",eventKey:"level:"+s.id+":"+target,date:academyDate(),reason:"ترقية إلى المستوى "+target+": "+reason,sourceCollection:"student_levels",sourceId:s.id,awardedBy:user.id});
      await log(env,user.id,"level_promote",{student_id:s.id,level:target,reason});
      return json({ok:true,level:target,awards:awards.filter(a=>a.status==="awarded")},201);
    }
    // -----------------------------------------------------------------------
    // بطاقات الطلاب: إنشاء/عرض/إعادة إصدار/إلغاء/طباعة جماعية.
    // -----------------------------------------------------------------------
    if(path==="/api/student-cards"&&method==="GET"){
      const requested=clean(url.searchParams.get("student_id"),80);
      const studentId=user.role==="student"?user.student_id:requested;
      if(!studentId)return fail(400,"حدّد الطالب");
      const student=await studentCardRow(env,studentId);
      if(!student)return fail(404,"ملف الطالب غير موجود");
      if(!await canAccessStudentCard(env,user,student))return fail(403,"هذه البطاقة خارج صلاحيتك");
      const ensured=await ensureStudentCard(env,student,user.id);
      const card=ensured.card;
      if(ensured.created)await log(env,user.id,"student_card_auto_create",{card_id:card.id,student_id:student.id});
      return json({card:cardPublic(card),links:cardLinks(card,url.origin),student:{id:student.id,name:student.name,group_id:student.group_id,group_name:student.group_name||""},created:ensured.created});
    }
    if(path==="/api/student-cards"&&method==="POST"){
      const parsed=await parseBody(request,4000);if(parsed.error)return parsed.error;const b=parsed.value;
      const studentId=user.role==="student"?user.student_id:(clean(b.student_id,80)||user.student_id);
      if(!studentId)return fail(400,"حدّد الطالب");
      const student=await studentCardRow(env,studentId);
      if(!student)return fail(404,"ملف الطالب غير موجود");
      if(!await canAccessStudentCard(env,user,student))return fail(403,"هذه البطاقة خارج صلاحيتك");
      const ensured=await ensureStudentCard(env,student,user.id);
      const card=ensured.card;
      const created=ensured.created;
      await log(env,user.id,created?"student_card_create":"student_card_open",{card_id:card.id,student_id:student.id});
      return json({ok:true,created,card:cardPublic(card),links:cardLinks(card,url.origin),student:{id:student.id,name:student.name,group_id:student.group_id,group_name:student.group_name||""}},created?201:200);
    }
    if(path==="/api/student-cards/bulk"&&method==="POST"){
      if(user.role==="student")return fail(403,"غير مسموح");
      const parsed=await parseBody(request,4000);if(parsed.error)return parsed.error;const b=parsed.value;
      const groupId=clean(b.group_id,80);
      const offset=Math.max(0,Math.min(100000,Math.floor(Number(b.offset)||0)));
      const limit=Math.max(1,Math.min(200,Math.floor(Number(b.limit)||200)));
      if(!groupId||!await canManageGroup(env,user,groupId))return fail(403,"اختر فوجًا ضمن صلاحيتك");
      const group=await groupRow(env,groupId);
      if(!group||group.active!==1)return fail(404,"الفوج غير موجود أو غير نشط");
      const rows=await env.DB.prepare("SELECT id,display_name AS name FROM students WHERE group_id=? AND active=1 ORDER BY display_name LIMIT ? OFFSET ?").bind(groupId,limit,offset).all();
      const cards=[];
      for(const row of rows.results||[]){
        const ensured=await ensureStudentCard(env,{id:row.id,name:row.name,group_id:groupId},user.id);
        const card=ensured.card;
        cards.push({student:{id:row.id,name:row.name,group_id:groupId,group_name:group.name},card:cardPublic(card),links:cardLinks(card,url.origin)});
      }
      await log(env,user.id,"student_cards_bulk",{group_id:groupId,count:cards.length});
      return json({group:{id:group.id,name:group.name},count:cards.length,cards,next_offset:(rows.results||[]).length===limit?offset+cards.length:null,has_more:(rows.results||[]).length===limit});
    }
    const cardReissueMatch=path.match(/^\/api\/student-cards\/([^/]+)\/reissue$/);
    if(cardReissueMatch&&method==="POST"){
      const card=await cardRecord(env,decodeURIComponent(cardReissueMatch[1]));
      if(!card)return fail(404,"البطاقة غير موجودة");
      const student=await studentCardRow(env,card.student_id);
      if(!student||!await canAccessStudentCard(env,user,student))return fail(403,"هذه البطاقة خارج صلاحيتك");
      const parsed=await parseBody(request,4000);if(parsed.error)return parsed.error;const b=parsed.value;
      const requestedKind=clean(b.kind,20);
      if(requestedKind&&!CARD_KINDS[requestedKind])return fail(400,"نوع الرمز غير معروف");
      const kinds=requestedKind?[requestedKind]:CARD_KIND_ORDER;
      let updated=card;
      for(const kind of kinds)updated=await issueCardToken(updated,kind);
      updated.name=student.name;updated.group_id=student.group_id;
      await saveRecord(env,"student_cards",updated);
      await log(env,user.id,"student_card_reissue",{card_id:updated.id,student_id:student.id,kinds});
      return json({ok:true,card:cardPublic(updated),links:cardLinks(updated,url.origin)});
    }
    const cardRevokeMatch=path.match(/^\/api\/student-cards\/([^/]+)\/revoke$/);
    if(cardRevokeMatch&&method==="POST"){
      const card=await cardRecord(env,decodeURIComponent(cardRevokeMatch[1]));
      if(!card)return fail(404,"البطاقة غير موجودة");
      const student=await studentCardRow(env,card.student_id);
      if(!student||!await canAccessStudentCard(env,user,student))return fail(403,"هذه البطاقة خارج صلاحيتك");
      const parsed=await parseBody(request,4000);if(parsed.error)return parsed.error;const b=parsed.value;
      const reason=clean(b.reason,300),requestedKind=clean(b.kind,20);
      if(reason.length<3)return fail(400,"اكتب سبب إلغاء الرمز");
      if(requestedKind&&!CARD_KINDS[requestedKind])return fail(400,"نوع الرمز غير معروف");
      const kinds=requestedKind?[requestedKind]:CARD_KIND_ORDER,now=nowIso();
      const tokens={...(card.tokens||{})};
      for(const kind of kinds){if(tokens[kind])tokens[kind]={...tokens[kind],revoked_at:now,revoked_reason:reason};}
      const updated={...card,tokens,updated_at:now};
      await saveRecord(env,"student_cards",updated);
      await log(env,user.id,"student_card_revoke",{card_id:updated.id,student_id:student.id,kinds,reason});
      return json({ok:true,card:cardPublic(updated),links:cardLinks(updated,url.origin)});
    }
    const cardPrintMatch=path.match(/^\/api\/student-cards\/([^/]+)\/print$/);
    if(cardPrintMatch&&method==="GET"){
      const card=await cardRecord(env,decodeURIComponent(cardPrintMatch[1]));
      if(!card)return fail(404,"البطاقة غير موجودة");
      const student=await studentCardRow(env,card.student_id);
      if(!student||!await canAccessStudentCard(env,user,student))return fail(403,"هذه البطاقة خارج صلاحيتك");
      await log(env,user.id,"student_card_print",{card_id:card.id,student_id:student.id});
      return json({ok:true,card:cardPublic(card),links:cardLinks(card,url.origin),student:{id:student.id,name:student.name,group_id:student.group_id,group_name:student.group_name||""}});
    }
    // -----------------------------------------------------------------------
    // عالم المهام: يُشتق من أعمال حقيقية، والاستلام عبر محرك النقاط الموجود.
    // -----------------------------------------------------------------------
    if(path==="/api/missions"&&method==="GET"){
      if(user.role!=="student"||!user.student_id)return fail(403,"المهام متاحة لحساب الطالب");
      return json(await missionPayload(env,user.student_id));
    }
    if(path==="/api/missions/claim"&&method==="POST"){
      if(user.role!=="student"||!user.student_id||!user.group_id)return fail(403,"المهام متاحة لحساب الطالب المرتبط بفوج");
      const limited=await rateLimit(env,"mission-claim",user.student_id,10,600);
      if(!limited.allowed)return fail(429,"محاولات استلام كثيرة خلال وقت قصير. انتظر قليلًا.");
      const parsed=await parseBody(request,4000);if(parsed.error)return parsed.error;const b=parsed.value;
      const missionId=clean(b.mission_id,60);
      const mission=MISSION_SIDE.find(item=>item.id===missionId);
      if(!mission)return fail(400,"مهمة غير معروفة");
      const payload=await missionPayload(env,user.student_id);
      const state=payload.side.find(item=>item.id===missionId);
      if(!state||!state.done)return fail(409,"أكمل المهمة أولًا ثم استلم مكافأتها");
      if(state.claimed)return fail(409,"استلمت مكافأة هذه المهمة اليوم");
      const today=payload.today;
      const awards=await awardPointsForEvent(env,{studentId:user.student_id,groupId:user.group_id,eventType:"mission_side",eventKey:"mission:"+missionId+":"+today+":"+user.student_id,date:today,reason:"مهمة يومية: "+mission.title,sourceCollection:"student_missions",sourceId:user.student_id,awardedBy:user.id});
      const claimRow=await env.DB.prepare("SELECT payload_json FROM academy_records WHERE collection='student_missions' AND id=?").bind(user.student_id).first();
      let record={id:user.student_id,student_id:user.student_id,group_id:user.group_id,claims:{},updated_at:nowIso()};
      if(claimRow){try{record={...record,...JSON.parse(claimRow.payload_json)}}catch{}}
      record.claims={...(record.claims||{}),[missionId]:today};
      record.updated_at=nowIso();
      await saveRecord(env,"student_missions",record);
      await log(env,user.id,"mission_claim",{mission_id:missionId,day:today,awards});
      return json({ok:true,awards,totals:await pointsTotals(env,user.student_id),missions:await missionPayload(env,user.student_id)});
    }
    if(path==="/api/store/items"&&method==="GET"){
      const select="SELECT id,name,description,icon,image_url,cost,stock,max_per_student,active,sort_order FROM store_items";
      const rows=user.role==="admin"
        ? await env.DB.prepare("SELECT id,name,description,icon,image_url,cost,stock,max_per_student,active,sort_order,created_at,updated_at FROM store_items ORDER BY sort_order, cost").all()
        : await env.DB.prepare(select+" WHERE active=1 ORDER BY sort_order, cost").all();
      const items=rows.results||[];
      let used=new Map();
      if(user.role==="student"&&user.student_id){
        const usage=await env.DB.prepare("SELECT item_id,COUNT(*) AS n FROM store_redemptions WHERE student_id=? AND status IN ('pending','approved','fulfilled') GROUP BY item_id").bind(user.student_id).all();
        used=new Map((usage.results||[]).map(row=>[row.item_id,Number(row.n)]));
      }
      const enriched=items.map(item=>({...item,used:used.get(item.id)||0}));
      const balance=user.role==="student"&&user.student_id?(await pointsTotals(env,user.student_id)).store:null;
      const recommendations=user.role==="student"&&user.student_id?storeRecommendationPayload(enriched,balance):null;
      return json({items:enriched,balance,recommendations});
    }
    if(path==="/api/store/items"&&method==="POST"){
      if(user.role!=="admin")return fail(403,"إدارة المتجر للمدير فقط");
      const parsed=await parseBody(request);if(parsed.error)return parsed.error;const b=parsed.value;
      const name=clean(b.name,160),description=clean(b.description,2000),icon=clean(b.icon,8)||"🎁";
      const imageUrl=clean(b.image_url,500);
      const cost=Number(b.cost);
      const rawStock=b.stock,stock=rawStock===""||rawStock===null||rawStock===undefined?null:Number(rawStock);
      const rawMax=b.max_per_student,maxPerStudent=rawMax===""||rawMax===null||rawMax===undefined?null:Number(rawMax);
      const active=b.active===false||b.active===0?0:1;
      const sortOrder=Number.isInteger(Number(b.sort_order))?Number(b.sort_order):0;
      if(!name)return fail(400,"أدخل اسم المادة");
      if(!Number.isInteger(cost)||cost<1||cost>MAX_RULE_POINTS)return fail(400,"تكلفة المادة يجب أن تكون بين 1 و100000");
      if(stock!==null&&(!Number.isInteger(stock)||stock<0))return fail(400,"المخزون يجب أن يكون عددًا صحيحًا غير سالب أو فارغًا");
      if(maxPerStudent!==null&&(!Number.isInteger(maxPerStudent)||maxPerStudent<1))return fail(400,"حد الطالب يجب أن يكون عددًا صحيحًا موجبًا أو فارغًا");
      const requestedId=clean(b.id,80),now=nowIso();
      let item;
      if(requestedId){
        const existing=await env.DB.prepare("SELECT * FROM store_items WHERE id=?").bind(requestedId).first();
        if(!existing)return fail(404,"المادة غير موجودة");
        await env.DB.prepare("UPDATE store_items SET name=?,description=?,icon=?,image_url=?,cost=?,stock=?,max_per_student=?,active=?,sort_order=?,updated_at=? WHERE id=?").bind(name,description,icon,imageUrl,cost,stock,maxPerStudent,active,sortOrder,now,requestedId).run();
        item={...existing,name,description,icon,image_url:imageUrl,cost,stock,max_per_student:maxPerStudent,active,sort_order:sortOrder,updated_at:now};
      }else{
        const id=uuid();
        await env.DB.prepare("INSERT INTO store_items (id,name,description,icon,image_url,cost,stock,max_per_student,active,sort_order,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(id,name,description,icon,imageUrl,cost,stock,maxPerStudent,active,sortOrder,user.id,now,now).run();
        item={id,name,description,icon,image_url:imageUrl,cost,stock,max_per_student:maxPerStudent,active,sort_order:sortOrder,created_at:now,updated_at:now};
      }
      await log(env,user.id,"store_item_save",{item_id:item.id,cost,active});
      return json({ok:true,item},requestedId?200:201);
    }
    if(path==="/api/store/redeem"&&method==="POST"){
      if(user.role!=="student"||!user.student_id||!user.group_id)return fail(403,"طلب الصرف متاح لحساب الطالب المرتبط بفوج");
      const limited=await rateLimit(env,"store-redeem",user.student_id,20,600);
      if(!limited.allowed)return fail(429,"طلبات صرف كثيرة خلال وقت قصير. انتظر قليلًا ثم أعد المحاولة.");
      const parsed=await parseBody(request);if(parsed.error)return parsed.error;const b=parsed.value;
      const itemId=clean(b.item_id,80),note=clean(b.note,300),requestId=clean(b.request_id,80);
      // معرّف الصرف مشتق من request_id حتى يعيد الطلب نفسه نتيجة واحدة ولا يخصم مرتين.
      let redemptionId=uuid();
      if(requestId)redemptionId="rdm-"+(await hashToken("redeem:"+user.student_id+":"+requestId)).slice(0,32);
      if(requestId){
        const existing=await env.DB.prepare("SELECT id,item_id,item_name,cost,status,note FROM store_redemptions WHERE id=?").bind(redemptionId).first();
        if(existing)return json({ok:true,duplicate:true,redemption:{id:existing.id,item_id:existing.item_id,item_name:existing.item_name,cost:Number(existing.cost),status:existing.status,note:existing.note},balance:(await pointsTotals(env,user.student_id)).store});
      }
      const item=await env.DB.prepare("SELECT * FROM store_items WHERE id=? AND active=1").bind(itemId).first();
      if(!item)return fail(404,"المادة غير متاحة");
      const balance=(await pointsTotals(env,user.student_id)).store;
      if(balance<Number(item.cost))return fail(409,"رصيد المتجر لا يكفي لهذا الطلب");
      if(item.stock!==null&&Number(item.stock)<=0)return fail(409,"نفدت الكمية المتاحة");
      if(item.max_per_student!==null&&item.max_per_student!==undefined){
        const used=await env.DB.prepare("SELECT COUNT(*) AS n FROM store_redemptions WHERE student_id=? AND item_id=? AND status IN ('pending','approved','fulfilled')").bind(user.student_id,itemId).first();
        if(Number(used?.n||0)>=Number(item.max_per_student))return fail(409,"بلغت الحد الأقصى المسموح لك من هذه المادة");
      }
      if(item.stock!==null){
        const stockUpdate=await env.DB.prepare("UPDATE store_items SET stock=stock-1,updated_at=? WHERE id=? AND stock>0").bind(nowIso(),itemId).run();
        if(!Number(stockUpdate?.meta?.changes||0))return fail(409,"نفدت الكمية المتاحة");
      }
      const eventId=uuid();
      try{
        await insertPointEvent(env,{id:eventId,student_id:user.student_id,group_id:user.group_id,rule_id:null,event_type:"store_redemption",kind:"store",points:-Number(item.cost),reason:"طلب صرف: "+item.name,event_key:"redeem:"+redemptionId,awarded_date:academyDate(),source_collection:"store_redemptions",source_id:redemptionId,awarded_by:user.id});
        await env.DB.prepare("INSERT INTO store_redemptions (id,item_id,item_name,student_id,group_id,cost,status,note,debit_event_id) VALUES (?,?,?,?,?,?,'pending',?,?)").bind(redemptionId,itemId,item.name,user.student_id,user.group_id,Number(item.cost),note,eventId).run();
      }catch(error){
        if(item.stock!==null)await env.DB.prepare("UPDATE store_items SET stock=stock+1,updated_at=? WHERE id=?").bind(nowIso(),itemId).run();
        try{await env.DB.prepare("UPDATE point_events SET reversed_at=?,reversed_by=?,reversal_reason=? WHERE id=? AND reversed_at IS NULL").bind(nowIso(),user.id,"فشل إنشاء طلب الصرف",eventId).run()}catch{}
        throw error;
      }
      await log(env,user.id,"store_redeem",{redemption_id:redemptionId,item_id:itemId,cost:item.cost,request_id:requestId||null});
      return json({ok:true,redemption:{id:redemptionId,item_id:itemId,item_name:item.name,cost:Number(item.cost),status:"pending",note},balance:balance-Number(item.cost)},201);
    }
    if(path==="/api/store/redemptions"&&method==="GET"){
      const status=clean(url.searchParams.get("status"),20);
      const statusFilter=["pending","approved","rejected","fulfilled","cancelled"].includes(status)?" AND r.status='"+status+"'":"";
      if(user.role==="student"){
        if(!user.student_id)return fail(403,"حساب الطالب غير مرتبط بملف طالب");
        const rows=await env.DB.prepare("SELECT r.*,s.display_name FROM store_redemptions r JOIN students s ON s.id=r.student_id WHERE r.student_id=?"+statusFilter+" ORDER BY r.requested_at DESC LIMIT 100").bind(user.student_id).all();
        return json(rows.results||[]);
      }
      if(!["admin","teacher","director","supervisor"].includes(user.role))return fail(403,"غير مسموح");
      const groupIds=await managedGroupIds(env,user);
      if(groupIds!==null&&!groupIds.length)return json([]);
      const binds=[];
      let sql="SELECT r.*,s.display_name,g.name AS group_name FROM store_redemptions r JOIN students s ON s.id=r.student_id LEFT JOIN groups g ON g.id=r.group_id WHERE 1=1"+statusFilter;
      if(groupIds!==null){sql+=" AND r.group_id IN ("+groupIds.map(()=>"?").join(",")+")";binds.push(...groupIds)}
      sql+=" ORDER BY r.requested_at DESC LIMIT 200";
      return json((await env.DB.prepare(sql).bind(...binds).all()).results||[]);
    }
    const redemptionDecisionMatch=path.match(/^\/api\/store\/redemptions\/([^/]+)\/decision$/);
    if(redemptionDecisionMatch&&method==="POST"){
      if(!["admin","teacher","director","supervisor"].includes(user.role))return fail(403,"قرار طلب الصرف للمعلم أو الإدارة");
      const parsed=await parseBody(request);if(parsed.error)return parsed.error;const b=parsed.value;
      const decision=clean(b.decision,20),note=clean(b.note,500);
      if(!["approved","rejected","fulfilled"].includes(decision))return fail(400,"اختر قرارًا صحيحًا");
      const row=await env.DB.prepare("SELECT * FROM store_redemptions WHERE id=?").bind(clean(redemptionDecisionMatch[1],80)).first();
      if(!row)return fail(404,"طلب الصرف غير موجود");
      if(!await canManageGroup(env,user,row.group_id))return fail(403,"هذا الطلب خارج صلاحيتك");
      if(row.status==="rejected"||row.status==="cancelled")return fail(409,"لا يمكن تغيير طلب صرف منتهٍ");
      if(row.status==="fulfilled")return fail(409,"تم تنفيذ الطلب بالفعل");
      if(decision==="rejected"&&note.length<3)return fail(400,"اكتب سبب رفض الطلب");
      const now=nowIso();
      if(decision==="rejected"){
        await env.DB.prepare("UPDATE store_redemptions SET status='rejected',decided_by=?,decided_at=?,decision_note=? WHERE id=?").bind(user.id,now,note,row.id).run();
        if(row.debit_event_id)await env.DB.prepare("UPDATE point_events SET reversed_at=?,reversed_by=?,reversal_reason=? WHERE id=? AND reversed_at IS NULL").bind(now,user.id,"رفض طلب صرف: "+(note||row.item_name),row.debit_event_id).run();
        const item=await env.DB.prepare("SELECT stock FROM store_items WHERE id=?").bind(row.item_id).first();
        if(item&&item.stock!==null)await env.DB.prepare("UPDATE store_items SET stock=stock+1,updated_at=? WHERE id=?").bind(now,row.item_id).run();
      }else{
        await env.DB.prepare("UPDATE store_redemptions SET status=?,decided_by=?,decided_at=?,decision_note=? WHERE id=?").bind(decision,user.id,now,note,row.id).run();
      }
      await log(env,user.id,"store_redemption_"+decision,{redemption_id:row.id,student_id:row.student_id,cost:row.cost});
      return json({ok:true,status:decision,totals:await pointsTotals(env,row.student_id)});
    }
    if(path==="/api/metrics"&&method==="GET"){
      if(user.role!=="admin")return fail(403,"forbidden");const counts=await env.DB.prepare("SELECT (SELECT COUNT(*) FROM users) AS users,(SELECT COUNT(*) FROM students WHERE active=1) AS students,(SELECT COUNT(*) FROM groups WHERE active=1) AS groups,(SELECT COUNT(*) FROM academy_records) AS records").first();return json({...counts,storage:"d1"});
    }
    if(path==="/api/admin/system-check"&&method==="GET"){
      if(user.role!=="admin")return fail(403,"forbidden");
      const [counts,roles,collections,schemaProbe]=await Promise.all([
        env.DB.prepare("SELECT (SELECT COUNT(*) FROM users WHERE role='admin' AND active=1) AS active_admins,(SELECT COUNT(*) FROM users WHERE active=1) AS active_users,(SELECT COUNT(*) FROM students WHERE active=1) AS active_students,(SELECT COUNT(*) FROM students s LEFT JOIN users u ON u.id=s.user_id AND u.active=1 AND u.role='student' WHERE s.active=1 AND u.id IS NULL) AS students_without_login,(SELECT COUNT(*) FROM students s LEFT JOIN groups g ON g.id=s.group_id AND g.active=1 WHERE s.active=1 AND g.id IS NULL) AS students_without_active_group,(SELECT COUNT(*) FROM groups g LEFT JOIN users u ON u.id=g.teacher_id AND u.active=1 AND u.role IN ('teacher','admin') WHERE g.active=1 AND (g.teacher_id IS NULL OR u.id IS NULL)) AS groups_without_valid_teacher,(SELECT COUNT(*) FROM sessions WHERE expires_at<=strftime('%Y-%m-%dT%H:%M:%fZ','now')) AS expired_sessions,(SELECT COUNT(*) FROM academy_records) AS saved_records,(SELECT COUNT(*) FROM users WHERE active=1 AND role IN ('director','supervisor')) AS active_director_supervisor_accounts").first(),
        env.DB.prepare("SELECT role,COUNT(*) AS total FROM users WHERE active=1 GROUP BY role ORDER BY role").all(),
        env.DB.prepare("SELECT collection,COUNT(*) AS total FROM academy_records GROUP BY collection ORDER BY collection").all(),
        env.DB.prepare("SELECT (SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='join_requests') AS join_requests_table,(SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='users') AS users_table,(SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='users' AND sql LIKE '%visitor%') AS visitor_role_allowed").first()
      ]);
      return json({checked_at:nowIso(),storage:"cloudflare-d1",bootstrap_setup_enabled:!!env.BOOTSTRAP_SECRET,counts:counts||{},roles:roles.results||[],collections:collections.results||[],schema:schemaProbe||{}});
    }
    // =======================================================================
    // ØªØ±Ø­ÙŠÙ„ 0009 (ÙØªØ­ Ø§Ù„ØªØ³Ø¬ÙŠÙ„ Ù„Ù„Ø¬Ù…ÙŠØ¹ Ø¨Ø¯ÙˆØ± visitor + Ø¬Ø¯ÙˆÙ„ join_requests) ÙŠÙØ·Ø¨ÙŽÙ‘Ù‚
    // Ù‡Ù†Ø§ Ø¨Ø·Ù„Ø¨ ØµØ±ÙŠØ­ Ù…Ù† Ù…Ø¯ÙŠØ± Ù…Ø®ÙˆÙ‘Ù„ Ø¨Ø¯Ù„ Ø±ÙØ¹ SQL ÙŠØ¯ÙˆÙŠÙ‹Ø§ Ø¥Ù„Ù‰ Ø§Ù„Ø¥Ù†ØªØ§Ø¬.
    // - Ù†Ø³Ø®Ø© Ø§Ø­ØªÙŠØ§Ø·ÙŠØ© Ø¯Ø§Ø®Ù„ÙŠØ© Ø£ÙˆÙ„Ù‹Ø§ ÙÙŠ academy_records (collection='migration_backup_0009')
    //   Ø­ØªÙ‰ Ù„Ø§ ØªÙÙÙ‚Ø¯ Ø¨ÙŠØ§Ù†Ø§Øª users/sessions Ø£Ø¨Ø¯Ù‹Ø§ Ù…Ù‡Ù…Ø§ Ø­Ø¯Ø«.
    // - Ø«Ù… Ù†Ø³Ø® Ø§Ø­ØªÙŠØ§Ø·ÙŠØ© _backup_* Ø¯Ø§Ø®Ù„ Ø§Ù„Ù…Ø¹Ø§Ù…Ù„Ø© ØªÙØ³ØªØ¹Ø§Ø¯ Ù…Ù†Ù‡Ø§ Ø±ÙˆØ§Ø¨Ø· students/sessions/
    //   audit_log/google_identities Ù„Ø£Ù† DROP TABLE users ÙŠÙØ·Ù„Ù‚ ON DELETE CASCADE/SET NULL.
    // - env.DB.batch = Ù…Ø¹Ø§Ù…Ù„Ø© ÙˆØ§Ø­Ø¯Ø© Ø°Ø±ÙŠØ©: Ø¥Ù…Ø§ ÙŠÙ†Ø¬Ø­ ÙƒÙ„ Ø´ÙŠØ¡ Ø£Ùˆ Ù„Ø§ ÙŠØªØºÙŠØ± Ø£ÙŠ Ø´ÙŠØ¡.
    // - idempotent: Ø¥Ù† ÙƒØ§Ù† visitor Ù…Ø³Ù…ÙˆØ­Ù‹Ø§ Ùˆjoin_requests Ù…ÙˆØ¬ÙˆØ¯Ù‹Ø§ ÙŠÙØ±Ø¬Ø¹ already_applied.
    // =======================================================================
    if(path==="/api/admin/migrate/0009"&&method==="POST"){
      if(user.role!=="admin")return fail(403,"forbidden");
      const parsed=await parseBody(request,2000);if(parsed.error)return parsed.error;const b=parsed.value;
      if(clean(b.confirm,40)!=="APPLY-0009")return fail(400,"Ø§ÙƒØªØ¨ Ø§Ù„ØªØ£ÙƒÙŠØ¯ APPLY-0009 Ù„ØªØ·Ø¨ÙŠÙ‚ Ø§Ù„ØªØ±Ø­ÙŠÙ„");
      const probe=await env.DB.prepare("SELECT (SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='join_requests') AS join_requests_table,(SELECT sql LIKE '%visitor%' FROM sqlite_master WHERE type='table' AND name='users') AS visitor_allowed").first();
      const joinRequestsExists=Number(probe?.join_requests_table||0)===1;
      const visitorAllowed=Boolean(Number(probe?.visitor_allowed||0)===1);
      const cols=await env.DB.prepare("PRAGMA table_info(users)").all();
      const hasMustChange=(cols.results||[]).some(c=>c.name==="must_change_password");
      if(joinRequestsExists&&visitorAllowed){await log(env,user.id,"migrate_0009_skipped",{reason:"already_applied"});return json({ok:true,applied:false,already_applied:true,message:"Ø§Ù„ØªØ±Ø­ÙŠÙ„ 0009 Ù…ÙØ·Ø¨Ù‘Ù‚ Ø¨Ø§Ù„ÙØ¹Ù„Ø› Ù„Ø§ Ø´ÙŠØ¡ Ù„Ù„ØªØºÙŠÙŠØ±."})}
      const backupTables=["users","sessions","students","groups","quran_schools","google_identities"];
      const backup={format:"pre-0009-snapshot",created_at:nowIso(),trigger:"admin-endpoint",tables:{}};
      try{for(const table of backupTables){const rows=await env.DB.prepare("SELECT * FROM "+table).all();backup.tables[table]=rows.results||[]}}catch(error){console.error("migrate_0009 backup snapshot failed",{message:String(error?.message||error)});return fail(500,"ØªØ¹Ø°Ù‘Ø± Ø¥Ù†Ø´Ø§Ø¡ Ù†Ø³Ø®Ø© Ø§Ø­ØªÙŠØ§Ø·ÙŠØ© Ø¯Ø§Ø®Ù„ÙŠØ©Ø› Ù„Ù… ØªÙØ·Ø¨ÙŽÙ‘Ù‚ Ø£ÙŠ ØªØºÙŠÙŠØ±Ø§Øª Ø¹Ù„Ù‰ Ù‚Ø§Ø¹Ø¯Ø© Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª.")}
      const backupId="pre-0009-"+Date.now();
      try{await env.DB.prepare("INSERT INTO academy_records (collection,id,owner_user_id,payload_json,updated_at) VALUES ('migration_backup_0009',?,?,?,?) ON CONFLICT(collection,id) DO UPDATE SET payload_json=excluded.payload_json,owner_user_id=excluded.owner_user_id,updated_at=excluded.updated_at").bind(backupId,user.id,JSON.stringify(backup),nowIso()).run()}catch(error){console.error("migrate_0009 backup store failed",{message:String(error?.message||error)});return fail(500,"ØªØ¹Ø°Ù‘Ø± Ø­ÙØ¸ Ø§Ù„Ù†Ø³Ø®Ø© Ø§Ù„Ø§Ø­ØªÙŠØ§Ø·ÙŠØ© Ø§Ù„Ø¯Ø§Ø®Ù„ÙŠØ©Ø› Ù„Ù… ØªÙØ·Ø¨ÙŽÙ‘Ù‚ Ø£ÙŠ ØªØºÙŠÙŠØ±Ø§Øª.")}
      const selectList=hasMustChange?"id,display_name,identity_normalized,password_hash,role,active,created_at,must_change_password":"id,display_name,identity_normalized,password_hash,role,active,created_at,0 AS must_change_password";
      const batch=[
        "DROP TABLE IF EXISTS _backup_users_0009",
        "DROP TABLE IF EXISTS _backup_students_0009",
        "DROP TABLE IF EXISTS _backup_sessions_0009",
        "DROP TABLE IF EXISTS _backup_audit_0009",
        "DROP TABLE IF EXISTS _backup_google_identities_0009",
        "CREATE TABLE _backup_users_0009 AS SELECT * FROM users",
        "CREATE TABLE _backup_students_0009 AS SELECT id, user_id FROM students",
        "CREATE TABLE _backup_sessions_0009 AS SELECT * FROM sessions",
        "CREATE TABLE _backup_audit_0009 AS SELECT id, user_id FROM audit_log",
        "CREATE TABLE _backup_google_identities_0009 AS SELECT * FROM google_identities",
        "CREATE TABLE IF NOT EXISTS users__v72 (id TEXT PRIMARY KEY, display_name TEXT NOT NULL, identity_normalized TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK (role IN ('admin','director','teacher','supervisor','student','visitor')), active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)), created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), must_change_password INTEGER NOT NULL DEFAULT 0 CHECK (must_change_password IN (0, 1)))",
        "INSERT INTO users__v72 (id, display_name, identity_normalized, password_hash, role, active, created_at, must_change_password) SELECT "+selectList+" FROM users",
        "DROP TABLE users",
        "ALTER TABLE users__v72 RENAME TO users",
        "CREATE INDEX IF NOT EXISTS idx_users_active_role ON users(active, role)",
        "CREATE INDEX IF NOT EXISTS idx_users_password_change ON users(must_change_password, active)",
        "CREATE TABLE IF NOT EXISTS join_requests (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, kind TEXT NOT NULL CHECK (kind IN ('school_join','teacher_request')), school_id TEXT REFERENCES quran_schools(id) ON DELETE SET NULL, group_id TEXT REFERENCES groups(id) ON DELETE SET NULL, requested_note TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')), decided_by TEXT REFERENCES users(id) ON DELETE SET NULL, decided_at TEXT, decision_note TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')))",
        "CREATE INDEX IF NOT EXISTS idx_join_requests_status ON join_requests(status, created_at)",
        "CREATE INDEX IF NOT EXISTS idx_join_requests_user ON join_requests(user_id, created_at)",
        "CREATE INDEX IF NOT EXISTS idx_join_requests_school ON join_requests(school_id, status)",
        "UPDATE students SET user_id = (SELECT user_id FROM _backup_students_0009 WHERE _backup_students_0009.id = students.id) WHERE EXISTS (SELECT 1 FROM _backup_students_0009 WHERE _backup_students_0009.id = students.id)",
        "INSERT OR IGNORE INTO sessions SELECT * FROM _backup_sessions_0009",
        "UPDATE audit_log SET user_id = (SELECT user_id FROM _backup_audit_0009 WHERE _backup_audit_0009.id = audit_log.id) WHERE EXISTS (SELECT 1 FROM _backup_audit_0009 WHERE _backup_audit_0009.id = audit_log.id)",
        "INSERT OR IGNORE INTO google_identities SELECT * FROM _backup_google_identities_0009",
        "DROP TABLE _backup_users_0009",
        "DROP TABLE _backup_students_0009",
        "DROP TABLE _backup_sessions_0009",
        "DROP TABLE _backup_audit_0009",
        "DROP TABLE _backup_google_identities_0009"
      ];
      try{
        await env.DB.batch(batch.map(sql=>env.DB.prepare(sql)));
      }catch(error){
        console.error("migrate_0009 batch failed",{message:String(error?.message||error),backup:backupId});
        return fail(500,"ØªØ¹Ø°Ù‘Ø± ØªØ·Ø¨ÙŠÙ‚ Ø§Ù„ØªØ±Ø­ÙŠÙ„ 0009Ø› Ù„Ù… ØªÙØºÙŠÙŽÙ‘Ø± Ø¨Ù†ÙŠØ© Ù‚Ø§Ø¹Ø¯Ø© Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª. Ù†Ø³Ø®ØªÙƒ Ø§Ù„Ø§Ø­ØªÙŠØ§Ø·ÙŠØ© Ø§Ù„Ø¯Ø§Ø®Ù„ÙŠØ© Ù…Ø­ÙÙˆØ¸Ø© ("+backupId+").");
      }
      await log(env,user.id,"migrate_0009_applied",{backup:backupId,already:false});
      return json({ok:true,applied:true,backup:backupId,message:"Ø·ÙØ·Ø¨Ù‘Ù‚ Ø§Ù„ØªØ±Ø­ÙŠÙ„ 0009Ø› Ø£ØµØ¨Ø­ Ø¨Ø¥Ù…ÙƒØ§Ù† Ø£ÙŠ Ø´Ø®Øµ Ø¥Ù†Ø´Ø§Ø¡ Ø­Ø³Ø§Ø¨ Ø¹Ù„Ù‰ Ø§Ù„Ø¥Ù†ØªØ§Ø¬ (Ø¯ÙˆØ± visitor + join_requests)."});
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
      const [users,groups,students,recordsResult,schools,audit,googleIdentities]=await Promise.all([
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
      try { await log(env,user.id,"admin_backup_full_export",{format:"ihsan-academy-full-backup-v4"}); }
      catch (auditError) { console.error("Ihsan full-backup audit failed",{message:String(auditError?.message||auditError)}); }
      const payload=await buildFullBackup(env);

      return json(payload,200,{"content-disposition":'attachment; filename="ihsan-academy-full-backup.json"',"cache-control":"no-store"});
    }
    if(path==="/api/admin/backup/restore"&&method==="POST"){
      if(user.role!=="admin")return fail(403,"forbidden");
      const parsed=await parseBody(request,16*1024*1024); if(parsed.error)return parsed.error;
      const b=parsed.value;
      if(b.confirm_restore!=="RESTORE-IHSAN-ACADEMY")return fail(400,"أكد الاستعادة من واجهة الإدارة قبل الإرسال");
      const supportedFormats=["ihsan-academy-full-backup-v2","ihsan-academy-full-backup-v3","ihsan-academy-full-backup-v4"];
      if(!b.data||!supportedFormats.includes(b.format))return fail(400,"صيغة النسخة غير مدعومة؛ يلزم ملف النسخة الكاملة v2 أو v3 أو v4");
      const d=b.data;
      // Older files predate the economy/Quran/competition tables; treat missing lists as empty.
      for(const key of ["google_identities","point_rules","point_events","store_items","store_redemptions","quran_paths","quran_daily","quran_pairs","quran_pair_sessions","quran_stations","quran_makeups","competition_categories","competitions","competition_registrations","competition_judges","competition_scores","competition_results","competition_events","competition_reference_terms"]){
        if(d[key]===undefined||d[key]===null)d[key]=[];
      }
       const limits={users:10000,groups:10000,students:100000,academy_records:100000,quran_schools:1000,audit_log:100000,google_identities:10000,point_rules:1000,point_events:200000,store_items:5000,store_redemptions:100000,quran_paths:100000,quran_daily:500000,quran_pairs:100000,quran_pair_sessions:200000,quran_stations:100000,quran_makeups:100000,competition_categories:1000,competitions:5000,competition_registrations:200000,competition_judges:20000,competition_scores:500000,competition_results:200000,competition_events:50000,competition_reference_terms:5000};
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
      const users=d.users.map(x=>isObj(x)?{id:x.id,display_name:x.display_name,identity_normalized:typeof x.identity_normalized==="string"?x.identity_normalized.toLowerCase():x.identity_normalized,password_hash:x.password_hash,role:x.role,active:x.active,must_change_password:x.must_change_password===undefined?0:x.must_change_password,created_at:x.created_at}:null);
       const googleIdentities=d.google_identities.map(x=>isObj(x)?{google_sub:x.google_sub,user_id:x.user_id,email:x.email,linked_at:x.linked_at}:null);
      const groups=d.groups.map(x=>isObj(x)?{id:x.id,name:x.name,school_id:x.school_id??null,active:x.active,created_at:x.created_at,teacher_id:x.teacher_id??null}:null);
      const students=d.students.map(x=>isObj(x)?{id:x.id,user_id:x.user_id??null,display_name:x.display_name,group_id:x.group_id??null,active:x.active,created_at:x.created_at}:null);
      const schools=d.quran_schools.map(x=>isObj(x)?{id:x.id,name:x.name,description:x.description,active:x.active,sort_order:x.sort_order,created_at:x.created_at}:null);
      const records=d.academy_records.map(x=>isObj(x)?{collection:x.collection,id:x.id,owner_user_id:x.owner_user_id??null,group_id:x.group_id??null,student_id:x.student_id??null,updated_at:x.updated_at,payload:x.payload}:null);
      const audit=d.audit_log.map(x=>isObj(x)?{id:x.id,user_id:x.user_id??null,action:x.action,metadata_json:x.metadata_json,created_at:x.created_at}:null);
      if(users.some(x=>!x||!idOk(x.id)||!txt(x.display_name,120)||!txt(x.identity_normalized,200)||!/^[a-f0-9]{32}$/.test(String(x.password_hash||"").split("$")[2]||"")||!/^pbkdf2-sha256\$50000\$[a-f0-9]{32}\$[a-f0-9]{64}$/.test(String(x.password_hash||""))||!["admin","director","teacher","supervisor","student"].includes(x.role)||!activeOk(x.active)||!(x.must_change_password===0||x.must_change_password===1)||!dateOk(x.created_at)))return fail(400,"تحتوي النسخة على بيانات حساب غير صالحة");
      if(groups.some(x=>!x||!idOk(x.id)||!txt(x.name,160)||!optIdOk(x.school_id)||!optIdOk(x.teacher_id)||!activeOk(x.active)||!dateOk(x.created_at)))return fail(400,"تحتوي النسخة على بيانات فوج غير صالحة");
      if(students.some(x=>!x||!idOk(x.id)||!optIdOk(x.user_id)||!txt(x.display_name,160)||!optIdOk(x.group_id)||!activeOk(x.active)||!dateOk(x.created_at)))return fail(400,"تحتوي النسخة على بيانات طالب غير صالحة");
      if(schools.some(x=>!x||!idOk(x.id)||!txt(x.name,200)||typeof x.description!=="string"||x.description.length>10000||!activeOk(x.active)||!Number.isInteger(x.sort_order)||!dateOk(x.created_at)))return fail(400,"تحتوي النسخة على بيانات مدرسة غير صالحة");
      if(records.some(x=>!x||!txt(x.collection,100)||!idOk(x.id)||!optIdOk(x.owner_user_id)||!optIdOk(x.group_id)||!optIdOk(x.student_id)||!dateOk(x.updated_at)||!("payload" in x)))return fail(400,"تحتوي النسخة على سجل تطبيقي غير صالح");
      if(audit.some(x=>!x||!idOk(x.id)||!optIdOk(x.user_id)||!txt(x.action,120)||typeof x.metadata_json!=="string"||x.metadata_json.length>100000||!dateOk(x.created_at)))return fail(400,"تحتوي النسخة على سجل تدقيق غير صالح");
      if(!unique(googleIdentities.map(x=>x?.google_sub))||!unique(googleIdentities.map(x=>x?.user_id))||googleIdentities.some(x=>!x||!txt(x.google_sub,255)||!idOk(x.user_id)||!txt(x.email,200)||!dateOk(x.linked_at))||!unique(users.map(x=>x.id))||!unique(users.map(x=>x.identity_normalized))||!unique(groups.map(x=>x.id))||!unique(students.map(x=>x.id))||!unique(schools.map(x=>x.id))||!unique(records.map(x=>x.collection+"\u0000"+x.id))||!unique(audit.map(x=>x.id)))return fail(400,"تحتوي النسخة على معرفات مكررة");
      const userIds=new Set(users.map(x=>x.id)), groupIds=new Set(groups.map(x=>x.id));
       if(googleIdentities.some(x=>!userIds.has(x.user_id)))return fail(400,"يوجد ربط Google لحساب غير موجود داخل النسخة");
      const currentAdminBackup=users.find(x=>x.id===user.id); if(!currentAdminBackup||currentAdminBackup.role!=="admin"||currentAdminBackup.active!==1)return fail(400,"يجب أن تتضمن النسخة حساب المدير الحالي نشطًا بصلاحيات المدير");
      if(students.some(x=>(x.user_id&&!userIds.has(x.user_id))||(x.group_id&&!groupIds.has(x.group_id))))return fail(400,"توجد إحالات طالب إلى حساب أو فوج غير موجود داخل النسخة");
      if(audit.some(x=>x.user_id&&!userIds.has(x.user_id)))return fail(400,"توجد إحالات في سجل التدقيق إلى حساب غير موجود داخل النسخة");
      for(const r of records){try{JSON.stringify(r.payload)}catch{return fail(400,"تعذّر قراءة محتوى أحد السجلات")}}
      // ---- Learning economy + Quran path tables (v3). Missing arrays stay empty for v2 files. ----
      const intOk=(x,min,max)=>Number.isInteger(x)&&x>=min&&x<=max;
      const numOk=(x,min,max)=>typeof x==="number"&&Number.isFinite(x)&&x>=min&&x<=max;
      const badRow=label=>fail(400,"تحتوي النسخة على بيانات غير صالحة: "+label);
      const optStr=(x,max)=>x===null||x===undefined||(typeof x==="string"&&x.length<=max);
      const studentIds=new Set(students.map(x=>x.id));
      const pointRules=d.point_rules.map(x=>isObj(x)?{id:x.id,event_type:x.event_type,name:x.name,description:x.description===undefined?"":x.description,achievement_points:x.achievement_points,store_points:x.store_points,max_per_day:x.max_per_day===undefined?null:x.max_per_day,auto_award:x.auto_award,active:x.active,sort_order:x.sort_order,created_by:x.created_by===undefined?null:x.created_by,created_at:x.created_at,updated_at:x.updated_at}:null);
      if(pointRules.some(x=>!x||!idOk(x.id)||!txt(x.event_type,120)||!txt(x.name,160)||typeof x.description!=="string"||x.description.length>2000||!intOk(x.achievement_points,0,100000)||!intOk(x.store_points,0,100000)||!(x.max_per_day===null||intOk(x.max_per_day,1,1000))||!activeOk(x.auto_award)||!activeOk(x.active)||!intOk(x.sort_order,-100000,100000)||!optIdOk(x.created_by)||!dateOk(x.created_at)||!dateOk(x.updated_at)))return badRow("قواعد النقاط");
      if(!unique(pointRules.map(x=>x.id))||!unique(pointRules.map(x=>x.event_type)))return fail(400,"تحتوي النسخة على معرفات مكررة: قواعد النقاط");
      const ruleIds=new Set(pointRules.map(x=>x.id));
      const pointEvents=d.point_events.map(x=>isObj(x)?{id:x.id,student_id:x.student_id,group_id:x.group_id===undefined?null:x.group_id,rule_id:x.rule_id===undefined?null:x.rule_id,event_type:x.event_type,kind:x.kind,points:x.points,reason:x.reason===undefined?"":x.reason,event_key:x.event_key,awarded_date:x.awarded_date,source_collection:x.source_collection===undefined?null:x.source_collection,source_id:x.source_id===undefined?null:x.source_id,awarded_by:x.awarded_by===undefined?null:x.awarded_by,created_at:x.created_at,reversed_at:x.reversed_at===undefined?null:x.reversed_at,reversed_by:x.reversed_by===undefined?null:x.reversed_by,reversal_reason:x.reversal_reason===undefined?null:x.reversal_reason}:null);
      if(pointEvents.some(x=>!x||!idOk(x.id)||!studentIds.has(x.student_id)||(x.group_id!==null&&!groupIds.has(x.group_id))||(x.rule_id!==null&&!ruleIds.has(x.rule_id))||!txt(x.event_type,120)||!["achievement","store"].includes(x.kind)||!intOk(x.points,-100000,100000)||x.points===0||typeof x.reason!=="string"||x.reason.length>500||!txt(x.event_key,200)||!dateOk(x.awarded_date)||!optStr(x.source_collection,100)||!optIdOk(x.source_id)||!optIdOk(x.awarded_by)||!dateOk(x.created_at)||!optStr(x.reversed_at,80)||!optIdOk(x.reversed_by)||!optStr(x.reversal_reason,500)))return badRow("حركات النقاط");
      if(!unique(pointEvents.map(x=>x.id))||!unique(pointEvents.map(x=>x.kind+"\u0000"+x.event_key)))return fail(400,"تحتوي النسخة على معرفات مكررة: حركات النقاط");
      const eventIds=new Set(pointEvents.map(x=>x.id));
      const storeItems=d.store_items.map(x=>isObj(x)?{id:x.id,name:x.name,description:x.description===undefined?"":x.description,icon:x.icon===undefined?"🎁":x.icon,image_url:x.image_url===undefined||x.image_url===null?"":x.image_url,cost:x.cost,stock:x.stock===undefined?null:x.stock,max_per_student:x.max_per_student===undefined?null:x.max_per_student,active:x.active,sort_order:x.sort_order,created_by:x.created_by===undefined?null:x.created_by,created_at:x.created_at,updated_at:x.updated_at}:null);
      if(storeItems.some(x=>!x||!idOk(x.id)||!txt(x.name,160)||typeof x.description!=="string"||x.description.length>2000||!txt(x.icon,16)||typeof x.image_url!=="string"||x.image_url.length>500||!intOk(x.cost,1,100000)||!(x.stock===null||intOk(x.stock,0,1000000))||!(x.max_per_student===null||intOk(x.max_per_student,1,1000000))||!activeOk(x.active)||!intOk(x.sort_order,-100000,100000)||!optIdOk(x.created_by)||!dateOk(x.created_at)||!dateOk(x.updated_at)))return badRow("مواد المتجر");
      if(!unique(storeItems.map(x=>x.id)))return fail(400,"تحتوي النسخة على معرفات مكررة: مواد المتجر");
      const storeItemIds=new Set(storeItems.map(x=>x.id));
      const storeRedemptions=d.store_redemptions.map(x=>isObj(x)?{id:x.id,item_id:x.item_id,item_name:x.item_name,student_id:x.student_id,group_id:x.group_id===undefined?null:x.group_id,cost:x.cost,status:x.status,note:x.note===undefined?"":x.note,requested_at:x.requested_at,decided_by:x.decided_by===undefined?null:x.decided_by,decided_at:x.decided_at===undefined?null:x.decided_at,decision_note:x.decision_note===undefined?"":x.decision_note,debit_event_id:x.debit_event_id===undefined?null:x.debit_event_id}:null);
      if(storeRedemptions.some(x=>!x||!idOk(x.id)||!storeItemIds.has(x.item_id)||!txt(x.item_name,160)||!studentIds.has(x.student_id)||(x.group_id!==null&&!groupIds.has(x.group_id))||!intOk(x.cost,1,100000)||!["pending","approved","rejected","fulfilled","cancelled"].includes(x.status)||typeof x.note!=="string"||x.note.length>2000||!dateOk(x.requested_at)||!optIdOk(x.decided_by)||!optStr(x.decided_at,80)||typeof x.decision_note!=="string"||x.decision_note.length>2000||(x.debit_event_id!==null&&!eventIds.has(x.debit_event_id))))return badRow("طلبات الصرف");
      if(!unique(storeRedemptions.map(x=>x.id)))return fail(400,"تحتوي النسخة على معرفات مكررة: طلبات الصرف");
      const quranPaths=d.quran_paths.map(x=>isObj(x)?{student_id:x.student_id,group_id:x.group_id===undefined?null:x.group_id,hifz_plan:x.hifz_plan,hifz_amount:x.hifz_amount===undefined?"":x.hifz_amount,hifz_unit:x.hifz_unit===undefined?"سطر":x.hifz_unit,hifz_category:x.hifz_category,ward_ahzab:x.ward_ahzab,rest_day:x.rest_day===undefined?null:x.rest_day,start_date:x.start_date,active:x.active===undefined?1:x.active,updated_by:x.updated_by===undefined?null:x.updated_by,created_at:x.created_at,updated_at:x.updated_at}:null);
      if(quranPaths.some(x=>!x||!studentIds.has(x.student_id)||(x.group_id!==null&&!groupIds.has(x.group_id))||!["plan_a","plan_b","plan_c"].includes(x.hifz_plan)||typeof x.hifz_amount!=="string"||x.hifz_amount.length>200||typeof x.hifz_unit!=="string"||x.hifz_unit.length>40||!["15","30","45","60"].includes(x.hifz_category)||![1,2,4].includes(x.ward_ahzab)||!(x.rest_day===null||intOk(x.rest_day,0,6))||!dateOk(x.start_date)||!activeOk(x.active)||!optIdOk(x.updated_by)||!dateOk(x.created_at)||!dateOk(x.updated_at)))return badRow("خطط القرآن");
      if(!unique(quranPaths.map(x=>x.student_id)))return fail(400,"تحتوي النسخة على معرفات مكررة: خطط القرآن");
      const quranDaily=d.quran_daily.map(x=>isObj(x)?{id:x.id,student_id:x.student_id,day:x.day,kind:x.kind,amount:x.amount,unit:x.unit===undefined?"":x.unit,repetitions:x.repetitions===undefined?0:x.repetitions,linked_scope:x.linked_scope===undefined?"":x.linked_scope,notes:x.notes===undefined?"":x.notes,created_by:x.created_by===undefined?null:x.created_by,created_at:x.created_at}:null);
      if(quranDaily.some(x=>!x||!idOk(x.id)||!studentIds.has(x.student_id)||!dateOk(x.day)||!["hifz","thabit","ward"].includes(x.kind)||!numOk(x.amount,0,100000)||typeof x.unit!=="string"||x.unit.length>40||!intOk(x.repetitions,0,100)||typeof x.linked_scope!=="string"||x.linked_scope.length>200||typeof x.notes!=="string"||x.notes.length>2000||!optIdOk(x.created_by)||!dateOk(x.created_at)))return badRow("سجل القرآن اليومي");
      if(!unique(quranDaily.map(x=>x.id))||!unique(quranDaily.map(x=>x.student_id+"\u0000"+x.day+"\u0000"+x.kind)))return fail(400,"تحتوي النسخة على معرفات مكررة: سجل القرآن اليومي");
      const quranPairs=d.quran_pairs.map(x=>isObj(x)?{id:x.id,group_id:x.group_id===undefined?null:x.group_id,student_a:x.student_a,student_b:x.student_b,active:x.active===undefined?1:x.active,created_by:x.created_by===undefined?null:x.created_by,created_at:x.created_at}:null);
      if(quranPairs.some(x=>!x||!idOk(x.id)||(x.group_id!==null&&!groupIds.has(x.group_id))||!studentIds.has(x.student_a)||!studentIds.has(x.student_b)||x.student_a===x.student_b||!activeOk(x.active)||!optIdOk(x.created_by)||!dateOk(x.created_at)))return badRow("أزواج الرفيق");
      if(!unique(quranPairs.map(x=>x.id)))return fail(400,"تحتوي النسخة على معرفات مكررة: أزواج الرفيق");
      const pairIds=new Set(quranPairs.map(x=>x.id));
      const quranPairSessions=d.quran_pair_sessions.map(x=>isObj(x)?{id:x.id,pair_id:x.pair_id,day:x.day,reciter_id:x.reciter_id,listener_id:x.listener_id,amount:x.amount===undefined?"":x.amount,errors:x.errors===undefined?0:x.errors,error_positions:x.error_positions===undefined?"":x.error_positions,hesitations:x.hesitations===undefined?0:x.hesitations,prompts:x.prompts===undefined?0:x.prompts,minutes:x.minutes===undefined?0:x.minutes,expected_minutes:x.expected_minutes===undefined?0:x.expected_minutes,score:x.score,notes:x.notes===undefined?"":x.notes,signed_reciter:x.signed_reciter===undefined?0:x.signed_reciter,signed_listener:x.signed_listener===undefined?0:x.signed_listener,override_reason:x.override_reason===undefined?"":x.override_reason,created_by:x.created_by===undefined?null:x.created_by,created_at:x.created_at}:null);
      if(quranPairSessions.some(x=>!x||!idOk(x.id)||!pairIds.has(x.pair_id)||!dateOk(x.day)||!studentIds.has(x.reciter_id)||!studentIds.has(x.listener_id)||x.reciter_id===x.listener_id||typeof x.amount!=="string"||x.amount.length>200||!intOk(x.errors,0,10000)||typeof x.error_positions!=="string"||x.error_positions.length>500||!intOk(x.hesitations,0,10000)||!intOk(x.prompts,0,10000)||!numOk(x.minutes,0,1000)||!numOk(x.expected_minutes,0,1000)||!intOk(x.score,0,100)||typeof x.notes!=="string"||x.notes.length>2000||!activeOk(x.signed_reciter)||!activeOk(x.signed_listener)||typeof x.override_reason!=="string"||x.override_reason.length>500||!optIdOk(x.created_by)||!dateOk(x.created_at)))return badRow("جلسات الرفيق");
      if(!unique(quranPairSessions.map(x=>x.id)))return fail(400,"تحتوي النسخة على معرفات مكررة: جلسات الرفيق");
      const quranStations=d.quran_stations.map(x=>isObj(x)?{id:x.id,student_id:x.student_id,stage:x.stage,scheduled_for:x.scheduled_for,memorized_amount:x.memorized_amount===undefined?"":x.memorized_amount,score:x.score===undefined?null:x.score,errors:x.errors===undefined?0:x.errors,notes:x.notes===undefined?"":x.notes,status:x.status,approved_by:x.approved_by===undefined?null:x.approved_by,approved_at:x.approved_at===undefined?null:x.approved_at,created_by:x.created_by===undefined?null:x.created_by,created_at:x.created_at}:null);
      if(quranStations.some(x=>!x||!idOk(x.id)||!studentIds.has(x.student_id)||!["15","30","45","60"].includes(x.stage)||!dateOk(x.scheduled_for)||typeof x.memorized_amount!=="string"||x.memorized_amount.length>200||!(x.score===null||intOk(x.score,0,100))||!intOk(x.errors,0,10000)||typeof x.notes!=="string"||x.notes.length>2000||!["scheduled","approved","rejected","cancelled"].includes(x.status)||!optIdOk(x.approved_by)||!optStr(x.approved_at,80)||!optIdOk(x.created_by)||!dateOk(x.created_at)))return badRow("محطات الشيخ");
      if(!unique(quranStations.map(x=>x.id)))return fail(400,"تحتوي النسخة على معرفات مكررة: محطات الشيخ");
      const quranMakeups=d.quran_makeups.map(x=>isObj(x)?{id:x.id,student_id:x.student_id,kind:x.kind,due_date:x.due_date,amount:x.amount===undefined?"":x.amount,reason:x.reason,reason_note:x.reason_note===undefined?"":x.reason_note,status:x.status,proposed_date:x.proposed_date===undefined?null:x.proposed_date,blocks_new:x.blocks_new===undefined?0:x.blocks_new,completed_at:x.completed_at===undefined?null:x.completed_at,created_by:x.created_by===undefined?null:x.created_by,created_at:x.created_at,updated_at:x.updated_at}:null);
      if(quranMakeups.some(x=>!x||!idOk(x.id)||!studentIds.has(x.student_id)||!["hifz","thabit","ward"].includes(x.kind)||!dateOk(x.due_date)||typeof x.amount!=="string"||x.amount.length>200||!["shortcoming","interruption","incapacity","circumstance"].includes(x.reason)||typeof x.reason_note!=="string"||x.reason_note.length>1000||!["open","planned","done","cancelled"].includes(x.status)||!optStr(x.proposed_date,80)||!activeOk(x.blocks_new)||!optStr(x.completed_at,80)||!optIdOk(x.created_by)||!dateOk(x.created_at)||!dateOk(x.updated_at)))return badRow("الاستدراكات");
      if(!unique(quranMakeups.map(x=>x.id)))return fail(400,"تحتوي النسخة على معرفات مكررة: الاستدراكات");
      // ---- Competitions (v4). Older files stay empty. ----
      const jsonArrOk=(x,max)=>{if(typeof x!=="string"||x.length>max)return false;try{return Array.isArray(JSON.parse(x))}catch{return false}};
      const competitionKinds=["quran_hifz","quran_tilawa","quran_tajweed","hadith","mutoon","seerah","islamic_culture","other"];
      const competitionStatuses=["draft","announced","registration","judging","results","honored","archived"];
      const registrationStatuses=["pending","approved","rejected","withdrawn","disqualified"];
      const competitionCategories=d.competition_categories.map(x=>isObj(x)?{id:x.id,name:x.name,code:x.code,kind:x.kind,min_hizb:x.min_hizb===undefined?null:x.min_hizb,max_hizb:x.max_hizb===undefined?null:x.max_hizb,min_age:x.min_age===undefined?null:x.min_age,max_age:x.max_age===undefined?null:x.max_age,active:x.active,sort_order:x.sort_order,created_at:x.created_at}:null);
      if(competitionCategories.some(x=>!x||!idOk(x.id)||!txt(x.name,200)||!txt(x.code,80)||!competitionKinds.includes(x.kind)||!(x.min_hizb===null||intOk(x.min_hizb,0,60))||!(x.max_hizb===null||intOk(x.max_hizb,1,60))||!(x.min_age===null||intOk(x.min_age,3,100))||!(x.max_age===null||intOk(x.max_age,3,100))||!activeOk(x.active)||!intOk(x.sort_order,-100000,100000)||!dateOk(x.created_at)))return badRow("فئات المسابقات");
      if(!unique(competitionCategories.map(x=>x.id))||!unique(competitionCategories.map(x=>x.code)))return fail(400,"تحتوي النسخة على معرفات مكررة: فئات المسابقات");
      const categoryIds=new Set(competitionCategories.map(x=>x.id));
      const competitions=d.competitions.map(x=>isObj(x)?{id:x.id,school_id:x.school_id===undefined?null:x.school_id,title:x.title,description:x.description===undefined?"":x.description,kind:x.kind,season:x.season===undefined?"general":x.season,category_id:x.category_id===undefined?null:x.category_id,status:x.status,registration_starts_at:x.registration_starts_at===undefined?null:x.registration_starts_at,registration_ends_at:x.registration_ends_at===undefined?null:x.registration_ends_at,starts_at:x.starts_at===undefined?null:x.starts_at,ends_at:x.ends_at===undefined?null:x.ends_at,min_age:x.min_age===undefined?null:x.min_age,max_age:x.max_age===undefined?null:x.max_age,riwayat_json:x.riwayat_json===undefined?"[]":x.riwayat_json,min_hizb:x.min_hizb===undefined?null:x.min_hizb,max_hizb:x.max_hizb===undefined?null:x.max_hizb,requires_approval:x.requires_approval===undefined?0:x.requires_approval,max_participants:x.max_participants===undefined?null:x.max_participants,rules:x.rules===undefined?"":x.rules,judging_criteria_json:x.judging_criteria_json===undefined?"[]":x.judging_criteria_json,awards_json:x.awards_json===undefined?"[]":x.awards_json,participation_achievement:x.participation_achievement===undefined?0:x.participation_achievement,participation_store:x.participation_store===undefined?0:x.participation_store,created_by:x.created_by===undefined?null:x.created_by,created_at:x.created_at,updated_at:x.updated_at}:null);
      if(competitions.some(x=>!x||!idOk(x.id)||!optIdOk(x.school_id)||!txt(x.title,180)||typeof x.description!=="string"||x.description.length>10000||!competitionKinds.includes(x.kind)||typeof x.season!=="string"||x.season.length>80||!(x.category_id===null||categoryIds.has(x.category_id))||!competitionStatuses.includes(x.status)||!optStr(x.registration_starts_at,80)||!optStr(x.registration_ends_at,80)||!optStr(x.starts_at,80)||!optStr(x.ends_at,80)||!(x.min_age===null||intOk(x.min_age,3,100))||!(x.max_age===null||intOk(x.max_age,3,100))||!jsonArrOk(x.riwayat_json,4000)||!(x.min_hizb===null||intOk(x.min_hizb,0,60))||!(x.max_hizb===null||intOk(x.max_hizb,1,60))||!activeOk(x.requires_approval)||!(x.max_participants===null||intOk(x.max_participants,1,100000))||typeof x.rules!=="string"||x.rules.length>20000||!jsonArrOk(x.judging_criteria_json,20000)||!jsonArrOk(x.awards_json,20000)||!intOk(x.participation_achievement,0,100000)||!intOk(x.participation_store,0,100000)||!optIdOk(x.created_by)||!dateOk(x.created_at)||!dateOk(x.updated_at)))return badRow("المسابقات");
      if(!unique(competitions.map(x=>x.id)))return fail(400,"تحتوي النسخة على معرفات مكررة: المسابقات");
      const competitionIds=new Set(competitions.map(x=>x.id));
      const competitionRegistrations=d.competition_registrations.map(x=>isObj(x)?{id:x.id,competition_id:x.competition_id,student_id:x.student_id,group_id:x.group_id===undefined?null:x.group_id,status:x.status,age_at_registration:x.age_at_registration===undefined?null:x.age_at_registration,hizb_at_registration:x.hizb_at_registration===undefined?"":x.hizb_at_registration,riwaya:x.riwaya===undefined?"":x.riwaya,note:x.note===undefined?"":x.note,registered_at:x.registered_at,decided_by:x.decided_by===undefined?null:x.decided_by,decided_at:x.decided_at===undefined?null:x.decided_at,decision_note:x.decision_note===undefined?"":x.decision_note}:null);
      if(competitionRegistrations.some(x=>!x||!idOk(x.id)||!competitionIds.has(x.competition_id)||!studentIds.has(x.student_id)||(x.group_id!==null&&!groupIds.has(x.group_id))||!registrationStatuses.includes(x.status)||!(x.age_at_registration===null||intOk(x.age_at_registration,3,100))||typeof x.hizb_at_registration!=="string"||x.hizb_at_registration.length>40||typeof x.riwaya!=="string"||x.riwaya.length>60||typeof x.note!=="string"||x.note.length>2000||!dateOk(x.registered_at)||!optIdOk(x.decided_by)||!optStr(x.decided_at,80)||typeof x.decision_note!=="string"||x.decision_note.length>600))return badRow("تسجيلات المسابقات");
      if(!unique(competitionRegistrations.map(x=>x.id))||!unique(competitionRegistrations.map(x=>x.competition_id+"\u0000"+x.student_id)))return fail(400,"تحتوي النسخة على معرفات مكررة: تسجيلات المسابقات");
      const competitionRegistrationIds=new Set(competitionRegistrations.map(x=>x.id));
      const competitionJudges=d.competition_judges.map(x=>isObj(x)?{competition_id:x.competition_id,user_id:x.user_id,created_by:x.created_by===undefined?null:x.created_by,created_at:x.created_at}:null);
      if(competitionJudges.some(x=>!x||!competitionIds.has(x.competition_id)||!userIds.has(x.user_id)||!optIdOk(x.created_by)||!dateOk(x.created_at)))return badRow("محكمو المسابقات");
      if(!unique(competitionJudges.map(x=>x.competition_id+"\u0000"+x.user_id)))return fail(400,"تحتوي النسخة على معرفات مكررة: محكمو المسابقات");
      const competitionScores=d.competition_scores.map(x=>isObj(x)?{id:x.id,competition_id:x.competition_id,registration_id:x.registration_id,judge_user_id:x.judge_user_id,criteria_json:x.criteria_json===undefined?"[]":x.criteria_json,total:x.total,note:x.note===undefined?"":x.note,scored_at:x.scored_at}:null);
      if(competitionScores.some(x=>!x||!idOk(x.id)||!competitionIds.has(x.competition_id)||!competitionRegistrationIds.has(x.registration_id)||!userIds.has(x.judge_user_id)||!jsonArrOk(x.criteria_json,20000)||!numOk(x.total,0,100)||typeof x.note!=="string"||x.note.length>2000||!dateOk(x.scored_at)))return badRow("درجات التحكيم");
      if(!unique(competitionScores.map(x=>x.id))||!unique(competitionScores.map(x=>x.competition_id+"\u0000"+x.registration_id+"\u0000"+x.judge_user_id)))return fail(400,"تحتوي النسخة على معرفات مكررة: درجات التحكيم");
      const competitionResults=d.competition_results.map(x=>isObj(x)?{id:x.id,competition_id:x.competition_id,registration_id:x.registration_id,student_id:x.student_id,group_id:x.group_id===undefined?null:x.group_id,final_score:x.final_score===undefined?null:x.final_score,rank:x.rank===undefined?null:x.rank,status:x.status,award_achievement:x.award_achievement===undefined?0:x.award_achievement,award_store:x.award_store===undefined?0:x.award_store,award_event_achievement_id:x.award_event_achievement_id===undefined?null:x.award_event_achievement_id,award_event_store_id:x.award_event_store_id===undefined?null:x.award_event_store_id,note:x.note===undefined?"":x.note,approved_by:x.approved_by===undefined?null:x.approved_by,approved_at:x.approved_at===undefined?null:x.approved_at,created_at:x.created_at}:null);
      if(competitionResults.some(x=>!x||!idOk(x.id)||!competitionIds.has(x.competition_id)||!competitionRegistrationIds.has(x.registration_id)||!studentIds.has(x.student_id)||(x.group_id!==null&&!groupIds.has(x.group_id))||!(x.final_score===null||numOk(x.final_score,0,100))||!(x.rank===null||intOk(x.rank,1,100000))||!["draft","approved","published"].includes(x.status)||!intOk(x.award_achievement,0,100000)||!intOk(x.award_store,0,100000)||!optIdOk(x.award_event_achievement_id)||!optIdOk(x.award_event_store_id)||typeof x.note!=="string"||x.note.length>2000||!optIdOk(x.approved_by)||!optStr(x.approved_at,80)||!dateOk(x.created_at)))return badRow("نتائج المسابقات");
      if(!unique(competitionResults.map(x=>x.id))||!unique(competitionResults.map(x=>x.competition_id+"\u0000"+x.registration_id)))return fail(400,"تحتوي النسخة على معرفات مكررة: نتائج المسابقات");
      const competitionEvents=d.competition_events.map(x=>isObj(x)?{id:x.id,competition_id:x.competition_id===undefined?null:x.competition_id,title:x.title,description:x.description===undefined?"":x.description,event_date:x.event_date,kind:x.kind,active:x.active===undefined?1:x.active,created_by:x.created_by===undefined?null:x.created_by,created_at:x.created_at}:null);
      if(competitionEvents.some(x=>!x||!idOk(x.id)||(x.competition_id!==null&&!competitionIds.has(x.competition_id))||!txt(x.title,180)||typeof x.description!=="string"||x.description.length>5000||!dateOk(x.event_date)||!["announcement","registration","judging","result","honoring","other"].includes(x.kind)||!activeOk(x.active)||!optIdOk(x.created_by)||!dateOk(x.created_at)))return badRow("رزنامة المسابقات");
      if(!unique(competitionEvents.map(x=>x.id)))return fail(400,"تحتوي النسخة على معرفات مكررة: رزنامة المسابقات");
      const competitionTerms=d.competition_reference_terms.map(x=>isObj(x)?{id:x.id,kind:x.kind,title:x.title,body:x.body===undefined?"":x.body,source:x.source===undefined?"":x.source,active:x.active===undefined?1:x.active,sort_order:x.sort_order===undefined?0:x.sort_order,created_by:x.created_by===undefined?null:x.created_by,created_at:x.created_at,updated_at:x.updated_at}:null);
      if(competitionTerms.some(x=>!x||!idOk(x.id)||!competitionKinds.includes(x.kind)||!txt(x.title,180)||typeof x.body!=="string"||x.body.length>20000||typeof x.source!=="string"||x.source.length>300||!activeOk(x.active)||!intOk(x.sort_order,-100000,100000)||!optIdOk(x.created_by)||!dateOk(x.created_at)||!dateOk(x.updated_at)))return badRow("الشروط المرجعية للمسابقات");
      if(!unique(competitionTerms.map(x=>x.id)))return fail(400,"تحتوي النسخة على معرفات مكررة: الشروط المرجعية");
      if(competitionCategories.length||competitionRegistrations.length||competitionScores.length||competitionResults.length){
        const [existingCategories,existingRegistrations,existingScores,existingResults]=await Promise.all([
          competitionCategories.length?env.DB.prepare("SELECT id,code FROM competition_categories").all():{results:[]},
          competitionRegistrations.length?env.DB.prepare("SELECT id,competition_id,student_id FROM competition_registrations").all():{results:[]},
          competitionScores.length?env.DB.prepare("SELECT id,competition_id,registration_id,judge_user_id FROM competition_scores").all():{results:[]},
          competitionResults.length?env.DB.prepare("SELECT id,competition_id,registration_id FROM competition_results").all():{results:[]}
        ]);
        const currentCategoryCode=new Map((existingCategories.results||[]).map(x=>[x.code,x.id]));
        if(competitionCategories.some(x=>currentCategoryCode.has(x.code)&&currentCategoryCode.get(x.code)!==x.id))return fail(409,"توجد فئة مسابقة حالية بالرمز نفسه ومعرّف مختلف؛ لم تبدأ الاستعادة");
        const currentRegistrationKey=new Map((existingRegistrations.results||[]).map(x=>[x.competition_id+"\u0000"+x.student_id,x.id]));
        if(competitionRegistrations.some(x=>currentRegistrationKey.has(x.competition_id+"\u0000"+x.student_id)&&currentRegistrationKey.get(x.competition_id+"\u0000"+x.student_id)!==x.id))return fail(409,"يوجد تسجيل مسابقة حالي بالطالب والمسابقة نفسيهما ومعرّف مختلف؛ لم تبدأ الاستعادة");
        const currentScoreKey=new Map((existingScores.results||[]).map(x=>[x.competition_id+"\u0000"+x.registration_id+"\u0000"+x.judge_user_id,x.id]));
        if(competitionScores.some(x=>currentScoreKey.has(x.competition_id+"\u0000"+x.registration_id+"\u0000"+x.judge_user_id)&&currentScoreKey.get(x.competition_id+"\u0000"+x.registration_id+"\u0000"+x.judge_user_id)!==x.id))return fail(409,"توجد درجة تحكيم حالية بالمحكم والتسجيل نفسيهما ومعرّف مختلف؛ لم تبدأ الاستعادة");
        const currentResultKey=new Map((existingResults.results||[]).map(x=>[x.competition_id+"\u0000"+x.registration_id,x.id]));
        if(competitionResults.some(x=>currentResultKey.has(x.competition_id+"\u0000"+x.registration_id)&&currentResultKey.get(x.competition_id+"\u0000"+x.registration_id)!==x.id))return fail(409,"توجد نتيجة مسابقة حالية بالتسجيل نفسه ومعرّف مختلف؛ لم تبدأ الاستعادة");
      }
      if(pointRules.length||pointEvents.length||quranDaily.length){
        const [existingRules,existingEvents,existingDaily]=await Promise.all([
          pointRules.length?env.DB.prepare("SELECT id,event_type FROM point_rules").all():{results:[]},
          pointEvents.length?env.DB.prepare("SELECT id,kind,event_key FROM point_events").all():{results:[]},
          quranDaily.length?env.DB.prepare("SELECT id,student_id,day,kind FROM quran_daily").all():{results:[]}
        ]);
        const currentRuleByType=new Map((existingRules.results||[]).map(x=>[x.event_type,x.id]));
        if(pointRules.some(x=>currentRuleByType.has(x.event_type)&&currentRuleByType.get(x.event_type)!==x.id))return fail(409,"يوجد نوع قاعدة نقاط حالي بمعرّف مختلف؛ لم تبدأ الاستعادة");
        const currentEventKey=new Map((existingEvents.results||[]).map(x=>[x.kind+"\u0000"+x.event_key,x.id]));
        if(pointEvents.some(x=>currentEventKey.has(x.kind+"\u0000"+x.event_key)&&currentEventKey.get(x.kind+"\u0000"+x.event_key)!==x.id))return fail(409,"توجد حركة نقاط حالية بالمفتاح نفسه ومعرّف مختلف؛ لم تبدأ الاستعادة");
        const currentDailyKey=new Map((existingDaily.results||[]).map(x=>[x.student_id+"\u0000"+x.day+"\u0000"+x.kind,x.id]));
        if(quranDaily.some(x=>currentDailyKey.has(x.student_id+"\u0000"+x.day+"\u0000"+x.kind)&&currentDailyKey.get(x.student_id+"\u0000"+x.day+"\u0000"+x.kind)!==x.id))return fail(409,"يوجد سجل قرآن يومي حالي باليوم نفسه ومعرّف مختلف؛ لم تبدأ الاستعادة");
      }
      const [existingUsers,existingStudents,existingGoogle]=await Promise.all([
        env.DB.prepare("SELECT id,identity_normalized FROM users").all(),
        env.DB.prepare("SELECT id,user_id FROM students WHERE user_id IS NOT NULL").all(),
        env.DB.prepare("SELECT google_sub,user_id FROM google_identities").all()
      ]);
      const currentIdentity=new Map((existingUsers.results||[]).map(x=>[x.identity_normalized,x.id]));
      if(users.some(x=>currentIdentity.has(x.identity_normalized)&&currentIdentity.get(x.identity_normalized)!==x.id))return fail(409,"يوجد حساب حالي بالبريد/اسم الدخول نفسه ومعرّف مختلف؛ لم تبدأ الاستعادة");
      const currentStudentUsers=new Map((existingStudents.results||[]).filter(x=>x.user_id).map(x=>[x.user_id,x.id]));
      const currentGoogleBySub=new Map((existingGoogle.results||[]).map(x=>[x.google_sub,x.user_id]));
      const currentGoogleByUser=new Map((existingGoogle.results||[]).map(x=>[x.user_id,x.google_sub]));
      if(googleIdentities.some(x=>(currentGoogleBySub.has(x.google_sub)&&currentGoogleBySub.get(x.google_sub)!==x.user_id)||(currentGoogleByUser.has(x.user_id)&&currentGoogleByUser.get(x.user_id)!==x.google_sub)))return fail(409,"يوجد تعارض مع ربط Google محفوظ حاليًا؛ لم تبدأ الاستعادة.");
      if(students.some(x=>x.user_id&&currentStudentUsers.has(x.user_id)&&currentStudentUsers.get(x.user_id)!==x.id))return fail(409,"يوجد حساب طالب مرتبط بسجل طالب مختلف؛ لم تبدأ الاستعادة");
      const statements=[];
      for(const x of users)statements.push(env.DB.prepare("INSERT INTO users (id,display_name,identity_normalized,password_hash,role,active,must_change_password,created_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET display_name=excluded.display_name,identity_normalized=excluded.identity_normalized,password_hash=excluded.password_hash,role=excluded.role,active=excluded.active,must_change_password=excluded.must_change_password,created_at=excluded.created_at").bind(x.id,x.display_name,x.identity_normalized,x.password_hash,x.role,x.active,x.must_change_password,x.created_at));
      for(const x of googleIdentities)statements.push(env.DB.prepare("INSERT INTO google_identities (google_sub,user_id,email,linked_at) VALUES (?,?,?,?) ON CONFLICT(google_sub) DO UPDATE SET user_id=excluded.user_id,email=excluded.email,linked_at=excluded.linked_at").bind(x.google_sub,x.user_id,x.email,x.linked_at));
      for(const x of schools)statements.push(env.DB.prepare("INSERT INTO quran_schools (id,name,description,active,sort_order,created_at) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,description=excluded.description,active=excluded.active,sort_order=excluded.sort_order,created_at=excluded.created_at").bind(x.id,x.name,x.description,x.active,x.sort_order,x.created_at));
      for(const x of groups)statements.push(env.DB.prepare("INSERT INTO groups (id,name,school_id,active,created_at,teacher_id) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,school_id=excluded.school_id,active=excluded.active,created_at=excluded.created_at,teacher_id=excluded.teacher_id").bind(x.id,x.name,x.school_id,x.active,x.created_at,x.teacher_id));
      for(const x of students)statements.push(env.DB.prepare("INSERT INTO students (id,user_id,display_name,group_id,active,created_at) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET user_id=excluded.user_id,display_name=excluded.display_name,group_id=excluded.group_id,active=excluded.active,created_at=excluded.created_at").bind(x.id,x.user_id,x.display_name,x.group_id,x.active,x.created_at));
      for(const x of records)statements.push(env.DB.prepare("INSERT INTO academy_records (collection,id,owner_user_id,group_id,student_id,payload_json,updated_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(collection,id) DO UPDATE SET owner_user_id=excluded.owner_user_id,group_id=excluded.group_id,student_id=excluded.student_id,payload_json=excluded.payload_json,updated_at=excluded.updated_at").bind(x.collection,x.id,x.owner_user_id,x.group_id,x.student_id,JSON.stringify(x.payload),x.updated_at));
      for(const x of audit)statements.push(env.DB.prepare("INSERT INTO audit_log (id,user_id,action,metadata_json,created_at) VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET user_id=excluded.user_id,action=excluded.action,metadata_json=excluded.metadata_json,created_at=excluded.created_at").bind(x.id,x.user_id,x.action,x.metadata_json,x.created_at));
      for(const x of pointRules)statements.push(env.DB.prepare("INSERT INTO point_rules (id,event_type,name,description,achievement_points,store_points,max_per_day,auto_award,active,sort_order,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET event_type=excluded.event_type,name=excluded.name,description=excluded.description,achievement_points=excluded.achievement_points,store_points=excluded.store_points,max_per_day=excluded.max_per_day,auto_award=excluded.auto_award,active=excluded.active,sort_order=excluded.sort_order,created_by=excluded.created_by,created_at=excluded.created_at,updated_at=excluded.updated_at").bind(x.id,x.event_type,x.name,x.description,x.achievement_points,x.store_points,x.max_per_day,x.auto_award,x.active,x.sort_order,x.created_by,x.created_at,x.updated_at));
      for(const x of pointEvents)statements.push(env.DB.prepare("INSERT INTO point_events (id,student_id,group_id,rule_id,event_type,kind,points,reason,event_key,awarded_date,source_collection,source_id,awarded_by,created_at,reversed_at,reversed_by,reversal_reason) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET student_id=excluded.student_id,group_id=excluded.group_id,rule_id=excluded.rule_id,event_type=excluded.event_type,kind=excluded.kind,points=excluded.points,reason=excluded.reason,event_key=excluded.event_key,awarded_date=excluded.awarded_date,source_collection=excluded.source_collection,source_id=excluded.source_id,awarded_by=excluded.awarded_by,created_at=excluded.created_at,reversed_at=excluded.reversed_at,reversed_by=excluded.reversed_by,reversal_reason=excluded.reversal_reason").bind(x.id,x.student_id,x.group_id,x.rule_id,x.event_type,x.kind,x.points,x.reason,x.event_key,x.awarded_date,x.source_collection,x.source_id,x.awarded_by,x.created_at,x.reversed_at,x.reversed_by,x.reversal_reason));
      for(const x of storeItems)statements.push(env.DB.prepare("INSERT INTO store_items (id,name,description,icon,image_url,cost,stock,max_per_student,active,sort_order,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,description=excluded.description,icon=excluded.icon,image_url=excluded.image_url,cost=excluded.cost,stock=excluded.stock,max_per_student=excluded.max_per_student,active=excluded.active,sort_order=excluded.sort_order,created_by=excluded.created_by,created_at=excluded.created_at,updated_at=excluded.updated_at").bind(x.id,x.name,x.description,x.icon,x.image_url,x.cost,x.stock,x.max_per_student,x.active,x.sort_order,x.created_by,x.created_at,x.updated_at));
      for(const x of storeRedemptions)statements.push(env.DB.prepare("INSERT INTO store_redemptions (id,item_id,item_name,student_id,group_id,cost,status,note,requested_at,decided_by,decided_at,decision_note,debit_event_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET item_id=excluded.item_id,item_name=excluded.item_name,student_id=excluded.student_id,group_id=excluded.group_id,cost=excluded.cost,status=excluded.status,note=excluded.note,requested_at=excluded.requested_at,decided_by=excluded.decided_by,decided_at=excluded.decided_at,decision_note=excluded.decision_note,debit_event_id=excluded.debit_event_id").bind(x.id,x.item_id,x.item_name,x.student_id,x.group_id,x.cost,x.status,x.note,x.requested_at,x.decided_by,x.decided_at,x.decision_note,x.debit_event_id));
      for(const x of quranPaths)statements.push(env.DB.prepare("INSERT INTO quran_paths (student_id,group_id,hifz_plan,hifz_amount,hifz_unit,hifz_category,ward_ahzab,rest_day,start_date,active,updated_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(student_id) DO UPDATE SET group_id=excluded.group_id,hifz_plan=excluded.hifz_plan,hifz_amount=excluded.hifz_amount,hifz_unit=excluded.hifz_unit,hifz_category=excluded.hifz_category,ward_ahzab=excluded.ward_ahzab,rest_day=excluded.rest_day,start_date=excluded.start_date,active=excluded.active,updated_by=excluded.updated_by,created_at=excluded.created_at,updated_at=excluded.updated_at").bind(x.student_id,x.group_id,x.hifz_plan,x.hifz_amount,x.hifz_unit,x.hifz_category,x.ward_ahzab,x.rest_day,x.start_date,x.active,x.updated_by,x.created_at,x.updated_at));
      for(const x of quranDaily)statements.push(env.DB.prepare("INSERT INTO quran_daily (id,student_id,day,kind,amount,unit,repetitions,linked_scope,notes,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET student_id=excluded.student_id,day=excluded.day,kind=excluded.kind,amount=excluded.amount,unit=excluded.unit,repetitions=excluded.repetitions,linked_scope=excluded.linked_scope,notes=excluded.notes,created_by=excluded.created_by,created_at=excluded.created_at").bind(x.id,x.student_id,x.day,x.kind,x.amount,x.unit,x.repetitions,x.linked_scope,x.notes,x.created_by,x.created_at));
      for(const x of quranPairs)statements.push(env.DB.prepare("INSERT INTO quran_pairs (id,group_id,student_a,student_b,active,created_by,created_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET group_id=excluded.group_id,student_a=excluded.student_a,student_b=excluded.student_b,active=excluded.active,created_by=excluded.created_by,created_at=excluded.created_at").bind(x.id,x.group_id,x.student_a,x.student_b,x.active,x.created_by,x.created_at));
      for(const x of quranPairSessions)statements.push(env.DB.prepare("INSERT INTO quran_pair_sessions (id,pair_id,day,reciter_id,listener_id,amount,errors,error_positions,hesitations,prompts,minutes,expected_minutes,score,notes,signed_reciter,signed_listener,override_reason,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET pair_id=excluded.pair_id,day=excluded.day,reciter_id=excluded.reciter_id,listener_id=excluded.listener_id,amount=excluded.amount,errors=excluded.errors,error_positions=excluded.error_positions,hesitations=excluded.hesitations,prompts=excluded.prompts,minutes=excluded.minutes,expected_minutes=excluded.expected_minutes,score=excluded.score,notes=excluded.notes,signed_reciter=excluded.signed_reciter,signed_listener=excluded.signed_listener,override_reason=excluded.override_reason,created_by=excluded.created_by,created_at=excluded.created_at").bind(x.id,x.pair_id,x.day,x.reciter_id,x.listener_id,x.amount,x.errors,x.error_positions,x.hesitations,x.prompts,x.minutes,x.expected_minutes,x.score,x.notes,x.signed_reciter,x.signed_listener,x.override_reason,x.created_by,x.created_at));
      for(const x of quranStations)statements.push(env.DB.prepare("INSERT INTO quran_stations (id,student_id,stage,scheduled_for,memorized_amount,score,errors,notes,status,approved_by,approved_at,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET student_id=excluded.student_id,stage=excluded.stage,scheduled_for=excluded.scheduled_for,memorized_amount=excluded.memorized_amount,score=excluded.score,errors=excluded.errors,notes=excluded.notes,status=excluded.status,approved_by=excluded.approved_by,approved_at=excluded.approved_at,created_by=excluded.created_by,created_at=excluded.created_at").bind(x.id,x.student_id,x.stage,x.scheduled_for,x.memorized_amount,x.score,x.errors,x.notes,x.status,x.approved_by,x.approved_at,x.created_by,x.created_at));
      for(const x of quranMakeups)statements.push(env.DB.prepare("INSERT INTO quran_makeups (id,student_id,kind,due_date,amount,reason,reason_note,status,proposed_date,blocks_new,completed_at,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET student_id=excluded.student_id,kind=excluded.kind,due_date=excluded.due_date,amount=excluded.amount,reason=excluded.reason,reason_note=excluded.reason_note,status=excluded.status,proposed_date=excluded.proposed_date,blocks_new=excluded.blocks_new,completed_at=excluded.completed_at,created_by=excluded.created_by,created_at=excluded.created_at,updated_at=excluded.updated_at").bind(x.id,x.student_id,x.kind,x.due_date,x.amount,x.reason,x.reason_note,x.status,x.proposed_date,x.blocks_new,x.completed_at,x.created_by,x.created_at,x.updated_at));
      for(const x of competitionCategories)statements.push(env.DB.prepare("INSERT INTO competition_categories (id,name,code,kind,min_hizb,max_hizb,min_age,max_age,active,sort_order,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,code=excluded.code,kind=excluded.kind,min_hizb=excluded.min_hizb,max_hizb=excluded.max_hizb,min_age=excluded.min_age,max_age=excluded.max_age,active=excluded.active,sort_order=excluded.sort_order,created_at=excluded.created_at").bind(x.id,x.name,x.code,x.kind,x.min_hizb,x.max_hizb,x.min_age,x.max_age,x.active,x.sort_order,x.created_at));
      for(const x of competitions)statements.push(env.DB.prepare("INSERT INTO competitions (id,school_id,title,description,kind,season,category_id,status,registration_starts_at,registration_ends_at,starts_at,ends_at,min_age,max_age,riwayat_json,min_hizb,max_hizb,requires_approval,max_participants,rules,judging_criteria_json,awards_json,participation_achievement,participation_store,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET school_id=excluded.school_id,title=excluded.title,description=excluded.description,kind=excluded.kind,season=excluded.season,category_id=excluded.category_id,status=excluded.status,registration_starts_at=excluded.registration_starts_at,registration_ends_at=excluded.registration_ends_at,starts_at=excluded.starts_at,ends_at=excluded.ends_at,min_age=excluded.min_age,max_age=excluded.max_age,riwayat_json=excluded.riwayat_json,min_hizb=excluded.min_hizb,max_hizb=excluded.max_hizb,requires_approval=excluded.requires_approval,max_participants=excluded.max_participants,rules=excluded.rules,judging_criteria_json=excluded.judging_criteria_json,awards_json=excluded.awards_json,participation_achievement=excluded.participation_achievement,participation_store=excluded.participation_store,created_by=excluded.created_by,created_at=excluded.created_at,updated_at=excluded.updated_at").bind(x.id,x.school_id,x.title,x.description,x.kind,x.season,x.category_id,x.status,x.registration_starts_at,x.registration_ends_at,x.starts_at,x.ends_at,x.min_age,x.max_age,x.riwayat_json,x.min_hizb,x.max_hizb,x.requires_approval,x.max_participants,x.rules,x.judging_criteria_json,x.awards_json,x.participation_achievement,x.participation_store,x.created_by,x.created_at,x.updated_at));
      for(const x of competitionRegistrations)statements.push(env.DB.prepare("INSERT INTO competition_registrations (id,competition_id,student_id,group_id,status,age_at_registration,hizb_at_registration,riwaya,note,registered_at,decided_by,decided_at,decision_note) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET competition_id=excluded.competition_id,student_id=excluded.student_id,group_id=excluded.group_id,status=excluded.status,age_at_registration=excluded.age_at_registration,hizb_at_registration=excluded.hizb_at_registration,riwaya=excluded.riwaya,note=excluded.note,registered_at=excluded.registered_at,decided_by=excluded.decided_by,decided_at=excluded.decided_at,decision_note=excluded.decision_note").bind(x.id,x.competition_id,x.student_id,x.group_id,x.status,x.age_at_registration,x.hizb_at_registration,x.riwaya,x.note,x.registered_at,x.decided_by,x.decided_at,x.decision_note));
      for(const x of competitionJudges)statements.push(env.DB.prepare("INSERT INTO competition_judges (competition_id,user_id,created_by,created_at) VALUES (?,?,?,?) ON CONFLICT(competition_id,user_id) DO UPDATE SET created_by=excluded.created_by,created_at=excluded.created_at").bind(x.competition_id,x.user_id,x.created_by,x.created_at));
      for(const x of competitionScores)statements.push(env.DB.prepare("INSERT INTO competition_scores (id,competition_id,registration_id,judge_user_id,criteria_json,total,note,scored_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET competition_id=excluded.competition_id,registration_id=excluded.registration_id,judge_user_id=excluded.judge_user_id,criteria_json=excluded.criteria_json,total=excluded.total,note=excluded.note,scored_at=excluded.scored_at").bind(x.id,x.competition_id,x.registration_id,x.judge_user_id,x.criteria_json,x.total,x.note,x.scored_at));
      for(const x of competitionResults)statements.push(env.DB.prepare('INSERT INTO competition_results (id,competition_id,registration_id,student_id,group_id,final_score,"rank",status,award_achievement,award_store,award_event_achievement_id,award_event_store_id,note,approved_by,approved_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET competition_id=excluded.competition_id,registration_id=excluded.registration_id,student_id=excluded.student_id,group_id=excluded.group_id,final_score=excluded.final_score,"rank"=excluded."rank",status=excluded.status,award_achievement=excluded.award_achievement,award_store=excluded.award_store,award_event_achievement_id=excluded.award_event_achievement_id,award_event_store_id=excluded.award_event_store_id,note=excluded.note,approved_by=excluded.approved_by,approved_at=excluded.approved_at,created_at=excluded.created_at').bind(x.id,x.competition_id,x.registration_id,x.student_id,x.group_id,x.final_score,x.rank,x.status,x.award_achievement,x.award_store,x.award_event_achievement_id,x.award_event_store_id,x.note,x.approved_by,x.approved_at,x.created_at));
      for(const x of competitionEvents)statements.push(env.DB.prepare("INSERT INTO competition_events (id,competition_id,title,description,event_date,kind,active,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET competition_id=excluded.competition_id,title=excluded.title,description=excluded.description,event_date=excluded.event_date,kind=excluded.kind,active=excluded.active,created_by=excluded.created_by,created_at=excluded.created_at").bind(x.id,x.competition_id,x.title,x.description,x.event_date,x.kind,x.active,x.created_by,x.created_at));
      for(const x of competitionTerms)statements.push(env.DB.prepare("INSERT INTO competition_reference_terms (id,kind,title,body,source,active,sort_order,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET kind=excluded.kind,title=excluded.title,body=excluded.body,source=excluded.source,active=excluded.active,sort_order=excluded.sort_order,created_by=excluded.created_by,created_at=excluded.created_at,updated_at=excluded.updated_at").bind(x.id,x.kind,x.title,x.body,x.source,x.active,x.sort_order,x.created_by,x.created_at,x.updated_at));
      try{
        for(let i=0;i<statements.length;i+=40)await env.DB.batch(statements.slice(i,i+40));
      }catch(restoreError){
        console.error("Ihsan backup restore failed",{message:String(restoreError?.message||restoreError),statements:statements.length});
        return fail(500,"توقفت الاستعادة أثناء الحفظ. قد تكون بعض الدفعات حُفظت؛ أعد المحاولة بالملف نفسه، فالدمج بمعرّفات ثابتة قابل لإعادة المحاولة.");
      }
      try{await log(env,user.id,"admin_backup_restore",{users:users.length,groups:groups.length,students:students.length,records:records.length,schools:schools.length,audit_entries:audit.length,point_events:pointEvents.length,quran_daily:quranDaily.length,quran_stations:quranStations.length,competitions:competitions.length,competition_registrations:competitionRegistrations.length,competition_results:competitionResults.length})}
      catch(auditError){console.error("Ihsan restore audit failed",{message:String(auditError?.message||auditError)})}
      return json({ok:true,mode:"merge",restored:{users:users.length,groups:groups.length,students:students.length,records:records.length,quran_schools:schools.length,audit_entries:audit.length,point_rules:pointRules.length,point_events:pointEvents.length,store_items:storeItems.length,store_redemptions:storeRedemptions.length,quran_paths:quranPaths.length,quran_daily:quranDaily.length,quran_pairs:quranPairs.length,quran_pair_sessions:quranPairSessions.length,quran_stations:quranStations.length,quran_makeups:quranMakeups.length,competition_categories:competitionCategories.length,competitions:competitions.length,competition_registrations:competitionRegistrations.length,competition_judges:competitionJudges.length,competition_scores:competitionScores.length,competition_results:competitionResults.length,competition_events:competitionEvents.length,competition_reference_terms:competitionTerms.length},notice:"تم دمج النسخة. لم تُحذف السجلات الموجودة خارج الملف؛ راجع البيانات قبل المتابعة."});
    }

    return fail(404,"المسار غير موجود");
    } catch (error) {
      console.error("Ihsan API request failed", { path, method, message: String(error?.message || error) });
      if (path.startsWith("/api/")) return fail(500, "حدث خطأ داخلي أثناء معالجة الطلب. تم تسجيل الخطأ للتشخيص؛ أعد المحاولة.");
      return new Response("Internal Server Error", { status: 500 });
    }
  },
  // مجدول نسخة احتياطية يومية: يبني النسخة الكاملة ثم يرفعها إلى R2 (يحتفظ بآخر 14 نسخة).
  // في حال الفشل يسجّل "backup_scheduled_failure" في سجل التدقيق ولا يُفشل الإطلاق.
  async scheduled(event, env) {
    try {
      if (!env.BACKUPS) throw new Error("BACKUPS (R2) binding is not configured");
      const payload = await buildFullBackup(env);
      const key = "backups/ihsan-academy-full-backup-v4-" + new Date().toISOString().replace(/[:.]/g, "-") + ".json";
      await env.BACKUPS.put(key, JSON.stringify(payload));
      try {
        const listed = await env.BACKUPS.list({ prefix: "backups/" });
        const objects = (listed.objects || []).sort((a, b) => String(a.uploaded || "").localeCompare(String(b.uploaded || "")));
        const stale = objects.slice(0, Math.max(0, objects.length - 14));
        for (const item of stale) { try { await env.BACKUPS.delete(item.key); } catch {} }
      } catch { /* حذف القديمة ليس سبباً لفشل النسخة */ }
      await log(env, null, "backup_scheduled_success", { key, users: payload.data.users.length, records: payload.data.academy_records.length, store_items: payload.data.store_items.length });
    } catch (error) {
      const message = String(error?.message || error).slice(0, 300);
      console.error("Ihsan scheduled backup failed", { message });
      try { await log(env, null, "backup_scheduled_failure", { message }); } catch {}
    }
  }
};
