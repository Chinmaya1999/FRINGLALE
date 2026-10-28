import * as THREE from 'three';

/**
 * Parametric jewellery builders. Units: 1 = 10 mm. Every builder returns a Group of FLAT mesh children whose names follow
 * the same contract as GLB assets ("band", "head", "stone", "gem_*", "chain"), so materials, exploded view,
 * highlighting and measurements work identically. These are labelled "Parametric 3D preview (not final CAD)" in the UI.
 */

const FACETS = { round: 16, oval: 16, pear: 16, cushion: 12, emerald: 8, heart: 16, princess: 4 };
const SHAPE_SCALE = { round: [1, 1], oval: [0.8, 1.22], pear: [0.82, 1.3], cushion: [1, 0.95], emerald: [0.78, 1.25], heart: [1.05, 1], princess: [0.9, 0.9] };

const gemCache = new Map();
/** Brilliant-style stone with flat facets. Cached per shape/size; geometries are shared, never mutated. */
export function stoneGeometry(shape = 'round', size = 0.5) {
  const key = `${shape}:${size}`;
  if (gemCache.has(key)) return gemCache.get(key);
  const pts = [[0.0001, -0.38], [0.5, -0.02], [0.5, 0], [0.29, 0.14], [0.0001, 0.14]].map(([r, y]) => new THREE.Vector2(r * size, y * size));
  let g = new THREE.LatheGeometry(pts, FACETS[shape] || 16);
  if (shape === 'princess') g.rotateY(Math.PI / 4);
  if (shape === 'emerald') g.rotateY(Math.PI / 8);
  const [sx, sz] = SHAPE_SCALE[shape] || [1, 1];
  g.scale(sx, 1, sz);
  g = g.toNonIndexed();
  g.computeVertexNormals();
  gemCache.set(key, g);
  return g;
}

/** Band cross-section is a superellipse (n=2 round, higher = squarer) revolved about Z. */
export function bandGeometry(R, w, t, n = 3) {
  const pts = [];
  const p = 2 / n;
  for (let i = 0; i <= 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    const c = Math.cos(a), s = Math.sin(a);
    pts.push(new THREE.Vector2(R + (t / 2) * Math.sign(c) * Math.abs(c) ** p, (w / 2) * Math.sign(s) * Math.abs(s) ** p));
  }
  const g = new THREE.LatheGeometry(pts, 96);
  g.rotateX(Math.PI / 2);                  // hole axis along Z, like the GLB rings
  return g;
}

const cyl = (r1, r2, h, seg = 10) => new THREE.CylinderGeometry(r1, r2, h, seg);
const sphere = (r) => new THREE.SphereGeometry(r, 14, 10);

function mesh(group, name, geom, pos = [0, 0, 0], rot = [0, 0, 0], scale = 1) {
  const m = new THREE.Mesh(geom);
  m.name = name;
  m.position.set(...pos);
  m.rotation.set(...rot);
  if (scale !== 1) m.scale.setScalar(scale);
  group.add(m);
  return m;
}

/** Many small stones in one draw call. `items` = [{ pos:[x,y,z], quat:Quaternion, size }] */
function accents(group, name, shapeSize, items) {
  const geo = stoneGeometry('round', 1);   // unit size; per-instance scale applies the real size
  const im = new THREE.InstancedMesh(geo, undefined, items.length);
  const m = new THREE.Matrix4();
  items.forEach((it, i) => {
    m.compose(new THREE.Vector3(...it.pos), it.quat, new THREE.Vector3().setScalar(it.size ?? shapeSize));
    im.setMatrixAt(i, m);
  });
  im.instanceMatrix.needsUpdate = true;
  im.frustumCulled = false;
  im.name = name;
  group.add(im);
}

const qFacing = (dir) => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());

