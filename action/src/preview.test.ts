import { describe, expect, it } from "vitest";

import type { Deployment, DeploymentStatus } from "./github-api.ts";
import { findPreview, waitForPreview } from "./preview.ts";

function api(deployments: Deployment[], statuses: Record<number, DeploymentStatus[]>) {
  return {
    async listDeployments() {
      return deployments;
    },
    async listDeploymentStatuses(id: number) {
      return statuses[id] ?? [];
    },
  };
}

const success = (url: string) => ({ state: "success", environmentUrl: url });

describe("findPreview", () => {
  it("returns the newest successful preview", async () => {
    const lookup = await findPreview(
      api(
        [
          { id: 2, environment: "Preview" },
          { id: 1, environment: "Preview" },
        ],
        {
          2: [success("https://new.vercel.app")],
          1: [success("https://old.vercel.app")],
        },
      ),
      "abc",
    );
    expect(lookup).toEqual({ kind: "ready", url: "https://new.vercel.app" });
  });

  it("never picks a production deployment", async () => {
    const lookup = await findPreview(
      api([{ id: 1, environment: "Production" }], { 1: [success("https://www.example.com")] }),
      "abc",
    );
    expect(lookup).toEqual({ kind: "none" });
  });

  it("reports a preview still building", async () => {
    const lookup = await findPreview(
      api([{ id: 1, environment: "Preview" }], {
        1: [{ state: "in_progress", environmentUrl: "" }],
      }),
      "abc",
    );
    expect(lookup).toEqual({ kind: "pending" });
  });

  it("skips a failed deployment for an older successful one", async () => {
    const lookup = await findPreview(
      api(
        [
          { id: 2, environment: "Preview" },
          { id: 1, environment: "Preview" },
        ],
        {
          2: [{ state: "failure", environmentUrl: "" }],
          1: [success("https://ok.vercel.app")],
        },
      ),
      "abc",
    );
    expect(lookup).toEqual({ kind: "ready", url: "https://ok.vercel.app" });
  });

  it("scores only the named environment when one is set", async () => {
    const lookup = await findPreview(
      api(
        [
          { id: 2, environment: "Preview – docs" },
          { id: 1, environment: "Preview – web" },
        ],
        { 2: [success("https://docs.vercel.app")], 1: [success("https://web.vercel.app")] },
      ),
      "abc",
      "preview – web",
    );
    expect(lookup).toEqual({ kind: "ready", url: "https://web.vercel.app" });
  });

  it("refuses a preview URL that is not https", async () => {
    const lookup = await findPreview(
      api([{ id: 1, environment: "Preview" }], { 1: [success("http://plain.example")] }),
      "abc",
    );
    expect(lookup).toEqual({ kind: "none" });
  });
});

describe("waitForPreview", () => {
  it("polls until the preview is ready", async () => {
    let calls = 0;
    let time = 0;
    const lookup = await waitForPreview(
      {
        async listDeployments() {
          calls++;
          return calls < 3 ? [] : [{ id: 1, environment: "Preview" }];
        },
        async listDeploymentStatuses() {
          return [success("https://ready.vercel.app")];
        },
      },
      "abc",
      10 * 60_000,
      { now: () => time, sleep: async (ms) => void (time += ms) },
    );
    expect(lookup).toEqual({ kind: "ready", url: "https://ready.vercel.app" });
    expect(calls).toBe(3);
  });

  it("gives up at the deadline", async () => {
    let time = 0;
    const lookup = await waitForPreview(api([], {}), "abc", 60_000, {
      now: () => time,
      sleep: async (ms) => void (time += ms),
    });
    expect(lookup).toEqual({ kind: "none" });
    expect(time).toBeLessThanOrEqual(60_000);
  });
});
