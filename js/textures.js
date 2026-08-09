/* Процедурная пиксельная графика. Никаких внешних файлов —
   все спрайты рисуются в offscreen-канвасы при загрузке. */

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  return c;
}

function ctxOf(c) { return c.getContext('2d'); }

// детерминированный ГПСЧ
function mulberry(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function px(g, x, y, w, h, color) {
  g.fillStyle = color;
  g.fillRect(x | 0, y | 0, w | 0, h | 0);
}

// пиксельный эллипс
function ellipse(g, cx, cy, rx, ry, color) {
  g.fillStyle = color;
  for (let y = -ry; y <= ry; y++) {
    const t = 1 - (y * y) / (ry * ry);
    if (t <= 0) continue;
    const w = Math.round(rx * Math.sqrt(t));
    g.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2 + 1, 1);
  }
}

// эллипс с дизерингом по краю — так пятна песка остаются пиксельными
function ditherEllipse(g, cx, cy, rx, ry, color) {
  g.fillStyle = color;
  for (let y = -ry; y <= ry; y++) {
    for (let x = -rx; x <= rx; x++) {
      const d = Math.sqrt((x * x) / (rx * rx) + (y * y) / (ry * ry));
      if (d > 1) continue;
      const X = Math.round(cx + x), Y = Math.round(cy + y);
      const chess = ((X + Y) & 1) === 0;
      if (d < 0.78 || (chess && d < 0.94) || (((X * 3 + Y) & 3) === 0)) {
        g.fillRect(X, Y, 1, 1);
      }
    }
  }
}

// перекраска силуэта в один цвет
function tintCanvas(c, color) {
  const o = makeCanvas(c.width, c.height);
  const g = ctxOf(o);
  g.drawImage(c, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = color;
  g.fillRect(0, 0, o.width, o.height);
  return o;
}

// тёмный контур по силуэту — главный приём референса
function outlined(c, color, diagonals) {
  const o = makeCanvas(c.width + 2, c.height + 2);
  const g = ctxOf(o);
  const t = tintCanvas(c, color || PAL.ink2);
  const offs = diagonals === false
    ? [[1, 0], [0, 1], [2, 1], [1, 2]]
    : [[1, 0], [0, 1], [2, 1], [1, 2], [0, 0], [2, 0], [0, 2], [2, 2]];
  for (const [dx, dy] of offs) g.drawImage(t, dx, dy);
  g.drawImage(c, 1, 1);
  return o;
}

// спрайт из текстовой карты пикселей
function sprite(rows, map, scale) {
  scale = scale || 1;
  const h = rows.length;
  let w = 0;
  for (const r of rows) w = Math.max(w, r.length);
  const c = makeCanvas(w * scale, h * scale);
  const g = ctxOf(c);
  for (let y = 0; y < h; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      const col = map[row[x]];
      if (col) { g.fillStyle = col; g.fillRect(x * scale, y * scale, scale, scale); }
    }
  }
  return c;
}

// ---------------------------------------------------------------- персонаж

const PMAP = {
  k: PAL.hair, s: PAL.skin, d: PAL.skinD, e: '#16110d',
  c: PAL.shirt, v: PAL.shirtD, p: PAL.pants, b: PAL.boot,
};

const PLAYER_DOWN_A = [
  '...kkkkkkkk...',
  '..kkkkkkkkkk..',
  '..kkkkkkkkkk..',
  '..kssssssssk..',
  '..kssessessk..',
  '..kssssssssk..',
  '...sssddsss...',
  '....ssssss....',
  '..vccccccccv..',
  '..vccccccccv..',
  '..vccccccccv..',
  '..vccccccccv..',
  '..sccccccccs..',
  '...pppppppp...',
  '...pppppppp...',
  '...ppp..ppp...',
  '...ppp..ppp...',
  '...bbb..bbb...',
];

const PLAYER_DOWN_B = [
  '...kkkkkkkk...',
  '..kkkkkkkkkk..',
  '..kkkkkkkkkk..',
  '..kssssssssk..',
  '..kssessessk..',
  '..kssssssssk..',
  '...sssddsss...',
  '....ssssss....',
  '..vccccccccv..',
  '..vccccccccv..',
  '..vccccccccv..',
  '..vccccccccv..',
  '..sccccccccs..',
  '...pppppppp...',
  '...pppppppp...',
  '...ppp..ppp...',
  '..ppp....ppp..',
  '..bbb....bbb..',
];

const PLAYER_UP_A = [
  '...kkkkkkkk...',
  '..kkkkkkkkkk..',
  '..kkkkkkkkkk..',
  '..kkkkkkkkkk..',
  '..kkkkkkkkkk..',
  '..kkkkkkkkkk..',
  '...kkkkkkkk...',
  '....ssssss....',
  '..vccccccccv..',
  '..vccccccccv..',
  '..vccccccccv..',
  '..vccccccccv..',
  '..sccccccccs..',
  '...pppppppp...',
  '...pppppppp...',
  '...ppp..ppp...',
  '...ppp..ppp...',
  '...bbb..bbb...',
];

