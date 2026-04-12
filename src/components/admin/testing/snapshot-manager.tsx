"use client";

import { useState, useTransition } from "react";
import { createSnapshot, restoreSnapshot, deleteSnapshot } from "@/app/admin/(protected)/testing/snapshot-actions";

type SnapshotFile = {
  filename: string;
  label: string;
  createdAt: string;
  sizeBytes: number;
};

type Props = {
  initialSnapshots: SnapshotFile[];
};

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("he-IL", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function SnapshotManager({ initialSnapshots }: Props) {
  const [snapshots, setSnapshots] = useState<SnapshotFile[]>(initialSnapshots);
  const [label, setLabel] = useState("");
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [confirmRestore, setConfirmRestore] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function showMsg(text: string, ok: boolean) {
    setMessage({ text, ok });
    setTimeout(() => setMessage(null), 5000);
  }

  function handleCreate() {
    if (!label.trim()) return;
    startTransition(async () => {
      let res: Awaited<ReturnType<typeof createSnapshot>>;
      try {
        res = await createSnapshot(label.trim());
      } catch (e) {
        showMsg(`שגיאה: ${String(e)}`, false);
        return;
      }
      if (res.ok && res.filename) {
        // Optimistically add to list
        const stat = { filename: res.filename, label: label.trim(), createdAt: new Date().toISOString(), sizeBytes: 0 };
        setSnapshots((prev) => [stat, ...prev]);
        setLabel("");
        showMsg("Snapshot נשמר בהצלחה", true);
      } else {
        showMsg(`שגיאה: ${res.error ?? "unknown"}`, false);
      }
    });
  }

  function handleRestore(filename: string) {
    startTransition(async () => {
      setConfirmRestore(null);
      const res = await restoreSnapshot(filename);
      if (res.ok) {
        showMsg("Snapshot שוחזר בהצלחה — רענן את הדף", true);
      } else {
        showMsg(`שגיאת שחזור: ${res.error ?? "unknown"}`, false);
      }
    });
  }

  function handleDelete(filename: string) {
    startTransition(async () => {
      setConfirmDelete(null);
      const res = await deleteSnapshot(filename);
      if (res.ok) {
        setSnapshots((prev) => prev.filter((s) => s.filename !== filename));
        showMsg("Snapshot נמחק", true);
      } else {
        showMsg(`שגיאת מחיקה: ${res.error ?? "unknown"}`, false);
      }
    });
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm" dir="rtl">
      <h2 className="mb-4 text-lg font-semibold text-zinc-800">ניהול Snapshots</h2>

      {/* Create */}
      <div className="mb-5 flex gap-2">
        <input
          type="text"
          placeholder="תווית Snapshot (לדוגמה: pre-test)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none"
          disabled={isPending}
        />
        <button
          onClick={handleCreate}
          disabled={isPending || !label.trim()}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          שמור Snapshot
        </button>
      </div>

      {/* Feedback */}
      {message && (
        <div
          className={`mb-4 rounded-lg px-4 py-2 text-sm ${message.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}
        >
          {message.text}
        </div>
      )}

      {/* List */}
      {snapshots.length === 0 ? (
        <p className="text-sm text-zinc-400">אין Snapshots שמורים</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-right text-xs text-zinc-500">
                <th className="pb-2 font-medium">תווית</th>
                <th className="pb-2 font-medium">תאריך</th>
                <th className="pb-2 font-medium">גודל</th>
                <th className="pb-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {snapshots.map((s) => (
                <tr key={s.filename} className="border-b border-zinc-50 last:border-0">
                  <td className="py-2 pr-0 font-medium text-zinc-800">{s.label}</td>
                  <td className="py-2 text-zinc-500">{fmtDate(s.createdAt)}</td>
                  <td className="py-2 text-zinc-400">{fmtSize(s.sizeBytes)}</td>
                  <td className="py-2">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setConfirmRestore(s.filename)}
                        disabled={isPending}
                        className="rounded-md bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                      >
                        שחזר
                      </button>
                      <button
                        onClick={() => setConfirmDelete(s.filename)}
                        disabled={isPending}
                        className="rounded-md bg-red-50 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-100 disabled:opacity-50"
                      >
                        מחק
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Restore confirmation */}
      {confirmRestore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl" dir="rtl">
            <h3 className="mb-2 text-base font-semibold text-zinc-800">אישור שחזור</h3>
            <p className="mb-5 text-sm text-zinc-600">
              פעולה זו תמחק את <strong>כל</strong> הנתונים הנוכחיים ותחזיר את ה-Snapshot.
              האפליקציה תהיה לא זמינה כמה שניות.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handleRestore(confirmRestore)}
                disabled={isPending}
                className="flex-1 rounded-lg bg-amber-600 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
              >
                כן, שחזר
              </button>
              <button
                onClick={() => setConfirmRestore(null)}
                className="flex-1 rounded-lg border border-zinc-200 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl" dir="rtl">
            <h3 className="mb-2 text-base font-semibold text-zinc-800">מחיקת Snapshot</h3>
            <p className="mb-5 text-sm text-zinc-600">
              האם למחוק את Snapshot <strong>{confirmDelete}</strong>? פעולה זו בלתי הפיכה.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handleDelete(confirmDelete)}
                disabled={isPending}
                className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                מחק
              </button>
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 rounded-lg border border-zinc-200 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
