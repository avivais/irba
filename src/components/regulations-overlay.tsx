"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { Loader2, ScrollText } from "lucide-react";
import { acceptRegulationsAction } from "@/app/actions/regulations";
import {
  parseRegulationsTemplate,
  type RenderedBlock,
  type RenderedSpan,
} from "@/lib/regulations-renderer";

type Props = {
  templateText: string;
  configValues: Record<string, string>;
};

export function renderSpans(spans: RenderedSpan[]) {
  return spans.map((span, i) =>
    span.type === "bold" ? (
      <strong key={i} className="font-semibold text-zinc-100">
        {span.text}
      </strong>
    ) : (
      <span key={i}>{span.text}</span>
    )
  );
}

export function RegulationsContent({ blocks }: { blocks: RenderedBlock[] }) {
  return (
    <div className="space-y-1">
      {blocks.map((block, i) => {
        if (block.type === "heading") {
          return (
            <h3
              key={i}
              className="mt-6 first:mt-0 text-base font-bold text-zinc-100"
            >
              {renderSpans(block.spans)}
            </h3>
          );
        }
        if (block.type === "subheading") {
          return (
            <h4
              key={i}
              className="mt-4 text-sm font-semibold text-zinc-200"
            >
              {renderSpans(block.spans)}
            </h4>
          );
        }
        if (block.type === "list") {
          return (
            <ul key={i} className="mt-1 space-y-1 pe-4 text-sm leading-relaxed text-zinc-300">
              {block.items.map((item, li) => (
                <li key={li} className="flex gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-500" aria-hidden />
                  <span>{renderSpans(item)}</span>
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="text-sm leading-relaxed text-zinc-300">
            {renderSpans(block.spans)}
          </p>
        );
      })}
    </div>
  );
}

export function RegulationsOverlay({ templateText, configValues }: Props) {
  const [canAccept, setCanAccept] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const blocks = useMemo(
    () => parseRegulationsTemplate(templateText, configValues),
    [templateText, configValues]
  );

  useEffect(() => {
    const sentinel = sentinelRef.current;
    const scrollEl = scrollRef.current;
    if (!sentinel || !scrollEl) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setCanAccept(true);
      },
      // root must be the scrollable div, not the viewport (we're inside a fixed overlay)
      { root: scrollEl, threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  async function handleAccept() {
    setPending(true);
    setError(null);
    const result = await acceptRegulationsAction();
    if (result.ok) {
      setAccepted(true);
    } else {
      setError(result.message ?? "אירעה שגיאה, נסה שוב");
      setPending(false);
    }
  }

  if (accepted) return null;

  return (
    <div
      role="dialog"
      aria-modal
      aria-label="תקנון IRBA"
      className="fixed inset-0 z-50 flex flex-col bg-zinc-950/98 backdrop-blur-sm"
    >
      {/* Header */}
      <div className="shrink-0 border-b border-zinc-800 bg-zinc-900 px-5 py-4">
        <div className="flex items-center gap-2">
          <ScrollText className="h-5 w-5 text-zinc-400" />
          <h2 className="text-lg font-bold text-zinc-100">תקנון IRBA</h2>
        </div>
        <p className="mt-1 text-sm text-zinc-400">
          יש לקרוא ולאשר את התקנון לפני שניתן להמשיך.
        </p>
      </div>

      {/* Scrollable content */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-5 py-5"
        tabIndex={-1}
      >
        <RegulationsContent blocks={blocks} />
        {/* Sentinel — IntersectionObserver watches this to enable the Accept button */}
        <div ref={sentinelRef} className="h-px" aria-hidden />
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-zinc-800 bg-zinc-900 px-5 py-4">
        {!canAccept && (
          <p className="mb-3 text-center text-sm text-zinc-400">
            גלול עד סוף התקנון כדי לאשר
          </p>
        )}
        {error && (
          <p className="mb-3 text-center text-sm text-red-400">{error}</p>
        )}
        <button
          onClick={handleAccept}
          disabled={!canAccept || pending}
          className="flex min-h-14 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-green-600 px-6 py-4 text-lg font-semibold text-white shadow-md transition hover:bg-green-700 focus:outline-none focus:ring-4 focus:ring-green-600/40 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            "קראתי ואני מאשר/ת את התקנון"
          )}
        </button>
      </div>
    </div>
  );
}
