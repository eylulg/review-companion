# Review Companion

Paste a public GitHub pull request URL. Review Companion fetches the diff, streams a structured code review from Claude file by file, and lets you triage each finding (accept, dismiss or edit). When you are done, it gives you the accepted findings as GitHub Markdown, grouped by file, with `suggestion` blocks wherever the fix is certain, ready to paste as review comments.

It is built for the reviewer, not as a bot: nothing is posted to GitHub, and every finding passes through a human before it goes anywhere.

## How a review is produced

```
 browser                          POST /api/review (server-sent events)
 ───────                          ──────────────────────────────────────
 URL + model  ───────────────▶    validate body, origin and rate limit (per IP)
                                         │
                                         ▼
                                  GitHub REST: PR metadata + unified diff
                                  (GITHUB_TOKEN optional)
                                         │      stage: "Fetching owner/repo#123"
                                         ▼
                                  parse diff ▶ files ▶ hunks, number every line
                                  skip lockfiles, generated, deleted, binary
                                  cap at MAX_CHANGED_LINES ──▶ over the cap? ask
                                         │                     the user to pick files
                                         ▼
                                  chunk: one file per request, large files split
                                  into batches of whole hunks
                                  cost guard: estimated input tokens ≤ MAX_INPUT_TOKENS
                                         │      stage: "Reviewing file N of M"
                                         ▼
                                  Claude, two chunks at a time
                                  structured output (JSON schema) per chunk
                                         │
                                         ▼
                                  validate each finding with zod and against the
                                  diff: the file must match, the line must exist
  findings appear  ◀───────────   finding events, usage, done
  triage, edit, export
```

Each finding has the shape `{ file, line, endLine?, severity: blocker | bug | risk | nit, category, title, explanation, suggestion?, confidence }`. `endLine` is an addition so a suggestion can replace a range of lines.

The system prompt asks for the review a careful senior engineer would give: correctness first, then missing tests, accessibility for UI code, duplication and misleading names. No style nits. Every finding must cite a line from the diff, and a suggestion is only given when the replacement is certain. Findings that cite a line outside the diff are dropped and counted in a warning.

Model calls use `@anthropic-ai/sdk` on the server only, with structured outputs (`output_config.format`), adaptive thinking (the default), effort `high`, and server-side fallback (`fallbacks: "default"`), so a policy refusal on one model is retried on the recommended fallback model instead of failing the file.

## What is sent to the model

For each chunk: the pull request title, branch names, the description (first 4,000 characters) and the changed hunks of one file with line numbers. Nothing else from the repository, and nothing about the person using the app. The diff and description are treated as data in the prompt, not as instructions.

## Limits

| Limit                             | Default                                                       | Setting                                                                                                                                                                                                                          |
| --------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Changed lines per review          | 1,500                                                         | `MAX_CHANGED_LINES`. Over the cap the app asks which files to review.                                                                                                                                                            |
| Estimated input tokens per review | 120,000                                                       | `MAX_INPUT_TOKENS`. The review stops before any model call when the estimate is higher.                                                                                                                                          |
| Output tokens per review          | 40,000                                                        | `MAX_OUTPUT_TOKENS`. No new file is started once the model has produced this much, and the review says so in a warning. Files already running can finish (up to 32,000 tokens each), so the hard ceiling is this plus two files. |
| Reviews per IP                    | 5 per 10 minutes                                              | `RATE_LIMIT_REVIEWS`, `RATE_LIMIT_WINDOW_SECONDS`. Counted after a successful model call. In memory, so per server instance.                                                                                                     |
| Concurrency                       | 2 chunks at a time                                            | Fixed.                                                                                                                                                                                                                           |
| Diff size from GitHub             | 3 MB, and GitHub refuses diffs over 300 files or 20,000 lines |                                                                                                                                                                                                                                  |
| GitHub API                        | 60 requests per hour without a token                          | `GITHUB_TOKEN` raises it to 5,000 and allows private repositories the token can read.                                                                                                                                            |

Errors are explained in the UI: pull request not found, private repository without a token, GitHub rate limit (with the reset time), diff too large, over the cost limit, and too many reviews from one address.

## Environment variables

Copy `.env.example` to `.env.local`.

| Variable                                                                                                        | Required | Purpose                                                                              |
| --------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------ |
| `ANTHROPIC_API_KEY`                                                                                             | No       | Server side only. Without it the app runs in demo mode.                              |
| `GITHUB_TOKEN`                                                                                                  | No       | Fine-grained token with read access to pull requests and contents.                   |
| `REVIEW_MODEL`                                                                                                  | No       | `claude-sonnet-5-5` (default) or `claude-opus-5-5`. Users can pick either in the UI. |
| `REVIEW_EFFORT`                                                                                                 | No       | `low`, `medium`, `high` (default), `xhigh` or `max`.                                 |
| `MAX_CHANGED_LINES`, `MAX_INPUT_TOKENS`, `MAX_OUTPUT_TOKENS`, `RATE_LIMIT_REVIEWS`, `RATE_LIMIT_WINDOW_SECONDS` | No       | See limits above.                                                                    |

All variables are validated with zod on each request; invalid values fall back to the defaults.

## Demo mode

When `ANTHROPIC_API_KEY` is not set, a banner says so and every review replays a saved review from `src/fixtures/demo-review.json` instead of calling GitHub or Claude. The replay still runs through the real diff parser, chunker and finding validation, so the deployed demo shows the real pipeline without spending money.

The shipped fixture is a hand-written sample review of a small sample pull request (`sample/team-directory#42`: a people table gaining search and pagination, 3 files, 9 findings). It is the only saved review, so in demo mode the landing page offers that one sample as its example and says that any pasted URL replays it. The three real example pull requests (Vite and Zustand) appear only when a key is set.

