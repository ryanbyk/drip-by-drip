import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  PARTNER_CODE_STORAGE_KEY,
  forgetPartnerCode,
  isNudgeNote,
  normalizeInviteCode,
  rememberPartnerCode,
  type PartnerLoad,
  type PartnerNudgeView,
} from "../domain/partner";
import { livePartnerIO, type PartnerIO } from "../lib/partnerClient";
import { showGraceNotification } from "../lib/reminders";
import { useApp } from "./AppState";
import { useAuth } from "./auth-context";
import {
  PartnerContext,
  type IncomingInvite,
  type PartnerInvite,
  type PartnerPerson,
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
  const [partner, setPartner] = useState<PartnerPerson | null>(null);
  const [invite, setInvite] = useState<PartnerInvite | null>(null);
  const [nudges, setNudges] = useState<PartnerNudgeView[]>([]);
  const [incoming, setIncoming] = useState<IncomingInvite | null>(null);
  const [code, setCode] = useState<string | null>(storedCode);
  const request = useRef(0);
  const announced = useRef<Set<string>>(new Set());
  const announcedFor = useRef<string | null>(null);
  const readDone = snapshot.days[today]?.readDone === true;

  const applyLoad = useCallback((next: PartnerLoad) => {
    setPartner(next.partner);
    setInvite(next.invite);
    setNudges(next.nudges);
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
        setError("Couldn’t load your partner just now.");
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
      setPartner(null);
      setInvite(null);
      setNudges([]);
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
    if (!userId || !code || incoming || partner) return;
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
  }, [userId, code, incoming, partner, io]);

  useEffect(() => {
    if (!userId || !partner) return;
    void io.setReadToday(today, readDone);
  }, [userId, partner, today, readDone, io]);

  useEffect(() => {
    if (!userId || status !== "ready") return;
    if (announcedFor.current !== userId) {
      announcedFor.current = userId;
      announced.current = new Set(nudges.map((nudge) => nudge.id));
      return;
    }
    for (const nudge of nudges) {
      if (nudge.fromSelf || nudge.seen || announced.current.has(nudge.id)) continue;
      announced.current.add(nudge.id);
      void showGraceNotification(nudge.body, `partner-nudge-${nudge.id}`);
    }
  }, [nudges, userId, status]);

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

  const acceptIncoming = useCallback(async () => {
    if (!incoming) return "That invite isn’t open.";
    const failure = await io.accept(incoming.code);
    if (failure) return failure;
    clearStoredCode();
    setCode(null);
    setIncoming(null);
    await load(true);
    return null;
  }, [incoming, io, load]);

  const declineIncoming = useCallback(async () => {
    if (!incoming) return null;
    const failure = await io.decline(incoming.code);
    if (failure) return failure;
    clearStoredCode();
    setCode(null);
    setIncoming(null);
    return null;
  }, [incoming, io]);

  const unlink = useCallback(async () => {
    const failure = await io.unlink();
    if (failure) return failure;
    setPartner(null);
    setNudges([]);
    setInvite(null);
    await load(true);
    return null;
  }, [io, load]);

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

  const seeNudge = useCallback(
    async (id: string) => {
      setNudges((current) => current.map((nudge) => (nudge.id === id ? { ...nudge, seen: true } : nudge)));
      await io.seeNudge(id);
    },
    [io],
  );

  const dismissIncoming = useCallback(() => {
    clearStoredCode();
    setCode(null);
    setIncoming(null);
    setError(null);
  }, []);

  const value = useMemo(
    () => ({
      status: userId ? status : "idle",
      error,
      partner,
      invite,
      incoming,
      nudges,
      pendingInvite: Boolean(code) && !partner,
      refresh,
      createInvite,
      lookupCode,
      acceptIncoming,
      declineIncoming,
      unlink,
      sendNudge,
      seeNudge,
      dismissIncoming,
    }),
    [
      userId,
      status,
      error,
      partner,
      invite,
      incoming,
      nudges,
      code,
      refresh,
      createInvite,
      lookupCode,
      acceptIncoming,
      declineIncoming,
      unlink,
      sendNudge,
      seeNudge,
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
