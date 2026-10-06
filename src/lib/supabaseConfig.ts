/**
 * Public Supabase client config for the esv-passage Edge Function.
 * The anon key is a publishable client credential. The Crossway ESV API key
 * stays in Edge Function secrets and is never read here.
 *
 * Vite env overrides these defaults when set:
 * - VITE_SUPABASE_URL
 * - VITE_SUPABASE_ANON_KEY (legacy anon JWT, role "anon" — not sb_publishable_)
 */
const DEFAULT_SUPABASE_URL = "https://gfacmaaehvlhbskrajyj.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmYWNtYWFlaHZsaGJza3JhanlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzMTk3NTgsImV4cCI6MjEwNjg5NTc1OH0.e8PfSdnda6nYPp0ANee02eub42ijSetn-GJUFZnv6JY";

function configured(value: unknown, fallback: string): string {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed || fallback;
}

export const SUPABASE_URL = configured(import.meta.env.VITE_SUPABASE_URL, DEFAULT_SUPABASE_URL);
export const SUPABASE_ANON_KEY = configured(import.meta.env.VITE_SUPABASE_ANON_KEY, DEFAULT_SUPABASE_ANON_KEY);
