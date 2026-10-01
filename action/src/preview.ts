import type { GitHubApi } from "./github-api.ts";

export type PreviewLookup = { kind: "ready"; url: string } | { kind: "pending" } | { kind: "none" };

type Clock = { sleep(ms: number): Promise<void>; now(): number };

const IN_FLIGHT = new Set(["pending", "queued", "in_progress"]);
const POLL_MS = 15_000;

// Vercel registers every deployment with GitHub; the preview is the newest
// non-production one for the commit whose latest status is a success.
// With several Vercel projects in one repository, `environment` names the one to score.
export async function findPreview(
  api: Pick<GitHubApi, "listDeployments" | "listDeploymentStatuses">,
  sha: string,
  environment = "",
): Promise<PreviewLookup> {
  let pending = false;
  for (const deployment of await api.listDeployments(sha)) {
    if (/production/i.test(deployment.environment)) continue;
    if (environment && deployment.environment.toLowerCase() !== environment.toLowerCase()) continue;
    const [latest] = await api.listDeploymentStatuses(deployment.id);
    if (!latest || IN_FLIGHT.has(latest.state)) {
      pending = true;
      continue;
    }
    if (latest.state === "success" && latest.environmentUrl.startsWith("https://")) {
      return { kind: "ready", url: latest.environmentUrl };
    }
  }
  return pending ? { kind: "pending" } : { kind: "none" };
}

export async function waitForPreview(
  api: Pick<GitHubApi, "listDeployments" | "listDeploymentStatuses">,
  sha: string,
  waitMs: number,
  clock: Clock,
  environment = "",
): Promise<PreviewLookup> {
  const deadline = clock.now() + waitMs;
  for (;;) {
    const lookup = await findPreview(api, sha, environment);
    if (lookup.kind === "ready" || clock.now() + POLL_MS > deadline) return lookup;
    await clock.sleep(POLL_MS);
  }
}
