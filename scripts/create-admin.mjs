#!/usr/bin/env node
// Bootstraps the very first admin account directly in the database — no
// Supabase Dashboard clicking needed, since this app no longer uses
// Supabase Auth at all. Run once per fresh deployment, after migrations
// have been applied:
//
//   node --env-file=.env.local scripts/create-admin.mjs "Your Name" you@zekindo.co.id "a-strong-password"
//
// After this, invite/manage every other user from /admin/users in the app.

import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

const [name, email, password] = process.argv.slice(2);

if (!name || !email || !password) {
  console.error('Usage: node --env-file=.env.local scripts/create-admin.mjs "Full Name" email@example.com password');
  process.exit(1);
}
if (password.length < 8) {
  console.error("Password must be at least 8 characters.");
  process.exit(1);
}

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first (e.g. run with --env-file=.env.local).");
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

const password_hash = await bcrypt.hash(password, 10);
const { data, error } = await supabase
  .from("profiles")
  .insert({ email: email.trim().toLowerCase(), name: name.trim(), role: "admin", password_hash })
  .select("id, email, name")
  .single();

if (error) {
  console.error("Failed to create admin:", error.message);
  process.exit(1);
}

console.log(`Admin created: ${data.name} <${data.email}> (id ${data.id}). Sign in at /login.`);
