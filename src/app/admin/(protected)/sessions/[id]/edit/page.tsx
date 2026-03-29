import { redirect } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

export default async function AdminSessionsEditRedirect({ params }: Props) {
  const { id } = await params;
  redirect(`/admin/sessions/${id}`);
}
