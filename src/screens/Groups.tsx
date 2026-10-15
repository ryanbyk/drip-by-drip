import { useEffect, useState } from "react";
import { QrCode } from "../components/QrCode";
import { Avatar, DropChip } from "../components/SocialBits";
import { ChevronLeft, ChevronRight, Copy, Droplet, Link2, Plus, QrCode as QrIcon, UserMinus, Users } from "../components/Icons";
import { Button, Sheet } from "../components/ui";
import { planTitle, type StoredPlan } from "../domain/groupPlan";
import { inviteExpiryLabel, partnerInviteLabel } from "../domain/partner";
import {
  GROUP_CODE_LENGTH,
  GROUP_MEMBER_CAP,
  avatarTone,
  formatGroupCode,
  groupHomeReadLabel,
  groupInviteShareText,
  groupInviteUrl,
  groupListReadLabel,
  leaderMeta,
  memberCountLabel,
  normalizeGroupCode,
  partnerReadLine,
  quietDropLine,
} from "../domain/social";
import { pageOriginForLinks } from "../lib/appUrl";
import type { GroupLookup } from "../lib/groupClient";
import { GroupPlanCard, PlanDetail, PlanSetup } from "./GroupPlan";
import { SharedNoteList } from "./ShareNote";
import { useApp } from "../state/AppState";
import { useAuth } from "../state/auth-context";
import { useGroups } from "../state/group-context";
import { usePartner } from "../state/partner-context";

type View = { name: "list" } | { name: "create" } | { name: "home"; id: string } | { name: "plan"; id: string } | { name: "setup"; id: string };
type Start = "list" | "create" | "join" | "home" | "invite" | "plan" | "setup";