### Recording a real fixture

Recording calls GitHub and the Anthropic API and spends tokens, so it is a manual step that needs a key. Pick a public pull request of at most 1,500 changed lines (the script stops otherwise) and run:

```bash
ANTHROPIC_API_KEY=... REVIEW_MODEL=claude-opus-5-5 npm run record-fixture -- https://github.com/owner/repo/pull/123
```

`GITHUB_TOKEN` is optional and only needed for the GitHub rate limit. The script runs the same chunking and model call as the route, one file at a time, and overwrites `src/fixtures/demo-review.json` with the pull request, its diff, the model name and every raw model answer. Never put the key in `.env.local` for the deployed demo; the recording runs on your machine only. Afterwards:

1. Check the recorded findings in the app (`npm run dev` without a key) and delete the fixture's findings you would not stand behind.
2. Update what names the old sample: `SAMPLE_EXAMPLE` in `src/components/landing/landing.tsx` (title, repo, size, and the URL, which must be the recorded pull request's URL), the expectations in `e2e/demo-review.spec.ts` (title, "9 findings", "of 3 files") and in the UI and route tests that read `demoFixture` counts.
3. Run `npm test` and `npm run test:e2e`.

To show several saved reviews, the fixture file would have to become one file per pull request keyed by URL, and `createDemoDependencies` would have to pick by the pasted URL. That is not built, which is why the demo has a single example.

## Using it

- Paste a URL such as `https://github.com/owner/repo/pull/123` or `owner/repo#123`, pick a model, and start the review. Example buttons start reviews of real public pull requests (in demo mode, the one saved sample).
- Progress is announced in a polite live region. Findings appear per file as each one finishes. You can stop the review and keep what arrived.
- The left column lists reviewed files with their finding counts, and the files that were skipped and why.
- Keyboard: `j` and `k` move between findings, `a` accepts, `d` dismisses, `e` edits. Shortcuts are ignored while typing.
- Export opens a drawer with the Markdown and a copy button. It contains accepted findings, or every finding that is not dismissed when nothing is accepted yet.
- The session is kept in `sessionStorage`, so a reload keeps your triage.

## Run it

Node 24 and npm 11.

Clone [`eylulg/ui`](https://github.com/eylulg/ui) next to this folder and build it once (`npm install && npm run build` inside it). The app depends on it as `file:../ui`, installed as a copy with `npm install ../ui --install-links`; run `npm run relink` after rebuilding the library.

```bash
npm install
cp .env.example .env.local   # optional: add ANTHROPIC_API_KEY, GITHUB_TOKEN
npm run dev
```

## Tests and checks

```bash
npm run typecheck
npm run lint            # ESLint 9, zero warnings, jsx-a11y and react-hooks
npm run format:check
npm run knip            # unused files, exports and dependencies
npm test                # Vitest: parser, chunking, schema, export, route, store, UI flows with axe
npm run test:e2e        # Playwright: production build in demo mode, axe in light and dark, 375 px
```

The Anthropic SDK is replaced with a stub in every test, and GitHub is stubbed at `fetch`; no test calls a real API. The UI tests run the real pipeline over the demo fixture and stub only the network.

CI (`.github/workflows/ci.yml`) checks out `eylulg/ui` next to the repository and builds it before `npm ci`, then runs a secret scan, then typecheck, lint, format check, knip, unit tests, build and the end-to-end test.

## Deploying to Vercel

Vercel cannot resolve `file:../ui`, because the sibling checkout does not exist there. Deploys need the component library on npm: once `@eylulg/ui` is published, replace the `file:../ui` range in `package.json` with `^1.0.0` (and remove the `turbopack.root` setting in `next.config.ts` and the library checkout step in CI). Until then the app runs locally and in CI only.

1. Import the repository in Vercel. The framework preset is Next.js; no build settings are needed.
2. Set environment variables for Production (and Preview if you want live reviews there): `ANTHROPIC_API_KEY`, optionally `GITHUB_TOKEN`, `REVIEW_MODEL` and the limits. Leave `ANTHROPIC_API_KEY` unset for a free demo deployment.
3. The review route allows up to 300 seconds (`maxDuration`), which needs a plan that permits it. Large pull requests take a few minutes.

The rate limit lives in memory, so each serverless instance counts separately. For a public deployment with a real key, also set a spend limit on the Anthropic key.

### Public demo defaults

A public deployment with a key spends the owner's money, so the defaults lean cheap: Claude Sonnet 5.5 is preselected (visitors can switch to Opus), one review may use at most 40,000 output tokens (`MAX_OUTPUT_TOKENS`) and 120,000 estimated input tokens, and a visitor gets five reviews per ten minutes. A review counts against that allowance only after the model has answered at least once, so a bad URL or a GitHub error does not use it up.

The limit is keyed on the first address in `x-forwarded-for` (then `x-real-ip`). That header is trusted only behind Vercel, which overwrites it with the real client address. On any host that passes the client's own header through, a visitor can send a different value with every request and the per-IP limit does nothing; there, rely on the spend limit on the Anthropic key, or put a proxy in front that sets the header.

## Stack

Next.js 16 App Router, React 19, TypeScript strict, Tailwind CSS 4, the shared `@eylulg/ui` design system (React Aria Components, `review` theme variant), lucide-react, Zustand, zod, `@anthropic-ai/sdk`, Vitest with Testing Library and vitest-axe, Playwright with axe-core.

## License

MIT, see [LICENSE](LICENSE).
