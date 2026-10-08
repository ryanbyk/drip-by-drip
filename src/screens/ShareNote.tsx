import { useState } from "react";
import { DropChip } from "../components/SocialBits";
import { Button, Sheet } from "../components/ui";
import { SHARE_NOTE_PROMISE, type SharedNote } from "../domain/sharedNote";

export function ShareNoteSheet({
  groups,
  partners,
  shared,
  busy,
  error,
  onClose,
  onShare,
  onStop,
}: {
  groups: { id: string; name: string }[];
  partners: { id: string; name: string }[];
  shared: SharedNote | null;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onShare: (groupIds: string[], partnerIds: string[]) => void;
  onStop: () => void;
}) {
  const [groupIds, setGroupIds] = useState<string[]>(shared?.groupIds ?? []);
  const [partnerIds, setPartnerIds] = useState<string[]>(shared?.partnerIds ?? []);

  function toggle(list: string[], id: string, set: (next: string[]) => void) {
    set(list.includes(id) ? list.filter((item) => item !== id) : [...list, id]);
  }

  return (
    <Sheet title="Share this note" description={SHARE_NOTE_PROMISE} onClose={onClose}>
      {groups.length === 0 && partners.length === 0 ? <p className="soft">Join a group or add a partner before a note can be shared.</p> : null}
      {groups.length > 0 ? (
        <div className="settings-card">
          {groups.map((group) => {
            const on = groupIds.includes(group.id);
            return (
              <button key={group.id} type="button" className="settings-row" aria-pressed={on} onClick={() => toggle(groupIds, group.id, setGroupIds)}>
                <span className="row-label">{group.name}</span>
                <span className={on ? "switch is-on" : "switch"} aria-hidden="true">
                  <span />
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
      {partners.length > 0 ? (
        <div className="settings-card">
          {partners.map((person) => {
            const on = partnerIds.includes(person.id);
            return (
              <button key={person.id} type="button" className="settings-row" aria-pressed={on} onClick={() => toggle(partnerIds, person.id, setPartnerIds)}>
                <span className="row-label">{person.name}</span>
                <span className={on ? "switch is-on" : "switch"} aria-hidden="true">
                  <span />
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
      {error ? (
        <p className="auth-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="footer">
        <Button onClick={() => onShare(groupIds, partnerIds)} disabled={busy || (groupIds.length === 0 && partnerIds.length === 0)}>
          {busy ? "Sharing…" : "Share note"}
        </Button>
        {shared ? (
          <Button variant="text" className="partner-unlink" onClick={onStop} disabled={busy}>
            Stop sharing
          </Button>
        ) : null}
      </div>
    </Sheet>
  );
}

export function SharedNoteList({
  notes,
  selfId,
  sentTo,
  onDrop,
}: {
  notes: SharedNote[];
  selfId: string | null;
  sentTo: ReadonlySet<string>;
  onDrop: (authorId: string) => void;
}) {
  if (notes.length === 0) return null;
  return (
    <section className="settings-group">
      <p className="eyebrow">Shared notes</p>
      <div className="settings-card">
        {notes.map((note) => {
          const mine = note.authorId === selfId;
          return (
            <article key={note.id} className="shared-note">
              <span>
                <strong>{mine ? "You" : note.authorName}</strong>
                <p>{note.body}</p>
              </span>
              {mine ? null : (
                <DropChip
                  sent={sentTo.has(note.authorId)}
                  aria-label={sentTo.has(note.authorId) ? `Drop sent to ${note.authorName}` : `Drop for ${note.authorName}`}
                  onClick={() => onDrop(note.authorId)}
                />
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
