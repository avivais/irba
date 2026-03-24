"use client";

import { useRef, useState } from "react";
import { Upload, ClipboardPaste, CheckCircle, XCircle, Loader2 } from "lucide-react";
import type { RowError } from "@/lib/csv-import";
import type { ImportResult } from "@/app/admin/(protected)/import/players/actions";

export type PreviewRow = {
  label: string; // short description shown in preview table
  valid: true;
} | {
  label: string;
  valid: false;
  error: string;
};

type Props<T> = {
  title: string;
  description: string;
  templateHint: string;
  parse: (text: string) => { rows: T[]; errors: RowError[] };
  buildPreview: (rows: T[], errors: RowError[]) => PreviewRow[];
  onImport: (rows: T[]) => Promise<ImportResult>;
  backHref: string;
};

export function ImportUploadPage<T>({
  title,
  description,
  templateHint,
  parse,
  buildPreview,
  onImport,
  backHref,
}: Props<T>) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [inputMode, setInputMode] = useState<"file" | "paste">("file");
  const [pasteText, setPasteText] = useState("");
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [validRows, setValidRows] = useState<T[]>([]);
  const [status, setStatus] = useState<"idle" | "importing" | "done" | "error">("idle");
  const [result, setResult] = useState<ImportResult | null>(null);

  function processText(text: string) {
    const parsed = parse(text);
    setValidRows(parsed.rows);
    setPreview(buildPreview(parsed.rows, parsed.errors));
    setStatus("idle");
    setResult(null);
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => processText(ev.target?.result as string);
    reader.readAsText(file, "utf-8");
  }

  function handleParsePaste() {
    processText(pasteText);
  }

  function switchMode(mode: "file" | "paste") {
    setInputMode(mode);
    setPreview(null);
    setValidRows([]);
    setStatus("idle");
    setResult(null);
    setPasteText("");
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleImport() {
    if (validRows.length === 0) return;
    setStatus("importing");
    try {
      const res = await onImport(validRows);
      setResult(res);
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  const validCount = preview?.filter((r) => r.valid).length ?? 0;
  const errorCount = preview?.filter((r) => !r.valid).length ?? 0;

  const tabBase = "flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-zinc-400/40";
  const tabActive = "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100";
  const tabInactive = "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200";

  return (
    <div className="flex min-h-full flex-1 flex-col px-4 pb-10 pt-6 sm:px-6">
      <header className="mx-auto flex w-full max-w-2xl md:max-w-4xl items-center gap-3">
        <a
          href={backHref}
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          → חזרה
        </a>
        <span className="text-zinc-300 dark:text-zinc-600">|</span>
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">{title}</h1>
      </header>

      <section className="mx-auto mt-6 w-full max-w-2xl md:max-w-4xl space-y-4">
        {/* Description + template hint */}
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{description}</p>
          <pre className="mt-2 overflow-x-auto rounded-md bg-zinc-50 p-2 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 ltr">
            {templateHint}
          </pre>
        </div>

        {/* Input mode tabs */}
        <div className="flex items-center gap-1 rounded-xl border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-700 dark:bg-zinc-800/50">
          <button
            type="button"
            onClick={() => switchMode("file")}
            className={`${tabBase} ${inputMode === "file" ? tabActive : tabInactive}`}
          >
            <Upload className="h-4 w-4" aria-hidden />
            העלה קובץ
          </button>
          <button
            type="button"
            onClick={() => switchMode("paste")}
            className={`${tabBase} ${inputMode === "paste" ? tabActive : tabInactive}`}
          >
            <ClipboardPaste className="h-4 w-4" aria-hidden />
            הדבק טקסט
          </button>
        </div>

        {/* File input */}
        {inputMode === "file" && (
          <div className="flex items-center gap-3">
            <label
              htmlFor="csv-file"
              className="flex cursor-pointer items-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <Upload className="h-4 w-4" aria-hidden />
              בחר קובץ CSV
            </label>
            <input
              id="csv-file"
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={handleFile}
            />
            {preview !== null && (
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                {validCount} שורות תקינות, {errorCount} שגיאות
              </span>
            )}
          </div>
        )}

        {/* Paste input */}
        {inputMode === "paste" && (
          <div className="flex flex-col gap-2">
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              rows={8}
              placeholder={`הדבק CSV כאן…\n${templateHint}`}
              className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 font-mono text-xs text-zinc-800 shadow-sm focus:border-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-600/30 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:focus:border-zinc-500 dark:focus:ring-zinc-500/30 ltr"
              dir="ltr"
            />
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={!pasteText.trim()}
                onClick={handleParsePaste}
                className="flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-400/40 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                נתח CSV
              </button>
              {preview !== null && (
                <span className="text-sm text-zinc-500 dark:text-zinc-400">
                  {validCount} שורות תקינות, {errorCount} שגיאות
                </span>
              )}
            </div>
          </div>
        )}

        {/* Preview table */}
        {preview !== null && preview.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-700">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-800">
                <tr>
                  <th className="w-10 py-2 pr-4 text-right font-medium text-zinc-500">#</th>
                  <th className="py-2 pr-4 text-right font-medium text-zinc-500">נתון</th>
                  <th className="w-8 py-2 pl-4 text-center font-medium text-zinc-500">סטטוס</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 bg-white dark:divide-zinc-700 dark:bg-zinc-900">
                {preview.map((row, i) => (
                  <tr key={i}>
                    <td className="py-2 pr-4 text-right text-zinc-400">{i + 1}</td>
                    <td className="py-2 pr-4 text-right text-zinc-700 dark:text-zinc-300">
                      {row.valid ? row.label : (
                        <span>
                          {row.label && <span className="text-zinc-500">{row.label} — </span>}
                          <span className="text-red-600 dark:text-red-400">{row.error}</span>
                        </span>
                      )}
                    </td>
                    <td className="py-2 pl-4 text-center">
                      {row.valid ? (
                        <CheckCircle className="inline h-4 w-4 text-green-500" aria-label="תקין" />
                      ) : (
                        <XCircle className="inline h-4 w-4 text-red-500" aria-label="שגיאה" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Import button */}
        {validCount > 0 && status !== "done" && (
          <button
            type="button"
            disabled={status === "importing"}
            onClick={handleImport}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 px-6 py-3 text-base font-semibold text-white shadow-md transition hover:bg-zinc-800 focus:outline-none focus:ring-4 focus:ring-zinc-600/40 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 sm:w-auto sm:min-w-[14rem]"
          >
            {status === "importing" ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                מייבא…
              </>
            ) : (
              `ייבא ${validCount} שורות`
            )}
          </button>
        )}

        {/* Result */}
        {status === "done" && result && (
          <div className="rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950/30">
            <p className="font-medium text-green-800 dark:text-green-300">
              יובאו {result.imported} שורות בהצלחה
            </p>
            {result.errors.length > 0 && (
              <ul className="mt-2 space-y-0.5">
                {result.errors.map((e, i) => (
                  <li key={i} className="text-sm text-red-700 dark:text-red-400">{e}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {status === "error" && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-900 dark:bg-red-950/50 dark:text-red-100">
            אירעה שגיאה. נסה שוב.
          </p>
        )}
      </section>
    </div>
  );
}
