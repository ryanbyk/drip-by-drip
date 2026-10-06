import { chapterCount, getBook, verseCount } from "./books";
import type { DripSize, Place, Range } from "./types";
import { VERSE_DRIP } from "./types";

export function isPlaceFinished(place: Place): boolean {
  const total = chapterCount(place.bookId);
  if (total === 0) return false;
  if (place.chapter > total) return true;
  if (place.chapter === total && place.verse > verseCount(place.bookId, place.chapter)) return true;
  return false;
}

export function placeAfter(bookId: string, chapter: number, verse: number): Place {
  const count = verseCount(bookId, chapter);
  if (verse < count) return { bookId, chapter, verse: verse + 1 };
  const chapters = chapterCount(bookId);
  if (chapter < chapters) return { bookId, chapter: chapter + 1, verse: 1 };
  return { bookId, chapter: chapters + 1, verse: 1 };
}

export function makeRange(
  bookId: string,
  startChapter: number,
  startVerse: number,
  endChapter: number,
  endVerse: number,
): Range | null {
  const book = getBook(bookId);
  if (!book) return null;
  const startMax = verseCount(bookId, startChapter);
  const endMax = verseCount(bookId, endChapter);
  if (startMax === 0 || endMax === 0) return null;
  const startVerseClamped = Math.min(Math.max(1, startVerse), startMax);
  const endVerseClamped = Math.min(Math.max(1, endVerse), endMax);
  const start = startChapter * 1000 + startVerseClamped;
  const end = endChapter * 1000 + endVerseClamped;
  if (end < start) return null;
  return {
    bookId,
    startChapter,
    startVerse: startVerseClamped,
    endChapter,
    endVerse: endVerseClamped,
  };
}

export function wholeChapter(bookId: string, chapter: number): Range | null {
  const last = verseCount(bookId, chapter);
  if (last === 0) return null;
  return { bookId, startChapter: chapter, startVerse: 1, endChapter: chapter, endVerse: last };
}

export function dripFromPlace(place: Place, size: DripSize): Range | null {
  if (isPlaceFinished(place)) return null;
  const book = getBook(place.bookId);
  if (!book) return null;
  const startChapter = place.chapter;
  const startVerse = Math.max(1, place.verse);
  if (size === "verses") {
    let chapter = startChapter;
    let verse = startVerse;
    let remaining = VERSE_DRIP;
    let endChapter = chapter;
    let endVerse = verse;
    while (remaining > 0 && chapter <= book.verses.length) {
      const last = book.verses[chapter - 1] ?? 0;
      const available = last - verse + 1;
      if (available >= remaining) {
        endChapter = chapter;
        endVerse = verse + remaining - 1;
        remaining = 0;
        break;
      }
      remaining -= available;
      endChapter = chapter;
      endVerse = last;
      chapter += 1;
      verse = 1;
    }
    return makeRange(place.bookId, startChapter, startVerse, endChapter, endVerse);
  }
  if (size === "chapter") {
    const last = verseCount(place.bookId, startChapter);
    return makeRange(place.bookId, startChapter, startVerse, startChapter, last);
  }
  const endChapter = Math.min(book.verses.length, startChapter + 1);
  const endVerse = verseCount(place.bookId, endChapter);
  return makeRange(place.bookId, startChapter, startVerse, endChapter, endVerse);
}

export function compareVerse(
  chapter: number,
  verse: number,
  otherChapter: number,
  otherVerse: number,
): number {
  if (chapter !== otherChapter) return chapter - otherChapter;
  return verse - otherVerse;
}

export function verseInRange(range: Range, chapter: number, verse: number): boolean {
  const afterStart = compareVerse(chapter, verse, range.startChapter, range.startVerse) >= 0;
  const beforeEnd = compareVerse(chapter, verse, range.endChapter, range.endVerse) <= 0;
  return afterStart && beforeEnd;
}

export function clampStartChapter(bookId: string, chapter: number): number {
  const total = chapterCount(bookId);
  if (total === 0) return 1;
  return Math.min(Math.max(1, Math.floor(chapter) || 1), total);
}
