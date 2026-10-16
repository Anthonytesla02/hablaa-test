# HABLAA — Architecture & Developer Guide

> Everything an outsider needs to understand, run, and make major changes to Hablaa.
> Live app: https://hablaai-1.lovable.app

---

## 1. What Hablaa is

Hablaa (brand: "Habla") is a **speech-first, gamified language-learning web app**. Learners pick a language (Spanish, French, German, Russian), follow a 28-day structured course, practise speaking out loud with an AI tutor that talks back in an expressive human voice, review vocabulary with spaced repetition, and compete/share progress with a community.

Core promise (landing page): *from complete beginner to your own sentences in about 21 days.*

### Feature map

| Area | Route | What it does |
|---|---|---|
| Landing | `/` | Marketing page, 21-day claim, founder quote, four languages |
| Onboarding | `/start` | Name, language, goal/persona, daily tier, timeline, level projection |
| Auth | `/auth` | Email/password + Google sign-in (Lovable Cloud auth) |
| Learn (map) | `/dashboard` | 4-week course map, daily lesson nodes, daily challenge, specials, check-in |
| Lesson player | `/session` | Step-by-step lesson (choice, write, order, match, speak, roleplay, dictation, shadowing) |
| Talk (live chat) | `/simulate` | AI role-play with a native tutor character; voice or typed; corrections & roasts |
| Practice deck | `/vault` | SRS review decks; completed decks drop out; AI "Mixed challenge" of 20 new items |
| League | `/league` | Weekly XP league (ghost competitors seeded per user) |
| Shop | `/shop` | Spend coins on streak freezes, unlocks |
| Profile | `/profile` | Folded sections: account & preferences, tutor memory, settings, badges, sessions, feedback (admin sees all) |
| Tutor setup | `/companion` | Choose character, personality, slang dial, roast dial, modes |
| Streak | `/streak` | Streak celebration + streak goal commitment |
| Backup | `/backup` | Export/import local progress |
| Community | `/feed` | Wins tab (shared progress posts) + realtime Chat tab |
| Legal/info | `/privacy` `/terms` `/cookies` `/contact` `/introduction` | Static pages |
| Global | every page | Floating feedback button, walkthrough tutorial, handler avatar |

---

## 2. Tech stack

- **Framework:** TanStack Start v1 (React 19, SSR, server functions), Vite 7, file-based routing via `@tanstack/react-router`.
- **Runtime:** Cloudflare Workers (workerd) — server code must be edge-compatible (no Node-only APIs).
- **Styling:** Tailwind CSS v4 configured in `src/styles.css` (semantic tokens: `primary`, `secondary`, `amber`, `muted`, `card`, …). shadcn/ui components in `src/components/ui`.
- **State:** Zustand with `persist` (localStorage) in `src/lib/store.ts`, mirrored to the cloud.
- **Data fetching:** TanStack Query (`queryKey` e.g. `"feedback-inbox"`).
- **Backend:** Lovable Cloud (Postgres + Auth + Realtime). Client: `import { supabase } from "@/integrations/supabase/client"`.
- **AI:** Lovable AI Gateway (`LOVABLE_API_KEY`, server-side only) — chat models, TTS, transcription.
- **Push:** OneSignal Web SDK v16.
- **Validation:** Zod on every server input.

Package manager: **bun**. Typecheck: `npx tsgo --noEmit`. Dev server: `http://localhost:8080`.

---

## 3. Directory layout

