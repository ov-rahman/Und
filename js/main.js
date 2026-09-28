/* Better Call Rahman — сценарии страницы: слайдер, появление блоков, счётчики, отзывы, золотая пыль */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Слайдер ---------- */

  function initSlider(root) {
    var slides = [].slice.call(root.querySelectorAll('.slide'));
    if (slides.length < 2) return;

    var dots = [].slice.call(root.querySelectorAll('.slider__dot'));
    var current = root.querySelector('[data-slider-current]');
    var bar = root.querySelector('.slider__progress span');
    var interval = 7000;
    var fade = 1800;
    var index = 0;
    var timer = null;
    var paused = false;
    var remaining = interval;
    var startedAt = 0;

    function pad(n) {
      return (n < 10 ? '0' : '') + n;
    }

    function resetBar() {
      if (!bar) return;
      bar.style.transition = 'none';
      bar.style.transform = 'scaleX(0)';
      void bar.offsetWidth;
    }

    function startTimer(ms) {
      clearTimeout(timer);
      if (reduceMotion) return;
      startedAt = Date.now();
      remaining = ms;
      if (bar) {
        bar.style.transition = 'transform ' + ms + 'ms linear';
        bar.style.transform = 'scaleX(1)';
      }
      timer = setTimeout(function () {
        show(index + 1);
      }, ms);
    }

    function show(i) {
      var next = (i + slides.length) % slides.length;
      if (next === index) return;

      var prev = slides[index];
      prev.classList.remove('is-active');
      prev.classList.add('is-leaving');
      prev.setAttribute('aria-hidden', 'true');
      setTimeout(function () {
        prev.classList.remove('is-leaving');
      }, fade + 100);

      index = next;
      slides[index].classList.add('is-active');
      slides[index].setAttribute('aria-hidden', 'false');

      dots.forEach(function (dot, k) {
        dot.setAttribute('aria-current', k === index ? 'true' : 'false');
      });
      if (current) current.textContent = pad(index + 1);

      resetBar();
      if (paused) {
        remaining = interval;
      } else {
        startTimer(interval);
      }
    }

    function pause() {
      if (paused) return;
      paused = true;
      clearTimeout(timer);
      remaining = Math.max(0, remaining - (Date.now() - startedAt));
      if (bar) {
        var matrix = getComputedStyle(bar).transform;
        bar.style.transition = 'none';
        bar.style.transform = matrix === 'none' ? 'scaleX(0)' : matrix;
      }
    }

    function resume() {
      if (!paused) return;
      paused = false;
      startTimer(remaining);
    }

    dots.forEach(function (dot, k) {
      dot.addEventListener('click', function () {
        show(k);
      });
    });

    var prevBtn = root.querySelector('[data-slider-prev]');
    var nextBtn = root.querySelector('[data-slider-next]');
    if (prevBtn) prevBtn.addEventListener('click', function () { show(index - 1); });
    if (nextBtn) nextBtn.addEventListener('click', function () { show(index + 1); });

    root.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') show(index - 1);
      if (e.key === 'ArrowRight') show(index + 1);
    });

    root.addEventListener('mouseenter', pause);
    root.addEventListener('mouseleave', resume);
    root.addEventListener('focusin', pause);
    root.addEventListener('focusout', function (e) {
      if (!root.contains(e.relatedTarget)) resume();
    });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) pause();
      else resume();
    });

    /* свайп на телефоне */
    var touchX = null;
    root.addEventListener('touchstart', function (e) {
      touchX = e.touches[0].clientX;
    }, { passive: true });
    root.addEventListener('touchend', function (e) {
      if (touchX === null) return;
      var dx = e.changedTouches[0].clientX - touchX;
      if (Math.abs(dx) > 40) show(index + (dx < 0 ? 1 : -1));
      touchX = null;
    });

    startTimer(interval);
  }

  /* ---------- Счётчики в бухгалтерской книге ---------- */

  function formatNumber(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  function countUp(el) {
    var target = parseInt(el.getAttribute('data-count'), 10);
    if (isNaN(target) || reduceMotion) return;
    var duration = 2600;
    var start = null;
    function step(ts) {
      if (start === null) start = ts;
      var t = Math.min(1, (ts - start) / duration);
      var eased = 1 - Math.pow(1 - t, 3);
      el.textContent = formatNumber(Math.round(target * eased));
      if (t < 1) requestAnimationFrame(step);
    }
    el.textContent = '0';
    requestAnimationFrame(step);
  }

  /* ---------- Плавное появление блоков ---------- */

  function initReveal() {
    var items = [].slice.call(document.querySelectorAll('[data-reveal]'));
    var counters = [].slice.call(document.querySelectorAll('[data-count]'));

    if (!('IntersectionObserver' in window) || reduceMotion) {
      items.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    items.forEach(function (el) { io.observe(el); });

    var countIo = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        countUp(entry.target);
        countIo.unobserve(entry.target);
      });
    }, { threshold: 0.6 });
    counters.forEach(function (el) { countIo.observe(el); });
  }

  /* ---------- Отзывы сменяют друг друга ---------- */

  function initQuotes(root) {
    var quotes = [].slice.call(root.querySelectorAll('.quote'));
    if (quotes.length < 2 || reduceMotion) return;
    var i = 0;
    var hovered = false;
    root.addEventListener('mouseenter', function () { hovered = true; });
    root.addEventListener('mouseleave', function () { hovered = false; });
    setInterval(function () {
      if (hovered || document.hidden) return;
      quotes[i].classList.remove('is-active');
      i = (i + 1) % quotes.length;
      quotes[i].classList.add('is-active');
    }, 8000);
  }

  /* ---------- Золотая пыль в свете лампы (шапка) ---------- */

  function initDust(canvas) {
    if (reduceMotion || !canvas.getContext) return;
    var ctx = canvas.getContext('2d');
    var header = canvas.parentElement;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = 0;
    var h = 0;
    var motes = [];
    var running = false;
    var raf = null;

    function resize() {
      w = header.clientWidth;
      h = header.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function makeMote(initial) {
      return {
        x: Math.random() * w,
        y: initial ? Math.random() * h : h + 6,
        r: 0.4 + Math.random() * 1.5,
        vy: 0.05 + Math.random() * 0.16,
        drift: Math.random() * Math.PI * 2,
        twinkle: Math.random() * Math.PI * 2
      };
    }

    function frame() {
      ctx.clearRect(0, 0, w, h);
      for (var k = 0; k < motes.length; k++) {
        var m = motes[k];
        m.y -= m.vy;
        m.drift += 0.004;
        m.twinkle += 0.02;
        m.x += Math.sin(m.drift) * 0.12;
        if (m.y < -6) motes[k] = makeMote(false);
        var alpha = 0.18 + 0.32 * (0.5 + 0.5 * Math.sin(m.twinkle));
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(230, 204, 150,' + alpha.toFixed(3) + ')';
        ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    }

    function start() {
      if (running) return;
      running = true;
      raf = requestAnimationFrame(frame);
    }

    function stop() {
      running = false;
      cancelAnimationFrame(raf);
    }

    resize();
    for (var n = 0; n < 48; n++) motes.push(makeMote(true));
    window.addEventListener('resize', resize);

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting && !document.hidden) start();
        else stop();
      }).observe(header);
    } else {
      start();
    }

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stop();
      else start();
    });
  }

  /* ---------- Запуск ---------- */

  var slider = document.querySelector('.slider');
  if (slider) initSlider(slider);

  var testimonials = document.querySelector('.testimonials');
  if (testimonials) initQuotes(testimonials);

  var dust = document.querySelector('.header__dust');
  if (dust) initDust(dust);

  initReveal();
})();
