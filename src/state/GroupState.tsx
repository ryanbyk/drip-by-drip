import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { followView, type StoredPlan } from "../domain/groupPlan";
import type { SharedNote } from "../domain/sharedNote";
import { forgetGroupCode, normalizeGroupCode, rememberGroupCode } from "../domain/social";
import type { GroupCard, HomeMember, PartnerCandidate } from "../domain/social";
import { liveGroupIO, type GroupIO } from "../lib/groupClient";
import { useApp } from "./AppState";
import { useAuth } from "./auth-context";
import { GroupContext, type GroupStatus } from "./group-context";

function storedCode(): string | null {
  try {
    return rememberGroupCode(sessionStorage, window.location.search);
  } catch {
    return null;
  }
}

function clearStoredCode(): void {
  try {
    forgetGroupCode(sessionStorage);
  } catch {
    // Private mode can reject storage. The in-memory code still clears.
  }
}

export function GroupProvider({ children, io = liveGroupIO }: { children: ReactNode; io?: GroupIO }) {
  const auth = useAuth();
  const { today, snapshot, dispatch } = useApp();
  const userId = auth.status === "signed-in" ? auth.user?.id ?? null : null;
  const [status, setStatus] = useState<GroupStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [groups, setGroups] = useState<GroupCard[]>([]);
  const [members, setMembers] = useState<Record<string, HomeMember[]>>({});
  const [invites, setInvites] = useState<Record<string, { code: string; expiresAt: string }>>({});
  const [people, setPeople] = useState<PartnerCandidate[]>([]);
  const [notes, setNotes] = useState<SharedNote[]>([]);
  const recorded = useRef("");
  const [pendingCode, setPendingCode] = useState<string | null>(storedCode);
  const request = useRef(0);

  const load = useCallback(
    async (silent: boolean) => {
      const token = ++request.current;
      if (!silent) setStatus("loading");
      try {
        const next = await io.load(today);
        if (request.current !== token) return;
        setGroups(next.groups);
        setMembers(next.members);
        setInvites(next.invites);
        setPeople(next.people);
        setNotes(next.notes);
        setStatus("ready");
        setError(null);
      } catch {
        if (request.current !== token || silent) return;
        setStatus("error");
        setError("Couldn’t load your groups just now.");
      }
    },
    [io, today],
  );

  useEffect(() => {
    if (!groupCodeFromUrl()) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("group");
    const next = `${url.pathname}${url.search}${url.hash}`;
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (next !== current) window.history.replaceState({}, "", next);
  }, []);

  useEffect(() => {
    if (!userId) {
      request.current += 1;
      setGroups([]);
      setMembers({});
      setInvites({});
      setPeople([]);
      setNotes([]);
      setStatus("idle");
      setError(null);
      return;
    }
    void load(false);
  }, [userId, today, load]);

  useEffect(() => {
    if (!userId) return;
    const refresh = () => {
      if (document.visibilityState === "hidden") return;
      void load(true);
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    const id = window.setInterval(refresh, 45_000);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
      window.clearInterval(id);
    };
  }, [userId, load]);

  const refresh = useCallback(() => {
    if (userId) void load(true);
  }, [load, userId]);

  const create = useCallback(
    async (name: string, description: string) => {
      const result = await io.create(name, description);
      if ("error" in result) return result;
      await load(true);
      return { id: result.id };
    },
    [io, load],
  );

  const rename = useCallback(
    async (groupId: string, name: string) => {
      const failure = await io.rename(groupId, name);
      if (failure) return failure;
      await load(true);
      return null;
    },
    [io, load],
  );

  const leave = useCallback(
    async (groupId: string) => {
      const failure = await io.leave(groupId);
      if (failure) return failure;
      await load(true);
      return null;
    },
    [io, load],
  );

  const remove = useCallback(
    async (groupId: string, memberId: string) => {
      const failure = await io.remove(groupId, memberId);
      if (failure) return failure;
      await load(true);
      return null;
    },
    [io, load],
  );

  const resetInvite = useCallback(
    async (groupId: string) => {
      const result = await io.resetInvite(groupId);
      if ("error" in result) return result.error;
      setInvites((current) => ({ ...current, [groupId]: result }));
      return null;
    },
    [io],
  );

  const lookup = useCallback((raw: string) => io.lookup(normalizeGroupCode(raw)), [io]);

  const join = useCallback(
    async (raw: string) => {
      const result = await io.join(normalizeGroupCode(raw));
      if ("error" in result) return result;
      clearStoredCode();
      setPendingCode(null);
      await load(true);
      return result;
    },
    [io, load],
  );

  const dismissPending = useCallback(() => {
    clearStoredCode();
    setPendingCode(null);
  }, []);

  const setPlan = useCallback(
    async (groupId: string, plan: StoredPlan) => {
      const result = await io.setPlan(groupId, plan);
      if ("error" in result) return result;
      await load(true);
      return result;
    },
    [io, load],
  );

  const endPlan = useCallback(
    async (groupId: string) => {
      const failure = await io.endPlan(groupId);
      if (failure) return failure;
      if (snapshot.prefs.groupPlan?.groupId === groupId) dispatch({ type: "leaveGroupPlan" });
      await load(true);
      return null;
    },
    [dispatch, io, load, snapshot.prefs.groupPlan?.groupId],
  );

  const followPlan = useCallback(
    async (groupId: string, mode: "group" | "start", day: string) => {
      const failure = await io.followPlan(groupId, mode, day);
      if (failure) return failure;
      await load(true);
      return null;
    },
    [io, load],
  );

  const leavePlan = useCallback(
    async (groupId: string) => {
      const failure = await io.leavePlan(groupId);
      if (failure) return failure;
      if (snapshot.prefs.groupPlan?.groupId === groupId) dispatch({ type: "leaveGroupPlan" });
      await load(true);
      return null;
    },
    [dispatch, io, load, snapshot.prefs.groupPlan?.groupId],
  );

  const shareNote = useCallback(
    async (day: string, body: string, groupIds: string[], partnerIds: string[]) => {
      const failure = await io.shareNote(day, body, groupIds, partnerIds);
      if (failure) return failure;
      await load(true);
      return null;
    },
    [io, load],
  );

  const deleteNote = useCallback(
    async (noteId: string) => {
      const failure = await io.deleteNote(noteId);
      if (failure) return failure;
      await load(true);
      return null;
    },
    [io, load],
  );

  useEffect(() => {
    if (status !== "ready") return;
    const followed = snapshot.prefs.groupPlan;
    if (!followed) return;
    const card = groups.find((group) => group.id === followed.groupId);
    if (!card?.plan || card.plan.id !== followed.planId) {
      dispatch({ type: "leaveGroupPlan" });
      return;
    }
    const plan = card.plan;
    if (
      plan.bookId === followed.bookId &&
      plan.startChapter === followed.startChapter &&
      plan.endChapter === followed.endChapter &&
      plan.pace === followed.pace &&
      plan.readingDays === followed.readingDays &&
      plan.startDate === followed.startDate &&
      card.name === followed.groupName
    ) {
      return;
    }
    dispatch({
      type: "syncGroupPlan",
      plan: {
        ...followed,
        groupName: card.name,
        bookId: plan.bookId,
        startChapter: plan.startChapter,
        endChapter: plan.endChapter,
        pace: plan.pace,
        readingDays: plan.readingDays,
        startDate: plan.startDate,
      },
    });
  }, [dispatch, groups, snapshot.prefs.groupPlan, status]);

  useEffect(() => {
    const plan = snapshot.prefs.groupPlan;
    const read = snapshot.days[today]?.readDone === true;
    if (!userId || !plan || !read) return;
    if (followView(plan, today).status !== "reading") return;
    const key = `${plan.planId}:${today}`;
    if (recorded.current === key) return;
    recorded.current = key;
    void io.recordPlanRead(plan.groupId, today).then((failure) => {
      if (failure) {
        recorded.current = "";
        return;
      }
      void load(true);
    });
  }, [io, load, snapshot.days, snapshot.prefs.groupPlan, today, userId]);

  const value = useMemo(
    () => ({
      status: userId ? status : "idle",
      error,
      groups,
      members,
      invites,
      people,
      notes,
      pendingCode,
      refresh,
      create,
      rename,
      leave,
      remove,
      resetInvite,
      lookup,
      join,
      setPlan,
      endPlan,
      followPlan,
      leavePlan,
      shareNote,
      deleteNote,
      dismissPending,
    }),
    [
      userId,
      status,
      error,
      groups,
      members,
      invites,
      people,
      notes,
      pendingCode,
      refresh,
      create,
      rename,
      leave,
      remove,
      resetInvite,
      lookup,
      join,
      setPlan,
      endPlan,
      followPlan,
      leavePlan,
      shareNote,
      deleteNote,
      dismissPending,
    ],
  );

  return <GroupContext.Provider value={value}>{children}</GroupContext.Provider>;
}

function groupCodeFromUrl(): boolean {
  try {
    return new URLSearchParams(window.location.search).has("group");
  } catch {
    return false;
  }
}
