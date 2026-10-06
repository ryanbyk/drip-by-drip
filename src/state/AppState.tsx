import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { localDate, msUntilAsk } from "../domain/dates";
import { isStandalone, scheduleTrigger, showAskNotification } from "../lib/reminders";
import { shareCommitment } from "../lib/share";
import { createLocalStorageAdapter, type StorageAdapter } from "../lib/storage";
import { liveCloudSnapshotIO } from "../lib/storage/supabase";
import { browserOwnerStore, syncAccountSnapshot, type AccountSyncResult } from "../lib/storage/sync";
import { syncDocumentTheme } from "../lib/theme";
import type { Range, Snapshot, UserPrefs } from "../domain/types";
import { AuthContext } from "./auth-context";
import { reducer, type Action } from "./reducer";

type AppValue = {
  ready: boolean;
  snapshot: Snapshot;
  today: string;
  online: boolean;
  toast: string | null;
  canInstall: boolean;
  standalone: boolean;
  dispatch: (action: Action) => void;
  setPrefs: (prefs: Partial<UserPrefs>) => void;
  showToast: (message: string) => void;
  share: (ref?: string) => Promise<void>;
  promptInstall: () => Promise<void>;
  dismissInstall: () => void;
};

const AppContext = createContext<AppValue | null>(null);
const localStorageAdapter = createLocalStorageAdapter();
const ownerStore = browserOwnerStore();
const SYNC_FAILED = "Couldn’t sync to your account. This device still has your reading.";

