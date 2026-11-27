// Apply the saved visual identity before the stylesheet paints, so there is no flash.
(function () {
  var presets = {
    "ruby-night": { scheme: "dark", color: "#30091a" },
    "emerald-night": { scheme: "dark", color: "#071d16" },
    "ruby-day": { scheme: "light", color: "#fdf5f2" },
    "emerald-day": { scheme: "light", color: "#f4f7f2" }
  };
  var id = "emerald-day";
  try {
    var stored = localStorage.getItem("ihsan_identity");
    if (presets[stored]) id = stored;
  } catch (error) {}
  var preset = presets[id];
  var root = document.documentElement;
  root.setAttribute("data-identity", id);
  root.setAttribute("data-appearance", preset.scheme);
  root.setAttribute("data-appearance-palette", id);
  root.style.colorScheme = preset.scheme;
  var schemeMeta = document.querySelector('meta[name="color-scheme"]');
  if (schemeMeta) schemeMeta.setAttribute("content", preset.scheme);
  var themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) themeMeta.setAttribute("content", preset.color);
})();
