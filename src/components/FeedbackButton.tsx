import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, MessageSquareHeart, Star } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { MOODS, sendFeedback, type FeedbackMood } from "@/lib/feedback";

/** Floating feedback button shown on every page; opens a quick pop-up form. */
export function FeedbackButton() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [mood, setMood] = useState<FeedbackMood>("idea");
  const [rating, setRating] = useState<number | null>(null);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    void supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
  }, [open]);

  // Hide during focused lesson / roleplay screens so it never covers the mic.
  if (pathname.startsWith("/session") || pathname.startsWith("/simulate")) return null;
  const hasNav = /^\/(dashboard|vault|league|shop|profile|streak|companion|backup)/.test(pathname);

  async function submit() {
    if (!body.trim()) return;
    setSending(true);
    try {
      await sendFeedback({ mood, rating, body, page: pathname });
      await qc.invalidateQueries({ queryKey: ["feedback-inbox"] });
      toast.success("Thank you! Your feedback was sent.");
      setBody("");
      setRating(null);
      setOpen(false);
    } catch {
      toast.error("Couldn't send that — try again in a moment.");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Send feedback"
        className={`fixed right-3 z-40 flex items-center gap-1.5 rounded-full bg-secondary px-3.5 py-2.5 text-[11px] font-extrabold text-secondary-foreground shadow-lg transition-transform active:scale-95 ${
          hasNav ? "bottom-24" : "bottom-5"
        }`}
      >
        <MessageSquareHeart className="h-4 w-4" />
        Feedback
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle>How's Habla treating you?</DialogTitle>
            <DialogDescription>Tell us anything — we read every message.</DialogDescription>
          </DialogHeader>

          {signedIn === false ? (
            <div className="space-y-3 text-center">
              <p className="text-sm text-muted-foreground">Sign in so we can link your feedback to your account.</p>
              <Link
                to="/auth"
                onClick={() => setOpen(false)}
                className="block rounded-2xl bg-primary py-3 text-sm font-extrabold text-primary-foreground"
              >
                Sign in
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-4 gap-1.5">
                {MOODS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setMood(m.id)}
                    className={`rounded-2xl border-2 px-1 py-2 text-center text-[10px] font-extrabold ${
                      mood === m.id ? "border-primary bg-primary/10 text-primary" : "border-border"
                    }`}
                  >
                    <span className="block text-lg">{m.emoji}</span>
                    {m.label}
                  </button>
                ))}
              </div>
              <div className="flex justify-center gap-1" aria-label="Rating">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} onClick={() => setRating(n)} aria-label={`${n} stars`}>
                    <Star
                      className={`h-6 w-6 ${rating && n <= rating ? "fill-secondary text-secondary" : "text-muted-foreground"}`}
                    />
                  </button>
                ))}
              </div>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                maxLength={2000}
                rows={4}
                placeholder="What should we know?"
                className="w-full resize-none rounded-2xl border-2 border-border bg-background p-3 text-sm outline-none focus:border-primary"
              />
              <button
                onClick={() => void submit()}
                disabled={!body.trim() || sending}
                className="btn-3d flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-sm font-extrabold text-primary-foreground disabled:opacity-50"
              >
                {sending && <Loader2 className="h-4 w-4 animate-spin" />} Send feedback
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
