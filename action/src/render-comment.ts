import { escapeMarkdown, fence } from "./escape-markdown.ts";
import type { CheckConclusion, CheckOutput } from "./github-api.ts";
import type { PageReview } from "./review-pages.ts";

export type Report = {
  sha: string;
  referenceUrl: string;
  margin: number;
  pages: PageReview[];
  notices: string[];
};

export type Outcome = { conclusion: CheckConclusion; output: CheckOutput };

// Only a comment carrying this marker and written by the workflow's own bot is edited in place.
export const MARKER = "<!-- taste-review -->";
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

function header(sha: string, referenceUrl: string): string {
  const reference = escapeMarkdown(new URL(referenceUrl).host);
  return `${MARKER}\n### Taste review\n\nChecked \`${sha.slice(0, 7)}\` against the brand of ${reference}.`;
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
  const rows = report.pages.map(
    (page) =>
      `| \`${page.path}\` | ${score(page.production)} | ${score(page.preview)} | ${change(page, report.margin)} |`,
  );
  const table = [
    "| Page | Production | Preview | Change |",
    "| --- | ---: | ---: | --- |",
    ...rows,
  ];
  const worst = [...report.pages]
    .filter((page) => (page.verdict?.recommendations.length ?? 0) > 0)
    .sort((a, b) => (a.preview ?? 1) - (b.preview ?? 1));
  const problems = report.pages
    .filter((page) => page.problem && page.preview !== null)
    .map((page) => `- \`${page.path}\`: ${escapeMarkdown(page.problem ?? "")}`);
  const notices = report.notices.map((notice) => `- ${escapeMarkdown(notice)}`);

  return [
    header(report.sha, report.referenceUrl),
    table.join("\n"),
    [...notices, ...problems].join("\n"),
    worst.map(recommendations).join("\n\n"),
    agentBlock(report),
    "<sub>Scores run from 0 to 1. Push your fixes and comment <code>/taste review</code> to check again.</sub>",
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
