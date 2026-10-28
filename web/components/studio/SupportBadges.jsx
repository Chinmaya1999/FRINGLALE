import { MFG_LABELS, SIM_LABELS } from '@/lib/format';

/** The honesty panel: what is real 3D, what is simulated, and whether the design can actually be made. */
export default function SupportBadges({ support, isProxy, parametric, compact }) {
  if (!support) return null;
  const mfg = support.manufacturingStatus;
  const tone = { concept: 'bg-amber-100 text-amber-900', cad_ready: 'bg-sky-100 text-sky-900', approved_for_manufacturing: 'bg-emerald-100 text-emerald-900' }[mfg];
  const sim = support.simulatedFeatures.filter((f) => (f !== 'model-proxy' || isProxy) && (f !== 'parametric-model' || parametric));
  return (
    <div className={`space-y-2 text-xs ${compact ? '' : 'rounded-xl border border-gold/30 bg-white p-3'}`} data-testid="support-badges">
      <div className="flex flex-wrap gap-1.5">
        <span className={`rounded-full px-2.5 py-1 font-semibold ${support.assetBacked ? 'bg-navy text-white' : 'bg-gray-200 text-gray-800'}`}>
          {support.assetBacked ? '● Real 3D model for this configuration' : '◐ Simulated preview'}
        </span>
        <span className={`rounded-full px-2.5 py-1 font-semibold ${tone}`}>{MFG_LABELS[mfg]}</span>
      </div>
      {parametric && <p className="text-gray-600">This 3D shape is generated from the design’s proportions to preview style, stone and metal. It is not final CAD — you approve the real CAD and wax model before anything is made.</p>}
      {isProxy && <p className="text-gray-600">The 3D shape shown is a generic placeholder. The final piece follows the design photos and approved CAD.</p>}
      {sim.length > 0 && (
        <p className="text-gray-600"><span className="font-semibold text-gray-800">Visually simulated:</span> {sim.map((f) => SIM_LABELS[f] || f).join(' · ')}.</p>
      )}
      {!support.approvedForManufacturing && <p className="text-gray-600">Our team will confirm feasibility and share CAD for your approval before any production begins.</p>}
    </div>
  );
}
