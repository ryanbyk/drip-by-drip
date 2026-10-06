import { BOOKS, getBook, verseCount } from "./books";
import { wholeChapter } from "./drip";
import type { Range } from "./types";

const matchers = BOOKS.flatMap((book) => book.aliases.map((alias) => ({ alias, book }))).sort(
  (a, b) => b.alias.length - a.alias.length || a.alias.localeCompare(b.alias),
);

export function formatRef(range: Range): string {
  const book = getBook(range.bookId);
  if (!book) return "Passage";
  const name = book.refName;
  const sameChapter = range.startChapter === range.endChapter;
  if (sameChapter) {
    const full =
      range.startVerse === 1 && range.endVerse === verseCount(range.bookId, range.startChapter);
    if (full) return `${name} ${range.startChapter}`;
    if (range.startVerse === range.endVerse) {
      return `${name} ${range.startChapter}:${range.startVerse}`;
    }
    return `${name} ${range.startChapter}:${range.startVerse}–${range.endVerse}`;
  }
  const startFull = range.startVerse === 1;
  const endFull = range.endVerse === verseCount(range.bookId, range.endChapter);
  if (startFull && endFull) return `${name} ${range.startChapter}–${range.endChapter}`;
  return `${name} ${range.startChapter}:${range.startVerse}–${range.endChapter}:${range.endVerse}`;
}

export function formatVerseSpan(range: Range): string {
  if (range.startChapter === range.endChapter) {
    if (range.startVerse === range.endVerse) return `verse ${range.startVerse}`;
    return `verses ${range.startVerse}–${range.endVerse}`;
  }
  return `verses ${range.startChapter}:${range.startVerse}–${range.endChapter}:${range.endVerse}`;
}

export function chapterProgressLabel(range: Range): string {
  const book = getBook(range.bookId);
  if (!book) return "";
  if (range.startChapter === range.endChapter) {
    return `Chapter ${range.startChapter} of ${book.verses.length} in ${book.name}`;
  }
  return `Chapters ${range.startChapter}–${range.endChapter} of ${book.verses.length} in ${book.name}`;
}

function normalizeRef(input: string): string {
  return input.trim().toLowerCase().replace(/[–—]/g, "-").replace(/\s+/g, " ");
}

export function parsePassage(input: string): Range | null {
  const norm = normalizeRef(input);
  if (!norm || norm.includes(";") || norm.includes(" and ")) return null;
  const found = matchers.find((matcher) => norm === matcher.alias || norm.startsWith(`${matcher.alias} `));
  if (!found) return null;
  const rest = norm.slice(found.alias.length).trim();
  const book = found.book;
  if (!rest) {
    if (book.verses.length === 1) return wholeChapter(book.id, 1);
    return null;
  }
  const match = rest.match(/^(\d+)(?::(\d+))?(?:\s*-\s*(?:(\d+):)?(\d+))?$/);
  if (!match) return null;
  const startChapter = Number(match[1]);
  const startVerse = match[2] ? Number(match[2]) : 1;
  let endChapter = startChapter;
  let endVerse: number;
  if (match[4]) {
    if (match[3]) {
      endChapter = Number(match[3]);
      endVerse = Number(match[4]);
    } else if (match[2]) {
      endVerse = Number(match[4]);
    } else {
      endChapter = Number(match[4]);
      endVerse = verseCount(book.id, endChapter);
    }
  } else if (match[2]) {
    endVerse = startVerse;
  } else {
    endVerse = verseCount(book.id, startChapter);
  }
  if (verseCount(book.id, startChapter) === 0 || verseCount(book.id, endChapter) === 0) return null;
  const start = startChapter * 1000 + startVerse;
  const end = endChapter * 1000 + endVerse;
  if (end < start) return null;
  return {
    bookId: book.id,
    startChapter,
    startVerse,
    endChapter,
    endVerse,
  };
}

export function openLabel(range: Range): string {
  return formatRef(range);
}
