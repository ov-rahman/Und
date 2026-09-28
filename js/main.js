/* Better Call Rahman — сценарии страницы: слайдер, появление блоков, счётчики, отзывы */
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

  /* ---------- Запуск ---------- */

  var slider = document.querySelector('.slider');
  if (slider) initSlider(slider);

  var testimonials = document.querySelector('.testimonials');
  if (testimonials) initQuotes(testimonials);

  initReveal();
})();
