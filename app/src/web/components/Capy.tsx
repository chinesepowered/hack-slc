// Capy, CapyKube's mascot: an original capybara drawn in SVG. Moods follow
// the app's real health (see LiveBoard): chill in the hot spring when the
// Plan B SLO is green, worried when the error budget burns.
export type CapyMood = 'chill' | 'happy' | 'worried' | 'sleepy';

interface Props {
  mood?: CapyMood;
  size?: number;
  /** Sit in the hot spring (steam and water). */
  spring?: boolean;
  /** The yuzu on top: Capy's crown when everything is fine. */
  yuzu?: boolean;
  title?: string;
  className?: string;
}

const FUR = '#b9845a';
const FUR_DARK = '#9a6a45';
const SNOUT = '#8c5d3e';
const INK = '#3a2719';

export function Capy({ mood = 'happy', size = 120, spring = false, yuzu = mood === 'chill', title, className }: Props) {
  const label = title ?? `Capy the capybara, feeling ${mood}`;
  return (
    <svg
      className={`capy capy--${mood} ${className ?? ''}`}
      width={size}
      height={size}
      viewBox="0 0 200 200"
      role="img"
      aria-label={label}
    >
      <title>{label}</title>
      {spring && (
        <g className="capy__steam" stroke="#ffffff" strokeWidth="5" strokeLinecap="round" fill="none" opacity="0.85">
          <path d="M28 70 q-8 -12 0 -24 q8 -12 0 -24" />
          <path d="M172 76 q-8 -12 0 -24 q8 -12 0 -24" />
        </g>
      )}
      <g className="capy__body">
        {/* body */}
        <ellipse cx="100" cy="168" rx="78" ry="44" fill={FUR} />
        <ellipse cx="100" cy="176" rx="46" ry="26" fill="#d4a179" opacity="0.6" />
        {/* ears */}
        <circle cx="58" cy="50" r="15" fill={FUR_DARK} />
        <circle cx="142" cy="50" r="15" fill={FUR_DARK} />
        <circle cx="58" cy="51" r="7" fill="#e3b08c" />
        <circle cx="142" cy="51" r="7" fill="#e3b08c" />
        {/* head */}
        <rect x="36" y="40" width="128" height="112" rx="52" fill={FUR} />
        {/* snout */}
        <rect x="58" y="98" width="84" height="52" rx="26" fill={SNOUT} />
        <ellipse cx="86" cy="113" rx="5.5" ry="4" fill={INK} />
        <ellipse cx="114" cy="113" rx="5.5" ry="4" fill={INK} />
        <path d="M90 132 q10 8 20 0" stroke={INK} strokeWidth="3.5" strokeLinecap="round" fill="none" />
        {/* cheeks */}
        <ellipse cx="54" cy="104" rx="11" ry="7" fill="#f19c9c" opacity="0.55" />
        <ellipse cx="146" cy="104" rx="11" ry="7" fill="#f19c9c" opacity="0.55" />
        {/* eyes */}
        {mood === 'chill' || mood === 'sleepy' ? (
          <g stroke={INK} strokeWidth="5" strokeLinecap="round" fill="none">
            <path d={mood === 'sleepy' ? 'M64 82 h22' : 'M63 80 q11 9 22 0'} />
            <path d={mood === 'sleepy' ? 'M114 82 h22' : 'M115 80 q11 9 22 0'} />
          </g>
        ) : (
          <g>
            <circle cx="74" cy="80" r="7.5" fill={INK} />
            <circle cx="126" cy="80" r="7.5" fill={INK} />
            <circle cx="76.5" cy="77" r="2.6" fill="#fff" />
            <circle cx="128.5" cy="77" r="2.6" fill="#fff" />
          </g>
        )}
        {mood === 'worried' && (
          <g>
            <path d="M62 68 q10 -2 20 -8" stroke={INK} strokeWidth="4" strokeLinecap="round" fill="none" />
            <path d="M138 68 q-10 -2 -20 -8" stroke={INK} strokeWidth="4" strokeLinecap="round" fill="none" />
            <path className="capy__sweat" d="M170 70 q8 12 0 18 q-8 -6 0 -18 z" fill="#7cc7f2" />
          </g>
        )}
      </g>
      {yuzu && (
        <g className="capy__yuzu">
          <circle cx="100" cy="30" r="17" fill="#f6a623" />
          <circle cx="94" cy="24" r="4.5" fill="#ffd27a" opacity="0.9" />
          <path d="M100 14 q10 -10 20 -4 q-8 8 -20 4 z" fill="#6cbf5b" />
        </g>
      )}
      {spring && (
        <g className="capy__water">
          <path
            d="M0 150 q25 -12 50 0 t50 0 t50 0 t50 0 V200 H0 Z"
            fill="#5fc4bd"
            opacity="0.92"
          />
          <path d="M18 168 q14 -6 28 0 M108 176 q14 -6 28 0 M150 160 q12 -5 24 0" stroke="#bff0ea" strokeWidth="4" strokeLinecap="round" fill="none" />
        </g>
      )}
    </svg>
  );
}
