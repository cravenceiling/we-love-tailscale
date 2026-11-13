import type { Post } from "@/lib/posts";

// Length of what the reader sees as words, ignoring link text, so a post
// that is mostly a URL is still set at the size of its sentence.
export function wordLength(post: Post): number {
  return post.parts.reduce((sum, part) => sum + (part.type === "url" ? 0 : part.text.trim().length), 0);
}

export type Size = "display" | "large" | "body";

export function sizeFor(post: Post): Size {
  const length = wordLength(post);
  if (length <= 64) return "display";
  if (length <= 150) return "large";
  return "body";
}
