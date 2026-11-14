"use client";
// Drill 1 "Cold question", as a state machine:
//   intro (mic explainer) → starting → question (read aloud) → think (5 s) → answer (push-to-talk, max 45 s, or
//   typed) → review (editable transcript; voice only) → grading → feedback → "Try again on a new question" → …
// A start is server-issued (POST /api/drill1/start) and counts against the free limit; over it, the paywall shows.
//
// Independent vs with help (stored with every result):
//   An answer is "with help" when, before giving it, the user opened the hint for this question OR opened the
//   stronger version of the previous answer in this session (it is a model answer for the same question type).
//   Otherwise it is "independent". Fixing a misheard transcript does not count as help (it is stored as `edited`).
//
// With `queue` (Rehearse my real meeting), the questions and their attempts were already issued by the server
// (POST /api/rehearse/questions): the flow walks through them in order instead of calling /api/drill1/start, and the
// stronger version only carries over as help to a next question of the same type.

import { errorMessage } from "@/lib/client-error";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Paywall } from "@/components/paywall";
import { AnswerCapture, MicExplainer, SLOW_RATE, ThinkTimer, TranscriptEditor, useSpeechToText, useTTS, type AnswerMode, type CapturedAnswer } from "@/components/voice";
import { MAX_TRANSCRIPT_CHARS } from "@/lib/drill1/checks";
import type { Drill1Feedback } from "@/lib/drill1/feedback";
import { TYPE_HINTS, TYPE_LABELS, type ColdQuestion, type QuestionType } from "@/lib/drill1/questions";
import { addResult, type HelpMark } from "@/lib/progress/store";
import { FeedbackCard } from "./FeedbackCard";

type Phase =
  | { k: "intro" }
  | { k: "starting" }
  | { k: "question" }
  | { k: "think" }
  | { k: "answer"; notice?: string }
  | { k: "review" }
  | { k: "grading" }
  | { k: "feedback" }
  | { k: "limit"; message: string }
  | { k: "finished" }
  | { k: "error"; message: string; retry: "start" | "grade" };

interface Usage {
  usedToday: number;
  freePerDay: number;
}

const MODE_KEY = "ots_answer_mode";

function readMode(): AnswerMode | null {
  try {
    const v = window.localStorage.getItem(MODE_KEY);
    return v === "typed" || v === "voice" ? v : null;
  } catch {
    return null;
  }
}
function saveMode(m: AnswerMode) {
  try {
    window.localStorage.setItem(MODE_KEY, m);
  } catch {
    /* ignore */
  }
}

/** A server-issued question with its attempt (from POST /api/rehearse/questions). */
export interface DrillQueueItem {
  question: ColdQuestion;
  attemptId: string;
  /** Lets the server voice this AI-written question (POST /api/speech/tts). */
  ttsToken?: string;
}

export interface Drill1FlowProps {
  /** Drill these questions in order instead of picking from the bank. */
  queue?: readonly DrillQueueItem[];
  /** Queue mode: "Rehearse another meeting" on the last screen. */
  onExit?: () => void;
}

