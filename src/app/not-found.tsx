import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center gap-6 px-4 py-24 text-center">
      <p className="text-8xl font-bold tracking-tight text-zinc-200 dark:text-zinc-800">
        404
      </p>
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          הדף לא נמצא
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          הדף שחיפשת אינו קיים או הוסר.
        </p>
      </div>
      <Link
        href="/"
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        חזרה לדף הבית
      </Link>
    </div>
  );
}
