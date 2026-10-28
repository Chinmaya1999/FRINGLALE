const PATHS = {
  round: <circle cx="24" cy="24" r="15" />,
  oval: <ellipse cx="24" cy="24" rx="11" ry="17" />,
  pear: <path d="M24 6C31 16 37 22 37 30a13 13 0 0 1-26 0c0-8 6-14 13-24Z" />,
  cushion: <rect x="10" y="10" width="28" height="28" rx="9" />,
  emerald: <path d="M16 8h16l6 6v20l-6 6H16l-6-6V14Z" />,
  heart: <path d="M24 40C8 28 8 16 15 12c4-2 8 0 9 4 1-4 5-6 9-4 7 4 7 16-9 28Z" />,
  princess: <rect x="11" y="11" width="26" height="26" />,
};
export default function ShapeIcon({ shape, className = 'h-10 w-10' }) {
  return <svg viewBox="0 0 48 48" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">{PATHS[shape]}<path d="M16 24h16M24 14v20" strokeOpacity=".35" strokeWidth="1" /></svg>;
}
