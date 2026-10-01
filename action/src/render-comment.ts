import { z } from "zod";

import { escapeMarkdown, fence } from "./escape-markdown.ts";
import type { CheckConclusion, CheckOutput } from "./github-api.ts";
import type { PageReview } from "./review-pages.ts";

// The preview scores of one review, carried in its comment so the next review can show the change.
export type ScoreRecord = z.infer<typeof ScoreRecordSchema>;

export type Report = {
  sha: string;
  referenceUrl: string;
  margin: number;
  pages: PageReview[];
  notices: string[];
  previous: ScoreRecord | null;
};

export type Outcome = { conclusion: CheckConclusion; output: CheckOutput };

// Only a comment carrying this marker and written by the workflow's own bot is read back.
export const MARKER = "<!-- taste-review -->";
const SCORES_PREFIX = "<!-- taste-review:scores ";
const ScoreRecordSchema = z.object({
  sha: z.string().regex(/^[0-9a-f]{7,40}$/),
  scores: z.record(z.string().max(200), z.number().min(0).max(1)),
});
const RECOMMENDATIONS_PER_PAGE = 5;
const RECOMMENDATION_CHARS = 500;
// GitHub refuses a comment past 65,536 characters; the fixes are the only part that can grow that far.
const FIXES_CHARS = 40_000;

function score(value: number | null): string {
  return value === null ? "·" : value.toFixed(2);
}

function delta(page: PageReview): number | null {
  return page.production === null || page.preview === null ? null : page.preview - page.production;
}

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function change(page: PageReview, margin: number): string {
  if (page.preview === null) return escapeMarkdown(page.problem ?? "Not scored.");
  if (page.baseline === "reference") return "reference page";
  if (page.baseline === "new") return "new page";
  const value = delta(page);
  if (value === null) return "·";
  if (value <= -margin) return `▼ dropped ${Math.abs(value).toFixed(2)}`;
  if (value >= margin) return `▲ rose ${value.toFixed(2)}`;
  return "steady";
}

function sinceLast(page: PageReview, previous: ScoreRecord, margin: number): string {
  const before = previous.scores[page.path];
  if (page.preview === null) return "·";
  if (before === undefined) return "first review";
  const value = page.preview - before;
  if (value <= -margin) return `▼ ${Math.abs(value).toFixed(2)} from ${before.toFixed(2)}`;
  if (value >= margin) return `▲ ${value.toFixed(2)} from ${before.toFixed(2)}`;
  return `steady from ${before.toFixed(2)}`;
}

function header(sha: string, referenceUrl: string, previous: ScoreRecord | null = null): string {
  const reference = escapeMarkdown(new URL(referenceUrl).host);
  const since = previous
    ? ` Compared with the last review at \`${previous.sha.slice(0, 7)}\`.`
    : "";
  return `${MARKER}\n### Taste review\n\nChecked \`${sha.slice(0, 7)}\` against the brand of ${reference}.${since}`;
}

// Paths are validated site paths and the sha is hex, so the JSON can never close the HTML comment.
function scoresLine(report: Report): string {
  const scores: Record<string, number> = {};
  for (const page of report.pages) if (page.preview !== null) scores[page.path] = page.preview;
  return `${SCORES_PREFIX}${JSON.stringify({ sha: report.sha, scores })} -->`;
}

