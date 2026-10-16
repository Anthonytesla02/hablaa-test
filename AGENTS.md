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

- Preserve Hablaa as a speech-first TanStack Start app; all tutor playback must use the single Gemini PCM streaming service, because browser speech fallbacks and parallel audio sources caused echo and inconsistent quality.
- Keep learner recording separate from playback: stop and cancel all tutor speech before opening the microphone, because device speakers can otherwise feed tutor audio into transcription.
- Store authorization roles in `public.user_roles` and enforce privileged feedback access through RLS, because client-side or profile-based admin checks are unsafe.
