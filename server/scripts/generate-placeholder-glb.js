/**
 * Generates a dependency-free placeholder ring GLB (band + faceted stone) that follows the
 * naming contract in docs/MODEL_ASSET_SPEC.md: nodes "band", "head", "stone".
 * Usage: node scripts/generate-placeholder-glb.js <out.glb> [stoneScaleX stoneScaleZ]
 * Real production assets replace these files; no code changes needed.
 */
import fs from 'node:fs';

const [, , out = 'ring.glb', sx = '1', sz = '1'] = process.argv;

function torus(R, r, seg, tube) {
  const pos = [], nor = [], idx = [];
  for (let i = 0; i <= seg; i++) for (let j = 0; j <= tube; j++) {
    const u = (i / seg) * Math.PI * 2, v = (j / tube) * Math.PI * 2;
    const cx = R * Math.cos(u), cy = R * Math.sin(u);
    const x = (R + r * Math.cos(v)) * Math.cos(u), y = (R + r * Math.cos(v)) * Math.sin(u), z = r * Math.sin(v);
    pos.push(x, y, z); nor.push(x - cx, y - cy, z);
  }
  for (let i = 0; i < seg; i++) for (let j = 0; j < tube; j++) {
    const a = i * (tube + 1) + j, b = (i + 1) * (tube + 1) + j;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  return { pos, nor, idx };
}

// Brilliant-style stone: crown + pavilion revolved with 16 facets.
function stone(scaleX, scaleZ, n = 16) {
  const rings = [[0.14, 0.28], [0.0, 0.5], [-0.02, 0.5], [-0.38, 0.0]]; // [y, radius]: table → girdle → culet
  const pos = [], nor = [], idx = [];
  const flat = [];
  for (let k = 0; k < rings.length - 1; k++) {
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
      const p = (y, r, a) => [r * Math.cos(a) * scaleX, y, r * Math.sin(a) * scaleZ];
      const [y0, r0] = rings[k], [y1, r1] = rings[k + 1];
      flat.push([p(y0, r0, a0), p(y1, r1, a0), p(y0, r0, a1)], [p(y1, r1, a0), p(y1, r1, a1), p(y0, r0, a1)]);
    }
  }
  for (const [a, b, c] of flat) {
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let nx = u[1] * v[2] - u[2] * v[1], ny = u[2] * v[0] - u[0] * v[2], nz = u[0] * v[1] - u[1] * v[0];
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    for (const q of [a, b, c]) { idx.push(pos.length / 3); pos.push(...q); nor.push(nx, ny, nz); }
  }
  return { pos, nor, idx };
}

const band = torus(0.85, 0.09, 64, 16);
const gem = stone(Number(sx), Number(sz));
// Head (prong collar) sits between band and stone: a small torus.
const head = torus(0.2, 0.035, 24, 8);

const geos = [band, head, gem];
const names = ['band', 'head', 'stone'];
const mats = [0, 0, 1];

// Build binary buffer: [positions, normals, indices] per mesh.
const chunks = [], views = [], accessors = [];
const push = (buf, target) => {
  const pad = (4 - (buf.byteLength % 4)) % 4;
  const off = chunks.reduce((s, c) => s + c.byteLength, 0);
  chunks.push(Buffer.concat([Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength), Buffer.alloc(pad)]));
  views.push({ buffer: 0, byteOffset: off, byteLength: buf.byteLength, target });
  return views.length - 1;
};
const minmax = (arr) => {
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < arr.length; i += 3) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], arr[i + k]); mx[k] = Math.max(mx[k], arr[i + k]); }
  return { min: mn, max: mx };
};

const meshes = geos.map((g, i) => {
  const P = new Float32Array(g.pos), N = new Float32Array(g.nor), I = new Uint16Array(g.idx);
  const nv = push(P, 34962), nn = push(N, 34962), ni = push(I, 34963);
  const a = accessors.length;
  accessors.push({ bufferView: nv, componentType: 5126, count: P.length / 3, type: 'VEC3', ...minmax(P) });
  accessors.push({ bufferView: nn, componentType: 5126, count: N.length / 3, type: 'VEC3' });
  accessors.push({ bufferView: ni, componentType: 5123, count: I.length, type: 'SCALAR' });
  return { name: names[i], primitives: [{ attributes: { POSITION: a, NORMAL: a + 1 }, indices: a + 2, material: mats[i] }] };
});

const gltf = {
  asset: { version: '2.0', generator: 'fringlale-placeholder' },
  scene: 0, scenes: [{ nodes: [0, 1, 2] }],
  nodes: [
    { name: 'band', mesh: 0 },                                                   // upright: finger hole along Z
    { name: 'head', mesh: 1, translation: [0, 1.0, 0], rotation: [0.7071068, 0, 0, 0.7071068] },
    { name: 'stone', mesh: 2, translation: [0, 1.14, 0], scale: [0.5, 0.5, 0.5] },
  ],
  meshes,
  materials: [
    { name: 'metal', pbrMetallicRoughness: { baseColorFactor: [0.83, 0.65, 0.29, 1], metallicFactor: 1, roughnessFactor: 0.15 } },
    { name: 'gem', pbrMetallicRoughness: { baseColorFactor: [0.95, 0.97, 1, 1], metallicFactor: 0, roughnessFactor: 0.02 } },
  ],
  accessors, bufferViews: views,
  buffers: [{ byteLength: chunks.reduce((s, c) => s + c.byteLength, 0) }],
};

const bin = Buffer.concat(chunks);
let json = Buffer.from(JSON.stringify(gltf));
json = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 0x20)]);
const header = Buffer.alloc(12);
header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4);
header.writeUInt32LE(12 + 8 + json.length + 8 + bin.length, 8);
const ch = (len, type) => { const b = Buffer.alloc(8); b.writeUInt32LE(len, 0); b.writeUInt32LE(type, 4); return b; };
fs.writeFileSync(out, Buffer.concat([header, ch(json.length, 0x4e4f534a), json, ch(bin.length, 0x004e4942), bin]));
console.log(`${out}: ${fs.statSync(out).size} bytes`);
