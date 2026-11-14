"use client";
// Drill 2 "Clarify the vague task": hear a vague task, ask clarifying questions (voice or typed), confirm it back,
// then see which hidden details you found and confirmed. The server's engine grades; this only shows it.

import { errorMessage } from "@/lib/client-error";
import { useCallback, useEffect, useRef, useState } from "react";
import { Blob, PaperCard } from "@/components/kit";
import { buttonClasses } from "@/components/kit/Button";
import { Paywall } from "@/components/paywall";
import { AnswerCapture, MicExplainer, SLOW_RATE, TranscriptEditor, useSpeechToText, useTTS, type AnswerMode, type CapturedAnswer } from "@/components/voice";
import type { PublicScenario } from "@/lib/drill2/engine";
import type { Grade } from "@/lib/drill2/types";
import { loadRole, roleFields } from "@/lib/progress/role";
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

  const say = useCallback((text: string, token?: string) => {
    if (tts.supported) void tts.speak(text, { token });
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
      r = await post("/api/drill2/start", roleFields(loadRole()));
    } catch {
      setPhase({ k: "error", message: "We couldn't reach the server. Check your connection and try again.", retry: "start" });
      return;
    }
    if (r.status === 402) {
      setPhase({ k: "paywall", reason: r.data.error ?? "Clarify the vague task is part of Pro." });
      return;
    }
    if (r.status !== 200 || !r.data.sessionId) {
      setPhase({ k: "error", message: errorMessage(r.status, r.data.error, "Something went wrong. Try again."), retry: "start" });
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
    let r: Awaited<ReturnType<typeof post<{ reply: string; replyToken?: string; progress: Progress; suggestConfirm: boolean; offTopic: boolean; changed: boolean }>>>;
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
      setPhase({ k: "error", message: errorMessage(r.status, r.data.error, "Something went wrong. Try again."), retry: r.data.code === "session_gone" ? "start" : "turn" });
      return;
    }
    pendingId.current = null;
    setThread((t) => [...t, { id: newId(), role: "user", text: utterance }, { id: newId(), role: "manager", text: r.data.reply }]);
    setProgress(r.data.progress);
    setNudge(r.data.suggestConfirm ? "That sounded like a confirmation. Tap “Confirm the task” to say it back in full." : null);
    say(r.data.reply, r.data.replyToken);
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
    let r: Awaited<ReturnType<typeof post<{ grade: Grade | null; input: "voice" | "typed" | "edited"; reply?: string; replyToken?: string; progress?: Progress }>>>;
    try {
      r = await post("/api/drill2/confirm", { sessionId, utterance, requestId: newId(), input });
    } catch {
      setRaw(rawText);
      setEdited(text);
      setMode(m);
      setPhase({ k: "error", message: "We couldn't reach the server. Try again.", retry: "confirm" });
      return;
    }
    if (r.status === 200 && r.data.grade === null && r.data.reply) {
      // The manager changed a detail before grading: hear it, then confirm again.
      const reply = r.data.reply;
      setThread((t) => [...t, { id: newId(), role: "user", text: utterance }, { id: newId(), role: "manager", text: reply }]);
      if (r.data.progress) setProgress(r.data.progress);
      setNudge(`${scenario?.managerName ?? "Your manager"} just changed something. Confirm the task again with the latest details.`);
      say(reply, r.data.replyToken);
      freshCapture();
      setPhase({ k: "confirm" });
      return;
    }
    if (r.status !== 200 || !r.data.grade) {
      setRaw(rawText);
      setEdited(text);
      setMode(m);
      setPhase({ k: "error", message: errorMessage(r.status, r.data.error, "Something went wrong. Try again."), retry: r.data.code === "session_gone" ? "start" : "confirm" });
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
      <header className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <p className="type-label text-field-mark">Drill 2 · Clarify the vague task</p>
          <Blob state={phase.k === "result" ? "proud" : inScene ? "listening" : "thinking"} size={44} bob />
        </div>
        <h1 className={"type-display text-field-fg " + (phase.k === "intro" || phase.k === "paywall" ? "text-[clamp(40px,11vw,72px)] leading-[0.98]" : "text-[clamp(30px,8vw,48px)] leading-[1.02]")}>{phase.k === "paywall" ? "Want another task? Clarify is part of Pro." : scenario && phase.k !== "intro" ? scenario.title : "Clarify the vague task"}</h1>
        {phase.k === "intro" && (
          <p className="max-w-[56ch] text-lg text-field-muted">
            Your manager gives you a task that&apos;s missing details. Ask clarifying questions out loud, then say the task back. We check which details you found and
            confirmed. We never score your accent.
          </p>
        )}
      </header>

      {phase.k === "intro" && (
        <PaperCard className="flex flex-col gap-5" sticker="sm">
          <ol className="flex list-decimal flex-col gap-2 pl-6 text-lg text-ink marker:font-mono marker:text-ink-2">
            <li>Listen to the task.</li>
            <li>Ask about what&apos;s unclear: one question at a time.</li>
            <li>Confirm: “So you want me to…”</li>
          </ol>
          <MicExplainer />
          <button type="button" onClick={() => void start()} className={buttonClasses({ size: "lg", className: "sm:self-start" })}>
            Start the task
          </button>
        </PaperCard>
      )}

      {phase.k === "starting" && <Loading text="Getting your task…" />}

      {phase.k === "paywall" && (
        <div className="flex flex-col items-center gap-4">
          <div data-field="paper" className="w-full max-w-md bg-transparent">
            <Paywall reason={phase.reason} />
          </div>
        </div>
      )}

      {scenario && (inScene || phase.k === "error") && (
        <>
          <div className="rounded-card bg-field-tint px-5 py-5 sm:p-6">
            {transferFrom && (
              <p className="type-label mb-3 text-field-mark">New task, same skill as “{transferFrom}”</p>
            )}
            <p className="text-lg text-field-fg">{scenario.context}</p>
            <p className="mt-2 font-mono text-[13px] text-field-muted">
              {scenario.managerName}, {scenario.managerRole}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" className={buttonClasses({ variant: "ghost", size: "sm", className: "bg-field-tint" })} disabled={stt.listening} onClick={() => say(managerLine)}>
                Play again
              </button>
              <button type="button" className={buttonClasses({ variant: "ghost", size: "sm", className: "bg-field-tint" })} disabled={stt.listening} onClick={() => tts.supported && void tts.speak(managerLine, { rate: SLOW_RATE })}>
                Slower
              </button>
            </div>
          </div>

          <PaperCard padding="sm" className="flex flex-col gap-4">
          <ol className="flex flex-col gap-3" aria-live="polite" aria-label="Conversation">
            {thread.map((b) => (
              <li key={b.id} className={b.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={
                    b.role === "user"
                      ? "max-w-[85%] rounded-chip rounded-br-sm bg-cobalt px-4 py-3 text-base text-paper"
                      : b.role === "hint"
                        ? "max-w-[85%] rounded-chip bg-lemon px-4 py-3 text-[0.9375rem] text-ink"
                        : "max-w-[85%] rounded-chip rounded-bl-sm bg-sunken px-4 py-3 text-base text-ink"
                  }
                >
                  {b.role === "manager" && <span className="type-label mb-1 block text-[11px] text-ink-2">{scenario.managerName}</span>}
                  {b.role === "hint" && <span className="type-label mb-1 block text-[11px]">Hint</span>}
                  {b.text}
                </div>
              </li>
            ))}
            <div ref={endRef} />
          </ol>

          {progress && (
            <p className="border-t border-line pt-3 font-mono text-[13px] text-ink-2 tabular-nums">
              Questions: {progress.questionsAsked} · Details found: {progress.found} of {progress.hiddenCount}
              {progress.hintsUsed > 0 && " · with help"}
            </p>
          )}
          </PaperCard>
        </>
      )}

      {phase.k === "ask" && (
        <PaperCard padding="sm" className="flex flex-col gap-4">
          {nudge && <p className="rounded-lg border-l-4 border-amber-mid bg-amber-soft px-3.5 py-2.5 text-sm text-ink">{nudge}</p>}
          <p className="text-sm font-semibold text-ink">Ask {scenario?.managerName} a question</p>
          <AnswerCapture
            key={`q-${captureKey}`}
            stt={stt}
            preferTyping={preferTyping}
            onModeChange={(m) => setPreferTyping(m === "typed")}
            onCaptured={(a) => onCaptured(a, "review-question")}
            maxChars={MAX_CHARS}
            onBeforeStart={tts.cancel}
            placeholder="e.g. Which numbers do you mean?"
            label="Your question"
            submitLabel="Ask"
          />
          <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
            <button
              type="button"
              onClick={() => {
                freshCapture();
                setNudge(null);
                setPhase({ k: "confirm" });
              }}
              className={buttonClasses({ variant: "ink" })}
            >
              Confirm the task
            </button>
            <button type="button" onClick={() => void askHint()} className="inline-flex min-h-11 items-center rounded-pill px-3 text-sm font-semibold text-accent underline-offset-4 hover:underline">
              I&apos;m stuck: give me a hint
            </button>
          </div>
        </PaperCard>
      )}

      {phase.k === "review-question" && (
        <PaperCard padding="sm" className="flex flex-col gap-4">
          <TranscriptEditor raw={raw} value={edited} onChange={setEdited} maxLength={MAX_CHARS} label="Your question" />
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => void sendTurn(raw, edited, mode)} disabled={!edited.trim()} className={buttonClasses()}>
              Ask
            </button>
            <button type="button" onClick={() => { freshCapture(); setPhase({ k: "ask" }); }} className="inline-flex min-h-11 items-center rounded-pill px-3 text-sm font-semibold text-accent underline-offset-4 hover:underline">
              Say it again
            </button>
          </div>
        </PaperCard>
      )}

      {phase.k === "waiting" && <Loading text={`${scenario?.managerName ?? "Your manager"} is answering…`} />}

      {phase.k === "confirm" && (
        <PaperCard padding="sm" className="flex flex-col gap-4">
          {nudge && <p className="rounded-lg border-l-4 border-amber-mid bg-amber-soft px-3.5 py-2.5 text-sm text-ink">{nudge}</p>}
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
            onBeforeStart={tts.cancel}
            placeholder="So you want me to…"
            label="Your confirmation"
            submitLabel="Confirm"
          />
          <button type="button" onClick={() => { freshCapture(); setPhase({ k: "ask" }); }} className="inline-flex min-h-11 items-center self-start rounded-pill px-3 text-sm font-semibold text-accent underline-offset-4 hover:underline">
            Back to questions
          </button>
        </PaperCard>
      )}

      {phase.k === "review-confirm" && (
        <PaperCard padding="sm" className="flex flex-col gap-4">
          <TranscriptEditor raw={raw} value={edited} onChange={setEdited} maxLength={MAX_CHARS} label="Your confirmation" />
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => void sendConfirm(raw, edited, mode)} disabled={!edited.trim()} className={buttonClasses()}>
              Check my confirmation
            </button>
            <button type="button" onClick={() => { freshCapture(); setPhase({ k: "confirm" }); }} className="inline-flex min-h-11 items-center rounded-pill px-3 text-sm font-semibold text-accent underline-offset-4 hover:underline">
              Say it again
            </button>
          </div>
        </PaperCard>
      )}

      {phase.k === "grading" && <Loading text="Checking your confirmation…" />}

      {phase.k === "result" && <ResultCard grade={phase.grade} input={phase.input} onNext={() => void start()} />}

      {phase.k === "error" && (
        <div data-field="paper" className="flex flex-col items-start gap-3 rounded-card border-l-4 border-red bg-red-soft px-5 py-4" role="alert">
          <p className="text-[0.9375rem] text-red">{phase.message}</p>
          <button type="button" onClick={retry} className={buttonClasses({ variant: "ink", size: "sm" })}>
            {phase.retry === "start" ? "Start a new task" : "Try again"}
          </button>
        </div>
      )}
    </div>
  );
}

function Loading({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-8 text-field-muted" role="status">
      <span className="size-4 motion-safe:animate-spin rounded-full border-2 border-field-mark border-t-transparent" aria-hidden="true" />
      {text}
    </div>
  );
}
