// One-off: extract a site's design system with the Taste Engine and keep the raw
// result in .cache/ (gitignored). Spends credits, so it refuses to run twice for
// the same URL unless --force is passed.
//
//   node scripts/extract-brand.ts https://tastelabs.com [--force]

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BASE = "https://api.tastelabs.com";
const POLL_MS = 5_000;
const TIMEOUT_MS = 15 * 60_000;

function cachePath(url: string): string {
  const name = new URL(url).hostname.replace(/[^a-z0-9.-]/gi, "_");
  return join(import.meta.dirname, "..", ".cache", "extractions", name);
}

async function call(path: string, key: string, init?: RequestInit): Promise<Response> {
  return fetch(`${BASE}${path}`, {
    ...init,
    headers: { "X-API-Key": key, "Content-Type": "application/json", ...init?.headers },
  });
}

async function main(): Promise<void> {
  const url = process.argv[2];
  if (!url) throw new Error("usage: node scripts/extract-brand.ts <url> [--force]");
  const dir = cachePath(url);
  if (existsSync(join(dir, "result.json")) && !process.argv.includes("--force")) {
    console.log(`Already extracted: ${dir}/result.json (pass --force to spend credits again)`);
    return;
  }

  process.loadEnvFile(join(import.meta.dirname, "..", ".env"));
  const key = process.env.TASTE_API_KEY;
  if (!key) throw new Error("TASTE_API_KEY is missing from .env");

  const created = await call("/design/submissions", key, {
    method: "POST",
    body: JSON.stringify({ url }),
  });
  if (created.status !== 202) throw new Error(`create: ${created.status} ${await created.text()}`);
  const { submission_id: id, cache_hit } = (await created.json()) as {
    submission_id: string;
    cache_hit: boolean;
  };
  console.log(`Submission ${id} accepted (cache_hit: ${cache_hit})`);

  const started = Date.now();
  let result: { status: string } & Record<string, unknown>;
  let lastStep = "";
  for (;;) {
    if (Date.now() - started > TIMEOUT_MS) throw new Error("timed out after 15 minutes");
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    const res = await call(`/design/submissions/${id}/result`, key);
    if (res.status === 409) continue;
    if (!res.ok) throw new Error(`poll: ${res.status} ${await res.text()}`);
    result = (await res.json()) as typeof result;
    const step = `${result.status}/${String(result.current_step ?? "")}`;
    if (step !== lastStep) console.log(`  ${Math.round((Date.now() - started) / 1000)}s ${step}`);
    lastStep = step;
    if (result.status === "completed" || result.status === "failed") break;
  }
  if (result.status === "failed")
    throw new Error(`extraction failed: ${JSON.stringify(result.error ?? null)}`);

  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "result.json"), JSON.stringify(result, null, 2));

  const bundle = await call(`/design/submissions/${id}/download`, key);
  if (bundle.ok)
    writeFileSync(join(dir, "bundle.json"), JSON.stringify(await bundle.json(), null, 2));

  const listed = await call(
    `/design/submissions?q=${encodeURIComponent(new URL(url).hostname)}`,
    key,
  );
  if (listed.ok) {
    const { items = [] } = (await listed.json()) as {
      items?: { submission_id?: string; id?: string; credits_consumed?: number }[];
    };
    const row = items.find((item) => (item.submission_id ?? item.id) === id);
    console.log(`Credits consumed: ${row?.credits_consumed ?? "unknown (check the dashboard)"}`);
  }
  console.log(`Saved ${dir}/result.json in ${Math.round((Date.now() - started) / 1000)}s`);
}

await main();
