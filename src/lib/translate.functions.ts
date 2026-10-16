import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { extractJson, mistralChat } from "./mistral";

const Input = z.object({
  text: z.string().min(1).max(600),
  language: z.string().min(2).max(40),
});

export type Translation = { text: string; translation: string };

/** Translate what the learner just said (target language → English) for confirmation. */
export const translateUtterance = createServerFn({ method: "POST" })
  .inputValidator((data) => Input.parse(data))
  .handler(async ({ data }): Promise<Translation> => {
    const system = `You clean up and translate a language learner's spoken utterance.
The learner is practising ${data.language}. Reply with ONLY JSON:
{"text":string,"translation":string}
"text" = the utterance written out properly in ${data.language} (fix obvious speech-to-text spelling/accents ONLY; never fix their grammar or change their words).
If the learner spoke English, keep it as it is in "text".
"translation" = a plain English translation of what they actually said.`;

    const raw = await mistralChat(
      [
        { role: "system", content: system },
        { role: "user", content: `Utterance: "${data.text}"\nReturn the json.` },
      ],
      { json: true },
    );
    const parsed = extractJson<Partial<Translation>>(raw);
    if (!parsed) return { text: data.text, translation: "" };
    return {
      text: (parsed.text ?? data.text).trim() || data.text,
      translation: (parsed.translation ?? "").trim(),
    };
  });
