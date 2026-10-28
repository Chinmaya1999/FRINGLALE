/** A valid starting configuration for a design, honouring what the design allows and what is priced. */
export function defaultConfig(design, matrix) {
  const stoneType = design.allowedStoneTypes?.[0];
  const shapes = stoneType ? (design.allowedShapes || []).filter((s) => matrix[stoneType]?.[s]) : [];
  const shape = shapes.includes('round') ? 'round' : shapes[0];
  const quals = stoneType && shape ? (design.allowedQualities || []).filter((q) => matrix[stoneType][shape].includes(q)) : [];
  const sizes = design.allowedSizes || [];
  return {
    metal: design.allowedMetals.includes('yellow-18K') ? 'yellow-18K' : design.allowedMetals[0],
    stoneType, shape, quality: quals.includes('VS-GH') ? 'VS-GH' : quals[0],
    carat: stoneType ? Math.min(Math.max(0.5, design.caratRange.min), design.caratRange.max) : undefined,
    size: sizes.includes('12') ? '12' : sizes[Math.floor(sizes.length / 2)] || '',
    engraving: '', giftBox: false, insurance: true,
  };
}
