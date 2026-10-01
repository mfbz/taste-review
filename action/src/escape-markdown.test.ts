import { describe, expect, it } from "vitest";

import { escapeMarkdown, fence } from "./escape-markdown.ts";

describe("escapeMarkdown", () => {
  it("leaves plain advice readable", () => {
    expect(escapeMarkdown("Snap the heading from 44px to 48px.")).toBe(
      "Snap the heading from 44px to 48px.",
    );
  });

  it("neutralises mentions, references, links and HTML", () => {
    const out = escapeMarkdown(
      "@octocat see #12 [here](https://evil.example) <img src=x> www.evil.example",
    );
    expect(out).not.toMatch(/@\w/);
    expect(out).not.toContain("#12");
    expect(out).not.toMatch(/\]\(/);
    expect(out).not.toContain("<img");
    expect(out).not.toContain("://");
    expect(out).not.toMatch(/www\./i);
    expect(escapeMarkdown("see GH-42")).not.toContain("GH-42");
  });

  it("cannot break a table row or open a code span", () => {
    expect(escapeMarkdown("a | b `c`")).not.toMatch(/[|`]/);
  });

  it("collapses every kind of line break", () => {
    expect(escapeMarkdown("one\ntwo\r\nthree\u2028four\u0085five")).toBe("one two three four five");
  });
});

describe("fence", () => {
  it("uses three backticks for plain content", () => {
    expect(fence("x", "json")).toBe("```json\nx\n```");
  });

  it("outgrows any backtick run inside", () => {
    expect(fence("a ```` b")).toBe("`````\na ```` b\n`````");
  });
});
