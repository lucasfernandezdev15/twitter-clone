import Link from "next/link";

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0f0f0f] px-4 py-8 text-white">
      <div className="mb-8 flex flex-col items-center gap-2">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-500 text-xl font-bold">
            T
          </span>
          <span className="text-2xl font-bold tracking-tight">Twitterly</span>
        </Link>
        <p className="text-sm text-zinc-500">Lo que está pasando ahora</p>
      </div>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
