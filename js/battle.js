/* Бой. Механика обучает идеологии Дали:
   бить первым выгодно, блок постепенно отбирают, милосердие стоит еды. */

const MONSTER_DATA = [
  {
    name: 'ПЕСКОЕД', sprite: 0, maxhp: 24, atk: 4, def: 1,
    intro: 'ПЕСКОЕД выползает из песка.',
    check: 'ПЕСКОЕД — АТК 4  ЗЩ 1. Челюсти в песке. Ест всё, что не двигается.',
    talk: 'Ты говоришь с пескоедом. Он не понимает. Он просто голоден.',
    idle: [
      'Пескоед щёлкает жвалами.',
      'Пескоед смотрит на твои ботинки.',
      'Пескоеду тоже нечего есть.',
      'Пахнет горячим песком.',
    ],
    flee: 'ПЕСКОЕД пятится назад.',
    windowTime: 1.30,
  },
  {
    name: 'СТЕРВЯТНИК', sprite: 1, maxhp: 30, atk: 5, def: 2,
    intro: 'СТЕРВЯТНИК падает с неба.',
    check: 'СТЕРВЯТНИК — АТК 5  ЗЩ 2. Ждал три дня. Ты — первое, что здесь двигалось.',
    talk: 'Ты кричишь на него. Он кричит в ответ. Вы поняли друг друга.',
    idle: [
      'Стервятник щёлкает клювом.',
      'Стервятник косится на твою руку.',
      'Он ждёт, пока ты перестанешь двигаться.',
      'Крылья поднимают пыль.',
    ],
    flee: 'СТЕРВЯТНИК прижимает крылья.',
    windowTime: 0.95,
  },
  {
    name: 'ГОНЧАЯ ДЮН', sprite: 2, maxhp: 36, atk: 6, def: 3,
    intro: 'ГОНЧАЯ ДЮН преграждает путь.',
    check: 'ГОНЧАЯ ДЮН — АТК 6  ЗЩ 3. Рёбра видно даже отсюда.',
    talk: 'Ты протягиваешь руку. Она рычит. И не подходит ближе.',
    idle: [
      'Гончая скалится, но не бросается.',
      'Она хромает на переднюю лапу.',
      'Гончая смотрит мимо тебя — на юг.',
      'Слышно, как у неё урчит в животе.',
    ],
    flee: 'ГОНЧАЯ ДЮН поджимает хвост.',
    windowTime: 0.62,
  },
];

const MENU_X = [6, 84, 162, 240];
const MENU_Y = 208;
const MENU_W = 74, MENU_H = 26;

