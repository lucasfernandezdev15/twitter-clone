"use client";

import { Heart, Trash2 } from "lucide-react";
import { useState } from "react";

import { formatRelativeTime } from "@/lib/format-relative-time";

import { Avatar } from "./avatar";

export type TweetCardData = {
  id: string;
  content: string;
  createdAt: string | Date;
  author: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl?: string | null;
  };
  _count?: {
    likes: number;
  };
  hasLiked?: boolean;
};

type TweetCardProps = {
  tweet: TweetCardData;
  currentUserId?: string;
  onLike: (tweetId: string) => void;
  onDelete?: (tweetId: string) => void;
};

export function TweetCard({
  tweet,
  currentUserId,
  onLike,
  onDelete,
}: TweetCardProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const likesCount = tweet._count?.likes ?? 0;
  const isLiked = tweet.hasLiked ?? false;
  const isAuthor = currentUserId === tweet.author.id;

  function handleLike() {
    setIsAnimating(true);
    onLike(tweet.id);
    window.setTimeout(() => setIsAnimating(false), 300);
  }

  return (
    <article className="border-b border-zinc-800 px-4 py-3 transition hover:bg-zinc-900/40">
      <div className="flex gap-3">
        <Avatar
          src={tweet.author.avatarUrl}
          name={tweet.author.displayName}
          size="md"
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="truncate font-bold text-white">
              {tweet.author.displayName}
            </span>
            <span className="truncate text-zinc-500">
              @{tweet.author.username}
            </span>
            <span className="text-zinc-600">·</span>
            <time
              className="shrink-0 text-zinc-500"
              dateTime={new Date(tweet.createdAt).toISOString()}
            >
              {formatRelativeTime(tweet.createdAt)}
            </time>
          </div>

          <p className="mt-1 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-zinc-100">
            {tweet.content}
          </p>

          <div className="mt-3 flex items-center gap-4">
            <button
              type="button"
              onClick={handleLike}
              className={`group flex items-center gap-1.5 text-sm transition ${
                isLiked
                  ? "text-pink-500"
                  : "text-zinc-500 hover:text-pink-500"
              }`}
            >
              <Heart
                className={`h-4 w-4 transition-transform ${
                  isAnimating ? "scale-125" : "scale-100"
                } ${isLiked ? "fill-pink-500" : "fill-transparent"}`}
              />
              <span>{likesCount}</span>
            </button>

            {isAuthor && onDelete && (
              <button
                type="button"
                onClick={() => onDelete(tweet.id)}
                className="flex items-center gap-1.5 text-sm text-zinc-500 transition hover:text-red-400"
              >
                <Trash2 className="h-4 w-4" />
                <span className="hidden sm:inline">Eliminar</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
