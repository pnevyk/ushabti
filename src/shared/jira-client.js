import { Version3Client } from "jira.js";

export function createJiraClient(config) {
    return new Version3Client({
        host: config.jira.baseUrl,
        authentication: {
            basic: { email: config.jira.email, apiToken: config.jira.token },
        },
    });
}
