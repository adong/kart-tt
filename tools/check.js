#!/usr/bin/env node
/* Checks the track data: lengths, tightest bends, slopes, and that no two far-apart stretches of road come close
   enough for a kart to hop from one to the other (their corridors must not touch, with room for the walls).
     node tools/check.js            the numbers and any problems
     node tools/check.js --map      plus a little map of each track (# road, = shortcut, S start)
     node tools/check.js --squeeze  proves the check can fail: every road 2.5 times as wide runs into the others */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = { console, Math, Number, JSON, Object, Array, Map, Set };
ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ['js/geo.js', 'js/tracks.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), ctx, { filename: f });
const K = ctx.KART;
const args = process.argv.slice(2);
if (args.includes('--squeeze')) for (const d of K.TRACKS) d.hw *= 2.5; // roads so wide they run into each other

let problems = 0;
const bad = (s) => { problems++; console.log('  PROBLEM: ' + s); };
for (const def of K.TRACKS) {
  const trk = K.geo.build(def);
  const M = trk.paths[0];
  // tightest bend: radius from the change of direction over 6 m
  let minR = Infinity, minRAt = 0, maxSlope = 0;
  for (let i = 0; i < M.n; i++) {
    const j = (i + 3) % M.n;
    const da = Math.abs(Math.atan2(M.tx[i] * M.tz[j] - M.tz[i] * M.tx[j], M.tx[i] * M.tx[j] + M.tz[i] * M.tz[j]));
    const r = (3 * M.step) / Math.max(1e-6, da);
    if (r < minR) { minR = r; minRAt = i / M.n; }
    const k = (i + 1) % M.n;
    maxSlope = Math.max(maxSlope, Math.abs(M.y[k] - M.y[i]) / M.step);
  }
  console.log(`${def.id}: loop ${M.len.toFixed(0)} m (closing gap ${(def.pts.gap || 0).toFixed(1)} m${def.pts.fitted ? ', fitted straights ' + def.pts.fitted.map((v) => v.toFixed(0)).join(' & ') : ''}), tightest bend r=${minR.toFixed(1)} m at ${minRAt.toFixed(2)}, steepest ${(maxSlope * 100).toFixed(0)}%`);
  if ((def.pts.gap || 0) > 3) bad(`the loop doesn't close (${def.pts.gap.toFixed(0)} m): adjust the drive or its fit`);
  if (def.pts.fitted && Math.min(...def.pts.fitted) < 8) bad(`a fitted straight came out too short (${def.pts.fitted.map((v) => v.toFixed(0))})`);
  if (minR < 16) bad(`bend too tight (r ${minR.toFixed(1)} m < 16) at ${minRAt.toFixed(2)}`);
  if (maxSlope > 0.2) bad(`slope too steep ${(maxSlope * 100).toFixed(0)}%`);
  for (const P of trk.paths.slice(1)) {
    const span = ((P.toS - P.fromS) % M.len + M.len) % M.len;
    console.log(`  shortcut ${P.id} (${P.name}): ${P.len.toFixed(0)} m instead of ${span.toFixed(0)} m`);
    if (P.len > span) bad(`shortcut ${P.id} is longer than the road it skips`);
  }
  // separation: any two samples whose corridors overlap must be close along the route (same stretch)
  const all = [];
  for (const P of trk.paths) for (let i = 0; i < P.n; i++) all.push({ P, i, x: P.x[i], z: P.z[i], y: P.y[i], r: P.hw[i] + P.verge, prog: P.prog[i], s: P.s[i] });
  const seen = new Set();
  for (let a = 0; a < all.length; a++) {
    for (let b = a + 1; b < all.length; b++) {
      const A = all[a], B = all[b];
      const d = Math.hypot(A.x - B.x, A.z - B.z);
      const need = A.r + B.r + 3;
      if (d >= need) continue;
      let gap;
      if (A.P === B.P) gap = A.P.closed ? Math.min(Math.abs(A.s - B.s), M.len - Math.abs(A.s - B.s)) : Math.abs(A.s - B.s);
      else {
        // a shortcut beside the stretch of loop it skips is fine (its walls just meet), as long as the two roads
        // don't touch; beside any other stretch it's a way to cheat
        const Q = A.P.closed ? B : A, Mn = A.P.closed ? A : B;
        if (Q.s < 25 || Q.s > Q.P.len - 25) continue;
        const inSpan = ((Mn.s - Q.P.fromS + 30) % M.len + M.len) % M.len <= ((Q.P.toS - Q.P.fromS) % M.len + M.len) % M.len + 60;
        if (inSpan) {
          const key = `road${Q.P.id}:${Math.round(Q.s / 40)}`;
          if (d < Q.P.hw[Q.i] + Mn.P.hw[Mn.i] + 1.5 && !seen.has(key)) { seen.add(key); bad(`shortcut ${Q.P.id} at ${Q.s.toFixed(0)} m runs into the road (${d.toFixed(1)} m)`); }
          continue;
        }
        gap = 999;
      }
      if (gap > need * 2.2 && gap > 45) {
        const key = `${A.P.id}:${Math.round(A.s / 40)}-${B.P.id}:${Math.round(B.s / 40)}`;
        if (!seen.has(key)) { seen.add(key); bad(`path ${A.P.id} at ${(A.s).toFixed(0)} m and path ${B.P.id} at ${B.s.toFixed(0)} m are ${d.toFixed(1)} m apart (need ${need.toFixed(0)})`); }
      }
    }
  }
  // features must sit on the road
  for (const r of trk.ramps) if (r.s1 > trk.paths[r.path].len) bad('ramp runs off the end of its path');
  if (args.includes('--map')) {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const o of all) { x0 = Math.min(x0, o.x); x1 = Math.max(x1, o.x); z0 = Math.min(z0, o.z); z1 = Math.max(z1, o.z); }
    const W = 90, sc = W / (x1 - x0 + 30), H = Math.ceil((z1 - z0 + 30) * sc * 0.5);
    const g = Array.from({ length: H + 1 }, () => Array(W + 1).fill(' '));
    const put = (x, z, ch) => { const c = Math.round((x - x0 + 15) * sc), r = Math.round((z - z0 + 15) * sc * 0.5); if (g[r] && c >= 0 && c <= W) g[r][c] = ch; };
    for (const o of all) put(o.x, o.z, o.P.closed ? '#' : '=');
    for (const r of trk.ramps) put(r.x, r.z, 'R');
    for (const p of trk.pads) put(p.x, p.z, '>');
    for (const row of trk.boxRows) put(row[0].x, row[0].z, '?');
    for (const m of trk.movers) put(m.x, m.z, 'M');
    put(M.x[0], M.z[0], 'S');
    put(M.x[6], M.z[6], '1');
    console.log(g.map((r) => '   ' + r.join('')).join('\n'));
  }
}
console.log(problems ? `${problems} problem(s)` : 'all tracks OK');
process.exitCode = problems ? 1 : 0;
