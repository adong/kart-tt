/* TT Kart: the six tracks and the two cups. Plain data: js/geo.js turns it into corridors, js/art.js draws it and
   js/sim.js races on it.
   pts: the main loop's control points [x, z, y?, hw?] (metres; the start line is at the first point, driving towards
   the second). Positions along a path are fractions (`at`) of its length; `lat` is metres to the right of the centre.
   branches: shortcuts { from, to (fractions of the loop), via: control points, hw, surface }; path 1 is the first.
   ramps (kind 'ramp' kicks you into the air, 'bounce' is a trampoline, 'bump' a little hump), pads (boost arrows),
   zones (kind 'slow' puddles, 'ice'), posts (things you bump into), movers (roll across the road and spin you),
   boxes (rows of item boxes). */
(function (root) {
  'use strict';
  const K = (root.KART = root.KART || {});

  // a detour the shortcut skips: left, out, a hairpin back, right
  const lobe = (r1, d, r2) => [[r1, -90], d, [r2, 180], d, [r1, -90]];

  const TRACKS = [
    {
      id: 'backyard', name: 'BACKYARD', emoji: '🏡', laps: 3, hw: 8.5,
      //       0   1          2   3          4           5   6          7   8..12               13  14         15  16         17
      drive: [95, [35, 90], 25, [30, 45], [30, -45], 20, [35, 90], 25, ...lobe(28, 18, 26), 25, [35, 90], 50, [38, 90], 70],
      fit: [13, 15],
      branches: [{ from: [8, 0], to: [12, 1], bow: 12, hw: 4, surface: 'dirt', name: 'the garden path' }],
      ramps: [{ at: [0, 0.6], len: 7, h: 1.5 }, { path: 1, at: 0.45, len: 5, h: 1.1 }, { at: [15, 0.55], len: 4, h: 0, kind: 'bounce', w: 9 }],
      pads: [{ at: [5, 0.5], lat: -3 }, { at: [5, 0.5], lat: 3 }],
      zones: [{ kind: 'slow', at: [2, 0.5], lat: 4, r: 3.5, art: 'puddle' }],
      posts: [{ at: [9, 0.5], lat: -4, r: 1.3, art: 'gnome' }, { at: [11, 0.5], lat: 4, r: 1.3, art: 'gnome' }],
      movers: [{ at: [13, 0.5], from: -10, to: 10, period: 6, r: 1.6, art: 'soccer' }],
      boxes: [[2, 0.2], [10, 0.5], [15, 0.2]],
    },
    {
      id: 'subway', name: 'SUBWAY', emoji: '🚇', laps: 3, hw: 8,
      //       0   1          2   3          4   5           6   7           8   9..13               14  15         16  17         18
      drive: [115, [32, 90], 50, [32, 90], 20, [28, -40], 25, [28, 40], 15, ...lobe(28, 15, 24), 25, [32, 90], 80, [32, 90], 92],
      fit: [14, 16],
      branches: [{ from: [9, 0], to: [13, 1], bow: 12, hw: 4, surface: 'tiles', name: 'the service tunnel' }],
      ramps: [{ at: [15, 0.5], len: 7, h: 1.6 }],
      pads: [{ at: [0, 0.4], lat: 0 }, { at: [8, 0.5], lat: -3.5 }, { at: [8, 0.5], lat: 3.5 }],
      zones: [{ kind: 'slow', at: [2, 0.6], lat: -3.5, r: 3.2, art: 'puddle' }],
      posts: [{ at: [4, 0.5], lat: 0, r: 1.0, art: 'cone' }, { at: [10, 0.5], lat: -4, r: 1.0, art: 'cone' }, { at: [12, 0.5], lat: 4, r: 1.0, art: 'cone' }],
      movers: [{ at: [2, 0.25], from: -9, to: 9, period: 5, r: 1.5, art: 'suitcase' }, { at: [16, 0.6], from: 9, to: -9, period: 5.5, r: 1.5, art: 'suitcase' }],
      boxes: [[2, 0.85], [11, 0.5], [16, 0.25]],
    },
    {
      id: 'beach', name: 'BEACH', emoji: '🏖️', laps: 3, hw: 8.5,
      //       0   1          2   3          4           5   6           7   8..12               13  14         15  16         17          18          19
      drive: [105, [45, 70], 40, [40, 40], [35, -50], 25, [40, 120], 30, ...lobe(28, 20, 26), 20, [50, 60], 75, [40, 50], [35, -30], [45, 100], 80],
      fit: [13, 2],
      branches: [{ from: [8, 0], to: [12, 1], bow: 12, hw: 4.5, surface: 'water', name: 'the splashy shallows' }],
      ramps: [{ at: [2, 0.4], len: 7, h: 1.6 }, { at: [15, 0.5], len: 6, h: 1.2, kind: 'bump' }],
      pads: [{ at: [0, 0.5], lat: -3 }, { at: [0, 0.5], lat: 3 }, { path: 1, at: 0.2, lat: 0 }],
      zones: [{ kind: 'slow', at: [5, 0.5], lat: 4, r: 4, art: 'sand' }, { kind: 'slow', at: [17, 0.5], lat: -4, r: 4, art: 'sand' }],
      posts: [{ at: [9, 0.5], lat: -4, r: 1.6, art: 'castle' }, { at: [11, 0.5], lat: 3, r: 1.6, art: 'castle' }],
      movers: [{ at: [7, 0.5], from: -10, to: 10, period: 5, r: 1.8, art: 'beachball' }, { at: [13, 0.5], from: 9, to: -9, period: 4, r: 1.0, art: 'crab' }],
      boxes: [[2, 0.85], [10, 0.5], [15, 0.15]],
    },
    {
      id: 'snow', name: 'SNOWY HILL', emoji: '🏔️', laps: 3, hw: 8.5,
      //       0   1             2                3              4   5..9                10  11             12              13               14            15               16            17
      drive: [110, [40, 90, 3], { s: 60, y: 9 }, [35, 90, 12], 10, ...lobe(26, 16, 24), 10, [35, 45, 11], [35, -45, 9], { s: 40, y: 5 }, [38, 90, 2], { s: 50, y: 0 }, [38, 90, 0], 100],
      fit: [13, 15],
      branches: [{ from: [5, 0], to: [9, 1], bow: 12, hw: 4, surface: 'snow', name: 'the ski jump' }],
      ramps: [{ at: [13, 0.5], len: 8, h: 1.8 }, { path: 1, at: 0.45, len: 5, h: 1.4 }],
      pads: [{ at: [0, 0.5], lat: 0 }, { at: [15, 0.5], lat: -3 }, { at: [15, 0.5], lat: 3 }],
      zones: [{ kind: 'ice', at: [2, 0.5], lat: 0, r: 7, art: 'ice' }, { kind: 'ice', at: [10, 0.5], lat: 3, r: 6, art: 'ice' }],
      posts: [{ at: [6, 0.6], lat: -4.5, r: 1.6, art: 'snowman' }, { at: [8, 0.4], lat: 4.5, r: 1.6, art: 'snowman' }, { at: [17, 0.4], lat: 0, r: 1.6, art: 'snowman' }],
      movers: [{ at: [12, 0.5], from: 10, to: -10, period: 5, r: 1.9, art: 'snowball' }],
      boxes: [[2, 0.85], [7, 0.5], [15, 0.85]],
    },
    {
      id: 'candy', name: 'COOKIE LAND', emoji: '🍭', laps: 3, hw: 8,
      //       0   1          2           3   4           5   6..10               11  12          13          14          15  16          17
      drive: [60, [30, 60], [30, -60], 30, [35, 120], 20, ...lobe(22, 15, 24), 20, [30, -60], [30, 60], [35, 120], 60, [38, 120], 40],
      fit: [15, 3],
      branches: [{ from: [6, 0], to: [10, 1], bow: 12, hw: 4, surface: 'cookie', name: 'the cookie crumble' }],
      ramps: [{ at: [0, 0.6], len: 7, h: 1.6 }, { at: [15, 0.5], len: 4, h: 0, kind: 'bounce', w: 8 }],
      pads: [{ at: [3, 0.5], lat: -3 }, { at: [3, 0.5], lat: 3 }, { at: [17, 0.5], lat: 0 }],
      zones: [{ kind: 'slow', at: [5, 0.5], lat: -4, r: 4, art: 'choc' }, { kind: 'slow', at: [11, 0.5], lat: 4, r: 4, art: 'choc' }],
      posts: [{ at: [2, 0.5], lat: 4, r: 1.5, art: 'gumdrop' }, { at: [7, 0.5], lat: -4, r: 1.5, art: 'gumdrop' }, { at: [13, 0.5], lat: 0, r: 1.5, art: 'gumdrop' }],
      movers: [{ at: [15, 0.2], from: -9, to: 9, period: 4.5, r: 1.6, art: 'donut' }],
      boxes: [[1, 0.5], [8, 0.5], [15, 0.8]],
    },
    {
      id: 'city', name: 'NIGHT CITY', emoji: '🌃', laps: 3, hw: 8,
      //       0   1          2   3           4   5          6   7          8   9..15: round a city block                                          16  17         18  19         20
      drive: [60, [24, 90], 40, [24, -90], 30, [24, 90], 40, [24, 90], 30, [22, -90], 25, [22, 90], 20, [22, 90], 25, [22, -90], 30, [24, 90], 60, [24, 90], 45],
      fit: [16, 18],
      branches: [{ from: [9, 0], to: [15, 1], bow: 7, hw: 4, surface: 'alley', name: 'the alley' }],
      ramps: [{ at: [2, 0.55], len: 7, h: 1.5 }, { at: [18, 0.5], len: 6, h: 1.3 }],
      pads: [{ at: [0, 0.5], lat: 0 }, { at: [16, 0.5], lat: -3 }, { at: [16, 0.5], lat: 3 }, { path: 1, at: 0.5, lat: 0 }],
      zones: [{ kind: 'slow', at: [4, 0.5], lat: 3.5, r: 3.5, art: 'puddle' }],
      posts: [{ at: [6, 0.5], lat: -4, r: 1.0, art: 'cone' }, { at: [6, 0.5], lat: 4, r: 1.0, art: 'cone' }, { at: [18, 0.2], lat: 0, r: 1.0, art: 'cone' }],
      movers: [{ at: [4, 0.2], from: -10, to: 10, period: 6, r: 1.9, art: 'taxi' }, { at: [16, 0.2], from: 10, to: -10, period: 6.5, r: 1.9, art: 'taxi' }],
      boxes: [[2, 0.15], [12, 0.5], [18, 0.8]],
    },
  ];

  // The cups for the Grand Prix: four tracks each.
  const CUPS = [
    { id: 'sunny', name: 'SUNNY CUP', emoji: '🌞', tracks: ['backyard', 'beach', 'candy', 'snow'] },
    { id: 'moon', name: 'MOON CUP', emoji: '🌙', tracks: ['subway', 'snow', 'candy', 'city'] },
  ];

  // Grand Prix points for 1st..7th
  const POINTS = [10, 8, 6, 5, 4, 3, 2, 1];

  K.TRACKS = TRACKS;
  K.CUPS = CUPS;
  K.POINTS = POINTS;
  K.trackDef = (id) => TRACKS.find((t) => t.id === id);
  const cache = {};
  K.track = (id) => cache[id] || (cache[id] = K.geo.build(K.trackDef(id)));
})(typeof window !== 'undefined' ? window : globalThis);
