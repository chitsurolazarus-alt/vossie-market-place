"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { Result } from "./types";

const emailSchema = z.email("Enter a valid email address").transform((e) => e.trim().toLowerCase());

export async function sendCode(email: string, consent: boolean): Promise<Result> {
  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) return { ok: false, error: "Enter a valid email address" };
  if (!consent) return { ok: false, error: "Please accept the privacy policy to continue" };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: { shouldCreateUser: true, data: { popia_consent: "true" } },
  });
  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("database error") || msg.includes("limited to eduvos")) {
      return { ok: false, error: "Use your Eduvos address: student number @vossie.net, or your @eduvos.com staff email." };
    }
    if (error.code === "over_email_send_rate_limit" || msg.includes("rate limit")) {
      return { ok: false, error: "Too many codes requested. Wait a few minutes and try again." };
    }
    return { ok: false, error: "We couldn't send a code right now. Please try again." };
  }
  return { ok: true };
}

export async function verifyCode(email: string, token: string): Promise<Result> {
  const parsed = emailSchema.safeParse(email);
  if (!parsed.success || !/^\d{6,8}$/.test(token.trim())) {
    return { ok: false, error: "Enter the code from your email" };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email: parsed.data, token: token.trim(), type: "email" });
  if (error) return { ok: false, error: "That code is wrong or has expired. Request a new one." };
  return { ok: true };
}

const DEMO_EMAILS = new Set([
  "admin.demo@eduvos.com", "mentor.demo@eduvos.com", "20250109@vossie.net", "20250110@vossie.net",
  ...Array.from({ length: 8 }, (_, i) => `2025010${i + 1}@vossie.net`),
]);

/** Dev/demo only: enabled solely when DEMO_LOGIN_ENABLED=true. Never enable in production. */
export async function demoLogin(email: string): Promise<Result> {
  if (process.env.DEMO_LOGIN_ENABLED !== "true" || !process.env.DEMO_PASSWORD) {
    return { ok: false, error: "Demo login is disabled" };
  }
  if (!DEMO_EMAILS.has(email)) return { ok: false, error: "Unknown demo account" };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password: process.env.DEMO_PASSWORD });
  return error ? { ok: false, error: "Demo login failed" } : { ok: true };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
