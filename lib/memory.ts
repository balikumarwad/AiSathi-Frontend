import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Persistent per-user memory (ChatGPT/Claude-style). Short facts the assistant
 * should remember across conversations, stored RLS-scoped in Supabase and
 * injected into the system prompt of future chats.
 */

export type Memory = { id: string; content: string };

export async function loadMemories(sb: SupabaseClient): Promise<Memory[]> {
  const { data, error } = await sb
    .from("user_memories")
    .select("id,content")
    .order("created_at", { ascending: true })
    .limit(100);
  if (error || !data) return [];
  return data.map((r) => ({ id: r.id as string, content: r.content as string }));
}

export async function addMemory(sb: SupabaseClient, userId: string, content: string): Promise<Memory | null> {
  const { data, error } = await sb
    .from("user_memories")
    .insert({ user_id: userId, content })
    .select("id,content")
    .maybeSingle();
  if (error || !data) return null;
  return { id: data.id as string, content: data.content as string };
}

export async function deleteMemory(sb: SupabaseClient, id: string) {
  await sb.from("user_memories").delete().eq("id", id);
}
