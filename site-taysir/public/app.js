(() => {
  if (window.TAYSIR_HERO_SRC) document.querySelectorAll("[data-ai-hero]").forEach(img => { img.src = window.TAYSIR_HERO_SRC; });
  const toggle = document.querySelector('.menu-toggle');
  const nav = document.querySelector('#site-nav');
  toggle?.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'إغلاق القائمة' : 'فتح القائمة');
  });
  nav?.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
    nav.classList.remove('open');
    toggle?.setAttribute('aria-expanded', 'false');
  }));
  const form = document.querySelector('#interest-form');
  form?.addEventListener('submit', async event => {
    event.preventDefault();
    const data = new FormData(form);
    const lines = [
      'السلام عليكم ورحمة الله وبركاته،',
      'أرغب في التواصل مع أكاديمية الإحسان.',
      'نوع الاهتمام: ' + String(data.get('interest') || ''),
      data.get('name') ? 'الاسم: ' + String(data.get('name')) : '',
      data.get('message') ? 'التفاصيل: ' + String(data.get('message')) : '',
      'أرجو إرشادي إلى الخطوة التالية. جزاكم الله خيراً.'
    ].filter(Boolean);
    const message = lines.join('\n');
    const feedback = document.querySelector('#form-feedback');
    try {
      await navigator.clipboard.writeText(message);
      feedback.textContent = 'نُسخت الرسالة. أرسلها عبر قناة التواصل الرسمية للأكاديمية.';
    } catch {
      const area = document.createElement('textarea');
      area.value = message;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const copied = document.execCommand('copy');
      area.remove();
      feedback.textContent = copied ? 'نُسخت الرسالة. أرسلها عبر قناة التواصل الرسمية للأكاديمية.' : 'تعذر النسخ تلقائياً؛ يمكنك إعادة المحاولة من متصفح يدعم النسخ.';
    }
  });
  const year = document.querySelector('#year');
  if (year) year.textContent = new Date().getFullYear();
})();