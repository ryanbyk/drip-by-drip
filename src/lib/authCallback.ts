import { authCallbackFromLocation } from "./auth";

/** Captured before the Supabase client reads and clears the return URL. */
export const authCallback = authCallbackFromLocation(
  typeof window === "undefined" ? "" : window.location.search,
  typeof window === "undefined" ? "" : window.location.hash,
);