const PLAYER_UP_B = [
  '...kkkkkkkk...',
  '..kkkkkkkkkk..',
  '..kkkkkkkkkk..',
  '..kkkkkkkkkk..',
  '..kkkkkkkkkk..',
  '..kkkkkkkkkk..',
  '...kkkkkkkk...',
  '....ssssss....',
  '..vccccccccv..',
  '..vccccccccv..',
  '..vccccccccv..',
  '..vccccccccv..',
  '..sccccccccs..',
  '...pppppppp...',
  '...pppppppp...',
  '...ppp..ppp...',
  '..ppp....ppp..',
  '..bbb....bbb..',
];

const PLAYER_SIDE_A = [
  '...kkkkkkkk...',
  '..kkkkkkkkkk..',
  '..kkkkkkkkkk..',
  '..kkkssssss...',
  '..kkkssesss...',
  '..kkkssssss...',
  '...kkssssd....',
  '....ssssss....',
  '...vcccccc....',
  '...vcccccc....',
  '...vcccccc....',
  '...vcccccc....',
  '...vccccccs...',
  '...pppppp.....',
  '...pppppp.....',
  '...ppppp......',
  '...pp..pp.....',
  '..bbb..bbb....',
];

const PLAYER_SIDE_B = [
  '...kkkkkkkk...',
  '..kkkkkkkkkk..',
  '..kkkkkkkkkk..',
  '..kkkssssss...',
  '..kkkssesss...',
  '..kkkssssss...',
  '...kkssssd....',
  '....ssssss....',
  '...vcccccc....',
  '...vcccccc....',
  '...vcccccc....',
  '...vcccccc....',
  '..scccccc.....',
  '...pppppp.....',
  '...pppppp.....',
  '..ppp.ppp.....',
  '..pp...ppp....',
  '.bbb....bbb...',
];

function flipH(c) {
  const o = makeCanvas(c.width, c.height);
  const g = ctxOf(o);
  g.translate(c.width, 0);
  g.scale(-1, 1);
  g.drawImage(c, 0, 0);
  return o;
}

// ---------------------------------------------------------------- земля

function makeGroundTile(seed) {
  const c = makeCanvas(16, 16);
  const g = ctxOf(c);
  const r = mulberry(seed);
  px(g, 0, 0, 16, 16, PAL.sand1);
  // мелкое зерно песка — тона рядом друг с другом, чтобы не рябило
  for (let i = 0; i < 16; i++) {
    px(g, (r() * 16) | 0, (r() * 16) | 0, 1, 1, r() > 0.45 ? PAL.sand0 : PAL.sand2);
  }
  for (let i = 0; i < 3; i++) {
    px(g, (r() * 15) | 0, (r() * 15) | 0, 1 + ((r() * 2) | 0), 1, PAL.sand3);
  }
  // галька с тенью
  if (r() > 0.62) {
    const x = 2 + ((r() * 11) | 0), y = 2 + ((r() * 11) | 0);
    px(g, x, y, 2, 2, PAL.rockM);
    px(g, x, y, 1, 1, PAL.rockL);
    px(g, x, y + 2, 2, 1, PAL.sandShadow);
  }
  return c;
}

function makeDuneTile(seed) {
  const c = makeCanvas(16, 16);
  const g = ctxOf(c);
  const r = mulberry(seed);
  px(g, 0, 0, 16, 16, PAL.sand2);
  for (let i = 0; i < 26; i++) {
    px(g, (r() * 16) | 0, (r() * 16) | 0, 1, 1, r() > 0.5 ? PAL.sand1 : PAL.sand3);
  }
  // рябь по песку
  for (let y = 1; y < 16; y += 5) {
    const off = (r() * 5) | 0;
    px(g, off, y, 8, 1, PAL.sandDark);
    px(g, off + 1, y + 1, 7, 1, PAL.sand0);
    px(g, (off + 8) % 16, y + 2, 7, 1, PAL.sandDark);
    px(g, (off + 9) % 16, y + 3, 6, 1, PAL.sand0);
  }
  return c;
}

// ---------------------------------------------------------------- растения

// ветка кактуса: сегмент с тремя тонами и рёбрами
function cactusLimb(g, x, y, w, h) {
  px(g, x, y + 1, w, h - 1, PAL.cacM);
  px(g, x + 1, y, w - 2, 1, PAL.cacM);          // скруглённая макушка
  px(g, x, y + 2, 2, h - 3, PAL.cacL);
  px(g, x + 1, y + 1, 1, 1, PAL.cacL);
  px(g, x + w - 2, y + 2, 2, h - 3, PAL.cacD);
  px(g, x + 2, y + 3, 1, h - 6, shade(PAL.cacM, 10));
}

function makeCactusBig() {
  const c = makeCanvas(24, 42);
  const g = ctxOf(c);
  cactusLimb(g, 9, 2, 7, 40);                    // ствол
  // левая рука
  px(g, 4, 20, 6, 4, PAL.cacM);
  px(g, 4, 20, 6, 1, PAL.cacL);
  px(g, 4, 23, 6, 1, PAL.cacD);
  cactusLimb(g, 3, 12, 5, 12);
  // правая рука
  px(g, 15, 26, 6, 4, PAL.cacM);
  px(g, 15, 26, 6, 1, PAL.cacL);
  px(g, 15, 29, 6, 1, PAL.cacD);
  cactusLimb(g, 17, 17, 5, 13);
  // иголки
  const r = mulberry(7);
  for (let i = 0; i < 30; i++) {
    const arm = r();
    if (arm < 0.6) px(g, 10 + ((r() * 6) | 0), 4 + ((r() * 36) | 0), 1, 1, PAL.cacD);
    else if (arm < 0.8) px(g, 4 + ((r() * 4) | 0), 13 + ((r() * 10) | 0), 1, 1, PAL.cacD);
    else px(g, 18 + ((r() * 4) | 0), 18 + ((r() * 11) | 0), 1, 1, PAL.cacD);
  }
  return outlined(c, PAL.ink2);
}

