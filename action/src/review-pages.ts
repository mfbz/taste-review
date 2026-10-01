import { TasteError, type TasteClient, type Verdict } from "./taste-client.ts";

export type PageReview = {
  path: string;
  // reference: production is the reference itself; new: the page does not exist in production.
  baseline: "scored" | "reference" | "new";
  production: number | null;
  preview: number | null;
  verdict: Verdict | null;
  problem: string | null;
  // Set when the engine refused every further job, so the run reports why once.
  blocked: "auth" | "credits" | null;
};

export type ReviewOptions = {
  client: TasteClient;
  referenceUrl: string;
  previewOrigin: string;
  paths: string[];
  probe: (url: string) => Promise<number>;
};

export const UNREACHABLE = 599;
// A redirect off the page's own origin is a login wall (Vercel, Cloudflare Access), not the page.
export const REDIRECTED_AWAY = 401;
const MAX_REDIRECTS = 5;

function sameUrl(a: string, b: string): boolean {
  const normalise = (url: string) => new URL(url).href.replace(/\/$/, "");
  return normalise(a) === normalise(b);
}

function describe(error: unknown): string {
  return error instanceof TasteError ? error.message : "The page could not be scored.";
}

function blockedBy(...reasons: unknown[]): PageReview["blocked"] {
  for (const reason of reasons) {
    if (reason instanceof TasteError && (reason.kind === "auth" || reason.kind === "credits")) {
      return reason.kind;
    }
  }
  return null;
}

function probeProblem(status: number): string | null {
  if (status === 404) return "Not found on the preview.";
  if (status === UNREACHABLE) return "The preview did not respond.";
  if (status === REDIRECTED_AWAY) return "The preview sent this page to a login wall.";
  return status >= 400 ? `The preview answered ${status}.` : null;
}

async function reviewPage(options: ReviewOptions, path: string): Promise<PageReview> {
  const productionUrl = new URL(path, options.referenceUrl).href;
  const previewUrl = new URL(path, options.previewOrigin).href;
  const isReference = sameUrl(productionUrl, options.referenceUrl);
  const empty = { path, production: null, preview: null, verdict: null, blocked: null };

  // A dead page must never reach the engine: a job spends credits whatever it finds.
  const [previewStatus, productionStatus] = await Promise.all([
    options.probe(previewUrl),
    isReference ? Promise.resolve(200) : options.probe(productionUrl),
  ]);
  const unreachable = probeProblem(previewStatus);
  const baseline = isReference ? "reference" : productionStatus >= 400 ? "new" : "scored";
  if (unreachable) return { ...empty, baseline, problem: unreachable };

  const [production, preview] = await Promise.allSettled([
    baseline === "scored"
      ? options.client.judge(options.referenceUrl, productionUrl)
      : Promise.resolve(null),
    options.client.judge(options.referenceUrl, previewUrl),
  ]);
  const blocked = blockedBy(
    production.status === "rejected" ? production.reason : null,
    preview.status === "rejected" ? preview.reason : null,
  );

  if (preview.status === "rejected") {
    return { ...empty, baseline, problem: describe(preview.reason), blocked };
  }
  const productionScore =
    production.status === "fulfilled" ? (production.value?.score ?? null) : null;
  let problem: string | null = null;
  if (preview.value.score === null) problem = "The engine returned no score for the preview.";
  else if (production.status === "rejected") {
    problem = `Production could not be scored. ${describe(production.reason)}`;
  } else if (baseline === "scored" && productionScore === null) {
    problem = "The engine returned no score for production.";
  }

  return {
    path,
    baseline,
    production: productionScore,
    preview: preview.value.score,
    verdict: preview.value,
    problem,
    blocked,
  };
}

// Settles every page, so verdicts already paid for survive a key or balance failure on another.
export async function reviewPages(options: ReviewOptions): Promise<PageReview[]> {
  return Promise.all(options.paths.map((path) => reviewPage(options, path)));
}

export function probeUrl(fetchFn: typeof fetch = fetch): (url: string) => Promise<number> {
  return async (url) => {
    let current = url;
    try {
      for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
        const response = await fetchFn(current, {
          redirect: "manual",
          signal: AbortSignal.timeout(20_000),
        });
        await response.body?.cancel();
        const location = response.headers.get("location");
        if (response.status < 300 || response.status >= 400 || !location) return response.status;
        const next = new URL(location, current);
        if (next.origin !== new URL(url).origin) return REDIRECTED_AWAY;
        current = next.href;
      }
      return UNREACHABLE;
    } catch {
      return UNREACHABLE;
    }
  };
}
