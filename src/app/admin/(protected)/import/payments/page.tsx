import type { Metadata } from "next";
import { ImportPaymentsClient } from "./_client";

export const metadata: Metadata = { title: "ייבוא תשלומים" };

export default function AdminImportPaymentsPage() {
  return <ImportPaymentsClient />;
}
