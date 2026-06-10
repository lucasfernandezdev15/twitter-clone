"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { apiFetch } from "@/lib/api-client";
import { useAuth } from "@/lib/context/auth-context";

import { BottomNav } from "./bottom-nav";
import { Sidebar } from "./sidebar";

export function MainShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const data = await apiFetch<{ count: number }>(
        "/api/notifications/unread-count"
      );
      setUnreadCount(data.count);
    } catch {
      setUnreadCount(0);
    }
  }, []);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace(`/login?from=${encodeURIComponent(pathname)}`);
    }
  }, [isLoading, isAuthenticated, pathname, router]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchUnreadCount();
    }
  }, [isAuthenticated, pathname, fetchUnreadCount]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f0f0f] text-zinc-500">
        Cargando...
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white">
      <div className="mx-auto flex min-h-screen max-w-6xl">
        <Sidebar unreadCount={unreadCount} />
        <main className="min-h-screen flex-1 border-x border-zinc-800 pb-20 md:pb-0">
          {children}
        </main>
      </div>
      <BottomNav unreadCount={unreadCount} />
    </div>
  );
}
