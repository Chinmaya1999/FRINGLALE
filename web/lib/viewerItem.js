export const PROXY_GLB = '/models/ring-solitaire-round.glb';

// Approximate footprints used ONLY when no dedicated GLB exists for a stone shape (a labelled simulation).
export const SHAPE_SCALE = {
  round: [1, 1], oval: [0.8, 1.22], pear: [0.82, 1.28], cushion: [1, 0.95],
  emerald: [0.78, 1.25], heart: [1.05, 1], princess: [0.9, 0.9],
};

/** Map a design + configuration + quote support block to what the 3D scene needs. */
export function buildViewerItem({ design, config, support, metals, stones, label }) {
  const metal = metals.find((m) => m.key === config.metal) || null;
  const stone = config.stoneType ? stones.find((s) => s.key === config.stoneType) || null : null;
  return {
    key: label || 'main',
    label,
    // A parametric style is used only when no real GLB variant exists for the chosen shape.
    procedural: !support?.variantKey && design.model3d?.procedural ? design.model3d.procedural : null,
    fit: design.model3d?.fit || 1,
    glbUrl: support?.glbUrl || design.model3d?.primaryGlbUrl || PROXY_GLB,
    lodUrls: design.model3d?.assetVariants?.find((v) => v.key === support?.variantKey)?.lodUrls,
    isProxy: !design.model3d?.procedural && (!!design.simulated?.includes('model-proxy') || !(support?.glbUrl || design.model3d?.primaryGlbUrl)),
    parametric: !support?.variantKey && !!design.model3d?.procedural,
    realShape: !!support?.variantKey,
    metal, stone,
    shape: config.shape || 'round',
    carat: config.carat || 0.5,
    weightG: ['bar', 'coin'].includes(design.category) ? Number(config.size) || 10 : null,
    engraving: config.engraving || '',
    components: support?.components || [],
    explodedView: !!support?.explodedView,
    annotations: design.model3d?.annotations || [],
    dimensionsMm: design.model3d?.dimensionsMm,
    support,
  };
}
