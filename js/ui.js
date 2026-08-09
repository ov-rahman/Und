/* Интерфейс: рамки, текстовое окно с печатающимся текстом, полоски. */

const UI = (() => {

  function box(g, x, y, w, h, border, fill) {
    g.fillStyle = fill || PAL.ink;
    g.fillRect(x, y, w, h);
    g.fillStyle = border || PAL.ui;
    g.fillRect(x, y, w, 2);
    g.fillRect(x, y + h - 2, w, 2);
    g.fillRect(x, y, 2, h);
    g.fillRect(x + w - 2, y, 2, h);
  }

  function bar(g, x, y, w, h, ratio, colFill, colBg) {
    ratio = Math.max(0, Math.min(1, ratio));
    g.fillStyle = colBg || PAL.redD;
    g.fillRect(x, y, w, h);
    g.fillStyle = colFill || PAL.yellow;
    g.fillRect(x, y, Math.round(w * ratio), h);
  }

  class Textbox {
    constructor() {
      this.pages = [];
      this.page = 0;
      this.chars = 0;
      this.timer = 0;
      this.active = false;
      this.speed = 42;          // символов в секунду
      this.onDone = null;
      this.maxW = 268;
      this.x = 20; this.y = 152; this.w = 280; this.h = 72;
      this.bullet = true;
    }

    open(pages, onDone, opts) {
      this.pages = (Array.isArray(pages) ? pages : [pages]).slice();
      this.page = 0; this.chars = 0; this.timer = 0;
      this.active = true;
      this.onDone = onDone || null;
      opts = opts || {};
      this.bullet = opts.bullet !== false;
      this.speed = opts.speed || 42;
      this.lines = this._wrap(this.pages[0]);
    }

    _wrap(text) {
      return Font.wrap(text, this.maxW - (this.bullet ? 10 : 0), 1);
    }

    get fullLen() {
      return this.lines.reduce((a, l) => a + l.length, 0);
    }

    complete() { this.chars = this.fullLen; }
    get done() { return this.chars >= this.fullLen; }

    // Z: дописать страницу или перейти к следующей
    advance() {
      if (!this.active) return;
      if (!this.done) { this.complete(); Sound.select(); return; }
      this.page++;
      if (this.page >= this.pages.length) {
        this.active = false;
        const cb = this.onDone;
        this.onDone = null;
        if (cb) cb();
      } else {
        this.chars = 0;
        this.timer = 0;
        this.lines = this._wrap(this.pages[this.page]);
        Sound.select();
      }
    }

    update(dt) {
      if (!this.active || this.done) return;
      const before = this.chars;
      this.timer += dt;
      const per = 1 / this.speed;
      while (this.timer >= per && !this.done) {
        this.timer -= per;
        this.chars++;
      }
      if (this.chars !== before && this.chars % 2 === 0) Sound.text();
    }

    draw(g) {
      if (!this.active) return;
      box(g, this.x, this.y, this.w, this.h);
      let left = this.chars;
      const px0 = this.x + 12;
      let y = this.y + 12;
      for (let i = 0; i < this.lines.length; i++) {
        const full = this.lines[i];
        const shown = full.slice(0, Math.max(0, left));
        left -= full.length;
        const indent = (this.bullet && i === 0) ? 0 : (this.bullet ? 10 : 0);
        let x = px0 + indent;
        if (this.bullet && i === 0) {
          Font.draw(g, '*', x, y, PAL.ui, 1);
          x += 10;
        }
        Font.draw(g, shown, x, y, PAL.ui, 1);
        y += Font.LINE + 2;
        if (left <= 0) break;
      }
      // указатель «дальше»
      if (this.done && (performance.now() % 900 < 550)) {
        const bx = this.x + this.w - 14, by = this.y + this.h - 12;
        g.fillStyle = PAL.ui;
        g.fillRect(bx, by, 4, 1);
        g.fillRect(bx + 1, by + 1, 2, 1);
        g.fillRect(bx + 1, by - 1, 2, 1);
      }
    }
  }

  return { box, bar, Textbox };
})();
