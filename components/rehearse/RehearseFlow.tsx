"use client";
// Rehearse my real meeting (Pro): paste the agenda → the server writes the questions for THIS meeting and issues
// an attempt for each → the same drill 1 flow and feedback, walked through in order.

import { errorMessage } from "@/lib/client-error";
import { useRef, useState, type ReactNode } from "react";
import { Drill1Flow, type DrillQueueItem } from "@/components/drill/Drill1Flow";
import { Blob, PaperCard, ScreenField } from "@/components/kit";
import { buttonClasses } from "@/components/kit/Button";
import { Paywall } from "@/components/paywall";
import { EXAMPLE_AGENDA, MAX_AGENDA_CHARS, MIN_AGENDA_CHARS, REHEARSE_COUNT } from "@/lib/rehearse/questions";

type Stage = { k: "input"; error?: string } | { k: "generating" } | { k: "drill"; items: DrillQueueItem[]; run: number } | { k: "paywall"; reason: string };

/** The cobalt field every rehearse screen sits on, the queued drill included (Drill1Flow inherits it in queue mode). */
export function RehearseField({ children }: { children: ReactNode }) {
  return (
    <ScreenField
      field="cobalt"
      className="flex-1 pt-6 pb-16 sm:pt-10 lg:pb-24"
      deco={<div className="absolute top-10 -right-60 size-[420px] rounded-full border-[56px] border-paper/[0.08] lg:-right-40 lg:size-[560px]" />}
    >
      {children}
    </ScreenField>
  );
}

export function RehearseFlow() {
  const [agenda, setAgenda] = useState("");
  const [stage, setStage] = useState<Stage>({ k: "input" });
  const runs = useRef(0);
  const abort = useRef<AbortController | null>(null);

  const generate = async () => {
    const text = agenda.trim();
    if (text.length < MIN_AGENDA_CHARS) {
      setStage({ k: "input", error: "Paste a bit more about the meeting: the agenda, who's there, what's being decided." });
      return;
    }
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setStage({ k: "generating" });
    let res: Response;
    let body: { items?: DrillQueueItem[]; error?: string; code?: string };
    try {
      res = await fetch("/api/rehearse/questions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ agenda: text }),
        signal: ctrl.signal,
      });
      body = await res.json().catch(() => ({}));
    } catch {
      if (ctrl.signal.aborted) return;
      setStage({ k: "input", error: "We couldn't reach the server. Check your connection and try again." });
      return;
    }
    if (res.status === 402) {
      setStage({ k: "paywall", reason: body.error ?? "Rehearse my real meeting is part of Pro." });
      return;
    }
    if (!res.ok || !body.items?.length) {
      setStage({ k: "input", error: errorMessage(res.status, body.error, "Something went wrong. Try again.") });
      return;
    }
    runs.current += 1;
    setStage({ k: "drill", items: body.items, run: runs.current });
  };

  if (stage.k === "paywall") {
    return (
      <RehearseField>
        <div className="flex justify-center">
          <div data-field="paper" className="w-full max-w-md bg-transparent">
            <Paywall reason={stage.reason} />
          </div>
        </div>
      </RehearseField>
    );
  }

  if (stage.k === "drill") {
    // Queue mode paints no field of its own (Drill1Flow inherits the page's): the cobalt rehearse field and its gutters.
    return (
      <RehearseField>
        <Drill1Flow key={stage.run} queue={stage.items} onExit={() => setStage({ k: "input" })} />
      </RehearseField>
    );
  }

  const generating = stage.k === "generating";
  const over = agenda.length > MAX_AGENDA_CHARS;

  return (
    <RehearseField>
      <section className="flex flex-col gap-10 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,600px)] lg:items-start lg:gap-16">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <p className="type-label text-field-mark">Pro · Rehearse my real meeting</p>
            <Blob state={generating ? "thinking" : "idle"} size={48} bob />
          </div>
          <h1 className="type-display max-w-[14ch] text-[clamp(40px,11vw,80px)] leading-[0.98] text-field-fg">Practice the questions you&apos;ll actually get.</h1>
          <p className="max-w-[56ch] text-lg text-field-muted">
            Paste the agenda or a few lines about your next meeting. We&apos;ll write the {REHEARSE_COUNT} questions someone in that room is most likely to
            ask you, then you answer them out loud, one by one, with the same feedback as the cold-question drill.
          </p>
        </div>

        <PaperCard sticker className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
              <label htmlFor="agenda" className="text-base font-semibold text-ink">
                Meeting agenda or context
              </label>
              <button
                type="button"
                onClick={() => {
                  setAgenda(EXAMPLE_AGENDA);
                  setStage({ k: "input" });
                }}
                disabled={generating}
                className="-mr-3 inline-flex min-h-11 items-center rounded-pill px-3 text-sm font-semibold text-accent underline-offset-4 hover:underline disabled:opacity-45"
              >
                Try an example agenda
              </button>
            </div>
            <textarea
              id="agenda"
              value={agenda}
              onChange={(e) => setAgenda(e.target.value)}
              disabled={generating}
              rows={9}
              maxLength={MAX_AGENDA_CHARS + 200}
              placeholder={"Weekly sync, Thursday 10:00\n1. Launch status\n2. Vendor decision\n3. Q3 estimate\n…"}
              aria-describedby="agenda-help"
              className="w-full rounded-lg border-2 border-ink bg-paper px-4 py-3 text-base text-ink placeholder:text-ink-3 focus:border-cobalt disabled:opacity-60"
            />
            <div id="agenda-help" className="flex justify-between gap-3 text-xs text-ink-2">
              <span>Topics, names, dates, decisions. Leave out anything confidential you don&apos;t want sent to our AI provider.</span>
              <span className={"font-mono tabular-nums " + (over ? "font-semibold text-red" : "")}>
                {agenda.length}/{MAX_AGENDA_CHARS}
              </span>
            </div>
          </div>

          {stage.k === "input" && stage.error && (
            <p role="alert" className="rounded-lg border-l-4 border-red bg-red-soft px-4 py-3 text-sm text-red">
              {stage.error}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => void generate()}
              disabled={generating || over || agenda.trim().length === 0}
              className={buttonClasses({ size: "lg", className: "max-sm:w-full" })}
            >
              {generating ? "Writing your questions…" : `Get my ${REHEARSE_COUNT} questions`}
            </button>
            {generating && <span className="size-4 motion-safe:animate-spin rounded-full border-2 border-accent border-t-transparent" role="status" aria-label="Writing your questions" />}
          </div>
        </PaperCard>
      </section>
    </RehearseField>
  );
}
