import { enrichTweet, getMediaUrl, getMp4Video } from "react-tweet";
import { getTweet, type Tweet } from "react-tweet/api";
import translations from "../data/translations.json";
import xPosts from "../data/x-posts.json";

export type Post = {
  id: string;
  url: string;
  author: {
    name: string;
    handle: string;
    avatar: string;
  };
  parts: Array<
    | { type: "text"; text: string }
    | { type: "mention" | "hashtag" | "url"; text: string; href: string }
  >;
  text: string;
  /** Language code X detected for the post text, e.g. "ja". */
  lang: string;
  /** X's free endpoint cuts posts over 280 characters; the full text is only on X. */
  truncated: boolean;
  /** English translation written when a non-English post is added to the wall. */
  translation: { from: string; text: string } | null;
  createdAt: string;
  likes: number;
  media: Array<{ type: "photo" | "video"; url: string; width: number; height: number }>;
};

// Requests in flight at once, so a few hundred posts do not hit X all at once.
// A pool rather than fixed batches: one slow request then holds up one slot,
// not the 19 others in its batch, which kept the build past Next's 60s limit.
const CONCURRENCY = 40;

export async function getPosts(): Promise<Post[]> {
  const tweets: Array<Tweet | undefined> = [];
  let failed = 0;
  let next = 0;
  async function worker() {
    while (next < xPosts.length) {
      const index = next++;
      const id = xPosts[index];
      try {
        // Resolves to undefined when the post was deleted or the account went private.
        tweets[index] = await getTweet(id, {
          signal: AbortSignal.timeout(5_000),
          next: { revalidate: 3600 },
        });
      } catch (error) {
        failed += 1;
        console.error("X post could not be loaded", { id, error });
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  // Many failures mean X is rate limiting or down, not that posts are gone.
  // Throwing fails the build, or keeps serving the last good page during
  // hourly regeneration, instead of caching a wall with holes in it.
  if (failed > xPosts.length / 10) {
    throw new Error(`${failed} of ${xPosts.length} X posts could not be loaded`);
  }

  return tweets
    .filter((tweet): tweet is Tweet => tweet !== undefined)
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
    .map((rawTweet): Post => {
      const tweet = enrichTweet(rawTweet);
      const parts: Post["parts"] = tweet.entities.flatMap((entity): Post["parts"] => {
        // X encodes these characters in text; consumers render the parts as text nodes.
        const escapes: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">" };
        const text = entity.text.replace(/&(?:amp|lt|gt);/g, (match) => escapes[match]);
        switch (entity.type) {
          case "media":
            return [];
          case "text":
            return [{ type: "text", text }];
          case "mention":
          case "hashtag":
          case "url":
            return [{ type: entity.type, text, href: entity.href }];
          case "symbol":
            return [{ type: "url", text, href: entity.href }];
        }
      });

      return {
        id: tweet.id_str,
        url: tweet.url,
        author: {
          name: tweet.user.name,
          handle: tweet.user.screen_name,
          avatar: tweet.user.profile_image_url_https.replace(/_normal(?=\.[^./?]+(?:\?|$))/, "_400x400"),
        },
        parts,
        text: parts.map((part) => part.text).join(""),
        lang: tweet.lang,
        truncated: tweet.note_tweet !== undefined,
        translation: (translations as Record<string, Post["translation"]>)[tweet.id_str] ?? null,
        createdAt: new Date(tweet.created_at).toISOString(),
        likes: tweet.favorite_count,
        // A merge reviews the text; media X flags as sensitive stays on X.
        media: tweet.possibly_sensitive ? [] : (tweet.mediaDetails ?? []).flatMap((media): Post["media"] => {
          const { width, height } = media.original_info;
          if (media.type === "photo") {
            return [{ type: "photo", url: getMediaUrl(media, "large"), width, height }];
          }
          const video = getMp4Video(media);
          return video ? [{ type: "video", url: video.url, width, height }] : [];
        }),
      };
    });
}
