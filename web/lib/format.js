export const inr = (n, d = 0) =>
  n == null ? '—' : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: d, minimumFractionDigits: d }).format(n);

export const STAGE_LABELS = {
  order_placed: 'Order Placed', design_cad_ready: 'Design / CAD Ready', customer_approval: 'Customer Approval',
  wax_model: 'Wax Model', casting: 'Casting', stone_setting: 'Stone Setting', polishing: 'Polishing',
  hallmarking: 'Hallmarking (HUID)', quality_check: 'Quality Check', shipped: 'Shipped', delivered: 'Delivered',
};
export const STAGES = Object.keys(STAGE_LABELS);

export const SHAPE_LABELS = { round: 'Round', oval: 'Oval', pear: 'Pear', cushion: 'Cushion', emerald: 'Emerald', heart: 'Heart', princess: 'Princess' };
export const CATEGORY_LABELS = { ring: 'Ring', pendant: 'Pendant', earring: 'Earrings', necklace: 'Necklace', bangle: 'Bangle' };

export const SIM_LABELS = {
  'stone-shape': 'Stone shape', 'metal-finish': 'Metal finish', engraving: 'Engraving text', 'gemstone-colour': 'Gemstone colour',
  'model-proxy': 'Placeholder model geometry', 'parametric-model': 'Parametric 3D preview (not final CAD)', 'stone-size': 'Stone size (scaled to carat)',
};
export const MFG_LABELS = {
  concept: 'Concept — not yet engineered',
  cad_ready: 'CAD ready — pending manufacturing approval',
  approved_for_manufacturing: 'Approved for manufacturing',
};
