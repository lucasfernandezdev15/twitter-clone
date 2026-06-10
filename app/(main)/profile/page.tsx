"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useAuth } from "@/lib/context/auth-context";

export default function ProfileRedirectPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && user) {
      router.replace(`/${user.username}`);
    }
  }, [isLoading, user, router]);

  return (
    <div className="px-4 py-8 text-center text-sm text-zinc-500">
      Redirigiendo...
    </div>
  );
}
