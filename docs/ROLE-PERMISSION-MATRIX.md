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
| competitions manage | ✅ | ✅? | ✅? | — | enter |
| audit view | ✅ | school | — | — | — |
| backup export/restore | ✅ | — | — | — | — |

## فجوات / needs verification

- Director/teacher/supervisor boundaries (school/group/team scope) **لم تُختبر تلقائيًا** — manual/API audit required.
- `❓` = policy unclear from code; needs explicit decision before granting.
- لا توسع صلاحيات دون موافقة صاحب الأكاديمية (per task constraints).

## اختبارات مطلوبة (P1)

لكل دور: direct URL access + API request with forged IDs → expect 403. See TEST-PLAN.md §2.3.
