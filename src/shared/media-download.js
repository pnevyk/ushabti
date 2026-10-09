import { extname, join } from "node:path";
import { writeBinary } from "./output/file.js";

// Matches adf.js's `attachment:<mediaId>` pseudo-scheme (see adf.js's header
// comment on media round-tripping). The id itself is opaque to this module;
// stop at ")" or whitespace so it works for any id shape ADF ever emits.
const MEDIA_LINK_PATTERN = /attachment:([^)\s]+)/g;

// Pure: scan a markdown body for `attachment:<mediaId>` links, returning the
// referenced ids, deduplicated (the same image can appear more than once).
export function findMediaIds(description) {
    const ids = new Set();
    for (const match of (description ?? "").matchAll(MEDIA_LINK_PATTERN)) {
        ids.add(match[1]);
    }
    return [...ids];
}

// Pure: the warning for a document whose attachments are not downloaded
// because its output goes to stdout.
export function mediaSkippedMessage(label, count) {
    return `Skipping ${count} attachment${count === 1 ? "" : "s"} of ${label}: not downloaded when writing to stdout`;
}

// Warns (stderr) about attachments left undownloaded in stdout mode; no-op
// when the document references none.
export function warnMediaSkipped(label, mediaIds) {
    if (mediaIds.length) {
        console.warn(mediaSkippedMessage(label, mediaIds.length));
    }
}

// Pure: replace each `attachment:<mediaId>` with its resolved local filename.
// An id with no entry in idToFilename (unmatched attachment) is left as-is.
export function rewriteMediaLinks(description, idToFilename) {
    return (description ?? "").replace(MEDIA_LINK_PATTERN, (full, id) => idToFilename.get(id) ?? full);
}

// Impure (I/O): download every referenced media id via the product-specific
// `resolve(id)` (returning `{ filename, fetchBytes }` or null on no match),
// writing each as `<baseName>.<mediaId>.<ext>` alongside the containing
// page/issue's own file. Unmatched ids are logged and skipped -- same
// "skip and note, don't fail the whole download" convention as
// confluence-download's tree pruning. Returns the id -> filename map for
// rewriteMediaLinks.
export async function downloadMedia({ mediaIds, resolve, containingDir, baseName }) {
    const idToFilename = new Map();
    for (const mediaId of mediaIds) {
        const match = await resolve(mediaId);
        if (!match) {
            console.warn(`Skipping media ${mediaId}: no matching attachment found`);
            continue;
        }
        const filename = `${baseName}.${mediaId}${extname(match.filename)}`;
        await writeBinary(join(containingDir, filename), await match.fetchBytes());
        idToFilename.set(mediaId, filename);
    }
    return idToFilename;
}
