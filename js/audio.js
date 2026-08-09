/* Простой синтезатор на WebAudio: пищалки интерфейса и фоновая петля.
   Никаких файлов, всё генерируется на лету. */

const Sound = (() => {
  let ac = null;
  let master = null;
  let musicGain = null;
  let enabled = true;
  let musicTimer = null;
  let step = 0;

  function init() {
    if (ac) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    master = ac.createGain();
    master.gain.value = 0.5;
    master.connect(ac.destination);
    musicGain = ac.createGain();
    musicGain.gain.value = 0.16;
    musicGain.connect(master);
  }

  function resume() {
    init();
    if (ac && ac.state === 'suspended') ac.resume();
  }

  function blip(freq, dur, type, vol, dest) {
    if (!ac || !enabled) return;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type || 'square';
    o.frequency.value = freq;
    const t = ac.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.18, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (dur || 0.08));
    o.connect(g);
    g.connect(dest || master);
    o.start(t);
    o.stop(t + (dur || 0.08) + 0.02);
  }

  function noise(dur, vol, filterFreq) {
    if (!ac || !enabled) return;
    const len = Math.floor(ac.sampleRate * dur);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ac.createBufferSource();
    src.buffer = buf;
    const f = ac.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filterFreq || 1200;
    const g = ac.createGain();
    g.gain.value = vol || 0.2;
    src.connect(f); f.connect(g); g.connect(master);
    src.start();
  }

  const api = {
    resume,
    text() { blip(420 + Math.random() * 60, 0.035, 'square', 0.07); },
    select() { blip(660, 0.06, 'square', 0.12); },
    confirm() { blip(880, 0.09, 'square', 0.13); setTimeout(() => blip(1180, 0.07, 'square', 0.1), 55); },
    cancel() { blip(300, 0.09, 'square', 0.11); },
    hit() { noise(0.18, 0.3, 900); blip(150, 0.16, 'sawtooth', 0.16); },
    slash() { noise(0.12, 0.22, 2600); },
    hurt() { blip(180, 0.22, 'square', 0.2); setTimeout(() => blip(120, 0.2, 'square', 0.16), 60); },
    heal() { blip(520, 0.1, 'triangle', 0.16); setTimeout(() => blip(780, 0.14, 'triangle', 0.14), 90); },
    encounter() {
      blip(220, 0.1, 'square', 0.2);
      setTimeout(() => blip(180, 0.12, 'square', 0.2), 110);
      setTimeout(() => blip(140, 0.3, 'square', 0.2), 230);
    },
    step() { noise(0.05, 0.05, 500); },
    lever() { noise(0.2, 0.25, 700); setTimeout(() => blip(90, 0.3, 'sawtooth', 0.15), 80); },
    win() {
      [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.16, 'square', 0.14), i * 90));
    },

    setEnabled(v) {
      enabled = v;
      if (master) master.gain.value = v ? 0.5 : 0;
    },
    isEnabled() { return enabled; },

    // фоновая петля — медленная минорная фигура + ветер
    startMusic(kind) {
      init();
      if (!ac) return;
      this.stopMusic();
      step = 0;
      const scales = {
        desert: [220, 261.63, 293.66, 349.23, 293.66, 261.63, 233.08, 196],
        battle: [174.61, 174.61, 207.65, 233.08, 174.61, 155.56, 138.59, 155.56],
      };
      const seq = scales[kind] || scales.desert;
      const beat = kind === 'battle' ? 240 : 460;
      musicTimer = setInterval(() => {
        if (!enabled) return;
        const n = seq[step % seq.length];
        blip(n, beat / 1000 * 0.9, 'triangle', 0.12, musicGain);
        if (step % 4 === 0) blip(n / 2, beat / 1000 * 1.6, 'sine', 0.14, musicGain);
        if (kind === 'battle' && step % 2 === 1) noise(0.06, 0.05, 3000);
        step++;
      }, beat);
    },
    stopMusic() {
      if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
    },
  };

  return api;
})();
