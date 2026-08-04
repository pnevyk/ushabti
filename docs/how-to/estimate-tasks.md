# Estimate tasks with the UI

Score a task's size with a small local calculator instead of guessing a number out of thin air, then copy the result into a ticket.

## 1. Start the UI

```sh
ushabti ui estimate
```

Prints a local URL, e.g. `http://127.0.0.1:54321` — open it in a browser. Pass `--browser` to have ushabti open it for you instead, or set `openBrowser = true` under `[ui]` in your config to make that the default (see [`[ui]` in the configuration reference](../reference/configuration.md#ui)). The server keeps running until you stop it with Ctrl+C.

## 2. Score distance, friction and relativity

Pick one level (1–5) in each of the three columns:

- **Distance** — how long the task takes at full proficiency, from d1 (within a day) to d5 (exceeds a sprint; split it before starting).
- **Friction** — how much precedent and reference material exists, from f1 (highway: tutorial-guided) to f5 (jungle: uncharted territory).
- **Relativity** — how many unknowns stand between you and done, from r1 (trivial) to r5 (total: completion isn't believed possible yet).

Hover a button for its full description.

## 3. Read the score

Once all three are picked, the UI computes **EP** (energy points) as `(distance + friction) × relativity`, and a summary string like `d3 f2 r1`. Click either value to copy it to the clipboard — paste the EP into a story-points-like field, or the summary into a ticket description for a record of how the estimate broke down.
