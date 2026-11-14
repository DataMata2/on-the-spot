"use client";
// "What do you do?": one screen before drill 1's first question, so the cold questions match the user's job.
// One tap on a role chip goes straight on; "Other" opens a short text box (≤ 60 chars) and a continue button;
// "Skip" picks the general questions. The parent saves the choice (lib/progress/role) and paints the field.

import { useId, useState } from "react";
import { Blob, Button, TextInput } from "@/components/kit";
import { cleanRoleText, ROLE_CHIPS, ROLE_TEXT_MAX, type Role } from "@/lib/drill1/roles";

export interface RolePickerProps {
  onPick(role: Role): void;
  /** The current role when changing it (its chip is marked). */
  current?: Role | null;
}

const CHIP =
  "flex min-h-12 w-full items-center rounded-chip bg-field-tint px-4 py-2 text-left text-[0.9375rem] leading-tight font-semibold text-field-fg " +
  "transition-[background-color,color,box-shadow] duration-150 hover:shadow-[inset_0_0_0_1px_var(--field-line)] active:bg-lemon active:text-ink " +
  "aria-pressed:bg-lemon aria-pressed:text-ink aria-pressed:shadow-sticker-sm max-[359px]:px-3 max-[359px]:text-sm sm:w-auto sm:px-5 sm:text-base";

export function RolePicker({ onPick, current }: RolePickerProps) {
  const [otherOpen, setOtherOpen] = useState(current?.id === "other");
  const [text, setText] = useState(current?.id === "other" ? (current.text ?? "") : "");
  const inputId = useId();
  const cleaned = cleanRoleText(text);

  const submitOther = () => {
    if (cleaned) onPick({ id: "other", text: cleaned });
  };

  return (
    <section className="flex flex-1 flex-col gap-6 lg:gap-10" aria-labelledby="role-title">
      <div className="relative flex flex-col gap-3 lg:gap-4">
        <Blob state="happy" size="clamp(52px,9vw,120px)" bob className="absolute top-0 right-0 max-sm:hidden" />
        <p className="type-label flex items-center gap-2 text-field-mark">
          <Blob state="happy" size={28} className="sm:hidden" />
          Drill 1 · Cold question
        </p>
        <h1 id="role-title" className="type-display max-w-[14ch] text-[clamp(2.5rem,11vw,5.5rem)] leading-[0.98] text-field-fg">
          What do you do?
        </h1>
        <p className="max-w-[52ch] text-base text-field-muted sm:text-lg">We&apos;ll ask the questions people in your job get asked. One tap, no sign-up.</p>
      </div>

      <ul className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-3" aria-label="Your work">
        {ROLE_CHIPS.map((chip) => {
          const pressed = chip.id === "other" ? otherOpen : current?.id === chip.id;
          return (
            <li key={chip.id} className="flex">
              <button
                type="button"
                className={CHIP}
                aria-pressed={pressed}
                aria-expanded={chip.id === "other" ? otherOpen : undefined}
                aria-controls={chip.id === "other" ? `${inputId}-box` : undefined}
                onClick={() => (chip.id === "other" ? setOtherOpen((o) => !o) : onPick({ id: chip.id }))}
              >
                {chip.label}
              </button>
            </li>
          );
        })}
      </ul>

      {otherOpen && (
        <form
          id={`${inputId}-box`}
          className="flex max-w-[480px] flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            submitOther();
          }}
        >
          <div className="flex flex-col gap-1.5">
            <label htmlFor={inputId} className="text-sm font-semibold text-field-fg">
              Your job, in a few words
            </label>
            <TextInput
              id={inputId}
              value={text}
              maxLength={ROLE_TEXT_MAX}
              onChange={(e) => setText(e.target.value.slice(0, ROLE_TEXT_MAX))}
              placeholder="e.g. Civil engineer, HR manager"
              autoComplete="organization-title"
              autoFocus
              aria-describedby={`${inputId}-count`}
            />
            <p id={`${inputId}-count`} className="text-xs text-field-muted tabular-nums">
              {text.length}/{ROLE_TEXT_MAX}
            </p>
          </div>
          <Button type="submit" size="lg" disabled={!cleaned} className="sm:w-fit">
            Continue
          </Button>
        </form>
      )}

      <div>
        <button
          type="button"
          onClick={() => onPick({ id: "general" })}
          className="inline-flex min-h-11 items-center text-[0.9375rem] font-semibold text-field-fg underline decoration-1 underline-offset-4 hover:no-underline"
        >
          Skip, use general questions
        </button>
      </div>
    </section>
  );
}
