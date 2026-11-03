(() => {
  "use strict";

  const app = document.getElementById("app");
  const appScript = document.getElementById("academy-app-script");

  const showFailure = (title, message, includeHealth = false) => {
    if (!app) return;
    app.innerHTML =
      '<section class="panel"><h2>' + title + '</h2><p class="muted">' + message + '</p><p>' +
      '<a class="btn" href="/">إعادة المحاولة</a>' +
      (includeHealth ? ' <a class="btn secondary" href="/api/health" target="_blank" rel="noopener">فحص الخادم</a>' : "") +
      '</p></section>';
  };

  appScript?.addEventListener("error", () => {
    showFailure(
      "تعذّر تحميل واجهة الأكاديمية",
      "لم يتمكن المتصفح من تحميل ملف التطبيق app.js. هذا خلل في نشر الملفات أو مسارها، وليس في قاعدة البيانات.",
      true
    );
  });

  window.setTimeout(() => {
    if (app?.querySelector(".loading")) {
      showFailure(
        "تأخر فتح الأكاديمية",
        "لم يكتمل تشغيل واجهة الأكاديمية. أعد تحميل الصفحة، وإن استمرت المشكلة فهذه رسالة تشخيص وليست تعليقًا صامتًا.",
        true
      );
    }
  }, 15000);

  // Soft page transitions. Moved out of index.html so the strict CSP never blocks it.
  try {
    const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (sessionStorage.getItem("ihsan-motion-enter") === "1") {
      sessionStorage.removeItem("ihsan-motion-enter");
      document.body.classList.add("ihsan-entering");
      window.setTimeout(() => document.body.classList.remove("ihsan-entering"), 600);
    }

    if (!reduceMotion) {
      document.addEventListener("click", event => {
        const link = event.target.closest("a[href]");
        if (!link || event.defaultPrevented || event.button !== 0) return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        if (link.target || link.hasAttribute("download")) return;

        const url = new URL(link.href, location.href);
        if (url.origin !== location.origin) return;
        if (url.pathname === location.pathname && url.search === location.search) return;
        if (!url.pathname.startsWith("/") || url.pathname.startsWith("/api/")) return;

        event.preventDefault();
        try { sessionStorage.setItem("ihsan-motion-enter", "1"); } catch (error) {}
        document.body.classList.add("ihsan-leaving");
        window.setTimeout(() => { location.href = url.href; }, 170);
      }, true);
    }
  } catch (error) {}

  // Warm the app shell as soon as the browser is idle: makes repeat visits feel instant.
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(() => {
      ["/about", "/privacy"].forEach(href => {
        const link = document.createElement("link");
        link.rel = "prefetch";
        link.href = href;
        document.head.appendChild(link);
      });
    }, { timeout: 3000 });
  }
})();
