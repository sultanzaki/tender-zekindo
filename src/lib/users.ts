import "server-only";
import { supabaseServer } from "./supabase-server";
import type { Profile } from "./types";

export async function getAllProfiles(): Promise<Profile[]> {
  const { data, error } = await supabaseServer()
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Failed to load users: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    createdAt: row.created_at,
  }));
}

export async function getProfilesByIds(ids: string[]): Promise<Map<string, Profile>> {
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0) return new Map();
  const { data, error } = await supabaseServer().from("profiles").select("*").in("id", uniqueIds);
  if (error) throw new Error(`Failed to load users: ${error.message}`);
  const map = new Map<string, Profile>();
  (data ?? []).forEach((row) => {
    map.set(row.id, { id: row.id, email: row.email, name: row.name, role: row.role, createdAt: row.created_at });
  });
  return map;
}
