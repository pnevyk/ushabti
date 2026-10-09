# Download Confluence pages

Pull Confluence documentation into local markdown files so your agent can use it as context, without handing the agent live access to your Confluence site.

## 1. Download a page

```sh
ushabti confluence download 12345
```

Writes `<title>-12345.md`: YAML frontmatter (id, title, type, spaceId, parentId) plus the page body as markdown. Any pasted image downloads alongside it as its own file, with the body's image link rewritten to point at it.

You can paste the page's browser URL instead of the id, for this command and for `confluence comments`.

## 2. Or download a whole tree

If the page is really the root of a section — a folder, or a page with subpages you also want — add `--children`:

```sh
ushabti confluence download 12345 --children
```

Downloads the root plus every descendant at any depth into a directory tree, one file per page/folder. A descendant is skipped, along with its own descendants, and reported on stderr, if it's either archived or of a type ushabti doesn't support (whiteboard, database, embed, ...) — check that output if a page you expected is missing.

## 3. Feed the pages to your agent

Point your agent at the downloaded file (or directory, for `--children`) as context — architecture docs, a runbook, a design doc, whatever the page contains. It's plain markdown at this point, no different from any other file you'd hand the agent.

## 4. Download page comments

```sh
ushabti confluence comments 12345
```

Writes `confluence-12345-comments.md`: every footer and inline comment *thread* (a root comment plus its full reply chain), merged into one chronological file, threads separated by an `---` rule. Each thread opens with `- Type: footer|inline` (plus `- Status: open|resolved|reopened|dangling` for inline); an inline thread's bullets are followed by a `> ...` line quoting the highlighted text it's anchored to (footer threads aren't anchored to anything, so they have no quote), then one `## Author: <accountId> (<timestamp>) [id: <commentId>]` section per comment in the thread, root first. Authors are shown by accountId — Confluence's comment API doesn't return a display name.
