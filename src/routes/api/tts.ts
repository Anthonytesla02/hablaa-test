import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const requestSchema = z.object({
  text: z.string().trim().min(1).max(1800),
  locale: z.string().trim().min(2).max(24).default("es-ES"),
  rate: z.number().min(0.7).max(1.25).default(1),
  voice: z.enum(["female", "male"]).default("female"),
  mood: z
    .enum(["warm", "encouraging", "playful", "corrective", "celebratory", "empathetic", "dramatic", "savage"])
    .default("warm"),
  /** Target language for English lines that quote target-language words (code-switching). */
  blendLocale: z.string().trim().min(2).max(24).optional(),
});

const VOICES = { female: "Kore", male: "Puck" } as const;

const LANGUAGES: Record<string, string> = {
  es: "authentic conversational Spanish",
  fr: "authentic conversational French",
  de: "authentic conversational German",
  ru: "authentic conversational Russian",
  en: "natural English",
};

function deliveryPrompt(input: z.infer<typeof requestSchema>) {
  if (input.blendLocale) {
    const target = LANGUAGES[input.blendLocale.toLowerCase().slice(0, 2)] ?? "the target language";
    const savage = input.mood === "savage";
    return [
      "You are a real, funny language tutor talking to your student. Speak the English parts in natural, casual English.",
      `Whenever a word or phrase is in another language, switch instantly and seamlessly to ${target} with a fully native accent and pronunciation, then glide straight back into English — no pause, no announcer tone, exactly like a bilingual person mid-sentence.`,
      savage
        ? "Mood: savage roast. Actually laugh out loud where laughter is written (HAHA, pfff), sound genuinely amused and dramatic, exaggerate the silly comments with big theatrical intonation, then calm down into a friendly, clear explanation."
        : `Sound ${input.mood}, emotionally present, and genuinely human.`,
      "Keep words at natural length — never stretch syllables. Never sound synthetic.",
      `Say: ${input.text}`,
    ].join(" ");
  }
  const language = LANGUAGES[input.locale.toLowerCase().slice(0, 2)] ?? "natural English";
  const words = input.text.trim().split(/\s+/).length;
  // Single words and short vocabulary items must be crisp — no drawn-out vowels or dramatic pauses.
  if (words <= 4) {
    return [
      `Pronounce this in ${language}, exactly as a native speaker says it in everyday conversation.`,
      "Normal speed, crisp and clear, warm tone. Do not stretch, elongate, or drag any syllable or vowel, and do not add pauses.",
      `Say: ${input.text}`,
    ].join(" ");
  }
  const pace = input.rate < 0.9 ? "relaxed" : input.rate > 1.08 ? "energetic" : "natural";
  return [
    `Speak in ${language}.`,
    `Sound ${input.mood}, emotionally present, and genuinely human.`,
    `Use a ${pace} conversational pace with expressive intonation. Keep words at natural length — never stretch or drag syllables.`,
    "Never sound like an announcer, recording, or synthetic assistant.",
    `Say: ${input.text}`,
  ].join(" ");
}

/** One expressive, streamed speech source for every tutor line in Hablaa. */
export const Route = createFileRoute("/api/tts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = requestSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return Response.json({ message: "That speech request is not valid." }, { status: 400 });
        }

        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) {
          return Response.json({ message: "Expressive speech is not configured." }, { status: 401 });
        }

        try {
          const upstream = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-3.1-flash-tts-preview",
              contents: [{ role: "user", parts: [{ text: deliveryPrompt(parsed.data) }] }],
              generationConfig: {
                responseModalities: ["AUDIO"],
                speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: VOICES[parsed.data.voice] },
                  },
                },
              },
              stream_format: "sse",
            }),
            signal: request.signal,
          });

          return new Response(upstream.body, {
            status: upstream.status,
            headers: {
              "Content-Type": upstream.headers.get("content-type") ?? "text/event-stream",
              "Cache-Control": "no-cache, no-store",
            },
          });
        } catch (error) {
          if (request.signal.aborted) {
            return Response.json({ message: "Speech stopped." }, { status: 499 });
          }
          console.error("Speech request failed", error);
          return Response.json({ message: "The tutor voice is temporarily unavailable." }, { status: 502 });
        }
      },
    },
  },
});