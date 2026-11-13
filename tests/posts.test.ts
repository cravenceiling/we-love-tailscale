import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getTweet, type MediaPhoto, type Tweet } from "react-tweet/api";
import { getPosts } from "../lib/posts";
import recordedTweet from "./fixtures/tweet";

// Syndication omits empty arrays that react-tweet declares as required.
const fixture: Tweet = {
  ...recordedTweet,
  entities: { hashtags: [], symbols: [], ...recordedTweet.entities },
};

vi.mock("react-tweet/api", () => ({ getTweet: vi.fn() }));
vi.mock("../data/x-posts.json", () => ({ default: Array.from({ length: 20 }, (_, index) => String(index + 1)) }));
vi.mock("../data/translations.json", () => ({ default: { "777": { from: "Japanese", text: "Seriously handy." } } }));

beforeEach(() => {
  vi.mocked(getTweet).mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

it("maps a recorded X response to literal display values", async () => {
  vi.mocked(getTweet).mockResolvedValueOnce(structuredClone(fixture));

  expect(await getPosts()).toEqual([{
    id: "1583156629163282433",
    url: "https://x.com/film_girl/status/1583156629163282433",
    author: {
      name: "Christina Warren",
      handle: "film_girl",
      avatar: "https://pbs.twimg.com/profile_images/1812573605877764097/HuPNMdOy_400x400.jpg",
    },
    parts: [
      { type: "text", text: "I'm currently waxing poetic about " },
      { type: "mention", text: "@Tailscale", href: "https://x.com/Tailscale" },
      { type: "text", text: " to " },
      { type: "mention", text: "@abbycabs", href: "https://x.com/abbycabs" },
      { type: "text", text: " on Slack and it turns out MagicDNS, one of the best parts of Tailscale, hit GA today! Congrats to the whole team and thank you for everything you do! " },
      { type: "url", text: "tailscale.com/blog/magicdns/", href: "https://tailscale.com/blog/magicdns/" },
    ],
    text: "I'm currently waxing poetic about @Tailscale to @abbycabs on Slack and it turns out MagicDNS, one of the best parts of Tailscale, hit GA today! Congrats to the whole team and thank you for everything you do! tailscale.com/blog/magicdns/",
    lang: "en",
    truncated: false,
    translation: null,
    createdAt: "2022-10-20T18:02:08.000Z",
    likes: 36,
    media: [],
  }]);
  expect(getTweet).toHaveBeenCalledTimes(20);
  expect(getTweet).toHaveBeenCalledWith("1", {
    signal: expect.any(AbortSignal),
    next: { revalidate: 3600 },
  });
});

it("sorts newest first and skips both unavailable and failed posts", async () => {
  const error = new Error("Not found");
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(getTweet).mockImplementation(async (id) => {
    if (id === "2") throw error;
    if (id !== "1" && id !== "3") return undefined;
    return {
      ...structuredClone(fixture),
      id_str: id,
      created_at: id === "1" ? "2024-01-01T00:00:00Z" : "2026-01-01T00:00:00Z",
    };
  });

  expect((await getPosts()).map((post) => [post.id, post.createdAt])).toEqual([
    ["3", "2026-01-01T00:00:00.000Z"],
    ["1", "2024-01-01T00:00:00.000Z"],
  ]);
  expect(log).toHaveBeenCalledExactlyOnceWith("X post could not be loaded", { id: "2", error });
});

it("refuses to build a wall when many requests to X fail", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(getTweet).mockImplementation(async (id) => {
    if (Number(id) <= 3) throw new Error("Too Many Requests");
    return structuredClone(fixture);
  });

  await expect(getPosts()).rejects.toThrow("3 of 20 X posts could not be loaded");
});

it("preserves Unicode, decodes X text, and maps hashtags and symbols", async () => {
  const text = "💙 &amp; &lt;3 &amp;lt; #Tailscale $TS";
  const tweet: Tweet = {
    ...structuredClone(fixture),
    text,
    display_text_range: [0, Array.from(text).length],
    entities: {
      urls: [],
      user_mentions: [],
      hashtags: [{ text: "Tailscale", indices: [23, 33] }],
      symbols: [{ text: "TS", indices: [34, 37] }],
    },
  };
  vi.mocked(getTweet).mockResolvedValueOnce(tweet);

  expect((await getPosts())[0]).toMatchObject({
    parts: [
      { type: "text", text: "💙 & <3 &lt; " },
      { type: "hashtag", text: "#Tailscale", href: "https://x.com/hashtag/Tailscale" },
      { type: "text", text: " " },
      { type: "url", text: "$TS", href: "https://x.com/search?q=%24TS" },
    ],
    text: "💙 & <3 &lt; #Tailscale $TS",
  });
});

it("maps photo, video and GIF dimensions and removes media links from display text", async () => {
  const photo: MediaPhoto = {
    type: "photo",
    display_url: "pic.x.com/example",
    expanded_url: "https://x.com/example/status/1/photo/1",
    ext_media_availability: { status: "Available" },
    ext_media_color: { palette: [] },
    indices: [6, 29],
    media_url_https: "https://pbs.twimg.com/media/example.jpg",
    original_info: { width: 1600, height: 900, focus_rects: [] },
    sizes: {
      large: { w: 1600, h: 900, resize: "fit" },
      medium: { w: 1200, h: 675, resize: "fit" },
      small: { w: 680, h: 383, resize: "fit" },
      thumb: { w: 150, h: 150, resize: "crop" },
    },
    url: "https://t.co/1234567890AB",
  };
  vi.mocked(getTweet).mockResolvedValueOnce({
    ...structuredClone(fixture),
    text: "Love! https://t.co/1234567890AB",
    display_text_range: [0, 29],
    entities: { hashtags: [], symbols: [], urls: [], user_mentions: [], media: [photo] },
    mediaDetails: [
      photo,
      {
        ...photo,
        type: "video",
        video_info: {
          aspect_ratio: [16, 9],
          variants: [
            { content_type: "application/x-mpegURL", url: "https://video.twimg.com/example.m3u8" },
            { content_type: "video/mp4", bitrate: 256000, url: "https://video.twimg.com/small.mp4" },
            { content_type: "video/mp4", bitrate: 832000, url: "https://video.twimg.com/medium.mp4" },
            { content_type: "video/mp4", bitrate: 2176000, url: "https://video.twimg.com/large.mp4" },
          ],
        },
      },
      {
        ...photo,
        type: "animated_gif",
        video_info: {
          aspect_ratio: [16, 9],
          variants: [{ content_type: "video/mp4", url: "https://video.twimg.com/animation.mp4" }],
        },
      },
    ],
  });

  expect((await getPosts())[0]).toMatchObject({
    parts: [{ type: "text", text: "Love! " }],
    text: "Love! ",
    media: [
      { type: "photo", url: "https://pbs.twimg.com/media/example?format=jpg&name=large", width: 1600, height: 900 },
      { type: "video", url: "https://video.twimg.com/medium.mp4", width: 1600, height: 900 },
      { type: "video", url: "https://video.twimg.com/animation.mp4", width: 1600, height: 900 },
    ],
  });
});

it("leaves out media that X marks as possibly sensitive", async () => {
  vi.mocked(getTweet).mockResolvedValueOnce({
    ...structuredClone(fixture),
    possibly_sensitive: true,
    mediaDetails: [{ type: "photo" }] as Tweet["mediaDetails"],
  });

  expect((await getPosts())[0].media).toEqual([]);
});

it("marks long posts that X only serves in part", async () => {
  vi.mocked(getTweet).mockResolvedValueOnce({ ...structuredClone(fixture), note_tweet: { id: "1" } });

  expect((await getPosts())[0]).toMatchObject({ truncated: true });
});

it("attaches the stored English translation to a non-English post", async () => {
  vi.mocked(getTweet).mockResolvedValueOnce({ ...structuredClone(fixture), id_str: "777" });

  expect((await getPosts())[0].translation).toEqual({ from: "Japanese", text: "Seriously handy." });
});
