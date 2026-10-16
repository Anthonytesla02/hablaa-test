import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  Archive,
  Bell,
  ChevronDown,
  ChevronRight,

  Dumbbell,
  LogOut,
  Music,
  ShoppingBag,
  Trophy,
  Users,
  Volume2,
} from "lucide-react";
import { toast } from "sonner";
import { createPost } from "@/lib/feed";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MOODS, deleteFeedback, listFeedbackInbox } from "@/lib/feedback";
import { AppFrame, Hydrated } from "@/components/AppFrame";
import { gamification, langById, onboarding } from "@/lib/content";
import { useApp, useLevel } from "@/lib/store";
import { useCompanion } from "@/lib/use-companion";
import { setSfxMuted, sfxMuted, sfx } from "@/lib/sfx";
import { useHandler } from "@/lib/handler-bus";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { getPushConfig, sendTestPush } from "@/lib/push.functions";
import { disablePush, enablePush, pushStatus } from "@/lib/onesignal";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Your Profile — Habla" },
      {
        name: "description",
        content:
          "Your level, badges, streak history and every setting for the app — tutor, voice speed, captions and sounds.",
      },
      { property: "og:title", content: "Your Profile — Habla" },
      { property: "og:description", content: "Level, badges, settings and session history." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <Hydrated>
      <ProfilePage />
    </Hydrated>
  ),
});

