import type { GitHubApi } from "./github-api.ts";

const CAN_PUSH = new Set(["admin", "maintain", "write"]);

// A review spends the team's credits, so only someone who can push may ask. MEMBER and
// COLLABORATOR can both be read-only, so only OWNER skips the live permission lookup.
export async function canPush(
  api: Pick<GitHubApi, "getPermission">,
  login: string,
  association: string,
  userType: string,
): Promise<boolean> {
  if (userType === "Bot" || !login) return false;
  if (association === "OWNER") return true;
  try {
    return CAN_PUSH.has(await api.getPermission(login));
  } catch {
    return false;
  }
}
