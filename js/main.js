/* Better Call Rahman. Сценарии страницы: слайдер, раскрытие фото при прокрутке, проявление фразы по словам. */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Слайдер ---------- */

  function initSlider(root) {
    var slides = [].slice.call(root.querySelectorAll('.slide'));
    if (slides.length < 2) return;

    var dots = [].slice.call(root.querySelectorAll('.hero__dot'));
    var bars = dots.map(function (dot) { return dot.querySelector('span'); });
    var interval = 7000;
    var fade = 1600;
    var index = 0;
    var timer = null;
    var paused = false;
    var remaining = interval;
    var startedAt = 0;

    /* пройденные полоски заполнены, будущие пустые */
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

      resetBars();
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
    startTimer(interval);
  }

  /* ---------- Фото раскрываются, когда до них доходит прокрутка ---------- */

  function initPhotos() {
    var photos = [].slice.call(document.querySelectorAll('.photo'));
    if (!('IntersectionObserver' in window) || reduceMotion) {
      photos.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.2 });
    photos.forEach(function (el) { io.observe(el); });
  }

  /* ---------- Фраза с цифрами: делим на слова для проявления при чтении ---------- */

  function splitWords(el) {
    var words = el.textContent.trim().split(/ +/);
    el.textContent = '';
    words.forEach(function (word, i) {
      var span = document.createElement('span');
      span.className = 'w';
      span.style.setProperty('--i', i);
      span.textContent = word;
      el.appendChild(span);
      if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
    });
  }

  /* ---------- Запуск ---------- */

  var hero = document.querySelector('.hero');
  if (hero) initSlider(hero);

  [].slice.call(document.querySelectorAll('[data-words]')).forEach(splitWords);

  initPhotos();
})();
