"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { sendWaGroupMessageAction, fetchWaStatusAction } from "@/app/admin/(protected)/wa/actions";
import { fetchWaGroupsAction } from "@/app/admin/(protected)/config/actions";
import { useToast, Toast } from "@/components/ui/toast";

type Props = { groupJid: string };

export function WaSendForm({ groupJid }: Props) {
  const [groupName, setGroupName] = useState<string | null>(null);
  const [sendPending, startSendTransition] = useTransition();
  const sendMessageRef = useRef<HTMLTextAreaElement>(null);
  const { showToast, dismiss, toast } = useToast();

  // Try to resolve JID → group name if bot is connected
  useEffect(() => {
    async function resolve() {
      const status = await fetchWaStatusAction();
      if (!status.ready) return;
      const result = await fetchWaGroupsAction();
      if (!result.ok) return;
      const match = result.groups.find((g) => g.id === groupJid);
      if (match) setGroupName(match.subject);
    }
    void resolve();
  }, [groupJid]);

  function handleSend() {
    const text = sendMessageRef.current?.value.trim() ?? "";
    const fd = new FormData();
    fd.append("message", text);
    startSendTransition(async () => {
      const result = await sendWaGroupMessageAction({ ok: false, message: "" }, fd);
      showToast(result.message, result.ok);
      if (result.ok && sendMessageRef.current) sendMessageRef.current.value = "";
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Group label */}
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">קבוצת יעד</p>
        <div className="flex flex-wrap items-center gap-2">
          {groupName && (
            <span className="rounded-full bg-zinc-100 px-3 py-1 text-sm font-medium text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
              {groupName}
            </span>
          )}
          <span className="font-mono text-xs text-zinc-400 dark:text-zinc-500" dir="ltr">
            {groupJid}
          </span>
        </div>
      </div>

      {/* Message textarea */}
      <div className="flex flex-col gap-1">
        <label htmlFor="wa-send-message" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          הודעה
        </label>
        <textarea
          id="wa-send-message"
          ref={sendMessageRef}
          rows={4}
          maxLength={1000}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-base text-zinc-900 shadow-sm focus:border-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-600/30 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-500 dark:focus:ring-zinc-500/30 resize-y"
        />
      </div>

      <button
        type="button"
        onClick={handleSend}
        disabled={sendPending}
        className="flex min-h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-green-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700 active:bg-green-800 focus:outline-none focus:ring-4 focus:ring-green-600/40 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
      >
        {sendPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            שולח…
          </>
        ) : (
          "שלח לקבוצה"
        )}
      </button>

      <Toast toast={toast} onDismiss={dismiss} />
    </div>
  );
}
