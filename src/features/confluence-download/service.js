import { resolveAtlassian } from "../../shared/config.js";
import { createConfluenceClient } from "../../shared/confluence-client.js";
import { adfToMarkdown } from "../../shared/adf.js";
import { serialize } from "../../shared/output/json.js";
import { stringify } from "../../shared/frontmatter.js";
import { write } from "../../shared/output/file.js";

// Orchestrates: fetch a single Confluence page (as Atlas Document Format),
// map it to a neutral shape, then emit either a JSON file or a markdown file
// with YAML frontmatter.
export async function downloadPage({ id, format, out, config }) {
    resolveAtlassian(config);

    const client = createConfluenceClient(config);
    const page = await client.page.getPageById({ id: Number(id), bodyFormat: "atlas_doc_format" });
    const mapped = toPage(page);

    if (format === "markdown") {
        const { description, ...meta } = mapped;
        await write(out, stringify(meta, description));
    } else {
        await write(out, serialize(mapped));
    }
}

// Pure: a Confluence Page (v2 API, atlas_doc_format body) -> neutral shape.
// Exported for unit testing.
export function toPage(page) {
    const raw = page.body?.atlas_doc_format?.value;
    const adf = raw ? JSON.parse(raw) : null;
    return {
        id: page.id ?? null,
        title: page.title ?? "",
        spaceId: page.spaceId ?? null,
        parentId: page.parentId ?? null,
        description: adfToMarkdown(adf),
    };
}
