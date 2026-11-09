// A 1920 × 1080 stage for the demo video: the live board with an attendee's
// phone beside it, so one recording shows both sides of a Plan B.
import { LiveBoard } from './LiveBoard';

export function DemoStage() {
  return (
    <div className="stage">
      <div className="stage__board">
        <LiveBoard compact />
      </div>
      <div className="stage__phone" aria-label="Attendee phone">
        <div className="phone">
          <div className="phone__notch" />
          <iframe title="CapyKube on an attendee's phone" src="/?embed=1" className="phone__screen" />
        </div>
      </div>
    </div>
  );
}
