import { describe, expect, it } from "vitest";

import { parseCommand, readTrigger } from "./trigger.ts";

function commentEvent(body: string, overrides: Record<string, unknown> = {}) {
  return {
    action: "created",
    issue: { number: 7, pull_request: { url: "https://api.github.com/x" } },
    comment: {
      id: 99,
      body,
      author_association: "MEMBER",
      user: { login: "dev", type: "User" },
    },
    ...overrides,
  };
}

describe("parseCommand", () => {
  it("reads the bare command", () => {
    expect(parseCommand("/taste review")).toEqual({ paths: [], rejected: [] });
  });

  it("reads pages after the command, deduplicated", () => {
    expect(parseCommand("/taste review /pricing, /signup /pricing")).toEqual({
      paths: ["/pricing", "/signup"],
      rejected: [],
    });
  });

  it("rejects anything that is not a site path", () => {
    expect(parseCommand("/taste review https://evil.example /ok ../x")).toEqual({
      paths: ["/ok"],
      rejected: ["https://evil.example", "../x"],
    });
  });

  it("only reads the first line", () => {
    expect(parseCommand("/taste review /a\n/taste review /b")).toEqual({
      paths: ["/a"],
      rejected: [],
    });
  });

  it("ignores other comments and look-alikes", () => {
    expect(parseCommand("please /taste review")).toBeNull();
    expect(parseCommand("/taste reviewer")).toBeNull();
    expect(parseCommand("")).toBeNull();
  });
});

describe("readTrigger", () => {
  it("reads a command on a pull request", () => {
    expect(readTrigger("issue_comment", commentEvent("/taste review /pricing"))).toEqual({
      kind: "command",
      prNumber: 7,
      commentId: 99,
      login: "dev",
      association: "MEMBER",
      userType: "User",
      paths: ["/pricing"],
      rejected: [],
    });
  });

  it("ignores a command on an issue", () => {
    const event = commentEvent("/taste review", { issue: { number: 7 } });
    expect(readTrigger("issue_comment", event)).toBeNull();
  });

  it("ignores an edited comment", () => {
    expect(
      readTrigger("issue_comment", commentEvent("/taste review", { action: "edited" })),
    ).toBeNull();
  });

  it("reads a pull request marked ready for review", () => {
    const event = {
      action: "ready_for_review",
      pull_request: {
        number: 3,
        author_association: "MEMBER",
        user: { login: "dev", type: "User" },
      },
    };
    expect(readTrigger("pull_request", event)).toEqual({
      kind: "ready",
      prNumber: 3,
      login: "dev",
      association: "MEMBER",
      userType: "User",
    });
  });

  it("ignores every other event", () => {
    expect(
      readTrigger("pull_request", { action: "synchronize", pull_request: { number: 3 } }),
    ).toBeNull();
    expect(readTrigger("push", {})).toBeNull();
  });
});
