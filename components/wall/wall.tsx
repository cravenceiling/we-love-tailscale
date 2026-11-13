"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Post } from "@/lib/posts";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { PostQuote } from "./post-quote";
import { sizeFor, wordLength } from "./text-size";
import styles from "./wall.module.css";

const PAGE = 15;
const ROTATE_MS = 2000;
const ROTATION_SIZE = 12;
type Order = "loudest" | "newest";

// Rough rendered height of a post, in arbitrary units, for one column of the given width.
// Only used to balance columns; exactness does not matter.
function estimateHeight(post: Post, columnWidth: number) {
  const size = sizeFor(post);
  const [fontSize, leading] = size === "display" ? [34, 1.12] : size === "large" ? [24, 1.3] : [18, 1.5];
  const charsPerLine = columnWidth / (fontSize * 0.46);
  // Authors' own line breaks are kept (pre-line), so each paragraph wraps on its own.
  const lines = post.text
    .split("\n")
    .reduce((sum, line) => sum + Math.max(1, Math.ceil(line.trim().length / charsPerLine)), 0);
  const media = post.media[0];
  const mediaHeight = media ? Math.min(columnWidth * (media.height / media.width), 448) + 20 : 0;
  return lines * fontSize * leading + mediaHeight + 110;
}

// Greedy shortest-column placement. Placing post n never moves posts 0..n-1,
// so "Show more" only appends and nothing the reader was looking at jumps.
function distribute(posts: Post[], columns: number, columnWidth: number) {
  const stacks: Array<Array<{ post: Post; order: number }>> = Array.from({ length: columns }, () => []);
  const heights = new Array<number>(columns).fill(0);
  posts.forEach((post, order) => {
    const target = heights.indexOf(Math.min(...heights));
    stacks[target].push({ post, order });
    heights[target] += estimateHeight(post, columnWidth);
  });
  return stacks;
}