function makeCactusSmall() {
  const c = makeCanvas(16, 24);
  const g = ctxOf(c);
  cactusLimb(g, 6, 2, 6, 22);
  px(g, 2, 13, 5, 3, PAL.cacM);
  px(g, 2, 13, 5, 1, PAL.cacL);
  cactusLimb(g, 1, 7, 4, 9);
  px(g, 11, 16, 4, 3, PAL.cacM);
  px(g, 11, 16, 4, 1, PAL.cacL);
  const r = mulberry(19);
  for (let i = 0; i < 14; i++) px(g, 6 + ((r() * 5) | 0), 4 + ((r() * 18) | 0), 1, 1, PAL.cacD);
  return outlined(c, PAL.ink2);
}

function makeBush() {
  const c = makeCanvas(20, 14);
  const g = ctxOf(c);
  const r = mulberry(33);
  // куст сухих веток: сначала тёмный «объём», сверху светлые прутья
  for (let i = 0; i < 22; i++) {
    const x = 3 + ((r() * 14) | 0);
    const y = 4 + ((r() * 7) | 0);
    px(g, x, y, 2, 2 + ((r() * 3) | 0), PAL.bushD);
  }
  for (let i = 0; i < 26; i++) {
    const x = 3 + ((r() * 15) | 0);
    const y = 2 + ((r() * 8) | 0);
    const len = 2 + ((r() * 4) | 0);
    px(g, x, y, 1, len, PAL.bushL);
    px(g, x + 1, y + len - 1, 1, 1, PAL.bushD);
  }
  return c;
}

function makeRock(size) {
  const w = size === 'big' ? 18 : 11;
  const h = size === 'big' ? 13 : 8;
  const c = makeCanvas(w, h);
  const g = ctxOf(c);
  ellipse(g, w / 2, h - 3, w / 2 - 1, h / 2, PAL.rockD);
  ellipse(g, w / 2, h - 4, w / 2 - 2, h / 2 - 1, PAL.rockM);
  ellipse(g, w / 2 - 1.5, h - 5, w / 2 - 4, h / 2 - 2.4, PAL.rockL);
  // скол
  px(g, (w / 2) | 0, h - 6, 2, 1, shade(PAL.rockL, 16));
  return outlined(c, PAL.ink2);
}

function makeSkull() {
  const c = makeCanvas(16, 12);
  const g = ctxOf(c);
  ellipse(g, 6, 5, 5, 4, PAL.bone);
  ellipse(g, 5, 4, 3, 2, shade(PAL.bone, 12));
  px(g, 3, 4, 2, 2, '#3d3729');
  px(g, 7, 4, 2, 2, '#3d3729');
  px(g, 5, 8, 3, 2, PAL.bone);
  px(g, 4, 9, 1, 1, '#3d3729');
  px(g, 8, 9, 1, 1, '#3d3729');
  px(g, 10, 3, 4, 1, PAL.bone);
  px(g, 11, 5, 4, 1, PAL.bone);
  return outlined(c, PAL.ink2);
}

// ---------------------------------------------------------------- постройки

function makeTrainCar() {
  const W = 124, H = 60;
  const c = makeCanvas(W, H);
  const g = ctxOf(c);
  const r = mulberry(101);

  // корпус
  px(g, 2, 10, W - 4, 36, PAL.rustM);
  px(g, 2, 10, W - 4, 5, PAL.rustL);
  px(g, 2, 38, W - 4, 8, PAL.rustD);
  px(g, 2, 36, W - 4, 2, shade(PAL.rustM, -14));
  // крыша с выносом
  px(g, 0, 3, W, 8, PAL.metM);
  px(g, 0, 3, W, 3, PAL.metL);
  px(g, 0, 9, W, 2, PAL.metD);
  px(g, 0, 2, W, 1, shade(PAL.metL, 18));
  // рёбра корпуса
  for (let x = 7; x < W - 6; x += 11) px(g, x, 12, 1, 26, shade(PAL.rustD, 8));
  // окна — тёмные провалы, как в брошенном вагоне
  for (let i = 0; i < 5; i++) {
    const wx = 8 + i * 22;
    px(g, wx, 15, 16, 17, PAL.ink3);
    px(g, wx + 1, 16, 14, 15, '#221c16');
    px(g, wx + 1, 16, 14, 2, '#4b4238');       // блик по верхней кромке
    px(g, wx + 1, 29, 14, 2, '#3a332a');
    if (i === 1 || i === 3) {                   // уцелевшее мутное стекло
      px(g, wx + 2, 17, 12, 12, PAL.glass);
      px(g, wx + 2, 17, 12, 3, shade(PAL.glass, 26));
      px(g, wx + 8, 20, 4, 8, shade(PAL.glass, 14));
    }
  }
  // дверь
  px(g, 52, 12, 20, 32, PAL.rustD);
  px(g, 54, 14, 16, 28, shade(PAL.rustM, -12));
  px(g, 57, 17, 10, 11, PAL.ink3);
  px(g, 58, 18, 8, 9, '#2a231c');
  px(g, 66, 33, 3, 2, PAL.metL);
  px(g, 54, 14, 16, 1, shade(PAL.rustL, -10));

  // ржавые потёки
  for (let i = 0; i < 90; i++) {
    const x = 3 + ((r() * (W - 6)) | 0);
    const y = 11 + ((r() * 34) | 0);
    px(g, x, y, 1, 1 + ((r() * 4) | 0), r() > 0.45 ? PAL.rustD : PAL.rustL);
  }
  // ходовая и колёса
  px(g, 8, 46, W - 16, 5, PAL.metD);
  for (const wx of [22, 46, 78, 102]) {
    ellipse(g, wx, 52, 7, 6, PAL.ink3);
    ellipse(g, wx, 52, 5, 4, PAL.metM);
    ellipse(g, wx, 52, 2, 2, PAL.metD);
  }
  // песок, наметённый на колёса
  for (let i = 0; i < 26; i++) {
    px(g, 6 + ((r() * (W - 12)) | 0), 54 + ((r() * 5) | 0), 2, 1, PAL.sand2);
  }
  return outlined(c, PAL.ink3);
}

