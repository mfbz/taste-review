import * as core from "@actions/core";
import { z } from "zod";

// A path only: the host is always the preview's or production's, never the commenter's.
export const PAGE_PATH = /^\/[A-Za-z0-9._~\-/]{0,199}$/;
export const MAX_PAGES = 5;

const InputsSchema = z.object({
  tasteApiKey: z.string().min(1, "taste-api-key is empty"),
  referenceUrl: z.url({ protocol: /^https$/, error: "reference-url must be an https URL" }),
  paths: z
    .array(z.string().regex(PAGE_PATH, "paths must be site paths like /pricing"))
    .min(1, "paths is empty"),
  margin: z.number().min(0).max(1),
  githubToken: z.string().min(1),
  timeoutMinutes: z.number().int().min(1).max(60),
  previewWaitMinutes: z.number().int().min(0).max(30),
  previewEnvironment: z.string().max(200),
});

export type Inputs = z.infer<typeof InputsSchema>;

export function splitPaths(raw: string): string[] {
  return [...new Set(raw.split(/[\s,]+/).filter(Boolean))];
}

export function parseInputs(raw: Record<string, string>): Inputs {
  return InputsSchema.parse({
    tasteApiKey: raw.tasteApiKey,
    referenceUrl: raw.referenceUrl,
    paths: splitPaths(raw.paths ?? ""),
    margin: Number(raw.margin),
    githubToken: raw.githubToken,
    timeoutMinutes: Number(raw.timeoutMinutes),
    previewWaitMinutes: Number(raw.previewWaitMinutes),
    previewEnvironment: raw.previewEnvironment ?? "",
  });
}

export function readInputs(): Inputs {
  const tasteApiKey = core.getInput("taste-api-key", { required: true });
  core.setSecret(tasteApiKey);
  return parseInputs({
    tasteApiKey,
    referenceUrl: core.getInput("reference-url", { required: true }),
    paths: core.getInput("paths") || "/",
    margin: core.getInput("margin") || "0.05",
    githubToken: core.getInput("github-token", { required: true }),
    timeoutMinutes: core.getInput("timeout-minutes") || "15",
    previewWaitMinutes: core.getInput("preview-wait-minutes") || "10",
    previewEnvironment: core.getInput("preview-environment"),
  });
}
