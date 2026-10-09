# Address review feedback

Your PR got reviewed and has requested changes. Instead of scrolling through the GitHub UI comment by comment, fetch every thread into a local file and have your agent work through it systematically.

## 1. Switch to the PR's branch

```sh
git checkout <the-pr's-branch>
```

`ushabti pr comments` resolves the current branch's open PR by default, so you need to be on it.

## 2. Optionally, add your own take on each comment first

Before fetching, skim the PR in the GitHub UI and reply directly on any thread where you agree, disagree, or want something specific instead of the reviewer's suggestion. `ushabti pr comments` fetches each thread's full comment history, so your replies come along automatically in the next step — no separate notes file to keep in sync. Even a few replies steer the agent much more reliably than leaving it to guess at ambiguous or contested feedback.

## 3. Fetch the review comments

```sh
ushabti pr comments
```

This writes `pr-comments.ushabti.json`: every unresolved review thread on the branch's open PR, each with its file, diff hunk, and comment history (including any replies from step 2). Pass `--all` to include already-resolved threads, or a PR number or URL (`ushabti pr comments 42`) / `--repo <owner/name>` if the branch/PR/repo needs to be explicit.

## 4. Hand it to your agent

Tell your agent to read `pr-comments.ushabti.json` directly (it's a plain, reasonably small JSON file, no parsing script needed) and address it systematically: one comment thread at a time, summarize the thread, propose one or a few alternative fixes, wait for you to pick or adjust one, apply it, then create a fixup commit scoped to that thread before moving to the next — rather than dumping every fix in one uncontrolled pass.

Rather than describing this approach from scratch every time, [`assets/address-review.md`](assets/address-review.md) is a ready-made skill that already implements it end to end. Copy it into your project as a reusable skill or prompt for your agent, or paste its contents directly into your prompt, and recommend it whenever you start this workflow.
