# مصفوفة الصلاحيات — 5 أدوار

**المصدر:** deploy/cloudflare/src/index.js (currentUser + role checks في كل مسار).  
**الحالة:** مفروضة في الخادم (server-side). الواجهة تُخفي الأزرار but is not the enforcement.

| Capability | admin | director | teacher | supervisor | student |
|---|---|---|---|---|---|
| bootstrap (one-time) | secret-gated | — | — | — | — |
| users/staff CRUD | ✅ | school scope | — | — | — |
| groups CRUD | ✅ | school scope | assigned | — | read own |
| students CRUD | ✅ | school scope | assigned groups | team | self |
| attendance write | ✅ | ✅ | assigned groups | — | self view |
| quran progress write | ✅ | ✅ | assigned groups | — | self |
| assignments create/review | ✅ | ✅ | assigned groups | — | submit own |
| tests create/grade | ✅ | ✅ | assigned groups | — | take own |
| points award (manual) | ✅ | ❓ (verify) | ❓ (verify) | — | — |
| points rules edit | ✅ | ❓ | — | — | — |
| store items manage | ✅ | ❓ | — | — | — |
| redemption decision | ✅ | ✅? | ✅? | — | request own |
| messages send | role-scoped recipients | role-scoped | role-scoped | role-scoped | role-scoped |
| content publish | ✅ | ✅? | ✅? | — | read published |
| competitions create/manage | ✅ | own school | — | — | — |
| competitions calendar/terms | ✅ | own school | — | — | read derived |
| competition registration decision | ✅ | own school | managed group | managed group | — |
| competition judging | ✅ | own school | assigned judge or managed group | assigned judge or managed group | — |
| competition results generate/approve | ✅ | own school | — | — | — |
| competition register | — | — | — | — | self (eligibility) |
| audit view | ✅ | school | — | — | — |
| backup export/restore | ✅ | — | — | — | — |

## فجوات / needs verification

- Director/teacher/supervisor boundaries (school/group/team scope) **لم تُختبر تلقائيًا** — manual/API audit required.
- `❓` = policy unclear from code; needs explicit decision before granting.
- لا توسع صلاحيات دون موافقة صاحب الأكاديمية (per task constraints).
- **المسابقات (2026-11-13):** تحقق آلي عبر `competitions-test.mjs` (124 فحصًا) لصلاحيات admin/director/teacher/supervisor/student، ونطاق المدرسة والفوج، وتعيين/إزالة المحكمين، ومنع اعتماد النتائج أو منح الجوائز بغير صلاحية.

## اختبارات مطلوبة (P1)

لكل دور: direct URL access + API request with forged IDs → expect 403. See TEST-PLAN.md §2.3.
