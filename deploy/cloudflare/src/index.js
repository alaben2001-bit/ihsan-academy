const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
};

const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), { status, headers: { ...JSON_HEADERS, ...extra } });

const fail = (status, error) => json({ error }, status);
const nowIso = () => new Date().toISOString();
const clean = (v, max = 200) => String(v ?? "").trim().slice(0, max);
const uuid = () => crypto.randomUUID();
const hex = bytes => [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, "0")).join("");
const unhex = value => new Uint8Array((value.match(/.{1,2}/g) || []).map(x => parseInt(x, 16)));
const hashToken = async token => hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)));

async function passwordHash(password, saltHex = hex(crypto.getRandomValues(new Uint8Array(16)))) {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: unhex(saltHex), iterations: 210000 }, material, 256);
  return `pbkdf2-sha256$210000$${saltHex}$${hex(bits)}`;
}

async function verifyPassword(password, stored) {
  const [algorithm, roundsText, salt, expected] = String(stored || "").split("$");
  if (algorithm !== "pbkdf2-sha256" || roundsText !== "210000" || !salt || !expected) return false;
  const actual = await passwordHash(password, salt);
  const a = actual.split("$")[3], b = expected;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function bodyJson(request, maxBytes = 32_000) {
  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > maxBytes) throw new Error("payload_too_large");
  try { return raw ? JSON.parse(raw) : {}; } catch { throw new Error("invalid_json"); }
}

async function currentUser(request, env) {
  const match = /^Bearer\s+([a-f0-9]{64})$/i.exec(request.headers.get("authorization") || "");
  if (!match) return null;
  const tokenHash = await hashToken(match[1]);
  const row = await env.DB.prepare(
    "SELECT u.id,u.display_name,u.identity_normalized,u.role,u.active FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.active=1"
  ).bind(tokenHash, nowIso()).first();
  if (!row) return null;
  return { id: row.id, name: row.display_name, email: row.identity_normalized, role: row.role, active: !!row.active };
}

function safeUser(user) {
  return { id: user.id, name: user.name, email: user.email, role: user.role, active: true, theme: "emerald", font_scale: 1, high_contrast: false, reduced_motion: false };
}

const recordCollections = new Set([
  "tests", "notifications", "posts", "subjects", "lessons", "schedule", "student_tasks",
  "assignments", "messages", "calendar", "challenges", "journey_items", "quran_levels",
  "quran_halaqas", "quran_plans", "quran_reviews", "quran_sessions", "quran_evaluations",
  "quran_submissions", "teams", "teacher_notes", "goals", "question_bank", "discussions",
  "media_posts", "transport_routes", "academic_years", "terms", "learning_plans"
]);

