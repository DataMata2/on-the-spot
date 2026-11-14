"use client";
// Drill 2 "Clarify the vague task": hear a vague task, ask clarifying questions (voice or typed), confirm it back,
// then see which hidden details you found and confirmed. The server's engine grades; this only shows it.

import { useCallback, useEffect, useRef, useState } from "react";
import { Paywall } from "@/components/paywall";
import { AnswerCapture, MicExplainer, SLOW_RATE, TranscriptEditor, useSpeechToText, useTTS, type AnswerMode, type CapturedAnswer } from "@/components/voice";
import type { PublicScenario } from "@/lib/drill2/engine";
import type { Grade } from "@/lib/drill2/types";
import { addResult } from "@/lib/progress/store";
import { ResultCard } from "./ResultCard";

const MAX_CHARS = 600;

interface Progress {
  questionsAsked: number;
  found: number;
  hiddenCount: number;
  turnsLeft: number;
  hintsUsed: number;
}

interface Bubble {
  id: string;
  role: "manager" | "user" | "hint";
  text: string;
}

type Phase =
  | { k: "intro" }
  | { k: "starting" }
  | { k: "paywall"; reason: string }
  | { k: "ask" }
  | { k: "review-question" }
  | { k: "waiting" }
  | { k: "confirm" }
  | { k: "review-confirm" }
  | { k: "grading" }
  | { k: "result"; grade: Grade; input: "voice" | "typed" | "edited" }
  | { k: "error"; message: string; retry: "start" | "turn" | "confirm" };

