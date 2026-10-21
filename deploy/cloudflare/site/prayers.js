(() => {
  "use strict";
  const entryPrayers = [
    ["حيّاك الله في رحاب العلم والإحسان", "نسأل الله أن يبارك في يومك، وينير قلبك بالقرآن، ويجعلك مفتاحًا للخير، مبارك الخطى والأثر."],
    ["أهلًا بك في بساتين الإحسان", "اللهم افتح له أبواب العلم النافع، وارزقه فهمًا عنك وعن رسولك ﷺ، واجعل ما يتعلمه نورًا يهديه إلى العمل الصالح."],
    ["بسم الله نبدأ، وعلى الله نتوكّل", "اللهم بارك في وقته وسعيه، وعلّمه ما ينفعه، وانفعه بما علّمته، وزده علمًا وهدًى وتوفيقًا."],
    ["مرحبًا بك في رحلتك مع القرآن والعلم", "اللهم اجعل القرآن ربيع قلبه ونور صدره، وارزقه الإخلاص والقبول، واجعل علمه سببًا في حسن خلقه ونفع الناس."]
  ];
  const exitPrayers = [
    "تقبّل الله منك ما تعلّمت وعملت، وبارك في وقتك، وجعل القرآن نورًا لك وحجةً لك لا عليك.",
    "اللهم بارك في سعيه، واغفر تقصيره، وثبّت قلبه على طاعتك، واجعل القرآن رفيقه في الدنيا والآخرة.",
    "إلى لقاء قريب بإذن الله. لا تنسَ وردك من القرآن ونصيبك من الذكر. اللهم اجعل علمه نافعًا وعمله صالحًا.",
    "حفظك الله أينما كنت، وشرح صدرك للخير، ورفع بالقرآن درجتك، وجعل لك أثرًا طيبًا أينما حللت."
  ];
  let dialogOpen = false;
  const pick = list => list[Math.floor(Math.random() * list.length)];
  const style = document.createElement("style");
  style.textContent = `
    .ihsan-prayer-dialog{width:min(520px,calc(100% - 32px));border:1px solid var(--line,#bfe5d1);border-radius:24px;padding:0;color:var(--ink,#0d2b22);background:var(--surface,#fff);box-shadow:0 24px 80px #102b2040}
    .ihsan-prayer-dialog::backdrop{background:#10251dcc;backdrop-filter:blur(5px)}
    .ihsan-prayer-inner{padding:clamp(22px,5vw,34px);text-align:center}
    .ihsan-prayer-mark{display:grid;place-items:center;width:54px;height:54px;margin:0 auto 15px;border-radius:18px;background:var(--mint,#ddfaed);color:var(--green,#087f5b);font-size:27px}
    .ihsan-prayer-kicker{font-size:12px;letter-spacing:.04em;color:var(--muted,#456b5a);margin:0 0 8px}
    .ihsan-prayer-title{font-size:clamp(21px,4vw,27px);line-height:1.5;margin:0 0 12px}
    .ihsan-prayer-text{font-size:16px;line-height:2.05;margin:0 auto 23px;max-width:42ch}
    .ihsan-prayer-actions{display:flex;flex-wrap:wrap;gap:10px;justify-content:center}
    .ihsan-prayer-actions button{min-height:44px;border-radius:12px;padding:10px 18px;cursor:pointer;font:inherit;font-weight:600}
    .ihsan-prayer-primary{border:1px solid var(--green,#087f5b);background:var(--green,#087f5b);color:white}
    .ihsan-prayer-secondary{border:1px solid var(--line,#bfe5d1);background:transparent;color:inherit}
    @media(prefers-reduced-motion:no-preference){.ihsan-prayer-dialog[open]{animation:ihsan-prayer-in .2s ease-out}@keyframes ihsan-prayer-in{from{opacity:0;transform:translateY(8px) scale(.99)}to{opacity:1;transform:translateY(0) scale(1)}}}
    .ihsan-reduced-motion .ihsan-prayer-dialog[open]{animation:none}
  `;
  document.head.appendChild(style);

  function showPrayer({title, text, icon = "✦", primary, secondary, onPrimary, onSecondary}) {
    if (dialogOpen) return Promise.resolve(false);
    dialogOpen = true;
    const existing = document.getElementById("ihsan-prayer-dialog");
    existing?.remove();
    const dialog = document.createElement("dialog");
    dialog.id = "ihsan-prayer-dialog";
    dialog.className = "ihsan-prayer-dialog";
    const inner = document.createElement("div");
    inner.className = "ihsan-prayer-inner";
    const mark = document.createElement("div");
    mark.className = "ihsan-prayer-mark";
    mark.setAttribute("aria-hidden", "true");
    mark.textContent = icon;
    const kicker = document.createElement("p");
    kicker.className = "ihsan-prayer-kicker";
    kicker.textContent = "أكاديمية الإحسان في بناء الإنسان";
    const heading = document.createElement("h2");
    heading.className = "ihsan-prayer-title";
    heading.textContent = title;
    const paragraph = document.createElement("p");
    paragraph.className = "ihsan-prayer-text";
    paragraph.textContent = text;
    const actions = document.createElement("div");
    actions.className = "ihsan-prayer-actions";
    const primaryButton = document.createElement("button");
    primaryButton.type = "button";
    primaryButton.className = "ihsan-prayer-primary";
    primaryButton.textContent = primary;
    const secondaryButton = document.createElement("button");
    secondaryButton.type = "button";
    secondaryButton.className = "ihsan-prayer-secondary";
    secondaryButton.textContent = secondary;
    actions.append(primaryButton, secondaryButton);
    inner.append(mark, kicker, heading, paragraph, actions);
    dialog.append(inner);
    document.body.append(dialog);
    return new Promise(resolve => {
      let finished = false;
      const finish = async usePrimary => {
        if (finished) return;
        finished = true;
        try { if (dialog.open) dialog.close(); } catch {}
        dialog.remove();
        dialogOpen = false;
        try {
          if (usePrimary) await onPrimary?.();
          else await onSecondary?.();
        } finally {
          resolve(usePrimary);
        }
      };
      primaryButton.addEventListener("click", () => finish(true));
      secondaryButton.addEventListener("click", () => finish(false));
      dialog.addEventListener("cancel", event => { event.preventDefault(); finish(false); });
      dialog.addEventListener("click", event => { if (event.target === dialog) finish(false); });
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
      primaryButton.focus();
    });
  }

  const originalStart = start;
  start = async function(...args) {
    const [title, text] = pick(entryPrayers);
    await showPrayer({
      title, text, icon: "☀",
      primary: "ابدأ رحلتك",
      secondary: "لاحقًا",
    });
    return originalStart.apply(this, args);
  };

})();
