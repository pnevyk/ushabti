import { readFile } from "node:fs/promises";
import { requireKeys } from "../../shared/config.js";
import { CliError } from "../../shared/errors.js";
import { createJiraClient } from "../../shared/jira-client.js";
import { markdownToAdf } from "../../shared/adf.js";
import { parse } from "../../shared/frontmatter.js";

// Read a markdown file, take the issue key from frontmatter `id`, map the rest
// of the frontmatter + body to a Jira update payload, and edit the ticket.
export async function updateTicket({ file, config }) {
    requireKeys(config, ["jira.baseUrl", "jira.email", "jira.token"]);
    const spField = config.jira.storyPointsField || null;

    const content = await readFile(file, "utf8");
    const { data, body } = parse(content);
    if (!data.id) {
        throw new CliError("Frontmatter is missing required `id`");
    }
    const fields = toUpdateFields({ data, body, spField });

    const client = createJiraClient(config);
    await client.issues.editIssue({ issueIdOrKey: String(data.id), fields });

    const url = `${config.jira.baseUrl.replace(/\/$/, "")}/browse/${data.id}`;
    console.log(`Updated ${data.id}: ${url}`);
}

// Pure: frontmatter + body -> Jira editIssue `fields` payload, only present
// fields included. Exported for tests.
export function toUpdateFields({ data, body, spField }) {
    const fields = {};
    if (data.title != null) {
        fields.summary = data.title;
    }
    if (data.type != null) {
        fields.issuetype = { name: data.type };
    }
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
    if (Object.keys(fields).length === 0) {
        throw new CliError("Frontmatter and body have no fields to update");
    }
    return fields;
}
