import { Version3Client, AgileClient } from "jira.js";

function auth(config) {
    return {
        host: config.jira.baseUrl,
        authentication: {
            basic: { email: config.jira.email, apiToken: config.jira.token },
        },
    };
}

export function createJiraClient(config) {
    return new Version3Client(auth(config));
}

// Agile (board/sprint) endpoints live on a separate client in jira.js.
export function createJiraAgileClient(config) {
    return new AgileClient(auth(config));
}
