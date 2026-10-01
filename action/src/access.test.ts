import { describe, expect, it } from "vitest";

import { canPush } from "./access.ts";

function api(permission: string | Error) {
  return {
    async getPermission() {
      if (permission instanceof Error) throw permission;
      return permission;
    },
  };
}

describe("canPush", () => {
  it("lets the owner through without a lookup", async () => {
    expect(await canPush(api(new Error("not called")), "owner", "OWNER", "User")).toBe(true);
  });

  it.each(["admin", "maintain", "write"])("lets %s through", async (permission) => {
    expect(await canPush(api(permission), "dev", "MEMBER", "User")).toBe(true);
  });

  it("refuses a read-only member", async () => {
    expect(await canPush(api("read"), "dev", "MEMBER", "User")).toBe(false);
  });

  it("refuses a read-only collaborator", async () => {
    expect(await canPush(api("triage"), "dev", "COLLABORATOR", "User")).toBe(false);
  });

  it("refuses a bot even with write access", async () => {
    expect(await canPush(api("write"), "helper[bot]", "OWNER", "Bot")).toBe(false);
  });

  it("refuses when the lookup fails", async () => {
    expect(await canPush(api(new Error("404")), "dev", "CONTRIBUTOR", "User")).toBe(false);
  });
});
