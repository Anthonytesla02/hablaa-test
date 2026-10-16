# Rebuild Hablaa without Lovable AI — free, sustainable AI stack

## Goal
Import the Hablaa repo into this project and replace every Lovable AI Gateway call (which dies when credits run out) with free alternatives, so the app keeps working at zero cost.

## Step 1 — Import the repo
- Copy the full repo source (src/, public/, supabase/, drizzle/, configs) into this project, replacing the blank template.
- Install dependencies with bun.

## Step 2 — Replace the AI brain (text)
All AI text features call the Lovable gateway today. Reroute them to **Mistral's free API tier** using your key, stored as a project secret (`MISTRAL_API_KEY`):
- `simulate.functions.ts` — live tutor role-play
- `coach.functions.ts` — lesson coaching
- `gloss.functions.ts` — word glosses
- `translate.functions.ts` — translations
- `mixed.functions.ts` — Mixed Challenge generator
- One shared `mistral.ts` helper: model `mistral-small-latest` (free tier), automatic retry on rate-limit (429), and a graceful friendly fallback message instead of a crash.

## Step 3 — Replace voice-out (text-to-speech)
- Today: `/api/tts` streams paid Gemini speech via the gateway.
- New: browser's built-in **SpeechSynthesis** — free, unlimited, works offline, has Spanish/French/German/Russian voices. Update `src/lib/speech.ts` to pick a native voice per language, apply rate/pitch per mood (warm, playful, savage…), and delete the `/api/tts` route.

## Step 4 — Replace voice-in (speech-to-text)
- Today: `voice/transcribe.functions.ts` sends recordings to the paid gateway.
- New: browser's built-in **SpeechRecognition** (free, unlimited) with per-language locale; keep the mic recorder UI and pronunciation scoring (`voice/score.ts` stays — it's local). Fallback: typed input when the browser lacks speech recognition.

## Step 5 — Keep everything else
- Lovable Cloud stays for login, database, community chat — those are free and not AI credits.
- Course map, SRS decks, league, shop, profile, onboarding: unchanged.

## Step 6 — Resilience for many users
- Per-user rate limiting + retries so one busy moment never crashes the app.
- Clear "tutor is busy, try again in a moment" states instead of errors.
- Optional second free key (e.g. Groq) can be added later as a backup brain — the helper will support failover.

## Honest limits
- Mistral's free tier has rate limits, so "unlimited for 1000+ simultaneous users" isn't guaranteed by any free tier. The design (retries, fair limits, browser-side voice) gets as close as free services allow, and voice features become truly unlimited since they run in the browser.

## Verification
- Build passes, typecheck clean.
- Playwright: sign in, run a Talk session turn (Mistral reply appears), hear browser TTS, test a speak step with recognition or typed fallback.