function makeStationSign(text) {
  text = text || 'СТАНЦИЯ 07';
  const W = 84, H = 46;
  const c = makeCanvas(W, H);
  const g = ctxOf(c);
  // столбы
  px(g, 8, 12, 5, 34, PAL.woodM);
  px(g, 8, 12, 2, 34, PAL.woodL);
  px(g, 71, 12, 5, 34, PAL.woodM);
  px(g, 71, 12, 2, 34, PAL.woodL);
  // доска
  px(g, 2, 6, W - 4, 20, PAL.woodD);
  px(g, 4, 8, W - 8, 16, PAL.woodM);
  px(g, 4, 8, W - 8, 3, PAL.woodL);
  px(g, 4, 21, W - 8, 3, shade(PAL.woodM, -14));
  // текст
  const tx = Math.round((W - Font.width(text, 1)) / 2);
  Font.draw(g, text, tx, 12, PAL.woodD, 1);
  Font.draw(g, text, tx, 11, '#e5d3ab', 1);
  // потёртости
  const r = mulberry(55);
  for (let i = 0; i < 30; i++) px(g, 4 + ((r() * (W - 8)) | 0), 8 + ((r() * 16) | 0), 1, 1, r() > .5 ? PAL.woodL : PAL.woodD);
  return outlined(c, PAL.ink3);
}

function makeShack() {
  const W = 86, H = 78;
  const c = makeCanvas(W, H);
  const g = ctxOf(c);
  const r = mulberry(77);

  // стена из горизонтальных досок
  px(g, 9, 24, W - 18, 48, PAL.woodM);
  for (let y = 24; y < 72; y += 6) {
    px(g, 9, y, W - 18, 1, PAL.woodL);
    px(g, 9, y + 5, W - 18, 1, PAL.woodD);
  }
  // вертикальные стойки по углам
  px(g, 9, 24, 3, 48, PAL.woodD);
  px(g, W - 12, 24, 3, 48, PAL.woodD);

  // тёмный дверной проём с глубиной
  px(g, 20, 34, 22, 38, PAL.ink3);
  px(g, 22, 36, 18, 34, '#181009');
  px(g, 22, 36, 18, 3, '#241a10');
  px(g, 38, 36, 2, 34, '#2a1e12');

  // объявление под стеклом
  px(g, 52, 38, 18, 15, PAL.woodD);
  px(g, 53, 39, 16, 13, '#d3c39a');
  for (let i = 0; i < 6; i++) px(g, 55, 41 + i * 2, 10 + ((r() * 4) | 0), 1, '#8a7a55');
  px(g, 53, 39, 16, 1, '#eadcb8');

  // крыльцо
  px(g, 6, 66, W - 12, 8, PAL.woodD);
  px(g, 6, 66, W - 12, 2, PAL.woodM);
  for (let x = 8; x < W - 8; x += 7) px(g, x, 68, 1, 6, shade(PAL.woodD, -14));

  // столбы навеса
  for (const x of [8, W - 12]) {
    px(g, x, 22, 5, 46, PAL.woodM);
    px(g, x, 22, 2, 46, PAL.woodL);
    px(g, x + 4, 22, 1, 46, PAL.woodD);
  }

  // скатная крыша с дранкой
  for (let i = 0; i < 11; i++) {
    const y = 6 + i * 2;
    const inset = i * 3;
    px(g, 1 + inset, y, W - 2 - inset * 2, 2, i % 2 ? PAL.roofD : PAL.roofL);
    px(g, 1 + inset, y + 1, W - 2 - inset * 2, 1, shade(PAL.roofD, -6));
  }
  px(g, 0, 20, W, 6, PAL.roofD);
  px(g, 0, 20, W, 2, PAL.roofL);
  px(g, 0, 25, W, 1, PAL.ink3);
  // тень от навеса на стене
  px(g, 9, 26, W - 18, 3, shade(PAL.woodM, -26));

  // потёртости
  for (let i = 0; i < 60; i++) {
    px(g, 10 + ((r() * (W - 22)) | 0), 26 + ((r() * 44) | 0), 1, 1, r() > .5 ? PAL.woodL : PAL.woodD);
  }
  return outlined(c, PAL.ink3);
}

