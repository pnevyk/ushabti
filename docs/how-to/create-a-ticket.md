# Create a ticket

Draft a new Jira ticket as a local markdown file, review it before anything hits Jira, then create it.

## 1. Start from a template

```sh
ushabti jira template > new-ticket.md
```

Prints an example ticket with `title` and `type` filled in and every optional field present but commented out. The filename doesn't matter yet — `--update` (step 5) will rename it once the ticket has a real key.

## 2. Optionally, look up people and sprint ids

If you'll assign the ticket or put it in a sprint, you need account ids and sprint ids, not names:

```sh
ushabti jira project --project ABC
```

Writes a YAML file mapping display names to the ids used by `assignee` and `sprint`.

## 3. Configure custom fields, if you use them

`storyPoints` and `sprint` in frontmatter only take effect if your Jira project's custom field ids are configured — see [`[jira]` in the configuration reference](../reference/configuration.md#jira). Without them, those two frontmatter fields are silently ignored.

## 4. Fill in the ticket's metadata

Edit `new-ticket.md`: uncomment and fill in whichever optional fields apply (`parent`, `assignee`, `storyPoints`, `sprint`), and replace the placeholder description with the real one. `storyPoints` and `sprint` only take effect with the custom fields from step 3 configured — leave them commented out otherwise.

## 5. Create it

```sh
ushabti jira create --project ABC --file new-ticket.md --update
```

`--update` writes the newly created key into the file's frontmatter and renames it to `<KEY>.md`, so it's ready for step 6 without any manual bookkeeping. Without `--update`, the ticket is still created — you'd just be responsible for tracking the key yourself.

## 6. Editing later

Once a ticket file has an `id` in frontmatter (from `--update` above, or from `jira fetch --format markdown`), edit the file and push the change back:

```sh
ushabti jira update --file ABC-123.md
```

Only the fields present in frontmatter are updated; everything else on the ticket is left alone.