function ProfilePage() {
  const navigate = useNavigate();
  const profile = useApp((s) => s.profile);
  const badges = useApp((s) => s.badges);
  const history = useApp((s) => s.history);
  const streak = useApp((s) => s.streak);
  const longest = useApp((s) => s.longestStreak);
  const xp = useApp((s) => s.xp);
  const credits = useApp((s) => s.credits);
  const settings = useApp((s) => s.settings);
  const setSetting = useApp((s) => s.setSetting);
  const resetAll = useApp((s) => s.resetAll);
  const level = useLevel();
  const { character, personality, memory } = useCompanion();
  const tutorMuted = useHandler((s) => s.muted);
  const toggleTutorMute = useHandler((s) => s.toggleMute);
  const [soundOff, setSoundOff] = useState(false);
  const [posting, setPosting] = useState(false);

  useEffect(() => setSoundOff(sfxMuted()), []);
  useEffect(() => {
    if (!profile) void navigate({ to: "/start" });
  }, [profile, navigate]);
  if (!profile) return null;

  const lang = langById(profile.langId);
  const focus = onboarding.operational_personas.find((p) => p.id === profile.personaId);
  const allBadges = gamification.badges as { id: string; label: string; unlock_condition: string }[];

  async function postStreak() {
    sfx("tap");
    setPosting(true);
    try {
      await createPost({
        kind: "streak",
        callsign: profile?.callsign ?? "Learner",
        body: `${streak} days in a row with ${character?.name ?? "my tutor"}.`,
        stats: {
          flag: lang?.flag_emoji ?? "🇪🇸",
          title: `${lang?.label ?? "Spanish"} streak`,
          streak,
          longest,
          xp,
          level: level.current.codename,
        },
      });
      sfx("complete");
      toast.success("Posted to the community feed");
      void navigate({ to: "/feed" });
    } catch {
      toast.error("Could not post right now");
    } finally {
      setPosting(false);
    }
  }


  return (
    <AppFrame>
      <section className="paper-card p-4">
        <div className="flex items-center gap-3">
          {character && (
            <img
              src={character.avatar}
              alt={character.name}
              width={512}
              height={512}
              className="h-16 w-16 rounded-full border-2 border-primary object-cover"
            />
          )}
          <div className="min-w-0">
            <h1 className="truncate text-xl font-extrabold">{profile.callsign}</h1>
            <p className="text-[12px] font-bold text-secondary">
              {lang?.flag_emoji} {lang?.label} · {level.current.codename}
            </p>
            <p className="text-[11px] text-muted-foreground">Learning for: {focus?.label}</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Stat label="XP" value={String(xp)} />
          <Stat label="Streak" value={`${streak}d`} sub={`best ${longest}`} />
          <Stat label="Coins" value={String(credits)} />
        </div>
        <p className="mt-3 text-xs">{level.current.can_do_summary}</p>
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => void postStreak()}
            disabled={posting}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-primary py-2.5 text-[11px] font-extrabold text-primary-foreground disabled:opacity-60"
          >
            <Users className="h-3.5 w-3.5" /> {posting ? "Posting…" : "Post my streak"}
          </button>
          <Link
            to="/feed"
            onClick={() => sfx("tap")}
            className="flex items-center justify-center rounded-2xl border-2 border-border px-3 text-[11px] font-extrabold text-muted-foreground"
          >
            See feed
          </Link>
        </div>
      </section>

      <Fold title="Account & preferences" subtitle="Name, email, daily goal and focus">
        <AccountSection />
      </Fold>

      <Link
        to="/companion"
        onClick={() => sfx("tap")}
        className="mt-4 flex items-center gap-3 rounded-2xl border-2 border-border bg-card p-3"
      >
        {character && (
          <img
            src={character.avatar}
            alt={character.name}
            width={512}
            height={512}
            loading="lazy"
            className="h-12 w-12 rounded-full border-2 border-border object-cover"
          />
        )}
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-extrabold text-muted-foreground">Your tutor</span>
          <span className="block text-sm font-extrabold">
            {character ? `${character.flag} ${character.name}` : "Pick a tutor"} · {personality.emoji}{" "}
            {personality.label}
          </span>
          <span className="mt-0.5 block text-[11px] text-muted-foreground">
            {character?.teaches ?? "Choose who teaches you and how."}
          </span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </Link>

      {memory.length > 0 && (
        <Fold
          title={`What ${character ? character.name : "your tutor"} remembers`}
          subtitle={`${memory.length} note${memory.length === 1 ? "" : "s"} — they come back until they stick`}
        >
          <ul className="space-y-1.5">
            {memory.map((m) => (
              <li key={m} className="text-[11px] text-muted-foreground">
                • {m}
              </li>
            ))}
          </ul>
        </Fold>
      )}

      <section className="mt-6">
        <p className="text-[11px] font-extrabold text-muted-foreground">Shortcuts</p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <Shortcut to="/vault" icon={Dumbbell} label="Practice" />
          <Shortcut to="/feed" icon={Users} label="Feed" />
          <Shortcut to="/league" icon={Trophy} label="League" />
          <Shortcut to="/shop" icon={ShoppingBag} label="Shop" />
        </div>
        <Link
          to="/backup"
          onClick={() => sfx("tap")}
          className="mt-2 flex items-center gap-3 rounded-2xl border-2 border-border bg-card px-3 py-3"
        >
          <Archive className="h-5 w-5 text-secondary" />
          <span className="min-w-0 flex-1">
            <span className="block text-[12px] font-extrabold">Backup &amp; restore</span>
            <span className="block text-[10px] text-muted-foreground">
              Save your progress to a file or bring one in.
            </span>
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      </section>


      <Fold
        title="Settings"
        subtitle={`Voice speed ${settings.rate.toFixed(2)}× · captions ${settings.captions ? "on" : "off"}`}
      >
        <div className="space-y-4">
          <label className="block">
            <span className="text-[12px] font-extrabold">
              Voice speed · {settings.rate.toFixed(2)}×
            </span>
            <input
              type="range"
              min={0.6}
              max={1.3}
              step={0.05}
              value={settings.rate}
              onChange={(e) => setSetting("rate", Number(e.target.value))}
              className="mt-2 w-full accent-[oklch(0.72_0.17_35)]"
            />
          </label>
          <Row
            label="Show captions"
            note="See what's being said in the language you're learning."
            on={settings.captions}
            set={(v) => setSetting("captions", v)}
          />
          <Row
            label="Interface sounds"
            icon={Music}
            note="Clicks, pops and celebration sounds."
            on={!soundOff}
            set={(v) => {
              setSfxMuted(!v);
              setSoundOff(!v);
              if (v) sfx("tap");
            }}
          />
          <Row
            label="Tutor voice"
            icon={Volume2}
            note="Let your tutor read things out loud."
            on={!tutorMuted}
            set={() => toggleTutorMute()}
          />
          <PushRow />
        </div>
      </Fold>

      <Fold title="Badges" subtitle={`${badges.length} of ${allBadges.length} earned`}>
        <ul className="grid grid-cols-2 gap-2">
          {allBadges.map((b) => {
            const earned = badges.includes(b.id);
            return (
              <li
                key={b.id}
                className={`rounded-2xl border-2 px-3 py-2.5 ${
                  earned ? "border-primary/60 bg-primary/10" : "border-border bg-card opacity-50"
                }`}
              >
                <span className="block text-[12px] font-extrabold">{b.label}</span>
                <span className="mt-1 block text-[10px] text-muted-foreground">
                  {b.unlock_condition}
                </span>
              </li>
            );
          })}
        </ul>
      </Fold>

      <Fold title="Recent sessions" subtitle={history.length > 0 ? `${history.length} saved` : "Nothing yet"}>
        <ul className="space-y-1.5">
          {history.map((h, i) => (
            <li
              key={i}
              className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-2xl border-2 border-border bg-card px-3 py-2"
            >
              <span className="truncate text-[11px] font-bold">
                {new Date(h.date).toLocaleDateString()} · {Math.round(h.accuracy * 100)}% ·{" "}
                {h.items} items
              </span>
              <span className="shrink-0 text-[11px] font-extrabold text-primary">+{h.xp} XP</span>
            </li>
          ))}
          {history.length === 0 && (
            <li className="text-xs text-muted-foreground">No sessions yet — go say hello!</li>
          )}
        </ul>
      </Fold>

      <FeedbackFold />


      <button
        onClick={async () => {
          sfx("tap");
          await supabase.auth.signOut();
          void navigate({ to: "/auth" });
        }}
        className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-border py-3 text-[12px] font-extrabold text-muted-foreground"
      >
        <LogOut className="h-4 w-4" /> Sign out
      </button>

      <button
        onClick={() => {
          if (confirm("Start over? All progress on this device is erased.")) {
            resetAll();
            void navigate({ to: "/start" });
          }
        }}
        className="mt-3 w-full rounded-2xl border-2 border-destructive/50 py-3 text-[12px] font-extrabold text-destructive"
      >
        Reset my progress
      </button>
    </AppFrame>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl bg-background/60 py-2">
      <p className="text-base font-extrabold">{value}</p>
      <p className="text-[10px] font-bold text-muted-foreground">{sub ? `${label} · ${sub}` : label}</p>
    </div>
  );
}

