"use client";

import { Heart, MessageCircle, UserPlus } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { formatRelativeTime } from "@/lib/format-relative-time";

import { Avatar } from "./avatar";

export type NotificationType = "LIKE" | "FOLLOW" | "REPLY";

export type NotificationItemData = {
  id: string;
  type: NotificationType;
  read: boolean;
  createdAt: string | Date;
  actor: {
    username: string;
    displayName: string;
    avatarUrl?: string | null;
  };
};

type NotificationItemProps = {
  notification: NotificationItemData;
};

const iconByType: Record<NotificationType, LucideIcon> = {
  LIKE: Heart,
  FOLLOW: UserPlus,
  REPLY: MessageCircle,
};

const iconColorByType: Record<NotificationType, string> = {
  LIKE: "text-pink-500",
  FOLLOW: "text-sky-500",
  REPLY: "text-emerald-500",
};

function getNotificationText(
  type: NotificationType,
  displayName: string
): string {
  switch (type) {
    case "LIKE":
      return `${displayName} liked your tweet`;
    case "FOLLOW":
      return `${displayName} followed you`;
    case "REPLY":
      return `${displayName} replied to your tweet`;
  }
}

export function NotificationItem({ notification }: NotificationItemProps) {
  const Icon = iconByType[notification.type];

  return (
    <article
      className={`flex gap-3 border-b border-zinc-800 px-4 py-4 transition ${
        notification.read ? "bg-transparent" : "bg-sky-500/5"
      }`}
    >
      <div
        className={`mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-900 ${iconColorByType[notification.type]}`}
      >
        <Icon className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <Avatar
            src={notification.actor.avatarUrl}
            name={notification.actor.displayName}
            size="sm"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm leading-relaxed text-zinc-200">
              {getNotificationText(
                notification.type,
                notification.actor.displayName
              )}
            </p>
            <time
              className="mt-1 block text-xs text-zinc-500"
              dateTime={new Date(notification.createdAt).toISOString()}
            >
              {formatRelativeTime(notification.createdAt)}
            </time>
          </div>
        </div>
      </div>
    </article>
  );
}
