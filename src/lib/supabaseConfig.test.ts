import { describe, expect, it } from "vitest";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./supabaseConfig";

describe("Supabase public config", () => {
  it("points at the esv-passage project with a legacy anon key when env is unset", () => {
    const urlOverride = import.meta.env.VITE_SUPABASE_URL?.trim();
    const keyOverride = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
    expect(SUPABASE_URL.startsWith("https://")).toBe(true);
    expect(SUPABASE_ANON_KEY.startsWith("sb_publishable_")).toBe(false);

    if (!urlOverride) {
      expect(SUPABASE_URL).toBe("https://gfacmaaehvlhbskrajyj.supabase.co");
    }
    if (!keyOverride) {
      const payload = JSON.parse(atob(SUPABASE_ANON_KEY.split(".")[1] ?? "")) as { role?: string; ref?: string };
      expect(payload.role).toBe("anon");
      expect(payload.ref).toBe("gfacmaaehvlhbskrajyj");
    }
  });
});