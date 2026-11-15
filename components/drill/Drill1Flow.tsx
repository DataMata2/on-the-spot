"use client";
// Drill 1 "Cold question", as a state machine:
//   [role picker, when no role is saved or /drill?role=pick] → intro (mic explainer) → starting → question (read aloud) → think (5 s) → answer (push-to-talk, max 45 s, or
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
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Blob, Button, cx, Notice, PaperCard, ScreenField, type FieldName } from "@/components/kit";
import { Paywall } from "@/components/paywall";
import { AnswerCapture, MicExplainer, SLOW_RATE, ThinkTimer, TranscriptEditor, useSpeechToText, useTTS, type AnswerMode, type CapturedAnswer } from "@/components/voice";
import { MAX_TRANSCRIPT_CHARS } from "@/lib/drill1/checks";
import type { Drill1Feedback } from "@/lib/drill1/feedback";
import { answeredLine } from "@/lib/drill1/mode-copy";
import { TYPE_HINTS, TYPE_LABELS, type ColdQuestion, type QuestionType } from "@/lib/drill1/questions";
import { createPickSignal, onWantsPickChange, shouldShowPicker, wantsPickFrom } from "@/lib/drill1/pick-signal";
import type { Role, StartSource } from "@/lib/drill1/roles";
import { loadRole, ROLE_EVENT, ROLE_KEY, roleFields, saveRole } from "@/lib/progress/role";
import { addResult, type HelpMark } from "@/lib/progress/store";
import { bestOpening, type RehearseAnswer } from "@/lib/rehearse/summary";
import { FeedbackCard } from "./FeedbackCard";
import { RolePicker } from "./RolePicker";

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

