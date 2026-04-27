"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { runVerification, issueTestOtp } from "@/app/admin/(protected)/testing/verify-actions";
import { STEPS, STEP_GROUPS, type StepDef } from "./step-definitions";

type StepStatus = "pending" | "verifying" | "pass" | "fail" | "manual";

function OtpLookup({ defaultPhone }: { defaultPhone: string | "custom" }) {
  const [phone, setPhone] = useState(defaultPhone === "custom" ? "" : defaultPhone);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    if (!phone.trim()) return;
    setStatus("sending");
    setError(null);
    const res = await issueTestOtp(phone.trim());
    if (res.ok) {
      setStatus("sent");
      setTimeout(() => setStatus("idle"), 8000);
    } else {
      setStatus("error");
      setError(res.error ?? "שגיאה");
    }
  }

  return (
    <div className="mb-3 rounded-lg border border-purple-200 bg-purple-50 p-3">
      <p className="mb-2 text-xs font-medium text-purple-700">שלח OTP ל-WA שלי</p>
      <div className="flex gap-2">
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="05xxxxxxxx"
          className="flex-1 rounded-md border border-purple-200 bg-white px-2 py-1 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
          dir="ltr"
        />
        <button
          onClick={handleSend}
          disabled={status === "sending" || !phone.trim()}
          className="rounded-md bg-purple-600 px-3 py-1 text-xs font-medium text-white hover:bg-purple-700 disabled:opacity-50"
        >
          {status === "sending" ? "..." : "שלח"}
        </button>
      </div>
      {status === "sent" && (
        <p className="mt-2 text-xs text-green-700">הקוד נשלח ל-WA שלך — תוקף 10 דקות</p>
      )}
      {status === "error" && error && (
        <p className="mt-2 text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}

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

const STORAGE_KEY = "irba-test-plan-results";

export function TestPlan() {
  const [results, setResults] = useState<Record<string, StepResult>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? (JSON.parse(saved) as Record<string, StepResult>) : {};
    } catch {
      return {};
    }
  });
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["0.1"]));
  const [isPending, startTransition] = useTransition();
  const stepRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const didInitialScroll = useRef(false);

  useEffect(() => {
    if (didInitialScroll.current) return;
    didInitialScroll.current = true;
    const firstUntested = STEPS.find((s) => {
      const st = results[s.id]?.status;
      return st !== "pass" && st !== "manual";
    });
    if (!firstUntested || firstUntested.id === STEPS[0].id) return;
    requestAnimationFrame(() => {
      setExpanded((prev) => new Set(prev).add(firstUntested.id));
      stepRefs.current[firstUntested.id]?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
  }, [results]);

  function persistResults(next: Record<string, StepResult>) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }

  function clearAll() {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    setResults({});
    setExpanded(new Set(["0.1"]));
  }

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

  function resetStep(id: string) {
    setResults((prev) => {
      const next = { ...prev };
      delete next[id];
      persistResults(next);
      return next;
    });
  }

  function handleVerify(step: StepDef, index: number) {
    if (!isUnlocked(index)) return;

    setResults((prev) => {
      const next = { ...prev, [step.id]: { status: "verifying" as StepStatus } };
      persistResults(next);
      return next;
    });
    setExpanded((prev) => new Set(prev).add(step.id));

    startTransition(async () => {
      const result = await runVerification(step.id);
      const status: StepStatus = result.manual ? "manual" : result.pass ? "pass" : "fail";
      setResults((prev) => {
        const next = { ...prev, [step.id]: { status, detail: result.detail } };
        persistResults(next);
        return next;
      });

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
          <div className="flex items-center gap-3">
            <span className="text-sm text-zinc-500">{passCount} / {total} צעדים</span>
            <button
              onClick={clearAll}
              className="text-xs text-zinc-400 hover:text-red-500 transition-colors"
            >
              נקה הכל
            </button>
          </div>
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
                    ref={(el) => { stepRefs.current[step.id] = el; }}
                    className={`rounded-xl border transition-colors ${stepBorder(status)} ${!unlocked ? "opacity-40" : ""}`}
                  >
                    {/* Step header */}
                    <div className="flex w-full items-center gap-3 px-4 py-3 text-right">
                      <StatusIcon status={status} />
                      <span className="min-w-[2.5rem] text-xs font-mono text-zinc-400">
                        {step.id}
                      </span>
                      <button
                        className="flex-1 text-right text-sm font-medium text-zinc-800 disabled:cursor-default"
                        onClick={() => unlocked && toggleExpanded(step.id)}
                        disabled={!unlocked}
                      >
                        {step.title}
                      </button>
                      {unlocked && status !== "pending" && (
                        <button
                          onClick={() => resetStep(step.id)}
                          className="text-zinc-300 hover:text-red-400 transition-colors text-sm px-1"
                          title="אפס שלב זה"
                        >
                          ✕
                        </button>
                      )}
                      {unlocked && (
                        <button
                          onClick={() => toggleExpanded(step.id)}
                          className="text-xs text-zinc-400"
                        >
                          {isExpanded ? "▲" : "▼"}
                        </button>
                      )}
                    </div>

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

                        {/* OTP lookup */}
                        {step.otpPhone && <OtpLookup defaultPhone={step.otpPhone} />}

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
