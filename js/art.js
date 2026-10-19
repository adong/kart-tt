/* TT Kart: the look of everything. Builds a track (road ribbons, curbs, grass, walls with gaps for the shortcut,
   ramps, boost arrows, puddles, the start arch and each track's own props), the karts with the kit's characters
   sitting in them, the item boxes and the items. Every texture is painted on a canvas and every model is built from
   boxes, cylinders and spheres: no image or model files. Static props are merged by material to keep draw calls low. */
(function () {
  'use strict';
  const T = THREE;
  const { FONT, EMOJI_FONT, makeCanvas, toTexture, shade, roundRect, std, emojiTexture } = Kit.gfx;
  const G = KART.geo;
  const TAU = Math.PI * 2;
  let seed = 1;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const rr = (a, b) => a + rnd() * (b - a);
  const pickR = (a) => a[Math.floor(rnd() * a.length)];
  const Art = {};

  // ------------------------------------------------------------------ the six looks

  const THEMES = {
    backyard: {
      sky: ['#3d9bff', '#bfe6ff'], fog: '#cbe8ff', fogFar: 520, sun: 1.25, hemi: ['#ffffff', '#5c7d3a', 0.85],
      ground: '#64be44', ground2: '#56ad3a', verge: '#5cb93e', road: ['#8e8a86', '#a19c97'], line: '#ffffff', curb: ['#ff4b5c', '#ffffff'],
      wall: 'fence', ramp: '#ff8a1f', shortcut: '#9a6b3e', props: ['tree', 'tree', 'bush', 'flowers', 'tree', 'house', 'swing', 'sandbox', 'doghouse'],
    },
    subway: {
      sky: ['#0d1020', '#252c44'], fog: '#1b2034', fogFar: 300, sun: 0.55, hemi: ['#cfd8ff', '#2a2a3a', 0.75], night: true,
      ground: '#3a3f4c', ground2: '#333744', verge: '#555b68', road: ['#3c3f47', '#474a52'], line: '#ffd400', curb: ['#ffd400', '#26262e'],
      wall: 'tiles', ramp: '#ffd400', shortcut: '#9aa3b5', props: ['pillar', 'pillar', 'train', 'bench', 'pillar', 'lightbox'], ceiling: true,
    },
    beach: {
      sky: ['#2fa6ff', '#c8efff'], fog: '#d4f1ff', fogFar: 560, sun: 1.35, hemi: ['#ffffff', '#c8a868', 0.85],
      ground: '#f2d38b', ground2: '#ead08a', verge: '#f5dc9c', road: ['#9b958c', '#aaa49a'], line: '#ffffff', curb: ['#18b4ff', '#ffffff'],
      wall: 'rope', ramp: '#ff3d7f', shortcut: '#3fc1e8', props: ['palm', 'palm', 'umbrella', 'towel', 'palm', 'lifeguard', 'surfboard'], ocean: true,
    },
    snow: {
      sky: ['#79b8ff', '#e6f2ff'], fog: '#e8f3ff', fogFar: 460, sun: 1.15, hemi: ['#ffffff', '#9ab0c8', 0.95],
      ground: '#f4f8ff', ground2: '#e8f0fb', verge: '#e4eefb', road: ['#7f93ad', '#91a5bf'], line: '#ffffff', curb: ['#ff4b5c', '#ffffff'],
      wall: 'snowbank', ramp: '#18b4ff', shortcut: '#ffffff', props: ['pine', 'pine', 'pine', 'rock', 'cabin', 'snowmanDecor', 'pine'],
    },
    candy: {
      sky: ['#ff9fd2', '#ffe3f3'], fog: '#ffe0f1', fogFar: 480, sun: 1.2, hemi: ['#ffffff', '#ff9fc8', 0.9],
      ground: '#a8f0d0', ground2: '#9de6c4', verge: '#ffd0e6', road: ['#7a4a2a', '#865433'], line: '#fff4c2', curb: ['#ff3d7f', '#ffffff'],
      wall: 'cane', ramp: '#ffb0d8', shortcut: '#e0a050', props: ['lollipop', 'lollipop', 'cupcake', 'gumtree', 'cane', 'icecream', 'cookiehouse'],
    },
    city: {
      sky: ['#05061a', '#1c2050'], fog: '#151838', fogFar: 420, sun: 0.6, hemi: ['#b8c4ff', '#2a2838', 1.0], night: true, stars: true,
      ground: '#2b2e3a', ground2: '#262935', verge: '#6b7080', road: ['#3c3f4a', '#474a56'], line: '#ffffff', curb: ['#ff3d7f', '#ffffff'],
      wall: 'barrier', ramp: '#18d4ff', shortcut: '#4a4d58', props: ['building', 'building', 'lamp', 'building', 'neon', 'building', 'lamp'],
    },
  };

  // ------------------------------------------------------------------ textures

  const texCache = {};
  const cached = (key, fn) => texCache[key] || (texCache[key] = fn());

  function noise(g, w, h, n, col, a, s0, s1) {
    for (let i = 0; i < n; i++) {
      g.fillStyle = col;
      g.globalAlpha = a * (0.4 + Math.random() * 0.6);
      const s = s0 + Math.random() * (s1 - s0);
      g.fillRect(Math.random() * w, Math.random() * h, s, s);
    }
    g.globalAlpha = 1;
  }

  function roadTex(th) {
    return cached('road' + th.road, () => {
      const [c, g] = makeCanvas(256, 256);
      g.fillStyle = th.road[0];
      g.fillRect(0, 0, 256, 256);
      noise(g, 256, 256, 2600, th.road[1], 0.6, 1, 3);
      noise(g, 256, 256, 900, '#000000', 0.12, 1, 2);
      if (th === THEMES.candy) {
        const cols = ['#ff3d7f', '#ffd400', '#18d4ff', '#7dff5a', '#ffffff', '#b06bff'];
        for (let i = 0; i < 160; i++) {
          g.save();
          g.translate(Math.random() * 256, Math.random() * 256);
          g.rotate(Math.random() * TAU);
          g.fillStyle = cols[i % cols.length];
          roundRect(g, -3, -1, 6, 2, 1);
          g.fill();
          g.restore();
        }
      }
      // the dashed middle line
      g.fillStyle = th.line;
      g.globalAlpha = 0.85;
      g.fillRect(124, 0, 8, 128);
      g.globalAlpha = 1;
      const t = toTexture(c, true);
      return t;
    });
  }

  function groundTex(col, col2, kind) {
    return cached('ground' + col + kind, () => {
      const [c, g] = makeCanvas(256, 256);
      g.fillStyle = col;
      g.fillRect(0, 0, 256, 256);
      noise(g, 256, 256, 1800, col2, 0.8, 2, 6);
      noise(g, 256, 256, 600, '#ffffff', kind === 'snow' ? 0.4 : 0.07, 1, 3);
      if (kind === 'grass') {
        g.strokeStyle = shade(col, -0.25);
        g.globalAlpha = 0.35;
        for (let i = 0; i < 500; i++) {
          const x = Math.random() * 256, y = Math.random() * 256;
          g.beginPath();
          g.moveTo(x, y);
          g.lineTo(x + Math.random() * 4 - 2, y - 4 - Math.random() * 4);
          g.stroke();
        }
        g.globalAlpha = 1;
      }
      return toTexture(c, true);
    });
  }

  function surfaceTex(kind) {
    return cached('surf' + kind, () => {
      const [c, g] = makeCanvas(128, 128);
      const fill = (a, b, n) => {
        g.fillStyle = a;
        g.fillRect(0, 0, 128, 128);
        noise(g, 128, 128, n, b, 0.7, 2, 6);
      };
      if (kind === 'dirt') fill('#9a6b3e', '#7c522c', 700);
      else if (kind === 'water') {
        fill('#3fc1e8', '#7fe0ff', 200);
        g.strokeStyle = 'rgba(255,255,255,0.6)';
        g.lineWidth = 3;
        for (let y = 10; y < 128; y += 26) {
          g.beginPath();
          for (let x = 0; x <= 128; x += 8) g.lineTo(x, y + Math.sin(x / 10) * 4);
          g.stroke();
        }
      } else if (kind === 'tiles') {
        g.fillStyle = '#9aa3b5';
        g.fillRect(0, 0, 128, 128);
        for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
          g.fillStyle = (x + y) % 2 ? '#c9d0dc' : '#aeb7c6';
          g.fillRect(x * 32 + 1, y * 32 + 1, 30, 30);
        }
      } else if (kind === 'snow') fill('#ffffff', '#dfe9f7', 500);
      else if (kind === 'cookie') {
        fill('#e0a050', '#c98a3a', 500);
        g.fillStyle = '#4a2a12';
        for (let i = 0; i < 14; i++) {
          g.beginPath();
          g.arc(Math.random() * 128, Math.random() * 128, 4 + Math.random() * 4, 0, TAU);
          g.fill();
        }
      } else if (kind === 'alley') {
        g.fillStyle = '#4a4d58';
        g.fillRect(0, 0, 128, 128);
        for (let y = 0; y < 8; y++) for (let x = 0; x < 6; x++) {
          g.fillStyle = shade('#5c606c', (Math.random() - 0.5) * 0.3);
          roundRect(g, x * 22 + (y % 2) * 11 - 4, y * 16 + 1, 19, 14, 4);
          g.fill();
        }
      } else fill('#888888', '#777777', 300);
      return toTexture(c, true);
    });
  }

  function stripeTex(a, b) {
    return cached('stripe' + a + b, () => {
      const [c, g] = makeCanvas(64, 64);
      g.fillStyle = a;
      g.fillRect(0, 0, 64, 32);
      g.fillStyle = b;
      g.fillRect(0, 32, 64, 32);
      return toTexture(c, true);
    });
  }

  function checkerTex() {
    return cached('checker', () => {
      const [c, g] = makeCanvas(128, 32);
      for (let y = 0; y < 2; y++) for (let x = 0; x < 8; x++) {
        g.fillStyle = (x + y) % 2 ? '#111111' : '#ffffff';
        g.fillRect(x * 16, y * 16, 16, 16);
      }
      return toTexture(c, true);
    });
  }

  function wallTex(kind) {
    return cached('wall' + kind, () => {
      const [c, g] = makeCanvas(256, 64);
      if (kind === 'fence') {
        g.fillStyle = '#7a4f2a';
        g.fillRect(0, 0, 256, 64);
        for (let i = 0; i < 8; i++) {
          g.fillStyle = shade('#c98a4f', (i % 2) * 0.08 - 0.04);
          g.fillRect(i * 32 + 2, 4, 28, 60);
          g.beginPath();
          g.moveTo(i * 32 + 2, 6);
          g.lineTo(i * 32 + 16, 0);
          g.lineTo(i * 32 + 30, 6);
          g.fill();
        }
        g.fillStyle = '#8a5a30';
        g.fillRect(0, 18, 256, 6);
        g.fillRect(0, 46, 256, 6);
      } else if (kind === 'tiles') {
        g.fillStyle = '#e8eef5';
        g.fillRect(0, 0, 256, 64);
        g.strokeStyle = '#b8c4d2';
        for (let x = 0; x <= 256; x += 16) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 64); g.stroke(); }
        for (let y = 0; y <= 64; y += 12) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); }
        g.fillStyle = '#2a7bd6';
        g.fillRect(0, 26, 256, 10);
      } else if (kind === 'rope') {
        g.fillStyle = 'rgba(0,0,0,0)';
        g.clearRect(0, 0, 256, 64);
        g.fillStyle = '#c8945a';
        g.fillRect(0, 10, 256, 7);
        g.fillRect(0, 38, 256, 7);
        for (let x = 0; x < 256; x += 64) {
          g.fillStyle = '#ffffff';
          g.fillRect(x, 0, 12, 64);
          g.fillStyle = '#ff3d7f';
          g.fillRect(x, 0, 12, 12);
          g.fillRect(x, 26, 12, 12);
          g.fillRect(x, 52, 12, 12);
        }
      } else if (kind === 'snowbank') {
        g.fillStyle = '#ffffff';
        g.fillRect(0, 0, 256, 64);
        noise(g, 256, 64, 400, '#dce8f8', 0.8, 3, 9);
      } else if (kind === 'cane') {
        g.clearRect(0, 0, 256, 64);
        for (let x = -64; x < 256; x += 16) {
          g.fillStyle = (x / 16) % 2 ? '#ff2d55' : '#ffffff';
          g.beginPath();
          g.moveTo(x, 64);
          g.lineTo(x + 16, 64);
          g.lineTo(x + 80, 0);
          g.lineTo(x + 64, 0);
          g.fill();
        }
      } else if (kind === 'barrier') {
        g.fillStyle = '#b8bcc8';
        g.fillRect(0, 0, 256, 64);
        noise(g, 256, 64, 300, '#a0a5b2', 0.8, 2, 5);
        g.fillStyle = '#ff3d7f';
        g.fillRect(0, 4, 256, 8);
      }
      return toTexture(c, true);
    });
  }

  function boxTex() {
    return cached('box', () => {
      const [c, g] = makeCanvas(128, 128);
      const gr = g.createLinearGradient(0, 0, 128, 128);
      ['#ff3d7f', '#ffd400', '#7dff5a', '#18d4ff', '#b06bff'].forEach((col, i) => gr.addColorStop(i / 4, col));
      g.fillStyle = gr;
      g.fillRect(0, 0, 128, 128);
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.fillRect(8, 8, 112, 112);
      g.lineWidth = 8;
      g.strokeStyle = '#ffffff';
      g.strokeRect(4, 4, 120, 120);
      g.font = `bold 84px ${FONT}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.lineWidth = 10;
      g.strokeStyle = '#14121f';
      g.strokeText('?', 64, 70);
      g.fillStyle = '#ffffff';
      g.fillText('?', 64, 70);
      return toTexture(c);
    });
  }

  function arrowTex() {
    return cached('arrow', () => {
      const [c, g] = makeCanvas(64, 128);
      g.fillStyle = '#ff8a1f';
      g.fillRect(0, 0, 64, 128);
      g.fillStyle = '#ffe14a';
      for (let i = 0; i < 2; i++) {
        const y = i * 64;
        g.beginPath();
        g.moveTo(8, y + 56);
        g.lineTo(32, y + 16);
        g.lineTo(56, y + 56);
        g.lineTo(44, y + 56);
        g.lineTo(32, y + 36);
        g.lineTo(20, y + 56);
        g.fill();
      }
      const t = toTexture(c, true);
      return t;
    });
  }

  function chevronTex(col) {
    return cached('chev' + col, () => {
      const [c, g] = makeCanvas(64, 64);
      g.fillStyle = col;
      g.fillRect(0, 0, 64, 64);
      g.fillStyle = '#14121f';
      for (let x = -64; x < 64; x += 32) {
        g.beginPath();
        g.moveTo(x, 64);
        g.lineTo(x + 16, 64);
        g.lineTo(x + 48, 0);
        g.lineTo(x + 32, 0);
        g.fill();
      }
      return toTexture(c, true);
    });
  }

  function windowsTex(col) {
    return cached('win' + col, () => {
      const [c, g] = makeCanvas(128, 256);
      g.fillStyle = col;
      g.fillRect(0, 0, 128, 256);
      for (let y = 8; y < 256; y += 24) for (let x = 8; x < 128; x += 24) {
        const lit = Math.random() < 0.55;
        g.fillStyle = lit ? pickR(['#ffe9a8', '#fff6d0', '#ffd27a', '#bfe4ff']) : '#1a1c2a';
        g.fillRect(x, y, 14, 14);
      }
      return toTexture(c, true);
    });
  }

  function skyTex(th) {
    const [c, g] = makeCanvas(16, 512);
    const gr = g.createLinearGradient(0, 0, 0, 512);
    gr.addColorStop(0, th.sky[0]);
    gr.addColorStop(0.62, th.sky[1]);
    gr.addColorStop(1, th.fog);
    g.fillStyle = gr;
    g.fillRect(0, 0, 16, 512);
    const t = toTexture(c);
    return t;
  }

  // ------------------------------------------------------------------ geometry helpers

  // a strip along a path between two lateral offsets; yf(i, lat) gives extra height
  function ribbon(P, lat0, lat1, yOff, vTile, uTiles, yf) {
    const n = P.n + (P.closed ? 1 : 0);
    const pos = [], uv = [], idx = [];
    for (let i = 0; i < n; i++) {
      const j = i % P.n;
      const s = P.closed && i === P.n ? P.len : P.s[j];
      for (const [k, lat] of [[0, lat0], [1, lat1]]) {
        const l = typeof lat === 'function' ? lat(j) : lat;
        pos.push(P.x[j] - P.tz[j] * l, P.y[j] + yOff + (yf ? yf(j, l) : 0), P.z[j] + P.tx[j] * l);
        uv.push(k * uTiles, s / vTile);
      }
      if (i < n - 1) {
        const a = i * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); // facing up
      }
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return geo;
  }

  // a wall along one side of a path: vertical strips, skipping stretches inside another corridor (the shortcut gaps)
  function wallGeo(trk, P, side, height, vTile) {
    const pos = [], uv = [], idx = [];
    const q = {};
    let run = 0;
    const segN = P.closed ? P.n : P.n - 1;
    for (let i = 0; i <= segN; i++) {
      const j = i % P.n;
      const lat = side * (P.hw[j] + P.verge);
      const x = P.x[j] - P.tz[j] * lat, z = P.z[j] + P.tx[j] * lat;
      // probe a little outside the wall: if that's inside another corridor, this is a gap
      const px = P.x[j] - P.tz[j] * (lat + side * 0.8), pz = P.z[j] + P.tx[j] * (lat + side * 0.8);
      G.query(trk, px, pz, -1, q);
      const open = q.path >= 0 && q.path !== P.id && q.excess < -0.3;
      if (open || (!P.closed && (i < 1 || i > segN - 1))) {
        run = 0;
        continue;
      }
      const s = P.closed && i === P.n ? P.len : P.s[j];
      const base = pos.length / 3;
      pos.push(x, P.y[j] - 0.3, z, x, P.y[j] + height, z);
      uv.push(s / vTile, 0, s / vTile, 1);
      if (run > 0) {
        const a = base - 2;
        if (side > 0) idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
        else idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
      run++;
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return geo;
  }

  // Merge every static mesh under `group` into one mesh per material (fewer draw calls).
  function mergeStatic(group) {
    group.updateMatrixWorld(true);
    const byMat = new Map();
    const keep = [];
    group.traverse((o) => {
      if (!o.isMesh || o.userData.keep) return;
      const list = byMat.get(o.material) || [];
      list.push(o);
      byMat.set(o.material, list);
    });
    const out = new T.Group();
    for (const [mat, list] of byMat) {
      let count = 0;
      const geos = list.map((m) => {
        let g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
        g.applyMatrix4(m.matrixWorld);
        if (!g.attributes.uv) g.setAttribute('uv', new T.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
        count += g.attributes.position.count;
        return g;
      });
      const P = new Float32Array(count * 3), N = new Float32Array(count * 3), U = new Float32Array(count * 2);
      let o3 = 0, o2 = 0;
      for (const g of geos) {
        P.set(g.attributes.position.array, o3);
        N.set(g.attributes.normal.array, o3);
        U.set(g.attributes.uv.array, o2);
        o3 += g.attributes.position.array.length;
        o2 += g.attributes.uv.array.length;
        g.dispose();
      }
      const geo = new T.BufferGeometry();
      geo.setAttribute('position', new T.BufferAttribute(P, 3));
      geo.setAttribute('normal', new T.BufferAttribute(N, 3));
      geo.setAttribute('uv', new T.BufferAttribute(U, 2));
      out.add(new T.Mesh(geo, mat));
    }
    group.traverse((o) => { if (o.isMesh && o.userData.keep) keep.push(o); });
    return { merged: out, keep };
  }

  // material cache: one material per colour and options
  const matCache = {};
  function M(color, o) {
    const key = color + (o ? JSON.stringify(o, (k, v) => (v && v.isTexture ? v.uuid : v)) : '');
    return matCache[key] || (matCache[key] = std(color, o));
  }
  const GEO = {
    box: new T.BoxGeometry(1, 1, 1),
    sphere: new T.SphereGeometry(1, 16, 12),
    lowSphere: new T.SphereGeometry(1, 10, 8),
    cyl: new T.CylinderGeometry(1, 1, 1, 14),
    cone: new T.ConeGeometry(1, 1, 14),
    torus: new T.TorusGeometry(1, 0.35, 10, 20),
  };
  function part(geo, mat, parent, x, y, z, sx, sy, sz, rx, ry, rz) {
    const m = new T.Mesh(geo, mat);
    m.position.set(x || 0, y || 0, z || 0);
    m.scale.set(sx || 1, sy === undefined ? sx || 1 : sy, sz === undefined ? sx || 1 : sz);
    if (rx || ry || rz) m.rotation.set(rx || 0, ry || 0, rz || 0);
    parent.add(m);
    return m;
  }

  // ------------------------------------------------------------------ props

  const PROPS = {
    tree(g) {
      part(GEO.cyl, M('#8a5a2b'), g, 0, 2, 0, 0.45, 4, 0.45);
      const leaf = M(pickR(['#3fae4a', '#4cc25a', '#2f9a40']));
      part(GEO.lowSphere, leaf, g, 0, 5.2, 0, 2.6);
      part(GEO.lowSphere, leaf, g, 1.4, 4.4, 0.5, 1.8);
      part(GEO.lowSphere, leaf, g, -1.3, 4.6, -0.4, 1.9);
      return 3;
    },
    bush(g) {
      const leaf = M('#3a9e44');
      part(GEO.lowSphere, leaf, g, 0, 0.6, 0, 1.4, 1, 1.4);
      part(GEO.lowSphere, leaf, g, 1, 0.5, 0.3, 1, 0.8, 1);
      return 1.8;
    },
    flowers(g) {
      for (let i = 0; i < 7; i++) {
        const x = rr(-2, 2), z = rr(-2, 2);
        part(GEO.cyl, M('#3a9e44'), g, x, 0.35, z, 0.05, 0.7, 0.05);
        part(GEO.lowSphere, M(pickR(['#ff3d7f', '#ffd400', '#ffffff', '#b06bff', '#ff8a1f'])), g, x, 0.75, z, 0.28);
      }
      return 2.5;
    },
    house(g) {
      const col = pickR(['#ffd9a8', '#cfe8ff', '#ffe0ef']);
      part(GEO.box, M(col), g, 0, 3, 0, 10, 6, 8);
      const roof = part(GEO.cone, M('#d4473a'), g, 0, 8, 0, 8, 4, 8);
      roof.rotation.y = Math.PI / 4;
      part(GEO.box, M('#8a5a2b'), g, 0, 1.4, 4.05, 1.6, 2.8, 0.1);
      part(GEO.box, M('#9fd8ff', { emissive: '#1a3048' }), g, -2.8, 3.6, 4.05, 1.8, 1.4, 0.1);
      part(GEO.box, M('#9fd8ff', { emissive: '#1a3048' }), g, 2.8, 3.6, 4.05, 1.8, 1.4, 0.1);
      return 7;
    },
    swing(g) {
      const red = M('#ff4b5c');
      part(GEO.cyl, red, g, -2.5, 1.8, -1, 0.12, 3.8, 0.12, 0.25);
      part(GEO.cyl, red, g, -2.5, 1.8, 1, 0.12, 3.8, 0.12, -0.25);
      part(GEO.cyl, red, g, 2.5, 1.8, -1, 0.12, 3.8, 0.12, 0.25);
      part(GEO.cyl, red, g, 2.5, 1.8, 1, 0.12, 3.8, 0.12, -0.25);
      part(GEO.cyl, red, g, 0, 3.6, 0, 0.12, 5.2, 0.12, 0, 0, Math.PI / 2);
      for (const x of [-1.2, 1.2]) {
        part(GEO.cyl, M('#cccccc'), g, x, 2.5, 0, 0.03, 2.2, 0.03);
        part(GEO.box, M('#ffd400'), g, x, 1.35, 0, 0.8, 0.1, 0.4);
      }
      return 3.5;
    },
    sandbox(g) {
      part(GEO.box, M('#c98a4f'), g, 0, 0.3, 0, 4, 0.6, 4);
      part(GEO.box, M('#f2d38b'), g, 0, 0.45, 0, 3.6, 0.4, 3.6);
      part(GEO.cone, M('#ff3d7f'), g, 0.8, 0.9, 0.6, 0.4, 0.6, 0.4, Math.PI);
      return 3;
    },
    doghouse(g) {
      part(GEO.box, M('#e05a3a'), g, 0, 1, 0, 2.4, 2, 2.4);
      const roof = part(GEO.cone, M('#5a3a2a'), g, 0, 2.7, 0, 2.2, 1.4, 2.2);
      roof.rotation.y = Math.PI / 4;
      part(GEO.box, M('#2a1a10'), g, 0, 0.7, 1.21, 1, 1.2, 0.05);
      return 2.2;
    },
    pillar(g) {
      part(GEO.box, M('#c9d0dc'), g, 0, 6, 0, 1.6, 12, 1.6);
      part(GEO.box, M('#2a7bd6'), g, 0, 3, 0, 1.7, 0.6, 1.7);
      return 1.5;
    },
    train(g) {
      const col = pickR(['#ff3d7f', '#18b4ff', '#ffd400', '#7dff5a']);
      for (let i = 0; i < 2; i++) {
        const z = (i - 0.5) * 13;
        part(GEO.box, M(col), g, 0, 2.3, z, 3, 3.4, 12.4);
        part(GEO.box, M('#cfe8ff', { emissive: '#3a5a7a' }), g, 1.52, 2.8, z, 0.05, 1.1, 10);
        part(GEO.box, M('#cfe8ff', { emissive: '#3a5a7a' }), g, -1.52, 2.8, z, 0.05, 1.1, 10);
        part(GEO.box, M('#e8eef5'), g, 0, 4.1, z, 2.8, 0.25, 12);
      }
      part(GEO.box, M('#555a66'), g, 0.75, 0.15, 0, 0.15, 0.3, 30);
      part(GEO.box, M('#555a66'), g, -0.75, 0.15, 0, 0.15, 0.3, 30);
      return 6;
    },
    bench(g) {
      part(GEO.box, M('#ff8a1f'), g, 0, 0.6, 0, 3, 0.15, 0.8);
      part(GEO.box, M('#ff8a1f'), g, 0, 1.1, -0.35, 3, 0.8, 0.12);
      part(GEO.box, M('#333844'), g, -1.2, 0.3, 0, 0.12, 0.6, 0.7);
      part(GEO.box, M('#333844'), g, 1.2, 0.3, 0, 0.12, 0.6, 0.7);
      return 2;
    },
    lightbox(g) {
      part(GEO.box, M('#333844'), g, 0, 2.5, 0, 0.2, 5, 0.2);
      part(GEO.box, M('#ffffff', { emissive: '#ffe9a8', emissiveIntensity: 1 }), g, 0, 5.2, 0, 2.6, 0.4, 0.4);
      return 1;
    },
    palm(g) {
      const trunk = M('#a8763e');
      let x = 0, y = 0;
      const lean = rr(-0.25, 0.25);
      for (let i = 0; i < 6; i++) {
        part(GEO.cyl, trunk, g, x, y + 0.6, 0, 0.32 - i * 0.02, 1.2, 0.32 - i * 0.02, 0, 0, lean * i * 0.3);
        x -= Math.sin(lean * i * 0.3) * 1.15;
        y += 1.15;
      }
      const leaf = M('#2fae4a');
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        const l = part(GEO.cone, leaf, g, x + Math.cos(a) * 1.4, y + 0.2, Math.sin(a) * 1.4, 0.5, 3.2, 0.18);
        l.rotation.set(0, -a, Math.PI / 2 + 0.35);
      }
      part(GEO.lowSphere, M('#6b4a22'), g, x, y - 0.2, 0, 0.35);
      return 2.5;
    },
    umbrella(g) {
      part(GEO.cyl, M('#ffffff'), g, 0, 1.4, 0, 0.06, 2.8, 0.06);
      const top = part(GEO.cone, M(pickR(['#ff3d7f', '#ffd400', '#18b4ff', '#ff8a1f'])), g, 0, 2.9, 0, 1.8, 0.7, 1.8);
      top.rotation.y = rr(0, TAU);
      part(GEO.box, M(pickR(['#ffffff', '#ffd400', '#18d4ff'])), g, 0.6, 0.03, 1.2, 1, 0.05, 2);
      return 2;
    },
    towel(g) {
      part(GEO.box, M(pickR(['#ff3d7f', '#7dff5a', '#b06bff'])), g, 0, 0.03, 0, 1.2, 0.05, 2.2);
      part(GEO.lowSphere, M('#ffffff'), g, 0.2, 0.25, -0.8, 0.25);
      return 1.5;
    },
    lifeguard(g) {
      const w = M('#ffffff');
      for (const x of [-1, 1]) for (const z of [-1, 1]) part(GEO.cyl, w, g, x, 2, z, 0.1, 4, 0.1);
      part(GEO.box, M('#ff4b5c'), g, 0, 4.4, 0, 2.6, 1.6, 2.6);
      part(GEO.box, M('#ffd400'), g, 0, 5.4, 0, 3, 0.2, 3);
      return 2.5;
    },
    surfboard(g) {
      const b = part(GEO.lowSphere, M(pickR(['#18b4ff', '#ff8a1f', '#7dff5a'])), g, 0, 1.4, 0, 0.45, 1.5, 0.1);
      b.rotation.z = 0.15;
      return 1;
    },
    pine(g) {
      part(GEO.cyl, M('#6b4a2a'), g, 0, 0.8, 0, 0.3, 1.6, 0.3);
      const green = M(pickR(['#2f7a4a', '#2a6e44', '#3a8a55']));
      const white = M('#ffffff');
      const h = rr(0.85, 1.3);
      for (let i = 0; i < 3; i++) {
        part(GEO.cone, green, g, 0, (1.8 + i * 1.6) * h, 0, (2.4 - i * 0.6) * h, 2.6 * h, (2.4 - i * 0.6) * h);
        part(GEO.cone, white, g, 0, (2.5 + i * 1.6) * h, 0, (1.2 - i * 0.3) * h, 1.2 * h, (1.2 - i * 0.3) * h);
      }
      return 2.2;
    },
    rock(g) {
      part(GEO.lowSphere, M('#8c96a8'), g, 0, 0.4, 0, 1.6, 1.1, 1.3);
      part(GEO.lowSphere, M('#ffffff'), g, 0, 1.1, 0, 1.3, 0.5, 1.1);
      return 1.6;
    },
    cabin(g) {
      part(GEO.box, M('#8a5a2b'), g, 0, 2, 0, 6, 4, 5);
      const roof = part(GEO.cone, M('#ffffff'), g, 0, 5.2, 0, 5, 2.6, 5);
      roof.rotation.y = Math.PI / 4;
      part(GEO.box, M('#ffd27a', { emissive: '#ffb84a', emissiveIntensity: 0.6 }), g, 1.6, 2.2, 2.52, 1.2, 1, 0.05);
      return 4.5;
    },
    snowmanDecor(g) {
      snowman(g);
      return 1.6;
    },
    lollipop(g) {
      part(GEO.cyl, M('#ffffff'), g, 0, 2, 0, 0.12, 4, 0.12);
      const col = pickR(['#ff3d7f', '#18d4ff', '#ffd400', '#b06bff']);
      part(GEO.cyl, M(col), g, 0, 4.6, 0, 1.6, 0.35, 1.6, Math.PI / 2);
      part(GEO.torus, M('#ffffff'), g, 0, 4.6, 0, 1.05, 1.05, 0.5);
      return 1.6;
    },
    cupcake(g) {
      part(GEO.cyl, M('#ffb0d8'), g, 0, 0.9, 0, 1.3, 1.8, 1.3);
      part(GEO.lowSphere, M(pickR(['#ffffff', '#fff0a0', '#c8f0ff'])), g, 0, 2, 0, 1.5, 1, 1.5);
      part(GEO.lowSphere, M('#ff2d55'), g, 0, 3.1, 0, 0.35);
      return 1.8;
    },
    gumtree(g) {
      part(GEO.cyl, M('#7a4a2a'), g, 0, 1.5, 0, 0.25, 3, 0.25);
      for (let i = 0; i < 6; i++) part(GEO.lowSphere, M(pickR(['#ff3d7f', '#ffd400', '#7dff5a', '#18d4ff', '#b06bff'])), g, rr(-1.2, 1.2), rr(3, 4.6), rr(-1.2, 1.2), 0.7);
      return 2;
    },
    cane(g) {
      const m = M('#ffffff', { map: stripeTex('#ff2d55', '#ffffff') });
      part(GEO.cyl, m, g, 0, 2.5, 0, 0.3, 5, 0.3);
      const hook = part(GEO.torus, m, g, 0.8, 5, 0, 0.8, 0.8, 0.8);
      hook.scale.set(0.8, 0.8, 0.8);
      return 1;
    },
    icecream(g) {
      const c = part(GEO.cone, M('#e0a050'), g, 0, 1.5, 0, 0.9, 3, 0.9);
      c.rotation.x = Math.PI;
      part(GEO.lowSphere, M(pickR(['#ffb0d8', '#fff0c8', '#a8f0d0'])), g, 0, 3.4, 0, 1.1);
      return 1.2;
    },
    cookiehouse(g) {
      part(GEO.box, M('#c98a3a'), g, 0, 2.5, 0, 7, 5, 6);
      const roof = part(GEO.cone, M('#ffffff'), g, 0, 6.6, 0, 6, 3.2, 6);
      roof.rotation.y = Math.PI / 4;
      for (let i = 0; i < 5; i++) part(GEO.lowSphere, M(pickR(['#ff3d7f', '#18d4ff', '#7dff5a'])), g, -2.8 + i * 1.4, 4.6, 3.05, 0.35);
      return 5;
    },
    building(g) {
      const w = rr(10, 16), d = rr(10, 16), h = rr(14, 40);
      const m = M('#ffffff', { map: (() => { const t = windowsTex(pickR(['#2a2f4a', '#33284a', '#203040'])).clone(); t.needsUpdate = true; t.repeat.set(w / 8, h / 16); return t; })(), emissive: '#ffffff', emissiveIntensity: 0.35 });
      m.emissiveMap = m.map;
      part(GEO.box, m, g, 0, h / 2, 0, w, h, d);
      return Math.max(w, d) * 0.7;
    },
    lamp(g) {
      part(GEO.cyl, M('#3a3d48'), g, 0, 3, 0, 0.12, 6, 0.12);
      part(GEO.box, M('#3a3d48'), g, 0.7, 6, 0, 1.6, 0.15, 0.3);
      part(GEO.box, M('#fff6d0', { emissive: '#ffe9a8', emissiveIntensity: 1.2 }), g, 1.3, 5.85, 0, 0.6, 0.15, 0.4);
      g.userData.glow = [1.3, 5.6, 0];
      return 0.8;
    },
    neon(g) {
      part(GEO.cyl, M('#3a3d48'), g, 0, 3, 0, 0.15, 6, 0.15);
      const col = pickR(['#ff3d7f', '#18d4ff', '#7dff5a', '#ffd400', '#b06bff']);
      part(GEO.box, M(col, { emissive: col, emissiveIntensity: 1.3 }), g, 0, 7, 0, 4, 2, 0.3);
      part(GEO.box, M('#14121f'), g, 0, 7, 0.16, 3.4, 1.4, 0.05);
      part(GEO.box, M(col, { emissive: col, emissiveIntensity: 1.6 }), g, 0, 7, 0.2, 2.4, 0.3, 0.05);
      return 2;
    },
  };

  // ------------------------------------------------------------------ obstacles (posts, movers, zones)

  function snowman(g) {
    const w = M('#ffffff');
    part(GEO.lowSphere, w, g, 0, 0.9, 0, 1.0);
    part(GEO.lowSphere, w, g, 0, 2.1, 0, 0.7);
    part(GEO.lowSphere, w, g, 0, 3.0, 0, 0.5);
    part(GEO.cone, M('#ff8a1f'), g, 0, 3.0, 0.6, 0.1, 0.5, 0.1, Math.PI / 2);
    part(GEO.cyl, M('#14121f'), g, 0, 3.55, 0, 0.45, 0.5, 0.45);
    part(GEO.box, M('#ff4b5c'), g, 0, 2.6, 0, 1.3, 0.2, 1.3);
    for (const x of [-0.18, 0.18]) part(GEO.lowSphere, M('#14121f'), g, x, 3.1, 0.43, 0.07);
  }

  const POSTS = {
    gnome(g) {
      part(GEO.cyl, M('#2a7bd6'), g, 0, 0.6, 0, 0.6, 1.2, 0.6);
      part(GEO.lowSphere, M('#efc29c'), g, 0, 1.45, 0, 0.45);
      part(GEO.cone, M('#ffffff'), g, 0, 1.15, 0.3, 0.4, 0.8, 0.2, Math.PI);
      part(GEO.cone, M('#ff4b5c'), g, 0, 2.3, 0, 0.5, 1.4, 0.5);
    },
    cone(g) {
      const o = M('#ff8a1f');
      part(GEO.box, o, g, 0, 0.08, 0, 1.2, 0.16, 1.2);
      part(GEO.cone, o, g, 0, 0.75, 0, 0.5, 1.3, 0.5);
      part(GEO.cyl, M('#ffffff'), g, 0, 0.75, 0, 0.36, 0.22, 0.36);
    },
    castle(g) {
      const s = M('#f0c878');
      part(GEO.cyl, s, g, 0, 0.6, 0, 1.4, 1.2, 1.4);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * TAU;
        part(GEO.cyl, s, g, Math.cos(a) * 1.1, 1.6, Math.sin(a) * 1.1, 0.45, 1.4, 0.45);
        part(GEO.cone, s, g, Math.cos(a) * 1.1, 2.6, Math.sin(a) * 1.1, 0.5, 0.7, 0.5);
      }
      part(GEO.cyl, M('#ffffff'), g, 0, 2.4, 0, 0.04, 2, 0.04);
      part(GEO.box, M('#ff3d7f'), g, 0.3, 3.1, 0, 0.6, 0.4, 0.04);
    },
    snowman,
    gumdrop(g) {
      const col = pickR(['#ff3d7f', '#7dff5a', '#ffd400', '#b06bff']);
      part(GEO.sphere, M(col, { roughness: 0.3 }), g, 0, 0, 0, 1.6, 2.2, 1.6);
    },
  };

  function moverArt(art) {
    const g = new T.Group();
    if (art === 'soccer' || art === 'beachball' || art === 'snowball') {
      const [c, x] = makeCanvas(128, 64);
      if (art === 'soccer') {
        x.fillStyle = '#ffffff';
        x.fillRect(0, 0, 128, 64);
        x.fillStyle = '#14121f';
        for (let i = 0; i < 8; i++) { x.beginPath(); x.arc((i % 4) * 32 + 16 + (i > 3 ? 16 : 0), i > 3 ? 46 : 18, 8, 0, TAU); x.fill(); }
      } else if (art === 'beachball') {
        ['#ff3d7f', '#ffffff', '#ffd400', '#ffffff', '#18b4ff', '#ffffff'].forEach((col, i) => { x.fillStyle = col; x.fillRect(i * 22, 0, 22, 64); });
      } else {
        x.fillStyle = '#ffffff';
        x.fillRect(0, 0, 128, 64);
        noise(x, 128, 64, 200, '#dce8f8', 0.8, 3, 8);
      }
      const r = art === 'beachball' ? 1.8 : art === 'snowball' ? 1.9 : 1.6;
      const ball = part(GEO.sphere, std('#ffffff', { map: toTexture(c), roughness: 0.5 }), g, 0, r, 0, r);
      g.userData.roll = ball;
      g.userData.r = r;
    } else if (art === 'suitcase') {
      const col = pickR(['#ff3d7f', '#18b4ff', '#ffd400']);
      const b = new T.Group();
      g.add(b);
      part(GEO.box, M(col), b, 0, 1.1, 0, 2.2, 1.6, 0.9);
      part(GEO.box, M('#14121f'), b, 0, 2.05, 0, 0.8, 0.25, 0.2);
      for (const x of [-0.8, 0.8]) part(GEO.cyl, M('#14121f'), b, x, 0.2, 0, 0.18, 0.2, 0.18, Math.PI / 2);
      g.userData.wobble = b;
    } else if (art === 'crab') {
      const red = M('#ff4b3a');
      part(GEO.lowSphere, red, g, 0, 0.6, 0, 1, 0.5, 0.7);
      for (const s of [-1, 1]) {
        part(GEO.lowSphere, red, g, s * 1.2, 0.8, 0.5, 0.35, 0.3, 0.3);
        for (let i = 0; i < 3; i++) part(GEO.cyl, red, g, s * 0.9, 0.3, -0.3 + i * 0.3, 0.06, 0.6, 0.06, 0, 0, s * 0.8);
        part(GEO.lowSphere, M('#ffffff'), g, s * 0.3, 1.15, 0.3, 0.16);
        part(GEO.lowSphere, M('#14121f'), g, s * 0.3, 1.18, 0.42, 0.08);
      }
      g.userData.scuttle = true;
    } else if (art === 'donut') {
      const d = part(GEO.torus, M('#e0a050'), g, 0, 1.6, 0, 1.2, 1.2, 1.2);
      const icing = part(GEO.torus, M('#ff7ab8'), g, 0, 1.75, 0, 1.2, 1.2, 0.9);
      g.userData.roll = new T.Group();
      g.remove(d, icing);
      g.userData.roll.add(d, icing);
      d.position.y = icing.position.y = 0;
      g.userData.roll.position.y = 1.6;
      g.add(g.userData.roll);
    } else if (art === 'taxi') {
      const body = new T.Group();
      g.add(body);
      part(GEO.box, M('#ffd400'), body, 0, 0.9, 0, 4.2, 1.1, 2.1);
      part(GEO.box, M('#ffd400'), body, -0.2, 1.75, 0, 2.4, 0.8, 1.9);
      part(GEO.box, M('#9fd8ff', { emissive: '#3a5a7a' }), body, -0.2, 1.75, 0, 2.2, 0.6, 1.95);
      part(GEO.box, M('#14121f'), body, -0.2, 2.25, 0, 0.9, 0.3, 0.5);
      for (const x of [-1.4, 1.4]) for (const z of [-1, 1]) part(GEO.cyl, M('#14121f'), body, x, 0.4, z, 0.4, 0.3, 0.4, Math.PI / 2);
      part(GEO.box, M('#fff6d0', { emissive: '#ffffff' }), body, 2.12, 0.95, 0.6, 0.05, 0.25, 0.4);
      part(GEO.box, M('#fff6d0', { emissive: '#ffffff' }), body, 2.12, 0.95, -0.6, 0.05, 0.25, 0.4);
      g.userData.car = body;
    }
    return g;
  }

  function zoneArt(z) {
    const col = { puddle: '#5ab0ff', sand: '#e8c070', choc: '#5a3018', ice: '#cfeeff' }[z.art] || '#5ab0ff';
    const m = new T.Mesh(new T.CircleGeometry(z.r, 28), std(col, { transparent: true, opacity: z.art === 'ice' ? 0.75 : 0.85, roughness: z.art === 'ice' || z.art === 'puddle' ? 0.1 : 0.9, metalness: z.art === 'ice' ? 0.2 : 0 }));
    m.rotation.x = -Math.PI / 2;
    m.scale.set(1, 0.75, 1);
    m.rotation.z = Math.atan2(z.tz, z.tx);
    m.position.set(z.x, z.y + 0.035, z.z);
    return m;
  }

  // ------------------------------------------------------------------ building a track

  Art.theme = (id) => THEMES[id];

  Art.buildTrack = function (trk) {
    seed = trk.id.length * 977 + 13;
    const th = THEMES[trk.id];
    const root = new T.Group();
    const statics = new T.Group();
    const M0 = trk.paths[0];
    // the ground: a big plate under everything, raised into hills where the road climbs
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (let i = 0; i < M0.n; i++) {
      x0 = Math.min(x0, M0.x[i]); x1 = Math.max(x1, M0.x[i]); z0 = Math.min(z0, M0.z[i]); z1 = Math.max(z1, M0.z[i]);
    }
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, size = Math.max(x1 - x0, z1 - z0) + 700;
    const segs = 90;
    const gGeo = new T.PlaneGeometry(size, size, segs, segs);
    gGeo.rotateX(-Math.PI / 2);
    const gp = gGeo.attributes.position;
    const hasHills = M0.y.some((v) => Math.abs(v) > 0.5);
    const sampleIdx = [];
    for (let i = 0; i < M0.n; i += 4) sampleIdx.push(i);
    for (let v = 0; v < gp.count; v++) {
      const x = gp.getX(v) + cx, z = gp.getZ(v) + cz;
      let y = -0.4;
      if (hasHills) {
        // the hill: heights blended from the road nearby (inverse distance), fading out far away
        let wsum = 0, ysum = 0, dmin = Infinity;
        for (const i of sampleIdx) {
          const d2 = (M0.x[i] - x) ** 2 + (M0.z[i] - z) ** 2 + 1;
          dmin = Math.min(dmin, d2);
          const w = 1 / (d2 * d2);
          wsum += w;
          ysum += w * M0.y[i];
        }
        const d = Math.sqrt(dmin);
        y = (ysum / wsum) * Math.exp(-Math.max(0, d - 30) / 90) - 0.6 - Math.min(2.5, d / 40);
      }
      gp.setXYZ(v, x, y, z);
    }
    gGeo.computeVertexNormals();
    const gTex = groundTex(th.ground, th.ground2, trk.id === 'snow' ? 'snow' : trk.id === 'backyard' || trk.id === 'candy' ? 'grass' : 'flat').clone();
    gTex.needsUpdate = true;
    gTex.repeat.set(size / 12, size / 12);
    const uv = gGeo.attributes.uv;
    for (let v = 0; v < uv.count; v++) uv.setXY(v, uv.getX(v), uv.getY(v));
    const ground = new T.Mesh(gGeo, std('#ffffff', { map: gTex }));
    root.add(ground);
    if (th.ocean) {
      const sea = new T.Mesh(new T.PlaneGeometry(size * 2, size), std('#1e9be8', { roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.92 }));
      sea.rotation.x = -Math.PI / 2;
      sea.position.set(cx, -0.25, z1 + size / 2 + 40);
      root.add(sea);
    }

    // roads, grass strips, curbs and walls for every path
    const vergeTex = groundTex(th.verge, shade(th.verge, -0.08), 'flat');
    const roadMat = std('#ffffff', { map: roadTex(th), roughness: 0.85 });
    for (const P of trk.paths) {
      const main = P.closed;
      const off = main ? 0 : 0.012;
      const vg = ribbon(P, (j) => -(P.hw[j] + P.verge), (j) => P.hw[j] + P.verge, -0.05 + off, 8, (P.hw[0] * 2 + P.verge * 2) / 8);
      root.add(new T.Mesh(vg, std('#ffffff', { map: vergeTex, polygonOffset: true, polygonOffsetFactor: main ? 2 : 1, polygonOffsetUnits: main ? 2 : 1 })));
      let mat = roadMat;
      if (!main) mat = std('#ffffff', { map: surfaceTex(P.surface === 'road' ? 'alley' : P.surface), roughness: P.surface === 'water' ? 0.2 : 0.85, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1, transparent: P.surface === 'water', opacity: P.surface === 'water' ? 0.92 : 1 });
      const rd = ribbon(P, (j) => -P.hw[j], (j) => P.hw[j], off, main ? 16 : 8, main ? 1 : 2);
      const roadMesh = new T.Mesh(rd, mat);
      root.add(roadMesh);
      if (main) {
        const curb = std('#ffffff', { map: stripeTex(th.curb[0], th.curb[1]), polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
        root.add(new T.Mesh(ribbon(P, (j) => -P.hw[j] - 0.9, (j) => -P.hw[j], 0.02, 3, 1), curb));
        root.add(new T.Mesh(ribbon(P, (j) => P.hw[j], (j) => P.hw[j] + 0.9, 0.02, 3, 1), curb));
      }
      const wallH = { fence: 1.6, tiles: 3.4, rope: 1.3, snowbank: 1.2, cane: 1.4, barrier: 1.1 }[th.wall] || 1.3;
      const wTex = wallTex(th.wall);
      const wMat = std('#ffffff', { map: wTex, side: T.DoubleSide, transparent: th.wall === 'rope' || th.wall === 'cane', alphaTest: 0.3 });
      for (const side of [-1, 1]) root.add(new T.Mesh(wallGeo(trk, P, side, wallH, wallH * 4), wMat));
    }

    // the start line and the arch with the game's name
    const sl = new T.Mesh(new T.PlaneGeometry(M0.hw[0] * 2, 2.4), std('#ffffff', { map: checkerTex(), polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    sl.material.map.repeat.set(M0.hw[0] / 2, 1);
    sl.rotation.x = -Math.PI / 2;
    sl.rotation.z = -Math.atan2(M0.tz[0], M0.tx[0]) + Math.PI / 2;
    sl.position.set(M0.x[0], M0.y[0] + 0.03, M0.z[0]);
    root.add(sl);
    root.add(startArch(M0, th));

    // ramps, trampolines and humps
    for (const r of trk.ramps) root.add(rampMesh(trk, r, th));
    // boost arrows
    const arrows = [];
    for (const p of trk.pads) {
      const a = new T.Mesh(new T.PlaneGeometry(3.4, 5), std('#ffffff', { map: arrowTex().clone(), emissive: '#ff8a1f', emissiveIntensity: 0.5, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
      a.material.map.needsUpdate = true;
      a.material.emissiveMap = a.material.map;
      a.rotation.x = -Math.PI / 2;
      a.rotation.z = -Math.atan2(p.tz, p.tx) - Math.PI / 2;
      a.position.set(p.x, p.y + 0.04, p.z);
      root.add(a);
      arrows.push(a);
    }
    for (const z of trk.zones) root.add(zoneArt(z));
    for (const p of trk.posts) {
      const g = new T.Group();
      (POSTS[p.art] || POSTS.cone)(g);
      g.position.set(p.x, p.y, p.z);
      g.rotation.y = rr(0, TAU);
      statics.add(g);
    }
    const movers = trk.movers.map((m) => {
      const g = moverArt(m.art);
      g.position.set(m.x, m.y, m.z);
      root.add(g);
      return g;
    });

    // scenery along both sides, outside the walls, never on a road
    const glows = [];
    const q = {};
    const spots = [];
    for (let s = 0; s < M0.len; s += th.ceiling ? 9 : 11) {
      for (const side of [-1, 1]) {
        if (rnd() < 0.25) continue;
        const p = G.pointAt(trk, 0, s + rr(-3, 3));
        const out = p.hw + M0.verge + (th.ceiling && side ? rr(2.5, 4) : rr(4, th.props.includes('building') ? 22 : 30));
        const x = p.x - p.tz * out * side, z = p.z + p.tx * out * side;
        G.query(trk, x, z, -1, q);
        if (q.path >= 0 && q.excess < 6) continue;
        if (spots.some((o) => (o[0] - x) ** 2 + (o[1] - z) ** 2 < 49)) continue;
        spots.push([x, z]);
        const kind = th.ceiling ? (rnd() < 0.7 ? 'pillar' : pickR(th.props)) : pickR(th.props);
        const g = new T.Group();
        const rad = PROPS[kind](g);
        if (q.path >= 0 && q.excess < rad + 2) continue;
        g.position.set(x, groundY(trk, M0, x, z, hasHills), z);
        g.rotation.y = kind === 'train' || kind === 'building' || kind === 'house' ? Math.atan2(p.tx, p.tz) : rr(0, TAU);
        statics.add(g);
        if (g.userData.glow) glows.push(g.localToWorld(new T.Vector3(...g.userData.glow)));
      }
    }
    // the subway's ceiling beams and light strips over the road
    if (th.ceiling) {
      for (let s = 0; s < M0.len; s += 18) {
        const p = G.pointAt(trk, 0, s);
        const g = new T.Group();
        const w = (p.hw + M0.verge) * 2 + 6;
        part(GEO.box, M('#3a3f4c'), g, 0, 10, 0, w, 0.8, 1.2);
        part(GEO.box, M('#ffffff', { emissive: '#dfe9ff', emissiveIntensity: 1 }), g, 0, 9.55, 0, w * 0.5, 0.12, 0.5);
        g.position.set(p.x, p.y, p.z);
        g.rotation.y = -Math.atan2(p.tz, p.tx) + Math.PI / 2;
        statics.add(g);
      }
    }
    statics.updateMatrixWorld(true);
    const { merged } = mergeStatic(statics);
    root.add(merged);
    // lamp glows (night tracks)
    if (glows.length) {
      const sm = new T.SpriteMaterial({ map: Kit.gfx.glowTexture(), color: '#ffe9a8', transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: 0.8 });
      for (const v of glows) {
        const s = new T.Sprite(sm);
        s.position.copy(v);
        s.scale.set(3.5, 3.5, 1);
        root.add(s);
      }
    }
    // stars in the night sky
    if (th.stars) {
      const pts = [];
      for (let i = 0; i < 500; i++) {
        const a = rr(0, TAU), e = rr(0.15, 1.2), R = 380;
        pts.push(cx + Math.cos(a) * Math.cos(e) * R, Math.sin(e) * R * 0.6, cz + Math.sin(a) * Math.cos(e) * R);
      }
      const geo = new T.BufferGeometry();
      geo.setAttribute('position', new T.Float32BufferAttribute(pts, 3));
      root.add(new T.Points(geo, new T.PointsMaterial({ color: '#ffffff', size: 1.6, sizeAttenuation: false, fog: false })));
    }
    return { root, arrows, movers, theme: th, sky: skyTex(th), center: [cx, cz], size };
  };

  function groundY(trk, M0, x, z, hills) {
    if (!hills) return -0.4;
    let best = Infinity, y = 0;
    for (let i = 0; i < M0.n; i += 3) {
      const d = (M0.x[i] - x) ** 2 + (M0.z[i] - z) ** 2;
      if (d < best) { best = d; y = M0.y[i]; }
    }
    return y - 0.6 - Math.min(2.5, Math.sqrt(best) / 40);
  }

  function startArch(P, th) {
    const g = new T.Group();
    const w = P.hw[0] + P.verge * 0.5;
    const pillar = M(th.curb[0]);
    part(GEO.box, pillar, g, -w, 3.5, 0, 0.9, 7, 0.9);
    part(GEO.box, pillar, g, w, 3.5, 0, 0.9, 7, 0.9);
    const [c, x] = makeCanvas(1024, 128);
    x.fillStyle = '#14121f';
    x.fillRect(0, 0, 1024, 128);
    x.fillStyle = '#ffd400';
    x.fillRect(0, 0, 1024, 10);
    x.fillRect(0, 118, 1024, 10);
    x.font = `88px ${FONT}`;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillStyle = '#ffd400';
    x.fillText('🏁 ' + KART.TITLE.toUpperCase() + ' 🏁', 512, 68);
    const banner = new T.Mesh(new T.BoxGeometry(w * 2 + 0.9, 2, 0.4), [M('#14121f'), M('#14121f'), M('#14121f'), M('#14121f'), std('#ffffff', { map: toTexture(c) }), std('#ffffff', { map: toTexture(c) })]);
    banner.position.set(0, 6.6, 0);
    g.add(banner);
    g.position.set(P.x[0], P.y[0], P.z[0]);
    g.rotation.y = -Math.atan2(P.tz[0], P.tx[0]) + Math.PI / 2;
    return g;
  }

  function rampMesh(trk, r, th) {
    const P = trk.paths[r.path];
    const g = new T.Group();
    if (r.kind === 'bounce') {
      // a backyard trampoline: a round mat on a ring of springs
      const p = G.pointAt(trk, r.path, (r.s0 + r.s1) / 2);
      const lat = (r.lat0 + r.lat1) / 2;
      const rad = (r.lat1 - r.lat0) / 2;
      const ring = part(GEO.cyl, M('#14121f'), g, 0, 0.12, 0, rad + 0.4, 0.24, rad + 0.4);
      ring.userData.keep = true;
      const mat = new T.Mesh(new T.CircleGeometry(rad, 28), std('#2a7bd6', { roughness: 0.6 }));
      mat.rotation.x = -Math.PI / 2;
      mat.position.y = 0.26;
      g.add(mat);
      const star = new T.Mesh(new T.CircleGeometry(rad * 0.45, 5), std('#ffd400', { emissive: '#ffb800', emissiveIntensity: 0.4 }));
      star.rotation.x = -Math.PI / 2;
      star.position.y = 0.27;
      g.add(star);
      g.position.set(p.x - p.tz * lat, p.y, p.z + p.tx * lat);
      return g;
    }
    // a wedge (or a hump) between s0 and s1 across lat0..lat1
    const n = 10, pos = [], uv = [], idx = [];
    const h = (u) => (r.kind === 'bump' ? r.h * Math.sin(u * Math.PI) : r.h * u);
    for (let i = 0; i <= n; i++) {
      const u = i / n, s = r.s0 + (r.s1 - r.s0) * u;
      const p = G.pointAt(trk, r.path, s);
      for (const [k, lat] of [[0, r.lat0], [1, r.lat1]]) {
        pos.push(p.x - p.tz * lat, p.y + h(u) + 0.02, p.z + p.tx * lat);
        uv.push(k * (r.lat1 - r.lat0) / 3, s / 3);
      }
      if (i < n) idx.push(i * 2, i * 2 + 2, i * 2 + 1, i * 2 + 1, i * 2 + 2, i * 2 + 3);
    }
    // the front face of a kicker
    if (r.kind !== 'bump') {
      const p = G.pointAt(trk, r.path, r.s1);
      const b = pos.length / 3;
      for (const lat of [r.lat0, r.lat1]) {
        pos.push(p.x - p.tz * lat, p.y + r.h + 0.02, p.z + p.tx * lat);
        uv.push(0, 0);
        pos.push(p.x - p.tz * lat, p.y - 0.1, p.z + p.tx * lat);
        uv.push(0, 1);
      }
      idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    g.add(new T.Mesh(geo, std('#ffffff', { map: chevronTex(th.ramp), side: T.DoubleSide })));
    return g;
  }

  // ------------------------------------------------------------------ karts

  function plateTex(letter, col) {
    const [c, g] = makeCanvas(64, 64);
    g.fillStyle = '#ffffff';
    roundRect(g, 2, 2, 60, 60, 14);
    g.fill();
    g.lineWidth = 5;
    g.strokeStyle = col;
    g.stroke();
    g.font = `40px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#14121f';
    g.fillText(letter, 32, 36);
    return toTexture(c);
  }

  const wheelGeo = new T.CylinderGeometry(0.42, 0.42, 0.36, 16);
  wheelGeo.rotateZ(Math.PI / 2);

  // A chunky go-kart with a character in it. The kart faces -z (like the kit's people); its origin is on the ground.
  Art.kart = function (entry, opts) {
    const o = opts || {};
    const root = new T.Group();
    const body = new T.Group();
    root.add(body);
    const look = entry.look;
    const col = o.color || look.top || '#ff3d7f';
    const paint = M(col, { roughness: 0.45, metalness: 0.1 });
    // the parts that never move are built in `chassis` and merged into one mesh per material at the end
    const chassis = new T.Group();
    const dark = M('#23222c');
    const trim = M(look.shoes || '#ffd400', { roughness: 0.5 });
    // chassis, nose, side pods, seat, bumpers
    part(GEO.box, dark, chassis, 0, 0.32, 0, 1.5, 0.16, 2.5);
    part(GEO.box, paint, chassis, 0, 0.55, -0.55, 1.15, 0.36, 1.3);
    const nose = part(GEO.box, paint, chassis, 0, 0.5, -1.35, 1.25, 0.3, 0.5);
    nose.rotation.x = 0.15;
    part(GEO.box, trim, chassis, 0, 0.42, -1.65, 1.6, 0.22, 0.22);
    part(GEO.box, paint, chassis, -0.78, 0.52, 0.15, 0.32, 0.34, 1.5);
    part(GEO.box, paint, chassis, 0.78, 0.52, 0.15, 0.32, 0.34, 1.5);
    part(GEO.box, trim, chassis, 0, 0.45, 1.28, 1.7, 0.25, 0.2);
    part(GEO.box, dark, chassis, 0, 0.62, 0.82, 0.9, 0.55, 0.18);
    // the steering wheel
    const wheel = new T.Group();
    wheel.position.set(0, 0.98, -0.62);
    wheel.rotation.x = -0.9;
    part(GEO.torus, dark, wheel, 0, 0, 0, 0.22, 0.22, 0.22);
    part(GEO.box, dark, wheel, 0, 0, 0, 0.36, 0.05, 0.05);
    body.add(wheel);
    part(GEO.cyl, dark, chassis, 0, 0.8, -0.8, 0.04, 0.5, 0.04, -0.9);
    // the number plate with the first letter of the name
    const plate = new T.Mesh(new T.PlaneGeometry(0.5, 0.5), new T.MeshStandardMaterial({ map: plateTex(entry.name[0], col), roughness: 0.6 }));
    plate.position.set(0, 0.72, -1.43);
    plate.rotation.set(-0.35, Math.PI, 0);
    plate.rotation.y = 0;
    plate.rotation.x = -Math.PI / 2 + 0.95;
    plate.position.y = 0.68;
    plate.scale.set(1, 1, 1);
    plate.rotateY(Math.PI);
    body.add(plate);
    // exhaust pipes
    const pipes = [];
    for (const x of [-0.35, 0.35]) pipes.push(part(GEO.cyl, M('#b8bcc8', { metalness: 0.6, roughness: 0.3 }), body, x, 0.5, 1.42, 0.09, 0.3, 0.09, Math.PI / 2));
    // fat wheels
    const wheels = [];
    for (const [x, z, front] of [[-0.86, -1.0, 1], [0.86, -1.0, 1], [-0.88, 0.9, 0], [0.88, 0.9, 0]]) {
      const w = new T.Group();
      w.position.set(x, 0.42, z);
      const tyre = new T.Mesh(wheelGeo, dark);
      tyre.scale.set(front ? 0.85 : 1, front ? 0.88 : 1, front ? 0.88 : 1);
      w.add(tyre);
      const hub = part(GEO.cyl, trim, w, x > 0 ? 0.17 : -0.17, 0, 0, 0.2, 0.06, 0.2, 0, 0, Math.PI / 2);
      hub.userData.hub = true;
      w.userData.front = !!front;
      body.add(w);
      wheels.push(w);
    }
    const { merged } = mergeStatic(chassis);
    body.add(merged);
    // the driver, sitting
    const p = Kit.people.build(look);
    const ps = 0.66;
    p.root.scale.setScalar(ps);
    p.root.position.set(0, 0.16, 0.32);
    body.add(p.root);
    seat(p, 1, 0);
    // a soft round shadow
    const sh = new T.Mesh(new T.PlaneGeometry(2.4, 3.2), new T.MeshBasicMaterial({ map: shadowTex(), transparent: true, depthWrite: false, opacity: 0.55 }));
    sh.rotation.x = -Math.PI / 2;
    sh.position.y = 0.04;
    sh.renderOrder = -1;
    root.add(sh);
    if (o.scale) root.scale.setScalar(o.scale);
    return { root, body, wheels, wheel, person: p, pipes, shadow: sh, entry };
  };

  function shadowTex() {
    return cached('shadow', () => Kit.gfx.radialTexture(64, [[0, 'rgba(0,0,0,0.75)'], [0.6, 'rgba(0,0,0,0.35)'], [1, 'rgba(0,0,0,0)']]));
  }

  // Sit a person in the kart: legs forward, hands on the wheel (steer -1..1 turns the arms a little).
  // `upper` (a kit pose name) moves only the arms and body, for the companion's signature moves.
  function seat(p, k, steer, upper, ph) {
    const to = (o, prop, v) => { o[prop] += (v - o[prop]) * k; };
    if (upper) {
      Kit.people.pose(p, ph || 0, upper, k);
    } else {
      to(p.armL.rotation, 'x', 1.25 + steer * 0.25);
      to(p.armR.rotation, 'x', 1.25 - steer * 0.25);
      to(p.armL.rotation, 'z', -0.12);
      to(p.armR.rotation, 'z', 0.12);
      to(p.hips.rotation, 'x', -0.05);
      to(p.hips.rotation, 'y', 0);
      to(p.head.rotation, 'x', 0.05);
      if (p.fingers) for (const f of p.fingers) f.visible = false;
    }
    to(p.legL.rotation, 'x', 1.45);
    to(p.legR.rotation, 'x', 1.45);
    to(p.head.rotation, 'y', -steer * 0.35);
    p.hips.position.y = p.hipY;
    p.rig.position.y = 0.55;
    p.rig.scale.setScalar(1);
  }
  Art.seat = seat;

  // ------------------------------------------------------------------ boxes and items

  Art.itemBox = function () {
    const m = new T.Mesh(new T.BoxGeometry(1.5, 1.5, 1.5), new T.MeshStandardMaterial({ map: boxTex(), transparent: true, opacity: 0.88, roughness: 0.3, emissive: '#ffffff', emissiveIntensity: 0.25 }));
    m.material.emissiveMap = m.material.map;
    return m;
  };

  const spriteCache = {};
  Art.emojiSprite = function (emoji, size) {
    const mat = spriteCache[emoji] || (spriteCache[emoji] = new T.SpriteMaterial({ map: emojiTexture(emoji), transparent: true, depthWrite: false }));
    const s = new T.Sprite(mat);
    s.scale.set(size, size, 1);
    return s;
  };

  Art.item = function (kind) {
    const g = new T.Group();
    if (kind === 'ball') {
      const [c, x] = makeCanvas(128, 64);
      x.fillStyle = '#ff7a1a';
      x.fillRect(0, 0, 128, 64);
      x.strokeStyle = '#3a1a08';
      x.lineWidth = 3;
      for (const xx of [32, 64, 96]) { x.beginPath(); x.moveTo(xx, 0); x.lineTo(xx, 64); x.stroke(); }
      x.beginPath(); x.moveTo(0, 32); x.lineTo(128, 32); x.stroke();
      const b = part(GEO.sphere, std('#ffffff', { map: toTexture(c), roughness: 0.6 }), g, 0, 0, 0, 0.75);
      g.userData.spin = b;
    } else if (kind === 'bubble') {
      const b = part(GEO.sphere, new T.MeshStandardMaterial({ color: '#bff4ff', transparent: true, opacity: 0.38, roughness: 0.05, metalness: 0.3, emissive: '#5ad8ff', emissiveIntensity: 0.25, depthWrite: false }), g, 0, 0, 0, 1.2);
      b.renderOrder = 2;
      const hl = part(GEO.lowSphere, new T.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.7 }), g, -0.45, 0.5, 0.6, 0.18);
      hl.userData.keep = true;
    } else if (kind === 'banana') {
      const s = Art.emojiSprite('🍌', 1.5);
      s.position.y = 0.6;
      g.add(s);
    }
    return g;
  };

  // a bubble big enough to hold a kart (the bubble item's catch), and the rainbow peace shield
  Art.kartBubble = function () {
    const m = new T.Mesh(GEO.sphere, new T.MeshStandardMaterial({ color: '#c8f6ff', transparent: true, opacity: 0.32, roughness: 0.05, metalness: 0.3, emissive: '#5ad8ff', emissiveIntensity: 0.3, depthWrite: false }));
    m.scale.setScalar(2.1);
    m.renderOrder = 3;
    return m;
  };
  Art.shield = function () {
    const [c, x] = makeCanvas(256, 128);
    const gr = x.createLinearGradient(0, 0, 0, 128);
    ['#ff3d7f', '#ff8a1f', '#ffd400', '#7dff5a', '#18d4ff', '#b06bff'].forEach((col, i) => gr.addColorStop(i / 5, col));
    x.fillStyle = gr;
    x.fillRect(0, 0, 256, 128);
    const m = new T.Mesh(GEO.sphere, new T.MeshBasicMaterial({ map: toTexture(c), transparent: true, opacity: 0.32, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending }));
    m.scale.setScalar(2.2);
    m.renderOrder = 3;
    return m;
  };

  Art.THEMES = THEMES;
  window.KartArt = Art;
})();
