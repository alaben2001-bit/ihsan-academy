# خيارات الذكاء الاصطناعي — أكاديمية الإحسان

## الوضع
- تصميم معماري موجود (architecture/UI only).
- لا provider مُفعّل. لا استهلاك API.
- لا impersonate sheikh, لا fatwa, لا psychological ruling, لا تغيير بيانات حساسة.

## خيارات (للموافقة)
1. **Cloudflare Workers AI** (مدمج، free tier) — latency منخفض، privacy (data stays in CF). مناسب لـ: تلخيص، صياغة، ترجمة، اقتراحات.
2. **OpenAI / Anthropic** (API) — جودة أعلى، تكلفة per-token. يتطلب secret + budget.
3. **Azure OpenAI / Google Vertex** — compliance/enterprise.

## مهام محتملة للـ AI (internal-first)
- صياغة/تلخيص محتوى تعليمي (under human review).
- اقتراحات خطة (student accepts/edits).
- 분류/تنظيم (tags, summaries).
- **ليس**: تصحيح تلاوة، فتوى، ruling، auto-grading religious content.

## ضوابط
- Rate limits, logging, transparency (AI labeled).
- Privacy-safe (no student PII to external without consent).
- Budget caps + alerts.
- Human review for religious content.

## قرار مطلوب
- Provider selection.
- Budget (monthly).
- Scope (which features).
- No activation until approval.
