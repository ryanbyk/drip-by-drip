import { useState } from "react";
import { Avatar } from "../components/SocialBits";
import { Check, ChevronLeft, ChevronRight, Copy, EyeOff, HeartHandshake, Link2, Search, X } from "../components/Icons";
import { Button, Sheet } from "../components/ui";
import { pageOriginForLinks } from "../lib/appUrl";
import {
  NUDGE_NOTES,
  formatInviteCode,
  inviteExpiryLabel,
  partnerInviteLabel,
  partnerInviteShareText,
  partnerInviteUrl,
  partnerReadLabel,
  type NudgeNote,
} from "../domain/partner";
import {
  PARTNER_CAP,
  canAddPartner,
  dropNoteChoices,
  dropNoteLabel,
  partnerCandidates,
  quietDropLine,
  receivedDrops,
  type VisibleDrop,
} from "../domain/social";
import { useApp } from "../state/AppState";
import { useGroups } from "../state/group-context";
import { usePartner, type PartnerPerson, type PartnerValue } from "../state/partner-context";

function roster(partner: PartnerValue): PartnerPerson[] {
  if (partner.partners.length > 0) return partner.partners;
  if (partner.partner) return [partner.partner];
  return [];
}

export function Partner({ onBack, initialId = null }: { onBack: () => void; initialId?: string | null }) {
  const partner = usePartner();
  const people = roster(partner);
  const [selected, setSelected] = useState<string | null>(initialId);
  const person = people.find((item) => item.id === selected) ?? null;

  if (person) {
    return <PartnerDetail person={person} onBack={() => setSelected(null)} />;
  }

  return <PartnerList onBack={onBack} onOpen={(id) => setSelected(id)} />;
}

