import { getBook, totalVerses } from "./books";
import { dayOfMonth, dayOfYear } from "./dates";
import type { DailyCommitment, DripSize } from "./types";
import { VERSE_DRIP } from "./types";

export const GOOD_FIRST: { id: string; blurb: string }[] = [
  { id: "mark", blurb: "16 chapters · about 2–3 weeks" },
  { id: "john", blurb: "21 chapters · about 3 weeks" },
  { id: "psalms", blurb: "150 · one a day, any order" },
  { id: "proverbs", blurb: "31 · one for each day of the month" },
  { id: "james", blurb: "5 chapters · one short week" },
];

const NEXT_BLURBS: Record<string, string> = {
  john: "Same Jesus, told slower and deeper",
  acts: "What happened next",
  psalms: "A season of short drips",
  mark: "A vivid, short gospel",
  luke: "The careful, roomy telling",
  matthew: "Jesus the promised king",
  romans: "Grace, spelled out",
  james: "A short, practical letter",
};

export function paceBlurb(bookId: string, size: DripSize): string {
  if (size === "chapter") {
    const known = GOOD_FIRST.find((item) => item.id === bookId);
    if (known) return known.blurb;
  }
  const book = getBook(bookId);
  if (!book) return "";
  const chapters = book.verses.length;
  const days =
    size === "two"
      ? Math.ceil(chapters / 2)
      : size === "verses"
        ? Math.max(1, Math.ceil(totalVerses(bookId) / VERSE_DRIP))
        : chapters;
  if (days <= 8) return `${chapters} ${chapters === 1 ? "chapter" : "chapters"} · about a week`;
  const weeks = Math.max(1, Math.round(days / 7));
  const span = weeks === 1 ? "about a week" : `about ${weeks} weeks`;
  return `${chapters} ${chapters === 1 ? "chapter" : "chapters"} · ${span}`;
}

export function weeksHint(bookId: string, size: DripSize): string {
  const book = getBook(bookId);
  if (!book) return "";
  const chapters = book.verses.length;
  const days = size === "two" ? Math.ceil(chapters / 2) : size === "verses" ? Math.ceil(totalVerses(bookId) / 12) : chapters;
  if (days <= 10) return "about a week";
  const min = Math.max(1, Math.floor(days / 7));
  const max = Math.max(min, Math.ceil(days / 6));
  if (min === max) return `about ${min} weeks`;
  return `~${min}–${max} weeks`;
}

export function suggestedNext(bookId: string): { id: string; blurb: string }[] {
  const preferred = ["john", "acts", "psalms", "mark", "luke", "james"];
  return preferred
    .filter((id) => id !== bookId)
    .slice(0, 3)
    .map((id) => ({ id, blurb: NEXT_BLURBS[id] ?? "One drip at a time" }));
}

const SHORT_PSALMS = [1, 8, 19, 23, 27, 34, 42, 46, 51, 63, 84, 90, 91, 103, 121, 139, 145];

export function detourIdeas(
  today: string,
  days: Record<string, DailyCommitment>,
): { ref: string; group: "short" | "recent" }[] {
  const psalm = SHORT_PSALMS[dayOfYear(today) % SHORT_PSALMS.length] ?? 23;
  const proverb = Math.min(31, dayOfMonth(today));
  const ideas: { ref: string; group: "short" | "recent" }[] = [
    { ref: `Psalm ${psalm}`, group: "short" },
    { ref: `Proverbs ${proverb}`, group: "short" },
  ];
  const recent = Object.values(days)
    .filter((day) => day.detour && day.passageRef && day.date < today)
    .sort((a, b) => b.date.localeCompare(a.date));
  const seen = new Set(ideas.map((item) => item.ref));
  for (const day of recent) {
    const ref = day.passageRef;
    if (!ref || seen.has(ref)) continue;
    seen.add(ref);
    ideas.push({ ref, group: "recent" });
    if (ideas.filter((item) => item.group === "recent").length >= 3) break;
  }
  return ideas;
}
