import { useCallback, useEffect, useRef, useState } from "react";
import { listenOnce, RecognitionError, recognitionSupported, type RecognitionSession } from "./recognize";
import { scoreSpeech, voiceXp, type VoiceScore } from "./score";
import { stopSpeaking } from "@/lib/speech";

export type VoicePhase = "idle" | "listening" | "checking" | "result" | "error";

export type VoiceAnswerState = {
  phase: VoicePhase;
  /** 0–1 live loudness while listening (static with browser recognition). */
  level: number;
  transcript: string;
  result: VoiceScore | null;
  error: string | null;
  supported: boolean;
  /** Start listening, or stop and check if already listening. */
  toggle: () => void;
  reset: () => void;
};

type Options = {
  expected: string;
  locale: string;
  /** Called once a scored attempt comes back. */
  onResult?: (score: VoiceScore, transcript: string) => void;
  /** Free-form use (roleplay): receives raw text, skips scoring. */
  onTranscript?: (transcript: string) => void;
};

/**
 * One speech state machine for the whole app: listen (browser SpeechRecognition) → score.
 * Runs entirely on the device — free and unlimited.
 */
export function useVoiceAnswer({ expected, locale, onResult, onTranscript }: Options): VoiceAnswerState {
  const [phase, setPhase] = useState<VoicePhase>("idle");
  const [level, setLevel] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [result, setResult] = useState<VoiceScore | null>(null);
  const [error, setError] = useState<string | null>(null);
  const session = useRef<RecognitionSession | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      session.current?.cancel();
      session.current = null;
    };
  }, []);

  const reset = useCallback(() => {
    setPhase("idle");
    setTranscript("");
    setResult(null);
    setError(null);
    setLevel(0);
  }, []);

  const toggle = useCallback(() => {
    if (phase === "listening") {
      session.current?.stop();
      return;
    }
    if (phase === "checking") return;

    setTranscript("");
    setResult(null);
    setError(null);

    void (async () => {
      try {
        stopSpeaking();
        // Give the speakers time to settle before opening the microphone.
        await new Promise((resolve) => setTimeout(resolve, 140));
        const s = listenOnce(locale);
        session.current = s;
        setPhase("listening");
        setLevel(0.6);
        const heard = await s.done;
        session.current = null;
        if (!alive.current) return;
        setLevel(0);
        setPhase("checking");

        if (!heard) {
          setPhase("error");
          setError("I couldn't make out any words — try again a bit louder.");
          return;
        }
        setTranscript(heard);
        if (onTranscript) {
          setPhase("idle");
          onTranscript(heard);
          return;
        }
        const scored = scoreSpeech(heard, expected);
        setResult(scored);
        setPhase("result");
        onResult?.(scored, heard);
      } catch (e) {
        session.current = null;
        if (!alive.current) return;
        setLevel(0);
        setPhase("error");
        setError(
          e instanceof RecognitionError
            ? e.message
            : e instanceof Error
              ? e.message
              : "Something went wrong listening — try again.",
        );
      }
    })();
  }, [phase, expected, locale, onResult, onTranscript]);

  return {
    phase,
    level,
    transcript,
    result,
    error,
    supported: recognitionSupported(),
    toggle,
    reset,
  };
}

export { voiceXp };