const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`);

async function post<T>(url: string, body: unknown): Promise<{ status: number; data: T & { error?: string; code?: string } }> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string; code?: string };
  return { status: res.status, data };
}

export function ClarifyFlow() {
  const tts = useTTS();
  const stt = useSpeechToText({ maxMs: 45_000 });
  const [phase, setPhase] = useState<Phase>({ k: "intro" });
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [scenario, setScenario] = useState<PublicScenario | null>(null);
  const [transferFrom, setTransferFrom] = useState<string | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [thread, setThread] = useState<Bubble[]>([]);
  const [raw, setRaw] = useState("");
  const [edited, setEdited] = useState("");
  const [mode, setMode] = useState<AnswerMode>("voice");
  const [preferTyping, setPreferTyping] = useState(false);
  const [captureKey, setCaptureKey] = useState(0);
  const [nudge, setNudge] = useState<string | null>(null);
  const pendingId = useRef<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [thread.length]);

  const say = useCallback((text: string) => {
    if (tts.supported) void tts.speak(text);
  }, [tts]);

  const freshCapture = () => {
    stt.reset();
    setRaw("");
    setEdited("");
    setCaptureKey((k) => k + 1);
  };

  const start = async () => {
    tts.unlock(); // inside the click, before any await (iOS)
    setPhase({ k: "starting" });
    let r: Awaited<ReturnType<typeof post<{ sessionId: string; scenario: PublicScenario; transferFrom: string | null; progress: Progress }>>>;
    try {
      r = await post("/api/drill2/start", {});
    } catch {
      setPhase({ k: "error", message: "We couldn't reach the server. Check your connection and try again.", retry: "start" });
      return;
    }
    if (r.status === 402) {
      setPhase({ k: "paywall", reason: r.data.error ?? "Clarify the vague task is part of Pro." });
      return;
    }
    if (r.status !== 200 || !r.data.sessionId) {
      setPhase({ k: "error", message: r.data.error ?? "Something went wrong. Try again.", retry: "start" });
      return;
    }
    setSessionId(r.data.sessionId);
    setScenario(r.data.scenario);
    setTransferFrom(r.data.transferFrom);
    setProgress(r.data.progress);
    setThread([{ id: newId(), role: "manager", text: r.data.scenario.managerLine }]);
    setNudge(null);
    freshCapture();
    setPhase({ k: "ask" });
    say(r.data.scenario.managerLine);
  };

  const onCaptured = (a: CapturedAnswer, next: "review-question" | "review-confirm") => {
    setRaw(a.raw);
    setEdited(a.raw);
    setMode(a.mode);
    if (a.mode === "typed") {
      if (next === "review-question") void sendTurn(a.raw, a.raw, "typed");
      else void sendConfirm(a.raw, a.raw, "typed");
      return;
    }
    setPhase({ k: next });
  };

  const sendTurn = async (rawText: string, text: string, m: AnswerMode) => {
    if (!sessionId) return;
    const utterance = text.trim();
    if (!utterance) return;
    const requestId = pendingId.current ?? newId();
    pendingId.current = requestId;
    setPhase({ k: "waiting" });
    let r: Awaited<ReturnType<typeof post<{ reply: string; progress: Progress; suggestConfirm: boolean; offTopic: boolean; changed: boolean }>>>;
    try {
      r = await post("/api/drill2/turn", { sessionId, utterance, requestId });
    } catch {
      setRaw(rawText);
      setEdited(text);
      setMode(m);
      setPhase({ k: "error", message: "We couldn't reach the server. Your question wasn't lost: try again.", retry: "turn" });
      return;
    }
    if (r.status !== 200) {
      if (r.data.code === "turn_limit") {
        pendingId.current = null;
        setNudge(r.data.error ?? "Confirm the task now.");
        freshCapture();
        setPhase({ k: "confirm" });
        return;
      }
      setRaw(rawText);
      setEdited(text);
      setMode(m);
      setPhase({ k: "error", message: r.data.error ?? "Something went wrong. Try again.", retry: r.data.code === "session_gone" ? "start" : "turn" });
      return;
    }
    pendingId.current = null;
    setThread((t) => [...t, { id: newId(), role: "user", text: utterance }, { id: newId(), role: "manager", text: r.data.reply }]);
    setProgress(r.data.progress);
    setNudge(r.data.suggestConfirm ? "That sounded like a confirmation. Tap “Confirm the task” to say it back in full." : null);
    say(r.data.reply);
    freshCapture();
    setPhase({ k: "ask" });
  };

  const askHint = async () => {
    if (!sessionId) return;
    try {
      const r = await post<{ hint: string; progress: Progress }>("/api/drill2/hint", { sessionId, requestId: newId() });
      if (r.status !== 200) return;
      setProgress(r.data.progress);
      setThread((t) => [...t, { id: newId(), role: "hint", text: r.data.hint }]);
    } catch {
      /* a hint is optional */
    }
  };

  const sendConfirm = async (rawText: string, text: string, m: AnswerMode) => {
    if (!sessionId) return;
    const utterance = text.trim();
    if (!utterance) return;
    const input = m === "typed" ? "typed" : text.trim() !== rawText.trim() ? "edited" : "voice";
    setPhase({ k: "grading" });
    let r: Awaited<ReturnType<typeof post<{ grade: Grade; input: "voice" | "typed" | "edited" }>>>;
    try {
      r = await post("/api/drill2/confirm", { sessionId, utterance, requestId: newId(), input });
    } catch {
      setRaw(rawText);
      setEdited(text);
      setMode(m);
      setPhase({ k: "error", message: "We couldn't reach the server. Try again.", retry: "confirm" });
      return;
    }
    if (r.status !== 200 || !r.data.grade) {
      setRaw(rawText);
      setEdited(text);
      setMode(m);
      setPhase({ k: "error", message: r.data.error ?? "Something went wrong. Try again.", retry: r.data.code === "session_gone" ? "start" : "confirm" });
      return;
    }
    const grade = r.data.grade;
    setThread((t) => [...t, { id: newId(), role: "user", text: utterance }]);
    addResult({
      drill: "drill2",
      questionId: grade.scenarioId,
      help: grade.mode,
      verdict: null,
      words: utterance.split(/\s+/).filter(Boolean).length,
      edited: input === "edited",
      mode: m,
    });
    setPhase({ k: "result", grade, input: r.data.input ?? input });
  };

  const retry = () => {
    if (phase.k !== "error") return;
    if (phase.retry === "start") void start();
    else if (phase.retry === "turn") void sendTurn(raw, edited, mode);
    else void sendConfirm(raw, edited, mode);
  };

  const managerLine = scenario?.managerLine ?? "";
  const inScene = ["ask", "review-question", "waiting", "confirm", "review-confirm", "grading"].includes(phase.k);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="text-xs font-semibold tracking-wide text-accent uppercase">Drill 2 · Clarify the vague task</p>
        <h1 className="text-2xl font-semibold text-ink">{scenario && phase.k !== "intro" ? scenario.title : "Clarify the vague task"}</h1>
        {phase.k === "intro" && (
          <p className="text-base text-ink-2">
            Your manager gives you a task that&apos;s missing details. Ask clarifying questions out loud, then say the task back. We check which details you found and
            confirmed. We never score your accent.
          </p>
        )}
      </header>

      {phase.k === "intro" && (
        <div className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-5 sm:p-6">
          <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-base text-ink">
            <li>Listen to the task.</li>
            <li>Ask about what&apos;s unclear: one question at a time.</li>
            <li>Confirm: “So you want me to…”</li>
          </ol>
          <MicExplainer />
          <button type="button" onClick={() => void start()} className="h-12 rounded-md bg-accent px-6 font-semibold text-white hover:bg-accent-hover sm:self-start">
            Start the task
          </button>
        </div>
      )}

      {phase.k === "starting" && <Loading text="Getting your task…" />}

      {phase.k === "paywall" && (
        <div className="flex flex-col items-center gap-4">
          <Paywall reason={phase.reason} />
        </div>
      )}

      {scenario && (inScene || phase.k === "error") && (
        <>
          <div className="rounded-lg border border-line bg-surface p-4 sm:p-5">
            {transferFrom && (
              <p className="mb-2 text-xs font-semibold text-ink-3">New task, same skill as “{transferFrom}”</p>
            )}
            <p className="text-sm text-ink-2">{scenario.context}</p>
            <p className="mt-2 text-xs text-ink-3">
              {scenario.managerName}, {scenario.managerRole}
            </p>
            <div className="mt-3 flex flex-wrap gap-4 text-sm">
              <button type="button" className="font-semibold text-accent hover:underline" onClick={() => say(managerLine)}>
                Play again
              </button>
              <button type="button" className="font-semibold text-accent hover:underline" onClick={() => tts.supported && void tts.speak(managerLine, { rate: SLOW_RATE })}>
                Slower
              </button>
            </div>
          </div>

          <ol className="flex flex-col gap-3" aria-live="polite" aria-label="Conversation">
            {thread.map((b) => (
              <li key={b.id} className={b.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={
                    b.role === "user"
                      ? "max-w-[85%] rounded-2xl rounded-br-sm bg-accent px-4 py-2.5 text-base text-white"
                      : b.role === "hint"
                        ? "max-w-[85%] rounded-2xl border border-amber-mid/60 bg-amber-soft px-4 py-2.5 text-sm text-amber"
                        : "max-w-[85%] rounded-2xl rounded-bl-sm bg-surface px-4 py-2.5 text-base text-ink ring-1 ring-line"
                  }
                >
                  {b.role === "manager" && <span className="mb-0.5 block text-xs font-semibold text-ink-3">{scenario.managerName}</span>}
                  {b.role === "hint" && <span className="mb-0.5 block text-xs font-semibold">Hint</span>}
                  {b.text}
                </div>
              </li>
            ))}
            <div ref={endRef} />
          </ol>

          {progress && (
            <p className="text-sm text-ink-2 tabular-nums">
              Questions: {progress.questionsAsked} · Details found: {progress.found} of {progress.hiddenCount}
              {progress.hintsUsed > 0 && " · with help"}
            </p>
          )}
        </>
      )}

      {phase.k === "ask" && (
        <div className="flex flex-col gap-4 rounded-lg border border-line bg-paper p-4 sm:p-5">
          {nudge && <p className="rounded-md bg-amber-soft px-3 py-2 text-sm text-amber">{nudge}</p>}
          <p className="text-sm font-semibold text-ink">Ask {scenario?.managerName} a question</p>
          <AnswerCapture
            key={`q-${captureKey}`}
            stt={stt}
            preferTyping={preferTyping}
            onModeChange={(m) => setPreferTyping(m === "typed")}
            onCaptured={(a) => onCaptured(a, "review-question")}
            maxChars={MAX_CHARS}
            placeholder="e.g. Which numbers do you mean?"
          />
          <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
            <button
              type="button"
              onClick={() => {
                freshCapture();
                setNudge(null);
                setPhase({ k: "confirm" });
              }}
              className="h-11 rounded-md bg-ink px-5 font-semibold text-white hover:bg-ink-2"
            >
              Confirm the task
            </button>
            <button type="button" onClick={() => void askHint()} className="text-sm font-semibold text-accent hover:underline">
              I&apos;m stuck: give me a hint
            </button>
          </div>
        </div>
      )}

      {phase.k === "review-question" && (
        <div className="flex flex-col gap-4 rounded-lg border border-line bg-paper p-4 sm:p-5">
          <TranscriptEditor raw={raw} value={edited} onChange={setEdited} maxLength={MAX_CHARS} label="Your question" />
          <div className="flex flex-wrap items-center gap-4">
            <button type="button" onClick={() => void sendTurn(raw, edited, mode)} disabled={!edited.trim()} className="h-11 rounded-md bg-accent px-5 font-semibold text-white hover:bg-accent-hover disabled:opacity-45">
              Ask
            </button>
            <button type="button" onClick={() => { freshCapture(); setPhase({ k: "ask" }); }} className="text-sm font-semibold text-accent hover:underline">
              Say it again
            </button>
          </div>
        </div>
      )}

      {phase.k === "waiting" && <Loading text={`${scenario?.managerName ?? "Your manager"} is answering…`} />}

      {phase.k === "confirm" && (
        <div className="flex flex-col gap-4 rounded-lg border border-line bg-paper p-4 sm:p-5">
          {nudge && <p className="rounded-md bg-amber-soft px-3 py-2 text-sm text-amber">{nudge}</p>}
          <div>
            <p className="text-sm font-semibold text-ink">Confirm the task in your own words</p>
            <p className="mt-1 text-sm text-ink-2">Start with “So you want me to…” and say every detail: what, how, and when.</p>
          </div>
          <AnswerCapture
            key={`c-${captureKey}`}
            stt={stt}
            preferTyping={preferTyping}
            onModeChange={(m) => setPreferTyping(m === "typed")}
            onCaptured={(a) => onCaptured(a, "review-confirm")}
            maxChars={MAX_CHARS}
            placeholder="So you want me to…"
          />
          <button type="button" onClick={() => { freshCapture(); setPhase({ k: "ask" }); }} className="self-start text-sm font-semibold text-accent hover:underline">
            Back to questions
          </button>
        </div>
      )}

      {phase.k === "review-confirm" && (
        <div className="flex flex-col gap-4 rounded-lg border border-line bg-paper p-4 sm:p-5">
          <TranscriptEditor raw={raw} value={edited} onChange={setEdited} maxLength={MAX_CHARS} label="Your confirmation" />
          <div className="flex flex-wrap items-center gap-4">
            <button type="button" onClick={() => void sendConfirm(raw, edited, mode)} disabled={!edited.trim()} className="h-11 rounded-md bg-accent px-5 font-semibold text-white hover:bg-accent-hover disabled:opacity-45">
              Check my confirmation
            </button>
            <button type="button" onClick={() => { freshCapture(); setPhase({ k: "confirm" }); }} className="text-sm font-semibold text-accent hover:underline">
              Say it again
            </button>
          </div>
        </div>
      )}

      {phase.k === "grading" && <Loading text="Checking your confirmation…" />}

      {phase.k === "result" && <ResultCard grade={phase.grade} input={phase.input} onNext={() => void start()} />}

      {phase.k === "error" && (
        <div className="flex flex-col items-start gap-3 rounded-md border border-red/30 bg-red-soft p-4" role="alert">
          <p className="text-sm text-red">{phase.message}</p>
          <button type="button" onClick={retry} className="h-10 rounded-md bg-surface px-4 text-sm font-semibold text-ink ring-1 ring-line-strong hover:bg-paper">
            {phase.retry === "start" ? "Start a new task" : "Try again"}
          </button>
        </div>
      )}
    </div>
  );
}

function Loading({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-8 text-ink-2" role="status">
      <span className="size-4 animate-spin rounded-full border-2 border-accent border-t-transparent" aria-hidden="true" />
      {text}
    </div>
  );
}
