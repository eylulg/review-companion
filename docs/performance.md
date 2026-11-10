# Performance

Measured on the production build in demo mode (no API key), headless Chromium, Lighthouse mobile defaults, three runs, median. Raw reports are in `docs/perf/before/` and `docs/perf/after/`. JavaScript is gzip size of the files requested before the load event.

## Landing route (/)

| Metric                      | Before   | After    | Delta    |
| --------------------------- | -------- | -------- | -------- |
| JS before load (gzip)       | 264 kB   | 233 kB   | -31 kB   |
| JS transferred (Lighthouse) | 268.7 kB | 237.3 kB | -31.4 kB |
| CSS (gzip)                  | 11.6 kB  | 11.6 kB  | 0        |
| Requests                    | 16       | 16       | 0        |
| Performance score           | 100      | 100      | 0        |
| LCP                         | 753 ms   | 753 ms   | 0        |
| CLS                         | 0        | 0        | 0        |
| TBT                         | 4.5 ms   | 3.5 ms   | -1 ms    |

## Finished demo review (same page after the sample review runs)

| Metric                           | Before | After  | Delta  |
| -------------------------------- | ------ | ------ | ------ |
| JS loaded in total (gzip)        | 276 kB | 276 kB | 0      |
| Of which loaded only after Start | 12 kB  | 44 kB  | +32 kB |

The review state is client side, so Lighthouse cannot cold load it. These numbers come from a Playwright run that clicks the sample review at 375 px. CLS on both routes is covered by the existing 375 px end-to-end run.

## After the library performance pass

Same method as above, after relinking `@eylulg/ui` with lazy overlays (dialog, popover, menus, tooltip, toast) and the chrome menus loaded on first press. Landing route, production build in demo mode, Lighthouse mobile, three runs, median.

| Metric                      | After the zod pass | After the library performance pass | Delta   |
| --------------------------- | ------------------ | ---------------------------------- | ------- |
| JS before load (gzip)       | 233 kB             | 237.5 kB                           | +4.5 kB |
| JS transferred (Lighthouse) | 237.3 kB           | 242.8 kB                           | +5.5 kB |
| Performance score           | 100                | 100                                | 0       |
| LCP                         | 753 ms             | 755 ms                             | +2 ms   |
| CLS                         | 0                  | 0                                  | 0       |
| TBT                         | 3.5 ms             | 4.5 ms                             | +1 ms   |

The landing grew by about 5 kB instead of shrinking. The landing here uses a `Select`, which the library could not split (see above), and the first-load chunks of the entries it uses gained the small loader that the lazy overlays need. The 250 kB script budget in `lighthouserc.cjs` still holds with 7 kB to spare.

## What changed

- The zod schemas were the largest avoidable item on the landing route: about 31 kB gzip. Three imports pulled them in. The URL parser shared a file with the GitHub fetch code (now `github-api.ts`, server only). The session store validated saved sessions with zod at import time (now `persisted-session.ts`, loaded only when sessionStorage holds a session). The event stream parser was imported by the runner (now loaded when a review starts).
- The review screen chunk was already loaded only after a review starts. Confirmed: it is absent from the landing requests and arrives after Start.

## What did not help or could not be done here

- Card adds about 0.6 kB gzip and Switch about 2 kB over a plain element. Neither pulls in more React Aria than it uses.
- The Select costs about 10 kB gzip (trigger, listbox, popover). It cannot be split from here: the trigger and popover are one component in `@eylulg/ui`, and a lazy wrapper in this repo would either flash or load eagerly. It needs a lazy popover inside the library.
- The shared top navigation (project switcher and theme menu) is about 9 kB gzip, also from `@eylulg/ui/chrome`.

## What is left

The landing route is still above the 200 kB target. The floor is the Next runtime (about 44 kB), React DOM (about 70 kB) and the React Aria core shared by Input, Button, Card and Switch (about 100 kB). The Select popover and the chrome menus are the next two items, both in the component library. Lighthouse performance is 100 on both measured states, so the budget in `lighthouserc.cjs` (score 0.9, CLS 0.1, 250 kB script) guards against regressions rather than a failing metric.
