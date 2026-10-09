import { toJiraError } from "../../shared/jira-errors.js";
import { adfToMarkdown } from "../../shared/adf.js";
import { findMediaIds, rewriteMediaLinks, downloadMedia } from "../../shared/media-download.js";
import { resolveIssueMedia } from "../../shared/jira-media.js";

// Fetches all comments of a ticket (paged) and maps them to the neutral shape.
export async function fetchAllComments(client, id) {
    const raw = [];
    let startAt = 0;
    for (;;) {
        let page;
        try {
            page = await client.issueComments.getComments({ issueIdOrKey: id, startAt, maxResults: 100 });
        } catch (err) {
            throw toJiraError(err, { resource: id });
        }
        const batch = page.comments ?? [];
        raw.push(...batch);
        startAt += batch.length;
        if (batch.length === 0 || startAt >= (page.total ?? raw.length)) break;
    }
    return raw.map(toComment);
}

// Distinct media ids referenced across all comment bodies.
export function commentsMediaIds(comments) {
    return [...new Set(comments.flatMap((c) => findMediaIds(c.body)))];
}

// Finds media references across all comment bodies and downloads/rewrites
// them in place. Uses `issue` (with its attachments) when the caller already
// has it; otherwise fetches it, and only when a comment actually references a
// media id. Not unit-tested directly (does HTTP + filesystem I/O) -- same
// convention as confluence-download's orchestrator functions.
export async function downloadCommentsMedia(client, id, comments, containingDir, issue) {
    const mediaIds = commentsMediaIds(comments);
    if (!mediaIds.length) {
        return;
    }
    let source = issue;
    if (!source) {
        try {
            source = await client.issues.getIssue({ issueIdOrKey: id, fields: ["attachment"] });
        } catch (err) {
            throw toJiraError(err, { resource: id });
        }
    }
    const resolve = await resolveIssueMedia(client, source);
    const idToFilename = await downloadMedia({ mediaIds, resolve, containingDir, baseName: id });
    for (const comment of comments) {
        comment.body = rewriteMediaLinks(comment.body, idToFilename);
    }
}

// Pure: a Jira comment -> neutral shape. Exported for unit testing.
export function toComment(comment) {
    return {
        id: comment.id,
        author: comment.author?.displayName ?? "",
        authorId: comment.author?.accountId ?? null,
        created: comment.created ?? null,
        updated: comment.updated ?? null,
        body: adfToMarkdown(comment.body),
    };
}

// Pure: neutral comments -> a single markdown document. Exported for testing.
export function toMarkdown(id, comments) {
    const sections = comments.map((c) => {
        const edited = c.updated && c.updated !== c.created ? ` (edited ${c.updated})` : "";
        return `## ${c.author} — ${c.created}${edited}\n\n${c.body}`;
    });
    return `# ${id} comments\n\n${sections.join("\n\n")}\n`;
}
