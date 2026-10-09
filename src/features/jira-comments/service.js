import { dirname } from "node:path";
import { resolveAtlassian } from "../../shared/secrets.js";
import { createJiraClient } from "../../shared/jira-client.js";
import { serialize } from "../../shared/output/json.js";
import { write } from "../../shared/output/file.js";
import { warnMediaSkipped } from "../../shared/media-download.js";
import { fetchAllComments, commentsMediaIds, downloadCommentsMedia, toMarkdown } from "../jira-fetch/comments.js";

// Deprecated in favour of `jira fetch`. Orchestrates: fetch all comments of a
// single Jira ticket, then emit either one JSON file or a single markdown file.
export async function fetchComments({ id, format, out, config }) {
    resolveAtlassian(config);

    const client = createJiraClient(config);
    const comments = await fetchAllComments(client, id);
    if (out.kind === "stdout") {
        warnMediaSkipped(id, commentsMediaIds(comments));
    } else {
        await downloadCommentsMedia(client, id, comments, dirname(out.path));
    }

    if (format === "markdown") {
        await write(out, toMarkdown(id, comments));
    } else {
        await write(out, serialize({ comments }));
    }
}
