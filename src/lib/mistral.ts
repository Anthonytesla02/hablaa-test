/**
 * Shared free-tier chat helper with provider failover. Server-only: only
 * import from *.functions.ts handlers or server routes — never from client
 * modules. Reads API keys at call time (workerd injects env per request).
 *
 * Provider order per request: Mistral (MISTRAL_API_KEY) → optional second
 * Mistral key (MISTRAL_API_KEY_2) → Groq free tier (GROQ_API_KEY).
 */

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

type Provider = {
  name: string;
  endpoint: string;
  model: string;
  apiKey: string | undefined;
  supportsJsonMode: boolean;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function providers(): Provider[] {
  return [
    {
      name: "mistral",
      endpoint: "https://api.mistral.ai/v1/chat/completions",
      model: "mistral-small-latest",
      apiKey: process.env["MISTRAL_API_KEY"],
      supportsJsonMode: true,
    },
    {
      name: "mistral-2",
      endpoint: "https://api.mistral.ai/v1/chat/completions",
      model: "mistral-small-latest",
      apiKey: process.env["MISTRAL_API_KEY_2"],
      supportsJsonMode: true,
    },
    {
      name: "groq",
      endpoint: "https://api.groq.com/openai/v1/chat/completions",
      model: "llama-3.3-70b-versatile",
      apiKey: process.env["GROQ_API_KEY"],
      supportsJsonMode: true,
    },
  ];
}

async function callProvider(
  provider: Provider,
  messages: ChatMessage[],
  opts?: { json?: boolean; maxTokens?: number },
): Promise<string | null> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const res = await fetch(provider.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${provider.apiKey}`,
        },
        body: JSON.stringify({
          model: provider.model,
          messages,
          ...(opts?.json && provider.supportsJsonMode ? { response_format: { type: "json_object" } } : {}),
          ...(opts?.maxTokens ? { max_tokens: opts.maxTokens } : {}),
        }),
      });

      if (res.status === 429) {
        // Free-tier rate limit: back off and retry this provider.
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

/**
 * One chat completion against the free providers, in failover order.
 * Returns the raw assistant text, or null when every configured provider
 * is missing a key, fails, or is rate-limiting after retries.
 */
export async function mistralChat(messages: ChatMessage[], opts?: { json?: boolean; maxTokens?: number }): Promise<string | null> {
  for (const provider of providers()) {
    if (!provider.apiKey) continue;
    const content = await callProvider(provider, messages, opts);
    if (content) return content;
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
