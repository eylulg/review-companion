# Review Companion

Paste a public GitHub pull request URL. The app fetches the diff, streams a code review from Claude file by file, and lets you accept, dismiss or edit each finding. The accepted ones export as GitHub Markdown, with `suggestion` blocks where the fix is certain, ready to paste as review comments. Nothing is posted to GitHub.

Live: https://eg-review-companion.vercel.app

The live site has no API key. It never calls GitHub or Claude: every review replays one saved sample review, so the app is free to run. Real reviews need a key on your own machine.

## Run it

Needs Node 24. The app depends on the component library as `file:../ui`, so clone [`eylulg/ui`](https://github.com/eylulg/ui) next to this folder and build it once (`npm install && npm run build` inside it).

```bash
npm install
cp .env.example .env.local   # optional: add ANTHROPIC_API_KEY and GITHUB_TOKEN
npm run dev
```

Open http://localhost:3000. Without a key you get the demo replay. With `ANTHROPIC_API_KEY` set, real reviews run and cost tokens. After rebuilding the library, run `npm run relink`.

Other commands: `npm test`, `npm run test:e2e`, `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run knip`.

To record a new demo review (calls GitHub and Anthropic, so it spends tokens, and the pull request must be 1,500 changed lines or fewer):

```bash
ANTHROPIC_API_KEY=... npm run record-fixture -- https://github.com/owner/repo/pull/123
```

It overwrites `src/fixtures/demo-review.json`. Then update `SAMPLE_EXAMPLE` in `src/components/landing/landing.tsx` and the counts in `e2e/demo-review.spec.ts` and the tests that read the fixture.

## Decisions

- **One file per request.** Each file's changed hunks go to Claude on their own, two requests at a time, with a JSON schema for the answer. Findings stream in as each file finishes, and a stopped review keeps what arrived. The cost is that Claude cannot see how files relate to each other.
- **Findings are checked against the diff.** A finding must name a file in the diff and a line that exists in it, or it is dropped and counted in a warning. This catches invented line numbers, but it also drops a finding that points at nearby unchanged code.
- **Cost limits.** At most 1,500 changed lines (over that the app asks which files to review), 120,000 estimated input tokens and 40,000 output tokens per review, and 5 reviews per IP per 10 minutes. The IP counter is in memory, so each serverless instance counts separately, and it trusts the `x-forwarded-for` header, which is only safe behind Vercel. Put a spend limit on the Anthropic key as well.
- **Demo replay through the real pipeline.** The saved review still runs through the diff parser, chunker and finding validation, so the demo shows the real code path. It is one hand-written sample pull request (3 files, 9 findings). Any URL you paste replays it.

What goes to the model: the pull request title, branch names, the first 4,000 characters of the description, and one file's hunks with line numbers. The diff and description are marked as data in the prompt, not instructions.

## Tests

Parser, chunking, schema, export, the API route, the store and the UI flows are covered with Vitest. The Anthropic SDK is stubbed and GitHub is stubbed at `fetch`, so no test calls a real API. Playwright runs the production build in demo mode, with axe checks in light and dark mode and a 375 px screen.

## Deploy

Vercel, Next.js preset, repository root, Node 24. `vercel.json` clones and builds `eylulg/ui` during install because the library is not on npm yet.

Leave `ANTHROPIC_API_KEY` unset for the free public demo. For live reviews, set the variables below and a spend limit on the key. The review route allows 300 seconds (`maxDuration`), which needs a Vercel plan that permits it.

| Variable                                                     | Purpose                                                                                  |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `ANTHROPIC_API_KEY`                                          | Server side only. Empty means demo mode.                                                 |
| `GITHUB_TOKEN`                                               | Raises GitHub's limit from 60 to 5,000 requests an hour and allows private repositories. |
| `REVIEW_MODEL`                                               | `claude-sonnet-5-5` (default) or `claude-opus-5-5`. Visitors can pick in the UI.         |
| `REVIEW_EFFORT`                                              | `low`, `medium`, `high` (default), `xhigh` or `max`.                                     |
| `MAX_CHANGED_LINES`, `MAX_INPUT_TOKENS`, `MAX_OUTPUT_TOKENS` | The limits above.                                                                        |
| `RATE_LIMIT_REVIEWS`, `RATE_LIMIT_WINDOW_SECONDS`            | Reviews per IP per window.                                                               |

[MIT](LICENSE), Eylül Güneş
