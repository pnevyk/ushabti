import { Version3Client, AgileClient } from "jira.js";
import { resolveAtlassian } from "./config.js";

function auth(config) {
    const { baseUrl, email, token } = resolveAtlassian(config);
    return {
        host: baseUrl,
        authentication: {
            basic: { email, apiToken: token },
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
