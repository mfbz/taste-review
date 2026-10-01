import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { cn, FONT_SIZES } from "./utils";

const css = readFileSync(join(import.meta.dirname, "..", "app", "globals.css"), "utf8");

describe("cn", () => {
  it("knows every font size globals.css defines", () => {
    const defined = [...css.matchAll(/--text-([a-z]+):/g)].map((match) => match[1]);
    expect(defined.length).toBeGreaterThan(0);
    expect([...new Set(defined)].sort()).toEqual([...FONT_SIZES].sort());
  });

  it("keeps a colour beside a custom size", () => {
    expect(cn("text-label text-muted-foreground")).toBe("text-label text-muted-foreground");
  });

  it("still merges two sizes", () => {
    expect(cn("text-body", "text-label")).toBe("text-label");
  });
});