function PartnerList({ onBack, onOpen }: { onBack: () => void; onOpen: (id: string) => void }) {
  const partner = usePartner();
  const groups = useGroups();
  const { showToast } = useApp();
  const people = roster(partner);
  const [busy, setBusy] = useState<"invite" | "accept" | "decline" | "person" | null>(null);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [codeOpen, setCodeOpen] = useState(false);
  const [code, setCode] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const invite = partner.invite;
  const incoming = partner.incoming;
  const inviteUrl = invite
    ? partnerInviteUrl(
        pageOriginForLinks(window.location.origin, import.meta.env.VITE_APP_URL),
        import.meta.env.BASE_URL,
        invite.code,
      )
    : "";
  const room = canAddPartner(people.length);
  const candidates = partnerCandidates({
    selfId: "self",
    partnerIds: people.map((person) => person.id),
    people: groups.people,
    query,
  });
  const chosen = candidates.find((person) => person.id === picked) ?? candidates[0] ?? null;
  const heading = incoming ? `${incoming.inviterName} invited you` : people.length > 0 ? "Reading partners" : "Choose a partner";

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
        <p>
          {people.length > 0
            ? "Each person sees whether you read today — never your answers or notes."
            : "One person who sees whether you read today — never your answers or notes."}
        </p>
      </header>
      {partner.status === "loading" && people.length === 0 && !invite && !incoming ? <p className="soft">Loading…</p> : null}
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
      {incoming ? (
        <article className="partner-request">
          <p>{`${incoming.inviterName} invited you to read together.`}</p>
          <div className="footer">
            <Button onClick={() => void run("accept", () => partner.acceptIncoming(), `You’re reading with ${incoming.inviterName}.`)} disabled={busy !== null}>
              {busy === "accept" ? "Joining…" : "Read together"}
            </Button>
            <Button variant="quiet" onClick={() => void run("decline", () => partner.declineIncoming(), "Invite set aside.")} disabled={busy !== null}>
              Not now
            </Button>
          </div>
        </article>
      ) : null}
      {partner.requests.map((request) => (
        <article key={request.code} className="partner-request">
          <p>{`${request.inviterName} invited you to read together.`}</p>
          <div className="footer">
            <Button
              onClick={() => void run("accept", () => partner.acceptRequest(request.code), `You’re reading with ${request.inviterName}.`)}
              disabled={busy !== null}
            >
              Read together
            </Button>
            <Button variant="quiet" onClick={() => void run("decline", () => partner.declineRequest(request.code), "Invite set aside.")} disabled={busy !== null}>
              Not now
            </Button>
          </div>
        </article>
      ))}
      {people.length > 0 ? (
        <div className="settings-card">
          {people.map((person) => {
            const read = partnerReadLabel(person.readToday);
            return (
              <button key={person.id || person.displayName} type="button" className="settings-row" onClick={() => onOpen(person.id)}>
                <Avatar name={person.displayName} tone="warm" size={36} />
                <span className="row-label">
                  {person.displayName}
                  {read ? <span className="social-read">{read}</span> : null}
                </span>
                <ChevronRight className="chev" size={16} aria-hidden="true" />
              </button>
            );
          })}
        </div>
      ) : null}
      {people.length === 0 && !incoming ? <PrivacyCard name={chosen ? chosen.displayName.split(" ")[0] || "Your partner" : "Your partner"} /> : null}
      {room && groups.people.length > 0 ? (
        <section className="settings-group">
          <p className="eyebrow">From your groups</p>
          <label className="social-box">
            <Search size={16} aria-hidden="true" />
            <input value={query} placeholder="Search name or email" onChange={(event) => setQuery(event.target.value)} />
          </label>
          <div className="settings-card partner-people">
            {candidates.length === 0 ? <p className="soft social-empty">No one in your groups matches that.</p> : null}
            {candidates.map((person) => {
              const active = chosen?.id === person.id;
              return (
                <button
                  key={person.id}
                  type="button"
                  className={active ? "settings-row is-picked" : "settings-row"}
                  aria-pressed={active}
                  onClick={() => setPicked(person.id)}
                >
                  <Avatar name={person.displayName} tone="warm" size={36} />
                  <span className="row-label">
                    {person.displayName}
                    <span>{person.groupName}</span>
                  </span>
                  {active ? <Check className="chev" size={18} aria-hidden="true" /> : null}
                </button>
              );
            })}
          </div>
        </section>
      ) : null}
      {invite && people.length === 0 && !incoming ? (
        <InviteCard code={invite.code} expiresAt={invite.expiresAt} url={inviteUrl} onCopy={() => void copyLink()} />
      ) : null}
      {!room ? <p className="soft">{`You can keep ${PARTNER_CAP} reading partners.`}</p> : null}
      <div className="footer">
        {room && chosen ? (
          <Button
            onClick={() => void run("person", () => partner.invitePerson(chosen.id), `Invite sent to ${chosen.displayName}.`)}
            disabled={busy !== null}
          >
            {busy === "person" ? "Inviting…" : `Invite ${chosen.displayName.split(" ")[0]} as partner`}
          </Button>
        ) : null}
        {room && invite ? (
          <>
            <Button onClick={() => void shareLink()}>Share invite link</Button>
            <Button variant="text" onClick={() => void run("invite", () => partner.createInvite(), "New invite ready.")} disabled={busy !== null}>
              Reset code
            </Button>
          </>
        ) : null}
        {room && !invite ? (
          <Button onClick={() => void run("invite", () => partner.createInvite(), "Invite ready.")} disabled={busy !== null}>
            {busy === "invite" ? "Creating…" : "Create an invite"}
          </Button>
        ) : null}
        {room ? (
          <Button variant="quiet" onClick={() => setCodeOpen(true)} disabled={busy !== null}>
            I have a code
          </Button>
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
          <div className="footer">
            <Button
              onClick={() =>
                void run("invite", async () => {
                  const failure = await partner.lookupCode(code);
                  if (!failure) setCodeOpen(false);
                  return failure;
                })
              }
              disabled={busy !== null}
            >
              Look up
            </Button>
          </div>
        </Sheet>
      ) : null}
    </section>
  );
}

