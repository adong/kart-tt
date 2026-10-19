#!/usr/bin/env node
/* Run the headless races from a terminal, with the same engine files the page loads.
     node tools/soak.js 24                      24 CPU-only races, every track, Easy and Normal: everyone must finish,
                                                nobody beyond a wall, nobody stuck, no rescues, no NaN
     node tools/soak.js 12 --kids kid,kid       two sloppy test kids (with the 🐣 helpers) race the CPUs
     node tools/soak.js 12 --maxTime 40         proves the check can fail: races cut off at 40 s are reported
     node tools/soak.js 6 --sabotage noSteer    proves it again: CPUs that never steer hit the walls and get stuck
     node tools/soak.js 6 --sabotage noWalls    ...and with the walls switched off (and CPUs aiming off the road) karts end up beyond them
     options: --level easy|normal  --track backyard  --seed 5  --laps 1 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = { console, Math, Number, JSON, Object, Array, Map, Set };
ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ['js/geo.js', 'js/tracks.js', 'js/sim.js', 'js/ai.js', 'js/soak.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), ctx, { filename: f });
}
const K = ctx.KART;
const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : def;
};
const sab = opt('sabotage');
const t0 = Date.now();
const out = K.soak.soak(+(args[0] || 12), {
  level: opt('level'), track: opt('track'), seed: opt('seed') ? +opt('seed') : undefined, laps: opt('laps') ? +opt('laps') : undefined,
  maxTime: opt('maxTime') ? +opt('maxTime') : undefined, kids: opt('kids') ? opt('kids').split(',') : undefined,
  test: sab === 'noWalls' ? { noWalls: true, wander: true } : sab ? { [sab]: true } : undefined,
});
out.wallSeconds = +((Date.now() - t0) / 1000).toFixed(1);
if (out.problems.length > 12) out.problems = out.problems.slice(0, 12).concat([`... and ${out.problems.length - 12} more`]);
console.log(JSON.stringify(out, null, 1));
process.exitCode = out.ok ? 0 : 1;
