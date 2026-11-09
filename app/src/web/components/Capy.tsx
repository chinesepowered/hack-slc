// Capy, CapyKube's mascot: an original capybara drawn in SVG. Moods follow
// the app's real health (see LiveBoard): chill in the hot spring when the
// Plan B SLO is green, worried when the error budget burns.
import { useId } from 'react';

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

const FUR = '#bb8659';
const FUR_LIGHT = '#cf9d70';
const FUR_DARK = '#9a6a45';
const NOSE = '#7d5034';
const INK = '#3a2719';
const BLUSH = '#f19c9c';

function Eyes({ mood }: { mood: CapyMood }) {
  if (mood === 'chill') {
    // Closed and content: the hot-spring face.
    return (
      <g stroke={INK} strokeWidth="5" strokeLinecap="round" fill="none">
        <path d="M59 84 q10 9 20 0" />
        <path d="M121 84 q10 9 20 0" />
      </g>
    );
  }
  if (mood === 'sleepy') {
    return (
      <g stroke={INK} strokeWidth="5" strokeLinecap="round" fill="none">
        <path d="M59 86 h20" />
        <path d="M121 86 h20" />
      </g>
    );
  }
  return (
    <g className="capy__eyes">
      <ellipse cx="69" cy="84" rx="7" ry="8" fill={INK} />
      <ellipse cx="131" cy="84" rx="7" ry="8" fill={INK} />
      <circle cx="71.5" cy="80.5" r="2.8" fill="#fff" />
      <circle cx="133.5" cy="80.5" r="2.8" fill="#fff" />
      {mood === 'happy' && (
        // Half-lowered lids: a capybara is never in a hurry.
        <g fill={FUR}>
          <path d="M60 80 q9 -9 18 0 v-6 h-18 z" />
          <path d="M122 80 q9 -9 18 0 v-6 h-18 z" />
        </g>
      )}
    </g>
  );
}

