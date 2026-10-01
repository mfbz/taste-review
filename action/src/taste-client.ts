import { z } from "zod";

export type TasteErrorKind = "auth" | "credits" | "failed" | "timeout" | "http";

export type Verdict = z.infer<typeof VerdictSchema>;

export type TasteClient = {
  judge(referenceUrl: string, candidateUrl: string): Promise<Verdict>;
};

type ClientOptions = {
  apiKey: string;
  timeoutMs: number;
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
};

export const TASTE_API = "https://api.tastelabs.com";
const POLL_MS = 5_000;
const REQUEST_TIMEOUT_MS = 30_000;
const RETRYABLE = (status: number) => status === 409 || status === 429 || status >= 500;

const AcceptedSchema = z.object({ job_id: z.string().min(1) });
const JobSchema = z.object({
  status: z.enum(["accepted", "extracting", "judging", "completed", "failed"]),
});
const VerdictSchema = z.object({
  score: z.number().min(0).max(1).nullable(),
  recommendations: z.array(z.string()).max(20),
  fixes: z.array(z.record(z.string(), z.unknown())).max(20),
});

export class TasteError extends Error {
  readonly kind: TasteErrorKind;

  constructor(kind: TasteErrorKind, message: string) {
    super(message);
    this.name = "TasteError";
    this.kind = kind;
  }
}

// Never echoes a request or a response body: the key travels in a header, and a
// body could carry the candidate URL back into a public log.
function errorFor(status: number): TasteError {
  if (status === 401 || status === 403) {
    return new TasteError("auth", "The Taste Engine refused the API key.");
  }
  if (status === 402)
    return new TasteError("credits", "The Taste Engine account is out of credits.");
  if (status === 424)
    return new TasteError("failed", "The Taste Engine could not judge this page.");
  return new TasteError("http", `The Taste Engine answered ${status}.`);
}

export function createTasteClient(options: ClientOptions): TasteClient {
  const fetchFn = options.fetch ?? fetch;
  const sleep =
    options.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const now = options.now ?? Date.now;
  const headers = { "X-API-Key": options.apiKey, "Content-Type": "application/json" };

  const request = (path: string, init?: RequestInit) =>
    fetchFn(`${TASTE_API}${path}`, {
      ...init,
      headers,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

  // The job is already paid for, so a read retries what can pass (409, 5xx, a dropped
  // connection) until the deadline, and fails at once only on what cannot.
  async function poll<T>(
    path: string,
    deadline: number,
    accept: (body: unknown) => T | null,
  ): Promise<T> {
    for (;;) {
      let response: Response | null = null;
      try {
        response = await request(path);
      } catch {
        response = null;
      }
      if (response?.ok) {
        const value = accept(await response.json());
        if (value !== null) return value;
      } else if (response && !RETRYABLE(response.status)) {
        throw errorFor(response.status);
      }
      if (now() + POLL_MS > deadline) {
        throw new TasteError("timeout", "The Taste Engine did not finish in time.");
      }
      await sleep(POLL_MS);
    }
  }

  return {
    async judge(referenceUrl, candidateUrl) {
      // Never retried: a second POST would start, and pay for, a second job.
      const created = await request("/judge/brand-adherence", {
        method: "POST",
        body: JSON.stringify({ reference_url: referenceUrl, candidate_url: candidateUrl }),
      });
      if (!created.ok) throw errorFor(created.status);
      const { job_id: jobId } = AcceptedSchema.parse(await created.json());
      const job = `/judge/brand-adherence/${encodeURIComponent(jobId)}`;
      const deadline = now() + options.timeoutMs;

      await poll(job, deadline, (body) => {
        const { status } = JobSchema.parse(body);
        if (status === "failed") throw errorFor(424);
        return status === "completed" ? true : null;
      });
      return poll(`${job}/result`, deadline, (body) => VerdictSchema.parse(body));
    },
  };
}
