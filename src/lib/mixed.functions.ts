import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { extractJson, mistralChat } from "./mistral";

const Input = z.object({
  language: z.string().min(2).max(40),
  known: z.array(z.object({ target: z.string().max(300), translation: z.string().max(300) })).max(200),
});

export type MixedItem = { target: string; translation: string; level: "EASY" | "MEDIUM" | "HARD" };

/** Generate 20 brand-new practice items built from words the learner already knows. */
export const generateMixedDeck = createServerFn({ method: "POST" })
  .inputValidator((d) => Input.parse(d))
  .handler(async ({ data }): Promise<{ items: MixedItem[]; error?: string }> => {
    const known = data.known.map((k) => `${k.target} = ${k.translation}`).join("\n");
    const system = `You create ${data.language} recall drills for a beginner.
Using ONLY vocabulary and grammar from the learner's known items (plus very common function words), write 20 NEW items that do NOT copy any known item verbatim: recombine words into new phrases and short sentences.
Mix difficulty: 7 EASY (2-4 word phrases), 7 MEDIUM (short sentences), 6 HARD (longer sentences, questions, or conjugation changes).
All 20 must be unique. Reply ONLY with JSON: {"items":[{"target":string,"translation":string,"level":"EASY"|"MEDIUM"|"HARD"}]}
"target" is ${data.language}, "translation" is natural English.`;

    const raw = await mistralChat(
      [
        { role: "system", content: system },
        { role: "user", content: `Known items:\n${known}\nReturn the json.` },
      ],
      { json: true, maxTokens: 4000 },
    );
    const parsed = extractJson<{ items?: MixedItem[] }>(raw);
    if (!parsed?.items) return { items: [], error: "failed" };

    const knownSet = new Set(data.known.map((k) => k.target.trim().toLowerCase()));
    const seen = new Set<string>();
    const items = parsed.items.filter((it) => {
      const key = it?.target?.trim().toLowerCase();
      if (!key || !it.translation || knownSet.has(key) || seen.has(key)) return false;
      seen.add(key);
      if (!["EASY", "MEDIUM", "HARD"].includes(it.level)) it.level = "MEDIUM";
      return true;
    });
    return { items: items.slice(0, 20) };
  });
