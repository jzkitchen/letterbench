export type LetterSlot = { kind: "letter"; expected: string };
export type GapSlot = { kind: "gap" };
export type FixedSlot = { kind: "fixed"; char: string };
export type Slot = LetterSlot | GapSlot | FixedSlot;

export type Tile = { id: string; char: string };

export type Puzzle = {
  prompt: string;
  slots: Slot[];
  tiles: Tile[];
};

export function normalizePrompt(value: string): string {
  return value
    .normalize("NFC")
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[—–]/g, "-")
    .trim()
    .replace(/\s+/g, " ");
}

export function lettersOnly(value: string): string {
  return value.toLowerCase().replace(/[^a-z]/g, "");
}

export function grade(prompt: string, letters: string): { correct: boolean; answer: string } {
  const normalized = normalizePrompt(prompt);
  return {
    correct: lettersOnly(normalized) === lettersOnly(letters),
    answer: applyCase(normalized, lettersOnly(letters)),
  };
}

function applyCase(prompt: string, letters: string): string {
  let index = 0;
  let answer = "";
  for (const char of prompt) {
    if (/[a-zA-Z]/.test(char)) {
      const typed = letters[index] ?? "";
      index += 1;
      const upper = char.toUpperCase() === char && char.toLowerCase() !== char;
      answer += upper ? typed.toUpperCase() : typed;
    } else {
      answer += char;
    }
  }
  return answer;
}

export function parseTitle(value: string): { title: string; error: string | null } {
  const title = value.trim().replace(/\s+/g, " ");
  if (!title) return { title: "", error: "Give this set a name." };
  if (title.length > 80) return { title: "", error: "The name must be 80 characters or fewer." };
  return { title, error: null };
}

export function parseLines(lines: string[]): { items: string[]; error: string | null } {
  const items = lines.map((line) => normalizePrompt(line)).filter((line) => line.length > 0);
  if (items.length === 0) return { items: [], error: "Add at least one word or sentence." };
  if (items.length > 200) return { items: [], error: "A set can hold up to 200 lines." };
  for (let index = 0; index < items.length; index += 1) {
    const line = items[index] ?? "";
    if (line.length > 280) {
      return { items: [], error: `Line ${index + 1} must be 280 characters or fewer.` };
    }
    if (!/[a-zA-Z]/.test(line)) {
      return { items: [], error: `Line ${index + 1} needs at least one English letter.` };
    }
  }
  return { items, error: null };
}

function distractorCount(letterCount: number): number {
  if (letterCount <= 3) return 3;
  if (letterCount <= 6) return 4;
  if (letterCount <= 12) return 5;
  return 6;
}

export function shuffle<T>(items: readonly T[], rng: () => number = Math.random): T[] {
  const next = items.slice();
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    const current = next[index] as T;
    next[index] = next[swapIndex] as T;
    next[swapIndex] = current;
  }
  return next;
}

export function buildPuzzle(prompt: string, rng: () => number = Math.random): Puzzle {
  const normalized = normalizePrompt(prompt);
  const slots: Slot[] = [];
  const letters: string[] = [];
  for (const char of normalized) {
    if (/[a-zA-Z]/.test(char)) {
      const lower = char.toLowerCase();
      letters.push(lower);
      slots.push({ kind: "letter", expected: lower });
    } else if (char === " ") {
      slots.push({ kind: "gap" });
    } else {
      slots.push({ kind: "fixed", char });
    }
  }
  const used = new Set(letters);
  const alphabet = "abcdefghijklmnopqrstuvwxyz".split("").filter((letter) => !used.has(letter));
  const extras = shuffle(alphabet, rng).slice(0, Math.min(alphabet.length, distractorCount(letters.length)));
  const tiles = [...letters, ...extras]
    .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0))
    .map((char, index) => ({ id: `t${index}`, char }));
  return { prompt: normalized, slots, tiles };
}

export function letterCount(slots: Slot[]): number {
  return slots.reduce((count, slot) => count + (slot.kind === "letter" ? 1 : 0), 0);
}
