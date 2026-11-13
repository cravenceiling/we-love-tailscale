"use client";

import Image from "next/image";
import { useState } from "react";
import type { Post } from "@/lib/posts";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { sizeFor } from "./text-size";
import styles from "./wall.module.css";

// Fixed locale and time zone so the server and the browser print the same date.
const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const longDateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const likeFormat = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

function initials(name: string) {
  const letters = name.match(/\p{L}/gu) ?? [];
  return (letters[0] ?? "?").toUpperCase();
}

function AuthorAvatar({ post, size }: { post: Post; size: "sm" | "lg" }) {
  return (
    <Avatar size={size === "lg" ? "lg" : "sm"} className={size === "lg" ? styles.avatarLarge : styles.avatar}>
      <AvatarImage src={post.author.avatar} alt="" />
      <AvatarFallback className={styles.avatarFallback}>{initials(post.author.name)}</AvatarFallback>
    </Avatar>
  );
}

export function PostQuote({
  post,
  order,
  postsByAuthor,
  lede = false,
}: {
  post: Post;
  order: number;
  postsByAuthor: number;
  lede?: boolean;
}) {
  const size = lede ? "lede" : sizeFor(post);
  const photo = post.media.find((media) => media.type === "photo");
  const video = photo ? undefined : post.media.find((media) => media.type === "video");
  const date = new Date(post.createdAt);
  // X's free endpoint cuts posts over 280 characters; say so instead of ending mid-sentence.
  const ellipsis = post.truncated && !post.text.trimEnd().endsWith("\u2026");
  const [showOriginal, setShowOriginal] = useState(false);
  const translated = post.translation !== null && !showOriginal;

  return (
    <article
      className={lede ? styles.lede : styles.item}
      data-post-id={post.id}
      style={{ "--order": order } as React.CSSProperties}
    >
      <blockquote cite={post.url} className={styles.blockquote}>
        <p className={styles.quote} data-size={size} lang={translated ? "en" : post.translation ? post.lang : undefined}>
          {translated ? post.translation?.text : post.parts.map((part, index) =>
            part.type === "text" ? (
              part.text
            ) : (
              <a
                key={index}
                href={part.href}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.inlineLink}
              >
                {part.text}
              </a>
            ),
          )}
          {ellipsis ? "\u2026" : null}
        </p>
      </blockquote>
      {post.translation ? (
        <p className={styles.translation}>
          {showOriginal ? `Original in ${post.translation.from}` : `Translated from ${post.translation.from}`}
          {" \u00b7 "}
          <button type="button" onClick={() => setShowOriginal((value) => !value)} className={styles.translationToggle}>
            {showOriginal ? "Show translation" : "Show original"}
          </button>
        </p>
      ) : null}
      {post.truncated ? (
        <a href={post.url} target="_blank" rel="noopener noreferrer" className={`${styles.inlineLink} ${styles.continues}`}>
          Continues on X
        </a>
      ) : null}

      {photo && !lede ? (
        <div className={styles.media}>
          <Image
            src={photo.url}
            alt={`Photo attached to ${post.author.name}'s post`}
            width={photo.width}
            height={photo.height}
            sizes="(min-width: 1024px) 400px, (min-width: 640px) 45vw, 100vw"
            className={styles.mediaImage}
          />
        </div>
      ) : null}
      {video && !lede ? (
        <div className={styles.media}>
          <video
            // The fragment makes the browser paint the first frame instead of an empty box.
            src={`${video.url}#t=0.1`}
            controls
            muted
            playsInline
            preload="metadata"
            aria-label={`Video attached to ${post.author.name}'s post`}
            className={styles.mediaVideo}
            style={{ aspectRatio: `${video.width} / ${video.height}` }}
          />
        </div>
      ) : null}

      <footer className={styles.attribution}>
        <AuthorAvatar post={post} size="sm" />
        <div className={styles.byline}>
          <HoverCard>
            <HoverCardTrigger
              href={`https://x.com/${post.author.handle}`}
              target="_blank"
              rel="noopener noreferrer"
              delay={450}
              closeDelay={120}
              className={styles.author}
            >
              {post.author.name}
            </HoverCardTrigger>
            <HoverCardContent side="top" align="start" sideOffset={10} className={styles.preview}>
              <AuthorAvatar post={post} size="lg" />
              <div className={styles.previewText}>
                <span className={styles.previewName}>{post.author.name}</span>
                <span className={styles.previewHandle}>@{post.author.handle}</span>
                {postsByAuthor > 1 ? (
                  <span className={styles.previewNote}>{postsByAuthor} posts on this wall. A regular.</span>
                ) : null}
              </div>
            </HoverCardContent>
          </HoverCard>
          <span className={styles.meta}>
            <a
              href={post.url}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.permalink}
              data-permalink
              aria-label={`${post.author.name} on X, ${longDateFormat.format(date)}`}
            >
              <time dateTime={post.createdAt}>{dateFormat.format(date)}</time>
            </a>
            {post.likes > 0 ? (
              <span className={styles.likes}>
                {likeFormat.format(post.likes)} {post.likes === 1 ? "like" : "likes"}
              </span>
            ) : null}
          </span>
        </div>
      </footer>
    </article>
  );
}
