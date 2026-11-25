import type { Accent, Gender, Prefs } from "./types";

const FEMALE_NAMES = [
  "samantha",
  "karen",
  "victoria",
  "allison",
  "ava",
  "susan",
  "zira",
  "aria",
  "jenny",
  "michelle",
  "kate",
  "serena",
  "martha",
  "fiona",
  "hazel",
  "moira",
  "tessa",
  "veena",
  "nicky",
  "lisa",
  "zoe",
  "sara",
  "libby",
  "sonia",
  "emma",
  "amy",
  "joanna",
  "salli",
  "kimberly",
  "kendra",
  "ivy",
  "ruth",
  "nicole",
  "linda",
  "heather",
  "alice",
  "clara",
  "emily",
  "lily",
  "nora",
  "eva",
  "mia",
  "sophie",
  "olivia",
  "allison",
];

const MALE_NAMES = [
  "alex",
  "daniel",
  "oliver",
  "arthur",
  "george",
  "ryan",
  "fred",
  "tom",
  "david",
  "mark",
  "aaron",
  "guy",
  "rishi",
  "brian",
  "matthew",
  "justin",
  "joey",
  "stephen",
  "russell",
  "geraint",
  "james",
  "thomas",
  "william",
  "nathan",
  "christopher",
  "eric",
  "bruce",
  "ralph",
  "albert",
];

const PREFERRED_MALE = [
  "aaron",
  "tom",
  "evan",
  "reed",
  "nathan",
  "noah",
  "guy",
  "mark",
  "ryan",
  "justin",
  "joey",
  "andrew",
  "christopher",
  "eric",
  "brian",
  "william",
  "oliver",
  "james",
];

const OLD_MALE = ["alex", "david", "fred", "ralph", "albert"];

export type VoiceChoice = {
  voice: SpeechSynthesisVoice | null;
  pitched: boolean;
  accentFallback: boolean;
  pitch: number;
  skippedOld: boolean;
};

function hasWord(haystack: string, word: string): boolean {
  return new RegExp(`\\b${word}\\b`, "i").test(haystack);
}

function voiceLabel(voice: SpeechSynthesisVoice): string {
  return `${voice.name} ${voice.voiceURI ?? ""}`.toLowerCase();
}

function matchesAny(voice: SpeechSynthesisVoice, names: string[]): boolean {
  const label = voiceLabel(voice);
  return names.some((name) => hasWord(label, name));
}

export function inferGender(label: string): Gender | null {
  const lower = label.toLowerCase();
  if (lower.includes("female")) return "female";
  if (/\bmale\b/.test(lower)) return "male";
  if (FEMALE_NAMES.some((name) => hasWord(lower, name))) return "female";
  if (MALE_NAMES.some((name) => hasWord(lower, name))) return "male";
  if (/google us english/.test(lower)) return "female";
  return null;
}

function normalizeLang(lang: string): string {
  return lang.toLowerCase().replaceAll("_", "-");
}

function accentLang(accent: Accent): string {
  return accent === "uk" ? "en-gb" : "en-us";
}

function langMatchesAccent(lang: string, accent: Accent): boolean {
  const normalized = normalizeLang(lang);
  if (accent === "uk") return normalized.startsWith("en-gb") || normalized.includes("-gb");
  return normalized.startsWith("en-us") || normalized.includes("-us");
}

function scoreVoice(voice: SpeechSynthesisVoice, gender: Gender, accent: Accent): number {
  const lang = normalizeLang(voice.lang);
  let score = 0;
  if (langMatchesAccent(lang, accent) || lang.startsWith(accentLang(accent))) score += 60;
  else if (lang.startsWith("en")) score += 12;
  else score -= 50;
  const heard = inferGender(`${voice.name} ${voice.voiceURI ?? ""}`);
  if (heard === gender) score += 40;
  else if (heard && heard !== gender) score -= 35;
  if (gender === "male" && matchesAny(voice, PREFERRED_MALE)) score += 24;
  if (gender === "male" && matchesAny(voice, OLD_MALE)) score -= 80;
  if (voice.default) score += 1;
  return score;
}

function pitchFor(voice: SpeechSynthesisVoice | null, gender: Gender, pitched: boolean): number {
  if (pitched) return gender === "male" ? 0.9 : 1.12;
  if (voice && gender === "male" && matchesAny(voice, OLD_MALE)) return 1.16;
  return 1;
}

export function chooseVoice(voices: SpeechSynthesisVoice[], prefs: Prefs): VoiceChoice {
  let best: SpeechSynthesisVoice | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const voice of voices) {
    const score = scoreVoice(voice, prefs.gender, prefs.accent);
    if (score > bestScore) {
      bestScore = score;
      best = voice;
    }
  }
  if (!best || bestScore < 10) {
    return {
      voice: null,
      pitched: true,
      accentFallback: true,
      pitch: pitchFor(null, prefs.gender, true),
      skippedOld: false,
    };
  }
  const pitched = inferGender(`${best.name} ${best.voiceURI ?? ""}`) !== prefs.gender;
  const skippedOld =
    prefs.gender === "male" &&
    pitched &&
    voices.some((voice) => matchesAny(voice, OLD_MALE) && langMatchesAccent(voice.lang, prefs.accent));
  return {
    voice: best,
    pitched,
    accentFallback: !langMatchesAccent(best.lang, prefs.accent),
    pitch: pitchFor(best, prefs.gender, pitched),
    skippedOld,
  };
}

export function voiceNote(choice: VoiceChoice, hasVoices: boolean): string | null {
  if (!hasVoices) return "This browser has no speech voice. Try Chrome or Safari.";
  if (choice.accentFallback) {
    return "No voice for that accent is installed here, so the closest English voice is used.";
  }
  if (choice.pitched && !choice.skippedOld) {
    return "No separate male and female voice for that accent, so the pitch is adjusted.";
  }
  return null;
}

let speakToken = 0;

export function cancelSpeech(): void {
  speakToken += 1;
  if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
}

export function speak(text: string, prefs: Prefs, voices: SpeechSynthesisVoice[] = []): void {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const synth = window.speechSynthesis;
  const token = ++speakToken;
  synth.cancel();
  const choice = chooseVoice(voices, prefs);
  window.setTimeout(() => {
    if (token !== speakToken) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = prefs.accent === "uk" ? "en-GB" : "en-US";
    utterance.rate = prefs.rate;
    utterance.pitch = choice.pitch;
    utterance.volume = 1;
    if (choice.voice) {
      const live = voices.find(
        (voice) => voice.name === choice.voice?.name && voice.voiceURI === choice.voice?.voiceURI,
      );
      if (live) utterance.voice = live;
    }
    synth.speak(utterance);
  }, 60);
}
