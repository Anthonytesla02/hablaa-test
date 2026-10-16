import { useCallback, useEffect, useRef, useState } from "react";
import { LoaderCircle, Volume2 } from "lucide-react";
import { speak, stopSpeaking, ttsSupported } from "@/lib/speech";
import { useApp } from "@/lib/store";
import { Button } from "@/components/ui/button";

export function useSpeaker(locale: string) {
  const rate = useApp((s) => s.settings.rate);
  return useCallback(
    (text: string, override?: number) => speak(text, locale, override ?? rate),
    [locale, rate],
  );
}

export function PlayButton({
  text,
  locale,
  rate,
  label = "PLAY TRANSLESSON",
  autoPlay = false,
}: {
  text: string;
  locale: string;
  rate?: number;
  label?: string;
  autoPlay?: boolean;
}) {
  const say = useSpeaker(locale);
  const [playing, setPlaying] = useState(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const play = useCallback(async () => {
    setPlaying(true);
    try {
      await say(text, rate);
    } finally {
      if (alive.current) setPlaying(false);
    }
  }, [say, text, rate]);

  // Auto-play once per prompt; streamed playback remains the only audio source.
  const autoPlayed = useRef<string | null>(null);
  useEffect(() => {
    if (!autoPlay || !ttsSupported()) return;
    if (autoPlayed.current === text) return;
    autoPlayed.current = text;

    let cancelled = false;
    const timer = setTimeout(() => {
      if (!cancelled) void play();
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      stopSpeaking();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, autoPlay]);

  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => void play()}
      disabled={playing}
      className="h-12 w-full rounded-lg border-secondary/60 bg-secondary/5 text-secondary active:bg-secondary/15"
    >
      {playing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Volume2 className="h-4 w-4" />}
      <span className="hud text-[10px]">{playing ? "SPEAKING…" : label}</span>
    </Button>
  );
}

