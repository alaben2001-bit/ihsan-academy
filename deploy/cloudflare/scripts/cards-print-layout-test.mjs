import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const app = fs.readFileSync(path.join(root, "site/app.js"), "utf8");
const css = fs.readFileSync(path.join(root, "site/style.css"), "utf8");
const server = fs.readFileSync(path.join(root, "src/index.js"), "utf8");
const checks = [];
function check(name, condition) {
  checks.push({ name, ok: Boolean(condition) });
  console.log((condition ? "PASS " : "FAIL ") + name);
}
const studentPageStart = app.indexOf("async function cardPage(v)");
const studentPageEnd = app.indexOf("function staffStudentPassMarkup", studentPageStart);
const studentPage = app.slice(studentPageStart, studentPageEnd);
const staffStart = app.indexOf("function staffStudentPassMarkup");
const staffEnd = app.indexOf("function quranEightMonthMarkup", staffStart);
const staffPage = staffEnd > staffStart ? app.slice(staffStart, staffEnd) : "";

check("student card prints one smart QR backed by the login token", /class="pass-qr"[^]*?qrSvg\(links\.login,144\)/.test(studentPage) && /رمز QR الذكي/.test(studentPage));
check("student card has no balance, store balance, or level badge", !/passBalances|الرصيد الحالي|رصيد المتجر|نقاط الإنجاز|pass-level/.test(studentPage));
check("student card print no longer appends a separate QR sheet", !/cardQrSheet\(links/.test(studentPage));
check("golden decorative chip remains in student card", /class="pass-chip"/.test(studentPage));
check("staff cards use the same preserved student-pass design", /class="student-pass student-pass-print"/.test(staffPage));
check("legacy staff-only QR tools remain separate and server-authorized", /data-card-qr-tools/.test(staffPage) && /QR الملف الشخصي/.test(staffPage) && /QR إضافة النقاط/.test(staffPage) && server.includes("canAccessStudentCard(env,scanner,student)") && server.includes('resolvedKind==="add_points"'));
check("bulk-printed student card uses the single smart QR", /const qr=qrSvg\(row\.links\?\.login\|\|""\,180\)/.test(staffPage) && /رمز QR الذكي للطالب والشيخ/.test(staffPage));
check("printed card contains no balance and no level-one label", !/pass-grid|الرصيد الحالي|رصيد المتجر|نقاط الإنجاز|بطاقة مستوى 1/.test(staffPage));
check("printed card uses smart QR and keeps legacy staff QR tools separate", /const qr=qrSvg\(row\.links\?\.login/.test(staffPage) && /QR الملف الشخصي/.test(staffPage));
check("individual print action exists", /data-card-print-one/.test(staffPage));
check("all permitted groups option exists", /__all_managed_groups__/.test(staffPage));
check("group and all-scope printing use the existing authorized bulk endpoint", /api\("\/student-cards\/bulk"/.test(staffPage));
check("all-scope printing follows every paginated batch", /while\(true\)[^]*?data\.has_more[^]*?data\.next_offset/.test(staffPage));
check("existing bulk endpoint paginates with bounded limits and offset", /LIMIT \? OFFSET \?/.test(server) && /Math\.min\(200/.test(server));
check("bulk card API still supplies authoritative totals without printing balances on the card", /pointsTotals\(env,row\.id\)/.test(server) && /totals\}\)/.test(server) && !/pass-grid|الرصيد الحالي|رصيد المتجر|نقاط الإنجاز/.test(staffPage));
check("bulk print is split into explicit sheets of ten cards with page numbering", /offset\+=10/.test(staffPage) && /cards-print-page-number/.test(staffPage));
check("each A4 sheet actually renders ten cards rather than eight", /datasets\.slice\(offset,offset\+10\)/.test(staffPage));
check("page count is derived from the same ten-card batch size", /Math\.ceil\(datasets\.length\/10\)/.test(staffPage));
check("A4 sheet boundaries force page breaks", css.includes('body[data-print="cards"] .cards-print-page{position:relative!important;display:block!important') && css.includes("break-after:page!important;page-break-after:always!important"));
check("physical card dimensions are defined as 85.6 × 54 mm", /width:85\.6mm!important;height:54mm!important/.test(css));
check("QR has a dedicated print-safe white surface and crisp SVG", /\.pass-qr svg\{display:block;width:100%;height:100%;shape-rendering:crispEdges\}/.test(css));
check("bulk print hides controls and keeps complete cards", /body\[data-print="cards"\] \.student-card-print-actions\{display:none!important\}/.test(css));
check("individual print isolates the selected card", /\.student-card-print-item\.is-print-target\{display:block!important\}/.test(css));
check("student card still retains its original gold-chip styling", /\.pass-chip\{[^}]*linear-gradient\(135deg,#f3d79b,#b98b3c\)/s.test(css));
check("smart-card chip has six metallic contact pads and engraved contact frame", /grid-template-columns:repeat\(3,1fr\)/.test(css) && /grid-template-rows:repeat\(2,1fr\)/.test(css) && /pass-chip:before/.test(css));
check("student card uses the emerald luxury finish", /V77 — premium emerald PVC pass/.test(css) && /linear-gradient\(132deg,#073b30 0%,#052b25 48%,#031b19 100%\)/.test(css));
check("QR tokens have no automatic expiry", /const cardActive = token => Boolean\(token\) && !token\.revoked_at/.test(server));
check("new QR tokens persist with a null expiry", /expires_at: null, revoked_at: null/.test(server));
check("legacy QR expiry is cleared without rotating the secret", server.includes("ترقية آمنة للبطاقات القديمة") && server.includes("expires_at: null"));
check("revoked QR tokens are not automatically reissued", /if \(token\.revoked_at\) continue/.test(server));
check("printed QR links use the canonical production origin", server.includes('CARD_CANONICAL_ORIGIN = "https://a-ihsan.pages.dev"') && server.includes("const base = CARD_CANONICAL_ORIGIN"));
check("student card does not print an automatic expiry date", !/صالحة حتى/.test(app));

check("bulk print clears scroll/height clipping from every app-shell ancestor", css.includes('body[data-print="cards"] #app') && css.includes("max-height:none!important") && css.includes("overflow:visible!important"));
check("bulk print preserves a full five-row 2×5 CR80 sheet per A4 page", css.includes("grid-template-rows:repeat(5,54mm)!important") && css.includes("height:273mm!important") && css.includes("height:275mm!important") && css.includes("@page{size:A4 portrait;margin:10mm}"));
check("final overriding print rules also use five rows, not the legacy four-row layout", /V76[^]*?grid-template-rows:repeat\(5,54mm\)!important[^]*?height:273mm!important/.test(css) && !/V76[^]*?grid-template-rows:repeat\(4,54mm\)!important/.test(css));
check("bulk print offers Save as PDF from the browser print dialog", /حفظ PDF \/ طباعة النطاق/.test(app) && /حفظ بصيغة PDF/.test(app));
check("bulk print prevents page splitting inside a sheet or card", css.includes("break-inside:avoid!important") && css.includes("page-break-inside:avoid!important"));

const failed = checks.filter(item => !item.ok);
console.log("\n" + (checks.length - failed.length) + "/" + checks.length + " source-layout checks passed.");
if (failed.length) process.exitCode = 1;