export function Drill1Flow({ queue, onExit }: Drill1FlowProps = {}) {
  const tts = useTTS();
  const stt = useSpeechToText({ maxMs: 45_000 });
  const [phase, setPhase] = useState<Phase>({ k: "intro" });
  const [question, setQuestion] = useState<ColdQuestion | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [ttsToken, setTtsToken] = useState<string | undefined>(undefined);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [pro, setPro] = useState(false);
  const [raw, setRaw] = useState("");
  const [edited, setEdited] = useState("");
  const [mode, setMode] = useState<AnswerMode>("voice");
  const [preferTyping, setPreferTyping] = useState(false);
  const [feedback, setFeedback] = useState<Drill1Feedback | null>(null);
  const [hintOpen, setHintOpen] = useState(false);
  const [strongerOpen, setStrongerOpen] = useState(false);
  const [carriedHelp, setCarriedHelp] = useState(false);
  const [done, setDone] = useState(0);

  const seenRef = useRef<string[]>([]);
  const queueIdx = useRef(0);
  const tokenRef = useRef(0);
  const gradeAbort = useRef<AbortController | null>(null);

  useEffect(() => () => gradeAbort.current?.abort(), []);

  const help: HelpMark = hintOpen || carriedHelp ? "with_help" : "independent";

  const startQuestion = useCallback(
    async (type: QuestionType | null, carry: boolean, typing: boolean) => {
      tts.unlock(); // inside the click, before any await (iOS)
      const token = ++tokenRef.current;
      setPreferTyping(typing);
      let q: ColdQuestion;
      let issuedAttempt: string;
      let issuedToken: string | undefined;
      if (queue) {
        const item = queue[queueIdx.current];
        if (!item) {
          setPhase({ k: "finished" });
          return;
        }
        queueIdx.current += 1;
        q = item.question;
        issuedAttempt = item.attemptId;
        issuedToken = item.ttsToken;
      } else {
        setPhase({ k: "starting" });
        let res: Response;
        let body: { question?: ColdQuestion; attemptId?: string; usage?: Usage; pro?: boolean; error?: string; code?: string };
        try {
          res = await fetch("/api/drill1/start", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ type, excludeIds: seenRef.current }),
          });
          body = await res.json().catch(() => ({}));
        } catch {
          setPhase({ k: "error", message: "We couldn't reach the server. Check your connection and try again.", retry: "start" });
          return;
        }
        if (token !== tokenRef.current) return;
        if (body.usage) setUsage(body.usage);
        if (typeof body.pro === "boolean") setPro(body.pro);
        if (res.status === 402) {
          setPhase({ k: "limit", message: body.error ?? "You've used today's free drills." });
          return;
        }
        if (!res.ok || !body.question || !body.attemptId) {
          setPhase({ k: "error", message: errorMessage(res.status, body.error, "Something went wrong. Try again."), retry: "start" });
          return;
        }
        q = body.question;
        issuedAttempt = body.attemptId;
      }
      seenRef.current = [...seenRef.current, q.id];
      setQuestion(q);
      setAttemptId(issuedAttempt);
      setTtsToken(issuedToken);
      setRaw("");
      setEdited("");
      setFeedback(null);
      setHintOpen(false);
      setStrongerOpen(false);
      setCarriedHelp(carry);
      stt.reset();
      if (typing) {
        // Typists get the answer box right away while the question is read aloud: no think timer.
        setPhase({ k: "answer" });
        if (tts.supported) void tts.speak(q.text, { token: issuedToken });
        return;
      }
      setPhase({ k: "question" });
      if (tts.supported) await tts.speak(q.text, { token: issuedToken });
      if (token === tokenRef.current) setPhase((p) => (p.k === "question" ? { k: "think" } : p));
    },
    [tts, stt, queue],
  );

  const grade = useCallback(
    async (rawText: string, editedText: string, answerMode: AnswerMode) => {
      if (!question || !attemptId) return;
      tts.cancel();
      setPhase({ k: "grading" });
      gradeAbort.current?.abort();
      const ctrl = new AbortController();
      gradeAbort.current = ctrl;
      let res: Response;
      let body: (Drill1Feedback & { error?: string; code?: string; message?: string }) | { status: "too_short"; message: string } | { error?: string; code?: string };
      try {
        res = await fetch("/api/drill1/feedback", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            attemptId,
            questionId: question.id,
            rawTranscript: rawText,
            editedTranscript: editedText.trim() !== rawText.trim() ? editedText : undefined,
          }),
          signal: ctrl.signal,
        });
        body = await res.json().catch(() => ({}));
      } catch {
        if (ctrl.signal.aborted) return;
        setPhase({ k: "error", message: "We couldn't reach the server. Your answer is still here; try again.", retry: "grade" });
        return;
      }
      if ("status" in body && body.status === "too_short") {
        // Typed: the text stays in the box (initialText below), with a typing message.
        setPhase({ k: "answer", notice: answerMode === "typed" ? "Please write at least a few words." : body.message });
        return;
      }
      if (!res.ok || !("status" in body) || body.status !== "ok") {
        const err = body as { error?: string; code?: string };
        if (err.code === "too_long") {
          // Resending the same text would fail again: back to the answer step to say it shorter.
          stt.reset();
          setPhase({ k: "answer", notice: errorMessage(res.status, err.error, "That answer is too long. Keep it shorter.") });
        } else if (err.code === "no_attempt" || err.code === "attempt_limit") {
          // This attempt can't be graded again: the only way on is a new question.
          setPhase({ k: "error", message: errorMessage(res.status, err.error, "This question expired."), retry: "start" });
        } else {
          setPhase({ k: "error", message: errorMessage(res.status, err.error, "Feedback failed. Try again."), retry: "grade" });
        }
        return;
      }
      const fb = body as Drill1Feedback;
      setFeedback(fb);
      setDone((n) => n + 1);
      addResult({
        drill: "drill1",
        questionId: question.id,
        questionType: question.type,
        help,
        verdict: fb.answerFirst.verdict,
        words: fb.checks.words,
        edited: fb.edited,
        mode: answerMode,
      });
      setPhase({ k: "feedback" });
    },
    [question, attemptId, tts, stt, help],
  );

  const onCaptured = ({ raw: text, mode: m }: CapturedAnswer) => {
    setMode(m);
    setRaw(text);
    setEdited(text);
    if (m === "typed") void grade(text, text, "typed");
    else setPhase({ k: "review" });
  };

  const onModeChange = (m: AnswerMode) => {
    saveMode(m);
    setPreferTyping(m === "typed");
  };

  /** "Type instead" while the question is read or during the think timer: straight to the answer box. */
  const typeNow = () => {
    saveMode("typed");
    setPreferTyping(true);
    setPhase({ k: "answer" });
  };

  const begin = (typing: boolean) => {
    if (typing) saveMode("typed");
    void startQuestion(null, false, typing || readMode() === "typed");
  };

  const retry = () => {
    if (!question) return;
    if (queue) {
      const next = queue[queue.findIndex((i) => i.question.id === question.id) + 1];
      void startQuestion(null, strongerOpen && next?.question.type === question.type, readMode() === "typed");
      return;
    }
    void startQuestion(question.type, strongerOpen, readMode() === "typed");
  };

  /** 1-based position of the current question in the queue (0 outside queue mode). */
  const queuePos = queue && question ? queue.findIndex((i) => i.question.id === question.id) + 1 : 0;
  const queueLast = queue ? queuePos >= queue.length : false;

  const freeLeft = usage && !pro ? Math.max(0, usage.freePerDay - usage.usedToday) : null;

  // ---------- render ----------
  if (phase.k === "intro") {
    return (
      <section className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          {queue ? (
            <>
              <p className="text-sm font-semibold tracking-wide text-accent uppercase">Rehearse · {queue.length} questions from your meeting</p>
              <h2 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Now they turn to you.</h2>
              <p className="text-base text-ink-2">
                One question at a time, read aloud with no warning. Take 5 seconds to think, then answer out loud, up to 45 seconds.
                Use your real facts: this is the meeting you&apos;ll actually be in.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold tracking-wide text-accent uppercase">Drill 1 · Cold question</p>
              <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Someone in the meeting turns to you.</h1>
              <p className="text-base text-ink-2">
                You&apos;ll hear a real work question with no warning. Take 5 seconds to think, then answer out loud, up to 45 seconds.
                We check one thing first: did your first sentence answer the question?
              </p>
            </>
          )}
        </div>
        <ol className="grid gap-3 text-sm text-ink-2 sm:grid-cols-3">
          {["Hear the question", "5 seconds to think", "Answer, then see what landed"].map((s, i) => (
            <li key={s} className="flex items-center gap-3 rounded-md border border-line bg-surface px-4 py-3">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-bold text-accent-ink">{i + 1}</span>
              {s}
            </li>
          ))}
        </ol>
        {stt.supported ? (
          <div className="flex flex-col gap-4">
            <MicExplainer />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <button type="button" onClick={() => begin(false)} className="h-13 rounded-md bg-accent px-6 text-base font-semibold text-white hover:bg-accent-hover active:bg-accent-press">
                Start with the mic
              </button>
              <button type="button" onClick={() => begin(true)} className="h-11 rounded-md px-3 text-sm font-semibold text-accent hover:bg-accent-soft">
                Type instead
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="rounded-md bg-sunken px-4 py-3 text-sm text-ink-2">
              This browser can&apos;t turn speech into text (Chrome, Edge and Safari can). You can still do the drill: type your answer the way you&apos;d say it.
            </p>
            <button type="button" onClick={() => begin(true)} className="h-13 w-fit rounded-md bg-accent px-6 text-base font-semibold text-white hover:bg-accent-hover">
              Start, typing my answer
            </button>
          </div>
        )}
      </section>
    );
  }

  if (phase.k === "limit") {
    return (
      <section className="flex flex-col items-center gap-6">
        <Paywall reason={phase.message} />
        <Link href="/progress" className="inline-flex items-center max-sm:min-h-11 text-sm font-semibold text-accent hover:underline">See your progress</Link>
      </section>
    );
  }

  if (phase.k === "finished") {
    return (
      <section className="flex flex-col items-start gap-4 rounded-lg border border-line bg-surface p-5 sm:p-6">
        <h2 className="text-xl font-bold text-ink">That&apos;s the whole meeting.</h2>
        <p className="text-base text-ink-2">
          You answered {done} of {queue?.length ?? done} questions out loud. Before the real one, say your first sentence for each topic once more.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {onExit && (
            <button type="button" onClick={onExit} className="h-12 rounded-md bg-accent px-6 font-semibold text-white hover:bg-accent-hover">
              Rehearse another meeting
            </button>
          )}
          <Link href="/progress" className="flex h-12 items-center justify-center rounded-md border border-line-strong bg-surface px-6 font-semibold text-ink hover:bg-paper">
            See your progress
          </Link>
        </div>
      </section>
    );
  }

  if (phase.k === "starting" || !question) {
    if (phase.k === "error") {
      return <ErrorBox message={phase.message} onRetry={() => void startQuestion(null, false, preferTyping)} retryLabel="Start a question" />;
    }
    return <Loading text="Picking a question…" />;
  }

  const showAsk = phase.k === "question" || phase.k === "think" || phase.k === "answer";

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-3">
        <span className="font-semibold tracking-wide text-accent uppercase">
          {queue ? `Question ${queuePos} of ${queue.length} · ` : ""}
          {TYPE_LABELS[question.type]}
        </span>
        <span>
          {[phase.k !== "feedback" ? (help === "independent" ? "Counts as independent" : "Counts as with help") : null, freeLeft !== null ? `${freeLeft} free left today` : null]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </div>

      {/* The question, as a meeting moment */}
      <div className="rounded-lg border border-line bg-surface p-5 sm:p-6">
        <p className="text-sm text-ink-2">{question.context}</p>
        <p className="mt-2 text-xl leading-snug font-semibold text-ink sm:text-2xl">“{question.text}”</p>
        {tts.supported && (
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <button type="button" className="inline-flex items-center max-sm:min-h-11 font-semibold text-accent hover:underline disabled:opacity-45 disabled:no-underline" disabled={stt.listening} onClick={() => void tts.speak(question.text, { token: ttsToken })}>
              Replay
            </button>
            <button type="button" className="inline-flex items-center max-sm:min-h-11 font-semibold text-accent hover:underline disabled:opacity-45 disabled:no-underline" disabled={stt.listening} onClick={() => void tts.speak(question.text, { rate: SLOW_RATE, token: ttsToken })}>
              Slower
            </button>
            {phase.k === "question" && (
              <button type="button" className="inline-flex items-center max-sm:min-h-11 rounded-md border border-line-strong px-3 font-semibold text-ink-2 hover:bg-sunken" onClick={() => { tts.cancel(); setPhase({ k: "think" }); }}>
                Skip reading
              </button>
            )}
          </div>
        )}
        {showAsk && (
          <div className="mt-3 text-sm">
            {hintOpen ? (
              <p className="rounded-md bg-sunken px-3 py-2 text-ink-2">Hint: {TYPE_HINTS[question.type]}</p>
            ) : (
              <button type="button" className="inline-flex items-center max-sm:min-h-11 text-left text-ink-3 hover:underline" onClick={() => setHintOpen(true)}>
                Show a hint (counts as with help)
              </button>
            )}
          </div>
        )}
      </div>

      {phase.k === "question" && <p className="text-center text-sm text-ink-2" aria-live="polite">{tts.speaking ? "Reading the question aloud…" : "Get ready…"}</p>}

      {phase.k === "think" && (
        <ThinkTimer seconds={5} onDone={() => { tts.cancel(); setPhase({ k: "answer" }); }} skipLabel="I'm ready, answer now" />
      )}

      {(phase.k === "question" || phase.k === "think") && (
        <button type="button" onClick={typeNow} className="inline-flex items-center max-sm:min-h-11 self-center text-sm font-semibold text-accent hover:underline">
          Type instead
        </button>
      )}

      {phase.k === "answer" && (
        <AnswerCapture
          key={attemptId}
          stt={stt}
          preferTyping={preferTyping}
          onModeChange={onModeChange}
          onCaptured={onCaptured}
          notice={phase.notice}
          maxChars={MAX_TRANSCRIPT_CHARS}
          submitLabel="Get feedback"
          initialText={mode === "typed" ? raw : ""}
          onBeforeStart={tts.cancel}
        />
      )}

      {phase.k === "review" && (
        <div className="flex flex-col gap-4">
          <TranscriptEditor raw={raw} value={edited} onChange={setEdited} maxLength={MAX_TRANSCRIPT_CHARS} />
          <div className="flex flex-wrap items-center gap-4">
            <button type="button" onClick={() => void grade(raw, edited, mode)} disabled={!edited.trim()} className="h-12 rounded-md bg-accent px-6 font-semibold text-white hover:bg-accent-hover disabled:opacity-45">
              Get feedback
            </button>
            <button type="button" onClick={() => { stt.reset(); setPhase({ k: "answer" }); }} className="inline-flex items-center max-sm:min-h-11 text-sm font-semibold text-accent hover:underline">
              Answer again
            </button>
          </div>
        </div>
      )}

      {phase.k === "grading" && <Loading text="Reading your answer…" />}

      {phase.k === "error" && (
        <ErrorBox
          message={phase.message}
          retryLabel={phase.retry === "grade" ? "Try again" : queue ? "Go to the next question" : "Start a new question"}
          onRetry={() => (phase.retry === "grade" ? void grade(raw, edited, mode) : void startQuestion(question.type, false, preferTyping))}
        />
      )}

      {phase.k === "feedback" && feedback && (
        <div className="flex flex-col gap-5">
          <FeedbackCard feedback={feedback} strongerOpen={strongerOpen} onOpenStronger={() => setStrongerOpen(true)} />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button type="button" onClick={retry} className="flex h-13 flex-col items-center justify-center rounded-md bg-accent px-6 text-white hover:bg-accent-hover">
              <span className="text-base font-semibold">
                {queue ? (queueLast ? "Finish the rehearsal" : `Next question (${queuePos + 1} of ${queue.length})`) : "Try again on a new question"}
              </span>
              {!queueLast && (
                <span className="text-xs opacity-80">
                  {strongerOpen && (!queue || queue[queuePos]?.question.type === question.type)
                    ? "Counts as with help: you saw the stronger version"
                    : "Counts as independent"}
                </span>
              )}
            </button>
            {done >= 1 && (
              <Link href="/progress" className="flex h-13 items-center justify-center rounded-md border border-line-strong bg-surface px-6 font-semibold text-ink hover:bg-paper">
                See your progress
              </Link>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function Loading({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-10 text-ink-2" role="status">
      <span className="size-4 animate-spin rounded-full border-2 border-accent border-t-transparent" aria-hidden="true" />
      {text}
    </div>
  );
}

function ErrorBox({ message, onRetry, retryLabel }: { message: string; onRetry(): void; retryLabel: string }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-md border border-red/30 bg-red-soft p-4" role="alert">
      <p className="text-sm text-red">{message}</p>
      <button type="button" onClick={onRetry} className="h-10 rounded-md bg-surface px-4 max-sm:h-11 text-sm font-semibold text-ink ring-1 ring-line-strong hover:bg-paper">
        {retryLabel}
      </button>
    </div>
  );
}
