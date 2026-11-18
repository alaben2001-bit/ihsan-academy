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
const staffEnd = app.indexOf("// ---- برنامج الثمانية أشهر", staffStart);
const staffPage = app.slice(staffStart, staffEnd);

check("student card contains its own QR inside the pass", /class="pass-qr"[^]*?qrSvg\(links\.add_points,144\)/.test(studentPage));
check("student card print no longer appends a separate QR sheet", !/cardQrSheet\(links/.test(studentPage));
check("golden decorative chip remains in student card", /class="pass-chip"/.test(studentPage));
check("staff cards use the same preserved student-pass design", /class="student-pass student-pass-print"/.test(staffPage));
check("staff cards embed a unique add-points QR per student", /qrSvg\(link,180\)/.test(staffPage));
check("individual print action exists", /data-card-print-one/.test(staffPage));
check("all permitted groups option exists", /__all_managed_groups__/.test(staffPage));
check("group and all-scope printing use the existing authorized bulk endpoint", /api\("\/student-cards\/bulk"/.test(staffPage));
check("all-scope printing follows every paginated batch", /while\(true\)[^]*?data\.has_more[^]*?data\.next_offset/.test(staffPage));
check("existing bulk endpoint paginates with bounded limits and offset", /LIMIT \? OFFSET \?/.test(server) && /Math\.min\(200/.test(server));
check("admin card template does not inject point balances", !/achievement|store_balance|رصيد المتجر|نقاط الإنجاز/.test(staffPage));
check("bulk print is split into explicit sheets of eight cards", /offset\+=8/.test(staffPage) && /cards-print-page/.test(staffPage));
check("A4 sheet boundaries force page breaks", /cards-print-page\{display:block!important[^}]*break-after:page!important/s.test(css));
check("physical card dimensions are defined as 85.6 × 54 mm", /width:85\.6mm!important;height:54mm!important/.test(css));
check("QR has a dedicated print-safe white surface and crisp SVG", /\.pass-qr svg\{display:block;width:100%;height:100%;shape-rendering:crispEdges\}/.test(css));
check("bulk print hides controls and keeps complete cards", /body\[data-print="cards"\] \.student-card-print-actions\{display:none!important\}/.test(css));
check("individual print isolates the selected card", /\.student-card-print-item\.is-print-target\{display:block!important\}/.test(css));
check("student card still retains its original gold-chip styling", /\.pass-chip\{[^}]*linear-gradient\(135deg,#f3d79b,#b98b3c\)/s.test(css));

const failed = checks.filter(item => !item.ok);
console.log("\n" + (checks.length - failed.length) + "/" + checks.length + " source-layout checks passed.");
if (failed.length) process.exitCode = 1;
