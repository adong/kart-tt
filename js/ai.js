/* TT Kart: the CPU drivers. They follow the road a little way ahead in their own lane, weave round bananas, posts,
   puddles and rolling things, steer into item boxes when they have nothing, sometimes take the shortcut, and use
   their items. The same steering keeps a 🐣 kid on the road (sim.js humanInput) and drives a kid's kart on its
   victory lap. KART.ai.think(race, kart) returns the same input a keyboard gives. */
(function (root) {
  'use strict';
  const K = (root.KART = root.KART || {});
  const G = K.geo;
  const DT = 1 / 60;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const tA = {}, tB = {}, tC = {};

  // the point `la` metres ahead along the kart's route, `lane` metres right of the middle
  function aim(r, k, la, lane, out) {
    let path = k.path, s = k.q.s || 0;
    if (path === 0 && k.ai.take) {
      // just past the fork, still on the main road's map: follow the shortcut from where we are along it
      const B = r.trk.paths[k.ai.take];
      const past = ((s - B.fromS) % r.trk.L + r.trk.L) % r.trk.L;
      if (past < 45) {
        path = k.ai.take;
        s = G.nearestOn(r.trk, path, k.x, k.z);
      }
    }
    const w = G.walk(r.trk, path, s, la, path === 0 ? k.ai.take : 0);
    const p = G.pointAt(r.trk, w.path, w.s, out);
    const edge = p.hw + r.trk.paths[w.path].verge * 0.5 - 1.4; // a dodge may use a little of the grass
    const l = r.test.wander ? 22 : clamp(lane, -edge, edge); // (wander: a sabotage for the soak, aiming off the road)
    p.ax = p.x - p.tz * l;
    p.az = p.z + p.tx * l;
    return p;
  }

  function steerTo(r, k, lane) {
    const p = aim(r, k, 7 + Math.max(0, k.speed) * 0.45, lane, tA);
    return clamp(wrapA(Math.atan2(p.az - k.z, p.ax - k.x) - k.h) * 2.4, -1, 1);
  }

  // how far ahead (metres along the lap) something at progress `prog` is
  const ahead = (r, k, prog) => (((prog - k.prog) % r.trk.L) + r.trk.L) % r.trk.L;

  // shift a lane sideways round anything in the way ahead: posts, puddles, bananas, rolling things. The side is
  // chosen while the thing is still far off (the side with room, the grass beside the road counts), then kept.
  function clearLane(r, k, lane0) {
    const trk = r.trk, ai = k.ai;
    const hw = k.q.hw || 8, edge = hw + (k.q.verge || 0) * 0.5 - 1.4;
    let lane = lane0;
    const dodge = (prog, lat, rad, path) => {
      if (path && path !== k.path && path !== ai.take) return;
      let d = ahead(r, k, prog);
      if (d > r.trk.L - 4) d -= r.trk.L; // still alongside it
      if (d < -4 || d > 34) return;
      const off = (k.q.lat || 0) - lat;
      const room = (sd) => edge - sd * lat - rad - 1.2;
      let side;
      if (d > 16) {
        side = Math.sign(lane - lat) || Math.sign(off) || 1;
        if (room(side) < 1.5 && room(-side) > room(side)) side = -side;
      } else side = Math.sign(off) || Math.sign(lane - lat) || 1;
      if (Math.abs(lat - lane) < rad + 2.3 || d < 16) lane = lat + side * Math.max(side * (lane - lat), rad + 2.6);
    };
    for (const p of trk.posts) dodge(p.prog, p.lat, p.r, p.path);
    for (const z of trk.zones) if (z.kind === 'slow') dodge(z.prog, z.lat, z.r * 0.8, z.path);
    for (const o of r.items) if (o.kind === 'banana' && o.prog !== undefined) dodge(o.prog, o.lat, 1, o.path);
    for (const m of trk.movers) {
      const cx = (m.ax + m.bx) / 2, cz = (m.az + m.bz) / 2;
      dodge(m.prog, (m.x - cx) * -m.tz + (m.z - cz) * m.tx, m.r + 0.5, m.path);
    }
    return clamp(lane, -edge, edge);
  }

  function think(r, k) {
    const ai = k.ai, L = r.L, trk = r.trk;
    const inp = { steer: 0, gas: true, brake: false, hop: false, item: false, call: false };
    if (!k.q || k.q.path < 0) return inp;
    const cpu = k.human < 0;

    // the shortcut: decide once a lap as its entrance comes up
    if (k.path === 0 && trk.paths.length > 1) {
      const B = trk.paths[1];
      const d = ((B.fromS - k.q.s) % trk.L + trk.L) % trk.L;
      if (d < 90 && d > 12 && ai.decided !== k.lap) {
        ai.decided = k.lap;
        ai.take = cpu && !r.test.noShortcut && r.rand() < L.cpuShortcut ? 1 : 0;
      }
    }

    // wander between lanes now and then
    ai.laneT -= DT;
    if (ai.laneT <= 0) {
      ai.laneT = 2.5 + r.rand() * 3.5;
      ai.laneGoal = (r.rand() - 0.5) * 8;
    }
    ai.lane += clamp((ai.laneGoal || 0) - ai.lane, -3 * DT, 3 * DT);
    let lane = cpu ? ai.lane : 0;

    // nothing in hand: steer for an item box coming up
    if (cpu && !k.item && k.roll <= 0) {
      let best = null, bd = 1e9;
      for (const b of r.boxes) {
        if (b.wait > 0 || (b.path > 0 && b.path !== k.path && b.path !== ai.take)) continue;
        const d = ahead(r, k, b.prog);
        if (d < 8 || d > 45) continue;
        const cost = Math.abs(b.lat - lane) + d * 0.05;
        if (cost < bd) { bd = cost; best = b; }
      }
      if (best) lane = best.lat;
    }

    lane = clearLane(r, k, lane);
    inp.steer = steerTo(r, k, lane);

    // ease off for sharp bends
    const p1 = aim(r, k, 4, 0, tB), p2 = aim(r, k, 18 + Math.max(0, k.speed) * 0.7, 0, tC);
    const bend = Math.abs(wrapA(Math.atan2(p2.tz, p2.tx) - Math.atan2(p1.tz, p1.tx)));
    if (bend > 1.3 && k.speed > 17) inp.gas = false;
    if (bend > 1.9 && k.speed > 14) inp.brake = true;

    // stuck against something: back up and turn
    if (Math.abs(k.speed) < 1.5 && !k.air && k.spinT <= 0 && k.floatT <= 0 && r.phase !== 'countdown') ai.stuckT += DT;
    else ai.stuckT = Math.max(0, ai.stuckT - DT * 2);
    if (ai.stuckT > 1.2) {
      ai.backT = 1;
      ai.stuckT = 0;
    }
    if (ai.backT > 0) {
      ai.backT -= DT;
      inp.gas = false;
      inp.brake = true;
      inp.steer = -inp.steer;
    }

    // items
    if (cpu && k.item && k.roll <= 0 && r.cfg.mode !== 'tt') {
      ai.itemT += DT;
      const wait = L.cpuItemWait;
      const behind = r.order[k.place], front = r.order[k.place - 2];
      let use = false;
      if (k.item === 'banana') use = (behind && k.dist - behind.dist < 18 && ai.itemT > 0.6) || ai.itemT > wait + 5;
      else if (k.item === 'ball') use = ai.itemT > wait && (!!front || ai.itemT > wait + 6);
      else if (k.item === 'bubble') use = (ai.itemT > wait && front && front.dist - k.dist < 45) || ai.itemT > wait + 7;
      else if (k.item === 'shield') use = ai.itemT > wait + 1;
      else if (k.item === 'cookie') use = ai.itemT > wait && bend < 0.5;
      inp.item = use && !r.test.noItems;
    }
    return inp;
  }

  K.ai = { think, steerTo, aim, clearLane };
})(typeof window !== 'undefined' ? window : globalThis);
