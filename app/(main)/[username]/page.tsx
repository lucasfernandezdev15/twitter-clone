"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Avatar } from "@/components/avatar";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { TweetCard, type TweetCardData } from "@/components/tweet-card";
import { TweetSkeletonList } from "@/components/tweet-skeleton";
import { UserCard, type UserCardData } from "@/components/user-card";
import { apiFetch } from "@/lib/api-client";
import { useAuth } from "@/lib/context/auth-context";
import { useInfiniteScroll } from "@/lib/hooks/use-infinite-scroll";

type ProfileUser = {
  id: string;
  username: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  createdAt: string;
  _count: {
    tweets: number;
    followers: number;
    following: number;
  };
  isFollowing: boolean;
};

type ProfileResponse = {
  user: ProfileUser;
};

type TweetsResponse = {
  tweets: TweetCardData[];
  nextCursor: string | null;
};

type UsersResponse = {
  users: UserCardData[];
};

type LikeResponse = {
  liked: boolean;
  likesCount: number;
};

type FollowResponse = {
  following: boolean;
};

type Tab = "tweets" | "following" | "followers";

export default function ProfilePage() {
  const params = useParams<{ username: string }>();
  const username = params.username;
  const { user: currentUser } = useAuth();

  const [profile, setProfile] = useState<ProfileUser | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("tweets");
  const [tweets, setTweets] = useState<TweetCardData[]>([]);
  const [users, setUsers] = useState<UserCardData[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isLoadingTab, setIsLoadingTab] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOwnProfile = currentUser?.username === username;

  const loadProfile = useCallback(async () => {
    setIsLoadingProfile(true);
    setError(null);

    try {
      const data = await apiFetch<ProfileResponse>(`/api/users/${username}`);
      setProfile(data.user);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo cargar el perfil"
      );
      setProfile(null);
    } finally {
      setIsLoadingProfile(false);
    }
  }, [username]);

  const loadTweets = useCallback(
    async (cursor?: string) => {
      const params = new URLSearchParams({ limit: "20" });
      if (cursor) {
        params.set("cursor", cursor);
      }

      const data = await apiFetch<TweetsResponse>(
        `/api/users/${username}/tweets?${params.toString()}`
      );

      return data;
    },
    [username]
  );

  const loadTabContent = useCallback(async () => {
    if (!profile) {
      return;
    }

    setIsLoadingTab(true);
    setError(null);
    setUsers([]);
    setTweets([]);
    setNextCursor(null);

    try {
      if (activeTab === "tweets") {
        const data = await loadTweets();
        setTweets(data.tweets);
        setNextCursor(data.nextCursor);
      } else if (activeTab === "following") {
        const data = await apiFetch<UsersResponse>(
          `/api/users/${username}/following`
        );
        setUsers(data.users);
      } else {
        const data = await apiFetch<UsersResponse>(
          `/api/users/${username}/followers`
        );
        setUsers(data.users);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo cargar el contenido"
      );
    } finally {
      setIsLoadingTab(false);
    }
  }, [activeTab, loadTweets, profile, username]);

  const loadMoreTweets = useCallback(async () => {
    if (!nextCursor || isLoadingMore || activeTab !== "tweets") {
      return;
    }

    setIsLoadingMore(true);

    try {
      const data = await loadTweets(nextCursor);
      setTweets((current) => [...current, ...data.tweets]);
      setNextCursor(data.nextCursor);
    } catch {
      setError("No se pudieron cargar más tweets");
    } finally {
      setIsLoadingMore(false);
    }
  }, [activeTab, isLoadingMore, loadTweets, nextCursor]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (profile) {
      loadTabContent();
    }
  }, [profile, activeTab, loadTabContent]);

  const sentinelRef = useInfiniteScroll(
    loadMoreTweets,
    activeTab === "tweets" && !!nextCursor && !isLoadingMore
  );

  async function handleFollow() {
    if (!profile) {
      return;
    }

    const data = await apiFetch<FollowResponse>(
      `/api/users/${profile.username}/follow`,
      { method: "POST" }
    );

    setProfile((current) =>
      current
        ? {
            ...current,
            isFollowing: data.following,
            _count: {
              ...current._count,
              followers: current._count.followers + (data.following ? 1 : -1),
            },
          }
        : current
    );
  }

  async function handleLike(tweetId: string) {
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
  }

  async function handleDelete(tweetId: string) {
    await apiFetch(`/api/tweets/${tweetId}`, { method: "DELETE" });
    setTweets((current) => current.filter((tweet) => tweet.id !== tweetId));
    setProfile((current) =>
      current
        ? {
            ...current,
            _count: {
              ...current._count,
              tweets: Math.max(0, current._count.tweets - 1),
            },
          }
        : current
    );
  }

  async function handleUserFollow(targetUsername: string) {
    const data = await apiFetch<FollowResponse>(
      `/api/users/${targetUsername}/follow`,
      { method: "POST" }
    );

    setUsers((current) =>
      current.map((user) =>
        user.username === targetUsername
          ? { ...user, isFollowing: data.following }
          : user
      )
    );
  }

  if (isLoadingProfile) {
    return (
      <div className="px-4 py-8 text-center text-sm text-zinc-500">
        Cargando perfil...
      </div>
    );
  }

  if (error && !profile) {
    return <ErrorState message={error} onRetry={loadProfile} />;
  }

  if (!profile) {
    return (
      <EmptyState
        title="Usuario no encontrado"
        description="El perfil que buscás no existe."
      />
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "tweets", label: "Tweets" },
    { id: "following", label: "Siguiendo" },
    { id: "followers", label: "Seguidores" },
  ];

  return (
    <div>
      <header className="border-b border-zinc-800 px-4 py-3">
        <h1 className="text-xl font-bold">{profile.displayName}</h1>
        <p className="text-sm text-zinc-500">@{profile.username}</p>
      </header>

      <div className="border-b border-zinc-800 px-4 py-4">
        <div className="flex items-start justify-between gap-4">
          <Avatar
            src={profile.avatarUrl}
            name={profile.displayName}
            size="lg"
          />

          {!isOwnProfile && (
            <button
              type="button"
              onClick={handleFollow}
              className={`rounded-full border px-5 py-2 text-sm font-bold transition ${
                profile.isFollowing
                  ? "border-zinc-600 text-white hover:border-red-500 hover:text-red-400"
                  : "border-transparent bg-white text-black hover:bg-zinc-200"
              }`}
            >
              {profile.isFollowing ? "Siguiendo" : "Seguir"}
            </button>
          )}
        </div>

        <div className="mt-4">
          <h2 className="text-xl font-bold">{profile.displayName}</h2>
          <p className="text-zinc-500">@{profile.username}</p>
          {profile.bio && (
            <p className="mt-3 text-[15px] leading-relaxed text-zinc-200">
              {profile.bio}
            </p>
          )}
          <div className="mt-3 flex gap-4 text-sm text-zinc-500">
            <span>
              <strong className="text-white">{profile._count.following}</strong>{" "}
              siguiendo
            </span>
            <span>
              <strong className="text-white">{profile._count.followers}</strong>{" "}
              seguidores
            </span>
            <span>
              <strong className="text-white">{profile._count.tweets}</strong>{" "}
              tweets
            </span>
          </div>
        </div>
      </div>

      <div className="flex border-b border-zinc-800">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-4 text-sm font-medium transition hover:bg-zinc-900/50 ${
              activeTab === tab.id
                ? "border-b-2 border-sky-500 font-bold text-white"
                : "text-zinc-500"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoadingTab && <TweetSkeletonList count={activeTab === "tweets" ? 3 : 2} />}

      {error && profile && !isLoadingTab && (
        <ErrorState message={error} onRetry={loadTabContent} />
      )}

      {!isLoadingTab && !error && activeTab === "tweets" && tweets.length === 0 && (
        <EmptyState
          title="Sin tweets todavía"
          description={
            isOwnProfile
              ? "Publicá tu primer tweet desde Inicio."
              : "Este usuario aún no publicó nada."
          }
        />
      )}

      {!isLoadingTab &&
        !error &&
        activeTab === "tweets" &&
        tweets.map((tweet) => (
          <TweetCard
            key={tweet.id}
            tweet={tweet}
            currentUserId={currentUser?.id}
            onLike={handleLike}
            onDelete={isOwnProfile ? handleDelete : undefined}
          />
        ))}

      {!isLoadingTab &&
        !error &&
        activeTab !== "tweets" &&
        users.length === 0 && (
          <EmptyState
            title={
              activeTab === "following"
                ? "No sigue a nadie"
                : "No tiene seguidores"
            }
          />
        )}

      {!isLoadingTab &&
        !error &&
        activeTab !== "tweets" &&
        users.map((user) => (
          <UserCard key={user.id} user={user} onFollow={handleUserFollow} />
        ))}

      {isLoadingMore && <TweetSkeletonList count={2} />}
      {activeTab === "tweets" && <div ref={sentinelRef} className="h-4" />}
    </div>
  );
}
