/* Better Call Rahman. Сценарии главной: слайдер, счётчики, появление услуг, отзывы, визитка. */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function onVisible(el, callback, threshold) {
    if (!el) return;
    if (!('IntersectionObserver' in window) || reduceMotion) {
      callback(el);
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting) return;
      callback(el);
      io.disconnect();
    }, { threshold: threshold || 0.2 });
    io.observe(el);
  }

  /* ---------- Слайдер ---------- */

  function initSlider(root) {
    var slides = [].slice.call(root.querySelectorAll('.slide'));
    if (slides.length < 2) return;

    var dots = [].slice.call(root.querySelectorAll('.hero__dot'));
    var bars = dots.map(function (dot) { return dot.querySelector('span'); });
    var fade = 1800;
    var index = 0;
    var timer = null;
    var paused = false;
    var remaining = 0;
    var startedAt = 0;

    /* первый кадр держим дольше, чтобы заставка успела проиграться */
    function durationOf(i) {
      return i === 0 ? 9000 : 7000;
    }

    function resetBars() {
      bars.forEach(function (bar, k) {
        bar.style.transition = 'none';
        bar.style.transform = k < index || (reduceMotion && k === index) ? 'scaleX(1)' : 'scaleX(0)';
      });
      void bars[index].offsetWidth;
    }

    function startTimer(ms) {
      clearTimeout(timer);
      if (reduceMotion) return;
      startedAt = Date.now();
      remaining = ms;
      bars[index].style.transition = 'transform ' + ms + 'ms linear';
      bars[index].style.transform = 'scaleX(1)';
      timer = setTimeout(function () { show(index + 1); }, ms);
    }

    function show(i) {
      var next = (i + slides.length) % slides.length;
      if (next === index) return;

      var prev = slides[index];
      prev.classList.remove('is-active');
      prev.classList.add('is-leaving');
      prev.setAttribute('aria-hidden', 'true');
      setTimeout(function () { prev.classList.remove('is-leaving'); }, fade + 100);

      index = next;
      slides[index].classList.add('is-active');
      slides[index].setAttribute('aria-hidden', 'false');
      dots.forEach(function (dot, k) {
        dot.setAttribute('aria-current', k === index ? 'true' : 'false');
      });

      resetBars();
      if (paused) remaining = durationOf(index);
      else startTimer(durationOf(index));
    }

    function pause() {
      if (paused) return;
      paused = true;
      clearTimeout(timer);
      remaining = Math.max(0, remaining - (Date.now() - startedAt));
      var matrix = getComputedStyle(bars[index]).transform;
      bars[index].style.transition = 'none';
      bars[index].style.transform = matrix === 'none' ? 'scaleX(0)' : matrix;
    }

    function resume() {
      if (!paused) return;
      paused = false;
      startTimer(remaining);
    }

    dots.forEach(function (dot, k) {
      dot.addEventListener('click', function () { show(k); });
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

    resetBars();
    startTimer(durationOf(0));
  }

  /* ---------- Счётчики ---------- */

  function countUp(el) {
    var target = parseInt(el.getAttribute('data-count'), 10);
    if (isNaN(target) || reduceMotion) return;
    var start = null;
    function step(ts) {
      if (start === null) start = ts;
      var t = Math.min(1, (ts - start) / 2400);
      var eased = 1 - Math.pow(1 - t, 3);
      el.textContent = String(Math.round(target * eased)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0');
      if (t < 1) requestAnimationFrame(step);
    }
    el.textContent = '0';
    requestAnimationFrame(step);
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
    }, 7000);
  }

  /* ---------- Визитка поворачивается за курсором ---------- */

  function initCard(wrap) {
    var card = wrap.querySelector('.bcard');
    if (!card || reduceMotion) return;
    wrap.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      var r = card.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width;
      var y = (e.clientY - r.top) / r.height;
      card.style.setProperty('--ry', ((x - 0.5) * 16).toFixed(2) + 'deg');
      card.style.setProperty('--rx', ((0.5 - y) * 12).toFixed(2) + 'deg');
      card.style.setProperty('--gx', (x * 100).toFixed(1) + '%');
      card.style.setProperty('--gy', (y * 100).toFixed(1) + '%');
    });
    wrap.addEventListener('pointerleave', function () {
      card.style.setProperty('--ry', '0deg');
      card.style.setProperty('--rx', '0deg');
    });
  }

  /* ---------- Запуск ---------- */

  var hero = document.querySelector('.hero');
  if (hero) initSlider(hero);

  [].slice.call(document.querySelectorAll('[data-count]')).forEach(function (el) {
    onVisible(el, countUp, 0.6);
  });

  onVisible(document.querySelector('[data-services]'), function (el) { el.classList.add('is-in'); }, 0.15);
  onVisible(document.querySelector('[data-scene]'), function (el) { el.classList.add('is-in'); }, 0.3);

  var quotes = document.querySelector('[data-quotes]');
  if (quotes) initQuotes(quotes.closest('.scene') || quotes);

  var card = document.querySelector('[data-card]');
  if (card) initCard(card);
})();