// The saved role's raw storage value (a stable snapshot); undefined during SSR and hydration.
function subscribeRole(cb: () => void) {
  window.addEventListener(ROLE_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(ROLE_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}
function readRoleRaw(): string {
  try {
    return window.localStorage.getItem(ROLE_KEY) ?? "";
  } catch {
    return "";
  }
}
/**
 * /drill?role=pick (the progress card's "change" link) reopens the picker, also on a Drill1Flow that Next kept mounted
 * from an earlier visit (OTS-CURRENT-06): PickReader feeds the router's search params into this signal.
 */
const pickSignal = createPickSignal();
const readWantsPick = () => pickSignal.snapshot(() => wantsPickFrom(window.location.search));

/** Renders nothing: mirrors useSearchParams() into pickSignal (its own Suspense keeps the page prerenderable). */
function PickReader() {
  const params = useSearchParams();
  const wants = wantsPickFrom(params);
  useEffect(() => {
    pickSignal.set(wants);
  }, [wants]);
  useEffect(() => () => pickSignal.set(undefined), []);
  return null;
}

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

export function Drill1Flow(props: Drill1FlowProps = {}) {
  return (
    <>
      {!props.queue && (
        <Suspense fallback={null}>
          <PickReader />
        </Suspense>
      )}
      <Drill1FlowInner {...props} />
    </>
  );
}

function Drill1FlowInner({ queue, onExit }: Drill1FlowProps) {
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
  // Every graded answer of this run, last grade per question (queue mode's final screen reads it).
  const [answers, setAnswers] = useState<(RehearseAnswer & { mode: AnswerMode })[]>([]);
  const roleRaw = useSyncExternalStore(subscribeRole, readRoleRaw, () => undefined);
  const wantsPick = useSyncExternalStore(pickSignal.subscribe, readWantsPick, () => false);
  // The role picked on this visit (also for when storage is unavailable, e.g. a private window: the drill still
  // uses it). The ref mirrors it for startQuestion.
  const [pickedNow, setPickedNow] = useState<Role | null>(null);
  // A new role=pick (the progress card's "change", again) reopens the picker even after a pick on an earlier visit.
  const [prevWantsPick, setPrevWantsPick] = useState(wantsPick);
  const pickEdge = onWantsPickChange(prevWantsPick, wantsPick);
  if (pickEdge.changed) {
    setPrevWantsPick(wantsPick);
    if (pickEdge.clearPicked) setPickedNow(null);
  }
  const pickedRole = useRef<Role | null>(null);
  // Set by a pick on the role picker: the intro then moves focus to its primary button (keyboard and screen-reader
  // users continue in place instead of at the top of the page). Never set on a plain page load.
  const focusAfterPick = useRef(false);
  const introRef = useRef<HTMLElement | null>(null);
  // The first start for an "Other" role waits on the AI writing its questions (several seconds): say so.
  const [writingRole, setWritingRole] = useState(false);
  // The "Other" role's questions couldn't be written, so this one is from the general bank (OTS-CURRENT-05): say so.
  const [generalFallback, setGeneralFallback] = useState(false);

  const seenRef = useRef<string[]>([]);
  const queueIdx = useRef(0);
  const tokenRef = useRef(0);
  const gradeAbort = useRef<AbortController | null>(null);

  useEffect(() => () => gradeAbort.current?.abort(), []);

  useEffect(() => {
    if (!focusAfterPick.current || phase.k !== "intro" || !pickedNow) return;
    focusAfterPick.current = false;
    introRef.current?.querySelector<HTMLElement>("[data-intro-start]")?.focus();
  }, [pickedNow, phase.k]);

  const help: HelpMark = hintOpen || carriedHelp ? "with_help" : "independent";

  const startQuestion = useCallback(
    async (type: QuestionType | null, carry: boolean, typing: boolean, retryRole = false) => {
      tts.unlock(); // inside the click, before any await (iOS)
      const token = ++tokenRef.current;
      setPreferTyping(typing);
      let q: ColdQuestion;
      let issuedAttempt: string;
      let issuedToken: string | undefined;
      let fallback = false;
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
        const role = loadRole() ?? pickedRole.current;
        setWritingRole(role?.id === "other" && (retryRole || seenRef.current.length === 0));
        setPhase({ k: "starting" });
        let res: Response;
        let body: { question?: ColdQuestion; attemptId?: string; source?: StartSource; ttsToken?: string; usage?: Usage; pro?: boolean; error?: string; code?: string };
        try {
          res = await fetch("/api/drill1/start", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ type, excludeIds: seenRef.current, ...roleFields(role), ...(retryRole ? { retryRole: true } : {}) }),
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
        issuedToken = typeof body.ttsToken === "string" ? body.ttsToken : undefined;
        fallback = body.source === "general_fallback";
      }
      setGeneralFallback(fallback);
      seenRef.current = [...seenRef.current, q.id];
      setQuestion(q);
      setAttemptId(issuedAttempt);
      setTtsToken(issuedToken);
      setRaw("");
      setEdited("");
      setFeedback(null);
      setHintOpen(false);
      setStrongerOpen(false);
      // The server may serve another type than the retry asked for (the role pool ran out of that type): the
      // stronger version is a model answer for the old type only, so it carries over as help only on a type match.
      setCarriedHelp(carry && (!type || q.type === type));
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
      const entry = { questionId: question.id, questionText: question.text, graded: fb.graded, strongerVersion: fb.strongerVersion, mode: answerMode };
      setAnswers((list) => [...list.filter((a) => a.questionId !== question.id), entry]);
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
    // An explicit choice on the intro wins over the saved one; the saved mode only sets retry defaults.
    saveMode(typing ? "typed" : "voice");
    void startQuestion(null, false, typing);
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
  // Screen fields: intro / question / think / answer on night with the spotlight (it turns tomato while recording),
  // feedback on cobalt, the paywall on lemon. In queue mode (/rehearse) the flow paints no field of its own: it
  // inherits the page's field (every colour below is field-aware).
  const inherit = Boolean(queue);

  // The role picker: before the intro, when no role is saved, or whenever the progress card asked to change it
  // (whatever phase an earlier run on this mounted page was in). Never in queue mode. Until storage is read (SSR,
  // hydration), an empty night field: the same field the intro paints.
  if (!queue && (phase.k === "intro" || (wantsPick && !pickedNow))) {
    if (roleRaw === undefined) return <DrillField inherit={false} field="night" spotlight>{null}</DrillField>;
    const saved = (roleRaw ? loadRole() : null) ?? pickedNow;
    if (shouldShowPicker({ queue: false, saved: Boolean(saved), wantsPick, pickedNow: Boolean(pickedNow), phaseIsIntro: phase.k === "intro" })) {
      const pick = (role: Role) => {
        pickedRole.current = role;
        focusAfterPick.current = true;
        saveRole(role);
        setPickedNow(role);
        if (phase.k !== "intro") {
          // The old run ends here (its results stay in progress): drop anything still pending and start at the intro.
          tokenRef.current += 1;
          gradeAbort.current?.abort();
          tts.cancel();
          stt.reset();
          setQuestion(null);
          setAttemptId(null);
          setFeedback(null);
          setHintOpen(false);
          setStrongerOpen(false);
          setCarriedHelp(false);
          setGeneralFallback(false);
          setPhase({ k: "intro" });
        }
        // Native replaceState syncs with the router (useSearchParams), so a later "change" is a fresh role=pick.
        if (wantsPick) window.history.replaceState(null, "", window.location.pathname);
      };
      return (
        <DrillField inherit={false} field="night" spotlight>
          <RolePicker onPick={pick} current={saved} />
        </DrillField>
      );
    }
  }

  if (phase.k === "intro") {
    return (
      <DrillField inherit={inherit} field="night" spotlight>
        <section ref={introRef} className="flex flex-1 flex-col gap-6 lg:gap-10">
          <div className="relative flex flex-col gap-3 lg:gap-4">
            <Blob state="happy" size="clamp(52px,9vw,120px)" bob className="absolute top-0 right-0 max-sm:hidden" />
            {queue ? (
              <>
                <p className="type-label flex items-center gap-2 text-field-mark">
                  <Blob state="happy" size={28} className="sm:hidden" />
                  Rehearse · {queue.length} questions from your meeting
                </p>
                <h2 className="type-display max-w-[14ch] text-[clamp(2.5rem,11vw,5.5rem)] leading-[0.98] text-field-fg">Now they turn to you.</h2>
                <p className="max-w-[52ch] text-base text-field-muted sm:text-lg">
                  One question at a time, read aloud with no warning. Take 5 seconds to think, then answer out loud (or type), up to 45 seconds.
                  Use your real facts: this is the meeting you&apos;ll actually be in.
                </p>
              </>
            ) : (
              <>
                <p className="type-label flex items-center gap-2 text-field-mark">
                  <Blob state="happy" size={28} className="sm:hidden" />
                  Drill 1 · Cold question
                </p>
                <h1 className="type-display max-w-[14ch] text-[clamp(2.5rem,11vw,5.5rem)] leading-[0.98] text-field-fg">Someone in the meeting turns to you.</h1>
                <p className="max-w-[52ch] text-base text-field-muted sm:text-lg">
                  You&apos;ll hear a real work question with no warning. Take 5 seconds to think, then answer out loud, up to 45 seconds.
                  We check one thing first: did your first sentence answer the question?
                </p>
              </>
            )}
          </div>
          <ol className="grid gap-2 sm:grid-cols-3 sm:gap-3">
            {["Hear the question", "5 seconds to think", "Answer, then see what landed"].map((s, i) => (
              <li key={s} className="flex min-h-12 items-center gap-3 rounded-chip bg-field-tint px-4 py-2 font-semibold text-field-fg sm:min-h-16 sm:gap-4 sm:px-5">
                <span className="type-display w-5 shrink-0 text-[1.5rem] leading-none text-field-mark sm:w-6 sm:text-[2rem]">{i + 1}</span>
                {s}
              </li>
            ))}
          </ol>
          {stt.supported ? (
            <div className="flex flex-col gap-5">
              <MicExplainer className="max-w-[60ch]" />
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                <Button size="lg" onClick={() => begin(false)} data-intro-start>
                  <MicGlyph />
                  Start with the mic
                </Button>
                <Button variant="ghost" size="lg" onClick={() => begin(true)} className="underline decoration-1 underline-offset-4 sm:no-underline">
                  Type instead
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <p className="max-w-[60ch] rounded-chip bg-field-tint px-5 py-4 text-sm text-field-fg">
                This browser can&apos;t turn speech into text (Chrome, Edge and Safari can). You can still do the drill: type your answer the way you&apos;d say it.
              </p>
              <Button size="lg" onClick={() => begin(true)} className="sm:w-fit" data-intro-start>
                Start, typing my answer
              </Button>
            </div>
          )}
        </section>
      </DrillField>
    );
  }

  if (phase.k === "limit") {
    return (
      <DrillField inherit={inherit} field="lemon">
        <section className="flex flex-col items-center gap-6">
          <Paywall reason={phase.message} />
          <Link href="/progress" className="inline-flex min-h-11 items-center px-2 text-[0.9375rem] font-semibold text-field-fg underline underline-offset-4">See your progress</Link>
        </section>
      </DrillField>
    );
  }

  if (phase.k === "finished") {
    return (
      <DrillField inherit={inherit} field="night" spotlight>
        <PaperCard as="section" sticker="sm" className="flex flex-col items-start gap-4 border-2 border-ink">
          <Blob state="proud" size={56} />
          <h2 className="type-display text-[clamp(2rem,8vw,3rem)] leading-[1.02]">That&apos;s the whole meeting.</h2>
          <p className="text-base text-ink-2">
            {answeredLine(answers.length, queue?.length ?? done, answers.map((a) => a.mode))}{" "}
            {answers.length > 0 ? "Before the real meeting, say each of these first sentences once more." : "Before the real one, say your first sentence for each topic once more."}
          </p>
          {answers.length > 0 && (
            <ol className="flex w-full flex-col gap-4">
              {(queue ?? []).map((item, i) => {
                const a = answers.find((x) => x.questionId === item.question.id);
                const best = a ? bestOpening(a) : null;
                return (
                  <li key={item.question.id} className="flex flex-col gap-1.5 rounded-lg bg-sunken p-4">
                    <p className="text-sm text-ink-2">
                      <span className="font-semibold">{i + 1}.</span> “{item.question.text}”
                    </p>
                    {best ? (
                      <>
                        <p className="text-[1.0625rem] leading-snug font-semibold text-ink">{best.text}</p>
                        <p className="type-label text-[0.6875rem] text-ink-2">{best.stronger ? "From the stronger version" : "Your first sentence"}</p>
                      </>
                    ) : (
                      <p className="text-[0.9375rem] text-ink-2">Not answered in this run.</p>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
            {onExit && (
              <Button size="lg" onClick={onExit}>
                Rehearse another meeting
              </Button>
            )}
            <Button href="/progress" variant="secondary" size="lg">
              See your progress
            </Button>
          </div>
        </PaperCard>
      </DrillField>
    );
  }

  if (phase.k === "starting" || !question) {
    if (phase.k === "error") {
      return (
        <DrillField inherit={inherit} field="night" spotlight>
          <ErrorBox message={phase.message} onRetry={() => void startQuestion(null, false, preferTyping)} retryLabel="Start a question" />
        </DrillField>
      );
    }
    return (
      <DrillField inherit={inherit} field="night" spotlight>
        <Loading text={writingRole ? "Writing questions for your role…" : "Picking a question…"} />
      </DrillField>
    );
  }

  const showAsk = phase.k === "question" || phase.k === "think" || phase.k === "answer";
  // The situation (display only, never read aloud) stays up until the answer is sent.
  const showSituation = (showAsk || phase.k === "review") && (question.situation?.length ?? 0) > 0;
  const recording = phase.k === "answer" && stt.listening;
  // Voice answer (mirrors AnswerCapture's typing/forcedTyping): the layout stays identical between idle and recording,
  // so the mic never moves under a pressed pointer (hold-to-talk with a mouse has no pointer capture).
  const voiceAnswer = phase.k === "answer" && !preferTyping && stt.supported && stt.error !== "mic_denied" && stt.error !== "no_mic";
  const isFeedback = phase.k === "feedback";
  // The question is the hero while it is read and thought about, smaller while answering, a reminder afterwards.
  const qSize = phase.k === "question" || phase.k === "think" ? "big" : phase.k === "answer" && !voiceAnswer ? "mid" : "small";
  const centred = phase.k === "question" || phase.k === "think" || phase.k === "answer";

  return (
    <DrillField inherit={inherit} field={isFeedback ? "cobalt" : "night"} spotlight={isFeedback ? false : recording ? "rec" : true} wide={isFeedback}>
      <section className={cx("flex flex-1 flex-col", voiceAnswer ? "gap-4" : "gap-6")}>
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <span className={cx("type-label rounded-pill px-3 py-1.5 text-[0.6875rem] text-field-mark", isFeedback ? "shadow-[inset_0_0_0_1.5px_var(--field-line)]" : "bg-field-tint")}>
            {queue ? `Question ${queuePos} of ${queue.length} · ` : ""}
            {TYPE_LABELS[question.type]}
          </span>
          <span className="text-sm text-field-muted">
            {[phase.k !== "feedback" ? (help === "independent" ? "Counts as independent" : "Counts as with help") : null, freeLeft !== null ? `${freeLeft} free left today` : null]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </div>

        {generalFallback && !queue && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-chip bg-field-tint px-4 py-2 text-[0.9375rem] text-field-fg" role="status">
            <span>Couldn&apos;t tailor this one; here&apos;s a general question.</span>
            <button
              type="button"
              className="inline-flex min-h-11 items-center font-semibold underline decoration-1 underline-offset-4 hover:no-underline disabled:opacity-45"
              disabled={stt.listening || phase.k === "grading"}
              onClick={() => void startQuestion(null, false, preferTyping, true)}
            >
              Retry for my role
            </button>
          </div>
        )}

        {/* The question, as a meeting moment */}
        <div className={cx("flex flex-col", centred && "lg:items-center lg:text-center", qSize === "big" && "pt-2 lg:pt-10")}>
          <p className={cx("text-field-muted", qSize === "small" ? "text-sm" : "text-base lg:text-lg")}>{question.context}</p>
          <p
            className={cx(
              "mt-2 text-field-fg",
              qSize === "big" && "type-display text-trail text-[clamp(2rem,9.6vw,4.75rem)] leading-[1.02]",
              qSize === "mid" && "type-display text-[clamp(1.625rem,6.6vw,3rem)] leading-[1.05]",
              qSize === "small" && "type-heading max-w-[36ch] text-xl leading-[1.2] text-field-muted lg:text-[1.5rem]",
            )}
          >
            “{question.text}”
          </p>
          {tts.supported && (
            <div className={cx("mt-4 flex flex-wrap gap-2", centred && "lg:justify-center", qSize === "big" && "lg:mt-6")}>
              <button type="button" className={TOOL_PILL} disabled={stt.listening} onClick={() => void tts.speak(question.text, { token: ttsToken })}>
                <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                  <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
                  <path d="M3 3v5h5" />
                </svg>
                Replay
              </button>
              <button type="button" className={TOOL_PILL} disabled={stt.listening} onClick={() => void tts.speak(question.text, { rate: SLOW_RATE, token: ttsToken })}>
                Slower
              </button>
              {phase.k === "question" && (
                <button type="button" className={cx(TOOL_BASE, "shadow-[inset_0_0_0_2px_var(--field-line)] hover:bg-field-tint")} onClick={() => { tts.cancel(); setPhase({ k: "think" }); }}>
                  Skip reading
                </button>
              )}
            </div>
          )}
          {showSituation && (
            <div className={cx("mt-4 max-w-[60ch] rounded-chip bg-field-tint px-4 py-3 text-left", qSize === "big" && "lg:mt-6")}>
              <p className="type-label text-[0.6875rem] text-field-mark">Your situation</p>
              {question.situation?.map((line) => (
                <p key={line} className="mt-1 text-[0.9375rem] leading-snug text-field-fg">
                  {line}
                </p>
              ))}
            </div>
          )}
          {showAsk && (
            <div className="mt-2 text-[0.9375rem]">
              {hintOpen ? (
                <p className="mt-2 max-w-[60ch] rounded-chip bg-field-tint px-4 py-3 text-left text-field-fg">Hint: {TYPE_HINTS[question.type]}</p>
              ) : (
                <button type="button" className="inline-flex min-h-11 items-center px-1 text-left text-field-muted underline decoration-1 underline-offset-4 hover:text-field-fg" onClick={() => setHintOpen(true)}>
                  Show a hint (counts as with help)
                </button>
              )}
            </div>
          )}
        </div>

        {phase.k === "question" && <p className="mt-auto pt-6 text-center text-[0.9375rem] font-semibold text-field-muted" aria-live="polite">{tts.speaking ? "Reading the question aloud…" : "Get ready…"}</p>}

        {phase.k === "think" && (
          // The blob sits in the timer's first (reserved) column, beside the dots.
          <div className="relative flex flex-1 flex-col pt-2 lg:mx-auto lg:w-full lg:max-w-[560px]">
            <Blob state="thinking" size={44} className="absolute top-0 left-0" />
            <ThinkTimer seconds={5} onDone={() => { tts.cancel(); setPhase({ k: "answer" }); }} skipLabel="I'm ready, answer now" />
          </div>
        )}

        {(phase.k === "question" || phase.k === "think") && (
          <button type="button" onClick={typeNow} className="-mt-3 inline-flex min-h-11 items-center self-center px-3 text-[0.9375rem] font-semibold text-field-muted underline decoration-1 underline-offset-4 hover:text-field-fg">
            Type instead
          </button>
        )}

        {voiceAnswer && (
          // Decorative: the button and its live region already say how long is left. Its space is reserved for the
          // whole voice answer (invisible until recording) so the mic does not move; on short screens it is dropped.
          <div className={cx("flex flex-col items-center gap-3 [@media(max-height:700px)]:hidden", !recording && "invisible")} aria-hidden="true">
            <p className="type-display text-[clamp(4.5rem,22vw,10rem)] leading-[0.9] whitespace-nowrap text-field-fg tabular-nums">
              {clock(stt.elapsedMs)}
              <span className="ml-1.5 font-mono text-base font-medium tracking-[0.04em] text-field-muted">/ {clock(stt.maxMs)}</span>
            </p>
            <div className="flex h-12 items-center gap-1 [@media(max-height:700px)]:hidden">
              <Blob state="listening" size={36} bob={recording} className="mr-3" />
              {WAVE.map((h, i) => (
                <i key={i} className={cx("w-[5px] rounded-full bg-tomato", recording && "motion-safe:animate-wave", i >= 18 && "max-sm:hidden")} style={{ height: h * 0.8, animationDelay: `${-((i * 7) % 10) / 10}s` }} />
              ))}
            </div>
          </div>
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
          <div className="flex flex-col gap-5">
            <TranscriptEditor raw={raw} value={edited} onChange={setEdited} maxLength={MAX_TRANSCRIPT_CHARS} />
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <Button size="lg" onClick={() => void grade(raw, edited, mode)} disabled={!edited.trim()}>
                Get feedback
              </Button>
              <Button variant="ghost" size="lg" onClick={() => { stt.reset(); setPhase({ k: "answer" }); }} className="underline decoration-1 underline-offset-4 sm:no-underline">
                Answer again
              </Button>
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
          // Desktop: verdict + actions on the left, the paper card on the right (FeedbackCard is a subgrid of this).
          <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:grid-rows-[auto_1fr] lg:gap-x-16 lg:gap-y-10">
            <FeedbackCard feedback={feedback} strongerOpen={strongerOpen} onOpenStronger={() => setStrongerOpen(true)} mode={mode} />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:col-start-1 lg:row-start-2 lg:self-start xl:flex-row">
              <Button variant={inherit ? "primary" : "lemon"} size="lg" onClick={retry} className="min-h-16 max-w-full flex-col gap-0 px-6 py-2.5 text-center leading-tight whitespace-normal">
                <span className="text-[1.0625rem] font-bold whitespace-normal">
                  {queue ? (queueLast ? "Finish the rehearsal" : `Next question (${queuePos + 1} of ${queue.length})`) : "Try again on a new question"}
                </span>
                {!queueLast && (
                  <span className="text-[0.8125rem] font-medium whitespace-normal">
                    {/* In a rehearsal the next question's type is known. A new question may come back as another
                        type (the role pool ran out), and then help doesn't carry (startQuestion), so say so (B-R13-01). */}
                    {strongerOpen && queue && queue[queuePos]?.question.type === question.type
                      ? "Counts as with help: you saw the stronger version"
                      : strongerOpen && !queue
                        ? "Counts as with help if it's the same kind of question"
                        : "Counts as independent"}
                  </span>
                )}
              </Button>
              {done >= 1 && (
                <Button href="/progress" variant="secondary" size="lg" className="min-h-[3.25rem]">
                  See your progress
                </Button>
              )}
            </div>
          </div>
        )}
      </section>
    </DrillField>
  );
}

/** The small pills under the question (Replay / Slower / Skip reading). */
const TOOL_BASE = "inline-flex min-h-11 items-center gap-2 rounded-pill px-4 text-[0.9375rem] font-semibold text-field-fg disabled:opacity-45";
const TOOL_PILL = cx(TOOL_BASE, "bg-field-tint hover:shadow-[inset_0_0_0_1px_var(--field-line)]");

/** Waveform bar heights while recording (decorative). */
const WAVE = [18, 30, 44, 26, 56, 38, 60, 34, 48, 22, 52, 40, 58, 30, 46, 20, 42, 28, 50, 24, 36, 16, 44, 30, 54, 22, 40, 18];

/** 12 345 ms → "0:12". */
function clock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * The flow's screen: a full-height ScreenField (it also colours the header), or, in queue mode, a plain column that
 * inherits the page's field.
 */
function DrillField({
  inherit,
  field,
  spotlight = false,
  wide = false,
  children,
}: {
  inherit: boolean;
  field: FieldName;
  spotlight?: boolean | "rec";
  wide?: boolean;
  children: ReactNode;
}) {
  if (inherit) return <div className="flex flex-1 flex-col">{children}</div>;
  return (
    <ScreenField
      field={field}
      spotlight={spotlight}
      className="flex min-h-[calc(100svh-4rem)] flex-1 flex-col pt-4 pb-8 sm:pt-8 lg:min-h-[calc(100svh-5rem)] lg:pb-16"
      innerClassName="flex flex-1 flex-col"
    >
      <div className={cx("mx-auto flex w-full flex-1 flex-col", !wide && "max-w-[980px]")}>{children}</div>
    </ScreenField>
  );
}

function MicGlyph() {
  return (
    <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4M8 22h8" />
    </svg>
  );
}

function Loading({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-10 font-semibold text-field-muted" role="status">
      <span className="size-5 motion-safe:animate-spin rounded-full border-[3px] border-field-mark border-t-transparent" aria-hidden="true" />
      {text}
    </div>
  );
}

function ErrorBox({ message, onRetry, retryLabel }: { message: string; onRetry(): void; retryLabel: string }) {
  return (
    <Notice tone="error" className="flex flex-col items-start gap-3" role="alert">
      <p className="text-sm">{message}</p>
      <Button variant="ink" size="sm" onClick={onRetry}>
        {retryLabel}
      </Button>
    </Notice>
  );
}
