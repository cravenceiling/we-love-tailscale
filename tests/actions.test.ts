import { beforeEach, expect, it, vi } from "vitest";
import { submitPostAction } from "../app/actions";
import { submitPost } from "../lib/submit";

vi.mock("../lib/submit", () => ({ submitPost: vi.fn() }));

const idle = { status: "idle" } as const;
const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
};

beforeEach(() => {
  vi.mocked(submitPost).mockReset().mockResolvedValue({ ok: true, prUrl: "https://github.com/example/pull/1" });
});

it("trims the link and reports success without exposing the pull request", async () => {
  expect(await submitPostAction(idle, form({ url: "  https://x.com/a/status/1  " }))).toEqual({ status: "ok" });
  expect(submitPost).toHaveBeenCalledExactlyOnceWith("https://x.com/a/status/1");
});

it("answers a filled honeypot exactly like a success without submitting", async () => {
  expect(await submitPostAction(idle, form({ url: "https://x.com/a/status/1", website: "spam" }))).toEqual({ status: "ok" });
  expect(submitPost).not.toHaveBeenCalled();
});

it.each([["empty", ""], ["too long", `https://x.com/a/status/1?${"a".repeat(500)}`]])("rejects an %s link and keeps it in the field", async (_, url) => {
  expect(await submitPostAction(idle, form({ url }))).toEqual({ status: "error", message: "Paste a link to a post on X.", url });
  expect(submitPost).not.toHaveBeenCalled();
});

it("returns the visitor's link with the error so the field keeps it", async () => {
  vi.mocked(submitPost).mockResolvedValueOnce({ ok: false, message: "That post doesn't mention Tailscale." });

  expect(await submitPostAction(idle, form({ url: "https://x.com/a/status/1" }))).toEqual({
    status: "error", message: "That post doesn't mention Tailscale.", url: "https://x.com/a/status/1",
  });
});

it("treats a file in place of the link as an empty link", async () => {
  const data = new FormData();
  data.set("url", new Blob(["x"]));

  expect(await submitPostAction(idle, data)).toEqual({ status: "error", message: "Paste a link to a post on X.", url: "" });
});