function makePlatform() {
  const c = makeCanvas(16, 16);
  const g = ctxOf(c);
  px(g, 0, 0, 16, 16, PAL.woodM);
  px(g, 0, 0, 16, 1, PAL.woodL);
  px(g, 0, 7, 16, 1, PAL.woodD);
  px(g, 0, 15, 16, 1, PAL.woodD);
  const r = mulberry(12);
  for (let i = 0; i < 18; i++) px(g, (r() * 16) | 0, (r() * 16) | 0, 1, 1, r() > .5 ? PAL.woodL : PAL.woodD);
  return c;
}

function makeRailTile(broken) {
  const c = makeCanvas(16, 16);
  const g = ctxOf(c);
  // шпалы
  for (let x = 1; x < 16; x += 6) px(g, x, 2, 4, 12, PAL.tie);
  for (let x = 1; x < 16; x += 6) px(g, x, 2, 4, 1, shade(PAL.tie, 18));
  if (!broken) {
    px(g, 0, 4, 16, 2, PAL.railD);
    px(g, 0, 4, 16, 1, PAL.railL);
    px(g, 0, 10, 16, 2, PAL.railD);
    px(g, 0, 10, 16, 1, PAL.railL);
  } else {
    px(g, 0, 4, 7, 2, PAL.railD);
    px(g, 0, 4, 7, 1, PAL.railL);
    px(g, 9, 3, 5, 2, PAL.railD);
    px(g, 0, 10, 5, 2, PAL.railD);
    px(g, 0, 10, 5, 1, PAL.railL);
    px(g, 8, 12, 6, 2, PAL.railD);
  }
  return c;
}

function makeRuinWall(seed) {
  const c = makeCanvas(16, 16);
  const g = ctxOf(c);
  const r = mulberry(seed || 91);
  // верхняя грань стены
  px(g, 0, 1, 16, 4, PAL.rockL);
  px(g, 0, 1, 16, 1, shade(PAL.rockL, 14));
  // передняя грань с кладкой
  px(g, 0, 5, 16, 8, PAL.rockM);
  px(g, 0, 5, 16, 1, PAL.ink2);
  for (let y = 5; y < 13; y += 4) {
    px(g, 0, y + 3, 16, 1, shade(PAL.rockD, 6));
    const off = (r() * 8) | 0;
    for (let x = off; x < 16; x += 8) px(g, x, y, 1, 4, shade(PAL.rockD, 6));
  }
  // выкрошенные камни
  for (let i = 0; i < 10; i++) {
    px(g, (r() * 16) | 0, 5 + ((r() * 7) | 0), 1 + ((r() * 2) | 0), 1, r() > .5 ? PAL.rockL : PAL.rockD);
  }
  // тень и занос песком у основания
  ditherEllipse(g, 8, 14, 9, 3, 'rgba(52,34,12,0.42)');
  for (let i = 0; i < 20; i++) px(g, (r() * 16) | 0, 11 + ((r() * 4) | 0), 2, 1, PAL.sand2);
  return c;
}

function makeWell() {
  const c = makeCanvas(24, 24);
  const g = ctxOf(c);
  ellipse(g, 12, 18, 10, 5, PAL.rockD);
  ellipse(g, 12, 17, 9, 4, PAL.rockM);
  ellipse(g, 12, 16, 6, 3, '#2c3a3a');
  ellipse(g, 12, 16, 4, 2, '#4a6a6a');
  px(g, 4, 4, 3, 12, PAL.woodM);
  px(g, 17, 4, 3, 12, PAL.woodM);
  px(g, 3, 2, 18, 3, PAL.woodD);
  px(g, 11, 5, 1, 6, PAL.metM);
  px(g, 9, 10, 5, 3, PAL.metD);
  return outlined(c, PAL.ink3);
}

function makeLever(pulled) {
  const c = makeCanvas(16, 24);
  const g = ctxOf(c);
  px(g, 3, 16, 10, 6, PAL.metD);
  px(g, 3, 16, 10, 2, PAL.metM);
  if (!pulled) {
    px(g, 7, 4, 2, 13, PAL.metM);
    px(g, 6, 2, 4, 3, PAL.red);
  } else {
    px(g, 8, 12, 5, 2, PAL.metM);
    px(g, 12, 11, 3, 3, PAL.red);
  }
  return outlined(c, PAL.ink3);
}

function makeBarrel() {
  const c = makeCanvas(14, 18);
  const g = ctxOf(c);
  px(g, 1, 2, 12, 15, PAL.woodM);
  px(g, 1, 2, 3, 15, PAL.woodL);
  px(g, 10, 2, 3, 15, PAL.woodD);
  ellipse(g, 7, 3, 6, 2, shade(PAL.woodL, 10));
  ellipse(g, 7, 3, 4, 1, PAL.woodD);
  px(g, 1, 6, 12, 2, PAL.metM);
  px(g, 1, 12, 12, 2, PAL.metM);
  px(g, 1, 7, 12, 1, PAL.metD);
  px(g, 1, 13, 12, 1, PAL.metD);
  const r = mulberry(61);
  for (let i = 0; i < 16; i++) px(g, 2 + ((r() * 10) | 0), 3 + ((r() * 13) | 0), 1, 1, r() > .5 ? PAL.woodL : PAL.woodD);
  return outlined(c, PAL.ink3);
}

