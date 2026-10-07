import { useState } from "react";
import { Check, ChevronLeft, Copy, EyeOff, HeartHandshake, Link2, X } from "../components/Icons";
import { Button, Sheet } from "../components/ui";
import { initialsFor } from "../lib/auth";
import {
  NUDGE_NOTES,
  canSendNudge,
  formatInviteCode,
  inviteExpiryLabel,
  partnerInviteLabel,
  partnerInviteShareText,
  partnerInviteUrl,
  partnerReadLabel,
  type NudgeNote,
} from "../domain/partner";
import { useApp } from "../state/AppState";
import { usePartner } from "../state/partner-context";

export function Partner({ onBack }: { onBack: () => void }) {
  const partner = usePartner();
  const { showToast, today } = useApp();
  const [busy, setBusy] = useState<"invite" | "accept" | "decline" | "nudge" | "unlink" | "lookup" | null>(null);
  const [note, setNote] = useState<NudgeNote>(NUDGE_NOTES[0]);
  const [codeOpen, setCodeOpen] = useState(false);
  const [code, setCode] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmUnlink, setConfirmUnlink] = useState(false);

  const person = partner.partner;
  const incoming = partner.incoming;
  const invite = partner.invite;
  const inviteUrl = invite ? partnerInviteUrl(window.location.origin, import.meta.env.BASE_URL, invite.code) : "";
  const readLabel = person ? partnerReadLabel(person.readToday) : null;
  const canSend = person ? canSendNudge(partner.nudges, today) : false;
  const heading = incoming ? `${incoming.inviterName} invited you` : person ? person.displayName : "Choose a partner";

  async function run(kind: NonNullable<typeof busy>, work: () => Promise<string | null>, success?: string) {
    if (busy) return;
    setBusy(kind);
    setFormError(null);
    const failure = await work();
    setBusy(null);
    if (failure) {
      setFormError(failure);
      return;
    }
    if (success) showToast(success);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      showToast("Invite link copied.");
    } catch {
      showToast("Couldn’t copy from this browser.");
    }
  }

  async function shareLink() {
    const text = partnerInviteShareText(inviteUrl);
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "Drip by drip", text, url: inviteUrl });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    await copyLink();
  }

  return (
    <section className="screen screen-tabbed screen-gap-16 partner">
      <div className="account-nav">
        <button type="button" className="icon-btn" aria-label="Back" onClick={onBack}>
          <ChevronLeft size={18} />
        </button>
        <h1>Reading partner</h1>
        <span className="account-nav-end" aria-hidden="true" />
      </div>
      <header className="partner-head">
        <p className="partner-title">{heading}</p>
        <p>One person who sees whether you read today — never your answers or notes.</p>
      </header>
      {partner.status === "loading" && !person && !invite && !incoming ? <p className="soft">Loading…</p> : null}
      {partner.error ? (
        <p className="auth-error" role="alert">
          {partner.error}
        </p>
      ) : null}
      {formError ? (
        <p className="auth-error" role="alert">
          {formError}
        </p>
      ) : null}
      {person ? <PartnerCard name={person.displayName} readLabel={readLabel} /> : null}
      {!person ? <PrivacyCard name={incoming?.inviterName ?? "Your partner"} /> : null}
      {invite && !person && !incoming ? (
        <InviteCard code={invite.code} expiresAt={invite.expiresAt} url={inviteUrl} onCopy={() => void copyLink()} />
      ) : null}
      {person ? (
        <section className="settings-group">
          <p className="eyebrow">A gentle note</p>
          <div className="settings-card partner-notes">
            {NUDGE_NOTES.map((choice) => (
              <button
                key={choice}
                type="button"
                className={choice === note ? "settings-row is-picked" : "settings-row"}
                aria-pressed={choice === note}
                onClick={() => setNote(choice)}
              >
                <span className="row-label">{choice}</span>
                {choice === note ? <Check className="chev" size={18} aria-hidden="true" /> : null}
              </button>
            ))}
          </div>
          <p className="soft">
            {canSend ? "One gentle note a day. It never says they missed." : "You sent a note today. That’s enough."}
          </p>
        </section>
      ) : null}
      {person && partner.nudges.length > 0 ? (
        <section className="settings-group">
          <p className="eyebrow">Notes</p>
          <div className="partner-thread">
            {partner.nudges.map((nudge) => (
              <article key={nudge.id} className="partner-thread-note">
                <p>{nudge.body}</p>
                <span>{nudge.fromSelf ? "From you" : `From ${person.displayName}`}</span>
              </article>
            ))}
          </div>
        </section>
      ) : null}
      <div className="footer">
        {incoming ? (
          <>
            <Button
              onClick={() =>
                void run("accept", () => partner.acceptIncoming(), `You’re reading with ${incoming.inviterName}.`)
              }
              disabled={busy !== null}
            >
              {busy === "accept" ? "Joining…" : "Read together"}
            </Button>
            <Button
              variant="quiet"
              onClick={() => void run("decline", () => partner.declineIncoming(), "Invite set aside.")}
              disabled={busy !== null}
            >
              {busy === "decline" ? "Setting aside…" : "Not now"}
            </Button>
          </>
        ) : null}
        {!incoming && invite ? (
          <>
            <Button onClick={() => void shareLink()}>Share invite link</Button>
            <Button variant="text" onClick={() => void run("invite", () => partner.createInvite(), "New invite ready.")} disabled={busy !== null}>
              {busy === "invite" ? "Resetting…" : "Reset code"}
            </Button>
          </>
        ) : null}
        {!incoming && !person && !invite ? (
          <Button onClick={() => void run("invite", () => partner.createInvite(), "Invite ready.")} disabled={busy !== null}>
            {busy === "invite" ? "Creating…" : "Create an invite"}
          </Button>
        ) : null}
        {!incoming && !person ? (
          <Button variant="quiet" onClick={() => setCodeOpen(true)} disabled={busy !== null}>
            I have a code
          </Button>
        ) : null}
        {person ? (
          <>
            <Button onClick={() => void run("nudge", () => partner.sendNudge(note), "Sent. A gentle note is enough.")} disabled={busy !== null || !canSend}>
              {busy === "nudge" ? "Sending…" : "Send this note"}
            </Button>
            <Button variant="text" className="partner-unlink" onClick={() => setConfirmUnlink(true)} disabled={busy !== null}>
              Unlink partner
            </Button>
          </>
        ) : null}
      </div>
      {codeOpen ? (
        <Sheet title="Join with a code" description="The code is on their invite. You’ll accept or set it aside before anything is shared." onClose={() => setCodeOpen(false)}>
          <label className="auth-field">
            <span>Invite code</span>
            <span className="auth-box">
              <input
                value={code}
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                maxLength={11}
                placeholder="ABCD-EFGH"
                onChange={(event) => setCode(event.target.value.toUpperCase())}
              />
            </span>
          </label>
          <Button
            onClick={() =>
              void run("lookup", async () => {
                const failure = await partner.lookupCode(code);
                if (!failure) setCodeOpen(false);
                return failure;
              })
            }
            disabled={busy !== null}
          >
            Look up
          </Button>
        </Sheet>
      ) : null}
      {confirmUnlink && person ? (
        <Sheet title={`Unlink ${person.displayName}?`} onClose={() => setConfirmUnlink(false)}>
          <p>You’ll stop seeing each other’s notes. Their answers stay private, as they always were.</p>
          <div className="footer">
            <Button
              className="btn-caution"
              onClick={() =>
                void run("unlink", async () => {
                  const failure = await partner.unlink();
                  if (!failure) setConfirmUnlink(false);
                  return failure;
                }, "Partner unlinked.")
              }
              disabled={busy !== null}
            >
              {busy === "unlink" ? "Unlinking…" : "Unlink partner"}
            </Button>
            <Button variant="quiet" onClick={() => setConfirmUnlink(false)} disabled={busy !== null}>
              Cancel
            </Button>
          </div>
        </Sheet>
      ) : null}
    </section>
  );
}

