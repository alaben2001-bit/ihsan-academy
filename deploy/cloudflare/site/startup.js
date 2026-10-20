(() => {
  const app = document.getElementById("app");
  const appScript = document.getElementById("academy-app-script");
  const showFailure = (title, message, includeHealth = false) => {
    if (!app) return;
    app.innerHTML = '<section class="panel"><h2>' + title + '</h2><p class="muted">' + message + '</p><p><a class="btn" href="/">إعادة المحاولة</a>' +
      (includeHealth ? ' <a class="btn secondary" href="/api/health" target="_blank" rel="noopener">فحص الخادم</a>' : '') +
      '</p></section>';
  };
  appScript?.addEventListener("error", () => {
    showFailure("تعذّر تحميل واجهة الأكاديمية", "لم يتمكن المتصفح من تحميل ملف التطبيق app.js. هذا خلل في نشر الملفات أو مسارها، وليس في قاعدة البيانات.", true);
  });
  window.setTimeout(() => {
    if (app?.querySelector(".loading")) {
      showFailure("تأخر فتح الأكاديمية", "لم يكتمل تشغيل واجهة الأكاديمية. أعد تحميل الصفحة، وإن استمرت المشكلة فهذه رسالة تشخيص وليست تعليقًا صامتًا.", true);
    }
  }, 15000);
})();
