/* Sky Dash — Musik & Sounds (Sky Games)
   Alle Songs werden live im Browser erzeugt (Web Audio) – keine Musikdateien nötig. */
(function () {
  'use strict';

  const SONGS = [
    // Grundton (MIDI), Akkordfolge (Halbtöne über Grundton, Moll), Leadmuster
    { root: 45, prog: [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]], lead: [0, 2, 1, 2, 0, 2, 1, 3], swing: 0 },
    { root: 47, prog: [[0, 3, 7], [5, 8, 12], [-4, 0, 3], [-2, 2, 5]], lead: [0, 1, 2, 1, 3, 2, 1, 2], swing: 0 },
    { root: 42, prog: [[0, 3, 7], [1, 5, 8], [-4, 0, 3], [-5, -1, 2]], lead: [2, 1, 0, 1, 2, 3, 2, 1], swing: 0 }
  ];
  const MENU = { root: 50, prog: [[0, 4, 7], [-3, 0, 4], [-7, -3, 0], [-5, -1, 2]], lead: [0, 1, 2, 1, 2, 1, 0, 1] };

  const A = {
    ctx: null, master: null, musicGain: null, sfxGain: null,
    musicVol: 0.7, sfxVol: 0.8,
    playing: false, bpm: 128, song: null, step: 0, nextTime: 0, startTime: 0, timer: null, menu: false,
    noiseBuf: null, delay: null
  };

  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  A.init = function () {
    if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = A.ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    A.master = ctx.createGain(); A.master.gain.value = 0.9;
    A.master.connect(comp); comp.connect(ctx.destination);
    A.musicGain = ctx.createGain(); A.musicGain.connect(A.master);
    A.sfxGain = ctx.createGain(); A.sfxGain.connect(A.master);
    A.setVolumes(A.musicVol, A.sfxVol);
    // Echo für die Melodie
    A.delay = ctx.createDelay(1); const fb = ctx.createGain(); fb.gain.value = 0.32;
    const dl = ctx.createBiquadFilter(); dl.type = 'lowpass'; dl.frequency.value = 2400;
    A.delay.connect(dl); dl.connect(fb); fb.connect(A.delay); dl.connect(A.musicGain);
    const len = ctx.sampleRate;
    A.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = A.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  };

  A.setVolumes = function (m, s) {
    A.musicVol = m; A.sfxVol = s;
    if (A.musicGain) { A.musicGain.gain.value = m * 0.55; A.sfxGain.gain.value = s * 0.7; }
  };

  function env(g, t, a, peak, dec) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
  }

  function kick(t, out) {
    const o = A.ctx.createOscillator(), g = A.ctx.createGain();
    o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    env(g, t, 0.002, 1.0, 0.28); o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.32);
  }
  function noise(t, out, type, freq, vol, dec) {
    const s = A.ctx.createBufferSource(), f = A.ctx.createBiquadFilter(), g = A.ctx.createGain();
    s.buffer = A.noiseBuf; f.type = type; f.frequency.value = freq;
    env(g, t, 0.001, vol, dec); s.connect(f); f.connect(g); g.connect(out);
    s.start(t, Math.random() * 0.5); s.stop(t + dec + 0.05);
  }
  function tone(t, out, type, freq, vol, a, dec, cutoff, send) {
    const o = A.ctx.createOscillator(), g = A.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    let node = o;
    if (cutoff) {
      const f = A.ctx.createBiquadFilter(); f.type = 'lowpass';
      f.frequency.setValueAtTime(cutoff * 2.5, t); f.frequency.exponentialRampToValueAtTime(cutoff, t + dec);
      f.Q.value = 6; o.connect(f); node = f;
    }
    env(g, t, a, vol, dec); node.connect(g); g.connect(out);
    if (send) g.connect(A.delay);
    o.start(t); o.stop(t + a + dec + 0.05);
  }

  // Ein 16tel-Schritt der Musik
  function playStep(st, t) {
    const S = A.song, out = A.musicGain;
    const bar = Math.floor(st / 16), s16 = st % 16;
    const chord = S.prog[bar % 4];
    const intro = !A.menu && bar < 2;
    const full = A.menu ? bar % 8 >= 4 : bar >= 4;
    // Schlagzeug
    if (s16 % 4 === 0) kick(t, out);
    if (!intro && (s16 === 4 || s16 === 12)) noise(t, out, 'bandpass', 1800, 0.55, 0.16);
    if (!intro && s16 % 4 === 2) noise(t, out, 'highpass', 8000, 0.28, 0.05);
    if (full && s16 % 2 === 1) noise(t, out, 'highpass', 9500, 0.12, 0.03);
    // Bass
    if (s16 % 2 === 0 || (full && s16 % 4 === 3)) {
      const n = S.root - 12 + chord[0] + (s16 === 14 ? 12 : 0);
      tone(t, out, 'sawtooth', mtof(n), 0.32, 0.005, 0.18, 380, false);
    }
    // Flächen
    if (s16 === 0) chord.forEach(c => {
      tone(t, out, 'triangle', mtof(S.root + 12 + c), 0.05, 0.3, 2.2, 0, false);
    });
    // Melodie (Arpeggio)
    if (!intro && (full || s16 % 2 === 0)) {
      const i = S.lead[s16 % 8], oct = (s16 >= 8 && full) ? 24 : 12;
      const n = S.root + oct + chord[i % 3] + (i === 3 ? 12 : 0);
      tone(t, out, 'square', mtof(n), 0.07, 0.004, 0.14, 2600, true);
    }
  }

  function tick() {
    if (!A.playing) return;
    const spb = 60 / A.bpm / 4;
    while (A.nextTime < A.ctx.currentTime + 0.14) {
      playStep(A.step, A.nextTime);
      A.step++; A.nextTime += spb;
    }
  }

  A.start = function (songIdx, bpm, menu) {
    if (!A.ctx) return;
    A.stop();
    A.menu = !!menu;
    A.song = menu ? MENU : SONGS[songIdx % SONGS.length];
    A.bpm = bpm || 128;
    A.step = 0;
    A.startTime = A.nextTime = A.ctx.currentTime + 0.05;
    A.playing = true;
    tick();
    A.timer = setInterval(tick, 25);
  };

  A.stop = function () {
    A.playing = false;
    if (A.timer) clearInterval(A.timer);
    A.timer = null;
  };

  // 0..1 Puls auf dem Beat, für die Grafik
  A.pulse = function () {
    if (!A.ctx || !A.playing) return 0;
    const beat = (A.ctx.currentTime - A.startTime) * A.bpm / 60;
    if (beat < 0) return 0;
    const f = beat % 1;
    return Math.exp(-f * 6);
  };

  // Soundeffekte
  A.sfx = function (name) {
    if (!A.ctx) return;
    const t = A.ctx.currentTime, out = A.sfxGain;
    switch (name) {
      case 'die':
        noise(t, out, 'lowpass', 1400, 1.0, 0.45);
        tone(t, out, 'sawtooth', 110, 0.5, 0.002, 0.35, 300, false);
        break;
      case 'coin':
        tone(t, out, 'square', 1318, 0.18, 0.002, 0.08, 0, false);
        tone(t + 0.07, out, 'square', 1975, 0.18, 0.002, 0.25, 0, false);
        break;
      case 'complete':
        [0, 4, 7, 12, 16, 19, 24].forEach((n, i) => tone(t + i * 0.07, out, 'square', mtof(72 + n), 0.14, 0.003, 0.5, 0, false));
        break;
      case 'click':
        tone(t, out, 'triangle', 880, 0.2, 0.001, 0.06, 0, false);
        break;
      case 'checkpoint':
        tone(t, out, 'sine', 1046, 0.25, 0.002, 0.2, 0, false);
        break;
    }
  };

  window.SDAudio = A;
})();
