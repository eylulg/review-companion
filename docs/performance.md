# Performance

Production build in demo mode, headless Chromium, Lighthouse mobile defaults, three runs, median. Raw reports are in `docs/perf`.

## Landing route

| Metric                | Before | After  |
| --------------------- | ------ | ------ |
| JS before load (gzip) | 264 kB | 237 kB |
| Performance score     | 100    | 100    |
| LCP                   | 753 ms | 755 ms |
| CLS                   | 0      | 0      |

## What changed

The zod schemas were the largest avoidable item on the landing route, about 31 kB gzip, pulled in by three imports. The URL parser shared a file with the GitHub fetch code (now `github-api.ts`, server only). The session store validated saved sessions with zod at import time (now `persisted-session.ts`, loaded only when `sessionStorage` holds a session). The event stream parser is now loaded when a review starts. The review screen was already loaded only after Start.

After relinking the component library with lazy overlays, the landing grew by about 5 kB. I did not find the cause.

## What did not help

- The Select costs about 10 kB gzip and cannot be split from this repo. The trigger and popover are one component in the library.
- The shared top navigation is about 9 kB gzip, also from the library.
- The 200 kB target is not met. The floor is the Next runtime (about 44 kB), React DOM (about 70 kB) and the React Aria core (about 100 kB).

## Budget in CI

`lighthouserc.cjs` asserts a score of 0.9, CLS under 0.1 and 250 kB of script. It guards against regressions. No metric fails today.
