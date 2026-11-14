"use client";
// Rehearse my real meeting (Pro): paste the agenda → the server writes the questions for THIS meeting and issues
// an attempt for each → the same drill 1 flow and feedback, walked through in order.

import { errorMessage } from "@/lib/client-error";
import { useRef, useState } from "react";
import { Drill1Flow, type DrillQueueItem } from "@/components/drill/Drill1Flow";
import { Paywall } from "@/components/paywall";
import { EXAMPLE_AGENDA, MAX_AGENDA_CHARS, MIN_AGENDA_CHARS, REHEARSE_COUNT } from "@/lib/rehearse/questions";

type Stage = { k: "input"; error?: string } | { k: "generating" } | { k: "drill"; items: DrillQueueItem[]; run: number } | { k: "paywall"; reason: string };

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
      <div className="flex justify-center">
        <Paywall reason={stage.reason} />
      </div>
    );
  }

  if (stage.k === "drill") {
    return <Drill1Flow key={stage.run} queue={stage.items} onExit={() => setStage({ k: "input" })} />;
  }

  const generating = stage.k === "generating";
  const over = agenda.length > MAX_AGENDA_CHARS;

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold tracking-wide text-accent uppercase">Pro · Rehearse my real meeting</p>
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Practice the questions you&apos;ll actually get.</h1>
        <p className="text-base text-ink-2">
          Paste the agenda or a few lines about your next meeting. We&apos;ll write the {REHEARSE_COUNT} questions someone in that room is most likely to
          ask you, then you answer them out loud, one by one, with the same feedback as the cold-question drill.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-end justify-between gap-3">
          <label htmlFor="agenda" className="text-sm font-semibold text-ink">
            Meeting agenda or context
          </label>
          <button
            type="button"
            onClick={() => {
              setAgenda(EXAMPLE_AGENDA);
              setStage({ k: "input" });
            }}
            disabled={generating}
            className="inline-flex items-center max-sm:min-h-11 text-sm font-semibold text-accent hover:underline disabled:opacity-45"
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
          className="w-full rounded-md border border-line-strong bg-surface px-3.5 py-3 text-base text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none disabled:opacity-60"
        />
        <div id="agenda-help" className="flex justify-between gap-3 text-xs text-ink-3">
          <span>Topics, names, dates, decisions. Leave out anything confidential you don&apos;t want sent to our AI provider.</span>
          <span className={over ? "font-semibold text-red" : undefined}>
            {agenda.length}/{MAX_AGENDA_CHARS}
          </span>
        </div>
      </div>

      {stage.k === "input" && stage.error && (
        <p role="alert" className="rounded-md border border-red/30 bg-red-soft px-4 py-3 text-sm text-red">
          {stage.error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => void generate()}
          disabled={generating || over || agenda.trim().length === 0}
          className="h-13 rounded-md bg-accent px-6 text-base font-semibold text-white hover:bg-accent-hover active:bg-accent-press disabled:opacity-45"
        >
          {generating ? "Writing your questions…" : `Get my ${REHEARSE_COUNT} questions`}
        </button>
        {generating && <span className="size-4 animate-spin rounded-full border-2 border-accent border-t-transparent" role="status" aria-label="Writing your questions" />}
      </div>
    </section>
  );
}
