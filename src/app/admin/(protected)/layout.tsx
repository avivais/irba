import { redirect } from "next/navigation";
import { getAdminSessionSubject } from "@/lib/admin-session";

export const dynamic = "force-dynamic";

export default async function AdminProtectedLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const subject = await getAdminSessionSubject();
  if (!subject) {
    redirect("/admin/login");
  }
  return (
    <div className="flex min-h-full flex-col">
      {children}
      <footer className="mt-auto py-4 text-center text-xs text-zinc-300 dark:text-zinc-700">
        {process.env.NEXT_PUBLIC_COMMIT_HASH ?? "dev"}
        {process.env.NEXT_PUBLIC_COMMIT_DATE && (
          <span> · {process.env.NEXT_PUBLIC_COMMIT_DATE}</span>
        )}
      </footer>
    </div>
  );
}
