import { describe, expect, it } from "vitest";
import { applyDeveloperTools, DEVELOPER_TOOLS_KEY, developerFlagFromLocation } from "./developerMode";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (key: string) => (key in data ? data[key] : null),
    setItem: (key: string, value: string) => {
      data[key] = value;
    },
    removeItem: (key: string) => {
      delete data[key];
    },
  };
}

describe("developer tools gate", () => {
  it("reads the dev flag from the query or hash", () => {
    expect(developerFlagFromLocation("?dev=1", "")).toBe("on");
    expect(developerFlagFromLocation("?tab=settings&dev=1", "")).toBe("on");
    expect(developerFlagFromLocation("", "#dev=1")).toBe("on");
    expect(developerFlagFromLocation("", "#dev")).toBe("on");
    expect(developerFlagFromLocation("?dev=0", "#dev=1")).toBe("off");
    expect(developerFlagFromLocation("?dev=1", "#dev=0")).toBe("on");
    expect(developerFlagFromLocation("", "")).toBeNull();
  });

  it("shows for a dev build and a normal production visit", () => {
    const storage = memoryStorage();
    expect(applyDeveloperTools({ search: "", hash: "" }, storage, true)).toBe(true);
    expect(storage.data).toEqual({});
    expect(applyDeveloperTools({ search: "", hash: "" }, storage, false)).toBe(true);
  });

  it("remembers ?dev=1 for later visits, including an installed app on this device", () => {
    const storage = memoryStorage();
    expect(applyDeveloperTools({ search: "?dev=1", hash: "" }, storage, false)).toBe(true);
    expect(storage.data[DEVELOPER_TOOLS_KEY]).toBe("1");
    expect(applyDeveloperTools({ search: "", hash: "" }, storage, false)).toBe(true);
  });

  it("clears the remembered flag and reports hidden for ?dev=0", () => {
    const storage = memoryStorage({ [DEVELOPER_TOOLS_KEY]: "1" });
    expect(applyDeveloperTools({ search: "?dev=0", hash: "" }, storage, true)).toBe(false);
    expect(storage.data[DEVELOPER_TOOLS_KEY]).toBeUndefined();
  });

  it("still honors the URL flag when storage is blocked", () => {
    const storage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    expect(applyDeveloperTools({ search: "?dev=1", hash: "" }, storage, false)).toBe(true);
    expect(applyDeveloperTools({ search: "?dev=0", hash: "" }, storage, true)).toBe(false);
  });
});
