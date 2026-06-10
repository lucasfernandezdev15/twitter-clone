"use client";

import { Bell, Home, Search, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useAuth } from "@/lib/context/auth-context";

type SidebarProps = {
  unreadCount?: number;
};

const navItemsBase = [
  { href: "/home", label: "Inicio", icon: Home },
  { href: "/search", label: "Buscar", icon: Search },
  {
    href: "/notifications",
    label: "Notificaciones",
    icon: Bell,
    showBadge: true,
  },
] as const;

export function Sidebar({ unreadCount = 0 }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const profileHref = user ? `/${user.username}` : "/profile";

  const navItems = [
    ...navItemsBase,
    { href: profileHref, label: "Perfil", icon: User },
  ] as const;

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-zinc-800 px-3 py-4 md:flex">
      <Link href="/home" className="mb-6 flex items-center gap-2 px-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-500 text-lg font-bold">
          T
        </span>
        <span className="text-xl font-bold">Twitterly</span>
      </Link>

      <nav className="flex flex-1 flex-col gap-1">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-4 rounded-full px-4 py-3 text-lg transition ${
                isActive
                  ? "font-bold text-white"
                  : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
              }`}
            >
              <span className="relative">
                <Icon className="h-6 w-6" />
                {"showBadge" in item && unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-sky-500 px-1 text-[10px] font-bold text-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {user && (
        <div className="mt-auto rounded-full px-4 py-3 hover:bg-zinc-900">
          <p className="truncate text-sm font-bold">{user.displayName}</p>
          <p className="truncate text-sm text-zinc-500">@{user.username}</p>
        </div>
      )}
    </aside>
  );
}
