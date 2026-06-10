"use client";

import { Avatar } from "./avatar";

export type UserCardData = {
  id: string;
  username: string;
  displayName: string;
  bio?: string | null;
  avatarUrl?: string | null;
  isFollowing?: boolean;
};

type UserCardProps = {
  user: UserCardData;
  onFollow: (username: string) => void;
};

export function UserCard({ user, onFollow }: UserCardProps) {
  const isFollowing = user.isFollowing ?? false;

  return (
    <article className="flex items-start gap-3 border-b border-zinc-800 px-4 py-4 transition hover:bg-zinc-900/40">
      <Avatar
        src={user.avatarUrl}
        name={user.displayName}
        size="lg"
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-bold text-white">{user.displayName}</p>
            <p className="truncate text-sm text-zinc-500">@{user.username}</p>
          </div>

          <button
            type="button"
            onClick={() => onFollow(user.username)}
            className={`shrink-0 rounded-full border px-4 py-1.5 text-sm font-bold transition ${
              isFollowing
                ? "border-zinc-600 bg-transparent text-white hover:border-red-500 hover:bg-red-500/10 hover:text-red-400"
                : "border-transparent bg-white text-black hover:bg-zinc-200"
            }`}
          >
            {isFollowing ? "Siguiendo" : "Seguir"}
          </button>
        </div>

        {user.bio && (
          <p className="mt-2 text-sm leading-relaxed text-zinc-300">
            {user.bio}
          </p>
        )}
      </div>
    </article>
  );
}
