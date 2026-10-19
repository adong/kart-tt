/* TT Kart: keys and touch. Player 1 drives with W A S D, player 2 with the arrows; in 1 player both sets work.
   On a touch screen each player gets a steering bar (hold the left or right half), an item button, a hop button and
   a brake (the gas is always on), plus the brother's face to call him. Presses are latched until the game has read
   them, so a quick tap is never lost between two frames. KartInput.snapshot(i) returns the sim's input. */
(function () {
  'use strict';
  const down = new Set();
  const latch = [{}, {}];
  const touch = [{ steer: 0, item: false, hop: false, brake: false }, { steer: 0, item: false, hop: false, brake: false }];
  const KEYS = [
    { left: ['KeyA'], right: ['KeyD'], gas: ['KeyW'], brake: ['KeyS'], hop: ['KeyF', 'Space'], item: ['KeyG', 'KeyE'], call: ['KeyT'] },
    { left: ['ArrowLeft'], right: ['ArrowRight'], gas: ['ArrowUp'], brake: ['ArrowDown'], hop: ['KeyK'], item: ['KeyL'], call: ['Enter', 'NumpadEnter'] },
  ];
  const I = {
    solo: true, // 1 player: both sets of keys drive player 1
    touchMode: false,
    enabled: true,
    onTouchFirst: null,
  };

  const any = (codes) => codes.some((c) => down.has(c));
  function owners(code) {
    const out = [];
    KEYS.forEach((k, i) => {
      for (const act of Object.keys(k)) if (k[act].includes(code)) out.push([I.solo ? 0 : i, act]);
    });
    return out;
  }

  window.addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (!down.has(e.code)) for (const [p, act] of owners(e.code)) latch[p][act] = true;
    down.add(e.code);
    if (I.enabled && (e.code.startsWith('Arrow') || e.code === 'Space')) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => down.delete(e.code));
  window.addEventListener('blur', () => down.clear());

  // read player p's controls (clears the latched taps)
  I.snapshot = function (p) {
    const out = { steer: 0, gas: false, brake: false, hop: false, item: false, call: false, autoGas: false };
    const sets = I.solo && p === 0 ? KEYS : [KEYS[p]];
    for (const k of sets) {
      if (any(k.left)) out.steer -= 1;
      if (any(k.right)) out.steer += 1;
      out.gas = out.gas || any(k.gas);
      out.brake = out.brake || any(k.brake);
      out.hop = out.hop || any(k.hop);
      out.item = out.item || any(k.item);
    }
    out.steer = Math.max(-1, Math.min(1, out.steer));
    const L = latch[p], t = touch[p];
    out.hop = out.hop || !!L.hop || t.hop;
    out.item = out.item || !!L.item || t.item || !!L.titem;
    out.call = !!L.call;
    if (t.steer) out.steer = t.steer;
    if (t.brake) out.brake = true;
    if (I.touchMode) out.autoGas = true;
    latch[p] = {};
    return out;
  };
  I.pressCall = (p) => { latch[p].call = true; };
  I.clear = () => { down.clear(); latch[0] = {}; latch[1] = {}; touch.forEach((t) => Object.assign(t, { steer: 0, item: false, hop: false, brake: false })); };
  I.isDown = (code) => down.has(code);

  // ---------- touch: wire up a player's pad (an element holding .steer and [data-act] buttons)
  I.bindPad = function (el, p) {
    const bar = el.querySelector('.steer');
    const ids = new Map();
    const setSteer = (e) => {
      const r = bar.getBoundingClientRect();
      const f = (e.clientX - r.left) / r.width;
      touch[p].steer = f < 0.42 ? -1 : f > 0.58 ? 1 : 0;
      bar.classList.toggle('l', touch[p].steer < 0);
      bar.classList.toggle('r', touch[p].steer > 0);
    };
    const first = () => {
      if (!I.touchMode) {
        I.touchMode = true;
        if (I.onTouchFirst) I.onTouchFirst();
      }
    };
    bar.addEventListener('pointerdown', (e) => {
      first();
      try { bar.setPointerCapture(e.pointerId); } catch (err) { /* synthetic or ended pointer */ }
      ids.set(e.pointerId, 'steer');
      setSteer(e);
      e.preventDefault();
    });
    bar.addEventListener('pointermove', (e) => { if (ids.get(e.pointerId) === 'steer') setSteer(e); });
    const endSteer = (e) => {
      if (ids.get(e.pointerId) !== 'steer') return;
      ids.delete(e.pointerId);
      touch[p].steer = 0;
      bar.classList.remove('l', 'r');
    };
    bar.addEventListener('pointerup', endSteer);
    bar.addEventListener('pointercancel', endSteer);
    for (const b of el.querySelectorAll('[data-act]')) {
      const act = b.dataset.act;
      b.addEventListener('pointerdown', (e) => {
        first();
        try { b.setPointerCapture(e.pointerId); } catch (err) { /* synthetic or ended pointer */ }
        b.classList.add('down');
        if (act === 'call') latch[p].call = true;
        else if (act === 'item') { touch[p].item = true; latch[p].titem = true; }
        else touch[p][act] = true;
        e.preventDefault();
        e.stopPropagation();
      });
      const up = () => {
        b.classList.remove('down');
        if (act !== 'call') touch[p][act] = false;
      };
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
      b.addEventListener('lostpointercapture', up);
    }
  };

  window.KartInput = I;
})();
