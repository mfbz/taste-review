import { describe, expect, it } from "vitest";

import type { CheckConclusion, CheckOutput, GitHubApi, IssueComment } from "./github-api.ts";
import type { Inputs } from "./inputs.ts";
import { MARKER } from "./render-comment.ts";
import { run } from "./run.ts";
import { TasteError, type TasteClient, type Verdict } from "./taste-client.ts";
import type { Trigger } from "./trigger.ts";

const INPUTS: Inputs = {
  tasteApiKey: "key",
  referenceUrl: "https://www.example.com/",
  paths: ["/", "/pricing"],
  margin: 0.05,
  githubToken: "token",
  timeoutMinutes: 15,
  previewWaitMinutes: 1,
  previewEnvironment: "",
};

const COMMAND: Trigger = {
  kind: "command",
  prNumber: 7,
  commentId: 99,
  login: "dev",
  association: "MEMBER",
  userType: "User",
  paths: [],
  rejected: [],
};

function verdict(score: number): Verdict {
  return { score, recommendations: [`Score ${score}`], fixes: [] };
}

function fakeGitHub(
  options: { permission?: string; previewState?: string; comments?: IssueComment[] } = {},
) {
  const state = {
    checks: [] as { id: number; sha: string; conclusion?: CheckConclusion; output: CheckOutput }[],
    created: [] as string[],
    updated: [] as { id: number; body: string }[],
    eyes: 0,
  };
  const api: GitHubApi = {
    async getPullRequest(number) {
      return { number, headSha: "abc1234def", open: true };
    },
    async getPermission() {
      return options.permission ?? "write";
    },
    async addEyes() {
      state.eyes++;
    },
    async listDeployments() {
      return [{ id: 1, environment: "Preview" }];
    },
    async listDeploymentStatuses() {
      return [
        { state: options.previewState ?? "success", environmentUrl: "https://pr-7.vercel.app" },
      ];
    },
    async listComments() {
      return options.comments ?? [];
    },
    async createComment(_number, body) {
      state.created.push(body);
    },
    async updateComment(id, body) {
      state.updated.push({ id, body });
    },
    async startCheck(sha, output) {
      state.checks.push({ id: state.checks.length + 1, sha, output });
      return state.checks.length;
    },
    async finishCheck(id, conclusion, output) {
      Object.assign(state.checks[id - 1] ?? {}, { conclusion, output });
    },
  };
  return { api, state };
}

function fakeTaste(scores: Record<string, number | Error>): TasteClient & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    async judge(_reference, candidate) {
      calls.push(candidate);
      const score = scores[candidate];
      if (score instanceof Error) throw score;
      if (score === undefined) throw new Error(`no score for ${candidate}`);
      return verdict(score);
    },
  };
}

function deps(overrides: Partial<Parameters<typeof run>[0]>) {
  const logs: string[] = [];
  let time = 0;
  return {
    logs,
    value: {
      inputs: INPUTS,
      trigger: COMMAND,
      api: fakeGitHub().api,
      taste: fakeTaste({}),
      probe: async () => 200,
      log: (message: string) => void logs.push(message),
      sleep: async (ms: number) => void (time += ms),
      now: () => time,
      ...overrides,
    },
  };
}

const SCORES = {
  "https://pr-7.vercel.app/": 0.9,
  "https://www.example.com/pricing": 0.84,
  "https://pr-7.vercel.app/pricing": 0.71,
};

