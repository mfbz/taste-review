import { canPush } from "./access.ts";
import type { CheckConclusion, CheckOutput, GitHubApi } from "./github-api.ts";
import { MAX_PAGES, type Inputs } from "./inputs.ts";
import { waitForPreview } from "./preview.ts";
import { MARKER, outcome, renderNotice, renderReport } from "./render-comment.ts";
import { reviewPages, type PageReview } from "./review-pages.ts";
import { TasteError, type TasteClient } from "./taste-client.ts";
import type { Trigger } from "./trigger.ts";

export type RunDeps = {
  inputs: Inputs;
  trigger: Trigger | null;
  api: GitHubApi;
  taste: TasteClient;
  probe: (url: string) => Promise<number>;
  log: (message: string) => void;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
};

// The comment found again on the next run is the one this workflow's default token wrote.
const BOT_LOGIN = "github-actions[bot]";
const BLOCKED_MESSAGE = {
  auth: "The Taste Engine refused the key. Check the TASTE_API_KEY secret.",
  credits: "Your Taste Engine account is out of credits. Top it up and ask again.",
} as const;

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function upsertComment(api: GitHubApi, prNumber: number, body: string): Promise<void> {
  const existing = (await api.listComments(prNumber)).find(
    (comment) =>
      comment.login === BOT_LOGIN && comment.userType === "Bot" && comment.body.startsWith(MARKER),
  );
  if (existing) await api.updateComment(existing.id, body);
  else await api.createComment(prNumber, body);
}

function pagesFor(trigger: Trigger, inputs: Inputs): { paths: string[]; notices: string[] } {
  const notices: string[] = [];
  const asked =
    trigger.kind === "command" && trigger.paths.length > 0 ? trigger.paths : inputs.paths;
  if (trigger.kind === "command" && trigger.rejected.length > 0) {
    notices.push(`Skipped ${trigger.rejected.join(", ")}: a page is a path like /pricing.`);
  }
  if (asked.length > MAX_PAGES) {
    notices.push(
      `Checked the first ${MAX_PAGES} of ${asked.length} pages; ask again for the rest.`,
    );
  }
  return { paths: asked.slice(0, MAX_PAGES), notices };
}

function failureMessage(error: unknown): string {
  if (error instanceof TasteError && (error.kind === "auth" || error.kind === "credits")) {
    return BLOCKED_MESSAGE[error.kind];
  }
  return "The review could not finish. Ask again with /taste review, and see the workflow log if it repeats.";
}

function blockedNotice(pages: PageReview[]): string | null {
  const blocked = pages.find((page) => page.blocked)?.blocked;
  return blocked ? BLOCKED_MESSAGE[blocked] : null;
}

// Never throws and never fails the job: a brand score is advice, so every
// failure of ours ends as a neutral check with the next step written on it.
export async function run(deps: RunDeps): Promise<void> {
  const { inputs, trigger, api, log } = deps;
  if (!trigger) {
    log("Not a /taste review command or a ready-for-review event; nothing to do.");
    return;
  }

  // A review spends the team's credits, whoever or whatever started it.
  if (!(await canPush(api, trigger.login, trigger.association, trigger.userType))) {
    log(`Ignored a review for ${trigger.login}: only people who can push may spend credits.`);
    return;
  }

  const pr = await api.getPullRequest(trigger.prNumber);
  if (!pr.open) {
    log(`Pull request #${pr.number} is closed; nothing to review.`);
    return;
  }
  if (trigger.kind === "command") {
    await api.addEyes(trigger.commentId).catch(() => log("Could not react to the comment."));
    if (trigger.paths.length === 0 && trigger.rejected.length > 0) {
      const message = `Nothing checked: ${trigger.rejected.join(", ")} is not a page. Name pages as paths, like /taste review /pricing.`;
      await upsertComment(api, pr.number, renderNotice(pr.headSha, inputs.referenceUrl, message));
      return;
    }
  }

  const { paths, notices } = pagesFor(trigger, inputs);
  const plural = paths.length === 1 ? "page" : "pages";
  const checkId = await api.startCheck(pr.headSha, {
    title: `Checking ${paths.length} ${plural} against your brand`,
    summary: "Waiting for the preview, then scoring each page. This takes a few minutes.",
  });

  // The check completes even when the comment cannot be written, so it never hangs in progress.
  const report = async (body: string, conclusion: CheckConclusion, output: CheckOutput) => {
    try {
      await upsertComment(api, pr.number, body);
    } catch (error) {
      log(`Could not write the comment: ${errorText(error)}`);
    } finally {
      await api.finishCheck(checkId, conclusion, output);
    }
  };
  const notice = (message: string) =>
    report(renderNotice(pr.headSha, inputs.referenceUrl, message), "neutral", {
      title: message.slice(0, 200),
      summary: message,
    });

  try {
    const preview = await waitForPreview(
      api,
      pr.headSha,
      inputs.previewWaitMinutes * 60_000,
      deps,
      inputs.previewEnvironment,
    );
    if (preview.kind !== "ready") {
      await notice(
        preview.kind === "pending"
          ? `The Vercel preview for ${pr.headSha.slice(0, 7)} is still building. Ask again when it is ready.`
          : `No Vercel preview found for ${pr.headSha.slice(0, 7)}. Nothing was spent.`,
      );
      return;
    }

    const status = await deps.probe(preview.url);
    if (status === 401 || status === 403) {
      await notice(
        "The preview is protected. Turn off Vercel's deployment protection for previews; nothing was spent.",
      );
      return;
    }

    const pages = await reviewPages({
      client: deps.taste,
      referenceUrl: inputs.referenceUrl,
      previewOrigin: preview.url,
      paths,
      probe: deps.probe,
    });
    const blocked = blockedNotice(pages);
    if (blocked && pages.every((page) => page.preview === null)) {
      await notice(blocked);
      return;
    }
    const result = {
      sha: pr.headSha,
      referenceUrl: inputs.referenceUrl,
      margin: inputs.margin,
      pages,
      notices: blocked ? [...notices, blocked] : notices,
    };
    const { conclusion, output } = outcome(result);
    await report(renderReport(result), conclusion, output);
  } catch (error) {
    log(`Review failed: ${errorText(error)}`);
    await notice(failureMessage(error)).catch((cause: unknown) =>
      log(`Could not report the failure: ${errorText(cause)}`),
    );
  }
}
