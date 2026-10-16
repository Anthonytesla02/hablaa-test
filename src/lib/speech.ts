import { createParser } from "eventsource-parser";

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

let activeController: AbortController | null = null;
let activeContext: AudioContext | null = null;
let activeSources = new Set<AudioBufferSourceNode>();
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
  return typeof window !== "undefined" && "AudioContext" in window;
}

function inferMood(text: string): SpeechMood {
  if (/!{1,}|perfect|excellent|amazing|bravo|bien hecho|increíble/i.test(text)) return "celebratory";
  if (/sorry|it's okay|take your time|no pasa nada|tranquil/i.test(text)) return "empathetic";
  if (/try again|remember|careful|almost|otra vez|recuerda/i.test(text)) return "corrective";
  if (/\?|imagine|what if|qué tal/i.test(text)) return "playful";
  return "warm";
}

function decodePCM(pending: Uint8Array, incoming: Uint8Array) {
  const bytes = new Uint8Array(pending.length + incoming.length);
  bytes.set(pending);
  bytes.set(incoming, pending.length);
  const usable = bytes.length - (bytes.length % 2);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const samples = new Float32Array(usable / 2);
  for (let i = 0; i < samples.length; i += 1) samples[i] = view.getInt16(i * 2, true) / 32768;
  return { samples, pending: bytes.slice(usable) };
}

function clearPlayback() {
  activeController?.abort();
  activeController = null;
  for (const source of activeSources) {
    try {
      source.stop();
    } catch {
      // The source may already have ended.
    }
  }
  activeSources.clear();
  if (activeContext) void activeContext.close().catch(() => undefined);
  activeContext = null;
}

export function stopSpeaking() {
  generation += 1;
  clearPlayback();
  setSpeaking({ speaking: false, text: "", locale: "" });
}

export function unlockAudio() {
  // Streaming begins only from explicit learner actions; no silent audio hack is needed.
}

export async function speak(
  text: string,
  locale: string,
  rate = 1,
  preferredGender: "male" | "female" = "female",
  mood: SpeechMood = inferMood(text),
  blendLocale?: string,
): Promise<void> {
  if (!text.trim() || !ttsSupported()) return;

  stopSpeaking();
  const run = generation;
  const controller = new AbortController();
  activeController = controller;
  const context = new AudioContext({ sampleRate: 24000 });
  activeContext = context;
  setSpeaking({ speaking: true, text, locale });

  let pending = new Uint8Array(0);
  let completed = false;
  let samplesPlayed = 0;
  let playhead = 0;
  let finalPlayback: Promise<void> = Promise.resolve();

  try {
    if (context.state === "suspended") await context.resume();
    const response = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, locale, rate, voice: preferredGender, mood, ...(blendLocale ? { blendLocale } : {}) }),
      signal: controller.signal,
    });
    if (!response.ok || !response.body) {
      const body = (await response.json().catch(() => null)) as { message?: string } | null;
      throw new Error(body?.message ?? `Speech failed (${response.status}).`);
    }

    const parser = createParser({
      onEvent(event) {
        const payload = JSON.parse(event.data) as { type?: string; audio?: string; error?: unknown };
        if (payload.type === "error" || payload.error) throw new Error("The tutor voice could not finish speaking.");
        if (payload.type === "speech.audio.done") {
          completed = true;
          return;
        }
        if (payload.type !== "speech.audio.delta" || !payload.audio || completed) return;

        const decoded = decodePCM(
          pending,
          Uint8Array.from(atob(payload.audio), (character) => character.charCodeAt(0)),
        );
        pending = decoded.pending;
        if (!decoded.samples.length) return;
        samplesPlayed += decoded.samples.length;

        const buffer = context.createBuffer(1, decoded.samples.length, 24000);
        buffer.copyToChannel(decoded.samples, 0);
        const source = context.createBufferSource();
        source.buffer = buffer;
        const compressor = context.createDynamicsCompressor();
        compressor.threshold.value = -18;
        compressor.knee.value = 12;
        compressor.ratio.value = 3;
        compressor.attack.value = 0.01;
        compressor.release.value = 0.18;
        source.connect(compressor);
        compressor.connect(context.destination);
        activeSources.add(source);
        finalPlayback = new Promise<void>((resolve) => {
          source.onended = () => {
            activeSources.delete(source);
            resolve();
          };
        });
        playhead = Math.max(playhead, context.currentTime + 0.06);
        source.start(playhead);
        playhead += buffer.duration;
      },
    });

    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
    try {
      while (true) {
        const next = await reader.read();
        if (next.done) break;
        parser.feed(next.value);
      }
      parser.reset({ consume: true });
    } finally {
      reader.releaseLock();
    }

    if (!completed || !samplesPlayed || pending.length) throw new Error("The tutor voice stream ended early.");
    await finalPlayback;
  } catch (error) {
    if (!controller.signal.aborted) throw error;
  } finally {
    if (run === generation) {
      clearPlayback();
      setSpeaking({ speaking: false, text: "", locale: "" });
    }
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