import { readFile, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { resolveAtlassian } from "../../shared/config.js";
import { CliError } from "../../shared/errors.js";
import { createConfluenceClient } from "../../shared/confluence-client.js";
import { markdownToAdf } from "../../shared/adf.js";
import { parse, stringify } from "../../shared/frontmatter.js";
import { write } from "../../shared/output/file.js";
import { nodeFilename } from "../../shared/confluence-naming.js";

// Orchestrates: resolve a space key to its id, read a markdown file, map
// frontmatter + body to a Confluence page, create it, and report the new
// page's url. With `update`, write the new id back into the source file and
// rename it to <title>-<id>.md, matching confluence download's naming.
export async function createPage({ space, file, update, config }) {
    const { baseUrl } = resolveAtlassian(config);
    const client = createConfluenceClient(config);

    const spaces = await client.space.getSpaces({ keys: [space] });
    const spaceId = spaces.results?.[0]?.id;
    if (!spaceId) {
        throw new CliError(`Space not found: ${space}`);
    }

    const content = await readFile(file, "utf8");
    const { data, body } = parse(content);
    const pageBody = toCreateBody({ data, body, spaceId });

    const created = await client.page.createPage({ body: pageBody });

    const url = `${baseUrl.replace(/\/$/, "")}${created._links?.webui ?? ""}`;
    console.log(`Created ${created.id}: ${url}`);

    if (update) {
        const newPath = join(dirname(file), nodeFilename({ id: created.id, title: data.title }, "md"));
        await write(newPath, applyCreatedId({ data, body, id: created.id }));
        if (newPath !== file) {
            await unlink(file);
        }
        console.log(`Updated ${file} -> ${newPath}`);
    }

    return created;
}

// Pure: re-serialize frontmatter + body with `id` set to the created page id
// as the first frontmatter field. Exported for tests.
export function applyCreatedId({ data, body, id }) {
    const next = { id, ...data };
    next.id = id;
    return stringify(next, body);
}

// Pure: frontmatter + body -> Confluence createPage `body` payload. Exported for tests.
export function toCreateBody({ data, body, spaceId }) {
    if (!data.title) {
        throw new CliError("Frontmatter is missing required `title`");
    }

    const pageBody = {
        spaceId,
        status: "current",
        title: data.title,
        body: { representation: "atlas_doc_format", value: JSON.stringify(markdownToAdf(body)) },
    };
    if (data.parentId != null) {
        pageBody.parentId = String(data.parentId);
    }
    if (data.type === "live") {
        pageBody.subtype = "live";
    }
    return pageBody;
}
