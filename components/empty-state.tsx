type EmptyStateProps = {
  title: string;
  description?: string;
};

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <p className="text-lg font-semibold text-zinc-300">{title}</p>
      {description && (
        <p className="mt-2 max-w-sm text-sm text-zinc-500">{description}</p>
      )}
    </div>
  );
}
