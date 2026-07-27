import { readFile, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { resolveAtlassian } from "../../shared/config.js";
import { CliError } from "../../shared/errors.js";
import { createJiraClient } from "../../shared/jira-client.js";
import { markdownToAdf } from "../../shared/adf.js";
import { parse, stringify } from "../../shared/frontmatter.js";
import { write } from "../../shared/output/file.js";

// Orchestrates: read a markdown file, map frontmatter + body to a Jira issue,
// create it, and report the new key. With `update`, write the new key back
// into the source file and rename it to <KEY>.md.
export async function createTicket({ file, project, update, config }) {
    const { baseUrl } = resolveAtlassian(config);
    const spField = config.jira?.storyPointsField || null;
    const sprintField = config.jira?.sprintField || null;

    const content = await readFile(file, "utf8");
    const { data, body } = parse(content);
    const fields = toIssueFields({ data, body, project, spField, sprintField });

    const client = createJiraClient(config);
    const created = await client.issues.createIssue({ fields });

    const url = `${baseUrl.replace(/\/$/, "")}/browse/${created.key}`;
    console.log(`Created ${created.key}: ${url}`);

    if (update) {
        const newPath = join(dirname(file), `${created.key}.md`);
        await write(newPath, applyCreatedId({ data, body, key: created.key }));
        if (newPath !== file) {
            await unlink(file);
        }
        console.log(`Updated ${file} -> ${newPath}`);
    }

    return created;
}

// Pure: re-serialize frontmatter + body with `id` set to the created key as the
// first frontmatter field. Exported for tests.
export function applyCreatedId({ data, body, key }) {
    const next = { id: key, ...data };
    next.id = key;
    return stringify(next, body);
}

// Pure: frontmatter + body -> Jira createIssue `fields` payload. Exported for tests.
export function toIssueFields({ data, body, project, spField, sprintField }) {
    if (!data.title) {
        throw new CliError("Frontmatter is missing required `title`");
    }
    if (!data.type) {
        throw new CliError("Frontmatter is missing required `type`");
    }

    const fields = {
        project: { key: project },
        issuetype: { name: data.type },
        summary: data.title,
    };
    const description = markdownToAdf(body);
    if (description.content.length) {
        fields.description = description;
    }
    if (data.parent != null) {
        fields.parent = { key: String(data.parent) };
    }
    if (data.assignee != null) {
        fields.assignee = { accountId: String(data.assignee) };
    }
    if (spField && data.storyPoints != null) {
        fields[spField] = data.storyPoints;
    }
    if (sprintField && data.sprint != null) {
        fields[sprintField] = data.sprint;
    }
    return fields;
}
