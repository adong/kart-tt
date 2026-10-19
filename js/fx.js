/* TT Kart: little effects. Sparks (drift: blue, then orange), boost flames, dust and splashes, confetti, a thrown
   treat that arcs from the brother's kart to yours, and dizzy stars that circle a spun kart's driver.
   KartFx.create(scene) returns the makers; call fx.update(dt) every frame. */
(function () {
  'use strict';
  const T = THREE;
  const TAU = Math.PI * 2;

  function create(scene) {
    const glow = Kit.gfx.glowTexture();
    const mats = {};
    const mat = (color, add) => {
      const key = color + (add ? '+' : '');
      return mats[key] || (mats[key] = new T.SpriteMaterial({ map: glow, color, transparent: true, depthWrite: false, blending: add ? T.AdditiveBlending : T.NormalBlending }));
    };
    const pool = [];
    const live = [];
    function sprite(m) {
      const s = pool.pop() || new T.Sprite();
      s.material = m;
      s.visible = true;
      scene.add(s);
      return s;
    }
    function add(m, x, y, z, vx, vy, vz, life, size, grow, grav) {
      const s = sprite(m);
      s.position.set(x, y, z);
      s.scale.set(size, size, 1);
      live.push({ s, vx, vy, vz, life, max: life, size, grow: grow || 0, grav: grav || 0 });
    }
    // emoji sprites that fly from one place to another (the treat)
    const fliers = [];

    const fx = {
      spark(x, y, z, color) {
        add(mat(color, true), x, y, z, (Math.random() - 0.5) * 4, 2 + Math.random() * 3, (Math.random() - 0.5) * 4, 0.3, 0.45, -1, 12);
      },
      flame(x, y, z, vx, vz) {
        add(mat(Math.random() < 0.5 ? '#ff8a1f' : '#ffd400', true), x, y, z, vx + (Math.random() - 0.5), 0.6, vz + (Math.random() - 0.5), 0.22, 0.7, -2);
      },
      dust(x, y, z, color) {
        add(mat(color || '#d8cbb0'), x, y + 0.3, z, (Math.random() - 0.5) * 2, 0.8 + Math.random(), (Math.random() - 0.5) * 2, 0.6, 0.8, 2.2);
      },
      splash(x, y, z) {
        for (let i = 0; i < 3; i++) add(mat('#bfefff'), x, y + 0.3, z, (Math.random() - 0.5) * 5, 3 + Math.random() * 3, (Math.random() - 0.5) * 5, 0.5, 0.5, 0.5, 14);
      },
      burst(x, y, z, color, n) {
        for (let i = 0; i < (n || 16); i++) {
          const a = Math.random() * TAU, e = Math.random() * 1.2;
          const v = 5 + Math.random() * 5;
          add(mat(color || '#ffd400', true), x, y, z, Math.cos(a) * Math.cos(e) * v, Math.sin(e) * v + 2, Math.sin(a) * Math.cos(e) * v, 0.6, 0.7, -0.8, 9);
        }
      },
      confetti(x, y, z) {
        const cols = ['#ff3d7f', '#ffd400', '#18d4ff', '#7dff5a', '#b06bff', '#ffffff'];
        for (let i = 0; i < 40; i++) {
          const a = Math.random() * TAU;
          const v = 3 + Math.random() * 6;
          add(mat(cols[i % cols.length]), x, y, z, Math.cos(a) * v, 6 + Math.random() * 6, Math.sin(a) * v, 1.6, 0.45, 0, 9);
        }
      },
      // an emoji that arcs from `from()` to `to()` (functions returning Vector3s, so it lands on a moving kart)
      toss(emoji, from, to, dur, done) {
        const s = KartArt.emojiSprite(emoji, 1.3);
        scene.add(s);
        fliers.push({ s, from, to, t: 0, dur: dur || 0.7, done });
      },
      update(dt) {
        for (let i = live.length - 1; i >= 0; i--) {
          const p = live[i];
          p.life -= dt;
          if (p.life <= 0) {
            scene.remove(p.s);
            pool.push(p.s);
            live.splice(i, 1);
            continue;
          }
          p.vy -= p.grav * dt;
          p.s.position.x += p.vx * dt;
          p.s.position.y += p.vy * dt;
          p.s.position.z += p.vz * dt;
          const f = p.life / p.max;
          const sz = Math.max(0.05, p.size + p.grow * (1 - f));
          p.s.scale.set(sz, sz, 1);
          p.s.material.opacity = 1;
          p.s.visible = true;
        }
        for (let i = fliers.length - 1; i >= 0; i--) {
          const f = fliers[i];
          f.t += dt;
          const u = Math.min(1, f.t / f.dur);
          const a = f.from(), b = f.to();
          f.s.position.set(a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u + Math.sin(u * Math.PI) * 3, a.z + (b.z - a.z) * u);
          f.s.material.rotation = u * 6;
          if (u >= 1) {
            scene.remove(f.s);
            fliers.splice(i, 1);
            if (f.done) f.done(b);
          }
        }
      },
      clear() {
        for (const p of live) { scene.remove(p.s); pool.push(p.s); }
        live.length = 0;
        for (const f of fliers) scene.remove(f.s);
        fliers.length = 0;
      },
    };
    return fx;
  }

  // dizzy stars that circle a head: add the group to the kart, call spinStars(g, t) each frame
  function dizzy() {
    const g = new T.Group();
    const m = new T.SpriteMaterial({ map: Kit.gfx.emojiTexture('⭐'), transparent: true, depthWrite: false });
    for (let i = 0; i < 4; i++) {
      const s = new T.Sprite(m);
      s.scale.set(0.5, 0.5, 1);
      g.add(s);
    }
    g.visible = false;
    return g;
  }
  function spinStars(g, t) {
    g.children.forEach((s, i) => {
      const a = t * 5 + (i / g.children.length) * TAU;
      s.position.set(Math.cos(a) * 0.75, Math.sin(t * 7 + i) * 0.1, Math.sin(a) * 0.75);
    });
  }

  window.KartFx = { create, dizzy, spinStars };
})();
