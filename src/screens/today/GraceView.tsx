import { useState } from "react";
import { formatAskTime } from "../../domain/dates";
import { GRACE_BODY, GRACE_TITLE } from "../../domain/types";
import { useApp } from "../../state/AppState";
import { MoonStar } from "../../components/Icons";
import { Button } from "../../components/ui";

export function GraceView({ onHistory, onReadAfterAll }: { onHistory: () => void; onReadAfterAll: () => void }) {
  const { snapshot } = useApp();
  const [settled, setSettled] = useState(false);

  return (
    <div className="grace">
      <div className="grace-copy">
        <div className="grace-mark" aria-hidden="true">
          <MoonStar size={24} />
        </div>
        <h1 className="display-48">{GRACE_TITLE}</h1>
        <p className="grace-body">{GRACE_BODY}</p>
        <p className="grace-next">We’ll ask again tomorrow at {formatAskTime(snapshot.prefs.askTime)}.</p>
      </div>
      <div className="footer">
        {settled ? null : (
          <Button variant="quiet" onClick={() => setSettled(true)}>
            Close
          </Button>
        )}
        <Button variant="text" onClick={onHistory}>
          View history
        </Button>
        <button type="button" className="text-link" onClick={onReadAfterAll}>
          I want to read after all
        </button>
      </div>
    </div>
  );
}