function makeCrate() {
  const c = makeCanvas(18, 14);
  const g = ctxOf(c);
  px(g, 1, 2, 16, 11, PAL.woodM);
  px(g, 1, 2, 16, 2, PAL.woodL);
  px(g, 1, 11, 16, 2, PAL.woodD);
  px(g, 1, 2, 2, 11, PAL.woodL);
  px(g, 15, 2, 2, 11, PAL.woodD);
  // диагональная планка
  for (let i = 0; i < 10; i++) px(g, 3 + i, 11 - i, 2, 1, PAL.woodD);
  const r = mulberry(83);
  for (let i = 0; i < 14; i++) px(g, 2 + ((r() * 14) | 0), 3 + ((r() * 9) | 0), 1, 1, r() > .5 ? PAL.woodL : PAL.woodD);
  return outlined(c, PAL.ink3);
}

function makeSignpost() {
  const c = makeCanvas(20, 28);
  const g = ctxOf(c);
  px(g, 8, 6, 4, 22, PAL.woodM);
  px(g, 8, 6, 2, 22, PAL.woodL);
  px(g, 1, 6, 18, 7, PAL.woodD);
  px(g, 2, 7, 16, 5, PAL.woodM);
  px(g, 3, 9, 3, 1, PAL.woodD);
  px(g, 8, 9, 8, 1, PAL.woodD);
  px(g, 3, 14, 14, 6, PAL.woodD);
  px(g, 4, 15, 12, 4, PAL.woodM);
  px(g, 6, 16, 8, 1, PAL.woodD);
  return outlined(c, PAL.ink3);
}

// ---------------------------------------------------------------- монстры

// «Пескоед» — личинка-падальщик. u — размер пикселя.
function drawMonster1(g, u, t) {
  const P = (x, y, w, h, col) => px(g, x * u, y * u, w * u, h * u, col);
  const wob = Math.sin(t * 3) > 0 ? 0 : 1;
  // сегменты тела
  for (let i = 0; i < 3; i++) {
    const cx = 16 - i * 5, cy = 17 + (i === 1 ? wob : 0);
    ellipse(g, cx * u, cy * u, (4 - i * 0.4) * u, (3.4 - i * 0.4) * u, PAL.m1D);
    ellipse(g, cx * u, (cy - 0.5) * u, (3.2 - i * 0.4) * u, (2.6 - i * 0.4) * u, PAL.m1M);
    ellipse(g, (cx - 0.6) * u, (cy - 1.1) * u, (2 - i * 0.3) * u, (1.2 - i * 0.2) * u, PAL.m1L);
  }
  // голова
  ellipse(g, 21 * u, 15 * u, 5 * u, 4.4 * u, PAL.m1D);
  ellipse(g, 21 * u, 14.4 * u, 4 * u, 3.4 * u, PAL.m1M);
  ellipse(g, 20 * u, 13 * u, 2.4 * u, 1.4 * u, PAL.m1L);
  // жвалы
  P(24, 15, 3, 1, PAL.m1D);
  P(26, 14, 1, 2, PAL.bone);
  P(24, 17, 3, 1, PAL.m1D);
  P(26, 17, 1, 2, PAL.bone);
  // глаза
  P(20, 13, 2, 2, '#f0e6cc');
  P(21, 14, 1, 1, '#141009');
  P(23, 13, 2, 2, '#f0e6cc');
  P(24, 14, 1, 1, '#141009');
  // ножки
  for (let i = 0; i < 3; i++) {
    P(16 - i * 5, 20 + (i === 1 ? wob : 0), 1, 3, PAL.m1D);
    P(18 - i * 5, 20 + (i === 1 ? wob : 0), 1, 3, PAL.m1D);
  }
}

// «Стервятник» — тощая птица.
function drawMonster2(g, u, t) {
  const P = (x, y, w, h, col) => px(g, x * u, y * u, w * u, h * u, col);
  const flap = Math.sin(t * 2.2) > 0 ? 0 : 1;
  // крылья
  P(2, 8 + flap, 8, 2, PAL.m2D);
  P(4, 10 + flap, 7, 2, PAL.m2M);
  P(22, 8 + flap, 8, 2, PAL.m2D);
  P(21, 10 + flap, 7, 2, PAL.m2M);
  P(1, 6 + flap, 5, 2, PAL.m2M);
  P(26, 6 + flap, 5, 2, PAL.m2M);
  // тело
  ellipse(g, 16 * u, 15 * u, 6 * u, 6.5 * u, PAL.m2D);
  ellipse(g, 16 * u, 15 * u, 4.6 * u, 5.2 * u, PAL.m2M);
  ellipse(g, 14.5 * u, 13 * u, 2.4 * u, 2.2 * u, PAL.m2L);
  // шея и голова
  P(15, 5, 3, 5, PAL.m2M);
  ellipse(g, 16 * u, 5 * u, 3.4 * u, 3 * u, PAL.m2D);
  ellipse(g, 16 * u, 4.6 * u, 2.6 * u, 2.2 * u, '#8b8271');
  // клюв
  P(18, 4, 3, 2, PAL.yellow);
  P(20, 5, 2, 1, shade(PAL.yellow, -40));
  // глаза
  P(15, 3, 2, 2, '#f0e6cc');
  P(16, 4, 1, 1, '#141009');
  P(18, 3, 1, 2, '#f0e6cc');
  // лапы
  P(13, 21, 2, 3, PAL.yellow);
  P(18, 21, 2, 3, PAL.yellow);
  P(12, 24, 4, 1, PAL.yellow);
  P(18, 24, 4, 1, PAL.yellow);
}

