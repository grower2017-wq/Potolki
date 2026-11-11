/* ==========================================================================
   STATYS Потолки — логика сайта
   Без зависимостей. Настройки: config.js, данные портфолио: data.js
   ========================================================================== */
(function () {
  'use strict';

  var C = window.SITE_CONFIG || {};
  var D = window.SITE_DATA || { projects: [], filters: [], videos: [] };
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function has(v) { return v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && !v.length); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function plural(n, f) {
    n = Math.abs(n) % 100; var n1 = n % 10;
    if (n > 10 && n < 20) return f[2];
    if (n1 > 1 && n1 < 5) return f[1];
    if (n1 === 1) return f[0];
    return f[2];
  }
  function icon(id, cls) {
    return '<svg class="ico ' + (cls || '') + '" aria-hidden="true"><use href="#i-' + id + '"/></svg>';
  }

  /* ---------- Настройки → разметка ---------- */

  function cfgValue(key) {
    if (key === 'tvTitle') return C.tvVideo && C.tvVideo.title;
    return C[key];
  }

  function linkHref(key) {
    var v;
    if (key === 'phone') {
      v = C.phone ? String(C.phone).replace(/[^\d+]/g, '') : '';
      return v ? 'tel:' + v : '';
    }
    if (key === 'email') return C.email ? 'mailto:' + C.email : '';
    return (C.links && C.links[key]) || '';
  }

  function hydrate() {
    $$('[data-if]').forEach(function (el) {
      if (has(cfgValue(el.getAttribute('data-if')))) el.hidden = false;
    });
    $$('[data-cfg]').forEach(function (el) {
      var v = cfgValue(el.getAttribute('data-cfg'));
      if (!has(v)) return;
      var unit = el.getAttribute('data-unit');
      el.textContent = unit ? v + ' ' + plural(Number(v), unit.split('|')) : v;
    });
    var anyChannel = false;
    $$('[data-link]').forEach(function (el) {
      var key = el.getAttribute('data-link');
      var href = linkHref(key);
      if (!href) return;
      el.setAttribute('href', href);
      el.hidden = false;
      if (key !== 'yandexReviews') anyChannel = true;
      if (!el.firstChild && key === 'phone') el.textContent = C.phone;
    });
    document.documentElement.classList.toggle('no-phone', !linkHref('phone'));
    var cl = $('#contact-list');
    if (cl && $$('[data-link]:not([hidden])', cl).length) cl.hidden = false;

    $$('[data-price]').forEach(function (el) {
      var v = C.typePrices && C.typePrices[el.getAttribute('data-price')];
      if (has(v)) { el.textContent = v; el.hidden = false; }
    });

    $$('.dotlist').forEach(function (list) {
      var first = true;
      Array.prototype.forEach.call(list.children, function (ch) {
        if (ch.hidden) return;
        ch.classList.toggle('is-first', first);
        first = false;
      });
    });

    if (C.measurePhoto) { var mp = $('#measure-photo'); if (mp) mp.src = C.measurePhoto; }
    window.__anyChannel = anyChannel;
  }

  /* ---------- Шапка, меню ---------- */

  function initHeader() {
    var header = $('#top-header');
    var burger = $('.burger');
    var menu = $('#mobile-menu');
    var up = $('#fab-up');
    var navLinks = $$('.nav a');
    var sections = navLinks.map(function (a) { return $(a.getAttribute('href')); });
    var ticking = false;

    function onScroll() {
      var y = window.scrollY || 0;
      header.classList.toggle('is-scrolled', y > 8);
      up.classList.toggle('is-visible', y > 900);
      var cur = -1;
      sections.forEach(function (s, i) {
        if (s && s.getBoundingClientRect().top <= 140) cur = i;
      });
      navLinks.forEach(function (a, i) { a.classList.toggle('is-active', i === cur); });
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
    }, { passive: true });
    onScroll();

    function setMenu(open) {
      burger.setAttribute('aria-expanded', open);
      burger.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
      menu.classList.toggle('is-open', open);
      document.documentElement.style.overflow = open ? 'hidden' : '';
    }
    burger.addEventListener('click', function () { setMenu(burger.getAttribute('aria-expanded') !== 'true'); });
    menu.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });
    window.addEventListener('resize', function () { if (window.innerWidth >= 1080) setMenu(false); });

    up.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }); });
  }

  /* ---------- Плавающая кнопка ---------- */

  function initFab() {
    var btn = $('#fab-btn'), menu = $('#fab-menu');
    function set(open) {
      menu.hidden = !open;
      btn.setAttribute('aria-expanded', open);
    }
    btn.addEventListener('click', function () {
      if (!window.__anyChannel) { $('#quiz').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' }); return; }
      set(menu.hidden);
    });
    document.addEventListener('click', function (e) {
      if (!menu.hidden && !e.target.closest('#fab')) set(false);
    });
    menu.addEventListener('click', function (e) { if (e.target.closest('a')) set(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') set(false); });
  }

  /* ---------- Появление при скролле ---------- */

  var io = null;
  function observeReveal(root) {
    var els = $$('.reveal:not(.is-in)', root);
    if (!('IntersectionObserver' in window) || reduceMotion) {
      els.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }
    if (!io) {
      io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
        });
      }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
    }
    els.forEach(function (el) { io.observe(el); });
  }

  /* ---------- Слайдер в hero ---------- */

  function initHeroSlider() {
    var root = $('#hero-slider');
    if (!root) return;
    var slides = $$('.hero-slider__slide', root);
    var dotsBox = $('.hero-slider__dots', root);
    var cur = 0, timer = null;
    slides.forEach(function (_, i) {
      var b = document.createElement('button');
      b.type = 'button'; b.setAttribute('aria-label', 'Фото ' + (i + 1));
      b.addEventListener('click', function () { go(i); restart(); });
      dotsBox.appendChild(b);
    });
    function go(i) {
      cur = (i + slides.length) % slides.length;
      slides.forEach(function (s, k) { s.classList.toggle('is-active', k === cur); });
      $$('button', dotsBox).forEach(function (b, k) { b.setAttribute('aria-current', k === cur); });
    }
    function restart() {
      clearInterval(timer);
      if (reduceMotion) return;
      timer = setInterval(function () { go(cur + 1); }, 5500);
    }
    go(0); restart();
    document.addEventListener('visibilitychange', function () { document.hidden ? clearInterval(timer) : restart(); });
  }

  /* ---------- Портфолио + лайтбокс ---------- */

  var lb = { dlg: null, p: null, i: 0 };

  function thumb(id) { return 'assets/img/thumbs/' + id + '.webp'; }
  function full(id) { return 'portfolio/' + id + '.jpg'; }

  function initWorks() {
    var grid = $('#works-grid'), filters = $('#filters');
    if (!grid) return;
    var projects = D.projects || [];

    (D.filters || []).forEach(function (f, idx) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'chip'; b.textContent = f.label;
      b.setAttribute('data-f', f.id); b.setAttribute('aria-pressed', idx === 0);
      filters.appendChild(b);
    });
    filters.addEventListener('click', function (e) {
      var b = e.target.closest('.chip'); if (!b) return;
      $$('.chip', filters).forEach(function (c) { c.setAttribute('aria-pressed', c === b); });
      var f = b.getAttribute('data-f');
      $$('.work', grid).forEach(function (w) {
        var tags = (w.getAttribute('data-tags') || '').split(' ');
        w.hidden = !(f === 'all' || tags.indexOf(f) !== -1);
      });
    });

    grid.innerHTML = projects.map(function (p, i) {
      var n = p.photos.length;
      var meta = [p.place, p.meta].filter(Boolean).join(' · ');
      return '<article class="work reveal" data-i="' + i + '" data-tags="' + esc(p.tags.join(' ')) + '">' +
        '<button type="button" class="work__img" aria-label="Открыть фото: ' + esc(p.title) + '">' +
        '<img src="' + thumb(p.photos[p.cover || 0]) + '" alt="' + esc(p.title) + '" loading="lazy" width="720" height="830">' +
        '<span class="work__badge">' + n + ' ' + plural(n, ['фото', 'фото', 'фото']) + '</span>' +
        '<span class="work__zoom">' + icon('zoom') + '</span></button>' +
        '<h3 class="work__title">' + esc(p.title) + '</h3>' +
        '<div class="work__meta">' + esc(meta) + '</div>' +
        '<p class="work__desc">' + esc(p.desc) + '</p></article>';
    }).join('');

    grid.addEventListener('click', function (e) {
      var w = e.target.closest('.work'); if (!w) return;
      openLightbox(projects[+w.getAttribute('data-i')], 0);
    });
    observeReveal(grid);
  }

  function initLightbox() {
    var dlg = lb.dlg = $('#lightbox');
    var img = $('#lb-img'), stage = $('#lb-stage');
    if (!dlg || typeof dlg.showModal !== 'function') return;

    $('#lb-close').addEventListener('click', function () { dlg.close(); });
    $('#lb-prev').addEventListener('click', function () { step(-1); });
    $('#lb-next').addEventListener('click', function () { step(1); });
    dlg.addEventListener('click', function (e) { if (e.target === dlg || e.target === stage) dlg.close(); });
    dlg.addEventListener('close', function () {
      document.documentElement.style.overflow = '';
      img.removeAttribute('src');
    });
    dlg.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') step(-1);
      if (e.key === 'ArrowRight') step(1);
    });

    var x0 = null;
    stage.addEventListener('pointerdown', function (e) { x0 = e.clientX; });
    stage.addEventListener('pointerup', function (e) {
      if (x0 === null) return;
      var dx = e.clientX - x0; x0 = null;
      if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
    });
    stage.addEventListener('pointercancel', function () { x0 = null; });

    $('#lb-thumbs').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-k]'); if (b) show(+b.getAttribute('data-k'));
    });
  }

  function step(d) { if (lb.p) show((lb.i + d + lb.p.photos.length) % lb.p.photos.length); }

  function show(i) {
    var p = lb.p; lb.i = i;
    var id = p.photos[i];
    var img = $('#lb-img');
    img.src = full(id);
    img.alt = p.title + ', фото ' + (i + 1) + ' из ' + p.photos.length;
    $('#lb-count').textContent = (i + 1) + ' / ' + p.photos.length;
    $$('#lb-thumbs button').forEach(function (b, k) {
      b.setAttribute('aria-current', k === i);
      if (k === i && b.scrollIntoView) b.scrollIntoView({ block: 'nearest', inline: 'center' });
    });
    [1, -1].forEach(function (d) {
      var n = new Image(); n.src = full(p.photos[(i + d + p.photos.length) % p.photos.length]);
    });
  }

  function openLightbox(p, i) {
    if (!lb.dlg || typeof lb.dlg.showModal !== 'function') { window.open(full(p.photos[i]), '_blank'); return; }
    lb.p = p;
    $('#lb-title').textContent = p.title;
    $('#lb-desc').textContent = p.desc;
    $('#lb-thumbs').innerHTML = p.photos.map(function (id, k) {
      return '<button type="button" data-k="' + k + '" aria-label="Фото ' + (k + 1) + '"><img src="' + thumb(id) + '" alt="" loading="lazy"></button>';
    }).join('');
    var multi = p.photos.length > 1;
    $('#lb-prev').hidden = !multi; $('#lb-next').hidden = !multi;
    document.documentElement.style.overflow = 'hidden';
    lb.dlg.showModal();
    show(i);
  }

  /* ---------- Видео ---------- */

  function initVideos() {
    var box = $('#reels');
    var list = D.videos || [];
    if (!box) return;
    if (!list.length) { var s = $('#video'); if (s) s.hidden = true; return; }

    box.innerHTML = list.map(function (v, i) {
      return '<button type="button" class="reel reveal" data-i="' + i + '" aria-label="Смотреть видео: ' + esc(v.title) + '">' +
        '<span class="reel__img"><img src="' + v.poster + '" alt="" loading="lazy" width="464" height="848">' +
        '<span class="reel__play">' + icon('play') + '</span><span class="reel__time">' + esc(v.dur || '') + '</span></span>' +
        '<span class="reel__cap">' + esc(v.title) + '</span></button>';
    }).join('');
    observeReveal(box);

    var dlg = $('#vplayer'), stage = $('#vp-stage');
    if (!dlg || typeof dlg.showModal !== 'function') return;
    function closeV() { dlg.close(); }
    $('#vp-close').addEventListener('click', closeV);
    dlg.addEventListener('click', function (e) { if (e.target === dlg || e.target === stage) closeV(); });
    dlg.addEventListener('close', function () { stage.innerHTML = ''; document.documentElement.style.overflow = ''; });

    box.addEventListener('click', function (e) {
      var b = e.target.closest('.reel'); if (!b) return;
      var v = list[+b.getAttribute('data-i')];
      $('#vp-title').textContent = v.title;
      stage.innerHTML = '<video controls autoplay playsinline preload="auto" poster="' + v.poster + '" src="' + v.src + '"></video>';
      document.documentElement.style.overflow = 'hidden';
      dlg.showModal();
    });
  }

  /* ---------- Мастера, ТВ, отзывы ---------- */

  function initTeam() {
    var team = $('#team'); if (!team) return;
    var grid = $('#team-grid');
    var masters = C.masters || [];
    var hasMasters = masters.length > 0;
    if (hasMasters) {
      grid.innerHTML = masters.map(function (m) {
        return '<figure class="master reveal"><div class="master__img"><img src="' + esc(m.photo) + '" alt="' +
          esc(m.name ? 'Мастер ' + m.name : 'Мастер по монтажу потолков') + '" loading="lazy"></div>' +
          (m.name ? '<figcaption><div class="master__name">' + esc(m.name) + '</div>' : '<figcaption>') +
          (m.role ? '<div class="master__role">' + esc(m.role) + '</div>' : '') + '</figcaption></figure>';
      }).join('');
      grid.hidden = false;
      observeReveal(grid);
    }

    var tv = C.tvVideo || {};
    var tvBox = $('#tv'), player = $('#tv-player');
    var hasTv = has(tv.src);
    if (hasTv) {
      player.innerHTML = '<video controls playsinline preload="metadata"' + (tv.poster ? ' poster="' + esc(tv.poster) + '"' : '') +
        ' src="' + esc(tv.src) + '"></video>';
    } else if (!C.showDevNotes) {
      tvBox.hidden = true;
    }
    if (!hasMasters && !hasTv && !C.showDevNotes) team.hidden = true;
    if (!hasMasters) { var sh = $('.section-head', team); if (sh && !hasTv && C.showDevNotes) { /* заголовок остаётся */ } }
  }

  function initReviews() {
    var box = $('#reviews-embed'); if (!box) return;
    var rv = $('#reviews');
    var w = C.reviewsWidget;
    if (w && has(w.app)) {
      box.innerHTML = '';
      var div = document.createElement('div');
      div.className = 'sw-app';
      div.setAttribute('data-app', w.app);
      div.setAttribute('data-sw-type', w.type || 'review_yandex_uslugi');
      box.appendChild(div);
      var sc = document.createElement('script');
      sc.src = 'https://res.smartwidgets.ru/app.js'; sc.async = true;
      box.appendChild(sc);
    } else if (!C.showDevNotes) {
      box.remove();
      rv.style.gridTemplateColumns = '1fr';
    }
  }

  /* ---------- Телефон: маска ---------- */

  function formatPhone(raw) {
    var d = raw.replace(/\D/g, '');
    if (!d) return '';
    if (d[0] === '8') d = '7' + d.slice(1);
    if (d[0] !== '7') d = '7' + d;
    d = d.slice(0, 11);
    var out = '+7';
    if (d.length > 1) out += ' (' + d.slice(1, 4);
    if (d.length >= 5) out += ') ' + d.slice(4, 7);
    if (d.length >= 8) out += '-' + d.slice(7, 9);
    if (d.length >= 10) out += '-' + d.slice(9, 11);
    return out;
  }
  function phoneOk(v) { return v.replace(/\D/g, '').length === 11; }

  document.addEventListener('input', function (e) {
    var t = e.target;
    if (t.matches && t.matches('input[type="tel"]')) {
      var inputType = e.inputType || '';
      if (inputType.indexOf('delete') === 0) { if (t.value === '+7' || t.value === '+7 (') t.value = ''; return; }
      t.value = formatPhone(t.value);
    }
    if (t.matches && t.matches('[aria-invalid="true"]')) { t.removeAttribute('aria-invalid'); var er = t.closest('.field'); if (er) { var m = $('.field__err', er); if (m) m.textContent = ''; } }
  });

  /* ---------- Отправка заявок ---------- */

  function utm() {
    var out = {};
    try {
      new URLSearchParams(location.search).forEach(function (v, k) {
        if (/^(utm_|yclid|gclid)/.test(k)) out[k] = v.slice(0, 120);
      });
    } catch (e) { /* ignore */ }
    return out;
  }

  function setErr(form, name, msg) {
    var el = $('[data-err="' + name + '"]', form);
    if (el) el.textContent = msg || '';
    var inp = $('[name="' + name + '"]', form);
    if (inp && inp.type !== 'checkbox') { msg ? inp.setAttribute('aria-invalid', 'true') : inp.removeAttribute('aria-invalid'); }
  }

  function validate(form) {
    var ok = true, first = null;
    var name = form.elements.name.value.trim();
    var phone = form.elements.phone.value.trim();
    setErr(form, 'name'); setErr(form, 'phone'); setErr(form, 'consent');
    if (name.length < 2) { setErr(form, 'name', 'Укажите имя'); ok = false; first = first || form.elements.name; }
    if (!phoneOk(phone)) { setErr(form, 'phone', 'Укажите телефон полностью, 11 цифр'); ok = false; first = first || form.elements.phone; }
    if (!form.elements.consent.checked) { setErr(form, 'consent', 'Нужно согласие на обработку персональных данных'); ok = false; first = first || form.elements.consent; }
    if (first) first.focus();
    return ok;
  }

  function okHtml() {
    var when = '';
    if (has(C.responseMinutes)) when += ' в течение ' + C.responseMinutes + ' ' + plural(Number(C.responseMinutes), ['минуты', 'минут', 'минут']);
    if (has(C.workHours)) when += ' в рабочее время (' + C.workHours + ')';
    return '<div class="form-ok">' + icon('ok') + '<h3>Заявка принята</h3><p>Расчёт придёт в выбранный канал' + esc(when) + '.</p></div>';
  }

  function send(form, extra) {
    var msg = $('.form-msg', form);
    if (msg) msg.textContent = '';
    if (!validate(form)) return Promise.resolve(false);
    var btn = $('button[type="submit"]', form);
    var label = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = 'Отправляем…'; }

    var payload = {
      name: form.elements.name.value.trim(),
      phone: form.elements.phone.value.trim(),
      channel: (form.querySelector('input[name="channel"]:checked') || {}).value || '',
      source: form.getAttribute('data-source') || 'form',
      quiz: extra || null,
      page: location.href.split('#')[0],
      utm: utm(),
      website: form.elements.website ? form.elements.website.value : ''
    };

    return fetch(C.formEndpoint || 'send.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok || !j.ok) throw new Error((j && j.error) || 'http_' + r.status);
        return true;
      });
    }).catch(function () {
      if (btn) { btn.disabled = false; btn.textContent = label; }
      if (msg) {
        msg.textContent = 'Не удалось отправить заявку. Попробуйте ещё раз' +
          (C.phone ? ' или позвоните по номеру ' + C.phone : '') + '.';
      }
      return false;
    });
  }

  function initLeadForm() {
    var form = $('#lead-form'); if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      send(form, null).then(function (ok) {
        if (ok) form.innerHTML = okHtml();
      });
    });
  }

  /* ---------- Квиз ---------- */

  var OPTIONS = {
    object: ['Квартира', 'Частный дом', 'Офис или коммерческое помещение', 'Другое'],
    rooms: ['Гостиная', 'Спальня', 'Кухня', 'Детская', 'Ванная и санузел', 'Коридор и прихожая', 'Балкон или лоджия', 'Весь объект'],
    type: ['Матовый', 'Глянцевый', 'Сатиновый', 'Тканевый', 'Двухуровневый', 'Парящий', 'Звёздное небо или фотопечать', 'Подберёт мастер'],
    light: ['Точечные светильники', 'Световые линии', 'Трековая система', 'Подсветка по периметру', 'Люстра или подвесные светильники', 'Подскажет мастер']
  };
  var STEPS = [
    { key: 'object', label: 'Объект', title: 'Где ставим потолок', multi: false },
    { key: 'rooms', label: 'Помещения', title: 'Какие помещения', multi: true },
    { key: 'type', label: 'Вид потолка', title: 'Какой вид потолка', multi: false },
    { key: 'light', label: 'Свет', title: 'Какой свет нужен', multi: true },
    { key: 'contact', label: 'Контакты', title: 'Куда прислать расчёт' }
  ];
  var DASHED = { 'Подберёт мастер': 1, 'Подскажет мастер': 1 };

  var Q = { box: null, idx: 0, pre: false, a: { object: '', rooms: [], area: '', type: '', light: [] } };

  function qSteps() { return STEPS.filter(function (s) { return !(Q.pre && s.key === 'type'); }); }

  function qRender(focus) {
    var steps = qSteps();
    if (Q.idx >= steps.length) Q.idx = steps.length - 1;
    var s = steps[Q.idx];
    var total = steps.length;
    var html = '<div class="quiz__top"><span>Шаг ' + (Q.idx + 1) + ' из ' + total + '</span><span>' + esc(s.label) + '</span></div>' +
      '<div class="quiz__bar"><i style="width:' + ((Q.idx + 1) / total * 100) + '%"></i></div>';

    if (Q.pre) {
      html += '<div class="quiz__chip"><span>Вид потолка: ' + esc(Q.a.type) + '</span><button type="button" data-q="unpre">изменить</button></div>';
    }

    if (s.key === 'contact') {
      var recap = [Q.a.object, Q.a.rooms.join(', '), Q.a.area ? Q.a.area + ' м²' : '', Q.a.type, Q.a.light.join(', ')].filter(Boolean).join(' · ');
      html += '<form id="quiz-form" novalidate data-source="quiz"><fieldset><legend>' + esc(s.title) + '</legend>' +
        (recap ? '<p class="note" style="margin:-8px 0 18px">' + esc(recap) + '</p>' : '') +
        '<div class="field"><label for="qf-name">Имя</label><input class="input" id="qf-name" name="name" type="text" autocomplete="name" required maxlength="80" placeholder="Как к вам обращаться"><div class="field__err" data-err="name"></div></div>' +
        '<div class="field"><label for="qf-phone">Телефон</label><input class="input" id="qf-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" required placeholder="+7 (___) ___-__-__"><div class="field__err" data-err="phone"></div></div>' +
        '<div class="field"><span class="label" id="qf-ch-l">Куда прислать расчёт</span><div class="pills" role="radiogroup" aria-labelledby="qf-ch-l">' +
        ['Звонок', 'MAX', 'SMS', 'Telegram'].map(function (c, i) {
          return '<label class="pill"><input type="radio" name="channel" value="' + c + '"' + (i === 0 ? ' checked' : '') + '><span>' + c + '</span></label>';
        }).join('') + '</div></div>' +
        '<div class="hp" aria-hidden="true"><label>Не заполняйте <input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>' +
        '<label class="consent"><input type="checkbox" name="consent" required><span>Согласен на обработку персональных данных. Данные хранятся в РФ. <a href="privacy.html" target="_blank" rel="noopener">Политика обработки данных</a></span></label>' +
        '<div class="field__err" data-err="consent" style="margin-top:8px"></div>' +
        '</fieldset><div class="quiz__nav"><button type="button" class="btn" data-q="back">Назад</button><button type="submit" class="btn btn--primary">Рассчитать стоимость</button></div>' +
        '<div class="form-msg" role="alert"></div></form>';
    } else {
      var multi = s.multi, val = Q.a[s.key];
      html += '<fieldset><legend>' + esc(s.title) + (multi ? '<span class="sr-only">. Можно выбрать несколько вариантов</span>' : '') + '</legend><div class="options">' +
        OPTIONS[s.key].map(function (o, i) {
          var on = multi ? val.indexOf(o) !== -1 : val === o;
          return '<label class="opt' + (multi ? ' opt--multi' : '') + (DASHED[o] ? ' opt--dashed' : '') + '"><input type="' + (multi ? 'checkbox' : 'radio') +
            '" name="q-' + s.key + '" value="' + esc(o) + '"' + (on ? ' checked' : '') + '><span>' + esc(o) + '</span></label>';
        }).join('') + '</div>';
      if (s.key === 'rooms') {
        html += '<div class="quiz__extra field"><label for="q-area">Примерная площадь, м² (по желанию)</label><input class="input" id="q-area" name="area" type="text" inputmode="decimal" maxlength="8" placeholder="Например, 45" value="' + esc(Q.a.area) + '"></div>';
      }
      html += '</fieldset><div class="quiz__nav"><button type="button" class="btn" data-q="back"' + (Q.idx === 0 ? ' disabled' : '') + '>Назад</button>' +
        '<button type="button" class="btn btn--primary" data-q="next"' + (qValid(s) ? '' : ' disabled') + '>Далее</button></div>';
    }
    Q.box.innerHTML = html;
    if (focus) {
      var f = $('#qf-name', Q.box);
      if (f) f.focus({ preventScroll: true });
    }
  }

  function qValid(s) {
    var v = Q.a[s.key];
    return Array.isArray(v) ? v.length > 0 : !!v;
  }

  function initQuiz() {
    Q.box = $('#quiz-box'); if (!Q.box) return;
    qRender(false);

    Q.box.addEventListener('change', function (e) {
      var t = e.target;
      if (!t.name || t.name.indexOf('q-') !== 0) return;
      var key = t.name.slice(2);
      var s = STEPS.filter(function (x) { return x.key === key; })[0];
      if (s.multi) {
        var arr = Q.a[key], i = arr.indexOf(t.value);
        if (t.checked && i === -1) arr.push(t.value);
        if (!t.checked && i !== -1) arr.splice(i, 1);
      } else {
        Q.a[key] = t.value;
      }
      var next = $('[data-q="next"]', Q.box);
      if (next) next.disabled = !qValid(s);
    });

    Q.box.addEventListener('input', function (e) {
      if (e.target.name === 'area') {
        e.target.value = e.target.value.replace(/[^\d.,]/g, '').slice(0, 8);
        Q.a.area = e.target.value;
      }
    });

    Q.box.addEventListener('click', function (e) {
      var b = e.target.closest('[data-q]'); if (!b) return;
      var act = b.getAttribute('data-q');
      if (act === 'next') { Q.idx++; qRender(true); }
      if (act === 'back') { Q.idx = Math.max(0, Q.idx - 1); qRender(false); }
      if (act === 'unpre') {
        Q.pre = false; Q.a.type = '';
        Q.idx = STEPS.map(function (s) { return s.key; }).indexOf('type');
        qRender(false);
      }
    });

    Q.box.addEventListener('submit', function (e) {
      var form = e.target.closest('#quiz-form'); if (!form) return;
      e.preventDefault();
      send(form, {
        object: Q.a.object, rooms: Q.a.rooms, area: Q.a.area, type: Q.a.type, light: Q.a.light
      }).then(function (ok) { if (ok) Q.box.innerHTML = okHtml(); });
    });

    $$('[data-quiz-type]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.preventDefault();
        Q.a.type = el.getAttribute('data-quiz-type');
        Q.pre = true; Q.idx = 0;
        qRender(false);
        var target = $('#quiz');
        target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
      });
    });
  }

  /* ---------- Запуск ---------- */

  function init() {
    hydrate();
    initHeader();
    initFab();
    initHeroSlider();
    initWorks();
    initLightbox();
    initVideos();
    initTeam();
    initReviews();
    initLeadForm();
    initQuiz();
    observeReveal(document);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
