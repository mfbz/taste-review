import { describe, expect, it } from "vitest";

import { parseInputs, splitPaths } from "./inputs.ts";

const valid = {
  tasteApiKey: "key",
  referenceUrl: "https://www.example.com",
  paths: "/, /pricing",
  margin: "0.05",
  githubToken: "token",
  timeoutMinutes: "15",
  previewWaitMinutes: "10",
};

describe("parseInputs", () => {
  it("reads valid inputs", () => {
    expect(parseInputs(valid)).toMatchObject({ paths: ["/", "/pricing"], margin: 0.05 });
  });

  it("refuses a reference that is not https", () => {
    expect(() => parseInputs({ ...valid, referenceUrl: "http://www.example.com" })).toThrow(
      /https/,
    );
  });

  it("refuses a path that is a URL", () => {
    expect(() => parseInputs({ ...valid, paths: "https://other.example/x" })).toThrow(/site paths/);
  });

  it("refuses a margin outside 0 to 1", () => {
    expect(() => parseInputs({ ...valid, margin: "5" })).toThrow();
  });

  it("never puts the key in an error", () => {
    try {
      parseInputs({ ...valid, tasteApiKey: "secret-value", margin: "nope" });
    } catch (error) {
      expect(String(error)).not.toContain("secret-value");
    }
  });
});

describe("splitPaths", () => {
  it("splits on commas and whitespace and drops duplicates", () => {
    expect(splitPaths(" /a,/b  /a\n/c ")).toEqual(["/a", "/b", "/c"]);
  });
});
