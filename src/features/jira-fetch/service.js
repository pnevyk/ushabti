import { dirname, join } from "node:path";
import { resolveAtlassian } from "../../shared/config.js";
import { createJiraClient } from "../../shared/jira-client.js";
import { adfToMarkdown } from "../../shared/adf.js";
import { serialize } from "../../shared/output/json.js";
import { stringify } from "../../shared/frontmatter.js";
import { write, ensureDir } from "../../shared/output/file.js";
import { findMediaIds, rewriteMediaLinks, downloadMedia } from "../../shared/media-download.js";
import { resolveIssueMedia } from "../../shared/jira-media.js";

// Orchestrates: query all Jira tickets for a project, map to a neutral shape,
// then emit either one JSON file or a directory of per-ticket markdown files.
export async function fetchTickets({ project, id, format, out, config }) {
    resolveAtlassian(config);
    const spField = config.jira?.storyPointsField || null;
    const sprintField = config.jira?.sprintField || null;

    const client = createJiraClient(config);
    const fields = ["summary", "description", "parent", "assignee", "issuetype", "attachment"];
    if (spField) fields.push(spField);
    if (sprintField) fields.push(sprintField);

    let issues;
    if (id) {
        issues = [await client.issues.getIssue({ issueIdOrKey: id, fields })];
    } else {
        issues = [];
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
    }
    const tickets = issues.map((issue) => toTicket(issue, spField, sprintField));

    const mediaDir = format === "markdown" && !id ? out : dirname(out);
    await ensureDir(mediaDir);
    for (let i = 0; i < tickets.length; i++) {
        await downloadTicketMedia(client, issues[i], tickets[i], mediaDir);
    }

    if (format === "markdown") {
        if (id) {
            const { description, ...meta } = tickets[0];
            await write(out, stringify(meta, description));
        } else {
            for (const ticket of tickets) {
                const { description, ...meta } = ticket;
                await write(join(out, `${ticket.id}.md`), stringify(meta, description));
            }
        }
    } else {
        await write(out, serialize({ tickets }));
    }
}

// Finds this ticket's own media references and downloads/rewrites them in
// place before the ticket is written. Not unit-tested directly (does
// HTTP + filesystem I/O) -- same convention as confluence-download's
// orchestrator functions.
async function downloadTicketMedia(client, issue, ticket, containingDir) {
    const mediaIds = findMediaIds(ticket.description);
    if (!mediaIds.length) {
        return;
    }
    const resolve = await resolveIssueMedia(client, issue);
    const idToFilename = await downloadMedia({ mediaIds, resolve, containingDir, baseName: ticket.id });
    ticket.description = rewriteMediaLinks(ticket.description, idToFilename);
}

// Pure: a Jira issue -> neutral ticket shape. Exported for unit testing.
export function toTicket(issue, spField, sprintField) {
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
    if (sprintField) {
        const raw = Array.isArray(f[sprintField]) ? f[sprintField] : [];
        // Cloud returns sprint objects {id, name, state, ...}; be defensive if it is already an id.
        const ids = raw.map((s) => (s && typeof s === "object" ? s.id : s)).filter((v) => v != null);
        ticket.sprint = ids.length ? ids[ids.length - 1] : null;
        ticket.sprintHistory = ids.length > 1 ? ids.slice(0, -1) : null;
    }
    ticket.description = adfToMarkdown(f.description);
    return ticket;
}
