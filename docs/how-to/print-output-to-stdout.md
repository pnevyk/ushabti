# Print output to stdout

Pipe a ticket, page or comment thread straight into another tool instead of writing a file.

## 1. Pass `--out -`

```sh
ushabti jira fetch ABC-123 --out -
```

The markdown document goes to stdout; nothing is written to disk. Warnings and errors still go to stderr, so stdout carries only the document.

## 2. Pipe it

```sh
ushabti jira fetch ABC-123 --out - | pbcopy
ushabti confluence download 12345 --out - | grep -i rollback
ushabti pr comments 42 --out - | jq '.threads[].path'
```

Closing the pipe early (for example `| head`) ends the command quietly.

## 3. Print several documents

Commands that normally write one file per document print all of them, one after another, with no filenames or separators beyond each document's own frontmatter:

```sh
ushabti jira fetch ABC --out -
ushabti confluence download 12345 --children --out -
```

## Attachments

Images and other attachments are not downloaded when printing to stdout. Each affected document is reported on stderr, and its attachment links are left as they were.

The full list of supported commands is in the [output reference](../reference/output.md).