```text
src/
  routes/                  File-based routes (one file = one URL)
    __root.tsx             App shell: <head> meta, fonts, <Outlet/>, <Tutorial/>, <FeedbackButton/>, Toaster
    index.tsx              Landing page
    start.tsx              Onboarding
    auth.tsx               Sign in / sign up
    feed.tsx               Community (Wins + Chat)
    _authenticated/        Pathless layout: everything here requires a session
      route.tsx            AuthGate: session check -> cloud sync -> autosave subscription
      dashboard.tsx session.tsx simulate.tsx vault.tsx league.tsx shop.tsx
      profile.tsx companion.tsx streak.tsx backup.tsx
    api/
      tts.ts               POST /api/tts — streamed expressive speech
      public/push/daily-reminder.ts  Cron endpoint for push reminders (secret-authenticated)
  lib/
    store.ts               Zustand global state + all game logic actions
    cloud-sync.ts          Load/save store <-> database
    content.ts             Legacy content.json loader (levels, gamification, personas, labels)
    course.ts              Per-language 28-day course registry & activity helpers
    session.ts             Builds a lesson's ordered list of steps
    srs.ts                 Modified SM-2 spaced-repetition scheduler
    speech.ts              Client TTS player (single audio source)
    companions.ts          Tutor characters, personalities, roast levels
    *.functions.ts         Server functions (AI calls, push)
    voice/                 Mic recorder, transcription, pronunciation scoring, hook
    feedback.ts feed.ts    Feedback & community data access
    shop.ts tutorial.ts sfx.ts ambience.ts onesignal.ts push.server.ts mixed-lang.ts
  components/
    AppFrame.tsx           HUD bar (level, streak, XP, coins) + bottom tab bar
    steps.tsx course-steps.tsx  Lesson step UIs
    Audio.tsx              Play/replay speech buttons
    voice/VoiceAnswer.tsx  Tap-and-speak UI
    FeedbackButton.tsx CommunityChat.tsx Tutorial.tsx Handler.tsx Completion.tsx ShareCard.tsx Glossed.tsx
  data/
    content.json           Levels, gamification, onboarding config, legacy curriculum
    course/                Spanish weeks 1-4 + manifest/daily/specials
    course/{french,german,russian}/  Same structure per language
  integrations/supabase/   AUTO-GENERATED — never edit
public/OneSignalSDKWorker.js  Push service worker
AGENTS.md                  Architecture rules (read first)
roadmap.md                 Task list
```

---

## 4. Request & data flow

```text
Browser (React + Zustand persisted to localStorage)
  |-- supabase client --> Lovable Cloud (Auth, Postgres w/ RLS, Realtime)
  |-- createServerFn  --> Worker handler --> AI provider (chat / transcription)
  |-- fetch /api/tts  --> Worker route   --> AI speech provider (streamed) --> AudioContext
  |-- OneSignal SDK   --> OneSignal  <-- /api/public/push/daily-reminder (cron)
```