export function AppProvider({
  children,
  storage = localStorageAdapter,
  initialSnapshot,
}: {
  children: ReactNode;
  storage?: StorageAdapter;
  initialSnapshot?: Snapshot;
}) {
  const auth = useContext(AuthContext);
  const authStatus = auth?.status ?? "guest";
  const syncUserId = authStatus === "signed-in" ? (auth?.user?.id ?? null) : null;
  const syncEnabled = authStatus === "signed-in" && Boolean(auth?.syncEnabled);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(initialSnapshot ?? null);
  const [today, setToday] = useState(localDate);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [toast, setToast] = useState<string | null>(null);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [standalone, setStandalone] = useState(false);
  const snapshotRef = useRef(snapshot);
  const bootedRef = useRef(Boolean(initialSnapshot));
  const syncFailedRef = useRef(false);
  snapshotRef.current = snapshot;

  const reportSync = useCallback((result: AccountSyncResult) => {
    if (!result.failed) {
      syncFailedRef.current = false;
      return;
    }
    if (syncFailedRef.current) return;
    syncFailedRef.current = true;
    setToast(SYNC_FAILED);
  }, []);

  useEffect(() => {
    if (initialSnapshot) return;
    if (authStatus === "loading") return;
    let cancelled = false;
    const session = { userId: syncUserId, enabled: syncEnabled && online };
    void (async () => {
      const base = bootedRef.current ? (snapshotRef.current ?? (await storage.load())) : await storage.load();
      if (cancelled) return;
      let result = await syncAccountSnapshot(base, session, liveCloudSnapshotIO, ownerStore, (next) => storage.save(next));
      if (cancelled) return;
      const latest = snapshotRef.current;
      if (latest && latest !== base && latest.updatedAt > base.updatedAt) {
        result = await syncAccountSnapshot(latest, session, liveCloudSnapshotIO, ownerStore, (next) => storage.save(next));
      }
      if (cancelled) return;
      bootedRef.current = true;
      if (session.enabled) reportSync(result);
      setSnapshot((current) => {
        if (current && current !== result.snapshot && result.snapshot.updatedAt < current.updatedAt) return current;
        return current === result.snapshot ? current : result.snapshot;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [initialSnapshot, authStatus, syncUserId, syncEnabled, online, storage, reportSync]);

  const appearance = snapshot?.prefs.appearance;
  useEffect(() => {
    if (!appearance) return;
    return syncDocumentTheme(appearance);
  }, [appearance]);

  const dispatch = useCallback((action: Action) => {
    setSnapshot((current) => (current ? reducer(current, action) : current));
  }, []);

  useEffect(() => {
    if (!snapshot) return;
    const handle = window.setTimeout(() => {
      void (async () => {
        const saved = await storage.save(snapshot);
        if (!saved) {
          setToast("Couldn’t save on this device.");
          return;
        }
        if (!syncEnabled || !syncUserId || !online) return;
        const result = await syncAccountSnapshot(
          snapshot,
          { userId: syncUserId, enabled: true },
          liveCloudSnapshotIO,
          ownerStore,
          (next) => storage.save(next),
        );
        reportSync(result);
        if (result.snapshot !== snapshot && result.snapshot.updatedAt >= snapshot.updatedAt) {
          setSnapshot(result.snapshot);
        }
      })();
    }, 40);
    return () => window.clearTimeout(handle);
  }, [snapshot, storage, syncEnabled, syncUserId, online, reportSync]);

  useEffect(() => {
    const tick = () => setToday(localDate());
    const id = window.setInterval(tick, 30_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    setStandalone(isStandalone());
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  useEffect(() => {
    const onPrompt = (event: BeforeInstallPromptEvent) => {
      event.preventDefault();
      setInstallEvent(event);
    };
    const onInstalled = () => {
      setInstallEvent(null);
      setStandalone(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  useEffect(() => {
    if (!snapshot?.prefs.onboardingComplete) return;
    dispatch({ type: "applyQueue", today });
  }, [snapshot?.prefs.onboardingComplete, snapshot?.prefs.queuedBookDate, snapshot?.prefs.queuedBookId, today, dispatch]);

  const askTime = snapshot?.prefs.askTime;
  const remindersOn = Boolean(snapshot?.prefs.onboardingComplete && snapshot?.prefs.notificationsEnabled);
  const lastNotifiedDate = snapshot?.prefs.lastNotifiedDate ?? "";
  const todayAnswer = snapshot?.days[today]?.answer;

  useEffect(() => {
    if (!remindersOn || !askTime) return;
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    let cancelled = false;
    void scheduleTrigger(askTime);
    if (lastNotifiedDate === today || (todayAnswer && todayAnswer !== "unanswered")) {
      return () => {
        cancelled = true;
      };
    }
    const wait = msUntilAsk(askTime);
    const fire = () => {
      if (cancelled || document.visibilityState !== "hidden") return;
      void showAskNotification();
      dispatch({ type: "notified", today });
    };
    let timer: number | undefined;
    if (wait > 0) timer = window.setTimeout(fire, wait);
    else if (wait > -12 * 60 * 60 * 1000) fire();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [remindersOn, askTime, lastNotifiedDate, todayAnswer, today, dispatch]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(id);
  }, [toast]);

  const showToast = useCallback((message: string) => setToast(message), []);

  const share = useCallback(
    async (ref?: string) => {
      const result = await shareCommitment(ref);
      if (result === "copied") showToast("Copied to the clipboard.");
      if (result === "failed") showToast("Couldn’t share from this browser.");
    },
    [showToast],
  );

  const promptInstall = useCallback(async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === "accepted") setInstallEvent(null);
  }, [installEvent]);

  const dismissInstall = useCallback(() => {
    dispatch({ type: "prefs", prefs: { installNudgeDismissed: true } });
    setInstallEvent(null);
  }, [dispatch]);

  const setPrefs = useCallback(
    (prefs: Partial<UserPrefs>) => dispatch({ type: "prefs", prefs }),
    [dispatch],
  );

  const value = useMemo<AppValue | null>(() => {
    if (!snapshot) return null;
    return {
      ready: true,
      snapshot,
      today,
      online,
      toast,
      canInstall: Boolean(installEvent) && !snapshot.prefs.installNudgeDismissed,
      standalone,
      dispatch,
      setPrefs,
      showToast,
      share,
      promptInstall,
      dismissInstall,
    };
  }, [
    snapshot,
    today,
    online,
    toast,
    installEvent,
    standalone,
    dispatch,
    setPrefs,
    showToast,
    share,
    promptInstall,
    dismissInstall,
  ]);

  if (!value) {
    return (
      <div className="splash">
        <p>Drip by drip</p>
      </div>
    );
  }

  return (
    <AppContext.Provider value={value}>
      {children}
      {toast ? (
        <div className="toast" role="status">
          {toast}
        </div>
      ) : null}
    </AppContext.Provider>
  );
}

export function useApp(): AppValue {
  const value = useContext(AppContext);
  if (!value) throw new Error("useApp must be used within AppProvider");
  return value;
}

export type { Range };
