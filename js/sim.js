/* TT Kart: the race itself, with no drawing. Karts, laps, item boxes and items, hits, obstacles, the companion's
   visits and the help for little drivers all live here, so the headless soak (node tools/soak.js) races exactly what
   the page races. js/game.js draws a race and turns its events into sound and words.
   Units are metres and seconds; the sim ticks at a fixed 60 per second. A kart's heading h points along
   (cos h, sin h) on the ground; steering right (+1) turns towards (-sin h, cos h). */
(function (root) {
  'use strict';
  const K = (root.KART = root.KART || {});
  const G = K.geo;
  const DT = 1 / 60;
  const GRAV = 27;
  const COUNT = 3; // the 3-2-1 before GO
  const KART_R = 1.15; // karts bump at twice this
  const ITEMS = ['banana', 'ball', 'shield', 'cookie', 'bubble'];
  const TREATS = ['🍦', '💧', '🧃', '🍪', '🍉', '🍌'];

  const LEVELS = {
    // 🐣 for Tommy (5): the gas is always on, steering keeps you on the road, slower CPUs, big catch-up help
    easy: {
      vmax: 23, acc: 15, turn: 2.35, cpu: 0.88, cpuSpread: 0.035, autoGas: true, assist: true, offroad: 0.66, wallKeep: 0.85,
      spin: 0.75, catchup: 0.16, rubberDown: 0.28, rubberUp: 0.18, rubberGap: 25, drift: [0.45, 1.0], visit: 12, cpuItemWait: 3,
      cpuShortcut: 0.2, cpuAim: 0.5,
    },
    // 🔥 for Teddy (8): you drive, the CPUs are quick and use their items
    normal: {
      vmax: 25.5, acc: 14, turn: 2.3, cpu: 0.93, cpuSpread: 0.03, autoGas: false, assist: false, offroad: 0.5, wallKeep: 0.65,
      spin: 1.1, catchup: 0.06, rubberDown: 0.15, rubberUp: 0.12, rubberGap: 60, drift: [0.6, 1.3], visit: 9, cpuItemWait: 1.2,
      cpuShortcut: 0.45, cpuAim: 1,
    },
  };
  const SURF = { road: 1, verge: 0, dirt: 0.8, water: 0.8, snow: 0.86, cookie: 0.84, tiles: 0.92, alley: 0.9 };

  // a small seeded random number generator, so a race can be replayed exactly
  function rng(seed) {
    let a = (seed >>> 0) || 1;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));

  // ------------------------------------------------------------------ a race

  // cfg: { track, level, mode: 'gp' | 'race' | 'tt' | 'demo', racers: [{ ch, human: 0 | 1 | undefined }], laps, seed, test }
  function createRace(cfg) {
    const trk = K.track(cfg.track);
    const L = LEVELS[cfg.level] || LEVELS.easy;
    const r = {
      cfg, trk, L, laps: cfg.laps || trk.def.laps || 3, karts: [], items: [], boxes: [], events: [], time: 0, clock: 0,
      phase: 'countdown', phaseT: 0, rand: rng(cfg.seed || 1), humans: [], doneT: 0, test: cfg.test || {},
      stat: { rescues: 0, rescueWhy: [], maxOff: 0, offTicks: 0, hits: 0, items: 0, boxes: 0, saves: 0, shortcut: 0, airs: 0, nan: 0 },
    };
    cfg.racers.forEach((spec, i) => r.karts.push(makeKart(r, i, spec)));
    r.humans = r.karts.filter((k) => k.human >= 0);
    if (cfg.mode !== 'tt') for (const row of trk.boxRows) for (const b of row) r.boxes.push({ x: b.x, z: b.z, y: b.y + 1.1, path: b.path, s: b.s, lat: b.lat, prog: b.prog, wait: 0 });
    rank(r);
    return r;
  }

  function makeKart(r, i, spec) {
    const g = r.trk.grid0[i];
    const human = spec.human === undefined || spec.human === null ? -1 : spec.human;
    const k = {
      idx: i, ch: spec.ch, human, x: g.x, z: g.z, y: g.y, vx: 0, vz: 0, vy: 0, vyG: 0, h: Math.atan2(g.tz, g.tx), air: false,
      hopping: false, hopHeld: false, itemHeld: false, rampAir: false, trick: false, trickT: 0,
      drift: 0, driftT: 0, driftLv: 0, boostT: 0, spinT: 0, spinA: 0, floatT: 0, invT: 0, shieldT: 0,
      item: null, roll: 0, rollItem: null, cookies: 0, steerV: 0, speed: 0, surface: 'road',
      q: { path: 0 }, path: 0, prog: 0, lastProg: 0, dist: 0, bestD: 0, lap: 1, finished: false, finishT: 0, place: i + 1,
      stuckT: 0, offT: 0, wrongT: 0, rescues: 0, lapStart: 0, lapTimes: [], cu: 1, auto: false,
      personal: 1, vmaxBase: r.L.vmax, padT: 0, sigT: 0,
      ai: { lane: 0, laneT: 0, take: 0, decided: -1, itemT: 0, backT: 0, slowT: 0, stuckT: 0 },
      buddy: { on: false, phase: 'off', t: 0, left: 0, sigT: 0, lastTow: -99, saves: 0, calls: 0, treatAt: 0, treat: '' },
      stats: { hits: 0, items: 0, boxes: 0, saves: 0, airs: 0, shortcuts: 0 },
    };
    if (human < 0) {
      k.personal = 1 + (r.rand() * 2 - 1) * r.L.cpuSpread;
      k.vmaxBase = r.L.vmax * r.L.cpu;
      k.ai.lane = (r.rand() - 0.5) * 6;
    }
    if (r.cfg.mode === 'tt') {
      k.item = 'cookie';
      k.cookies = 3;
    }
    G.query(r.trk, k.x, k.z, 0, k.q);
    k.path = k.q.path;
    k.prog = k.lastProg = k.q.prog;
    k.dist = k.bestD = k.prog > r.trk.L / 2 ? k.prog - r.trk.L : k.prog;
    k.y = G.ground(r.trk, k.q).y;
    return k;
  }

  function ev(r, type, k, extra) {
    const e = Object.assign({ type, k: k ? k.idx : -1, t: r.time }, extra);
    r.events.push(e);
    return e;
  }

  // ------------------------------------------------------------------ one tick

  // inputs[human index] = { steer: -1..1, gas, brake, hop (held), item (held), call (pressed this tick) }
  function step(r, inputs) {
    if (r.phase === 'countdown') {
      const before = Math.ceil(COUNT - r.phaseT);
      r.phaseT += DT;
      const after = Math.ceil(COUNT - r.phaseT);
      if (after !== before && after > 0) ev(r, 'count', null, { n: after });
      for (const k of r.karts) {
        const inp = k.human >= 0 && inputs ? inputs[k.human] : null;
        if (inp && inp.call) callBuddy(r, k);
        updateBuddy(r, k);
      }
      if (r.phaseT >= COUNT) {
        r.phase = 'race';
        r.phaseT = 0;
        ev(r, 'go');
      }
      return;
    }
    r.time += DT;
    r.phaseT += DT;
    if (r.phase === 'race') r.clock = r.time;
    for (const k of r.karts) {
      let inp;
      if (k.human >= 0 && !k.auto && !r.test.botHumans) inp = humanInput(r, k, inputs ? inputs[k.human] : null);
      else inp = K.ai.think(r, k);
      if (k.human >= 0 && inp.call) callBuddy(r, k);
      drive(r, k, inp);
      updateBuddy(r, k);
    }
    collide(r);
    updateItems(r);
    for (const b of r.boxes) if (b.wait > 0) b.wait -= DT;
    rank(r);
    // the race is over when every human has finished (CPU-only races: everyone)
    if (r.phase === 'race') {
      const who = r.humans.length && !r.test.botHumans ? r.humans : r.karts;
      if (who.every((k) => k.finished)) {
        r.phase = 'done';
        r.phaseT = 0;
        ev(r, 'done');
      }
    }
  }

  // what a kid's keys mean, with the 🐣 helpers: the gas pedal and the steering that keeps you on the road
  function humanInput(r, k, raw) {
    const i = raw || { steer: 0, gas: false, brake: false, hop: false, item: false, call: false };
    const out = { steer: i.steer || 0, gas: !!i.gas, brake: !!i.brake, hop: !!i.hop, item: !!i.item, call: !!i.call };
    if (r.L.autoGas || i.autoGas) out.gas = !out.brake;
    if (r.L.assist && k.spinT <= 0 && k.floatT <= 0) {
      // where will we be in half a second? If that's off the road, the helper steers back (more the further out)
      const help = K.ai.steerTo(r, k, K.ai.clearLane(r, k, 0)); // towards the middle of the road ahead, round things
      const lat = k.q.lat || 0, hw = k.q.hw || 8;
      const rel = wrapA(k.h - Math.atan2(k.q.tz || 0, k.q.tx || 1));
      const soon = lat + Math.sin(rel) * Math.max(0, k.speed) * 0.5;
      const edge = Math.max(Math.abs(lat), Math.abs(soon)) - (hw - 2.5);
      out.steer *= 0.85; // gentle hands
      if (!out.steer) out.steer = help * 0.7;
      else if (edge > 0 && Math.sign(out.steer) === Math.sign(soon)) {
        const w = clamp(edge / 2.5, 0, 0.9);
        out.steer = out.steer * (1 - w) + help * w;
      } else if (edge > 1) out.steer = out.steer * 0.5 + help * 0.5;
    }
    return out;
  }

  // ------------------------------------------------------------------ driving

  function drive(r, k, inp) {
    const L = r.L, trk = r.trk;
    const racing = r.phase !== 'countdown';
    k.invT -= DT;
    k.shieldT -= DT;
    k.padT -= DT;
    k.sigT -= DT;
    if (k.boostT > 0) k.boostT -= DT;
    if (k.roll > 0) {
      k.roll -= DT;
      if (k.roll <= 0 && k.rollItem) {
        k.item = k.rollItem;
        k.rollItem = null;
        k.ai.itemT = 0;
        ev(r, 'gotItem', k, { item: k.item });
      }
    }
    let steer = clamp(inp.steer || 0, -1, 1), gas = inp.gas, brake = inp.brake;
    const stunned = k.spinT > 0 || k.floatT > 0;
    if (k.spinT > 0) {
      k.spinT -= DT;
      k.spinA += DT * 15;
    } else k.spinA = 0;
    k.gasIn = !!gas;
    if (stunned) {
      steer = 0;
      gas = brake = false;
      k.drift = 0;
    }
    if (r.test.noSteer && k.human < 0) steer = 0;

    // items
    if (inp.item && !k.itemHeld && !stunned) useItem(r, k);
    k.itemHeld = !!inp.item;

    // hop, drift and tricks
    const hopPress = inp.hop && !k.hopHeld;
    k.hopHeld = !!inp.hop;
    if (hopPress && !stunned) {
      if (!k.air) {
        k.air = true;
        k.hopping = true;
        k.vy = 4.6;
        ev(r, 'hop', k);
      } else if (k.rampAir && !k.trick) {
        k.trick = true;
        k.trickT = 0.5;
        ev(r, 'trick', k);
      }
    }
    k.trickT -= DT;

    // speed along and across the kart
    let fx = Math.cos(k.h), fz = Math.sin(k.h);
    let vf = k.vx * fx + k.vz * fz;
    const spd = Math.abs(vf);
    if (k.drift) {
      if (!inp.hop || vf < 8 || stunned) {
        if (k.driftLv > 0 && !stunned) {
          k.boostT = Math.max(k.boostT, k.driftLv === 2 ? 1.25 : 0.7);
          ev(r, 'driftBoost', k, { lv: k.driftLv });
        }
        k.drift = 0;
        k.driftT = 0;
        k.driftLv = 0;
      } else {
        k.driftT += DT * (0.7 + 0.6 * Math.max(0, steer * k.drift));
        const lv = k.driftT > L.drift[1] ? 2 : k.driftT > L.drift[0] ? 1 : 0;
        if (lv > k.driftLv) ev(r, 'driftLv', k, { lv });
        k.driftLv = lv;
      }
    }
    // steering: gentle when slow, a little gentler at top speed; drifting turns tighter
    // a kart can always turn a little while you press the gas or the brake, even standing still against something
    const low = Math.min(1, spd / 6 + (gas || brake ? 0.3 : 0)), hi = 1 - 0.28 * clamp((spd - 18) / 12, 0, 1);
    let yaw = k.drift ? L.turn * 1.18 * (0.6 * k.drift + 0.4 * steer) * hi : L.turn * steer * low * hi * (vf < -0.5 ? -1 : 1);
    if (k.air) yaw *= 0.55;
    k.steerV += (steer - k.steerV) * Math.min(1, DT * 10);
    if (racing) k.h = wrapA(k.h + yaw * DT);
    fx = Math.cos(k.h);
    fz = Math.sin(k.h);
    const rx = -fz, rz = fx;
    vf = k.vx * fx + k.vz * fz;
    let vl = k.vx * rx + k.vz * rz;

    // the ground under the kart: road, grass, puddles, ice
    const q = k.q;
    let sf = SURF[q.surface] === undefined ? 1 : SURF[q.surface];
    if (q.surface === 'verge') sf = L.offroad;
    let grip = q.surface === 'water' ? 8 : 12;
    for (const zn of trk.zones) {
      const dx = k.x - zn.x, dz = k.z - zn.z;
      if (dx * dx + dz * dz > zn.r * zn.r) continue;
      if (zn.kind === 'slow') sf = Math.min(sf, 0.55);
      if (zn.kind === 'ice') grip = 2.2;
    }
    k.surface = q.surface;
    if (k.drift) grip = Math.min(grip, 3.2);
    let vmax = k.vmaxBase * k.cu * k.personal;
    if (k.boostT > 0) {
      vmax = k.vmaxBase * 1.4;
      sf = Math.max(sf, 0.96);
    }
    vmax *= sf;
    if (k.human >= 0 && k.auto) vmax *= 0.75; // the victory lap: a gentle cruise

    if (!racing) vf = vl = 0;
    else if (k.floatT > 0) {
      vf *= Math.exp(-1.6 * DT);
      vl *= Math.exp(-4 * DT);
    } else if (k.spinT > 0) {
      vf *= Math.exp(-2.6 * DT);
      vl *= Math.exp(-5 * DT);
    } else if (!k.air) {
      if (k.boostT > 0 && vf < vmax) vf = Math.min(vmax, vf + 32 * DT);
      if (gas && !brake) {
        if (vf < vmax) vf += L.acc * (1 - (0.55 * Math.max(0, vf)) / vmax) * DT;
      } else if (brake) {
        vf = vf > 0 ? Math.max(0, vf - 24 * DT) : Math.max(-7, vf - 10 * DT);
      } else vf -= Math.sign(vf) * Math.min(Math.abs(vf), 5 * DT);
      if (vf > vmax) vf = Math.max(vmax, vf - 15 * DT);
      vl *= Math.exp(-grip * DT);
      if (k.drift) vl -= k.drift * 2.6 * DT;
    }
    k.vx = fx * vf + rx * vl;
    k.vz = fz * vf + rz * vl;
    k.speed = vf;
    if (racing) {
      k.x += k.vx * DT;
      k.z += k.vz * DT;
    }

    // where are we now? walls push you back in
    const prevPath = k.path;
    G.query(trk, k.x, k.z, k.path, q);
    if (q.path < 0 || !Number.isFinite(k.x + k.z)) {
      if (!Number.isFinite(k.x + k.z)) r.stat.nan++;
      rescue(r, k, 'lost');
      return;
    }
    if (q.path !== prevPath) {
      if (q.path > 0) {
        k.stats.shortcuts++;
        r.stat.shortcut++;
        ev(r, 'shortcut', k, { path: q.path });
      }
      k.path = q.path;
    }
    if (q.excess > 0) {
      if (!r.test.noWalls) {
        const nx = (q.cx - k.x) / (q.dist || 1), nz = (q.cz - k.z) / (q.dist || 1);
        k.x += nx * q.excess;
        k.z += nz * q.excess;
        const out = -(k.vx * nx + k.vz * nz);
        if (out > 0) {
          k.vx += nx * out * 1.25;
          k.vz += nz * out * 1.25;
          const keep = 1 - (1 - L.wallKeep) * Math.min(1, out / 10);
          k.vx *= keep;
          k.vz *= keep;
          if (out > 3) ev(r, 'wall', k, { v: out });
          // turn the nose a little back along the road, so a kart never stays stuck facing the wall
          if (!r.test.noSteer) {
          const ta = Math.atan2(q.tz, q.tx);
          const d1 = wrapA(ta - k.h), d2 = wrapA(ta + Math.PI - k.h);
          const d = Math.abs(d1) < Math.abs(d2) ? d1 : d2;
          k.h = wrapA(k.h + d * Math.min(1, 3 * DT));
          }
        }
        q.excess = 0;
      } else r.stat.offTicks++;
    }

    // up and down: ramps throw you, the trampoline bounces you, a bubble floats you
    const gr = G.ground(trk, q);
    if (k.floatT > 0) {
      k.floatT -= DT;
      const up = Math.min(1, (1.7 - k.floatT) / 0.35);
      k.y = gr.y + 2.6 * Math.sin((up * Math.PI) / 2) + Math.sin(r.time * 4) * 0.15;
      if (k.floatT <= 0) {
        k.air = true;
        k.vy = 0;
        ev(r, 'pop', k);
      }
    } else if (k.air) {
      k.vy -= GRAV * DT;
      k.y += k.vy * DT;
      if (k.y <= gr.y) {
        k.y = gr.y;
        land(r, k, inp, steer, vf);
      }
    } else if (gr.ramp && gr.ramp.kind === 'bounce' && racing) {
      k.air = true;
      k.rampAir = true;
      k.vy = 12.5;
      k.stats.airs++;
      ev(r, 'boing', k);
    } else if (gr.y >= k.y - 0.35) {
      k.vyG = (gr.y - k.y) / DT;
      k.y = gr.y;
    } else {
      k.air = true;
      k.vy = Math.max(0, k.vyG * 1.25);
      k.rampAir = k.vy > 2;
      if (k.rampAir) {
        k.stats.airs++;
        r.stat.airs++;
        ev(r, 'air', k);
      }
    }
    if (!k.air) k.vyG = k.vyG || 0;

    if (racing) touch(r, k);
    progress(r, k);
  }

  function land(r, k, inp, steer, vf) {
    k.air = false;
    k.vyG = 0;
    if (k.trick) {
      k.boostT = Math.max(k.boostT, 0.9);
      ev(r, 'trickBoost', k);
    }
    if (k.rampAir) ev(r, 'land', k);
    k.trick = false;
    k.rampAir = false;
    if (k.hopping) {
      k.hopping = false;
      if (inp.hop && Math.abs(steer) > 0.3 && vf > 10 && k.spinT <= 0) {
        k.drift = Math.sign(steer);
        k.driftT = 0;
        k.driftLv = 0;
        ev(r, 'drift', k);
      }
    }
  }

  // boxes, boost arrows, things to bump into and things rolling across the road
  function touch(r, k) {
    const trk = r.trk;
    for (const b of r.boxes) {
      if (b.wait > 0) continue;
      const dx = k.x - b.x, dz = k.z - b.z;
      if (dx * dx + dz * dz > 2.3 * 2.3 || Math.abs(k.y + 0.8 - b.y) > 2.2) continue;
      b.wait = 2.5;
      k.stats.boxes++;
      r.stat.boxes++;
      if (!k.item && k.roll <= 0 && k.floatT <= 0) {
        k.roll = 1.1;
        k.rollItem = rollItem(r, k);
      }
      ev(r, 'box', k, { box: r.boxes.indexOf(b) });
    }
    for (const p of trk.pads) {
      const dx = k.x - p.x, dz = k.z - p.z;
      if (dx * dx + dz * dz < 2.8 * 2.8 && !k.air && k.padT <= 0) {
        k.boostT = Math.max(k.boostT, 1.1);
        k.padT = 0.4;
        ev(r, 'pad', k);
      }
    }
    for (const p of trk.posts) bumpCircle(r, k, p.x, p.z, p.r, false);
    for (const m of trk.movers) {
      moverPos(r, m);
      if (bumpCircle(r, k, m.x, m.z, m.r, true)) hit(r, k, 'spin', null, m.art);
    }
  }

  function bumpCircle(r, k, x, z, rad, moving) {
    const dx = k.x - x, dz = k.z - z, R = rad + 1.0;
    const d2 = dx * dx + dz * dz;
    if (d2 > R * R || k.y > (k.q.y || 0) + 2.2) return false; // flying over it
    const d = Math.sqrt(d2) || 0.01, nx = dx / d, nz = dz / d;
    k.x += nx * (R - d);
    k.z += nz * (R - d);
    const vn = k.vx * nx + k.vz * nz;
    if (vn < 0) {
      // bounce off what you hit; a glancing scrape keeps most of your speed
      k.vx -= nx * vn * 1.4;
      k.vz -= nz * vn * 1.4;
      const loss = Math.min(0.45, -vn * 0.035);
      k.vx *= 1 - loss;
      k.vz *= 1 - loss;
    }
    if (!moving && vn < -3) ev(r, 'bump', k, { v: -vn });
    return true;
  }

  function moverPos(r, m) {
    if (m.at === r.time) return;
    m.at = r.time;
    const f = (((r.time + m.phase) / m.period) % 1 + 1) % 1;
    const tri = f < 0.5 ? f * 2 : 2 - f * 2;
    const e = tri * tri * (3 - 2 * tri);
    m.x = m.ax + (m.bx - m.ax) * e;
    m.z = m.az + (m.bz - m.az) * e;
  }

  // ------------------------------------------------------------------ laps and places

  function progress(r, k) {
    const L = r.trk.L;
    let dd = k.q.prog - k.lastProg;
    if (dd > L / 2) dd -= L;
    if (dd < -L / 2) dd += L;
    k.lastProg = k.q.prog;
    k.prog = k.q.prog;
    if (r.phase === 'countdown') return;
    k.dist += dd;
    if (k.finished) return;
    const lap = Math.floor(k.dist / L) + 1;
    if (lap > k.lap) {
      k.lap = lap;
      k.lapTimes.push(r.time - k.lapStart);
      k.lapStart = r.time;
      if (lap <= r.laps) ev(r, 'lap', k, { lap, final: lap === r.laps });
    }
    if (k.dist >= r.laps * L) {
      k.finished = true;
      k.finishT = r.time;
      k.drift = 0;
      if (k.human >= 0) k.auto = true;
      ev(r, 'finish', k, { place: r.karts.filter((o) => o.finished).length });
    }
    // stuck or lost? (a human only counts while pressing the gas)
    const trying = k.human < 0 || k.auto || k.gasIn || k.boostT > 0;
    if (k.dist > k.bestD + 2) {
      k.bestD = k.dist;
      k.stuckT = 0;
    } else if (trying && k.spinT <= 0 && k.floatT <= 0) k.stuckT += DT;
    if (k.q.excess > 0.5) k.offT += DT;
    else k.offT = 0;
    r.stat.maxOff = Math.max(r.stat.maxOff, k.q.excess > 0 ? k.q.excess : 0);
    if (k.stuckT > 7) rescue(r, k, 'stuck');
    else if (k.offT > 1.5) rescue(r, k, 'off');
    // going the wrong way (shown to kids)
    const ta = Math.atan2(k.q.tz, k.q.tx);
    if (Math.abs(wrapA(ta - k.h)) > 2.1 && Math.abs(k.speed) > 2) k.wrongT += DT;
    else k.wrongT = 0;
  }

  // a friendly balloon lifts a lost kart back onto the road
  function rescue(r, k, why) {
    r.stat.rescues++;
    if (r.stat.rescueWhy.length < 8) r.stat.rescueWhy.push(`${k.ch} ${why} at ${r.time.toFixed(1)}s lap ${k.lap} prog ${(k.prog || 0).toFixed(0)}`);
    k.rescues++;
    const back = Math.max(0, k.bestD - 6);
    const p = G.pointAt(r.trk, 0, ((back % r.trk.L) + r.trk.L) % r.trk.L);
    k.x = p.x;
    k.z = p.z;
    k.y = p.y + 0.5;
    k.h = Math.atan2(p.tz, p.tx);
    k.vx = k.vz = k.vy = 0;
    k.air = true;
    k.spinT = k.floatT = 0;
    k.drift = 0;
    k.stuckT = k.offT = 0;
    k.invT = 2;
    k.path = 0;
    G.query(r.trk, k.x, k.z, 0, k.q);
    k.lastProg = k.q.prog;
    ev(r, 'rescue', k, { why });
  }

  function rank(r) {
    const order = r.karts.slice().sort((a, b) => (a.finished !== b.finished ? (a.finished ? -1 : 1) : a.finished ? a.finishT - b.finishT : b.dist - a.dist));
    order.forEach((k, i) => (k.place = i + 1));
    r.order = order;
    // catch-up help for kids behind, and CPUs that wait up (or hurry up) for the kids
    const lead = order[0].dist;
    const hs = r.humans.filter((k) => !k.finished);
    const hBest = hs.length ? Math.max(...hs.map((k) => k.dist)) : null, hWorst = hs.length ? Math.min(...hs.map((k) => k.dist)) : null;
    for (const k of r.karts) {
      if (k.human >= 0) k.cu = 1 + r.L.catchup * clamp((lead - k.dist) / 120, 0, 1);
      else if (hBest !== null && !r.test.botHumans) {
        const ahead = k.dist - hBest, behind = hWorst - k.dist;
        k.cu = 1 - r.L.rubberDown * clamp((ahead - 15) / 120, 0, 1) + r.L.rubberUp * clamp((behind - r.L.rubberGap) / 70, 0, 1);
      } else k.cu = 1;
    }
  }

  // ------------------------------------------------------------------ items

  // what comes out of a box depends on your place: the leader gets defence, the back of the pack gets speed
  function rollItem(r, k) {
    const n = r.karts.length, f = n > 1 ? (k.place - 1) / (n - 1) : 0.5;
    const w = {
      banana: 40 - 30 * f,
      shield: 26 - 14 * f,
      bubble: 12 + 10 * f,
      ball: 10 + 26 * f,
      cookie: 4 + 40 * f,
    };
    if (k.human >= 0 && r.cfg.level === 'easy') w.cookie += 12;
    if (k.human < 0 && r.L.cpuAim < 1) {
      w.ball *= r.L.cpuAim;
      w.bubble *= r.L.cpuAim;
    }
    let tot = 0;
    for (const key of ITEMS) tot += w[key];
    let x = r.rand() * tot;
    for (const key of ITEMS) if ((x -= w[key]) <= 0) return key;
    return 'banana';
  }

  function useItem(r, k) {
    if (!k.item || k.roll > 0) return false;
    const it = k.item;
    if (r.cfg.mode === 'tt') {
      if (--k.cookies <= 0) k.item = null;
    } else k.item = null;
    k.stats.items++;
    r.stat.items++;
    const fx = Math.cos(k.h), fz = Math.sin(k.h);
    if (it === 'banana') {
      const x = k.x - fx * 2.6, z = k.z - fz * 2.6;
      const q = G.query(r.trk, x, z, k.path, {});
      const y = q.path >= 0 ? G.ground(r.trk, q).y : k.y;
      r.items.push({ kind: 'banana', x, z, y, owner: k.idx, t: 0, path: q.path, prog: q.prog, lat: q.lat });
      const bananas = r.items.filter((o) => o.kind === 'banana');
      if (bananas.length > 14) bananas[0].dead = true;
    } else if (it === 'ball' || it === 'bubble') {
      const ahead = it === 'ball' ? r.order[k.place - 2] : null;
      const sp = it === 'ball' ? 36 : 27;
      r.items.push({
        kind: it, x: k.x + fx * 2.4, z: k.z + fz * 2.4, y: k.y + 0.8, vx: fx * sp, vz: fz * sp, sp, owner: k.idx, t: 0,
        life: it === 'ball' ? 7 : 3.2, target: ahead ? ahead.idx : -1, path: k.path, q: { path: k.path },
      });
    } else if (it === 'shield') {
      k.shieldT = 9;
    } else if (it === 'cookie') {
      k.boostT = Math.max(k.boostT, 1.7);
    }
    ev(r, 'use', k, { item: it });
    return true;
  }

  function updateItems(r) {
    for (const o of r.items) {
      if (o.dead) continue;
      o.t += DT;
      if (o.kind === 'banana') {
        for (const k of r.karts) {
          if (o.t < 0.3 && k.idx === o.owner) continue;
          const dx = k.x - o.x, dz = k.z - o.z;
          if (dx * dx + dz * dz < 1.6 * 1.6 && Math.abs(k.y - o.y) < 1.4 && k.floatT <= 0) {
            o.dead = true;
            hit(r, k, 'spin', o, 'banana');
            break;
          }
        }
        continue;
      }
      // the basketball bounces after the kart ahead; the bubble floats straight down the road
      if (o.t > o.life) {
        o.dead = true;
        ev(r, 'fizz', null, { kind: o.kind, x: o.x, z: o.z });
        continue;
      }
      const tgt = o.target >= 0 ? r.karts[o.target] : null;
      let ax, az;
      if (tgt && !tgt.finished && Math.hypot(tgt.x - o.x, tgt.z - o.z) < 26) {
        ax = tgt.x;
        az = tgt.z;
      } else {
        G.query(r.trk, o.x, o.z, o.path, o.q);
        if (o.q.path >= 0) {
          o.path = o.q.path;
          const w = G.walk(r.trk, o.q.path, o.q.s, 14, tgt && tgt.path > 0 ? tgt.path : 0);
          const p = G.pointAt(r.trk, w.path, w.s);
          const lat = o.kind === 'bubble' ? clamp(o.q.lat, -p.hw + 2, p.hw - 2) : 0;
          ax = p.x - p.tz * lat;
          az = p.z + p.tx * lat;
        } else {
          ax = o.x + o.vx;
          az = o.z + o.vz;
        }
      }
      const want = Math.atan2(az - o.z, ax - o.x), cur = Math.atan2(o.vz, o.vx);
      const turn = clamp(wrapA(want - cur), -7 * DT, 7 * DT);
      o.vx = Math.cos(cur + turn) * o.sp;
      o.vz = Math.sin(cur + turn) * o.sp;
      o.x += o.vx * DT;
      o.z += o.vz * DT;
      G.query(r.trk, o.x, o.z, o.path, o.q);
      if (o.q.path < 0) {
        o.dead = true;
        continue;
      }
      if (o.q.excess > -0.5) {
        const nx = (o.q.cx - o.x) / (o.q.dist || 1), nz = (o.q.cz - o.z) / (o.q.dist || 1);
        o.x += nx * (o.q.excess + 0.5);
        o.z += nz * (o.q.excess + 0.5);
      }
      const gy = G.ground(r.trk, o.q).y;
      o.y = o.kind === 'ball' ? gy + 0.55 + Math.abs(Math.sin(o.t * 8)) * 1.6 : gy + 1.2 + Math.sin(o.t * 5) * 0.25;
      for (const k of r.karts) {
        if (k.idx === o.owner && o.t < 0.8) continue;
        const dx = k.x - o.x, dz = k.z - o.z;
        if (dx * dx + dz * dz < (o.kind === 'ball' ? 2.0 : 2.3) ** 2 && Math.abs(k.y + 0.8 - o.y) < 2.4) {
          o.dead = true;
          hit(r, k, o.kind === 'ball' ? 'spin' : 'float', o, o.kind);
          break;
        }
      }
    }
    if (r.items.some((o) => o.dead)) r.items = r.items.filter((o) => !o.dead);
  }

  // A kart is hit: a shield or the visiting brother stops it; otherwise a dizzy spin, or a floaty bubble.
  function hit(r, k, kind, src, what) {
    if (k.invT > 0 || k.floatT > 0) return false;
    if (k.shieldT > 0) {
      k.shieldT = 0;
      k.invT = 1;
      ev(r, 'blocked', k, { what });
      return false;
    }
    const b = k.buddy;
    if (b.on && b.phase !== 'leave') {
      b.saves++;
      k.stats.saves++;
      r.stat.saves++;
      b.phase = 'leave';
      b.t = 0;
      k.invT = 1.2;
      ev(r, 'saved', k, { what });
      return false;
    }
    k.stats.hits++;
    r.stat.hits++;
    k.drift = 0;
    k.driftLv = 0;
    k.trick = false;
    if (kind === 'float') {
      k.floatT = 1.7;
      k.invT = 2.6;
      k.air = false;
      ev(r, 'float', k, { what, by: src ? src.owner : -1 });
    } else {
      const t = k.human >= 0 ? r.L.spin : LEVELS.normal.spin;
      k.spinT = t;
      k.invT = t + 1;
      ev(r, 'spin', k, { what, by: src ? src.owner : -1 });
    }
    return true;
  }

  // ------------------------------------------------------------------ the companion

  // Call the other brother: he drives up in his mini kart, tows you (a boost), does his move, throws you a treat, and
  // blocks the next hit while he's there. Call as often as you like; calling while he's there keeps him longer.
  function callBuddy(r, k) {
    const b = k.buddy;
    b.calls++;
    if (!b.on || b.phase === 'leave') {
      b.on = true;
      b.phase = 'arrive';
      b.t = 0;
      b.left = r.L.visit;
      ev(r, 'buddyCall', k);
    } else {
      b.left = r.L.visit;
      b.sigT = 1.8;
      ev(r, 'buddyAgain', k);
    }
  }

  function updateBuddy(r, k) {
    const b = k.buddy;
    b.sigT -= DT;
    if (!b.on) return;
    b.t += DT;
    if (b.phase === 'arrive' && b.t >= 1.0) {
      b.phase = 'ride';
      b.t = 0;
      b.sigT = 1.8;
      if (r.time - b.lastTow > 6 || b.lastTow < 0) {
        k.boostT = Math.max(k.boostT, 1.6);
        b.lastTow = r.time;
        ev(r, 'tow', k);
      }
      b.treatAt = r.time + 1.1;
      b.treat = TREATS[Math.floor(r.rand() * TREATS.length)];
    }
    if (b.treatAt && r.time >= b.treatAt && b.phase === 'ride') {
      b.treatAt = 0;
      k.boostT = Math.max(k.boostT, 0.45);
      ev(r, 'treat', k, { treat: b.treat });
    }
    if (b.phase === 'ride' && r.phase !== 'countdown') {
      b.left -= DT;
      if (b.left <= 0) {
        b.phase = 'leave';
        b.t = 0;
        ev(r, 'buddyBye', k);
      }
    }
    if (b.phase === 'leave' && b.t >= 1.3) {
      b.on = false;
      b.phase = 'off';
    }
  }

  // ------------------------------------------------------------------ karts bumping karts

  function collide(r) {
    const ks = r.karts, D = KART_R * 2;
    for (let i = 0; i < ks.length; i++) {
      for (let j = i + 1; j < ks.length; j++) {
        const a = ks[i], b = ks[j];
        const dx = b.x - a.x, dz = b.z - a.z;
        const d2 = dx * dx + dz * dz;
        if (d2 > D * D || Math.abs(a.y - b.y) > 1.6) continue;
        const d = Math.sqrt(d2) || 0.01, nx = dx / d, nz = dz / d, push = (D - d) / 2;
        a.x -= nx * push;
        a.z -= nz * push;
        b.x += nx * push;
        b.z += nz * push;
        const rv = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
        if (rv < 0) {
          const imp = -rv * 0.55;
          a.vx -= nx * imp;
          a.vz -= nz * imp;
          b.vx += nx * imp;
          b.vz += nz * imp;
          if (-rv > 4 && (a.human >= 0 || b.human >= 0)) ev(r, 'bonk', a.human >= 0 ? a : b, { v: -rv });
        }
      }
    }
  }

  // ------------------------------------------------------------------ results

  // Final places: finishers by time, the rest by how far they got (with a guessed time).
  function standings(r) {
    return r.order.map((k, i) => {
      let time = k.finishT;
      if (!k.finished) {
        const left = r.laps * r.trk.L - k.dist;
        time = Math.max(r.time, r.time + left / Math.max(10, k.vmaxBase * 0.85)) + i * 0.01;
      }
      const best = k.lapTimes.length ? Math.min(...k.lapTimes) : null;
      return { idx: k.idx, ch: k.ch, human: k.human, place: i + 1, time, finished: k.finished, best, stats: k.stats };
    });
  }

  K.sim = { DT, COUNT, LEVELS, ITEMS, TREATS, createRace, step, standings, callBuddy, hit, useItem, rescue, util: { clamp, wrapA, rng } };
})(typeof window !== 'undefined' ? window : globalThis);
