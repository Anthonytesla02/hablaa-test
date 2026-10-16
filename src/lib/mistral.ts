/**
 * Shared Mistral free-tier chat helper. Server-only: only import from
 * *.functions.ts handlers or server routes — never from client modules.
 * Reads MISTRAL_API_KEY at call time (workerd injects env per request).
 */

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

const ENDPOINT = "https://api.mistral.ai/v1/chat/completions";
const MODEL = "mistral-small-latest";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * One chat completion against Mistral's free tier.
 * Returns the raw assistant text, or null when the key is missing,
 * the request fails, or the free tier is rate-limiting after retries.
 */
export async function mistralChat(messages: ChatMessage[], opts?: { json?: boolean; maxTokens?: number }): Promise<string | null> {
  const apiKey = process.env["MISTRAL_API_KEY"];
  if (!apiKey) return null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: MODEL,
          messages,
          ...(opts?.json ? { response_format: { type: "json_object" } } : {}),
          ...(opts?.maxTokens ? { max_tokens: opts.maxTokens } : {}),
        }),
      });

      if (res.status === 429) {
        // Free-tier rate limit: back off and retry.
        await sleep(1200 * (attempt + 1));
        continue;
      }
      if (!res.ok) return null;

      const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const content = json.choices?.[0]?.message?.content;
      return typeof content === "string" && content.trim() ? content : null;
    } catch {
      await sleep(600 * (attempt + 1));
    }
  }
  return null;
}

/** Extract the first JSON object from a model reply, or null. */
export function extractJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}
