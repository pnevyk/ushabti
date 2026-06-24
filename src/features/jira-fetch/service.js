import { join } from "node:path";
import { requireKeys } from "../../shared/config.js";
import { createJiraClient } from "../../shared/jira-client.js";
import { adfToMarkdown } from "../../shared/adf.js";
import { serialize } from "../../shared/output/json.js";
import { stringify } from "../../shared/frontmatter.js";
import { write, ensureDir } from "../../shared/output/file.js";

// Orchestrates: query all Jira tickets for a project, map to a neutral shape,
// then emit either one JSON file or a directory of per-ticket markdown files.
export async function fetchTickets({ project, id, format, out, config }) {
    requireKeys(config, ["jira.baseUrl", "jira.email", "jira.token"]);
    const spField = config.jira.storyPointsField || null;

    const client = createJiraClient(config);
    const fields = ["summary", "description", "parent", "assignee", "issuetype"];
    if (spField) fields.push(spField);

    let tickets;
    if (id) {
        const issue = await client.issues.getIssue({ issueIdOrKey: id, fields });
        tickets = [toTicket(issue, spField)];
    } else {
        const issues = [];
        let nextPageToken;
        do {
            const result = await client.issueSearch.searchForIssuesUsingJqlEnhancedSearch({
                jql: `project = "${project}"`,
                fields,
                maxResults: 100,
                nextPageToken,
            });
            issues.push(...(result.issues ?? []));
            nextPageToken = result.nextPageToken ?? undefined;
        } while (nextPageToken);
        tickets = issues.map((issue) => toTicket(issue, spField));
    }

    if (format === "markdown") {
        if (id) {
            const { description, ...meta } = tickets[0];
            await write(out, stringify(meta, description));
        } else {
            await ensureDir(out);
            for (const ticket of tickets) {
                const { description, ...meta } = ticket;
                await write(join(out, `${ticket.id}.md`), stringify(meta, description));
            }
        }
    } else {
        await write(out, serialize({ tickets }));
    }
}

// Pure: a Jira issue -> neutral ticket shape. Exported for unit testing.
export function toTicket(issue, spField) {
    const f = issue.fields ?? {};
    const ticket = {
        id: issue.key,
        title: f.summary ?? "",
        type: f.issuetype?.name ?? null,
        parent: f.parent?.key ?? null,
        assignee: f.assignee?.accountId ?? null,
    };
    if (spField) {
        ticket.storyPoints = f[spField] ?? null;
    }
    ticket.description = adfToMarkdown(f.description);
    return ticket;
}
