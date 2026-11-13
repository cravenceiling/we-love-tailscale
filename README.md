# Tailscale love

An unofficial wall of public X posts from people praising Tailscale. Every post is picked by hand and quoted as written. Not affiliated with Tailscale Inc.

## How it works

There is no database or scheduled job. The repo holds a list of post IDs, and the page asks X for those posts when it is built. Reading posts needs no API key. The submission form uses a GitHub token to open pull requests.

```
data/x-posts.json ──► lib/posts.ts ──► app/page.tsx ──► components/wall/
  post IDs            fetch each post    server page      client UI
data/translations.json   from X, map to   (static, rebuilt   (hero, grid,
  English text           a Post type      at most hourly)    infinite scroll)
```

### Storage

- `data/x-posts.json` is a JSON array of X post IDs. The ID is the number at the end of a post URL: `x.com/user/status/<id>`.
- `data/translations.json` maps a post ID to a hand-written English translation of a non-English post: `{ "<id>": { "from": "Japanese", "text": "..." } }`. Translations are written once, when the post is added, so the page never calls a translation service.

Nothing else is stored. Author names, avatars, dates, like counts and media come from X every time the page is regenerated, so they stay current.

### Fetching

`lib/posts.ts` exports `getPosts()`, which:

1. Calls `getTweet(id)` from [`react-tweet`](https://github.com/vercel/react-tweet) for every ID. That function reads X's public embed endpoint (`cdn.syndication.twimg.com`), the one that powers embedded posts on other sites. It needs no account or key.
2. Skips any post that fails to load (deleted, account went private, timeout after 5 seconds) and logs it, so one missing post never breaks the page.
3. Maps each post with `enrichTweet` into a small `Post` type: author, text split into plain text and links, date, likes, photo or video, the translation if one exists, and a `truncated` flag. The embed endpoint cuts posts longer than 280 characters, so those cards end with "Continues on X".

`app/page.tsx` sets `revalidate = 3600`. The page is rendered at build time and served as static HTML. After an hour, the next visit triggers a background rebuild with fresh data from X (Next.js incremental static regeneration).

### The page

- **Hero:** rotates every 2 seconds through the 12 most liked short posts, one per author. It holds while the pointer is over it or keyboard focus is inside it.
- **Wall:** cards in 1, 2 or 3 columns depending on screen width. Columns are balanced by an estimated card height and computed for all three widths up front; CSS shows the one that fits. Order is "Most liked" or "Newest".
- **Loading:** 15 cards at first. More load as the reader nears the bottom, and a "Show more" button does the same for keyboard users.
- **Cards:** link to the original post on X. Non-English posts show the translation with a toggle back to the original.

## Adding a post

Visitors can use "Submit an X post" on the page without a GitHub account. The form checks that the link is an X post, the post is public, it mentions Tailscale and it is not already on the wall. Each submission opens a pull request adding that post's ID. Merge to accept it, or close to reject it. Non-English posts include a translation checkbox in the request. Add the English text to `data/translations.json` before merging.

Each request works on a branch named `submit/<post ID>`. Delete the branch after merging (GitHub can do it automatically: Settings, "Automatically delete head branches"). Keep it when rejecting: while the branch exists, the form answers "already waiting for review" for that post, so a rejected post cannot be sent again.

The owner can also add posts by hand:

1. Copy the post URL and take the number at the end.
2. Add it to `data/x-posts.json`, keeping the JSON array formatted with two-space indentation and a final newline.
3. If the post is not in English, add a translation to `data/translations.json` under the same ID.
4. Commit and push. Vercel redeploys.

What goes on the wall: public posts praising Tailscale's design, reliability or the feeling that it "just works". Posts by Tailscale employees, ads, support questions and complaints stay off.

### Submissions setup

Create a fine-grained GitHub personal access token limited to the `cravenceiling/we-love-tailscale` repository. Give it Contents: Read and write and Pull requests: Read and write permissions.

Add it in Vercel as the `GITHUB_SUBMIT_TOKEN` environment variable for Production. Without it, the form answers "Submissions are closed right now."

## Project layout

```
app/
  page.tsx            the page: fetches posts, renders header, wall, footer
  actions.ts          submission form server action
  layout.tsx          root layout and the Archivo font
  globals.css         Tailwind and shadcn/ui theme tokens
components/
  wall/               the wall: hero rotation, grid, card, styles
  ui/                 shadcn/ui components on Base UI (avatar, button, hover card, toggle group)
data/                 post IDs and translations
lib/posts.ts          fetching and mapping posts from X
lib/submit.ts         checks submissions and opens a GitHub pull request
tests/                Vitest tests for posts and submissions
```

## Run locally

Requires Node 20.9 or later and pnpm.

```sh
pnpm install
pnpm dev
```

Open http://localhost:3000. The first load fetches every post from X, so it takes a few seconds.

## Checks

```sh
pnpm exec tsc --noEmit
pnpm lint
pnpm test
pnpm build
```

## License

MIT, see `LICENSE`. The bundled Archivo font is under the SIL Open Font License, see `app/archivo-license.txt`. Posts belong to their authors and are shown through X's public embed endpoint.
