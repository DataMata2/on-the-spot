import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Blob } from "../Blob";
import { buttonClasses } from "../Button";
import { PaperCard } from "../PaperCard";
import { ScreenField } from "../ScreenField";
import { Sticker } from "../Sticker";

describe("ScreenField", () => {
  it("marks its field and claims the header by default", () => {
    const html = renderToStaticMarkup(h(ScreenField, { field: "night", spotlight: true, "aria-labelledby": "q" }, "x"));
    expect(html).toContain('data-field="night"');
    expect(html).toContain('data-header-field="night"');
    expect(html).toContain("spotlight");
    expect(html).toContain('aria-labelledby="q"');
  });

  it("does not claim the header when claimsHeader is false", () => {
    const html = renderToStaticMarkup(h(ScreenField, { field: "lemon", claimsHeader: false }, "x"));
    expect(html).toContain('data-field="lemon"');
    expect(html).not.toContain("data-header-field");
  });

  it("adds the recording spotlight variant", () => {
    expect(renderToStaticMarkup(h(ScreenField, { field: "night", spotlight: "rec" }))).toContain("spotlight spotlight-rec");
  });
});

describe("Blob", () => {
  it("is decorative in every state", () => {
    for (const state of ["idle", "happy", "thinking", "listening", "proud"] as const) {
      const html = renderToStaticMarkup(h(Blob, { state }));
      expect(html.startsWith('<span aria-hidden="true"')).toBe(true);
      expect(html).toContain("<svg");
    }
  });
});

describe("PaperCard / Sticker", () => {
  it("PaperCard renders the requested element with its field and passes aria props", () => {
    const html = renderToStaticMarkup(h(PaperCard, { as: "article", "aria-label": "Feedback", tone: "ink" }, "x"));
    expect(html).toMatch(/^<article data-field="ink"/);
    expect(html).toContain('aria-label="Feedback"');
  });

  it("tomato sticker uses ink text (white on tomato fails contrast)", () => {
    expect(renderToStaticMarkup(h(Sticker, { tone: "tomato" }, "$79"))).toContain("text-ink");
  });
});

describe("buttonClasses", () => {
  it("keeps its signature and defaults to the field-aware primary pill", () => {
    const c = buttonClasses();
    expect(c).toContain("rounded-pill");
    expect(c).toContain("bg-field-cta");
    expect(buttonClasses({ variant: "secondary", size: "lg", fullWidth: true, className: "x" })).toMatch(/w-full x$/);
  });
});
