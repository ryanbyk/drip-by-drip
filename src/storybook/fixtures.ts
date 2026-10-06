import { verseCount } from "../domain/books";
import { addDays, localDate, parseLocalDate, startOfWeek } from "../domain/dates";
import { dripFromPlace } from "../domain/drip";
import type { DailyCommitment, Range, Snapshot, UserPrefs } from "../domain/types";
import { createSnapshot } from "../state/reducer";

function atLocal(iso: string, hour: number, minute: number): string {
  const date = parseLocalDate(iso);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

function day(date: string, partial: Partial<DailyCommitment> = {}): DailyCommitment {
  return {
    date,
    answer: "unanswered",
    readDone: false,
    huh: false,
    detour: false,
    ...partial,
  };
}

function markChapter(chapter: number): Range {
  return {
    bookId: "mark",
    startChapter: chapter,
    startVerse: 1,
    endChapter: chapter,
    endVerse: verseCount("mark", chapter),
  };
}

function read(date: string, chapter: number, extra: Partial<DailyCommitment> = {}): DailyCommitment {
  const range = markChapter(chapter);
  return day(date, {
    answer: "yes",
    readDone: true,
    readDoneAt: atLocal(date, 6, 58),
    answeredAt: atLocal(date, 6, 30),
    range,
    passageRef: `Mark ${chapter}`,
    ...extra,
  });
}

function build(prefs: Partial<UserPrefs>, places: Snapshot["places"], days: Snapshot["days"]): Snapshot {
  const base = createSnapshot();
  return {
    ...base,
    prefs: {
      ...base.prefs,
      onboardingComplete: true,
      askTime: "06:30",
      bookId: "mark",
      dripSize: "chapter",
      readingMode: "book",
      appearance: "system",
      bibleSource: "youversion",
      bibleTranslation: "ESV",
      planStartDate: addDays(localDate(), -15),
      ...prefs,
    },
    places,
    days,
  };
}

const markPlace = { mark: { bookId: "mark", chapter: 4, verse: 1 } };

export function framingSnapshot(): Snapshot {
  const base = createSnapshot();
  return { ...base, prefs: { ...base.prefs, onboardingStep: "framing", askTime: "06:30" } };
}

export function askTimeSnapshot(): Snapshot {
  const base = createSnapshot();
  return { ...base, prefs: { ...base.prefs, onboardingStep: "time", askTime: "06:30" } };
}

export function whatToReadSnapshot(): Snapshot {
  const base = createSnapshot();
  return { ...base, prefs: { ...base.prefs, onboardingStep: "reading", askTime: "06:30", dripSize: "chapter", bookId: "mark" } };
}

export function pickBookSnapshot(): Snapshot {
  const base = createSnapshot();
  return { ...base, prefs: { ...base.prefs, onboardingStep: "book", askTime: "06:30", dripSize: "chapter", bookId: "mark" } };
}

export function askSnapshot(): Snapshot {
  const today = localDate();
  const week = startOfWeek(today);
  const days: Snapshot["days"] = {};
  let cursor = week;
  while (cursor < today) {
    const index = Object.keys(days).length;
    if (index % 2 === 0) days[cursor] = read(cursor, 1 + index);
    cursor = addDays(cursor, 1);
  }
  return build({}, markPlace, days);
}

export function commitSnapshot(): Snapshot {
  const today = localDate();
  const range = dripFromPlace({ bookId: "mark", chapter: 4, verse: 1 }, "chapter");
  return build({}, markPlace, {
    [today]: day(today, {
      answer: "yes",
      answeredAt: atLocal(today, 6, 32),
      ...(range ? { range, passageRef: "Mark 4" } : {}),
    }),
  });
}

export function passagePlanSnapshot(): Snapshot {
  const today = localDate();
  return build(
    { readingMode: "plan", planStartDate: addDays(today, -3) },
    markPlace,
    {
      [today]: day(today, {
        answer: "yes",
        answeredAt: atLocal(today, 6, 32),
        note: "With coffee",
      }),
    },
  );
}

export function bookPassageSnapshot(): Snapshot {
  const today = localDate();
  const range = dripFromPlace({ bookId: "mark", chapter: 4, verse: 1 }, "chapter");
  return build({}, markPlace, {
    [today]: day(today, {
      answer: "yes",
      answeredAt: atLocal(today, 6, 32),
      ...(range ? { range, passageRef: "Mark 4" } : {}),
    }),
  });
}

export function welcomeSnapshot(): Snapshot {
  const today = localDate();
  const last = addDays(today, -3);
  const range = dripFromPlace({ bookId: "mark", chapter: 4, verse: 1 }, "chapter");
  return build({ planStartDate: addDays(today, -10) }, markPlace, {
    [last]: read(last, 3),
    [today]: day(today, {
      answer: "yes",
      answeredAt: atLocal(today, 6, 40),
      ...(range ? { range, passageRef: "Mark 4" } : {}),
    }),
  });
}

export function detourReturnSnapshot(): Snapshot {
  const today = localDate();
  const yesterday = addDays(today, -1);
  const place = { bookId: "mark", chapter: 4, verse: 21 };
  const range = dripFromPlace(place, "chapter");
  return build({ planStartDate: addDays(today, -6) }, { mark: place }, {
    [yesterday]: day(yesterday, {
      answer: "yes",
      readDone: true,
      readDoneAt: atLocal(yesterday, 7, 5),
      detour: true,
      passageRef: "Psalm 23",
    }),
    [today]: day(today, {
      answer: "yes",
      answeredAt: atLocal(today, 6, 32),
      ...(range ? { range, passageRef: "Mark 4:21–41" } : {}),
    }),
  });
}

export function somethingElseSnapshot(): Snapshot {
  const today = localDate();
  return build({}, { mark: { bookId: "mark", chapter: 4, verse: 21 } }, {
    [today]: day(today, {
      answer: "yes",
      answeredAt: atLocal(today, 6, 32),
      detour: true,
      passageRef: "Luke 10:38–42; Psalm 46",
    }),
    [addDays(today, -2)]: day(addDays(today, -2), {
      answer: "yes",
      readDone: true,
      detour: true,
      passageRef: "Psalm 23",
    }),
    [addDays(today, -4)]: day(addDays(today, -4), {
      answer: "yes",
      readDone: true,
      detour: true,
      passageRef: "Luke 10:25–37",
    }),
  });
}

export function doneSnapshot(): Snapshot {
  const today = localDate();
  const days: Snapshot["days"] = {
    [today]: read(today, 4, {
      reflection: "The seed is the same every time — it’s the soil that changes.",
      verseTags: ["4:9", "4:20"],
    }),
  };
  let cursor = addDays(today, -1);
  for (let index = 0; index < 5; index += 1) {
    days[cursor] = read(cursor, 3);
    cursor = addDays(cursor, -1);
  }
  return build({ planStartDate: addDays(today, -12) }, { mark: { bookId: "mark", chapter: 5, verse: 1 } }, days);
}

export function graceSnapshot(): Snapshot {
  const today = localDate();
  return build({}, markPlace, {
    [today]: day(today, { answer: "not_today", answeredAt: atLocal(today, 6, 40) }),
  });
}

export function finishedSnapshot(): Snapshot {
  const today = localDate();
  return build({}, { mark: { bookId: "mark", chapter: 17, verse: 1 } }, {
    [today]: day(today, { answer: "yes", answeredAt: atLocal(today, 6, 32) }),
  });
}

export function recapSnapshot(): Snapshot {
  const today = localDate();
  const days: Snapshot["days"] = {};
  for (let chapter = 1; chapter <= 16; chapter += 1) {
    const date = addDays(today, chapter - 17);
    days[date] = read(date, chapter, chapter === 4 ? { reflection: "Soil and seed.", verseTags: ["4:9"] } : {});
  }
  days[addDays(today, -20)] = read(addDays(today, -20), 4);
  days[addDays(today, -19)] = read(addDays(today, -19), 14);
  days[addDays(today, -18)] = day(addDays(today, -18), { answer: "not_today" });
  days[addDays(today, -2)] = day(addDays(today, -2), {
    answer: "yes",
    readDone: true,
    detour: true,
    passageRef: "Psalm 23",
    huh: true,
  });
  return build({ planStartDate: addDays(today, -24) }, { mark: { bookId: "mark", chapter: 17, verse: 1 } }, days);
}

export function reflectSnapshot(): Snapshot {
  const today = localDate();
  const range = dripFromPlace({ bookId: "mark", chapter: 4, verse: 1 }, "chapter");
  return build({}, markPlace, {
    [today]: day(today, {
      answer: "yes",
      answeredAt: atLocal(today, 6, 32),
      ...(range ? { range, passageRef: "Mark 4" } : {}),
      reflection: "The seed is the same every time — it’s the soil that changes.",
      verseTags: ["4:9", "4:20"],
    }),
  });
}

export function historySnapshot(): Snapshot {
  const today = localDate();
  const days: Snapshot["days"] = {
    [addDays(today, -1)]: read(addDays(today, -1), 3, { passageRef: "Mark 3:20–35" }),
    [addDays(today, -2)]: day(addDays(today, -2), { answer: "not_today" }),
    [addDays(today, -3)]: read(addDays(today, -3), 3, {
      passageRef: "Mark 3:1–19",
      huh: true,
      reflection: "A withered hand, and a question I want to sit with.",
    }),
    [addDays(today, -4)]: day(addDays(today, -4), { answer: "yes", passageRef: "Mark 2" }),
  };
  return build({ planStartDate: addDays(today, -20) }, markPlace, days);
}

export function settingsSnapshot(): Snapshot {
  return build({}, markPlace, {});
}

export function bibleSourceSnapshot(): Snapshot {
  return build(
    {
      bibleSource: "youversion",
      bibleTranslation: "ESV",
      showInAppEsv: true,
      esvApiKey: "storybook-not-a-real-key-3f9a",
    },
    markPlace,
    {},
  );
}

export function esvReaderSnapshot(): Snapshot {
  const base = commitSnapshot();
  const today = localDate();
  const day = base.days[today];
  if (!day) return base;
  return {
    ...base,
    days: {
      ...base.days,
      [today]: { ...day, passageRef: "Mark 4:1–20", verseTags: ["4:9"] },
    },
  };
}
