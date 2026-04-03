"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const options = [
  { value: "dark" as const, label: "כהה", Icon: Moon },
  { value: "system" as const, label: "התאם למכשיר", Icon: Monitor },
  { value: "light" as const, label: "בהיר", Icon: Sun },
];

function useIsClient() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

/**
 * Compact theme control: shows only the active theme icon.
 * Clicking opens a small popover with all three options.
 */
export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const mounted = useIsClient();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  if (!mounted) {
    return (
      <div
        className="h-9 w-9 rounded-lg border border-zinc-200 bg-zinc-100/80 dark:border-zinc-700 dark:bg-zinc-800/50"
        aria-hidden
      />
    );
  }

  const ActiveIcon =
    options.find((o) => o.value === theme)?.Icon ??
    (resolvedTheme === "dark" ? Moon : Sun);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="מצב תצוגה"
        aria-expanded={open}
        aria-haspopup="true"
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-100/80 text-zinc-600 shadow-sm transition-colors hover:bg-zinc-200/80 hover:text-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2 dark:border-zinc-600 dark:bg-zinc-800/80 dark:text-zinc-400 dark:hover:bg-zinc-700/80 dark:hover:text-zinc-100"
      >
        <ActiveIcon className="h-4 w-4 shrink-0" aria-hidden />
      </button>

      {open && (
        <div
          role="group"
          aria-label="בחר מצב תצוגה"
          className="absolute end-0 top-full mt-1.5 flex flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        >
          {options.map(({ value, label, Icon }) => {
            const selected = theme === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setTheme(value);
                  setOpen(false);
                }}
                aria-pressed={selected}
                className={`flex items-center gap-2.5 px-3.5 py-2.5 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-green-600 ${
                  selected
                    ? "bg-zinc-100 font-medium text-green-700 dark:bg-zinc-800 dark:text-green-400"
                    : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                <span className="whitespace-nowrap">{label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
