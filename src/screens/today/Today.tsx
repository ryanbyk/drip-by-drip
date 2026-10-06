import { useEffect, useState } from "react";
import type { ResolvedPassage } from "../../domain/resolve";
import { backupLabel, resolvePassage } from "../../domain/resolve";
import type { Snapshot } from "../../domain/types";
import { useApp } from "../../state/AppState";
import { AskView } from "./AskView";
import { DogView } from "./DogView";
import { DoneView } from "./DoneView";
import { GraceView } from "./GraceView";
import {
  AdjustSheet,
  ChangeBookSheet,
  CommitSheet,
  DetourView,
  FinishedView,
  ReflectView,
  StopSheet,
} from "./MoreViews";
import { PassageView } from "./PassageView";
import { RecapView } from "./RecapView";

type Phase = "ask" | "grace" | "passage" | "done" | "finished";
type Intro = "commit" | "dog" | null;
type Mode = "read" | "reflect" | "detour" | "recap";
type SheetName = "adjust" | "stop" | "books" | null;

function phaseOf(snapshot: Snapshot, today: string, passage: ResolvedPassage): Phase {
  const day = snapshot.days[today];
  if (!day || day.answer === "unanswered") return "ask";
  if (day.answer === "not_today") return "grace";
  if (day.readDone) return "done";
  if (passage.kind === "finished" || passage.kind === "plan-finished") return "finished";
  return "passage";
}

export function Today({ onHistory }: { onHistory: () => void }) {
  const app = useApp();
  const { snapshot, today, dispatch } = app;
  const passage = resolvePassage(snapshot, today);
  const phase = phaseOf(snapshot, today, passage);
  const [intro, setIntro] = useState<Intro>(null);
  const [mode, setMode] = useState<Mode>("read");
  const [sheet, setSheet] = useState<SheetName>(null);
  const [bookWhen, setBookWhen] = useState<"today" | "track">("track");

  useEffect(() => {
    setIntro(null);
    setMode("read");
    setSheet(null);
  }, [today]);

  function answerYes() {
    dispatch({ type: "answer", today, at: new Date().toISOString(), answer: "yes" });
    setIntro("commit");
  }

  function answerNotToday() {
    dispatch({ type: "answer", today, at: new Date().toISOString(), answer: "not_today" });
    setIntro(null);
  }

  function readIt() {
    const detour = mode === "detour" || passage.kind === "detour" || snapshot.days[today]?.detour;
    if (passage.kind === "book" && !detour) {
      setMode("read");
      setSheet("stop");
      return;
    }
    dispatch({ type: "finish", today, at: new Date().toISOString() });
    setMode("read");
  }

  if (intro === "dog") {
    return (
      <section className="screen screen-tabbed">
        <DogView onSkip={() => setIntro(null)} onContinue={() => setIntro(null)} />
      </section>
    );
  }

  if (mode === "reflect" && snapshot.days[today]?.answer === "yes" && !snapshot.days[today]?.readDone) {
    return (
      <section className="screen screen-tabbed">
        <ReflectView onKeep={() => setMode("read")} onRead={readIt} />
        {sheet === "stop" && passage.kind === "book" ? <StopSheet onClose={() => setSheet(null)} /> : null}
      </section>
    );
  }

  if (mode === "recap") {
    return (
      <section className="screen screen-tabbed">
        <RecapView onNext={() => setMode("read")} />
      </section>
    );
  }

  if (mode === "detour" && snapshot.days[today]?.answer === "yes" && !snapshot.days[today]?.readDone) {
    return (
      <section className="screen screen-tabbed">
        <DetourView
          onBack={() => {
            dispatch({ type: "clearDetour", today });
            setMode("read");
          }}
          onUse={(ref) => dispatch({ type: "detour", today, ref })}
          onReflect={() => setMode("reflect")}
          onRead={readIt}
          backup={backupLabel(snapshot)}
        />
      </section>
    );
  }

  return (
    <section className="screen screen-tabbed">
      {phase === "ask" || intro === "commit" ? (
        <AskView onYes={answerYes} onNotToday={answerNotToday} />
      ) : null}
      {phase === "grace" && intro !== "commit" ? (
        <GraceView onHistory={onHistory} onReadAfterAll={answerYes} />
      ) : null}
      {phase === "done" ? <DoneView /> : null}
      {phase === "finished" && intro !== "commit" ? (
        <FinishedView
          onDetour={() => setMode("detour")}
          onRecap={() => setMode("recap")}
          onChoose={() => {
            setBookWhen("today");
            setSheet("books");
          }}
        />
      ) : null}
      {phase === "passage" && intro !== "commit" && passage.kind !== "finished" && passage.kind !== "plan-finished" ? (
        <PassageView
          passage={passage}
          onAdjust={() => setSheet("adjust")}
          onChangeBook={() => {
            setBookWhen("track");
            setSheet("books");
          }}
          onDetour={() => setMode("detour")}
          onUseDetour={(ref) => dispatch({ type: "detour", today, ref })}
          onBackToBook={() => dispatch({ type: "clearDetour", today })}
          onReflect={() => setMode("reflect")}
          onRead={readIt}
          onPlanRef={(ref) => dispatch({ type: "planRef", today, ref })}
        />
      ) : null}
      {intro === "commit" ? <CommitSheet onContinue={() => setIntro("dog")} /> : null}
      {sheet === "adjust" && passage.kind === "book" ? (
        <AdjustSheet
          onClose={() => setSheet(null)}
          onDetour={(ref) => {
            dispatch({ type: "detour", today, ref });
            setSheet(null);
          }}
        />
      ) : null}
      {sheet === "stop" && passage.kind === "book" ? <StopSheet onClose={() => setSheet(null)} /> : null}
      {sheet === "books" ? <ChangeBookSheet when={bookWhen} onClose={() => setSheet(null)} /> : null}
    </section>
  );
}
