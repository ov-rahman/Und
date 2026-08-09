/* Мир: пустыня у Станции 07. Ландшафт запекается в один большой канвас,
   объекты рисуются поверх с сортировкой по глубине. */

const World = (() => {
  const W = 960, H = 780;
  const TS = 16;

  let bg = null;
  const props = [];      // {img, x, y, sortY}
  const solids = [];     // {x,y,w,h}
  const spots = [];      // {x,y,w,h,id}
  let monsters = [];

  // компоновка стартового экрана: вагон слева, вывеска по центру, будка справа
  const LAY = {
    railY: 136,
    train: { x: 230, y: 92 },
    sign: { x: 370, y: 168 },
    shack: { x: 480, y: 104 },
    minY: 164,
  };

  const player = {
    x: 400, y: 226, dir: 'down', frame: 0, animT: 0, moving: false, speed: 56,
  };

  function addProp(img, x, y, sh, sortOffset) {
    props.push({
      img, x: x | 0, y: y | 0, sh: sh || 0,
      sortY: (y + img.height + (sortOffset || 0)) | 0,
    });
  }
  function addSolid(x, y, w, h) { solids.push({ x, y, w, h }); }
  function addSpot(id, x, y, w, h) { spots.push({ id, x, y, w, h }); }

  function hash(x, y) {
    let n = x * 374761393 + y * 668265263;
    n = (n ^ (n >> 13)) * 1274126177;
    return ((n ^ (n >> 16)) >>> 0) / 4294967296;
  }

  function buildTerrain() {
    bg = makeCanvas(W, H);
    const g = ctxOf(bg);
    for (let ty = 0; ty < H / TS; ty++) {
      for (let tx = 0; tx < W / TS; tx++) {
        const h = hash(tx, ty);
        let img;
        if (h > 0.90) img = TEX.dune[(h * 10 | 0) % 2];
        else img = TEX.ground[(h * 40 | 0) % 4];
        g.drawImage(img, tx * TS, ty * TS);
      }
    }

    // наносы и вытоптанная земля пятнами
    const r = mulberry(4242);
    for (let i = 0; i < 34; i++) {
      const x = r() * W, y = 40 + r() * (H - 60);
      ditherEllipse(g, x, y, 22 + r() * 40, 9 + r() * 15, r() > 0.4 ? PAL.sand2 : PAL.sand3);
    }
    for (let i = 0; i < 9; i++) {
      const x = r() * W, y = 40 + r() * (H - 60);
      ditherEllipse(g, x, y, 14 + r() * 24, 6 + r() * 10, PAL.sandDark);
    }
    // светлые продутые гребни
    for (let i = 0; i < 18; i++) {
      const x = r() * W, y = 40 + r() * (H - 60);
      ditherEllipse(g, x, y, 16 + r() * 28, 5 + r() * 8, PAL.sand0);
    }

    // рельсы: короткий кусок с запада под вагон, дальше на восток — вывернутые
    for (let tx = 0; tx * TS < 352; tx++) {
      g.drawImage(TEX.rail, tx * TS, LAY.railY);
    }
    for (let tx = 22; tx < 30; tx++) {
      g.drawImage(TEX.railBroken, tx * TS, LAY.railY);
    }
    // занос песком поверх рельсов
    for (let i = 0; i < 18; i++) {
      ditherEllipse(g, r() * 480, LAY.railY + 6 + r() * 10, 10 + r() * 16, 4 + r() * 5, PAL.sand1);
    }

    // южная станция: небольшой дощатый настил
    for (let ty = 41; ty < 44; ty++)
      for (let tx = 26; tx < 34; tx++)
        g.drawImage(TEX.platform, tx * TS, ty * TS);
    g.fillStyle = PAL.woodD;
    g.fillRect(26 * TS, 41 * TS, 8 * TS, 2);
    g.fillRect(26 * TS, 44 * TS - 2, 8 * TS, 2);
    g.fillStyle = PAL.sandShadow;
    g.fillRect(26 * TS, 44 * TS, 8 * TS, 3);
    // занос по краям настила
    for (let i = 0; i < 10; i++) {
      ditherEllipse(g, 416 + r() * 128, 700 + r() * 10, 10 + r() * 12, 4, PAL.sand2);
    }
    // рельсы у южной станции
    for (let tx = 18; tx < 40; tx++) {
      g.drawImage(tx * TS > 600 ? TEX.railBroken : TEX.rail, tx * TS, 720);
    }

    // руины на западе: два занесённых песком фундамента с проёмами
    const ruinTiles = [];
    function room(x0, y0, w, h, gaps) {
      for (let i = 0; i < w; i++) {
        if (!gaps.includes('n' + i)) ruinTiles.push([x0 + i, y0]);
        if (!gaps.includes('s' + i)) ruinTiles.push([x0 + i, y0 + h - 1]);
      }
      for (let j = 1; j < h - 1; j++) {
        if (!gaps.includes('w' + j)) ruinTiles.push([x0, y0 + j]);
        if (!gaps.includes('e' + j)) ruinTiles.push([x0 + w - 1, y0 + j]);
      }
    }
    room(4, 23, 7, 5, ['n3', 'n4', 'e2', 's1']);
    room(12, 28, 6, 4, ['w1', 'n2', 's3', 's4']);
    for (const [tx, ty] of ruinTiles) {
      g.drawImage(TEX.ruin[(tx * 3 + ty) % TEX.ruin.length], tx * TS, ty * TS);
      addSolid(tx * TS, ty * TS + 4, TS, TS - 4);
    }

    // следы колёс / тропа к югу
    for (let y = 230; y < 700; y += 7) {
      const x = pathX(y);
      ditherEllipse(g, x, y, 15, 4, PAL.sand3);
    }
  }

  function pathX(y) { return 430 + Math.sin(y * 0.012) * 42; }

  function scatter() {
    const r = mulberry(2024);
    const keepOut = [
      { x: 220, y: 88, w: 360, h: 132 },   // вагон, вывеска, будка
      { x: 350, y: 620, w: 250, h: 120 },  // южная станция
    ];
    function blocked(x, y) {
      for (const k of keepOut)
        if (x > k.x - 16 && x < k.x + k.w + 16 && y > k.y - 16 && y < k.y + k.h + 16) return true;
      if (Math.abs(x - pathX(y)) < 30) return true;   // не заваливать тропу
      return false;
    }

    for (let i = 0; i < 220; i++) {
      const x = 12 + r() * (W - 40);
      const y = 176 + r() * (H - 220);
      if (blocked(x, y)) continue;
      const t = r();
      if (t < 0.20) {
        addProp(TEX.cactusBig, x, y - TEX.cactusBig.height, 8);
        addSolid(x + 8, y - 6, 8, 6);
      } else if (t < 0.38) {
        addProp(TEX.cactusSmall, x, y - TEX.cactusSmall.height, 6);
        addSolid(x + 5, y - 5, 6, 5);
      } else if (t < 0.55) {
        addProp(TEX.rockBig, x, y - TEX.rockBig.height, 9);
        addSolid(x + 3, y - 6, 13, 6);
      } else if (t < 0.74) {
        addProp(TEX.rockSmall, x, y - TEX.rockSmall.height, 6);
      } else if (t < 0.95) {
        addProp(TEX.bush, x, y - TEX.bush.height, 7);
      } else {
        addProp(TEX.skull, x, y - TEX.skull.height, 7);
      }
    }
  }

  function buildObjects() {
    // брошенный вагон слева
    addProp(TEX.train, LAY.train.x, LAY.train.y, 52);
    addSpot('train', LAY.train.x, 138, 108, 40);
    addSpot('cabin', LAY.train.x + 104, 138, 24, 40);

    // вывеска станции по центру
    addProp(TEX.sign, LAY.sign.x, LAY.sign.y, 32);
    addSolid(LAY.sign.x + 8, LAY.sign.y + 36, 6, 8);
    addSolid(LAY.sign.x + 71, LAY.sign.y + 36, 6, 8);
    addSpot('sign', LAY.sign.x, LAY.sign.y + 26, 84, 26);

    // будка справа
    addProp(TEX.shack, LAY.shack.x, LAY.shack.y, 34);
    addSolid(LAY.shack.x + 6, LAY.shack.y + 40, 66, 30);
    addSpot('shack', LAY.shack.x, LAY.shack.y + 62, 78, 24);

    // сломанные рельсы восточнее вагона
    addSpot('rails', 352, 128, 120, 44);

    // колодец
    addProp(TEX.well, 792, 336, 13);
    addSolid(794, 348, 20, 10);
    addSpot('well', 786, 352, 34, 22);

    // указатель на юг
    addProp(TEX.signpost, 556, 300, 7);
    addSolid(562, 322, 6, 6);
    addSpot('post', 550, 318, 30, 20);

    // южная станция: рычаг вызова поезда
    addProp(TEX.leverUp, 470, 640, 7);
    addSpot('lever', 458, 648, 34, 28);
    addProp(TEX.sign08, 368, 606, 32);
    addSolid(376, 642, 6, 6);
    addSolid(439, 642, 6, 6);
    addSpot('sign08', 368, 632, 84, 22);
    addProp(TEX.bush, 546, 664, 7);
    addProp(TEX.rockSmall, 404, 690, 6);

    // обжитая мелочь вокруг станции
    addProp(TEX.rockSmall, 268, 226, 6);
    addProp(TEX.bush, 552, 236, 7);
    addProp(TEX.cactusSmall, 246, 188, 6);
    addProp(TEX.skull, 500, 268, 7);
    addProp(TEX.rockBig, 600, 208, 9);
    addProp(TEX.cactusBig, 604, 112, 8);
    addProp(TEX.cactusSmall, 432, 126, 6);
    addProp(TEX.bush, 356, 142, 7);
    addProp(TEX.rockSmall, 196, 158, 6);
    addProp(TEX.cactusSmall, 118, 140, 6);
    addProp(TEX.rockBig, 60, 162, 9);
    addProp(TEX.bush, 30, 190, 7);
    addProp(TEX.cactusBig, 700, 150, 8);
    addProp(TEX.bush, 660, 196, 7);

    // обжитый скарб у будки и у вагона
    addProp(TEX.barrel, 574, 168, 7);
    addSolid(576, 180, 10, 5);
    addProp(TEX.crate, 552, 186, 8);
    addSolid(554, 194, 14, 5);
    addProp(TEX.crate, 300, 176, 8);
    addSolid(302, 184, 14, 5);
    addProp(TEX.barrel, 262, 166, 7);
    addProp(TEX.crate, 430, 654, 8);
  }

  function makeMonster(cfg) {
    return Object.assign({
      x: 0, y: 0, homeX: 0, homeY: 0, t: Math.random() * 6,
      vx: 0, vy: 0, alive: true, defeated: false, spared: false,
      frame: 0, animT: 0, cool: 0,
    }, cfg);
  }

  function buildMonsters() {
    monsters = [
      makeMonster({
        id: 0, sprite: 0, name: 'ПЕСКОЕД', hp: 24, maxhp: 24, atk: 4,
        x: 268, y: 330, homeX: 268, homeY: 330, r: 70,
      }),
      makeMonster({
        id: 1, sprite: 1, name: 'СТЕРВЯТНИК', hp: 30, maxhp: 30, atk: 5,
        x: 700, y: 452, homeX: 700, homeY: 452, r: 80,
      }),
      makeMonster({
        id: 2, sprite: 2, name: 'ГОНЧАЯ ДЮН', hp: 36, maxhp: 36, atk: 6,
        x: 430, y: 556, homeX: 430, homeY: 556, r: 60,
      }),
    ];
  }

  function build() {
    props.length = 0; solids.length = 0; spots.length = 0;
    buildTerrain();
    buildObjects();
    scatter();
    buildMonsters();
    props.sort((a, b) => a.sortY - b.sortY);
  }

  // ------------------------------------------------------------ физика

  function hits(x, y) {
    const bx = x - 5, by = y - 5, bw = 10, bh = 5;
    if (bx < 6 || bx + bw > W - 6 || by < LAY.minY || by + bh > H - 24) return true;
    for (const s of solids) {
      if (bx < s.x + s.w && bx + bw > s.x && by < s.y + s.h && by + bh > s.y) return true;
    }
    return false;
  }

  function tryMove(e, dx, dy) {
    if (dx && !hits(e.x + dx, e.y)) e.x += dx;
    if (dy && !hits(e.x, e.y + dy)) e.y += dy;
  }

  function facingSpot() {
    const off = { down: [0, 12], up: [0, -14], left: [-13, -4], right: [13, -4] }[player.dir];
    const fx = player.x + off[0], fy = player.y - 4 + off[1];
    // щуп 18x18 — чтобы не приходилось попадать пиксель в пиксель
    const px0 = fx - 9, py0 = fy - 9, ps = 18;
    let best = null, bd = 1e9;
    for (const s of spots) {
      if (px0 < s.x + s.w && px0 + ps > s.x && py0 < s.y + s.h && py0 + ps > s.y) {
        const d = Math.hypot(s.x + s.w / 2 - fx, s.y + s.h / 2 - fy);
        if (d < bd) { bd = d; best = s; }
      }
    }
    return best;
  }

  // ------------------------------------------------------------ обновление

  function update(dt, allowInput) {
    const v = allowInput ? Input.moveVector() : { x: 0, y: 0 };
    player.moving = (v.x !== 0 || v.y !== 0);
    if (player.moving) {
      if (Math.abs(v.x) > Math.abs(v.y)) player.dir = v.x < 0 ? 'left' : 'right';
      else player.dir = v.y < 0 ? 'up' : 'down';
      tryMove(player, v.x * player.speed * dt, v.y * player.speed * dt);
      player.animT += dt * (0.6 + Math.hypot(v.x, v.y));
      if (player.animT > 0.28) { player.animT = 0; player.frame ^= 1; }
    } else {
      player.frame = 0;
    }

    let touched = null;
    for (const m of monsters) {
      if (!m.alive) continue;
      m.t += dt;
      m.animT += dt;
      if (m.animT > 0.35) { m.animT = 0; m.frame ^= 1; }
      const dx = player.x - m.x, dy = player.y - m.y;
      const d = Math.hypot(dx, dy);
      if (d < 110 && allowInput) {
        // заметил — идёт к игроку
        m.x += (dx / d) * 26 * dt;
        m.y += (dy / d) * 26 * dt;
      } else {
        // бродит вокруг своей точки
        const ax = m.homeX + Math.cos(m.t * 0.5) * m.r;
        const ay = m.homeY + Math.sin(m.t * 0.37) * m.r * 0.6;
        const ddx = ax - m.x, ddy = ay - m.y;
        const dd = Math.hypot(ddx, ddy) || 1;
        m.x += (ddx / dd) * 14 * dt;
        m.y += (ddy / dd) * 14 * dt;
      }
      if (d < 15) touched = m;
    }
    return touched;
  }

  // ------------------------------------------------------------ отрисовка

  function camera(g) {
    const cx = Math.max(0, Math.min(W - 320, Math.round(player.x - 160)));
    const cy = Math.max(0, Math.min(H - 240, Math.round(player.y - 130)));
    return { x: cx, y: cy };
  }

  function shadow(g, x, y, rx) {
    ditherEllipse(g, x, y, rx, Math.max(2, Math.round(rx * 0.44)), 'rgba(52,34,12,0.46)');
  }

  function draw(g, flashT) {
    const cam = camera();
    g.save();
    g.translate(-cam.x, -cam.y);

    g.drawImage(bg, cam.x, cam.y, 320, 240, cam.x, cam.y, 320, 240);

    // всё, что сортируется по глубине
    const list = [];
    for (const p of props) {
      if (p.x > cam.x + 330 || p.x + p.img.width < cam.x - 10) continue;
      if (p.y > cam.y + 250 || p.y + p.img.height < cam.y - 10) continue;
      list.push({
        sortY: p.sortY, draw: () => {
          if (p.sh) shadow(g, p.x + p.img.width / 2, p.y + p.img.height - 2, p.sh);
          g.drawImage(p.img, p.x, p.y);
        }
      });
    }
    for (const m of monsters) {
      if (!m.alive) continue;
      const img = TEX.monsterSmall[m.sprite][m.frame];
      const x = Math.round(m.x - 16), y = Math.round(m.y - 26);
      list.push({
        sortY: m.y, draw: () => {
          shadow(g, m.x, m.y - 1, 11);
          g.drawImage(img, x, y);
        }
      });
    }
    const pimg = TEX.player[player.dir][player.frame];
    list.push({
      sortY: player.y, draw: () => {
        shadow(g, player.x, player.y - 1, 8);
        g.drawImage(pimg, Math.round(player.x - 8), Math.round(player.y - 19));
      }
    });
    list.sort((a, b) => a.sortY - b.sortY);
    for (const it of list) it.draw();

    g.restore();

    // цветокоррекция кадра: тёплый свет, контраст, тёмные углы
    g.globalCompositeOperation = 'soft-light';
    g.fillStyle = 'rgba(255,186,96,0.34)';
    g.fillRect(0, 0, 320, 240);
    g.globalCompositeOperation = 'source-over';

    const warm = g.createLinearGradient(0, 0, 0, 240);
    warm.addColorStop(0, 'rgba(78,52,20,0.16)');
    warm.addColorStop(0.35, 'rgba(240,208,150,0.03)');
    warm.addColorStop(1, 'rgba(64,42,16,0.12)');
    g.fillStyle = warm;
    g.fillRect(0, 0, 320, 240);

    const grd = g.createRadialGradient(160, 112, 46, 160, 120, 232);
    grd.addColorStop(0, 'rgba(0,0,0,0)');
    grd.addColorStop(0.58, 'rgba(48,28,8,0.16)');
    grd.addColorStop(1, 'rgba(30,17,4,0.52)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 320, 240);
  }

  return {
    W, H, TS, player, build, update, draw, facingSpot, camera,
    get monsters() { return monsters; },
  };
})();
