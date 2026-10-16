import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
import { sendOneSignal } from "@/lib/push.server";

/** Scheduled: reminds learners who haven't practised today to keep their streak. */
export const Route = createFileRoute("/api/public/push/daily-reminder")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const today = new Date().toISOString().slice(0, 10);
        const { data, error } = await supabaseAdmin
          .from("profiles")
          .select("user_id, last_active_day, streak");
        if (error) return Response.json({ error: error.message }, { status: 500 });
        const ids = (data ?? []).filter((p) => p.last_active_day !== today).map((p) => p.user_id);
        try {
          await sendOneSignal({
            externalIds: ids,
            heading: "Your tutor is waiting 🔥",
            message: "Five minutes today keeps your streak alive. ¡Vamos!",
            url: "/dashboard",
          });
        } catch (e) {
          return Response.json({ error: (e as Error).message }, { status: 502 });
        }
        return Response.json({ sent: ids.length });
      },
    },
  },
});