function PrivacyCard({ name }: { name: string }) {
  return (
    <section className="partner-privacy">
      <p>{name} will see</p>
      <ul>
        <li>
          <Check size={15} aria-hidden="true" />
          Whether you read today
        </li>
        <li className="is-never">
          <EyeOff size={15} aria-hidden="true" />
          Never: Yes, Not today, or unanswered days
        </li>
        <li className="is-never">
          <EyeOff size={15} aria-hidden="true" />
          Never: your notes and Huh? moments
        </li>
      </ul>
    </section>
  );
}

function PartnerCard({ name, readLabel }: { name: string; readLabel: "Read today" | null }) {
  return (
    <div className="partner-person">
      <span className="partner-avatar" aria-hidden="true">
        {initialsFor(name, "")}
      </span>
      <span className="partner-person-copy">
        <strong>{name}</strong>
        {readLabel ? (
          <span className="partner-read">
            <Check size={15} aria-hidden="true" />
            {readLabel}
          </span>
        ) : (
          <span>Just the two of you</span>
        )}
      </span>
    </div>
  );
}

function InviteCard({
  code,
  expiresAt,
  url,
  onCopy,
}: {
  code: string;
  expiresAt: string;
  url: string;
  onCopy: () => void;
}) {
  return (
    <div className="partner-invite">
      <div className="partner-code-block">
        <p className="eyebrow">Invite code</p>
        <p className="partner-code">{formatInviteCode(code)}</p>
        <p>{inviteExpiryLabel(expiresAt)}</p>
      </div>
      <div className="partner-link">
        <Link2 size={16} aria-hidden="true" />
        <span>{partnerInviteLabel(url)}</span>
        <button type="button" className="partner-copy" onClick={onCopy}>
          <Copy size={14} aria-hidden="true" />
          Copy
        </button>
      </div>
    </div>
  );
}

export function PartnerBanner() {
  const partner = usePartner();
  const note = partner.nudges.find((nudge) => !nudge.fromSelf && !nudge.seen);
  if (!note || !partner.partner) return null;
  return (
    <aside className="partner-banner" role="status">
      <HeartHandshake size={18} aria-hidden="true" />
      <span>
        <strong>{partner.partner.displayName} is thinking of you</strong>
        <span>{note.body}</span>
      </span>
      <button type="button" className="icon-btn" aria-label="Keep this note" onClick={() => void partner.seeNudge(note.id)}>
        <X size={16} />
      </button>
    </aside>
  );
}
