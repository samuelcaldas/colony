/* ===== VoxelScene: procedural Three.js arena (tray, voxel mosaic, anthill, ants) ===== */
const VoxelScene = (() => {
  const TRAY = 6.3, HOLE_Z = 7.7, SPAWN_Z = 10.6, GROUND = -0.3, ANT = 0.62, MAX_ANTS = 120;

  function rrShape(w, h, r) {
    const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    return s;
  }
  const flat = (geo) => { geo.rotateX(-Math.PI / 2); return geo; };
  function cubeGeometry(a, h) {
    const b = a * 0.12;
    const g = new THREE.ExtrudeGeometry(rrShape(a - 2 * b, a - 2 * b, a * 0.14), { depth: h - 2 * b, bevelEnabled: true, bevelSize: b, bevelThickness: b, bevelSegments: 2, curveSegments: 3 });
    flat(g); g.translate(0, b, 0);
    return g;
  }
  function merge(parts) {
    const pos = [], nor = [];
    for (const [geo, m] of parts) {
      const g = geo.toNonIndexed(); g.applyMatrix4(m);
      for (const v of g.attributes.position.array) pos.push(v);
      for (const v of g.attributes.normal.array) nor.push(v);
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    return out;
  }
  const M = (px, py, pz, sx, sy, sz, rx = 0, rz = 0) => new THREE.Matrix4().compose(
    new THREE.Vector3(px, py, pz), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, 0, rz)), new THREE.Vector3(sx, sy, sz));
  /** Drop collinear / duplicate waypoints. */
  function simplify(pts) {
    const out = [];
    for (const p of pts) {
      const n = out.length;
      if (n && Math.hypot(p.x - out[n - 1].x, p.z - out[n - 1].z) < 1e-3) continue;
      if (n >= 2) {
        const a = out[n - 2], b = out[n - 1];
        const cr = (b.x - a.x) * (p.z - b.z) - (b.z - a.z) * (p.x - b.x), dot = (b.x - a.x) * (p.x - b.x) + (b.z - a.z) * (p.z - b.z);
        if (Math.abs(cr) < 1e-4 && dot > 0) { out[n - 1] = p; continue; }
      }
      out.push(p);
    }
    return out;
  }
  const easeOutBack = (k) => { const c = 1.9; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };

  /** Ant = 3 scaled spheres (head, thorax, abdomen) + antennae, eyes and two tripod leg sets. Faces +Z. */
  function antGeometries() {
    const sph = new THREE.SphereGeometry(1, 12, 9), rod = new THREE.CylinderGeometry(0.03, 0.03, 1, 5);
    const body = merge([
      [sph, M(0, 0.36, -0.55, 0.34, 0.3, 0.42)], [sph, M(0, 0.34, 0, 0.24, 0.22, 0.28)], [sph, M(0, 0.44, 0.42, 0.3, 0.28, 0.28)],
      [rod, M(0.13, 0.82, 0.52, 1, 0.42, 1, 0.5, -0.3)], [rod, M(-0.13, 0.82, 0.52, 1, 0.42, 1, 0.5, 0.3)],
      [sph, M(0.19, 1.0, 0.62, 0.06, 0.06, 0.06)], [sph, M(-0.19, 1.0, 0.62, 0.06, 0.06, 0.06)],
    ]);
    const eyes = merge([[sph, M(0.13, 0.52, 0.64, 0.1, 0.1, 0.1)], [sph, M(-0.13, 0.52, 0.64, 0.1, 0.1, 0.1)]]);
    const pupils = merge([[sph, M(0.13, 0.52, 0.72, 0.055, 0.055, 0.055)], [sph, M(-0.13, 0.52, 0.72, 0.055, 0.055, 0.055)]]);
    const leg = (side, z) => [rod, M(side * 0.36, 0.17, z, 1, 0.5, 1, 0, side * 1.05)];
    const legsA = merge([leg(1, 0.22), leg(-1, 0), leg(1, -0.22)]);
    const legsB = merge([leg(-1, 0.22), leg(1, 0), leg(-1, -0.22)]);
    return { body, eyes, pupils, legsA, legsB };
  }

  return class VoxelScene {
    constructor(mount, hooks) {
      this.mount = mount; this.hooks = hooks; this.speed = 1; this.time = 0;
      this.ants = []; this.pool = []; this.queues = new Map(); this.tweens = []; this.cubes = []; this.round = 0;
      this.idleT = 0; this.mats = new Map(); this.W = 1; this.H = 1; this.s = 1; this.h = 1; this.palette = [];
      const r = (this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }));
      r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
      r.domElement.style.cssText = 'width:100%;height:100%;display:block';
      mount.appendChild(r.domElement);
      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(30, 1, 1, 200);
      this.scene.add(new THREE.HemisphereLight(0xffffff, 0x9ad0a8, 0.72));
      const sun = new THREE.DirectionalLight(0xffffff, 0.62);
      sun.position.set(7, 20, 9); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
      Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 60 });
      sun.shadow.bias = -0.0006; sun.shadow.radius = 3;
      this.scene.add(sun);
      this.buildArena();
      this.antGeo = antGeometries();
      this.white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
      this.black = new THREE.MeshStandardMaterial({ color: 0x15151c, roughness: 0.4 });
      this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(mount); this.resize();
      let last = performance.now();
      const loop = (t) => { this.raf = requestAnimationFrame(loop); const dt = Math.min(0.05, (t - last) / 1000); last = t; this.update(dt); r.render(this.scene, this.camera); };
      this.raf = requestAnimationFrame(loop);
    }

    buildArena() {
      const add = (geo, color, y, shadow = true) => {
        const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.7 }));
        m.position.y = y; m.receiveShadow = true; m.castShadow = shadow; this.scene.add(m); return m;
      };
      const floor = new THREE.Mesh(flat(new THREE.PlaneGeometry(90, 90)), new THREE.ShadowMaterial({ opacity: 0.22 }));
      floor.position.y = GROUND; floor.receiveShadow = true; this.scene.add(floor);
      add(flat(new THREE.ExtrudeGeometry(rrShape(TRAY * 2, TRAY * 2, 1.3), { depth: 0.3, bevelEnabled: false, curveSegments: 8 })), 0xfbf8f1, GROUND);
      const rim = rrShape(TRAY * 2, TRAY * 2, 1.3);
      rim.holes.push(new THREE.Path(rrShape(TRAY * 2 - 0.7, TRAY * 2 - 0.7, 1.0).getPoints(8)));
      add(flat(new THREE.ExtrudeGeometry(rim, { depth: 0.22, bevelEnabled: false, curveSegments: 8 })), 0xffffff, 0);
      const mound = add(new THREE.CylinderGeometry(0.95, 1.5, 0.34, 28), 0x9a6642, GROUND + 0.17); mound.position.z = HOLE_Z;
      const pit = new THREE.Mesh(flat(new THREE.CircleGeometry(0.72, 28)), new THREE.MeshBasicMaterial({ color: 0x1c110b }));
      pit.position.set(0, GROUND + 0.345, HOLE_Z); this.scene.add(pit);
    }

    mat(hex, shade = 1) {
      const k = hex + shade;
      if (!this.mats.has(k)) this.mats.set(k, new THREE.MeshStandardMaterial({ color: new THREE.Color(hex).multiplyScalar(shade), roughness: 0.5 }));
      return this.mats.get(k);
    }

    resize() {
      const w = this.mount.clientWidth, h = this.mount.clientHeight;
      if (!w || !h) return;
      this.renderer.setSize(w, h, false);
      const cam = this.camera, tv = Math.tan((cam.fov * Math.PI) / 360), el = (60 * Math.PI) / 180;
      cam.aspect = w / h;
      const d = Math.max(8.3 / tv, 7.5 / (tv * cam.aspect));
      cam.position.set(0, d * Math.sin(el), 2.1 + d * Math.cos(el)); cam.lookAt(0, 0, 2.1); cam.updateProjectionMatrix();
    }

    cellPos(i) { return { x: ((i % this.W) - (this.W - 1) / 2) * this.s, z: (((i / this.W) | 0) - (this.H - 1) / 2) * this.s }; }

    loadLevel({ W, H, grid, palette }) {
      this.clearLevel();
      this.W = W; this.H = H; this.palette = palette;
      const s = (this.s = 10 / Math.max(W, H)); this.h = s * 0.85;
      this.cubeGeo = cubeGeometry(s * 0.94, this.h);
      this.cubes = new Array(W * H).fill(null);
      for (let i = 0; i < W * H; i++) {
        if (grid[i] < 0) continue;
        const m = new THREE.Mesh(this.cubeGeo, this.mat(palette[grid[i]])), p = this.cellPos(i);
        m.position.set(p.x, 0, p.z); m.scale.setScalar(0.001); m.castShadow = m.receiveShadow = true;
        this.scene.add(m); this.cubes[i] = m;
        this.tweens.push({ t: -Math.hypot(p.x, p.z) * 0.05, d: 0.4, f: (k) => { if (!m.userData.taken) m.scale.setScalar(Math.max(0.001, easeOutBack(k))); } });
      }
    }

    clearLevel() {
      this.cubes.forEach((m) => m && this.scene.remove(m));
      this.ants.forEach((a) => this.recycle(a));
      this.tweens.forEach((tw) => tw.kill && tw.kill());
      this.ants = []; this.tweens = []; this.queues.clear(); this.cubes = [];
      if (this.cubeGeo) { this.cubeGeo.dispose(); this.cubeGeo = null; }
    }

    /** rounds: [[{id, i, color}]] from Logic.settle — dispatched one round at a time so peeling order is visible. */
    enqueue(rounds) {
      const grp = (this.grp = (this.grp || 0) + 1);
      rounds.forEach((picks, ri) => {
        for (const p of picks) {
          let q = this.queues.get(p.id);
          if (!q) this.queues.set(p.id, (q = { ev: [], cd: 0 }));
          q.ev.push({ i: p.i, color: p.color, round: ri + 1, grp });
        }
      });
    }
    activeAnts(id) { return this.ants.filter((a) => a.id === id && !a.dying).length; }
    pending(id) { const q = this.queues.get(id); return q ? q.ev.length : 0; }
    totalPending() { let n = 0; this.queues.forEach((q) => { n += q.ev.length; }); return n; }
    isIdle() { return this.totalPending() === 0 && this.ants.length === 0 && this.tweens.length === 0; }

    magnet(removed) {
      removed.forEach(({ i }, n) => {
        const m = this.cubes[i]; if (!m) return;
        this.cubes[i] = null; m.userData.taken = true;
        const kill = () => this.scene.remove(m);
        this.tweens.push({ t: -n * 0.05, d: 0.45, kill, done: kill, f: (k) => { m.position.y = k * 3; m.rotation.y = k * 4; m.scale.setScalar(Math.max(0.001, 1 - k * k)); } });
      });
    }

    newAnt() {
      const g = new THREE.Group(), G = this.antGeo;
      const body = new THREE.Mesh(G.body, this.white); body.castShadow = true;
      const A = new THREE.Mesh(G.legsA, this.black), B = new THREE.Mesh(G.legsB, this.black);
      g.add(body, new THREE.Mesh(G.eyes, this.white), new THREE.Mesh(G.pupils, this.black), A, B);
      g.userData = { body, A, B };
      return g;
    }

    /** Path: dock -> tray edge -> around the mosaic perimeter -> target voxel. */
    route(sx, tx, tz) {
      const j = Math.random() * 0.45, hx = (this.W * this.s) / 2 + 0.3 + j, hz = (this.H * this.s) / 2 + 0.3 + j;
      const L = 4 * hx + 4 * hz, corners = [0, 2 * hx, 2 * hx + 2 * hz, 4 * hx + 2 * hz];
      const at = (u) => {
        u = ((u % L) + L) % L;
        if (u <= 2 * hx) return { x: u - hx, z: hz };
        if (u <= 2 * hx + 2 * hz) return { x: hx, z: hz - (u - 2 * hx) };
        if (u <= 4 * hx + 2 * hz) return { x: hx - (u - 2 * hx - 2 * hz), z: -hz };
        return { x: -hx, z: u - 4 * hx - 2 * hz - hz };
      };
      const uE = Math.max(-hx, Math.min(hx, sx)) + hx;
      const side = [hz - tz, hx - tx, hz + tz, hx + tx], k = side.indexOf(Math.min(...side));
      const uT = k === 0 ? tx + hx : k === 1 ? 2 * hx + (hz - tz) : k === 2 ? 2 * hx + 2 * hz + (hx - tx) : 4 * hx + 2 * hz + (tz + hz);
      const fw = (((uT - uE) % L) + L) % L, dir = fw <= L / 2 ? 1 : -1, dist = dir > 0 ? fw : L - fw;
      const mid = corners.map((c) => (dir > 0 ? (((c - uE) % L) + L) % L : (((uE - c) % L) + L) % L)).filter((o) => o > 0.01 && o < dist).sort((a, b) => a - b);
      return [at(uE), ...mid.map((o) => at(uE + dir * o)), at(uT), { x: tx, z: tz }];
    }

    /** Empty (cube-less) cells connected to the tray border. */
    freeMask() {
      const W = this.W, H = this.H, m = new Uint8Array(W * H), q = [];
      for (let i = 0; i < W * H; i++) {
        const x = i % W, y = (i / W) | 0;
        if ((x === 0 || y === 0 || x === W - 1 || y === H - 1) && !this.cubes[i]) { m[i] = 1; q.push(i); }
      }
      while (q.length) {
        const i = q.pop(), x = i % W, y = (i / W) | 0;
        if (x > 0 && !m[i - 1] && !this.cubes[i - 1]) { m[i - 1] = 1; q.push(i - 1); }
        if (x < W - 1 && !m[i + 1] && !this.cubes[i + 1]) { m[i + 1] = 1; q.push(i + 1); }
        if (y > 0 && !m[i - W] && !this.cubes[i - W]) { m[i - W] = 1; q.push(i - W); }
        if (y < H - 1 && !m[i + W] && !this.cubes[i + W]) { m[i + W] = 1; q.push(i + W); }
      }
      return m;
    }
    exposed(m, i) {
      const W = this.W, H = this.H, x = i % W, y = (i / W) | 0;
      return x === 0 || y === 0 || x === W - 1 || y === H - 1 || !!(m[i - 1] || m[i + 1] || m[i - W] || m[i + W]);
    }

    /** Walk the perimeter, then only through empty cells, to the cube. */
    fullPath(sx, i) {
      const W = this.W, H = this.H, s = this.s, pos = (x, y) => ({ x: (x - (W - 1) / 2) * s, z: (y - (H - 1) / 2) * s });
      const prev = new Int32Array(W * H).fill(-2), q = [i]; prev[i] = -1;
      let ex = null;
      for (let h = 0; h < q.length && !ex; h++) {
        const c = q[h], x = c % W, y = (c / W) | 0;
        for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) { ex = { nx, ny, c }; break; }
          const j = ny * W + nx;
          if (prev[j] !== -2 || this.cubes[j]) continue;
          prev[j] = c; q.push(j);
        }
      }
      if (!ex) { const t = this.cellPos(i); return this.route(sx, t.x, t.z); }
      const e = pos(ex.nx, ex.ny), ring = this.route(sx, e.x, e.z), cells = [];
      for (let c = ex.c; c !== -1; c = prev[c]) cells.push(pos(c % W, (c / W) | 0));
      return simplify([...ring, ...cells]);
    }

    spawn(id, ev) {
      const g = this.pool.pop() || this.newAnt(), hex = this.palette[ev.color] || '#888888';
      g.userData.body.material = this.mat(hex); g.userData.A.material = g.userData.B.material = this.mat(hex, 0.62);
      g.scale.setScalar(ANT);
      const sx = this.hooks.slotX(id) * 4.6 + (Math.random() - 0.5) * 0.6, p = this.cellPos(ev.i);
      g.position.set(sx, GROUND, SPAWN_Z); this.scene.add(g);
      this.ants.push({ g, id, sx, tx: p.x, tz: p.z, pts: this.fullPath(sx, ev.i), k: 0, phase: 'go', ev, v: 4 + Math.random() * 0.6, ph: Math.random() * 6, carry: null });
    }
    recycle(a) {
      if (a.carry) { a.g.remove(a.carry); a.carry = null; }
      this.scene.remove(a.g); this.pool.push(a.g);
    }

    groundY(x, z) {
      const cx = Math.round(x / this.s + (this.W - 1) / 2), cy = Math.round(z / this.s + (this.H - 1) / 2);
      if (cx >= 0 && cy >= 0 && cx < this.W && cy < this.H && this.cubes[cy * this.W + cx]) return this.h;
      return Math.abs(x) < TRAY && Math.abs(z) < TRAY ? 0 : GROUND;
    }

    update(dt) {
      const sdt = dt * this.speed; this.time += sdt;
      let changed = false;
      for (let i = this.tweens.length - 1; i >= 0; i--) {
        const tw = this.tweens[i]; tw.t += sdt;
        if (tw.t < 0) continue;
        const k = Math.min(1, tw.t / tw.d); tw.f(k);
        if (k >= 1) { this.tweens.splice(i, 1); if (tw.done) tw.done(); changed = true; }
      }
      // dispatch: one ant per slot at a time; only cubes with a physically free way out; bottom rows first
      const mask = this.queues.size ? this.freeMask() : null;
      let spawned = 0;
      this.queues.forEach((q, id) => {
        q.cd = Math.max(0, q.cd - sdt);
        if (q.cd <= 0 && q.ev.length && this.ants.length < MAX_ANTS && !this.ants.some((x) => x.id === id && !x.dying)) {
          let best = -1, by = -1, bx = 1e9;
          q.ev.forEach((e, k) => {
            if (!this.exposed(mask, e.i)) return;
            const y = (e.i / this.W) | 0, x = e.i % this.W;
            if (y > by || (y === by && x < bx)) { best = k; by = y; bx = x; }
          });
          if (best < 0 && this.idleT > 2.5 && this.ants.length === 0) { best = 0; this.idleT = 0; }
          if (best >= 0) { this.spawn(id, q.ev.splice(best, 1)[0]); q.cd = 0.07; spawned++; changed = true; }
        }
        if (!q.ev.length) this.queues.delete(id);
      });
      this.idleT = this.queues.size && !this.ants.length && !spawned ? this.idleT + sdt : 0;
      for (let n = this.ants.length - 1; n >= 0; n--) {
        const a = this.ants[n], p = a.g.position;
        if (a.dying) continue;
        let rem = a.v * sdt;
        while (rem > 0 && a.k < a.pts.length) {
          const q = a.pts[a.k], dx = q.x - p.x, dz = q.z - p.z, dist = Math.hypot(dx, dz);
          if (dist <= rem) { p.x = q.x; p.z = q.z; rem -= dist; a.k++; } else { p.x += (dx / dist) * rem; p.z += (dz / dist) * rem; a.g.rotation.y = Math.atan2(dx, dz); rem = 0; }
        }
        p.y += (this.groundY(p.x, p.z) - p.y) * Math.min(1, sdt * 16);
        const sw = Math.sin(this.time * 13 + a.ph) * 0.5;
        a.g.userData.A.rotation.y = sw; a.g.userData.B.rotation.y = -sw; a.g.userData.body.position.y = Math.abs(sw) * 0.06;
        if (a.k < a.pts.length) continue;
        if (a.phase === 'go') {
          const m = this.cubes[a.ev.i];
          if (m) {
            this.cubes[a.ev.i] = null; m.userData.taken = true; this.scene.remove(m); a.g.add(m);
            m.position.set(0, 0.78, 0.4); m.rotation.set(0, 0, 0); m.scale.setScalar(0.5 / (this.s * ANT)); a.carry = m;
          }
          a.phase = 'back'; a.k = 0;
          a.pts = this.fullPath(a.sx, a.ev.i).reverse().slice(1); a.pts.push({ x: (Math.random() - 0.5) * 0.5, z: HOLE_Z });
        } else {
          a.dying = true;
          const end = () => { const k = this.ants.indexOf(a); if (k >= 0) this.ants.splice(k, 1); this.recycle(a); };
          this.tweens.push({ t: 0, d: 0.16, f: (k) => { a.g.scale.setScalar(ANT * Math.max(0.01, 1 - k)); p.y = GROUND - k * 0.5; }, done: end, kill: () => {} });
        }
      }
      if (changed) this.hooks.onChange();
    }

    dispose() {
      cancelAnimationFrame(this.raf); this.ro.disconnect(); this.clearLevel();
      this.renderer.dispose(); if (this.renderer.domElement.parentNode) this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  };
})();