describe("run", () => {
  it("reviews every page, comments once and leaves a neutral check on a drop", async () => {
    const github = fakeGitHub();
    const taste = fakeTaste(SCORES);
    await run(deps({ api: github.api, taste }).value);

    expect(github.state.eyes).toBe(1);
    // The home page is the reference itself, so production is never judged against itself.
    expect(taste.calls.sort()).toEqual(Object.keys(SCORES).sort());
    expect(github.state.created).toHaveLength(1);
    expect(github.state.created[0]).toContain("▼ dropped 0.13");
    expect(github.state.checks[0]).toMatchObject({ sha: "abc1234def", conclusion: "neutral" });
  });

  it("edits its own comment rather than adding another", async () => {
    const github = fakeGitHub({
      comments: [
        { id: 5, body: `${MARKER}\nold`, login: "someone", userType: "User" },
        { id: 6, body: `${MARKER}\nold`, login: "github-actions[bot]", userType: "Bot" },
      ],
    });
    await run(deps({ api: github.api, taste: fakeTaste(SCORES) }).value);
    expect(github.state.created).toHaveLength(0);
    expect(github.state.updated.map((update) => update.id)).toEqual([6]);
  });

  it("ignores someone who cannot push and spends nothing", async () => {
    const github = fakeGitHub({ permission: "read" });
    const taste = fakeTaste(SCORES);
    const { value, logs } = deps({ api: github.api, taste });
    await run(value);
    expect(taste.calls).toHaveLength(0);
    expect(github.state.checks).toHaveLength(0);
    expect(logs.join()).toMatch(/only people who can push/);
  });

  it("checks only the pages the command names", async () => {
    const taste = fakeTaste(SCORES);
    await run(deps({ trigger: { ...COMMAND, paths: ["/pricing"] }, taste }).value);
    expect(taste.calls.sort()).toEqual([
      "https://pr-7.vercel.app/pricing",
      "https://www.example.com/pricing",
    ]);
  });

  it("says so and spends nothing when the preview never finishes", async () => {
    const github = fakeGitHub({ previewState: "in_progress" });
    const taste = fakeTaste(SCORES);
    await run(deps({ api: github.api, taste }).value);
    expect(taste.calls).toHaveLength(0);
    expect(github.state.created[0]).toContain("still building");
    expect(github.state.checks[0]?.conclusion).toBe("neutral");
  });

  it("stops before spending when the preview is protected", async () => {
    const github = fakeGitHub();
    const taste = fakeTaste(SCORES);
    await run(deps({ api: github.api, taste, probe: async () => 401 }).value);
    expect(taste.calls).toHaveLength(0);
    expect(github.state.created[0]).toContain("deployment protection");
  });

  it("turns an empty balance into a neutral check with the next step", async () => {
    const github = fakeGitHub();
    const credits = new TasteError("credits", "out");
    const taste = fakeTaste({
      "https://pr-7.vercel.app/": credits,
      "https://pr-7.vercel.app/pricing": credits,
      "https://www.example.com/pricing": credits,
    });
    await run(deps({ api: github.api, taste }).value);
    expect(github.state.created[0]).toContain("out of credits");
    expect(github.state.checks[0]?.conclusion).toBe("neutral");
  });

  it("does nothing without a trigger", async () => {
    const github = fakeGitHub();
    await run(deps({ api: github.api, trigger: null }).value);
    expect(github.state.checks).toHaveLength(0);
  });

  it("scores a page production does not have yet against nothing, and pays for one job", async () => {
    const taste = fakeTaste({ "https://pr-7.vercel.app/new": 0.7 });
    const github = fakeGitHub();
    const probe = async (url: string) => (url === "https://www.example.com/new" ? 404 : 200);
    await run(
      deps({ api: github.api, taste, probe, trigger: { ...COMMAND, paths: ["/new"] } }).value,
    );
    expect(taste.calls).toEqual(["https://pr-7.vercel.app/new"]);
    expect(github.state.created[0]).toContain("new page");
  });

  it("keeps the pages already paid for when the balance runs out mid-run", async () => {
    const github = fakeGitHub();
    const credits = new TasteError("credits", "out");
    const taste = fakeTaste({
      "https://pr-7.vercel.app/": 0.9,
      "https://www.example.com/pricing": credits,
      "https://pr-7.vercel.app/pricing": credits,
    });
    await run(deps({ api: github.api, taste }).value);
    expect(github.state.created[0]).toContain("| `/` | · | 0.90 | reference page |");
    expect(github.state.created[0]).toContain("out of credits");
  });

  it("spends nothing when a command names only invalid pages", async () => {
    const github = fakeGitHub();
    const taste = fakeTaste(SCORES);
    await run(
      deps({ api: github.api, taste, trigger: { ...COMMAND, paths: [], rejected: ["pricing"] } })
        .value,
    );
    expect(taste.calls).toHaveLength(0);
    expect(github.state.checks).toHaveLength(0);
    expect(github.state.created[0]).toContain("Nothing checked");
  });

  it("ignores a draft marked ready by someone who cannot push", async () => {
    const github = fakeGitHub({ permission: "read" });
    const taste = fakeTaste(SCORES);
    const ready: Trigger = {
      kind: "ready",
      prNumber: 7,
      login: "outsider",
      association: "CONTRIBUTOR",
      userType: "User",
    };
    await run(deps({ api: github.api, taste, trigger: ready }).value);
    expect(taste.calls).toHaveLength(0);
    expect(github.state.checks).toHaveLength(0);
  });

  it("completes the check even when the comment cannot be written", async () => {
    const github = fakeGitHub();
    github.api.createComment = async () => {
      throw new Error("rate limited");
    };
    await run(deps({ api: github.api, taste: fakeTaste(SCORES) }).value);
    expect(github.state.checks[0]?.conclusion).toBe("neutral");
  });
});
