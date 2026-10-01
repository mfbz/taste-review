import { describe, expect, it } from "vitest";

import {
  MARKER,
  outcome,
  parseScores,
  renderNotice,
  renderReport,
  type Report,
  type ScoreRecord,
} from "./render-comment.ts";
import type { PageReview } from "./review-pages.ts";

function page(overrides: Partial<PageReview> & { path: string }): PageReview {
  return {
    baseline: "scored",
    production: 0.84,
    preview: 0.83,
    verdict: { score: 0.83, recommendations: [], fixes: [] },
    problem: null,
    blocked: null,
    ...overrides,
  };
}

function report(
  pages: PageReview[],
  notices: string[] = [],
  previous: ScoreRecord | null = null,
): Report {
  return {
    previous,
    sha: "a1b2c3d4e5",
    referenceUrl: "https://www.example.com",
    margin: 0.05,
    pages,
    notices,
  };
}

describe("renderReport", () => {
  it("starts with the marker and names the commit and the reference", () => {
    const body = renderReport(report([page({ path: "/" })]));
    expect(body.startsWith(MARKER)).toBe(true);
    expect(body).toContain("`a1b2c3d`");
    expect(body).toContain("www&#46;example.com");
  });

  it("flags a drop past the margin and leaves a small one steady", () => {
    const body = renderReport(
      report([
        page({ path: "/", production: 0.86, preview: 0.85 }),
        page({ path: "/pricing", production: 0.84, preview: 0.71 }),
      ]),
    );
    expect(body).toContain("| `/` | 0.86 | 0.85 | steady |");
    expect(body).toContain("| `/pricing` | 0.84 | 0.71 | ▼ dropped 0.13 |");
  });

  it("marks the reference page, which has no production score", () => {
    const body = renderReport(
      report([page({ path: "/", baseline: "reference", production: null, preview: 0.9 })]),
    );
    expect(body).toContain("| `/` | · | 0.90 | reference page |");
  });

  it("marks a page production does not have yet", () => {
    const body = renderReport(
      report([page({ path: "/new", baseline: "new", production: null, preview: 0.7 })]),
    );
    expect(body).toContain("| `/new` | · | 0.70 | new page |");
  });

  it("never calls a page whose production score is missing the reference", () => {
    const body = renderReport(
      report([
        page({
          path: "/pricing",
          production: null,
          preview: 0.7,
          problem: "The engine returned no score for production.",
        }),
      ]),
    );
    expect(body).toContain("| `/pricing` | · | 0.70 | · |");
    expect(body).toContain("- `/pricing`: The engine returned no score for production.");
    expect(body).not.toContain("reference page");
  });

  it("explains a preview the engine returned no score for", () => {
    const body = renderReport(
      report([
        page({
          path: "/",
          preview: null,
          problem: "The engine returned no score for the preview.",
        }),
      ]),
    );
    expect(body).toContain("The engine returned no score for the preview.");
  });

  it("stays under GitHub's comment limit with the largest verdicts", () => {
    const fixes = Array.from({ length: 20 }, () => ({ action: "x", note: "y".repeat(5_000) }));
    const recommendations = Array.from({ length: 20 }, () => "z".repeat(5_000));
    const pages = ["/a", "/b", "/c", "/d", "/e"].map((path) =>
      page({ path, verdict: { score: 0.5, recommendations, fixes } }),
    );
    const body = renderReport(report(pages));
    expect(body.length).toBeLessThan(65_536);
    expect(body).toContain("cut at 40,000 characters");
  });

  it("lists recommendations worst page first, capped and escaped", () => {
    const recommendations = ["@team fix #1 <b>now</b>", "b", "c", "d", "e", "f", "g"];
    const body = renderReport(
      report([
        page({
          path: "/a",
          preview: 0.8,
          verdict: { score: 0.8, recommendations: ["x"], fixes: [] },
        }),
        page({ path: "/b", preview: 0.6, verdict: { score: 0.6, recommendations, fixes: [] } }),
      ]),
    );
    expect(body.indexOf("`/b` · worst first")).toBeLessThan(body.indexOf("`/a` · worst first"));
    expect(body).toContain("5 of 7 shown");
    expect(body).not.toContain("@team");
    expect(body).not.toContain("<b>");
  });

  it("puts the fixes in a fenced block for the agent", () => {
    const fixes = [
      { action: "snap_to_token", property: "font_size", from: "44px", to_value: "48px" },
    ];
    const body = renderReport(
      report([page({ path: "/", verdict: { score: 0.8, recommendations: [], fixes } })]),
    );
    expect(body).toContain("<details><summary>Fix with your agent</summary>");
    expect(body).toContain('"to_value": "48px"');
  });

  it("keeps a hostile fix inside its fence", () => {
    const fixes = [{ action: "x", note: "```\n@everyone\n```" }];
    const body = renderReport(
      report([page({ path: "/", verdict: { score: 0.8, recommendations: [], fixes } })]),
    );
    const fenceLine = body.split("\n").find((line) => /^`{4,}text$/.test(line));
    expect(fenceLine).toBeDefined();
  });

  it("shows the notices and a page that could not be scored", () => {
    const body = renderReport(
      report(
        [
          page({
            path: "/gone",
            production: null,
            preview: null,
            verdict: null,
            problem: "Not found on the preview.",
          }),
        ],
        ["Checked the first 5 of 7 pages; ask again for the rest."],
      ),
    );
    expect(body).toContain("| `/gone` | · | · | Not found on the preview. |");
    expect(body).toContain("- Checked the first 5 of 7 pages; ask again for the rest.");
  });
});

describe("review history", () => {
  it("carries its preview scores so the next review can read them back", () => {
    const body = renderReport(
      report([
        page({ path: "/pricing", preview: 0.35 }),
        page({ path: "/gone", preview: null, verdict: null, problem: "x" }),
      ]),
    );
    expect(parseScores(body)).toEqual({ sha: "a1b2c3d4e5", scores: { "/pricing": 0.35 } });
  });

  it("adds the change since the last review", () => {
    const body = renderReport(
      report([page({ path: "/pricing", preview: 0.9 }), page({ path: "/new", preview: 0.8 })], [], {
        sha: "80fa1ef",
        scores: { "/pricing": 0.35 },
      }),
    );
    expect(body).toContain("Compared with the last review at `80fa1ef`.");
    expect(body).toContain("| Page | Production | Preview | Change | Since last review |");
    expect(body).toContain("▲ 0.55 from 0.35 |");
    expect(body).toContain("first review |");
  });

  it("leaves the column out on the first review", () => {
    expect(renderReport(report([page({ path: "/" })]))).not.toContain("Since last review");
  });

  it("ignores scores that are malformed or out of range", () => {
    const line = (json: string) => `${MARKER}\n<!-- taste-review:scores ${json} -->`;
    expect(parseScores(line("{not json"))).toBeNull();
    expect(parseScores(line('{"sha":"80fa1ef","scores":{"/":7}}'))).toBeNull();
    expect(parseScores(line('{"sha":"not-a-sha","scores":{}}'))).toBeNull();
    expect(parseScores("no scores here")).toBeNull();
  });
});

describe("outcome", () => {
  it("is green when every page held steady", () => {
    expect(outcome(report([page({ path: "/" })])).conclusion).toBe("success");
  });

  it("is neutral, never failing, when a page dropped", () => {
    const result = outcome(report([page({ path: "/pricing", production: 0.84, preview: 0.71 })]));
    expect(result.conclusion).toBe("neutral");
    expect(result.output.title).toBe("1 page · /pricing dropped 0.13");
  });

  it("is neutral when a page could not be scored", () => {
    const result = outcome(
      report([page({ path: "/", preview: null, verdict: null, problem: "x" })]),
    );
    expect(result.conclusion).toBe("neutral");
  });
});

describe("renderNotice", () => {
  it("escapes the message under the same header", () => {
    const body = renderNotice("a1b2c3d4", "https://www.example.com", "No preview <for> you");
    expect(body.startsWith(MARKER)).toBe(true);
    expect(body).toContain("No preview &lt;for&gt; you");
  });
});
