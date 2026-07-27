---
name: address-review
description: Use when there are requested changes on your PR.
disable-model-invocation: true
---

## Overview

Ask the user how to get the review comments unless they specified it directly.

Follow this systematic approach to help the user with addressing review feedback.
Read the review comment threads, then one by one do the following:
1. Carefully read the comment thread and understand the main takeaways mentioned in the thread.
2. Summarize the comment thread for the user.
3. Propose 1-3 alternative changes how to address the feedback.
4. Let the user to specify their preferences, including a completely different option.
5. Once the user confirms, apply the agreed changes.
6. List commits that changed the affected files in the current branch to determine the fixup target.
7. Ask for review of the changes and target fixup commit.
8. After approval, create fixup commit(s) to the original commit(s).
9. Move to the next comment thread if there is any.

## Typical mistakes

- Listing all comment threads in one go -> present one issue at a time, resolve it with the user, and only then continue with the next one.
- Jumping into fixing -> even though the review comment is clear, always confirm with the user as they might want to make slight modifications to the suggestion.
- Creating normal commits -> always create fixup commits to the original commits and make sure you fixup the correct commit.
- Grouping fixup commits by file -> the fixups should be grouped by comment thread to allow convenient re-review and resolving comments.
- Creating a standalone fixup commit after the user corrects your edit -> amend changes requested by the user to the corresponding fixup commit without creating a new fixup (`git commit --amend --no-edit`).
- Using just the line number to identify the diff hunk on an already edited file -> always use the available diff hunks to anchor the comment.
- Using obscure python scripts to parse the review comments from JSON -> just read the file with the built-in read tool (you are a large language model, you don't need nice inputs).
- Choosing a fixup target that is outside of scope of the PR just because it was the last commit where the file was touched -> find logically relevant commit in the branch for the PR or create a normal commit instead of fixup if there is no valid candidate
