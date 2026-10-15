import { useEffect, useState, type ReactNode } from "react";
import { normalizeBiblePrefs } from "../../domain/bibleSource";
import { esvReadMode } from "../../domain/esv";
import type { ResolvedPassage } from "../../domain/resolve";
import { backupLabel, resolvePassage } from "../../domain/resolve";
import type { Snapshot } from "../../domain/types";
import { cachedEsvPassage, esvUnavailable } from "../../lib/esvApi";
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
import { EsvReader } from "./EsvReader";
import { DropInbox, PartnerBanner } from "../Partner";
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
  const { snapshot, today, dispatch, online } = useApp();
  const passage = resolvePassage(snapshot, today);
  const phase = phaseOf(snapshot, today, passage);
  const [intro, setIntro] = useState<Intro>(null);
  const [mode, setMode] = useState<Mode>("read");
  const [sheet, setSheet] = useState<SheetName>(null);
  const [readerFailed, setReaderFailed] = useState(false);
  const [readerClosed, setReaderClosed] = useState(false);
  const prefs = normalizeBiblePrefs(snapshot.prefs);
  const passageRef = "ref" in passage ? passage.ref : "";

  useEffect(() => {
    setIntro(null);
    setMode("read");
    setSheet(null);
  }, [today]);

  useEffect(() => {
    setReaderFailed(false);
    setReaderClosed(false);
  }, [today, passageRef, prefs.showInAppEsv]);

  const readMode = esvReadMode({
    showInAppEsv: prefs.showInAppEsv,
    online,
    cached: passageRef ? cachedEsvPassage(passageRef) !== null : false,
    fetchFailed: readerFailed,
    unavailable: esvUnavailable(),
  });
  const trackPassage = passage.kind === "book" || passage.kind === "plan";
  const showReader =
    intro !== "commit" && phase === "passage" && trackPassage && readMode.show === "in-app" && !readerClosed;

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
      <TodayFrame>
        <DogView onSkip={() => setIntro(null)} onContinue={() => setIntro(null)} />
      </TodayFrame>
    );
  }

  if (mode === "reflect" && snapshot.days[today]?.answer === "yes" && !snapshot.days[today]?.readDone) {
    return (
      <TodayFrame>
        <ReflectView onKeep={() => setMode("read")} onRead={readIt} />
        {sheet === "stop" && passage.kind === "book" ? <StopSheet onClose={() => setSheet(null)} /> : null}
      </TodayFrame>
    );
  }

  if (mode === "recap") {
    return (
      <TodayFrame>
        <RecapView onNext={() => setMode("read")} />
      </TodayFrame>
    );
  }

  if (mode === "detour" && snapshot.days[today]?.answer === "yes" && !snapshot.days[today]?.readDone) {
    return (
      <TodayFrame>
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
      </TodayFrame>
    );
  }

  if (showReader && (passage.kind === "book" || passage.kind === "plan")) {
    return (
      <section className="screen screen-reader">
        <EsvReader
          reference={passage.ref}
          onBack={() => setReaderClosed(true)}
          onReflect={() => setMode("reflect")}
          onRead={readIt}
          onUnavailable={() => setReaderFailed(true)}
        />
        {sheet === "stop" && passage.kind === "book" ? <StopSheet onClose={() => setSheet(null)} /> : null}
      </section>
    );
  }

  return (
    <TodayFrame>
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
          onChoose={() => setSheet("books")}
        />
      ) : null}
      {phase === "passage" && intro !== "commit" && passage.kind !== "finished" && passage.kind !== "plan-finished" ? (
        <PassageView
          passage={passage}
          onAdjust={() => setSheet("adjust")}
          onChangeBook={() => setSheet("books")}
          onDetour={() => setMode("detour")}
          onUseDetour={(ref) => dispatch({ type: "detour", today, ref })}
          onBackToBook={() => dispatch({ type: "clearDetour", today })}
          onReflect={() => setMode("reflect")}
          onRead={readIt}
          onPlanRef={(ref) => dispatch({ type: "planRef", today, ref })}
          onReadInApp={
            readerClosed && readMode.show === "in-app" && trackPassage ? () => setReaderClosed(false) : undefined
          }
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
      {sheet === "books" ? <ChangeBookSheet onClose={() => setSheet(null)} /> : null}
    </TodayFrame>
  );
}

function TodayFrame({ children }: { children: ReactNode }) {
  const [inbox, setInbox] = useState(false);
  return (
    <section className="screen screen-tabbed">
      <PartnerBanner onOpenInbox={() => setInbox(true)} />
      {children}
      {inbox ? <DropInbox onClose={() => setInbox(false)} /> : null}
    </section>
  );
}
