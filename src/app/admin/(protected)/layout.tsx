import { requireAdmin } from "@/lib/admin-guard";
import { PlayerNav } from "@/components/player-nav";

export const dynamic = "force-dynamic";

export default async function AdminProtectedLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireAdmin();
  return (
    <div className="flex min-h-full flex-col">
      <PlayerNav />
      {children}
      <footer className="mt-auto py-4 text-center text-xs text-zinc-300 dark:text-zinc-700" dir="ltr">
        {process.env.NEXT_PUBLIC_COMMIT_HASH ?? "dev"}
        {process.env.NEXT_PUBLIC_COMMIT_DATE && (
          <span> · {process.env.NEXT_PUBLIC_COMMIT_DATE}</span>
        )}
      </footer>
    </div>
  );
}