/** Stones set around the outside of a band (radius R, thickness t), between angles a0..a1 (radians, 90° = top). */
function paveAlongBand(group, R, t, a0, a1, count, size) {
  const items = [];
  for (let i = 0; i < count; i++) {
    const a = count === 1 ? (a0 + a1) / 2 : a0 + ((a1 - a0) * i) / (count - 1);
    const dir = new THREE.Vector3(Math.cos(a), Math.sin(a), 0);
    items.push({ pos: dir.clone().multiplyScalar(R + t / 2 - size * 0.05).toArray(), quat: qFacing(dir), size });
  }
  accents(group, 'gem_accents', size, items);
}

function ringOfStones(group, name, cx, cy, cz, radius, count, size, facing) {
  // Stones in a circle in the XZ plane (ring top view) or in XY plane (facing the camera) around (cx,cy,cz).
  const items = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const flat = facing === 'z';
    const pos = flat ? [cx + Math.cos(a) * radius, cy + Math.sin(a) * radius, cz] : [cx + Math.cos(a) * radius, cy, cz + Math.sin(a) * radius];
    items.push({ pos, quat: qFacing(flat ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0)), size });
  }
  accents(group, name, size, items);
}

function prongs(group, cx, cy, cz, radius, count, height, thick = 0.028, facing = 'y') {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + Math.PI / count;
    const c = Math.cos(a) * radius, s = Math.sin(a) * radius;
    // 'y': stone faces up, prongs stand on the XZ circle. 'z': stone faces the camera, prongs on the XY circle.
    const pos = facing === 'y' ? [cx + c, cy, cz + s] : [cx + c, cy + s, cz];
    const m = mesh(group, 'head', cyl(thick * 0.8, thick, height, 8), pos, facing === 'z' ? [Math.PI / 2, 0, 0] : [0, 0, 0]);
    const tip = mesh(group, 'head', sphere(thick * 1.15), pos);
    if (facing === 'y') tip.position.y += height / 2; else tip.position.z += height / 2;
  }
}

const ringBand = (g, { R = 0.88, w = 0.22, t = 0.16, n = 3 } = {}) => {
  mesh(g, 'band', bandGeometry(R, w, t, n));
  return R + t / 2;                          // top of the band on +Y
};

/** Raised head for a centre stone sitting on top of a ring. Returns the stone centre Y. */
function ringHead(g, top, shape, size, { prongCount = 6, gallery = true, lift = 0 } = {}) {
  const y = top + 0.2 + lift;
  mesh(g, 'stone', stoneGeometry(shape, size), [0, y, 0]);
  if (gallery) mesh(g, 'head', new THREE.TorusGeometry(size * 0.38, 0.03, 8, 28), [0, top + 0.1 + lift, 0], [Math.PI / 2, 0, 0]);
  mesh(g, 'head', cyl(size * 0.32, 0.1, 0.16 + lift, 16), [0, top + 0.04 + lift / 2, 0]);
  prongs(g, 0, y - 0.04, 0, size * 0.5, prongCount, 0.3, 0.028);
  return y;
}

function chainCurve(points, radius = 0.018) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  return new THREE.TubeGeometry(curve, 80, radius, 6, false);
}