async function records(env, collection) {
  const result = await env.DB.prepare(
    "SELECT payload_json FROM academy_records WHERE collection=? ORDER BY updated_at DESC LIMIT 500"
  ).bind(collection).all();
  return (result.results || []).flatMap(row => {
    try { return [JSON.parse(row.payload_json)]; } catch { return []; }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();

    if (method === "OPTIONS") return new Response(null, { status: 204, headers: {
      "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      "access-control-allow-headers": "Content-Type, Authorization",
      "access-control-max-age": "600",
      ...JSON_HEADERS,
    }});

    if (url.pathname === "/api/health" && method === "GET") {
      try {
        const row = await env.DB.prepare("SELECT 1 AS ok").first();
        const counts = await env.DB.prepare("SELECT COUNT(*) AS n FROM users").first();
        return json({ ok: row?.ok === 1, app: "ihsan-academy", runtime: "cloudflare-workers", storage: "d1", users: counts?.n ?? 0 });
      } catch {
        return fail(503, "database_unavailable");
      }
    }

    if (url.pathname === "/api/privacy" && method === "GET") {
      return json({ title: "سياسة الخصوصية — أكاديمية الإحسان في بناء الإنسان", principles: [
        "نجمع أقل قدر لازم للتعليم والإدارة.", "لا نبيع البيانات الشخصية ولا نشاركها للإعلانات.",
        "الصلاحيات تحدد ما يراه كل مستخدم.", "السجلات الحساسة تُحفظ في الخادم."
      ]});
    }

    if (url.pathname === "/api/public/quran-schools" && method === "GET") {
      try {
        const result = await env.DB.prepare(
          "SELECT id, name, description, NULL AS school_id FROM quran_schools WHERE active=1 ORDER BY sort_order,name"
        ).all();
        return json(result.results || []);
      } catch { return fail(503, "database_unavailable"); }
    }

    // First-admin bootstrap is closed unless an operator configures a one-time secret
    // in the Worker environment. No password or bootstrap secret is hard-coded here.
    if (url.pathname === "/api/admin/bootstrap" && method === "POST") {
      if (!env.BOOTSTRAP_SECRET) return fail(404, "not_found");
      if (request.headers.get("x-bootstrap-secret") !== env.BOOTSTRAP_SECRET) return fail(403, "forbidden");
      let input;
      try { input = await bodyJson(request); } catch (e) { return fail(e.message === "payload_too_large" ? 413 : 400, e.message); }
      const name = clean(input.name, 120);
      const identity = clean(input.email, 200).toLowerCase();
      const password = String(input.password || "");
      if (!name || !/^\S+@\S+\.\S+$/.test(identity) || password.length < 14) return fail(400, "valid_name_email_and_14_char_password_required");
      const existing = await env.DB.prepare("SELECT COUNT(*) AS n FROM users WHERE role='admin'").first();
      if ((existing?.n || 0) > 0) return fail(409, "admin_already_exists");
      const hash = await passwordHash(password);
      await env.DB.prepare("INSERT INTO users (id,display_name,identity_normalized,password_hash,role,active) VALUES (?,?,?,?, 'admin',1)")
        .bind(uuid(), name, identity, hash).run();
      await env.DB.prepare("INSERT INTO audit_log (id,action,metadata_json) VALUES (?,?,?)")
        .bind(uuid(), "admin_bootstrap", JSON.stringify({ identity })).run();
      return json({ ok: true, message: "administrator_created" }, 201);
    }

    if (url.pathname === "/api/login" && method === "POST") {
      let input;
      try { input = await bodyJson(request, 8_000); } catch (e) { return fail(e.message === "payload_too_large" ? 413 : 400, e.message); }
      const identity = clean(input.identity ?? input.email, 200).toLowerCase();
      const password = String(input.password || "");
      if (!identity || !password || password.length > 1024) return fail(400, "identity_and_password_required");
      const user = await env.DB.prepare(
        "SELECT id,display_name,identity_normalized,password_hash,role,active FROM users WHERE identity_normalized=? LIMIT 1"
      ).bind(identity).first();
      const valid = user && user.active === 1 && await verifyPassword(password, user.password_hash);
      if (!valid) return fail(401, "الاسم واللقب أو البريد الإلكتروني أو كلمة المرور غير صحيحة");
      const token = hex(crypto.getRandomValues(new Uint8Array(32)));
      await env.DB.prepare("INSERT INTO sessions (token_hash,user_id,expires_at) VALUES (?,?,?)")
        .bind(await hashToken(token), user.id, new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString()).run();
      await env.DB.prepare("INSERT INTO audit_log (id,user_id,action) VALUES (?,?,?)")
        .bind(uuid(), user.id, "login").run();
      return json({ token, user: safeUser({ id: user.id, name: user.display_name, email: user.identity_normalized, role: user.role }), csrf_required: false });
    }

    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    if (url.pathname === "/api/logout" && method === "POST") {
      const match = /^Bearer\s+([a-f0-9]{64})$/i.exec(request.headers.get("authorization") || "");
      if (match) await env.DB.prepare("DELETE FROM sessions WHERE token_hash=?").bind(await hashToken(match[1])).run();
      return json({ ok: true });
    }

    const user = await currentUser(request, env);
    if (!user) return fail(401, "غير مسجل الدخول");

    if (url.pathname === "/api/me" && method === "GET") return json(safeUser(user));

    if (url.pathname === "/api/groups" && method === "GET") {
      if (user.role === "admin") {
        const result = await env.DB.prepare("SELECT id,name,school_id,active FROM groups WHERE active=1 ORDER BY name").all();
        return json((result.results || []).map(g => ({ ...g, student_count: 0 })));
      }
      return json([]);
    }

    if (url.pathname === "/api/students" && method === "GET") {
      if (user.role !== "admin") return json([]);
      const result = await env.DB.prepare("SELECT id,display_name AS name,group_id,active FROM students WHERE active=1 ORDER BY display_name").all();
      return json(result.results || []);
    }

    if (url.pathname === "/api/dashboard" && method === "GET") {
      const [students, groups, tests] = await Promise.all([
        env.DB.prepare("SELECT COUNT(*) AS n FROM students WHERE active=1").first(),
        env.DB.prepare("SELECT COUNT(*) AS n FROM groups WHERE active=1").first(),
        records(env, "tests")
      ]);
      return json({ students_count: user.role === "admin" ? (students?.n || 0) : 0, groups_count: user.role === "admin" ? (groups?.n || 0) : 0, attendance_rate: 0, progress_avg: 0, upcoming_tests: tests.length, due_reviews: 0 });
    }

    if (url.pathname === "/api/tests" && method === "GET") return json(await records(env, "tests"));
    if (url.pathname === "/api/subjects" && method === "GET") return json(await records(env, "subjects"));
    if (url.pathname === "/api/notifications" && method === "GET") return json(await records(env, "notifications"));
    if (url.pathname === "/api/posts" && method === "GET") return json(await records(env, "posts"));
    if (url.pathname === "/api/quran" && method === "GET") return json({ levels: await records(env, "quran_levels"), students: [], can_edit: user.role === "admin" || user.role === "teacher" });

    if (url.pathname === "/api/metrics" && method === "GET") {
      if (user.role !== "admin") return fail(403, "forbidden");
      const counts = await env.DB.prepare("SELECT (SELECT COUNT(*) FROM users) AS users,(SELECT COUNT(*) FROM students) AS students,(SELECT COUNT(*) FROM groups) AS groups,(SELECT COUNT(*) FROM academy_records) AS records").first();
      return json({ ...counts, storage: "d1" });
    }

    // Deliberately fail closed until a route is ported with equivalent authorization.
    return json({ error: "migration_incomplete", route: url.pathname, message: "This route has not yet been ported; use the unchanged Render app." }, 501);
  },
};
