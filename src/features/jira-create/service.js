import { readFile } from "node:fs/promises";
import { requireKeys } from "../../shared/config.js";
import { CliError } from "../../shared/errors.js";
import { createJiraClient } from "../../shared/jira-client.js";
import { markdownToAdf } from "../../shared/adf.js";
import { parse } from "../../shared/frontmatter.js";

// Orchestrates: read a markdown file, map frontmatter + body to a Jira issue,
// create it, and report the new key.
export async function createTicket({ file, project, config }) {
    requireKeys(config, ["jira.baseUrl", "jira.email", "jira.token"]);
    const spField = config.jira.storyPointsField || null;

    const content = await readFile(file, "utf8");
    const { data, body } = parse(content);
    const fields = toIssueFields({ data, body, project, spField });

    const client = createJiraClient(config);
    const created = await client.issues.createIssue({ fields });

    const url = `${config.jira.baseUrl.replace(/\/$/, "")}/browse/${created.key}`;
    console.log(`Created ${created.key}: ${url}`);
    return created;
}

// Pure: frontmatter + body -> Jira createIssue `fields` payload. Exported for tests.
export function toIssueFields({ data, body, project, spField }) {
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
    return fields;
}
