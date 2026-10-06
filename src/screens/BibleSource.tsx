import { useEffect, useRef, useState } from "react";
import {
  BIBLE_SOURCE_OPTIONS,
  BIBLE_TRANSLATIONS,
  normalizeBiblePrefs,
  passageLink,
} from "../domain/bibleSource";
import type { BibleSourceId } from "../domain/types";
import { checkEsvAvailability } from "../lib/esvApi";
import { useApp } from "../state/AppState";
import { Check, ChevronLeft, ChevronRight, Languages } from "../components/Icons";
import { Sheet } from "../components/ui";

type PinnedReach = "available" | "unavailable" | "offline";
type LiveReach = "ready" | "unavailable" | "offline";

export function BibleSource({
  onBack,
  reach,
}: {
  onBack: () => void;
  /** Storybook can pin reach so the frame does not call the ESV proxy. */
  reach?: PinnedReach;
}) {
  const { snapshot, setPrefs, online } = useApp();
  const prefs = normalizeBiblePrefs(snapshot.prefs);
  const [pickingTranslation, setPickingTranslation] = useState(false);
  const [liveReach, setLiveReach] = useState<LiveReach>(reach ? pinnedReach(reach) : "ready");
  const patternRef = useRef<HTMLInputElement>(null);
  const focusPattern = useRef(false);
  const sample = passageLink("Mark 4", { ...prefs, bibleSource: "custom" });

  useEffect(() => {
    if (reach) {
      setLiveReach(pinnedReach(reach));
      return;
    }
    if (!prefs.showInAppEsv) {
      setLiveReach("ready");
      return;
    }
    if (!online) {
      setLiveReach("offline");
      return;
    }
    let cancelled = false;
    void checkEsvAvailability().then((result) => {
      if (cancelled) return;
      switch (result) {
        case "available":
          setLiveReach("ready");
          return;
        case "unreachable":
          setLiveReach("offline");
          return;
        case "unavailable":
          setLiveReach("unavailable");
          return;
        default: {
          const exhaustive: never = result;
          return exhaustive;
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, [reach, online, prefs.showInAppEsv]);

  useEffect(() => {
    if (prefs.bibleSource !== "custom" || !focusPattern.current) return;
    focusPattern.current = false;
    patternRef.current?.focus();
  }, [prefs.bibleSource]);

  function choose(source: BibleSourceId) {
    if (source === "custom") focusPattern.current = true;
    setPrefs({ bibleSource: source });
  }

  function toggleInApp() {
    setPrefs({ showInAppEsv: !prefs.showInAppEsv });
  }

  return (
    <section className="screen screen-tabbed bible-source">
      <div className="source-nav">
        <button type="button" className="icon-btn" aria-label="Back" onClick={onBack}>
          <ChevronLeft size={18} />
        </button>
        <span>Settings</span>
      </div>
      <header className="bible-source-head">
        <h1>Bible source</h1>
        <p>Where “Open passage” takes you.</p>
      </header>
      <section className="settings-group">
        <p className="eyebrow">Open passages in</p>
        <div className="settings-card" role="radiogroup" aria-label="Open passages in">
          {BIBLE_SOURCE_OPTIONS.map((option) => {
            const selected = prefs.bibleSource === option.id;
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={selected}
                className={selected ? "source-option is-selected" : "source-option"}
                onClick={() => choose(option.id)}
              >
                <span className="source-copy">
                  <span className="source-title">
                    <strong>{option.label}</strong>
                    {option.badge ? <span className="source-badge">{option.badge}</span> : null}
                  </span>
                  <span className="source-detail">{option.detail}</span>
                </span>
                {selected ? <Check size={18} aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>
        {prefs.bibleSource === "custom" ? (
          <div className="pattern-block">
            <label className="field">
              <span>URL pattern</span>
              <input
                ref={patternRef}
                value={prefs.bibleCustomPattern}
                onChange={(event) => setPrefs({ bibleCustomPattern: event.target.value })}
                placeholder="https://example.com/bible?q={passage}&version={version}"
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                inputMode="url"
                aria-describedby="pattern-help"
              />
            </label>
            <p id="pattern-help" className="soft">
              Placeholders: {"{passage}"} for the reference, {"{version}"} for the translation, plus {"{book}"},{" "}
              {"{chapter}"}, {"{verse}"}, {"{endChapter}"}, and {"{endVerse}"}.
            </p>
            {prefs.bibleCustomPattern.trim() ? (
              sample.href ? (
                <p className="pattern-preview">Mark 4 opens as {sample.href}</p>
              ) : (
                <p className="soft">Use an http(s) link with a placeholder such as {"{passage}"}.</p>
              )
            ) : (
              <p className="soft">Add a pattern and every Open passage button will use it.</p>
            )}
          </div>
        ) : null}
        <div className="settings-card">
          <button type="button" className="settings-row" onClick={() => setPickingTranslation(true)}>
            <Languages className="row-icon" size={18} aria-hidden="true" />
            <span className="row-label">Translation</span>
            <strong className="row-value">{prefs.bibleTranslation}</strong>
            <ChevronRight className="chev" size={16} aria-hidden="true" />
          </button>
        </div>
        {prefs.bibleSource === "esv" ? (
          <p className="soft">ESV.org always opens the ESV. This translation is used for the other sources.</p>
        ) : null}
      </section>
      <section className="settings-group">
        <p className="eyebrow">Read inside Drip by drip</p>
        <div className="settings-card esv-stub">
          <div className="esv-stub-row">
            <span className="source-copy">
              <strong>Show ESV text in the app</strong>
              <span className="source-detail">{inAppDetail(prefs.showInAppEsv, liveReach)}</span>
            </span>
            <button
              type="button"
              className={prefs.showInAppEsv ? "switch is-on" : "switch"}
              role="switch"
              aria-checked={prefs.showInAppEsv}
              aria-label="Show ESV text in the app"
              aria-describedby="esv-note"
              onClick={toggleInApp}
            >
              <span />
            </button>
          </div>
        </div>
      </section>
      <p id="esv-note" className="footnote">
        ESV text © Crossway, shown under the ESV API terms for personal, non-commercial use. The key is held on the
        server, not on this device. If the text can’t load, Open passage uses the source you chose.
      </p>
      {pickingTranslation ? (
        <Sheet title="Translation" onClose={() => setPickingTranslation(false)}>
          <div className="choice-list" role="radiogroup" aria-label="Translation">
            {BIBLE_TRANSLATIONS.map((item) => {
              const selected = prefs.bibleTranslation === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={selected ? "choice choice-row is-active" : "choice choice-row"}
                  onClick={() => {
                    setPrefs({ bibleTranslation: item.id });
                    setPickingTranslation(false);
                  }}
                >
                  <span>
                    <strong>{item.id}</strong>
                    <span>{item.name}</span>
                  </span>
                  {selected ? <Check size={18} aria-hidden="true" /> : null}
                </button>
              );
            })}
          </div>
        </Sheet>
      ) : null}
    </section>
  );
}

function inAppDetail(showInApp: boolean, reach: LiveReach): string {
  if (!showInApp) return "Today’s passage, in the app";
  switch (reach) {
    case "ready":
      return "Today’s passage, in the app";
    case "unavailable":
      return "Unavailable right now";
    case "offline":
      return "Needs a connection";
    default: {
      const exhaustive: never = reach;
      return exhaustive;
    }
  }
}

function pinnedReach(reach: PinnedReach): LiveReach {
  switch (reach) {
    case "available":
      return "ready";
    case "unavailable":
      return "unavailable";
    case "offline":
      return "offline";
    default: {
      const exhaustive: never = reach;
      return exhaustive;
    }
  }
}