### Auth gate (`src/routes/_authenticated/route.tsx`)
1. Check for a session; none → redirect `/auth`.
2. `syncFromCloud(userId)` hydrates the store (failure doesn't block the app).
3. Store changes trigger a debounced autosave; a flush runs on `pagehide` / `visibilitychange`.
4. Sign-out event → `/auth`. Shows a llama loading image until ready.

Do not recreate this file from scratch; edit carefully.

---

## 5. Database (Lovable Cloud / Postgres)

All tables are in `public`, RLS enabled; users only touch their own rows unless stated.

| Table | Key columns | Purpose |
|---|---|---|
| `profiles` | user_id, callsign, lang_id, persona_id, tier_id, timeline_id, xp, weekly_xp, credits, streak, longest_streak, freezes, last_active_day, last_login_day, badges[], quests jsonb, settings jsonb, league_tier, ghost_seed, … | Mirror of the store's scalar state |
| `srs_cards` | user_id, id, target, translation, lang, due_at, ease, interval_days, reps, lapses | Vocabulary cards |
| `completed_days` | user_id, day_key, completed_at | Finished lessons |
| `session_history` | user_id, day_key, date, accuracy, items, xp, cover_intact | Lesson results |
| `feed_posts` | user_id, callsign, kind, body, stats jsonb | Community "Wins" (signed-in read) |
| `community_messages` | user_id, callsign, lang_id, body | Realtime chat (signed-in read, own delete) |
| `feedback` | user_id, mood, rating, body, page | Feedback; owner reads own, admins read all |
| `user_roles` | user_id, role (`app_role`: admin/moderator/user) | Authorization roles |

Admin check: `public.has_role(auth.uid(), 'admin')` (SECURITY DEFINER) used inside RLS. **Never** store roles on profiles or check admin client-side. Current admin: anthonyteslajnr@gmail.com.

Schema changes go through migrations; always add RLS + GRANTs on new tables.

---

## 6. Global state — `src/lib/store.ts`

One Zustand store, `useApp`, persisted to localStorage and synced to the cloud.

Main fields: `profile` (callsign, langId, timelineId, tierId, personaId, startedAt), `xp`, `weeklyXp`, `credits` (coins), `streak`, `longestStreak`, `lastActiveDay`, `freezes`, `inventory`, `badges`, `cards` (SRS), `completedDays`, `history`, `quests`, `leagueTier`, `settings {rate, captions}`, companion config, mistake memory, tutorial step, check-ins, weekly recall.

Key actions:
```ts
registerLogin()        // calls refreshStreak() first, then daily bookkeeping
refreshStreak()        // missed days: consume freezes, else streak -> 0
completeSession(summary, questFlags) // XP, coins, streak++, quests, badges, history
reviewCard(id, outcome)              // SRS grading via scheduleGraded
seedCards(items, lang)               // add lesson vocab to the deck
purchase(id, cost) / spend(n)
setCompanion(partial) / noteMistake(tag, detail)
checkIn() / completeChallenge(id, xp) / completeWeeklyRecall(week, xp)
```
Read with selectors: `const xp = useApp((s) => s.xp)`. Level: `useLevel()` → `clearanceForXp(xp)` from `content.ts`.

### Streak rules
- Completing a lesson on a new day increments the streak and sets `lastActiveDay` = today.
- If `lastActiveDay` is older than yesterday, each missed day consumes a freeze; if freezes run out, streak resets to 0.
- Cloud sync keeps streak/lastActiveDay from whichever side (cloud vs local) has the newer day.

---

## 7. Courses — `src/lib/course.ts`

Each language has 4 week files (7 lessons each = 28 days) plus `daily_challenges.json`, `special_challenges.json`, `course_manifest.json` (mastery rules, review schedule).

```ts
const COURSES: Record<string, Course> = {
  spanish: makeCourse("Spanish", courseWeeks, dailyRaw, specialRaw),
  french:  makeCourse("French", buildWeeks([fw1, fw2, fw3, fw4]), frDaily, frSpecial),
  german:  ..., russian: ...,
};
courseFor(langId)          // accepts short codes or names
lessonById(id) / challengeForDay(day, langId) / unlockedSpecials(day, langId) / hasCourse(langId)
activityMode(a)            // "choice" | "write" | "order" | "match" | "speak" | "roleplay"
acceptedAnswers(a) / matchPairs(a) / orderTokens(a) / activityAudio(a)
```
`buildWeeks` normalises per-language target fields (`fr`/`de`/`ru` → the internal `es` field), so lesson UIs are language-agnostic.

**Adding a language:**
1. Add `src/data/course/<lang>/` with the same JSON shapes.
2. Import and register in `COURSES`.
3. Add a BCP-47 code in `content.ts` `bcp47()`, a `LANGUAGES` entry in `api/tts.ts`, a name in `mixed-lang.ts`.
4. Add tutor characters in `companions.ts` (`lang` field).
5. Make it selectable in onboarding (`start.tsx`) and update landing/feed meta copy.

### Lesson player
`src/lib/session.ts` `buildLessonSession()` turns a lesson into ordered `Step`s; `session.tsx` renders them with `steps.tsx` / `course-steps.tsx`. At the end a results screen stays until the learner taps **CLAIM {xp} XP · NEXT** (or **TRY AGAIN** below the pass threshold); `proceed()` goes to `/streak`, the next lesson, or `/dashboard`.

---

## 8. Voice system (most sensitive area)

**Rule: one playback source only.** All tutor speech goes through the single speech service — a client player (`src/lib/speech.ts`) talking to one server route (`/api/tts`). Browser `speechSynthesis` was deliberately removed (echo, robotic quality) — never re-add it, and never add a second audio path.

### How playback works (high level)
1. Any part of the app asks the speech service to say a line, passing the text, language, speed, voice gender, and an optional "mood" (warm, encouraging, playful, corrective, celebratory, empathetic, dramatic, savage).
2. The client sends the request to `/api/tts` and plays the streamed response on a single shared audio context.
3. Starting a new line always cancels the previous one — speech can never overlap.
4. The server route validates the request, picks the voice, and builds an "acting direction" for the speech model:
   - **Short vocabulary items** (a few words): crisp, native, normal speed, no stretched syllables.
   - **Full sentences:** expressive, emotional, conversational pace based on speed and mood.
   - **Code-switching lines** (English narration quoting target-language words): instant native-accent switch mid-sentence, like a bilingual person.
   - **Savage mood:** real laughter and theatrical roasting that settles into a clear explanation.
5. The route forwards the provider's audio stream straight to the browser.

### How recording works (high level)
1. The learner taps to speak. **All tutor speech is stopped first, with a short settle delay,** so the microphone never captures speaker output (this prevents echo and garbage transcripts).
2. A short clip (max ~15 s, with a live level meter and friendly mic errors) is recorded in the browser.
3. The clip goes to a server function that forwards it to the speech-to-text provider and returns a transcript.
4. Local scoring (`src/lib/voice/score.ts`) compares the transcript to the expected answer word by word (with phonetic folding for near-misses) and returns a verdict (great / close / retry) plus the XP to award.

---

## 9. AI service layer (high level)

All AI features run as **server functions** (or the `/api/tts` route). The browser never holds an AI key and never talks to a provider directly. Every server function follows the same contract:

1. Validate input with Zod (limits sized for real lesson content).
2. Read the AI key from server-only environment inside the handler.
3. Call the provider; on any failure return a **safe, pre-written fallback** so the app keeps working.
4. Where an exact deterministic answer exists (e.g. the learner typed the expected answer word-for-word), skip the model entirely.

The AI-powered capabilities:

| Capability | File | What it does |
|---|---|---|
| Conversation tutor | `simulate.functions.ts` | Produces the tutor's next in-character reply plus structured feedback, given the scene, character, personality dials and recent history |
| Correction & coaching | `coach.functions.ts` | Judges a learner's line (exact matches skip the model); explains mistakes at beginner level; writes the roast text on the Savage setting |
| Word explanations | `gloss.functions.ts` | Tap-a-word meaning, grammar note and example in context |
| Translation | `translate.functions.ts` | Cleans up and translates what the learner just said |
| Mixed challenges | `mixed.functions.ts` | Generates 20 brand-new practice items from the learner's known vocabulary (validated, de-duplicated) |
| Speech-to-text | `voice/transcribe.functions.ts` | Turns the recorded clip into a transcript |
| Text-to-speech | `routes/api/tts.ts` | Streams the tutor's voice (see §8) |

Billing note: AI features are paid from the workspace's AI credits. When credits are exhausted the provider refuses requests and the app shows its fallback states ("Connection unstable", "Speech checking is unavailable").

---

## 10. Live chat / Talk (`simulate.tsx`)

- Scene built from today's lesson (goals, vocab, setting) + chosen character from `companions.ts` (Sofia/Lucía es, Camille/Élise fr, Lena de, Anya ru).
- Companion brief: personality contract, slang dial 0–3, roast dial 0–3, local mode, don't-translate mode, interject-only, mistake memory.
- Learner speaks (tap and speak) or types → correction check → tutor reply → reply spoken through the speech service.
- Indicator: `CHECKING YOUR {LANGUAGE}…` (dynamic).
- **Savage (roast ≥ 3):** every real mistake gets a laugh plus a silly English roast quoting the wrong words, then the correction — spoken as one code-switched line (English narration, native-accent target language). It mocks the sentence, never the person.

---

## 11. Practice deck (`vault.tsx`, `srs.ts`)

- Cards scheduled with modified SM-2 (`scheduleGraded(card, "correct"|"hinted"|"wrong")`).
- A deck with nothing due disappears from the list until items come due again.
- **Mixed challenge:** sends known words to the mixed-deck generator → 20 new unique items (EASY/MEDIUM/HARD with 1×/1.5×/2× points). Mixed cards are temporary (not graded into SRS). Deck is snapshotted when a run starts.
- Language resolved by `mixed-lang.ts` `langName()` (short codes or full names).

---

## 12. Community, feedback, push

- **Wins** (`feed.ts`): `listFeed`, `createPost`, `deletePost`, share text. Readable by signed-in users only.
- **Chat** (`CommunityChat.tsx`): insert into `community_messages`; realtime channel `community-chat` via `postgres_changes`; delete own.
- **Feedback** (`FeedbackButton.tsx`, `feedback.ts`): fixed bottom-right button (hidden on `/session` and `/simulate`), dialog with mood, 1–5 stars, message ≤2000, page path. `listFeedbackInbox()` → `{ isAdmin, items }`; admin sees all in Profile → "All feedback".
- **Push** (`onesignal.ts`, `push.server.ts`): App ID `93fecb50-418e-4426-bddc-9590b3feddb1` (public); REST key is a server secret. Profile toggle "Practice reminders". Cron POST to `/api/public/push/daily-reminder` (requires cron secret) notifies users whose `last_active_day` ≠ today.

---

## 13. Gamification

- **XP → levels** (`clearanceForXp`): 0, 400, 1500, 4000, 9000, 18000, 32000 → "Just Starting" … "Fluent Speaker".
- **Coins** earned from lessons/quests; spent in shop (`shop.ts` `SHOP_ITEMS`).
- **Badges** (`content.ts` `BADGE_LABELS`), **leagues** (Sprouts → Legends), daily **quests**, **check-ins**, **weekly recall**, streak freezes and streak goals.
- Friendly display labels are layered over raw `content.json` ids (internal names like `clearance`, `callsign`, `operative` are legacy and kept for data compatibility).

---

## 14. Design system

- Tokens in `src/styles.css`; use `bg-primary`, `text-muted-foreground`, etc. — no hardcoded colours.
- Mobile-first: content constrained to `max-w-md`, sticky HUD (`HudBar`) and 6-tab `TabBar` in `AppFrame.tsx`.
- Playful rounded UI, mascot llama (`habla-llama.png`), character portraits in `src/assets`.
- Every route defines its own `head()` (title, description, og:*, twitter:card).

---

## 15. Secrets & config

| Secret | Use |
|---|---|
| `LOVABLE_API_KEY` | AI access (managed, server-only) |
| OneSignal REST key / App ID | Push |
| Cron secret | Protects daily-reminder endpoint |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | Public client config (auto-managed `.env`) |

Never read `process.env` outside a handler; never ship secrets to the browser.

---

## 16. Rules / gotchas for contributors

1. Only one tutor audio source (the speech service); no browser speech; no parallel players.
2. Stop speech + settle before recording.
3. Roles only in `user_roles` + `has_role()` in RLS.
4. Don't edit auto-generated files: `src/integrations/supabase/*` (client, types, middleware), `src/routeTree.gen.ts`, `.env`, `supabase/config.toml`.
5. Server logic = `createServerFn` or `src/routes/api/*`; external callers under `api/public/` must verify themselves.
6. Edge runtime: no Node-only modules on the server.
7. Validate all inputs with Zod; keep limits large enough for long lesson content (French objectives exceed 160 chars).
8. Language ids appear as both short codes (`fr`) and names (`french`) — always normalise.
9. New tables: RLS + policies + grants in the same migration.
10. Never rewrite pushed git history.

---

## 17. Common changes — where to look

| Change | Files |
|---|---|
| Voice tone/acting | `api/tts.ts` `deliveryPrompt`, `speech.ts` `inferMood` |
| Tutor behaviour | `simulate.functions.ts` system prompt, `coach.functions.ts`, `companions.ts` |
| New activity type | `course.ts` `activityMode`, `session.ts`, `course-steps.tsx` |
| XP/coin rewards | `store.ts` `completeSession`, `content.json` gamification |
| New tab | `AppFrame.tsx` `TABS` + route file under `_authenticated/` |
| New synced field | `store.ts` + `profiles` column migration + `cloud-sync.ts` both directions |
| Landing copy/SEO | `routes/index.tsx` `head()` and body, `Marketing.tsx` |
