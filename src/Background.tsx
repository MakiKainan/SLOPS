/** Decorative sticker sheet, tucked behind the booth. */
export default function Background() {
  return (
    <div className="sticker-background pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
      <svg width="100%" height="100%" focusable="false">
        <defs>
          <pattern id="glitter" width="170" height="190" patternUnits="userSpaceOnUse">
            <path d="M26 24v12m-6-6h12M130 120v8m-4-4h8" stroke="#fff9cf" strokeWidth="2" strokeLinecap="round" />
            <circle cx="80" cy="70" r="2" fill="#fff" />
            <circle cx="150" cy="48" r="2.5" fill="#f7d981" />
            <circle cx="44" cy="158" r="1.5" fill="#fff" />
            <path d="m110 164 3 5-3 5-3-5Z" fill="#fff9cf" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#glitter)" opacity=".7" />
      </svg>
      <span className="background-sticker" style={{ left: 'var(--sticker-inset)', top: '12%', rotate: '-18deg' }}>🌼</span>
      <span className="background-sticker" style={{ right: 'var(--sticker-inset)', top: '7%', rotate: '16deg' }}>🍒</span>
      <span className="background-sticker" style={{ left: 'var(--sticker-inset)', bottom: '4%', rotate: '-14deg' }}>🍓</span>
      <span className="background-sticker" style={{ right: 'var(--sticker-inset)', bottom: '5%', rotate: '18deg' }}>🌈</span>
    </div>
  );
}
