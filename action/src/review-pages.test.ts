import { describe, expect, it } from "vitest";

import { probeUrl, REDIRECTED_AWAY, UNREACHABLE } from "./review-pages.ts";

function fakeFetch(routes: Record<string, { status: number; location?: string }>) {
  return (async (input: string | URL | Request) => {
    const route = routes[String(input)];
    if (!route) throw new Error("connection refused");
    const headers = route.location ? { location: route.location } : undefined;
    return new Response(null, { status: route.status, headers });
  }) as typeof fetch;
}

describe("probeUrl", () => {
  it("returns the page's status", async () => {
    const probe = probeUrl(fakeFetch({ "https://pr.vercel.app/": { status: 200 } }));
    expect(await probe("https://pr.vercel.app/")).toBe(200);
  });

  it("follows a redirect on the same origin", async () => {
    const probe = probeUrl(
      fakeFetch({
        "https://pr.vercel.app/old": { status: 308, location: "/new" },
        "https://pr.vercel.app/new": { status: 200 },
      }),
    );
    expect(await probe("https://pr.vercel.app/old")).toBe(200);
  });

  it("treats a redirect to another origin as a login wall", async () => {
    const probe = probeUrl(
      fakeFetch({
        "https://pr.vercel.app/": { status: 302, location: "https://vercel.com/login?next=x" },
      }),
    );
    expect(await probe("https://pr.vercel.app/")).toBe(REDIRECTED_AWAY);
  });

  it("gives up on a redirect loop", async () => {
    const probe = probeUrl(
      fakeFetch({
        "https://pr.vercel.app/a": { status: 302, location: "/b" },
        "https://pr.vercel.app/b": { status: 302, location: "/a" },
      }),
    );
    expect(await probe("https://pr.vercel.app/a")).toBe(UNREACHABLE);
  });

  it("reports a page that does not answer", async () => {
    expect(await probeUrl(fakeFetch({}))("https://down.example/")).toBe(UNREACHABLE);
  });
});
