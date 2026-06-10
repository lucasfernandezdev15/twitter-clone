"use client";

import { useCallback, useEffect, useState } from "react";

import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import {
  NotificationItem,
  type NotificationItemData,
} from "@/components/notification-item";
import { apiFetch } from "@/lib/api-client";

type NotificationsResponse = {
  notifications: NotificationItemData[];
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItemData[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadNotifications = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      await apiFetch("/api/notifications/read", { method: "POST" });

      const data = await apiFetch<NotificationsResponse>("/api/notifications");
      setNotifications(data.notifications);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudieron cargar las notificaciones"
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  return (
    <div>
      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-[#0f0f0f]/90 px-4 py-3 backdrop-blur">
        <h1 className="text-xl font-bold">Notificaciones</h1>
      </header>

      {isLoading && (
        <div className="px-4 py-8 text-center text-sm text-zinc-500">
          Cargando...
        </div>
      )}

      {error && !isLoading && (
        <ErrorState message={error} onRetry={loadNotifications} />
      )}

      {!isLoading && !error && notifications.length === 0 && (
        <EmptyState
          title="No tenés notificaciones"
          description="Cuando alguien interactúe con vos, aparecerá acá."
        />
      )}

      {!isLoading &&
        !error &&
        notifications.map((notification) => (
          <NotificationItem
            key={notification.id}
            notification={notification}
          />
        ))}
    </div>
  );
}
