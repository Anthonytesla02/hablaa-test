<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Preserve Hablaa as a speech-first TanStack Start app; all AI must stay free: text features go through `src/lib/mistral.ts` (MISTRAL_API_KEY, free tier), tutor voice-out uses browser SpeechSynthesis in `src/lib/speech.ts`, and voice-in uses browser SpeechRecognition in `src/lib/voice/recognize.ts`. Never reintroduce the Lovable AI gateway or any paid AI service — the user has no budget for AI credits.
- Keep learner recording separate from playback: stop and cancel all tutor speech before opening the microphone, because device speakers can otherwise feed tutor audio into transcription.
- Store authorization roles in `public.user_roles` and enforce privileged feedback access through RLS, because client-side or profile-based admin checks are unsafe.
