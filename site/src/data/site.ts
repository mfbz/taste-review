export const REPO_URL = "https://github.com/mfbz/taste-review";
export const TASTE_DOCS_URL = "https://docs.tastelabs.com";
export const TASTE_KEYS_URL = "https://engine.tastelabs.com/app/api-keys";

export const SITE = {
  name: "taste review",
  title: "taste review · Brand review on every pull request",
  description:
    "Comment /taste review on a pull request and its Vercel preview is scored against your live site's brand, with the fixes your coding agent can apply.",
};

export const STEPS = [
  {
    title: "Ask on the pull request",
    body: "When the UI feels done, anyone who can push comments /taste review, optionally with the pages to check. Nothing runs on a push, so a busy pull request costs nothing until someone asks.",
  },
  {
    title: "The preview is scored",
    body: "The action finds the commit's Vercel preview and sends each page to the Taste Engine beside the same page in production, both judged against your live site's brand.",
  },
  {
    title: "One comment, fixes included",
    body: "The score, the change against production and the worst problems first, plus the fixes as structured data your coding agent applies in one pass. Push, ask again, and the same comment updates.",
  },
] as const;

export const AUDIENCES = [
  {
    title: "For the reviewer",
    body: "A score per page and the change against production, so a drift shows up as a number on the pull request instead of a feeling in a screenshot.",
  },
  {
    title: "For the coding agent",
    body: "Every fix carries an action and its exact target value, so the agent that wrote the page can correct it without guessing what on brand means.",
  },
] as const;

export const SETUP = [
  {
    title: "Get a Taste Engine key",
    body: "Create one in the Engine dashboard and add it to the repository's Actions secrets as TASTE_API_KEY.",
  },
  {
    title: "Add the workflow",
    body: "Copy the file below to .github/workflows/taste-review.yml and set your production URL and the pages to watch.",
  },
  {
    title: "Ask on a pull request",
    body: "Once Vercel posts the preview, comment /taste review. The check and the comment arrive in a few minutes.",
  },
] as const;

export const WORKFLOW_YAML = `name: Taste review

on:
  issue_comment:
    types: [created]
  pull_request:
    types: [ready_for_review]

permissions:
  checks: write
  contents: read
  deployments: read
  issues: write
  pull-requests: write

concurrency:
  group: taste-review-\${{ github.event.issue.number || github.event.pull_request.number }}
  cancel-in-progress: false

jobs:
  review:
    if: >-
      github.event_name == 'pull_request' ||
      (github.event.issue.pull_request &&
       startsWith(github.event.comment.body, '/taste review'))
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: mfbz/taste-review@v1
        with:
          taste-api-key: \${{ secrets.TASTE_API_KEY }}
          reference-url: https://www.example.com
          paths: /, /pricing`;

export const FAQ = [
  {
    question: "What does a check cost?",
    answer:
      "Each page checked is one brand-adherence job on your own Taste Engine account. The production side is reused from the engine's cache while production has not changed, so a repeat ask mostly pays for the preview.",
  },
  {
    question: "Who can start a review?",
    answer:
      "Only people who can push to the repository, and the ready-for-review trigger only runs for an author who can push. Anyone else, and every bot, is ignored, so an outside contributor cannot spend your credits.",
  },
  {
    question: "Can it block a merge?",
    answer:
      "No. The check is green, or neutral when a page dropped past the margin or something went wrong, and it never fails. A brand score is advice for the reviewer, not a gate.",
  },
  {
    question: "Does my preview need to be public?",
    answer:
      "Yes. The engine crawls the page, so Vercel's deployment protection must be off for previews. The action checks every page loads, and that it is not sent to a login page, before it spends anything.",
  },
  {
    question: "Does it run on every push?",
    answer:
      "No. It runs when someone comments /taste review, and once when a draft is marked ready for review if you keep that trigger. The comment shows which commit it checked.",
  },
] as const;
