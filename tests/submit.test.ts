import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getTweet, type Tweet } from "react-tweet/api";
import { submitPost } from "../lib/submit";
import recordedTweet from "./fixtures/tweet";

const id = "1583156629163282433";
const url = `https://x.com/example/status/${id}`;
const api = "https://api.github.com/repos/cravenceiling/we-love-tailscale/";
const prUrl = "https://github.com/cravenceiling/we-love-tailscale/pull/42";
const fixture: Tweet = {
  ...recordedTweet,
  text: "Tailscale makes this easy.",
  user: { ...recordedTweet.user, name: "Example Reader", screen_name: "example" },
  entities: { hashtags: [], symbols: [], ...recordedTweet.entities },
};
const fetchMock = vi.fn<typeof fetch>();

vi.mock("react-tweet/api", () => ({ getTweet: vi.fn() }));
vi.mock("../data/x-posts.json", () => ({ default: ["1", "2", "3"] }));

beforeEach(() => {
  vi.mocked(getTweet).mockReset().mockResolvedValue(structuredClone(fixture));
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("GITHUB_SUBMIT_TOKEN", "test-token");
  vi.spyOn(console, "error").mockImplementation(() => {});
  fetchMock
    .mockResolvedValueOnce(Response.json({ object: { sha: "main-sha" } }))
    .mockResolvedValueOnce(Response.json({}, { status: 201 }))
    .mockResolvedValueOnce(Response.json({
      sha: "file-sha",
      content: Buffer.from('["10", "20", "30"]\n').toString("base64"),
    }))
    .mockResolvedValueOnce(Response.json({}))
    .mockResolvedValueOnce(Response.json({ html_url: prUrl }, { status: 201 }));
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it.each([
  "not a URL",
  "https://example.com/example/status/999",
  "https://x.com.example.com/example/status/999",
  "https://www.mobile.x.com/example/status/999",
  "ftp://x.com/example/status/999",
  "https://x.com/example",
  "https://x.com/example/status/nope",
  "https://x.com/example/status/999nope",
  "https://x.com/example/status/",
  "https://x.com/example/likes/999",
  "https://x.com/example/status/0001583156629163282433",
  "https://x.com/example/status/15831566291632824330000",
])("rejects a link without an X post path: %s", async (input) => {
  expect(await submitPost(input)).toEqual({ ok: false, message: "Paste a link to a post on X." });
  expect(getTweet).not.toHaveBeenCalled();
  expect(fetchMock).not.toHaveBeenCalled();
});

it.each(["x.com", "www.x.com", "mobile.x.com", "twitter.com", "www.twitter.com", "mobile.twitter.com"])("accepts post links on %s with trailing segments, query and hash", async (host) => {
  expect(await submitPost(`https://${host}/example/status/${id}/photo/1?s=20#post`)).toEqual({ ok: true, prUrl });
  expect(getTweet).toHaveBeenCalledExactlyOnceWith(id, { signal: expect.any(AbortSignal) });
});

it("accepts the /i/web/status/ form X uses in shared links", async () => {
  expect(await submitPost(`https://x.com/i/web/status/${id}`)).toEqual({ ok: true, prUrl });
  expect(getTweet).toHaveBeenCalledExactlyOnceWith(id, { signal: expect.any(AbortSignal) });
});

it("rejects a post already on the wall before calling X", async () => {
  expect(await submitPost("https://x.com/example/status/2")).toEqual({ ok: false, message: "That post is already on the wall." });
  expect(getTweet).not.toHaveBeenCalled();
  expect(fetchMock).not.toHaveBeenCalled();
});

it("reports a private or deleted post", async () => {
  vi.mocked(getTweet).mockResolvedValueOnce(undefined);

  expect(await submitPost(url)).toEqual({ ok: false, message: "That post is private or was deleted." });
  expect(fetchMock).not.toHaveBeenCalled();
});

it("logs X failures and asks the visitor to try again", async () => {
  const error = new Error("X is unavailable");
  vi.mocked(getTweet).mockRejectedValueOnce(error);

  expect(await submitPost(url)).toEqual({ ok: false, message: "X didn't answer. Try again in a minute." });
  expect(console.error).toHaveBeenCalledExactlyOnceWith("Submitted X post could not be loaded", { id, error });
  expect(fetchMock).not.toHaveBeenCalled();
});

it("rejects a post without a Tailscale mention", async () => {
  vi.mocked(getTweet).mockResolvedValueOnce({ ...fixture, text: "A nice day." });

  expect(await submitPost(url)).toEqual({ ok: false, message: "That post doesn't mention Tailscale." });
  expect(fetchMock).not.toHaveBeenCalled();
});

it("accepts a reply to Tailscale", async () => {
  vi.mocked(getTweet).mockResolvedValueOnce({ ...fixture, text: "So handy!", in_reply_to_screen_name: "TailScale" });

  expect(await submitPost(url)).toEqual({ ok: true, prUrl });
});

it("accepts Tailscale mentioned in a quoted post", async () => {
  vi.mocked(getTweet).mockResolvedValueOnce({
    ...fixture,
    text: "Exactly this!",
    quoted_tweet: { ...fixture, reply_count: 0, retweet_count: 0, self_thread: { id_str: "123" } },
  });

  expect(await submitPost(url)).toEqual({ ok: true, prUrl });
});

it("reports when submissions are not configured", async () => {
  vi.stubEnv("GITHUB_SUBMIT_TOKEN", undefined);

  expect(await submitPost(url)).toEqual({ ok: false, message: "Submissions are closed right now." });
  expect(console.error).toHaveBeenCalledExactlyOnceWith("GITHUB_SUBMIT_TOKEN is not configured");
  expect(fetchMock).not.toHaveBeenCalled();
});

it("reports an existing submission branch without removing it", async () => {
  fetchMock.mockReset()
    .mockResolvedValueOnce(Response.json({ object: { sha: "main-sha" } }))
    .mockResolvedValueOnce(Response.json({}, { status: 422 }));

  expect(await submitPost(url)).toEqual({ ok: false, message: "That post is already waiting for review." });
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it("tells the reviewer about attached media", async () => {
  vi.mocked(getTweet).mockResolvedValueOnce({
    ...structuredClone(fixture),
    mediaDetails: [{ type: "photo" }, { type: "photo" }, { type: "animated_gif" }] as Tweet["mediaDetails"],
  });
  await submitPost(url);
  expect(JSON.parse(String(fetchMock.mock.calls[4][1]?.body)).body)
    .toContain("Attached: 2 photos and 1 video, shown on the wall. Check the media on X before merging.");

  fetchMock.mockReset()
    .mockResolvedValueOnce(Response.json({ object: { sha: "main-sha" } }))
    .mockResolvedValueOnce(Response.json({}, { status: 201 }))
    .mockResolvedValueOnce(Response.json({ sha: "file-sha", content: Buffer.from("[]").toString("base64") }))
    .mockResolvedValueOnce(Response.json({}))
    .mockResolvedValueOnce(Response.json({ html_url: prUrl }, { status: 201 }));
  vi.mocked(getTweet).mockResolvedValueOnce({
    ...structuredClone(fixture),
    possibly_sensitive: true,
    mediaDetails: [{ type: "video" }] as Tweet["mediaDetails"],
  });
  await submitPost(url);
  expect(JSON.parse(String(fetchMock.mock.calls[4][1]?.body)).body)
    .toContain("Attached: 1 video. X marks the post as possibly sensitive, so the wall leaves the media out.");
});

it("adds the post at its distributed position and opens a pull request with the text kept literal", async () => {
  vi.mocked(getTweet).mockResolvedValueOnce({
    ...fixture,
    lang: "ja",
    text: "Tailscale thanks @someone #123 [docs](https://example.com) ![](https://example.com/a.png)\n```js``` &amp;lt;3",
    user: { ...fixture.user, name: "Reader @team #789" },
  });

  expect(await submitPost(url)).toEqual({ ok: true, prUrl });

  const content = '[\n  "10",\n  "1583156629163282433",\n  "20",\n  "30"\n]\n';
  const body = [
    "````text\nTailscale thanks @someone #123 [docs](https://example.com) ![](https://example.com/a.png)\n```js``` &lt;3\n````",
    `Posted by [example](https://x.com/example) on ${fixture.created_at}, ${fixture.favorite_count} likes. [View the post](${url}).`,
    "Submitted through the form on the site.",
    "- [ ] Add an English translation to data/translations.json (post language: ja)",
  ].join("\n\n");
  const headers = {
    Authorization: "Bearer test-token",
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "we-love-tailscale",
    "Content-Type": "application/json",
  };
  expect(fetchMock.mock.calls).toEqual([
    [`${api}git/ref/heads/main`, { headers, cache: "no-store" }],
    [`${api}git/refs`, {
      method: "POST", headers, cache: "no-store",
      body: JSON.stringify({ ref: `refs/heads/submit/${id}`, sha: "main-sha" }),
    }],
    [`${api}contents/data/x-posts.json?ref=submit/${id}`, { headers, cache: "no-store" }],
    [`${api}contents/data/x-posts.json`, {
      method: "PUT", headers, cache: "no-store",
      body: JSON.stringify({ message: `Add X post ${id}`, branch: `submit/${id}`, sha: "file-sha", content: Buffer.from(content).toString("base64") }),
    }],
    [`${api}pulls`, {
      method: "POST", headers, cache: "no-store",
      body: JSON.stringify({ title: "Add a post by example", head: `submit/${id}`, base: "main", body }),
    }],
  ]);
  const put = JSON.parse(String(fetchMock.mock.calls[3][1]?.body));
  expect(Buffer.from(put.content, "base64").toString("utf8")).toBe(content);
});

it.each(["en", "und", "zh-cn"])("omits the translation checkbox for %s", async (lang) => {
  vi.mocked(getTweet).mockResolvedValueOnce({ ...fixture, lang });

  expect(await submitPost(url)).toEqual({ ok: true, prUrl });
  expect(JSON.parse(String(fetchMock.mock.calls[4][1]?.body)).body).not.toContain("- [ ]");
});

it("checks the branch's current file for a post added since deployment", async () => {
  fetchMock.mockReset()
    .mockResolvedValueOnce(Response.json({ object: { sha: "main-sha" } }))
    .mockResolvedValueOnce(Response.json({}, { status: 201 }))
    .mockResolvedValueOnce(Response.json({ sha: "file-sha", content: Buffer.from(JSON.stringify([id])).toString("base64") }));

  expect(await submitPost(url)).toEqual({ ok: false, message: "That post is already on the wall." });
  expect(fetchMock).toHaveBeenCalledTimes(4);
  expect(fetchMock).toHaveBeenLastCalledWith(`${api}git/refs/heads/submit/${id}`, expect.objectContaining({ method: "DELETE" }));
});

it("deletes a branch created in this call when GitHub fails later", async () => {
  fetchMock.mockReset()
    .mockResolvedValueOnce(Response.json({ object: { sha: "main-sha" } }))
    .mockResolvedValueOnce(Response.json({}, { status: 201 }))
    .mockResolvedValueOnce(Response.json({}, { status: 503 }))
    .mockResolvedValueOnce(new Response(null, { status: 204 }));

  expect(await submitPost(url)).toEqual({ ok: false, message: "Something went wrong on our side. Try again later." });
  expect(console.error).toHaveBeenCalledExactlyOnceWith("GitHub submission failed", {
    id, error: expect.objectContaining({ status: 503, path: `contents/data/x-posts.json?ref=submit/${id}` }),
  });
  expect(fetchMock).toHaveBeenCalledTimes(4);
  expect(fetchMock).toHaveBeenLastCalledWith(`${api}git/refs/heads/submit/${id}`, expect.objectContaining({ method: "DELETE" }));
});

it("returns the same message when branch cleanup also fails", async () => {
  fetchMock.mockReset()
    .mockResolvedValueOnce(Response.json({ object: { sha: "main-sha" } }))
    .mockResolvedValueOnce(Response.json({}, { status: 201 }))
    .mockRejectedValueOnce(new Error("Connection closed"))
    .mockResolvedValueOnce(Response.json({}, { status: 503 }));

  expect(await submitPost(url)).toEqual({ ok: false, message: "Something went wrong on our side. Try again later." });
  expect(console.error).toHaveBeenCalledTimes(2);
  expect(fetchMock).toHaveBeenCalledTimes(4);
});

it("does not delete a branch when fetching main fails", async () => {
  fetchMock.mockReset().mockResolvedValueOnce(Response.json({}, { status: 500 }));

  expect(await submitPost(url)).toEqual({ ok: false, message: "Something went wrong on our side. Try again later." });
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
