import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Loader2, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/store";
import { langById } from "@/lib/content";

type Msg = { id: string; user_id: string; callsign: string; lang_id: string; body: string; created_at: string };

function time(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function CommunityChat() {
  const profile = useApp((s) => s.profile);
  const [me, setMe] = useState<string | null | undefined>(undefined);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setMe(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    if (!me) return;
    let alive = true;
    void supabase
      .from("community_messages")
      .select("id,user_id,callsign,lang_id,body,created_at")
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data }) => {
        if (!alive) return;
        setMsgs(((data ?? []) as Msg[]).reverse());
        setLoading(false);
      });
    const ch = supabase
      .channel("community-chat")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "community_messages" }, (p) => {
        const m = p.new as Msg;
        setMsgs((cur) => (cur.some((x) => x.id === m.id) ? cur : [...cur, m]));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "community_messages" }, (p) => {
        const id = (p.old as { id: string }).id;
        setMsgs((cur) => cur.filter((x) => x.id !== id));
      })
      .subscribe();
    return () => {
      alive = false;
      void supabase.removeChannel(ch);
    };
  }, [me]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [msgs.length]);

  async function send() {
    const body = text.trim();
    if (!body || !me) return;
    setSending(true);
    const { data, error } = await supabase
      .from("community_messages")
      .insert({ user_id: me, body: body.slice(0, 500), callsign: profile?.callsign || "Learner", lang_id: profile?.langId ?? "es" })
      .select("id,user_id,callsign,lang_id,body,created_at")
      .single();
    setSending(false);
    if (error) return void toast.error("Message didn't send — try again.");
    setText("");
    setMsgs((cur) => (cur.some((x) => x.id === data.id) ? cur : [...cur, data as Msg]));
  }

  async function remove(id: string) {
    const { error } = await supabase.from("community_messages").delete().eq("id", id);
    if (error) return void toast.error("Couldn't delete that message");
    setMsgs((cur) => cur.filter((x) => x.id !== id));
  }

  if (me === null) {
    return (
      <div className="mt-10 text-center">
        <p className="text-sm text-muted-foreground">Sign in to chat with other learners.</p>
        <Link to="/auth" className="mt-3 inline-block rounded-2xl bg-primary px-5 py-2.5 text-sm font-extrabold text-primary-foreground">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-3 flex flex-1 flex-col">
      <div className="flex-1 space-y-2 overflow-y-auto pb-3">
        {loading && (
          <p className="mt-10 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading chat…
          </p>
        )}
        {!loading && msgs.length === 0 && (
          <p className="mt-10 text-center text-sm text-muted-foreground">Say hola — be the first to start the conversation.</p>
        )}
        {msgs.map((m) => {
          const mine = m.user_id === me;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`group max-w-[80%] rounded-2xl px-3 py-2 ${
                  mine ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md border-2 border-border/70 bg-card"
                }`}
              >
                {!mine && (
                  <p className="text-[10px] font-extrabold text-primary">
                    {langById(m.lang_id)?.flag_emoji ?? ""} {m.callsign}
                  </p>
                )}
                <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed">{m.body}</p>
                <div className="mt-0.5 flex items-center justify-end gap-2 text-[9px] font-bold opacity-70">
                  {mine && (
                    <button onClick={() => void remove(m.id)} aria-label="Delete message">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                  {time(m.created_at)}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
        className="sticky bottom-0 flex gap-2 bg-background/95 py-2 pr-24 backdrop-blur"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
          placeholder="Message the community…"
          className="min-w-0 flex-1 rounded-2xl border-2 border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary"
        />
        <button
          type="submit"
          disabled={!text.trim() || sending}
          aria-label="Send message"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground disabled:opacity-50"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </form>
    </div>
  );
}
