import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  PARTNER_CODE_STORAGE_KEY,
  forgetPartnerCode,
  isNudgeNote,
  normalizeInviteCode,
  rememberPartnerCode,
} from "../domain/partner";
import type { PersonSignal, VisibleDrop } from "../domain/social";
import { livePartnerIO, type PartnerBundle, type PartnerIO } from "../lib/partnerClient";
import { showGraceNotification } from "../lib/reminders";
import { useApp } from "./AppState";
import { useAuth } from "./auth-context";
import {
  PartnerContext,
  type IncomingInvite,
  type PartnerInvite,
  type PartnerStatus,
} from "./partner-context";

function storedCode(): string | null {
  try {
    return rememberPartnerCode(sessionStorage, window.location.search);
  } catch {
    return null;
  }
}

function clearStoredCode(): void {
  try {
    forgetPartnerCode(sessionStorage);
  } catch {
    // Private mode can reject storage. The in-memory invite still clears.
  }
}

export function PartnerProvider({ children, io = livePartnerIO }: { children: ReactNode; io?: PartnerIO }) {
  const auth = useAuth();
  const { snapshot, today } = useApp();
  const userId = auth.status === "signed-in" ? auth.user?.id ?? null : null;
  const [status, setStatus] = useState<PartnerStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [partners, setPartners] = useState<PersonSignal[]>([]);
  const [invite, setInvite] = useState<PartnerInvite | null>(null);
  const [drops, setDrops] = useState<VisibleDrop[]>([]);
  const [requests, setRequests] = useState<IncomingInvite[]>([]);
  const [incoming, setIncoming] = useState<IncomingInvite | null>(null);
  const [code, setCode] = useState<string | null>(storedCode);
  const request = useRef(0);
  const announced = useRef<Set<string>>(new Set());
  const announcedFor = useRef<string | null>(null);
  const readDone = snapshot.days[today]?.readDone === true;

  const applyLoad = useCallback((next: PartnerBundle) => {
    setPartners(next.partners);
    setInvite(next.invite);
    setDrops(next.drops);
    setRequests(next.requests);
    setStatus("ready");
    setError(null);
  }, []);

  const load = useCallback(
    async (silent: boolean) => {
      const token = ++request.current;
      if (!silent) setStatus("loading");
      try {
        const next = await io.load(today);
        if (request.current !== token) return;
        applyLoad(next);
      } catch {
        if (request.current !== token || silent) return;
        setStatus("error");
        setError("Couldn’t load your partners just now.");
      }
    },
    [applyLoad, io, today],
  );

  useEffect(() => {
    if (!partnerCodeFromUrl()) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("partner");
    const next = `${url.pathname}${url.search}${url.hash}`;
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (next !== current) window.history.replaceState({}, "", next);
  }, []);

  useEffect(() => {
    if (!userId) {
      request.current += 1;
      setPartners([]);
      setInvite(null);
      setDrops([]);
      setRequests([]);
      setIncoming(null);
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

  useEffect(() => {
    if (!userId || !code || incoming) return;
    let cancelled = false;
    void io.lookup(code).then((result) => {
      if (cancelled) return;
      if ("error" in result) {
        setError(result.error);
        return;
      }
      if (result.own) return;
      setIncoming({ code, inviterName: result.inviterName });
      setError(null);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, code, incoming, io]);

  useEffect(() => {
    if (!userId) return;
    void io.setReadToday(today, readDone);
  }, [userId, today, readDone, io]);

  useEffect(() => {
    if (!userId || status !== "ready") return;
    if (announcedFor.current !== userId) {
      announcedFor.current = userId;
      announced.current = new Set(drops.map((drop) => drop.id));
      return;
    }
    for (const drop of drops) {
      if (drop.fromSelf || drop.seen || announced.current.has(drop.id)) continue;
      announced.current.add(drop.id);
      const name = partners.find((person) => person.id === drop.senderId)?.displayName ?? "Someone";
      void showGraceNotification(drop.body ?? `${name} sent a drop.`, `drop-${drop.id}`);
    }
  }, [drops, partners, userId, status]);

  const refresh = useCallback(() => {
    if (userId) void load(true);
  }, [load, userId]);

  const createInvite = useCallback(async () => {
    const result = await io.createInvite();
    if ("error" in result) return result.error;
    setInvite(result);
    setStatus("ready");
    return null;
  }, [io]);

  const lookupCode = useCallback(
    async (raw: string) => {
      const next = normalizeInviteCode(raw);
      if (next.length !== 8) return "Enter the 8-character code.";
      const result = await io.lookup(next);
      if ("error" in result) return result.error;
      if (result.own) return "That’s your invite. Share it with one person.";
      try {
        sessionStorage.setItem(PARTNER_CODE_STORAGE_KEY, next);
      } catch {
        // The in-memory invite still opens.
      }
      setCode(next);
      setIncoming({ code: next, inviterName: result.inviterName });
      setError(null);
      return null;
    },
    [io],
  );

  const acceptCode = useCallback(
    async (target: IncomingInvite | null) => {
      if (!target) return "That invite isn’t open.";
      const failure = await io.accept(target.code);
      if (failure) return failure;
      if (incoming?.code === target.code) {
        clearStoredCode();
        setCode(null);
        setIncoming(null);
      }
      setRequests((current) => current.filter((row) => row.code !== target.code));
      await load(true);
      return null;
    },
    [incoming, io, load],
  );

  const declineCode = useCallback(
    async (target: IncomingInvite | null) => {
      if (!target) return null;
      const failure = await io.decline(target.code);
      if (failure) return failure;
      if (incoming?.code === target.code) {
        clearStoredCode();
        setCode(null);
        setIncoming(null);
      }
      setRequests((current) => current.filter((row) => row.code !== target.code));
      return null;
    },
    [incoming, io],
  );

  const acceptIncoming = useCallback(() => acceptCode(incoming), [acceptCode, incoming]);
  const declineIncoming = useCallback(() => declineCode(incoming), [declineCode, incoming]);
  const acceptRequest = useCallback(
    (inviteCode: string) => acceptCode(requests.find((row) => row.code === inviteCode) ?? null),
    [acceptCode, requests],
  );
  const declineRequest = useCallback(
    (inviteCode: string) => declineCode(requests.find((row) => row.code === inviteCode) ?? null),
    [declineCode, requests],
  );

  const unlink = useCallback(
    async (partnerId?: string) => {
      const failure = await io.unlink(partnerId);
      if (failure) return failure;
      await load(true);
      return null;
    },
    [io, load],
  );

  const invitePerson = useCallback(
    async (personId: string) => {
      const failure = await io.invitePerson(personId);
      if (failure) return failure;
      await load(true);
      return null;
    },
    [io, load],
  );

  const sendNudge = useCallback(
    async (body: string) => {
      if (!isNudgeNote(body)) return "Choose one of the gentle notes.";
      const failure = await io.sendNudge(body, today);
      if (failure) return failure;
      await load(true);
      return null;
    },
    [io, load, today],
  );

  const sendDrop = useCallback(
    async (recipientId: string, body: string | null) => {
      if (body && !isNudgeNote(body)) return "Choose one of the gentle notes.";
      const failure = await io.sendDrop(recipientId, body, today);
      if (failure) return failure;
      await load(true);
      return null;
    },
    [io, load, today],
  );

  const seeDrop = useCallback(
    async (id: string) => {
      setDrops((current) => current.map((drop) => (drop.id === id ? { ...drop, seen: true } : drop)));
      await io.seeDrop(id);
    },
    [io],
  );

  const seeNudge = seeDrop;

  const dismissIncoming = useCallback(() => {
    clearStoredCode();
    setCode(null);
    setIncoming(null);
    setError(null);
  }, []);

  const partner = partners[0] ?? null;

  const value = useMemo(
    () => ({
      status: userId ? status : "idle",
      error,
      partner,
      partners,
      invite,
      incoming,
      requests,
      drops,
      pendingInvite: Boolean(code),
      refresh,
      createInvite,
      lookupCode,
      acceptIncoming,
      declineIncoming,
      acceptRequest,
      declineRequest,
      unlink,
      invitePerson,
      sendNudge,
      sendDrop,
      seeNudge,
      seeDrop,
      dismissIncoming,
    }),
    [
      userId,
      status,
      error,
      partner,
      partners,
      invite,
      incoming,
      requests,
      drops,
      code,
      refresh,
      createInvite,
      lookupCode,
      acceptIncoming,
      declineIncoming,
      acceptRequest,
      declineRequest,
      unlink,
      invitePerson,
      sendNudge,
      sendDrop,
      seeNudge,
      seeDrop,
      dismissIncoming,
    ],
  );

  return <PartnerContext.Provider value={value}>{children}</PartnerContext.Provider>;
}

function partnerCodeFromUrl(): boolean {
  try {
    return new URLSearchParams(window.location.search).has("partner");
  } catch {
    return false;
  }
}
