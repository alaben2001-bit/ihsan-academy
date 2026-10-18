const json = (data, status = 200, extra = {}) => new Response(JSON.stringify(data), {
  status,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "referrer-policy": "strict-origin-when-cross-origin",
    ...extra,
  },
});

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/health" && request.method === "GET") {
      try {
        const row = await env.DB.prepare("SELECT 1 AS ok").first();
        return json({ ok: row?.ok === 1, app: "ihsan-academy", runtime: "cloudflare-workers", storage: "d1" }, row?.ok === 1 ? 200 : 503);
      } catch {
        return json({ ok: false, error: "database_unavailable" }, 503);
      }
    }
    if (url.pathname === "/api/public/quran-schools" && request.method === "GET") {
      try {
        const result = await env.DB.prepare(
          "SELECT id, name, description FROM quran_schools WHERE active = 1 ORDER BY sort_order, name"
        ).all();
        return json(result.results || []);
      } catch {
        return json({ error: "database_unavailable" }, 503);
      }
    }
    if (url.pathname.startsWith("/api/")) {
      return json({
        error: "migration_incomplete",
        message: "This Cloudflare preview does not yet implement this API route. The existing Render app remains unchanged.",
      }, 501);
    }
    return env.ASSETS.fetch(request);
  },
};
