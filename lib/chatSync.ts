import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Playground chat sync — localStorage stays the fast local cache, Supabase
 * (RLS-scoped `chats` table) is the cross-device source of truth for
 * signed-in users. Merge rule: per chat id, newest `updated` wins.
 */

export type SyncMsg = {
  role: "user" | "assistant";
  content: string;
  images?: string[];
  costNpr?: number | null;
  model?: string;
};
export type SyncChat = { id: string; title: string; messages: SyncMsg[]; updated: number };

/** Base64 image payloads are megabytes each — replace with a count marker. */
function lean(messages: SyncMsg[]): SyncMsg[] {
  return messages.map((m) => {
    // Drop heavy per-message payloads before syncing to the DB: base64 images,
    // extracted PDF text, and PDF data URLs (kept only in the live/local cache).
    const heavy = m as SyncMsg & { docText?: string; attachments?: { name: string; pages: number; url?: string }[] };
    const hasHeavy = !!m.images?.length || !!heavy.docText || !!heavy.attachments?.some((a) => a.url);
    if (!hasHeavy) return m;
    const { images: _drop, docText: _drop2, attachments, ...rest } = heavy;
    return {
      ...rest,
      content: m.content || "(attachment)",
      ...(attachments ? { attachments: attachments.map(({ url: _u, ...a }) => a) } : {}),
    };
  });
}

/**
 * Publish a read-only snapshot of a chat and return its unguessable slug.
 * Anyone with the slug can view it at /share/<slug> (public SELECT RLS).
 */
export async function publishChat(sb: SupabaseClient, userId: string, c: SyncChat): Promise<string> {
  const slug =
    Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
  const { error } = await sb.from("shared_chats").insert({
    id: slug,
    user_id: userId,
    title: c.title,
    messages: lean(c.messages),
  });
  if (error) throw error;
  return slug;
}

export async function pushChat(sb: SupabaseClient, userId: string, c: SyncChat) {
  await sb.from("chats").upsert(
    {
      id: c.id,
      user_id: userId,
      title: c.title,
      messages: lean(c.messages),
      updated_at: new Date(c.updated).toISOString(),
    },
    { onConflict: "user_id,id" },
  );
}

export async function pullChats(sb: SupabaseClient): Promise<SyncChat[]> {
  const { data, error } = await sb
    .from("chats")
    .select("id,title,messages,updated_at")
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error || !data) return [];
  return data.map((r) => ({
    id: r.id as string,
    title: (r.title as string) ?? "New chat",
    messages: (r.messages ?? []) as SyncMsg[],
    updated: new Date(r.updated_at as string).getTime(),
  }));
}

export async function removeChat(sb: SupabaseClient, id: string) {
  await sb.from("chats").delete().eq("id", id);
}

export function mergeChats<T extends SyncChat>(local: T[], remote: SyncChat[]): T[] {
  const map = new Map<string, SyncChat>();
  for (const c of remote) map.set(c.id, c);
  for (const c of local) {
    const r = map.get(c.id);
    if (!r || c.updated > r.updated) map.set(c.id, c);
  }
  return [...map.values()].sort((a, b) => b.updated - a.updated).slice(0, 50) as T[];
}
