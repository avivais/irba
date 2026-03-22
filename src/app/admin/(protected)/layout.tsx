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
  return children;
}
