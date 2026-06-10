"use client";

import { useCallback, useEffect, useState } from "react";

import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { TweetCard, type TweetCardData } from "@/components/tweet-card";
import { TweetComposer } from "@/components/tweet-composer";
import { TweetSkeletonList } from "@/components/tweet-skeleton";
import { apiFetch } from "@/lib/api-client";
import { useAuth } from "@/lib/context/auth-context";
import { useInfiniteScroll } from "@/lib/hooks/use-infinite-scroll";

type TimelineResponse = {
  tweets: TweetCardData[];
  nextCursor: string | null;
};

type LikeResponse = {
  liked: boolean;
  likesCount: number;
};

export default function HomePage() {
  const { user } = useAuth();
  const [tweets, setTweets] = useState<TweetCardData[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTimeline = useCallback(async (cursor?: string) => {
    const params = new URLSearchParams({ limit: "20" });
    if (cursor) {
      params.set("cursor", cursor);
    }

    const data = await apiFetch<TimelineResponse>(
      `/api/timeline?${params.toString()}`
    );

    return data;
  }, []);

  const loadInitial = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await fetchTimeline();
      setTweets(data.tweets);
      setNextCursor(data.nextCursor);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo cargar el timeline"
      );
    } finally {
      setIsLoading(false);
    }
  }, [fetchTimeline]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || isLoadingMore) {
      return;
    }

    setIsLoadingMore(true);

    try {
      const data = await fetchTimeline(nextCursor);
      setTweets((current) => [...current, ...data.tweets]);
      setNextCursor(data.nextCursor);
    } catch {
      setError("No se pudieron cargar más tweets");
    } finally {
      setIsLoadingMore(false);
    }
  }, [fetchTimeline, nextCursor, isLoadingMore]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  const sentinelRef = useInfiniteScroll(loadMore, !!nextCursor && !isLoadingMore);

  async function handleSubmit(content: string) {
    try {
      const data = await apiFetch<{ tweet: TweetCardData }>("/api/tweets", {
        method: "POST",
        body: JSON.stringify({ content }),
      });

      setTweets((current) => [
        { ...data.tweet, hasLiked: false, _count: { likes: 0 } },
        ...current,
      ]);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo publicar el tweet"
      );
      throw err;
    }
  }

  async function handleLike(tweetId: string) {
    try {
      const data = await apiFetch<LikeResponse>(`/api/tweets/${tweetId}/like`, {
        method: "POST",
      });

      setTweets((current) =>
        current.map((tweet) =>
          tweet.id === tweetId
            ? {
                ...tweet,
                hasLiked: data.liked,
                _count: { likes: data.likesCount },
              }
            : tweet
        )
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo actualizar el like"
      );
    }
  }

  async function handleDelete(tweetId: string) {
    try {
      await apiFetch(`/api/tweets/${tweetId}`, { method: "DELETE" });
      setTweets((current) => current.filter((tweet) => tweet.id !== tweetId));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo eliminar el tweet"
      );
    }
  }

  return (
    <div>
      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-[#0f0f0f]/90 px-4 py-3 backdrop-blur">
        <h1 className="text-xl font-bold">Inicio</h1>
      </header>

      <TweetComposer onSubmit={handleSubmit} />

      {isLoading && <TweetSkeletonList />}

      {error && !isLoading && (
        <ErrorState message={error} onRetry={loadInitial} />
      )}

      {!isLoading && !error && tweets.length === 0 && (
        <EmptyState
          title="Tu timeline está vacía"
          description="Seguí a algunas personas para ver sus tweets, o publicá el primero."
        />
      )}

      {!isLoading &&
        !error &&
        tweets.map((tweet) => (
          <TweetCard
            key={tweet.id}
            tweet={tweet}
            currentUserId={user?.id}
            onLike={handleLike}
            onDelete={handleDelete}
          />
        ))}

      {isLoadingMore && <TweetSkeletonList count={2} />}
      <div ref={sentinelRef} className="h-4" />
    </div>
  );
}
