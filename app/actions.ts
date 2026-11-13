"use server";

import { submitPost } from "@/lib/submit";

export type SubmitState =
  | { status: "idle" }
  | { status: "ok" }
  | { status: "error"; message: string; url: string };

export async function submitPostAction(_previous: SubmitState, formData: FormData): Promise<SubmitState> {
  // Same answer as a real success, so a script cannot tell it was caught.
  const website = formData.get("website");
  if (typeof website === "string" && website.length > 0) return { status: "ok" };

  const value = formData.get("url");
  const url = typeof value === "string" ? value.trim() : "";
  if (!url || url.length > 500) return { status: "error", message: "Paste a link to a post on X.", url };

  const result = await submitPost(url);
  return result.ok ? { status: "ok" } : { status: "error", message: result.message, url };
}
