export type Gender = "female" | "male";
export type Accent = "us" | "uk";

export type Prefs = {
  gender: Gender;
  accent: Accent;
  rate: number;
};

export type SetItem = {
  id: string;
  body: string;
};

export type DictationSet = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  items: SetItem[];
};

export type SessionItem = {
  position: number;
  itemId: string | null;
  prompt: string;
};

export type Attempt = {
  position: number;
  prompt: string;
  answer: string;
  letters: string;
  correct: boolean;
  durationMs: number;
  submittedAt: string;
};

export type Session = {
  id: string;
  setId: string | null;
  title: string;
  createdAt: string;
  updatedAt: string;
  finishedAt: string | null;
  prefs: Prefs;
  items: SessionItem[];
  attempts: Attempt[];
};

export type AttemptRequest = {
  position: number;
  letters: string;
  durationMs: number;
};

export type AttemptResponse =
  | {
      ok: true;
      correct: boolean;
      answer: string;
      prompt: string;
      finished: boolean;
      attempts: Attempt[] | null;
    }
  | {
      ok: false;
      error: string;
    };

export type InProgressCard = {
  id: string;
  title: string;
  done: number;
  itemCount: number;
  updatedAt: string;
};

export type SetCard = {
  id: string;
  title: string;
  itemCount: number;
  updatedAt: string;
  lastCorrect: number | null;
  lastTotal: number | null;
};

export type RecentCard = {
  id: string;
  title: string;
  finishedAt: string;
  correctCount: number;
  itemCount: number;
  totalMs: number;
};

export type HomeData = {
  inProgress: InProgressCard[];
  collections: SetCard[];
  recent: RecentCard[];
};