function Shortcut({
  to,
  icon: Icon,
  label,
}: {
  to: "/vault" | "/league" | "/shop" | "/feed";
  icon: typeof Dumbbell;
  label: string;
}) {
  return (
    <Link
      to={to}
      onClick={() => sfx("tap")}
      className="flex flex-col items-center gap-1 rounded-2xl border-2 border-border bg-card py-3 text-[11px] font-extrabold"
    >
      <Icon className="h-5 w-5 text-secondary" />
      {label}
    </Link>
  );
}

function Row({
  label,
  note,
  on,
  set,
  icon: Icon,
}: {
  label: string;
  note: string;
  on: boolean;
  set: (v: boolean) => void;
  icon?: typeof Music;
}) {
  return (
    <button
      onClick={() => set(!on)}
      className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 text-left"
    >
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 text-[12px] font-extrabold">
          {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
          {label}
        </span>
        <span className="mt-0.5 block text-[11px] text-muted-foreground">{note}</span>
      </span>
      <span
        className={`h-6 w-11 shrink-0 rounded-full border-2 transition-colors ${
          on ? "border-primary bg-primary/30" : "border-border bg-muted"
        }`}
      >
        <span
          className={`mt-[2px] block h-4 w-4 rounded-full transition-transform ${
            on ? "translate-x-5 bg-primary" : "translate-x-1 bg-muted-foreground"
          }`}
        />
      </span>
    </button>
  );
}

const PUSH_COPY: Record<string, string> = {
  "open-in-new-tab": "Open the app in its own browser tab to turn on notifications.",
  denied: "Notifications are blocked — allow them in your browser's site settings.",
  "not-configured": "Notifications aren't set up yet.",
  unsupported: "This browser doesn't support notifications.",
  "needs-web-setup": "Notifications need one more setup step in OneSignal for this website address.",
};

function PushRow() {
  const getConfig = useServerFn(getPushConfig);
  const testPush = useServerFn(sendTestPush);
  const [appId, setAppId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [on, setOn] = useState(false);

  useEffect(() => {
    void (async () => {
      const [{ appId: id }, { data }] = await Promise.all([getConfig(), supabase.auth.getUser()]);
      setAppId(id);
      setUserId(data.user?.id ?? null);
      if (id && data.user) setOn(await pushStatus(id, data.user.id).catch(() => false));
    })();
  }, [getConfig]);

  return (
    <Row
      label="Practice reminders"
      icon={Bell}
      note="Get a push notification so you never lose your streak."
      on={on}
      set={async (v) => {
        try {
          if (!userId) return;
          const r = v ? await enablePush(appId, userId) : await disablePush(appId);
          setOn(r === "on");
          if (r === "on") {
            toast.success("Reminders on!");
            void testPush().catch(() => undefined);
          } else if (PUSH_COPY[r]) toast(PUSH_COPY[r]);
        } catch (e) {
          toast.error((e as Error).message || "Couldn't change notifications.");
        }
      }}
    />
  );
}

function AccountSection() {
  const profile = useApp((s) => s.profile);
  const setProfile = useApp((s) => s.setProfile);
  const [email, setEmail] = useState("");
  const [name, setName] = useState(profile?.callsign ?? "");
  const [newEmail, setNewEmail] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? "");
      setNewEmail(data.user?.email ?? "");
    });
  }, []);
  if (!profile) return null;

  const tiers = onboarding.daily_commitment_tiers as { id: string; label: string; minutes: number }[];
  const personas = onboarding.operational_personas as { id: string; label: string }[];
  const field = "h-11 w-full rounded-xl border-2 border-input bg-card px-3 text-sm font-bold outline-none focus:border-primary";
  const update = (patch: Partial<typeof profile>) => setProfile({ ...profile, ...patch });

  async function save() {
    sfx("tap");
    const trimmed = name.trim().slice(0, 24);
    if (!trimmed) {
      toast.error("Your name can't be empty");
      return;
    }
    setSaving(true);
    try {
      if (trimmed !== profile!.callsign) update({ callsign: trimmed });
      const nextEmail = newEmail.trim();
      if (nextEmail && nextEmail !== email) {
        const { error } = await supabase.auth.updateUser({ email: nextEmail });
        if (error) throw error;
        toast.success("Check both inboxes to confirm your new email");
      } else {
        toast.success("Account saved");
      }
    } catch (e) {
      toast.error((e as Error).message || "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="space-y-3">
        <label className="block">
          <span className="text-[11px] font-extrabold">Name</span>
          <input value={name} maxLength={24} onChange={(e) => setName(e.target.value)} className={field} />
        </label>
        <label className="block">
          <span className="text-[11px] font-extrabold">Email</span>
          <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className={field} />
        </label>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="w-full rounded-2xl bg-primary py-2.5 text-[11px] font-extrabold text-primary-foreground disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save account"}
        </button>
      </div>

      <p className="mt-5 text-[11px] font-extrabold text-muted-foreground">Preferences</p>
      <div className="mt-3 space-y-3">
        <label className="block">
          <span className="text-[11px] font-extrabold">Daily goal</span>
          <select value={profile.tierId} onChange={(e) => { update({ tierId: e.target.value }); toast.success("Daily goal updated"); }} className={field}>
            {tiers.map((t) => (
              <option key={t.id} value={t.id}>{t.minutes} minutes a day</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-[11px] font-extrabold">Learning for</span>
          <select value={profile.personaId} onChange={(e) => { update({ personaId: e.target.value }); toast.success("Focus updated"); }} className={field}>
            {personas.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}

function Fold({
  title,
  subtitle,
  defaultOpen = false,
  children,
}: {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="mt-4 overflow-hidden rounded-2xl border-2 border-border bg-card">
      <button
        onClick={() => {
          sfx("tap");
          setOpen(!open);
        }}
        className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-3 text-left"
      >
        <span className="min-w-0">
          <span className="block text-[12px] font-extrabold">{title}</span>
          {subtitle && (
            <span className="mt-0.5 block text-[11px] text-muted-foreground">{subtitle}</span>
          )}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && <div className="border-t-2 border-border p-3">{children}</div>}
    </section>
  );
}

function FeedbackFold() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["feedback-inbox"], queryFn: listFeedbackInbox });
  const items = data?.items ?? [];
  const isAdmin = data?.isAdmin ?? false;
  return (
    <Fold
      title={isAdmin ? "All feedback" : "My feedback"}
      subtitle={items.length > 0 ? `${items.length} ${isAdmin ? "received" : "sent"}` : isAdmin ? "Nothing received yet" : "Nothing sent yet"}
    >
      {isLoading && <p className="text-xs text-muted-foreground">Loading…</p>}
      <ul className="space-y-2">
        {items.map((f) => {
          const m = MOODS.find((x) => x.id === f.mood);
          return (
            <li key={f.id} className="rounded-2xl border-2 border-border bg-card p-3">
              <div className="flex items-center justify-between gap-2 text-[11px] font-extrabold">
                <span>
                  {m?.emoji} {m?.label ?? f.mood}
                  {f.rating ? ` · ${"★".repeat(f.rating)}` : ""}
                </span>
                <span className="text-muted-foreground">{new Date(f.created_at).toLocaleDateString()}</span>
              </div>
              <p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-relaxed">{f.body}</p>
               {isAdmin && (
                 <p className="mt-1 text-[10px] text-muted-foreground">
                   From learner {f.user_id.slice(0, 8)} · Page {f.page || "/"}
                 </p>
               )}
              <button
                onClick={async () => {
                  try {
                    await deleteFeedback(f.id);
                    await qc.invalidateQueries({ queryKey: ["feedback-inbox"] });
                  } catch {
                    toast.error("Couldn't delete that");
                  }
                }}
                className="mt-2 text-[10px] font-extrabold text-muted-foreground underline"
              >
                Delete
              </button>
            </li>
          );
        })}
        {!isLoading && items.length === 0 && (
          <li className="text-xs text-muted-foreground">Tap the Feedback button anytime to tell us what you think.</li>
        )}
      </ul>
    </Fold>
  );
}