function PartnerDetail({ person, onBack }: { person: PartnerPerson; onBack: () => void }) {
  const partner = usePartner();
  const { showToast, today } = useApp();
  const [note, setNote] = useState<NudgeNote | null>(NUDGE_NOTES[0]);
  const [busy, setBusy] = useState<"drop" | "unlink" | null>(null);
  const [confirmUnlink, setConfirmUnlink] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const readLabel = partnerReadLabel(person.readToday);
  const thread = partner.drops.filter((drop) => drop.senderId === person.id || drop.recipientId === person.id);
  const canSend = !thread.some((drop) => drop.fromSelf && drop.day === today);

  async function send() {
    if (busy || !canSend) return;
    setBusy("drop");
    setFormError(null);
    const failure = person.id ? await partner.sendDrop(person.id, note) : await partner.sendNudge(note ?? NUDGE_NOTES[0]);
    setBusy(null);
    if (failure) {
      setFormError(failure);
      return;
    }
    showToast("Sent. A quiet drop is enough.");
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
        <p className="partner-title">{person.displayName}</p>
        <p>They see whether you read today — never your answers or notes.</p>
      </header>
      {formError ? (
        <p className="auth-error" role="alert">
          {formError}
        </p>
      ) : null}
      <div className="partner-person">
        <Avatar name={person.displayName} tone="warm" size={36} />
        <span className="partner-person-copy">
          <strong>{person.displayName}</strong>
          {readLabel ? (
            <span className="partner-read">
              <Check size={15} aria-hidden="true" />
              {readLabel}
            </span>
          ) : (
            <span>A quiet hello is enough</span>
          )}
        </span>
      </div>
      <section className="settings-group">
        <p className="eyebrow">A drop</p>
        <div className="settings-card partner-notes">
          {dropNoteChoices().map((choice) => (
            <button
              key={dropNoteLabel(choice)}
              type="button"
              className={choice === note ? "settings-row is-picked" : "settings-row"}
              aria-pressed={choice === note}
              onClick={() => setNote(choice)}
            >
              <span className="row-label">{dropNoteLabel(choice)}</span>
              {choice === note ? <Check className="chev" size={18} aria-hidden="true" /> : null}
            </button>
          ))}
        </div>
        <p className="soft">{canSend ? "One drop for them today. It never says they missed." : "You sent a drop today. That’s enough."}</p>
      </section>
      {thread.length > 0 ? (
        <section className="settings-group">
          <p className="eyebrow">Drops</p>
          <div className="partner-thread">
            {thread.map((drop) => (
              <article key={drop.id} className="partner-thread-note">
                <p>{quietDropLine(person.displayName, drop.body)}</p>
                <span>{drop.fromSelf ? "From you" : `From ${person.displayName}`}</span>
              </article>
            ))}
          </div>
        </section>
      ) : null}
      <div className="footer">
        <Button onClick={() => void send()} disabled={busy !== null || !canSend}>
          {busy === "drop" ? "Sending…" : "Drop"}
        </Button>
        <Button variant="text" className="partner-unlink" onClick={() => setConfirmUnlink(true)} disabled={busy !== null}>
          Unlink partner
        </Button>
      </div>
      {confirmUnlink ? (
        <Sheet title={`Unlink ${person.displayName}?`} onClose={() => setConfirmUnlink(false)}>
          <p>You’ll stop seeing each other’s drops. Their answers stay private, as they always were.</p>
          <div className="footer">
            <Button
              className="btn-caution"
              disabled={busy !== null}
              onClick={() => {
                if (busy) return;
                setBusy("unlink");
                void partner.unlink(person.id || undefined).then((failure) => {
                  setBusy(null);
                  if (failure) {
                    setFormError(failure);
                    return;
                  }
                  setConfirmUnlink(false);
                  showToast("Partner unlinked.");
                  onBack();
                });
              }}
            >
              Unlink partner
            </Button>
            <Button variant="quiet" onClick={() => setConfirmUnlink(false)}>
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

export function PartnerBanner({ onOpenInbox }: { onOpenInbox?: () => void }) {
  const partner = usePartner();
  const { today } = useApp();
  const names = new Map(roster(partner).map((person) => [person.id, person.displayName]));
  const unseen = receivedDrops(partner.drops, today);
  const note = unseen[0];
  if (!note) return null;
  const name = names.get(note.senderId) ?? "Someone";
  return (
    <aside className="partner-banner" role="status">
      <HeartHandshake size={18} aria-hidden="true" />
      <button type="button" className="partner-banner-copy" onClick={onOpenInbox}>
        <strong>{`${name} sent a drop`}</strong>
        <span>{quietDropLine(name, note.body)}</span>
        {unseen.length > 1 ? <span>{`${unseen.length} drops waiting`}</span> : null}
      </button>
      <button type="button" className="icon-btn" aria-label="Keep this drop" onClick={() => void partner.seeDrop(note.id)}>
        <X size={16} />
      </button>
    </aside>
  );
}

export function DropInbox({ onClose }: { onClose: () => void }) {
  const partner = usePartner();
  const { today } = useApp();
  const names = new Map(roster(partner).map((person) => [person.id, person.displayName]));
  const rows = partner.drops.filter((drop) => !drop.fromSelf);
  return (
    <Sheet title="Drops" description="A quiet thank-you. Nothing here is a missed day." onClose={onClose}>
      {rows.length === 0 ? <p className="soft">No drops yet.</p> : null}
      <div className="partner-thread">
        {rows.map((drop) => (
          <DropRow key={drop.id} drop={drop} name={names.get(drop.senderId) ?? "Someone"} fresh={drop.day === today || !drop.seen} onSeen={() => void partner.seeDrop(drop.id)} />
        ))}
      </div>
    </Sheet>
  );
}

function DropRow({
  drop,
  name,
  fresh,
  onSeen,
}: {
  drop: VisibleDrop;
  name: string;
  fresh: boolean;
  onSeen: () => void;
}) {
  return (
    <article className="partner-thread-note">
      <p>{quietDropLine(name, drop.body)}</p>
      <span>{fresh ? `From ${name}` : `From ${name} · kept`}</span>
      {!drop.seen ? (
        <button type="button" className="social-qr" onClick={onSeen}>
          Keep
        </button>
      ) : null}
    </article>
  );
}
