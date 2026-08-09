/* Каркас игры: состояния, мир, переходы, голод, концовка. */

const Game = (() => {
  const canvas = document.getElementById('cv');
  const g = canvas.getContext('2d');
  g.imageSmoothingEnabled = false;

  const tb = new UI.Textbox();

  const state = {
    mode: 'title',      // title | intro | world | encounter | battle | ending
    hp: 20, maxhp: 20,
    food: 2,
    fullness: 68,       // сытость
    kills: 0, spares: 0, fights: 0,
    wellUses: 3,
    encCool: 0,
    fade: 1,            // 1 — чёрный экран
    fadeDir: -1,
    flash: 0,
    t: 0,
    curMonster: null,
    hungryWarned: false,
    endText: null,
    steps: 0,
  };

  // ------------------------------------------------------------ реплики мира

  const SPOT_TEXT = {
    train: ['Ты вышел из этого вагона минут десять назад. Дверь захлопнулась сама и больше не поддаётся.'],
    cabin: ['Дверь кабины открыта настежь. Внутри никого. Рычаги стоят посередине, будто поезд никто и не вёл.'],
    sign: ['«СТАНЦИЯ 07». Ниже, гвоздём по дереву: «дальше не ходи».',
      'Писали уже после того, как станцию бросили.'],
    shack: ['Расписание под мутным стеклом. Двенадцать рейсов, и все вычеркнуты одной чертой.'],
    post: ['Указатель. Одна стрелка стёрта до голого дерева. Вторая показывает на юг.'],
    sign08: ['«СТАНЦИЯ 08». Следующая по путям. Куда именно — не написано.'],
    rails: ['Рельсы обрываются. Шпалы вывернуты наружу — их ломали отсюда, со стороны станции.',
      'Обратно ты не уедешь.'],
  };

  // ------------------------------------------------------------ вспомогательное

  function damage(d) {
    state.hp = Math.max(0, state.hp - d);
  }

  function heal(d) {
    state.hp = Math.min(state.maxhp, state.hp + d);
  }

  function eat() {
    state.food--;
    heal(10);
    state.fullness = Math.min(100, state.fullness + 25);
  }

  function say(pages, cb, opts) {
    tb.open(pages, cb, opts);
  }

  // ------------------------------------------------------------ бой

  function startBattle(m) {
    state.curMonster = m;
    state.mode = 'encounter';
    state.t = 0;
    state.flash = 1;
    Sound.encounter();
  }

  function endBattle(result, m) {
    Battle.clear();
    state.mode = 'world';
    state.encCool = 1.6;
    Sound.startMusic('desert');
    if (result === 'kill') {
      m.alive = false;
      state.kills++;
      heal(8);
      state.fullness = Math.min(100, state.fullness + 40);
      say(['Ты поел. +8 ОЗ. Стало легче — и от этого противно.'], null);
    } else if (result === 'spare') {
      m.alive = false;
      m.spared = true;
      state.spares++;
      say(['Он ушёл. Ты остался голодным.'], null);
    } else {
      // поражение — не смерть, просто ты очнулся
      state.hp = state.maxhp;
      m.x = m.homeX; m.y = m.homeY;
      World.player.y = Math.min(World.H - 40, World.player.y + 26);
      state.fullness = Math.max(0, state.fullness - 10);
      say(['Ты очнулся. Песок в зубах, но ты жив.', 'Помощи не будет. Вставай.'], null);
    }
  }

  // ------------------------------------------------------------ концовка

  function buildEnding() {
    const k = state.kills, s = state.spares, f = state.fights;
    let head, body;
    if (f === 0) {
      head = 'ТЫ ПРОШЁЛ МИМО';
      body = 'Ты никого не тронул и никого не понял. Пока это ещё можно было выбрать.';
    } else if (k === 0) {
      head = 'ТЫ ОТПУСТИЛ ИХ';
      body = 'Ты отпустил всех, кого встретил, и остался голодным. Ты ещё не знаешь, сколько это будет стоить дальше.';
    } else if (k >= 3) {
      head = 'ТЫ БЬЁШЬ ПЕРВЫМ';
      body = 'Всё вокруг хотело тебя убить. Теперь и ты. Рука опускается сама — ты уже не помнишь, когда решил.';
    } else {
      head = 'ТЫ ВЫБИРАЛ';
      body = 'Кого-то ты отпустил, кого-то съел. Разницу помнишь только ты — они были одинаково голодны.';
    }
    return { head, body };
  }

  function toEnding() {
    state.endText = buildEnding();
    state.mode = 'ending';
    state.t = 0;
    Sound.stopMusic();
    Sound.win();
  }

  // ------------------------------------------------------------ взаимодействия

  function interact() {
    const spot = World.facingSpot();
    if (!spot) return false;
    if (spot.id === 'well') {
      if (state.wellUses > 0) {
        state.wellUses--;
        state.fullness = Math.min(100, state.fullness + 16);
        heal(3);
        Sound.heal();
        say(['Вода тёплая и пахнет железом. Ты пьёшь, сколько влезет.'], null);
      } else {
        say(['Ведро скребёт по сухому дну.'], null);
      }
      return true;
    }
    if (spot.id === 'lever') {
      say([
        'Рычаг вызова поезда. Единственный, который тут ещё держится.',
        'Дёрнуть? (Z — да, X — нет)',
      ], () => {
        Sound.lever();
        say(['Где-то далеко в песке щёлкает стрелка. Рельсы начинают гудеть.'], () => toEnding());
      });
      return true;
    }
    const t = SPOT_TEXT[spot.id];
    if (t) { say(t, null); return true; }
    return false;
  }

  // ------------------------------------------------------------ цикл

  function update(dt) {
    state.t += dt;

    // затемнение
    state.fade = Math.max(0, Math.min(1, state.fade + state.fadeDir * dt * 1.6));
    if (state.flash > 0) state.flash -= dt * 1.8;

    switch (state.mode) {
      case 'title':
        if (Input.just('a') || Input.just('b')) {
          Sound.resume();
          Sound.confirm();
          state.mode = 'intro';
          state.t = 0;
          state.fade = 1;
          state.fadeDir = -1;
          Sound.startMusic('desert');
          say([
            'Ты открыл глаза от того, что стало тихо.',
            'Поезд стоит. Дверь открыта. Снаружи жара и песок — столько песка ты не видел никогда.',
            'РИЧ не отвечает.',
            state.touch
              ? 'Стик слева — идти. Z — действие. Осмотрись.'
              : 'Стрелки — идти. Z — действие, X — отмена. Осмотрись.',
          ], () => { state.mode = 'world'; });
        }
        break;

      case 'intro':
        tb.update(dt);
        if (Input.just('a')) tb.advance();
        break;

      case 'world': {
        const busy = tb.active;
        if (busy) {
          tb.update(dt);
          if (Input.just('a')) tb.advance();
          if (Input.just('b') && tb.pages.length > 1 && tb.page === 1) tb.advance();
        } else {
          const touched = World.update(dt, true);
          if (Input.just('a')) interact();
          if (state.encCool > 0) state.encCool -= dt;
          else if (touched) { state.fights++; startBattle(touched); }

          // голод
          state.fullness = Math.max(0, state.fullness - dt * 0.19);
          if (state.fullness <= 0) {
            state.starveT = (state.starveT || 0) + dt;
            if (state.starveT > 6) {
              state.starveT = 0;
              damage(1);
              Sound.hurt();
              if (state.hp <= 0) {
                state.hp = 1;
                say(['В глазах темнеет. Ты садишься прямо в песок.', 'Надо что-то съесть. Хоть что-нибудь.'], null);
              }
            }
          }
          if (state.fullness < 25 && !state.hungryWarned) {
            state.hungryWarned = true;
            say(['Живот сводит. Ты не ел с самого поезда.'], null);
          }
        }
        break;
      }

      case 'encounter':
        World.update(dt, false);
        if (state.t > 0.75) {
          state.mode = 'battle';
          Battle.start(state.curMonster, {
            blockEnabled: state.fights <= 1,          // блок доступен только в первом бою
            canSkip: state.kills < 2,                 // убил многих — отпустить уже нельзя
          });
        }
        break;

      case 'battle':
        Battle.update(dt);
        break;

      case 'ending':
        if (Input.just('a') && state.t > 1.4) location.reload();
        break;
    }

    Input.endFrame();
  }

  // ------------------------------------------------------------ отрисовка

  function drawWorldHud() {
    // компактная панель: здоровье и сытость
    // лёгкая панель без рамки, чтобы не перекрывать сцену
    g.save();
    g.globalAlpha = 0.82;
    g.drawImage(TEX.heart, 5, 5);
    g.fillStyle = 'rgba(10,9,6,0.65)';
    g.fillRect(14, 4, 46, 9);
    g.fillRect(14, 14, 46, 8);
    UI.bar(g, 15, 5, 44, 7, state.hp / state.maxhp, PAL.yellow, PAL.redD);
    UI.bar(g, 15, 15, 44, 6, state.fullness / 100,
      state.fullness < 25 ? PAL.red : PAL.green, '#3a2f1c');
    g.globalAlpha = 1;
    Font.draw(g, state.hp + '/' + state.maxhp, 63, 5, PAL.ui, 1);
    Font.draw(g, 'ЕДА ' + state.food, 63, 15, state.food ? PAL.uiDim : '#6b5a3c', 1);
    g.restore();
  }

  function draw() {
    g.imageSmoothingEnabled = false;
    g.fillStyle = '#000';
    g.fillRect(0, 0, 320, 240);

    if (state.mode === 'title') {
      drawTitleArt(g, state.t);
      Font.drawCentered(g, 'КОНЕЧНАЯ', 160, 44, '#1a1610', 3);
      Font.drawCentered(g, 'КОНЕЧНАЯ', 160, 42, '#e8d6a8', 3);
      Font.drawCentered(g, 'ВЕБ-ДЕМО. СТАНЦИЯ 07', 160, 74, '#8a7d5e', 1);
      if (performance.now() % 1200 < 800) {
        Font.drawCentered(g, 'КОСНИСЬ ЭКРАНА ИЛИ ЖМИ Z', 160, 212, '#c3b184', 1);
      }
      Font.drawCentered(g, 'ГРАФИКА НАРИСОВАНА КОДОМ', 160, 228, '#4e483a', 1);
    } else if (state.mode === 'battle') {
      Battle.draw(g);
    } else if (state.mode === 'ending') {
      g.fillStyle = '#000';
      g.fillRect(0, 0, 320, 240);
      const e = state.endText;
      Font.drawCentered(g, e.head, 160, 40, PAL.ui, 2);
      const lines = Font.wrap(e.body, 264, 1);
      let y = 78;
      for (const l of lines) { Font.drawCentered(g, l, 160, y, PAL.uiDim, 1); y += 12; }
      y += 10;
      Font.drawCentered(g, 'БОЁВ: ' + state.fights + '   УБИТО: ' + state.kills +
        '   ОТПУЩЕНО: ' + state.spares, 160, y, PAL.uiDim, 1);
      Font.drawCentered(g, 'ДЕМО ОКОНЧЕНО', 160, 178, PAL.yellow, 1);
      if (state.t > 1.4 && performance.now() % 1200 < 800) {
        Font.drawCentered(g, 'Z — НАЧАТЬ ЗАНОВО', 160, 206, PAL.uiDim, 1);
      }
    } else {
      World.draw(g);
      drawWorldHud();
      tb.draw(g);
      if (state.mode === 'encounter') {
        // вспышка перед боем
        g.fillStyle = 'rgba(240,232,208,' + Math.max(0, Math.min(1, state.flash)) + ')';
        g.fillRect(0, 0, 320, 240);
        if (Math.floor(state.t * 12) % 2 === 0) {
          g.fillStyle = '#000';
          g.fillRect(0, 0, 320, 240);
        }
      }
    }

    if (state.fade > 0.001) {
      g.fillStyle = 'rgba(0,0,0,' + state.fade + ')';
      g.fillRect(0, 0, 320, 240);
    }
  }

  // ------------------------------------------------------------ запуск

  let last = 0;
  function loop(ts) {
    const dt = Math.min(0.05, (ts - last) / 1000 || 0);
    last = ts;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  function resize() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const portrait = vh > vw * 1.05;
    // на телефоне оставляем место под большой палец
    const availH = portrait ? vh * 0.62 : vh;
    let scale = Math.min(vw / 320, availH / 240);
    if (scale > 1.4) scale = Math.floor(scale * 2) / 2;
    scale = Math.max(1, scale);
    canvas.style.width = Math.round(320 * scale) + 'px';
    canvas.style.height = Math.round(240 * scale) + 'px';
    canvas.style.marginBottom = portrait ? Math.round(vh * 0.30) + 'px' : '0px';
  }

  function boot() {
    buildTextures();
    World.build();
    Input.attach(canvas, document.getElementById('stage'));
    Input.setMenuHit((x, y) => (state.mode === 'battle') && Battle.hitTest(x, y));

    // сенсор — показываем джойстик
    const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    state.touch = isTouch;
    document.getElementById('touch').classList.toggle('hidden', !isTouch);

    const bs = document.getElementById('btn-sound');
    bs.addEventListener('click', () => {
      Sound.resume();
      Sound.setEnabled(!Sound.isEnabled());
      bs.classList.toggle('off', !Sound.isEnabled());
    });
    const bf = document.getElementById('btn-full');
    bf.addEventListener('click', () => {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
      else document.exitFullscreen?.();
    });

    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', () => setTimeout(resize, 120));
    resize();
    requestAnimationFrame(loop);
  }

  return {
    boot, damage, heal, eat, endBattle, startBattle,
    get hp() { return state.hp; },
    get maxhp() { return state.maxhp; },
    get food() { return state.food; },
    get state() { return state; },
  };
})();

window.addEventListener('load', () => Game.boot());
