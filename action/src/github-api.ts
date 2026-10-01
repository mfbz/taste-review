import { getOctokit } from "@actions/github";

export type PullRequest = { number: number; headSha: string; open: boolean };
export type Deployment = { id: number; environment: string };
export type DeploymentStatus = { state: string; environmentUrl: string };
export type IssueComment = { id: number; body: string; login: string; userType: string };
export type CheckConclusion = "success" | "neutral";
export type CheckOutput = { title: string; summary: string };

// The few GitHub calls the action makes, so everything above this file runs on fakes in tests.
export type GitHubApi = {
  getPullRequest(number: number): Promise<PullRequest>;
  getPermission(login: string): Promise<string>;
  addEyes(commentId: number): Promise<void>;
  listDeployments(sha: string): Promise<Deployment[]>;
  listDeploymentStatuses(deploymentId: number): Promise<DeploymentStatus[]>;
  listComments(prNumber: number): Promise<IssueComment[]>;
  createComment(prNumber: number, body: string): Promise<void>;
  startCheck(sha: string, output: CheckOutput): Promise<number>;
  finishCheck(checkId: number, conclusion: CheckConclusion, output: CheckOutput): Promise<void>;
};

export const CHECK_NAME = "Taste review";
// Bounds the comment scan on a very long pull request: 10 pages of 100.
const MAX_COMMENT_PAGES = 10;

export function createGitHubApi(token: string, owner: string, repo: string): GitHubApi {
  const octokit = getOctokit(token);
  const rest = octokit.rest;
  const base = { owner, repo };

  return {
    async getPullRequest(number) {
      const { data } = await rest.pulls.get({ ...base, pull_number: number });
      return { number: data.number, headSha: data.head.sha, open: data.state === "open" };
    },

    async getPermission(login) {
      const { data } = await rest.repos.getCollaboratorPermissionLevel({
        ...base,
        username: login,
      });
      return data.permission;
    },

    async addEyes(commentId) {
      await rest.reactions.createForIssueComment({
        ...base,
        comment_id: commentId,
        content: "eyes",
      });
    },

    async listDeployments(sha) {
      const { data } = await rest.repos.listDeployments({ ...base, sha, per_page: 20 });
      return data.map((deployment) => ({ id: deployment.id, environment: deployment.environment }));
    },

    async listDeploymentStatuses(deploymentId) {
      const { data } = await rest.repos.listDeploymentStatuses({
        ...base,
        deployment_id: deploymentId,
        per_page: 10,
      });
      return data.map((status) => ({
        state: status.state,
        environmentUrl: status.environment_url ?? "",
      }));
    },

    async listComments(prNumber) {
      const comments: IssueComment[] = [];
      for (let page = 1; page <= MAX_COMMENT_PAGES; page++) {
        const { data } = await rest.issues.listComments({
          ...base,
          issue_number: prNumber,
          per_page: 100,
          page,
        });
        for (const comment of data) {
          comments.push({
            id: comment.id,
            body: comment.body ?? "",
            login: comment.user?.login ?? "",
            userType: comment.user?.type ?? "",
          });
        }
        if (data.length < 100) break;
      }
      return comments;
    },

    async createComment(prNumber, body) {
      await rest.issues.createComment({ ...base, issue_number: prNumber, body });
    },

    async startCheck(sha, output) {
      const { data } = await rest.checks.create({
        ...base,
        name: CHECK_NAME,
        head_sha: sha,
        status: "in_progress",
        output,
      });
      return data.id;
    },

    async finishCheck(checkId, conclusion, output) {
      await rest.checks.update({
        ...base,
        check_run_id: checkId,
        status: "completed",
        conclusion,
        output,
      });
    },
  };
}