export const BUILDERS = {
  'plain-band'(g) {
    ringBand(g, { R: 0.88, w: 0.42, t: 0.15, n: 4 });
    mesh(g, 'head', new THREE.TorusGeometry(0.88, 0.012, 6, 96), [0, 0, 0.14]);   // fine edge grooves read as detail
    mesh(g, 'head', new THREE.TorusGeometry(0.88, 0.012, 6, 96), [0, 0, -0.14]);
  },

  'halo-ring'(g, { shape }) {
    const top = ringBand(g, { w: 0.22, t: 0.17 });
    const y = ringHead(g, top, shape, 0.5, { prongCount: 4 });
    ringOfStones(g, 'gem_accents_halo', 0, y - 0.03, 0, 0.36, 14, 0.12, 'y');
    // Pavé shoulders
    paveAlongBand(g, 0.88, 0.17, Math.PI / 2 + 0.28, Math.PI / 2 + 0.95, 6, 0.1);
    paveAlongBand(g, 0.88, 0.17, Math.PI / 2 - 0.95, Math.PI / 2 - 0.28, 6, 0.1);
  },

  'three-stone-ring'(g, { shape }) {
    const top = ringBand(g, { w: 0.24, t: 0.17 });
    ringHead(g, top, shape, 0.5, { prongCount: 4 });
    for (const sx of [-1, 1]) {
      const a = Math.PI / 2 - sx * 0.5;
      const dir = new THREE.Vector3(Math.cos(a), Math.sin(a), 0);
      const pos = dir.clone().multiplyScalar(top + 0.12);
      const m = mesh(g, 'gem_side', stoneGeometry(shape === 'round' ? 'round' : shape, 0.33), pos.toArray());
      m.quaternion.copy(qFacing(dir));
      const c = mesh(g, 'head', cyl(0.1, 0.07, 0.1, 12), pos.clone().addScaledVector(dir, -0.1).toArray());
      c.quaternion.copy(qFacing(dir));
    }
  },

  'eternity-band'(g) {
    mesh(g, 'band', bandGeometry(0.88, 0.3, 0.15, 3));
    paveAlongBand(g, 0.88, 0.15, 0, Math.PI * 2 * (35 / 36), 36, 0.13);
  },

  'cocktail-ring'(g, { shape }) {
    const top = ringBand(g, { R: 0.9, w: 0.3, t: 0.2, n: 3 });
    const y = ringHead(g, top, shape === 'round' ? 'oval' : shape, 0.85, { prongCount: 6, lift: 0.1 });
    ringOfStones(g, 'gem_accents_halo', 0, y - 0.05, 0, 0.62, 18, 0.14, 'y');
    ringOfStones(g, 'gem_accents_outer', 0, y - 0.1, 0, 0.8, 22, 0.1, 'y');
    paveAlongBand(g, 0.9, 0.2, Math.PI / 2 + 0.35, Math.PI / 2 + 1.0, 5, 0.12);
    paveAlongBand(g, 0.9, 0.2, Math.PI / 2 - 1.0, Math.PI / 2 - 0.35, 5, 0.12);
  },

  'halo-pendant'(g, { shape }) {
    // Faces +Z. Chain hangs above the pendant body.
    mesh(g, 'chain', chainCurve([[-1.5, 1.8, -0.1], [-0.8, 1.2, -0.05], [-0.25, 0.85, 0], [0.25, 0.85, 0], [0.8, 1.2, -0.05], [1.5, 1.8, -0.1]]));
    mesh(g, 'head', new THREE.TorusGeometry(0.1, 0.025, 8, 20), [0, 0.8, 0]);
    mesh(g, 'band', new THREE.SphereGeometry(0.64, 48, 24).scale(1, 1, 0.16), [0, 0, -0.06]);   // slightly domed so it catches light
    mesh(g, 'stone', stoneGeometry(shape, 0.55), [0, 0, 0.1], [Math.PI / 2, 0, 0]);
    ringOfStones(g, 'gem_accents_halo', 0, 0, 0.05, 0.42, 14, 0.12, 'z');
    prongs(g, 0, 0, 0.08, 0.28, 4, 0.18, 0.026, 'z');
  },

  'teardrop-pendant'(g, { shape }) {
    const s = shape === 'round' ? 'pear' : shape;
    mesh(g, 'chain', chainCurve([[-1.5, 1.7, -0.1], [-0.8, 1.15, -0.05], [-0.2, 0.62, 0], [0.2, 0.62, 0], [0.8, 1.15, -0.05], [1.5, 1.7, -0.1]]));
    mesh(g, 'head', new THREE.TorusGeometry(0.1, 0.028, 8, 20), [0, 0.58, 0]);
    mesh(g, 'head', cyl(0.07, 0.07, 0.2, 10), [0, 0.42, 0]);
    mesh(g, 'stone', stoneGeometry(s, 0.75), [0, 0, 0.05], [Math.PI / 2, 0, 0]);
    prongs(g, 0, 0, 0.05, 0.3, 4, 0.2, 0.03, 'z');
    g.position.y = -0.2;
  },

  'stud-earrings'(g, { shape }) {
    for (const sx of [-1, 1]) {
      const x = sx * 0.9;
      mesh(g, 'stone', stoneGeometry(shape, 0.55), [x, 0, 0.1], [Math.PI / 2, 0, 0]);
      mesh(g, 'band', new THREE.SphereGeometry(0.3, 28, 16).scale(1, 1, 0.5), [x, 0, -0.06]);
      mesh(g, 'band', cyl(0.025, 0.025, 0.5, 8), [x, 0, -0.4], [Math.PI / 2, 0, 0]);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        const m = mesh(g, 'head', cyl(0.022, 0.03, 0.22, 8), [x + Math.cos(a) * 0.28, Math.sin(a) * 0.28, 0.06], [Math.PI / 2, 0, 0]);
        mesh(g, 'head', sphere(0.034), [m.position.x, m.position.y, 0.17]);
      }
    }
  },

  'drop-earrings'(g, { shape }) {
    const s = shape === 'round' ? 'pear' : shape;
    for (const sx of [-1, 1]) {
      const x = sx * 0.95;
      mesh(g, 'gem_top', stoneGeometry('round', 0.3), [x, 1.05, 0.05], [Math.PI / 2, 0, 0]);
      mesh(g, 'band', cyl(0.12, 0.12, 0.08, 16), [x, 1.05, -0.05], [Math.PI / 2, 0, 0]);
      mesh(g, 'chain', chainCurve([[x, 0.95, 0], [x, 0.6, 0], [x, 0.25, 0]], 0.02));
      mesh(g, 'head', new THREE.TorusGeometry(0.1, 0.025, 8, 20), [x, 0.2, 0]);
      mesh(g, 'stone', stoneGeometry(s, 0.7), [x, -0.35, 0.02], [Math.PI / 2, 0, 0]);
      prongs(g, x, -0.35, 0.02, 0.28, 4, 0.18, 0.026, 'z');
    }
    g.position.y = -0.2;
  },

  'riviere-necklace'(g, { shape }) {
    const pts = [];
    const N = 15;
    for (let i = 0; i <= N; i++) {
      const u = (i / N) * 2 - 1;                 // -1..1
      pts.push([u * 1.6, -0.85 * (1 - u * u) * 1.0 + 0.5, -0.02 * (1 - u * u)]);
    }
    mesh(g, 'chain', chainCurve(pts, 0.03));
    const items = [];
    pts.forEach((p, i) => {
      if (i === Math.floor(N / 2)) return;
      const u = Math.abs(i / N - 0.5) * 2;       // 0 centre .. 1 ends
      items.push({ pos: [p[0], p[1], p[2] + 0.03], quat: qFacing(new THREE.Vector3(0, 0, 1)), size: 0.28 - u * 0.12 });
    });
    accents(g, 'gem_accents', 0.2, items);
    const c = pts[Math.floor(N / 2)];
    mesh(g, 'stone', stoneGeometry(shape, 0.75), [c[0], c[1], c[2] + 0.06], [Math.PI / 2, 0, 0]);
    g.position.y = 0.25;
  },

  'gold-bar'(g) {
    // 40 x 24 mm footprint, 7 mm high (1 unit = 10 mm). Flat on a plinth, tilted a little towards camera so the top face reads.
    const w = 2.4, d = 1.5, h = 0.55;
    const body = new THREE.ExtrudeGeometry(
      (() => { const s = new THREE.Shape(); const r = 0.1, x = w / 2, y = d / 2; s.moveTo(-x + r, -y); s.lineTo(x - r, -y); s.quadraticCurveTo(x, -y, x, -y + r); s.lineTo(x, y - r); s.quadraticCurveTo(x, y, x - r, y); s.lineTo(-x + r, y); s.quadraticCurveTo(-x, y, -x, y - r); s.lineTo(-x, -y + r); s.quadraticCurveTo(-x, -y, -x + r, -y); return s; })(),
      { depth: h, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.09, bevelSegments: 4 });
    body.rotateX(-Math.PI / 2);
    mesh(g, 'band', body, [0, -h / 2, 0]);
    // raised inner plate + stamped ridge lines read as the minted face
    mesh(g, 'head', new THREE.BoxGeometry(w * 0.74, 0.03, d * 0.62), [0, h / 2 + 0.12, 0]);
    for (const z of [-0.2, 0, 0.2]) mesh(g, 'head', new THREE.BoxGeometry(w * 0.5, 0.02, 0.018), [0, h / 2 + 0.15, z]);
    g.rotation.set(0.35, -0.45, 0);
  },

  'gold-coin'(g) {
    // Round coin: thick rim, recessed field, raised central medallion and a ring of beads.
    mesh(g, 'band', new THREE.CylinderGeometry(1.1, 1.1, 0.16, 96), [0, 0, 0], [Math.PI / 2, 0, 0]);
    mesh(g, 'head', new THREE.TorusGeometry(1.04, 0.045, 12, 96), [0, 0, 0.09]);
    mesh(g, 'head', new THREE.CylinderGeometry(0.62, 0.66, 0.05, 64), [0, 0, 0.1], [Math.PI / 2, 0, 0]);
    mesh(g, 'head', new THREE.TorusGeometry(0.46, 0.028, 10, 64), [0, 0, 0.14]);
    mesh(g, 'head', new THREE.SphereGeometry(0.17, 24, 16), [0, 0, 0.17]);
    for (let i = 0; i < 40; i++) { const a = (i / 40) * Math.PI * 2; mesh(g, 'head', new THREE.SphereGeometry(0.03, 8, 6), [Math.cos(a) * 0.86, Math.sin(a) * 0.86, 0.11]); }
    g.position.y = 0.2;
    g.rotation.set(-0.15, 0.5, 0);
  },

  'engraved-coin'(g, { text }) {
    BUILDERS['gold-coin'](g, {});
    // Replace the centre medallion detail with a flat engraving plate; the actual lettering is shown as a label by the viewer (simulated).
    mesh(g, 'head', new THREE.TorusGeometry(0.72, 0.02, 8, 64), [0, 0, 0.12]);
  },

  'kada-bangle'(g) {
    g.rotation.x = -0.75;
    mesh(g, 'band', bandGeometry(1.15, 0.5, 0.22, 3));
    for (const z of [-0.13, 0, 0.13]) mesh(g, 'head', new THREE.TorusGeometry(1.15 + 0.11, 0.022, 8, 120), [0, 0, z]);
  },

  'tennis-bangle'(g) {
    g.rotation.x = -0.75;
    mesh(g, 'band', bandGeometry(1.05, 0.17, 0.12, 3));
    paveAlongBand(g, 1.05, 0.12, 0, Math.PI * 2 * (39 / 40), 40, 0.19);
  },
};

export function buildProcedural(style, opts = {}) {
  const g = new THREE.Group();
  const fn = BUILDERS[style];
  if (!fn) throw new Error(`Unknown procedural style "${style}"`);
  fn(g, { shape: opts.shape || 'round' });
  // Bullion pieces grow with their stated weight (cube-root so a 100 g bar is visibly larger without leaving the frame).
  if (opts.weightG) g.scale.setScalar(Math.min(1.5, Math.max(0.65, Math.cbrt(opts.weightG / 10))));
  return g;
}
