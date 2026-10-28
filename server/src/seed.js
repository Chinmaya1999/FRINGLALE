import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDb } from './config/db.js';
import { Metal, Stone, StonePrice, GoldRate, Design, Setting, Coupon, User } from './models/index.js';
import { fromGold24, istDate } from './services/goldRate.js';

const SHAPES = ['round', 'oval', 'pear', 'cushion', 'emerald', 'heart', 'princess'];
const shapeMult = { round: 1, oval: 0.92, pear: 0.9, cushion: 0.88, emerald: 0.85, heart: 0.9, princess: 0.87 };

const metals = [
  ['yellow', '14K', '14K', 0.84, '#D4AF37'], ['yellow', '18K', '18K', 1, '#D9B04A'], ['yellow', '22K', '22K', 1.14, '#E0B44C'],
  ['white', '14K', '14K', 0.84, '#E8E8EA'], ['white', '18K', '18K', 1, '#EDEDEF'],
  ['rose', '14K', '14K', 0.83, '#E6A98F'], ['rose', '18K', '18K', 0.98, '#EBB39B'],
  ['platinum', '950', 'platinum', 1.38, '#E5E4E2'], ['silver', '925', 'silver', 0.67, '#F2F2F2'],
].map(([family, karat, rateKey, densityFactor, hex]) => ({
  key: `${family}-${karat}`, family, karat, rateKey, densityFactor, hex,
  label: family === 'platinum' ? 'Platinum 950' : family === 'silver' ? 'Silver 925' : `${karat} ${family[0].toUpperCase()}${family.slice(1)} Gold`,
  purity: { '14K': 0.585, '18K': 0.75, '22K': 0.916, '950': 0.95, '925': 0.925 }[karat],
}));

const stones = [
  { key: 'natural-diamond', label: 'Natural Diamond', kind: 'diamond', ior: 2.42, hex: '#FFFFFF', certified: true },
  { key: 'lab-grown-diamond', label: 'Lab-grown Diamond', kind: 'diamond', ior: 2.42, hex: '#FFFFFF', certified: true },
  { key: 'ruby', label: 'Ruby', kind: 'gem', ior: 1.77, hex: '#B0112B' },
  { key: 'emerald', label: 'Emerald', kind: 'gem', ior: 1.58, hex: '#0F7B4B' },
  { key: 'sapphire', label: 'Blue Sapphire', kind: 'gem', ior: 1.77, hex: '#1F3F9E' },
];

const qualityPrices = {
  'natural-diamond': { 'VVS-EF': 180000, 'VS-GH': 120000, 'SI-IJ': 80000 },
  'lab-grown-diamond': { 'VVS-EF': 24000, 'VS-GH': 16000, 'SI-IJ': 10000 },
  ruby: { AA: 30000, AAA: 65000 },
  emerald: { AA: 28000, AAA: 60000 },
  sapphire: { AA: 26000, AAA: 58000 },
};
const stonePrices = Object.entries(qualityPrices).flatMap(([stoneType, q]) =>
  SHAPES.flatMap((shape) => Object.entries(q).map(([quality, p]) => ({
    stoneType, shape, quality, pricePerCarat: Math.round(p * shapeMult[shape]),
  }))));

const ringSizes = Array.from({ length: 13 }, (_, i) => String(8 + i));
const D = ['natural-diamond', 'lab-grown-diamond'];
const GEMS = [...D, 'ruby', 'emerald', 'sapphire'];
const ALL_METALS = metals.map((m) => m.key);
const GOLD_METALS = ALL_METALS.filter((k) => !k.startsWith('silver'));
const Q_DIA = ['VVS-EF', 'VS-GH', 'SI-IJ'];