export function Wall({ posts, intro }: { posts: Post[]; intro: React.ReactNode }) {
  const [order, setOrder] = useState<Order>("loudest");
  const [visible, setVisible] = useState(PAGE);
  const [batchStart, setBatchStart] = useState(0);
  const wallRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const focusOrder = useRef<number | null>(null);

  const postsByAuthor = useMemo(() => {
    const byHandle = new Map<string, number>();
    for (const post of posts) byHandle.set(post.author.handle, (byHandle.get(post.author.handle) ?? 0) + 1);
    return byHandle;
  }, [posts]);

  // getPosts returns newest first already.
  const ordered = useMemo(
    () => (order === "newest" ? posts : [...posts].sort((a, b) => b.likes - a.likes)),
    [posts, order],
  );

  // The opening rotates through the most liked short posts, one per author.
  const rotation = useMemo(() => {
    const seen = new Set<string>();
    return [...posts]
      .filter((post) => wordLength(post) <= 120 && post.media.length === 0)
      .sort((a, b) => b.likes - a.likes)
      .filter((post) => !seen.has(post.author.handle) && seen.add(post.author.handle))
      .slice(0, ROTATION_SIZE);
  }, [posts]);
  const shown = ordered.slice(0, visible);
  const remaining = ordered.length - shown.length;

  const layouts = useMemo(
    () => ({
      one: distribute(shown, 1, 600),
      two: distribute(shown, 2, 440),
      three: distribute(shown, 3, 390),
    }),
    [shown],
  );

  function reset() {
    focusOrder.current = null;
    setVisible(PAGE);
    setBatchStart(0);
  }

  // Only the button moves focus. Scroll-triggered loads must not pull focus away from the reader.
  function showMore(moveFocus: boolean) {
    focusOrder.current = moveFocus ? shown.length : null;
    setBatchStart(shown.length);
    setVisible((count) => count + PAGE);
  }

  // Load the next batch while the reader is still about a screen and a half away from the end.
  // Re-observing after every batch keeps loading going when one batch does not fill the screen.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || remaining <= 0) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) showMore(false);
      },
      { rootMargin: "0px 0px 150% 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
    // showMore only reads shown.length, which changes with visible.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, remaining, order]);

  // After "Show more" renders, move focus to the first new post so keyboard
  // readers continue where the new batch starts. Only one of the three layouts is visible.
  useEffect(() => {
    const order = focusOrder.current;
    if (order === null) return;
    focusOrder.current = null;
    const links = wallRef.current?.querySelectorAll<HTMLAnchorElement>(`[data-order="${order}"] [data-permalink]`);
    Array.from(links ?? []).find((link) => link.offsetParent !== null)?.focus();
  }, [visible]);

  const renderColumns = (stacks: ReturnType<typeof distribute>, className: string) => (
    <div className={className}>
      {stacks.map((stack, column) => (
        <div key={column} className={styles.column}>
          {stack.map(({ post, order: index }) => (
            <div key={post.id} data-order={index} className={styles.cell}>
              <PostQuote
                post={post}
                order={Math.max(0, Math.min(index - batchStart, 12))}
                postsByAuthor={postsByAuthor.get(post.author.handle) ?? 1}
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  );

  return (
    <>
      <div className={styles.opening}>
        {intro}
        {rotation.length > 0 ? <Rotation posts={rotation} postsByAuthor={postsByAuthor} /> : null}
      </div>

      <section id="posts" aria-label="All posts" className={styles.wallSection}>
        <div className={styles.controls}>
          <ToggleGroup
            aria-label="Order"
            value={[order]}
            onValueChange={(value) => {
              const next = value[0] as Order | undefined;
              if (next) {
                setOrder(next);
                reset();
              }
            }}
            spacing={0}
            className={styles.orders}
          >
            <ToggleGroupItem value="loudest" className={styles.orderItem}>
              Most liked
            </ToggleGroupItem>
            <ToggleGroupItem value="newest" className={styles.orderItem}>
              Newest
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div ref={wallRef} key={order}>
          {renderColumns(layouts.one, styles.wallOne)}
          {renderColumns(layouts.two, styles.wallTwo)}
          {renderColumns(layouts.three, styles.wallThree)}
        </div>

        <div ref={sentinelRef} aria-hidden="true" />
        <div className={styles.more}>
          {remaining > 0 ? (
            <>
              <Button variant="outline" onClick={() => showMore(true)} className={styles.moreButton}>
                Show {Math.min(PAGE, remaining)} more
              </Button>
              <p className={styles.moreNote}>{remaining} still waiting their turn.</p>
            </>
          ) : (
            <p className={styles.moreNote}>
              That is all of them. Seen one we missed?{" "}
              <a
                href="#submit"
                className={styles.textLink}
              >
                Submit an X post
              </a>
              .
            </p>
          )}
        </div>
      </section>
    </>
  );
}

// Every post in the rotation is rendered in the same grid cell, so the slot
// keeps the height of the tallest one and the wall below never jumps.
function Rotation({ posts, postsByAuthor }: { posts: Post[]; postsByAuthor: Map<string, number> }) {
  const [active, setActive] = useState(0);
  // Hover and focus are tracked apart: on touch, pointerleave fires right after
  // a tap, and that must not rotate away a button that still has focus.
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (hovered || focused || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => {
      if (!document.hidden) setActive((index) => (index + 1) % posts.length);
    }, ROTATE_MS);
    return () => clearInterval(timer);
  }, [hovered, focused, posts.length]);

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Posts on rotation"
      className={styles.ledeSlot}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
    >
      <div className={styles.rotation}>
        {posts.map((post, index) => (
          <div
            key={post.id}
            className={styles.rotationItem}
            data-active={index === active}
            inert={index !== active}
            aria-hidden={index !== active}
          >
            <PostQuote post={post} order={2} lede postsByAuthor={postsByAuthor.get(post.author.handle) ?? 1} />
          </div>
        ))}
      </div>
    </section>
  );
}
