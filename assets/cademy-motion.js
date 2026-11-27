/* أكاديمية الإحسان — طبقة الحركة والتفاعل. لا تغيّر منطق التطبيق. */
(() => {
  const reduced = () =>
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ||
    document.documentElement.classList.contains("reduced-motion") ||
    document.documentElement.classList.contains("ihsan-reduced-motion");

  // 1) ظهور متدرج وعدّادات للأرقام
  function animateNumber(el) {
    const target = Number(el.textContent.trim());
    if (!Number.isFinite(target) || el.dataset.uiCounted) return;
    el.dataset.uiCounted = "1";
    if (reduced() || target === 0) return;
    const start = performance.now(), duration = 700;
    el.classList.add("ui-count");
    const step = now => {
      const p = Math.min(1, (now - start) / duration);
      el.textContent = String(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(step);
    };
    el.textContent = "0";
    requestAnimationFrame(step);
  }

  function reveal(root) {
    const items = root.querySelectorAll(
      "#view .stat, #view .card, #view .item, #view .learning-domain-card"
    );
    items.forEach((el, i) => {
      if (el.dataset.uiR) return;
      el.dataset.uiR = "1";
      if (reduced()) return;
      el.classList.add("ui-reveal");
      el.style.setProperty("--d", Math.min(i, 12) * 45 + "ms");
      requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("ui-in")));
    });
    root.querySelectorAll("#view .stat .num").forEach(animateNumber);
  }

  // 2) مراقبة تغيّر الصفحة (التطبيق يعيد رسم #view عند كل تنقل)
  function watch() {
    const view = document.getElementById("view");
    if (!view) return setTimeout(watch, 300);
    new MutationObserver(() => reveal(document)).observe(view, { childList: true, subtree: true });
    reveal(document);
  }

  // 3) تكبير الرسوم والإحصائيات
  function openZoom(source) {
    const overlay = document.createElement("div");
    overlay.className = "ui-zoom-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-label", "عرض مكبّر");
    const stage = document.createElement("div");
    stage.className = "ui-zoom-stage";
    stage.appendChild(source.cloneNode(true));
    const bar = document.createElement("div");
    bar.className = "ui-zoom-bar";
    bar.innerHTML = '<button type="button" data-z="in" aria-label="تكبير">+</button>' +
      '<button type="button" data-z="out" aria-label="تصغير">−</button>' +
      '<button type="button" data-z="reset" aria-label="إعادة الحجم">↺</button>';
    overlay.append(stage, bar);
    document.body.appendChild(overlay);

    let scale = 1;
    const apply = () => { const t = stage.firstElementChild; if (t) t.style.transform = `scale(${scale})`; };
    const close = () => { overlay.remove(); document.removeEventListener("keydown", onKey); };
    const onKey = e => { if (e.key === "Escape") close(); };
    bar.addEventListener("click", e => {
      const z = e.target.dataset.z;
      if (z === "in") scale = Math.min(3, scale + .25);
      if (z === "out") scale = Math.max(1, scale - .25);
      if (z === "reset") scale = 1;
      apply();
    });
    stage.addEventListener("wheel", e => {
      e.preventDefault();
      scale = Math.min(3, Math.max(1, scale - Math.sign(e.deltaY) * .1));
      apply();
    }, { passive: false });
    overlay.addEventListener("click", e => { if (e.target === overlay) close(); });
    document.addEventListener("keydown", onKey);
  }

  document.addEventListener("click", e => {
    const target = e.target.closest("#view .stat, #view .card svg, #view .ui-zoomable");
    if (!target || target.closest("button, a, input, select, textarea")) return;
    if (target.matches("#view .card svg") && !target.closest(".card")) return;
    openZoom(target.matches("svg") ? target : target);
  });

  // ملاحظة: الزر داخل المكبّر يحمل data-z؛ لا نغلق عند النقر عليه.
  document.querySelectorAll(".ui-zoomable").forEach(el => el.classList.add("ui-zoomable"));

  watch();
})();