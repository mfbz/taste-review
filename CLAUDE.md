# CLAUDE.md · taste-review

Brand review on every pull request: a GitHub Action that, when someone comments `/taste review`, scores the pull request's Vercel preview against the live site's brand with the [Taste Engine API](https://docs.tastelabs.com) and posts the score, the recommendations and the fixes a coding agent can apply. The repository also holds the product's landing page.

An independent project built on the Taste Engine API, not affiliated with Taste Labs. Say so where it matters (README, site footer) and never imply otherwise.

## Layout

npm workspaces, two parts:

- `action/`: the GitHub Action. `action.yml` sits at the repository root because GitHub requires it there; its entry point is the committed bundle in `action/dist/`, rebuilt by `npm run build -w action` and checked in CI against the source.
- `site/`: the landing page. Next.js App Router, static export, shadcn/ui on Tailwind 4, Phosphor icons. Its design system is in `site/DESIGN.md`.
- `video/`: the demo video, not a workspace: its own install, `timeline.js` (the captions and the slow-downs, shared by everything else), `index.html` (every frame a pure function of scene time), `render.ts` (headless Chrome into ffmpeg, walking video time) and `score.ts` (the synthesized 120 BPM score, its bar grid aligned to the drop through the same timeline); `npm run video` builds all three into `out/taste-review-final.mp4`. Output goes to `video/out/`, gitignored.
- `scripts/`: one-off tools run by hand (`extract-brand.ts`). Typechecked, never run in CI or a build.

Nothing crosses between `action/` and `site/`. If both need a fact, it is written once in each and kept in step.

## Product rules

- **Credits are the customer's money.** Every call to the Taste Engine spends the team's credits, so nothing calls it without a person asking (`/taste review`) or the one opt-in automatic run (a pull request marked ready for review). Never add a trigger on push.
- **Only people who can push may spend.** A command from anyone else, or from a bot, is ignored.
- **Never red.** The check is green or neutral, never failing: a brand score is advice, not a merge gate. A failure of ours (API down, no preview, out of credits) is a neutral check with the next step written on it.
- **Verdict text is untrusted.** Recommendations describe a page built from the pull request's own code, so everything posted is escaped: no live @mentions, issue references, links or HTML.
- **One new comment per review**, so the pull request reads as a history. Each carries its preview scores in a hidden line; the next review reads back the newest one, only from a comment `github-actions[bot]` wrote, validates it, and shows the change since then.
- **The site never calls the API at runtime.** It is a static export; anything it shows from the API was recorded once and committed.

## Code conventions

- **Always use the latest** stable version of every package; verify against current docs, not memory.
- TypeScript strict everywhere, `src/`-rooted, `@/*` → `./src/*` in the site.
- **kebab-case file and folder names**, no exceptions. Components are PascalCase with **named exports**; no default exports outside framework file conventions (`page.tsx`, `layout.tsx`, config files).
- **No `index.ts` files and no barrel (`export *`) re-exports.** Import every module from its own file.
- **Feature-based layout:** `lib/` holds only generic utilities; helpers used by one feature sit beside it.
- **Module layout**, top to bottom: imports → types → constants → private helpers → exported functions last. For `.tsx`: imports → prop types → constants → local subcomponents → the exported component last.
- **Comments explain why, never what.** Short, two or three lines at most. No decorative separators, no JSX section comments.
- **Zod at the boundary.** Validate the Taste Engine's responses and the action's inputs once, then trust the typed values.
- **A third-party client that reports failure in its return value is not caught by `try`.** Check the returned status.
- Everything that can be big is bounded: polling has a timeout, lists have a cap, and every cap says so where it binds.

## UI conventions (site)

- Colours, radii, type sizes and spacing come from the theme tokens in `site/src/app/globals.css`, which follow `site/DESIGN.md`. Never a raw hex, rgb or oklch value in a component, and never an arbitrary `[…]` value where a token covers it.
- A new token lands in `DESIGN.md` and `globals.css` in the same change.
- Every action is the shadcn `Button` (with `asChild` for a link); customise a component through its variants in its own file, never by overriding classes at the call site.
- Icons are Phosphor (`@phosphor-icons/react`, `/ssr` in server components), never lucide.
- Accessibility and responsive are invariants: one `<main>` and one `<h1>` per page, no horizontal scroll from 320px up, visible hover, active and focus states on every control, targets at least 24px.
- Copy is sentence case, second person, short sentences; no exclamation marks and no em dashes.

## Repository hygiene

This repository is public.

- **Never commit local user data**: no absolute paths from a machine, no personal emails, no real environment values. Examples use placeholders.
- **Secrets live in `.env`** at the root (gitignored, see `.env.example`) and in the repository's Actions secrets. Never print, log or commit a key; a script reads it and prints only results.
- Raw API responses go in `.cache/` (gitignored): they carry another site's captured HTML and assets.

## Git workflow

- Work happens on a branch per change (`feat/…`, `fix/…`, `chore/…`, `docs/…`), merged into `develop` once its checks pass. `develop` reaches `main` through a pull request merged with a merge commit, never squashed, so the two histories stay one.
- **Releases are automated by `.github/workflows/release.yml`**: a push to `main` whose `action/package.json` carries a version with no release yet gets the tag `vX.Y.Z`, a GitHub Release with generated notes, and the moving major tag (`v1`) on the same commit. Bumping that version on `develop`, following semver for the action's inputs and behaviour, is the only input; nothing is tagged by hand. Users write `@v1` for fixes without edits, or `@vX.Y.Z` to pin.
- Commit messages are plain, imperative and say why. **No tool or agent attribution of any kind** (no "Co-Authored-By" lines for an agent, no "generated with" footers).

## Commands

```bash
npm install
npm run dev -w site             # the landing page on localhost:3000
npm run build -w site           # static export in site/out/
npm run build -w action         # rebuild action/dist/ (commit the result)
npm run typecheck
npm run lint
npm run test
npm run format:check
node scripts/extract-brand.ts <url>   # spends Taste Engine credits
```

A green checkpoint is `typecheck`, `lint`, `test` and `format:check`, the same four CI runs.

## Docs are part of the change

`README.md`, `site/DESIGN.md` and this file describe what exists. A change that makes one of them wrong updates it in the same change.