const base = {
  allowedMetals: ALL_METALS, allowedStoneTypes: GEMS, allowedShapes: SHAPES, allowedQualities: [...Q_DIA, 'AA', 'AAA'],
  makingType: 'percent', makingValue: 12, isActive: true,
};
const RING_PARTS = [{ id: 'band', label: 'Band', meshName: 'band' }, { id: 'head', label: 'Prong head', meshName: 'head' }, { id: 'stone', label: 'Centre stone', meshName: 'stone' }];
const proc = (style, extra = {}) => ({
  procedural: style, assetVariants: [], assetBackedMetals: [], explodedView: false, ...extra,
});
const ringProc = (style, bandMm, extra = {}) => proc(style, {
  explodedView: true, components: RING_PARTS, dimensionsMm: { width: 18, height: 22, depth: 18, bandWidth: bandMm },
  annotations: [{ label: 'Band width', meshName: 'band', valueMm: bandMm }], ...extra,
});
const designs = [
  {
    ...base, slug: 'aurelia-solitaire-ring', name: 'Aurelia Solitaire Ring', category: 'ring', collection: 'signature', featured: true,
    description: 'A timeless six-prong solitaire on a slim polished band.',
    occasions: ['engagement', 'wedding'], baseWeight: 3.4, allowedSizes: ringSizes, caratRange: { min: 0.3, max: 3 },
    model3d: {
      primaryGlbUrl: '/models/ring-solitaire-round.glb',
      assetVariants: [
        { key: 'round', stoneShape: 'round', glbUrl: '/models/ring-solitaire-round.glb', sizeBytes: 56456, triangles: 3200 },
        { key: 'oval', stoneShape: 'oval', glbUrl: '/models/ring-solitaire-oval.glb', sizeBytes: 56516, triangles: 3200 },
      ],
      assetBackedMetals: ['yellow-18K', 'white-18K', 'rose-18K', 'platinum-950'],
      explodedView: true, components: RING_PARTS,
      dimensionsMm: { width: 18, height: 22, depth: 18, bandWidth: 2 },
      annotations: [{ label: 'Band width', meshName: 'band', valueMm: 2 }, { label: 'Setting height', meshName: 'head', valueMm: 6 }],
    },
    simulated: [], manufacturing: { status: 'cad_ready' },
  },
  {
    ...base, slug: 'celestia-halo-ring', name: 'Celestia Halo Ring', category: 'ring', collection: 'bridal', featured: true,
    description: 'A radiant centre stone ringed by a halo of brilliant-cut accents and a pavé-set band.',
    occasions: ['engagement', 'wedding'], baseWeight: 3.9, allowedSizes: ringSizes, caratRange: { min: 0.3, max: 3 }, stoneCount: 30,
    model3d: ringProc('halo-ring', 2.2, { fit: 0.95 }), simulated: ['parametric-model'], manufacturing: { status: 'cad_ready' },
  },
  {
    ...base, slug: 'trinity-three-stone-ring', name: 'Trinity Three-Stone Ring', category: 'ring', collection: 'bridal',
    description: 'Past, present and future: three stones on a graceful band.',
    occasions: ['engagement', 'gifting'], baseWeight: 4.2, allowedSizes: ringSizes, caratRange: { min: 0.5, max: 3 }, stoneCount: 3,
    model3d: ringProc('three-stone-ring', 2.4, { fit: 0.95 }), simulated: ['parametric-model'], manufacturing: { status: 'cad_ready' },
  },
  {
    ...base, slug: 'eternity-pave-band', name: 'Eternity Pavé Band', category: 'ring', collection: 'bridal', featured: true,
    description: 'A full circle of stones — an unbroken promise.',
    occasions: ['wedding', 'gifting'], baseWeight: 3.6, allowedSizes: ringSizes, caratRange: { min: 0.3, max: 2 }, stoneCount: 36,
    model3d: { ...proc('eternity-band', { dimensionsMm: { width: 18, height: 18, depth: 3, bandWidth: 3 }, annotations: [{ label: 'Band width', meshName: 'band', valueMm: 3 }] }) },
    simulated: ['parametric-model'], manufacturing: { status: 'approved_for_manufacturing', approvedAt: new Date() },
  },
  {
    ...base, slug: 'diva-cocktail-ring', name: 'Diva Cocktail Ring', category: 'ring', collection: 'red-carpet', featured: true,
    description: 'Statement-making scale, inspired by the bold jewellery of award-night red carpets. A large centre stone under a double halo.',
    occasions: ['gifting', 'wedding'], baseWeight: 6.8, allowedSizes: ringSizes, caratRange: { min: 1, max: 5 }, stoneCount: 26, makingValue: 14,
    model3d: ringProc('cocktail-ring', 3, { fit: 1.05 }), simulated: ['parametric-model'], manufacturing: { status: 'concept' },
  },
  {
    ...base, slug: 'classic-gold-band', name: 'Classic Gold Band', category: 'ring', collection: 'heritage', featured: false,
    description: 'A comfort-fit wedding band, the same design our craftsmen have cast for decades.',
    occasions: ['wedding', 'daily'], baseWeight: 4.2, allowedSizes: ringSizes, allowedStoneTypes: [], allowedShapes: [], allowedQualities: [],
    allowedMetals: GOLD_METALS.concat('silver-925'), makingType: 'perGram', makingValue: 650,
    model3d: proc('plain-band', { dimensionsMm: { width: 18, height: 18, depth: 4, bandWidth: 4 }, annotations: [{ label: 'Band width', meshName: 'band', valueMm: 4 }] }),
    simulated: ['parametric-model'], manufacturing: { status: 'approved_for_manufacturing', approvedAt: new Date() },
  },
  {
    ...base, slug: 'lumiere-halo-pendant', name: 'Lumière Halo Pendant', category: 'pendant', collection: 'everyday', featured: true,
    description: 'A centre stone encircled by a delicate halo, on a fine cable chain.',
    occasions: ['gifting', 'daily'], baseWeight: 2.6, allowedSizes: ['16', '18', '20'], caratRange: { min: 0.2, max: 1.5 },
    model3d: proc('halo-pendant', { fit: 1.05 }), simulated: ['parametric-model'], manufacturing: { status: 'concept' },
  },
  {
    ...base, slug: 'teardrop-solitaire-pendant', name: 'Teardrop Solitaire Pendant', category: 'pendant', collection: 'signature',
    description: 'A single pear-cut stone, hung to catch every movement.',
    occasions: ['gifting', 'daily', 'engagement'], baseWeight: 2.2, allowedSizes: ['16', '18', '20'], caratRange: { min: 0.2, max: 2 },
    model3d: proc('teardrop-pendant', { fit: 1.1 }), simulated: ['parametric-model'], manufacturing: { status: 'cad_ready' },
  },
  {
    ...base, slug: 'stellar-stud-earrings', name: 'Stellar Stud Earrings', category: 'earring', collection: 'everyday',
    description: 'Four-prong studs with secure screw-back closures.',
    occasions: ['gifting', 'daily'], baseWeight: 1.8, allowedSizes: ['std'], caratRange: { min: 0.2, max: 2 }, stoneCount: 2,
    model3d: proc('stud-earrings', { fit: 1.0 }), simulated: ['parametric-model'], manufacturing: { status: 'cad_ready' },
  },
  {
    ...base, slug: 'aurora-drop-earrings', name: 'Aurora Drop Earrings', category: 'earring', collection: 'red-carpet', featured: true,
    description: 'Long, luminous drops with a pear stone — styled for evenings that deserve a spotlight.',
    occasions: ['wedding', 'gifting'], baseWeight: 4.4, allowedSizes: ['std'], caratRange: { min: 0.4, max: 3 }, stoneCount: 4,
    model3d: proc('drop-earrings', { fit: 1.15 }), simulated: ['parametric-model'], manufacturing: { status: 'concept' },
  },
  {
    ...base, slug: 'regal-riviere-necklace', name: 'Regal Rivière Necklace', category: 'necklace', collection: 'red-carpet',
    description: 'A graduated line of stones for an unforgettable evening.',
    occasions: ['wedding'], baseWeight: 14, allowedSizes: ['16', '18', '20'], caratRange: { min: 1, max: 6 }, stoneCount: 21,
    makingValue: 14, allowedMetals: GOLD_METALS,
    model3d: proc('riviere-necklace', { fit: 1.45 }), simulated: ['parametric-model'], manufacturing: { status: 'concept' },
  },
  {
    ...base, slug: 'heritage-kada-bangle', name: 'Heritage Kada Bangle', category: 'bangle', collection: 'heritage',
    description: 'A hand-finished 22K kada with a traditional ridged texture.',
    occasions: ['wedding', 'gifting'], baseWeight: 22, allowedSizes: ['2.4', '2.6', '2.8'],
    allowedStoneTypes: [], allowedShapes: [], allowedQualities: [], allowedMetals: GOLD_METALS, makingValue: 10,
    model3d: proc('kada-bangle', { fit: 1.05 }), simulated: ['parametric-model'], manufacturing: { status: 'approved_for_manufacturing', approvedAt: new Date() },
  },
  {
    ...base, slug: 'starlight-tennis-bangle', name: 'Starlight Tennis Bangle', category: 'bangle', collection: 'red-carpet',
    description: 'A continuous line of brilliants around the wrist — a red-carpet classic.',
    occasions: ['gifting', 'wedding'], baseWeight: 12, allowedSizes: ['2.4', '2.6', '2.8'], caratRange: { min: 1, max: 6 }, stoneCount: 40, makingValue: 13,
    model3d: proc('tennis-bangle', { fit: 1.05 }), simulated: ['parametric-model'], manufacturing: { status: 'concept' },
  },
];

