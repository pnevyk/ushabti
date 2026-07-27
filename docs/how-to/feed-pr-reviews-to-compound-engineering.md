# Feed PR reviews to a compound engineering step

Turn a stretch of PR review history into concrete additions to your project's agent instructions (a `CLAUDE.md`, a skill, a document, a lint rule), so the same mistake stops recurring — the ["compound engineering"](https://every.to/guides/compound-engineering) idea of feeding what you learn back into how future work gets done.

## 1. Fetch a window of merged PRs

```sh
ushabti pr digest --since 2026-06-01 --until 2026-06-30
```

Writes `pr-digest.ushabti.json`: every PR merged in that window, each with its reviews, inline review comments, and conversation comments.

## 2. Feed it to your agent

Have your agent read `pr-digest.ushabti.json` and look across the whole window for recurring feedback: the same kind of bug flagged more than once, a convention reviewers keep having to point out, a missing test category. Ask it to propose specific additions to your project's instructions (e.g. `CLAUDE.md`) or a new skill that would have caught the issue earlier — not a summary of what happened, but a concrete change to how future PRs get written or reviewed.

Review the proposed additions yourself before committing them; a pattern that looks recurring across a handful of PRs is a hypothesis, not a certainty.
