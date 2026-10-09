import { dirname } from "node:path";
import { resolveAtlassian } from "../../shared/secrets.js";
import { createJiraClient } from "../../shared/jira-client.js";
import { toJiraError } from "../../shared/jira-errors.js";
import { adfToMarkdown } from "../../shared/adf.js";
import { serialize } from "../../shared/output/json.js";
import { write } from "../../shared/output/file.js";
import { findMediaIds, rewriteMediaLinks, downloadMedia, warnMediaSkipped } from "../../shared/media-download.js";
import { resolveIssueMedia } from "../../shared/jira-media.js";

// Orchestrates: fetch all comments of a single Jira ticket, map to a neutral
// shape, then emit either one JSON file or a single markdown file.
export async function fetchComments({ id, format, out, config }) {
    resolveAtlassian(config);

    const client = createJiraClient(config);
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

    const comments = raw.map(toComment);
    if (out.kind === "stdout") {
        warnMediaSkipped(id, [...new Set(comments.flatMap((c) => findMediaIds(c.body)))]);
    } else {
        await downloadCommentsMedia(client, id, comments, dirname(out.path));
    }

    if (format === "markdown") {
        await write(out, toMarkdown(id, comments));
    } else {
        await write(out, serialize({ comments }));
    }
}

// Finds media references across all comment bodies and downloads/rewrites
// them in place before the comments are written. Fetches the issue's
// attachments (a call this feature otherwise never needs) only when at least
// one comment actually references a media id. Not unit-tested directly (does
// HTTP + filesystem I/O) -- same convention as confluence-download's
// orchestrator functions.
async function downloadCommentsMedia(client, id, comments, containingDir) {
    const mediaIds = [...new Set(comments.flatMap((c) => findMediaIds(c.body)))];
    if (!mediaIds.length) {
        return;
    }
    let issue;
    try {
        issue = await client.issues.getIssue({ issueIdOrKey: id, fields: ["attachment"] });
    } catch (err) {
        throw toJiraError(err, { resource: id });
    }
    const resolve = await resolveIssueMedia(client, issue);
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
