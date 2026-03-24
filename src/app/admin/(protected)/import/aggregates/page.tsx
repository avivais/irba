import type { Metadata } from "next";
import { ImportAggregatesClient } from "./_client";

export const metadata: Metadata = { title: "ייבוא נוכחות עבר" };

export default function AdminImportAggregatesPage() {
  return <ImportAggregatesClient />;
}
