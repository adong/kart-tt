/* TT Kart: the game. Screens (title, pick, pause, results, the cup trophy), the race loop, the chase cameras (one, or
   two for the split screen), the karts on screen, the HUD, sounds and words for everything the race reports, and the
   window.game test hooks. A CPU-only race plays behind the menus. The race itself is js/sim.js. */
(function () {
  'use strict';
  const T = THREE;
  const K = KART, S = K.sim, Art = KartArt, Input = KartInput, sfx = KartSfx;
  const $ = (id) => document.getElementById(id);
  const DT = S.DT;
  const TAU = Math.PI * 2;
  const SAVE_KEY = 'ttKart.v1';
  const CAST = ['teddy', 'tommy', 'zoom', 'luna', 'bolt', 'bruno', 'zombie'];
  const EMOJI = { banana: '🍌', ball: '🏀', shield: '✌️', cookie: '🍪', bubble: '🫧' };
  const ROLL = ['🍌', '🏀', '✌️', '🍪', '🫧'];
  const BLURB = {
    teddy: 'boxing and hoops', tommy: 'peace and love', zoom: 'super quick', luna: 'starry hoodie', bolt: 'beep boop', bruno: 'big bear hugs', zombie: 'BOO!',
  };
  const t = (s) => Kit.lang.t(s);

  const G = {
    screen: 'loading', mode: '1p', level: 'easy', picks: ['teddy', 'tommy'], pick: { cup: 0 }, race: null, gp: null,
    demo: false, paused: false, acc: 0, hold: false, timers: [], overT: -1, engineT: 0, save: load(), portraits: {},
    camMode: 0, camT: 0, lastPlace: [0, 0], msgT: [0, 0], countT: 0, autoPause: true,
  };

  // ------------------------------------------------------------------ saving

  function load() {
    try { return Object.assign({ cups: {}, best: {} }, JSON.parse(localStorage.getItem(SAVE_KEY) || '{}')); } catch (e) { return { cups: {}, best: {} }; }
  }
  function save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(G.save)); } catch (e) { /* private mode */ }
  }

  // ------------------------------------------------------------------ three.js

  let renderer, scene, hemi, sun, fx;
  const cams = [new T.PerspectiveCamera(62, 1, 0.1, 900), new T.PerspectiveCamera(62, 1, 0.1, 900)];
  const camSt = [{ p: new T.Vector3(), l: new T.Vector3(), init: false }, { p: new T.Vector3(), l: new T.Vector3(), init: false }];
  let world = null;
  const trackCache = {};

  function loadTrack(id) {
    if (world && world.id === id) return world;
    if (world) scene.remove(world.root);
    const built = trackCache[id] || (trackCache[id] = Art.buildTrack(K.track(id)));
    const th = built.theme;
    scene.add(built.root);
    scene.background = built.sky;
    scene.fog = new T.Fog(th.fog, 70, th.fogFar);
    hemi.color.set(th.hemi[0]);
    hemi.groundColor.set(th.hemi[1]);
    hemi.intensity = th.hemi[2];
    sun.intensity = th.sun;
    world = Object.assign({ id }, built);
    return world;
  }

  // ------------------------------------------------------------------ karts on screen

  let views = []; // one per kart
  let buddyViews = []; // one per kid
  let boxMeshes = [];
  const itemMeshes = new Map();

  function clearRaceView() {
    for (const v of views) scene.remove(v.root);
    for (const b of buddyViews) if (b) { scene.remove(b.root); if (b.rope) scene.remove(b.rope); }
    for (const m of boxMeshes) scene.remove(m);
    for (const m of itemMeshes.values()) scene.remove(m);
    itemMeshes.clear();
    views = [];
    buddyViews = [];
    boxMeshes = [];
    if (fx) fx.clear();
  }

  function makeViews(r) {
    clearRaceView();
    for (const k of r.karts) {
      const entry = Kit.roster.get(k.ch);
      const v = Art.kart(entry);
      v.k = k;
      v.dizzy = KartFx.dizzy();
      v.dizzy.position.set(0, 1.75, 0.2);
      v.root.add(v.dizzy);
      v.shield = Art.shield();
      v.shield.position.y = 0.9;
      v.shield.visible = false;
      v.root.add(v.shield);
      v.bubble = Art.kartBubble();
      v.bubble.position.y = 1;
      v.bubble.visible = false;
      v.root.add(v.bubble);
      const tag = Kit.gfx.nameTag(entry.name, k.human === 0 ? '#ffd400' : k.human === 1 ? '#ff8ab8' : entry.tag || '#ffffff');
      tag.position.set(0, 2.5, 0);
      tag.scale.multiplyScalar(0.55);
      v.root.add(tag);
      v.tag = tag;
      v.spinVis = 0;
      v.dizzyT = 0;
      v.balloon = Art.emojiSprite('🎈', 1.6);
      v.balloon.position.set(0, 3.2, 0);
      v.balloon.visible = false;
      v.balloonT = 0;
      v.root.add(v.balloon);
      scene.add(v.root);
      views.push(v);
    }
    for (const k of r.humans) {
      const entry = Kit.roster.get(Kit.roster.buddyFor(k.ch));
      const b = Art.kart(entry, { scale: entry.buddyScale || 0.75 });
      b.root.visible = false;
      b.entry = entry;
      b.host = k;
      b.off = -14;
      b.side = 1;
      const geo = new T.BufferGeometry().setFromPoints([new T.Vector3(), new T.Vector3()]);
      b.rope = new T.Line(geo, new T.LineBasicMaterial({ color: '#ffd400' }));
      b.rope.visible = false;
      b.ropeT = 0;
      scene.add(b.rope);
      scene.add(b.root);
      buddyViews[k.human] = b;
    }
    for (const bx of r.boxes) {
      const m = Art.itemBox();
      m.position.set(bx.x, bx.y, bx.z);
      m.rotation.set(0.5, Math.random() * TAU, 0.3);
      scene.add(m);
      boxMeshes.push(m);
    }
  }

  const tmpV = new T.Vector3();
  function syncViews(dt) {
    const r = G.race;
    const trk = r.trk;
    const kk = 1 - Math.exp(-14 * dt);
    for (const v of views) {
      const k = v.k;
      v.root.position.set(k.x, k.y, k.z);
      v.spinVis = k.spinT > 0 ? k.spinA : v.spinVis * Math.exp(-10 * dt);
      const trick = k.trickT > 0 ? (1 - k.trickT / 0.5) * TAU : 0;
      v.root.rotation.y = -k.h - Math.PI / 2 + v.spinVis + trick;
      const sp = Math.max(0, k.speed);
      const lean = -k.steerV * 0.07 * Math.min(1, sp / 18) - (k.drift ? k.drift * 0.1 : 0);
      v.body.rotation.z += (lean - v.body.rotation.z) * kk;
      const pitch = k.air ? Math.max(-0.35, Math.min(0.35, k.vy * 0.03)) : Math.max(-0.3, Math.min(0.3, (k.vyG || 0) / Math.max(6, sp)));
      v.body.rotation.x += (pitch - v.body.rotation.x) * kk;
      for (const w of v.wheels) {
        w.rotation.order = 'YXZ';
        w.rotation.x -= (k.speed * dt) / 0.42;
        if (w.userData.front) w.rotation.y = -k.steerV * 0.45;
      }
      v.wheel.rotation.z = -k.steerV * 0.9;
      Art.seat(v.person, kk, k.steerV);
      // the shadow stays on the ground under a flying kart
      const gy = K.geo.ground(trk, k.q).y;
      v.shadow.position.y = gy - k.y + 0.05;
      v.shadow.material.opacity = Math.max(0.15, 0.55 - (k.y - gy) * 0.12);
      v.shield.visible = k.shieldT > 0;
      if (v.shield.visible) v.shield.rotation.y += dt * 2;
      v.bubble.visible = k.floatT > 0;
      if (k.spinT > 0) v.dizzyT = 1.2;
      v.dizzyT -= dt;
      v.dizzy.visible = v.dizzyT > 0;
      v.balloonT -= dt;
      v.balloon.visible = v.balloonT > 0;
      if (v.balloon.visible) v.balloon.position.y = 2.6 + Math.sin(G.time * 3) * 0.2;
      if (v.dizzy.visible) KartFx.spinStars(v.dizzy, G.time);
      // sparks, flames, dust
      if (k.boostT > 0 && Math.random() < 0.8) {
        for (const p of v.pipes) {
          p.getWorldPosition(tmpV);
          fx.flame(tmpV.x, tmpV.y, tmpV.z, -Math.cos(k.h) * 3, -Math.sin(k.h) * 3);
        }
      }
      if (k.drift && !k.air) {
        const col = k.driftLv === 2 ? '#ff8a1f' : k.driftLv === 1 ? '#5ad8ff' : '#ffffff';
        for (const w of [v.wheels[2], v.wheels[3]]) {
          if (Math.random() < 0.6) {
            w.getWorldPosition(tmpV);
            fx.spark(tmpV.x, tmpV.y - 0.3, tmpV.z, col);
          }
        }
      }
      if (!k.air && sp > 6 && Math.random() < 0.25) {
        if (k.surface === 'verge') fx.dust(k.x, k.y, k.z, world.theme.verge);
        else if (k.surface === 'water') fx.splash(k.x, k.y, k.z);
      }
    }
    // the brothers' mini karts: drive up beside you, ride along, drive off
    for (const b of buddyViews) {
      if (!b) continue;
      const k = b.host, st = k.buddy;
      b.root.visible = st.on;
      if (!st.on) {
        b.off = -14;
        b.rope.visible = false;
        continue;
      }
      const want = st.phase === 'arrive' ? 0 : st.phase === 'leave' ? -26 : 0;
      b.off += (want - b.off) * (1 - Math.exp(-(st.phase === 'leave' ? 2.2 : 4) * dt));
      if (st.phase === 'arrive' && st.t < 0.05) b.off = Math.min(b.off, -12);
      const lat = k.q.lat || 0;
      b.side = lat > 2 ? -1 : lat < -2 ? 1 : b.side;
      const fx_ = Math.cos(k.h), fz_ = Math.sin(k.h);
      const side = b.side * 2.9;
      const bx = k.x + fx_ * b.off - fz_ * side, bz = k.z + fz_ * b.off + fx_ * side;
      b.root.position.set(bx, k.y + Math.sin(G.time * 9) * 0.04, bz);
      b.root.rotation.y = -k.h - Math.PI / 2;
      for (const w of b.wheels) w.rotation.x -= (Math.max(8, k.speed) * dt) / 0.42;
      const sig = st.sigT > 0 ? Kit.roster.signature(b.entry, st.sigT > 0.9 || b.entry.signature.length < 2 ? 'hello' : 'goodbye') : st.phase === 'leave' ? 'wave' : null;
      Art.seat(b.person, kk, sig ? 0 : k.steerV, sig, G.time * 6);
      b.ropeT -= dt;
      b.rope.visible = b.ropeT > 0;
      if (b.rope.visible) {
        const a = b.rope.geometry.attributes.position;
        a.setXYZ(0, bx + fx_ * 1.2, k.y + 0.6, bz + fz_ * 1.2);
        a.setXYZ(1, k.x - fx_ * 1.2, k.y + 0.6, k.z - fz_ * 1.2);
        a.needsUpdate = true;
      }
    }
    // item boxes spin, and pop back after a moment
    r.boxes.forEach((bx, i) => {
      const m = boxMeshes[i];
      if (!m) return;
      m.visible = bx.wait <= 0;
      m.rotation.y += dt * 1.6;
      m.position.y = bx.y + Math.sin(G.time * 2 + i) * 0.2;
      const sc = bx.wait <= 0 ? Math.min(1, m.scale.x + dt * 4) : 0.1;
      m.scale.setScalar(sc);
    });
    // items on the road
    const seen = new Set();
    for (const o of r.items) {
      seen.add(o);
      let m = itemMeshes.get(o);
      if (!m) {
        m = Art.item(o.kind);
        scene.add(m);
        itemMeshes.set(o, m);
      }
      m.position.set(o.x, o.y, o.z);
      if (m.userData.spin) m.userData.spin.rotation.x += dt * 10;
    }
    for (const [o, m] of itemMeshes) {
      if (!seen.has(o)) {
        scene.remove(m);
        itemMeshes.delete(o);
      }
    }
    // things rolling across the road
    world.movers.forEach((g, i) => {
      const m = trk.movers[i];
      const px = g.position.x, pz = g.position.z;
      g.position.set(m.x, m.y, m.z);
      const dx = m.x - px, dz = m.z - pz, d = Math.hypot(dx, dz);
      if (g.userData.roll && d > 0.0001) {
        g.userData.roll.rotation.order = 'YXZ';
        g.userData.roll.rotation.y = Math.atan2(dx, dz);
        g.userData.roll.rotation.x += d / (g.userData.r || 1.5);
      }
      if (g.userData.car && d > 0.0001) g.userData.car.rotation.y = -Math.atan2(dz, dx);
      if (g.userData.wobble) g.userData.wobble.rotation.z = Math.sin(G.time * 12) * 0.08;
      if (g.userData.scuttle) g.rotation.y = Math.atan2(m.tx, m.tz) + Math.sin(G.time * 20) * 0.1;
    });
    for (const a of world.arrows) a.material.map.offset.y = (a.material.map.offset.y - dt * 1.5) % 1;
  }

  // ------------------------------------------------------------------ cameras

  function chase(ci, k, dt, snap) {
    const c = cams[ci], st = camSt[ci];
    const sp = Math.max(0, k.speed);
    // the camera swings round behind the kart (its heading eases after the kart's), at a fixed distance
    if (!st.init || snap) st.yaw = k.h;
    st.yaw += Math.atan2(Math.sin(k.h - st.yaw), Math.cos(k.h - st.yaw)) * (1 - Math.exp(-5 * dt));
    const fx_ = Math.cos(st.yaw), fz_ = Math.sin(st.yaw);
    const back = 4.7 + sp * 0.03, up = 2.25;
    let px = k.x - fx_ * back, py = k.y + up, pz = k.z - fz_ * back;
    let lx = k.x + fx_ * 4.5, ly = k.y + 1.15, lz = k.z + fz_ * 4.5;
    const r = G.race;
    if (r && r.phase === 'countdown' && !G.demo) {
      // the grid: start in front, high, looking back at the kart, then swing round behind it
      const u = Math.min(1, r.phaseT / (S.COUNT * 0.9));
      const e = u * u * (3 - 2 * u);
      const a = Math.PI * (1 - e);
      const R = back + 6 * (1 - e);
      px = k.x - Math.cos(k.h + a) * R;
      pz = k.z - Math.sin(k.h + a) * R;
      py = k.y + up + 5 * (1 - e);
      lx = k.x + Math.cos(k.h) * 5 * e;
      lz = k.z + Math.sin(k.h) * 5 * e;
      snap = true;
      st.yaw = k.h;
    } else if (k.finished && k.human >= 0) {
      // the victory lap: swing round to the side
      const a = Math.PI * 0.5 + Math.sin(G.time * 0.3) * 0.6;
      px = k.x - Math.cos(k.h + a) * 8;
      pz = k.z - Math.sin(k.h + a) * 8;
      py = k.y + 2.6;
      lx = k.x;
      ly = k.y + 1;
      lz = k.z;
    }
    if (!st.init || snap) {
      st.p.set(px, py, pz);
      st.l.set(lx, ly, lz);
      st.init = true;
    } else {
      const a = 1 - Math.exp(-14 * dt), b = 1 - Math.exp(-16 * dt);
      st.p.x += (px - st.p.x) * a;
      st.p.z += (pz - st.p.z) * a;
      st.p.y += (py - st.p.y) * (1 - Math.exp(-6 * dt));
      st.l.x += (lx - st.l.x) * b;
      st.l.y += (ly - st.l.y) * b;
      st.l.z += (lz - st.l.z) * b;
    }
    c.position.copy(st.p);
    c.lookAt(st.l);
    const fov = 62 + (k.boostT > 0 ? 8 : 0);
    if (Math.abs(c.fov - fov) > 0.1) {
      c.fov += (fov - c.fov) * (1 - Math.exp(-6 * dt));
      c.updateProjectionMatrix();
    }
  }

  // the demo behind the menus: follow the leader, now from behind, now from the side, now from high up
  function demoCam(dt) {
    const r = G.race;
    G.camT -= dt;
    if (G.camT <= 0) {
      G.camT = 6;
      G.camMode = (G.camMode + 1) % 3;
      camSt[0].init = false;
    }
    // follow the third kart, so most of the pack is in view
    const k = r.order[Math.min(2, r.order.length - 1)];
    const c = cams[0], st = camSt[0];
    const a = G.camMode === 0 ? 0.25 : G.camMode === 1 ? Math.PI / 2 + 0.4 : Math.PI * 0.85;
    const R = G.camMode === 0 ? 15 : G.camMode === 1 ? 9 : 14, up = G.camMode === 0 ? 6.5 : G.camMode === 1 ? 2.4 : 9;
    const px = k.x - Math.cos(k.h + a) * R, pz = k.z - Math.sin(k.h + a) * R;
    if (!st.init) { st.p.set(px, k.y + up, pz); st.init = true; }
    const s = 1 - Math.exp(-3 * dt);
    st.p.x += (px - st.p.x) * s;
    st.p.y += (k.y + up - st.p.y) * s;
    st.p.z += (pz - st.p.z) * s;
    c.position.copy(st.p);
    c.lookAt(k.x, k.y + 1, k.z);
  }

  // ------------------------------------------------------------------ the HUD

  const hudEls = [0, 1].map((i) => {
    const v = document.querySelector('#hud .v' + i);
    return {
      v, lap: v.querySelector('.lap'), time: v.querySelector('.time'), item: v.querySelector('.itembox'), slot: v.querySelector('.slot'), n: v.querySelector('.n'),
      place: v.querySelector('.placebox'), map: v.querySelector('.map'), bud: v.querySelector('.bud'), msg: v.querySelector('.msg'), wrong: v.querySelector('.wrong'),
      pad: document.querySelector('#touch .p' + i),
    };
  });
  const ord = (n) => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
  const fmt = (s) => {
    if (s === null || s === undefined || !Number.isFinite(s)) return '–';
    const m = Math.floor(s / 60), sec = s - m * 60;
    return `${m}:${sec < 10 ? '0' : ''}${sec.toFixed(1)}`;
  };

  function setupHud(r) {
    const duo = r.humans.length > 1;
    $('hud').classList.toggle('duo', duo);
    $('hud').classList.toggle('solo', !duo);
    $('touch').classList.toggle('duo', duo);
    $('touch').classList.toggle('solo', !duo);
    $('split').classList.toggle('hidden', !duo);
    $('count').classList.toggle('duo', duo);
    for (const k of r.humans) {
      const h = hudEls[k.human];
      const bud = Kit.roster.buddyFor(k.ch);
      const img = G.portraits[bud] || '';
      h.bud.querySelector('img').src = img;
      h.bud.querySelector('.lbl b').textContent = Kit.roster.get(bud).name;
      h.pad.querySelector('.callbtn img').src = img;
      h.pad.querySelector('.callbtn small').textContent = Kit.roster.get(bud).name;
      h.msg.className = 'msg';
      h.place.textContent = ord(k.place);
      h.mapImg = null;
      G.lastPlace[k.human] = k.place;
    }
  }

  function drawMap(h, r, k) {
    const cv = h.map, g = cv.getContext('2d');
    const W = cv.width;
    if (!h.mapImg || h.mapFor !== r.trk.id) {
      const P = r.trk.paths[0];
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (let i = 0; i < P.n; i++) { x0 = Math.min(x0, P.x[i]); x1 = Math.max(x1, P.x[i]); z0 = Math.min(z0, P.z[i]); z1 = Math.max(z1, P.z[i]); }
      const sc = (W - 24) / Math.max(x1 - x0, z1 - z0);
      h.mapTf = (x, z) => [12 + (x - x0) * sc + ((W - 24) - (x1 - x0) * sc) / 2, 12 + (z - z0) * sc + ((W - 24) - (z1 - z0) * sc) / 2];
      const [c2, g2] = Kit.gfx.makeCanvas(W, W);
      g2.lineCap = g2.lineJoin = 'round';
      for (const [w, col] of [[11, 'rgba(20,18,31,0.8)'], [6, '#ffffff']]) {
        for (const Q of r.trk.paths) {
          g2.beginPath();
          for (let i = 0; i <= Q.n - (Q.closed ? 0 : 1); i++) {
            const [x, y] = h.mapTf(Q.x[i % Q.n], Q.z[i % Q.n]);
            if (i === 0) g2.moveTo(x, y); else g2.lineTo(x, y);
          }
          g2.strokeStyle = col;
          g2.lineWidth = Q.closed ? w : w * 0.6;
          g2.stroke();
        }
      }
      const [sx, sy] = h.mapTf(P.x[0], P.z[0]);
      g2.fillStyle = '#ffd400';
      g2.fillRect(sx - 4, sy - 4, 8, 8);
      h.mapImg = c2;
      h.mapFor = r.trk.id;
    }
    g.clearRect(0, 0, W, W);
    g.drawImage(h.mapImg, 0, 0);
    for (const o of r.karts) {
      const [x, y] = h.mapTf(o.x, o.z);
      const me = o === k;
      g.beginPath();
      g.arc(x, y, me ? 7 : o.human >= 0 ? 6 : 4.5, 0, TAU);
      g.fillStyle = me ? '#ffd400' : o.human >= 0 ? '#ff8ab8' : Kit.roster.get(o.ch).look.top || '#ffffff';
      g.fill();
      g.lineWidth = 2;
      g.strokeStyle = '#14121f';
      g.stroke();
    }
  }

  function updateHud(dt) {
    const r = G.race;
    for (const k of r.humans) {
      const h = hudEls[k.human];
      const lap = Math.max(1, Math.min(r.laps, k.lap));
      h.lap.textContent = r.cfg.mode === 'tt' && k.finished ? 'FINISH!' : `LAP ${lap}/${r.laps}`;
      h.lap.classList.toggle('final', lap === r.laps && !k.finished && r.laps > 1);
      h.time.textContent = fmt(k.finished ? k.finishT : r.clock);
      let slot = '';
      if (k.roll > 0) slot = ROLL[Math.floor(G.time * 14) % ROLL.length];
      else if (k.item) slot = EMOJI[k.item];
      if (h.slot.textContent !== slot) h.slot.textContent = slot;
      h.item.classList.toggle('rolling', k.roll > 0);
      h.item.classList.toggle('ready', !!k.item && k.roll <= 0);
      const n = r.cfg.mode === 'tt' && k.cookies > 0 ? '×' + k.cookies : '';
      if (h.n.textContent !== n) h.n.textContent = n;
      h.pad.querySelector('.tb.item .ic').textContent = slot || '🎁';
      h.pad.querySelector('.tb.item').classList.toggle('ready', !!k.item && k.roll <= 0);
      if (k.place !== G.lastPlace[k.human]) {
        G.lastPlace[k.human] = k.place;
        h.place.classList.remove('pop');
        void h.place.offsetWidth;
        h.place.classList.add('pop');
      }
      const pl = ord(k.place);
      if (h.place.textContent !== pl) h.place.textContent = pl;
      h.place.className = h.place.className.replace(/\bp[123]\b/g, '').trim() + (k.place <= 3 ? ' p' + k.place : '');
      h.place.style.display = r.cfg.mode === 'tt' ? 'none' : '';
      const b = k.buddy;
      const fill = b.on ? (b.phase === 'leave' ? 0 : Math.max(0, b.left / r.L.visit)) : 0;
      h.bud.style.setProperty('--fill', fill.toFixed(3));
      h.bud.classList.toggle('on', b.on);
      const cb = h.pad.querySelector('.callbtn');
      cb.style.setProperty('--fill', fill.toFixed(3));
      cb.classList.toggle('on', b.on);
      h.wrong.classList.toggle('show', k.wrongT > 1.2 && !k.finished);
      G.msgT[k.human] -= dt;
      if (G.msgT[k.human] <= 0) h.msg.classList.remove('show');
      h.mapT = (h.mapT || 0) - dt;
      if (h.mapT <= 0) {
        h.mapT = 0.1;
        drawMap(h, r, k);
      }
    }
    G.countT -= dt;
    if (G.countT <= 0) $('count').classList.remove('show');
  }

  function msg(p, text, cls, dur) {
    const h = hudEls[p];
    if (!h) return;
    h.msg.textContent = text;
    h.msg.className = 'msg' + (cls ? ' ' + cls : '');
    void h.msg.offsetWidth;
    h.msg.classList.add('show');
    G.msgT[p] = dur || 1.4;
  }
  function count(text, go) {
    const c = $('count');
    c.textContent = text;
    c.className = 'count' + (go ? ' go' : '') + (G.race && G.race.humans.length > 1 ? ' duo' : '');
    void c.offsetWidth;
    c.classList.add('show');
    G.countT = go ? 0.8 : 0.9;
  }

  // ------------------------------------------------------------------ what the race reports

  function onEvent(e) {
    const r = G.race;
    const k = e.k >= 0 ? r.karts[e.k] : null;
    const kid = k && k.human >= 0 && !G.demo;
    const p = kid ? k.human : -1;
    const loud = !G.demo;
    switch (e.type) {
      case 'count': if (loud) { count(String(e.n)); sfx.count(e.n); } break;
      case 'go': if (loud) { count('GO!', true); sfx.go(); Kit.sound.music('play'); } break;
      case 'box': if (kid) sfx.box(); break;
      case 'gotItem': if (kid) sfx.got(); break;
      case 'use':
        if (!kid) break;
        if (e.item === 'banana') sfx.banana();
        else if (e.item === 'ball') sfx.throwBall();
        else if (e.item === 'shield') { sfx.shield(); msg(p, 'PEACE SHIELD! ✌️', 'cool'); }
        else if (e.item === 'cookie') { sfx.cookie(); msg(p, 'TURBO COOKIE! 🍪', 'good', 1); }
        else if (e.item === 'bubble') sfx.bubble();
        break;
      case 'spin':
      case 'float': {
        const by = e.by >= 0 ? r.karts[e.by] : null;
        if (kid) {
          sfx[e.type === 'spin' ? 'spin' : 'float']();
          msg(p, e.type === 'float' ? 'BUBBLED! 🫧' : e.what === 'banana' ? 'SLIPPY BANANA! 🍌' : e.what === 'ball' ? 'BONK! 🏀' : 'BOING!', 'ouch');
        }
        if (by && by.human >= 0 && !G.demo && by !== k) { msg(by.human, "GOT 'EM! 🎯", 'good', 1.1); if (!kid) sfx.bonk(); }
        break;
      }
      case 'blocked':
        if (kid) { sfx.blocked(); msg(p, 'BLOCKED! ✌️', 'cool', 1.1); }
        burst(k, '#ff8ab8');
        break;
      case 'saved':
        if (kid) {
          sfx.saved();
          msg(p, `${Kit.roster.get(Kit.roster.buddyFor(k.ch)).name} SAVED YOU!`, 'good', 1.8);
          const b = buddyViews[p];
          if (b) b.person && (k.buddy.sigT = 1.6);
        }
        burst(k, '#7dff5a');
        break;
      case 'buddyCall':
        if (kid) {
          sfx.call();
          msg(p, `${Kit.roster.get(Kit.roster.buddyFor(k.ch)).name} IS COMING!`, 'cool', 1);
        }
        break;
      case 'buddyAgain': if (kid) sfx.call(); break;
      case 'tow':
        if (kid) {
          sfx.tow();
          msg(p, 'TOW BOOST! 💨', 'good', 1.2);
          const b = buddyViews[p];
          if (b) b.ropeT = 1.6;
        }
        break;
      case 'treat':
        if (kid) {
          const b = buddyViews[p];
          if (b) {
            fx.toss(e.treat, () => b.root.position.clone().setY(b.root.position.y + 1.5), () => new T.Vector3(k.x, k.y + 1.5, k.z), 0.7, () => {
              sfx.treat();
              msg(p, `${e.treat} YUM!`, 'good', 1);
            });
          }
        }
        break;
      case 'lap':
        if (kid) {
          if (e.final) { sfx.finalLap(); msg(p, 'FINAL LAP!', '', 1.8); }
          else { sfx.lap(); msg(p, `LAP ${e.lap}!`, 'cool', 1.2); }
        }
        break;
      case 'finish':
        if (kid) {
          const tt = r.cfg.mode === 'tt';
          sfx.finish(tt || k.place <= 3);
          msg(p, tt ? 'FINISH! 🏁' : `${ord(k.place)}! 🏁`, k.place === 1 || tt ? '' : 'cool', 3);
          fx.confetti(k.x, k.y + 2, k.z);
          Kit.sound.music('title');
        }
        break;
      case 'done': if (!G.demo) G.overT = 3.2; break;
      case 'driftLv': if (kid) sfx.driftLv(e.lv); break;
      case 'driftBoost': case 'trickBoost': if (kid) sfx.boost(); break;
      case 'pad': if (kid) sfx.pad(); break;
      case 'trick': if (kid) { sfx.trick(); msg(p, 'TRICK! ⭐', 'cool', 0.9); } break;
      case 'land': if (kid) sfx.land(); break;
      case 'boing': if (kid) { sfx.boing(); msg(p, 'BOING!', 'good', 0.8); } break;
      case 'wall': case 'bump': if (kid && e.v > 5) sfx.wall(); break;
      case 'bonk': if (kid) sfx.bonk(); break;
      case 'hop': if (kid) sfx.hop(); break;
      case 'shortcut': if (kid) msg(p, 'SHORTCUT! 🤫', 'cool', 1.1); break;
      case 'rescue':
        if (views[e.k]) views[e.k].balloonT = 1.6;
        if (kid) { sfx.rescue(); msg(p, 'UP YOU GO! 🎈', 'cool', 1.4); }
        break;
      case 'pop': if (kid) sfx.pop(); break;
    }
  }

  function burst(k, col) {
    if (k) fx.burst(k.x, k.y + 1.2, k.z, col, 14);
  }

  // ------------------------------------------------------------------ the loop

  function tick() {
    const r = G.race;
    const inputs = G.demo ? null : [0, 1].map((i) => {
      const kid = G.bots && r.karts.find((k) => k.human === i);
      return kid ? G.bots[i](r, kid) : Input.snapshot(i);
    });
    S.step(r, inputs);
    const evs = r.events;
    r.events = [];
    for (const e of evs) onEvent(e);
  }

  function update(dt) {
    G.time = (G.time || 0) + dt;
    for (let i = G.timers.length - 1; i >= 0; i--) {
      const tm = G.timers[i];
      tm.t -= dt;
      if (tm.t <= 0) { G.timers.splice(i, 1); tm.fn(); }
    }
    const r = G.race;
    if (!r || !world) return;
    syncViews(dt);
    fx.update(dt);
    if (G.demo) demoCam(dt);
    else for (const k of r.humans) chase(k.human, k, dt);
    if (G.look) {
      // a test camera: look at a kid's kart from an angle (game.look)
      const k = me(0) || r.order[0], o = G.look;
      const a = k.h + o.a;
      cams[0].position.set(k.x + Math.cos(a) * o.d, k.y + o.y, k.z + Math.sin(a) * o.d);
      cams[0].lookAt(k.x, k.y + 0.9, k.z);
    }
    if (!G.demo && G.screen === 'race') {
      updateHud(dt);
      // the kids' engines
      G.engineT -= dt;
      if (G.engineT <= 0 && !G.paused) {
        G.engineT = 0.085;
        for (const k of r.humans) if (r.phase !== 'countdown' || true) sfx.engine(Math.abs(k.speed), k.boostT > 0);
      }
    }
    if (G.overT > 0) {
      G.overT -= dt;
      if (G.overT <= 0 && G.screen === 'race') showResults();
    }
    if (G.demo && r.phase === 'done' && G.overT < 0) G.overT = 0.01;
    if (G.demo && G.overT >= 0 && G.overT < 0.05 && r.phase === 'done') { G.overT = -1; startDemo(); }
  }

  // name tags only for karts a little way off (close up they'd fill the screen)
  function tagsFor(cam) {
    for (const v of views) {
      const d = cam.position.distanceTo(v.root.position);
      v.tag.visible = d > 9 && d < 110;
    }
  }

  function draw() {
    const r = G.race;
    const w = renderer.domElement.clientWidth || window.innerWidth, h = renderer.domElement.clientHeight || window.innerHeight;
    const duo = r && !G.demo && r.humans.length > 1;
    if (!duo) {
      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, w, h);
      if (cams[0].aspect !== w / h) { cams[0].aspect = w / h; cams[0].updateProjectionMatrix(); }
      tagsFor(cams[0]);
      renderer.render(scene, cams[0]);
      return;
    }
    renderer.setScissorTest(true);
    for (let i = 0; i < 2; i++) {
      const y = i === 0 ? Math.ceil(h / 2) : 0;
      renderer.setViewport(0, y, w, Math.floor(h / 2));
      renderer.setScissor(0, y, w, Math.floor(h / 2));
      const asp = w / (h / 2);
      if (cams[i].aspect !== asp) { cams[i].aspect = asp; cams[i].updateProjectionMatrix(); }
      tagsFor(cams[i]);
      renderer.render(scene, cams[i]);
    }
    renderer.setScissorTest(false);
  }

  function advance(dt) {
    const r = G.race;
    const running = r && !G.paused && (G.demo || G.screen === 'race' || G.screen === 'results');
    if (running) {
      G.acc += dt;
      let n = 0;
      while (G.acc >= DT && n < 8) {
        tick();
        G.acc -= DT;
        n++;
      }
      if (n >= 8) G.acc = 0;
    }
    update(running ? dt : 0);
  }

  let last = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, last ? (now - last) / 1000 : 0.016);
    last = now;
    if (G.hold) return;
    advance(dt);
    draw();
  }

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    if (!w || !h) return;
    const duo = G.race && !G.demo && G.race.humans.length > 1;
    renderer.setPixelRatio(Math.min(duo ? 1.5 : 2, window.devicePixelRatio || 1));
    renderer.setSize(w, h, false);
  }

  // ------------------------------------------------------------------ races

  // who races, front of the grid first: the kids start at the back on a first race, then by cup points
  function grid(humans) {
    let cpu = CAST.filter((c) => !humans.includes(c));
    if (G.gp && G.gp.race > 0) {
      const pts = G.gp.points;
      const all = cpu.concat(humans).sort((a, b) => (pts[b] || 0) - (pts[a] || 0));
      return all.map((ch) => ({ ch, human: humans.indexOf(ch) >= 0 ? humans.indexOf(ch) : undefined }));
    }
    cpu = cpu.sort(() => Math.random() - 0.5);
    return cpu.map((ch) => ({ ch })).concat(humans.map((ch, i) => ({ ch, human: i })).reverse());
  }

  function startRace(track) {
    G.demo = false;
    G.paused = false;
    G.overT = -1;
    G.acc = 0;
    const humans = G.mode === '2p' ? [G.picks[0], G.picks[1]] : [G.picks[0]];
    Input.solo = G.mode !== '2p';
    Input.clear();
    const racers = G.mode === 'tt' ? [{ ch: humans[0], human: 0 }] : grid(humans);
    G.race = S.createRace({ track, level: G.level, mode: G.mode === 'tt' ? 'tt' : G.gp ? 'gp' : 'race', racers, seed: (Math.random() * 1e9) | 0 });
    G.track = track;
    loadTrack(track);
    makeViews(G.race);
    camSt[0].init = camSt[1].init = false;
    setupHud(G.race);
    show('race');
    resize();
    Kit.sound.music('pause');
  }

  function startDemo() {
    G.demo = true;
    G.overT = -1;
    G.camT = 0;
    G.camMode = 2; // the first view is the chase
    const tracks = K.TRACKS.map((t) => t.id);
    let id = tracks[Math.floor(Math.random() * tracks.length)];
    if (G.firstDemo === undefined) { G.firstDemo = true; id = 'backyard'; }
    G.race = S.createRace({ track: id, level: 'normal', mode: 'demo', racers: CAST.map((ch) => ({ ch })), seed: (Math.random() * 1e9) | 0 });
    G.race.phase = 'race';
    loadTrack(id);
    makeViews(G.race);
    camSt[0].init = false;
    resize();
  }

  // ------------------------------------------------------------------ screens

  const SCREENS = ['title', 'select', 'pause', 'results', 'trophy'];
  function show(name) {
    G.screen = name;
    for (const s of SCREENS) $(s).classList.toggle('hidden', s !== name && !(name === 'pause' && s === 'pause'));
    const racing = name === 'race' || name === 'pause';
    $('hud').classList.toggle('hidden', !racing);
    $('touch').classList.toggle('hidden', !(racing && Input.touchMode) || name === 'pause');
    $('split').classList.toggle('hidden', !(racing && G.race && G.race.humans.length > 1));
    $('menuMute').classList.toggle('hidden', racing);
    if (!racing) $('count').classList.remove('show');
  }

  function showTitle() {
    G.gp = null;
    Input.clear();
    if (!G.demo) startDemo();
    show('title');
    Kit.sound.music('title');
    updateTitle();
  }
  function updateTitle() {
    for (const b of document.querySelectorAll('[data-level]')) b.setAttribute('aria-checked', String(b.dataset.level === G.level));
  }

  function showSelect(mode) {
    if (mode) G.mode = mode;
    if (G.mode === '2p' && G.picks[0] === G.picks[1]) G.picks[1] = G.picks[0] === 'tommy' ? 'teddy' : 'tommy';
    if (G.mode === 'tt' && G.pick.cup !== undefined) G.pick = { track: 'backyard' };
    show('select');
    buildSelect();
  }

  function card(cls, html, on, click) {
    const b = document.createElement('button');
    b.className = 'card ' + cls + (on ? ' on' : '');
    b.innerHTML = html;
    b.addEventListener('click', click);
    return b;
  }

  function buildSelect() {
    const duo = G.mode === '2p';
    $('selTitle').textContent = duo ? 'PICK YOUR DRIVERS' : 'PICK YOUR DRIVER';
    $('row1').style.display = duo ? '' : 'none';
    $('row0h').style.display = duo ? '' : 'none';
    for (let p = 0; p < 2; p++) {
      const box = $('cards' + p);
      box.innerHTML = '';
      for (const id of CAST) {
        const e = Kit.roster.get(id);
        const c = card((p ? 'p2' : '') + ' drv', `<img alt="" src="${G.portraits[id] || ''}"><span class="nm">${e.name}</span><span class="bl">${BLURB[id]}</span><span class="boo"></span>`, G.picks[p] === id, () => {
          if (duo && G.picks[1 - p] === id) G.picks[1 - p] = G.picks[p];
          G.picks[p] = id;
          sfx.click();
          if (e.scare) {
            const boo = c.querySelector('.boo');
            boo.textContent = 'BOO!';
            boo.classList.remove('show');
            void boo.offsetWidth;
            boo.classList.add('show');
            Kit.sound.groan();
          }
          buildSelect();
        });
        box.appendChild(c);
      }
    }
    const races = $('races');
    races.innerHTML = '';
    const tt = G.mode === 'tt';
    $('raceHead').textContent = tt ? 'PICK A TRACK' : 'PICK A CUP OR A TRACK';
    if (!tt) {
      K.CUPS.forEach((cup, i) => {
        const got = G.save.cups[G.level + ':' + cup.id];
        const names = cup.tracks.map((id) => K.trackDef(id).emoji).join(' ');
        races.appendChild(card('cup', `<span class="e">${cup.emoji}</span><span class="nm">${cup.name}</span><span class="bl">${names}</span>${got ? `<span class="tr">${got}</span>` : ''}`, G.pick.cup === i, () => {
          G.pick = { cup: i };
          sfx.click();
          buildSelect();
        }));
      });
    }
    for (const d of K.TRACKS) {
      const best = G.save.best[G.level + ':' + d.id];
      races.appendChild(card('race', `<span class="e">${d.emoji}</span><span class="nm">${d.name}</span>${tt && best ? `<span class="bl">⏱️ ${fmt(best)}</span>` : ''}`, G.pick.track === d.id, () => {
        G.pick = { track: d.id };
        sfx.click();
        buildSelect();
      }));
    }
  }

  function go() {
    if (G.pick.cup !== undefined && G.mode !== 'tt') {
      G.gp = { cup: G.pick.cup, race: 0, points: {}, results: [] };
      startRace(K.CUPS[G.pick.cup].tracks[0]);
    } else {
      G.gp = null;
      startRace(G.pick.track || 'backyard');
    }
  }

  function pause() {
    if (G.screen !== 'race' || G.paused) return;
    G.paused = true;
    show('pause');
    $('hud').classList.remove('hidden');
    Kit.sound.music('pause');
  }
  function resume() {
    if (!G.paused) return;
    G.paused = false;
    show('race');
    Kit.sound.music('play');
  }

  function showResults() {
    const r = G.race;
    const st = S.standings(r);
    const tt = r.cfg.mode === 'tt';
    const humans = st.filter((s) => s.human >= 0);
    const best = humans.length ? Math.min(...humans.map((s) => s.place)) : 7;
    let title, sub = '';
    if (tt) {
      const s = humans[0];
      const key = G.level + ':' + r.trk.id;
      const old = G.save.best[key];
      const fresh = s.finished && (!old || s.time < old);
      if (fresh) { G.save.best[key] = s.time; save(); }
      title = fresh ? 'NEW BEST TIME!' : 'FINISH!';
      sub = `${fmt(s.time)} · best lap ${fmt(s.best)}`;
    } else {
      title = best === 1 ? '1st PLACE!' : best <= 3 ? `${ord(best)} PLACE!` : 'GREAT RACE!';
      if (humans.length > 1) {
        const w = humans[0];
        title = `${Kit.roster.get(w.ch).name} WINS!`;
        if (humans.every((h) => h.place > 3)) title = 'GREAT RACE!';
      }
    }
    if (G.gp && !r.scored) {
      r.scored = true;
      G.gp.results.push(st);
      st.forEach((s) => { G.gp.points[s.ch] = (G.gp.points[s.ch] || 0) + (K.POINTS[s.place - 1] || 0); });
    }
    if (G.gp) {
      const cup = K.CUPS[G.gp.cup];
      sub = `${cup.emoji} ${cup.name} · RACE ${G.gp.race + 1} OF ${cup.tracks.length}`;
    }
    $('resTitle').textContent = title;
    $('resTitle').classList.toggle('win', best === 1 || tt);
    $('resSub').textContent = sub;
    const rows = [`<tr><th></th><th></th><th>TIME</th>${G.gp ? `<th>POINTS</th><th>TOTAL</th>` : tt ? `<th>BEST LAP</th>` : ''}</tr>`];
    for (const s of st) {
      const e = Kit.roster.get(s.ch);
      const cls = s.human === 0 ? 'me' : s.human === 1 ? 'me2' : '';
      rows.push(`<tr class="${cls}"><td class="pl">${ord(s.place)}</td><td class="who"><img alt="" src="${G.portraits[s.ch] || ''}">${e.name}</td><td>${s.finished ? fmt(s.time) : '–'}</td>${G.gp ? `<td class="pts">+${K.POINTS[s.place - 1] || 0}</td><td>${G.gp.points[s.ch]}</td>` : tt ? `<td>${fmt(s.best)}</td>` : ''}</tr>`);
    }
    $('resTable').innerHTML = rows.join('');
    const more = G.gp && G.gp.race + 1 < K.CUPS[G.gp.cup].tracks.length;
    $('nextBtn').textContent = G.gp ? (more ? 'NEXT RACE ▶' : 'THE TROPHY! 🏆') : 'PICK ANOTHER ▶';
    $('againBtn').style.display = G.gp ? 'none' : '';
    show('results');
    if (best === 1 || (tt && title === 'NEW BEST TIME!')) sfx.fanfare();
  }

  function next() {
    if (G.gp) {
      G.gp.race++;
      const cup = K.CUPS[G.gp.cup];
      if (G.gp.race < cup.tracks.length) startRace(cup.tracks[G.gp.race]);
      else showTrophy();
    } else {
      G.demo = false;
      showSelect();
      startDemo();
    }
  }

  function showTrophy() {
    const cup = K.CUPS[G.gp.cup];
    const pts = G.gp.points;
    const order = Object.keys(pts).sort((a, b) => pts[b] - pts[a]);
    const humans = G.mode === '2p' ? [G.picks[0], G.picks[1]] : [G.picks[0]];
    const place = Math.min(...humans.map((h) => order.indexOf(h) + 1));
    const prize = place === 1 ? '🏆' : place === 2 ? '🥈' : place === 3 ? '🥉' : '🎖️';
    $('trophyCup').textContent = prize;
    const winner = order[0];
    $('trophyTitle').textContent = place === 1 ? (humans.length > 1 ? `${Kit.roster.get(winner).name} WINS THE CUP!` : 'YOU WIN THE CUP!') : place <= 3 ? `${ord(place)} IN THE CUP!` : 'GREAT DRIVING!';
    $('trophySub').textContent = `${cup.emoji} ${cup.name}`;
    const pod = [order[1], order[0], order[2]];
    $('podium').innerHTML = pod.map((ch, i) => (ch ? `<div class="step s${[2, 1, 3][i]}"><img alt="" src="${G.portraits[ch] || ''}"><div class="blk">${[2, 1, 3][i]}</div></div>` : '')).join('');
    const rows = [`<tr><th></th><th></th><th>POINTS</th></tr>`];
    order.forEach((ch, i) => {
      const cls = ch === humans[0] ? 'me' : ch === humans[1] ? 'me2' : '';
      rows.push(`<tr class="${cls}"><td class="pl">${ord(i + 1)}</td><td class="who"><img alt="" src="${G.portraits[ch] || ''}">${Kit.roster.get(ch).name}</td><td>${pts[ch]}</td></tr>`);
    });
    $('cupTable').innerHTML = rows.join('');
    // keep the best prize won in each cup, per level
    const key = G.level + ':' + cup.id;
    const rank = (e) => ['🏆', '🥈', '🥉', '🎖️'].indexOf(e);
    if (!G.save.cups[key] || rank(prize) < rank(G.save.cups[key])) { G.save.cups[key] = prize; save(); }
    show('trophy');
    if (place <= 3) sfx.fanfare();
    G.lastCup = G.gp.cup;
  }

  // ------------------------------------------------------------------ wiring

  function initUI() {
    $('logoText').textContent = K.TITLE.toUpperCase();
    $('tagline').textContent = K.TAGLINE;
    const first = () => { Kit.sound.init(); if (G.screen === 'title') Kit.sound.music('title'); };
    window.addEventListener('pointerdown', first, { once: false });
    window.addEventListener('keydown', first);
    for (const b of document.querySelectorAll('[data-mode]')) b.addEventListener('click', () => { sfx.click(); showSelect(b.dataset.mode); });
    for (const b of document.querySelectorAll('[data-level]')) b.addEventListener('click', () => { G.level = b.dataset.level; sfx.click(); updateTitle(); });
    $('selBack').addEventListener('click', () => { sfx.click(); showTitle(); });
    $('selGo').addEventListener('click', () => { sfx.click(); go(); });
    $('pauseBtn').addEventListener('click', pause);
    $('resumeBtn').addEventListener('click', resume);
    $('quitBtn').addEventListener('click', () => { G.paused = false; G.demo = false; showTitle(); });
    $('nextBtn').addEventListener('click', () => { sfx.click(); next(); });
    $('againBtn').addEventListener('click', () => { sfx.click(); startRace(G.track); });
    $('menuBtn').addEventListener('click', () => { sfx.click(); G.demo = false; showTitle(); });
    $('cupAgain').addEventListener('click', () => { sfx.click(); G.pick = { cup: G.lastCup || 0 }; go(); });
    $('cupMenu').addEventListener('click', () => { sfx.click(); G.demo = false; showTitle(); });
    for (const b of document.querySelectorAll('.muteBtn')) b.addEventListener('click', toggleMute);
    for (const b of document.querySelectorAll('#hud .bud')) b.addEventListener('pointerdown', (e) => { Input.pressCall(+b.dataset.p); e.stopPropagation(); });
    Input.bindPad(document.querySelector('#touch .p0'), 0);
    Input.bindPad(document.querySelector('#touch .p1'), 1);
    Input.onTouchFirst = () => {
      document.body.classList.add('touch');
      if (G.screen === 'race') $('touch').classList.remove('hidden');
    };
    if (/[?&]touch=1/.test(location.search)) { Input.touchMode = true; document.body.classList.add('touch'); }
    window.addEventListener('keydown', (e) => {
      if (Kit.help && Kit.help.isOpen && Kit.help.isOpen()) return;
      const c = e.code;
      if (c === 'KeyM') toggleMute();
      if (G.screen === 'race') {
        if (c === 'KeyP' || c === 'Escape') pause();
      } else if (G.screen === 'pause') {
        if (c === 'KeyP' || c === 'Escape' || c === 'Space') resume();
        else if (c === 'KeyQ') { G.paused = false; G.demo = false; showTitle(); }
      } else if (G.screen === 'title') {
        if (c === 'Enter' || c === 'Space') showSelect('1p');
        else if (c === 'Digit1') showSelect('1p');
        else if (c === 'Digit2') showSelect('2p');
        else if (c === 'Digit3') showSelect('tt');
        else if (c === 'KeyE') { G.level = G.level === 'easy' ? 'normal' : 'easy'; updateTitle(); }
      } else if (G.screen === 'select') {
        if (c === 'Enter') go();
        else if (c === 'Escape') showTitle();
        else if (c === 'ArrowLeft' || c === 'ArrowRight' || c === 'KeyA' || c === 'KeyD') {
          const i = CAST.indexOf(G.picks[0]), d = c === 'ArrowLeft' || c === 'KeyA' ? -1 : 1;
          let n = (i + d + CAST.length) % CAST.length;
          if (G.mode === '2p' && CAST[n] === G.picks[1]) n = (n + d + CAST.length) % CAST.length;
          G.picks[0] = CAST[n];
          buildSelect();
        }
      } else if (G.screen === 'results') {
        if (c === 'Enter') next();
        else if (c === 'Escape') { G.demo = false; showTitle(); }
      } else if (G.screen === 'trophy') {
        if (c === 'Enter' || c === 'Escape') { G.demo = false; showTitle(); }
      }
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { if (G.screen === 'race' && G.autoPause) pause(); Kit.sound.suspend(); } else Kit.sound.resume();
    });
    Kit.lang.onChange(() => {
      if (G.screen === 'select') buildSelect();
    });
  }

  function toggleMute() {
    Kit.sound.init();
    Kit.sound.toggleMute();
    for (const b of document.querySelectorAll('.muteBtn')) b.textContent = Kit.sound.isMuted() ? '🔇' : '🔊';
  }

  function boot() {
    const canvas = $('game');
    renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.outputEncoding = T.sRGBEncoding;
    scene = new T.Scene();
    hemi = new T.HemisphereLight('#ffffff', '#666666', 0.8);
    scene.add(hemi);
    sun = new T.DirectionalLight('#fff3dc', 1.2);
    sun.position.set(80, 160, 60);
    scene.add(sun);
    scene.add(sun.target);
    fx = KartFx.create(scene);
    G.portraits = Kit.portraits(Kit.roster.list, { size: 128 });
    for (const b of document.querySelectorAll('.muteBtn')) b.textContent = Kit.sound.isMuted() ? '🔇' : '🔊';
    initUI();
    window.addEventListener('resize', resize);
    resize();
    showTitle();
    $('loading').classList.add('hidden');
    requestAnimationFrame(frame);
  }

  // ------------------------------------------------------------------ test hooks

  function state() {
    const r = G.race;
    if (!r) return { screen: G.screen };
    return {
      screen: G.screen, demo: G.demo, mode: r.cfg.mode, level: r.cfg.level, track: r.trk.id, phase: r.phase, time: +r.time.toFixed(2),
      laps: r.laps, gp: G.gp ? { cup: G.gp.cup, race: G.gp.race, points: G.gp.points } : null,
      karts: r.karts.map((k) => ({ ch: k.ch, human: k.human, place: k.place, lap: k.lap, dist: +k.dist.toFixed(1), x: +k.x.toFixed(1), z: +k.z.toFixed(1), speed: +k.speed.toFixed(1), item: k.item, finished: k.finished, path: k.path, buddy: k.buddy.phase })),
      items: r.items.map((o) => o.kind), stat: r.stat,
    };
  }

  function me(i) { return G.race && G.race.karts.find((k) => k.human === (i || 0)); }

  // Stage a moment for a screenshot or a check: 'buddy', 'saved', 'shield', 'spin', 'bubble', 'boost', 'drift', 'item:<kind>', 'ramp'
  function setup(kind) {
    const r = G.race;
    if (!r || G.demo) return 'start a race first';
    if (r.phase === 'countdown') { r.phase = 'race'; r.phaseT = 0; }
    const k = me(0);
    if (kind === 'buddy') S.callBuddy(r, k);
    else if (kind === 'saved') {
      // the brother is riding along when a banana gets you
      S.callBuddy(r, k);
      k.buddy.phase = 'ride';
      k.invT = 0;
      S.hit(r, k, 'spin', null, 'banana');
    } else if (kind === 'shield') { k.item = 'shield'; S.useItem(r, k); }
    else if (kind === 'spin') S.hit(r, k, 'spin', null, 'banana');
    else if (kind === 'bubble') S.hit(r, k, 'float', null, 'bubble');
    else if (kind === 'boost') k.boostT = 2;
    else if (kind === 'drift') { k.drift = 1; k.driftT = 2; k.driftLv = 2; }
    else if (kind && kind.startsWith('item:')) { k.item = kind.slice(5); k.roll = 0; }
    return state();
  }

  window.game = {
    // jump into a race: { mode: '1p' | '2p' | 'tt', level, track, cup (index: a Grand Prix), picks: [p1, p2] }
    start(o) {
      const opts = o || {};
      if (opts.mode) G.mode = opts.mode;
      if (opts.level) G.level = opts.level;
      if (opts.picks) G.picks = opts.picks.slice();
      if (opts.cup !== undefined) G.pick = { cup: opts.cup };
      else G.pick = { track: opts.track || 'backyard' };
      go();
      return state();
    },
    // advance the game by `sec` seconds right now and draw it (for a hidden, throttled browser tab)
    step(sec) {
      const n = Math.max(1, Math.round((sec || DT) / DT));
      for (let i = 0; i < n; i++) advance(DT);
      draw();
      return state();
    },
    hold(on) { G.hold = !!on; },
    // let test bots drive the kids' karts: autoplay('good') or autoplay('kid'); autoplay(false) gives them back
    autoplay(kind) { G.bots = kind ? [K.soak.bot(kind, 3), K.soak.bot(kind, 4)] : null; },
    set autoPause(v) { G.autoPause = !!v; },
    get autoPause() { return G.autoPause; },
    state, setup, pause, resume, next,
    // look at the kid's kart from angle a (0 = in front, PI = behind), d metres away, y up; look(null) ends it
    look(a, d, y) { G.look = a === null || a === undefined ? null : { a, d: d || 4.5, y: y === undefined ? 1.8 : y }; },
    title: () => { G.demo = false; showTitle(); return G.screen; },
    select: (mode) => { showSelect(mode || '1p'); return G.screen; },
    results: () => { if (G.race && !G.demo) showResults(); return G.screen; },
    trophy: () => { if (G.gp) showTrophy(); return G.screen; },
    // finish the race now: every kart crosses the line in its current order (for checking results and the cup)
    finish() {
      const r = G.race;
      if (!r || G.demo) return null;
      r.order.forEach((k, i) => { if (!k.finished) { k.finished = true; k.finishT = r.time + i * 0.7; } });
      r.phase = 'done';
      S.standings(r);
      return state();
    },
    call: (p) => { const k = me(p || 0); if (k) S.callBuddy(G.race, k); return state(); },
    press: (p, act) => { if (act === 'call') Input.pressCall(p || 0); },
    soak: (n, o) => K.soak.soak(n, o),
    race: () => G.race,
    three: () => ({ scene, renderer, cams, world }),
    G,
  };

  try {
    boot();
  } catch (err) {
    $('loading').textContent = 'Oops, something broke: ' + err.message;
    throw err;
  }
})();
