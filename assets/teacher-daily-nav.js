/* Teacher daily navigation repair: keep attendance and Quran tracking visible. */
(() => {
  const teacherOnly = () => document.documentElement.dataset.role === 'teacher';
  const repair = () => {
    if (!teacherOnly()) return;
    const nav = document.getElementById('nav');
    if (!nav) return;
    const ensure = (id, label, iconPath) => {
      let button = nav.querySelector('[data-page="' + id + '"]');
      if (button) {
        const span = button.querySelector('span');
        if (span && span.textContent !== label) span.textContent = label;
        button.title = label;
        return;
      }
      let group = nav.querySelector('.nav-group');
      if (!group) {
        group = document.createElement('div');
        group.className = 'nav-group';
        nav.appendChild(group);
      }
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.act = 'nav';
      b.dataset.page = id;
      b.title = label;
      b.innerHTML = '<span class="teacher-daily-nav-icon" aria-hidden="true">' + iconPath + '</span><span></span>';
      b.querySelector('span:last-child').textContent = label;
      group.appendChild(b);
    };
    ensure('attendance', 'الحضور', '<svg class="i" viewBox="0 0 24 24"><path d="M5 12l4 4L19 6"/></svg>');
    ensure('tracking', 'الحفظ والمراجعة', '<svg class="i" viewBox="0 0 24 24"><path d="M4 5h16v15H4zM8 9h8M8 13h6"/></svg>');
    const bottom = document.getElementById('bottomNav');
    if (bottom && !bottom.querySelector('[data-page="tracking"]')) {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.act = 'nav';
      b.dataset.page = 'tracking';
      b.innerHTML = '<span aria-hidden="true">۞</span><span></span>';
      b.querySelector('span:last-child').textContent = 'الحفظ';
      const more = bottom.querySelector('[data-act="more"]');
      bottom.insertBefore(b, more || null);
    }
  };
  const titleRepair = () => {
    if (!teacherOnly()) return;
    const page = document.documentElement.dataset.page;
    const title = document.getElementById('pgTitle');
    if (!title) return;
    if (page === 'tracking' && title.textContent !== 'الحفظ والمراجعة') title.textContent = 'الحفظ والمراجعة';
    if (page === 'attendance' && title.textContent !== 'الحضور') title.textContent = 'الحضور';
  };
  const start = () => {
    repair();
    titleRepair();
    const nav = document.getElementById('nav');
    if (nav) new MutationObserver(repair).observe(nav, { childList: true, subtree: true });
    const title = document.getElementById('pgTitle');
    if (title) new MutationObserver(titleRepair).observe(title, { childList: true, characterData: true, subtree: true });
    const app = document.getElementById('appView');
    if (app) new MutationObserver(() => { repair(); titleRepair(); }).observe(app, { attributes: true, subtree: true, attributeFilter: ['class'] });
    document.addEventListener('click', e => {
      const b = e.target.closest('[data-page="tracking"],[data-page="attendance"]');
      if (b) setTimeout(titleRepair, 0);
    });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();