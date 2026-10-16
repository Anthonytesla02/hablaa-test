# Hablaa import and expressive voice rebuild

## Goal
Import the complete Hablaa language-learning app from the supplied GitHub repository, preserve its screens and learning flows, and fully replace the existing speech playback with a polished, human-sounding system.

## What will change
- Bring the repository’s Hablaa app, assets, course content, account flows, progress tracking, and protected learning screens into this project’s TanStack Start structure.
- Enable Lovable Cloud and recreate the included user progress schema, access rules, authentication flow, and sync behavior.
- Remove the old speech endpoint, browser voice fallback, audio cache, unlock workarounds, and every call path tied to the current playback implementation.
- Build one new expressive speech service through Lovable AI with:
  - character-specific voices and stable voice identity;
  - emotion, intent, emphasis, pacing, pauses, and conversational delivery selected from lesson context;
  - clean single-source playback so two voices can never overlap or create an echo;
  - request cancellation, playback state, replay, loading, and graceful error handling;
  - bounded caching and object-URL cleanup without reusing stale playback state.
- Reconnect tutor speech, word playback, lesson prompts, roleplay dialogue, and pronunciation exercises to the new service.
- Keep microphone recording and transcription for learner answers, but isolate it from speaker playback with explicit stop/listen transitions to prevent feedback.
- Refine the voice-facing controls and feedback states so they feel intentional and professional while preserving Hablaa’s overall visual identity.

## Voice direction
Tutor delivery will be warm, emotionally responsive, and conversational rather than announcer-like. Prompts will encode the tutor’s personality and the line’s intent—encouraging, playful, corrective, surprised, empathetic, or celebratory—with natural pauses and controlled exaggeration.

## Validation
- Verify all imported public and signed-in screens compile and navigate correctly.
- Test account creation/sign-in and persisted learner progress through Lovable Cloud.
- Exercise a full speaking lesson: tutor line, recording, transcription, feedback, replay, and next prompt.
- Stress-test rapid replay/navigation to confirm there is no doubled audio, echo, stale speech, or microphone feedback.
- Check phone and desktop layouts, console/runtime errors, and final metadata for every content page.

## Assumption
“Remove the audio feature completely” means delete the current audio implementation and replace it—not remove spoken learning from the product. The learner microphone and pronunciation workflow remain because the requested rebuild is for premium human-like voices.
