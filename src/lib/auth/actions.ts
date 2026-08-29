"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { supabaseServer } from "../supabase-server";
import { createSession, destroyAllSessionsForUser, destroySession } from "./session";
import { requireAdmin } from "./dal";
import type { UserRole } from "../types";

export interface FormState {
  error?: string;
}

const BCRYPT_ROUNDS = 10;
const MIN_PASSWORD_LENGTH = 8;

export async function login(_prevState: FormState | undefined, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  if (!email || !password) return { error: "Enter your email and password." };

  const { data: profile, error } = await supabaseServer()
    .from("profiles")
    .select("id, password_hash")
    .eq("email", email)
    .maybeSingle();
  if (error || !profile?.password_hash) return { error: "Incorrect email or password." };

  const valid = await bcrypt.compare(password, profile.password_hash);
  if (!valid) return { error: "Incorrect email or password." };

  await createSession(profile.id);

  const next = String(formData.get("next") || "/");
  redirect(next.startsWith("/") ? next : "/");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

export interface CreateUserInput {
  email: string;
  name: string;
  role: UserRole;
  password: string;
}

/** Admin creates an account and sets its initial password directly — no
 * invite email involved. The person just needs to be told the password
 * out of band (chat, in person, etc.). */
export async function createUser(input: CreateUserInput): Promise<FormState | undefined> {
  await requireAdmin();

  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  if (!email || !name) return { error: "Name and email are required." };
  if (input.password.length < MIN_PASSWORD_LENGTH) {
    return { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` };
  }

  const password_hash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  const { error } = await supabaseServer()
    .from("profiles")
    .insert({ email, name, role: input.role, password_hash });
  if (error) {
    if (error.code === "23505") return { error: "A user with this email already exists." };
    return { error: error.message };
  }

  revalidatePath("/admin/users");
}

/** Admin sets a new password for an existing user (forgot-password flow) —
 * also revokes that user's existing sessions so a stolen/old login can't
 * outlive the reset. */
export async function resetUserPassword(userId: string, newPassword: string): Promise<FormState | undefined> {
  await requireAdmin();
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` };
  }

  const password_hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  const { error } = await supabaseServer().from("profiles").update({ password_hash }).eq("id", userId);
  if (error) return { error: error.message };

  await destroyAllSessionsForUser(userId);
  revalidatePath("/admin/users");
}

export async function updateUserRole(userId: string, role: UserRole): Promise<FormState | undefined> {
  await requireAdmin();
  const { error } = await supabaseServer().from("profiles").update({ role }).eq("id", userId);
  if (error) return { error: error.message };
  revalidatePath("/admin/users");
}

export async function removeUser(userId: string): Promise<FormState | undefined> {
  const ctx = await requireAdmin();
  if (userId === ctx.userId) return { error: "You can't remove your own account." };
  const { error } = await supabaseServer().from("profiles").delete().eq("id", userId);
  if (error) return { error: error.message };
  revalidatePath("/admin/users");
}
