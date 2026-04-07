"use client";

import { useMemo, useState } from "react";
import { ScrollText, X } from "lucide-react";
import { parseRegulationsTemplate } from "@/lib/regulations-renderer";
import { RegulationsContent } from "@/components/regulations-overlay";

type Props = {
  templateText: string;
  configValues: Record<string, string>;
};

export function RegulationsViewer({ templateText, configValues }: Props) {
  const [open, setOpen] = useState(false);

  const blocks = useMemo(
    () => parseRegulationsTemplate(templateText, configValues),
    [templateText, configValues]
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm font-medium text-zinc-600 underline underline-offset-2 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        קרא את התקנון
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal
          aria-label="תקנון IRBA"
          className="fixed inset-0 z-50 flex flex-col bg-zinc-950/98 backdrop-blur-sm"
        >
          {/* Header */}
          <div className="shrink-0 border-b border-zinc-800 bg-zinc-900 px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ScrollText className="h-5 w-5 text-zinc-400" aria-hidden />
                <h2 className="text-lg font-bold text-zinc-100">תקנון IRBA</h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
                aria-label="סגור"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
          </div>

          {/* Backdrop click to close */}
          <div
            className="flex-1 overflow-y-auto px-5 py-5"
            onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
          >
            <RegulationsContent blocks={blocks} />
          </div>
        </div>
      )}
    </>
  );
}
