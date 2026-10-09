import { dirname } from "node:path";
import { resolveAtlassian } from "../../shared/secrets.js";
import { createJiraClient } from "../../shared/jira-client.js";
import { toJiraError } from "../../shared/jira-errors.js";
import { adfToMarkdown } from "../../shared/adf.js";
import { serialize } from "../../shared/output/json.js";
import { stringify } from "../../shared/frontmatter.js";
import { write, ensureDir, pathTarget } from "../../shared/output/file.js";
import { findMediaIds, rewriteMediaLinks, downloadMedia, warnMediaSkipped } from "../../shared/media-download.js";
import { resolveIssueMedia } from "../../shared/jira-media.js";
import { fetchAllComments, commentsMediaIds, downloadCommentsMedia, toMarkdown as commentsToMarkdown } from "./comments.js";

// Orchestrates: query all Jira tickets for a project, map to a neutral shape,
// then emit either one JSON file or a directory of per-ticket markdown files.
// Comments are fetched for a single ticket, or for every ticket with `comments`;
// they go to a sibling `<id>.comments.md` (linked from the frontmatter) or, in
// JSON, into the ticket itself.
export async function fetchTickets({ project, id, format, out, config, comments = false }) {
    resolveAtlassian(config);
    const spField = config.jira?.storyPointsField || null;
    const sprintField = config.jira?.sprintField || null;

    const client = createJiraClient(config);
    const fields = ["summary", "description", "parent", "assignee", "issuetype", "attachment"];
    if (spField) fields.push(spField);
    if (sprintField) fields.push(sprintField);

    let issues;
    if (id) {
        try {
            issues = [await client.issues.getIssue({ issueIdOrKey: id, fields })];
        } catch (err) {
            throw toJiraError(err, { resource: id });
        }
    } else {
        issues = [];
        let nextPageToken;
        do {
            let result;
            try {
                result = await client.issueSearch.searchForIssuesUsingJqlEnhancedSearch({
                    jql: `project = "${project}"`,
                    fields,
                    maxResults: 100,
                    nextPageToken,
                });
            } catch (err) {
                throw toJiraError(err, { resource: project });
            }
            issues.push(...(result.issues ?? []));
            nextPageToken = result.nextPageToken ?? undefined;
        } while (nextPageToken);
    }
    const tickets = issues.map((issue) => toTicket(issue, spField, sprintField));

    const commentsById = new Map();
    if (id || comments) {
        for (const ticket of tickets) {
            const list = await fetchAllComments(client, ticket.id);
            if (list.length || comments) {
                commentsById.set(ticket.id, list);
            }
        }
    }

    if (out.kind === "stdout") {
        for (const ticket of tickets) {
            warnMediaSkipped(ticket.id, findMediaIds(ticket.description));
            warnMediaSkipped(ticket.id, commentsMediaIds(commentsById.get(ticket.id) ?? []));
        }
    } else {
        const mediaDir = format === "markdown" && !id ? out.path : dirname(out.path);
        await ensureDir(pathTarget(mediaDir));
        for (let i = 0; i < tickets.length; i++) {
            await downloadTicketMedia(client, issues[i], tickets[i], mediaDir);
            const list = commentsById.get(tickets[i].id);
            if (list) {
                await downloadCommentsMedia(client, tickets[i].id, list, mediaDir, issues[i]);
            }
        }
    }

    if (format === "markdown") {
        // A single ticket's file sits at `out`; its siblings go in the same directory.
        const dir = id && out.kind === "path" ? pathTarget(dirname(out.path)) : out;
        for (const ticket of tickets) {
            const { description, ...meta } = ticket;
            const list = commentsById.get(ticket.id);
            if (list && out.kind === "path") {
                meta.comments = commentsFileName(ticket.id);
            }
            if (id) {
                await write(out, stringify(meta, description));
            } else {
                await write(out, stringify(meta, description), `${ticket.id}.md`);
            }
            if (list) {
                await write(dir, commentsToMarkdown(ticket.id, list), commentsFileName(ticket.id));
            }
        }
    } else {
        for (const ticket of tickets) {
            const list = commentsById.get(ticket.id);
            if (list) {
                ticket.comments = list;
            }
        }
        await write(out, serialize({ tickets }));
    }
}

function commentsFileName(ticketId) {
    return `${ticketId}.comments.md`;
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
