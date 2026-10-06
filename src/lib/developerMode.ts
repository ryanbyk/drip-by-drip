export const DEVELOPER_TOOLS_KEY = "drip-developer-tools";

export type DeveloperFlag = "on" | "off" | null;

type FlagStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function developerFlagFromLocation(search: string, hash: string): DeveloperFlag {
  const fromSearch = flagValue(new URLSearchParams(search).get("dev"));
  if (fromSearch) return fromSearch;
  const raw = hash.replace(/^#/, "");
  if (raw === "dev" || raw === "dev=1") return "on";
  if (raw === "dev=0") return "off";
  return flagValue(new URLSearchParams(raw).get("dev"));
}

export function developerToolsVisible(input: {
  devBuild: boolean;
  flag: DeveloperFlag;
  remembered: boolean;
}): boolean {
  switch (input.flag) {
    case "on":
      return true;
    case "off":
      return false;
    case null:
      // A normal visit stays visible, including production. ?dev=0 still reports hidden.
      return true;
    default: {
      const exhaustive: never = input.flag;
      return exhaustive;
    }
  }
}

/** Applies `?dev=1` / `?dev=0` (or the hash form) and remembers the choice for this device. */
export function applyDeveloperTools(
  location: { search: string; hash: string },
  storage: FlagStorage | null,
  devBuild: boolean,
): boolean {
  const flag = developerFlagFromLocation(location.search, location.hash);
  if (storage) {
    try {
      if (flag === "on") storage.setItem(DEVELOPER_TOOLS_KEY, "1");
      if (flag === "off") storage.removeItem(DEVELOPER_TOOLS_KEY);
    } catch {
      // Private mode can block storage. The URL flag still applies for this visit.
    }
  }
  let remembered = false;
  if (storage) {
    try {
      remembered = storage.getItem(DEVELOPER_TOOLS_KEY) === "1";
    } catch {
      remembered = false;
    }
  }
  return developerToolsVisible({ devBuild, flag, remembered });
}

export function readDeveloperTools(devBuild = import.meta.env.DEV): boolean {
  if (typeof window === "undefined") return devBuild;
  return applyDeveloperTools(window.location, safeLocalStorage(), devBuild);
}

function safeLocalStorage(): FlagStorage | null {
  if (typeof localStorage === "undefined") return null;
  try {
    return localStorage;
  } catch {
    return null;
  }
}

function flagValue(value: string | null): DeveloperFlag {
  if (value === "1") return "on";
  if (value === "0") return "off";
  return null;
}
