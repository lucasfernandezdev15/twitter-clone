"use client";

import { FormEvent, useState } from "react";

import { useAuth } from "@/lib/context/auth-context";

import { Avatar } from "./avatar";

const MAX_LENGTH = 280;
const WARNING_THRESHOLD = 260;

type TweetComposerProps = {
  onSubmit: (content: string) => void | Promise<void>;
  placeholder?: string;
};

export function TweetComposer({
  onSubmit,
  placeholder = "¿Qué está pasando?",
}: TweetComposerProps) {
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const length = content.length;
  const isOverLimit = length > MAX_LENGTH;
  const isNearLimit = length >= WARNING_THRESHOLD;
  const canSubmit = content.trim().length > 0 && !isOverLimit && !isSubmitting;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }

    setIsSubmitting(true);

    try {
      await onSubmit(content.trim());
      setContent("");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border-b border-zinc-800 px-4 py-4"
    >
      <div className="flex gap-3">
        <Avatar
          src={null}
          name={user?.displayName ?? "Usuario"}
          size="md"
        />

        <div className="min-w-0 flex-1">
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder={placeholder}
            rows={3}
            className="w-full resize-none bg-transparent text-[15px] leading-relaxed text-white outline-none placeholder:text-zinc-600"
          />

          <div className="mt-3 flex items-center justify-between border-t border-zinc-800 pt-3">
            <span
              className={`text-sm tabular-nums ${
                isOverLimit || isNearLimit ? "text-red-500" : "text-zinc-500"
              }`}
            >
              {length}/{MAX_LENGTH}
            </span>

            <button
              type="submit"
              disabled={!canSubmit}
              className="rounded-full bg-sky-500 px-5 py-2 text-sm font-bold text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? "Publicando..." : "Publicar"}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
