/* Палитра. Всё выдержано в песочно-сепийной гамме референса. */

const PAL = {
  // песок
  sand0: '#dcc794',
  sand1: '#cdb582',
  sand2: '#bda470',
  sand3: '#ab9263',
  sandDark: '#93794d',
  sandShadow: '#6f5b38',

  // камни
  rockL: '#bda87f',
  rockM: '#96805e',
  rockD: '#6b5940',

  // кактус
  cacL: '#879c65',
  cacM: '#63784a',
  cacD: '#3c4c2c',

  // сухие кусты
  bushL: '#a08c58',
  bushD: '#5f5230',

  // общий тёмный контур — как на референсе
  ink2: '#33261a',
  ink3: '#241a12',

  // дерево
  woodL: '#a67f52',
  woodM: '#7d5e3b',
  woodD: '#503a23',
  roofL: '#8d6844',
  roofD: '#5e4229',

  // металл / ржавчина
  metL: '#9c9280',
  metM: '#7a7160',
  metD: '#544c3f',
  rustL: '#96603c',
  rustM: '#74452a',
  rustD: '#4d2d1c',
  glass: '#3a3a33',

  // рельсы
  railL: '#8e8371',
  railD: '#5c5344',
  tie: '#6b5334',

  // персонаж
  hair: '#1b1712',
  skin: '#d2a071',
  skinD: '#a87a4f',
  shirt: '#8d8a7d',
  shirtD: '#6a6759',
  pants: '#3b3830',
  boot: '#241f18',

  // интерфейс
  ink: '#0a0906',
  ui: '#f2ead2',
  uiDim: '#8f8874',
  red: '#d34a41',
  redD: '#8a2f28',
  green: '#7fae56',
  yellow: '#d8b850',
  blue: '#6f8fbe',

  // монстры
  m1L: '#b98a58', m1M: '#8e6539', m1D: '#5d4023',   // пескоед
  m2L: '#6e6a5d', m2M: '#4e4b41', m2D: '#2f2d26',   // стервятник
  m3L: '#a37a63', m3M: '#7a5744', m3D: '#4a3327',   // гончая дюн
  bone: '#e2d8b8',
};

// затемнение/осветление hex-цвета
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  r = Math.max(0, Math.min(255, Math.round(r + amt)));
  g = Math.max(0, Math.min(255, Math.round(g + amt)));
  b = Math.max(0, Math.min(255, Math.round(b + amt)));
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}