export function Capy({ mood = 'happy', size = 120, spring = false, yuzu = mood === 'chill', title, className }: Props) {
  const label = title ?? `Capy the capybara, feeling ${mood}`;
  const clip = useId();
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
        <g className="capy__steam" stroke="#ffffff" strokeWidth="5" strokeLinecap="round" fill="none" opacity="0.9">
          <path d="M22 78 q-8 -11 0 -22 q8 -11 0 -22" />
          <path d="M178 84 q-8 -11 0 -22 q8 -11 0 -22" />
          <path d="M44 40 q-6 -8 0 -16 q6 -8 0 -16" />
        </g>
      )}
      <g className="capy__body">
        {/* body: a loaf */}
        <ellipse cx="100" cy="166" rx="76" ry="42" fill={FUR} />
        <ellipse cx="100" cy="176" rx="44" ry="24" fill={FUR_LIGHT} opacity="0.75" />
        {!spring && (
          <g fill={FUR_DARK}>
            <ellipse cx="66" cy="196" rx="17" ry="8" />
            <ellipse cx="134" cy="196" rx="17" ry="8" />
          </g>
        )}
        {/* ears: small, high and wide apart */}
        <g className="capy__ear capy__ear--left">
          <ellipse cx="57" cy="46" rx="13" ry="11" fill={FUR_DARK} transform="rotate(-24 57 46)" />
          <ellipse cx="58" cy="48" rx="6" ry="5" fill="#e0a887" transform="rotate(-24 58 48)" />
        </g>
        <g className="capy__ear capy__ear--right">
          <ellipse cx="143" cy="46" rx="13" ry="11" fill={FUR_DARK} transform="rotate(24 143 46)" />
          <ellipse cx="142" cy="48" rx="6" ry="5" fill="#e0a887" transform="rotate(24 142 48)" />
        </g>
        {/* head: tall and blunt, widest at the muzzle */}
        <path d="M50 80 C50 50 72 34 100 34 C128 34 150 50 150 80 L154 120 C154 144 132 156 100 156 C68 156 46 144 46 120 Z" fill={FUR} />
        <path d="M64 58 C72 44 88 40 104 41" stroke="#fff" strokeWidth="7" strokeLinecap="round" fill="none" opacity="0.13" />
        {/* cheeks */}
        <ellipse cx="60" cy="112" rx="11" ry="7" fill={BLUSH} opacity="0.55" />
        <ellipse cx="140" cy="112" rx="11" ry="7" fill={BLUSH} opacity="0.55" />
        <Eyes mood={mood} />
        {/* the wide, flat nose and a small rodent smile */}
        <rect x="74" y="100" width="52" height="27" rx="13.5" fill={NOSE} />
        <ellipse cx="87" cy="112" rx="4.6" ry="3.4" fill={INK} />
        <ellipse cx="113" cy="112" rx="4.6" ry="3.4" fill={INK} />
        <g stroke={INK} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" fill="none">
          {mood === 'worried' ? (
            <path d="M100 127 v6 M89 143 q11 -9 22 0" />
          ) : (
            <path d="M100 127 v7 M100 134 q-7 8 -15 2 M100 134 q7 8 15 2" />
          )}
        </g>
        <g fill={NOSE} opacity="0.7">
          <circle cx="62" cy="126" r="1.8" />
          <circle cx="68" cy="132" r="1.8" />
          <circle cx="138" cy="126" r="1.8" />
          <circle cx="132" cy="132" r="1.8" />
        </g>
        {mood === 'worried' && (
          <g>
            <path d="M56 70 q11 -1 22 -9" stroke={INK} strokeWidth="4.5" strokeLinecap="round" fill="none" />
            <path d="M144 70 q-11 -1 -22 -9" stroke={INK} strokeWidth="4.5" strokeLinecap="round" fill="none" />
            <path className="capy__sweat" d="M172 66 q9 13 0 20 q-9 -7 0 -20 z" fill="#7cc7f2" />
          </g>
        )}
        {!spring && (
          <g fill={FUR_DARK}>
            <ellipse cx="76" cy="162" rx="12" ry="9" />
            <ellipse cx="124" cy="162" rx="12" ry="9" />
          </g>
        )}
      </g>
      {yuzu && (
        <g className="capy__yuzu">
          <circle cx="100" cy="27" r="17" fill="#f6a623" />
          <circle cx="100" cy="27" r="17" fill="none" stroke="#e08e12" strokeWidth="2" opacity="0.5" />
          <circle cx="93" cy="21" r="4.5" fill="#ffd98a" opacity="0.95" />
          <path d="M100 11 q11 -11 22 -4 q-9 9 -22 4 z" fill="#6cbf5b" />
          <path d="M100 11 q-2 -4 1 -7" stroke="#5a8f43" strokeWidth="2.6" strokeLinecap="round" fill="none" />
        </g>
      )}
      {spring && (
        <g className="capy__water" clipPath={`url(#${clip})`}>
          <clipPath id={clip}>
            <rect x="0" y="120" width="200" height="80" rx="30" />
          </clipPath>
          <path className="capy__wave" d="M-50 152 q25 -12 50 0 t50 0 t50 0 t50 0 t50 0 t50 0 V200 H-50 Z" fill="#5fc4bd" opacity="0.93" />
          <path d="M16 170 q14 -6 28 0 M150 164 q12 -5 24 0" stroke="#bff0ea" strokeWidth="4" strokeLinecap="round" fill="none" />
          {/* paws on the edge of the water, and a yuzu floating by */}
          <ellipse cx="74" cy="154" rx="13" ry="8" fill={FUR_DARK} />
          <ellipse cx="126" cy="154" rx="13" ry="8" fill={FUR_DARK} />
          <g className="capy__float">
            <circle cx="170" cy="182" r="9" fill="#f6a623" />
            <circle cx="167" cy="179" r="2.6" fill="#ffd98a" />
          </g>
        </g>
      )}
    </svg>
  );
}