export function Groups({
  onBack,
  onOpenPartner,
  onReadToday,
  start = "list",
  draft,
}: {
  onBack: () => void;
  onOpenPartner: () => void;
  onReadToday: () => void;
  /** Storybook only. The app always opens on the list. */
  start?: Start;
  draft?: { name: string; description: string };
}) {
  const groups = useGroups();
  const firstId = groups.groups[0]?.id ?? "";
  const [view, setView] = useState<View>(() => {
    if (start === "create") return { name: "create" };
    if (start === "plan" && firstId) return { name: "plan", id: firstId };
    if (start === "setup" && firstId) return { name: "setup", id: firstId };
    if ((start === "home" || start === "invite") && firstId) return { name: "home", id: firstId };
    return { name: "list" };
  });
  const [joinOpen, setJoinOpen] = useState(start === "join" || Boolean(groups.pendingCode));
  const [homeId, setHomeId] = useState<string | null>(start === "invite" ? firstId : null);

  useEffect(() => {
    if (groups.pendingCode) setJoinOpen(true);
  }, [groups.pendingCode]);

  if (view.name === "create") {
    return (
      <CreateGroup
        draft={draft}
        onBack={() => setView({ name: "list" })}
        onCreated={(id) => {
          setHomeId(id);
          setView({ name: "home", id });
        }}
      />
    );
  }

  if (view.name === "setup") {
    const existing = groups.groups.find((group) => group.id === view.id)?.plan;
    return (
      <PlanEditor
        groupId={view.id}
        onBack={() => setView(existing ? { name: "plan", id: view.id } : { name: "home", id: view.id })}
        onSaved={() => setView({ name: "plan", id: view.id })}
      />
    );
  }

  if (view.name === "plan") {
    return (
      <PlanScreen
        groupId={view.id}
        onBack={() => setView({ name: "home", id: view.id })}
        onEdit={() => setView({ name: "setup", id: view.id })}
        onReadToday={onReadToday}
      />
    );
  }

  if (view.name === "home") {
    return (
      <GroupHome
        groupId={view.id}
        inviteOnOpen={homeId === view.id}
        onBack={() => {
          setHomeId(null);
          setView({ name: "list" });
        }}
        onReadToday={onReadToday}
        onOpenPlan={() => setView({ name: "plan", id: view.id })}
        onSetPlan={() => setView({ name: "setup", id: view.id })}
      />
    );
  }

  return (
    <section className="screen screen-tabbed social">
      <div className="social-top">
        <button type="button" className="icon-btn" aria-label="Back" onClick={onBack}>
          <ChevronLeft size={18} />
        </button>
        <h1>Groups</h1>
        <button type="button" className="social-add" aria-label="Create group" onClick={() => setView({ name: "create" })}>
          <Plus size={18} />
        </button>
      </div>
      {groups.status === "loading" && groups.groups.length === 0 ? <p className="soft">Loading…</p> : null}
      {groups.error ? (
        <p className="auth-error" role="alert">
          {groups.error}
        </p>
      ) : null}
      {groups.groups.length === 0 && groups.status === "ready" ? (
        <p className="soft">No groups yet. Start one, or join with a code.</p>
      ) : null}
      <div className="social-list">
        {groups.groups.map((group) => {
          const read = groupListReadLabel(group.readCount);
          return (
            <button key={group.id} type="button" className="social-card" onClick={() => setView({ name: "home", id: group.id })}>
              <span className="social-card-head">
                <span>
                  <strong>{group.name}</strong>
                  <span>{memberCountLabel(group.memberCount, group.plan ? planTitle(group.plan) : null)}</span>
                </span>
                <ChevronRight size={16} aria-hidden="true" />
              </span>
              <span className="social-card-activity">
                {group.preview.length > 0 ? (
                  <span className="avatar-stack">
                    {group.preview.map((person, index) => (
                      <Avatar key={person.id} name={person.displayName} tone={avatarTone(index, { self: false, owner: person.id === group.ownerId })} size={28} />
                    ))}
                  </span>
                ) : (
                  <Users size={16} aria-hidden="true" />
                )}
                {read ? (
                  <span className="social-read">
                    <Droplet size={14} aria-hidden="true" />
                    {read}
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
        <PartnerCards onOpen={onOpenPartner} />
      </div>
      <div className="social-join-row">
        <button type="button" className="social-choice" onClick={() => setView({ name: "create" })}>
          <Plus size={16} aria-hidden="true" />
          Create group
        </button>
        <button type="button" className="social-choice" onClick={() => setJoinOpen(true)}>
          <Users size={16} aria-hidden="true" />
          Join with code
        </button>
      </div>
      {joinOpen ? (
        <JoinSheet
          initialCode={groups.pendingCode ?? ""}
          onClose={() => {
            groups.dismissPending();
            setJoinOpen(false);
          }}
          onJoined={(id) => {
            setJoinOpen(false);
            setView({ name: "home", id });
          }}
        />
      ) : null}
    </section>
  );
}

function PartnerCards({ onOpen }: { onOpen: () => void }) {
  const partner = usePartner();
  const people = partner.partners.length > 0 ? partner.partners : partner.partner ? [partner.partner] : [];
  if (people.length === 0) return null;
  return (
    <>
      {people.map((person, index) => {
        const read = partnerReadLine(person.displayName, person.readToday);
        return (
          <button key={person.id || person.displayName} type="button" className="social-card" onClick={onOpen}>
            <span className="social-card-head">
              <span>
                <strong>{`Partner · ${person.displayName}`}</strong>
                <span>Just the two of you</span>
              </span>
              <ChevronRight size={16} aria-hidden="true" />
            </span>
            <span className="social-card-activity">
              <span className="avatar-stack">
                <Avatar name={person.displayName} tone={avatarTone(index, { self: false, owner: false })} size={28} />
              </span>
              {read ? (
                <span className="social-read">
                  <Droplet size={14} aria-hidden="true" />
                  {read}
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
    </>
  );
}

function CreateGroup({
  draft,
  onBack,
  onCreated,
}: {
  draft?: { name: string; description: string };
  onBack: () => void;
  onCreated: (id: string) => void;
}) {
  const groups = useGroups();
  const { showToast } = useApp();
  const [name, setName] = useState(draft?.name ?? "");
  const [description, setDescription] = useState(draft?.description ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (busy) return;
    const cleaned = name.trim();
    if (!cleaned) {
      setError("Give the group a name.");
      return;
    }
    setBusy(true);
    setError(null);
    const result = await groups.create(cleaned, description.trim());
    setBusy(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    showToast("Group started.");
    onCreated(result.id);
  }

  return (
    <section className="screen screen-tabbed social">
      <div className="account-nav">
        <button type="button" className="icon-btn" aria-label="Back" onClick={onBack}>
          <ChevronLeft size={18} />
        </button>
        <h1>New group</h1>
        <button type="button" className="social-nav-action" onClick={onBack}>
          Cancel
        </button>
      </div>
      <header className="partner-head">
        <p className="partner-title">Start a group</p>
        <p>Read together, gently. Members see who read today — never answers. A note stays private unless you share it.</p>
      </header>
      <div className="social-form">
        <label className="social-field">
          <span>Group name</span>
          <span className="social-box">
            <input value={name} maxLength={80} placeholder="Tuesday Night Group" onChange={(event) => setName(event.target.value)} />
          </span>
        </label>
        <label className="social-field">
          <span>Description (optional)</span>
          <span className="social-box social-box-tall">
            <textarea
              value={description}
              maxLength={200}
              placeholder="Men’s small group · reading together this fall"
              onChange={(event) => setDescription(event.target.value)}
            />
          </span>
        </label>
        <div className="social-field">
          <span>Reading plan</span>
          <div className="social-plan" aria-current="true">
            <span className="social-plan-icon" aria-hidden="true">
              <Users size={16} />
            </span>
            <span>
              <strong>Everyone reads their own book</strong>
              <span>A shared plan can wait</span>
            </span>
          </div>
        </div>
      </div>
      {error ? (
        <p className="auth-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="footer">
        <Button onClick={() => void create()} disabled={busy}>
          {busy ? "Starting…" : "Create & invite"}
        </Button>
      </div>
    </section>
  );
}

function JoinSheet({
  initialCode,
  onClose,
  onJoined,
}: {
  initialCode: string;
  onClose: () => void;
  onJoined: (id: string) => void;
}) {
  const groups = useGroups();
  const [code, setCode] = useState(normalizeGroupCode(initialCode));
  const [found, setFound] = useState<GroupLookup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"lookup" | "join" | null>(null);

  useEffect(() => {
    if (normalizeGroupCode(initialCode).length === GROUP_CODE_LENGTH) {
      void lookup(normalizeGroupCode(initialCode));
    }
    // The link should resolve once when the sheet opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function lookup(next = code) {
    if (next.length !== GROUP_CODE_LENGTH) {
      setFound(null);
      return;
    }
    setBusy("lookup");
    setError(null);
    const result = await groups.lookup(next);
    setBusy(null);
    if ("error" in result) {
      setFound(null);
      setError(result.error);
      return;
    }
    setFound(result);
  }

  async function join() {
    if (!found || busy) return;
    setBusy("join");
    setError(null);
    const result = await groups.join(code);
    setBusy(null);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    onJoined(result.id);
  }

  return (
    <Sheet title="Join with a code" description="Ask your group leader for their 6-character code." onClose={onClose}>
      <CodeBoxes
        value={code}
        onChange={(next) => {
          setCode(next);
          setFound(null);
          if (next.length === GROUP_CODE_LENGTH) void lookup(next);
        }}
      />
      {error ? (
        <p className="auth-error" role="alert">
          {error}
        </p>
      ) : null}
      {found ? (
        <div className="social-found">
          <Avatar name={found.name} tone="owner" size={40} />
          <span>
            <strong>{found.name}</strong>
            <span>{`Led by ${found.leaderName} · ${found.memberCount} ${found.memberCount === 1 ? "member" : "members"}`}</span>
          </span>
        </div>
      ) : null}
      <div className="footer">
        <Button onClick={() => void join()} disabled={!found || found.full || busy !== null}>
          {busy === "join" ? "Joining…" : found?.alreadyMember ? "Open group" : found?.full ? "This group is full" : "Join group"}
        </Button>
        {found?.full ? <p className="soft">{`Groups hold up to ${GROUP_MEMBER_CAP} members.`}</p> : null}
      </div>
    </Sheet>
  );
}

function CodeBoxes({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const chars = value.padEnd(GROUP_CODE_LENGTH, " ").slice(0, GROUP_CODE_LENGTH).split("");
  return (
    <label className="code-boxes">
      <span className="sr-only">Group code</span>
      <input
        value={value}
        inputMode="text"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        maxLength={GROUP_CODE_LENGTH + 1}
        onChange={(event) => onChange(normalizeGroupCode(event.target.value))}
      />
      <span className="code-boxes-row" aria-hidden="true">
        {chars.slice(0, 3).map((char, index) => (
          <span key={`a${index}`} className="code-box">
            {char.trim()}
          </span>
        ))}
        <span className="code-dash">–</span>
        {chars.slice(3).map((char, index) => (
          <span key={`b${index}`} className="code-box">
            {char.trim()}
          </span>
        ))}
      </span>
    </label>
  );
}

function PlanScreen({
  groupId,
  onBack,
  onEdit,
  onReadToday,
}: {
  groupId: string;
  onBack: () => void;
  onEdit: () => void;
  onReadToday: () => void;
}) {
  const groups = useGroups();
  const { snapshot, today, dispatch, showToast } = useApp();
  const group = groups.groups.find((item) => item.id === groupId);
  const plan = group?.plan ?? null;
  const members = groups.members[groupId] ?? [];
  const leader = members.find((member) => member.role === "owner");
  const following = snapshot.prefs.groupPlan?.planId === plan?.id ? snapshot.prefs.groupPlan : null;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!group || !plan) {
    return (
      <section className="screen screen-tabbed social">
        <div className="account-nav">
          <button type="button" className="icon-btn" aria-label="Back" onClick={onBack}>
            <ChevronLeft size={18} />
          </button>
          <h1>Plan</h1>
          <span className="account-nav-end" />
        </div>
        <p className="soft">This group is reading on its own.</p>
      </section>
    );
  }

  const activeGroup = group;
  const activePlan = plan;

  async function join(mode: "group" | "start") {
    if (busy) return;
    setBusy(true);
    setError(null);
    const previous = snapshot.prefs.groupPlan;
    const failure = await groups.followPlan(activeGroup.id, mode, today);
    if (failure) {
      setBusy(false);
      setError(failure);
      return;
    }
    if (previous && previous.groupId !== activeGroup.id) await groups.leavePlan(previous.groupId);
    dispatch({
      type: "followGroupPlan",
      plan: {
        planId: activePlan.id,
        groupId: activeGroup.id,
        groupName: activeGroup.name,
        bookId: activePlan.bookId,
        startChapter: activePlan.startChapter,
        endChapter: activePlan.endChapter,
        pace: activePlan.pace,
        readingDays: activePlan.readingDays,
        startDate: activePlan.startDate,
        mode,
        startedOn: today,
      },
    });
    setBusy(false);
    showToast(mode === "start" ? "Starting at day 1. Your place in your own book stays." : "Joined where the group is.");
  }

  return (
    <PlanDetail
      groupName={group.name}
      leaderName={leader?.displayName ?? "the leader"}
      plan={plan}
      members={members}
      owner={group.role === "owner"}
      following={following}
      busy={busy}
      error={error}
      onBack={onBack}
      onJoin={(mode) => void join(mode)}
      onLeave={() =>
        void (async () => {
          setBusy(true);
          setError(null);
          const failure = await groups.leavePlan(group.id);
          setBusy(false);
          if (failure) setError(failure);
          else showToast("Your own book is back on Today.");
        })()
      }
      onRead={onReadToday}
      onEdit={onEdit}
      onEnd={() =>
        void (async () => {
          setBusy(true);
          setError(null);
          const failure = await groups.endPlan(group.id);
          setBusy(false);
          if (failure) setError(failure);
          else onBack();
        })()
      }
    />
  );
}

function PlanEditor({
  groupId,
  onBack,
  onSaved,
}: {
  groupId: string;
  onBack: () => void;
  onSaved: () => void;
}) {
  const groups = useGroups();
  const { showToast } = useApp();
  const group = groups.groups.find((item) => item.id === groupId);
  const plan = group?.plan ?? null;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initial: StoredPlan | null = plan
    ? {
        bookId: plan.bookId,
        startChapter: plan.startChapter,
        endChapter: plan.endChapter,
        pace: plan.pace,
        readingDays: plan.readingDays,
        startDate: plan.startDate,
      }
    : null;

  return (
    <PlanSetup
      initial={initial}
      busy={busy}
      error={error}
      onBack={onBack}
      onSave={(draft) =>
        void (async () => {
          setBusy(true);
          setError(null);
          const result = await groups.setPlan(groupId, draft);
          setBusy(false);
          if ("error" in result) {
            setError(result.error);
            return;
          }
          showToast(initial ? "Plan replaced. Members choose again." : "Plan saved.");
          onSaved();
        })()
      }
    />
  );
}

function GroupHome({
  groupId,
  inviteOnOpen,
  onBack,
  onReadToday,
  onOpenPlan,
  onSetPlan,
}: {
  groupId: string;
  inviteOnOpen: boolean;
  onBack: () => void;
  onReadToday: () => void;
  onOpenPlan: () => void;
  onSetPlan: () => void;
}) {
  const groups = useGroups();
  const partner = usePartner();
  const auth = useAuth();
  const { showToast, today } = useApp();
  const group = groups.groups.find((item) => item.id === groupId);
  const members = groups.members[groupId] ?? [];
  const invite = groups.invites[groupId] ?? null;
  const [inviteOpen, setInviteOpen] = useState(inviteOnOpen);
  const [renameOpen, setRenameOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const leader = members.find((member) => member.role === "owner");
  const read = groupHomeReadLabel(group?.readCount ?? members.filter((member) => member.readToday).length);
  const selfId = auth.user?.id ?? members.find((member) => member.self)?.id ?? null;
  const sentTo = new Set(
    partner.drops.filter((drop) => drop.fromSelf && drop.day === today).map((drop) => drop.recipientId),
  );

  async function run(work: () => Promise<string | null>, success?: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    const failure = await work();
    setBusy(false);
    if (failure) {
      setError(failure);
      return;
    }
    if (success) showToast(success);
  }

  if (!group) {
    return (
      <section className="screen screen-tabbed social">
        <div className="account-nav">
          <button type="button" className="icon-btn" aria-label="Back" onClick={onBack}>
            <ChevronLeft size={18} />
          </button>
          <h1>Group</h1>
          <span className="account-nav-end" />
        </div>
        <p className="soft">That group isn’t on this account.</p>
      </section>
    );
  }

  return (
    <section className="screen screen-tabbed social social-home">
      <div className="account-nav">
        <button type="button" className="icon-btn" aria-label="Back" onClick={onBack}>
          <ChevronLeft size={18} />
        </button>
        <h1>Group</h1>
        <button type="button" className="icon-btn" aria-label="Invite" onClick={() => setInviteOpen(true)}>
          <Plus size={18} />
        </button>
      </div>
      <header className="partner-head social-head">
        <p className="partner-title">{group.name}</p>
        <p>{leaderMeta(group.memberCount, leader?.displayName ?? "the leader")}</p>
        {group.description ? <p>{group.description}</p> : null}
      </header>
      {group.plan ? (
        <GroupPlanCard plan={group.plan} onOpen={onOpenPlan} />
      ) : (
        <p className="soft">Everyone reads their own book.</p>
      )}
      {error ? (
        <p className="auth-error" role="alert">
          {error}
        </p>
      ) : null}
      <section className="social-today">
        <div className="social-today-head">
          <p className="eyebrow">Today</p>
          {read ? (
            <span className="social-read">
              <Droplet size={14} aria-hidden="true" />
              {read}
            </span>
          ) : null}
        </div>
        <div className="settings-card">
          {members.map((member, index) => {
            const incoming = partner.drops.find((drop) => !drop.fromSelf && drop.senderId === member.id && (drop.day === today || !drop.seen));
            const sent = member.sentDropToday || partner.drops.some((drop) => drop.fromSelf && drop.recipientId === member.id && drop.day === today);
            const label = member.self
              ? `${member.displayName} (you)${member.role === "owner" ? " · Leader" : ""}`
              : member.role === "owner"
                ? `${member.displayName} · Leader`
                : member.displayName;
            return (
              <div key={member.id} className="member-row">
                <Avatar
                  name={member.displayName}
                  tone={avatarTone(index, { self: member.self, owner: member.role === "owner" })}
                  size={32}
                />
                <span className="member-copy">
                  <strong>{label}</strong>
                  {incoming ? <span>{quietDropLine(member.displayName, incoming.body)}</span> : null}
                </span>
                {member.readToday ? (
                  <span className="social-read">
                    <Droplet size={14} aria-hidden="true" />
                    Read today
                  </span>
                ) : null}
                {!member.self ? (
                  <DropChip
                    sent={sent || member.sentDropToday}
                    aria-label={sent || member.sentDropToday ? `Drop sent to ${member.displayName}` : `Drop for ${member.displayName}`}
                    onClick={() => void run(() => partner.sendDrop(member.id, null), "Sent. A quiet drop is enough.")}
                  />
                ) : null}
                {group.role === "owner" && !member.self ? (
                  <button type="button" className="member-remove" aria-label={`Remove ${member.displayName}`} onClick={() => setRemoveId(member.id)}>
                    <UserMinus size={16} />
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
        <SharedNoteList
          notes={groups.notes.filter((note) => note.groupIds.includes(group.id) && note.day === today)}
          selfId={selfId}
          sentTo={sentTo}
          onDrop={(authorId) => void run(() => partner.sendDrop(authorId, null), "Sent. A quiet drop is enough.")}
        />
        <p className="social-privacy">No one sees “Not today,” or a note you didn’t share.</p>
      </section>
      <div className="footer">
        <Button onClick={onReadToday}>Read today’s drip</Button>
        {group.role === "owner" && !group.plan ? (
          <Button variant="text" onClick={onSetPlan}>
            Set a reading plan
          </Button>
        ) : null}
        {group.role === "owner" ? (
          <Button variant="text" onClick={() => setRenameOpen(true)}>
            Rename group
          </Button>
        ) : null}
        <Button variant="text" className="partner-unlink" onClick={() => setLeaving(true)}>
          Leave group
        </Button>
      </div>
      {inviteOpen ? <InviteSheet groupId={group.id} name={group.name} invite={invite} onClose={() => setInviteOpen(false)} /> : null}
      {renameOpen ? (
        <RenameSheet
          initial={group.name}
          busy={busy}
          onClose={() => setRenameOpen(false)}
          onSave={(name) =>
            void run(async () => {
              const failure = await groups.rename(group.id, name);
              if (!failure) setRenameOpen(false);
              return failure;
            }, "Name saved.")
          }
        />
      ) : null}
      {leaving ? (
        <Sheet title="Leave this group?" onClose={() => setLeaving(false)}>
          <p>You’ll stop seeing who read today. Your answers stay private, as they always were.</p>
          <div className="footer">
            <Button
              className="btn-caution"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const failure = await groups.leave(group.id);
                  if (!failure) onBack();
                  return failure;
                })
              }
            >
              Leave group
            </Button>
            <Button variant="quiet" onClick={() => setLeaving(false)}>
              Cancel
            </Button>
          </div>
        </Sheet>
      ) : null}
      {removeId ? (
        <Sheet title="Remove this member?" onClose={() => setRemoveId(null)}>
          <p>They’ll leave the group. Their reading stays their own.</p>
          <div className="footer">
            <Button
              className="btn-caution"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const failure = await groups.remove(group.id, removeId);
                  if (!failure) setRemoveId(null);
                  return failure;
                }, "Member removed.")
              }
            >
              Remove
            </Button>
            <Button variant="quiet" onClick={() => setRemoveId(null)}>
              Cancel
            </Button>
          </div>
        </Sheet>
      ) : null}
    </section>
  );
}

function RenameSheet({
  initial,
  busy,
  onClose,
  onSave,
}: {
  initial: string;
  busy: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
}) {
  const [name, setName] = useState(initial);
  return (
    <Sheet title="Rename group" onClose={onClose}>
      <label className="social-field">
        <span>Group name</span>
        <span className="social-box">
          <input value={name} maxLength={80} onChange={(event) => setName(event.target.value)} />
        </span>
      </label>
      <div className="footer">
        <Button onClick={() => onSave(name.trim())} disabled={busy || !name.trim()}>
          Save name
        </Button>
      </div>
    </Sheet>
  );
}

function InviteSheet({
  groupId,
  name,
  invite,
  onClose,
}: {
  groupId: string;
  name: string;
  invite: { code: string; expiresAt: string } | null;
  onClose: () => void;
}) {
  const groups = useGroups();
  const { showToast } = useApp();
  const [qr, setQr] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const url = invite
    ? groupInviteUrl(
        pageOriginForLinks(window.location.origin, import.meta.env.VITE_APP_URL),
        import.meta.env.BASE_URL,
        invite.code,
      )
    : "";

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      showToast("Invite link copied.");
    } catch {
      showToast("Couldn’t copy from this browser.");
    }
  }

  async function shareLink() {
    const text = groupInviteShareText(url);
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: name, text, url });
        return;
      } catch (shareError) {
        if (shareError instanceof DOMException && shareError.name === "AbortError") return;
      }
    }
    await copyLink();
  }

  async function reset() {
    setError(null);
    const failure = await groups.resetInvite(groupId);
    if (failure) setError(failure);
    else showToast("New code ready.");
  }

  return (
    <Sheet title={`Invite to ${name}`} description="Anyone with the link or code can join. They’ll see who read today — never answers. A note stays private unless someone shares it." onClose={onClose}>
      {invite ? (
        <>
          <div className="partner-code-block">
            <p className="eyebrow">Invite code</p>
            <p className="partner-code">{formatGroupCode(invite.code)}</p>
            <p>{inviteExpiryLabel(invite.expiresAt)}</p>
          </div>
          <div className="partner-link">
            <Link2 size={16} aria-hidden="true" />
            <span>{partnerInviteLabel(url)}</span>
            <button type="button" className="partner-copy" onClick={() => void copyLink()}>
              <Copy size={14} aria-hidden="true" />
              Copy
            </button>
          </div>
          {qr ? <QrCode value={url} /> : null}
        </>
      ) : (
        <p className="soft">Making an invite…</p>
      )}
      {error ? (
        <p className="auth-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="footer">
        <Button onClick={() => void shareLink()} disabled={!invite}>
          Share invite link
        </Button>
        <button type="button" className="social-qr" onClick={() => setQr((open) => !open)} disabled={!invite}>
          <QrIcon size={15} aria-hidden="true" />
          {qr ? "Hide QR code" : "Show QR code"}
        </button>
        <Button variant="text" onClick={() => void reset()}>
          Reset code
        </Button>
      </div>
    </Sheet>
  );
}
