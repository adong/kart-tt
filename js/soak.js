/* TT Kart: the headless test runner. Races whole races with no drawing, as fast as the computer can, and checks that
   every kart finishes, nobody ever ends up beyond a wall, nobody gets stuck (the rescue balloon never has to come),
   and nothing turns into NaN. Also the test kids: bots that press "keys" through the same path the keyboard uses,
   with the 🐣 helpers on, to check a sloppy driver still gets round.
   In the browser console: game.soak(12). From a terminal: node tools/soak.js 24 */
(function (root) {
  'use strict';
  const K = root.KART;
  const S = K.sim;
  const CAST = ['teddy', 'tommy', 'zoom', 'luna', 'bolt', 'bruno', 'zombie'];

  // a test kid: 'kid' steers late and wobbly, mashes buttons and calls his brother; 'good' drives like a CPU
  function bot(kind, seed) {
    const rnd = S.util.rng(seed || 7);
    let hold = 0, holdDir = 0, t = 0;
    return (r, k) => {
      t += S.DT;
      const ai = K.ai.think(r, k);
      const out = { steer: ai.steer, gas: true, brake: false, hop: false, item: false, call: false };
      if (kind === 'kid') {
        if (hold > 0) { hold -= S.DT; out.steer = holdDir; }
        else if (rnd() < 0.004) { hold = 0.3 + rnd() * 0.9; holdDir = rnd() < 0.5 ? -1 : 1; } // a wobble
        else out.steer = Math.abs(ai.steer) < 0.25 ? 0 : Math.sign(ai.steer); // a kid's steering is all or nothing
        out.item = rnd() < 0.02;
        out.call = rnd() < 0.004;
        out.hop = rnd() < 0.01;
      } else {
        out.item = !!k.item && rnd() < 0.01;
        out.gas = ai.gas;
        out.brake = ai.brake;
      }
      return out;
    };
  }

  // One race. o: { track, level, seed, laps, maxTime, test, kids: ['kid' | 'good', ...], mode }
  function simRace(o) {
    const kids = o.kids || [];
    const seed = o.seed || 1;
    const cast = CAST.slice();
    // shuffle the grid so every character starts everywhere sometime
    const rnd = S.util.rng(seed * 31 + 7);
    for (let i = cast.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [cast[i], cast[j]] = [cast[j], cast[i]]; }
    const racers = cast.map((ch, i) => ({ ch, human: i >= cast.length - kids.length ? cast.length - 1 - i : undefined }));
    const r = S.createRace({ track: o.track, level: o.level || 'normal', mode: o.mode || (kids.length ? 'race' : 'demo'), racers, seed, laps: o.laps, test: o.test });
    const bots = kids.map((kind, i) => bot(kind, seed * 13 + i));
    const maxTime = o.maxTime || 400;
    const counts = {};
    const bad = [];
    let maxExcess = 0, offTicks = 0;
    while (r.phase !== 'done' && r.time < maxTime) {
      const inputs = bots.map((fn, i) => fn(r, r.karts.find((k) => k.human === i)));
      S.step(r, inputs);
      if (o.trace) o.trace(r);
      for (const e of r.events) counts[e.type] = (counts[e.type] || 0) + 1;
      r.events.length = 0;
      for (const k of r.karts) {
        if (!Number.isFinite(k.x + k.z + k.y + k.vx + k.vz) && bad.length < 5) bad.push(`${k.ch} NaN at ${r.time.toFixed(1)}s`);
        const ex = k.q.excess || 0;
        if (k.q.path < 0 || ex > 0.05) {
          offTicks++;
          maxExcess = Math.max(maxExcess, ex);
        }
      }
    }
    if (kids.length) {
      // kids' races end when the kids finish; let the CPUs finish too, so their check counts
      while (!r.karts.every((k) => k.finished) && r.time < maxTime) {
        S.step(r, bots.map((fn, i) => fn(r, r.karts.find((k) => k.human === i))));
        r.events.length = 0;
      }
    }
    const st = S.standings(r);
    const fin = r.karts.filter((k) => k.finished).map((k) => k.finishT);
    return {
      track: o.track, level: o.level, seed, finished: r.karts.every((k) => k.finished), time: +r.time.toFixed(1),
      first: fin.length ? +Math.min(...fin).toFixed(1) : null, last: fin.length ? +Math.max(...fin).toFixed(1) : null,
      kids: r.karts.filter((k) => k.human >= 0).map((k) => ({ ch: k.ch, place: k.place, time: k.finished ? +k.finishT.toFixed(1) : null, rescues: k.rescues, hits: k.stats.hits, saves: k.stats.saves })),
      winner: st[0].ch, rescues: r.stat.rescues, why: r.stat.rescueWhy, offTicks, maxExcess: +maxExcess.toFixed(2), counts, bad,
      shortcut: r.stat.shortcut, airs: r.stat.airs, hits: r.stat.hits, items: r.stat.items, saves: r.stat.saves,
    };
  }

  // Races on every track. opts: { level, seed, maxTime, test, kids, laps }
  function soak(n, opts) {
    const o = opts || {};
    const out = { races: n, finished: 0, problems: [], perTrack: {}, rescues: 0, offTicks: 0, hits: 0, items: 0, shortcut: 0, airs: 0, saves: 0, kidPlaces: [], kidRescues: 0 };
    for (let i = 0; i < n; i++) {
      const track = o.track || K.TRACKS[i % K.TRACKS.length].id;
      const level = o.level || (Math.floor(i / K.TRACKS.length) % 2 ? 'easy' : 'normal');
      const seed = (o.seed || 100) + i * 7919;
      const res = simRace({ track, level, seed, maxTime: o.maxTime, test: o.test, kids: o.kids, laps: o.laps });
      const pt = out.perTrack[track] || (out.perTrack[track] = { races: 0, first: [], last: [] });
      pt.races++;
      if (res.first) pt.first.push(res.first);
      if (res.last) pt.last.push(res.last);
      if (res.finished) out.finished++;
      else out.problems.push(`${track} ${level} seed ${seed}: not everyone finished in ${res.time} s`);
      // the balloon is there for kids who get lost, but a CPU (or a 🐣 kid, with the helpers on) should never need it
      const kidsLost = res.kids.reduce((a, kid) => a + kid.rescues, 0);
      if (res.rescues - (level === 'easy' ? 0 : kidsLost)) out.problems.push(`${track} ${level} seed ${seed}: ${res.rescues} rescue(s): ${res.why.join('; ')}`);
      if (res.offTicks) out.problems.push(`${track} ${level} seed ${seed}: karts beyond a wall for ${res.offTicks} ticks (worst ${res.maxExcess} m)`);
      for (const b of res.bad) out.problems.push(`${track} ${level} seed ${seed}: ${b}`);
      for (const kid of res.kids) {
        out.kidPlaces.push(kid.place);
        out.kidRescues += kid.rescues;
        if (kid.time === null) out.problems.push(`${track} ${level} seed ${seed}: kid ${kid.ch} didn't finish`);
      }
      out.rescues += res.rescues;
      out.offTicks += res.offTicks;
      out.hits += res.hits;
      out.items += res.items;
      out.shortcut += res.shortcut;
      out.airs += res.airs;
      out.saves += res.saves;
    }
    for (const t of Object.keys(out.perTrack)) {
      const p = out.perTrack[t];
      const avg = (a) => (a.length ? +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) : null);
      out.perTrack[t] = { races: p.races, winnerAvg: avg(p.first), lastAvg: avg(p.last) };
    }
    out.ok = out.problems.length === 0 && out.finished === n;
    return out;
  }

  K.soak = { simRace, soak, bot, CAST };
})(typeof window !== 'undefined' ? window : globalThis);
