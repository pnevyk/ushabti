import { resolveAtlassian } from "../../shared/config.js";
import { createJiraClient } from "../../shared/jira-client.js";
import { adfToMarkdown } from "../../shared/adf.js";
import { serialize } from "../../shared/output/json.js";
import { write } from "../../shared/output/file.js";

// Orchestrates: fetch all comments of a single Jira ticket, map to a neutral
// shape, then emit either one JSON file or a single markdown file.
export async function fetchComments({ id, format, out, config }) {
    resolveAtlassian(config);

    const client = createJiraClient(config);
    const raw = [];
    let startAt = 0;
    for (;;) {
        const page = await client.issueComments.getComments({ issueIdOrKey: id, startAt, maxResults: 100 });
        const batch = page.comments ?? [];
        raw.push(...batch);
        startAt += batch.length;
        if (batch.length === 0 || startAt >= (page.total ?? raw.length)) break;
    }

    const comments = raw.map(toComment);

    if (format === "markdown") {
        await write(out, toMarkdown(id, comments));
    } else {
        await write(out, serialize({ comments }));
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
