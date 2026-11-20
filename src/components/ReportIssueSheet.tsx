import { useId, useMemo, useState } from "react";
import { Check } from "./Icons";
import { Button, DisclosureCard, KeyValueList, Sheet, SheetConfirm } from "./ui";
import {
  collectIssueDiagnostics,
  diagnosticsSummaryRows,
  ISSUE_CATEGORIES,
  issueCategoryLabel,
  MAX_DESCRIPTION_LENGTH,
  submitIssueReport,
  type IssueCategory,
  type IssueDiagnostics,
} from "../lib/issueReport";
import { isStandalone } from "../lib/reminders";
import { useApp } from "../state/AppState";
import { useAuth } from "../state/auth-context";

export type ReportIssuePreview = {
  category?: IssueCategory;
  description?: string;
  contactEmail?: string;
  submitted?: boolean;
  identifier?: string | null;
  error?: string | null;
  diagnostics?: IssueDiagnostics;
};

export function ReportIssueSheet({
  onClose,
  onSubmitted,
  preview,
}: {
  onClose: () => void;
  onSubmitted?: (identifier: string | null) => void;
  preview?: ReportIssuePreview;
}) {
  const app = useApp();
  const auth = useAuth();
  const formId = useId();
  const signedIn = auth.status === "signed-in" && Boolean(auth.user);
  const defaultEmail = preview?.contactEmail ?? (signedIn ? (auth.user?.email ?? "") : "");

  const [category, setCategory] = useState<IssueCategory>(preview?.category ?? "bug");
  const [description, setDescription] = useState(preview?.description ?? "");
  const [contactEmail, setContactEmail] = useState(defaultEmail);
  const [website, setWebsite] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(preview?.error ?? null);
  const [sent, setSent] = useState<{ identifier: string | null } | null>(
    preview?.submitted ? { identifier: preview.identifier ?? null } : null,
  );

  const diagnostics = useMemo(
    () =>
      preview?.diagnostics ??
      collectIssueDiagnostics({
        appearance: app.snapshot.prefs.appearance,
        signedIn,
        syncEnabled: auth.syncEnabled,
        notificationsEnabled: app.snapshot.prefs.notificationsEnabled,
        standalone: app.standalone || isStandalone(),
      }),
    [
      preview?.diagnostics,
      app.snapshot.prefs.appearance,
      signedIn,
      auth.syncEnabled,
      app.snapshot.prefs.notificationsEnabled,
      app.standalone,
    ],
  );
  const diagnosticRows = useMemo(() => diagnosticsSummaryRows(diagnostics), [diagnostics]);

  async function handleSubmit() {
    if (submitting) return;
    if (preview) {
      setError(null);
      setSent({ identifier: preview.identifier ?? "CW-93" });
      return;
    }
    setSubmitting(true);
    setError(null);
    const result = await submitIssueReport({
      category,
      description,
      contactEmail,
      website,
      diagnostics,
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setSent({ identifier: result.identifier });
    onSubmitted?.(result.identifier);
  }

  if (sent) {
    return (
      <Sheet title="Report sent" onClose={onClose}>
        <SheetConfirm
          icon={<Check size={24} />}
          message="Thanks for letting us know. Your note is in our queue and we’ll take a look."
          badge={sent.identifier ? `Reference ${sent.identifier}` : null}
        />
        <div className="footer">
          <Button type="button" onClick={onClose}>
            Done
          </Button>
        </div>
      </Sheet>
    );
  }

  const remaining = MAX_DESCRIPTION_LENGTH - description.length;

  return (
    <Sheet
      title="Report an issue"
      description="Spot something off or have an idea? Send a note — no account needed."
      onClose={onClose}
    >
      <form
        id={formId}
        className="sheet-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit();
        }}
      >
        <div className="field">
          <span>Kind</span>
          <div className="chips" role="group" aria-label="Report type">
            {ISSUE_CATEGORIES.map((option) => (
              <button
                key={option}
                type="button"
                className={category === option ? "chip is-active" : "chip"}
                aria-pressed={category === option}
                disabled={submitting}
                onClick={() => setCategory(option)}
              >
                {issueCategoryLabel(option)}
              </button>
            ))}
          </div>
        </div>

        <label className="field">
          <span>{category === "bug" ? "What happened?" : "What’s on your mind?"}</span>
          <textarea
            rows={4}
            maxLength={MAX_DESCRIPTION_LENGTH}
            placeholder={
              category === "bug"
                ? "What you tapped, and what you expected to see…"
                : "What would make daily reading smoother…"
            }
            value={description}
            disabled={submitting}
            onChange={(event) => {
              setDescription(event.target.value);
              if (error) setError(null);
            }}
          />
          {description.length > MAX_DESCRIPTION_LENGTH - 600 ? (
            <span className="field-count">{remaining} characters left</span>
          ) : null}
        </label>

        <label className="field">
          <span>Email (optional)</span>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="you@example.com"
            value={contactEmail}
            disabled={submitting}
            onChange={(event) => {
              setContactEmail(event.target.value);
              if (error) setError(null);
            }}
          />
          <span className="field-hint">Only if you’d like a reply.</span>
        </label>

        <label className="honeypot" aria-hidden="true">
          <span>Website</span>
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
          />
        </label>

        <DisclosureCard summary="Basic device info is attached">
          <p className="soft">
            Helps us reproduce issues. Never includes your answers, reading notes, or book.
          </p>
          <KeyValueList rows={diagnosticRows} />
        </DisclosureCard>

        {error ? (
          <p className="auth-error" role="alert">
            {error}
          </p>
        ) : null}
      </form>
      <div className="footer">
        <Button type="submit" form={formId} disabled={submitting}>
          {submitting ? "Sending…" : "Send report"}
        </Button>
        <Button type="button" variant="quiet" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
      </div>
    </Sheet>
  );
}
