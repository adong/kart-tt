/* TT Kart: game sounds, synthesised with the kit's Kit.sound.tone / hiss (so mute and volume are shared with the
   other games). The engine is a go-kart putt-putt: short low blips whose pitch follows the speed. */
(function () {
  'use strict';
  const S = () => window.Kit.sound;
  const tone = (o) => S().tone(o);
  const hiss = (o) => S().hiss(o);

  const sfx = {
    // one engine putt for a kid's kart (called ~12 times a second while racing)
    engine(speed, boost, pan) {
      const f = 55 + Math.max(0, speed) * 4.2 + (boost ? 30 : 0);
      tone({ type: 'sawtooth', f, to: f * 0.92, dur: 0.07, vol: 0.035 + Math.min(0.03, speed * 0.001), lp: 900 + speed * 25 });
    },
    count(n) { tone({ type: 'square', f: 440, dur: 0.18, vol: 0.09, lp: 2400 }); },
    go() {
      tone({ type: 'square', f: 880, dur: 0.5, vol: 0.1, lp: 3000 });
      tone({ type: 'square', f: 1320, dur: 0.45, vol: 0.05, lp: 3000, at: 0.02 });
    },
    box() {
      [880, 1175, 1568].forEach((f, i) => tone({ type: 'triangle', f, dur: 0.12, vol: 0.08, at: i * 0.05 }));
    },
    tick() { tone({ type: 'square', f: 1400, dur: 0.025, vol: 0.03, lp: 3000 }); },
    got() { tone({ type: 'triangle', f: 1320, to: 1760, dur: 0.18, vol: 0.09 }); },
    banana() { tone({ type: 'sine', f: 300, to: 120, dur: 0.18, vol: 0.12 }); hiss({ filter: 'lowpass', f: 900, dur: 0.1, vol: 0.06 }); },
    throwBall() { S().swish(); tone({ f: 160, to: 90, dur: 0.1, vol: 0.18, at: 0.02 }); },
    bounce() { tone({ type: 'sine', f: 220, to: 140, dur: 0.08, vol: 0.06 }); },
    shield() { [523, 659, 784, 1047].forEach((f, i) => tone({ type: 'triangle', f, dur: 0.3, vol: 0.06, at: i * 0.06 })); },
    cookie() {
      hiss({ filter: 'bandpass', f: 2600, q: 2, dur: 0.06, vol: 0.12 });
      hiss({ filter: 'bandpass', f: 2200, q: 2, dur: 0.06, vol: 0.1, at: 0.08 });
      S().jet();
    },
    bubble() { tone({ type: 'sine', f: 300, to: 700, dur: 0.25, vol: 0.1 }); tone({ type: 'sine', f: 500, to: 1100, dur: 0.2, vol: 0.06, at: 0.12 }); },
    // dizzy: a cartoon boing and twinkles
    spin() {
      tone({ type: 'sine', f: 300, to: 900, dur: 0.22, vol: 0.1 });
      tone({ type: 'sine', f: 900, to: 420, dur: 0.3, vol: 0.07, at: 0.2 });
      [1568, 1760, 2093].forEach((f, i) => tone({ type: 'triangle', f, dur: 0.1, vol: 0.03, at: 0.3 + i * 0.09 }));
    },
    float() { for (let i = 0; i < 4; i++) tone({ type: 'sine', f: 400 + i * 160, to: 700 + i * 160, dur: 0.12, vol: 0.06, at: i * 0.08 }); },
    pop() { hiss({ filter: 'highpass', f: 2000, dur: 0.05, vol: 0.15 }); tone({ f: 600, to: 200, dur: 0.06, vol: 0.08 }); },
    boost() { hiss({ filter: 'bandpass', f: 600, to: 2400, q: 0.8, dur: 0.5, vol: 0.14, attack: 0.02 }); },
    driftLv(lv) { tone({ type: 'triangle', f: lv === 2 ? 1568 : 1175, dur: 0.1, vol: 0.06 }); },
    hop() { tone({ type: 'sine', f: 260, to: 420, dur: 0.08, vol: 0.06 }); },
    trick() { S().swish(); tone({ type: 'triangle', f: 660, to: 1320, dur: 0.18, vol: 0.07 }); },
    land() { S().land(); },
    boing() { tone({ type: 'sine', f: 180, to: 720, dur: 0.35, vol: 0.13 }); tone({ type: 'sine', f: 360, to: 1000, dur: 0.3, vol: 0.05, at: 0.05 }); },
    wall() { S().bump(); },
    bonk() { tone({ f: 200, to: 120, dur: 0.08, vol: 0.14 }); tone({ type: 'square', f: 520, to: 380, dur: 0.06, vol: 0.03, lp: 1800 }); },
    lap() { [784, 988, 1175].forEach((f, i) => tone({ type: 'square', f, dur: 0.14, vol: 0.05, lp: 2600, at: i * 0.1 })); },
    finalLap() { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone({ type: 'square', f, dur: 0.14, vol: 0.06, lp: 2600, at: i * 0.11 })); },
    finish(win) {
      const notes = win ? [523, 659, 784, 1047, 1319, 1568] : [523, 659, 784, 1047];
      notes.forEach((f, i) => tone({ type: 'square', f, dur: 0.2, vol: 0.06, lp: 2600, at: i * 0.12 }));
      hiss({ f: 1300, to: 1700, q: 0.6, dur: 1.6, vol: 0.08, attack: 0.1, at: 0.2 });
    },
    // the brother arrives: a friendly double horn
    call() { S().horn(0.5); },
    tow() { S().powerup(); },
    treat() { S().coin(2); },
    saved() {
      S().punch();
      [784, 988, 1319].forEach((f, i) => tone({ type: 'triangle', f, dur: 0.16, vol: 0.08, at: 0.06 + i * 0.08 }));
    },
    blocked() { [1319, 1047].forEach((f, i) => tone({ type: 'triangle', f, dur: 0.12, vol: 0.08, at: i * 0.07 })); },
    rescue() { tone({ type: 'sine', f: 600, to: 1200, dur: 0.6, vol: 0.06 }); },
    pad() { hiss({ filter: 'bandpass', f: 900, to: 2600, q: 1, dur: 0.3, vol: 0.1 }); },
    click() { S().click(); },
    fanfare() {
      [523, 523, 523, 659, 784, 659, 784, 1047].forEach((f, i) => tone({ type: 'square', f, dur: i === 7 ? 0.6 : 0.14, vol: 0.06, lp: 2800, at: [0, 0.12, 0.24, 0.36, 0.6, 0.84, 0.96, 1.2][i] }));
    },
  };
  window.KartSfx = sfx;
})();