export function parseScores(body: string): ScoreRecord | null {
  const start = body.indexOf(SCORES_PREFIX);
  if (start === -1) return null;
  const end = body.indexOf(" -->", start);
  if (end === -1) return null;
  try {
    const parsed = ScoreRecordSchema.safeParse(
      JSON.parse(body.slice(start + SCORES_PREFIX.length, end)),
    );
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function dropped(report: Report): PageReview[] {
  return report.pages.filter((page) => (delta(page) ?? 0) <= -report.margin);
}

function recommendations(page: PageReview): string {
  const all = page.verdict?.recommendations ?? [];
  const shown = all.slice(0, RECOMMENDATIONS_PER_PAGE);
  const lines = shown.map(
    (item, index) => `${index + 1}. ${escapeMarkdown(clip(item, RECOMMENDATION_CHARS))}`,
  );
  const cap =
    all.length > shown.length ? `\n\n_${shown.length} of ${all.length} shown, worst first._` : "";
  return `#### \`${page.path}\` · worst first\n\n${lines.join("\n")}${cap}`;
}

function agentBlock(report: Report): string {
  const pages = report.pages
    .filter((page) => (page.verdict?.fixes.length ?? 0) > 0)
    .map((page) => ({ page: page.path, fixes: page.verdict?.fixes }));
  if (pages.length === 0) return "";
  const host = new URL(report.referenceUrl).host;
  const prompt = `These fixes come from a brand review of this pull request's preview against ${host}. Apply them to the source that renders each page, worst first, and keep every exact target value.`;
  const json = JSON.stringify(pages, null, 2);
  const capped =
    json.length > FIXES_CHARS
      ? `${json.slice(0, FIXES_CHARS)}\n… cut at ${FIXES_CHARS.toLocaleString("en")} characters; ask again on fewer pages for the rest.`
      : json;
  return [
    "<details><summary>Fix with your agent</summary>",
    "",
    fence(`${prompt}\n\n${capped}`, "text"),
    "",
    "</details>",
  ].join("\n");
}

export function renderReport(report: Report): string {
  const previous = report.previous;
  const rows = report.pages.map((page) => {
    const cells = [
      `\`${page.path}\``,
      score(page.production),
      score(page.preview),
      change(page, report.margin),
      ...(previous ? [sinceLast(page, previous, report.margin)] : []),
    ];
    return `| ${cells.join(" | ")} |`;
  });
  const table = previous
    ? [
        "| Page | Production | Preview | Change | Since last review |",
        "| --- | ---: | ---: | --- | --- |",
        ...rows,
      ]
    : ["| Page | Production | Preview | Change |", "| --- | ---: | ---: | --- |", ...rows];
  const worst = [...report.pages]
    .filter((page) => (page.verdict?.recommendations.length ?? 0) > 0)
    .sort((a, b) => (a.preview ?? 1) - (b.preview ?? 1));
  const problems = report.pages
    .filter((page) => page.problem && page.preview !== null)
    .map((page) => `- \`${page.path}\`: ${escapeMarkdown(page.problem ?? "")}`);
  const notices = report.notices.map((notice) => `- ${escapeMarkdown(notice)}`);

  return [
    `${header(report.sha, report.referenceUrl, previous)}\n${scoresLine(report)}`,
    table.join("\n"),
    [...notices, ...problems].join("\n"),
    worst.map(recommendations).join("\n\n"),
    agentBlock(report),
    "<sub>Scores run from 0 to 1. Push your fixes and comment <code>/taste review</code> to check again; each review is a new comment.</sub>",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function renderNotice(sha: string, referenceUrl: string, message: string): string {
  return `${header(sha, referenceUrl)}\n\n${escapeMarkdown(message)}`;
}

export function outcome(report: Report): Outcome {
  const drops = dropped(report);
  const failed = report.pages.filter((page) => page.preview === null);
  const total = `${report.pages.length} ${report.pages.length === 1 ? "page" : "pages"}`;
  let title = `${total} · steady against production`;
  if (drops.length > 0) {
    title = `${total} · ${drops.map((page) => `${page.path} dropped ${Math.abs(delta(page) ?? 0).toFixed(2)}`).join(", ")}`;
  } else if (failed.length > 0) {
    title = `${total} · ${failed.length} could not be scored`;
  }
  return {
    conclusion: drops.length > 0 || failed.length > 0 ? "neutral" : "success",
    output: {
      title: title.slice(0, 200),
      summary: "The scores, the recommendations and the fixes are in the pull request comment.",
    },
  };
}
