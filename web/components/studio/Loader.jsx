'use client';
import { useProgress } from '@react-three/drei';

export default function Loader() {
  const { active, progress } = useProgress();
  if (!active) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 bg-white/10" role="progressbar" aria-label="Loading 3D model" aria-valuenow={Math.round(progress)}>
      <div className="h-full bg-gold transition-all" style={{ width: `${progress}%` }} />
    </div>
  );
}
