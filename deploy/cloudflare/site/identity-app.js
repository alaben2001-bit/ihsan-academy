// Four signature identities layered over the current production app without replacing it.
// Loaded after app.js: legacy theme/appearance functions are neutralised and the
// saved identity is re-applied so the production palette cannot win.
(function () {
  "use strict";
  var presets = {
    "ruby-night": { name: "الياقوت الليلي", note: "أحمر فاخر بعمق ليلي", scheme: "dark", color: "#30091a", key: "ruby" },
    "emerald-night": { name: "الزمرد الليلي", note: "زمردي داكن بذهب هادئ", scheme: "dark", color: "#071d16", key: "emerald" },
    "ruby-day": { name: "الياقوت النهاري", note: "ياقوت نقي على نور النهار", scheme: "light", color: "#fdf5f2", key: "ruby" },
    "emerald-day": { name: "الزمرد النهاري", note: "الهوية الرسمية — أخضر وذهبي", scheme: "light", color: "#f4f7f2", key: "emerald" }
  };
  var order = ["ruby-night", "emerald-night", "ruby-day", "emerald-day"];
  var legacyVars = ["green", "mint", "gold", "paper", "ink", "muted", "line", "surface", "surface-2", "glow"];

  function currentIdentity() {
    var saved = "";
    try { saved = localStorage.getItem("ihsan_identity") || ""; } catch (error) {}
    return Object.prototype.hasOwnProperty.call(presets, saved) ? saved : "emerald-day";
  }

  function apply() {
    var root = document.documentElement;
    var id = currentIdentity(), preset = presets[id];
    var iconStyle = "soft", iconSize = "medium", scale = 1;
    try {
      iconStyle = localStorage.getItem("ihsan_icon_style") || "soft";
      iconSize = localStorage.getItem("ihsan_icon_size") || "medium";
      scale = Math.min(1.8, Math.max(0.85, Number(localStorage.getItem("ihsan_font_scale") || 1)));
    } catch (error) {}

    // The old theme engine wrote inline palette variables; inline styles beat
    // stylesheet rules, so they must be cleared before the identity layer runs.
    legacyVars.forEach(function (key) { root.style.removeProperty("--" + key); });
    root.removeAttribute("data-ihsan-theme");
    root.removeAttribute("data-ihsan-theme-mode");

    root.setAttribute("data-identity", id);
    root.setAttribute("data-appearance", preset.scheme);
    root.setAttribute("data-appearance-background", "classic");
    root.setAttribute("data-appearance-palette", id);
    root.setAttribute("data-icon-style", iconStyle);
    root.setAttribute("data-icon-size", iconSize);
    root.style.colorScheme = preset.scheme;
    root.style.setProperty("--user-font-scale", String(scale));

    var schemeMeta = document.querySelector('meta[name="color-scheme"]');
    if (schemeMeta) schemeMeta.setAttribute("content", preset.scheme);
    var themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) themeMeta.setAttribute("content", preset.color);
  }

  // Legacy handlers call these unqualified names; replacing the global bindings
  // makes every old theme/appearance control harmless.
  window.applyTheme = function () { apply(); };
  window.applyAppearanceSettings = function () { apply(); };
  apply();

  function hideLegacyControls(dialog) {
    var themeSection = dialog.querySelector(".theme-options");
    if (themeSection) {
      var section = themeSection.closest(".settings-section");
      if (section) section.hidden = true;
    }
    dialog.querySelectorAll("#settings-theme-random, #theme-mode-status").forEach(function (el) {
      var field = el.closest(".appearance-field, .settings-section");
      if (field) field.hidden = true;
    });
    dialog.querySelectorAll("[data-appearance-mode],[data-appearance-bg]").forEach(function (el) {
      var field = el.closest(".appearance-field");
      if (field) field.hidden = true;
    });
  }

  function inject() {
    var dialog = document.getElementById("settings-dialog");
    if (!dialog || dialog.dataset.identityUi === "1") return;
    var body = dialog.querySelector(".settings-body");
    if (!body) return;
    dialog.dataset.identityUi = "1";
    hideLegacyControls(dialog);

    var section = document.createElement("section");
    section.className = "settings-section identity-studio";
    section.innerHTML = '<div class="settings-section-title"><span class="settings-icon" aria-hidden="true">◆</span><div>' +
      '<h3>الهوية البصرية</h3><p>أربع هويات فاخرة — يُحفظ اختيارك على هذا الجهاز.</p></div></div>' +
      '<div class="appearance-field identity-field"><div class="appearance-buttons identity-options">' +
      order.map(function (id) {
        var p = presets[id];
        return '<button type="button" class="appearance-choice identity-choice" data-identity-choice="' + id + '" aria-pressed="' + (id === currentIdentity()) + '">' +
          '<span class="identity-swatch identity-swatch-' + p.key + (p.scheme === "dark" ? " identity-swatch-night" : "") + '" aria-hidden="true"><i></i></span>' +
          '<span class="identity-choice-copy"><strong>' + p.name + '</strong><small>' + p.note + '</small></span>' +
          '<span class="identity-check" aria-hidden="true">✓</span></button>';
      }).join("") + '</div></div>';

    body.insertBefore(section, body.firstChild);

    var refresh = function () {
      dialog.querySelectorAll("[data-identity-choice]").forEach(function (button) {
        button.setAttribute("aria-pressed", String(button.dataset.identityChoice === currentIdentity()));
      });
    };
    dialog.querySelectorAll("[data-identity-choice]").forEach(function (button) {
      button.addEventListener("click", function () {
        try { localStorage.setItem("ihsan_identity", button.dataset.identityChoice); } catch (error) {}
        apply();
        refresh();
        if (typeof toast === "function") toast("تم تفعيل هوية " + presets[currentIdentity()].name + ".");
      });
    });
    refresh();
  }

  try {
    new MutationObserver(function () { inject(); }).observe(document.body, { childList: true, subtree: true });
  } catch (error) {}
  document.addEventListener("DOMContentLoaded", inject);
  if (document.readyState !== "loading") inject();
})();
