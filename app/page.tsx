import { Newsreader, Young_Serif } from "next/font/google";
import { getPosts } from "@/lib/posts";
import { Wall } from "@/components/wall/wall";
import { SubmitForm } from "@/components/wall/submit-form";
import styles from "@/components/wall/wall.module.css";

export const revalidate = 3600;

const newsreader = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  variable: "--font-newsreader",
  display: "swap",
});

const display = Young_Serif({ subsets: ["latin"], weight: "400", variable: "--font-display", display: "swap" });

export default async function Home() {
  const posts = await getPosts();
  const people = new Set(posts.map((post) => post.author.handle)).size;

  return (
    <div className={`${newsreader.variable} ${display.variable} ${styles.root}`}>
      <a href="#posts" className={styles.skip}>
        Skip to the posts
      </a>
      <div className={styles.frame}>
        <header className={styles.masthead}>
          <p>Unofficial fan page. Not affiliated with Tailscale Inc.</p>
          <a href="#submit" className={styles.textLink}>
            Submit an X post
          </a>
        </header>

        <main>
          <h1 className={styles.title}>Tailscale love</h1>
          <Wall
            posts={posts}
            intro={
              <div className={styles.intro}>
                <p className={styles.standfirst}>
                  People don&rsquo;t usually gush about networking software. These {people} did, {posts.length} times,
                  in public, a few of them with swearing.
                </p>
                <p className={styles.standfirstNote}>
                  Collected by a fan who finds this very sweet. Every quote is word for word and opens the original
                  post on X.
                </p>
              </div>
            }
          />
        </main>

        <footer className={styles.closing}>
          <p className={styles.closingLine}>With love, the internet.</p>
          <section id="submit" aria-labelledby="submit-heading" className={styles.submitSection}>
            <h2 id="submit-heading" className={styles.submitHeading}>Know a post that belongs in here?</h2>
            <SubmitForm />
          </section>
          <div className={styles.closingRow}>
            <p>Unofficial fan page. Not affiliated with Tailscale Inc.</p>
            <p>Every post is public on X, quoted as written.</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
