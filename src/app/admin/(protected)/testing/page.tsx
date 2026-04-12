import { requireAdmin } from "@/lib/admin-guard";
import { listSnapshots } from "./snapshot-actions";
import { SnapshotManager } from "@/components/admin/testing/snapshot-manager";
import { TestPlan } from "@/components/admin/testing/test-plan";

export default async function TestingPage() {
  await requireAdmin();
  const snapshots = await listSnapshots();

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">בדיקות מקצה לקצה</h1>
        <p className="mt-1 text-sm text-zinc-500">
          מערכת בדיקות אינטראקטיבית — בצע כל צעד ולחץ "בדוק" כדי לאמת את מצב ה-DB.
        </p>
      </div>

      <SnapshotManager initialSnapshots={snapshots} />

      <TestPlan />
    </div>
  );
}
