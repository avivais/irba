"use client";

import { useActionState, useState } from "react";
import { Ban, Loader2, RotateCcw } from "lucide-react";
import {
  cancelSessionAction,
  uncancelSessionAction,
  type SessionActionState,
} from "@/app/admin/(protected)/sessions/actions";

const initialState: SessionActionState = { ok: false };

type Props = {
  id: string;
  cancelledAt: Date | null;
};

export function SessionCancelButton({ id, cancelledAt }: Props) {
  if (cancelledAt) return <UncancelButton id={id} />;
  return <CancelButton id={id} />;
}

function CancelButton({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const boundAction = cancelSessionAction.bind(null, id);
  const [state, formAction, pending] = useActionState(boundAction, initialState);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="בטל מפגש"
        className="flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50 active:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-300 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30 dark:active:bg-red-900/50 dark:focus:ring-red-700"
      >
        <Ban className="h-4 w-4" aria-hidden />
        בטל מפגש
      </button>
    );
  }

  return (
    <form
      action={formAction}
      className="flex w-full max-w-sm flex-col gap-2 rounded-lg border border-red-200 bg-red-50/50 p-3 dark:border-red-900 dark:bg-red-950/20"
      onSubmit={(e) => {
        const ok = window.confirm(
          "ביטול המפגש ימחק את כל ההרשמות (אין שחזור) וישלח הודעה לקבוצת הוואטסאפ. להמשיך?",
        );
        if (!ok) e.preventDefault();
      }}
    >
      <label className="text-xs font-medium text-red-900 dark:text-red-200">
        סיבת הביטול (לא חובה)
      </label>
      <textarea
        name="reason"
        rows={3}
        placeholder="למשל: גשם, חוסר שחקנים…"
        className="rounded-lg border border-red-200 bg-white px-2 py-1.5 text-sm text-zinc-900 focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-300 dark:border-red-900 dark:bg-zinc-900 dark:text-zinc-100"
      />
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-red-300 bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-red-700 active:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Ban className="h-4 w-4" aria-hidden />
          )}
          בטל מפגש
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={pending}
          className="min-h-9 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
        >
          ביטול
        </button>
      </div>
      {!state.ok && state.message && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {state.message}
        </p>
      )}
    </form>
  );
}

function UncancelButton({ id }: { id: string }) {
  const boundAction = uncancelSessionAction.bind(null, id);
  const [state, formAction, pending] = useActionState(boundAction, initialState);

  return (
    <div className="flex flex-col items-end gap-1">
      <form
        action={formAction}
        onSubmit={(e) => {
          const ok = window.confirm(
            "לשחזר את המפגש? ההרשמות הקודמות לא יחזרו.",
          );
          if (!ok) e.preventDefault();
        }}
      >
        <button
          type="submit"
          disabled={pending}
          title="שחזר מפגש"
          className="flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 active:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-300 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:active:bg-zinc-700"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <RotateCcw className="h-4 w-4" aria-hidden />
          )}
          שחזר ביטול
        </button>
      </form>
      {!state.ok && state.message && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {state.message}
        </p>
      )}
    </div>
  );
}
