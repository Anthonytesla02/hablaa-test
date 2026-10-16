/**
 * Tutor voice-out, fully in the browser via SpeechSynthesis.
 * Free, unlimited, and works offline — no AI credits involved.
 */

export type SpeechMood =
  | "warm"
  | "encouraging"
  | "playful"
  | "corrective"
  | "celebratory"
  | "empathetic"
  | "dramatic"
  | "savage";

type SpeakingState = { speaking: boolean; text: string; locale: string };
let speakingState: SpeakingState = { speaking: false, text: "", locale: "" };
const listeners = new Set<() => void>();

let activeUtterance: SpeechSynthesisUtterance | null = null;
let generation = 0;

export function subscribeSpeaking(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getSpeakingState() {
  return speakingState;
}

function setSpeaking(next: SpeakingState) {
  speakingState = next;
  listeners.forEach((listener) => listener());
}

export function ttsSupported() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

function inferMood(text: string): SpeechMood {
  if (/!{1,}|perfect|excellent|amazing|bravo|bien hecho|increíble/i.test(text)) return "celebratory";
  if (/sorry|it's okay|take your time|no pasa nada|tranquil/i.test(text)) return "empathetic";
  if (/try again|remember|careful|almost|otra vez|recuerda/i.test(text)) return "corrective";
  if (/\?|imagine|what if|qué tal/i.test(text)) return "playful";
  return "warm";
}

/** Mood shapes pitch and pace so the same voice reads warmer or more dramatic. */
const MOOD_VOICE: Record<SpeechMood, { pitch: number; rate: number }> = {
  warm: { pitch: 1.0, rate: 1.0 },
  encouraging: { pitch: 1.1, rate: 1.02 },
  playful: { pitch: 1.15, rate: 1.05 },
  corrective: { pitch: 0.95, rate: 0.92 },
  celebratory: { pitch: 1.2, rate: 1.1 },
  empathetic: { pitch: 0.95, rate: 0.9 },
  dramatic: { pitch: 1.05, rate: 0.95 },
  savage: { pitch: 1.1, rate: 1.08 },
};

let voicesCache: SpeechSynthesisVoice[] = [];
function loadVoices() {
  if (!ttsSupported()) return;
  voicesCache = window.speechSynthesis.getVoices();
  if (!voicesCache.length) {
    window.speechSynthesis.onvoiceschanged = () => {
      voicesCache = window.speechSynthesis.getVoices();
    };
  }
}

function pickVoice(locale: string, preferredGender: "male" | "female"): SpeechSynthesisVoice | null {
  if (!voicesCache.length) loadVoices();
  const lang = locale.toLowerCase();
  const prefix = lang.split("-")[0] ?? lang;
  const matches = voicesCache.filter((v) => v.lang.toLowerCase().startsWith(prefix));
  const pool = matches.length ? matches : voicesCache.filter((v) => v.lang.toLowerCase().startsWith("en"));
  if (!pool.length) return null;
  const femaleHint = /female|woman|zira|samantha|victoria|karen|moira|tessa|fiona|paulina|monica|amelie|anna|katja|sinji|ting|yuna|lucia|camila|sofia|valentina|elena|maria|frida/i;
  const maleHint = /male|david|mark|alex|daniel|diego|jorge|pablo|thomas|henri|hans|yuri|fred/i;
  const hint = preferredGender === "female" ? femaleHint : maleHint;
  return pool.find((v) => hint.test(v.name) && !/compact/i.test(v.name)) ?? pool[0] ?? null;
}

export function stopSpeaking() {
  generation += 1;
  activeUtterance = null;
  if (ttsSupported()) window.speechSynthesis.cancel();
  setSpeaking({ speaking: false, text: "", locale: "" });
}

export function unlockAudio() {
  // SpeechSynthesis needs no unlock; kept for API compatibility.
}

export async function speak(
  text: string,
  locale: string,
  rate = 1,
  preferredGender: "male" | "female" = "female",
  mood: SpeechMood = inferMood(text),
  _blendLocale?: string,
): Promise<void> {
  if (!text.trim() || !ttsSupported()) return;

  stopSpeaking();
  const run = generation;
  loadVoices();

  const shape = MOOD_VOICE[mood] ?? MOOD_VOICE.warm;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = locale;
  const voice = pickVoice(locale, preferredGender);
  if (voice) utterance.voice = voice;
  utterance.rate = Math.min(1.6, Math.max(0.5, rate * shape.rate));
  utterance.pitch = shape.pitch;
  activeUtterance = utterance;

  setSpeaking({ speaking: true, text, locale });

  await new Promise<void>((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    utterance.onend = done;
    utterance.onerror = done;
    // Safety net: some browsers drop onend for long text.
    const guard = setTimeout(done, Math.max(4000, text.length * 220));
    utterance.onend = () => {
      clearTimeout(guard);
      done();
    };
    window.speechSynthesis.speak(utterance);
  });

  if (run === generation && activeUtterance === utterance) {
    activeUtterance = null;
    setSpeaking({ speaking: false, text: "", locale: "" });
  }
}

export function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function evaluateResponse(
  transcript: string,
  expected: string[],
  corePattern: string,
): { pass: boolean; hitPattern: boolean; attempted: boolean } {
  const said = normalize(transcript);
  const attempted = said.length > 1;
  const pattern = normalize(corePattern.replace(/uses?|'/g, ""));
  const patternWords = pattern.split(" ").filter((word) => word.length > 1);
  const hitPattern = patternWords.length > 0 && patternWords.every((word) => said.includes(word));
  let overlap = 0;
  for (const answer of expected) {
    const words = normalize(answer.replace(/\[.*?\]/g, "")).split(" ").filter((word) => word.length > 2);
    if (!words.length) continue;
    overlap = Math.max(overlap, words.filter((word) => said.includes(word)).length / words.length);
  }
  return { pass: attempted && (hitPattern || overlap >= 0.6), hitPattern, attempted };
}
