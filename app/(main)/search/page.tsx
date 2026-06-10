"use client";

import { Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { UserCard, type UserCardData } from "@/components/user-card";
import { apiFetch } from "@/lib/api-client";
import { useDebounce } from "@/lib/hooks/use-debounce";

type SearchResponse = {
  users: UserCardData[];
};

type FollowResponse = {
  following: boolean;
};

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 300);
  const [users, setUsers] = useState<UserCardData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const searchUsers = useCallback(async (searchQuery: string) => {
    if (searchQuery.trim().length < 1) {
      setUsers([]);
      setHasSearched(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const data = await apiFetch<SearchResponse>(
        `/api/users/search?q=${encodeURIComponent(searchQuery.trim())}`
      );
      setUsers(data.users);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo buscar usuarios"
      );
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    searchUsers(debouncedQuery);
  }, [debouncedQuery, searchUsers]);

  async function handleFollow(username: string) {
    const data = await apiFetch<FollowResponse>(
      `/api/users/${username}/follow`,
      { method: "POST" }
    );

    setUsers((current) =>
      current.map((user) =>
        user.username === username
          ? { ...user, isFollowing: data.following }
          : user
      )
    );
  }

  return (
    <div>
      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-[#0f0f0f]/90 px-4 py-3 backdrop-blur">
        <h1 className="text-xl font-bold">Buscar</h1>
      </header>

      <div className="border-b border-zinc-800 px-4 py-3">
        <div className="flex items-center gap-3 rounded-full bg-zinc-900 px-4 py-2.5">
          <Search className="h-5 w-5 shrink-0 text-zinc-500" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar usuarios"
            className="w-full bg-transparent text-white outline-none placeholder:text-zinc-600"
          />
        </div>
      </div>

      {isLoading && (
        <div className="px-4 py-8 text-center text-sm text-zinc-500">
          Buscando...
        </div>
      )}

      {error && !isLoading && (
        <ErrorState
          message={error}
          onRetry={() => searchUsers(debouncedQuery)}
        />
      )}

      {!isLoading && !error && hasSearched && users.length === 0 && (
        <EmptyState
          title="No se encontraron usuarios"
          description="Probá con otro nombre o usuario."
        />
      )}

      {!isLoading &&
        !error &&
        users.map((user) => (
          <UserCard key={user.id} user={user} onFollow={handleFollow} />
        ))}
    </div>
  );
}
