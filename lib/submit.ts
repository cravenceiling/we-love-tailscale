import { getTweet } from "react-tweet/api";
import xPosts from "../data/x-posts.json";

const REPO = "https://api.github.com/repos/cravenceiling/we-love-tailscale";
// X ignores leading zeros, so "0001…" would load an existing post under a new ID.
// Requiring the canonical form keeps the duplicate check meaningful.
const STATUS_PATH = /^\/(?:i\/web|[A-Za-z0-9_]+)\/status\/([1-9]\d{0,18})(?:\/|$)/;

class GitHubError extends Error {
  constructor(readonly status: number, readonly path: string) {
    super(`GitHub answered ${status} for ${path}`);
  }
}

export async function submitPost(input: string): Promise<{ ok: true; prUrl: string } | { ok: false; message: string }> {
  let id: string;
  try {
    const url = new URL(input);
    const match = STATUS_PATH.exec(url.pathname);
    if (!/^https?:$/.test(url.protocol) || !/^(?:(?:www|mobile)\.)?(?:x|twitter)\.com$/.test(url.hostname) || !match) {
      return { ok: false, message: "Paste a link to a post on X." };
    }
    id = match[1];
  } catch {
    return { ok: false, message: "Paste a link to a post on X." };
  }

  if (xPosts.includes(id)) return { ok: false, message: "That post is already on the wall." };

  let tweet;
  try {
    tweet = await getTweet(id, { signal: AbortSignal.timeout(10_000) });
  } catch (error) {
    console.error("Submitted X post could not be loaded", { id, error });
    return { ok: false, message: "X didn't answer. Try again in a minute." };
  }
  if (!tweet) return { ok: false, message: "That post is private or was deleted." };
  if (![tweet.text, tweet.in_reply_to_screen_name ?? "", tweet.quoted_tweet?.text ?? ""].some((text) => /tailscale/i.test(text))) {
    return { ok: false, message: "That post doesn't mention Tailscale." };
  }

  const token = process.env.GITHUB_SUBMIT_TOKEN;
  if (!token) {
    console.error("GITHUB_SUBMIT_TOKEN is not configured");
    return { ok: false, message: "Submissions are closed right now." };
  }

  async function github(path: string, init?: RequestInit) {
    const response = await fetch(`${REPO}/${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "we-love-tailscale",
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });
    if (!response.ok) throw new GitHubError(response.status, path);
    return response;
  }

  const branch = `submit/${id}`;
  let branchCreated = false;
  const removeBranch = () =>
    github(`git/refs/heads/${branch}`, { method: "DELETE" }).catch((error: unknown) => {
      console.error("Submission branch could not be removed", { branch, error });
    });
  try {
    const main: { object: { sha: string } } = await (await github("git/ref/heads/main")).json();
    try {
      await github("git/refs", { method: "POST", body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: main.object.sha }) });
    } catch (error) {
      // The branch name is always valid, so 422 means it exists: an open
      // submission, or a closed one whose branch was kept as a rejection.
      if (error instanceof GitHubError && error.status === 422) {
        return { ok: false, message: "That post is already waiting for review." };
      }
      throw error;
    }
    branchCreated = true;

    const file: { content: string; sha: string } = await (await github(`contents/data/x-posts.json?ref=${branch}`)).json();
    const ids: string[] = JSON.parse(Buffer.from(file.content, "base64").toString("utf8"));
    // Merged on main but not deployed yet.
    if (ids.includes(id)) {
      await removeBranch();
      return { ok: false, message: "That post is already on the wall." };
    }

    // getPosts sorts, so file order does not matter. Spreading inserts across the
    // list keeps open PRs off the same lines, so merging them rarely conflicts.
    ids.splice(Number(BigInt(id) % BigInt(ids.length + 1)), 0, id);
    await github("contents/data/x-posts.json", {
      method: "PUT",
      body: JSON.stringify({
        message: `Add X post ${id}`,
        branch,
        sha: file.sha,
        content: Buffer.from(JSON.stringify(ids, null, 2) + "\n").toString("base64"),
      }),
    });

    const handle = tweet.user.screen_name;
    // The PR is opened with the owner's token, so post text must not render as
    // markdown (links, images, mentions). A fence longer than any backtick run
    // in the text keeps it literal.
    const text = tweet.text.replace(/&(amp|lt|gt);/g, (_, entity: string) => ({ amp: "&", lt: "<", gt: ">" })[entity] ?? "");
    const fence = "`".repeat(Math.max(3, ...Array.from(text.matchAll(/`+/g), (run) => run[0].length + 1)));
    // The wall shows attached media, but the body cannot, so the reviewer is told to look.
    const media = tweet.mediaDetails ?? [];
    const photos = media.filter((item) => item.type === "photo").length;
    const videos = media.length - photos;
    const attached = [photos && `${photos} photo${photos > 1 ? "s" : ""}`, videos && `${videos} video${videos > 1 ? "s" : ""}`]
      .filter(Boolean)
      .join(" and ");
    const body = [
      `${fence}text\n${text}\n${fence}`,
      `Posted by [${handle}](https://x.com/${handle}) on ${tweet.created_at}, ${tweet.favorite_count} likes. [View the post](https://x.com/${handle}/status/${id}).`,
      ...(attached
        ? [tweet.possibly_sensitive
          ? `Attached: ${attached}. X marks the post as possibly sensitive, so the wall leaves the media out.`
          : `Attached: ${attached}, shown on the wall. Check the media on X before merging.`]
        : []),
      "Submitted through the form on the site.",
      ...(/^[a-z]{2}$/.test(tweet.lang) && tweet.lang !== "en"
        ? [`- [ ] Add an English translation to data/translations.json (post language: ${tweet.lang})`]
        : []),
    ].join("\n\n");
    const pr: { html_url: string } = await (await github("pulls", {
      method: "POST",
      body: JSON.stringify({ title: `Add a post by ${handle}`, head: branch, base: "main", body }),
    })).json();
    return { ok: true, prUrl: pr.html_url };
  } catch (error) {
    console.error("GitHub submission failed", { id, error });
    if (branchCreated) await removeBranch();
    return { ok: false, message: "Something went wrong on our side. Try again later." };
  }
}
