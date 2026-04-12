"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { runVerification } from "@/app/admin/(protected)/testing/verify-actions";
import { STEPS, STEP_GROUPS, type StepDef } from "./step-definitions";

type StepStatus = "pending" | "verifying" | "pass" | "fail" | "manual";

type StepResult = {
  status: StepStatus;
  detail?: string;
};

function groupKey(stepId: string) {
  return stepId.split(".")[0];
}

function StatusIcon({ status }: { status: StepStatus }) {
  if (status === "pass") return <span className="text-green-500 text-base">✓</span>;
  if (status === "fail") return <span className="text-red-500 text-base">✗</span>;
  if (status === "manual") return <span className="text-blue-400 text-base">●</span>;
  if (status === "verifying") return <span className="text-amber-500 text-base animate-pulse">⟳</span>;
  return <span className="text-zinc-300 text-base">○</span>;
}

function stepBorder(status: StepStatus) {
  if (status === "pass") return "border-green-200 bg-green-50/40";
  if (status === "fail") return "border-red-200 bg-red-50/40";
  if (status === "manual") return "border-blue-200 bg-blue-50/20";
  return "border-zinc-100 bg-white";
}

export function TestPlan() {
  const [results, setResults] = useState<Record<string, StepResult>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["0.1"]));
  const [isPending, startTransition] = useTransition();

  function getStatus(id: string): StepStatus {
    return results[id]?.status ?? "pending";
  }

  // Step N is unlocked if the previous step has passed (or is the first step)
  function isUnlocked(stepIndex: number): boolean {
    if (stepIndex === 0) return true;
    const prevStatus = getStatus(STEPS[stepIndex - 1].id);
    return prevStatus === "pass" || prevStatus === "manual";
  }

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleVerify(step: StepDef, index: number) {
    if (!isUnlocked(index)) return;

    setResults((prev) => ({ ...prev, [step.id]: { status: "verifying" } }));
    setExpanded((prev) => new Set(prev).add(step.id));

    startTransition(async () => {
      const result = await runVerification(step.id);
      const status: StepStatus = result.manual ? "manual" : result.pass ? "pass" : "fail";
      setResults((prev) => ({ ...prev, [step.id]: { status, detail: result.detail } }));

      // Auto-expand next step if this one passed
      if ((status === "pass" || status === "manual") && index + 1 < STEPS.length) {
        setExpanded((prev) => new Set(prev).add(STEPS[index + 1].id));
      }
    });
  }

  const passCount = Object.values(results).filter(
    (r) => r.status === "pass" || r.status === "manual",
  ).length;
  const total = STEPS.length;

  return (
    <div className="space-y-6" dir="rtl">
      {/* Progress header */}
      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-zinc-700">התקדמות</span>
          <span className="text-sm text-zinc-500">
            {passCount} / {total} צעדים
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100">
          <div
            className="h-full rounded-full bg-green-500 transition-all duration-500"
            style={{ width: `${(passCount / total) * 100}%` }}
          />
        </div>
      </div>

      {/* Steps grouped */}
      {STEP_GROUPS.map((group) => {
        const groupSteps = STEPS.filter((s) => groupKey(s.id) === group.groupKey);
        const groupPassed = groupSteps.filter((s) => {
          const st = getStatus(s.id);
          return st === "pass" || st === "manual";
        }).length;
        const allPassed = groupPassed === groupSteps.length;

        return (
          <div key={group.groupKey}>
            {/* Group header */}
            <div className="mb-2 flex items-center gap-2">
              <span
                className={`text-xs font-semibold uppercase tracking-wide ${allPassed ? "text-green-600" : "text-zinc-400"}`}
              >
                {group.label}
              </span>
              <span className="text-xs text-zinc-400">
                {groupPassed}/{groupSteps.length}
              </span>
            </div>

            {/* Steps in group */}
            <div className="space-y-2">
              {groupSteps.map((step) => {
                const stepIndex = STEPS.findIndex((s) => s.id === step.id);
                const status = getStatus(step.id);
                const unlocked = isUnlocked(stepIndex);
                const isExpanded = expanded.has(step.id);

                return (
                  <div
                    key={step.id}
                    className={`rounded-xl border transition-colors ${stepBorder(status)} ${!unlocked ? "opacity-40" : ""}`}
                  >
                    {/* Step header */}
                    <button
                      className="flex w-full items-center gap-3 px-4 py-3 text-right"
                      onClick={() => unlocked && toggleExpanded(step.id)}
                      disabled={!unlocked}
                    >
                      <StatusIcon status={status} />
                      <span className="min-w-[2.5rem] text-xs font-mono text-zinc-400">
                        {step.id}
                      </span>
                      <span className="flex-1 text-sm font-medium text-zinc-800">
                        {step.title}
                      </span>
                      {unlocked && (
                        <span className="text-xs text-zinc-400">{isExpanded ? "▲" : "▼"}</span>
                      )}
                    </button>

                    {/* Expanded body */}
                    {isExpanded && unlocked && (
                      <div className="border-t border-zinc-100 px-4 pb-4 pt-3">
                        {/* Instructions */}
                        <ol className="mb-3 space-y-1 text-sm text-zinc-700">
                          {step.instructions.map((inst, i) => (
                            <li key={i} className="flex gap-2">
                              <span className="font-mono text-xs text-zinc-400 mt-0.5">{i + 1}.</span>
                              <span>{inst}</span>
                            </li>
                          ))}
                        </ol>

                        {/* Links */}
                        {step.links && step.links.length > 0 && (
                          <div className="mb-3 flex flex-wrap gap-2">
                            {step.links.map((link) => (
                              <Link
                                key={link.href}
                                href={link.href}
                                target="_blank"
                                className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
                              >
                                {link.label}
                                <span className="text-blue-400">↗</span>
                              </Link>
                            ))}
                          </div>
                        )}

                        {/* Note */}
                        {step.note && (
                          <p className="mb-3 rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-500">
                            {step.note}
                          </p>
                        )}

                        {/* Result */}
                        {results[step.id]?.detail && (
                          <div
                            className={`mb-3 rounded-lg px-3 py-2 text-xs ${
                              status === "pass" || status === "manual"
                                ? "bg-green-50 text-green-800"
                                : "bg-red-50 text-red-800"
                            }`}
                          >
                            {results[step.id].detail}
                          </div>
                        )}

                        {/* Verify button */}
                        <button
                          onClick={() => handleVerify(step, stepIndex)}
                          disabled={isPending || status === "verifying"}
                          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                            status === "pass" || status === "manual"
                              ? "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                              : "bg-blue-600 text-white hover:bg-blue-700"
                          } disabled:opacity-50`}
                        >
                          {status === "verifying"
                            ? "בודק..."
                            : status === "pass" || status === "manual"
                            ? "בדוק שוב"
                            : "בדוק"}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
