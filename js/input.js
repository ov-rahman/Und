/* Ввод: клавиатура + сенсор (плавающий стик, кнопки Z/X, тап по меню). */

const Input = (() => {
  const state = { up: 0, down: 0, left: 0, right: 0, a: 0, b: 0 };
  const justState = {};
  const axis = { x: 0, y: 0 };
  let stickId = null, stickOX = 0, stickOY = 0;
  const pointers = new Map();
  let menuHit = null;          // колбэк: (x,y в координатах канваса) -> true, если тап обработан
  let canvasEl = null;
  const STICK_R = 46;

  const KEYMAP = {
    ArrowUp: 'up', KeyW: 'up',
    ArrowDown: 'down', KeyS: 'down',
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    KeyZ: 'a', Enter: 'a', Space: 'a',
    KeyX: 'b', ShiftLeft: 'b', Escape: 'b', Backspace: 'b',
  };

  function press(name) {
    if (!state[name]) justState[name] = 1;
    state[name] = 1;
  }
  function release(name) { state[name] = 0; }

  function onKeyDown(e) {
    const k = KEYMAP[e.code];
    if (!k) return;
    e.preventDefault();
    if (!e.repeat) press(k); else state[k] = 1;
    Sound.resume();
  }
  function onKeyUp(e) {
    const k = KEYMAP[e.code];
    if (!k) return;
    e.preventDefault();
    release(k);
  }

  function toCanvas(clientX, clientY) {
    if (!canvasEl) return { x: -999, y: -999 };
    const r = canvasEl.getBoundingClientRect();
    return {
      x: (clientX - r.left) / r.width * canvasEl.width,
      y: (clientY - r.top) / r.height * canvasEl.height,
    };
  }

  function inRect(el, x, y) {
    if (!el || el.offsetParent === null) return false;
    const r = el.getBoundingClientRect();
    return x >= r.left - 6 && x <= r.right + 6 && y >= r.top - 6 && y <= r.bottom + 6;
  }

  function setKnob(dx, dy) {
    const base = document.getElementById('stick-base');
    const knob = document.getElementById('stick-knob');
    if (!knob || !base) return;
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  function updateAxisKeys() {
    // стик управляет теми же флагами направлений
    const dead = 0.34;
    state.up = axis.y < -dead ? 1 : (keyDir.up ? 1 : 0);
    state.down = axis.y > dead ? 1 : (keyDir.down ? 1 : 0);
    state.left = axis.x < -dead ? 1 : (keyDir.left ? 1 : 0);
    state.right = axis.x > dead ? 1 : (keyDir.right ? 1 : 0);
  }

  // отдельно держим клавиатурные направления, чтобы стик их не затирал
  const keyDir = { up: 0, down: 0, left: 0, right: 0 };

  function onDown(e) {
    Sound.resume();
    const btnA = document.getElementById('btn-a');
    const btnB = document.getElementById('btn-b');
    const sys = document.getElementById('topbar');

    if (inRect(sys, e.clientX, e.clientY)) return;      // системные кнопки — сами по себе

    const p = toCanvas(e.clientX, e.clientY);
    if (menuHit && menuHit(p.x, p.y)) {
      e.preventDefault();
      pointers.set(e.pointerId, 'menu');
      return;
    }
    if (inRect(btnA, e.clientX, e.clientY)) {
      e.preventDefault();
      press('a'); btnA.classList.add('down');
      pointers.set(e.pointerId, 'a');
      return;
    }
    if (inRect(btnB, e.clientX, e.clientY)) {
      e.preventDefault();
      press('b'); btnB.classList.add('down');
      pointers.set(e.pointerId, 'b');
      return;
    }
    if (e.clientX < window.innerWidth * 0.5) {
      e.preventDefault();
      stickId = e.pointerId;
      stickOX = e.clientX; stickOY = e.clientY;
      pointers.set(e.pointerId, 'stick');
      const base = document.getElementById('stick-base');
      if (base) {
        base.style.left = (e.clientX) + 'px';
        base.style.bottom = 'auto';
        base.style.top = (e.clientY) + 'px';
        base.style.marginTop = '-59px';
        base.style.opacity = '1';
      }
      return;
    }
    // тап по правой половине — подтверждение
    e.preventDefault();
    press('a');
    pointers.set(e.pointerId, 'tapA');
  }

  function onMove(e) {
    if (e.pointerId !== stickId) return;
    e.preventDefault();
    let dx = e.clientX - stickOX;
    let dy = e.clientY - stickOY;
    const len = Math.hypot(dx, dy);
    if (len > STICK_R) { dx = dx / len * STICK_R; dy = dy / len * STICK_R; }
    axis.x = dx / STICK_R;
    axis.y = dy / STICK_R;
    setKnob(dx, dy);
    updateAxisKeys();
  }

  function onUp(e) {
    const role = pointers.get(e.pointerId);
    pointers.delete(e.pointerId);
    if (role === 'a' || role === 'tapA') {
      release('a');
      const btnA = document.getElementById('btn-a');
      if (btnA) btnA.classList.remove('down');
    }
    if (role === 'b') {
      release('b');
      const btnB = document.getElementById('btn-b');
      if (btnB) btnB.classList.remove('down');
    }
    if (e.pointerId === stickId) {
      stickId = null;
      axis.x = 0; axis.y = 0;
      setKnob(0, 0);
      const base = document.getElementById('stick-base');
      if (base) {
        base.style.left = '14%';
        base.style.top = 'auto';
        base.style.bottom = '18%';
        base.style.marginTop = '0';
        base.style.opacity = '.75';
      }
      updateAxisKeys();
    }
  }

  function attach(canvas, stage) {
    canvasEl = canvas;
    window.addEventListener('keydown', e => {
      const k = KEYMAP[e.code];
      if (k && k !== 'a' && k !== 'b') keyDir[k] = 1;
      onKeyDown(e);
    });
    window.addEventListener('keyup', e => {
      const k = KEYMAP[e.code];
      if (k && k !== 'a' && k !== 'b') keyDir[k] = 0;
      onKeyUp(e);
      updateAxisKeys();
    });
    stage.addEventListener('pointerdown', onDown, { capture: true, passive: false });
    stage.addEventListener('pointermove', onMove, { capture: true, passive: false });
    window.addEventListener('pointerup', onUp, true);
    window.addEventListener('pointercancel', onUp, true);
    window.addEventListener('blur', () => {
      for (const k in state) state[k] = 0;
      for (const k in keyDir) keyDir[k] = 0;
      axis.x = axis.y = 0;
      setKnob(0, 0);
    });
  }

  return {
    attach,
    setMenuHit(fn) { menuHit = fn; },
    down(k) { return !!state[k]; },
    just(k) { return !!justState[k]; },
    anyJust() { return Object.keys(justState).length > 0; },
    axis,
    // 4-направленный вектор для мира
    moveVector() {
      let x = 0, y = 0;
      if (state.left) x -= 1;
      if (state.right) x += 1;
      if (state.up) y -= 1;
      if (state.down) y += 1;
      if (stickId !== null && (Math.abs(axis.x) > 0.2 || Math.abs(axis.y) > 0.2)) {
        x = axis.x; y = axis.y;
        const l = Math.hypot(x, y);
        if (l > 1) { x /= l; y /= l; }
      } else if (x || y) {
        const l = Math.hypot(x, y);
        x /= l; y /= l;
      }
      return { x, y };
    },
    endFrame() { for (const k in justState) delete justState[k]; },
  };
})();
