import * as core from "@actions/core";
import { context } from "@actions/github";

import { createGitHubApi } from "./github-api.ts";
import { readInputs } from "./inputs.ts";
import { probeUrl } from "./review-pages.ts";
import { run } from "./run.ts";
import { createTasteClient } from "./taste-client.ts";
import { readTrigger } from "./trigger.ts";

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// A failed job would show as a red check on the pull request, so even a broken
// setup ends as a warning in the log rather than a failure.
async function main(): Promise<void> {
  try {
    const inputs = readInputs();
    const { owner, repo } = context.repo;
    await run({
      inputs,
      trigger: readTrigger(context.eventName, context.payload),
      api: createGitHubApi(inputs.githubToken, owner, repo),
      taste: createTasteClient({
        apiKey: inputs.tasteApiKey,
        timeoutMs: inputs.timeoutMinutes * 60_000,
      }),
      probe: probeUrl(),
      log: core.info,
      sleep,
      now: Date.now,
    });
  } catch (error) {
    core.warning(
      `taste review could not run: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

await main();