const Battle = (() => {
  let S = null;

  const ARENA = { x: 95, y: 120, w: 130, h: 62 };
  const TEXTBOX = { x: 20, y: 118, w: 280, h: 66 };

  function start(monster, opts) {
    const d = MONSTER_DATA[monster.sprite];
    S = {
      m: monster,
      d,
      hp: monster.hp,
      maxhp: d.maxhp,
      phase: 'intro',
      t: 0,
      msg: '',
      msgQueue: [],
      menuIdx: 0,
      actIdx: 0,
      blockEnabled: opts.blockEnabled,
      canSkip: opts.canSkip,
      windowTime: d.windowTime,
      windowLeft: d.windowTime,
      firstStrike: false,
      missedWindow: false,
      barPos: 0, barDir: 1, barSpeed: 1.6,
      bullets: [],
      turnTime: 0,
      turnLen: 4.2,
      heart: { x: ARENA.x + ARENA.w / 2, y: ARENA.y + ARENA.h / 2 },
      inv: 0,
      shake: 0,
      slash: 0,
      dmgPop: null,
      boxLerp: 0,          // 0 — текстовое окно, 1 — арена
      result: null,
      turnCount: 0,
      fleeing: false,
      enemyFlash: 0,
      idleIdx: 0,
      pattern: 0,
    };
    S.msg = d.intro;
    Sound.encounter();
    Sound.startMusic('battle');
  }

  function box() {
    const k = S.boxLerp;
    return {
      x: TEXTBOX.x + (ARENA.x - TEXTBOX.x) * k,
      y: TEXTBOX.y + (ARENA.y - TEXTBOX.y) * k,
      w: TEXTBOX.w + (ARENA.w - TEXTBOX.w) * k,
      h: TEXTBOX.h + (ARENA.h - TEXTBOX.h) * k,
    };
  }

  function setMsg(text, next) {
    S.msg = text;
    S.msgNext = next || null;
    S.phase = 'msg';
    S.t = 0;
  }

  function toMenu() {
    S.phase = 'menu';
    S.t = 0;
    S.menuIdx = 0;
    S.turnCount++;
    if (S.hp <= S.maxhp * 0.34 && !S.fleeing) {
      S.fleeing = true;
      setMsg(S.d.flee + (S.canSkip ? ' Он хочет убежать.' : ''), () => { S.phase = 'menu'; });
    }
  }

  // ------------------------------------------------------------- ход игрока

  function playerAttack(power) {
    const dmg = Math.max(1, Math.round(power - S.d.def * 0.5));
    S.hp -= dmg;
    S.dmgPop = { v: dmg, t: 0, x: 160, y: 70 };
    S.enemyFlash = 0.35;
    S.slash = 0.3;
    Sound.hit();
    if (S.hp <= 0) {
      S.hp = 0;
      S.phase = 'dying';
      S.t = 0;
      return;
    }
    setMsg(pickIdle(), () => enemyTurn());
  }

  function pickIdle() {
    const arr = S.d.idle;
    const s = arr[S.idleIdx % arr.length];
    S.idleIdx++;
    return s;
  }

  // ------------------------------------------------------------- ход монстра

  function enemyTurn(strong) {
    S.phase = 'enemy';
    S.t = 0;
    S.turnTime = 0;
    S.turnLen = strong ? 5.4 : 4.2;
    S.strong = !!strong;
    S.bullets = [];
    S.heart.x = ARENA.x + ARENA.w / 2;
    S.heart.y = ARENA.y + ARENA.h / 2;
    S.pattern = (S.pattern + 1) % 2;
    S.spawnT = 0;
  }

  function spawnBullets(dt) {
    const a = ARENA;
    S.spawnT += dt;
    const rate = S.strong ? 0.16 : 0.24;
    const kind = S.d.sprite !== undefined ? S.d.sprite : 0;
    const idx = MONSTER_DATA.indexOf(S.d);

    if (idx === 0) {
      // песчинки сверху
      if (S.spawnT > rate) {
        S.spawnT = 0;
        const n = S.strong ? 2 : 1;
        for (let i = 0; i < n; i++) {
          S.bullets.push({
            x: a.x + 4 + Math.random() * (a.w - 8), y: a.y - 4,
            vx: (Math.random() - 0.5) * 16, vy: 46 + Math.random() * 34,
            w: 3, h: 3, col: PAL.m1L,
          });
        }
      }
    } else if (idx === 1) {
      // перья с боков волнами
      if (S.spawnT > rate * 1.4) {
        S.spawnT = 0;
        const left = Math.random() > 0.5;
        const y = a.y + 6 + Math.random() * (a.h - 12);
        S.bullets.push({
          x: left ? a.x - 6 : a.x + a.w + 6, y,
          vx: (left ? 1 : -1) * (52 + Math.random() * 30), vy: (Math.random() - 0.5) * 20,
          w: 6, h: 2, col: PAL.m2L,
        });
        if (S.strong) {
          S.bullets.push({
            x: a.x + Math.random() * a.w, y: a.y - 4,
            vx: 0, vy: 60, w: 2, h: 6, col: PAL.m2L,
          });
        }
      }
    } else {
      // рывки гончей поперёк арены
      if (S.spawnT > (S.strong ? 0.85 : 1.15)) {
        S.spawnT = 0;
        const left = Math.random() > 0.5;
        const gapY = a.y + 10 + Math.random() * (a.h - 30);
        const speed = (left ? 1 : -1) * 96;
        const x = left ? a.x - 14 : a.x + a.w + 14;
        S.bullets.push({ x, y: a.y, vx: speed, vy: 0, w: 12, h: Math.max(2, gapY - a.y), col: PAL.m3M });
        S.bullets.push({
          x, y: gapY + 18, vx: speed, vy: 0, w: 12,
          h: Math.max(2, a.y + a.h - (gapY + 18)), col: PAL.m3M,
        });
        // мелкие укусы
        S.bullets.push({
          x: a.x + Math.random() * a.w, y: a.y - 3, vx: 0, vy: 54,
          w: 3, h: 3, col: PAL.bone,
        });
      }
    }
  }

  function hurtPlayer(dmg) {
    if (S.inv > 0) return;
    Game.damage(dmg);
    S.inv = 0.9;
    S.shake = 0.3;
    Sound.hurt();
    if (Game.hp <= 0) {
      S.phase = 'dead';
      S.t = 0;
      Sound.stopMusic();
    }
  }

  // ------------------------------------------------------------- обновление

  function update(dt) {
    if (!S) return;
    S.t += dt;
    if (S.shake > 0) S.shake -= dt;
    if (S.inv > 0) S.inv -= dt;
    if (S.slash > 0) S.slash -= dt;
    if (S.enemyFlash > 0) S.enemyFlash -= dt;
    if (S.dmgPop) { S.dmgPop.t += dt; if (S.dmgPop.t > 1.1) S.dmgPop = null; }

    const target = (S.phase === 'enemy') ? 1 : 0;
    S.boxLerp += (target - S.boxLerp) * Math.min(1, dt * 10);

    switch (S.phase) {
      case 'intro':
        if (S.t > 1.1) { S.phase = 'window'; S.windowLeft = S.windowTime; S.t = 0; }
        break;

      case 'window': {
        S.windowLeft -= dt;
        if (Input.just('a')) {
          S.firstStrike = true;
          Sound.slash();
          const dmg = 11;
          S.hp -= dmg;
          S.dmgPop = { v: dmg, t: 0, x: 160, y: 70 };
          S.enemyFlash = 0.4;
          S.slash = 0.3;
          Sound.hit();
          if (S.hp <= 0) { S.hp = 0; S.phase = 'dying'; S.t = 0; break; }
          setMsg('Ты ударил первым. Он не успел даже поднять голову.', () => toMenu());
          break;
        }
        if (S.windowLeft <= 0) {
          S.missedWindow = true;
          setMsg('Ты не успел. ' + S.d.name + ' бьёт первым — и сильнее.', () => enemyTurn(true));
        }
        break;
      }

      case 'msg':
        if (Input.just('a') && S.t > 0.35) {
          const n = S.msgNext;
          S.msgNext = null;
          if (n) n(); else toMenu();
        }
        break;

      case 'menu': {
        if (Input.just('left')) { S.menuIdx = (S.menuIdx + 3) % 4; Sound.select(); }
        if (Input.just('right')) { S.menuIdx = (S.menuIdx + 1) % 4; Sound.select(); }
        if (Input.just('a')) chooseMenu(S.menuIdx);
        break;
      }

      case 'act': {
        if (Input.just('up')) { S.actIdx = (S.actIdx + 1) % 2; Sound.select(); }
        if (Input.just('down')) { S.actIdx = (S.actIdx + 1) % 2; Sound.select(); }
        if (Input.just('b')) { S.phase = 'menu'; Sound.cancel(); }
        if (Input.just('a')) {
          const txt = S.actIdx === 0 ? S.d.check : S.d.talk;
          Sound.confirm();
          setMsg(txt, () => enemyTurn());
        }
        break;
      }

      case 'bar': {
        S.barPos += S.barDir * S.barSpeed * dt;
        if (S.barPos > 1) { S.barPos = 1; S.barDir = -1; }
        if (S.barPos < 0) { S.barPos = 0; S.barDir = 1; }
        if (Input.just('a')) {
          const acc = 1 - Math.abs(S.barPos - 0.5) * 2;   // 1 — точно по центру
          const power = 5 + Math.round(acc * 11);
          Sound.slash();
          playerAttack(power);
        }
        break;
      }

      case 'enemy': {
        S.turnTime += dt;
        spawnBullets(dt);
        const a = ARENA;
        // сердце
        const v = Input.moveVector();
        const sp = 74;
        S.heart.x = Math.max(a.x + 4, Math.min(a.x + a.w - 4, S.heart.x + v.x * sp * dt));
        S.heart.y = Math.max(a.y + 4, Math.min(a.y + a.h - 4, S.heart.y + v.y * sp * dt));
        // пули
        for (let i = S.bullets.length - 1; i >= 0; i--) {
          const b = S.bullets[i];
          b.x += b.vx * dt;
          b.y += b.vy * dt;
          if (b.x < a.x - 40 || b.x > a.x + a.w + 40 || b.y > a.y + a.h + 40 || b.y < a.y - 40) {
            S.bullets.splice(i, 1);
            continue;
          }
          if (Math.abs(b.x + b.w / 2 - S.heart.x) < b.w / 2 + 2.5 &&
            Math.abs(b.y + b.h / 2 - S.heart.y) < b.h / 2 + 2.5) {
            hurtPlayer(Math.max(1, S.d.atk - 1 + (Math.random() * 3 | 0)));
          }
        }
        if (S.turnTime > S.turnLen && S.phase === 'enemy') {
          S.bullets = [];
          S.strong = false;
          toMenu();
        }
        break;
      }

      case 'dying':
        if (S.t > 0.9) {
          S.result = 'kill';
          S.phase = 'over';
          Sound.win();
          Sound.stopMusic();
          Game.endBattle('kill', S.m);
        }
        break;

      case 'spared':
        if (S.t > 0.9) {
          S.result = 'spare';
          S.phase = 'over';
          Sound.win();
          Sound.stopMusic();
          Game.endBattle('spare', S.m);
        }
        break;

      case 'dead':
        if (Input.just('a') && S.t > 1.2) {
          Game.endBattle('dead', S.m);
        }
        break;
    }
  }

  function chooseMenu(i) {
    if (i === 0) {              // БОЙ
      Sound.confirm();
      S.phase = 'bar';
      S.barPos = 0; S.barDir = 1;
      S.barSpeed = 1.5 + S.turnCount * 0.12;
    } else if (i === 1) {       // ОСМОТР
      Sound.confirm();
      S.phase = 'act';
      S.actIdx = 0;
    } else if (i === 2) {       // ЕДА
      if (Game.food <= 0) {
        Sound.cancel();
        setMsg('В карманах пусто. Ты давно всё съел.', () => { S.phase = 'menu'; });
        return;
      }
      Sound.heal();
      Game.eat();
      setMsg('Ты жуёшь сухую полоску мяса. +10 ОЗ.', () => enemyTurn());
    } else {                    // БЛОК
      if (S.fleeing && S.canSkip) {
        Sound.confirm();
        S.phase = 'spared';
        S.t = 0;
        return;
      }
      if (!S.blockEnabled) {
        Sound.cancel();
        const why = S.canSkip
          ? 'Рука уже занесена. Ты не можешь её опустить.'
          : 'Ты слишком голоден, чтобы отпускать еду.';
        setMsg(why, () => { S.phase = 'menu'; });
        return;
      }
      Sound.confirm();
      if (S.turnCount <= 1) {
        setMsg('Ты опускаешь руки. «Я не буду бить.» ' + S.d.name + ' замирает — и не нападает.',
          () => { S.phase = 'spared'; S.t = 0; });
      } else {
        setMsg('Ты держишь блок. Он бьёт по рукам — но не по тебе.', () => enemyTurn());
      }
    }
  }

  // ------------------------------------------------------------- отрисовка

  function drawMonster(g) {
    const idx = MONSTER_DATA.indexOf(S.d);
    const u = 3;
    const cw = 32 * u, ch = 28 * u;
    const x = 160 - cw / 2;
    const y = 96 - ch;
    g.save();
    if (S.enemyFlash > 0 && (performance.now() % 100 < 50)) g.globalAlpha = 0.35;
    if (S.phase === 'dying') {
      g.globalAlpha = Math.max(0, 1 - S.t / 0.9);
      g.translate(0, S.t * 10);
    }
    const tmp = renderMonster(TEX.monsterFn[idx], u, S.t);
    g.drawImage(tmp, Math.round(x), Math.round(y + 14));
    g.restore();

    // полоска здоровья монстра
    const bw = 56;
    Font.draw(g, S.d.name, 160 - bw / 2 - 4 - Font.width(S.d.name, 1), 103, PAL.uiDim, 1);
    UI.bar(g, 160 - bw / 2, 104, bw, 5, S.hp / S.maxhp, PAL.green, '#3a2a1a');
  }

  function draw(g) {
    if (!S) return;
    g.fillStyle = '#000';
    g.fillRect(0, 0, 320, 240);

    g.save();
    if (S.shake > 0) {
      g.translate((Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5);
    }

    if (S.phase !== 'dead') drawMonster(g);

    // взмах
    if (S.slash > 0) {
      g.save();
      g.globalAlpha = S.slash / 0.3;
      g.strokeStyle = PAL.ui;
      g.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        g.beginPath();
        g.moveTo(130 + i * 12, 40);
        g.lineTo(180 + i * 12, 96);
        g.stroke();
      }
      g.restore();
    }

    // урон по монстру
    if (S.dmgPop) {
      const p = S.dmgPop;
      Font.drawCentered(g, '-' + p.v, p.x, p.y - p.t * 16, PAL.red, 2);
    }

    const b = box();
    if (S.phase !== 'dead') UI.box(g, b.x, b.y, b.w, b.h);

    if (S.phase === 'enemy') {
      // всё, что летает, живёт только внутри арены
      g.save();
      g.beginPath();
      g.rect(b.x + 2, b.y + 2, b.w - 4, b.h - 4);
      g.clip();
      for (const bl of S.bullets) {
        g.fillStyle = bl.col;
        g.fillRect(Math.round(bl.x), Math.round(bl.y), bl.w, bl.h);
      }
      if (!(S.inv > 0 && Math.floor(performance.now() / 70) % 2)) {
        g.drawImage(TEX.heart, Math.round(S.heart.x - 3), Math.round(S.heart.y - 3));
      }
      g.restore();
    } else if (S.phase === 'bar') {
      // полоса точности
      const bx = b.x + 20, by = b.y + 26, bw = b.w - 40, bh = 16;
      g.fillStyle = '#2a2419';
      g.fillRect(bx, by, bw, bh);
      g.fillStyle = '#6d5f3f';
      g.fillRect(bx + bw / 2 - 14, by, 28, bh);
      g.fillStyle = PAL.yellow;
      g.fillRect(bx + bw / 2 - 5, by, 10, bh);
      g.fillStyle = PAL.ui;
      g.fillRect(Math.round(bx + S.barPos * bw) - 1, by - 3, 2, bh + 6);
      Font.drawCentered(g, 'ЖМИ Z В ЦЕНТР', 160, b.y + 8, PAL.uiDim, 1);
    } else if (S.phase === 'window') {
      const k = Math.max(0, S.windowLeft / S.windowTime);
      Font.drawCentered(g, 'УДАРИТЬ ПЕРВЫМ!', 160, b.y + 14, PAL.ui, 1);
      const bx = b.x + 40, bw = b.w - 80;
      g.fillStyle = '#2a2419';
      g.fillRect(bx, b.y + 32, bw, 10);
      g.fillStyle = k > 0.35 ? PAL.red : PAL.yellow;
      g.fillRect(bx, b.y + 32, Math.round(bw * k), 10);
      Font.drawCentered(g, 'Z', 160, b.y + 46, PAL.uiDim, 1);
    } else if (S.phase === 'act') {
      Font.draw(g, (S.actIdx === 0 ? '>' : ' ') + ' ПРОВЕРИТЬ', b.x + 14, b.y + 14, PAL.ui, 1);
      Font.draw(g, (S.actIdx === 1 ? '>' : ' ') + ' ЗАГОВОРИТЬ', b.x + 14, b.y + 30, PAL.ui, 1);
    } else if (S.phase === 'dead') {
      // экран смерти
      const hb = TEX.heartBroken;
      g.drawImage(hb, 0, 0, hb.width, hb.height,
        160 - hb.width * 2, 52, hb.width * 4, hb.height * 4);
      Font.drawCentered(g, 'ТЫ ОСТАЛСЯ ОДИН', 160, 108, PAL.ui, 2);
      Font.drawCentered(g, 'НЕ СДАВАЙСЯ. ВСТАВАЙ.', 160, 140, PAL.red, 1);
      if (S.t > 1.2 && performance.now() % 1100 < 700) {
        Font.drawCentered(g, 'Z — ПРОДОЛЖИТЬ', 160, 176, PAL.uiDim, 1);
      }
    } else {
      // обычный текст
      const lines = Font.wrap(S.msg, b.w - 34, 1);
      let y = b.y + 12;
      Font.draw(g, '*', b.x + 12, y, PAL.ui, 1);
      for (let i = 0; i < lines.length; i++) {
        Font.draw(g, lines[i], b.x + 24, y, PAL.ui, 1);
        y += Font.LINE + 2;
      }
      if (S.phase === 'msg' && S.t > 0.35 && performance.now() % 900 < 550) {
        g.fillStyle = PAL.ui;
        g.fillRect(b.x + b.w - 14, b.y + b.h - 12, 4, 1);
        g.fillRect(b.x + b.w - 13, b.y + b.h - 11, 2, 1);
        g.fillRect(b.x + b.w - 13, b.y + b.h - 13, 2, 1);
      }
    }

    if (S.phase !== 'dead') {
      drawStatus(g);
      drawMenu(g);
    }
    g.restore();
  }

  function drawStatus(g) {
    const y = 190;
    Font.draw(g, 'ДАЛИ   УР 1', 8, y, PAL.ui, 1);
    Font.draw(g, 'ОЗ', 108, y, PAL.ui, 1);
    UI.bar(g, 124, y, 44, 7, Game.hp / Game.maxhp, PAL.yellow, PAL.redD);
    Font.draw(g, Game.hp + ' / ' + Game.maxhp, 174, y, PAL.ui, 1);
    Font.draw(g, 'ЕДА ' + Game.food, 250, y, PAL.uiDim, 1);
  }

  function drawMenu(g) {
    const labels = ['БОЙ', 'ОСМОТР', 'ЕДА', 'БЛОК'];
    const active = (S.phase === 'menu');
    for (let i = 0; i < 4; i++) {
      const x = MENU_X[i];
      let col = active ? PAL.yellow : '#6d6142';
      if (i === 3 && !S.blockEnabled && !(S.fleeing && S.canSkip)) col = '#5c5442';
      if (i === 2 && Game.food <= 0) col = '#5c5442';
      const sel = active && S.menuIdx === i;
      UI.box(g, x, MENU_Y, MENU_W, MENU_H, sel ? PAL.yellow : col, PAL.ink);
      Font.drawCentered(g, labels[i], x + MENU_W / 2, MENU_Y + 10, sel ? PAL.yellow : col, 1);
      if (i === 3 && S.fleeing && S.canSkip) {
        Font.drawCentered(g, 'ОТПУСТИТЬ', x + MENU_W / 2, MENU_Y + 18, PAL.green, 1);
      }
      // перечёркнутый блок — утрата должна быть видна
      if (i === 3 && !S.blockEnabled && !(S.fleeing && S.canSkip)) {
        g.strokeStyle = '#7a3028';
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(x + 6, MENU_Y + MENU_H - 5);
        g.lineTo(x + MENU_W - 6, MENU_Y + 5);
        g.stroke();
      }
    }
  }

  // тап по кнопкам меню на экране
  function hitTest(x, y) {
    if (!S) return false;
    if (S.phase === 'menu') {
      for (let i = 0; i < 4; i++) {
        if (x >= MENU_X[i] && x <= MENU_X[i] + MENU_W && y >= MENU_Y && y <= MENU_Y + MENU_H) {
          S.menuIdx = i;
          chooseMenu(i);
          return true;
        }
      }
    }
    if (S.phase === 'act') {
      const b = box();
      if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) {
        S.actIdx = (y < b.y + 24) ? 0 : 1;
        Sound.confirm();
        setMsg(S.actIdx === 0 ? S.d.check : S.d.talk, () => enemyTurn());
        return true;
      }
    }
    return false;
  }

  return {
    start, update, draw, hitTest,
    get active() { return !!S; },
    get phase() { return S ? S.phase : null; },
    get state() { return S; },
    clear() { S = null; },
  };
})();
