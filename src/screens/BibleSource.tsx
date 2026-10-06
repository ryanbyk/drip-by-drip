import { useEffect, useRef, useState } from "react";
import {
  BIBLE_SOURCE_OPTIONS,
  BIBLE_TRANSLATIONS,
  normalizeBiblePrefs,
  passageLink,
} from "../domain/bibleSource";
import { ESV_SIGNUP_URL, maskEsvKey } from "../domain/esv";
import type { BibleSourceId } from "../domain/types";
import { validateEsvApiKey } from "../lib/esvApi";
import { useApp } from "../state/AppState";
import { ArrowUpRight, Check, ChevronLeft, ChevronRight, CircleCheck, KeyRound, Languages } from "../components/Icons";
import { Sheet } from "../components/ui";

type EsvKeyStatus = "empty" | "checking" | "connected" | "invalid" | "stored";

export function BibleSource({
  onBack,
  keyStatus,
}: {
  onBack: () => void;
  /** Storybook can pin the badge so the frame does not call the ESV API. */
  keyStatus?: EsvKeyStatus;
}) {
  const { snapshot, setPrefs, online } = useApp();
  const prefs = normalizeBiblePrefs(snapshot.prefs);
  const [pickingTranslation, setPickingTranslation] = useState(false);
  const [editingKey, setEditingKey] = useState(false);
  const [keyDraft, setKeyDraft] = useState("");
  const [status, setStatus] = useState<EsvKeyStatus>(keyStatus ?? "empty");
  const patternRef = useRef<HTMLInputElement>(null);
  const keyRef = useRef<HTMLInputElement>(null);
  const focusPattern = useRef(false);
  const sample = passageLink("Mark 4", { ...prefs, bibleSource: "custom" });

  useEffect(() => {
    if (!editingKey) return;
    keyRef.current?.focus();
  }, [editingKey]);

  useEffect(() => {
    if (keyStatus) {
      setStatus(keyStatus);
      return;
    }
    const key = prefs.esvApiKey.trim();
    if (!key) {
      setStatus("empty");
      return;
    }
    if (!online) {
      setStatus("stored");
      return;
    }
    let cancelled = false;
    setStatus("checking");
    void validateEsvApiKey(key).then((result) => {
      if (cancelled) return;
      if (result === "connected") setStatus("connected");
      else if (result === "invalid") setStatus("invalid");
      else setStatus("stored");
    });
    return () => {
      cancelled = true;
    };
  }, [keyStatus, online, prefs.esvApiKey]);

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
    const next = !prefs.showInAppEsv;
    setPrefs({ showInAppEsv: next });
    if (next && !prefs.esvApiKey) setEditingKey(true);
  }

  function commitKey() {
    const next = keyDraft.trim();
    setEditingKey(false);
    setKeyDraft("");
    if (next) setPrefs({ esvApiKey: next });
  }

  function removeKey() {
    setPrefs({ esvApiKey: "" });
    setKeyDraft("");
    setEditingKey(false);
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
              className={prefs.showInAppEsv ? "switch is-on" : "switch"}
              role="switch"
              aria-checked={prefs.showInAppEsv}
              aria-label="Show ESV text in the app"
              aria-describedby="esv-key-note"
              onClick={toggleInApp}
            >
              <span />
            </button>
          </div>
          {prefs.showInAppEsv ? (
            <>
              <div className="esv-key">
                <span id="esv-key-label">API key</span>
                <div className="esv-key-box">
                  <KeyRound size={16} aria-hidden="true" />
                  {editingKey || !prefs.esvApiKey ? (
                    <input
                      ref={keyRef}
                      type="password"
                      value={keyDraft}
                      placeholder={prefs.esvApiKey ? "Paste a new key" : "Paste your API key"}
                      autoComplete="off"
                      autoCapitalize="off"
                      autoCorrect="off"
                      spellCheck={false}
                      aria-labelledby="esv-key-label"
                      aria-invalid={status === "invalid"}
                      onChange={(event) => setKeyDraft(event.target.value)}
                      onBlur={commitKey}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") event.currentTarget.blur();
                      }}
                    />
                  ) : (
                    <button type="button" className="esv-key-mask" aria-label="Replace API key" onClick={() => setEditingKey(true)}>
                      {maskEsvKey(prefs.esvApiKey)}
                    </button>
                  )}
                  {editingKey ? null : <KeyStatus status={status} />}
                </div>
              </div>
              {editingKey && prefs.esvApiKey ? (
                <button
                  type="button"
                  className="esv-remove"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={removeKey}
                >
                  Remove key
                </button>
              ) : null}
              <a className="esv-signup" href={ESV_SIGNUP_URL} target="_blank" rel="noopener noreferrer">
                Get a free key at api.esv.org
                <ArrowUpRight size={13} aria-hidden="true" />
              </a>
            </>
          ) : null}
        </div>
      </section>
      <p id="esv-key-note" className="footnote">
        Your key is stored only on this device. ESV text © Crossway, shown under the ESV API terms for personal,
        non-commercial use. Without a key, passages open in your chosen source.
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

function KeyStatus({ status }: { status: EsvKeyStatus }) {
  switch (status) {
    case "empty":
      return null;
    case "checking":
      return <span className="esv-status">Checking</span>;
    case "connected":
      return (
        <span className="esv-connected">
          <CircleCheck size={14} aria-hidden="true" />
          Connected
        </span>
      );
    case "invalid":
      return <span className="esv-status is-invalid">Check key</span>;
    case "stored":
      return <span className="esv-status">On device</span>;
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
}
