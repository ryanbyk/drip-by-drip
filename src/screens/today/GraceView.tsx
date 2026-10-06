import { useState } from "react";
import { formatAskTime } from "../../domain/dates";
import { GRACE_BODY, GRACE_TITLE } from "../../domain/types";
import { useApp } from "../../state/AppState";
import { Button } from "../../components/ui";

export function GraceView({ onHistory, onReadAfterAll }: { onHistory: () => void; onReadAfterAll: () => void }) {
  const { snapshot } = useApp();
  const [settled, setSettled] = useState(false);

  return (
    <div className="grace">
      <div className="grace-copy">
        <h1>{GRACE_TITLE}</h1>
        <p>{GRACE_BODY}</p>
        <p className="soft">We’ll ask again tomorrow at {formatAskTime(snapshot.prefs.askTime)}.</p>
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
        <Button variant="text" onClick={onReadAfterAll}>
          I want to read after all
        </Button>
      </div>
    </div>
  );
}
