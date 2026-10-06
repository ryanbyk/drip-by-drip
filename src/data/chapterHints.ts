/** Short traditional labels for a few well-known chapters. Not sermon text. */
export const CHAPTER_HINTS: Record<string, Record<number, string>> = {
  mark: {
    1: "the beginning of the gospel",
    4: "the parable of the sower",
    5: "across the sea",
    10: "on the way",
    15: "the crucifixion",
    16: "the resurrection",
  },
  john: {
    1: "the Word became flesh",
    3: "Nicodemus",
    11: "Lazarus",
    15: "the true vine",
    20: "the resurrection",
  },
  luke: {
    2: "the birth",
    15: "lost and found",
    24: "on the road",
  },
  matthew: {
    5: "the beatitudes",
    6: "the Lord’s prayer",
    28: "the great commission",
  },
  psalms: {
    1: "the two ways",
    23: "the shepherd",
    46: "a refuge",
    51: "a prayer for mercy",
    103: "bless the Lord",
    121: "help from the hills",
  },
  genesis: {
    1: "the beginning",
    12: "the call of Abram",
  },
  exodus: {
    3: "the burning bush",
    20: "the ten words",
  },
  isaiah: {
    40: "comfort",
    53: "the servant",
  },
  acts: {
    2: "Pentecost",
  },
  romans: {
    8: "life in the Spirit",
  },
};

export function chapterHint(bookId: string, chapter: number): string | undefined {
  return CHAPTER_HINTS[bookId]?.[chapter];
}
