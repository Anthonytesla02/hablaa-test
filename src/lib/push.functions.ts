import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sendOneSignal } from "./push.server";

/** Public OneSignal app id (safe to expose; it identifies the app, not a credential). */
export const getPushConfig = createServerFn({ method: "GET" }).handler(async () => {
  return { appId: process.env["ONESIGNAL_APP_ID"] ?? null };
});

/** Sends a test notification to the signed-in learner's own devices. */
export const sendTestPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await sendOneSignal({
      externalIds: [context.userId],
      heading: "¡Hola! 👋",
      message: "Notifications are on. We'll nudge you when it's time to practise.",
    });
    return { ok: true };
  });
