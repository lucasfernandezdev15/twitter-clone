export function TweetSkeleton() {
  return (
    <div className="animate-pulse border-b border-zinc-800 px-4 py-3">
      <div className="flex gap-3">
        <div className="h-10 w-10 shrink-0 rounded-full bg-zinc-800" />
        <div className="flex-1 space-y-2">
          <div className="flex gap-2">
            <div className="h-4 w-24 rounded bg-zinc-800" />
            <div className="h-4 w-16 rounded bg-zinc-800" />
          </div>
          <div className="h-4 w-full rounded bg-zinc-800" />
          <div className="h-4 w-3/4 rounded bg-zinc-800" />
          <div className="mt-2 h-4 w-12 rounded bg-zinc-800" />
        </div>
      </div>
    </div>
  );
}

export function TweetSkeletonList({ count = 3 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <TweetSkeleton key={index} />
      ))}
    </>
  );
}