// «Гончая дюн» — костлявый пёс.
function drawMonster3(g, u, t) {
  const P = (x, y, w, h, col) => px(g, x * u, y * u, w * u, h * u, col);
  const br = Math.sin(t * 1.7) > 0 ? 0 : 1;
  // хвост
  P(3, 12, 4, 2, PAL.m3M);
  P(1, 9, 2, 4, PAL.m3M);
  // тело
  ellipse(g, 14 * u, (15 + br) * u, 8 * u, 5 * u, PAL.m3D);
  ellipse(g, 14 * u, (14.5 + br) * u, 6.8 * u, 4 * u, PAL.m3M);
  ellipse(g, 12 * u, (13 + br) * u, 4 * u, 2 * u, PAL.m3L);
  // рёбра
  for (let i = 0; i < 3; i++) P(10 + i * 3, 14 + br, 1, 3, PAL.m3D);
  // голова
  ellipse(g, 23 * u, (11 + br) * u, 4.6 * u, 4 * u, PAL.m3D);
  ellipse(g, 23 * u, (10.6 + br) * u, 3.6 * u, 3 * u, PAL.m3M);
  // морда
  P(26, 11 + br, 4, 3, PAL.m3M);
  P(26, 11 + br, 4, 1, PAL.m3L);
  P(29, 12 + br, 1, 1, '#171009');
  // уши
  P(20, 5 + br, 2, 4, PAL.m3D);
  P(24, 5 + br, 2, 4, PAL.m3D);
  P(20, 4 + br, 2, 1, PAL.m3M);
  P(24, 4 + br, 2, 1, PAL.m3M);
  // глаза
  P(22, 9 + br, 2, 2, '#f2e2b8');
  P(23, 10 + br, 1, 1, '#141009');
  P(25, 9 + br, 2, 2, '#f2e2b8');
  P(26, 10 + br, 1, 1, '#141009');
  // зубы
  P(27, 14 + br, 1, 1, PAL.bone);
  P(29, 14 + br, 1, 1, PAL.bone);
  // лапы
  P(8, 19, 2, 5, PAL.m3D);
  P(12, 19, 2, 5, PAL.m3M);
  P(17, 19, 2, 5, PAL.m3M);
  P(20, 19, 2, 5, PAL.m3D);
}

// «Монстр-спаситель» — мягкий, круглый, нелепый.
function drawSaviour(g, u, t) {
  const P = (x, y, w, h, col) => px(g, x * u, y * u, w * u, h * u, col);
  const br = Math.sin(t * 1.4) > 0 ? 0 : 1;
  ellipse(g, 16 * u, (16 + br) * u, 9 * u, 8 * u, '#5c6f6a');
  ellipse(g, 16 * u, (15.4 + br) * u, 7.6 * u, 6.6 * u, '#7d938c');
  ellipse(g, 13 * u, (12 + br) * u, 3.4 * u, 2.4 * u, '#9db3ab');
  // глаза
  P(11, 13 + br, 3, 3, '#f2eada');
  P(12, 14 + br, 2, 2, '#221a12');
  P(18, 13 + br, 3, 3, '#f2eada');
  P(19, 14 + br, 2, 2, '#221a12');
  // улыбка
  P(13, 19 + br, 6, 1, '#2c231a');
  P(12, 18 + br, 1, 1, '#2c231a');
  P(19, 18 + br, 1, 1, '#2c231a');
  // ручки
  P(5, 16 + br, 4, 2, '#5c6f6a');
  P(23, 16 + br, 4, 2, '#5c6f6a');
  // шарф
  P(9, 21, 14, 2, '#a4553f');
  P(9, 23, 4, 3, '#a4553f');
}

function renderMonster(fn, u, t) {
  const c = makeCanvas(32 * u, 28 * u);
  const g = ctxOf(c);
  fn(g, u, t || 0);
  return outlined(c, PAL.ink3);
}

// ---------------------------------------------------------------- прочее

function makeHeart() {
  const rows = [
    '.##.##.',
    '#######',
    '#######',
    '#######',
    '.#####.',
    '..###..',
    '...#...',
  ];
  return sprite(rows, { '#': PAL.red });
}

function makeHeartBroken() {
  const rows = [
    '.#..##.',
    '###..##',
    '####.##',
    '##..###',
    '.#..##.',
    '..#.#..',
    '...#...',
  ];
  return sprite(rows, { '#': PAL.red });
}

