import { CATEGORY_LABELS, SHAPE_LABELS } from '@/lib/format';

export default function SpecSummary({ design, config, quote, metals, stones }) {
  const metal = metals.find((m) => m.key === config.metal);
  const stone = stones.find((s) => s.key === config.stoneType);
  const rows = [
    ['Design', design.name], ['Type', CATEGORY_LABELS[design.category]],
    ['Metal', metal?.label || config.metal],
    ['Net metal weight', quote?.price ? `${quote.price.finalWeight} g` : '…'],
    ['Stone', stone ? `${stone.label}, ${SHAPE_LABELS[config.shape]}, ${config.carat} ct, ${config.quality}` : 'None'],
    [design.category === 'ring' ? 'Ring size' : design.category === 'bangle' ? 'Bangle size (in)' : ['bar', 'coin'].includes(design.category) ? 'Weight (g)' : 'Size / length', config.size],
    ['Engraving', config.engraving || '—'],
    ...(['bar', 'coin'].includes(design.category)
      ? [['Purity', metal?.purity ? `${(metal.purity * 100).toFixed(metal.purity > 0.99 ? 2 : 1)}% fine` : '—']]
      : [['Hallmark', 'BIS Hallmark with HUID'], ['Certificate', stone?.certified ? 'IGI / GIA certified' : '—']]),
  ];
  return (
    <dl className="card divide-y divide-gray-100 text-sm" data-testid="spec-summary">
      {rows.map(([k, v]) => <div key={k} className="flex justify-between gap-4 px-4 py-2"><dt className="text-gray-500">{k}</dt><dd className="text-right font-medium">{v}</dd></div>)}
    </dl>
  );
}
