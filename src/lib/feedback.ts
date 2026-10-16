import { supabase } from "@/integrations/supabase/client";

export type FeedbackMood = "love" | "idea" | "bug" | "confused";
export const MOODS: { id: FeedbackMood; emoji: string; label: string }[] = [
  { id: "love", emoji: "😍", label: "Love it" },
  { id: "idea", emoji: "💡", label: "Idea" },
  { id: "bug", emoji: "🐞", label: "Something broke" },
  { id: "confused", emoji: "🤔", label: "Confusing" },
];

export type FeedbackItem = {
  id: string;
  user_id: string;
  mood: string;
  rating: number | null;
  body: string;
  page: string;
  created_at: string;
};

export type FeedbackInbox = {
  isAdmin: boolean;
  items: FeedbackItem[];
};

export async function sendFeedback(input: { mood: FeedbackMood; rating: number | null; body: string; page: string }) {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("signed-out");
  const { error } = await supabase.from("feedback").insert({
    user_id: data.user.id,
    mood: input.mood,
    rating: input.rating,
    body: input.body.trim().slice(0, 2000),
    page: input.page.slice(0, 200),
  });
  if (error) throw error;
}

export async function listFeedbackInbox(): Promise<FeedbackInbox> {
  const [{ data: auth }, { data: roles, error: roleError }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("user_roles").select("role").eq("role", "admin").limit(1),
  ]);
  if (!auth.user) throw new Error("signed-out");
  if (roleError) throw roleError;
  const isAdmin = (roles ?? []).some((role) => role.role === "admin");
  const { data, error } = await supabase
    .from("feedback")
    .select("id,user_id,mood,rating,body,page,created_at")
    .order("created_at", { ascending: false })
    .limit(isAdmin ? 250 : 50);
  if (error) throw error;
  return { isAdmin, items: data ?? [] };
}

export async function deleteFeedback(id: string) {
  const { error } = await supabase.from("feedback").delete().eq("id", id);
  if (error) throw error;
}
