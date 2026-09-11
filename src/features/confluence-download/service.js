import { dirname, join } from "node:path";
import { isNotFoundError } from "confluence.js";
import { resolveAtlassian } from "../../shared/secrets.js";
import { createConfluenceClient } from "../../shared/confluence-client.js";
import { adfToMarkdown } from "../../shared/adf.js";
import { serialize } from "../../shared/output/json.js";
import { stringify } from "../../shared/frontmatter.js";
import { write, ensureDir } from "../../shared/output/file.js";
import { nodeBasename, nodeFilename } from "../../shared/confluence-naming.js";
import { findMediaIds, rewriteMediaLinks, downloadMedia } from "../../shared/media-download.js";
import { nextCursor, resolvePageMedia } from "../../shared/confluence-media.js";
import { toConfluenceError } from "../../shared/confluence-errors.js";
import { plugins } from "../../plugins/index.js";

// Orchestrates: fetch a single Confluence page (as Atlas Document Format),
// map it to a neutral shape, then emit either a JSON file or a markdown file
// with YAML frontmatter.
export async function downloadPage({ id, format, out, config }) {
    const credentials = resolveAtlassian(config);

    const client = createConfluenceClient(config);
    let page;
    try {
        page = await client.page.getPageById({ id: Number(id), bodyFormat: "atlas_doc_format" });
    } catch (err) {
        throw toConfluenceError(err, { resource: `page ${id}` });
    }
    const mapped = toPage(page);

    const ext = format === "markdown" ? "md" : "ushabti.json";
    const outPath = out ?? nodeFilename(mapped, ext);
    await downloadNodeMedia(client, mapped, dirname(outPath), credentials);
    await write(outPath, formatNode(mapped, format));
}

// Orchestrates: resolve whether --id is a page or a folder, fetch its entire
// descendant subtree in one paginated call, prune anything archived or of an
// unsupported content type (logging a note per pruned subtree), then
// recursively fetch and write each kept node -- one file per node, plus a
// same-named directory for any node with kept children.
export async function downloadTree({ id, format, out, config }) {
    const credentials = resolveAtlassian(config);
    const client = createConfluenceClient(config);

    const root = await resolveRoot(client, Number(id));
    const items = await fetchDescendants(client, root.type, Number(id));
    const childrenByParent = groupByParent(items);
    const { keptChildrenByParent, skipped } = pruneTree(root.mapped.id, childrenByParent);

    for (const node of skipped) {
        console.warn(`Skipping ${node.type} ${node.id} (${node.title}): ${node.reason}`);
    }

    await ensureDir(out);
    await writeNode(client, root.mapped, out, format, keptChildrenByParent, credentials);
}

// Try the page first, since that's the overwhelmingly common root; fall back
// to a folder only on a genuine 404, so any other failure (auth, network,
// permissions) still surfaces as-is instead of being masked by the fallback.
async function resolveRoot(client, id) {
    try {
        const page = await client.page.getPageById({ id, bodyFormat: "atlas_doc_format" });
        return { type: "page", mapped: toPage(page) };
    } catch (err) {
        if (!isNotFoundError(err)) {
            throw toConfluenceError(err, { resource: `page ${id}` });
        }
    }
    let folder;
    try {
        folder = await client.folder.getFolderById({ id });
    } catch (err) {
        throw toConfluenceError(err, { resource: `folder ${id}` });
    }
    return { type: "folder", mapped: toFolder(folder) };
}

// getPageDescendants/getFolderDescendants each return the *entire* subtree
// (not one level) in top-to-bottom order, paginated via a cursor embedded in
// _links.next -- so this loops pages of the same call, it does not recurse
// per node.
async function fetchDescendants(client, rootType, rootId) {
    const items = [];
    let cursor;
    do {
        let page;
        try {
            page =
                rootType === "folder"
                    ? await client.descendants.getFolderDescendants({ id: rootId, cursor })
                    : await client.descendants.getPageDescendants({ id: rootId, cursor });
        } catch (err) {
            throw toConfluenceError(err, { resource: `${rootType} ${rootId}` });
        }
        items.push(...(page.results ?? []));
        cursor = nextCursor(page._links);
    } while (cursor);
    return items;
}

