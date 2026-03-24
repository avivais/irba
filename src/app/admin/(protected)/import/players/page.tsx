import type { Metadata } from "next";
import { ImportPlayersClient } from "./_client";

export const metadata: Metadata = { title: "ייבוא שחקנים" };

export default function AdminImportPlayersPage() {
  return <ImportPlayersClient />;
}
