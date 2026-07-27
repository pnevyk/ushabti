import { readFile } from "node:fs/promises";
import { resolveAtlassian } from "../../shared/config.js";
import { CliError } from "../../shared/errors.js";
import { createConfluenceClient } from "../../shared/confluence-client.js";
import { markdownToAdf } from "../../shared/adf.js";
import { parse } from "../../shared/frontmatter.js";

// Read a markdown file, take the page id from frontmatter `id`, fetch the
// page's current version (Confluence's optimistic-locking requirement --
// the update body must set version.number to current + 1), map the rest of
// the frontmatter + body to a Confluence update payload, and update the page.
export async function uploadPage({ file, config }) {
    const { baseUrl } = resolveAtlassian(config);

    const content = await readFile(file, "utf8");
    const { data, body } = parse(content);
    if (!data.id) {
        throw new CliError("Frontmatter is missing required `id`");
    }

    const client = createConfluenceClient(config);
    const current = await client.page.getPageById({ id: Number(data.id) });
    const pageBody = toUpdateBody({ data, body, current });

    const updated = await client.page.updatePage({ id: Number(data.id), body: pageBody });

    const url = `${baseUrl.replace(/\/$/, "")}${updated._links?.webui ?? ""}`;
    console.log(`Updated ${data.id}: ${url}`);
}

// Pure: frontmatter + body + the page's current version -> Confluence
// updatePage `body` payload. Exported for tests.
export function toUpdateBody({ data, body, current }) {
    return {
        id: String(data.id),
        status: "current",
        title: data.title ?? current.title,
        body: { representation: "atlas_doc_format", value: JSON.stringify(markdownToAdf(body)) },
        version: { number: (current.version?.number ?? 0) + 1 },
    };
}
