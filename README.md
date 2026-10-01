# taste review

Brand review on every pull request. Comment `/taste review` on a pull request and its Vercel preview is scored against your live site's brand, with the fixes your coding agent can apply.

Built on the [Taste Engine API](https://docs.tastelabs.com). An independent project, not affiliated with Taste Labs.

## How it works

1. **You ask.** When the UI feels done, someone who can push to the repository comments `/taste review` on the pull request, optionally with the pages to check (`/taste review /pricing /signup`). Nothing runs on a push.
2. **The preview is scored.** The action finds the commit's Vercel preview through GitHub's deployments, checks each page loads, and sends it to the Taste Engine's brand-adherence verifier. The same page in production is judged against the same reference, so you see the change and not only a number.
3. **One comment comes back.** A score per page, the change against production, the engine's recommendations worst first, and a collapsed block of structured fixes to paste into your coding agent. Push, ask again, and the same comment updates.

A check named **Taste review** follows the same run. It is green when every page held steady and neutral when a page dropped past the margin or something went wrong. It never fails, so it can never block a merge.

## Setup

1. **Create a Taste Engine key** in the [Engine dashboard](https://engine.tastelabs.com/app/api-keys) and add it to your repository's Actions secrets as `TASTE_API_KEY`.
2. **Make previews reachable.** The engine crawls the page, so turn off Vercel's deployment protection for previews. The action checks this first and stops without spending if the preview answers 401 or 403.
3. **Add the workflow** as `.github/workflows/taste-review.yml`:

```yaml
name: Taste review

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
  group: taste-review-${{ github.event.issue.number || github.event.pull_request.number }}
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
          taste-api-key: ${{ secrets.TASTE_API_KEY }}
          reference-url: https://www.example.com
          paths: /, /pricing
```

The `pull_request: ready_for_review` trigger runs one review when a draft is marked ready, if its author can push. Remove it to run only on request. The `concurrency` group queues a second ask behind the first rather than paying for both at once.

### Inputs

| Input                  | Default        | What it does                                                                                                                       |
| ---------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `taste-api-key`        | required       | Your Taste Engine key, passed from a secret.                                                                                       |
| `reference-url`        | required       | The live page whose brand is the standard, usually your production home page. Production pages are read from the same origin.      |
| `paths`                | `/`            | The pages to check, comma or space separated. A comment can name its own.                                                          |
| `margin`               | `0.05`         | The smallest drop against production, from 0 to 1, that the comment flags and that turns the check neutral.                        |
| `timeout-minutes`      | `15`           | How long to wait for each page's verdict.                                                                                          |
| `preview-wait-minutes` | `10`           | How long to wait for the Vercel preview to finish deploying.                                                                       |
| `preview-environment`  | empty          | The Vercel deployment environment to score, such as `Preview – web`, when one repository deploys several projects.                 |
| `github-token`         | `github.token` | The token used to comment and report the check. Keep the default: the comment is found again by its author, `github-actions[bot]`. |

## Cost

Every page checked is a brand-adherence job on your own Taste Engine account: one for the preview and one for the same page in production, except the reference page itself, which is never judged against itself, and a page production does not have yet, which is shown as new. The engine reuses a recent extraction of production, so a repeat ask mostly pays for the preview. A review checks at most 5 pages and says so in the comment when a request named more.

Nothing is spent when the preview is missing, still building, protected or behind a login redirect, when a page on it answers with an error, or when a command names no valid page. If the balance runs out partway, the pages already scored are kept and the comment says why the rest stopped.

## Security

- **Only people who can push may spend.** A command's author, or the author of a pull request marked ready, must be the repository owner or have write, maintain or admin access, looked up live. Bots are ignored. An outside contributor cannot spend your credits.
- **Commands run the workflow from your default branch.** GitHub runs `issue_comment` workflows from the default branch, so a pull request cannot change the workflow a comment triggers. The ready-for-review trigger runs the pull request's own copy, which is why it also requires an author who can push; pull requests from forks receive no secrets at all.
- **Only URLs leave the runner.** The Taste Engine receives your reference URL and the preview and production URLs of the pages checked. The key travels in a header and is masked in the log.
- **The verdict is treated as untrusted text.** It describes a page built from the pull request's own code, so the comment escapes it: no live mentions, issue references, links or HTML. The fixes sit inside a code fence they cannot close, and long verdicts are cut to fit GitHub's comment limit, with a note saying so.
- **Pages are paths, never hosts.** A page named in a comment must be a path like `/pricing`; anything else is skipped and the comment says so.

## Development

npm workspaces, Node 24:

- `action/`: the GitHub Action. `action.yml` sits at the root because GitHub requires it there; it runs `action/dist/index.js`, the committed bundle.
- `site/`: the landing page, a static Next.js export with shadcn/ui and Tailwind 4. Its design system is in [`site/DESIGN.md`](site/DESIGN.md).
- `scripts/extract-brand.ts`: a one-off that extracts a site's design system with the Taste Engine into `.cache/`, which is gitignored. It spends credits and reads `TASTE_API_KEY` from `.env` (see `.env.example`).

```bash
npm install
npm run dev                  # the site on localhost:3000
npm run build -w action      # rebuild action/dist/ and commit the result
npm run typecheck
npm run lint
npm run test
npm run format:check
```

CI runs the four checks, builds the site, and rebuilds the action to confirm the committed bundle matches the source.

## License

[MIT](LICENSE)
