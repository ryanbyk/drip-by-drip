import { useEffect, useRef, useState } from "react";
import {
  BIBLE_SOURCE_OPTIONS,
  BIBLE_TRANSLATIONS,
  bibleSourceLabel,
  normalizeBiblePrefs,
  passageLink,
} from "../domain/bibleSource";
import type { BibleSourceId } from "../domain/types";
import { useApp } from "../state/AppState";
import { Check, ChevronLeft, ChevronRight, Languages } from "../components/Icons";
import { Sheet } from "../components/ui";

export function BibleSource({ onBack }: { onBack: () => void }) {
  const { snapshot, setPrefs } = useApp();
  const prefs = normalizeBiblePrefs(snapshot.prefs);
  const [pickingTranslation, setPickingTranslation] = useState(false);
  const patternRef = useRef<HTMLInputElement>(null);
  const focusPattern = useRef(false);
  const sample = passageLink("Mark 4", { ...prefs, bibleSource: "custom" });

  useEffect(() => {
    if (prefs.bibleSource !== "custom" || !focusPattern.current) return;
    focusPattern.current = false;
    patternRef.current?.focus();
  }, [prefs.bibleSource]);

  function choose(source: BibleSourceId) {
    if (source === "custom") focusPattern.current = true;
    setPrefs({ bibleSource: source });
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
              <span className="source-detail">Uses your own ESV API key</span>
            </span>
            <button
              type="button"
              className="switch"
              role="switch"
              aria-checked={false}
              aria-label="Show ESV text in the app"
              aria-describedby="esv-stub-note"
              disabled
            >
              <span />
            </button>
          </div>
        </div>
        <p id="esv-stub-note" className="footnote">
          In-app ESV text isn’t available yet, so passages open in {bibleSourceLabel(prefs.bibleSource)}. Your source
          choice stays on this device.
        </p>
      </section>
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
