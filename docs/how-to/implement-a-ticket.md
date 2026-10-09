# Implement a ticket

Turn a Jira ticket into a local markdown file your coding agent can work from directly, instead of the agent fetching it (with a broad Jira token) itself.

## 1. Fetch the ticket

```sh
ushabti jira fetch ABC-123
```

Writes `ABC-123.md`: YAML frontmatter (title, type, parent, story points, assignee) plus the description as markdown.

You can paste the ticket's browser URL instead of the key.

## 2. Read its comments

If the ticket has comments, the same command also writes `ABC-123.comments.md`, one section per comment, and links it from the `comments` field in the ticket's frontmatter. Add `--comments` to write the file even when the ticket has none. Useful when the ticket has back-and-forth discussion (clarified scope, a linked design doc, an earlier attempt) that matters as much as the description itself.

## 3. Point your agent at the file

Run your usual agent workflow (a slash command, a skill, a plain prompt) and point it at `ABC-123.md` (and `ABC-123.comments.md`, if it was written) as the spec to implement against.

Nothing ushabti-specific is required here — the ticket is now a plain file like any other context you'd hand an agent.
