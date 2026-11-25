import { describe, expect, it } from "vitest";
import { chooseVoice, voiceNote } from "./speech";
import type { Prefs } from "./types";

function voice(name: string, lang: string, isDefault = false): SpeechSynthesisVoice {
  return {
    name,
    lang,
    voiceURI: name,
    default: isDefault,
    localService: true,
  } as SpeechSynthesisVoice;
}

const femaleUs: Prefs = { gender: "female", accent: "us", rate: 0.85 };
const maleUs: Prefs = { gender: "male", accent: "us", rate: 0.85 };

describe("voice choice", () => {
  it("prefers a matching accent and gender", () => {
    const choice = chooseVoice([voice("Daniel", "en-GB"), voice("Samantha", "en-US")], femaleUs);
    expect(choice.voice?.name).toBe("Samantha");
    expect(choice.pitched).toBe(false);
    expect(choice.accentFallback).toBe(false);
    expect(voiceNote(choice, true)).toBeNull();
  });

  it("pitches when only the other gender is available", () => {
    const choice = chooseVoice([voice("Samantha", "en-US")], maleUs);
    expect(choice.voice?.name).toBe("Samantha");
    expect(choice.pitched).toBe(true);
    expect(choice.pitch).toBe(0.9);
    expect(voiceNote(choice, true)).toMatch(/pitch is adjusted/);
  });

  it("prefers a named male voice over an older default", () => {
    const choice = chooseVoice([voice("Alex", "en-US"), voice("Aaron", "en-US")], maleUs);
    expect(choice.voice?.name).toBe("Aaron");
    expect(choice.pitched).toBe(false);
  });

  it("raises the pitch of an older male voice that is still the best match", () => {
    const choice = chooseVoice([voice("Alex", "en-US")], maleUs);
    expect(choice.voice?.name).toBe("Alex");
    expect(choice.pitch).toBe(1.16);
    expect(choice.pitched).toBe(false);
  });

  it("says when the browser has no voices", () => {
    const choice = chooseVoice([], femaleUs);
    expect(choice.voice).toBeNull();
    expect(voiceNote(choice, false)).toMatch(/no speech voice/);
  });
});
