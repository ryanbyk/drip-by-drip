import { useEffect, useId, useRef, useState } from "react";
import "@fontsource/roboto/latin-500.css";
import { AppleLogo, GoogleLogo } from "../components/AuthIcons";
import { Mail, MailCheck, WaterDrop } from "../components/Icons";
import { Button, Sheet } from "../components/ui";
import {
  EMAIL_CODE_LENGTH,
  digitsFromEmailCode,
  formatResendCountdown,
  alternateEmailSignIn,
  emailSignInLabel,
  isEmail,
  isEmailCode,
  mailAppHref,
  primaryEmailSignIn,
  type EmailSignInMethod,
} from "../lib/auth";
import { isStandalone } from "../lib/reminders";
import { useAuth } from "../state/auth-context";

const RESEND_SECONDS = 60;

const SAFARI_LINK_NOTE =
  "On iPhone, a sign-in link may open Safari. Enter the code so this app stays signed in.";

/** Initial release shows email only. Set to true to show Apple and Google again. */
const socialSignInVisible: boolean = false;

type SignInPreview = {
  email: string;
  linkSent?: boolean;
  codeSent?: boolean;
  resendSeconds?: number;
  /** Storybook override. The app detects an installed Home Screen display. */
  installed?: boolean;
};

export function SignIn({ onSkip, preview }: { onSkip: () => void; preview?: SignInPreview }) {
  const auth = useAuth();
  const installed = preview?.installed ?? isStandalone();
  const primary = primaryEmailSignIn(installed);
  const [email, setEmail] = useState(preview?.email ?? "");
  const [code, setCode] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(
    preview?.linkSent || preview?.codeSent ? (preview.email ?? "") : null,
  );
  const [sentMode, setSentMode] = useState<EmailSignInMethod>(preview?.codeSent ? "code" : "link");
  const [sending, setSending] = useState<EmailSignInMethod | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [oauth, setOauth] = useState<"apple" | "google" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const frozenSeconds = preview?.resendSeconds;
  const [seconds, setSeconds] = useState(frozenSeconds ?? RESEND_SECONDS);
  const [resendEpoch, setResendEpoch] = useState(0);
  const verifyLock = useRef(false);

  useEffect(() => {
    if (!sentTo || frozenSeconds !== undefined) return;
    setSeconds(RESEND_SECONDS);
    const id = window.setInterval(() => {
      setSeconds((current) => (current > 0 ? current - 1 : 0));
    }, 1000);
    return () => window.clearInterval(id);
  }, [sentTo, resendEpoch, frozenSeconds]);

  async function deliver(address: string, mode: EmailSignInMethod) {
    const next = address.trim();
    if (!isEmail(next)) {
      setError("Enter an email address, like you@example.com.");
      return;
    }
    if (preview) {
      setError(null);
      setSentTo(next);
      setSentMode(mode);
      setResendEpoch((epoch) => epoch + 1);
      return;
    }
    setSending(mode);
    setError(null);
    const message = await sendFor(mode, next);
    setSending(null);
    if (message) {
      setError(message);
      return;
    }
    setSentTo(next);
    setSentMode(mode);
    setResendEpoch((epoch) => epoch + 1);
  }

  async function sendFor(mode: EmailSignInMethod, address: string): Promise<string | null> {
    switch (mode) {
      case "code":
        return auth.sendEmailCode(address);
      case "link":
        return auth.sendMagicLink(address);
      default: {
        const exhaustive: never = mode;
        return exhaustive;
      }
    }
  }

  async function verify(raw: string) {
    if (!sentTo || verifyLock.current) return;
    const next = digitsFromEmailCode(raw);
    if (!isEmailCode(next)) {
      setError("Enter the 6-digit code from the email.");
      return;
    }
    if (preview) return;
    verifyLock.current = true;
    setVerifying(true);
    setError(null);
    const message = await auth.verifyEmailCode(sentTo, next);
    verifyLock.current = false;
    setVerifying(false);
    if (message) setError(message);
  }

  async function continueWith(provider: "apple" | "google") {
    if (preview || oauth) return;
    setOauth(provider);
    setError(null);
    const message = await auth.signInWithProvider(provider);
    setOauth(null);
    if (message) setError(message);
  }

  function showOther(mode: EmailSignInMethod) {
    setError(null);
    setSentMode(mode);
  }

  const shownError = error ?? auth.authError;
  const primaryLabel = sending === primary ? "Sending…" : emailSignInLabel(primary);
  const alternate = alternateEmailSignIn(primary);

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
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void deliver(email, primary);
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
        <Button type="submit" disabled={sending !== null}>
          {primaryLabel}
        </Button>
        <button
          type="button"
          className="auth-alt"
          disabled={sending !== null}
          onClick={() => void deliver(email, alternate)}
        >
          {sending === alternate ? "Sending…" : emailSignInLabel(alternate)}
        </button>
        {installed ? <p className="auth-hint">{SAFARI_LINK_NOTE}</p> : null}
      </form>
      <div className="auth-footer">
        <button type="button" className="auth-skip" onClick={onSkip}>
          Keep using without an account
        </button>
        <p className="auth-footnote">Everything on this device stays here if you skip.</p>
      </div>
      {sentTo && sentMode === "link" ? (
        <MagicLinkSheet
          email={sentTo}
          seconds={seconds}
          resending={sending === "link"}
          error={shownError}
          safariNote={installed ? SAFARI_LINK_NOTE : null}
          onDifferentEmail={() => {
            setSentTo(null);
            setError(null);
          }}
          onResend={() => void deliver(sentTo, "link")}
          onUseCode={installed ? () => showOther("code") : undefined}
        />
      ) : null}
      {sentTo && sentMode === "code" ? (
        <EmailCodeSheet
          email={sentTo}
          code={code}
          seconds={seconds}
          resending={sending === "code"}
          verifying={verifying}
          error={shownError}
          safariNote={installed ? SAFARI_LINK_NOTE : null}
          onCode={(next) => {
            setCode(next);
            setError(null);
            if (next.length === EMAIL_CODE_LENGTH) void verify(next);
          }}
          onVerify={() => void verify(code)}
          onDifferentEmail={() => {
            setSentTo(null);
            setCode("");
            setError(null);
          }}
          onResend={() => void deliver(sentTo, "code")}
          onUseLink={() => showOther("link")}
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
  safariNote,
  onDifferentEmail,
  onResend,
  onUseCode,
}: {
  email: string;
  seconds: number;
  resending: boolean;
  error: string | null;
  safariNote: string | null;
  onDifferentEmail: () => void;
  onResend: () => void;
  onUseCode?: () => void;
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
        {safariNote ? <p>{safariNote}</p> : null}
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
      {onUseCode ? (
        <button type="button" className="magic-link magic-switch" onClick={onUseCode}>
          Enter a code instead
        </button>
      ) : null}
      {error ? (
        <p className="auth-error" role="alert">
          {error}
        </p>
      ) : null}
    </Sheet>
  );
}

function EmailCodeSheet({
  email,
  code,
  seconds,
  resending,
  verifying,
  error,
  safariNote,
  onCode,
  onVerify,
  onDifferentEmail,
  onResend,
  onUseLink,
}: {
  email: string;
  code: string;
  seconds: number;
  resending: boolean;
  verifying: boolean;
  error: string | null;
  safariNote: string | null;
  onCode: (code: string) => void;
  onVerify: () => void;
  onDifferentEmail: () => void;
  onResend: () => void;
  onUseLink?: () => void;
}) {
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <Sheet className="sheet-magic" title="Check your email" labelledBy={titleId} onClose={onDifferentEmail}>
      <div className="magic-icon" aria-hidden="true">
        <MailCheck size={28} />
      </div>
      <div className="magic-copy">
        <h2 id={titleId}>Check your email</h2>
        <p>We sent a 6-digit code to {email}. Enter it here. It works for 15 minutes.</p>
        {safariNote ? <p>{safariNote}</p> : null}
      </div>
      <form
        className="auth-email"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          onVerify();
        }}
      >
        <label className="auth-field">
          <span>Code</span>
          <span className="auth-box auth-code">
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="6-digit code"
              value={code}
              onChange={(event) => onCode(digitsFromEmailCode(event.target.value))}
            />
          </span>
        </label>
        <Button type="submit" disabled={verifying || resending}>
          {verifying ? "Checking…" : "Sign in"}
        </Button>
      </form>
      <div className="magic-actions">
        <button type="button" className="magic-link" onClick={onDifferentEmail}>
          Use a different email
        </button>
        {seconds > 0 ? (
          <span className="magic-wait">{formatResendCountdown(seconds)}</span>
        ) : (
          <button type="button" className="magic-link" onClick={onResend} disabled={resending || verifying}>
            {resending ? "Sending…" : "Resend"}
          </button>
        )}
      </div>
      {onUseLink ? (
        <button type="button" className="magic-link magic-switch" onClick={onUseLink}>
          Use a sign-in link instead
        </button>
      ) : null}
      {error ? (
        <p className="auth-error" role="alert">
          {error}
        </p>
      ) : null}
    </Sheet>
  );
}
