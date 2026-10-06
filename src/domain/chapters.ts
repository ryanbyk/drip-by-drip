import { chapterCount, getBook, verseCount } from "./books";
import { clampStartChapter } from "./drip";
import type { Place } from "./types";

/** Books at or under this length use one chapter grid. Longer books use range tabs. */
export const FULL_GRID_LIMIT = 36;

/** Long-book tabs stay at or under this many chapters, split into even blocks. */
export const RANGE_SIZE = 30;

const PSALM_BOOKS = [
  { start: 1, end: 41, sublabel: "Book One" },
  { start: 42, end: 72, sublabel: "Book Two" },
  { start: 73, end: 89, sublabel: "Book Three" },
  { start: 90, end: 106, sublabel: "Book Four" },
  { start: 107, end: 150, sublabel: "Book Five" },
] as const;

export type ChapterSection = {
  start: number;
  end: number;
  label: string;
  sublabel: string;
};

export type PickerMode = "grid" | "psalms" | "ranges";

export type CountEarlierCopy = {
  label: string;
  detail: string;
};

function rangeLabel(start: number, end: number): string {
  return `${start}–${end}`;
}

function chapterWord(count: number): string {
  return count === 1 ? "1 chapter" : `${count} chapters`;
}

export function evenChapterBlocks(total: number): ChapterSection[] {
  if (total < 1) return [];
  const blocks = Math.ceil(total / RANGE_SIZE);
  const base = Math.floor(total / blocks);
  const extra = total % blocks;
  const sections: ChapterSection[] = [];
  let cursor = 1;
  for (let index = 0; index < blocks; index += 1) {
    const size = base + (index < extra ? 1 : 0);
    const start = cursor;
    const end = cursor + size - 1;
    cursor = end + 1;
    sections.push({
      start,
      end,
      label: rangeLabel(start, end),
      sublabel: chapterWord(end - start + 1),
    });
  }
  return sections;
}

export function pickerMode(bookId: string): PickerMode {
  if (bookId === "psalms") return "psalms";
  if (chapterCount(bookId) <= FULL_GRID_LIMIT) return "grid";
  return "ranges";
}

export function chapterSections(bookId: string): ChapterSection[] {
  if (bookId === "psalms") {
    return PSALM_BOOKS.map((book) => ({
      start: book.start,
      end: book.end,
      label: rangeLabel(book.start, book.end),
      sublabel: book.sublabel,
    }));
  }
  const total = chapterCount(bookId);
  if (total <= FULL_GRID_LIMIT) {
    return total < 1
      ? []
      : [{ start: 1, end: total, label: rangeLabel(1, total), sublabel: chapterWord(total) }];
  }
  return evenChapterBlocks(total);
}

export function defaultCountEarlier(bookId: string): boolean {
  return bookId !== "psalms";
}

export function countEarlierCopy(bookId: string, chapter: number): CountEarlierCopy | null {
  if (chapter <= 1) return null;
  const end = chapter - 1;
  const psalms = bookId === "psalms";
  const label =
    end === 1
      ? psalms
        ? "Count psalm 1 as read"
        : "Count chapter 1 as read"
      : psalms
        ? `Count psalms 1–${end} as read`
        : `Count chapters 1–${end} as read`;
  return {
    label,
    detail: psalms ? "Psalms are often read out of order" : "Keeps your book progress accurate",
  };
}

export function startingSubtitle(bookId: string): string {
  const total = chapterCount(bookId);
  const mode = pickerMode(bookId);
  switch (mode) {
    case "psalms":
      return `${total} psalms in five books.`;
    case "grid":
      return "Pick the chapter you’ll start with.";
    case "ranges":
      return `${total} chapters`;
    default: {
      const exhaustive: never = mode;
      return exhaustive;
    }
  }
}

export function startAtLabel(bookId: string, chapter: number, verse = 1): string {
  const book = getBook(bookId);
  const name = bookId === "psalms" ? book?.refName ?? "Psalm" : book?.name ?? "this book";
  if (verse > 1) return `Start at ${name} ${chapter}:${verse}`;
  return `Start at ${name} ${chapter}`;
}

export function startPlace(bookId: string, chapter: number, verse = 1, countEarlier?: boolean): Place {
  const nextChapter = clampStartChapter(bookId, chapter);
  const maxVerse = verseCount(bookId, nextChapter);
  const nextVerse = maxVerse === 0 ? 1 : Math.min(Math.max(1, Math.floor(verse) || 1), maxVerse);
  const place: Place = { bookId, chapter: nextChapter, verse: nextVerse };
  if (countEarlier !== undefined) {
    place.countedThrough = countEarlier ? Math.max(0, nextChapter - 1) : 0;
  }
  return place;
}
