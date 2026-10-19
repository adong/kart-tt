/* TT Kart: track geometry. Pure maths, no Three.js, so the headless soak (node tools/soak.js) builds the very same
   tracks the page draws.
   A track is a closed main loop plus optional shortcut branches, each a smooth (centripetal Catmull-Rom) curve through
   control points, resampled every SP metres. Every path is a corridor: the road (half-width hw) and the grass or sand
   beside it (verge), with a wall at the edge. A kart may be anywhere inside the union of the corridors, so a shortcut
   simply opens a gap in the main wall.
   Conventions: x and z are the ground, y is up. A direction (tx, tz) has its right-hand side at (-tz, tx); lateral
   offsets (lat) are positive to the right. Progress (prog) is measured along the main loop, so a shortcut maps its
   own length onto the stretch of main loop it skips. */
(function (root) {
  'use strict';
  const K = (root.KART = root.KART || {});
  const SP = 2;
  const CELL = 12;

  // ------------------------------------------------------------------ curves

  // Centripetal Catmull-Rom between p1 and p2 (u in 0..1). Points are [x, z, y, hw]; knots use the x/z distance.
  function cr(p0, p1, p2, p3, u) {
    const kn = (a, b) => Math.pow(Math.hypot(b[0] - a[0], b[1] - a[1]) || 1e-4, 0.5);
    const t0 = 0, t1 = t0 + kn(p0, p1), t2 = t1 + kn(p1, p2), t3 = t2 + kn(p2, p3);
    const t = t1 + (t2 - t1) * u;
    const out = [];
    for (let c = 0; c < 4; c++) {
      const a1 = ((t1 - t) * p0[c] + (t - t0) * p1[c]) / (t1 - t0);
      const a2 = ((t2 - t) * p1[c] + (t - t1) * p2[c]) / (t2 - t1);
      const a3 = ((t3 - t) * p2[c] + (t - t2) * p3[c]) / (t3 - t2);
      const b1 = ((t2 - t) * a1 + (t - t0) * a2) / (t2 - t0);
      const b2 = ((t3 - t) * a2 + (t - t1) * a3) / (t3 - t1);
      out.push(((t2 - t) * b1 + (t - t1) * b2) / (t2 - t1));
    }
    return out;
  }

  // A dense polyline through the control points (closed: back to the first one).
  function densify(ctrl, closed) {
    const n = ctrl.length;
    const at = (i) => (closed ? ctrl[(i + n) % n] : ctrl[Math.max(0, Math.min(n - 1, i))]);
    const out = [];
    const segs = closed ? n : n - 1;
    for (let i = 0; i < segs; i++) {
      for (let k = 0; k < 40; k++) out.push(cr(at(i - 1), at(i), at(i + 1), at(i + 2), k / 40));
    }
    if (!closed) out.push(ctrl[n - 1].slice());
    return out;
  }

  // Resample a polyline every ~SP metres into a path.
  function resample(poly, closed) {
    const cum = [0];
    const m = poly.length;
    const segN = closed ? m : m - 1;
    for (let i = 0; i < segN; i++) {
      const a = poly[i], b = poly[(i + 1) % m];
      cum.push(cum[i] + Math.hypot(b[0] - a[0], b[1] - a[1]));
    }
    const len = cum[segN];
    const n = closed ? Math.round(len / SP) : Math.round(len / SP) + 1;
    const step = closed ? len / n : len / (n - 1);
    const P = { n, len, closed, step, x: [], z: [], y: [], hw: [], tx: [], tz: [], s: [], prog: [] };
    let j = 0;
    for (let i = 0; i < n; i++) {
      const s = Math.min(len, i * step);
      while (j < segN - 1 && cum[j + 1] < s) j++;
      const a = poly[j], b = poly[(j + 1) % m];
      const f = (s - cum[j]) / Math.max(1e-6, cum[j + 1] - cum[j]);
      P.x.push(a[0] + (b[0] - a[0]) * f);
      P.z.push(a[1] + (b[1] - a[1]) * f);
      P.y.push(a[2] + (b[2] - a[2]) * f);
      P.hw.push(a[3] + (b[3] - a[3]) * f);
      P.s.push(s);
    }
    for (let i = 0; i < n; i++) {
      const i0 = closed ? (i - 1 + n) % n : Math.max(0, i - 1);
      const i1 = closed ? (i + 1) % n : Math.min(n - 1, i + 1);
      const dx = P.x[i1] - P.x[i0], dz = P.z[i1] - P.z[i0];
      const d = Math.hypot(dx, dz) || 1;
      P.tx.push(dx / d);
      P.tz.push(dz / d);
    }
    return P;
  }

  // ------------------------------------------------------------------ turtle tracks

  // Turn drive instructions into control points: a number drives straight, [r, deg] turns on a circle of radius r
  // (deg > 0 right, < 0 left); { y } sets the height at the end of the instruction. The loop must turn a full 360;
  // whatever small gap is left between the end and the start is spread evenly along the lap.
  function turtle(cmds, start, heading, fit) {
    // fit: two straights (instruction numbers) whose lengths are adjusted so the loop closes exactly
    if (fit) {
      const first = turtle(cmds, start, heading);
      const [i, j] = fit, a1 = first.heads[i], a2 = first.heads[j];
      const ex = -first.ex, ez = -first.ez;
      const det = Math.cos(a1) * Math.sin(a2) - Math.sin(a1) * Math.cos(a2);
      const al = (ex * Math.sin(a2) - ez * Math.cos(a2)) / det, be = (Math.cos(a1) * ez - Math.sin(a1) * ex) / det;
      const c2 = cmds.slice();
      const len = (c) => (typeof c === 'number' ? c : c.s);
      const set = (k, v) => { c2[k] = typeof cmds[k] === 'number' ? v : Object.assign({}, cmds[k], { s: v }); };
      set(i, len(cmds[i]) + al);
      set(j, len(cmds[j]) + be);
      const out = turtle(c2, start, heading);
      out.fitted = [len(c2[i]), len(c2[j])];
      return out;
    }
    let x = start ? start[0] : 0, z = start ? start[1] : 0, a = ((heading || 0) * Math.PI) / 180, y = 0;
    const pts = [[x, z, y]];
    const ends = [], heads = [];
    for (const c0 of cmds) {
      heads.push(a);
      const c = typeof c0 === 'number' ? { s: c0 } : Array.isArray(c0) ? { r: c0[0], d: c0[1], y: c0[2] } : c0;
      const y0 = y, y1 = c.y !== undefined ? c.y : y;
      if (c.s !== undefined) {
        const n = Math.max(1, Math.round(c.s / 14));
        for (let k = 1; k <= n; k++) {
          const f = c.s / n;
          x += Math.cos(a) * f;
          z += Math.sin(a) * f;
          pts.push([x, z, y0 + ((y1 - y0) * k) / n]);
        }
      } else {
        const sgn = Math.sign(c.d), tot = (Math.abs(c.d) * Math.PI) / 180;
        const n = Math.max(2, Math.round((tot * c.r) / 12));
        const cx = x - Math.sin(a) * c.r * sgn, cz = z + Math.cos(a) * c.r * sgn;
        for (let k = 1; k <= n; k++) {
          const b = a + (sgn * tot * k) / n;
          pts.push([cx + Math.sin(b) * c.r * sgn, cz - Math.cos(b) * c.r * sgn, y0 + ((y1 - y0) * k) / n]);
        }
        a += sgn * tot;
        x = pts[pts.length - 1][0];
        z = pts[pts.length - 1][1];
      }
      y = y1;
      ends.push(pts.length - 1);
    }
    // close the loop: spread the gap along the way, then drop the duplicate end point
    const end = pts[pts.length - 1];
    const ex = end[0] - pts[0][0], ez = end[1] - pts[0][1], ey = end[2] - pts[0][2];
    let L = 0;
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push((L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])));
    const out = pts.map((p, i) => [p[0] - (ex * cum[i]) / L, p[1] - (ez * cum[i]) / L, p[2] - (ey * cum[i]) / L]);
    out.pop();
    out.gap = Math.hypot(ex, ez);
    out.ex = ex;
    out.ez = ez;
    out.heads = heads;
    out.marks = ends.map((i) => cum[i] / L); // where each instruction ends, as a fraction of the lap
    return out;
  }

  // ------------------------------------------------------------------ building a track

  function build(def) {
    const hw0 = def.hw || 8;
    if (!def.pts) def.pts = turtle(def.drive, def.start, def.heading, def.fit);
    // positions may be given as [instruction, fraction through it] on turtle tracks
    const marks = def.pts.marks;
    const at = (v) => (Array.isArray(v) ? (v[0] ? marks[v[0] - 1] : 0) + v[1] * (marks[v[0]] - (v[0] ? marks[v[0] - 1] : 0)) : v);
    const ctrl = def.pts.map((p) => [p[0], p[1], p[2] || 0, p[3] || hw0]);
    const main = resample(densify(ctrl, true), true);
    main.id = 0;
    main.verge = def.verge !== undefined ? def.verge : 6;
    main.surface = 'road';
    for (let i = 0; i < main.n; i++) main.prog.push(main.s[i]);
    const trk = { def, id: def.id, paths: [main], L: main.len, grid: new Map(), ramps: [], pads: [], zones: [], posts: [], movers: [], boxRows: [] };

    // shortcuts: from / to are fractions of the main loop; via are the control points in between
    (def.branches || []).forEach((b, bi) => {
      const fromS = at(b.from) * main.len, toS = at(b.to) * main.len;
      const A = pointAt(trk, 0, fromS), A0 = pointAt(trk, 0, fromS - 10);
      const B = pointAt(trk, 0, toS), B1 = pointAt(trk, 0, toS + 10);
      const bw = b.hw || 4.5;
      // no via points: a straight cut, bowed sideways by `bow` metres (to the right; negative bows left)
      const via = b.via || [1 / 3, 2 / 3].map((f) => {
        const bow = (b.bow || 0) * Math.sin(f * Math.PI), dx = B.x - A.x, dz = B.z - A.z, d = Math.hypot(dx, dz) || 1;
        return [A.x + dx * f - (dz / d) * bow, A.z + dz * f + (dx / d) * bow, A.y + (B.y - A.y) * f];
      });
      const c = [[A0.x, A0.z, A0.y, bw], [A.x, A.z, A.y, bw], ...via.map((p) => [p[0], p[1], p[2] !== undefined ? p[2] : A.y, bw]), [B.x, B.z, B.y, bw], [B1.x, B1.z, B1.y, bw]];
      const poly = densify(c, false);
      // keep only the part between A and B (drop the lead-in and lead-out)
      const n = c.length;
      const P = resample(poly.slice(40, (n - 2) * 40 + 1), false);
      P.id = bi + 1;
      P.verge = b.verge !== undefined ? b.verge : 1.5;
      P.surface = b.surface || 'dirt';
      P.fromS = fromS;
      P.toS = toS;
      P.name = b.name || 'shortcut';
      const span = ((toS - fromS) % main.len + main.len) % main.len;
      for (let i = 0; i < P.n; i++) P.prog.push((fromS + span * (P.s[i] / P.len)) % main.len);
      trk.paths.push(P);
    });

    // the spatial grid: every segment goes into each cell its corridor touches
    for (const P of trk.paths) {
      const segN = P.closed ? P.n : P.n - 1;
      for (let i = 0; i < segN; i++) {
        const j = (i + 1) % P.n;
        const pad = Math.max(P.hw[i], P.hw[j]) + P.verge + 2;
        const x0 = Math.floor((Math.min(P.x[i], P.x[j]) - pad) / CELL), x1 = Math.floor((Math.max(P.x[i], P.x[j]) + pad) / CELL);
        const z0 = Math.floor((Math.min(P.z[i], P.z[j]) - pad) / CELL), z1 = Math.floor((Math.max(P.z[i], P.z[j]) + pad) / CELL);
        for (let cx = x0; cx <= x1; cx++) {
          for (let cz = z0; cz <= z1; cz++) {
            const key = (cx + 5000) * 10000 + (cz + 5000);
            let l = trk.grid.get(key);
            if (!l) trk.grid.set(key, (l = []));
            l.push(P.id * 100000 + i);
          }
        }
      }
    }

    // features, placed by fraction along a path (path 0 = the main loop) and lateral offset
    const place = (f) => {
      const P = trk.paths[f.path || 0];
      const s = f.s !== undefined ? f.s : at(f.at) * P.len;
      const p = pointAt(trk, P.id, s);
      const lat = f.lat || 0;
      return { path: P.id, s, lat, x: p.x - p.tz * lat, z: p.z + p.tx * lat, y: p.y, tx: p.tx, tz: p.tz, hw: p.hw, prog: p.prog };
    };
    for (const r of def.ramps || []) {
      const p = place(r);
      const P = trk.paths[p.path];
      const w = r.w || P.hw[0] * 2 + 2;
      trk.ramps.push({ path: p.path, s0: p.s, s1: p.s + (r.len || 7), h: r.h || 1.5, lat0: (r.lat || 0) - w / 2, lat1: (r.lat || 0) + w / 2, kind: r.kind || 'ramp', art: r.art, x: p.x, z: p.z });
    }
    for (const b of def.pads || []) trk.pads.push(Object.assign(place(b), { art: b.art }));
    for (const z of def.zones || []) trk.zones.push(Object.assign(place(z), { kind: z.kind, r: z.r || 4, art: z.art }));
    for (const o of def.posts || []) trk.posts.push(Object.assign(place(o), { r: o.r || 1.2, art: o.art }));
    for (const o of def.movers || []) {
      const a = place(Object.assign({}, o, { lat: o.from })), b = place(Object.assign({}, o, { lat: o.to }));
      trk.movers.push({ path: a.path, s: a.s, prog: a.prog, ax: a.x, az: a.z, bx: b.x, bz: b.z, y: a.y, period: o.period || 5, phase: o.phase || 0, r: o.r || 1.6, art: o.art, x: a.x, z: a.z, tx: a.tx, tz: a.tz, from: o.from, to: o.to });
    }
    for (const row of def.boxes || []) {
      const r = typeof row === 'number' || Array.isArray(row) ? { at: row } : row;
      const P = trk.paths[r.path || 0];
      const hw = P.hw[Math.floor(((at(r.at) * P.len) / P.step)) % P.n];
      const n = r.n || (hw > 6 ? 5 : 3);
      const boxes = [];
      for (let k = 0; k < n; k++) boxes.push(place({ path: r.path, at: r.at, lat: (k - (n - 1) / 2) * Math.min(3.4, (hw * 1.6) / Math.max(1, n - 1)) }));
      trk.boxRows.push(boxes);
    }
    // the start grid: two columns, staggered, behind the line
    trk.grid0 = [];
    for (let i = 0; i < 8; i++) {
      const p = place({ s: main.len - 7 - i * 4.5, lat: (i % 2 ? 1 : -1) * Math.min(3.2, main.hw[0] * 0.4) });
      trk.grid0.push(p);
    }
    return trk;
  }

  // ------------------------------------------------------------------ lookups

  // The point at arc length s along a path (wraps on the main loop, clamps on a branch).
  function pointAt(trk, pid, s, out) {
    const P = trk.paths[pid];
    const o = out || {};
    let ss = s;
    if (P.closed) ss = ((ss % P.len) + P.len) % P.len;
    else ss = Math.max(0, Math.min(P.len, ss));
    const f = ss / P.step;
    let i = Math.floor(f);
    const u = f - i;
    if (P.closed) i %= P.n;
    else if (i >= P.n - 1) { i = P.n - 1; }
    const j = P.closed ? (i + 1) % P.n : Math.min(P.n - 1, i + 1);
    const lerp = (A) => A[i] + (A[j] - A[i]) * u;
    o.path = pid;
    o.s = ss;
    o.x = lerp(P.x);
    o.z = lerp(P.z);
    o.y = lerp(P.y);
    o.hw = lerp(P.hw);
    let tx = lerp(P.tx), tz = lerp(P.tz);
    const d = Math.hypot(tx, tz) || 1;
    o.tx = tx / d;
    o.tz = tz / d;
    o.prog = P.closed ? ss : (P.fromS + (((P.toS - P.fromS) % trk.L + trk.L) % trk.L) * (ss / P.len)) % trk.L;
    return o;
  }

  // Where is (x, z)? Picks the corridor the point is deepest inside (or least outside). pref: the path the kart was
  // on, which wins ties so a kart at a junction doesn't flicker between paths. out.excess > 0: beyond the wall.
  function query(trk, x, z, pref, out) {
    const o = out || {};
    const l = trk.grid.get((Math.floor(x / CELL) + 5000) * 10000 + (Math.floor(z / CELL) + 5000));
    let best = Infinity;
    o.path = -1;
    if (!l) return o;
    for (let k = 0; k < l.length; k++) {
      const code = l[k];
      const pid = (code / 100000) | 0, i = code - pid * 100000;
      const P = trk.paths[pid];
      const j = (i + 1) % P.n;
      const ax = P.x[i], az = P.z[i];
      const dx = P.x[j] - ax, dz = P.z[j] - az;
      const L2 = dx * dx + dz * dz || 1e-6;
      let t = ((x - ax) * dx + (z - az) * dz) / L2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const cx = ax + dx * t, cz = az + dz * t;
      const ex = x - cx, ez = z - cz;
      const dist = Math.sqrt(ex * ex + ez * ez);
      const hw = P.hw[i] + (P.hw[j] - P.hw[i]) * t;
      let excess = dist - hw - P.verge;
      // inside the road beats inside the grass, and the kart's own path wins a near-tie
      const score = Math.min(excess, dist - hw - (P.verge > 2 ? 2 : 0)) - (pid === pref ? 0.6 : 0);
      if (score < best) {
        best = score;
        const L = Math.sqrt(L2);
        const tx = dx / L, tz = dz / L;
        o.path = pid;
        o.i = i;
        o.t = t;
        o.s = P.s[i] + (P.closed && j === 0 ? P.len - P.s[i] : P.s[j] - P.s[i]) * t;
        o.prog = P.prog[i] + (((P.prog[j] - P.prog[i]) % trk.L + trk.L * 1.5) % trk.L - trk.L / 2) * t;
        if (o.prog < 0) o.prog += trk.L;
        if (o.prog >= trk.L) o.prog -= trk.L;
        o.lat = ex * -tz + ez * tx;
        o.dist = dist;
        o.hw = hw;
        o.verge = P.verge;
        o.excess = excess;
        o.cx = cx;
        o.cz = cz;
        o.y = P.y[i] + (P.y[j] - P.y[i]) * t;
        o.tx = tx;
        o.tz = tz;
        o.surface = Math.abs(o.lat) <= hw ? P.surface : 'verge';
      }
    }
    return o;
  }

  // The ground height under a query result: the road plus any ramp. Returns { y, ramp } in out.
  function ground(trk, q) {
    let y = q.y, ramp = null;
    for (const r of trk.ramps) {
      if (r.path !== q.path || q.s < r.s0 || q.s > r.s1 || q.lat < r.lat0 || q.lat > r.lat1) continue;
      const h = r.kind === 'bump' ? r.h * Math.sin(((q.s - r.s0) / (r.s1 - r.s0)) * Math.PI) : (r.h * (q.s - r.s0)) / (r.s1 - r.s0);
      if (h > y - q.y) {
        y = q.y + h;
        ramp = r;
      }
    }
    return { y, ramp };
  }

  // Walk `d` metres along the route from (path, s). On the main loop, `take` (a branch id) is followed if its entry
  // comes up; a branch rejoins the main loop at its end. Returns { path, s }.
  function walk(trk, path, s, d, take) {
    let p = path, ss = s, left = d;
    for (let guard = 0; guard < 4; guard++) {
      const P = trk.paths[p];
      if (P.closed) {
        if (take) {
          const B = trk.paths[take];
          const ahead = ((B.fromS - ss) % P.len + P.len) % P.len;
          if (ahead <= left && ahead < P.len / 2) {
            left -= ahead;
            p = take;
            ss = 0;
            take = 0;
            continue;
          }
        }
        return { path: p, s: (((ss + left) % P.len) + P.len) % P.len };
      }
      if (ss + left <= P.len) return { path: p, s: ss + left };
      left -= P.len - ss;
      p = 0;
      ss = P.toS;
    }
    return { path: p, s: ss };
  }

  // The arc length of the sample on one path nearest to (x, z) (a plain scan: for short shortcut paths).
  function nearestOn(trk, pid, x, z) {
    const P = trk.paths[pid];
    let best = Infinity, bi = 0;
    for (let i = 0; i < P.n; i++) {
      const d = (P.x[i] - x) ** 2 + (P.z[i] - z) ** 2;
      if (d < best) { best = d; bi = i; }
    }
    return P.s[bi];
  }

  K.geo = { build, nearestOn, turtle, pointAt, query, ground, walk, SP, CELL };
})(typeof window !== 'undefined' ? window : globalThis);
