# Output destinations

By default every command writes its result to a file (or a directory of files); the default path is listed in `ushabti <group> <command> --help`.

## `--out <path>`

Writes to `<path>` instead of the default. For commands that write one file per document (`jira fetch <project>`, `confluence download --children`), `<path>` is a directory.

## `--out -`

Writes to stdout instead of a file.

| Aspect | Behavior |
| --- | --- |
| Multiple documents | Printed in order, back to back; no filenames or extra separators. A trailing newline is added to any document lacking one. |
| Attachments | Not downloaded; one warning per affected document on stderr. Attachment links are left unrewritten. |
| Warnings and errors | Always stderr; stdout carries only documents. |
| Closed pipe (`EPIPE`) | Exits with status 0. |

With `jira fetch`, a ticket's comments document follows the ticket's own content.

Supported by: `jira fetch`, `jira comments`, `jira project`, `confluence download`, `confluence comments`, `pr comments`, `pr digest`.
