import { PAGE_PATH } from "./inputs.ts";

export type CommandTrigger = {
  kind: "command";
  prNumber: number;
  commentId: number;
  login: string;
  association: string;
  userType: string;
  paths: string[];
  rejected: string[];
};

// The person a review would spend for: the commenter, or the author of a pull request marked ready.
export type ReadyTrigger = {
  kind: "ready";
  prNumber: number;
  login: string;
  association: string;
  userType: string;
};

export type Trigger = CommandTrigger | ReadyTrigger;

type Payload = Record<string, unknown>;

const COMMAND = "/taste review";

function record(value: unknown): Payload {
  return value !== null && typeof value === "object" ? (value as Payload) : {};
}

// The command is the first line of the comment; anything after it on that line is a page list.
export function parseCommand(body: string): { paths: string[]; rejected: string[] } | null {
  const firstLine = body.trimStart().split(/\r?\n/, 1)[0]?.trim() ?? "";
  if (firstLine !== COMMAND && !firstLine.startsWith(`${COMMAND} `)) return null;
  const tokens = [
    ...new Set(
      firstLine
        .slice(COMMAND.length)
        .split(/[\s,]+/)
        .filter(Boolean),
    ),
  ];
  return {
    paths: tokens.filter((token) => PAGE_PATH.test(token)),
    rejected: tokens.filter((token) => !PAGE_PATH.test(token)),
  };
}

export function readTrigger(eventName: string, payload: Payload): Trigger | null {
  if (eventName === "pull_request") {
    const pr = record(payload.pull_request);
    const user = record(pr.user);
    if (payload.action !== "ready_for_review" || typeof pr.number !== "number") return null;
    return {
      kind: "ready",
      prNumber: pr.number,
      login: typeof user.login === "string" ? user.login : "",
      association: typeof pr.author_association === "string" ? pr.author_association : "",
      userType: typeof user.type === "string" ? user.type : "",
    };
  }

  if (eventName === "issue_comment") {
    const issue = record(payload.issue);
    const comment = record(payload.comment);
    const user = record(comment.user);
    if (payload.action !== "created" || !issue.pull_request) return null;
    if (typeof issue.number !== "number" || typeof comment.id !== "number") return null;
    const command = parseCommand(typeof comment.body === "string" ? comment.body : "");
    if (!command) return null;
    return {
      kind: "command",
      prNumber: issue.number,
      commentId: comment.id,
      login: typeof user.login === "string" ? user.login : "",
      association: typeof comment.author_association === "string" ? comment.author_association : "",
      userType: typeof user.type === "string" ? user.type : "",
      ...command,
    };
  }

  return null;
}