const sizeFactors = {
  ring: Object.fromEntries(ringSizes.map((s) => [s, +(1 + (Number(s) - 12) * 0.03).toFixed(3)])),
  pendant: { 16: 0.95, 18: 1, 20: 1.07 }, necklace: { 16: 0.9, 18: 1, 20: 1.12 },
  bangle: { '2.4': 0.92, '2.6': 1, '2.8': 1.1 }, earring: { std: 1 },
};

async function main() {
  await connectDb();

  for (const m of metals) await Metal.updateOne({ key: m.key }, m, { upsert: true });
  for (const s of stones) await Stone.updateOne({ key: s.key }, s, { upsert: true });
  for (const p of stonePrices) {
    await StonePrice.updateOne({ stoneType: p.stoneType, shape: p.shape, quality: p.quality }, p, { upsert: true });
  }
  await Design.deleteOne({ slug: 'regal-rivière-necklace' });   // renamed (ASCII slug)
  for (const d of designs) {
    const img = `/designs/${d.slug}.png`;
    await Design.updateOne({ slug: d.slug }, { ...d, images: fs.existsSync(path.resolve('../web/public' + img)) ? [img] : [] }, { upsert: true });
  }

  const settings = {
    gstPercent: 3,
    shipping: { flat: 0 },
    extras: { engraving: 500, giftBox: 750, insurancePercent: 0.5, insuranceMin: 250 },
    sizeFactors,
  };
  for (const [key, value] of Object.entries(settings)) await Setting.updateOne({ key }, { key, value }, { upsert: true });

  // 30 days of SAMPLE gold rates so charts work immediately. Replace via the admin panel / live feed.
  await GoldRate.deleteMany({ source: 'seed' });   // sample history is regenerated each seed; real/manual rates are kept
  if (!(await GoldRate.countDocuments())) {
    let g24 = 12000;
    const docs = [];
    for (let i = 29; i >= 0; i--) {
      g24 *= 1 + (Math.sin(i * 0.45) * 0.0035 + Math.sin(i * 1.3) * 0.0012);
      const date = istDate(new Date(Date.now() - i * 86400000));
      docs.push({ date, source: 'seed', createdAt: new Date(Date.now() - i * 86400000),
        rates: { ...fromGold24(g24), platinum: Math.round(g24 * 0.38), silver: Math.round(g24 * 0.0125) } });
    }
    await GoldRate.insertMany(docs);
  }

  await Coupon.updateOne({ code: 'WELCOME5' }, { code: 'WELCOME5', type: 'percent', value: 5, maxDiscount: 10000, minOrder: 20000, isActive: true }, { upsert: true });

  if (!(await User.exists({ role: 'admin' }))) {
    const pw = process.env.SEED_ADMIN_PASSWORD || crypto.randomBytes(9).toString('base64url');
    await User.create({ name: 'Fringlale Admin', email: process.env.SEED_ADMIN_EMAIL || 'admin@fringlale.com', role: 'admin', passwordHash: await bcrypt.hash(pw, 12) });
    console.log(`Admin created: ${process.env.SEED_ADMIN_EMAIL || 'admin@fringlale.com'} / ${pw}  (change it)`);
  }

  console.log(`Seeded: ${metals.length} metals, ${stones.length} stones, ${stonePrices.length} stone prices, ${designs.length} designs`);
  await mongoose.disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
