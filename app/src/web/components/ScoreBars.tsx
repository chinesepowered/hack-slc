// The scheduler's score plugins for one candidate, as small bars.
import type { ScoreBreakdown } from '../../shared/scoring';

const LABELS: Array<[keyof Omit<ScoreBreakdown, 'total'>, string]> = [
  ['topic', 'Topic'],
  ['walk', 'Walk'],
  ['seats', 'Seats'],
  ['start', 'Starts'],
];

export function ScoreBars({ scores, compact = false }: { scores: ScoreBreakdown; compact?: boolean }) {
  return (
    <div className={`scores ${compact ? 'scores--compact' : ''}`}>
      {LABELS.map(([key, label]) => (
        <div className="scores__row" key={key}>
          <span className="scores__label">{label}</span>
          <span className="scores__track" role="meter" aria-label={`${label} score`} aria-valuemin={0} aria-valuemax={1} aria-valuenow={Number(scores[key].toFixed(2))}>
            <span className={`scores__fill scores__fill--${key}`} style={{ width: `${Math.round(scores[key] * 100)}%` }} />
          </span>
          <span className="scores__value">{scores[key].toFixed(2)}</span>
        </div>
      ))}
      <div className="scores__total">
        score <b>{scores.total.toFixed(3)}</b>
      </div>
    </div>
  );
}
