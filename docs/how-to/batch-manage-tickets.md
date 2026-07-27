# Batch manage tickets

Make the same kind of edit across many Jira tickets at once — e.g. re-triage a backlog, bulk-reassign, or retype a batch of stories — by editing local files and letting an agent apply the pattern, instead of clicking through each ticket in Jira.

## 1. Fetch every ticket in the project

```sh
ushabti jira fetch --project ABC
```

Writes `jira-ABC/`, one `<ID>.md` file per ticket.

## 2. Optionally, look up people and sprint ids

```sh
ushabti jira project --project ABC
```

Needed if your batch edit touches `assignee` or `sprint`, since both take ids, not names.

## 3. Narrow down which tickets to touch, if needed

```sh
ushabti jira filter --project ABC --where 'type === "Story" && !parent'
```

Prints the matching ticket ids, one per line — parentless stories, in this example. Skip this step if the edit applies to every ticket you fetched.

## 4. Let your agent make the edits

Point your agent at `jira-ABC/` (or just the filtered subset of files) and describe the change: reassign everything matching some condition, retype a batch, add a field. The agent edits each ticket's frontmatter/body directly, the same way it would edit any other file.

## 5. Push the changes back

`jira update` only takes one file at a time, so apply it per changed ticket:

```sh
for f in jira-ABC/*.md; do
  ushabti jira update --file "$f"
done
```

`jira update` isn't a diff against what was originally fetched — it resends whatever fields are currently present in the file, whether your agent actually touched them or not. Running the loop above over every file in `jira-ABC/` is safe (an untouched ticket just gets its existing values written back), but it makes one API call per ticket regardless of whether anything changed. Have your agent report the list of files it actually edited, and loop over just that list instead of the whole directory.

## 6. Create any new tickets the same way

If the batch edit involved drafting brand-new tickets (see [Create a ticket](create-a-ticket.md) for the single-ticket version), create each one and propagate its key with `--update`:

```sh
for f in jira-ABC/new-*.md; do
  ushabti jira create --project ABC --file "$f" --update
done
```
