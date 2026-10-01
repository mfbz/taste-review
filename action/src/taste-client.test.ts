import { describe, expect, it } from "vitest";

import { createTasteClient, TasteError } from "./taste-client.ts";

type Route = { status: number; body?: unknown };

const VERDICT = {
  job_id: "job-1",
  status: "completed",
  score: 0.71,
  recommendations: ["Snap the heading from 44px to 48px."],
  fixes: [{ action: "snap_to_token", property: "font_size", from: "44px", to_value: "48px" }],
};

function fakeFetch(routes: Record<string, Route[]>) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fn = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    const key = `${init?.method ?? "GET"} ${new URL(url).pathname}`;
    const queue = routes[key];
    const route = queue && queue.length > 1 ? queue.shift() : queue?.[0];
    if (!route) throw new Error(`unexpected ${key}`);
    return new Response(JSON.stringify(route.body ?? {}), { status: route.status });
  }) as typeof fetch;
  return { fn, calls };
}

function client(routes: Record<string, Route[]>, timeoutMs = 60_000) {
  const fake = fakeFetch(routes);
  let time = 0;
  const taste = createTasteClient({
    apiKey: "key-123",
    timeoutMs,
    fetch: fake.fn,
    now: () => time,
    sleep: async (ms) => void (time += ms),
  });
  return { taste, calls: fake.calls };
}

const created = { "POST /judge/brand-adherence": [{ status: 202, body: { job_id: "job-1" } }] };

describe("createTasteClient", () => {
  it("creates the job, polls it and returns the verdict", async () => {
    const { taste, calls } = client({
      ...created,
      "GET /judge/brand-adherence/job-1": [
        { status: 200, body: { status: "extracting" } },
        { status: 200, body: { status: "completed" } },
      ],
      "GET /judge/brand-adherence/job-1/result": [{ status: 200, body: VERDICT }],
    });
    const verdict = await taste.judge("https://www.example.com", "https://pr.vercel.app/pricing");
    expect(verdict.score).toBe(0.71);
    expect(verdict.fixes).toHaveLength(1);
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({
      reference_url: "https://www.example.com",
      candidate_url: "https://pr.vercel.app/pricing",
    });
    expect(new Headers(calls[0]?.init?.headers).get("X-API-Key")).toBe("key-123");
  });

  it.each([
    [401, "auth"],
    [402, "credits"],
    [500, "http"],
  ])("classifies a %i on create as %s", async (status, kind) => {
    const { taste } = client({ "POST /judge/brand-adherence": [{ status }] });
    await expect(taste.judge("https://a.example", "https://b.example")).rejects.toMatchObject({
      kind,
    });
  });

  it("reports a failed job", async () => {
    const { taste } = client({
      ...created,
      "GET /judge/brand-adherence/job-1": [{ status: 200, body: { status: "failed" } }],
    });
    await expect(taste.judge("https://a.example", "https://b.example")).rejects.toMatchObject({
      kind: "failed",
    });
  });

  it("stops polling at the timeout", async () => {
    const { taste } = client(
      {
        ...created,
        "GET /judge/brand-adherence/job-1": [{ status: 200, body: { status: "judging" } }],
      },
      20_000,
    );
    await expect(taste.judge("https://a.example", "https://b.example")).rejects.toMatchObject({
      kind: "timeout",
    });
  });

  it("rides out a 409 and a 503 on reads of a job already paid for", async () => {
    const { taste, calls } = client({
      ...created,
      "GET /judge/brand-adherence/job-1": [
        { status: 503 },
        { status: 200, body: { status: "completed" } },
      ],
      "GET /judge/brand-adherence/job-1/result": [{ status: 409 }, { status: 200, body: VERDICT }],
    });
    const verdict = await taste.judge("https://a.example", "https://b.example");
    expect(verdict.score).toBe(0.71);
    expect(calls.filter((call) => call.init?.method === "POST")).toHaveLength(1);
  });

  it("never retries the job creation", async () => {
    const { taste, calls } = client({ "POST /judge/brand-adherence": [{ status: 503 }] });
    await expect(taste.judge("https://a.example", "https://b.example")).rejects.toMatchObject({
      kind: "http",
    });
    expect(calls).toHaveLength(1);
  });

  it("refuses a verdict outside the documented shape", async () => {
    const { taste } = client({
      ...created,
      "GET /judge/brand-adherence/job-1": [{ status: 200, body: { status: "completed" } }],
      "GET /judge/brand-adherence/job-1/result": [{ status: 200, body: { ...VERDICT, score: 7 } }],
    });
    await expect(taste.judge("https://a.example", "https://b.example")).rejects.not.toBeInstanceOf(
      TasteError,
    );
  });

  it("never puts the key in an error", async () => {
    const { taste } = client({ "POST /judge/brand-adherence": [{ status: 401 }] });
    const error = await taste.judge("https://a.example", "https://b.example").catch((e) => e);
    expect(String(error.message)).not.toContain("key-123");
  });
});