// Fetches each kept node's full content and writes it, recursing into a
// same-named directory for any node that has kept children. Not pure (does
// HTTP + filesystem I/O), so not unit-tested directly -- same convention as
// the rest of this codebase's orchestrator functions.
async function writeNode(client, mapped, containingDir, format, keptChildrenByParent, credentials) {
    await downloadNodeMedia(client, mapped, containingDir, credentials);
    const ext = format === "markdown" ? "md" : "ushabti.json";
    await write(join(containingDir, nodeFilename(mapped, ext)), formatNode(mapped, format));

    const children = keptChildrenByParent.get(mapped.id) ?? [];
    if (!children.length) {
        return;
    }

    const childDir = join(containingDir, nodeBasename(mapped));
    await ensureDir(childDir);
    for (const child of children) {
        let childMapped;
        try {
            childMapped =
                child.type === "folder"
                    ? toFolder(await client.folder.getFolderById({ id: Number(child.id) }))
                    : toPage(await client.page.getPageById({ id: Number(child.id), bodyFormat: "atlas_doc_format" }));
        } catch (err) {
            throw toConfluenceError(err, { resource: `${child.type} ${child.id}` });
        }
        await writeNode(client, childMapped, childDir, format, keptChildrenByParent, credentials);
    }
}

// Finds this node's own media references and downloads/rewrites them in
// place before the node is written -- a folder's `mapped.description` is
// undefined, so findMediaIds short-circuits to [] and no resolvePageMedia
// call happens for those. Runs as a separate pass after toPage/toFolder so
// those mapping functions stay pure and testable; only this step does I/O.
async function downloadNodeMedia(client, mapped, containingDir, credentials) {
    const mediaIds = findMediaIds(mapped.description);
    if (!mediaIds.length) {
        return;
    }
    const resolve = await resolvePageMedia(client, Number(mapped.id), credentials);
    const idToFilename = await downloadMedia({ mediaIds, resolve, containingDir, baseName: nodeBasename(mapped) });
    mapped.description = rewriteMediaLinks(mapped.description, idToFilename);
}

function formatNode(mapped, format) {
    if (format === "markdown") {
        const { description, ...meta } = mapped;
        return stringify(meta, description ?? "");
    }
    return serialize(mapped);
}

// Pure: a Confluence Page (v2 API, atlas_doc_format body) -> neutral shape.
// `type` is the page's subtype ("page" or "live", i.e. a live doc) -- not
// typed on this SDK's single-page response model, but present at runtime per
// Atlassian's REST v2 docs. Exported for unit testing.
export function toPage(page) {
    const raw = page.body?.atlas_doc_format?.value;
    const adf = raw ? JSON.parse(raw) : null;
    return {
        id: page.id ?? null,
        title: page.title ?? "",
        type: page.subtype ?? "page",
        spaceId: page.spaceId ?? null,
        parentId: page.parentId ?? null,
        description: toDescription(adf),
    };
}

// A page whose entire body is a single markdown-language code block was
// authored as raw markdown directly -- unwrap it verbatim instead of running
// it through adfToMarkdown, which would re-fence the whole file as a code
// block instead of reproducing its actual content.
function toDescription(adf) {
    const content = adf?.content ?? [];
    if (content.length === 1 && content[0].type === "codeBlock" && content[0].attrs?.language === "markdown") {
        return (content[0].content ?? []).map((n) => n.text ?? "").join("");
    }
    return adfToMarkdown(adf, { plugins });
}

// Pure: a Confluence Folder -> neutral shape. Folders carry no body/content
// of their own -- just identity and hierarchy. Exported for unit testing.
export function toFolder(folder) {
    return {
        id: folder.id ?? null,
        title: folder.title ?? "",
        type: "folder",
        parentId: folder.parentId ?? null,
    };
}

const SUPPORTED_TYPES = ["page", "folder"];

// Pure: flat descendants list -> Map<parentId, item[]> adjacency list.
// Exported for unit testing.
export function groupByParent(items) {
    const map = new Map();
    for (const item of items) {
        const list = map.get(item.parentId) ?? [];
        list.push(item);
        map.set(item.parentId, list);
    }
    return map;
}

// Pure: walk the descendants adjacency list top-down from the root, keeping
// only current-status pages/folders. An unsupported type (whiteboard,
// database, embed, ...) or a non-current item (archived) is skipped *and its
// whole subtree is pruned with it* -- its children would otherwise have
// nowhere to attach -- recorded once per pruned subtree root, not per
// descendant. Exported for unit testing.
export function pruneTree(rootId, childrenByParent) {
    const keptChildrenByParent = new Map();
    const skipped = [];

    function walk(parentId) {
        const children = childrenByParent.get(parentId) ?? [];
        const kept = [];
        for (const item of children) {
            const supported = SUPPORTED_TYPES.includes(item.type);
            if (supported && item.status === "current") {
                kept.push(item);
                walk(item.id);
            } else {
                const reason = supported ? `status: ${item.status}` : `unsupported content type: ${item.type}`;
                skipped.push({ id: item.id, title: item.title, type: item.type, reason });
            }
        }
        if (kept.length) {
            keptChildrenByParent.set(parentId, kept);
        }
    }

    walk(rootId);
    return { keptChildrenByParent, skipped };
}
