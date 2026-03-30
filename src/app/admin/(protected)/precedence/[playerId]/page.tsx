import { redirect } from "next/navigation";

type Props = { params: Promise<{ playerId: string }> };

export default async function PlayerPrecedencePage({ params }: Props) {
  const { playerId } = await params;
  redirect(`/admin/players/${playerId}/edit`);
}
