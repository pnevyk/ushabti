import { dirname } from "node:path";
import { resolveAtlassian } from "../../shared/secrets.js";
import { createConfluenceClient } from "../../shared/confluence-client.js";
import { nextCursor, resolvePageMedia } from "../../shared/confluence-media.js";
import { adfToMarkdown } from "../../shared/adf.js";
import { serialize } from "../../shared/output/json.js";
import { write } from "../../shared/output/file.js";
import { findMediaIds, rewriteMediaLinks, downloadMedia } from "../../shared/media-download.js";
import { toConfluenceError } from "../../shared/confluence-errors.js";
import { plugins } from "../../plugins/index.js";

// Orchestrates: fetch a Confluence page's footer and inline comment threads
// (each root comment plus its full reply chain), map them to one neutral
// shape, sort threads chronologically by their root, then emit either a JSON
// file or a single markdown file.
export async function fetchComments({ id, format, out, config }) {
    const credentials = resolveAtlassian(config);
    const client = createConfluenceClient(config);

    const footerRoots = await fetchPaginated(client.comment.getPageFooterComments, { id: Number(id), bodyFormat: "atlas_doc_format" }, `page ${id}`);
    const inlineRoots = await fetchPaginated(client.comment.getPageInlineComments, { id: Number(id), bodyFormat: "atlas_doc_format" }, `page ${id}`);

    const footerThreads = await Promise.all(
        footerRoots.map(async (root) => toThread(root, await fetchReplies(client.comment.getFooterCommentChildren, root.id, "footer comment"), "footer")),
    );
    const inlineThreads = await Promise.all(
        inlineRoots.map(async (root) => toThread(root, await fetchReplies(client.comment.getInlineCommentChildren, root.id, "inline comment"), "inline")),
    );

    const threads = [...footerThreads, ...inlineThreads].sort((a, b) =>
        (a.comments[0]?.createdAt ?? "").localeCompare(b.comments[0]?.createdAt ?? ""),
    );

    await downloadThreadsMedia(client, id, threads, dirname(out), credentials);

    if (format === "markdown") {
        await write(out, toMarkdown(id, threads));
    } else {
        await write(out, serialize({ threads }));
    }
}

// Impure (I/O): page over a comment-list method (root footer/inline comments,
// or a given comment's children), same cursor convention as
// confluence-download's fetchDescendants.
async function fetchPaginated(method, params, resource) {
    const results = [];
    let cursor;
    do {
        let page;
        try {
            page = await method({ ...params, cursor });
        } catch (err) {
            throw toConfluenceError(err, { resource });
        }
        results.push(...(page.results ?? []));
        cursor = nextCursor(page._links);
    } while (cursor);
    return results;
}

// Impure (I/O): walk a comment's full reply chain -- getFooterCommentChildren
// / getInlineCommentChildren return only a comment's *direct* children, so
// this breadth-first-queues every fetched child to fetch its own children in
// turn, flattening the whole subtree (Confluence's UI only ever shows one
// level of replies today, but the API doesn't guarantee that won't change).
async function fetchReplies(getChildren, rootId, resourceLabel) {
    const all = [];
    const queue = [rootId];
    while (queue.length) {
        const parentId = queue.shift();
        const children = await fetchPaginated(
            getChildren,
            { id: Number(parentId), bodyFormat: "atlas_doc_format" },
            `${resourceLabel} ${parentId}`,
        );
        all.push(...children);
        queue.push(...children.map((c) => c.id));
    }
    return all;
}

// Finds media references across every comment body in every thread and
// downloads/rewrites them in place before the threads are written. Fetches
// the page's attachments (a call this feature otherwise never needs) only
// when at least one comment actually references a media id -- same
// convention as jira-comments' downloadCommentsMedia.
async function downloadThreadsMedia(client, id, threads, containingDir, credentials) {
    const allComments = threads.flatMap((t) => t.comments);
    const mediaIds = [...new Set(allComments.flatMap((c) => findMediaIds(c.body)))];
    if (!mediaIds.length) {
        return;
    }
    const resolve = await resolvePageMedia(client, Number(id), credentials);
    const idToFilename = await downloadMedia({ mediaIds, resolve, containingDir, baseName: `confluence-${id}` });
    for (const comment of allComments) {
        comment.body = rewriteMediaLinks(comment.body, idToFilename);
    }
}

// Pure: a root comment plus its (already fetched) replies -> one neutral
// thread. resolutionStatus and selection describe the thread as a whole, so
// they're read off the root only. Exported for unit testing.
export function toThread(rootRaw, replyRaws, kind) {
    const comments = [rootRaw, ...replyRaws].map(toCommentEntry).sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
    return {
        kind,
        resolutionStatus: kind === "inline" ? (rootRaw.resolutionStatus ?? null) : null,
        selection: kind === "inline" ? (rootRaw.properties?.inlineOriginalSelection ?? null) : null,
        comments,
    };
}

// Pure: a single Confluence comment (v2 API, atlas_doc_format body) -> neutral
// shape. authorId is the raw accountId -- the v2 comment API has no embedded
// display name (unlike Jira's), and the only lookup endpoint (bulk user
// lookup) looks admin-scoped, so it's left unresolved. Exported for unit
// testing.
export function toCommentEntry(raw) {
    const rawBody = raw.body?.atlas_doc_format?.value;
    const adf = rawBody ? JSON.parse(rawBody) : null;
    return {
        id: raw.id ?? null,
        authorId: raw.version?.authorId ?? null,
        createdAt: raw.version?.createdAt ? new Date(raw.version.createdAt).toISOString() : null,
        body: adfToMarkdown(adf, { plugins }),
    };
}

// Pure: neutral threads -> a single markdown document. Each thread opens with
// `- Type: footer|inline` (plus `- Status: <resolutionStatus>` for inline),
// then an inline thread's highlighted `selection` -- the text it's anchored
// to, from `properties.inlineOriginalSelection`, documented in confluence.js's
// own source as "Text that is highlighted" -- as a blockquote above the
// thread's first `## Author:` entry (footer threads aren't anchored to
// anything, so they never carry one), then one `## Author:` section per
// comment in the thread, root first. Threads are separated by an `---` rule.
// Exported for unit testing.
export function toMarkdown(id, threads) {
    const sections = threads.map((t) => {
        const bullets = [`- Type: ${t.kind}`];
        if (t.kind === "inline") {
            bullets.push(`- Status: ${t.resolutionStatus ?? "open"}`);
        }
        const quote = t.selection ? `\n\n> ${t.selection}` : "";
        const comments = t.comments
            .map((c) => `## Author: ${c.authorId ?? "unknown"} (${c.createdAt ?? "unknown"}) [id: ${c.id ?? "unknown"}]\n\n${c.body}`)
            .join("\n\n");
        return `${bullets.join("\n")}${quote}\n\n${comments}`;
    });
    return `# ${id} comments\n\n${sections.join("\n\n---\n\n")}\n`;
}
