import { useEffect, useState } from "react";

export function useVoices(): { voices: SpeechSynthesisVoice[]; ready: boolean } {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      setReady(true);
      return;
    }
    const synth = window.speechSynthesis;
    const load = () => {
      const next = synth.getVoices();
      if (next.length > 0) {
        setVoices(next);
        setReady(true);
      }
    };
    load();
    synth.addEventListener("voiceschanged", load);
    const timer = window.setTimeout(() => setReady(true), 500);
    return () => {
      synth.removeEventListener("voiceschanged", load);
      window.clearTimeout(timer);
    };
  }, []);

  return { voices, ready };
}