// снеговик и кактус для заставки
function drawTitleArt(g, t) {
  const W = 320, H = 240;
  px(g, 0, 0, W, H, '#0a0a0c');
  // дальний фон — снежная равнина
  px(g, 0, 168, W, 72, '#111318');
  // вагон
  const carX = 96, carY = 96, carW = 128, carH = 74;
  px(g, carX, carY, carW, carH, '#15171b');
  px(g, carX, carY - 6, carW, 8, '#1b1e23');
  // светящееся окно
  const glow = 0.85 + Math.sin(t * 1.6) * 0.07;
  const wx = carX + 44, wy = carY + 16, ww = 40, wh = 30;
  g.save();
  g.globalAlpha = 0.10 * glow;
  ellipse(g, wx + ww / 2, wy + wh / 2, 78, 60, '#f0d79a');
  g.globalAlpha = 0.16 * glow;
  ellipse(g, wx + ww / 2, wy + wh / 2, 50, 40, '#f4dfae');
  g.restore();
  px(g, wx - 2, wy - 2, ww + 4, wh + 4, '#3a3428');
  px(g, wx, wy, ww, wh, '#e8cb92');
  px(g, wx + 2, wy + 2, ww - 4, wh - 4, '#f4e3b6');
  px(g, wx + ww / 2 - 1, wy, 2, wh, '#3a3428');
  // пятно света на снегу
  g.save();
  g.globalAlpha = 0.13;
  ellipse(g, wx + ww / 2, 196, 66, 16, '#e6ce97');
  g.restore();

  // снеговик слева (контровой свет по правому краю)
  const sx = 42, sy = 190;
  ellipse(g, sx, sy, 16, 12, '#0e1013');
  ellipse(g, sx, sy - 18, 12, 11, '#0e1013');
  ellipse(g, sx, sy - 34, 9, 8, '#0e1013');
  for (let i = 0; i < 26; i++) {
    const a = -0.9 + i * 0.07;
    px(g, sx + Math.cos(a) * 16 + 1, sy + Math.sin(a) * 12, 1, 1, '#6c6350');
  }
  for (let i = 0; i < 22; i++) {
    const a = -1.0 + i * 0.08;
    px(g, sx + Math.cos(a) * 12 + 1, sy - 18 + Math.sin(a) * 11, 1, 1, '#7a7059');
  }
  for (let i = 0; i < 18; i++) {
    const a = -1.1 + i * 0.09;
    px(g, sx + Math.cos(a) * 9 + 1, sy - 34 + Math.sin(a) * 8, 1, 1, '#8a7e63');
  }
  px(g, sx + 6, sy - 36, 7, 1, '#4a4335');
  px(g, sx + 6, sy - 34, 2, 2, '#3e382c');

  // кактус справа
  const cx = 272, cy = 196;
  px(g, cx, cy - 44, 10, 46, '#0e1013');
  px(g, cx - 12, cy - 30, 12, 7, '#0e1013');
  px(g, cx - 12, cy - 40, 7, 12, '#0e1013');
  px(g, cx + 10, cy - 36, 12, 7, '#0e1013');
  px(g, cx + 17, cy - 48, 6, 14, '#0e1013');
  px(g, cx, cy - 44, 1, 46, '#6d6650');
  px(g, cx - 12, cy - 40, 1, 12, '#5e5844');
  px(g, cx + 22, cy - 48, 1, 14, '#7a7059');
  px(g, cx + 17, cy - 48, 6, 1, '#7a7059');

  // снег
  const r = mulberry(5);
  for (let i = 0; i < 60; i++) {
    const x = (r() * W) | 0;
    const y = ((r() * H + t * (8 + r() * 14)) % H) | 0;
    px(g, x, y, 1, 1, r() > 0.6 ? '#4c4738' : '#2c2a24');
  }
}

// ---------------------------------------------------------------- сборка

const TEX = {};

function buildTextures() {
  TEX.ground = [0, 1, 2, 3].map(i => makeGroundTile(i * 977 + 13));
  TEX.dune = [0, 1].map(i => makeDuneTile(i * 313 + 7));
  TEX.platform = makePlatform();
  TEX.rail = makeRailTile(false);
  TEX.railBroken = makeRailTile(true);
  TEX.ruin = [0, 1, 2].map(i => makeRuinWall(91 + i * 37));

  TEX.cactusBig = makeCactusBig();
  TEX.cactusSmall = makeCactusSmall();
  TEX.bush = makeBush();
  TEX.rockBig = makeRock('big');
  TEX.rockSmall = makeRock('small');
  TEX.skull = makeSkull();

  TEX.train = makeTrainCar();
  TEX.sign = makeStationSign('СТАНЦИЯ 07');
  TEX.sign08 = makeStationSign('СТАНЦИЯ 08');
  TEX.shack = makeShack();
  TEX.well = makeWell();
  TEX.leverUp = makeLever(false);
  TEX.leverDown = makeLever(true);
  TEX.signpost = makeSignpost();
  TEX.barrel = makeBarrel();
  TEX.crate = makeCrate();

  const pl = rows => outlined(sprite(rows, PMAP), PAL.ink3, false);
  TEX.player = {
    down: [pl(PLAYER_DOWN_A), pl(PLAYER_DOWN_B)],
    up: [pl(PLAYER_UP_A), pl(PLAYER_UP_B)],
    right: [pl(PLAYER_SIDE_A), pl(PLAYER_SIDE_B)],
  };
  TEX.player.left = TEX.player.right.map(flipH);

  TEX.monsterFn = [drawMonster1, drawMonster2, drawMonster3, drawSaviour];
  // мелкие спрайты для мира (кадры анимации)
  TEX.monsterSmall = TEX.monsterFn.map(fn => [0, 1].map(f => renderMonster(fn, 1, f)));

  TEX.heart = makeHeart();
  TEX.heartBroken = makeHeartBroken();
}
