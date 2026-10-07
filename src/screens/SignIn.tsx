import { useEffect, useId, useState } from "react";
import "@fontsource/roboto/latin-500.css";
import { AppleLogo, GoogleLogo } from "../components/AuthIcons";
import { Mail, MailCheck, WaterDrop } from "../components/Icons";
import { Button, Sheet } from "../components/ui";
import { formatResendCountdown, isEmail, mailAppHref } from "../lib/auth";
import { useAuth } from "../state/auth-context";

const RESEND_SECONDS = 60;

/** Initial release shows email only. Set to true to show Apple and Google again. */
const socialSignInVisible: boolean = false;

type SignInPreview = {
  email: string;
  linkSent?: boolean;
  resendSeconds?: number;
};

export function SignIn({ onSkip, preview }: { onSkip: () => void; preview?: SignInPreview }) {
  const auth = useAuth();
  const [email, setEmail] = useState(preview?.email ?? "");
  const [sentTo, setSentTo] = useState<string | null>(preview?.linkSent ? (preview.email ?? "") : null);
  const [sending, setSending] = useState(false);
  const [oauth, setOauth] = useState<"apple" | "google" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const frozenSeconds = preview?.resendSeconds;
  const [seconds, setSeconds] = useState(frozenSeconds ?? RESEND_SECONDS);
  const [resendEpoch, setResendEpoch] = useState(0);

  useEffect(() => {
    if (!sentTo || frozenSeconds !== undefined) return;
    setSeconds(RESEND_SECONDS);
    const id = window.setInterval(() => {
      setSeconds((current) => (current > 0 ? current - 1 : 0));
    }, 1000);
    return () => window.clearInterval(id);
  }, [sentTo, resendEpoch, frozenSeconds]);

  async function send(address: string) {
    const next = address.trim();
    if (!isEmail(next)) {
      setError("Enter an email address, like you@example.com.");
      return;
    }
    if (preview) {
      setError(null);
      setSentTo(next);
      setResendEpoch((epoch) => epoch + 1);
      return;
    }
    setSending(true);
    setError(null);
    const message = await auth.sendMagicLink(next);
    setSending(false);
    if (message) {
      setError(message);
      return;
    }
    setSentTo(next);
    setResendEpoch((epoch) => epoch + 1);
  }

  async function continueWith(provider: "apple" | "google") {
    if (preview || oauth) return;
    setOauth(provider);
    setError(null);
    const message = await auth.signInWithProvider(provider);
    setOauth(null);
    if (message) setError(message);
  }

  const shownError = error ?? auth.authError;

  return (
    <section className="screen screen-gap-22 sign-in">
      <p className="auth-brand">
        <WaterDrop size={20} />
        Drip by drip
      </p>
      <header className="auth-copy">
        <h1>Keep your drips, on every device.</h1>
        <p>Optional. Sign in to sync, join a group, or read a church plan together. Your notes stay private.</p>
      </header>
      {socialSignInVisible ? (
        <>
          <div className="auth-oauth">
            <button type="button" className="btn btn-apple" onClick={() => void continueWith("apple")} disabled={oauth !== null}>
              <AppleLogo />
              {oauth === "apple" ? "Opening Apple…" : "Continue with Apple"}
            </button>
            <button type="button" className="btn btn-google" onClick={() => void continueWith("google")} disabled={oauth !== null}>
              <GoogleLogo />
              {oauth === "google" ? "Opening Google…" : "Continue with Google"}
            </button>
          </div>
          <div className="auth-or" role="separator">
            or
          </div>
        </>
      ) : null}
      <form
        className="auth-email"
        onSubmit={(event) => {
          event.preventDefault();
          void send(email);
        }}
      >
        <label className="auth-field">
          <span>Email</span>
          <span className="auth-box">
            <Mail size={16} aria-hidden="true" />
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </span>
        </label>
        {shownError && !sentTo ? (
          <p className="auth-error" role="alert">
            {shownError}
          </p>
        ) : null}
        <Button type="submit" disabled={sending}>
          {sending ? "Sending…" : "Email me a sign-in link"}
        </Button>
      </form>
      <div className="auth-footer">
        <button type="button" className="auth-skip" onClick={onSkip}>
          Keep using without an account
        </button>
        <p className="auth-footnote">Everything on this device stays here if you skip.</p>
      </div>
      {sentTo ? (
        <MagicLinkSheet
          email={sentTo}
          seconds={seconds}
          resending={sending}
          error={shownError}
          onDifferentEmail={() => {
            setSentTo(null);
            setError(null);
          }}
          onResend={() => void send(sentTo)}
        />
      ) : null}
    </section>
  );
}

function MagicLinkSheet({
  email,
  seconds,
  resending,
  error,
  onDifferentEmail,
  onResend,
}: {
  email: string;
  seconds: number;
  resending: boolean;
  error: string | null;
  onDifferentEmail: () => void;
  onResend: () => void;
}) {
  const titleId = useId();
  const href = mailAppHref(email);
  const external = href.startsWith("http");
  return (
    <Sheet className="sheet-magic" title="Check your email" labelledBy={titleId} onClose={onDifferentEmail}>
      <div className="magic-icon" aria-hidden="true">
        <MailCheck size={28} />
      </div>
      <div className="magic-copy">
        <h2 id={titleId}>Check your email</h2>
        <p>We sent a sign-in link to {email}. It works for 15 minutes.</p>
      </div>
      <a className="btn btn-primary" href={href} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined}>
        Open mail app
      </a>
      <div className="magic-actions">
        <button type="button" className="magic-link" onClick={onDifferentEmail}>
          Use a different email
        </button>
        {seconds > 0 ? (
          <span className="magic-wait">{formatResendCountdown(seconds)}</span>
        ) : (
          <button type="button" className="magic-link" onClick={onResend} disabled={resending}>
            {resending ? "Sending…" : "Resend"}
          </button>
        )}
      </div>
      {error ? (
        <p className="auth-error" role="alert">
          {error}
        </p>
      ) : null}
    </Sheet>
  );
}
