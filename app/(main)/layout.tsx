import { MainShell } from "@/components/main-shell";

export default function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <MainShell>{children}</MainShell>;
}
