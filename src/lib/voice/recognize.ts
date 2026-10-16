/**
 * Speech-to-text via the browser's built-in SpeechRecognition.
 * Free and unlimited — no server round-trip, no AI credits.
 */

export type RecognitionSession = {
  /** Resolves with the final transcript ("" when nothing was heard). */
  done: Promise<string>;
  stop: () => void;
  cancel: () => void;
};

type RecognitionCtor = new () => SpeechRecognitionLike;

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal?: boolean }> }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

function ctor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function recognitionSupported(): boolean {
  return ctor() !== null;
}

export class RecognitionError extends Error {
  constructor(public reason: "unsupported" | "blocked" | "no-speech" | "unknown") {
    super(
      reason === "unsupported"
        ? "This browser can't hear speech — try Chrome, or type your answer instead."
        : reason === "blocked"
          ? "Microphone blocked. Allow mic access for this site, then tap again."
          : reason === "no-speech"
            ? "I couldn't make out any words — try again a bit louder."
            : "Something went wrong listening — try again.",
    );
  }
}

/** Listen once in the given locale (e.g. "es-ES") and resolve the transcript. */
export function listenOnce(locale: string): RecognitionSession {
  const Ctor = ctor();
  if (!Ctor) {
    return {
      done: Promise.reject(new RecognitionError("unsupported")),
      stop: () => undefined,
      cancel: () => undefined,
    };
  }

  const recognition = new Ctor();
  recognition.lang = locale;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.continuous = false;

  let settled = false;
  let cancelled = false;

  const done = new Promise<string>((resolve, reject) => {
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      fn();
    };
    recognition.onresult = (event) => {
      const last = event.results[event.results.length - 1];
      const transcript = last?.[0]?.transcript?.trim() ?? "";
      finish(() => resolve(transcript));
    };
    recognition.onerror = (event) => {
      finish(() => {
        if (cancelled) return resolve("");
        if (event.error === "not-allowed" || event.error === "service-not-allowed")
          return reject(new RecognitionError("blocked"));
        if (event.error === "no-speech") return reject(new RecognitionError("no-speech"));
        return reject(new RecognitionError("unknown"));
      });
    };
    recognition.onend = () => {
      // Ended without a result event.
      finish(() => (cancelled ? resolve("") : reject(new RecognitionError("no-speech"))));
    };
  });

  try {
    recognition.start();
  } catch {
    return {
      done: Promise.reject(new RecognitionError("unknown")),
      stop: () => undefined,
      cancel: () => undefined,
    };
  }

  return {
    done,
    stop: () => {
      try {
        recognition.stop();
      } catch {
        /* already stopped */
      }
    },
    cancel: () => {
      cancelled = true;
      try {
        recognition.abort();
      } catch {
        /* already stopped */
      }
    },
  };
}
