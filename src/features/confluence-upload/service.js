import { readFile } from "node:fs/promises";
import { resolveAtlassian } from "../../shared/secrets.js";
import { ValidationError } from "../../shared/errors.js";
import { createConfluenceClient } from "../../shared/confluence-client.js";
import { markdownToAdf } from "../../shared/adf.js";
import { parse } from "../../shared/frontmatter.js";
import { plugins, resolveDefaults } from "../../plugins/index.js";

// Read a markdown file, take the page id from frontmatter `id`, fetch the
// page's current version (Confluence's optimistic-locking requirement --
// the update body must set version.number to current + 1), map the rest of
// the frontmatter + body to a Confluence update payload, and update the page.
export async function uploadPage({ file, config }) {
    const { baseUrl } = resolveAtlassian(config);
    const defaults = resolveDefaults(config);

    const content = await readFile(file, "utf8");
    const { data, body } = parse(content);
    if (!data.id) {
        throw new ValidationError("An id in the frontmatter is required to update a page. Add it and try again.");
    }

    const client = createConfluenceClient(config);
    const current = await client.page.getPageById({ id: Number(data.id) });
    const pageBody = toUpdateBody({ data, body, current, plugins, defaults });

    const updated = await client.page.updatePage({ id: Number(data.id), body: pageBody });

    const url = `${baseUrl.replace(/\/$/, "")}${updated._links?.webui ?? ""}`;
    console.log(`Updated ${data.id}: ${url}`);
}

// Pure: frontmatter + body + the page's current version -> Confluence
// updatePage `body` payload. Exported for tests.
export function toUpdateBody({ data, body, current, plugins = [], defaults = {} }) {
    const pageBody = {
        id: String(data.id),
        status: "current",
        title: data.title ?? current.title,
        body: { representation: "atlas_doc_format", value: JSON.stringify(markdownToAdf(body, { plugins, defaults })) },
        version: { number: (current.version?.number ?? 0) + 1 },
    };
    if (data.parentId != null) {
        pageBody.parentId = String(data.parentId);
    }
    return pageBody;
}
