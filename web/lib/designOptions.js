// Must match server/src/services/designCheck.js (a web test keeps them in sync).
export const PROCEDURAL_STYLES = [
  ['halo-ring', 'Halo ring', 'ring'], ['three-stone-ring', 'Three-stone ring', 'ring'], ['eternity-band', 'Eternity band', 'ring'], ['cocktail-ring', 'Cocktail ring', 'ring'], ['plain-band', 'Plain band', 'ring'],
  ['halo-pendant', 'Halo pendant', 'pendant'], ['teardrop-pendant', 'Teardrop pendant', 'pendant'], ['stud-earrings', 'Stud earrings', 'earring'], ['drop-earrings', 'Drop earrings', 'earring'],
  ['riviere-necklace', 'Rivière necklace', 'necklace'], ['kada-bangle', 'Kada bangle', 'bangle'], ['tennis-bangle', 'Tennis bangle', 'bangle'],
  ['gold-bar', 'Bar', 'bar'], ['gold-coin', 'Coin', 'coin'], ['engraved-coin', 'Engraved coin', 'coin'],
];
export const SERIES = [['', 'None'], ['bridal', 'Bridal'], ['red-carpet', 'Red Carpet'], ['heritage', 'Heritage'], ['everyday', 'Everyday Luxe'], ['signature', 'Signature'], ['bullion', 'Bullion & Coins']];
export const OCCASIONS = [['wedding', 'Wedding'], ['engagement', 'Engagement'], ['gifting', 'Gifting'], ['daily', 'Daily wear'], ['investment', 'Investment'], ['festival', 'Festival']];
export const STANDARD_SHAPES = ['round', 'oval', 'pear', 'cushion', 'emerald', 'heart', 'princess'];
export const SIZE_PRESETS = {
  ring: ['8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20'], pendant: ['16', '18', '20'], necklace: ['16', '18', '20'], earring: ['std'],
  bangle: ['2.4', '2.6', '2.8'], bar: ['1', '5', '10', '20', '50', '100'], coin: ['1', '2', '4', '5', '8', '10', '20'], 'gold-item': ['std'],
};
export const slugify = (s) => s.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').slice(0, 80);

/** A blank, valid-shaped draft for a category. */
export function blankDesign(category = 'ring') {
  const bullion = ['bar', 'coin'].includes(category);
  return {
    slug: '', name: '', category, series: '', description: '', occasions: [], images: [], baseWeight: bullion ? 1 : 3, makingType: bullion ? 'perGram' : 'percent', makingValue: bullion ? 200 : 12,
    allowedMetals: [], allowedStoneTypes: [], allowedShapes: [], allowedQualities: [], allowedSizes: SIZE_PRESETS[category] || ['std'],
    sizeFactors: bullion ? Object.fromEntries((SIZE_PRESETS[category] || []).map((g) => [g, Number(g)])) : undefined,
    caratRange: { min: 0.2, max: 3 }, stoneCount: 1, engravingMaxChars: 15,
    model3d: { procedural: (PROCEDURAL_STYLES.find((s) => s[2] === category) || [])[0], fit: 1, assetVariants: [], assetBackedMetals: [], explodedView: false, components: [], annotations: [] },
    simulated: ['parametric-model'], isActive: false, featured: false,
  };
}

/** Strip server-only fields and normalise for the strict admin API. */
export function toPayload(f) {
  const m = f.model3d || {};
  const procedural = m.useGlb ? undefined : m.procedural;
  const hasGlb = !!(m.primaryGlbUrl || m.assetVariants?.length);
  const model3d = {
    ...(m.primaryGlbUrl ? { primaryGlbUrl: m.primaryGlbUrl } : {}), ...(procedural ? { procedural } : {}), fit: Number(m.fit) || 1,
    assetVariants: (m.assetVariants || []).filter((v) => v.glbUrl).map(({ key, stoneShape, glbUrl }) => ({ key: key || stoneShape || 'main', ...(stoneShape ? { stoneShape } : {}), glbUrl })),
    assetBackedMetals: m.assetBackedMetals || [], explodedView: !!m.explodedView && (m.components || []).length > 0,
    components: (m.components || []).filter((c) => c.id && c.meshName).map(({ id, label, meshName }) => ({ id, label: label || id, meshName })),
    annotations: (m.annotations || []).filter((a) => a.label && a.meshName && a.valueMm !== '' && a.valueMm != null).map(({ label, meshName, valueMm }) => ({ label, meshName, valueMm: Number(valueMm) })),
    ...(m.dimensionsMm ? { dimensionsMm: m.dimensionsMm } : {}),
  };
  const hasStone = f.allowedStoneTypes.length > 0;
  return {
    slug: f.slug, name: f.name.trim(), category: f.category, ...(f.series ? { series: f.series } : {}), description: f.description || '', occasions: f.occasions || [], images: f.images || [],
    baseWeight: Number(f.baseWeight), makingType: f.makingType, makingValue: Number(f.makingValue),
    allowedMetals: f.allowedMetals, allowedStoneTypes: f.allowedStoneTypes, allowedShapes: hasStone ? f.allowedShapes : [], allowedQualities: hasStone ? f.allowedQualities : [],
    allowedSizes: f.allowedSizes, ...(f.sizeFactors && Object.keys(f.sizeFactors).length ? { sizeFactors: Object.fromEntries(Object.entries(f.sizeFactors).map(([k, v]) => [k, Number(v)])) } : {}),
    caratRange: { min: Number(f.caratRange?.min) || 0.1, max: Number(f.caratRange?.max) || 3 }, stoneCount: Number(f.stoneCount) || 1, engravingMaxChars: Number(f.engravingMaxChars) || 0,
    model3d, simulated: procedural ? ['parametric-model'] : hasGlb ? [] : ['model-proxy'], isActive: !!f.isActive, featured: !!f.featured,
  };
}

/** Load a saved design into editor state. */
export function fromDesign(d) {
  const m = d.model3d || {};
  return { ...blankDesign(d.category), ...d, series: d.series || '', model3d: { ...m, useGlb: !m.procedural && !!(m.primaryGlbUrl || m.assetVariants?.length), assetVariants: m.assetVariants || [], assetBackedMetals: m.assetBackedMetals || [], components: m.components || [], annotations: m.annotations || [] } };
}
