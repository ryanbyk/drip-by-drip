export type PlanDay = {
  dayIndex: number;
  passageRef: string;
  title: string;
  prompt: string;
};

/** Passage references and short questions only — not sermon manuscripts. */
export const PLACEHOLDER_PLAN: PlanDay[] = [
  {
    dayIndex: 1,
    passageRef: "John 1:1–18",
    title: "The Word",
    prompt: "What does this passage say about who Jesus is?",
  },
  {
    dayIndex: 2,
    passageRef: "John 3:1–21",
    title: "New birth",
    prompt: "Where is God’s love named?",
  },
  {
    dayIndex: 3,
    passageRef: "John 14:1–14",
    title: "The way",
    prompt: "What promise meets you here?",
  },
  {
    dayIndex: 4,
    passageRef: "John 15:1–11",
    title: "Abide",
    prompt: "Where do you notice the invitation to stay close?",
  },
  {
    dayIndex: 5,
    passageRef: "Psalm 1",
    title: "Two ways",
    prompt: "What picture of a rooted life stands out?",
  },
  {
    dayIndex: 6,
    passageRef: "Psalm 23",
    title: "Shepherd",
    prompt: "Which line do you want to carry today?",
  },
  {
    dayIndex: 7,
    passageRef: "Psalm 46",
    title: "Refuge",
    prompt: "What is God called in this psalm?",
  },
  {
    dayIndex: 8,
    passageRef: "Proverbs 3:1–12",
    title: "Trust",
    prompt: "What does this ask of a heart?",
  },
  {
    dayIndex: 9,
    passageRef: "Isaiah 55:1–11",
    title: "Come",
    prompt: "What invitation is repeated?",
  },
  {
    dayIndex: 10,
    passageRef: "Matthew 5:1–12",
    title: "Beatitudes",
    prompt: "Who is called blessed?",
  },
  {
    dayIndex: 11,
    passageRef: "Matthew 11:25–30",
    title: "Rest",
    prompt: "What does Jesus offer the weary?",
  },
  {
    dayIndex: 12,
    passageRef: "Luke 15:1–10",
    title: "Lost and found",
    prompt: "What does the seeking look like?",
  },
  {
    dayIndex: 13,
    passageRef: "Luke 15:11–32",
    title: "A father",
    prompt: "How does the father meet the son?",
  },
  {
    dayIndex: 14,
    passageRef: "Luke 24:13–35",
    title: "Emmaus",
    prompt: "Where does recognition come?",
  },
  {
    dayIndex: 15,
    passageRef: "Acts 2:1–21",
    title: "The Spirit poured out",
    prompt: "What becomes possible here?",
  },
  {
    dayIndex: 16,
    passageRef: "Romans 5:1–11",
    title: "Peace with God",
    prompt: "What has Christ done?",
  },
  {
    dayIndex: 17,
    passageRef: "Romans 8:31–39",
    title: "No separation",
    prompt: "What can separate, according to this passage?",
  },
  {
    dayIndex: 18,
    passageRef: "Ephesians 2:1–10",
    title: "By grace",
    prompt: "What is gift, and what is not earned?",
  },
  {
    dayIndex: 19,
    passageRef: "Philippians 4:4–9",
    title: "Peace of God",
    prompt: "What are you invited to bring to God?",
  },
  {
    dayIndex: 20,
    passageRef: "Colossians 3:1–17",
    title: "New life",
    prompt: "What are you invited to put on?",
  },
  {
    dayIndex: 21,
    passageRef: "Hebrews 4:14–16",
    title: "Mercy",
    prompt: "How is Jesus described here?",
  },
  {
    dayIndex: 22,
    passageRef: "James 1:19–27",
    title: "Hear and do",
    prompt: "What does hearing ask of you next?",
  },
  {
    dayIndex: 23,
    passageRef: "1 Peter 1:3–9",
    title: "Living hope",
    prompt: "Where is hope anchored?",
  },
  {
    dayIndex: 24,
    passageRef: "1 John 1:1–10",
    title: "Light",
    prompt: "What is confessed, and what is promised?",
  },
  {
    dayIndex: 25,
    passageRef: "1 John 4:7–21",
    title: "Love",
    prompt: "Where does love come from?",
  },
  {
    dayIndex: 26,
    passageRef: "Revelation 21:1–7",
    title: "All things new",
    prompt: "What does God say he will do?",
  },
  {
    dayIndex: 27,
    passageRef: "Psalm 103",
    title: "Bless the Lord",
    prompt: "What benefits are named?",
  },
  {
    dayIndex: 28,
    passageRef: "Matthew 28:16–20",
    title: "With you",
    prompt: "What promise closes the passage?",
  },
  {
    dayIndex: 29,
    passageRef: "Mark 1:1–20",
    title: "The beginning",
    prompt: "What do you notice about how Jesus begins?",
  },
  {
    dayIndex: 30,
    passageRef: "Mark 4:1–20",
    title: "The sower",
    prompt: "Which soil do you recognize today?",
  },
];

export function planDay(dayIndex: number): PlanDay | undefined {
  return PLACEHOLDER_PLAN.find((day) => day.dayIndex === dayIndex);
}

export const PLAN_LENGTH = PLACEHOLDER_PLAN.length;
