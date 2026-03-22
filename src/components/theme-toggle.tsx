"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

const options = [
  { value: "system" as const, label: "התאם למכשיר", Icon: Monitor },
  { value: "light" as const, label: "בהיר", Icon: Sun },
  { value: "dark" as const, label: "כהה", Icon: Moon },
];

/**
 * Three-way theme control: follow OS, light, or dark.
 * Deferred render until mounted so server/client markup match before hydration.
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        className="h-9 w-[7.5rem] rounded-lg border border-zinc-200 bg-zinc-100/80 dark:border-zinc-700 dark:bg-zinc-800/50"
        aria-hidden
      />
    );
  }

  return (
    <div
      role="group"
      aria-label="מצב תצוגה"
      className="inline-flex rounded-lg border border-zinc-200 bg-zinc-100/80 p-0.5 shadow-sm dark:border-zinc-600 dark:bg-zinc-800/80"
    >
      {options.map(({ value, label, Icon }) => {
        const selected = theme === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => setTheme(value)}
            title={label}
            aria-label={label}
            aria-pressed={selected}
            className={`flex h-8 w-9 items-center justify-center rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-100 dark:focus-visible:ring-offset-zinc-900 ${
              selected
                ? "bg-white text-green-700 shadow-sm dark:bg-zinc-700 dark:text-green-400"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
