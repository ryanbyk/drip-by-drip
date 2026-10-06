export const APPEARANCES = ["system", "light", "dark"] as const;

export type Appearance = (typeof APPEARANCES)[number];

export type ColorScheme = "light" | "dark";

export function isAppearance(value: unknown): value is Appearance {
  return value === "system" || value === "light" || value === "dark";
}

/** Stored preference, or System when a snapshot has no usable value. */
export function appearanceFrom(value: unknown): Appearance {
  return isAppearance(value) ? value : "system";
}

export function appearanceLabel(appearance: Appearance): "System" | "Light" | "Dark" {
  switch (appearance) {
    case "system":
      return "System";
    case "light":
      return "Light";
    case "dark":
      return "Dark";
    default: {
      const exhaustive: never = appearance;
      return exhaustive;
    }
  }
}

/** System follows `prefers-color-scheme`. Light and Dark stay put. */
export function resolveTheme(appearance: Appearance, prefersDark: boolean): ColorScheme {
  switch (appearance) {
    case "light":
      return "light";
    case "dark":
      return "dark";
    case "system":
      return prefersDark ? "dark" : "light";
    default: {
      const exhaustive: never = appearance;
      return exhaustive;
    }
  }
}
